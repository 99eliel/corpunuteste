(() => {
  "use strict";

  const VERSION = "2026-08-11-cabecalho-manejo-estrutura-178";
  const GUARD = "__CORPONU_MANEJO_CABECALHO_ESTRUTURA__";
  if (window[GUARD] === VERSION) return;
  window[GUARD] = VERSION;

  const NOMES_SUTIA = [
    "Nº OP",
    "REF",
    "SILK",
    "TECIDO",
    "FASE BOJO",
    "FASE LATERAL",
    "QTI",
    "COR",
    "NECESSIDADE",
    "STATUS",
    "AÇÕES"
  ];

  function setorAtualEhSutia() {
    const ativo = document.querySelector("#manejo .manejo-setor-btn.active")?.dataset?.setor;
    if (ativo) return ativo === "sutia";
    return document.querySelector("#manejo .manejo-inline-table")?.classList.contains("manejo-sutia-ativo") === true;
  }

  function cabecalhoSutiaEstaCorreto(linha) {
    const celulas = Array.from(linha?.children || []).filter(el => el.tagName === "TH");
    if (celulas.length !== NOMES_SUTIA.length) return false;
    return NOMES_SUTIA.every((nome, indice) => celulas[indice]?.textContent?.trim() === nome);
  }

  function reconstruirCabecalhoSutia() {
    if (!setorAtualEhSutia()) return;
    const linha = document.querySelector("#manejo .manejo-head-row");
    if (!linha || cabecalhoSutiaEstaCorreto(linha)) return;

    const fragmento = document.createDocumentFragment();
    NOMES_SUTIA.forEach((nome, indice) => {
      const th = document.createElement("th");
      th.textContent = nome;
      if (indice === 5) th.className = "manejo-head-fase-lateral";
      fragmento.appendChild(th);
    });
    linha.replaceChildren(fragmento);
  }

  function agendarCorrecao() {
    [0, 30, 120, 350].forEach(atraso => setTimeout(reconstruirCabecalhoSutia, atraso));
  }

  function iniciar() {
    agendarCorrecao();

    document.addEventListener("click", event => {
      if (event.target?.closest?.("#manejo .manejo-setor-btn") ||
          event.target?.closest?.('.nav-btn[data-page="manejo"]')) {
        agendarCorrecao();
      }
    }, true);

    const manejo = document.getElementById("manejo");
    if (!manejo) return;

    const observer = new MutationObserver(() => {
      if (setorAtualEhSutia()) reconstruirCabecalhoSutia();
    });
    observer.observe(manejo, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
