import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateScheduleSlots, getSaoPauloDateString } from "@/lib/schedule-calculator";
import { ReelQueue, MediaItem } from "@/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/reel-queues
 * 
 * Cria uma fila de Reels REAL no Supabase:
 * 1. public.reel_queues
 * 2. public.reel_queue_items
 * 3. public.scheduled_posts (com horários calculados para America/Sao_Paulo)
 * 4. Atualiza public.media (retention_status = 'waiting_publication')
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
      name,
      videos,
      captionMode = "profile_default",
      customCaption = "",
      postsPerDay = 5,
      dailyTimes = ["09:00", "12:00", "15:00", "18:00", "21:00"],
      useRandomVariation = true,
      randomVariationMinutes = 5,
      startDate,
    } = body;

    if (!accountId) {
      return NextResponse.json(
        { success: false, message: "accountId é obrigatório." },
        { status: 400 }
      );
    }

    if (!Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json(
        { success: false, message: "Adicione ao menos um vídeo para a fila." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Servidor administrativo não configurado." },
        { status: 500 }
      );
    }

    // 1. Valida conta do Instagram
    const { data: account, error: accountError } = await supabaseAdmin
      .from("instagram_accounts")
      .select("id, username, profile_picture_url, default_reel_caption")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { success: false, message: "Conta do Instagram não encontrada ou não autorizada." },
        { status: 404 }
      );
    }

    // 2. Valida todos os vídeos (media_id)
    const mediaIds = videos.map((v: any) => (typeof v === "string" ? v : v.id));
    const { data: mediaRows, error: mediaError } = await supabaseAdmin
      .from("media")
      .select("*")
      .eq("user_id", user.id)
      .eq("instagram_account_id", accountId)
      .in("id", mediaIds);

    if (mediaError || !mediaRows || mediaRows.length !== mediaIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Uma ou mais mídias fornecidas não existem ou não pertencem a este perfil.",
        },
        { status: 400 }
      );
    }

    // Mapa de mídias para acesso rápido
    const mediaMap = new Map(mediaRows.map((m) => [m.id, m]));

    // 3. Calcula horários de agendamento na timezone America/Sao_Paulo
    const effectiveStartDate = startDate || getSaoPauloDateString();
    const scheduledSlots = calculateScheduleSlots({
      itemsCount: mediaIds.length,
      startDateStr: effectiveStartDate,
      dailyTimes,
      useRandomVariation,
      randomVariationMinutes,
    });

    const nowIso = new Date().toISOString();

    // 4. Cria o registro da fila em public.reel_queues
    const queueName = name || `Fila de Reels - ${new Date().toLocaleDateString("pt-BR")}`;
    const { data: queueRow, error: queueInsertError } = await supabaseAdmin
      .from("reel_queues")
      .insert({
        user_id: user.id,
        instagram_account_id: accountId,
        name: queueName,
        status: "active",
        caption_mode: captionMode,
        custom_caption: customCaption,
        posts_per_day: Math.max(1, Math.min(20, postsPerDay)),
        daily_times: dailyTimes,
        use_random_variation: useRandomVariation,
        random_variation_minutes: randomVariationMinutes,
        distribute_until_empty: true,
        start_date: effectiveStartDate,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single();

    if (queueInsertError || !queueRow) {
      console.error("[Reel Queues API] Erro ao criar fila:", queueInsertError);
      return NextResponse.json(
        { success: false, message: `Falha ao persistir fila no banco: ${queueInsertError?.message}` },
        { status: 500 }
      );
    }

    // 5. Prepara e insere os itens da fila em public.reel_queue_items
    const itemsToInsert = mediaIds.map((mediaId: string, index: number) => {
      const videoItem = videos[index];
      let itemCaption = "";

      if (captionMode === "profile_default") {
        itemCaption = account.default_reel_caption || "";
      } else if (captionMode === "custom_all") {
        itemCaption = customCaption || "";
      } else if (captionMode === "individual" && videoItem?.caption) {
        itemCaption = videoItem.caption;
      }

      return {
        user_id: user.id,
        queue_id: queueRow.id,
        media_id: mediaId,
        position: index,
        custom_caption: itemCaption,
        status: "scheduled" as const,
        created_at: nowIso,
        updated_at: nowIso,
      };
    });

    const { data: insertedItems, error: itemsInsertError } = await supabaseAdmin
      .from("reel_queue_items")
      .insert(itemsToInsert)
      .select("id, media_id, position, custom_caption");

    if (itemsInsertError || !insertedItems) {
      console.error("[Reel Queues API] Erro ao inserir itens da fila:", itemsInsertError);
      // Rollback da fila
      await supabaseAdmin.from("reel_queues").delete().eq("id", queueRow.id);
      return NextResponse.json(
        { success: false, message: `Falha ao salvar itens da fila: ${itemsInsertError?.message}` },
        { status: 500 }
      );
    }

    // 6. Cria os registros em public.scheduled_posts
    const postsToInsert = insertedItems.map((item, index) => {
      const scheduledAt = scheduledSlots[index] || new Date(Date.now() + 3600000 * (index + 1)).toISOString();

      return {
        user_id: user.id,
        instagram_account_id: accountId,
        post_type: "reel" as const,
        media_id: item.media_id,
        queue_id: queueRow.id,
        queue_item_id: item.id,
        caption: item.custom_caption || "",
        scheduled_at: scheduledAt,
        status: "scheduled" as const,
        created_at: nowIso,
        updated_at: nowIso,
      };
    });

    const { error: scheduledPostsError } = await supabaseAdmin
      .from("scheduled_posts")
      .insert(postsToInsert);

    if (scheduledPostsError) {
      console.error("[Reel Queues API] Erro ao criar agendamentos:", scheduledPostsError);
      // Rollback
      await supabaseAdmin.from("reel_queue_items").delete().eq("queue_id", queueRow.id);
      await supabaseAdmin.from("reel_queues").delete().eq("id", queueRow.id);
      return NextResponse.json(
        { success: false, message: `Falha ao registrar agendamentos: ${scheduledPostsError.message}` },
        { status: 500 }
      );
    }

    // 7. Atualiza o status de retenção das mídias para 'waiting_publication'
    await supabaseAdmin
      .from("media")
      .update({ retention_status: "waiting_publication", updated_at: nowIso })
      .in("id", mediaIds)
      .eq("user_id", user.id);

    // 8. Monta objeto de resposta ReelQueue formatado
    const nextScheduledAt = scheduledSlots[0] || undefined;
    const lastScheduledAt = scheduledSlots[scheduledSlots.length - 1] || undefined;

    const populatedVideos: MediaItem[] = mediaIds.map((id: string, idx: number) => {
      const m = mediaMap.get(id);
      return {
        id,
        userId: user.id,
        accountId,
        name: m?.original_name || `Reel #${idx + 1}`,
        url: "",
        thumbnailUrl: m?.thumbnail_url || "",
        type: "video" as const,
        sizeBytes: Number(m?.size_bytes) || 0,
        durationSeconds: m?.duration_seconds ? Number(m?.duration_seconds) : undefined,
        position: idx,
        status: "ready" as const,
        retentionStatus: "waiting_publication" as const,
        createdAt: m?.created_at,
      };
    });

    const createdQueue: ReelQueue = {
      id: queueRow.id,
      userId: user.id,
      accountId,
      accountUsername: account.username,
      accountAvatar: account.profile_picture_url || "",
      name: queueRow.name,
      createdAt: queueRow.created_at,
      totalVideos: mediaIds.length,
      publishedCount: 0,
      remainingCount: mediaIds.length,
      errorCount: 0,
      nextScheduledAt,
      estimatedFinishAt: lastScheduledAt,
      status: "active",
      videos: populatedVideos,
      captionMode: queueRow.caption_mode,
      customCaption: queueRow.custom_caption,
      postsPerDay: queueRow.posts_per_day,
      dailyTimes: Array.isArray(queueRow.daily_times) ? queueRow.daily_times : dailyTimes,
      distributeUntilEmpty: queueRow.distribute_until_empty,
      startDate: queueRow.start_date,
    };

    return NextResponse.json({
      success: true,
      message: "Fila de Reels criada e agendada com sucesso!",
      queue: createdQueue,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido ao criar fila.";
    console.error("[Reel Queues API POST] Exceção:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}

/**
 * GET /api/reel-queues
 * 
 * Lista as filas reais persistidas do usuário autenticado a partir do Supabase.
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
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Servidor administrativo não configurado." },
        { status: 500 }
      );
    }

    let query = supabaseAdmin
      .from("reel_queues")
      .select("*, instagram_accounts(id, username, profile_picture_url)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (accountId && accountId !== "all") {
      query = query.eq("instagram_account_id", accountId);
    }

    const { data: queuesRows, error: queuesError } = await query;

    if (queuesError) {
      console.error("[Reel Queues GET] Erro ao buscar filas:", queuesError);
      return NextResponse.json(
        { success: false, message: `Erro ao consultar filas: ${queuesError.message}` },
        { status: 500 }
      );
    }

    if (!queuesRows || queuesRows.length === 0) {
      return NextResponse.json({ success: true, queues: [] });
    }

    const queueIds = queuesRows.map((q) => q.id);

    // Busca itens das filas com mídias relacionadas
    const { data: allItems } = await supabaseAdmin
      .from("reel_queue_items")
      .select("id, queue_id, media_id, position, status, custom_caption, created_at, media(*)")
      .in("queue_id", queueIds)
      .order("position", { ascending: true });

    // Busca próximos agendamentos ativos
    const { data: activePosts } = await supabaseAdmin
      .from("scheduled_posts")
      .select("queue_id, scheduled_at, status")
      .in("queue_id", queueIds)
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true });

    const queues: ReelQueue[] = queuesRows.map((q) => {
      const items = (allItems || []).filter((it) => it.queue_id === q.id);
      const posts = (activePosts || []).filter((p) => p.queue_id === q.id);

      const publishedCount = items.filter((it) => it.status === "published").length;
      const errorCount = items.filter((it) => it.status === "failed").length;
      const nonFinalCount = items.filter((it) => ["pending", "scheduled", "processing"].includes(it.status)).length;
      const remainingCount = nonFinalCount;

      let computedStatus: ReelQueue["status"] = q.status as any;
      if (items.length > 0 && nonFinalCount === 0 && computedStatus !== "cancelled") {
        if (errorCount > 0) {
          computedStatus = "completed_with_errors";
        } else {
          computedStatus = "completed";
        }

        // Se no banco a fila ainda estiver marcada como active, sincroniza para completed
        if (q.status === "active") {
          void supabaseAdmin
            .from("reel_queues")
            .update({ status: "completed", updated_at: new Date().toISOString() })
            .eq("id", q.id);
        }
      }

      const nextScheduledAt = posts[0]?.scheduled_at || undefined;
      const estimatedFinishAt = posts[posts.length - 1]?.scheduled_at || undefined;

      const videos: MediaItem[] = items.map((it) => {
        const m = it.media as any;
        return {
          id: it.media_id,
          userId: q.user_id,
          accountId: q.instagram_account_id,
          name: m?.original_name || `Reel #${it.position + 1}`,
          url: "",
          thumbnailUrl: m?.thumbnail_url || "",
          type: "video" as const,
          sizeBytes: Number(m?.size_bytes) || 0,
          durationSeconds: m?.duration_seconds ? Number(m?.duration_seconds) : undefined,
          caption: it.custom_caption || undefined,
          position: it.position,
          status: "ready" as const,
          retentionStatus: m?.retention_status,
          createdAt: it.created_at,
        };
      });

      return {
        id: q.id,
        userId: q.user_id,
        accountId: q.instagram_account_id,
        accountUsername: q.instagram_accounts?.username || "",
        accountAvatar: q.instagram_accounts?.profile_picture_url || "",
        name: q.name,
        createdAt: q.created_at,
        totalVideos: items.length,
        publishedCount,
        remainingCount,
        errorCount,
        nextScheduledAt,
        estimatedFinishAt,
        status: computedStatus,
        videos,
        captionMode: q.caption_mode as any,
        customCaption: q.custom_caption,
        postsPerDay: q.posts_per_day,
        dailyTimes: Array.isArray(q.daily_times) ? q.daily_times : ["18:00"],
        distributeUntilEmpty: q.distribute_until_empty,
        startDate: q.start_date,
      };
    });

    return NextResponse.json({
      success: true,
      queues,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido ao carregar filas.";
    console.error("[Reel Queues GET API] Exceção:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
