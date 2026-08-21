(() => {
  "use strict";

  const VERSION = "2026-08-12-calcinha-colunas-filtros-192";
  const GUARD = "__CORPONU_MANEJO_CALCINHA_COLUNAS_FILTROS_192__";
  const STYLE_ID = "styleManejoCalcinhaColunasFiltros192";
  const OLD_STYLE_ID = "styleManejoCabecalhoCalcinha191";
  const HIDDEN_CLASS = "calcinha192-coluna-oculta";

  if (window[GUARD] === VERSION) return;
  window[GUARD] = VERSION;

  let applying = false;
  let scheduled = false;
  let tableObserver = null;
  let sectorObserver = null;

  const VISIBLE_COLUMNS = Object.freeze([
    ["filtroManejoOP", "Nº OP"],
    ["filtroManejoReferencia", "REF"],
    ["filtroManejoLinhaCalcinha", "LINHA"],
    ["filtroManejoFase", "FASE"],
    ["filtroManejoQuantidade", "QTI"],
    ["filtroManejoCor", "COR"],
    ["filtroManejoNecessidade", "NECESSIDADE"],
    ["filtroManejoStatus", "STATUS"]
  ]);

  const HIDDEN_FILTERS = Object.freeze([
    "filtroManejoSilk",
    "filtroManejoDataTecido",
    "filtroManejoFaseLateral"
  ]);

  function calcinhaActive() {
    const button = document.querySelector("#manejo .manejo-setor-btn.active");
    if (button?.dataset?.setor) return button.dataset.setor === "calcinha";
    return document.body?.dataset?.corponuManejoTipo === "calcinha";
  }

  function getTableParts() {
    const table = document.querySelector("#manejo .manejo-inline-table");
    const head = table?.querySelector("thead .manejo-head-row");
    const filters = table?.querySelector("thead .manejo-filter-row");
    const body = document.getElementById("listaManejoInline");
    if (!table || !head || !filters || !body) return null;
    return { table, head, filters, body };
  }

  function injectStyle() {
    document.getElementById(OLD_STYLE_ID)?.remove();
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body[data-corponu-manejo-tipo="calcinha"] #manejo .${HIDDEN_CLASS}{
        display:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function cellIndex(row, cell) {
    if (!row || !cell) return -1;
    return Array.prototype.indexOf.call(row.children, cell);
  }

  function filterCellById(filters, id) {
    const field = document.getElementById(id);
    const th = field?.closest("th");
    if (!th || th.parentElement !== filters) return null;
    return th;
  }

  function rowCellsAt(index) {
    if (index < 0) return [];
    return [...document.querySelectorAll("#listaManejoInline tr[data-manejo-row='1']")]
      .map(row => row.children[index])
      .filter(Boolean);
  }

  function showCell(cell) {
    if (!cell) return;
    cell.classList.remove(HIDDEN_CLASS);
    if (cell.style.display === "none") cell.style.removeProperty("display");
  }

  function hideCell(cell) {
    if (!cell) return;
    cell.classList.add(HIDDEN_CLASS);
  }

  function setHeaderText(cell, label) {
    if (!cell || !label) return;
    if (String(cell.textContent || "").trim() !== label) cell.textContent = label;
  }

  function applyVisibleColumn(parts, filterId, label) {
    const filterCell = filterCellById(parts.filters, filterId);
    if (!filterCell) return -1;

    const index = cellIndex(parts.filters, filterCell);
    if (index < 0) return -1;

    showCell(filterCell);
    const headerCell = parts.head.children[index];
    showCell(headerCell);
    setHeaderText(headerCell, label);

    rowCellsAt(index).forEach(showCell);
    return index;
  }

  function applyHiddenColumn(parts, filterId) {
    const filterCell = filterCellById(parts.filters, filterId);
    if (!filterCell) return -1;

    const index = cellIndex(parts.filters, filterCell);
    if (index < 0) return -1;

    hideCell(filterCell);
    hideCell(parts.head.children[index]);
    rowCellsAt(index).forEach(hideCell);
    return index;
  }

  function findActionIndex(parts) {
    const candidates = [...parts.filters.children];
    const actionCell = candidates.find(cell => {
      const button = cell.querySelector("button");
      const text = String(button?.textContent || cell.textContent || "").trim().toUpperCase();
      return text === "LIMPAR" || cell === candidates[candidates.length - 1];
    });
    return cellIndex(parts.filters, actionCell);
  }

  function restoreActionColumn(parts) {
    const index = findActionIndex(parts);
    if (index < 0) return;

    showCell(parts.filters.children[index]);
    const header = parts.head.children[index];
    showCell(header);
    setHeaderText(header, "AÇÕES");
    rowCellsAt(index).forEach(showCell);
  }

  function clearWrongInlineHides(parts) {
    // A Calcinha já sofreu ocultações por índice em versões antigas.
    // Restauramos apenas as colunas que sabemos que devem ser visíveis nela.
    VISIBLE_COLUMNS.forEach(([filterId]) => {
      const filterCell = filterCellById(parts.filters, filterId);
      if (!filterCell) return;
      const index = cellIndex(parts.filters, filterCell);
      if (index < 0) return;

      if (filterCell.style.display === "none") filterCell.style.removeProperty("display");
      const header = parts.head.children[index];
      if (header?.style.display === "none") header.style.removeProperty("display");
      rowCellsAt(index).forEach(cell => {
        if (cell.style.display === "none") cell.style.removeProperty("display");
      });
    });
  }

  function applyCalcinhaLayout() {
    if (applying || !calcinhaActive()) return;
    const parts = getTableParts();
    if (!parts) return;

    applying = true;
    try {
      injectStyle();
      clearWrongInlineHides(parts);

      // Primeiro garantimos todas as colunas realmente usadas pela Calcinha.
      VISIBLE_COLUMNS.forEach(([filterId, label]) => {
        applyVisibleColumn(parts, filterId, label);
      });

      // Depois ocultamos somente as colunas que a Calcinha não utiliza.
      HIDDEN_FILTERS.forEach(filterId => applyHiddenColumn(parts, filterId));

      // A coluna LINHA é injetada pelo módulo da Calcinha e precisa permanecer visível.
      const lineHead = parts.head.querySelector('th[data-corponu-line-head="1"]');
      const lineFilter = parts.filters.querySelector('th[data-corponu-line-filter="1"]');
      showCell(lineHead);
      showCell(lineFilter);
      setHeaderText(lineHead, "LINHA");
      document.querySelectorAll("#listaManejoInline [data-corponu-line-cell='1']").forEach(showCell);

      restoreActionColumn(parts);
    } finally {
      applying = false;
    }
  }

  function scheduleApply() {
    if (scheduled || !calcinhaActive()) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyCalcinhaLayout();
    });
  }

  function observeTable() {
    const table = document.querySelector("#manejo .manejo-inline-table");
    if (!table || tableObserver) return;

    tableObserver = new MutationObserver(() => {
      if (calcinhaActive()) scheduleApply();
    });
    tableObserver.observe(table, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function observeSector() {
    if (sectorObserver) return;
    const manejo = document.getElementById("manejo");
    if (!manejo) return;

    sectorObserver = new MutationObserver(() => {
      observeTable();
      if (calcinhaActive()) scheduleApply();
    });
    sectorObserver.observe(manejo, {
      attributes: true,
      subtree: true,
      attributeFilter: ["class"]
    });
  }

  function installEvents() {
    document.addEventListener("click", event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      if (target.closest('.manejo-setor-btn[data-setor="calcinha"]')) {
        [0, 30, 90, 180, 350].forEach(delay => setTimeout(scheduleApply, delay));
      }

      if (target.closest('.nav-btn[data-page="manejo"]') && calcinhaActive()) {
        [30, 100, 240].forEach(delay => setTimeout(scheduleApply, delay));
      }
    }, true);
  }

  function start() {
    injectStyle();
    observeTable();
    observeSector();
    installEvents();

    if (calcinhaActive()) {
      scheduleApply();
      [80, 220, 450].forEach(delay => setTimeout(scheduleApply, delay));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
