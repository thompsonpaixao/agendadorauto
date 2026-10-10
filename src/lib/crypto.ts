import crypto from "crypto";

/**
 * Utilitário de Criptografia AES-256-GCM para Tokens de Acesso
 * Garante que tokens nunca sejam persistidos ou manipulados em texto puro.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY não está configurada no ambiente do servidor. Defina a variável de ambiente para habilitar o cofre criptográfico."
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptToken(token: string): { encrypted: string; iv: string; tag: string } {
  const cleanToken = (token || "").trim();
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(cleanToken, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  return {
    encrypted,
    iv: iv.toString("hex"),
    tag,
  };
}

export function decryptToken(encrypted: string, ivHex: string, tagHex?: string | null): string {
  if (!encrypted || !ivHex || !tagHex) {
    return "";
  }
  try {
    const iv = Buffer.from(ivHex.trim(), "hex");
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(Buffer.from(tagHex.trim(), "hex"));

    let decrypted = decipher.update(encrypted.trim(), "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted.trim();
  } catch (error) {
    if (error instanceof Error && error.message.includes("TOKEN_ENCRYPTION_KEY")) {
      throw error;
    }
    // Falha de autenticação AES-GCM (tag divergente, dados corrompidos ou chave alterada)
    return "";
  }
}
