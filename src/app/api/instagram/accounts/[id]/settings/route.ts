import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/instagram/accounts/[id]/settings
 * 
 * Atualiza configurações de agendamento (quantidade diária, horários separados de Reels e Carrosséis,
 * legendas padrão e janela anti-detecção) com proteção estrita contra escalação de privilégios.
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

    const { id: accountId } = await params;
    const body = await request.json();

    const supabaseAdmin = createAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Servidor administrativo não configurado." },
        { status: 500 }
      );
    }

    // 1. Valida se a conta pertence ao usuário
    const { data: account, error: accountError } = await supabaseAdmin
      .from("instagram_accounts")
      .select("id, user_id")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { success: false, message: "Conta não encontrada ou não autorizada." },
        { status: 404 }
      );
    }

    // 2. Prepara payload estritamente sanitizado (whitelist de campos permitidos)
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.defaultReelCaption === "string") {
      updateData.default_reel_caption = body.defaultReelCaption;
    }
    if (typeof body.defaultCarouselCaption === "string") {
      updateData.default_carousel_caption = body.defaultCarouselCaption;
    }
    if (typeof body.defaultReelsPerDay === "number") {
      updateData.posts_per_day = Math.max(1, Math.min(20, body.defaultReelsPerDay));
    }
    if (Array.isArray(body.defaultTimes)) {
      updateData.default_post_times = body.defaultTimes;
    }
    if (typeof body.defaultCarouselsPerDay === "number") {
      updateData.default_carousels_per_day = Math.max(1, Math.min(10, body.defaultCarouselsPerDay));
    }
    if (Array.isArray(body.defaultCarouselTimes)) {
      updateData.default_carousel_post_times = body.defaultCarouselTimes;
    }
    if (typeof body.useRandomTimeVariation === "boolean") {
      updateData.use_random_time_variation = body.useRandomTimeVariation;
    }
    if (typeof body.randomVariationMinutes === "number") {
      updateData.random_variation_minutes = Math.max(0, Math.min(60, body.randomVariationMinutes));
    }

    const { error: updateError } = await supabaseAdmin
      .from("instagram_accounts")
      .update(updateData)
      .eq("id", accountId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[Account Settings PATCH] Erro ao atualizar:", updateError);
      return NextResponse.json(
        { success: false, message: `Falha ao salvar configurações: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Configurações da conta salvas com sucesso no banco de dados.",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Account Settings API] Exceção:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
