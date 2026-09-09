const fs = require('fs');

const arquivo = 'update.js';
let source = fs.readFileSync(arquivo, 'utf8');

function substituirUnico(antigo, novo, descricao) {
  const qtd = source.split(antigo).length - 1;
  if (qtd !== 1) throw new Error(`${descricao}: esperado 1, encontrado ${qtd}`);
  source = source.replace(antigo, novo);
}

// Remove a interpretação incorreta de duas fases fixas.
substituirUnico(
  '  const FASES_BOJO_OFICIAIS = Object.freeze(["BÁSICO SEM BOJO", "COM BOJO"]);\n  const MARCADOR_FASES_BOJO_OFICIAIS = "faseBojoOficial20260909V1";\n',
  '  const CAMPO_FASES_SUTIA_EXCLUIDAS = "sugestoesExcluidas";\n  const MARCADOR_RECONSTRUCAO_FASES_SUTIA = "reconstrucaoFasesSutia20260909V1";\n',
  'constantes da migração incorreta'
);

const padraoMigracaoErrada = /  async function migrarFaseBojoOficialSeNecessario\(\) \{[\s\S]*?\n  \}\n\n  async function configurarUsuarioGestaoFases\(user\) \{/;
const encontradosMigracao = source.match(padraoMigracaoErrada) || [];
if (encontradosMigracao.length !== 1) throw new Error(`migração incorreta: esperado 1, encontrado ${encontradosMigracao.length}`);
source = source.replace(padraoMigracaoErrada, '  async function configurarUsuarioGestaoFases(user) {');

substituirUnico(
  '      await migrarFaseBojoOficialSeNecessario();\n',
  '      await reconstruirListaFasesSutiaSeNecessario();\n',
  'chamada da migração incorreta'
);

// Exclusão persistente: remover grava tombstone; adicionar desfaz tombstone.
const ancoraAdicionar = '  async function adicionarSugestaoFaseAdmin(faseInformada) {';
if ((source.split(ancoraAdicionar).length - 1) !== 1) throw new Error('âncora adicionar sugestão não única');

const helperPersistencia = `  async function alterarSugestaoFaseSutiaPersistente(faseInformada, acao) {\n    if (!usuarioEhAdminFases || !contextoFirebaseFases?.user) {\n      mostrarAvisoFormulario("Somente o administrador pode gerenciar sugestões de fases.");\n      return null;\n    }\n\n    const fase = normalizarFaseGerenciada(faseInformada);\n    if (!fase) return null;\n    if (!["adicionar", "remover"].includes(acao)) {\n      throw new Error("Ação inválida ao alterar sugestão de fase.");\n    }\n\n    const { firestore, db, user } = contextoFirebaseFases;\n    const referencia = firestore.doc(db, FASES_CONFIG_COLECAO, FASES_CONFIG_DOCUMENTO);\n\n    return firestore.runTransaction(db, async transacao => {\n      const snapshot = await transacao.get(referencia);\n      const dados = snapshot.exists() ? snapshot.data() : {};\n      const listaAtual = ordenarFasesGerenciadas(dados?.sugestoes || fasesGerenciadas);\n      const excluidasAtuais = ordenarFasesGerenciadas(dados?.[CAMPO_FASES_SUTIA_EXCLUIDAS] || []);\n      const mapaExcluidas = new Map(excluidasAtuais.map(item => [chaveFaseGerenciada(item), item]));\n      const chave = chaveFaseGerenciada(fase);\n\n      let proximaLista;\n      if (acao === "adicionar") {\n        proximaLista = ordenarFasesGerenciadas([...listaAtual, fase]);\n        mapaExcluidas.delete(chave);\n      } else {\n        proximaLista = ordenarFasesGerenciadas(\n          listaAtual.filter(item => chaveFaseGerenciada(item) !== chave)\n        );\n        mapaExcluidas.set(chave, fase);\n      }\n\n      transacao.set(referencia, {\n        sugestoes: proximaLista,\n        [CAMPO_FASES_SUTIA_EXCLUIDAS]: ordenarFasesGerenciadas([...mapaExcluidas.values()]),\n        atualizadoEm: firestore.serverTimestamp(),\n        atualizadoPor: user.uid,\n        versaoGerenciamento: APP_VERSION\n      }, { merge: true });\n\n      return proximaLista;\n    });\n  }\n\n`;
source = source.replace(ancoraAdicionar, helperPersistencia + ancoraAdicionar);

substituirUnico(
  '      await alterarListaFasesComTransacao(lista => [...lista, fase]);\n',
  '      await alterarSugestaoFaseSutiaPersistente(fase, "adicionar");\n',
  'persistência ao adicionar'
);

substituirUnico(
  '      await alterarListaFasesComTransacao(lista =>\n        lista.filter(item => chaveFaseGerenciada(item) !== chaveFaseGerenciada(fase))\n      );\n',
  '      await alterarSugestaoFaseSutiaPersistente(fase, "remover");\n',
  'persistência ao remover'
);

// Recuperação histórica respeita exclusões persistentes.
substituirUnico(
  '      const chavesAtuais = new Set(listaAtual.map(chaveFaseGerenciada));\n      const novas = ordenarFasesGerenciadas(recuperadas)\n        .filter(fase => !chavesAtuais.has(chaveFaseGerenciada(fase)));\n',
  '      const chavesAtuais = new Set(listaAtual.map(chaveFaseGerenciada));\n      const exclusoesPersistentes = documentoId === FASES_CONFIG_DOCUMENTO\n        ? new Set(ordenarFasesGerenciadas(dadosAtuais?.[CAMPO_FASES_SUTIA_EXCLUIDAS] || []).map(chaveFaseGerenciada))\n        : new Set();\n      const novas = ordenarFasesGerenciadas(recuperadas)\n        .filter(fase => {\n          const chave = chaveFaseGerenciada(fase);\n          return !chavesAtuais.has(chave) && !exclusoesPersistentes.has(chave);\n        });\n',
  'filtro de exclusões na recuperação histórica'
);

// Reconstrói o estado anterior usando histórico + logs de adicionar/remover.
const ancoraConfigurar = '  async function configurarUsuarioGestaoFases(user) {';
if ((source.split(ancoraConfigurar).length - 1) !== 1) throw new Error('âncora configurar usuário não única');

const reconstruir = `  async function reconstruirListaFasesSutiaSeNecessario() {\n    if (!usuarioEhAdminFases || !contextoFirebaseFases?.user) return false;\n\n    const { firestore, db, user } = contextoFirebaseFases;\n    const referencia = firestore.doc(db, FASES_CONFIG_COLECAO, FASES_CONFIG_DOCUMENTO);\n    const snapshotAtual = await firestore.getDoc(referencia);\n    const dadosAtuais = snapshotAtual.exists() ? snapshotAtual.data() : {};\n    if (dadosAtuais?.[MARCADOR_RECONSTRUCAO_FASES_SUTIA] === true) return false;\n\n    let historicas = [];\n    try {\n      const recuperadas = await coletarTodasFasesAntigasDoSistema();\n      historicas = ordenarFasesGerenciadas(recuperadas?.sutia || []);\n    } catch (error) {\n      console.warn("Não foi possível coletar todas as fases históricas do Sutiã.", error);\n    }\n\n    const eventos = [];\n    try {\n      const consulta = firestore.query(\n        firestore.collection(db, "logsAlteracoes"),\n        firestore.where("tipoAlvo", "==", "Sugestão de fase")\n      );\n      const logs = await firestore.getDocs(consulta);\n      logs.forEach(item => {\n        const dados = item.data() || {};\n        const fase = normalizarFaseGerenciada(dados.alvoId || "");\n        const acao = String(dados.acao || "").trim().toUpperCase();\n        if (!fase) return;\n        if (acao !== "SUGESTÃO DE FASE ADICIONADA" && acao !== "SUGESTÃO DE FASE REMOVIDA") return;\n        eventos.push({\n          fase,\n          acao,\n          instante: dados.criadoEm?.toMillis?.() || 0,\n          id: item.id\n        });\n      });\n    } catch (error) {\n      console.error("Não foi possível ler o histórico administrativo das sugestões de fase.", error);\n      mostrarAvisoFormulario("Não foi possível reconstruir as fases com segurança. Nenhuma lista foi sobrescrita.");\n      return false;\n    }\n\n    eventos.sort((a, b) => a.instante - b.instante || a.id.localeCompare(b.id));\n\n    const candidatas = new Map();\n    historicas.forEach(fase => candidatas.set(chaveFaseGerenciada(fase), fase));\n\n    const ultimoEstado = new Map();\n    eventos.forEach(evento => {\n      const chave = chaveFaseGerenciada(evento.fase);\n      ultimoEstado.set(chave, {\n        fase: evento.fase,\n        removida: evento.acao === "SUGESTÃO DE FASE REMOVIDA"\n      });\n      if (evento.acao === "SUGESTÃO DE FASE ADICIONADA") {\n        candidatas.set(chave, evento.fase);\n      }\n    });\n\n    const excluidas = ordenarFasesGerenciadas(\n      [...ultimoEstado.values()].filter(item => item.removida).map(item => item.fase)\n    );\n    const chavesExcluidas = new Set(excluidas.map(chaveFaseGerenciada));\n    const listaReconstruida = ordenarFasesGerenciadas(\n      [...candidatas.values()].filter(fase => !chavesExcluidas.has(chaveFaseGerenciada(fase)))\n    );\n\n    if (!listaReconstruida.length) {\n      console.error("Reconstrução abortada: nenhuma fase válida foi encontrada.");\n      mostrarAvisoFormulario("A reconstrução das fases foi abortada para proteger os dados.");\n      return false;\n    }\n\n    return firestore.runTransaction(db, async transacao => {\n      const snapshot = await transacao.get(referencia);\n      const dados = snapshot.exists() ? snapshot.data() : {};\n      if (dados?.[MARCADOR_RECONSTRUCAO_FASES_SUTIA] === true) return false;\n\n      transacao.set(referencia, {\n        sugestoes: listaReconstruida,\n        [CAMPO_FASES_SUTIA_EXCLUIDAS]: excluidas,\n        [MARCADOR_RECONSTRUCAO_FASES_SUTIA]: true,\n        reconstruidoEm: firestore.serverTimestamp(),\n        reconstruidoPor: user.uid,\n        atualizadoEm: firestore.serverTimestamp(),\n        atualizadoPor: user.uid,\n        versaoGerenciamento: APP_VERSION\n      }, { merge: true });\n\n      return true;\n    });\n  }\n\n`;
source = source.replace(ancoraConfigurar, reconstruir + ancoraConfigurar);

// A recuperação automática antiga deve continuar desativada.
if (source.includes('restaurarOpcoesAntigasFases({ manual: false })')) {
  throw new Error('A restauração histórica automática reapareceu.');
}
if (source.includes('restauracaoFasesAntigasAutomaticaTentada')) {
  throw new Error('A flag da restauração automática reapareceu.');
}

for (const proibido of [
  'FASES_BOJO_OFICIAIS',
  'MARCADOR_FASES_BOJO_OFICIAIS',
  'migrarFaseBojoOficialSeNecessario'
]) {
  if (source.includes(proibido)) throw new Error(`Trecho incorreto ainda presente: ${proibido}`);
}

for (const esperado of [
  'CAMPO_FASES_SUTIA_EXCLUIDAS',
  'MARCADOR_RECONSTRUCAO_FASES_SUTIA',
  'alterarSugestaoFaseSutiaPersistente',
  'reconstruirListaFasesSutiaSeNecessario',
  'firestore.where("tipoAlvo", "==", "Sugestão de fase")',
  'await alterarSugestaoFaseSutiaPersistente(fase, "remover")',
  'await alterarSugestaoFaseSutiaPersistente(fase, "adicionar")',
  'restaurarOpcoesAntigasFases({ manual: true })'
]) {
  if (!source.includes(esperado)) throw new Error(`Invariante ausente: ${esperado}`);
}

fs.writeFileSync(arquivo, source, 'utf8');
console.log('Correção estrutural das sugestões do Sutiã aplicada com exclusões persistentes.');
