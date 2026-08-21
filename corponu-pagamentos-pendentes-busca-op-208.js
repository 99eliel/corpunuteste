(() => {
  "use strict";

  const VERSION = "2026-08-17-pagamentos-pendentes-busca-op-208";
  const MODAL_ID = "modalPendenciasValoresFinanceiro";
  const LISTA_ID = "listaPendenciasValores";
  const BUSCA_ID = "buscaOpPendencias208";
  const STYLE_ID = "styleBuscaOpPendencias208";
  const VAZIO_ID = "buscaOpPendencias208Vazio";

  if (window.__CORPONU_PAGAMENTOS_PENDENTES_BUSCA_OP_208__ === VERSION) return;
  window.__CORPONU_PAGAMENTOS_PENDENTES_BUSCA_OP_208__ = VERSION;

  let observerLista = null;
  let observerPagina = null;
  let aplicando = false;

  const texto = valor => String(valor ?? "").trim();
  const normalizar = valor => texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, "")
    .toUpperCase();

  function injetarEstilos() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${MODAL_ID} .pag208-busca-op-wrap{
        display:grid;
        grid-template-columns:minmax(240px,520px) auto;
        align-items:end;
        gap:10px;
        margin:0 0 12px;
        padding:12px;
        border:1px solid #cbd5e1;
        border-radius:12px;
        background:#f8fafc;
      }
      #${MODAL_ID} .pag208-busca-op-campo{min-width:0}
      #${MODAL_ID} .pag208-busca-op-campo label{
        display:block;
        margin:0 0 6px;
        color:#334155;
        font-size:12px;
        font-weight:900;
      }
      #${BUSCA_ID}{
        width:100%;
        min-height:42px;
        box-sizing:border-box;
        padding:9px 12px;
        border:1px solid #94a3b8;
        border-radius:10px;
        background:#fff;
        color:#0f172a;
        font:800 13px/1.3 inherit;
        outline:none;
      }
      #${BUSCA_ID}:focus{
        border-color:#7c3aed;
        box-shadow:0 0 0 3px rgba(124,58,237,.12);
      }
      #${MODAL_ID} .pag208-busca-op-status{
        min-width:110px;
        padding:9px 11px;
        border-radius:9px;
        background:#ede9fe;
        color:#5b21b6;
        font-size:11px;
        font-weight:900;
        text-align:center;
        white-space:nowrap;
      }
      #${VAZIO_ID}{
        margin:10px 0 0;
        padding:12px;
        border:1px dashed #cbd5e1;
        border-radius:10px;
        background:#fff;
        color:#64748b;
        font-size:12px;
        font-weight:800;
        text-align:center;
      }
      #${MODAL_ID} #buscaPendenciasValores{
        min-width:220px;
      }
      @media(max-width:680px){
        #${MODAL_ID} .pag208-busca-op-wrap{grid-template-columns:1fr}
        #${MODAL_ID} .pag208-busca-op-status{text-align:left}
      }
    `;
    document.head.appendChild(style);
  }

  function numeroOpDoCard(card) {
    const identificacao = card.querySelector(".corponu-pendencia-identificacao b")?.textContent || "";
    const match = texto(identificacao).match(/\bOP\s*[:#-]?\s*([^\s]+)/i);
    return normalizar(match?.[1] || "");
  }

  function aplicarFiltro() {
    if (aplicando) return;
    aplicando = true;
    try {
      const lista = document.getElementById(LISTA_ID);
      const input = document.getElementById(BUSCA_ID);
      if (!lista || !(input instanceof HTMLInputElement)) return;

      const busca = normalizar(input.value);
      const cards = [...lista.querySelectorAll(".corponu-pendencia-item")];
      let visiveis = 0;

      cards.forEach(card => {
        const op = numeroOpDoCard(card);
        const mostrar = !busca || op.includes(busca);
        card.hidden = !mostrar;
        card.style.setProperty("display", mostrar ? "" : "none", mostrar ? "" : "important");
        if (mostrar) visiveis += 1;
      });

      const status = document.querySelector(`#${MODAL_ID} .pag208-busca-op-status`);
      if (status) {
        status.textContent = busca
          ? `${visiveis} resultado${visiveis === 1 ? "" : "s"}`
          : `${cards.length} pendente${cards.length === 1 ? "" : "s"}`;
      }

      let vazio = document.getElementById(VAZIO_ID);
      if (busca && cards.length > 0 && visiveis === 0) {
        if (!vazio) {
          vazio = document.createElement("div");
          vazio.id = VAZIO_ID;
          lista.parentElement?.insertBefore(vazio, lista);
        }
        vazio.textContent = `Nenhum pagamento pendente encontrado para a OP ${texto(input.value)}.`;
        vazio.hidden = false;
      } else if (vazio) {
        vazio.hidden = true;
      }
    } finally {
      aplicando = false;
    }
  }

  function observarLista() {
    const lista = document.getElementById(LISTA_ID);
    if (!lista || lista.dataset.pag208Observada === "1") return;
    lista.dataset.pag208Observada = "1";

    observerLista?.disconnect();
    observerLista = new MutationObserver(() => queueMicrotask(aplicarFiltro));
    observerLista.observe(lista, { childList: true, subtree: false });
  }

  function garantirBusca() {
    const modal = document.getElementById(MODAL_ID);
    const lista = document.getElementById(LISTA_ID);
    if (!(modal instanceof HTMLElement) || !lista) return false;

    injetarEstilos();

    const buscaAntiga = document.getElementById("buscaPendenciasValores");
    if (buscaAntiga instanceof HTMLInputElement) {
      buscaAntiga.placeholder = "Buscar referência, facção, processo ou cor...";
      buscaAntiga.setAttribute("aria-label", "Buscar por referência, facção, processo ou cor");
    }

    let input = document.getElementById(BUSCA_ID);
    if (!(input instanceof HTMLInputElement)) {
      const toolbar = modal.querySelector(".corponu-pendencias-toolbar");
      const body = modal.querySelector(".corponu-pagamento-modal-body") || lista.parentElement;
      if (!body) return false;

      const wrap = document.createElement("div");
      wrap.className = "pag208-busca-op-wrap";
      wrap.innerHTML = `
        <div class="pag208-busca-op-campo">
          <label for="${BUSCA_ID}">Buscar OP</label>
          <input id="${BUSCA_ID}" type="search" inputmode="numeric" autocomplete="off" placeholder="Digite o número da OP..." />
        </div>
        <div class="pag208-busca-op-status" aria-live="polite">Carregando...</div>
      `;

      if (toolbar?.parentElement === body) body.insertBefore(wrap, toolbar);
      else body.insertBefore(wrap, body.firstChild);

      input = document.getElementById(BUSCA_ID);
      input?.addEventListener("input", aplicarFiltro);
      input?.addEventListener("search", aplicarFiltro);
    }

    observarLista();
    aplicarFiltro();
    return true;
  }

  function instalar() {
    garantirBusca();

    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target.closest("button, a") : null;
      if (!alvo) return;
      const rotulo = texto(alvo.textContent).toUpperCase();
      if (rotulo.includes("RESTANTES PENDENTES") || rotulo.includes("PENDENCIAS")) {
        setTimeout(garantirBusca, 0);
        setTimeout(garantirBusca, 100);
        setTimeout(garantirBusca, 300);
      }
    }, true);

    observerPagina = new MutationObserver(() => {
      if (document.getElementById(MODAL_ID)) garantirBusca();
    });
    observerPagina.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    window.addEventListener("pageshow", garantirBusca);
    console.info(`[CorpoNu] Busca por OP em Restantes pendentes ativa: ${VERSION}`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", instalar, { once: true });
  } else {
    instalar();
  }
})();
