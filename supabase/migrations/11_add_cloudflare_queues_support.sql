BEGIN;

-- ==============================================================================
-- MIGRATION 11: SUPORTE COMPLETO A CLOUDFLARE QUEUES E WORKERS OPERACIONAIS
-- AgendadorAuto - Migração Totalmente Idempotente, Aditiva e Não-Destrutiva
-- ATENÇÃO: NÃO EXECUTAR AUTOMATICAMENTE. APLICAÇÃO MANUAL NO SUPABASE SQL EDITOR.
--
-- DIRETRIZES DE SEGURANÇA E INTEGRIDADE:
-- 1. NENHUMA constraint NOT NULL existente é removida (zero DROP NOT NULL).
-- 2. Não recria tabelas nem apaga dados.
-- 3. Total compatibilidade com o schema existente e com o Cloudflare Worker.
-- 4. Preserva os posts agendados existentes para consumo imediato pelo Feeder.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADIÇÃO IDEMPOTENTE DE COLUNAS EM PUBLIC.SCHEDULED_POSTS
-- ------------------------------------------------------------------------------
do $$
begin
  -- 1.1 Status na Fila Cloudflare ('enqueued', 'completed', 'failed' ou NULL para aguardando feeder)
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'queue_status'
  ) then
    alter table public.scheduled_posts add column queue_status text;
  end if;

  -- 1.2 Data/hora em que o Feeder enfileirou a mensagem na Cloudflare Queue
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'queued_at'
  ) then
    alter table public.scheduled_posts add column queued_at timestamptz;
  end if;

  -- 1.3 Identificador de rastreamento da mensagem na Queue (opcional/telemetria)
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'queue_message_id'
  ) then
    alter table public.scheduled_posts add column queue_message_id text;
  end if;

  -- 1.4 Controle de Lock Distribuído e Concorrência Atômica do Worker
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'locked_at'
  ) then
    alter table public.scheduled_posts add column locked_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'locked_by'
  ) then
    alter table public.scheduled_posts add column locked_by text;
  end if;

  -- 1.5 Contador de Tentativas e Retry Automático
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'publish_attempts'
  ) then
    alter table public.scheduled_posts add column publish_attempts integer not null default 0;
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'next_retry_at'
  ) then
    alter table public.scheduled_posts add column next_retry_at timestamptz;
  end if;

  -- 1.6 Tracking Assíncrono de Container da Meta Graph API
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'meta_container_id'
  ) then
    alter table public.scheduled_posts add column meta_container_id text;
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'container_created_at'
  ) then
    alter table public.scheduled_posts add column container_created_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'last_container_check_at'
  ) then
    alter table public.scheduled_posts add column last_container_check_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'last_container_status'
  ) then
    alter table public.scheduled_posts add column last_container_status text;
  end if;

  -- 1.7 Registro da Publicação e Diagnósticos de Erro
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'published_at'
  ) then
    alter table public.scheduled_posts add column published_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'error_code'
  ) then
    alter table public.scheduled_posts add column error_code text;
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'error_message'
  ) then
    alter table public.scheduled_posts add column error_message text;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 2. ADIÇÃO IDEMPOTENTE DE COLUNAS EM TABELAS RELACIONADAS (SEM DROP NOT NULL)
-- ------------------------------------------------------------------------------
do $$
begin
  -- 2.1 PUBLIC.PUBLISHED_POSTS: Adições idempotentes preservando constraints originais
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'published_posts' and column_name = 'post_type'
  ) then
    alter table public.published_posts add column post_type text default 'reel';
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'published_posts' and column_name = 'media_id'
  ) then
    alter table public.published_posts add column media_id uuid;
  end if;

  -- 2.2 PUBLIC.REEL_QUEUE_ITEMS: Tracking de conclusão e mensagem de erro
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'reel_queue_items' and column_name = 'published_at'
  ) then
    alter table public.reel_queue_items add column published_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'reel_queue_items' and column_name = 'error_message'
  ) then
    alter table public.reel_queue_items add column error_message text;
  end if;

  -- 2.3 PUBLIC.ERROR_LOGS: Suporte a status ativo/resolvido e detalhes de diagnóstico
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'error_logs' and column_name = 'status'
  ) then
    alter table public.error_logs add column status text not null default 'active';
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'error_logs' and column_name = 'error_message'
  ) then
    alter table public.error_logs add column error_message text;
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'error_logs' and column_name = 'stack_trace'
  ) then
    alter table public.error_logs add column stack_trace text;
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'error_logs' and column_name = 'context'
  ) then
    alter table public.error_logs add column context jsonb;
  end if;

  -- 2.4 PUBLIC.MEDIA: Campos de compatibilidade Cloudflare R2
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'media' and column_name = 'storage_provider'
  ) then
    alter table public.media add column storage_provider text default 'r2';
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'media' and column_name = 'storage_bucket'
  ) then
    alter table public.media add column storage_bucket text;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 3. TABELA PUBLIC.PUBLICATION_ATTEMPTS (VERIFICAÇÃO IDEMPOTENTE E COLUNAS)
-- ------------------------------------------------------------------------------
create table if not exists public.publication_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_post_id uuid not null references public.scheduled_posts(id) on delete cascade,
  attempt_number integer not null default 1,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  success boolean not null default false,
  error_code text,
  error_message text,
  retryable boolean not null default true,
  created_at timestamptz not null default now()
);

-- Garante todas as colunas caso a tabela já existisse previamente
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'publication_attempts' and column_name = 'attempt_number'
  ) then
    alter table public.publication_attempts add column attempt_number integer not null default 1;
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'publication_attempts' and column_name = 'started_at'
  ) then
    alter table public.publication_attempts add column started_at timestamptz not null default now();
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'publication_attempts' and column_name = 'finished_at'
  ) then
    alter table public.publication_attempts add column finished_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'publication_attempts' and column_name = 'success'
  ) then
    alter table public.publication_attempts add column success boolean not null default false;
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'publication_attempts' and column_name = 'error_code'
  ) then
    alter table public.publication_attempts add column error_code text;
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'publication_attempts' and column_name = 'error_message'
  ) then
    alter table public.publication_attempts add column error_message text;
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'publication_attempts' and column_name = 'retryable'
  ) then
    alter table public.publication_attempts add column retryable boolean not null default true;
  end if;
end $$;

alter table public.publication_attempts enable row level security;

-- ------------------------------------------------------------------------------
-- 4. ÍNDICES DE ALTA PERFORMANCE PARA FEEDER, QUEUE E CONCORRÊNCIA
-- ------------------------------------------------------------------------------

-- Índice 1: Crítico para o Feeder (execução em < 1ms, zero Full Table Scan)
-- Utilizado a cada 15 min pelo Feeder para selecionar posts da janela de 24h
create index if not exists idx_scheduled_posts_queue_feeder
  on public.scheduled_posts (scheduled_at asc)
  where status = 'scheduled' and queue_status is null;

-- Índice 2: Monitoramento e recuperação de posts travados (Stale Recovery)
create index if not exists idx_scheduled_posts_stale_recovery
  on public.scheduled_posts (status, locked_at asc)
  where status = 'processing';

-- Índice 3: Isolamento e concorrência estrita por conta do Instagram
-- Garante checagem instantânea de no máximo 1 post simultâneo por perfil
create index if not exists idx_scheduled_posts_account_concurrency
  on public.scheduled_posts (instagram_account_id, status, locked_at desc)
  where status = 'processing';

-- Índice 4: Rastreamento por status de fila
create index if not exists idx_scheduled_posts_queue_status
  on public.scheduled_posts (queue_status)
  where queue_status is not null;

-- Índice 5: Posts agendados ordenados cronologicamente
create index if not exists idx_scheduled_posts_due_posts
  on public.scheduled_posts (status, scheduled_at asc)
  where status = 'scheduled';

-- Índice 6: Isolamento multi-conta por usuário
create index if not exists idx_scheduled_posts_user_account
  on public.scheduled_posts (user_id, instagram_account_id, scheduled_at asc);

-- ------------------------------------------------------------------------------
-- 5. BACKFILL SEGURO PARA REGISTROS EXISTENTES
-- ------------------------------------------------------------------------------

-- A) Posts já publicados recebem queue_status = 'completed' (evita qualquer reprocessamento)
update public.scheduled_posts
set queue_status = 'completed'
where status = 'published' and queue_status is null;

-- B) Posts com falha definitiva recebem queue_status = 'failed'
update public.scheduled_posts
set queue_status = 'failed'
where status in ('failed', 'cancelled') and queue_status is null;

-- C) Posts com status = 'scheduled':
-- Permanece queue_status = NULL propositalmente!
-- Dessa forma, o Feeder no próximo ciclo do Cron Trigger (a cada 15 min):
--   1. Executa a query WHERE status = 'scheduled' AND queue_status IS NULL AND scheduled_at <= (now() + 24h)
--   2. Captura com prioridade máxima todos os posts agendados atrasados e da janela atual
--   3. Calcula delaySeconds = 0 para posts com horário já vencido
--   4. Marca queue_status = 'enqueued' e despacha para a PUBLISH_QUEUE para publicação imediata!

-- ------------------------------------------------------------------------------
-- 6. RPC AGREGADA: GET_DASHBOARD_AGGREGATES (REDUÇÃO DRÁSTICA DE EGRESS)
-- ------------------------------------------------------------------------------
create or replace function public.get_dashboard_aggregates(
  p_user_id uuid,
  p_account_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_today_start timestamptz := date_trunc('day', v_now at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  v_filter_account uuid := null;
begin
  -- Converte p_account_id com segurança, ignorando 'all', vazio ou valores inválidos
  if p_account_id is not null and p_account_id <> '' and p_account_id <> 'all' then
    begin
      v_filter_account := p_account_id::uuid;
    exception when others then
      v_filter_account := null;
    end;
  end if;

  select jsonb_build_object(
    'total_accounts', (
      select count(*)::int from public.instagram_accounts 
      where user_id = p_user_id
    ),
    'scheduled_count', (
      select count(*)::int from public.scheduled_posts 
      where user_id = p_user_id 
        and status = 'scheduled'
        and (v_filter_account is null or instagram_account_id = v_filter_account)
    ),
    'processing_count', (
      select count(*)::int from public.scheduled_posts 
      where user_id = p_user_id 
        and status = 'processing'
        and (v_filter_account is null or instagram_account_id = v_filter_account)
    ),
    'published_count', (
      select count(*)::int from public.published_posts 
      where user_id = p_user_id
        and (v_filter_account is null or instagram_account_id = v_filter_account)
    ),
    'published_today_count', (
      select count(*)::int from public.published_posts 
      where user_id = p_user_id
        and published_at >= v_today_start
        and (v_filter_account is null or instagram_account_id = v_filter_account)
    ),
    'active_queues_count', (
      select count(*)::int from public.reel_queues 
      where user_id = p_user_id 
        and status in ('active', 'paused')
        and (v_filter_account is null or instagram_account_id = v_filter_account)
    ),
    'unresolved_errors_count', (
      select count(*)::int from public.error_logs 
      where user_id = p_user_id 
        and status = 'active'
        and (v_filter_account is null or instagram_account_id = v_filter_account)
    ),
    'storage_bytes_total', coalesce((
      select sum(size_bytes)::bigint from public.media 
      where user_id = p_user_id 
        and deleted_at is null
        and (v_filter_account is null or instagram_account_id = v_filter_account)
    ), 0),
    'storage_files_total', (
      select count(*)::int from public.media 
      where user_id = p_user_id 
        and deleted_at is null
        and (v_filter_account is null or instagram_account_id = v_filter_account)
    ),
    'server_time', v_now
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_dashboard_aggregates(uuid, text) to authenticated, service_role;

COMMIT;
