import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/monitoring/folders
 * Lista as pastas/nichos de monitoramento do usuário com contagem real de perfis.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Não autenticado." }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const client = supabaseAdmin || supabase;

    const { data: folders, error } = await client
      .from("monitoring_folders")
      .select(`
        id,
        user_id,
        name,
        description,
        color,
        created_at,
        monitored_profiles (id)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Monitoring Folders GET] Erro:", error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    const formatted = (folders || []).map((f: any) => ({
      id: f.id,
      userId: f.user_id,
      name: f.name,
      description: f.description || "",
      color: f.color || "#6366F1",
      createdAt: f.created_at,
      profilesCount: Array.isArray(f.monitored_profiles) ? f.monitored_profiles.length : 0,
    }));

    return NextResponse.json({ success: true, folders: formatted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

/**
 * POST /api/monitoring/folders
 * Cria uma nova pasta de monitoramento para o usuário.
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
    const { name, description, color } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, message: "O nome da pasta é obrigatório." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const client = supabaseAdmin || supabase;

    const { data: folder, error } = await client
      .from("monitoring_folders")
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || "#6366F1",
      })
      .select()
      .single();

    if (error) {
      console.error("[Monitoring Folders POST] Erro:", error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      folder: {
        id: folder.id,
        userId: folder.user_id,
        name: folder.name,
        description: folder.description || "",
        color: folder.color,
        createdAt: folder.created_at,
        profilesCount: 0,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
