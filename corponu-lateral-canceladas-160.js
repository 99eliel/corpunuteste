(() => {
  "use strict";

  const VERSION = "2026-08-10-lateral-canceladas-dom-160";
  if (window.__CORPONU_LATERAL_CANCELADAS_160__ === VERSION) return;
  window.__CORPONU_LATERAL_CANCELADAS_160__ = VERSION;

  let observer = null;
  let raf = 0;

  const normalizar = valor => String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

  function filtroCanceladasAtivo() {
    return normalizar(document.getElementById("corteFiltroStatus")?.value) === "CANCELADO";
  }

  function linhaCancelada(linha) {
    if (!(linha instanceof HTMLTableRowElement)) return false;
    if (linha.querySelector(".corte-pill.cancelado")) return true;

    const celulas = [...linha.cells];
    return celulas.some(td => normalizar(td.textContent) === "CANCELADA");
  }

  function limparTabela() {
    const tbody = document.getElementById("listaFaccoesCorte");
    if (!tbody) return;

    const mostrarHistoricoCancelado = filtroCanceladasAtivo();

    [...tbody.rows].forEach(linha => {
      if (!linhaCancelada(linha)) return;

      // Uma movimentação já cancelada nunca pode oferecer novo cancelamento.
      linha.querySelectorAll("[data-cancelar-corte]").forEach(botao => botao.remove());

      // Na listagem normal a movimentação cancelada deixa de existir visualmente.
      // O documento permanece no Firebase e volta a ser renderizado se o usuário
      // escolher explicitamente Status = Cancelada.
      if (!mostrarHistoricoCancelado) linha.remove();
    });
  }

  function agendarLimpeza() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(limparTabela);
  }

  function instalarObserver() {
    const pagina = document.getElementById("faccoes");
    if (!pagina) return false;

    observer?.disconnect();
    observer = new MutationObserver(agendarLimpeza);
    observer.observe(pagina, { childList: true, subtree: true });
    return true;
  }

  function iniciar() {
    instalarObserver();
    agendarLimpeza();

    document.addEventListener("change", event => {
      if (event.target?.id !== "corteFiltroStatus") return;
      // A rotina original redesenha a tabela ao trocar o filtro; limpamos somente
      // depois desse redesenho, sem interferir na lógica do filtro.
      requestAnimationFrame(() => requestAnimationFrame(limparTabela));
    }, true);

    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (!alvo) return;
      if (
        alvo.closest("#abaFaccaoCorte") ||
        alvo.closest('[data-area-faccoes="corte"]') ||
        alvo.closest("#btnCorteAtualizar")
      ) {
        requestAnimationFrame(() => requestAnimationFrame(limparTabela));
      }
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
