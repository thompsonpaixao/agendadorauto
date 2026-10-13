import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/crypto";
import { getMediaReadUrl } from "@/lib/storage";

export interface PublishResult {
  success: boolean;
  published?: boolean;
  processing?: boolean;
  instagramMediaId?: string;
  permalink?: string;
  error?: string;
  errorCode?: string;
  statusCode?: string;
  message?: string;
}

export interface PublishOptions {
  isImmediateUserRequest?: boolean; // Se true (Postar Agora), aguarda alguns segundos para dar resposta imediata na tela
}

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

// Limite operacional de processamento assíncrono na Meta (padrão: 20 minutos)
const MAX_PROCESSING_TIMEOUT_MINUTES = parseInt(
  process.env.MAX_PROCESSING_TIMEOUT_MINUTES || "20",
  10
) || 20;

function getMetaGraphVersion(): string {
  const version = process.env.META_GRAPH_VERSION || "v21.0";
  return version.startsWith("v") ? version : `v${version}`;
}

function getMetaGraphHost(token: string): string {
  return token.startsWith("EAA") ? "https://graph.facebook.com" : "https://graph.instagram.com";
}

/**
 * Classificação rigorosa de erros entre RECUPERÁVEIS e NÃO-RECUPERÁVEIS
 */
interface ErrorClassification {
  isRecoverable: boolean;
  errorCode: string;
  friendlyTitle: string;
  friendlyMessage: string;
}

function classifyMetaError(err: unknown, currentAttempt: number): ErrorClassification {
  const isMetaErr = err instanceof MetaApiError;
  const rawCode = isMetaErr ? String(err.code || "") : "META_PUBLISH_FAILED";
  const rawMsg = err instanceof Error ? err.message : String(err);
  const subcode = isMetaErr ? err.subcode : undefined;
  const msgLower = rawMsg.toLowerCase();

  // 1. Erros Permanentemente Não-Recuperáveis (Token, Permissão, Mídia Definitivamente Rejeitada)
  const isPermanentAuth =
    rawCode.includes("190") ||
    subcode === 460 ||
    subcode === 463 ||
    subcode === 467 ||
    msgLower.includes("invalid access token") ||
    msgLower.includes("session has expired") ||
    msgLower.includes("error validating access token") ||
    msgLower.includes("descriptografia do token") ||
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
      friendlyMessage: "O arquivo de vídeo não foi localizado no armazenamento.",
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
        friendlyMessage: "A primeira tentativa não foi concluída. O sistema fará uma nova tentativa automaticamente em ~5 minutos.",
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

  // Padrão de segurança: se for 1ª tentativa, permite retry controlado
  if (currentAttempt < 2) {
    return {
      isRecoverable: true,
      errorCode: rawCode,
      friendlyTitle: "Instabilidade Temporária no Instagram",
      friendlyMessage: "A primeira tentativa não foi concluída. O sistema fará uma nova tentativa automaticamente em ~5 minutos.",
    };
  }

  return {
    isRecoverable: false,
    errorCode: rawCode,
    friendlyTitle: "Falha na Publicação do Reel",
    friendlyMessage: "Não foi possível publicar após 2 tentativas.",
  };
}

/**
 * Função Auxiliar: Finaliza a fila no banco de dados se não houver mais nenhum item pendente
 */
async function checkAndFinalizeQueueIfDone(
  supabaseAdmin: any,
  queueId: string | null | undefined,
  carouselQueueId: string | null | undefined,
  nowIso: string
) {
  if (queueId) {
    const { data: allQueueItems } = await supabaseAdmin
      .from("reel_queue_items")
      .select("id, status")
      .eq("queue_id", queueId);

    if (allQueueItems && allQueueItems.length > 0) {
      const remainingNonFinal = allQueueItems.filter((it: any) =>
        ["pending", "scheduled", "processing"].includes(it.status)
      );

      if (remainingNonFinal.length === 0) {
        await supabaseAdmin
          .from("reel_queues")
          .update({ status: "completed", updated_at: nowIso })
          .eq("id", queueId);
      }
    }
  }

  if (carouselQueueId) {
    const { data: allCarouselItems } = await supabaseAdmin
      .from("carousel_queue_items")
      .select("id, status")
      .eq("queue_id", carouselQueueId);

    if (allCarouselItems && allCarouselItems.length > 0) {
      const remainingNonFinal = allCarouselItems.filter((it: any) =>
        ["pending", "scheduled", "processing"].includes(it.status)
      );

      if (remainingNonFinal.length === 0) {
        await supabaseAdmin
          .from("carousel_queues")
          .update({ status: "completed", updated_at: nowIso })
          .eq("id", carouselQueueId);
      }
    }
  }
}

/**
 * Função Central Unificada de Publicação e Monitoramento Assíncrono no Instagram.
 * Compartilhada por:
 * 1. Scheduler periódico via Supabase Cron (/api/scheduler/publish)
 * 2. "Postar agora" de Reels (/api/reels/publish-now)
 * 3. "Postar agora" de Carrosséis (/api/carousels/publish-now)
 */
export async function processInstagramPublication(
  postId: string,
  options: PublishOptions = {}
): Promise<PublishResult> {
  const supabaseAdmin = createAdminClient();
  if (!supabaseAdmin) {
    return { success: false, error: "Cliente administrativo do Supabase não configurado." };
  }

  const nowIso = new Date().toISOString();

  // 1. Claim atômico do scheduled_post
  const { data: post, error: claimError } = await supabaseAdmin
    .from("scheduled_posts")
    .update({
      status: "processing",
      locked_at: nowIso,
      locked_by: options.isImmediateUserRequest ? "publish-now-worker" : "scheduler-worker",
      updated_at: nowIso,
    })
    .eq("id", postId)
    .in("status", ["scheduled", "processing", "failed"])
    .select("*")
    .single();

  if (claimError || !post) {
    console.error("[Publisher] Não foi possível fazer claim do post:", claimError);
    return {
      success: false,
      error: `Post não localizado ou indisponível para publicação: ${claimError?.message || "Status incompatível"}`,
    };
  }

  // 2. Consulta da conta do Instagram
  const { data: account, error: accountError } = await supabaseAdmin
    .from("instagram_accounts")
    .select("*")
    .eq("id", post.instagram_account_id)
    .single();

  if (accountError || !account) {
    console.error("[Publisher] Conta do Instagram não encontrada:", accountError);
    await releaseLock(supabaseAdmin, post.id, "scheduled");
    return {
      success: false,
      error: "Conta do Instagram associada ao post não foi encontrada.",
    };
  }

  try {
    // 3. Recupera e descriptografa token de acesso
    const { data: secretRow, error: secretError } = await supabaseAdmin
      .from("instagram_account_secrets")
      .select("token_encrypted, token_iv, token_auth_tag")
      .eq("instagram_account_id", post.instagram_account_id)
      .single();

    if (secretError || !secretRow) {
      throw new Error("Credenciais de acesso da conta não localizadas no cofre criptográfico.");
    }

    const token = decryptToken(
      secretRow.token_encrypted,
      secretRow.token_iv,
      secretRow.token_auth_tag
    );

    if (!token || typeof token !== "string" || token.trim().length === 0) {
      throw new Error(
        "Falha na descriptografia do token da Meta. Verifique se TOKEN_ENCRYPTION_KEY está configurada."
      );
    }

    const cleanToken = token.trim();
    const graphHost = getMetaGraphHost(cleanToken);
    const graphVersion = getMetaGraphVersion();
    const igUserId = account.instagram_user_id;

    if (!igUserId) {
      throw new Error("Identificador do perfil do Instagram (instagram_user_id) ausente.");
    }

    // =========================================================================
    // FLUXO A: CARROSSEL (Múltiplas Imagens/Vídeos)
    // =========================================================================
    if (post.post_type === "carousel") {
      return await handleCarouselPublication({
        supabaseAdmin,
        post,
        account,
        cleanToken,
        graphHost,
        graphVersion,
        igUserId,
      });
    }

    // =========================================================================
    // FLUXO B: REEL (Vídeo Individual com Tratamento Assíncrono e Retry de 5 Minutos)
    // =========================================================================
    return await handleReelPublication({
      supabaseAdmin,
      post,
      account,
      cleanToken,
      graphHost,
      graphVersion,
      igUserId,
      isImmediateUserRequest: Boolean(options.isImmediateUserRequest),
    });
  } catch (err: unknown) {
    const currentAttempt = (post.publish_attempts || 0) + 1;
    const classification = classifyMetaError(err, currentAttempt);

    // Se for erro recuperável E primeira tentativa: agenda retry em 5 minutos
    if (classification.isRecoverable && currentAttempt < 2) {
      const nextRetryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      console.warn(
        `[Publisher] Post ${post.id}: Falha recuperável na tentativa ${currentAttempt}. Agendando nova tentativa para ${nextRetryAt} (~5 min).`
      );

      // Registra a 1ª tentativa técnica em publication_attempts (sem sujar o painel com erro fatal)
      await supabaseAdmin.from("publication_attempts").insert({
        user_id: post.user_id,
        scheduled_post_id: post.id,
        attempt_number: 1,
        finished_at: nowIso,
        success: false,
        error_code: classification.errorCode,
        error_message: classification.friendlyMessage,
        retryable: true,
      });

      // Atualiza o post para aguardar retry de 5 minutos com lock liberado
      await supabaseAdmin
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

    // Erro definitivo (irrecuperável ou 2ª tentativa com falha)
    return await handleFinalPublicationError({
      supabaseAdmin,
      post,
      account,
      err,
      classification,
      attemptNumber: Math.max(currentAttempt, 2),
    });
  }
}

/**
 * Tratamento exclusivo para publicação de Reels na Meta Graph API
 */
async function handleReelPublication({
  supabaseAdmin,
  post,
  account,
  cleanToken,
  graphHost,
  graphVersion,
  igUserId,
  isImmediateUserRequest,
}: {
  supabaseAdmin: any;
  post: any;
  account: any;
  cleanToken: string;
  graphHost: string;
  graphVersion: string;
  igUserId: string;
  isImmediateUserRequest: boolean;
}): Promise<PublishResult> {
  const now = new Date();
  const nowIso = now.toISOString();

  if (!post.media_id) {
    throw new Error("Agendamento de Reel sem identificador de mídia (media_id).");
  }

  // 1. PROTEÇÃO CONTRA DUPLICAÇÃO:
  // Se o scheduled_post já constar na tabela published_posts, reconcilia imediatamente
  const { data: alreadyPublished } = await supabaseAdmin
    .from("published_posts")
    .select("id, instagram_media_id, permalink")
    .eq("scheduled_post_id", post.id)
    .maybeSingle();

  if (alreadyPublished?.instagram_media_id) {
    console.log(`[Publisher] Post ${post.id} já possui registro em published_posts (${alreadyPublished.instagram_media_id}). Reconciliando diretamente...`);
    return await finalizeSuccessfulPublication({
      supabaseAdmin,
      post,
      account,
      instagramMediaId: alreadyPublished.instagram_media_id,
      cleanToken,
      graphHost,
      graphVersion,
    });
  }

  // 2. Verifica se o post já excedeu o limite máximo de tempo contínuo (20 min)
  const processingStartTime = post.container_created_at
    ? new Date(post.container_created_at).getTime()
    : new Date(post.scheduled_at || post.created_at).getTime();

  const minutesInProcessing = (now.getTime() - processingStartTime) / (1000 * 60);

  if (minutesInProcessing > MAX_PROCESSING_TIMEOUT_MINUTES) {
    const timeoutMsg = `O Instagram demorou além do limite operacional esperado (${MAX_PROCESSING_TIMEOUT_MINUTES} minutos) para processar este Reel.`;
    throw new MetaApiError(timeoutMsg, "PROCESSING_TIMEOUT");
  }

  let containerId = post.meta_container_id;

  // 3. Se NÃO possui container ainda, cria o container na Meta Graph API
  if (!containerId) {
    const { data: mediaRow, error: mediaError } = await supabaseAdmin
      .from("media")
      .select("id, storage_path, storage_provider, thumbnail_url, original_name")
      .eq("id", post.media_id)
      .single();

    if (mediaError || !mediaRow?.storage_path) {
      throw new Error("Arquivo de vídeo não encontrado no repositório de mídias.");
    }

    // Gera Presigned Read URL (7200 segundos de validade) através da camada de abstração (R2 ou Supabase)
    const videoUrl = await getMediaReadUrl(mediaRow, "main", 7200);
    if (!videoUrl) {
      throw new Error("Não foi possível gerar a URL de acesso temporária ao vídeo para a Meta.");
    }

    const containerParams = new URLSearchParams({
      media_type: "REELS",
      video_url: videoUrl,
      caption: post.caption || "",
      access_token: cleanToken,
    });

    const containerRes = await fetch(
      `${graphHost}/${graphVersion}/${igUserId}/media?${containerParams.toString()}`,
      { method: "POST" }
    );
    const containerData = await containerRes.json();

    if (!containerRes.ok || !containerData?.id) {
      const metaErr = containerData?.error;
      const code = metaErr?.code ? `META_${metaErr.code}` : "META_CONTAINER_FAILED";
      const msg = metaErr?.message || `Erro ao inicializar container na Meta (Status HTTP ${containerRes.status}).`;
      throw new MetaApiError(msg, code, metaErr?.error_subcode, metaErr, metaErr?.fbtrace_id);
    }

    containerId = containerData.id as string;

    // Persiste imediatamente meta_container_id, timestamp e status na base
    await supabaseAdmin
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

    // Atualiza também item da fila se vinculado
    if (post.queue_item_id) {
      await supabaseAdmin
        .from("reel_queue_items")
        .update({ status: "processing", updated_at: nowIso })
        .eq("id", post.queue_item_id);
    }
  }

  // 4. Verificação do status do Container na Meta
  // Se for "Postar agora", realiza um polling curto inicial (até ~12s) para dar retorno em tela
  // Se for Scheduler (Cron), realiza apenas 1 verificação rápida para não prender a função serverless
  const maxAttempts = isImmediateUserRequest ? 4 : 1;
  const pollIntervalMs = 3000;
  let containerStatus = "IN_PROGRESS";
  let statusData: any = null;

  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    const statusRes = await fetch(
      `${graphHost}/${graphVersion}/${containerId}?fields=status_code,status&access_token=${cleanToken}`
    );
    statusData = await statusRes.json();
    containerStatus = statusData.status_code || "IN_PROGRESS";

    if (containerStatus === "FINISHED" || containerStatus === "ERROR" || containerStatus === "EXPIRED" || containerStatus === "PUBLISHED") {
      break;
    }
  }

  // 5. Decisão baseada no status do container retornado pela Meta
  // Caso 5A: Já foi publicado anteriormente
  if (containerStatus === "PUBLISHED") {
    console.log(`[Publisher] Container ${containerId} já está publicado na Meta. Reconciliando...`);
    return await finalizeSuccessfulPublication({
      supabaseAdmin,
      post,
      account,
      instagramMediaId: containerId,
      cleanToken,
      graphHost,
      graphVersion,
    });
  }

  // Caso 5B: Falha de codificação na Meta
  if (containerStatus === "ERROR") {
    throw new MetaApiError(
      `Falha no processamento do vídeo pela Meta: ${statusData?.status || "Erro interno de codificação do vídeo no Instagram."}`,
      "META_VIDEO_PROCESSING_FAILED",
      undefined,
      statusData
    );
  }

  // Caso 5C: Container expirou (24 horas)
  if (containerStatus === "EXPIRED") {
    throw new MetaApiError("O container do Reel expirou na Meta antes da publicação ser concluída.", "META_CONTAINER_EXPIRED");
  }

  // Caso 5D: Ainda processando (IN_PROGRESS)
  if (containerStatus === "IN_PROGRESS") {
    // NÃO É ERRO: Libera o lock atômico para o próximo ciclo do Cron checar
    await supabaseAdmin
      .from("scheduled_posts")
      .update({
        status: "processing",
        last_container_status: "IN_PROGRESS",
        last_container_check_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    console.log(
      `[Publisher] Reel ${post.id} (Container: ${containerId}) permanece em processamento normal na Meta (IN_PROGRESS). Lock liberado para próximo Cron.`
    );

    return {
      success: true,
      published: false,
      processing: true,
      statusCode: "IN_PROGRESS",
      message: isImmediateUserRequest
        ? "Vídeo enviado para processamento no Instagram. A publicação será finalizada automaticamente assim que a Meta concluir a codificação."
        : "Reel em processamento assíncrono na Meta (IN_PROGRESS).",
    };
  }

  // Caso 5E: FINISHED -> Executar media_publish com retry seguro de 5 minutos
  if (containerStatus === "FINISHED") {
    return await executeMediaPublishWithRetries({
      supabaseAdmin,
      post,
      account,
      containerId,
      cleanToken,
      graphHost,
      graphVersion,
      igUserId,
    });
  }

  throw new MetaApiError(`Status desconhecido retornado pela Meta para o container: ${containerStatus}`);
}

/**
 * Executa a chamada a media_publish com tratamento do erro 9007 / 2207027
 * e garantia de no máximo 2 tentativas reais de publicação.
 */
async function executeMediaPublishWithRetries({
  supabaseAdmin,
  post,
  account,
  containerId,
  cleanToken,
  graphHost,
  graphVersion,
  igUserId,
}: {
  supabaseAdmin: any;
  post: any;
  account: any;
  containerId: string;
  cleanToken: string;
  graphHost: string;
  graphVersion: string;
  igUserId: string;
}): Promise<PublishResult> {
  const currentAttempts = (post.publish_attempts || 0) + 1;
  const nowIso = new Date().toISOString();

  const publishParams = new URLSearchParams({
    creation_id: containerId,
    access_token: cleanToken,
  });

  const publishRes = await fetch(
    `${graphHost}/${graphVersion}/${igUserId}/media_publish?${publishParams.toString()}`,
    { method: "POST" }
  );
  const publishData = await publishRes.json();

  // 1. Sucesso imediato na publicação
  if (publishRes.ok && publishData?.id) {
    const instagramMediaId = publishData.id as string;
    return await finalizeSuccessfulPublication({
      supabaseAdmin,
      post,
      account,
      instagramMediaId,
      cleanToken,
      graphHost,
      graphVersion,
    });
  }

  // 2. Análise do Erro da Meta
  const metaErr = publishData?.error || {};
  const errorCode = metaErr.code;
  const errorSubcode = metaErr.error_subcode;
  const errorMsg = metaErr.message || "Falha ao publicar Reel no Instagram.";
  const fbtraceId = metaErr.fbtrace_id;

  const is9007 =
    errorCode === 9007 ||
    errorSubcode === 2207027 ||
    errorMsg.toLowerCase().includes("not ready for publish") ||
    errorMsg.toLowerCase().includes("media id is not available");

  console.warn(
    `[Publisher] media_publish retornou erro (post: ${post.id}, tentativa: ${currentAttempts}, code: ${errorCode}, subcode: ${errorSubcode}): ${errorMsg}`
  );

  // Se for o erro 9007 (Media not ready):
  if (is9007) {
    // Consulta o container imediatamente para ver se ainda está IN_PROGRESS
    const statusRes = await fetch(
      `${graphHost}/${graphVersion}/${containerId}?fields=status_code,status&access_token=${cleanToken}`
    );
    const statusData = await statusRes.json();

    if (statusData.status_code === "IN_PROGRESS") {
      // O container ainda está em codificação na Meta! Mantém processing sem consumir tentativa.
      await supabaseAdmin
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
        message: "O vídeo ainda está sendo preparado pelos servidores do Instagram. O sistema verificará novamente no próximo ciclo.",
      };
    }

    // Se o container consta como FINISHED mas deu 9007 na 1ª tentativa, tenta aguardar 3s de compensação de replicação
    if (currentAttempts < 2) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const retryRes = await fetch(
        `${graphHost}/${graphVersion}/${igUserId}/media_publish?${publishParams.toString()}`,
        { method: "POST" }
      );
      const retryData = await retryRes.json();

      if (retryRes.ok && retryData?.id) {
        return await finalizeSuccessfulPublication({
          supabaseAdmin,
          post,
          account,
          instagramMediaId: retryData.id as string,
          cleanToken,
          graphHost,
          graphVersion,
        });
      }
    }
  }

  // Lança o erro estruturado para que o catch principal realize a classificação e o retry de 5 minutos
  throw new MetaApiError(
    errorMsg,
    is9007 ? "MEDIA_NOT_READY_9007" : `META_${errorCode || "PUBLISH_FAILED"}`,
    errorSubcode,
    publishData,
    fbtraceId
  );
}

/**
 * Publicação de Carrosséis
 */
async function handleCarouselPublication({
  supabaseAdmin,
  post,
  account,
  cleanToken,
  graphHost,
  graphVersion,
  igUserId,
}: {
  supabaseAdmin: any;
  post: any;
  account: any;
  cleanToken: string;
  graphHost: string;
  graphVersion: string;
  igUserId: string;
}): Promise<PublishResult> {
  const carouselId = post.carousel_id;
  if (!carouselId) {
    throw new Error("Agendamento de carrossel sem identificador de carrossel (carousel_id).");
  }

  const { data: carouselItems, error: itemsErr } = await supabaseAdmin
    .from("carousel_items")
    .select("id, media_id, position")
    .eq("carousel_id", carouselId)
    .order("position", { ascending: true });

  if (itemsErr || !carouselItems || carouselItems.length < 2) {
    throw new Error("O carrossel precisa ter no mínimo 2 slides para publicação na Meta.");
  }

  const slideMediaIds = carouselItems.map((ci: any) => ci.media_id);
  const { data: slideMedias, error: slideMediasErr } = await supabaseAdmin
    .from("media")
    .select("id, storage_path, storage_provider, thumbnail_url, media_type")
    .in("id", slideMediaIds);

  if (slideMediasErr || !slideMedias || slideMedias.length !== slideMediaIds.length) {
    throw new Error("Um ou mais slides do carrossel não foram encontrados no repositório de mídias.");
  }

  const slideMediaMap = new Map<string, any>(slideMedias.map((m: any) => [m.id, m]));
  const childrenContainerIds: string[] = [];

  // Cria um container para cada slide usando getMediaReadUrl (suporta R2 e Supabase)
  for (const item of carouselItems) {
    const sm: any = slideMediaMap.get(item.media_id);
    if (!sm?.storage_path) {
      throw new Error(`Arquivo do slide #${item.position + 1} não localizado.`);
    }

    const slideSignedUrl = await getMediaReadUrl(sm, "main", 7200);
    if (!slideSignedUrl) {
      throw new Error(`Falha ao gerar URL de acesso para o slide #${item.position + 1}.`);
    }

    const isVideo = sm.media_type === "video";
    const itemParams = new URLSearchParams({
      is_carousel_item: "true",
      access_token: cleanToken,
    });

    if (isVideo) {
      itemParams.set("media_type", "VIDEO");
      itemParams.set("video_url", slideSignedUrl);
    } else {
      itemParams.set("image_url", slideSignedUrl);
    }

    const itemRes = await fetch(
      `${graphHost}/${graphVersion}/${igUserId}/media?${itemParams.toString()}`,
      { method: "POST" }
    );
    const itemData = await itemRes.json();

    if (!itemRes.ok || !itemData?.id) {
      const metaErr = itemData?.error;
      throw new MetaApiError(
        metaErr?.message || `Falha ao criar slide #${item.position + 1} do carrossel.`,
        metaErr?.code ? `META_${metaErr.code}` : "META_CAROUSEL_ITEM_FAILED",
        metaErr?.error_subcode,
        itemData,
        metaErr?.fbtrace_id
      );
    }

    childrenContainerIds.push(itemData.id as string);
  }

  // Cria o container pai do Carrossel
  const carouselContainerParams = new URLSearchParams({
    media_type: "CAROUSEL",
    children: childrenContainerIds.join(","),
    caption: post.caption || "",
    access_token: cleanToken,
  });

  const carouselContainerRes = await fetch(
    `${graphHost}/${graphVersion}/${igUserId}/media?${carouselContainerParams.toString()}`,
    { method: "POST" }
  );
  const carouselContainerData = await carouselContainerRes.json();

  if (!carouselContainerRes.ok || !carouselContainerData?.id) {
    const metaErr = carouselContainerData?.error;
    throw new MetaApiError(
      metaErr?.message || "Falha ao criar container principal do carrossel.",
      metaErr?.code ? `META_${metaErr.code}` : "META_CAROUSEL_CONTAINER_FAILED",
      metaErr?.error_subcode,
      carouselContainerData,
      metaErr?.fbtrace_id
    );
  }

  const carouselContainerId = carouselContainerData.id as string;

  // Confirma a publicação do Carrossel
  const publishParams = new URLSearchParams({
    creation_id: carouselContainerId,
    access_token: cleanToken,
  });

  const publishRes = await fetch(
    `${graphHost}/${graphVersion}/${igUserId}/media_publish?${publishParams.toString()}`,
    { method: "POST" }
  );
  const publishData = await publishRes.json();

  if (!publishRes.ok || !publishData?.id) {
    const metaErr = publishData?.error;
    throw new MetaApiError(
      metaErr?.message || "Falha ao confirmar publicação do carrossel na Meta.",
      metaErr?.code ? `META_${metaErr.code}` : "META_CAROUSEL_PUBLISH_FAILED",
      metaErr?.error_subcode,
      publishData,
      metaErr?.fbtrace_id
    );
  }

  const instagramMediaId = publishData.id as string;

  // Atualiza carrossel
  await supabaseAdmin
    .from("carousels")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("id", carouselId);

  return await finalizeSuccessfulPublication({
    supabaseAdmin,
    post,
    account,
    instagramMediaId,
    cleanToken,
    graphHost,
    graphVersion,
  });
}

/**
 * Finaliza com sucesso a publicação de qualquer post (Reel ou Carrossel):
 * - Registra em published_posts com scheduled_post_id
 * - Atualiza scheduled_post para 'published', zera next_retry_at
 * - Atualiza itens de fila (reel_queue_items / carousel_queue_items)
 * - Finaliza a fila se não restarem itens pendentes
 * - Agenda retenção de 7 dias na mídia
 * - MARCA ERROS ANTERIORES DESTE POST COMO RESOLVIDOS (resolved_at = now(), status = 'resolved')
 * - Registra tentativa de sucesso em publication_attempts
 * - Envia notificação
 */
async function finalizeSuccessfulPublication({
  supabaseAdmin,
  post,
  account,
  instagramMediaId,
  cleanToken,
  graphHost,
  graphVersion,
}: {
  supabaseAdmin: any;
  post: any;
  account: any;
  instagramMediaId: string;
  cleanToken: string;
  graphHost: string;
  graphVersion: string;
}): Promise<PublishResult> {
  const nowIso = new Date().toISOString();

  // 1. Obtenção do permalink oficial
  let permalink = `https://www.instagram.com/p/${instagramMediaId}`;
  try {
    const permalinkRes = await fetch(
      `${graphHost}/${graphVersion}/${instagramMediaId}?fields=permalink&access_token=${cleanToken}`
    );
    const permalinkData = await permalinkRes.json();
    if (permalinkData?.permalink) {
      permalink = permalinkData.permalink;
    }
  } catch {
    // fallback mantido
  }

  // 2. Registro em public.published_posts (com proteção de duplicidade e tenant isolado)
  await supabaseAdmin.from("published_posts").upsert(
    {
      user_id: post.user_id,
      instagram_account_id: post.instagram_account_id,
      scheduled_post_id: post.id,
      media_type: post.post_type === "carousel" ? "carousel" : "reel",
      instagram_media_id: instagramMediaId,
      permalink,
      caption: post.caption || "",
      published_at: nowIso,
      status: "published",
    },
    { onConflict: "scheduled_post_id" }
  );

  // 3. Atualização do scheduled_post (zera next_retry_at e incrementa tentativas)
  await supabaseAdmin
    .from("scheduled_posts")
    .update({
      status: "published",
      meta_media_id: instagramMediaId,
      publish_attempts: (post.publish_attempts || 0) + 1,
      next_retry_at: null,
      locked_at: null,
      locked_by: null,
      updated_at: nowIso,
    })
    .eq("id", post.id);

  // 4. Atualização de itens de fila
  if (post.queue_item_id) {
    await supabaseAdmin
      .from("reel_queue_items")
      .update({ status: "published", updated_at: nowIso })
      .eq("id", post.queue_item_id);
  }

  if (post.carousel_queue_item_id) {
    await supabaseAdmin
      .from("carousel_queue_items")
      .update({ status: "published", updated_at: nowIso })
      .eq("id", post.carousel_queue_item_id);
  }

  // 5. Finaliza fila se todos os itens tiverem atingido estado final
  await checkAndFinalizeQueueIfDone(supabaseAdmin, post.queue_id, post.carousel_queue_id, nowIso);

  // 6. Atualização da retenção da mídia (exclusão programada para 7 dias)
  const deleteAfter = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  if (post.post_type === "carousel" && post.carousel_id) {
    const { data: cItems } = await supabaseAdmin
      .from("carousel_items")
      .select("media_id")
      .eq("carousel_id", post.carousel_id);
    const cMediaIds = (cItems || []).map((ci: any) => ci.media_id);
    if (cMediaIds.length > 0) {
      await supabaseAdmin
        .from("media")
        .update({
          published_at: nowIso,
          retention_status: "eligible_for_deletion",
          delete_after: deleteAfter,
          updated_at: nowIso,
        })
        .in("id", cMediaIds);
    }
  } else if (post.media_id) {
    await supabaseAdmin
      .from("media")
      .update({
        published_at: nowIso,
        retention_status: "eligible_for_deletion",
        delete_after: deleteAfter,
        updated_at: nowIso,
      })
      .eq("id", post.media_id);
  }

  // 7. RESOLUÇÃO AUTOMÁTICA DE ERROS ANTERIORES DESTE POST
  // Se houve tentativa com falha anterior, marca o erro como resolvido
  await supabaseAdmin
    .from("error_logs")
    .update({
      resolved_at: nowIso,
      status: "resolved",
    })
    .eq("scheduled_post_id", post.id)
    .is("resolved_at", null);

  // 8. Registro de tentativa bem-sucedida em publication_attempts
  await supabaseAdmin.from("publication_attempts").insert({
    user_id: post.user_id,
    scheduled_post_id: post.id,
    attempt_number: (post.publish_attempts || 0) + 1,
    finished_at: nowIso,
    success: true,
    retryable: false,
  });

  // 9. Notificação de sucesso no sistema
  const postTypeName = post.post_type === "carousel" ? "Carrossel" : "Reel";
  await supabaseAdmin.from("notifications").insert({
    user_id: post.user_id,
    instagram_account_id: post.instagram_account_id,
    type: "publish_success",
    title: `${postTypeName} Publicado com Sucesso!`,
    message: `${postTypeName} publicado oficialmente em @${account.username || "instagram"}.`,
    link: permalink,
  });

  // 10. Snapshot Diário de Seguidores (Executado de forma assíncrona e não-bloqueante na primeira atividade do dia)
  void syncDailyAccountFollowers(supabaseAdmin, account, cleanToken, graphHost, graphVersion).catch((err) => {
    console.warn(`[Followers Snapshot] Falha não-bloqueante ao sincronizar seguidores de @${account.username}:`, err);
  });

  return {
    success: true,
    published: true,
    instagramMediaId,
    permalink,
  };
}

/**
 * Trata erros terminais de publicação após 2 tentativas ou erro não recuperável:
 * - Registra em publication_attempts (retryable: false)
 * - Registra em error_logs com status='active' e detalhes técnicos estruturados sem expor tokens
 * - Atualiza scheduled_post para 'failed', zera next_retry_at
 * - Atualiza itens de fila para 'failed'
 * - Finaliza a fila com erros se todos os itens tiverem terminado
 * - Envia notificação amigável
 */
async function handleFinalPublicationError({
  supabaseAdmin,
  post,
  account,
  err,
  classification,
  attemptNumber,
}: {
  supabaseAdmin: any;
  post: any;
  account: any;
  err: unknown;
  classification?: ErrorClassification;
  attemptNumber?: number;
}): Promise<PublishResult> {
  const isMetaErr = err instanceof MetaApiError;
  const currentAttempts = attemptNumber || (post.publish_attempts || 0) + 1;
  const resolvedClass = classification || classifyMetaError(err, currentAttempts);

  const errorCode = resolvedClass.errorCode;
  const errorMsg = resolvedClass.friendlyMessage;
  const subcode = isMetaErr ? err.subcode : undefined;
  const fbtraceId = isMetaErr ? err.fbtraceId : undefined;
  const rawMsg = err instanceof Error ? err.message : String(err);

  console.error(`[Publisher] Erro terminal na publicação do post ${post.id} (${errorCode}):`, rawMsg);
  const nowIso = new Date().toISOString();

  // Registra a tentativa terminal em publication_attempts
  await supabaseAdmin.from("publication_attempts").insert({
    user_id: post.user_id,
    scheduled_post_id: post.id,
    attempt_number: currentAttempts,
    finished_at: nowIso,
    success: false,
    error_code: errorCode,
    error_message: errorMsg,
    retryable: false,
  });

  // Registra no log de erros técnico com detalhes seguros (sem segredos)
  await supabaseAdmin.from("error_logs").insert({
    user_id: post.user_id,
    instagram_account_id: post.instagram_account_id,
    scheduled_post_id: post.id,
    severity: "error",
    category: "publishing",
    status: "active",
    error_code: errorCode,
    message: errorMsg,
    technical_details: JSON.stringify({
      postId: post.id,
      errorCode,
      subcode,
      fbtraceId,
      rawError: rawMsg,
      metaContainerId: post.meta_container_id,
      publishAttempts: currentAttempts,
      timestamp: nowIso,
      details: isMetaErr ? err.details : undefined,
    }),
  });

  // Atualiza scheduled_post para 'failed' e zera next_retry_at
  await supabaseAdmin
    .from("scheduled_posts")
    .update({
      status: "failed",
      publish_attempts: currentAttempts,
      next_retry_at: null,
      error_code: errorCode,
      error_message: errorMsg,
      locked_at: null,
      locked_by: null,
      updated_at: nowIso,
    })
    .eq("id", post.id);

  if (post.queue_item_id) {
    await supabaseAdmin
      .from("reel_queue_items")
      .update({ status: "failed", updated_at: nowIso })
      .eq("id", post.queue_item_id);
  }

  if (post.carousel_queue_item_id) {
    await supabaseAdmin
      .from("carousel_queue_items")
      .update({ status: "failed", updated_at: nowIso })
      .eq("id", post.carousel_queue_item_id);
  }

  // Verifica se a fila terminou (mesmo com erros, a fila deve ser marcada como completed para não ficar em Filas Ativas)
  await checkAndFinalizeQueueIfDone(supabaseAdmin, post.queue_id, post.carousel_queue_id, nowIso);

  // Notificação de falha com mensagem amigável
  await supabaseAdmin.from("notifications").insert({
    user_id: post.user_id,
    instagram_account_id: post.instagram_account_id,
    type: "publish_failed",
    title: resolvedClass.friendlyTitle,
    message: `Não foi possível publicar em @${account.username || "instagram"}: ${errorMsg}`,
  });

  return {
    success: false,
    published: false,
    error: errorMsg,
    errorCode,
  };
}

/**
 * Libera o lock atômico de um post agendado
 */
async function releaseLock(supabaseAdmin: any, postId: string, newStatus: string) {
  try {
    await supabaseAdmin
      .from("scheduled_posts")
      .update({
        status: newStatus,
        locked_at: null,
        locked_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);
  } catch (e) {
    console.warn(`[Publisher] Aviso ao liberar lock do post ${postId}:`, e);
  }
}

/**
 * Sincronização diária de seguidores (1 snapshot por conta por dia local em America/Sao_Paulo)
 * Executado na primeira atividade do dia ou sob demanda, sem bloquear publicações.
 */
export async function syncDailyAccountFollowers(
  supabaseAdmin: any,
  account: any,
  cleanToken: string,
  graphHost: string,
  graphVersion: string
): Promise<number | null> {
  try {
    const todaySaoPaulo = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
    }).format(new Date());

    // Verifica se já existe snapshot registrado para hoje no fuso de São Paulo
    const { data: existingSnapshot } = await supabaseAdmin
      .from("account_metrics")
      .select("id, followers_count")
      .eq("instagram_account_id", account.id)
      .eq("date", todaySaoPaulo)
      .maybeSingle();

    if (existingSnapshot) {
      return existingSnapshot.followers_count;
    }

    // Consulta contagem de seguidores na Meta Graph API
    const igUserId = account.instagram_user_id;
    const isEaa = cleanToken.startsWith("EAA");
    const endpoint = isEaa && igUserId
      ? `${graphHost}/${graphVersion}/${igUserId}?fields=followers_count,media_count&access_token=${cleanToken}`
      : `${graphHost}/${graphVersion}/me?fields=followers_count,media_count&access_token=${cleanToken}`;

    const res = await fetch(endpoint);
    if (!res.ok) {
      console.warn(`[Followers Snapshot] Meta retornou status ${res.status} para @${account.username}`);
      return null;
    }

    const data = await res.json();
    const currentFollowers = typeof data.followers_count === "number" ? data.followers_count : null;
    const currentMediaCount = typeof data.media_count === "number" ? data.media_count : null;

    if (currentFollowers !== null) {
      const nowIso = new Date().toISOString();

      await supabaseAdmin
        .from("account_metrics")
        .upsert(
          {
            user_id: account.user_id,
            instagram_account_id: account.id,
            date: todaySaoPaulo,
            followers_count: currentFollowers,
            media_count: currentMediaCount ?? 0,
            recorded_at: nowIso,
          },
          { onConflict: "instagram_account_id,date" }
        );

      await supabaseAdmin
        .from("instagram_accounts")
        .update({
          followers_count: currentFollowers,
          updated_at: nowIso,
        })
        .eq("id", account.id);

      console.log(`[Followers Snapshot] Snapshot registrado para @${account.username}: ${currentFollowers} seguidores.`);
      return currentFollowers;
    }

    return null;
  } catch (err) {
    console.warn(`[Followers Snapshot] Erro ao sincronizar seguidores:`, err);
    return null;
  }
}

/**
 * Export de retrocompatibilidade
 */
export const publishScheduledPost = processInstagramPublication;

