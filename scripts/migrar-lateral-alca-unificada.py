from pathlib import Path
import re

MODULO = Path('corponu-faccoes-corte-definitivo.js')
ABAS = Path('corponu-faccoes-tres-abas-saida.js')
ATUALIZADOR = Path('corponu-atualizador.js')

for arquivo in [MODULO, ABAS, ATUALIZADOR]:
    if not arquivo.exists():
        raise SystemExit(f'Arquivo obrigatório não encontrado: {arquivo}')


def trocar_uma(texto, antigo, novo, descricao):
    total = texto.count(antigo)
    if total != 1:
        raise SystemExit(f'ERRO: {descricao}: esperado 1, encontrado {total}.')
    return texto.replace(antigo, novo, 1)


def trocar_regex(texto, padrao, novo, descricao):
    resultado, total = re.subn(padrao, novo, texto, count=1, flags=re.S)
    if total != 1:
        raise SystemExit(f'ERRO: {descricao}: esperado 1, encontrado {total}.')
    return resultado


texto = MODULO.read_text(encoding='utf-8')
texto = trocar_uma(
    texto,
    'const VERSION = "2026-07-30-faccoes-corte-23";',
    'const VERSION = "2026-08-21-lateral-alca-unificada-226";',
    'versão do módulo definitivo'
)
texto = trocar_uma(
    texto,
    '  const AREA = "corte";\n',
    '  const AREA = "corte";\n  const VALOR_FILTRO_ALCA = "__CORPONU_ALCA__";\n',
    'constante AREA'
)

marcador = '  const ehAdmin = () => norm(perfil?.tipo) === "ADMIN";\n'
helpers = '''  const ehAdmin = () => norm(perfil?.tipo) === "ADMIN";\n\n  function processoCanonico(value) {\n    const key = norm(value);\n    if (["ALCA", "ALCAS"].includes(key)) return "ALÇA";\n    if (key === "LATERAL") return "LATERAL";\n    return String(value ?? "").trim().toUpperCase();\n  }\n\n  const movimentoLegadoForaCorte = item => !(item?.area === AREA || item?.movimentacaoCorte === true);\n\n  function movimentoPertenceLateralAlca(item) {\n    const processo = processoCanonico(item?.processo || item?.servicoNome || item?.processoMovimentacao);\n    return !movimentoLegadoForaCorte(item) || processo === "LATERAL" || processo === "ALÇA";\n  }\n\n  function statusDoMovimento(item) {\n    if (movimentoCancelado(item)) return "cancelado";\n    const status = norm(item?.status || item?.statusMovimentacao);\n    if (item?.dataChegada || ["RETORNOU", "FINALIZADO", "FINALIZADA"].includes(status)) return "retornou";\n    return "em_andamento";\n  }\n\n  function abrirChegadaLegada(movementId) {\n    if (typeof window.registrarChegadaMovimentacao === "function") {\n      window.registrarChegadaMovimentacao(movementId);\n      return true;\n    }\n    const botaoOriginal = [...document.querySelectorAll("button[onclick]")].find(botao => {\n      const codigo = botao.getAttribute("onclick") || "";\n      return codigo.includes("registrarChegadaMovimentacao") && codigo.includes(movementId);\n    });\n    if (botaoOriginal instanceof HTMLButtonElement) {\n      botaoOriginal.click();\n      return true;\n    }\n    return false;\n  }\n\n  function garantirProcessosChegadaManual() {\n    const datalist = document.getElementById("chegadaManualProcessoList");\n    if (!(datalist instanceof HTMLDataListElement)) return;\n    ["LATERAL", "ALÇA"].forEach(processo => {\n      const existe = [...datalist.options].some(option => processoCanonico(option.value) === processo);\n      if (!existe) {\n        const option = document.createElement("option");\n        option.value = processo;\n        datalist.appendChild(option);\n      }\n    });\n  }\n'''
texto = trocar_uma(texto, marcador, helpers, 'helpers de Lateral e Alça')

texto = trocar_uma(
    texto,
    '        <div><h3>Corte</h3><p>Registre saídas e chegadas de OPs enviadas para processos externos de corte.</p></div>',
    '        <div><h3>Lateral e Alça</h3><p>Acompanhe saídas e chegadas dos processos de Lateral e Alça.</p></div>',
    'cabeçalho da área'
)
texto = trocar_uma(
    texto,
    '          <button class="btn btn-primary" id="btnCorteRegistrarSaida" type="button">Registrar saída</button>\n',
    '          <button class="btn btn-primary" id="btnCorteRegistrarSaida" type="button">Registrar saída</button>\n          <button class="btn btn-success" id="btnChegadaManualLateralAlca" type="button">Chegada manual</button>\n',
    'botão de saída'
)
texto = trocar_uma(
    texto,
    'tabs.innerHTML = `<button class="corte-tab active" type="button" data-area-faccoes="geral">Sutiã e Calcinha</button><button class="corte-tab" type="button" data-area-faccoes="corte">Corte</button>`;',
    'tabs.innerHTML = `<button class="corte-tab active" type="button" data-area-faccoes="geral">Sutiã e Calcinha</button><button class="corte-tab" type="button" data-area-faccoes="corte">Lateral e Alça</button>`;',
    'rótulo da aba interna'
)

for antigo, novo, desc in [
    ('<h3>Registrar saída de Corte</h3>', '<h3>Registrar saída de Lateral e Alça</h3>', 'modal de saída'),
    ('<h3 id="tituloChegadaCorte">Registrar chegada de Corte</h3>', '<h3 id="tituloChegadaCorte">Registrar chegada de Lateral e Alça</h3>', 'modal de chegada'),
    ('<h3>Selecionar movimentação em andamento</h3><p>Escolha qual OP retornou da facção.</p>', '<h3>Selecionar movimentação em andamento</h3><p>Escolha qual OP retornou de Lateral ou Alça.</p>', 'seletor de chegada'),
]:
    texto = trocar_uma(texto, antigo, novo, desc)

novo_carregar = '''  async function carregarMovimentos() {\n    const c = await aguardarContexto();\n    const colecao = c.fs.collection(c.db, "movimentacoesProducao");\n    const consultas = [\n      c.fs.query(colecao, c.fs.where("area", "==", AREA)),\n      c.fs.query(colecao, c.fs.where("movimentacaoCorte", "==", true)),\n      c.fs.query(colecao, c.fs.where("processo", "in", ["LATERAL", "ALÇA", "ALCA", "ALÇAS"]))\n    ];\n\n    const mapa = new Map();\n    const resultados = await Promise.allSettled(consultas.map(consulta => c.fs.getDocs(consulta)));\n    resultados.forEach(resultado => {\n      if (resultado.status !== "fulfilled") {\n        console.warn("Uma consulta de Lateral e Alça não pôde ser executada.", resultado.reason);\n        return;\n      }\n      resultado.value.docs.forEach(docSnap => {\n        const item = { id: docSnap.id, ...docSnap.data() };\n        if (movimentoPertenceLateralAlca(item)) mapa.set(item.id, item);\n      });\n    });\n\n    if (!mapa.size && resultados.every(resultado => resultado.status === "rejected")) {\n      throw resultados[0].reason || new Error("Não foi possível consultar Lateral e Alça.");\n    }\n\n    movimentos = [...mapa.values()];\n    movimentos.sort((a, b) => {\n      const da = a.atualizadoEm?.toMillis?.() || a.criadoEm?.toMillis?.() || Date.parse(a.dataChegada || a.dataEnvio || "") || 0;\n      const db = b.atualizadoEm?.toMillis?.() || b.criadoEm?.toMillis?.() || Date.parse(b.dataChegada || b.dataEnvio || "") || 0;\n      return db - da;\n    });\n  }\n\n  async function carregarPrecos()'''
texto = trocar_regex(
    texto,
    r'  async function carregarMovimentos\(\) \{.*?\n  \}\n\n  async function carregarPrecos\(\)',
    novo_carregar,
    'carregarMovimentos'
)

texto = trocar_uma(
    texto,
    '      if (process && String(item.processoCorteId || item.processo || "") !== process && norm(item.processo) !== norm(processoPorId(process)?.nome)) return false;',
    '''      if (process) {\n        if (process === VALOR_FILTRO_ALCA) {\n          if (processoCanonico(item.processo) !== "ALÇA") return false;\n        } else if (String(item.processoCorteId || item.processo || "") !== process && norm(item.processo) !== norm(processoPorId(process)?.nome)) {\n          return false;\n        }\n      }''',
    'filtro de processo'
)
texto = trocar_uma(
    texto,
    '''      if (status) {\n        const current = movimentoCancelado(item) ? "cancelado" : (item.status || "em_andamento");\n        if (current !== status) return false;\n      }''',
    '      if (status && statusDoMovimento(item) !== status) return false;',
    'filtro de status'
)
texto = trocar_uma(
    texto,
    '      if (lateral) {\n        const process = processoPorId(item.processoCorteId) || processoPorNome(item.processo);',
    '      if (lateral) {\n        if (processoCanonico(item.processo) === "ALÇA") return false;\n        const process = processoPorId(item.processoCorteId) || processoPorNome(item.processo);',
    'filtro lateral'
)

texto = trocar_uma(
    texto,
    '''    if (processSelect) {\n      processSelect.innerHTML = `<option value="">Todos</option>` + processos.map(item => `<option value="${html(item.id)}">${html(item.nome)}</option>`).join("");\n      if ([...processSelect.options].some(option => option.value === currentProcess)) processSelect.value = currentProcess;\n    }''',
    '''    if (processSelect) {\n      const opcoes = processos.map(item => `<option value="${html(item.id)}">${html(item.nome)}</option>`);\n      const temAlcaNosMovimentos = movimentos.some(item => processoCanonico(item.processo) === "ALÇA");\n      const temAlcaConfigurada = processos.some(item => processoCanonico(item.nome) === "ALÇA");\n      if (temAlcaNosMovimentos && !temAlcaConfigurada) opcoes.push(`<option value="${VALOR_FILTRO_ALCA}">ALÇA</option>`);\n      processSelect.innerHTML = `<option value="">Todos</option>` + opcoes.join("");\n      if ([...processSelect.options].some(option => option.value === currentProcess)) processSelect.value = currentProcess;\n    }''',
    'filtro de processos'
)
texto = texto.replace('movimentos.map(item => item.destino).filter(Boolean)', 'movimentos.map(item => item.destino || item.faccao).filter(Boolean)', 1)
texto = trocar_uma(
    texto,
    '    set("corteTotalSemValor", quantidade(withoutValue));\n',
    '    set("corteTotalSemValor", quantidade(withoutValue));\n    set("contCorte", quantidade(validos.length));\n',
    'contador da terceira aba'
)

novo_render = '''  function renderMovimentos() {\n    const body = document.getElementById("listaFaccoesCorte");\n    if (!body) return;\n    const items = movimentosFiltrados();\n    if (!items.length) {\n      body.innerHTML = `<tr><td colspan="12" class="corte-empty">Nenhuma movimentação de Lateral ou Alça encontrada.</td></tr>`;\n      return;\n    }\n\n    body.innerHTML = items.map(item => {\n      const pagamento = pagamentoDoMovimento(item.id);\n      const legado = movimentoLegadoForaCorte(item);\n      const processo = processoCanonico(item.processo || item.servicoNome || item.processoMovimentacao);\n      const canCancelBefore = !legado && !movimentoCancelado(item) && !item.dataChegada && (ehAdmin() || String(item.criadoPor || "") === String(user?.uid || ""));\n      const canCancelAfter = !legado && !movimentoCancelado(item) && item.dataChegada && ehAdmin();\n      const canEditArrival = !legado && item.dataChegada && !pagamentoPago(pagamento) && !movimentoCancelado(item);\n      const canArrival = !item.dataChegada && !movimentoCancelado(item);\n      const processConfig = processoPorId(item.processoCorteId) || processoPorNome(item.processo);\n      const marksLateral = processo === "LATERAL" || item.marcaLateralPronta === true || processConfig?.marcaLateralPronta === true;\n      const actions = [];\n      if (canArrival) actions.push(`<button class="btn btn-sm btn-success" type="button" data-chegada-corte="${html(item.id)}">Registrar chegada</button>`);\n      if (canEditArrival) actions.push(`<button class="btn btn-sm" type="button" data-editar-chegada-corte="${html(item.id)}">Editar chegada</button>`);\n      if (canCancelBefore || canCancelAfter) actions.push(`<button class="btn btn-sm btn-danger" type="button" data-cancelar-corte="${html(item.id)}">Cancelar</button>`);\n\n      let componente = "-";\n      if (processo === "ALÇA") componente = '<span class="corte-pill lateral">Alça</span>';\n      else if (marksLateral && item.dataChegada && !movimentoCancelado(item)) componente = '<span class="corte-pill lateral">Lateral pronta</span>';\n      else if (processo === "LATERAL") componente = '<span class="corte-pill lateral">Lateral</span>';\n\n      return `<tr data-movimentacao-id="${html(item.id)}">\n        <td><strong>${html(item.numeroOP || "-")}</strong></td>\n        <td>${html(item.referencia || "-")}</td>\n        <td>${html(item.cor || "-")}</td>\n        <td>${html(processo || item.processo || "-")}</td>\n        <td>${html(item.destino || item.faccao || "-")}</td>\n        <td>${quantidade(item.quantidadeEnviada)}</td>\n        <td>${html(dataBR(item.dataEnvio))}</td>\n        <td>${html(dataBR(item.dataChegada))}</td>\n        <td>${quantidade(item.falta)}</td>\n        <td>${labelStatus(item)}${pagamento && (pagamento.valorPendente === true || statusNormalizado(pagamento.statusPagamento) === "SEM_VALOR") ? ' <span class="corte-pill valor">Valor a definir</span>' : ""}</td>\n        <td>${componente}</td>\n        <td><div class="corte-actions">${actions.join("") || "-"}</div></td>\n      </tr>`;\n    }).join("");\n  }\n\n  function renderProcessosAdmin()'''
texto = trocar_regex(
    texto,
    r'  function renderMovimentos\(\) \{.*?\n  \}\n\n  function renderProcessosAdmin\(\)',
    novo_render,
    'renderMovimentos'
)

texto = trocar_uma(
    texto,
    '''  async function abrirChegada(movementId, editing = false) {\n    movimentoChegada = movimentos.find(item => String(item.id) === String(movementId)) || null;\n    if (!movimentoChegada) return toast("Movimentação não encontrada.", "error");''',
    '''  async function abrirChegada(movementId, editing = false) {\n    const encontrada = movimentos.find(item => String(item.id) === String(movementId)) || null;\n    if (!encontrada) return toast("Movimentação não encontrada.", "error");\n    if (!editing && movimentoLegadoForaCorte(encontrada)) {\n      if (abrirChegadaLegada(encontrada.id)) return;\n      return toast("Não foi possível abrir a chegada desta movimentação legada.", "error");\n    }\n    movimentoChegada = encontrada;''',
    'chegada legada'
)

texto = trocar_uma(
    texto,
    '      if (target.closest("#btnCorteRegistrarSaida")) return abrirSaida();\n',
    '''      if (target.closest("#btnCorteRegistrarSaida")) return abrirSaida();\n      if (target.closest("#btnChegadaManualLateralAlca")) {\n        garantirProcessosChegadaManual();\n        document.getElementById("btnAbrirChegadaManualFaccao")?.click();\n        setTimeout(garantirProcessosChegadaManual, 80);\n        return;\n      }\n''',
    'clique de chegada manual'
)
texto = trocar_uma(
    texto,
    '      if (form.id === "formRevisaoComponentes") atualizarOrigemAposRevisaoInterna();\n',
    '''      if (form.id === "formRevisaoComponentes") atualizarOrigemAposRevisaoInterna();\n      if (["formChegadaMovimentacao", "formChegadaManualFaccao", "s3form"].includes(form.id)) {\n        setTimeout(() => {\n          if (abaAtiva === "corte") carregarTudoCorte(true).catch(() => {});\n        }, 1200);\n      }\n''',
    'atualização após fluxos externos'
)
texto = trocar_regex(
    texto,
    r'\n    new MutationObserver\(\(\) => \{\n      injetarUI\(\);\n      atualizarVisibilidadeAdmin\(\);\n    \}\)\.observe\(document\.body, \{ childList: true, subtree: true \}\);',
    '',
    'MutationObserver global'
)

for proibido in ['new MutationObserver', 'corponu-faccoes-lateral-alca-integracao.js']:
    if proibido in texto:
        raise SystemExit(f'ERRO: módulo definitivo ainda contém {proibido}.')
for esperado in ['movimentoPertenceLateralAlca', 'btnChegadaManualLateralAlca', 'VALOR_FILTRO_ALCA']:
    if esperado not in texto:
        raise SystemExit(f'ERRO: módulo definitivo não contém {esperado}.')
MODULO.write_text(texto, encoding='utf-8')

abas = ABAS.read_text(encoding='utf-8')
abas = trocar_uma(abas, 'b.innerHTML = `Corte <span id="contCorte">0</span>`;', 'b.innerHTML = `Lateral e Alça <span id="contCorte">0</span>`;', 'rótulo da terceira aba')
abas = trocar_uma(abas, 'a === "calcinha" ? "Calcinha" : "Corte"', 'a === "calcinha" ? "Calcinha" : "Lateral e Alça"', 'título de saída da terceira aba')
abas = trocar_uma(abas, 'aba === "calcinha" ? "Calcinha" : "Corte"', 'aba === "calcinha" ? "Calcinha" : "Lateral e Alça"', 'confirmação da terceira aba')
ABAS.write_text(abas, encoding='utf-8')

atualizador = ATUALIZADOR.read_text(encoding='utf-8')
remendos = ['corponu-faccoes-lateral-alca-integracao.js', 'corponu-faccoes-label-lateral.js']
atualizador = '\n'.join(linha for linha in atualizador.split('\n') if not any(nome in linha for nome in remendos))
if any(nome in atualizador for nome in remendos):
    raise SystemExit('ERRO: o atualizador ainda carrega remendos de Lateral e Alça.')
ATUALIZADOR.write_text(atualizador, encoding='utf-8')

print('Unificação de Lateral e Alça aplicada com sucesso.')
