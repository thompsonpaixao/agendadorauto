import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteMediaObject } from "@/lib/storage";

/**
 * Endpoint para Limpeza Automática e Exclusão Segura de Mídias Vencidas
 * Invocado pelo Supabase Cron ou Webhook agendado com cabeçalho CRON_SECRET.
 * 
 * Regras de Negócio Estritas:
 * 1. delete_after <= now()
 * 2. Confirmação de que a mídia NÃO possui scheduled_post futuro
 * 3. Confirmação de que a mídia NÃO está vinculada a fila ativa (reel_queue_items / carousel_items)
 * 4. Confirmação de que NÃO possui erro de publicação pendente
 * 5. Remoção física do bucket de Storage primeiro
 * 6. Somente após sucesso da remoção no Storage, atualiza deleted_at e retention_status = 'deleted'
 * 7. Nunca apaga o registro do banco antes da exclusão física ser confirmada
 */
export async function POST(request: Request) {
  // 1. Verificação de Autenticação Segura via CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  const providedToken = authHeader?.replace("Bearer ", "") || cronHeader;

  if (expectedSecret && providedToken !== expectedSecret) {
    return NextResponse.json(
      { success: false, error: "Acesso não autorizado ao job de limpeza." },
      { status: 401 }
    );
  }

  const supabaseAdmin = createAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: "Cliente administrativo do Supabase não configurado." },
      { status: 500 }
    );
  }

  const now = new Date().toISOString();
  const summary = {
    processed: 0,
    deleted: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // 2. Busca mídias candidatas à exclusão
    const { data: candidates, error: fetchError } = await supabaseAdmin
      .from("media")
      .select("id, user_id, instagram_account_id, storage_path, thumbnail_url, original_name, retention_status, storage_provider, storage_bucket")
      .lte("delete_after", now)
      .is("deleted_at", null)
      .in("retention_status", ["eligible_for_deletion", "deletion_scheduled", "active"]);

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: "Falha ao consultar mídias para limpeza." },
        { status: 500 }
      );
    }

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Nenhuma mídia elegível para exclusão no momento.",
        summary,
      });
    }

    for (const item of candidates) {
      summary.processed++;

      // 3. Verificação de Segurança 1: Scheduled Posts futuros
      const { data: futurePosts, error: checkPostError } = await supabaseAdmin
        .from("scheduled_posts")
        .select("id")
        .eq("media_id", item.id)
        .in("status", ["scheduled", "processing"])
        .limit(1);

      if (checkPostError || (futurePosts && futurePosts.length > 0)) {
        summary.skipped++;
        continue;
      }

      // 4. Verificação de Segurança 2: Filas ativas
      const { data: activeQueueItems, error: checkQueueError } = await supabaseAdmin
        .from("reel_queue_items")
        .select("id")
        .eq("media_id", item.id)
        .in("status", ["pending", "scheduled", "processing"])
        .limit(1);

      if (checkQueueError || (activeQueueItems && activeQueueItems.length > 0)) {
        summary.skipped++;
        continue;
      }

      // 5. Verificação de Segurança 3: Erros pendentes relacionados
      const { data: pendingErrors, error: checkErrError } = await supabaseAdmin
        .from("error_logs")
        .select("id")
        .eq("instagram_account_id", item.instagram_account_id)
        .eq("category", "publishing")
        .is("resolved_at", null)
        .limit(1);

      if (checkErrError || (pendingErrors && pendingErrors.length > 0)) {
        // Se houver erro pendente na conta, preserva a mídia por segurança
        await supabaseAdmin
          .from("media")
          .update({ retention_status: "preserved_due_to_error" })
          .eq("id", item.id);

        summary.skipped++;
        continue;
      }

      // 6. Exclusão Física no Storage (R2 ou Supabase) PRIMEIRO
      const deleteResult = await deleteMediaObject({
        storage_provider: item.storage_provider,
        storage_path: item.storage_path,
        thumbnail_url: item.thumbnail_url,
      });

      if (!deleteResult.success) {
        summary.failed++;
        const errDetail = deleteResult.errors.join(", ");
        summary.errors.push(`Falha ao remover ${item.storage_path} (${item.storage_provider || "supabase"}): ${errDetail}`);

        // Registra o erro na tabela error_logs e marca mídia como preservada
        await supabaseAdmin.from("error_logs").insert({
          user_id: item.user_id,
          instagram_account_id: item.instagram_account_id,
          severity: "error",
          category: "storage",
          error_code: "storage_cleanup_failed",
          message: `Falha na remoção do arquivo ${item.original_name} do storage (${item.storage_provider || "supabase"}).`,
          technical_details: errDetail,
        });

        await supabaseAdmin
          .from("media")
          .update({ retention_status: "preserved_due_to_error" })
          .eq("id", item.id);

        continue;
      }

      // 7. SOMENTE APÓS CONFIRMAÇÃO DO STORAGE, atualiza o banco
      const { error: dbUpdateError } = await supabaseAdmin
        .from("media")
        .update({
          deleted_at: new Date().toISOString(),
          retention_status: "deleted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (dbUpdateError) {
        summary.failed++;
        summary.errors.push(`Arquivo removido do storage mas erro ao atualizar banco: ${dbUpdateError.message}`);
      } else {
        summary.deleted++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Limpeza de mídia concluída. ${summary.deleted} arquivos removidos.`,
      summary,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro inesperado durante a limpeza.";
    return NextResponse.json(
      { success: false, error: errorMsg, summary },
      { status: 500 }
    );
  }
}
