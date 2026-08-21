(() => {
  "use strict";

  const VERSION = "2026-08-19-manejo-calcinha-fase-sem-piscar-223";
  const GUARD = "__CORPONU_MANEJO_CALCINHA_FASE_SEM_PISCAR_223__";
  const DATALIST_ID = "manejoFasesListCalcinha";
  const SELECT_CLASS = "corponu-fase-calcinha-select-223";
  const INPUT_CLASS = "corponu-fase-calcinha-input-legado-223";
  const STYLE_ID = "corponuManejoCalcinhaFase223Style";
  const FIREBASE_VERSION = "10.12.5";

  if (window[GUARD] === VERSION) return;
  window[GUARD] = VERSION;

  const drafts = new Map();
  let observerTabela = null;
  let observerLista = null;
  let aplicando = false;
  let firebasePromise = null;

  function normalizar(valor) {
    return String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function escapeHtml(valor) {
    return String(valor ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function calcinhaAtiva() {
    const pagina = document.querySelector(".page.active")?.id;
    const botao = document.querySelector('#manejo .manejo-setor-btn.active[data-setor="calcinha"]');
    return pagina === "manejo" && Boolean(botao);
  }

  function avisar(mensagem) {
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = mensagem;
      toast.classList.remove("hidden");
      clearTimeout(window.__corponuFaseCalcinha223Toast);
      window.__corponuFaseCalcinha223Toast = setTimeout(() => toast.classList.add("hidden"), 5500);
      return;
    }
    console.warn(`[CorpoNu] ${mensagem}`);
  }

  function orderIdDaLinha(row) {
    if (!(row instanceof Element)) return "";

    const linhaSelect = row.querySelector(".corponu-manejo-line-select[data-order-id]");
    if (linhaSelect?.dataset?.orderId) return String(linhaSelect.dataset.orderId);

    const botao = row.querySelector(".btn-save-manejo");
    const codigo = String(botao?.getAttribute("onclick") || "");
    const match = codigo.match(/salvarManejoLinha\((?:'|\")([^'\"]+)(?:'|\")\)/);
    return match?.[1] || "";
  }

  function localizarLinha(orderId) {
    const id = String(orderId || "");
    if (!id) return null;
    return [...document.querySelectorAll("#listaManejoInline tr[data-manejo-row='1']")]
      .find(row => orderIdDaLinha(row) === id) || null;
  }

  function inputFase(row) {
    return row?.querySelector('input[id$="-fase"]') || null;
  }

  function fasesOficiais() {
    const datalist = document.getElementById(DATALIST_ID);
    if (!datalist) return [];

    const mapa = new Map();
    datalist.querySelectorAll("option").forEach(option => {
      const valor = String(option.value || option.textContent || "").trim();
      const chave = normalizar(valor);
      if (valor && chave && !mapa.has(chave)) mapa.set(chave, valor);
    });
    return [...mapa.values()];
  }

  function faseOficial(valor) {
    const chave = normalizar(valor);
    if (!chave) return "";
    return fasesOficiais().find(item => normalizar(item) === chave) || "";
  }

  function limparRestosAntigos() {
    [
      "corponuManejoCalcinhaFaseSelect218Style",
      "corponuManejoCalcinhaFaseSelect219Style",
      "corponuManejoCalcinhaFaseSelect220Style",
      "corponuManejoCalcinhaFaseSelect221Style",
      "corponuManejoCalcinhaFase222Style"
    ].forEach(id => document.getElementById(id)?.remove());

    document.querySelectorAll(
      "#listaManejoInline .corponu-fase-select-218, #listaManejoInline .corponu-fase-select-219, #listaManejoInline .corponu-fase-select-220, #listaManejoInline .corponu-fase-select-221, #listaManejoInline .corponu-fase-calcinha-select-222"
    ).forEach(el => el.remove());

    document.querySelectorAll(
      "#listaManejoInline .corponu-fase-input-legado-218, #listaManejoInline .corponu-fase-input-legado-219, #listaManejoInline .corponu-fase-input-legado-220, #listaManejoInline .corponu-fase-input-legado-221, #listaManejoInline .corponu-fase-calcinha-input-legado-222"
    ).forEach(input => {
      input.classList.remove(
        "corponu-fase-input-legado-218",
        "corponu-fase-input-legado-219",
        "corponu-fase-input-legado-220",
        "corponu-fase-input-legado-221",
        "corponu-fase-calcinha-input-legado-222"
      );
    });
  }

  function injetarEstilo() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #listaManejoInline .${INPUT_CLASS}{display:none!important;}
      #listaManejoInline .${SELECT_CLASS}{
        width:100%;min-width:150px;box-sizing:border-box;
        border:1px solid #cbd5e1;border-radius:7px;
        padding:8px 30px 8px 9px;background:#fff;color:#0f172a;
        font:inherit;line-height:1.2;
      }
      #listaManejoInline .${SELECT_CLASS}:focus{
        outline:2px solid rgba(124,58,237,.22);border-color:#7c3aed;
      }
      #listaManejoInline .${SELECT_CLASS}:disabled{
        background:#f8fafc;color:#64748b;cursor:not-allowed;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function sincronizarEstadoDual(orderId, fase) {
    const mapa = window.corponuDualMode?.state?.maps?.ordens;
    if (!(mapa instanceof Map)) return;

    const atual = mapa.get(String(orderId || ""));
    if (!atual) return;

    const manejoCalcinha = atual?.manejosSetores?.calcinha || {};
    mapa.set(String(orderId), {
      ...atual,
      manejosSetores: {
        ...(atual.manejosSetores || {}),
        calcinha: {
          ...manejoCalcinha,
          fase: normalizar(fase)
        }
      }
    });
  }

  function montarSelect(row) {
    if (!calcinhaAtiva() || !(row instanceof Element)) return;

    const input = inputFase(row);
    if (!(input instanceof HTMLInputElement)) return;

    const orderId = orderIdDaLinha(row);
    if (!orderId) return;

    input.setAttribute("list", DATALIST_ID);
    input.classList.add(INPUT_CLASS);

    const fases = fasesOficiais();
    const draft = drafts.get(orderId);
    const desejado = draft?.valor ?? String(input.value || "");
    const oficialAtual = faseOficial(desejado);

    let select = row.querySelector(`.${SELECT_CLASS}`);
    if (!(select instanceof HTMLSelectElement)) {
      select = document.createElement("select");
      select.className = SELECT_CLASS;
      select.dataset.orderId = orderId;
      select.setAttribute("aria-label", "Fase da calcinha");
      input.insertAdjacentElement("afterend", select);
    }

    const opcoes = [];
    let selecionado = "";
    let disabled = false;

    if (!document.getElementById(DATALIST_ID)) {
      opcoes.push('<option value="">Carregando fases da Calcinha...</option>');
      disabled = true;
    } else if (!fases.length) {
      if (desejado) {
        opcoes.push(`<option value="${escapeHtml(desejado)}">${escapeHtml(desejado)} (fase atual)</option>`);
        selecionado = desejado;
      } else {
        opcoes.push('<option value="">Nenhuma fase cadastrada para Calcinha</option>');
      }
      disabled = true;
    } else {
      opcoes.push('<option value="">Selecione a fase</option>');
      if (desejado && !oficialAtual) {
        opcoes.push(`<option value="${escapeHtml(desejado)}" disabled>${escapeHtml(desejado)} (fase atual)</option>`);
        selecionado = desejado;
      }
      fases.forEach(fase => opcoes.push(`<option value="${escapeHtml(fase)}">${escapeHtml(fase)}</option>`));
      if (oficialAtual) selecionado = oficialAtual;
    }

    const assinatura = `${disabled ? 1 : 0}|${selecionado}|${fases.map(normalizar).join("|")}`;
    if (select.dataset.assinatura223 !== assinatura) {
      select.innerHTML = opcoes.join("");
      select.dataset.assinatura223 = assinatura;
    }

    select.disabled = disabled;
    select.value = selecionado;

    if (draft) input.value = draft.valor;
  }

  function aplicarSelects() {
    if (aplicando) return;
    aplicando = true;
    try {
      if (!calcinhaAtiva()) {
        document.querySelectorAll(`#listaManejoInline .${SELECT_CLASS}`).forEach(el => el.remove());
        document.querySelectorAll(`#listaManejoInline .${INPUT_CLASS}`).forEach(input => {
          input.classList.remove(INPUT_CLASS);
          if (input.getAttribute("list") === DATALIST_ID) input.setAttribute("list", "manejoFasesList");
        });
        return;
      }

      document.querySelectorAll("#listaManejoInline tr[data-manejo-row='1']").forEach(montarSelect);
    } finally {
      aplicando = false;
    }
  }

  function capturarMudancaFase(event) {
    const alvo = event.target;
    if (!(alvo instanceof Element) || !calcinhaAtiva()) return;

    const select = alvo.closest(`.${SELECT_CLASS}`);
    if (!(select instanceof HTMLSelectElement) || select.disabled) return;

    const row = select.closest("tr[data-manejo-row='1']");
    const input = inputFase(row);
    const orderId = orderIdDaLinha(row);
    if (!(input instanceof HTMLInputElement) || !orderId) return;

    const valor = String(select.value || "");
    drafts.set(orderId, { valor, alteradoEm: Date.now() });
    input.value = valor;
    input.setAttribute("list", DATALIST_ID);
    sincronizarEstadoDual(orderId, valor);

    queueMicrotask(aplicarSelects);
  }

  async function firebase() {
    if (firebasePromise) return firebasePromise;
    firebasePromise = (async () => {
      const [appModule, authModule, firestore] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
      ]);
      const app = appModule.getApps()[0] || appModule.getApp();
      return {
        auth: authModule.getAuth(app),
        db: firestore.getFirestore(app),
        firestore
      };
    })().catch(error => {
      firebasePromise = null;
      throw error;
    });
    return firebasePromise;
  }

  async function persistirFase(orderId, fase) {
    const oficial = faseOficial(fase);
    if (!oficial) throw new Error("A fase escolhida não pertence à lista oficial da Calcinha.");

    const { auth, db, firestore } = await firebase();
    const user = auth.currentUser;
    if (!user) throw new Error("Sua sessão expirou. Entre novamente.");

    await firestore.updateDoc(
      firestore.doc(db, "ordensProducao", String(orderId)),
      {
        "manejosSetores.calcinha.fase": oficial,
        "manejosSetores.calcinha.setor": "calcinha",
        "manejosSetores.calcinha.setorLabel": "Calcinha",
        "manejosSetores.calcinha.status": "organizada",
        "manejosSetores.calcinha.atualizadoPor": user.uid,
        "manejosSetores.calcinha.atualizadoEm": firestore.serverTimestamp(),
        "manejoStatusSetores.calcinha": "organizada",
        atualizadoPor: user.uid,
        atualizadoEm: firestore.serverTimestamp()
      }
    );

    return oficial;
  }

  function finalizarVisualSalvo(orderId, fase) {
    const linha = localizarLinha(orderId);
    if (!linha) return;

    linha.classList.remove("manejo-row-dirty", "manejo-row-pending");
    linha.classList.add("manejo-row-saved");

    const input = inputFase(linha);
    if (input) {
      input.value = fase;
      input.setAttribute("list", DATALIST_ID);
    }

    const select = linha.querySelector(`.${SELECT_CLASS}`);
    if (select instanceof HTMLSelectElement) select.value = fase;

    const botao = linha.querySelector(".btn-save-manejo");
    if (botao) {
      botao.removeAttribute("data-salvando-manejo");
      botao.removeAttribute("data-corponu-salvando");
      botao.disabled = false;
      botao.textContent = "✓";
      botao.title = "Concluir alterações desta linha";
      botao.setAttribute("aria-label", "Concluir alterações desta linha");
    }
  }

  function garantirWrapperSalvar() {
    const atual = window.salvarManejoLinha;
    if (typeof atual !== "function") return false;
    if (atual.__corponuFaseCalcinhaSemPiscar223 === true) return true;

    const interno = atual;

    const wrapper = async function corponuSalvarManejoCalcinhaSemPiscar223(...args) {
      if (!calcinhaAtiva()) return interno.apply(this, args);

      const orderId = String(args[0] || "");
      const row = localizarLinha(orderId);
      const input = inputFase(row);
      const select = row?.querySelector(`.${SELECT_CLASS}`);
      const draft = drafts.get(orderId);
      const faseEscolhida = String(draft?.valor ?? select?.value ?? input?.value ?? "").trim();
      const oficial = faseOficial(faseEscolhida);

      if (!oficial) {
        avisar("Selecione uma fase oficial da Calcinha antes de confirmar.");
        return false;
      }

      if (input) {
        input.value = oficial;
        input.setAttribute("list", DATALIST_ID);
      }
      if (select && !select.disabled) select.value = oficial;
      sincronizarEstadoDual(orderId, oficial);

      let retorno;
      try {
        retorno = await interno.apply(this, args);
      } catch (error) {
        console.error("[Calcinha 223] O salvamento original falhou; tentando preservar a fase mesmo assim.", error);
      }

      try {
        const salva = await persistirFase(orderId, oficial);
        drafts.delete(orderId);
        sincronizarEstadoDual(orderId, salva);

        // A versão anterior forçava corponuDualMode.refresh() aqui. Esse refresh
        // reconstruía a tabela inteira depois do ACK e causava o piscar visível.
        // O listener normal do Firestore já recebe o dado salvo; portanto, mantemos
        // a linha atual estável e apenas encerramos o estado visual de edição.
        finalizarVisualSalvo(orderId, salva);
        queueMicrotask(aplicarSelects);
        requestAnimationFrame(() => {
          aplicarSelects();
          finalizarVisualSalvo(orderId, salva);
        });
        return retorno;
      } catch (error) {
        console.error("[Calcinha 223] Não foi possível persistir a fase.", error);
        avisar(`A fase não foi salva: ${error?.message || "erro no Firestore"}`);
        return false;
      }
    };

    Object.defineProperty(wrapper, "__corponuFaseCalcinhaSemPiscar223", {
      value: true,
      configurable: false,
      enumerable: false
    });

    window.salvarManejoLinha = wrapper;
    return true;
  }

  function observarTabela() {
    const tbody = document.getElementById("listaManejoInline");
    if (!tbody) return false;
    if (observerTabela?.__target === tbody) return true;

    observerTabela?.disconnect?.();
    observerTabela = new MutationObserver(() => queueMicrotask(aplicarSelects));
    observerTabela.observe(tbody, { childList: true, subtree: true });
    observerTabela.__target = tbody;
    return true;
  }

  function observarLista() {
    const datalist = document.getElementById(DATALIST_ID);
    if (!datalist) return false;
    if (observerLista?.__target === datalist) return true;

    observerLista?.disconnect?.();
    observerLista = new MutationObserver(() => queueMicrotask(aplicarSelects));
    observerLista.observe(datalist, { childList: true, subtree: true });
    observerLista.__target = datalist;
    return true;
  }

  function instalarEventos() {
    // window/capture: registra a escolha antes de qualquer listener antigo reconstruir a linha.
    window.addEventListener("input", capturarMudancaFase, true);
    window.addEventListener("change", capturarMudancaFase, true);

    window.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (!alvo) return;

      // Antes do onclick inline resolver salvarManejoLinha, garantimos que a versão 223
      // é a camada mais externa do salvamento.
      if (alvo.closest("#listaManejoInline .btn-save-manejo") && calcinhaAtiva()) {
        garantirWrapperSalvar();
      }

      if (alvo.closest('.manejo-setor-btn[data-setor], .nav-btn[data-page]')) {
        [0, 60, 180, 400].forEach(delay => setTimeout(() => {
          observarTabela();
          observarLista();
          aplicarSelects();
          garantirWrapperSalvar();
        }, delay));
      }
    }, true);
  }

  function iniciar() {
    limparRestosAntigos();
    injetarEstilo();
    observarTabela();
    observarLista();
    instalarEventos();
    aplicarSelects();
    garantirWrapperSalvar();

    [150, 500, 1200, 2500, 5000].forEach(delay => setTimeout(() => {
      observarTabela();
      observarLista();
      aplicarSelects();
      garantirWrapperSalvar();
    }, delay));

    setInterval(() => {
      observarTabela();
      observarLista();
      garantirWrapperSalvar();
      const limite = Date.now() - (15 * 60 * 1000);
      for (const [id, draft] of drafts.entries()) {
        if ((draft?.alteradoEm || 0) < limite) drafts.delete(id);
      }
    }, 3000);

    console.info(`[CorpoNu] Fase Calcinha sem refresh forçado: ${VERSION}`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();