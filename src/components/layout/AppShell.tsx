"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { ConnectAccountModal } from "@/components/accounts/ConnectAccountModal";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Rotas públicas que não devem exibir a Sidebar nem o Header
  const isPublicRoute =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/cadastro" ||
    pathname.startsWith("/auth");

  if (isPublicRoute) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 antialiased flex flex-col">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
      {/* Sidebar Desktop e Mobile */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Conteúdo Principal com compensação da sidebar fixa */}
      <div className="flex-1 flex flex-col lg:pl-64 transition-all duration-300">
        {/* Header fixo */}
        <Header onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)} />

        {/* Área de Visualização da Rota */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Modal Global de Conexão de Contas */}
      <ConnectAccountModal />
    </div>
  );
}

