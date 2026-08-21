(() => {
  "use strict";

  const VERSION = "2026-08-14-faccoes-processos-saida-fixos-202";

  // Compatibilidade: este módulo antigo filtrava o mesmo seletor de processos
  // consultando precosReferencia novamente. A partir da 202, a regra oficial
  // ficou concentrada em corponu-faccoes-processos-cadastrados.js e é fixa por aba:
  // Sutiã -> ENCAPAR BOJO, SUTIÃ COMPLETO, INTERLOCK
  // Calcinha -> CALCINHA COMPLETA, CALCINHA MONTAGEM
  // Lateral e Alça -> LATERAL, ALÇA
  // Mantemos o arquivo apenas para não quebrar loaders antigos, sem leituras ou observers.
  if (window.__CORPONU_FACCOES_CATALOGO_PROCESSOS_197__ === VERSION) return;
  window.__CORPONU_FACCOES_CATALOGO_PROCESSOS_197__ = VERSION;
})();
