(() => {
  "use strict";

  const VERSION = "2026-08-21-revisao-faccoes-direto-234";
  const FB = "10.12.5";
  const CONFIG_GRUPOS_ID = "grupos-faccoes-processos";
  const CACHE_MS = 60 * 1000;
  const CAMPOS = Object.freeze({
    lateral: { checkboxId: "revLateral", selectId: "revLateralQuemFez", processo: "LATERAL", titulo: "Qual facção fez a lateral?" },
    bojo: { checkboxId: "revBojo", selectId: "revBojoQuemFez", processo: "ENCAPAR BOJO", titulo: "Qual facção fez o bojo?" }
  });
  const BOJO_PADRAO = new Set([
    "DIVINA", "GRACIANE", "JESSICA", "LARISSA", "ALINE BATISTA",
    "DAIANY", "NAGILA", "DELMA", "GIRLAINE"
  ]);

  if (window.__CORPONU_REVISAO_FACCOES__ === VERSION) return;
  window.__CORPONU_REVISAO_FACCOES__ = VERSION;

  let firebasePromise = null;
  let cache = null;
  let carregandoPromise = null;

  const texto = valor => String(valor ?? "").trim();
  const normalizar = valor => texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
  const escapar = valor => String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function processoCanonico(valor) {
    const nome = normalizar(valor);
    const aliases = {
      "BOJO": "ENCAPAR BOJO",
      "ENCAPAR": "ENCAPAR BOJO",
      "ENCAPA BOJO": "ENCAPAR BOJO",
      "ENCAPAR BOJOS": "ENCAPAR BOJO",
      "LATERAIS": "LATERAL"
    };
    return aliases[nome] || nome;
  }

  const slug = valor => normalizar(valor)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  async function firebase() {
    if (firebasePromise) return firebasePromise;
    firebasePromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-firestore.js`)
    ]).then(([appMod, fs]) => {
      if (!appMod.getApps().length) throw new Error("Firebase ainda não inicializado.");
      return { db: fs.getFirestore(appMod.getApp()), fs };
    }).catch(error => {
      firebasePromise = null;
      throw error;
    });
    return firebasePromise;
  }

  function faccaoAtiva(faccao) {
    return faccao && faccao.ativo !== false && faccao.cadastroPendente !== true && !faccao.duplicadaDe && faccao.statusImportacao !== "duplicada_consolidada";
  }

  function processosDaFaccao(faccao) {
    const valores = [];
    [faccao?.processosPermitidos, faccao?.processos, faccao?.servicosPermitidos, faccao?.servicos, faccao?.processosFaccao]
      .forEach(lista => { if (Array.isArray(lista)) valores.push(...lista); });
    [faccao?.processo, faccao?.processoPrincipal, faccao?.servico, faccao?.servicoNome]
      .forEach(valor => { if (valor) valores.push(valor); });
    return [...new Set(valores.map(item => processoCanonico(
      typeof item === "string" ? item : item?.nome || item?.processo || item?.servicoNome || ""
    )).filter(Boolean))];
  }

  function grupoIds(configuracao, processo) {
    const grupos = configuracao?.grupos && typeof configuracao.grupos === "object" ? configuracao.grupos : {};
    const chaveEsperada = slug(processo);
    const ids = new Set();
    Object.entries(grupos).forEach(([chave, grupo]) => {
      if (chave !== chaveEsperada && processoCanonico(grupo?.processo) !== processoCanonico(processo)) return;
      (Array.isArray(grupo?.faccaoIds) ? grupo.faccaoIds : []).forEach(id => ids.add(String(id)));
    });
    return ids;
  }

  function nomesGlobais(processo) {
    try {
      const retorno = window.getFaccoesGerenciadasPorProcesso?.(processo);
      return Array.isArray(retorno)
        ? retorno.map(item => texto(typeof item === "string" ? item : item?.nome)).filter(Boolean)
        : [];
    } catch (_) {
      return [];
    }
  }

  async function carregarFaccoes(forcar = false) {
    if (!forcar && cache && Date.now() - cache.carregadoEm < CACHE_MS) return cache;
    if (carregandoPromise && !forcar) return carregandoPromise;

    carregandoPromise = (async () => {
      const ctx = await firebase();
      const [faccoesSnap, gruposSnap] = await Promise.all([
        ctx.fs.getDocs(ctx.fs.collection(ctx.db, "faccoes")),
        ctx.fs.getDoc(ctx.fs.doc(ctx.db, "configuracoes", CONFIG_GRUPOS_ID))
      ]);
      const configuracao = gruposSnap.exists() ? gruposSnap.data() : {};
      const faccoes = faccoesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(faccaoAtiva);
      const porProcesso = {};

      Object.values(CAMPOS).forEach(campo => {
        const processo = processoCanonico(campo.processo);
        const idsGrupo = grupoIds(configuracao, processo);
        const externos = new Set(nomesGlobais(processo).map(normalizar));
        const mapa = new Map();

        faccoes.forEach(faccao => {
          const nome = texto(faccao.nome);
          const chave = normalizar(nome);
          if (!nome) return;
          const vinculada = processosDaFaccao(faccao).includes(processo) || idsGrupo.has(String(faccao.id));
          const externa = externos.has(chave);
          const fallbackBojo = processo === "ENCAPAR BOJO" && BOJO_PADRAO.has(chave);
          if ((vinculada || externa || fallbackBojo) && !mapa.has(chave)) mapa.set(chave, { id: faccao.id, nome });
        });

        nomesGlobais(processo).forEach(nome => {
          const chave = normalizar(nome);
          if (chave && !mapa.has(chave)) mapa.set(chave, { id: "", nome });
        });

        porProcesso[processo] = [...mapa.values()].sort((a, b) =>
          a.nome.localeCompare(b.nome, "pt-BR", { numeric: true, sensitivity: "base" })
        );
      });

      cache = { carregadoEm: Date.now(), porProcesso };
      return cache;
    })().finally(() => { carregandoPromise = null; });

    return carregandoPromise;
  }

  function garantirSelect(tipo) {
    const campo = CAMPOS[tipo];
    const atual = document.getElementById(campo.selectId);
    if (!atual) return null;
    if (atual instanceof HTMLSelectElement) return atual;

    const valorAnterior = texto(atual.value);
    const select = document.createElement("select");
    [...atual.attributes].forEach(atributo => {
      if (["type", "maxlength", "placeholder", "autocomplete"].includes(atributo.name)) return;
      select.setAttribute(atributo.name, atributo.value);
    });
    select.id = campo.selectId;
    select.innerHTML = '<option value="">Carregando facções...</option>';
    if (valorAnterior) select.dataset.valorAnterior = valorAnterior;
    atual.replaceWith(select);

    const bloco = select.closest(".rev-responsavel-50");
    const label = bloco?.querySelector(`label[for="${campo.selectId}"]`);
    const ajuda = bloco?.querySelector("small");
    if (label) label.textContent = campo.titulo;
    if (ajuda) ajuda.textContent = `Mostra somente facções vinculadas ao processo ${campo.processo}.`;
    return select;
  }

  function garantirOpcaoAnterior(select, valor) {
    const nome = texto(valor);
    if (!(select instanceof HTMLSelectElement) || !nome) return;
    let option = [...select.options].find(item => normalizar(item.value) === normalizar(nome));
    if (!option) {
      option = document.createElement("option");
      option.value = nome;
      option.textContent = `${nome} — registro anterior`;
      option.dataset.registroAnterior = "1";
      select.appendChild(option);
    }
    select.value = option.value;
    delete select.dataset.valorAnterior;
  }

  function sincronizarDisponibilidade(tipo) {
    const campo = CAMPOS[tipo];
    const checkbox = document.getElementById(campo.checkboxId);
    const select = document.getElementById(campo.selectId);
    if (!checkbox || !(select instanceof HTMLSelectElement)) return;
    const possuiOpcoes = [...select.options].some(option => option.value);
    select.disabled = !checkbox.checked || !possuiOpcoes;
    select.required = checkbox.checked;
    select.setAttribute("aria-required", checkbox.checked ? "true" : "false");
    select.closest(".rev-responsavel-50")?.classList.toggle("desabilitado", !checkbox.checked);
  }

  function preencherSelect(tipo, itens) {
    const campo = CAMPOS[tipo];
    const select = garantirSelect(tipo);
    if (!(select instanceof HTMLSelectElement)) return;

    const valorAtual = texto(select.value || select.dataset.valorAnterior);
    const opcoes = ['<option value="">Selecione a facção</option>'];
    itens.forEach(item => opcoes.push(`<option value="${escapar(item.nome)}" data-faccao-id="${escapar(item.id)}">${escapar(item.nome)}</option>`));
    select.innerHTML = opcoes.join("");
    if (valorAtual) garantirOpcaoAnterior(select, valorAtual);
    sincronizarDisponibilidade(tipo);
  }

  async function prepararCampos(forcar = false) {
    const lateral = garantirSelect("lateral");
    const bojo = garantirSelect("bojo");
    if (!lateral || !bojo) return false;

    try {
      const dados = await carregarFaccoes(forcar);
      preencherSelect("lateral", dados.porProcesso.LATERAL || []);
      preencherSelect("bojo", dados.porProcesso["ENCAPAR BOJO"] || []);
      return true;
    } catch (error) {
      console.error("Não foi possível carregar as facções da revisão.", error);
      return false;
    }
  }

  function reaplicarValoresAnteriores() {
    Object.keys(CAMPOS).forEach(tipo => {
      const select = document.getElementById(CAMPOS[tipo].selectId);
      if (!(select instanceof HTMLSelectElement)) return;
      const anterior = texto(select.dataset.valorAnterior);
      if (anterior) garantirOpcaoAnterior(select, anterior);
      sincronizarDisponibilidade(tipo);
    });
  }

  function instalarEventos() {
    if (document.documentElement.dataset.revisaoFaccoesEventos === VERSION) return;
    document.documentElement.dataset.revisaoFaccoesEventos = VERSION;

    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (!alvo) return;
      if (alvo.closest('[data-page="revisao-componentes"]')) prepararCampos(false).catch(() => {});
      if (alvo.closest("#btnAtualizarRev")) prepararCampos(true).catch(() => {});
      if (alvo.closest("[data-editar-rev]")) window.setTimeout(reaplicarValoresAnteriores, 0);
    }, true);

    document.addEventListener("change", event => {
      if (event.target?.id === "revLateral") sincronizarDisponibilidade("lateral");
      if (event.target?.id === "revBojo") sincronizarDisponibilidade("bojo");
    }, true);
  }

  async function iniciar() {
    instalarEventos();
    const pronto = await prepararCampos(false).catch(() => false);
    if (!pronto && document.readyState !== "complete") {
      window.addEventListener("load", () => prepararCampos(false).catch(() => {}), { once: true });
    }
  }

  window.CorpoNuRevisaoFaccoes = {
    versao: VERSION,
    atualizar: prepararCampos
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();
