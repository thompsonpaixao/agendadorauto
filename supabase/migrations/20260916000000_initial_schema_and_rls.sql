-- LEGACY - DO NOT EXECUTE
-- ==============================================================================
-- AGENDADOR SAAS - SUPABASE DATABASE SCHEMA & ROW LEVEL SECURITY (RLS)
-- ==============================================================================
-- Este script define a estrutura de dados relacional e as políticas de segurança
-- multiusuário para o Agendador. Cada dado pertence estritamente ao seu criador
-- através da coluna `user_id`, impedindo que usuários vejam ou alterem dados de outros.
-- ==============================================================================

-- 1. EXTENSÕES
create extension if not exists "uuid-ossp";

-- 2. TABELA DE PERFIS DE USUÁRIO (Sincronizada com auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'developer', 'admin')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Trigger para criar perfil automaticamente no cadastro (ex: Google OAuth ou Email)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', ''),
    'user'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = coalesce(excluded.name, public.profiles.name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. TABELA DE CONTAS CONECTADAS DO INSTAGRAM
create table if not exists public.accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  instagram_user_id text,
  username text not null,
  name text not null,
  profile_picture text,
  status text default 'connected' check (status in ('connected', 'expired', 'error', 'paused')),
  status_message text,
  followers integer default 0,
  new_followers_today integer default 0,
  posts_today integer default 0,
  posts_in_queue integer default 0,
  posts_last_7_days integer default 0,
  success_rate numeric(5,2) default 100.0,
  errors_count integer default 0,
  default_reel_caption text default '',
  default_carousel_caption text default '',
  default_reels_per_day integer default 1,
  default_carousels_per_day integer default 1,
  default_times jsonb default '["10:00", "15:00", "20:00"]'::jsonb,
  use_random_time_variation boolean default true,
  random_variation_minutes integer default 7,
  last_published_at timestamptz,
  next_scheduled_at timestamptz,
  access_token text,
  token_expires_at timestamptz,
  connection_mode text default 'development' check (connection_mode in ('development', 'external')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, instagram_user_id)
);

create index if not exists idx_accounts_user_id on public.accounts(user_id);
create index if not exists idx_accounts_username on public.accounts(username);

-- 4. TABELA DE REPOSITÓRIO DE MÍDIAS (VÍDEOS E IMAGENS DO PERFIL)
create table if not exists public.media (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade not null,
  name text not null,
  url text not null,
  thumbnail_url text,
  type text check (type in ('video', 'image')) not null,
  size_bytes bigint default 0,
  duration_seconds numeric(6,2),
  caption text,
  position integer default 0,
  status text default 'ready' check (status in ('ready', 'processing', 'uploaded', 'error')),
  created_at timestamptz default now() not null
);

create index if not exists idx_media_user_id on public.media(user_id);
create index if not exists idx_media_account_id on public.media(account_id);

-- 5. TABELA DE FILAS DE REELS
create table if not exists public.reel_queues (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade not null,
  name text not null,
  total_videos integer default 0,
  published_count integer default 0,
  remaining_count integer default 0,
  error_count integer default 0,
  status text default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  caption_mode text default 'profile_default',
  custom_caption text,
  posts_per_day integer default 1,
  daily_times jsonb default '["10:00"]'::jsonb,
  distribute_until_empty boolean default true,
  start_date timestamptz default now(),
  next_scheduled_at timestamptz,
  estimated_finish_at timestamptz,
  created_at timestamptz default now() not null
);

create index if not exists idx_reel_queues_user_id on public.reel_queues(user_id);
create index if not exists idx_reel_queues_account_id on public.reel_queues(account_id);

-- 6. TABELA DE CARROSSÉIS
create table if not exists public.carousels (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade not null,
  title text not null,
  position integer default 0,
  slides jsonb default '[]'::jsonb not null,
  caption text,
  scheduled_at timestamptz,
  status text default 'draft' check (status in ('draft', 'scheduled', 'queued', 'published', 'error')),
  created_at timestamptz default now() not null
);

create index if not exists idx_carousels_user_id on public.carousels(user_id);
create index if not exists idx_carousels_account_id on public.carousels(account_id);

-- 7. TABELA DE PUBLICAÇÕES AGENDADAS (CRONOGRAMA / AGENDA)
create table if not exists public.scheduled_posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade not null,
  type text check (type in ('reel', 'carousel')) not null,
  title text not null,
  caption text default '',
  scheduled_at timestamptz not null,
  thumbnail_url text,
  media_url text,
  slides_count integer default 1,
  status text default 'scheduled' check (status in ('draft', 'scheduled', 'queued', 'sending', 'processing', 'published', 'error', 'cancelled')),
  queue_id uuid,
  history jsonb default '[]'::jsonb,
  created_at timestamptz default now() not null
);

create index if not exists idx_scheduled_posts_user_id on public.scheduled_posts(user_id);
create index if not exists idx_scheduled_posts_account_id on public.scheduled_posts(account_id);
create index if not exists idx_scheduled_posts_scheduled_at on public.scheduled_posts(scheduled_at);

-- 8. TABELA DE PUBLICAÇÕES CONCLUÍDAS (HISTÓRICO DE PUBLICADOS)
create table if not exists public.published_posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade not null,
  type text check (type in ('reel', 'carousel')) not null,
  thumbnail_url text,
  media_url text,
  caption text default '',
  published_at timestamptz default now() not null,
  views integer default 0,
  reach integer default 0,
  likes integer default 0,
  comments integer default 0,
  shares integer default 0,
  saves integer default 0,
  profile_visits integer default 0,
  followers_gained integer default 0,
  watch_time_seconds numeric(8,2) default 0,
  status text default 'published' not null
);

create index if not exists idx_published_posts_user_id on public.published_posts(user_id);
create index if not exists idx_published_posts_account_id on public.published_posts(account_id);

-- 9. TABELA DE ERROS E DIAGNÓSTICOS DA META API
create table if not exists public.errors (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade not null,
  category text check (category in ('account', 'token', 'publish', 'media', 'api')) not null,
  severity text check (severity in ('critical', 'warning', 'resolved')) not null,
  post_type text check (post_type in ('reel', 'carousel')),
  post_title text,
  media_url text,
  error_code text not null,
  error_message text not null,
  technical_details text,
  attempts integer default 1,
  last_attempt_at timestamptz default now(),
  status text default 'pending' check (status in ('pending', 'retrying', 'resolved', 'ignored')),
  suggested_action text default 'retry',
  created_at timestamptz default now() not null
);

create index if not exists idx_errors_user_id on public.errors(user_id);
create index if not exists idx_errors_account_id on public.errors(account_id);

-- 10. TABELA DE ANALYTICS ACUMULADOS
create table if not exists public.analytics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade not null,
  date date not null,
  views integer default 0,
  reach integer default 0,
  engagement_rate numeric(5,2) default 0.0,
  followers_count integer default 0,
  created_at timestamptz default now() not null,
  unique (account_id, date)
);

create index if not exists idx_analytics_user_id on public.analytics(user_id);
create index if not exists idx_analytics_account_id on public.analytics(account_id);

-- ==============================================================================
-- ATIVAÇÃO DE ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.media enable row level security;
alter table public.reel_queues enable row level security;
alter table public.carousels enable row level security;
alter table public.scheduled_posts enable row level security;
alter table public.published_posts enable row level security;
alter table public.errors enable row level security;
alter table public.analytics enable row level security;

-- ==============================================================================
-- POLÍTICAS DE RLS (ISOLAMENTO MULTIUSUÁRIO BASEADO EM auth.uid() = user_id)
-- ==============================================================================

-- PROFILES
create policy "Usuários podem ver seu próprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Usuários podem atualizar seu próprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- ACCOUNTS
create policy "Usuários podem visualizar apenas suas contas"
  on public.accounts for select
  using (auth.uid() = user_id);

create policy "Usuários podem cadastrar contas"
  on public.accounts for insert
  with check (auth.uid() = user_id);

create policy "Usuários podem editar apenas suas contas"
  on public.accounts for update
  using (auth.uid() = user_id);

create policy "Usuários podem remover apenas suas contas"
  on public.accounts for delete
  using (auth.uid() = user_id);

-- MEDIA
create policy "Usuários podem ver apenas suas mídias"
  on public.media for select
  using (auth.uid() = user_id);

create policy "Usuários podem enviar mídias para suas contas"
  on public.media for insert
  with check (auth.uid() = user_id);

create policy "Usuários podem atualizar suas mídias"
  on public.media for update
  using (auth.uid() = user_id);

create policy "Usuários podem deletar suas mídias"
  on public.media for delete
  using (auth.uid() = user_id);

-- REEL_QUEUES
create policy "Usuários podem ver apenas suas filas de Reels"
  on public.reel_queues for select
  using (auth.uid() = user_id);

create policy "Usuários podem criar filas de Reels"
  on public.reel_queues for insert
  with check (auth.uid() = user_id);

create policy "Usuários podem atualizar suas filas de Reels"
  on public.reel_queues for update
  using (auth.uid() = user_id);

create policy "Usuários podem deletar suas filas de Reels"
  on public.reel_queues for delete
  using (auth.uid() = user_id);

-- CAROUSELS
create policy "Usuários podem ver apenas seus carrosséis"
  on public.carousels for select
  using (auth.uid() = user_id);

create policy "Usuários podem criar carrosséis"
  on public.carousels for insert
  with check (auth.uid() = user_id);

create policy "Usuários podem atualizar seus carrosséis"
  on public.carousels for update
  using (auth.uid() = user_id);

create policy "Usuários podem deletar seus carrosséis"
  on public.carousels for delete
  using (auth.uid() = user_id);

-- SCHEDULED_POSTS
create policy "Usuários podem ver apenas seus posts agendados"
  on public.scheduled_posts for select
  using (auth.uid() = user_id);

create policy "Usuários podem agendar posts"
  on public.scheduled_posts for insert
  with check (auth.uid() = user_id);

create policy "Usuários podem atualizar seus posts agendados"
  on public.scheduled_posts for update
  using (auth.uid() = user_id);

create policy "Usuários podem remover seus posts agendados"
  on public.scheduled_posts for delete
  using (auth.uid() = user_id);

-- PUBLISHED_POSTS
create policy "Usuários podem ver apenas seus posts publicados"
  on public.published_posts for select
  using (auth.uid() = user_id);

create policy "Usuários podem registrar posts publicados"
  on public.published_posts for insert
  with check (auth.uid() = user_id);

create policy "Usuários podem atualizar posts publicados"
  on public.published_posts for update
  using (auth.uid() = user_id);

-- ERRORS
create policy "Usuários podem ver apenas seus erros"
  on public.errors for select
  using (auth.uid() = user_id);

create policy "Usuários podem atualizar status dos seus erros"
  on public.errors for update
  using (auth.uid() = user_id);

-- ANALYTICS
create policy "Usuários podem ver apenas seus relatórios de analytics"
  on public.analytics for select
  using (auth.uid() = user_id);
