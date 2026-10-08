"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAppState } from "@/context/AppStateContext";
import { useAuth } from "@/context/AuthContext";
import { GlobalAccountSelector } from "./GlobalAccountSelector";
import {
  Bell,
  Plus,
  Menu,
  LogOut,
  Settings,
  ChevronDown,
  HardDrive,
} from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { formatBytes } from "@/lib/utils";

interface HeaderProps {
  onToggleMobileSidebar: () => void;
}

export function Header({ onToggleMobileSidebar }: HeaderProps) {
  const {
    unreadNotificationsCount,
    setIsConnectModalOpen,
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    systemStatus,
    storageUsage,
  } = useAppState();

  const { user, signOut } = useAuth();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Fecha menu de usuário ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const userDisplayName = user?.name || user?.email?.split("@")[0] || "";
  const userEmail = user?.email || "";
  const userInitials = userDisplayName ? userDisplayName.substring(0, 2).toUpperCase() : "";

  const metaStatus = systemStatus.metaApi;
  const metaStatusLabel =
    metaStatus === "connected"
      ? "Conectado"
      : metaStatus === "reconnect_required"
      ? "Reconexão necessária"
      : metaStatus === "error"
      ? "Erro"
      : "Não configurado";
  const metaStatusColor =
    metaStatus === "connected"
      ? "text-emerald-600 font-semibold"
      : metaStatus === "reconnect_required"
      ? "text-amber-600 font-semibold"
      : metaStatus === "error"
      ? "text-rose-600 font-semibold"
      : "text-amber-600 font-semibold";
  const metaDotColor =
    metaStatus === "connected"
      ? "bg-emerald-500"
      : metaStatus === "reconnect_required"
      ? "bg-amber-500"
      : metaStatus === "error"
      ? "bg-rose-500"
      : "bg-slate-400";

  return (
    <header className="sticky top-0 z-30 h-16 w-full bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Esquerda: Botão mobile e Seletor Global de Contas */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="lg:hidden flex items-center">
          <BrandLogo size="md" href="/dashboard" />
        </div>

        {/* Seletor Global de Contas */}
        <GlobalAccountSelector />
      </div>

      {/* Direita: Notificações, Conectar Conta e Menu do Usuário */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Indicador Compacto de Armazenamento */}
        <Link
          href="/uploads"
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
          title="Ver detalhes de armazenamento e mídias"
        >
          <HardDrive className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>
            {storageUsage?.userUsage
              ? `${formatBytes(storageUsage.userUsage.totalBytes)} utilizados • Limite não definido`
              : "Armazenamento"}
          </span>
        </Link>

        {/* Badge Informativo da Meta API */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium">
          <span className={`w-2 h-2 rounded-full ${metaDotColor}`} />
          <span>Meta API:</span>
          <span className={metaStatusColor}>{metaStatusLabel}</span>
        </div>

        {/* Notificações Bell Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Notificações"
          >
            <Bell className="w-5 h-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
            )}
          </button>

          {/* Dropdown de Notificações Rápidas */}
          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">Notificações</h4>
                  {unreadNotificationsCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold">
                      {unreadNotificationsCount} novas
                    </span>
                  )}
                </div>
                {unreadNotificationsCount > 0 && (
                  <button
                    onClick={markAllNotificationsAsRead}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer"
                  >
                    Marcar lidas
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    Nenhuma notificação no momento
                  </div>
                ) : (
                  notifications.slice(0, 5).map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => markNotificationAsRead(notif.id)}
                      className={`p-3.5 text-xs transition-colors cursor-pointer flex items-start gap-3 ${
                        notif.read ? "bg-white hover:bg-slate-50" : "bg-indigo-50/40 hover:bg-indigo-50/70"
                      }`}
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800 flex items-center justify-between">
                          <span>{notif.title}</span>
                          {!notif.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                          )}
                        </div>
                        <p className="text-slate-600 mt-0.5 text-[11px] leading-relaxed">
                          {notif.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2 border-t border-slate-100 text-center bg-slate-50/60">
                <Link
                  href="/notificacoes"
                  onClick={() => setIsNotifOpen(false)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold block py-1"
                >
                  Ver todas as notificações →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Botão Principal: + Conectar conta */}
        <button
          type="button"
          onClick={() => setIsConnectModalOpen(true)}
          className="hidden sm:flex items-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs font-semibold shadow-sm shadow-indigo-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Conectar conta</span>
        </button>

        {/* Divisor */}
        <div className="h-6 w-px bg-slate-200 hidden sm:block" />

        {/* MENU DO USUÁRIO (GOOGLE AUTH & SUPABASE) */}
        {user ? (
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
              aria-expanded={isUserMenuOpen}
            >
              {/* Foto do Usuário (Google ou Iniciais) */}
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0 border border-slate-200">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={userDisplayName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{userInitials}</span>
                )}
              </div>

              <div className="hidden md:flex flex-col text-left max-w-[120px]">
                <span className="text-xs font-bold text-slate-800 leading-tight truncate">
                  {userDisplayName}
                </span>
                <span className="text-[10px] text-slate-400 truncate">
                  {userEmail}
                </span>
              </div>

              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  isUserMenuOpen ? "rotate-180 text-slate-600" : ""
                }`}
              />
            </button>

            {/* Dropdown do Usuário */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Cabeçalho do Card */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={userDisplayName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{userInitials}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-bold text-slate-900 truncate">
                        {userDisplayName}
                      </h5>
                      <p className="text-[11px] text-slate-500 truncate">
                        {userEmail}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">
                          Autenticado
                        </span>
                        <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-md border uppercase tracking-wider ${
                          user.role === "admin"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : user.role === "developer"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                          {user.role || "user"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Links Internos */}
                <div className="p-1.5 space-y-0.5">
                  <Link
                    href="/configuracoes"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Configurações da Conta</span>
                  </Link>
                </div>

                {/* Botão Sair */}
                <div className="p-1.5 border-t border-slate-100 bg-slate-50/30">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsUserMenuOpen(false);
                      await signOut();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Sair da conta</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            Entrar
          </Link>
        )}
      </div>
    </header>
  );
}

