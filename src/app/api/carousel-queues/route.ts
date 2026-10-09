import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/carousel-queues
 * 
 * Lista as filas de carrosséis persistidas para o usuário autenticado,
 * calculando contadores reais (total, publicados, agendados, falhas, restantes).
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

    const supabaseAdmin = createAdminClient();
    const client = supabaseAdmin || supabase;

    let query = client
      .from("carousel_queues")
      .select(`
        id,
        user_id,
        instagram_account_id,
        name,
        status,
        posts_per_day,
        daily_times,
        use_random_variation,
        random_variation_minutes,
        start_date,
        created_at,
        updated_at,
        instagram_accounts (id, username, name, profile_picture_url)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (accountId && accountId !== "all") {
      query = query.eq("instagram_account_id", accountId);
    }

    const { data: queues, error: queuesError } = await query;

    if (queuesError) {
      console.error("[Carousel Queues GET] Erro:", queuesError);
      return NextResponse.json(
        { success: false, message: `Erro ao buscar filas de carrosséis: ${queuesError.message}` },
        { status: 500 }
      );
    }

    if (!queues || queues.length === 0) {
      return NextResponse.json({ success: true, queues: [] });
    }

    const queueIds = queues.map((q: any) => q.id);

    // Busca itens das filas
    const { data: items, error: itemsError } = await client
      .from("carousel_queue_items")
      .select("id, queue_id, status, carousel_id, position, created_at")
      .in("queue_id", queueIds)
      .order("position", { ascending: true });

    if (itemsError) {
      console.error("[Carousel Queues GET] Erro ao buscar itens:", itemsError);
    }

    const itemsByQueue = new Map<string, any[]>();
    (items || []).forEach((it: any) => {
      if (!itemsByQueue.has(it.queue_id)) {
        itemsByQueue.set(it.queue_id, []);
      }
      itemsByQueue.get(it.queue_id)!.push(it);
    });

    // Busca scheduled_posts vinculados a essas filas para obter nextScheduledAt
    const { data: scheduledPosts } = await client
      .from("scheduled_posts")
      .select("carousel_queue_id, scheduled_at, status")
      .in("carousel_queue_id", queueIds)
      .order("scheduled_at", { ascending: true });

    const scheduledByQueue = new Map<string, any[]>();
    (scheduledPosts || []).forEach((p: any) => {
      if (p.carousel_queue_id) {
        if (!scheduledByQueue.has(p.carousel_queue_id)) {
          scheduledByQueue.set(p.carousel_queue_id, []);
        }
        scheduledByQueue.get(p.carousel_queue_id)!.push(p);
      }
    });

    const queuesWithMetrics = await Promise.all(
      queues.map(async (queue: any) => {
        const queueItems = itemsByQueue.get(queue.id) || [];
        const queuePosts = scheduledByQueue.get(queue.id) || [];

        const totalCarousels = queueItems.length;
        const publishedCount = queueItems.filter((it: any) => it.status === "published").length;
        const errorCount = queueItems.filter((it: any) => it.status === "failed").length;

        // Itens operacionais restantes
        const nonFinalCount = queueItems.filter((it: any) =>
          ["pending", "scheduled", "processing"].includes(it.status)
        ).length;
        const remainingCount = nonFinalCount;

        // Próximo agendamento
        const nextScheduledPost = queuePosts.find(
          (p: any) => p.status === "scheduled" && new Date(p.scheduled_at) > new Date()
        );
        const nextScheduledAt = nextScheduledPost?.scheduled_at;

        // Conclusão estimada
        const pendingPosts = queuePosts.filter((p: any) => p.status === "scheduled");
        const lastScheduledPost = pendingPosts[pendingPosts.length - 1];
        const estimatedFinishAt = lastScheduledPost?.scheduled_at;

        let computedStatus = queue.status;
        if (queue.status === "active" || queue.status === "paused") {
          if (nonFinalCount === 0 && totalCarousels > 0) {
            computedStatus = errorCount > 0 ? "completed_with_errors" : "completed";
            // Atualiza no banco se finalizado
            await client
              .from("carousel_queues")
              .update({ status: "completed", updated_at: new Date().toISOString() })
              .eq("id", queue.id);
          }
        } else if (queue.status === "completed" && errorCount > 0) {
          computedStatus = "completed_with_errors";
        }

        const igAccount = Array.isArray(queue.instagram_accounts)
          ? queue.instagram_accounts[0]
          : queue.instagram_accounts;

        return {
          id: queue.id,
          userId: queue.user_id,
          accountId: queue.instagram_account_id,
          accountUsername: igAccount?.username || "instagram",
          accountAvatar: igAccount?.profile_picture_url || "",
          name: queue.name,
          createdAt: queue.created_at,
          totalCarousels,
          publishedCount,
          remainingCount,
          errorCount,
          nextScheduledAt,
          estimatedFinishAt,
          status: computedStatus,
          postsPerDay: queue.posts_per_day,
          dailyTimes: queue.daily_times || ["18:00"],
          startDate: queue.start_date,
          useRandomVariation: queue.use_random_variation,
        };
      })
    );

    return NextResponse.json({
      success: true,
      queues: queuesWithMetrics,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Carousel Queues GET] Exceção:", msg);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
