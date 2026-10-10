"use client";

import React, { useState } from "react";
import { useAppState } from "@/context/AppStateContext";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { ScheduledPost } from "@/types";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Film,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  History,
} from "lucide-react";
import Image from "next/image";
import { formatDate, formatTime } from "@/lib/utils";

export default function AgendaPage() {
  const { scheduledPosts, selectedAccountId, accounts } = useAppState();

  const [viewMode, setViewMode] = useState<"month" | "week" | "day" | "list">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);

  // Filtros
  const [profileFilter, setProfileFilter] = useState(selectedAccountId);
  const [typeFilter, setTypeFilter] = useState<"all" | "reel" | "carousel">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredPosts = scheduledPosts.filter((post) => {
    if (profileFilter !== "all" && post.accountId !== profileFilter) return false;
    if (typeFilter !== "all" && post.type !== typeFilter) return false;
    if (statusFilter !== "all" && post.status !== statusFilter) return false;
    return true;
  });

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const monthName = currentDate.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  // Dias do mês
  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Agenda de Conteúdo
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Planejamento e visualização cronológica de todos os Reels e Carrosséis programados.
          </p>
        </div>

        {/* Controles de Navegação e Alternador de Visão */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleToday}
            className="py-1.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            Hoje
          </button>

          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-800 px-3 capitalize">
              {monthName}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              aria-label="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            {(
              [
                { id: "month", label: "Mês" },
                { id: "week", label: "Semana" },
                { id: "day", label: "Dia" },
                { id: "list", label: "Lista" },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === mode.id
                    ? "bg-white text-slate-900 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Filtro por Perfil */}
        <select
          value={profileFilter}
          onChange={(e) => setProfileFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
        >
          <option value="all">Todos os perfis</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              @{acc.username}
            </option>
          ))}
        </select>

        {/* Filtro por Tipo */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
        >
          <option value="all">Todos os tipos</option>
          <option value="reel">Apenas Reels</option>
          <option value="carousel">Apenas Carrosséis</option>
        </select>

        {/* Filtro por Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
        >
          <option value="all">Todos os status</option>
          <option value="scheduled">Agendado</option>
          <option value="processing">Processando</option>
          <option value="published">Publicado</option>
          <option value="error">Erro</option>
        </select>
      </div>

      {/* Visualização de Mês em Grade */}
      {viewMode === "month" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          {/* Cabeçalho dos dias da semana */}
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center text-xs font-bold text-slate-500 uppercase tracking-wider py-2.5">
            <span>Dom</span>
            <span>Seg</span>
            <span>Ter</span>
            <span>Qua</span>
            <span>Qui</span>
            <span>Sex</span>
            <span>Sáb</span>
          </div>

          {/* Células dos dias */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 min-h-[520px]">
            {Array.from({ length: 35 }, (_, index) => {
              const dayNum = index - 1; // Ajuste simplificado
              const isValidDay = dayNum > 0 && dayNum <= daysInMonth;
              const now = new Date();
              const isToday =
                isValidDay &&
                dayNum === now.getDate() &&
                currentDate.getMonth() === now.getMonth() &&
                currentDate.getFullYear() === now.getFullYear();

              const dayPosts = isValidDay
                ? filteredPosts.filter((p) => {
                    const d = new Date(p.scheduledAt).getDate();
                    return d === dayNum;
                  })
                : [];

              return (
                <div
                  key={index}
                  className={`p-2 min-h-[90px] flex flex-col justify-between transition-colors ${
                    isValidDay ? "bg-white hover:bg-slate-50/50" : "bg-slate-50/40 opacity-40"
                  } ${isToday ? "ring-2 ring-indigo-500/30 bg-indigo-50/20" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        isToday
                          ? "w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]"
                          : "text-slate-700"
                      }`}
                    >
                      {isValidDay ? dayNum : ""}
                    </span>

                    {dayPosts.length > 0 && (
                      <span className="text-[10px] font-semibold text-slate-400">
                        {dayPosts.length} posts
                      </span>
                    )}
                  </div>

                  {/* Postagens dentro do dia */}
                  <div className="space-y-1 mt-1">
                    {dayPosts.slice(0, 2).map((post) => (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => setSelectedPost(post)}
                        className="w-full text-left p-1 rounded-md text-[10px] font-medium bg-indigo-50 text-indigo-900 border border-indigo-200/60 truncate block hover:bg-indigo-100 transition-colors cursor-pointer"
                      >
                        <span className="font-bold mr-1">
                          {formatTime(post.scheduledAt)}
                        </span>
                        @{post.accountUsername}
                      </button>
                    ))}
                    {dayPosts.length > 2 && (
                      <span className="text-[9px] text-slate-400 font-semibold block text-center">
                        +{dayPosts.length - 2} mais
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Visualização em Lista */}
      {(viewMode === "list" || viewMode === "day" || viewMode === "week") && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          {filteredPosts.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">
                Nenhuma publicação agendada
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Crie uma fila de Reels ou novo Carrossel para visualizar seus horários na agenda.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative">
                      <Image
                        src={post.thumbnailUrl}
                        alt={post.title}
                        width={48}
                        height={56}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {formatDate(post.scheduledAt)} às {formatTime(post.scheduledAt)}
                        </span>
                        <span className="text-xs text-indigo-600 font-semibold">
                          @{post.accountUsername}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          {post.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 truncate max-w-md mt-0.5">
                        {post.title}
                      </p>
                    </div>
                  </div>

                  <StatusBadge status={post.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Detalhes da Postagem */}
      {selectedPost && (
        <Modal
          isOpen={Boolean(selectedPost)}
          onClose={() => setSelectedPost(null)}
          title="Detalhes da Publicação Agendada"
          description={`ID: ${selectedPost.id} • Perfil: @${selectedPost.accountUsername}`}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="relative w-20 h-28 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                <Image
                  src={selectedPost.thumbnailUrl}
                  alt={selectedPost.title}
                  width={80}
                  height={112}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>

              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedPost.status} />
                  <span className="text-xs font-semibold text-slate-500 uppercase">
                    {selectedPost.type === "reel" ? "Reel de Vídeo" : "Carrossel de Imagens"}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900">{selectedPost.title}</h4>
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Programado para: {formatDate(selectedPost.scheduledAt)} às {formatTime(selectedPost.scheduledAt)}</span>
                </div>
              </div>
            </div>

            {/* Legenda */}
            <div className="space-y-1 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Legenda do Post
              </span>
              <p className="leading-relaxed whitespace-pre-wrap">{selectedPost.caption}</p>
            </div>

            {/* Histórico / Logs */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-indigo-600" />
                Histórico de Eventos
              </span>
              <div className="space-y-1.5 font-mono text-[11px] bg-slate-900 text-slate-200 p-3 rounded-xl">
                {selectedPost.history.map((log, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-slate-500">
                      [{new Date(log.timestamp).toLocaleTimeString("pt-BR")}]
                    </span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={() => setSelectedPost(null)}
                className="py-2 px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
