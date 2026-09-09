const fs = require('fs');

const arquivo = 'update.js';
let source = fs.readFileSync(arquivo, 'utf8');

const ancoraConstantes = `  const FASES_CONFIG_COLECAO = "configuracoes";\n  const FASES_CONFIG_DOCUMENTO = "fasesManejo";\n`;
if ((source.split(ancoraConstantes).length - 1) !== 1) {
  throw new Error('Âncora das configurações de fases não encontrada uma única vez.');
}

const blocoConstantes = `${ancoraConstantes}  const FASES_BOJO_OFICIAIS = Object.freeze(["BÁSICO SEM BOJO", "COM BOJO"]);\n  const MARCADOR_FASES_BOJO_OFICIAIS = "faseBojoOficial20260909V1";\n`;
source = source.replace(ancoraConstantes, blocoConstantes);

const ancoraFuncao = `  async function configurarUsuarioGestaoFases(user) {`;
if ((source.split(ancoraFuncao).length - 1) !== 1) {
  throw new Error('Função configurarUsuarioGestaoFases não encontrada uma única vez.');
}

const funcaoMigracao = `  async function migrarFaseBojoOficialSeNecessario() {\n    if (!usuarioEhAdminFases || !contextoFirebaseFases?.user) return false;\n\n    const { firestore, db, user } = contextoFirebaseFases;\n    const referencia = firestore.doc(db, FASES_CONFIG_COLECAO, FASES_CONFIG_DOCUMENTO);\n\n    try {\n      return await firestore.runTransaction(db, async transacao => {\n        const snapshot = await transacao.get(referencia);\n        const dados = snapshot.exists() ? snapshot.data() : {};\n        if (dados?.[MARCADOR_FASES_BOJO_OFICIAIS] === true) return false;\n\n        transacao.set(referencia, {\n          sugestoes: FASES_BOJO_OFICIAIS.map(normalizarFaseGerenciada),\n          [MARCADOR_FASES_BOJO_OFICIAIS]: true,\n          atualizadoEm: firestore.serverTimestamp(),\n          atualizadoPor: user.uid,\n          versaoGerenciamento: APP_VERSION\n        }, { merge: true });\n\n        return true;\n      });\n    } catch (error) {\n      console.error("Não foi possível migrar a Fase Bojo para as opções oficiais.", error);\n      mostrarAvisoFormulario("Não foi possível aplicar as opções oficiais da Fase Bojo.");\n      return false;\n    }\n  }\n\n`;
source = source.replace(ancoraFuncao, funcaoMigracao + ancoraFuncao);

const trechoConfiguracao = `      contextoFirebaseFases = { ...contextoFirebaseFases, user, perfil };\n      iniciarSnapshotConfiguracaoFases();\n      criarPainelAdminFases();`;
if ((source.split(trechoConfiguracao).length - 1) !== 1) {
  throw new Error('Trecho de inicialização do administrador não encontrado uma única vez.');
}
source = source.replace(
  trechoConfiguracao,
  `      contextoFirebaseFases = { ...contextoFirebaseFases, user, perfil };\n      await migrarFaseBojoOficialSeNecessario();\n      iniciarSnapshotConfiguracaoFases();\n      criarPainelAdminFases();`
);

for (const esperado of [
  'Object.freeze(["BÁSICO SEM BOJO", "COM BOJO"])',
  'faseBojoOficial20260909V1',
  'async function migrarFaseBojoOficialSeNecessario()',
  'sugestoes: FASES_BOJO_OFICIAIS.map(normalizarFaseGerenciada)',
  'await migrarFaseBojoOficialSeNecessario();',
  'restaurarOpcoesAntigasFases({ manual: true })'
]) {
  if (!source.includes(esperado)) throw new Error(`Validação ausente: ${esperado}`);
}
if (source.includes('restaurarOpcoesAntigasFases({ manual: false })')) {
  throw new Error('Restauração histórica automática reapareceu.');
}
if (source.includes('restauracaoFasesAntigasAutomaticaTentada')) {
  throw new Error('Flag de restauração automática reapareceu.');
}

fs.writeFileSync(arquivo, source, 'utf8');
console.log('Migração versionada da Fase Bojo oficial adicionada com sucesso.');
