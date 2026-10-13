import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ScheduledPost } from "@/types";
import { getMediaReadUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

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

    const supabaseAdmin = createAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Servidor administrativo não configurado." },
        { status: 500 }
      );
    }

    // Consulta direta sem embeddings relacionais complexos que quebram com chaves compostas
    let query = supabaseAdmin
      .from("scheduled_posts")
      .select("*")
      .eq("user_id", user.id)
      .order("scheduled_at", { ascending: true });

    if (accountId && accountId !== "all") {
      query = query.eq("instagram_account_id", accountId);
    }

    const { data: records, error } = await query;
    if (error) {
      console.error("[Scheduled Posts API] Erro na consulta:", error);
      return NextResponse.json(
        { success: false, message: `Erro ao buscar agendamentos: ${error.message}` },
        { status: 500 }
      );
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ success: true, posts: [] });
    }

    // Resolução em lote de contas do Instagram e mídias
    const accountIds = Array.from(
      new Set(records.map((r: any) => r.instagram_account_id).filter(Boolean))
    );
    const mediaIds = Array.from(
      new Set(records.map((r: any) => r.media_id).filter(Boolean))
    );

    const accountsMap = new Map<string, { id: string; username: string; profile_picture_url: string | null }>();
    if (accountIds.length > 0) {
      const { data: accounts } = await supabaseAdmin
        .from("instagram_accounts")
        .select("id, username, profile_picture_url")
        .in("id", accountIds);

      (accounts || []).forEach((acc: any) => {
        accountsMap.set(acc.id, acc);
      });
    }

    const mediaMap = new Map<string, any>();
    if (mediaIds.length > 0) {
      const { data: medias } = await supabaseAdmin
        .from("media")
        .select("id, original_name, thumbnail_url, storage_path, storage_provider")
        .in("id", mediaIds);

      (medias || []).forEach((m: any) => {
        mediaMap.set(m.id, m);
      });
    }

    // Suporte a thumbnails de carrossel (busca o primeiro slide de cada carrossel)
    const carouselIds = records
      .filter((r) => r.post_type === "carousel" && r.carousel_id)
      .map((r) => r.carousel_id as string);

    const carouselFirstSlideMap = new Map<string, any>();
    if (carouselIds.length > 0) {
      const { data: cItems } = await supabaseAdmin
        .from("carousel_items")
        .select("carousel_id, media_id, position, media(id, storage_path, thumbnail_url, storage_provider)")
        .in("carousel_id", carouselIds)
        .order("position", { ascending: true });

      (cItems || []).forEach((ci: any) => {
        if (!carouselFirstSlideMap.has(ci.carousel_id) && ci.media) {
          carouselFirstSlideMap.set(ci.carousel_id, ci.media);
        }
      });
    }

    // Gera Signed URLs através da abstração (R2 ou Supabase)
    const signedUrlCache = new Map<string, string>();
    await Promise.all(
      Array.from(mediaMap.values()).map(async (m: any) => {
        const url = (await getMediaReadUrl(m, "thumbnail", 7200)) || "";
        if (url) signedUrlCache.set(m.id, url);
      })
    );

    await Promise.all(
      Array.from(carouselFirstSlideMap.entries()).map(async ([cId, m]: [string, any]) => {
        if (!signedUrlCache.has(cId) && m) {
          const url = (await getMediaReadUrl(m, "thumbnail", 7200)) || "";
          if (url) signedUrlCache.set(cId, url);
        }
      })
    );

    const posts: ScheduledPost[] = records.map((row: any) => {
      const igAcc = accountsMap.get(row.instagram_account_id);
      const media = row.media_id ? mediaMap.get(row.media_id) : undefined;
      const finalThumbUrl =
        (row.media_id ? signedUrlCache.get(row.media_id) : undefined) ||
        (row.carousel_id ? signedUrlCache.get(row.carousel_id) : undefined) ||
        media?.thumbnail_url ||
        "";

      let postStatus: ScheduledPost["status"] = "scheduled";
      if (row.status === "processing") postStatus = "processing";
      else if (row.status === "published") postStatus = "published";
      else if (row.status === "failed") postStatus = "error";
      else if (row.status === "cancelled") postStatus = "cancelled";

      return {
        id: row.id,
        userId: row.user_id,
        accountId: row.instagram_account_id,
        accountUsername: igAcc?.username || "",
        accountAvatar: igAcc?.profile_picture_url || "",
        type: (row.post_type === "carousel" ? "carousel" : "reel") as ScheduledPost["type"],
        title: media?.original_name || (row.post_type === "carousel" ? "Carrossel Agendado" : "Reel Agendado"),
        caption: row.caption || "",
        scheduledAt: row.scheduled_at,
        thumbnailUrl: finalThumbUrl,
        status: postStatus,
        queueId: row.queue_id || undefined,
        nextRetryAt: row.next_retry_at || undefined,
        publishAttempts: row.publish_attempts || 0,
        errorMessage: row.error_message || undefined,
        history: [
          {
            timestamp: row.scheduled_at,
            message: row.error_message || (postStatus === "processing" ? "Em processamento" : "Agendamento registrado"),
            state: postStatus,
          },
        ],
      };
    });

    return NextResponse.json({ success: true, posts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Scheduled Posts API] Exceção:", message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
