alter table public.configuracoes_empresas
  add column if not exists compartilhar_localizacao_cliente boolean not null default true;

comment on column public.configuracoes_empresas.compartilhar_localizacao_cliente is
  'Controla se os clientes podem acessar o rastreamento público das entregas da empresa.';

create or replace function public.revogar_rastreamentos_quando_compartilhamento_desativado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.compartilhar_localizacao_cliente is false
     and (
       tg_op = 'INSERT'
       or old.compartilhar_localizacao_cliente is distinct from new.compartilhar_localizacao_cliente
     ) then
    update public.rastreamento_entregas as rastreamento
       set ativo = false,
           encerrado_em = coalesce(rastreamento.encerrado_em, now()),
           token_ciphertext = '',
           updated_at = now()
      from public.entregas as entrega
     where entrega.id = rastreamento.entrega_id
       and entrega.empresa_id = new.empresa_id
       and rastreamento.ativo = true;
  end if;

  return new;
end;
$$;

revoke all on function public.revogar_rastreamentos_quando_compartilhamento_desativado() from public, anon, authenticated;

drop trigger if exists trg_revogar_rastreamentos_compartilhamento_desativado
  on public.configuracoes_empresas;

create trigger trg_revogar_rastreamentos_compartilhamento_desativado
after insert or update on public.configuracoes_empresas
for each row
execute function public.revogar_rastreamentos_quando_compartilhamento_desativado();