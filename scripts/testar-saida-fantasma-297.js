const fs = require('fs');
const vm = require('vm');

const ARQUIVO = 'corponu-faccoes-tres-abas-saida.js';
let src = fs.readFileSync(ARQUIVO, 'utf8');

const fim = src.lastIndexOf('})();');
if (fim < 0) throw new Error('Fim da IIFE não encontrado.');
src = src.slice(0, fim) + `globalThis.__FACCOES_297_TEST__ = {
  tipoDestinoCanonicoMovimentacao,
  movimentacaoBloqueiaNovaSaida,
  movimentacaoPrecisaCanonizacao
};\n` + src.slice(fim);

global.window = global;
global.document = {
  readyState: 'loading',
  addEventListener() {},
  getElementById() { return null; },
  querySelector() { return null; }
};
global.HTMLSelectElement = class {};
global.Element = class {};
global.performance = { now: () => 0 };
global.alert = () => {};
global.confirm = () => false;

vm.runInThisContext(src, { filename: ARQUIVO });
const api = global.__FACCOES_297_TEST__;
if (!api) throw new Error('API de teste não exposta.');

const base = {
  tipoDestino: 'faccao',
  tipoDestinoLabel: 'Facção',
  destino: 'FRANCILDA MOCINHA',
  processo: 'INTERLOCK',
  setor: 'sutia',
  area: 'sutia',
  status: 'em_andamento',
  dataChegada: '',
  cancelado: false,
  excluido: false
};

const assert = (condicao, mensagem) => {
  if (!condicao) throw new Error(mensagem);
};

assert(api.tipoDestinoCanonicoMovimentacao(base) === 'faccao', 'Facção canônica não reconhecida.');
assert(api.movimentacaoBloqueiaNovaSaida(base, 'INTERLOCK') === true, 'Saída real de facção deveria bloquear duplicidade.');

assert(api.movimentacaoBloqueiaNovaSaida({ ...base, tipoDestino: 'celula', tipoDestinoLabel: 'Célula' }, 'INTERLOCK') === false,
  'Movimentação de célula não pode bloquear saída de facção.');

assert(api.movimentacaoBloqueiaNovaSaida({ ...base, tipoDestino: '', tipoDestinoLabel: '' }, 'INTERLOCK') === true,
  'Registro legado de facção deveria ser reconhecido para recuperação.');

assert(api.movimentacaoPrecisaCanonizacao({ ...base, tipoDestino: '', tipoDestinoLabel: '' }, 'INTERLOCK', 'sutia') === true,
  'Registro legado deveria exigir canonização.');

assert(api.movimentacaoBloqueiaNovaSaida({ ...base, tipoDestino: 'faccao_corte', tipoDestinoLabel: 'Facção • Corte' }, 'INTERLOCK') === false,
  'Movimentação de corte não pode bloquear saída normal de facção.');

assert(api.movimentacaoBloqueiaNovaSaida({ ...base, status: 'cancelado' }, 'INTERLOCK') === false,
  'Movimentação cancelada não pode bloquear nova saída.');

assert(api.movimentacaoBloqueiaNovaSaida({ ...base, status: 'retornou', dataChegada: '' }, 'INTERLOCK') === false,
  'Movimentação retornada não pode bloquear nova saída.');

assert(api.movimentacaoBloqueiaNovaSaida({ ...base, dataChegada: '2026-09-09' }, 'INTERLOCK') === false,
  'Movimentação com chegada não pode bloquear nova saída.');

assert(api.movimentacaoBloqueiaNovaSaida({ ...base, destino: '' }, 'INTERLOCK') === false,
  'Registro incompleto sem destino não pode bloquear nova saída.');

assert(api.movimentacaoBloqueiaNovaSaida({ ...base, processo: 'SUTIÃ COMPLETO' }, 'INTERLOCK') === false,
  'Outro processo não pode bloquear INTERLOCK.');

console.log('Cenários da saída fantasma 297 validados com sucesso.');
