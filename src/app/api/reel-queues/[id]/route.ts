import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMediaReadUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/reel-queues/[id]
 * 
 * Retorna o relatório detalhado e a lista sequencial de todos os vídeos de uma fila
 * (ativa ou finalizada), com status operacional real, horários planejados e reais,
 * links do Instagram e resumo de execução.
 */
export async function GET(
  _request: Request,
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
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Servidor administrativo não configurado." },
        { status: 500 }
      );
    }

    // 1. Busca a fila do usuário com join seguro de conta
    const { data: queue, error: queueError } = await supabaseAdmin
      .from("reel_queues")
      .select(`
        id,
        user_id,
        instagram_account_id,
        name,
        status,
        caption_mode,
        custom_caption,
        posts_per_day,
        daily_times,
        use_random_variation,
        random_variation_minutes,
        distribute_until_empty,
        start_date,
        created_at,
        updated_at,
        instagram_accounts (
          id,
          username,
          name,
          profile_picture_url
        )
      `)
      .eq("id", queueId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (queueError) {
      console.error("[Queue Details GET] Erro ao buscar fila:", queueError);
      return NextResponse.json(
        { success: false, message: `Erro ao buscar fila: ${queueError.message}` },
        { status: 500 }
      );
    }

    if (!queue) {
      return NextResponse.json({ success: false, message: "Fila não encontrada." }, { status: 404 });
    }

    // 2. Busca itens da fila ordenados por posição
    const { data: queueItems, error: itemsError } = await supabaseAdmin
      .from("reel_queue_items")
      .select("id, queue_id, media_id, position, custom_caption, status, created_at")
      .eq("queue_id", queueId)
      .eq("user_id", user.id)
      .order("position", { ascending: true });

    if (itemsError) {
      console.error("[Queue Details GET] Erro ao buscar itens:", itemsError);
      return NextResponse.json(
        { success: false, message: "Erro ao buscar itens da fila." },
        { status: 500 }
      );
    }

    const mediaIds = (queueItems || []).map((qi) => qi.media_id).filter(Boolean);

    // 3. Busca dados de mídia
    const mediaMap = new Map<string, any>();
    if (mediaIds.length > 0) {
      const { data: mediaList } = await supabaseAdmin
        .from("media")
        .select("id, original_name, storage_path, storage_provider, thumbnail_url, duration_seconds, size_bytes, retention_status")
        .in("id", mediaIds);

      (mediaList || []).forEach((m) => mediaMap.set(m.id, m));
    }

    // 4. Busca scheduled_posts da fila ordenados por mais recente
    const scheduledMap = new Map<string, any>();
    const { data: scheduledList } = await supabaseAdmin
      .from("scheduled_posts")
      .select("id, queue_item_id, media_id, status, scheduled_at, error_message, error_code, retry_count, publish_attempts, next_retry_at, created_at, updated_at")
      .eq("queue_id", queueId)
      .order("created_at", { ascending: false });

    const scheduledPostIds: string[] = [];
    (scheduledList || []).forEach((sp) => {
      scheduledPostIds.push(sp.id);
      if (sp.queue_item_id && !scheduledMap.has(sp.queue_item_id)) {
        scheduledMap.set(sp.queue_item_id, sp);
      } else if (sp.media_id && !scheduledMap.has(sp.media_id)) {
        scheduledMap.set(sp.media_id, sp);
      }
    });

    // 5. Busca logs de erro técnicos vinculados para diagnóstico detalhado
    const errorLogsMap = new Map<string, any>();
    if (scheduledPostIds.length > 0) {
      const { data: errLogs } = await supabaseAdmin
        .from("error_logs")
        .select("scheduled_post_id, error_code, message, technical_details, created_at")
        .in("scheduled_post_id", scheduledPostIds)
        .order("created_at", { ascending: false });

      (errLogs || []).forEach((el) => {
        if (el.scheduled_post_id && !errorLogsMap.has(el.scheduled_post_id)) {
          errorLogsMap.set(el.scheduled_post_id, el);
        }
      });
    }

    // 6. Busca published_posts relacionados via scheduled_post_id
    const publishedMap = new Map<string, any>();
    if (scheduledPostIds.length > 0) {
      const { data: publishedList } = await supabaseAdmin
        .from("published_posts")
        .select("id, scheduled_post_id, instagram_media_id, permalink, published_at")
        .in("scheduled_post_id", scheduledPostIds)
        .eq("user_id", user.id);

      (publishedList || []).forEach((pub: any) => {
        if (pub.scheduled_post_id) {
          publishedMap.set(pub.scheduled_post_id, pub);
        }
      });
    }

    // Função auxiliar para traduzir erros técnicos para mensagens amigáveis
    const formatFriendlyError = (code?: string, rawMsg?: string) => {
      const c = (code || "").toUpperCase();
      const m = (rawMsg || "").toLowerCase();

      if (c === "VIDEO_PROCESSING_FAILED" || m.includes("transcode") || m.includes("processing")) {
        return {
          friendly: "Instagram demorou para processar o vídeo ou rejeitou a codificação",
          step: "Processamento e transcodificação de vídeo na Meta",
        };
      }
      if (c === "MEDIA_NOT_FOUND" || m.includes("storage") || m.includes("arquivo")) {
        return {
          friendly: "Falha ao acessar o arquivo de mídia para envio",
          step: "Download da mídia do armazenamento seguro",
        };
      }
      if (c === "TOKEN_EXPIRED" || c === "INVALID_TOKEN" || m.includes("token") || m.includes("oauth") || m.includes("session")) {
        return {
          friendly: "Token de acesso temporariamente inválido ou expirado",
          step: "Autenticação da conta junto à Meta Graph API",
        };
      }
      if (c === "RATE_LIMIT" || m.includes("limit") || m.includes("spam")) {
        return {
          friendly: "Limite de frequência ou restrição temporária do Instagram",
          step: "Controle de taxa da Meta API",
        };
      }
      if (m.includes("aspect ratio") || m.includes("resolution") || m.includes("dimens")) {
        return {
          friendly: "Instagram rejeitou as dimensões ou formato do vídeo",
          step: "Validação de proporção e formato 9:16 de Reels",
        };
      }
      if (rawMsg) {
        return {
          friendly: rawMsg.length > 120 ? `${rawMsg.slice(0, 117)}...` : rawMsg,
          step: "Publicação no Instagram",
        };
      }
      return {
        friendly: "Falha na publicação pelo Instagram",
        step: "Publicação oficial no perfil",
      };
    };

    // 7. Monta os itens enriquecidos e gera Signed URLs
    let publishedCount = 0;
    let errorCount = 0;
    let scheduledCount = 0;
    let waitingCount = 0;
    let cancelledCount = 0;

    const populatedItems = await Promise.all(
      (queueItems || []).map(async (qi, index) => {
        const media = mediaMap.get(qi.media_id);
        const sp = scheduledMap.get(qi.id) || scheduledMap.get(qi.media_id);
        const pub = sp ? publishedMap.get(sp.id) : null;
        const errLog = sp ? errorLogsMap.get(sp.id) : null;

        let thumbUrl = "";
        let videoUrl = "";
        if (media) {
          videoUrl = (await getMediaReadUrl(media, "main", 7200)) || "";
          thumbUrl = media.thumbnail_url
            ? (await getMediaReadUrl(media, "thumbnail", 7200)) || videoUrl
            : videoUrl;
        }

        // Determina o status operacional do item
        let statusCode: "pending" | "scheduled" | "processing" | "published" | "failed" | "cancelled" = "pending";
        let itemStatus: "Aguardando" | "Agendado" | "Atrasado — aguardando publicação" | "Publicando" | "Processando" | "Publicado" | "Falhou" | "Cancelado" = "Aguardando";
        let publishedAt: string | null = null;
        let permalink: string | null = null;
        let errorMessage: string | null = null;
        let technicalDetails: {
          errorCode: string;
          metaMessage: string;
          failedStep: string;
          attemptCount: number;
          failedAt: string | null;
        } | null = null;

        const isAwaitingRetry =
          sp?.status === "processing" &&
          sp?.next_retry_at &&
          new Date(sp.next_retry_at).getTime() > Date.now();

        if (pub || sp?.status === "published" || qi.status === "published") {
          statusCode = "published";
          itemStatus = "Publicado";
          publishedCount++;
          publishedAt = pub?.published_at || sp?.scheduled_at || null;
          permalink = pub?.permalink || null;
        } else if (isAwaitingRetry) {
          statusCode = "processing";
          itemStatus = "Aguardando";
          scheduledCount++;
          errorMessage = sp.error_message || "Aguardando nova tentativa em ~5 min.";
        } else if (sp?.status === "processing" || qi.status === "processing") {
          statusCode = "processing";
          itemStatus = "Publicando";
          scheduledCount++;
        } else if (sp?.status === "failed" || qi.status === "failed") {
          statusCode = "failed";
          itemStatus = "Falhou";
          errorCount++;
          const errCode = sp?.error_code || errLog?.error_code || "META_PUBLISH_FAILED";
          const rawMsg = sp?.error_message || errLog?.message || "Falha ao publicar vídeo no Instagram.";
          const { friendly, step } = formatFriendlyError(errCode, rawMsg);
          errorMessage = friendly;

          technicalDetails = {
            errorCode: errCode,
            metaMessage: rawMsg,
            failedStep: step,
            attemptCount: sp?.publish_attempts || sp?.retry_count || 1,
            failedAt: errLog?.created_at || sp?.updated_at || sp?.scheduled_at || null,
          };
        } else if (sp?.status === "cancelled" || qi.status === "cancelled") {
          statusCode = "cancelled";
          itemStatus = "Cancelado";
          cancelledCount++;
        } else if (sp?.status === "scheduled" || qi.status === "scheduled") {
          statusCode = "scheduled";
          const isDelayed = sp?.scheduled_at && new Date(sp.scheduled_at).getTime() <= Date.now();
          itemStatus = isDelayed ? "Atrasado — aguardando publicação" : "Agendado";
          scheduledCount++;
        } else {
          statusCode = "pending";
          itemStatus = "Aguardando";
          waitingCount++;
        }

        const scheduledTime = sp?.scheduled_at || null;

        return {
          id: qi.id,
          position: qi.position ?? index + 1,
          mediaId: qi.media_id,
          name: media?.original_name || `Vídeo #${index + 1}`,
          thumbnailUrl: thumbUrl,
          videoUrl,
          durationSeconds: media?.duration_seconds,
          sizeBytes: media?.size_bytes || 0,
          caption: qi.custom_caption || "",
          status: itemStatus,
          statusCode,
          scheduledAt: scheduledTime,
          plannedAt: scheduledTime,
          publishedAt,
          instagramPermalink: permalink,
          permalink,
          errorMessage,
          errorCode: technicalDetails?.errorCode || null,
          technicalDetails,
          canRetry: statusCode === "failed",
        };
      })
    );

    // Identifica período da fila (data do primeiro slot até o último)
    const validPlannedDates = populatedItems
      .map((i) => i.plannedAt)
      .filter(Boolean)
      .sort();

    const firstDate = validPlannedDates[0] || queue.created_at;
    const lastDate = validPlannedDates[validPlannedDates.length - 1] || queue.created_at;

    const accountData = Array.isArray(queue.instagram_accounts)
      ? queue.instagram_accounts[0]
      : queue.instagram_accounts;

    // Calcula status geral da fila
    const nonFinalCount = waitingCount + scheduledCount;
    let computedQueueStatus: "active" | "paused" | "completed" | "completed_with_errors" | "cancelled" =
      queue.status as any;

    if (populatedItems.length > 0 && nonFinalCount === 0 && computedQueueStatus !== "cancelled") {
      if (errorCount > 0) {
        computedQueueStatus = "completed_with_errors";
      } else {
        computedQueueStatus = "completed";
      }
    }

    const completionRate = populatedItems.length > 0
      ? Math.round((publishedCount / populatedItems.length) * 100)
      : 0;

    const summaryData = {
      total: populatedItems.length,
      published: publishedCount,
      failed: errorCount,
      scheduled: scheduledCount,
      waiting: waitingCount,
      cancelled: cancelledCount,
      remaining: nonFinalCount,
      completionRate,
      period: {
        firstScheduledAt: firstDate,
        lastScheduledAt: lastDate,
        start: firstDate,
        end: lastDate,
      },
    };

    const queueData = {
      id: queue.id,
      name: queue.name,
      status: computedQueueStatus,
      createdAt: queue.created_at,
      updatedAt: queue.updated_at,
      accountId: queue.instagram_account_id,
      accountUsername: accountData?.username || "conta",
      accountAvatar: accountData?.profile_picture_url || "/avatars/default.png",
      startDate: queue.start_date,
      postsPerDay: queue.posts_per_day,
      dailyTimes: Array.isArray(queue.daily_times) ? queue.daily_times : ["09:00", "12:00", "15:00", "18:00", "21:00"],
      useRandomVariation: queue.use_random_variation,
      summary: summaryData,
      items: populatedItems,
    };

    return NextResponse.json({
      success: true,
      queue: queueData,
      summary: summaryData,
      items: populatedItems,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Queue Details GET] Exceção:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}

/**
 * DELETE /api/reel-queues/[id]
 * 
 * Exclui uma fila de Reels com segurança:
 * 1. Cancela/remove agendamentos futuros pendentes vinculados à fila.
 * 2. Preserva integralmente o histórico de posts já publicados (public.published_posts).
 * 3. Preserva todas as mídias e arquivos de vídeo no Supabase Storage.
 * 4. Remove a fila e seus itens do banco de dados.
 * Idempotente: se a fila já tiver sido removida, responde com HTTP 200 OK.
 */
export async function DELETE(
  _request: Request,
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, message: "ID da fila obrigatório." }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Servidor administrativo não configurado." },
        { status: 500 }
      );
    }

    // 1. Verifica se a fila existe e pertence ao usuário
    const { data: queue, error: queueError } = await supabaseAdmin
      .from("reel_queues")
      .select("id, name, instagram_account_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (queueError || !queue) {
      return NextResponse.json(
        { success: true, message: "Fila já removida anteriormente." },
        { status: 200 }
      );
    }

    // 2. Localiza todas as mídias associadas a esta fila para liberar status operacional
    const { data: queueItems } = await supabaseAdmin
      .from("reel_queue_items")
      .select("media_id")
      .eq("queue_id", id)
      .eq("user_id", user.id);

    const affectedMediaIds = (queueItems || [])
      .map((qi) => qi.media_id)
      .filter(Boolean);

    // 3. Cancela agendamentos vinculados a esta fila (scheduled, pending, processing, failed, cancelled)
    const { error: cancelError } = await supabaseAdmin
      .from("scheduled_posts")
      .delete()
      .eq("queue_id", id)
      .eq("user_id", user.id)
      .in("status", ["scheduled", "pending", "processing", "failed", "cancelled"]);

    if (cancelError) {
      console.warn("[Delete Queue API] Aviso ao cancelar posts vinculados:", cancelError);
    }

    // 4. Remove os itens da fila (cascade seguro)
    await supabaseAdmin
      .from("reel_queue_items")
      .delete()
      .eq("queue_id", id)
      .eq("user_id", user.id);

    // 5. Remove o registro da fila
    const { error: deleteError } = await supabaseAdmin
      .from("reel_queues")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("[Delete Queue API] Erro ao excluir fila:", deleteError);
      return NextResponse.json(
        { success: false, message: `Falha ao excluir fila: ${deleteError.message}` },
        { status: 500 }
      );
    }

    // 6. Libera imediatamente o status de retenção das mídias desvinculadas
    if (affectedMediaIds.length > 0) {
      const { data: otherActiveItems } = await supabaseAdmin
        .from("reel_queue_items")
        .select("media_id")
        .in("media_id", affectedMediaIds)
        .in("status", ["pending", "scheduled", "processing"]);

      const stillQueuedMediaIds = new Set((otherActiveItems || []).map((r) => r.media_id));
      const freedMediaIds = affectedMediaIds.filter((mId) => !stillQueuedMediaIds.has(mId));

      if (freedMediaIds.length > 0) {
        await supabaseAdmin
          .from("media")
          .update({
            retention_status: "active",
            updated_at: new Date().toISOString(),
          })
          .in("id", freedMediaIds)
          .eq("user_id", user.id)
          .eq("retention_status", "waiting_publication");
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fila "${queue.name}" excluída com sucesso. Publicações anteriores foram preservadas no histórico.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Delete Queue API] Exceção:", message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
