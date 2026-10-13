import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Rota Unificada Server-Side para Conexão OAuth do Instagram
 * Endpoint: GET /api/instagram/connect
 * 
 * Regras:
 * 1. O client_id provém estritamente de META_APP_ID (Instagram App ID no Meta Developers).
 * 2. O redirect_uri provém estritamente de META_REDIRECT_URI (sem fallback para origin/IP/device).
 * 3. Scopes oficiais: instagram_business_basic, instagram_business_content_publish, instagram_business_manage_insights.
 * 4. URL de autorização idêntica para Desktop, Android, iOS e qualquer navegador.
 * 5. Nenhum tratamento especial de mobile ou deep links forçados.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // 1. Valida se o usuário está autenticado no Supabase
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?redirect=/contas", request.url));
  }

  // Modo de conexão solicitado: development (padrão) ou external
  const requestedMode = searchParams.get("mode");

  // Modo Externo indisponível até aprovação no Meta App Review
  if (requestedMode === "external") {
    return NextResponse.redirect(new URL("/contas?error=external_mode_pending_review", request.url));
  }

  const mode = "development";

  // Modo Desenvolvimento restrito a roles developer e admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = profile?.role || "user";
  if (userRole !== "developer" && userRole !== "admin") {
    return NextResponse.redirect(new URL("/contas?error=dev_mode_restricted", request.url));
  }

  // 2. Validação estrita das variáveis de ambiente no servidor
  const metaAppId = process.env.META_APP_ID;
  const metaRedirectUri = process.env.META_REDIRECT_URI;

  if (!metaAppId || !metaRedirectUri) {
    console.error("[Instagram OAuth Error] Variáveis obrigatórias ausentes:", {
      META_APP_ID: metaAppId ? "configurado" : "AUSENTE",
      META_REDIRECT_URI: metaRedirectUri ? "configurado" : "AUSENTE",
    });
    return NextResponse.redirect(new URL("/contas?error=meta_not_configured", request.url));
  }

  // 3. Scopes oficiais atuais do Instagram API with Instagram Login
  const scopes = [
    "instagram_business_basic",
    "instagram_business_content_publish",
    "instagram_business_manage_insights",
  ].join(",");

  const oauthEndpoint = "https://www.instagram.com/oauth/authorize";

  // 4. Debug Seguro Temporário no Servidor (Zero segredos, tokens ou senhas expostos)
  console.log("[Instagram OAuth Connect Debug]", {
    client_id: metaAppId,
    redirect_uri: metaRedirectUri,
    scopes,
    endpoint: oauthEndpoint,
    enable_fb_login: "0",
    force_reauth: "true",
    timestamp: new Date().toISOString(),
  });

  // 5. Monta a URL oficial da Meta de forma 100% server-side e idêntica para todos os dispositivos
  const authUrl = new URL(oauthEndpoint);
  authUrl.searchParams.set("client_id", metaAppId);
  authUrl.searchParams.set("redirect_uri", metaRedirectUri);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("enable_fb_login", "0");
  authUrl.searchParams.set("force_reauth", "true");
  authUrl.searchParams.set("state", `${user.id}:${mode}`);

  return NextResponse.redirect(authUrl.toString());
}
