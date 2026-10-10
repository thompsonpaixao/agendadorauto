import { spawnSync, spawn } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";

const workerDir = path.resolve("services/cloudflare-worker");

// 1. Gera token forte em memória
const diagToken = crypto.randomBytes(32).toString("hex");

console.log("[1/6] Configurando CRYPTO_DIAG_TOKEN temporário no Cloudflare...");

// Envia o segredo via stdin para o wrangler sem imprimir no console
const putProcess = spawn("npx.cmd", ["wrangler", "secret", "put", "CRYPTO_DIAG_TOKEN"], {
  cwd: workerDir,
  shell: true,
  stdio: ["pipe", "pipe", "pipe"],
});

putProcess.stdin.write(diagToken + "\n");
putProcess.stdin.end();

let putOutput = "";
putProcess.stdout.on("data", (d) => { putOutput += d.toString(); });
putProcess.stderr.on("data", (d) => { putOutput += d.toString(); });

putProcess.on("close", async (code) => {
  if (code !== 0) {
    console.error("[ERRO ao configurar secret]:", putOutput);
    process.exit(1);
  }
  console.log("[1/6] Secret temporário configurado com sucesso.");

  // 2. Deploy da versão com o diagnóstico
  console.log("[2/6] Fazendo deploy da versão com diagnóstico temporário...");
  const deploy1 = spawnSync("npx.cmd", ["wrangler", "deploy"], {
    cwd: workerDir,
    shell: true,
    encoding: "utf8",
  });

  if (deploy1.status !== 0) {
    console.error("[ERRO no deploy 1]:", deploy1.stderr || deploy1.stdout);
    process.exit(1);
  }
  console.log("[2/6] Deploy temporário concluído.");

  // 3. Chamada única autorizada ao diagnóstico
  console.log("[3/6] Executando chamada autorizada única de diagnóstico...");
  let diagResult = { ok: false, decrypt: "failed" };
  try {
    const res = await fetch("https://agendador-operational-worker.thompsonpaixao.workers.dev/diag-crypto-verify", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${diagToken}`,
        "Content-Type": "application/json",
      },
    });

    const body = await res.json();
    diagResult = body;
    console.log("[3/6] Resposta segura recebida do endpoint:", JSON.stringify({
      ok: body.ok,
      decrypt: body.decrypt,
      code: body.code,
    }));
  } catch (err) {
    console.error("[3/6] Falha na chamada HTTP:", err.message);
  }

  // 4. Remoção do secret CRYPTO_DIAG_TOKEN
  console.log("[4/6] Removendo CRYPTO_DIAG_TOKEN do Cloudflare...");
  const delProcess = spawn("npx.cmd", ["wrangler", "secret", "delete", "CRYPTO_DIAG_TOKEN"], {
    cwd: workerDir,
    shell: true,
    stdio: ["pipe", "pipe", "pipe"],
  });

  delProcess.stdin.write("y\n");
  delProcess.stdin.end();

  let delOutput = "";
  delProcess.stdout.on("data", (d) => { delOutput += d.toString(); });
  delProcess.stderr.on("data", (d) => { delOutput += d.toString(); });

  delProcess.on("close", (delCode) => {
    console.log("[4/6] Secret temporário removido do Cloudflare.");
    console.log("\n>>> RESULTADO FINAL DO DIAGNÓSTICO <<<");
    console.log("Teste real com token existente:", diagResult.decrypt === "success" ? "SUCESSO" : "FALHA");
  });
});
