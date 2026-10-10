import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export interface UnifiedQueueItem {
  id: string;
  name: string;
  type: "reel" | "carousel";
  status: "active" | "paused" | "completed" | "error" | "delayed" | "cancelled";
  accountId: string;
  accountUsername: string;
  accountAvatar: string;
  totalCount: number;
  publishedCount: number;
  remainingCount: number;
  errorCount: number;
  nextScheduledAt: string | null;
  nextPostTitle: string | null;
  progressPercent: number;
  createdAt: string;
  isDelayed: boolean;
}

/**
 * GET /api/queues
 * 
 * Retorna visão consolidada global de todas as filas e agendamentos do usuário
 * em todas as contas conectadas do Instagram, com contadores agregados e detecção de atrasos.
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
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Servidor administrativo não configurado." },
        { status: 500 }
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Busca todas as contas do usuário para mapeamento rápido
    const { data: accounts } = await supabaseAdmin
      .from("instagram_accounts")
      .select("id, username, profile_picture_url")
      .eq("user_id", user.id);

    const accountsMap = new Map<string, { id: string; username: string; avatar: string }>();
    (accounts || []).forEach((acc) => {
      accountsMap.set(acc.id, {
        id: acc.id,
        username: acc.username,
        avatar: acc.profile_picture_url || "/avatars/default.png",
      });
    });

    // 2. Busca todas as filas de Reels
    const { data: reelQueues, error: rqErr } = await supabaseAdmin
      .from("reel_queues")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (rqErr) {
      console.error("[Global Queues API] Erro ao buscar reel_queues:", rqErr);
    }

    const reelQueueIds = (reelQueues || []).map((q) => q.id);

    // 3. Busca itens das filas de Reels com mídias
    let reelItems: any[] = [];
    if (reelQueueIds.length > 0) {
      const { data: items } = await supabaseAdmin
        .from("reel_queue_items")
        .select("id, queue_id, media_id, position, status, custom_caption, media(original_name, thumbnail_url)")
        .in("queue_id", reelQueueIds)
        .order("position", { ascending: true });
      reelItems = items || [];
    }

    // 4. Busca todos os scheduled_posts do usuário
    const { data: allScheduledPosts } = await supabaseAdmin
      .from("scheduled_posts")
      .select("id, queue_id, media_id, carousel_id, status, scheduled_at, queue_status, publish_attempts, error_message")
      .eq("user_id", user.id)
      .order("scheduled_at", { ascending: true });

    const scheduledPostsList = allScheduledPosts || [];

    // Agrupa scheduled_posts por queue_id
    const postsByQueue = new Map<string, any[]>();
    scheduledPostsList.forEach((sp) => {
      if (sp.queue_id) {
        if (!postsByQueue.has(sp.queue_id)) postsByQueue.set(sp.queue_id, []);
        postsByQueue.get(sp.queue_id)!.push(sp);
      }
    });

    // 5. Busca filas de carrosséis de forma totalmente defensiva (caso tabela não exista)
    let carouselQueuesList: any[] = [];
    try {
      const { data: cQueues, error: cErr } = await supabaseAdmin
        .from("carousel_queues")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (!cErr && cQueues) {
        carouselQueuesList = cQueues;
      }
    } catch {
      // Ignora ausência da tabela
    }

    // 6. Monta lista unificada de filas
    const unifiedQueues: UnifiedQueueItem[] = [];

    // Processa filas de Reels
    (reelQueues || []).forEach((rq) => {
      const acc = accountsMap.get(rq.instagram_account_id) || {
        id: rq.instagram_account_id,
        username: "conta",
        avatar: "/avatars/default.png",
      };

      const items = reelItems.filter((it) => it.queue_id === rq.id);
      const queuePosts = postsByQueue.get(rq.id) || [];

      const totalCount = items.length > 0 ? items.length : rq.posts_per_day || 0;
      const publishedCount = items.filter((it) => it.status === "published").length;
      const errorCount = items.filter((it) => it.status === "failed").length;
      const waitingCount = items.filter((it) => ["pending", "scheduled", "processing"].includes(it.status)).length;
      const remainingCount = waitingCount;

      const activePosts = queuePosts.filter((p) => p.status === "scheduled");
      const nextPost = activePosts[0] || null;
      const nextScheduledAt = nextPost ? nextPost.scheduled_at : null;

      // Detecta se a fila possui posts atrasados (scheduled_at < now e status scheduled)
      const hasDelayedPost = activePosts.some((p) => new Date(p.scheduled_at).getTime() < now.getTime());

      // Próximo título
      let nextPostTitle: string | null = null;
      if (nextPost) {
        const itemForNext = items.find((it) => it.media_id === nextPost.media_id);
        nextPostTitle = itemForNext?.media?.original_name || itemForNext?.custom_caption || "Próximo Reel";
      }

      // Status visual calculado
      let displayStatus: UnifiedQueueItem["status"] = rq.status as any;
      if (rq.status === "active" && hasDelayedPost) {
        displayStatus = "delayed";
      } else if (rq.status === "active" && errorCount > 0 && remainingCount === 0) {
        displayStatus = "error";
      } else if (rq.status === "active" && totalCount > 0 && remainingCount === 0) {
        displayStatus = "completed";
      }

      const progressPercent = totalCount > 0 ? Math.round((publishedCount / totalCount) * 100) : 0;

      unifiedQueues.push({
        id: rq.id,
        name: rq.name || `Fila de Reels`,
        type: "reel",
        status: displayStatus,
        accountId: rq.instagram_account_id,
        accountUsername: acc.username,
        accountAvatar: acc.avatar,
        totalCount,
        publishedCount,
        remainingCount,
        errorCount,
        nextScheduledAt,
        nextPostTitle,
        progressPercent,
        createdAt: rq.created_at,
        isDelayed: hasDelayedPost,
      });
    });

    // Processa filas de Carrosséis (se existirem)
    carouselQueuesList.forEach((cq) => {
      const acc = accountsMap.get(cq.instagram_account_id) || {
        id: cq.instagram_account_id,
        username: "conta",
        avatar: "/avatars/default.png",
      };

      unifiedQueues.push({
        id: cq.id,
        name: cq.name || "Fila de Carrosséis",
        type: "carousel",
        status: cq.status === "active" ? "active" : "paused",
        accountId: cq.instagram_account_id,
        accountUsername: acc.username,
        accountAvatar: acc.avatar,
        totalCount: 0,
        publishedCount: 0,
        remainingCount: 0,
        errorCount: 0,
        nextScheduledAt: null,
        nextPostTitle: null,
        progressPercent: 0,
        createdAt: cq.created_at,
        isDelayed: false,
      });
    });

    // 7. Cálculos de resumo e indicadores globais
    const activeQueues = unifiedQueues.filter((q) => q.status === "active" || q.status === "delayed").length;
    const pausedQueues = unifiedQueues.filter((q) => q.status === "paused").length;

    let waitingPosts = 0;
    let delayedPosts = 0;
    let processingPosts = 0;
    let errorPosts = 0;

    scheduledPostsList.forEach((p) => {
      if (p.status === "processing") {
        processingPosts++;
      } else if (p.status === "failed") {
        errorPosts++;
      } else if (p.status === "scheduled") {
        const scheduledTime = new Date(p.scheduled_at).getTime();
        if (scheduledTime < now.getTime()) {
          delayedPosts++;
        } else {
          waitingPosts++;
        }
      }
    });

    return NextResponse.json({
      success: true,
      summary: {
        activeQueues,
        pausedQueues,
        waitingPosts,
        delayedPosts,
        processingPosts,
        errorPosts,
        totalQueues: unifiedQueues.length,
      },
      queues: unifiedQueues,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Global Queues API] Exceção:", message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
