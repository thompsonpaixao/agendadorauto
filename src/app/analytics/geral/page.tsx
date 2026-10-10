"use client";

import React, { useState } from "react";
import { useAppState } from "@/context/AppStateContext";
import { MetricCard } from "@/components/ui/MetricCard";
import { SimpleLineChart } from "@/components/charts/SimpleLineChart";
import { SimpleBarChart } from "@/components/charts/SimpleBarChart";
import {
  Eye,
  TrendingUp,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  UserPlus,
  Send,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatNumber, formatPercent } from "@/lib/utils";

export default function AnalyticsGeralPage() {
  const { accounts, publishedPosts, selectedAccountId } = useAppState();

  const [period, setPeriod] = useState<"today" | "7d" | "30d" | "90d">("30d");

  // Métricas Consolidadas Reais
  const totalViews = publishedPosts.reduce((acc, p) => acc + p.views, 0);
  const totalReach = publishedPosts.reduce((acc, p) => acc + p.reach, 0);
  const totalLikes = publishedPosts.reduce((acc, p) => acc + p.likes, 0);
  const totalComments = publishedPosts.reduce((acc, p) => acc + p.comments, 0);
  const totalShares = publishedPosts.reduce((acc, p) => acc + p.shares, 0);
  const totalSaves = publishedPosts.reduce((acc, p) => acc + p.saves, 0);
  const totalNewFollowers = publishedPosts.reduce((acc, p) => acc + p.followersGained, 0);
  const totalPostsCount = publishedPosts.length;

  const viewsData = publishedPosts.length > 0
    ? [
        { label: "01/09", value: 45000 },
        { label: "05/09", value: 68000 },
        { label: "10/09", value: 89000 },
        { label: "15/09", value: 112000 },
        { label: "20/09", value: 95000 },
        { label: "25/09", value: 140000 },
        { label: "Hoje", value: totalViews },
      ]
    : [
        { label: "D-6", value: 0 },
        { label: "D-5", value: 0 },
        { label: "D-4", value: 0 },
        { label: "D-3", value: 0 },
        { label: "D-2", value: 0 },
        { label: "Ontem", value: 0 },
        { label: "Hoje", value: 0 },
      ];

  const followersData = publishedPosts.length > 0
    ? [
        { label: "01/09", value: 140 },
        { label: "05/09", value: 210 },
        { label: "10/09", value: 380 },
        { label: "15/09", value: 490 },
        { label: "20/09", value: 420 },
        { label: "25/09", value: 680 },
        { label: "Hoje", value: 820 },
      ]
    : [
        { label: "D-6", value: 0 },
        { label: "D-5", value: 0 },
        { label: "D-4", value: 0 },
        { label: "D-3", value: 0 },
        { label: "D-2", value: 0 },
        { label: "Ontem", value: 0 },
        { label: "Hoje", value: 0 },
      ];

  const engagementBarData = publishedPosts.length > 0
    ? [
        { label: "Seg", value1: 18400, value2: 2400 },
        { label: "Ter", value1: 22000, value2: 3100 },
        { label: "Qua", value1: 19500, value2: 2800 },
        { label: "Qui", value1: 26000, value2: 3900 },
        { label: "Sex", value1: 31000, value2: 4500 },
        { label: "Sáb", value1: 24000, value2: 3200 },
        { label: "Hoje", value1: 28500, value2: 4100 },
      ]
    : [
        { label: "Seg", value1: 0, value2: 0 },
        { label: "Ter", value1: 0, value2: 0 },
        { label: "Qua", value1: 0, value2: 0 },
        { label: "Qui", value1: 0, value2: 0 },
        { label: "Sex", value1: 0, value2: 0 },
        { label: "Sáb", value1: 0, value2: 0 },
        { label: "Hoje", value1: 0, value2: 0 },
      ];

  // Ranking de Perfis
  const sortedAccounts = [...accounts].sort((a, b) => b.followers - a.followers);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Analytics Geral
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Visão unificada de engajamento, alcance e conversão de seguidores entre todas as contas.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-2xs">
          {(
            [
              { id: "today", label: "Hoje" },
              { id: "7d", label: "7 dias" },
              { id: "30d", label: "30 dias" },
              { id: "90d", label: "90 dias" },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                period === p.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grade de 8 Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          title="Visualizações (Views)"
          value={formatNumber(totalViews)}
          icon={<Eye className="w-4 h-4 text-indigo-600" />}
          trend={publishedPosts.length > 0 ? { value: "+24.5%", isPositive: true } : undefined}
        />
        <MetricCard
          title="Alcance Único"
          value={formatNumber(totalReach)}
          icon={<TrendingUp className="w-4 h-4 text-purple-600" />}
          trend={publishedPosts.length > 0 ? { value: "+18.2%", isPositive: true } : undefined}
        />
        <MetricCard
          title="Curtidas (Likes)"
          value={formatNumber(totalLikes)}
          icon={<Heart className="w-4 h-4 text-rose-600" />}
        />
        <MetricCard
          title="Comentários"
          value={formatNumber(totalComments)}
          icon={<MessageCircle className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          title="Compartilhamentos"
          value={formatNumber(totalShares)}
          icon={<Share2 className="w-4 h-4 text-amber-600" />}
        />
        <MetricCard
          title="Salvamentos"
          value={formatNumber(totalSaves)}
          icon={<Bookmark className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          title="Novos Seguidores"
          value={totalNewFollowers > 0 ? `+${formatNumber(totalNewFollowers)}` : "0"}
          icon={<UserPlus className="w-4 h-4 text-emerald-600" />}
          variant="success"
          trend={publishedPosts.length > 0 ? { value: "+380 hoje", isPositive: true } : undefined}
        />
        <MetricCard
          title="Posts Publicados"
          value={formatNumber(totalPostsCount)}
          icon={<Send className="w-4 h-4 text-slate-700" />}
        />
      </div>

      {/* Gráficos de Desempenho */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Views por dia</h3>
            {publishedPosts.length > 0 && (
              <span className="text-xs text-indigo-600 font-semibold">+184k hoje</span>
            )}
          </div>
          <SimpleLineChart data={viewsData} height={190} color="#4f46e5" />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Novos Seguidores por dia</h3>
            {publishedPosts.length > 0 && (
              <span className="text-xs text-emerald-600 font-semibold">+820 hoje</span>
            )}
          </div>
          <SimpleLineChart data={followersData} height={190} color="#10b981" />
        </div>
      </div>

      {/* Gráfico de Engajamento */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
        <h3 className="text-base font-bold text-slate-900">
          Engajamento Diário (Curtidas x Compartilhamentos)
        </h3>
        <SimpleBarChart
          data={engagementBarData}
          height={200}
          label1="Curtidas"
          label2="Shares"
          color1="#4f46e5"
          color2="#f59e0b"
        />
      </div>

      {/* Tabela: Ranking de Perfis */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Ranking de Perfis</h3>
          <span className="text-xs text-slate-500">Ordenado por volume de audiência</span>
        </div>

        {sortedAccounts.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">Nenhuma conta conectada</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Conecte perfis do Instagram para visualizar o ranking de desempenho.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sortedAccounts.map((acc, index) => (
              <div
                key={acc.id}
                className="py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-400 w-5">#{index + 1}</span>
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                    <Image
                      src={acc.profilePicture}
                      alt={acc.username}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                  <div>
                    <Link
                      href={`/contas/${acc.id}`}
                      className="font-bold text-slate-900 hover:text-indigo-600 transition-colors"
                    >
                      @{acc.username}
                    </Link>
                    <span className="text-slate-400 block text-[11px]">{acc.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Seguidores</span>
                    <span className="font-bold text-slate-900">{formatNumber(acc.followers)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Novos Hoje</span>
                    <span className="font-bold text-emerald-600">+{acc.newFollowersToday}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Taxa</span>
                    <span className="font-bold text-indigo-600">{formatPercent(acc.successRate)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
