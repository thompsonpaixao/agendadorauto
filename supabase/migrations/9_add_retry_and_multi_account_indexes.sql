BEGIN;

-- ==============================================================================
-- MIGRATION 9: TRACKING DE RETRY AUTOMÁTICO DE REELS E ÍNDICES MULTI-CONTA
-- AgendadorAuto - Execução Manual Idempotente em Bloco Transacional Único
-- ==============================================================================

-- 1. ADIÇÃO DO CAMPO NEXT_RETRY_AT EM PUBLIC.SCHEDULED_POSTS
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'scheduled_posts' and column_name = 'next_retry_at'
  ) then
    alter table public.scheduled_posts 
      add column next_retry_at timestamptz;
  end if;
end $$;

-- Índice para consultas otimizadas de retry e status pelo Cron
create index if not exists idx_scheduled_posts_retry_status
  on public.scheduled_posts (status, next_retry_at)
  where status in ('scheduled', 'processing');

-- 2. ÍNDICES DE ALTA PERFORMANCE PARA ISOLAMENTO MULTI-CONTA
-- Garante consultas instantâneas e sem vazamento entre contas do mesmo usuário
create index if not exists idx_media_user_account
  on public.media (user_id, instagram_account_id)
  where deleted_at is null;

create index if not exists idx_scheduled_posts_user_account
  on public.scheduled_posts (user_id, instagram_account_id, scheduled_at);

create index if not exists idx_published_posts_user_account
  on public.published_posts (user_id, instagram_account_id, published_at);

create index if not exists idx_reel_queues_user_account
  on public.reel_queues (user_id, instagram_account_id, created_at);

create index if not exists idx_carousel_queues_user_account
  on public.carousel_queues (user_id, instagram_account_id, created_at);

create index if not exists idx_error_logs_user_account_status
  on public.error_logs (user_id, instagram_account_id, status);

-- 3. ATUALIZAÇÃO DA FUNÇÃO CLAIM_SCHEDULED_POSTS COM SUPORTE A NEXT_RETRY_AT
-- Permite que posts com falha recuperável aguardem 5 minutos de forma segura:
-- Durante os minutos 1 a 4, o Cron de 1 minuto ignora o post porque next_retry_at > now().
-- No minuto 5, o post é claimado atomicamente para a segunda e última tentativa.
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
      -- 1. Posts agendados normais cujo horário chegou e cujo retry (se houver) já venceu
      (
        status = 'scheduled' 
        and scheduled_at <= v_now 
        and (next_retry_at is null or next_retry_at <= v_now)
        and (locked_at is null or locked_at < v_now - ('3 minutes')::pg_catalog.interval)
      )
      or
      -- 2. Posts em processamento assíncrono com meta_container_id ativo cujo lock foi liberado
      -- e cujo retry (se houver) já venceu (capturado a cada 1 minuto pelo Cron)
      (
        status = 'processing' 
        and meta_container_id is not null 
        and (next_retry_at is null or next_retry_at <= v_now)
        and (locked_at is null or locked_at < v_now - ('1 minute')::pg_catalog.interval)
      )
      or
      -- 3. Posts em processamento sem container (fallback seguro: lock expirado e retry vencido)
      (
        status = 'processing' 
        and meta_container_id is null 
        and (next_retry_at is null or next_retry_at <= v_now)
        and (locked_at is null or locked_at < v_now - (p_lock_duration_minutes || ' minutes')::pg_catalog.interval)
      )
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
