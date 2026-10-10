import { Env } from "./types";
import { getSupabaseAdmin } from "./supabase";

/**
 * Handler do Cloudflare Cron Trigger (executado a cada 15 minutos).
 * Executa duas funções leves:
 * 1. Feeder de Segurança: Enfileira posts cuja publicação está programada para as próximas 24 horas (ou vencidos) que ainda não foram enfileirados.
 * 2. Stale Recovery: Recupera posts travados em 'processing' por mais de 15 minutos.
 *
 * REGRA CRÍTICA DE CPU E LOGS:
 * Se não houver nenhum post a processar, encerra silenciosamente em < 5ms sem emitir nenhum log.
 */
export async function runScheduledFeeder(env: Env): Promise<{ enqueued: number; recovered: number }> {
  const supabase = getSupabaseAdmin(env);
  const now = new Date();
  const windowMinutes = parseInt(env.FEEDER_WINDOW_MINUTES || "1440", 10) || 1440; // Janela padrão: 24 horas (1440 min)
  const windowEndIso = new Date(now.getTime() + windowMinutes * 60 * 1000).toISOString();

  let enqueuedCount = 0;
  let recoveredCount = 0;

  try {
    // 1. FEEDER NORMAL: Busca posts agendados na janela dos próximos 30 min (ou atrasados) sem queue_status
    const { data: duePosts, error: feederErr } = await supabase
      .from("scheduled_posts")
      .select("id, scheduled_at, instagram_account_id")
      .eq("status", "scheduled")
      .is("queue_status", null)
      .lte("scheduled_at", windowEndIso)
      .order("scheduled_at", { ascending: true })
      .limit(25);

    if (feederErr) {
      console.error("[Feeder] Erro ao consultar posts agendados:", feederErr.message);
    } else if (duePosts && duePosts.length > 0) {
      for (const post of duePosts) {
        const scheduledTime = new Date(post.scheduled_at).getTime();
        const diffSeconds = Math.floor((scheduledTime - now.getTime()) / 1000);
        // DelaySeconds suportado no Cloudflare Queues: 0 a 86.400s (24h)
        const delaySeconds = Math.max(0, Math.min(86400, diffSeconds));

        // 1A. Marca no banco antes do enqueue para evitar duplo enfileiramento por Crons paralelos
        const { error: updateErr } = await supabase
          .from("scheduled_posts")
          .update({
            queue_status: "enqueued",
            queued_at: now.toISOString(),
          })
          .eq("id", post.id)
          .eq("status", "scheduled")
          .is("queue_status", null);

        if (!updateErr) {
          // 1B. Envia para a PUBLISH_QUEUE do Cloudflare
          await env.PUBLISH_QUEUE.send(
            { scheduledPostId: post.id },
            { delaySeconds: delaySeconds > 0 ? delaySeconds : undefined }
          );
          enqueuedCount++;
        }
      }
    }

    // 2. STALE RECOVERY: Recupera posts em processing com lock antigo (> 15 minutos)
    const fifteenMinutesAgoIso = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    const { data: stalePosts, error: staleErr } = await supabase
      .from("scheduled_posts")
      .select("id, meta_container_id, locked_at")
      .eq("status", "processing")
      .lt("locked_at", fifteenMinutesAgoIso)
      .limit(10);

    if (staleErr) {
      console.error("[Feeder Recovery] Erro ao buscar stale posts:", staleErr.message);
    } else if (stalePosts && stalePosts.length > 0) {
      for (const stale of stalePosts) {
        // Libera o lock e re-enfileira para reavaliação imediata
        await supabase
          .from("scheduled_posts")
          .update({
            locked_at: null,
            locked_by: null,
            queue_status: "enqueued",
          })
          .eq("id", stale.id);

        await env.PUBLISH_QUEUE.send({ scheduledPostId: stale.id });
        recoveredCount++;
      }
    }

    // Só emite log se houver trabalho real realizado
    if (enqueuedCount > 0 || recoveredCount > 0) {
      console.log(`[Feeder Summary] enqueued=${enqueuedCount} recovered_stale=${recoveredCount}`);
    }

    return { enqueued: enqueuedCount, recovered: recoveredCount };
  } catch (err: unknown) {
    console.error("[Feeder Exception]", err);
    return { enqueued: enqueuedCount, recovered: recoveredCount };
  }
}
