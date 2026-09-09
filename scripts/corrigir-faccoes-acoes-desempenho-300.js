const fs = require('fs');

const arquivo = 'app.js';
let source = fs.readFileSync(arquivo, 'utf8');

function replaceOnce(antigo, novo, descricao) {
  const qtd = source.split(antigo).length - 1;
  if (qtd !== 1) throw new Error(`${descricao}: esperado 1 ocorrência, encontrado ${qtd}`);
  source = source.replace(antigo, novo);
}

// Índices/caches compartilhados: uma única fonte para as ações e para a identidade das facções.
replaceOnce(
  'const OTIMIZACAO_LEITURAS_ATIVA = true;\n',
  `const OTIMIZACAO_LEITURAS_ATIVA = true;\n\nconst movimentacoesPorId = new Map();\nconst cacheFaccaoPorIdFiltro = new Map();\nconst cacheFaccaoPorNomeFiltro = new Map();\n\nfunction reconstruirIndiceMovimentacoes() {\n  movimentacoesPorId.clear();\n  (state.movimentacoesProducao || []).forEach(item => {\n    const id = String(item?.id || \"\").trim();\n    if (id) movimentacoesPorId.set(id, item);\n  });\n}\n\nfunction getMovimentacaoPorId(id) {\n  const chave = String(id || \"\").trim();\n  if (!chave) return null;\n  return movimentacoesPorId.get(chave) || null;\n}\n\nfunction invalidarCacheIdentidadeFaccoes() {\n  cacheFaccaoPorIdFiltro.clear();\n  cacheFaccaoPorNomeFiltro.clear();\n}\n`,
  'âncora dos índices'
);

// O snapshot de facções invalida o cache canônico uma vez, em vez de recalcular a lista inteira a cada linha.
replaceOnce(
  '    state.faccoes = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));\n    marcarCarregado("faccoes");',
  '    state.faccoes = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));\n    invalidarCacheIdentidadeFaccoes();\n    marcarCarregado("faccoes");',
  'snapshot de facções'
);

// O snapshot de movimentações reconstrói o índice e só renderiza a página ativa.
replaceOnce(
  `    state.movimentacoesProducao = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));\n    marcarCarregado("movimentacoes");\n    renderRastreamento();\n    renderFaccoesMovimentacoes();\n    renderCelulasMovimentacoes();\n    if (document.getElementById("pagamentos")?.classList.contains("active")) renderPagamentos();`,
  `    state.movimentacoesProducao = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));\n    reconstruirIndiceMovimentacoes();\n    marcarCarregado("movimentacoes");\n    renderPaginaAtiva();`,
  'snapshot de movimentações'
);

// Mantém exatamente a semântica antiga da identidade, mas memoriza o resultado enquanto a coleção não muda.
const inicioId = source.indexOf('function getFaccaoCadastroPorIdFiltro(id) {');
const fimIdentidade = source.indexOf('function identidadeFaccaoMovimentacao(mov) {', inicioId);
if (inicioId < 0 || fimIdentidade < 0) throw new Error('Bloco de identidade das facções não encontrado.');
const blocoIdentidade = `function getFaccaoCadastroPorIdFiltro(id) {\n  const chave = String(id ?? \"\").trim();\n  if (!chave) return null;\n  if (cacheFaccaoPorIdFiltro.has(chave)) return cacheFaccaoPorIdFiltro.get(chave);\n\n  const encontrada = (state.faccoes || []).find(faccao => String(faccao?.id || \"\").trim() === chave) || null;\n  let resultado = encontrada;\n  if (encontrada?.duplicadaDe) {\n    resultado = (state.faccoes || []).find(\n      faccao => String(faccao?.id || \"\").trim() === String(encontrada.duplicadaDe)\n    ) || encontrada;\n  }\n\n  cacheFaccaoPorIdFiltro.set(chave, resultado);\n  return resultado;\n}\n\nfunction getFaccaoCadastroPorNomeExatoFiltro(nome) {\n  const chave = chaveExataFaccoes(nome);\n  if (!chave) return null;\n  if (cacheFaccaoPorNomeFiltro.has(chave)) return cacheFaccaoPorNomeFiltro.get(chave);\n\n  const candidatos = (state.faccoes || [])\n    .filter(faccao => chaveExataFaccoes(faccao?.nome) === chave)\n    .map(faccao => faccao?.duplicadaDe ? (getFaccaoCadastroPorIdFiltro(faccao.duplicadaDe) || faccao) : faccao)\n    .filter(Boolean);\n\n  if (!candidatos.length) {\n    cacheFaccaoPorNomeFiltro.set(chave, null);\n    return null;\n  }\n\n  const unicos = new Map();\n  candidatos.forEach(faccao => {\n    const id = String(faccao?.id || \"\").trim() || chaveExataFaccoes(faccao?.nome);\n    if (id && !unicos.has(id)) unicos.set(id, faccao);\n  });\n\n  const lista = [...unicos.values()];\n  const ativos = lista.filter(faccao => faccao?.ativo !== false && faccao?.statusImportacao !== \"duplicada_consolidada\");\n  const resultado = ativos[0] || lista[0] || null;\n  cacheFaccaoPorNomeFiltro.set(chave, resultado);\n  return resultado;\n}\n\n`;
source = source.slice(0, inicioId) + blocoIdentidade + source.slice(fimIdentidade);

// A tabela de Facções deixa de depender de onclick inline.
const inicioChegada = source.indexOf('function htmlAcaoChegadaFaccoes(mov) {');
const fimChegada = source.indexOf('function getFiltrosFaccoesMovimentacoes()', inicioChegada);
if (inicioChegada < 0 || fimChegada < 0) throw new Error('Bloco htmlAcaoChegadaFaccoes não encontrado.');
let blocoChegada = source.slice(inicioChegada, fimChegada);
blocoChegada = blocoChegada
  .replaceAll(`onclick=\"registrarChegadaMovimentacao('\\\${mov.id}')\"`, `type=\"button\" data-faccoes-acao=\"chegada\" data-movimentacao-id=\"\\\${mov.id}\"`);
if (blocoChegada.includes('onclick="registrarChegadaMovimentacao')) {
  // fallback para a forma literal presente no template do arquivo
  blocoChegada = blocoChegada.replace(/onclick="registrarChegadaMovimentacao\('\$\{mov\.id\}'\)"/g,
    'type="button" data-faccoes-acao="chegada" data-movimentacao-id="${mov.id}"');
}
source = source.slice(0, inicioChegada) + blocoChegada + source.slice(fimChegada);

const inicioRender = source.indexOf('function renderFaccoesMovimentacoes() {');
if (inicioRender < 0) throw new Error('renderFaccoesMovimentacoes não encontrado.');
const proximaFuncao = source.indexOf('\nfunction ', inicioRender + 40);
if (proximaFuncao < 0) throw new Error('Fim de renderFaccoesMovimentacoes não encontrado.');
let blocoRender = source.slice(inicioRender, proximaFuncao);
blocoRender = blocoRender
  .replace(/onclick="biparMovimentacao\('\$\{mov\.id\}'\)"/g,
    'type="button" data-faccoes-acao="bipar" data-movimentacao-id="${mov.id}"')
  .replace(/onclick="excluirMovimentacao\('\$\{mov\.id\}'\)"/g,
    'type="button" data-faccoes-acao="excluir" data-movimentacao-id="${mov.id}"');
source = source.slice(0, inicioRender) + blocoRender + source.slice(proximaFuncao);

// Controlador único e delegado da tabela. Nada de um listener por linha.
const ancoraRender = 'function renderFaccoesMovimentacoes() {';
if ((source.split(ancoraRender).length - 1) !== 1) throw new Error('renderFaccoesMovimentacoes deixou de ser único.');
const controlador = `let controladorAcoesFaccoesInstalado = false;\n\nfunction instalarControladorAcoesFaccoes() {\n  if (controladorAcoesFaccoesInstalado) return;\n  const tbody = document.getElementById(\"listaFaccoesMovimentacoes\");\n  if (!tbody) return;\n\n  tbody.addEventListener(\"click\", event => {\n    const botao = event.target.closest?.(\"[data-faccoes-acao][data-movimentacao-id]\");\n    if (!botao || !tbody.contains(botao)) return;\n\n    event.preventDefault();\n    const acao = String(botao.dataset.faccoesAcao || \"\").trim();\n    const id = String(botao.dataset.movimentacaoId || \"\").trim();\n    if (!id) return;\n\n    if (acao === \"chegada\") {\n      registrarChegadaMovimentacao(id);\n      return;\n    }\n    if (acao === \"bipar\") {\n      Promise.resolve(biparMovimentacao(id)).catch(error => {\n        console.error(\"Erro na ação Bipar de Facções.\", error);\n        toast(\"Não foi possível bipar a movimentação.\");\n      });\n      return;\n    }\n    if (acao === \"excluir\") {\n      Promise.resolve(excluirMovimentacao(id)).catch(error => {\n        console.error(\"Erro na ação Excluir de Facções.\", error);\n        toast(\"Não foi possível excluir a movimentação.\");\n      });\n    }\n  });\n\n  controladorAcoesFaccoesInstalado = true;\n}\n\n`;
source = source.replace(ancoraRender, controlador + ancoraRender);
replaceOnce(
  '  const tbody = document.getElementById("listaFaccoesMovimentacoes");\n  if (!tbody) return;\n',
  '  const tbody = document.getElementById("listaFaccoesMovimentacoes");\n  if (!tbody) return;\n  instalarControladorAcoesFaccoes();\n',
  'instalação do controlador da tabela'
);

// As três ações usam o índice único de movimentações.
source = source.replaceAll(
  'const mov = state.movimentacoesProducao.find(item => item.id === id);',
  'const mov = getMovimentacaoPorId(id);'
);
source = source.replace(
  'const mov = state.movimentacoesProducao.find(item => item.id === movimentacaoId);',
  'const mov = getMovimentacaoPorId(movimentacaoId);'
);

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

const renderAtual = source.slice(source.indexOf('function renderFaccoesMovimentacoes() {'), source.indexOf('\nfunction ', source.indexOf('function renderFaccoesMovimentacoes() {') + 40));
if (renderAtual.includes('onclick="excluirMovimentacao') || renderAtual.includes('onclick="biparMovimentacao')) {
  throw new Error('A tabela Facções ainda possui onclick de Bipar/Excluir.');
}
const chegadaAtual = source.slice(source.indexOf('function htmlAcaoChegadaFaccoes(mov) {'), source.indexOf('function getFiltrosFaccoesMovimentacoes()', source.indexOf('function htmlAcaoChegadaFaccoes(mov) {')));
if (chegadaAtual.includes('onclick="registrarChegadaMovimentacao')) {
  throw new Error('A ação de chegada ainda possui onclick inline.');
}

fs.writeFileSync(arquivo, source, 'utf8');
console.log('Facções 300: ações delegadas, índices e renderização ativa aplicados.');
