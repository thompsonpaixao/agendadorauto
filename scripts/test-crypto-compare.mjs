import crypto from "node:crypto";

const secret = "chave-secreta-de-teste-1234567890";
const originalToken = "EAABwz1234567890abcdefghijklmnopqrstuvwxyz_TOKEN_META_TESTE";

// 1. Criptografa usando o código idêntico a src/lib/crypto.ts
function nodeEncrypt(token, secretKey) {
  const cleanToken = (token || "").trim();
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash("sha256").update(secretKey).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(cleanToken, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  return {
    encrypted,
    iv: iv.toString("hex"),
    tag,
  };
}

// 2. Descriptografa usando o código do Cloudflare Worker
function hexToBytes(hex) {
  const cleanHex = hex.trim();
  const len = cleanHex.length;
  const bytes = new Uint8Array(len / 2);
  for (let i = 0; i < len; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function webCryptoDecrypt(encryptedHex, ivHex, tagHex, secretKey) {
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
}

async function run() {
  const enc = nodeEncrypt(originalToken, secret);
  console.log("Encrypted:", enc);

  try {
    const dec = await webCryptoDecrypt(enc.encrypted, enc.iv, enc.tag, secret);
    console.log("Decrypted com chave exata:", dec);
    console.log("Match:", dec === originalToken);
  } catch (err) {
    console.error("Erro com chave exata:", err);
  }

  // E se a chave no Worker tiver \n ou espaços no final? (Muito comum ao configurar secret via dashboard ou CLI)
  try {
    const decWithNewline = await webCryptoDecrypt(enc.encrypted, enc.iv, enc.tag, secret + "\n");
    console.log("Decrypted com chave com \\n:", decWithNewline);
  } catch (err) {
    console.log("Erro com chave + \\n (esperado):", err.name, err.message);
  }

  // E se a chave no Worker for trimmed mas a original não era, ou vice-versa?
  try {
    const decWithSpace = await webCryptoDecrypt(enc.encrypted, enc.iv, enc.tag, " " + secret + " ");
    console.log("Decrypted com chave com espaços:", decWithSpace);
  } catch (err) {
    console.log("Erro com chave + espaços (esperado):", err.name, err.message);
  }
}

run();
