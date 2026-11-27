# NIEMAIA – Gestão de Obras

Site estático (GitHub Pages) + Supabase. Obras: RUAS, ALÇA, POLO.

- `src/` – fontes: `template.html`, `app.css` e módulos JS (`core.js`, `pages1..6.js`).
- `build.py` – gera o `index.html` publicado (`python3 build.py`). Nunca edite o `index.html` à mão.
- `tests/fluxos.py` – percorre todos os módulos das 3 obras (desktop e celular) com banco simulado (`tests/mock.js`) e testa criar/editar em Custos. Requer `pip install playwright`.
- `sql/` – migrações do banco, em ordem.
