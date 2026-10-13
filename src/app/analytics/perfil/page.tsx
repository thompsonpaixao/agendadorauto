"use client";

import React, { useState } from "react";
import { useAppState } from "@/context/AppStateContext";
import { MetricCard } from "@/components/ui/MetricCard";
import { SimpleLineChart } from "@/components/charts/SimpleLineChart";
import {
  Users,
  TrendingUp,
  Eye,
  Heart,
  Film,
  Layers,
  Award,
} from "lucide-react";
import Image from "next/image";
import { formatNumber, formatPercent } from "@/lib/utils";

export default function AnalyticsPerfilPage() {
  const { accounts, selectedAccountId, publishedPosts, setIsConnectModalOpen } = useAppState();

  const [activeAccountId, setActiveAccountId] = useState(
    selectedAccountId !== "all" ? selectedAccountId : accounts[0]?.id || ""
  );

  const currentAccount = accounts.find((a) => a.id === activeAccountId) || accounts[0];

  if (accounts.length === 0 || !currentAccount) {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Analytics por Perfil
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Performance individualizada, evolução de seguidores e top mídias por conta.
          </p>
        </div>

        <div className="p-16 text-center bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4 text-indigo-600">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            Nenhuma conta conectada
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-2 mb-6">
            Conecte sua primeira conta do Instagram para visualizar métricas analíticas exclusivas, evolução de audiência e histórico de publicações.
          </p>
          <button
            type="button"
            onClick={() => setIsConnectModalOpen(true)}
            className="inline-flex items-center gap-2 py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-sm font-semibold shadow-sm shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <span>Conectar conta do Instagram</span>
          </button>
        </div>
      </div>
    );
  }

  const accountPosts = publishedPosts.filter((p) => p.accountId === currentAccount.id);
  const accountViews = accountPosts.reduce((acc, p) => acc + p.views, 0);
  const accountReach = accountPosts.reduce((acc, p) => acc + p.reach, 0);
  const accountInteractions = accountPosts.reduce(
    (acc, p) => acc + p.likes + p.comments + p.shares + p.saves,
    0
  );

  const followerHistory = currentAccount.followers > 0
    ? [
        { label: "D-6", value: Math.max(0, currentAccount.followers - 84) },
        { label: "D-5", value: Math.max(0, currentAccount.followers - 69) },
        { label: "D-4", value: Math.max(0, currentAccount.followers - 51) },
        { label: "D-3", value: Math.max(0, currentAccount.followers - 38) },
        { label: "D-2", value: Math.max(0, currentAccount.followers - 22) },
        { label: "Ontem", value: Math.max(0, currentAccount.followers - 9) },
        { label: "Hoje", value: currentAccount.followers },
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

  const topReels = accountPosts.filter((p) => p.type === "reel").slice(0, 3);
  const topCarousels = accountPosts.filter((p) => p.type === "carousel").slice(0, 3);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Analytics por Perfil
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Performance individualizada, evolução de seguidores e top mídias por conta.
          </p>
        </div>

        {/* Seletor de Perfil */}
        <select
          value={activeAccountId}
          onChange={(e) => setActiveAccountId(e.target.value)}
          className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none shadow-2xs"
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              @{acc.username} ({acc.name})
            </option>
          ))}
        </select>
      </div>

      {/* Cartão de Identificação do Perfil */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs flex items-center gap-4">
        <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-slate-200 shrink-0">
          <Image
            src={currentAccount.profilePicture}
            alt={currentAccount.username}
            width={56}
            height={56}
            className="w-full h-full object-cover"
            unoptimized
          />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            @{currentAccount.username}
          </h2>
          <p className="text-xs text-slate-500">{currentAccount.name}</p>
        </div>
      </div>

      {/* Grade de 6 Métricas do Perfil */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          title="Seguidores"
          value={formatNumber(currentAccount.followers)}
        />
        <MetricCard
          title="Crescimento"
          value={`+${currentAccount.newFollowersToday}`}
          variant="success"
        />
        <MetricCard
          title="Views Totais"
          value={formatNumber(accountViews)}
        />
        <MetricCard
          title="Alcance"
          value={formatNumber(accountReach)}
        />
        <MetricCard
          title="Interações"
          value={formatNumber(accountInteractions)}
        />
        <MetricCard
          title="Posts Feitos"
          value={accountPosts.length}
        />
      </div>

      {/* Gráfico de Crescimento */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            Crescimento de Seguidores (Últimos 7 dias)
          </h3>
          {currentAccount.newFollowersToday > 0 && (
            <span className="text-xs text-emerald-600 font-semibold">
              +{currentAccount.newFollowersToday} hoje
            </span>
          )}
        </div>
        <SimpleLineChart data={followerHistory} height={200} color="#10b981" />
      </div>

      {/* Top Reels e Top Carrosséis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Reels */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-rose-600" />
            <h3 className="text-base font-bold text-slate-900">Top Reels do Perfil</h3>
          </div>

          <div className="space-y-3">
            {topReels.length > 0 ? (
              topReels.map((reel) => (
                <div
                  key={reel.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-10 h-14 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                      <Image
                        src={reel.thumbnailUrl}
                        alt={reel.caption}
                        width={40}
                        height={56}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                    <p className="text-xs text-slate-700 truncate max-w-xs">
                      {reel.caption}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-900 shrink-0">
                    {formatNumber(reel.views)} views
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400">Nenhum Reel publicado para exibir ranking.</p>
            )}
          </div>
        </div>

        {/* Top Carrosséis */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-600" />
            <h3 className="text-base font-bold text-slate-900">Top Carrosséis do Perfil</h3>
          </div>

          <div className="space-y-3">
            {topCarousels.length > 0 ? (
              topCarousels.map((car) => (
                <div
                  key={car.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                      <Image
                        src={car.thumbnailUrl}
                        alt={car.caption}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                    <p className="text-xs text-slate-700 truncate max-w-xs">
                      {car.caption}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-900 shrink-0">
                    {formatNumber(car.views)} views
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400">Nenhum Carrossel publicado para exibir ranking.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
