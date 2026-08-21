(() => {
  "use strict";

  const VERSION = "2026-08-12-calcinha-filtros-corretos-193";
  const GUARD = "__CORPONU_MANEJO_CALCINHA_FILTROS_193__";
  const HIDDEN_CLASS = "calcinha193-coluna-oculta";
  const STYLE_ID = "styleManejoCalcinhaFiltros193";

  if (window[GUARD] === VERSION) return;
  window[GUARD] = VERSION;

  let applying = false;
  let scheduled = false;
  let tableObserver = null;
  let sectorObserver = null;
  let lateralHeaderDetached = null;
  let lateralFilterDetached = null;
  const lateralCellsDetached = new Map();

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
    "filtroManejoDataTecido"
  ]);

  function calcinhaActive() {
    const button = document.querySelector("#manejo .manejo-setor-btn.active");
    if (button?.dataset?.setor) return button.dataset.setor === "calcinha";
    return document.body?.dataset?.corponuManejoTipo === "calcinha";
  }

  function getParts() {
    const table = document.querySelector("#manejo .manejo-inline-table");
    const head = table?.querySelector("thead .manejo-head-row");
    const filters = table?.querySelector("thead .manejo-filter-row");
    const body = document.getElementById("listaManejoInline");
    if (!table || !head || !filters || !body) return null;
    return { table, head, filters, body };
  }

  function injectStyle() {
    document.getElementById("styleManejoCabecalhoCalcinha191")?.remove();
    document.getElementById("styleManejoCalcinhaColunasFiltros192")?.remove();
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

  function indexOfCell(row, cell) {
    if (!row || !cell) return -1;
    return Array.prototype.indexOf.call(row.children, cell);
  }

  function filterCell(parts, id) {
    const field = document.getElementById(id);
    const th = field?.closest("th");
    return th?.parentElement === parts.filters ? th : null;
  }

  function rowCellsAt(index) {
    if (index < 0) return [];
    return [...document.querySelectorAll("#listaManejoInline tr[data-manejo-row='1']")]
      .map(row => row.children[index])
      .filter(Boolean);
  }

  function show(cell) {
    if (!cell) return;
    cell.classList.remove(HIDDEN_CLASS, "calcinha192-coluna-oculta", "calcinha191-coluna-nao-usada");
    if (cell.style.display === "none") cell.style.removeProperty("display");
  }

  function hide(cell) {
    if (!cell) return;
    cell.classList.add(HIDDEN_CLASS);
  }

  function setHeader(cell, text) {
    if (!cell || !text) return;
    if (String(cell.textContent || "").trim() !== text) cell.textContent = text;
  }

  function detachLateralFromCurrentRows(index = 6) {
    document.querySelectorAll("#listaManejoInline tr[data-manejo-row='1']").forEach(row => {
      // Com LINHA injetada, a estrutura completa possui 12 células.
      // Ao retirar FASE LATERAL, ficam 11 e os índices do filtro antigo voltam a coincidir.
      if (row.children.length < 12) return;
      const cell = row.children[index];
      if (!cell) return;
      lateralCellsDetached.set(row, cell);
      cell.remove();
    });
  }

  function detachLateralColumn(parts) {
    const lateralField = document.getElementById("filtroManejoFaseLateral");
    const lateralFilter = lateralField?.closest("th");

    if (lateralFilter && lateralFilter.parentElement === parts.filters) {
      const index = indexOfCell(parts.filters, lateralFilter);
      if (index >= 0) {
        const header = parts.head.children[index];
        if (header) {
          lateralHeaderDetached = header;
          header.remove();
        }
        lateralFilterDetached = lateralFilter;
        lateralFilter.remove();
        detachLateralFromCurrentRows(index);
        return;
      }
    }

    // Se o cabeçalho já foi destacado e o tbody foi renderizado novamente,
    // removemos somente a nova célula Fase Lateral das linhas recém-criadas.
    detachLateralFromCurrentRows(6);
  }

  function restoreLateralColumnBeforeSutia() {
    const parts = getParts();
    if (!parts) return;

    const insertAt = 6;

    if (lateralHeaderDetached && !lateralHeaderDetached.isConnected) {
      parts.head.insertBefore(lateralHeaderDetached, parts.head.children[insertAt] || null);
    }
    if (lateralFilterDetached && !lateralFilterDetached.isConnected) {
      parts.filters.insertBefore(lateralFilterDetached, parts.filters.children[insertAt] || null);
    }

    for (const [row, cell] of lateralCellsDetached.entries()) {
      if (!row?.isConnected || cell?.isConnected) continue;
      row.insertBefore(cell, row.children[insertAt] || null);
    }

    lateralCellsDetached.clear();
    lateralHeaderDetached = null;
    lateralFilterDetached = null;
  }

  function showColumn(parts, filterId, label) {
    const filter = filterCell(parts, filterId);
    if (!filter) return;
    const index = indexOfCell(parts.filters, filter);
    if (index < 0) return;

    show(filter);
    show(parts.head.children[index]);
    setHeader(parts.head.children[index], label);
    rowCellsAt(index).forEach(show);
  }

  function hideColumn(parts, filterId) {
    const filter = filterCell(parts, filterId);
    if (!filter) return;
    const index = indexOfCell(parts.filters, filter);
    if (index < 0) return;

    hide(filter);
    hide(parts.head.children[index]);
    rowCellsAt(index).forEach(hide);
  }

  function restoreAction(parts) {
    const cells = [...parts.filters.children];
    const action = cells.find(cell => {
      const text = String(cell.querySelector("button")?.textContent || cell.textContent || "")
        .trim().toUpperCase();
      return text === "LIMPAR";
    }) || cells[cells.length - 1];

    const index = indexOfCell(parts.filters, action);
    if (index < 0) return;
    show(action);
    show(parts.head.children[index]);
    setHeader(parts.head.children[index], "AÇÕES");
    rowCellsAt(index).forEach(show);
  }

  function applyCalcinha() {
    if (applying || !calcinhaActive()) return;
    const parts = getParts();
    if (!parts) return;

    applying = true;
    try {
      injectStyle();

      // Fase Lateral não existe no Manejo Calcinha. Nas versões anteriores ela só era
      // escondida, mas continuava ocupando um índice interno. O filtro acumulativo antigo
      // usa índices fixos, então Necessidade acabava lendo COR. Ao destacar esta coluna
      // enquanto Calcinha está ativa, os índices voltam a coincidir com o motor de filtros.
      detachLateralColumn(parts);

      const updated = getParts();
      if (!updated) return;

      VISIBLE_COLUMNS.forEach(([filterId, label]) => showColumn(updated, filterId, label));
      HIDDEN_FILTERS.forEach(filterId => hideColumn(updated, filterId));

      const lineHead = updated.head.querySelector('th[data-corponu-line-head="1"]');
      const lineFilter = updated.filters.querySelector('th[data-corponu-line-filter="1"]');
      show(lineHead);
      show(lineFilter);
      setHeader(lineHead, "LINHA");
      document.querySelectorAll("#listaManejoInline [data-corponu-line-cell='1']").forEach(show);

      restoreAction(updated);
    } finally {
      applying = false;
    }
  }

  function scheduleApply() {
    if (scheduled || !calcinhaActive()) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyCalcinha();
    });
  }

  function observeTable() {
    const table = document.querySelector("#manejo .manejo-inline-table");
    if (!table || tableObserver) return;

    tableObserver = new MutationObserver(() => {
      if (calcinhaActive()) scheduleApply();
    });
    tableObserver.observe(table, { childList: true, subtree: true, characterData: true });
  }

  function observeSector() {
    if (sectorObserver) return;
    const manejo = document.getElementById("manejo");
    if (!manejo) return;

    sectorObserver = new MutationObserver(() => {
      observeTable();
      if (calcinhaActive()) scheduleApply();
    });
    sectorObserver.observe(manejo, { attributes: true, subtree: true, attributeFilter: ["class"] });
  }

  function installEvents() {
    document.addEventListener("click", event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      // Captura antes dos handlers do sistema: devolve a Fase Lateral antes de abrir Sutiã.
      if (target.closest('.manejo-setor-btn[data-setor="sutia"]')) {
        restoreLateralColumnBeforeSutia();
        return;
      }

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
      setTimeout(scheduleApply, 100);
      setTimeout(scheduleApply, 300);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
