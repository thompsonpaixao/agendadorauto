# Agendador 🚀

Aplicativo web moderno para agendamento e publicação de **Reels** no Instagram, desenvolvido com **Next.js**, **TypeScript** e **Tailwind CSS**.

---

## ✨ Funcionalidades

- **Interface Moderna e Limpa**: Layout moderno e responsivo com inspiração visual nas cores e identidade do Instagram.
- **Campos Principais**:
  - 🔗 **URL do vídeo**: Input para URLs diretas de vídeo (MP4/MOV).
  - 📝 **Legenda**: Área de texto com contador de caracteres (limite do Instagram: 2.200) e atalhos para hashtags populares.
  - 🚀 **Publicar Reel**: Ação de disparo com feedback em tempo real e simulação do Meta Graph API container.
- **Pré-visualização em Tempo Real (Live Reel Preview)**:
  - Mockup dinâmico em formato de smartphone (9:16) que renderiza o vídeo e a legenda conforme você digita.
- **Preparado para Deploy na Vercel**: Estrutura otimizada e testada para compilação sem falhas no ambiente serverless da Vercel.
- **Pronto para Integração Meta Graph API**: Endpoints e tipagens TypeScript já preparados para plugar os tokens da Meta.

---

## 🛠️ Tecnologias Utilizadas

- [Next.js](https://nextjs.org/) (App Router)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Lucide React](https://lucide.dev/) (Ícones)

---

## 💻 Como Rodar Localmente

### 1. Pré-requisitos
- Node.js (v20 ou superior recomendado)
- npm, pnpm ou yarn

### 2. Instalação e Execução
```bash
# Clone ou navegue até a pasta do projeto
cd agendador

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no seu navegador para ver o aplicativo em execução.

---

## 🚀 Como Fazer Deploy na Vercel

O projeto está 100% pronto para deploy na Vercel sem necessidade de configurações adicionais.

### Opção 1: Via GitHub (Recomendado)
1. Suba este projeto para um repositório no seu GitHub.
2. Acesse [vercel.com](https://vercel.com) e faça login.
3. Clique em **"Add New..."** > **"Project"**.
4. Selecione o repositório `agendador` e clique em **Deploy**.

### Opção 2: Via Vercel CLI
```bash
npx vercel
```

---

## 🔮 Próximos Passos: Integração com a Meta Graph API

Quando desejar ativar a publicação direta no Instagram:

1. Acesse o portal [Meta for Developers](https://developers.facebook.com/) e crie um aplicativo do tipo **Empresa (Business)**.
2. Adicione o produto **Instagram Graph API**.
3. Obtenha as credenciais necessárias:
   - `META_APP_ID`
   - `META_APP_SECRET`
   - `INSTAGRAM_ACCOUNT_ID` (sua conta comercial/criador)
   - `META_ACCESS_TOKEN` (com permissões `instagram_basic`, `instagram_content_publish`)
4. Copie o arquivo `.env.example` para `.env.local` e preencha as chaves:
   ```bash
   cp .env.example .env.local
   ```
5. O endpoint já estruturado em `src/app/api/reels/route.ts` contém os comentários explicativos para disparar a chamada oficial de 2 etapas da Meta (Container Upload -> Publish).
