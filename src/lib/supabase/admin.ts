import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com permissões de Service Role para tarefas administrativas exclusivas
 * de backend (ex: Scheduler, Limpeza Automática de Mídias).
 * 
 * ATENÇÃO: NUNCA execute ou importe este cliente em componentes de frontend.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
