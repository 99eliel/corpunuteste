(() => {
  "use strict";

  const VERSION = "2026-08-21-chegada-manual-componentes-direta-237";
  const PROCESSO_COMPLETO = "SUTIÃ COMPLETO";
  const FORM_ID = "formChegadaManualFaccao";
  const MODAL_ID = "modalChegadaManualFaccao";
  const PROCESSO_ID = "chegadaManualProcesso";
  const BLOCO_LEGADO_ID = "grupoComponentesSutiaChegadaManual";
  const PAINEL_ATUAL_ID = "sutCompletoComponentesChegadaManual";
  const LATERAL_LEGADA_ID = "chegadaManualLateralPronta";
  const BOJO_LEGADO_ID = "chegadaManualBojoPronto";
  const CLASSE_OCULTA = "cn237-componente-manual-legado-oculto";

  if (window.__CORPONU_CHEGADA_MANUAL_SEM_DUPLICIDADE__ === VERSION) return;
  window.__CORPONU_CHEGADA_MANUAL_SEM_DUPLICIDADE__ = VERSION;

  let observador = null;
  let modalObservado = null;
  let sincronizando = false;

  const normalizar = valor => String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  function processoAtual() {
    return normalizar(document.getElementById(PROCESSO_ID)?.value);
  }

  function ehSutiaCompleto() {
    return processoAtual() === normalizar(PROCESSO_COMPLETO);
  }

  function injetarEstilo() {
    if (document.getElementById("styleChegadaManualSemDuplicidade237")) return;
    const style = document.createElement("style");
    style.id = "styleChegadaManualSemDuplicidade237";
    style.textContent = `#${MODAL_ID} .${CLASSE_OCULTA}{display:none!important}`;
    document.head.appendChild(style);
  }

  function estadoPorTexto(valor) {
    const chave = normalizar(valor);
    if (!chave || chave.includes("SELECIONE") || chave.includes("INFORME A SITUACAO")) return "";
    if (chave === "NAO" || chave === "FALSE" || chave === "0" || chave.includes("NAO PRONTA") || chave.includes("NAO PRONTO") || chave.includes("NAO FEITA") || chave.includes("NAO FEITO")) return "nao";
    if (chave === "SIM" || chave === "TRUE" || chave === "1" || chave.includes("PRONTA") || chave.includes("PRONTO") || chave.includes("FEITA") || chave.includes("FEITO")) return "sim";
    return "";
  }

  function estadoDoPainel(componente) {
    const titulo = componente === "lateral" ? "Lateral" : "Bojo";
    const select = document.getElementById(`sc51m${titulo}Situacao`);
    if (select instanceof HTMLSelectElement) {
      const option = select.options?.[select.selectedIndex];
      const estado = estadoPorTexto(`${select.value} ${option?.textContent || ""}`);
      if (estado) return estado;
    }

    const painel = document.getElementById(PAINEL_ATUAL_ID);
    const card = painel?.querySelector(`[data-componente="${componente}"]`);
    if (!(card instanceof HTMLElement)) return "";
    if (card.querySelector(".sc51-pill.sim")) return "sim";
    if (card.querySelector(".sc51-pill.nao")) return "nao";
    return estadoPorTexto(card.textContent);
  }

  function aplicarEstado(select, estado) {
    if (!(select instanceof HTMLSelectElement) || !estado) return;
    const option = [...select.options].find(item => estadoPorTexto(`${item.value} ${item.textContent || ""}`) === estado);
    if (!option || select.value === option.value) return;
    select.value = option.value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function salvarEstadoOriginal(campo) {
    if (!(campo instanceof HTMLElement) || campo.dataset.cn237OriginalSalvo === "1") return;
    campo.dataset.cn237OriginalSalvo = "1";
    campo.dataset.cn237DisabledOriginal = campo.disabled ? "1" : "0";
    campo.dataset.cn237RequiredOriginal = campo.required ? "1" : "0";
    campo.dataset.cn237TabIndexOriginal = String(campo.tabIndex);
  }

  function ocultarBlocoLegado(bloco) {
    bloco.classList.add(CLASSE_OCULTA);
    bloco.setAttribute("aria-hidden", "true");
    bloco.querySelectorAll("input,select,textarea,button").forEach(campo => {
      salvarEstadoOriginal(campo);
      campo.required = false;
      campo.removeAttribute("required");
      campo.tabIndex = -1;
    });
  }

  function restaurarBlocoLegado(bloco) {
    bloco.classList.remove(CLASSE_OCULTA);
    bloco.removeAttribute("aria-hidden");
    bloco.querySelectorAll("input,select,textarea,button").forEach(campo => {
      if (campo.dataset.cn237OriginalSalvo !== "1") return;
      campo.disabled = campo.dataset.cn237DisabledOriginal === "1";
      campo.required = campo.dataset.cn237RequiredOriginal === "1";
      campo.tabIndex = Number(campo.dataset.cn237TabIndexOriginal || 0);
    });
  }

  function sincronizar() {
    if (sincronizando) return false;
    const bloco = document.getElementById(BLOCO_LEGADO_ID);
    if (!(bloco instanceof HTMLElement)) return false;

    const painelAtual = document.getElementById(PAINEL_ATUAL_ID);
    const deveOcultar = ehSutiaCompleto() && painelAtual instanceof HTMLElement;

    sincronizando = true;
    try {
      if (!deveOcultar) {
        restaurarBlocoLegado(bloco);
        return false;
      }

      const lateral = estadoDoPainel("lateral");
      const bojo = estadoDoPainel("bojo");
      aplicarEstado(document.getElementById(LATERAL_LEGADA_ID), lateral);
      aplicarEstado(document.getElementById(BOJO_LEGADO_ID), bojo);
      ocultarBlocoLegado(bloco);
      bloco.dataset.cn237Sincronizado = lateral && bojo ? "1" : "0";
      return true;
    } finally {
      sincronizando = false;
    }
  }

  function observarModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return false;
    if (modalObservado === modal) return true;

    observador?.disconnect();
    modalObservado = modal;
    observador = new MutationObserver(() => {
      if (sincronizando || modal.classList.contains("hidden")) return;
      sincronizar();
    });
    observador.observe(modal, { childList: true, subtree: true });
    return true;
  }

  function prepararModal() {
    observarModal();
    sincronizar();
  }

  function instalarEventos() {
    document.addEventListener("change", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (!alvo) return;
      if (alvo.id === PROCESSO_ID || alvo.matches("#sc51mLateralSituacao,#sc51mBojoSituacao") || alvo.closest(`#${PAINEL_ATUAL_ID}`)) sincronizar();
    }, true);

    document.addEventListener("input", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (alvo?.matches("#sc51mLateralSituacao,#sc51mBojoSituacao")) sincronizar();
    }, true);

    document.addEventListener("submit", event => {
      if (event.target?.id === FORM_ID) sincronizar();
    }, true);

    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (!alvo?.closest("#btnAbrirChegadaManualFaccao")) return;
      window.setTimeout(prepararModal, 0);
    }, true);
  }

  function iniciar() {
    injetarEstilo();
    instalarEventos();
    prepararModal();
  }

  window.CorpoNuChegadaManualSemDuplicidade = { versao: VERSION, sincronizar };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();