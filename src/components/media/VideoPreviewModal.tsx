"use client";

import React from "react";
import { MediaItem } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { formatBytes, formatDate, formatDuration } from "@/lib/utils";

interface VideoPreviewModalProps {
  video: MediaItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function VideoPreviewModal({ video, isOpen, onClose }: VideoPreviewModalProps) {
  if (!video) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={video.name || "Visualizar Vídeo"}
      description={`${formatBytes(video.sizeBytes)}${
        video.durationSeconds ? ` • ${formatDuration(video.durationSeconds)}` : ""
      }`}
      maxWidth="md"
    >
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="relative aspect-[9/16] w-full max-w-[280px] bg-black rounded-2xl overflow-hidden shadow-xl border border-slate-800 flex items-center justify-center">
          <video
            src={video.url}
            controls
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
        </div>
        <div className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 flex justify-between items-center">
          <span>
            Status: <strong className="text-emerald-700 font-semibold uppercase">{video.retentionStatus || "ativo"}</strong>
          </span>
          <span>Enviado em: {formatDate(video.createdAt)}</span>
        </div>
      </div>
    </Modal>
  );
}
