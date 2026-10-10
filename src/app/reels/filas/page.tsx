"use client";

import React, { useState } from "react";
import { useAppState } from "@/context/AppStateContext";
import { useToast } from "@/context/ToastContext";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { ReelQueue } from "@/types";
import {
  Film,
  Plus,
  Play,
  Pause,
  Edit,
  ExternalLink,
  Calendar,
  Clock,
  AlertCircle,
  Trash2,
  Loader2,
  Eye,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/utils";
import { QueueDetailsModal } from "@/components/queues/QueueDetailsModal";

export default function FilasReelsPage() {
  const { reelQueues, selectedAccountId, toggleQueuePause, deleteReelQueue, bulkActionReelQueues } = useAppState();
  const { addToast } = useToast();
  const [queueToDelete, setQueueToDelete] = useState<ReelQueue | null>(null);
  const [isDeletingQueue, setIsDeletingQueue] = useState(false);
  const [selectedQueueForDetails, setSelectedQueueForDetails] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<"ativas" | "finalizadas">("ativas");
  const [bulkModal, setBulkModal] = useState<{
    open: boolean;
    action: "pause_all" | "resume_all" | "delete_all" | "delete_finished";
    title: string;
    description: string;
    confirmText: string;
  } | null>(null);
  const [isBulkExecuting, setIsBulkExecuting] = useState(false);

  const filteredQueues = selectedAccountId === "all"
    ? reelQueues
    : reelQueues.filter((q) => q.accountId === selectedAccountId);

  const activeQueues = filteredQueues.filter((q) => q.status !== "completed");
  const finishedQueues = filteredQueues.filter((q) => q.status === "completed");
  const displayedQueues = queueFilter === "ativas" ? activeQueues : finishedQueues;

  const handleBulkAction = async () => {
    if (!bulkModal) return;
    setIsBulkExecuting(true);
    try {
      await bulkActionReelQueues(selectedAccountId, bulkModal.action);
      setBulkModal(null);
    } catch {
      // Toast já exibido no context
    } finally {
      setIsBulkExecuting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Filas de Reels
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200">
              {activeQueues.length} ativas • {finishedQueues.length} finalizadas
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Acompanhe o andamento de todas as filas de postagem automática de vídeos.
          </p>
        </div>

        <Link
          href="/reels/nova-fila"
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold shadow-sm shadow-indigo-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Criar nova fila</span>
        </Link>
      </div>

      {/* Barra de Filtros (Ativas vs Finalizadas) e Ações em Massa */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setQueueFilter("ativas")}
            className={`py-1.5 px-3.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              queueFilter === "ativas"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            Filas Ativas ({activeQueues.length})
          </button>
          <button
            type="button"
            onClick={() => setQueueFilter("finalizadas")}
            className={`py-1.5 px-3.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              queueFilter === "finalizadas"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
            }`}
          >
            Filas Finalizadas ({finishedQueues.length})
          </button>
        </div>

        {/* Botões de Ações em Massa */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {queueFilter === "ativas" && activeQueues.length > 0 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setBulkModal({
                    open: true,
                    action: "pause_all",
                    title: "Pausar Todas as Filas Ativas",
                    description: `Deseja pausar todas as ${activeQueues.length} filas ativas? Os agendamentos futuros não serão disparados enquanto as filas estiverem pausadas.`,
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
                    description: "Deseja reativar todas as filas pausadas? As publicações continuarão conforme o cronograma.",
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
                    title: "Excluir Todas as Filas",
                    description: "ATENÇÃO: Deseja excluir todas as filas não concluídas? Todos os agendamentos futuros serão cancelados. Mídias e publicações já realizadas serão preservadas.",
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

          {queueFilter === "finalizadas" && finishedQueues.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setBulkModal({
                  open: true,
                  action: "delete_finished",
                  title: "Limpar Filas Finalizadas",
                  description: `Deseja limpar as ${finishedQueues.length} filas finalizadas? Todo o histórico de posts publicados e arquivos de vídeo serão mantidos intactos.`,
                  confirmText: "Sim, limpar finalizadas",
                })
              }
              className="py-1.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir finalizadas</span>
            </button>
          )}
        </div>
      </div>

      {/* Lista de Filas */}
      {displayedQueues.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
          <Film className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">
            {queueFilter === "ativas" ? "Nenhuma fila ativa encontrada" : "Nenhuma fila finalizada encontrada"}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            {queueFilter === "ativas"
              ? "Não há filas ativas para a conta selecionada. Crie uma nova fila para começar a automação."
              : "Filas com todas as publicações concluídas aparecerão aqui automaticamente."}
          </p>
          {queueFilter === "ativas" && (
            <Link
              href="/reels/nova-fila"
              className="py-2 px-4 rounded-xl bg-indigo-600 text-white text-xs font-semibold inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Fila Agora</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayedQueues.map((queue) => {
            const percent = Math.round(
              (queue.publishedCount / (queue.totalVideos || 1)) * 100
            );
            const nextDisplay = queue.nextScheduledAt
              ? `${formatDate(queue.nextScheduledAt)} às ${formatTime(queue.nextScheduledAt)}`
              : "—";

            return (
              <div
                key={queue.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all space-y-4"
              >
                {/* Linha 1: Perfil, Nome da Fila e Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                      <Image
                        src={queue.accountAvatar}
                        alt={queue.accountUsername}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          {queue.name}
                        </h3>
                        <StatusBadge status={queue.status} />
                      </div>
                      <span className="text-xs text-indigo-600 font-semibold">
                        @{queue.accountUsername}
                      </span>
                    </div>
                  </div>

                  {/* Informações de datas */}
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 block font-semibold">
                        Criada em
                      </span>
                      <span>{formatDate(queue.createdAt)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 block font-semibold">
                        Término estimado
                      </span>
                      <span>{queue.estimatedFinishAt ? formatDate(queue.estimatedFinishAt) : "-"}</span>
                    </div>
                  </div>
                </div>

                {/* Linha 2: Barra de Progresso */}
                <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      {queue.publishedCount} / {queue.totalVideos} publicados ({percent}%)
                    </span>
                    <div className="flex items-center gap-3 text-slate-500">
                      <span>Restantes: <strong className="text-slate-800">{queue.remainingCount}</strong></span>
                      {queue.errorCount > 0 && (
                        <span className="text-rose-600 font-bold">
                          {queue.errorCount} erros
                        </span>
                      )}
                      <span>Próxima: <strong className="text-indigo-600">{nextDisplay}</strong></span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        queue.status === "completed" ? "bg-emerald-600" : "bg-gradient-to-r from-indigo-500 to-purple-600"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Linha 3: Ações */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedQueueForDetails(queue.id)}
                    className="py-1.5 px-3 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver detalhes</span>
                  </button>

                  {queue.status !== "completed" && (
                    <button
                      type="button"
                      onClick={() => toggleQueuePause(queue.id, "reel")}
                      className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        queue.status === "paused"
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "border border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      {queue.status === "paused" ? (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Reativar fila</span>
                        </>
                      ) : (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pausar fila</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setQueueToDelete(queue)}
                    className="py-1.5 px-3 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir fila</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Confirmação para Excluir Fila Única */}
      {queueToDelete && (
        <Modal
          isOpen={Boolean(queueToDelete)}
          onClose={() => !isDeletingQueue && setQueueToDelete(null)}
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
                disabled={isDeletingQueue}
                onClick={() => setQueueToDelete(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingQueue}
                onClick={async () => {
                  if (queueToDelete) {
                    setIsDeletingQueue(true);
                    try {
                      await deleteReelQueue(queueToDelete.id);
                      setQueueToDelete(null);
                    } finally {
                      setIsDeletingQueue(false);
                    }
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingQueue && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeletingQueue ? "Excluindo..." : "Sim, excluir fila"}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Ações em Massa */}
      {bulkModal && (
        <Modal
          isOpen={bulkModal.open}
          onClose={() => !isBulkExecuting && setBulkModal(null)}
          title={bulkModal.title}
          description="Operação em lote de filas"
          maxWidth="md"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              {bulkModal.description}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isBulkExecuting}
                onClick={() => setBulkModal(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isBulkExecuting}
                onClick={handleBulkAction}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isBulkExecuting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isBulkExecuting ? "Processando..." : bulkModal.confirmText}</span>
              </button>
            </div>
          </div>
        </Modal>
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
