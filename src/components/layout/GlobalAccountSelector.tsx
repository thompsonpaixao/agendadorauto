"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/context/AppStateContext";
import { ChevronDown, Check, Plus, Search, Layers } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Image from "next/image";

export function GlobalAccountSelector() {
  const router = useRouter();
  const {
    accounts,
    selectedAccountId,
    selectedAccount,
    setSelectedAccountId,
    setIsConnectModalOpen,
  } = useAppState();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão Gatilho do Seletor */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-left transition-all shadow-2xs hover:border-slate-300 cursor-pointer"
        aria-expanded={isOpen}
      >
        {accounts.length === 0 ? (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800 leading-tight">
                Nenhuma conta conectada
              </span>
              <span className="text-[10px] text-indigo-600 font-medium">+ Conectar conta</span>
            </div>
          </div>
        ) : selectedAccountId === "all" ? (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Layers className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800 leading-tight flex items-center gap-1.5">
                Todas as contas
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                  {accounts.length}
                </span>
              </span>
              <span className="text-[10px] text-slate-400">Visão agregada</span>
            </div>
          </div>
        ) : selectedAccount ? (
          <div className="flex items-center gap-2.5">
            <div className="relative w-7 h-7 rounded-lg overflow-hidden border border-slate-200 shrink-0">
              <Image
                src={selectedAccount.profilePicture}
                alt={selectedAccount.username}
                width={28}
                height={28}
                className="w-full h-full object-cover"
                unoptimized
              />
              <span
                className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white ${
                  selectedAccount.status === "connected"
                    ? "bg-emerald-500"
                    : selectedAccount.status === "expired"
                    ? "bg-amber-500"
                    : selectedAccount.status === "error"
                    ? "bg-rose-500"
                    : "bg-slate-400"
                }`}
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800 leading-tight">
                  @{selectedAccount.username}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 truncate max-w-[110px]">
                {selectedAccount.name}
              </span>
            </div>
          </div>
        ) : null}

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ml-1 ${
            isOpen ? "rotate-180 text-slate-600" : ""
          }`}
        />
      </button>

      {/* Menu Dropdown */}
      {isOpen && (
        <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Campo de Busca Rápida */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar contas..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
            {accounts.length > 0 && (
              <>
                {/* Opção: Todas as contas */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAccountId("all");
                    setIsOpen(false);
                    router.push("/dashboard");
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                    selectedAccountId === "all"
                      ? "bg-indigo-50 text-indigo-900 font-semibold"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-indigo-100/70 text-indigo-700 flex items-center justify-center text-xs">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span>Todas as contas</span>
                      <span className="text-[10px] text-slate-400 ml-1.5">
                        ({accounts.length} perfis)
                      </span>
                    </div>
                  </div>
                  {selectedAccountId === "all" && (
                    <Check className="w-4 h-4 text-indigo-600" />
                  )}
                </button>

                <div className="my-1 border-t border-slate-100 px-2 pt-1 text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                  Contas Conectadas
                </div>
              </>
            )}

            {filteredAccounts.map((acc) => {
              const isSelected = selectedAccountId === acc.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => {
                    setSelectedAccountId(acc.id);
                    setIsOpen(false);
                    router.push(`/contas/${acc.id}`);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-indigo-50 text-indigo-900 font-semibold"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-6 h-6 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                      <Image
                        src={acc.profilePicture}
                        alt={acc.username}
                        width={24}
                        height={24}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="truncate">
                      <div className="truncate text-slate-800">@{acc.username}</div>
                      <div className="text-[10px] text-slate-400 truncate">{acc.name}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <StatusBadge status={acc.status} dotOnly />
                    {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                  </div>
                </button>
              );
            })}

            {filteredAccounts.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">
                Nenhuma conta encontrada com &quot;{searchTerm}&quot;
              </div>
            )}
          </div>

          {/* Botão Inferior: + Conectar nova conta */}
          <div className="p-2 border-t border-slate-100 bg-slate-50/50">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsConnectModalOpen(true);
              }}
              className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-2xs hover:text-indigo-600 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-600" />
              <span>Conectar nova conta</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
