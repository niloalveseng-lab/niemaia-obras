#!/usr/bin/env python3
"""Gera index.html a partir de src/: template.html + app.css + módulos JS (ordem abaixo)."""
import pathlib, subprocess, sys
R = pathlib.Path(__file__).parent
JS = ['core.js', 'pages1.js', 'pages2.js', 'pages3.js', 'pages4.js', 'pages5.js', 'pages6.js']
def main():
    t = (R / 'src/template.html').read_text(encoding='utf-8')
    for f in JS:  # checagem de sintaxe quando houver node
        try: subprocess.run(['node', '--check', str(R / 'src' / f)], check=True, capture_output=True)
        except FileNotFoundError: break
        except subprocess.CalledProcessError as e: sys.exit(f'Erro de sintaxe em {f}:\n{e.stderr.decode()}')
    css = (R / 'src/app.css').read_text(encoding='utf-8')
    js = ''.join((R / 'src' / f).read_text(encoding='utf-8') + '\n' for f in JS)
    out = t.replace('/*@APP_CSS@*/', css).replace('//@APP_JS@\n', js)
    (R / 'index.html').write_text(out, encoding='utf-8')
    print(f'index.html gerado ({len(out)//1024} KB)')
if __name__ == '__main__': main()
