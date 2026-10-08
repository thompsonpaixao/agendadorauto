"use client";

import React, { useState } from "react";
import { Account } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAppState } from "@/context/AppStateContext";
import { useToast } from "@/context/ToastContext";
import {
  Wifi,
  RefreshCw,
  Pause,
  Play,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import Image from "next/image";
import Link from "next/link";

interface ProfileHeaderProps {
  account: Account;
  activeTabTitle: string;
}

export function ProfileHeader({ account, activeTabTitle }: ProfileHeaderProps) {
  const { toggleAccountPause, reconnectAccount } = useAppState();
  const { addToast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);

  const handleTestConnection = async () => {
    setIsVerifying(true);
    addToast({
      type: "info",
      title: "Verificando Conexão...",
      message: `Consultando a Meta Graph API para @${account.username}...`,
    });

    try {
      const res = await fetch("/api/instagram/verify-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id }),
      });

      const data = await res.json();

      if (data.success) {
        addToast({
          type: "success",
          title: "Conexão Verificada!",
          message: data.message || `Meta API operacional e permissões ativas para @${account.username}.`,
        });
      } else {
        addToast({
          type: "error",
          title: "Atenção na Conexão",
          message: data.message || "Acesso expirado ou revogado. Faça reconexão.",
        });
      }
    } catch {
      addToast({
        type: "error",
        title: "Erro de Rede",
        message: "Não foi possível contatar o servidor para verificação.",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Migalhas de Navegação (Breadcrumb) */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link
          href="/contas"
          className="hover:text-slate-800 transition-colors flex items-center gap-1 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Contas</span>
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <span className="font-bold text-slate-800 flex items-center gap-1">
          <InstagramIcon className="w-3.5 h-3.5 text-pink-600" />
          @{account.username}
        </span>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <span className="text-slate-500 font-medium">{activeTabTitle}</span>
      </div>

      {/* Card do Perfil */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-sm shrink-0 bg-slate-100 flex items-center justify-center">
            {account.profilePicture ? (
              <Image
                src={account.profilePicture}
                alt={account.username}
                width={64}
                height={64}
                className="w-full h-full object-cover"
                unoptimized
              />
            ) : (
              <span className="font-bold text-slate-500 text-xl uppercase select-none">
                {account.username.charAt(0) || "I"}
              </span>
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                @{account.username}
              </h1>
              <StatusBadge status={account.status} />
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg border ${
                  account.connectionMode === "external"
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : "bg-indigo-50 text-indigo-700 border-indigo-200"
                }`}
              >
                Modo: {account.connectionMode === "external" ? "Externo" : "Desenvolvimento"}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{account.name}</p>
          </div>
        </div>

        {/* Ações do Topo */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão Oficial: Abrir no Instagram */}
          <a
            href={`https://www.instagram.com/${account.username}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Abrir perfil oficial no Instagram"
          >
            <ExternalLink className="w-3.5 h-3.5 text-pink-600" />
            <span>Abrir no Instagram</span>
          </a>

          {/* Botão Oficial: Verificar Conexão Real */}
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isVerifying}
            className="py-2 px-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Realizar verificação em tempo real na Meta Graph API"
          >
            {isVerifying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-indigo-600" />
            )}
            <span>{isVerifying ? "Verificando..." : "Verificar conexão"}</span>
          </button>

          {account.status === "expired" && (
            <button
              type="button"
              onClick={() => reconnectAccount(account.id)}
              className="py-2 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reconectar</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => toggleAccountPause(account.id)}
            className={`py-2 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              account.status === "paused"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                : "border border-slate-200 hover:bg-slate-50 text-slate-700"
            }`}
          >
            {account.status === "paused" ? (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Reativar publicações</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pausar publicações</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
