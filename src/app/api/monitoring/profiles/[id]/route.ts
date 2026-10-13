import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/monitoring/profiles/[id]
 * Remove um perfil da lista de monitoramento do usuário.
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
      return NextResponse.json({ success: false, message: "ID ausente." }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const client = supabaseAdmin || supabase;

    const { error } = await client
      .from("monitored_profiles")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("[Monitoring Profile DELETE] Erro:", error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Perfil removido do monitoramento." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/monitoring/profiles/[id]
 * Atualiza pasta, anotações ou nome de exibição do perfil monitorado.
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, message: "ID ausente." }, { status: 400 });
    }

    const body = await request.json();
    const { folderId, notes, displayName } = body;

    const updateData: Record<string, any> = {};

    if (folderId !== undefined) {
      updateData.folder_id = folderId && folderId !== "all" && folderId !== "" ? folderId : null;
    }
    if (notes !== undefined) {
      updateData.notes = typeof notes === "string" ? notes.trim() : null;
    }
    if (displayName !== undefined && typeof displayName === "string") {
      updateData.display_name = displayName.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, message: "Nenhum dado para atualizar." }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const client = supabaseAdmin || supabase;

    const { data: updated, error } = await client
      .from("monitored_profiles")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("[Monitoring Profile PATCH] Erro:", error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile: updated,
      message: "Perfil atualizado com sucesso.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
