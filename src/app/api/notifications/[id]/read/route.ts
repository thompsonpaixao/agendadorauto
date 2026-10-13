import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Endpoint Seguro para Atualização de Leitura de Notificação
 * Método: PATCH /api/notifications/[id]/read
 * 
 * Regras de Segurança:
 * 1. O usuário comum NÃO possui permissão direta de UPDATE via RLS na tabela notifications.
 * 2. Este endpoint valida a sessão autenticada.
 * 3. Confirma estritamente o ownership (auth.uid() = user_id).
 * 4. Altera EXCLUSIVAMENTE a coluna 'read' (true/false), impedindo qualquer alteração de
 *    title, message, type, link ou user_id.
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
      return NextResponse.json(
        { success: false, error: "Não autenticado." },
        { status: 401 }
      );
    }

    const { id: notificationId } = await params;

    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: "ID da notificação é obrigatório." },
        { status: 400 }
      );
    }

    // 1. Confirma ownership da notificação (usuário só pode alterar o status da própria notificação)
    const { data: notification, error: queryError } = await supabase
      .from("notifications")
      .select("id, user_id, read")
      .eq("id", notificationId)
      .eq("user_id", user.id)
      .single();

    if (queryError || !notification) {
      return NextResponse.json(
        { success: false, error: "Notificação não encontrada ou acesso negado." },
        { status: 404 }
      );
    }

    // Lê status desejado do body (padrão: true)
    let readStatus = true;
    try {
      const body = await request.json();
      if (typeof body.read === "boolean") {
        readStatus = body.read;
      }
    } catch {
      // Se body for vazio, assume marcação como lida (read: true)
      readStatus = true;
    }

    // 2. Altera SOMENTE a coluna read através do client administrativo seguro
    const supabaseAdmin = createAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: "Falha na configuração do servidor." },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("notifications")
      .update({ read: readStatus })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Erro ao atualizar status da notificação." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id: notificationId,
      read: readStatus,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Erro interno do servidor.";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
