(() => {
  "use strict";
  const VERSION = "2026-08-11-teste-cabecalho-manejo-texto-179";
  if (window.__CORPONU_MANEJO_CABECALHO_TEXTO__ === VERSION) return;
  window.__CORPONU_MANEJO_CABECALHO_TEXTO__ = VERSION;

  function setorAtual() {
    const ativo = document.querySelector("#manejo .manejo-setor-btn.active")?.dataset?.setor;
    if (ativo) return ativo;
    return document.querySelector("#manejo .manejo-inline-table")?.classList.contains("manejo-sutia-ativo") ? "sutia" : "calcinha";
  }

  function corrigirTextos() {
    const linha = document.querySelector("#manejo .manejo-head-row");
    if (!linha) return;
    const celulas = Array.from(linha.children).filter(el => el.tagName === "TH");
    if (!celulas.length) return;
    const sutia = setorAtual() === "sutia";
    const nomes = sutia
      ? ["Nº OP", "REF", "SILK", "TECIDO", "FASE BOJO", "FASE LATERAL", "QTI", "COR", "NECESSIDADE", "STATUS", "AÇÕES"]
      : ["Nº OP", "REF", "SILK", "TECIDO", "FASE", "FASE LATERAL", "QTI", "COR", "NECESSIDADE", "STATUS", "AÇÕES"];
    nomes.forEach((nome, indice) => {
      if (celulas[indice] && celulas[indice].textContent.trim() !== nome) {
        celulas[indice].textContent = nome;
      }
    });
  }

  function iniciar() {
    corrigirTextos();
    document.addEventListener("click", event => {
      if (event.target.closest("#manejo .manejo-setor-btn")) setTimeout(corrigirTextos, 0);
    }, true);
    const manejo = document.getElementById("manejo");
    if (!manejo) return;
    const observer = new MutationObserver(() => corrigirTextos());
    observer.observe(manejo, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();
