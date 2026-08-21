(() => {
  "use strict";

  const VERSION = "2026-08-14-op-salvamento-rapido-199";
  const ARQUIVO = "corponu-op-salvamento-rapido-199.js";

  if (window.__CORPONU_CALCINHA_SALVAMENTO_RAPIDO_147__ === VERSION) return;
  window.__CORPONU_CALCINHA_SALVAMENTO_RAPIDO_147__ = VERSION;

  let listenerAntigoInterceptado = false;
  const addOriginal = window.addEventListener;

  window.addEventListener = function corponuAddEventListener199(tipo, listener, opcoes) {
    const ehSalvarCalcinhaAntigo = !listenerAntigoInterceptado
      && tipo === "submit"
      && typeof listener === "function"
      && listener.name === "salvarOrdemCalcinha";

    if (!ehSalvarCalcinhaAntigo) {
      return addOriginal.call(this, tipo, listener, opcoes);
    }

    listenerAntigoInterceptado = true;
    window.addEventListener = addOriginal;

    return addOriginal.call(this, tipo, function corponuSalvarCalcinhaCompat199(event) {
      if (typeof window.__corponuSalvarOrdemRapida199 === "function") {
        return window.__corponuSalvarOrdemRapida199(event);
      }
      return listener(event);
    }, opcoes);
  };

  function carregar199() {
    if (window.__CORPONU_OP_SALVAMENTO_RAPIDO_199__ === VERSION) return;
    if ([...document.scripts].some(script => String(script.src || "").includes(ARQUIVO))) return;

    const script = document.createElement("script");
    script.src = `./${ARQUIVO}?v=${encodeURIComponent(VERSION)}&t=${Date.now()}`;
    script.async = false;
    script.dataset.corponuModulo = "op-salvamento-rapido-199";
    script.onerror = () => console.error("Não foi possível carregar o salvamento rápido de OP.");
    document.head.appendChild(script);
  }

  carregar199();

  window.setTimeout(() => {
    if (window.addEventListener !== addOriginal && !listenerAntigoInterceptado) {
      window.addEventListener = addOriginal;
    }
  }, 12000);
})();
