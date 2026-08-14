(() => {
  "use strict";

  const VERSION = "2026-08-14-faccoes-lateral-processos-fixos-164";

  if (window.__CORPONU_FACCOES_LABEL_LATERAL__ === VERSION) return;
  window.__CORPONU_FACCOES_LABEL_LATERAL__ = VERSION;

  const IDS_TEXTO = [
    "painelFaccoesCorte",
    "modalSaidaCorte",
    "modalChegadaCorte",
    "modalSelecionarChegadaCorte",
    "s3titulo"
  ];

  const STYLE_ID = "corponuLateralSemCanceladas164";

  let aplicando = false;
  let agendado = false;
  let protegendoProcesso = false;

  const normalizar = valor => String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

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

  function modalSaidaLateralAberto() {
    const modal = document.getElementById("modalSaida3");
    if (!modal || modal.classList.contains("hidden")) return false;

    const titulo = normalizar(document.getElementById("s3titulo")?.textContent);
    const abaLateral = document.getElementById("abaFaccaoCorte")?.classList.contains("active") === true;

    return abaLateral || titulo.includes("LATERAL") || titulo.includes("CORTE");
  }

  function assinaturaProcessos(select) {
    if (!(select instanceof HTMLSelectElement)) return "";
    return [...select.options]
      .map(option => normalizar(option.value || option.textContent))
      .filter(Boolean)
      .join("|");
  }

  function garantirProcessosLateralAlca() {
    if (protegendoProcesso || !modalSaidaLateralAberto()) return;

    let campo = document.getElementById("s3processo");
    if (!campo) return;

    protegendoProcesso = true;
    try {
      const valorAnterior = normalizar(campo.value);

      if (!(campo instanceof HTMLSelectElement)) {
        const select = document.createElement("select");
        [...campo.attributes].forEach(atributo => {
          if (["type", "placeholder", "list"].includes(atributo.name)) return;
          select.setAttribute(atributo.name, atributo.value);
        });
        select.id = "s3processo";
        select.required = true;
        campo.replaceWith(select);
        campo = select;
      }

      const assinaturaEsperada = "LATERAL|ALCA";
      if (assinaturaProcessos(campo) !== assinaturaEsperada || campo.disabled) {
        campo.innerHTML = `
          <option value="">Selecione o processo</option>
          <option value="LATERAL">LATERAL</option>
          <option value="ALÇA">ALÇA</option>
        `;
        campo.disabled = false;
      }

      if (valorAnterior === "LATERAL") campo.value = "LATERAL";
      else if (["ALCA", "ALCAS"].includes(valorAnterior)) campo.value = "ALÇA";
    } finally {
      protegendoProcesso = false;
    }
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
      garantirProcessosLateralAlca();
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
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "disabled"]
    });

    document.addEventListener("pointerdown", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (alvo?.matches?.("#s3processo")) garantirProcessosLateralAlca();
    }, true);

    document.addEventListener("focusin", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (alvo?.matches?.("#s3processo")) garantirProcessosLateralAlca();
    }, true);

    document.addEventListener("click", event => {
      agendarAplicacao();
      const alvo = event.target instanceof Element ? event.target : null;
      if (alvo?.closest?.("#btnSaidaCorteNovo, #s3buscar")) {
        [0, 80, 220, 600].forEach(atraso => window.setTimeout(garantirProcessosLateralAlca, atraso));
      }
    }, true);

    window.addEventListener("pageshow", agendarAplicacao);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
