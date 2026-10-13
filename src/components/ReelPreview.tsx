"use client";

import React, { useState } from "react";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  Music2,
  Volume2,
  VolumeX,
  Sparkles,
  Video,
} from "lucide-react";

interface ReelPreviewProps {
  videoUrl: string;
  caption: string;
}

export function ReelPreview({ videoUrl, caption }: ReelPreviewProps) {
  const [isMuted, setIsMuted] = useState(true);
  const [prevUrl, setPrevUrl] = useState(videoUrl);
  const [videoError, setVideoError] = useState(false);

  if (videoUrl !== prevUrl) {
    setPrevUrl(videoUrl);
    setVideoError(false);
  }

  // Função para formatar as hashtags na legenda
  const renderFormattedCaption = (text: string) => {
    if (!text) {
      return (
        <span className="text-zinc-400 italic">
          Sua legenda aparecerá aqui em tempo real conforme você digita...
        </span>
      );
    }

    const words = text.split(/(\s+)/);
    return words.map((word, index) => {
      if (word.startsWith("#") || word.startsWith("@")) {
        return (
          <span key={index} className="text-sky-400 font-medium">
            {word}
          </span>
        );
      }
      return <span key={index}>{word}</span>;
    });
  };

  const hasValidVideo =
    videoUrl &&
    !videoError &&
    (videoUrl.startsWith("http://") || videoUrl.startsWith("https://"));

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        <Sparkles className="w-3.5 h-3.5 text-rose-400" />
        Pré-visualização do Reel
      </div>

      {/* Dispositivo Mockup estilo Smartphone 9:16 */}
      <div className="relative w-[300px] sm:w-[320px] h-[580px] sm:h-[620px] bg-zinc-900 rounded-[40px] p-3 shadow-2xl border-4 border-zinc-800 shadow-rose-950/20 ring-1 ring-white/10 flex flex-col justify-between overflow-hidden">
        {/* Notch / Câmera Frontal */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-zinc-950 rounded-full z-30 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-zinc-900 border border-zinc-800"></div>
        </div>

        {/* Área interna da tela do Reel */}
        <div className="relative w-full h-full rounded-[32px] overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-black flex flex-col justify-between">
          {/* Vídeo ou Fallback */}
          <div className="absolute inset-0 z-0 bg-zinc-950 flex items-center justify-center">
            {hasValidVideo ? (
              <video
                src={videoUrl}
                autoPlay
                loop
                muted={isMuted}
                playsInline
                className="w-full h-full object-cover"
                onError={() => setVideoError(true)}
              />
            ) : (
              <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-purple-950/40 via-zinc-900 to-rose-950/30">
                <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center mb-4 text-zinc-400 shadow-inner group">
                  <Video className="w-8 h-8 text-rose-400/80 animate-pulse" />
                </div>
                <p className="text-xs font-medium text-zinc-300">
                  {videoUrl
                    ? "Carregando prévia do vídeo..."
                    : "Insira a URL do vídeo para ver a reprodução"}
                </p>
                <span className="mt-2 text-[10px] text-zinc-500 max-w-[200px]">
                  Formatos suportados pela Meta: MP4, MOV (proporção recomendada 9:16)
                </span>
              </div>
            )}
          </div>

          {/* Gradiente de sobreposição para contraste */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/50 via-transparent to-black/90 z-10"></div>

          {/* Top Bar do Reel */}
          <div className="relative z-20 pt-7 px-4 flex items-center justify-between text-white text-sm font-semibold">
            <span>Reels</span>
            {hasValidVideo && (
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="p-1.5 rounded-full bg-black/40 backdrop-blur-sm text-zinc-300 hover:text-white transition-colors"
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
            )}
          </div>

          {/* Ações Laterais do Instagram (Curtir, Comentar, Compartilhar) */}
          <div className="absolute right-3 bottom-20 z-20 flex flex-col items-center gap-4 text-white">
            <div className="flex flex-col items-center gap-1">
              <div className="p-2 rounded-full bg-zinc-900/40 backdrop-blur-sm hover:scale-110 transition-transform cursor-pointer">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-zinc-200">12.4k</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="p-2 rounded-full bg-zinc-900/40 backdrop-blur-sm hover:scale-110 transition-transform cursor-pointer">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-zinc-200">384</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="p-2 rounded-full bg-zinc-900/40 backdrop-blur-sm hover:scale-110 transition-transform cursor-pointer">
                <Send className="w-5 h-5 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-zinc-200">Enviar</span>
            </div>

            <div className="p-2 rounded-full bg-zinc-900/40 backdrop-blur-sm hover:scale-110 transition-transform cursor-pointer">
              <Bookmark className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Área Inferior: Perfil, Legenda e Áudio */}
          <div className="relative z-20 pb-4 px-4 pr-16 text-white flex flex-col gap-2">
            {/* Usuário */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 p-[2px]">
                <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center text-[11px] font-bold">
                  AG
                </div>
              </div>
              <span className="text-xs font-bold hover:underline cursor-pointer">
                seu_perfil
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/40 text-white font-medium">
                Seguir
              </span>
            </div>

            {/* Legenda com limite de linhas e rolagem suave */}
            <div className="text-xs text-zinc-200 max-h-24 overflow-y-auto leading-relaxed scrollbar-thin scrollbar-thumb-zinc-700">
              {renderFormattedCaption(caption)}
            </div>

            {/* Áudio Original */}
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-300">
              <Music2 className="w-3.5 h-3.5 animate-pulse text-rose-400" />
              <span className="truncate">Áudio original • seu_perfil</span>
            </div>
          </div>
        </div>

        {/* Indicador de barra home do smartphone */}
        <div className="w-24 h-1 bg-zinc-600 rounded-full mx-auto mt-2"></div>
      </div>
    </div>
  );
}
