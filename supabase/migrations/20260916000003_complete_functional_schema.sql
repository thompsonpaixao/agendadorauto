-- LEGACY - DO NOT EXECUTE
-- ==============================================================================
-- AGENDADORAUTO - COMPLETE FUNCTIONAL SCHEMA (SUPABASE & META INSTAGRAM API)
-- ==============================================================================
-- 15 Tabelas com isolamento total por auth.uid() = user_id e RLS estrito
-- Suporte a Criptografia AES-256-GCM, Scheduler Atômico, Armazenamento por Perfil,
-- Filas de Reels e Carrosséis, Retries de Publicação, Métricas e Logs de Erros.
-- ==============================================================================

-- Habilita extensão pgcrypto se não estiver habilitada
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. TABELA PROFILES (VINCULADA A AUTH.USERS)
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'developer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 2. TABELA INSTAGRAM_ACCOUNTS (CONTAS CONECTADAS VIA META OAUTH)
-- ------------------------------------------------------------------------------
create table if not exists public.instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_user_id text not null,
  username text not null,
  name text,
  profile_picture_url text,
  account_type text default 'BUSINESS',
  connection_mode text not null default 'development' check (connection_mode in ('development', 'external')),
  status text not null default 'connected' check (status in ('connected', 'reconnect_required', 'error', 'paused', 'disconnected')),
  status_message text,
  token_encrypted text,
  token_iv text,
  token_expires_at timestamptz,
  last_token_check_at timestamptz,
  followers_count bigint default 0,
  media_count bigint default 0,
  timezone text not null default 'America/Sao_Paulo',
  default_reel_caption text default '',
  default_carousel_caption text default '',
  posts_per_day integer not null default 5,
  default_post_times jsonb not null default '["09:00", "12:00", "15:00", "18:00", "21:00"]'::jsonb,
  use_random_time_variation boolean not null default true,
  random_variation_minutes integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_instagram_accounts_user_ig unique (user_id, instagram_user_id)
);

-- View de compatibilidade para código legado que consulta public.accounts
create or replace view public.accounts as
select
  id,
  user_id,
  instagram_user_id,
  username,
  name,
  profile_picture_url as profile_picture,
  status,
  status_message,
  token_encrypted as access_token,
  token_expires_at,
  followers_count as followers,
  0::bigint as new_followers_today,
  0::bigint as posts_today,
  0::bigint as posts_in_queue,
  0::bigint as posts_last_7_days,
  100::numeric as success_rate,
  0::bigint as errors_count,
  default_reel_caption,
  default_carousel_caption,
  posts_per_day as default_reels_per_day,
  1 as default_carousels_per_day,
  default_post_times as default_times,
  use_random_time_variation,
  random_variation_minutes,
  connection_mode,
  timezone,
  created_at,
  updated_at
from public.instagram_accounts;

-- ------------------------------------------------------------------------------
-- 3. TABELA MEDIA (REPOSITÓRIO DE VÍDEOS E FOTOS POR PERFIL)
-- ------------------------------------------------------------------------------
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  original_name text not null,
  storage_path text not null,
  public_url text not null,
  thumbnail_url text,
  media_type text not null default 'video' check (media_type in ('video', 'image')),
  size_bytes bigint not null default 0,
  mime_type text,
  duration_seconds numeric,
  width integer,
  height integer,
  position integer not null default 0,
  status text not null default 'ready' check (status in ('ready', 'processing', 'uploaded', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 4. TABELA REEL_QUEUES (FILAS DE REELS POR PERFIL)
-- ------------------------------------------------------------------------------
create table if not exists public.reel_queues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'completed', 'cancelled', 'error')),
  caption_mode text not null default 'profile_default' check (caption_mode in ('profile_default', 'custom_all', 'individual', 'none')),
  custom_caption text default '',
  posts_per_day integer not null default 5,
  daily_times jsonb not null default '["09:00", "12:00", "15:00", "18:00", "21:00"]'::jsonb,
  use_random_variation boolean not null default true,
  random_variation_minutes integer not null default 5,
  distribute_until_empty boolean not null default true,
  start_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 5. TABELA REEL_QUEUE_ITEMS (ITENS DA FILA COM ORDENAÇÃO)
-- ------------------------------------------------------------------------------
create table if not exists public.reel_queue_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  queue_id uuid not null references public.reel_queues(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete cascade,
  position integer not null default 0,
  custom_caption text,
  status text not null default 'pending' check (status in ('pending', 'scheduled', 'processing', 'published', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 6. TABELA CAROUSELS (CONSTRUTOR DE CARROSSÉIS)
-- ------------------------------------------------------------------------------
create table if not exists public.carousels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  title text not null,
  caption text default '',
  status text not null default 'draft' check (status in ('draft', 'ready', 'queued', 'scheduled', 'published', 'error')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 7. TABELA CAROUSEL_ITEMS (SLIDES COM ORDEM INTERNA PRESERVADA)
-- ------------------------------------------------------------------------------
create table if not exists public.carousel_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  carousel_id uuid not null references public.carousels(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 8. TABELA SCHEDULES (CALENDÁRIOS E REGRAS DE REPETIÇÃO)
-- ------------------------------------------------------------------------------
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  name text not null,
  timezone text not null default 'America/Sao_Paulo',
  posts_per_day integer not null default 5,
  post_times jsonb not null default '["09:00", "12:00", "15:00", "18:00", "21:00"]'::jsonb,
  use_random_variation boolean not null default true,
  random_variation_minutes integer not null default 5,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 9. TABELA SCHEDULED_POSTS (POSTS PROGRAMADOS COM CLAIM ATÔMICO)
-- ------------------------------------------------------------------------------
create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  post_type text not null check (post_type in ('reel', 'carousel')),
  media_id uuid references public.media(id) on delete set null,
  carousel_id uuid references public.carousels(id) on delete set null,
  queue_id uuid references public.reel_queues(id) on delete set null,
  queue_item_id uuid references public.reel_queue_items(id) on delete set null,
  caption text default '',
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'processing', 'published', 'failed', 'cancelled')),
  meta_container_id text,
  meta_media_id text,
  locked_at timestamptz,
  locked_by text,
  error_code text,
  error_message text,
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 10. TABELA PUBLISHED_POSTS (HISTÓRICO PERMANENTE DE PUBLICAÇÃO)
-- ------------------------------------------------------------------------------
create table if not exists public.published_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  scheduled_post_id uuid references public.scheduled_posts(id) on delete set null,
  media_type text not null check (media_type in ('reel', 'carousel')),
  instagram_media_id text not null,
  permalink text,
  caption text default '',
  published_at timestamptz not null default now(),
  status text not null default 'published',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 11. TABELA PUBLICATION_ATTEMPTS (TENTATIVAS E RETRIES DETALHADOS)
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

-- ------------------------------------------------------------------------------
-- 12. TABELA ERROR_LOGS (LOGS TÉCNICOS SEM SEGREDOS)
-- ------------------------------------------------------------------------------
create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid references public.instagram_accounts(id) on delete cascade,
  scheduled_post_id uuid references public.scheduled_posts(id) on delete cascade,
  severity text not null default 'error' check (severity in ('warning', 'error', 'critical')),
  category text not null check (category in ('oauth', 'token', 'upload', 'media_processing', 'publishing', 'storage', 'scheduler', 'analytics', 'database')),
  error_code text not null,
  message text not null,
  technical_details text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ------------------------------------------------------------------------------
-- 13. TABELA NOTIFICATIONS (ALERTAS E NOTIFICAÇÕES DO SISTEMA)
-- ------------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid references public.instagram_accounts(id) on delete cascade,
  type text not null check (type in ('account_connected', 'account_disconnected', 'token_reconnect_required', 'publish_success', 'publish_failed', 'queue_completed', 'queue_paused')),
  title text not null,
  message text not null,
  read boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 14. TABELA ACCOUNT_METRICS (MÉTRICAS DA CONTA VIA GRAPH API)
-- ------------------------------------------------------------------------------
create table if not exists public.account_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  date date not null default current_date,
  followers_count bigint default 0,
  media_count bigint default 0,
  reach bigint,
  impressions bigint,
  profile_views bigint,
  website_clicks bigint,
  raw_data jsonb,
  recorded_at timestamptz not null default now(),
  constraint uq_account_metrics_account_date unique (instagram_account_id, date)
);

-- ------------------------------------------------------------------------------
-- 15. TABELA MEDIA_METRICS (MÉTRICAS DE REELS E CARROSSÉIS PUBLICADOS)
-- ------------------------------------------------------------------------------
create table if not exists public.media_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  published_post_id uuid references public.published_posts(id) on delete cascade,
  instagram_media_id text not null,
  views bigint default 0,
  reach bigint default 0,
  likes bigint default 0,
  comments bigint default 0,
  shares bigint default 0,
  saved bigint default 0,
  profile_visits bigint default 0,
  follows bigint default 0,
  watch_time_seconds bigint,
  avg_watch_time_seconds numeric,
  raw_data jsonb,
  recorded_at timestamptz not null default now()
);

-- ==============================================================================
-- ÍNDICES DE ALTO DESEMPENHO
-- ==============================================================================
create index if not exists idx_scheduled_posts_status_scheduled_at
  on public.scheduled_posts (status, scheduled_at);

create index if not exists idx_instagram_accounts_user_id
  on public.instagram_accounts (user_id);

create index if not exists idx_media_user_account
  on public.media (user_id, instagram_account_id);

create index if not exists idx_error_logs_user_created
  on public.error_logs (user_id, created_at desc);

create index if not exists idx_published_posts_user_published
  on public.published_posts (user_id, published_at desc);

create index if not exists idx_account_metrics_account_date
  on public.account_metrics (instagram_account_id, date desc);

create index if not exists idx_media_metrics_post_recorded
  on public.media_metrics (published_post_id, recorded_at desc);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) EM TODAS AS 15 TABELAS
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.instagram_accounts enable row level security;
alter table public.media enable row level security;
alter table public.reel_queues enable row level security;
alter table public.reel_queue_items enable row level security;
alter table public.carousels enable row level security;
alter table public.carousel_items enable row level security;
alter table public.schedules enable row level security;
alter table public.scheduled_posts enable row level security;
alter table public.published_posts enable row level security;
alter table public.publication_attempts enable row level security;
alter table public.error_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.account_metrics enable row level security;
alter table public.media_metrics enable row level security;

-- PROFILES
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

-- INSTAGRAM_ACCOUNTS
drop policy if exists "instagram_accounts_select_own" on public.instagram_accounts;
create policy "instagram_accounts_select_own" on public.instagram_accounts for select using (auth.uid() = user_id);

drop policy if exists "instagram_accounts_insert_own" on public.instagram_accounts;
create policy "instagram_accounts_insert_own" on public.instagram_accounts for insert with check (auth.uid() = user_id);

drop policy if exists "instagram_accounts_update_own" on public.instagram_accounts;
create policy "instagram_accounts_update_own" on public.instagram_accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "instagram_accounts_delete_own" on public.instagram_accounts;
create policy "instagram_accounts_delete_own" on public.instagram_accounts for delete using (auth.uid() = user_id);

-- MEDIA
drop policy if exists "media_select_own" on public.media;
create policy "media_select_own" on public.media for select using (auth.uid() = user_id);

drop policy if exists "media_insert_own" on public.media;
create policy "media_insert_own" on public.media for insert with check (auth.uid() = user_id);

drop policy if exists "media_update_own" on public.media;
create policy "media_update_own" on public.media for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "media_delete_own" on public.media;
create policy "media_delete_own" on public.media for delete using (auth.uid() = user_id);

-- REEL_QUEUES
drop policy if exists "reel_queues_select_own" on public.reel_queues;
create policy "reel_queues_select_own" on public.reel_queues for select using (auth.uid() = user_id);

drop policy if exists "reel_queues_insert_own" on public.reel_queues;
create policy "reel_queues_insert_own" on public.reel_queues for insert with check (auth.uid() = user_id);

drop policy if exists "reel_queues_update_own" on public.reel_queues;
create policy "reel_queues_update_own" on public.reel_queues for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reel_queues_delete_own" on public.reel_queues;
create policy "reel_queues_delete_own" on public.reel_queues for delete using (auth.uid() = user_id);

-- REEL_QUEUE_ITEMS
drop policy if exists "reel_queue_items_select_own" on public.reel_queue_items;
create policy "reel_queue_items_select_own" on public.reel_queue_items for select using (auth.uid() = user_id);

drop policy if exists "reel_queue_items_insert_own" on public.reel_queue_items;
create policy "reel_queue_items_insert_own" on public.reel_queue_items for insert with check (auth.uid() = user_id);

drop policy if exists "reel_queue_items_update_own" on public.reel_queue_items;
create policy "reel_queue_items_update_own" on public.reel_queue_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reel_queue_items_delete_own" on public.reel_queue_items;
create policy "reel_queue_items_delete_own" on public.reel_queue_items for delete using (auth.uid() = user_id);

-- CAROUSELS
drop policy if exists "carousels_select_own" on public.carousels;
create policy "carousels_select_own" on public.carousels for select using (auth.uid() = user_id);

drop policy if exists "carousels_insert_own" on public.carousels;
create policy "carousels_insert_own" on public.carousels for insert with check (auth.uid() = user_id);

drop policy if exists "carousels_update_own" on public.carousels;
create policy "carousels_update_own" on public.carousels for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "carousels_delete_own" on public.carousels;
create policy "carousels_delete_own" on public.carousels for delete using (auth.uid() = user_id);

-- CAROUSEL_ITEMS
drop policy if exists "carousel_items_select_own" on public.carousel_items;
create policy "carousel_items_select_own" on public.carousel_items for select using (auth.uid() = user_id);

drop policy if exists "carousel_items_insert_own" on public.carousel_items;
create policy "carousel_items_insert_own" on public.carousel_items for insert with check (auth.uid() = user_id);

drop policy if exists "carousel_items_update_own" on public.carousel_items;
create policy "carousel_items_update_own" on public.carousel_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "carousel_items_delete_own" on public.carousel_items;
create policy "carousel_items_delete_own" on public.carousel_items for delete using (auth.uid() = user_id);

-- SCHEDULES
drop policy if exists "schedules_select_own" on public.schedules;
create policy "schedules_select_own" on public.schedules for select using (auth.uid() = user_id);

drop policy if exists "schedules_insert_own" on public.schedules;
create policy "schedules_insert_own" on public.schedules for insert with check (auth.uid() = user_id);

drop policy if exists "schedules_update_own" on public.schedules;
create policy "schedules_update_own" on public.schedules for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "schedules_delete_own" on public.schedules;
create policy "schedules_delete_own" on public.schedules for delete using (auth.uid() = user_id);

-- SCHEDULED_POSTS
drop policy if exists "scheduled_posts_select_own" on public.scheduled_posts;
create policy "scheduled_posts_select_own" on public.scheduled_posts for select using (auth.uid() = user_id);

drop policy if exists "scheduled_posts_insert_own" on public.scheduled_posts;
create policy "scheduled_posts_insert_own" on public.scheduled_posts for insert with check (auth.uid() = user_id);

drop policy if exists "scheduled_posts_update_own" on public.scheduled_posts;
create policy "scheduled_posts_update_own" on public.scheduled_posts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "scheduled_posts_delete_own" on public.scheduled_posts;
create policy "scheduled_posts_delete_own" on public.scheduled_posts for delete using (auth.uid() = user_id);

-- PUBLISHED_POSTS
drop policy if exists "published_posts_select_own" on public.published_posts;
create policy "published_posts_select_own" on public.published_posts for select using (auth.uid() = user_id);

drop policy if exists "published_posts_insert_own" on public.published_posts;
create policy "published_posts_insert_own" on public.published_posts for insert with check (auth.uid() = user_id);

drop policy if exists "published_posts_update_own" on public.published_posts;
create policy "published_posts_update_own" on public.published_posts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "published_posts_delete_own" on public.published_posts;
create policy "published_posts_delete_own" on public.published_posts for delete using (auth.uid() = user_id);

-- PUBLICATION_ATTEMPTS
drop policy if exists "publication_attempts_select_own" on public.publication_attempts;
create policy "publication_attempts_select_own" on public.publication_attempts for select using (auth.uid() = user_id);

drop policy if exists "publication_attempts_insert_own" on public.publication_attempts;
create policy "publication_attempts_insert_own" on public.publication_attempts for insert with check (auth.uid() = user_id);

drop policy if exists "publication_attempts_update_own" on public.publication_attempts;
create policy "publication_attempts_update_own" on public.publication_attempts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "publication_attempts_delete_own" on public.publication_attempts;
create policy "publication_attempts_delete_own" on public.publication_attempts for delete using (auth.uid() = user_id);

-- ERROR_LOGS
drop policy if exists "error_logs_select_own" on public.error_logs;
create policy "error_logs_select_own" on public.error_logs for select using (auth.uid() = user_id);

drop policy if exists "error_logs_insert_own" on public.error_logs;
create policy "error_logs_insert_own" on public.error_logs for insert with check (auth.uid() = user_id);

drop policy if exists "error_logs_update_own" on public.error_logs;
create policy "error_logs_update_own" on public.error_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "error_logs_delete_own" on public.error_logs;
create policy "error_logs_delete_own" on public.error_logs for delete using (auth.uid() = user_id);

-- NOTIFICATIONS
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);

drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own" on public.notifications for insert with check (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications for delete using (auth.uid() = user_id);

-- ACCOUNT_METRICS
drop policy if exists "account_metrics_select_own" on public.account_metrics;
create policy "account_metrics_select_own" on public.account_metrics for select using (auth.uid() = user_id);

drop policy if exists "account_metrics_insert_own" on public.account_metrics;
create policy "account_metrics_insert_own" on public.account_metrics for insert with check (auth.uid() = user_id);

drop policy if exists "account_metrics_update_own" on public.account_metrics;
create policy "account_metrics_update_own" on public.account_metrics for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "account_metrics_delete_own" on public.account_metrics;
create policy "account_metrics_delete_own" on public.account_metrics for delete using (auth.uid() = user_id);

-- MEDIA_METRICS
drop policy if exists "media_metrics_select_own" on public.media_metrics;
create policy "media_metrics_select_own" on public.media_metrics for select using (auth.uid() = user_id);

drop policy if exists "media_metrics_insert_own" on public.media_metrics;
create policy "media_metrics_insert_own" on public.media_metrics for insert with check (auth.uid() = user_id);

drop policy if exists "media_metrics_update_own" on public.media_metrics;
create policy "media_metrics_update_own" on public.media_metrics for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "media_metrics_delete_own" on public.media_metrics;
create policy "media_metrics_delete_own" on public.media_metrics for delete using (auth.uid() = user_id);

-- ==============================================================================
-- FUNÇÃO DE CLAIM ATÔMICO DE POSTS PARA O SCHEDULER (CONCORRÊNCIA SEGURA)
-- ==============================================================================
-- Utiliza FOR UPDATE SKIP LOCKED no PostgreSQL para garantir que nenhum post
-- seja processado por dois workers simultaneamente.
create or replace function public.claim_scheduled_posts(
  p_worker_id text,
  p_batch_size integer default 5,
  p_lock_duration_minutes integer default 10
)
returns setof public.scheduled_posts
language plpgsql
security definer
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  return query
  with candidate_posts as (
    select id
    from public.scheduled_posts
    where (
      (status = 'scheduled' and scheduled_at <= v_now)
      or (status = 'processing' and locked_at < v_now - (p_lock_duration_minutes || ' minutes')::interval)
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

-- Permite ao service_role invocar a função de claim
grant execute on function public.claim_scheduled_posts(text, integer, integer) to service_role;
grant execute on function public.claim_scheduled_posts(text, integer, integer) to authenticated;
