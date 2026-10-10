import { Env, PublishQueueMessage } from "./types";
import { getSupabaseAdmin } from "./supabase";
import { executeWorkerPublication } from "./publisher";

/**
 * Handler do Consumidor da Cloudflare Queue (PUBLISH_QUEUE).
 *
 * Princípios de Resiliência:
 * 1. Processamento individual por mensagem (max_batch_size = 1).
 * 2. Isolamento de contas: Máximo 1 publicação simultânea por instagram_account_id.
 *    Se ocupada, chama message.retry({ delaySeconds: 30 }).
 * 3. IN_PROGRESS na Meta: Persiste container, libera lock e chama message.retry({ delaySeconds: 60 }).
 * 4. Erros recuperáveis (9007, timeout): Salva tentativa no banco e chama message.retry({ delaySeconds: 300 }).
 * 5. Falhas definitivas (token inválido 190): Registra erro no painel e faz message.ack() para que a fila continue.
 * 6. Um erro em um Reel NUNCA interrompe a fila inteira da conta.
 */
export async function handleQueueBatch(
  batch: MessageBatch<PublishQueueMessage>,
  env: Env
): Promise<void> {
  const supabase = getSupabaseAdmin(env);
  const now = new Date();
  const nowIso = now.toISOString();

  for (const message of batch.messages) {
    const { scheduledPostId } = message.body;

    if (!scheduledPostId || typeof scheduledPostId !== "string") {
      console.warn("[Queue Consumer] Mensagem descartada: payload sem scheduledPostId válido.");
      message.ack();
      continue;
    }

    try {
      // 1. Busca dados preliminares para verificar status e isolamento de conta
      const { data: post, error: searchErr } = await supabase
        .from("scheduled_posts")
        .select("id, instagram_account_id, status, scheduled_at, queue_status")
        .eq("id", scheduledPostId)
        .single();

      if (searchErr || !post) {
        console.warn(`[Queue Consumer] Post ${scheduledPostId} não encontrado no banco. Descartando mensagem.`);
        message.ack();
        continue;
      }

      console.log(
        JSON.stringify({
          event: "QUEUE_CONSUME_START",
          scheduled_post_id: post.id,
          instagram_account_id: post.instagram_account_id,
          scheduled_for: post.scheduled_at,
          queue_status: post.queue_status,
          timestamp: new Date().toISOString(),
        })
      );

      // Idempotência: Se já publicado, reconhece e finaliza imediatamente
      if (post.status === "published") {
        console.log(`[Queue Consumer] Post ${scheduledPostId} já publicado. ACK idempotente.`);
        message.ack();
        continue;
      }

      // 2. CONCORRÊNCIA POR CONTA DO INSTAGRAM (Máximo 1 simultâneo por conta)
      const twoMinutesAgoIso = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
      const { data: concurrentActive } = await supabase
        .from("scheduled_posts")
        .select("id")
        .eq("instagram_account_id", post.instagram_account_id)
        .eq("status", "processing")
        .neq("id", post.id)
        .gt("locked_at", twoMinutesAgoIso)
        .limit(1);

      if (concurrentActive && concurrentActive.length > 0) {
        // Conta ocupada por outro Reel. Reagenda para daqui a 30s sem penalidade
        console.log(
          `[Queue Consumer] Conta ${post.instagram_account_id} ocupada por outro post (${concurrentActive[0].id}). Retry em 30s.`
        );
        message.retry({ delaySeconds: 30 });
        continue;
      }

      // 3. Claim Atômico do Post
      const { data: claimedPost, error: claimErr } = await supabase
        .from("scheduled_posts")
        .update({
          status: "processing",
          locked_at: nowIso,
          locked_by: "cf-queue-worker",
          updated_at: nowIso,
        })
        .eq("id", scheduledPostId)
        .in("status", ["scheduled", "processing", "failed"])
        .select("id")
        .single();

      if (claimErr || !claimedPost) {
        console.warn(`[Queue Consumer] Não foi possível fazer claim do post ${scheduledPostId}:`, claimErr?.message);
        // Post pode estar em processamento por outro worker ou cancelado
        message.ack();
        continue;
      }

      // 4. Executa a Publicação Operacional
      const result = await executeWorkerPublication(env, scheduledPostId);

      // 5. Decisão de ACK / RETRY baseada no resultado
      if (result.published) {
        console.log(
          JSON.stringify({
            event: "QUEUE_CONSUME_SUCCESS",
            scheduled_post_id: post.id,
            instagram_account_id: post.instagram_account_id,
            scheduled_for: post.scheduled_at,
            timestamp: new Date().toISOString(),
          })
        );
        message.ack();
        continue;
      }

      if (result.statusCode === "IN_PROGRESS") {
        console.log(
          JSON.stringify({
            event: "QUEUE_CONSUME_RETRY",
            scheduled_post_id: post.id,
            instagram_account_id: post.instagram_account_id,
            delay_seconds: 60,
            reason: "IN_PROGRESS",
            timestamp: new Date().toISOString(),
          })
        );
        message.retry({ delaySeconds: 60 });
        continue;
      }

      if (result.statusCode === "WAITING_RETRY") {
        console.log(
          JSON.stringify({
            event: "QUEUE_CONSUME_RETRY",
            scheduled_post_id: post.id,
            instagram_account_id: post.instagram_account_id,
            delay_seconds: 300,
            reason: "WAITING_RETRY",
            timestamp: new Date().toISOString(),
          })
        );
        message.retry({ delaySeconds: 300 });
        continue;
      }

      // Falha definitiva (tentativas esgotadas ou erro irrecuperável)
      console.log(
        JSON.stringify({
          event: "QUEUE_CONSUME_FAILED",
          scheduled_post_id: post.id,
          instagram_account_id: post.instagram_account_id,
          error_code: result.errorCode || "UNKNOWN_ERROR",
          timestamp: new Date().toISOString(),
        })
      );
      message.ack();
    } catch (unhandledErr: unknown) {
      console.error(`[Queue Consumer] Exceção crítica não tratada para post ${scheduledPostId}:`, unhandledErr);
      // Erro inesperado do Worker: permite que o Cloudflare Queues retente conforme max_retries antes da DLQ
      message.retry({ delaySeconds: 60 });
    }
  }
}
