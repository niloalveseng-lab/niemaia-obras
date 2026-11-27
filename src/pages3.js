'use strict';
/* ================= MEDIÇÃO ================= */
async function pgMedicao(el) {
  await crud(el, {
    table: 'medicoes', title: 'Medições', doc: 'MEDICOES', order: 'numero', asc: false, write: 'medir', novo: 'Nova medição',
    intro: 'Boletim, memória de cálculo e checklist SEPLAN por medição. O sistema bloqueia quantidade acumulada acima do contratado e trava a medição aprovada.',
    cols: [{ k: 'numero', l: 'Nº', t: 'num', d: 0 }, { k: 'periodo_inicio', l: 'Início', t: 'date' }, { k: 'periodo_fim', l: 'Fim', t: 'date' }, { k: 'status', l: 'Situação', t: 'sel', o: L.status_med, badge: true }, { k: 'data_envio', l: 'Enviada em', t: 'date' }, { k: 'observacoes', l: 'Observações' }],
    abrir: async (r) => {
      if (r) return medEditor(r.id);
      const ant = await q(sb.from('medicoes').select('numero,periodo_fim').eq('obra_id', S.obra.id).order('numero', { ascending: false }).limit(1));
      const C = [{ k: 'numero', l: 'Número', t: 'num', req: true, def: ant.length ? ant[0].numero + 1 : 1 }, { k: 'periodo_inicio', l: 'Início do período', t: 'date', req: true, def: ant.length ? addDias(ant[0].periodo_fim, 1) : (S.obra.data_inicio || hoje().slice(0, 8) + '01') }, { k: 'periodo_fim', l: 'Fim do período', t: 'date', req: true, def: hoje() }];
      const b = document.createElement('div'); b.className = 'form'; b.innerHTML = C.map(c => campoHtml(c)).join('');
      modal('Nova medição', b, [{ t: 'Criar', c: 'pri', f: async () => { const v = lerCampos(b, C); const m = await q(sb.from('medicoes').insert({ ...v, obra_id: S.obra.id }).select('id').single()); medEditor(m.id); } }]);
    }
  });
}
async function medDados(id) {
  const [m, itens, mi, docs] = await Promise.all([
    q(sb.from('medicoes').select('*').eq('id', id).single()),
    q(sb.from('vw_itens_saldo').select('*').eq('obra_id', S.obra.id).order('ordem')),
    q(sb.from('medicao_itens').select('*, med:medicao_id(numero)').eq('obra_id', S.obra.id)),
    q(sb.from('medicao_documentos').select('*').eq('medicao_id', id).order('ordem'))
  ]);
  const L2 = itens.map(i => {
    const doItem = mi.filter(x => x.orcamento_item_id === i.id);
    const anterior = soma(doItem.filter(x => x.med && x.med.numero < m.numero), x => x.quantidade - x.quantidade_glosada);
    const atual = doItem.find(x => x.medicao_id === id);
    return { i, anterior, atual, q: atual ? Number(atual.quantidade) : 0, g: atual ? Number(atual.quantidade_glosada) : 0, mem: atual ? (atual.memoria || '') : '' };
  });
  return { m, linhas: L2, docs };
}
async function medEditor(id) {
  const el = $('#cont'); el.innerHTML = '<div class="vazio">Carregando…</div>';
  const D = await medDados(id), m = D.m;
  const ro = !pode('medir') || (m.status === 'aprovada' && S.perfil !== 'admin');
  const glosaEd = pode('aprovar') && !ro;
  el.innerHTML = `<div class="bar"><button id="voltar">Voltar à lista</button><h1 style="margin:0 8px">Medição nº ${m.numero}</h1>${badge(m.status, L.status_med)}<span class="muted">Período ${dt(m.periodo_inicio)} a ${dt(m.periodo_fim)}</span></div>
  <div class="kpis" id="mk"></div>
  <div class="card"><div class="bar"><h3 style="margin:0">Itens</h3><span class="sp"></span>${ro ? '' : '<button id="puxar">Puxar da memória de cálculo e da produção de CBUQ</button>'}</div>
  <div class="tw"><table class="grid" id="tm"><thead><tr><th>Item</th><th>Descrição</th><th>Un</th><th class="n">Contratado</th><th class="n">Preço unit.</th><th class="n">Anterior</th><th class="n">Esta medição</th><th class="n">Glosa</th><th class="n">Acumulado</th><th class="n">Saldo</th><th class="n">Valor desta (R$)</th><th>Memória de cálculo</th></tr></thead><tbody></tbody><tfoot></tfoot></table></div></div>
  <div class="card"><h3 style="margin-top:0">Checklist da medição (SEPLAN)</h3><div id="ck"></div></div>
  <div class="card"><div class="form" id="mcab">${campoHtml({ k: 'observacoes', l: 'Observações (glosas, pendências da fiscalização)', t: 'area', w: 'wf' }, m.observacoes)}</div></div>
  <div class="bar" id="macoes"></div>`;
  if (ro) $$('#mcab textarea').forEach(x => x.disabled = true);
  const tb = $('#tm tbody');
  const desenhar = () => {
    tb.innerHTML = D.linhas.map((l, k) => { const i = l.i, ac = l.anterior + l.q - l.g, sd = i.qtd_contratada == null ? null : i.qtd_contratada - ac, exc = sd !== null && sd < -1e-6;
      return `<tr style="${exc ? 'background:var(--erf)' : ''}"><td>${h(i.item || i.ordem)}</td><td style="min-width:220px">${h(i.descricao)}</td><td>${h(i.unidade)}</td><td class="n">${nf(i.qtd_contratada)}</td><td class="n">${brl(i.preco_unitario)}</td><td class="n">${nf(l.anterior)}</td>
      <td class="ed n"><input type="number" step="any" data-k="${k}" data-c="q" value="${l.q || ''}" ${ro ? 'disabled' : ''} style="width:110px"></td><td class="ed n"><input type="number" step="any" data-k="${k}" data-c="g" value="${l.g || ''}" ${glosaEd ? '' : 'disabled'} style="width:90px"></td>
      <td class="n">${nf(ac)}</td><td class="n">${nf(sd)}</td><td class="n">${brl((l.q - l.g) * (Number(i.preco_unitario) || 0))}</td><td class="ed"><textarea data-k="${k}" data-c="mem" ${ro ? 'disabled' : ''} style="min-height:34px;min-width:240px;font-size:12px">${h(l.mem)}</textarea></td></tr>`; }).join('') || '<tr><td colspan="12" class="vazio">Orçamento sem itens.</td></tr>';
    totais();
  };
  const totais = () => {
    const vAt = soma(D.linhas, l => (l.q - l.g) * (Number(l.i.preco_unitario) || 0)), vAc = soma(D.linhas, l => (l.anterior + l.q - l.g) * (Number(l.i.preco_unitario) || 0)), vC = soma(D.linhas, l => l.i.valor_contratado);
    $('#tm tfoot').innerHTML = `<tr><td colspan="10">Total</td><td class="n">${brl(vAt)}</td><td></td></tr>`;
    $('#mk').innerHTML = `<div class="kpi"><span>Valor desta medição</span><b>${brl(vAt)}</b><small>${D.linhas.filter(l => l.q).length} itens medidos</small></div><div class="kpi"><span>Acumulado medido</span><b>${brl(vAc)}</b><small>${vC ? pct(100 * vAc / vC) + ' do contratado' : 'preços a preencher'}</small></div><div class="kpi"><span>Saldo contratual</span><b>${vC ? brl(vC - vAc) : '–'}</b><small>valor dos itens: ${brl(vC)}</small></div><div class="kpi"><span>Checklist</span><b>${D.docs.filter(d => d.entregue).length}/${D.docs.length}</b><small>documentos entregues</small></div>`;
  };
  tb.addEventListener('input', e => { const t = e.target, k = t.dataset.k; if (k === undefined) return; const l = D.linhas[k]; if (t.dataset.c === 'mem') l.mem = t.value; else { l[t.dataset.c] = t.value === '' ? 0 : Number(t.value); const tr = t.closest('tr'), i = l.i, ac = l.anterior + l.q - l.g, sd = i.qtd_contratada == null ? null : i.qtd_contratada - ac; tr.children[8].textContent = nf(ac); tr.children[9].textContent = nf(sd); tr.children[10].textContent = brl((l.q - l.g) * (Number(i.preco_unitario) || 0)); tr.style.background = sd !== null && sd < -1e-6 ? 'var(--erf)' : ''; totais(); } });
  desenhar();
  const ck = $('#ck');
  ck.innerHTML = `<div class="tw"><table class="grid"><thead><tr><th>Documento</th><th>Entregue</th><th>Validade</th><th>Observação</th></tr></thead><tbody>${D.docs.map((d, k) => `<tr><td>${h(d.documento)}</td><td class="ed"><input type="checkbox" data-d="${k}" data-c="entregue" ${d.entregue ? 'checked' : ''} ${ro ? 'disabled' : ''} style="width:auto"></td><td class="ed"><input type="date" data-d="${k}" data-c="validade" value="${d.validade || ''}" ${ro ? 'disabled' : ''}></td><td class="ed"><input data-d="${k}" data-c="observacao" value="${h(d.observacao || '')}" ${ro ? 'disabled' : ''}></td></tr>`).join('')}</tbody></table></div>`;
  ck.addEventListener('change', e => { const t = e.target, k = t.dataset.d; if (k === undefined) return; D.docs[k][t.dataset.c] = t.type === 'checkbox' ? t.checked : (t.value || null); D.docs[k]._mud = true; totais(); });

  if (!ro) $('#puxar').onclick = async () => {
    const [sv, cb] = await Promise.all([
      q(sb.from('memoria_calculo').select('*').eq('obra_id', S.obra.id).gte('data', m.periodo_inicio).lte('data', m.periodo_fim)),
      q(sb.from('producao_cbuq').select('*').eq('obra_id', S.obra.id).gte('data', m.periodo_inicio).lte('data', m.periodo_fim))
    ]);
    const acc = {}; const add = (iid, qd, txt) => { if (!iid) return; acc[iid] = acc[iid] || { q: 0, m: [] }; acc[iid].q += qd; acc[iid].m.push(txt); };
    const est = x => [x.estaca_ini, x.estaca_fim].filter(Boolean).join(' a ');
    sv.sort((a, b) => a.data < b.data ? -1 : 1).forEach(s => add(s.orcamento_item_id, Number(s.quantidade) || 0, `${dt(s.data)} – ${s.local || ''} – ${s.formula || nf(s.quantidade)}`));
    const itMap = Object.fromEntries(D.linhas.map(l => [l.i.id, l.i]));
    cb.sort((a, b) => a.data < b.data ? -1 : 1).forEach(c => { const it = itMap[c.orcamento_item_id]; if (!it) return; const t = String(it.unidade).toLowerCase() === 't'; add(c.orcamento_item_id, t ? Number(c.massa_teorica) : Number(c.area), `${dt(c.data)} – ${c.local}${est(c) ? ' – est. ' + est(c) : ''}${c.lado ? ' – ' + c.lado : ''}: ${nf(c.area)} m²${t ? ` × ${nf(c.espessura, 3)} m × ${nf(c.densidade)} t/m³ = ${nf(c.massa_teorica, 3)} t` : ''}${c.tickets ? ' (tickets ' + c.tickets + ')' : ''}`); });
    let n = 0; D.linhas.forEach(l => { const a = acc[l.i.id]; if (a) { l.q = Math.round(a.q * 10000) / 10000; l.mem = a.m.join('\n'); n++; } });
    desenhar(); toast(n ? `${n} itens preenchidos com a memória do período. Confira antes de salvar.` : 'Sem memória de cálculo nem produção de CBUQ no período.');
  };
  const salvar = async () => {
    const obs = $('#f_observacoes').value || null;
    if (obs !== m.observacoes) await q(sb.from('medicoes').update({ observacoes: obs }).eq('id', id));
    const ord = [...D.linhas].sort((a, b) => (a.q - a.g) - (b.q - b.g));
    for (const l of ord) {
      if (l.q > 0) { const p = { medicao_id: id, obra_id: S.obra.id, orcamento_item_id: l.i.id, quantidade: l.q, quantidade_glosada: l.g || 0, memoria: l.mem || null }; if (l.atual) await q(sb.from('medicao_itens').update(p).eq('id', l.atual.id)); else l.atual = await q(sb.from('medicao_itens').insert(p).select().single()); }
      else if (l.atual) { await q(sb.from('medicao_itens').delete().eq('id', l.atual.id)); l.atual = null; }
    }
    for (const d of D.docs.filter(x => x._mud)) { await q(sb.from('medicao_documentos').update({ entregue: d.entregue, validade: d.validade, observacao: d.observacao }).eq('id', d.id)); d._mud = false; }
    toast('Medição salva', 'ok');
  };
  const ac = $('#macoes'); const b = (t, c, f) => { const x = document.createElement('button'); x.textContent = t; if (c) x.className = c; x.onclick = async () => { x.disabled = true; try { await f(); } catch (e) { erro(e); } x.disabled = false; }; ac.appendChild(x); };
  const st = async s => { await q(sb.from('medicoes').update({ status: s, ...(s === 'em_analise' ? { data_envio: hoje() } : {}) }).eq('id', id)); medEditor(id); };
  if (!ro) {
    b('Salvar', 'pri', salvar);
    if (m.status === 'rascunho') b('Salvar e enviar à fiscalização', '', async () => { const falta = D.docs.filter(d => !d.entregue).length; await salvar(); if (falta) toast(`Atenção: ${falta} documento(s) do checklist ainda pendente(s).`, 'erro'); await st('em_analise'); });
  }
  if (pode('aprovar') && m.status !== 'aprovada') {
    b('Aprovar medição', 'ok', async () => { await salvar(); await st('aprovada'); });
    if (m.status === 'em_analise') b('Registrar glosa parcial', '', async () => { await salvar(); await st('glosada_parcial'); });
  }
  if (S.perfil === 'admin' && m.status === 'aprovada') b('Reabrir (administrador)', '', () => st('rascunho'));
  const cab = () => [`Medição nº ${m.numero} – período de ${dt(m.periodo_inicio)} a ${dt(m.periodo_fim)}`, `Situação: ${L.status_med[m.status]}${m.data_envio ? ' – enviada em ' + dt(m.data_envio) : ''}`];
  const hB = ['Item', 'Descrição', 'Un', 'Qtd contratada', 'Preço unit. (R$)', 'Qtd anterior', 'Qtd desta medição', 'Glosa', 'Qtd acumulada', 'Saldo', 'Valor desta (R$)', 'Valor acumulado (R$)'];
  const linB = () => D.linhas.filter(l => l.q || l.anterior).map(l => { const i = l.i, pu = Number(i.preco_unitario) || 0, ac2 = l.anterior + l.q - l.g; return [i.item || String(i.ordem), i.descricao, i.unidade, num(i.qtd_contratada), num(i.preco_unitario), l.anterior, l.q, l.g, ac2, i.qtd_contratada == null ? null : i.qtd_contratada - ac2, (l.q - l.g) * pu, ac2 * pu]; });
  b('Boletim (Excel)', '', () => { const r = linB(); xlsxExport(`MEDICAO_${String(m.numero).padStart(2, '0')}_BOLETIM`, 'Boletim de medição', hB, r, { sub: cab(), total: ['Total', '', '', null, null, null, null, null, null, null, soma(r, x => x[10]), soma(r, x => x[11])], fmt: [null, null, null, '#,##0.00', '"R$" #,##0.00', '#,##0.00', '#,##0.00', '#,##0.00', '#,##0.00', '#,##0.00', '"R$" #,##0.00', '"R$" #,##0.00'] }); });
  b('Boletim (PDF)', '', () => { const r = linB(); const P = pdfNovo('Boletim de medição', true); cab().forEach(s => P.texto(s, { s: 9.5, dep: 0.5 })); P.y += 2;
    P.tabela(hB, r.map(x => x.map((v, k) => k < 3 ? v : k === 4 || k >= 10 ? brl(v) : nf(v))), { fs: 7.5, foot: ['Total', '', '', '', '', '', '', '', '', '', brl(soma(r, x => x[10])), brl(soma(r, x => x[11]))], cols: { 1: { cellWidth: 70 } } });
    P.assinaturas(['Responsável técnico – NIEMAIA', 'Fiscalização – Contratante', 'Gestor do contrato']); P.salvar(`MEDICAO_${String(m.numero).padStart(2, '0')}_BOLETIM`); });
  const linM = () => D.linhas.filter(l => l.q).flatMap(l => { const ls = (l.mem || 'Memória a preencher').split('\n'); return ls.map((t, k) => [k ? '' : (l.i.item || String(l.i.ordem)), k ? '' : l.i.descricao, k ? '' : l.i.unidade, t, k ? null : l.q - l.g]); });
  b('Memória de cálculo (PDF)', '', () => { const P = pdfNovo('Memória de cálculo', true); cab().forEach(s => P.texto(s, { s: 9.5, dep: 0.5 })); P.y += 2; P.tabela(['Item', 'Descrição', 'Un', 'Memória (data – rua – estacas – lado: quantidade)', 'Quantidade'], linM().map(x => [x[0], x[1], x[2], x[3], x[4] == null ? '' : nf(x[4])]), { fs: 7.5, cols: { 1: { cellWidth: 60 }, 3: { cellWidth: 130 } } }); P.assinaturas(['Responsável técnico – NIEMAIA', 'Fiscalização – Contratante']); P.salvar(`MEDICAO_${String(m.numero).padStart(2, '0')}_MEMORIA`); });
  b('Memória de cálculo (Excel)', '', () => xlsxExport(`MEDICAO_${String(m.numero).padStart(2, '0')}_MEMORIA`, 'Memória de cálculo', ['Item', 'Descrição', 'Un', 'Memória', 'Quantidade'], linM(), { sub: cab() }));
  if (pode('aprovar') && (m.status !== 'aprovada' || S.perfil === 'admin')) b('Excluir medição', 'er', () => confirma(`Excluir a medição nº ${m.numero}?`, async () => { await q(sb.from('medicoes').delete().eq('id', id)); rotear(); }));
  $('#voltar').onclick = () => rotear();
}

/* ================= RELATÓRIOS ================= */
async function pgRelatorios(el) {
  const ini0 = hoje().slice(0, 8) + '01';
  const R = [
    ['rdos', 'RDOs do período (PDF)', 'Um RDO por página, com assinaturas. Marque para incluir as fotos.', true],
    ['foto', 'Relatório fotográfico (PDF)', '2 fotos por página, legenda no padrão [Obra] – [Serviço] – [Rua/Est.] – L[E/D].'],
    ['ger', 'Relatório gerencial (PDF)', 'Indicadores, alertas, saldo dos itens e situação da EAP.'],
    ['serv', 'Serviços executados por rua e estaca (Excel)', 'Tudo o que foi lançado na memória de cálculo no período.'],
    ['efet', 'Efetivo diário por função (Excel)', 'Matriz data × função, para relação de funcionários e histograma.'],
    ['cbuq', 'Produção de CBUQ e ligantes (Excel)', 'Área, massa teórica, balança, ligante previsto e aplicado.'],
    ['equip', 'Horas de equipamentos (Excel)', 'Produtivas, improdutivas, paradas e diesel por prefixo.']
  ];
  el.innerHTML = '<div id="relw"></div>'; el = $('#relw');
  el.innerHTML = `<p class="muted">Todos no padrão NIEMAIA: logo, obra, título, data de emissão, usuário e paginação. Nome do arquivo: OBRA_DOCUMENTO_DATA.</p>
  <div class="card bar"><label>De <input type="date" id="ri" value="${ini0}"></label><label>Até <input type="date" id="rf" value="${hoje()}"></label></div>
  <div class="g3">${R.map(([k, t, d, ft]) => `<div class="card"><h3 style="margin-top:0">${t}</h3><p class="muted">${d}</p>${ft ? '<label class="chk"><input type="checkbox" id="rfo"><span>Incluir fotos</span></label>' : ''}<button class="pri" data-r="${k}">Gerar</button></div>`).join('')}</div>`;
  el.onclick = async e => {
    const k = e.target.dataset && e.target.dataset.r; if (!k) return;
    const ini = $('#ri').value, fim = $('#rf').value, per = `Período: ${dt(ini)} a ${dt(fim)}`, bt = e.target; bt.disabled = true;
    try {
      if (k === 'rdos') {
        const rs = await q(sb.from('rdo').select('id,data').eq('obra_id', S.obra.id).gte('data', ini).lte('data', fim).order('data'));
        if (!rs.length) throw new Error('Nenhum RDO no período.');
        const P = pdfNovo('Relatório Diário de Obra – ' + per.replace('Período: ', ''));
        for (const [n, r] of rs.entries()) { if (n) { P.doc.addPage(); P.y = 32; } const D = await rdoCarregar(r.id); P.texto(`RDO de ${dt(r.data)}`, { b: true, s: 12 }); rdoPdf(P, D); if ($('#rfo').checked && D.fotos.length) await fotosPdf(P, D.fotos); }
        P.salvar('RDO_PERIODO');
      } else if (k === 'foto') {
        const fs = await q(sb.from('fotos').select('*').eq('obra_id', S.obra.id).gte('data_hora', ini + 'T00:00:00').lte('data_hora', fim + 'T23:59:59').order('data_hora'));
        if (!fs.length) throw new Error('Nenhuma foto no período.');
        const P = pdfNovo('Relatório fotográfico'); P.texto(per, { s: 10 }); P.texto(`${fs.length} fotos.`, { s: 10 });
        await fotosPdf(P, fs); P.salvar('RELATORIO_FOTOGRAFICO');
      } else if (k === 'ger') {
        const D = await dadosPainel(), K = indicadores(D), al = alertas(D, K);
        const P = pdfNovo('Relatório gerencial', true);
        P.tabela(['Indicador', 'Valor'], [['Avanço físico (itens)', pct(K.fisItens)], ['Avanço físico (EAP) / previsto hoje', `${pct(K.fisEap)} / ${pct(K.prevHoje)}`], ['Valor contratado', K.valorContr ? brl(K.valorContr) : '[a preencher]'], ['Valor executado', K.temPreco ? brl(K.execValor) : 'preços a preencher'], ['Medido aprovado', brl(K.medAprov)], ...(K.cbuqContr ? [['CBUQ aplicado (teórico) / contratado', `${nf(K.cbuqT, 1)} t / ${nf(K.cbuqContr, 1)} t`], ['CBUQ pela balança', `${nf(K.balT, 1)} t`]] : []), ...(pode('custos') ? [['Custo real', brl(K.custo)]] : []), ['Efetivo no último RDO', K.ultDia ? `${K.porDia[K.ultDia]} (${dt(K.ultDia)})` : '–']], { cols: { 0: { cellWidth: 90 } } });
        P.texto('Alertas', { b: true, s: 11 }); (al.length ? al : [['', 'Sem alertas.']]).forEach(([, t]) => P.texto('• ' + t, { s: 9.5, dep: 0.5 })); P.y += 3;
        P.texto('Saldo dos itens', { b: true, s: 11 });
        P.tabela(['Descrição', 'Un', 'Contratado', 'Executado', '% exec.', 'Medido', 'Saldo'], D.itens.map(i => [i.descricao, i.unidade, nf(i.qtd_contratada), nf(i.qtd_executada), pct(i.perc_executado), nf(i.qtd_medida_total), nf(i.qtd_saldo)]), { fs: 8 });
        P.texto('EAP', { b: true, s: 11 });
        P.tabela(['Atividade', 'Frente', 'Início prev.', 'Fim prev.', '% exec.', 'Situação'], D.eap.map(a => [`${a.codigo || ''} ${a.nome}`, a.frente || '', dt(a.inicio_previsto), dt(a.fim_previsto), nf(a.percentual_executado, 0) + '%', L.status_eap[a.status]]), { fs: 8 });
        P.salvar('RELATORIO_GERENCIAL');
      } else if (k === 'serv') {
        const sv = await q(sb.from('memoria_calculo').select('*, it:orcamento_item_id(codigo,descricao,unidade)').eq('obra_id', S.obra.id).gte('data', ini).lte('data', fim));
        sv.sort((a, b) => (a.local || '').localeCompare(b.local || '') || (a.data < b.data ? -1 : 1));
        xlsxExport('SERVICOS', 'Serviços executados (memória de cálculo)', ['Data', 'Rua / local', 'Est. inicial', 'Est. final', 'Lado', 'Código', 'Item do orçamento', 'Compr.', 'Larg.', 'Quantidade', 'Un', 'Memória'], sv.map(s => [dt(s.data), s.local, estTxt(s.est_ini_int, s.est_ini_frac), estTxt(s.est_fim_int, s.est_fim_frac), s.lado, s.it ? s.it.codigo : '', s.it ? s.it.descricao : '', num(s.comprimento), num(s.largura), num(s.quantidade), s.it ? s.it.unidade : '', s.formula || '']), { sub: [per] });
      } else if (k === 'efet') {
        const ef = await q(sb.from('rdo_efetivo').select('funcao,quantidade,rdo:rdo_id!inner(data)').eq('obra_id', S.obra.id).gte('rdo.data', ini).lte('rdo.data', fim));
        const ds = [...new Set(ef.map(x => x.rdo.data))].sort(), fs = [...new Set(ef.map(x => x.funcao))].sort();
        const body = ds.map(d => [dt(d), ...fs.map(f => soma(ef.filter(x => x.rdo.data === d && x.funcao === f), x => x.quantidade)), soma(ef.filter(x => x.rdo.data === d), x => x.quantidade)]);
        xlsxExport('EFETIVO', 'Efetivo diário por função', ['Data', ...fs, 'Total'], body, { sub: [per], fmt: [null, ...fs.map(() => '0'), '0'] });
      } else if (k === 'cbuq') {
        const cb = await q(sb.from('producao_cbuq').select('*').eq('obra_id', S.obra.id).gte('data', ini).lte('data', fim).order('data'));
        const body = cb.map(c => [dt(c.data), c.local, c.estaca_ini, c.estaca_fim, c.lado, L.tipo_area[c.tipo_area], num(c.area), num(c.espessura), num(c.densidade), num(c.massa_teorica), c.tickets, num(c.massa_balanca), num(c.diferenca_t), L.ligante[c.ligante], num(c.taxa_ligante_prevista), Number(c.area) * Number(c.taxa_ligante_prevista), num(c.ligante_aplicado_l)]);
        xlsxExport('PRODUCAO_CBUQ', 'Produção de CBUQ e ligantes', ['Data', 'Rua / local', 'Est. ini.', 'Est. fim', 'Lado', 'Tipo de área', 'Área (m²)', 'Espessura (m)', 'Densidade (t/m³)', 'Massa teórica (t)', 'Tickets', 'Balança (t)', 'Diferença (t)', 'Ligante', 'Taxa (l/m²)', 'Ligante previsto (l)', 'Ligante aplicado (l)'], body,
          { sub: [per], total: ['Total', '', '', '', '', '', soma(cb, c => c.area), null, null, soma(cb, c => c.massa_teorica), '', soma(cb, c => c.massa_balanca), soma(cb, c => c.diferenca_t), '', null, soma(body, r => r[15]), soma(cb, c => c.ligante_aplicado_l)], fmt: [null, null, null, null, null, null, '#,##0.00', '0.000', '0.00', '#,##0.000', null, '#,##0.000', '#,##0.000', null, '0.00', '#,##0.0', '#,##0.0'] });
      } else if (k === 'equip') {
        const R2 = await horasEquip(ini, fim);
        xlsxExport('HORAS_EQUIP', 'Horas de equipamentos', ['Prefixo', 'Equipamento', 'Dias apont.', 'H prod.', 'H improd.', 'H parada', 'Disponib. %', 'Utiliz. %', 'Diesel (l)', 'l/h'], R2.map(x => [x.e.prefixo, x.e.descricao, x.dias, x.p, x.i, x.pa, x.disp, x.util, x.d, x.lh]), { sub: [per] });
      }
    } catch (x) { erro(x); }
    bt.disabled = false;
  };
}

/* ================= USUÁRIOS ================= */
async function pgUsuarios(el) {
  abas(el, [
    { t: 'Usuários e perfis', f: async c => {
      const [ps, uo, obras] = await Promise.all([q(sb.from('perfis').select('*').order('nome')), q(sb.from('usuarios_obras').select('*')), q(sb.from('obras').select('id,codigo,nome').order('codigo'))]);
      const oc = Object.fromEntries(obras.map(o => [o.id, o.codigo]));
      const perfisOp = Object.entries(L.perfil).filter(([k]) => k !== 'admin');
      const acessoHtml = p => p.admin ? '<span class="badge b-er"><i class="ti ti-crown"></i>Administrador – acesso total</span>' : (uo.filter(x => x.user_id === p.id).map(x => `<span class="badge b-la" style="margin:2px">${h(oc[x.obra_id])} – ${h(L.perfil[x.perfil])}</span>`).join('') || '<span class="badge b-av">Sem obra liberada</span>');
      c.innerHTML = `<div class="bar"><p class="muted" style="margin:0;flex:1">Cadastre cada pessoa aqui, com a função em cada obra (ou Administrador, que acessa tudo). O sistema gera uma senha provisória para você enviar; no primeiro acesso a pessoa troca a senha no botão da chave, no topo. Para mudar dados, função ou obras depois, use <b>Editar</b>.</p><button class="pri" id="uNovo"><i class="ti ti-user-plus"></i>Novo usuário</button></div>
      <div class="tw"><table class="grid lst"><thead><tr><th>Nome</th><th>E-mail</th><th>Cargo</th><th>Função / acesso</th><th>Situação</th><th></th></tr></thead><tbody>${ps.map(p => `<tr data-u="${p.id}"><td data-l="Nome"><b>${h(p.nome)}</b>${p.id === S.me.id ? ' <span class="muted">(você)</span>' : ''}</td><td data-l="E-mail">${h(p.email)}</td><td data-l="Cargo">${h(p.cargo || '–')}</td><td data-l="Acesso">${acessoHtml(p)}</td><td data-l="Situação">${p.ativo ? '<span class="badge b-ok">Ativo</span>' : '<span class="badge b-er">Bloqueado</span>'}</td>
      <td data-l=""><div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end"><button data-ed title="Editar dados, função e obras"><i class="ti ti-pencil"></i>Editar</button>${p.id === S.me.id ? '' : '<button data-senha title="Gerar nova senha provisória"><i class="ti ti-key"></i>Nova senha</button><button class="er" data-del title="Excluir usuário"><i class="ti ti-trash"></i>Excluir</button>'}</div></td></tr>`).join('')}</tbody></table></div>`;
      const credenciais = (nome, email, senha) => {
        const txt = `Olá, ${nome.split(' ')[0]}! Seu acesso ao sistema de Gestão de Obras da NIEMAIA está pronto.\nEndereço: ${location.origin + location.pathname}\nE-mail: ${email}\nSenha provisória: ${senha}\nEntre e troque a senha no botão da chave, no topo da tela.`;
        modal('Acesso pronto', `<p>Envie os dados abaixo para a pessoa (WhatsApp ou e-mail). A senha não fica salva para consulta depois.</p><textarea id="cred" style="min-height:130px" readonly>${h(txt)}</textarea>`, [{ t: 'Copiar mensagem', c: 'pri', f: async o => { try { await navigator.clipboard.writeText($('#cred', o).value); toast('Mensagem copiada', 'ok'); } catch (e) { $('#cred', o).select(); toast('Selecione e copie o texto (Ctrl+C).'); } return false; } }]);
      };
      /* formulário único: novo e editar */
      const formUsuario = p => {
        const eu = p && p.id === S.me.id; const meus = p ? Object.fromEntries(uo.filter(x => x.user_id === p.id).map(x => [x.obra_id, x.perfil])) : {};
        const b = document.createElement('div');
        b.innerHTML = `<div class="form"><div class="w2"><label for="nN">Nome completo *</label><input id="nN" autocomplete="off" value="${h(p ? p.nome || '' : '')}"></div><div><label for="nE">E-mail (login) *</label><input id="nE" type="email" autocomplete="off" value="${h(p ? p.email || '' : '')}"></div><div><label for="nC">Cargo</label><input id="nC" list="dlCargo" value="${h(p ? p.cargo || '' : '')}"><datalist id="dlCargo">${['Engenheiro civil', 'Auxiliar de engenharia', 'Encarregado', 'Apontador', 'Almoxarife', 'Técnico de segurança', 'Topógrafo', 'Financeiro', 'Fiscal da Prefeitura'].map(x => `<option value="${x}">`).join('')}</datalist></div>
        ${p ? `<div><label for="nAt">Situação</label><select id="nAt" ${eu ? 'disabled' : ''}><option value="1" ${p.ativo ? 'selected' : ''}>Ativo</option><option value="0" ${p.ativo ? '' : 'selected'}>Bloqueado (não entra no sistema)</option></select></div>` : `<div><label for="nS">Senha provisória *</label><div style="display:flex;gap:6px"><input id="nS" value="${senhaProvisoria()}"><button type="button" id="nG" title="Gerar outra"><i class="ti ti-refresh"></i></button></div></div>`}
        <div class="wf"><label for="nF">Função no sistema *</label><select id="nF" ${eu ? 'disabled' : ''}><option value="obra" ${p && p.admin ? '' : 'selected'}>Por obra – escolher a função em cada obra abaixo</option><option value="admin" ${p && p.admin ? 'selected' : ''}>Administrador – acesso total: todas as obras, todos os módulos, usuários e aprovações</option></select>${eu ? '<div class="muted">Você não pode alterar a própria função nem se bloquear.</div>' : ''}</div></div>
        <div id="nObras"><h3>Função em cada obra</h3><div class="tw"><table class="grid"><thead><tr><th>Obra</th><th>Função</th></tr></thead><tbody>${obras.map(o => `<tr><td><b>${h(o.codigo)}</b> – ${h(o.nome)}</td><td class="ed"><select data-ob="${o.id}"><option value="">Sem acesso</option>${perfisOp.map(([k, l]) => `<option value="${k}" ${meus[o.id] === k ? 'selected' : ''}>${h(l)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
        <p class="muted">Engenheiro gestor aprova RDO e medição; auxiliar lança tudo sem aprovar; apontador lança RDO e produção, sem custos; almoxarife cuida de suprimentos; fiscal só consulta.</p></div>`;
        const vis = () => { $('#nObras', b).style.display = $('#nF', b).value === 'admin' ? 'none' : ''; }; $('#nF', b).onchange = vis; vis();
        if ($('#nG', b)) $('#nG', b).onclick = () => { $('#nS', b).value = senhaProvisoria(); };
        modal(p ? `Editar usuário – ${p.nome}` : 'Novo usuário', b, [{ t: p ? 'Salvar' : 'Cadastrar', c: 'pri', f: async () => {
          const nome = $('#nN', b).value.trim(), email = $('#nE', b).value.trim().toLowerCase(), cargo = $('#nC', b).value.trim() || null, adm = $('#nF', b).value === 'admin';
          if (!nome || !email) throw new Error('Preencha nome e e-mail.');
          const acessos = $$('select[data-ob]', b).filter(s => s.value).map(s => ({ obra_id: s.dataset.ob, perfil: s.value }));
          if (!adm && !acessos.length) throw new Error('Escolha a função em pelo menos uma obra ou marque Administrador.');
          if (!p) {
            const senha = $('#nS', b).value;
            await fnAdmin({ acao: 'criar', nome, email, senha, cargo, admin: adm, acessos });
            toast('Usuário cadastrado', 'ok'); pgUsuarios(el); setTimeout(() => credenciais(nome, email, senha), 300); return;
          }
          if (email !== (p.email || '').toLowerCase()) await fnAdmin({ acao: 'email', user_id: p.id, email });
          const upd = { nome, cargo }; if (!eu) { upd.admin = adm; upd.ativo = $('#nAt', b).value === '1'; }
          await q(sb.from('perfis').update(upd).eq('id', p.id));
          if (!adm) {
            const quer = Object.fromEntries(acessos.map(a => [a.obra_id, a.perfil]));
            const tirar = Object.keys(meus).filter(o => !quer[o]);
            if (tirar.length) await q(sb.from('usuarios_obras').delete().eq('user_id', p.id).in('obra_id', tirar));
            const mudar = acessos.filter(a => meus[a.obra_id] !== a.perfil);
            if (mudar.length) await q(sb.from('usuarios_obras').upsert(mudar.map(a => ({ user_id: p.id, ...a })), { onConflict: 'user_id,obra_id' }));
          }
          toast('Usuário atualizado', 'ok'); if (eu) { S.me.nome = nome; } pgUsuarios(el);
        } }]);
      };
      $('#uNovo').onclick = () => formUsuario(null);
      c.onclick = async e => {
        const tr = e.target.closest('tr[data-u]'); if (!tr) return; const bt = e.target.closest('button'); if (!bt) return; const p = ps.find(x => x.id === tr.dataset.u);
        try {
          if (bt.hasAttribute('data-ed')) formUsuario(p);
          if (bt.hasAttribute('data-del')) confirma(`Excluir ${p.nome} (${p.email})? O acesso e as liberações de obra serão apagados e não há como desfazer. Se a pessoa tiver lançamentos (RDO, memória, abastecimentos, fotos), o sistema não exclui: bloqueie em Editar → Situação.`, async () => { await fnAdmin({ acao: 'excluir', user_id: p.id }); toast(`${p.nome} excluído`, 'ok'); pgUsuarios(el); });
          if (bt.hasAttribute('data-senha')) confirma(`Gerar nova senha provisória para ${p.nome}? A senha atual deixa de valer.`, async () => { const s = senhaProvisoria(); await fnAdmin({ acao: 'senha', user_id: p.id, senha: s }); setTimeout(() => credenciais(p.nome, p.email, s), 200); });
        } catch (x) { erro(x); }
      };
    } },
    { t: 'Registro de alterações', f: async c => {
      const ps = Object.fromEntries((await q(sb.from('perfis').select('id,nome'))).map(p => [p.id, p.nome]));
      await crud(c, { table: 'auditoria', title: 'Registro de alterações', doc: 'AUDITORIA', order: 'em', asc: false, limit: 500, paisagem: true,
        intro: 'Últimas 500 alterações desta obra: quem mudou, o quê e quando.',
        abrir: r => modal('Alteração', `<p><b>${h(r.tabela)}</b> · ${h(r.acao)} · ${new Date(r.em).toLocaleString('pt-BR')} · ${h(ps[r.usuario] || 'sistema')}</p><div class="g2"><div><h3>Antes</h3><pre style="font-size:12px;white-space:pre-wrap">${h(JSON.stringify(r.antes, null, 1))}</pre></div><div><h3>Depois</h3><pre style="font-size:12px;white-space:pre-wrap">${h(JSON.stringify(r.depois, null, 1))}</pre></div></div>`),
        cols: [{ k: 'em', l: 'Data e hora', v: r => new Date(r.em).toLocaleString('pt-BR') }, { k: 'usuario', l: 'Usuário', v: r => ps[r.usuario] || 'sistema' }, { k: 'tabela', l: 'Tabela' }, { k: 'acao', l: 'Ação', v: r => ({ INSERT: 'Inclusão', UPDATE: 'Alteração', DELETE: 'Exclusão' }[r.acao]) }] });
    } }
  ]);
}
