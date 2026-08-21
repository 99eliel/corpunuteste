(() => {
  "use strict";

  const VERSION = "2026-08-12-faccoes-otimizadas-183";
  const FB = "10.12.5";

  if (window.__CORPONU_FACCOES_GRUPOS_SAIDA_FIX__ === VERSION) return;
  window.__CORPONU_FACCOES_GRUPOS_SAIDA_FIX__ = VERSION;

  let contextoPromise = null;
  let cacheFaccoes = null;
  let cacheEm = 0;
  let sequenciaGlobal = 0;

  const estados = {
    registro: { processo: "", nomes: [], assinatura: "", observador: null, reaplicando: false, sequencia: 0 },
    manejo: { processo: "", nomes: [], assinatura: "", observador: null, reaplicando: false, sequencia: 0 }
  };

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

  function processoCanonico(valor) {
    const texto = normalizar(valor);
    const aliases = {
      "BOJO": "ENCAPAR BOJO",
      "ENCAPAR": "ENCAPAR BOJO",
      "ENCAPA BOJO": "ENCAPAR BOJO",
      "ENCAPAR BOJOS": "ENCAPAR BOJO",
      "ALCA": "ALÇA",
      "ALCAS": "ALÇA",
      "ALÇAS": "ALÇA",
      "SUTIA MONTAGEM": "SUTIÃ MONTAGEM",
      "SUTIA COMPLETO": "SUTIÃ COMPLETO",
      "MONTAGEM CALCINHA": "CALCINHA MONTAGEM",
      "CALCINHA PRONTA": "CALCINHA COMPLETA"
    };
    return aliases[texto] || texto;
  }

  function processosDaFaccao(faccao) {
    const campos = [
      faccao?.processosPermitidos,
      faccao?.processos,
      faccao?.servicosPermitidos,
      faccao?.servicos,
      faccao?.processo
    ];
    const processos = new Set();

    campos.forEach(campo => {
      const itens = Array.isArray(campo) ? campo : (campo ? [campo] : []);
      itens.forEach(item => {
        const nome = processoCanonico(
          typeof item === "string"
            ? item
            : item?.nome || item?.processo || item?.servicoNome || item?.label || ""
        );
        if (nome) processos.add(nome);
      });
    });

    return [...processos];
  }

  async function contexto() {
    if (contextoPromise) return contextoPromise;
    contextoPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-firestore.js`)
    ]).then(([appModulo, firestore]) => {
      if (!appModulo.getApps().length) throw new Error("Firebase ainda não inicializado.");
      return { db: firestore.getFirestore(appModulo.getApp()), firestore };
    }).catch(error => {
      contextoPromise = null;
      throw error;
    });
    return contextoPromise;
  }

  async function carregarFaccoes(forcar = false) {
    if (!forcar && cacheFaccoes && Date.now() - cacheEm < 10000) return cacheFaccoes;

    const { db, firestore: fs } = await contexto();
    const snap = await fs.getDocs(fs.collection(db, "faccoes"));
    const mapa = new Map();

    snap.docs.forEach(documento => {
      const faccao = { id: documento.id, ...documento.data() };
      if (faccao.ativo === false || faccao.cadastroPendente || faccao.duplicadaDe || faccao.statusImportacao === "duplicada_consolidada") return;
      const chave = normalizar(faccao.nome);
      if (!chave) return;
      const atual = mapa.get(chave);
      if (!atual || processosDaFaccao(faccao).length > processosDaFaccao(atual).length) mapa.set(chave, faccao);
    });

    cacheFaccoes = [...mapa.values()].sort((a, b) =>
      String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { numeric: true })
    );
    cacheEm = Date.now();
    return cacheFaccoes;
  }

  async function faccoesDoProcesso(processo) {
    const processoNormalizado = processoCanonico(processo);
    if (!processoNormalizado) return [];
    const faccoes = await carregarFaccoes(false);
    return faccoes.filter(faccao => processosDaFaccao(faccao).includes(processoNormalizado));
  }

  function elementos(tipo) {
    if (tipo === "registro") {
      return {
        processo: document.getElementById("s3processo"),
        destino: document.getElementById("s3faccao"),
        processoOculto: null,
        ajudaId: "s3faccaoAjuda47"
      };
    }

    const tipoDestino = document.getElementById("movimentacaoTipoDestino");
    if (tipoDestino && normalizar(tipoDestino.value) && normalizar(tipoDestino.value) !== "FACCAO") return null;

    return {
      processo: document.getElementById("movimentacaoProcessoSelect") || document.getElementById("movimentacaoProcesso"),
      destino: document.getElementById("movimentacaoDestino"),
      processoOculto: document.getElementById("movimentacaoProcesso"),
      ajudaId: "movimentacaoDestinoAjuda47"
    };
  }

  function garantirAjuda(tipo, destino, ajudaId) {
    const label = destino?.closest("label");
    if (!destino || !label) return null;
    let ajuda = document.getElementById(ajudaId);
    if (!ajuda) {
      ajuda = document.createElement("small");
      ajuda.id = ajudaId;
      ajuda.style.cssText = "display:block;margin-top:6px;color:#64748b;font-size:11px;font-weight:700";
      label.appendChild(ajuda);
    }
    ajuda.dataset.tipo = tipo;
    return ajuda;
  }

  function assinaturaNomes(nomes) {
    return nomes.map(normalizar).join("|");
  }

  function assinaturaSelect(select) {
    return [...select.options]
      .slice(1)
      .map(option => normalizar(option.value || option.textContent))
      .filter(Boolean)
      .join("|");
  }

  function aplicarNomes(tipo, nomes, mensagemVazia = "Nenhuma facção cadastrada neste processo") {
    const refs = elementos(tipo);
    const estado = estados[tipo];
    const select = refs?.destino;
    if (!(select instanceof HTMLSelectElement)) return;

    const nomesOrdenados = [...new Set(nomes.map(nome => String(nome || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
    const assinatura = assinaturaNomes(nomesOrdenados);
    const ajuda = garantirAjuda(tipo, select, refs.ajudaId);

    if (assinaturaSelect(select) === assinatura && select.disabled === !nomesOrdenados.length) {
      if (ajuda) ajuda.textContent = nomesOrdenados.length
        ? `${nomesOrdenados.length} facção(ões) habilitada(s) neste processo.`
        : mensagemVazia;
      return;
    }

    const anterior = select.value;
    estado.reaplicando = true;
    select.innerHTML = nomesOrdenados.length
      ? '<option value="">Selecione a facção</option>' + nomesOrdenados
        .map(nome => `<option value="${escapar(nome)}">${escapar(nome)}</option>`)
        .join("")
      : `<option value="">${escapar(mensagemVazia)}</option>`;
    select.disabled = !nomesOrdenados.length;

    const encontrado = nomesOrdenados.find(nome => normalizar(nome) === normalizar(anterior));
    if (encontrado) select.value = encontrado;
    estado.reaplicando = false;
    estado.assinatura = assinatura;

    if (ajuda) ajuda.textContent = nomesOrdenados.length
      ? `${nomesOrdenados.length} facção(ões) habilitada(s) neste processo.`
      : mensagemVazia;
  }

  function instalarProtecao(tipo) {
    const refs = elementos(tipo);
    const estado = estados[tipo];
    const select = refs?.destino;
    if (!(select instanceof HTMLSelectElement)) return;

    const marcador = `protegidoProcessos47${tipo}`;
    if (select.dataset[marcador] === "1") return;
    select.dataset[marcador] = "1";

    estado.observador?.disconnect();
    estado.observador = new MutationObserver(() => {
      if (estado.reaplicando || !estado.processo || !estado.nomes.length) return;
      if (assinaturaSelect(select) !== estado.assinatura || select.disabled) {
        window.setTimeout(() => aplicarNomes(tipo, estado.nomes), 0);
      }
    });
    estado.observador.observe(select, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"]
    });
  }

  async function atualizar(tipo) {
    const refs = elementos(tipo);
    const estado = estados[tipo];
    const processoEl = refs?.processo;
    const destinoEl = refs?.destino;
    if (!(processoEl instanceof HTMLSelectElement || processoEl instanceof HTMLInputElement) || !(destinoEl instanceof HTMLSelectElement)) return;

    instalarProtecao(tipo);

    if (tipo === "manejo" && refs.processoOculto && refs.processoOculto !== processoEl) {
      refs.processoOculto.value = processoEl.value || "";
    }

    const processo = processoCanonico(processoEl.value);
    const minhaSequencia = ++sequenciaGlobal;
    estado.sequencia = minhaSequencia;
    estado.processo = processo;
    estado.nomes = [];
    estado.assinatura = "";

    if (!processo) {
      aplicarNomes(tipo, [], "Escolha o processo primeiro");
      return;
    }

    destinoEl.disabled = true;
    destinoEl.innerHTML = '<option value="">Carregando facções habilitadas...</option>';
    const ajuda = garantirAjuda(tipo, destinoEl, refs.ajudaId);
    if (ajuda) ajuda.textContent = `Consultando facções cadastradas em ${processo}...`;

    try {
      const faccoes = await faccoesDoProcesso(processo);
      if (estado.sequencia !== minhaSequencia) return;
      const nomes = faccoes.map(faccao => faccao.nome || "").filter(Boolean);
      estado.processo = processo;
      estado.nomes = nomes;
      estado.assinatura = assinaturaNomes(nomes);
      aplicarNomes(tipo, nomes);
    } catch (error) {
      console.error(`Erro ao carregar facções no fluxo ${tipo}.`, error);
      if (estado.sequencia !== minhaSequencia) return;
      aplicarNomes(tipo, [], "Erro ao carregar facções");
    }
  }

  function preparar(tipo) {
    instalarProtecao(tipo);
    const refs = elementos(tipo);
    if (refs?.processo?.value) atualizar(tipo);
  }

  function ehAlvoProcessoRegistro(alvo) {
    return alvo?.matches?.("#s3processo");
  }

  function ehAlvoProcessoManejo(alvo) {
    return alvo?.matches?.("#movimentacaoProcessoSelect, #movimentacaoProcesso");
  }

  document.addEventListener("change", event => {
    const alvo = event.target instanceof Element ? event.target : null;
    if (ehAlvoProcessoRegistro(alvo)) {
      event.stopImmediatePropagation();
      atualizar("registro");
      return;
    }
    if (ehAlvoProcessoManejo(alvo)) {
      event.stopImmediatePropagation();
      atualizar("manejo");
    }
  }, true);

  document.addEventListener("input", event => {
    const alvo = event.target instanceof Element ? event.target : null;
    if (ehAlvoProcessoRegistro(alvo)) {
      event.stopImmediatePropagation();
      window.setTimeout(() => atualizar("registro"), 0);
      return;
    }
    if (ehAlvoProcessoManejo(alvo)) {
      event.stopImmediatePropagation();
      window.setTimeout(() => atualizar("manejo"), 0);
    }
  }, true);

  document.addEventListener("click", event => {
    const alvo = event.target instanceof Element ? event.target : null;
    if (!alvo) return;

    if (alvo.closest("#btnSaidaAbas, #btnSaidaCorteNovo")) {
      [80, 300, 700].forEach(atraso => window.setTimeout(() => preparar("registro"), atraso));
    }

    if (alvo.closest("#s3buscar")) {
      cacheFaccoes = null;
      cacheEm = 0;
      [250, 650, 1100].forEach(atraso => window.setTimeout(() => preparar("registro"), atraso));
    }

    const botao = alvo.closest("button");
    const texto = normalizar(botao?.textContent);
    const abreManejo = alvo.closest("[onclick*='mandarParaFaccao']") || texto.includes("ENVIAR PARA FACCAO");
    if (abreManejo) {
      cacheFaccoes = null;
      cacheEm = 0;
      [80, 250, 550, 900].forEach(atraso => window.setTimeout(() => preparar("manejo"), atraso));
    }
  }, true);

  function instalarObservadorModalManejo() {
    const modal = document.getElementById("modalMovimentacao");
    if (!modal || modal.dataset.processos47Observado === "1") return;
    modal.dataset.processos47Observado = "1";
    const observer = new MutationObserver(() => {
      if (!modal.classList.contains("hidden")) {
        [0, 120, 350].forEach(atraso => window.setTimeout(() => preparar("manejo"), atraso));
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ["class"] });
  }

  const inicial = window.setInterval(() => {
    if (document.getElementById("s3faccao")) instalarProtecao("registro");
    if (document.getElementById("movimentacaoDestino")) instalarProtecao("manejo");
    instalarObservadorModalManejo();
  }, 250);
  window.setTimeout(() => window.clearInterval(inicial), 12000);
})();