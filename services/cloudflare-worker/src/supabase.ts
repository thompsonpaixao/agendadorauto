import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Env } from "./types";

/**
 * Cria cliente administrativo do Supabase otimizado para Cloudflare Workers.
 * - Desativa persistência de sessão (stateless).
 * - Utiliza a Fetch API nativa global do runtime V8 da Cloudflare.
 */
export function getSupabaseAdmin(env: Env): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas no ambiente do Worker.");
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: (...args) => fetch(...args),
    },
  });
}

/**
 * Cria cliente Supabase com anon key para verificação de JWT de usuário logado.
 */
export function getSupabaseAnon(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: (...args) => fetch(...args),
    },
  });
}
