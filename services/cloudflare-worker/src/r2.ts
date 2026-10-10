import { AwsClient } from "aws4fetch";
import { Env } from "./types";

export interface MediaStorageReference {
  storage_provider?: string | null;
  storage_path: string;
  thumbnail_url?: string | null;
}

/**
 * Gera URL temporária assinada (Presigned GET) para a mídia no Cloudflare R2 ou Supabase Storage.
 * - Utiliza aws4fetch (leve, zero dependências pesadas, compatível com CPU Free do Worker).
 * - A Meta Graph API ingere o vídeo diretamente do R2 (zero proxy de vídeo pelo Worker).
 */
export async function getMediaReadUrlWeb(
  env: Env,
  media: MediaStorageReference,
  target: "main" | "thumbnail" = "main",
  ttlSeconds: number = 7200
): Promise<string> {
  const path = target === "thumbnail" && media.thumbnail_url ? media.thumbnail_url : media.storage_path;
  if (!path) return "";

  const provider = (media.storage_provider || "").toLowerCase();

  // 1. Cloudflare R2 (Provedor Primário)
  if (provider === "r2" || (!provider && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY)) {
    const accountId = env.R2_ACCOUNT_ID?.trim() || "";
    const bucketName = env.R2_BUCKET_NAME?.trim() || "";
    const accessKeyId = env.R2_ACCESS_KEY_ID?.trim() || "";
    const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim() || "";
    const region = env.R2_REGION?.trim() || "auto";

    if (!accessKeyId || !secretAccessKey || !bucketName || !accountId) {
      throw new Error("Credenciais do Cloudflare R2 incompletas no Worker.");
    }

    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const cleanKey = path.startsWith("/") ? path.slice(1) : path;
    const targetUrl = `${endpoint}/${bucketName}/${cleanKey}?X-Amz-Expires=${ttlSeconds}`;

    const client = new AwsClient({
      accessKeyId,
      secretAccessKey,
      region,
      service: "s3",
    });

    const signed = await client.sign(targetUrl, {
      method: "GET",
      aws: {
        signQuery: true,
        allHeaders: false,
      },
    });

    return signed.url;
  }

  // 2. Supabase Storage (Fallback para mídias legadas)
  try {
    const bucket = target === "thumbnail" ? "thumbnails" : "videos";
    const res = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ expiresIn: ttlSeconds }),
      }
    );

    if (!res.ok) {
      console.error("[Storage] Erro ao assinar URL no Supabase Storage:", res.status);
      return "";
    }

    const data = (await res.json()) as any;
    if (data?.signedURL) {
      return `${env.SUPABASE_URL}/storage/v1${data.signedURL}`;
    }
    return "";
  } catch (err) {
    console.error("[Storage] Exceção ao gerar Signed URL no Supabase:", err);
    return "";
  }
}
