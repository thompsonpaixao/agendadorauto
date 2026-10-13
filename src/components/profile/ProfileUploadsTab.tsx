"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Account, MediaItem, RetentionStatus } from "@/types";
import { useToast } from "@/context/ToastContext";
import { useAppState } from "@/context/AppStateContext";
import {
  UploadCloud,
  Film,
  Image as ImageIcon,
  Clock,
  Trash2,
  AlertTriangle,
  CheckCircle,
  FileText,
  Calendar,
  ShieldAlert,
  Info,
  Play,
  Shield,
  RotateCcw,
  FolderOpen,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import { VideoPreviewModal } from "@/components/media/VideoPreviewModal";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";

interface ProfileUploadsTabProps {
  account: Account;
  accountMedia: MediaItem[];
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getRetentionBadge(status?: RetentionStatus, deleteAfter?: string) {
  switch (status) {
    case "eligible_for_deletion":
    case "deletion_scheduled": {
      const daysRemaining = deleteAfter
        ? Math.max(0, Math.ceil((new Date(deleteAfter).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 7;
      return {
        label: `Exclusão em ${daysRemaining} dia${daysRemaining !== 1 ? "s" : ""}`,
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        icon: Clock,
      };
    }
    case "preserved_due_to_error":
      return {
        label: "Preservado por erro",
        bg: "bg-rose-50 text-rose-700 border-rose-200",
        icon: ShieldAlert,
      };
    case "waiting_publication":
      return {
        label: "Aguardando publicação",
        bg: "bg-blue-50 text-blue-700 border-blue-200",
        icon: Calendar,
      };
    case "deleted":
      return {
        label: "Excluído",
        bg: "bg-slate-100 text-slate-500 border-slate-200",
        icon: Trash2,
      };
    case "active":
    default:
      return {
        label: "Ativo no repositório",
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: CheckCircle,
      };
  }
}

export function ProfileUploadsTab({ account, accountMedia }: ProfileUploadsTabProps) {
  const { addToast } = useToast();
  const { deleteProfileMedia, restoreProfileMedia, refreshMedia } = useAppState();
  
  // Abas: Repositório Ativo vs Lixeira
  const [activeSubTab, setActiveSubTab] = useState<"repositorio" | "lixeira">("repositorio");
  const [trashMedia, setTrashMedia] = useState<MediaItem[]>([]);
  const [isLoadingTrash, setIsLoadingTrash] = useState(false);

  const [filterType, setFilterType] = useState<"all" | "video" | "image">("all");
  const [filterRetention, setFilterRetention] = useState<string>("all");
  const [previewVideo, setPreviewVideo] = useState<MediaItem | null>(null);

  // Mover para Lixeira (Soft Delete)
  const [mediaToDelete, setMediaToDelete] = useState<MediaItem | null>(null);
  const [isDeletingMedia, setIsDeletingMedia] = useState(false);

  // Excluir Permanentemente da Lixeira (Hard Delete)
  const [mediaToPermanentlyDelete, setMediaToPermanentlyDelete] = useState<MediaItem | null>(null);
  const [isPermanentlyDeleting, setIsPermanentlyDeleting] = useState(false);

  const fetchTrash = useCallback(async () => {
    setIsLoadingTrash(true);
    try {
      const res = await fetch(`/api/media?accountId=${account.id}&trash=true`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.media)) {
        setTrashMedia(data.media);
      }
    } catch (err) {
      console.warn("Erro ao buscar lixeira:", err);
    } finally {
      setIsLoadingTrash(false);
    }
  }, [account.id]);

  useEffect(() => {
    void fetchTrash();
  }, [fetchTrash]);

  const filteredMedia = accountMedia.filter((m) => {
    if (filterType !== "all" && m.type !== filterType) return false;
    if (filterRetention !== "all" && (m.retentionStatus || "active") !== filterRetention) return false;
    return true;
  });

  // Cálculo de arquivos com exclusão nos próximos 7 dias
  const expiringNext7Days = accountMedia.filter((m) => {
    if (!m.deleteAfter) return false;
    const diff = new Date(m.deleteAfter).getTime() - Date.now();
    return diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const preservedErrorsCount = accountMedia.filter(
    (m) => m.retentionStatus === "preserved_due_to_error"
  ).length;

  const executeDelete = async () => {
    if (!mediaToDelete || isDeletingMedia) return;

    if (mediaToDelete.operationalStatus === "publishing") {
      addToast({
        type: "error",
        title: "Exclusão Bloqueada",
        message: "Este Reel já está sendo processado pelo Instagram. Aguarde a publicação terminar antes de excluí-lo.",
      });
      setMediaToDelete(null);
      return;
    }

    setIsDeletingMedia(true);
    try {
      const success = await deleteProfileMedia(account.id, mediaToDelete.id, false);
      if (success) {
        setMediaToDelete(null);
        void fetchTrash();
      }
    } finally {
      setIsDeletingMedia(false);
    }
  };

  const handleRestore = async (item: MediaItem) => {
    const success = await restoreProfileMedia(account.id, item.id);
    if (success) {
      void fetchTrash();
    }
  };

  const executePermanentDelete = async () => {
    if (!mediaToPermanentlyDelete) return;
    setIsPermanentlyDeleting(true);
    try {
      const success = await deleteProfileMedia(account.id, mediaToPermanentlyDelete.id, true);
      if (success) {
        setMediaToPermanentlyDelete(null);
        void fetchTrash();
      }
    } finally {
      setIsPermanentlyDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-navegação interna de Uploads */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveSubTab("repositorio")}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === "repositorio"
                ? "bg-white text-indigo-600 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Repositório Ativo ({accountMedia.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab("lixeira");
              void fetchTrash();
            }}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === "lixeira"
                ? "bg-white text-rose-600 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Lixeira ({trashMedia.length})</span>
          </button>
        </div>
      </div>

      {activeSubTab === "repositorio" && (
        <>
          {/* Banner Resumo de Retenção */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">Repositório da Conta</div>
                <div className="text-lg font-bold text-slate-900">{accountMedia.length} arquivos</div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">Exclusão em 7 dias</div>
                <div className="text-lg font-bold text-slate-900">{expiringNext7Days} arquivos</div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">Preservados por Erro</div>
                <div className="text-lg font-bold text-slate-900">{preservedErrorsCount} arquivos</div>
              </div>
            </div>
          </div>

          {/* Informações de privacidade e retenção (sem caminhos técnicos) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3 text-xs text-slate-600">
            <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800">Armazenamento Seguro e Isolado: </span>
              <p className="mt-1 text-slate-500 leading-relaxed">
                Os arquivos deste perfil são armazenados em nuvem segura com isolamento rigoroso por conta.
                Mídias publicadas são mantidas por 7 dias de segurança após a confirmação oficial antes da liberação de espaço. Mídias com erro de publicação permanecem preservadas para recuperação.
              </p>
            </div>
          </div>

          {/* Barra de Filtros */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  filterType === "all"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Todos ({accountMedia.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("video")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  filterType === "video"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Vídeos / Reels</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterType("image")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  filterType === "image"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Imagens</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">Retenção:</label>
              <select
                value={filterRetention}
                onChange={(e) => setFilterRetention(e.target.value)}
                className="text-xs font-medium border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Todos os Status</option>
                <option value="active">Ativos</option>
                <option value="waiting_publication">Aguardando Publicação</option>
                <option value="eligible_for_deletion">Elegíveis para Exclusão</option>
                <option value="preserved_due_to_error">Preservados por Erro</option>
              </select>
            </div>
          </div>

          {/* Grid de Arquivos */}
          {filteredMedia.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs">
              <UploadCloud className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700">Nenhum arquivo encontrado</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Não há mídias ativas enviadas para esta conta com os filtros selecionados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredMedia.map((item) => {
                const badge = getRetentionBadge(item.retentionStatus, item.deleteAfter);
                const BadgeIcon = badge.icon;

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs flex flex-col hover:border-slate-300 transition-all group"
                  >
                    {/* Preview / Thumbnail */}
                    <div
                      onClick={() => {
                        if (item.type === "video") setPreviewVideo(item);
                      }}
                      className={`relative aspect-video bg-slate-900 flex items-center justify-center overflow-hidden ${
                        item.type === "video" ? "cursor-pointer group/thumb" : ""
                      }`}
                      title={item.type === "video" ? "Clique para reproduzir vídeo" : undefined}
                    >
                      {item.thumbnailUrl || item.url ? (
                        <Image
                          src={item.thumbnailUrl || item.url}
                          alt={item.name}
                          width={300}
                          height={170}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          unoptimized
                        />
                      ) : (
                        <Film className="w-8 h-8 text-slate-600" />
                      )}

                      {/* Play Overlay no Hover para Vídeos */}
                      {item.type === "video" && (
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                          <div className="w-10 h-10 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-lg">
                            <Play className="w-4 h-4 fill-slate-900 ml-0.5" />
                          </div>
                        </div>
                      )}

                      <div className="absolute top-2 left-2 flex items-center gap-1.5 pointer-events-none">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-900/80 backdrop-blur-xs text-[10px] font-bold text-white uppercase">
                          {item.type === "video" ? "Reel" : "Slide"}
                        </span>
                      </div>

                      <div className="absolute bottom-2 right-2 pointer-events-none">
                        <span className="px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono">
                          {formatBytes(item.sizeBytes)}
                        </span>
                      </div>
                    </div>

                    {/* Metadados & Retenção */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 truncate" title={item.name}>
                          {item.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Upload: {item.createdAt ? new Date(item.createdAt).toLocaleDateString("pt-BR") : "Recente"}
                        </p>
                      </div>

                      {/* Badge de Retenção */}
                      <div className="space-y-1.5">
                        <div
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border ${badge.bg}`}
                        >
                          <BadgeIcon className="w-3 h-3" />
                          <span>{badge.label}</span>
                        </div>

                        {item.deleteAfter && item.retentionStatus === "eligible_for_deletion" && (
                          <p className="text-[10px] text-slate-400">
                            Exclusão prevista: {new Date(item.deleteAfter).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>

                      {/* Ação de Mover para Lixeira */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">
                          {item.retentionStatus === "waiting_publication" ? "Em agendamento" : "Ativo no perfil"}
                        </span>

                        <button
                          type="button"
                          onClick={() => setMediaToDelete(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Mover para a Lixeira"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Visão da Lixeira */}
      {activeSubTab === "lixeira" && (
        <div className="space-y-4">
          <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-950">
            <Trash2 className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-rose-900">Lixeira do Perfil @{account.username}: </span>
              <p className="mt-1 text-rose-800 leading-relaxed">
                Arquivos movidos para a Lixeira não aparecem mais no Repositório Ativo nem podem ser selecionados para novas publicações ou agendamentos. Você pode restaurar qualquer arquivo a qualquer momento ou excluí-lo definitivamente para liberar espaço.
              </p>
            </div>
          </div>

          {isLoadingTrash ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Carregando itens da lixeira...</p>
            </div>
          ) : trashMedia.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">A Lixeira está vazia</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Nenhum arquivo deste perfil foi movido para a lixeira.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {trashMedia.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-rose-200/70 rounded-2xl overflow-hidden shadow-2xs flex flex-col justify-between hover:border-rose-300 transition-all"
                >
                  <div
                    onClick={() => {
                      if (item.type === "video") setPreviewVideo(item);
                    }}
                    className={`relative aspect-video bg-slate-900 flex items-center justify-center overflow-hidden ${
                      item.type === "video" ? "cursor-pointer" : ""
                    }`}
                  >
                    {item.thumbnailUrl || item.url ? (
                      <Image
                        src={item.thumbnailUrl || item.url}
                        alt={item.name}
                        width={300}
                        height={170}
                        className="w-full h-full object-cover opacity-75"
                        unoptimized
                      />
                    ) : (
                      <Film className="w-8 h-8 text-slate-600" />
                    )}

                    <div className="absolute top-2 left-2 flex items-center gap-1.5 pointer-events-none">
                      <span className="px-2 py-0.5 rounded-lg bg-rose-900/80 backdrop-blur-xs text-[10px] font-bold text-white uppercase">
                        Na Lixeira
                      </span>
                    </div>

                    <div className="absolute bottom-2 right-2 pointer-events-none">
                      <span className="px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono">
                        {formatBytes(item.sizeBytes)}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 truncate" title={item.name}>
                        {item.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Movido em: {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString("pt-BR") : "Recentemente"}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleRestore(item)}
                        className="py-1.5 px-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                        title="Restaurar para o repositório ativo"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Restaurar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMediaToPermanentlyDelete(item)}
                        className="py-1.5 px-2.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                        title="Excluir permanentemente do armazenamento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Confirmação para Mover para a Lixeira */}
      {mediaToDelete && (() => {
        const isQueued =
          mediaToDelete.operationalStatus === "in_queue" ||
          mediaToDelete.operationalStatus === "scheduled" ||
          Boolean(mediaToDelete.queueName);

        return (
          <ConfirmDeleteModal
            isOpen={Boolean(mediaToDelete)}
            onClose={() => !isDeletingMedia && setMediaToDelete(null)}
            onConfirm={executeDelete}
            isDeleting={isDeletingMedia}
            title={isQueued ? "Excluir Mídia Vinculada a Fila" : "Mover Arquivo para a Lixeira"}
            itemName={mediaToDelete.name}
            description={
              isQueued
                ? `Esta mídia está agendada para publicação futura${
                    mediaToDelete.queueName ? ` na fila "${mediaToDelete.queueName}"` : ""
                  }. Se você continuar: a publicação futura será cancelada, a mídia será removida da fila e o slot será liberado.`
                : "Deseja mover este arquivo para a Lixeira? O arquivo deixará de aparecer no repositório ativo e na seleção de Reels/Carrosséis."
            }
            warningNote={
              isQueued
                ? "A publicação futura associada será cancelada imediatamente."
                : "Você poderá restaurar o arquivo da Lixeira a qualquer momento ou excluí-lo permanentemente."
            }
            confirmButtonText={isQueued ? "Excluir mesmo assim" : "Mover para a Lixeira"}
          />
        );
      })()}

      {/* Modal de Confirmação para Exclusão Permanente da Lixeira */}
      {mediaToPermanentlyDelete && (
        <ConfirmDeleteModal
          isOpen={Boolean(mediaToPermanentlyDelete)}
          onClose={() => !isPermanentlyDeleting && setMediaToPermanentlyDelete(null)}
          onConfirm={executePermanentDelete}
          isDeleting={isPermanentlyDeleting}
          title="Excluir Permanentemente do Armazenamento"
          itemName={mediaToPermanentlyDelete.name}
          description="Tem certeza de que deseja eliminar permanentemente este arquivo? O arquivo físico será removido do Storage e o registro será apagado. Esta ação não poderá ser desfeita."
          warningNote="A exclusão definitiva liberará o espaço deste arquivo no armazenamento seguro."
          confirmButtonText="Sim, excluir definitivamente"
        />
      )}

      {/* Modal de Pré-visualização do Vídeo */}
      <VideoPreviewModal
        video={previewVideo}
        isOpen={Boolean(previewVideo)}
        onClose={() => setPreviewVideo(null)}
      />
    </div>
  );
}
