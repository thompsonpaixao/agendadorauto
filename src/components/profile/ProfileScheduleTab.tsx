"use client";

import React, { useState } from "react";
import { Account, ScheduledPost, PublishedPost, ErrorLog } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatTime } from "@/lib/utils";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Film,
  Layers,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import Image from "next/image";

interface ProfileScheduleTabProps {
  account: Account;
  scheduledPosts: ScheduledPost[];
  publishedPosts: PublishedPost[];
  errors: ErrorLog[];
}

export function ProfileScheduleTab({
  account,
  scheduledPosts,
  publishedPosts,
  errors,
}: ProfileScheduleTabProps) {
  const [viewMode, setViewMode] = useState<"month" | "week" | "day" | "list">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);

  // Unifica posts da conta
  const totalAccountScheduled = scheduledPosts.filter((p) => p.accountId === account.id);
  const totalAccountPublished = publishedPosts.filter((p) => p.accountId === account.id);
  const totalAccountErrors = errors.filter((e) => e.accountId === account.id);

  // Navegação no mês
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const monthName = currentDate.toLocaleString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Controles do Calendário */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold text-slate-900 capitalize">
            {monthName}
          </h3>
          <div className="flex items-center gap-1 border border-slate-200 rounded-xl p-0.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Alternador de Visão */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {(["month", "week", "day", "list"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`py-1 px-3 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                viewMode === mode
                  ? "bg-white text-indigo-600 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {mode === "month" ? "Mês" : mode === "week" ? "Semana" : mode === "day" ? "Dia" : "Lista"}
            </button>
          ))}
        </div>
      </div>

      {/* Exibição da Agenda */}
      {viewMode === "list" ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Lista de Publicações de @{account.username}
            </h4>
            <span className="text-xs text-slate-400">
              {totalAccountScheduled.length} agendadas • {totalAccountPublished.length} publicadas
            </span>
          </div>

          {totalAccountScheduled.length === 0 && totalAccountPublished.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">
                Nenhuma publicação agendada na lista
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Crie uma fila de Reels ou carrossel para popular este calendário.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {totalAccountScheduled.map((post) => (
                <div
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                      <Image
                        src={post.thumbnailUrl}
                        alt={post.caption}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          post.type === "reel" ? "bg-rose-100 text-rose-700" : "bg-purple-100 text-purple-700"
                        }`}>
                          {post.type === "reel" ? "Reel" : "Carrossel"}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{post.title || post.caption}</span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 max-w-md">
                        {post.caption}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    <StatusBadge status={post.status} />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        {formatTime(post.scheduledAt)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatDate(post.scheduledAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Visualização em Mês / Calendário Padrão */
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-200 rounded-xl overflow-hidden text-center text-xs font-bold text-slate-600">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="py-2.5 bg-slate-50">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => {
              const dayNum = (i % 31) + 1;
              const isToday = dayNum === new Date().getDate();

              // Posts deste dia
              const dayPosts = totalAccountScheduled.filter((p) => {
                const pDate = new Date(p.scheduledAt);
                return pDate.getDate() === dayNum;
              });

              return (
                <div
                  key={i}
                  className={`min-h-[85px] p-2 rounded-xl border text-xs flex flex-col justify-between transition-all ${
                    isToday
                      ? "border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-500/30"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold ${isToday ? "text-indigo-600" : "text-slate-700"}`}>
                      {dayNum}
                    </span>
                    {dayPosts.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                    )}
                  </div>

                  <div className="space-y-1 my-1">
                    {dayPosts.slice(0, 2).map((post) => (
                      <div
                        key={post.id}
                        onClick={() => setSelectedPost(post)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold truncate cursor-pointer ${
                          post.type === "reel" ? "bg-rose-100 text-rose-700" : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {formatTime(post.scheduledAt)} • {post.type === "reel" ? "Reel" : "Carrossel"}
                      </div>
                    ))}
                    {dayPosts.length > 2 && (
                      <span className="text-[9px] text-slate-400 font-bold block">
                        +{dayPosts.length - 2} mais
                      </span>
                    )}
                  </div>

                  <div className="text-[10px] text-slate-400">
                    {dayPosts.length === 0 ? "—" : `${dayPosts.length} post(s)`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de Detalhes da Publicação Agendada */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  selectedPost.type === "reel" ? "bg-rose-100 text-rose-700" : "bg-purple-100 text-purple-700"
                }`}>
                  {selectedPost.type === "reel" ? "Reel" : "Carrossel"}
                </span>
                <span className="text-xs text-slate-500">@{account.username}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPost(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900">
              <Image
                src={selectedPost.thumbnailUrl}
                alt={selectedPost.caption}
                fill
                className="object-cover"
                unoptimized
              />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-800 block">Legenda Programada:</span>
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
                {selectedPost.caption || "Sem legenda"}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
              <span className="text-slate-500">
                Horário: <strong className="text-slate-800">{formatDate(selectedPost.scheduledAt)} às {formatTime(selectedPost.scheduledAt)}</strong>
              </span>
              <StatusBadge status={selectedPost.status} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
