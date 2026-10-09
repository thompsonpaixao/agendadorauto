"use client";

import React from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import {
  Users,
  UploadCloud,
  Shuffle,
  Clock,
  Film,
  AlertTriangle,
  BarChart3,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* HEADER PÚBLICO */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Logo da Marca */}
          <Link href="/" className="inline-flex items-center py-1">
            <BrandLogo size="xl" />
          </Link>

          {/* Navegação Central */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a
              href="#recursos"
              className="hover:text-indigo-600 transition-colors"
            >
              Recursos
            </a>
            <a
              href="#arquitetura"
              className="hover:text-indigo-600 transition-colors"
            >
              Arquitetura por Perfil
            </a>
            <a
              href="#seguranca"
              className="hover:text-indigo-600 transition-colors"
            >
              Segurança
            </a>
          </nav>

          {/* Botões de Ação */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-indigo-600 transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs shadow-indigo-600/30 active:scale-[0.98] transition-all"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28 border-b border-slate-100 bg-gradient-to-b from-slate-50/70 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Badge Informativa */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-xs font-semibold mb-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Automação e agendamento de conteúdo para Instagram</span>
          </div>

          {/* Título Principal */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl mx-auto leading-tight sm:leading-tight">
            Automatize suas publicações no{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-600 via-purple-600 to-indigo-600">
              Instagram
            </span>
          </h1>

          {/* Subtítulo */}
          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
            Organize, agende e acompanhe <strong>Reels e Carrosséis</strong> em{" "}
            <strong>múltiplas contas</strong> com ambientes isolados por perfil,
            filas automatizadas e controle absoluto.
          </p>

          {/* CTAs do Hero */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-base font-semibold shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <span>Entrar</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/cadastro"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-base font-semibold shadow-2xs transition-all"
            >
              Criar conta
            </Link>
          </div>

          {/* Visual Showcase da Plataforma */}
          <div className="mt-16 rounded-2xl border border-slate-200/80 bg-white p-2 sm:p-3 shadow-xl max-w-5xl mx-auto">
            <div className="rounded-xl bg-slate-900 text-slate-100 p-6 sm:p-8 text-left border border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-mono text-slate-400 ml-2">
                    painel.agendadorauto.app
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Ambiente Centrado no Perfil Ativo</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/60">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Repositório de Reels
                  </div>
                  <div className="text-sm font-bold text-white">
                    Upload em Lote & Ordenação
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Arraste vídeos MP4/MOV diretamente para o repositório da
                    conta sem risco de cruzar com outros perfis.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/60">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Construtor de Carrosséis
                  </div>
                  <div className="text-sm font-bold text-white">
                    Slides Sequenciais (1, 2, 3...)
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Monte publicações em carrossel com prévia instantânea da
                    legenda padrão do seu perfil.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/60">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Cronograma Anti-Detecção
                  </div>
                  <div className="text-sm font-bold text-white">
                    Horários com Variação
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Variação aleatória em minutos para distribuir postagens de
                    modo natural aos algoritmos da Meta.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO DE RECURSOS (8 RECURSOS ESPECIFICADOS) */}
      <section id="recursos" className="py-20 sm:py-28 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Recursos Essenciais
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2">
              Desenvolvido para máxima produtividade
            </h2>
            <p className="text-base text-slate-600 mt-4">
              Cada funcionalidade foi construída para atender agências, criadores
              e gestores que operam múltiplos perfis sem complicação.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1. Organização por perfil */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md transition-all hover:border-indigo-200">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Organização por perfil
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Ambientes isolados e dedicados. Você entra na conta desejada e
                gerencia todo o conteúdo daquele perfil sem misturar arquivos.
              </p>
            </div>

            {/* 2. Upload em massa */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md transition-all hover:border-indigo-200">
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
                <UploadCloud className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Upload em massa
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Envie dezenas de vídeos ou imagens de uma só vez para o
                repositório da conta com dropzone ágil e intuitiva.
              </p>
            </div>

            {/* 3. Embaralhamento automático */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md transition-all hover:border-indigo-200">
              <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
                <Shuffle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Embaralhamento automático
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Função de shuffle inteligente com um clique para alternar a ordem
                das publicações e opção de restaurar a ordem original.
              </p>
            </div>

            {/* 4. Programação por horários */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md transition-all hover:border-indigo-200">
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Programação por horários
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Configure metas de posts diários e horários padrão do perfil, com
                suporte a variação aleatória de minutos para segurança.
              </p>
            </div>

            {/* 5. Reels e Carrosséis */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md transition-all hover:border-indigo-200">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                <Film className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Reels e Carrosséis
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Suporte de ponta a ponta aos dois formatos de maior entrega no
                Instagram, incluindo construtor de slides sequenciais.
              </p>
            </div>

            {/* 6. Monitoramento de erros */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md transition-all hover:border-indigo-200">
              <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Monitoramento de erros
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Central de diagnósticos técnicos com inspeção de chamadas da API
                da Meta, botão de retentativa e reconexão de tokens.
              </p>
            </div>

            {/* 7. Analytics */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md transition-all hover:border-indigo-200">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Analytics
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Métricas reais de alcance, visualizações, engajamento e
                crescimento de seguidores consolidadas e por conta.
              </p>
            </div>

            {/* 8. Múltiplas contas */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md transition-all hover:border-indigo-200">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Múltiplas contas
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Conecte dezenas de perfis simultaneamente e alterne entre eles
                instantaneamente através do seletor global no cabeçalho.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO DE ARQUITETURA E SEGURANÇA */}
      <section id="seguranca" className="py-20 border-t border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Infraestrutura Moderna
              </span>
              <h2 className="text-3xl font-extrabold text-slate-900 mt-2">
                Segurança com Supabase Auth & Row Level Security
              </h2>
              <p className="text-sm text-slate-600 mt-4 leading-relaxed">
                Seus dados e credenciais são blindados por autenticação com
                sessão segura baseada em cookies SSR. A arquitetura implementa
                isolamento por usuário via <code>user_id</code> no nível de banco
                de dados.
              </p>
              <ul className="mt-6 space-y-3">
                <li className="flex items-center gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Autenticação rápida com Google OAuth e E-mail</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Sessão segura sem tokens expostos em localStorage</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Controle de acesso por Allowlist de e-mails em desenvolvimento</span>
                </li>
              </ul>
            </div>

            <div className="p-8 rounded-2xl bg-gradient-to-tr from-indigo-900 via-slate-900 to-slate-950 text-white shadow-xl">
              <h4 className="text-base font-bold">Comece agora a automatizar</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Acesse o painel e configure suas primeiras filas de Reels e
                Carrosséis em minutos.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/login"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold text-center transition-colors"
                >
                  Entrar no AgendadorAuto
                </Link>
                <Link
                  href="/cadastro"
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold text-center transition-colors"
                >
                  Criar Conta Gratuita
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200/80 bg-slate-50 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <span className="text-xs text-slate-400">
              © {new Date().getFullYear()} — Todos os direitos reservados.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <a href="#recursos" className="hover:text-slate-800 transition-colors">
              Recursos
            </a>
            <Link href="/privacidade" className="hover:text-indigo-600 transition-colors font-medium">
              Privacidade
            </Link>
            <Link href="/termos" className="hover:text-indigo-600 transition-colors font-medium">
              Termos
            </Link>
            <Link href="/exclusao-de-dados" className="hover:text-indigo-600 transition-colors font-medium">
              Exclusão de dados
            </Link>
            <Link href="/login" className="hover:text-slate-800 transition-colors">
              Entrar
            </Link>
            <Link href="/cadastro" className="hover:text-slate-800 transition-colors">
              Criar conta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}


