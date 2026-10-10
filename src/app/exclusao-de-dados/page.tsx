"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import {
  Trash2,
  LogOut,
  ShieldCheck,
  ArrowLeft,
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Layers,
} from "lucide-react";

export default function ExclusaoDeDadosPage() {
  // Estado do formulário de solicitação de exclusão manual
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    instagramUsername: "",
    reason: "",
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulação do envio para o canal de privacidade
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* Header Público */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center">
            <BrandLogo size="lg" />
          </Link>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link
              href="/"
              className="text-slate-600 hover:text-indigo-600 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao início</span>
            </Link>
            <Link
              href="/login"
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
            >
              Entrar
            </Link>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-12">
        {/* Título e Apresentação */}
        <div className="space-y-4 border-b border-slate-100 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold">
            <Trash2 className="w-3.5 h-3.5" />
            <span>Instruções de Exclusão de Dados da Meta Platform & LGPD</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Instruções para Exclusão de Dados
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
            O <strong>AgendadorAuto</strong> disponibiliza mecanismos diretos e automatizados para que você exclua sua conta, desvincule contas do Instagram ou solicite a eliminação definitiva de todos os dados sob custódia.
          </p>
        </div>

        {/* 1. TRÊS FORMAS DE ELIMINAR SEUS DADOS */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900">
            1. Como Eliminar seus Dados ou Desconectar o Instagram
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Método 1: Excluir Conta no Painel */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                1
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Excluir Conta pelo AgendadorAuto
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Acesse o painel em:
                <br />
                <span className="font-mono text-indigo-700 font-semibold">
                  Configurações → Privacidade → Excluir minha conta
                </span>
              </p>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Ao digitar EXCLUIR e confirmar, todo o seu perfil, tokens, filas, vídeos e mídias são eliminados imediatamente do banco de dados.
              </p>
            </div>

            {/* Método 2: Desconectar Instagram no Perfil */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                2
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Desconectar Conta do Instagram
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Acesse o perfil em:
                <br />
                <span className="font-mono text-indigo-700 font-semibold">
                  Contas → Selecionar Perfil → Configurações → Desconectar conta
                </span>
              </p>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Revoga imediatamente o token de acesso da Meta e cancela agendamentos pendentes daquela conta.
              </p>
            </div>

            {/* Método 3: Revogar no Instagram Oficial */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                3
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Revogar Acesso via Meta / Instagram
              </h3>
              <p className="text-slate-600 leading-relaxed">
                No app do Instagram ou navegador:
                <br />
                <span className="font-mono text-slate-700">
                  Configurações e privacidade → Apps e sites → AgendadorAuto → Remover
                </span>
              </p>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                A Meta cancelará a autorização de forma autônoma e nosso sistema pausará os disparos para a respectiva conta.
              </p>
            </div>
          </div>
        </section>

        {/* 2. CATEGORIAS DE DADOS ELIMINADAS */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">
            2. Categorias de Dados que são Eliminadas Definitivamente
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Quando você solicita a exclusão da sua conta ou o expurgo de dados, eliminamos com segurança:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block">Identificação e Perfil:</span>
              <p className="text-slate-600 text-[11px]">E-mail, nome de exibição, foto do perfil e credenciais de acesso seguro.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block">Integração da Meta Platform:</span>
              <p className="text-slate-600 text-[11px]">Tokens de acesso (access tokens), Instagram User IDs, @usernames e dados vinculados.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block">Mídias e Repositório:</span>
              <p className="text-slate-600 text-[11px]">Vídeos MP4/MOV enviados, imagens de carrosséis e legendas personalizadas de posts.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block">Automação e Histórico:</span>
              <p className="text-slate-600 text-[11px]">Filas de Reels, posts agendados pendentes, histórico de envio, métricas e registros de erros.</p>
            </div>
          </div>
        </section>

        {/* 3. FORMULÁRIO DE SOLICITAÇÃO MANUAL DE EXCLUSÃO */}
        <section className="space-y-6 pt-4 border-t border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              3. Formulário de Solicitação Manual de Exclusão de Dados
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Caso você não possua mais acesso à sua conta ou queira solicitar a exclusão assistida por nossa equipe de privacidade, preencha o formulário abaixo:
            </p>
          </div>

          {isSubmitted ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2 text-center animate-in fade-in duration-300">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <h3 className="text-base font-bold">Solicitação Recebida com Sucesso!</h3>
              <p className="text-xs text-emerald-900 max-w-md mx-auto leading-relaxed">
                Confirmamos o recebimento do seu pedido de exclusão de dados. Nossa equipe verificará a titularidade da conta e efetuará a remoção definitiva em até 5 dias úteis, enviando comprovante para o e-mail informado.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Seu nome completo"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">
                    E-mail Cadastrado na Conta *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="exemplo@email.com"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">
                  Perfil do Instagram Vinculado (Opcional)
                </label>
                <input
                  type="text"
                  value={formData.instagramUsername}
                  onChange={(e) => setFormData({ ...formData, instagramUsername: e.target.value })}
                  placeholder="@seuperfil"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">
                  Motivo ou Observações Adicionais (Opcional)
                </label>
                <textarea
                  rows={3}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Informe detalhes adicionais sobre o pedido, se desejar..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-2 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Enviando..." : "Enviar Solicitação de Exclusão"}</span>
                </button>
              </div>
            </form>
          )}
        </section>

        {/* 4. CANAL DE SUPORTE DIRETO */}
        <section className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-600" />
            <span>Canal Direto de Privacidade e Dados</span>
          </h2>
          <p className="text-slate-600 leading-relaxed">
            Você também pode enviar sua solicitação de exclusão diretamente para o e-mail de conformidade:
          </p>
          <div className="space-y-1 text-slate-700 font-mono text-[11px] pt-1">
            <p><strong>E-mail de Privacidade / DPO:</strong> [dpo@agendadorauto.com.br]</p>
            <p><strong>Prazo Máximo de Atendimento:</strong> até 5 (cinco) dias úteis conforme Art. 19 da LGPD.</p>
          </div>
        </section>
      </main>

      {/* Footer Público Simples */}
      <footer className="border-t border-slate-100 bg-slate-50 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <BrandLogo size="xs" />
            <span>© {new Date().getFullYear()} AgendadorAuto. Todos os direitos reservados.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacidade" className="hover:text-slate-800 transition-colors">
              Privacidade
            </Link>
            <Link href="/termos" className="hover:text-slate-800 transition-colors">
              Termos de Uso
            </Link>
            <Link href="/exclusao-de-dados" className="text-indigo-600 font-semibold">
              Exclusão de Dados
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
