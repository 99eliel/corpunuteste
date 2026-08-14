(() => {
  "use strict";

  const VERSION = "2026-08-14-faccoes-processos-saida-estavel-163";
  const FIREBASE_VERSION = "10.12.5";
  const CACHE_MS = 60000;
  const PROCESSOS_PADRAO = [
    "ENCAPAR BOJO",
    "ALÇA",
    "LATERAL",
    "CALCINHA MONTAGEM",
    "CALCINHA COMPLETA",
    "SUTIÃ MONTAGEM",
    "SUTIÃ COMPLETO"
  ];

  if (window.__CORPONU_FACCOES_PROCESSOS_CADASTRADOS__ === VERSION) return;
  window.__CORPONU_FACCOES_PROCESSOS_CADASTRADOS__ = VERSION;

  let contextoPromise = null;
  let carregamentoPromise = null;
  let cache = null;
  let cacheEm = 0;
  let sequenciaPreenchimento = 0;

  const normalizar = valor => String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

  const escapar = valor => String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function adicionarLista(destino, valor) {
    const itens = Array.isArray(valor) ? valor : (valor ? [valor] : []);
    itens.forEach(item => {
      const nome = typeof item === "string"
        ? item
        : item?.nome || item?.processo || item?.servicoNome || item?.label || "";
      const ativo = typeof item === "object" ? item?.ativo !== false : true;
      const chave = normalizar(nome);
      if (ativo && chave && !["TODOS", "TODAS", "SELECIONE", "PROCESSO"].includes(chave)) {
        destino.set(chave, String(nome).trim().toUpperCase());
      }
    });
  }

  async function contexto() {
    if (contextoPromise) return contextoPromise;
    contextoPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
    ]).then(([appModulo, firestore]) => {
      if (!appModulo.getApps().length) throw new Error("Firebase não inicializado");
      return { db: firestore.getFirestore(appModulo.getApp()), firestore };
    }).catch(error => {
      contextoPromise = null;
      throw error;
    });
    return contextoPromise;
  }

  function classificacaoFaccao(faccao) {
    const processos = Array.isArray(faccao?.processosPermitidos) ? faccao.processosPermitidos : [];
    const grupos = Array.isArray(faccao?.gruposPermitidos) ? faccao.gruposPermitidos : [];
    const texto = normalizar([...processos, ...grupos, faccao?.grupo].join(" "));
    return {
      sutia: typeof faccao?.trabalhaSutia === "boolean"
        ? faccao.trabalhaSutia
        : faccao?.atendeSutia === true || /SUTIA|BOJO|ALCA|LATERAL/.test(texto),
      calcinha: typeof faccao?.trabalhaCalcinha === "boolean"
        ? faccao.trabalhaCalcinha
        : faccao?.atendeCalcinha === true || texto.includes("CALCINHA") || texto.includes("LATERAL")
    };
  }

  function abaAtual() {
    const titulo = normalizar(document.getElementById("s3titulo")?.textContent);
    const botaoLateral = document.getElementById("abaFaccaoCorte");
    const painelLateral = document.getElementById("painelFaccoesCorte");
    const lateralAtiva = botaoLateral?.classList.contains("active") === true;
    const painelLateralVisivel = painelLateral && !painelLateral.classList.contains("hidden");

    // A área antiga "Corte" é apresentada visualmente como "Lateral e Alça".
    // Não depender apenas do texto "Corte", pois outro módulo troca esse rótulo.
    if (
      lateralAtiva ||
      painelLateralVisivel ||
      titulo.includes("CORTE") ||
      titulo.includes("LATERAL") ||
      titulo.includes("ALCA")
    ) return "corte";

    if (titulo.includes("CALCINHA")) return "calcinha";
    return "sutia";
  }

  function processosDoDOM() {
    const resultado = new Map();

    document.querySelectorAll("#faccoes select").forEach(select => {
      if (select.id === "s3processo") return;
      if (!/processo/i.test(`${select.id} ${select.name} ${select.closest("label")?.textContent || ""}`)) return;
      [...select.options].forEach(option => adicionarLista(resultado, option.value || option.textContent));
    });

    document.querySelectorAll("#faccoes [data-processo], #faccoes [data-processo-nome]").forEach(elemento => {
      adicionarLista(resultado, elemento.dataset.processo || elemento.dataset.processoNome);
    });

    return resultado;
  }

  function criarBaseInicial() {
    const porAba = {
      sutia: processosDoDOM(),
      calcinha: processosDoDOM(),
      corte: processosDoDOM()
    };

    PROCESSOS_PADRAO.forEach(nome => {
      adicionarLista(porAba.corte, nome);
      const chave = normalizar(nome);
      if (chave.includes("CALCINHA")) adicionarLista(porAba.calcinha, nome);
      else if (chave === "LATERAL") {
        adicionarLista(porAba.sutia, nome);
        adicionarLista(porAba.calcinha, nome);
      } else {
        adicionarLista(porAba.sutia, nome);
      }
    });

    return porAba;
  }

  async function carregarBase(forcar = false) {
    if (!forcar && cache && Date.now() - cacheEm < CACHE_MS) return cache;
    if (carregamentoPromise) return carregamentoPromise;

    carregamentoPromise = (async () => {
      const porAba = criarBaseInicial();
      const { db, firestore: f } = await contexto();

      const [faccoesSnap, precosSnap, configSnap] = await Promise.all([
        f.getDocs(f.collection(db, "faccoes")),
        f.getDocs(f.collection(db, "precosReferencia")),
        f.getDoc(f.doc(db, "configuracoes", "processos-corte"))
      ]);

      faccoesSnap.docs.forEach(documento => {
        const faccao = documento.data();
        if (faccao.ativo === false || faccao.cadastroPendente || faccao.duplicadaDe || faccao.statusImportacao === "duplicada_consolidada") return;
        const classe = classificacaoFaccao(faccao);
        const listas = [
          faccao.processosPermitidos,
          faccao.processos,
          faccao.servicosPermitidos,
          faccao.servicos,
          faccao.processo
        ];
        listas.forEach(lista => {
          adicionarLista(porAba.corte, lista);
          if (classe.sutia) adicionarLista(porAba.sutia, lista);
          if (classe.calcinha) adicionarLista(porAba.calcinha, lista);
        });
      });

      precosSnap.docs.forEach(documento => {
        const preco = documento.data();
        if (preco.ativo === false) return;
        const nome = preco.processo || preco.servicoNome || preco.processoMovimentacao;
        if (!nome) return;
        adicionarLista(porAba.corte, nome);
        const setor = normalizar(preco.setor || preco.area || preco.tipoPeca);
        const processo = normalizar(nome);
        if (setor.includes("CALCINHA") || processo.includes("CALCINHA")) {
          adicionarLista(porAba.calcinha, nome);
        } else if (processo === "LATERAL") {
          adicionarLista(porAba.sutia, nome);
          adicionarLista(porAba.calcinha, nome);
        } else if (setor.includes("SUTIA") || /SUTIA|BOJO|ALCA/.test(processo)) {
          adicionarLista(porAba.sutia, nome);
        } else {
          adicionarLista(porAba.sutia, nome);
          adicionarLista(porAba.calcinha, nome);
        }
      });

      const configuracao = configSnap.exists() ? configSnap.data() : {};
      (Array.isArray(configuracao.processos) ? configuracao.processos : []).forEach(processo => {
        if (processo?.ativo === false) return;
        adicionarLista(porAba.corte, processo);
        if (processo?.atendeSutia === true) adicionarLista(porAba.sutia, processo);
        if (processo?.atendeCalcinha === true) adicionarLista(porAba.calcinha, processo);
      });

      cache = porAba;
      cacheEm = Date.now();
      return porAba;
    })().finally(() => {
      carregamentoPromise = null;
    });

    return carregamentoPromise;
  }

  function garantirSelect() {
    const atual = document.getElementById("s3processo");
    if (!atual) return null;
    if (atual instanceof HTMLSelectElement) return atual;

    const select = document.createElement("select");
    [...atual.attributes].forEach(atributo => {
      if (atributo.name === "type" || atributo.name === "placeholder") return;
      select.setAttribute(atributo.name, atributo.value);
    });
    select.id = "s3processo";
    select.required = true;
    select.innerHTML = '<option value="">Busque a OP para carregar</option>';
    atual.replaceWith(select);
    return select;
  }

  function itensPadraoDaAba(aba) {
    if (aba === "calcinha") {
      return PROCESSOS_PADRAO.filter(nome => {
        const chave = normalizar(nome);
        return chave.includes("CALCINHA") || chave === "LATERAL";
      });
    }
    if (aba === "sutia") {
      return PROCESSOS_PADRAO.filter(nome => !normalizar(nome).includes("CALCINHA"));
    }
    return [...PROCESSOS_PADRAO];
  }

  function opcoesValidas(select) {
    if (!(select instanceof HTMLSelectElement)) return [];
    return [...select.options]
      .map(option => String(option.value || "").trim())
      .filter(Boolean);
  }

  function preencherFallbackImediato() {
    const select = garantirSelect();
    if (!select || opcoesValidas(select).length) return select;

    const itens = itensPadraoDaAba(abaAtual());
    select.innerHTML = '<option value="">Selecione o processo</option>' + itens
      .map(nome => `<option value="${escapar(nome)}">${escapar(nome)}</option>`)
      .join("");
    select.disabled = false;
    return select;
  }

  async function preencherSelect(forcar = false) {
    const select = garantirSelect();
    if (!select) return;

    const minhaSequencia = ++sequenciaPreenchimento;
    const abaSolicitada = abaAtual();
    const valorAnterior = select.value;
    const tinhaOpcoes = opcoesValidas(select).length > 0;

    // Se já existe uma lista válida, não a apaga durante uma atualização assíncrona.
    // Isso evita o select "vazio" quando dois carregamentos se cruzam.
    if (!tinhaOpcoes) {
      preencherFallbackImediato();
    }

    try {
      const base = await carregarBase(forcar);
      if (minhaSequencia !== sequenciaPreenchimento) return;

      const abaAplicar = abaAtual();
      const mapa = base[abaAplicar] || base[abaSolicitada] || new Map();
      let itens = [...mapa.values()]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

      if (!itens.length) itens = itensPadraoDaAba(abaAplicar);

      const valorAtual = select.value || valorAnterior;
      select.innerHTML = '<option value="">Selecione o processo</option>' + itens
        .map(nome => `<option value="${escapar(nome)}">${escapar(nome)}</option>`)
        .join("");
      select.disabled = false;

      const encontrado = itens.find(nome => normalizar(nome) === normalizar(valorAtual));
      if (encontrado) select.value = encontrado;
    } catch (error) {
      console.error("Não foi possível carregar os processos cadastrados.", error);
      if (minhaSequencia !== sequenciaPreenchimento) return;

      // A leitura remota pode falhar, mas o operador continua com a base segura local.
      preencherFallbackImediato();
      select.disabled = false;
    }
  }

  function preparar() {
    const select = garantirSelect();
    if (!select) return;
    if (!opcoesValidas(select).length) preencherFallbackImediato();
  }

  function agendarPreenchimento(forcar = false) {
    [0, 120, 420].forEach(atraso => {
      window.setTimeout(() => preencherSelect(forcar && atraso === 0), atraso);
    });
  }

  document.addEventListener("pointerdown", event => {
    const alvo = event.target instanceof Element ? event.target : null;
    if (!alvo?.matches?.("#s3processo")) return;
    preparar();
    if (opcoesValidas(alvo).length <= 1) preencherSelect(false);
  }, true);

  document.addEventListener("focusin", event => {
    const alvo = event.target instanceof Element ? event.target : null;
    if (!alvo?.matches?.("#s3processo")) return;
    preparar();
  }, true);

  document.addEventListener("click", event => {
    const alvo = event.target instanceof Element ? event.target : null;
    if (!alvo) return;

    if (alvo.closest("#btnSaidaAbas, #btnSaidaCorteNovo")) {
      preparar();
      agendarPreenchimento(false);
    }

    if (alvo.closest("#s3buscar")) {
      preparar();
      agendarPreenchimento(false);
    }
  }, true);

  const observer = new MutationObserver(mutations => {
    preparar();

    const abriuModal = mutations.some(mutation =>
      mutation.type === "attributes" &&
      mutation.target instanceof HTMLElement &&
      mutation.target.id === "modalSaida3" &&
      !mutation.target.classList.contains("hidden")
    );

    const exibiuCampos = mutations.some(mutation =>
      mutation.type === "attributes" &&
      mutation.target instanceof HTMLElement &&
      mutation.target.id === "s3campos" &&
      !mutation.target.classList.contains("hidden")
    );

    if (abriuModal || exibiuCampos) agendarPreenchimento(false);
  });

  function iniciar() {
    preparar();
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
    window.addEventListener("pageshow", () => {
      preparar();
      if (!document.getElementById("modalSaida3")?.classList.contains("hidden")) {
        agendarPreenchimento(false);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
