-- Integração segura MenuJunior -> DeliveryPlus
create table if not exists public.integracoes_menujunior (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null unique references public.restaurantes(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  token_hash text not null unique,
  ativo boolean not null default true,
  conectado_em timestamptz not null default now(),
  ultimo_evento_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.entregas
  add column if not exists origem_integracao text,
  add column if not exists origem_pedido_id text;

create unique index if not exists entregas_origem_integracao_pedido_uidx
  on public.entregas (restaurante_id, origem_integracao, origem_pedido_id)
  where origem_integracao is not null and origem_pedido_id is not null;

alter table public.integracoes_menujunior enable row level security;
-- A tabela é acessada exclusivamente pelas Edge Functions com service role.
