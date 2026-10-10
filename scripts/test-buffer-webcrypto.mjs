import crypto from "node:crypto";

async function test() {
  const secret = "minha-chave-secreta";
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash("sha256").update(secret).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update("Hello World", "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  const combined = Buffer.concat([enc, tag]);
  const webKey = await crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, ["decrypt"]);
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, webKey, combined);
  console.log("Decrypted text:", new TextDecoder().decode(dec));
}

test();
