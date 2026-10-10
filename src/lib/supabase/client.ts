import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Padrão atual do Supabase: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (com fallback para NEXT_PUBLIC_SUPABASE_ANON_KEY)
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
    supabaseKey &&
    supabaseUrl.startsWith("http") &&
    !supabaseUrl.includes("seu-projeto")
  );
}

export function createClient() {
  if (!isSupabaseConfigured()) {
    // Retorna cliente dummy para evitar quebras durante prerender ou quando chaves não estiverem configuradas
    return createBrowserClient(
      supabaseUrl || "https://placeholder-project.supabase.co",
      supabaseKey || "placeholder-publishable-key"
    );
  }

  return createBrowserClient(supabaseUrl!, supabaseKey!);
}
