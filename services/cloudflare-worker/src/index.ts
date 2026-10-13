import { Env, PublishQueueMessage } from "./types";
import { runScheduledFeeder } from "./feeder";
import { handleQueueBatch } from "./queue";
import { executeWorkerPublication } from "./publisher";
import { getSupabaseAnon, getSupabaseAdmin } from "./supabase";

import { AwsClient } from "aws4fetch";

export default {
  /**
   * HTTP Fetch Handler
   * Rotas:
   * 1. GET /health - Status operacional do Worker
   * 2. GET /diagnostic - Validação não-destrutiva de infraestrutura e presença de variáveis
   * 3. POST /publish-now - Publicação imediata ("Postar Agora") com validação de sessão Supabase
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Tratamento de CORS para chamadas vindas do frontend
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    };

    // 1. GET /health
    if (url.pathname === "/health" && request.method === "GET") {
      return new Response(
        JSON.stringify({
          status: "ok",
          service: "agendador-operational-worker",
          runtime: "cloudflare-workers",
          timestamp: new Date().toISOString(),
          r2Configured: Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID),
          supabaseConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 2. GET /diagnostic - Validação Não-Destrutiva
    if (url.pathname === "/diagnostic" && request.method === "GET") {
      // Checagem de presença de variáveis (apenas booleano, NUNCA expõe valores)
      const variablesPresence = {
        SUPABASE_URL: Boolean(env.SUPABASE_URL),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
        SUPABASE_ANON_KEY: Boolean(env.SUPABASE_ANON_KEY),
        TOKEN_ENCRYPTION_KEY: Boolean(env.TOKEN_ENCRYPTION_KEY),
        R2_ACCOUNT_ID: Boolean(env.R2_ACCOUNT_ID),
        R2_ACCESS_KEY_ID: Boolean(env.R2_ACCESS_KEY_ID),
        R2_SECRET_ACCESS_KEY: Boolean(env.R2_SECRET_ACCESS_KEY),
        R2_BUCKET_NAME: Boolean(env.R2_BUCKET_NAME),
        R2_REGION: Boolean(env.R2_REGION),
        R2_READ_URL_TTL_SECONDS: Boolean(env.R2_READ_URL_TTL_SECONDS),
        META_GRAPH_VERSION: Boolean(env.META_GRAPH_VERSION),
        MAX_PROCESSING_TIMEOUT_MINUTES: Boolean(env.MAX_PROCESSING_TIMEOUT_MINUTES),
        FEEDER_WINDOW_MINUTES: Boolean(env.FEEDER_WINDOW_MINUTES),
        GLOBAL_CONCURRENCY: Boolean(env.GLOBAL_CONCURRENCY),
      };

      // Teste não-destrutivo do Supabase (apenas SELECT limit 1 em tabela existente)
      let supabaseTest = { status: "OK", error: null as string | null };
      try {
        const supabaseAdmin = getSupabaseAdmin(env);
        const { data, error } = await supabaseAdmin.from("instagram_accounts").select("id").limit(1);
        if (error) {
          supabaseTest = { status: "ERRO", error: error.message };
        } else {
          supabaseTest = { status: "OK", error: null };
        }
      } catch (err: any) {
        supabaseTest = { status: "ERRO", error: err?.message || String(err) };
      }

      // Teste não-destrutivo do Cloudflare R2 (apenas ListObjects com max-keys=1)
      let r2Test = { status: "OK", error: null as string | null };
      try {
        const accountId = env.R2_ACCOUNT_ID?.trim();
        const bucket = env.R2_BUCKET_NAME?.trim();
        const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
        const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();

        if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
          r2Test = { status: "ERRO", error: "Credenciais R2 incompletas" };
        } else {
          const client = new AwsClient({
            accessKeyId,
            secretAccessKey,
            region: env.R2_REGION || "auto",
            service: "s3",
          });
          const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}?max-keys=1`;
          const res = await client.fetch(endpoint, { method: "GET" });
          if (res.ok) {
            r2Test = { status: "OK", error: null };
          } else {
            r2Test = { status: "ERRO", error: `HTTP ${res.status} ao acessar bucket R2` };
          }
        }
      } catch (err: any) {
        r2Test = { status: "ERRO", error: err?.message || String(err) };
      }

      return new Response(
        JSON.stringify({
          workerHealth: "OK",
          service: "agendador-operational-worker",
          timestamp: new Date().toISOString(),
          variablesPresence,
          supabaseTest,
          r2Test,
          queueProducerBinding: Boolean(env.PUBLISH_QUEUE),
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 2. POST /publish-now - Publicação imediata (Postar Agora -> Enfileira na Queue com delaySeconds = 0)
    if (url.pathname === "/publish-now" && request.method === "POST") {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Sessão não informada no cabeçalho Authorization." }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      const token = authHeader.slice(7).trim();
      const isServiceRole = Boolean(env.SUPABASE_SERVICE_ROLE_KEY && token === env.SUPABASE_SERVICE_ROLE_KEY.trim());
      const supabaseAdmin = getSupabaseAdmin(env);

      let authUserId: string | null = null;
      if (!isServiceRole) {
        const supabaseAnon = getSupabaseAnon(env);
        const {
          data: { user },
          error: authErr,
        } = await supabaseAnon.auth.getUser(token);

        if (authErr || !user) {
          return new Response(JSON.stringify({ error: "Sessão de usuário inválida ou expirada." }), {
            status: 401,
            headers: corsHeaders,
          });
        }
        authUserId = user.id;
      }

      try {
        const body = (await request.json()) as any;
        const scheduledPostId = body?.scheduledPostId;

        if (!scheduledPostId || typeof scheduledPostId !== "string") {
          return new Response(JSON.stringify({ error: "'scheduledPostId' é obrigatório." }), {
            status: 400,
            headers: corsHeaders,
          });
        }

        let postQuery = supabaseAdmin
          .from("scheduled_posts")
          .select("id, user_id, status, scheduled_at, instagram_account_id, queue_status")
          .eq("id", scheduledPostId);

        if (authUserId) {
          postQuery = postQuery.eq("user_id", authUserId);
        }

        const { data: post, error: postErr } = await postQuery.single();

        if (postErr || !post) {
          return new Response(JSON.stringify({ error: "Post não localizado ou permissão negada." }), {
            status: 403,
            headers: corsHeaders,
          });
        }

        console.log(
          JSON.stringify({
            event: "QUEUE_ENQUEUE_REQUEST",
            scheduled_post_id: post.id,
            instagram_account_id: post.instagram_account_id,
            scheduled_for: post.scheduled_at,
            queue_status: post.queue_status,
            is_immediate: true,
            delay_seconds: 0,
            timestamp: new Date().toISOString(),
          })
        );

        const nowIso = new Date().toISOString();
        await supabaseAdmin
          .from("scheduled_posts")
          .update({
            queue_status: "enqueued",
            queued_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", scheduledPostId);

        // Envia imediatamente para a Cloudflare Queue com delaySeconds = 0
        await env.PUBLISH_QUEUE.send({ scheduledPostId }, { delaySeconds: 0 });

        console.log(
          JSON.stringify({
            event: "QUEUE_ENQUEUED",
            scheduled_post_id: post.id,
            instagram_account_id: post.instagram_account_id,
            scheduled_for: post.scheduled_at,
            delay_seconds: 0,
            queue_status: "enqueued",
            timestamp: nowIso,
          })
        );

        return new Response(
          JSON.stringify({
            success: true,
            status: "enqueued",
            message: "Post enfileirado para publicação imediata com delaySeconds = 0.",
          }),
          { status: 200, headers: corsHeaders }
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ error: "Falha interna no Postar Agora.", details: errMsg }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // 3. POST /enqueue (e /api/queue/enqueue) - Enfileiramento direto na Cloudflare Queue
    if ((url.pathname === "/enqueue" || url.pathname === "/api/queue/enqueue") && request.method === "POST") {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Autorização não informada no cabeçalho Authorization." }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      const token = authHeader.slice(7).trim();
      const isServiceRole = Boolean(env.SUPABASE_SERVICE_ROLE_KEY && token === env.SUPABASE_SERVICE_ROLE_KEY.trim());
      const supabaseAdmin = getSupabaseAdmin(env);

      let authUserId: string | null = null;
      if (!isServiceRole) {
        const supabaseAnon = getSupabaseAnon(env);
        const {
          data: { user },
          error: authErr,
        } = await supabaseAnon.auth.getUser(token);

        if (authErr || !user) {
          return new Response(JSON.stringify({ error: "Sessão ou chave de autorização inválida." }), {
            status: 401,
            headers: corsHeaders,
          });
        }
        authUserId = user.id;
      }

      try {
        const body = (await request.json()) as any;
        const rawIds: string[] = Array.isArray(body?.scheduledPostIds)
          ? body.scheduledPostIds
          : body?.scheduledPostId
          ? [body.scheduledPostId]
          : [];

        if (rawIds.length === 0) {
          return new Response(JSON.stringify({ error: "'scheduledPostId' ou 'scheduledPostIds' é obrigatório." }), {
            status: 400,
            headers: corsHeaders,
          });
        }

        const isImmediate = Boolean(body?.isImmediate || body?.delaySeconds === 0);
        const explicitDelay = typeof body?.delaySeconds === "number" ? body.delaySeconds : null;

        const results: Array<{
          id: string;
          enqueued: boolean;
          reason?: string;
          delaySeconds?: number;
        }> = [];

        for (const postId of rawIds) {
          if (!postId || typeof postId !== "string") continue;

          let postQuery = supabaseAdmin
            .from("scheduled_posts")
            .select("id, user_id, status, scheduled_at, instagram_account_id, queue_status, queued_at")
            .eq("id", postId);

          if (authUserId) {
            postQuery = postQuery.eq("user_id", authUserId);
          }

          const { data: post, error: postErr } = await postQuery.single();

          if (postErr || !post) {
            results.push({ id: postId, enqueued: false, reason: "post_not_found" });
            continue;
          }

          console.log(
            JSON.stringify({
              event: "QUEUE_ENQUEUE_REQUEST",
              scheduled_post_id: post.id,
              instagram_account_id: post.instagram_account_id,
              scheduled_for: post.scheduled_at,
              queue_status: post.queue_status,
              is_immediate: isImmediate,
              explicit_delay: explicitDelay,
              timestamp: new Date().toISOString(),
            })
          );

          if (["published", "cancelled"].includes(post.status)) {
            results.push({ id: post.id, enqueued: false, reason: `already_${post.status}` });
            continue;
          }

          if (post.queue_status === "enqueued" && !isImmediate) {
            results.push({ id: post.id, enqueued: false, reason: "already_enqueued" });
            continue;
          }

          let delaySeconds = 0;
          if (isImmediate) {
            delaySeconds = 0;
          } else if (explicitDelay !== null) {
            delaySeconds = Math.max(0, Math.min(86400, explicitDelay));
          } else {
            const scheduledMs = new Date(post.scheduled_at).getTime();
            const nowMs = Date.now();
            const diffSeconds = Math.floor((scheduledMs - nowMs) / 1000);

            // Janela > 24h: não envia para a Cloudflare Queue agora (fica para o feeder periódico)
            if (diffSeconds > 86400) {
              results.push({ id: post.id, enqueued: false, reason: "greater_than_24h" });
              continue;
            }

            delaySeconds = Math.max(0, Math.min(86400, diffSeconds));
          }

          const nowIso = new Date().toISOString();
          const { data: claimed, error: claimErr } = await supabaseAdmin
            .from("scheduled_posts")
            .update({
              queue_status: "enqueued",
              queued_at: nowIso,
              updated_at: nowIso,
            })
            .eq("id", post.id)
            .select("id")
            .maybeSingle();

          if (claimErr || !claimed) {
            results.push({ id: post.id, enqueued: false, reason: "atomic_claim_failed" });
            continue;
          }

          await env.PUBLISH_QUEUE.send(
            { scheduledPostId: post.id },
            { delaySeconds: delaySeconds > 0 ? delaySeconds : undefined }
          );

          console.log(
            JSON.stringify({
              event: "QUEUE_ENQUEUED",
              scheduled_post_id: post.id,
              instagram_account_id: post.instagram_account_id,
              scheduled_for: post.scheduled_at,
              delay_seconds: delaySeconds,
              queue_status: "enqueued",
              timestamp: nowIso,
            })
          );

          results.push({ id: post.id, enqueued: true, delaySeconds });
        }

        return new Response(
          JSON.stringify({
            success: true,
            results,
          }),
          { status: 200, headers: corsHeaders }
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ error: "Falha interna ao enfileirar posts.", details: errMsg }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    return new Response(JSON.stringify({ error: "Endpoint não encontrado no Worker operacional." }), {
      status: 404,
      headers: corsHeaders,
    });
  },

  /**
   * Cron Trigger Handler
   * Disparado a cada 1 minuto pelo Cloudflare Cron Trigger.
   * Executa Feeder e Stale Recovery.
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduledFeeder(env));
  },

  /**
   * Queue Consumer Handler
   * Disparado quando mensagens chegam na PUBLISH_QUEUE do Cloudflare.
   */
  async queue(batch: MessageBatch<PublishQueueMessage>, env: Env, ctx: ExecutionContext): Promise<void> {
    await handleQueueBatch(batch, env);
  },
};
