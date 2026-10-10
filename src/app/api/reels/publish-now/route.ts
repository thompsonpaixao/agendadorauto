import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processInstagramPublication } from "@/lib/instagram/publisher";

export const dynamic = "force-dynamic";

/**
 * POST /api/reels/publish-now
 * 
 * Publica um Reel imediatamente no Instagram utilizando o mesmo pipeline seguro da Meta,
 * sem aguardar horário futuro.
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
    const { accountId, mediaId, caption } = body;

    if (!accountId || !mediaId) {
      return NextResponse.json(
        { success: false, message: "accountId e mediaId são obrigatórios." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Servidor administrativo não configurado." },
        { status: 500 }
      );
    }

    // 1. Valida que a conta pertence ao usuário
    const { data: account, error: accountError } = await supabaseAdmin
      .from("instagram_accounts")
      .select("id, username, instagram_user_id")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { success: false, message: "Conta do Instagram não encontrada ou não autorizada." },
        { status: 404 }
      );
    }

    // 2. Valida que a mídia pertence ao usuário e a esta conta
    const { data: media, error: mediaError } = await supabaseAdmin
      .from("media")
      .select("id, storage_path, original_name")
      .eq("id", mediaId)
      .eq("user_id", user.id)
      .eq("instagram_account_id", accountId)
      .single();

    if (mediaError || !media) {
      return NextResponse.json(
        { success: false, message: "Mídia não encontrada ou não vinculada a esta conta." },
        { status: 404 }
      );
    }

    // 2.1 Concurrency Control por conta: impede disparo simultâneo na mesma conta
    const { data: existingActive } = await supabaseAdmin
      .from("scheduled_posts")
      .select("id, status, locked_at, meta_container_id")
      .eq("instagram_account_id", accountId)
      .eq("status", "processing")
      .limit(1);

    if (existingActive && existingActive.length > 0) {
      const activeItem = existingActive[0];
      const isLocked = activeItem.locked_at && (Date.now() - new Date(activeItem.locked_at).getTime() < 2 * 60 * 1000);
      const isEncoding = Boolean(activeItem.meta_container_id);

      if (isLocked || isEncoding) {
        return NextResponse.json(
          {
            success: false,
            message: `Já existe uma publicação sendo processada no perfil @${account.username}. Aguarde a conclusão antes de disparar um novo Reel.`,
          },
          { status: 409 }
        );
      }
    }

    const nowIso = new Date().toISOString();

    // 3. Cria o registro de scheduled_post com execução imediata
    const { data: scheduledPost, error: insertError } = await supabaseAdmin
      .from("scheduled_posts")
      .insert({
        user_id: user.id,
        instagram_account_id: accountId,
        post_type: "reel",
        media_id: mediaId,
        caption: typeof caption === "string" ? caption : "",
        scheduled_at: nowIso,
        status: "processing",
        locked_at: nowIso,
        locked_by: "publish-now",
      })
      .select("id")
      .single();

    if (insertError || !scheduledPost) {
      console.error("[Publish Now] Erro ao criar agendamento imediato:", insertError);
      return NextResponse.json(
        { success: false, message: `Falha ao registrar agendamento: ${insertError?.message}` },
        { status: 500 }
      );
    }

    // 4. Invoca o motor oficial unificado de publicação na Meta
    const result = await processInstagramPublication(scheduledPost.id, {
      isImmediateUserRequest: true,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.error || "Erro retornado pela Meta ao publicar o vídeo.",
        },
        { status: 500 }
      );
    }

    if (result.processing) {
      return NextResponse.json({
        success: true,
        processing: true,
        message: result.message || `Vídeo enviado para processamento no Instagram. O agendador finalizará a publicação em instantes.`,
      });
    }

    return NextResponse.json({
      success: true,
      published: true,
      message: `Reel publicado com sucesso em @${account.username}!`,
      permalink: result.permalink,
      instagramMediaId: result.instagramMediaId,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido na publicação.";
    console.error("[Publish Now API] Exceção:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
