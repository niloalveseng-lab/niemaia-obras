'use strict';
/* ================= PRODUÇÃO MENSAL (padrão RDP Tambor) ================= */
const estM = (i, f) => (i === null || i === undefined || i === '') ? null : Number(i) * 20 + (Number(f) || 0);
const estTxt = (i, f) => (i === null || i === undefined || i === '') ? '' : `${i}+${nf(Number(f) || 0, 2)}`;
function parseEst(t) { const m = String(t || '').match(/^\s*(\d+)\s*(?:\+\s*([\d.,]+))?\s*$/); return m ? [Number(m[1]), m[2] ? Number(m[2].replace(',', '.')) : 0] : [null, null]; }
const diasMes = ym => new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
const DSEM = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const CLIMA_COR = { bom: '#d8f0e2', nublado: '#e4e4e0', chuva_fraca: '#fdf0c4', chuva_forte: '#f8c9c4' };

/* calcula quantidade e fórmula de uma linha de memória conforme a unidade do item */
function calcMemoria(l, it) {
  const u = String(it ? it.unidade : '').toLowerCase().replace('2', '²').replace('3', '³');
  const a = estM(l.est_ini_int, l.est_ini_frac), b = estM(l.est_fim_int, l.est_fim_frac);
  let comp = l.comprimento;
  if (a !== null && b !== null) comp = Math.round((b - a) * 100) / 100;
  const r = { comprimento: comp }; let q = null, f = '';
  const est = a !== null && b !== null ? `Est. ${estTxt(l.est_ini_int, l.est_ini_frac)} a ${estTxt(l.est_fim_int, l.est_fim_frac)}${l.lado ? ' ' + l.lado : ''}: ` : '';
  if (u === 'm' && comp) { q = comp; f = `${est}${nf(comp)} m`; }
  else if (u === 'm²' && comp && l.largura) { q = comp * l.largura; f = `${est}${nf(comp)} m × ${nf(l.largura)} m = ${nf(q)} m²`; }
  else if (u === 'm³' && l.n_viagens && l.cap_viagem) { q = l.n_viagens * l.cap_viagem; f = `${est}${nf(l.n_viagens, 0)} viagens × ${nf(l.cap_viagem)} m³ = ${nf(q)} m³`; }
  else if (u === 'm³' && comp && l.largura && l.espessura) { q = comp * l.largura * l.espessura; f = `${est}${nf(comp)} × ${nf(l.largura)} × ${nf(l.espessura, 3)} m = ${nf(q, 3)} m³`; }
  else if (u === 't' && comp && l.largura && l.espessura) { q = comp * l.largura * l.espessura * 2.4; f = `${est}${nf(comp)} × ${nf(l.largura)} × ${nf(l.espessura, 3)} m × 2,40 t/m³ = ${nf(q, 3)} t`; }
  if (q !== null) { r.quantidade = Math.round(q * 10000) / 10000; r.formula = f; }
  else r.formula = l.quantidade != null ? `${est}${nf(l.quantidade)} ${it ? it.unidade : ''} (informado)` : '';
  return r;
}

async function pgProdMes(el) {
  abas(el, [
    { t: 'Quadro do mês', f: c => quadroMes(c) },
    { t: 'Memória de cálculo diária', f: c => memoriaDia(c) },
    { t: 'Metas e calendário', f: c => metasMes(c) },
    { t: 'Importar avanços (fichas)', f: c => importarAvancos(c) }
  ]);
}
let MES_SEL = hoje().slice(0, 7), DIA_SEL = hoje();

async function dadosMes(ym) {
  const ini = ym + '-01', fim = `${ym}-${String(diasMes(ym)).padStart(2, '0')}`, id = S.obra.id;
  const [itens, mem, memAcum, cb, cbAcum, metas, cal, rdos] = await Promise.all([
    q(sb.from('orcamento_itens').select('id,ordem,item,codigo,grupo,descricao,unidade,quantidade,preco_unitario').eq('obra_id', id).eq('ativo', true).order('ordem')),
    q(sb.from('memoria_calculo').select('*').eq('obra_id', id).gte('data', ini).lte('data', fim).order('data')),
    q(sb.from('memoria_calculo').select('orcamento_item_id,quantidade').eq('obra_id', id).lte('data', fim)),
    q(sb.from('producao_cbuq').select('data,orcamento_item_id,massa_teorica,area,local,estaca_ini,estaca_fim,lado,tickets').eq('obra_id', id).gte('data', ini).lte('data', fim)),
    q(sb.from('producao_cbuq').select('orcamento_item_id,massa_teorica,area').eq('obra_id', id).lte('data', fim)),
    q(sb.from('producao_metas').select('*').eq('obra_id', id).eq('mes', ini)),
    q(sb.from('meses_producao').select('*').eq('obra_id', id).eq('mes', ini)),
    q(sb.from('rdo').select('data,clima_manha,clima_tarde,condicao').eq('obra_id', id).gte('data', ini).lte('data', fim))
  ]);
  const itMap = Object.fromEntries(itens.map(i => [i.id, i]));
  const qCb = (c) => { const it = itMap[c.orcamento_item_id]; return it && String(it.unidade).toLowerCase() === 't' ? Number(c.massa_teorica) : Number(c.area); };
  const nd = diasMes(ym), dias = Array.from({ length: nd }, (_, k) => `${ym}-${String(k + 1).padStart(2, '0')}`);
  const calR = cal[0] || { feriados: [], sabado_produtivo: false };
  const fer = new Set(calR.feriados || []); const rdoD = Object.fromEntries(rdos.map(r => [r.data, r]));
  const util = d => { const w = new Date(d + 'T12:00:00').getDay(); return !fer.has(d) && w !== 0 && (w !== 6 || calR.sabado_produtivo); };
  const improd = dias.filter(d => util(d) && rdoD[d] && rdoD[d].condicao === 'impraticavel');
  const nUteis = dias.filter(util).length, nProd = nUteis - improd.length;
  const metaMap = Object.fromEntries(metas.map(m => [m.orcamento_item_id, m]));
  const porItemDia = {}; const add = (iid, d, v) => { porItemDia[iid] = porItemDia[iid] || {}; porItemDia[iid][d] = (porItemDia[iid][d] || 0) + v; };
  mem.forEach(m => add(m.orcamento_item_id, m.data, Number(m.quantidade)));
  cb.forEach(c => c.orcamento_item_id && add(c.orcamento_item_id, c.data, qCb(c)));
  const acum = {}; memAcum.forEach(m => acum[m.orcamento_item_id] = (acum[m.orcamento_item_id] || 0) + Number(m.quantidade));
  cbAcum.forEach(c => { if (c.orcamento_item_id) acum[c.orcamento_item_id] = (acum[c.orcamento_item_id] || 0) + qCb(c); });
  return { ym, ini, fim, itens, itMap, mem, cb, metaMap, calR, fer, rdoD, dias, util, improd, nUteis, nProd, porItemDia, acum };
}
function linhasQuadro(D, todos) {
  return D.itens.filter(i => todos || D.metaMap[i.id] || D.porItemDia[i.id]).map(i => {
    const pd = D.porItemDia[i.id] || {}, meta = D.metaMap[i.id] ? Number(D.metaMap[i.id].meta_dia) : null;
    const tot = soma(D.dias, d => pd[d]); const diasMeta = meta ? D.dias.filter(d => (pd[d] || 0) >= meta).length : null;
    const estip = meta ? meta * D.nProd : null; const ac = D.acum[i.id] || 0;
    return { i, pd, meta, tot, diasMeta, diasTrab: D.dias.filter(d => pd[d]).length, estip, saldo: estip === null ? null : estip - tot, ac, pc: i.quantidade ? 100 * ac / i.quantidade : null, equipe: (D.metaMap[i.id] && D.metaMap[i.id].equipe) || i.grupo || 'Sem grupo' };
  });
}
async function quadroMes(c) {
  c.innerHTML = `<div class="bar"><label>Mês <input type="month" id="qm" value="${MES_SEL}" style="width:auto"></label><label class="chk"><input type="checkbox" id="qt"><span>Mostrar todos os itens</span></label><span class="sp"></span>${pode('campo') ? '<button class="pri" id="qn">Lançar memória</button>' : ''}<button id="qx">Excel</button><button id="qp">PDF</button></div><div id="qc"><div class="vazio">Carregando…</div></div>`;
  let D;
  const desenhar = () => {
    const L2 = linhasQuadro(D, $('#qt').checked); const ds = D.dias;
    const grupos = [...new Set(L2.map(l => l.equipe))];
    const thDia = ds.map(d => { const w = new Date(d + 'T12:00:00').getDay(); const off = !D.util(d); return `<th class="n" style="min-width:52px;${off ? 'background:#ececea;color:#999' : ''}">${DSEM[w]}<br>${d.slice(8)}</th>`; }).join('');
    const clima = (per) => ds.map(d => { const r = D.rdoD[d]; const v = r && r[per]; const imp = r && r.condicao === 'impraticavel'; return `<td title="${v ? L.clima[v] : 'Sem RDO'}${imp ? ' · impraticável' : ''}" style="background:${imp ? '#f3a9a1' : (v ? CLIMA_COR[v] : (D.util(d) ? '#fff' : '#ececea'))}"></td>`; }).join('');
    $('#qc').innerHTML = `<div class="kpis"><div class="kpi"><span>Dias corridos</span><b>${ds.length}</b><small>${dt(D.ini)} a ${dt(D.fim)}</small></div><div class="kpi"><span>Dias produtivos</span><b>${D.nProd}</b><small>úteis ${D.nUteis} − improdutivos ${D.improd.length}</small></div><div class="kpi"><span>Sáb., dom. e feriados</span><b>${ds.length - D.nUteis}</b><small>${D.calR.feriados && D.calR.feriados.length ? 'Feriados: ' + D.calR.feriados.map(x => dt(x).slice(0, 5)).join(', ') : 'Feriados: cadastre em Metas e calendário'}</small></div><div class="kpi"><span>Lançamentos no mês</span><b>${D.mem.length + D.cb.length}</b><small>memória ${D.mem.length} · CBUQ ${D.cb.length}</small></div></div>
    <p class="muted">Clima vem do RDO: <span class="badge" style="background:${CLIMA_COR.bom}">bom</span> <span class="badge" style="background:${CLIMA_COR.nublado}">nublado</span> <span class="badge" style="background:${CLIMA_COR.chuva_fraca}">chuva fraca</span> <span class="badge" style="background:${CLIMA_COR.chuva_forte}">chuva forte</span> <span class="badge" style="background:#f3a9a1">impraticável</span>. Clique numa célula para ver ou lançar a memória daquele dia.</p>
    <div class="tw" style="max-height:72vh"><table class="grid" id="qtab" style="font-size:12.5px"><thead><tr><th style="position:sticky;left:0;z-index:3;background:#f7f7f5;min-width:260px">Item / serviço</th><th>Un</th><th class="n">Meta/dia</th>${thDia}<th class="n">Total mês</th><th class="n">Dias c/ meta</th><th class="n">Estipulado</th><th class="n">Saldo mês</th><th class="n">Acum. contrato</th><th class="n">% contrato</th></tr>
    <tr><td style="position:sticky;left:0;background:#fff" class="muted">Clima manhã</td><td></td><td></td>${clima('clima_manha')}<td colspan="6"></td></tr><tr><td style="position:sticky;left:0;background:#fff" class="muted">Clima tarde</td><td></td><td></td>${clima('clima_tarde')}<td colspan="6"></td></tr></thead>
    <tbody>${grupos.map(g => `<tr><td colspan="${ds.length + 9}" style="background:#fde8dd;font-weight:600;position:sticky;left:0">Equipe: ${h(g)}</td></tr>` + L2.filter(l => l.equipe === g).map(l => `<tr><td style="position:sticky;left:0;background:#fff">${h(l.i.codigo || '')} ${h(l.i.descricao)}</td><td>${h(l.i.unidade)}</td><td class="n">${nf(l.meta, 0)}</td>${ds.map(d => { const v = l.pd[d]; const bx = l.meta && v ? (v >= l.meta ? 'color:var(--ok);font-weight:600' : 'color:var(--av)') : ''; return `<td class="n" data-i="${l.i.id}" data-d="${d}" style="cursor:pointer;${D.util(d) ? '' : 'background:#f4f4f2;'}${bx}">${v ? nf(v, 1) : ''}</td>`; }).join('')}<td class="n"><b>${nf(l.tot)}</b></td><td class="n">${l.diasMeta ?? '–'}</td><td class="n">${nf(l.estip)}</td><td class="n" style="${l.saldo > 0 ? 'color:var(--er)' : 'color:var(--ok)'}">${l.saldo === null ? '–' : l.saldo > 0 ? nf(l.saldo) : 'OK'}</td><td class="n">${nf(l.ac)}</td><td class="n">${pct(l.pc)}</td></tr>`).join('')).join('') || `<tr><td colspan="${ds.length + 9}" class="vazio">Sem produção nem meta neste mês. Lance a memória diária ou cadastre as metas.</td></tr>`}</tbody></table></div>`;
  };
  const carregar = async () => { MES_SEL = $('#qm').value || MES_SEL; $('#qc').innerHTML = '<div class="vazio">Carregando…</div>'; D = await dadosMes(MES_SEL); desenhar(); };
  $('#qm').onchange = () => carregar().catch(erro); $('#qt').onchange = desenhar;
  $('#qc').onclick = e => { const td = e.target.closest('td[data-i]'); if (td) celulaMemoria(td.dataset.i, td.dataset.d, D, carregar); };
  if ($('#qn')) $('#qn').onclick = () => formMemoria(null, { data: hoje() }, carregar);
  const exp = (tipo) => {
    const L2 = linhasQuadro(D, $('#qt').checked); const ds = D.dias;
    const head = ['Equipe', 'Código', 'Serviço', 'Un', 'Meta/dia', ...ds.map(d => `${DSEM[new Date(d + 'T12:00:00').getDay()]} ${d.slice(8)}`), 'Total mês', 'Dias c/ meta', 'Estipulado', 'Saldo mês', 'Acum. contrato', '% contrato'];
    const body = L2.map(l => [l.equipe, l.i.codigo || '', l.i.descricao, l.i.unidade, l.meta, ...ds.map(d => l.pd[d] || null), l.tot, l.diasMeta, l.estip, l.saldo === null ? null : (l.saldo > 0 ? l.saldo : 'OK'), l.ac, l.pc]);
    const sub = [`Mês: ${dt(D.ini)} a ${dt(D.fim)} · dias corridos ${ds.length} · produtivos ${D.nProd} · improdutivos ${D.improd.length} · sáb./dom./feriados ${ds.length - D.nUteis}`];
    if (tipo === 'x') xlsxExport(`PRODUCAO_${D.ym}`, 'Controle de produção mensal', head, body, { sub });
    else {
      const P = pdfNovo('Controle de produção mensal – ' + D.ym.split('-').reverse().join('/'), true);
      P.texto(sub[0], { s: 8.5 });
      P.doc.autoTable({ head: [head.slice(1)], body: body.map(r => r.slice(1).map((v, k) => k < 3 ? (v ?? '') : (typeof v === 'number' ? nf(v, k === 3 ? 0 : 1) : (v ?? '')))), startY: P.y, margin: { top: 32, bottom: 16, left: 6, right: 6 }, theme: 'grid', styles: { fontSize: 5.2, cellPadding: 0.6, overflow: 'linebreak' }, headStyles: { fillColor: [87, 88, 90], textColor: 255, fontSize: 5 }, columnStyles: { 1: { cellWidth: 38 } } });
      P.salvar(`PRODUCAO_${D.ym}`);
    }
  };
  $('#qx').onclick = () => exp('x'); $('#qp').onclick = () => exp('p');
  await carregar();
}
function celulaMemoria(iid, d, D, depois) {
  const it = D.itMap[iid]; const ls = D.mem.filter(m => m.orcamento_item_id === iid && m.data === d); const cs = D.cb.filter(x => x.orcamento_item_id === iid && x.data === d);
  const box = document.createElement('div');
  box.innerHTML = `<p class="muted">${h(it.codigo || '')} ${h(it.descricao)} · ${dt(d)}</p><table class="grid"><thead><tr><th>Local</th><th>Memória</th><th class="n">Quant.</th><th></th></tr></thead><tbody>${ls.map(m => `<tr><td>${h(m.local || '')}</td><td>${h(m.formula || '')}</td><td class="n">${nf(m.quantidade)}</td><td>${pode('campo') ? `<button class="lk" data-m="${m.id}">Editar</button>` : ''}</td></tr>`).join('')}${cs.map(x => `<tr><td>${h(x.local)}</td><td>Produção CBUQ ${x.tickets ? '(tickets ' + h(x.tickets) + ')' : ''}</td><td class="n">${nf(x.massa_teorica, 3)}</td><td class="muted">ver Produção CBUQ</td></tr>`).join('') || (ls.length ? '' : '<tr><td colspan="4" class="vazio">Nada lançado.</td></tr>')}</tbody></table>`;
  const o = modal('Memória do dia', box, pode('campo') ? [{ t: 'Novo lançamento', c: 'pri', f: () => { formMemoria(null, { data: d, orcamento_item_id: iid }, depois); } }] : []);
  box.onclick = e => { const b = e.target.dataset.m; if (b) { o.remove(); formMemoria(ls.find(m => m.id === b), null, depois); } };
}
async function formMemoria(row, pre, depois) {
  const itens = await refItens(); const itMap = Object.fromEntries(itens.map(i => [i.id, i]));
  const frentes = (await q(sb.from('eap_atividades').select('nome,frente').eq('obra_id', S.obra.id))).map(a => a.nome);
  const C = [{ k: 'data', l: 'Data', t: 'date', req: true }, { k: 'orcamento_item_id', l: 'Item do orçamento', t: 'ref', req: true, w: 'wf' }, { k: 'local', l: 'Rua / frente / trecho', w: 'w2', list: frentes },
    { k: 'est_ini_int', l: 'Estaca inicial (int.)', t: 'num' }, { k: 'est_ini_frac', l: 'Estaca inicial (frac. m)', t: 'num' }, { k: 'est_fim_int', l: 'Estaca final (int.)', t: 'num' }, { k: 'est_fim_frac', l: 'Estaca final (frac. m)', t: 'num' },
    { k: 'lado', l: 'Lado', t: 'sel', o: L.lado }, { k: 'comprimento', l: 'Comprimento (m)', t: 'num', dica: 'Automático pelas estacas (20 m).' }, { k: 'largura', l: 'Largura (m)', t: 'num' }, { k: 'espessura', l: 'Espessura (m)', t: 'num' },
    { k: 'n_viagens', l: 'Nº de viagens', t: 'num' }, { k: 'cap_viagem', l: 'Capacidade (m³/viagem)', t: 'num' }, { k: 'quantidade', l: 'Quantidade', t: 'num', req: true, dica: 'Automática pela unidade do item; pode ajustar.' }, { k: 'camada', l: 'Camada / aplicação' }, { k: 'observacao', l: 'Observação', t: 'area', w: 'wf' }];
  C[1]._op = itens.filter(i => !ehCbuq(i)).map(i => [i.id, itemLbl(i)]).concat(itens.filter(ehCbuq).map(i => [i.id, itemLbl(i) + ' – prefira Produção CBUQ']));
  const v0 = row || pre || {};
  const box = document.createElement('div'); box.className = 'form'; box.innerHTML = C.map(c => campoHtml(c, v0[c.k])).join('') + '<div class="wf calcinfo b-az" style="padding:8px 10px;border-radius:6px"></div>';
  const g = k => { const e = $('#f_' + k, box); return e && e.value !== '' ? Number(e.value) : null; };
  const recalc = (ev) => {
    const it = itMap[$('#f_orcamento_item_id', box).value]; const l = {}; ['est_ini_int', 'est_ini_frac', 'est_fim_int', 'est_fim_frac', 'comprimento', 'largura', 'espessura', 'n_viagens', 'cap_viagem', 'quantidade'].forEach(k => l[k] = g(k)); l.lado = $('#f_lado', box).value;
    const r = calcMemoria(l, it);
    if (r.comprimento != null && ev && ev.target.id !== 'f_comprimento') $('#f_comprimento', box).value = r.comprimento;
    if (r.quantidade != null && (!ev || ev.target.id !== 'f_quantidade')) $('#f_quantidade', box).value = r.quantidade;
    $('.calcinfo', box).textContent = it ? `Unidade ${it.unidade} · ${calcMemoria({ ...l, quantidade: g('quantidade') }, it).formula || 'preencha as medidas ou a quantidade'}` : 'Escolha o item do orçamento.';
  };
  box.addEventListener('input', recalc); box.addEventListener('change', recalc); recalc();
  const bt = [];
  if (row) bt.push({ t: 'Excluir', c: 'er', f: async () => { await q(sb.from('memoria_calculo').delete().eq('id', row.id)); toast('Excluído'); await depois(); } }, '|');
  bt.push({ t: 'Salvar', c: 'pri', f: async () => {
    const v = lerCampos(box, C); const it = itMap[v.orcamento_item_id]; v.formula = calcMemoria(v, it).formula;
    if (row) await q(sb.from('memoria_calculo').update(v).eq('id', row.id)); else await q(sb.from('memoria_calculo').insert({ ...v, obra_id: S.obra.id }));
    toast('Memória salva', 'ok'); await depois();
  } });
  if (!row) bt.splice(bt.length - 1, 0, { t: 'Salvar e lançar outro', f: async () => { const v = lerCampos(box, C); const it = itMap[v.orcamento_item_id]; v.formula = calcMemoria(v, it).formula; await q(sb.from('memoria_calculo').insert({ ...v, obra_id: S.obra.id })); toast('Memória salva', 'ok'); await depois(); formMemoria(null, { data: v.data, orcamento_item_id: v.orcamento_item_id, local: v.local, lado: v.lado, largura: v.largura, espessura: v.espessura, est_ini_int: v.est_fim_int, est_ini_frac: v.est_fim_frac }, depois); } });
  modal((row ? 'Editar' : 'Lançar') + ' memória de cálculo', box, bt);
}
async function memoriaDia(c) {
  c.innerHTML = `<div class="bar"><label>Dia <input type="date" id="md" value="${DIA_SEL}" style="width:auto"></label><button id="mdA">◀</button><button id="mdP">▶</button><span class="sp"></span>${pode('campo') ? '<button class="pri" id="mdS">Salvar o dia</button>' : ''}<button id="mdX">Memória do mês (Excel)</button><button id="mdF">Memória do mês (PDF)</button></div>
  <p class="muted">Uma linha por trecho executado. Comprimento sai das estacas (20 m) e a quantidade sai da unidade do item: m = comprimento; m² = comprimento × largura; m³ = viagens × capacidade ou comp. × larg. × esp.; t = comp. × larg. × esp. × 2,40. O quadro do mês soma tudo automaticamente. CBUQ com ticket: lance em Produção CBUQ.</p><div id="mdG"></div><p class="muted" id="mdT"></p>`;
  const itens = await refItens(); const itMap = Object.fromEntries(itens.map(i => [i.id, i]));
  let G, linhasDb = [];
  const defs = [{ k: 'orcamento_item_id', l: 'Item', t: 'sel', o: itens.map(i => [i.id, `${i.codigo || i.item || ''} ${i.descricao} (${i.unidade})`]) }, { k: 'local', l: 'Rua / trecho', w: 140 },
    { k: 'est_ini_int', l: 'Est. ini.', t: 'num', w: 55 }, { k: 'est_ini_frac', l: '+ frac', t: 'num', w: 55 }, { k: 'est_fim_int', l: 'Est. fim', t: 'num', w: 55 }, { k: 'est_fim_frac', l: '+ frac', t: 'num', w: 55 },
    { k: 'lado', l: 'Lado', t: 'sel', o: Object.entries(L.lado) }, { k: 'comprimento', l: 'Compr. (m)', t: 'num', w: 70 }, { k: 'largura', l: 'Larg. (m)', t: 'num', w: 60 }, { k: 'espessura', l: 'Esp. (m)', t: 'num', w: 55 },
    { k: 'n_viagens', l: 'Viagens', t: 'num', w: 55 }, { k: 'cap_viagem', l: 'm³/viag.', t: 'num', w: 55 }, { k: 'quantidade', l: 'Quantidade', t: 'num', w: 85 }, { k: 'camada', l: 'Camada', w: 80 }, { k: 'observacao', l: 'Obs.', w: 120 }];
  const ro = !pode('campo');
  const tot = () => { const a = G.get(); const by = {}; a.forEach(l => { if (l.orcamento_item_id) by[l.orcamento_item_id] = (by[l.orcamento_item_id] || 0) + (Number(l.quantidade) || 0); }); $('#mdT').innerHTML = Object.entries(by).map(([k, v]) => `${h(itMap[k] ? itMap[k].descricao : '')}: <b>${nf(v)} ${h(itMap[k] ? itMap[k].unidade : '')}</b>`).join(' · ') || 'Sem lançamentos no dia.'; };
  const carregar = async () => {
    DIA_SEL = $('#md').value || hoje();
    linhasDb = await q(sb.from('memoria_calculo').select('*').eq('obra_id', S.obra.id).eq('data', DIA_SEL).order('criado_em'));
    G = grade($('#mdG'), defs, linhasDb.map(x => ({ ...x })), ro, (l, k) => {
      if (['quantidade', 'local', 'camada', 'observacao'].includes(k)) { setTimeout(tot); return false; }
      const r = calcMemoria(l, itMap[l.orcamento_item_id]); let mud = false;
      if (r.comprimento != null && r.comprimento !== l.comprimento && k !== 'comprimento') { l.comprimento = r.comprimento; mud = true; }
      if (r.quantidade != null && r.quantidade !== l.quantidade) { l.quantidade = r.quantidade; mud = true; }
      setTimeout(tot); return mud;
    });
    tot();
  };
  $('#md').onchange = () => carregar().catch(erro);
  $('#mdA').onclick = () => { $('#md').value = addDias($('#md').value, -1); carregar().catch(erro); };
  $('#mdP').onclick = () => { $('#md').value = addDias($('#md').value, 1); carregar().catch(erro); };
  if ($('#mdS')) $('#mdS').onclick = async () => {
    try {
      const a = G.get().map(l => { const it = itMap[l.orcamento_item_id]; if (!it) throw new Error('Escolha o item em todas as linhas.'); if (l.quantidade == null) throw new Error(`Quantidade vazia em "${it.descricao}".`); return { id: l.id, obra_id: S.obra.id, data: DIA_SEL, orcamento_item_id: l.orcamento_item_id, rdo_id: l.rdo_id || null, local: l.local || null, est_ini_int: l.est_ini_int ?? null, est_ini_frac: l.est_ini_frac ?? null, est_fim_int: l.est_fim_int ?? null, est_fim_frac: l.est_fim_frac ?? null, lado: l.lado || null, comprimento: l.comprimento ?? null, largura: l.largura ?? null, espessura: l.espessura ?? null, n_viagens: l.n_viagens ?? null, cap_viagem: l.cap_viagem ?? null, quantidade: l.quantidade, camada: l.camada || null, observacao: l.observacao || null, formula: calcMemoria(l, it).formula }; });
      const manter = new Set(a.filter(x => x.id).map(x => x.id));
      for (const x of linhasDb) if (!manter.has(x.id)) await q(sb.from('memoria_calculo').delete().eq('id', x.id));
      for (const x of a) { const { id, ...v } = x; if (id) await q(sb.from('memoria_calculo').update(v).eq('id', id)); else await q(sb.from('memoria_calculo').insert(v)); }
      toast(`Memória de ${dt(DIA_SEL)} salva (${a.length} linhas)`, 'ok'); await carregar();
    } catch (e) { erro(e); }
  };
  const memMes = async () => {
    const ym = $('#md').value.slice(0, 7), ini = ym + '-01', fim = `${ym}-${String(diasMes(ym)).padStart(2, '0')}`;
    const [ms, ac] = await Promise.all([q(sb.from('memoria_calculo').select('*').eq('obra_id', S.obra.id).gte('data', ini).lte('data', fim).order('data')), q(sb.from('memoria_calculo').select('orcamento_item_id,quantidade').eq('obra_id', S.obra.id).lte('data', fim))]);
    return { ym, ini, fim, ms, ac };
  };
  $('#mdX').onclick = async () => { try {
    const M = await memMes(); const rows = [];
    itens.filter(i => M.ms.some(m => m.orcamento_item_id === i.id)).forEach(i => {
      const ls = M.ms.filter(m => m.orcamento_item_id === i.id); const tm = soma(ls, m => m.quantidade), ta = soma(M.ac.filter(m => m.orcamento_item_id === i.id), m => m.quantidade);
      rows.push([`${i.codigo || ''} – ${i.descricao}`, `Unid.: ${i.unidade}`, `Contratual: ${nf(i.quantidade)}`, '', '', '', '', '', '', '', '', '']);
      ls.forEach(m => rows.push([dt(m.data), m.local || '', m.est_ini_int ?? '', num(m.est_ini_frac), m.est_fim_int ?? '', num(m.est_fim_frac), m.lado || '', num(m.comprimento), num(m.largura), num(m.espessura), num(m.quantidade), m.observacao || '']));
      rows.push(['Total do mês', '', '', '', '', '', '', '', '', '', tm, `Acumulado: ${nf(ta)} (${i.quantidade ? nf(100 * ta / i.quantidade, 2) + '%' : '–'} do contratual)`]);
      rows.push(['', '', '', '', '', '', '', '', '', '', '', '']);
    });
    xlsxExport(`MEMORIA_${M.ym}`, 'Memória de cálculo do mês', ['Data', 'Rua / trecho', 'Est. ini. (int.)', 'Est. ini. (frac.)', 'Est. fim (int.)', 'Est. fim (frac.)', 'Lado', 'Comprimento (m)', 'Largura (m)', 'Espessura (m)', 'Quantidade', 'Observação'], rows, { sub: [`Período: ${dt(M.ini)} a ${dt(M.fim)}`] });
  } catch (e) { erro(e); } };
  $('#mdF').onclick = async () => { try {
    const M = await memMes(); const P = pdfNovo(`Memória de cálculo – ${M.ym.split('-').reverse().join('/')}`, true);
    itens.filter(i => M.ms.some(m => m.orcamento_item_id === i.id)).forEach(i => {
      const ls = M.ms.filter(m => m.orcamento_item_id === i.id); const tm = soma(ls, m => m.quantidade), ta = soma(M.ac.filter(m => m.orcamento_item_id === i.id), m => m.quantidade);
      P.texto(`${i.codigo || ''} – ${i.descricao}  ·  Unid.: ${i.unidade}  ·  Contratual: ${nf(i.quantidade)}`, { b: true, s: 9.5 });
      P.tabela(['Data', 'Rua / trecho', 'Est. inicial', 'Est. final', 'Lado', 'Memória', 'Quantidade'], ls.map(m => [dt(m.data), m.local || '', estTxt(m.est_ini_int, m.est_ini_frac), estTxt(m.est_fim_int, m.est_fim_frac), m.lado || '', m.formula || '', nf(m.quantidade)]), { fs: 7.5, foot: ['Total do mês', '', '', '', '', `Acumulado ${nf(ta)} (${i.quantidade ? nf(100 * ta / i.quantidade, 2) + '%' : '–'})`, nf(tm)], cols: { 5: { cellWidth: 110 } } });
    });
    if (!M.ms.length) P.texto('Sem memória lançada no mês.');
    P.assinaturas(['Responsável técnico – NIEMAIA', 'Fiscalização – Contratante']); P.salvar(`MEMORIA_${M.ym}`);
  } catch (e) { erro(e); } };
  await carregar();
}
async function metasMes(c) {
  c.innerHTML = `<div class="bar"><label>Mês <input type="month" id="mm" value="${MES_SEL}" style="width:auto"></label><span class="sp"></span>${pode('planejar') ? '<button id="mmC">Copiar metas do mês anterior</button><button class="pri" id="mmS">Salvar</button>' : ''}</div>
  <div class="card"><div class="form"><div class="w2"><label for="mmF">Feriados do mês (dd/mm, separados por vírgula)</label><input id="mmF" placeholder="02/11, 15/11, 20/11"></div><div><label>&nbsp;</label><div class="chk"><input type="checkbox" id="mmSab"><span>Sábado é dia produtivo</span></div></div></div></div>
  <p class="muted">Meta = produção estipulada por dia de cada item. O quadro calcula dias produtivos (úteis − feriados − dias impraticáveis no RDO), produção estipulada (meta × dias produtivos) e o saldo do mês.</p><div class="tw"><table class="grid"><thead><tr><th>Item</th><th>Un</th><th class="n">Contratado</th><th class="n">Meta/dia</th><th>Equipe / frente</th></tr></thead><tbody id="mmB"></tbody></table></div>`;
  const itens = await refItens(true); let metas = [];
  const carregar = async () => {
    MES_SEL = $('#mm').value; const ini = MES_SEL + '-01';
    const [ms, cal] = await Promise.all([q(sb.from('producao_metas').select('*').eq('obra_id', S.obra.id).eq('mes', ini)), q(sb.from('meses_producao').select('*').eq('obra_id', S.obra.id).eq('mes', ini))]);
    metas = ms; const mm = Object.fromEntries(ms.map(m => [m.orcamento_item_id, m]));
    $('#mmF').value = cal[0] ? (cal[0].feriados || []).map(x => dt(x).slice(0, 5)).join(', ') : ''; $('#mmSab').checked = !!(cal[0] && cal[0].sabado_produtivo);
    const full = await q(sb.from('orcamento_itens').select('id,codigo,descricao,unidade,quantidade,grupo').eq('obra_id', S.obra.id).eq('ativo', true).order('ordem'));
    $('#mmB').innerHTML = full.map(i => `<tr><td>${h(i.codigo || '')} ${h(i.descricao)}</td><td>${h(i.unidade)}</td><td class="n">${nf(i.quantidade)}</td><td class="ed n"><input type="number" step="any" data-m="${i.id}" value="${mm[i.id] ? mm[i.id].meta_dia : ''}" style="width:110px" ${pode('planejar') ? '' : 'disabled'}></td><td class="ed"><input data-e="${i.id}" value="${h((mm[i.id] && mm[i.id].equipe) || i.grupo || '')}" ${pode('planejar') ? '' : 'disabled'}></td></tr>`).join('');
  };
  $('#mm').onchange = () => carregar().catch(erro);
  if ($('#mmS')) $('#mmS').onclick = async () => { try {
    const ini = MES_SEL + '-01', ano = MES_SEL.slice(0, 4);
    const fer = $('#mmF').value.split(',').map(x => x.trim()).filter(Boolean).map(x => { const m = x.match(/^(\d{1,2})\/(\d{1,2})$/); if (!m) throw new Error(`Feriado inválido: "${x}" (use dd/mm).`); return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; });
    await q(sb.from('meses_producao').upsert({ obra_id: S.obra.id, mes: ini, feriados: fer, sabado_produtivo: $('#mmSab').checked }, { onConflict: 'obra_id,mes' }));
    for (const inp of $$('#mmB input[data-m]')) {
      const iid = inp.dataset.m, v = inp.value === '' ? null : Number(inp.value), eq = $(`#mmB input[data-e="${iid}"]`).value || null, ex = metas.find(m => m.orcamento_item_id === iid);
      if (v === null) { if (ex) await q(sb.from('producao_metas').delete().eq('id', ex.id)); }
      else await q(sb.from('producao_metas').upsert({ obra_id: S.obra.id, mes: ini, orcamento_item_id: iid, meta_dia: v, equipe: eq }, { onConflict: 'obra_id,mes,orcamento_item_id' }));
    }
    toast('Metas e calendário salvos', 'ok'); await carregar();
  } catch (e) { erro(e); } };
  if ($('#mmC')) $('#mmC').onclick = async () => { try {
    const d = new Date(MES_SEL + '-01T12:00:00'); d.setMonth(d.getMonth() - 1); const ant = d.toISOString().slice(0, 7) + '-01';
    const ms = await q(sb.from('producao_metas').select('*').eq('obra_id', S.obra.id).eq('mes', ant));
    if (!ms.length) return toast('Mês anterior sem metas.');
    ms.forEach(m => { const i = $(`#mmB input[data-m="${m.orcamento_item_id}"]`); if (i) { i.value = m.meta_dia; $(`#mmB input[data-e="${m.orcamento_item_id}"]`).value = m.equipe || ''; } });
    toast(`${ms.length} metas copiadas. Confira e salve.`);
  } catch (e) { erro(e); } };
  await carregar();
}

/* ================= ABASTECIMENTO DIÁRIO ================= */
const L_COMB = { diesel_s10: 'Diesel S10', diesel_s500: 'Diesel S500', gasolina: 'Gasolina', arla32: 'ARLA 32', oleo_lubrificante: 'Óleo lubrificante' };
let DIA_ABAST = hoje();
async function abastecimentoDia(c) {
  const vc = pode('custos');
  c.innerHTML = `<div class="bar"><label>Dia <input type="date" id="ad" value="${DIA_ABAST}" style="width:auto"></label><button id="adA">◀</button><button id="adP">▶</button><span class="sp"></span>${pode('campo') || S.perfil === 'almoxarife' ? '<button id="adF">Incluir toda a frota</button><button class="pri" id="adS">Salvar ficha</button>' : ''}<button id="adX">Excel</button><button id="adPdf">Ficha (PDF)</button></div>
  <p class="muted">Uma linha por abastecimento. O horímetro informado atualiza o horímetro do equipamento. Consumo (l/h) = litros ÷ horas desde o abastecimento anterior com horímetro.</p><div id="adG"></div><div id="adR" style="margin-top:12px"></div>`;
  const eqs = await refEquip(true); const eqMap = Object.fromEntries(eqs.map(e => [e.id, e]));
  let G, db = [], ant = {};
  const defs = [{ k: 'hora', l: 'Hora', w: 60 }, { k: 'equipamento_id', l: 'Equipamento (prefixo)', t: 'sel', o: eqs.map(e => [e.id, `${e.prefixo} – ${e.descricao}`]) }, { k: 'horimetro', l: 'Horímetro', t: 'num', w: 80 }, { k: 'odometro', l: 'Odômetro (km)', t: 'num', w: 80 },
    { k: 'combustivel', l: 'Combustível', t: 'sel', o: Object.entries(L_COMB) }, { k: 'litros', l: 'Litros', t: 'num', w: 70 }, ...(vc ? [{ k: 'preco_litro', l: 'R$/litro', t: 'num', w: 65 }] : []),
    { k: 'origem', l: 'Origem (melosa/posto)', w: 120, list: ['Melosa', 'Comboio', 'Posto', 'Tanque do canteiro'] }, { k: 'documento', l: 'Cupom / requisição', w: 90 }, { k: 'responsavel', l: 'Frentista / responsável', w: 120 }, { k: 'observacao', l: 'Obs.', w: 110 }];
  const ro = !(pode('campo') || S.perfil === 'almoxarife');
  const resumo = () => {
    const a = G.get(); const porC = {}; a.forEach(l => { const k = l.combustivel || 'diesel_s10'; porC[k] = (porC[k] || 0) + (Number(l.litros) || 0); });
    const linhas = a.filter(l => l.equipamento_id).map(l => { const e = eqMap[l.equipamento_id]; const p = ant[l.equipamento_id]; const hrs = p && l.horimetro != null && p.horimetro != null ? l.horimetro - p.horimetro : null; return [e ? e.prefixo : '', e ? e.descricao : '', p ? `${dt(p.data)} · ${nf(p.horimetro, 1)}` : '–', nf(l.horimetro, 1), hrs != null ? nf(hrs, 1) : '–', nf(l.litros, 1), hrs > 0 ? nf(l.litros / hrs, 2) : '–']; });
    $('#adR').innerHTML = `<div class="kpis">${Object.entries(porC).map(([k, v]) => `<div class="kpi"><span>${L_COMB[k]}</span><b>${nf(v, 1)} l</b></div>`).join('')}${vc ? `<div class="kpi"><span>Valor do dia</span><b>${brl(soma(a, l => (Number(l.litros) || 0) * (Number(l.preco_litro) || 0)))}</b></div>` : ''}</div>
    <div class="card"><h3 style="margin-top:0">Consumo por equipamento</h3><div class="tw"><table class="grid"><thead><tr><th>Prefixo</th><th>Equipamento</th><th>Abastecimento anterior</th><th class="n">Horímetro</th><th class="n">Horas</th><th class="n">Litros</th><th class="n">l/h</th></tr></thead><tbody>${linhas.map(r => `<tr>${r.map((v, i) => `<td class="${i > 2 ? 'n' : ''}">${h(v)}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="7" class="vazio">Sem abastecimentos no dia.</td></tr>'}</tbody></table></div></div>`;
  };
  const carregar = async () => {
    DIA_ABAST = $('#ad').value || hoje();
    db = await q(sb.from('abastecimentos').select('*').eq('obra_id', S.obra.id).eq('data', DIA_ABAST).order('hora'));
    const prev = await q(sb.from('abastecimentos').select('equipamento_id,data,horimetro').eq('obra_id', S.obra.id).lt('data', DIA_ABAST).not('horimetro', 'is', null).order('data', { ascending: false }).limit(500));
    ant = {}; prev.forEach(p => { if (!ant[p.equipamento_id]) ant[p.equipamento_id] = p; });
    G = grade($('#adG'), defs, db.map(x => ({ ...x, hora: x.hora ? x.hora.slice(0, 5) : null })), ro, () => { setTimeout(resumo); return false; });
    resumo();
  };
  $('#ad').onchange = () => carregar().catch(erro);
  $('#adA').onclick = () => { $('#ad').value = addDias($('#ad').value, -1); carregar().catch(erro); };
  $('#adP').onclick = () => { $('#ad').value = addDias($('#ad').value, 1); carregar().catch(erro); };
  if ($('#adF')) $('#adF').onclick = () => { const a = G.get(); const tem = new Set(a.map(l => l.equipamento_id)); G.set([...a, ...eqs.filter(e => !tem.has(e.id) && e.status !== 'desmobilizado').map(e => ({ equipamento_id: e.id, combustivel: 'diesel_s10' }))]); resumo(); };
  if ($('#adS')) $('#adS').onclick = async () => { try {
    const a = G.get().filter(l => l.litros); const cols = ['hora', 'equipamento_id', 'horimetro', 'odometro', 'combustivel', 'litros', ...(vc ? ['preco_litro'] : []), 'origem', 'documento', 'responsavel', 'observacao'];
    for (const l of a) { if (!l.equipamento_id) throw new Error('Escolha o equipamento em todas as linhas com litros.'); if (l.hora && !/^\d{1,2}:\d{2}$/.test(l.hora)) throw new Error(`Hora inválida: ${l.hora} (use hh:mm).`); const p = ant[l.equipamento_id]; if (p && l.horimetro != null && l.horimetro < p.horimetro) throw new Error(`${eqMap[l.equipamento_id].prefixo}: horímetro ${nf(l.horimetro, 1)} menor que o do abastecimento anterior (${nf(p.horimetro, 1)}).`); }
    const manter = new Set(a.filter(l => l.id).map(l => l.id));
    for (const x of db) if (!manter.has(x.id)) await q(sb.from('abastecimentos').delete().eq('id', x.id));
    for (const l of a) { const v = Object.fromEntries(cols.map(k => [k, l[k] === '' || l[k] === undefined ? null : l[k]])); v.combustivel = v.combustivel || 'diesel_s10'; v.data = DIA_ABAST; v.obra_id = S.obra.id; if (l.id) await q(sb.from('abastecimentos').update(v).eq('id', l.id)); else await q(sb.from('abastecimentos').insert(v)); }
    if (pode('equip')) for (const l of a) { const e = eqMap[l.equipamento_id]; if (e && l.horimetro != null && (e.horimetro_atual == null || l.horimetro > e.horimetro_atual)) await sb.from('equipamentos').update({ horimetro_atual: l.horimetro }).eq('id', e.id); }
    refLimpar('equip'); toast(`Ficha de ${dt(DIA_ABAST)} salva (${a.length} abastecimentos)`, 'ok'); await carregar();
  } catch (e) { erro(e); } };
  const tab = () => G.get().filter(l => l.litros).map(l => { const e = eqMap[l.equipamento_id] || {}; return [l.hora || '', e.prefixo || '', e.descricao || '', num(l.horimetro), num(l.odometro), L_COMB[l.combustivel || 'diesel_s10'], num(l.litros), ...(vc ? [num(l.preco_litro), (Number(l.litros) || 0) * (Number(l.preco_litro) || 0)] : []), l.origem || '', l.documento || '', l.responsavel || '']; });
  const head = ['Hora', 'Prefixo', 'Equipamento', 'Horímetro', 'Odômetro', 'Combustível', 'Litros', ...(vc ? ['R$/litro', 'Valor (R$)'] : []), 'Origem', 'Cupom/req.', 'Responsável'];
  $('#adX').onclick = () => xlsxExport(`ABASTECIMENTO_${DIA_ABAST}`, 'Ficha de abastecimento diário', head, tab(), { sub: [`Data: ${dt(DIA_ABAST)}`], total: ['Total', '', '', null, null, '', soma(tab(), r => r[6]), ...(vc ? [null, soma(tab(), r => r[8])] : []), '', '', ''] });
  $('#adPdf').onclick = () => { const P = pdfNovo(`Ficha de abastecimento diário – ${dt(DIA_ABAST)}`, true); const t = tab();
    P.tabela(head, t.map(r => r.map((v, i) => i === 3 || i === 4 ? nf(v, 1) : i === 6 ? nf(v, 1) : (vc && (i === 7 || i === 8)) ? (i === 7 ? nf(v, 3) : brl(v)) : (v ?? ''))), { foot: ['Total', '', '', '', '', '', nf(soma(t, r => r[6]), 1), ...(vc ? ['', brl(soma(t, r => r[8]))] : []), '', '', ''], fs: 8.5 });
    P.assinaturas(['Frentista / responsável pelo abastecimento', 'Encarregado da obra', 'Almoxarife / apoio']); P.salvar(`ABASTECIMENTO_${DIA_ABAST}`); };
  await carregar();
}
