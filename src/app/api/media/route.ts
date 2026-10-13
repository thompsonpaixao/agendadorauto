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

    // 1. Consulta status em published_posts para cada media_id (fonte de verdade definitiva de publicação)
    const publishedMap = new Map<string, { id: string; publishedAt: string; permalink?: string; instagramMediaId?: string }>();
    if (mediaIds.length > 0) {
      const { data: pubRecords } = await supabaseAdmin
        .from("published_posts")
        .select("id, media_id, scheduled_post_id, published_at, instagram_media_id, permalink")
        .in("media_id", mediaIds)
        .order("published_at", { ascending: false });

      (pubRecords || []).forEach((pub: any) => {
        if (pub.media_id && !publishedMap.has(pub.media_id)) {
          publishedMap.set(pub.media_id, {
            id: pub.id,
            publishedAt: pub.published_at,
            permalink: pub.permalink || undefined,
            instagramMediaId: pub.instagram_media_id || undefined,
          });
        }
      });
    }

    // 2. Consulta status em scheduled_posts para cada media_id
    const scheduledMap = new Map<string, {
      status: string;
      id: string;
      scheduledAt?: string;
      publishedAt?: string;
      errorMessage?: string;
      queueId?: string;
      isProcessingActive: boolean;
    }>();
    if (mediaIds.length > 0) {
      const { data: posts } = await supabaseAdmin
        .from("scheduled_posts")
        .select("id, media_id, status, scheduled_at, published_at, error_message, error_code, meta_container_id, locked_at, container_created_at, last_container_check_at, created_at, queue_id, reel_queues(status)")
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
            scheduledAt: p.scheduled_at,
            publishedAt: p.published_at,
            errorMessage: p.error_message,
            queueId: p.queue_id,
            isProcessingActive,
          });
        }
      });
    }

    // 3. Consulta status em reel_queue_items (apenas filas ativas/existentes)
    const queueItemMap = new Map<string, { status: string; queueId: string; queueName: string; scheduledAt?: string; publishedAt?: string }>();
    if (mediaIds.length > 0) {
      const { data: qItems } = await supabaseAdmin
        .from("reel_queue_items")
        .select("media_id, status, queue_id, scheduled_at, published_at, reel_queues(id, name, status)")
        .in("media_id", mediaIds);

      (qItems || []).forEach((qi: any) => {
        const queueObj = Array.isArray(qi.reel_queues) ? qi.reel_queues[0] : qi.reel_queues;
        if (queueObj && queueObj.status !== "completed" && queueObj.status !== "cancelled") {
          if (qi.media_id && !queueItemMap.has(qi.media_id)) {
            const qName = queueObj.name || "Fila de Reels";
            const qId = queueObj.id || qi.queue_id || "";
            queueItemMap.set(qi.media_id, {
              status: qi.status,
              queueId: qId,
              queueName: qName,
              scheduledAt: qi.scheduled_at,
              publishedAt: qi.published_at,
            });
          }
        }
      });
    }

    // 4. Consulta status em carousel_items
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
        const pub = publishedMap.get(item.id);
        const sp = scheduledMap.get(item.id);
        const qi = queueItemMap.get(item.id);
        const ciStatus = carouselStatusMap.get(item.id);

        const hasActiveScheduledPost = Boolean(sp && (sp.status === "scheduled" || (sp.status as string) === "queued"));
        const hasActiveProcessingPost = Boolean(sp && sp.status === "processing" && sp.isProcessingActive);
        const hasActiveCarousel = Boolean(
          ciStatus && ciStatus !== "published" && ciStatus !== "error" && ciStatus !== "cancelled"
        );

        const isPublished = Boolean(
          pub ||
          item.published_at ||
          item.retention_status === "eligible_for_deletion" ||
          sp?.status === "published" ||
          sp?.publishedAt ||
          qi?.status === "published" ||
          qi?.publishedAt ||
          ciStatus === "published"
        );

        if (isPublished) {
          opStatus = "published";
        } else if (hasActiveProcessingPost || ciStatus === "processing" || ciStatus === "publishing") {
          opStatus = "publishing";
        } else if (hasActiveScheduledPost || (qi && ["pending", "scheduled", "processing"].includes(qi.status)) || ciStatus === "scheduled" || (ciStatus === "queued" && hasActiveCarousel)) {
          opStatus = "scheduled";
        } else if (sp?.status === "failed" || ciStatus === "error" || (sp?.status === "processing" && !sp.isProcessingActive)) {
          opStatus = "failed";
        } else {
          opStatus = "available";
        }

        const effectivePublishedAt = item.published_at || pub?.publishedAt || sp?.publishedAt || qi?.publishedAt || undefined;
        const effectivePermalink = pub?.permalink || undefined;

        // Auto-reconciliação não bloqueante no banco caso falte published_at na tabela media
        if (pub?.publishedAt && !item.published_at) {
          void supabaseAdmin
            .from("media")
            .update({
              published_at: pub.publishedAt,
              retention_status: "eligible_for_deletion",
              delete_after: new Date(Date.now() + 7 * 86400000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
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
          publishedAt: effectivePublishedAt,
          deletedAt: item.deleted_at,
          relatedPostId: sp?.id,
          relatedPostPermalink: effectivePermalink,
          queueId: qi?.queueId || sp?.queueId,
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
