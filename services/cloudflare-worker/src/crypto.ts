/**
 * Módulo de Criptografia AES-256-GCM nativo para Cloudflare Workers via Web Crypto API (crypto.subtle).
 * 100% compatível com os tokens existentes em public.instagram_account_secrets gravados pelo Node.js.
 * Zero dependências externas, consumo mínimo de CPU (< 1ms).
 */

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim();
  const len = cleanHex.length;
  const bytes = new Uint8Array(len / 2);
  for (let i = 0; i < len; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function decryptTokenWebCrypto(
  encryptedHex: string,
  ivHex: string,
  tagHex: string | null | undefined,
  secretKey: string
): Promise<string> {
  if (!encryptedHex || !ivHex || !tagHex) {
    return "";
  }
  if (!secretKey) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY não configurada no ambiente do Worker. Defina o segredo para habilitar a descriptografia."
    );
  }

  try {
    // 1. Derivação de chave SHA-256 idêntica à do Node.js (crypto.createHash('sha256').update(secret).digest())
    const keyData = new TextEncoder().encode(secretKey);
    const keyHash = await crypto.subtle.digest("SHA-256", keyData);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyHash,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const iv = hexToBytes(ivHex);
    const cipherBytes = hexToBytes(encryptedHex);
    const tagBytes = hexToBytes(tagHex);

    // No Web Crypto API, a tag de autenticação de 128 bits deve ser anexada ao final do ciphertext
    const combined = new Uint8Array(cipherBytes.length + tagBytes.length);
    combined.set(cipherBytes, 0);
    combined.set(tagBytes, cipherBytes.length);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        tagLength: 128,
      },
      cryptoKey,
      combined
    );

    return new TextDecoder().decode(decryptedBuffer).trim();
  } catch (err: unknown) {
    console.error("[Crypto WebCrypto] Falha na descriptografia do token da Meta:", err);
    return "";
  }
}
