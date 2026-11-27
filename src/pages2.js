'use strict';
/* ================= GRADE EDITÁVEL ================= */
function grade(box, defs, dados, ro, onCh) {
  { const nb = box.cloneNode(false); box.replaceWith(nb); box = nb; }
  let linhas = dados.map(d => ({ ...d }));
  const cel = (d, r, i) => {
    const v = r[d.k] ?? '', dis = ro ? 'disabled' : '';
    if (d.t === 'sel') return `<select data-i="${i}" data-k="${d.k}" ${dis}><option value=""></option>${d.o.map(([k, l]) => `<option value="${h(k)}" ${String(v) === String(k) ? 'selected' : ''}>${h(l)}</option>`).join('')}</select>`;
    if (d.t === 'bool') return `<input type="checkbox" data-i="${i}" data-k="${d.k}" ${v ? 'checked' : ''} ${dis} style="width:auto">`;
    if (d.t === 'num') return `<input type="number" step="any" inputmode="decimal" data-i="${i}" data-k="${d.k}" value="${h(v)}" ${dis} style="min-width:${d.w || 80}px">`;
    return `<input data-i="${i}" data-k="${d.k}" value="${h(v)}" ${dis} ${d.list ? `list="gl_${d.k}"` : ''} style="min-width:${d.w || 110}px">`;
  };
  const desenhar = () => {
    box.innerHTML = `<div class="tw"><table class="grid"><thead><tr>${defs.map(d => `<th class="${d.t === 'num' ? 'n' : ''}">${h(d.l)}</th>`).join('')}${ro ? '' : '<th></th>'}</tr></thead><tbody>${linhas.map((r, i) => `<tr>${defs.map(d => `<td class="ed">${cel(d, r, i)}</td>`).join('')}${ro ? '' : `<td class="ed"><button class="lk er" data-del="${i}" aria-label="Remover linha">Remover</button></td>`}</tr>`).join('') || `<tr><td colspan="${defs.length + 1}" class="vazio">Nenhuma linha.</td></tr>`}</tbody></table></div>${ro ? '' : '<button class="add" style="margin-top:6px">Adicionar linha</button>'}${defs.filter(d => d.list).map(d => `<datalist id="gl_${d.k}">${d.list.map(x => `<option value="${h(x)}">`).join('')}</datalist>`).join('')}`;
  };
  desenhar();
  box.addEventListener('input', e => { const t = e.target, i = t.dataset.i; if (i === undefined) return; const d = defs.find(x => x.k === t.dataset.k); linhas[i][t.dataset.k] = d.t === 'bool' ? t.checked : d.t === 'num' ? (t.value === '' ? null : Number(t.value)) : (t.value || null); if (onCh && onCh(linhas[i], t.dataset.k)) { const foc = t.dataset.k; desenhar(); const n = $(`[data-i="${i}"][data-k="${foc}"]`, box); if (n) { n.focus(); if (n.setSelectionRange && n.type === 'text') n.setSelectionRange(n.value.length, n.value.length); } } });
  box.addEventListener('change', e => { const t = e.target; if (t.tagName === 'SELECT' || t.type === 'checkbox') t.dispatchEvent(new Event('input', { bubbles: true })); });
  box.addEventListener('click', e => { if (e.target.dataset.del !== undefined) { linhas.splice(+e.target.dataset.del, 1); desenhar(); } else if (e.target.classList.contains('add')) { linhas.push({}); desenhar(); } });
  return { get: () => linhas.filter(r => Object.values(r).some(v => v !== null && v !== '' && v !== false)), set: (a) => { linhas = a.map(x => ({ ...x })); desenhar(); } };
}

/* ================= RDO ================= */
async function pgRdo(el) {
  abas(el, [{ t: 'Diários', f: c => listaRdo(c) }, { t: 'Importar RDO (Claude / Excel)', f: c => importarRdo(c) }]);
}
async function listaRdo(el) {
  await crud(el, {
    table: 'rdo', title: 'Diários de obra (RDO)', doc: 'RDO_LISTA', order: 'data', asc: false, write: 'campo', novo: 'Novo RDO',
    intro: 'Um RDO por obra e por dia. Rascunho → enviado → aprovado pelo engenheiro gestor. RDO aprovado fica bloqueado.',
    cols: [{ k: 'data', l: 'Data', t: 'date' }, { k: 'condicao', l: 'Condição', t: 'sel', o: L.condicao }, { k: 'clima_manha', l: 'Clima manhã', t: 'sel', o: L.clima }, { k: 'clima_tarde', l: 'Clima tarde', t: 'sel', o: L.clima }, { k: 'status', l: 'Situação', t: 'sel', o: L.status_rdo, badge: true }, { k: 'origem', l: 'Origem', v: r => r.origem === 'importado' ? 'Importado' : 'Lançado' }, { k: 'anexo_nome', l: 'Documento', v: r => r.anexo_nome ? 'Sim' : '' }, { k: 'ocorrencias', l: 'Ocorrências', v: r => (r.ocorrencias || '').slice(0, 80) }],
    abrir: (r) => rdoEditor(r ? r.id : null)
  });
}
async function rdoCarregar(id) {
  const [r, serv, efe, eqs, fotos] = await Promise.all([
    q(sb.from('rdo').select('*, criador:criado_por(nome), aprovador:aprovado_por(nome)').eq('id', id).single()),
    q(sb.from('rdo_servicos').select('*').eq('rdo_id', id).order('id')),
    q(sb.from('rdo_efetivo').select('*').eq('rdo_id', id).order('funcao')),
    q(sb.from('rdo_equipamentos').select('*, eq:equipamento_id(prefixo,descricao)').eq('rdo_id', id)),
    q(sb.from('fotos').select('*').eq('rdo_id', id).order('data_hora'))
  ]);
  return { r, serv, efe, eqs, fotos };
}
async function rdoEditor(id, dataNova) {
  const el = $('#cont'); el.innerHTML = '<div class="vazio">Carregando…</div>';
  const itens = await refItens(), equips = await refEquip();
  let D = id ? await rdoCarregar(id) : { r: { obra_id: S.obra.id, data: dataNova || hoje(), condicao: 'praticavel', status: 'rascunho', clima_manha: 'bom', clima_tarde: 'bom', horario_inicio: '07:00', horario_fim: '17:00' }, serv: [], efe: [], eqs: [], fotos: [] };
  const r = D.r;
  const ro = !pode('campo') || (r.status === 'aprovado' && !pode('aprovar'));
  const C = [
    { k: 'data', l: 'Data', t: 'date', req: true }, { k: 'clima_manha', l: 'Clima – manhã', t: 'sel', o: L.clima }, { k: 'clima_tarde', l: 'Clima – tarde', t: 'sel', o: L.clima },
    { k: 'condicao', l: 'Condição de trabalho', t: 'sel', o: L.condicao, req: true }, { k: 'horario_inicio', l: 'Início', t: 'time' }, { k: 'horario_fim', l: 'Término', t: 'time' },
    { k: 'atividades', l: 'Resumo das atividades do dia', t: 'area', w: 'wf' }, { k: 'ocorrencias', l: 'Ocorrências (chuva, paralisação, quebra, falta de material, interferências, visitas)', t: 'area', w: 'wf' },
    { k: 'observacoes_fiscal', l: 'Observações da fiscalização', t: 'area', w: 'wf' }
  ];
  el.innerHTML = `<div class="bar"><button id="voltar">Voltar à lista</button><h1 style="margin:0 8px">RDO ${dt(r.data)}</h1>${badge(r.status, L.status_rdo)}<span class="sp"></span><span class="muted">${r.criador ? 'Lançado por ' + h(r.criador.nome) : ''}${r.aprovador ? ' · aprovado por ' + h(r.aprovador.nome) + ' em ' + new Date(r.aprovado_em).toLocaleString('pt-BR') : ''}</span></div>
  <div class="card"><div class="form" id="cab">${C.map(c => campoHtml(c, r[c.k])).join('')}</div></div>
  <div class="card"><h3 style="margin-top:0">Serviços executados</h3><p class="muted">Ao aprovar o RDO, os serviços com item e na unidade do orçamento entram sozinhos na memória de cálculo (produção, % físico e medição). Quantidade calculada automaticamente (comprimento × largura) para itens em m². A produção oficial é a memória de cálculo: use o botão "Lançar serviços na memória de cálculo" ou lance direto em Produção mensal. CBUQ: lance em Produção CBUQ, com o ticket da balança.</p><div id="gS"></div></div>
  <div class="g2"><div class="card"><h3 style="margin-top:0">Efetivo</h3><div id="gE"></div><p class="muted" id="totE"></p></div>
  <div class="card"><h3 style="margin-top:0">Equipamentos</h3><div id="gQ"></div></div></div>
  ${id ? '<div class="card"><h3 style="margin-top:0">Documento do RDO (PDF / Word)</h3><div id="rdoAnexo" class="bar" style="margin:0"></div></div>' : ''}
  <div class="card"><h3 style="margin-top:0">Fotos</h3>${id ? `${ro ? '' : '<input type="file" id="fFoto" accept="image/*" multiple capture="environment" style="max-width:360px">'}<p class="muted">Legenda no padrão: [Obra] – [Serviço] – [Rua/Est.] – L[E/D]. Clique na foto para editar a legenda.</p><div class="fotos" id="lFotos"></div>` : '<p class="muted">Salve o RDO para anexar fotos.</p>'}</div>
  <div class="bar" id="acoes"></div>`;
  if (ro) $$('#cab input,#cab select,#cab textarea').forEach(e => e.disabled = true);
  const itemOp = itens.map(i => [i.id, itemLbl(i)]), itemMap = Object.fromEntries(itens.map(i => [i.id, i]));
  const gS = grade($('#gS'), [
    { k: 'orcamento_item_id', l: 'Item do orçamento', t: 'sel', o: itemOp }, { k: 'servico', l: 'Serviço', w: 170 }, { k: 'local', l: 'Rua / local', w: 150 },
    { k: 'estaca_ini', l: 'Est. inicial', w: 70 }, { k: 'estaca_fim', l: 'Est. final', w: 70 }, { k: 'lado', l: 'Lado', t: 'sel', o: Object.entries(L.lado) },
    { k: 'comprimento', l: 'Compr. (m)', t: 'num', w: 70 }, { k: 'largura', l: 'Larg. (m)', t: 'num', w: 60 }, { k: 'quantidade', l: 'Quantidade', t: 'num' }, { k: 'unidade', l: 'Un', w: 45 },
    { k: 'retrabalho', l: 'Retrab.', t: 'bool' }, { k: 'observacao', l: 'Obs.', w: 120 }
  ], D.serv, ro, (l, k) => {
    let mudou = false; const it = itemMap[l.orcamento_item_id];
    if (k === 'orcamento_item_id' && it) { if (!l.servico) l.servico = it.descricao; l.unidade = it.unidade; mudou = true; }
    if (['comprimento', 'largura', 'orcamento_item_id'].includes(k) && l.comprimento && l.largura && (!it || /m²|m2/i.test(it.unidade))) { l.quantidade = Math.round(l.comprimento * l.largura * 100) / 100; if (!l.unidade) l.unidade = 'm²'; mudou = true; }
    else if (['comprimento', 'orcamento_item_id'].includes(k) && l.comprimento && it && /^m$/i.test(it.unidade)) { l.quantidade = l.comprimento; mudou = true; }
    return mudou;
  });
  const totE = () => { const a = gE.get(); $('#totE').textContent = `Total: ${soma(a, x => x.quantidade)} pessoas (${soma(a.filter(x => x.vinculo !== 'terceiro'), x => x.quantidade)} próprias, ${soma(a.filter(x => x.vinculo === 'terceiro'), x => x.quantidade)} terceiras)`; };
  const gE = grade($('#gE'), [{ k: 'funcao', l: 'Função', list: FUNCOES, w: 160 }, { k: 'vinculo', l: 'Vínculo', t: 'sel', o: Object.entries(L.vinculo) }, { k: 'quantidade', l: 'Qtd', t: 'num', w: 55 }, { k: 'horas', l: 'Horas', t: 'num', w: 55 }], D.efe.length ? D.efe : [], ro, () => { setTimeout(totE); return false; });
  totE();
  const gQ = grade($('#gQ'), [{ k: 'equipamento_id', l: 'Equipamento (prefixo)', t: 'sel', o: equips.map(e => [e.id, `${e.prefixo} – ${e.descricao}`]) }, { k: 'horimetro_ini', l: 'Hor. inicial', t: 'num' }, { k: 'horimetro_fim', l: 'Hor. final', t: 'num' }, { k: 'horas_produtivas', l: 'H prod.', t: 'num', w: 55 }, { k: 'horas_improdutivas', l: 'H improd.', t: 'num', w: 55 }, { k: 'horas_paradas', l: 'H parada', t: 'num', w: 55 }, { k: 'motivo_parada', l: 'Motivo (chuva, quebra…)', w: 140 }, { k: 'diesel_litros', l: 'Diesel (l)', t: 'num', w: 60 }],
    D.eqs.map(x => { const y = { ...x }; delete y.eq; return y; }), ro, (l, k) => { if (['horimetro_ini', 'horimetro_fim'].includes(k) && l.horimetro_ini != null && l.horimetro_fim != null && l.horas_produtivas == null) { l.horas_produtivas = Math.round((l.horimetro_fim - l.horimetro_ini) * 10) / 10; return true; } return false; });

  const montar = () => {
    const cab = lerCampos($('#cab'), C);
    const limpa = (a, campos) => a.map(x => Object.fromEntries(campos.map(c => [c, x[c] ?? (c === 'retrabalho' ? false : null)])));
    const serv = limpa(gS.get(), ['orcamento_item_id', 'servico', 'local', 'estaca_ini', 'estaca_fim', 'lado', 'comprimento', 'largura', 'quantidade', 'unidade', 'retrabalho', 'observacao']);
    serv.forEach(s => { if (!s.servico) throw new Error('Informe o serviço em todas as linhas de serviços.'); });
    const efe = limpa(gE.get(), ['funcao', 'vinculo', 'quantidade', 'horas']).map(x => ({ ...x, vinculo: x.vinculo || 'proprio' }));
    efe.forEach(x => { if (!x.funcao || x.quantidade == null) throw new Error('Efetivo: informe função e quantidade.'); });
    const eqs = limpa(gQ.get(), ['equipamento_id', 'horimetro_ini', 'horimetro_fim', 'horas_produtivas', 'horas_improdutivas', 'horas_paradas', 'motivo_parada', 'diesel_litros']);
    eqs.forEach(x => { if (!x.equipamento_id) throw new Error('Equipamentos: selecione o equipamento em todas as linhas.'); if (x.horimetro_ini != null && x.horimetro_fim != null && x.horimetro_fim < x.horimetro_ini) throw new Error('Horímetro final menor que o inicial.'); });
    return { obra_codigo: S.obra.codigo, rdo: { id: id || undefined, obra_id: S.obra.id, ...cab }, servicos: serv, efetivo: efe, equips: eqs };
  };
  const salvar = async (status) => {
    let p; try { p = montar(); } catch (e) { erro(e); return null; }
    if (status) p.rdo.status = status;
    try {
      const nid = await salvarRdoPayload(p);
      if (pode('equip')) for (const x of p.equips) { const e = equips.find(z => z.id === x.equipamento_id); if (e && x.horimetro_fim != null && (e.horimetro_atual == null || x.horimetro_fim > e.horimetro_atual)) await sb.from('equipamentos').update({ horimetro_atual: x.horimetro_fim }).eq('id', e.id); }
      refLimpar('equip'); toast(status === 'enviado' ? 'RDO enviado para aprovação' : status === 'aprovado' ? 'RDO aprovado' : 'RDO salvo', 'ok');
      return nid;
    } catch (e) {
      if (/fetch|network/i.test(e.message)) { const pend = pendentes().filter(x => !(x.rdo.obra_id === p.rdo.obra_id && x.rdo.data === p.rdo.data)); pend.push(p); setPendentes(pend); toast('Sem conexão: RDO guardado neste aparelho. Sincronize quando houver sinal.', 'erro'); return null; }
      erro(e); return null;
    }
  };
  const ac = $('#acoes'); const b = (t, c, f) => { const x = document.createElement('button'); x.textContent = t; if (c) x.className = c; x.onclick = async () => { x.disabled = true; try { await f(); } catch (e) { erro(e); } x.disabled = false; }; ac.appendChild(x); };
  if (!ro) {
    b('Salvar', 'pri', async () => { const n = await salvar(); if (n) rdoEditor(n); });
    if (['rascunho', 'devolvido'].includes(r.status)) b('Salvar e enviar para aprovação', '', async () => { const n = await salvar('enviado'); if (n) rdoEditor(n); });
    b('Copiar efetivo e equipamentos do RDO anterior', '', async () => {
      const ant = await q(sb.from('rdo').select('id,data').eq('obra_id', S.obra.id).lt('data', $('#f_data').value).order('data', { ascending: false }).limit(1));
      if (!ant.length) return toast('Não há RDO anterior.');
      const [e2, q2] = await Promise.all([q(sb.from('rdo_efetivo').select('funcao,vinculo,quantidade,horas').eq('rdo_id', ant[0].id)), q(sb.from('rdo_equipamentos').select('equipamento_id,horimetro_fim').eq('rdo_id', ant[0].id))]);
      gE.set(e2); gQ.set(q2.map(x => ({ equipamento_id: x.equipamento_id, horimetro_ini: x.horimetro_fim }))); totE(); toast(`Copiado do RDO de ${dt(ant[0].data)}`);
    });
  }
  if (id && pode('aprovar')) {
    if (r.status !== 'aprovado') b('Aprovar', 'ok', async () => { const n = await salvar('aprovado'); if (n) rdoEditor(n); });
    if (r.status === 'enviado') b('Devolver para correção', 'er', () => modal('Devolver RDO', '<label for="mot">Motivo</label><textarea id="mot"></textarea>', [{ t: 'Devolver', c: 'pri', f: async o => { const m = $('#mot', o).value.trim(); if (!m) throw new Error('Informe o motivo.'); await q(sb.from('rdo').update({ status: 'devolvido', ocorrencias: [r.ocorrencias, `[Devolvido em ${dt(hoje())}: ${m}]`].filter(Boolean).join('\n') }).eq('id', id)); rdoEditor(id); } }]));
    if (r.status === 'aprovado') b('Reabrir para edição', '', async () => { await q(sb.from('rdo').update({ status: 'rascunho' }).eq('id', id)); rdoEditor(id); });
  }
  if (id) b('PDF do RDO', '', async () => { const P = pdfNovo(`Relatório Diário de Obra – ${dt(r.data)}`); rdoPdf(P, D); if (D.fotos.length) await fotosPdf(P, D.fotos); P.salvar(`RDO_${r.data}`); });
  if (id && pode('aprovar') && (r.status !== 'aprovado' || S.perfil === 'admin')) b('Excluir RDO', 'er', () => confirma(`Excluir o RDO de ${dt(r.data)} com todos os lançamentos?`, async () => { await q(sb.from('rdo').delete().eq('id', id)); toast('RDO excluído'); location.hash = '#rdo'; rotear(); }));
  $('#voltar').onclick = () => rotear();
  if (id) { anexoRdo(id, r, ro); await fotosRdo(id, D, ro, gS); }
}
async function fotosRdo(id, D, ro, gS) {
  const box = $('#lFotos'); if (!box) return;
  const desenhar = async () => {
    D.fotos = await q(sb.from('fotos').select('*').eq('rdo_id', id).order('data_hora'));
    if (!D.fotos.length) { box.innerHTML = '<p class="muted">Nenhuma foto.</p>'; return; }
    const urls = await q(sb.storage.from('fotos').createSignedUrls(D.fotos.map(f => f.caminho), 3600));
    box.innerHTML = D.fotos.map((f, i) => `<figure data-i="${i}" style="cursor:pointer"><img src="${urls[i] && urls[i].signedUrl}" alt="${h(f.legenda)}" loading="lazy"><figcaption>${h(f.legenda || 'Sem legenda')}<br><span class="muted">${f.data_hora ? new Date(f.data_hora).toLocaleString('pt-BR') : ''}</span></figcaption></figure>`).join('');
  };
  await desenhar();
  box.onclick = e => {
    const fg = e.target.closest('figure'); if (!fg) return; const f = D.fotos[fg.dataset.i];
    const C = [{ k: 'servico', l: 'Serviço' }, { k: 'local', l: 'Rua / estaca' }, { k: 'lado', l: 'Lado', t: 'sel', o: L.lado }, { k: 'legenda', l: 'Legenda', w: 'wf' }, { k: 'data_hora', l: 'Data e hora', t: 'text' }, { k: 'latitude', l: 'Latitude', t: 'num' }, { k: 'longitude', l: 'Longitude', t: 'num' }];
    const bx = document.createElement('div'); bx.className = 'form'; bx.innerHTML = C.map(c => campoHtml(c, c.k === 'data_hora' && f.data_hora ? new Date(f.data_hora).toISOString().slice(0, 16).replace('T', ' ') : f[c.k])).join('') + '<div class="wf"><button type="button" id="gl">Gerar legenda no padrão</button></div>';
    $('#gl', bx).onclick = () => { $('#f_legenda', bx).value = legendaPadrao($('#f_servico', bx).value, $('#f_local', bx).value, $('#f_lado', bx).value); };
    if (ro) $$('input,select,button', bx).forEach(x => x.disabled = true);
    modal('Foto', bx, ro ? [] : [{ t: 'Excluir foto', c: 'er', f: async () => { await q(sb.storage.from('fotos').remove([f.caminho])); await q(sb.from('fotos').delete().eq('id', f.id)); await desenhar(); } }, '|', { t: 'Salvar', c: 'pri', f: async () => { const v = lerCampos(bx, C); if (v.data_hora) { const d = new Date(v.data_hora.replace(' ', 'T')); if (isNaN(d)) throw new Error('Data e hora inválida (use AAAA-MM-DD HH:MM).'); v.data_hora = d.toISOString(); } await q(sb.from('fotos').update(v).eq('id', f.id)); await desenhar(); } }]);
  };
  const inp = $('#fFoto'); if (!inp || ro) return;
  inp.onchange = async () => {
    const arqs = [...inp.files]; if (!arqs.length) return;
    const s0 = gS.get()[0] || {};
    toast(`Enviando ${arqs.length} foto(s)…`);
    for (const [i, a] of arqs.entries()) {
      try {
        const im = await reduzImg(await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(a); }), 1920);
        const blob = await (await fetch(im.url)).blob();
        const caminho = `${S.obra.id}/${id}/${Date.now()}_${i}.jpg`;
        await q(sb.storage.from('fotos').upload(caminho, blob, { contentType: 'image/jpeg' }));
        await q(sb.from('fotos').insert({ obra_id: S.obra.id, rdo_id: id, caminho, servico: s0.servico || null, local: s0.local || null, lado: s0.lado || null, legenda: legendaPadrao(s0.servico, [s0.local, s0.estaca_ini ? 'est. ' + s0.estaca_ini + (s0.estaca_fim ? ' a ' + s0.estaca_fim : '') : ''].filter(Boolean).join(' '), s0.lado), data_hora: new Date(a.lastModified || Date.now()).toISOString() }));
      } catch (e) { erro(e); }
    }
    inp.value = ''; await desenhar(); toast('Fotos anexadas', 'ok');
  };
}
function rdoPdf(P, D) {
  const r = D.r;
  P.tabela(['Data', 'Clima manhã', 'Clima tarde', 'Condição', 'Horário', 'Situação'], [[dt(r.data), L.clima[r.clima_manha] || '', L.clima[r.clima_tarde] || '', L.condicao[r.condicao] || '', `${(r.horario_inicio || '').slice(0, 5)} às ${(r.horario_fim || '').slice(0, 5)}`, L.status_rdo[r.status]]]);
  P.texto('Serviços executados', { b: true, s: 10.5 });
  P.tabela(['Serviço', 'Rua / local', 'Estacas', 'Lado', 'Compr.', 'Larg.', 'Quant.', 'Un', 'Obs.'], D.serv.length ? D.serv.map(s => [s.servico + (s.retrabalho ? ' (retrabalho)' : ''), s.local || '', [s.estaca_ini, s.estaca_fim].filter(Boolean).join(' a '), s.lado || '', nf(s.comprimento), nf(s.largura), nf(s.quantidade), s.unidade || '', s.observacao || '']) : [['Sem serviços lançados', '', '', '', '', '', '', '', '']], { fs: 8 });
  P.texto('Efetivo', { b: true, s: 10.5 });
  P.tabela(['Função', 'Vínculo', 'Quantidade', 'Horas'], D.efe.map(e => [e.funcao, L.vinculo[e.vinculo], String(e.quantidade), nf(e.horas, 1)]), { foot: ['Total', '', String(soma(D.efe, e => e.quantidade)), ''] });
  P.texto('Equipamentos', { b: true, s: 10.5 });
  P.tabela(['Prefixo', 'Descrição', 'Hor. ini.', 'Hor. fim', 'H prod.', 'H improd.', 'H parada', 'Motivo', 'Diesel (l)'], D.eqs.map(x => [x.eq ? x.eq.prefixo : '', x.eq ? x.eq.descricao : '', nf(x.horimetro_ini, 1), nf(x.horimetro_fim, 1), nf(x.horas_produtivas, 1), nf(x.horas_improdutivas, 1), nf(x.horas_paradas, 1), x.motivo_parada || '', nf(x.diesel_litros, 1)]), { fs: 8 });
  if (r.atividades) { P.texto('Atividades do dia', { b: true, s: 10.5 }); P.texto(r.atividades); }
  if (r.ocorrencias) { P.texto('Ocorrências', { b: true, s: 10.5 }); P.texto(r.ocorrencias); }
  if (r.observacoes_fiscal) { P.texto('Observações da fiscalização', { b: true, s: 10.5 }); P.texto(r.observacoes_fiscal); }
  P.assinaturas(['Responsável técnico – NIEMAIA', 'Fiscalização – Contratante']);
}

/* ================= PRODUÇÃO CBUQ ================= */
async function pgProducao(el) {
  const itens = await refItens();
  await crud(el, {
    table: 'producao_cbuq', title: 'Produção de CBUQ', doc: 'PRODUCAO_CBUQ', order: 'data', asc: false, write: 'campo', paisagem: true,
    intro: 'Massa teórica = área × espessura × densidade (padrão 0,05 m × 2,40 t/m³). Conferir sempre com os tickets de balança da usina. Ligante: imprimação 1,10 l/m² (leito natural e requalificação) ou RR-1C 0,50 l/m² (paralelepípedo e reacapeamento), conforme o orçamento.',
    cols: [
      { k: 'data', l: 'Data', t: 'date', req: true, def: hoje() }, { k: 'local', l: 'Rua / local', req: true }, { k: 'estaca_ini', l: 'Est. ini.' }, { k: 'estaca_fim', l: 'Est. fim' }, { k: 'lado', l: 'Lado', t: 'sel', o: L.lado },
      { k: 'tipo_area', l: 'Tipo de área', t: 'sel', o: L.tipo_area, req: true }, { k: 'orcamento_item_id', l: 'Item do orçamento', t: 'ref', ref: 'item', formOnly: true, w: 'w2', dica: 'Vazio: o sistema vincula ao item de CBUQ (t) do mesmo tipo de área.' },
      { k: 'comprimento', l: 'Compr. (m)', t: 'num', formOnly: true }, { k: 'largura', l: 'Larg. (m)', t: 'num', formOnly: true },
      { k: 'area', l: 'Área (m²)', t: 'num', req: true, sum: true }, { k: 'espessura', l: 'Espessura (m)', t: 'num', d: 3, def: 0.05, formOnly: true }, { k: 'densidade', l: 'Densidade (t/m³)', t: 'num', def: 2.40, formOnly: true },
      { k: 'massa_teorica', l: 'Massa teórica (t)', t: 'num', d: 3, listOnly: true, sum: true }, { k: 'tickets', l: 'Tickets da balança' }, { k: 'massa_balanca', l: 'Balança (t)', t: 'num', d: 3, sum: true },
      { k: 'diferenca_t', l: 'Dif. (t)', t: 'num', d: 3, listOnly: true, sum: true }, { k: 'ligante', l: 'Ligante', t: 'sel', o: L.ligante, listOnly: true },
      { k: 'ligante_aplicado_l', l: 'Ligante aplicado (l)', t: 'num', d: 1, sum: true }, { k: 'temperatura_c', l: 'Temperatura (°C)', t: 'num', d: 1, formOnly: true }, { k: 'observacao', l: 'Observação', t: 'area', w: 'wf', formOnly: true }
    ],
    calc: box => {
      const g = k => { const v = $('#f_' + k, box); return v && v.value !== '' ? Number(v.value) : null; };
      if (g('comprimento') && g('largura') && document.activeElement && ['f_comprimento', 'f_largura'].includes(document.activeElement.id)) $('#f_area', box).value = Math.round(g('comprimento') * g('largura') * 100) / 100;
      let info = $('.calcinfo', box); if (!info) { info = document.createElement('div'); info.className = 'wf calcinfo b-az'; info.style.cssText = 'padding:8px 10px;border-radius:6px'; box.appendChild(info); }
      const a = g('area') || 0, t = a * (g('espessura') ?? 0.05) * (g('densidade') ?? 2.4), tipo = $('#f_tipo_area', box).value, tx = imprimaTipo(tipo) ? 1.10 : 0.50, bal = g('massa_balanca');
      info.textContent = `Massa teórica: ${nf(t, 3)} t · Ligante previsto: ${nf(a * tx, 1)} l (${imprimaTipo(tipo) ? 'imprimação 1,10' : 'RR-1C 0,50'} l/m²)${bal ? ` · Balança × teórica: ${nf(100 * (bal - t) / (t || 1), 1)}%` : ''}`;
    },
    antesSalvar: v => { if (!v.orcamento_item_id) { const it = itens.find(i => i.tipo_area === v.tipo_area && ehCbuq(i)) || itens.find(ehCbuq); if (it) v.orcamento_item_id = it.id; } },
    resumo: (b, rows) => {
      const tipos = Object.keys(L.tipo_area);
      const lin = tipos.map(t => { const r = rows.filter(x => x.tipo_area === t), cb = r.filter(x => num(x.massa_balanca) !== null), ca = r.filter(x => num(x.ligante_aplicado_l) !== null); const contr = soma(itens.filter(i => i.tipo_area === t && ehCbuq(i)), i => i.quantidade);
        return { t, area: soma(r, x => x.area), teo: soma(r, x => x.massa_teorica), contr, bal: soma(cb, x => x.massa_balanca), teoBal: soma(cb, x => x.massa_teorica), lig: soma(r, x => x.area * (imprimaTipo(t) ? 1.1 : 0.5)), apl: soma(ca, x => x.ligante_aplicado_l), areaApl: soma(ca, x => x.area) }; }).filter(x => x.area || x.contr);
      const cT = soma(itens.filter(ehCbuq), i => i.quantidade), tT = soma(rows, x => x.massa_teorica);
      b.innerHTML = (cT ? `<div class="kpis"><div class="kpi"><span>CBUQ aplicado (teórico)</span><b>${nf(tT, 1)} t</b><small>de ${nf(cT, 1)} t contratadas (${pct(100 * tT / cT)})</small></div><div class="kpi"><span>Saldo de CBUQ</span><b>${nf(cT - tT, 1)} t</b><small>${nf((cT - tT) / 0.12, 0)} m² a 5 cm</small></div></div>` : '') + (lin.length ? `<div class="card"><h3 style="margin-top:0">Resumo por tipo de área</h3><div class="tw"><table class="grid"><thead><tr><th>Tipo</th><th class="n">Área (m²)</th><th class="n">Teórica (t)</th><th class="n">Contratado (t)</th><th class="n">% exec.</th><th class="n">Balança (t)</th><th class="n">Dif. balança</th><th class="n">Ligante previsto (l)</th><th class="n">Taxa real (l/m²)</th></tr></thead><tbody>${lin.map(x => `<tr><td>${L.tipo_area[x.t]}</td><td class="n">${nf(x.area)}</td><td class="n">${nf(x.teo, 3)}</td><td class="n">${nf(x.contr, 3)}</td><td class="n">${x.contr ? pct(100 * x.teo / x.contr) : '–'}</td><td class="n">${nf(x.bal, 3)}</td><td class="n">${x.teoBal ? pct(100 * (x.bal - x.teoBal) / x.teoBal) : '–'}</td><td class="n">${nf(x.lig, 1)}</td><td class="n">${x.areaApl ? nf(x.apl / x.areaApl, 2) : '–'}</td></tr>`).join('')}</tbody></table></div></div>` : '');
    }
  });
}

/* ================= EQUIPAMENTOS ================= */
async function pgEquip(el) {
  const ab = [
    { t: 'Frota', f: c => crud(c, { table: 'equipamentos', title: 'Frota de equipamentos', doc: 'EQUIPAMENTOS', order: 'prefixo', write: 'equip',
      cols: [{ k: 'prefixo', l: 'Prefixo', req: true }, { k: 'descricao', l: 'Descrição', req: true, w: 'w2' }, { k: 'tipo', l: 'Tipo', list: ['Vibroacabadora', 'Rolo de pneus', 'Rolo liso', 'Rolo pé de carneiro', 'Motoniveladora', 'Escavadeira', 'Retroescavadeira', 'Pá carregadeira', 'Caminhão basculante', 'Caminhão espargidor', 'Caminhão pipa', 'Fresadora', 'Recicladora', 'Minicarregadeira', 'Veículo leve'] }, { k: 'marca_modelo', l: 'Marca / modelo' }, { k: 'placa', l: 'Placa' },
        { k: 'propriedade', l: 'Propriedade', t: 'sel', o: L.propriedade, req: true, def: 'proprio' }, { k: 'locador', l: 'Locador' }, { k: 'horimetro_atual', l: 'Horímetro atual', t: 'num', d: 1 }, { k: 'proxima_manutencao_horimetro', l: 'Próx. manutenção (horímetro)', t: 'num', d: 1 },
        { k: 'status', l: 'Situação', t: 'sel', o: L.status_eq, badge: true, req: true, def: 'operando' }, { k: 'observacao', l: 'Observação', t: 'area', w: 'wf', formOnly: true }] }) },
    { t: 'Manutenções', f: c => crud(c, { table: 'manutencoes', title: 'Manutenções de equipamentos', doc: 'MANUTENCOES', order: 'data', asc: false, write: 'equip',
      cols: [{ k: 'data', l: 'Data', t: 'date', req: true, def: hoje() }, { k: 'equipamento_id', l: 'Equipamento', t: 'ref', ref: 'equip', req: true, w: 'w2' }, { k: 'tipo', l: 'Tipo', t: 'sel', o: L.manut, req: true }, { k: 'horimetro', l: 'Horímetro', t: 'num', d: 1 }, { k: 'dias_parado', l: 'Dias parado', t: 'num', d: 1, sum: true }, { k: 'descricao', l: 'Serviço executado', t: 'area', w: 'wf' }] }) },
    { t: 'Abastecimento diário', f: c => abastecimentoDia(c) },
    { t: 'Histórico de abastecimentos', f: c => crud(c, { table: 'abastecimentos', title: 'Histórico de abastecimentos', doc: 'ABASTECIMENTOS', order: 'data', asc: false, write: 'campo', noNew: true, paisagem: true,
      intro: 'Para lançar, use a aba Abastecimento diário.',
      cols: [{ k: 'data', l: 'Data', t: 'date', req: true }, { k: 'hora', l: 'Hora', t: 'time' }, { k: 'equipamento_id', l: 'Equipamento', t: 'ref', ref: 'equip', req: true }, { k: 'horimetro', l: 'Horímetro', t: 'num', d: 1 }, { k: 'combustivel', l: 'Combustível', t: 'sel', o: L_COMB, req: true }, { k: 'litros', l: 'Litros', t: 'num', d: 1, req: true, sum: true }, ...(pode('custos') ? [{ k: 'valor', l: 'Valor (R$)', t: 'money', sum: true, listOnly: true }] : []), { k: 'origem', l: 'Origem' }, { k: 'documento', l: 'Cupom / requisição' }, { k: 'responsavel', l: 'Responsável' }] }) },
    { t: 'Indicadores de horas', f: c => indicadoresEquip(c) }
  ];
  if (pode('custos')) ab.splice(1, 0, { t: 'Custo horário', f: c => crud(c, { table: 'equipamentos_custo', pk: 'equipamento_id', title: 'Custo horário dos equipamentos', doc: 'CUSTO_EQUIP', order: 'equipamento_id', write: 'custos',
    cols: [{ k: 'equipamento_id', l: 'Equipamento', t: 'ref', ref: 'equip', req: true, w: 'w2' }, { k: 'custo_hora', l: 'Custo hora (R$)', t: 'money', dica: 'Sem combustível: o diesel entra pelos abastecimentos' }, { k: 'custo_mensal', l: 'Custo mensal (R$)', t: 'money', sum: true }, { k: 'franquia_horas_mes', l: 'Franquia (h/mês)', t: 'num', d: 1 }] }) });
  abas(el, ab);
}
async function horasEquip(ini, fim) {
  const [ap, eqs, custo, ab] = await Promise.all([
    q(sb.from('rdo_equipamentos').select('*, rdo:rdo_id!inner(data)').eq('obra_id', S.obra.id).gte('rdo.data', ini).lte('rdo.data', fim)),
    refEquip(true),
    pode('custos') ? q(sb.from('equipamentos_custo').select('*').eq('obra_id', S.obra.id)) : [],
    q(sb.from('abastecimentos').select('equipamento_id,litros,combustivel').eq('obra_id', S.obra.id).gte('data', ini).lte('data', fim))
  ]);
  const cm = Object.fromEntries(custo.map(c => [c.equipamento_id, c]));
  return eqs.map(e => { const a = ap.filter(x => x.equipamento_id === e.id); const p = soma(a, x => x.horas_produtivas), i = soma(a, x => x.horas_improdutivas), pa = soma(a, x => x.horas_paradas), t = p + i + pa, dAb = ab.filter(x => x.equipamento_id === e.id && /diesel/.test(x.combustivel)), d = dAb.length ? soma(dAb, x => x.litros) : soma(a, x => x.diesel_litros);
    return { e, dias: new Set(a.map(x => x.rdo.data)).size, p, i, pa, t, disp: t ? 100 * (t - pa) / t : null, util: (p + i) ? 100 * p / (p + i) : null, d, lh: p ? d / p : null, custo: cm[e.id] && cm[e.id].custo_hora ? (p + i) * cm[e.id].custo_hora : null }; });
}
async function indicadoresEquip(c) {
  const ini0 = hoje().slice(0, 8) + '01';
  c.innerHTML = `<div class="bar"><label>De <input type="date" id="hi" value="${ini0}"></label><label>Até <input type="date" id="hf" value="${hoje()}"></label><button class="pri" id="hb">Atualizar</button><span class="sp"></span><button id="hx">Excel</button><button id="hp">PDF</button></div><div id="ht"></div><p class="muted">Disponibilidade = (horas totais − paradas) ÷ totais. Utilização = produtivas ÷ (produtivas + improdutivas). Fonte: horas do RDO; diesel da ficha de abastecimento.</p>`;
  let R = [];
  const head = ['Prefixo', 'Equipamento', 'Dias apont.', 'H prod.', 'H improd.', 'H parada', 'Disponib. %', 'Utiliz. %', 'Diesel (l)', 'l/h', ...(pode('custos') ? ['Custo (R$)'] : [])];
  const lin = x => [x.e.prefixo, x.e.descricao, x.dias, x.p, x.i, x.pa, x.disp, x.util, x.d, x.lh, ...(pode('custos') ? [x.custo] : [])];
  const go = async () => { R = await horasEquip($('#hi').value, $('#hf').value); $('#ht').innerHTML = `<div class="tw"><table class="grid"><thead><tr>${head.map((x, i) => `<th class="${i > 1 ? 'n' : ''}">${x}</th>`).join('')}</tr></thead><tbody>${R.map(x => `<tr>${lin(x).map((v, i) => `<td class="${i > 1 ? 'n' : ''}">${i < 2 ? h(v) : i === 2 ? v : i === 10 ? brl(v) : nf(v, 1)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${head.length}" class="vazio">Sem equipamentos cadastrados.</td></tr>`}</tbody></table></div>`; };
  $('#hb').onclick = () => go().catch(erro); await go();
  const sub = () => [`Período: ${dt($('#hi').value)} a ${dt($('#hf').value)}`];
  $('#hx').onclick = () => xlsxExport('HORAS_EQUIP', 'Horas de equipamentos', head, R.map(lin), { sub: sub() });
  $('#hp').onclick = () => tabelaPdf('HORAS_EQUIP', 'Horas de equipamentos', head, R.map(x => lin(x).map((v, i) => i < 2 ? v : i === 2 ? String(v) : i === 10 ? brl(v) : nf(v, 1))), { sub: sub(), paisagem: true });
}

/* ================= MÃO DE OBRA ================= */
async function pgMaoObra(el) {
  abas(el, [
    { t: 'Funcionários', f: c => crud(c, { table: 'funcionarios', title: 'Funcionários da obra', doc: 'FUNCIONARIOS', order: 'nome', write: 'custos',
      intro: 'Trabalhador sem EPI é afastado. Mantenha ASO e entrega de EPI atualizados: a relação de funcionários vai em cada medição.',
      cols: [{ k: 'nome', l: 'Nome', req: true, w: 'w2' }, { k: 'funcao', l: 'Função', req: true, list: FUNCOES }, { k: 'vinculo', l: 'Vínculo', t: 'sel', o: L.vinculo, req: true, def: 'proprio' }, { k: 'empresa', l: 'Empresa (terceiro)' },
        { k: 'admissao', l: 'Admissão', t: 'date' }, { k: 'aso_validade', l: 'Validade ASO', t: 'date' }, { k: 'epi_entregue', l: 'EPI entregue', t: 'bool' }, { k: 'epi_data', l: 'Data entrega EPI', t: 'date', formOnly: true },
        { k: 'sit', l: 'Pendências', listOnly: true, html: true, v: r => [r.aso_validade && r.aso_validade < hoje() ? '<span class="badge b-er">ASO vencido</span>' : '', !r.epi_entregue ? '<span class="badge b-er">Sem EPI</span>' : ''].join(' '), noExp: true },
        { k: 'ativo', l: 'Ativo', t: 'bool', def: true }, { k: 'observacao', l: 'Observação', t: 'area', w: 'wf', formOnly: true }] }) },
    { t: 'Histograma', f: async c => {
      c.innerHTML = '<div class="card"><div style="position:relative;height:280px"><canvas id="cH2"></canvas></div></div><div id="tbF"></div>';
      const [efet, hprev] = await Promise.all([q(sb.from('rdo_efetivo').select('quantidade,funcao,vinculo,rdo:rdo_id(data)').eq('obra_id', S.obra.id)), q(sb.from('histograma_previsto').select('*').eq('obra_id', S.obra.id))]);
      histograma({ efet, hprev }, 'cH2');
      const sem = d => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
      const M = {}; const S2 = new Set(); efet.forEach(e => { if (!e.rdo) return; const s = sem(e.rdo.data); S2.add(s); M[e.funcao] = M[e.funcao] || {}; M[e.funcao][s] = Math.max(M[e.funcao][s] || 0, e.quantidade); });
      const ss = [...S2].sort(); const head = ['Função', ...ss.map(s => 'Sem. ' + dt(s).slice(0, 5))]; const body = Object.keys(M).sort().map(f => [f, ...ss.map(s => M[f][s] ?? 0)]);
      $('#tbF').innerHTML = `<div class="card"><div class="bar"><h3 style="margin:0">Pico de efetivo por função e semana</h3><span class="sp"></span><button id="hfx">Excel</button></div><div class="tw"><table class="grid"><thead><tr>${head.map((x, i) => `<th class="${i ? 'n' : ''}">${x}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map((v, i) => `<td class="${i ? 'n' : ''}">${h(v)}</td>`).join('')}</tr>`).join('') || `<tr><td class="vazio">Sem efetivo lançado.</td></tr>`}</tbody></table></div></div>`;
      $('#hfx').onclick = () => xlsxExport('HISTOGRAMA', 'Histograma de efetivo por função', head, body, { fmt: head.map(() => '0') });
    } }
  ]);
}

/* ================= CUSTOS ================= */
async function pgCustos(el) {
  abas(el, [
    { t: 'Lançamentos', f: c => crud(c, { table: 'custos', title: 'Custos da obra', doc: 'CUSTOS', order: 'data', asc: false, write: 'custos', paisagem: true, anexo: { bucket: 'comprovantes' },
      cols: [{ k: 'data', l: 'Data', t: 'date', req: true, def: hoje() }, { k: 'categoria', l: 'Categoria', t: 'sel', o: CAT_LANC, req: true }, { k: 'orcamento_item_id', l: 'Item do orçamento', t: 'ref', ref: 'item', w: 'w2' }, { k: 'descricao', l: 'Descrição', req: true, w: 'w2' },
        { k: 'fornecedor', l: 'Fornecedor' }, { k: 'documento', l: 'NF / recibo' }, { k: 'quantidade', l: 'Qtd', t: 'num' }, { k: 'unidade', l: 'Un' }, { k: 'valor', l: 'Valor (R$)', t: 'money', req: true, sum: true }, { k: 'cmp', l: 'Comprov.', listOnly: true, html: true, noExp: true, v: r => r.anexo_caminho ? '<i class="ti ti-paperclip" title="Comprovante anexado"></i>' : '' }, { k: 'observacao', l: 'Observação', t: 'area', w: 'wf', formOnly: true }] }) },
    { t: 'Alimentação, alojamento e transporte', f: apoioLanc },
    { t: 'Importar comprovantes', f: apoioImportar },
    { t: 'Resumo do apoio', f: apoioResumo },
    { t: 'Custo × executado', f: async c => {
      const [cs, it] = await Promise.all([q(sb.from('vw_custo_real').select('*').eq('obra_id', S.obra.id)), q(sb.from('vw_itens_saldo').select('*').eq('obra_id', S.obra.id).order('ordem'))]);
      const cat = Object.keys(L.categoria).map(k => [L.categoria[k], soma(cs.filter(x => x.categoria === k), x => x.valor)]).filter(x => x[1]);
      const meses = [...new Set(cs.map(x => x.data.slice(0, 7)))].sort();
      const porItem = it.map(i => { const cu = soma(cs.filter(x => x.orcamento_item_id === i.id), x => x.valor); const ex = Math.min(Number(i.qtd_executada) || 0, i.qtd_contratada ?? Infinity) * (Number(i.preco_unitario) || 0); return [i.descricao, i.unidade, Number(i.qtd_executada) || 0, ex, cu, ex - cu, ex ? 100 * (ex - cu) / ex : null]; }).filter(x => x[3] || x[4]);
      const semItem = soma(cs.filter(x => !x.orcamento_item_id), x => x.valor);
      const auto = o2 => soma(cs.filter(x => x.origem === o2), x => x.valor);
      const hI = ['Item', 'Un', 'Qtd executada', 'Valor executado (R$)', 'Custo (R$)', 'Resultado (R$)', 'Margem %'];
      c.innerHTML = `<p class="muted">Custo real = lançamentos + máquinas (horas do RDO × custo horário, sem combustível) ${brl(auto('rdo'))} + diesel dos abastecimentos ${brl(auto('abastecimento'))}. Não lance de novo notas de diesel nem horas de máquina em Lançamentos.</p><div class="g2"><div class="card"><h3 style="margin-top:0">Por categoria</h3><table class="grid">${cat.map(x => `<tr><td>${x[0]}</td><td class="n">${brl(x[1])}</td></tr>`).join('')}<tfoot><tr><td>Total</td><td class="n">${brl(soma(cs, x => x.valor))}</td></tr></tfoot></table></div>
      <div class="card"><h3 style="margin-top:0">Por mês</h3><table class="grid">${meses.map(m => `<tr><td>${m.slice(5)}/${m.slice(0, 4)}</td><td class="n">${brl(soma(cs.filter(x => x.data.startsWith(m)), x => x.valor))}</td></tr>`).join('') || '<tr><td class="vazio">Sem custos.</td></tr>'}</table></div></div>
      <div class="card"><div class="bar"><h3 style="margin:0">Custo × valor executado por item</h3><span class="sp"></span><button id="cx">Excel</button></div><div class="tw"><table class="grid"><thead><tr>${hI.map((x, i) => `<th class="${i > 1 ? 'n' : ''}">${x}</th>`).join('')}</tr></thead><tbody>${porItem.map(r => `<tr><td>${h(r[0])}</td><td>${h(r[1])}</td><td class="n">${nf(r[2])}</td><td class="n">${brl(r[3])}</td><td class="n">${brl(r[4])}</td><td class="n">${brl(r[5])}</td><td class="n">${pct(r[6])}</td></tr>`).join('') || `<tr><td colspan="7" class="vazio">Vincule os custos aos itens do orçamento para ver o resultado por item.</td></tr>`}</tbody></table></div><p class="muted">Custos sem item vinculado (indiretos): ${brl(semItem)}.</p></div>`;
      $('#cx').onclick = () => xlsxExport('CUSTO_X_EXEC', 'Custo x valor executado', hI, porItem, { fmt: [null, null, '#,##0.00', '"R$" #,##0.00', '"R$" #,##0.00', '"R$" #,##0.00', '0.0'] });
    } }
  ]);
}

/* ================= SUPRIMENTOS ================= */
async function pgSupr(el) {
  abas(el, [
    { t: 'Estoque', f: c => crud(c, { view: 'vw_estoque', table: 'materiais', title: 'Estoque no canteiro', doc: 'ESTOQUE', order: 'nome', write: 'supr', novo: 'Novo material',
      cols: [{ k: 'nome', l: 'Material', req: true, w: 'w2', list: ['CAP 50/70', 'Emulsão RR-1C', 'CM-30 (imprimação)', 'Brita 19 mm', 'Brita 12,5 mm', 'Pó de pedra', 'Areia', 'Cimento', 'Meio-fio MFC-03', 'Diesel', 'Tinta de sinalização', 'Tachas'] }, { k: 'unidade', l: 'Un', req: true },
        { k: 'estoque_minimo', l: 'Estoque mínimo', t: 'num' }, { k: 'saldo', l: 'Saldo', t: 'num', listOnly: true }, { k: 'em_pedido', l: 'Em pedido', t: 'num', listOnly: true },
        { k: 'sit', l: 'Situação', listOnly: true, html: true, noExp: true, v: r => num(r.estoque_minimo) !== null && Number(r.saldo) < Number(r.estoque_minimo) ? '<span class="badge b-er">Abaixo do mínimo</span>' : '<span class="badge b-ok">OK</span>' }] }) },
    { t: 'Pedidos, entradas e saídas', f: c => crud(c, { table: 'suprimentos_movimentos', title: 'Movimentação de materiais', doc: 'SUPRIMENTOS', order: 'data', asc: false, write: 'supr', paisagem: true,
      intro: 'Pedido em aberto não entra no saldo. Na chegada, lance a entrada e marque o pedido como concluído.',
      cols: [{ k: 'data', l: 'Data', t: 'date', req: true, def: hoje() }, { k: 'material_id', l: 'Material', t: 'ref', ref: 'mat', req: true }, { k: 'tipo', l: 'Tipo', t: 'sel', o: L.mov, req: true }, { k: 'quantidade', l: 'Quantidade', t: 'num', req: true },
        { k: 'fornecedor', l: 'Fornecedor' }, { k: 'nota_fiscal', l: 'Nota fiscal' }, { k: 'valor', l: 'Valor (R$)', t: 'money', sum: true }, { k: 'previsao_entrega', l: 'Previsão de entrega', t: 'date' },
        { k: 'status', l: 'Situação', t: 'sel', o: L.status_mov, badge: true, req: true, def: 'concluido' }, { k: 'observacao', l: 'Observação', t: 'area', w: 'wf', formOnly: true }] }) }
  ]);
}
