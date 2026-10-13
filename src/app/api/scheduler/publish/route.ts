import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processInstagramPublication } from "@/lib/instagram/publisher";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Utilitário de fila concorrente controlada para processamento paralelo de contas
 */
async function runWithConcurrencyLimit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await fn(items[index]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

/**
 * POST /api/scheduler/publish
 * 
 * Endpoint de disparo periódico do Scheduler para publicação de posts agendados
 * e avanço de posts em processamento assíncrono na Meta.
 * Invocado periodicamente por:
 * 1. Supabase Cron (pg_cron + pg_net) com cabeçalho "Authorization: Bearer CRON_SECRET"
 * 2. Webhook agendado com cabeçalho "x-cron-secret: CRON_SECRET"
 * 3. Usuário autenticado na aplicação para sincronização manual sob demanda.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronHeader = request.headers.get("x-cron-secret");
    const expectedSecret = process.env.CRON_SECRET;

    const providedToken = authHeader?.replace("Bearer ", "") || cronHeader;

    let isAuthorized = false;

    // 1. Validação via CRON_SECRET
    if (expectedSecret && providedToken === expectedSecret) {
      isAuthorized = true;
    } else {
      // 2. Validação via sessão de usuário autenticado
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          isAuthorized = true;
        }
      } catch {
        // Falha na sessão
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, message: "Acesso não autorizado ao agendador de publicação." },
        { status: 401 }
      );
    }

    const supabaseAdmin = createAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Servidor administrativo não configurado." },
        { status: 500 }
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    const globalConcurrency = parseInt(process.env.PUBLISH_GLOBAL_CONCURRENCY || "4", 10) || 4;

    // 3. Métricas de Backlog para Diagnóstico Multi-Conta
    let totalDueCount = 0;
    let accountsDueCount = 0;
    try {
      const { data: dueRows } = await supabaseAdmin
        .from("scheduled_posts")
        .select("instagram_account_id")
        .eq("status", "scheduled")
        .lte("scheduled_at", nowIso);

      if (dueRows) {
        totalDueCount = dueRows.length;
        const uniqueAccounts = new Set(dueRows.map((r: any) => r.instagram_account_id));
        accountsDueCount = uniqueAccounts.size;
      }
    } catch {
      // Diagnóstico não-bloqueante
    }

    // 4. Tenta claim atômico com fairness multi-conta via RPC
    let claimedPosts: Array<{
      id: string;
      scheduled_at: string;
      instagram_account_id: string;
      post_type: string;
      queue_id?: string | null;
      status?: string;
      meta_container_id?: string | null;
      publish_attempts?: number;
    }> = [];
    let usedRpc = false;

    try {
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc("claim_scheduled_posts", {
        p_worker_id: "scheduler-worker",
        p_batch_size: 20,
        p_lock_duration_minutes: 5,
      });

      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        claimedPosts = rpcData;
        usedRpc = true;
      }
    } catch {
      // RPC não disponível, segue para fallback resiliente
    }

    // 5. Fallback Resiliente com Isolamento por Conta e Fairness
    if (!usedRpc) {
      // 5A: Identifica contas ocupadas
      const { data: busyRows } = await supabaseAdmin
        .from("scheduled_posts")
        .select("instagram_account_id, locked_at, next_retry_at")
        .eq("status", "processing");

      const busyAccountSet = new Set<string>();
      (busyRows || []).forEach((row: any) => {
        const isLocked = row.locked_at && (now.getTime() - new Date(row.locked_at).getTime() < 2 * 60 * 1000);
        const isRetrying = row.next_retry_at && (new Date(row.next_retry_at).getTime() > now.getTime());
        if (isLocked || isRetrying) {
          busyAccountSet.add(row.instagram_account_id);
        }
      });

      // 5B: Containers em processamento assíncrono (prioridade 1)
      const { data: processingCandidates } = await supabaseAdmin
        .from("scheduled_posts")
        .select("id, scheduled_at, instagram_account_id, post_type, queue_id, status, locked_at, meta_container_id, next_retry_at, publish_attempts")
        .eq("status", "processing")
        .not("meta_container_id", "is", null)
        .order("scheduled_at", { ascending: true })
        .limit(20);

      // 5C: Posts agendados normais cujo horário chegou (prioridade 2)
      const { data: scheduledCandidates } = await supabaseAdmin
        .from("scheduled_posts")
        .select("id, scheduled_at, instagram_account_id, post_type, queue_id, status, locked_at, meta_container_id, next_retry_at, publish_attempts")
        .eq("status", "scheduled")
        .lte("scheduled_at", nowIso)
        .order("scheduled_at", { ascending: true })
        .limit(50);

      // Filtra candidatos válidos respeitando fairness (no máximo 1 post por conta)
      const accountClaimedSet = new Set<string>();
      const validCandidates: any[] = [];

      // Primeiro adiciona containers ativos que precisam de verificação
      (processingCandidates || []).forEach((c: any) => {
        if (accountClaimedSet.has(c.instagram_account_id)) return;
        if (c.next_retry_at && new Date(c.next_retry_at).getTime() > now.getTime()) return;
        if (c.locked_at && (now.getTime() - new Date(c.locked_at).getTime() < 1 * 60 * 1000)) return;

        accountClaimedSet.add(c.instagram_account_id);
        validCandidates.push(c);
      });

      // Depois adiciona posts agendados de contas que ainda não têm claim e não estão ocupadas
      (scheduledCandidates || []).forEach((s: any) => {
        if (accountClaimedSet.has(s.instagram_account_id)) return;
        if (busyAccountSet.has(s.instagram_account_id)) return;
        if (s.next_retry_at && new Date(s.next_retry_at).getTime() > now.getTime()) return;
        if (s.locked_at && (now.getTime() - new Date(s.locked_at).getTime() < 2 * 60 * 1000)) return;

        accountClaimedSet.add(s.instagram_account_id);
        validCandidates.push(s);
      });

      // Realiza claim com lock atômico
      for (const cand of validCandidates.slice(0, 20)) {
        const { error: claimErr } = await supabaseAdmin
          .from("scheduled_posts")
          .update({
            status: "processing",
            locked_at: nowIso,
            locked_by: "scheduler-worker",
            updated_at: nowIso,
          })
          .eq("id", cand.id);

        if (!claimErr) {
          claimedPosts.push(cand);
        }
      }
    }

    // 6. Diagnóstico de posts vencidos há mais de 15 minutos sem processamento
    const { data: stuckPosts } = await supabaseAdmin
      .from("scheduled_posts")
      .select("id, scheduled_at, instagram_account_id, user_id")
      .eq("status", "scheduled")
      .lt("scheduled_at", fifteenMinutesAgo)
      .is("locked_at", null)
      .limit(5);

    if (stuckPosts && stuckPosts.length > 0) {
      for (const stuck of stuckPosts) {
        await supabaseAdmin.from("error_logs").insert({
          user_id: stuck.user_id,
          instagram_account_id: stuck.instagram_account_id,
          scheduled_post_id: stuck.id,
          severity: "warning",
          category: "publishing",
          error_code: "SCHEDULED_POST_OVERDUE",
          message: `O agendamento previsto para ${stuck.scheduled_at} está na fila de espera para publicação.`,
          technical_details: JSON.stringify({
            postId: stuck.id,
            scheduledAt: stuck.scheduled_at,
            checkedAt: nowIso,
          }),
        });
      }
    }

    // 7. Diagnóstico do Próximo Post Agendado
    const { data: upcomingQuery } = await supabaseAdmin
      .from("scheduled_posts")
      .select("id, scheduled_at, status")
      .eq("status", "scheduled")
      .gt("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(1);

    const nextUpcoming = upcomingQuery && upcomingQuery.length > 0 ? upcomingQuery[0] : null;

    if (claimedPosts.length === 0) {
      console.log(
        `[Scheduler Summary] due_total=${totalDueCount} accounts_due=${accountsDueCount} claimed=0 processing=0 published=0 waiting_meta=0 failed=0 backlog_remaining=${totalDueCount}`
      );

      return NextResponse.json({
        success: true,
        message: "Nenhum post agendado ou em processamento pendente para este minuto.",
        due: totalDueCount,
        claimed: 0,
        processed: 0,
        published: 0,
        processing: 0,
        failed: 0,
        nextScheduledAt: nextUpcoming?.scheduled_at || null,
      });
    }

    // 8. Execução Paralela Controlada por Fila Concorrente (PUBLISH_GLOBAL_CONCURRENCY)
    // Permite que contas diferentes processem simultaneamente sem bloquear umas às outras.
    const executePost = async (post: any) => {
      const startTime = Date.now();
      try {
        const result = await processInstagramPublication(post.id, {
          isImmediateUserRequest: false,
        });

        const elapsedMs = Date.now() - startTime;
        const outcome = result.published
          ? "published"
          : result.processing
          ? "waiting_meta"
          : "failed";

        // Log detalhado e seguro por item (sem credenciais ou URLs completas)
        console.log(
          `[Scheduler Item] postId=${post.id} accountId=${post.instagram_account_id} scheduledAt=${post.scheduled_at} attempt=${(post.publish_attempts || 0) + 1} elapsedMs=${elapsedMs} resultado=${outcome}`
        );

        return {
          postId: post.id,
          scheduledAt: post.scheduled_at,
          accountId: post.instagram_account_id,
          ...result,
        };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Erro desconhecido";
        console.error(`[Scheduler Item Error] postId=${post.id}:`, errMsg);
        return {
          postId: post.id,
          scheduledAt: post.scheduled_at,
          accountId: post.instagram_account_id,
          success: false,
          published: false,
          processing: false,
          error: errMsg,
        };
      }
    };

    const results = await runWithConcurrencyLimit(
      claimedPosts,
      globalConcurrency,
      executePost
    );

    let publishedCount = 0;
    let waitingMetaCount = 0;
    let failedCount = 0;

    for (const r of results) {
      if (r.published) {
        publishedCount++;
      } else if (r.processing) {
        waitingMetaCount++;
      } else {
        failedCount++;
      }
    }

    const backlogRemaining = Math.max(0, totalDueCount - publishedCount);

    // Log resumo estruturado (suprimido quando inativo para evitar poluição de 1.440 logs vazios por dia)
    if (claimedPosts.length > 0 || totalDueCount > 0 || failedCount > 0) {
      console.log(
        `[Scheduler Summary] due_total=${totalDueCount} accounts_due=${accountsDueCount} claimed=${claimedPosts.length} processing=${claimedPosts.length} published=${publishedCount} waiting_meta=${waitingMetaCount} failed=${failedCount} backlog_remaining=${backlogRemaining}`
      );
    }

    return NextResponse.json({
      success: true,
      message: `Processamento concluído: ${publishedCount} publicado(s), ${waitingMetaCount} aguardando Meta, ${failedCount} com falha.`,
      due_total: totalDueCount,
      accounts_due: accountsDueCount,
      claimed: claimedPosts.length,
      processed: claimedPosts.length,
      published: publishedCount,
      waiting_meta: waitingMetaCount,
      failed: failedCount,
      backlog_remaining: backlogRemaining,
      nextScheduledAt: nextUpcoming?.scheduled_at || null,
      results,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido no scheduler.";
    console.error("[Scheduler Publish API] Exceção:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
