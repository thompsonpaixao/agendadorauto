"use client";

import React from "react";
import { useAppState } from "@/context/AppStateContext";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Layers, Plus, Play, Pause, Edit, XCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default function FilasCarrosseisPage() {
  const { carouselQueues, selectedAccountId, toggleQueuePause } = useAppState();

  const filtered = selectedAccountId === "all"
    ? carouselQueues
    : carouselQueues.filter((q) => q.accountId === selectedAccountId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Filas de Carrosséis
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200">
              {filtered.length} ativas
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Programações e sequências de postagem com múltiplos slides por publicação.
          </p>
        </div>

        <Link
          href="/carrosseis/novo"
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Criar carrossel</span>
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">
            Nenhuma fila de carrosséis
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Não há filas ativas para a conta selecionada. Crie sua primeira sequência de carrosséis para iniciar a programação.
          </p>
          <Link
            href="/carrosseis/novo"
            className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-sm shadow-purple-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Carrossel Agora</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
        {filtered.map((queue) => {
          const percent = Math.round(
            (queue.publishedCount / (queue.totalCarousels || 1)) * 100
          );

          return (
            <div
              key={queue.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4"
            >
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
                      <h3 className="text-sm font-bold text-slate-900">{queue.name}</h3>
                      <StatusBadge status={queue.status} />
                    </div>
                    <span className="text-xs text-indigo-600 font-semibold">
                      @{queue.accountUsername}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  Criada em {formatDate(queue.createdAt)}
                </div>
              </div>

              <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    {queue.publishedCount} / {queue.totalCarousels} carrosséis publicados ({percent}%)
                  </span>
                  <span className="text-slate-500">
                    Restantes: <strong className="text-slate-800">{queue.remainingCount}</strong>
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => toggleQueuePause(queue.id, "carousel")}
                  className="py-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5"
                >
                  {queue.status === "paused" ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  <span>{queue.status === "paused" ? "Reativar" : "Pausar"}</span>
                </button>
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}
