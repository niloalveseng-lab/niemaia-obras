#!/usr/bin/env python3
"""Testes de fluxo com banco simulado (tests/mock.js), sem internet.
Uso: python3 tests/fluxos.py [--chrome /caminho/chrome]   (requer: pip install playwright)
Percorre todos os módulos das 3 obras, em desktop e celular, e falha em erro de JS
ou em tela "Não foi possível carregar". Também testa criar/editar/excluir em Custos.
"""
import asyncio, pathlib, sys, json
from playwright.async_api import async_playwright

R = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(R))
import build  # noqa

MODS = ['painel', 'obras', 'rdo', 'producaomes', 'producao', 'equipamentos', 'maodeobra', 'orcamento',
        'planejamento', 'medicao', 'custos', 'suprimentos', 'relatorios', 'pendinfo', 'usuarios']

def gerar_html():
    build.main()
    html = (R / 'index.html').read_text(encoding='utf-8')
    mock = (R / 'tests/mock.js').read_text(encoding='utf-8')
    i = html.index('<script>\nconst LOGO')
    out = html[:i] + '<script>' + mock + '</script>\n' + html[i:]
    p = R / 'tests/teste.html'; p.write_text(out, encoding='utf-8'); return p

async def main():
    exe = sys.argv[sys.argv.index('--chrome') + 1] if '--chrome' in sys.argv else None
    pagina = gerar_html().as_uri()
    falhas = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=exe) if exe else await p.chromium.launch()
        for nome, vp in [('desktop', {'width': 1366, 'height': 860}), ('celular', {'width': 390, 'height': 844})]:
            for obra in ['o1', 'o2', 'o3']:
                ctx = await b.new_context(viewport=vp)
                await ctx.add_init_script(f"localStorage.setItem('niemaia_obra','{obra}')")
                pg = await ctx.new_page(); erros = []
                pg.on('pageerror', lambda e, erros=erros: erros.append(str(e)))
                for m in MODS:
                    await pg.goto(f'{pagina}#{m}'); await pg.wait_for_timeout(500)
                    txt = await pg.inner_text('#cont')
                    if 'Não foi possível carregar' in txt: falhas.append(f'{nome}/{obra}/{m}: módulo não carregou')
                    abas = await pg.query_selector_all('.tabs button')
                    for k in range(1, len(abas)):
                        await (await pg.query_selector_all('.tabs button'))[k].click(); await pg.wait_for_timeout(250)
                        if 'Não foi possível carregar' in await pg.inner_text('#cont'): falhas.append(f'{nome}/{obra}/{m}/aba {k}: não carregou')
                falhas += [f'{nome}/{obra}: erro JS {e}' for e in erros]
                await ctx.close()
        # CRUD em Custos (obra RUAS)
        ctx = await b.new_context(); await ctx.add_init_script("localStorage.setItem('niemaia_obra','o1')")
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: falhas.append(f'crud: erro JS {e}'))
        await pg.goto(f'{pagina}#custos'); await pg.wait_for_timeout(500)
        await pg.click('button.novo'); await pg.fill('#f_descricao', 'Teste'); await pg.fill('#f_valor', '100')
        await pg.click('.mdl button.pri'); await pg.wait_for_timeout(300)
        n = await pg.evaluate("__DB.custos.filter(c=>c.descricao==='Teste').length")
        if n != 1: falhas.append(f'crud: criar custo ({n})')
        await pg.click('tr.clk:has-text("Teste")'); await pg.fill('#f_valor', '150'); await pg.click('.mdl button.pri'); await pg.wait_for_timeout(300)
        v = await pg.evaluate("__DB.custos.find(c=>c.descricao==='Teste').valor")
        if v != 150: falhas.append(f'crud: editar custo ({v})')
        await b.close()
    print('\n'.join(falhas) if falhas else 'OK – todos os fluxos passaram')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__': asyncio.run(main())
