(() => {
  "use strict";

  const VERSION = "2026-08-17-ponto-luz-somente-411-207";
  const REFERENCIA_PONTO_LUZ = "411";

  if (window.__CORPONU_PONTO_LUZ_SOMENTE_411__ === VERSION) return;
  window.__CORPONU_PONTO_LUZ_SOMENTE_411__ = VERSION;

  let aplicacaoAgendada = false;
  let intervaloInicial = 0;

  const texto = valor => String(valor ?? "").trim();
  const normalizar = valor => texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  const normalizarReferencia = valor => texto(valor).replace(/\s+/g, "").toUpperCase();

  function referenciaDoTexto(valor) {
    const conteudo = texto(valor);
    if (!conteudo) return "";
    const match = conteudo.match(/(?:REF(?:ER[EÊ]NCIA)?\.?)[\s:#-]*([A-Z0-9._/-]+)/i);
    return normalizarReferencia(match?.[1] || "");
  }

  function referenciaPadrao() {
    const carregada = window.__CORPONU_CHEGADA_MOV_CARREGADA__;
    const direta = normalizarReferencia(carregada?.referencia || carregada?.ref || "");
    if (direta) return direta;

    const info = document.getElementById("chegadaMovimentacaoInfo")?.textContent ||
      document.getElementById("modalChegadaResumo")?.textContent || "";
    return referenciaDoTexto(info);
  }

  function referenciaManual() {
    return normalizarReferencia(document.getElementById("chegadaManualRef")?.value || "");
  }

  function processoManualEhCompleto() {
    return normalizar(document.getElementById("chegadaManualProcesso")?.value || "") === "SUTIA COMPLETO";
  }

  function processoPadraoEhCompleto() {
    const form = document.getElementById("formChegadaMovimentacao");
    const painel = document.getElementById("sutCompletoComponentesChegada");
    if (!form || !painel) return false;

    const processo = normalizar(
      form.dataset.corponuSutiaConfirmacaoProcesso ||
      document.getElementById("chegadaConfirmarProcesso")?.value ||
      window.__CORPONU_CHEGADA_MOV_CARREGADA__?.processo ||
      "SUTIÃ COMPLETO"
    );
    return processo === "SUTIA COMPLETO";
  }

  function restaurarCampo(prefixo) {
    const select = document.getElementById(`${prefixo}PontoLuzResposta107`);
    const checkbox = document.getElementById(`${prefixo}PontoLuzPronto`);
    const wrapper = select?.closest("label") || checkbox?.closest("label");

    if (wrapper instanceof HTMLElement && wrapper.dataset.corponuPontoLuzOculto206 === "1") {
      wrapper.style.removeProperty("display");
      delete wrapper.dataset.corponuPontoLuzOculto206;
    }

    if (select instanceof HTMLSelectElement && select.dataset.corponuPontoLuzAuto206 === "1") {
      if (select.value === "sim") select.value = "";
      select.disabled = false;
      select.required = true;
      delete select.dataset.corponuPontoLuzAuto206;
    }

    if (checkbox instanceof HTMLInputElement && checkbox.dataset.corponuPontoLuzAuto206 === "1") {
      checkbox.checked = false;
      delete checkbox.dataset.corponuPontoLuzAuto206;
    }
  }

  function tornarNaoAplicavel(prefixo, form) {
    const select = document.getElementById(`${prefixo}PontoLuzResposta107`);
    const checkbox = document.getElementById(`${prefixo}PontoLuzPronto`);
    const wrapper = select?.closest("label") || checkbox?.closest("label");

    if (!(select instanceof HTMLSelectElement) || !(wrapper instanceof HTMLElement)) return false;

    const mudou = select.dataset.corponuPontoLuzAuto206 !== "1" || select.value !== "sim";

    select.value = "sim";
    select.required = false;
    select.disabled = true;
    select.dataset.corponuPontoLuzAuto206 = "1";

    if (checkbox instanceof HTMLInputElement) {
      checkbox.checked = true;
      checkbox.dataset.corponuPontoLuzAuto206 = "1";
    }

    if (wrapper.dataset.corponuPontoLuzOculto206 !== "1") {
      wrapper.style.setProperty("display", "none", "important");
      wrapper.dataset.corponuPontoLuzOculto206 = "1";
    }
    if (form instanceof HTMLFormElement) form.dataset.corponuPontoLuzAplicavel = "0";

    if (mudou) {
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return true;
  }

  function aplicarAoFormulario(prefixo, form, referencia, processoCompleto) {
    if (!(form instanceof HTMLFormElement)) return;

    const ref = normalizarReferencia(referencia);
    if (!processoCompleto || !ref) {
      restaurarCampo(prefixo);
      delete form.dataset.corponuPontoLuzAplicavel;
      return;
    }

    if (ref === REFERENCIA_PONTO_LUZ) {
      restaurarCampo(prefixo);
      form.dataset.corponuPontoLuzAplicavel = "1";
      return;
    }

    tornarNaoAplicavel(prefixo, form);
  }

  function aplicar() {
    aplicacaoAgendada = false;

    aplicarAoFormulario(
      "sc51",
      document.getElementById("formChegadaMovimentacao"),
      referenciaPadrao(),
      processoPadraoEhCompleto()
    );

    aplicarAoFormulario(
      "sc51m",
      document.getElementById("formChegadaManualFaccao"),
      referenciaManual(),
      processoManualEhCompleto()
    );
  }

  function agendarAplicacao() {
    if (aplicacaoAgendada) return;
    aplicacaoAgendada = true;
    queueMicrotask(aplicar);
  }

  function instalar() {
    aplicar();

    ["input", "change"].forEach(tipo => {
      document.getElementById("chegadaManualRef")?.addEventListener(tipo, agendarAplicacao, true);
      document.getElementById("chegadaManualProcesso")?.addEventListener(tipo, agendarAplicacao, true);
    });

    document.addEventListener("click", event => {
      if (event.target?.closest?.("[onclick*='chegada'], [id*='Chegada'], [id*='chegada']")) {
        setTimeout(aplicar, 0);
        setTimeout(aplicar, 80);
        setTimeout(aplicar, 250);
      }
    }, true);

    const observer = new MutationObserver(agendarAplicacao);
    [
      document.getElementById("modalChegadaMovimentacao"),
      document.getElementById("modalChegadaManualFaccao"),
      document.getElementById("sutCompletoComponentesChegada"),
      document.getElementById("sutCompletoComponentesChegadaManual")
    ].filter(Boolean).forEach(alvo => {
      observer.observe(alvo, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "data-sutia912-rapido"]
      });
    });

    let tentativas = 0;
    intervaloInicial = window.setInterval(() => {
      tentativas += 1;
      aplicar();
      if (tentativas >= 130) {
        clearInterval(intervaloInicial);
        intervaloInicial = 0;
      }
    }, 200);

    window.addEventListener("focus", aplicar);
    window.addEventListener("pageshow", aplicar);

    console.info(`[CorpoNu] Ponto de luz somente na REF ${REFERENCIA_PONTO_LUZ}: ${VERSION}`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", instalar, { once: true });
  } else {
    instalar();
  }
})();
