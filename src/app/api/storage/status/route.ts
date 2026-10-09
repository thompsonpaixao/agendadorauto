import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveStorageProvider, testR2Connection, getR2Config } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/storage/status
 * 
 * Validação segura do status do Storage sem expor segredos, chaves ou listar arquivos:
 * 1. Suporta STORAGE_PROVIDER=r2 (Cloudflare R2) e STORAGE_PROVIDER=supabase
 * 2. Testa conectividade de forma leve (HEAD bucket no R2, verificação do bucket no Supabase)
 * 3. Retorna { status: 'connected' | 'not_configured' | 'error', provider: 'r2' | 'supabase' }
 */
export async function GET() {
  try {
    const envProvider = process.env.STORAGE_PROVIDER?.trim().toLowerCase();

    // 1. Validação para Cloudflare R2
    if (envProvider === "r2") {
      const r2Config = getR2Config();
      if (!r2Config.isConfigured) {
        return NextResponse.json({
          status: "not_configured",
          provider: "r2",
          message: "Credenciais R2 ausentes ou incompletas.",
        });
      }

      const check = await testR2Connection();
      if (check.connected) {
        return NextResponse.json({
          status: "connected",
          provider: "r2",
        });
      }

      return NextResponse.json({
        status: "error",
        provider: "r2",
      });
    }

    // 2. Validação para Supabase Storage
    if (envProvider === "supabase" || !envProvider) {
      const supabaseAdmin = createAdminClient();

      if (!supabaseAdmin) {
        return NextResponse.json({
          status: "error",
          provider: "supabase",
        });
      }

      const { data: bucket, error: bucketError } = await supabaseAdmin.storage.getBucket("media");

      if (!bucketError && bucket && (bucket.id === "media" || bucket.name === "media")) {
        return NextResponse.json({
          status: "connected",
          provider: "supabase",
        });
      }

      const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
      if (!listError && buckets && buckets.some((b) => b.name === "media" || b.id === "media")) {
        return NextResponse.json({
          status: "connected",
          provider: "supabase",
        });
      }

      return NextResponse.json({
        status: "error",
        provider: "supabase",
      });
    }

    return NextResponse.json({ status: "not_configured", provider: envProvider });
  } catch (error) {
    console.error("[Storage Status API] Erro ao verificar status do storage:", error);
    return NextResponse.json({ status: "error" });
  }
}
