import React from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import {
  FileText,
  Shield,
  ArrowLeft,
  Mail,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

export const metadata = {
  title: "Termos de Serviço — AgendadorAuto",
  description: "Termos e condições de uso da plataforma AgendadorAuto para agendamento e automação de Reels e Carrosséis no Instagram.",
};

export default function TermosPage() {
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
            <FileText className="w-3.5 h-3.5" />
            <span>Condições Gerais de Uso da Plataforma</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Termos de Serviço
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Última atualização: 16 de setembro de 2026 • Versão 2.1
          </p>
        </div>

        {/* 1. DESCRIÇÃO DO SERVIÇO */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900">
            1. Descrição do Serviço
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            O <strong>AgendadorAuto</strong> é uma plataforma projetada para otimizar o fluxo de trabalho de produtores de conteúdo, agências e gestores de redes sociais. A plataforma oferece ferramentas para organização por perfis, fila de Reels, montagem sequencial de Carrosséis, definição de cronogramas de publicação com variação aleatória anti-detecção e acompanhamento de status de postagem.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            Todas as ações de publicação no Instagram são realizadas em estrita conformidade com os protocolos da Meta Platform através da oficial <em>Instagram Content Publishing API</em>.
          </p>
        </section>

        {/* 2. RESPONSABILIDADE DO USUÁRIO PELO CONTEÚDO */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900">
            2. Responsabilidade do Usuário pelo Conteúdo
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            O Usuário é o único e exclusivo responsável por todo e qualquer arquivo de vídeo, imagem, texto de legenda, áudio ou metadado enviado à plataforma e subsequentemente publicado em suas contas do Instagram.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            O Usuário declara e garante que possui todos os direitos autorais, licenças e autorizações de imagem necessárias para a veiculação pública dos materiais submetidos, isentando o AgendadorAuto de qualquer infração de propriedade intelectual de terceiros.
          </p>
        </section>

        {/* 3. USO ACEITÁVEL E PROIBIÇÕES */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900">
            3. Uso Aceitável e Diretrizes de Comunidade
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Ao utilizar o AgendadorAuto, o Usuário compromete-se a:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
            <li>Não praticar spam, publicação em massa não solicitada ou esquemas de engajamento artificial.</li>
            <li>Não publicar conteúdos ilícitos, difamatórios, fraudulentos, que incitem o ódio ou que violem as Diretrizes da Comunidade da Meta.</li>
            <li>Não realizar scraping, engenharia reversa, descompilação ou tentativas de invasão do código-fonte e dos servidores da plataforma.</li>
            <li>Não tentar burlar os limites de requisição da Meta Graph API ou explorar vulnerabilidades técnicas do sistema.</li>
          </ul>
        </section>

        {/* 4. INTEGRAÇÕES EXTERNAS (META / GOOGLE) */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900">
            4. Integrações com Serviços de Terceiros
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            A operação do AgendadorAuto depende da disponibilidade contínua e das políticas de uso de terceiros, notadamente a Meta Platforms, Inc. e a Google LLC.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            O Usuário reconhece que a Meta pode, a seu exclusivo critério, revogar tokens de acesso, impor limites de taxa de publicação (rate limits) ou suspender temporariamente recursos caso detecte violações nos perfis do Instagram conectados.
          </p>
        </section>

        {/* 5. DISPONIBILIDADE E NÍVEL DE SERVIÇO (SLA) */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900">
            5. Disponibilidade do Serviço
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            O serviço é fornecido no estado em que se encontra (&quot;as is&quot;). Embora envidemos esforços comercialmente razoáveis para assegurar alta disponibilidade operacional, não garantimos funcionamento ininterrupto, isento de falhas de rede externa, manutenções programadas de infraestrutura ou instabilidades nos servidores de terceiros.
          </p>
        </section>

        {/* 6. PROPRIEDADE INTELECTUAL */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900">
            6. Propriedade Intelectual
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Todos os direitos sobre a marca AgendadorAuto, logotipos textuais, interface de usuário, códigos-fonte, algoritmos de agendamento e arquitetura do software pertencem exclusivamente aos seus desenvolvedores titulares. O uso da plataforma concede ao Usuário uma licença limitada, não exclusiva e revogável de acesso às ferramentas contratadas.
          </p>
        </section>

        {/* 7. ENCERRAMENTO E RESCISÃO */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900">
            7. Encerramento de Contas
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            O Usuário pode encerrar sua conta a qualquer momento na aba de Privacidade das Configurações ou solicitando exclusão manual conforme as <Link href="/exclusao-de-dados" className="text-indigo-600 underline font-semibold">Instruções de Exclusão de Dados</Link>.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            O AgendadorAuto reserva-se o direito de suspender ou encerrar imediatamente o acesso de contas que violem estes Termos de Serviço ou as políticas oficiais da Meta Platform.
          </p>
        </section>

        {/* 8. PRIVACIDADE E PROTEÇÃO DE DADOS */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900">
            8. Privacidade e Proteção de Dados
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            As disposições relativas à coleta, custódia, tratamento e eliminação de dados pessoais estão disciplinadas de forma vinculante em nossa <Link href="/privacidade" className="text-indigo-600 underline font-semibold">Política de Privacidade</Link>, parte integrante e indissociável destes Termos.
          </p>
        </section>

        {/* 9. MODIFICAÇÕES DOS TERMOS */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900">
            9. Modificações Destes Termos
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Poderemos revisar estes Termos de Serviço periodicamente para refletir alterações legislativas, novidades nas políticas da Meta Platform ou aprimoramentos técnicos do serviço. Alterações substanciais serão comunicadas aos usuários ativos no painel ou por e-mail cadastrado.
          </p>
        </section>

        {/* 10. CANAL DE CONTATO */}
        <section className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-600" />
            <span>Contato e Notificações Legais</span>
          </h2>
          <p className="text-slate-600 leading-relaxed">
            Para notificações formais, dúvidas sobre estes Termos ou questões jurídicas, utilize os canais abaixo:
          </p>
          <div className="space-y-1 text-slate-700 font-mono text-[11px] pt-1">
            <p><strong>Razão Social:</strong> [Razão Social da Empresa Controladora]</p>
            <p><strong>CNPJ:</strong> [00.000.000/0000-00]</p>
            <p><strong>E-mail de Atendimento e Suporte:</strong> [suporte@agendadorauto.com.br]</p>
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
            <Link href="/termos" className="text-indigo-600 font-semibold">
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

