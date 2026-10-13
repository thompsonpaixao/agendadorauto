-- Migration 6: Adiciona colunas para separação de frequências e horários de Carrosséis em public.instagram_accounts
-- Permite controle independente de quantidade e slots de horário para Reels e Carrosséis.

alter table public.instagram_accounts
  add column if not exists default_carousels_per_day integer not null default 1,
  add column if not exists default_carousel_post_times jsonb not null default '["18:00"]'::jsonb;
