(() => {
  "use strict";

  const VERSION = "2026-08-17-manejo-calcinha-fluido-205";
  const DATA_MODO = "corponuManejoEstavel";

  if (window.__CORPONU_MANEJO_CALCINHA_ESTAVEL__ === VERSION) return;
  window.__CORPONU_MANEJO_CALCINHA_ESTAVEL__ = VERSION;

  let observadorPagina = null;
  let observadorPaginaPausado = false;
  let wrapperInstalado = null;
  let timerInstalacao = 0;
  const salvamentosEmAndamento = new Set();

  function manejoCalcinhaAtivo() {
    const pagina = document.querySelector(".page.active")?.id || "";
    const botao = document.querySelector('.manejo-setor-btn.active[data-setor="calcinha"]');
    return pagina === "manejo" && Boolean(botao);
  }

  function marcarModoAtual() {
    if (!document.body) return;
    if (manejoCalcinhaAtivo()) {
      document.body.dataset[DATA_MODO] = "calcinha";
    } else {
      delete document.body.dataset[DATA_MODO];
    }
  }

  function injetarEstilos() {
    document.getElementById("corponuManejoCalcinhaEstavel204Styles")?.remove();
    document.getElementById("corponuManejoCalcinhaFluido205Styles")?.remove();

    const style = document.createElement("style");
    style.id = "corponuManejoCalcinhaFluido205Styles";
    style.textContent = `
      body[data-corponu-manejo-estavel="calcinha"] #listaManejoInline tr[data-manejo-row="1"] > td:has(.silk-fields),
      body[data-corponu-manejo-estavel="calcinha"] #listaManejoInline tr[data-manejo-row="1"] > td:has(.tecido-fields),
      body[data-corponu-manejo-tipo="calcinha"] #listaManejoInline tr[data-manejo-row="1"] > td:has(.silk-fields),
      body[data-corponu-manejo-tipo="calcinha"] #listaManejoInline tr[data-manejo-row="1"] > td:has(.tecido-fields) {
        display: none !important;
        visibility: hidden !important;
      }

      body[data-corponu-manejo-estavel="calcinha"] #listaManejoInline .btn-save-manejo[data-corponu-salvando="1"] {
        opacity: .72;
        pointer-events: none;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function removerProtecaoAntiga() {
    document.getElementById("corponuManejoCalcinhaFreeze204")?.remove();
    document.querySelectorAll('[data-corponu-calcinha-oculto204="1"]').forEach(cell => {
      if (!(cell instanceof HTMLElement)) return;
      cell.style.removeProperty("display");
      delete cell.dataset.corponuCalcinhaOculto204;
    });

    const tabela = document.querySelector("#manejo .manejo-inline-table");
    const wrapper = tabela?.closest(".table-wrap") || tabela?.parentElement;
    if (wrapper instanceof HTMLElement && wrapper.style.visibility === "hidden") {
      wrapper.style.visibility = "";
    }
  }

  function obterObservadorPagina() {
    const lista = window.corponuDualMode?.state?.observers;
    if (!Array.isArray(lista) || !lista.length) return null;

    const candidato = lista[lista.length - 1];
    if (!candidato || typeof candidato.disconnect !== "function" || typeof candidato.observe !== "function") return null;

    observadorPagina = candidato;
    return observadorPagina;
  }

  function pausarObservadorPaginaSeCalcinha() {
    if (!manejoCalcinhaAtivo()) return;

    const observer = observadorPagina || obterObservadorPagina();
    if (!observer || observadorPaginaPausado) return;

    try {
      observer.takeRecords?.();
      observer.disconnect();
      observadorPaginaPausado = true;
    } catch (_) {}
  }

  function restaurarObservadorPaginaSeNecessario() {
    if (!observadorPaginaPausado || manejoCalcinhaAtivo()) return;

    const observer = observadorPagina || obterObservadorPagina();
    const shell = document.getElementById("appShell") || document.body;
    if (!observer || !shell) return;

    try {
      observer.observe(shell, {
        attributes: true,
        subtree: true,
        attributeFilter: ["class"]
      });
      observadorPaginaPausado = false;
    } catch (_) {}
  }

  function ehCampoFaseCalcinha(alvo) {
    if (!(alvo instanceof HTMLInputElement)) return false;
    if (!manejoCalcinhaAtivo()) return false;
    if (!alvo.closest("#listaManejoInline")) return false;
    return /-fase$/i.test(String(alvo.id || ""));
  }

  function prepararEdicaoFase(evento) {
    if (!ehCampoFaseCalcinha(evento.target)) return;
    marcarModoAtual();
    pausarObservadorPaginaSeCalcinha();
  }

  function acharBotaoSalvar(ordemId) {
    const id = String(ordemId || "");
    return [...document.querySelectorAll("#listaManejoInline .btn-save-manejo")].find(botao => {
      const onclick = String(botao.getAttribute("onclick") || "");
      return onclick.includes(`salvarManejoLinha('${id}')`) || onclick.includes(`salvarManejoLinha(\"${id}\")`);
    }) || null;
  }

  function envolverSalvarAtual() {
    const atual = window.salvarManejoLinha;
    if (typeof atual !== "function") return false;

    if (atual.__corponuCalcinhaFluido205 === true) {
      wrapperInstalado = atual;
      return true;
    }

    if (wrapperInstalado === atual) return true;

    const embrulhado = async function corponuSalvarManejoCalcinhaFluido205(...args) {
      if (!manejoCalcinhaAtivo()) {
        return atual.apply(this, args);
      }

      const ordemId = String(args[0] || "");
      if (ordemId && salvamentosEmAndamento.has(ordemId)) return;

      if (ordemId) salvamentosEmAndamento.add(ordemId);
      marcarModoAtual();
      pausarObservadorPaginaSeCalcinha();

      const botao = acharBotaoSalvar(ordemId);
      if (botao) {
        botao.dataset.corponuSalvando = "1";
        botao.disabled = true;
      }

      try {
        return await atual.apply(this, args);
      } finally {
        if (ordemId) salvamentosEmAndamento.delete(ordemId);

        requestAnimationFrame(() => {
          marcarModoAtual();
          const botaoAtual = acharBotaoSalvar(ordemId);
          if (botaoAtual) {
            delete botaoAtual.dataset.corponuSalvando;
            botaoAtual.disabled = false;
          }
        });
      }
    };

    Object.defineProperty(embrulhado, "__corponuCalcinhaFluido205", {
      value: true,
      configurable: false,
      enumerable: false
    });

    window.salvarManejoLinha = embrulhado;
    wrapperInstalado = embrulhado;
    return true;
  }

  function sincronizarModo() {
    removerProtecaoAntiga();
    marcarModoAtual();

    if (manejoCalcinhaAtivo()) {
      pausarObservadorPaginaSeCalcinha();
    } else {
      restaurarObservadorPaginaSeNecessario();
    }

    envolverSalvarAtual();
  }

  function instalar() {
    removerProtecaoAntiga();
    injetarEstilos();
    sincronizarModo();

    ["focusin", "input", "change"].forEach(tipo => {
      document.addEventListener(tipo, prepararEdicaoFase, true);
    });

    document.addEventListener("click", evento => {
      if (evento.target?.closest?.(".manejo-setor-btn[data-setor], .nav-btn[data-page]")) {
        setTimeout(sincronizarModo, 0);
        setTimeout(sincronizarModo, 80);
        setTimeout(sincronizarModo, 250);
      }
    }, true);

    let tentativas = 0;
    timerInstalacao = window.setInterval(() => {
      tentativas += 1;
      sincronizarModo();

      if (tentativas >= 24 && typeof window.salvarManejoLinha === "function" && window.corponuDualMode?.state?.observers?.length) {
        clearInterval(timerInstalacao);
        timerInstalacao = 0;
      }
    }, 250);

    window.addEventListener("pageshow", sincronizarModo);
    window.addEventListener("focus", sincronizarModo);

    console.info(`[CorpoNu] Manejo Calcinha fluido ativo: ${VERSION}`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", instalar, { once: true });
  } else {
    instalar();
  }
})();
