"use client";

import React, { useState } from "react";
import {
  Link as LinkIcon,
  FileText,
  Send,
  Loader2,
  Calendar,
  AlertCircle,
  Hash,
  Video,
} from "lucide-react";
import { ReelPublishResponse } from "@/types/reel";

interface ReelFormProps {
  videoUrl: string;
  setVideoUrl: (url: string) => void;
  caption: string;
  setCaption: (caption: string) => void;
  onSuccess: (result: ReelPublishResponse) => void;
}

const SAMPLE_VIDEOS = [
  {
    label: "Vídeo Demonstração (MP4)",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  },
  {
    label: "Vídeo Natureza (MP4)",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  },
];

const QUICK_HASHTAGS = [
  "#reels",
  "#viral",
  "#instagram",
  "#explore",
  "#criacaodeconteudo",
  "#novidade",
  "#trending",
];

export function ReelForm({
  videoUrl,
  setVideoUrl,
  caption,
  setCaption,
  onSuccess,
}: ReelFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState("");

  const MAX_CAPTION_LENGTH = 2200;

  const handleAddHashtag = (tag: string) => {
    if (caption.includes(tag)) return;
    const separator = caption.length > 0 && !caption.endsWith(" ") ? " " : "";
    setCaption(`${caption}${separator}${tag}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!videoUrl.trim()) {
      setErrorMessage("Por favor, preencha o campo 'URL do vídeo'.");
      return;
    }

    try {
      new URL(videoUrl.trim());
    } catch {
      setErrorMessage("Por favor, informe uma URL válida (ex: https://dominio.com/video.mp4).");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/reels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoUrl: videoUrl.trim(),
          caption: caption.trim(),
          scheduledTime: isScheduled && scheduledDateTime ? scheduledDateTime : null,
        }),
      });

      const data: ReelPublishResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Erro ao publicar o Reel.");
      }

      onSuccess(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Falha na comunicação com o servidor.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full bg-zinc-900/70 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-sm relative overflow-hidden"
    >
      {/* Luz ambiente suave */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-gradient-to-bl from-rose-500/10 to-transparent rounded-full blur-2xl pointer-events-none"></div>

      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <span>Criar Publicação</span>
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Preencha os campos abaixo para preparar e disparar o seu Reel.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}

      {/* CAMPO: URL do vídeo */}
      <div className="space-y-2 mb-6">
        <div className="flex items-center justify-between">
          <label
            htmlFor="videoUrl"
            className="text-sm font-semibold text-zinc-200 flex items-center gap-2"
          >
            <Video className="w-4 h-4 text-rose-400" />
            <span>URL do vídeo</span>
            <span className="text-rose-500 text-xs">*</span>
          </label>

          <span className="text-[11px] text-zinc-400">
            Formato: MP4 ou link direto
          </span>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
            <LinkIcon className="w-4 h-4" />
          </div>
          <input
            id="videoUrl"
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://exemplo.com/meu-video.mp4"
            className="w-full pl-10 pr-4 py-3 bg-zinc-950/80 border border-zinc-800 rounded-2xl text-zinc-100 text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/80 transition-all"
            required
          />
        </div>

        {/* Links rápidos para testes */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-zinc-400">
          <span>Links de teste:</span>
          {SAMPLE_VIDEOS.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setVideoUrl(sample.url)}
              className="text-rose-400 hover:text-rose-300 underline underline-offset-2 transition-colors"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {/* CAMPO: Legenda */}
      <div className="space-y-2 mb-6">
        <div className="flex items-center justify-between">
          <label
            htmlFor="caption"
            className="text-sm font-semibold text-zinc-200 flex items-center gap-2"
          >
            <FileText className="w-4 h-4 text-purple-400" />
            <span>Legenda</span>
          </label>

          <span
            className={`text-xs ${
              caption.length > MAX_CAPTION_LENGTH
                ? "text-rose-400 font-bold"
                : "text-zinc-500"
            }`}
          >
            {caption.length} / {MAX_CAPTION_LENGTH}
          </span>
        </div>

        <textarea
          id="caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={5}
          placeholder="Escreva a legenda envolvente do seu Reel... Dica: use quebras de linha e hashtags relevantes!"
          maxLength={MAX_CAPTION_LENGTH}
          className="w-full p-4 bg-zinc-950/80 border border-zinc-800 rounded-2xl text-zinc-100 text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/80 transition-all resize-none leading-relaxed"
        />

        {/* Sugestões rápidas de hashtags */}
        <div className="pt-1">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-2">
            <Hash className="w-3 h-3 text-zinc-400" />
            <span>Adicionar hashtags populares:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_HASHTAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleAddHashtag(tag)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  caption.includes(tag)
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    : "bg-zinc-800/80 text-zinc-400 border-zinc-700/60 hover:border-zinc-500 hover:text-zinc-200"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Seção Opcional: Agendamento */}
      <div className="mb-8 p-4 rounded-2xl bg-zinc-950/50 border border-zinc-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-zinc-300">
              Modo de Publicação
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsScheduled(!isScheduled)}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
              isScheduled
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {isScheduled ? "Agendamento Ativo" : "Publicar Imediatamente"}
          </button>
        </div>

        {isScheduled && (
          <div className="pt-2 animate-in fade-in duration-200">
            <label
              htmlFor="scheduledDateTime"
              className="text-[11px] text-zinc-400 block mb-1.5"
            >
              Defina a data e horário programado:
            </label>
            <input
              id="scheduledDateTime"
              type="datetime-local"
              value={scheduledDateTime}
              onChange={(e) => setScheduledDateTime(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
        )}
      </div>

      {/* BOTÃO: Publicar Reel */}
      <div>
        <button
          type="submit"
          disabled={isSubmitting || !videoUrl.trim()}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:from-amber-600 hover:via-rose-600 hover:to-purple-700 active:scale-[0.99] text-white font-bold text-base shadow-xl shadow-rose-600/25 hover:shadow-rose-600/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all flex items-center justify-center gap-3 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processando Reel...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>{isScheduled ? "Agendar Reel" : "Publicar Reel"}</span>
            </>
          )}
        </button>

        <p className="text-center text-[11px] text-zinc-500 mt-3">
          Pronto para integração com a Meta Graph API no deploy
        </p>
      </div>
    </form>
  );
}
