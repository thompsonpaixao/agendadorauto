import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/reel-queues/bulk-action
 * 
 * Executa ações em lote nas filas de uma conta específica:
 * - pause_all: Pausa todas as filas ativas do perfil.
 * - resume_all: Retoma todas as filas pausadas do perfil.
 * - delete_all: Exclui todas as filas não concluídas e cancela agendamentos futuros (preserva mídias e posts publicados).
 * - delete_finished: Exclui apenas filas finalizadas/canceladas (preserva histórico).
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
    const { accountId, action } = body;

    if (!accountId) {
      return NextResponse.json(
        { success: false, message: "accountId é obrigatório para ações em massa." },
        { status: 400 }
      );
    }

    if (!["pause_all", "resume_all", "delete_all", "delete_finished"].includes(action)) {
      return NextResponse.json(
        { success: false, message: `Ação inválida: ${action}` },
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

    const nowIso = new Date().toISOString();

    if (action === "pause_all") {
      const { data, error } = await supabaseAdmin
        .from("reel_queues")
        .update({ status: "paused", updated_at: nowIso })
        .eq("user_id", user.id)
        .eq("instagram_account_id", accountId)
        .eq("status", "active")
        .select("id");

      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `${data?.length || 0} fila(s) ativa(s) foram pausadas com sucesso.`,
        affectedCount: data?.length || 0,
      });
    }

    if (action === "resume_all") {
      const { data, error } = await supabaseAdmin
        .from("reel_queues")
        .update({ status: "active", updated_at: nowIso })
        .eq("user_id", user.id)
        .eq("instagram_account_id", accountId)
        .eq("status", "paused")
        .select("id");

      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `${data?.length || 0} fila(s) pausada(s) foram reativadas com sucesso.`,
        affectedCount: data?.length || 0,
      });
    }

    if (action === "delete_all") {
      // Busca todas as filas ativas/pausadas/draft da conta
      const { data: targetQueues, error: qErr } = await supabaseAdmin
        .from("reel_queues")
        .select("id")
        .eq("user_id", user.id)
        .eq("instagram_account_id", accountId)
        .in("status", ["active", "paused", "draft", "error"]);

      if (qErr) {
        return NextResponse.json({ success: false, message: qErr.message }, { status: 500 });
      }

      const queueIds = (targetQueues || []).map((q) => q.id);
      if (queueIds.length === 0) {
        return NextResponse.json({
          success: true,
          message: "Nenhuma fila ativa encontrada para exclusão.",
          affectedCount: 0,
        });
      }

      // Localiza mídias associadas antes da exclusão
      const { data: qItemsToDelete } = await supabaseAdmin
        .from("reel_queue_items")
        .select("media_id")
        .in("queue_id", queueIds)
        .eq("user_id", user.id);

      const affectedMediaIds = (qItemsToDelete || []).map((qi) => qi.media_id).filter(Boolean);

      // Cancela agendamentos vinculados a essas filas (scheduled, pending, processing, failed, cancelled)
      await supabaseAdmin
        .from("scheduled_posts")
        .delete()
        .in("queue_id", queueIds)
        .eq("user_id", user.id)
        .in("status", ["scheduled", "pending", "processing", "failed", "cancelled"]);

      // Deleta itens das filas
      await supabaseAdmin
        .from("reel_queue_items")
        .delete()
        .in("queue_id", queueIds)
        .eq("user_id", user.id);

      // Deleta as filas
      const { error: delErr } = await supabaseAdmin
        .from("reel_queues")
        .delete()
        .in("id", queueIds)
        .eq("user_id", user.id);

      if (delErr) {
        return NextResponse.json({ success: false, message: delErr.message }, { status: 500 });
      }

      // Libera status de retenção das mídias desvinculadas
      if (affectedMediaIds.length > 0) {
        const { data: remainingItems } = await supabaseAdmin
          .from("reel_queue_items")
          .select("media_id")
          .in("media_id", affectedMediaIds)
          .in("status", ["pending", "scheduled", "processing"]);

        const stillQueuedIds = new Set((remainingItems || []).map((r) => r.media_id));
        const freedIds = affectedMediaIds.filter((mId) => !stillQueuedIds.has(mId));

        if (freedIds.length > 0) {
          await supabaseAdmin
            .from("media")
            .update({ retention_status: "active", updated_at: nowIso })
            .in("id", freedIds)
            .eq("user_id", user.id)
            .eq("retention_status", "waiting_publication");
        }
      }

      return NextResponse.json({
        success: true,
        message: `${queueIds.length} fila(s) e seus agendamentos futuros foram excluídos com sucesso. Mídias e publicações anteriores foram mantidas.`,
        affectedCount: queueIds.length,
      });
    }

    if (action === "delete_finished") {
      // Busca filas concluídas ou canceladas
      const { data: finishedQueues, error: fErr } = await supabaseAdmin
        .from("reel_queues")
        .select("id")
        .eq("user_id", user.id)
        .eq("instagram_account_id", accountId)
        .in("status", ["completed", "cancelled"]);

      if (fErr) {
        return NextResponse.json({ success: false, message: fErr.message }, { status: 500 });
      }

      const finishedIds = (finishedQueues || []).map((q) => q.id);
      if (finishedIds.length === 0) {
        return NextResponse.json({
          success: true,
          message: "Nenhuma fila finalizada encontrada para limpeza.",
          affectedCount: 0,
        });
      }

      // Localiza mídias associadas antes da exclusão
      const { data: finItemsToDelete } = await supabaseAdmin
        .from("reel_queue_items")
        .select("media_id")
        .in("queue_id", finishedIds)
        .eq("user_id", user.id);

      const affectedFinMediaIds: string[] = (finItemsToDelete || []).map((qi: any) => qi.media_id).filter(Boolean);

      // Cancela agendamentos remanescentes dessas filas
      await supabaseAdmin
        .from("scheduled_posts")
        .delete()
        .in("queue_id", finishedIds)
        .eq("user_id", user.id)
        .in("status", ["scheduled", "pending", "processing", "failed", "cancelled"]);

      // Remove itens
      await supabaseAdmin
        .from("reel_queue_items")
        .delete()
        .in("queue_id", finishedIds)
        .eq("user_id", user.id);

      // Remove filas finalizadas
      const { error: delFinErr } = await supabaseAdmin
        .from("reel_queues")
        .delete()
        .in("id", finishedIds)
        .eq("user_id", user.id);

      if (delFinErr) {
        return NextResponse.json({ success: false, message: delFinErr.message }, { status: 500 });
      }

      // Libera status de retenção das mídias desvinculadas
      if (affectedFinMediaIds.length > 0) {
        const { data: remainingFinItems } = await supabaseAdmin
          .from("reel_queue_items")
          .select("media_id")
          .in("media_id", affectedFinMediaIds)
          .in("status", ["pending", "scheduled", "processing"]);

        const stillQueuedFinIds = new Set((remainingFinItems || []).map((r: any) => r.media_id));
        const freedFinIds = affectedFinMediaIds.filter((mId: string) => !stillQueuedFinIds.has(mId));

        if (freedFinIds.length > 0) {
          await supabaseAdmin
            .from("media")
            .update({ retention_status: "active", updated_at: nowIso })
            .in("id", freedFinIds)
            .eq("user_id", user.id)
            .eq("retention_status", "waiting_publication");
        }
      }

      return NextResponse.json({
        success: true,
        message: `${finishedIds.length} fila(s) finalizada(s) foram limpas com sucesso. Histórico de publicações preservado.`,
        affectedCount: finishedIds.length,
      });
    }

    return NextResponse.json({ success: false, message: "Ação não processada." }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Reel Queues Bulk API] Exceção:", message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
