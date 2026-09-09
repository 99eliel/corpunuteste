const fs = require('fs');

const arquivo = 'app.js';
let source = fs.readFileSync(arquivo, 'utf8');

function replaceOnce(antigo, novo, descricao) {
  const qtd = source.split(antigo).length - 1;
  if (qtd !== 1) throw new Error(`${descricao}: esperado 1 ocorrência, encontrado ${qtd}`);
  source = source.replace(antigo, novo);
}

replaceOnce(
  'const OTIMIZACAO_LEITURAS_ATIVA = true;\n',
  `const OTIMIZACAO_LEITURAS_ATIVA = true;\n\nconst movimentacoesPorId = new Map();\nconst cacheFaccaoPorIdFiltro = new Map();\nconst cacheFaccaoPorNomeFiltro = new Map();\n\nfunction reconstruirIndiceMovimentacoes() {\n  movimentacoesPorId.clear();\n  (state.movimentacoesProducao || []).forEach(item => {\n    const id = String(item?.id || \"\").trim();\n    if (id) movimentacoesPorId.set(id, item);\n  });\n}\n\nfunction getMovimentacaoPorId(id) {\n  const chave = String(id || \"\").trim();\n  if (!chave) return null;\n  return movimentacoesPorId.get(chave) || null;\n}\n\nfunction invalidarCacheIdentidadeFaccoes() {\n  cacheFaccaoPorIdFiltro.clear();\n  cacheFaccaoPorNomeFiltro.clear();\n}\n`,
  'âncora dos índices'
);

replaceOnce(
  '    state.faccoes = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));\n    marcarCarregado("faccoes");',
  '    state.faccoes = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));\n    invalidarCacheIdentidadeFaccoes();\n    marcarCarregado("faccoes");',
  'snapshot de facções'
);

replaceOnce(
  '    state.movimentacoesProducao = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));\n    marcarCarregado("movimentacoes");\n    renderRastreamento();\n    renderFaccoesMovimentacoes();\n    renderCelulasMovimentacoes();\n    if (document.getElementById("pagamentos")?.classList.contains("active")) renderPagamentos();',
  '    state.movimentacoesProducao = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));\n    reconstruirIndiceMovimentacoes();\n    marcarCarregado("movimentacoes");\n    renderPaginaAtiva();',
  'snapshot de movimentações'
);

// Cache canônico de facções mantendo o mesmo critério antigo de prioridade.
const inicioId = source.indexOf('function getFaccaoCadastroPorIdFiltro(id) {');
const fimIdentidade = source.indexOf('function identidadeFaccaoMovimentacao(mov) {', inicioId);
if (inicioId < 0 || fimIdentidade < 0) throw new Error('Bloco de identidade das facções não encontrado.');
source = source.slice(0, inicioId) + `function getFaccaoCadastroPorIdFiltro(id) {\n  const chave = String(id ?? \"\").trim();\n  if (!chave) return null;\n  if (cacheFaccaoPorIdFiltro.has(chave)) return cacheFaccaoPorIdFiltro.get(chave);\n\n  const encontrada = (state.faccoes || []).find(faccao => String(faccao?.id || \"\").trim() === chave) || null;\n  let resultado = encontrada;\n  if (encontrada?.duplicadaDe) {\n    resultado = (state.faccoes || []).find(\n      faccao => String(faccao?.id || \"\").trim() === String(encontrada.duplicadaDe)\n    ) || encontrada;\n  }\n\n  cacheFaccaoPorIdFiltro.set(chave, resultado);\n  return resultado;\n}\n\nfunction getFaccaoCadastroPorNomeExatoFiltro(nome) {\n  const chave = chaveExataFaccoes(nome);\n  if (!chave) return null;\n  if (cacheFaccaoPorNomeFiltro.has(chave)) return cacheFaccaoPorNomeFiltro.get(chave);\n\n  const candidatos = (state.faccoes || [])\n    .filter(faccao => chaveExataFaccoes(faccao?.nome) === chave)\n    .map(faccao => faccao?.duplicadaDe ? (getFaccaoCadastroPorIdFiltro(faccao.duplicadaDe) || faccao) : faccao)\n    .filter(Boolean);\n\n  if (!candidatos.length) {\n    cacheFaccaoPorNomeFiltro.set(chave, null);\n    return null;\n  }\n\n  const unicos = new Map();\n  candidatos.forEach(faccao => {\n    const id = String(faccao?.id || \"\").trim() || chaveExataFaccoes(faccao?.nome);\n    if (id && !unicos.has(id)) unicos.set(id, faccao);\n  });\n  const lista = [...unicos.values()];\n  const ativos = lista.filter(faccao => faccao?.ativo !== false && faccao?.statusImportacao !== \"duplicada_consolidada\");\n  const resultado = ativos[0] || lista[0] || null;\n  cacheFaccaoPorNomeFiltro.set(chave, resultado);\n  return resultado;\n}\n\n` + source.slice(fimIdentidade);

// Troca apenas os botões da tabela oficial de Facções.
const inicioChegada = source.indexOf('function htmlAcaoChegadaFaccoes(mov) {');
const fimChegada = source.indexOf('function getFiltrosFaccoesMovimentacoes()', inicioChegada);
if (inicioChegada < 0 || fimChegada < 0) throw new Error('Bloco de chegada de Facções não encontrado.');
let chegada = source.slice(inicioChegada, fimChegada);
const onclickChegada = "onclick=\"registrarChegadaMovimentacao('${mov.id}')\"";
chegada = chegada.split(onclickChegada).join("type=\"button\" data-faccoes-acao=\"chegada\" data-movimentacao-id=\"${mov.id}\"");
if (chegada.includes('onclick="registrarChegadaMovimentacao')) throw new Error('Chegada ainda depende de onclick.');
source = source.slice(0, inicioChegada) + chegada + source.slice(fimChegada);

let inicioRender = source.indexOf('function renderFaccoesMovimentacoes() {');
let fimRender = source.indexOf('\nfunction ', inicioRender + 40);
if (inicioRender < 0 || fimRender < 0) throw new Error('Bloco renderFaccoesMovimentacoes não encontrado.');
let render = source.slice(inicioRender, fimRender);
render = render
  .split("onclick=\"biparMovimentacao('${mov.id}')\"").join("type=\"button\" data-faccoes-acao=\"bipar\" data-movimentacao-id=\"${mov.id}\"")
  .split("onclick=\"excluirMovimentacao('${mov.id}')\"").join("type=\"button\" data-faccoes-acao=\"excluir\" data-movimentacao-id=\"${mov.id}\"");
if (render.includes('onclick="biparMovimentacao') || render.includes('onclick="excluirMovimentacao')) {
  throw new Error('Bipar/Excluir ainda dependem de onclick na tabela Facções.');
}
const ancoraTbody = '  const tbody = document.getElementById("listaFaccoesMovimentacoes");\n  if (!tbody) return;\n';
if (!render.includes(ancoraTbody)) throw new Error('Âncora do tbody de Facções não encontrada.');
render = render.replace(ancoraTbody, ancoraTbody + '  instalarControladorAcoesFaccoes();\n');
source = source.slice(0, inicioRender) + render + source.slice(fimRender);

// Um único controlador para chegada, bipar e excluir.
const controlador = `let controladorAcoesFaccoesInstalado = false;\n\nfunction instalarControladorAcoesFaccoes() {\n  if (controladorAcoesFaccoesInstalado) return;\n  const tbody = document.getElementById(\"listaFaccoesMovimentacoes\");\n  if (!tbody) return;\n\n  tbody.addEventListener(\"click\", event => {\n    const botao = event.target.closest?.(\"[data-faccoes-acao][data-movimentacao-id]\");\n    if (!botao || !tbody.contains(botao)) return;\n    event.preventDefault();\n\n    const acao = String(botao.dataset.faccoesAcao || \"\").trim();\n    const id = String(botao.dataset.movimentacaoId || \"\").trim();\n    if (!id) return;\n\n    if (acao === \"chegada\") {\n      registrarChegadaMovimentacao(id);\n      return;\n    }\n    if (acao === \"bipar\") {\n      Promise.resolve(biparMovimentacao(id)).catch(error => {\n        console.error(\"Erro na ação Bipar de Facções.\", error);\n        toast(\"Não foi possível bipar a movimentação.\");\n      });\n      return;\n    }\n    if (acao === \"excluir\") {\n      Promise.resolve(excluirMovimentacao(id)).catch(error => {\n        console.error(\"Erro na ação Excluir de Facções.\", error);\n        toast(\"Não foi possível excluir a movimentação.\");\n      });\n    }\n  });\n\n  controladorAcoesFaccoesInstalado = true;\n}\n\n`;
replaceOnce('function renderFaccoesMovimentacoes() {', controlador + 'function renderFaccoesMovimentacoes() {', 'controlador de ações');

// Índice único para as ações, sem novas buscas lineares a cada clique.
source = source.replaceAll('const mov = state.movimentacoesProducao.find(item => item.id === id);', 'const mov = getMovimentacaoPorId(id);');
source = source.replace('const mov = state.movimentacoesProducao.find(item => item.id === movimentacaoId);', 'const mov = getMovimentacaoPorId(movimentacaoId);');

for (const esperado of [
  'const movimentacoesPorId = new Map();',
  'function reconstruirIndiceMovimentacoes()',
  'function getMovimentacaoPorId(id)',
  'function invalidarCacheIdentidadeFaccoes()',
  'function instalarControladorAcoesFaccoes()',
  'data-faccoes-acao="chegada"',
  'data-faccoes-acao="bipar"',
  'data-faccoes-acao="excluir"',
  'reconstruirIndiceMovimentacoes();',
  'renderPaginaAtiva();'
]) {
  if (!source.includes(esperado)) throw new Error(`Invariante ausente: ${esperado}`);
}

fs.writeFileSync(arquivo, source, 'utf8');
console.log('Facções 300 aplicada: ações delegadas, índice de movimentações e cache de identidade.');
