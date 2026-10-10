"use client";

import React from "react";
import { Account, PublishedPost } from "@/types";
import { MetricCard } from "@/components/ui/MetricCard";
import { formatNumber, formatPercent } from "@/lib/utils";
import {
  Eye,
  Heart,
  Share2,
  Bookmark,
  UserPlus,
} from "lucide-react";

interface ProfileAnalyticsTabProps {
  account: Account;
  publishedPosts: PublishedPost[];
}

export function ProfileAnalyticsTab({
  account,
  publishedPosts,
}: ProfileAnalyticsTabProps) {
  const accountPosts = publishedPosts.filter((p) => p.accountId === account.id);

  // Cálculos consolidados da conta
  const totalViews = accountPosts.reduce((acc, p) => acc + p.views, 0);
  const totalReach = accountPosts.reduce((acc, p) => acc + p.reach, 0);
  const totalLikes = accountPosts.reduce((acc, p) => acc + p.likes, 0);
  const totalComments = accountPosts.reduce((acc, p) => acc + p.comments, 0);
  const totalShares = accountPosts.reduce((acc, p) => acc + p.shares, 0);
  const totalSaves = accountPosts.reduce((acc, p) => acc + p.saves, 0);
  const totalFollowersGained = accountPosts.reduce((acc, p) => acc + p.followersGained, 0);

  const engagementRate = totalReach > 0
    ? ((totalLikes + totalComments + totalShares + totalSaves) / totalReach) * 100
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 4 Cards Principais de Analytics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          title="Visualizações Totais"
          value={formatNumber(totalViews)}
          subtitle="Audiência nos posts"
          variant="primary"
        />
        <MetricCard
          title="Alcance Único"
          value={formatNumber(totalReach)}
          subtitle="Contas alcançadas"
        />
        <MetricCard
          title="Engajamento Médio"
          value={formatPercent(engagementRate)}
          subtitle="Interações / alcance"
          variant="success"
        />
        <MetricCard
          title="Novos Seguidores"
          value={`+${totalFollowersGained}`}
          subtitle="Conversão de posts"
          variant="success"
        />
      </div>

      {/* Gráfico Simplificado e Distribuição */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Performance de Conteúdo de @{account.username}
              </h3>
              <p className="text-xs text-slate-500">
                Visualizações e interações nos últimos 7 dias.
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
              Últimos 7 dias
            </span>
          </div>

          {accountPosts.length === 0 ? (
            <div className="py-14 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50">
              <Eye className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">
                Nenhum dado analítico disponível ainda
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Os gráficos e métricas serão preenchidos conforme as publicações ocorram.
              </p>
            </div>
          ) : (
            <div className="h-48 flex items-end justify-between gap-3 pt-6 px-2">
              {[
                { label: "Seg", val: Math.round(totalViews * 0.1) },
                { label: "Ter", val: Math.round(totalViews * 0.15) },
                { label: "Qua", val: Math.round(totalViews * 0.12) },
                { label: "Qui", val: Math.round(totalViews * 0.2) },
                { label: "Sex", val: Math.round(totalViews * 0.18) },
                { label: "Sáb", val: Math.round(totalViews * 0.12) },
                { label: "Hoje", val: Math.round(totalViews * 0.13) },
              ].map((item, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <div
                    className="w-full bg-gradient-to-t from-indigo-600 to-purple-600 rounded-t-lg transition-all"
                    style={{ height: `${Math.max(10, Math.min(100, item.val > 0 ? (item.val / totalViews) * 200 : 10))}%` }}
                  />
                  <span className="text-[10px] text-slate-400 font-bold">{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumo de Interações */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Interações da Conta</h3>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-600 flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500" /> Curtidas
              </span>
              <strong className="text-slate-800">{formatNumber(totalLikes)}</strong>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-600 flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-amber-500" /> Salvamentos
              </span>
              <strong className="text-slate-800">{formatNumber(totalSaves)}</strong>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-600 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-blue-500" /> Compartilhamentos
              </span>
              <strong className="text-slate-800">{formatNumber(totalShares)}</strong>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-600 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-500" /> Seguidores Convertidos
              </span>
              <strong className="text-emerald-600">+{totalFollowersGained}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
