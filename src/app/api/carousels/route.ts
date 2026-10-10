import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CarouselPost, CarouselSlide } from "@/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/carousels
 * 
 * Lista carrosséis reais persistidos em public.carousels e public.carousel_items.
 * Gera URLs assinadas para os slides e resolve o status operacional real.
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
    const accountId = searchParams.get("accountId");

    const supabaseAdmin = createAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Servidor administrativo indisponível." },
        { status: 500 }
      );
    }

    let query = supabaseAdmin
      .from("carousels")
      .select(`
        id,
        user_id,
        instagram_account_id,
        title,
        caption,
        status,
        position,
        created_at,
        updated_at,
        carousel_items (
          id,
          media_id,
          position,
          media (
            id,
            original_name,
            storage_path,
            thumbnail_url,
            media_type,
            size_bytes
          )
        )
      `)
      .eq("user_id", user.id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });

    if (accountId && accountId !== "all") {
      query = query.eq("instagram_account_id", accountId);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error("[Carousels GET] Erro ao buscar carrosséis:", error);
      return NextResponse.json(
        { success: false, message: `Erro ao buscar carrosséis: ${error.message}` },
        { status: 500 }
      );
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: true, carousels: [] });
    }

    const carouselIds = rows.map((r: any) => r.id);

    // Consulta agendamentos vinculados para extrair status operacional e data programada
    const { data: scheduledPosts } = await supabaseAdmin
      .from("scheduled_posts")
      .select("id, carousel_id, status, scheduled_at")
      .in("carousel_id", carouselIds)
      .order("scheduled_at", { ascending: true });

    const scheduledMap = new Map<string, { status: string; scheduledAt: string; id: string }>();
    (scheduledPosts || []).forEach((sp: any) => {
      if (sp.carousel_id && !scheduledMap.has(sp.carousel_id)) {
        scheduledMap.set(sp.carousel_id, {
          status: sp.status,
          scheduledAt: sp.scheduled_at,
          id: sp.id,
        });
      }
    });

    // Mapeia e gera Signed URLs para os slides
    const carousels: CarouselPost[] = await Promise.all(
      rows.map(async (row: any) => {
        const sortedItems = (row.carousel_items || []).sort(
          (a: any, b: any) => a.position - b.position
        );

        const slides: CarouselSlide[] = await Promise.all(
          sortedItems.map(async (item: any) => {
            const media = item.media;
            let fileUrl = "";

            if (media?.storage_path) {
              const { data: signed } = await supabaseAdmin.storage
                .from("media")
                .createSignedUrl(media.storage_path, 7200);
              fileUrl = signed?.signedUrl || "";
            }

            return {
              id: item.id,
              mediaId: item.media_id,
              position: item.position,
              url: fileUrl,
              type: (media?.media_type as "image" | "video") || "image",
              name: media?.original_name || `Slide ${item.position}`,
              sizeBytes: media?.size_bytes || 0,
            };
          })
        );

        const sp = scheduledMap.get(row.id);
        let resolvedStatus: CarouselPost["status"] = row.status || "draft";
        if (sp) {
          if (sp.status === "published") resolvedStatus = "published";
          else if (sp.status === "processing") resolvedStatus = "scheduled";
          else if (sp.status === "scheduled") resolvedStatus = "scheduled";
          else if (sp.status === "failed") resolvedStatus = "error";
        }

        return {
          id: row.id,
          accountId: row.instagram_account_id,
          title: row.title,
          caption: row.caption || "",
          status: resolvedStatus,
          position: row.position,
          slides,
          scheduledAt: sp?.scheduledAt,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      })
    );

    return NextResponse.json({ success: true, carousels });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Carousels GET] Exceção:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}

/**
 * POST /api/carousels
 * 
 * Cria ou atualiza um carrossel em public.carousels e seus slides em public.carousel_items.
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
    const { id, accountId, title, caption, slides } = body;

    if (!accountId || !title || !Array.isArray(slides) || slides.length === 0) {
      return NextResponse.json(
        { success: false, message: "Campos obrigatórios ausentes: accountId, title e ao menos 1 slide." },
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

    // 1. Valida se a conta pertence ao usuário
    const { data: account, error: accError } = await supabaseAdmin
      .from("instagram_accounts")
      .select("id")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accError || !account) {
      return NextResponse.json(
        { success: false, message: "Conta do Instagram não encontrada para este usuário." },
        { status: 403 }
      );
    }

    let carouselId = id;

    // 2. Cria ou Atualiza o registro em public.carousels
    if (carouselId) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("carousels")
        .update({
          title,
          caption: caption || "",
          updated_at: new Date().toISOString(),
        })
        .eq("id", carouselId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json(
          { success: false, message: `Erro ao atualizar carrossel: ${updateError.message}` },
          { status: 500 }
        );
      }
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("carousels")
        .insert({
          user_id: user.id,
          instagram_account_id: accountId,
          title,
          caption: caption || "",
          status: "ready",
          position: 1,
        })
        .select()
        .single();

      if (insertError || !inserted) {
        return NextResponse.json(
          { success: false, message: `Erro ao criar carrossel: ${insertError?.message}` },
          { status: 500 }
        );
      }
      carouselId = inserted.id;
    }

    // 3. Remove itens anteriores e reinsere com as posições atualizadas
    await supabaseAdmin
      .from("carousel_items")
      .delete()
      .eq("carousel_id", carouselId)
      .eq("user_id", user.id);

    const itemsToInsert = slides.map((s: any, idx: number) => ({
      user_id: user.id,
      carousel_id: carouselId,
      media_id: s.mediaId,
      position: idx + 1,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("carousel_items")
      .insert(itemsToInsert);

    if (itemsError) {
      console.error("[Carousels POST] Erro ao salvar slides:", itemsError);
      return NextResponse.json(
        { success: false, message: `Erro ao salvar slides do carrossel: ${itemsError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      carouselId,
      message: "Carrossel salvo com sucesso.",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Carousels POST] Exceção:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
