const fs = require('fs');

const ARQUIVO = 'update.js';
let source = fs.readFileSync(ARQUIVO, 'utf8');

function replaceOnce(antigo, novo, descricao) {
  const qtd = source.split(antigo).length - 1;
  if (qtd !== 1) throw new Error(`${descricao}: esperado 1 ocorrência, encontrado ${qtd}`);
  source = source.replace(antigo, novo);
}

function replaceRegexOnce(regex, novo, descricao) {
  const encontrados = source.match(regex) || [];
  if (encontrados.length !== 1) throw new Error(`${descricao}: esperado 1 ocorrência, encontrado ${encontrados.length}`);
  source = source.replace(regex, novo);
}

// ---------------------------------------------------------------------------
// SUTIÃ — não criar documento vazio e permitir reparo mesmo após migração antiga.
// ---------------------------------------------------------------------------
replaceOnce(
  '  const CAMPO_FASES_SUTIA_EXCLUIDAS = "sugestoesExcluidas";\n  const MARCADOR_RECONSTRUCAO_FASES_SUTIA = "reconstrucaoFasesSutia20260909V1";\n',
  '  const CAMPO_FASES_SUTIA_EXCLUIDAS = "sugestoesExcluidas";\n  const MARCADOR_RECONSTRUCAO_FASES_SUTIA = "reconstrucaoFasesSutia20260909V1";\n  const MARCADOR_REPARO_FASES_SUTIA_VAZIAS = "reparoFasesSutiaVazias20260909V1";\n',
  'marcador de reparo do Sutiã'
);

replaceOnce(
  '    const atuais = opcoesAtuaisDoDatalistFases();\n\n    try {',
  '    const atuais = opcoesAtuaisDoDatalistFases();\n    if (!atuais.length) {\n      inicializacaoAutomaticaFasesTentada = false;\n      console.warn("Lista inicial do Sutiã ainda vazia; a configuração oficial não será criada sem dados.");\n      return;\n    }\n\n    try {',
  'proteção contra configuração vazia do Sutiã'
);

replaceOnce(
  '    const dadosAtuais = snapshotAtual.exists() ? snapshotAtual.data() : {};\n    if (dadosAtuais?.[MARCADOR_RECONSTRUCAO_FASES_SUTIA] === true) return false;\n\n    let historicas = [];',
  '    const dadosAtuais = snapshotAtual.exists() ? snapshotAtual.data() : {};\n    const listaAtualPersistida = ordenarFasesGerenciadas(dadosAtuais?.sugestoes || []);\n    const precisaRepararListaVazia = !listaAtualPersistida.length &&\n      dadosAtuais?.[MARCADOR_REPARO_FASES_SUTIA_VAZIAS] !== true;\n    if (dadosAtuais?.[MARCADOR_RECONSTRUCAO_FASES_SUTIA] === true && !precisaRepararListaVazia) return false;\n\n    let historicas = [];',
  'reentrada segura da reconstrução do Sutiã'
);

replaceOnce(
  '    const excluidas = ordenarFasesGerenciadas(\n      [...ultimoEstado.values()].filter(item => item.removida).map(item => item.fase)\n    );\n    const chavesExcluidas = new Set(excluidas.map(chaveFaseGerenciada));',
  '    const exclusoesJaGravadas = ordenarFasesGerenciadas(\n      dadosAtuais?.[CAMPO_FASES_SUTIA_EXCLUIDAS] || []\n    );\n    const mapaExcluidas = new Map(\n      exclusoesJaGravadas.map(fase => [chaveFaseGerenciada(fase), fase])\n    );\n    ultimoEstado.forEach((estado, chave) => {\n      if (estado.removida) mapaExcluidas.set(chave, estado.fase);\n      else mapaExcluidas.delete(chave);\n    });\n    const excluidas = ordenarFasesGerenciadas([...mapaExcluidas.values()]);\n    const chavesExcluidas = new Set(mapaExcluidas.keys());',
  'exclusões persistentes na reconstrução do Sutiã'
);

replaceOnce(
  '      const dados = snapshot.exists() ? snapshot.data() : {};\n      if (dados?.[MARCADOR_RECONSTRUCAO_FASES_SUTIA] === true) return false;\n\n      transacao.set(referencia, {',
  '      const dados = snapshot.exists() ? snapshot.data() : {};\n      const listaPersistida = ordenarFasesGerenciadas(dados?.sugestoes || []);\n      const reparoVazioAindaNecessario = !listaPersistida.length &&\n        dados?.[MARCADOR_REPARO_FASES_SUTIA_VAZIAS] !== true;\n      if (dados?.[MARCADOR_RECONSTRUCAO_FASES_SUTIA] === true && !reparoVazioAindaNecessario) return false;\n\n      transacao.set(referencia, {',
  'guarda transacional do reparo do Sutiã'
);

replaceOnce(
  '        [MARCADOR_RECONSTRUCAO_FASES_SUTIA]: true,\n        reconstruidoEm:',
  '        [MARCADOR_RECONSTRUCAO_FASES_SUTIA]: true,\n        [MARCADOR_REPARO_FASES_SUTIA_VAZIAS]: true,\n        reconstruidoEm:',
  'marcação do reparo do Sutiã'
);

// ---------------------------------------------------------------------------
// CALCINHA — mesma proteção: lista vazia pode ser reparada sem ignorar tombstones.
// ---------------------------------------------------------------------------
replaceOnce(
  '  const CAMPO_FASES_CALCINHA_EXCLUIDAS = "sugestoesExcluidas";\n  const MARCADOR_RECONSTRUCAO_FASES_CALCINHA = "reconstrucaoFasesCalcinha20260909V1";\n',
  '  const CAMPO_FASES_CALCINHA_EXCLUIDAS = "sugestoesExcluidas";\n  const MARCADOR_RECONSTRUCAO_FASES_CALCINHA = "reconstrucaoFasesCalcinha20260909V1";\n  const MARCADOR_REPARO_FASES_CALCINHA_VAZIAS = "reparoFasesCalcinhaVazias20260909V1";\n',
  'marcador de reparo da Calcinha'
);

replaceOnce(
  '    const dadosAtuais = snapshotAtual.exists() ? snapshotAtual.data() : {};\n    if (dadosAtuais?.[MARCADOR_RECONSTRUCAO_FASES_CALCINHA] === true) return false;\n\n    let historicas = [];',
  '    const dadosAtuais = snapshotAtual.exists() ? snapshotAtual.data() : {};\n    const listaAtualPersistida = ordenarFasesGerenciadas(dadosAtuais?.sugestoes || []);\n    const precisaRepararListaVazia = !listaAtualPersistida.length &&\n      dadosAtuais?.[MARCADOR_REPARO_FASES_CALCINHA_VAZIAS] !== true;\n    if (dadosAtuais?.[MARCADOR_RECONSTRUCAO_FASES_CALCINHA] === true && !precisaRepararListaVazia) return false;\n\n    let historicas = [];',
  'reentrada segura da reconstrução da Calcinha'
);

replaceOnce(
  '    if (!listaReconstruida.length && historicas.length) {\n      console.error("Reconstrução da Calcinha abortada: o resultado ficou vazio apesar de existirem fases históricas.");\n      mostrarAvisoFormulario("A reconstrução das fases da Calcinha foi abortada para proteger os dados.");\n      return false;\n    }',
  '    if (!listaReconstruida.length) {\n      console.warn("Reconstrução da Calcinha sem opções válidas; nenhuma configuração vazia será gravada.");\n      return false;\n    }',
  'proteção contra gravação vazia da Calcinha'
);

replaceOnce(
  '      const dados = snapshot.exists() ? snapshot.data() : {};\n      if (dados?.[MARCADOR_RECONSTRUCAO_FASES_CALCINHA] === true) return false;\n\n      transacao.set(referencia, {',
  '      const dados = snapshot.exists() ? snapshot.data() : {};\n      const listaPersistida = ordenarFasesGerenciadas(dados?.sugestoes || []);\n      const reparoVazioAindaNecessario = !listaPersistida.length &&\n        dados?.[MARCADOR_REPARO_FASES_CALCINHA_VAZIAS] !== true;\n      if (dados?.[MARCADOR_RECONSTRUCAO_FASES_CALCINHA] === true && !reparoVazioAindaNecessario) return false;\n\n      transacao.set(referencia, {',
  'guarda transacional do reparo da Calcinha'
);

replaceOnce(
  '        [MARCADOR_RECONSTRUCAO_FASES_CALCINHA]: true,\n        reconstruidoEm:',
  '        [MARCADOR_RECONSTRUCAO_FASES_CALCINHA]: true,\n        [MARCADOR_REPARO_FASES_CALCINHA_VAZIAS]: true,\n        reconstruidoEm:',
  'marcação do reparo da Calcinha'
);

// ---------------------------------------------------------------------------
// FASE LATERAL — exclusões persistentes + reconstrução segura.
// ---------------------------------------------------------------------------
replaceOnce(
  '  const FASES_LATERAL_CONFIG_DOCUMENTO = "fasesManejoSutiaLateral";\n  const ID_DATALIST_FASES_LATERAL = "manejoFasesLateraisList";\n',
  '  const FASES_LATERAL_CONFIG_DOCUMENTO = "fasesManejoSutiaLateral";\n  const CAMPO_FASES_LATERAL_EXCLUIDAS = "sugestoesExcluidas";\n  const MARCADOR_REPARO_FASES_LATERAL_VAZIAS = "reparoFasesLateralVazias20260909V1";\n  const ID_DATALIST_FASES_LATERAL = "manejoFasesLateraisList";\n',
  'constantes seguras da Fase Lateral'
);

replaceOnce(
  '  let restauracaoFasesLateralEmAndamento = false;\n  let eventosFasesLateralInstalados = false;\n',
  '  let restauracaoFasesLateralEmAndamento = false;\n  let reconstrucaoFasesLateralEmAndamento = false;\n  let eventosFasesLateralInstalados = false;\n',
  'estado da reconstrução lateral'
);

replaceRegexOnce(
  /  async function alterarListaFasesLateralComTransacao\(transformar\) \{[\s\S]*?\n  \}\n\n  async function adicionarSugestaoFaseLateralAdmin/,
  `  async function alterarSugestaoFaseLateralPersistente(faseInformada, acao) {\n    const contexto = contextoGestaoFasesLateral();\n    if (!usuarioEhAdminFasesLateral() || !contexto?.user) {\n      mostrarAvisoFormulario("Somente o administrador pode gerenciar sugestões da Fase Lateral.");\n      return null;\n    }\n\n    const fase = normalizarFaseGerenciada(faseInformada);\n    if (!fase) return null;\n    if (!["adicionar", "remover"].includes(acao)) throw new Error("Ação inválida na Fase Lateral.");\n\n    const { firestore, db, user } = contexto;\n    const referencia = firestore.doc(db, "configuracoes", FASES_LATERAL_CONFIG_DOCUMENTO);\n    return firestore.runTransaction(db, async transacao => {\n      const snapshot = await transacao.get(referencia);\n      const dados = snapshot.exists() ? snapshot.data() : {};\n      const listaAtual = ordenarFasesGerenciadas(dados?.sugestoes || fasesLateralGerenciadas);\n      const excluidasAtuais = ordenarFasesGerenciadas(dados?.[CAMPO_FASES_LATERAL_EXCLUIDAS] || []);\n      const mapaExcluidas = new Map(excluidasAtuais.map(item => [chaveFaseGerenciada(item), item]));\n      const chave = chaveFaseGerenciada(fase);\n\n      let proximaLista;\n      if (acao === "adicionar") {\n        proximaLista = ordenarFasesGerenciadas([...listaAtual, fase]);\n        mapaExcluidas.delete(chave);\n      } else {\n        proximaLista = ordenarFasesGerenciadas(listaAtual.filter(item => chaveFaseGerenciada(item) !== chave));\n        mapaExcluidas.set(chave, fase);\n      }\n\n      transacao.set(referencia, {\n        sugestoes: proximaLista,\n        [CAMPO_FASES_LATERAL_EXCLUIDAS]: ordenarFasesGerenciadas([...mapaExcluidas.values()]),\n        atualizadoEm: firestore.serverTimestamp(),\n        atualizadoPor: user.uid,\n        versaoGerenciamento: APP_VERSION,\n        tipoPeca: "sutia",\n        campo: "faseLateral"\n      }, { merge: true });\n      return proximaLista;\n    });\n  }\n\n  async function adicionarSugestaoFaseLateralAdmin`,
  'persistência estrutural da Fase Lateral'
);

replaceOnce(
  '      await alterarListaFasesLateralComTransacao(lista => [...lista, fase]);',
  '      await alterarSugestaoFaseLateralPersistente(fase, "adicionar");',
  'adição persistente da Fase Lateral'
);

replaceOnce(
  '      await alterarListaFasesLateralComTransacao(lista =>\n        lista.filter(item => chaveFaseGerenciada(item) !== chaveFaseGerenciada(fase))\n      );',
  '      await alterarSugestaoFaseLateralPersistente(fase, "remover");',
  'remoção persistente da Fase Lateral'
);

replaceOnce(
  '    const atuais = opcoesAtuaisFasesLateral();\n\n    try {',
  '    const atuais = opcoesAtuaisFasesLateral();\n    if (!atuais.length) {\n      inicializacaoFasesLateralTentada = false;\n      console.warn("Lista inicial da Fase Lateral ainda vazia; a configuração oficial não será criada sem dados.");\n      return;\n    }\n\n    try {',
  'proteção contra configuração vazia da Fase Lateral'
);

const ancoraSnapshotLateral = '  function iniciarSnapshotConfiguracaoFasesLateral() {';
if ((source.split(ancoraSnapshotLateral).length - 1) !== 1) throw new Error('âncora do snapshot lateral não é única');
const reparoLateral = `  async function reconstruirListaFasesLateralSeNecessario() {\n    if (reconstrucaoFasesLateralEmAndamento) return false;\n    const contexto = contextoGestaoFasesLateral();\n    if (!usuarioEhAdminFasesLateral() || !contexto?.user) return false;\n\n    const { firestore, db, user } = contexto;\n    const referencia = firestore.doc(db, "configuracoes", FASES_LATERAL_CONFIG_DOCUMENTO);\n    const snapshotAtual = await firestore.getDoc(referencia);\n    const dadosAtuais = snapshotAtual.exists() ? snapshotAtual.data() : {};\n    const listaAtual = ordenarFasesGerenciadas(dadosAtuais?.sugestoes || []);\n    if (listaAtual.length || dadosAtuais?.[MARCADOR_REPARO_FASES_LATERAL_VAZIAS] === true) return false;\n\n    reconstrucaoFasesLateralEmAndamento = true;\n    try {\n      const candidatas = new Map();\n      const snapshotOps = await firestore.getDocs(firestore.collection(db, "ordensProducao"));\n      snapshotOps.forEach(documento => {\n        const dados = documento.data() || {};\n        [\n          dados?.manejosSetores?.sutia?.faseLateral,\n          dados?.manejoSutia?.faseLateral,\n          dados?.sutia?.faseLateral,\n          dados?.manejo?.faseLateral,\n          dados?.faseLateral,\n          dados?.faseLateralSutia\n        ].forEach(valor => {\n          const fase = normalizarFaseGerenciada(valor);\n          const chave = chaveFaseGerenciada(fase);\n          if (fase && chave) candidatas.set(chave, fase);\n        });\n      });\n\n      const eventos = [];\n      const consultaLogs = firestore.query(\n        firestore.collection(db, "logsAlteracoes"),\n        firestore.where("tipoAlvo", "==", "Sugestão de Fase Lateral do Sutiã")\n      );\n      const logs = await firestore.getDocs(consultaLogs);\n      logs.forEach(item => {\n        const dados = item.data() || {};\n        const fase = normalizarFaseGerenciada(dados.alvoId || "");\n        const acao = normalizarComparacao(dados.acao || "");\n        if (!fase) return;\n        const adicionada = acao === normalizarComparacao("Sugestão de Fase Lateral adicionada");\n        const removida = acao === normalizarComparacao("Sugestão de Fase Lateral removida");\n        if (!adicionada && !removida) return;\n        eventos.push({ fase, removida, instante: dados.criadoEm?.toMillis?.() || 0, id: item.id });\n      });\n      eventos.sort((a, b) => a.instante - b.instante || a.id.localeCompare(b.id));\n\n      const mapaExcluidas = new Map(\n        ordenarFasesGerenciadas(dadosAtuais?.[CAMPO_FASES_LATERAL_EXCLUIDAS] || [])\n          .map(fase => [chaveFaseGerenciada(fase), fase])\n      );\n      eventos.forEach(evento => {\n        const chave = chaveFaseGerenciada(evento.fase);\n        if (evento.removida) mapaExcluidas.set(chave, evento.fase);\n        else {\n          candidatas.set(chave, evento.fase);\n          mapaExcluidas.delete(chave);\n        }\n      });\n\n      const listaReconstruida = ordenarFasesGerenciadas(\n        [...candidatas.values()].filter(fase => !mapaExcluidas.has(chaveFaseGerenciada(fase)))\n      );\n      if (!listaReconstruida.length) {\n        console.warn("Reconstrução da Fase Lateral sem opções válidas; nenhuma configuração vazia será gravada.");\n        return false;\n      }\n\n      return await firestore.runTransaction(db, async transacao => {\n        const snapshot = await transacao.get(referencia);\n        const dados = snapshot.exists() ? snapshot.data() : {};\n        const listaPersistida = ordenarFasesGerenciadas(dados?.sugestoes || []);\n        if (listaPersistida.length || dados?.[MARCADOR_REPARO_FASES_LATERAL_VAZIAS] === true) return false;\n\n        transacao.set(referencia, {\n          sugestoes: listaReconstruida,\n          [CAMPO_FASES_LATERAL_EXCLUIDAS]: ordenarFasesGerenciadas([...mapaExcluidas.values()]),\n          [MARCADOR_REPARO_FASES_LATERAL_VAZIAS]: true,\n          reconstruidoEm: firestore.serverTimestamp(),\n          reconstruidoPor: user.uid,\n          atualizadoEm: firestore.serverTimestamp(),\n          atualizadoPor: user.uid,\n          versaoGerenciamento: APP_VERSION,\n          tipoPeca: "sutia",\n          campo: "faseLateral"\n        }, { merge: true });\n        return true;\n      });\n    } catch (error) {\n      console.error("Não foi possível reconstruir a Fase Lateral com segurança.", error);\n      return false;\n    } finally {\n      reconstrucaoFasesLateralEmAndamento = false;\n    }\n  }\n\n`;
source = source.replace(ancoraSnapshotLateral, reparoLateral + ancoraSnapshotLateral);

replaceOnce(
  '        criarPainelAdminFasesLateral();\n        criarListaInicialFasesLateralSeNecessario();',
  '        criarPainelAdminFasesLateral();\n        if (usuarioEhAdminFasesLateral() && !fasesLateralGerenciadas.length) {\n          void reconstruirListaFasesLateralSeNecessario();\n        }\n        criarListaInicialFasesLateralSeNecessario();',
  'disparo do reparo da Fase Lateral'
);

const ancoraRecuperarLateral = '  async function recuperarOpcoesAntigasFasesLateral() {';
if ((source.split(ancoraRecuperarLateral).length - 1) !== 1) throw new Error('âncora de recuperação lateral não é única');
const mesclarLateral = `  async function mesclarFasesLateralRecuperadas(recuperadas) {\n    const contexto = contextoGestaoFasesLateral();\n    if (!contexto?.user) return { lista: fasesLateralGerenciadas, adicionadas: 0 };\n    const { firestore, db, user } = contexto;\n    const referencia = firestore.doc(db, "configuracoes", FASES_LATERAL_CONFIG_DOCUMENTO);\n\n    return firestore.runTransaction(db, async transacao => {\n      const snapshot = await transacao.get(referencia);\n      const dados = snapshot.exists() ? snapshot.data() : {};\n      const listaAtual = ordenarFasesGerenciadas(dados?.sugestoes || []);\n      const excluidas = new Set(\n        ordenarFasesGerenciadas(dados?.[CAMPO_FASES_LATERAL_EXCLUIDAS] || []).map(chaveFaseGerenciada)\n      );\n      const chavesAtuais = new Set(listaAtual.map(chaveFaseGerenciada));\n      const novas = ordenarFasesGerenciadas(recuperadas).filter(fase => {\n        const chave = chaveFaseGerenciada(fase);\n        return !chavesAtuais.has(chave) && !excluidas.has(chave);\n      });\n      const listaFinal = ordenarFasesGerenciadas([...listaAtual, ...novas]);\n      if (!listaFinal.length) return { lista: listaAtual, adicionadas: 0 };\n\n      transacao.set(referencia, {\n        sugestoes: listaFinal,\n        atualizadoEm: firestore.serverTimestamp(),\n        atualizadoPor: user.uid,\n        versaoGerenciamento: APP_VERSION,\n        tipoPeca: "sutia",\n        campo: "faseLateral"\n      }, { merge: true });\n      return { lista: listaFinal, adicionadas: novas.length };\n    });\n  }\n\n`;
source = source.replace(ancoraRecuperarLateral, mesclarLateral + ancoraRecuperarLateral);

replaceOnce(
  '      const antes = new Set(fasesLateralGerenciadas.map(chaveFaseGerenciada));\n      const todas = ordenarFasesGerenciadas([...encontradas]);\n      const novas = todas.filter(fase => !antes.has(chaveFaseGerenciada(fase)));\n      await alterarListaFasesLateralComTransacao(lista => [...lista, ...todas]);\n      await registrarLogFaseLateralAdmin("Opções antigas da Fase Lateral recuperadas", `${novas.length} nova(s)`);',
  '      const todas = ordenarFasesGerenciadas([...encontradas]);\n      const resultado = await mesclarFasesLateralRecuperadas(todas);\n      const novas = Array.from({ length: resultado.adicionadas || 0 });\n      await registrarLogFaseLateralAdmin("Opções antigas da Fase Lateral recuperadas", `${resultado.adicionadas || 0} nova(s)`);',
  'recuperação lateral respeitando exclusões'
);

// Corrige texto antigo do painel do Sutiã: a aplicação já usa seleção oficial fechada.
replaceOnce(
  '        A lista abaixo controla o menu do filtro Fase. Os usuários ainda podem digitar uma fase livremente, mas ela só entra no filtro oficial quando o administrador cadastrá-la aqui.',
  '        Esta lista define as fases que podem ser selecionadas e salvas no Manejo do Sutiã. O operador só pode usar opções cadastradas aqui pelo administrador.',
  'texto coerente do painel do Sutiã'
);

// Invariantes finais.
for (const esperado of [
  'MARCADOR_REPARO_FASES_SUTIA_VAZIAS',
  'MARCADOR_REPARO_FASES_CALCINHA_VAZIAS',
  'MARCADOR_REPARO_FASES_LATERAL_VAZIAS',
  'CAMPO_FASES_LATERAL_EXCLUIDAS',
  'async function reconstruirListaFasesLateralSeNecessario()',
  'async function alterarSugestaoFaseLateralPersistente',
  'async function mesclarFasesLateralRecuperadas',
  'configuração oficial não será criada sem dados',
  'reparoFasesSutiaVazias20260909V1',
  'reparoFasesCalcinhaVazias20260909V1',
  'reparoFasesLateralVazias20260909V1'
]) {
  if (!source.includes(esperado)) throw new Error(`invariante ausente: ${esperado}`);
}

if (source.includes('alterarListaFasesLateralComTransacao(')) {
  throw new Error('função lateral antiga ainda referenciada');
}

fs.writeFileSync(ARQUIVO, source, 'utf8');
console.log('Reparo estrutural 298 aplicado ao update.js.');
