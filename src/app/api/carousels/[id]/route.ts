import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/carousels/[id]
 * 
 * Exclui um carrossel de public.carousels.
 * Os slides em public.carousel_items são removidos via foreign key cascade.
 * Os arquivos originais em public.media e no Storage são PRESERVADOS.
 * Operação idempotente para prevenir erros 404 em cliques duplos.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Não autenticado." }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Servidor administrativo indisponível." },
        { status: 500 }
      );
    }

    // Busca o carrossel garantindo isolamento por usuário
    const { data: carousel, error: fetchError } = await supabaseAdmin
      .from("carousels")
      .select("id, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error("[Carousels DELETE] Erro ao buscar carrossel:", fetchError);
      return NextResponse.json(
        { success: false, message: `Erro ao buscar carrossel: ${fetchError.message}` },
        { status: 500 }
      );
    }

    // Se já não existe mais, responde idempotentemente com 200
    if (!carousel) {
      return NextResponse.json({
        success: true,
        message: "Carrossel já removido anteriormente.",
      });
    }

    // Remove agendamentos futuros pendentes deste carrossel
    await supabaseAdmin
      .from("scheduled_posts")
      .delete()
      .eq("carousel_id", id)
      .eq("user_id", user.id)
      .in("status", ["pending", "scheduled"]);

    // Exclui o carrossel (itens vinculados são excluídos via cascade)
    const { error: deleteError } = await supabaseAdmin
      .from("carousels")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("[Carousels DELETE] Erro ao excluir carrossel:", deleteError);
      return NextResponse.json(
        { success: false, message: `Falha ao excluir carrossel: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Carrossel excluído com sucesso. Mídias brutas foram preservadas.",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Carousels DELETE] Exceção:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
