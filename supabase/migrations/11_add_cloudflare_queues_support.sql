BEGIN;

-- ==============================================================================
-- MIGRATION 11: SUPORTE A CLOUDFLARE QUEUES E OTIMIZAÇÃO DE EGRESS DO SUPABASE
-- AgendadorAuto - Migração Idempotente para Infraestrutura Cloudflare Workers
-- ATENÇÃO: NÃO EXECUTAR AUTOMATICAMENTE. APLICAÇÃO MANUAL NO SUPABASE SQL EDITOR.
-- ==============================================================================

-- 1. ADIÇÃO DE CAMPOS DE FILA ASSÍNCRONA EM PUBLIC.SCHEDULED_POSTS
do $$
begin
  -- Status de enfileiramento na Cloudflare Queue ('enqueued', 'completed', 'failed')
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'queue_status'
  ) then
    alter table public.scheduled_posts 
      add column queue_status text;
  end if;

  -- Timestamp de inclusão na fila pelo Feeder
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'queued_at'
  ) then
    alter table public.scheduled_posts 
      add column queued_at timestamptz;
  end if;

  -- Identificador da mensagem na Cloudflare Queue (opcional/rastreamento)
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'queue_message_id'
  ) then
    alter table public.scheduled_posts 
      add column queue_message_id text;
  end if;
end $$;

-- 2. ÍNDICES OTIMIZADOS PARA O CRON FEEDER E RECOVERY
-- Permite que o Cron Feeder encontre em microssegundos posts para enfileirar
create index if not exists idx_scheduled_posts_queue_feeder
  on public.scheduled_posts (scheduled_at asc)
  where status = 'scheduled' and queue_status is null;

-- Permite identificar rapidamente posts enfileirados ou por status de fila
create index if not exists idx_scheduled_posts_queue_status
  on public.scheduled_posts (queue_status)
  where queue_status is not null;

-- 3. RPC AGREGADA PARA REDUÇÃO DRÁSTICA DE SUPABASE EGRESS
-- Substitui múltiplas queries pesadas e downloads desnecessários de centenas de rows
-- por uma agregação SQL atômica no banco, retornando um único payload JSON compacto (< 300 bytes).
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
begin
  select jsonb_build_object(
    'total_accounts', (
      select count(*)::int from public.instagram_accounts 
      where user_id = p_user_id
    ),
    'scheduled_count', (
      select count(*)::int from public.scheduled_posts 
      where user_id = p_user_id 
        and status = 'scheduled'
        and (p_account_id is null or p_account_id = 'all' or instagram_account_id = p_account_id)
    ),
    'processing_count', (
      select count(*)::int from public.scheduled_posts 
      where user_id = p_user_id 
        and status = 'processing'
        and (p_account_id is null or p_account_id = 'all' or instagram_account_id = p_account_id)
    ),
    'published_count', (
      select count(*)::int from public.published_posts 
      where user_id = p_user_id
        and (p_account_id is null or p_account_id = 'all' or instagram_account_id = p_account_id)
    ),
    'published_today_count', (
      select count(*)::int from public.published_posts 
      where user_id = p_user_id
        and published_at >= v_today_start
        and (p_account_id is null or p_account_id = 'all' or instagram_account_id = p_account_id)
    ),
    'active_queues_count', (
      select count(*)::int from public.reel_queues 
      where user_id = p_user_id 
        and status in ('active', 'paused')
        and (p_account_id is null or p_account_id = 'all' or instagram_account_id = p_account_id)
    ),
    'unresolved_errors_count', (
      select count(*)::int from public.error_logs 
      where user_id = p_user_id 
        and status = 'active'
        and (p_account_id is null or p_account_id = 'all' or instagram_account_id = p_account_id)
    ),
    'storage_bytes_total', coalesce((
      select sum(size_bytes)::bigint from public.media 
      where user_id = p_user_id 
        and deleted_at is null
        and (p_account_id is null or p_account_id = 'all' or instagram_account_id = p_account_id)
    ), 0),
    'storage_files_total', (
      select count(*)::int from public.media 
      where user_id = p_user_id 
        and deleted_at is null
        and (p_account_id is null or p_account_id = 'all' or instagram_account_id = p_account_id)
    ),
    'server_time', v_now
  ) into v_result;

  return v_result;
end;
$$;

COMMIT;
