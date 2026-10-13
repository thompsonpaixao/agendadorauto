-- Migration 5: Adiciona a coluna token_auth_tag em public.instagram_account_secrets
-- Necessária para persistir o authentication tag gerado pelo algoritmo AES-256-GCM.
-- Preserva todos os registros e colunas existentes sem perda de dados.

alter table public.instagram_account_secrets
  add column if not exists token_auth_tag text;
