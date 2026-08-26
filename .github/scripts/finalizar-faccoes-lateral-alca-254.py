from pathlib import Path
import re


def once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: esperado 1 ocorrência, encontrado {count}')
    return text.replace(old, new, 1)


def regex_once(text, pattern, replacement, label, flags=re.S):
    out, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: esperado 1 trecho, encontrado {count}')
    return out

mod_path = Path('corponu-faccoes-lateral-alca-254.js')
abas_path = Path('corponu-faccoes-tres-abas-saida.js')
test_path = Path('tests/e2e/faccoes-lateral-alca-254.spec.js')
mod = mod_path.read_text(encoding='utf-8')
abas = abas_path.read_text(encoding='utf-8')
test = test_path.read_text(encoding='utf-8')

# ---- Módulo Lateral/Alça: a área não cria mais uma segunda barra de abas escondida. ----
mod = once(mod, '  let abaAtiva = "geral";\n', '', 'estado de aba interna')
mod = mod.replace('.corte-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;padding:7px;border:1px solid #ddd6fe;background:#f5f3ff;border-radius:14px;width:max-content;max-width:100%}\n      .corte-tab{border:0;background:transparent;color:#5b21b6;padding:10px 14px;border-radius:10px;font-weight:900;cursor:pointer}.corte-tab.active{background:#6d28d9;color:#fff;box-shadow:0 7px 18px #6d28d933}\n      ', '')
mod = mod.replace('.corte-tabs{width:100%}.corte-tab{flex:1}', '')

internal_tabs = '''    if (!document.getElementById("faccoesAbasCorte")) {\n      const tabs = document.createElement("div");\n      tabs.id = "faccoesAbasCorte";\n      tabs.className = "corte-tabs";\n      tabs.innerHTML = `<button class="corte-tab active" type="button" data-area-faccoes="geral">Sutiã e Calcinha</button><button class="corte-tab" type="button" data-area-faccoes="corte">Lateral e Alça</button>`;\n      page.insertBefore(tabs, existing);\n    }\n\n'''
mod = once(mod, internal_tabs, '', 'abas internas antigas')
mod = once(mod, '    atualizarVisibilidadeAdmin();\n    aplicarAba(abaAtiva, false);\n    return true;', '    atualizarVisibilidadeAdmin();\n    return true;', 'inicialização sem aba interna')

mod = regex_once(
    mod,
    r'  function aplicarAba\(area, carregar = true\) \{.*?\n  \}\n\n(?=  async function carregarPerfil\()',
    '''  function mostrarAreaLateralAlca() {\n    const page = document.getElementById("faccoes");\n    const geral = page?.querySelector(":scope > .faccoes-operacional-panel");\n    const painel = document.getElementById("painelFaccoesCorte");\n    if (!page || !geral || !painel) return false;\n    geral.classList.add("hidden");\n    painel.classList.remove("hidden");\n    carregarTudoCorte();\n    return true;\n  }\n\n  function ocultarAreaLateralAlca() {\n    document.getElementById("painelFaccoesCorte")?.classList.add("hidden");\n  }\n\n''',
    'API de visibilidade dedicada'
)

# Auth/reload: só atualiza se o painel dedicado estiver visível.
mod = mod.replace('if (abaAtiva === "corte") carregarTudoCorte();', 'if (!document.getElementById("painelFaccoesCorte")?.classList.contains("hidden")) carregarTudoCorte();')

# Remove listener da antiga barra de abas interna.
mod = once(mod,
'''      const tab = target.closest("[data-area-faccoes]");\n      if (tab) { aplicarAba(tab.dataset.areaFaccoes); return; }\n''',
'', 'listener de aba interna')

# A classificação de facção deixa de ser uma segunda fonte de verdade. Grupos/processos é a única fonte.
mod = regex_once(mod, r'  function injetarClassificacaoFaccao\(\) \{.*?\n  \}\n\n(?=  function garantirProcessosChegadaManual)', '', 'injeção de classificação paralela')
mod = once(mod, '    injetarClassificacaoFaccao();\n', '', 'chamada da classificação paralela')
mod = regex_once(mod, r'  async function salvarClassificacaoFaccao\(dadosCapturados = \{\}\) \{.*?\n  \}\n\n  async function carregarClassificacaoFaccao\(id\) \{.*?\n  \}\n\n  function limparClassificacaoFaccao\(\) \{.*?\n  \}\n\n', '', 'funções de classificação paralela')
mod = regex_once(mod,
    r'\n      const editFaccao = target\.closest\(\'\[onclick\*="editarFaccao"\]\'\);.*?if \(target\.closest\("#btnAbrirCadastroFaccao"\)\) setTimeout\(limparClassificacaoFaccao, 50\);\n',
    '\n', 'listeners da classificação paralela')
mod = regex_once(mod,
    r'\n      if \(form\.id === "formFaccao"\) \{\n        const dadosClassificacao = \{.*?\n        setTimeout\(\(\) => salvarClassificacaoFaccao\(dadosClassificacao\)\.catch\(console\.warn\), 0\);\n      \}\n',
    '\n', 'submit da classificação paralela')

# Nomes visíveis e metadados novos passam a usar a nomenclatura oficial.
replacements = {
    'tipoDestinoLabel: "Facção • Corte",': 'tipoDestinoLabel: "Facção • Lateral e Alça",',
    'setorLabel: "Corte",\n        quantidadeEnviada:': 'setorLabel: "Lateral e Alça",\n        quantidadeEnviada:',
    'toast("Saída de Corte registrada com sucesso.", "ok");': 'toast("Saída de Lateral e Alça registrada com sucesso.", "ok");',
    'toast("Erro ao registrar a saída de Corte.", "error");': 'toast("Erro ao registrar a saída de Lateral e Alça.", "error");',
    'origem: "movimentacao_corte",\n      area: AREA,\n      areaLabel: "Corte",': 'origem: "movimentacao_corte",\n      origemFluxo: "faccoes_lateral_alca",\n      fluxoFaccoes: FLUXO,\n      area: AREA,\n      areaLabel: "Lateral e Alça",',
    '(ehLateralReferencia ? "Lateral" : "Corte")': '(ehLateralReferencia ? "Lateral" : "Lateral e Alça")',
    'lateralProntaOrigemAtualLabel: "Facção de Corte",': 'lateralProntaOrigemAtualLabel: "Facção • Lateral e Alça",',
    'console.warn("Pagamentos de montagem não recalculados pela área Corte", error);': 'console.warn("Pagamentos de montagem não recalculados após Lateral/Alça", error);',
    'toast("Erro ao registrar a chegada de Corte.", "error");': 'toast("Erro ao registrar a chegada de Lateral e Alça.", "error");',
    'toast("Erro ao salvar o valor de Corte.", "error");': 'toast("Erro ao salvar o valor de Lateral/Alça.", "error");',
    'observacoes: "Valor de Corte definido e pagamento pendente recalculado.",': 'observacoes: "Valor de Lateral/Alça definido e pagamento pendente recalculado.",',
    'areaLabel: "Corte",\n        valor:': 'areaLabel: "Lateral e Alça",\n        valor:',
    'field.title = "Lateral pronta — Facção de Corte";': 'field.title = "Lateral pronta — Facção de Lateral e Alça";',
    'console.warn("Não foi possível recalcular todas as laterais de Corte.", error);': 'console.warn("Não foi possível recalcular todas as laterais de Lateral/Alça.", error);'
}
for old, new in replacements.items():
    mod = mod.replace(old, new)

# API canônica. Alias antigo fica somente por compatibilidade com módulos existentes.
old_api = '''  window.CorpoNuFaccoesCorte = {\n    versao: VERSION,\n    atualizar: carregarTudoCorte,\n    recalcularMontagemPorOP\n  };'''
new_api = '''  const apiLateralAlca = {\n    versao: VERSION,\n    atualizar: carregarTudoCorte,\n    mostrar: mostrarAreaLateralAlca,\n    ocultar: ocultarAreaLateralAlca,\n    recalcularMontagemPorOP\n  };\n  window.CorpoNuFaccoesLateralAlca = apiLateralAlca;\n  window.CorpoNuFaccoesCorte = apiLateralAlca; // alias legado temporário'''
mod = once(mod, old_api, new_api, 'API pública canônica')

mod_path.write_text(mod, encoding='utf-8')

# ---- Três abas: apenas navegação para o módulo dedicado, sem DOM interno escondido. ----
abas = abas.replace('const bs = [...p.querySelectorAll("button")].filter(b => !b.closest("#faccoesAbasCorte"));', 'const bs = [...p.querySelectorAll("button")];')
abas = abas.replace('    document.getElementById("painelFaccoesCorte")?.classList.add("hidden");\n    document.querySelector(\'#faccoesAbasCorte [data-area-faccoes="geral"]\')?.click();', '    window.CorpoNuFaccoesLateralAlca?.ocultar?.();')
abas = abas.replace('    document.getElementById("painelFaccoesCorte")?.classList.remove("hidden");\n    document.querySelector(\'#faccoesAbasCorte [data-area-faccoes="corte"]\')?.click();\n    setTimeout(() => document.getElementById("btnCorteAtualizar")?.click(), 0);', '    window.CorpoNuFaccoesLateralAlca?.mostrar?.();')
abas = abas.replace('#faccoesAbasCorte{display:none!important}', '')
abas = regex_once(abas,
    r'\n    const velha = document\.getElementById\("faccoesAbasCorte"\);\n    if \(velha\) \{\n      velha\.hidden = true;\n      velha\.style\.setProperty\("display", "none", "important"\);\n    \}\n',
    '\n', 'ponte da aba interna escondida')
abas = abas.replace('setorLabel: aba === "sutia" ? "Sutiã" : aba === "calcinha" ? "Calcinha" : "Corte",', 'setorLabel: aba === "sutia" ? "Sutiã" : "Calcinha",')
abas_path.write_text(abas, encoding='utf-8')

# ---- Testes estruturais passam a exigir ausência da segunda barra e API canônica. ----
test = test.replace("    expect(modulo).not.toContain('new MutationObserver');", "    expect(modulo).not.toContain('new MutationObserver');\n    expect(modulo).toContain('window.CorpoNuFaccoesLateralAlca = apiLateralAlca');\n    expect(modulo).not.toContain('data-area-faccoes');\n    expect(modulo).not.toContain('injetarClassificacaoFaccao');")
test = test.replace("    expect(abas).toContain('if (a === \"corte\") return;');", "    expect(abas).toContain('if (a === \"corte\") return;');\n    expect(abas).toContain('window.CorpoNuFaccoesLateralAlca?.mostrar?.()');\n    expect(abas).not.toContain('faccoesAbasCorte');")
test = test.replace("    await expect(page.locator('#abaFaccaoCorte')).toHaveCount(1);", "    await expect(page.locator('#abaFaccaoCorte')).toHaveCount(1);\n    await expect(page.locator('#faccoesAbasCorte')).toHaveCount(0);")
test_path.write_text(test, encoding='utf-8')

# Garantias finais.
checks = {
    'sem segunda barra': 'faccoesAbasCorte' not in mod and 'faccoesAbasCorte' not in abas,
    'API canônica': 'window.CorpoNuFaccoesLateralAlca = apiLateralAlca' in mod,
    'alias compatível': 'window.CorpoNuFaccoesCorte = apiLateralAlca' in mod,
    'sem classificação paralela': 'injetarClassificacaoFaccao' not in mod and 'salvarClassificacaoFaccao' not in mod,
    'fonte oficial': 'api.listarFaccoesPorProcesso(processo.nome)' in mod,
    'fórmula lateral': 'quantidade_recebida_x_valor_referencia' in mod,
    'fórmula alça': 'quantidade_recebida_x_2_x_valor_alca' in mod,
    'proteção pago': 'if (pagamentoPago(current))' in mod,
    'nome saída': 'Saída de Lateral e Alça registrada com sucesso.' in mod,
    'metadado fluxo': 'origemFluxo: "faccoes_lateral_alca"' in mod,
}
fail = [k for k, v in checks.items() if not v]
if fail:
    raise SystemExit('Falhas da limpeza final: ' + ', '.join(fail))
print('Limpeza final estrutural Lateral/Alça 254 aplicada.')
