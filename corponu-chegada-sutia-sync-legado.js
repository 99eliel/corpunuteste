(() => {
  "use strict";

  const VERSION = "2026-08-11-fix-chegada-sutia-origem-179";
  const FORM_PADRAO = "formChegadaMovimentacao";
  const FORM_MANUAL = "formChegadaManualFaccao";
  const PAINEL_PADRAO = "sutCompletoComponentesChegada";
  const PAINEL_MANUAL = "sutCompletoComponentesChegadaManual";

  if (window.__CORPONU_CHEGADA_SUTIA_COMPAT_179__ === VERSION) return;
  window.__CORPONU_CHEGADA_SUTIA_COMPAT_179__ = VERSION;

  function prepararFluxoAtual(form) {
    if (!(form instanceof HTMLFormElement)) return false;
    if (![FORM_PADRAO, FORM_MANUAL].includes(form.id)) return false;

    const manual = form.id === FORM_MANUAL;
    const painel = document.getElementById(manual ? PAINEL_MANUAL : PAINEL_PADRAO);
    if (!(painel instanceof HTMLElement)) return false;

    // O módulo atual corponu-sutia-completo-chegada-rapida.js já possui toda a
    // regra vigente: facção = sem desconto; confecção = desconto;
    // não informado = pagamento pendente; responsável opcional.
    // Este arquivo existia apenas para um fluxo legado e interceptava o submit
    // antes do módulo atual. Agora ele apenas sinaliza o submit para o fluxo novo.
    form.dataset.sc107ReenvioSubmit = "1";
    form.dataset.corponuChegadaSutiaFluxoAtual = VERSION;
    return true;
  }

  document.addEventListener("submit", event => {
    prepararFluxoAtual(event.target);
  }, true);

  window.CorpoNuChegadaSutiaDefinitiva = {
    versao: VERSION,
    ativa: false,
    compatibilidade: true,
    prepararFluxoAtual() {
      prepararFluxoAtual(document.getElementById(FORM_PADRAO));
      prepararFluxoAtual(document.getElementById(FORM_MANUAL));
    }
  };
})();
