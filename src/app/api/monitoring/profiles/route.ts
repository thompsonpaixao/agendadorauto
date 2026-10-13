import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/monitoring/profiles
 * Lista os perfis monitorados pelo usuário no banco de dados.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Não autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");

    const supabaseAdmin = createAdminClient();
    const client = supabaseAdmin || supabase;

    let query = client
      .from("monitored_profiles")
      .select(`
        id,
        user_id,
        folder_id,
        username,
        display_name,
        profile_url,
        platform,
        status,
        notes,
        created_at,
        last_sync_at,
        folder:monitoring_folders!monitored_profiles_folder_id_fkey (id, name, color)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (folderId && folderId !== "all") {
      query = query.eq("folder_id", folderId);
    }

    const { data: rows, error } = await query;

    if (error) {
      // Fallback se o relacionamento nomeado falhar
      const { data: fallbackRows, error: fallbackError } = await client
        .from("monitored_profiles")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fallbackError) {
        console.error("[Monitoring Profiles GET] Erro:", fallbackError);
        return NextResponse.json({ success: false, message: fallbackError.message }, { status: 500 });
      }

      const formatted = (fallbackRows || []).map((p: any) => ({
        id: p.id,
        userId: p.user_id,
        folderId: p.folder_id || undefined,
        username: p.username,
        displayName: p.display_name || p.username,
        profileUrl: p.profile_url || `https://www.instagram.com/${p.username}/`,
        platform: p.platform || "instagram",
        status: p.status || "pending_setup",
        notes: p.notes || "",
        createdAt: p.created_at,
        lastSyncAt: p.last_sync_at,
      }));

      return NextResponse.json({ success: true, profiles: formatted });
    }

    const formatted = (rows || []).map((p: any) => ({
      id: p.id,
      userId: p.user_id,
      folderId: p.folder_id || undefined,
      folderName: p.folder?.name || undefined,
      folderColor: p.folder?.color || undefined,
      username: p.username,
      displayName: p.display_name || p.username,
      profileUrl: p.profile_url || `https://www.instagram.com/${p.username}/`,
      platform: p.platform || "instagram",
      status: p.status || "pending_setup",
      notes: p.notes || "",
      createdAt: p.created_at,
      lastSyncAt: p.last_sync_at,
    }));

    return NextResponse.json({ success: true, profiles: formatted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

/**
 * POST /api/monitoring/profiles
 * Cadastra um novo perfil público para acompanhamento.
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
    const { username, displayName, notes, folderId } = body;

    if (!username || typeof username !== "string" || !username.trim()) {
      return NextResponse.json(
        { success: false, message: "O nome de usuário do Instagram é obrigatório." },
        { status: 400 }
      );
    }

    const cleanUsername = username.replace("@", "").trim().toLowerCase();

    const supabaseAdmin = createAdminClient();
    const client = supabaseAdmin || supabase;

    // Verifica se já está cadastrado
    const { data: existing } = await client
      .from("monitored_profiles")
      .select("id")
      .eq("user_id", user.id)
      .eq("username", cleanUsername)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, message: "Este perfil já está na sua lista de monitoramento." },
        { status: 409 }
      );
    }

    const insertData: any = {
      user_id: user.id,
      username: cleanUsername,
      display_name: displayName?.trim() || cleanUsername,
      profile_url: `https://www.instagram.com/${cleanUsername}/`,
      platform: "instagram",
      status: "pending_setup",
      notes: notes?.trim() || null,
      folder_id: folderId && folderId !== "all" && folderId !== "" ? folderId : null,
    };

    const { data: newProfile, error } = await client
      .from("monitored_profiles")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("[Monitoring Profiles POST] Erro:", error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: newProfile.id,
        userId: newProfile.user_id,
        folderId: newProfile.folder_id || undefined,
        username: newProfile.username,
        displayName: newProfile.display_name || newProfile.username,
        profileUrl: newProfile.profile_url,
        platform: newProfile.platform,
        status: newProfile.status,
        notes: newProfile.notes || "",
        createdAt: newProfile.created_at,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
