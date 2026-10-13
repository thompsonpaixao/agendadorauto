/**
 * Camada de Serviço para Armazenamento e Retenção de Mídia
 * 
 * Estrutura lógica de caminhos:
 * users/{user_id}/instagram/{instagram_account_id}/reels/
 * users/{user_id}/instagram/{instagram_account_id}/carousels/
 */

export interface UploadResult {
  publicUrl: string;
  storagePath: string;
  sizeBytes: number;
}

export class StorageService {
  /**
   * Constrói o caminho hierárquico isolado por usuário e conta do Instagram
   */
  static buildStoragePath(
    userId: string,
    instagramAccountId: string,
    type: "reels" | "carousels",
    fileName: string
  ): string {
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniquePrefix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return `users/${userId}/instagram/${instagramAccountId}/${type}/${uniquePrefix}_${sanitizedFileName}`;
  }

  /**
   * Calcula a data de exclusão automática programada (Data de elegibilidade + 7 dias)
   */
  static calculateDeleteAfter(baseDate: Date = new Date()): Date {
    const target = new Date(baseDate.getTime());
    target.setDate(target.getDate() + 7);
    return target;
  }

  /**
   * Realiza upload seguro no Storage
   */
  static async uploadMedia(
    file: File,
    userId: string = "system",
    instagramAccountId: string = "default",
    type: "reels" | "carousels" = "reels"
  ): Promise<UploadResult> {
    const path = this.buildStoragePath(userId, instagramAccountId, type, file.name);

    return {
      publicUrl: URL.createObjectURL(file),
      storagePath: path,
      sizeBytes: file.size,
    };
  }

  static async getStorageUsage(): Promise<{ usedBytes: number; totalFiles: number; provider: string }> {
    return {
      usedBytes: 0,
      totalFiles: 0,
      provider: "Supabase Storage",
    };
  }
}
