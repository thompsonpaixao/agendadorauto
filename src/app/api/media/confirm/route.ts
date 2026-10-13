import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getActiveStorageProvider,
  headObject as r2HeadObject,
  deleteMediaObject,
  getMediaReadUrl,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * POST /api/media/confirm
 * 
 * Confirma o upload realizado diretamente no Storage (Cloudflare R2 ou Supabase Storage)
 * e persiste o registro correspondente em public.media.
 * 
 * Regra de Integridade:
 * - Para R2, executa verificação HEAD no objeto antes de registrar no banco.
 * - Caso a inserção no banco falhe, efetua rollback atômico removendo os arquivos órfãos do Storage.
 */
export async function POST(request: Request) {
  let uploadedStoragePath: string | null = null;
  let uploadedThumbPath: string | null = null;
  let currentProvider: "supabase" | "r2" = "supabase";

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const {
      accountId,
      instagramAccountId,
      originalName,
      storagePath,
      thumbnailStoragePath,
      sizeBytes,
      durationSeconds,
      width,
      height,
      mediaType,
      provider: explicitProvider,
    } = body;

    const resolvedAccountId = accountId || instagramAccountId;

    if (!resolvedAccountId || !originalName || !storagePath) {
      return NextResponse.json(
        { success: false, message: "Campos obrigatórios ausentes (accountId, originalName, storagePath)." },
        { status: 400 }
      );
    }

    uploadedStoragePath = storagePath;
    uploadedThumbPath = thumbnailStoragePath || null;

    // Determina o provider: prioriza o provedor ativo do servidor, ou confirmação explícita
    currentProvider = (explicitProvider === "r2" || explicitProvider === "supabase")
      ? explicitProvider
      : getActiveStorageProvider();

    let verifiedSizeBytes = typeof sizeBytes === "number" ? sizeBytes : 0;

    // =========================================================================
    // VERIFICAÇÃO SERVER-SIDE VIA HEAD ANTES DE PERSISTIR NO BANCO
    // =========================================================================
    if (currentProvider === "r2") {
      try {
        const head = await r2HeadObject(storagePath);
        if (!head) {
          return NextResponse.json(
            {
              success: false,
              message: "Arquivo não confirmado no Cloudflare R2. O upload pode ter sido interrompido.",
            },
            { status: 400 }
          );
        }
        if (head.contentLength && head.contentLength > 0) {
          verifiedSizeBytes = head.contentLength;
        }
      } catch (err: any) {
        console.error("[Media Confirm] Erro no HEAD R2:", err);
        return NextResponse.json(
          {
            success: false,
            message: `Falha na confirmação do arquivo no Cloudflare R2: ${err.message || "Objeto inacessível."}`,
          },
          { status: 500 }
        );
      }
    }

    const supabaseAdmin = createAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Servidor administrativo não configurado." },
        { status: 500 }
      );
    }

    // 1. Valida se a conta pertence ao usuário
    const { data: account, error: accountError } = await supabaseAdmin
      .from("instagram_accounts")
      .select("id")
      .eq("id", resolvedAccountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { success: false, message: "Conta não autorizada para este usuário." },
        { status: 403 }
      );
    }

    // 2. Insere o registro em public.media
    const resolvedMediaType = mediaType === "image" ? "image" : "video";
    const bucketName = currentProvider === "r2"
      ? (process.env.R2_BUCKET_NAME?.trim() || null)
      : "media";

    const insertPayload: Record<string, any> = {
      user_id: user.id,
      instagram_account_id: resolvedAccountId,
      original_name: originalName,
      storage_path: storagePath,
      thumbnail_url: thumbnailStoragePath || null,
      media_type: resolvedMediaType,
      size_bytes: verifiedSizeBytes,
      duration_seconds: durationSeconds ? Number(durationSeconds) : null,
      width: width ? Number(width) : null,
      height: height ? Number(height) : null,
      status: "ready",
      retention_status: "active",
      storage_provider: currentProvider,
      storage_bucket: bucketName,
    };

    const { data: mediaRecord, error: insertError } = await supabaseAdmin
      .from("media")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError || !mediaRecord) {
      console.error("[Media Confirm] Erro ao inserir na tabela media:", insertError);

      // ROLLBACK ATÔMICO: Remove arquivos órfãos do Storage
      await deleteMediaObject({
        storage_provider: currentProvider,
        storage_path: storagePath,
        thumbnail_url: thumbnailStoragePath,
      });

      return NextResponse.json(
        { success: false, message: `Falha ao registrar mídia no banco de dados: ${insertError?.message}` },
        { status: 500 }
      );
    }

    // 3. Gera Signed URLs para visualização imediata no cliente
    const videoUrl = await getMediaReadUrl(mediaRecord, "main", 7200);
    const thumbUrl = mediaRecord.thumbnail_url
      ? await getMediaReadUrl(mediaRecord, "thumbnail", 7200)
      : videoUrl;

    const clientMedia = {
      id: mediaRecord.id,
      userId: mediaRecord.user_id,
      accountId: mediaRecord.instagram_account_id,
      name: mediaRecord.original_name,
      url: videoUrl,
      thumbnailUrl: thumbUrl || videoUrl,
      type: mediaRecord.media_type as "video" | "image",
      sizeBytes: Number(mediaRecord.size_bytes),
      durationSeconds: mediaRecord.duration_seconds ? Number(mediaRecord.duration_seconds) : undefined,
      position: mediaRecord.position,
      status: mediaRecord.status,
      retentionStatus: mediaRecord.retention_status,
      createdAt: mediaRecord.created_at,
      deleteAfter: mediaRecord.delete_after,
      publishedAt: mediaRecord.published_at,
      storageProvider: mediaRecord.storage_provider || currentProvider,
    };

    return NextResponse.json({
      success: true,
      media: clientMedia,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Media Confirm API] Exceção:", errorMsg);

    // Rollback de segurança se houve falha
    if (uploadedStoragePath) {
      await deleteMediaObject({
        storage_provider: currentProvider,
        storage_path: uploadedStoragePath,
        thumbnail_url: uploadedThumbPath,
      }).catch(() => {});
    }

    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
