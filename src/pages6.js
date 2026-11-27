/* ================= CUSTOS DE APOIO: ALIMENTAÇÃO, ALOJAMENTO E TRANSPORTE ================= */
const SUB_APOIO = {
  alimentacao: ['Café da manhã', 'Almoço', 'Jantar', 'Marmita / quentinha', 'Lanche', 'Água mineral', 'Gás de cozinha', 'Mercado do alojamento'],
  alojamento: ['Aluguel de casa', 'Hotel / pousada', 'Energia', 'Água', 'Internet', 'Limpeza / lavanderia', 'Móveis e utensílios', 'Manutenção do alojamento'],
  transporte: ['Combustível – veículo leve', 'Passagem', 'Translado de equipe', 'Frete', 'Pedágio', 'Manutenção de veículo', 'Aluguel de veículo', 'Uber / mototáxi']
};
const GRP_APOIO = Object.keys(SUB_APOIO);
const colsApoio = () => [
  { k: 'data', l: 'Data', t: 'date', req: true, def: hoje() },
  { k: 'categoria', l: 'Grupo', t: 'sel', o: L.apoio, req: true, def: 'alimentacao' },
  { k: 'subcategoria', l: 'Tipo', list: [...new Set(Object.values(SUB_APOIO).flat())] },
  { k: 'descricao', l: 'Descrição', req: true, w: 'w2' },
  { k: 'fornecedor', l: 'Fornecedor' },
  { k: 'pessoas', l: 'Pessoas', t: 'num', d: 0, dica: 'Quantidade de pessoas atendidas (refeições, vagas, passageiros)' },
  { k: 'periodo_fim', l: 'Período até', t: 'date', formOnly: true, dica: 'Alojamento/aluguel: fim do período pago' },
  { k: 'veiculo', l: 'Veículo / placa', formOnly: true },
  { k: 'quantidade', l: 'Qtd', t: 'num', formOnly: true }, { k: 'unidade', l: 'Un', formOnly: true, list: ['refeição', 'diária', 'mês', 'l', 'km', 'viagem', 'un'] },
  { k: 'valor', l: 'Valor (R$)', t: 'money', req: true, sum: true },
  { k: 'forma_pagamento', l: 'Pagamento', t: 'sel', o: L.pagamento },
  { k: 'pago_por', l: 'Pago por', formOnly: true, dica: 'Empresa ou nome do colaborador (reembolso)' },
  { k: 'documento', l: 'Nº NF / recibo' },
  { k: 'cmp', l: 'Comprovante', listOnly: true, html: true, noExp: true, v: r => r.anexo_caminho ? '<span class="badge b-ok"><i class="ti ti-paperclip"></i>Anexado</span>' : '<span class="badge b-av">Falta</span>' },
  { k: 'observacao', l: 'Observação', t: 'area', w: 'wf', formOnly: true }
];
const mesAtual = () => hoje().slice(0, 7);
async function apoioLanc(c) {
  let grp = '', mes = mesAtual();
  const meses = []; { const d = new Date(); for (let i = 0; i < 12; i++) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); meses.push(x.toISOString().slice(0, 7)); } }
  const cfg = { table: 'custos', title: 'Alimentação, alojamento e transporte', doc: 'APOIO', order: 'data', asc: false, write: 'custos', paisagem: true, novo: 'Novo lançamento',
    anexo: { bucket: 'comprovantes' }, cols: colsApoio(), vazio: 'Nenhum lançamento no período.',
    load: () => { let p = sb.from('custos').select('*').eq('obra_id', S.obra.id).in('categoria', grp ? [grp] : GRP_APOIO); if (mes) { const [y, m] = mes.split('-').map(Number); p = p.gte('data', mes + '-01').lt('data', new Date(y, m, 1).toISOString().slice(0, 10)); } return q(p.order('data', { ascending: false })); },
    botoes: `<select class="fGrp" aria-label="Grupo" style="width:auto"><option value="">Todos os grupos</option>${Object.entries(L.apoio).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
      <select class="fMes" aria-label="Mês" style="width:auto"><option value="">Todos os meses</option>${meses.map(m => `<option value="${m}" ${m === mes ? 'selected' : ''}>${m.slice(5)}/${m.slice(0, 4)}</option>`).join('')}</select>
      <button class="zip"><i class="ti ti-file-zip"></i>Comprovantes (ZIP)</button>`,
    resumo: (box, r) => { const t = g => soma(r.filter(x => x.categoria === g), x => x.valor); const sem = r.filter(x => !x.anexo_caminho);
      box.innerHTML = `<div class="kpis k4">${GRP_APOIO.map(g => `<div class="kpi"><span>${L.apoio[g]}</span><b>${brl(t(g))}</b><small>${r.filter(x => x.categoria === g).length} lançamento(s)</small></div>`).join('')}<div class="kpi ${sem.length ? 'alerta' : ''}"><span>Sem comprovante</span><b>${sem.length}</b><small>${brl(soma(sem, x => x.valor))}</small></div></div>`; },
    pronto: (el, rec, rows) => {
      $('.fGrp', el).onchange = e => { grp = e.target.value; rec(); };
      $('.fMes', el).onchange = e => { mes = e.target.value; rec(); };
      $('.zip', el).onclick = () => zipComprovantes(rows(), `${S.obra.codigo}_COMPROVANTES_${mes || 'TODOS'}${grp ? '_' + grp.toUpperCase() : ''}`).catch(erro);
    }
  };
  await crud(c, cfg);
}
async function zipComprovantes(rows, nome) {
  const com = rows.filter(r => r.anexo_caminho);
  if (!com.length) return toast('Nenhum comprovante anexado nesta seleção.', 'erro');
  toast(`Baixando ${com.length} comprovante(s)…`);
  const zip = new JSZip(); const idx = [['Arquivo', 'Data', 'Grupo', 'Tipo', 'Descrição', 'Fornecedor', 'Documento', 'Pagamento', 'Valor (R$)']];
  for (const [i, r] of com.entries()) {
    const u = await q(sb.storage.from('comprovantes').createSignedUrl(r.anexo_caminho, 600));
    const b = await (await fetch(u.signedUrl)).blob(); const ext = r.anexo_caminho.split('.').pop();
    const arq = `${String(i + 1).padStart(3, '0')}_${r.data}_${semAcento(L.categoria[r.categoria] || r.categoria).replace(/\W+/g, '')}_${semAcento(r.fornecedor || r.descricao).replace(/\W+/g, '_').slice(0, 30)}_R$${num(r.valor).toFixed(2).replace('.', ',')}.${ext}`;
    zip.file(arq, b); idx.push([arq, dt(r.data), L.categoria[r.categoria], r.subcategoria || '', r.descricao, r.fornecedor || '', r.documento || '', L.pagamento[r.forma_pagamento] || '', num(r.valor).toFixed(2).replace('.', ',')]);
  }
  zip.file('INDICE.csv', '\ufeff' + idx.map(l => l.map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\r\n'));
  const blob = await zip.generateAsync({ type: 'blob' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome + '.zip'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function apoioResumo(c) {
  const ini = new Date(); ini.setMonth(ini.getMonth() - 5); const d0 = ini.toISOString().slice(0, 7) + '-01';
  const [cs, ef] = await Promise.all([
    q(sb.from('custos').select('data,categoria,subcategoria,valor,pessoas,anexo_caminho').eq('obra_id', S.obra.id).in('categoria', GRP_APOIO).gte('data', d0)),
    q(sb.from('rdo_efetivo').select('quantidade,rdo!inner(data)').eq('obra_id', S.obra.id).gte('rdo.data', d0))]);
  const meses = [...new Set([...cs.map(x => x.data.slice(0, 7)), ...ef.map(x => x.rdo.data.slice(0, 7))])].sort();
  const hd = m => soma(ef.filter(x => x.rdo.data.startsWith(m)), x => x.quantidade);
  const vg = (m, g) => soma(cs.filter(x => x.data.startsWith(m) && (!g || x.categoria === g)), x => x.valor);
  const H = ['Mês', 'Homens-dia (RDO)', 'Alimentação', 'Alojamento', 'Transporte', 'Total', 'Alimentação / homem-dia', 'Total / homem-dia'];
  const L1 = meses.map(m => { const h_ = hd(m), t = vg(m); return [`${m.slice(5)}/${m.slice(0, 4)}`, h_, vg(m, 'alimentacao'), vg(m, 'alojamento'), vg(m, 'transporte'), t, h_ ? vg(m, 'alimentacao') / h_ : null, h_ ? t / h_ : null]; });
  const sub = {}; cs.forEach(x => { const k = `${L.apoio[x.categoria]} – ${x.subcategoria || 'Sem tipo'}`; sub[k] = (sub[k] || 0) + num(x.valor); });
  const subL = Object.entries(sub).sort((a, b) => b[1] - a[1]);
  c.innerHTML = `<div class="card"><div class="bar"><h3 style="margin:0">Custo de apoio por mês (últimos 6 meses)</h3><span class="sp"></span><button id="arX">Excel</button></div>
  <div class="tw"><table class="grid"><thead><tr>${H.map((x, i) => `<th class="${i ? 'n' : ''}">${x}</th>`).join('')}</tr></thead><tbody>${L1.map(r => `<tr><td>${r[0]}</td><td class="n">${nf(r[1], 0)}</td>${r.slice(2, 6).map(v => `<td class="n">${brl(v)}</td>`).join('')}<td class="n">${r[6] == null ? '–' : brl(r[6])}</td><td class="n">${r[7] == null ? '–' : brl(r[7])}</td></tr>`).join('') || `<tr><td colspan="8" class="vazio">Sem lançamentos.</td></tr>`}</tbody></table></div>
  <p class="muted">Homens-dia = soma do efetivo dos RDOs do mês. Serve para comparar o custo de apoio com o tamanho da equipe.</p></div>
  <div class="card"><h3 style="margin-top:0">Por tipo de despesa</h3><div class="tw"><table class="grid">${subL.map(([k, v]) => `<tr><td>${h(k)}</td><td class="n">${brl(v)}</td></tr>`).join('') || '<tr><td class="vazio">Sem lançamentos.</td></tr>'}</table></div></div>`;
  $('#arX').onclick = () => xlsxExport('APOIO_RESUMO', 'Custo de apoio por mês', H, L1, { fmt: [null, '#,##0', '"R$" #,##0.00', '"R$" #,##0.00', '"R$" #,##0.00', '"R$" #,##0.00', '"R$" #,##0.00', '"R$" #,##0.00'] });
}
/* importação em lote: fotos/PDF dos comprovantes + dados (manual ou JSON do Claude) */
async function apoioImportar(c) {
  if (!pode('custos')) { c.innerHTML = '<div class="vazio">Seu perfil não lança custos.</div>'; return; }
  let linhas = [];
  c.innerHTML = `<div class="g2"><div class="card"><h3 style="margin-top:0">1. Comprovantes</h3><p class="muted">Fotos de recibos, cupons, notas fiscais (PDF ou XML) ou comprovantes de PIX. Um lançamento por arquivo.</p>
    <div class="bar"><label class="btf"><i class="ti ti-files"></i>Escolher arquivos<input type="file" id="cpArq" accept="image/*,application/pdf,.pdf,.xml" multiple hidden></label>
    <label class="btf"><i class="ti ti-camera"></i>Tirar foto<input type="file" id="cpCam" accept="image/*" capture="environment" hidden></label></div></div>
    <div class="card"><h3 style="margin-top:0">2. Dados lidos pelo Claude (opcional)</h3><p class="muted">Mande as fotos numa conversa do Claude e peça "dados dos comprovantes em JSON para o sistema". Cole aqui: o sistema casa cada linha com o arquivo pelo nome.</p>
    <textarea id="cpJson" placeholder='[{"arquivo":"IMG_0012.jpg","data":"2026-11-23","categoria":"alimentacao","subcategoria":"Almoço","descricao":"Almoço equipe","fornecedor":"Restaurante X","documento":"123","valor":180,"pessoas":12,"forma_pagamento":"pix"}]' style="min-height:90px;font-family:monospace;font-size:12px"></textarea>
    <div class="bar" style="margin-top:8px"><button id="cpAplic"><i class="ti ti-wand"></i>Aplicar dados</button></div></div></div>
    <div class="card"><div class="bar"><h3 style="margin:0">3. Conferir e salvar</h3><span class="sp"></span><button class="pri" id="cpSal" disabled><i class="ti ti-device-floppy"></i>Salvar</button></div><div id="cpLista"><div class="vazio">Escolha os arquivos.</div></div></div>`;
  const dataDoNome = f => { const m = f.name.match(/(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`; const d = new Date(f.lastModified); return isNaN(d) ? hoje() : d.toISOString().slice(0, 10); };
  const desenhar = () => {
    $('#cpSal').disabled = !linhas.length; $('#cpSal').innerHTML = `<i class="ti ti-device-floppy"></i>Salvar ${linhas.length} lançamento(s)`;
    $('#cpLista').innerHTML = linhas.length ? `<div class="cpl">${linhas.map((l, i) => `<div class="cpi" data-i="${i}"><div class="cpt">${l.url ? `<img src="${l.url}" alt="">` : '<i class="ti ti-file-type-pdf"></i>'}<small>${h(l.file.name)}</small><button class="lk cpX" title="Remover"><i class="ti ti-x"></i>Remover</button></div>
      <div class="form">${[['data', 'Data', 'date'], ['categoria', 'Grupo', 'sel'], ['subcategoria', 'Tipo'], ['descricao', 'Descrição'], ['fornecedor', 'Fornecedor'], ['documento', 'Nº NF / recibo'], ['valor', 'Valor (R$)', 'num'], ['pessoas', 'Pessoas', 'num'], ['forma_pagamento', 'Pagamento', 'pag']].map(([k, lb, t]) => `<div><label>${lb}</label>${t === 'sel' ? `<select data-k="${k}">${Object.entries(L.apoio).map(([a, b]) => `<option value="${a}" ${l[k] === a ? 'selected' : ''}>${b}</option>`).join('')}</select>` : t === 'pag' ? `<select data-k="${k}"><option value=""></option>${Object.entries(L.pagamento).map(([a, b]) => `<option value="${a}" ${l[k] === a ? 'selected' : ''}>${b}</option>`).join('')}</select>` : `<input data-k="${k}" type="${t === 'date' ? 'date' : t === 'num' ? 'number' : 'text'}" ${t === 'num' ? 'step="any" inputmode="decimal"' : ''} value="${h(l[k] ?? '')}" ${k === 'subcategoria' ? `list="dlSub"` : ''}>`}</div>`).join('')}</div></div>`).join('')}</div><datalist id="dlSub">${Object.values(SUB_APOIO).flat().map(x => `<option value="${h(x)}">`).join('')}</datalist>` : '<div class="vazio">Escolha os arquivos.</div>';
  };
  $('#cpLista').addEventListener('input', e => { const i = e.target.closest('.cpi')?.dataset.i, k = e.target.dataset.k; if (i == null || !k) return; linhas[i][k] = e.target.value; });
  $('#cpLista').addEventListener('click', e => { if (!e.target.closest('.cpX')) return; linhas.splice(+e.target.closest('.cpi').dataset.i, 1); desenhar(); });
  const add = async fs => { for (const f of fs) { let url = null; if (/^image\//.test(f.type)) { const u = await new Promise(ok => { const rd = new FileReader(); rd.onload = () => ok(rd.result); rd.readAsDataURL(f); }); const im = await reduzImg(u, 360); url = im && im.url; } linhas.push({ file: f, url, data: dataDoNome(f), categoria: 'alimentacao' }); } desenhar(); };
  $('#cpArq').onchange = e => add([...e.target.files]).catch(erro);
  $('#cpCam').onchange = e => add([...e.target.files]).catch(erro);
  $('#cpAplic').onclick = () => { try {
    let j = JSON.parse($('#cpJson').value.trim().replace(/^```(json)?|```$/g, '')); if (!Array.isArray(j)) j = j.comprovantes || [j];
    let n = 0; j.forEach((x, k) => { const a = semAcento(x.arquivo || ''); const l = linhas.find(l => a && (semAcento(l.file.name) === a || semAcento(l.file.name).includes(a) || a.includes(semAcento(l.file.name)))) || (j.length === linhas.length ? linhas[k] : null); if (!l) return; n++;
      const cat = semAcento(x.categoria || x.grupo || ''); l.categoria = cat.startsWith('aloj') ? 'alojamento' : cat.startsWith('trans') ? 'transporte' : 'alimentacao';
      ['subcategoria', 'descricao', 'fornecedor', 'documento', 'pago_por', 'observacao'].forEach(k2 => { if (x[k2] != null) l[k2] = String(x[k2]); });
      if (x.data) l.data = normData(x.data); if (x.valor != null) l.valor = nOuNulo(typeof x.valor === 'number' ? x.valor : String(x.valor).replace(/[^\d,.]/g, '')); if (x.pessoas != null) l.pessoas = x.pessoas;
      const fp = semAcento(x.forma_pagamento || ''); l.forma_pagamento = Object.keys(L.pagamento).find(p => fp && (p === fp || semAcento(L.pagamento[p]).startsWith(fp))) || l.forma_pagamento; });
    desenhar(); toast(`${n} comprovante(s) preenchido(s)`, n ? 'ok' : 'erro'); } catch (x) { erro(new Error('JSON inválido: ' + x.message)); } };
  $('#cpSal').onclick = async () => {
    const bt = $('#cpSal'); bt.disabled = true; let ok = 0; const falhas = [];
    for (const l of [...linhas]) {
      try {
        if (!l.data || !l.descricao || nOuNulo(l.valor) == null) throw new Error('preencha data, descrição e valor');
        const r = await q(sb.from('custos').insert({ obra_id: S.obra.id, data: l.data, categoria: l.categoria, subcategoria: l.subcategoria || null, descricao: l.descricao, fornecedor: l.fornecedor || null, documento: l.documento || null, valor: Number(String(l.valor).replace(',', '.')), pessoas: l.pessoas ? Math.round(Number(l.pessoas)) : null, forma_pagamento: l.forma_pagamento || null, pago_por: l.pago_por || null, observacao: l.observacao || null }).select('id').single());
        await subirAnexo('comprovantes', 'custos', r.id, l.file); ok++; linhas.splice(linhas.indexOf(l), 1);
      } catch (x) { falhas.push(`${l.file.name}: ${x.message}`); }
    }
    desenhar(); toast(`${ok} lançamento(s) salvo(s)`, falhas.length ? 'erro' : 'ok');
    if (falhas.length) $('#cpLista').insertAdjacentHTML('afterbegin', `<p style="color:var(--er)">${falhas.map(h).join('<br>')}</p>`);
  };
}

/* ================= INFORMAÇÕES PENDENTES ================= */
const AREA_INFO = {
  contrato: ['Contrato e ordem de serviço', 'Gestor do contrato'],
  documentos: ['Documentos de início (SEPLAN)', 'Escritório / gestor do contrato'],
  orcamento: ['Orçamento', 'Gestor do contrato / orçamentos'],
  planejamento: ['Planejamento e cronograma', 'Gestor do contrato'],
  projeto: ['Projeto e fiscalização', 'Prefeitura – SEPLAN (fiscalização)'],
  frota: ['Equipamentos', 'Encarregado de equipamentos / oficina'],
  maodeobra: ['Mão de obra, ASO e EPI', 'RH / segurança do trabalho'],
  rdo: ['Diário de obra', 'Apontador / encarregado de campo'],
  aprovacao: ['Aprovações', 'Gestor do contrato'],
  custos: ['Custos e comprovantes', 'Financeiro / quem pagou'],
  medicao: ['Documentos da medição', 'Financeiro / contabilidade'],
  certidoes: ['Certidões', 'Financeiro / contabilidade'],
  outros: ['Outros', 'A definir']
};
L.area_info = Object.fromEntries(Object.entries(AREA_INFO).map(([k, v]) => [k, v[0]]));
const PRIO = { 1: ['Alta', 'b-er'], 2: ['Média', 'b-av'], 3: ['Baixa', ''] };
async function levantarPendencias(obras) {
  const ids = obras.map(o => o.id); const hj = hoje(), em15 = addDias(hj, 15), ha15 = addDias(hj, -15);
  const pegar = async (t, sel, f) => { try { let p = sb.from(t).select(sel).in('obra_id', ids); if (f) p = f(p); return await q(p.limit(10000)); } catch (e) { return []; } };
  const [docs, itens, eap, eqs, eqc, func, rdos, abSemPreco, custos, medd, pend, ctt, cert] = await Promise.all([
    pegar('documentos_obra', 'id,obra_id,documento,status', p => p.in('status', ['pendente', 'em_andamento'])),
    pegar('orcamento_itens', 'id,obra_id,preco_unitario,ativo'), pegar('eap_atividades', 'id,obra_id'),
    pegar('equipamentos', 'id,obra_id,prefixo,descricao,horimetro_atual,observacao,status'), pegar('equipamentos_custo', 'equipamento_id,obra_id,custo_hora'),
    pegar('funcionarios', 'id,obra_id,nome,aso_validade,epi_entregue,ativo'),
    pegar('rdo', 'id,obra_id,data,status', p => p.gte('data', addDias(hj, -60))), pegar('abastecimentos', 'id,obra_id,valor', p => p.or('valor.is.null,valor.eq.0')),
    pegar('custos', 'id,obra_id,data,categoria,descricao,valor,anexo_caminho', p => p.is('anexo_caminho', null)),
    pegar('medicao_documentos', 'id,obra_id,documento,entregue,medicao:medicoes(numero,status)', p => p.eq('entregue', false)),
    pegar('pendencias', '*', p => p.in('status', ['aberta', 'em_andamento', 'a_confirmar']).neq('tipo', 'informado')),
    q(sb.from('contatos').select('*')).catch(() => []), q(sb.from('certidoes').select('*')).catch(() => [])]);
  const it = [];
  const add = (o, area, chave, info, detalhe, prio, link, quem) => it.push({ obra: o, area, chave, info, detalhe: detalhe || '', prio, link, quem });
  for (const o of obras) {
    const por = arr => arr.filter(x => x.obra_id === o.id);
    [['contrato_numero', 'Nº do contrato', 1], ['data_os', 'Data da Ordem de Serviço', 1], ['prazo_dias', 'Prazo contratual (dias)', 1], ['valor_contrato', 'Valor do contrato', 1], ['data_inicio', 'Data de início da obra', 2], ['data_fim_prevista', 'Término previsto', 2], ['contratante', 'Contratante', 2]]
      .forEach(([k, l, p]) => { if (o[k] == null || o[k] === '') add(o, 'contrato', `obra.${k}`, l, 'Cadastro da obra em branco', p, 'obras'); });
    por(docs).forEach(d => add(o, 'documentos', `doc.${d.id}`, d.documento, L.status_doc[d.status] || d.status, 2, 'obras'));
    const its = por(itens).filter(i => i.ativo !== false);
    if (!its.length) add(o, 'orcamento', 'orc.vazio', 'Planilha orçamentária vencedora (Excel)', 'Sem orçamento carregado: medição e memória de cálculo não funcionam', 1, 'orcamento');
    else { const sp = its.filter(i => i.preco_unitario == null).length; if (sp) add(o, 'orcamento', 'orc.preco', `Preço unitário de ${sp} item(ns)`, 'Itens sem preço na planilha', 2, 'orcamento'); }
    if (!por(eap).length) add(o, 'planejamento', 'eap.vazio', 'Cronograma físico (EAP e prazos por frente)', 'Sem planejamento: curva S e histograma previsto ficam vazios', 2, 'planejamento');
    const e = por(eqs);
    if (!e.length) add(o, 'frota', 'frota.vazio', 'Relação da frota com prefixo, placa e propriedade', 'Sem equipamentos cadastrados: RDO e abastecimento não lançam máquinas', 1, 'equipamentos');
    else {
      const prov = e.filter(x => /provis/i.test(x.observacao || '')); if (prov.length) add(o, 'frota', 'frota.prov', `Prefixo real de ${prov.length} equipamento(s)`, prov.map(x => x.prefixo).join(', '), 2, 'equipamentos');
      const ch = new Set(por(eqc).filter(x => x.custo_hora != null).map(x => x.equipamento_id)); const sc = e.filter(x => !ch.has(x.id)); if (sc.length) add(o, 'frota', 'frota.custo', `Custo horário de ${sc.length} equipamento(s)`, 'Próprio: custo/h; locado: valor do contrato de locação e franquia', 3, 'equipamentos', 'Gestor do contrato');
      const sh = e.filter(x => x.horimetro_atual == null); if (sh.length) add(o, 'frota', 'frota.hor', `Horímetro atual de ${sh.length} equipamento(s)`, sh.slice(0, 8).map(x => x.prefixo).join(', ') + (sh.length > 8 ? '…' : ''), 3, 'equipamentos');
    }
    const fu = por(func).filter(x => x.ativo !== false);
    if (!fu.length) add(o, 'maodeobra', 'func.vazio', 'Relação de funcionários (nome, função, admissão, ASO)', 'Exigida em toda medição', 1, 'maodeobra');
    else { const aso = fu.filter(x => !x.aso_validade || x.aso_validade < em15); if (aso.length) add(o, 'maodeobra', 'func.aso', `ASO vencido, a vencer ou sem data: ${aso.length}`, aso.slice(0, 6).map(x => x.nome).join(', ') + (aso.length > 6 ? '…' : ''), 1, 'maodeobra');
      const epi = fu.filter(x => !x.epi_entregue); if (epi.length) add(o, 'maodeobra', 'func.epi', `Ficha de EPI de ${epi.length} funcionário(s)`, 'Trabalhador sem EPI é afastado pela fiscalização', 1, 'maodeobra'); }
    const rd = por(rdos);
    const falta = diasSemRdo(rd.map(x => x.data), o.data_inicio);
    if (falta.length) add(o, 'rdo', 'rdo.falta', `RDO de ${falta.length} dia(s) (últimos ${DIAS_RDO} dias)`, falta.map(d => dt(d).slice(0, 5)).join(', '), 1, 'rdo');
    const env = rd.filter(x => x.status === 'enviado'); if (env.length) add(o, 'aprovacao', 'rdo.aprov', `Aprovação de ${env.length} RDO(s)`, env.map(x => dt(x.data).slice(0, 5)).join(', '), 2, 'rdo');
    const asp = por(abSemPreco); if (asp.length) add(o, 'custos', 'abast.preco', `Preço do diesel (R$/l) de ${asp.length} abastecimento(s)`, 'Sem preço o diesel entra como R$ 0,00 no custo real', 2, 'equipamentos');
    const sc = por(custos); if (sc.length) add(o, 'custos', 'custo.comp', `Comprovante de ${sc.length} lançamento(s) de custo`, `${brl(soma(sc, x => x.valor))} sem nota/recibo anexado`, 2, 'custos');
    por(medd).filter(x => !x.medicao || x.medicao.status !== 'aprovada').forEach(x => add(o, 'medicao', `med.${x.id}`, x.documento, `Medição nº ${x.medicao ? x.medicao.numero : '?'}`, 1, 'medicao'));
    por(pend).filter(p => !p.chave).forEach(p => it.push({ obra: o, area: p.area || (p.tipo === 'divergencia' ? 'projeto' : 'outros'), chave: null, pid: p.id, info: p.descricao, detalhe: [p.impacto, p.frente, p.documento].filter(Boolean).join(' · '), prio: p.prazo && p.prazo <= em15 ? 1 : 2, link: 'obras', quem: p.responsavel, solicitado: p.solicitado_em, prazo: p.prazo }));
  }
  /* certidões: da empresa, valem para todas as obras */
  const o0 = obras.find(o => o.id === S.obra.id) || obras[0];
  const TIPOS_CERT = ['CRF (FGTS)', 'INSS / Federal', 'Municipal', 'Trabalhista (CNDT)', 'Estadual'];
  if (!cert.length) add(o0, 'certidoes', 'cert.vazio', 'Certidões negativas da empresa', TIPOS_CERT.join(', '), 1, 'obras');
  else cert.filter(c => !c.validade || c.validade < em15).forEach(c => add(o0, 'certidoes', `cert.${c.id}`, `Certidão ${c.tipo}`, c.validade ? (c.validade < hj ? 'Vencida em ' : 'Vence em ') + dt(c.validade) : 'Sem validade', 1, 'obras'));
  /* rastreio: pendências automáticas já solicitadas */
  const rastro = Object.fromEntries(pend.filter(p => p.chave).map(p => [p.obra_id + '|' + p.chave, p]));
  it.forEach(x => { if (x.chave) { const r = rastro[x.obra.id + '|' + x.chave]; if (r) { x.solicitado = r.solicitado_em; x.pid = r.id; } } });
  /* quem pedir: contato cadastrado da área (da obra ou geral) > responsável informado > padrão */
  it.forEach(x => { const c = ctt.find(c => c.area === x.area && c.obra_id === x.obra.id) || ctt.find(c => c.area === x.area && !c.obra_id);
    x.contato = c || null; x.quem = c ? c.nome : (x.quem || (x.area === 'contrato' || x.area === 'aprovacao' || x.area === 'planejamento' ? (x.obra.gestor_contrato || AREA_INFO[x.area][1]) : AREA_INFO[x.area][1])); });
  /* fecha o rastreio do que já foi resolvido */
  const vivas = new Set(it.filter(x => x.chave).map(x => x.obra.id + '|' + x.chave));
  const resolvidas = pend.filter(p => p.chave && !vivas.has(p.obra_id + '|' + p.chave));
  if (resolvidas.length && pode('custos')) sb.from('pendencias').update({ status: 'resolvida' }).in('id', resolvidas.map(p => p.id)).then(() => {});
  return it.sort((a, b) => a.prio - b.prio || a.obra.codigo.localeCompare(b.obra.codigo));
}
function saudacao() { const hh = new Date().getHours(); return hh < 12 ? 'Bom dia' : hh < 18 ? 'Boa tarde' : 'Boa noite'; }
function msgWhats(quem, its) {
  const pn = String(quem).replace(/^(eng|dr|sr|sra)\.?\s+/i, '').split(/[\s/]/)[0];
  const obras = [...new Set(its.map(x => x.obra.codigo))];
  return `${saudacao()}${/^[A-ZÁÉÍÓÚ][a-záéíóúãõç]+$/.test(pn) ? ', ' + pn : ''}! Tudo bem?\nPra deixar o controle ${obras.length > 1 ? 'das obras' : 'da obra ' + obras[0]} em dia, preciso de:\n${its.map(x => `• ${obras.length > 1 ? `[${x.obra.codigo}] ` : ''}${x.info}${x.detalhe && x.detalhe.length < 70 ? ` (${x.detalhe})` : ''}`).join('\n')}\nConsegue me mandar quando puder? Obrigado!`;
}
function msgEmail(quem, its) {
  const obras = [...new Set(its.map(x => x.obra.codigo))];
  const assunto = `Solicitação de informações – ${obras.length > 1 ? 'Obras ' + obras.join(', ') : 'Obra ' + obras[0] + ' – ' + its[0].obra.nome} – NIEMAIA`;
  const corpo = `Prezado(a) ${quem},\n\nSolicitamos, por gentileza, o envio das informações abaixo, necessárias para a atualização do controle ${obras.length > 1 ? 'das obras' : 'da obra'} e da documentação junto à fiscalização:\n\n${its.map((x, i) => `${i + 1}. ${obras.length > 1 ? `[${x.obra.codigo}] ` : ''}${x.info}${x.detalhe ? ' – ' + x.detalhe : ''}`).join('\n')}\n\nFicamos à disposição para qualquer esclarecimento.\n\nAtenciosamente,\n${S.me.nome || ''}\n${S.me.cargo || 'NIEMAIA Construções Ltda.'}`;
  return { assunto, corpo };
}
async function pgInfoPend(el) {
  abas(el, [{ t: 'Lista para solicitar', f: infoLista }, { t: 'Contatos (a quem pedir)', f: infoContatos }]);
}
async function infoLista(c) {
  let escopo = 'todas', area = '', busca = '', soAbertas = true; let it = [];
  c.innerHTML = `<div class="bar"><select id="ipEsc" style="width:auto" aria-label="Obras"><option value="todas">Todas as obras</option><option value="atual">Só ${h(S.obra.codigo)}</option></select>
    <select id="ipArea" style="width:auto" aria-label="Área"><option value="">Todas as áreas</option>${Object.entries(L.area_info).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
    <input class="busca" id="ipBus" placeholder="Buscar" aria-label="Buscar"><label class="chk" style="width:auto"><input type="checkbox" id="ipAb" checked><span>Ocultar já solicitadas</span></label>
    <span class="sp"></span><button id="ipX">Excel</button><button id="ipP">PDF</button></div><div id="ipK"></div><div id="ipL"><div class="vazio">Levantando…</div></div>`;
  const filt = () => it.filter(x => (escopo === 'todas' || x.obra.id === S.obra.id) && (!area || x.area === area) && (!soAbertas || !x.solicitado) && (!busca || semAcento([x.info, x.detalhe, x.quem, x.obra.codigo].join(' ')).includes(semAcento(busca))));
  const desenhar = () => {
    const r = filt(); const grupos = {}; r.forEach(x => (grupos[x.quem] = grupos[x.quem] || []).push(x));
    $('#ipK').innerHTML = `<div class="kpis k4"><div class="kpi"><span>Informações pendentes</span><b>${r.length}</b></div><div class="kpi ${r.some(x => x.prio === 1) ? 'alerta' : ''}"><span>Prioridade alta</span><b>${r.filter(x => x.prio === 1).length}</b></div><div class="kpi"><span>Pessoas a acionar</span><b>${Object.keys(grupos).length}</b></div><div class="kpi"><span>Já solicitadas</span><b>${it.filter(x => x.solicitado && (escopo === 'todas' || x.obra.id === S.obra.id)).length}</b></div></div>`;
    $('#ipL').innerHTML = Object.keys(grupos).length ? Object.entries(grupos).sort((a, b) => Math.min(...a[1].map(x => x.prio)) - Math.min(...b[1].map(x => x.prio)) || b[1].length - a[1].length).map(([quem, xs], gi) => { const ct = xs.find(x => x.contato)?.contato;
      return `<div class="card ipg" data-g="${gi}"><div class="bar"><div><h3 style="margin:0">${h(quem)}</h3><small class="muted">${ct ? [ct.cargo, ct.empresa, ct.telefone, ct.email].filter(Boolean).map(h).join(' · ') : 'Sem contato cadastrado (aba Contatos)'}</small></div><span class="sp"></span>
      <button class="ipW"><i class="ti ti-brand-whatsapp"></i>WhatsApp</button><button class="ipE"><i class="ti ti-mail"></i>E-mail</button><button class="ipC"><i class="ti ti-copy"></i>Copiar</button>${pode('custos') ? '<button class="ipS"><i class="ti ti-check"></i>Marcar solicitado</button>' : ''}</div>
      <div class="tw"><table class="grid lst"><thead><tr><th>Obra</th><th>Área</th><th>Informação</th><th>Detalhe</th><th>Prioridade</th><th>Situação</th><th></th></tr></thead><tbody>${xs.map(x => `<tr><td data-l="Obra"><b>${h(x.obra.codigo)}</b></td><td data-l="Área">${h(L.area_info[x.area] || x.area)}</td><td data-l="Informação">${h(x.info)}</td><td data-l="Detalhe" class="muted">${h(x.detalhe)}</td><td data-l="Prioridade"><span class="badge ${PRIO[x.prio][1]}">${PRIO[x.prio][0]}</span></td><td data-l="Situação">${x.solicitado ? `<span class="badge b-ok">Solicitado ${dt(x.solicitado).slice(0, 5)}</span>` : '<span class="badge">A solicitar</span>'}${x.prazo ? ` <small class="muted">prazo ${dt(x.prazo)}</small>` : ''}</td><td><a href="#${x.link}" class="lk" title="Abrir módulo"><i class="ti ti-arrow-right"></i></a></td></tr>`).join('')}</tbody></table></div></div>`; }).join('') : '<div class="vazio">Nada pendente com esses filtros.</div>';
    const gs = Object.entries(grupos).sort((a, b) => Math.min(...a[1].map(x => x.prio)) - Math.min(...b[1].map(x => x.prio)) || b[1].length - a[1].length);
    $$('.ipg', c).forEach(card => { const [quem, xs] = gs[card.dataset.g]; const ct = xs.find(x => x.contato)?.contato;
      $('.ipW', card).onclick = () => { const tel = String(ct && ct.telefone || '').replace(/\D/g, ''); window.open(`https://wa.me/${tel ? (tel.length <= 11 ? '55' + tel : tel) : ''}?text=${encodeURIComponent(msgWhats(quem, xs))}`, '_blank', 'noopener'); };
      $('.ipE', card).onclick = () => { const m = msgEmail(quem, xs); location.href = `mailto:${encodeURIComponent(ct && ct.email || '')}?subject=${encodeURIComponent(m.assunto)}&body=${encodeURIComponent(m.corpo)}`; };
      $('.ipC', card).onclick = async () => { try { await navigator.clipboard.writeText(msgWhats(quem, xs)); toast('Mensagem copiada', 'ok'); } catch (e) { modal('Mensagem', `<textarea style="min-height:220px">${h(msgWhats(quem, xs))}</textarea>`); } };
      if ($('.ipS', card)) $('.ipS', card).onclick = () => marcar(xs).catch(erro); });
  };
  const marcar = async xs => {
    for (const x of xs) {
      if (x.pid) await q(sb.from('pendencias').update({ solicitado_em: hoje(), status: 'em_andamento', responsavel: x.quem }).eq('id', x.pid));
      else { const r = await q(sb.from('pendencias').insert({ obra_id: x.obra.id, chave: x.chave, tipo: 'pendencia', area: x.area, descricao: x.info + (x.detalhe ? ' – ' + x.detalhe : ''), responsavel: x.quem, solicitado_em: hoje(), status: 'em_andamento' }).select('id').single()); x.pid = r.id; }
      x.solicitado = hoje();
    }
    toast(`${xs.length} item(ns) marcado(s) como solicitado(s)`, 'ok'); desenhar();
  };
  const exp = tipo => { const r = filt(); const H = ['Obra', 'Área', 'Informação', 'Detalhe', 'Solicitar a', 'Prioridade', 'Situação'];
    const B = r.map(x => [x.obra.codigo, L.area_info[x.area] || x.area, x.info, x.detalhe, x.quem, PRIO[x.prio][0], x.solicitado ? 'Solicitado em ' + dt(x.solicitado) : 'A solicitar']);
    tipo === 'x' ? xlsxExport('INFO_PENDENTES', 'Informações pendentes', H, B) : tabelaPdf('INFO_PENDENTES', 'Informações pendentes – a solicitar', H, B, { paisagem: true }); };
  $('#ipEsc').onchange = e => { escopo = e.target.value; desenhar(); };
  $('#ipArea').onchange = e => { area = e.target.value; desenhar(); };
  $('#ipBus').oninput = e => { busca = e.target.value; desenhar(); };
  $('#ipAb').onchange = e => { soAbertas = e.target.checked; desenhar(); };
  $('#ipX').onclick = () => exp('x'); $('#ipP').onclick = () => exp('p');
  it = await levantarPendencias(S.obras); desenhar();
}
async function infoContatos(c) {
  const oo = Object.fromEntries(S.obras.map(o => [o.id, o.codigo]));
  await crud(c, { table: 'contatos', title: 'Contatos – a quem pedir cada informação', doc: 'CONTATOS', semObra: true, write: 'custos', novo: 'Novo contato', order: 'area',
    intro: 'Cadastre quem responde por cada área. Sem obra = vale para todas. A lista de pendências usa esse contato para montar o WhatsApp e o e-mail.',
    load: () => q(sb.from('contatos').select('*').order('area').order('nome')),
    cols: [{ k: 'area', l: 'Área', t: 'sel', o: L.area_info, req: true }, { k: 'nome', l: 'Nome', req: true }, { k: 'cargo', l: 'Cargo / função' }, { k: 'empresa', l: 'Empresa / setor' },
      { k: 'telefone', l: 'WhatsApp', dica: 'Com DDD, ex.: 83 99999-9999' }, { k: 'email', l: 'E-mail', t: 'email' }, { k: 'obra_id', l: 'Obra', t: 'sel', o: oo, dica: 'Em branco = todas as obras', v: r => r.obra_id ? oo[r.obra_id] : 'Todas' }, { k: 'observacao', l: 'Observação', t: 'area', w: 'wf', formOnly: true }] });
}
