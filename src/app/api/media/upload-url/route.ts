import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveStorageProvider, createPresignedUploadUrl } from "@/lib/storage";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * POST /api/media/upload-url
 * 
 * Gera URLs pré-assinadas para upload direto no Storage (Cloudflare R2 ou Supabase Storage).
 * Vantagens:
 * - Contorna o limite serverless de 4.5MB da Vercel (upload direto browser -> Storage).
 * - Suporta vídeos grandes de Reels (até 1 GB conforme limites da Meta).
 * - Permite monitoramento de progresso real (0% a 100%) via XHR.
 * - Garante a organização lógica: users/{user_id}/instagram/{instagram_account_id}/{folder}/{arquivo}
 * - Compatível com arquitetura híbrida (R2 se STORAGE_PROVIDER=r2, senão Supabase Storage).
 */
export async function POST(request: Request) {
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
      filename,
      hasThumbnail,
      mediaType,
      folder,
      contentType,
      sizeBytes,
    } = body;

    const resolvedAccountId = accountId || instagramAccountId;

    if (!resolvedAccountId || !filename) {
      return NextResponse.json(
        { success: false, message: "ID da conta e nome do arquivo são obrigatórios." },
        { status: 400 }
      );
    }

    // Validação de tamanho contra limites reais do aplicativo e da Meta
    const isVideo = mediaType !== "image";
    const maxSizeBytes = isVideo ? 1024 * 1024 * 1024 : 30 * 1024 * 1024; // 1 GB para vídeos, 30 MB para fotos
    if (typeof sizeBytes === "number" && sizeBytes > maxSizeBytes) {
      const maxLabel = isVideo ? "1 GB" : "30 MB";
      return NextResponse.json(
        {
          success: false,
          message: `Arquivo excede o limite máximo permitido pelo Instagram (${maxLabel}).`,
        },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Servidor administrativo não configurado." },
        { status: 500 }
      );
    }

    // Valida se a conta do Instagram pertence ao usuário autenticado
    const { data: account, error: accountError } = await supabaseAdmin
      .from("instagram_accounts")
      .select("id")
      .eq("id", resolvedAccountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { success: false, message: "Conta do Instagram não encontrada ou não pertence ao usuário." },
        { status: 403 }
      );
    }

    // Sanitiza e gera nome único para evitar colisão e path traversal
    const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniquePrefix = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const targetFolder = folder || (mediaType === "image" ? "carousels" : "reels");
    const mainFileName = `${uniquePrefix}_${cleanName}`;
    const thumbFileName = `${uniquePrefix}_thumb.jpg`;

    // Organização estrita de pastas:
    // users/{user_id}/instagram/{instagram_account_id}/{folder}/{arquivo}
    const mainStoragePath = `users/${user.id}/instagram/${resolvedAccountId}/${targetFolder}/${mainFileName}`;
    const thumbStoragePath = `users/${user.id}/instagram/${resolvedAccountId}/${targetFolder}/thumbnails/${thumbFileName}`;

    const activeProvider = getActiveStorageProvider();

    // ==========================================
    // FLUXO 1: CLOUDFLARE R2 (STORAGE_PROVIDER=r2)
    // ==========================================
    if (activeProvider === "r2") {
      const resolvedContentType = contentType || (isVideo ? "video/mp4" : "image/jpeg");
      const r2Upload = await createPresignedUploadUrl({
        key: mainStoragePath,
        contentType: resolvedContentType,
        sizeBytes: typeof sizeBytes === "number" ? sizeBytes : undefined,
        ttlSeconds: 900, // 15 minutos de validade para o upload do browser
      });

      let thumbnailUpload = null;
      if (hasThumbnail) {
        const r2ThumbUpload = await createPresignedUploadUrl({
          key: thumbStoragePath,
          contentType: "image/jpeg",
          ttlSeconds: 900,
        });

        thumbnailUpload = {
          uploadUrl: r2ThumbUpload.uploadUrl,
          signedUrl: r2ThumbUpload.uploadUrl,
          objectKey: thumbStoragePath,
          storagePath: thumbStoragePath,
          expiresAt: r2ThumbUpload.expiresAt,
        };
      }

      const payload = {
        uploadUrl: r2Upload.uploadUrl,
        signedUrl: r2Upload.uploadUrl, // retrocompatibilidade com frontend existente
        objectKey: mainStoragePath,
        path: mainStoragePath,
        storagePath: mainStoragePath,
        expiresAt: r2Upload.expiresAt,
        provider: "r2",
      };

      return NextResponse.json({
        success: true,
        provider: "r2",
        media: payload,
        video: payload, // compatibilidade
        thumbnail: thumbnailUpload,
      });
    }

    // ==========================================
    // FLUXO 2: SUPABASE STORAGE (FALLBACK SEGURO)
    // ==========================================
    const { data: fileUpload, error: fileUploadError } = await supabaseAdmin.storage
      .from("media")
      .createSignedUploadUrl(mainStoragePath, { upsert: true });

    if (fileUploadError || !fileUpload) {
      console.error("[Upload URL] Erro ao gerar URL para arquivo no Supabase:", fileUploadError);
      return NextResponse.json(
        { success: false, message: `Falha ao preparar upload no storage: ${fileUploadError?.message}` },
        { status: 500 }
      );
    }

    let thumbnailUpload = null;
    if (hasThumbnail) {
      const { data: thumbUpload, error: thumbUploadError } = await supabaseAdmin.storage
        .from("media")
        .createSignedUploadUrl(thumbStoragePath, { upsert: true });

      if (!thumbUploadError && thumbUpload) {
        thumbnailUpload = {
          uploadUrl: thumbUpload.signedUrl,
          signedUrl: thumbUpload.signedUrl,
          token: thumbUpload.token,
          path: thumbUpload.path,
          storagePath: thumbStoragePath,
          expiresAt: new Date(Date.now() + 900 * 1000).toISOString(),
        };
      }
    }

    const payload = {
      uploadUrl: fileUpload.signedUrl,
      signedUrl: fileUpload.signedUrl,
      token: fileUpload.token,
      path: fileUpload.path,
      storagePath: mainStoragePath,
      objectKey: mainStoragePath,
      expiresAt: new Date(Date.now() + 900 * 1000).toISOString(),
      provider: "supabase",
    };

    return NextResponse.json({
      success: true,
      provider: "supabase",
      media: payload,
      video: payload,
      thumbnail: thumbnailUpload,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Upload URL API] Exceção:", errorMsg);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
