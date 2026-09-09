from pathlib import Path
import re

APP = Path("app.js")
UPDATE = Path("update.js")
app = APP.read_text(encoding="utf-8")
update = UPDATE.read_text(encoding="utf-8")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: esperado 1 trecho, encontrado {count}")
    return text.replace(old, new, 1)


def regex_once(text, pattern, replacement, label, flags=0):
    matches = list(re.finditer(pattern, text, flags))
    if len(matches) != 1:
        raise RuntimeError(f"{label}: esperado 1 trecho, encontrado {len(matches)}")
    return re.sub(pattern, replacement, text, count=1, flags=flags)


# -----------------------------------------------------------------------------
# app.js: a lista definida pelo administrador vira a fonte de verdade do Manejo.
# -----------------------------------------------------------------------------
app = replace_once(
    app,
    '  getDoc,\n',
    '  getDoc,\n  getDocFromServer,\n',
    'import getDocFromServer'
)

helper_anchor = '''function getManejoSetorAtual() {
  return state.manejoSetorAtual || "sutia";
}
'''

helper_block = r'''// Fases oficiais do Manejo.
// A fonte de verdade é a configuração administrada na aba Usuários.
const FASES_MANEJO_ADMIN_POR_SETOR = Object.freeze({
  sutia: Object.freeze({ documento: "fasesManejo", label: "Sutiã" }),
  calcinha: Object.freeze({ documento: "fasesManejoCalcinha", label: "Calcinha" })
});

const fasesManejoOficiaisCache = {
  sutia: [],
  calcinha: []
};

const fasesManejoOficiaisStatus = {
  sutia: "pendente",
  calcinha: "pendente"
};

const fasesManejoOficiaisPromessa = {
  sutia: null,
  calcinha: null
};

function tipoFasesManejoOficiais(setor = getManejoSetorAtual()) {
  return String(setor || "").trim().toLowerCase() === "calcinha" ? "calcinha" : "sutia";
}

function chaveFaseManejoOficial(valor) {
  return normalizarTexto(valor).trim().replace(/\s+/g, " ");
}

function normalizarListaFasesManejoOficiais(valores) {
  const mapa = new Map();

  (Array.isArray(valores) ? valores : []).forEach(valor => {
    const fase = limparTexto(valor).toUpperCase();
    const chave = chaveFaseManejoOficial(fase);
    if (!chave || mapa.has(chave)) return;
    mapa.set(chave, fase);
  });

  return [...mapa.values()].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" })
  );
}

function getFasesManejoOficiaisCache(setor = getManejoSetorAtual()) {
  const tipo = tipoFasesManejoOficiais(setor);
  return [...(fasesManejoOficiaisCache[tipo] || [])];
}

function atualizarCacheFasesManejoOficiais(setor, fases) {
  const tipo = tipoFasesManejoOficiais(setor);
  const lista = normalizarListaFasesManejoOficiais(fases);
  fasesManejoOficiaisCache[tipo] = lista;
  fasesManejoOficiaisStatus[tipo] = "pronto";
  return [...lista];
}

async function carregarFasesManejoOficiais(setor = getManejoSetorAtual(), opcoes = {}) {
  const tipo = tipoFasesManejoOficiais(setor);
  const config = FASES_MANEJO_ADMIN_POR_SETOR[tipo];
  const forcar = opcoes.forcar === true;
  const somenteServidor = opcoes.somenteServidor === true;

  if (!forcar && fasesManejoOficiaisStatus[tipo] === "pronto") {
    return getFasesManejoOficiaisCache(tipo);
  }

  if (!forcar && fasesManejoOficiaisPromessa[tipo]) {
    return fasesManejoOficiaisPromessa[tipo];
  }

  fasesManejoOficiaisStatus[tipo] = "carregando";

  const promessa = (async () => {
    const referencia = doc(db, "configuracoes", config.documento);
    const snapshot = somenteServidor
      ? await getDocFromServer(referencia)
      : await getDoc(referencia);
    const lista = snapshot.exists()
      ? normalizarListaFasesManejoOficiais(snapshot.data()?.sugestoes)
      : [];

    fasesManejoOficiaisCache[tipo] = lista;
    fasesManejoOficiaisStatus[tipo] = "pronto";
    return [...lista];
  })();

  fasesManejoOficiaisPromessa[tipo] = promessa;

  try {
    return await promessa;
  } catch (error) {
    if (fasesManejoOficiaisCache[tipo]?.length) {
      fasesManejoOficiaisStatus[tipo] = "pronto";
    } else {
      fasesManejoOficiaisStatus[tipo] = "erro";
    }
    throw error;
  } finally {
    if (fasesManejoOficiaisPromessa[tipo] === promessa) {
      fasesManejoOficiaisPromessa[tipo] = null;
    }
  }
}

function garantirFasesManejoOficiaisCarregadas(setor = getManejoSetorAtual()) {
  const tipo = tipoFasesManejoOficiais(setor);
  if (fasesManejoOficiaisStatus[tipo] !== "pendente") return;

  carregarFasesManejoOficiais(tipo)
    .then(() => {
      if (document.getElementById("manejo")?.classList.contains("active") &&
          tipoFasesManejoOficiais(getManejoSetorAtual()) === tipo) {
        renderFiltrosColunasManejo();
        renderManejoInline();
      }
    })
    .catch(error => {
      console.error(`Não foi possível carregar as fases oficiais de ${FASES_MANEJO_ADMIN_POR_SETOR[tipo].label}.`, error);
      if (document.getElementById("manejo")?.classList.contains("active") &&
          tipoFasesManejoOficiais(getManejoSetorAtual()) === tipo) {
        renderManejoInline();
      }
    });
}

function renderCampoFaseManejoOficial(rowId, setor, faseAtual = "") {
  const tipo = tipoFasesManejoOficiais(setor);
  const config = FASES_MANEJO_ADMIN_POR_SETOR[tipo];
  garantirFasesManejoOficiaisCarregadas(tipo);

  const status = fasesManejoOficiaisStatus[tipo];
  const fases = getFasesManejoOficiaisCache(tipo);
  const atual = limparTexto(faseAtual).toUpperCase();
  const chaveAtual = chaveFaseManejoOficial(atual);

  if (status === "pendente" || status === "carregando") {
    return `<select id="${rowId}-fase" disabled aria-label="Fase ${escapeHtml(config.label)}"><option value="">Carregando fases...</option></select>`;
  }

  if (status === "erro") {
    return `<select id="${rowId}-fase" disabled aria-label="Fase ${escapeHtml(config.label)}"><option value="">Não foi possível carregar as fases</option></select>`;
  }

  if (!fases.length) {
    return `<select id="${rowId}-fase" disabled aria-label="Fase ${escapeHtml(config.label)}"><option value="">Nenhuma fase cadastrada pelo administrador</option></select>`;
  }

  const faseOficialAtual = fases.find(fase => chaveFaseManejoOficial(fase) === chaveAtual) || "";
  const opcaoHistorica = atual && !faseOficialAtual
    ? `<option value="${escapeHtml(atual)}" selected disabled>${escapeHtml(atual)} — fora da lista atual</option>`
    : "";

  const opcoes = fases.map(fase => {
    const selected = faseOficialAtual && chaveFaseManejoOficial(fase) === chaveFaseManejoOficial(faseOficialAtual)
      ? " selected"
      : "";
    return `<option value="${escapeHtml(fase)}"${selected}>${escapeHtml(fase)}</option>`;
  }).join("");

  return `
    <select id="${rowId}-fase" aria-label="Fase ${escapeHtml(config.label)}" title="Selecione uma fase cadastrada pelo administrador">
      <option value="">Selecione a fase</option>
      ${opcaoHistorica}
      ${opcoes}
    </select>
  `;
}

async function validarFaseManejoOficialAntesDeGravar(ordem, setor, faseInformada) {
  const tipo = tipoFasesManejoOficiais(setor);
  const config = FASES_MANEJO_ADMIN_POR_SETOR[tipo];
  const fase = limparTexto(faseInformada).toUpperCase();

  if (!fase) {
    toast(`Selecione uma fase de ${config.label} definida pelo administrador.`);
    return "";
  }

  let fases;
  try {
    fases = await carregarFasesManejoOficiais(tipo, {
      forcar: true,
      somenteServidor: true
    });
  } catch (error) {
    console.error("Não foi possível validar a fase diretamente no servidor.", error);
    toast("Não foi possível confirmar a lista oficial de fases no servidor. Confira a internet e tente novamente.");
    return "";
  }

  const chave = chaveFaseManejoOficial(fase);
  const faseOficial = fases.find(item => chaveFaseManejoOficial(item) === chave) || "";

  if (!faseOficial) {
    const opLabel = ordem?.numeroOP ? ` da OP ${ordem.numeroOP}` : "";
    toast(`A fase "${fase}"${opLabel} não está autorizada pelo administrador. Selecione uma opção da lista oficial.`);
    return "";
  }

  return faseOficial;
}

window.addEventListener("corponu:fases-manejo-atualizadas", event => {
  const tipoInformado = String(event?.detail?.tipo || "").trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(FASES_MANEJO_ADMIN_POR_SETOR, tipoInformado)) return;

  atualizarCacheFasesManejoOficiais(tipoInformado, event?.detail?.fases || []);

  if (document.getElementById("manejo")?.classList.contains("active") &&
      tipoFasesManejoOficiais(getManejoSetorAtual()) === tipoInformado) {
    renderFiltrosColunasManejo();
    renderManejoInline();
  }
});

'''

app = replace_once(app, helper_anchor, helper_block + helper_anchor, 'núcleo das fases oficiais')

old_phase_cell = '''        <td>
          <div class="fase-plus">
            <input id="${rowId}-fase" value="${escapeHtml(manejo?.fase || "")}" list="manejoFasesList" placeholder="Digite a fase" />
            <button class="btn-plus" type="button" onclick="adicionarFaseSugestao('${op.id}')" title="Adicionar Fase Bojo às sugestões">+</button>
          </div>
        </td>
'''
new_phase_cell = '''        <td>
          ${renderCampoFaseManejoOficial(rowId, setor, manejo?.fase || "")}
        </td>
'''
app = replace_once(app, old_phase_cell, new_phase_cell, 'campo livre de fase do Manejo')

old_save_phase = '''  const manejoExistente = getManejoDaOrdem(ordem, setor);
  const fase = limparTexto(valorLinhaManejo(ordem, "fase")).toUpperCase();
  const faseLateral = setor === "sutia"
    ? limparTexto(valorLinhaManejo(ordem, "faseLateral")).toUpperCase()
    : (manejoExistente?.faseLateral || "");

  if (!fase) {
    toast("Informe a fase antes de salvar.");
    return;
  }
'''
new_save_phase = '''  const manejoExistente = getManejoDaOrdem(ordem, setor);
  const faseInformada = limparTexto(valorLinhaManejo(ordem, "fase")).toUpperCase();
  const faseLateral = setor === "sutia"
    ? limparTexto(valorLinhaManejo(ordem, "faseLateral")).toUpperCase()
    : (manejoExistente?.faseLateral || "");
  const fase = await validarFaseManejoOficialAntesDeGravar(ordem, setor, faseInformada);

  if (!fase) return;
'''
app = replace_once(app, old_save_phase, new_save_phase, 'validação do salvar Manejo')

old_bip_phase = '''  const manejoExistente = getManejoDaOrdem(ordem, setor) || {};
  const faseAtual = limparTexto(valorLinhaManejo(ordem, "fase")).toUpperCase() || manejoExistente.fase || "";
  const faseLateralAtual = setor === "sutia"
    ? (limparTexto(valorLinhaManejo(ordem, "faseLateral")).toUpperCase() || manejoExistente.faseLateral || "")
    : (manejoExistente.faseLateral || "");

  if (!faseAtual) {
    const continuar = confirm("Essa OP ainda está sem fase preenchida. Deseja marcar como bipada mesmo assim?");
    if (!continuar) return;
  }
'''
new_bip_phase = '''  const manejoExistente = getManejoDaOrdem(ordem, setor) || {};
  const faseInformada = limparTexto(valorLinhaManejo(ordem, "fase")).toUpperCase() || manejoExistente.fase || "";
  const faseLateralAtual = setor === "sutia"
    ? (limparTexto(valorLinhaManejo(ordem, "faseLateral")).toUpperCase() || manejoExistente.faseLateral || "")
    : (manejoExistente.faseLateral || "");
  const faseAtual = await validarFaseManejoOficialAntesDeGravar(ordem, setor, faseInformada);

  if (!faseAtual) return;
'''
app = replace_once(app, old_bip_phase, new_bip_phase, 'validação do bipar Manejo')

old_move_phase = '''  const manejoExistente = getManejoDaOrdem(op, setor) || {};
  const faseLinha = limparTexto(valorLinhaManejo(op, "fase")).toUpperCase();
  const fase = faseLinha || manejoExistente.fase || "PRONTO PARA MOVIMENTAR";
  const faseLateral = setor === "sutia"
'''
new_move_phase = '''  const manejoExistente = getManejoDaOrdem(op, setor) || {};
  const faseInformada = limparTexto(valorLinhaManejo(op, "fase")).toUpperCase() || manejoExistente.fase || "";
  const fase = await validarFaseManejoOficialAntesDeGravar(op, setor, faseInformada);
  if (!fase) {
    const erro = new Error("Fase do Manejo não autorizada pelo administrador.");
    erro.code = "fase-manejo-nao-autorizada";
    throw erro;
  }
  const faseLateral = setor === "sutia"
'''
app = replace_once(app, old_move_phase, new_move_phase, 'validação antes de movimentar')

app = replace_once(
    app,
    '    fase: state.fasesManejoExtras || [],\n',
    '    fase: getFasesManejoOficiaisCache(setor),\n',
    'fonte das opções exatas do filtro'
)

old_filter_render = '''  preencherSelectFiltroManejo("filtroManejoFase", [
    ...ordens.map(op => getValorManejoParaFiltro(op, "fase")),
    ...state.fasesManejoExtras
  ], "Todas");
'''
new_filter_render = '''  preencherSelectFiltroManejo("filtroManejoFase", getFasesManejoOficiaisCache(setor), "Todas");
'''
app = replace_once(app, old_filter_render, new_filter_render, 'fonte visual do filtro de fase')

old_primary_datalist = '''  if (fasesList) {
    const fases = new Set();

    state.fasesManejoExtras.forEach(fase => {
      if (fase) fases.add(String(fase).toUpperCase());
    });

    state.ordens.forEach(op => {
      getTodosManejosDaOrdem(op).forEach(manejo => {
        if (manejo?.fase) fases.add(String(manejo.fase).toUpperCase());
      });
    });

    fasesList.innerHTML = [...fases].sort().map(fase => `<option value="${escapeHtml(fase)}"></option>`).join("");
  }
'''
new_primary_datalist = '''  if (fasesList) {
    const fases = getFasesManejoOficiaisCache(getManejoSetorAtual());
    fasesList.innerHTML = fases
      .map(fase => `<option value="${escapeHtml(fase)}"></option>`)
      .join("");
  }
'''
app = replace_once(app, old_primary_datalist, new_primary_datalist, 'datalist legado da fase principal')

app = replace_once(app, '  fasesManejoExtras: [],\n', '', 'estado local legado de fase principal')
app = replace_once(
    app,
    '  state.fasesManejoExtras = carregarListaLocalManejo("fasesManejoExtras");\n',
    '',
    'carregamento local legado de fase principal'
)

old_add_phase = '''function adicionarFaseSugestao(ordemId) {
  adicionarSugestaoManejo(ordemId, "fase", "fasesManejoExtras", "fasesManejoExtras", "Fase Bojo");
}

'''
app = replace_once(app, old_add_phase, '', 'função local para criar fase principal')

# -----------------------------------------------------------------------------
# update.js: mantém os snapshots oficiais e publica a lista para app.js.
# Não reinstala datalist/campo livre no DOM.
# -----------------------------------------------------------------------------
update = regex_once(
    update,
    r'  function aplicarListaCorretaNosCamposFaseManejo\(\) \{[\s\S]*?\n  \}\n',
    '''  function aplicarListaCorretaNosCamposFaseManejo() {
    document.querySelectorAll('#manejo select[id$="-fase"]').forEach(select => {
      select.removeAttribute("list");
      select.removeAttribute("data-lista-fase-tipo");
      select.title = "Selecione uma fase cadastrada pelo administrador.";
    });
  }
''',
    'compatibilidade dos campos oficiais'
)

publisher_anchor = '  function iniciarSnapshotConfiguracaoFases() {\n'
publisher = '''  function publicarFasesManejoOficiaisParaAplicacao(tipo, fases) {
    const tipoNormalizado = String(tipo || "").trim().toLowerCase();
    if (!['sutia', 'calcinha'].includes(tipoNormalizado)) return;

    window.dispatchEvent(new CustomEvent("corponu:fases-manejo-atualizadas", {
      detail: {
        tipo: tipoNormalizado,
        fases: ordenarFasesGerenciadas(fases)
      }
    }));
  }

'''
update = replace_once(update, publisher_anchor, publisher + publisher_anchor, 'publicador das listas oficiais')

old_sutia_snapshot = '''        fasesGerenciadas = ordenarFasesGerenciadas(
          configuracaoFasesExiste ? snapshot.data()?.sugestoes : opcoesAtuaisDoDatalistFases()
        );
        aplicarListaOficialNoDatalist();
'''
new_sutia_snapshot = '''        fasesGerenciadas = ordenarFasesGerenciadas(
          configuracaoFasesExiste ? snapshot.data()?.sugestoes : opcoesAtuaisDoDatalistFases()
        );
        publicarFasesManejoOficiaisParaAplicacao("sutia", fasesGerenciadas);
        aplicarListaOficialNoDatalist();
'''
update = replace_once(update, old_sutia_snapshot, new_sutia_snapshot, 'snapshot oficial do Sutiã')

old_calcinha_snapshot = '''      fasesCalcinhaGerenciadas = ordenarFasesGerenciadas(
        snapshot.exists() ? snapshot.data()?.sugestoes : []
      );
      renderDatalistFasesCalcinha();
'''
new_calcinha_snapshot = '''      fasesCalcinhaGerenciadas = ordenarFasesGerenciadas(
        snapshot.exists() ? snapshot.data()?.sugestoes : []
      );
      publicarFasesManejoOficiaisParaAplicacao("calcinha", fasesCalcinhaGerenciadas);
      renderDatalistFasesCalcinha();
'''
update = replace_once(update, old_calcinha_snapshot, new_calcinha_snapshot, 'snapshot oficial da Calcinha')

update = replace_once(
    update,
    '    if (aviso) aviso.innerHTML = "Esta lista controla diretamente o filtro mostrado na tabela. Os usuários podem digitar livremente, mas a opção só entra no filtro oficial do <strong>Sutiã</strong> quando o administrador adicioná-la aqui.";\n',
    '    if (aviso) aviso.innerHTML = "Esta lista define as fases que podem ser selecionadas e salvas no Manejo do <strong>Sutiã</strong>. Somente o administrador pode adicionar ou remover opções.";\n',
    'aviso administrativo do Sutiã'
)

update = replace_once(
    update,
    '        Esta lista controla diretamente o filtro mostrado na tabela. Os usuários podem digitar livremente, mas a opção só entra no filtro oficial da <strong>Calcinha</strong> quando o administrador adicioná-la aqui.\n',
    '        Esta lista define as fases que podem ser selecionadas e salvas no Manejo da <strong>Calcinha</strong>. O operador só pode usar opções cadastradas aqui pelo administrador.\n',
    'aviso administrativo da Calcinha'
)

# Invariantes estruturais: se alguma voltar, aborta antes de escrever arquivos.
proibidos_app = [
    'onclick="adicionarFaseSugestao(',
    'function adicionarFaseSugestao(',
    'state.fasesManejoExtras',
    '<input id="${rowId}-fase" value=',
    'Essa OP ainda está sem fase preenchida. Deseja marcar como bipada mesmo assim?',
]
for trecho in proibidos_app:
    if trecho in app:
        raise RuntimeError(f"Trecho legado ainda presente em app.js: {trecho}")

obrigatorios_app = [
    'getDocFromServer',
    'documento: "fasesManejo"',
    'documento: "fasesManejoCalcinha"',
    'function renderCampoFaseManejoOficial(',
    'function validarFaseManejoOficialAntesDeGravar(',
    '${renderCampoFaseManejoOficial(rowId, setor, manejo?.fase || "")}',
    'const fase = await validarFaseManejoOficialAntesDeGravar(ordem, setor, faseInformada);',
    'const faseAtual = await validarFaseManejoOficialAntesDeGravar(ordem, setor, faseInformada);',
    'const fase = await validarFaseManejoOficialAntesDeGravar(op, setor, faseInformada);',
    'getFasesManejoOficiaisCache(setor)',
]
for trecho in obrigatorios_app:
    if trecho not in app:
        raise RuntimeError(f"Invariante ausente em app.js: {trecho}")

if app.count('validarFaseManejoOficialAntesDeGravar(') < 4:
    raise RuntimeError('A validação oficial não cobre todos os limites manuais esperados.')

for trecho in [
    'Os usuários podem digitar livremente, mas a opção só entra no filtro oficial do <strong>Sutiã</strong>',
    'Os usuários podem digitar livremente, mas a opção só entra no filtro oficial da <strong>Calcinha</strong>',
]:
    if trecho in update:
        raise RuntimeError(f"Texto antigo ainda presente em update.js: {trecho}")

for trecho in [
    'publicarFasesManejoOficiaisParaAplicacao("sutia", fasesGerenciadas)',
    'publicarFasesManejoOficiaisParaAplicacao("calcinha", fasesCalcinhaGerenciadas)',
    'corponu:fases-manejo-atualizadas',
    "document.querySelectorAll('#manejo select[id$=\"-fase\"]')",
]:
    if trecho not in update:
        raise RuntimeError(f"Invariante ausente em update.js: {trecho}")

APP.write_text(app, encoding="utf-8")
UPDATE.write_text(update, encoding="utf-8")
print("Fases do Manejo restringidas estruturalmente às listas oficiais do administrador.")
