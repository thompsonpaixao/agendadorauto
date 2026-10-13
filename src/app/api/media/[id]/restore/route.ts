import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/media/[id]/restore
 * 
 * Restaura uma mídia da Lixeira limpando o campo deleted_at.
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

    const { id: mediaId } = await params;
    if (!mediaId) {
      return NextResponse.json({ success: false, message: "ID da mídia obrigatório." }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const client = supabaseAdmin || supabase;

    const { data: mediaItem, error: fetchError } = await client
      .from("media")
      .select("id, original_name, deleted_at")
      .eq("id", mediaId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !mediaItem) {
      return NextResponse.json({ success: false, message: "Mídia não encontrada." }, { status: 404 });
    }

    const { error: updateError } = await client
      .from("media")
      .update({
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", mediaId)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { success: false, message: `Erro ao restaurar mídia: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Mídia "${mediaItem.original_name}" restaurada com sucesso.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
