import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "placeholder-publishable-key";

  const isConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith("http") &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("seu-projeto")
  );

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  let user = null;
  if (isConfigured) {
    try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      user = null;
    }
  }

  // VALIDAÇÃO DA ALLOWLIST NO SERVIDOR / MIDDLEWARE
  const rawAllowed = process.env.ALLOWED_EMAILS || "";
  const allowedEmails = rawAllowed
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (user && allowedEmails.length > 0) {
    const userEmail = (user.email || "").toLowerCase();
    if (!allowedEmails.includes(userEmail)) {
      // E-mail não autorizado: encerra sessão imediatamente e limpa cookies
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?error=unauthorized";
      const redirectResponse = NextResponse.redirect(url);
      request.cookies.getAll().forEach((cookie) => {
        if (cookie.name.startsWith("sb-")) {
          redirectResponse.cookies.delete(cookie.name);
        }
      });
      return redirectResponse;
    }
  }

  const pathname = request.nextUrl.pathname;

  const isProtectedRoute =
    pathname === "/dashboard" ||
    pathname.startsWith("/contas") ||
    pathname.startsWith("/reels") ||
    pathname.startsWith("/carrosseis") ||
    pathname.startsWith("/agenda") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/erros") ||
    pathname.startsWith("/configuracoes") ||
    pathname.startsWith("/notificacoes");

  const isAuthRoute = pathname === "/login" || pathname === "/cadastro";

  // Redireciona usuário não autenticado para /login em rotas protegidas
  if (isProtectedRoute && !user && isConfigured) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Redireciona usuário autenticado tentando acessar /login ou /cadastro para /dashboard
  if (isAuthRoute && user && isConfigured) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

