BEGIN;

-- ==============================================================================
-- MIGRATION 8: SUPORTE AO CLOUDFLARE R2 E TRACKING ASSÍNCRONO DA META GRAPH API
-- AgendadorAuto - Execução Manual Idempotente em Bloco Transacional Único
-- ==============================================================================

-- 1. ADIÇÃO DE CAMPOS DE STORAGE EM PUBLIC.MEDIA (SEQUÊNCIA SEGURA PARA HISTÓRICO)
do $$
begin
  -- 1.1 Cria a coluna storage_provider se não existir (inicialmente sem NOT NULL)
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'media' and column_name = 'storage_provider'
  ) then
    alter table public.media 
      add column storage_provider text;
  end if;

  -- 1.2 Registros que JÁ EXISTEM no banco são identificados com precisão como 'supabase'
  update public.media 
  set storage_provider = 'supabase' 
  where storage_provider is null;

  -- 1.3 Define default='r2' para quaisquer novas mídias inseridas
  alter table public.media 
    alter column storage_provider set default 'r2';

  -- 1.4 Garante NOT NULL na coluna após o preenchimento seguro do histórico
  alter table public.media 
    alter column storage_provider set not null;

  -- 1.5 Adiciona constraint de validação de valores permitidos ('supabase' ou 'r2')
  if not exists (
    select 1 from pg_catalog.pg_constraint con
    inner join pg_catalog.pg_class rel on rel.oid = con.conrelid
    inner join pg_catalog.pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' 
      and rel.relname = 'media' 
      and con.conname = 'chk_media_storage_provider'
  ) then
    alter table public.media 
      add constraint chk_media_storage_provider 
      check (storage_provider in ('supabase', 'r2'));
  end if;

  -- 1.6 Nome do bucket (obtido dinamicamente de process.env.R2_BUCKET_NAME no backend, sem default fixo)
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'media' and column_name = 'storage_bucket'
  ) then
    alter table public.media 
      add column storage_bucket text;
  end if;
end $$;

-- Índice para consultas de retenção e cleanup por provider
create index if not exists idx_media_storage_provider_retention
  on public.media (storage_provider, retention_status)
  where deleted_at is null;

-- 2. ADIÇÃO DE CAMPOS DE TRACKING DE CONTAINER EM PUBLIC.SCHEDULED_POSTS
do $$
begin
  -- Data/hora de criação do container na Meta Graph API
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'container_created_at'
  ) then
    alter table public.scheduled_posts 
      add column container_created_at timestamptz;
  end if;

  -- Último status retornado pela Meta ('IN_PROGRESS', 'FINISHED', 'ERROR', 'EXPIRED', 'PUBLISHED')
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'last_container_status'
  ) then
    alter table public.scheduled_posts 
      add column last_container_status text;
  end if;

  -- Timestamp da última verificação de status do container
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'last_container_check_at'
  ) then
    alter table public.scheduled_posts 
      add column last_container_check_at timestamptz;
  end if;

  -- Contador de tentativas de publicação executadas (apenas chamadas reais a media_publish)
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'publish_attempts'
  ) then
    alter table public.scheduled_posts 
      add column publish_attempts integer not null default 0;
  end if;
end $$;

-- Índices otimizados para o Scheduler monitorar posts agendados e containers assíncronos
create index if not exists idx_scheduled_posts_due_posts
  on public.scheduled_posts (status, scheduled_at)
  where status = 'scheduled';

create index if not exists idx_scheduled_posts_processing_containers
  on public.scheduled_posts (status, meta_container_id)
  where status = 'processing' and meta_container_id is not null;

-- 3. ADIÇÃO DO CAMPO STATUS EM PUBLIC.ERROR_LOGS (PARA RESOLUÇÃO AUTOMÁTICA)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'error_logs' and column_name = 'status'
  ) then
    alter table public.error_logs 
      add column status text not null default 'active' 
      check (status in ('active', 'resolved', 'ignored'));
  end if;
end $$;

-- Atualiza erros antigos que já possuíam resolved_at preenchido
update public.error_logs
set status = 'resolved'
where resolved_at is not null and status = 'active';

create index if not exists idx_error_logs_account_status
  on public.error_logs (instagram_account_id, status)
  where resolved_at is null;

create index if not exists idx_error_logs_post_status
  on public.error_logs (scheduled_post_id, status);

-- 4. ATUALIZAÇÃO DA FUNÇÃO CLAIM_SCHEDULED_POSTS
-- Permite ao Cron capturar tanto posts agendados vencidos quanto posts em processamento
-- assíncrono cujo container está aguardando verificação (sem prender por 10 minutos).
create or replace function public.claim_scheduled_posts(
  p_worker_id text,
  p_batch_size integer default 5,
  p_lock_duration_minutes integer default 10
)
returns setof public.scheduled_posts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  return query
  with candidate_posts as (
    select id
    from public.scheduled_posts
    where (
      -- 1. Posts agendados normais cujo horário chegou e não estão bloqueados
      (status = 'scheduled' and scheduled_at <= v_now and (locked_at is null or locked_at < v_now - ('3 minutes')::pg_catalog.interval))
      or
      -- 2. Posts em processamento assíncrono que já têm meta_container_id e cujo lock foi liberado
      -- (permite checagem a cada ciclo de 1 minuto do Supabase Cron)
      (status = 'processing' and meta_container_id is not null and (locked_at is null or locked_at < v_now - ('1 minute')::pg_catalog.interval))
      or
      -- 3. Posts em processamento sem container (fallback seguro: captura com lock expirado OU sem lock ativo)
      (status = 'processing' and meta_container_id is null and (locked_at is null or locked_at < v_now - (p_lock_duration_minutes || ' minutes')::pg_catalog.interval))
    )
    order by scheduled_at asc
    limit p_batch_size
    for update skip locked
  )
  update public.scheduled_posts sp
  set
    status = 'processing',
    locked_at = v_now,
    locked_by = p_worker_id,
    updated_at = v_now
  from candidate_posts cp
  where sp.id = cp.id
  returning sp.*;
end;
$$;

revoke execute on function public.claim_scheduled_posts(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_scheduled_posts(text, integer, integer) to service_role;

COMMIT;
