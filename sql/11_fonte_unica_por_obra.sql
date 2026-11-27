-- 11 – Fonte única de dados por obra
-- Decisões (27/11/2026): RDO aprovado lança na memória de cálculo; custo real soma horas de
-- máquina × custo horário e diesel; % financeiro = medido aprovado ÷ contrato atualizado;
-- % da EAP automático quando a atividade tem item do orçamento.

-- 1) Memória de cálculo: origem do lançamento e vínculo com o serviço do RDO
alter table public.memoria_calculo
  add column if not exists origem text not null default 'manual' check (origem in ('manual','rdo','ficha')),
  add column if not exists rdo_servico_id uuid references public.rdo_servicos(id) on delete cascade;
create unique index if not exists memoria_rdo_servico_uk on public.memoria_calculo (rdo_servico_id) where rdo_servico_id is not null;
create index if not exists memoria_item_data_idx on public.memoria_calculo (orcamento_item_id, data);

create or replace function public.estaca_parte(t text, parte int) returns numeric
language sql immutable set search_path = '' as $$
  select case when t ~ '^\s*\d+\s*\+\s*[\d.,]*\s*$' then
    case parte when 1 then split_part(regexp_replace(t, '\s', '', 'g'), '+', 1)::numeric
               else coalesce(nullif(replace(split_part(regexp_replace(t, '\s', '', 'g'), '+', 2), ',', '.'), '')::numeric, 0) end
  end $$;

create or replace function public.unidade_norm(u text) returns text
language sql immutable set search_path = '' as $$
  select lower(replace(replace(replace(coalesce(u, ''), '²', '2'), '³', '3'), ' ', '')) $$;

-- Sincroniza a memória com os serviços de um RDO: apaga o que veio do RDO e, se aprovado, relança.
-- Serviço sem item, sem quantidade ou com unidade diferente da do item fica só no RDO.
-- Não lança quando a mesma produção já veio de ficha/manual (mesma data, item, local e estacas).
create or replace function public.rdo_sincroniza_memoria(p_rdo uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  select id, obra_id, data, status into r from public.rdo where id = p_rdo;
  delete from public.memoria_calculo m using public.rdo_servicos s
   where m.rdo_servico_id = s.id and s.rdo_id = p_rdo and m.origem = 'rdo';
  if r.id is null or r.status <> 'aprovado' then return; end if;
  insert into public.memoria_calculo (obra_id, data, orcamento_item_id, rdo_id, rdo_servico_id, origem, local,
         est_ini_int, est_ini_frac, est_fim_int, est_fim_frac, lado, comprimento, largura, quantidade, formula, observacao, criado_por)
  select r.obra_id, r.data, s.orcamento_item_id, r.id, s.id, 'rdo', s.local,
         public.estaca_parte(s.estaca_ini, 1), public.estaca_parte(s.estaca_ini, 2),
         public.estaca_parte(s.estaca_fim, 1), public.estaca_parte(s.estaca_fim, 2),
         s.lado, s.comprimento, s.largura, s.quantidade,
         'RDO ' || to_char(r.data, 'DD/MM/YYYY') || ': ' || s.servico
           || coalesce(' – ' || s.local, '')
           || case when s.estaca_ini is not null then ' – est. ' || s.estaca_ini || coalesce(' a ' || s.estaca_fim, '') else '' end
           || coalesce(' ' || s.lado, '') || ' = ' || replace(trim(to_char(s.quantidade, 'FM999999990.00')), '.', ',') || ' ' || coalesce(i.unidade, ''),
         s.observacao, auth.uid()
    from public.rdo_servicos s
    join public.orcamento_itens i on i.id = s.orcamento_item_id
   where s.rdo_id = r.id and s.quantidade is not null and s.quantidade > 0
     and public.unidade_norm(s.unidade) in (public.unidade_norm(i.unidade), '')
     and not exists (select 1 from public.memoria_calculo m
                      where m.obra_id = r.obra_id and m.data = r.data and m.orcamento_item_id = s.orcamento_item_id
                        and m.origem <> 'rdo'
                        and coalesce(m.local, '') = coalesce(s.local, '')
                        and coalesce(m.est_ini_int, -1) = coalesce(public.estaca_parte(s.estaca_ini, 1), -1)
                        and coalesce(m.est_fim_int, -1) = coalesce(public.estaca_parte(s.estaca_fim, 1), -1));
end $$;
revoke execute on function public.rdo_sincroniza_memoria(uuid) from public, anon, authenticated;

create or replace function public.rdo_memoria_trg() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'rdo' then
    if tg_op = 'UPDATE' and old.status is distinct from new.status and (old.status = 'aprovado' or new.status = 'aprovado') then
      perform public.rdo_sincroniza_memoria(new.id);
    end if;
    return null;
  end if;
  -- rdo_servicos alterado em RDO já aprovado (só o gestor consegue): ressincroniza
  if exists (select 1 from public.rdo where id = coalesce(new.rdo_id, old.rdo_id) and status = 'aprovado') then
    perform public.rdo_sincroniza_memoria(coalesce(new.rdo_id, old.rdo_id));
  end if;
  return null;
end $$;
drop trigger if exists rdo_memoria on public.rdo;
create trigger rdo_memoria after update of status on public.rdo for each row execute function public.rdo_memoria_trg();
drop trigger if exists rdo_servicos_memoria on public.rdo_servicos;
create trigger rdo_servicos_memoria after insert or update or delete on public.rdo_servicos for each row execute function public.rdo_memoria_trg();

-- RDOs já aprovados entram agora
do $$ declare x record; begin
  for x in select id from public.rdo where status = 'aprovado' loop perform public.rdo_sincroniza_memoria(x.id); end loop;
end $$;

-- 2) Avanço da EAP: automático quando há item do orçamento
create or replace view public.vw_eap_avanco with (security_invoker = true) as
with a as (
  select e.*, count(*) over (partition by e.obra_id, e.orcamento_item_id) as n_mesmo_item
    from public.eap_atividades e
), ex as (
  select a.id,
    (select coalesce(sum(m.quantidade), 0) from public.memoria_calculo m
      where m.orcamento_item_id = a.orcamento_item_id
        and (a.n_mesmo_item = 1 or a.frente is null
             or m.frente ilike a.frente or m.local ilike '%' || a.frente || '%' or a.nome ilike '%' || nullif(m.local, '') || '%'))
    + (select coalesce(sum(case when lower(i.unidade) = 't' then p.massa_teorica else p.area end), 0)
         from public.producao_cbuq p join public.orcamento_itens i on i.id = p.orcamento_item_id
        where p.orcamento_item_id = a.orcamento_item_id
          and (a.n_mesmo_item = 1 or a.frente is null or p.local ilike '%' || a.frente || '%' or a.nome ilike '%' || nullif(p.local, '') || '%')) as qtd_exec,
    (select min(m.data) from public.memoria_calculo m where m.orcamento_item_id = a.orcamento_item_id
        and (a.n_mesmo_item = 1 or a.frente is null or m.frente ilike a.frente or m.local ilike '%' || a.frente || '%' or a.nome ilike '%' || nullif(m.local, '') || '%')) as inicio_real_auto
  from a where a.orcamento_item_id is not null
)
select a.id, a.obra_id, a.ordem, a.codigo, a.nome, a.orcamento_item_id, a.frente, a.unidade,
       a.quantidade_prevista, a.inicio_previsto, a.fim_previsto, a.predecessora, a.status, a.observacao,
       coalesce(a.quantidade_prevista, case when a.n_mesmo_item = 1 then i.quantidade end) as qtd_base,
       ex.qtd_exec,
       case when ex.id is not null and coalesce(a.quantidade_prevista, case when a.n_mesmo_item = 1 then i.quantidade end) > 0
            then least(100, round(100 * ex.qtd_exec / coalesce(a.quantidade_prevista, i.quantidade), 2)) end as percentual_auto,
       coalesce(case when ex.id is not null and coalesce(a.quantidade_prevista, case when a.n_mesmo_item = 1 then i.quantidade end) > 0
                     then least(100, round(100 * ex.qtd_exec / coalesce(a.quantidade_prevista, i.quantidade), 2)) end,
                a.percentual_executado, 0) as percentual,
       coalesce(a.inicio_real, ex.inicio_real_auto) as inicio_real, a.fim_real,
       a.percentual_executado as percentual_manual,
       coalesce(i.total, 0) as peso_valor
  from a left join ex on ex.id = a.id left join public.orcamento_itens i on i.id = a.orcamento_item_id;

-- 3) Custo real: lançamentos + horas de máquina (RDO) × custo horário + diesel dos abastecimentos
create or replace view public.vw_custo_real with (security_invoker = true) as
select c.obra_id, c.data, c.categoria, 'lancamento'::text as origem, c.descricao, c.valor, c.orcamento_item_id, c.id as ref_id
  from public.custos c
union all
select r.obra_id, r.data, 'equipamento', 'rdo',
       e.prefixo || ' – ' || trim(to_char(coalesce(re.horas_produtivas, 0) + coalesce(re.horas_improdutivas, 0), 'FM990D0')) || ' h'
         || case when ec.custo_hora is null then ' (custo mensal ÷ 30)' else '' end,
       round(case when ec.custo_hora is not null then ec.custo_hora * (coalesce(re.horas_produtivas, 0) + coalesce(re.horas_improdutivas, 0))
                  else ec.custo_mensal / 30 end, 2), null::uuid, re.id
  from public.rdo_equipamentos re join public.rdo r on r.id = re.rdo_id
  join public.equipamentos e on e.id = re.equipamento_id
  join public.equipamentos_custo ec on ec.equipamento_id = re.equipamento_id
 where ec.custo_hora is not null or ec.custo_mensal is not null
union all
select a.obra_id, a.data, 'combustivel', 'abastecimento',
       coalesce(e.prefixo, 'Sem prefixo') || ' – ' || trim(to_char(a.litros, 'FM999G990D0')) || ' l',
       coalesce(a.valor, round(a.litros * a.preco_litro, 2)), null::uuid, a.id
  from public.abastecimentos a left join public.equipamentos e on e.id = a.equipamento_id
 where coalesce(a.valor, a.litros * a.preco_litro) is not null;

-- 4) Resumo da obra: o que painel, medição, custos e relatórios leem
create or replace view public.vw_obra_resumo with (security_invoker = true) as
with it as (
  select obra_id, sum(valor_contratado) as valor_itens,
         sum(least(qtd_executada, coalesce(qtd_contratada, qtd_executada)) * coalesce(preco_unitario, 0)) as valor_executado,
         avg(case when qtd_contratada > 0 then least(1, qtd_executada / qtd_contratada) end) as media_fisica,
         sum(valor_medido_aprovado) as medido_aprovado,
         count(*) as n_itens
    from public.vw_itens_saldo group by obra_id
), ad as (
  select obra_id, sum(coalesce(valor, 0)) as aditivo_valor, sum(coalesce(dias, 0))::int as aditivo_dias
    from public.aditivos where status = 'aprovado' group by obra_id
), ea as (
  select obra_id,
         sum(case when peso_valor > 0 then peso_valor else 1 end * percentual) / nullif(sum(case when peso_valor > 0 then peso_valor else 1 end), 0) as fisico_eap,
         sum(case when peso_valor > 0 then peso_valor else 1 end *
             case when inicio_previsto is null or fim_previsto is null then null
                  else greatest(0, least(1, ((now() at time zone 'America/Sao_Paulo')::date - inicio_previsto)::numeric / nullif(fim_previsto - inicio_previsto + 1, 0))) end) * 100
         / nullif(sum(case when inicio_previsto is not null and fim_previsto is not null then case when peso_valor > 0 then peso_valor else 1 end end), 0) as previsto_eap
    from public.vw_eap_avanco where status is distinct from 'marco' group by obra_id
), cr as (
  select obra_id, sum(valor) as custo_real,
         sum(valor) filter (where origem = 'lancamento') as custo_lancado,
         sum(valor) filter (where origem = 'rdo') as custo_equip,
         sum(valor) filter (where origem = 'abastecimento') as custo_diesel
    from public.vw_custo_real group by obra_id
)
select o.id as obra_id, o.codigo,
       o.valor_contrato, coalesce(ad.aditivo_valor, 0) as aditivo_valor,
       coalesce(o.valor_contrato, it.valor_itens, 0) + coalesce(ad.aditivo_valor, 0) as contrato_atualizado,
       it.valor_itens, it.n_itens,
       coalesce(it.valor_executado, 0) as valor_executado,
       case when it.valor_itens > 0 then round(100 * it.valor_executado / it.valor_itens, 2)
            else round(100 * it.media_fisica, 2) end as fisico_pct,
       round(ea.fisico_eap, 2) as fisico_eap, round(ea.previsto_eap, 2) as previsto_eap,
       coalesce(it.medido_aprovado, 0) as medido_aprovado,
       case when coalesce(o.valor_contrato, it.valor_itens, 0) + coalesce(ad.aditivo_valor, 0) > 0
            then round(100 * coalesce(it.medido_aprovado, 0) / (coalesce(o.valor_contrato, it.valor_itens, 0) + coalesce(ad.aditivo_valor, 0)), 2) end as financeiro_pct,
       coalesce(o.valor_contrato, it.valor_itens, 0) + coalesce(ad.aditivo_valor, 0) - coalesce(it.medido_aprovado, 0) as saldo_contrato,
       coalesce(o.data_os, o.data_inicio) as inicio_contrato,
       o.prazo_dias, coalesce(ad.aditivo_dias, 0) as aditivo_dias,
       o.prazo_dias + coalesce(ad.aditivo_dias, 0) as prazo_atualizado,
       coalesce(coalesce(o.data_os, o.data_inicio) + (o.prazo_dias + coalesce(ad.aditivo_dias, 0))::int, o.data_fim_prevista) as termino_previsto,
       (now() at time zone 'America/Sao_Paulo')::date - coalesce(o.data_os, o.data_inicio) as dias_decorridos,
       case when o.prazo_dias > 0 and coalesce(o.data_os, o.data_inicio) is not null
            then round(100.0 * ((now() at time zone 'America/Sao_Paulo')::date - coalesce(o.data_os, o.data_inicio)) / (o.prazo_dias + coalesce(ad.aditivo_dias, 0)), 1) end as prazo_pct,
       cr.custo_real, cr.custo_lancado, cr.custo_equip, cr.custo_diesel
  from public.obras o
  left join it on it.obra_id = o.id left join ad on ad.obra_id = o.id
  left join ea on ea.obra_id = o.id left join cr on cr.obra_id = o.id;

grant select on public.vw_eap_avanco, public.vw_custo_real, public.vw_obra_resumo to authenticated;

-- índices de chaves estrangeiras usadas nas visões (aviso de performance da Supabase)
create index if not exists rdo_equipamentos_rdo_idx on public.rdo_equipamentos (rdo_id);
create index if not exists rdo_servicos_rdo_idx on public.rdo_servicos (rdo_id);
create index if not exists custos_item_idx on public.custos (orcamento_item_id);
create index if not exists eap_item_idx on public.eap_atividades (orcamento_item_id);
create index if not exists producao_cbuq_item_idx on public.producao_cbuq (orcamento_item_id);
create index if not exists memoria_rdo_idx on public.memoria_calculo (rdo_id);
create index if not exists aditivos_obra_idx on public.aditivos (obra_id);
