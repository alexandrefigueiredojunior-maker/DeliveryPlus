alter table public.entregas
  add column if not exists ordem_rota integer;

comment on column public.entregas.ordem_rota is
  'Ordem da parada na rota atual do motoboy; valores menores são atendidos primeiro.';