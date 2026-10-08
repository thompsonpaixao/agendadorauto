"use client";

import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from "react";
import {
  Account,
  AccountStatus,
  ErrorLog,
  NotificationItem,
  ScheduledPost,
  PublishedPost,
  ReelQueue,
  CarouselQueue,
  SystemStatus,
  ServiceStatus,
  MediaItem,
  CarouselPost,
  StorageUsageResponse,
} from "@/types";
import {
  MOCK_ACCOUNTS,
  MOCK_ERRORS,
  MOCK_NOTIFICATIONS,
  MOCK_SCHEDULED_POSTS,
  MOCK_PUBLISHED_POSTS,
  MOCK_REEL_QUEUES,
  MOCK_CAROUSEL_QUEUES,
  MOCK_SYSTEM_STATUS,
  MOCK_PROFILE_MEDIA,
  MOCK_PROFILE_CAROUSELS,
} from "@/lib/mock-data";
import { useToast } from "./ToastContext";
import { useAuth } from "./AuthContext";
import { createClient } from "@/lib/supabase/client";

interface AppStateContextType {
  // Contas
  accounts: Account[];
  selectedAccountId: string; // "all" ou id da conta
  selectedAccount: Account | null;
  setSelectedAccountId: (id: string) => void;
  toggleAccountPause: (id: string) => void;
  reconnectAccount: (id: string) => void;
  addAccount: (account: Omit<Account, "id">) => void;
  refreshAccounts: () => Promise<void>;

  // Erros e Alertas
  errors: ErrorLog[];
  criticalErrorsCount: number;
  resolveError: (id: string) => void;
  retryError: (id: string) => void;
  ignoreError: (id: string) => void;
  refreshErrors: (accountId?: string) => Promise<void>;
  deleteErrorLog: (id: string) => Promise<boolean>;
  clearAllErrorLogs: (accountId?: string) => Promise<boolean>;

  // Notificações
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;

  // Postagens e Filas
  scheduledPosts: ScheduledPost[];
  publishedPosts: PublishedPost[];
  reelQueues: ReelQueue[];
  carouselQueues: CarouselQueue[];
  addReelQueue: (queue: Omit<ReelQueue, "id" | "createdAt">) => Promise<boolean>;
  addCarouselQueue: (queue: Omit<CarouselQueue, "id" | "createdAt">) => void;
  toggleQueuePause: (queueId: string, type: "reel" | "carousel") => void;
  deleteReelQueue: (queueId: string) => Promise<boolean>;
  bulkActionReelQueues: (
    accountId: string,
    action: "pause_all" | "resume_all" | "delete_all" | "delete_finished"
  ) => Promise<boolean>;
  refreshReelQueues: (accountId?: string) => Promise<void>;
  refreshCarouselQueues: (accountId?: string) => Promise<void>;
  deleteCarouselQueue: (queueId: string) => Promise<boolean>;
  refreshScheduledPosts: (accountId?: string) => Promise<void>;
  refreshPublishedPosts: (accountId?: string) => Promise<void>;

  // Repositório e Construtor do Perfil
  profileMedia: MediaItem[];
  refreshMedia: (accountId?: string) => Promise<void>;
  profileCarousels: CarouselPost[];
  refreshCarousels: (accountId?: string) => Promise<void>;
  addProfileMedia: (accountId: string, files: (MediaItem | Omit<MediaItem, "id" | "accountId">)[]) => void;
  deleteProfileMedia: (accountId: string, mediaId: string, permanent?: boolean) => Promise<boolean>;
  restoreProfileMedia: (accountId: string, mediaId: string) => Promise<boolean>;
  saveProfileCarousel: (
    accountId: string,
    carouselData: {
      id?: string;
      title: string;
      caption?: string;
      slides: { mediaId: string; position: number }[];
    }
  ) => Promise<boolean>;
  publishCarouselNow: (accountId: string, carouselId: string) => Promise<boolean>;
  scheduleCarousel: (
    accountId: string,
    carouselId: string,
    scheduledAt: string,
    caption?: string
  ) => Promise<boolean>;
  addProfileCarousel: (accountId: string, carousel: Omit<CarouselPost, "id" | "accountId">) => void;
  updateProfileCarousel: (accountId: string, carousel: CarouselPost) => void;
  deleteProfileCarousel: (accountId: string, carouselId: string) => Promise<boolean>;
  shuffleProfileCarousels: (accountId: string) => void;
  updateAccountSettings: (accountId: string, settings: Partial<Account>) => void;

  // Status e Modais
  systemStatus: SystemStatus;
  storageUsage: StorageUsageResponse | null;
  refreshStorageUsage: () => Promise<void>;
  isConnectModalOpen: boolean;
  setIsConnectModalOpen: (open: boolean) => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

function mapDbAccountToAccount(row: Record<string, unknown>): Account {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : undefined,
    username: String(row.username || ""),
    name: String(row.name || row.username || ""),
    profilePicture: (row.profile_picture_url as string) || (row.profile_picture as string) || "",
    status: (row.status as AccountStatus) || "connected",
    statusMessage: row.status_message ? String(row.status_message) : undefined,
    followers: typeof row.followers_count === "number" ? row.followers_count : typeof row.followers === "number" ? row.followers : 0,
    newFollowersToday: typeof row.new_followers_today === "number" ? row.new_followers_today : 0,
    postsToday: typeof row.posts_today === "number" ? row.posts_today : 0,
    postsInQueue: typeof row.posts_in_queue === "number" ? row.posts_in_queue : 0,
    postsLast7Days: typeof row.posts_last_7_days === "number" ? row.posts_last_7_days : 0,
    lastPublishedAt: row.last_published_at ? String(row.last_published_at) : undefined,
    successRate: row.success_rate != null ? Number(row.success_rate) : undefined,
    errorsCount: typeof row.errors_count === "number" ? row.errors_count : 0,
    defaultReelCaption: String(row.default_reel_caption || ""),
    defaultCarouselCaption: String(row.default_carousel_caption || ""),
    defaultReelsPerDay: typeof row.posts_per_day === "number" ? row.posts_per_day : typeof row.default_reels_per_day === "number" ? row.default_reels_per_day : 1,
    defaultCarouselsPerDay:
      typeof row.default_carousels_per_day === "number" ? row.default_carousels_per_day : 1,
    defaultTimes: Array.isArray(row.default_post_times)
      ? (row.default_post_times as string[])
      : Array.isArray(row.default_times)
      ? (row.default_times as string[])
      : ["09:00", "12:00", "15:00", "18:00", "21:00"],
    defaultCarouselTimes: Array.isArray(row.default_carousel_post_times)
      ? (row.default_carousel_post_times as string[])
      : ["18:00"],
    useRandomTimeVariation: row.use_random_time_variation !== false,
    randomVariationMinutes:
      typeof row.random_variation_minutes === "number" ? row.random_variation_minutes : 5,
    nextScheduledAt: row.next_scheduled_at ? String(row.next_scheduled_at) : undefined,
    connectionMode: row.connection_mode === "external" ? "external" : "development",
  };
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const { addToast } = useToast();
  const { supabaseUser, isConfigured } = useAuth();

  const [accounts, setAccounts] = useState<Account[]>(() => isConfigured ? [] : MOCK_ACCOUNTS);
  const [selectedAccountId, setSelectedAccountIdState] = useState<string>("all");
  const [errors, setErrors] = useState<ErrorLog[]>(() => isConfigured ? [] : MOCK_ERRORS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => isConfigured ? [] : MOCK_NOTIFICATIONS);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [publishedPosts, setPublishedPosts] = useState<PublishedPost[]>([]);
  const [reelQueues, setReelQueues] = useState<ReelQueue[]>([]);
  const [carouselQueues, setCarouselQueues] = useState<CarouselQueue[]>(() => isConfigured ? [] : MOCK_CAROUSEL_QUEUES);
  const [profileMedia, setProfileMedia] = useState<MediaItem[]>([]);
  const [profileCarousels, setProfileCarousels] = useState<CarouselPost[]>(() => isConfigured ? [] : MOCK_PROFILE_CAROUSELS);
  const [dbStatus, setDbStatus] = useState<ServiceStatus>("not_configured");
  const [storageStatus, setStorageStatus] = useState<ServiceStatus>("not_configured");
  const [storageUsage, setStorageUsage] = useState<StorageUsageResponse | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  // Sincronização de métricas reais de consumo de armazenamento (/api/storage/usage)
  const refreshStorageUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/storage/usage");
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setStorageUsage(data);
      }
    } catch (err) {
      console.warn("Aviso ao consultar métricas de armazenamento:", err);
    }
  }, []);

  // Sincronização de erros reais do Supabase (/api/errors)
  const refreshErrors = useCallback(async (accountId?: string) => {
    try {
      const url = accountId && accountId !== "all" ? `/api/errors?accountId=${accountId}` : "/api/errors";
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.errors)) {
        setErrors(data.errors);
      }
    } catch (err) {
      console.warn("Aviso ao carregar logs de erro:", err);
    }
  }, []);

  // Verificação de status real do Storage (/api/storage/status)
  const refreshStorageStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/storage/status");
      if (!response.ok) {
        setStorageStatus("error");
        return;
      }
      const data = await response.json();
      if (data.status === "connected") {
        setStorageStatus("connected");
      } else if (data.status === "error") {
        setStorageStatus("error");
      } else {
        setStorageStatus("not_configured");
      }
    } catch (err) {
      console.warn("Aviso ao carregar status do storage:", err);
      setStorageStatus("error");
    }
  }, []);

  useEffect(() => {
    void refreshStorageStatus();
    void refreshStorageUsage();
  }, [refreshStorageStatus, refreshStorageUsage]);

  // Sincronização de mídias reais do Supabase com Signed URLs
  const refreshMedia = useCallback(async (accountId?: string) => {
    try {
      const url = accountId && accountId !== "all" ? `/api/media?accountId=${accountId}` : "/api/media";
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.media)) {
        setProfileMedia(data.media);
      }
    } catch (err) {
      console.warn("Aviso ao carregar mídias reais:", err);
    }
  }, []);

  // Sincronização de filas de Reels reais do Supabase
  const refreshReelQueues = useCallback(async (accountId?: string) => {
    try {
      const url = accountId && accountId !== "all" ? `/api/reel-queues?accountId=${accountId}` : "/api/reel-queues";
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.queues)) {
        setReelQueues(data.queues);
      }
    } catch (err) {
      console.warn("Aviso ao carregar filas de Reels:", err);
    }
  }, []);

  // Sincronização de filas de Carrosséis reais do Supabase (/api/carousel-queues)
  const refreshCarouselQueues = useCallback(async (accountId?: string) => {
    try {
      const url = accountId && accountId !== "all" ? `/api/carousel-queues?accountId=${accountId}` : "/api/carousel-queues";
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.queues)) {
        setCarouselQueues(data.queues);
      }
    } catch (err) {
      console.warn("Aviso ao carregar filas de Carrosséis:", err);
    }
  }, []);

  // Sincronização de agendamentos reais do Supabase
  const refreshScheduledPosts = useCallback(async (accountId?: string) => {
    try {
      const url = accountId && accountId !== "all" ? `/api/scheduled-posts?accountId=${accountId}` : "/api/scheduled-posts";
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.posts)) {
        setScheduledPosts(data.posts);
      }
    } catch (err) {
      console.warn("Aviso ao carregar agendamentos:", err);
    }
  }, []);

  // Sincronização de publicações reais do Supabase
  const refreshPublishedPosts = useCallback(async (accountId?: string) => {
    try {
      const url = accountId && accountId !== "all" ? `/api/published-posts?accountId=${accountId}` : "/api/published-posts";
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.posts)) {
        setPublishedPosts(data.posts);
      }
    } catch (err) {
      console.warn("Aviso ao carregar publicações:", err);
    }
  }, []);

  // Sincronização de carrosséis reais do Supabase (/api/carousels)
  const refreshCarousels = useCallback(async (accountId?: string) => {
    try {
      const url = accountId && accountId !== "all" ? `/api/carousels?accountId=${accountId}` : "/api/carousels";
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.carousels)) {
        setProfileCarousels(data.carousels);
      }
    } catch (err) {
      console.warn("Aviso ao carregar carrosséis:", err);
    }
  }, []);

  // Sincronização de contas com o Supabase (filtradas por user_id via RLS em instagram_accounts)
  const refreshAccounts = useCallback(async () => {
    void refreshStorageStatus();
    void refreshMedia(selectedAccountId);
    void refreshCarousels(selectedAccountId);
    void refreshReelQueues(selectedAccountId);
    void refreshCarouselQueues(selectedAccountId);
    void refreshScheduledPosts(selectedAccountId);
    void refreshPublishedPosts(selectedAccountId);
    void refreshErrors(selectedAccountId);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("instagram_accounts")
        .select(
          "id, user_id, instagram_user_id, username, name, profile_picture_url, status, status_message, followers_count, media_count, default_reel_caption, default_carousel_caption, posts_per_day, default_post_times, default_carousels_per_day, default_carousel_post_times, use_random_time_variation, random_variation_minutes, connection_mode, created_at"
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Aviso ao carregar contas do Supabase:", error.message);
        setDbStatus("error");
        return;
      }

      setDbStatus("connected");
      if (data) {
        const mapped = data.map((item) => mapDbAccountToAccount(item as Record<string, unknown>));
        setAccounts(mapped);
      }
    } catch (err) {
      console.warn("Erro ao buscar contas conectadas:", err);
      setDbStatus("error");
    }
  }, [refreshStorageStatus, refreshMedia, refreshCarousels, refreshReelQueues, refreshCarouselQueues, refreshScheduledPosts, refreshPublishedPosts, refreshErrors, selectedAccountId]);

  useEffect(() => {
    let ignore = false;

    async function loadAccounts() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("instagram_accounts")
          .select(
            "id, user_id, instagram_user_id, username, name, profile_picture_url, status, status_message, followers_count, media_count, default_reel_caption, default_carousel_caption, posts_per_day, default_post_times, default_carousels_per_day, default_carousel_post_times, use_random_time_variation, random_variation_minutes, connection_mode, created_at"
          )
          .order("created_at", { ascending: false });

        if (!ignore) {
          if (error) {
            setDbStatus("error");
          } else {
            setDbStatus("connected");
            if (data) {
              setAccounts(data.map((item) => mapDbAccountToAccount(item as Record<string, unknown>)));
            }
          }
        }
      } catch (err) {
        console.warn("Erro ao buscar contas:", err);
        if (!ignore) {
          setDbStatus("error");
        }
      }
    }

    if (supabaseUser) {
      void loadAccounts();
      void refreshMedia(selectedAccountId);
      void refreshCarousels(selectedAccountId);
      void refreshReelQueues(selectedAccountId);
      void refreshScheduledPosts(selectedAccountId);
      void refreshPublishedPosts(selectedAccountId);
      void refreshErrors(selectedAccountId);
    }

    return () => {
      ignore = true;
    };
  }, [supabaseUser, refreshMedia, refreshReelQueues, refreshScheduledPosts, refreshPublishedPosts, refreshErrors, selectedAccountId]);

  // Polling Leve Reativo: Executado exclusivamente quando houver publicações ou retries em curso
  // (publishing, processing, retrying, ou nextRetryAt ativo). Finaliza automaticamente assim
  // que o Reel for publicado ou atingir estado definitivo, sem sobrecarregar a aplicação.
  const hasActiveTransientOperations = useMemo(() => {
    const hasTransientMedia = profileMedia.some(
      (m) =>
        m.status === "processing" ||
        m.operationalStatus === "publishing"
    );
    if (hasTransientMedia) return true;

    const hasTransientPosts = scheduledPosts.some(
      (p) =>
        p.status === "processing" ||
        (p.status as string) === "sending" ||
        (p.status as string) === "retrying" ||
        Boolean(p.nextRetryAt && new Date(p.nextRetryAt).getTime() > Date.now())
    );
    if (hasTransientPosts) return true;

    const hasTransientQueues = reelQueues.some(
      (q) =>
        q.status === "active" &&
        q.videos?.some(
          (v) =>
            v.status === "processing" ||
            v.operationalStatus === "publishing"
        )
    );
    if (hasTransientQueues) return true;

    return false;
  }, [profileMedia, scheduledPosts, reelQueues]);

  useEffect(() => {
    if (!supabaseUser || !hasActiveTransientOperations) return;

    const intervalId = setInterval(() => {
      void refreshScheduledPosts(selectedAccountId);
      void refreshMedia(selectedAccountId);
      void refreshReelQueues(selectedAccountId);
      void refreshPublishedPosts(selectedAccountId);
      void refreshErrors(selectedAccountId);
      void refreshStorageUsage();
    }, 6000);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    supabaseUser,
    hasActiveTransientOperations,
    selectedAccountId,
    refreshScheduledPosts,
    refreshMedia,
    refreshReelQueues,
    refreshPublishedPosts,
    refreshErrors,
    refreshStorageUsage,
  ]);

  // Status real dos serviços (Item 12: Não configurado, Conectado, Erro, Reconexão necessária)
  const metaApiStatus: ServiceStatus = useMemo(() => {
    if (accounts.length === 0) {
      return "not_configured";
    }
    const hasExpired = accounts.some((a) => a.status === "expired");
    if (hasExpired) return "reconnect_required";
    const hasError = accounts.some((a) => a.status === "error");
    if (hasError) return "error";
    const hasConnected = accounts.some((a) => a.status === "connected");
    if (hasConnected) return "connected";
    return "not_configured";
  }, [accounts]);

  const systemStatus: SystemStatus = useMemo(
    () => ({
      metaApi: metaApiStatus,
      database: isConfigured ? dbStatus : "not_configured",
      storage: storageStatus,
    }),
    [metaApiStatus, isConfigured, dbStatus, storageStatus]
  );

  // Conta ativa selecionada
  const selectedAccount = useMemo(() => {
    if (selectedAccountId === "all") return null;
    return accounts.find((a) => a.id === selectedAccountId) || null;
  }, [accounts, selectedAccountId]);

  const setSelectedAccountId = (id: string) => {
    setSelectedAccountIdState(id);
    if (id === "all") {
      addToast({
        type: "info",
        title: "Visão Global Ativada",
        message: "Mostrando métricas agregadas de todas as contas.",
      });
    } else {
      const acc = accounts.find((a) => a.id === id);
      if (acc) {
        addToast({
          type: "info",
          title: `Conta Selecionada: @${acc.username}`,
          message: "Painel filtrado para este perfil.",
        });
      }
    }
  };

  const toggleAccountPause = (id: string) => {
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === id) {
          const newStatus = acc.status === "paused" ? "connected" : "paused";
          return {
            ...acc,
            status: newStatus,
            statusMessage:
              newStatus === "paused"
                ? "Publicações pausadas pelo usuário."
                : undefined,
          };
        }
        return acc;
      })
    );

    const target = accounts.find((a) => a.id === id);
    if (target) {
      const willPause = target.status !== "paused";
      addToast({
        type: willPause ? "warning" : "success",
        title: willPause ? "Conta Pausada" : "Conta Reativada",
        message: willPause
          ? `@${target.username} teve suas publicações interrompidas temporariamente.`
          : `@${target.username} voltou a publicar normalmente.`,
      });
    }
  };

  const reconnectAccount = (id: string) => {
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === id) {
          return {
            ...acc,
            status: "connected",
            statusMessage: undefined,
            errorsCount: 0,
          };
        }
        return acc;
      })
    );

    // Remove erros pendentes para esta conta
    setErrors((prev) =>
      prev.map((err) =>
        err.accountId === id ? { ...err, status: "resolved" } : err
      )
    );

    const target = accounts.find((a) => a.id === id);
    addToast({
      type: "success",
      title: "Conta Reconectada!",
      message: `O token de acesso para @${target?.username || "conta"} foi renovado com sucesso via Meta OAuth.`,
    });
  };

  const addAccount = (newAccData: Omit<Account, "id">) => {
    const id = `acc_${Date.now()}`;
    const newAccount: Account = {
      ...newAccData,
      id,
    };
    setAccounts((prev) => [newAccount, ...prev]);
    setSelectedAccountIdState(id);
    addToast({
      type: "success",
      title: "Nova Conta Conectada!",
      message: `@${newAccount.username} foi integrada ao AgendadorAuto.`,
    });
  };

  const criticalErrorsCount = useMemo(() => {
    return errors.filter((e) => e.status === "pending" && e.severity === "critical").length;
  }, [errors]);

  const resolveError = (id: string) => {
    setErrors((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "resolved" } : e))
    );
    addToast({
      type: "success",
      title: "Erro Marcado como Resolvido",
      message: "O status da ocorrência foi atualizado.",
    });
  };

  const retryError = async (id: string) => {
    setErrors((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              attempts: e.attempts + 1,
              status: "retrying",
              lastAttemptAt: new Date().toISOString(),
            }
          : e
      )
    );
    addToast({
      type: "info",
      title: "Tentativa de Reenvio Iniciada",
      message: "Disparando o agendador de publicação para reprocessar pendências...",
    });

    try {
      const res = await fetch("/api/scheduler/publish", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast({
          type: data.published > 0 ? "success" : "info",
          title: data.published > 0 ? "Publicação Realizada!" : "Agendador Executado",
          message: data.message || "Rotina de publicação finalizada.",
        });
        void refreshErrors(selectedAccountId);
        void refreshScheduledPosts(selectedAccountId);
        void refreshPublishedPosts(selectedAccountId);
      } else {
        addToast({
          type: "warning",
          title: "Aviso do Agendador",
          message: data.message || "Nenhum post processado.",
        });
      }
    } catch (err) {
      console.error("Erro ao retentar publicação:", err);
      addToast({
        type: "error",
        title: "Erro de Conexão",
        message: "Não foi possível disparar o agendador.",
      });
    }
  };

  const deleteErrorLog = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/errors/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        setErrors((prev) => prev.filter((e) => e.id !== id));
        addToast({
          type: "success",
          title: "Erro Removido",
          message: "O log de erro foi excluído.",
        });
        return true;
      } else {
        addToast({
          type: "error",
          title: "Falha ao Excluir",
          message: data.message || "Não foi possível excluir o log.",
        });
        return false;
      }
    } catch {
      addToast({
        type: "error",
        title: "Erro de Rede",
        message: "Falha ao comunicar com o servidor.",
      });
      return false;
    }
  };

  const clearAllErrorLogs = async (accountId?: string): Promise<boolean> => {
    try {
      const url = accountId && accountId !== "all" ? `/api/errors?accountId=${accountId}` : "/api/errors";
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        if (accountId && accountId !== "all") {
          setErrors((prev) => prev.filter((e) => e.accountId !== accountId));
        } else {
          setErrors([]);
        }
        addToast({
          type: "success",
          title: "Logs de Erro Limpos",
          message: "Todos os registros de erro foram removidos com sucesso.",
        });
        return true;
      } else {
        addToast({
          type: "error",
          title: "Falha ao Limpar Erros",
          message: data.message || "Erro desconhecido.",
        });
        return false;
      }
    } catch {
      addToast({
        type: "error",
        title: "Erro de Conexão",
        message: "Não foi possível comunicar com o servidor.",
      });
      return false;
    }
  };

  const ignoreError = (id: string) => {
    setErrors((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "ignored" } : e))
    );
    addToast({
      type: "warning",
      title: "Erro Ignorado",
      message: "A ocorrência foi arquivada sem reenvio.",
    });
  };

  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    // Persistência segura server-side (sem permissão direta de update na tabela)
    fetch(`/api/notifications/${id}/read`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    }).catch(() => {});
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    addToast({
      type: "info",
      title: "Notificações Atualizadas",
      message: "Todas as notificações foram marcadas como lidas.",
    });
  };

  const addReelQueue = async (queueData: Omit<ReelQueue, "id" | "createdAt">): Promise<boolean> => {
    try {
      const res = await fetch("/api/reel-queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queueData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        addToast({
          type: "error",
          title: "Erro ao Criar Fila",
          message: data.message || "Não foi possível persistir a fila no Supabase.",
        });
        return false;
      }

      if (data.queue) {
        setReelQueues((prev) => [data.queue, ...prev]);
      }

      void refreshMedia(queueData.accountId);
      void refreshAccounts();
      void refreshScheduledPosts(queueData.accountId);

      addToast({
        type: "success",
        title: "Fila de Reels Criada com Sucesso!",
        message: `${queueData.totalVideos} vídeos foram agendados para @${queueData.accountUsername}.`,
      });
      return true;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Erro de comunicação";
      addToast({
        type: "error",
        title: "Falha de Conexão",
        message: errorMsg,
      });
      return false;
    }
  };

  const addCarouselQueue = (queueData: Omit<CarouselQueue, "id" | "createdAt">) => {
    const newQueue: CarouselQueue = {
      ...queueData,
      id: `cq_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setCarouselQueues((prev) => [newQueue, ...prev]);
    addToast({
      type: "success",
      title: "Fila de Carrosséis Criada!",
      message: `${newQueue.totalCarousels} carrosséis foram programados para @${newQueue.accountUsername}.`,
    });
  };

  const toggleQueuePause = async (queueId: string, type: "reel" | "carousel") => {
    if (type === "reel") {
      const currentQueue = reelQueues.find((q) => q.id === queueId);
      const targetStatus = currentQueue?.status === "paused" ? "active" : "paused";

      // Atualização otimista na interface
      setReelQueues((prev) =>
        prev.map((q) =>
          q.id === queueId ? { ...q, status: targetStatus } : q
        )
      );

      try {
        const res = await fetch(`/api/reel-queues/${queueId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          // Reverte em caso de erro
          setReelQueues((prev) =>
            prev.map((q) =>
              q.id === queueId ? { ...q, status: currentQueue?.status || "active" } : q
            )
          );
          addToast({
            type: "error",
            title: "Erro ao Atualizar Fila",
            message: data.message || "Não foi possível atualizar o status no Supabase.",
          });
          return;
        }

        void refreshScheduledPosts(selectedAccountId);

        addToast({
          type: "info",
          title: targetStatus === "paused" ? "Fila Pausada" : "Fila Reativada",
          message: targetStatus === "paused"
            ? "A fila e seus agendamentos foram pausados no banco."
            : "A fila e seus agendamentos foram reativados no banco.",
        });
      } catch {
        setReelQueues((prev) =>
          prev.map((q) =>
            q.id === queueId ? { ...q, status: currentQueue?.status || "active" } : q
          )
        );
        addToast({
          type: "error",
          title: "Erro de Conexão",
          message: "Falha ao sincronizar alteração de status com o servidor.",
        });
      }
    } else {
      const currentQueue = carouselQueues.find((q) => q.id === queueId);
      const targetStatus = currentQueue?.status === "paused" ? "active" : "paused";

      setCarouselQueues((prev) =>
        prev.map((q) =>
          q.id === queueId ? { ...q, status: targetStatus } : q
        )
      );

      try {
        const res = await fetch(`/api/carousel-queues/${queueId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setCarouselQueues((prev) =>
            prev.map((q) =>
              q.id === queueId ? { ...q, status: currentQueue?.status || "active" } : q
            )
          );
          addToast({
            type: "error",
            title: "Erro ao Atualizar Fila",
            message: data.message || "Não foi possível atualizar o status no banco.",
          });
          return;
        }

        void refreshScheduledPosts(selectedAccountId);
        addToast({
          type: "info",
          title: targetStatus === "paused" ? "Fila de Carrosséis Pausada" : "Fila de Carrosséis Reativada",
          message: targetStatus === "paused"
            ? "A fila de carrosséis foi pausada no banco."
            : "A fila de carrosséis foi reativada no banco.",
        });
      } catch {
        setCarouselQueues((prev) =>
          prev.map((q) =>
            q.id === queueId ? { ...q, status: currentQueue?.status || "active" } : q
          )
        );
        addToast({
          type: "error",
          title: "Erro de Conexão",
          message: "Falha ao sincronizar alteração de status com o servidor.",
        });
      }
    }
  };

  const deleteCarouselQueue = async (queueId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/carousel-queues/${queueId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        setCarouselQueues((prev) => prev.filter((q) => q.id !== queueId));
        void refreshScheduledPosts(selectedAccountId);
        void refreshCarousels(selectedAccountId);
        void refreshMedia(selectedAccountId);
        addToast({
          type: "success",
          title: "Fila de Carrosséis Excluída",
          message: data.message || "Fila removida com sucesso.",
        });
        return true;
      } else {
        addToast({
          type: "error",
          title: "Falha ao Excluir Fila",
          message: data.message || "Não foi possível excluir a fila de carrosséis.",
        });
        return false;
      }
    } catch {
      addToast({
        type: "error",
        title: "Erro de Conexão",
        message: "Falha ao conectar com o servidor.",
      });
      return false;
    }
  };

  const deleteReelQueue = async (queueId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/reel-queues/${queueId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        setReelQueues((prev) => prev.filter((q) => q.id !== queueId));
        void refreshScheduledPosts(selectedAccountId);
        void refreshPublishedPosts(selectedAccountId);
        void refreshMedia(selectedAccountId);
        addToast({
          type: "success",
          title: "Fila Excluída com Sucesso",
          message: data.message || "Fila removida. Publicações anteriores continuam no histórico.",
        });
        return true;
      } else {
        addToast({
          type: "error",
          title: "Falha ao Excluir Fila",
          message: data.message || "Não foi possível excluir a fila.",
        });
        return false;
      }
    } catch {
      addToast({
        type: "error",
        title: "Erro de Rede",
        message: "Falha ao conectar com o servidor.",
      });
      return false;
    }
  };

  const bulkActionReelQueues = async (
    accountId: string,
    action: "pause_all" | "resume_all" | "delete_all" | "delete_finished"
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/reel-queues/bulk-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await refreshReelQueues(accountId);
        await refreshScheduledPosts(accountId);
        await refreshPublishedPosts(accountId);
        void refreshMedia(accountId);
        addToast({
          type: "success",
          title: "Ação em Massa Concluída",
          message: data.message || "Operação realizada com sucesso.",
        });
        return true;
      } else {
        addToast({
          type: "error",
          title: "Falha na Operação em Massa",
          message: data.message || "Não foi possível executar a ação.",
        });
        return false;
      }
    } catch {
      addToast({
        type: "error",
        title: "Erro de Rede",
        message: "Falha de conexão com o servidor.",
      });
      return false;
    }
  };

  const addProfileMedia = (accountId: string, files: (MediaItem | Omit<MediaItem, "id" | "accountId">)[]) => {
    const newItems: MediaItem[] = files.map((file, idx) => {
      if ("id" in file && "accountId" in file) {
        return file as MediaItem;
      }
      return {
        ...file,
        id: `media_${Date.now()}_${idx}`,
        accountId,
        createdAt: new Date().toISOString(),
      } as MediaItem;
    });

    setProfileMedia((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const filtered = newItems.filter((m) => !existingIds.has(m.id));
      return [...filtered, ...prev];
    });

    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === accountId
          ? { ...acc, profileVideosCount: (acc.profileVideosCount || 0) + newItems.length }
          : acc
      )
    );
    void refreshStorageUsage();
  };

  const deleteProfileMedia = async (accountId: string, mediaId: string, permanent: boolean = false): Promise<boolean> => {
    try {
      const url = permanent ? `/api/media/${mediaId}?permanent=true` : `/api/media/${mediaId}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        addToast({
          type: "error",
          title: "Não foi possível excluir",
          message: data.message || "Erro ao excluir mídia.",
        });
        return false;
      }
      setProfileMedia((prev) => prev.filter((m) => m.id !== mediaId));
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === accountId
            ? { ...acc, profileVideosCount: Math.max(0, (acc.profileVideosCount || 1) - 1) }
            : acc
        )
      );
      void refreshScheduledPosts(selectedAccountId);
      void refreshReelQueues(selectedAccountId);
      void refreshStorageUsage();
      addToast({
        type: permanent ? "info" : "success",
        title: permanent ? "Mídia Excluída Permanentemente" : "Movida para a Lixeira",
        message: data.message || (permanent ? "Arquivo excluído em definitivo." : "O arquivo foi movido para a Lixeira."),
      });
      return true;
    } catch {
      addToast({
        type: "error",
        title: "Erro de Rede",
        message: "Falha de comunicação ao tentar remover a mídia.",
      });
      return false;
    }
  };

  const restoreProfileMedia = async (accountId: string, mediaId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/media/${mediaId}/restore`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        addToast({
          type: "error",
          title: "Erro ao Restaurar",
          message: data.message || "Não foi possível restaurar o arquivo da Lixeira.",
        });
        return false;
      }
      void refreshMedia(accountId);
      void refreshStorageUsage();
      addToast({
        type: "success",
        title: "Arquivo Restaurado",
        message: data.message || "O arquivo voltou para o repositório ativo com sucesso.",
      });
      return true;
    } catch {
      addToast({
        type: "error",
        title: "Erro de Rede",
        message: "Falha ao conectar com o servidor para restaurar a mídia.",
      });
      return false;
    }
  };

  const saveProfileCarousel = async (
    accountId: string,
    carouselData: {
      id?: string;
      title: string;
      caption?: string;
      slides: { mediaId: string; position: number }[];
    }
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/carousels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, ...carouselData }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        addToast({
          type: "error",
          title: "Erro ao Salvar",
          message: data.message || "Não foi possível salvar o carrossel.",
        });
        return false;
      }
      await refreshCarousels(accountId);
      addToast({
        type: "success",
        title: "Carrossel Salvo!",
        message: "O carrossel e seus slides foram persistidos no banco de dados.",
      });
      return true;
    } catch {
      addToast({
        type: "error",
        title: "Erro de Conexão",
        message: "Falha ao comunicar com o servidor.",
      });
      return false;
    }
  };

  const publishCarouselNow = async (accountId: string, carouselId: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/carousels/publish-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, carouselId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        addToast({
          type: "error",
          title: "Erro na Publicação",
          message: data.message || "Falha ao publicar carrossel.",
        });
        void refreshCarousels(accountId);
        void refreshErrors(accountId);
        return false;
      }
      addToast({
        type: "success",
        title: "Carrossel Publicado!",
        message: "O carrossel foi publicado com sucesso no perfil oficial do Instagram.",
      });
      void refreshCarousels(accountId);
      void refreshPublishedPosts(accountId);
      void refreshScheduledPosts(accountId);
      return true;
    } catch {
      addToast({
        type: "error",
        title: "Erro de Conexão",
        message: "Não foi possível disparar a publicação do carrossel.",
      });
      return false;
    }
  };

  const scheduleCarousel = async (
    accountId: string,
    carouselId: string,
    scheduledAt: string,
    caption?: string
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/carousels/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, carouselId, scheduledAt, caption }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        addToast({
          type: "error",
          title: "Erro ao Agendar",
          message: data.message || "Não foi possível agendar o carrossel.",
        });
        return false;
      }
      addToast({
        type: "success",
        title: "Carrossel Agendado!",
        message: "O carrossel foi adicionado à programação do perfil.",
      });
      void refreshCarousels(accountId);
      void refreshScheduledPosts(accountId);
      return true;
    } catch {
      addToast({
        type: "error",
        title: "Erro de Conexão",
        message: "Não foi possível agendar o carrossel.",
      });
      return false;
    }
  };

  const addProfileCarousel = (accountId: string, carousel: Omit<CarouselPost, "id" | "accountId">) => {
    const newCarousel: CarouselPost = {
      ...carousel,
      id: `cp_${Date.now()}`,
      accountId,
      createdAt: new Date().toISOString(),
    };
    setProfileCarousels((prev) => [newCarousel, ...prev]);
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === accountId
          ? { ...acc, profileCarouselsCount: (acc.profileCarouselsCount || 0) + 1 }
          : acc
      )
    );
    addToast({
      type: "success",
      title: "Carrossel Criado com Sucesso!",
      message: `Carrossel salvo com ${newCarousel.slides.length} slides no perfil.`,
    });
  };

  const updateProfileCarousel = (accountId: string, carousel: CarouselPost) => {
    setProfileCarousels((prev) =>
      prev.map((c) => (c.id === carousel.id && c.accountId === accountId ? carousel : c))
    );
    addToast({
      type: "success",
      title: "Carrossel Atualizado",
      message: "As alterações nos slides foram salvas.",
    });
  };

  const deleteProfileCarousel = async (accountId: string, carouselId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/carousels/${carouselId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        addToast({
          type: "error",
          title: "Erro ao Excluir",
          message: data.message || "Não foi possível excluir o carrossel.",
        });
        return false;
      }
      setProfileCarousels((prev) =>
        prev.filter((c) => !(c.id === carouselId && c.accountId === accountId))
      );
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === accountId
            ? { ...acc, profileCarouselsCount: Math.max(0, (acc.profileCarouselsCount || 1) - 1) }
            : acc
        )
      );
      addToast({
        type: "info",
        title: "Carrossel Excluído",
        message: "O carrossel foi removido do perfil.",
      });
      return true;
    } catch {
      addToast({
        type: "error",
        title: "Erro de Rede",
        message: "Falha ao comunicar com o servidor.",
      });
      return false;
    }
  };

  const shuffleProfileCarousels = (accountId: string) => {
    setProfileCarousels((prev) => {
      const accountItems = prev.filter((c) => c.accountId === accountId);
      const otherItems = prev.filter((c) => c.accountId !== accountId);
      const shuffled = [...accountItems].sort(() => Math.random() - 0.5);
      return [...shuffled, ...otherItems];
    });
    addToast({
      type: "info",
      title: "Ordem Embaralhada!",
      message: "A sequência dos carrosséis deste perfil foi reorganizada.",
    });
  };

  const updateAccountSettings = async (accountId: string, settings: Partial<Account>) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === accountId ? { ...acc, ...settings } : acc))
    );

    try {
      const res = await fetch(`/api/instagram/accounts/${accountId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Falha ao salvar configurações.");
      }

      addToast({
        type: "success",
        title: "Configurações Atualizadas",
        message: "As preferências da conta foram salvas com sucesso no banco de dados.",
      });
    } catch (err: unknown) {
      addToast({
        type: "error",
        title: "Erro ao Salvar",
        message: (err as Error).message || "Não foi possível persistir as configurações.",
      });
      void refreshAccounts();
    }
  };

  return (
    <AppStateContext.Provider
      value={{
        accounts,
        selectedAccountId,
        selectedAccount,
        setSelectedAccountId,
        toggleAccountPause,
        reconnectAccount,
        addAccount,
        refreshAccounts,
        errors,
        criticalErrorsCount,
        resolveError,
        retryError,
        ignoreError,
        refreshErrors,
        deleteErrorLog,
        clearAllErrorLogs,
        notifications,
        unreadNotificationsCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        scheduledPosts,
        publishedPosts,
        reelQueues,
        carouselQueues,
        addReelQueue,
        addCarouselQueue,
        toggleQueuePause,
        deleteReelQueue,
        bulkActionReelQueues,
        refreshReelQueues,
        refreshCarouselQueues,
        deleteCarouselQueue,
        refreshScheduledPosts,
        refreshPublishedPosts,
        profileMedia,
        refreshMedia,
        profileCarousels,
        refreshCarousels,
        saveProfileCarousel,
        publishCarouselNow,
        scheduleCarousel,
        addProfileMedia,
        deleteProfileMedia,
        restoreProfileMedia,
        addProfileCarousel,
        updateProfileCarousel,
        deleteProfileCarousel,
        shuffleProfileCarousels,
        updateAccountSettings,
        systemStatus,
        storageUsage,
        refreshStorageUsage,
        isConnectModalOpen,
        setIsConnectModalOpen,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState deve ser utilizado dentro de um AppStateProvider");
  }
  return context;
}

