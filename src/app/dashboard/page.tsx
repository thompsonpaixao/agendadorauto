"use client";

import React, { useState } from "react";
import { useAppState } from "@/context/AppStateContext";
import { MetricCard } from "@/components/ui/MetricCard";
import { SimpleLineChart } from "@/components/charts/SimpleLineChart";
import { SimpleBarChart } from "@/components/charts/SimpleBarChart";
import {
  Users,
  Send,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Film,
  Layers,
  Clock,
  Plus,
  Inbox,
  Check,
  HardDrive,
  Image as ImageIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatNumber, formatBytes, getSaoPauloDateString, isDateInSaoPauloInterval } from "@/lib/utils";

export default function DashboardPage() {
  const {
    accounts,
    selectedAccountId,
    selectedAccount,
    errors,
    scheduledPosts,
    publishedPosts,
    reelQueues,
    carouselQueues,
    storageUsage,
    setIsConnectModalOpen,
  } = useAppState();

  const [timeFilter, setTimeFilter] = useState<"today" | "7d" | "30d" | "custom">("today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const todaySP = getSaoPauloDateString();

  // Determina intervalo em America/Sao_Paulo
  let startDateStr = todaySP;
  let endDateStr = todaySP;

  if (timeFilter === "7d") {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    startDateStr = getSaoPauloDateString(d);
    endDateStr = todaySP;
  } else if (timeFilter === "30d") {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    startDateStr = getSaoPauloDateString(d);
    endDateStr = todaySP;
  } else if (timeFilter === "custom") {
    startDateStr = customStartDate || todaySP;
    endDateStr = customEndDate || todaySP;
  }

  // Filtragem com base na conta selecionada
  const filteredAccounts = selectedAccountId === "all"
    ? accounts
    : accounts.filter((a) => a.id === selectedAccountId);

  const filteredScheduled = selectedAccountId === "all"
    ? scheduledPosts
    : scheduledPosts.filter((p) => p.accountId === selectedAccountId);

  const filteredPublished = selectedAccountId === "all"
    ? publishedPosts
    : publishedPosts.filter((p) => p.accountId === selectedAccountId);

  // Total de seguidores: soma da audiência atual de cada conta conectada
  const totalFollowers = filteredAccounts.reduce((acc, a) => acc + (a.followers || 0), 0);

  // 1. Posts Publicados no Período Selecionado
  const publishedInPeriod = filteredPublished.filter((p) =>
    isDateInSaoPauloInterval(p.publishedAt, startDateStr, endDateStr)
  );
  const postsPublishedCount = publishedInPeriod.length;

  // 2. Posts Publicados Hoje
  const publishedTodayList = filteredPublished.filter((p) =>
    isDateInSaoPauloInterval(p.publishedAt, todaySP, todaySP)
  );
  const postsToday = publishedTodayList.length;

  // 3. Posts Agendados no Período Selecionado
  const scheduledInPeriod = filteredScheduled.filter((p) =>
    isDateInSaoPauloInterval(p.scheduledAt, startDateStr, endDateStr) &&
    (p.status === "scheduled" || p.status === "processing")
  );
  const postsScheduledCount = scheduledInPeriod.length;

  // 4. Posts Agendados Futuros
  const futureScheduledCount = filteredScheduled.filter(
    (p) => p.status === "scheduled" && new Date(p.scheduledAt).getTime() > Date.now()
  ).length;

  // 5. Falhas Finais no Período Selecionado (posts com erro que NÃO foram publicados)
  const finalFailedInPeriod = filteredScheduled.filter((p) => {
    if ((p.status as string) !== "failed" && p.status !== "error") return false;
    if (!isDateInSaoPauloInterval(p.scheduledAt, startDateStr, endDateStr)) return false;
    const wasPublished = filteredPublished.some((pub) =>
      pub.scheduledPostId === p.id ||
      (p.mediaId && pub.mediaId === p.mediaId) ||
      (p.carouselId && pub.carouselId === p.carouselId)
    );
    return !wasPublished;
  });
  const finalFailedCount = finalFailedInPeriod.length;

  // 6. Taxa de Sucesso Real no Período Selecionado: published / (published + failed definitivo)
  const totalOutcomes = postsPublishedCount + finalFailedCount;
  const successRateText =
    totalOutcomes > 0
      ? `${((postsPublishedCount / totalOutcomes) * 100).toFixed(1).replace(".", ",")}%`
      : "—";

  // 7. Publicações do Dia (Progresso Real para Hoje)
  const scheduledForToday = filteredScheduled.filter((p) =>
    isDateInSaoPauloInterval(p.scheduledAt, todaySP, todaySP)
  );
  const todayPublished = publishedTodayList.length;
  const todayWaiting = scheduledForToday.filter(
    (p) => p.status === "scheduled" && new Date(p.scheduledAt).getTime() > Date.now()
  ).length;
  const todayDelayed = scheduledForToday.filter(
    (p) => p.status === "scheduled" && new Date(p.scheduledAt).getTime() <= Date.now()
  ).length;
  const todayProcessing = scheduledForToday.filter((p) => p.status === "processing").length;
  const todayFailed = scheduledForToday.filter(
    (p) => (p.status as string) === "failed" || p.status === "error"
  ).length;
  const denominatorToday = Math.max(scheduledForToday.length, todayPublished);
  const progressTodayPercent =
    denominatorToday > 0 ? Math.min(Math.round((todayPublished / denominatorToday) * 100), 100) : 0;

  const reelsInQueue = selectedAccount
    ? reelQueues.filter((q) => q.accountId === selectedAccount.id).reduce((acc, q) => acc + q.remainingCount, 0)
    : reelQueues.reduce((acc, q) => acc + q.remainingCount, 0);

  const carouselsInQueue = selectedAccount
    ? carouselQueues.filter((q) => q.accountId === selectedAccount.id).reduce((acc, q) => acc + q.remainingCount, 0)
    : carouselQueues.reduce((acc, q) => acc + q.remainingCount, 0);

  // 8. Gráficos com Dados Reais
  const numDaysChart = timeFilter === "30d" ? 14 : 7;
  const chartDays: Array<{ label: string; value: number }> = [];
  const successVsErrorData: Array<{ label: string; value1: number; value2: number }> = [];

  for (let i = numDaysChart - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayDateStr = getSaoPauloDateString(d);
    const dayLabel = d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "America/Sao_Paulo",
    });

    const dayPubCount = filteredPublished.filter((p) =>
      isDateInSaoPauloInterval(p.publishedAt, dayDateStr, dayDateStr)
    ).length;

    const dayFailCount = filteredScheduled.filter((p) => {
      if ((p.status as string) !== "failed" && p.status !== "error") return false;
      if (!isDateInSaoPauloInterval(p.scheduledAt, dayDateStr, dayDateStr)) return false;
      return !filteredPublished.some(
        (pub) => pub.scheduledPostId === p.id || (p.mediaId && pub.mediaId === p.mediaId)
      );
    }).length;

    chartDays.push({
      label: i === 0 ? "Hoje" : dayLabel,
      value: dayPubCount,
    });

    successVsErrorData.push({
      label: i === 0 ? "Hoje" : dayLabel,
      value1: dayPubCount,
      value2: dayFailCount,
    });
  }

  // Títulos e subtítulos dinâmicos dos cards
  const card2Title =
    timeFilter === "today"
      ? "Posts Publicados Hoje"
      : timeFilter === "7d"
      ? "Posts Publicados (7 dias)"
      : timeFilter === "30d"
      ? "Posts Publicados (30 dias)"
      : "Posts Publicados (Período)";

  const card2Subtitle =
    timeFilter === "today"
      ? `${postsToday} de ${denominatorToday} planejados hoje`
      : `${(postsPublishedCount / Math.max(1, chartDays.length)).toFixed(1).replace(".", ",")} média/dia`;

  const card3Title =
    timeFilter === "today"
      ? "Posts Agendados para Hoje"
      : "Posts Agendados no Período";

  const card3Subtitle = `${futureScheduledCount} agendamentos futuros no total`;

  const card4Subtitle =
    finalFailedCount > 0
      ? "Falhas não resolvidas no período"
      : "Nenhum erro pendente";

  // Perfis com problema
  const accountsWithIssues = accounts.filter(
    (a) => a.status === "expired" || a.status === "error" || a.status === "paused"
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Aviso Profissional de Nenhuma Conta Conectada */}
      {accounts.length === 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-indigo-950">
                Nenhuma conta conectada
              </h4>
              <p className="text-xs text-indigo-700 mt-0.5">
                Conecte sua primeira conta do Instagram para iniciar agendamentos e visualizar métricas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsConnectModalOpen(true)}
            className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all self-start sm:self-auto shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Conectar conta</span>
          </button>
        </div>
      )}

      {/* Topo: Título e Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Dashboard
            </h1>
            {selectedAccount && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                @{selectedAccount.username}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {selectedAccount
              ? `Métricas operacionais e fila de publicação para ${selectedAccount.name}.`
              : "Visão consolidada de todas as contas conectadas, filas e taxa de entrega."}
          </p>
        </div>

        {/* Filtros Temporais */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-white border border-slate-200 rounded-xl p-1 flex items-center shadow-2xs">
            {(
              [
                { id: "today", label: "Hoje" },
                { id: "7d", label: "7 dias" },
                { id: "30d", label: "30 dias" },
                { id: "custom", label: "Personalizado" },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setTimeFilter(filter.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  timeFilter === filter.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {timeFilter === "custom" && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-xs px-2 py-1 rounded-lg border-0 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-400">até</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-xs px-2 py-1 rounded-lg border-0 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Grade de Cards Principais com Estado Real */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Contas Conectadas"
          value={accounts.length}
          subtitle={accounts.length === 0 ? "Nenhuma conta ativa" : `${formatNumber(totalFollowers)} seguidores totais`}
          icon={<Users className="w-4 h-4 text-indigo-600" />}
        />

        <MetricCard
          title={card2Title}
          value={postsPublishedCount}
          subtitle={card2Subtitle}
          icon={<Send className="w-4 h-4 text-emerald-600" />}
        />

        <MetricCard
          title={card3Title}
          value={postsScheduledCount}
          subtitle={card3Subtitle}
          icon={<Calendar className="w-4 h-4 text-indigo-600" />}
        />

        <MetricCard
          title="Posts com Erro"
          value={finalFailedCount}
          subtitle={card4Subtitle}
          icon={<AlertTriangle className="w-4 h-4 text-rose-600" />}
          variant={finalFailedCount > 0 ? "error" : "default"}
        />
      </div>

      {/* Linha 2 de Cards Secundários */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Taxa de Sucesso"
          value={successRateText}
          subtitle={totalOutcomes > 0 ? `${postsPublishedCount} de ${totalOutcomes} envios concluídos` : "Sem publicações no período"}
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
        />

        <MetricCard
          title="Reels na Fila"
          value={reelsInQueue}
          subtitle={reelsInQueue > 0 ? "Vídeos prontos para envio" : "Nenhuma fila criada"}
          icon={<Film className="w-4 h-4 text-rose-600" />}
        />

        <MetricCard
          title="Carrosséis na Fila"
          value={carouselsInQueue}
          subtitle={carouselsInQueue > 0 ? "Postagens multi-slides" : "Nenhuma fila criada"}
          icon={<Layers className="w-4 h-4 text-purple-600" />}
        />
      </div>

      {/* Seção: Publicações de Hoje (Barra de Progresso com Breakdown) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Publicações de hoje
            </h3>
            <p className="text-xs text-slate-500">
              Ritmo de publicação automático das filas programadas
            </p>
          </div>
          <span className="text-sm font-bold text-indigo-600">
            {todayPublished} de {denominatorToday} publicações concluídas ({progressTodayPercent}%)
          </span>
        </div>

        {/* Barra de Progresso Segmentada */}
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
          {denominatorToday > 0 ? (
            <>
              {todayPublished > 0 && (
                <div
                  title={`Publicadas: ${todayPublished}`}
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${(todayPublished / denominatorToday) * 100}%` }}
                />
              )}
              {todayProcessing > 0 && (
                <div
                  title={`Processando: ${todayProcessing}`}
                  className="bg-blue-500 h-full transition-all duration-500"
                  style={{ width: `${(todayProcessing / denominatorToday) * 100}%` }}
                />
              )}
              {todayDelayed > 0 && (
                <div
                  title={`Atrasadas: ${todayDelayed}`}
                  className="bg-amber-500 h-full transition-all duration-500"
                  style={{ width: `${(todayDelayed / denominatorToday) * 100}%` }}
                />
              )}
              {todayFailed > 0 && (
                <div
                  title={`Falhas: ${todayFailed}`}
                  className="bg-rose-500 h-full transition-all duration-500"
                  style={{ width: `${(todayFailed / denominatorToday) * 100}%` }}
                />
              )}
              {todayWaiting > 0 && (
                <div
                  title={`Aguardando horário: ${todayWaiting}`}
                  className="bg-indigo-300 h-full transition-all duration-500"
                  style={{ width: `${(todayWaiting / denominatorToday) * 100}%` }}
                />
              )}
            </>
          ) : (
            <div className="w-full bg-slate-200 h-full" />
          )}
        </div>

        {/* Legenda de Status de Hoje */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span>Publicadas: <strong className="text-slate-900">{todayPublished}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-300 shrink-0" />
            <span>Aguardando: <strong className="text-slate-900">{todayWaiting}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <span>Atrasadas: <strong className="text-slate-900">{todayDelayed}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
            <span>Processando: <strong className="text-slate-900">{todayProcessing}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <span>Falhas: <strong className="text-slate-900">{todayFailed}</strong></span>
          </div>
        </div>
      </div>

      {/* Seção: Armazenamento e Uso por Perfil */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Uso de Armazenamento Real
              </h3>
              <p className="text-xs text-slate-500">
                Volume ocupado pelas mídias e divisão por perfil conectado
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
              {storageUsage?.userUsage ? `${formatBytes(storageUsage.userUsage.totalBytes)} utilizados • Limite não definido` : "Limite não definido"}
            </span>
            <Link
              href="/uploads"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Gerenciar mídias →
            </Link>
          </div>
        </div>

        {/* Breakdown por Perfil */}
        {storageUsage?.userUsage?.byAccount && storageUsage.userUsage.byAccount.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {storageUsage.userUsage.byAccount.map((acc) => (
              <div
                key={acc.accountId}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 truncate">
                    @{acc.username}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-indigo-600">
                    {formatBytes(acc.totalBytes)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Film className="w-3 h-3 text-rose-500" /> {formatBytes(acc.videoBytes)}
                  </span>
                  <span className="flex items-center gap-1">
                    <ImageIcon className="w-3 h-3 text-purple-500" /> {formatBytes(acc.imageBytes)}
                  </span>
                  <span>{acc.count} arquivos</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-500 italic">
            Nenhuma mídia enviada ainda.
          </div>
        )}
      </div>

      {/* Gráficos: Publicações por dia & Sucesso x Erros */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Publicações por dia
              </h3>
              <p className="text-xs text-slate-500">
                Volume de entregas nos últimos 7 dias
              </p>
            </div>
          </div>
          <SimpleLineChart data={chartDays} height={180} valueSuffix=" posts" />
        </div>

        {/* Gráfico 2 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Sucesso x Erros
              </h3>
              <p className="text-xs text-slate-500">
                Relação diária de posts publicados com sucesso vs falhas
              </p>
            </div>
          </div>
          <SimpleBarChart
            data={successVsErrorData}
            height={180}
            label1="Sucesso"
            label2="Erros"
          />
        </div>
      </div>

      {/* Comparação entre os Próprios Perfis Conectados */}
      {accounts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Comparação entre seus perfis
              </h3>
              <p className="text-xs text-slate-500">
                Desempenho comparativo entre todas as contas Instagram conectadas
              </p>
            </div>
            <Link
              href="/contas"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              Gerenciar contas →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="pb-3 pr-4">Perfil</th>
                  <th className="pb-3 px-4 text-right">Seguidores</th>
                  <th className="pb-3 px-4 text-right">Hoje</th>
                  <th className="pb-3 px-4 text-right">Fila</th>
                  <th className="pb-3 px-4 text-right">Taxa Sucesso</th>
                  <th className="pb-3 px-4 text-center">Conexão</th>
                  <th className="pb-3 pl-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((acc) => {
                  const accPub = publishedPosts.filter((p) => p.accountId === acc.id);
                  const accTodayCount = accPub.filter((p) => {
                    if (!p.publishedAt) return false;
                    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(p.publishedAt)) === todaySP;
                  }).length;
                  const accSched = scheduledPosts.filter((p) => p.accountId === acc.id);
                  const accInQueueCount = accSched.filter((p) => p.status === "scheduled").length;
                  const accUnrecCount = accSched.filter((p) => {
                    if (p.status !== "error" && (p.status as string) !== "failed") return false;
                    return !accPub.some((pub) => (p.mediaId && pub.mediaId === p.mediaId) || (p.carouselId && pub.carouselId === p.carouselId));
                  }).length;
                  const accResolved = accPub.length + accUnrecCount;
                  const dynamicRate = accResolved > 0 ? (accPub.length / accResolved) * 100 : acc.successRate;

                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
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
                            <div className="font-bold text-slate-900">@{acc.username}</div>
                            <div className="text-[11px] text-slate-400">{acc.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-800">
                        {formatNumber(acc.followers)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-800">
                        {accTodayCount}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-indigo-600">
                        {accInQueueCount}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                        {dynamicRate != null ? `${dynamicRate.toFixed(1).replace(".", ",")}%` : "—"}
                      </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          acc.status === "connected"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : acc.status === "paused"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {acc.status === "connected" ? "Ativa" : acc.status === "paused" ? "Pausada" : "Erro"}
                      </span>
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <Link
                        href={`/contas/${acc.id}`}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        Abrir perfil →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Duas Colunas: Próximas Publicações & Perfis com Problema */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna 1: Próximas Publicações (7 colunas) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Próximas publicações
              </h3>
              <p className="text-xs text-slate-500">
                Conteúdos na fila imediata de disparo
              </p>
            </div>
            <Link
              href="/agenda"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              Ver agenda completa →
            </Link>
          </div>

          {filteredScheduled.length === 0 ? (
            <div className="py-10 text-center flex flex-col items-center justify-center">
              <Calendar className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-700">
                Nenhuma publicação agendada
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
                Crie uma fila de Reels ou Carrosséis para programar postagens automáticas.
              </p>
              <Link
                href="/reels/nova-fila"
                className="py-1.5 px-3 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-colors"
              >
                + Agendar Reels
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredScheduled.slice(0, 5).map((post) => (
                <div
                  key={post.id}
                  className="py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 shrink-0 relative">
                      <Image
                        src={post.thumbnailUrl}
                        alt={post.title}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {new Date(post.scheduledAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="text-xs text-slate-500">•</span>
                        <span className="text-xs font-medium text-indigo-600 truncate">
                          @{post.accountUsername}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {post.type === "reel" ? "Reel" : "Carrossel"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 truncate max-w-sm mt-0.5">
                        {post.title}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coluna 2: Perfis com Problema (5 colunas) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Perfis com problema
                </h3>
                <p className="text-xs text-slate-500">
                  Monitoramento de integridade e credenciais
                </p>
              </div>
            </div>

            {accountsWithIssues.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                  <Check className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700">
                  Nenhum erro encontrado
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Todas as conexões e filas estão operando normalmente.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {accountsWithIssues.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
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
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          @{acc.username}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {acc.statusMessage || "Verificar status"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
            <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              O monitoramento automático verifica tokens e status da Meta Graph API em tempo real.
            </span>
          </div>
        </div>
      </div>

      {/* Seção: Top Conteúdos */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Top conteúdos recentes
            </h3>
            <p className="text-xs text-slate-500">
              Mídias com maior volume de visualizações e alcance
            </p>
          </div>
        </div>

        {filteredPublished.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center">
            <Inbox className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-slate-700">
              Nenhum conteúdo publicado ainda
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Seus posts de maior engajamento aparecerão aqui assim que forem enviados para o Instagram.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {filteredPublished.slice(0, 5).map((post) => (
              <div
                key={post.id}
                className="group rounded-xl border border-slate-200 overflow-hidden bg-white hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="relative aspect-[9/12] w-full overflow-hidden bg-slate-100">
                  <Image
                    src={post.thumbnailUrl}
                    alt={post.caption}
                    width={300}
                    height={400}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
