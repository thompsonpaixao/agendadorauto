"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAppState } from "@/context/AppStateContext";
import { useAuth } from "@/context/AuthContext";
import { AccountCard } from "@/components/accounts/AccountCard";
import { AccountTable } from "@/components/accounts/AccountTable";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Code2,
  Lock,
} from "lucide-react";

function ContasContent() {
  const { accounts, setIsConnectModalOpen, refreshAccounts } = useAppState();
  const { isAdmin, isDeveloper } = useAuth();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "alert" | "expired" | "paused"
  >("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [dismissedAlert, setDismissedAlert] = useState(false);

  const connected = searchParams.get("connected");
  const username = searchParams.get("username");
  const mode = searchParams.get("mode");
  const error = searchParams.get("error");
  const details = searchParams.get("details");

  useEffect(() => {
    if (connected === "true") {
      void refreshAccounts();
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/contas");
      }
    } else if (error && typeof window !== "undefined") {
      window.history.replaceState({}, "", "/contas");
    }
  }, [connected, error, refreshAccounts]);

  const alertMessage = useMemo(() => {
    if (dismissedAlert) return null;

    if (connected === "true") {
      const modeText = mode === "development" ? " no Modo Desenvolvimento" : "";
      return {
        type: "success" as const,
        title: "Conta conectada com sucesso!",
        description: username
          ? `@${username} foi vinculada ao seu AgendadorAuto${modeText} via Instagram API oficial.`
          : `Sua conta do Instagram foi vinculada com sucesso${modeText} via Meta OAuth.`,
      };
    }

    if (error) {
      let errorTitle = "Falha ao conectar conta";
      let errorDesc = "Não foi possível concluir a autorização com o Instagram.";

      switch (error) {
        case "cancelled":
          errorTitle = "Conexão cancelada";
          errorDesc = "A autorização foi cancelada no Instagram. Nenhuma conta foi conectada.";
          break;
        case "permission_denied":
          errorTitle = "Permissões insuficientes";
          errorDesc =
            "É necessário autorizar as permissões de leitura e publicação de conteúdo (instagram_business_basic e instagram_business_content_publish).";
          break;
        case "not_professional":
          errorTitle = "Conta pessoal não suportada";
          errorDesc =
            "A Meta exige que a conta seja Profissional (Criador de Conteúdo ou Comercial) para permitir agendamentos e publicação via API.";
          break;
        case "invalid_token":
          errorTitle = "Erro ao validar token";
          errorDesc = details
            ? decodeURIComponent(details)
            : "Não foi possível trocar o código de autorização pelo token da Meta.";
          break;
        case "meta_not_configured":
          errorTitle = "Meta App não configurado";
          errorDesc =
            "As credenciais META_APP_ID e META_APP_SECRET não foram configuradas nas variáveis de ambiente do servidor.";
          break;
        case "invalid_callback":
          errorTitle = "Retorno inválido";
          errorDesc = "Os parâmetros enviados pelo Instagram estavam incompletos ou expiraram.";
          break;
        case "dev_mode_restricted":
          errorTitle = "Acesso Restrito ao Modo Desenvolvedor";
          errorDesc = "O modo de desenvolvimento é restrito a administradores e desenvolvedores cadastrados na Meta.";
          break;
        case "server_configuration":
          errorTitle = "Configuração do servidor";
          errorDesc = "Falha temporária de comunicação segura com o servidor.";
          break;
        case "account_save_failed":
          errorTitle = "Falha ao registrar conta";
          errorDesc = "Não foi possível vincular sua conta autorizada. Tente novamente em instantes.";
          break;
        case "token_save_failed":
          errorTitle = "Falha ao salvar credenciais";
          errorDesc = "Não foi possível armazenar suas credenciais com segurança. Tente novamente em instantes.";
          break;
        case "external_mode_pending_review":
          errorTitle = "Modo Externo Indisponível";
          errorDesc = "A conexão de contas externas estará disponível após a conclusão e aprovação no Meta App Review (Advanced Access).";
          break;
        default:
          if (details) errorDesc = decodeURIComponent(details);
      }

      return {
        type: "error" as const,
        title: errorTitle,
        description: errorDesc,
      };
    }

    return null;
  }, [dismissedAlert, connected, username, error, details]);

  // Filtros aplicados
  const filtered = accounts.filter((acc) => {
    const matchesSearch =
      acc.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.name.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === "active") return acc.status === "connected";
    if (statusFilter === "expired") return acc.status === "expired";
    if (statusFilter === "paused") return acc.status === "paused";
    if (statusFilter === "alert") return acc.status === "error" || acc.errorsCount > 0;

    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Banner de Feedback OAuth (Sucesso ou Erro) */}
      {alertMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 ${
            alertMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-950"
              : "bg-rose-50 border-rose-200 text-rose-950"
          }`}
        >
          <div className="flex items-start gap-3">
            {alertMessage.type === "success" ? (
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-rose-100 text-rose-600 mt-0.5">
                <AlertCircle className="w-5 h-5" />
              </div>
            )}
            <div>
              <h4 className="text-sm font-bold">{alertMessage.title}</h4>
              <p className="text-xs sm:text-sm mt-0.5 opacity-90 leading-relaxed">
                {alertMessage.description}
              </p>
              {alertMessage.type === "error" && (
                <button
                  type="button"
                  onClick={() => {
                    setDismissedAlert(true);
                    setIsConnectModalOpen(true);
                  }}
                  className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tentar novamente</span>
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissedAlert(true)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            title="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Topo da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Contas do Instagram
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200">
              {accounts.length} perfis
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gerencie todas as contas conectadas, credenciais da Meta, horários padrão e limites de postagem.
          </p>
        </div>

        {/* Ações de Conexão de Contas */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Botão: Conectar conta externa (Desabilitado / Em breve) */}
          <button
            type="button"
            disabled
            title="Disponível após aprovação do aplicativo pela Meta (Advanced Access)."
            className="flex items-center gap-2 py-2.5 px-3.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 text-xs sm:text-sm font-semibold cursor-not-allowed"
          >
            <Lock className="w-4 h-4 text-slate-400" />
            <span>Conectar conta externa</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
              Aguardando aprovação Meta
            </span>
          </button>

          {/* Botão: Adicionar conta de desenvolvimento (Exclusivo Admin/Dev - Item 14) */}
          {(isAdmin || isDeveloper) && (
            <button
              type="button"
              onClick={() => setIsConnectModalOpen(true)}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold shadow-sm shadow-indigo-500/20 transition-all cursor-pointer"
            >
              <Code2 className="w-4 h-4" />
              <span>Adicionar conta de desenvolvimento</span>
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros, Busca e Alternador de Visão */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Campo de Busca */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por @username ou nome da conta..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          {/* Filtros de Status */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
            {(
              [
                { id: "all", label: "Todas" },
                { id: "active", label: "Ativas" },
                { id: "alert", label: "Com alerta" },
                { id: "expired", label: "Token expirado" },
                { id: "paused", label: "Pausadas" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  statusFilter === f.id
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-slate-200" />

          {/* Alternador de Visão: Cards vs Tabela */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                viewMode === "cards"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title="Visualização em Cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title="Visualização em Tabela"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Renderização de Conteúdo */}
      {accounts.length === 0 ? (
        <div className="p-16 text-center bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4 text-indigo-600">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            Nenhuma conta conectada
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-2 mb-6">
            Conecte sua primeira conta profissional ou de criador do Instagram para começar a gerenciar filas, programar publicações e acompanhar métricas.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {(isAdmin || isDeveloper) ? (
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(true)}
                className="inline-flex items-center gap-2 py-3 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-sm font-semibold shadow-sm shadow-indigo-500/20 transition-all cursor-pointer"
              >
                <Code2 className="w-4 h-4" />
                <span>Adicionar conta de desenvolvimento</span>
              </button>
            ) : null}
            <button
              type="button"
              disabled
              title="Disponível após aprovação do aplicativo pela Meta (Advanced Access)."
              className="inline-flex items-center gap-2 py-3 px-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 text-sm font-semibold cursor-not-allowed"
            >
              <Lock className="w-4 h-4" />
              <span>Conectar conta externa</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                Aguardando aprovação Meta
              </span>
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">
            Nenhuma conta encontrada
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Não encontramos nenhum perfil correspondente aos filtros selecionados.
          </p>
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      ) : (
        <AccountTable accounts={filtered} />
      )}
    </div>
  );
}

export default function ContasPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-400 font-medium animate-pulse">
          Carregando contas...
        </div>
      }
    >
      <ContasContent />
    </Suspense>
  );
}

