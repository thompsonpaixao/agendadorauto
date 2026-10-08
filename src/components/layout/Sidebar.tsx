"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "@/context/AppStateContext";
import { useAuth } from "@/context/AuthContext";
import { ServiceStatus } from "@/types";
import {
  LayoutDashboard,
  Users,
  Film,
  Layers,
  Calendar,
  BarChart3,
  AlertTriangle,
  Bell,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Server,
  User,
  CheckCircle,
  ArrowLeft,
  LogOut,
  ChevronUp,
  UploadCloud,
  Compass,
  FileBarChart,
} from "lucide-react";
import Image from "next/image";
import { BrandLogo } from "@/components/ui/BrandLogo";

interface SidebarProps {
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

function getServiceStatusDisplay(status: ServiceStatus): { label: string; textClass: string; dotClass: string } {
  switch (status) {
    case "connected":
      return {
        label: "Conectado",
        textClass: "text-emerald-400",
        dotClass: "bg-emerald-500",
      };
    case "reconnect_required":
      return {
        label: "Reconexão necessária",
        textClass: "text-amber-300",
        dotClass: "bg-amber-400",
      };
    case "error":
      return {
        label: "Erro",
        textClass: "text-rose-400",
        dotClass: "bg-rose-500",
      };
    case "not_configured":
    default:
      return {
        label: "Não configurado",
        textClass: "text-amber-400/90",
        dotClass: "bg-amber-500",
      };
  }
}

export function Sidebar({ isMobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  const { accounts, errors, unreadNotificationsCount, systemStatus, setIsConnectModalOpen } = useAppState();
  const { user, signOut } = useAuth();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Fecha menu de usuário ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isUserMenuOpen]);

  const criticalErrors = errors.filter((e) => e.status === "pending").length;

  const isProfileRoute = pathname.startsWith("/contas/") && pathname !== "/contas";
  const profileId = isProfileRoute ? pathname.split("/")[2] : null;
  const currentProfile = accounts.find((a) => a.id === profileId);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Backdrop para mobile */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col bg-slate-900 text-slate-300 border-r border-slate-800 transition-all duration-300 ${
          isCollapsed ? "w-20" : "w-64"
        } ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Topo: Logo & Botão de Recolher */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80 shrink-0">
          <Link
            href="/dashboard"
            onClick={onCloseMobile}
            className={`flex items-center overflow-hidden transition-all ${
              isCollapsed ? "justify-center w-full" : "px-1"
            }`}
            title="AgendadorAuto"
          >
            <BrandLogo
              theme="light-text"
              size={isCollapsed ? "md" : "lg"}
              collapsed={isCollapsed}
            />
          </Link>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={isCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Lista de Navegação com Scroll */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
          {/* SE ESTIVER DENTRO DE UM PERFIL ESPECÍFICO */}
          {isProfileRoute && currentProfile ? (
            <div className="space-y-4">
              {/* Card do Perfil Ativo na Sidebar */}
              {!isCollapsed ? (
                <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700/80 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-600 shrink-0">
                      <Image
                        src={currentProfile.profilePicture}
                        alt={currentProfile.username}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">
                        @{currentProfile.username}
                      </div>
                      <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Ambiente Ativo
                      </div>
                    </div>
                  </div>

                  <Link
                    href="/contas"
                    onClick={onCloseMobile}
                    className="w-full py-1 px-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors block text-center"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Trocar de perfil</span>
                  </Link>
                </div>
              ) : (
                <div className="flex justify-center pb-2">
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-600">
                    <Image
                      src={currentProfile.profilePicture}
                      alt={currentProfile.username}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                </div>
              )}

              {/* 8 Abas do Perfil */}
              <div className="space-y-0.5">
                {!isCollapsed && (
                  <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Gerenciamento da Conta
                  </div>
                )}

                {[
                  { id: "visao-geral", label: "Visão Geral", icon: LayoutDashboard },
                  { id: "uploads", label: "Uploads", icon: UploadCloud },
                  { id: "reels", label: "Reels", icon: Film },
                  { id: "carrosseis", label: "Carrosséis", icon: Layers },
                  { id: "agenda", label: "Agenda", icon: Calendar },
                  { id: "publicados", label: "Publicados", icon: CheckCircle },
                  { id: "analytics", label: "Analytics", icon: BarChart3 },
                  { id: "erros", label: "Erros da Conta", icon: AlertTriangle },
                  { id: "configuracoes", label: "Configurações", icon: Settings },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.id}
                      href={`/contas/${currentProfile.id}?tab=${item.id}`}
                      onClick={onCloseMobile}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800/70 hover:text-white transition-all"
                      title={item.label}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!isCollapsed && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>

              <div className="h-px bg-slate-800 my-2" />

              {/* Retorno ao Dashboard Geral */}
              <Link
                href="/dashboard"
                onClick={onCloseMobile}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800/70 hover:text-slate-200 transition-all"
                title="Dashboard Geral"
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Dashboard Geral</span>}
              </Link>
            </div>
          ) : (
            /* SE ESTIVER NO MODO GERAL / VISÃO CONSOLIDADA */
            <>
              {/* Dashboard Geral */}
              <Link
                href="/dashboard"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive("/dashboard")
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                }`}
                title="Dashboard Geral"
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Dashboard Geral</span>}
              </Link>

              {/* Contas */}
              <Link
                href="/contas"
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive("/contas")
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                }`}
                title="Contas Conectadas"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span>Contas (Perfis)</span>}
                </div>
                {!isCollapsed && (
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-400 font-bold">
                    {accounts.length}
                  </span>
                )}
              </Link>

              {/* Lista Rápida de Perfis Conectados */}
              {accounts.length > 0 && (
                <div className="pt-2">
                  {!isCollapsed && (
                    <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Perfis Conectados
                    </div>
                  )}
                  <div className="space-y-0.5 mt-1">
                    {accounts.map((acc) => (
                      <Link
                        key={acc.id}
                        href={`/contas/${acc.id}`}
                        onClick={onCloseMobile}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800/70 hover:text-white transition-all group"
                        title={`@${acc.username}`}
                      >
                        <div className="relative w-5 h-5 rounded-md overflow-hidden border border-slate-700 shrink-0">
                          <Image
                            src={acc.profilePicture}
                            alt={acc.username}
                            width={20}
                            height={20}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        </div>
                        {!isCollapsed && (
                          <span className="truncate group-hover:text-indigo-400">
                            @{acc.username}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Botão Conectar Conta */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-400 hover:bg-indigo-950/40 hover:text-indigo-300 transition-colors cursor-pointer"
                  title="Conectar novo perfil"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span>+ Conectar Perfil</span>}
                </button>
              </div>

              {/* Uploads Geral */}
              <Link
                href="/uploads"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive("/uploads")
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                }`}
                title="Repositório Geral de Uploads"
              >
                <UploadCloud className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Uploads</span>}
              </Link>

              {/* Monitoramento de Perfis */}
              <Link
                href="/monitoramento"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive("/monitoramento")
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                }`}
                title="Perfis Monitorados"
              >
                <Compass className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Monitoramento</span>}
              </Link>

              {/* Relatórios */}
              <Link
                href="/relatorios"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive("/relatorios")
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                }`}
                title="Relatórios de Desempenho"
              >
                <FileBarChart className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Relatórios</span>}
              </Link>

              <div className="h-px bg-slate-800/80 my-3" />

              {/* Erros e Alertas Globais */}
              <Link
                href="/erros"
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive("/erros")
                    ? "bg-rose-600 text-white shadow-xs shadow-rose-600/20"
                    : criticalErrors > 0
                    ? "text-rose-300 hover:bg-rose-950/40 hover:text-rose-200"
                    : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                }`}
                title="Erros e Alertas Globais"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className={`w-4 h-4 shrink-0 ${criticalErrors > 0 ? "text-rose-400" : "text-slate-400"}`} />
                  {!isCollapsed && <span>Erros e Alertas</span>}
                </div>
                {!isCollapsed && criticalErrors > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold animate-pulse">
                    {criticalErrors}
                  </span>
                )}
              </Link>

              {/* Notificações */}
              <Link
                href="/notificacoes"
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive("/notificacoes")
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                }`}
                title="Notificações"
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span>Notificações</span>}
                </div>
                {!isCollapsed && unreadNotificationsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-indigo-500 text-white text-[10px] font-bold">
                    {unreadNotificationsCount}
                  </span>
                )}
              </Link>

              {/* Configurações Globais */}
              <Link
                href="/configuracoes"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive("/configuracoes")
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                }`}
                title="Configurações Globais"
              >
                <Settings className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Configurações</span>}
              </Link>
            </>
          )}
        </nav>

        {/* Rodapé da Sidebar: Status e Usuário */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 shrink-0 space-y-2">
          {!isCollapsed ? (
            <>
              {/* Indicador de Status do Sistema */}
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400 space-y-2">
                <div className="flex items-center justify-between font-medium">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Server className="w-3.5 h-3.5 text-slate-400" />
                    Status do Sistema
                  </span>
                </div>
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Meta API</span>
                    <span className={`font-medium flex items-center gap-1.5 ${getServiceStatusDisplay(systemStatus.metaApi).textClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${getServiceStatusDisplay(systemStatus.metaApi).dotClass}`} />
                      {getServiceStatusDisplay(systemStatus.metaApi).label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Banco</span>
                    <span className={`font-medium flex items-center gap-1.5 ${getServiceStatusDisplay(systemStatus.database).textClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${getServiceStatusDisplay(systemStatus.database).dotClass}`} />
                      {getServiceStatusDisplay(systemStatus.database).label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Armazenamento</span>
                    <span className={`font-medium flex items-center gap-1.5 ${getServiceStatusDisplay(systemStatus.storage).textClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${getServiceStatusDisplay(systemStatus.storage).dotClass}`} />
                      {getServiceStatusDisplay(systemStatus.storage).label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Usuário Real do Google / Supabase */}
              {user ? (
                <div className="relative" ref={userMenuRef}>
                  {/* Popover do Usuário */}
                  {isUserMenuOpen && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 shadow-2xl shadow-black/80 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                      <div className="px-3 py-2 border-b border-slate-800/80 mb-1">
                        <div className="flex items-center justify-between gap-1">
                          <div className="text-xs font-bold text-white truncate">
                            {user.name || user.email.split("@")[0]}
                          </div>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider shrink-0 ${
                            user.role === "admin"
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                              : user.role === "developer"
                              ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}>
                            {user.role || "user"}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {user.email}
                        </div>
                      </div>
                      <Link
                        href="/configuracoes"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onCloseMobile();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5 text-slate-400" />
                        <span>Configurações da conta</span>
                      </Link>
                      <button
                        type="button"
                        onClick={async () => {
                          setIsUserMenuOpen(false);
                          await signOut();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sair</span>
                      </button>
                    </div>
                  )}

                  {/* Trigger do Usuário */}
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="w-full flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all cursor-pointer text-left group"
                    aria-label="Menu do usuário"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name || "Foto de perfil"}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs font-bold shrink-0">
                          {(user.name || user.email).substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                          {user.name || user.email.split("@")[0]}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {user.email}
                        </div>
                      </div>
                    </div>
                    <ChevronUp
                      className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
                        isUserMenuOpen ? "rotate-180 text-slate-300" : ""
                      }`}
                    />
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  systemStatus.database === "connected"
                    ? "bg-emerald-500"
                    : systemStatus.database === "error"
                    ? "bg-rose-500"
                    : "bg-amber-500"
                }`}
                title="Status do Sistema"
              />
              {user ? (
                user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name || "Perfil"}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover border border-slate-700"
                    title={user.name || user.email}
                  />
                ) : (
                  <div
                    className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-[10px] font-bold"
                    title={user.name || user.email}
                  >
                    {(user.name || user.email).substring(0, 2).toUpperCase()}
                  </div>
                )
              ) : null}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

