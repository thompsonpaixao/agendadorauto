import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueScheduledPosts } from "@/lib/queue/producer";

export const dynamic = "force-dynamic";

/**
 * POST /api/reel-queues/bulk-action
 * 
 * Executa ações em lote nas filas:
 * - pause_all: Pausa todas as filas ativas (do perfil especificado ou globais do usuário).
 * - resume_all: Retoma todas as filas pausadas (do perfil especificado ou globais do usuário) e enfileira posts <= 24h.
 * - delete_all: Exclui todas as filas não concluídas e cancela agendamentos futuros (preserva mídias e posts publicados).
 * - delete_finished: Exclui apenas filas finalizadas/canceladas (preserva histórico).
 * - pause_selected / resume_selected / cancel_selected / delete_selected: Ações em lista específica de queueIds.
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
    const { accountId, queueIds: rawQueueIds, action } = body;

    const validActions = [
      "pause_all",
      "resume_all",
      "delete_all",
      "delete_finished",
      "pause_selected",
      "resume_selected",
      "cancel_selected",
      "delete_selected",
      // Aliases amigáveis
      "pause",
      "resume",
      "cancel",
      "delete",
    ];

    if (!validActions.includes(action)) {
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
    const selectedIds: string[] = Array.isArray(rawQueueIds) ? rawQueueIds.filter(Boolean) : [];

    // =========================================================================
    // 1. AÇÕES EM FILAS SELECIONADAS (queueIds)
    // =========================================================================
    if (
      selectedIds.length > 0 &&
      ["pause_selected", "resume_selected", "cancel_selected", "delete_selected", "pause", "resume", "cancel", "delete"].includes(action)
    ) {
      // 1.1 PAUSAR SELECIONADAS
      if (action === "pause_selected" || action === "pause") {
        const { data, error } = await supabaseAdmin
          .from("reel_queues")
          .update({ status: "paused", updated_at: nowIso })
          .eq("user_id", user.id)
          .in("id", selectedIds)
          .select("id");

        if (error) {
          return NextResponse.json({ success: false, message: error.message }, { status: 500 });
        }

        const affected = (data || []).map((q) => q.id);
        if (affected.length > 0) {
          await supabaseAdmin
            .from("scheduled_posts")
            .update({ status: "cancelled", queue_status: null, updated_at: nowIso })
            .in("queue_id", affected)
            .eq("status", "scheduled")
            .eq("user_id", user.id);
        }

        return NextResponse.json({
          success: true,
          message: `${affected.length} fila(s) selecionada(s) foram pausadas com sucesso.`,
          affectedCount: affected.length,
        });
      }

      // 1.2 RETOMAR SELECIONADAS
      if (action === "resume_selected" || action === "resume") {
        const { data, error } = await supabaseAdmin
          .from("reel_queues")
          .update({ status: "active", updated_at: nowIso })
          .eq("user_id", user.id)
          .in("id", selectedIds)
          .select("id");

        if (error) {
          return NextResponse.json({ success: false, message: error.message }, { status: 500 });
        }

        const affected = (data || []).map((q) => q.id);
        if (affected.length > 0) {
          const { data: restoredPosts } = await supabaseAdmin
            .from("scheduled_posts")
            .update({ status: "scheduled", queue_status: null, updated_at: nowIso })
            .in("queue_id", affected)
            .eq("status", "cancelled")
            .eq("user_id", user.id)
            .select("id");

          const postIds = (restoredPosts || []).map((p) => p.id);
          if (postIds.length > 0) {
            try {
              await enqueueScheduledPosts(postIds);
            } catch (err) {
              console.error("[Bulk Action] Erro ao enfileirar posts retomados:", err);
            }
          }
        }

        return NextResponse.json({
          success: true,
          message: `${affected.length} fila(s) selecionada(s) foram retomadas com sucesso.`,
          affectedCount: affected.length,
        });
      }

      // 1.3 CANCELAR SELECIONADAS
      if (action === "cancel_selected" || action === "cancel") {
        const { data, error } = await supabaseAdmin
          .from("reel_queues")
          .update({ status: "cancelled", updated_at: nowIso })
          .eq("user_id", user.id)
          .in("id", selectedIds)
          .select("id");

        if (error) {
          return NextResponse.json({ success: false, message: error.message }, { status: 500 });
        }

        const affected = (data || []).map((q) => q.id);
        if (affected.length > 0) {
          await supabaseAdmin
            .from("scheduled_posts")
            .update({ status: "cancelled", queue_status: null, updated_at: nowIso })
            .in("queue_id", affected)
            .eq("status", "scheduled")
            .eq("user_id", user.id);
        }

        return NextResponse.json({
          success: true,
          message: `${affected.length} fila(s) selecionada(s) foram canceladas com sucesso.`,
          affectedCount: affected.length,
        });
      }

      // 1.4 EXCLUIR SELECIONADAS
      if (action === "delete_selected" || action === "delete") {
        const { data: qItemsToDelete } = await supabaseAdmin
          .from("reel_queue_items")
          .select("media_id")
          .in("queue_id", selectedIds)
          .eq("user_id", user.id);

        const affectedMediaIds = (qItemsToDelete || []).map((qi) => qi.media_id).filter(Boolean);

        // Cancela agendamentos vinculados
        await supabaseAdmin
          .from("scheduled_posts")
          .delete()
          .in("queue_id", selectedIds)
          .eq("user_id", user.id)
          .in("status", ["scheduled", "pending", "processing", "failed", "cancelled"]);

        // Remove itens
        await supabaseAdmin
          .from("reel_queue_items")
          .delete()
          .in("queue_id", selectedIds)
          .eq("user_id", user.id);

        // Remove filas
        const { error: delErr } = await supabaseAdmin
          .from("reel_queues")
          .delete()
          .in("id", selectedIds)
          .eq("user_id", user.id);

        if (delErr) {
          return NextResponse.json({ success: false, message: delErr.message }, { status: 500 });
        }

        // Libera status de retenção das mídias desvinculadas (sem apagar R2)
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
          message: `${selectedIds.length} fila(s) selecionada(s) foram excluídas com sucesso.`,
          affectedCount: selectedIds.length,
        });
      }
    }

    // =========================================================================
    // 2. AÇÕES GLOBAIS OU POR CONTA (pause_all, resume_all, delete_all, delete_finished)
    // =========================================================================
    const isSpecificAccount = accountId && accountId !== "all";

    if (action === "pause_all") {
      let query = supabaseAdmin
        .from("reel_queues")
        .update({ status: "paused", updated_at: nowIso })
        .eq("user_id", user.id)
        .eq("status", "active");

      if (isSpecificAccount) {
        query = query.eq("instagram_account_id", accountId);
      }

      const { data, error } = await query.select("id");

      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
      }

      const affected = (data || []).map((q) => q.id);
      if (affected.length > 0) {
        await supabaseAdmin
          .from("scheduled_posts")
          .update({ status: "cancelled", queue_status: null, updated_at: nowIso })
          .in("queue_id", affected)
          .eq("status", "scheduled")
          .eq("user_id", user.id);
      }

      return NextResponse.json({
        success: true,
        message: `${affected.length} fila(s) ativa(s) foram pausadas com sucesso.`,
        affectedCount: affected.length,
      });
    }

    if (action === "resume_all") {
      let query = supabaseAdmin
        .from("reel_queues")
        .update({ status: "active", updated_at: nowIso })
        .eq("user_id", user.id)
        .eq("status", "paused");

      if (isSpecificAccount) {
        query = query.eq("instagram_account_id", accountId);
      }

      const { data, error } = await query.select("id");

      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
      }

      const affected = (data || []).map((q) => q.id);
      if (affected.length > 0) {
        const { data: restoredPosts } = await supabaseAdmin
          .from("scheduled_posts")
          .update({ status: "scheduled", queue_status: null, updated_at: nowIso })
          .in("queue_id", affected)
          .eq("status", "cancelled")
          .eq("user_id", user.id)
          .select("id");

        const postIds = (restoredPosts || []).map((p) => p.id);
        if (postIds.length > 0) {
          try {
            await enqueueScheduledPosts(postIds);
          } catch (err) {
            console.error("[Bulk Action] Erro ao enfileirar posts retomados:", err);
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `${affected.length} fila(s) pausada(s) foram reativadas com sucesso.`,
        affectedCount: affected.length,
      });
    }

    if (action === "delete_all") {
      let query = supabaseAdmin
        .from("reel_queues")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["active", "paused", "draft", "error"]);

      if (isSpecificAccount) {
        query = query.eq("instagram_account_id", accountId);
      }

      const { data: targetQueues, error: qErr } = await query;

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

      const { data: qItemsToDelete } = await supabaseAdmin
        .from("reel_queue_items")
        .select("media_id")
        .in("queue_id", queueIds)
        .eq("user_id", user.id);

      const affectedMediaIds = (qItemsToDelete || []).map((qi) => qi.media_id).filter(Boolean);

      await supabaseAdmin
        .from("scheduled_posts")
        .delete()
        .in("queue_id", queueIds)
        .eq("user_id", user.id)
        .in("status", ["scheduled", "pending", "processing", "failed", "cancelled"]);

      await supabaseAdmin
        .from("reel_queue_items")
        .delete()
        .in("queue_id", queueIds)
        .eq("user_id", user.id);

      const { error: delErr } = await supabaseAdmin
        .from("reel_queues")
        .delete()
        .in("id", queueIds)
        .eq("user_id", user.id);

      if (delErr) {
        return NextResponse.json({ success: false, message: delErr.message }, { status: 500 });
      }

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
      let query = supabaseAdmin
        .from("reel_queues")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["completed", "cancelled"]);

      if (isSpecificAccount) {
        query = query.eq("instagram_account_id", accountId);
      }

      const { data: finishedQueues, error: fErr } = await query;

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

      const { data: finItemsToDelete } = await supabaseAdmin
        .from("reel_queue_items")
        .select("media_id")
        .in("queue_id", finishedIds)
        .eq("user_id", user.id);

      const affectedFinMediaIds: string[] = (finItemsToDelete || []).map((qi: any) => qi.media_id).filter(Boolean);

      await supabaseAdmin
        .from("scheduled_posts")
        .delete()
        .in("queue_id", finishedIds)
        .eq("user_id", user.id)
        .in("status", ["scheduled", "pending", "processing", "failed", "cancelled"]);

      await supabaseAdmin
        .from("reel_queue_items")
        .delete()
        .in("queue_id", finishedIds)
        .eq("user_id", user.id);

      const { error: delFinErr } = await supabaseAdmin
        .from("reel_queues")
        .delete()
        .in("id", finishedIds)
        .eq("user_id", user.id);

      if (delFinErr) {
        return NextResponse.json({ success: false, message: delFinErr.message }, { status: 500 });
      }

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
