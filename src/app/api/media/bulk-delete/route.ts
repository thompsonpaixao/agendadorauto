import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteMediaObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * POST /api/media/bulk-delete
 * 
 * Exclusão em lote com validação de vínculo e tratamento granular:
 * A) Mídia sem vínculo: excluída normalmente.
 * B) Mídia em fila/pending/scheduled: cancela agendamentos futuros e exclui normalmente.
 * C) Mídia processing/publishing na Meta: PRESERVADA (não falha o lote).
 * D) Mídia já published: excluída do repositório normalmente.
 * 
 * Retorna contadores precisos: deletedCount, preservedCount, message.
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
    const { mediaIds, permanent = false } = body;

    if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "Nenhuma mídia informada para exclusão." },
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

    // 1. Busca todas as mídias pertencentes ao usuário autenticado
    const { data: mediaItems, error: fetchErr } = await supabaseAdmin
      .from("media")
      .select("id, original_name, storage_provider, storage_path, thumbnail_url, published_at, retention_status")
      .in("id", mediaIds)
      .eq("user_id", user.id);

    if (fetchErr || !mediaItems || mediaItems.length === 0) {
      return NextResponse.json(
        { success: false, message: "Nenhuma mídia válida encontrada para este usuário." },
        { status: 404 }
      );
    }

    // 2. Precedência de publicação: busca evidências definitivas de posts já publicados
    const publishedMediaIds = new Set<string>();

    mediaItems.forEach((m) => {
      if (m.published_at || m.retention_status === "eligible_for_deletion") {
        publishedMediaIds.add(m.id);
      }
    });

    const checkPublishedIds = mediaIds.filter((id) => !publishedMediaIds.has(id));
    if (checkPublishedIds.length > 0) {
      const [pubPostsRes, schedPubRes, qItemPubRes] = await Promise.all([
        supabaseAdmin.from("published_posts").select("media_id").in("media_id", checkPublishedIds),
        supabaseAdmin.from("scheduled_posts").select("media_id").in("media_id", checkPublishedIds).eq("status", "published"),
        supabaseAdmin.from("reel_queue_items").select("media_id").in("media_id", checkPublishedIds).eq("status", "published"),
      ]);

      (pubPostsRes.data || []).forEach((p: any) => publishedMediaIds.add(p.media_id));
      (schedPubRes.data || []).forEach((p: any) => publishedMediaIds.add(p.media_id));
      (qItemPubRes.data || []).forEach((p: any) => publishedMediaIds.add(p.media_id));
    }

    // Reconcilia scheduled_posts obsoletos que ficaram como 'processing' para mídias já publicadas
    if (publishedMediaIds.size > 0) {
      await supabaseAdmin
        .from("scheduled_posts")
        .update({ status: "published", updated_at: new Date().toISOString() })
        .in("media_id", Array.from(publishedMediaIds))
        .eq("status", "processing");
    }

    // 3. Busca posts em processamento ativo apenas para mídias NÃO publicadas
    const candidateIds = mediaIds.filter((id) => !publishedMediaIds.has(id));
    const activelyProcessingMediaIds = new Set<string>();

    if (candidateIds.length > 0) {
      const { data: processingPosts } = await supabaseAdmin
        .from("scheduled_posts")
        .select("id, media_id, status, meta_container_id, locked_at, container_created_at, last_container_check_at, created_at, queue_id, reel_queues(status)")
        .in("media_id", candidateIds)
        .eq("status", "processing");

      if (processingPosts && processingPosts.length > 0) {
        const now = Date.now();
        for (const p of processingPosts as any[]) {
          const queueObj = Array.isArray(p.reel_queues) ? p.reel_queues[0] : p.reel_queues;
          const isQueueInactive = queueObj && (queueObj.status === "paused" || queueObj.status === "cancelled" || queueObj.status === "completed");

          const hasFreshLock = p.locked_at && (now - new Date(p.locked_at).getTime() < 5 * 60 * 1000);
          const containerTs = p.container_created_at || p.last_container_check_at || p.created_at;
          const hasFreshContainer = p.meta_container_id && containerTs && (now - new Date(containerTs).getTime() < 15 * 60 * 1000) && !isQueueInactive;

          if (hasFreshLock || hasFreshContainer) {
            activelyProcessingMediaIds.add(p.media_id);
          } else {
            // Reconcilia post stale para 'failed'
            await supabaseAdmin
              .from("scheduled_posts")
              .update({
                status: "failed",
                last_container_status: "EXPIRED",
                error_message: "Processamento expirado ou interrompido",
                updated_at: new Date().toISOString(),
              })
              .eq("id", p.id);
          }
        }
      }
    }

    const deletableMedia = mediaItems.filter((m) => !activelyProcessingMediaIds.has(m.id));
    const preservedMedia = mediaItems.filter((m) => activelyProcessingMediaIds.has(m.id));

    const deletableIds = deletableMedia.map((m) => m.id);
    const blockedIds = preservedMedia.map((m) => m.id);
    const failedIds: string[] = [];

    if (deletableIds.length > 0) {
      // 4. Cancela agendamentos futuros relacionados (scheduled, pending, failed, cancelled)
      const { data: deletedScheduled } = await supabaseAdmin
        .from("scheduled_posts")
        .delete()
        .in("media_id", deletableIds)
        .eq("user_id", user.id)
        .in("status", ["scheduled", "pending", "failed", "cancelled"])
        .select("queue_id");

      // 5. Remove itens de fila relacionados
      const { data: deletedQueueItems } = await supabaseAdmin
        .from("reel_queue_items")
        .delete()
        .in("media_id", deletableIds)
        .eq("user_id", user.id)
        .select("queue_id");

      // 6. Atualiza contadores das filas afetadas
      const affectedQueueIds = new Set<string>();
      (deletedScheduled || []).forEach((s) => {
        if (s.queue_id) affectedQueueIds.add(s.queue_id);
      });
      (deletedQueueItems || []).forEach((q) => {
        if (q.queue_id) affectedQueueIds.add(q.queue_id);
      });

      for (const qId of affectedQueueIds) {
        const { count } = await supabaseAdmin
          .from("reel_queue_items")
          .select("id", { count: "exact", head: true })
          .eq("queue_id", qId);

        if (count !== null) {
          await supabaseAdmin
            .from("reel_queues")
            .update({
              total_videos: count,
              updated_at: new Date().toISOString(),
              ...(count === 0 ? { status: "completed" } : {}),
            })
            .eq("id", qId);
        }
      }

      // 7. Remove referências em carrosséis
      await supabaseAdmin
        .from("carousel_items")
        .delete()
        .in("media_id", deletableIds)
        .eq("user_id", user.id);

      if (!permanent) {
        // Soft-delete: Move para a Lixeira e desativa retenção
        const { error: updErr } = await supabaseAdmin
          .from("media")
          .update({
            deleted_at: new Date().toISOString(),
            retention_status: "eligible_for_deletion",
            updated_at: new Date().toISOString(),
          })
          .in("id", deletableIds)
          .eq("user_id", user.id);

        if (updErr) {
          console.error("[Bulk Delete] Erro ao mover mídias para lixeira:", updErr);
        }
      } else {
        // Exclusão definitiva de R2/Storage e banco
        for (const item of deletableMedia) {
          try {
            await deleteMediaObject({
              storage_provider: item.storage_provider,
              storage_path: item.storage_path,
              thumbnail_url: item.thumbnail_url,
            });
          } catch (storageErr) {
            console.warn(`[Bulk Delete] Erro ao remover storage para ${item.id}:`, storageErr);
          }
        }

        await supabaseAdmin
          .from("media")
          .delete()
          .in("id", deletableIds)
          .eq("user_id", user.id);
      }
    }

    const deletedCount = deletableIds.length;
    const blockedCount = blockedIds.length;
    const failedCount = failedIds.length;

    let message = "";
    if (blockedCount > 0 && deletedCount > 0) {
      message = `${deletedCount} excluído${deletedCount !== 1 ? "s" : ""}. ${blockedCount} não ${blockedCount !== 1 ? "puderam" : "pôde"} ser excluído${blockedCount !== 1 ? "s" : ""} porque está sendo processado pelo Instagram.`;
    } else if (blockedCount > 0 && deletedCount === 0) {
      message = `Nenhum Reel foi excluído. ${blockedCount} arquivo${blockedCount !== 1 ? "s" : ""} está em processamento ativo no Instagram.`;
    } else {
      message = `${deletedCount} Reel${deletedCount !== 1 ? "s" : ""} excluído${deletedCount !== 1 ? "s" : ""} com sucesso.`;
    }

    return NextResponse.json({
      success: true,
      deleted: deletableIds,
      blocked: blockedIds,
      failed: failedIds,
      deletedCount,
      blockedCount,
      failedCount,
      message,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Bulk Delete API] Exceção:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
