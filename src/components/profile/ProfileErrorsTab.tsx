"use client";

import React, { useState } from "react";
import { Account, ErrorLog } from "@/types";
import { useAppState } from "@/context/AppStateContext";
import { formatDate, formatTime } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  Trash2,
  ChevronDown,
  ChevronUp,
  Info,
  History,
  ShieldAlert,
} from "lucide-react";

interface ProfileErrorsTabProps {
  account: Account;
  errors: ErrorLog[];
}

export function ProfileErrorsTab({ account, errors }: ProfileErrorsTabProps) {
  const { resolveError, retryError, deleteErrorLog, clearAllErrorLogs } = useAppState();
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [errorToDelete, setErrorToDelete] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"active" | "resolved" | "all">("active");
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const accountErrors = errors.filter((e) => e.accountId === account.id);
  const pendingErrors = accountErrors.filter((e) => e.status === "pending" || e.status === "retrying");
  const resolvedErrors = accountErrors.filter((e) => e.status === "resolved");

  const displayedErrors = accountErrors.filter((e) => {
    if (filterMode === "active") return e.status === "pending" || e.status === "retrying";
    if (filterMode === "resolved") return e.status === "resolved";
    return true;
  });

  // Helper para interpretar technicalDetails JSON com segurança
  const parseTechnicalDetails = (jsonStr?: string) => {
    if (!jsonStr) return null;
    try {
      return JSON.parse(jsonStr);
    } catch {
      return { raw: jsonStr };
    }
  };

  const parsedTech = selectedError ? parseTechnicalDetails(selectedError.technicalDetails) : null;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Erros e Ocorrências da Conta @{account.username}
          </h3>
          <p className="text-xs text-slate-500">
            Histórico técnico de ocorrências na Meta Graph API com rastreamento assíncrono e recuperação automática.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {accountErrors.length > 0 && (
            <button
              type="button"
              onClick={() => setIsClearAllModalOpen(true)}
              className="px-2.5 py-1 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar histórico</span>
            </button>
          )}
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
            pendingErrors.length > 0
              ? "bg-rose-100 text-rose-700 border border-rose-200"
              : "bg-emerald-100 text-emerald-700 border border-emerald-200"
          }`}>
            {pendingErrors.length} ativo(s)
          </span>
        </div>
      </div>

      {/* Barra de Filtros: Ativos vs Resolvidos vs Todos */}
      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200/80 w-fit">
        <button
          type="button"
          onClick={() => setFilterMode("active")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            filterMode === "active"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
          <span>Erros Ativos ({pendingErrors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterMode("resolved")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            filterMode === "resolved"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <History className="w-3.5 h-3.5 text-emerald-600" />
          <span>Resolvidos Automaticamente ({resolvedErrors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterMode("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            filterMode === "all"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Todos ({accountErrors.length})
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3.5">Data & Hora</th>
                <th className="px-3 py-3.5">Categoria</th>
                <th className="px-4 py-3.5">Conteúdo / Post</th>
                <th className="px-4 py-3.5">Mensagem de Erro</th>
                <th className="px-3 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Ação</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium">
              {displayedErrors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-3">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">
                        {filterMode === "active"
                          ? `Nenhum erro ativo para @${account.username}`
                          : filterMode === "resolved"
                          ? "Nenhum erro resolvido no histórico recente"
                          : `Nenhum erro registrado para @${account.username}`}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm">
                        {filterMode === "active"
                          ? "Todas as publicações e verificações estão operando normalmente sem falhas pendentes."
                          : "O histórico de ocorrências está limpo."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedErrors.map((err) => (
                  <tr
                    key={err.id}
                    onClick={() => {
                      setSelectedError(err);
                      setShowTechnicalDetails(false);
                    }}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-500 font-normal">
                      <div>{formatDate(err.timestamp)}</div>
                      <div className="text-[10px] text-slate-400">{formatTime(err.timestamp)}</div>
                    </td>

                    <td className="px-3 py-3.5 uppercase font-bold text-[10px] text-slate-500">
                      {err.category}
                    </td>

                    <td className="px-4 py-3.5 max-w-[180px] truncate text-slate-700">
                      {err.postTitle || "N/A (Conta)"}
                    </td>

                    <td className="px-4 py-3.5 max-w-xs text-slate-800 font-semibold truncate">
                      {err.errorMessage}
                    </td>

                    <td className="px-3 py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        err.status === "pending"
                          ? "bg-rose-100 text-rose-700 border border-rose-200"
                          : err.status === "retrying"
                          ? "bg-amber-100 text-amber-700 border border-amber-200 animate-pulse"
                          : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                      }`}>
                        {err.status === "pending"
                          ? "Pendente"
                          : err.status === "retrying"
                          ? "Reenviando..."
                          : "Resolvido"}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedError(err);
                          setShowTechnicalDetails(false);
                        }}
                        className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline cursor-pointer"
                      >
                        Diagnóstico
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Diagnóstico Aprimorado do Erro */}
      {selectedError && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="text-sm font-bold text-slate-900">Diagnóstico da Ocorrência</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedError(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Código de Erro</span>
                <strong className="text-slate-800 font-mono text-sm">{selectedError.errorCode}</strong>
              </div>

              <div className={`p-3 rounded-xl border space-y-1 ${
                selectedError.status === "resolved"
                  ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                  : "bg-rose-50/60 border-rose-200 text-rose-900"
              }`}>
                <span className="block text-[10px] font-bold uppercase tracking-wider">
                  {selectedError.status === "resolved" ? "Situação" : "Mensagem Amigável"}
                </span>
                <p className="font-medium leading-relaxed">
                  {selectedError.errorMessage}
                </p>
                {selectedError.status === "resolved" && (
                  <p className="text-[11px] text-emerald-700 mt-1 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Esta ocorrência foi recuperada automaticamente após nova verificação bem-sucedida.
                  </p>
                )}
              </div>

              {/* Botão e Painel Expansível de Detalhes Técnicos (Sem expor tokens ou chaves) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-slate-700 font-semibold text-xs cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-slate-500" />
                    <span>Detalhes técnicos</span>
                  </span>
                  {showTechnicalDetails ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {showTechnicalDetails && (
                  <div className="p-3 bg-slate-900 text-slate-200 space-y-2 font-mono text-[11px] border-t border-slate-800">
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-slate-500 block">Meta Code:</span>
                        <span className="text-slate-300">{parsedTech?.errorCode || selectedError.errorCode}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Subcode:</span>
                        <span className="text-slate-300">{parsedTech?.subcode || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">fbtrace_id:</span>
                        <span className="text-slate-300 break-all">{parsedTech?.fbtraceId || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Tentativas:</span>
                        <span className="text-slate-300">{parsedTech?.publishAttempts || selectedError.attempts || 1} de 2</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Container ID:</span>
                        <span className="text-slate-300 break-all">{parsedTech?.metaContainerId || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Horário:</span>
                        <span className="text-slate-300">{formatDate(selectedError.timestamp)} {formatTime(selectedError.timestamp)}</span>
                      </div>
                    </div>

                    {parsedTech?.details && (
                      <div className="mt-2 pt-2 border-t border-slate-800">
                        <span className="text-slate-500 block text-[10px]">Payload bruto da Meta:</span>
                        <pre className="mt-1 text-[10px] text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-32">
                          {JSON.stringify(parsedTech.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setErrorToDelete(selectedError.id);
                  setSelectedError(null);
                }}
                className="py-1.5 px-3 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir</span>
              </button>

              {selectedError.status !== "resolved" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      resolveError(selectedError.id);
                      setSelectedError(null);
                    }}
                    className="py-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Marcar como resolvido
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      retryError(selectedError.id);
                      setSelectedError(null);
                    }}
                    className="py-1.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    Tentar novamente
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Limpar Erros da Conta */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h4 className="text-sm font-bold text-slate-900">Limpar Erros da Conta</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Deseja realmente excluir todos os registros de erro associados a @{account.username}?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await clearAllErrorLogs(account.id);
                  setIsClearAllModalOpen(false);
                }}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                Sim, limpar tudo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Excluir Erro Individual */}
      {errorToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h4 className="text-sm font-bold text-slate-900">Excluir Registro de Erro</h4>
            <p className="text-xs text-slate-600">
              Deseja remover permanentemente este registro de erro?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setErrorToDelete(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
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
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
