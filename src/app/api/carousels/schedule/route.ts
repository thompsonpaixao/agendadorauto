import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/carousels/schedule
 * 
 * Agenda um carrossel para uma data e hora específica no futuro.
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
    const { carouselId, accountId, scheduledAt, caption } = body;

    if (!carouselId || !accountId || !scheduledAt) {
      return NextResponse.json(
        { success: false, message: "carouselId, accountId e scheduledAt são obrigatórios." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Servidor administrativo indisponível." },
        { status: 500 }
      );
    }

    // 1. Valida carrossel
    const { data: carousel, error: cError } = await supabaseAdmin
      .from("carousels")
      .select("id, user_id, title, caption")
      .eq("id", carouselId)
      .eq("user_id", user.id)
      .eq("instagram_account_id", accountId)
      .single();

    if (cError || !carousel) {
      return NextResponse.json(
        { success: false, message: "Carrossel não encontrado." },
        { status: 404 }
      );
    }

    // 2. Insere em scheduled_posts
    const finalCaption = caption !== undefined ? caption : carousel.caption;
    const { data: postRecord, error: postError } = await supabaseAdmin
      .from("scheduled_posts")
      .insert({
        user_id: user.id,
        instagram_account_id: accountId,
        post_type: "carousel",
        carousel_id: carouselId,
        caption: finalCaption || "",
        scheduled_at: scheduledAt,
        status: "scheduled",
      })
      .select()
      .single();

    if (postError || !postRecord) {
      console.error("[Carousels Schedule] Erro ao criar agendamento:", postError);
      return NextResponse.json(
        { success: false, message: `Erro ao agendar carrossel: ${postError?.message}` },
        { status: 500 }
      );
    }

    // 3. Atualiza status do carrossel
    await supabaseAdmin
      .from("carousels")
      .update({ status: "scheduled", updated_at: new Date().toISOString() })
      .eq("id", carouselId)
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      message: "Carrossel agendado com sucesso!",
      post: postRecord,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Carousels Schedule] Exceção:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
