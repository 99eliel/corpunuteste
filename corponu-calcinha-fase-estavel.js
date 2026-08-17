(() => {
  "use strict";

  const VERSION = "2026-08-17-calcinha-fase-estavel-171";
  const RETOMAR_OBSERVADOR_MS = 1200;

  if (window.__CORPONU_CALCINHA_FASE_ESTAVEL__ === VERSION) return;
  window.__CORPONU_CALCINHA_FASE_ESTAVEL__ = VERSION;

  let dual = null;
  let observadorPagina = null;
  let timerRetomarObservador = 0;
  let observadorTabela = null;

  function manejoCalcinhaAtivo() {
    return document.body.dataset.corponuManejoTipo === "calcinha"
      || Boolean(document.querySelector('.manejo-setor-btn.active[data-setor="calcinha"]'));
  }

  function normalizar(valor) {
    return String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function valorLinha(valor) {
    const texto = normalizar(valor).replace(/\s+/g, "_");
    if (texto === "COTTON_LINE" || texto === "COTTON__LINE") return "cotton_line";
    if (texto === "CORPO_NU") return "corpo_nu";
    return "";
  }

  function idOrdemDaLinha(row) {
    const botao = row?.querySelector?.(".btn-save-manejo");
    const codigo = String(botao?.getAttribute?.("onclick") || "");
    const match = codigo.match(/salvarManejoLinha\(['\"]([^'\"]+)['\"]\)/i);
    return match?.[1] || row?.dataset?.documentId || row?.dataset?.id || "";
  }

  function criarCelulaLinha(row) {
    if (!row || row.querySelector('[data-corponu-line-cell="1"]')) return;
    const depoisDe = row.children?.[1];
    if (!depoisDe) return;

    const orderId = idOrdemDaLinha(row);
    if (!orderId) return;

    const ordem = dual?.state?.maps?.ordens?.get?.(String(orderId)) || {};
    const valor = valorLinha(
      ordem?.linhaCalcinha
      || ordem?.manejosSetores?.calcinha?.linhaCalcinha
      || ""
    );

    const cell = document.createElement("td");
    cell.dataset.corponuLineCell = "1";

    const select = document.createElement("select");
    select.className = `corponu-manejo-line-select${valor ? "" : " pending"}`;
    select.dataset.orderId = String(orderId);

    const opVazia = document.createElement("option");
    opVazia.value = "";
    opVazia.textContent = "A definir";

    const opCotton = document.createElement("option");
    opCotton.value = "cotton_line";
    opCotton.textContent = "Cotton Line";

    const opCorpo = document.createElement("option");
    opCorpo.value = "corpo_nu";
    opCorpo.textContent = "Corpo Nu";

    select.append(opVazia, opCotton, opCorpo);
    select.value = valor;
    cell.appendChild(select);
    depoisDe.after(cell);
  }

  function ocultarCamposSutiaNaLinha(row) {
    if (!row) return;
    [...row.children].forEach(cell => {
      if (!(cell instanceof HTMLElement)) return;
      if (cell.querySelector(".silk-fields")) {
        cell.style.setProperty("display", "none", "important");
        cell.dataset.corponuCalcinhaOculto171 = "1";
      }
    });
  }

  function restaurarCamposSutiaNasLinhas() {
    document.querySelectorAll('[data-corponu-calcinha-oculto171="1"]').forEach(cell => {
      if (!(cell instanceof HTMLElement)) return;
      cell.style.removeProperty("display");
      delete cell.dataset.corponuCalcinhaOculto171;
    });
  }

  function estabilizarCabecalho() {
    const tabela = document.querySelector("#manejo .manejo-inline-table");
    if (!tabela) return;

    const head = tabela.querySelector("thead .manejo-head-row");
    const filtros = tabela.querySelector("thead .manejo-filter-row");
    if (!head) return;

    [...head.children].forEach((cell, indice) => {
      const ehSutia = ["SILK", "TECIDO"].includes(normalizar(cell.textContent));
      if (ehSutia && manejoCalcinhaAtivo()) {
        cell.style.setProperty("display", "none", "important");
        cell.dataset.corponuCalcinhaOculto171 = "1";
        if (filtros?.children?.[indice]) {
          filtros.children[indice].style.setProperty("display", "none", "important");
          filtros.children[indice].dataset.corponuCalcinhaOculto171 = "1";
        }
      }
    });
  }

  function estabilizarTabelaAgora() {
    const tbody = document.getElementById("listaManejoInline");
    if (!tbody) return;

    if (!manejoCalcinhaAtivo()) {
      restaurarCamposSutiaNasLinhas();
      return;
    }

    estabilizarCabecalho();
    tbody.querySelectorAll("tr[data-manejo-row='1']").forEach(row => {
      criarCelulaLinha(row);
      ocultarCamposSutiaNaLinha(row);
    });
  }

  function ehCampoFaseCalcinha(alvo) {
    if (!(alvo instanceof HTMLInputElement)) return false;
    if (!manejoCalcinhaAtivo()) return false;
    if (!alvo.closest("#listaManejoInline")) return false;
    return /-fase$/i.test(alvo.id || "");
  }

  function pausarObservadorGenerico() {
    if (!observadorPagina || !manejoCalcinhaAtivo()) return;

    window.clearTimeout(timerRetomarObservador);
    try {
      observadorPagina.takeRecords?.();
      observadorPagina.disconnect();
    } catch (_) {}

    timerRetomarObservador = window.setTimeout(() => {
      const shell = document.getElementById("appShell") || document.body;
      try {
        observadorPagina.observe(shell, {
          attributes: true,
          subtree: true,
          attributeFilter: ["class"]
        });
      } catch (_) {}
    }, RETOMAR_OBSERVADOR_MS);
  }

  function protegerTrocaDeFase(evento) {
    const alvo = evento.target;
    if (!ehCampoFaseCalcinha(alvo)) return;

    // O valor escolhido fica no próprio input. Durante esta interação apenas
    // impedimos que o observador genérico interprete mudanças internas da linha
    // como troca de página e force uma reaplicação completa da tabela.
    pausarObservadorGenerico();
    estabilizarTabelaAgora();
  }

  function instalarCSS() {
    if (document.getElementById("corponuCalcinhaFaseEstavel171Styles")) return;
    const style = document.createElement("style");
    style.id = "corponuCalcinhaFaseEstavel171Styles";
    style.textContent = `
      body[data-corponu-manejo-tipo="calcinha"] #listaManejoInline tr[data-manejo-row="1"] > td:has(.silk-fields){display:none!important}
      body[data-corponu-manejo-tipo="calcinha"] #manejo .manejo-inline-table{visibility:visible!important;opacity:1!important}
      body[data-corponu-manejo-tipo="calcinha"] #listaManejoInline tr[data-manejo-row="1"]{visibility:visible!important;opacity:1!important}
    `;
    document.head.appendChild(style);
  }

  function instalarObservadorTabela() {
    if (observadorTabela) return;
    const tbody = document.getElementById("listaManejoInline");
    if (!tbody) return;

    // MutationObserver executa antes do próximo paint. Assim, se outro módulo
    // reconstruir o tbody, Linha é reinserida e Silk/Tecido são ocultados antes
    // de qualquer frame chegar à tela do usuário.
    observadorTabela = new MutationObserver(() => {
      estabilizarTabelaAgora();
    });
    observadorTabela.observe(tbody, { childList: true, subtree: true });
  }

  function capturarObservadorGenerico() {
    const lista = dual?.state?.observers;
    if (!Array.isArray(lista) || !lista.length) return false;
    // No corponu-dual-mode, o último observer instalado é o observador genérico
    // de classes do appShell. Não o removemos; apenas pausamos durante a troca
    // da fase e o reativamos logo depois.
    observadorPagina = lista[lista.length - 1] || null;
    return Boolean(observadorPagina);
  }

  function instalarEventos() {
    ["pointerdown", "focusin", "input", "change"].forEach(tipo => {
      document.addEventListener(tipo, protegerTrocaDeFase, true);
    });

    document.addEventListener("click", evento => {
      const btn = evento.target?.closest?.(".manejo-setor-btn[data-setor]");
      if (!btn) return;
      document.body.dataset.corponuManejoTipo = btn.dataset.setor === "calcinha" ? "calcinha" : "sutia";
      if (btn.dataset.setor === "calcinha") {
        queueMicrotask(estabilizarTabelaAgora);
      } else {
        queueMicrotask(restaurarCamposSutiaNasLinhas);
      }
    }, true);
  }

  function iniciarQuandoPronto(tentativa = 0) {
    dual = window.corponuDualMode || null;
    const tbody = document.getElementById("listaManejoInline");

    if (!dual?.state || !tbody) {
      if (tentativa < 80) window.setTimeout(() => iniciarQuandoPronto(tentativa + 1), 100);
      return;
    }

    instalarCSS();
    capturarObservadorGenerico();
    instalarObservadorTabela();
    instalarEventos();
    estabilizarTabelaAgora();
    console.info(`[CorpoNu] Manejo Calcinha com troca de fase estável: ${VERSION}`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => iniciarQuandoPronto(), { once: true });
  } else {
    iniciarQuandoPronto();
  }
})();
