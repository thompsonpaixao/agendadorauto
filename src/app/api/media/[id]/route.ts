import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteMediaObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/media/[id]
 * 
 * Exclusão segura de mídia do repositório:
 * 1. Valida posse da mídia pelo user_id autenticado.
 * 2. Valida regras de retenção (impede exclusão se estiver em fila ativa ou post futuro).
 * 3. Remove os arquivos físicos do Supabase Storage.
 * 4. Remove o registro do banco de dados em public.media.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Não autenticado." }, { status: 401 });
    }

    const { id: mediaId } = await params;

    if (!mediaId) {
      return NextResponse.json({ success: false, message: "ID da mídia obrigatório." }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Servidor administrativo não configurado." },
        { status: 500 }
      );
    }

    // 1. Busca a mídia e valida ownership
    const { data: mediaItem, error: fetchError } = await supabaseAdmin
      .from("media")
      .select("id, user_id, storage_path, thumbnail_url, original_name, storage_provider, storage_bucket, published_at, retention_status")
      .eq("id", mediaId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !mediaItem) {
      return NextResponse.json({ success: false, message: "Mídia não encontrada." }, { status: 404 });
    }

    // 2. Precedência de status: se houver qualquer evidência definitiva de que o Reel já foi publicado,
    // ele NUNCA deve ser bloqueado por processing obsoleto/stale.
    let isDefinitelyPublished = Boolean(
      mediaItem.published_at ||
      mediaItem.retention_status === "eligible_for_deletion"
    );

    if (!isDefinitelyPublished) {
      const { data: pubPost } = await supabaseAdmin
        .from("published_posts")
        .select("id")
        .eq("media_id", mediaId)
        .limit(1)
        .maybeSingle();

      if (pubPost) isDefinitelyPublished = true;
    }

    if (!isDefinitelyPublished) {
      const { data: schedPub } = await supabaseAdmin
        .from("scheduled_posts")
        .select("id")
        .eq("media_id", mediaId)
        .eq("status", "published")
        .limit(1)
        .maybeSingle();

      if (schedPub) isDefinitelyPublished = true;
    }

    if (!isDefinitelyPublished) {
      const { data: qItemPub } = await supabaseAdmin
        .from("reel_queue_items")
        .select("id")
        .eq("media_id", mediaId)
        .eq("status", "published")
        .limit(1)
        .maybeSingle();

      if (qItemPub) isDefinitelyPublished = true;
    }

    if (isDefinitelyPublished) {
      // Reconcilia scheduled_posts que tenham ficado como 'processing' por descompasso
      await supabaseAdmin
        .from("scheduled_posts")
        .update({ status: "published", updated_at: new Date().toISOString() })
        .eq("media_id", mediaId)
        .eq("status", "processing");
    }

    // 3. Verifica se a mídia está REALMENTE em processamento ativo na Meta
    let isActivelyProcessing = false;

    if (!isDefinitelyPublished) {
      const { data: processingPosts } = await supabaseAdmin
        .from("scheduled_posts")
        .select("id, status, meta_container_id, locked_at, container_created_at, last_container_check_at, created_at, queue_id, reel_queues(status)")
        .eq("media_id", mediaId)
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
            isActivelyProcessing = true;
            break;
          } else {
            // Post em processing stale: reconcilia imediatamente para 'failed'
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

      if (!isActivelyProcessing) {
        const { data: carouselRefs } = await supabaseAdmin
          .from("carousel_items")
          .select("id, carousels!inner(status, updated_at)")
          .eq("media_id", mediaId);

        const isProcessingCarousel = carouselRefs?.some((ci: any) => {
          const status = ci.carousels?.status;
          if (status === "processing" || status === "publishing") {
            const updatedAge = ci.carousels?.updated_at ? Date.now() - new Date(ci.carousels.updated_at).getTime() : 0;
            return updatedAge < 15 * 60 * 1000;
          }
          return false;
        });

        if (isProcessingCarousel) {
          isActivelyProcessing = true;
        }
      }
    }

    if (isActivelyProcessing) {
      return NextResponse.json(
        {
          success: false,
          message: "Este Reel já está sendo processado pelo Instagram. Aguarde a publicação terminar antes de excluí-lo.",
        },
        { status: 409 }
      );
    }

    // 4. Cancela/remove agendamentos futuros ou pendentes relacionados (scheduled, pending, failed, cancelled)
    // Preserva integralmente posts 'published' para histórico e auditoria
    const { data: deletedScheduled } = await supabaseAdmin
      .from("scheduled_posts")
      .delete()
      .eq("media_id", mediaId)
      .eq("user_id", user.id)
      .in("status", ["scheduled", "pending", "failed", "cancelled"])
      .select("id, queue_id");

    // 4. Cancela/remove itens de fila relacionados
    const { data: deletedQueueItems } = await supabaseAdmin
      .from("reel_queue_items")
      .delete()
      .eq("media_id", mediaId)
      .eq("user_id", user.id)
      .select("id, queue_id");

    // 5. Atualiza contadores das filas afetadas
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

    // 6. Remove referências em carrosséis rascunho se aplicável
    await supabaseAdmin
      .from("carousel_items")
      .delete()
      .eq("media_id", mediaId)
      .eq("user_id", user.id);

    const { searchParams } = new URL(request.url);
    const isPermanent = searchParams.get("permanent") === "true";

    if (!isPermanent) {
      // Soft-delete: Move para a Lixeira e desativa retenção de fila
      const { error: updateError } = await supabaseAdmin
        .from("media")
        .update({
          deleted_at: new Date().toISOString(),
          retention_status: "eligible_for_deletion",
          updated_at: new Date().toISOString(),
        })
        .eq("id", mediaId)
        .eq("user_id", user.id);

      if (updateError) {
        return NextResponse.json(
          { success: false, message: `Erro ao mover mídia para a Lixeira: ${updateError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Mídia "${mediaItem.original_name}" movida para a Lixeira com sucesso.`,
        cancelledScheduledCount: deletedScheduled?.length || 0,
        cancelledQueueItemsCount: deletedQueueItems?.length || 0,
      });
    }

    // 7. Exclusão permanente: Remove arquivos físicos do Storage (R2 ou Supabase)
    await deleteMediaObject({
      storage_provider: mediaItem.storage_provider,
      storage_path: mediaItem.storage_path,
      thumbnail_url: mediaItem.thumbnail_url,
    });

    // 8. Remove registro permanentemente do banco
    const { error: deleteError } = await supabaseAdmin
      .from("media")
      .delete()
      .eq("id", mediaId)
      .eq("user_id", user.id);

    if (deleteError) {
      return NextResponse.json(
        { success: false, message: `Erro ao excluir registro no banco: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Mídia "${mediaItem.original_name}" excluída permanentemente.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Media Delete API] Exceção:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
