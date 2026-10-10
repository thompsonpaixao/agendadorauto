"use client";

import React, { useState, useEffect, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppState } from "@/context/AppStateContext";
import { Tabs, TabItem } from "@/components/ui/Tabs";
import {
  Calendar,
  Film,
  Layers,
  BarChart3,
  Settings,
  AlertTriangle,
  CheckCircle,
  LayoutDashboard,
  UploadCloud,
} from "lucide-react";

import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileOverviewTab } from "@/components/profile/ProfileOverviewTab";
import { ProfileUploadsTab } from "@/components/profile/ProfileUploadsTab";
import { ProfileReelsTab } from "@/components/profile/ProfileReelsTab";
import { ProfileCarouselsTab } from "@/components/profile/ProfileCarouselsTab";
import { ProfileScheduleTab } from "@/components/profile/ProfileScheduleTab";
import { ProfilePublishedTab } from "@/components/profile/ProfilePublishedTab";
import { ProfileAnalyticsTab } from "@/components/profile/ProfileAnalyticsTab";
import { ProfileErrorsTab } from "@/components/profile/ProfileErrorsTab";
import { ProfileSettingsTab } from "@/components/profile/ProfileSettingsTab";

interface PageProps {
  params: Promise<{ id: string }>;
}

function AccountDetailContent({ params }: PageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id: accountId } = use(params);

  const {
    accounts,
    profileMedia,
    profileCarousels,
    reelQueues,
    carouselQueues,
    scheduledPosts,
    publishedPosts,
    errors,
  } = useAppState();

  const account = accounts.find((a) => a.id === accountId);

  const tabParam = searchParams.get("tab");
  const [localTab, setLocalTab] = useState("visao-geral");
  const activeTab = tabParam || localTab;

  const handleTabChange = (tabId: string) => {
    setLocalTab(tabId);
    router.push(`/contas/${accountId}?tab=${tabId}`, { scroll: false });
  };

  if (!account) {
    return (
      <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl max-w-lg mx-auto mt-8 shadow-2xs">
        <h3 className="text-base font-bold text-slate-800">Perfil não encontrado</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          A conta solicitada não existe ou foi desconectada.
        </p>
        <button
          type="button"
          onClick={() => router.push("/contas")}
          className="py-2 px-4 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
        >
          Voltar para Lista de Contas
        </button>
      </div>
    );
  }

  // Filtragem estrita por conta
  const accountVideos = profileMedia.filter((m) => m.accountId === account.id && m.type === "video");
  const accountCarouselsList = profileCarousels.filter((c) => c.accountId === account.id);
  const accountReelQueues = reelQueues.filter((q) => q.accountId === account.id);
  const accountCarouselQueues = carouselQueues.filter((q) => q.accountId === account.id);
  const accountScheduled = scheduledPosts.filter((p) => p.accountId === account.id);
  const accountPublished = publishedPosts.filter((p) => p.accountId === account.id);
  const accountErrors = errors.filter((e) => e.accountId === account.id);
  const pendingErrorsCount = accountErrors.filter((e) => e.status === "pending").length;

  const tabs: TabItem[] = [
    { id: "visao-geral", label: "Visão Geral", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "uploads", label: "Uploads", icon: <UploadCloud className="w-4 h-4" /> },
    { id: "reels", label: "Reels", icon: <Film className="w-4 h-4" /> },
    { id: "carrosseis", label: "Carrosséis", icon: <Layers className="w-4 h-4" /> },
    { id: "agenda", label: "Agenda", icon: <Calendar className="w-4 h-4" /> },
    { id: "publicados", label: "Publicados", icon: <CheckCircle className="w-4 h-4" /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 className="w-4 h-4" /> },
    {
      id: "erros",
      label: pendingErrorsCount > 0 ? `Erros (${pendingErrorsCount})` : "Erros",
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    { id: "configuracoes", label: "Configurações", icon: <Settings className="w-4 h-4" /> },
  ];

  const currentTabTitle = tabs.find((t) => t.id === activeTab)?.label || "Ambiente do Perfil";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Cabeçalho do Perfil & Ações Globais da Conta */}
      <ProfileHeader account={account} activeTabTitle={currentTabTitle} />

      {/* Navegação de Abas do Perfil */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />

      {/* 1. VISÃO GERAL */}
      {activeTab === "visao-geral" && (
        <ProfileOverviewTab
          account={account}
          accountVideosCount={accountVideos.length}
          accountCarouselsCount={accountCarouselsList.length}
          scheduledPosts={accountScheduled}
          errorsCount={pendingErrorsCount}
          onNavigateTab={handleTabChange}
        />
      )}

      {/* UPLOADS & REPOSITÓRIO DA CONTA */}
      {activeTab === "uploads" && (
        <ProfileUploadsTab
          account={account}
          accountMedia={profileMedia.filter((m) => m.accountId === account.id)}
        />
      )}

      {/* 2. REELS POR PERFIL */}
      {activeTab === "reels" && (
        <ProfileReelsTab
          account={account}
          accountMedia={profileMedia.filter((m) => m.accountId === account.id)}
          accountQueues={accountReelQueues}
        />
      )}

      {/* 3. CARROSSÉIS POR PERFIL */}
      {activeTab === "carrosseis" && (
        <ProfileCarouselsTab
          account={account}
          accountCarousels={accountCarouselsList}
          accountQueues={accountCarouselQueues}
        />
      )}

      {/* 4. AGENDA DO PERFIL */}
      {activeTab === "agenda" && (
        <ProfileScheduleTab
          account={account}
          scheduledPosts={accountScheduled}
          publishedPosts={accountPublished}
          errors={accountErrors}
        />
      )}

      {/* 5. PUBLICADOS POR PERFIL */}
      {activeTab === "publicados" && (
        <ProfilePublishedTab
          account={account}
          publishedPosts={accountPublished}
        />
      )}

      {/* 6. ANALYTICS POR PERFIL */}
      {activeTab === "analytics" && (
        <ProfileAnalyticsTab
          account={account}
          publishedPosts={accountPublished}
        />
      )}

      {/* 7. ERROS POR PERFIL */}
      {activeTab === "erros" && (
        <ProfileErrorsTab
          account={account}
          errors={accountErrors}
        />
      )}

      {/* 8. CONFIGURAÇÕES POR PERFIL */}
      {activeTab === "configuracoes" && (
        <ProfileSettingsTab
          account={account}
        />
      )}
    </div>
  );
}

export default function AccountDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-slate-400">Carregando ambiente do perfil...</div>}>
      <AccountDetailContent params={params} />
    </Suspense>
  );
}
