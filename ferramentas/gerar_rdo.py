#!/usr/bin/env python3
"""
NIEMAIA – gerador do RDO (Diário de Obra) em Word · v2 (28/11/2026)
Uso:  python3 gerar_rdo.py rdo.json [saida.docx] [--logo NIEMAIA_logo_transparente.png]

Layout limpo: cabeçalho com logo, resumo do dia em números, serviços em lista objetiva
com os valores, efetivo em uma linha por vínculo, equipamentos só com as colunas que têm
dado, ocorrências, registro fotográfico 2 por linha com TODAS as fotos na mesma proporção
(4:3) e descrição curta, assinaturas no fim.

Os dados completos vão num bloco interno do .docx (customXml, urn:niemaia:rdo:v1), que o
sistema de gestão lê na importação (Diário de Obra → Importar RDO).
Requer: python-docx e Pillow (pip install python-docx pillow --break-system-packages)
"""
import json, sys, os, re, io, base64, zipfile, datetime, shutil
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from PIL import Image, ImageOps

LAR = RGBColor(0xF9, 0x54, 0x14); GRAF = RGBColor(0x26, 0x27, 0x2B); CINZA = RGBColor(0x6A, 0x6E, 0x77); TXT = RGBColor(0x1D, 0x1F, 0x23)
NOMES = {'RUAS': 'Pavimentação asfáltica de diversas ruas – Sousa/PB', 'ALCA': 'Alça Oeste – Sousa/PB', 'POLO': 'Polo Turístico de Sousa/PB'}
COD = {'RUAS': 'RUAS', 'ALCA': 'ALÇA', 'POLO': 'POLO'}
DIAS = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo']
AP = '[a preencher]'
LARG = 18.0                 # largura útil (cm)
FOTO_W, PROP = 8.75, 3 / 4  # foto 8,75 × 6,56 cm: todas na proporção 4:3
avisos = []

def f(v):
    if v in (None, ''): return None
    if isinstance(v, (int, float)): return float(v)
    s = str(v).strip()
    if re.search(r'[a-zA-Z\[]', s): return None
    s = s.replace('.', '').replace(',', '.') if ',' in s else s
    try: return float(s)
    except ValueError: return None

def br(v, casas=None):
    if v is None: return ''
    v = float(v)
    if casas is None: casas = 0 if v.is_integer() else 2
    return f'{v:,.{casas}f}'.replace(',', 'X').replace('.', ',').replace('X', '.')

def unid(u):
    u = (u or '').strip(); k = u.lower().replace('.', '')
    return {'m2': 'm²', 'm3': 'm³', 'tkm': 't.km'}.get(k, u)

def run(p, t, b=False, tam=10, cor=None, it=False, esp=None):
    r = p.add_run(t); r.bold = b; r.italic = it; r.font.size = Pt(tam); r.font.color.rgb = cor or TXT
    if esp is not None:
        sp = OxmlElement('w:spacing'); sp.set(qn('w:val'), str(esp)); r._r.get_or_add_rPr().append(sp)
    return r

def par(doc, antes=0, depois=0, kwn=False):
    p = doc.add_paragraph(); pf = p.paragraph_format
    pf.space_before = Pt(antes); pf.space_after = Pt(depois); pf.line_spacing = 1.15
    if kwn: pf.keep_with_next = True
    return p

def borda_inf(p, cor='F95414', esp=8):
    b = OxmlElement('w:pBdr'); x = OxmlElement('w:bottom')
    for k, v in (('val', 'single'), ('sz', str(esp)), ('space', '4'), ('color', cor)): x.set(qn('w:' + k), v)
    b.append(x); p._p.get_or_add_pPr().append(b)

def titulo(doc, n, t):
    p = par(doc, 16, 6, kwn=True)
    run(p, f'{n:02d}   ', True, 9, LAR, esp=20); run(p, t.upper(), True, 9, GRAF, esp=30)
    borda_inf(p, 'D9DCE1', 4)

def sem_bordas(t):
    b = OxmlElement('w:tblBorders')
    for lado in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        e = OxmlElement(f'w:{lado}'); e.set(qn('w:val'), 'nil'); b.append(e)
    t._tbl.tblPr.append(b)

def larguras(t, larg):
    t.autofit = False
    for i, gc in enumerate(t._tbl.tblGrid.findall(qn('w:gridCol'))):
        if i < len(larg): gc.set(qn('w:w'), str(int(Cm(larg[i]).twips)))
    for row in t.rows:
        for i, tc in enumerate(row._tr.tc_lst):
            w = tc.get_or_add_tcPr().get_or_add_tcW(); w.type = 'dxa'; w.w = int(Cm(larg[min(i, len(larg) - 1)]).twips)

def sombra(cel, cor):
    s = OxmlElement('w:shd'); s.set(qn('w:val'), 'clear'); s.set(qn('w:color'), 'auto'); s.set(qn('w:fill'), cor); cel._tc.get_or_add_tcPr().append(s)

def margem_cel(cel, cm=0.15):
    m = OxmlElement('w:tcMar')
    for lado in ('top', 'left', 'bottom', 'right'):
        e = OxmlElement(f'w:{lado}'); e.set(qn('w:w'), str(int(Cm(cm).twips))); e.set(qn('w:type'), 'dxa'); m.append(e)
    cel._tc.get_or_add_tcPr().append(m)

def nao_quebra(t):
    for row in t.rows: row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))

def campo(p, instr):
    for tipo, txt in (('begin', None), (None, instr), ('end', None)):
        r = p.add_run(); r.font.size = Pt(8); r.font.color.rgb = CINZA
        if tipo: e = OxmlElement('w:fldChar'); e.set(qn('w:fldCharType'), tipo)
        else: e = OxmlElement('w:instrText'); e.set(qn('xml:space'), 'preserve'); e.text = txt
        r._r.append(e)

def foto_43(caminho):
    """todas as fotos em 4:3; retrato perde o topo e mantém a base, onde fica a marca d'água Timemark"""
    im = ImageOps.exif_transpose(Image.open(caminho)).convert('RGB')
    w, h = im.size; alvo = 4 / 3
    if w / h > alvo: nw = int(h * alvo); x = (w - nw) // 2; im = im.crop((x, 0, x + nw, h))
    else: nh = int(w / alvo); im = im.crop((0, h - nh, w, h))
    im.thumbnail((1600, 1200), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=84, optimize=True); b.seek(0)
    return b

def embutir_dados(caminho_docx, dados):
    js = base64.b64encode(json.dumps(dados, ensure_ascii=False).encode('utf-8')).decode()
    item = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<rdo xmlns="urn:niemaia:rdo:v1" codificacao="base64">{js}</rdo>'
    props = ('<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<ds:datastoreItem ds:itemID="{6E1A3F2B-9C4D-4B7A-8F11-4E494D414941}" '
             'xmlns:ds="http://schemas.openxmlformats.org/officeDocument/2006/customXml"><ds:schemaRefs><ds:schemaRef ds:uri="urn:niemaia:rdo:v1"/></ds:schemaRefs></ds:datastoreItem>')
    tmp = caminho_docx + '.tmp'
    with zipfile.ZipFile(caminho_docx) as zi:
        usados = [int(m.group(1)) for m in (re.match(r'customXml/item(\d+)\.xml$', x) for x in zi.namelist()) if m]
    k = max(usados, default=0) + 1
    with zipfile.ZipFile(caminho_docx) as zi, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zo:
        for it in zi.infolist():
            d = zi.read(it.filename)
            if it.filename == '[Content_Types].xml':
                d = d.decode().replace('</Types>', f'<Override PartName="/customXml/itemProps{k}.xml" ContentType="application/vnd.openxmlformats-officedocument.customXmlProperties+xml"/></Types>').encode()
            elif it.filename == 'word/_rels/document.xml.rels':
                d = d.decode().replace('</Relationships>', f'<Relationship Id="rIdNiemaiaRdo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml" Target="../customXml/item{k}.xml"/></Relationships>').encode()
            zo.writestr(it, d)
        zo.writestr(f'customXml/item{k}.xml', item)
        zo.writestr(f'customXml/itemProps{k}.xml', props)
        zo.writestr(f'customXml/_rels/item{k}.xml.rels', f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXmlProps" Target="itemProps{k}.xml"/></Relationships>')
    shutil.move(tmp, caminho_docx)

def gerar(d, saida=None, logo=None):
    obra = d['obra'].upper().replace('Ç', 'C')
    data = datetime.date.fromisoformat(d['data'])
    nro = str(d.get('numero')).zfill(3) if str(d.get('numero', '')).isdigit() else (d.get('numero') or AP)
    doc = Document(); s = doc.sections[0]
    s.page_width, s.page_height = Cm(21), Cm(29.7)
    s.left_margin = s.right_margin = Cm(1.5); s.top_margin = Cm(1.3); s.bottom_margin = Cm(1.5); s.footer_distance = Cm(0.7)
    st = doc.styles['Normal']; st.font.name = 'Arial'; st.font.size = Pt(10); st.element.rPr.rFonts.set(qn('w:eastAsia'), 'Arial')
    st.paragraph_format.space_after = Pt(0); st.paragraph_format.space_before = Pt(0)

    ft = s.footer.add_table(rows=1, cols=2, width=Cm(LARG)); sem_bordas(ft)
    a_, b_ = ft.rows[0].cells
    run(a_.paragraphs[0], f'NIEMAIA Construções Ltda · RDO {COD.get(obra, obra)} nº {nro} · {data.strftime("%d/%m/%Y")}', tam=8, cor=CINZA)
    fp = b_.paragraphs[0]; fp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run(fp, 'Página ', tam=8, cor=CINZA); campo(fp, 'PAGE'); run(fp, ' de ', tam=8, cor=CINZA); campo(fp, 'NUMPAGES')
    larguras(ft, [LARG * 0.7, LARG * 0.3])

    # cabeçalho
    t = doc.add_table(rows=1, cols=2); sem_bordas(t)
    c0, c1 = t.rows[0].cells; p = c0.paragraphs[0]
    if logo and os.path.exists(logo): p.add_run().add_picture(logo, width=Cm(3.0))
    else: run(p, 'NIEMAIA', True, 16, GRAF)
    p = c1.paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.RIGHT; run(p, 'DIÁRIO DE OBRA', True, 20, GRAF, esp=-10)
    p = c1.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.RIGHT; p.paragraph_format.space_before = Pt(2)
    run(p, f'RDO nº {nro}', True, 11, LAR); run(p, f'   ·   {data.strftime("%d/%m/%Y")}, {DIAS[data.weekday()]}', False, 11, GRAF)
    p = c1.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run(p, f'{COD.get(obra, obra)} – {d.get("obra_nome") or NOMES.get(obra, obra)}', False, 9.5, CINZA)
    larguras(t, [4.2, LARG - 4.2])
    p = par(doc, 6, 0); borda_inf(p, 'F95414', 12)

    # identificação (texto em duas colunas, sem grade)
    clima = d.get('clima') or {}
    def cl(k):
        c = clima.get(k) or {}; tx = c.get('tempo') or AP; cd = (c.get('condicao') or 'Praticável').strip()
        return tx + (f' ({cd.lower()})' if cd.lower() not in ('praticável', 'praticavel') else '')
    info = [('Contratante', d.get('contratante') or 'Prefeitura Municipal de Sousa – SEPLAN'), ('Contrato', d.get('contrato') or AP),
            ('Horário', f'{d.get("horario_inicio") or AP} às {d.get("horario_fim") or AP}'), ('Ordem de serviço', d.get('os') or AP),
            ('Clima', f'manhã {cl("manha")} · tarde {cl("tarde")}'), ('Resp. técnico', d.get('resp_tecnico') or AP)]
    t = doc.add_table(rows=3, cols=2); sem_bordas(t)
    for i, (k, v) in enumerate(info):
        p = t.rows[i // 2].cells[i % 2].paragraphs[0]; p.paragraph_format.space_before = Pt(5)
        run(p, k.upper() + '   ', True, 7.5, CINZA, esp=20); run(p, v, False, 9.5)
    larguras(t, [LARG / 2, LARG / 2])
    obs_clima = [f'Clima – {"manhã" if k == "manha" else "tarde"}: {(clima.get(k) or {}).get("obs")}' for k in ('manha', 'tarde') if (clima.get(k) or {}).get('obs')]

    # cálculos
    ef = d.get('efetivo') or []; eqs = d.get('equipamentos') or []
    tot_ef = sum(f(e.get('quantidade')) or 0 for e in ef)
    eq_calc, hm, diesel = [], 0.0, 0.0
    for e in eqs:
        hi, hf = f(e.get('horimetro_ini')), f(e.get('horimetro_fim')); hp = f(e.get('horas_produtivas'))
        if hp is None and hi is not None and hf is not None: hp = round(hf - hi, 1)
        if hi is not None and hf is not None and hf < hi: avisos.append(f"{e.get('prefixo')}: horímetro final menor que o inicial")
        if not e.get('prefixo'): avisos.append(f"Equipamento '{e.get('descricao')}' sem prefixo")
        hm += hp or 0; diesel += f(e.get('diesel_litros')) or 0
        eq_calc.append({**e, 'horas_produtivas': hp})
    operando = [e for e in eq_calc if (e['horas_produtivas'] or 0) > 0 or not re.search(r'parad|manuten|desmob|quebr', (e.get('motivo_parada') or '').lower())]
    sv_calc = []
    for x in d.get('servicos') or []:
        c_, l_, e_, q = f(x.get('comprimento')), f(x.get('largura')), f(x.get('espessura')), f(x.get('quantidade'))
        un = unid(x.get('unidade'))
        if q is None and c_ is not None:
            if un == 'm': q = c_
            elif un == 'm²' and l_ is not None: q = c_ * l_
            elif un == 'm³' and l_ is not None and e_ is not None: q = c_ * l_ * e_
            elif un == 't' and l_ is not None and e_ is not None: q = c_ * l_ * e_ * float(x.get('densidade', 2.40))
            if q is not None: q = round(q, 3)
        if q is None: avisos.append(f"Serviço '{x.get('servico')}' sem quantidade")
        if not x.get('item'): avisos.append(f"Serviço '{x.get('servico')}' sem item do orçamento (entra só no RDO)")
        sv_calc.append({**x, 'quantidade': q, 'unidade': un})

    # números do dia
    nums = [(br(tot_ef), 'profissionais no canteiro'), (f'{len(operando)}', f'equipamentos em operação (de {len(eq_calc)})' if len(operando) != len(eq_calc) else 'equipamentos em operação'),
            (br(hm, 1), 'horas-máquina') if hm else (f'{len(sv_calc)}', 'serviços executados'), (br(diesel), 'litros de diesel') if diesel else (f'{len(sv_calc)}' if hm else '–', 'serviços executados' if hm else 'litros de diesel')]
    p = par(doc, 10, 0)
    t = doc.add_table(rows=1, cols=4); sem_bordas(t)
    cs = OxmlElement('w:tblCellSpacing'); cs.set(qn('w:w'), str(int(Cm(0.08).twips))); cs.set(qn('w:type'), 'dxa'); t._tbl.tblPr.append(cs)
    for i, (n_, l) in enumerate(nums):
        cel = t.rows[0].cells[i]; sombra(cel, 'F4F5F7'); margem_cel(cel, 0.22)
        run(cel.paragraphs[0], n_, True, 16, GRAF); run(cel.add_paragraph(), l, False, 8, CINZA)
    larguras(t, [LARG / 4] * 4)

    n = 0
    # serviços: lista objetiva com os valores alinhados à direita
    n += 1; titulo(doc, n, 'Serviços executados')
    if not sv_calc: run(par(doc, 2, 0), 'Sem serviços de produção no dia.', it=True, cor=CINZA)
    for i, x in enumerate(sv_calc, 1):
        p = par(doc, 7, 0, kwn=True); pf = p.paragraph_format
        pf.tab_stops.add_tab_stop(Cm(LARG), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS); pf.left_indent = Cm(0.7); pf.first_line_indent = Cm(-0.7)
        pf.tab_stops.add_tab_stop(Cm(0.7))
        run(p, f'{i}.\t', True, 10, LAR); run(p, x.get('servico') or AP, True, 10.5)
        q = x['quantidade']
        run(p, '\t' + (f'{br(q)} {x["unidade"]}'.strip() if q is not None else AP), True, 10.5, GRAF)
        det = [x.get('local')]
        if x.get('estaca_ini'): det.append(f'Est. {x["estaca_ini"]}' + (f' a {x["estaca_fim"]}' if x.get('estaca_fim') else ''))
        if x.get('lado'): det.append(x['lado'])
        dims = [f'{br(f(x.get(k)))}' for k in ('comprimento', 'largura', 'espessura') if f(x.get(k)) is not None]
        if dims: det.append(' × '.join(dims) + ' m')
        if x.get('observacao'): det.append(x['observacao'])
        if x.get('retrabalho'): det.append('retrabalho')
        det = [v for v in det if v]
        p = par(doc, 1, 0); p.paragraph_format.left_indent = Cm(0.7)
        run(p, ' · '.join(det), False, 9, CINZA)
        if x.get('item'): run(p, ('   ' if det else '') + f'item {x["item"]}', False, 8, CINZA)

    # efetivo
    n += 1; titulo(doc, n, 'Efetivo')
    if not ef: run(par(doc, 2, 0), AP, it=True, cor=CINZA)
    grupos = {}
    for e in ef:
        if f(e.get('quantidade')) is None: avisos.append(f"Efetivo '{e.get('funcao')}' sem quantidade")
        grupos.setdefault((e.get('vinculo') or 'Próprio').strip().capitalize(), []).append(e)
    for v, es in grupos.items():
        p = par(doc, 3, 0); p.paragraph_format.left_indent = Cm(0.7); p.paragraph_format.first_line_indent = Cm(-0.7)
        run(p, f'{v}  ', True, 9.5, GRAF); run(p, f'{br(sum(f(e.get("quantidade")) or 0 for e in es))}   ', True, 9.5, LAR)
        run(p, ' · '.join(f'{e.get("funcao")} {br(f(e.get("quantidade")) or 0)}' + (f' ({e["observacao"]})' if e.get('observacao') else '') for e in es), False, 9.5)
    hs = {f(e.get('horas')) for e in ef if f(e.get('horas')) is not None}
    if ef: run(par(doc, 3, 0), f'Total no dia: {br(tot_ef)} profissionais' + (f' · jornada de {br(next(iter(hs)))} h' if len(hs) == 1 else '') + '.', False, 9, CINZA)

    # equipamentos: só as colunas que têm dado
    n += 1; titulo(doc, n, 'Equipamentos')
    if not eq_calc: run(par(doc, 2, 0), AP, it=True, cor=CINZA)
    else:
        opc = [('hor', 'Horímetro', 3.6), ('horas_produtivas', 'Horas', 1.4), ('diesel_litros', 'Diesel l', 2.0), ('motivo_parada', 'Situação', 0)]
        tem = {'hor': any(f(e.get('horimetro_ini')) is not None for e in eq_calc), 'horas_produtivas': any(e.get('horas_produtivas') is not None for e in eq_calc),
               'diesel_litros': any(f(e.get('diesel_litros')) is not None for e in eq_calc), 'motivo_parada': any((e.get('motivo_parada') or '').strip('—- ') for e in eq_calc)}
        cols = [('prefixo', 'Prefixo', 2.7), ('descricao', 'Equipamento', 4.0)] + [c for c in opc if tem[c[0]]]
        resto = LARG - sum(c[2] for c in cols); cols = [(k, l, w or max(resto, 3.0)) for k, l, w in cols]
        if resto > 0 and not tem['motivo_parada']: cols[1] = (cols[1][0], cols[1][1], cols[1][2] + resto)
        num = ('hor', 'horas_produtivas', 'diesel_litros')
        t = doc.add_table(rows=1, cols=len(cols)); sem_bordas(t)
        for i, (k, l, w) in enumerate(cols):
            p = t.rows[0].cells[i].paragraphs[0]; run(p, l.upper(), True, 7.5, CINZA, esp=20); borda_inf(p, 'D9DCE1', 4); p.paragraph_format.space_after = Pt(2)
            if k in num: p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        for e in eq_calc:
            cs_ = t.add_row().cells
            for i, (k, l, w) in enumerate(cols):
                p = cs_[i].paragraphs[0]; p.paragraph_format.space_before = Pt(3)
                if k == 'hor':
                    hi, hf = f(e.get('horimetro_ini')), f(e.get('horimetro_fim'))
                    v = f'{br(hi, 1)} → {br(hf, 1)}' if hi is not None and hf is not None else br(hi, 1)
                elif k == 'horas_produtivas': v = br(e['horas_produtivas'], 1) if e['horas_produtivas'] is not None else ''
                elif k == 'diesel_litros': v = br(f(e.get('diesel_litros')))
                elif k == 'motivo_parada': v = (e.get('motivo_parada') or '').strip('—- ')
                else: v = e.get(k) or (AP if k == 'prefixo' else '')
                run(p, v, k == 'prefixo', 9, GRAF if k == 'prefixo' else TXT)
                if k in num: p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        larguras(t, [c[2] for c in cols]); nao_quebra(t)
        t.rows[0]._tr.get_or_add_trPr().append(OxmlElement('w:tblHeader'))  # repete o cabeçalho se a tabela passar de página

    # ocorrências
    oc = d.get('ocorrencias') or []
    oc = ([oc] if isinstance(oc, str) else list(oc)) + obs_clima
    n += 1; titulo(doc, n, 'Ocorrências')
    if not oc: run(par(doc, 2, 0), 'Sem ocorrências no dia.', it=True, cor=CINZA)
    for o in oc:
        p = par(doc, 3, 0); p.paragraph_format.left_indent = Cm(0.45); p.paragraph_format.first_line_indent = Cm(-0.45)
        run(p, '–  ', True, 10, LAR); run(p, str(o), tam=9.5)
    ofs = d.get('observacoes_fiscal') or []
    ofs = [ofs] if isinstance(ofs, str) else list(ofs)
    if ofs:
        n += 1; titulo(doc, n, 'Observações da fiscalização')
        for o in ofs: run(par(doc, 3, 0), str(o), tam=9.5)

    # registro fotográfico: 2 por linha, todas 4:3, descrição curta
    fs = d.get('fotos') or []; fotos_meta = []
    if fs:
        n += 1; titulo(doc, n, 'Registro fotográfico')
        t = doc.add_table(rows=0, cols=2); sem_bordas(t)
        for i in range(0, len(fs), 2):
            cs_ = t.add_row().cells
            for j, ft in enumerate(fs[i:i + 2]):
                cel = cs_[j]; margem_cel(cel, 0.12); p = cel.paragraphs[0]; p.paragraph_format.space_before = Pt(6)
                if ft.get('arquivo') and os.path.exists(ft['arquivo']):
                    ins = p.add_run().add_picture(foto_43(ft['arquivo']), width=Cm(FOTO_W), height=Cm(FOTO_W * PROP))
                    ins._inline.docPr.set('descr', f'foto-{len(fotos_meta) + 1}')
                else:
                    avisos.append(f"Foto não encontrada: {ft.get('arquivo')}"); run(p, '[foto não encontrada]', it=True, cor=CINZA)
                desc = ft.get('descricao') or ft.get('legenda') or ' – '.join(v for v in [ft.get('servico'), ft.get('local'), ft.get('lado')] if v) or AP
                p = cel.add_paragraph(); p.paragraph_format.space_before = Pt(3); p.paragraph_format.space_after = Pt(0); run(p, desc, True, 8.5)
                info = ' · '.join(v for v in [ft.get('data_hora'), f"{ft['lat']}, {ft['lon']}" if ft.get('lat') is not None and ft.get('lon') is not None else None] if v)
                if info: p = cel.add_paragraph(); p.paragraph_format.space_before = Pt(0); p.paragraph_format.space_after = Pt(4); run(p, info, False, 7.5, CINZA)
                fotos_meta.append({'legenda': desc, **{k: ft.get(k) for k in ('servico', 'local', 'lado', 'data_hora', 'lat', 'lon')}})
        larguras(t, [LARG / 2, LARG / 2]); nao_quebra(t)

    # assinaturas, sempre juntas
    asn = d.get('assinaturas') or [{'nome': 'Nilo Alves da Costa Neto', 'cargo': 'Auxiliar de engenharia – NIEMAIA'}, {'nome': 'Eng. Yago Dias', 'cargo': 'Gestor do contrato – NIEMAIA'}, {'nome': AP, 'cargo': 'Fiscalização – Prefeitura de Sousa'}]
    par(doc, 20, 0, kwn=True)
    t = doc.add_table(rows=1, cols=len(asn)); sem_bordas(t)
    for i, a_ in enumerate(asn):
        cel = t.rows[0].cells[i]; margem_cel(cel, 0.3)
        p = cel.paragraphs[0]; p.paragraph_format.space_before = Pt(28); borda_inf(p, '26272B', 4)
        p = cel.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; run(p, a_.get('nome') or AP, True, 8.5)
        p = cel.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; run(p, a_.get('cargo') or '', False, 7.5, CINZA)
    larguras(t, [LARG / len(asn)] * len(asn)); nao_quebra(t)

    saida = saida or f"{obra}_RDO_{nro}_{data.isoformat()}.docx"
    doc.save(saida)
    embutir_dados(saida, {'versao': 2, 'obra': obra, 'numero': nro, 'data': d['data'], 'horario_inicio': d.get('horario_inicio'), 'horario_fim': d.get('horario_fim'),
        'clima': clima, 'efetivo': ef,
        'equipamentos': [{k: e.get(k) for k in ('prefixo', 'descricao', 'horimetro_ini', 'horimetro_fim', 'horas_produtivas', 'horas_improdutivas', 'horas_paradas', 'motivo_parada', 'diesel_litros')} for e in eq_calc],
        'servicos': [{k: x.get(k) for k in ('item', 'servico', 'local', 'estaca_ini', 'estaca_fim', 'lado', 'comprimento', 'largura', 'espessura', 'quantidade', 'unidade', 'retrabalho', 'observacao')} for x in sv_calc],
        'ocorrencias': oc, 'observacoes_fiscal': ofs, 'fotos': fotos_meta})
    return saida

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    logo = sys.argv[sys.argv.index('--logo') + 1] if '--logo' in sys.argv else None
    if logo in args: args.remove(logo)
    d = json.load(open(args[0], encoding='utf-8'))
    lista = d if isinstance(d, list) else d.get('rdos', [d])
    for r in lista:
        if isinstance(d, dict) and 'rdos' in d: r.setdefault('obra', d.get('obra'))
        avisos.clear(); out = gerar(r, args[1] if len(args) > 1 and len(lista) == 1 else None, logo)
        print('OK', out)
        for a in avisos: print('  AVISO:', a)
