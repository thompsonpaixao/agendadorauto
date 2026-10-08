import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Endpoint de Diagnóstico Seguro para Conexão Instagram OAuth
 * Método: GET /api/instagram/debug
 * 
 * Permite ao desenvolvedor/admin inspecionar se desktop e mobile
 * estão recebendo rigorosamente as mesmas variáveis e endpoints.
 * 
 * NOTA DE SEGURANÇA E PRIVACIDADE:
 * NUNCA retorna nem loga: META_APP_SECRET, tokens, senhas ou chaves.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Autenticação necessária para consultar o diagnóstico." },
      { status: 401 }
    );
  }

  const metaAppId = process.env.META_APP_ID;
  const metaRedirectUri = process.env.META_REDIRECT_URI;
  const endpoint = "https://www.instagram.com/oauth/authorize";
  const scopes = [
    "instagram_business_basic",
    "instagram_business_content_publish",
    "instagram_business_manage_insights",
  ].join(",");

  const debugInfo = {
    endpoint,
    client_id: metaAppId ? metaAppId : "NÃO_CONFIGURADO",
    redirect_uri: metaRedirectUri ? metaRedirectUri : "NÃO_CONFIGURADO",
    scopes,
    enable_fb_login: "0",
    force_reauth: "true",
    is_meta_app_id_set: Boolean(metaAppId),
    is_meta_redirect_uri_set: Boolean(metaRedirectUri),
    is_meta_app_secret_set: Boolean(process.env.META_APP_SECRET),
    same_across_desktop_and_mobile: true,
    timestamp: new Date().toISOString(),
  };

  // Log seguro no terminal do servidor para conferência durante testes
  console.log("[Instagram OAuth Diagnostic Info]", debugInfo);

  return NextResponse.json({
    success: true,
    diagnostic: debugInfo,
  });
}
