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

    const body = await request.json().catch(() => ({}));
    const { confirmation } = body;

    if (confirmation !== "EXCLUIR_DEFINITIVAMENTE") {
      return NextResponse.json(
        { success: false, message: "Texto de confirmação inválido." },
        { status: 400 }
      );
    }

    const userId = user.id;
    const supabaseAdmin = createAdminClient();
    const admin = supabaseAdmin || supabase;

    // 1. Remove em cascata todos os dados privados do usuário autenticado
    // (Respeitando a ordem de chaves estrangeiras)
    await Promise.all([
      supabase.from("carousel_items").delete().eq("user_id", userId),
      supabase.from("scheduled_posts").delete().eq("user_id", userId),
      supabase.from("published_posts").delete().eq("user_id", userId),
      supabase.from("error_logs").delete().eq("user_id", userId),
      supabase.from("notifications").delete().eq("user_id", userId),
      supabase.from("analytics").delete().eq("user_id", userId),
    ]);

    await Promise.all([
      admin.from("instagram_account_secrets").delete().eq("user_id", userId),
      admin.from("instagram_accounts").delete().eq("user_id", userId),
      supabase.from("carousels").delete().eq("user_id", userId),
      supabase.from("reel_queues").delete().eq("user_id", userId),
      supabase.from("media").delete().eq("user_id", userId),
    ]);

    // 2. Remove o perfil do usuário
    await supabase.from("profiles").delete().eq("id", userId);

    // 3. Encerra a sessão ativa do usuário
    await supabase.auth.signOut();

    return NextResponse.json({
      success: true,
      message: "Conta e todos os dados associados foram excluídos definitivamente do AgendadorAuto.",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Erro interno ao processar a exclusão da conta." },
      { status: 500 }
    );
  }
}
