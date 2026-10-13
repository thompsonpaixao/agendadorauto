import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/storage/usage
 * 
 * Retorna o consumo de armazenamento REAL a partir de public.media.size_bytes:
 * 1. Para o usuário autenticado: consumo pessoal, total de arquivos, divisão por vídeos e imagens,
 *    e indicação clara de cota ("Limite não definido").
 * 2. Para administradores: métricas agregadas globais do AgendadorAuto e consumo agrupado por usuário,
 *    respeitando estritamente o isolamento e sem expor URLs privadas ou conteúdos dos arquivos.
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
        { success: false, message: "Servidor administrativo indisponível." },
        { status: 500 }
      );
    }

    // Identifica se o usuário possui privilégios de administrador
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const userEmail = (user.email || "").toLowerCase();
    let isAdmin = adminEmails.includes(userEmail);

    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role === "admin" || profile?.role === "developer") {
        isAdmin = true;
      }
    } catch {
      // Ignora erro se a tabela profiles ainda não tiver sido criada
    }

    // 1. Busca contas do usuário autenticado para rotulagem
    const { data: userAccounts } = await supabaseAdmin
      .from("instagram_accounts")
      .select("id, username")
      .eq("user_id", user.id);

    const accountUsageMap = new Map<string, {
      accountId: string;
      username: string;
      totalBytes: number;
      videoBytes: number;
      imageBytes: number;
      count: number;
    }>();

    (userAccounts || []).forEach((acc) => {
      accountUsageMap.set(acc.id, {
        accountId: acc.id,
        username: acc.username,
        totalBytes: 0,
        videoBytes: 0,
        imageBytes: 0,
        count: 0,
      });
    });

    // Busca mídias do usuário autenticado
    const { data: userMedia, error: userMediaError } = await supabaseAdmin
      .from("media")
      .select("size_bytes, media_type, retention_status, instagram_account_id")
      .eq("user_id", user.id)
      .neq("retention_status", "deleted");

    if (userMediaError) {
      console.error("[Storage Usage] Erro ao buscar mídias do usuário:", userMediaError);
      return NextResponse.json(
        { success: false, message: "Erro ao consultar armazenamento." },
        { status: 500 }
      );
    }

    let userTotalBytes = 0;
    let userVideoBytes = 0;
    let userVideoCount = 0;
    let userImageBytes = 0;
    let userImageCount = 0;
    let userEligibleCount = 0;
    let userPreservedErrorCount = 0;

    (userMedia || []).forEach((item: any) => {
      const bytes = Number(item.size_bytes) || 0;
      userTotalBytes += bytes;

      if (item.media_type === "video") {
        userVideoBytes += bytes;
        userVideoCount++;
      } else {
        userImageBytes += bytes;
        userImageCount++;
      }

      if (item.retention_status === "eligible_for_deletion") {
        userEligibleCount++;
      } else if (item.retention_status === "preserved_due_to_error") {
        userPreservedErrorCount++;
      }

      if (item.instagram_account_id) {
        let accEntry = accountUsageMap.get(item.instagram_account_id);
        if (!accEntry) {
          accEntry = {
            accountId: item.instagram_account_id,
            username: "Conta Desconectada",
            totalBytes: 0,
            videoBytes: 0,
            imageBytes: 0,
            count: 0,
          };
          accountUsageMap.set(item.instagram_account_id, accEntry);
        }
        accEntry.totalBytes += bytes;
        accEntry.count += 1;
        if (item.media_type === "video") {
          accEntry.videoBytes += bytes;
        } else {
          accEntry.imageBytes += bytes;
        }
      }
    });

    const userUsage = {
      totalBytes: userTotalBytes,
      totalFiles: (userMedia || []).length,
      limitBytes: null as number | null,
      limitLabel: "Limite não definido",
      byType: {
        videos: { sizeBytes: userVideoBytes, count: userVideoCount },
        images: { sizeBytes: userImageBytes, count: userImageCount },
      },
      retention: {
        eligibleForDeletionCount: userEligibleCount,
        preservedDueToErrorCount: userPreservedErrorCount,
      },
      byAccount: Array.from(accountUsageMap.values()).sort((a, b) => b.totalBytes - a.totalBytes),
    };

    // 2. Se for admin, calcula métricas globais agregadas
    let adminUsage = null;
    if (isAdmin) {
      const { data: allMedia, error: allMediaError } = await supabaseAdmin
        .from("media")
        .select("user_id, size_bytes, media_type, retention_status")
        .neq("retention_status", "deleted");

      if (!allMediaError && allMedia) {
        let globalTotalBytes = 0;
        let globalVideoBytes = 0;
        let globalVideoCount = 0;
        let globalImageBytes = 0;
        let globalImageCount = 0;
        let globalEligibleCount = 0;
        let globalPreservedErrorCount = 0;

        const userAggMap = new Map<string, { sizeBytes: number; filesCount: number }>();

        allMedia.forEach((item: any) => {
          const bytes = Number(item.size_bytes) || 0;
          globalTotalBytes += bytes;

          if (item.media_type === "video") {
            globalVideoBytes += bytes;
            globalVideoCount++;
          } else {
            globalImageBytes += bytes;
            globalImageCount++;
          }

          if (item.retention_status === "eligible_for_deletion") {
            globalEligibleCount++;
          } else if (item.retention_status === "preserved_due_to_error") {
            globalPreservedErrorCount++;
          }

          if (item.user_id) {
            const current = userAggMap.get(item.user_id) || { sizeBytes: 0, filesCount: 0 };
            userAggMap.set(item.user_id, {
              sizeBytes: current.sizeBytes + bytes,
              filesCount: current.filesCount + 1,
            });
          }
        });

        // Consulta e-mails dos usuários para identificação administrativa amigável
        const userEmailsMap = new Map<string, string>();
        try {
          const { data: authUsersData } = await supabaseAdmin.auth.admin.listUsers({
            perPage: 100,
          });
          (authUsersData?.users || []).forEach((u) => {
            if (u.email) userEmailsMap.set(u.id, u.email);
          });
        } catch (e) {
          console.warn("[Storage Usage] Aviso ao listar usuários admin:", e);
        }

        const usersList = Array.from(userAggMap.entries()).map(([uId, data]) => {
          const email = userEmailsMap.get(uId);
          return {
            userId: uId,
            userLabel: email ? `${email}` : `Usuário (${uId.slice(0, 8)}...)`,
            sizeBytes: data.sizeBytes,
            filesCount: data.filesCount,
          };
        }).sort((a, b) => b.sizeBytes - a.sizeBytes);

        adminUsage = {
          totalSizeBytes: globalTotalBytes,
          totalFiles: allMedia.length,
          byType: {
            videos: { sizeBytes: globalVideoBytes, count: globalVideoCount },
            images: { sizeBytes: globalImageBytes, count: globalImageCount },
          },
          retention: {
            eligibleForDeletionCount: globalEligibleCount,
            preservedDueToErrorCount: globalPreservedErrorCount,
          },
          users: usersList,
        };
      }
    }

    return NextResponse.json({
      success: true,
      userUsage,
      isAdmin,
      adminUsage,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Storage Usage GET] Exceção:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
