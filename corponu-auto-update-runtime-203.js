(() => {
  "use strict";

  const VERSION = "2026-08-21-runtime-203-compatibilidade-245";

  if (window.__CORPONU_AUTO_UPDATE_RUNTIME__ === VERSION) return;
  window.__CORPONU_AUTO_UPDATE_RUNTIME__ = VERSION;

  // Compatibilidade temporária: versões antigas do loader de Calcinha ainda
  // requisitam este arquivo. Toda verificação de release e todo carregamento
  // adicional de módulos agora ficam centralizados em corponu-atualizador.js.
  // Este shim não cria timers, não consulta release e não injeta scripts.
  console.info(`[CorpoNu] Runtime 203 mantido apenas como compatibilidade: ${VERSION}`);
})();