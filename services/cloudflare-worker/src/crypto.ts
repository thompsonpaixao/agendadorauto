/**
 * Módulo de Criptografia AES-256-GCM nativo para Cloudflare Workers via Web Crypto API (crypto.subtle).
 * 100% compatível com a implementação legado do Node.js (src/lib/crypto.ts):
 * SHA256(UTF8(TOKEN_ENCRYPTION_KEY)) -> AES-256-GCM.
 * Zero dependências externas, consumo de CPU < 1ms.
 */

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length % 2 !== 0) {
    throw new Error("Tamanho de string hexadecimal inválido.");
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
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

  const iv = hexToBytes(ivHex);
  const cipherBytes = hexToBytes(encryptedHex);
  const tagBytes = hexToBytes(tagHex);

  // No Web Crypto API AES-GCM, o ciphertext deve ser concatenado com a authentication tag de 128 bits (16 bytes)
  const combined = new Uint8Array(cipherBytes.length + tagBytes.length);
  combined.set(cipherBytes, 0);
  combined.set(tagBytes, cipherBytes.length);

  // Variações estritamente de formatação textual do mesmo secret
  // (ex: newlines, espaços ou aspas acidentais no painel/CLI).
  // Todas as variantes derivam a chave via SHA256(UTF8(secret)), idêntico ao Node legado.
  const keyVariants: Array<{ name: string; value: string }> = [
    { name: "raw", value: secretKey },
    { name: "trimmed", value: secretKey.trim() },
    { name: "trailing_newline_stripped", value: secretKey.replace(/\r?\n$/, "") },
    { name: "unquoted", value: secretKey.replace(/^["']|["']$/g, "").trim() },
  ];

  // Remove duplicatas caso secretKey já venha limpo
  const uniqueVariants = keyVariants.filter(
    (item, index, self) => index === self.findIndex((t) => t.value === item.value)
  );

  for (const variant of uniqueVariants) {
    try {
      const keyData = new TextEncoder().encode(variant.value);
      const keyHash = await crypto.subtle.digest("SHA-256", keyData);

      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyHash,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv,
          tagLength: tagBytes.length * 8, // 128 bits
        },
        cryptoKey,
        combined
      );

      const decrypted = new TextDecoder().decode(decryptedBuffer).trim();
      if (decrypted) {
        return decrypted;
      }
    } catch {
      // Falha esperada caso a variante não corresponda à chave real; tenta a próxima variante
    }
  }

  console.error("[Crypto WebCrypto] Falha na autenticação AES-GCM do token da Meta após testar variações de formatação.");
  return "";
}
