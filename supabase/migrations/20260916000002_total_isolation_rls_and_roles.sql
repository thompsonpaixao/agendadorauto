-- LEGACY - DO NOT EXECUTE
-- ==============================================================================
-- MIGRAÇÃO: ISOLAMENTO TOTAL MULTIUSUÁRIO & POLÍTICAS RLS ESTRITAS
-- ==============================================================================
-- 1. Toda informação privada pertence obrigatoriamente a auth.uid().
-- 2. Políticas RLS para SELECT, INSERT, UPDATE, DELETE em todas as 10 tabelas:
--    - accounts, media, reel_queues, carousels, carousel_items, scheduled_posts,
--      published_posts, error_logs, notifications, analytics.
-- 3. Tabela profiles com roles: 'user', 'developer', 'admin'.
-- 4. REGRA MANDATÓRIA: Usuários com role admin ou developer NÃO ignoram RLS
--    dos dados privados de outros usuários.
-- ==============================================================================

-- 1. TABELA PROFILES & ROLES
alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'developer', 'admin'));

comment on column public.profiles.role is
  'Papel do usuário: user (padrão), developer (acesso técnico) ou admin (gestão do SaaS). Admin/dev NÃO acessa dados privados de outros usuários.';

-- Atualiza trigger de novos usuários para incluir role padrão
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

-- 2. TABELAS ADICIONAIS NECESSÁRIAS
-- Carousel Items
create table if not exists public.carousel_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  carousel_id uuid references public.carousels(id) on delete cascade not null,
  media_url text not null,
  thumbnail_url text,
  position integer default 0 not null,
  type text default 'image' check (type in ('image', 'video')),
  created_at timestamptz default now() not null
);

create index if not exists idx_carousel_items_user_id on public.carousel_items(user_id);
create index if not exists idx_carousel_items_carousel_id on public.carousel_items(carousel_id);

-- Error Logs
create table if not exists public.error_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade not null,
  category text not null,
  severity text default 'warning' check (severity in ('critical', 'warning', 'resolved')),
  post_type text,
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

create index if not exists idx_error_logs_user_id on public.error_logs(user_id);
create index if not exists idx_error_logs_account_id on public.error_logs(account_id);

-- Notifications
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade,
  title text not null,
  message text not null,
  type text default 'info' check (type in ('info', 'success', 'warning', 'error')),
  read boolean default false not null,
  created_at timestamptz default now() not null
);

create index if not exists idx_notifications_user_id on public.notifications(user_id);

-- 3. HABILITAÇÃO OBRIGATÓRIA DE RLS
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.media enable row level security;
alter table public.reel_queues enable row level security;
alter table public.carousels enable row level security;
alter table public.carousel_items enable row level security;
alter table public.scheduled_posts enable row level security;
alter table public.published_posts enable row level security;
alter table public.error_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.analytics enable row level security;

-- 4. POLÍTICAS ESTRITAS DE ISOLAMENTO TOTAL (auth.uid() = user_id)
-- Nenhum admin/developer ignora estas regras. Todos os acessos são isolados.

-- PROFILES
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ACCOUNTS
drop policy if exists "accounts_select_own" on public.accounts;
create policy "accounts_select_own" on public.accounts
  for select using (auth.uid() = user_id);

drop policy if exists "accounts_insert_own" on public.accounts;
create policy "accounts_insert_own" on public.accounts
  for insert with check (auth.uid() = user_id);

drop policy if exists "accounts_update_own" on public.accounts;
create policy "accounts_update_own" on public.accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "accounts_delete_own" on public.accounts;
create policy "accounts_delete_own" on public.accounts
  for delete using (auth.uid() = user_id);

-- MEDIA
drop policy if exists "media_select_own" on public.media;
create policy "media_select_own" on public.media
  for select using (auth.uid() = user_id);

drop policy if exists "media_insert_own" on public.media;
create policy "media_insert_own" on public.media
  for insert with check (auth.uid() = user_id);

drop policy if exists "media_update_own" on public.media;
create policy "media_update_own" on public.media
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "media_delete_own" on public.media;
create policy "media_delete_own" on public.media
  for delete using (auth.uid() = user_id);

-- REEL_QUEUES
drop policy if exists "reel_queues_select_own" on public.reel_queues;
create policy "reel_queues_select_own" on public.reel_queues
  for select using (auth.uid() = user_id);

drop policy if exists "reel_queues_insert_own" on public.reel_queues;
create policy "reel_queues_insert_own" on public.reel_queues
  for insert with check (auth.uid() = user_id);

drop policy if exists "reel_queues_update_own" on public.reel_queues;
create policy "reel_queues_update_own" on public.reel_queues
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reel_queues_delete_own" on public.reel_queues;
create policy "reel_queues_delete_own" on public.reel_queues
  for delete using (auth.uid() = user_id);

-- CAROUSELS
drop policy if exists "carousels_select_own" on public.carousels;
create policy "carousels_select_own" on public.carousels
  for select using (auth.uid() = user_id);

drop policy if exists "carousels_insert_own" on public.carousels;
create policy "carousels_insert_own" on public.carousels
  for insert with check (auth.uid() = user_id);

drop policy if exists "carousels_update_own" on public.carousels;
create policy "carousels_update_own" on public.carousels
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "carousels_delete_own" on public.carousels;
create policy "carousels_delete_own" on public.carousels
  for delete using (auth.uid() = user_id);

-- CAROUSEL_ITEMS
drop policy if exists "carousel_items_select_own" on public.carousel_items;
create policy "carousel_items_select_own" on public.carousel_items
  for select using (auth.uid() = user_id);

drop policy if exists "carousel_items_insert_own" on public.carousel_items;
create policy "carousel_items_insert_own" on public.carousel_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "carousel_items_update_own" on public.carousel_items;
create policy "carousel_items_update_own" on public.carousel_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "carousel_items_delete_own" on public.carousel_items;
create policy "carousel_items_delete_own" on public.carousel_items
  for delete using (auth.uid() = user_id);

-- SCHEDULED_POSTS
drop policy if exists "scheduled_posts_select_own" on public.scheduled_posts;
create policy "scheduled_posts_select_own" on public.scheduled_posts
  for select using (auth.uid() = user_id);

drop policy if exists "scheduled_posts_insert_own" on public.scheduled_posts;
create policy "scheduled_posts_insert_own" on public.scheduled_posts
  for insert with check (auth.uid() = user_id);

drop policy if exists "scheduled_posts_update_own" on public.scheduled_posts;
create policy "scheduled_posts_update_own" on public.scheduled_posts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "scheduled_posts_delete_own" on public.scheduled_posts;
create policy "scheduled_posts_delete_own" on public.scheduled_posts
  for delete using (auth.uid() = user_id);

-- PUBLISHED_POSTS
drop policy if exists "published_posts_select_own" on public.published_posts;
create policy "published_posts_select_own" on public.published_posts
  for select using (auth.uid() = user_id);

drop policy if exists "published_posts_insert_own" on public.published_posts;
create policy "published_posts_insert_own" on public.published_posts
  for insert with check (auth.uid() = user_id);

drop policy if exists "published_posts_update_own" on public.published_posts;
create policy "published_posts_update_own" on public.published_posts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "published_posts_delete_own" on public.published_posts;
create policy "published_posts_delete_own" on public.published_posts
  for delete using (auth.uid() = user_id);

-- ERROR_LOGS
drop policy if exists "error_logs_select_own" on public.error_logs;
create policy "error_logs_select_own" on public.error_logs
  for select using (auth.uid() = user_id);

drop policy if exists "error_logs_insert_own" on public.error_logs;
create policy "error_logs_insert_own" on public.error_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "error_logs_update_own" on public.error_logs;
create policy "error_logs_update_own" on public.error_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "error_logs_delete_own" on public.error_logs;
create policy "error_logs_delete_own" on public.error_logs
  for delete using (auth.uid() = user_id);

-- NOTIFICATIONS
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own" on public.notifications
  for insert with check (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete using (auth.uid() = user_id);

-- ANALYTICS
drop policy if exists "analytics_select_own" on public.analytics;
create policy "analytics_select_own" on public.analytics
  for select using (auth.uid() = user_id);

drop policy if exists "analytics_insert_own" on public.analytics;
create policy "analytics_insert_own" on public.analytics
  for insert with check (auth.uid() = user_id);

drop policy if exists "analytics_update_own" on public.analytics;
create policy "analytics_update_own" on public.analytics
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "analytics_delete_own" on public.analytics;
create policy "analytics_delete_own" on public.analytics
  for delete using (auth.uid() = user_id);
