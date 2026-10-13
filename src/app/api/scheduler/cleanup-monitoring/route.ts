import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Endpoint para Limpeza e Retenção de Snapshots de Monitoramento (30 dias)
 * Invocado pelo Supabase Cron ou Webhook agendado com cabeçalho CRON_SECRET.
 * 
 * Regras:
 * 1. Autenticação via CRON_SECRET (Authorization: Bearer <secret> ou x-cron-secret: <secret>)
 * 2. Exclui snapshots com mais de 30 dias de:
 *    - public.monitored_profile_snapshots (snapshot_date < current_date - 30 dias)
 *    - public.monitored_media_snapshots (snapshot_date < current_date - 30 dias)
 * 3. PRESERVA intactos os perfis monitorados (public.monitored_profiles) e pastas (public.monitoring_folders).
 * 4. Retorna relatório com contagens de snapshots limpos.
 */
export async function POST(request: Request) {
  // 1. Validação de Autenticação Segura via CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  const providedToken = authHeader?.replace("Bearer ", "") || cronHeader;

  if (expectedSecret && providedToken !== expectedSecret) {
    return NextResponse.json(
      { success: false, error: "Acesso não autorizado ao job de limpeza de monitoramento." },
      { status: 401 }
    );
  }

  const supabaseAdmin = createAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: "Cliente administrativo do Supabase não configurado." },
      { status: 500 }
    );
  }

  // Calcula a data de corte (30 dias atrás, no formato YYYY-MM-DD)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

  try {
    // 2. Limpeza de monitored_profile_snapshots com snapshot_date < cutoffDateStr
    const { count: profileSnapshotsDeleted, error: profileError } = await supabaseAdmin
      .from("monitored_profile_snapshots")
      .delete({ count: "exact" })
      .lt("snapshot_date", cutoffDateStr);

    if (profileError) {
      console.error("[Cleanup Monitoring] Erro ao limpar snapshots de perfis:", profileError);
      return NextResponse.json(
        {
          success: false,
          error: "Falha ao limpar snapshots de perfis monitorados.",
          details: profileError.message,
        },
        { status: 500 }
      );
    }

    // 3. Limpeza de monitored_media_snapshots com snapshot_date < cutoffDateStr
    const { count: mediaSnapshotsDeleted, error: mediaError } = await supabaseAdmin
      .from("monitored_media_snapshots")
      .delete({ count: "exact" })
      .lt("snapshot_date", cutoffDateStr);

    if (mediaError) {
      console.error("[Cleanup Monitoring] Erro ao limpar snapshots de mídias:", mediaError);
      return NextResponse.json(
        {
          success: false,
          error: "Falha ao limpar snapshots de mídias monitoradas.",
          details: mediaError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Retenção aplicada com sucesso. Registros anteriores a ${cutoffDateStr} foram removidos.`,
      retention_days: 30,
      cutoff_date: cutoffDateStr,
      cleaned: {
        profile_snapshots: profileSnapshotsDeleted ?? 0,
        media_snapshots: mediaSnapshotsDeleted ?? 0,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro inesperado durante a limpeza de monitoramento.";
    console.error("[Cleanup Monitoring] Exceção:", err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
