const fs = require('fs');
const vm = require('vm');
const path = require('path');

const raiz = process.cwd();
const loaderPath = path.join(raiz, 'corponu-faccoes-corte.js');
const saidaPath = path.join(raiz, 'corponu-faccoes-corte-definitivo.js');

if (!fs.existsSync(loaderPath)) {
  throw new Error('corponu-faccoes-corte.js não encontrado.');
}

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
    return {
      ok: false,
      status: 404,
      text: async () => ''
    };
  }

  return {
    ok: true,
    status: 200,
    text: async () => fs.readFileSync(arquivo, 'utf8')
  };
}

const windowFake = {};
const contexto = {
  window: windowFake,
  document: documentFake,
  fetch: fetchLocal,
  Blob: BlobFake,
  URL: {
    createObjectURL() {
      return 'blob:corponu-faccoes-corte-definitivo';
    },
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
vm.runInContext(fonteLoader, contexto, {
  filename: 'corponu-faccoes-corte.js'
});

(async () => {
  const limite = Date.now() + 10000;
  while (!fonteGerada && Date.now() < limite) {
    await new Promise(resolve => setTimeout(resolve, 25));
  }

  if (!fonteGerada) {
    throw new Error('Não foi possível capturar o módulo consolidado gerado pelo loader atual.');
  }

  if (!fonteGerada.includes('__CORPONU_FACCOES_CORTE__')) {
    throw new Error('Saída consolidada não contém o marcador esperado do módulo de Facções/Corte.');
  }

  const cabecalho = [
    '/*',
    ' * Módulo consolidado de Facções / Corte / Lateral e Alça.',
    ' * Gerado a partir do comportamento efetivo do loader legado para remover',
    ' * fetch de fragmentos .txt, alterações de código em runtime e execução via Blob.',
    ' */',
    ''
  ].join('\n');

  fs.writeFileSync(saidaPath, cabecalho + fonteGerada.trim() + '\n', 'utf8');
  console.log(`Gerado: ${path.basename(saidaPath)} (${fs.statSync(saidaPath).size} bytes)`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
