-- Fluxo de autorização de conexão MenuJunior ↔ DeliveryPlus.
-- O código é armazenado como hash e expira em 10 minutos.
create table if not exists public.menujunior_oauth_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  redirect_uri text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.menujunior_oauth_codes enable row level security;
-- Acesso exclusivo via service role nas Edge Functions.
