'use strict';
/* ================= PAINEL ================= */
function previstoEap(eap, itensMap, d) {
  const at = eap.filter(a => a.status !== 'marco' && a.inicio_previsto && a.fim_previsto);
  if (!at.length) return null;
  let sw = 0, sp = 0;
  for (const a of at) {
    const w = (a.orcamento_item_id && itensMap[a.orcamento_item_id] && itensMap[a.orcamento_item_id].valor_contratado) || 1;
    const i = new Date(a.inicio_previsto + 'T00:00:00'), f = new Date(a.fim_previsto + 'T23:59:59'), x = new Date(d + 'T12:00:00');
    sw += w; sp += w * Math.max(0, Math.min(1, (x - i) / (f - i)));
  }
  return 100 * sp / sw;
}
function realEap(eap, itensMap) {
  const at = eap.filter(a => a.status !== 'marco'); if (!at.length) return null;
  let sw = 0, sp = 0;
  for (const a of at) { const w = (a.orcamento_item_id && itensMap[a.orcamento_item_id] && itensMap[a.orcamento_item_id].valor_contratado) || 1; sw += w; sp += w * (Number(a.percentual_executado) || 0); }
  return sp / sw;
}
async function dadosPainel() {
  const id = S.obra.id;
  const [itens, eap, rdos, efet, serv, cbuq, eqs, est, meds, docs, custos, cert, func, hprev, R] = await Promise.all([
    q(sb.from('vw_itens_saldo').select('*').eq('obra_id', id).order('ordem')),
    q(sb.from('vw_eap_avanco').select('*').eq('obra_id', id).order('ordem')).then(a => a.map(x => ({ ...x, percentual_executado: x.percentual }))),
    q(sb.from('rdo').select('id,data,status,condicao').eq('obra_id', id).order('data')),
    q(sb.from('rdo_efetivo').select('quantidade,funcao,vinculo,rdo:rdo_id(data)').eq('obra_id', id)),
    q(sb.from('memoria_calculo').select('orcamento_item_id,quantidade,data').eq('obra_id', id)).then(a => a.map(m => ({ orcamento_item_id: m.orcamento_item_id, quantidade: m.quantidade, rdo: { data: m.data } }))),
    q(sb.from('producao_cbuq').select('data,tipo_area,area,massa_teorica,massa_balanca,orcamento_item_id').eq('obra_id', id)),
    q(sb.from('equipamentos').select('prefixo,descricao,status,horimetro_atual,proxima_manutencao_horimetro').eq('obra_id', id)),
    q(sb.from('vw_estoque').select('*').eq('obra_id', id)),
    q(sb.from('medicoes').select('numero,status,periodo_fim,data_envio').eq('obra_id', id)),
    q(sb.from('documentos_obra').select('documento,status').eq('obra_id', id)),
    pode('custos') ? q(sb.from('vw_custo_real').select('valor,orcamento_item_id,origem').eq('obra_id', id)) : [],
    q(sb.from('certidoes').select('tipo,validade')),
    q(sb.from('funcionarios').select('nome,aso_validade,epi_entregue,ativo').eq('obra_id', id)),
    q(sb.from('histograma_previsto').select('*').eq('obra_id', id)),
    q(sb.from('vw_obra_resumo').select('*').eq('obra_id', id).maybeSingle())
  ]);
  return { itens, eap, rdos, efet, serv, cbuq, eqs, est, meds, docs, custos, cert, func, hprev, R: R || {} };
}
function indicadores(D) {
  const o = S.obra, it = D.itens;
  const itensMap = Object.fromEntries(it.map(i => [i.id, i]));
  const somaItens = soma(it, i => i.valor_contratado);
  const temPreco = somaItens > 0;
  const execValor = soma(it, i => Math.min(Number(i.qtd_executada) || 0, i.qtd_contratada ?? Infinity) * (Number(i.preco_unitario) || 0));
  const comQtd = it.filter(i => Number(i.qtd_contratada) > 0);
  const fisItens = temPreco ? 100 * execValor / somaItens : (comQtd.length ? soma(comQtd, i => Math.min(1, i.qtd_executada / i.qtd_contratada)) / comQtd.length * 100 : null);
  const fisEap = realEap(D.eap, itensMap), prevHoje = previstoEap(D.eap, itensMap, hoje());
  const medAprov = soma(it, i => i.valor_medido_aprovado);
  const cbuqContr = soma(it.filter(ehCbuq), i => i.qtd_contratada);
  const cbuqT = soma(D.cbuq, c => c.massa_teorica);
  const comBal = D.cbuq.filter(c => num(c.massa_balanca) !== null);
  const balT = soma(comBal, c => c.massa_balanca), teorBal = soma(comBal, c => c.massa_teorica);
  const custo = soma(D.custos, c => c.valor);
  const porDia = {}; D.efet.forEach(e => { const d = e.rdo && e.rdo.data; if (d) porDia[d] = (porDia[d] || 0) + e.quantidade; });
  const dias = Object.keys(porDia).sort(); const ultDia = dias[dias.length - 1];
  const R = D.R || {}, nn = v => (v === null || v === undefined ? null : Number(v));
  /* fonte única: vw_obra_resumo (banco). Os cálculos locais acima só servem de reserva. */
  return { itensMap, somaItens, temPreco, execValor: nn(R.valor_executado) ?? execValor, fisItens: nn(R.fisico_pct) ?? fisItens, fisEap: nn(R.fisico_eap) ?? fisEap, prevHoje: nn(R.previsto_eap) ?? prevHoje,
    medAprov: nn(R.medido_aprovado) ?? medAprov, cbuqContr, cbuqT, balT, teorBal, custo: nn(R.custo_real) ?? custo, porDia, ultDia,
    valorContr: nn(R.contrato_atualizado) || o.valor_contrato || somaItens, finPct: nn(R.financeiro_pct), saldo: nn(R.saldo_contrato), aditivo: nn(R.aditivo_valor) || 0,
    prazoDias: nn(R.prazo_atualizado), decorridos: nn(R.dias_decorridos), prazoPct: nn(R.prazo_pct), termino: R.termino_previsto || null, valorItens: nn(R.valor_itens),
    custoLanc: nn(R.custo_lancado) || 0, custoEq: nn(R.custo_equip) || 0, custoDiesel: nn(R.custo_diesel) || 0 };
}
function alertas(D, K) {
  const a = [], o = S.obra;
  if (['em_andamento', 'mobilizacao'].includes(o.status)) {
    const falta = diasSemRdo(D.rdos.map(r => r.data), o.data_inicio);
    if (!D.rdos.length) a.push(['er', 'Nenhum RDO lançado nesta obra.']);
    else if (falta.length) a.push(['er', `Dias sem RDO (últimos ${DIAS_RDO} dias): ${falta.map(d => dt(d).slice(0, 5)).join(', ')}.`]);
  }
  if (K.valorItens && o.valor_contrato && Math.abs(K.valorItens - o.valor_contrato) > 1) a.push(['av', `Soma dos itens do orçamento (${brl(K.valorItens)}) difere do valor do contrato (${brl(o.valor_contrato)}) em ${brl(K.valorItens - o.valor_contrato)}. Conferir a planilha.`]);
  const env = D.rdos.filter(r => r.status === 'enviado').length; if (env) a.push(['av', `${env} RDO(s) aguardando aprovação do gestor.`]);
  const dev = D.rdos.filter(r => r.status === 'devolvido').length; if (dev) a.push(['er', `${dev} RDO(s) devolvido(s) para correção.`]);
  D.eqs.filter(e => ['parado', 'manutencao'].includes(e.status)).forEach(e => a.push(['av', `Equipamento ${e.prefixo} (${e.descricao}): ${L.status_eq[e.status].toLowerCase()}.`]));
  D.eqs.filter(e => num(e.proxima_manutencao_horimetro) !== null && num(e.horimetro_atual) !== null && e.horimetro_atual >= e.proxima_manutencao_horimetro).forEach(e => a.push(['av', `Equipamento ${e.prefixo}: manutenção preventiva vencida (horímetro ${nf(e.horimetro_atual, 1)}).`]));
  D.est.filter(m => num(m.estoque_minimo) !== null && Number(m.saldo) < Number(m.estoque_minimo)).forEach(m => a.push(['av', `Estoque de ${m.nome} abaixo do mínimo: ${nf(m.saldo)} ${m.unidade} (mín. ${nf(m.estoque_minimo)}).`]));
  D.itens.filter(i => Number(i.qtd_contratada) > 0 && Number(i.qtd_executada) > Number(i.qtd_contratada)).forEach(i => a.push(['er', `Execução acima do contratado: ${i.descricao} (${nf(i.perc_executado, 1)}%). Avaliar aditivo.`]));
  D.itens.filter(i => Number(i.qtd_contratada) > 0 && Number(i.qtd_medida_total) >= 0.9 * i.qtd_contratada).forEach(i => a.push(['av', `Item com ${nf(100 * i.qtd_medida_total / i.qtd_contratada, 1)}% medido: ${i.descricao}.`]));
  if (K.teorBal > 0 && Math.abs(K.balT - K.teorBal) / K.teorBal > 0.03) a.push(['av', `CBUQ: balança × área com diferença de ${nf(100 * (K.balT - K.teorBal) / K.teorBal, 1)}%. Conferir espessura e tickets.`]);
  const pend = D.docs.filter(d => ['pendente', 'em_andamento'].includes(d.status)).length; if (pend) a.push(['av', `${pend} documento(s) de início de obra pendente(s) (checklist SEPLAN).`]);
  D.cert.forEach(c => { const dd = (new Date(c.validade + 'T12:00:00') - new Date()) / 864e5; if (dd < 0) a.push(['er', `Certidão ${c.tipo} vencida em ${dt(c.validade)}.`]); else if (dd <= 15) a.push(['av', `Certidão ${c.tipo} vence em ${dt(c.validade)}.`]); });
  const ativos = D.func.filter(f => f.ativo);
  const aso = ativos.filter(f => f.aso_validade && f.aso_validade < hoje()).length; if (aso) a.push(['er', `${aso} funcionário(s) com ASO vencido.`]);
  const epi = ativos.filter(f => !f.epi_entregue).length; if (epi) a.push(['er', `${epi} funcionário(s) sem registro de entrega de EPI (trabalhador sem EPI é afastado).`]);
  const anal = D.meds.filter(m => m.status === 'em_analise').length; if (anal) a.push(['az', `${anal} medição(ões) em análise pela fiscalização.`]);
  if (K.prevHoje !== null && K.fisEap !== null && K.prevHoje - K.fisEap > 5) a.push(['er', `Atraso físico: previsto ${nf(K.prevHoje, 1)}% × realizado ${nf(K.fisEap, 1)}% (EAP).`]);
  return a;
}
async function pgPainel(el) {
  const D = await dadosPainel(), K = indicadores(D), o = S.obra;
  const al = alertas(D, K);
  const sub = (v, x) => v === null || v === undefined ? '–' : x;
  el.innerHTML = `<p class="muted" style="margin:-10px 0 14px">${h(o.contratante || 'Contratante a preencher')}${K.termino ? ' · término previsto ' + dt(K.termino) : ''}</p>
  <div class="kpis">
   <div class="kpi"><span>% físico</span><b>${pct(K.fisItens)}</b>${barra(K.fisItens, K.prevHoje)}<small>${!D.itens.length ? 'sem orçamento carregado' : K.prevHoje !== null ? 'previsto hoje (cronograma): ' + pct(K.prevHoje) : 'cronograma sem datas previstas'}</small></div>
   <div class="kpi"><span>% financeiro</span><b>${pct(K.finPct)}</b>${barra(K.finPct)}<small>medido aprovado ${brl(K.medAprov)}</small></div>
   <div class="kpi"><span>Prazo</span><b>${K.prazoDias ? `${K.decorridos} de ${K.prazoDias} dias` : 'a preencher'}</b>${K.prazoDias ? barra(K.prazoPct) : ''}<small>${K.prazoDias ? pct(K.prazoPct) + ' do prazo' + (K.termino ? ' · fim ' + dt(K.termino) : '') : 'informe data de início/OS e prazo em Obras'}</small></div>
   <div class="kpi"><span>Saldo do contrato</span><b>${sub(K.saldo, brl(K.saldo))}</b><small>contrato ${K.valorContr ? brl(K.valorContr) : '–'}${K.aditivo ? ' (aditivos ' + brl(K.aditivo) + ')' : ''}</small></div>
   ${K.cbuqContr ? `<div class="kpi"><span>CBUQ aplicado (área × 0,05 × 2,40)</span><b>${nf(K.cbuqT, 1)} t</b><small>de ${nf(K.cbuqContr, 1)} t (${pct(100 * K.cbuqT / K.cbuqContr)}) · balança ${nf(K.balT, 1)} t</small></div>` : ''}
   ${pode('custos') ? `<div class="kpi"><span>Custo real</span><b>${brl(K.custo)}</b><small>lançado ${brl(K.custoLanc)} · máquinas ${brl(K.custoEq)} · diesel ${brl(K.custoDiesel)}${K.temPreco && K.execValor ? ' · margem ' + pct(100 * (K.execValor - K.custo) / K.execValor) : ''}</small></div>` : ''}
   <div class="kpi"><span>Efetivo no último RDO</span><b>${K.ultDia ? K.porDia[K.ultDia] : '–'}</b><small>${K.ultDia ? dt(K.ultDia) : 'sem RDO'}</small></div>
  </div>
  <div class="g2"><div class="card"><h3 style="margin-top:0">Curva S – planejado × realizado</h3><div style="position:relative;height:280px"><canvas id="cS"></canvas></div><p class="muted" id="cSm"></p></div>
  <div class="card alertas"><h3 style="margin-top:0">Alertas (${al.length})</h3>${al.length ? al.map(([c, t]) => `<div class="b-${c}">${h(t)}</div>`).join('') : '<p class="muted">Sem alertas.</p>'}</div></div>
  <div class="card"><h3 style="margin-top:0">Histograma de efetivo – real × previsto</h3><div style="position:relative;height:240px"><canvas id="cH"></canvas></div></div>
  <div class="card"><h3 style="margin-top:0">Itens do contrato</h3><div class="tw"><table class="grid"><thead><tr><th>Descrição</th><th>Un</th><th class="n">Contratado</th><th class="n">Executado</th><th class="n">%</th><th class="n">Medido</th><th class="n">Saldo</th></tr></thead><tbody>${D.itens.map(i => `<tr><td>${h(i.descricao)}</td><td>${h(i.unidade)}</td><td class="n">${nf(i.qtd_contratada)}</td><td class="n">${nf(i.qtd_executada)}</td><td class="n">${pct(i.perc_executado)}</td><td class="n">${nf(i.qtd_medida_total)}</td><td class="n">${nf(i.qtd_saldo)}</td></tr>`).join('') || '<tr><td colspan="7" class="vazio">Orçamento sem itens. Importe a planilha vencedora em Orçamento.</td></tr>'}</tbody></table></div></div>`;
  curvaS(D, K); histograma(D, 'cH');
}
function curvaS(D, K) {
  if (!$('#cS')) return;
  const datasEap = D.eap.flatMap(a => [a.inicio_previsto, a.fim_previsto]).filter(Boolean);
  const datasReal = [...D.serv.map(s => s.rdo && s.rdo.data), ...D.cbuq.map(c => c.data)].filter(Boolean);
  const todas = [...datasEap, ...datasReal, hoje()].sort();
  if (todas.length < 2 || todas[0] === todas[todas.length - 1]) { $('#cSm').textContent = 'Cadastre as datas previstas da EAP em Planejamento para gerar a curva.'; return; }
  const ini = todas[0], fim = todas[todas.length - 1]; const pts = []; let d = ini;
  const passo = Math.max(1, Math.ceil((new Date(fim) - new Date(ini)) / 864e5 / 40));
  while (d < fim) { pts.push(d); d = addDias(d, passo); } pts.push(fim); if (!pts.includes(hoje())) { pts.push(hoje()); pts.sort(); }
  const prev = pts.map(x => previstoEap(D.eap, K.itensMap, x));
  const itens = D.itens.filter(i => Number(i.qtd_contratada) > 0); const sw = soma(itens, i => K.temPreco ? i.valor_contratado : 1);
  const ev = []; D.serv.forEach(s => s.rdo && s.orcamento_item_id && ev.push([s.rdo.data, s.orcamento_item_id, Number(s.quantidade) || 0]));
  D.cbuq.forEach(c => { const it = K.itensMap[c.orcamento_item_id]; if (it) ev.push([c.data, c.orcamento_item_id, String(it.unidade).toLowerCase() === 't' ? Number(c.massa_teorica) : Number(c.area)]); });
  ev.sort((a, b) => a[0] < b[0] ? -1 : 1);
  const real = pts.map(x => {
    if (x > hoje() || !sw) return null; const acc = {};
    ev.forEach(([d2, i, qd]) => { if (d2 <= x) acc[i] = (acc[i] || 0) + qd; });
    return 100 * soma(itens, i => (K.temPreco ? i.valor_contratado : 1) * Math.min(1, (acc[i.id] || 0) / i.qtd_contratada)) / sw;
  });
  const pEap = pts.map(x => x === hoje() ? K.fisEap : null);
  grafico($('#cS'), {
    type: 'line', data: { labels: pts.map(dt), datasets: [
      { label: 'Planejado (EAP)', data: prev, borderColor: cor('--sec'), borderDash: [5, 4], pointRadius: 0, tension: .25 },
      { label: 'Executado (itens do orçamento)', data: real, borderColor: cor('--lar'), backgroundColor: cor('--lar'), pointRadius: 0, tension: .25, spanGaps: true },
      { label: 'Realizado EAP (hoje)', data: pEap, borderColor: cor('--az'), backgroundColor: cor('--az'), pointRadius: 6, showLine: false }
    ] }, options: { maintainAspectRatio: false, scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } }, plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${nf(c.parsed.y, 1)}%` } } } }
  });
  $('#cSm').textContent = 'Planejado: distribuição linear das atividades da EAP entre início e fim previstos. Executado: memória de cálculo diária e produção de CBUQ sobre o contratado.';
}
function histograma(D, cid) {
  if (!$('#' + cid)) return;
  const porDia = {}; D.efet.forEach(e => { const d = e.rdo && e.rdo.data; if (d) porDia[d] = (porDia[d] || 0) + e.quantidade; });
  const prevMes = {}; D.hprev.forEach(p => { const m = p.mes.slice(0, 7); prevMes[m] = (prevMes[m] || 0) + p.quantidade; });
  const datas = [...Object.keys(porDia)]; const meses = Object.keys(prevMes).sort();
  if (meses.length) { datas.push(meses[0] + '-01'); const u = meses[meses.length - 1]; const f = new Date(+u.slice(0, 4), +u.slice(5, 7), 0).toISOString().slice(0, 10); datas.push(f); }
  datas.sort(); if (!datas.length) { $('#' + cid).parentNode.innerHTML = '<p class="muted">Sem efetivo lançado no RDO nem histograma previsto (Planejamento).</p>'; return; }
  const lab = []; for (let d = datas[0]; d <= datas[datas.length - 1]; d = addDias(d, 1)) lab.push(d);
  grafico($('#' + cid), {
    data: { labels: lab.map(dt), datasets: [
      { type: 'bar', label: 'Efetivo real (RDO)', data: lab.map(d => porDia[d] ?? null), backgroundColor: cor('--lar') },
      { type: 'line', label: 'Previsto', data: lab.map(d => prevMes[d.slice(0, 7)] ?? null), borderColor: cor('--sec'), borderDash: [5, 4], pointRadius: 0, stepped: true }
    ] }, options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'pessoas' } } } }
  });
}

/* ================= OBRAS ================= */
const CAMPOS_OBRA = [
  { k: 'codigo', l: 'Código', req: true }, { k: 'nome', l: 'Nome da obra', req: true, w: 'w2' }, { k: 'municipio', l: 'Município' },
  { k: 'contratante', l: 'Contratante', w: 'w2' }, { k: 'contrato_numero', l: 'Nº do contrato' }, { k: 'valor_contrato', l: 'Valor do contrato (R$)', t: 'money' },
  { k: 'data_base', l: 'Data-base' }, { k: 'tabela_referencia', l: 'Tabela de referência' }, { k: 'bdi', l: 'BDI (%)', t: 'num' },
  { k: 'prazo_dias', l: 'Prazo (dias)', t: 'num' }, { k: 'data_os', l: 'Data da OS', t: 'date' }, { k: 'data_inicio', l: 'Início', t: 'date' },
  { k: 'data_fim_prevista', l: 'Término previsto', t: 'date' }, { k: 'extensao_km', l: 'Extensão (km)', t: 'num' }, { k: 'gestor_contrato', l: 'Gestor do contrato' },
  { k: 'status', l: 'Situação', t: 'sel', o: L.status_obra, req: true }, { k: 'observacoes', l: 'Observações', t: 'area', w: 'wf' }
];
async function pgObras(el) {
  const lista = [
    { t: 'Dados da obra', f: async c => {
      const ed = pode('aprovar');
      c.innerHTML = `<div class="card"><div class="form">${CAMPOS_OBRA.map(x => campoHtml(x, S.obra[x.k])).join('')}</div><div class="bar" style="margin-top:12px">${ed ? '<button class="pri" id="svO">Salvar</button>' : ''}${pode('admin') ? '<button id="nvO">Nova obra</button>' : ''}<span class="sp"></span><button id="pdO">Ficha da obra (PDF)</button></div></div>`;
      if (!ed) $$('input,select,textarea', c).forEach(e => e.disabled = true);
      if (ed) $('#svO').onclick = async () => { try { const v = lerCampos(c, CAMPOS_OBRA); await q(sb.from('obras').update(v).eq('id', S.obra.id)); Object.assign(S.obra, v); toast('Obra salva', 'ok'); estrutura(); rotear(); } catch (e) { erro(e); } };
      if (pode('admin')) $('#nvO').onclick = () => { const b = document.createElement('div'); b.className = 'form'; b.innerHTML = CAMPOS_OBRA.map(x => campoHtml(x)).join(''); modal('Nova obra', b, [{ t: 'Criar obra', c: 'pri', f: async () => { const v = lerCampos(b, CAMPOS_OBRA); const r = await q(sb.from('obras').insert(v).select().single()); S.obras = await q(sb.from('obras').select('*').order('codigo')); await trocarObra(r.id); toast('Obra criada com checklist de documentos', 'ok'); } }]); };
      $('#pdO').onclick = () => tabelaPdf('FICHA', 'Ficha da obra', ['Campo', 'Valor'], CAMPOS_OBRA.map(x => [x.l, x.t === 'money' ? brl(S.obra[x.k]) : x.t === 'date' ? dt(S.obra[x.k]) : x.t === 'sel' ? x.o[S.obra[x.k]] : (S.obra[x.k] ?? '[a preencher]')]), { paisagem: false });
    } },
    { t: 'Pendências e divergências', f: c => crud(c, { table: 'pendencias', title: 'Pendências, divergências e suposições', doc: 'PENDENCIAS', order: 'codigo', write: 'planejar', paisagem: true,
      intro: 'O que trava frente, medição ou prazo. Divergência = projeto × orçamento × campo; mostrar sempre os dois valores com a origem.',
      cols: [{ k: 'codigo', l: 'Item' }, { k: 'tipo', l: 'Tipo', t: 'sel', o: L.tipo_pend, req: true, def: 'pendencia' }, { k: 'descricao', l: 'Descrição', req: true, w: 'wf' }, { k: 'frente', l: 'Frente' },
        { k: 'impacto', l: 'Impacto', w: 'w2' }, { k: 'responsavel', l: 'Responsável' }, { k: 'documento', l: 'Documento necessário', formOnly: true, w: 'w2' }, { k: 'prazo', l: 'Prazo-limite', t: 'date' },
        { k: 'status', l: 'Situação', t: 'sel', o: L.status_pend, badge: true, req: true, def: 'aberta' }, { k: 'observacao', l: 'Valor adotado / observação', t: 'area', w: 'wf' }] }) },
    { t: 'Documentos de início (SEPLAN)', f: c => crud(c, { table: 'documentos_obra', title: 'Checklist de documentos de início de obra', doc: 'DOCS_INICIO', order: 'ordem', write: 'planejar', del: false, noNew: !pode('planejar'),
      intro: 'Checklist da Prefeitura de Sousa para início de obra. Comunicação oficial só por e-mail: setorengenhariaseplansousa@gmail.com (alvará: atendimentoseplansousa@gmail.com).',
      cols: [{ k: 'ordem', l: 'Nº', t: 'num', d: 0 }, { k: 'documento', l: 'Documento', req: true, w: 'w2' }, { k: 'status', l: 'Situação', t: 'sel', o: L.status_doc, badge: true, req: true }, { k: 'numero', l: 'Nº / protocolo' }, { k: 'validade', l: 'Validade', t: 'date' }, { k: 'observacao', l: 'Observação', w: 'wf' }] }) },
    ...(pode('medir') ? [{ t: 'Aditivos', f: c => crud(c, { table: 'aditivos', title: 'Aditivos contratuais', doc: 'ADITIVOS', order: 'numero', write: 'orcamento',
      cols: [{ k: 'numero', l: 'Nº', t: 'num', d: 0 }, { k: 'tipo', l: 'Tipo', t: 'sel', o: L.aditivo, req: true }, { k: 'data', l: 'Data', t: 'date' }, { k: 'dias', l: 'Prazo (dias)', t: 'num', d: 0, sum: true }, { k: 'valor', l: 'Valor (R$)', t: 'money', sum: true, neg: true, dica: 'Negativo para supressão' }, { k: 'status', l: 'Situação', t: 'sel', o: L.status_adit, badge: true, req: true }, { k: 'descricao', l: 'Descrição / justificativa', t: 'area', w: 'wf' }] }) }] : []),
    ...(S.perfil !== 'fiscal' ? [{ t: 'Certidões da empresa', f: c => crud(c, { table: 'certidoes', semObra: true, title: 'Certidões da empresa', doc: 'CERTIDOES', order: 'validade', write: 'medir',
      intro: 'Válidas para todas as obras. Exigidas em cada medição: CRF, INSS, municipal, trabalhista, federal e estadual.',
      cols: [{ k: 'tipo', l: 'Certidão', req: true, list: ['CRF (FGTS)', 'INSS', 'Municipal', 'Trabalhista (CNDT)', 'Federal', 'Estadual'] }, { k: 'numero', l: 'Número' }, { k: 'emissao', l: 'Emissão', t: 'date' }, { k: 'validade', l: 'Validade', t: 'date', req: true }, { k: 'sit', l: 'Situação', listOnly: true, html: true, v: r => r.validade < hoje() ? badge('vencida') .replace('class="badge ', 'class="badge b-er ') : badge('válida').replace('class="badge ', 'class="badge b-ok ') }, { k: 'observacao', l: 'Observação', w: 'wf' }] }) }] : [])
  ];
  abas(el, lista);
}

/* ================= ORÇAMENTO ================= */
async function pgOrcamento(el) {
  await crud(el, {
    view: 'vw_itens_saldo', table: 'orcamento_itens', title: 'Orçamento e saldo contratual', doc: 'ORCAMENTO', order: 'ordem', write: 'orcamento', paisagem: true,
    intro: 'Quantidades contratadas, execução (RDO e produção de CBUQ), medição e saldo por item. Clique no item para editar.',
    botoes: pode('orcamento') ? '<button class="imp">Importar planilha (Excel)</button>' : '',
    cols: [
      { k: 'ordem', l: 'Ordem', t: 'num', d: 0 }, { k: 'item', l: 'Item' }, { k: 'codigo', l: 'Código' }, { k: 'fonte', l: 'Fonte (DER-PB, SINAPI…)', formOnly: true },
      { k: 'grupo', l: 'Grupo' }, { k: 'descricao', l: 'Descrição', req: true, w: 'w2' }, { k: 'unidade', l: 'Un', req: true },
      { k: 'quantidade', l: 'Quantidade contratada', t: 'num', formOnly: true }, { k: 'qtd_contratada', l: 'Contratado', t: 'num', listOnly: true },
      { k: 'preco_unitario', l: 'Preço unit.', t: 'money' }, { k: 'valor_contratado', l: 'Valor contratado', t: 'money', listOnly: true, sum: true },
      { k: 'qtd_executada', l: 'Executado', t: 'num', listOnly: true }, { k: 'perc_executado', l: '% exec.', t: 'num', d: 1, listOnly: true },
      { k: 'qtd_medida_total', l: 'Medido', t: 'num', listOnly: true }, { k: 'qtd_saldo', l: 'Saldo', t: 'num', listOnly: true },
      { k: 'valor_medido_aprovado', l: 'Medido aprovado (R$)', t: 'money', listOnly: true, sum: true },
      { k: 'tipo_area', l: 'Tipo de área CBUQ', t: 'sel', o: L.tipo_area, formOnly: true, dica: 'Preencha só nos itens de CBUQ, pintura e imprimação.' },
      { k: 'origem', l: 'Origem do dado', formOnly: true }, { k: 'ativo', l: 'Item ativo', t: 'bool', formOnly: true, def: true }, { k: 'observacao', l: 'Observação', t: 'area', w: 'wf', formOnly: true }
    ],
    pronto: (box, recarregar) => { const b = $('.imp', box); if (b) b.onclick = () => importarOrcamento(recarregar); }
  });
}
function importarOrcamento(depois) {
  const box = document.createElement('div');
  box.innerHTML = `<p class="muted">Use a planilha vencedora em Excel. O sistema localiza a linha de cabeçalho (Item, Código, Descrição, Unidade, Quantidade, Preço unitário). Linhas sem unidade viram o grupo dos itens abaixo.</p><input type="file" accept=".xlsx,.xls,.csv" id="fx"><div id="prev" style="margin-top:10px"></div><div class="chk" style="margin-top:10px"><input type="checkbox" id="subst"><span>Substituir o orçamento atual (os itens atuais ficam inativos, com histórico preservado)</span></div>`;
  let itens = [];
  $('#fx', box).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const wb = XLSX.read(await f.arrayBuffer()); const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    const hi = aoa.findIndex(r => r.some(c => /descri/i.test(String(c ?? ''))));
    if (hi < 0) { $('#prev', box).innerHTML = '<p class="b-er">Cabeçalho com "Descrição" não encontrado.</p>'; return; }
    const H = aoa[hi].map(c => String(c ?? '').toLowerCase());
    const col = re => H.findIndex(x => re.test(x));
    const ci = { item: col(/^item/), cod: col(/c[oó]d/), desc: col(/descri/), un: col(/^un/), qt: col(/quant/), pu: H.findIndex(x => /(pre[cç]o|unit)/.test(x) && !/total/.test(x)), fonte: col(/fonte|banco|ref/) };
    const n = v => typeof v === 'number' ? v : v == null || v === '' ? null : Number(String(v).replace(/\./g, '').replace(',', '.'));
    let grupo = null, ordem = 0; itens = [];
    for (const r of aoa.slice(hi + 1)) {
      const d = r[ci.desc]; if (!d) continue; const un = ci.un >= 0 ? r[ci.un] : null;
      if (!un) { grupo = String(d).trim(); continue; }
      itens.push({ ordem: ++ordem, item: ci.item >= 0 && r[ci.item] != null ? String(r[ci.item]) : null, codigo: ci.cod >= 0 && r[ci.cod] != null ? String(r[ci.cod]) : null, fonte: ci.fonte >= 0 && r[ci.fonte] != null ? String(r[ci.fonte]) : null, grupo, descricao: String(d).trim(), unidade: String(un).trim(), quantidade: ci.qt >= 0 ? n(r[ci.qt]) : null, preco_unitario: ci.pu >= 0 ? n(r[ci.pu]) : null, origem: 'Importação Excel – ' + f.name });
    }
    const tot = soma(itens, i => (i.quantidade || 0) * (i.preco_unitario || 0));
    $('#prev', box).innerHTML = `<p><b>${itens.length} itens</b> encontrados · total ${brl(tot)}</p><div class="tw" style="max-height:260px"><table class="grid"><thead><tr><th>Item</th><th>Descrição</th><th>Un</th><th class="n">Qtd</th><th class="n">Preço</th></tr></thead><tbody>${itens.slice(0, 40).map(i => `<tr><td>${h(i.item)}</td><td>${h(i.descricao)}</td><td>${h(i.unidade)}</td><td class="n">${nf(i.quantidade)}</td><td class="n">${brl(i.preco_unitario)}</td></tr>`).join('')}</tbody></table></div>`;
  };
  modal('Importar orçamento', box, [{ t: 'Importar', c: 'pri', f: async () => {
    if (!itens.length) throw new Error('Selecione a planilha.');
    const atuais = await q(sb.from('orcamento_itens').select('revisao').eq('obra_id', S.obra.id).order('revisao', { ascending: false }).limit(1));
    const rev = $('#subst', box).checked ? ((atuais[0] && atuais[0].revisao) || 0) + 1 : ((atuais[0] && atuais[0].revisao) || 0);
    if ($('#subst', box).checked) await q(sb.from('orcamento_itens').update({ ativo: false }).eq('obra_id', S.obra.id).eq('ativo', true));
    for (let i = 0; i < itens.length; i += 500) await q(sb.from('orcamento_itens').insert(itens.slice(i, i + 500).map(x => ({ ...x, obra_id: S.obra.id, revisao: rev }))));
    toast(`${itens.length} itens importados`, 'ok'); S.ref = {}; await depois();
  } }]);
}

/* ================= PLANEJAMENTO ================= */
function gantt(box, rows) {
  const at = rows.filter(r => r.inicio_previsto || r.inicio_real);
  if (!at.length) { box.innerHTML = '<p class="muted">Cadastre datas previstas nas atividades para ver o cronograma.</p>'; return; }
  const ds = at.flatMap(a => [a.inicio_previsto, a.fim_previsto, a.inicio_real, a.fim_real]).filter(Boolean).concat([hoje()]).sort();
  const t0 = new Date(ds[0] + 'T00:00:00').getTime(), t1 = new Date(addDias(ds[ds.length - 1], 1) + 'T00:00:00').getTime();
  const pos = d => 100 * (new Date(d + 'T00:00:00').getTime() - t0) / (t1 - t0);
  const meses = []; for (let x = new Date(ds[0].slice(0, 7) + '-01T00:00:00'); x.getTime() < t1; x.setMonth(x.getMonth() + 1)) meses.push(x.toISOString().slice(0, 10));
  box.innerHTML = `<div class="card"><h3 style="margin-top:0">Cronograma (Gantt)</h3><div class="gantt"><div class="esc"><div></div><div style="position:relative;height:18px">${meses.map(m => `<span style="position:absolute;left:${Math.max(0, pos(m))}%">${m.slice(5, 7)}/${m.slice(2, 4)}</span>`).join('')}</div></div>
  ${at.map(a => { const i = a.inicio_previsto || a.inicio_real, f = a.fim_previsto || a.fim_real || i;
    return `<div class="row"><div class="nm" title="${h(a.nome)}">${h(a.codigo || '')} ${h(a.nome)}</div><div class="tr">${a.status === 'marco' && i === f ? `<div class="mk" style="left:calc(${pos(i)}% - 6px)" title="${dt(i)}"></div>` : `<div class="pl" style="left:${pos(i)}%;width:${Math.max(0.6, pos(addDias(f, 1)) - pos(i))}%" title="${dt(i)} a ${dt(f)} · ${nf((a.percentual ?? a.percentual_executado), 0)}%"><i style="width:${Number((a.percentual ?? a.percentual_executado)) || 0}%"></i></div>`}<div class="hj" style="left:${pos(hoje())}%"></div></div></div>`; }).join('')}</div><p class="muted">Barra cinza: previsto. Laranja: % executado. Linha azul: hoje.</p></div>`;
}
async function pgPlanejamento(el) {
  abas(el, [
    { t: 'EAP e cronograma', f: c => crud(c, { table: 'eap_atividades', title: 'EAP e cronograma físico', doc: 'EAP', order: 'ordem', write: 'planejar', paisagem: true,
      intro: 'Atividade com item do orçamento: o % executado é calculado sozinho pela memória de cálculo e pela produção de CBUQ (executado ÷ quantidade prevista). Sem item, informe o % à mão.',
      load: () => q(sb.from('vw_eap_avanco').select('*').eq('obra_id', S.obra.id).order('ordem')),
      cols: [{ k: 'ordem', l: 'Ordem', t: 'num', d: 0 }, { k: 'codigo', l: 'Código' }, { k: 'nome', l: 'Atividade', req: true, w: 'w2' }, { k: 'frente', l: 'Frente' },
        { k: 'orcamento_item_id', l: 'Item do orçamento', t: 'ref', ref: 'item', formOnly: true, w: 'w2' }, { k: 'unidade', l: 'Un', formOnly: true }, { k: 'quantidade_prevista', l: 'Qtd prevista', t: 'num', formOnly: true },
        { k: 'inicio_previsto', l: 'Início prev.', t: 'date' }, { k: 'fim_previsto', l: 'Fim prev.', t: 'date' }, { k: 'inicio_real', l: 'Início real', t: 'date' }, { k: 'fim_real', l: 'Fim real', t: 'date' },
        { k: 'pct', l: '% exec.', listOnly: true, html: true, v: r => `${nf(r.percentual ?? r.percentual_executado ?? 0, 1)}%${r.percentual_auto !== null && r.percentual_auto !== undefined ? ' <span class="badge b-az" title="Calculado pela produção">auto</span>' : ''}` },
        { k: 'percentual_executado', l: '% executado (manual, só sem item)', t: 'num', d: 0, formOnly: true }, { k: 'predecessora', l: 'Predecessora' }, { k: 'status', l: 'Situação', t: 'sel', o: L.status_eap, badge: true, req: true, def: 'nao_iniciada' },
        { k: 'observacao', l: 'Observação', t: 'area', w: 'wf' }],
      resumo: (b, r) => gantt(b, r) }) },
    { t: 'Histograma previsto', f: c => crud(c, { table: 'histograma_previsto', title: 'Histograma de mão de obra previsto', doc: 'HISTOGRAMA_PREVISTO', order: 'mes', write: 'planejar',
      intro: 'Efetivo previsto por função e mês. Use o dia 1 de cada mês.',
      cols: [{ k: 'mes', l: 'Mês (dia 1)', t: 'date', req: true }, { k: 'funcao', l: 'Função', req: true, list: FUNCOES }, { k: 'quantidade', l: 'Quantidade', t: 'num', d: 0, req: true, sum: true }] }) }
  ]);
}
const FUNCOES = ['Engenheiro', 'Auxiliar de engenharia', 'Encarregado', 'Apontador', 'Topógrafo', 'Auxiliar de topografia', 'Operador de vibroacabadora', 'Operador de rolo', 'Operador de motoniveladora', 'Operador de escavadeira', 'Operador de retroescavadeira', 'Operador de pá carregadeira', 'Motorista de caminhão', 'Motorista de espargidor', 'Rasteleiro', 'Calceteiro', 'Pedreiro', 'Carpinteiro', 'Armador', 'Servente', 'Ajudante', 'Mecânico', 'Lubrificador', 'Vigia', 'Almoxarife', 'Técnico de segurança'];
