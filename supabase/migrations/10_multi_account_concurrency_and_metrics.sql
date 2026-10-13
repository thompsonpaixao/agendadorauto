BEGIN;

-- ==============================================================================
-- MIGRATION 10: CONCORRÊNCIA MULTI-CONTA, FAIRNESS E SNAPSHOTS DE MÉTRICAS
-- AgendadorAuto - Execução Manual Idempotente em Bloco Transacional Único
-- ==============================================================================

-- 1. ÍNDICES ADICIONAIS PARA SUPORTE A FILTROS TEMPORAIS E CONCORRÊNCIA MULTI-CONTA
create index if not exists idx_scheduled_posts_account_status_time
  on public.scheduled_posts (instagram_account_id, status, scheduled_at asc);

create index if not exists idx_scheduled_posts_overdue
  on public.scheduled_posts (status, scheduled_at asc)
  where status = 'scheduled';

create index if not exists idx_account_metrics_account_date
  on public.account_metrics (instagram_account_id, date desc);

-- 2. PROCEDIMENTO ATÔMICO DE CLAIM COM CONCORRÊNCIA MULTI-CONTA E FAIRNESS
-- Regras aplicadas:
-- A) Máximo 1 post por conta por rodada (elimina starvation e concorrência interna na mesma conta).
-- B) Contas com publicação ativamente em andamento (locked ou aguardando retry) não recebem novo agendamento.
-- C) Containers em processamento na Meta (meta_container_id is not null) têm prioridade de checagem (~200ms).
-- D) Backlog de posts atrasados (scheduled_at <= now()) é preservado e drenado por ordem de agendamento (scheduled_at ASC).
create or replace function public.claim_scheduled_posts(
  p_worker_id text,
  p_batch_size integer default 20,
  p_lock_duration_minutes integer default 5
)
returns setof public.scheduled_posts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_lock_interval interval := (p_lock_duration_minutes || ' minutes')::pg_catalog.interval;
begin
  return query
  with
  -- 1. Identifica contas ocupadas: possuem worker executando no momento ou estão na janela de retry
  busy_accounts as (
    select distinct instagram_account_id
    from public.scheduled_posts
    where status = 'processing'
      and (
        -- Worker em execução ativa (lock recente < 2 minutos)
        (locked_at is not null and locked_at > v_now - ('2 minutes')::pg_catalog.interval)
        or
        -- Aguardando retry de 5 minutos
        (next_retry_at is not null and next_retry_at > v_now)
      )
  ),

  -- 2. Categoria A: Posts em processamento assíncrono aguardando checagem de container na Meta
  -- Checagem rápida (~200ms GET). No máximo 1 por conta.
  container_checks as (
    select
      sp.id,
      sp.instagram_account_id,
      sp.scheduled_at,
      1 as priority_group,
      row_number() over (
        partition by sp.instagram_account_id
        order by sp.scheduled_at asc
      ) as rn
    from public.scheduled_posts sp
    where sp.status = 'processing'
      and sp.meta_container_id is not null
      and (sp.next_retry_at is null or sp.next_retry_at <= v_now)
      and (sp.locked_at is null or sp.locked_at < v_now - ('1 minute')::pg_catalog.interval)
  ),

  -- 3. Categoria B: Novos posts agendados vencidos (scheduled_at <= v_now)
  -- Seleciona EXATAMENTE 1 post por conta (o mais antigo vencido) para contas livres.
  new_scheduled as (
    select
      sp.id,
      sp.instagram_account_id,
      sp.scheduled_at,
      2 as priority_group,
      row_number() over (
        partition by sp.instagram_account_id
        order by sp.scheduled_at asc
      ) as rn
    from public.scheduled_posts sp
    where sp.status = 'scheduled'
      and sp.scheduled_at <= v_now
      and (sp.next_retry_at is null or sp.next_retry_at <= v_now)
      and (sp.locked_at is null or sp.locked_at < v_now - ('2 minutes')::pg_catalog.interval)
      and sp.instagram_account_id not in (select instagram_account_id from busy_accounts)
      and sp.instagram_account_id not in (select instagram_account_id from container_checks where rn = 1)
  ),

  -- 4. Categoria C: Fallback para posts em processing sem container cujo lock expirou
  stuck_processing as (
    select
      sp.id,
      sp.instagram_account_id,
      sp.scheduled_at,
      3 as priority_group,
      row_number() over (
        partition by sp.instagram_account_id
        order by sp.scheduled_at asc
      ) as rn
    from public.scheduled_posts sp
    where sp.status = 'processing'
      and sp.meta_container_id is null
      and (sp.next_retry_at is null or sp.next_retry_at <= v_now)
      and (sp.locked_at is null or sp.locked_at < v_now - v_lock_interval)
      and sp.instagram_account_id not in (select instagram_account_id from busy_accounts)
      and sp.instagram_account_id not in (select instagram_account_id from container_checks where rn = 1)
      and sp.instagram_account_id not in (select instagram_account_id from new_scheduled where rn = 1)
  ),

  -- 5. Candidatos únicos por conta (rn = 1)
  all_candidates as (
    select id, instagram_account_id, scheduled_at, priority_group
    from container_checks where rn = 1
    union all
    select id, instagram_account_id, scheduled_at, priority_group
    from new_scheduled where rn = 1
    union all
    select id, instagram_account_id, scheduled_at, priority_group
    from stuck_processing where rn = 1
  ),

  -- 6. Seleção final com lock atômico concorrente
  selected_batch as (
    select id
    from all_candidates
    order by priority_group asc, scheduled_at asc
    limit p_batch_size
    for update skip locked
  )

  update public.scheduled_posts sp
  set
    status = 'processing',
    locked_at = v_now,
    locked_by = p_worker_id,
    updated_at = v_now
  from selected_batch sb
  where sp.id = sb.id
  returning sp.*;
end;
$$;

revoke execute on function public.claim_scheduled_posts(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_scheduled_posts(text, integer, integer) to service_role;

COMMIT;
