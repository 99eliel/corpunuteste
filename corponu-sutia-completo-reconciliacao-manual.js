(() => {
  "use strict";

  const VERSION = "2026-08-21-sutia-reconciliacao-manual-compatibilidade-256";

  if (window.__CORPONU_SUTIA_COMPLETO_RECONCILIACAO_MANUAL__ === VERSION) return;
  window.__CORPONU_SUTIA_COMPLETO_RECONCILIACAO_MANUAL__ = VERSION;

  // Compatibilidade temporária. A chegada manual de SUTIÃ COMPLETO já grava
  // movimentação, pagamento e componentes em uma única transação. O fallback
  // de 7 segundos fazia nova consulta por OP e podia recalcular dados que já
  // haviam sido salvos corretamente pelo fluxo atômico.
  window.CorpoNuSutiaReconciliacaoManualCompatibilidade = {
    versao: VERSION,
    ativo: false
  };
})();