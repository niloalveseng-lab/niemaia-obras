-- 12 – Preço do diesel por obra (com vigência) e views do painel
-- Custo do abastecimento = valor da nota; senão litros × preço do abastecimento; senão litros × preço vigente da obra.

create table if not exists public.diesel_precos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  vigencia date not null,
  preco_litro numeric(10,4) not null check (preco_litro > 0),
  fonte text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz default now(),
  unique (obra_id, vigencia)
);
alter table public.diesel_precos enable row level security;
create policy diesel_precos_sel on public.diesel_precos for select using (tem_perfil(obra_id, '{admin,gestor,auxiliar,apontador,almoxarife}'::text[]));
create policy diesel_precos_ins on public.diesel_precos for insert with check (tem_perfil(obra_id, '{admin,gestor,auxiliar}'::text[]));
create policy diesel_precos_upd on public.diesel_precos for update using (tem_perfil(obra_id, '{admin,gestor,auxiliar}'::text[])) with check (tem_perfil(obra_id, '{admin,gestor,auxiliar}'::text[]));
create policy diesel_precos_del on public.diesel_precos for delete using (tem_perfil(obra_id, '{admin,gestor}'::text[]));
create trigger audita_diesel_precos after insert or update or delete on public.diesel_precos for each row execute function audita();

create or replace function public.preco_diesel(p_obra uuid, p_data date) returns numeric
language sql stable security invoker set search_path = public as $$
  select preco_litro from diesel_precos where obra_id = p_obra and vigencia <= p_data order by vigencia desc limit 1
$$;

create or replace view public.vw_custo_real with (security_invoker = on) as
 select c.obra_id, c.data, c.categoria, 'lancamento'::text as origem, c.descricao, c.valor, c.orcamento_item_id, c.id as ref_id
   from custos c
union all
 select r.obra_id, r.data, 'equipamento'::text, 'rdo'::text,
    e.prefixo || ' – ' || trim(to_char(coalesce(re.horas_produtivas,0) + coalesce(re.horas_improdutivas,0), 'FM990D0')) || ' h'
      || case when ec.custo_hora is null then ' (custo mensal ÷ 30)' else '' end,
    round(case when ec.custo_hora is not null then ec.custo_hora * (coalesce(re.horas_produtivas,0) + coalesce(re.horas_improdutivas,0)) else ec.custo_mensal / 30 end, 2),
    null::uuid, re.id
   from rdo_equipamentos re join rdo r on r.id = re.rdo_id join equipamentos e on e.id = re.equipamento_id
   join equipamentos_custo ec on ec.equipamento_id = re.equipamento_id
  where ec.custo_hora is not null or ec.custo_mensal is not null
union all
 select a.obra_id, a.data, 'combustivel'::text, 'abastecimento'::text,
    coalesce(e.prefixo, 'Sem prefixo') || ' – ' || trim(to_char(a.litros, 'FM999G990D0')) || ' l'
      || case when a.valor is null and a.preco_litro is null then ' (preço vigente da obra)' else '' end,
    coalesce(a.valor, round(a.litros * a.preco_litro, 2), round(a.litros * preco_diesel(a.obra_id, a.data), 2)),
    null::uuid, a.id
   from abastecimentos a left join equipamentos e on e.id = a.equipamento_id
  where coalesce(a.valor, a.litros * a.preco_litro, a.litros * preco_diesel(a.obra_id, a.data)) is not null;

-- diesel por dia e equipamento, com horas do RDO do mesmo dia (para l/h) e custo
create or replace view public.vw_diesel with (security_invoker = on) as
 select a.obra_id, a.data, a.equipamento_id, e.prefixo, e.descricao,
        sum(a.litros) as litros,
        sum(coalesce(a.valor, a.litros * a.preco_litro, a.litros * preco_diesel(a.obra_id, a.data))) as valor,
        (select sum(coalesce(re.horas_produtivas,0) + coalesce(re.horas_improdutivas,0))
           from rdo_equipamentos re join rdo r on r.id = re.rdo_id
          where re.equipamento_id = a.equipamento_id and r.data = a.data) as horas
   from abastecimentos a left join equipamentos e on e.id = a.equipamento_id
  group by a.obra_id, a.data, a.equipamento_id, e.prefixo, e.descricao;

grant select on public.vw_custo_real, public.vw_diesel to authenticated;
grant select, insert, update, delete on public.diesel_precos to authenticated;
