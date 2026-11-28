let uid = 0; const nid = () => 'id' + (++uid);
const OB = [{ id: 'o1', codigo: 'RUAS', nome: 'Pavimentação ruas', status: 'em_andamento', valor_contrato: 17951136.22, contratante: 'Prefeitura' }, { id: 'o2', codigo: 'POLO', nome: 'Polo Turístico de Sousa/PB', status: 'em_andamento', data_inicio: '2026-10-01', prazo_dias: 365, valor_contrato: 18618600.65 }, { id: 'o3', codigo: 'ALCA', nome: 'Alça Oeste', status: 'mobilizacao', valor_contrato: 5816118.25 }];
const DB = {
  perfis: [{ id: 'u1', nome: 'Nilo', email: 'n@x', admin: true, ativo: true }, { id: 'u2', nome: 'João Apontador', email: 'j@x', cargo: 'Apontador', admin: false, ativo: true }],
  obras: OB, usuarios_obras: [{ user_id: 'u2', obra_id: 'o1', perfil: 'apontador' }],
  orcamento_itens: [{ id: 'i1', obra_id: 'o1', ordem: 1, descricao: 'Concreto betuminoso usinado a quente (CBUQ)', unidade: 't', quantidade: 32280.11, preco_unitario: 234.77, tipo_area: null, ativo: true }, { id: 'i3', obra_id: 'o1', ordem: 3, codigo: '01.999.06', descricao: 'Material adicional (solo) de jazida', unidade: 'm³', quantidade: 42573.88, ativo: true }, { id: 'i2', obra_id: 'o1', ordem: 9, descricao: 'Meio-fio', unidade: 'm', quantidade: 27043.03, ativo: true }],
  eap_atividades: [{ id: 'e1', obra_id: 'o1', ordem: 1, nome: 'Drenagem', inicio_previsto: '2026-11-01', fim_previsto: '2026-12-20', percentual_executado: 10, status: 'em_andamento' }, { id: 'e2', obra_id: 'o1', ordem: 2, nome: 'Marco', inicio_previsto: '2026-11-30', fim_previsto: '2026-11-30', status: 'marco' }],
  pendencias: [{ id: 'p1', obra_id: 'o1', codigo: 'R01', tipo: 'divergencia', descricao: 'x', status: 'aberta' }],
  memoria_calculo: [{ id: 'mc1', obra_id: 'o1', data: '2026-11-20', orcamento_item_id: 'i2', local: 'Rua A', est_ini_int: 0, est_ini_frac: 0, est_fim_int: 5, est_fim_frac: 10, lado: 'LE', comprimento: 110, quantidade: 110, formula: 'Est. 0+0 a 5+10: 110 m' }],
  producao_metas: [{ id: 'pm1', obra_id: 'o1', mes: '2026-11-01', orcamento_item_id: 'i2', meta_dia: 100, equipe: 'Meio-fio' }],
  meses_producao: [{ id: 'mp1', obra_id: 'o1', mes: '2026-11-01', feriados: ['2026-11-02','2026-11-15','2026-11-20'], sabado_produtivo: false }],
  abastecimentos: [{ id: 'ab0', obra_id: 'o1', data: '2026-11-21', equipamento_id: 'q1', horimetro: 480, litros: 60, combustivel: 'diesel_s10' }],
  rdo: [{ id: 'r1', obra_id: 'o1', data: '2026-11-20', status: 'enviado', condicao: 'praticavel' }],
  rdo_servicos: [{ id: 's1', rdo_id: 'r1', obra_id: 'o1', orcamento_item_id: 'i2', servico: 'Meio-fio', quantidade: 120, unidade: 'm', local: 'Rua A', rdo: { data: '2026-11-20', status: 'aprovado' } }],
  rdo_efetivo: [{ id: 'f1', rdo_id: 'r1', obra_id: 'o1', funcao: 'Servente', vinculo: 'proprio', quantidade: 8, horas: 8, rdo: { data: '2026-11-20' } }],
  rdo_equipamentos: [], fotos: [], producao_cbuq: [{ id: 'c1', obra_id: 'o1', data: '2026-11-21', local: 'Rua B', tipo_area: 'paralelepipedo', area: 1000, espessura: 0.05, densidade: 2.4, massa_teorica: 120, massa_balanca: 125, diferenca_t: 5, ligante: 'pintura_rr1c', taxa_ligante_prevista: 0.5, orcamento_item_id: 'i1' }],
  equipamentos: [{ id: 'q1', obra_id: 'o1', prefixo: 'RP-01', descricao: 'Rolo', status: 'manutencao', horimetro_atual: 500, proxima_manutencao_horimetro: 450 }, { id: 'pe0', obra_id: 'o2', prefixo: 'POLO-ESC-01', descricao: 'Escavadeira', status: 'operando' },{ id: 'pe1', obra_id: 'o2', prefixo: 'POLO-TE-01', descricao: 'Trator de esteira', status: 'operando' },{ id: 'pe2', obra_id: 'o2', prefixo: 'POLO-ROLO-01', descricao: 'Rolo compactador', status: 'operando' },{ id: 'pe3', obra_id: 'o2', prefixo: 'POLO-ROLO-02', descricao: 'Rolo compactador', status: 'operando' },{ id: 'pe4', obra_id: 'o2', prefixo: 'POLO-MN-01', descricao: 'Motoniveladora (patrol)', status: 'operando' },{ id: 'pe5', obra_id: 'o2', prefixo: 'POLO-CB-01', descricao: 'Caminhão caçamba', status: 'operando' },{ id: 'pe6', obra_id: 'o2', prefixo: 'POLO-CB-02', descricao: 'Caminhão caçamba', status: 'operando' },{ id: 'pe7', obra_id: 'o2', prefixo: 'POLO-CB-03', descricao: 'Caminhão caçamba', status: 'operando' },{ id: 'pe8', obra_id: 'o2', prefixo: 'POLO-CB-04', descricao: 'Caminhão caçamba', status: 'operando' },{ id: 'pe9', obra_id: 'o2', prefixo: 'POLO-CB-05', descricao: 'Caminhão caçamba', status: 'operando' },{ id: 'pe10', obra_id: 'o2', prefixo: 'POLO-CB-06', descricao: 'Caminhão caçamba', status: 'operando' },{ id: 'pe11', obra_id: 'o2', prefixo: 'POLO-PIPA-01', descricao: 'Caminhão-pipa', status: 'operando' },{ id: 'pe12', obra_id: 'o2', prefixo: 'POLO-PIPA-02', descricao: 'Caminhão-pipa', status: 'operando' },{ id: 'pe13', obra_id: 'o2', prefixo: 'POLO-CA-01', descricao: 'Caminhão de apoio', status: 'operando' },{ id: 'pe14', obra_id: 'o2', prefixo: 'POLO-MEL-01', descricao: 'Melosa', status: 'operando' },{ id: 'pe15', obra_id: 'o2', prefixo: 'POLO-TG-01', descricao: 'Trator com grade', status: 'operando' }],
  equipamentos_custo: [], manutencoes: [], funcionarios: [{ id: 'fu1', obra_id: 'o1', nome: 'Zé', funcao: 'Servente', ativo: true, epi_entregue: false, aso_validade: '2026-01-01' }],
  histograma_previsto: [{ id: 'h1', obra_id: 'o1', mes: '2026-11-01', funcao: 'Servente', quantidade: 10 }],
  custos: [{ id: 'k1', obra_id: 'o1', data: '2026-11-10', categoria: 'material', valor: 1000, orcamento_item_id: 'i2', descricao: 'x' }],
  materiais: [{ id: 'm1', obra_id: 'o1', nome: 'CAP', unidade: 't', estoque_minimo: 10 }], suprimentos_movimentos: [],
  medicoes: [{ id: 'md1', obra_id: 'o1', numero: 1, periodo_inicio: '2026-11-01', periodo_fim: '2026-11-30', status: 'rascunho' }],
  medicao_itens: [], diesel_precos: [], medicao_documentos: [{ id: 'd1', medicao_id: 'md1', obra_id: 'o1', ordem: 1, documento: 'Relatório resumo', entregue: false }],
  documentos_obra: [{ id: 'do1', obra_id: 'o1', ordem: 1, documento: 'ART', status: 'pendente' }],
  contatos: [{ id: 'ct1', obra_id: null, area: 'frota', nome: 'Josué', cargo: 'Encarregado de equipamentos', telefone: '83 99999-0000' }], certidoes: [{ id: 'ce1', tipo: 'INSS', validade: '2026-11-25' }], aditivos: [], auditoria: [{ id: 1, obra_id: 'o1', tabela: 'rdo', acao: 'INSERT', em: '2026-11-20T10:00:00Z', usuario: 'u1' }]
};
const view = t => {
  if (t === 'vw_itens_saldo') return DB.orcamento_itens.map(i => ({ ...i, qtd_contratada: i.quantidade, valor_contratado: (i.quantidade || 0) * (i.preco_unitario || 0), qtd_executada: 120, perc_executado: 1, qtd_medida_total: 0, qtd_saldo: i.quantidade, valor_medido_aprovado: 0 }));
  if (t === 'vw_eap_avanco') return DB.eap_atividades.map(a => ({ ...a, percentual: a.percentual_executado || 0, percentual_auto: a.orcamento_item_id ? 10 : null }));
  if (t === 'vw_custo_real') return [...DB.custos.map(c => ({ ...c, origem: 'lancamento' })), ...DB.abastecimentos.map(a => ({ obra_id: a.obra_id, data: a.data, categoria: 'combustivel', origem: 'abastecimento', valor: a.valor || 0 }))];
  if (t === 'vw_obra_resumo') return OB.map(o => ({ obra_id: o.id, codigo: o.codigo, contrato_atualizado: o.valor_contrato || 0, valor_itens: o.id === 'o1' ? 17951372.14 : null, fisico_pct: o.id === 'o1' ? 1.5 : null, fisico_eap: 5, previsto_eap: o.id === 'o1' ? 12 : null, medido_aprovado: 0, financeiro_pct: 0, saldo_contrato: o.valor_contrato || 0, prazo_atualizado: o.prazo_dias || null, dias_decorridos: o.data_inicio ? 57 : null, prazo_pct: o.data_inicio ? 15.6 : null, termino_previsto: o.data_inicio ? '2027-10-01' : null, custo_real: 1000, custo_lancado: 1000, custo_equip: 0, custo_diesel: 0, valor_executado: 0 }));
  if (t === 'vw_diesel') return DB.abastecimentos.map(a => { const e = DB.equipamentos.find(q => q.id === a.equipamento_id) || {}; const pr = (DB.diesel_precos || []).filter(p => p.obra_id === a.obra_id && p.vigencia <= a.data).sort((x, y) => x.vigencia < y.vigencia ? 1 : -1)[0]; return { obra_id: a.obra_id, data: a.data, equipamento_id: a.equipamento_id, prefixo: e.prefixo, descricao: e.descricao, litros: a.litros, valor: a.valor || (pr ? a.litros * pr.preco_litro : null), horas: null }; });
  if (t === 'vw_estoque') return DB.materiais.map(m => ({ ...m, saldo: 2, em_pedido: 0 }));
  return DB[t];
};
function builder(t) {
  let rows = null, op = 'select', payload = null, filt = [], single = false, sel = '';
  const b = {
    select(s) { sel = s || ''; return b; }, eq(k, v) { filt.push([k, '=', v]); return b; }, gte(k, v) { filt.push([k, '>=', v]); return b; }, lte(k, v) { filt.push([k, '<=', v]); return b; }, lt(k, v) { filt.push([k, '<', v]); return b; },
    in(k, v) { filt.push([k, 'in', v]); return b; }, is(k, v) { filt.push([k, 'is', v]); return b; }, neq(k, v) { filt.push([k, '!=', v]); return b; }, order() { return b; }, not() { return b; }, limit() { return b; }, single() { single = true; return b; }, maybeSingle() { single = true; return b; }, or() { return b; },
    insert(p) { op = 'insert'; payload = p; return b; }, update(p) { op = 'update'; payload = p; return b; }, delete() { op = 'delete'; return b; }, upsert(p) { op = 'insert'; payload = p; return b; },
    then(ok, no) {
      try {
        if (!DB[t] && !t.startsWith('vw_')) throw new Error('tabela inexistente ' + t);
        const pass = r => filt.every(([k, o, v]) => k.includes('.') || (o === 'in' ? v.includes(r[k]) : o === 'is' ? (r[k] ?? null) === v : o === '!=' ? r[k] !== v : o === '=' ? r[k] === v : o === '>=' ? r[k] >= v : o === '<=' ? r[k] <= v : r[k] < v));
        let data;
        if (op === 'select') data = (view(t) || []).filter(pass).map(r => ({ ...r, med: { numero: 1 }, eq: { prefixo: 'RP-01', descricao: 'Rolo' }, rdo: r.rdo || { data: '2026-11-20', status: 'aprovado' } }));
        else if (op === 'insert') { const arr = (Array.isArray(payload) ? payload : [payload]).map(p => ({ id: nid(), ...p })); DB[t].push(...arr); data = arr; if (t === 'rdo') arr.forEach(a => a.status = a.status || 'rascunho'); }
        else if (op === 'update') { data = DB[t].filter(pass); data.forEach(r => Object.assign(r, payload)); }
        else { DB[t] = DB[t].filter(r => !pass(r)); data = []; }
        if (single) data = data[0] || null;
        ok({ data, error: null });
      } catch (e) { ok({ data: null, error: e }); }
    }
  };
  return b;
}
const FN=[];
const mock = {
  functions: { invoke: async (n, o) => { FN.push(o.body); return { data: { ok: true }, error: null }; } },
  from: builder, rpc: async () => ({ data: 'admin', error: null }),
  auth: { resetPasswordForEmail: async () => ({ data: {}, error: null }), signInWithPassword: async () => ({ data: {}, error: null }), getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }), onAuthStateChange() { }, signOut: async () => ({}) },
  storage: { from: () => ({ createSignedUrls: async (p) => ({ data: p.map(x => ({ signedUrl: 'x' })), error: null }), createSignedUrl: async () => ({ data: { signedUrl: 'x' }, error: null }), upload: async () => ({ data: {}, error: null }), remove: async () => ({ data: {}, error: null }) }) }
};

window.supabase={createClient:()=>mock}; window.XLSX={utils:{}}; window.jspdf={jsPDF:function(){}}; window.__DB=DB;
