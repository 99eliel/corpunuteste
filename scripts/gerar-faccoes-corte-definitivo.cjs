const fs = require('fs');
const vm = require('vm');
const path = require('path');

const raiz = process.cwd();
const loaderPath = path.join(raiz, 'corponu-faccoes-corte.js');
const saidaPath = path.join(raiz, 'corponu-faccoes-corte-definitivo.js');
const atualizadorPath = path.join(raiz, 'corponu-atualizador.js');

if (!fs.existsSync(loaderPath)) throw new Error('corponu-faccoes-corte.js não encontrado.');
if (!fs.existsSync(atualizadorPath)) throw new Error('corponu-atualizador.js não encontrado.');

const fonteLoader = fs.readFileSync(loaderPath, 'utf8');
let ultimoBlob = null;
let fonteGerada = '';

class BlobFake {
  constructor(partes = []) {
    this.texto = partes.map(parte => String(parte ?? '')).join('');
    ultimoBlob = this;
  }
}

const scripts = [];
const documentFake = {
  scripts,
  head: {
    appendChild(elemento) {
      if (!scripts.includes(elemento)) scripts.push(elemento);
      const src = String(elemento.src || '');
      if (src.startsWith('blob:corponu-faccoes-corte')) {
        if (!ultimoBlob?.texto) throw new Error('Loader criou script Blob sem conteúdo.');
        fonteGerada = ultimoBlob.texto;
      }
      queueMicrotask(() => elemento.onload?.());
      return elemento;
    }
  },
  createElement(tag) {
    return {
      tagName: String(tag || '').toUpperCase(),
      dataset: {},
      async: false,
      src: '',
      onload: null,
      onerror: null
    };
  }
};

async function fetchLocal(url) {
  const nome = decodeURIComponent(String(url || ''))
    .replace(/^\.\//, '')
    .split('?')[0]
    .split('#')[0];
  const arquivo = path.join(raiz, nome);
  if (!arquivo.startsWith(raiz) || !fs.existsSync(arquivo)) {
    return { ok: false, status: 404, text: async () => '' };
  }
  return { ok: true, status: 200, text: async () => fs.readFileSync(arquivo, 'utf8') };
}

const windowFake = {};
const contexto = {
  window: windowFake,
  document: documentFake,
  fetch: fetchLocal,
  Blob: BlobFake,
  URL: {
    createObjectURL() { return 'blob:corponu-faccoes-corte-definitivo'; },
    revokeObjectURL() {}
  },
  console,
  Date,
  Promise,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  queueMicrotask,
  encodeURIComponent,
  decodeURIComponent
};
contexto.globalThis = contexto;
vm.createContext(contexto);
vm.runInContext(fonteLoader, contexto, { filename: 'corponu-faccoes-corte.js' });

function incorporarSemGerenciamento(fonte) {
  let resultado = String(fonte || '');
  const botao = '          <button class="btn corte-admin hidden" id="btnCorteGerenciar" type="button">Gerenciar processos e valores</button>\n';
  if (!resultado.includes(botao)) throw new Error('Botão de gerenciamento antigo não encontrado no módulo consolidado.');
  resultado = resultado.replace(botao, '');

  const inicioPainel = resultado.indexOf('      <div id="cortePainelAdmin" class="corte-admin hidden">');
  const fimTemplate = resultado.indexOf('    `;\n  }\n\n  function montarModais()', inicioPainel);
  if (inicioPainel < 0 || fimTemplate < 0) throw new Error('Painel de gerenciamento antigo não foi localizado com segurança.');
  resultado = resultado.slice(0, inicioPainel) + resultado.slice(fimTemplate);

  const handler = `      if (target.closest("#btnCorteGerenciar")) {\n        const panel = document.getElementById("cortePainelAdmin");\n        panel?.classList.toggle("hidden");\n        return;\n      }\n`;
  if (!resultado.includes(handler)) throw new Error('Handler do gerenciamento antigo não encontrado.');
  resultado = resultado.replace(handler, '');

  if (resultado.includes('id="btnCorteGerenciar"') || resultado.includes('id="cortePainelAdmin"')) {
    throw new Error('Gerenciamento antigo ainda existe no módulo definitivo.');
  }
  return resultado;
}

function incorporarObservacaoOpcional(fonte) {
  const antiga = '<label>Observação<textarea id="chegadaCorteObs" rows="2" placeholder="Ex.: Sem observações" required></textarea></label>';
  const nova = '<label>Observação (opcional)<textarea id="chegadaCorteObs" rows="2" placeholder="Opcional"></textarea></label>';
  if (!fonte.includes(antiga)) throw new Error('Campo antigo de observação obrigatória não encontrado.');
  const resultado = fonte.replace(antiga, nova);
  if (/id="chegadaCorteObs"[^>]*required/.test(resultado)) throw new Error('Observação de Lateral ainda ficou obrigatória.');
  return resultado;
}

function incorporarChegadaSemBotaoTopo(fonte) {
  let resultado = String(fonte || '');
  const botao = '          <button class="btn btn-success" id="btnCorteRegistrarChegada" type="button">Registrar chegada</button>\n';
  const handler = '      if (target.closest("#btnCorteRegistrarChegada")) return abrirSeletorChegada();\n';
  if (!resultado.includes(botao)) throw new Error('Botão superior de chegada antigo não encontrado.');
  if (!resultado.includes(handler)) throw new Error('Handler do botão superior de chegada não encontrado.');
  resultado = resultado.replace(botao, '').replace(handler, '');
  if (resultado.includes('id="btnCorteRegistrarChegada"')) throw new Error('Botão superior de chegada ainda existe.');
  return resultado;
}

(async () => {
  const limite = Date.now() + 10000;
  while (!fonteGerada && Date.now() < limite) await new Promise(resolve => setTimeout(resolve, 25));

  if (!fonteGerada) throw new Error('Não foi possível capturar o módulo consolidado gerado pelo loader atual.');
  if (!fonteGerada.includes('__CORPONU_FACCOES_CORTE__')) throw new Error('Saída consolidada sem marcador esperado.');

  fonteGerada = incorporarSemGerenciamento(fonteGerada);
  fonteGerada = incorporarObservacaoOpcional(fonteGerada);
  fonteGerada = incorporarChegadaSemBotaoTopo(fonteGerada);

  const cabecalho = [
    '/*',
    ' * Módulo consolidado de Facções / Corte / Lateral e Alça.',
    ' * As correções válidas do loader legado são incorporadas aqui, sem remendos em runtime.',
    ' */',
    ''
  ].join('\n');
  fs.writeFileSync(saidaPath, cabecalho + fonteGerada.trim() + '\n', 'utf8');

  const entradaLegada = '    ["corponu-faccoes-corte.js", "faccoes-corte", "Não foi possível carregar a área interna das facções."],';
  const entradasDefinitivas = [
    '    ["corponu-saida-sem-confirmacao.js", "saida-sem-confirmacao-dupla", "Não foi possível carregar a proteção contra saída duplicada."],',
    '    ["corponu-faccoes-corte-definitivo.js", "faccoes-corte-definitivo", "Não foi possível carregar a área definitiva de Corte / Lateral e Alça."],',
    '    ["corponu-faccoes-tres-abas-saida.js", "faccoes-tres-abas-saida", "Não foi possível carregar as três abas de Facções."],',
    '    ["corponu-faccoes-processos-cadastrados.js", "faccoes-processos-cadastrados", "Não foi possível carregar os processos cadastrados no registro de saída."],',
    '    ["corponu-faccoes-sem-resumo-processos.js", "faccoes-sem-resumo-processos", "Não foi possível remover o resumo antigo de processos da tela de Facções."],'
  ].join('\n');

  let atualizador = fs.readFileSync(atualizadorPath, 'utf8');
  if (atualizador.includes(entradaLegada)) atualizador = atualizador.replace(entradaLegada, entradasDefinitivas);
  else if (!atualizador.includes('corponu-faccoes-corte-definitivo.js')) throw new Error('Entrada definitiva não encontrada no atualizador.');

  const remendosIncorporados = [
    'corponu-faccoes-corte-sem-gerenciamento.js',
    'corponu-lateral-observacao-opcional.js',
    'corponu-faccoes-ocultar-registrar-chegada-topo.js'
  ];
  atualizador = atualizador.split('\n').filter(linha => !remendosIncorporados.some(nome => linha.includes(nome))).join('\n');
  fs.writeFileSync(atualizadorPath, atualizador, 'utf8');

  console.log(`Gerado: ${path.basename(saidaPath)} (${fs.statSync(saidaPath).size} bytes)`);
  console.log('Três remendos de Facções incorporados diretamente no módulo definitivo.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
