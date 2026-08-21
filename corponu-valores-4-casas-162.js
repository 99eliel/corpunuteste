(() => {
  "use strict";

  const VERSION = "2026-08-10-valores-4-casas-162";
  if (window.__CORPONU_VALORES_4_CASAS_162__ === VERSION) return;
  window.__CORPONU_VALORES_4_CASAS_162__ = VERSION;

  let observer = null;
  let raf = 0;
  let aplicando = false;

  const normalizar = valor => String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  function numeroBR(valor) {
    const texto = String(valor || "").replace(/R\$/gi, "").trim();
    if (!texto) return NaN;
    const limpo = texto.includes(",")
      ? texto.replace(/\./g, "").replace(",", ".")
      : texto;
    const numero = Number(limpo.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(numero) ? numero : NaN;
  }

  function formatar4(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    });
  }

  function formatarMoedasNoTexto(texto) {
    return String(texto || "").replace(
      /R\$\s*(-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?)/g,
      (trecho, numeroTexto) => {
        const valor = numeroBR(numeroTexto);
        if (!Number.isFinite(valor)) return trecho;
        return `R$ ${formatar4(valor)}`;
      }
    );
  }

  function deveIgnorarNo(no) {
    const pai = no?.parentElement;
    if (!pai) return true;
    return ["SCRIPT", "STYLE", "TEXTAREA", "OPTION"].includes(pai.tagName);
  }

  function formatarTextos(raiz) {
    if (!raiz) return;
    const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    const alterar = [];

    while (walker.nextNode()) {
      const no = walker.currentNode;
      if (deveIgnorarNo(no) || !String(no.nodeValue || "").includes("R$")) continue;
      const novo = formatarMoedasNoTexto(no.nodeValue);
      if (novo !== no.nodeValue) alterar.push([no, novo]);
    }

    alterar.forEach(([no, novo]) => { no.nodeValue = novo; });
  }

  function campoMonetario(input) {
    if (!(input instanceof HTMLInputElement) || input.type !== "number") return false;
    const label = input.closest("label")?.textContent || "";
    const chave = normalizar([
      input.id,
      input.name,
      input.placeholder,
      label
    ].join(" "));
    return /VALOR|PRECO|PREÇO|DESCONTO|DEFEITO/.test(chave);
  }

  function prepararCampos(raiz) {
    if (!raiz?.querySelectorAll) return;
    raiz.querySelectorAll('input[type="number"]').forEach(input => {
      if (!campoMonetario(input)) return;
      input.step = "0.0001";
      input.dataset.corponuValor4 = "1";
    });
  }

  function aplicar() {
    if (aplicando) return;
    aplicando = true;
    try {
      const pagina = document.querySelector(".page.active");
      if (pagina) {
        formatarTextos(pagina);
        prepararCampos(pagina);
      }

      document.querySelectorAll(
        ".modal-backdrop:not(.hidden), .corte-modal:not(.hidden), #modalPendenciasValoresFinanceiro:not(.hidden)"
      ).forEach(modal => {
        formatarTextos(modal);
        prepararCampos(modal);
      });
    } finally {
      aplicando = false;
    }
  }

  function agendar() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      aplicar();
    });
  }

  function instalarEventos() {
    document.addEventListener("blur", event => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.dataset.corponuValor4 !== "1") return;
      const valor = Number(input.value);
      if (!Number.isFinite(valor)) return;
      input.value = valor.toFixed(4);
    }, true);

    document.addEventListener("click", agendar, true);
    document.addEventListener("change", agendar, true);
  }

  function iniciar() {
    aplicar();
    instalarEventos();

    // Observa somente criação/remoção de conteúdo. Não observa atributos e não
    // interfere em listeners, filtros ou cálculos do sistema.
    observer = new MutationObserver(agendar);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  window.CorpoNuValores4Casas = {
    versao: VERSION,
    formatar: valor => `R$ ${formatar4(valor)}`,
    aplicar
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
