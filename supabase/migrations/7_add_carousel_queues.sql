-- Migration 7: Adiciona suporte completo a Filas de Carrosséis e Soft-Delete para Lixeira
-- Permite que carrosséis sejam organizados em filas persistentes (ativas/finalizadas) com relatórios detalhados.

-- 1. TABELA CAROUSEL_QUEUES (FILAS DE CARROSSÉIS POR PERFIL)
create table if not exists public.carousel_queues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_account_id uuid not null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'completed_with_errors', 'cancelled')),
  posts_per_day integer not null default 1,
  daily_times jsonb not null default '["18:00"]'::jsonb,
  use_random_variation boolean not null default true,
  random_variation_minutes integer not null default 5,
  start_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_carousel_queues_id_user unique (id, user_id),
  constraint fk_carousel_queues_account foreign key (instagram_account_id, user_id) references public.instagram_accounts(id, user_id) on delete cascade
);

-- 2. TABELA CAROUSEL_QUEUE_ITEMS (ITENS DA FILA DE CARROSSÉIS)
create table if not exists public.carousel_queue_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  queue_id uuid not null,
  carousel_id uuid not null,
  position integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'scheduled', 'processing', 'published', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_carousel_queue_items_id_user unique (id, user_id),
  constraint fk_carousel_queue_items_queue foreign key (queue_id, user_id) references public.carousel_queues(id, user_id) on delete cascade,
  constraint fk_carousel_queue_items_carousel foreign key (carousel_id, user_id) references public.carousels(id, user_id) on delete cascade
);

-- 3. ADICIONA VÍNCULO DE FILA DE CARROSSEL EM SCHEDULED_POSTS
alter table public.scheduled_posts
  add column if not exists carousel_queue_id uuid references public.carousel_queues(id) on delete set null,
  add column if not exists carousel_queue_item_id uuid references public.carousel_queue_items(id) on delete set null;

-- 4. ÍNDICE PARA SOFT-DELETE (LIXEIRA DE MÍDIAS)
alter table public.media
  add column if not exists deleted_at timestamptz default null;

create index if not exists idx_media_deleted_at
  on public.media(deleted_at);

create index if not exists idx_carousel_queues_account
  on public.carousel_queues(instagram_account_id, status);

create index if not exists idx_carousel_queue_items_queue
  on public.carousel_queue_items(queue_id, position);

-- 5. RLS NAS NOVAS TABELAS
alter table public.carousel_queues enable row level security;
alter table public.carousel_queue_items enable row level security;

-- Políticas para carousel_queues
create policy "carousel_queues_select_owner" on public.carousel_queues
  for select to authenticated
  using (auth.uid() = user_id);

create policy "carousel_queues_insert_owner" on public.carousel_queues
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "carousel_queues_update_owner" on public.carousel_queues
  for update to authenticated
  using (auth.uid() = user_id);

create policy "carousel_queues_delete_owner" on public.carousel_queues
  for delete to authenticated
  using (auth.uid() = user_id);

-- Políticas para carousel_queue_items
create policy "carousel_queue_items_select_owner" on public.carousel_queue_items
  for select to authenticated
  using (auth.uid() = user_id);

create policy "carousel_queue_items_insert_owner" on public.carousel_queue_items
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "carousel_queue_items_update_owner" on public.carousel_queue_items
  for update to authenticated
  using (auth.uid() = user_id);

create policy "carousel_queue_items_delete_owner" on public.carousel_queue_items
  for delete to authenticated
  using (auth.uid() = user_id);

-- Grants
grant all on public.carousel_queues to authenticated;
grant all on public.carousel_queues to service_role;
grant all on public.carousel_queue_items to authenticated;
grant all on public.carousel_queue_items to service_role;
