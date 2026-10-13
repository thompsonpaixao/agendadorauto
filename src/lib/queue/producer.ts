/**
 * Produtor de Mensagens para Cloudflare Queue
 * Despacha agendamentos criados no AgendadorAuto para a PUBLISH_QUEUE do Cloudflare Worker.
 */

export interface EnqueueOptions {
  isImmediate?: boolean;
  delaySeconds?: number;
}

export interface EnqueueResult {
  success: boolean;
  enqueuedCount: number;
  results?: Array<{
    id: string;
    enqueued: boolean;
    reason?: string;
    delaySeconds?: number;
  }>;
}

export async function enqueueScheduledPosts(
  scheduledPostIds: string[],
  options?: EnqueueOptions
): Promise<EnqueueResult> {
  if (!scheduledPostIds || scheduledPostIds.length === 0) {
    return { success: true, enqueuedCount: 0 };
  }

  const workerUrl = (
    process.env.CLOUDFLARE_WORKER_URL || "https://agendador-operational-worker.thompsonpaixao.workers.dev"
  ).replace(/\/$/, "");

  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.error("[Queue Producer] SUPABASE_SERVICE_ROLE_KEY não configurada no servidor para despachar para a Cloudflare Queue.");
    return { success: false, enqueuedCount: 0 };
  }

  try {
    const res = await fetch(`${workerUrl}/enqueue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        scheduledPostIds,
        isImmediate: options?.isImmediate,
        delaySeconds: options?.delaySeconds,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Queue Producer] Falha HTTP ${res.status} ao enfileirar:`, errText);
      return { success: false, enqueuedCount: 0 };
    }

    const data = (await res.json()) as any;
    const results = data?.results || [];
    const enqueuedCount = results.filter((r: any) => r.enqueued).length;

    return {
      success: true,
      enqueuedCount,
      results,
    };
  } catch (err: unknown) {
    console.error("[Queue Producer] Erro ao comunicar com Cloudflare Worker:", err);
    return { success: false, enqueuedCount: 0 };
  }
}
