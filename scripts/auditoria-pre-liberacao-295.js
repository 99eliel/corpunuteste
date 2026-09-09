const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = p => fs.existsSync(path.join(root,p)) ? fs.readFileSync(path.join(root,p),'utf8') : '';
const rootJs = fs.readdirSync(root).filter(n => n.endsWith('.js')).sort();
const files = Object.fromEntries(rootJs.map(n => [n, read(n)]));
const app = files['app.js'] || '';
const update = files['update.js'] || '';
const index = read('index.html');
const rules = read('firebase-rules.txt');

const findings = [];
function add(sev, area, msg, detail='') { findings.push({sev, area, msg, detail}); }
function count(text, needle) { return text.split(needle).length - 1; }
function regexCount(text, re) { return [...text.matchAll(re)].length; }

// 1) Funções duplicadas por arquivo.
for (const [name, text] of Object.entries(files)) {
  const map = new Map();
  const re = /(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  for (const m of text.matchAll(re)) map.set(m[1], (map.get(m[1])||0)+1);
  const dup = [...map.entries()].filter(([,n]) => n > 1);
  if (dup.length) add('ALTA', name, 'Declarações de função duplicadas', dup.map(([k,n])=>`${k} x${n}`).join(', '));
}

// 2) Handler inline / mistura de arquiteturas.
const inlineApp = regexCount(app, /\son(?:click|change|input|submit|blur|focus|keydown|keyup)=/gi);
const inlineUpdate = regexCount(update, /\son(?:click|change|input|submit|blur|focus|keydown|keyup)=/gi);
if (inlineApp) add('MÉDIA','app.js',`${inlineApp} handlers inline ainda existem no HTML gerado`, 'Não é necessariamente bug, mas aumenta risco de regressões como a do menu ⋮.');
if (inlineUpdate) add('MÉDIA','update.js',`${inlineUpdate} handlers inline ainda existem no HTML gerado`, 'Mistura eventos delegados com onclick/onchange inline.');

// 3) Menu Manejo 294.
for (const token of ['data-manejo-acao="faccao"','data-manejo-acao="celula"','data-manejo-acao="ajustar"','data-manejo-acao="historico"','switch (acao)']) {
  if (!app.includes(token)) add('CRÍTICA','Manejo','Controlador unificado do menu de ações incompleto', `Ausente: ${token}`);
}
for (const legacy of ['onclick="window.fecharMenusAcoesManejo(); window.mandarParaFaccao','onclick="window.fecharMenusAcoesManejo(); window.mandarParaCelula']) {
  if (app.includes(legacy)) add('CRÍTICA','Manejo','Handler legado do menu de ações reapareceu', legacy);
}

// 4) Restrição de fases Sutiã/Calcinha.
for (const token of ['validarFaseOficialManejoNoServidor','renderCampoFaseManejoOficial','fasesManejoCalcinha','fasesManejo']) {
  if (!app.includes(token) && !update.includes(token)) add('CRÍTICA','Fases','Proteção de fase oficial incompleta', `Ausente: ${token}`);
}
if (app.includes('fasesManejoExtras')) add('ALTA','Fases','Referência legada a fasesManejoExtras ainda existe no app.js','Pode permitir fonte paralela de sugestões se algum caminho ainda estiver ativo.');
if (app.includes('adicionarFaseSugestao')) add('ALTA','Fases','Função legada adicionarFaseSugestao ainda existe no app.js','Confirmar que não há UI/atalho capaz de chamá-la para usuário comum.');
if (app.includes('list="manejoFasesList"')) add('ALTA','Fases','Datalist legado de fase ainda é renderizado no Manejo','Datalist permite texto livre; deve estar fora do caminho atual.');

// 5) Timers/observers/listeners.
for (const [name,text] of Object.entries(files)) {
  const intervals = regexCount(text,/\bsetInterval\s*\(/g);
  const timeouts = regexCount(text,/\bsetTimeout\s*\(/g);
  const observers = regexCount(text,/new\s+MutationObserver\s*\(/g);
  const snapshots = regexCount(text,/\bonSnapshot\s*\(/g);
  if (intervals) add('ALTA',name,`${intervals} setInterval encontrado(s)`,'Revisar se ainda são necessários; polling foi fonte histórica de sobreposição no Corpo Nu.');
  if (observers >= 3) add('ALTA',name,`${observers} MutationObserver encontrados`,'Quantidade alta pode gerar render/eventos duplicados se não houver isolamento.');
  if (timeouts >= 20) add('MÉDIA',name,`${timeouts} setTimeout encontrados`,'Quantidade elevada; revisar inicializações por atraso e tentativas repetidas.');
  if (snapshots >= 10) add('MÉDIA',name,`${snapshots} onSnapshot encontrados`,'Confirmar unsubscribe e lazy-loading de cada listener.');
}

// 6) Listeners globais repetidos.
const globalClick = regexCount(app,/document\.addEventListener\(["']click["']/g);
const globalScroll = regexCount(app,/window\.addEventListener\(["']scroll["']/g);
if (globalClick >= 8) add('MÉDIA','app.js',`${globalClick} listeners globais de click`,'Pode haver competição de propagação/stopPropagation entre módulos internos.');
if (globalScroll >= 4) add('MÉDIA','app.js',`${globalScroll} listeners globais de scroll`,'Revisar custo e conflitos de menus/tabelas.');

// 7) Firestore: leituras amplas e gravações.
for (const [name,text] of Object.entries(files)) {
  const unbounded = regexCount(text,/getDocs\s*\(\s*collection\s*\(/g);
  if (unbounded) add('MÉDIA',name,`${unbounded} leitura(s) getDocs(collection(...)) sem query visível`,'Pode carregar coleção inteira; revisar volume e paginação/lazy-loading.');
  const writes = regexCount(text,/\b(?:addDoc|setDoc|updateDoc|deleteDoc|writeBatch|runTransaction)\s*\(/g);
  if (writes >= 20) add('INFO',name,`${writes} pontos de escrita Firestore`,'Arquivo concentra muitas responsabilidades de persistência.');
}

// 8) Erros silenciosos.
for (const [name,text] of Object.entries(files)) {
  const silentPromise = regexCount(text,/\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g);
  const emptyCatch = regexCount(text,/catch\s*\([^)]*\)\s*\{\s*\}/g);
  if (silentPromise + emptyCatch) add('ALTA',name,`${silentPromise+emptyCatch} erro(s) engolido(s) silenciosamente`,'Falhas podem deixar a interface em estado parcial sem aviso ao usuário.');
}

// 9) TODO/HACK/TEMP e console.error.
for (const [name,text] of Object.entries(files)) {
  const markers = regexCount(text,/\b(?:TODO|FIXME|HACK|TEMPOR[AÁ]RIO|TEMPORARIO)\b/gi);
  if (markers >= 5) add('MÉDIA',name,`${markers} marcadores TODO/FIXME/HACK/temporário`,'Revisar se são documentação antiga ou código ainda pendente.');
}

// 10) Service hold/PWA/versionamento.
if (index.includes('servicePaymentHold') || index.includes('data-service-hold="payment"')) add('CRÍTICA','Atualização','Bloqueio financeiro ainda presente no HTML','Não deveria existir no estado normal.');
const v1 = (()=>{try{return JSON.parse(read('version.json')).version}catch{return ''}})();
const v2 = (()=>{try{return JSON.parse(read('corponu-release.json')).version}catch{return ''}})();
if (v1 && v2 && v1 !== v2) add('ALTA','Versionamento','version.json e corponu-release.json divergem',`${v1} != ${v2}`);
const updateVersion = update.match(/APP_VERSION\s*=\s*["']([^"']+)/)?.[1] || '';
if (v1 && updateVersion && v1 !== updateVersion) add('ALTA','Versionamento','APP_VERSION de update.js diverge de version.json',`${updateVersion} != ${v1}`);

// 11) Regras Firestore: permissões amplas que merecem revisão antes de liberar.
if (rules.includes('match /manejos/{manejoId}') && rules.includes('allow create, update: if usuarioComum();')) add('ALTA','Firestore','Coleção manejos permite create/update para qualquer usuário ativo','A aplicação precisa garantir setor/permissão; regra não restringe campos nem autoria.');
if (rules.includes('match /movimentacoesProducao/{movimentoId}') && rules.includes('allow create, update: if usuarioComum();')) add('ALTA','Firestore','movimentacoesProducao permite create/update para qualquer usuário ativo','Um usuário ativo pode alterar movimentações diretamente fora da UI.');

// 12) Estrutura do repositório de teste: migradores/resíduos.
if (fs.existsSync(path.join(root,'scripts'))) {
  const scripts = fs.readdirSync(path.join(root,'scripts'));
  const restos = scripts.filter(n => /(?:part\d+|migrar-|corrigir-|aplicar-.*\d{2,})/i.test(n));
  if (restos.length >= 4) add('MÉDIA','Repositório',`${restos.length} artefatos de migração/correção antigos em scripts/`,restos.slice(0,20).join(', '));
}

// Resumo quantitativo útil.
const sevOrder = ['CRÍTICA','ALTA','MÉDIA','BAIXA','INFO'];
const totals = Object.fromEntries(sevOrder.map(s=>[s, findings.filter(f=>f.sev===s).length]));
let md = '# Auditoria pré-liberação Corpo Nu\n\n';
md += `Gerada em: ${new Date().toISOString()}\n\n`;
md += '## Resumo\n\n';
for (const s of sevOrder) md += `- **${s}:** ${totals[s]}\n`;
md += `\nArquivos JS raiz analisados: ${rootJs.length}.\n\n`;
md += '## Achados\n\n';
for (const s of sevOrder) {
  const group = findings.filter(f=>f.sev===s);
  if (!group.length) continue;
  md += `### ${s}\n\n`;
  group.forEach((f,i)=> { md += `${i+1}. **${f.area} — ${f.msg}**${f.detail ? `\n   - ${f.detail}` : ''}\n`; });
  md += '\n';
}
md += '## Métricas rápidas\n\n';
md += `- app.js: ${(Buffer.byteLength(app)/1024).toFixed(1)} KiB\n`;
md += `- update.js: ${(Buffer.byteLength(update)/1024).toFixed(1)} KiB\n`;
md += `- listeners globais click no app.js: ${globalClick}\n`;
md += `- handlers inline no app.js: ${inlineApp}\n`;
md += `- handlers inline no update.js: ${inlineUpdate}\n`;
md += `- funções window.* exportadas no app.js: ${regexCount(app,/window\.[A-Za-z_$][\w$]*\s*=/g)}\n`;

fs.writeFileSync('AUDITORIA-PRE-LIBERACAO.md', md, 'utf8');
console.log(md);
