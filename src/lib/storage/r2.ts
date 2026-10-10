import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Módulo Server-Side Centralizado para Cloudflare R2 (S3 Compatible API).
 * IMPORTANTE:
 * - Credenciais R2 NUNCA devem ser enviadas ao cliente/navegador.
 * - O bucket R2 permanece estritamente PRIVADO (sem URLs públicas r2.dev).
 * - Acesso via Presigned URLs com TTL configurável.
 */

let r2ClientInstance: S3Client | null = null;

export function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() || "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || "";
  const bucketName = process.env.R2_BUCKET_NAME?.trim() || "";
  const region = process.env.R2_REGION?.trim() || "auto";

  let endpoint = process.env.R2_ENDPOINT?.trim() || "";
  if (!endpoint && accountId) {
    endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  }

  const uploadTtl = parseInt(process.env.R2_UPLOAD_URL_TTL_SECONDS || "900", 10) || 900;
  const readTtl = parseInt(process.env.R2_READ_URL_TTL_SECONDS || "7200", 10) || 7200;

  const isConfigured = Boolean(accessKeyId && secretAccessKey && bucketName && endpoint);

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpoint,
    region,
    uploadTtl,
    readTtl,
    isConfigured,
  };
}

export function getR2Client(): S3Client {
  if (r2ClientInstance) {
    return r2ClientInstance;
  }

  const config = getR2Config();
  if (!config.isConfigured) {
    throw new Error(
      "Credenciais do Cloudflare R2 incompletas ou não configuradas no servidor."
    );
  }

  r2ClientInstance = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return r2ClientInstance;
}

export interface PresignedUploadParams {
  key: string;
  contentType?: string;
  sizeBytes?: number;
  ttlSeconds?: number;
}

/**
 * Gera URL pré-assinada para PUT direto do browser ao bucket privado R2.
 */
export async function createPresignedUploadUrl(
  params: PresignedUploadParams
): Promise<{ uploadUrl: string; objectKey: string; expiresAt: string }> {
  const config = getR2Config();
  const client = getR2Client();
  const ttl = params.ttlSeconds || config.uploadTtl;

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: params.key,
    ContentType: params.contentType || "application/octet-stream",
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: ttl });
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  return {
    uploadUrl,
    objectKey: params.key,
    expiresAt,
  };
}

export interface PresignedReadParams {
  key: string;
  ttlSeconds?: number;
}

/**
 * Gera URL pré-assinada temporária para GET no R2.
 * Usado para preview no player e ingestão pela Meta Graph API.
 */
export async function createPresignedReadUrl(
  params: PresignedReadParams
): Promise<string> {
  const config = getR2Config();
  const client = getR2Client();
  const ttl = params.ttlSeconds || config.readTtl;

  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: params.key,
  });

  return await getSignedUrl(client, command, { expiresIn: ttl });
}

/**
 * Executa HEAD no Cloudflare R2 para validar se o objeto existe e inspecionar metadados.
 */
export async function headObject(key: string): Promise<{
  contentLength?: number;
  contentType?: string;
  lastModified?: Date;
  eTag?: string;
} | null> {
  const config = getR2Config();
  const client = getR2Client();

  try {
    const response = await client.send(
      new HeadObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      })
    );

    return {
      contentLength: response.ContentLength,
      contentType: response.ContentType,
      lastModified: response.LastModified,
      eTag: response.ETag,
    };
  } catch (err: any) {
    if (
      err.name === "NotFound" ||
      err.$metadata?.httpStatusCode === 404 ||
      err.code === "NoSuchKey"
    ) {
      return null;
    }
    console.error("[R2 headObject] Erro inesperado:", err);
    throw err;
  }
}

/**
 * Verifica se um objeto existe no R2.
 */
export async function objectExists(key: string): Promise<boolean> {
  try {
    const head = await headObject(key);
    return head !== null;
  } catch {
    return false;
  }
}

/**
 * Remove um objeto permanentemente do Cloudflare R2.
 */
export async function deleteObject(key: string): Promise<boolean> {
  const config = getR2Config();
  const client = getR2Client();

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      })
    );
    return true;
  } catch (err) {
    console.error(`[R2 deleteObject] Erro ao deletar ${key}:`, err);
    return false;
  }
}

/**
 * Testa a conexão com o bucket R2 sem vazar credenciais ou listar arquivos.
 */
export async function testR2Connection(): Promise<{
  connected: boolean;
  message?: string;
}> {
  const config = getR2Config();
  if (!config.isConfigured) {
    return {
      connected: false,
      message: "Credenciais R2 não configuradas no ambiente.",
    };
  }

  try {
    const client = getR2Client();
    await client.send(
      new HeadBucketCommand({
        Bucket: config.bucketName,
      })
    );
    return { connected: true };
  } catch (err: any) {
    return {
      connected: false,
      message: err.message || "Falha na conexão com o bucket R2.",
    };
  }
}
