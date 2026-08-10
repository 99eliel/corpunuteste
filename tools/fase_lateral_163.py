from pathlib import Path
import json
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Ancora nao encontrada: {label}")
    return text.replace(old, new, 1)


app_path = Path("app.js")
app = app_path.read_text(encoding="utf-8")

app = replace_once(
    app,
    "  fasesManejoExtras: [],\n  faccoesManejoExtras: [],",
    "  fasesManejoExtras: [],\n  fasesLateraisManejoExtras: [],\n  faccoesManejoExtras: [],",
    "state fases laterais",
)

app = replace_once(
    app,
    '  state.fasesManejoExtras = carregarListaLocalManejo("fasesManejoExtras");\n  state.faccoesManejoExtras = carregarListaLocalManejo("faccoesManejoExtras");',
    '  state.fasesManejoExtras = carregarListaLocalManejo("fasesManejoExtras");\n  state.fasesLateraisManejoExtras = carregarListaLocalManejo("fasesLateraisManejoExtras");\n  state.faccoesManejoExtras = carregarListaLocalManejo("faccoesManejoExtras");',
    "carregar sugestoes lateral",
)

app = replace_once(
    app,
    'function adicionarFaseSugestao(ordemId) {\n  adicionarSugestaoManejo(ordemId, "fase", "fasesManejoExtras", "fasesManejoExtras", "Fase");\n}\n',
    'function adicionarFaseSugestao(ordemId) {\n  adicionarSugestaoManejo(ordemId, "fase", "fasesManejoExtras", "fasesManejoExtras", "Fase Bojo");\n}\n\nfunction adicionarFaseLateralSugestao(ordemId) {\n  adicionarSugestaoManejo(ordemId, "faseLateral", "fasesLateraisManejoExtras", "fasesLateraisManejoExtras", "Fase Lateral");\n}\n',
    "funcao adicionar lateral",
)

app = replace_once(
    app,
    '  const fasesList = document.getElementById("manejoFasesList");\n  const faccaoList = document.getElementById("manejoFaccaoList");',
    '  const fasesList = document.getElementById("manejoFasesList");\n  const fasesLateraisList = document.getElementById("manejoFasesLateraisList");\n  const faccaoList = document.getElementById("manejoFaccaoList");',
    "datalist lateral variavel",
)

lateral_block = '''
  if (fasesLateraisList) {
    const fasesLaterais = new Set();

    state.fasesLateraisManejoExtras.forEach(fase => {
      if (fase) fasesLaterais.add(String(fase).toUpperCase());
    });

    state.ordens.forEach(op => {
      const manejoSutia = getManejoDaOrdem(op, "sutia");
      if (manejoSutia?.faseLateral) fasesLaterais.add(String(manejoSutia.faseLateral).toUpperCase());
    });

    fasesLateraisList.innerHTML = [...fasesLaterais]
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }))
      .map(fase => `<option value="${escapeHtml(fase)}"></option>`)
      .join("");
  }

'''
app = replace_once(app, "\n  if (faccaoList) {", lateral_block + "  if (faccaoList) {", "bloco datalist lateral")

app = replace_once(
    app,
    '    fase: document.getElementById("filtroManejoFase")?.value || "",\n    quantidade: document.getElementById("filtroManejoQuantidade")?.value || "",',
    '    fase: document.getElementById("filtroManejoFase")?.value || "",\n    faseLateral: setor === "sutia" ? (document.getElementById("filtroManejoFaseLateral")?.value || "") : "",\n    quantidade: document.getElementById("filtroManejoQuantidade")?.value || "",',
    "filtro objeto lateral",
)

app = replace_once(app, "      manejo?.fase,\n      manejo?.faccao,", "      manejo?.fase,\n      manejo?.faseLateral,\n      manejo?.faccao,", "busca geral lateral")

# Duas listas diferentes possuem filtroManejoFase seguido de Quantidade: limpar filtros e listeners.
needle = '    "filtroManejoFase",\n    "filtroManejoQuantidade",'
if app.count(needle) < 2:
    raise SystemExit("Listas de filtro Manejo nao encontradas")
app = app.replace(needle, '    "filtroManejoFase",\n    "filtroManejoFaseLateral",\n    "filtroManejoQuantidade",', 2)

app = replace_once(
    app,
    '    filtroManejoFase: ["Campo vazio"],\n    filtroManejoQuantidade: ["Campo vazio"],',
    '    filtroManejoFase: ["Campo vazio"],\n    filtroManejoFaseLateral: ["Campo vazio"],\n    filtroManejoQuantidade: ["Campo vazio"],',
    "opcoes fixas lateral",
)

app = replace_once(
    app,
    '  preencherSelectFiltroManejo("filtroManejoFase", [\n    ...ordens.map(op => getValorManejoParaFiltro(op, "fase")),\n    ...state.fasesManejoExtras\n  ], "Todas");\n  preencherSelectFiltroManejo("filtroManejoQuantidade",',
    '  preencherSelectFiltroManejo("filtroManejoFase", [\n    ...ordens.map(op => getValorManejoParaFiltro(op, "fase")),\n    ...state.fasesManejoExtras\n  ], "Todas");\n  if (setor === "sutia") {\n    preencherSelectFiltroManejo("filtroManejoFaseLateral", [\n      ...ordens.map(op => getValorManejoParaFiltro(op, "faseLateral")),\n      ...state.fasesLateraisManejoExtras\n    ], "Todas");\n  } else {\n    const filtroLateral = document.getElementById("filtroManejoFaseLateral");\n    if (filtroLateral) filtroLateral.value = "";\n  }\n  preencherSelectFiltroManejo("filtroManejoQuantidade",',
    "render filtro lateral",
)

app = replace_once(
    app,
    '    fase: manejo?.fase || "",\n    quantidade: op.quantidade ?? "",',
    '    fase: manejo?.fase || "",\n    faseLateral: setor === "sutia" ? (manejo?.faseLateral || "") : "",\n    quantidade: op.quantidade ?? "",',
    "mapa valor filtro lateral",
)

app = replace_once(app, '  "fase",\n  "quantidade",', '  "fase",\n  "faseLateral",\n  "quantidade",', "campos exatos lateral")

app = replace_once(
    app,
    '  const extrasPorCampo = {\n    fase: state.fasesManejoExtras || [],\n    faccao: state.faccoesManejoExtras || [],',
    '  const extrasPorCampo = {\n    fase: state.fasesManejoExtras || [],\n    faseLateral: state.fasesLateraisManejoExtras || [],\n    faccao: state.faccoesManejoExtras || [],',
    "extras filtro lateral",
)

app = replace_once(
    app,
    '    ["Fase", "filtroManejoFase"],\n    ["QTI", "filtroManejoQuantidade"],',
    '    ["Fase Bojo", "filtroManejoFase"],\n    ["Fase Lateral", "filtroManejoFaseLateral"],\n    ["QTI", "filtroManejoQuantidade"],',
    "texto filtros lateral",
)

app = replace_once(
    app,
    '  const fase = limparTexto(valorLinhaManejo(ordem, "fase")).toUpperCase();\n\n  if (!fase) {',
    '  const fase = limparTexto(valorLinhaManejo(ordem, "fase")).toUpperCase();\n  const faseLateral = setor === "sutia"\n    ? limparTexto(valorLinhaManejo(ordem, "faseLateral")).toUpperCase()\n    : (manejoExistente?.faseLateral || "");\n\n  if (!fase) {',
    "salvar captura lateral",
)

salvar_pos = app.find("async function salvarManejoLinha")
idx = app.find("    fase,\n    faccao:", salvar_pos)
if salvar_pos < 0 or idx < 0:
    raise SystemExit("Objeto salvarManejoLinha nao encontrado")
app = app[:idx] + "    fase,\n    faseLateral,\n    faccao:" + app[idx + len("    fase,\n    faccao:"):]

old_phase_cell = '''        <td>
          <div class="fase-plus">
            <input id="${rowId}-fase" value="${escapeHtml(manejo?.fase || "")}" list="manejoFasesList" placeholder="Digite a fase" />
            <button class="btn-plus" type="button" onclick="adicionarFaseSugestao('${op.id}')" title="Adicionar fase às sugestões">+</button>
          </div>
        </td>
        <td><input class="manejo-readonly" type="number" value="${escapeHtml(op.quantidade ?? 0)}" readonly /></td>'''
new_phase_cell = '''        <td>
          <div class="fase-plus">
            <input id="${rowId}-fase" value="${escapeHtml(manejo?.fase || "")}" list="manejoFasesList" placeholder="Digite a fase" />
            <button class="btn-plus" type="button" onclick="adicionarFaseSugestao('${op.id}')" title="Adicionar Fase Bojo às sugestões">+</button>
          </div>
        </td>
        <td class="manejo-col-fase-lateral">
          <div class="fase-plus">
            <input id="${rowId}-faseLateral" value="${escapeHtml(manejo?.faseLateral || "")}" list="manejoFasesLateraisList" placeholder="Digite a fase" />
            <button class="btn-plus" type="button" onclick="adicionarFaseLateralSugestao('${op.id}')" title="Adicionar Fase Lateral às sugestões">+</button>
          </div>
        </td>
        <td><input class="manejo-readonly" type="number" value="${escapeHtml(op.quantidade ?? 0)}" readonly /></td>'''
app = replace_once(app, old_phase_cell, new_phase_cell, "render celula lateral")

app = replace_once(
    app,
    '  const info = document.getElementById("manejoSetorInfo");\n  if (info) info.textContent = getInfoManejoSetor(setorAtual).descricao;\n}',
    '  const info = document.getElementById("manejoSetorInfo");\n  if (info) info.textContent = getInfoManejoSetor(setorAtual).descricao;\n\n  const tabelaManejo = document.querySelector("#manejo .manejo-inline-table");\n  if (tabelaManejo) tabelaManejo.classList.toggle("manejo-sutia-ativo", setorAtual === "sutia");\n  const cabecalhoFase = tabelaManejo?.querySelector(".manejo-head-row th:nth-child(5)");\n  if (cabecalhoFase) cabecalhoFase.textContent = setorAtual === "sutia" ? "FASE BOJO" : "FASE";\n}',
    "classe setor sutia",
)

app_path.write_text(app, encoding="utf-8")

index_path = Path("index.html")
html = index_path.read_text(encoding="utf-8")
html = replace_once(
    html,
    "                  <th>FASE</th>\n                  <th>QTI</th>",
    '                  <th>FASE BOJO</th>\n                  <th class="manejo-head-fase-lateral">FASE LATERAL</th>\n                  <th>QTI</th>',
    "header fase lateral",
)

filtro_fase = '''                  <th>
                    <input id="filtroManejoFase" class="filtro-digitavel" type="text" list="filtroManejoFaseList" placeholder="Todas" autocomplete="off" />
                    <datalist id="filtroManejoFaseList"></datalist>
                  </th>'''
filtro_duplo = filtro_fase + '''
                  <th class="manejo-filter-fase-lateral">
                    <input id="filtroManejoFaseLateral" class="filtro-digitavel" type="text" list="filtroManejoFaseLateralList" placeholder="Todas" autocomplete="off" />
                    <datalist id="filtroManejoFaseLateralList"></datalist>
                  </th>'''
html = replace_once(html, filtro_fase, filtro_duplo, "filtro html lateral")
html = replace_once(
    html,
    '          <datalist id="manejoFasesList"></datalist>\n          <datalist id="manejoFaccaoList"></datalist>',
    '          <datalist id="manejoFasesList"></datalist>\n          <datalist id="manejoFasesLateraisList"></datalist>\n          <datalist id="manejoFaccaoList"></datalist>',
    "datalist html lateral",
)
index_path.write_text(html, encoding="utf-8")

style_path = Path("style.css")
css = style_path.read_text(encoding="utf-8")
css += '''

/* TESTE 163 - Fase Bojo + Fase Lateral integradas ao Manejo Sutia. */
#manejo .manejo-inline-table.manejo-limpo-table {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  table-layout: fixed !important;
}
#manejo .manejo-inline-table.manejo-limpo-table th,
#manejo .manejo-inline-table.manejo-limpo-table td { min-width: 0 !important; box-sizing: border-box !important; }
#manejo .manejo-inline-table.manejo-limpo-table th:nth-child(1),
#manejo .manejo-inline-table.manejo-limpo-table td:nth-child(1) { width:64px !important; min-width:64px !important; max-width:64px !important; }
#manejo .manejo-inline-table.manejo-limpo-table th:nth-child(2),
#manejo .manejo-inline-table.manejo-limpo-table td:nth-child(2) { width:58px !important; min-width:58px !important; max-width:58px !important; }
#manejo .manejo-inline-table.manejo-limpo-table th:nth-child(7),
#manejo .manejo-inline-table.manejo-limpo-table td:nth-child(7) { width:62px !important; min-width:62px !important; max-width:62px !important; }
#manejo .manejo-inline-table.manejo-limpo-table th:nth-child(10),
#manejo .manejo-inline-table.manejo-limpo-table td:nth-child(10) { width:76px !important; min-width:76px !important; max-width:76px !important; }
#manejo .manejo-inline-table.manejo-limpo-table th:nth-child(11),
#manejo .manejo-inline-table.manejo-limpo-table td:nth-child(11) { width:62px !important; min-width:62px !important; max-width:62px !important; }
#manejo .manejo-inline-table.manejo-limpo-table input,
#manejo .manejo-inline-table.manejo-limpo-table select,
#manejo .manejo-inline-table.manejo-limpo-table textarea,
#manejo .manejo-inline-table.manejo-limpo-table .silk-fields,
#manejo .manejo-inline-table.manejo-limpo-table .tecido-fields,
#manejo .manejo-inline-table.manejo-limpo-table .fase-plus { width:100% !important; min-width:0 !important; max-width:100% !important; box-sizing:border-box !important; }
#manejo .manejo-inline-table:not(.manejo-sutia-ativo) .manejo-head-fase-lateral,
#manejo .manejo-inline-table:not(.manejo-sutia-ativo) .manejo-filter-fase-lateral,
#manejo .manejo-inline-table:not(.manejo-sutia-ativo) .manejo-col-fase-lateral { display:none !important; }
@media (max-width:1180px) { #manejo .manejo-inline-table.manejo-limpo-table { min-width:1120px !important; } }
'''
style_path.write_text(css, encoding="utf-8")

loader_path = Path("corponu-pagamentos-alerta-duplicidades.js")
loader = loader_path.read_text(encoding="utf-8")
loader = re.sub(r'\n  const VERSION_MANEJO_FASES_TESTE = .*?;\n  const VERSION_MANEJO_LAYOUT_TESTE = .*?;\n', '\n', loader, count=1)
loader = re.sub(r'\n  // TESTE 162:.*?\n  // 160 atua somente na tabela', '\n\n  // 160 atua somente na tabela', loader, count=1, flags=re.S)
loader_path.write_text(loader, encoding="utf-8")

for antigo in ["corponu-manejo-fases-teste-157.js", "corponu-manejo-layout-teste-162.js"]:
    p = Path(antigo)
    if p.exists():
        p.unlink()

release_path = Path("corponu-release.json")
release = json.loads(release_path.read_text(encoding="utf-8"))
release["version"] = "2026-08-10-teste-manejo-fase-lateral-integrada-163"
release["updatedAt"] = "2026-08-10T13:15:00-03:00"
release["notes"] = "AMBIENTE DE TESTE. Fase Lateral integrada diretamente ao Manejo Sutia copiando a Fase Bojo: campo digitavel, sugestoes pelo botao + e filtro digitavel. OP, REF e QTI fixos e compactos; demais colunas dividem o espaco. Manejo Calcinha sem Fase Lateral. Sistema principal nao alterado."
release_path.write_text(json.dumps(release, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
