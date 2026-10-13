import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/instagram/accounts/[id]/followers
 * 
 * Retorna o histórico de seguidores e crescimento diário a partir de public.account_metrics.
 * Suporta filtros: 7d, 30d, custom.
 */
export async function GET(
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

    const { id: accountId } = await params;
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const supabaseAdmin = createAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Servidor administrativo não configurado." },
        { status: 500 }
      );
    }

    // 1. Valida pertencimento da conta ao usuário
    const { data: account, error: accErr } = await supabaseAdmin
      .from("instagram_accounts")
      .select("id, username, followers_count, created_at")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accErr || !account) {
      return NextResponse.json(
        { success: false, message: "Conta não encontrada ou não autorizada." },
        { status: 404 }
      );
    }

    // 2. Determina intervalo de datas (Timezone America/Sao_Paulo)
    const todaySaoPaulo = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
    }).format(new Date());

    let limitDays = 30;
    if (range === "7d") limitDays = 7;
    else if (range === "30d") limitDays = 30;

    let startDateStr = "";
    let endDateStr = todaySaoPaulo;

    if (range === "custom" && startDateParam && endDateParam) {
      startDateStr = startDateParam;
      endDateStr = endDateParam;
    } else {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - (limitDays - 1));
      startDateStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
      }).format(pastDate);
    }

    // 3. Consulta snapshots em public.account_metrics
    let query = supabaseAdmin
      .from("account_metrics")
      .select("date, followers_count, recorded_at")
      .eq("instagram_account_id", accountId)
      .gte("date", startDateStr)
      .lte("date", endDateStr)
      .order("date", { ascending: true });

    const { data: metricsRows, error: metricsErr } = await query;

    if (metricsErr) {
      console.error("[Followers Analytics] Erro ao consultar métricas:", metricsErr);
      return NextResponse.json(
        { success: false, message: `Erro ao consultar métricas: ${metricsErr.message}` },
        { status: 500 }
      );
    }

    let records = metricsRows || [];

    // Se ainda não existir snapshot registrado para hoje, cria o snapshot baseline a partir de account.followers_count
    const hasTodaySnapshot = records.some((r) => r.date === todaySaoPaulo);
    if (!hasTodaySnapshot && account.followers_count != null) {
      const nowIso = new Date().toISOString();
      await supabaseAdmin.from("account_metrics").upsert(
        {
          user_id: user.id,
          instagram_account_id: account.id,
          date: todaySaoPaulo,
          followers_count: account.followers_count,
          recorded_at: nowIso,
        },
        { onConflict: "instagram_account_id,date" }
      );

      records.push({
        date: todaySaoPaulo,
        followers_count: account.followers_count,
        recorded_at: nowIso,
      });

      records.sort((a, b) => a.date.localeCompare(b.date));
    }

    // 4. Calcula as variações diárias (+X, -X, 0)
    let previousFollowers: number | null = null;
    const history = records.map((rec) => {
      const count = Number(rec.followers_count) || 0;
      let change = 0;

      if (previousFollowers !== null) {
        change = count - previousFollowers;
      }

      previousFollowers = count;

      return {
        date: rec.date,
        followersCount: count,
        change,
      };
    });

    const startFollowers = history.length > 0 ? history[0].followersCount : (account.followers_count || 0);
    const currentFollowers = history.length > 0 ? history[history.length - 1].followersCount : (account.followers_count || 0);
    const absoluteChange = currentFollowers - startFollowers;
    const percentageChange = startFollowers > 0
      ? Number(((absoluteChange / startFollowers) * 100).toFixed(2))
      : 0;

    return NextResponse.json({
      success: true,
      range,
      startDate: startDateStr,
      endDate: endDateStr,
      summary: {
        startFollowers,
        currentFollowers,
        absoluteChange,
        percentageChange,
      },
      history,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
