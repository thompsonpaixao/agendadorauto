import { Env, PublishResult } from "./types";
import { getSupabaseAdmin } from "./supabase";
import { decryptTokenWebCrypto } from "./crypto";
import { getMediaReadUrlWeb } from "./r2";

export class MetaApiError extends Error {
  code: string;
  subcode?: number;
  fbtraceId?: string;
  details?: unknown;
  constructor(message: string, code: string = "META_PUBLISH_FAILED", subcode?: number, details?: unknown, fbtraceId?: string) {
    super(message);
    this.name = "MetaApiError";
    this.code = code;
    this.subcode = subcode;
    this.details = details;
    this.fbtraceId = fbtraceId;
  }
}

function getMetaGraphHost(token: string): string {
  return token.startsWith("EAA") ? "https://graph.facebook.com" : "https://graph.instagram.com";
}

export interface ErrorClassification {
  isRecoverable: boolean;
  errorCode: string;
  friendlyTitle: string;
  friendlyMessage: string;
}

export function classifyMetaError(err: unknown, currentAttempt: number): ErrorClassification {
  const isMetaErr = err instanceof MetaApiError;
  const rawCode = isMetaErr ? String(err.code || "") : "META_PUBLISH_FAILED";
  const rawMsg = err instanceof Error ? err.message : String(err);
  const subcode = isMetaErr ? err.subcode : undefined;
  const msgLower = rawMsg.toLowerCase();

  // 0. Erro de Descriptografia Interna (NÃO é erro da Meta nem token expirado)
  const isCryptoFailure =
    rawCode === "TOKEN_DECRYPTION_FAILED" ||
    rawCode === "INTERNAL_CRYPTO_ERROR" ||
    msgLower.includes("token_decryption_failed") ||
    msgLower.includes("descriptografia do token") ||
    msgLower.includes("falha na autenticação aes-gcm") ||
    msgLower.includes("decryption failed") ||
    msgLower.includes("ciphertext authentication failure");

  if (isCryptoFailure) {
    return {
      isRecoverable: false,
      errorCode: "TOKEN_DECRYPTION_FAILED",
      friendlyTitle: "Erro de Descriptografia Interna",
      friendlyMessage:
        "Não foi possível acessar com segurança a credencial desta conta. Erro interno de descriptografia.",
    };
  }

  // 1. Erros Permanentemente Não-Recuperáveis
  const isPermanentAuth =
    rawCode.includes("190") ||
    subcode === 460 ||
    subcode === 463 ||
    subcode === 467 ||
    msgLower.includes("invalid access token") ||
    msgLower.includes("session has expired") ||
    msgLower.includes("error validating access token") ||
    msgLower.includes("credenciais de acesso da conta não localizadas");

  const isPermanentPermission =
    rawCode.includes("10") ||
    rawCode.includes("200") ||
    rawCode.includes("283") ||
    msgLower.includes("permission") ||
    msgLower.includes("does not have permission");

  const isPermanentFormatOrPolicy =
    rawCode.includes("36003") ||
    msgLower.includes("aspect ratio") ||
    msgLower.includes("duration") ||
    msgLower.includes("unsupported video") ||
    msgLower.includes("copyright") ||
    msgLower.includes("policy");

  const isStorageMissing =
    msgLower.includes("arquivo de vídeo não encontrado") ||
    msgLower.includes("não foi encontrado no repositório");

  if (isPermanentAuth) {
    return {
      isRecoverable: false,
      errorCode: "TOKEN_INVALID_190",
      friendlyTitle: "Sessão do Instagram Expirada",
      friendlyMessage: "O token de acesso da conta expirou ou foi revogado. É necessário reconectar a conta.",
    };
  }

  if (isPermanentPermission) {
    return {
      isRecoverable: false,
      errorCode: "PERMISSION_DENIED",
      friendlyTitle: "Permissão Insuficiente no Instagram",
      friendlyMessage: "A conta conectada não possui permissão para publicar Reels neste perfil.",
    };
  }

  if (isPermanentFormatOrPolicy) {
    return {
      isRecoverable: false,
      errorCode: "MEDIA_POLICY_OR_FORMAT_REJECTED",
      friendlyTitle: "Formato de Vídeo Rejeitado pela Meta",
      friendlyMessage: "O vídeo foi rejeitado pelo Instagram por proporção, duração ou restrição de diretrizes.",
    };
  }

  if (isStorageMissing) {
    return {
      isRecoverable: false,
      errorCode: "MEDIA_FILE_NOT_FOUND",
      friendlyTitle: "Arquivo de Mídia Ausente",
      friendlyMessage: "O arquivo de vídeo não foi localizado no repositório Cloudflare R2.",
    };
  }

  // 2. Erros Recuperáveis (Timeout, 9007 / 2207027, Instabilidade de Rede, Falhas HTTP 5xx, Meta Transitório)
  const is9007 =
    rawCode === "9007" ||
    rawCode === "MEDIA_NOT_READY_9007" ||
    subcode === 2207027 ||
    msgLower.includes("not ready for publish") ||
    msgLower.includes("media id is not available");

  const isTimeout =
    rawCode === "META_TIMEOUT" ||
    rawCode === "PROCESSING_TIMEOUT" ||
    msgLower.includes("demorou além do limite") ||
    msgLower.includes("tempo limite") ||
    msgLower.includes("timeout") ||
    msgLower.includes("etimedout") ||
    msgLower.includes("econnreset");

  const isTransientMeta =
    rawCode === "1" ||
    rawCode === "2" ||
    rawCode === "4" ||
    rawCode === "17" ||
    rawCode === "341" ||
    (isMetaErr && (err.details as any)?.is_transient === true);

  const isHttp5xx = msgLower.includes("500") || msgLower.includes("502") || msgLower.includes("503") || msgLower.includes("504");

  if (is9007 || isTimeout || isTransientMeta || isHttp5xx || isMetaErr) {
    if (currentAttempt < 2) {
      return {
        isRecoverable: true,
        errorCode: is9007 ? "MEDIA_NOT_READY_9007" : (rawCode || "META_TRANSIENT_DELAY"),
        friendlyTitle: "Instagram demorou para processar o Reel",
        friendlyMessage: "A primeira tentativa não foi concluída. O sistema fará nova tentativa via Queue em ~5 minutos.",
      };
    } else {
      return {
        isRecoverable: false,
        errorCode: is9007 ? "MEDIA_NOT_READY_9007" : (rawCode || "META_PUBLISH_FAILED"),
        friendlyTitle: "Falha na Publicação do Reel",
        friendlyMessage: "Não foi possível publicar após 2 tentativas.",
      };
    }
  }

  if (currentAttempt < 2) {
    return {
      isRecoverable: true,
      errorCode: rawCode,
      friendlyTitle: "Instabilidade Temporária no Instagram",
      friendlyMessage: "A primeira tentativa não foi concluída. O sistema fará nova tentativa via Queue em ~5 minutos.",
    };
  }

  return {
    isRecoverable: false,
    errorCode: rawCode,
    friendlyTitle: "Falha na Publicação do Reel",
    friendlyMessage: "Não foi possível publicar após 2 tentativas.",
  };
}

async function checkAndFinalizeQueueIfDone(
  supabase: any,
  queueId: string | null | undefined,
  nowIso: string
) {
  if (!queueId) return;
  const { data: allQueueItems } = await supabase
    .from("reel_queue_items")
    .select("id, status")
    .eq("queue_id", queueId);

  if (allQueueItems && allQueueItems.length > 0) {
    const remainingNonFinal = allQueueItems.filter((it: any) =>
      ["pending", "scheduled", "processing"].includes(it.status)
    );

    if (remainingNonFinal.length === 0) {
      await supabase
        .from("reel_queues")
        .update({ status: "completed", updated_at: nowIso })
        .eq("id", queueId);
    }
  }
}

/**
 * Executa publicação ou reconciliação de um scheduled_post no Cloudflare Worker.
 */
export async function executeWorkerPublication(
  env: Env,
  postId: string
): Promise<PublishResult> {
  const supabase = getSupabaseAdmin(env);
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Busca dados essenciais do post agendado
  const { data: post, error: postErr } = await supabase
    .from("scheduled_posts")
    .select("id, user_id, instagram_account_id, media_id, caption, status, post_type, meta_container_id, container_created_at, scheduled_at, created_at, queue_id, queue_item_id, publish_attempts")
    .eq("id", postId)
    .single();

  if (postErr || !post) {
    return {
      success: false,
      error: `Post não localizado no banco: ${postErr?.message || "ID inexistente"}`,
    };
  }

  // Idempotência 1: Se já consta como published, encerra com sucesso (no-op)
  if (post.status === "published") {
    console.log(`[Worker Publisher] Post ${postId} já marcado como published. Reconciliação imediata.`);
    return {
      success: true,
      published: true,
      message: "Post já publicado anteriormente.",
    };
  }

  // 2. Consulta credenciais da conta do Instagram
  const { data: account, error: accountErr } = await supabase
    .from("instagram_accounts")
    .select("id, instagram_user_id")
    .eq("id", post.instagram_account_id)
    .single();

  if (accountErr || !account || !account.instagram_user_id) {
    return {
      success: false,
      error: "Conta do Instagram ou instagram_user_id não localizado.",
    };
  }

  try {
    // 3. Descriptografa token da Meta usando Web Crypto API
    const { data: secretRow, error: secretErr } = await supabase
      .from("instagram_account_secrets")
      .select("token_encrypted, token_iv, token_auth_tag")
      .eq("instagram_account_id", post.instagram_account_id)
      .single();

    if (secretErr || !secretRow) {
      throw new Error("Credenciais de acesso da conta não localizadas no cofre.");
    }

    if (!env.TOKEN_ENCRYPTION_KEY_NEXT) {
      throw new Error("TOKEN_ENCRYPTION_KEY_NEXT não configurada no ambiente do Worker. Defina o segredo para habilitar a descriptografia.");
    }

    const token = await decryptTokenWebCrypto(
      secretRow.token_encrypted,
      secretRow.token_iv,
      secretRow.token_auth_tag,
      env.TOKEN_ENCRYPTION_KEY_NEXT
    );

    if (!token) {
      throw new MetaApiError("Falha na descriptografia do token da Meta.", "TOKEN_DECRYPTION_FAILED");
    }

    const cleanToken = token.trim();
    const graphHost = getMetaGraphHost(cleanToken);
    const graphVersion = env.META_GRAPH_VERSION || "v21.0";
    const igUserId = account.instagram_user_id;

    // 4. Idempotência 2: Checagem em published_posts
    const { data: alreadyPublished } = await supabase
      .from("published_posts")
      .select("id, instagram_media_id, permalink")
      .eq("scheduled_post_id", post.id)
      .maybeSingle();

    if (alreadyPublished?.instagram_media_id) {
      console.log(`[Worker Publisher] Post ${post.id} já registrado em published_posts. Reconciliando...`);
      return await finalizeSuccess(supabase, post, alreadyPublished.instagram_media_id);
    }

    // 5. Limite de timeout global (20 minutos)
    const maxTimeoutMinutes = parseInt(env.MAX_PROCESSING_TIMEOUT_MINUTES || "20", 10) || 20;
    const processingStartTime = post.container_created_at
      ? new Date(post.container_created_at).getTime()
      : new Date(post.scheduled_at || post.created_at).getTime();

    if ((now.getTime() - processingStartTime) / (1000 * 60) > maxTimeoutMinutes) {
      throw new MetaApiError(`O Instagram excedeu o limite operacional (${maxTimeoutMinutes} min) para processar este Reel.`, "PROCESSING_TIMEOUT");
    }

    let containerId = post.meta_container_id;

    // 6. Criação do container na Meta se não existir
    if (!containerId) {
      if (!post.media_id) {
        throw new Error("Agendamento sem media_id.");
      }

      const { data: mediaRow, error: mediaErr } = await supabase
        .from("media")
        .select("id, storage_path, storage_provider, thumbnail_url")
        .eq("id", post.media_id)
        .single();

      if (mediaErr || !mediaRow?.storage_path) {
        throw new Error("Arquivo de vídeo não encontrado no repositório de mídias.");
      }

      const ttlSeconds = parseInt(env.R2_READ_URL_TTL_SECONDS || "7200", 10) || 7200;
      const videoUrl = await getMediaReadUrlWeb(env, mediaRow, "main", ttlSeconds);
      if (!videoUrl) {
        throw new Error("Não foi possível gerar Presigned URL no R2 para a Meta.");
      }

      const containerParams = new URLSearchParams({
        media_type: "REELS",
        video_url: videoUrl,
        caption: post.caption || "",
        access_token: cleanToken,
      });

      const containerRes = await fetch(`${graphHost}/${graphVersion}/${igUserId}/media?${containerParams.toString()}`, {
        method: "POST",
      });
      const containerData = (await containerRes.json()) as any;

      if (!containerRes.ok || !containerData?.id) {
        const metaErr = containerData?.error;
        const code = metaErr?.code ? `META_${metaErr.code}` : "META_CONTAINER_FAILED";
        const msg = metaErr?.message || `Erro ao inicializar container na Meta (Status HTTP ${containerRes.status}).`;
        throw new MetaApiError(msg, code, metaErr?.error_subcode, metaErr, metaErr?.fbtrace_id);
      }

      containerId = containerData.id as string;

      await supabase
        .from("scheduled_posts")
        .update({
          meta_container_id: containerId,
          container_created_at: nowIso,
          last_container_check_at: nowIso,
          last_container_status: "IN_PROGRESS",
          status: "processing",
          updated_at: nowIso,
        })
        .eq("id", post.id);

      if (post.queue_item_id) {
        await supabase
          .from("reel_queue_items")
          .update({ status: "processing", updated_at: nowIso })
          .eq("id", post.queue_item_id);
      }
    }

    // 7. Consulta status do container na Meta (Consulta única rápida, zero loop/sleep)
    const statusRes = await fetch(
      `${graphHost}/${graphVersion}/${containerId}?fields=status_code,status&access_token=${cleanToken}`
    );
    const statusData = (await statusRes.json()) as any;
    const containerStatus = statusData.status_code || "IN_PROGRESS";

    // CASO 7A: Já Publicado na Meta
    if (containerStatus === "PUBLISHED") {
      return await finalizeSuccess(supabase, post, containerId);
    }

    // CASO 7B: Falha de Vídeo na Meta
    if (containerStatus === "ERROR") {
      throw new MetaApiError(
        `Falha de processamento na Meta: ${statusData?.status || "Erro interno de vídeo na Meta"}`,
        "META_VIDEO_PROCESSING_FAILED",
        undefined,
        statusData
      );
    }

    // CASO 7C: Container Expirado
    if (containerStatus === "EXPIRED") {
      throw new MetaApiError("Container expirou na Meta antes da publicação ser concluída.", "META_CONTAINER_EXPIRED");
    }

    // CASO 7D: IN_PROGRESS (Liberar Worker imediatamente e pedir retry da mensagem em +60s)
    if (containerStatus === "IN_PROGRESS") {
      await supabase
        .from("scheduled_posts")
        .update({
          status: "processing",
          last_container_status: "IN_PROGRESS",
          last_container_check_at: nowIso,
          locked_at: null,
          locked_by: null,
          updated_at: nowIso,
        })
        .eq("id", post.id);

      return {
        success: true,
        published: false,
        processing: true,
        statusCode: "IN_PROGRESS",
        message: "Vídeo em codificação assíncrona na Meta. Próxima checagem em 60s.",
      };
    }

    // CASO 7E: FINISHED -> Disparar media_publish
    if (containerStatus === "FINISHED") {
      const publishParams = new URLSearchParams({
        creation_id: containerId,
        access_token: cleanToken,
      });

      const publishRes = await fetch(
        `${graphHost}/${graphVersion}/${igUserId}/media_publish?${publishParams.toString()}`,
        { method: "POST" }
      );
      const publishData = (await publishRes.json()) as any;

      if (publishRes.ok && publishData?.id) {
        const publishedMediaId = publishData.id as string;
        return await finalizeSuccess(supabase, post, publishedMediaId);
      }

      // Analisa se é o erro 9007 (Media not ready)
      const metaErr = publishData?.error || {};
      const errorCode = metaErr.code;
      const errorSubcode = metaErr.error_subcode;
      const errorMsg = metaErr.message || "Falha ao publicar Reel no Instagram.";

      const is9007 =
        errorCode === 9007 ||
        errorSubcode === 2207027 ||
        errorMsg.toLowerCase().includes("not ready for publish") ||
        errorMsg.toLowerCase().includes("media id is not available");

      if (is9007) {
        await supabase
          .from("scheduled_posts")
          .update({
            status: "processing",
            last_container_status: "IN_PROGRESS",
            last_container_check_at: nowIso,
            locked_at: null,
            locked_by: null,
            updated_at: nowIso,
          })
          .eq("id", post.id);

        return {
          success: true,
          published: false,
          processing: true,
          statusCode: "IN_PROGRESS",
          message: "Mídia ainda não disponível para publicação na Meta (9007). Nova checagem em 60s.",
        };
      }

      throw new MetaApiError(errorMsg, errorCode ? `META_${errorCode}` : "META_PUBLISH_FAILED", errorSubcode, metaErr, metaErr?.fbtrace_id);
    }

    throw new MetaApiError(`Status desconhecido retornado pela Meta: ${containerStatus}`);
  } catch (err: unknown) {
    const currentAttempt = (post.publish_attempts || 0) + 1;
    const classification = classifyMetaError(err, currentAttempt);

    if (classification.isRecoverable && currentAttempt < 2) {
      const nextRetryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      await supabase.from("publication_attempts").insert({
        user_id: post.user_id,
        scheduled_post_id: post.id,
        attempt_number: 1,
        finished_at: nowIso,
        success: false,
        error_code: classification.errorCode,
        error_message: classification.friendlyMessage,
        retryable: true,
      });

      await supabase
        .from("scheduled_posts")
        .update({
          status: "processing",
          publish_attempts: 1,
          next_retry_at: nextRetryAt,
          error_code: classification.errorCode,
          error_message: classification.friendlyMessage,
          locked_at: null,
          locked_by: null,
          updated_at: nowIso,
        })
        .eq("id", post.id);

      return {
        success: true,
        published: false,
        processing: true,
        statusCode: "WAITING_RETRY",
        message: classification.friendlyMessage,
      };
    }

    // Falha Definitiva
    console.error(`[Worker Publisher] Post ${post.id}: Falha definitiva na publicação:`, err);

    await supabase
      .from("scheduled_posts")
      .update({
        status: "failed",
        publish_attempts: Math.max(currentAttempt, 2),
        error_code: classification.errorCode,
        error_message: classification.friendlyMessage,
        locked_at: null,
        locked_by: null,
        updated_at: nowIso,
      })
      .eq("id", post.id);

    if (post.queue_item_id) {
      await supabase
        .from("reel_queue_items")
        .update({
          status: "failed",
          error_message: classification.friendlyMessage,
          updated_at: nowIso,
        })
        .eq("id", post.queue_item_id);
    }

    try {
      await supabase.from("error_logs").insert({
        user_id: post.user_id,
        instagram_account_id: post.instagram_account_id,
        scheduled_post_id: post.id,
        severity: "error",
        category: "publishing",
        error_code: classification.errorCode,
        message: classification.friendlyMessage,
        error_message: classification.friendlyMessage,
        technical_details: err instanceof Error ? err.stack : String(err),
        stack_trace: err instanceof Error ? err.stack : undefined,
        status: "active",
        context: {
          postId: post.id,
          attemptNumber: Math.max(currentAttempt, 2),
          metaContainerId: post.meta_container_id,
        },
      });
    } catch (logErr) {
      console.warn(`[Worker Publisher] Aviso ao registrar em error_logs:`, logErr);
    }

    await checkAndFinalizeQueueIfDone(supabase, post.queue_id, nowIso);

    return {
      success: false,
      published: false,
      processing: false,
      errorCode: classification.errorCode,
      error: classification.friendlyMessage,
    };
  }
}

async function finalizeSuccess(
  supabase: any,
  post: any,
  instagramMediaId: string
): Promise<PublishResult> {
  const nowIso = new Date().toISOString();

  // 1. PRIMEIRO: Atualiza scheduled_posts imediatamente para 'published' e 'completed'.
  // Garante de forma irreversível que o Worker e o Feeder nunca tentarão republicar este post.
  try {
    const { error: spErr } = await supabase
      .from("scheduled_posts")
      .update({
        status: "published",
        published_at: nowIso,
        meta_container_id: instagramMediaId,
        last_container_status: "PUBLISHED",
        queue_status: "completed",
        error_code: null,
        error_message: null,
        locked_at: null,
        locked_by: null,
        updated_at: nowIso,
      })
      .eq("id", post.id);

    if (spErr) {
      console.error(`[Worker Publisher] Erro ao atualizar scheduled_posts para published (post ${post.id}):`, spErr.message);
    }
  } catch (spEx) {
    console.error(`[Worker Publisher] Exceção crítica ao atualizar scheduled_posts:`, spEx);
  }

  // 2. Registra em published_posts respeitando estritamente o schema original (media_type NOT NULL)
  let insertedPub: any = null;
  try {
    const mediaType = post.post_type === "carousel" ? "carousel" : "reel";
    const pubPayload: any = {
      user_id: post.user_id,
      instagram_account_id: post.instagram_account_id,
      scheduled_post_id: post.id,
      media_type: mediaType,
      post_type: mediaType,
      instagram_media_id: instagramMediaId,
      caption: post.caption || "",
      published_at: nowIso,
      status: "published",
    };
    if (post.media_id) {
      pubPayload.media_id = post.media_id;
    }

    const { data, error: pubErr } = await supabase
      .from("published_posts")
      .upsert(pubPayload, { onConflict: "scheduled_post_id" })
      .select("id, instagram_media_id, permalink")
      .maybeSingle();

    if (pubErr) {
      console.warn(`[Worker Publisher] Aviso ao salvar em published_posts (post ${post.id}):`, pubErr.message);
    } else {
      insertedPub = data;
    }
  } catch (pubEx) {
    console.warn(`[Worker Publisher] Exceção não-bloqueante ao gravar published_posts:`, pubEx);
  }

  // 3. Atualizações auxiliares tratadas individualmente (nenhuma falha secundária reverte o sucesso da Meta)
  try {
    if (post.queue_item_id) {
      await supabase
        .from("reel_queue_items")
        .update({
          status: "published",
          published_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", post.queue_item_id);
    }
  } catch (e) {
    console.warn("[Worker Publisher] Aviso ao atualizar reel_queue_items:", e);
  }

  try {
    if (post.media_id) {
      await supabase
        .from("media")
        .update({
          status: "published",
          is_published: true,
          updated_at: nowIso,
        })
        .eq("id", post.media_id);
    }
  } catch (e) {
    console.warn("[Worker Publisher] Aviso ao atualizar media:", e);
  }

  try {
    await supabase.from("publication_attempts").insert({
      user_id: post.user_id,
      scheduled_post_id: post.id,
      attempt_number: (post.publish_attempts || 0) + 1,
      finished_at: nowIso,
      success: true,
      retryable: false,
    });
  } catch (e) {
    console.warn("[Worker Publisher] Aviso ao registrar em publication_attempts:", e);
  }

  try {
    await supabase
      .from("error_logs")
      .update({ status: "resolved", resolved_at: nowIso, updated_at: nowIso })
      .eq("user_id", post.user_id)
      .eq("instagram_account_id", post.instagram_account_id)
      .eq("status", "active")
      .contains("context", { postId: post.id });
  } catch (e) {
    console.warn("[Worker Publisher] Aviso ao resolver error_logs:", e);
  }

  try {
    await checkAndFinalizeQueueIfDone(supabase, post.queue_id, nowIso);
  } catch (e) {
    console.warn("[Worker Publisher] Aviso ao finalizar reel_queues:", e);
  }

  // Retorno SEMPRE de sucesso: o Reel já foi publicado na Meta Graph API!
  return {
    success: true,
    published: true,
    processing: false,
    instagramMediaId,
    permalink: insertedPub?.permalink,
  };
}
