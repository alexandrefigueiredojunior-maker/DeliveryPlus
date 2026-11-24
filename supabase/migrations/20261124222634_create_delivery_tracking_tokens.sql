create table if not exists public.rastreamento_entregas (
  id uuid primary key default gen_random_uuid(),
  entrega_id uuid not null references public.entregas(id) on delete cascade,
  token_hash text not null,
  token_ciphertext text not null,
  ativo boolean not null default true,
  expira_em timestamptz not null,
  iniciado_em timestamptz not null default now(),
  encerrado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rastreamento_entregas_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$')
);

create unique index if not exists rastreamento_entregas_token_hash_uidx
  on public.rastreamento_entregas (token_hash);

create unique index if not exists rastreamento_entregas_ativo_por_entrega_uidx
  on public.rastreamento_entregas (entrega_id)
  where ativo = true;

create index if not exists rastreamento_entregas_expira_em_idx
  on public.rastreamento_entregas (expira_em)
  where ativo = true;

alter table public.rastreamento_entregas enable row level security;

revoke all on table public.rastreamento_entregas from public, anon, authenticated;
grant all on table public.rastreamento_entregas to service_role;