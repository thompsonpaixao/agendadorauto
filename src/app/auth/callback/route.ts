import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Verificação da ALLOWLIST em ambiente de desenvolvimento
      const rawAllowed = process.env.ALLOWED_EMAILS || "";
      const allowedEmails = rawAllowed
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      if (allowedEmails.length > 0) {
        const userEmail = (data.user.email || "").toLowerCase();
        if (!allowedEmails.includes(userEmail)) {
          // E-mail não autorizado: encerra a sessão imediatamente
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?error=unauthorized`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Se houver erro ou ausência de código
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
