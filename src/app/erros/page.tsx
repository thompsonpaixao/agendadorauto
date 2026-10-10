"use client";

import React, { useState } from "react";
import { useAppState } from "@/context/AppStateContext";
import { useToast } from "@/context/ToastContext";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { ErrorLog } from "@/types";
import {
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Code2,
  ExternalLink,
  RotateCcw,
  Eye,
  Check,
  Search,
  Filter,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { formatDateTime, formatDate, formatTime } from "@/lib/utils";

export default function ErrosPage() {
  const {
    errors,
    resolveError,
    retryError,
    ignoreError,
    deleteErrorLog,
    clearAllErrorLogs,
    reconnectAccount,
    accounts,
  } = useAppState();

  const { addToast } = useToast();

  const [activeFilter, setActiveFilter] = useState<
    "all" | "critical" | "account" | "token" | "publish" | "media" | "api" | "resolved"
  >("all");
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [errorToDelete, setErrorToDelete] = useState<string | null>(null);

  // Métricas
  const criticalCount = errors.filter((e) => e.status === "pending" && e.severity === "critical").length;
  const warningCount = errors.filter((e) => e.status === "pending" && e.severity === "warning").length;
  const disconnectedCount = accounts.filter((a) => a.status === "expired" || a.status === "error").length;
  const failedPostsCount = errors.filter((e) => e.status === "pending" && e.postType).length;

  const filtered = errors.filter((err) => {
    const matchesSearch =
      err.errorMessage.toLowerCase().includes(searchTerm.toLowerCase()) ||
      err.accountUsername.toLowerCase().includes(searchTerm.toLowerCase()) ||
      err.errorCode.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === "critical") return err.severity === "critical" && err.status === "pending";
    if (activeFilter === "resolved") return err.status === "resolved";
    if (activeFilter === "account") return err.category === "account" && err.status === "pending";
    if (activeFilter === "token") return err.category === "token" && err.status === "pending";
    if (activeFilter === "publish") return err.category === "publish" && err.status === "pending";
    if (activeFilter === "media") return err.category === "media" && err.status === "pending";
    if (activeFilter === "api") return err.category === "api" && err.status === "pending";

    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Erros e Alertas
            </h1>
            {criticalCount > 0 ? (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 animate-pulse">
                {criticalCount} Críticos Pendentes
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                0 Erros Pendentes
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Central de diagnóstico, rastreamento de falhas na Meta Graph API e recuperação com 1 clique.
          </p>
        </div>

        {errors.length > 0 && (
          <button
            type="button"
            onClick={() => setIsClearAllModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-center"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar todos os erros</span>
          </button>
        )}
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Erros Críticos"
          value={criticalCount}
          subtitle="Interrompem publicações"
          variant="error"
          icon={<AlertTriangle className="w-4 h-4 text-rose-600" />}
        />

        <MetricCard
          title="Alertas & Avisos"
          value={warningCount}
          subtitle="Avisos de formato e proporção"
          variant="warning"
          icon={<AlertCircle className="w-4 h-4 text-amber-600" />}
        />

        <MetricCard
          title="Contas Desconectadas"
          value={disconnectedCount}
          subtitle="Requerem renovação OAuth"
          icon={<RefreshCw className="w-4 h-4 text-slate-700" />}
        />

        <MetricCard
          title="Posts que Falharam"
          value={failedPostsCount}
          subtitle="Na fila para reprocessamento"
          icon={<XCircle className="w-4 h-4 text-rose-600" />}
        />
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por erro, código ou @perfil..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Abas de Filtros */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
          {(
            [
              { id: "all", label: "Todos" },
              { id: "critical", label: "Críticos" },
              { id: "token", label: "Token" },
              { id: "account", label: "Conta" },
              { id: "publish", label: "Publicação" },
              { id: "media", label: "Mídia" },
              { id: "api", label: "API" },
              { id: "resolved", label: "Resolvidos" },
            ] as const
          ).map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeFilter === filter.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de Erros */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3.5">Data / Hora</th>
                <th className="px-4 py-3.5">Perfil</th>
                <th className="px-3 py-3.5">Tipo</th>
                <th className="px-4 py-3.5">Conteúdo / Post</th>
                <th className="px-4 py-3.5">Erro / Mensagem</th>
                <th className="px-3 py-3.5 text-center">Tentativas</th>
                <th className="px-3 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Ação</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-3">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">
                        Nenhum erro registrado
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Tudo funcionando perfeitamente. Nenhuma falha de publicação ou API no momento.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((err) => (
                <tr
                  key={err.id}
                  onClick={() => setSelectedError(err)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  {/* Data / Hora */}
                  <td className="px-4 py-3.5 whitespace-nowrap text-slate-500 font-normal">
                    <div>{formatDate(err.timestamp)}</div>
                    <div className="text-[10px] text-slate-400">{formatTime(err.timestamp)}</div>
                  </td>

                  {/* Perfil */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="relative w-6 h-6 rounded-md overflow-hidden border border-slate-200 shrink-0">
                        <Image
                          src={err.accountAvatar}
                          alt={err.accountUsername}
                          width={24}
                          height={24}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      </div>
                      <span className="font-bold text-slate-900">
                        @{err.accountUsername}
                      </span>
                    </div>
                  </td>

                  {/* Tipo */}
                  <td className="px-3 py-3.5 uppercase font-bold text-[10px] text-slate-500">
                    {err.category}
                  </td>

                  {/* Conteúdo */}
                  <td className="px-4 py-3.5 max-w-[180px] truncate text-slate-700">
                    {err.postTitle || "N/A (Falha de Conta)"}
                  </td>

                  {/* Erro */}
                  <td className="px-4 py-3.5 max-w-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-rose-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span className="truncate">{err.errorCode}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {err.errorMessage}
                    </p>
                  </td>

                  {/* Tentativas */}
                  <td className="px-3 py-3.5 text-center">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">
                      {err.attempts}x
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3.5">
                    <StatusBadge
                      status={err.status === "resolved" ? "resolved" : err.severity}
                      label={err.status === "resolved" ? "Resolvido" : undefined}
                    />
                  </td>

                  {/* Ação */}
                  <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {err.suggestedAction === "reconnect" ? (
                        <button
                          type="button"
                          onClick={() => reconnectAccount(err.accountId)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-2xs transition-colors cursor-pointer"
                        >
                          Reconectar
                        </button>
                      ) : err.suggestedAction === "retry" ? (
                        <button
                          type="button"
                          onClick={() => retryError(err.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-colors cursor-pointer"
                        >
                          Tentar novamente
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => resolveError(err.id)}
                          className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition-colors cursor-pointer"
                        >
                          Resolver
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setErrorToDelete(err.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Excluir erro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          </table>
        </div>
      </div>

      {/* Modal / Painel Lateral de Detalhes do Erro */}
      {selectedError && (
        <Modal
          isOpen={Boolean(selectedError)}
          onClose={() => setSelectedError(null)}
          title="Diagnóstico da Ocorrência"
          description={`Código: ${selectedError.errorCode} • Registrado em ${formatDateTime(selectedError.timestamp)}`}
          maxWidth="2xl"
        >
          <div className="space-y-5">
            {/* Cabeçalho com Status */}
            <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-700 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-rose-950">
                    {selectedError.errorMessage}
                  </h4>
                  <p className="text-xs text-rose-700 mt-0.5">
                    Categoria: <span className="uppercase font-bold">{selectedError.category}</span> • Severidade: <span className="uppercase font-bold">{selectedError.severity}</span>
                  </p>
                </div>
              </div>
              <StatusBadge status={selectedError.severity} />
            </div>

            {/* Informações detalhadas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-400 block text-[11px]">Conta Afetada</span>
                <span className="font-bold text-slate-800 text-sm">@{selectedError.accountUsername}</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-400 block text-[11px]">Número de Tentativas</span>
                <span className="font-bold text-slate-800 text-sm">{selectedError.attempts} tentativas</span>
              </div>

              {selectedError.postTitle && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl sm:col-span-2">
                  <span className="text-slate-400 block text-[11px]">Publicação Vinculada</span>
                  <span className="font-bold text-slate-800">{selectedError.postTitle}</span>
                </div>
              )}
            </div>

            {/* Detalhes Técnicos / Resposta da Meta Graph API */}
            {selectedError.technicalDetails && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-indigo-600" />
                  Resposta Técnica da Meta Graph API
                </span>
                <div className="p-3.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed overflow-x-auto">
                  {selectedError.technicalDetails}
                </div>
              </div>
            )}

            {/* Botões de Ação */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setErrorToDelete(selectedError.id);
                  setSelectedError(null);
                }}
                className="py-2 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir erro</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  ignoreError(selectedError.id);
                  setSelectedError(null);
                }}
                className="py-2 px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold cursor-pointer"
              >
                Ignorar
              </button>

              <button
                type="button"
                onClick={() => {
                  resolveError(selectedError.id);
                  setSelectedError(null);
                }}
                className="py-2 px-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Marcar como resolvido</span>
              </button>

              {selectedError.suggestedAction === "reconnect" && (
                <button
                  type="button"
                  onClick={() => {
                    reconnectAccount(selectedError.accountId);
                    setSelectedError(null);
                  }}
                  className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reconectar conta agora</span>
                </button>
              )}

              {selectedError.suggestedAction === "retry" && (
                <button
                  type="button"
                  onClick={() => {
                    retryError(selectedError.id);
                    setSelectedError(null);
                  }}
                  className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Tentar novamente</span>
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Confirmação para Limpar Todos os Erros */}
      {isClearAllModalOpen && (
        <Modal
          isOpen={isClearAllModalOpen}
          onClose={() => setIsClearAllModalOpen(false)}
          title="Limpar Todos os Erros"
          description="Esta ação removerá todos os registros de erro salvos no banco de dados."
          maxWidth="md"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Tem certeza de que deseja limpar todos os logs de erro? As publicações com sucesso e os agendamentos futuros não serão afetados.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await clearAllErrorLogs();
                  setIsClearAllModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                Sim, limpar tudo
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Confirmação para Excluir Erro Individual */}
      {errorToDelete && (
        <Modal
          isOpen={Boolean(errorToDelete)}
          onClose={() => setErrorToDelete(null)}
          title="Excluir Registro de Erro"
          description="Remover este log de erro do banco de dados."
          maxWidth="md"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Deseja realmente remover esta ocorrência de erro?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setErrorToDelete(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (errorToDelete) {
                    await deleteErrorLog(errorToDelete);
                    setErrorToDelete(null);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                Excluir
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
