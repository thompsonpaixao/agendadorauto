import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MediaItem } from "@/types";
import { getMediaReadUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/media
 * 
 * Lista mídias reais do repositório a partir de public.media,
 * com isolamento estrito por user_id e geração de Signed URLs para
 * acesso seguro aos arquivos privados do Supabase Storage.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Não autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const isTrash = searchParams.get("trash") === "true";

    const supabaseAdmin = createAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Servidor administrativo não configurado." },
        { status: 500 }
      );
    }

    let query = supabaseAdmin
      .from("media")
      .select("*")
      .eq("user_id", user.id)
      .neq("retention_status", "deleted")
      .order("created_at", { ascending: false });

    if (isTrash) {
      query = query.not("deleted_at", "is", null);
    } else {
      query = query.is("deleted_at", null);
    }

    if (accountId && accountId !== "all") {
      query = query.eq("instagram_account_id", accountId);
    }

    const { data: records, error } = await query;

    if (error) {
      console.error("[Media GET] Erro ao buscar mídias:", error);
      return NextResponse.json(
        { success: false, message: `Erro ao buscar mídias: ${error.message}` },
        { status: 500 }
      );
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ success: true, media: [] });
    }

    const mediaIds = records.map((r) => r.id);

    // Consulta status em scheduled_posts para cada media_id
    const scheduledMap = new Map<string, { status: string; id: string; isProcessingActive: boolean }>();
    if (mediaIds.length > 0) {
      const { data: posts } = await supabaseAdmin
        .from("scheduled_posts")
        .select("id, media_id, status, meta_container_id, locked_at, container_created_at, last_container_check_at, created_at, queue_id, reel_queues(status)")
        .in("media_id", mediaIds)
        .order("created_at", { ascending: false });

      const now = Date.now();
      (posts || []).forEach((p: any) => {
        if (p.media_id && !scheduledMap.has(p.media_id)) {
          let isProcessingActive = false;
          if (p.status === "processing") {
            const queueObj = Array.isArray(p.reel_queues) ? p.reel_queues[0] : p.reel_queues;
            const isQueueInactive = queueObj && (queueObj.status === "paused" || queueObj.status === "cancelled" || queueObj.status === "completed");
            const hasFreshLock = p.locked_at && (now - new Date(p.locked_at).getTime() < 5 * 60 * 1000);
            const containerTs = p.container_created_at || p.last_container_check_at || p.created_at;
            const hasFreshContainer = p.meta_container_id && containerTs && (now - new Date(containerTs).getTime() < 15 * 60 * 1000) && !isQueueInactive;
            isProcessingActive = Boolean(hasFreshLock || hasFreshContainer);
          }
          scheduledMap.set(p.media_id, {
            status: p.status,
            id: p.id,
            isProcessingActive,
          });
        }
      });
    }

    // Consulta status em reel_queue_items (apenas filas ativas/existentes)
    const queueItemMap = new Map<string, { status: string; queueId: string; queueName: string }>();
    if (mediaIds.length > 0) {
      const { data: qItems } = await supabaseAdmin
        .from("reel_queue_items")
        .select("media_id, status, queue_id, reel_queues(id, name, status)")
        .in("media_id", mediaIds)
        .in("status", ["pending", "scheduled", "processing"]);

      (qItems || []).forEach((qi: any) => {
        const queueObj = Array.isArray(qi.reel_queues) ? qi.reel_queues[0] : qi.reel_queues;
        if (queueObj && queueObj.status !== "completed" && queueObj.status !== "cancelled") {
          if (qi.media_id && !queueItemMap.has(qi.media_id)) {
            const qName = queueObj.name || "Fila de Reels";
            const qId = queueObj.id || qi.queue_id || "";
            queueItemMap.set(qi.media_id, { status: qi.status, queueId: qId, queueName: qName });
          }
        }
      });
    }

    // Consulta status em carousel_items
    const carouselStatusMap = new Map<string, string>();
    if (mediaIds.length > 0) {
      const { data: cItems } = await supabaseAdmin
        .from("carousel_items")
        .select("media_id, carousels!inner(status)")
        .in("media_id", mediaIds);

      (cItems || []).forEach((ci: any) => {
        if (ci.media_id && !carouselStatusMap.has(ci.media_id)) {
          carouselStatusMap.set(ci.media_id, ci.carousels?.status || "ready");
        }
      });
    }

    // Gera Signed URLs em lote para exibição segura no frontend (validade: 2 horas)
    const mediaItems: MediaItem[] = await Promise.all(
      records.map(async (item) => {
        // Gera Signed URLs via camada de abstração (Cloudflare R2 ou Supabase Storage)
        const videoUrl = await getMediaReadUrl(item, "main", 7200);
        const thumbUrl = item.thumbnail_url
          ? await getMediaReadUrl(item, "thumbnail", 7200)
          : videoUrl;

        // Determina o status operacional real baseado estritamente em relacionamentos ativos
        let opStatus: MediaItem["operationalStatus"] = "available";
        const sp = scheduledMap.get(item.id);
        const qi = queueItemMap.get(item.id);
        const ciStatus = carouselStatusMap.get(item.id);

        const hasActiveScheduledPost = Boolean(sp && sp.status === "scheduled");
        const hasActiveProcessingPost = Boolean(sp && sp.status === "processing" && sp.isProcessingActive);
        const hasActiveCarousel = Boolean(
          ciStatus && ciStatus !== "published" && ciStatus !== "error" && ciStatus !== "cancelled"
        );

        if (item.published_at || sp?.status === "published" || ciStatus === "published" || item.retention_status === "eligible_for_deletion") {
          opStatus = "published";
        } else if (hasActiveProcessingPost || ciStatus === "processing" || ciStatus === "publishing") {
          opStatus = "publishing";
        } else if (sp?.status === "failed" || ciStatus === "error" || (sp?.status === "processing" && !sp.isProcessingActive)) {
          opStatus = "failed";
        } else if (hasActiveScheduledPost || ciStatus === "scheduled") {
          opStatus = "scheduled";
        } else if (qi || (ciStatus === "queued" && hasActiveCarousel)) {
          opStatus = "in_queue";
        } else {
          opStatus = "available";
        }

        return {
          id: item.id,
          userId: item.user_id,
          accountId: item.instagram_account_id,
          name: item.original_name,
          url: videoUrl,
          thumbnailUrl: thumbUrl,
          type: item.media_type as "video" | "image",
          sizeBytes: Number(item.size_bytes) || 0,
          durationSeconds: item.duration_seconds ? Number(item.duration_seconds) : undefined,
          position: item.position || 0,
          status: item.status as "ready" | "processing" | "uploaded" | "error",
          retentionStatus: item.retention_status,
          operationalStatus: opStatus,
          createdAt: item.created_at,
          deleteAfter: item.delete_after,
          publishedAt: item.published_at,
          deletedAt: item.deleted_at,
          relatedPostId: sp?.id,
          queueId: qi?.queueId,
          queueName: qi?.queueName,
          storageProvider: item.storage_provider || "supabase",
        };
      })
    );

    return NextResponse.json({
      success: true,
      media: mediaItems,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Media GET API] Exceção:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
