'use strict';
const SUPABASE_URL = 'https://mgeyluuonvshdjkgxvaw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZXlsdXVvbnZzaGRqa2d4dmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0MTE2MDYsImV4cCI6MjExMDk4NzYwNn0.80bNMlrF08e9N4s4Tti_-urU-hxc2vYnJo68vfSC-mY';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const S = { user: null, me: null, obras: [], obra: null, perfil: null, ref: {}, charts: [], rota: 'painel' };

/* ---------- utilitários ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v);
const nf = (v, d = 2) => num(v) === null ? '' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const brl = v => num(v) === null ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v, d = 1) => num(v) === null ? '–' : nf(v, d) + '%';
const dt = v => v ? String(v).slice(0, 10).split('-').reverse().join('/') : '';
const hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const addDias = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const agora = () => new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const soma = (a, f) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const arq = (doc, ext) => `${S.obra.codigo}_${doc}_${hoje()}.${ext}`;
async function fnAdmin(body) {
  const { data, error } = await sb.functions.invoke('admin-usuarios', { body });
  if (error) { let m = error.message; try { const j = await error.context.json(); if (j && j.error) m = j.error; } catch (e) { } throw new Error(m); }
  if (data && data.error) throw new Error(data.error);
  return data;
}
function senhaProvisoria() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; const r = new Uint32Array(10); crypto.getRandomValues(r); return 'Nm' + [...r].map(x => a[x % a.length]).join('').slice(0, 8) + '!'; }
async function q(p) { const { data, error } = await p; if (error) throw error; return data; }

const L = {
  status_obra: { planejamento: 'Planejamento', mobilizacao: 'Mobilização', em_andamento: 'Em andamento', paralisada: 'Paralisada', concluida: 'Concluída' },
  tipo_area: { paralelepipedo: 'Sobre paralelepípedo', leito_natural: 'Leito natural', reacapeamento: 'Reacapeamento', requalificacao: 'Requalificação' },
  perfil: { admin: 'Administrador', gestor: 'Engenheiro gestor', auxiliar: 'Auxiliar de engenharia', apontador: 'Apontador / Encarregado', almoxarife: 'Almoxarife', fiscal: 'Fiscal / Cliente' },
  clima: { bom: 'Bom', nublado: 'Nublado', chuva_fraca: 'Chuva fraca', chuva_forte: 'Chuva forte' },
  condicao: { praticavel: 'Praticável', parcial: 'Parcialmente praticável', impraticavel: 'Impraticável' },
  status_rdo: { rascunho: 'Rascunho', enviado: 'Aguardando aprovação', aprovado: 'Aprovado', devolvido: 'Devolvido' },
  status_med: { rascunho: 'Rascunho', em_analise: 'Em análise (fiscalização)', aprovada: 'Aprovada', glosada_parcial: 'Glosada parcialmente' },
  status_eap: { nao_iniciada: 'Não iniciada', em_andamento: 'Em andamento', concluida: 'Concluída', paralisada: 'Paralisada', marco: 'Marco' },
  lado: { LE: 'LE', LD: 'LD', EIXO: 'Eixo', AMBOS: 'Ambos' },
  vinculo: { proprio: 'Próprio', terceiro: 'Terceiro' },
  propriedade: { proprio: 'Próprio', locado: 'Locado', terceiro_producao: 'Terceiro (produção)' },
  status_eq: { operando: 'Operando', parado: 'Parado', manutencao: 'Em manutenção', mobilizacao: 'Mobilização', desmobilizado: 'Desmobilizado' },
  manut: { preventiva: 'Preventiva', corretiva: 'Corretiva' },
  categoria: { mao_de_obra: 'Mão de obra', equipamento: 'Equipamento', material: 'Material', terceiros: 'Terceiros', administracao: 'Administração local', alimentacao: 'Alimentação', alojamento: 'Alojamento', transporte: 'Transporte', outros: 'Outros' },
  apoio: { alimentacao: 'Alimentação', alojamento: 'Alojamento', transporte: 'Transporte' },
  pagamento: { pix: 'PIX', dinheiro: 'Dinheiro', cartao_empresa: 'Cartão da empresa', boleto: 'Boleto', faturado: 'Faturado (a prazo)', transferencia: 'Transferência', reembolso: 'Reembolso a colaborador' },
  mov: { pedido: 'Pedido', entrada: 'Entrada', saida: 'Saída' },
  status_mov: { aberto: 'Aberto', concluido: 'Concluído', cancelado: 'Cancelado' },
  aditivo: { prazo: 'Prazo', valor: 'Valor', quantidade: 'Quantidade', prazo_valor: 'Prazo e valor' },
  status_adit: { em_elaboracao: 'Em elaboração', protocolado: 'Protocolado', aprovado: 'Aprovado', negado: 'Negado' },
  status_doc: { pendente: 'Pendente', em_andamento: 'Em andamento', entregue: 'Entregue', nao_se_aplica: 'Não se aplica' },
  ligante: { imprimacao: 'Imprimação', pintura_rr1c: 'Pintura RR-1C' },
  tipo_pend: { pendencia: 'Pendência', divergencia: 'Divergência', suposicao: 'Suposição', informado: 'Informado' },
  status_pend: { aberta: 'Aberta', em_andamento: 'Em andamento', a_confirmar: 'A confirmar', resolvida: 'Resolvida' }
};
const COR = {
  aprovado: 'b-ok', aprovada: 'b-ok', concluida: 'b-ok', entregue: 'b-ok', operando: 'b-ok', em_andamento: 'b-az', enviado: 'b-av', em_analise: 'b-av',
  rascunho: '', devolvido: 'b-er', aberta: 'b-er', a_confirmar: 'b-av', resolvida: 'b-ok', glosada_parcial: 'b-er', paralisada: 'b-er', parado: 'b-er', manutencao: 'b-av', pendente: 'b-av', mobilizacao: 'b-la', marco: 'b-la'
};
const badge = (v, mapa) => `<span class="badge ${COR[v] || ''}">${h((mapa && mapa[v]) || v || '')}</span>`;

const PODE = {
  campo: ['admin', 'gestor', 'auxiliar', 'apontador'],
  aprovar: ['admin', 'gestor'],
  orcamento: ['admin', 'gestor'],
  planejar: ['admin', 'gestor', 'auxiliar'],
  medir: ['admin', 'gestor', 'auxiliar'],
  custos: ['admin', 'gestor', 'auxiliar'],
  equip: ['admin', 'gestor', 'auxiliar'],
  supr: ['admin', 'gestor', 'auxiliar', 'almoxarife'],
  admin: ['admin']
};
const pode = k => PODE[k].includes(S.perfil);

function toast(t, tipo = '') { const d = document.createElement('div'); d.className = tipo; d.textContent = t; $('#toast').appendChild(d); setTimeout(() => d.remove(), tipo === 'erro' ? 9000 : 4000); }
function erro(e) {
  console.error(e);
  let m = (e && e.message) || String(e);
  if (e && e.code === '23505') m = m.includes('rdo_obra_id_data') ? 'Já existe RDO desta obra nesta data.' : m.includes('medicoes_obra_id_numero') ? 'Já existe medição com este número.' : 'Registro duplicado.';
  else if (m.includes('row-level security') || (e && e.code === '42501')) m = 'Seu perfil não tem permissão para esta ação.';
  else if (m.includes('Failed to fetch') || m.includes('NetworkError')) m = 'Sem conexão com o servidor.';
  else if (e && e.code === '23503') m = 'Registro em uso por outros lançamentos; não pode ser excluído.';
  toast(m, 'erro');
}
function modal(titulo, corpo, botoes = []) {
  const o = document.createElement('div'); o.className = 'ovl';
  o.innerHTML = `<div class="mdl" role="dialog" aria-label="${h(titulo)}"><h2 style="margin-top:0">${h(titulo)}</h2><div class="mb"></div><div class="acts"></div></div>`;
  const mb = $('.mb', o); if (typeof corpo === 'string') mb.innerHTML = corpo; else mb.appendChild(corpo);
  const acts = $('.acts', o);
  const fechar = () => o.remove();
  botoes.forEach(b => {
    if (b === '|') { const s = document.createElement('span'); s.className = 'sp'; acts.appendChild(s); return; }
    const x = document.createElement('button'); x.textContent = b.t; if (b.c) x.className = b.c;
    x.onclick = async () => { x.disabled = true; try { const r = await b.f(o); if (r !== false) fechar(); } catch (e) { erro(e); } finally { x.disabled = false; } };
    acts.appendChild(x);
  });
  const c = document.createElement('button'); c.textContent = 'Fechar'; c.onclick = fechar; acts.appendChild(c);
  o.addEventListener('mousedown', ev => { if (ev.target === o) fechar(); });
  document.body.appendChild(o);
  const f = $('input,select,textarea', mb); if (f) f.focus();
  return o;
}
function confirma(texto, f) { modal('Confirmar', `<p>${h(texto)}</p>`, [{ t: 'Confirmar', c: 'pri', f }]); }

/* ---------- referências da obra ---------- */
async function refItens(force) {
  if (!S.ref.itens || force) S.ref.itens = await q(sb.from('orcamento_itens').select('id,ordem,item,descricao,unidade,quantidade,preco_unitario,tipo_area').eq('obra_id', S.obra.id).eq('ativo', true).order('ordem'));
  return S.ref.itens;
}
async function refEquip(force) {
  if (!S.ref.equip || force) S.ref.equip = await q(sb.from('equipamentos').select('id,prefixo,descricao,tipo,status,horimetro_atual').eq('obra_id', S.obra.id).order('prefixo'));
  return S.ref.equip;
}
async function refMat(force) {
  if (!S.ref.mat || force) S.ref.mat = await q(sb.from('materiais').select('id,nome,unidade').eq('obra_id', S.obra.id).order('nome'));
  return S.ref.mat;
}
const ehCbuq = i => String(i.unidade).toLowerCase() === 't' && /CBUQ|BETUMINOSO USINADO/i.test(i.descricao || '');
const imprimaTipo = t => t === 'leito_natural' || t === 'requalificacao';
const itemLbl = i => i ? `${i.item || i.ordem || ''} – ${i.descricao} (${i.unidade})` : '';
async function opcoesRef(tipo) {
  if (tipo === 'item') return (await refItens()).map(i => [i.id, itemLbl(i)]);
  if (tipo === 'equip') return (await refEquip()).map(e => [e.id, `${e.prefixo} – ${e.descricao}`]);
  if (tipo === 'mat') return (await refMat()).map(m => [m.id, `${m.nome} (${m.unidade})`]);
  return [];
}

/* ---------- exportação padronizada ---------- */
function xlsxExport(doc, titulo, head, body, opt = {}) {
  const topo = [['NIEMAIA SERVIÇOS E EQUIPAMENTOS'], [`Obra: ${S.obra.codigo} – ${S.obra.nome}`], [titulo], [`Emitido em ${agora()} por ${S.me.nome || S.me.email}`], []];
  if (opt.sub) opt.sub.forEach(l => topo.splice(4, 0, [l]));
  const r0 = topo.length;
  const aoa = [...topo, head, ...body];
  if (opt.total) aoa.push(opt.total);
  if (opt.extra) aoa.push([], ...opt.extra);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = head.map((c, i) => ({ wch: Math.min(60, Math.max(9, ...[c, ...body.map(r => r[i])].map(v => typeof v === 'number' ? 14 : String(v ?? '').length + 2))) }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: r0, c: 0 }, e: { r: r0 + body.length, c: head.length - 1 } }) };
  for (let r = r0 + 1; r < aoa.length; r++) for (let c = 0; c < head.length; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (cell && cell.t === 'n') cell.z = (opt.fmt && opt.fmt[c]) || '#,##0.00';
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, titulo.replace(/[\\/?*[\]:]/g, '').slice(0, 31));
  XLSX.writeFile(wb, arq(doc, 'xlsx'));
}
function pdfNovo(titulo, paisagem) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: paisagem ? 'l' : 'p', unit: 'mm', format: 'a4' });
  const P = { doc, titulo, W: doc.internal.pageSize.getWidth(), H: doc.internal.pageSize.getHeight(), y: 32, M: 12 };
  P.quebra = (alt) => { if (P.y + alt > P.H - 16) { doc.addPage(); P.y = 32; } };
  P.texto = (t, o = {}) => {
    doc.setFont('helvetica', o.b ? 'bold' : 'normal'); doc.setFontSize(o.s || 10);
    const linhas = doc.splitTextToSize(String(t ?? ''), P.W - 2 * P.M);
    linhas.forEach(l => { P.quebra(5); doc.text(l, P.M, P.y); P.y += (o.s || 10) * 0.45; });
    P.y += o.dep ?? 1.5;
  };
  P.tabela = (head, body, o = {}) => {
    doc.autoTable({
      head: [head], body, startY: P.y, margin: { top: 32, bottom: 16, left: P.M, right: P.M }, theme: 'grid',
      styles: { fontSize: o.fs || 8.5, cellPadding: 1.6, lineColor: [210, 210, 205], lineWidth: 0.15, overflow: 'linebreak' },
      headStyles: { fillColor: [38, 39, 43], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 249, 251] },
      footStyles: { fillColor: [240, 240, 236], textColor: 20, fontStyle: 'bold' },
      columnStyles: o.cols || {}, foot: o.foot ? [o.foot] : undefined, showFoot: 'lastPage'
    });
    P.y = doc.lastAutoTable.finalY + 6;
  };
  P.assinaturas = (nomes) => {
    P.quebra(30); P.y += 14; const w = (P.W - 2 * P.M) / nomes.length;
    nomes.forEach((n, i) => { const x = P.M + i * w + 8; doc.setLineWidth(0.2); doc.setDrawColor(60); doc.line(x, P.y, x + w - 16, P.y); doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text(n, x + (w - 16) / 2, P.y + 4.5, { align: 'center' }); });
    P.y += 12;
  };
  P.salvar = (nome) => {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.addImage(LOGO, 'PNG', P.M, 6.5, 17, 17);
      doc.setTextColor(30); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('NIEMAIA SERVIÇOS E EQUIPAMENTOS', P.M + 19, 11.5);
      doc.setFontSize(10.5); doc.text(titulo, P.M + 19, 17.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(`Obra: ${S.obra.codigo} – ${S.obra.nome}`, P.M + 19, 22.5);
      if (S.obra.contratante) doc.text(`Contratante: ${S.obra.contratante}`.slice(0, 95), P.W - P.M, 11.5, { align: 'right' });
      doc.setDrawColor(249, 84, 20); doc.setLineWidth(0.6); doc.line(P.M, 26.5, P.W - P.M, 26.5);
      doc.setDrawColor(200); doc.setLineWidth(0.2); doc.line(P.M, P.H - 11, P.W - P.M, P.H - 11);
      doc.setFontSize(8); doc.setTextColor(90);
      doc.text(`Emitido em ${agora()} por ${S.me.nome || S.me.email}`, P.M, P.H - 7);
      doc.text(`Página ${i} de ${n}`, P.W - P.M, P.H - 7, { align: 'right' });
      doc.setTextColor(0);
    }
    doc.save(arq(nome, 'pdf'));
  };
  return P;
}
function tabelaPdf(doc, titulo, head, body, opt = {}) {
  const P = pdfNovo(titulo, opt.paisagem ?? head.length > 6);
  if (opt.sub) opt.sub.forEach(s => P.texto(s, { s: 9.5, dep: 0.5 }));
  if (opt.sub) P.y += 2;
  P.tabela(head, body.map(r => r.map(c => typeof c === 'number' ? nf(c, 2) : (c ?? ''))), { foot: opt.total && opt.total.map(c => typeof c === 'number' ? nf(c, 2) : (c ?? '')), cols: opt.cols });
  if (opt.assin) P.assinaturas(opt.assin);
  P.salvar(doc);
}
async function imgDataUrl(url) {
  const b = await (await fetch(url)).blob();
  return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(b); });
}
async function reduzImg(dataUrl, max = 1400) {
  return new Promise(ok => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok({ url: c.toDataURL('image/jpeg', 0.8), w: c.width, h: c.height }); }; im.onerror = () => ok(null); im.src = dataUrl; });
}
async function fotosPdf(P, fotos) {
  const doc = P.doc; const area = (P.H - 32 - 18) / 2; let i = 0;
  for (const f of fotos) {
    if (i % 2 === 0) { doc.addPage(); P.y = 32; }
    try {
      const u = await q(sb.storage.from('fotos').createSignedUrl(f.caminho, 600));
      const im = await reduzImg(await imgDataUrl(u.signedUrl));
      if (im) {
        const hMax = area - 14, wMax = P.W - 2 * P.M; let w = wMax, hh = w * im.h / im.w; if (hh > hMax) { hh = hMax; w = hh * im.w / im.h; }
        doc.addImage(im.url, 'JPEG', (P.W - w) / 2, P.y, w, hh);
        doc.setFontSize(9.5); doc.setFont('helvetica', 'bold');
        doc.text(doc.splitTextToSize(`Foto ${i + 1}: ${f.legenda || ''}`, P.W - 2 * P.M), P.M, P.y + hh + 5);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        const meta = [f.data_hora ? 'Data/hora: ' + new Date(f.data_hora).toLocaleString('pt-BR') : '', f.latitude ? `Coord.: ${f.latitude}, ${f.longitude}` : ''].filter(Boolean).join('   ');
        if (meta) doc.text(meta, P.M, P.y + hh + 10);
      }
    } catch (e) { doc.text(`Foto ${i + 1}: não carregada (${f.legenda || f.caminho})`, P.M, P.y + 5); }
    P.y += area; i++;
  }
}
const legendaPadrao = (servico, local, lado) => [S.obra.codigo, servico || '[serviço]', local || '[rua/est.]', lado === 'LE' ? 'LE' : lado === 'LD' ? 'LD' : (lado || '')].filter(Boolean).join(' – ');

/* ---------- CRUD genérico ---------- */
function valCel(c, r, bruto) {
  let v = c.v ? c.v(r) : r[c.k];
  if (bruto) {
    if (['num', 'money'].includes(c.t)) return num(v);
    if (c.t === 'sel') return (c.o && c.o[v]) || v || '';
    if (c.t === 'date') return dt(v);
    if (c.t === 'bool') return v ? 'Sim' : 'Não';
    if (c.t === 'ref') return (c._map && c._map[v]) || '';
    return v ?? '';
  }
  if (c.t === 'num') return nf(v, c.d ?? 2);
  if (c.t === 'money') return brl(v);
  if (c.t === 'date') return dt(v);
  if (c.t === 'sel') return c.badge ? badge(v, c.o) : h((c.o && c.o[v]) || v || '');
  if (c.t === 'bool') return v ? 'Sim' : 'Não';
  if (c.t === 'ref') return h((c._map && c._map[v]) || '');
  if (c.html) return v ?? '';
  return h(v ?? '');
}
async function crud(el, cfg) {
  const canW = cfg.write ? pode(cfg.write) : false;
  for (const c of cfg.cols) if (c.t === 'ref') { c._op = await opcoesRef(c.ref); c._map = Object.fromEntries(c._op); }
  const carregar = async () => {
    if (cfg.load) return cfg.load();
    let p = sb.from(cfg.view || cfg.table).select(cfg.select || '*');
    if (!cfg.semObra) p = p.eq('obra_id', S.obra.id);
    return q(p.order(cfg.order || 'id', { ascending: cfg.asc !== false }).limit(cfg.limit || 5000));
  };
  let rows = await carregar(); let busca = '', sk = null, sd = 1;
  const cols = cfg.cols.filter(c => !c.formOnly);
  el.innerHTML = `${cfg.intro ? `<p class="muted">${cfg.intro}</p>` : ''}<div class="bar"><input class="busca" placeholder="Buscar" aria-label="Buscar">${canW && !cfg.noNew ? `<button class="pri novo">${h(cfg.novo || 'Novo')}</button>` : ''}${cfg.botoes || ''}<span class="sp"></span><button class="xl">Excel</button><button class="pdf">PDF</button></div><div class="topx"></div><div class="tw"><table class="grid lst"><thead></thead><tbody></tbody><tfoot></tfoot></table></div>`;
  const filtrados = () => {
    let r = rows;
    if (busca) { const b = busca.toLowerCase(); r = r.filter(x => cols.some(c => String(valCel(c, x, true)).toLowerCase().includes(b))); }
    if (sk) { const c = cols.find(c => c.k === sk); r = [...r].sort((a, b) => { const va = valCel(c, a, true), vb = valCel(c, b, true); return (va > vb ? 1 : va < vb ? -1 : 0) * sd; }); }
    return r;
  };
  const isN = c => ['num', 'money'].includes(c.t);
  const desenhar = () => {
    const r = filtrados();
    $('thead', el).innerHTML = '<tr>' + cols.map(c => `<th class="${isN(c) ? 'n' : ''}" data-k="${c.k}">${h(c.l)}${sk === c.k ? (sd > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('') + '</tr>';
    $('tbody', el).innerHTML = r.length ? r.map((x, i) => `<tr class="clk" data-i="${rows.indexOf(x)}">` + cols.map(c => `<td class="${isN(c) ? 'n' : ''}" data-l="${h(c.l)}">${valCel(c, x)}</td>`).join('') + '</tr>').join('') : `<tr><td colspan="${cols.length}" class="vazio">${h(cfg.vazio || 'Nenhum registro.')}</td></tr>`;
    $('tfoot', el).innerHTML = cols.some(c => c.sum) && r.length ? '<tr>' + cols.map((c, i) => `<td class="${isN(c) ? 'n' : ''}" data-l="${c.sum ? h(c.l) : ''}">${c.sum ? (c.t === 'money' ? brl(soma(r, x => valCel(c, x, true))) : nf(soma(r, x => valCel(c, x, true)), c.d ?? 2)) : (i === 0 ? 'Total' : '')}</td>`).join('') + '</tr>' : '';
    if (cfg.resumo) cfg.resumo($('.topx', el), r);
  };
  desenhar();
  $('.busca', el).oninput = e => { busca = e.target.value; desenhar(); };
  $('thead', el).onclick = e => { const k = e.target.closest('th')?.dataset.k; if (!k) return; sd = sk === k ? -sd : 1; sk = k; desenhar(); };
  const recarregar = async () => { rows = await carregar(); desenhar(); if (cfg.apos) cfg.apos(); };
  $('tbody', el).onclick = e => { const tr = e.target.closest('tr[data-i]'); if (!tr) return; const r = rows[tr.dataset.i]; if (cfg.abrir) return cfg.abrir(r, recarregar); formCrud(cfg, r, recarregar, canW); };
  if ($('.novo', el)) $('.novo', el).onclick = () => cfg.abrir ? cfg.abrir(null, recarregar) : formCrud(cfg, null, recarregar, true);
  const exp = (tipo) => {
    const r = filtrados(); const ec = cols.filter(c => !c.noExp);
    const head = ec.map(c => c.l), body = r.map(x => ec.map(c => valCel(c, x, true)));
    const total = ec.some(c => c.sum) ? ec.map((c, i) => c.sum ? soma(r, x => valCel(c, x, true)) : (i === 0 ? 'Total' : '')) : null;
    if (tipo === 'x') xlsxExport(cfg.doc, cfg.title, head, body, { total, fmt: ec.map(c => c.t === 'num' ? (c.d === 0 ? '#,##0' : c.d === 3 ? '#,##0.000' : '#,##0.00') : c.t === 'money' ? '"R$" #,##0.00' : null) });
    else tabelaPdf(cfg.doc, cfg.title, head, body, { total, paisagem: cfg.paisagem });
  };
  $('.xl', el).onclick = () => exp('x'); $('.pdf', el).onclick = () => exp('p');
  if (cfg.pronto) cfg.pronto(el, recarregar, () => rows);
  return { recarregar, rows: () => rows };
}
function campoHtml(c, v) {
  const id = 'f_' + c.k; const ro = c.ro ? 'disabled' : '';
  let inp;
  if (c.t === 'sel') inp = `<select id="${id}" ${ro}>${c.req ? '' : '<option value=""></option>'}${Object.entries(c.o).map(([k, l]) => `<option value="${h(k)}" ${String(v ?? c.def ?? '') === k ? 'selected' : ''}>${h(l)}</option>`).join('')}</select>`;
  else if (c.t === 'ref') inp = `<select id="${id}" ${ro}><option value=""></option>${(c._op || []).map(([k, l]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${h(l)}</option>`).join('')}</select>`;
  else if (c.t === 'bool') inp = `<div class="chk"><input type="checkbox" id="${id}" ${v ? 'checked' : ''} ${ro}><span>${h(c.l)}</span></div>`;
  else if (c.t === 'area') inp = `<textarea id="${id}" ${ro}>${h(v ?? '')}</textarea>`;
  else if (['num', 'money'].includes(c.t)) inp = `<input type="number" step="any" id="${id}" value="${v ?? c.def ?? ''}" ${ro} inputmode="decimal">`;
  else inp = `<input type="${c.t === 'date' ? 'date' : c.t === 'time' ? 'time' : c.t === 'email' ? 'email' : 'text'}" id="${id}" value="${h(v ?? c.def ?? '')}" ${ro} ${c.list ? `list="dl_${c.k}"` : ''}>${c.list ? `<datalist id="dl_${c.k}">${c.list.map(x => `<option value="${h(x)}">`).join('')}</datalist>` : ''}`;
  return `<div class="${c.w || ''}">${c.t === 'bool' ? '' : `<label for="${id}">${h(c.l)}${c.req ? ' *' : ''}</label>`}${inp}${c.dica ? `<div class="muted">${h(c.dica)}</div>` : ''}</div>`;
}
function lerCampos(box, campos) {
  const o = {};
  for (const c of campos) {
    if (c.ro) continue;
    const e = $('#f_' + c.k, box); if (!e) continue;
    let v = c.t === 'bool' ? e.checked : e.value;
    if (['num', 'money'].includes(c.t)) v = v === '' ? null : Number(v);
    else if (c.t !== 'bool' && v === '') v = null;
    if (c.req && (v === null || v === '')) throw new Error(`Preencha o campo "${c.l}".`);
    o[c.k] = v;
  }
  return o;
}
async function formCrud(cfg, row, depois, canW) {
  const pk = cfg.pk || 'id';
  if (row && cfg.view) row = await q(sb.from(cfg.table).select('*').eq(pk, row[pk]).single());
  for (const c of cfg.cols) if (c.t === 'ref' && !c._op) { c._op = await opcoesRef(c.ref); c._map = Object.fromEntries(c._op); }
  const campos = cfg.cols.filter(c => !c.listOnly);
  const box = document.createElement('div'); box.className = 'form';
  box.innerHTML = campos.map(c => campoHtml(c, row ? row[c.k] : undefined)).join('');
  if (!canW) $$('input,select,textarea', box).forEach(e => e.disabled = true);
  if (cfg.calc) { const f = () => cfg.calc(box); box.addEventListener('input', f); f(); }
  if (cfg.anexo) {
    box.insertAdjacentHTML('beforeend', `<div class="wf anexo"><label>${h(cfg.anexo.rotulo || 'Comprovante (foto, PDF ou nota)')}</label><div class="axl">${row && row.anexo_caminho ? `<button type="button" class="axver"><i class="ti ti-paperclip"></i>${h(row.anexo_nome || 'Ver comprovante')}</button>` : '<span class="muted">Sem comprovante anexado.</span>'}</div>${canW ? '<input type="file" class="axf" accept="image/*,application/pdf,.pdf,.xml">' : ''}</div>`);
    if ($('.axver', box)) $('.axver', box).onclick = () => abrirAnexo(cfg.anexo.bucket, row.anexo_caminho, row.anexo_nome).catch(erro);
  }
  const bt = [];
  if (canW && row && cfg.del !== false) bt.push({ t: 'Excluir', c: 'er', f: async () => { await q(sb.from(cfg.table).delete().eq(pk, row[pk])); toast('Excluído'); await depois(); } }, '|');
  if (canW) bt.push({ t: 'Salvar', c: 'pri', f: async () => {
    const v = lerCampos(box, campos);
    if (cfg.antesSalvar) cfg.antesSalvar(v, row);
    let id = row ? row[pk] : null;
    if (row) await q(sb.from(cfg.table).update(v).eq(pk, row[pk]));
    else id = (await q(sb.from(cfg.table).insert(cfg.semObra ? v : { ...v, obra_id: S.obra.id }).select(pk).single()))[pk];
    const fa = cfg.anexo && $('.axf', box) && $('.axf', box).files[0];
    if (fa) await subirAnexo(cfg.anexo.bucket, cfg.table, id, fa, v.obra_id || S.obra.id);
    toast('Salvo', 'ok'); S.ref = {}; await depois();
  } });
  modal((row ? (canW ? 'Editar' : 'Ver') : 'Novo') + ' – ' + cfg.title, box, bt);
}
/* gráficos: se a biblioteca não carregar (sem sinal), mostra aviso e o resto da tela segue funcionando */
function grafico(canvas, cfg) {
  if (!canvas) return null;
  if (!window.Chart) { const p = canvas.parentNode; if (p) p.innerHTML = '<p class="muted">Gráfico indisponível: a biblioteca de gráficos não carregou (verifique a conexão e recarregue).</p>'; return null; }
  const ch = new Chart(canvas, cfg); S.charts.push(ch); return ch;
}
/* comprovantes / anexos de registros */
async function subirAnexo(bucket, tabela, id, file, obraId) {
  let blob = file, ext = (file.name.split('.').pop() || 'bin').toLowerCase(), tipo = file.type || undefined;
  if (/^image\//.test(file.type) && !/gif|svg/.test(file.type)) {
    const u = await new Promise(ok => { const rd = new FileReader(); rd.onload = () => ok(rd.result); rd.readAsDataURL(file); });
    const im = await reduzImg(u, 1800); if (im) { blob = await (await fetch(im.url)).blob(); ext = 'jpg'; tipo = 'image/jpeg'; }
  }
  const cam = `${obraId || S.obra.id}/${tabela}/${id}_${Date.now()}.${ext}`;
  await q(sb.storage.from(bucket).upload(cam, blob, { upsert: true, contentType: tipo }));
  await q(sb.from(tabela).update({ anexo_caminho: cam, anexo_nome: file.name }).eq('id', id));
  return cam;
}
async function abrirAnexo(bucket, caminho, nome) {
  const u = await q(sb.storage.from(bucket).createSignedUrl(caminho, 600));
  const a = document.createElement('a'); a.href = u.signedUrl; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
}
function abas(el, lista, ini) {
  el.innerHTML = `<div class="tabs">${lista.map((a, i) => `<button data-i="${i}">${h(a.t)}</button>`).join('')}</div><div class="tabc"></div>`;
  const ir = async i => { $$('.tabs button', el).forEach(b => b.classList.toggle('at', b.dataset.i == i)); const c = $('.tabc', el); c.innerHTML = '<div class="vazio">Carregando…</div>'; try { await lista[i].f(c); } catch (e) { erro(e); c.innerHTML = '<div class="vazio">Não foi possível carregar.</div>'; } };
  $('.tabs', el).onclick = e => { const b = e.target.closest('button'); if (b) ir(+b.dataset.i); };
  ir(ini || 0);
}

/* ---------- autenticação e estrutura ---------- */
function telaLogin(modo = 'entrar') {
  document.body.className = '';
  $('#app').innerHTML = `<div class="login"><div class="lado"><h2>Gestão de obras de infraestrutura</h2><p>Diário de obra, produção, medição, equipamentos e custos num só lugar, com o padrão NIEMAIA em cada documento.</p><div class="tags">${S.obras.length ? '' : '<span>RUAS</span><span>ALÇA OESTE</span><span>POLO TURÍSTICO</span>'}</div></div>
  <div class="frm"><form class="box"><img src="${LOGO}" alt="NIEMAIA Serviços e Equipamentos"><h1>${modo === 'criar' ? 'Criar conta' : modo === 'senha' ? 'Recuperar senha' : 'Entrar'}</h1><p class="muted" style="margin-top:2px">${modo === 'senha' ? 'Enviaremos um link para cadastrar a nova senha.' : 'Use seu e-mail e senha cadastrados.'}</p>
  ${modo === 'criar' ? '<div><label for="ln">Nome completo</label><input id="ln" required autocomplete="name"></div>' : ''}
  <div><label for="le">E-mail</label><input id="le" type="email" required autocomplete="email"></div>
  ${modo !== 'senha' ? `<div><label for="ls">Senha</label><input id="ls" type="password" required minlength="6" autocomplete="${modo === 'criar' ? 'new-password' : 'current-password'}"></div>` : ''}
  <button class="pri">${modo === 'criar' ? 'Criar conta' : modo === 'senha' ? 'Enviar link' : 'Entrar'}</button>
  <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">${modo !== 'entrar' ? '<button type="button" class="lk" data-m="entrar">Voltar para entrar</button>' : '<span class="muted">Acesso cadastrado pelo administrador.</span><button type="button" class="lk" data-m="senha">Esqueci a senha</button>'}</div>
  <p class="muted msg"></p></form></div></div>`;
  $$('.login [data-m]').forEach(b => b.onclick = () => telaLogin(b.dataset.m));
  $('.login form').onsubmit = async ev => {
    ev.preventDefault(); const e = $('#le').value.trim(), s = $('#ls') && $('#ls').value, m = $('.login .msg');
    try {
      if (modo === 'entrar') { await q(sb.auth.signInWithPassword({ email: e, password: s })); await iniciar(); }
      else if (modo === 'criar') { const r = await q(sb.auth.signUp({ email: e, password: s, options: { data: { nome: $('#ln').value.trim() }, emailRedirectTo: location.href.split('#')[0] } })); if (r.session) await iniciar(); else m.textContent = 'Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre. O administrador libera o acesso às obras.'; }
      else { await q(sb.auth.resetPasswordForEmail(e, { redirectTo: location.href.split('#')[0] })); m.textContent = 'Link enviado. Abra o e-mail para cadastrar a nova senha.'; }
    } catch (x) { m.textContent = x.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : x.message === 'Email not confirmed' ? 'Confirme o e-mail pelo link recebido antes de entrar.' : x.message; }
  };
}
function trocarSenha() {
  modal('Cadastrar nova senha', '<div><label for="ns">Nova senha</label><input id="ns" type="password" minlength="6"></div>', [{ t: 'Salvar', c: 'pri', f: async o => { await q(sb.auth.updateUser({ password: $('#ns', o).value })); toast('Senha alterada', 'ok'); } }]);
}
const MODS = [
  { id: 'painel', t: 'Painel', g: 'Visão geral', i: 'layout-dashboard', p: null, f: () => pgPainel },
  { id: 'obras', t: 'Obras e documentos', g: 'Visão geral', i: 'building', p: null, f: () => pgObras },
  { id: 'rdo', t: 'Diário de Obra (RDO)', g: 'Campo', i: 'notebook', p: ['admin', 'gestor', 'auxiliar', 'apontador', 'fiscal'], f: () => pgRdo },
  { id: 'producaomes', t: 'Produção mensal', g: 'Campo', i: 'chart-bar', p: ['admin', 'gestor', 'auxiliar', 'apontador', 'fiscal'], f: () => pgProdMes },
  { id: 'producao', t: 'Produção CBUQ', g: 'Campo', i: 'road', p: ['admin', 'gestor', 'auxiliar', 'apontador', 'fiscal'], f: () => pgProducao },
  { id: 'equipamentos', t: 'Equipamentos', g: 'Campo', i: 'bulldozer', p: ['admin', 'gestor', 'auxiliar', 'apontador', 'almoxarife'], f: () => pgEquip },
  { id: 'maodeobra', t: 'Mão de obra', g: 'Campo', i: 'users-group', p: ['admin', 'gestor', 'auxiliar', 'apontador'], f: () => pgMaoObra },
  { id: 'orcamento', t: 'Orçamento', g: 'Contrato', i: 'file-dollar', p: null, f: () => pgOrcamento },
  { id: 'planejamento', t: 'Planejamento', g: 'Contrato', i: 'calendar-stats', p: null, f: () => pgPlanejamento },
  { id: 'medicao', t: 'Medição', g: 'Contrato', i: 'ruler-measure', p: ['admin', 'gestor', 'auxiliar', 'fiscal'], f: () => pgMedicao },
  { id: 'custos', t: 'Custos', g: 'Gestão', i: 'coin', p: PODE.custos, f: () => pgCustos },
  { id: 'suprimentos', t: 'Suprimentos', g: 'Gestão', i: 'package', p: ['admin', 'gestor', 'auxiliar', 'apontador', 'almoxarife'], f: () => pgSupr },
  { id: 'relatorios', t: 'Relatórios', g: 'Gestão', i: 'file-export', p: null, f: () => pgRelatorios },
  { id: 'pendinfo', t: 'Informações pendentes', g: 'Gestão', i: 'list-check', p: ['admin', 'gestor', 'auxiliar'], f: () => pgInfoPend },
  { id: 'usuarios', t: 'Usuários e acesso', g: 'Gestão', i: 'shield-lock', p: ['admin'], f: () => pgUsuarios }
];
const SUBT = { painel: 'Avanço, contrato, produção e alertas da obra', obras: 'Ficha, pendências, documentos SEPLAN, aditivos e certidões', rdo: 'Registro diário: clima, efetivo, equipamentos, serviços, ocorrências e fotos', producaomes: 'Memória de cálculo diária e quadro de produção do mês por item', producao: 'Massa aplicada × tickets da usina e taxa de ligante', equipamentos: 'Frota, abastecimento, manutenções e horas', maodeobra: 'Efetivo, ASO, EPI e histograma', orcamento: 'Itens contratados, executado, medido e saldo', planejamento: 'EAP, cronograma e histograma previsto', medicao: 'Boletim, memória de cálculo e checklist da fiscalização', custos: 'Custo real, alimentação, alojamento e transporte, com comprovantes', pendinfo: 'O que falta no sistema e a quem pedir', suprimentos: 'Estoque, pedidos e entradas no canteiro', relatorios: 'Documentos no padrão NIEMAIA para a fiscalização e a diretoria', usuarios: 'Perfis, acesso por obra e registro de alterações' };

async function iniciar() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return telaLogin();
  S.user = session.user;
  S.me = await q(sb.from('perfis').select('*').eq('id', S.user.id).single());
  if (!S.me.ativo) { $('#app').innerHTML = `<div class="login"><div class="simples" style="grid-column:1/-1"><div class="card" style="max-width:420px"><img src="${LOGO}" alt="" style="width:120px"><h2>Acesso bloqueado</h2><p>Fale com o administrador do sistema.</p><button class="sair">Sair</button></div></div></div>`; $('.sair').onclick = () => sb.auth.signOut(); return; }
  S.obras = await q(sb.from('obras').select('*').order('codigo'));
  if (!S.obras.length) { $('#app').innerHTML = `<div class="login"><div class="simples" style="grid-column:1/-1"><div class="card" style="max-width:440px"><img src="${LOGO}" alt="" style="width:120px"><h2>Nenhuma obra liberada</h2><p><b>${h(S.me.nome)}</b>, sua conta está ativa. Peça ao administrador para liberar seu acesso em "Usuários e acesso".</p><button class="sair">Sair</button></div></div></div>`; $('.sair').onclick = () => sb.auth.signOut(); return; }
  let ult = null; try { ult = localStorage.getItem('niemaia_obra'); } catch (e) { }
  await trocarObra((S.obras.find(o => o.id === ult) || S.obras[0]).id, true);
  estrutura();
  window.addEventListener('hashchange', rotear);
  rotear();
  sincronizarPendentes();
}
async function trocarObra(id, sem) {
  S.obra = S.obras.find(o => o.id === id); S.ref = {};
  try { localStorage.setItem('niemaia_obra', id); } catch (e) { }
  S.perfil = await q(sb.rpc('perfil_obra', { p_obra: id }));
  if (!sem) { estrutura(); rotear(); }
}
function estrutura() {
  const mods = MODS.filter(m => !m.p || m.p.includes(S.perfil));
  const grupos = [...new Set(mods.map(m => m.g))];
  const ini = (S.me.nome || S.me.email || '?').split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  $('#app').innerHTML = `<div class="app"><aside class="side"><div class="marca"><img src="${LOGO}" alt="NIEMAIA Serviços e Equipamentos"><small>Gestão de obras</small></div>
  <nav aria-label="Módulos">${grupos.map(g => `<div class="grp">${h(g)}</div>` + mods.filter(m => m.g === g).map(m => `<a href="#${m.id}" data-id="${m.id}"><i class="ti ti-${m.i}" aria-hidden="true"></i>${h(m.t)}</a>`).join('')).join('')}</nav>
  <div class="rod">NIEMAIA Construções · Sousa/PB</div></aside>
  <div class="main"><header class="top"><button class="menu-btn" aria-label="Menu"><i class="ti ti-menu-2"></i></button>
  <div class="obra"><span class="cod">${h(S.obra.codigo)}</span><select id="selObra" aria-label="Obra">${S.obras.map(o => `<option value="${o.id}" ${o.id === S.obra.id ? 'selected' : ''}>${h(o.codigo)} – ${h(o.nome)}</option>`).join('')}</select><span class="st">${badge(S.obra.status, L.status_obra)}</span></div>
  <span class="sp"></span><div class="user"><div class="av">${h(ini)}</div><div class="nm">${h(S.me.nome || S.me.email)}<small>${h(L.perfil[S.perfil] || '')}</small></div></div>
  <button id="btSenha" title="Alterar senha" aria-label="Alterar senha"><i class="ti ti-key"></i></button><button id="btSair" title="Sair"><i class="ti ti-logout"></i>Sair</button></header>
  <div id="pend"></div><main class="cont" id="cont"></main></div><div class="scrim"></div>
  <nav class="bnav" aria-label="Atalhos">${['painel', 'rdo', 'producaomes', 'equipamentos', 'custos', 'pendinfo', 'orcamento', 'medicao'].map(id => mods.find(m => m.id === id)).filter(Boolean).slice(0, 4).map(m => `<a href="#${m.id}" data-id="${m.id}"><i class="ti ti-${m.i}"></i>${h({ painel: 'Painel', rdo: 'RDO', producaomes: 'Produção', equipamentos: 'Equipam.', custos: 'Custos', pendinfo: 'Pendências', orcamento: 'Orçamento', medicao: 'Medição' }[m.id])}</a>`).join('')}<button class="bmenu" aria-label="Todos os módulos"><i class="ti ti-menu-2"></i>Menu</button></nav></div>`;
  $('#selObra').onchange = e => trocarObra(e.target.value).catch(erro);
  $('#btSair').onclick = () => sb.auth.signOut();
  $('#btSenha').onclick = trocarSenha;
  $('.menu-btn').onclick = () => $('.side').classList.toggle('on');
  $('.side').onclick = e => { if (e.target.closest('a')) $('.side').classList.remove('on'); };
  $('.scrim').onclick = () => $('.side').classList.remove('on');
  $('.bmenu').onclick = () => $('.side').classList.add('on');
  mostrarPendentes();
}
async function rotear() {
  const id = (location.hash || '#painel').slice(1).split('-')[0];
  let m = MODS.find(x => x.id === id && (!x.p || x.p.includes(S.perfil)));
  if (!m) m = MODS[0];
  S.rota = m.id;
  $$('.side a, .bnav a').forEach(a => a.classList.toggle('at', a.dataset.id === m.id)); window.scrollTo(0, 0);
  S.charts.forEach(c => c.destroy()); S.charts = [];
  const cont = $('#cont'); cont.innerHTML = `<div class="pghead"><div class="t"><h1>${h(m.t)}</h1><p>${h(SUBT[m.id] || '')} · ${h(S.obra.codigo)} – ${h(S.obra.nome)}</p></div></div><div id="pg"><div class="vazio">Carregando…</div></div>`;
  const el = $('#pg');
  try { await m.f()(el); } catch (e) { erro(e); el.innerHTML = '<div class="vazio">Não foi possível carregar este módulo.</div>'; }
}

/* ---------- RDO offline ---------- */
function pendentes() { try { return JSON.parse(localStorage.getItem('niemaia_rdo_pend') || '[]'); } catch (e) { return []; } }
function setPendentes(a) { try { localStorage.setItem('niemaia_rdo_pend', JSON.stringify(a)); } catch (e) { } mostrarPendentes(); }
function mostrarPendentes() {
  const p = pendentes(), el = $('#pend'); if (!el) return;
  el.innerHTML = p.length ? `<div class="pend" style="margin:14px 28px 0">${p.length} RDO(s) salvos sem conexão neste aparelho (${p.map(x => x.obra_codigo + ' ' + dt(x.rdo.data)).join(', ')}).<button class="pri" id="btSync">Sincronizar agora</button></div>` : '';
  if (p.length) $('#btSync').onclick = sincronizarPendentes;
}
async function sincronizarPendentes() {
  const p = pendentes(); if (!p.length || !navigator.onLine) return;
  const resto = [];
  for (const x of p) { try { await salvarRdoPayload(x); toast(`RDO ${x.obra_codigo} ${dt(x.rdo.data)} sincronizado`, 'ok'); } catch (e) { if (String(e.message).includes('fetch')) resto.push(x); else { erro(e); resto.push(x); } } }
  setPendentes(resto);
}
window.addEventListener('online', sincronizarPendentes);
async function salvarRdoPayload(p) {
  let id = p.rdo.id; const dados = { ...p.rdo }; delete dados.id;
  if (id) await q(sb.from('rdo').update(dados).eq('id', id));
  else { const r = await q(sb.from('rdo').insert(dados).select('id').single()); id = r.id; }
  for (const [t, arr] of [['rdo_servicos', p.servicos], ['rdo_efetivo', p.efetivo], ['rdo_equipamentos', p.equips]]) {
    await q(sb.from(t).delete().eq('rdo_id', id));
    if (arr.length) await q(sb.from(t).insert(arr.map(x => ({ ...x, rdo_id: id, obra_id: dados.obra_id }))));
  }
  return id;
}

sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { S.user = null; telaLogin(); } if (ev === 'PASSWORD_RECOVERY') setTimeout(trocarSenha, 300); });
document.addEventListener('DOMContentLoaded', () => { if (!$('#toast')) document.body.insertAdjacentHTML('beforeend', '<div id="toast"></div>'); iniciar().catch(e => { erro(e); telaLogin(); }); });
