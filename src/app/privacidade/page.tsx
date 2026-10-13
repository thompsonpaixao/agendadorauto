import React from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import {
  Shield,
  Lock,
  Database,
  Trash2,
  Mail,
  FileCheck2,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  Server,
  Layers,
} from "lucide-react";

export const metadata = {
  title: "Política de Privacidade — AgendadorAuto",
  description: "Diretrizes de privacidade, segurança, proteção e retenção de dados do AgendadorAuto em conformidade com a Meta Platform e LGPD.",
};

export default function PrivacidadePage() {
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
        {/* Título e Metadados */}
        <div className="space-y-4 border-b border-slate-100 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
            <Shield className="w-3.5 h-3.5" />
            <span>Conformidade com LGPD & Meta Platform Terms</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Política de Privacidade
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Última atualização: 16 de setembro de 2026 • Versão 2.1
          </p>
        </div>

        {/* 1. VISÃO GERAL */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>1. Visão Geral e Compromisso de Privacidade</span>
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            O <strong>AgendadorAuto</strong> é uma plataforma desenvolvida para gerenciar, agendar e publicar conteúdos (Reels e Carrosséis) em contas comerciais e de criadores de conteúdo do Instagram, utilizando exclusivamente as APIs oficiais da Meta Platform.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            Esta Política de Privacidade estabelece como coletamos, utilizamos, armazenamos, tratamos e protegemos os dados pessoais de nossos usuários, bem como as informações recebidas por meio de integrações de terceiros (Google OAuth e Meta Graph API), em total observância à Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD), ao Regulamento Geral de Proteção de Dados (GDPR) e aos Termos de Plataforma da Meta.
          </p>
        </section>

        {/* 2. DADOS FORNECIDOS PELO USUÁRIO */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">
            2. Dados Coletados no Cadastro e Autenticação
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-bold text-slate-900">Cadastro Direto</h3>
              <p className="text-slate-600 leading-relaxed">
                Coletamos seu endereço de e-mail e senha com hash criptográfico seguro via Supabase Auth para criação e identificação da sua conta de acesso.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-bold text-slate-900">Login Social (Google OAuth)</h3>
              <p className="text-slate-600 leading-relaxed">
                Quando você opta por entrar via Google, recebemos seu nome completo de exibição, endereço de e-mail verificado e URL da foto de perfil pública fornecida pela sua conta Google.
              </p>
            </div>
          </div>
        </section>

        {/* 3. DADOS RECEBIDOS DA META / INSTAGRAM */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">
            3. Dados Recebidos via Meta Platform / Instagram Graph API
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Ao conectar uma conta do Instagram ao AgendadorAuto, solicitamos expressamente a sua autorização através da tela de login oficial da Meta. Solicitamos exclusivamente as permissões oficiais abaixo:
          </p>
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 text-xs space-y-1.5">
              <div className="flex items-center gap-2">
                <code className="font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                  instagram_business_basic
                </code>
                <span className="font-bold text-slate-900">— Identificação do Perfil</span>
              </div>
              <p className="text-slate-600 leading-relaxed pl-1">
                Utilizada para identificar a conta conectada. Coletamos: Instagram User ID (identificador numérico único), nome de usuário (@username), nome da conta, URL da foto de perfil pública e contagem aproximada de seguidores.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 text-xs space-y-1.5">
              <div className="flex items-center gap-2">
                <code className="font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                  instagram_business_content_publish
                </code>
                <span className="font-bold text-slate-900">— Publicação de Conteúdo</span>
              </div>
              <p className="text-slate-600 leading-relaxed pl-1">
                Utilizada exclusivamente para criar recipientes de mídia e disparar a publicação oficial de Reels, vídeos e Carrosséis agendados por você para a sua conta.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <strong>O que NÃO coletamos nem solicitamos:</strong> O AgendadorAuto não solicita nem armazena mensagens privadas (Directs), comentários de terceiros, senhas do Instagram, dados de anúncios ou listas de contatos pessoais.
          </div>
        </section>

        {/* 4. CONTEÚDOS ENVIADOS PELO USUÁRIO */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">
            4. Conteúdos e Arquivos de Mídia Enviados
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Ao utilizar os módulos de Reels e Carrosséis, você realiza o upload de arquivos de vídeo (MP4/MOV), fotos e legendas de texto para a fila do seu perfil. Esses conteúdos são armazenados temporariamente em buckets de nuvem seguros para permitir a montagem das postagens e o envio aos servidores da Meta no momento agendado.
          </p>
        </section>

        {/* 5. FINALIDADE DE TRATAMENTO */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">
            5. Finalidade do Tratamento de Dados
          </h2>
          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Execução do Serviço:</strong> Autenticar seu acesso, manter suas sessões ativas e permitir a gestão das suas filas de publicação.</span>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Integração com a Meta:</strong> Associar publicações aos perfis autorizados e efetuar a chamada oficial de postagem na Meta Graph API.</span>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Segurança e Isolamento:</strong> Assegurar que nenhum dado de perfil, token ou arquivo seja visualizado por outros usuários ou por administradores sem autorização.</span>
            </div>
          </div>
        </section>

        {/* 6. SUBPROCESSADORES E INFRAESTRUTURA */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">
            6. Armazenamento e Prestadores de Infraestrutura
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Para prover o serviço com alta disponibilidade e segurança, compartilhamos dados estritamente operacionais com os seguintes provedores de infraestrutura homologados:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs text-slate-600">
            <li><strong>Supabase Inc.:</strong> Provedor de banco de dados PostgreSQL com criptografia e autenticação de usuários sob Row Level Security (RLS).</li>
            <li><strong>Cloudflare Inc. / Amazon Web Services (AWS):</strong> Armazenamento de arquivos de mídia (vídeos e imagens) em buckets isolados com certificados SSL/TLS.</li>
            <li><strong>Meta Platforms, Inc.:</strong> Recepção das requisições oficiais de publicação e dados do perfil via Meta Graph API.</li>
          </ul>
        </section>

        {/* 7. SEGURANÇA E TOKENS */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">
            7. Segurança e Proteção de Tokens de Acesso
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Os tokens de acesso da Meta são armazenados exclusivamente na camada de banco de dados com criptografia em repouso. O <code>META_APP_SECRET</code> e os tokens nunca são transferidos para o navegador nem expostos em respostas de API ou logs de depuração.
          </p>
        </section>

        {/* 8. RETENÇÃO E EXCLUSÃO DE DADOS */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">
            8. Política de Retenção de Dados
          </h2>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
            <p>Mantemos seus dados pessoais apenas pelo tempo estritamente necessário para cumprir as finalidades contratadas:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Logs de erros técnicos:</strong> mantidos por até 30 dias para suporte técnico e diagnóstico de falhas de envio.</li>
              <li><strong>Notificações do sistema:</strong> mantidas por até 60 dias.</li>
              <li><strong>Histórico de publicações concluídas:</strong> mantido por até 180 dias ou até a exclusão da conta pelo usuário.</li>
              <li><strong>Métricas de desempenho:</strong> retidas por até 90 dias para geração de relatórios de analytics.</li>
              <li><strong>Exclusão de conta:</strong> ao solicitar a exclusão de conta, todos os registros e arquivos são eliminados imediatamente e em definitivo.</li>
            </ul>
          </div>
        </section>

        {/* 9. DIREITOS DO USUÁRIO E EXCLUSÃO */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">
            9. Seus Direitos (LGPD e Meta Platform)
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Você tem total controle sobre seus dados pessoais e pode, a qualquer momento:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
            <li><strong>Desconectar sua conta do Instagram:</strong> diretamente no painel em <em>Perfil Instagram → Configurações → Desconectar conta</em>, ou pelo aplicativo do Instagram em <em>Configurações → Apps e sites</em>.</li>
            <li><strong>Excluir sua conta e dados do AgendadorAuto:</strong> diretamente em <em>Configurações da Conta → Privacidade → Excluir minha conta</em>.</li>
            <li><strong>Solicitar exclusão manual ou esclarecimentos:</strong> consulte as instruções detalhadas na nossa página de <Link href="/exclusao-de-dados" className="text-indigo-600 underline font-semibold">Instruções de Exclusão de Dados</Link>.</li>
          </ul>
        </section>

        {/* 10. CONTATO E ENCARREGADO DE PRIVACIDADE */}
        <section className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-600" />
            <span>Contato do Encarregado de Dados (DPO)</span>
          </h2>
          <p className="text-slate-600 leading-relaxed">
            Para dúvidas, requisições de titulares de dados ou questões relacionadas a esta Política de Privacidade, entre em contato com nosso canal de privacidade:
          </p>
          <div className="space-y-1 text-slate-700 font-mono text-[11px] pt-1">
            <p><strong>Razão Social:</strong> [Razão Social da Empresa Controladora]</p>
            <p><strong>CNPJ:</strong> [00.000.000/0000-00]</p>
            <p><strong>Endereço Comercial:</strong> [Logradouro, Número, Bairro, Cidade - UF, CEP]</p>
            <p><strong>E-mail de Privacidade / DPO:</strong> [dpo@agendadorauto.com.br]</p>
            <p><strong>Encarregado pelo Tratamento de Dados:</strong> [Nome do Encarregado de Dados]</p>
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
            <Link href="/privacidade" className="text-indigo-600 font-semibold">
              Privacidade
            </Link>
            <Link href="/termos" className="hover:text-slate-800 transition-colors">
              Termos de Uso
            </Link>
            <Link href="/exclusao-de-dados" className="hover:text-slate-800 transition-colors">
              Exclusão de Dados
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

