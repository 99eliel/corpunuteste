(() => {
  "use strict";

  const VERSION = "2026-08-19-restantes-pendentes-filtro-op-225";
  const PAINEL_ID = "painelRestantesPagamento";
  const LISTA_ID = "listaRestantesPagamento";
  const INPUT_ID = "filtroOpRestantesPagamento225";
  const LIMPAR_ID = "btnLimparFiltroOpRestantes225";
  const STATUS_ID = "statusFiltroOpRestantes225";
  const VAZIO_ID = "vazioFiltroOpRestantes225";
  const STYLE_ID = "styleFiltroOpRestantes225";

  if (window.__CORPONU_RESTANTES_PENDENTES_FILTRO_OP_225__ === VERSION) return;
  window.__CORPONU_RESTANTES_PENDENTES_FILTRO_OP_225__ = VERSION;

  let listaObservada = null;
  let observerLista = null;
  let aplicando = false;

  function texto(valor) {
    return String(valor ?? "").trim();
  }

  function normalizarOP(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]+/gi, "")
      .toUpperCase();
  }

  function injetarEstilo() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${PAINEL_ID} .restantes-filtro-op-225{
        display:grid;
        grid-template-columns:minmax(220px,420px) auto minmax(120px,auto);
        gap:9px;
        align-items:end;
        padding:11px 16px;
        border-top:1px solid #fed7aa;
        border-bottom:1px solid #fed7aa;
        background:#fff7ed;
      }
      #${PAINEL_ID} .restantes-filtro-op-225 label{
        display:grid;
        gap:5px;
        min-width:0;
        color:#7c2d12;
        font-size:11px;
        font-weight:900;
      }
      #${INPUT_ID}{
        width:100%;
        min-height:39px;
        box-sizing:border-box;
        padding:8px 11px;
        border:1px solid #fdba74;
        border-radius:9px;
        background:#fff;
        color:#0f172a;
        font-size:12px;
        font-weight:700;
        line-height:1.3;
        outline:none;
      }
      #${INPUT_ID}:focus{
        border-color:#ea580c;
        box-shadow:0 0 0 3px rgba(234,88,12,.12);
      }
      #${LIMPAR_ID}{
        min-height:39px;
        padding:8px 13px;
        border:1px solid #fdba74;
        border-radius:9px;
        background:#fff;
        color:#9a3412;
        font-size:11px;
        font-weight:900;
        cursor:pointer;
      }
      #${LIMPAR_ID}:disabled{
        opacity:.5;
        cursor:default;
      }
      #${STATUS_ID}{
        min-height:39px;
        display:flex;
        align-items:center;
        justify-content:center;
        box-sizing:border-box;
        padding:8px 11px;
        border-radius:9px;
        background:#ffedd5;
        color:#9a3412;
        font-size:11px;
        font-weight:900;
        white-space:nowrap;
      }
      #${VAZIO_ID}{
        padding:11px 16px;
        border-bottom:1px solid #fed7aa;
        background:#fff;
        color:#9a3412;
        font-size:12px;
        font-weight:800;
        text-align:center;
      }
      #${VAZIO_ID}.hidden{display:none!important}
      @media(max-width:720px){
        #${PAINEL_ID} .restantes-filtro-op-225{
          grid-template-columns:1fr auto;
        }
        #${STATUS_ID}{
          grid-column:1/-1;
          justify-content:flex-start;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function opDaLinha(linha) {
    if (!(linha instanceof HTMLTableRowElement)) return "";
    const forte = linha.querySelector("td:first-child strong");
    if (forte) return normalizarOP(forte.textContent);
    return normalizarOP(linha.cells?.[0]?.textContent || "");
  }

  function linhasDeDados(tbody) {
    return [...tbody.querySelectorAll(":scope > tr")].filter(linha => {
      if (!(linha instanceof HTMLTableRowElement)) return false;
      if (linha.querySelector("td.empty")) return false;
      return linha.cells.length >= 2;
    });
  }

  function atualizarVazio(busca, total, visiveis) {
    const vazio = document.getElementById(VAZIO_ID);
    if (!vazio) return;

    if (busca && total > 0 && visiveis === 0) {
      const input = document.getElementById(INPUT_ID);
      vazio.textContent = `Nenhum restante pendente encontrado para a OP ${texto(input?.value)}.`;
      vazio.classList.remove("hidden");
    } else {
      vazio.classList.add("hidden");
    }
  }

  function aplicarFiltro() {
    if (aplicando) return;
    aplicando = true;

    try {
      const tbody = document.getElementById(LISTA_ID);
      const input = document.getElementById(INPUT_ID);
      const status = document.getElementById(STATUS_ID);
      const limpar = document.getElementById(LIMPAR_ID);
      if (!(tbody instanceof HTMLTableSectionElement) || !(input instanceof HTMLInputElement)) return;

      const busca = normalizarOP(input.value);
      const linhas = linhasDeDados(tbody);
      let visiveis = 0;

      linhas.forEach(linha => {
        const op = opDaLinha(linha);
        const mostrar = !busca || op.includes(busca);
        linha.hidden = !mostrar;
        linha.style.display = mostrar ? "" : "none";
        if (mostrar) visiveis += 1;
      });

      const linhaVaziaOriginal = tbody.querySelector(":scope > tr > td.empty")?.closest("tr");
      if (linhaVaziaOriginal instanceof HTMLTableRowElement) {
        linhaVaziaOriginal.hidden = linhas.length > 0;
        linhaVaziaOriginal.style.display = linhaVaziaOriginal.hidden ? "none" : "";
      }

      if (status) {
        status.textContent = busca
          ? `${visiveis} de ${linhas.length} pendência${linhas.length === 1 ? "" : "s"}`
          : `${linhas.length} pendência${linhas.length === 1 ? "" : "s"}`;
      }

      if (limpar instanceof HTMLButtonElement) limpar.disabled = !busca;
      atualizarVazio(busca, linhas.length, visiveis);
    } finally {
      aplicando = false;
    }
  }

  function observarLista(tbody) {
    if (!(tbody instanceof HTMLTableSectionElement)) return;
    if (listaObservada === tbody) return;

    observerLista?.disconnect();
    listaObservada = tbody;
    observerLista = new MutationObserver(() => {
      // O observer olha SOMENTE entrada/remoção de linhas. O filtro altera apenas
      // hidden/style das linhas, portanto não cria ciclo de MutationObserver.
      queueMicrotask(aplicarFiltro);
    });
    observerLista.observe(tbody, { childList: true, subtree: false });
  }

  function criarInterface(painel, tbody) {
    let input = document.getElementById(INPUT_ID);
    if (input instanceof HTMLInputElement) {
      observarLista(tbody);
      aplicarFiltro();
      return true;
    }

    injetarEstilo();

    const resumo = document.getElementById("resumoRestantesPagamento");
    const tableWrap = painel.querySelector(".table-wrap");
    if (!tableWrap) return false;

    const filtro = document.createElement("div");
    filtro.className = "restantes-filtro-op-225";
    filtro.innerHTML = `
      <label for="${INPUT_ID}">
        Filtrar por OP
        <input id="${INPUT_ID}" type="search" inputmode="numeric" autocomplete="off" placeholder="Digite o número da OP..." />
      </label>
      <button id="${LIMPAR_ID}" type="button" disabled>Limpar</button>
      <div id="${STATUS_ID}" aria-live="polite">0 pendências</div>
    `;

    const vazio = document.createElement("div");
    vazio.id = VAZIO_ID;
    vazio.className = "hidden";

    if (resumo?.parentElement === painel) resumo.insertAdjacentElement("afterend", filtro);
    else painel.insertBefore(filtro, tableWrap);
    filtro.insertAdjacentElement("afterend", vazio);

    input = document.getElementById(INPUT_ID);
    input?.addEventListener("input", aplicarFiltro);
    input?.addEventListener("search", aplicarFiltro);

    document.getElementById(LIMPAR_ID)?.addEventListener("click", () => {
      const campo = document.getElementById(INPUT_ID);
      if (!(campo instanceof HTMLInputElement)) return;
      campo.value = "";
      aplicarFiltro();
      campo.focus();
    });

    observarLista(tbody);
    aplicarFiltro();
    return true;
  }

  function instalarNoPainel() {
    const painel = document.getElementById(PAINEL_ID);
    const tbody = document.getElementById(LISTA_ID);
    if (!(painel instanceof HTMLElement) || !(tbody instanceof HTMLTableSectionElement)) return false;
    return criarInterface(painel, tbody);
  }

  function agendarInstalacao(atrasos = [0, 80, 250, 700]) {
    atrasos.forEach(atraso => window.setTimeout(instalarNoPainel, atraso));
  }

  function instalarEventos() {
    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (!alvo) return;

      if (alvo.closest("#btnRestantesPagamento")) {
        // criarPainelRestantes() acontece no fluxo original do botão.
        // Entramos depois apenas para anexar a busca à tabela já existente.
        agendarInstalacao([0, 60, 180, 500]);
        return;
      }

      if (alvo.closest("#btnAtualizarRestantesPagamento")) {
        // A atualização é assíncrona; o observer do tbody reaplica o filtro quando
        // renderRestantes() trocar as linhas. Estes tempos são apenas fallback.
        agendarInstalacao([0, 250, 700, 1500]);
      }
    }, true);
  }

  function iniciar() {
    instalarEventos();
    agendarInstalacao([0, 500, 1500, 3000]);
    console.info(`[CorpoNu] Filtro seguro de OP em Restantes pendentes ativo: ${VERSION}`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
