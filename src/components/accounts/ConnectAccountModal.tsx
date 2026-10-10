"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useAppState } from "@/context/AppStateContext";
import { useAuth } from "@/context/AuthContext";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import {
  Shield,
  Loader2,
  ArrowRight,
  AlertTriangle,
  Code2,
  Lock,
  Info,
} from "lucide-react";

export function ConnectAccountModal() {
  const { isConnectModalOpen, setIsConnectModalOpen } = useAppState();
  const { isAdmin, isDeveloper } = useAuth();

  const isDevOrAdmin = isAdmin || isDeveloper;
  const [activeMode, setActiveMode] = useState<"development" | "external">(
    isDevOrAdmin ? "development" : "external"
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleStartOAuth = (mode: "development" | "external") => {
    if (mode === "external") return;
    if (!isDevOrAdmin) return;
    setIsLoading(true);
    // Redireciona para o endpoint unificado server-side (Desktop e Mobile idênticos)
    window.location.href = `/api/instagram/connect?mode=${mode}`;
  };

  const handleClose = () => {
    setIsLoading(false);
    setIsConnectModalOpen(false);
  };

  return (
    <Modal
      isOpen={isConnectModalOpen}
      onClose={handleClose}
      title="Conectar Conta do Instagram"
      description="Integração oficial via Meta Graph API (Instagram Business & Creator)"
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Seletor de Modo de Conexão */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Opção 1: Modo Desenvolvedor / Admin */}
          <button
            type="button"
            onClick={() => setActiveMode("development")}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              activeMode === "development"
                ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                <Code2 className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                {isAdmin ? "Admin" : isDeveloper ? "Developer" : "Restrito"}
              </span>
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                Conta de Desenvolvimento
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Para contas de teste cadastradas no Meta Developers (Standard Access).
              </p>
            </div>
          </button>

          {/* Opção 2: Conta Externa (Aguardando Aprovação Meta) */}
          <button
            type="button"
            onClick={() => setActiveMode("external")}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              activeMode === "external"
                ? "border-slate-400 bg-slate-50 ring-2 ring-slate-300"
                : "border-slate-200 hover:border-slate-300 bg-slate-50/60"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded-xl bg-slate-200 text-slate-600">
                <Lock className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                Em breve
              </span>
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>Conta Externa</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Para clientes finais e contas públicas sem função no app.
              </p>
            </div>
          </button>
        </div>

        {/* Conteúdo do Modo: Desenvolvimento */}
        {activeMode === "development" && (
          <div className="space-y-4 pt-1 animate-in fade-in duration-150">
            {!isDevOrAdmin ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 space-y-2">
                <div className="flex items-start gap-2.5">
                  <Lock className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-slate-900">
                      Modo Exclusivo para Desenvolvedores
                    </h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Sua conta está configurada como usuário padrão. O modo de desenvolvimento é restrito a administradores e desenvolvedores cadastrados na Meta. Contas externas estarão disponíveis após aprovação no Meta App Review.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Explicação Curta Obrigatória */}
                <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h5 className="text-xs font-bold text-amber-900">
                        Requisito Obrigatório do Meta Developers:
                      </h5>
                      <p className="text-xs text-amber-900 font-medium leading-relaxed">
                        “Esta conta precisa estar adicionada como Instagram Tester/Função do app no Meta Developers e o convite precisa ter sido aceito.”
                      </p>
                    </div>
                  </div>

                  {/* Passos Práticos */}
                  <div className="pt-2 border-t border-amber-200/80 text-[11px] text-amber-800/90 space-y-1 pl-7">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-amber-600" />
                      <span>1. No portal Meta Developers: Adicione seu @username em <strong>Funções &gt; Instagram Testers</strong>.</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-amber-600" />
                      <span>2. No aplicativo Instagram da conta: Vá em <strong>Configurações &gt; Apps e sites &gt; Convites do testador</strong> e clique em <strong>Aceitar</strong>.</span>
                    </div>
                  </div>
                </div>

                {/* Transparência das Permissões Oficiais (Item 1 & Item 10) */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2.5">
                  <div className="flex items-center gap-2 text-slate-900 font-bold">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <span>Permissões Oficiais Solicitadas na Meta:</span>
                  </div>
                  <ul className="space-y-2 text-[11px] pl-2">
                    <li className="flex items-start gap-2">
                      <code className="px-1.5 py-0.5 rounded bg-indigo-100/80 text-indigo-700 font-mono text-[10px] shrink-0 font-bold">
                        instagram_business_basic
                      </code>
                      <span className="text-slate-600">
                        Identificação da conta: ID numérico, @username, nome de exibição e foto do perfil.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <code className="px-1.5 py-0.5 rounded bg-indigo-100/80 text-indigo-700 font-mono text-[10px] shrink-0 font-bold">
                        instagram_business_content_publish
                      </code>
                      <span className="text-slate-600">
                        Publicação e agendamento automático de Reels, Carrosséis e fotos no feed.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <code className="px-1.5 py-0.5 rounded bg-indigo-100/80 text-indigo-700 font-mono text-[10px] shrink-0 font-bold">
                        instagram_business_manage_insights
                      </code>
                      <span className="text-slate-600">
                        Leitura de métricas e alcance oficiais de publicações e perfil.
                      </span>
                    </li>
                  </ul>

                  <div className="pt-2 border-t border-slate-200/80 flex items-start gap-2 text-[11px] text-slate-500">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      Nenhuma permissão para mensagens privadas (Directs), comentários ou anúncios é solicitada. As permissões e o status de conexão somente são concedidos após você autorizar nas telas oficiais da Meta.
                    </span>
                  </div>
                </div>

                {/* Botão de Ação: OAuth Oficial */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleStartOAuth("development")}
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 via-purple-600 to-indigo-600 hover:opacity-95 active:scale-[0.99] text-white font-semibold text-sm shadow-md shadow-purple-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Redirecionando para a Meta...</span>
                      </>
                    ) : (
                      <>
                        <InstagramIcon className="w-4 h-4 fill-white" />
                        <span>Continuar para autorização oficial do Instagram</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Conteúdo do Modo: Conta Externa (Desabilitado) */}
        {activeMode === "external" && (
          <div className="space-y-4 pt-1 animate-in fade-in duration-150">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 space-y-2">
              <div className="flex items-start gap-2.5">
                <Lock className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h5 className="text-xs font-bold text-slate-900">
                      Conexão Externa para Clientes
                    </h5>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      Aguardando aprovação Meta
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Disponível após aprovação do aplicativo pela Meta (Advanced Access).
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Esse fluxo será liberado para clientes finais que não possuem função de desenvolvedor no app, garantindo conexão pública imediata após a conclusão da verificação empresarial e do Meta App Review.
                  </p>
                </div>
              </div>
            </div>

            {/* Botão Desabilitado */}
            <div className="pt-2">
              <button
                type="button"
                disabled
                title="Disponível após aprovação do aplicativo pela Meta."
                className="w-full py-3 px-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 font-semibold text-xs sm:text-sm cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>Conectar conta externa (Indisponível no momento)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
