import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/carousel-queues/[id]
 * 
 * Relatório operacional da fila de carrosséis:
 * Retorna dados detalhados da fila, resumo de métricas e relatório de cada carrossel
 * com horário agendado, slides e status real.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Não autenticado." }, { status: 401 });
    }

    const { id: queueId } = await params;
    if (!queueId) {
      return NextResponse.json({ success: false, message: "ID da fila obrigatório." }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const client = supabaseAdmin || supabase;

    // 1. Busca fila
    const { data: queue, error: queueError } = await client
      .from("carousel_queues")
      .select(`
        *,
        instagram_accounts (id, username, name, profile_picture_url)
      `)
      .eq("id", queueId)
      .eq("user_id", user.id)
      .single();

    if (queueError || !queue) {
      return NextResponse.json({ success: false, message: "Fila de carrosséis não encontrada." }, { status: 404 });
    }

    // 2. Busca itens da fila
    const { data: items, error: itemsError } = await client
      .from("carousel_queue_items")
      .select(`
        id,
        queue_id,
        carousel_id,
        position,
        status,
        created_at,
        updated_at,
        carousels (
          id,
          title,
          caption,
          status,
          created_at,
          carousel_items (
            id,
            position,
            media_id,
            media (
              id,
              original_name,
              storage_path,
              thumbnail_url,
              size_bytes
            )
          )
        )
      `)
      .eq("queue_id", queueId)
      .order("position", { ascending: true });

    if (itemsError) {
      console.error("[Carousel Queue Detail] Erro ao buscar itens:", itemsError);
    }

    const rawItems = items || [];

    // 3. Busca scheduled_posts vinculados a esta fila
    const { data: scheduledPosts } = await client
      .from("scheduled_posts")
      .select("id, carousel_id, carousel_queue_item_id, scheduled_at, status, error_code, error_message")
      .eq("carousel_queue_id", queueId);

    const postByItemId = new Map<string, any>();
    const postByCarouselId = new Map<string, any>();
    (scheduledPosts || []).forEach((p: any) => {
      if (p.carousel_queue_item_id) {
        postByItemId.set(p.carousel_queue_item_id, p);
      }
      if (p.carousel_id) {
        postByCarouselId.set(p.carousel_id, p);
      }
    });

    // 4. Monta itens com URLs de preview assinadas
    const detailedItems = await Promise.all(
      rawItems.map(async (it: any) => {
        const carousel = it.carousels || {};
        const carouselItems = Array.isArray(carousel.carousel_items)
          ? carousel.carousel_items.sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
          : [];

        // Gera URLs para os primeiros slides
        const slides = await Promise.all(
          carouselItems.slice(0, 5).map(async (ci: any) => {
            const m = ci.media || {};
            let thumbUrl = "";
            if (m.storage_path) {
              const { data: signed } = await client.storage
                .from("media")
                .createSignedUrl(m.thumbnail_url || m.storage_path, 3600);
              thumbUrl = signed?.signedUrl || "";
            }
            return {
              id: ci.id,
              position: ci.position,
              name: m.original_name || "Slide",
              thumbnailUrl: thumbUrl,
              sizeBytes: m.size_bytes || 0,
            };
          })
        );

        const scheduledPost = postByItemId.get(it.id) || postByCarouselId.get(it.carousel_id);
        const resolvedStatus = scheduledPost?.status || it.status;
        const isDelayed =
          resolvedStatus === "scheduled" &&
          scheduledPost?.scheduled_at &&
          new Date(scheduledPost.scheduled_at).getTime() <= Date.now();

        // Formatação de erro amigável se aplicável
        let friendlyError: string | null = null;
        let technicalDetails: Record<string, any> | null = null;

        if (resolvedStatus === "failed" || it.status === "failed") {
          const rawCode = scheduledPost?.error_code || "UNKNOWN";
          const rawMsg = scheduledPost?.error_message || "Erro desconhecido";

          if (rawMsg.includes("aspect_ratio") || rawMsg.includes("dimensions")) {
            friendlyError = "As imagens do carrossel não atendem à proporção aceita pelo Instagram.";
          } else if (rawMsg.includes("OAuth") || rawMsg.includes("token")) {
            friendlyError = "A autorização da conta expirou. Reconecte a conta do Instagram.";
          } else {
            friendlyError = "Falha momentânea na publicação via Instagram. Tente novamente.";
          }

          technicalDetails = {
            errorCode: rawCode,
            metaMessage: rawMsg.replace(/EA[A-Za-z0-9_-]{20,}/g, "[TOKEN_REDACTED]"),
            scheduledAt: scheduledPost?.scheduled_at,
          };
        }

        return {
          id: it.id,
          queueId: it.queue_id,
          carouselId: it.carousel_id,
          title: carousel.title || `Carrossel #${it.position}`,
          caption: carousel.caption || "",
          position: it.position,
          status: isDelayed ? "delayed" : resolvedStatus,
          scheduledAt: scheduledPost?.scheduled_at || null,
          slidesCount: carouselItems.length,
          slides,
          thumbnailUrl: slides[0]?.thumbnailUrl || "",
          friendlyError,
          technicalDetails,
        };
      })
    );

    const totalCarousels = detailedItems.length;
    const publishedCount = detailedItems.filter((it) => it.status === "published").length;
    const scheduledCount = detailedItems.filter((it) => it.status === "scheduled").length;
    const failedCount = detailedItems.filter((it) => it.status === "failed").length;
    const cancelledCount = detailedItems.filter((it) => it.status === "cancelled").length;
    const remainingCount = detailedItems.filter((it) =>
      ["pending", "scheduled", "processing"].includes(it.status)
    ).length;

    const summary = {
      total: totalCarousels,
      published: publishedCount,
      scheduled: scheduledCount,
      failed: failedCount,
      cancelled: cancelledCount,
      remaining: remainingCount,
    };

    const igAccount = Array.isArray(queue.instagram_accounts)
      ? queue.instagram_accounts[0]
      : queue.instagram_accounts;

    return NextResponse.json({
      success: true,
      queue: {
        id: queue.id,
        name: queue.name,
        status: queue.status,
        startDate: queue.start_date,
        postsPerDay: queue.posts_per_day,
        dailyTimes: queue.daily_times || ["18:00"],
        createdAt: queue.created_at,
        account: {
          id: queue.instagram_account_id,
          username: igAccount?.username || "instagram",
          name: igAccount?.name || igAccount?.username || "Perfil",
          profilePicture: igAccount?.profile_picture_url || "",
        },
      },
      summary,
      items: detailedItems,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Carousel Queue Detail GET] Exceção:", msg);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/carousel-queues/[id]
 * 
 * Exclui a fila de carrosséis e cancela agendamentos pendentes.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Não autenticado." }, { status: 401 });
    }

    const { id: queueId } = await params;
    const supabaseAdmin = createAdminClient();
    const client = supabaseAdmin || supabase;

    // Cancela posts agendados futuros vinculados a esta fila
    await client
      .from("scheduled_posts")
      .delete()
      .eq("carousel_queue_id", queueId)
      .eq("user_id", user.id)
      .in("status", ["scheduled", "pending"]);

    // Exclui itens da fila
    await client
      .from("carousel_queue_items")
      .delete()
      .eq("queue_id", queueId)
      .eq("user_id", user.id);

    // Exclui a fila
    const { error: deleteError } = await client
      .from("carousel_queues")
      .delete()
      .eq("id", queueId)
      .eq("user_id", user.id);

    if (deleteError) {
      return NextResponse.json({ success: false, message: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Fila de carrosséis removida com sucesso.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Carousel Queue DELETE] Exceção:", msg);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
