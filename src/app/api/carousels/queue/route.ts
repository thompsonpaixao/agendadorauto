import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateScheduleSlots, getSaoPauloDateString } from "@/lib/schedule-calculator";

export const dynamic = "force-dynamic";

/**
 * POST /api/carousels/queue
 * 
 * Cria uma fila de carrosséis como entidade própria persistida em public.carousel_queues
 * e itens em public.carousel_queue_items, gerando os respectivos agendamentos em public.scheduled_posts.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const {
      accountId,
      queueName,
      carouselIds,
      startDate,
      dailyTimes,
      useRandomVariation = true,
      randomVariationMinutes = 5,
    } = body;

    if (!accountId || !Array.isArray(carouselIds) || carouselIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "accountId e ao menos um carouselId são obrigatórios." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const client = supabaseAdmin || supabase;

    // 1. Valida conta
    const { data: account, error: accError } = await client
      .from("instagram_accounts")
      .select("id, username")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accError || !account) {
      return NextResponse.json(
        { success: false, message: "Conta do Instagram não encontrada ou não autorizada." },
        { status: 404 }
      );
    }

    // 2. Valida carrosséis
    const { data: carousels, error: carError } = await client
      .from("carousels")
      .select("id, title, caption, status")
      .in("id", carouselIds)
      .eq("user_id", user.id)
      .eq("instagram_account_id", accountId);

    if (carError || !carousels || carousels.length === 0) {
      return NextResponse.json(
        { success: false, message: "Nenhum carrossel válido encontrado." },
        { status: 404 }
      );
    }

    // Preserva a ordem original solicitada
    const carouselMap = new Map(carousels.map((c: any) => [c.id, c]));
    const orderedCarousels = carouselIds
      .map((id: string) => carouselMap.get(id))
      .filter(Boolean) as { id: string; title: string; caption: string; status: string }[];

    // 3. Calcula horários sequenciais
    const activeTimes = Array.isArray(dailyTimes) && dailyTimes.length > 0 ? dailyTimes : ["18:00"];
    const slots = calculateScheduleSlots({
      itemsCount: orderedCarousels.length,
      startDateStr: startDate || getSaoPauloDateString(),
      dailyTimes: activeTimes,
      useRandomVariation,
      randomVariationMinutes,
    });

    if (slots.length !== orderedCarousels.length) {
      return NextResponse.json(
        { success: false, message: "Erro no cálculo da grade de horários de publicação." },
        { status: 500 }
      );
    }

    const name = queueName?.trim() || `Fila de Carrosséis - ${new Date().toLocaleDateString("pt-BR")}`;

    // 4. Cria a entidade de Fila em public.carousel_queues
    const { data: createdQueue, error: queueError } = await client
      .from("carousel_queues")
      .insert({
        user_id: user.id,
        instagram_account_id: accountId,
        name,
        status: "active",
        posts_per_day: activeTimes.length,
        daily_times: activeTimes,
        use_random_variation: useRandomVariation,
        random_variation_minutes: randomVariationMinutes,
        start_date: startDate || getSaoPauloDateString(),
      })
      .select()
      .single();

    if (queueError || !createdQueue) {
      console.error("[Carousels Queue POST] Erro ao criar fila em carousel_queues:", queueError);
      return NextResponse.json(
        { success: false, message: `Erro ao criar fila de carrosséis: ${queueError?.message}` },
        { status: 500 }
      );
    }

    // 5. Insere itens da fila em public.carousel_queue_items
    const queueItemsToInsert = orderedCarousels.map((c, idx) => ({
      user_id: user.id,
      queue_id: createdQueue.id,
      carousel_id: c.id,
      position: idx + 1,
      status: "scheduled",
    }));

    const { data: createdItems, error: itemsError } = await client
      .from("carousel_queue_items")
      .insert(queueItemsToInsert)
      .select();

    if (itemsError || !createdItems) {
      console.error("[Carousels Queue POST] Erro ao criar itens em carousel_queue_items:", itemsError);
      // Rollback da fila
      await client.from("carousel_queues").delete().eq("id", createdQueue.id);
      return NextResponse.json(
        { success: false, message: `Erro ao criar itens da fila: ${itemsError?.message}` },
        { status: 500 }
      );
    }

    // 6. Insere em scheduled_posts com vínculo de carousel_queue_id e carousel_queue_item_id
    const scheduledPostsToInsert = orderedCarousels.map((c, idx) => {
      const itemRecord = createdItems[idx];
      return {
        user_id: user.id,
        instagram_account_id: accountId,
        post_type: "carousel",
        carousel_id: c.id,
        carousel_queue_id: createdQueue.id,
        carousel_queue_item_id: itemRecord ? itemRecord.id : null,
        caption: c.caption || "",
        scheduled_at: slots[idx],
        status: "scheduled",
      };
    });

    const { error: insertError } = await client
      .from("scheduled_posts")
      .insert(scheduledPostsToInsert);

    if (insertError) {
      console.error("[Carousels Queue POST] Erro ao agendar posts:", insertError);
      // Rollback
      await client.from("carousel_queue_items").delete().eq("queue_id", createdQueue.id);
      await client.from("carousel_queues").delete().eq("id", createdQueue.id);
      return NextResponse.json(
        { success: false, message: `Erro ao agendar carrosséis: ${insertError.message}` },
        { status: 500 }
      );
    }

    // 7. Atualiza status dos carrosséis para "scheduled"
    await client
      .from("carousels")
      .update({ status: "scheduled", updated_at: new Date().toISOString() })
      .in("id", carouselIds)
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      message: `${orderedCarousels.length} carrossel(is) foram agendados com sucesso na "${name}"!`,
      queueId: createdQueue.id,
      scheduledCount: orderedCarousels.length,
      firstSlot: slots[0],
      lastSlot: slots[slots.length - 1],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Carousels Queue POST] Exceção:", msg);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
