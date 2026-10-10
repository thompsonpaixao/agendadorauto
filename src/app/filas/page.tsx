"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Layers,
  Play,
  Pause,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
  Eye,
  Film,
  Sparkles,
  ChevronRight,
  Filter,
  CheckSquare,
  Square,
  ArrowRight,
  Plus,
} from "lucide-react";
import { QueueDetailsModal } from "@/components/queues/QueueDetailsModal";
import { formatDate, formatTime } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";
import { useAppState } from "@/context/AppStateContext";

interface QueueSummary {
  activeQueues: number;
  pausedQueues: number;
  waitingPosts: number;
  delayedPosts: number;
  processingPosts: number;
  errorPosts: number;
  totalQueues: number;
}

interface UnifiedQueue {
  id: string;
  name: string;
  type: "reel" | "carousel";
  status: "active" | "paused" | "completed" | "error" | "delayed" | "cancelled";
  accountId: string;
  accountUsername: string;
  accountAvatar: string;
  totalCount: number;
  publishedCount: number;
  remainingCount: number;
  errorCount: number;
  nextScheduledAt: string | null;
  nextPostTitle: string | null;
  progressPercent: number;
  createdAt: string;
  isDelayed: boolean;
}

export default function GlobalQueuesPage() {
  const { addToast } = useToast();
  const { accounts } = useAppState();

  const [loading, setLoading] = useState(true);
  const [queues, setQueues] = useState<UnifiedQueue[]>([]);
  const [summary, setSummary] = useState<QueueSummary>({
    activeQueues: 0,
    pausedQueues: 0,
    waitingPosts: 0,
    delayedPosts: 0,
    processingPosts: 0,
    errorPosts: 0,
    totalQueues: 0,
  });

  // Filtros e seleção
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);

  // Modal de Detalhes
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Modal de confirmação
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
    confirmLabel: string;
    danger?: boolean;
  } | null>(null);

  // Carrega filas e resumo da API
  const fetchQueues = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/queues", { cache: "no-store" });
      const data = await res.json();

      if (data.success) {
        setQueues(data.queues || []);
        if (data.summary) setSummary(data.summary);
      } else {
        addToast({
          type: "error",
          title: "Erro ao Carregar Filas",
          message: data.message || "Não foi possível carregar as filas.",
        });
      }
    } catch (err: unknown) {
      addToast({
        type: "error",
        title: "Erro de Conexão",
        message: err instanceof Error ? err.message : "Falha na comunicação com o servidor.",
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchQueues();
  }, [fetchQueues]);

  // Filtra filas
  const filteredQueues = useMemo(() => {
    return queues.filter((q) => {
      if (accountFilter !== "all" && q.accountId !== accountFilter) {
        return false;
      }
      if (statusFilter === "all") return true;
      if (statusFilter === "delayed") return q.isDelayed || q.status === "delayed";
      return q.status === statusFilter;
    });
  }, [queues, accountFilter, statusFilter]);

  // Seleção em massa
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQueues.length && filteredQueues.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQueues.map((q) => q.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Executa ação de status por fila
  const handleToggleStatus = async (queue: UnifiedQueue) => {
    const isPaused = queue.status === "paused";
    const nextStatus = isPaused ? "active" : "paused";

    try {
      setActionLoading(true);
      const res = await fetch(`/api/reel-queues/${queue.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        addToast({
          type: "success",
          title: isPaused ? "Fila Retomada" : "Fila Pausada",
          message: `A fila "${queue.name}" foi ${isPaused ? "retomada" : "pausada"} com sucesso.`,
        });
        await fetchQueues();
      } else {
        addToast({
          type: "error",
          title: "Falha na Operação",
          message: data.message || "Não foi possível alterar o status da fila.",
        });
      }
    } catch {
      addToast({
        type: "error",
        title: "Erro de Comunicação",
        message: "Falha de rede ao alterar status da fila.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Excluir fila individual
  const handleDeleteQueue = (queue: UnifiedQueue) => {
    setConfirmModal({
      open: true,
      title: "Excluir Fila?",
      description: `Tem certeza que deseja excluir "${queue.name}"? Os agendamentos futuros não publicados serão cancelados. Suas mídias no R2 e posts já publicados no Instagram serão preservados.`,
      confirmLabel: "Sim, Excluir Fila",
      danger: true,
      action: async () => {
        try {
          const res = await fetch(`/api/reel-queues/${queue.id}`, { method: "DELETE" });
          const data = await res.json();
          if (res.ok && data.success) {
            addToast({
              type: "success",
              title: "Fila Excluída",
              message: `A fila "${queue.name}" foi removida com sucesso.`,
            });
            await fetchQueues();
          } else {
            addToast({
              type: "error",
              title: "Erro ao Excluir",
              message: data.message || "Falha ao excluir fila.",
            });
          }
        } catch {
          addToast({
            type: "error",
            title: "Erro",
            message: "Falha ao tentar excluir a fila.",
          });
        }
      },
    });
  };

  // Ações em massa (selecionadas ou todas)
  const handleBulkAction = async (action: "pause" | "resume" | "cancel" | "delete") => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const actionText =
      action === "pause"
        ? "pausar"
        : action === "resume"
        ? "retomar"
        : action === "cancel"
        ? "cancelar"
        : "excluir";

    setConfirmModal({
      open: true,
      title: `Confirmar ação em massa?`,
      description: `Deseja realmente ${actionText} as ${ids.length} filas selecionadas?`,
      confirmLabel: `Sim, ${actionText}`,
      danger: action === "delete" || action === "cancel",
      action: async () => {
        try {
          setActionLoading(true);
          const res = await fetch("/api/reel-queues/bulk-action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              queueIds: ids,
              action,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            addToast({
              type: "success",
              title: "Ação Concluída",
              message: data.message || "Ação em massa executada com sucesso.",
            });
            setSelectedIds(new Set());
            await fetchQueues();
          } else {
            addToast({
              type: "error",
              title: "Erro",
              message: data.message || "Falha na ação em massa.",
            });
          }
        } catch {
          addToast({
            type: "error",
            title: "Erro",
            message: "Falha de rede ao processar ação em massa.",
          });
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // Ações globais no topo (todas)
  const handleGlobalAction = async (action: "pause_all" | "resume_all") => {
    const isPause = action === "pause_all";
    setConfirmModal({
      open: true,
      title: isPause ? "Pausar Todas as Filas?" : "Retomar Todas as Filas?",
      description: isPause
        ? "Todas as filas ativas de todos os perfis serão pausadas. Nenhum post agendado será publicado enquanto as filas estiverem pausadas."
        : "Todas as filas pausadas serão retomadas e os agendamentos das próximas 24 horas serão enfileirados.",
      confirmLabel: isPause ? "Pausar Todas" : "Retomar Todas",
      action: async () => {
        try {
          setActionLoading(true);
          const res = await fetch("/api/reel-queues/bulk-action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            addToast({
              type: "success",
              title: isPause ? "Todas as Filas Pausadas" : "Todas as Filas Retomadas",
              message: data.message || "Operação executada com sucesso.",
            });
            await fetchQueues();
          } else {
            addToast({
              type: "error",
              title: "Erro",
              message: data.message || "Falha ao processar ação global.",
            });
          }
        } catch {
          addToast({
            type: "error",
            title: "Erro",
            message: "Falha de rede ao processar ação.",
          });
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // Render do badge de status
  const renderStatusBadge = (queue: UnifiedQueue) => {
    if (queue.isDelayed || queue.status === "delayed") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
          Atrasada
        </span>
      );
    }
    switch (queue.status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Ativa
          </span>
        );
      case "paused":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
            <Pause className="w-3 h-3 text-slate-500" />
            Pausada
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <CheckCircle2 className="w-3 h-3 text-indigo-600" />
            Concluída
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            Com erro
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
            Cancelada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
            {queue.status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Topo / Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Filas Globais de Publicação
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Gerencie todas as filas e agendamentos de todos os perfis conectados do Instagram em um único lugar.
              </p>
            </div>
          </div>
        </div>

        {/* Ações do Topo */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchQueues}
            disabled={loading || actionLoading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            title="Atualizar lista de filas"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => handleGlobalAction("pause_all")}
            disabled={actionLoading || summary.activeQueues === 0}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5 text-slate-500" />
            <span>Pausar todas</span>
          </button>

          <button
            type="button"
            onClick={() => handleGlobalAction("resume_all")}
            disabled={actionLoading || summary.pausedQueues === 0}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Retomar todas</span>
          </button>
        </div>
      </div>

      {/* CARDS / RESUMO GLOBAL */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Filas ativas */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Filas ativas</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {summary.activeQueues}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Em distribuição</p>
        </div>

        {/* Posts aguardando */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Aguardando</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {summary.waitingPosts}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Janela normal</p>
        </div>

        {/* Posts atrasados */}
        <div
          className={`p-4 rounded-2xl border shadow-2xs transition-colors ${
            summary.delayedPosts > 0
              ? "bg-amber-50/60 border-amber-200/80"
              : "bg-white border-slate-200/80"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span
              className={`text-xs font-semibold ${
                summary.delayedPosts > 0 ? "text-amber-800" : "text-slate-500"
              }`}
            >
              Atrasados
            </span>
            <AlertTriangle
              className={`w-3.5 h-3.5 ${
                summary.delayedPosts > 0 ? "text-amber-600 animate-pulse" : "text-slate-400"
              }`}
            />
          </div>
          <div
            className={`text-2xl font-bold ${
              summary.delayedPosts > 0 ? "text-amber-700" : "text-slate-900"
            }`}
          >
            {summary.delayedPosts}
          </div>
          <p
            className={`text-[11px] mt-0.5 ${
              summary.delayedPosts > 0 ? "text-amber-600 font-medium" : "text-slate-400"
            }`}
          >
            {summary.delayedPosts > 0 ? "Necessitam atenção" : "Nenhum atraso"}
          </p>
        </div>

        {/* Em processamento */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Processando</span>
            <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {summary.processingPosts}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Na Meta / Worker</p>
        </div>

        {/* Com erro */}
        <div
          className={`p-4 rounded-2xl border shadow-2xs ${
            summary.errorPosts > 0
              ? "bg-rose-50/60 border-rose-200/80"
              : "bg-white border-slate-200/80"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span
              className={`text-xs font-semibold ${
                summary.errorPosts > 0 ? "text-rose-800" : "text-slate-500"
              }`}
            >
              Com erro
            </span>
            <XCircle
              className={`w-3.5 h-3.5 ${
                summary.errorPosts > 0 ? "text-rose-600" : "text-slate-400"
              }`}
            />
          </div>
          <div
            className={`text-2xl font-bold ${
              summary.errorPosts > 0 ? "text-rose-700" : "text-slate-900"
            }`}
          >
            {summary.errorPosts}
          </div>
          <p
            className={`text-[11px] mt-0.5 ${
              summary.errorPosts > 0 ? "text-rose-600" : "text-slate-400"
            }`}
          >
            {summary.errorPosts > 0 ? "Posts com falha" : "Zero falhas"}
          </p>
        </div>

        {/* Pausadas */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Pausadas</span>
            <Pause className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {summary.pausedQueues}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Filas pausadas</p>
        </div>
      </div>

      {/* FILTROS E BARRA DE AÇÕES EM MASSA */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mr-2">
              <Filter className="w-3.5 h-3.5" />
              <span>Filtrar por:</span>
            </div>

            {/* Filtro de Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todos os status</option>
              <option value="active">Ativas</option>
              <option value="delayed">Atrasadas</option>
              <option value="paused">Pausadas</option>
              <option value="completed">Concluídas</option>
              <option value="error">Com erro</option>
            </select>

            {/* Filtro de Conta */}
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="py-1.5 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todas as contas ({accounts.length})</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  @{acc.username}
                </option>
              ))}
            </select>

            {/* Reset filtro */}
            {(statusFilter !== "all" || accountFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setAccountFilter("all");
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {/* Contador de filas listadas */}
          <div className="text-xs text-slate-400">
            Mostrando <strong>{filteredQueues.length}</strong> de{" "}
            <strong>{queues.length}</strong> fila(s)
          </div>
        </div>

        {/* BARRA DE AÇÕES EM MASSA (aparece se selecionadas > 0) */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-indigo-50/80 border border-indigo-200 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
              <CheckSquare className="w-4 h-4 text-indigo-600" />
              <span>{selectedIds.size} fila(s) selecionada(s)</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleBulkAction("pause")}
                disabled={actionLoading}
                className="py-1 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Pausar selecionadas
              </button>

              <button
                type="button"
                onClick={() => handleBulkAction("resume")}
                disabled={actionLoading}
                className="py-1 px-3 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                Retomar selecionadas
              </button>

              <button
                type="button"
                onClick={() => handleBulkAction("cancel")}
                disabled={actionLoading}
                className="py-1 px-3 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors cursor-pointer"
              >
                Cancelar selecionadas
              </button>

              <button
                type="button"
                onClick={() => handleBulkAction("delete")}
                disabled={actionLoading}
                className="py-1 px-3 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors cursor-pointer"
              >
                Excluir selecionadas
              </button>

              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-indigo-700 hover:underline px-1 cursor-pointer"
              >
                Desmarcar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TABELA / LISTA DE FILAS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-xs font-medium">Carregando filas globais...</span>
          </div>
        ) : filteredQueues.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Nenhuma fila encontrada
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {statusFilter !== "all" || accountFilter !== "all"
                  ? "Nenhuma fila corresponde aos filtros selecionados."
                  : "Crie uma nova fila de Reels ou agende carrosséis em suas contas conectadas."}
              </p>
            </div>
            {accounts.length > 0 && (
              <Link
                href={`/contas/${accounts[0].id}?tab=reels`}
                className="inline-flex items-center gap-2 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>Criar primeira fila</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 w-10 text-center">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="cursor-pointer text-slate-400 hover:text-slate-600"
                    >
                      {selectedIds.size === filteredQueues.length && filteredQueues.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">Conta</th>
                  <th className="py-3.5 px-4">Fila / Tipo</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Progresso</th>
                  <th className="py-3.5 px-4">Próximo Post</th>
                  <th className="py-3.5 px-4">Próximo Horário</th>
                  <th className="py-3.5 px-4">Criado em</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredQueues.map((queue) => {
                  const isSelected = selectedIds.has(queue.id);

                  return (
                    <tr
                      key={queue.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? "bg-indigo-50/40" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelectOne(queue.id)}
                          className="cursor-pointer text-slate-400 hover:text-slate-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Conta (Avatar + Username) */}
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/contas/${queue.accountId}?tab=reels`}
                          className="flex items-center gap-2.5 group"
                        >
                          <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                            <Image
                              src={queue.accountAvatar}
                              alt={queue.accountUsername}
                              width={32}
                              height={32}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              unoptimized
                            />
                          </div>
                          <div className="truncate">
                            <div className="font-bold text-slate-900 group-hover:text-indigo-600 truncate">
                              @{queue.accountUsername}
                            </div>
                          </div>
                        </Link>
                      </td>

                      {/* Nome da Fila + Tipo */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 truncate max-w-xs" title={queue.name}>
                          {queue.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                            {queue.type === "reel" ? (
                              <>
                                <Film className="w-3 h-3 text-rose-500" />
                                Reel
                              </>
                            ) : (
                              <>
                                <Layers className="w-3 h-3 text-indigo-500" />
                                Carrossel
                              </>
                            )}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {renderStatusBadge(queue)}
                      </td>

                      {/* Progresso */}
                      <td className="py-3.5 px-4">
                        <div className="w-32 space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>
                              <strong>{queue.publishedCount}</strong>/{queue.totalCount}
                            </span>
                            <span className="font-bold text-slate-700">
                              {queue.progressPercent}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                              style={{ width: `${queue.progressPercent}%` }}
                            />
                          </div>
                          {queue.errorCount > 0 && (
                            <span className="text-[10px] text-rose-600 font-semibold block">
                              {queue.errorCount} com erro
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Próximo Post */}
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                        {queue.nextPostTitle ? (
                          <span className="truncate block" title={queue.nextPostTitle}>
                            {queue.nextPostTitle}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Próximo Horário */}
                      <td className="py-3.5 px-4">
                        {queue.nextScheduledAt ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-800 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {formatTime(queue.nextScheduledAt)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {formatDate(queue.nextScheduledAt)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Criado em */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {formatDate(queue.createdAt)}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Ver Detalhes */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedQueueId(queue.id);
                              setIsDetailsOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-indigo-600 transition-colors shadow-2xs cursor-pointer"
                            title="Ver detalhes da fila"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Pausar / Retomar */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(queue)}
                            disabled={actionLoading || queue.status === "completed" || queue.status === "cancelled"}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors shadow-2xs disabled:opacity-40 cursor-pointer"
                            title={queue.status === "paused" ? "Retomar fila" : "Pausar fila"}
                          >
                            {queue.status === "paused" ? (
                              <Play className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Pause className="w-3.5 h-3.5 text-amber-600" />
                            )}
                          </button>

                          {/* Excluir Fila */}
                          <button
                            type="button"
                            onClick={() => handleDeleteQueue(queue)}
                            disabled={actionLoading}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors shadow-2xs cursor-pointer"
                            title="Excluir fila"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE DETALHES DA FILA */}
      {selectedQueueId && (
        <QueueDetailsModal
          queueId={selectedQueueId}
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedQueueId(null);
            void fetchQueues();
          }}
        />
      )}

      {/* MODAL DE CONFIRMAÇÃO DE AÇÃO */}
      {confirmModal && confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-slate-900">
              {confirmModal.title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {confirmModal.description}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="py-2 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const act = confirmModal.action;
                  setConfirmModal(null);
                  await act();
                }}
                className={`py-2 px-4 rounded-xl text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer ${
                  confirmModal.danger
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
