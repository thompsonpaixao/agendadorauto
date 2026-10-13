-- ==============================================================================
-- AGENDADORAUTO - DEFINITIVE PRODUCTION SCHEMA (MIGRATION 4)
-- ==============================================================================
-- Migration autossuficiente e compatível com o estado existente do banco.
-- Preserva dados existentes na tabela public.profiles e usuários reais com role admin.
-- Total isolamento multiusuário com RLS (auth.uid() = user_id).
-- Integridade estrita: Composite Foreign Keys impedem qualquer referência cruzada entre tenants.
-- Criptografia de tokens Meta, Scheduler atômico e conformidade total de privacidade.
-- Monitoramento de perfis de terceiros (sem scraping, via arquitetura oficial).
-- Controle de retenção de mídias e exclusão automática programada.
-- ==============================================================================

-- 0. EXTENSÕES NECESSÁRIAS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ==============================================================================
-- 1. TABELA PROFILES (COMPLETAR PRESERVANDO DADOS E ROLES EXISTENTES)
-- ==============================================================================
-- Garante a existência da tabela caso seja um ambiente novo
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user',
  created_at timestamptz not null default now()
);

-- Garante foreign key para auth.users de forma idempotente e segura na base existente
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
      and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public'
      and tc.table_name = 'profiles'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'id'
  ) then
    alter table public.profiles
      add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- Adiciona as colunas ausentes sem afetar as colunas e dados já existentes
alter table public.profiles
  add column if not exists email text,
  add column if not exists name text,
  add column if not exists avatar_url text,
  add column if not exists updated_at timestamptz default now();

-- Constraint de integridade de role sem engolir erros silenciosamente
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'developer', 'admin'));

-- Backfill seguro: sincroniza dados cadastrais existentes a partir de auth.users SEM alterar o role
update public.profiles p
set
  email = coalesce(p.email, u.email),
  name = coalesce(p.name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  avatar_url = coalesce(p.avatar_url, u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
  updated_at = coalesce(p.updated_at, now())
from auth.users u
where p.id = u.id;

-- Trigger automático para sincronizar novos usuários com public.profiles
-- IMPORTANTE: No ON CONFLICT a coluna 'role' NUNCA é sobrescrita, preservando roles existentes (admin/developer)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', pg_catalog.split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', null),
    'user'
  )
  on conflict (id) do update set
    email = coalesce(excluded.email, public.profiles.email),
    name = coalesce(excluded.name, public.profiles.name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = pg_catalog.now();
    -- 'role' propositalmente não é atualizado para manter intacto qualquer papel administrativo configurado
  return new;
end;
$$;

-- Revoga execução da função de trigger de public, anon e authenticated
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==============================================================================
-- 2. TABELAS DEFINITIVAS DO SISTEMA (CREATE TABLE IF NOT EXISTS)
-- ==============================================================================

-- 2.1 INSTAGRAM_ACCOUNTS (CONTAS CONECTADAS VIA META OAUTH COM VERIFICAÇÃO REAL)
-- NOTA DE SEGURANÇA: Nunca armazena tokens em texto puro; apenas criptografados com AES-256-GCM.
-- Defaults realistas: status nasce unknown/false até validação real com a Graph API.
create table if not exists public.instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_user_id text not null,
  username text not null,
  name text,
  profile_picture_url text,
  account_type text default 'UNKNOWN',
  connection_mode text not null default 'development' check (connection_mode in ('development', 'external')),
  status text not null default 'pending_verification' check (status in ('pending_verification', 'connected', 'reconnect_required', 'error', 'paused', 'disconnected')),
  status_message text,
  token_expires_at timestamptz,
  last_token_check_at timestamptz,
  token_status text not null default 'unknown' check (token_status in ('valid', 'expiring_soon', 'invalid', 'unknown')),
  has_publish_permission boolean not null default false,
  has_insights_permission boolean not null default false,
  last_verified_at timestamptz,
  last_successful_sync_at timestamptz,
  last_error_message text,
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
  constraint uq_instagram_accounts_user_ig unique (user_id, instagram_user_id),
  constraint uq_instagram_accounts_id_user unique (id, user_id)
);

-- 2.1.1 INSTAGRAM_ACCOUNT_SECRETS (COFRE CRIPTOGRÁFICO EXCLUSIVO DO SERVIDOR)
-- Tokens criptografados com AES-256-GCM ficam isolados nesta tabela sem permissão de SELECT
-- para usuários comuns/frontend, garantindo que nenhum segredo seja exposto ao navegador.
create table if not exists public.instagram_account_secrets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid not null,
  token_encrypted text not null,
  token_iv text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_instagram_account_secrets_account unique (instagram_account_id),
  constraint fk_instagram_account_secrets_account foreign key (instagram_account_id, user_id) references public.instagram_accounts(id, user_id) on delete cascade
);

alter table public.instagram_account_secrets enable row level security;
-- NOTA CRÍTICA DE SEGURANÇA: Zero policies para public, anon ou authenticated.
-- Acesso permitido exclusivamente pelo backend através do service_role.

-- 2.2 MEDIA (REPOSITÓRIO DE VÍDEOS E FOTOS COM CONTROLE DE RETENÇÃO E STORAGE PRIVADO)
-- public_url é opcional (NULL permitido) para compatibilidade com Storage Privado (Signed URLs server-side).
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid not null,
  original_name text not null,
  storage_path text not null,
  public_url text,
  thumbnail_url text,
  media_type text not null default 'video' check (media_type in ('video', 'image')),
  size_bytes bigint not null default 0,
  mime_type text,
  duration_seconds numeric,
  width integer,
  height integer,
  position integer not null default 0,
  status text not null default 'ready' check (status in ('ready', 'processing', 'uploaded', 'error')),
  published_at timestamptz,
  delete_after timestamptz,
  deleted_at timestamptz,
  retention_status text not null default 'active' check (retention_status in ('active', 'waiting_publication', 'eligible_for_deletion', 'deletion_scheduled', 'deleted', 'preserved_due_to_error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_media_id_user unique (id, user_id),
  constraint fk_media_account foreign key (instagram_account_id, user_id) references public.instagram_accounts(id, user_id) on delete cascade
);

-- 2.3 REEL_QUEUES (FILAS DE REELS POR PERFIL)
create table if not exists public.reel_queues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid not null,
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
  updated_at timestamptz not null default now(),
  constraint uq_reel_queues_id_user unique (id, user_id),
  constraint fk_reel_queues_account foreign key (instagram_account_id, user_id) references public.instagram_accounts(id, user_id) on delete cascade
);

-- 2.4 REEL_QUEUE_ITEMS (ITENS DA FILA COM VALIDAÇÃO DE OWNERSHIP)
create table if not exists public.reel_queue_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  queue_id uuid not null,
  media_id uuid not null,
  position integer not null default 0,
  custom_caption text,
  status text not null default 'pending' check (status in ('pending', 'scheduled', 'processing', 'published', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_reel_queue_items_id_user unique (id, user_id),
  constraint fk_reel_queue_items_queue foreign key (queue_id, user_id) references public.reel_queues(id, user_id) on delete cascade,
  constraint fk_reel_queue_items_media foreign key (media_id, user_id) references public.media(id, user_id) on delete cascade
);

-- 2.5 CAROUSELS (CONSTRUTOR DE CARROSSÉIS)
create table if not exists public.carousels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid not null,
  title text not null,
  caption text default '',
  status text not null default 'draft' check (status in ('draft', 'ready', 'queued', 'scheduled', 'published', 'error')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_carousels_id_user unique (id, user_id),
  constraint fk_carousels_account foreign key (instagram_account_id, user_id) references public.instagram_accounts(id, user_id) on delete cascade
);

-- 2.6 CAROUSEL_ITEMS (SLIDES COM VALIDAÇÃO DE OWNERSHIP)
create table if not exists public.carousel_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  carousel_id uuid not null,
  media_id uuid not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint fk_carousel_items_carousel foreign key (carousel_id, user_id) references public.carousels(id, user_id) on delete cascade,
  constraint fk_carousel_items_media foreign key (media_id, user_id) references public.media(id, user_id) on delete cascade
);

-- 2.7 SCHEDULES (CALENDÁRIOS E REGRAS DE REPETIÇÃO)
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid not null,
  name text not null,
  timezone text not null default 'America/Sao_Paulo',
  posts_per_day integer not null default 5,
  post_times jsonb not null default '["09:00", "12:00", "15:00", "18:00", "21:00"]'::jsonb,
  use_random_variation boolean not null default true,
  random_variation_minutes integer not null default 5,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint uq_schedules_id_user unique (id, user_id),
  constraint fk_schedules_account foreign key (instagram_account_id, user_id) references public.instagram_accounts(id, user_id) on delete cascade
);

-- 2.8 SCHEDULED_POSTS (POSTS PROGRAMADOS COM CLAIM ATÔMICO E INTEGRIDADE DE TENANT)
create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid not null,
  post_type text not null check (post_type in ('reel', 'carousel')),
  media_id uuid,
  carousel_id uuid,
  queue_id uuid,
  queue_item_id uuid,
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
  updated_at timestamptz not null default now(),
  constraint uq_scheduled_posts_id_user unique (id, user_id),
  constraint fk_scheduled_posts_account foreign key (instagram_account_id, user_id) references public.instagram_accounts(id, user_id) on delete cascade,
  constraint fk_scheduled_posts_media foreign key (media_id, user_id) references public.media(id, user_id) on delete set null (media_id),
  constraint fk_scheduled_posts_carousel foreign key (carousel_id, user_id) references public.carousels(id, user_id) on delete set null (carousel_id),
  constraint fk_scheduled_posts_queue foreign key (queue_id, user_id) references public.reel_queues(id, user_id) on delete set null (queue_id),
  constraint fk_scheduled_posts_queue_item foreign key (queue_item_id, user_id) references public.reel_queue_items(id, user_id) on delete set null (queue_item_id)
);

-- Proteção de Idempotência Definitiva: um queue_item_id só pode gerar no máximo UM scheduled_post em toda sua vida útil
create unique index if not exists uq_scheduled_posts_queue_item
  on public.scheduled_posts (queue_item_id)
  where queue_item_id is not null;

-- 2.9 PUBLISHED_POSTS (HISTÓRICO PERMANENTE COM IDEMPOTÊNCIA COMPROVADA)
create table if not exists public.published_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid not null,
  scheduled_post_id uuid,
  media_type text not null check (media_type in ('reel', 'carousel')),
  instagram_media_id text not null,
  permalink text,
  caption text default '',
  published_at timestamptz not null default now(),
  status text not null default 'published',
  created_at timestamptz not null default now(),
  constraint uq_published_posts_id_user unique (id, user_id),
  constraint fk_published_posts_account foreign key (instagram_account_id, user_id) references public.instagram_accounts(id, user_id) on delete cascade,
  constraint fk_published_posts_scheduled foreign key (scheduled_post_id, user_id) references public.scheduled_posts(id, user_id) on delete set null (scheduled_post_id),
  -- Proteção contra duplicação acidental
  constraint uq_published_posts_scheduled_post unique (scheduled_post_id),
  constraint uq_published_posts_account_ig_media unique (instagram_account_id, instagram_media_id)
);

-- 2.10 PUBLICATION_ATTEMPTS (TENTATIVAS E RETRIES DETALHADOS COM IDEMPOTÊNCIA)
create table if not exists public.publication_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_post_id uuid not null,
  attempt_number integer not null default 1,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  success boolean not null default false,
  error_code text,
  error_message text,
  retryable boolean not null default true,
  created_at timestamptz not null default now(),
  constraint fk_publication_attempts_post foreign key (scheduled_post_id, user_id) references public.scheduled_posts(id, user_id) on delete cascade,
  constraint uq_publication_attempts_post_attempt unique (scheduled_post_id, attempt_number)
);

-- 2.11 ERROR_LOGS (LOGS TÉCNICOS SEM SEGREDOS)
create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid,
  scheduled_post_id uuid,
  severity text not null default 'error' check (severity in ('warning', 'error', 'critical')),
  category text not null check (category in ('oauth', 'token', 'upload', 'media_processing', 'publishing', 'storage', 'scheduler', 'analytics', 'database')),
  error_code text not null,
  message text not null,
  technical_details text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint fk_error_logs_account foreign key (instagram_account_id, user_id) references public.instagram_accounts(id, user_id) on delete set null (instagram_account_id),
  constraint fk_error_logs_scheduled foreign key (scheduled_post_id, user_id) references public.scheduled_posts(id, user_id) on delete set null (scheduled_post_id)
);

-- 2.12 NOTIFICATIONS (ALERTAS E NOTIFICAÇÕES DO SISTEMA)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid,
  type text not null check (type in ('account_connected', 'account_disconnected', 'token_reconnect_required', 'publish_success', 'publish_failed', 'queue_completed', 'queue_paused')),
  title text not null,
  message text not null,
  read boolean not null default false,
  link text,
  created_at timestamptz not null default now(),
  constraint fk_notifications_account foreign key (instagram_account_id, user_id) references public.instagram_accounts(id, user_id) on delete cascade
);

-- 2.13 ACCOUNT_METRICS (MÉTRICAS DA CONTA VIA GRAPH API COM SNAPSHOT DIÁRIO)
create table if not exists public.account_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid not null,
  date date not null default current_date,
  followers_count bigint default 0,
  media_count bigint default 0,
  reach bigint,
  impressions bigint,
  profile_views bigint,
  website_clicks bigint,
  raw_data jsonb,
  recorded_at timestamptz not null default now(),
  constraint fk_account_metrics_account foreign key (instagram_account_id, user_id) references public.instagram_accounts(id, user_id) on delete cascade,
  constraint uq_account_metrics_account_date unique (instagram_account_id, date)
);

-- 2.14 MEDIA_METRICS (MÉTRICAS COM SNAPSHOT DIÁRIO CONTROLADO)
-- Adicionado snapshot_date e unique (published_post_id, snapshot_date) para impedir crescimento descontrolado.
create table if not exists public.media_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid not null,
  published_post_id uuid not null,
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
  snapshot_date date not null default current_date,
  recorded_at timestamptz not null default now(),
  constraint fk_media_metrics_account foreign key (instagram_account_id, user_id) references public.instagram_accounts(id, user_id) on delete cascade,
  constraint fk_media_metrics_published foreign key (published_post_id, user_id) references public.published_posts(id, user_id) on delete cascade,
  constraint uq_media_metrics_post_date unique (published_post_id, snapshot_date)
);

-- ==============================================================================
-- 2.15 MÓDULO DE MONITORAMENTO DE PERFIS (SEM SCRAPING / ARQUITETURA OFICIAL META)
-- ==============================================================================

-- 2.15.1 MONITORING_FOLDERS (PASTAS / NICHOS ORGANIZACIONAIS)
create table if not exists public.monitoring_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  color text default '#6366F1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_monitoring_folders_id_user unique (id, user_id)
);

-- 2.15.2 MONITORED_PROFILES (PERFIS EXTERNOS MONITORADOS)
create table if not exists public.monitored_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid,
  username text not null,
  profile_url text,
  display_name text,
  platform text not null default 'instagram',
  status text not null default 'pending_setup' check (status in ('active', 'paused', 'pending_setup', 'error')),
  notes text,
  created_at timestamptz not null default now(),
  last_sync_at timestamptz,
  constraint uq_monitored_profiles_id_user unique (id, user_id),
  constraint uq_monitored_profiles_user_username unique (user_id, username),
  constraint fk_monitored_profiles_folder foreign key (folder_id, user_id) references public.monitoring_folders(id, user_id) on delete set null (folder_id)
);

-- 2.15.3 MONITORED_PROFILE_SNAPSHOTS (HISTÓRICO ENXUTO DE 30 DIAS)
create table if not exists public.monitored_profile_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  monitored_profile_id uuid not null,
  followers_count bigint default 0,
  following_count bigint default 0,
  media_count bigint default 0,
  snapshot_date date not null default current_date,
  recorded_at timestamptz not null default now(),
  constraint fk_monitored_profile_snapshots_profile foreign key (monitored_profile_id, user_id) references public.monitored_profiles(id, user_id) on delete cascade,
  constraint uq_monitored_profile_snapshot_date unique (monitored_profile_id, snapshot_date)
);

-- 2.15.4 MONITORED_MEDIA_SNAPSHOTS (METADADOS E PERMALINKS SEM DUPLICAÇÃO)
create table if not exists public.monitored_media_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  monitored_profile_id uuid not null,
  instagram_media_id text not null,
  permalink text,
  media_type text,
  caption text,
  like_count bigint default 0,
  comments_count bigint default 0,
  posted_at timestamptz,
  snapshot_date date not null default current_date,
  recorded_at timestamptz not null default now(),
  constraint fk_monitored_media_snapshots_profile foreign key (monitored_profile_id, user_id) references public.monitored_profiles(id, user_id) on delete cascade,
  constraint uq_monitored_media_profile_media_date unique (monitored_profile_id, instagram_media_id, snapshot_date)
);

-- ==============================================================================
-- 3. ÍNDICES DE ALTO DESEMPENHO
-- ==============================================================================
create index if not exists idx_scheduled_posts_status_scheduled_at
  on public.scheduled_posts (status, scheduled_at);

create index if not exists idx_instagram_accounts_user_id
  on public.instagram_accounts (user_id);

create index if not exists idx_media_user_account
  on public.media (user_id, instagram_account_id);

create index if not exists idx_media_retention
  on public.media (retention_status, delete_after);

create index if not exists idx_error_logs_user_created
  on public.error_logs (user_id, created_at desc);

create index if not exists idx_published_posts_user_published
  on public.published_posts (user_id, published_at desc);

create index if not exists idx_account_metrics_account_date
  on public.account_metrics (instagram_account_id, date desc);

create index if not exists idx_media_metrics_post_recorded
  on public.media_metrics (published_post_id, snapshot_date desc);

create index if not exists idx_monitored_profiles_user_folder
  on public.monitored_profiles (user_id, folder_id);

create index if not exists idx_monitored_profile_snapshots_profile_date
  on public.monitored_profile_snapshots (monitored_profile_id, snapshot_date desc);

create index if not exists idx_monitored_media_snapshots_profile_date
  on public.monitored_media_snapshots (monitored_profile_id, snapshot_date desc);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) E POLÍTICAS ESTRITAS DE ACESSO
-- ==============================================================================
-- Isolamento total: auth.uid() = user_id (ou id em profiles).
-- Usuários com role admin ou developer NÃO ignoram o isolamento de dados privados.

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
alter table public.monitoring_folders enable row level security;
alter table public.monitored_profiles enable row level security;
alter table public.monitored_profile_snapshots enable row level security;
alter table public.monitored_media_snapshots enable row level security;

-- ------------------------------------------------------------------------------
-- 4.1 PROFILES: SOMENTE LEITURA PRÓPRIA (SEM INSERT/UPDATE/DELETE POR CLIENTE)
-- ------------------------------------------------------------------------------
-- Impede escalação de role: a coluna 'role' só é alterável por service_role/administração backend.
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Usuários podem ver seu próprio perfil" on public.profiles;
drop policy if exists "Usuários podem atualizar seu próprio perfil" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- 4.2 TABELAS GERADAS PELO SISTEMA (SOMENTE LEITURA PARA AUTHENTICATED)
-- ------------------------------------------------------------------------------
-- Inserções, atualizações e exclusões são executadas exclusivamente pelo backend/service_role.

-- INSTAGRAM_ACCOUNTS (Conexão e tokens geridos via OAuth server-side)
drop policy if exists "instagram_accounts_select_own" on public.instagram_accounts;
drop policy if exists "instagram_accounts_insert_own" on public.instagram_accounts;
drop policy if exists "instagram_accounts_update_own" on public.instagram_accounts;
drop policy if exists "instagram_accounts_delete_own" on public.instagram_accounts;
create policy "instagram_accounts_select_own" on public.instagram_accounts for select using (auth.uid() = user_id);

-- PUBLISHED_POSTS (Criados pelo scheduler após confirmação da Meta)
drop policy if exists "published_posts_select_own" on public.published_posts;
drop policy if exists "published_posts_insert_own" on public.published_posts;
drop policy if exists "published_posts_update_own" on public.published_posts;
drop policy if exists "published_posts_delete_own" on public.published_posts;
create policy "published_posts_select_own" on public.published_posts for select using (auth.uid() = user_id);

-- PUBLICATION_ATTEMPTS (Registros de tentativa do worker)
drop policy if exists "publication_attempts_select_own" on public.publication_attempts;
drop policy if exists "publication_attempts_insert_own" on public.publication_attempts;
drop policy if exists "publication_attempts_update_own" on public.publication_attempts;
drop policy if exists "publication_attempts_delete_own" on public.publication_attempts;
create policy "publication_attempts_select_own" on public.publication_attempts for select using (auth.uid() = user_id);

-- ERROR_LOGS (Logs técnicos gerados pelo sistema)
drop policy if exists "error_logs_select_own" on public.error_logs;
drop policy if exists "error_logs_insert_own" on public.error_logs;
drop policy if exists "error_logs_update_own" on public.error_logs;
drop policy if exists "error_logs_delete_own" on public.error_logs;
create policy "error_logs_select_own" on public.error_logs for select using (auth.uid() = user_id);

-- ACCOUNT_METRICS (Sincronizadas via Graph API pelo backend)
drop policy if exists "account_metrics_select_own" on public.account_metrics;
drop policy if exists "account_metrics_insert_own" on public.account_metrics;
drop policy if exists "account_metrics_update_own" on public.account_metrics;
drop policy if exists "account_metrics_delete_own" on public.account_metrics;
create policy "account_metrics_select_own" on public.account_metrics for select using (auth.uid() = user_id);

-- MEDIA_METRICS (Coletadas via Graph API pelo backend)
drop policy if exists "media_metrics_select_own" on public.media_metrics;
drop policy if exists "media_metrics_insert_own" on public.media_metrics;
drop policy if exists "media_metrics_update_own" on public.media_metrics;
drop policy if exists "media_metrics_delete_own" on public.media_metrics;
create policy "media_metrics_select_own" on public.media_metrics for select using (auth.uid() = user_id);

-- MONITORED_PROFILE_SNAPSHOTS (Coletadas pelo job de monitoramento)
drop policy if exists "monitored_profile_snapshots_select_own" on public.monitored_profile_snapshots;
drop policy if exists "monitored_profile_snapshots_insert_own" on public.monitored_profile_snapshots;
drop policy if exists "monitored_profile_snapshots_update_own" on public.monitored_profile_snapshots;
drop policy if exists "monitored_profile_snapshots_delete_own" on public.monitored_profile_snapshots;
create policy "monitored_profile_snapshots_select_own" on public.monitored_profile_snapshots for select using (auth.uid() = user_id);

-- MONITORED_MEDIA_SNAPSHOTS (Coletadas pelo job de monitoramento)
drop policy if exists "monitored_media_snapshots_select_own" on public.monitored_media_snapshots;
drop policy if exists "monitored_media_snapshots_insert_own" on public.monitored_media_snapshots;
drop policy if exists "monitored_media_snapshots_update_own" on public.monitored_media_snapshots;
drop policy if exists "monitored_media_snapshots_delete_own" on public.monitored_media_snapshots;
create policy "monitored_media_snapshots_select_own" on public.monitored_media_snapshots for select using (auth.uid() = user_id);

-- NOTIFICATIONS (Alertas gerados pelo sistema; o usuário possui exclusivamente permissão de consulta)
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_insert_own" on public.notifications;
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 4.3 TABELAS GERENCIADAS DIRETAMENTE PELO USUÁRIO (CRUD PRÓPRIO COMPLETO)
-- ------------------------------------------------------------------------------

-- MEDIA
drop policy if exists "media_select_own" on public.media;
drop policy if exists "media_insert_own" on public.media;
drop policy if exists "media_update_own" on public.media;
drop policy if exists "media_delete_own" on public.media;
create policy "media_select_own" on public.media for select using (auth.uid() = user_id);
create policy "media_insert_own" on public.media for insert with check (auth.uid() = user_id);
create policy "media_update_own" on public.media for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "media_delete_own" on public.media for delete using (auth.uid() = user_id);

-- REEL_QUEUES
drop policy if exists "reel_queues_select_own" on public.reel_queues;
drop policy if exists "reel_queues_insert_own" on public.reel_queues;
drop policy if exists "reel_queues_update_own" on public.reel_queues;
drop policy if exists "reel_queues_delete_own" on public.reel_queues;
create policy "reel_queues_select_own" on public.reel_queues for select using (auth.uid() = user_id);
create policy "reel_queues_insert_own" on public.reel_queues for insert with check (auth.uid() = user_id);
create policy "reel_queues_update_own" on public.reel_queues for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reel_queues_delete_own" on public.reel_queues for delete using (auth.uid() = user_id);

-- REEL_QUEUE_ITEMS
drop policy if exists "reel_queue_items_select_own" on public.reel_queue_items;
drop policy if exists "reel_queue_items_insert_own" on public.reel_queue_items;
drop policy if exists "reel_queue_items_update_own" on public.reel_queue_items;
drop policy if exists "reel_queue_items_delete_own" on public.reel_queue_items;
create policy "reel_queue_items_select_own" on public.reel_queue_items for select using (auth.uid() = user_id);
create policy "reel_queue_items_insert_own" on public.reel_queue_items for insert with check (auth.uid() = user_id);
create policy "reel_queue_items_update_own" on public.reel_queue_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reel_queue_items_delete_own" on public.reel_queue_items for delete using (auth.uid() = user_id);

-- CAROUSELS
drop policy if exists "carousels_select_own" on public.carousels;
drop policy if exists "carousels_insert_own" on public.carousels;
drop policy if exists "carousels_update_own" on public.carousels;
drop policy if exists "carousels_delete_own" on public.carousels;
create policy "carousels_select_own" on public.carousels for select using (auth.uid() = user_id);
create policy "carousels_insert_own" on public.carousels for insert with check (auth.uid() = user_id);
create policy "carousels_update_own" on public.carousels for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "carousels_delete_own" on public.carousels for delete using (auth.uid() = user_id);

-- CAROUSEL_ITEMS
drop policy if exists "carousel_items_select_own" on public.carousel_items;
drop policy if exists "carousel_items_insert_own" on public.carousel_items;
drop policy if exists "carousel_items_update_own" on public.carousel_items;
drop policy if exists "carousel_items_delete_own" on public.carousel_items;
create policy "carousel_items_select_own" on public.carousel_items for select using (auth.uid() = user_id);
create policy "carousel_items_insert_own" on public.carousel_items for insert with check (auth.uid() = user_id);
create policy "carousel_items_update_own" on public.carousel_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "carousel_items_delete_own" on public.carousel_items for delete using (auth.uid() = user_id);

-- SCHEDULES
drop policy if exists "schedules_select_own" on public.schedules;
drop policy if exists "schedules_insert_own" on public.schedules;
drop policy if exists "schedules_update_own" on public.schedules;
drop policy if exists "schedules_delete_own" on public.schedules;
create policy "schedules_select_own" on public.schedules for select using (auth.uid() = user_id);
create policy "schedules_insert_own" on public.schedules for insert with check (auth.uid() = user_id);
create policy "schedules_update_own" on public.schedules for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "schedules_delete_own" on public.schedules for delete using (auth.uid() = user_id);

-- SCHEDULED_POSTS
drop policy if exists "scheduled_posts_select_own" on public.scheduled_posts;
drop policy if exists "scheduled_posts_insert_own" on public.scheduled_posts;
drop policy if exists "scheduled_posts_update_own" on public.scheduled_posts;
drop policy if exists "scheduled_posts_delete_own" on public.scheduled_posts;
create policy "scheduled_posts_select_own" on public.scheduled_posts for select using (auth.uid() = user_id);
create policy "scheduled_posts_insert_own" on public.scheduled_posts for insert with check (auth.uid() = user_id);
create policy "scheduled_posts_update_own" on public.scheduled_posts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "scheduled_posts_delete_own" on public.scheduled_posts for delete using (auth.uid() = user_id);

-- MONITORING_FOLDERS
drop policy if exists "monitoring_folders_select_own" on public.monitoring_folders;
drop policy if exists "monitoring_folders_insert_own" on public.monitoring_folders;
drop policy if exists "monitoring_folders_update_own" on public.monitoring_folders;
drop policy if exists "monitoring_folders_delete_own" on public.monitoring_folders;
create policy "monitoring_folders_select_own" on public.monitoring_folders for select using (auth.uid() = user_id);
create policy "monitoring_folders_insert_own" on public.monitoring_folders for insert with check (auth.uid() = user_id);
create policy "monitoring_folders_update_own" on public.monitoring_folders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "monitoring_folders_delete_own" on public.monitoring_folders for delete using (auth.uid() = user_id);

-- MONITORED_PROFILES
drop policy if exists "monitored_profiles_select_own" on public.monitored_profiles;
drop policy if exists "monitored_profiles_insert_own" on public.monitored_profiles;
drop policy if exists "monitored_profiles_update_own" on public.monitored_profiles;
drop policy if exists "monitored_profiles_delete_own" on public.monitored_profiles;
create policy "monitored_profiles_select_own" on public.monitored_profiles for select using (auth.uid() = user_id);
create policy "monitored_profiles_insert_own" on public.monitored_profiles for insert with check (auth.uid() = user_id);
create policy "monitored_profiles_update_own" on public.monitored_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "monitored_profiles_delete_own" on public.monitored_profiles for delete using (auth.uid() = user_id);

-- ==============================================================================
-- 5. FUNÇÃO DE CLAIM ATÔMICO DE POSTS PARA O SCHEDULER (CONCORRÊNCIA SEGURA)
-- ==============================================================================
-- Utiliza FOR UPDATE SKIP LOCKED no PostgreSQL para garantir que nenhum post
-- seja processado por dois workers simultaneamente.
-- SECURITY INVOKER: Invocada exclusivamente pelo backend (service_role) com privilégios de invocador.
-- search_path propositalmente vazio ('') com qualificação explícita de esquemas e tipos.
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
      (status = 'scheduled' and scheduled_at <= v_now)
      or (status = 'processing' and locked_at < v_now - (p_lock_duration_minutes || ' minutes')::pg_catalog.interval)
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

-- Permite EXCLUSIVAMENTE ao service_role invocar a função de claim
-- É proibido conceder acesso a authenticated ou anon para prevenir execução direta por usuários
revoke execute on function public.claim_scheduled_posts(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_scheduled_posts(text, integer, integer) to service_role;
