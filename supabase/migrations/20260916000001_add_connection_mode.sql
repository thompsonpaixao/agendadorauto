-- LEGACY - DO NOT EXECUTE
-- ==============================================================================
-- MIGRAÇÃO: ADICIONAR COLUNA CONNECTION_MODE EM ACCOUNTS
-- ==============================================================================
-- Diferencia conexões em Modo Desenvolvimento (Standard Access / Instagram Tester)
-- de conexões em Modo Externo (Advanced Access após App Review da Meta).
-- ==============================================================================

alter table public.accounts
  add column if not exists connection_mode text default 'development'
  check (connection_mode in ('development', 'external'));

comment on column public.accounts.connection_mode is
  'Modo de conexão da conta: development (Instagram Tester) ou external (OAuth público após App Review).';
