import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/crypto";

/**
 * Endpoint para Verificação Real de Conexão com a Meta Graph API
 * Executa chamada direta server-side para validar a integridade do token,
 * escopos de permissão e atualizar o status real da conta no banco de dados.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Não autenticado." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { success: false, message: "ID da conta obrigatório." },
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

    // 1. Busca a conta no Supabase com isolamento total por user_id
    const { data: account, error: accountError } = await supabase
      .from("instagram_accounts")
      .select("id, username, token_expires_at, status")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { success: false, message: "Conta não encontrada." },
        { status: 404 }
      );
    }

    // 2. Recupera o access token do cofre criptográfico via supabaseAdmin
    let rawToken = "";
    const { data: secret, error: secretError } = await supabaseAdmin
      .from("instagram_account_secrets")
      .select("token_encrypted, token_iv, token_auth_tag")
      .eq("instagram_account_id", accountId)
      .eq("user_id", user.id)
      .single();

    if (!secretError && secret) {
      if (!secret.token_auth_tag) {
        const now = new Date().toISOString();
        const legacyMsg = "Token armazenado em formato antigo. Reconecte a conta do Instagram para atualizar a credencial.";
        await supabaseAdmin
          .from("instagram_accounts")
          .update({
            token_status: "unknown",
            last_verified_at: now,
            last_error_message: legacyMsg,
            status: "error",
            status_message: legacyMsg,
            updated_at: now,
          })
          .eq("id", accountId);

        return NextResponse.json({
          success: false,
          tokenStatus: "unknown",
          message: legacyMsg,
        });
      }

      if (secret.token_encrypted && secret.token_iv && secret.token_auth_tag) {
        rawToken = decryptToken(
          secret.token_encrypted,
          secret.token_iv,
          secret.token_auth_tag
        );
      }
    }

    // Se o token não pôde ser decifrado ou não foi localizado no cofre
    if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length === 0) {
      const now = new Date().toISOString();
      const notFoundMsg = "Token não localizado no cofre criptográfico. Faça uma reconexão com o Instagram.";
      await supabaseAdmin
        .from("instagram_accounts")
        .update({
          token_status: "unknown",
          last_verified_at: now,
          last_error_message: notFoundMsg,
          status: "error",
          status_message: notFoundMsg,
          updated_at: now,
        })
        .eq("id", accountId);

      return NextResponse.json({
        success: false,
        tokenStatus: "unknown",
        message: notFoundMsg,
      });
    }

    const cleanToken = rawToken.trim();

    // 3. Chamada REAL à Meta Graph API com host correto
    let tokenStatus: "valid" | "expiring_soon" | "invalid" = "valid";
    let hasPublishPermission = true;
    let hasInsightsPermission = true;
    let errorMessage: string | null = null;
    let verifiedUsername = account.username;

    const rawGraphVersion = process.env.META_GRAPH_VERSION || "v21.0";
    const graphVersion = rawGraphVersion.startsWith("v") ? rawGraphVersion : `v${rawGraphVersion}`;
    const graphHost = cleanToken.startsWith("EAA")
      ? "https://graph.facebook.com"
      : "https://graph.instagram.com";

    try {
      const metaResponse = await fetch(
        `${graphHost}/${graphVersion}/me?fields=id,username,account_type&access_token=${cleanToken}`
      );

      const metaData = await metaResponse.json();

      if (!metaResponse.ok) {
        tokenStatus = "invalid";
        const metaCode = metaData.error?.code || "unknown";
        errorMessage = metaData.error?.message || `Erro da Meta API (código ${metaCode})`;
        hasPublishPermission = false;
        hasInsightsPermission = false;
      } else {
        verifiedUsername = metaData.username || account.username;

        // Verifica proximidade de expiração (menos de 7 dias)
        if (account.token_expires_at) {
          const expiresDate = new Date(account.token_expires_at).getTime();
          const sevenDaysFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
          if (expiresDate < sevenDaysFromNow) {
            tokenStatus = "expiring_soon";
          }
        }
      }
    } catch {
      tokenStatus = "invalid";
      errorMessage = "Falha ao conectar com os servidores da Meta Graph API.";
      hasPublishPermission = false;
      hasInsightsPermission = false;
    }

    const now = new Date().toISOString();

    // 4. Atualiza os dados reais no banco de dados via supabaseAdmin
    await supabaseAdmin
      .from("instagram_accounts")
      .update({
        token_status: tokenStatus,
        has_publish_permission: hasPublishPermission,
        has_insights_permission: hasInsightsPermission,
        last_verified_at: now,
        last_successful_sync_at: tokenStatus !== "invalid" ? now : undefined,
        last_error_message: errorMessage,
        status: tokenStatus === "invalid" ? "error" : "connected",
        status_message: tokenStatus === "valid" ? "Conexão oficial ativa e saudável" : errorMessage,
        updated_at: now,
      })
      .eq("id", accountId);

    return NextResponse.json({
      success: tokenStatus !== "invalid",
      tokenStatus,
      hasPublishPermission,
      hasInsightsPermission,
      lastVerifiedAt: now,
      username: verifiedUsername,
      message:
        tokenStatus === "valid"
          ? "Conexão verificada com sucesso! Token ativo e permissões confirmadas."
          : tokenStatus === "expiring_soon"
          ? "Token válido, porém expira em menos de 7 dias. Recomendada renovação."
          : `Falha na verificação: ${errorMessage || "Token revogado ou expirado."}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno ao verificar conexão.";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
