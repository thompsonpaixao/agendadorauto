"use client";

import React from "react";
import { CheckCircle2, X, Code2, Sparkles } from "lucide-react";
import { ReelPublishResponse } from "@/types/reel";

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ReelPublishResponse | null;
  onReset: () => void;
}

export function StatusModal({ isOpen, onClose, result, onReset }: StatusModalProps) {
  if (!isOpen || !result) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/30 overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho do Modal */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center mb-3 text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white">Reel Processado com Sucesso!</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm">
            {result.message}
          </p>
        </div>

        {/* Informações detalhadas do container */}
        <div className="space-y-3 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 text-xs font-mono">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-800/60 text-zinc-400">
            <span className="flex items-center gap-1.5 font-sans font-medium text-zinc-300">
              <Code2 className="w-3.5 h-3.5 text-rose-400" />
              Meta Graph API Container
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-sans font-medium">
              Processado
            </span>
          </div>

          <div className="flex flex-col gap-1 text-zinc-300">
            <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Container ID gerado:</span>
            <span className="text-zinc-200 break-all select-all bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
              {result.containerId}
            </span>
          </div>

          <div className="flex flex-col gap-1 text-zinc-300">
            <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Status de envio:</span>
            <span className="text-zinc-200">
              {result.data.status === "scheduled"
                ? `Agendado para: ${result.data.scheduledTime}`
                : "Pronto para disparo (Disponível para deploy e conexão com Meta)"}
            </span>
          </div>

          <div className="flex flex-col gap-1 text-zinc-300">
            <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Data de criação:</span>
            <span className="text-zinc-400">{new Date(result.creationTime).toLocaleString("pt-BR")}</span>
          </div>
        </div>

        {/* Nota informativa sobre a Meta API */}
        <div className="mt-4 p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/30 text-xs text-purple-200 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <span>
            A camada visual e de backend do seu aplicativo já está concluída. Assim que você cadastrar suas credenciais da Meta no arquivo <code className="px-1 py-0.5 rounded bg-purple-900/40 text-purple-300 font-mono text-[11px]">.env.local</code>, a publicação real será ativada automaticamente.
          </span>
        </div>

        {/* Botões de Ação */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => {
              onReset();
              onClose();
            }}
            className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-white text-xs font-semibold transition-colors border border-zinc-700 text-center"
          >
            Criar Novo Reel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-600 hover:to-purple-700 text-white text-xs font-semibold transition-all shadow-md shadow-rose-500/20 text-center"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
