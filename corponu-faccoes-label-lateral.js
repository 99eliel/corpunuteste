(() => {
  "use strict";

  const VERSION = "2026-08-10-faccoes-label-lateral-alca-161";

  if (window.__CORPONU_FACCOES_LABEL_LATERAL__ === VERSION) return;
  window.__CORPONU_FACCOES_LABEL_LATERAL__ = VERSION;

  const IDS_TEXTO = [
    "painelFaccoesCorte",
    "modalSaidaCorte",
    "modalChegadaCorte",
    "modalSelecionarChegadaCorte",
    "s3titulo"
  ];

  const STYLE_ID = "corponuLateralSemCanceladas161";

  let aplicando = false;
  let agendado = false;

  function substituirTexto(no) {
    const atual = String(no?.nodeValue || "");
    const novo = atual
      .replace(/\bCORTE\b/g, "LATERAL")
      .replace(/\bCorte\b/g, "Lateral");
    if (novo !== atual) no.nodeValue = novo;
  }

  function corrigirTextosVisiveis(raiz) {
    if (!raiz) return;

    const walker = document.createTreeWalker(
      raiz,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(no) {
          const pai = no.parentElement;
          if (!pai || ["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "OPTION"].includes(pai.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          return /\bCORTE\b|\bCorte\b/.test(no.nodeValue || "")
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const encontrados = [];
    while (walker.nextNode()) encontrados.push(walker.currentNode);
    encontrados.forEach(substituirTexto);
  }

  function corrigirBotaoAba() {
    const botao = document.getElementById("abaFaccaoCorte");
    if (!botao) return;

    const contador = botao.querySelector("#contCorte");
    if (contador) {
      let textoPrincipal = [...botao.childNodes].find(no => no.nodeType === Node.TEXT_NODE);
      if (!textoPrincipal) {
        textoPrincipal = document.createTextNode("Lateral e Alça ");
        botao.insertBefore(textoPrincipal, contador);
      } else if (String(textoPrincipal.nodeValue || "").trim() !== "Lateral e Alça") {
        textoPrincipal.nodeValue = "Lateral e Alça ";
      }
      return;
    }

    corrigirTextosVisiveis(botao);
  }

  function garantirEstiloCanceladas() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #painelFaccoesCorte #listaFaccoesCorte tr:has(.corte-pill.cancelado){
        display:none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function removerLinhasCanceladas() {
    const tbody = document.getElementById("listaFaccoesCorte");
    if (!tbody) return;

    [...tbody.querySelectorAll(":scope > tr")].forEach(linha => {
      const badgeCancelado = linha.querySelector(".corte-pill.cancelado");
      if (!badgeCancelado) return;
      linha.remove();
    });
  }

  function aplicarNomeLateral() {
    if (aplicando) return;
    aplicando = true;
    try {
      garantirEstiloCanceladas();
      corrigirBotaoAba();
      IDS_TEXTO.forEach(id => corrigirTextosVisiveis(document.getElementById(id)));
      document
        .querySelectorAll('#faccoes [data-area-faccoes="corte"]')
        .forEach(corrigirTextosVisiveis);
      removerLinhasCanceladas();
    } finally {
      aplicando = false;
    }
  }

  function agendarAplicacao() {
    if (agendado) return;
    agendado = true;
    window.requestAnimationFrame(() => {
      agendado = false;
      aplicarNomeLateral();
    });
  }

  function iniciar() {
    aplicarNomeLateral();

    const observer = new MutationObserver(agendarAplicacao);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    document.addEventListener("click", agendarAplicacao, true);
    window.addEventListener("pageshow", agendarAplicacao);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
