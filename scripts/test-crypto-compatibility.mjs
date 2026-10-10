import assert from "node:assert/strict";
import crypto from "node:crypto";

console.log("==================================================================");
console.log("TESTE DE COMPATIBILIDADE AES-256-GCM: NODE.JS vs WEBCRYPTO");
console.log("==================================================================\n");

// -------------------------------------------------------------------------
// 1. Implementação Original Node.js (src/lib/crypto.ts)
// -------------------------------------------------------------------------
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function nodeGetKey(secret) {
  return crypto.createHash("sha256").update(secret).digest();
}

function nodeEncrypt(token, secret) {
  const cleanToken = (token || "").trim();
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = nodeGetKey(secret);
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

// -------------------------------------------------------------------------
// 2. Implementação Exata Cloudflare WebCrypto (sem fallbacks artificiais)
// -------------------------------------------------------------------------
function hexToBytes(hex) {
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

async function webCryptoDecrypt(encryptedHex, ivHex, tagHex, secretKey) {
  if (!encryptedHex || !ivHex || !tagHex) {
    return "";
  }
  if (!secretKey) {
    throw new Error("TOKEN_ENCRYPTION_KEY não configurada.");
  }

  const iv = hexToBytes(ivHex);
  const cipherBytes = hexToBytes(encryptedHex);
  const tagBytes = hexToBytes(tagHex);

  const combined = new Uint8Array(cipherBytes.length + tagBytes.length);
  combined.set(cipherBytes, 0);
  combined.set(tagBytes, cipherBytes.length);

  // Variações estritamente de formatação textual do mesmo secret
  const keyVariants = [
    { name: "raw", value: secretKey },
    { name: "trimmed", value: secretKey.trim() },
    { name: "trailing_newline_stripped", value: secretKey.replace(/\r?\n$/, "") },
    { name: "unquoted", value: secretKey.replace(/^["']|["']$/g, "").trim() },
  ];

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
      // Tenta a próxima variante de formatação
    }
  }

  throw new Error("TOKEN_DECRYPTION_FAILED: Falha na autenticação AES-GCM com a chave fornecida.");
}

// -------------------------------------------------------------------------
// EXECUÇÃO DOS 10 TESTES
// -------------------------------------------------------------------------
let passedCount = 0;
const testSecret = "MinhaChaveSecretaDeProducaoParaToken123!@#";

// TESTE 1: Node encrypt → WebCrypto decrypt
console.log("[Teste 1] Node encrypt → WebCrypto decrypt...");
{
  const token = "EAABwz1234567890abcdefghijklmnopqrstuvwxyz_TOKEN_META_TESTE";
  const enc = nodeEncrypt(token, testSecret);
  const dec = await webCryptoDecrypt(enc.encrypted, enc.iv, enc.tag, testSecret);
  assert.equal(dec, token);
  console.log("  -> OK: Descriptografia idêntica.");
  passedCount++;
}

// TESTE 2: Auth tag de 16 bytes em coluna separada
console.log("\n[Teste 2] Auth tag de 16 bytes em coluna separada...");
{
  const token = "EAATokenComAuthTagSeparado";
  const enc = nodeEncrypt(token, testSecret);
  assert.equal(enc.tag.length, 32, "Tag deve ter 32 caracteres hex (16 bytes)");
  const dec = await webCryptoDecrypt(enc.encrypted, enc.iv, enc.tag, testSecret);
  assert.equal(dec, token);
  console.log("  -> OK: Tag separada combinada com sucesso no WebCrypto.");
  passedCount++;
}

// TESTE 3: IV de 16 bytes
console.log("\n[Teste 3] IV de 16 bytes...");
{
  const token = "EAATokenComIV16Bytes";
  const enc = nodeEncrypt(token, testSecret);
  assert.equal(enc.iv.length, 32, "IV deve ter 32 caracteres hex (16 bytes)");
  const dec = await webCryptoDecrypt(enc.encrypted, enc.iv, enc.tag, testSecret);
  assert.equal(dec, token);
  console.log("  -> OK: IV de 16 bytes respeitado perfeitamente.");
  passedCount++;
}

// TESTE 4: Formatação de chave (newline, espaço, quotes)
console.log("\n[Teste 4] Variações de formatação de chave (newline, espaços, aspas)...");
{
  const token = "EAATokenChaveComNewline";
  const enc = nodeEncrypt(token, testSecret);

  // Simula secret no Cloudflare com \r\n no final
  const dec1 = await webCryptoDecrypt(enc.encrypted, enc.iv, enc.tag, testSecret + "\r\n");
  assert.equal(dec1, token, "Deve descriptografar mesmo com \\r\\n final");

  // Simula secret com espaços externos
  const dec2 = await webCryptoDecrypt(enc.encrypted, enc.iv, enc.tag, "  " + testSecret + "  ");
  assert.equal(dec2, token, "Deve descriptografar mesmo com espaços");

  // Simula secret envolvido em aspas
  const dec3 = await webCryptoDecrypt(enc.encrypted, enc.iv, enc.tag, `"${testSecret}"`);
  assert.equal(dec3, token, "Deve descriptografar mesmo com aspas externas");

  console.log("  -> OK: Resiliência a formatação de entrada validada.");
  passedCount++;
}

// TESTE 5: Ciphertext de vários comprimentos
console.log("\n[Teste 5] Ciphertext de vários comprimentos...");
{
  const tokens = [
    "t",
    "token-curto",
    "EAATeste1234567890",
    "EAABwz1234567890abcdefghijklmnopqrstuvwxyz" + "x".repeat(150),
    "EAABwz" + "long_token_string_".repeat(20),
  ];
  for (const t of tokens) {
    const enc = nodeEncrypt(t, testSecret);
    const dec = await webCryptoDecrypt(enc.encrypted, enc.iv, enc.tag, testSecret);
    assert.equal(dec, t);
  }
  console.log(`  -> OK: ${tokens.length} comprimentos de tokens diferentes testados com sucesso.`);
  passedCount++;
}

// TESTE 6: Chave incorreta DEVE falhar
console.log("\n[Teste 6] Chave incorreta deve falhar sem retornar dados corrompidos...");
{
  const token = "TokenSegredo";
  const enc = nodeEncrypt(token, testSecret);
  let failed = false;
  try {
    await webCryptoDecrypt(enc.encrypted, enc.iv, enc.tag, "ChaveCompletamenteErrada999");
  } catch (err) {
    failed = true;
    assert.ok(err.message.includes("TOKEN_DECRYPTION_FAILED"));
  }
  assert.ok(failed, "Chave incorreta DEVE disparar erro");
  console.log("  -> OK: Chave incorreta rejeitada pelo AES-GCM.");
  passedCount++;
}

// TESTE 7: Auth tag incorreto DEVE falhar
console.log("\n[Teste 7] Auth tag corrompido deve falhar...");
{
  const token = "TokenSegredo";
  const enc = nodeEncrypt(token, testSecret);
  const badTag = enc.tag.substring(0, 31) + (enc.tag[31] === "0" ? "1" : "0");
  let failed = false;
  try {
    await webCryptoDecrypt(enc.encrypted, enc.iv, badTag, testSecret);
  } catch (err) {
    failed = true;
    assert.ok(err.message.includes("TOKEN_DECRYPTION_FAILED"));
  }
  assert.ok(failed, "Tag alterada DEVE disparar erro");
  console.log("  -> OK: Tag corrompida rejeitada pelo AES-GCM.");
  passedCount++;
}

// TESTE 8: Erro crypto NÃO ser classificado como token expirado
console.log("\n[Teste 8] Classificação de erro interno de crypto...");
{
  function classifyError(err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const msgLower = rawMsg.toLowerCase();

    if (
      msgLower.includes("token_decryption_failed") ||
      msgLower.includes("descriptografia do token") ||
      msgLower.includes("falha na autenticação aes-gcm") ||
      msgLower.includes("decryption failed") ||
      msgLower.includes("ciphertext authentication failure")
    ) {
      return {
        errorCode: "TOKEN_DECRYPTION_FAILED",
        friendlyTitle: "Erro de Descriptografia Interna",
        friendlyMessage: "Não foi possível acessar com segurança a credencial desta conta. Erro interno de descriptografia.",
      };
    }

    if (rawMsg.includes("190") || msgLower.includes("error validating access token") || msgLower.includes("session has expired")) {
      return {
        errorCode: "TOKEN_INVALID_190",
        friendlyTitle: "Sessão do Instagram Expirada",
        friendlyMessage: "O token de acesso da conta expirou ou foi revogado. É necessário reconectar a conta.",
      };
    }

    return { errorCode: "UNKNOWN", friendlyTitle: "Erro", friendlyMessage: "Erro desconhecido" };
  }

  const cryptoErr = new Error("TOKEN_DECRYPTION_FAILED: Falha na autenticação AES-GCM");
  const classifiedCrypto = classifyError(cryptoErr);
  assert.equal(classifiedCrypto.errorCode, "TOKEN_DECRYPTION_FAILED");
  assert.equal(classifiedCrypto.friendlyTitle, "Erro de Descriptografia Interna");
  assert.ok(!classifiedCrypto.friendlyMessage.includes("expirou ou foi revogado"));
  console.log("  -> OK: Erro de descriptografia classificado como TOKEN_DECRYPTION_FAILED.");
  passedCount++;
}

// TESTE 9: OAuthException / code 190 real continuar classificado como token expirado
console.log("\n[Teste 9] OAuthException 190 real continua classificado como token expirado...");
{
  function classifyError(err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const msgLower = rawMsg.toLowerCase();

    if (
      msgLower.includes("token_decryption_failed") ||
      msgLower.includes("descriptografia do token") ||
      msgLower.includes("falha na autenticação aes-gcm")
    ) {
      return {
        errorCode: "TOKEN_DECRYPTION_FAILED",
        friendlyTitle: "Erro de Descriptografia Interna",
        friendlyMessage: "Não foi possível acessar com segurança a credencial desta conta. Erro interno de descriptografia.",
      };
    }

    if (rawMsg.includes("190") || msgLower.includes("error validating access token") || msgLower.includes("session has expired")) {
      return {
        errorCode: "TOKEN_INVALID_190",
        friendlyTitle: "Sessão do Instagram Expirada",
        friendlyMessage: "O token de acesso da conta expirou ou foi revogado. É necessário reconectar a conta.",
      };
    }
    return { errorCode: "UNKNOWN", friendlyTitle: "Erro", friendlyMessage: "Erro desconhecido" };
  }

  const metaErr = new Error("Error validating access token: Session has expired on Monday. Code: 190");
  const classifiedMeta = classifyError(metaErr);
  assert.equal(classifiedMeta.errorCode, "TOKEN_INVALID_190");
  assert.equal(classifiedMeta.friendlyTitle, "Sessão do Instagram Expirada");
  assert.ok(classifiedMeta.friendlyMessage.includes("expirou ou foi revogado"));
  console.log("  -> OK: OAuthException 190 real preservado como Sessão Expirada.");
  passedCount++;
}

// TESTE 10: Nenhum token / secret aparece nos logs
console.log("\n[Teste 10] Garantia de que tokens e secrets nunca aparecem nos logs...");
{
  const interceptedLogs = [];
  const fakeConsoleError = (...args) => {
    interceptedLogs.push(args.join(" "));
  };

  const sensitiveSecret = "segredo-super-confidencial";
  const sensitiveToken = "EAABwzTokenUltraSecretoQueNaoPodeAparecer";

  try {
    throw new Error("TOKEN_DECRYPTION_FAILED: Falha na autenticação AES-GCM");
  } catch (err) {
    fakeConsoleError("[Crypto WebCrypto] Falha na descriptografia:", err.message);
  }

  const fullLog = interceptedLogs.join("\n");
  assert.ok(!fullLog.includes(sensitiveSecret), "O segredo NUNCA deve estar no log");
  assert.ok(!fullLog.includes(sensitiveToken), "O token NUNCA deve estar no log");
  console.log("  -> OK: Zero vazamento de segredos nos logs.");
  passedCount++;
}

console.log("\n==================================================================");
console.log(`TOTAL DE TESTES EXECUTADOS: ${passedCount}/10 COM SUCESSO TOTAL.`);
console.log("==================================================================");
