import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ErrorLog, ErrorSeverity, ErrorCategory } from "@/types";

export const dynamic = "force-dynamic";

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
        { success: false, message: "Servidor administrativo não configurado." },
        { status: 500 }
      );
    }

    let query = supabaseAdmin
      .from("error_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (accountId && accountId !== "all") {
      query = query.eq("instagram_account_id", accountId);
    }

    const { data: records, error } = await query;
    if (error) {
      console.error("[Errors API] Erro ao buscar logs de erro:", error);
      return NextResponse.json(
        { success: false, message: `Erro ao buscar logs: ${error.message}` },
        { status: 500 }
      );
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ success: true, errors: [] });
    }

    // Resolução de contas em lote
    const accountIds = Array.from(
      new Set(records.map((r: any) => r.instagram_account_id).filter(Boolean))
    );

    const accountsMap = new Map<string, { username: string; profile_picture_url: string | null }>();
    if (accountIds.length > 0) {
      const { data: accounts } = await supabaseAdmin
        .from("instagram_accounts")
        .select("id, username, profile_picture_url")
        .in("id", accountIds);

      (accounts || []).forEach((acc: any) => {
        accountsMap.set(acc.id, acc);
      });
    }

    // Resolução de posts em lote
    const scheduledPostIds = Array.from(
      new Set(records.map((r: any) => r.scheduled_post_id).filter(Boolean))
    );

    const postsMap = new Map<string, { post_type: string; caption: string }>();
    if (scheduledPostIds.length > 0) {
      const { data: posts } = await supabaseAdmin
        .from("scheduled_posts")
        .select("id, post_type, caption")
        .in("id", scheduledPostIds);

      (posts || []).forEach((p: any) => {
        postsMap.set(p.id, p);
      });
    }

    const errors: ErrorLog[] = records.map((row: any) => {
      const igAcc = accountsMap.get(row.instagram_account_id);
      const post = row.scheduled_post_id ? postsMap.get(row.scheduled_post_id) : undefined;

      // Mapeamento seguro de categoria
      let category: ErrorCategory = "publish";
      if (["oauth", "token"].includes(row.category)) category = "token";
      else if (["media_processing", "upload", "storage"].includes(row.category)) category = "media";
      else if (row.category === "analytics") category = "api";
      else if (row.category === "database" || row.category === "account") category = "account";

      // Mapeamento seguro de severidade
      let severity: ErrorSeverity = "critical";
      if (row.severity === "warning") severity = "warning";
      else if (row.resolved_at) severity = "resolved";

      // Ação recomendada inteligente
      let suggestedAction: ErrorLog["suggestedAction"] = "retry";
      if (row.category === "token" || (row.error_code && row.error_code.includes("190"))) {
        suggestedAction = "reconnect";
      } else if (row.category === "media" || row.category === "upload") {
        suggestedAction = "check_media";
      }
      let postTitle = post?.caption ? post.caption.substring(0, 40) + "..." : "Reel Agendado";
      if (row.category === "upload") {
        try {
          const parsed = JSON.parse(row.technical_details || "{}");
          if (parsed.fileName) {
            const sizeMb = parsed.sizeBytes ? ` (${(parsed.sizeBytes / (1024 * 1024)).toFixed(1)} MB)` : "";
            postTitle = `${parsed.fileName}${sizeMb}`;
          } else {
            postTitle = "Arquivo de Mídia";
          }
        } catch {
          postTitle = "Upload de Arquivo";
        }
      }

      return {
        id: row.id,
        userId: row.user_id,
        timestamp: row.created_at,
        accountId: row.instagram_account_id || "",
        accountUsername: igAcc?.username || "Geral",
        accountAvatar: igAcc?.profile_picture_url || "",
        category,
        severity,
        postType: (post?.post_type === "carousel" ? "carousel" : "reel") as ErrorLog["postType"],
        postTitle,
        errorCode: row.error_code || "UNKNOWN_ERROR",
        errorMessage: row.message || "Erro não especificado",
        technicalDetails: row.technical_details || undefined,
        attempts: 1,
        lastAttemptAt: row.created_at,
        status: row.resolved_at ? "resolved" : "pending",
        suggestedAction,
      };
    });

    return NextResponse.json({ success: true, errors });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Errors API] Exceção:", message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

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
    const {
      accountId,
      category = "upload",
      severity = "error",
      errorCode = "UPLOAD_FAILED",
      message = "Falha no upload de mídia",
      technicalDetails,
      scheduledPostId,
    } = body;

    const supabaseAdmin = createAdminClient();
    const client = supabaseAdmin || supabase;

    const { data: record, error } = await client
      .from("error_logs")
      .insert({
        user_id: user.id,
        instagram_account_id: accountId || null,
        scheduled_post_id: scheduledPostId || null,
        category,
        severity,
        error_code: errorCode,
        message,
        technical_details: typeof technicalDetails === "string" ? technicalDetails : JSON.stringify(technicalDetails || {}),
      })
      .select()
      .single();

    if (error) {
      console.error("[Errors API POST] Erro ao inserir error_log:", error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, error: record });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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
        { success: false, message: "Servidor administrativo não configurado." },
        { status: 500 }
      );
    }

    let query = supabaseAdmin
      .from("error_logs")
      .delete()
      .eq("user_id", user.id);

    if (accountId && accountId !== "all") {
      query = query.eq("instagram_account_id", accountId);
    }

    const { error } = await query;
    if (error) {
      console.error("[Errors API] Erro ao limpar logs:", error);
      return NextResponse.json(
        { success: false, message: `Falha ao limpar logs: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Todos os logs de erro foram removidos com sucesso.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Errors API] Exceção:", message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
