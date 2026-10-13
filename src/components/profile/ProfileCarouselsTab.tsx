"use client";

import React, { useState, useMemo } from "react";
import { Account, CarouselPost, CarouselSlide, CarouselQueue, MediaItem } from "@/types";
import { useAppState } from "@/context/AppStateContext";
import { useToast } from "@/context/ToastContext";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { formatDate, formatTime } from "@/lib/utils";
import {
  Layers,
  Plus,
  Shuffle,
  Trash2,
  Copy,
  Edit,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  FileText,
  UploadCloud,
  CheckCircle2,
  FolderOpen,
  Image as ImageIcon,
  Play,
  Pause,
  Send,
  Calendar,
  Clock,
  Loader2,
  AlertCircle,
  GripVertical,
  CheckSquare,
  Square,
  X,
  RotateCcw,
  Eye,
} from "lucide-react";
import Image from "next/image";
import { CarouselQueueDetailsModal } from "@/components/queues/CarouselQueueDetailsModal";

interface ProfileCarouselsTabProps {
  account: Account;
  accountCarousels: CarouselPost[];
  accountQueues: CarouselQueue[];
}

export function ProfileCarouselsTab({
  account,
  accountCarousels,
  accountQueues,
}: ProfileCarouselsTabProps) {
  const {
    saveProfileCarousel,
    deleteProfileCarousel,
    publishCarouselNow,
    scheduleCarousel,
    shuffleProfileCarousels,
    toggleQueuePause,
    refreshCarousels,
    refreshScheduledPosts,
    refreshCarouselQueues,
    deleteCarouselQueue,
    profileMedia,
  } = useAppState();
  const { addToast } = useToast();

  const [subTab, setSubTab] = useState<"repositorio" | "novo" | "filas_ativas" | "filas_finalizadas">("repositorio");

  // Filtros do Repositório de Carrosséis
  const [repoFilter, setRepoFilter] = useState<"todos" | "disponiveis" | "em_fila" | "agendados" | "publicados" | "erro">("todos");
  const [repoSearch, setRepoSearch] = useState("");

  // Seleção Múltipla e Fila de Carrosséis
  const [selectedCarouselIds, setSelectedCarouselIds] = useState<string[]>([]);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [isCreatingQueue, setIsCreatingQueue] = useState(false);
  const [queueStartDate, setQueueStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [carouselsPerDay, setCarouselsPerDay] = useState<number>(1);
  const [queueDailyTimes, setQueueDailyTimes] = useState<string[]>(["18:00"]);
  const [queueCustomTime, setQueueCustomTime] = useState("12:00");
  const [queueUseVariation, setQueueUseVariation] = useState(true);
  const [queueVariationMinutes, setQueueVariationMinutes] = useState(5);

  // Reordenação de Carrosséis dentro do Modal de Fila
  const [orderedCarouselIds, setOrderedCarouselIds] = useState<string[]>([]);
  const [originalCarouselIds, setOriginalCarouselIds] = useState<string[]>([]);
  const [draggedCarouselIndex, setDraggedCarouselIndex] = useState<number | null>(null);
  const [dragOverCarouselIndex, setDragOverCarouselIndex] = useState<number | null>(null);

  // Detalhes e Ações de Filas
  const [selectedQueueForDetails, setSelectedQueueForDetails] = useState<string | null>(null);
  const [queueToDelete, setQueueToDelete] = useState<CarouselQueue | null>(null);
  const [isDeletingQueue, setIsDeletingQueue] = useState(false);

  // Estado do Construtor de Carrossel
  const [editingId, setEditingId] = useState<string | null>(null);
  const [carouselTitle, setCarouselTitle] = useState("");
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [captionOption, setCaptionOption] = useState<"profile_default" | "custom" | "none">("profile_default");
  const [customCaption, setCustomCaption] = useState("");
  const [isSavingCarousel, setIsSavingCarousel] = useState(false);
  const [uploadingSlideIndex, setUploadingSlideIndex] = useState<number | null>(null);

  // Drag & Drop de Slides no Construtor
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);
  const [dragOverSlideIndex, setDragOverSlideIndex] = useState<number | null>(null);

  // Modais de Ação
  const [carouselToDelete, setCarouselToDelete] = useState<CarouselPost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [carouselToPublish, setCarouselToPublish] = useState<CarouselPost | null>(null);
  const [isPublishingNow, setIsPublishingNow] = useState(false);

  const [carouselToSchedule, setCarouselToSchedule] = useState<CarouselPost | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);

  // Upload REAL de Slides para o Supabase Storage
  const handleUploadSlides = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    e.target.value = "";

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setUploadingSlideIndex(slides.length + i + 1);

      try {
        // 1. Solicita URL assinada para upload da imagem
        const res = await fetch("/api/media/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: account.id,
            filename: file.name,
            mediaType: "image",
            folder: "carousels",
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || `Erro ao preparar envio de ${file.name}`);
        }

        // 2. Upload binário no Storage
        const uploadRes = await fetch(data.media.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "image/jpeg" },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error(`Falha no upload para o Storage (código ${uploadRes.status})`);
        }

        // 3. Confirmação e registro em public.media
        const confirmRes = await fetch("/api/media/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: account.id,
            originalName: file.name,
            storagePath: data.media.storagePath,
            mediaType: "image",
            sizeBytes: file.size,
          }),
        });

        const confirmData = await confirmRes.json();
        if (!confirmRes.ok || !confirmData.success) {
          throw new Error(confirmData.message || "Erro ao registrar slide no banco.");
        }

        const savedMedia = confirmData.media;
        const newSlide: CarouselSlide = {
          id: savedMedia.id,
          mediaId: savedMedia.id,
          position: slides.length + 1,
          url: URL.createObjectURL(file), // Prévia local imediata
          type: "image",
          name: file.name,
          sizeBytes: file.size,
        };

        setSlides((prev) => [...prev, newSlide].map((s, idx) => ({ ...s, position: idx + 1 })));
      } catch (err) {
        console.error("Erro no upload do slide:", err);
        addToast({
          type: "error",
          title: "Falha no Envio do Slide",
          message: err instanceof Error ? err.message : `Não foi possível enviar ${file.name}`,
        });
      } finally {
        setUploadingSlideIndex(null);
      }
    }
  };

  // Reorganizar Slides: mover para a esquerda
  const handleMoveSlideLeft = (index: number) => {
    if (index === 0) return;
    setSlides((prev) => {
      const arr = [...prev];
      const temp = arr[index - 1];
      arr[index - 1] = arr[index];
      arr[index] = temp;
      return arr.map((s, i) => ({ ...s, position: i + 1 }));
    });
  };

  // Reorganizar Slides: mover para a direita
  const handleMoveSlideRight = (index: number) => {
    if (index === slides.length - 1) return;
    setSlides((prev) => {
      const arr = [...prev];
      const temp = arr[index + 1];
      arr[index + 1] = arr[index];
      arr[index] = temp;
      return arr.map((s, i) => ({ ...s, position: i + 1 }));
    });
  };

  // Remover Slide individual
  const handleRemoveSlide = (index: number) => {
    setSlides((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, position: i + 1 })));
  };

  // Reorganizar Slide via Drag and Drop
  const handleSlideDrop = (targetIndex: number) => {
    if (draggedSlideIndex === null || draggedSlideIndex === targetIndex) return;
    setSlides((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(draggedSlideIndex, 1);
      updated.splice(targetIndex, 0, moved);
      return updated.map((s, idx) => ({ ...s, position: idx + 1 }));
    });
    setDraggedSlideIndex(null);
    setDragOverSlideIndex(null);
  };

  // Ações de Seleção Múltipla e Fila
  const toggleSelectCarousel = (id: string) => {
    setSelectedCarouselIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllDisplayed = () => {
    const selectable = filteredCarousels
      .filter((c) => c.status !== "published")
      .map((c) => c.id);
    setSelectedCarouselIds(selectable);
  };

  const handleClearSelection = () => {
    setSelectedCarouselIds([]);
  };

  const handleOpenQueueModal = () => {
    if (selectedCarouselIds.length === 0) return;
    setOrderedCarouselIds([...selectedCarouselIds]);
    setOriginalCarouselIds([...selectedCarouselIds]);
    setCarouselsPerDay(1);
    setQueueDailyTimes(["18:00"]);
    setIsQueueModalOpen(true);
  };

  const handleCarouselsPerDayChange = (newCount: number) => {
    const val = Math.max(1, Math.min(newCount, 24));
    setCarouselsPerDay(val);
    setQueueDailyTimes((prev) => {
      if (prev.length === val) return prev;
      if (prev.length < val) {
        const defaultHours = ["12:00", "18:00", "20:00", "09:00", "15:00", "21:00", "08:00", "16:00"];
        const added = Array.from({ length: val - prev.length }, (_, i) => {
          return defaultHours[(prev.length + i) % defaultHours.length] || "12:00";
        });
        return [...prev, ...added];
      }
      return prev.slice(0, val);
    });
  };

  const handleEditQueueTime = (index: number, newTime: string) => {
    setQueueDailyTimes((prev) => {
      const updated = [...prev];
      updated[index] = newTime;
      return updated;
    });
  };

  const handleShuffleModal = () => {
    setOrderedCarouselIds((prev) => [...prev].sort(() => Math.random() - 0.5));
  };

  const handleRestoreOrderModal = () => {
    setOrderedCarouselIds([...originalCarouselIds]);
  };

  const handleCarouselDropModal = (targetIndex: number) => {
    if (draggedCarouselIndex === null || draggedCarouselIndex === targetIndex) return;
    setOrderedCarouselIds((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(draggedCarouselIndex, 1);
      updated.splice(targetIndex, 0, moved);
      return updated;
    });
    setDraggedCarouselIndex(null);
    setDragOverCarouselIndex(null);
  };

  const handleMoveCarouselModal = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedCarouselIds.length) return;
    setOrderedCarouselIds((prev) => {
      const updated = [...prev];
      const temp = updated[targetIndex];
      updated[targetIndex] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleCreateCarouselQueue = async () => {
    if (orderedCarouselIds.length === 0) return;
    setIsCreatingQueue(true);
    try {
      const res = await fetch("/api/carousels/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          carouselIds: orderedCarouselIds,
          startDate: queueStartDate,
          dailyTimes: queueDailyTimes,
          useRandomVariation: queueUseVariation,
          randomVariationMinutes: queueVariationMinutes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Falha ao criar fila de carrosséis");
      }

      addToast({
        type: "success",
        title: "Fila de Carrosséis Criada!",
        message: data.message || `${orderedCarouselIds.length} carrosséis foram programados com sucesso.`,
      });

      setSelectedCarouselIds([]);
      setIsQueueModalOpen(false);
      await refreshCarousels(account.id);
      await refreshCarouselQueues(account.id);
      await refreshScheduledPosts(account.id);
      setSubTab("filas_ativas");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      addToast({
        type: "error",
        title: "Erro ao Agendar Fila",
        message: msg,
      });
    } finally {
      setIsCreatingQueue(false);
    }
  };

  const handleExecuteDeleteQueue = async () => {
    if (!queueToDelete) return;
    setIsDeletingQueue(true);
    try {
      await deleteCarouselQueue(queueToDelete.id);
      setQueueToDelete(null);
      await refreshCarouselQueues(account.id);
      await refreshCarousels(account.id);
      await refreshScheduledPosts(account.id);
      addToast({
        type: "success",
        title: "Fila Excluída",
        message: "A fila e os agendamentos futuros foram removidos com sucesso.",
      });
    } catch (err: unknown) {
      addToast({
        type: "error",
        title: "Erro ao Excluir Fila",
        message: err instanceof Error ? err.message : "Não foi possível excluir a fila.",
      });
    } finally {
      setIsDeletingQueue(false);
    }
  };

  // Iniciar criação de novo carrossel limpo
  const handleStartNew = () => {
    setEditingId(null);
    setCarouselTitle(`Carrossel #${accountCarousels.length + 1}`);
    setSlides([]);
    setCaptionOption("profile_default");
    setCustomCaption("");
    setSubTab("novo");
  };

  // Editar carrossel existente
  const handleEdit = (c: CarouselPost) => {
    setEditingId(c.id);
    setCarouselTitle(c.title);
    setSlides(c.slides);
    setCaptionOption(c.caption ? "custom" : "profile_default");
    setCustomCaption(c.caption || "");
    setSubTab("novo");
  };

  // Salvar Carrossel REAL no Supabase
  const handleSaveCarousel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (slides.length === 0) {
      addToast({
        type: "error",
        title: "Carrossel Sem Imagens",
        message: "Adicione ao menos um slide para salvar o carrossel.",
      });
      return;
    }

    setIsSavingCarousel(true);
    try {
      const captionToSave =
        captionOption === "profile_default"
          ? account.defaultCarouselCaption
          : captionOption === "custom"
          ? customCaption
          : "";

      const slidesPayload = slides.map((s, idx) => ({
        mediaId: s.mediaId || s.id,
        position: idx + 1,
      }));

      const success = await saveProfileCarousel(account.id, {
        id: editingId || undefined,
        title: carouselTitle || `Carrossel #${accountCarousels.length + 1}`,
        caption: captionToSave,
        slides: slidesPayload,
      });

      if (success) {
        setSubTab("repositorio");
      }
    } finally {
      setIsSavingCarousel(false);
    }
  };

  // Executar "Postar Agora"
  const handleExecutePublishNow = async () => {
    if (!carouselToPublish) return;
    setIsPublishingNow(true);
    try {
      await publishCarouselNow(account.id, carouselToPublish.id);
      setCarouselToPublish(null);
    } finally {
      setIsPublishingNow(false);
    }
  };

  // Executar "Agendar Carrossel"
  const handleExecuteSchedule = async () => {
    if (!carouselToSchedule || !scheduleDate || !scheduleTime) {
      addToast({
        type: "warning",
        title: "Campos Obrigatórios",
        message: "Selecione a data e o horário para programar a publicação.",
      });
      return;
    }

    setIsScheduling(true);
    try {
      const scheduledAtIso = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
      const success = await scheduleCarousel(account.id, carouselToSchedule.id, scheduledAtIso);
      if (success) {
        setCarouselToSchedule(null);
      }
    } finally {
      setIsScheduling(false);
    }
  };

  // Filtragem de carrosséis
  const filteredCarousels = useMemo(() => {
    return accountCarousels.filter((c) => {
      // Filtro por busca
      if (repoSearch.trim()) {
        const query = repoSearch.toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(query);
        const matchesCaption = c.caption?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesCaption) return false;
      }

      // Filtro por status
      if (repoFilter === "todos") return true;
      if (repoFilter === "disponiveis") return c.status === "ready" || c.status === "draft";
      if (repoFilter === "em_fila") return c.status === "draft"; // em fila futura
      if (repoFilter === "agendados") return c.status === "scheduled";
      if (repoFilter === "publicados") return c.status === "published";
      if (repoFilter === "erro") return c.status === "error";

      return true;
    });
  }, [accountCarousels, repoFilter, repoSearch]);

  const activeQueues = useMemo(() => {
    return accountQueues.filter((q) => q.status === "active" || q.status === "paused");
  }, [accountQueues]);

  const finishedQueues = useMemo(() => {
    return accountQueues.filter(
      (q) => q.status === "completed" || q.status === "completed_with_errors" || q.status === "cancelled"
    );
  }, [accountQueues]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Sub-navegação interna de Carrosséis */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setSubTab("repositorio")}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              subTab === "repositorio"
                ? "bg-white text-purple-600 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Repositório ({accountCarousels.length})</span>
          </button>

          <button
            type="button"
            onClick={handleStartNew}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              subTab === "novo"
                ? "bg-white text-purple-600 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{editingId ? "Editar Carrossel" : "Novo Carrossel"}</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("filas_ativas")}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              subTab === "filas_ativas"
                ? "bg-white text-purple-600 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Filas Ativas ({activeQueues.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("filas_finalizadas")}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              subTab === "filas_finalizadas"
                ? "bg-white text-purple-600 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Filas Finalizadas ({finishedQueues.length})</span>
          </button>
        </div>

        {subTab === "repositorio" && accountCarousels.length > 1 && (
          <button
            type="button"
            onClick={() => shuffleProfileCarousels(account.id)}
            className="py-1.5 px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5 text-purple-600" />
            <span>Embaralhar Ordem</span>
          </button>
        )}
      </div>

      {/* SUB-ABA 1: REPOSITÓRIO DE CARROSSÉIS */}
      {subTab === "repositorio" && (
        <div className="space-y-4">
          {/* Barra de Filtros e Busca */}
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
                Todos ({accountCarousels.length})
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
                Disponíveis ({accountCarousels.filter((c) => c.status === "ready" || c.status === "draft").length})
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
                Agendados ({accountCarousels.filter((c) => c.status === "scheduled").length})
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
                Publicados ({accountCarousels.filter((c) => c.status === "published").length})
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
                Com erro ({accountCarousels.filter((c) => c.status === "error").length})
              </button>
            </div>

            <div className="relative min-w-[200px]">
              <input
                type="text"
                value={repoSearch}
                onChange={(e) => setRepoSearch(e.target.value)}
                placeholder="Buscar por título ou legenda..."
                className="w-full py-1.5 pl-3 pr-8 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
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

          {/* Barra de Ações em Lote (quando há carrosséis selecionados) */}
          {selectedCarouselIds.length > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple-900">
                  {selectedCarouselIds.length} carrossel(is) selecionado(s)
                </span>
                <span className="text-slate-400 text-xs">•</span>
                <button
                  type="button"
                  onClick={handleSelectAllDisplayed}
                  className="text-xs text-purple-700 hover:text-purple-900 underline font-medium cursor-pointer"
                >
                  Selecionar todos disponíveis
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-xs text-slate-500 hover:text-slate-700 underline font-medium cursor-pointer"
                >
                  Desmarcar todos
                </button>
              </div>

              <button
                type="button"
                onClick={handleOpenQueueModal}
                className="py-1.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-purple-500/20 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Criar Fila de Carrosséis ({selectedCarouselIds.length})</span>
              </button>
            </div>
          )}

          {filteredCarousels.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 mx-auto">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Nenhum carrossel encontrado
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {accountCarousels.length === 0
                  ? "Crie carrosséis com múltiplos slides (imagens), organize a ordem e agende publicações automáticas."
                  : "Nenhum carrossel corresponde aos filtros selecionados."}
              </p>
              <button
                type="button"
                onClick={handleStartNew}
                className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-2xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Novo Carrossel</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCarousels.map((c, idx) => {
                const coverSlide = c.slides[0];
                const isSelected = selectedCarouselIds.includes(c.id);
                const isSelectable = c.status !== "published";

                return (
                  <div
                    key={c.id}
                    className={`bg-white border rounded-2xl p-4 shadow-2xs flex flex-col justify-between space-y-3 hover:shadow-md transition-all group ${
                      isSelected ? "border-purple-500 ring-2 ring-purple-100" : "border-slate-200"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                        {coverSlide ? (
                          <Image
                            src={coverSlide.url}
                            alt={c.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                            unoptimized
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-slate-300">
                            <ImageIcon className="w-12 h-12" />
                          </div>
                        )}

                        {/* Checkbox de Seleção */}
                        {isSelectable && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectCarousel(c.id);
                            }}
                            className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer shadow-sm ${
                              isSelected
                                ? "bg-purple-600 text-white"
                                : "bg-white/90 text-slate-400 hover:text-slate-800 hover:bg-white"
                            }`}
                            title={isSelected ? "Desmarcar carrossel" : "Selecionar para agendar em lote"}
                          >
                            {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                          </button>
                        )}

                        <span className={`absolute top-2 px-2 py-0.5 rounded-md bg-slate-900/80 text-white text-[10px] font-bold ${
                          isSelectable ? "left-9" : "left-2"
                        }`}>
                          #{idx + 1}
                        </span>
                        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-purple-600 text-white text-[10px] font-bold flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          {c.slides.length} slides
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {c.title}
                          </h4>
                          <StatusBadge status={c.status} />
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {c.caption || "Sem legenda associada"}
                        </p>
                        {c.scheduledAt && (
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 pt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>Programado para {formatDate(c.scheduledAt)} às {formatTime(c.scheduledAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      {/* Ações de Publicação */}
                      <div className="flex items-center gap-1.5">
                        {c.status !== "published" && (
                          <>
                            <button
                              type="button"
                              onClick={() => setCarouselToPublish(c)}
                              className="py-1 px-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                              title="Publicar agora no Instagram oficial"
                            >
                              <Send className="w-3 h-3" />
                              <span>Postar agora</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setCarouselToSchedule(c);
                                setScheduleDate(new Date().toISOString().split("T")[0]);
                                setScheduleTime("18:00");
                              }}
                              className="py-1 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Agendar publicação"
                            >
                              <Calendar className="w-3 h-3" />
                              <span>Agendar</span>
                            </button>
                          </>
                        )}
                      </div>

                      {/* Ações de Edição e Remoção */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(c)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Editar carrossel"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCarouselToDelete(c)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Excluir carrossel"
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
        </div>
      )}

      {/* SUB-ABA 2: NOVO CARROSSEL / CONSTRUTOR */}
      {subTab === "novo" && (
        <form onSubmit={handleSaveCarousel} className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingId ? "Editar Carrossel" : "Novo Carrossel"} para @{account.username}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Adicione slides de imagens, organize a ordem de exibição e configure a legenda antes de salvar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubTab("repositorio")}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Voltar ao repositório
              </button>
            </div>

            {/* Título */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Título de referência interna
              </label>
              <input
                type="text"
                value={carouselTitle}
                onChange={(e) => setCarouselTitle(e.target.value)}
                placeholder="Ex: 5 Dicas para Alavancar no Instagram"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-semibold"
                required
              />
            </div>

            {/* Slides / Imagens com Ordenação Interna */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Slides do Carrossel ({slides.length} imagens)
                </span>
                <label
                  htmlFor="carouselUploadInput"
                  className="text-xs text-purple-600 hover:text-purple-700 font-semibold cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar slides</span>
                  <input
                    id="carouselUploadInput"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleUploadSlides}
                    className="hidden"
                  />
                </label>
              </div>

              {slides.length === 0 ? (
                <label
                  htmlFor="carouselUploadEmpty"
                  className="p-8 text-center border-2 border-dashed border-purple-200 hover:border-purple-300 rounded-2xl bg-purple-50/20 hover:bg-purple-50/40 cursor-pointer block transition-colors"
                >
                  <ImageIcon className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">
                    Nenhuma imagem adicionada a este carrossel
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Clique aqui para selecionar os slides do seu computador.
                  </p>
                  <input
                    id="carouselUploadEmpty"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleUploadSlides}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {slides.map((slide, index) => (
                    <div
                      key={slide.id || index}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", index.toString());
                        setDraggedSlideIndex(index);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverSlideIndex !== index) {
                          setDragOverSlideIndex(index);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverSlideIndex === index) {
                          setDragOverSlideIndex(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleSlideDrop(index);
                      }}
                      onDragEnd={() => {
                        setDraggedSlideIndex(null);
                        setDragOverSlideIndex(null);
                      }}
                      className={`relative bg-slate-50 border rounded-xl p-2 flex flex-col justify-between space-y-2 group transition-all cursor-grab active:cursor-grabbing ${
                        dragOverSlideIndex === index
                          ? "border-purple-500 ring-2 ring-purple-300 scale-102 bg-purple-50/40"
                          : "border-slate-200"
                      } ${draggedSlideIndex === index ? "opacity-40" : ""}`}
                    >
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-900">
                        <Image
                          src={slide.url}
                          alt={`Slide ${index + 1}`}
                          fill
                          className="object-cover pointer-events-none"
                          unoptimized
                        />
                        <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                          {index + 1}
                        </span>
                        <div className="absolute top-1.5 right-1.5 p-1 rounded bg-slate-900/60 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveSlideLeft(index)}
                            className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-600 cursor-pointer"
                            title="Mover para esquerda"
                          >
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={index === slides.length - 1}
                            onClick={() => handleMoveSlideRight(index)}
                            className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 text-slate-600 cursor-pointer"
                            title="Mover para direita"
                          >
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveSlide(index)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Remover slide"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {uploadingSlideIndex !== null && (
                    <div className="relative aspect-square rounded-xl border-2 border-dashed border-purple-300 bg-purple-50/30 flex flex-col items-center justify-center p-3 text-center">
                      <Loader2 className="w-6 h-6 text-purple-600 animate-spin mb-1.5" />
                      <span className="text-[11px] font-semibold text-purple-700">
                        Enviando slide...
                      </span>
                    </div>
                  )}
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { id: "profile_default", label: "Usar legenda padrão do perfil" },
                  { id: "custom", label: "Digitar legenda personalizada" },
                  { id: "none", label: "Sem legenda" },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className={`p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all flex items-start gap-2 ${
                      captionOption === opt.id
                        ? "border-purple-600 bg-purple-50/50 text-purple-900 font-bold"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="carouselCaptionOption"
                      checked={captionOption === opt.id}
                      onChange={() => setCaptionOption(opt.id as any)}
                      className="mt-0.5 text-purple-600 focus:ring-purple-500"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>

              {captionOption === "profile_default" && (
                <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-200 text-xs space-y-1">
                  <span className="font-bold text-purple-900 block flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    Prévia da Legenda Padrão de Carrosséis de @{account.username}:
                  </span>
                  <p className="text-slate-700 italic bg-white p-2.5 rounded-lg border border-purple-100 leading-relaxed">
                    {account.defaultCarouselCaption || "Nenhuma legenda de carrossel configurada ainda neste perfil. Acesse a aba Configurações para definir."}
                  </p>
                </div>
              )}

              {captionOption === "custom" && (
                <div className="space-y-1.5">
                  <textarea
                    rows={3}
                    value={customCaption}
                    onChange={(e) => setCustomCaption(e.target.value)}
                    placeholder="Digite a legenda exclusiva para este carrossel..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isSavingCarousel}
                onClick={() => setSubTab("repositorio")}
                className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={slides.length === 0 || isSavingCarousel}
                className="py-2.5 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-sm shadow-purple-500/20 cursor-pointer"
              >
                {isSavingCarousel ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando Carrossel...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Salvar Carrossel no Perfil</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* SUB-ABA 3: FILAS ATIVAS DE CARROSSÉIS */}
      {subTab === "filas_ativas" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Filas Ativas de Carrosséis (@{account.username})
              </h3>
              <p className="text-xs text-slate-500">
                Filas em andamento ou pausadas com publicações programadas.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSubTab("repositorio")}
              className="py-1.5 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Fila</span>
            </button>
          </div>

          {activeQueues.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 mx-auto">
                <Layers className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                Nenhuma fila de carrosséis ativa
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Selecione carrosséis no Repositório para criar uma fila com distribuição diária e horários automáticos.
              </p>
              <button
                type="button"
                onClick={() => setSubTab("repositorio")}
                className="py-1.5 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Ir para Repositório</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeQueues.map((queue) => {
                const total = queue.totalCarousels || 1;
                const percent = Math.round((queue.publishedCount / total) * 100);
                const isPaused = queue.status === "paused";

                return (
                  <div
                    key={queue.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4 hover:border-slate-300 transition-all"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">{queue.name}</h4>
                        <StatusBadge status={queue.status} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Iniciada em {formatDate(queue.createdAt)}</span>
                        {queue.estimatedFinishAt && (
                          <>
                            <span>•</span>
                            <span className="font-medium text-purple-700">
                              Término estimado: {formatDate(queue.estimatedFinishAt)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">
                          {queue.publishedCount} de {queue.totalCarousels} publicados ({percent}%)
                        </span>
                        <div className="flex items-center gap-3 text-slate-500 text-xs">
                          <span>Restantes: <strong className="text-slate-800">{queue.remainingCount}</strong></span>
                          {queue.errorCount > 0 && (
                            <span className="text-rose-600 font-semibold">
                              Erros: {queue.errorCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isPaused ? "bg-amber-400" : "bg-purple-600"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] text-slate-500">
                        {queue.dailyTimes?.length || 1} postagens por dia • Horários: {queue.dailyTimes?.join(", ") || "18:00"}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedQueueForDetails(queue.id)}
                          className="py-1.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-purple-600" />
                          <span>Ver detalhes</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleQueuePause(queue.id, "carousel")}
                          className={`py-1.5 px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                            isPaused
                              ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                              : "border-slate-200 hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                          <span>{isPaused ? "Reativar" : "Pausar"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setQueueToDelete(queue)}
                          className="py-1.5 px-2.5 rounded-xl border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 text-xs font-semibold cursor-pointer transition-colors"
                          title="Excluir fila"
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
        </div>
      )}

      {/* SUB-ABA 4: FILAS FINALIZADAS DE CARROSSÉIS */}
      {subTab === "filas_finalizadas" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Filas Finalizadas de Carrosséis (@{account.username})
              </h3>
              <p className="text-xs text-slate-500">
                Histórico completo de filas de carrosséis concluídas ou encerradas.
              </p>
            </div>
          </div>

          {finishedQueues.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                Nenhuma fila finalizada até o momento
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Quando todas as postagens de uma fila forem concluídas, ela aparecerá automaticamente neste histórico.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {finishedQueues.map((queue) => {
                const total = queue.totalCarousels || 1;
                const percent = Math.round((queue.publishedCount / total) * 100);

                return (
                  <div
                    key={queue.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4 opacity-90 hover:opacity-100 transition-all"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">{queue.name}</h4>
                        <StatusBadge status={queue.status} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Iniciada em {formatDate(queue.createdAt)}</span>
                        {queue.estimatedFinishAt && (
                          <>
                            <span>•</span>
                            <span>Finalizada em {formatDate(queue.estimatedFinishAt)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">
                          {queue.publishedCount} de {queue.totalCarousels} publicados ({percent}%)
                        </span>
                        {queue.errorCount > 0 && (
                          <span className="text-rose-600 font-semibold text-xs">
                            {queue.errorCount} postagens com falha
                          </span>
                        )}
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            queue.errorCount > 0 ? "bg-amber-500" : "bg-teal-600"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {queue.totalCarousels} carrosséis programados
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedQueueForDetails(queue.id)}
                          className="py-1.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-purple-600" />
                          <span>Ver detalhes</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setQueueToDelete(queue)}
                          className="py-1.5 px-2.5 rounded-xl border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 text-xs font-semibold cursor-pointer transition-colors"
                          title="Excluir histórico da fila"
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
        </div>
      )}

      {/* Modal de Confirmação para Excluir Carrossel */}
      {carouselToDelete && (
        <Modal
          isOpen={Boolean(carouselToDelete)}
          onClose={() => !isDeleting && setCarouselToDelete(null)}
          title="Excluir Carrossel"
          description={`Carrossel: ${carouselToDelete.title}`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <p className="font-semibold flex items-center gap-1 text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                Aviso sobre a exclusão:
              </p>
              <p>
                O carrossel será excluído. Suas imagens originais continuarão salvas com segurança no repositório de mídias e no Storage.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setCarouselToDelete(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  if (carouselToDelete) {
                    setIsDeleting(true);
                    try {
                      await deleteProfileCarousel(account.id, carouselToDelete.id);
                      setCarouselToDelete(null);
                    } finally {
                      setIsDeleting(false);
                    }
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeleting ? "Excluindo..." : "Sim, excluir carrossel"}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Confirmação para Postar Agora */}
      {carouselToPublish && (
        <Modal
          isOpen={Boolean(carouselToPublish)}
          onClose={() => !isPublishingNow && setCarouselToPublish(null)}
          preventClose={isPublishingNow}
          title="Publicar Carrossel Imediatamente"
          description={`Conta: @${account.username}`}
          maxWidth="md"
        >
          <div className="space-y-4">
            {isPublishingNow && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
                <span className="font-medium">
                  A publicação já está sendo processada pelo Instagram. Por favor, aguarde a conclusão.
                </span>
              </div>
            )}

            <p className="text-xs text-slate-600 leading-relaxed">
              Deseja publicar o carrossel <strong>&ldquo;{carouselToPublish.title}&rdquo;</strong> ({carouselToPublish.slides.length} slides) agora na sua conta oficial do Instagram?
            </p>

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 space-y-1">
              <span className="font-bold block">Etapas da publicação no Instagram:</span>
              <span>1. Preparação das imagens e slides da postagem.</span><br />
              <span>2. Criação do álbum oficial no perfil.</span><br />
              <span>3. Publicação direta no feed da conta.</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isPublishingNow}
                onClick={() => setCarouselToPublish(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title={isPublishingNow ? "A publicação já está sendo processada pelo Instagram" : undefined}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPublishingNow}
                onClick={handleExecutePublishNow}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPublishingNow && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isPublishingNow ? "Publicando no Instagram..." : "Confirmar e Publicar Agora"}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Criação de Fila de Carrosséis */}
      {isQueueModalOpen && (
        <Modal
          isOpen={isQueueModalOpen}
          onClose={() => !isCreatingQueue && setIsQueueModalOpen(false)}
          preventClose={isCreatingQueue}
          title="Criar Fila de Carrosséis"
          description={`Agendar ${orderedCarouselIds.length} carrossel(is) para @${account.username}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            {isCreatingQueue && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-purple-600 animate-spin shrink-0" />
                <span className="font-medium">
                  Criando agendamentos sequenciais para os carrosséis selecionados...
                </span>
              </div>
            )}

            {/* Data de Início */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Data de Início das Postagens
              </label>
              <input
                type="date"
                value={queueStartDate}
                onChange={(e) => setQueueStartDate(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                required
              />
            </div>

            {/* Quantidade por Dia */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Quantidade de carrosséis por dia
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={orderedCarouselIds.length || 24}
                  value={carouselsPerDay}
                  onChange={(e) => handleCarouselsPerDayChange(parseInt(e.target.value) || 1)}
                  className="w-20 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-center focus:ring-1 focus:ring-purple-500 focus:outline-none"
                />
                <span className="text-xs text-slate-500">
                  {carouselsPerDay === 1 ? "1 carrossel por dia" : `${carouselsPerDay} carrosséis por dia`}
                </span>
              </div>
            </div>

            {/* Horários Diários Diretamente Editáveis */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Horários diários de publicação ({queueDailyTimes.length} {queueDailyTimes.length === 1 ? "horário" : "horários"})
              </label>
              <p className="text-[11px] text-slate-500">
                Clique diretamente em cada campo para digitar o horário desejado (ex: 06:00, 18:00).
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {queueDailyTimes.map((time, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[11px] font-bold text-purple-700 shrink-0">#{idx + 1}</span>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => handleEditQueueTime(idx, e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-1 text-xs font-mono font-bold text-slate-800 text-center focus:outline-none focus:ring-1 focus:ring-purple-500"
                      required
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Reordenação Visual dos Carrosséis com Drag & Drop */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Ordem de Publicação dos Carrosséis ({orderedCarouselIds.length})
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleShuffleModal}
                    className="py-1 px-2.5 rounded-lg border border-purple-200 hover:bg-purple-50 text-purple-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Embaralhar a ordem dos carrosséis nesta fila"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>Embaralhar Ordem</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRestoreOrderModal}
                    className="py-1 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Restaurar a sequência original da seleção"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restaurar Ordem Original</span>
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Arraste para reposicionar ou use os botões acima para ajustar a sequência de postagens.
              </p>

              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {orderedCarouselIds.map((cId, idx) => {
                  const cItem = accountCarousels.find((c) => c.id === cId);
                  if (!cItem) return null;
                  const cover = cItem.slides[0];
                  return (
                    <div
                      key={cId}
                      draggable
                      onDragStart={() => setDraggedCarouselIndex(idx)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverCarouselIndex !== idx) setDragOverCarouselIndex(idx);
                      }}
                      onDragLeave={() => {
                        if (dragOverCarouselIndex === idx) setDragOverCarouselIndex(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleCarouselDropModal(idx);
                      }}
                      onDragEnd={() => {
                        setDraggedCarouselIndex(null);
                        setDragOverCarouselIndex(null);
                      }}
                      className={`flex items-center justify-between p-2 rounded-xl border bg-white transition-all cursor-grab active:cursor-grabbing ${
                        dragOverCarouselIndex === idx
                          ? "border-purple-500 ring-2 ring-purple-200 bg-purple-50/50"
                          : "border-slate-200 hover:border-slate-300"
                      } ${draggedCarouselIndex === idx ? "opacity-40" : ""}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-800 text-[11px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                          {cover ? (
                            <Image src={cover.url} alt={cItem.title} fill className="object-cover" unoptimized />
                          ) : (
                            <div className="flex items-center justify-center h-full text-slate-300">
                              <ImageIcon className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{cItem.title}</p>
                          <span className="text-[10px] text-slate-400">{cItem.slides.length} slides</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveCarouselModal(idx, -1)}
                          className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-600 cursor-pointer"
                          title="Mover para cima"
                        >
                          <ArrowLeft className="w-3 h-3 rotate-90" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === orderedCarouselIds.length - 1}
                          onClick={() => handleMoveCarouselModal(idx, 1)}
                          className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-600 cursor-pointer"
                          title="Mover para baixo"
                        >
                          <ArrowRight className="w-3 h-3 rotate-90" />
                        </button>
                        <GripVertical className="w-3.5 h-3.5 text-slate-300 ml-1" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Variação Aleatória de Horários */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={queueUseVariation}
                  onChange={(e) => setQueueUseVariation(e.target.checked)}
                  className="text-purple-600 rounded-md focus:ring-purple-500"
                />
                <span>Variação inteligente de horário para aspecto orgânico</span>
              </label>
              {queueUseVariation && (
                <div className="flex items-center gap-2 text-xs text-slate-600 pl-6">
                  <span>Variação de até</span>
                  <select
                    value={queueVariationMinutes}
                    onChange={(e) => setQueueVariationMinutes(Number(e.target.value))}
                    className="p-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value={3}>± 3 minutos</option>
                    <option value={5}>± 5 minutos</option>
                    <option value={10}>± 10 minutos</option>
                    <option value={15}>± 15 minutos</option>
                  </select>
                </div>
              )}
            </div>

            {/* Resumo da Fila */}
            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-purple-900">
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                <span>Resumo da Distribuição:</span>
              </div>
              <p>
                Os <strong>{orderedCarouselIds.length}</strong> carrosséis selecionados serão distribuídos a <strong>{carouselsPerDay} por dia</strong> durante <strong>{Math.ceil(orderedCarouselIds.length / carouselsPerDay)} dias</strong>, iniciando em <strong>{formatDate(queueStartDate)}</strong>.
              </p>
            </div>

            {/* Botões do Modal */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isCreatingQueue}
                onClick={() => setIsQueueModalOpen(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isCreatingQueue || orderedCarouselIds.length === 0}
                onClick={handleCreateCarouselQueue}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isCreatingQueue && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isCreatingQueue ? "Agendando Fila..." : `Agendar ${orderedCarouselIds.length} Carrosséis`}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Detalhes da Fila de Carrosséis */}
      <CarouselQueueDetailsModal
        queueId={selectedQueueForDetails}
        isOpen={Boolean(selectedQueueForDetails)}
        onClose={() => setSelectedQueueForDetails(null)}
      />

      {/* Modal de Confirmação para Excluir Fila de Carrosséis */}
      {queueToDelete && (
        <Modal
          isOpen={Boolean(queueToDelete)}
          onClose={() => !isDeletingQueue && setQueueToDelete(null)}
          title="Excluir Fila de Carrosséis"
          description={`Fila: ${queueToDelete.name}`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <p className="font-semibold flex items-center gap-1 text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                Aviso sobre a exclusão da fila:
              </p>
              <p>
                A fila e todas as publicações ainda pendentes/agendadas associadas a ela serão canceladas. Os carrosséis originais e mídias permanecerão preservados no seu repositório.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeletingQueue}
                onClick={() => setQueueToDelete(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingQueue}
                onClick={handleExecuteDeleteQueue}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingQueue && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeletingQueue ? "Excluindo..." : "Sim, excluir fila"}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Agendamento de Carrossel */}
      {carouselToSchedule && (
        <Modal
          isOpen={Boolean(carouselToSchedule)}
          onClose={() => !isScheduling && setCarouselToSchedule(null)}
          title="Agendar Publicação de Carrossel"
          description={`Carrossel: ${carouselToSchedule.title}`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">
                  Data de Publicação
                </label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">
                  Horário (São Paulo)
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 font-mono"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isScheduling}
                onClick={() => setCarouselToSchedule(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isScheduling || !scheduleDate || !scheduleTime}
                onClick={handleExecuteSchedule}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isScheduling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isScheduling ? "Agendando..." : "Confirmar Agendamento"}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
