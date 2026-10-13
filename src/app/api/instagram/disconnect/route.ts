import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Usuário não autenticado." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { accountId } = body;

    if (!accountId || typeof accountId !== "string") {
      return NextResponse.json(
        { success: false, message: "ID da conta não fornecido ou inválido." },
        { status: 400 }
      );
    }

    // 1. Verifica se a conta pertence ao usuário autenticado
    const { data: account, error: fetchError } = await supabase
      .from("instagram_accounts")
      .select("id, username, user_id")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !account) {
      return NextResponse.json(
        { success: false, message: "Conta não encontrada ou sem permissão para desconectar." },
        { status: 404 }
      );
    }

    const supabaseAdmin = createAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Erro de configuração do servidor administrativo." },
        { status: 500 }
      );
    }

    // 2. Remove o token do cofre criptográfico instagram_account_secrets
    await supabaseAdmin
      .from("instagram_account_secrets")
      .delete()
      .eq("instagram_account_id", accountId)
      .eq("user_id", user.id);

    // 3. Atualiza status da conta para 'disconnected'
    const { error: updateError } = await supabaseAdmin
      .from("instagram_accounts")
      .update({
        status: "disconnected",
        token_status: "unknown",
        has_publish_permission: false,
        status_message: "Conta desconectada pelo usuário em " + new Date().toLocaleDateString("pt-BR"),
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { success: false, message: "Falha ao atualizar status da conta no banco de dados." },
        { status: 500 }
      );
    }

    // 4. Cancela quaisquer publicações agendadas pendentes
    await supabaseAdmin
      .from("scheduled_posts")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("instagram_account_id", accountId)
      .eq("user_id", user.id)
      .eq("status", "scheduled");

    return NextResponse.json({
      success: true,
      message: `Conta @${account.username} desconectada com sucesso. Token da Meta removido e agendamentos futuros cancelados.`,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      { success: false, message: "Erro interno ao processar a desconexão: " + errorMsg },
      { status: 500 }
    );
  }
}
