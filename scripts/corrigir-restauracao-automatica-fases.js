const fs = require('fs');

const arquivo = 'update.js';
let source = fs.readFileSync(arquivo, 'utf8');

const flag = '  let restauracaoFasesAntigasAutomaticaTentada = false;\n';
const ocorrenciasFlag = source.split(flag).length - 1;
if (ocorrenciasFlag !== 1) {
  throw new Error(`Esperava 1 flag de restauração automática, encontrei ${ocorrenciasFlag}.`);
}
source = source.replace(flag, '');

const blocoAutomatico = /  function iniciarRestauracaoFasesAntigas\(\) \{[\s\S]*?restaurarOpcoesAntigasFases\(\{ manual: false \}\);\n      \}\n    \}, delay\)\);\n  \}/g;
const encontrados = source.match(blocoAutomatico) || [];
if (encontrados.length !== 1) {
  throw new Error(`Esperava 1 inicializador com recuperação automática, encontrei ${encontrados.length}.`);
}

const novoInicializador = `  function iniciarRestauracaoFasesAntigas() {\n    instalarEventosRestauracaoFasesAntigas();\n    // A lista oficial é soberana. Histórico de OP nunca repopula sugestões automaticamente.\n    // Recuperação histórica permanece disponível somente por ação manual do administrador.\n    [350, 900, 1800, 3000].forEach(delay =>\n      setTimeout(garantirBotoesRestauracaoFasesAntigas, delay)\n    );\n  }`;

source = source.replace(blocoAutomatico, novoInicializador);

if (source.includes('restauracaoFasesAntigasAutomaticaTentada')) {
  throw new Error('A flag automática ainda existe após a correção.');
}
if (source.includes('restaurarOpcoesAntigasFases({ manual: false })')) {
  throw new Error('Ainda existe chamada automática de restauração histórica.');
}
if (!source.includes('restaurarOpcoesAntigasFases({ manual: true })')) {
  throw new Error('A recuperação manual do administrador foi perdida.');
}
if (!source.includes('function restaurarOpcoesAntigasFases')) {
  throw new Error('A função de recuperação manual foi perdida.');
}
if (!source.includes('Recuperar opções antigas')) {
  throw new Error('O botão de recuperação manual foi perdido.');
}

fs.writeFileSync(arquivo, source, 'utf8');
console.log('Restauração automática removida; recuperação manual preservada.');
