import fs from 'node:fs';
import assert from 'node:assert/strict';

const fonte = fs.readFileSync('corponu-pagamentos-seguro.js', 'utf8');

function extrairFuncao(nome) {
  const inicio = fonte.indexOf(`function ${nome}(`);
  assert.notEqual(inicio, -1, `Função ${nome} não encontrada.`);
  const abre = fonte.indexOf('{', inicio);
  assert.notEqual(abre, -1, `Corpo de ${nome} não encontrado.`);

  let nivel = 0;
  let aspas = null;
  let escape = false;
  for (let i = abre; i < fonte.length; i += 1) {
    const c = fonte[i];
    if (escape) { escape = false; continue; }
    if (aspas) {
      if (c === '\\') { escape = true; continue; }
      if (c === aspas) aspas = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { aspas = c; continue; }
    if (c === '{') nivel += 1;
    if (c === '}') {
      nivel -= 1;
      if (nivel === 0) return fonte.slice(inicio, i + 1);
    }
  }
  throw new Error(`Função ${nome} incompleta.`);
}

const normalizarNome = valor => String(valor ?? '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Z0-9]+/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

const codigo = extrairFuncao('processoValorTotalManual');
const processoValorTotalManual = Function('normalizarNome', `return (${codigo});`)(normalizarNome);

assert.equal(processoValorTotalManual('SUTIÃ MONTAGEM'), true, 'Sutiã Montagem precisa continuar com valor total manual.');
assert.equal(processoValorTotalManual('SUTIA MONTAGEM'), true, 'Sutiã Montagem sem acento precisa continuar manual.');
assert.equal(processoValorTotalManual('SUTIÃ COMPLETO'), false, 'Sutiã Completo não pode ser forçado para valor total manual.');
assert.equal(processoValorTotalManual('SUTIA COMPLETO'), false, 'Sutiã Completo sem acento também não pode ser manual.');
assert.equal(processoValorTotalManual('ENCAPAR BOJO'), false);
assert.equal(processoValorTotalManual('ALÇA'), false);

assert.ok(!fonte.includes('return processo === "SUTIA MONTAGEM" || processo === "SUTIA COMPLETO";'), 'Regra antiga ainda está presente.');
assert.ok(fonte.includes('return processo === "SUTIA MONTAGEM";'), 'Regra nova não encontrada.');

console.log('OK: regra financeira 251 validada no código real. Sutiã Completo automático; Sutiã Montagem manual.');
