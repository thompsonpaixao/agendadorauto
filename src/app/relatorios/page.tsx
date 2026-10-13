"use client";

import React, { useState } from "react";
import { useAppState } from "@/context/AppStateContext";
import { formatNumber, formatPercent } from "@/lib/utils";
import {
  BarChart3,
  Calendar,
  Film,
  TrendingUp,
  Award,
  Send,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Users,
  Eye,
  Heart,
} from "lucide-react";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import Image from "next/image";

export default function RelatoriosPage() {
  const { accounts, publishedPosts, errors } = useAppState();
  const [timeRange, setTimeRange] = useState<"30d" | "7d">("30d");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");

  const filteredAccounts = selectedAccountId === "all"
    ? accounts
    : accounts.filter((a) => a.id === selectedAccountId);

  const filteredPosts = publishedPosts.filter((p) => {
    if (selectedAccountId !== "all" && p.accountId !== selectedAccountId) return false;
    const postDate = new Date(p.publishedAt).getTime();
    const daysAgo = timeRange === "30d" ? 30 : 7;
    return postDate >= Date.now() - daysAgo * 24 * 60 * 60 * 1000;
  });

  const filteredErrors = errors.filter((e) => {
    if (selectedAccountId !== "all" && e.accountId !== selectedAccountId) return false;
    const errDate = new Date(e.timestamp).getTime();
    const daysAgo = timeRange === "30d" ? 30 : 7;
    return errDate >= Date.now() - daysAgo * 24 * 60 * 60 * 1000;
  });

  // Métricas Consolidadas Reais
  const totalPublished = filteredPosts.length;
  const totalFollowersGained = filteredPosts.reduce((acc, p) => acc + p.followersGained, 0);
  const totalReach = filteredPosts.reduce((acc, p) => acc + p.reach, 0);
  const totalViews = filteredPosts.reduce((acc, p) => acc + p.views, 0);

  const unrecoveredErrors = filteredErrors.filter(
    (e) => !filteredPosts.some((p) => (e.mediaId && p.mediaId === e.mediaId) || (e.carouselId && p.carouselId === e.carouselId))
  );
  const totalResolved = totalPublished + unrecoveredErrors.length;
  const successRate = totalResolved > 0
    ? (totalPublished / totalResolved) * 100
    : null;

  // Destaques Reais dos Últimos 30 Dias
  const bestReel = [...filteredPosts]
    .filter((p) => p.type === "reel")
    .sort((a, b) => b.views - a.views)[0];

  const highestReachPost = [...filteredPosts].sort((a, b) => b.reach - a.reach)[0];

  const highestEngagementPost = [...filteredPosts].sort(
    (a, b) =>
      b.likes + b.comments + b.shares + b.saves -
      (a.likes + a.comments + a.shares + a.saves)
  )[0];

  return (
    <div className="space-y-6">
      {/* Topo do Relatório */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Relatório de Desempenho
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Métricas reais consolidadas de alcance, conteúdo e taxa de entrega.
          </p>
        </div>

        {/* Filtros de Conta e Período */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
            <InstagramIcon className="w-3.5 h-3.5 text-pink-600" />
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="text-xs font-semibold bg-transparent text-slate-700 focus:outline-hidden"
            >
              <option value="all">Todas as Contas ({accounts.length})</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  @{acc.username}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setTimeRange("30d")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                timeRange === "30d"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Últimos 30 dias (Padrão)
            </button>
            <button
              type="button"
              onClick={() => setTimeRange("7d")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                timeRange === "7d"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Últimos 7 dias
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Métricas Principais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-indigo-600" />
            Publicações no Período
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">{totalPublished} posts</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Entregues com sucesso</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            Novos Seguidores
          </div>
          <div className="text-xl font-bold text-emerald-600 mt-1">+{totalFollowersGained}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Crescimento gerado</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Taxa de Sucesso
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {successRate != null ? `${successRate.toFixed(1).replace(".", ",")}%` : "—"}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Disparos sem erro</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            Erros Registrados
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">{filteredErrors.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Falhas no período</div>
        </div>
      </div>

      {/* Destaques de Conteúdo (Top Performers dos Últimos 30 Dias) */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-500" />
          Destaques de Conteúdo ({timeRange === "30d" ? "Últimos 30 Dias" : "Últimos 7 Dias"})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card: Melhor Reel */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                  Melhor Reel
                </span>
                <Film className="w-4 h-4 text-rose-500" />
              </div>

              {bestReel ? (
                <div className="space-y-3">
                  <div className="relative aspect-video rounded-xl bg-slate-900 overflow-hidden">
                    <Image
                      src={bestReel.thumbnailUrl}
                      alt={bestReel.caption}
                      width={300}
                      height={170}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-[10px] text-white font-bold flex items-center gap-1">
                      <Eye className="w-3 h-3 text-white" />
                      {formatNumber(bestReel.views)} views
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 font-medium line-clamp-2">
                    {bestReel.caption || "Reel publicado sem legenda textual"}
                  </p>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  Nenhum Reel publicado no período selecionado.
                </div>
              )}
            </div>

            {bestReel && (
              <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">@{bestReel.accountUsername}</span>
                <a
                  href={bestReel.permalink || `https://www.instagram.com/${bestReel.accountUsername}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  Ver publicação <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* Card: Maior Alcance */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  Maior Alcance
                </span>
                <TrendingUp className="w-4 h-4 text-indigo-500" />
              </div>

              {highestReachPost ? (
                <div className="space-y-3">
                  <div className="relative aspect-video rounded-xl bg-slate-900 overflow-hidden">
                    <Image
                      src={highestReachPost.thumbnailUrl}
                      alt={highestReachPost.caption}
                      width={300}
                      height={170}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-[10px] text-white font-bold flex items-center gap-1">
                      <Users className="w-3 h-3 text-white" />
                      {formatNumber(highestReachPost.reach)} contas
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 font-medium line-clamp-2">
                    {highestReachPost.caption || "Publicação sem legenda"}
                  </p>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  Nenhuma publicação no período selecionado.
                </div>
              )}
            </div>

            {highestReachPost && (
              <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">@{highestReachPost.accountUsername}</span>
                <a
                  href={highestReachPost.permalink || `https://www.instagram.com/${highestReachPost.accountUsername}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  Ver publicação <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* Card: Mais Interações */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
                  Mais Engajamento
                </span>
                <Heart className="w-4 h-4 text-purple-500" />
              </div>

              {highestEngagementPost ? (
                <div className="space-y-3">
                  <div className="relative aspect-video rounded-xl bg-slate-900 overflow-hidden">
                    <Image
                      src={highestEngagementPost.thumbnailUrl}
                      alt={highestEngagementPost.caption}
                      width={300}
                      height={170}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-[10px] text-white font-bold flex items-center gap-1">
                      <Heart className="w-3 h-3 text-pink-400" />
                      {highestEngagementPost.likes + highestEngagementPost.comments + highestEngagementPost.saves} interações
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 font-medium line-clamp-2">
                    {highestEngagementPost.caption || "Publicação sem legenda"}
                  </p>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  Nenhuma publicação no período selecionado.
                </div>
              )}
            </div>

            {highestEngagementPost && (
              <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">@{highestEngagementPost.accountUsername}</span>
                <a
                  href={highestEngagementPost.permalink || `https://www.instagram.com/${highestEngagementPost.accountUsername}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  Ver publicação <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
