/**
 * Camada de Serviço para o Supabase (PostgreSQL & Row Level Security)
 *
 * NOTA DE ARQUITETURA:
 * As operações com a chave de serviço (Service Role) devem ocorrer no servidor.
 */

export class SupabaseService {
  static async getAccounts() {
    console.log("[SupabaseService Mock] Buscando contas cadastradas");
    return [];
  }

  static async getScheduledPosts(accountId?: string) {
    console.log("[SupabaseService Mock] Buscando posts agendados para:", accountId || "todas as contas");
    return [];
  }

  static async saveQueue(queueData: unknown) {
    console.log("[SupabaseService Mock] Salvando fila de conteúdo:", queueData);
    return { success: true, id: `queue_${Date.now()}` };
  }

  static async logError(errorData: unknown) {
    console.log("[SupabaseService Mock] Registrando erro no log:", errorData);
    return { success: true };
  }
}
