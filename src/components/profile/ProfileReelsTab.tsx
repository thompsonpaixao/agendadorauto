"use client";

import React, { useState, useMemo } from "react";
import { Account, MediaItem, ReelQueue } from "@/types";
import { useAppState } from "@/context/AppStateContext";
import { useToast } from "@/context/ToastContext";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatBytes, formatDate, formatTime, formatDuration } from "@/lib/utils";
import {
  Film,
  Plus,
  Shuffle,
  RotateCcw,
  Trash2,
  Play,
  Pause,
  Clock,
  Calendar,
  Check,
  FileText,
  UploadCloud,
  CheckCircle2,
  FolderOpen,
  Sparkles,
  Layers,
  Loader2,
  AlertCircle,
  X,
  Send,
  Eye,
} from "lucide-react";
import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
import { VideoPreviewModal } from "@/components/media/VideoPreviewModal";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { QueueDetailsModal } from "@/components/queues/QueueDetailsModal";
import { generateVideoMetadataAndThumbnail } from "@/lib/media-thumbnail";
import { getSaoPauloDateString } from "@/lib/schedule-calculator";

interface ProfileReelsTabProps {
  account: Account;
  accountMedia: MediaItem[];
  accountQueues: ReelQueue[];
}

export function ProfileReelsTab({
  account,
  accountMedia,
  accountQueues,
}: ProfileReelsTabProps) {
  const {
    addProfileMedia,
    deleteProfileMedia,
    addReelQueue,
    toggleQueuePause,
    deleteReelQueue,
    bulkActionReelQueues,
    refreshMedia,
    refreshAccounts,
    refreshScheduledPosts,
    refreshPublishedPosts,
    refreshErrors,
  } = useAppState();
  const { addToast } = useToast();

  const [subTab, setSubTab] = useState<"repositorio" | "nova-fila" | "filas" | "finalizadas">("repositorio");

  // Filtros do Repositório
  const [repoFilter, setRepoFilter] = useState<"todos" | "disponiveis" | "em_fila" | "agendados" | "publicados" | "erro">("todos");
  const [repoSearch, setRepoSearch] = useState<string>("");

  // Gestão de Filas
  const [isDeletingQueue, setIsDeletingQueue] = useState<boolean>(false);
  const [isExecutingBulk, setIsExecutingBulk] = useState<boolean>(false);
  const [bulkModal, setBulkModal] = useState<{
    open: boolean;
    action: "pause_all" | "resume_all" | "delete_all" | "delete_finished";
    title: string;
    description: string;
    confirmText: string;
  } | null>(null);

  // Filtra apenas vídeos da conta
  const videosInRepo = useMemo(() => {
    return accountMedia.filter((m) => m.type === "video");
  }, [accountMedia]);

  const filteredVideos = useMemo(() => {
    return videosInRepo.filter((m) => {
      if (repoSearch.trim()) {
        const query = repoSearch.toLowerCase();
        if (!m.name.toLowerCase().includes(query)) return false;
      }
      if (repoFilter === "todos") return true;
      if (repoFilter === "disponiveis") return !m.operationalStatus || m.operationalStatus === "available";
      if (repoFilter === "em_fila") return m.operationalStatus === "in_queue";
      if (repoFilter === "agendados") return m.operationalStatus === "scheduled" || m.operationalStatus === "publishing";
      if (repoFilter === "publicados") return m.operationalStatus === "published";
      if (repoFilter === "erro") return m.operationalStatus === "failed";
      return true;
    });
  }, [videosInRepo, repoFilter, repoSearch]);

  const activeQueues = useMemo(() => {
    return accountQueues.filter((q) => q.status === "active" || q.status === "paused");
  }, [accountQueues]);

  const finishedQueues = useMemo(() => {
    return accountQueues.filter((q) => q.status === "completed" || q.status === "completed_with_errors" || q.status === "cancelled");
  }, [accountQueues]);

  // Estado da Nova Fila
  const [queueName, setQueueName] = useState(`Fila de Reels - ${new Date().toLocaleDateString("pt-BR")}`);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [queueVideos, setQueueVideos] = useState<MediaItem[]>([]);
  const [originalOrder, setOriginalOrder] = useState<MediaItem[]>([]);
  const [postsPerDay, setPostsPerDay] = useState<number>(account.defaultReelsPerDay || 5);
  const [useCustomTimes, setUseCustomTimes] = useState<boolean>(false);
  const [dailyTimes, setDailyTimes] = useState<string[]>(
    account.defaultTimes.length > 0 ? account.defaultTimes : ["09:00", "12:00", "15:00", "18:00", "21:00"]
  );
  const [useRandomVariation, setUseRandomVariation] = useState<boolean>(true);
  const [captionMode, setCaptionMode] = useState<"profile_default" | "custom_all" | "individual" | "none">("profile_default");
  const [customCaption, setCustomCaption] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(getSaoPauloDateString());
  const [isCreatingQueue, setIsCreatingQueue] = useState<boolean>(false);
  const [queueToDelete, setQueueToDelete] = useState<ReelQueue | null>(null);

  // Estado da Ação "Postar Agora"
  const [publishNowVideo, setPublishNowVideo] = useState<MediaItem | null>(null);
  const [publishNowCaptionMode, setPublishNowCaptionMode] = useState<"profile_default" | "custom" | "none">("profile_default");
  const [publishNowCaption, setPublishNowCaption] = useState<string>("");
  const [isPublishingNow, setIsPublishingNow] = useState<boolean>(false);
  const [publishProgress, setPublishProgress] = useState<"idle" | "preparing" | "uploading" | "processing" | "published" | "failed">("idle");
  const [publishProgressMsg, setPublishProgressMsg] = useState<string>("");

  interface UploadingItem {
    id: string;
    file: File;
    name: string;
    sizeBytes: number;
    durationSeconds: number;
    thumbnailUrl: string;
    thumbnailBlob: Blob | null;
    width: number;
    height: number;
    progress: number;
    status: "uploading" | "confirming" | "success" | "error";
    errorMessage?: string;
    target: "repo" | "queue";
  }

  const [uploadingItems, setUploadingItems] = useState<UploadingItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<MediaItem | null>(null);
  const [selectedQueueForDetails, setSelectedQueueForDetails] = useState<string | null>(null);
  const [mediaToDelete, setMediaToDelete] = useState<MediaItem | null>(null);
  const [isDeletingMedia, setIsDeletingMedia] = useState(false);
  const [batchDeleteModalOpen, setBatchDeleteModalOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  const executeDeleteMedia = async () => {
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
      const ok = await deleteProfileMedia(account.id, mediaToDelete.id);
      if (ok) {
        setSelectedVideoIds((prev) => prev.filter((id) => id !== mediaToDelete.id));
        setMediaToDelete(null);
        void refreshMedia(account.id);
        void refreshScheduledPosts(account.id);
        void refreshAccounts();
      }
    } catch {
      // Toast já tratado
    } finally {
      setIsDeletingMedia(false);
    }
  };

  const handleExecuteBatchDelete = async () => {
    if (isBatchDeleting || selectedVideoIds.length === 0) return;
    setIsBatchDeleting(true);

    try {
      const res = await fetch("/api/media/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: selectedVideoIds }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Erro ao processar exclusão em massa.");
      }

      const blockedIds: string[] = Array.isArray(data.blocked) ? data.blocked : [];

      setSelectedVideoIds(blockedIds);
      setBatchDeleteModalOpen(false);

      void refreshMedia(account.id);
      void refreshScheduledPosts(account.id);
      void refreshPublishedPosts(account.id);
      void refreshAccounts();

      addToast({
        type: data.deletedCount > 0 ? "success" : "warning",
        title: "Exclusão Concluída",
        message: data.message || `${data.deletedCount} Reel(s) excluído(s) com sucesso.`,
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

  // Intercepta tentativas de fechar ou recarregar página enquanto houver uploads ativos
  React.useEffect(() => {
    const hasActiveUploads = uploadingItems.some(
      (u) => u.status === "uploading" || u.status === "confirming"
    );

    if (!hasActiveUploads) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Existem uploads em andamento. Se você sair ou atualizar a página, eles serão interrompidos.";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [uploadingItems]);

  const executeRealUpload = async (item: UploadingItem) => {
    try {
      setUploadingItems((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, status: "uploading", errorMessage: undefined } : u))
      );

      // 1. Gera Signed Upload URLs do Supabase Storage
      const res = await fetch("/api/media/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          filename: item.file.name,
          hasThumbnail: Boolean(item.thumbnailBlob),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Erro ao preparar upload no Storage.");
      }

      // 2. Upload REAL do vídeo via XMLHttpRequest para monitoramento de progresso real
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", data.video.signedUrl);
        xhr.setRequestHeader("Content-Type", item.file.type || "video/mp4");

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.min(90, Math.round((event.loaded / event.total) * 90));
            setUploadingItems((prev) =>
              prev.map((u) => (u.id === item.id ? { ...u, progress: pct } : u))
            );
          }
        };

        xhr.onload = () => {
          // HTTP 304 não é erro (resposta normal de cache)
          if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304) {
            resolve();
          } else {
            let detail = "";
            try {
              const resJson = JSON.parse(xhr.responseText);
              detail = resJson.message || resJson.error || xhr.responseText;
            } catch {
              detail = xhr.responseText || "";
            }

            let reason = `Falha no upload (código ${xhr.status})`;
            if (
              xhr.status === 413 ||
              detail.toLowerCase().includes("exceeded") ||
              detail.toLowerCase().includes("payload too large") ||
              detail.toLowerCase().includes("too large")
            ) {
              const maxLabel = data?.provider === "r2" ? "1 GB" : "50 MB";
              reason = `Arquivo (${formatBytes(item.sizeBytes)}) excede o limite permitido (${maxLabel})`;
            } else if (xhr.status === 403) {
              reason = "Acesso negado ou link de upload expirado";
            } else if (detail) {
              reason = detail.substring(0, 120);
            }

            reject(new Error(reason));
          }
        };

        xhr.onerror = () => reject(new Error("Falha de conexão: upload interrompido pela rede"));
        xhr.send(item.file);
      });

      // 3. Upload REAL da thumbnail (se gerada)
      if (item.thumbnailBlob && data.thumbnail?.signedUrl) {
        await fetch(data.thumbnail.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": "image/jpeg" },
          body: item.thumbnailBlob,
        }).catch((e) => console.warn("Aviso ao enviar thumbnail:", e));
      }

      // 4. Confirmação atômica e inserção em public.media
      setUploadingItems((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, status: "confirming", progress: 95 } : u))
      );

      const confirmRes = await fetch("/api/media/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          originalName: item.name,
          storagePath: data.video.storagePath,
          thumbnailStoragePath: data.thumbnail?.storagePath || null,
          sizeBytes: item.sizeBytes,
          durationSeconds: item.durationSeconds,
          width: item.width,
          height: item.height,
        }),
      });

      const confirmData = await confirmRes.json();
      if (!confirmRes.ok || !confirmData.success) {
        throw new Error(confirmData.message || "Erro ao registrar o vídeo no banco de dados.");
      }

      const savedMedia: MediaItem = confirmData.media;

      // Adiciona ao repositório real
      addProfileMedia(account.id, [savedMedia]);

      if (item.target === "queue") {
        setQueueVideos((prev) => [...prev, savedMedia]);
        setOriginalOrder((prev) => [...prev, savedMedia]);
      }

      // Remove da lista de pendentes
      setUploadingItems((prev) => prev.filter((u) => u.id !== item.id));

      addToast({
        type: "success",
        title: "Reel Salvo com Sucesso!",
        message: `O vídeo "${item.name}" foi armazenado e está pronto para agendamento.`,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido durante upload";
      setUploadingItems((prev) =>
        prev.map((u) =>
          u.id === item.id ? { ...u, status: "error", errorMessage: errorMsg } : u
        )
      );

      // Registra erro de upload em error_logs para histórico técnico confiavel
      void fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          category: "upload",
          errorCode: "UPLOAD_FAILED",
          message: errorMsg,
          technicalDetails: {
            fileName: item.file.name,
            fileSize: item.sizeBytes,
            mimeType: item.file.type || "video/mp4",
            durationSeconds: item.durationSeconds,
            resolution: `${item.width}x${item.height}`,
            target: item.target,
            failedAt: new Date().toISOString(),
          },
        }),
      }).then(() => {
        void refreshErrors(account.id);
      }).catch(() => {});

      addToast({
        type: "error",
        title: "Falha no Upload do Reel",
        message: errorMsg,
      });
    }
  };

  const handleFilesSelected = async (fileList: FileList | File[], target: "repo" | "queue" = "repo") => {
    const files = Array.from(fileList).filter(
      (f) => f.type.startsWith("video/") || f.name.match(/\.(mp4|mov|avi|m4v|webm)$/i)
    );

    if (files.length === 0) {
      addToast({
        type: "error",
        title: "Arquivo Não Suportado",
        message: "Por favor, selecione arquivos de vídeo em formato MP4, MOV ou WEBM.",
      });
      return;
    }

    for (const file of files) {
      if (file.size > 1024 * 1024 * 1024) {
        addToast({
          type: "warning",
          title: "Arquivo Muito Grande",
          message: `O vídeo "${file.name}" possui ${(file.size / (1024 * 1024)).toFixed(1)} MB. O limite máximo da Meta para Reels é de 1 GB. Caso o envio falhe, reduza a resolução ou bitrate.`,
        });
      }

      const tempId = `up_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const meta = await generateVideoMetadataAndThumbnail(file);

      const newItem: UploadingItem = {
        id: tempId,
        file,
        name: file.name.replace(/\.[^/.]+$/, ""),
        sizeBytes: file.size,
        durationSeconds: meta.durationSeconds,
        thumbnailUrl: meta.thumbnailUrl,
        thumbnailBlob: meta.thumbnailBlob,
        width: meta.width,
        height: meta.height,
        progress: 0,
        status: "uploading",
        target,
      };

      setUploadingItems((prev) => [newItem, ...prev]);
      void executeRealUpload(newItem);
    }
  };

  const handleUploadToRepo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleFilesSelected(e.target.files, "repo");
      e.target.value = "";
    }
  };

  const handleUploadToQueue = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleFilesSelected(e.target.files, "queue");
      e.target.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent, target: "repo" | "queue" = "repo") => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFilesSelected(e.dataTransfer.files, target);
    }
  };

  // Carregar vídeos selecionados do repositório para a fila
  const handleLoadSelectedToQueue = () => {
    const selected = videosInRepo.filter((v) => selectedVideoIds.includes(v.id));
    if (selected.length === 0) {
      addToast({
        type: "warning",
        title: "Nenhum Vídeo Selecionado",
        message: "Marque os vídeos que deseja incluir na nova fila.",
      });
      return;
    }
    setQueueVideos(selected);
    setOriginalOrder(selected);
    setSubTab("nova-fila");
    addToast({
      type: "success",
      title: "Vídeos Carregados na Fila",
      message: `${selected.length} vídeos foram transferidos para o assistente de fila.`,
    });
  };

  // Embaralhar ordem
  const handleShuffle = () => {
    if (queueVideos.length <= 1) return;
    const shuffled = [...queueVideos].sort(() => Math.random() - 0.5);
    setQueueVideos(shuffled);
    addToast({
      type: "info",
      title: "Ordem Embaralhada!",
      message: `${queueVideos.length} vídeos foram reorganizados aleatoriamente.`,
    });
  };

  // Restaurar ordem
  const handleRestore = () => {
    setQueueVideos([...originalOrder]);
    addToast({
      type: "info",
      title: "Ordem Restaurada",
      message: "Sequência original recuperada.",
    });
  };

  // Usar horários padrão do perfil
  const handleApplyProfileTimes = () => {
    const defaultCount = account.defaultReelsPerDay || (account.defaultTimes.length > 0 ? account.defaultTimes.length : 5);
    setPostsPerDay(defaultCount);
    setDailyTimes(account.defaultTimes.length > 0 ? account.defaultTimes : ["09:00", "12:00", "15:00", "18:00", "21:00"]);
    setUseCustomTimes(false);
    addToast({
      type: "success",
      title: "Horários do Perfil Aplicados",
      message: `Carregados ${account.defaultTimes.length} horários padrão de @${account.username} em modo somente leitura.`,
    });
  };

  const handleCustomTimesToggle = () => {
    setUseCustomTimes(true);
    syncDailyTimesCount(postsPerDay);
  };

  const syncDailyTimesCount = (targetCount: number) => {
    const count = Math.max(1, Math.min(24, targetCount));
    setDailyTimes((prev) => {
      if (prev.length === count) return prev;
      if (prev.length < count) {
        const result = [...prev];
        for (let i = prev.length; i < count; i++) {
          const fallback = account.defaultTimes[i] || `${String(9 + ((i * 3) % 14)).padStart(2, "0")}:00`;
          result.push(fallback);
        }
        return result;
      }
      return prev.slice(0, count);
    });
  };

  const handlePostsPerDayChange = (newCount: number) => {
    const count = Math.max(1, Math.min(24, newCount));
    setPostsPerDay(count);
    syncDailyTimesCount(count);
  };

  // Estimativa de dias (respeitando data de São Paulo sem desvio UTC)
  const totalDays = Math.max(1, Math.ceil((queueVideos.length || 1) / (postsPerDay || 1)));
  const estimatedDate = useMemo(() => {
    if (!startDate) return "—";
    const [year, month, day] = startDate.split("-").map(Number);
    if (!year || !month || !day) return "—";
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + totalDays);
    return d.toLocaleDateString("pt-BR");
  }, [startDate, totalDays]);

  // Criar Fila REAL no Supabase
  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (queueVideos.length === 0) {
      addToast({
        type: "error",
        title: "Fila Vazia",
        message: "Adicione ou selecione ao menos um vídeo para a fila.",
      });
      return;
    }

    setIsCreatingQueue(true);
    try {
      const ok = await addReelQueue({
        accountId: account.id,
        accountUsername: account.username,
        accountAvatar: account.profilePicture,
        name: queueName,
        totalVideos: queueVideos.length,
        publishedCount: 0,
        remainingCount: queueVideos.length,
        errorCount: 0,
        status: "active",
        videos: queueVideos,
        captionMode,
        customCaption: captionMode === "custom_all" ? customCaption : undefined,
        postsPerDay,
        dailyTimes,
        useRandomVariation,
        distributeUntilEmpty: true,
        startDate,
      });

      if (ok) {
        setQueueVideos([]);
        setSelectedVideoIds([]);
        setSubTab("filas");
      }
    } finally {
      setIsCreatingQueue(false);
    }
  };

  // Ação "Postar Agora" com estados progressivos reais
  const handleOpenPublishNow = (video: MediaItem) => {
    setPublishNowVideo(video);
    setPublishNowCaptionMode("profile_default");
    setPublishNowCaption(account.defaultReelCaption || "");
    setPublishProgress("idle");
    setPublishProgressMsg("");
  };

  const handleExecutePublishNow = async () => {
    if (!publishNowVideo) return;
    setIsPublishingNow(true);
    setPublishProgress("preparing");
    setPublishProgressMsg("Preparando arquivos e gerando assinatura segura...");

    try {
      let finalCaption = "";
      if (publishNowCaptionMode === "profile_default") {
        finalCaption = account.defaultReelCaption || "";
      } else if (publishNowCaptionMode === "custom") {
        finalCaption = publishNowCaption;
      }

      setPublishProgress("uploading");
      setPublishProgressMsg("Enviando dados do Reel para o Instagram...");

      setPublishProgress("processing");
      setPublishProgressMsg("Processando vídeo e confirmando publicação no Instagram...");

      const res = await fetch("/api/reels/publish-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          mediaId: publishNowVideo.id,
          caption: finalCaption,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Erro na publicação do Reel.");
      }

      setPublishProgress("published");
      setPublishProgressMsg(
        data.permalink
          ? `Publicado com sucesso! Link: ${data.permalink}`
          : "Publicado com sucesso no Instagram oficial!"
      );

      addToast({
        type: "success",
        title: "Reel Publicado com Sucesso!",
        message: data.permalink
          ? `Publicado no Instagram: ${data.permalink}`
          : "O Reel foi publicado imediatamente na conta oficial.",
      });

      void refreshMedia(account.id);
      void refreshAccounts();
      void refreshScheduledPosts(account.id);
      void refreshPublishedPosts(account.id);

      setTimeout(() => {
        setPublishNowVideo(null);
        setPublishProgress("idle");
        setPublishProgressMsg("");
      }, 1500);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido ao publicar Reel";
      setPublishProgress("failed");
      setPublishProgressMsg(`Falha ao publicar: ${errorMsg}`);
      addToast({
        type: "error",
        title: "Falha na Publicação Imediata",
        message: errorMsg,
      });
    } finally {
      setIsPublishingNow(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Sub-navegação interna de Reels */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setSubTab("repositorio")}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              subTab === "repositorio"
                ? "bg-white text-rose-600 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Repositório ({videosInRepo.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("nova-fila")}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              subTab === "nova-fila"
                ? "bg-white text-rose-600 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Fila {queueVideos.length > 0 && `(${queueVideos.length})`}</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("filas")}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              subTab === "filas"
                ? "bg-white text-rose-600 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Filas Ativas ({activeQueues.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("finalizadas")}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              subTab === "finalizadas"
                ? "bg-white text-rose-600 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Filas Finalizadas ({finishedQueues.length})</span>
          </button>
        </div>

        {subTab === "repositorio" && (
          <label
            htmlFor="repoUploadInput"
            className="py-2 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Adicionar Reels a @{account.username}</span>
            <input
              id="repoUploadInput"
              type="file"
              multiple
              accept="video/*"
              onChange={handleUploadToRepo}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* SUB-ABA 1: REPOSITÓRIO DE REELS DO PERFIL */}
      {subTab === "repositorio" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Repositório de Reels de @{account.username}
              </h3>
              <p className="text-xs text-slate-500">
                Todos os arquivos abaixo pertencem exclusivamente a este perfil e nunca se misturam com outras contas.
              </p>
            </div>

            {selectedVideoIds.length > 0 && (
              <button
                type="button"
                onClick={handleLoadSelectedToQueue}
                className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Fila com {selectedVideoIds.length} Vídeos Selecionados</span>
              </button>
            )}
          </div>

          {/* Zona Unificada de Drag-and-Drop e Seleção de Vídeos */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "repo")}
            onClick={() => document.getElementById("repoUploadInput")?.click()}
            className={`p-6 border-2 border-dashed rounded-2xl transition-all text-center flex flex-col items-center justify-center gap-2.5 cursor-pointer ${
              isDragging
                ? "border-rose-500 bg-rose-50/50 scale-[1.01]"
                : "border-slate-200 hover:border-slate-300 bg-slate-50/60"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-white shadow-2xs border border-slate-200 flex items-center justify-center text-rose-600">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                {isDragging ? "Solte os vídeos de Reels aqui" : "Clique ou arraste vídeos para enviar"}
              </span>
              <span className="text-[11px] text-slate-400">
                Formatos suportados: MP4, MOV, WEBM • Upload direto no Storage privado
              </span>
            </div>
          </div>

          {videosInRepo.length === 0 && uploadingItems.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto">
                <Film className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Nenhum vídeo no repositório de @{account.username}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Faça upload de vídeos para criar o banco de Reels desta conta. Os arquivos são salvos no Storage e permanecem disponíveis após atualizar a página.
              </p>
              <label
                htmlFor="emptyRepoUpload"
                className="inline-flex items-center gap-2 py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Fazer Upload de Vídeos</span>
                <input
                  id="emptyRepoUpload"
                  type="file"
                  multiple
                  accept="video/*"
                  onChange={handleUploadToRepo}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Barra de Filtros Operacionais e Busca por Nome */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setRepoFilter("todos")}
                    className={`py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                      repoFilter === "todos"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                    }`}
                  >
                    Todos ({videosInRepo.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepoFilter("disponiveis")}
                    className={`py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                      repoFilter === "disponiveis"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    Disponíveis ({videosInRepo.filter((v) => !v.operationalStatus || v.operationalStatus === "available").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepoFilter("em_fila")}
                    className={`py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                      repoFilter === "em_fila"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-amber-50 hover:bg-amber-100 text-amber-700"
                    }`}
                  >
                    Em fila ({videosInRepo.filter((v) => v.operationalStatus === "in_queue").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepoFilter("agendados")}
                    className={`py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                      repoFilter === "agendados"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                    }`}
                  >
                    Agendados ({videosInRepo.filter((v) => v.operationalStatus === "scheduled" || v.operationalStatus === "publishing").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepoFilter("publicados")}
                    className={`py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                      repoFilter === "publicados"
                        ? "bg-teal-600 text-white shadow-xs"
                        : "bg-teal-50 hover:bg-teal-100 text-teal-700"
                    }`}
                  >
                    Publicados ({videosInRepo.filter((v) => v.operationalStatus === "published").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepoFilter("erro")}
                    className={`py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                      repoFilter === "erro"
                        ? "bg-rose-600 text-white shadow-xs"
                        : "bg-rose-50 hover:bg-rose-100 text-rose-700"
                    }`}
                  >
                    Com erro ({videosInRepo.filter((v) => v.operationalStatus === "failed").length})
                  </button>
                </div>

                <div className="relative min-w-[200px]">
                  <input
                    type="text"
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    placeholder="Buscar por nome..."
                    className="w-full py-1.5 pl-3 pr-8 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                  {repoSearch && (
                    <button
                      type="button"
                      onClick={() => setRepoSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 px-1">
                <div className="flex items-center gap-2">
                  <span>
                    Exibindo {filteredVideos.length} de {videosInRepo.length} vídeos
                    {uploadingItems.length > 0 && ` (${uploadingItems.length} enviando)`}
                  </span>
                  {selectedVideoIds.length > 0 && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                        {selectedVideoIds.length} selecionado{selectedVideoIds.length > 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                </div>

                {filteredVideos.length > 0 && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedVideoIds.length === filteredVideos.length) {
                          setSelectedVideoIds([]);
                        } else {
                          setSelectedVideoIds(filteredVideos.map((v) => v.id));
                        }
                      }}
                      className="text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
                    >
                      {selectedVideoIds.length === filteredVideos.length ? "Desmarcar todos" : "Selecionar todos exibidos"}
                    </button>

                    {selectedVideoIds.length > 0 && (
                      <>
                        <span className="text-slate-300">•</span>
                        <button
                          type="button"
                          onClick={() => setBatchDeleteModalOpen(true)}
                          className="py-1 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs text-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir selecionados</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Resumo de Upload em Massa */}
              {uploadingItems.length > 1 && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl flex flex-wrap items-center justify-between gap-2.5 text-xs text-indigo-950">
                  <div className="flex items-center gap-2">
                    <UploadCloud className="w-4 h-4 text-indigo-600 animate-pulse" />
                    <span>
                      <strong>{uploadingItems.length} arquivos selecionados:</strong>{" "}
                      {uploadingItems.filter((u) => u.status === "uploading" || u.status === "confirming").length} enviando •{" "}
                      <span className="text-emerald-700 font-bold">{uploadingItems.filter((u) => u.status === "success").length} concluídos</span>
                      {uploadingItems.some((u) => u.status === "error") && (
                        <strong className="text-rose-600 ml-1.5">
                          • {uploadingItems.filter((u) => u.status === "error").length} com erro
                        </strong>
                      )}
                    </span>
                  </div>
                  {uploadingItems.some((u) => u.status === "error") && (
                    <button
                      type="button"
                      onClick={() => setUploadingItems((prev) => prev.filter((u) => u.status !== "error"))}
                      className="text-xs text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
                    >
                      Dispensar erros
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {/* 1. CARDS TEMPORÁRIOS DE UPLOAD EM ANDAMENTO */}
                {uploadingItems.map((item) => (
                  <div
                    key={item.id}
                    className={`relative bg-white border rounded-2xl p-2 flex flex-col justify-between ${
                      item.status === "error"
                        ? "border-rose-300 bg-rose-50/20"
                        : "border-indigo-300 bg-indigo-50/10"
                    }`}
                  >
                    {item.status === "error" && (
                      <button
                        type="button"
                        onClick={() => setUploadingItems((prev) => prev.filter((u) => u.id !== item.id))}
                        className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer transition-colors"
                        title="Dispensar card"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-slate-900 mb-2">
                      {item.thumbnailUrl && (
                        <Image
                          src={item.thumbnailUrl}
                          alt={item.name}
                          fill
                          className="object-cover opacity-60"
                          unoptimized
                        />
                      )}
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-black/40">
                        {item.status === "error" ? (
                          <div className="space-y-1.5 w-full p-1 text-center">
                            <AlertCircle className="w-5 h-5 text-rose-500 mx-auto" />
                            <span className="text-[10px] text-rose-100 font-semibold block line-clamp-2" title={item.errorMessage}>
                              {item.errorMessage || "Erro no upload"}
                            </span>
                            <div className="flex items-center justify-center gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => executeRealUpload(item)}
                                className="text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-bold py-1 px-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Tentar novamente"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Tentar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setUploadingItems((prev) => prev.filter((u) => u.id !== item.id))}
                                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 py-1 px-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Dispensar card"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Dispensar</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 w-full px-2">
                            <Loader2 className="w-6 h-6 text-white animate-spin mx-auto" />
                            <span className="text-[11px] text-white font-bold block">
                              {item.status === "confirming" ? "Registrando..." : `Enviando... ${item.progress}%`}
                            </span>
                            <div className="w-full bg-white/30 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-indigo-500 h-full transition-all duration-200"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      {item.durationSeconds > 0 && (
                        <span className="absolute bottom-2 right-2 text-[10px] bg-slate-900/80 text-white px-1.5 py-0.5 rounded font-mono">
                          {formatDuration(item.durationSeconds)}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 px-1">
                      <span className="text-xs font-bold text-slate-800 truncate block">
                        {item.name}
                      </span>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{formatBytes(item.sizeBytes)}</span>
                        <span className={item.status === "error" ? "text-rose-600 font-bold" : "text-indigo-600 font-semibold"}>
                          {item.status === "error" ? "Falha" : `${item.progress}%`}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* 2. CARDS REAIS DE VÍDEOS PERSISTIDOS NO STORAGE / BANCO (9:16) */}
                {filteredVideos.map((video) => {
                  const isSelected = selectedVideoIds.includes(video.id);
                  const opStatus = video.operationalStatus || "available";

                  return (
                    <div
                      key={video.id}
                      className={`relative bg-white border rounded-2xl p-2 flex flex-col justify-between transition-all group ${
                        isSelected
                          ? "border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/20"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {/* Card Vertical 9:16 da Thumbnail - Clicar abre o modal de visualização */}
                      <div
                        onClick={() => setPreviewVideo(video)}
                        className="relative aspect-[9/16] rounded-xl overflow-hidden bg-slate-950 cursor-pointer mb-2 group/thumb"
                      >
                        <Image
                          src={video.thumbnailUrl || video.url}
                          alt={video.name}
                          fill
                          className="object-cover opacity-90 group-hover/thumb:opacity-100 group-hover/thumb:scale-105 transition-all duration-300"
                          unoptimized
                        />

                        {/* Badge de Status Operacional Real */}
                        <div className="absolute top-2 right-2 z-10">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs backdrop-blur-xs ${
                              opStatus === "published"
                                ? "bg-emerald-600 text-white"
                                : opStatus === "publishing"
                                ? "bg-cyan-600 text-white animate-pulse"
                                : opStatus === "scheduled"
                                ? "bg-indigo-600 text-white"
                                : opStatus === "in_queue"
                                ? "bg-amber-600 text-white"
                                : opStatus === "failed"
                                ? "bg-rose-600 text-white"
                                : "bg-slate-900/80 text-slate-100"
                            }`}
                          >
                            {opStatus === "published" && "Publicado"}
                            {opStatus === "publishing" && "Publicando..."}
                            {opStatus === "scheduled" && "Agendado"}
                            {opStatus === "in_queue" && "Em fila"}
                            {opStatus === "failed" && "Falhou"}
                            {opStatus === "available" && "Disponível"}
                          </span>
                        </div>

                        {/* Overlay com Ícone de Play ao passar o mouse */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                          <div className="w-10 h-10 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-lg transform group-hover/thumb:scale-110 transition-transform">
                            <Play className="w-5 h-5 fill-slate-900 ml-0.5" />
                          </div>
                        </div>

                        {/* Checkbox de Seleção Exclusiva */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-2 left-2 z-10"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedVideoIds((prev) =>
                                prev.includes(video.id)
                                  ? prev.filter((id) => id !== video.id)
                                  : [...prev, video.id]
                              );
                            }}
                            className="w-4 h-4 rounded border-white text-indigo-600 focus:ring-indigo-500 cursor-pointer shadow-sm"
                          />
                        </div>

                        {/* Duração no canto inferior */}
                        {video.durationSeconds !== undefined && video.durationSeconds > 0 && (
                          <span className="absolute bottom-2 right-2 text-[10px] bg-slate-900/80 text-white px-1.5 py-0.5 rounded-md font-mono backdrop-blur-xs">
                            {formatDuration(video.durationSeconds)}
                          </span>
                        )}
                      </div>

                      {/* Informações do Arquivo */}
                      <div className="space-y-1.5 px-1">
                        <span className="text-xs font-bold text-slate-800 truncate block" title={video.name}>
                          {video.name}
                        </span>

                        {/* Indicação visual clara se o vídeo estiver em fila */}
                        {(opStatus === "in_queue" || video.queueName) && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              if (video.queueId) setSelectedQueueForDetails(video.queueId);
                            }}
                            className="p-1 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                            title="Clique para ver o relatório desta fila"
                          >
                            <Layers className="w-3 h-3 text-indigo-600 shrink-0" />
                            <span className="truncate">Em fila: {video.queueName || "Fila Ativa"}</span>
                          </div>
                        )}

                        {video.deleteAfter && opStatus === "published" && (
                          <span className="text-[10px] text-emerald-600 font-medium block">
                            Retenção até {formatDate(video.deleteAfter)}
                          </span>
                        )}
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                          <span>{formatBytes(video.sizeBytes)}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPublishNow(video);
                              }}
                              className="text-indigo-600 hover:text-indigo-800 transition-colors p-1 cursor-pointer"
                              title="Postar este Reel agora no Instagram"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMediaToDelete(video);
                              }}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                              title="Excluir do repositório"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-ABA 2: NOVA FILA DE REELS */}
      {subTab === "nova-fila" && (
        <form onSubmit={handleCreateQueue} className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Nova Fila de Reels para @{account.username}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure vídeos, legendas, horários e distribuição automatizada.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={queueVideos.length <= 1}
                  onClick={handleShuffle}
                  className="py-1.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Shuffle className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Embaralhar Ordem</span>
                </button>

                <button
                  type="button"
                  disabled={queueVideos.length <= 1}
                  onClick={handleRestore}
                  className="py-1.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar</span>
                </button>
              </div>
            </div>

            {/* Nome da Fila */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Nome de identificação da fila
              </label>
              <input
                type="text"
                value={queueName}
                onChange={(e) => setQueueName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500 font-semibold"
              />
            </div>

            {/* Grade de Vídeos da Fila com Dropzone */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Vídeos na Fila ({queueVideos.length})
                </span>
                <label
                  htmlFor="queueUploadInput"
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Fazer upload de mais vídeos</span>
                  <input
                    id="queueUploadInput"
                    type="file"
                    multiple
                    accept="video/*"
                    onChange={handleUploadToQueue}
                    className="hidden"
                  />
                </label>
              </div>

              {queueVideos.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <Film className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">
                    Nenhum vídeo adicionado a esta fila
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
                    Você pode selecionar vídeos do repositório ou fazer upload agora mesmo.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubTab("repositorio")}
                    className="py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Selecionar do Repositório ({videosInRepo.length})</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {queueVideos.map((video, idx) => (
                    <div
                      key={video.id}
                      className="relative bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-col justify-between group"
                    >
                      <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-slate-900 mb-1.5">
                        <Image
                          src={video.thumbnailUrl}
                          alt={video.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="absolute bottom-1.5 right-1.5 text-[9px] bg-slate-900/80 text-white px-1 rounded font-mono">
                          {video.durationSeconds}s
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-800 truncate block max-w-[80px]">
                          {video.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenPublishNow(video)}
                            className="text-indigo-600 hover:text-indigo-800 p-0.5 transition-colors"
                            title="Postar este Reel agora no Instagram"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setQueueVideos((prev) => prev.filter((v) => v.id !== video.id))}
                            className="text-slate-400 hover:text-rose-600 p-0.5 transition-colors"
                            title="Remover da fila"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Configuração de Legenda */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Configuração de Legenda
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {[
                  { id: "profile_default", label: "Usar legenda padrão do perfil" },
                  { id: "custom_all", label: "Legenda personalizada para toda a fila" },
                  { id: "individual", label: "Usar legendas individuais" },
                  { id: "none", label: "Sem legenda" },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className={`p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all flex items-start gap-2 ${
                      captionMode === opt.id
                        ? "border-purple-600 bg-purple-50/50 text-purple-900 font-bold"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="captionMode"
                      checked={captionMode === opt.id}
                      onChange={() => setCaptionMode(opt.id as any)}
                      className="mt-0.5 text-purple-600 focus:ring-purple-500"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>

              {/* Prévia da Legenda Padrão do Perfil */}
              {captionMode === "profile_default" && (
                <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-200 text-xs space-y-1">
                  <span className="font-bold text-purple-900 block flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    Prévia da Legenda Padrão de @{account.username}:
                  </span>
                  <p className="text-slate-700 italic bg-white p-2.5 rounded-lg border border-purple-100 leading-relaxed">
                    {account.defaultReelCaption || "Nenhuma legenda padrão configurada ainda neste perfil. Acesse a aba Configurações para definir."}
                  </p>
                </div>
              )}

              {captionMode === "custom_all" && (
                <div className="space-y-1.5">
                  <textarea
                    rows={3}
                    value={customCaption}
                    onChange={(e) => setCustomCaption(e.target.value)}
                    placeholder="Digite a legenda que será aplicada a todos os vídeos desta fila..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              )}
            </div>

            {/* Horários e Distribuição Diária */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Frequência e Horários Diários
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApplyProfileTimes}
                    className={`py-1 px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      !useCustomTimes
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Usar horários padrão do perfil
                  </button>
                  <button
                    type="button"
                    onClick={handleCustomTimesToggle}
                    className={`py-1 px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      useCustomTimes
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Personalizar horários
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-600 block">
                      Reels por dia
                    </span>
                    {!useCustomTimes && (
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        Padrão do perfil
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={postsPerDay}
                    disabled={!useCustomTimes}
                    onChange={(e) => handlePostsPerDayChange(parseInt(e.target.value) || 1)}
                    className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600 block">
                    Data de início (São Paulo)
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                  />
                </div>

                <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200 space-y-1">
                  <span className="text-[11px] font-semibold text-indigo-700 block">
                    Estimativa de Conclusão
                  </span>
                  <span className="text-xs font-bold text-indigo-900 block pt-1">
                    {totalDays} dia(s) • término em {estimatedDate}
                  </span>
                </div>
              </div>

              {/* Lista de Horários */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 block">
                    {useCustomTimes
                      ? `Definir horários personalizados (${dailyTimes.length} horários)`
                      : `Horários padrão do perfil (${dailyTimes.length} horários)`}
                  </span>
                  {!useCustomTimes && (
                    <span className="text-[11px] text-slate-400">
                      Somente leitura • Para alterar, clique em &ldquo;Personalizar horários&rdquo;
                    </span>
                  )}
                </div>

                {useCustomTimes ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {dailyTimes.map((time, idx) => (
                      <div key={idx} className="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                        <label className="text-[10px] font-semibold text-slate-500 block">
                          Publicação #{idx + 1}
                        </label>
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDailyTimes((prev) => {
                              const updated = [...prev];
                              updated[idx] = val;
                              return updated;
                            });
                          }}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 font-mono focus:ring-1 focus:ring-indigo-500"
                          required
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {dailyTimes.map((time, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 font-mono"
                      >
                        {time}
                      </span>
                    ))}
                  </div>
                )}

                {/* Opção de Variação Aleatória de Horário */}
                <div className="pt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={useRandomVariation}
                      onChange={(e) => setUseRandomVariation(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                    />
                    <span className="font-medium">
                      Aplicar variação anti-detecção aleatória de horário (±5 minutos)
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-400 pl-6 mt-0.5">
                    Se desativado, o post será disparado no minuto exato configurado.
                  </p>
                </div>
              </div>
            </div>

            {/* Botão de Envio */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isCreatingQueue}
                onClick={() => setSubTab("repositorio")}
                className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={queueVideos.length === 0 || isCreatingQueue}
                className="py-2.5 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-sm shadow-rose-500/20 cursor-pointer"
              >
                {isCreatingQueue ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Criando fila de publicação...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Criar e Ativar Fila de Reels</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* SUB-ABAS DE FILAS: FILAS ATIVAS OU FILAS FINALIZADAS */}
      {(subTab === "filas" || subTab === "finalizadas") && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {subTab === "filas" ? "Filas Ativas de Reels" : "Filas Finalizadas"}
              </h3>
              <p className="text-xs text-slate-500">
                {subTab === "filas"
                  ? "Monitore o andamento dos Reels em processo de agendamento e postagem."
                  : "Histórico de filas com publicações concluídas ou encerradas."}
              </p>
            </div>

            {/* Ações em Lote e Criar Nova Fila */}
            <div className="flex items-center gap-2 flex-wrap">
              {subTab === "filas" && activeQueues.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setBulkModal({
                        open: true,
                        action: "pause_all",
                        title: "Pausar Todas as Filas Ativas",
                        description: `Deseja pausar todas as ${activeQueues.length} filas ativas deste perfil? Os agendamentos futuros não serão disparados enquanto as filas estiverem pausadas.`,
                        confirmText: "Sim, pausar todas",
                      })
                    }
                    className="py-1.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pausar todas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBulkModal({
                        open: true,
                        action: "resume_all",
                        title: "Retomar Todas as Filas Pausadas",
                        description: `Deseja reativar todas as filas pausadas de @${account.username}? As publicações continuarão conforme o cronograma.`,
                        confirmText: "Sim, retomar todas",
                      })
                    }
                    className="py-1.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Retomar todas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBulkModal({
                        open: true,
                        action: "delete_all",
                        title: "Excluir Todas as Filas do Perfil",
                        description: `ATENÇÃO: Deseja excluir todas as filas não concluídas de @${account.username}? Todos os agendamentos futuros serão cancelados. Mídias e publicações já realizadas serão preservadas.`,
                        confirmText: "Sim, excluir todas as filas",
                      })
                    }
                    className="py-1.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir todas</span>
                  </button>
                </>
              )}

              {subTab === "finalizadas" && finishedQueues.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setBulkModal({
                      open: true,
                      action: "delete_finished",
                      title: "Limpar Filas Finalizadas",
                      description: `Deseja limpar as ${finishedQueues.length} filas finalizadas de @${account.username}? Todo o histórico de posts publicados e arquivos de vídeo serão mantidos intactos.`,
                      confirmText: "Sim, limpar finalizadas",
                    })
                  }
                  className="py-1.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir finalizadas</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSubTab("nova-fila")}
                className="py-1.5 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Criar Nova Fila</span>
              </button>
            </div>
          </div>

          {/* Listagem de Filas */}
          {(subTab === "filas" ? activeQueues : finishedQueues).length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
              <Film className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800">
                {subTab === "filas" ? "Nenhuma fila ativa no momento" : "Nenhuma fila finalizada"}
              </h4>
              <p className="text-xs text-slate-400 mt-1 mb-3">
                {subTab === "filas"
                  ? "Crie sua primeira fila para programar a publicação contínua dos vídeos."
                  : "Filas com todas as publicações concluídas ou encerradas com falhas aparecerão aqui automaticamente."}
              </p>
              {subTab === "filas" && (
                <button
                  type="button"
                  onClick={() => setSubTab("nova-fila")}
                  className="py-1.5 px-3.5 rounded-xl bg-rose-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Iniciar Fila Agora</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {(subTab === "filas" ? activeQueues : finishedQueues).map((queue) => {
                const percent = Math.round((queue.publishedCount / (queue.totalVideos || 1)) * 100);
                const nextPostDisplay = queue.nextScheduledAt
                  ? `${formatDate(queue.nextScheduledAt)} às ${formatTime(queue.nextScheduledAt)}`
                  : "—";

                return (
                  <div
                    key={queue.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <h4 className="font-bold text-slate-900 text-sm">{queue.name}</h4>
                        <StatusBadge status={queue.status} />
                      </div>
                      <span className="text-xs text-slate-400">
                        Iniciada em {formatDate(queue.createdAt)}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">
                          {queue.publishedCount} de {queue.totalVideos} vídeos publicados ({percent}%)
                        </span>
                        <span className="text-slate-500">
                          {queue.remainingCount} aguardando
                          {queue.errorCount > 0 && (
                            <strong className="text-rose-600 ml-1.5">({queue.errorCount} falha{queue.errorCount !== 1 ? "s" : ""})</strong>
                          )}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            queue.status === "completed"
                              ? "bg-emerald-600"
                              : queue.status === "completed_with_errors"
                              ? "bg-amber-500"
                              : "bg-rose-600"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-slate-500">
                        {queue.status === "completed" ? (
                          <span className="text-emerald-600 font-semibold">Todas as postagens concluídas</span>
                        ) : queue.status === "completed_with_errors" ? (
                          <span className="text-amber-600 font-semibold">Finalizada com {queue.errorCount} erro(s)</span>
                        ) : (
                          <>Próxima: <strong className="text-rose-600">{nextPostDisplay}</strong></>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedQueueForDetails(queue.id)}
                          className="py-1 px-2.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Ver detalhes</span>
                        </button>
                        {(queue.status === "active" || queue.status === "paused") && (
                          <button
                            type="button"
                            onClick={() => toggleQueuePause(queue.id, "reel")}
                            className="py-1 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            {queue.status === "paused" ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                            <span>{queue.status === "paused" ? "Reativar" : "Pausar"}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isDeletingQueue}
                          onClick={() => setQueueToDelete(queue)}
                          className="py-1 px-2.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          title="Excluir fila"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Pré-visualização do Vídeo Reutilizável */}
      <VideoPreviewModal
        video={previewVideo}
        isOpen={Boolean(previewVideo)}
        onClose={() => setPreviewVideo(null)}
      />

      {/* Modal de Publicação Imediata: Postar Agora */}
      {publishNowVideo && (
        <Modal
          isOpen={Boolean(publishNowVideo)}
          preventClose={isPublishingNow}
          onClose={() => {
            if (!isPublishingNow) setPublishNowVideo(null);
          }}
          title="Postar Reel Imediatamente no Instagram"
        >
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="relative w-16 h-24 rounded-lg overflow-hidden bg-slate-900 shrink-0">
                <Image
                  src={publishNowVideo.thumbnailUrl || publishNowVideo.url}
                  alt={publishNowVideo.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h4 className="text-xs font-bold text-slate-900 truncate">
                  {publishNowVideo.name}
                </h4>
                <p className="text-[11px] text-slate-500">
                  Tamanho: {formatBytes(publishNowVideo.sizeBytes)}
                  {publishNowVideo.durationSeconds && ` • Duração: ${formatDuration(publishNowVideo.durationSeconds)}`}
                </p>
                <p className="text-[11px] font-semibold text-rose-600">
                  Perfil de destino: @{account.username}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 block">
                Escolha a Legenda para a Postagem
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="radio"
                    name="publishNowCaption"
                    checked={publishNowCaptionMode === "profile_default"}
                    onChange={() => setPublishNowCaptionMode("profile_default")}
                    disabled={isPublishingNow}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">
                      Usar legenda padrão do perfil
                    </span>
                    <span className="text-slate-500 text-[11px] line-clamp-2 block mt-0.5">
                      {account.defaultReelCaption || "(Nenhuma legenda padrão configurada no perfil)"}
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="radio"
                    name="publishNowCaption"
                    checked={publishNowCaptionMode === "custom"}
                    onChange={() => setPublishNowCaptionMode("custom")}
                    disabled={isPublishingNow}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500"
                  />
                  <div className="text-xs flex-1">
                    <span className="font-semibold text-slate-800 block">
                      Legenda personalizada
                    </span>
                    {publishNowCaptionMode === "custom" && (
                      <textarea
                        rows={3}
                        value={publishNowCaption}
                        onChange={(e) => setPublishNowCaption(e.target.value)}
                        disabled={isPublishingNow}
                        placeholder="Escreva a legenda deste Reel..."
                        className="w-full mt-2 p-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-rose-500 focus:outline-none disabled:bg-slate-100"
                      />
                    )}
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="radio"
                    name="publishNowCaption"
                    checked={publishNowCaptionMode === "none"}
                    onChange={() => setPublishNowCaptionMode("none")}
                    disabled={isPublishingNow}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Publicar sem legenda
                  </span>
                </label>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 flex items-start gap-2">
              <Clock className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                Esta ação enviará o vídeo imediatamente para o Instagram oficial. O vídeo será registrado como publicado e não precisará aguardar horários agendados.
              </span>
            </div>

            {/* Aviso de Bloqueio de Cancelamento durante Processamento */}
            {isPublishingNow && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-[11px] text-rose-800 flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="font-medium">
                  A publicação já está sendo processada pelo Instagram. O cancelamento foi bloqueado para garantir a integridade do envio.
                </span>
              </div>
            )}

            {/* Progresso com Estados Reais */}
            {(isPublishingNow || publishProgress !== "idle") && (
              <div className="p-3.5 rounded-xl border bg-slate-50 border-slate-200 space-y-1.5 animate-in fade-in">
                <div className="flex items-center gap-2">
                  {publishProgress === "published" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : publishProgress === "failed" ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin text-rose-600 shrink-0" />
                  )}
                  <span className="text-xs font-bold text-slate-800">
                    {publishProgress === "preparing" && "Preparando..."}
                    {publishProgress === "uploading" && "Enviando para o Instagram..."}
                    {publishProgress === "processing" && "Processando no Instagram..."}
                    {publishProgress === "published" && "Publicado com sucesso"}
                    {publishProgress === "failed" && "Falha ao publicar"}
                  </span>
                </div>
                {publishProgressMsg && (
                  <p className="text-[11px] text-slate-600 pl-6">
                    {publishProgressMsg}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isPublishingNow}
                onClick={() => setPublishNowVideo(null)}
                title={isPublishingNow ? "A publicação já está sendo processada pelo Instagram" : undefined}
                className="py-2 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPublishingNow}
                onClick={handleExecutePublishNow}
                className="py-2 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isPublishingNow ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Publicando no Instagram...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Publicar Agora</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Confirmação para Excluir Fila */}
      {queueToDelete && (
        <Modal
          isOpen={Boolean(queueToDelete)}
          onClose={() => setQueueToDelete(null)}
          title="Excluir Fila de Reels"
          description={`Fila: ${queueToDelete.name}`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
              <p className="font-semibold flex items-center gap-1.5 text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                Avisos importantes sobre a exclusão da fila:
              </p>
              <ul className="list-disc list-inside space-y-1 text-amber-800">
                <li><strong>Publicações anteriores:</strong> permanecem salvas no histórico.</li>
                <li><strong>Agendamentos futuros:</strong> serão cancelados.</li>
                <li><strong>Vídeos brutos:</strong> continuam preservados no repositório de mídias e no Storage.</li>
              </ul>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setQueueToDelete(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingQueue}
                onClick={async () => {
                  if (queueToDelete && !isDeletingQueue) {
                    setIsDeletingQueue(true);
                    try {
                      await deleteReelQueue(queueToDelete.id);
                    } finally {
                      setIsDeletingQueue(false);
                      setQueueToDelete(null);
                    }
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeletingQueue ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <span>Sim, excluir fila</span>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Confirmação para Ações em Massa nas Filas */}
      {bulkModal && (
        <Modal
          isOpen={bulkModal.open}
          onClose={() => {
            if (!isExecutingBulk) setBulkModal(null);
          }}
          title={bulkModal.title}
          description={bulkModal.description}
          maxWidth="md"
        >
          <div className="space-y-4 pt-1">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1.5">
              <p className="font-semibold text-slate-800">Detalhes da operação:</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                <li>Conta afetada: <strong>@{account.username}</strong></li>
                {bulkModal.action === "delete_all" && (
                  <>
                    <li>Posts futuros não publicados serão cancelados.</li>
                    <li>Vídeos e histórico de publicações são mantidos.</li>
                  </>
                )}
                {bulkModal.action === "delete_finished" && (
                  <li>Remove apenas filas já concluídas para limpeza visual.</li>
                )}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isExecutingBulk}
                onClick={() => setBulkModal(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isExecutingBulk}
                onClick={async () => {
                  if (bulkModal && !isExecutingBulk) {
                    setIsExecutingBulk(true);
                    try {
                      await bulkActionReelQueues(account.id, bulkModal.action);
                    } finally {
                      setIsExecutingBulk(false);
                      setBulkModal(null);
                    }
                  }
                }}
                className={`px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
                  bulkModal.action.startsWith("delete")
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-slate-900 hover:bg-black"
                }`}
              >
                {isExecutingBulk ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Executando...</span>
                  </>
                ) : (
                  <span>{bulkModal.confirmText}</span>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Universal de Confirmação de Exclusão de Mídia */}
      {mediaToDelete && (() => {
        const isQueued =
          mediaToDelete.operationalStatus === "in_queue" ||
          mediaToDelete.operationalStatus === "scheduled" ||
          Boolean(mediaToDelete.queueName);

        return (
          <ConfirmDeleteModal
            isOpen={Boolean(mediaToDelete)}
            onClose={() => !isDeletingMedia && setMediaToDelete(null)}
            onConfirm={executeDeleteMedia}
            isDeleting={isDeletingMedia}
            title={isQueued ? "Excluir Reel Vinculado a Fila" : "Excluir Reel do Repositório"}
            itemName={mediaToDelete.name}
            description={
              isQueued
                ? `Este Reel está agendado para publicação futura${
                    mediaToDelete.queueName ? ` na fila "${mediaToDelete.queueName}"` : ""
                  }. Se você continuar: a publicação futura será cancelada, o Reel será removido da fila e o slot será liberado.`
                : "Deseja mover este Reel para a Lixeira? O arquivo deixará de aparecer no repositório ativo."
            }
            warningNote={
              isQueued
                ? "A publicação futura associada será cancelada imediatamente."
                : "Você poderá restaurar o arquivo da Lixeira a qualquer momento ou excluí-lo permanentemente."
            }
            confirmButtonText={isQueued ? "Excluir mesmo assim" : "Excluir Reel"}
          />
        );
      })()}

      {/* Modal de Confirmação de Exclusão em Massa de Reels */}
      {batchDeleteModalOpen && (
        <ConfirmDeleteModal
          isOpen={batchDeleteModalOpen}
          onClose={() => !isBatchDeleting && setBatchDeleteModalOpen(false)}
          onConfirm={handleExecuteBatchDelete}
          isDeleting={isBatchDeleting}
          title={`Excluir ${selectedVideoIds.length} Reel${selectedVideoIds.length > 1 ? "s" : ""} ?`}
          itemName={`${selectedVideoIds.length} Reel${selectedVideoIds.length > 1 ? "s" : ""} selecionado${selectedVideoIds.length > 1 ? "s" : ""}`}
          description="Os arquivos selecionados serão removidos. Publicações futuras vinculadas a eles também serão canceladas."
          warningNote="Você poderá restaurar os arquivos da Lixeira a qualquer momento ou excluí-los permanentemente."
          confirmButtonText={isBatchDeleting ? "Excluindo..." : `Excluir ${selectedVideoIds.length} Reel${selectedVideoIds.length > 1 ? "s" : ""}`}
        />
      )}

      {/* Modal de Detalhes e Relatório da Fila */}
      <QueueDetailsModal
        queueId={selectedQueueForDetails}
        isOpen={Boolean(selectedQueueForDetails)}
        onClose={() => setSelectedQueueForDetails(null)}
      />
    </div>
  );
}
