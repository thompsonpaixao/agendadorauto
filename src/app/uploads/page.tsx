"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAppState } from "@/context/AppStateContext";
import { useToast } from "@/context/ToastContext";
import { MediaItem, RetentionStatus } from "@/types";
import {
  UploadCloud,
  Film,
  Image as ImageIcon,
  Clock,
  Trash2,
  Calendar,
  ShieldAlert,
  CheckCircle,
  Filter,
  Info,
  Play,
  Layers,
  Shield,
  Users,
  HardDrive,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Check,
} from "lucide-react";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import Image from "next/image";
import Link from "next/link";
import { VideoPreviewModal } from "@/components/media/VideoPreviewModal";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { QueueDetailsModal } from "@/components/queues/QueueDetailsModal";
import { formatBytes, formatDate, formatDuration, getSaoPauloDateString, isDateInSaoPauloInterval } from "@/lib/utils";

interface UploadQueueItem {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
  type: "video" | "image";
  progress: number;
  status: "queued" | "uploading" | "confirming" | "success" | "error";
  errorMessage?: string;
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

export default function UploadsPage() {
  const {
    accounts,
    profileMedia,
    deleteProfileMedia,
    addProfileMedia,
    storageUsage,
    refreshStorageUsage,
    refreshMedia,
    refreshScheduledPosts,
    refreshReelQueues,
  } = useAppState();
  const { addToast } = useToast();

  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [filterType, setFilterType] = useState<"all" | "video" | "image">("all");
  const [filterRetention, setFilterRetention] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("all");
  const [previewVideo, setPreviewVideo] = useState<MediaItem | null>(null);

  // Modais de Exclusão e Detalhes de Fila
  const [mediaToDelete, setMediaToDelete] = useState<MediaItem | null>(null);
  const [isDeletingMedia, setIsDeletingMedia] = useState(false);
  const [selectedQueueForDetails, setSelectedQueueForDetails] = useState<string | null>(null);

  // Seleção em massa e hidratação segura
  const [mounted, setMounted] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [batchDeleteModalOpen, setBatchDeleteModalOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [batchProtectedCount, setBatchProtectedCount] = useState(0);
  const [batchDeletableItems, setBatchDeletableItems] = useState<MediaItem[]>([]);

  useEffect(() => {
    setMounted(true);
    void refreshMedia(selectedAccountId);
    void refreshStorageUsage();
  }, [refreshMedia, refreshStorageUsage, selectedAccountId]);

  // Upload direto na página
  const [uploadTargetAccountId, setUploadTargetAccountId] = useState<string>("");
  const [uploadTab, setUploadTab] = useState<"video" | "image">("video");
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!uploadTargetAccountId && accounts.length > 0) {
      setUploadTargetAccountId(accounts[0].id);
    }
  }, [accounts, uploadTargetAccountId]);

  const toggleSelectMedia = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedMediaIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const allIds = filteredMedia.map((m) => m.id);
    setSelectedMediaIds(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedMediaIds([]);
  };

  const handleInitiateBatchDelete = () => {
    const selectedItems = profileMedia.filter((m) => selectedMediaIds.includes(m.id));
    // Hard block exclusivo apenas se a mídia estiver em upload/transcode ativo no Instagram
    const protectedItems = selectedItems.filter(
      (m) => m.operationalStatus === "publishing"
    );
    const deletable = selectedItems.filter(
      (m) => m.operationalStatus !== "publishing"
    );

    setBatchProtectedCount(protectedItems.length);
    setBatchDeletableItems(deletable);

    if (deletable.length === 0) {
      addToast({
        type: "warning",
        title: "Mídias em Processamento",
        message: "Todas as mídias selecionadas estão sendo processadas pelo Instagram e não podem ser excluídas agora.",
      });
      return;
    }

    setBatchDeleteModalOpen(true);
  };

  const handleExecuteBatchDelete = async () => {
    if (isBatchDeleting) return; // Proteção contra clique duplo
    setIsBatchDeleting(true);
    try {
      const res = await fetch("/api/media/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaIds: batchDeletableItems.map((m) => m.id),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Erro ao processar exclusão em massa.");
      }

      setBatchDeleteModalOpen(false);
      setSelectedMediaIds([]);
      void refreshMedia(selectedAccountId);
      void refreshScheduledPosts(selectedAccountId);
      void refreshReelQueues(selectedAccountId);
      void refreshStorageUsage();

      addToast({
        type: data.deletedCount > 0 ? "success" : "info",
        title: "Exclusão em Massa Concluída",
        message: data.message || `${data.deletedCount} mídia(s) excluída(s) com sucesso.`,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Erro na exclusão em massa";
      addToast({
        type: "error",
        title: "Falha na Exclusão em Massa",
        message: errorMsg,
      });
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const processUploadItem = async (item: UploadQueueItem, targetAccId: string) => {
    try {
      setUploadQueue((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, status: "uploading", errorMessage: undefined } : u))
      );

      const res = await fetch("/api/media/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: targetAccId,
          filename: item.file.name,
          mediaType: item.type,
          hasThumbnail: false,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Erro ao gerar URL de upload no Storage.");
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", data.media.signedUrl);
        xhr.setRequestHeader("Content-Type", item.file.type || (item.type === "video" ? "video/mp4" : "image/jpeg"));

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.min(90, Math.round((event.loaded / event.total) * 90));
            setUploadQueue((prev) =>
              prev.map((u) => (u.id === item.id ? { ...u, progress: pct } : u))
            );
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Falha no upload do arquivo para o Storage (código ${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error("Erro de rede durante o upload do arquivo."));
        xhr.send(item.file);
      });

      setUploadQueue((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, status: "confirming", progress: 95 } : u))
      );

      const confirmRes = await fetch("/api/media/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: targetAccId,
          originalName: item.name,
          storagePath: data.media.storagePath,
          sizeBytes: item.sizeBytes,
          mediaType: item.type,
        }),
      });

      const confirmData = await confirmRes.json();
      if (!confirmRes.ok || !confirmData.success) {
        throw new Error(confirmData.message || "Erro ao registrar a mídia no banco de dados.");
      }

      const savedMedia: MediaItem = confirmData.media;
      addProfileMedia(targetAccId, [savedMedia]);

      setUploadQueue((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, status: "success", progress: 100 } : u))
      );

      void refreshStorageUsage();
      void refreshMedia(targetAccId);

      addToast({
        type: "success",
        title: "Upload Concluído!",
        message: `"${item.name}" foi salvo com sucesso no repositório.`,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Erro durante o upload";
      setUploadQueue((prev) =>
        prev.map((u) =>
          u.id === item.id ? { ...u, status: "error", errorMessage: errorMsg } : u
        )
      );
      addToast({
        type: "error",
        title: "Falha no Upload",
        message: errorMsg,
      });
    }
  };

  const handleFilesSelected = async (fileList: FileList | File[]) => {
    if (!uploadTargetAccountId) {
      addToast({
        type: "warning",
        title: "Conta de Destino Obrigatória",
        message: "Por favor, selecione para qual perfil do Instagram você deseja enviar os arquivos.",
      });
      return;
    }

    const filesArray = Array.from(fileList);
    const validFiles: File[] = [];

    if (uploadTab === "video") {
      filesArray.forEach((f) => {
        if (f.type.startsWith("video/") || f.name.match(/\.(mp4|mov|avi|m4v|webm)$/i)) {
          validFiles.push(f);
        }
      });
      if (validFiles.length === 0) {
        addToast({
          type: "error",
          title: "Formato Inválido para Reels",
          message: "Selecione vídeos em formato MP4, MOV ou WEBM vertical (9:16).",
        });
        return;
      }
    } else {
      filesArray.forEach((f) => {
        if (f.type.startsWith("image/") || f.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
          validFiles.push(f);
        }
      });
      if (validFiles.length === 0) {
        addToast({
          type: "error",
          title: "Formato Inválido para Carrossel",
          message: "Selecione imagens em formato JPG, PNG ou WEBP.",
        });
        return;
      }
    }

    const newQueueItems: UploadQueueItem[] = validFiles.map((file, idx) => ({
      id: `up_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      file,
      name: file.name,
      sizeBytes: file.size,
      type: uploadTab,
      progress: 0,
      status: "queued",
    }));

    setUploadQueue((prev) => [...newQueueItems, ...prev]);

    for (const item of newQueueItems) {
      await processUploadItem(item, uploadTargetAccountId);
    }
  };

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
      const ok = await deleteProfileMedia(mediaToDelete.accountId, mediaToDelete.id);
      if (ok) {
        setMediaToDelete(null);
      }
    } catch {
      // Toast já tratado
    } finally {
      setIsDeletingMedia(false);
    }
  };

  const todaySP = getSaoPauloDateString();
  const filteredMedia = profileMedia.filter((m) => {
    if (selectedAccountId !== "all" && m.accountId !== selectedAccountId) return false;
    if (filterType !== "all" && m.type !== filterType) return false;
    if (filterRetention !== "all" && (m.retentionStatus || "active") !== filterRetention) return false;
    if (filterStatus !== "all" && (m.operationalStatus || "available") !== filterStatus) return false;
    if (filterDate !== "all" && m.createdAt) {
      if (filterDate === "today") {
        if (!isDateInSaoPauloInterval(m.createdAt, todaySP, todaySP)) return false;
      } else if (filterDate === "7d") {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        const start = getSaoPauloDateString(d);
        if (!isDateInSaoPauloInterval(m.createdAt, start, todaySP)) return false;
      } else if (filterDate === "30d") {
        const d = new Date();
        d.setDate(d.getDate() - 29);
        const start = getSaoPauloDateString(d);
        if (!isDateInSaoPauloInterval(m.createdAt, start, todaySP)) return false;
      }
    }
    return true;
  });

  const expiringNext7Days = profileMedia.filter((m) => {
    if (!m.deleteAfter) return false;
    const diff = new Date(m.deleteAfter).getTime() - Date.now();
    return diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const preservedErrorsCount = profileMedia.filter(
    (m) => m.retentionStatus === "preserved_due_to_error"
  ).length;

  const userUsage = storageUsage?.userUsage;
  const adminUsage = storageUsage?.adminUsage;

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Central de Mídias e Armazenamento
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Carregando repositório de mídias e métricas de armazenamento...
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-semibold">Carregando mídias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Título & Descrição */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Central de Mídias e Armazenamento
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Envie vídeos de Reels e imagens de Carrosséis diretamente, monitore o consumo real de armazenamento e gerencie arquivos.
        </p>
      </div>

      {/* PAINEL 1: USO REAL DE ARMAZENAMENTO DO USUÁRIO */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Consumo de Armazenamento Pessoal</h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
            {userUsage?.limitLabel || "Limite não definido"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl">
            <span className="text-[11px] font-semibold text-indigo-600 block">Total Utilizado</span>
            <span className="text-lg font-bold text-indigo-950 font-mono">
              {userUsage ? formatBytes(userUsage.totalBytes) : formatBytes(profileMedia.reduce((acc, m) => acc + (m.sizeBytes || 0), 0))}
            </span>
            <span className="text-[10px] text-indigo-500 block mt-0.5">
              {profileMedia.length} arquivos ativos
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 block flex items-center gap-1">
              <Film className="w-3.5 h-3.5 text-slate-600" /> Vídeos (Reels)
            </span>
            <span className="text-lg font-bold text-slate-800 font-mono">
              {userUsage ? formatBytes(userUsage.byType.videos.sizeBytes) : "—"}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {userUsage ? `${userUsage.byType.videos.count} vídeos` : "—"}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 block flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5 text-slate-600" /> Imagens (Carrosséis)
            </span>
            <span className="text-lg font-bold text-slate-800 font-mono">
              {userUsage ? formatBytes(userUsage.byType.images.sizeBytes) : "—"}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {userUsage ? `${userUsage.byType.images.count} imagens` : "—"}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 block flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" /> Retenção e Segurança
            </span>
            <span className="text-xs font-bold text-slate-800 block mt-1">
              {expiringNext7Days} limpeza em 7 dias
            </span>
            <span className="text-[10px] text-rose-600 font-medium block">
              {preservedErrorsCount} preservados por erro
            </span>
          </div>
        </div>

        {/* Consumo por Perfil do Instagram */}
        {storageUsage?.userUsage?.byAccount && storageUsage.userUsage.byAccount.length > 0 && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-slate-700">Por perfil:</span>
            {storageUsage.userUsage.byAccount.map((acc) => (
              <span
                key={acc.accountId}
                className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-mono text-[11px]"
              >
                @{acc.username}: <strong>{formatBytes(acc.totalBytes)}</strong> ({acc.count} arquivos)
              </span>
            ))}
          </div>
        )}

        {/* Informação sobre segurança e privacidade (sem caminhos técnicos) */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Seus arquivos são armazenados de forma privada em conformidade com as diretrizes de segurança da Meta.
            Mídias publicadas são mantidas por 7 dias para conferência antes da liberação de espaço.
          </p>
        </div>
      </div>

      {/* PAINEL 2: VISÃO DO ADMINISTRADOR (SOMENTE PARA ADMINS) */}
      {storageUsage?.isAdmin && adminUsage && (
        <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Painel Administrativo: Armazenamento Geral da Aplicação
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Acesso Restrito
                  </span>
                </h3>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Total Global: {formatBytes(adminUsage.global.totalBytes)} • {adminUsage.global.totalFiles} arquivos
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
              <span className="text-slate-400 block">Vídeos Globais (Reels)</span>
              <span className="text-base font-bold text-white font-mono">
                {formatBytes(adminUsage.global.byType.videos.sizeBytes)}
              </span>
              <span className="text-[10px] text-slate-400 block">
                {adminUsage.global.byType.videos.count} arquivos
              </span>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
              <span className="text-slate-400 block">Imagens Globais (Carrosséis)</span>
              <span className="text-base font-bold text-white font-mono">
                {formatBytes(adminUsage.global.byType.images.sizeBytes)}
              </span>
              <span className="text-[10px] text-slate-400 block">
                {adminUsage.global.byType.images.count} arquivos
              </span>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
              <span className="text-slate-400 block">Usuários com Arquivos</span>
              <span className="text-base font-bold text-white font-mono">
                {adminUsage.users.length} usuários
              </span>
              <span className="text-[10px] text-slate-400 block">
                Isolamento estrito sem expor URLs privadas
              </span>
            </div>
          </div>

          {/* Tabela de Consumo por Usuário */}
          <div className="space-y-2 pt-1">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Consumo de Armazenamento por Usuário
            </span>
            <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800 bg-slate-950/60 max-h-48 overflow-y-auto">
              {adminUsage.users.map((u) => (
                <div key={u.userId} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-800/40">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <div>
                      <span className="font-semibold text-slate-200">{u.email || u.name || "Usuário"}</span>
                      <span className="text-[10px] text-slate-500 font-mono ml-2">ID: {u.userId.substring(0, 8)}...</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 font-mono text-slate-300">
                    <span>{u.filesCount} arquivos</span>
                    <span className="font-bold text-indigo-400">{formatBytes(u.sizeBytes)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PAINEL 3: ÁREA DE UPLOAD DIRETO NA PÁGINA */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-indigo-600" />
              Upload Direto de Mídias
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Faça upload de vídeos para Reels ou imagens para Carrosséis e envie diretamente para o repositório oficial.
            </p>
          </div>

          {/* Seleção Obrigatória do Perfil de Destino */}
          <div className="flex items-center gap-2">
            <InstagramIcon className="w-4 h-4 text-pink-600 shrink-0" />
            <select
              value={uploadTargetAccountId}
              onChange={(e) => setUploadTargetAccountId(e.target.value)}
              className="text-xs font-semibold border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              {accounts.length === 0 && <option value="">Nenhuma conta conectada</option>}
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  Destino: @{acc.username}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Abas: Reels (Vídeos) vs Carrosséis (Imagens) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUploadTab("video")}
            className={`py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              uploadTab === "video"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Reels (Vídeos 9:16)</span>
          </button>

          <button
            type="button"
            onClick={() => setUploadTab("image")}
            className={`py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              uploadTab === "image"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Carrosséis (Imagens)</span>
          </button>
        </div>

        {/* Dropzone de Upload com Drag and Drop */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files) {
              void handleFilesSelected(e.dataTransfer.files);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-indigo-600 bg-indigo-50/50 scale-[0.99]"
              : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={uploadTab === "video" ? "video/mp4,video/quicktime,video/webm" : "image/jpeg,image/png,image/webp"}
            onChange={(e) => {
              if (e.target.files) {
                void handleFilesSelected(e.target.files);
              }
            }}
            className="hidden"
          />

          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>

          <h3 className="text-sm font-bold text-slate-800">
            {uploadTab === "video"
              ? "Arraste seus vídeos de Reels aqui ou clique para selecionar"
              : "Arraste as imagens do Carrossel aqui ou clique para selecionar"}
          </h3>

          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {uploadTab === "video"
              ? "Formatos aceitos: MP4, MOV ou WEBM vertical (9:16). Upload direto e seguro no armazenamento privado."
              : "Formatos aceitos: JPG, PNG ou WEBP. Ideal para posts individuais ou carrosséis com até 10 slides."}
          </p>
        </div>

        {/* Fila de Uploads em Andamento */}
        {uploadQueue.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Fila de Upload ({uploadQueue.length} itens)</span>
              <button
                type="button"
                onClick={() => setUploadQueue((prev) => prev.filter((u) => u.status === "uploading" || u.status === "confirming"))}
                className="text-slate-400 hover:text-slate-600 text-[11px]"
              >
                Limpar concluídos
              </button>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {uploadQueue.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {item.type === "video" ? (
                      <Film className="w-4 h-4 text-indigo-600 shrink-0" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-pink-600 shrink-0" />
                    )}
                    <span className="font-semibold text-slate-800 truncate" title={item.name}>
                      {item.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      ({formatBytes(item.sizeBytes)})
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {item.status === "uploading" && (
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full transition-all duration-200"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono font-bold text-indigo-600">
                          {item.progress}%
                        </span>
                      </div>
                    )}

                    {item.status === "confirming" && (
                      <span className="text-[11px] font-semibold text-amber-600 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Registrando...
                      </span>
                    )}

                    {item.status === "success" && (
                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Pronto
                      </span>
                    )}

                    {item.status === "error" && (
                      <span className="text-[11px] font-semibold text-rose-600 flex items-center gap-1" title={item.errorMessage}>
                        <AlertCircle className="w-3.5 h-3.5" /> Erro
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PAINEL 4: BARRA DE FILTROS DO REPOSITÓRIO */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Filtro por Perfil */}
        <div className="flex items-center gap-2">
          <InstagramIcon className="w-4 h-4 text-pink-600" />
          <select
            value={selectedAccountId}
            onChange={(e) => {
              const newAccId = e.target.value;
              setSelectedAccountId(newAccId);
              void refreshMedia(newAccId);
            }}
            className="text-xs font-semibold border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todos os Perfis ({accounts.length})</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                @{acc.username}
              </option>
            ))}
          </select>
        </div>

        {/* Filtros por Tipo e Retenção */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterType === "all" ? "bg-white text-slate-800 shadow-2xs font-semibold" : "text-slate-500"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setFilterType("video")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterType === "video" ? "bg-white text-slate-800 shadow-2xs font-semibold" : "text-slate-500"
              }`}
            >
              Vídeos
            </button>
            <button
              type="button"
              onClick={() => setFilterType("image")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterType === "image" ? "bg-white text-slate-800 shadow-2xs font-semibold" : "text-slate-500"
              }`}
            >
              Imagens
            </button>
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-hidden"
          >
            <option value="all">Todos os Status</option>
            <option value="available">Disponível</option>
            <option value="in_queue">Em Fila</option>
            <option value="scheduled">Agendado</option>
            <option value="publishing">Publicando</option>
            <option value="published">Publicado</option>
            <option value="failed">Com Erro</option>
          </select>

          <select
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-hidden"
          >
            <option value="all">Todo o Período</option>
            <option value="today">Hoje</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </select>

          <select
            value={filterRetention}
            onChange={(e) => setFilterRetention(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-hidden"
          >
            <option value="all">Todas as Retenções</option>
            <option value="active">Ativos</option>
            <option value="waiting_publication">Aguardando Publicação</option>
            <option value="eligible_for_deletion">Elegíveis para Exclusão</option>
            <option value="preserved_due_to_error">Preservados por Erro</option>
          </select>
        </div>
      </div>

      {/* BARRA DE SELEÇÃO EM MASSA */}
      {filteredMedia.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="font-semibold text-slate-700 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              Selecionar todos exibidos ({filteredMedia.length})
            </button>
            {selectedMediaIds.length > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Desmarcar todos
                </button>
              </>
            )}
          </div>

          {selectedMediaIds.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                {selectedMediaIds.length} selecionado{selectedMediaIds.length !== 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={handleInitiateBatchDelete}
                className="py-1 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir {selectedMediaIds.length} selecionado{selectedMediaIds.length !== 1 ? "s" : ""}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* PAINEL 5: GRID DE ARQUIVOS COM BADGES E EXCLUSÃO SEGURA */}
      {filteredMedia.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs">
          <UploadCloud className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-700">Nenhuma mídia encontrada</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Nenhum arquivo corresponde aos filtros selecionados. Use o painel de upload acima para adicionar novas mídias.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredMedia.map((item) => {
            const acc = accounts.find((a) => a.id === item.accountId);
            const badge = getRetentionBadge(item.retentionStatus, item.deleteAfter);
            const BadgeIcon = badge.icon;
            const isVideo =
              item.type === "video" ||
              item.durationSeconds !== undefined ||
              Boolean(item.thumbnailUrl && item.thumbnailUrl !== item.url);

            const isInQueue = item.operationalStatus === "in_queue" || Boolean(item.queueName);

            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs flex flex-col hover:border-slate-300 transition-all group"
              >
                {/* Thumbnail: 9:16 para vídeo, 1:1 para imagem */}
                <div
                  onClick={() => {
                    if (isVideo) setPreviewVideo(item);
                  }}
                  className={`relative ${
                    isVideo ? "aspect-[9/16] cursor-pointer" : "aspect-square"
                  } bg-slate-950 flex items-center justify-center overflow-hidden group/thumb`}
                >
                  {/* Checkbox de Seleção em Massa */}
                  <div
                    onClick={(e) => toggleSelectMedia(item.id, e)}
                    className={`absolute top-2 right-2 z-20 w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                      selectedMediaIds.includes(item.id)
                        ? "bg-indigo-600 text-white shadow-md"
                        : "bg-black/50 text-transparent hover:text-white/60 hover:bg-black/70 backdrop-blur-xs border border-white/30"
                    }`}
                    title={selectedMediaIds.includes(item.id) ? "Desmarcar mídia" : "Selecionar mídia"}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  {item.thumbnailUrl || item.url ? (
                    <Image
                      src={item.thumbnailUrl || item.url}
                      alt={item.name}
                      fill
                      className="object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                      unoptimized
                    />
                  ) : (
                    <Film className="w-8 h-8 text-slate-600" />
                  )}

                  {/* Play overlay se for vídeo */}
                  {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                      <div className="w-9 h-9 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-md transform group-hover/thumb:scale-110 transition-transform">
                        <Play className="w-4 h-4 fill-slate-900 ml-0.5" />
                      </div>
                    </div>
                  )}

                  <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                    {acc && (
                      <span className="px-2 py-0.5 rounded-lg bg-slate-900/80 backdrop-blur-xs text-[10px] font-bold text-white flex items-center gap-1">
                        <InstagramIcon className="w-2.5 h-2.5 text-pink-400" />
                        @{acc.username}
                      </span>
                    )}
                  </div>

                  <div className="absolute bottom-2 right-2 flex items-center gap-1 z-10">
                    {isVideo && item.durationSeconds !== undefined && item.durationSeconds > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-xs text-[10px] text-white font-mono">
                        {formatDuration(item.durationSeconds)}
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded-md bg-black/70 text-[10px] text-white font-mono">
                      {formatBytes(item.sizeBytes)}
                    </span>
                  </div>
                </div>

                {/* Dados do Arquivo */}
                <div className="p-3 flex-1 flex flex-col justify-between space-y-2.5">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 truncate" title={item.name}>
                      {item.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {formatDate(item.createdAt)}
                    </p>
                  </div>

                  {/* Badge de "Em Fila" com clique para detalhes */}
                  {isInQueue && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.queueId) setSelectedQueueForDetails(item.queueId);
                      }}
                      className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                      title="Clique para ver o relatório desta fila"
                    >
                      <Layers className="w-3 h-3 text-indigo-600 shrink-0" />
                      <span className="truncate">Em fila: {item.queueName || "Fila Ativa"}</span>
                    </div>
                  )}

                  {/* Badge de Retenção */}
                  <div className="space-y-1">
                    <div
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${badge.bg}`}
                    >
                      <BadgeIcon className="w-3 h-3" />
                      <span>{badge.label}</span>
                    </div>

                    {item.deleteAfter && item.retentionStatus === "eligible_for_deletion" && (
                      <p className="text-[10px] text-slate-400">
                        Previsto: {formatDate(item.deleteAfter)}
                      </p>
                    )}
                  </div>

                  {/* Ações com Confirmação Universal */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    {acc ? (
                      <Link
                        href={`/contas/${acc.id}?tab=uploads`}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        Ver no perfil →
                      </Link>
                    ) : (
                      <span className="text-[10px] text-slate-400">Conta desconectada</span>
                    )}

                    <button
                      type="button"
                      onClick={() => setMediaToDelete(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Excluir mídia do repositório"
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

      {/* MODAL UNIVERSAL DE CONFIRMAÇÃO DE EXCLUSÃO DE MÍDIA */}
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
                : "Tem certeza de que deseja mover este arquivo para a Lixeira? O arquivo deixará de aparecer no repositório ativo e na seleção de publicações."
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

      {/* MODAL UNIVERSAL DE CONFIRMAÇÃO DE EXCLUSÃO EM MASSA */}
      {batchDeleteModalOpen && (
        <ConfirmDeleteModal
          isOpen={batchDeleteModalOpen}
          onClose={() => !isBatchDeleting && setBatchDeleteModalOpen(false)}
          onConfirm={handleExecuteBatchDelete}
          isDeleting={isBatchDeleting}
          title={`Tem certeza que deseja excluir ${batchDeletableItems.length} mídia(s)?`}
          itemName={`${batchDeletableItems.length} arquivo(s) selecionado(s)`}
          description={`As mídias serão movidas para a Lixeira.${
            batchProtectedCount > 0
              ? ` Atenção: ${batchProtectedCount} arquivo(s) foram preservados automaticamente pois estão em processamento ativo no Instagram.`
              : ""
          } Se houver mídias vinculadas a filas ou agendamentos futuros, as publicações correspondentes serão canceladas.`}
          warningNote="Você poderá restaurar arquivos da Lixeira a qualquer momento ou excluí-lo permanentemente."
          confirmButtonText={isBatchDeleting ? "Excluindo..." : `Sim, excluir ${batchDeletableItems.length} mídias`}
        />
      )}

      {/* MODAL DE DETALHES DA FILA */}
      <QueueDetailsModal
        queueId={selectedQueueForDetails}
        isOpen={Boolean(selectedQueueForDetails)}
        onClose={() => setSelectedQueueForDetails(null)}
      />

      {/* MODAL DE PRÉ-VISUALIZAÇÃO DE VÍDEO */}
      <VideoPreviewModal
        video={previewVideo}
        isOpen={Boolean(previewVideo)}
        onClose={() => setPreviewVideo(null)}
      />
    </div>
  );
}
