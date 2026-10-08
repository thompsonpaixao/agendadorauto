import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/reel-queues/[id]/status
 * 
 * Pausa ou reativa uma fila de Reels e seus agendamentos correspondentes.
 */
export async function PATCH(
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
    const body = await request.json();
    const { status } = body;

    if (status !== "active" && status !== "paused") {
      return NextResponse.json(
        { success: false, message: "Status inválido. Use 'active' ou 'paused'." },
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

    // 1. Atualiza a fila
    const { data: queue, error: queueError } = await supabaseAdmin
      .from("reel_queues")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", queueId)
      .eq("user_id", user.id)
      .select("id, status")
      .single();

    if (queueError || !queue) {
      return NextResponse.json(
        { success: false, message: "Fila não encontrada ou não autorizada." },
        { status: 404 }
      );
    }

    // 2. Se pausado, cancela agendamentos pendentes; se reativado, restaura para 'scheduled'
    if (status === "paused") {
      await supabaseAdmin
        .from("scheduled_posts")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("queue_id", queueId)
        .eq("status", "scheduled")
        .eq("user_id", user.id);
    } else {
      await supabaseAdmin
        .from("scheduled_posts")
        .update({ status: "scheduled", updated_at: new Date().toISOString() })
        .eq("queue_id", queueId)
        .eq("status", "cancelled")
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      success: true,
      message: `Fila ${status === "paused" ? "pausada" : "reativada"} com sucesso.`,
      status: queue.status,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido ao alterar status da fila.";
    console.error("[Reel Queue Status PATCH] Exceção:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
