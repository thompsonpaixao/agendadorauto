"use client";

import React from "react";
import { useAppState } from "@/context/AppStateContext";
import { Layers, ArrowRight, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function NovoCarrosselRedirectPage() {
  const { accounts, setIsConnectModalOpen } = useAppState();

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="text-center space-y-2 py-4">
        <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 mx-auto mb-2">
          <Layers className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Selecione o Perfil para Criar Carrosséis
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto">
          Cada perfil possui seu próprio construtor, repositório de slides e legendas pré-configuradas.
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
          <h3 className="text-base font-bold text-slate-800">
            Nenhuma conta conectada
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Conecte sua conta do Instagram para iniciar a criação de carrosséis.
          </p>
          <button
            type="button"
            onClick={() => setIsConnectModalOpen(true)}
            className="py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>+ Conectar conta do Instagram</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {accounts.map((acc) => (
            <Link
              key={acc.id}
              href={`/contas/${acc.id}?tab=carrosseis`}
              className="p-5 bg-white border border-slate-200 hover:border-purple-300 hover:shadow-md rounded-2xl transition-all flex flex-col justify-between group"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                  <Image
                    src={acc.profilePicture}
                    alt={acc.username}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    unoptimized
                  />
                </div>
                <div className="truncate">
                  <div className="text-sm font-bold text-slate-900 group-hover:text-purple-600 truncate">
                    @{acc.username}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{acc.name}</div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-purple-600">
                <span>Abrir Construtor do Perfil</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
