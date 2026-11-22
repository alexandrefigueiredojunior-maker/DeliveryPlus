-- Hash do segredo compartilhado MenuJunior <-> DeliveryPlus.
-- O valor em texto puro existe apenas como variável criptografada na Vercel.
create table if not exists public.menujunior_integration_secrets (
  id boolean primary key default true check (id = true),
  client_secret_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.menujunior_integration_secrets enable row level security;