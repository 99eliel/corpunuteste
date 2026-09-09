from pathlib import Path

ARQUIVO = Path('update.js')
source = ARQUIVO.read_text(encoding='utf-8')


def substituir_unico(antigo: str, novo: str, descricao: str) -> None:
    global source
    qtd = source.count(antigo)
    if qtd != 1:
        raise RuntimeError(f'{descricao}: esperado 1 trecho, encontrado {qtd}')
    source = source.replace(antigo, novo, 1)


# 1) Estado persistente próprio da Calcinha.
substituir_unico(
    '  const FASES_CALCINHA_CONFIG_DOCUMENTO = "fasesManejoCalcinha";\n  const ID_DATALIST_FASES_CALCINHA = "manejoFasesListCalcinha";\n',
    '  const FASES_CALCINHA_CONFIG_DOCUMENTO = "fasesManejoCalcinha";\n  const CAMPO_FASES_CALCINHA_EXCLUIDAS = "sugestoesExcluidas";\n  const MARCADOR_RECONSTRUCAO_FASES_CALCINHA = "reconstrucaoFasesCalcinha20260909V1";\n  const ID_DATALIST_FASES_CALCINHA = "manejoFasesListCalcinha";\n',
    'constantes Calcinha'
)

# 2) Nunca mais duplicar sugestões globais antigas na Calcinha.
substituir_unico(
    '''    // Preserva sugestões antigas do navegador em ambas as listas.\n    // Como eram globais antes da separação, o administrador decide depois onde mantê-las.\n    [...lerSugestoesLocaisAntigas(), ...lerOpcoesAtuaisDosDatalists()].forEach(fase => {\n      adicionarFaseAoConjunto(sutia, fase);\n      adicionarFaseAoConjunto(calcinha, fase);\n    });\n''',
    '''    // As sugestões antigas do navegador eram globais e pertencem ao fluxo legado do Sutiã.\n    // Não devem contaminar a lista oficial da Calcinha.\n    [...lerSugestoesLocaisAntigas(), ...lerOpcoesAtuaisDosDatalists()].forEach(fase => {\n      adicionarFaseAoConjunto(sutia, fase);\n    });\n''',
    'remoção da mistura global Sutiã/Calcinha'
)

# 3) A recuperação manual/histórica respeita exclusões persistentes nos dois documentos.
substituir_unico(
    '''      const exclusoesPersistentes = documentoId === FASES_CONFIG_DOCUMENTO\n        ? new Set(ordenarFasesGerenciadas(dadosAtuais?.[CAMPO_FASES_SUTIA_EXCLUIDAS] || []).map(chaveFaseGerenciada))\n        : new Set();\n''',
    '''      const campoExclusoes = documentoId === FASES_CONFIG_DOCUMENTO\n        ? CAMPO_FASES_SUTIA_EXCLUIDAS\n        : (documentoId === FASES_CALCINHA_CONFIG_DOCUMENTO ? CAMPO_FASES_CALCINHA_EXCLUIDAS : "");\n      const exclusoesPersistentes = campoExclusoes\n        ? new Set(ordenarFasesGerenciadas(dadosAtuais?.[campoExclusoes] || []).map(chaveFaseGerenciada))\n        : new Set();\n''',
    'exclusões persistentes na recuperação'
)

# 4) Adicionar/remover Calcinha passa a manter tombstones no próprio documento.
ancora_adicionar = '  async function adicionarSugestaoFaseCalcinhaAdmin(faseInformada) {'
if source.count(ancora_adicionar) != 1:
    raise RuntimeError('âncora adicionar Calcinha não única')

helper = '''  async function alterarSugestaoFaseCalcinhaPersistente(faseInformada, acao) {\n    if (!usuarioEhAdminFasesCalcinha || !contextoFirebaseFasesCalcinha?.user) {\n      mostrarAvisoFormulario("Somente o administrador pode gerenciar sugestões da calcinha.");\n      return null;\n    }\n\n    const fase = normalizarFaseGerenciada(faseInformada);\n    if (!fase) return null;\n    if (!["adicionar", "remover"].includes(acao)) {\n      throw new Error("Ação inválida ao alterar sugestão da Calcinha.");\n    }\n\n    const { firestore, db, user } = contextoFirebaseFasesCalcinha;\n    const referencia = firestore.doc(db, "configuracoes", FASES_CALCINHA_CONFIG_DOCUMENTO);\n\n    return firestore.runTransaction(db, async transacao => {\n      const snapshot = await transacao.get(referencia);\n      const dados = snapshot.exists() ? snapshot.data() : {};\n      const listaAtual = ordenarFasesGerenciadas(dados?.sugestoes || fasesCalcinhaGerenciadas);\n      const excluidasAtuais = ordenarFasesGerenciadas(dados?.[CAMPO_FASES_CALCINHA_EXCLUIDAS] || []);\n      const mapaExcluidas = new Map(excluidasAtuais.map(item => [chaveFaseGerenciada(item), item]));\n      const chave = chaveFaseGerenciada(fase);\n\n      let proximaLista;\n      if (acao === "adicionar") {\n        proximaLista = ordenarFasesGerenciadas([...listaAtual, fase]);\n        mapaExcluidas.delete(chave);\n      } else {\n        proximaLista = ordenarFasesGerenciadas(\n          listaAtual.filter(item => chaveFaseGerenciada(item) !== chave)\n        );\n        mapaExcluidas.set(chave, fase);\n      }\n\n      transacao.set(referencia, {\n        sugestoes: proximaLista,\n        [CAMPO_FASES_CALCINHA_EXCLUIDAS]: ordenarFasesGerenciadas([...mapaExcluidas.values()]),\n        atualizadoEm: firestore.serverTimestamp(),\n        atualizadoPor: user.uid,\n        versaoGerenciamento: APP_VERSION\n      }, { merge: true });\n\n      return proximaLista;\n    });\n  }\n\n'''
source = source.replace(ancora_adicionar, helper + ancora_adicionar, 1)

substituir_unico(
    '      await alterarListaFasesCalcinhaComTransacao(lista => [...lista, fase]);\n',
    '      await alterarSugestaoFaseCalcinhaPersistente(fase, "adicionar");\n',
    'persistência ao adicionar Calcinha'
)
substituir_unico(
    '''      await alterarListaFasesCalcinhaComTransacao(lista =>\n        lista.filter(item => chaveFaseGerenciada(item) !== chaveFaseGerenciada(fase))\n      );\n''',
    '      await alterarSugestaoFaseCalcinhaPersistente(fase, "remover");\n',
    'persistência ao remover Calcinha'
)

# 5) Reconstrução única: histórico real de OPs da Calcinha + ações explícitas do admin.
ancora_configurar = '  async function configurarUsuarioGestaoFasesCalcinha(user) {'
if source.count(ancora_configurar) != 1:
    raise RuntimeError('âncora configurar Calcinha não única')

reconstrucao = '''  async function reconstruirListaFasesCalcinhaSeNecessario() {\n    if (!usuarioEhAdminFasesCalcinha || !contextoFirebaseFasesCalcinha?.user) return false;\n\n    const { firestore, db, user } = contextoFirebaseFasesCalcinha;\n    const referencia = firestore.doc(db, "configuracoes", FASES_CALCINHA_CONFIG_DOCUMENTO);\n    const snapshotAtual = await firestore.getDoc(referencia);\n    const dadosAtuais = snapshotAtual.exists() ? snapshotAtual.data() : {};\n    if (dadosAtuais?.[MARCADOR_RECONSTRUCAO_FASES_CALCINHA] === true) return false;\n\n    let historicas = [];\n    try {\n      const recuperadas = await coletarTodasFasesAntigasDoSistema();\n      historicas = ordenarFasesGerenciadas(recuperadas?.calcinha || []);\n    } catch (error) {\n      console.error("Não foi possível coletar as fases históricas reais da Calcinha.", error);\n      mostrarAvisoFormulario("Não foi possível reconstruir as fases da Calcinha com segurança. Nenhuma lista foi sobrescrita.");\n      return false;\n    }\n\n    const eventos = [];\n    try {\n      const consulta = firestore.query(\n        firestore.collection(db, "logsAlteracoes"),\n        firestore.where("tipoAlvo", "==", "Sugestão de fase da Calcinha")\n      );\n      const logs = await firestore.getDocs(consulta);\n      logs.forEach(item => {\n        const dados = item.data() || {};\n        const fase = normalizarFaseGerenciada(dados.alvoId || "");\n        const acao = normalizarComparacao(dados.acao || "");\n        if (!fase) return;\n        if (acao !== normalizarComparacao("Sugestão de fase da Calcinha adicionada") &&\n            acao !== normalizarComparacao("Sugestão de fase da Calcinha removida")) return;\n        eventos.push({\n          fase,\n          removida: acao === normalizarComparacao("Sugestão de fase da Calcinha removida"),\n          instante: dados.criadoEm?.toMillis?.() || 0,\n          id: item.id\n        });\n      });\n    } catch (error) {\n      console.error("Não foi possível ler o histórico administrativo das fases da Calcinha.", error);\n      mostrarAvisoFormulario("Não foi possível reconstruir as fases da Calcinha com segurança. Nenhuma lista foi sobrescrita.");\n      return false;\n    }\n\n    eventos.sort((a, b) => a.instante - b.instante || a.id.localeCompare(b.id));\n\n    const candidatas = new Map();\n    historicas.forEach(fase => candidatas.set(chaveFaseGerenciada(fase), fase));\n\n    const ultimoEstadoAdmin = new Map();\n    eventos.forEach(evento => {\n      const chave = chaveFaseGerenciada(evento.fase);\n      ultimoEstadoAdmin.set(chave, evento);\n      if (!evento.removida) candidatas.set(chave, evento.fase);\n    });\n\n    const exclusoesJaGravadas = ordenarFasesGerenciadas(\n      dadosAtuais?.[CAMPO_FASES_CALCINHA_EXCLUIDAS] || []\n    );\n    const mapaExcluidas = new Map(\n      exclusoesJaGravadas.map(fase => [chaveFaseGerenciada(fase), fase])\n    );\n\n    ultimoEstadoAdmin.forEach((evento, chave) => {\n      if (evento.removida) mapaExcluidas.set(chave, evento.fase);\n      else mapaExcluidas.delete(chave);\n    });\n\n    const chavesExcluidas = new Set(mapaExcluidas.keys());\n    const listaReconstruida = ordenarFasesGerenciadas(\n      [...candidatas.values()].filter(fase => !chavesExcluidas.has(chaveFaseGerenciada(fase)))\n    );\n    const excluidas = ordenarFasesGerenciadas([...mapaExcluidas.values()]);\n\n    if (!listaReconstruida.length && historicas.length) {\n      console.error("Reconstrução da Calcinha abortada: o resultado ficou vazio apesar de existirem fases históricas.");\n      mostrarAvisoFormulario("A reconstrução das fases da Calcinha foi abortada para proteger os dados.");\n      return false;\n    }\n\n    return firestore.runTransaction(db, async transacao => {\n      const snapshot = await transacao.get(referencia);\n      const dados = snapshot.exists() ? snapshot.data() : {};\n      if (dados?.[MARCADOR_RECONSTRUCAO_FASES_CALCINHA] === true) return false;\n\n      transacao.set(referencia, {\n        sugestoes: listaReconstruida,\n        [CAMPO_FASES_CALCINHA_EXCLUIDAS]: excluidas,\n        [MARCADOR_RECONSTRUCAO_FASES_CALCINHA]: true,\n        reconstruidoEm: firestore.serverTimestamp(),\n        reconstruidoPor: user.uid,\n        atualizadoEm: firestore.serverTimestamp(),\n        atualizadoPor: user.uid,\n        versaoGerenciamento: APP_VERSION\n      }, { merge: true });\n\n      return true;\n    });\n  }\n\n'''
source = source.replace(ancora_configurar, reconstrucao + ancora_configurar, 1)

substituir_unico(
    '''      usuarioEhAdminFasesCalcinha = perfil?.tipo === "admin" && perfil?.ativo !== false;\n      contextoFirebaseFasesCalcinha = { ...contextoFirebaseFasesCalcinha, user, perfil };\n      iniciarSnapshotConfiguracaoFasesCalcinha();\n''',
    '''      usuarioEhAdminFasesCalcinha = perfil?.tipo === "admin" && perfil?.ativo !== false;\n      contextoFirebaseFasesCalcinha = { ...contextoFirebaseFasesCalcinha, user, perfil };\n      await reconstruirListaFasesCalcinhaSeNecessario();\n      iniciarSnapshotConfiguracaoFasesCalcinha();\n''',
    'chamada da reconstrução Calcinha'
)

# Invariantes estruturais.
proibidos = [
    'adicionarFaseAoConjunto(calcinha, fase);\n    });\n    coletarFasesVisiveisDoManejo',
    'const exclusoesPersistentes = documentoId === FASES_CONFIG_DOCUMENTO'
]
for item in proibidos:
    if item in source:
        raise RuntimeError(f'trecho antigo ainda presente: {item}')

esperados = [
    'CAMPO_FASES_CALCINHA_EXCLUIDAS',
    'MARCADOR_RECONSTRUCAO_FASES_CALCINHA',
    'alterarSugestaoFaseCalcinhaPersistente',
    'reconstruirListaFasesCalcinhaSeNecessario',
    'firestore.where("tipoAlvo", "==", "Sugestão de fase da Calcinha")',
    'await alterarSugestaoFaseCalcinhaPersistente(fase, "adicionar")',
    'await alterarSugestaoFaseCalcinhaPersistente(fase, "remover")',
    'await reconstruirListaFasesCalcinhaSeNecessario()',
    'adicionarFaseAoConjunto(calcinha, setores?.calcinha?.fase)',
    'adicionarFaseAoConjunto(calcinha, dados?.manejoCalcinha?.fase)',
    'adicionarFaseAoConjunto(calcinha, dados?.faseCalcinha)'
]
for item in esperados:
    if item not in source:
        raise RuntimeError(f'invariante ausente: {item}')

ARQUIVO.write_text(source, encoding='utf-8')
print('Correção estrutural das fases da Calcinha 292 aplicada.')
