import { createAdminClient } from "@/lib/supabase/admin";
import {
  getR2Config,
  createPresignedReadUrl,
  createPresignedUploadUrl,
  deleteObject as deleteR2Object,
  objectExists as r2ObjectExists,
  headObject as r2HeadObject,
  testR2Connection,
} from "./r2";

export * from "./r2";

export type StorageProvider = "supabase" | "r2";

export interface MediaStorageReference {
  storage_provider?: string | null;
  storage_path: string;
  thumbnail_url?: string | null;
}

/**
 * Retorna o provedor de armazenamento ativo para NOVOS uploads.
 * Se STORAGE_PROVIDER não for explicitamente "r2" ou se as credenciais R2 não estiverem configuradas,
 * mantém fallback seguro para "supabase".
 */
export function getActiveStorageProvider(): StorageProvider {
  const envProvider = process.env.STORAGE_PROVIDER?.trim().toLowerCase();
  const r2Config = getR2Config();

  // Se STORAGE_PROVIDER for explicitamente supabase, respeita a escolha
  if (envProvider === "supabase") {
    return "supabase";
  }

  // Se STORAGE_PROVIDER for r2 ou se R2 estiver configurado, novas mídias vão para R2
  if (r2Config.isConfigured || envProvider === "r2") {
    return "r2";
  }

  return "supabase";
}

/**
 * Obtém URL temporária assinada de leitura para a mídia (GET), independente do provedor onde foi armazenada.
 * Garante que:
 * - Mídias antigas continuem utilizando URLs privadas do Supabase Storage.
 * - Mídias novas em R2 utilizem Presigned GET do R2 com o TTL apropriado.
 *
 * @param media Objeto com storage_provider e storage_path
 * @param target 'main' para o arquivo principal ou 'thumbnail' para a thumb
 * @param ttlSeconds Validade em segundos da URL (padrão: 7200s / 2h para a Meta ingerir tranquilamente)
 */
export async function getMediaReadUrl(
  media: MediaStorageReference,
  target: "main" | "thumbnail" = "main",
  ttlSeconds: number = 7200
): Promise<string> {
  const path = target === "thumbnail" && media.thumbnail_url ? media.thumbnail_url : media.storage_path;
  if (!path) return "";

  // Se já for uma URL externa absoluta HTTP/HTTPS (ex: gravatar, placeholder ou CDN externa)
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const isR2 = media.storage_provider === "r2";

  if (isR2) {
    try {
      return await createPresignedReadUrl({
        key: path,
        ttlSeconds,
      });
    } catch (err) {
      console.error(`[Storage Abstraction] Erro ao gerar Presigned GET R2 para ${path}:`, err);
      return "";
    }
  }

  // Fallback padrão: Supabase Storage privado (bucket 'media')
  try {
    const supabaseAdmin = createAdminClient();
    if (!supabaseAdmin) {
      console.error("[Storage Abstraction] Cliente administrativo do Supabase indisponível.");
      return "";
    }

    const { data, error } = await supabaseAdmin.storage
      .from("media")
      .createSignedUrl(path, ttlSeconds);

    if (error || !data?.signedUrl) {
      console.error(`[Storage Abstraction] Erro ao gerar Signed URL Supabase para ${path}:`, error);
      return "";
    }

    return data.signedUrl;
  } catch (err) {
    console.error(`[Storage Abstraction] Exceção ao gerar URL Supabase para ${path}:`, err);
    return "";
  }
}

/**
 * Remove os arquivos físicos de mídia (arquivo principal e thumbnail) do storage de origem.
 */
export async function deleteMediaObject(
  media: MediaStorageReference
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  const isR2 = media.storage_provider === "r2";

  const pathsToDelete: string[] = [];
  if (media.storage_path && !media.storage_path.startsWith("http")) {
    pathsToDelete.push(media.storage_path);
  }
  if (
    media.thumbnail_url &&
    !media.thumbnail_url.startsWith("http") &&
    media.thumbnail_url !== media.storage_path
  ) {
    pathsToDelete.push(media.thumbnail_url);
  }

  if (pathsToDelete.length === 0) {
    return { success: true, errors: [] };
  }

  if (isR2) {
    for (const key of pathsToDelete) {
      try {
        const deleted = await deleteR2Object(key);
        if (!deleted) {
          errors.push(`Falha ao excluir objeto R2: ${key}`);
        }
      } catch (err: any) {
        errors.push(`Erro ao excluir objeto R2 ${key}: ${err.message}`);
      }
    }
  } else {
    // Supabase Storage
    try {
      const supabaseAdmin = createAdminClient();
      if (supabaseAdmin) {
        const { error } = await supabaseAdmin.storage
          .from("media")
          .remove(pathsToDelete);

        if (error) {
          errors.push(`Falha ao excluir arquivos do Supabase Storage: ${error.message}`);
        }
      }
    } catch (err: any) {
      errors.push(`Erro ao conectar ao Supabase Storage para exclusão: ${err.message}`);
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * Verifica se o arquivo de mídia existe fisicamente no Storage correto.
 */
export async function mediaObjectExists(
  media: MediaStorageReference
): Promise<boolean> {
  if (!media.storage_path) return false;

  if (media.storage_provider === "r2") {
    return await r2ObjectExists(media.storage_path);
  }

  try {
    const supabaseAdmin = createAdminClient();
    if (!supabaseAdmin) return false;

    // Extrai diretório e nome do arquivo
    const parts = media.storage_path.split("/");
    const filename = parts.pop();
    const folder = parts.join("/");

    const { data, error } = await supabaseAdmin.storage
      .from("media")
      .list(folder, { search: filename });

    if (error || !data) return false;
    return data.some((file) => file.name === filename);
  } catch {
    return false;
  }
}
