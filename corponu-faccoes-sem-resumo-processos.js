(() => {
  "use strict";

  const VERSION = "2026-08-10-faccoes-canceladas-origem-159";
  const STYLE_ID = "corponuFaccoesCanceladas159Style";
  const CLASSE_MOSTRAR = "corponu-mostrar-canceladas-159";

  if (window.__CORPONU_FACCOES_SEM_RESUMO_PROCESSOS__ === VERSION) return;
  window.__CORPONU_FACCOES_SEM_RESUMO_PROCESSOS__ = VERSION;

  const normalizar = valor => String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

  function painelFaccoes() {
    return document.querySelector("#faccoes > .faccoes-operacional-panel");
  }

  function encontrarCabecalhoMovimentacoes(painel) {
    const pelaBusca = document.getElementById("buscaFaccaoMovimentacoes")?.closest(".panel-subheader");
    if (pelaBusca && painel.contains(pelaBusca)) return pelaBusca;

    const titulo = [...painel.querySelectorAll("h2, h3, h4, strong")]
      .find(elemento => normalizar(elemento.textContent) === "O QUE ESTA NAS FACCOES");

    return titulo?.closest(".panel-subheader") || titulo?.parentElement || null;
  }

  function encontrarCardsResumo(painel) {
    const peloIndicador = document.getElementById("faccoesPecasDefeito")
      ?.closest(".faccoes-cards");

    if (peloIndicador && painel.contains(peloIndicador)) return peloIndicador;
    return painel.querySelector(":scope > .faccoes-cards");
  }

  function removerEntreCardsETabela() {
    const painel = painelFaccoes();
    if (!painel) return false;

    const cards = encontrarCardsResumo(painel);
    const cabecalho = encontrarCabecalhoMovimentacoes(painel);

    if (!cards || !cabecalho || cards.parentElement !== cabecalho.parentElement) return false;

    let atual = cards.nextElementSibling;
    let removeu = false;

    while (atual && atual !== cabecalho) {
      const proximo = atual.nextElementSibling;
      atual.remove();
      atual = proximo;
      removeu = true;
    }

    return removeu;
  }

  function removerPorConteudoComoReserva() {
    const painel = painelFaccoes();
    if (!painel) return;

    const candidatos = [...painel.querySelectorAll("div, section, article")]
      .filter(elemento => {
        const texto = normalizar(elemento.textContent);
        return texto.includes("QUEM REALIZA ESTE PROCESSO") &&
          texto.includes("GERENCIAR FACCOES") &&
          !texto.includes("O QUE ESTA NAS FACCOES");
      })
      .sort((a, b) => a.querySelectorAll("*").length - b.querySelectorAll("*").length);

    candidatos[0]?.remove();
  }

  function removerBloco() {
    if (!removerEntreCardsETabela()) removerPorConteudoComoReserva();
  }

  function injetarRegraCanceladas() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #painelFaccoesCorte:not(.${CLASSE_MOSTRAR}) #listaFaccoesCorte > tr:has(.corte-pill.cancelado) {
        display: none !important;
      }
      #listaFaccoesCorte > tr:has(.corte-pill.cancelado) [data-cancelar-corte] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function filtroMostraCanceladas() {
    return String(document.getElementById("corteFiltroStatus")?.value || "") === "cancelado";
  }

  function sincronizarModoCanceladas() {
    const painel = document.getElementById("painelFaccoesCorte");
    if (!painel) return;
    painel.classList.toggle(CLASSE_MOSTRAR, filtroMostraCanceladas());
  }

  function ocultarMovimentacoesCanceladasFallback() {
    const tbody = document.getElementById("listaFaccoesCorte");
    if (!tbody) return;

    const mostrarCanceladas = filtroMostraCanceladas();
    tbody.querySelectorAll(":scope > tr").forEach(linha => {
      const cancelada = Boolean(linha.querySelector(".corte-pill.cancelado"));
      if (!cancelada) return;
      if (mostrarCanceladas) linha.style.removeProperty("display");
      else linha.style.setProperty("display", "none", "important");
    });
  }

  function aplicarAjustes() {
    removerBloco();
    injetarRegraCanceladas();
    sincronizarModoCanceladas();
    ocultarMovimentacoesCanceladasFallback();
  }

  function iniciar() {
    aplicarAjustes();
    setTimeout(aplicarAjustes, 100);
    setTimeout(aplicarAjustes, 500);
    setTimeout(aplicarAjustes, 1500);

    const observer = new MutationObserver(() => {
      sincronizarModoCanceladas();
      ocultarMovimentacoesCanceladasFallback();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("change", event => {
      if (event.target?.id !== "corteFiltroStatus") return;
      setTimeout(() => {
        sincronizarModoCanceladas();
        ocultarMovimentacoesCanceladasFallback();
      }, 0);
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();