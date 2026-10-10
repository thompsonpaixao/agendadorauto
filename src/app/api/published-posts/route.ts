import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PublishedPost } from "@/types";

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
      .from("published_posts")
      .select("*")
      .eq("user_id", user.id)
      .order("published_at", { ascending: false });

    if (accountId && accountId !== "all") {
      query = query.eq("instagram_account_id", accountId);
    }

    const { data: records, error } = await query;
    if (error) {
      console.error("[Published Posts API] Erro na consulta:", error);
      return NextResponse.json(
        { success: false, message: `Erro ao buscar publicações: ${error.message}` },
        { status: 500 }
      );
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ success: true, posts: [] });
    }

    // Resolução em lote de contas do Instagram
    const accountIds = Array.from(
      new Set(records.map((r: any) => r.instagram_account_id).filter(Boolean))
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

    // Resolução opcional de thumbnails a partir de scheduled_posts -> media
    const scheduledPostIds = Array.from(
      new Set(records.map((r: any) => r.scheduled_post_id).filter(Boolean))
    );

    const scheduledMediaMap = new Map<string, string>();
    if (scheduledPostIds.length > 0) {
      const { data: scheduledData } = await supabaseAdmin
        .from("scheduled_posts")
        .select("id, media_id")
        .in("id", scheduledPostIds);

      const mediaIds = Array.from(
        new Set((scheduledData || []).map((s: any) => s.media_id).filter(Boolean))
      );

      if (mediaIds.length > 0) {
        const { data: mediaData } = await supabaseAdmin
          .from("media")
          .select("id, thumbnail_url, storage_path")
          .in("id", mediaIds);

        const mediaThumbMap = new Map<string, string>();
        (mediaData || []).forEach((m: any) => {
          const raw = m.thumbnail_url || m.storage_path;
          if (raw) mediaThumbMap.set(m.id, raw);
        });

        // Gera Signed URLs
        const pathsToSign = Array.from(new Set(Array.from(mediaThumbMap.values()).filter((p) => p.startsWith("users/"))));
        const signedCache = new Map<string, string>();
        await Promise.all(
          pathsToSign.map(async (path) => {
            const { data: s } = await supabaseAdmin.storage.from("media").createSignedUrl(path, 7200);
            if (s?.signedUrl) signedCache.set(path, s.signedUrl);
          })
        );

        (scheduledData || []).forEach((s: any) => {
          if (s.media_id && mediaThumbMap.has(s.media_id)) {
            const raw = mediaThumbMap.get(s.media_id)!;
            const signed = raw.startsWith("users/") ? signedCache.get(raw) || "" : raw;
            scheduledMediaMap.set(s.id, signed);
          }
        });
      }
    }

    const posts: PublishedPost[] = records.map((row: any) => {
      const igAcc = accountsMap.get(row.instagram_account_id);
      const thumbnail = row.scheduled_post_id ? scheduledMediaMap.get(row.scheduled_post_id) || "" : "";

      return {
        id: row.id,
        userId: row.user_id,
        accountId: row.instagram_account_id,
        accountUsername: igAcc?.username || "",
        accountAvatar: igAcc?.profile_picture_url || "",
        scheduledPostId: row.scheduled_post_id,
        type: (row.media_type === "carousel" ? "carousel" : "reel") as PublishedPost["type"],
        thumbnailUrl: thumbnail,
        caption: row.caption || "",
        publishedAt: row.published_at,
        views: 0,
        reach: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        profileVisits: 0,
        followersGained: 0,
        status: "published",
        instagramMediaId: row.instagram_media_id,
        permalink: row.permalink || undefined,
      };
    });

    return NextResponse.json({ success: true, posts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Published Posts API] Exceção:", message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
