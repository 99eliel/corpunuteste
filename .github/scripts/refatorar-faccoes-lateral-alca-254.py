from pathlib import Path
import re, json

ROOT = Path('.')

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: esperado 1 ocorrência, encontrado {count}')
    return text.replace(old, new, 1)

def regex_once(text, pattern, repl, label, flags=re.S):
    out, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: esperado 1 trecho, encontrado {count}')
    return out

# 1) Fonte única de facções/processos: ampliar API consolidada, sem alterar comportamento existente.
grupos_path = ROOT / 'corponu-faccoes-grupos-processos.js'
grupos = grupos_path.read_text(encoding='utf-8')
api_anchor = '''  window.CorpoNuFaccoesGrupos = {\n    versao: VERSION,\n    atualizar: inicializarDados,\n    filtrarRegistro: filtrarFluxoRegistro,\n    filtrarManejo: filtrarFluxoManejo\n  };'''
api_new = '''  async function listarFaccoesPorProcesso(processo, forcar = false) {\n    const dados = await carregarDados(forcar);\n    return faccoesDoGrupo(processo, dados).map(item => ({\n      id: item.id,\n      nome: item.nome || "",\n      cidade: item.cidade || "",\n      ativo: item.ativo !== false\n    }));\n  }\n\n  async function listarProcessosOficiais(forcar = false) {\n    const dados = await carregarDados(forcar);\n    return dados.processos.map(item => ({ ...item }));\n  }\n\n  window.CorpoNuFaccoesGrupos = {\n    versao: VERSION,\n    atualizar: inicializarDados,\n    filtrarRegistro: filtrarFluxoRegistro,\n    filtrarManejo: filtrarFluxoManejo,\n    listarFaccoesPorProcesso,\n    listarProcessosOficiais,\n    processoCanonico\n  };'''
grupos = replace_once(grupos, api_anchor, api_new, 'API compartilhada de grupos')
grupos_path.write_text(grupos, encoding='utf-8')

# 2) Refatorar a área antiga "Corte" para um único módulo de negócio Lateral/Alça.
old_path = ROOT / 'corponu-faccoes-corte-definitivo.js'
new_path = ROOT / 'corponu-faccoes-lateral-alca-254.js'
if not old_path.exists():
    raise SystemExit('Fonte corponu-faccoes-corte-definitivo.js não encontrada')
if new_path.exists():
    raise SystemExit('Destino 254 já existe antes da refatoração')
corte = old_path.read_text(encoding='utf-8')
corte = replace_once(corte, 'Módulo consolidado de Facções / Corte / Lateral e Alça.', 'Módulo nativo de Facções / Lateral e Alça.', 'comentário do módulo')
corte = replace_once(corte, 'const VERSION = "2026-08-21-lateral-alca-fluxo-legado-227";', 'const VERSION = "2026-08-26-faccoes-lateral-alca-nativo-254";', 'versão Lateral/Alça')
corte = replace_once(corte, 'const AREA = "corte";', 'const AREA = "corte"; // campo legado preservado para compatibilidade com movimentos/pagamentos existentes\n  const FLUXO = "lateral_alca";\n  const PROCESSOS_OFICIAIS = Object.freeze([\n    { id: "lateral", nome: "LATERAL", ativo: true, atendeSutia: true, atendeCalcinha: false, marcaLateralPronta: true },\n    { id: "alca", nome: "ALÇA", ativo: true, atendeSutia: true, atendeCalcinha: false, marcaLateralPronta: false }\n  ]);', 'constantes canônicas')

# O processo deixa de vir de configuracoes/processos-corte. Só existem os dois processos oficiais nesta área.
corte = regex_once(
    corte,
    r'  async function carregarProcessos\(\) \{.*?\n  \}\n\n(?=  async function carregarFaccoes\()',
    '''  async function carregarProcessos() {\n    processos = PROCESSOS_OFICIAIS.map(item => ({ ...item }));\n  }\n\n''',
    'carregarProcessos canônico'
)

# Facções da saída passam a vir do mesmo grupo oficial usado pelo restante do sistema.
corte = regex_once(
    corte,
    r'  function preencherFaccoesSaida\(\) \{.*?\n  \}\n\n(?=  async function salvarSaida\()',
    '''  async function preencherFaccoesSaida() {\n    const select = document.getElementById("saidaCorteFaccao");\n    const processId = document.getElementById("saidaCorteProcesso")?.value || "";\n    if (!select || !opSaida) return;\n    if (!processId) {\n      select.disabled = true;\n      select.innerHTML = `<option value="">Escolha o processo</option>`;\n      return;\n    }\n\n    const processo = processoPorId(processId);\n    if (!processo) {\n      select.disabled = true;\n      select.innerHTML = `<option value="">Processo inválido</option>`;\n      return;\n    }\n\n    select.disabled = true;\n    select.innerHTML = `<option value="">Carregando facções...</option>`;\n\n    try {\n      const api = window.CorpoNuFaccoesGrupos;\n      if (!api?.listarFaccoesPorProcesso) throw new Error("Catálogo oficial de facções indisponível");\n      const items = await api.listarFaccoesPorProcesso(processo.nome);\n      select.innerHTML = `<option value="">Selecione</option>` + items\n        .filter(item => item.ativo !== false)\n        .map(item => `<option value="${html(item.nome || "")}">${html(item.nome || "")}</option>`)\n        .join("");\n      if (!items.length) select.innerHTML = `<option value="">Nenhuma facção cadastrada para ${html(processo.nome)}</option>`;\n      select.disabled = items.length === 0;\n    } catch (error) {\n      console.error("Não foi possível carregar o grupo oficial de facções.", error);\n      select.disabled = true;\n      select.innerHTML = `<option value="">Falha ao carregar facções</option>`;\n      toast("Não foi possível carregar as facções oficiais deste processo.", "error");\n    }\n  }\n\n''',
    'facções da saída pela fonte oficial'
)

# Mudança de processo dispara a função assíncrona sem criar listener/observer paralelo.
corte = replace_once(corte,
    'if (target?.id === "saidaCorteProcesso") preencherFaccoesSaida();',
    'if (target?.id === "saidaCorteProcesso") Promise.resolve(preencherFaccoesSaida()).catch(error => console.error(error));',
    'change do processo')

# Novas gravações recebem nomenclatura canônica, mantendo campos legados necessários à compatibilidade.
corte = replace_once(corte,
    'origem: "corte",\n        area: AREA,\n        areaLabel: "Corte",\n        movimentacaoCorte: true,',
    'origem: "faccoes_lateral_alca",\n        area: AREA,\n        areaLabel: "Lateral e Alça",\n        fluxoFaccoes: FLUXO,\n        movimentacaoCorte: true,',
    'identidade da nova movimentação')

# Textos visíveis e mensagens deixam de apresentar "Corte" como uma área de negócio separada.
for old, new in [
    ('Nenhum valor de Corte cadastrado.', 'Nenhum valor de Lateral/Alça cadastrado.'),
    ('Gerado pela chegada da área Corte.', 'Gerado pela chegada da área Lateral e Alça.'),
    ('processo de Corte.', 'processo de Lateral/Alça.'),
    ('Log de Corte não criado', 'Log de Lateral/Alça não criado'),
    ('dados da área Lateral e Alça', 'dados de Lateral e Alça'),
    ('Adicionar valor para Ref.', 'Adicionar valor para Ref.')
]:
    corte = corte.replace(old, new)

new_path.write_text(corte, encoding='utf-8')
old_path.unlink()

# 3) O módulo das três abas continua cuidando de Sutiã/Calcinha e APENAS navega para Lateral/Alça.
abas_path = ROOT / 'corponu-faccoes-tres-abas-saida.js'
abas = abas_path.read_text(encoding='utf-8')
abas = replace_once(abas, 'const V = "2026-08-21-faccoes-processos-na-origem-230";', 'const V = "2026-08-26-faccoes-abas-sem-saida-lateral-254";', 'versão das abas')
abas = replace_once(abas,
    '    calcinha: ["CALCINHA COMPLETA", "CALCINHA MONTAGEM"],\n    corte: ["LATERAL", "ALÇA"]',
    '    calcinha: ["CALCINHA COMPLETA", "CALCINHA MONTAGEM"]',
    'remover processos de Lateral/Alça do modal geral')
abas = replace_once(abas,
    'const processosPermitidos = tipoAba => PROCESSOS_SAIDA[tipoAba] || PROCESSOS_SAIDA.sutia;',
    'const processosPermitidos = tipoAba => PROCESSOS_SAIDA[tipoAba] || [];',
    'fallback seguro de processos')

# Não esconder/substituir o botão do módulo dedicado e não criar botão duplicado.
abas = regex_once(
    abas,
    r'\n    const leg = document\.getElementById\("btnCorteRegistrarSaida"\);.*?\n    corrigirClassificacaoVisualMovimentacoes\(\);',
    '\n    corrigirClassificacaoVisualMovimentacoes();',
    'remover botão duplicado de saída Lateral/Alça'
)

# O modal s3 não pode ser aberto como fluxo Lateral/Alça.
abas = replace_once(abas,
    '  function abrir(a) {\n    aba = a;',
    '  function abrir(a) {\n    if (a === "corte") return;\n    aba = a;',
    'bloquear modal geral para Lateral/Alça')

# Salvamento do modal geral não pode gerar movimentação de corte mesmo por chamada acidental.
abas = replace_once(abas,
    '  async function salvar(ev) {\n    ev.preventDefault();\n    if (!op) return toast("Busque a OP primeiro.");',
    '  async function salvar(ev) {\n    ev.preventDefault();\n    if (aba === "corte") return toast("Use o fluxo próprio de Lateral e Alça.");\n    if (!op) return toast("Busque a OP primeiro.");',
    'trava de salvamento fora do módulo dedicado')
abas = abas.replace('const corte = aba === "corte";', 'const corte = false;')
abas = abas.replace('corte ? document.getElementById("btnCorteAtualizar")?.click() : document.getElementById("btnAtualizarServidor")?.click();', 'document.getElementById("btnAtualizarServidor")?.click();')
abas_path.write_text(abas, encoding='utf-8')

# 4) Lazy loader passa a carregar o novo módulo nativo.
loader_path = ROOT / 'corponu-atualizador.js'
loader = loader_path.read_text(encoding='utf-8')
loader = replace_once(loader,
    '["corponu-faccoes-corte-definitivo.js", "faccoes-corte-definitivo", "Não foi possível carregar a área definitiva de Corte / Lateral e Alça."],',
    '["corponu-faccoes-lateral-alca-254.js", "faccoes-lateral-alca-254", "Não foi possível carregar a área nativa de Lateral e Alça."],',
    'loader da área')
loader = loader.replace('const LOCAL_RELEASE = "2026-08-25-manejo-calcinha-dedicado-252";', 'const LOCAL_RELEASE = "2026-08-26-faccoes-lateral-alca-254-homologacao";')
loader_path.write_text(loader, encoding='utf-8')

# 5) Release de homologação. Nenhum dado histórico é migrado.
release_path = ROOT / 'corponu-release.json'
release = json.loads(release_path.read_text(encoding='utf-8'))
release['version'] = '2026-08-26-faccoes-lateral-alca-254-homologacao'
release['updatedAt'] = '2026-08-26T07:47:00-03:00'
release['notes'] = ('HOMOLOGAÇÃO. Primeira limpeza estrutural de Facções > Lateral e Alça. '
    'Um único módulo passa a ser dono de saída, andamento, chegada e geração de pagamento de LATERAL/ALÇA. '
    'O módulo de três abas mantém apenas o envio de Sutiã/Calcinha e a navegação para Lateral/Alça, sem criar saída paralela. '
    'A seleção de facção usa a fonte oficial grupos-faccoes-processos. Processos oficiais nesta área: LATERAL e ALÇA. '
    'As fórmulas financeiras existentes são preservadas: Lateral por referência; Alça quantidade recebida x 2 x valor padrão. '
    'Campos legados area=corte/movimentacaoCorte são mantidos somente por compatibilidade, sem migração de históricos. Produção não alterada.')
release_path.write_text(json.dumps(release, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# 6) Atualizar teste consolidado para a arquitetura nova.
test_path = ROOT / 'tests/e2e/faccoes-consolidado.spec.js'
test = test_path.read_text(encoding='utf-8')
test = test.replace("const respostaCorte = await request.get('/corponu-faccoes-corte-definitivo.js');", "const respostaCorte = await request.get('/corponu-faccoes-lateral-alca-254.js');")
test = test.replace("expect(codigoCorte).toContain('2026-08-21-lateral-alca-fluxo-legado-227');", "expect(codigoCorte).toContain('2026-08-26-faccoes-lateral-alca-nativo-254');\n    expect(codigoCorte).toContain('PROCESSOS_OFICIAIS');\n    expect(codigoCorte).toContain('listarFaccoesPorProcesso');\n    expect(codigoCorte).toContain('quantidade_recebida_x_2_x_valor_alca');\n    expect(codigoCorte).toContain('quantidade_recebida_x_valor_referencia');")
test = test.replace("expect(codigoAbas).toContain('2026-08-21-faccoes-processos-na-origem-230');", "expect(codigoAbas).toContain('2026-08-26-faccoes-abas-sem-saida-lateral-254');")
test = test.replace("    expect(codigoAbas).toContain('Lateral e Alça');\n", "    expect(codigoAbas).toContain('Lateral e Alça');\n    expect(codigoAbas).not.toContain('corte: [\"LATERAL\", \"ALÇA\"]');\n    expect(codigoAbas).not.toContain('btnSaidaCorteNovo');\n")
test = test.replace("expect(codigoGrupos).toContain('CorpoNuFaccoesGrupos');", "expect(codigoGrupos).toContain('CorpoNuFaccoesGrupos');\n    expect(codigoGrupos).toContain('listarFaccoesPorProcesso');")
test = test.replace("expect(locais).toContain('corponu-faccoes-corte-definitivo.js');", "expect(locais).toContain('corponu-faccoes-lateral-alca-254.js');\n    expect(locais).not.toContain('corponu-faccoes-corte-definitivo.js');")
test_path.write_text(test, encoding='utf-8')

# 7) Novo teste específico: uma única saída e facções provenientes do catálogo oficial.
new_test = ROOT / 'tests/e2e/faccoes-lateral-alca-254.spec.js'
new_test.write_text(r'''const { test, expect } = require('@playwright/test');

const email = process.env.TEST_EMAIL;
const senha = process.env.TEST_PASSWORD;
const temCredenciais = Boolean(email && senha);

async function entrar(page) {
  await page.goto('/');
  await page.locator('#loginEmail').fill(email);
  await page.locator('#loginSenha').fill(senha);
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#appShell')).toBeVisible({ timeout: 25_000 });
}

test.describe('Facções - Lateral e Alça 254', () => {
  test('arquitetura tem um único dono do fluxo e preserva fórmulas financeiras', async ({ request }) => {
    const modulo = await (await request.get('/corponu-faccoes-lateral-alca-254.js')).text();
    const abas = await (await request.get('/corponu-faccoes-tres-abas-saida.js')).text();
    const grupos = await (await request.get('/corponu-faccoes-grupos-processos.js')).text();
    const loader = await (await request.get('/corponu-atualizador.js')).text();

    expect(modulo).toContain('2026-08-26-faccoes-lateral-alca-nativo-254');
    expect(modulo).toContain('{ id: "lateral", nome: "LATERAL"');
    expect(modulo).toContain('{ id: "alca", nome: "ALÇA"');
    expect(modulo).toContain('api.listarFaccoesPorProcesso(processo.nome)');
    expect(modulo).toContain('const paymentId = `corte-${slug(movement.id)}`');
    expect(modulo).toContain('quantidade_recebida_x_2_x_valor_alca');
    expect(modulo).toContain('quantidade_recebida_x_valor_referencia');
    expect(modulo).toContain('if (pagamentoPago(current))');
    expect(modulo).not.toContain('new MutationObserver');

    expect(abas).not.toContain('corte: ["LATERAL", "ALÇA"]');
    expect(abas).not.toContain('btnSaidaCorteNovo');
    expect(abas).toContain('if (a === "corte") return;');
    expect(abas).toContain('if (aba === "corte") return toast("Use o fluxo próprio de Lateral e Alça.")');

    expect(grupos).toContain('async function listarFaccoesPorProcesso');
    expect(loader).toContain('corponu-faccoes-lateral-alca-254.js');
    expect(loader).not.toContain('corponu-faccoes-corte-definitivo.js');
  });

  test('interface usa uma única saída e a lista oficial por processo', async ({ page }) => {
    test.skip(!temCredenciais, 'Configure TEST_EMAIL e TEST_PASSWORD.');
    const erros = [];
    page.on('pageerror', error => erros.push(String(error)));

    await entrar(page);
    await page.locator('.nav-btn[data-page="faccoes"]').click();
    await expect(page.locator('#faccoes')).toHaveClass(/active/);
    await expect.poll(() => page.evaluate(() => Boolean(window.CorpoNuFaccoesGrupos?.listarFaccoesPorProcesso)), { timeout: 15_000 }).toBeTruthy();
    await expect.poll(() => page.evaluate(() => Boolean(window.__CORPONU_FACCOES_CORTE__)), { timeout: 15_000 }).toBeTruthy();

    await expect(page.locator('#abaFaccaoCorte')).toHaveCount(1);
    await page.locator('#abaFaccaoCorte').click();
    await expect(page.locator('#painelFaccoesCorte')).toBeVisible();

    await expect(page.locator('#btnCorteRegistrarSaida')).toHaveCount(1);
    await expect(page.locator('#btnSaidaCorteNovo')).toHaveCount(0);
    await expect(page.locator('#modalSaidaCorte')).toHaveCount(1);
    await page.locator('#btnCorteRegistrarSaida').click();
    await expect(page.locator('#modalSaidaCorte')).toBeVisible();

    const processosFonte = await page.evaluate(async () => {
      const itens = await window.CorpoNuFaccoesGrupos.listarProcessosOficiais();
      return itens.map(item => item.nome);
    });
    expect(processosFonte).toContain('LATERAL');
    expect(processosFonte).toContain('ALÇA');

    const grupos = await page.evaluate(async () => ({
      lateral: (await window.CorpoNuFaccoesGrupos.listarFaccoesPorProcesso('LATERAL')).map(item => item.nome),
      alca: (await window.CorpoNuFaccoesGrupos.listarFaccoesPorProcesso('ALÇA')).map(item => item.nome)
    }));
    expect(Array.isArray(grupos.lateral)).toBeTruthy();
    expect(Array.isArray(grupos.alca)).toBeTruthy();

    expect(erros, `Erros JavaScript: ${erros.join(' | ')}`).toEqual([]);
  });
});
''', encoding='utf-8')

# Garantias finais antes do commit automático.
checks = {
    'arquivo novo existe': new_path.exists(),
    'arquivo antigo removido': not old_path.exists(),
    'loader novo': 'corponu-faccoes-lateral-alca-254.js' in loader,
    'loader antigo fora': 'corponu-faccoes-corte-definitivo.js' not in loader,
    'grupo API': 'listarFaccoesPorProcesso' in grupos,
    'fórmula alça': 'quantidade_recebida_x_2_x_valor_alca' in corte,
    'fórmula lateral': 'quantidade_recebida_x_valor_referencia' in corte,
    'pagamento determinístico': 'const paymentId = `corte-${slug(movement.id)}`' in corte,
    'proteção pago': 'if (pagamentoPago(current))' in corte,
    'sem botão duplicado': 'btnSaidaCorteNovo' not in abas,
}
falhas = [nome for nome, ok in checks.items() if not ok]
if falhas:
    raise SystemExit('Falhas finais: ' + ', '.join(falhas))

print('Refatoração Lateral/Alça 254 aplicada com garantias estruturais.')
