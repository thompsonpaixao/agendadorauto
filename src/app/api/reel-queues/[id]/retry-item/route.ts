import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishScheduledPost } from "@/lib/instagram/publisher";

export const dynamic = "force-dynamic";

/**
 * POST /api/reel-queues/[id]/retry-item
 * 
 * Executa uma nova tentativa para um item com falha de uma fila de Reels:
 * - action = "publish_now": Dispara a publicação imediata via Meta API.
 * - action = "reschedule": Cria novo agendamento seguro em scheduled_posts.
 * 
 * Preserva integralmente o histórico de falhas anteriores (error_logs e publication_attempts).
 */
export async function POST(
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

    const { id: queueId } = await params;
    if (!queueId) {
      return NextResponse.json({ success: false, message: "ID da fila obrigatório." }, { status: 400 });
    }

    const body = await request.json();
    const { queueItemId, action = "publish_now", scheduledAt } = body;

    if (!queueItemId) {
      return NextResponse.json({ success: false, message: "queueItemId é obrigatório." }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Servidor administrativo não configurado." },
        { status: 500 }
      );
    }

    // 1. Valida que a fila pertence ao usuário
    const { data: queue, error: queueError } = await supabaseAdmin
      .from("reel_queues")
      .select("id, user_id, instagram_account_id, name, custom_caption")
      .eq("id", queueId)
      .eq("user_id", user.id)
      .single();

    if (queueError || !queue) {
      return NextResponse.json({ success: false, message: "Fila não encontrada." }, { status: 404 });
    }

    // 2. Valida o item da fila
    const { data: queueItem, error: itemError } = await supabaseAdmin
      .from("reel_queue_items")
      .select("id, queue_id, media_id, custom_caption, status, position")
      .eq("id", queueItemId)
      .eq("queue_id", queueId)
      .eq("user_id", user.id)
      .single();

    if (itemError || !queueItem) {
      return NextResponse.json({ success: false, message: "Item da fila não encontrado." }, { status: 404 });
    }

    // 3. Valida a mídia
    const { data: media, error: mediaError } = await supabaseAdmin
      .from("media")
      .select("id, original_name, storage_path")
      .eq("id", queueItem.media_id)
      .eq("user_id", user.id)
      .single();

    if (mediaError || !media) {
      return NextResponse.json({ success: false, message: "Mídia do item não encontrada." }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const finalCaption = queueItem.custom_caption || queue.custom_caption || "";

    if (action === "publish_now") {
      // 4a. Cria novo agendamento com status processing para disparo imediato
      const { data: newPost, error: insertError } = await supabaseAdmin
        .from("scheduled_posts")
        .insert({
          user_id: user.id,
          instagram_account_id: queue.instagram_account_id,
          post_type: "reel",
          media_id: queueItem.media_id,
          caption: finalCaption,
          scheduled_at: nowIso,
          status: "processing",
          locked_at: nowIso,
          locked_by: "retry-publish-now",
          queue_id: queue.id,
          queue_item_id: queueItem.id,
        })
        .select("id")
        .single();

      if (insertError || !newPost) {
        console.error("[Retry Item] Erro ao criar novo agendamento:", insertError);
        return NextResponse.json(
          { success: false, message: `Falha ao registrar nova tentativa: ${insertError?.message}` },
          { status: 500 }
        );
      }

      // Atualiza o item da fila para processing
      await supabaseAdmin
        .from("reel_queue_items")
        .update({ status: "processing", updated_at: nowIso })
        .eq("id", queueItem.id);

      // Reativa a fila se estava completed_with_errors
      await supabaseAdmin
        .from("reel_queues")
        .update({ status: "active", updated_at: nowIso })
        .eq("id", queue.id);

      // Dispara a publicação oficial pela Meta
      const result = await publishScheduledPost(newPost.id);

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            message: result.error || "Erro retornado pela Meta ao publicar o Reel.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Reel republicado com sucesso no Instagram!",
        permalink: result.permalink,
      });
    } else {
      // 4b. Reagendar para horário futuro
      const targetScheduledAt = scheduledAt || new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { data: newPost, error: insertError } = await supabaseAdmin
        .from("scheduled_posts")
        .insert({
          user_id: user.id,
          instagram_account_id: queue.instagram_account_id,
          post_type: "reel",
          media_id: queueItem.media_id,
          caption: finalCaption,
          scheduled_at: targetScheduledAt,
          status: "scheduled",
          queue_id: queue.id,
          queue_item_id: queueItem.id,
        })
        .select("id")
        .single();

      if (insertError || !newPost) {
        console.error("[Retry Item] Erro ao reagendar post:", insertError);
        return NextResponse.json(
          { success: false, message: `Falha ao reagendar: ${insertError?.message}` },
          { status: 500 }
        );
      }

      // Atualiza o item da fila para scheduled
      await supabaseAdmin
        .from("reel_queue_items")
        .update({ status: "scheduled", updated_at: nowIso })
        .eq("id", queueItem.id);

      // Reativa a fila para active
      await supabaseAdmin
        .from("reel_queues")
        .update({ status: "active", updated_at: nowIso })
        .eq("id", queue.id);

      return NextResponse.json({
        success: true,
        message: "Item reagendado com sucesso!",
        scheduledAt: targetScheduledAt,
      });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Retry Item API] Exceção:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
