import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/crypto";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // 1. Tratamento de erros retornados diretamente pela Meta
  const errorParam = searchParams.get("error");
  const errorReason = searchParams.get("error_reason");

  if (errorParam || errorReason) {
    if (errorParam === "access_denied" || errorReason === "user_denied") {
      return NextResponse.redirect(`${origin}/contas?error=cancelled`);
    }
    return NextResponse.redirect(`${origin}/contas?error=permission_denied`);
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${origin}/contas?error=invalid_callback`);
  }

  // 1.1 Extrai o modo de conexão e valida o state
  const stateParam = searchParams.get("state") || "";
  let connectionMode: "development" | "external" = "development";
  let stateUserId = "";
  if (stateParam.includes(":")) {
    const [uid, mode] = stateParam.split(":");
    stateUserId = uid;
    if (mode === "external" || mode === "development") {
      connectionMode = mode;
    }
  }

  // 2. Valida usuário autenticado usando createClient() apenas para getUser()
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || (stateUserId && stateUserId !== user.id)) {
    return NextResponse.redirect(`${origin}/login?redirect=/contas`);
  }

  // 3. Inicializa cliente administrativo seguro para operações backend/service_role
  const supabaseAdmin = createAdminClient();
  if (!supabaseAdmin) {
    console.error("[Instagram OAuth Callback] Falha: Cliente administrativo do Supabase não configurado.");
    return NextResponse.redirect(`${origin}/contas?error=server_configuration`);
  }

  // 4. Credenciais da Meta exclusivamente server-side
  const metaAppId = process.env.META_APP_ID;
  const metaAppSecret = process.env.META_APP_SECRET;
  const metaRedirectUri = process.env.META_REDIRECT_URI;

  if (!metaAppId || !metaAppSecret || !metaRedirectUri) {
    console.error("[Instagram OAuth Callback] Credenciais Meta incompletas nas variáveis de ambiente.");
    return NextResponse.redirect(`${origin}/contas?error=meta_not_configured`);
  }

  try {
    // 5. Troca o código pelo Short-Lived Access Token via endpoint oficial da Meta
    const tokenFormData = new FormData();
    tokenFormData.append("client_id", metaAppId);
    tokenFormData.append("client_secret", metaAppSecret);
    tokenFormData.append("grant_type", "authorization_code");
    tokenFormData.append("redirect_uri", metaRedirectUri);
    tokenFormData.append("code", code);

    const tokenResponse = await fetch(
      "https://api.instagram.com/oauth/access_token",
      {
        method: "POST",
        body: tokenFormData,
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      const errorCode = tokenData.error?.code || tokenData.error_type || "token_exchange_failed";
      console.warn("[Instagram OAuth Callback] Falha na troca do token Meta. Código:", errorCode);
      return NextResponse.redirect(`${origin}/contas?error=invalid_token`);
    }

    const shortLivedToken = (tokenData.access_token as string).trim();
    const instagramUserId = String(tokenData.user_id);

    // 6. Troca pelo Long-Lived Access Token (60 dias) via graph.instagram.com
    let finalAccessToken = shortLivedToken;
    let tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    try {
      const longLivedUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${metaAppSecret}&access_token=${shortLivedToken}`;
      const longLivedResponse = await fetch(longLivedUrl);
      const longLivedData = await longLivedResponse.json();

      if (longLivedResponse.ok && longLivedData.access_token) {
        finalAccessToken = (longLivedData.access_token as string).trim();
        if (longLivedData.expires_in) {
          tokenExpiresAt = new Date(
            Date.now() + longLivedData.expires_in * 1000
          ).toISOString();
        }
      }
    } catch {
      // Fallback seguro: usa o shortLivedToken sem logar detalhes sensíveis
    }

    const cleanFinalToken = finalAccessToken.trim();

    // 7. Busca dados do perfil do Instagram via Graph API com versão configurável
    const rawGraphVersion = process.env.META_GRAPH_VERSION || "v21.0";
    const graphVersion = rawGraphVersion.startsWith("v") ? rawGraphVersion : `v${rawGraphVersion}`;

    let profileData: {
      id?: string;
      username?: string;
      name?: string;
      account_type?: string;
      profile_picture_url?: string;
      followers_count?: number;
    } = {};

    try {
      const profileUrl = `https://graph.instagram.com/${graphVersion}/me?fields=id,username,name,account_type,profile_picture_url,followers_count&access_token=${cleanFinalToken}`;
      const profileResponse = await fetch(profileUrl);
      if (profileResponse.ok) {
        profileData = await profileResponse.json();
      } else {
        const fallbackUrl = `https://graph.instagram.com/me?fields=id,username,name,account_type,profile_picture_url&access_token=${cleanFinalToken}`;
        const fallbackRes = await fetch(fallbackUrl);
        if (fallbackRes.ok) {
          profileData = await fallbackRes.json();
        }
      }
    } catch {
      // Perfil será montado com os dados básicos retornados no token
    }

    // Validação de Conta Profissional (Business ou Creator)
    if (
      profileData.account_type &&
      profileData.account_type.toUpperCase() === "PERSONAL"
    ) {
      return NextResponse.redirect(`${origin}/contas?error=not_professional`);
    }

    const username = (profileData.username || `user_${instagramUserId.substring(0, 6)}`)
      .replace("@", "")
      .trim();
    const displayName = profileData.name || username;
    const profilePic = profileData.profile_picture_url || null;

    // 8. Salva a conta em public.instagram_accounts exclusivamente via supabaseAdmin (service_role)
    const { data: savedAccount, error: accountError } = await supabaseAdmin
      .from("instagram_accounts")
      .upsert(
        {
          user_id: user.id,
          instagram_user_id: String(profileData.id || instagramUserId),
          username: username,
          name: displayName,
          profile_picture_url: profilePic,
          account_type: profileData.account_type || "BUSINESS",
          status: "connected",
          status_message: "Conexão oficial ativa via Meta Graph API",
          token_status: "valid",
          has_publish_permission: true,
          has_insights_permission: true,
          last_verified_at: new Date().toISOString(),
          followers_count: profileData.followers_count || 0,
          token_expires_at: tokenExpiresAt,
          connection_mode: connectionMode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,instagram_user_id" }
      )
      .select("id")
      .single();

    if (accountError || !savedAccount) {
      console.error("[Instagram OAuth Callback] Falha ao salvar instagram_accounts:", {
        code: accountError?.code,
        message: accountError?.message,
      });
      return NextResponse.redirect(`${origin}/contas?error=account_save_failed`);
    }

    const accountId = savedAccount.id;
    console.log("[Instagram OAuth Callback] Instagram account saved com sucesso:", accountId);

    // 9. Criptografa o token com AES-256-GCM e salva em instagram_account_secrets via supabaseAdmin
    const { encrypted, iv, tag } = encryptToken(cleanFinalToken);
    const { error: secretError } = await supabaseAdmin
      .from("instagram_account_secrets")
      .upsert(
        {
          user_id: user.id,
          instagram_account_id: accountId,
          token_encrypted: encrypted,
          token_iv: iv,
          token_auth_tag: tag,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "instagram_account_id" }
      );

    if (secretError) {
      console.error("[Instagram OAuth Callback] Falha ao salvar instagram_account_secrets:", {
        code: secretError?.code,
        message: secretError?.message,
      });
      return NextResponse.redirect(`${origin}/contas?error=token_save_failed`);
    }

    console.log("[Instagram OAuth Callback] Instagram account secrets salvos para accountId:", accountId);

    // 10. Redireciona com sucesso somente após ambas as tabelas serem confirmadas
    return NextResponse.redirect(
      `${origin}/contas?connected=true&username=${encodeURIComponent(username)}&mode=${connectionMode}`
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Instagram OAuth Callback] Exceção durante processamento:", errorMsg);
    return NextResponse.redirect(`${origin}/contas?error=invalid_token`);
  }
}
