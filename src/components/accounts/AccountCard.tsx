"use client";

import React from "react";
import { Account } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAppState } from "@/context/AppStateContext";
import { useToast } from "@/context/ToastContext";
import {
  Clock,
  Settings,
  RefreshCw,
  Pause,
  Play,
  Wifi,
  Film,
  Layers,
  ArrowRight,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatNumber, formatDate, formatTime } from "@/lib/utils";

interface AccountCardProps {
  account: Account;
}

export function AccountCard({ account }: AccountCardProps) {
  const { toggleAccountPause, reconnectAccount, refreshAccounts, reelQueues, carouselQueues, scheduledPosts } = useAppState();
  const { addToast } = useToast();
  const [isTesting, setIsTesting] = React.useState(false);

  const reelsInQueue = reelQueues
    .filter((q) => q.accountId === account.id)
    .reduce((acc, q) => acc + q.remainingCount, 0);

  const carouselsInQueue = carouselQueues
    .filter((q) => q.accountId === account.id)
    .reduce((acc, q) => acc + q.remainingCount, 0);

  const accountScheduled = scheduledPosts
    .filter((p) => p.accountId === account.id && p.status === "scheduled")
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const nextPostText = accountScheduled.length > 0
    ? `${formatDate(accountScheduled[0].scheduledAt)} às ${formatTime(accountScheduled[0].scheduledAt)}`
    : "Nenhuma agendada";

  const handleTestConnection = async () => {
    setIsTesting(true);
    addToast({
      type: "info",
      title: "Testando Conexão...",
      message: `Verificando credenciais e escopos da Meta Graph API para @${account.username}...`,
    });

    try {
      const res = await fetch("/api/instagram/verify-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast({
          type: "success",
          title: "Conexão Verificada!",
          message: data.message || `A API da Meta respondeu com status 200 OK para @${account.username}.`,
        });
        void refreshAccounts();
      } else {
        addToast({
          type: "error",
          title: "Falha no Teste de Conexão",
          message: data.message || "Token inválido ou expirado na Meta.",
        });
        void refreshAccounts();
      }
    } catch {
      addToast({
        type: "error",
        title: "Erro de Comunicação",
        message: "Falha ao conectar com o servidor.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group">
      <div>
        {/* Topo do Card: Avatar, @username e Status */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/contas/${account.id}`}
              className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shrink-0 flex items-center justify-center bg-slate-100"
            >
              {account.profilePicture ? (
                <Image
                  src={account.profilePicture}
                  alt={account.username}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  unoptimized
                />
              ) : (
                <span className="font-bold text-slate-500 text-base uppercase select-none">
                  {account.username.charAt(0) || "I"}
                </span>
              )}
            </Link>
            <div className="min-w-0">
              <Link
                href={`/contas/${account.id}`}
                className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors truncate block"
              >
                @{account.username}
              </Link>
              <p className="text-xs text-slate-500 truncate">{account.name}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <StatusBadge status={account.status} />
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                account.connectionMode === "external"
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-indigo-50 text-indigo-700 border-indigo-200"
              }`}
            >
              Modo: {account.connectionMode === "external" ? "Externo" : "Desenvolvimento"}
            </span>
          </div>
        </div>

        {/* Mensagem de alerta se houver */}
        {account.statusMessage && (
          <div className="mb-4 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
            {account.statusMessage}
          </div>
        )}

        {/* Informações e Métricas Obrigatórias por Perfil */}
        <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Seguidores</span>
            <span className="font-bold text-slate-800">
              {formatNumber(account.followers)}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Posts hoje</span>
            <span className="font-bold text-slate-800">{account.postsToday}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[10px]">Reels na fila</span>
              <span className="font-bold text-rose-600">{reelsInQueue}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[10px]">Carrosséis na fila</span>
              <span className="font-bold text-purple-600">{carouselsInQueue}</span>
            </div>
          </div>
        </div>

        <div className="py-2.5 text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">Próxima: <strong className="text-slate-700">{nextPostText}</strong></span>
          </div>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
        <Link
          href={`/contas/${account.id}`}
          className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold text-center transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
        >
          <span>Gerenciar Perfil</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>

        <button
          type="button"
          disabled={isTesting}
          onClick={handleTestConnection}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
          title="Testar conexão com a Meta"
        >
          <Wifi className={`w-4 h-4 ${isTesting ? "animate-pulse text-indigo-600" : ""}`} />
        </button>

        <button
          type="button"
          onClick={() => toggleAccountPause(account.id)}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title={account.status === "paused" ? "Reativar publicações" : "Pausar publicações"}
        >
          {account.status === "paused" ? (
            <Play className="w-4 h-4 text-emerald-600" />
          ) : (
            <Pause className="w-4 h-4" />
          )}
        </button>

        {account.status === "expired" && (
          <button
            type="button"
            onClick={() => reconnectAccount(account.id)}
            className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors"
            title="Reconectar Token Meta"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        <Link
          href={`/contas/${account.id}#configuracoes`}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Configurações da conta"
        >
          <Settings className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
