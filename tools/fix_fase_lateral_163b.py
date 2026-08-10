from pathlib import Path


def rep(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Ancora nao encontrada: {label}")
    return text.replace(old, new, 1)

app_path = Path('app.js')
app = app_path.read_text(encoding='utf-8')

app = rep(
    app,
    'window.adicionarFaseSugestao = adicionarFaseSugestao;\nwindow.adicionarFaccaoSugestao = adicionarFaccaoSugestao;',
    'window.adicionarFaseSugestao = adicionarFaseSugestao;\nwindow.adicionarFaseLateralSugestao = adicionarFaseLateralSugestao;\nwindow.adicionarFaccaoSugestao = adicionarFaccaoSugestao;',
    'exportar botao mais lateral'
)

# Ao bipar, a Fase Lateral digitada na tela acompanha a Fase Bojo mesmo sem salvar antes.
app = rep(
    app,
    '  const faseAtual = limparTexto(valorLinhaManejo(ordem, "fase")).toUpperCase() || manejoExistente.fase || "";\n\n  if (!faseAtual) {',
    '  const faseAtual = limparTexto(valorLinhaManejo(ordem, "fase")).toUpperCase() || manejoExistente.fase || "";\n  const faseLateralAtual = setor === "sutia"\n    ? (limparTexto(valorLinhaManejo(ordem, "faseLateral")).toUpperCase() || manejoExistente.faseLateral || "")\n    : (manejoExistente.faseLateral || "");\n\n  if (!faseAtual) {',
    'captura lateral ao bipar'
)

bipar_pos = app.find('async function biparManejoLinha')
idx = app.find('    fase: faseAtual,\n    faccao:', bipar_pos)
if bipar_pos < 0 or idx < 0:
    raise SystemExit('Objeto bipar nao encontrado')
app = app[:idx] + '    fase: faseAtual,\n    faseLateral: faseLateralAtual,\n    faccao:' + app[idx + len('    fase: faseAtual,\n    faccao:'):]

# Antes de movimentar para faccao/celula, preserva tambem o valor lateral digitado.
app = rep(
    app,
    '  const faseLinha = limparTexto(valorLinhaManejo(op, "fase")).toUpperCase();\n  const fase = faseLinha || manejoExistente.fase || "PRONTO PARA MOVIMENTAR";\n\n  const manejo = {',
    '  const faseLinha = limparTexto(valorLinhaManejo(op, "fase")).toUpperCase();\n  const fase = faseLinha || manejoExistente.fase || "PRONTO PARA MOVIMENTAR";\n  const faseLateral = setor === "sutia"\n    ? (limparTexto(valorLinhaManejo(op, "faseLateral")).toUpperCase() || manejoExistente.faseLateral || "")\n    : (manejoExistente.faseLateral || "");\n\n  const manejo = {',
    'captura lateral antes de movimentar'
)

mov_pos = app.find('async function salvarSilkETecidoAntesDeMovimentar')
idx = app.find('    fase,\n    faccao:', mov_pos)
if mov_pos < 0 or idx < 0:
    raise SystemExit('Objeto movimentar nao encontrado')
app = app[:idx] + '    fase,\n    faseLateral,\n    faccao:' + app[idx + len('    fase,\n    faccao:'):]

app_path.write_text(app, encoding='utf-8')

index_path = Path('index.html')
html = index_path.read_text(encoding='utf-8')
html = html.replace('style.css?v=2026-07-30-rastreamento-enviar-manejo-17', 'style.css?v=2026-08-10-teste-fase-lateral-163b')
html = html.replace('app.js?v=2026-07-30-rastreamento-enviar-manejo-17', 'app.js?v=2026-08-10-teste-fase-lateral-163b')
index_path.write_text(html, encoding='utf-8')

release_path = Path('corponu-release.json')
release = release_path.read_text(encoding='utf-8')
release = release.replace('2026-08-10-teste-manejo-fase-lateral-integrada-163', '2026-08-10-teste-manejo-fase-lateral-integrada-163b')
release = release.replace('2026-08-10T13:15:00-03:00', '2026-08-10T13:20:00-03:00')
release_path.write_text(release, encoding='utf-8')
