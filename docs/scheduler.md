# Arquitetura do Scheduler e Automação de Tarefas — AgendadorAuto

Este documento descreve o funcionamento do motor de agendamento, publicação atômica, políticas de retenção e endpoints de manutenção periódica do **AgendadorAuto**.

---

## 1. Visão Geral da Arquitetura

O sistema de agendamento e manutenção do AgendadorAuto é composto por rotas protegidas no Next.js (Server-Side) acionadas periodicamente por cron jobs externos (Vercel Cron ou `pg_cron` / `pg_net` do Supabase).

### Princípios Fundamentais:
1. **Atocimidade e Concorrência**: Prevenção de publicações duplicadas via locks transacionais no PostgreSQL (`FOR UPDATE SKIP LOCKED`).
2. **Segurança de Execução**: Funções de lock protegidas com `SECURITY DEFINER`, `search_path = public` explícito, revogadas de clientes (`anon`, `authenticated`) e concedidas exclusivamente ao `service_role`.
3. **Autenticação de Jobs**: Todos os endpoints de scheduler e cleanup exigem validação rigorosa da variável de ambiente `CRON_SECRET`.
4. **Isolamento de Dados**: Respeito estrito ao isolamento multi-tenant (`user_id`).

---

## 2. Função Atômica `claim_scheduled_posts`

Localizada na migração de produção (`supabase/migrations/4_production_schema.sql`), a função RPC bloqueia e reivindica lotes de publicações elegíveis sem risco de condições de corrida (race conditions) quando múltiplos workers estão ativos.

```sql
create or replace function public.claim_scheduled_posts(batch_size integer default 5)
returns setof public.scheduled_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_ids uuid[];
begin
  select array_agg(id) into claimed_ids
  from (
    select id
    from public.scheduled_posts
    where status = 'scheduled'
      and scheduled_at <= now()
    order by scheduled_at asc
    limit batch_size
    for update skip locked
  ) sub;

  if claimed_ids is null or array_length(claimed_ids, 1) = 0 then
    return;
  end if;

  return query
  update public.scheduled_posts
  set
    status = 'processing',
    updated_at = now()
  where id = any(claimed_ids)
  returning *;
end;
$$;
```

### Privilégios de Acesso:
- `REVOKE ALL ON FUNCTION public.claim_scheduled_posts(integer) FROM public, anon, authenticated;`
- `GRANT EXECUTE ON FUNCTION public.claim_scheduled_posts(integer) TO service_role;`

---

## 3. Endpoints Disponíveis

Todos os endpoints operam sob o método **POST** e requerem autenticação por chave secreta.

### 3.1. Publicador Automático: `/api/scheduler/publish`
- **Função**: Reivindica posts agendados via `claim_scheduled_posts`, valida tokens Meta e containers de mídia, faz polling de transcodificação e realiza a publicação oficial via Instagram Graph API.
- **Frequência recomendada**: A cada 1 minuto (`* * * * *`).

### 3.2. Limpeza de Mídias Vencidas: `/api/scheduler/cleanup-media`
- **Função**: Exclui com segurança mídias que ultrapassaram a janela de retenção (`delete_after <= now()`).
- **Garantias de Segurança**:
  - Verifica se a mídia não está agendada para posts futuros (`scheduled_posts`).
  - Verifica se a mídia não pertence a filas ativas (`reel_queue_items`, `carousel_items`).
  - Verifica ausência de erros não resolvidos na conta (`error_logs`).
  - **Exclusão Física Primeiro**: Remove o arquivo físico do Supabase Storage.
  - **Atualização Lógica**: Atualiza `retention_status = 'deleted'` e `deleted_at = now()`. Se o storage falhar, marca como `preserved_due_to_error` e loga na auditoria.
- **Frequência recomendada**: Diariamente ou a cada 6 horas (`0 */6 * * *`).

### 3.3. Retenção de Monitoramento: `/api/scheduler/cleanup-monitoring`
- **Função**: Aplica janela de retenção de 30 dias para os snapshots de monitoramento de perfis externos e suas mídias.
- **Regras**:
  - Remove registros de `monitored_profile_snapshots` onde `snapshot_date < current_date - 30 days`.
  - Remove registros de `monitored_media_snapshots` onde `snapshot_date < current_date - 30 days`.
  - **Preservação**: Perfis (`monitored_profiles`) e pastas (`monitoring_folders`) nunca são excluídos por este job.
- **Frequência recomendada**: Diariamente à meia-noite (`0 0 * * *`).

---

## 4. Autenticação e Configuração de Cron Jobs

### 4.1. Variável de Ambiente Obrigatória
No arquivo `.env.local` e nas configurações da Vercel / Supabase:
```env
CRON_SECRET=seu_token_secreto_super_seguro_aqui
```

### 4.2. Cabeçalhos Aceitos
As requisições devem incluir um dos seguintes cabeçalhos:
- `Authorization: Bearer <CRON_SECRET>`
- `x-cron-secret: <CRON_SECRET>`

### 4.3. Exemplo de Configuração no `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/scheduler/publish",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/scheduler/cleanup-media",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/scheduler/cleanup-monitoring",
      "schedule": "0 0 * * *"
    }
  ]
}
```

### 4.4. Exemplo de Execução via cURL (Teste Manual)
```bash
curl -X POST "https://seu-dominio.vercel.app/api/scheduler/cleanup-monitoring" \
  -H "Authorization: Bearer seu_token_secreto_super_seguro_aqui"
```
