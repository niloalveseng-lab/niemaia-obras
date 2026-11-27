'use strict';
/* ================= IMPORTAÇÃO DE RDO (gerado no Claude) ================= */
const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
function normClima(v) { const s = semAcento(v); if (!s) return null; if (/forte|intensa|torrencial/.test(s)) return 'chuva_forte'; if (/chuv|garoa|leve|fraca/.test(s)) return 'chuva_fraca'; if (/nubl|encob/.test(s)) return 'nublado'; if (/bom|sol|limpo|ensol/.test(s)) return 'bom'; return null; }
function normCond(v) { const s = semAcento(v); if (!s) return 'praticavel'; if (/impra|inopera|paralis|nao trab/.test(s)) return 'impraticavel'; if (/parc/.test(s)) return 'parcial'; return 'praticavel'; }
function normLado(v) { const s = semAcento(v).toUpperCase().replace(/[^A-Z]/g, ''); if (!s) return null; if (s === 'LE' || s === 'E' || s.startsWith('ESQ')) return 'LE'; if (s === 'LD' || s === 'D' || s.startsWith('DIR')) return 'LD'; if (s.startsWith('EIX')) return 'EIXO'; if (s.startsWith('AMB') || s === 'LELD') return 'AMBOS'; return null; }
function normData(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10); }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim(); let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}
const nOuNulo = v => { if (v == null || v === '') return null; if (typeof v === 'number') return v; const x = Number(String(v).replace(/\./g, '').replace(',', '.')); return isNaN(x) ? null : x; };
const hora = v => { if (v == null || v === '') return null; if (typeof v === 'number') { const m = Math.round(v * 1440); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; } const m = String(v).match(/(\d{1,2})[:h](\d{2})?/); return m ? `${m[1].padStart(2, '0')}:${m[2] || '00'}` : null; };
function acharItem(ref, itens) {
  if (!ref) return null; const r = semAcento(ref);
  return itens.find(i => semAcento(i.codigo) === r) || itens.find(i => semAcento(i.item) === r) || itens.find(i => semAcento(i.descricao) === r)
    || itens.find(i => r.length > 5 && semAcento(i.descricao).includes(r)) || itens.find(i => i.codigo && r.startsWith(semAcento(i.codigo))) || null;
}
/* RDO em Word (modelo NIEMAIA) → mesma estrutura do JSON */
async function lerDocxRdo(file) {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = new DOMParser().parseFromString(await zip.file('word/document.xml').async('string'), 'application/xml');
  const relXml = zip.file('word/_rels/document.xml.rels') ? new DOMParser().parseFromString(await zip.file('word/_rels/document.xml.rels').async('string'), 'application/xml') : null;
  const rel = {}; if (relXml) [...relXml.getElementsByTagName('Relationship')].forEach(r => rel[r.getAttribute('Id')] = r.getAttribute('Target'));
  const ehTopo = el => { let x = el.parentNode; while (x) { if (x.localName === 'tbl') return false; x = x.parentNode; } return true; };
  const txtP = pp => [...pp.getElementsByTagNameNS(W, '*')].map(n => n.localName === 't' ? n.textContent : (n.localName === 'tab' ? ' ' : (n.localName === 'br' ? ' | ' : ''))).join('');
  const txtC = tc => [...tc.getElementsByTagNameNS(W, 'p')].map(txtP).map(s => s.trim()).filter(Boolean).join(' | ');
  const tabelas = [...xml.getElementsByTagNameNS(W, 'tbl')].filter(ehTopo).map(t => [...t.childNodes].filter(n => n.localName === 'tr').map(tr => [...tr.childNodes].filter(n => n.localName === 'tc').map(tc => ({ t: txtC(tc), img: [...tc.getElementsByTagName('*')].filter(n => n.localName === 'blip').map(b => b.getAttributeNS(R, 'embed')).filter(Boolean) }))));
  const sec = re => tabelas.find(t => t.length && re.test(semAcento(t[0].map(c => c.t).join(' '))));
  const vazio = s => !s || /a preencher|^[—–-]+$/.test(semAcento(s));
  const val = s => vazio(s) ? null : String(s).trim();
  const num = s => { if (vazio(s)) return null; let x = String(s).replace(/[^\d,.\-]/g, ''); if (!/\d/.test(x)) return null; x = x.includes(',') ? x.replace(/\./g, '').replace(',', '.') : (/^\-?\d{1,3}(\.\d{3})+$/.test(x) ? x.replace(/\./g, '') : x); const n = Number(x); return isNaN(n) ? null : n; };
  /* mapeia colunas pelo cabeçalho (linha 2 da tabela); regras em ordem, primeira que casar */
  const mapa = (cab, regras, padrao) => { const m = {}; const hs = (cab || []).map(c => semAcento(c.t)); hs.forEach((hh, i) => { for (const [k, re] of regras) { if (m[k] == null && re.test(hh)) { m[k] = i; break; } } }); return Object.keys(m).length >= 2 ? m : padrao; };
  const cel = (l, m, k) => m[k] != null && l[m[k]] ? l[m[k]].t : null;
  const todo = tabelas.flat(2).map(c => c.t).join(' | ');
  const r = { servicos: [], efetivo: [], equipamentos: [], _fotos: [], _doc: file, _av: [] };
  const md = todo.match(/Data:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i); r.data = md ? normData(md[1]) : normData((file.name.match(/\d{4}-\d{2}-\d{2}/) || [])[0]);
  const mn = todo.match(/RDO\s*N[ºo°.]*\s*:?\s*(\d+)/i); r.numero = mn ? mn[1] : null;
  const mh = todo.match(/Hor[aá]rio[^:]*:?\s*(\d{1,2}[:h]\d{2})\s*(?:às|as|a|-|–)\s*(\d{1,2}[:h]\d{2})/i); if (mh) { r.horario_inicio = mh[1].replace('h', ':'); r.horario_fim = mh[2].replace('h', ':'); }
  const cab = semAcento((tabelas[0] || []).flat().map(c => c.t).join(' ') + ' ' + file.name);
  r.obra = /polo/.test(cab) ? 'POLO' : /alca/.test(cab) ? 'ALCA' : /ruas|pavimentacao/.test(cab) ? 'RUAS' : null;
  /* 1. clima */
  const cl = sec(/clima|condic/);
  if (cl) { const cond = []; const obs = []; cl.forEach(l => { const p0 = semAcento(l[0] && l[0].t); const per = /^manh/.test(p0) ? 'manha' : /^tarde/.test(p0) ? 'tarde' : null; if (!per) return; r['clima_' + per] = l[1] && l[1].t; cond.push(normCond(l[2] && l[2].t)); if (l[3] && val(l[3].t)) obs.push(`${per === 'manha' ? 'Manhã' : 'Tarde'}: ${l[3].t}`); });
    r.condicao = cond.length && cond.every(c => c === 'impraticavel') ? 'impraticavel' : cond.some(c => c !== 'praticavel') ? 'parcial' : 'praticavel'; r._climaObs = obs; }
  /* 2. efetivo */
  const ef = sec(/efetivo|mao de obra/);
  if (ef) { const m = mapa(ef[1], [['funcao', /funcao|cargo/], ['qtd', /^qt|quant/], ['vinculo', /vinculo|empresa/], ['horas', /hora/], ['obs', /obs/]], { funcao: 0, qtd: 1, vinculo: 2 });
    ef.slice(2).forEach(l => { const f = val(cel(l, m, 'funcao')); if (!f || /^total/.test(semAcento(f))) return; const qd = num(cel(l, m, 'qtd')); if (qd == null) { r._av.push(`Efetivo "${f}" sem quantidade`); return; } r.efetivo.push({ funcao: f, quantidade: qd, vinculo: cel(l, m, 'vinculo') || 'proprio', horas: num(cel(l, m, 'horas')), observacao: val(cel(l, m, 'obs')) }); }); }
  /* 3. equipamentos */
  const eq = sec(/equipamento/);
  if (eq) { const m = mapa(eq[1], [['diesel', /diesel|combust|litro/], ['hi', /horim.*ini|hor.*inicial/], ['hf', /horim.*fin|hor.*final/], ['himp', /improdut/], ['hprod', /produt|trabalhad/], ['hpar', /^h.*parad|horas parad/], ['motivo', /motivo|situac|ocorr|obs/], ['prefixo', /prefixo|frota|placa/], ['qtd', /^qt|quant/], ['nome', /equipamento|descri/]], { nome: 0, qtd: 1, prefixo: 2, motivo: 3 });
    eq.slice(2).forEach(l => { const n = val(cel(l, m, 'nome')), pf = val(cel(l, m, 'prefixo')); if (!n && !pf) return; if (n && /^total/.test(semAcento(n))) return;
      r.equipamentos.push({ _nome: n || pf, _qtd: num(cel(l, m, 'qtd')) || 1, prefixo: pf, horimetro_ini: num(cel(l, m, 'hi')), horimetro_fim: num(cel(l, m, 'hf')), horas_produtivas: num(cel(l, m, 'hprod')), horas_improdutivas: num(cel(l, m, 'himp')), horas_paradas: num(cel(l, m, 'hpar')), motivo_parada: val(cel(l, m, 'motivo')), diesel_litros: num(cel(l, m, 'diesel')) }); }); }
  /* 4. serviços */
  const sv = sec(/servico/);
  if (sv) { const m = mapa(sv[1], [['item', /^item|codigo|cod\b/], ['ei', /est.*ini|^de$|estaca ini/], ['ef', /est.*fin|^ate$|estaca fin/], ['lado', /^lado/], ['comp', /^comp/], ['larg', /^larg/], ['esp', /^esp/], ['qtd', /^quant|^qtd/], ['un', /^un/], ['retr', /retrab/], ['servico', /servico/], ['local', /local|rua|trecho/], ['obs', /descri|obs/]], { servico: 0, local: 1, obs: 2, qtd: 3, un: 4 });
    sv.slice(2).forEach(l => { const s = val(cel(l, m, 'servico')); if (!s || /^total/.test(semAcento(s))) return; const loc = cel(l, m, 'local') || '';
      let ei = val(cel(l, m, 'ei')), efn = val(cel(l, m, 'ef')), lado = val(cel(l, m, 'lado'));
      if (!ei) { const me = loc.match(/(\d+)\s*\+\s*([\d.,]+)?\s*(?:a|à|até|ate|–|-)\s*(\d+)\s*\+\s*([\d.,]+)?/i); if (me) { ei = `${me[1]}+${me[2] || 0}`; efn = `${me[3]}+${me[4] || 0}`; } }
      if (!lado) { const ml = loc.match(/\b(LE|LD)\b|lado\s+(esquerdo|direito)|\beixo\b|ambos/i); lado = ml ? ml[0] : null; }
      r.servicos.push({ item: val(cel(l, m, 'item')), servico: s, local: m.ei != null ? (val(loc) || null) : (loc.replace(/\s*[–-]?\s*est\.?.*$/i, '').trim() || val(loc) || null), estaca_ini: ei, estaca_fim: efn, lado, comprimento: num(cel(l, m, 'comp')), largura: num(cel(l, m, 'larg')), espessura: num(cel(l, m, 'esp')), quantidade: num(cel(l, m, 'qtd')), unidade: val(cel(l, m, 'un')), retrabalho: /^s/.test(semAcento(cel(l, m, 'retr') || '')) || /retrabalho/i.test(cel(l, m, 'obs') || ''), observacao: val(cel(l, m, 'obs')) }); }); }
  /* 5. ocorrências / observações */
  const so = x => /^\[?a preencher\]?$|^[—–-]+$/.test(semAcento(x).trim()); const lista = t => t ? t.slice(1).flat().map(c => c.t).filter(x => x && !so(x)).join('\n').replace(/ \| /g, '\n') : null;
  const oc = sec(/ocorrenc/); r.ocorrencias = [lista(oc), ...(r._climaObs || []).map(x => 'Clima – ' + x)].filter(Boolean).join('\n') || null;
  r.observacoes_fiscal = lista(sec(/fiscaliza/)) || null;
  const at = sec(/atividade|resumo/); 
  r.atividades = lista(at) || r.servicos.map(s => `${s.servico}${s.local ? ' – ' + s.local : ''}${s.estaca_ini ? ' – est. ' + s.estaca_ini + ' a ' + (s.estaca_fim || '') : ''}${s.lado ? ' ' + s.lado : ''}${s.quantidade != null ? ': ' + nf(s.quantidade, s.quantidade % 1 ? 2 : 0) + ' ' + (s.unidade || '') : ''}${s.observacao ? ' (' + s.observacao + ')' : ''}`).join('\n') || null;
  /* 6. fotos: legenda "[Obra] – [Serviço] – [Rua/Est.] – L[E/D]" + data/hora + coordenadas */
  const ft = sec(/fotograf|foto/);
  if (ft) for (const l of ft.slice(1)) for (const c of l) for (const id of c.img) { const alvo = rel[id]; if (!alvo) continue; const z = zip.file('word/' + alvo.replace(/^\//, '').replace(/^word\//, '')); if (!z) continue;
    const mdh = c.t.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*(?:às\s*)?(\d{1,2}:\d{2})?/); let dh = null; if (mdh) { const d = normData(mdh[1]); dh = new Date(`${d}T${mdh[2] || '12:00'}:00-03:00`).toISOString(); }
    const mc = c.t.match(/(-?\d{1,2}[.,]\d{3,})\s*[,;/ ]\s*(-?\d{1,3}[.,]\d{3,})/);
    const leg = c.t.split(' | ').find(x => /\s[–-]\s/.test(x) && !/^\d{1,2}\//.test(x)) || c.t;
    const pt = leg.split(/\s+[–-]\s+/).map(s => s.trim()).filter(s => !/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s));
    const ld = pt.length > 1 && /^(LE|LD|EIXO|AMBOS)$/i.test(pt[pt.length - 1]) ? pt.pop().toUpperCase() : null;
    r._fotos.push({ blob: await z.async('blob'), nome: alvo.split('/').pop(), legenda: leg || null, data_hora: dh, servico: pt[1] || null, local: pt.slice(2).join(' – ') || null, lado: ld, latitude: mc ? Number(mc[1].replace(',', '.')) : null, longitude: mc ? Number(mc[2].replace(',', '.')) : null }); }
  return r;
}
/* Excel modelo → mesma estrutura do JSON */
function xlsxParaJson(wb) {
  const aba = n => { const k = wb.SheetNames.find(x => semAcento(x).startsWith(n)); return k ? XLSX.utils.sheet_to_json(wb.Sheets[k], { defval: null }) : []; };
  const low = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [semAcento(k).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), v]));
  const rdos = {}; const pega = d => (rdos[d] = rdos[d] || { data: d, servicos: [], efetivo: [], equipamentos: [] });
  aba('rdo').map(low).forEach(r => { const d = normData(r.data); if (d) Object.assign(pega(d), r, { data: d }); });
  aba('serv').map(low).forEach(r => { const d = normData(r.data); if (d) pega(d).servicos.push(r); });
  aba('efet').map(low).forEach(r => { const d = normData(r.data); if (d) pega(d).efetivo.push(r); });
  aba('equip').map(low).forEach(r => { const d = normData(r.data); if (d) pega(d).equipamentos.push(r); });
  const o = aba('rdo').map(low)[0] || {};
  return { obra: o.obra || null, rdos: Object.values(rdos) };
}
function modeloXlsx() {
  const wb = XLSX.utils.book_new();
  const ap = (n, aoa) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), n);
  ap('RDO', [['obra', 'data', 'clima_manha', 'clima_tarde', 'condicao', 'horario_inicio', 'horario_fim', 'atividades', 'ocorrencias', 'observacoes_fiscal'], [S.obra.codigo, '23/11/2026', 'bom', 'nublado', 'praticavel', '07:00', '17:00', 'Resumo das atividades do dia', 'Ocorrências do dia', '']]);
  ap('SERVICOS', [['data', 'item', 'servico', 'local', 'estaca_ini', 'estaca_fim', 'lado', 'comprimento', 'largura', 'espessura', 'quantidade', 'unidade', 'observacao'], ['23/11/2026', '04.910.03', 'Meio-fio MFC-03', 'Rua exemplo', '5+10', '12+0', 'LE', 130, '', '', 130, 'm', '']]);
  ap('EFETIVO', [['data', 'funcao', 'vinculo', 'quantidade', 'horas'], ['23/11/2026', 'Servente', 'proprio', 8, 8]]);
  ap('EQUIPAMENTOS', [['data', 'prefixo', 'horimetro_ini', 'horimetro_fim', 'horas_produtivas', 'horas_improdutivas', 'horas_paradas', 'motivo_parada', 'diesel_litros'], ['23/11/2026', 'RP-01', 1200, 1208, 8, 0, 0, '', '']]);
  XLSX.writeFile(wb, `${S.obra.codigo}_MODELO_IMPORTACAO_RDO.xlsx`);
}
async function importarRdo(c) {
  if (!pode('campo')) { c.innerHTML = '<div class="vazio">Seu perfil não importa RDO.</div>'; return; }
  c.innerHTML = `<div class="g2"><div class="card"><h3>1. Arquivo de importação</h3><p class="muted">Escolha os <b>RDOs em Word (.docx)</b> no modelo NIEMAIA, um ou vários dias de uma vez. O sistema lê clima, efetivo, equipamentos, serviços, ocorrências e fotos, e anexa o próprio documento ao dia. Também aceita o .json ou o modelo Excel. Também dá para colar o texto do JSON abaixo.</p>
  <input type="file" id="iArq" accept=".docx,.json,.xlsx,.xls,.txt" multiple><textarea id="iTxt" placeholder='{"obra":"${S.obra.codigo}","rdos":[{"data":"2026-11-23", ...}]}' style="margin-top:10px;min-height:110px;font-family:monospace;font-size:12px"></textarea>
  <div class="bar" style="margin-top:10px"><button id="iMod"><i class="ti ti-file-spreadsheet"></i>Baixar modelo Excel</button></div></div>
  <div class="card"><h3>2. Documentos do RDO (opcional)</h3><p class="muted">PDF ou Word gerados no Claude. O sistema anexa ao RDO do dia pela data no nome do arquivo (ex.: <code>RUAS_RDO_2026-11-23.pdf</code> ou <code>RDO 23-11-2026.docx</code>).</p><input type="file" id="iDocs" accept=".pdf,.docx,.doc" multiple>
  <h3>3. Opções</h3><div class="form"><div><label for="iSt">Situação ao importar</label><select id="iSt"><option value="rascunho">Rascunho</option><option value="enviado" selected>Enviar para aprovação</option></select></div><div><label for="iEx">Se já existir RDO no dia</label><select id="iEx"><option value="pular">Não mexer (pular)</option><option value="substituir">Substituir (se não aprovado)</option></select></div>
  <div class="wf"><div class="chk"><input type="checkbox" id="iFot" checked><span>Importar as fotos do documento Word para o RDO (com a legenda e a data/hora do documento)</span></div></div>
  <div class="wf"><div class="chk"><input type="checkbox" id="iMem" checked><span>Lançar os serviços com item do orçamento na memória de cálculo (produção mensal)</span></div></div></div></div></div>
  <div class="bar"><span class="sp"></span><button class="pri" id="iAn"><i class="ti ti-search"></i>Analisar</button></div><div id="iPrev"></div>`;
  $('#iMod').onclick = modeloXlsx;
  let pacote = null, plano = [];
  $('#iArq').onchange = async e => { const fs = [...e.target.files]; const f = fs[0]; if (!f) return; try {
    if (fs.some(x => /\.docx$/i.test(x.name))) { const lidos = []; for (const x of fs.filter(x => /\.docx$/i.test(x.name))) { try { lidos.push(await lerDocxRdo(x)); } catch (y) { toast(`${x.name}: não foi possível ler (${y.message})`, 'erro'); } } const obras = [...new Set(lidos.map(x => x.obra).filter(Boolean))]; if (obras.length > 1) throw new Error('Os documentos são de obras diferentes: ' + obras.join(', ') + '. Importe uma obra por vez.'); pacote = { obra: obras[0] || null, rdos: lidos }; $('#iTxt').value = `${lidos.length} RDO(s) em Word carregado(s): ${lidos.map(x => (x.numero ? 'nº ' + x.numero + ' – ' : '') + dt(x.data)).join(', ')}.`; toast('Documentos lidos. Clique em Analisar.'); return; } if (/\.xlsx?$/i.test(f.name)) { pacote = xlsxParaJson(XLSX.read(await f.arrayBuffer(), { cellDates: false })); $('#iTxt').value = `Planilha ${f.name} carregada: ${pacote.rdos.length} dia(s) de RDO.`; } else { $('#iTxt').value = await f.text(); pacote = null; } toast(`Arquivo ${f.name} carregado. Clique em Analisar.`); } catch (x) { erro(x); } };
  $('#iAn').onclick = async () => { try {
    if (!pacote || $('#iTxt').value.trim().startsWith('{') || $('#iTxt').value.trim().startsWith('[')) { const t = $('#iTxt').value.trim(); if (!t) throw new Error('Escolha o arquivo ou cole o JSON.'); let j; try { j = JSON.parse(t.replace(/^```(json)?|```$/g, '')); } catch (x) { if (!pacote) throw new Error('JSON inválido: ' + x.message); j = pacote; } pacote = Array.isArray(j) ? { rdos: j } : (j.rdos ? j : { obra: j.obra, rdos: [j] }); }
    if (pacote.obra && semAcento(pacote.obra).replace(/[^a-z]/g, '') !== semAcento(S.obra.codigo).replace(/[^a-z]/g, '')) throw new Error(`O arquivo é da obra ${pacote.obra}, mas a obra selecionada é ${S.obra.codigo}. Troque a obra no topo.`);
    const [itens, eqs, exist] = await Promise.all([refItens(true), refEquip(true), q(sb.from('rdo').select('id,data,status').eq('obra_id', S.obra.id))]);
    const exMap = Object.fromEntries(exist.map(r => [r.data, r])); const eqMap = Object.fromEntries(eqs.map(e => [semAcento(e.prefixo), e]));
    const docs = [...$('#iDocs').files];
    plano = pacote.rdos.map(r => {
      const data = normData(r.data); const av = []; const ex = data && exMap[data];
      if (!data) av.push('Data inválida');
      av.push(...(r._av || []));
      const servicos = (r.servicos || []).map(s => { let it = acharItem(s.item || s.codigo || s.item_orcamento, itens); if ((s.item || s.codigo) && !it) av.push(`Item "${s.item || s.codigo}" não encontrado no orçamento (serviço entra sem item)`);
        if (!it && !s.item && !s.codigo && s.servico) { const sv = semAcento(s.servico); it = itens.find(i => { const d = semAcento(i.descricao); return d.length > 6 && (sv.includes(d) || d.includes(sv)); }) || null; }
        const un = x => semAcento(x).replace(/[^a-z0-9]/g, '').replace(/[23]$/, '');
        const uOk = !it || !s.unidade || un(s.unidade) === un(it.unidade);
        if (it && !uOk) av.push(`"${s.servico}" em ${s.unidade}: unidade diferente do item ${it.codigo || ''} (${it.unidade}) – não vai para a memória`);
        if (!it && r._doc) av.push(`"${s.servico}" sem item do orçamento – entra só no RDO`);
        const ul = s.unidade || (it && it.unidade) || null; return { orcamento_item_id: it ? it.id : null, servico: s.servico || (it && it.descricao) || 'Serviço', local: s.local || s.rua || null, estaca_ini: s.estaca_ini != null ? String(s.estaca_ini) : null, estaca_fim: s.estaca_fim != null ? String(s.estaca_fim) : null, lado: normLado(s.lado), comprimento: nOuNulo(s.comprimento), largura: nOuNulo(s.largura), quantidade: nOuNulo(s.quantidade), unidade: ul, retrabalho: !!s.retrabalho, observacao: s.observacao || null, _esp: nOuNulo(s.espessura), _semMem: !uOk }; });
      const efetivo = (r.efetivo || []).filter(x => x.funcao && nOuNulo(x.quantidade) != null).map(x => ({ funcao: String(x.funcao).trim(), vinculo: semAcento(x.vinculo).startsWith('terc') ? 'terceiro' : 'proprio', quantidade: Math.round(nOuNulo(x.quantidade)), horas: nOuNulo(x.horas) ?? 8, observacao: x.observacao || null }));
      const equips = []; const usados = new Set();
      (r.equipamentos || []).forEach(x => { if (!x.prefixo && x._nome) { const pal = semAcento(x._nome).replace(/\(.*?\)/g, '').split(/[^a-z0-9]+/).filter(w => w.length > 2 && !['com', 'de', 'para', 'terceirizado', 'proprio'].includes(w)); const pont = e => { const d = semAcento(e.descricao + ' ' + (e.tipo || '')); return pal.filter(w => d.includes(w)).length / Math.max(pal.length, 1); }; const cand = eqs.filter(e => !usados.has(e.id) && pont(e) >= 0.5).sort((a, b) => pont(b) - pont(a)).slice(0, x._qtd || 1); if (!cand.length) { av.push(`Equipamento "${x._nome}" sem prefixo e sem cadastro equivalente (ignorado)`); return; } if (cand.length < (x._qtd || 1)) av.push(`"${x._nome}": ${x._qtd} no RDO, ${cand.length} cadastrado(s)`); const um = cand.length === 1; cand.forEach(e => { usados.add(e.id); equips.push({ equipamento_id: e.id, horimetro_ini: um ? nOuNulo(x.horimetro_ini) : null, horimetro_fim: um ? nOuNulo(x.horimetro_fim) : null, horas_produtivas: nOuNulo(x.horas_produtivas), horas_improdutivas: nOuNulo(x.horas_improdutivas), horas_paradas: nOuNulo(x.horas_paradas), motivo_parada: x.motivo_parada || null, diesel_litros: um ? nOuNulo(x.diesel_litros) : null }); }); return; }
        const e = eqMap[semAcento(x.prefixo)]; if (!e) { av.push(`Prefixo "${x.prefixo}" não cadastrado (linha ignorada)`); return; } usados.add(e.id); const hi = nOuNulo(x.horimetro_ini), hf = nOuNulo(x.horimetro_fim); equips.push({ equipamento_id: e.id, horimetro_ini: hi, horimetro_fim: hf, horas_produtivas: nOuNulo(x.horas_produtivas) ?? (hi != null && hf != null ? Math.round((hf - hi) * 10) / 10 : 0), horas_improdutivas: nOuNulo(x.horas_improdutivas) ?? 0, horas_paradas: nOuNulo(x.horas_paradas) ?? 0, motivo_parada: x.motivo_parada || null, diesel_litros: nOuNulo(x.diesel_litros) }); });
      const doc = r._doc || (data ? docs.find(f => { const n = f.name; return n.includes(data) || n.includes(data.split('-').reverse().join('-')) || n.includes(data.split('-').reverse().join('.')) || n.includes(data.split('-').reverse().join('_')); }) : null);
      let acao = 'criar'; if (ex) acao = $('#iEx').value === 'substituir' ? (ex.status === 'aprovado' && !pode('aprovar') ? 'bloqueado' : 'substituir') : 'pular';
      return { data, ex, acao, av, doc, fotos: r._fotos || [], numero: r.numero, rdo: { obra_id: S.obra.id, data, clima_manha: normClima(r.clima_manha || r.clima), clima_tarde: normClima(r.clima_tarde || r.clima), condicao: normCond(r.condicao), horario_inicio: hora(r.horario_inicio) , horario_fim: hora(r.horario_fim), atividades: r.atividades || null, ocorrencias: r.ocorrencias || null, observacoes_fiscal: r.observacoes_fiscal || null, origem: 'importado' }, servicos, efetivo, equips };
    }).sort((a, b) => a.data < b.data ? -1 : 1);
    const AC = { criar: '<span class="badge b-ok">Criar</span>', substituir: '<span class="badge b-av">Substituir</span>', pular: '<span class="badge">Pular (já existe)</span>', bloqueado: '<span class="badge b-er">Aprovado – só o gestor</span>' };
    $('#iPrev').innerHTML = `<div class="card"><h3>Prévia: ${plano.length} RDO(s)</h3><div class="tw"><table class="grid"><thead><tr><th>Data</th><th>Ação</th><th>Clima</th><th>Condição</th><th class="n">Serviços</th><th class="n">Efetivo</th><th class="n">Equip.</th><th class="n">Fotos</th><th>Documento</th><th>Avisos</th></tr></thead><tbody>${plano.map(p => `<tr><td>${dt(p.data) || '–'}</td><td>${AC[p.acao]}</td><td>${h(L.clima[p.rdo.clima_manha] || '–')} / ${h(L.clima[p.rdo.clima_tarde] || '–')}</td><td>${h(L.condicao[p.rdo.condicao])}</td><td class="n">${p.servicos.length}</td><td class="n">${soma(p.efetivo, x => x.quantidade)}</td><td class="n">${p.equips.length}</td><td class="n">${p.fotos.length}</td><td>${p.doc ? h(p.doc.name) : '<span class="muted">–</span>'}</td><td style="font-size:12.5px;color:var(--av)">${p.av.map(h).join('<br>')}</td></tr>`).join('')}</tbody></table></div>
    <div class="bar" style="margin-top:12px"><span class="sp"></span><button class="pri" id="iGo"><i class="ti ti-upload"></i>Importar ${plano.filter(p => ['criar', 'substituir'].includes(p.acao) && p.data).length} RDO(s)</button></div></div>`;
    $('#iGo').onclick = executar;
  } catch (x) { erro(x); } };
  const executar = async () => {
    const bt = $('#iGo'); bt.disabled = true; let ok = 0, mem = 0, nf_ = 0, falhas = [];
    const its = Object.fromEntries((await refItens()).map(i => [i.id, i]));
    for (const p of plano.filter(p => ['criar', 'substituir'].includes(p.acao) && p.data)) {
      try {
        const payload = { obra_codigo: S.obra.codigo, rdo: { ...p.rdo, id: p.ex ? p.ex.id : undefined, status: $('#iSt').value }, servicos: p.servicos.map(({ _esp, _semMem, ...s }) => s), efetivo: p.efetivo, equips: p.equips };
        if (payload.rdo.status === 'enviado' && p.ex && p.ex.status === 'aprovado') payload.rdo.status = 'aprovado';
        const id = await salvarRdoPayload(payload);
        if ($('#iMem').checked) {
          await q(sb.from('memoria_calculo').delete().eq('rdo_id', id));
          const linhas = p.servicos.filter(s => s.orcamento_item_id && s.quantidade && !s._semMem).map(s => { const [ii, fi] = parseEst(s.estaca_ini), [ie, fe] = parseEst(s.estaca_fim); const l = { est_ini_int: ii, est_ini_frac: fi, est_fim_int: ie, est_fim_frac: fe, lado: s.lado, comprimento: s.comprimento, largura: s.largura, espessura: s._esp, quantidade: s.quantidade }; return { obra_id: S.obra.id, data: p.data, rdo_id: id, orcamento_item_id: s.orcamento_item_id, local: s.local, ...l, observacao: s.observacao, formula: calcMemoria(l, its[s.orcamento_item_id]).formula || `${nf(s.quantidade)} ${s.unidade || ''}` }; });
          if (linhas.length) { await q(sb.from('memoria_calculo').insert(linhas)); mem += linhas.length; }
        }
        if (p.doc) { const ext = p.doc.name.split('.').pop().toLowerCase(); const cam = `${S.obra.id}/rdo/${p.data}_${Date.now()}.${ext}`; await q(sb.storage.from('documentos').upload(cam, p.doc, { upsert: true, contentType: p.doc.type || undefined })); await q(sb.from('rdo').update({ anexo_caminho: cam, anexo_nome: p.doc.name }).eq('id', id)); }
        if ($('#iFot').checked && p.fotos.length) {
          const jaTem = await q(sb.from('fotos').select('legenda').eq('rdo_id', id)); const leg = new Set(jaTem.map(f => f.legenda));
          for (const [k, f] of p.fotos.entries()) { if (f.legenda && leg.has(f.legenda)) continue; const u = await new Promise(ok2 => { const rd = new FileReader(); rd.onload = () => ok2(rd.result); rd.readAsDataURL(f.blob); }); const im = await reduzImg(u, 1920); const blob = im ? await (await fetch(im.url)).blob() : f.blob; const cam = `${S.obra.id}/${id}/${Date.now()}_${k}.jpg`;
            await q(sb.storage.from('fotos').upload(cam, blob, { contentType: 'image/jpeg' })); await q(sb.from('fotos').insert({ obra_id: S.obra.id, rdo_id: id, caminho: cam, legenda: f.legenda, servico: f.servico || null, local: f.local || null, lado: f.lado ? normLado(f.lado) : null, latitude: f.latitude, longitude: f.longitude, data_hora: f.data_hora || new Date(p.data + 'T12:00:00-03:00').toISOString() })); nf_++; }
        }
        ok++;
      } catch (x) { falhas.push(`${dt(p.data)}: ${x.message}`); }
    }
    $('#iPrev').insertAdjacentHTML('afterbegin', `<div class="card" style="border-color:${falhas.length ? '#F1C4BE' : '#BFE3CF'}"><h3>${ok} RDO(s) importado(s)${mem ? ` · ${mem} linha(s) na memória de cálculo` : ''}${nf_ ? ` · ${nf_} foto(s)` : ''}</h3>${falhas.length ? `<p style="color:var(--er)">${falhas.map(h).join('<br>')}</p>` : '<p class="muted">Confira em Diários e, se for o caso, aprove.</p>'}</div>`);
    toast(`${ok} RDO(s) importado(s)`, falhas.length ? 'erro' : 'ok');
  };
}
/* anexo no editor do RDO */
async function anexoRdo(id, r, ro) {
  const box = $('#rdoAnexo'); if (!box) return;
  const desenhar = () => { box.innerHTML = `${r.anexo_caminho ? `<button id="axVer"><i class="ti ti-file-text"></i>${h(r.anexo_nome || 'Documento do RDO')}</button>` : '<span class="muted">Sem documento anexado.</span>'} ${ro ? '' : '<label class="lk" style="cursor:pointer;color:var(--az);display:inline"><input type="file" id="axUp" accept=".pdf,.docx,.doc" style="display:none">Anexar / substituir PDF ou Word</label>'}`;
    if ($('#axVer', box)) $('#axVer', box).onclick = async () => { try { const u = await q(sb.storage.from('documentos').createSignedUrl(r.anexo_caminho, 600, { download: r.anexo_nome || true })); const a = document.createElement('a'); a.href = u.signedUrl; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { erro(e); } };
    if ($('#axUp', box)) $('#axUp', box).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const cam = `${S.obra.id}/rdo/${r.data}_${Date.now()}.${f.name.split('.').pop().toLowerCase()}`; await q(sb.storage.from('documentos').upload(cam, f, { upsert: true, contentType: f.type || undefined })); await q(sb.from('rdo').update({ anexo_caminho: cam, anexo_nome: f.name }).eq('id', id)); r.anexo_caminho = cam; r.anexo_nome = f.name; toast('Documento anexado', 'ok'); desenhar(); } catch (x) { erro(x); } };
  };
  desenhar();
}

/* ================= IMPORTAÇÃO DE AVANÇOS (fichas dos apontadores) ================= */
const COLS_AV = ['data', 'item', 'local', 'estaca_ini', 'estaca_fim', 'lado', 'material', 'prefixo', 'viagens', 'cap_viagem', 'comprimento', 'largura', 'espessura', 'quantidade', 'camada', 'dmt_km', 'apontador', 'observacao'];
function modeloAvancos() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    [`FICHA DE APONTAMENTO DE AVANÇOS – ${S.obra.codigo} – ${S.obra.nome}`], ['Uma linha por caminhão/serviço. Item = código do orçamento. Estaca no formato 12+5. Quantidade em branco: o sistema calcula (viagens × capacidade, ou comprimento × largura × espessura).'], [],
    COLS_AV,
    ['23/11/2026', '01.999.06', 'Praça – aterro', '0+0', '5+0', 'EIXO', 'Solo de jazida (11 km)', 'POLO-CB-01', 12, 12, '', '', '', '', '1ª camada', 11, 'Apontador', ''],
    ['23/11/2026', '01.510.00', 'Praça – aterro', '0+0', '5+0', 'EIXO', '', '', '', '', 100, 30, 0.2, '', '1ª camada', '', 'Apontador', 'Compactação']
  ]);
  ws['!cols'] = COLS_AV.map(c => ({ wch: ['local', 'material', 'observacao'].includes(c) ? 26 : 12 }));
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 17 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 17 } }];
  XLSX.utils.book_append_sheet(wb, ws, 'AVANCOS');
  const it = XLSX.utils.aoa_to_sheet([['Código', 'Item', 'Descrição', 'Unidade'], ...(S.ref.itens || []).map(i => [i.codigo || '', i.item || '', i.descricao, i.unidade])]);
  it['!cols'] = [{ wch: 14 }, { wch: 8 }, { wch: 70 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, it, 'ITENS DO ORCAMENTO');
  XLSX.writeFile(wb, `${S.obra.codigo}_FICHA_AVANCOS.xlsx`);
}
function linhasAvancosXlsx(wb) {
  const nome = wb.SheetNames.find(x => semAcento(x).startsWith('avanc')) || wb.SheetNames[0];
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, defval: null });
  const hi = aoa.findIndex(r => r.some(c => semAcento(c) === 'data') && r.some(c => semAcento(c) === 'item'));
  if (hi < 0) throw new Error('Cabeçalho não encontrado (colunas "data" e "item"). Use o modelo da ficha.');
  const H = aoa[hi].map(c => semAcento(c).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  return aoa.slice(hi + 1).filter(r => r.some(c => c !== null && c !== '')).map(r => Object.fromEntries(H.map((k, i) => [k, r[i]])));
}
async function importarAvancos(c) {
  if (!pode('campo')) { c.innerHTML = '<div class="vazio">Seu perfil não importa avanços.</div>'; return; }
  await refItens(true);
  c.innerHTML = `<div class="g2"><div class="card"><h3>1. Ficha de avanços</h3><p class="muted">Planilha dos apontadores (modelo abaixo: uma linha por caminhão ou serviço) ou o arquivo <b>.json</b> que o Claude gera a partir das fichas. Também dá para colar o JSON.</p>
  <input type="file" id="avArq" accept=".xlsx,.xls,.json,.txt"><textarea id="avTxt" placeholder='{"obra":"${S.obra.codigo}","avancos":[{"data":"2026-11-23","item":"01.999.06", ...}]}' style="margin-top:10px;min-height:100px;font-family:monospace;font-size:12px"></textarea>
  <div class="bar" style="margin-top:10px"><button id="avMod"><i class="ti ti-file-spreadsheet"></i>Baixar ficha modelo (Excel)</button></div></div>
  <div class="card"><h3>2. Opções</h3><div class="form"><div class="wf"><div class="chk"><input type="checkbox" id="avDup" checked><span>Pular linhas que já existem na memória (mesma data, item, local, estacas e quantidade)</span></div></div>
  <div class="wf"><div class="chk"><input type="checkbox" id="avAgr"><span>Somar viagens do mesmo dia, item, local e estacas numa linha só (ex.: vários caminhões no mesmo trecho)</span></div></div></div>
  <p class="muted" style="margin-top:12px">Quantidade em branco: o sistema calcula pela unidade do item (m³ = viagens × capacidade, ou comp. × larg. × esp.; m² = comp. × larg.; m = estacas). Em t.km e unidades sem regra, a quantidade precisa vir preenchida. Material, caminhão, DMT e apontador ficam registrados na memória.</p></div></div>
  <div class="bar"><span class="sp"></span><button class="pri" id="avAn"><i class="ti ti-search"></i>Analisar</button></div><div id="avPrev"></div>`;
  $('#avMod').onclick = modeloAvancos;
  let linhas = null, plano = [];
  $('#avArq').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { if (/\.xlsx?$/i.test(f.name)) { linhas = linhasAvancosXlsx(XLSX.read(await f.arrayBuffer())); $('#avTxt').value = `Planilha ${f.name}: ${linhas.length} linha(s).`; } else { $('#avTxt').value = await f.text(); linhas = null; } toast('Arquivo carregado. Clique em Analisar.'); } catch (x) { erro(x); } };
  $('#avAn').onclick = async () => { try {
    const t = $('#avTxt').value.trim();
    if (t.startsWith('{') || t.startsWith('[')) { const j = JSON.parse(t.replace(/^```(json)?|```$/g, '')); if (j.obra && semAcento(j.obra).replace(/[^a-z]/g, '') !== semAcento(S.obra.codigo).replace(/[^a-z]/g, '')) throw new Error(`O arquivo é da obra ${j.obra}, mas a obra selecionada é ${S.obra.codigo}.`); linhas = Array.isArray(j) ? j : (j.avancos || []); }
    if (!linhas || !linhas.length) throw new Error('Escolha a planilha ou cole o JSON.');
    const itens = S.ref.itens; const itMap = Object.fromEntries(itens.map(i => [i.id, i]));
    let L1 = linhas.map((r, k) => {
      const av = []; const data = normData(r.data); if (!data) av.push('data inválida');
      const it = acharItem(r.item || r.codigo, itens); if (!it) av.push(`item "${r.item || r.codigo || ''}" não encontrado`);
      const [ii, fi] = parseEst(r.estaca_ini), [ie, fe] = parseEst(r.estaca_fim);
      const l = { est_ini_int: ii, est_ini_frac: fi, est_fim_int: ie, est_fim_frac: fe, lado: normLado(r.lado), comprimento: nOuNulo(r.comprimento), largura: nOuNulo(r.largura), espessura: nOuNulo(r.espessura), n_viagens: nOuNulo(r.viagens), cap_viagem: nOuNulo(r.cap_viagem), quantidade: nOuNulo(r.quantidade) };
      if (ii !== null && ie !== null && estM(ie, fe) < estM(ii, fi)) av.push('estaca final menor que a inicial');
      return { k: k + 1, data, it, l, local: r.local || null, camada: r.camada || null, extra: { material: r.material || null, prefixo: r.prefixo || r.caminhao || r.placa || null, dmt: nOuNulo(r.dmt_km), apontador: r.apontador || null, obs: r.observacao || null }, av };
    });
    if ($('#avAgr').checked) { const g = {}; L1.forEach(x => { const key = [x.data, x.it && x.it.id, x.local, x.l.est_ini_int, x.l.est_ini_frac, x.l.est_fim_int, x.l.est_fim_frac, x.l.lado, x.l.cap_viagem, x.camada].join('|'); if (g[key] && x.l.n_viagens != null && g[key].l.n_viagens != null && x.l.quantidade == null && g[key].l.quantidade == null) { g[key].l.n_viagens += x.l.n_viagens; g[key].extra.prefixo = [g[key].extra.prefixo, x.extra.prefixo].filter(Boolean).join(', '); g[key].av.push(...x.av); } else g[key + (g[key] ? '#' + x.k : '')] = x; }); L1 = Object.values(g); }
    const datas = [...new Set(L1.map(x => x.data).filter(Boolean))].sort();
    const exist = datas.length ? await q(sb.from('memoria_calculo').select('data,orcamento_item_id,local,est_ini_int,est_ini_frac,est_fim_int,est_fim_frac,quantidade').eq('obra_id', S.obra.id).gte('data', datas[0]).lte('data', datas[datas.length - 1])) : [];
    const chave = (d, i, loc, a, b, c2, d2, q2) => [d, i, semAcento(loc), a ?? '', Number(b) || 0, c2 ?? '', Number(d2) || 0, Math.round((Number(q2) || 0) * 100)].join('|');
    const ks = new Set(exist.map(m => chave(m.data, m.orcamento_item_id, m.local, m.est_ini_int, m.est_ini_frac, m.est_fim_int, m.est_fim_frac, m.quantidade)));
    plano = L1.map(x => {
      const r = x.it ? calcMemoria(x.l, x.it) : {}; const qtd = x.l.quantidade ?? r.quantidade ?? null;
      if (x.it && qtd == null) x.av.push(`quantidade não calculável para unidade ${x.it.unidade}: preencha a quantidade`);
      const comp = r.comprimento ?? x.l.comprimento;
      const extras = [x.extra.material, x.extra.prefixo ? 'caminhão ' + x.extra.prefixo : null, x.extra.dmt != null ? `DMT ${nf(x.extra.dmt, 1)} km` : null, x.extra.apontador ? 'apont. ' + x.extra.apontador : null].filter(Boolean).join(' · ');
      const formula = (x.it ? (calcMemoria({ ...x.l, quantidade: qtd }, x.it).formula || `${nf(qtd)} ${x.it.unidade}`) : '') + (extras ? ` [${extras}]` : '');
      const dup = x.it && x.data && qtd != null && ks.has(chave(x.data, x.it.id, x.local, x.l.est_ini_int, x.l.est_ini_frac, x.l.est_fim_int, x.l.est_fim_frac, qtd));
      const okL = x.data && x.it && qtd != null && !x.av.some(a => a.includes('menor'));
      return { ...x, qtd, comp, formula, dup, acao: !okL ? 'erro' : (dup && $('#avDup').checked ? 'pular' : 'importar'), obs: [x.extra.obs, extras].filter(Boolean).join(' · ') || null };
    });
    const totI = {}; plano.filter(p => p.acao === 'importar').forEach(p => { totI[p.it.id] = (totI[p.it.id] || 0) + p.qtd; });
    const AC = { importar: '<span class="badge b-ok">Importar</span>', pular: '<span class="badge">Já existe</span>', erro: '<span class="badge b-er">Corrigir</span>' };
    $('#avPrev').innerHTML = `<div class="card"><h3>Prévia: ${plano.length} linha(s) · ${plano.filter(p => p.acao === 'importar').length} para importar</h3>
    <div class="kpis">${Object.entries(totI).map(([i, v]) => `<div class="kpi"><span>${h(itMap[i].codigo || '')} ${h(itMap[i].descricao).slice(0, 60)}</span><b>${nf(v)} ${h(itMap[i].unidade)}</b></div>`).join('')}</div>
    <div class="tw" style="max-height:55vh"><table class="grid"><thead><tr><th>#</th><th>Ação</th><th>Data</th><th>Item</th><th>Local</th><th>Estacas</th><th>Lado</th><th>Memória</th><th class="n">Quantidade</th><th>Avisos</th></tr></thead><tbody>${plano.map(p => `<tr><td>${p.k}</td><td>${AC[p.acao]}</td><td>${dt(p.data)}</td><td>${p.it ? h((p.it.codigo || '') + ' ' + p.it.descricao).slice(0, 50) : '–'}</td><td>${h(p.local || '')}</td><td>${estTxt(p.l.est_ini_int, p.l.est_ini_frac)}${p.l.est_fim_int != null ? ' a ' + estTxt(p.l.est_fim_int, p.l.est_fim_frac) : ''}</td><td>${h(p.l.lado || '')}</td><td style="font-size:12.5px">${h(p.formula)}</td><td class="n">${nf(p.qtd)}</td><td style="font-size:12.5px;color:var(--er)">${p.av.map(h).join('<br>')}</td></tr>`).join('')}</tbody></table></div>
    <div class="bar" style="margin-top:12px"><span class="sp"></span><button class="pri" id="avGo"><i class="ti ti-upload"></i>Importar ${plano.filter(p => p.acao === 'importar').length} linha(s)</button></div></div>`;
    $('#avGo').onclick = async () => {
      const bt = $('#avGo'); bt.disabled = true;
      const rows = plano.filter(p => p.acao === 'importar').map(p => ({ obra_id: S.obra.id, data: p.data, orcamento_item_id: p.it.id, local: p.local, est_ini_int: p.l.est_ini_int, est_ini_frac: p.l.est_ini_frac, est_fim_int: p.l.est_fim_int, est_fim_frac: p.l.est_fim_frac, lado: p.l.lado, comprimento: p.comp ?? null, largura: p.l.largura, espessura: p.l.espessura, n_viagens: p.l.n_viagens, cap_viagem: p.l.cap_viagem, quantidade: p.qtd, formula: p.formula, camada: p.camada, observacao: p.obs }));
      try { for (let i = 0; i < rows.length; i += 200) await q(sb.from('memoria_calculo').insert(rows.slice(i, i + 200))); toast(`${rows.length} avanço(s) lançado(s) na memória de cálculo`, 'ok'); $('#avPrev').insertAdjacentHTML('afterbegin', `<div class="card" style="border-color:#BFE3CF"><h3>${rows.length} linha(s) importada(s)</h3><p class="muted">Confira no Quadro do mês e na Memória de cálculo diária.</p></div>`); }
      catch (x) { erro(x); bt.disabled = false; }
    };
  } catch (x) { erro(x); } };
}
