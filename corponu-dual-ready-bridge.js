(() => {
  "use strict";

  const VERSION = "2026-08-21-dual-ready-bridge-249";
  const SELECTOR = 'script[data-corponu-dual-mode="1"]';

  if (window.__CORPONU_DUAL_READY_BRIDGE__ === VERSION) return;
  window.__CORPONU_DUAL_READY_BRIDGE__ = VERSION;

  let observer = null;
  let scriptObservado = null;
  let disparado = false;

  function disparar() {
    if (disparado) return;
    if (!window.corponuDualMode?.state?.ready) return;
    disparado = true;
    observer?.disconnect();
    observer = null;
    document.dispatchEvent(new CustomEvent("corponu:dual-ready", {
      detail: { versao: window.corponuDualMode?.version || "" }
    }));
  }

  function observarScript(script) {
    if (!(script instanceof HTMLScriptElement) || scriptObservado === script) return;
    scriptObservado = script;

    script.addEventListener("load", () => queueMicrotask(disparar), { once: true });
    if (window.corponuDualMode?.state?.ready) queueMicrotask(disparar);
  }

  function procurar() {
    const script = document.querySelector(SELECTOR);
    if (script) observarScript(script);
    disparar();
  }

  function iniciar() {
    procurar();
    if (disparado) return;

    observer = new MutationObserver(procurar);
    observer.observe(document.head || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"]
    });
  }

  window.CorpoNuDualReadyBridge = { versao: VERSION, verificar: procurar };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();