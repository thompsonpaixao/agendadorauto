"use client";

/**
 * Utilitário cliente para extração de thumbnail e metadados de vídeo no navegador.
 * Gera prévia instantânea em formato JPEG vertical e calcula duração e dimensões reais.
 */
export interface VideoMetadataAndThumbnail {
  thumbnailUrl: string; // Data URL para exibição imediata
  thumbnailBlob: Blob | null; // Blob JPEG para upload no Storage
  durationSeconds: number;
  width: number;
  height: number;
}

export async function generateVideoMetadataAndThumbnail(file: File): Promise<VideoMetadataAndThumbnail> {
  return new Promise((resolve) => {
    // Caso de fallback para ambiente sem suporte a DOM
    if (typeof window === "undefined" || !window.document) {
      resolve({
        thumbnailUrl: "",
        thumbnailBlob: null,
        durationSeconds: 0,
        width: 720,
        height: 1280,
      });
      return;
    }

    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    let objectUrl = "";
    try {
      objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;
    } catch {
      resolve({
        thumbnailUrl: "",
        thumbnailBlob: null,
        durationSeconds: 0,
        width: 720,
        height: 1280,
      });
      return;
    }

    let timeoutId: NodeJS.Timeout;

    const cleanup = () => {
      clearTimeout(timeoutId);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      video.removeAttribute("src");
      video.load();
    };

    // Timeout de segurança de 8 segundos caso o arquivo de vídeo seja inválido ou corrompido
    timeoutId = setTimeout(() => {
      cleanup();
      resolve({
        thumbnailUrl: "",
        thumbnailBlob: null,
        durationSeconds: 0,
        width: 720,
        height: 1280,
      });
    }, 8000);

    video.onloadedmetadata = () => {
      const duration = Math.round(video.duration) || 0;
      const width = video.videoWidth || 720;
      const height = video.videoHeight || 1280;

      // Pula para 1 segundo (ou 0.1 se for vídeo menor que 2s) para capturar um frame representativo
      const seekTime = duration > 2 ? 1 : 0.1;
      video.currentTime = seekTime;

      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
          }

          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

          canvas.toBlob(
            (blob) => {
              cleanup();
              resolve({
                thumbnailUrl: dataUrl,
                thumbnailBlob: blob,
                durationSeconds: duration,
                width,
                height,
              });
            },
            "image/jpeg",
            0.85
          );
        } catch {
          cleanup();
          resolve({
            thumbnailUrl: "",
            thumbnailBlob: null,
            durationSeconds: duration,
            width,
            height,
          });
        }
      };
    };

    video.onerror = () => {
      cleanup();
      resolve({
        thumbnailUrl: "",
        thumbnailBlob: null,
        durationSeconds: 0,
        width: 720,
        height: 1280,
      });
    };
  });
}
