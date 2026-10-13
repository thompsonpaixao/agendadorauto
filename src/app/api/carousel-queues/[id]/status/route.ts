import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/carousel-queues/[id]/status
 * 
 * Pausa ou reativa uma fila de carrosséis no banco de dados.
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

    if (!["active", "paused"].includes(status)) {
      return NextResponse.json(
        { success: false, message: "Status inválido. Aceito: 'active' ou 'paused'." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const client = supabaseAdmin || supabase;

    const { error: updateError } = await client
      .from("carousel_queues")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", queueId)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json({ success: false, message: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: status === "paused" ? "Fila pausada com sucesso." : "Fila reativada com sucesso.",
      status,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
