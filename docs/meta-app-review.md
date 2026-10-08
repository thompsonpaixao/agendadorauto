# Guia de Preparação e Submissão: Meta App Review — AgendadorAuto

Este documento contém o checklist oficial, instruções de submissão e roteiros de gravação de screencasts para a aprovação do **AgendadorAuto** no processo de **Meta App Review** para obtenção de **Advanced Access** nas permissões da Instagram Graph API.

---

## 1. Checklist Geral Pré-Submissão

| Item | Status | Detalhes & Configuração |
| :--- | :---: | :--- |
| **Business Verification** | [ ] | Verificação da empresa concluída no Meta Business Suite (envio de contrato social/cartão CNPJ e comprovante de endereço). |
| **Advanced Access** | [ ] | Solicitação de elevação de Standard Access para Advanced Access nas permissões selecionadas. |
| **instagram_business_basic** | [ ] | Permissão solicitada para ler ID numérico da conta, @username, nome da conta e foto de perfil. |
| **instagram_business_content_publish** | [ ] | Permissão solicitada para criar containers de mídia e publicar Reels e Carrosséis automaticamente. |
| **Privacy Policy URL** | [ ] | `https://[seu-dominio]/privacidade` (página pública sem login exigido). |
| **Data Deletion URL** | [ ] | `https://[seu-dominio]/exclusao-de-dados` (instruções de exclusão e formulário). |
| **Terms of Service URL** | [ ] | `https://[seu-dominio]/termos` (termos de uso públicos). |
| **OAuth Redirect URI** | [ ] | `https://[seu-dominio]/api/instagram/callback` adicionada em *Instagram Basic Display / Login do Instagram*. |
| **Teste de Login** | [ ] | Fluxo de login completo testado com o usuário de teste adicionado como *Instagram Tester*. |
| **Ausência de Mocks** | [ ] | Garantido que o fluxo de autorização, troca de token e publicação utiliza chamadas reais da Meta API. |
| **Conta de Teste Válida** | [ ] | Credenciais e perfil de teste no Instagram preparados para acesso exclusivo pelo revisor. |

---

## 2. Permissões Requisitadas e Justificativas Oficiais

### Permissão 1: `instagram_business_basic`
- **Por que o aplicativo precisa dessa permissão?**
  > "O AgendadorAuto é uma plataforma para produtores de conteúdo e agências. Esta permissão é necessária para identificar a conta do Instagram conectada pelo usuário, exibindo na interface o identificador exclusivo (ID), o nome de usuário (@username), o nome de exibição e a foto de perfil, permitindo que o usuário organize e selecione para qual perfil está criando ou agendando publicações."
- **Recursos utilizados:** `GET /me?fields=id,username,name,account_type,profile_picture_url,followers_count`

### Permissão 2: `instagram_business_content_publish`
- **Por que o aplicativo precisa dessa permissão?**
  > "O objetivo principal do AgendadorAuto é automatizar o agendamento e a publicação de vídeos verticais (Reels) e publicações sequenciais (Carrosséis) diretamente no feed do perfil autorizado. O aplicativo cria o container de mídia através da Graph API, verifica o status de processamento e dispara a publicação oficial no dia e horário previamente configurados pelo usuário na sua fila de agendamento."
- **Recursos utilizados:**
  - `POST /{ig-user-id}/media` (criação do container com `media_type: "REELS"` ou `"CAROUSEL"`)
  - `GET /{container-id}?fields=status_code` (verificação do status de transcodificação)
  - `POST /{ig-user-id}/media_publish` (disparo oficial da publicação)

### Permissão 3: `instagram_business_manage_insights`
- **Por que o aplicativo precisa dessa permissão?**
  > "Permite que os criadores e gestores visualizem métricas analíticas e de desempenho oficiais dos seus posts (alcance, visualizações, engajamento e retenção) no painel de analytics do AgendadorAuto."
- **Recursos utilizados:**
  - `GET /{ig-media-id}/insights?metric=reach,impressions,saved,shares,video_views`
  - `GET /{ig-user-id}/insights?metric=reach,profile_views,follower_count`

---

## 3. Roteiros dos Screencasts Obrigatórios

A Meta exige vídeos gravados em tela cheia demonstrando detalhadamente cada etapa do aplicativo em execução real (sem edições que ocultem a URL do navegador).

### Screencast 1: Fluxo de Login e Autorização do Instagram
1. **Início:** Acesse a tela de login do AgendadorAuto (`/login`) e entre na conta de teste.
2. **Navegação:** Vá até a aba **Contas** (`/contas`).
3. **Modal:** Clique em **"Adicionar conta de desenvolvimento"** (ou no botão de conexão do Instagram).
4. **Redirecionamento:** Mostre claramente o clique no botão e o redirecionamento para o domínio oficial `www.instagram.com/oauth/authorize`.
5. **URL da Meta:** Destaque na barra de endereços do navegador que a URL pertence à Meta com o `client_id` do aplicativo visível.
6. **Autorização:** Aceite a solicitação de permissões e mostre o retorno seguro para `https://[seu-dominio]/api/instagram/callback` e o subsequente redirecionamento para `/contas` com a mensagem de sucesso.

### Screencast 2: Leitura de Perfil (@username, ID e Foto)
1. **Exibição do Card:** Na listagem de contas, mostre que o perfil recém-conectado exibe:
   - A foto real do perfil;
   - O `@username` real importado da Graph API;
   - O status "Conectado".
2. **Ambiente do Perfil:** Clique na conta para acessar `/contas/[id]`.
3. **Cabeçalho:** Mostre o cabeçalho com o nome do perfil, contagem de seguidores e abas ativas do ambiente isolado.

### Screencast 3: Agendamento e Publicação de Conteúdo
1. **Envio de Mídia:** Na aba **Reels** do perfil, faça o upload de um vídeo de teste válido (formato MP4 vertical 9:16).
2. **Configuração da Legenda e Horário:** Preencha uma legenda e defina o horário de disparo (ou selecione a opção de publicar agora / próxima fila).
3. **Disparo da API:** Mostre a fila com o post em processamento.
4. **Verificação no Instagram:** Abra o aplicativo móvel ou a versão web do Instagram (`instagram.com/[username-de-teste]`) e atualize o feed para demonstrar que o Reel foi publicado com sucesso através do AgendadorAuto.

---

## 4. Instruções Detalhadas para o Revisor da Meta (Reviewer Notes)

Copie e adapte o texto abaixo no campo **"Notes for the Reviewer"** do painel do Meta Developers:

```text
Olá, equipe de revisão da Meta Platform!

O AgendadorAuto é uma plataforma web B2B projetada para criadores de conteúdo e empresas gerenciarem o planejamento e a publicação de Reels e Carrosséis em suas contas comerciais do Instagram.

CREDENCIAS DE ACESSO PARA TESTE:
- URL de Acesso: https://[seu-dominio]/login
- E-mail de Teste: reviewer-meta@agendadorauto.com.br
- Senha de Teste: [SenhaForteReviewer123!]

CONTA DO INSTAGRAM DE TESTE CONFIGURADA:
- @username de Teste: @[username_de_teste_vinculado]
- Função: Conta adicionada e aprovada como Instagram Tester no painel deste aplicativo.

PASSO A PASSO PARA REPRODUÇÃO:
1. Faça login na plataforma utilizando o e-mail e senha fornecidos acima.
2. Acesse o menu lateral e clique em "Contas".
3. Clique no botão "Adicionar conta de desenvolvimento" para iniciar o fluxo oficial de autorização OAuth do Instagram.
4. Conceda as permissões de leitura básica (instagram_business_basic) e publicação de conteúdo (instagram_business_content_publish).
5. Após o retorno ao painel, você verá a conta conectada com seu @username e foto de perfil.
6. Clique na conta para acessar o ambiente dedicado, vá até a aba "Reels" e clique em "Enviar Vídeo" ou "Nova Fila".
7. Realize o agendamento de uma publicação de teste para verificar a criação e publicação de container via Meta Graph API.
8. Para testar a revogação de dados, acesse a aba "Configurações" da conta e utilize o botão "Desconectar conta". Para exclusão completa, acesse "Configurações do Sistema" > aba "Privacidade" > "Excluir minha conta".

Todas as chamadas à Graph API são realizadas server-side com tokens seguros e respeitando integralmente as diretrizes da Meta Platform.

Agradecemos pela revisão!
```

---

## 5. Diretrizes Finais de Conformidade

- **Nunca utilize web scraping ou bibliotecas não oficiais:** O AgendadorAuto opera 100% sob a Graph API oficial.
- **Nenhum dado mock no fluxo do revisor:** As rotas `/api/instagram/auth` e `/api/instagram/callback` realizam a comunicação ao vivo com os servidores da Meta.
- **Segurança de credenciais:** O `META_APP_SECRET` permanece exclusivamente em variáveis de ambiente protegidas no servidor.

