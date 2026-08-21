(() => {
  "use strict";

  const VERSION = "2026-08-13-faccoes-catalogo-processos-197";
  const ARQUIVO = "corponu-faccoes-catalogo-processos-197.js";

  window.__CORPONU_PAGAMENTOS_INTERFACE_FIX__ = VERSION;

  // Este arquivo continua sem mover elementos da interface de Pagamentos.
  // Ele apenas aproveita um módulo global já carregado pelo sistema para ativar
  // a sincronização do catálogo de processos usado no Registrar saída.
  if (![...document.scripts].some(script => String(script.src || "").includes(ARQUIVO))) {
    const script = document.createElement("script");
    script.src = `./${ARQUIVO}?v=${encodeURIComponent(VERSION)}&t=${Date.now()}`;
    script.async = false;
    script.dataset.corponuModulo = "faccoes-catalogo-processos-197";
    script.onerror = () => console.error("Não foi possível sincronizar os processos ativos da aba Facções.");
    document.head.appendChild(script);
  }
})();