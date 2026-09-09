const fs = require('fs');

const arquivo = process.env.TARGET || 'corponu-manejo-calcinha-dedicado-252.js';
let source = fs.readFileSync(arquivo, 'utf8');

function substituirUnico(antigo, novo, descricao) {
  const qtd = source.split(antigo).length - 1;
  if (qtd !== 1) throw new Error(`${descricao}: esperado 1 ocorrência, encontrado ${qtd}`);
  source = source.replace(antigo, novo);
}

substituirUnico(
  '  const DATALIST_ID = "corponuManejoCalcinhaFases252";\n',
  '  const FASES_CONFIG_COLECAO = "configuracoes";\n  const FASES_CONFIG_DOCUMENTO = "fasesManejoCalcinha";\n',
  'constante de datalist 252'
);

// O arquivo 253 usa outro id de datalist.
source = source.replace(
  '  const DATALIST_ID = "corponuManejoCalcinhaFases253";\n',
  '  const FASES_CONFIG_COLECAO = "configuracoes";\n  const FASES_CONFIG_DOCUMENTO = "fasesManejoCalcinha";\n'
);

const ancoraEstado = '  let salvando = new Set();\n';
substituirUnico(
  ancoraEstado,
  `${ancoraEstado}  let fasesOficiaisCalcinha = [];\n  let fasesOficiaisCalcinhaStatus = "pendente";\n  let fasesOficiaisCalcinhaPromessa = null;\n`,
  'estado do módulo'
);

const padraoFases = /  function fasesDisponiveis\(ordens\) \{[\s\S]*?\n  \}\n\n  function injetarEstilo\(\) \{/;
const encontrados = source.match(padraoFases) || [];
if (encontrados.length !== 1) throw new Error(`fasesDisponiveis: esperado 1 bloco, encontrado ${encontrados.length}`);

const blocoFases = `  function normalizarListaFasesOficiaisCalcinha(lista) {\n    const mapa = new Map();\n    (Array.isArray(lista) ? lista : []).forEach(valor => {\n      const fase = texto(valor);\n      const chave = normalizar(fase);\n      if (fase && chave && !mapa.has(chave)) mapa.set(chave, fase);\n    });\n    return [...mapa.values()].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }));\n  }\n\n  async function carregarFasesOficiaisCalcinha({ forcar = false, somenteServidor = false } = {}) {\n    if (!forcar && fasesOficiaisCalcinhaStatus === "pronto") return [...fasesOficiaisCalcinha];\n    if (!forcar && fasesOficiaisCalcinhaPromessa) return fasesOficiaisCalcinhaPromessa;\n\n    const state = dual();\n    if (!state?.firebase || !state?.db) {\n      throw new Error("Firebase da Calcinha ainda não está disponível.");\n    }\n\n    fasesOficiaisCalcinhaStatus = "carregando";\n    const promessa = (async () => {\n      const { doc, getDoc, getDocFromServer } = state.firebase;\n      const referencia = doc(state.db, FASES_CONFIG_COLECAO, FASES_CONFIG_DOCUMENTO);\n      const ler = somenteServidor && typeof getDocFromServer === "function" ? getDocFromServer : getDoc;\n      if (typeof ler !== "function") throw new Error("Leitura da configuração oficial indisponível.");\n      const snapshot = await ler(referencia);\n      const lista = snapshot.exists()\n        ? normalizarListaFasesOficiaisCalcinha(snapshot.data()?.sugestoes)\n        : [];\n      fasesOficiaisCalcinha = lista;\n      fasesOficiaisCalcinhaStatus = "pronto";\n      return [...lista];\n    })();\n\n    fasesOficiaisCalcinhaPromessa = promessa;\n    try {\n      return await promessa;\n    } catch (error) {\n      fasesOficiaisCalcinhaStatus = fasesOficiaisCalcinha.length ? "pronto" : "erro";\n      throw error;\n    } finally {\n      if (fasesOficiaisCalcinhaPromessa === promessa) fasesOficiaisCalcinhaPromessa = null;\n    }\n  }\n\n  function garantirFasesOficiaisCalcinha() {\n    if (fasesOficiaisCalcinhaStatus === "carregando" || fasesOficiaisCalcinhaPromessa) return;\n    if (fasesOficiaisCalcinhaStatus === "pronto") return;\n    carregarFasesOficiaisCalcinha()\n      .then(() => agendarRender())\n      .catch(error => {\n        console.error("[Calcinha] Não foi possível carregar as fases oficiais.", error);\n        agendarRender();\n      });\n  }\n\n  function fasesDisponiveis() {\n    garantirFasesOficiaisCalcinha();\n    return [...fasesOficiaisCalcinha];\n  }\n\n  function renderCampoFaseOficialCalcinha(faseAtual, numeroOP = "") {\n    garantirFasesOficiaisCalcinha();\n    const atual = texto(faseAtual);\n    const chaveAtual = normalizar(atual);\n    const mapa = new Map(fasesOficiaisCalcinha.map(fase => [normalizar(fase), fase]));\n    const atualEhOficial = chaveAtual && mapa.has(chaveAtual);\n\n    if (fasesOficiaisCalcinhaStatus === "pendente" || fasesOficiaisCalcinhaStatus === "carregando") {\n      return '<select data-campo="fase" disabled aria-label="Fase da OP ' + escapeHtml(numeroOP) + '"><option>Carregando fases...</option></select>';\n    }\n\n    if (fasesOficiaisCalcinhaStatus === "erro") {\n      return '<select data-campo="fase" disabled aria-label="Fase da OP ' + escapeHtml(numeroOP) + '"><option>Não foi possível carregar as fases</option></select>';\n    }\n\n    const opcoes = [];\n    if (!atual) {\n      opcoes.push('<option value="" selected>Selecione a fase</option>');\n    } else if (!atualEhOficial) {\n      opcoes.push('<option value="" selected>Fase antiga: ' + escapeHtml(atual) + ' — escolha uma oficial</option>');\n    } else {\n      opcoes.push('<option value="">Selecione a fase</option>');\n    }\n\n    fasesOficiaisCalcinha.forEach(fase => {\n      const selecionada = normalizar(fase) === chaveAtual ? ' selected' : '';\n      opcoes.push('<option value="' + escapeHtml(fase) + '"' + selecionada + '>' + escapeHtml(fase) + '</option>');\n    });\n\n    return '<select data-campo="fase" aria-label="Fase da OP ' + escapeHtml(numeroOP) + '">' + opcoes.join('') + '</select>';\n  }\n\n  async function validarFaseOficialCalcinhaAntesDeSalvar(faseInformada) {\n    const fase = texto(faseInformada);\n    if (!fase) {\n      mensagem("Escolha uma fase cadastrada pelo administrador para a Calcinha.", "erro");\n      return "";\n    }\n\n    let oficiais;\n    try {\n      oficiais = await carregarFasesOficiaisCalcinha({ forcar: true, somenteServidor: true });\n    } catch (error) {\n      console.error("[Calcinha] Não foi possível validar a fase diretamente no servidor.", error);\n      mensagem("Não foi possível confirmar a lista oficial de fases. Confira a internet e tente novamente.", "erro");\n      return "";\n    }\n\n    const chave = normalizar(fase);\n    const oficial = oficiais.find(item => normalizar(item) === chave) || "";\n    if (!oficial) {\n      mensagem("Essa fase não está cadastrada pelo administrador para a Calcinha.", "erro");\n      return "";\n    }\n    return oficial;\n  }\n\n  function injetarEstilo() {`;
source = source.replace(padraoFases, blocoFases);

// Remove o datalist estrutural; a fonte oficial agora é o select fechado.
source = source.replace(/\n\s*<datalist id="\$\{DATALIST_ID\}"><\/datalist>/g, '');

const campoLivre = '        <input data-campo="fase" type="text" list="${DATALIST_ID}" autocomplete="off" value="${escapeHtml(v.fase)}" placeholder="Fase">';
substituirUnico(
  campoLivre,
  '        ${renderCampoFaseOficialCalcinha(v.fase, op.numeroOP || "")}',
  'campo livre de fase'
);

// A lista do filtro da versão 253 também passa a ser somente oficial.
source = source.replace('    const fases = fasesDisponiveis(todas);', '    const fases = fasesDisponiveis();');
source = source.replace('    const fases = fasesDisponiveis(ordens);', '    const fases = fasesDisponiveis();');

// Remove renderização do datalist legado nas duas variantes.
source = source.replace(/\n\s*const datalist = document\.getElementById\(DATALIST_ID\);\n\s*if \(datalist\) datalist\.innerHTML = fases\.map\(fase => `<option value="\$\{escapeHtml\(fase\)\}"><\/option>`\)\.join\(""\);/g, '');

const ancoraValidacao = '    const statusAtual = statusDaOp(op);\n';
substituirUnico(
  ancoraValidacao,
  `    const faseOficial = await validarFaseOficialCalcinhaAntesDeSalvar(dados.fase);\n    if (!faseOficial) return false;\n    dados.fase = faseOficial;\n\n${ancoraValidacao}`,
  'validação antes do salvamento'
);

// Invariantes: não pode restar qualquer fonte livre/legada de fase neste módulo.
const proibidos = [
  'fasesManejoExtras',
  'list="${DATALIST_ID}"',
  '<datalist id="${DATALIST_ID}">',
  'document.querySelectorAll("#manejoFasesList option")'
];
for (const trecho of proibidos) {
  if (source.includes(trecho)) throw new Error(`fonte legada ainda presente: ${trecho}`);
}

for (const esperado of [
  'FASES_CONFIG_DOCUMENTO = "fasesManejoCalcinha"',
  'function renderCampoFaseOficialCalcinha',
  'async function validarFaseOficialCalcinhaAntesDeSalvar',
  'somenteServidor: true',
  'Essa fase não está cadastrada pelo administrador para a Calcinha.',
  '${renderCampoFaseOficialCalcinha(v.fase, op.numeroOP || "")}',
  'const faseOficial = await validarFaseOficialCalcinhaAntesDeSalvar(dados.fase);'
]) {
  if (!source.includes(esperado)) throw new Error(`invariante ausente: ${esperado}`);
}

fs.writeFileSync(arquivo, source, 'utf8');
console.log(`Fase oficial da Calcinha aplicada estruturalmente em ${arquivo}.`);
