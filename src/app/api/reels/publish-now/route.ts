import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueScheduledPosts } from "@/lib/queue/producer";

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

    // 3. Salva/garante scheduled_post no banco
    const { data: scheduledPost, error: insertError } = await supabaseAdmin
      .from("scheduled_posts")
      .insert({
        user_id: user.id,
        instagram_account_id: accountId,
        post_type: "reel",
        media_id: mediaId,
        caption: typeof caption === "string" ? caption : "",
        scheduled_at: nowIso,
        status: "scheduled",
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

    // 4. Envia imediatamente mensagem para Cloudflare Queue com delaySeconds = 0
    const enqueueRes = await enqueueScheduledPosts([scheduledPost.id], {
      isImmediate: true,
      delaySeconds: 0,
    });

    if (!enqueueRes.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Agendamento registrado, mas houve falha ao despachar para a fila da Cloudflare.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Reel enviado com sucesso para a fila de publicação imediata (@${account.username})!`,
      scheduledPostId: scheduledPost.id,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido na publicação.";
    console.error("[Publish Now API] Exceção:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
