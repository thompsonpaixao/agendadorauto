import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/monitoring/folders/[id]
 * Exclui uma pasta de monitoramento. Perfis associados têm folder_id definido para null.
 */
export async function DELETE(
  _request: Request,
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, message: "ID da pasta ausente." }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const client = supabaseAdmin || supabase;

    const { error } = await client
      .from("monitoring_folders")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("[Monitoring Folder DELETE] Erro:", error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Pasta excluída com sucesso." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
