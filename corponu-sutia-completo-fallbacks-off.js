(() => {
  "use strict";

  const VERSION = "2026-08-21-sutia-fallbacks-compatibilidade-255";

  if (window.__CORPONU_SUTIA_FALLBACKS_OFF_107__ === VERSION) return;
  window.__CORPONU_SUTIA_FALLBACKS_OFF_107__ = VERSION;

  // Compatibilidade temporária. O fluxo atômico de SUTIÃ COMPLETO já interrompe
  // os handlers posteriores no próprio submit. Não é mais necessário substituir
  // window.setTimeout nem HTMLFormElement.prototype.requestSubmit para bloquear
  // reconciliações tardias.
  window.CorpoNuSutiaFallbacksCompatibilidade = {
    versao: VERSION,
    ativo: false
  };
})();