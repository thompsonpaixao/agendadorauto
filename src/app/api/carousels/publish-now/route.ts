import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueScheduledPosts } from "@/lib/queue/producer";

export const dynamic = "force-dynamic";

/**
 * POST /api/carousels/publish-now
 * 
 * Publica um carrossel imediatamente na conta oficial do Instagram via Meta Graph API.
 * Cria o post agendado imediato e invoca o pipeline de publicação de carrosséis.
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
    const { carouselId, accountId } = body;

    if (!carouselId || !accountId) {
      return NextResponse.json(
        { success: false, message: "carouselId e accountId são obrigatórios." },
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

    // 1. Valida carrossel e slides
    const { data: carousel, error: cError } = await supabaseAdmin
      .from("carousels")
      .select(`
        id,
        user_id,
        instagram_account_id,
        title,
        caption,
        status,
        carousel_items (
          id,
          media_id,
          position
        )
      `)
      .eq("id", carouselId)
      .eq("user_id", user.id)
      .eq("instagram_account_id", accountId)
      .single();

    if (cError || !carousel) {
      return NextResponse.json(
        { success: false, message: "Carrossel não encontrado ou não pertence a esta conta." },
        { status: 404 }
      );
    }

    if (!carousel.carousel_items || carousel.carousel_items.length === 0) {
      return NextResponse.json(
        { success: false, message: "O carrossel não possui nenhum slide configurado." },
        { status: 400 }
      );
    }

    // 1.1 Concurrency Control por conta: impede disparo simultâneo na mesma conta
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
            message: "Já existe uma publicação sendo processada neste perfil. Aguarde a conclusão antes de disparar um novo carrossel.",
          },
          { status: 409 }
        );
      }
    }

    // 2. Cria post imediato em scheduled_posts
    const nowIso = new Date().toISOString();
    const { data: postRecord, error: postError } = await supabaseAdmin
      .from("scheduled_posts")
      .insert({
        user_id: user.id,
        instagram_account_id: accountId,
        post_type: "carousel",
        carousel_id: carouselId,
        caption: carousel.caption || "",
        scheduled_at: nowIso,
        status: "scheduled",
      })
      .select()
      .single();

    if (postError || !postRecord) {
      console.error("[Carousels Publish Now] Erro ao criar post:", postError);
      return NextResponse.json(
        { success: false, message: `Erro ao preparar publicação: ${postError?.message}` },
        { status: 500 }
      );
    }

    // 3. Envia para a Cloudflare Queue com delaySeconds = 0
    const enqueueRes = await enqueueScheduledPosts([postRecord.id], {
      isImmediate: true,
      delaySeconds: 0,
    });

    if (!enqueueRes.success) {
      return NextResponse.json(
        { success: false, message: "Carrossel registrado, mas falhou ao enviar para a fila da Cloudflare." },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from("carousels")
      .update({ status: "scheduled", updated_at: nowIso })
      .eq("id", carouselId)
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      message: "Carrossel enviado com sucesso para a fila de publicação imediata!",
      scheduledPostId: postRecord.id,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Carousels Publish Now] Exceção:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
