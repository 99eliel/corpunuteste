(() => {
  "use strict";

  const VERSION = "2026-08-21-chegada-componentes-direta-236";
  const MODAL_ID = "modalChegadaMovimentacao";
  const PAINEL_CORRETO_ID = "sutCompletoComponentesChegada";
  const CLASSE_OCULTA = "cn236-componentes-duplicados";

  if (window.__CORPONU_CHEGADA_SEM_COMPONENTES_DUPLICADOS__ === VERSION) return;
  window.__CORPONU_CHEGADA_SEM_COMPONENTES_DUPLICADOS__ = VERSION;

  let observadorModal = null;
  let modalObservado = null;
  let sincronizando = false;

  const normalizar = valor => String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  function injetarEstilo() {
    if (document.getElementById("styleChegadaSemDuplicidade236")) return;
    const style = document.createElement("style");
    style.id = "styleChegadaSemDuplicidade236";
    style.textContent = `#${MODAL_ID} .${CLASSE_OCULTA}{display:none!important}`;
    document.head.appendChild(style);
  }

  function estadoPorTexto(valor) {
    const texto = normalizar(valor);
    if (!texto || texto === "SELECIONE" || texto.includes("INFORME A SITUACAO")) return "";
    if (texto === "SIM" || texto === "TRUE" || texto === "1" || (texto.includes("PRONTA") && !texto.includes("NAO PRONTA")) || (texto.includes("FEITA") && !texto.includes("NAO FEITA"))) return "sim";
    if (texto === "NAO" || texto === "FALSE" || texto === "0" || texto.includes("NAO PRONTA") || texto.includes("NAO FEITA")) return "nao";
    return "";
  }

  function estadoDoPainelCorreto(tipo) {
    const nome = tipo === "lateral" ? "Lateral" : "Bojo";
    const select = document.getElementById(`sc51${nome}Situacao`);
    if (select instanceof HTMLSelectElement) {
      const option = select.options?.[select.selectedIndex];
      const estado = estadoPorTexto(`${select.value} ${option?.textContent || ""}`);
      if (estado) return estado;
    }

    const painel = document.getElementById(PAINEL_CORRETO_ID);
    const card = painel?.querySelector(`.sc51-componente[data-componente="${tipo}"]`);
    if (!card) return "";
    if (card.querySelector(".sc51-pill.sim")) return "sim";
    if (card.querySelector(".sc51-pill.nao")) return "nao";
    return estadoPorTexto(card.textContent);
  }

  function localizarTituloDuplicado(modal) {
    const candidatos = [...modal.querySelectorAll("h1,h2,h3,h4,h5,strong,b,span,div")]
      .filter(elemento => normalizar(elemento.textContent).includes("CONFIRME OS COMPONENTES DO SUTIA"));
    candidatos.sort((a, b) => a.querySelectorAll("*").length - b.querySelectorAll("*").length);
    return candidatos[0] || null;
  }

  function localizarBlocoDuplicado(modal) {
    const titulo = localizarTituloDuplicado(modal);
    if (!titulo) return null;
    let atual = titulo;
    for (let nivel = 0; atual && atual !== modal && nivel < 7; nivel += 1, atual = atual.parentElement) {
      const texto = normalizar(atual.textContent);
      if (texto.includes("LATERAL FOI PRONTA") && texto.includes("BOJO FOI PRONTO") && atual.querySelectorAll("select").length >= 2) return atual;
    }
    return titulo.parentElement;
  }

  function selectDoComponente(bloco, tipo) {
    const trecho = tipo === "lateral" ? "LATERAL FOI PRONTA" : "BOJO FOI PRONTO";
    const label = [...bloco.querySelectorAll("label")].find(item => normalizar(item.textContent).includes(trecho));
    if (label?.querySelector("select")) return label.querySelector("select");
    const selects = [...bloco.querySelectorAll("select")];
    return tipo === "lateral" ? (selects[0] || null) : (selects[1] || null);
  }

  function aplicarEstadoNoSelect(select, estado) {
    if (!(select instanceof HTMLSelectElement) || !estado) return;
    const correspondente = [...select.options].find(option => estadoPorTexto(`${option.value} ${option.textContent || ""}`) === estado);
    if (!correspondente || select.value === correspondente.value) return;
    select.value = correspondente.value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function sincronizar() {
    if (sincronizando) return false;
    const modal = document.getElementById(MODAL_ID);
    const bloco = modal ? localizarBlocoDuplicado(modal) : null;
    if (!bloco) return false;

    sincronizando = true;
    try {
      aplicarEstadoNoSelect(selectDoComponente(bloco, "lateral"), estadoDoPainelCorreto("lateral"));
      aplicarEstadoNoSelect(selectDoComponente(bloco, "bojo"), estadoDoPainelCorreto("bojo"));
      bloco.classList.add(CLASSE_OCULTA);
      bloco.setAttribute("aria-hidden", "true");
      bloco.querySelectorAll("select,input,button,textarea").forEach(campo => {
        campo.required = false;
        campo.removeAttribute("required");
        campo.tabIndex = -1;
      });
      return true;
    } finally {
      sincronizando = false;
    }
  }

  function observarModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return false;
    if (modalObservado === modal) return true;

    observadorModal?.disconnect();
    modalObservado = modal;
    observadorModal = new MutationObserver(() => {
      if (sincronizando || modal.classList.contains("hidden")) return;
      sincronizar();
    });
    observadorModal.observe(modal, { childList: true, subtree: true });
    return true;
  }

  function prepararModal() {
    observarModal();
    sincronizar();
  }

  function instalarEventos() {
    document.addEventListener("change", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (alvo?.matches("#sc51LateralSituacao,#sc51BojoSituacao") || alvo?.closest(`#${PAINEL_CORRETO_ID}`)) sincronizar();
    }, true);

    document.addEventListener("input", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (alvo?.matches("#sc51LateralSituacao,#sc51BojoSituacao")) sincronizar();
    }, true);

    document.addEventListener("submit", event => {
      if (event.target?.id === "formChegadaMovimentacao") sincronizar();
    }, true);

    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (!alvo?.closest('[onclick*="registrarChegadaMovimentacao"],button[data-chegada],button[data-registrar-chegada]')) return;
      window.setTimeout(prepararModal, 0);
    }, true);
  }

  function iniciar() {
    injetarEstilo();
    instalarEventos();
    prepararModal();
  }

  window.CorpoNuChegadaSemComponentesDuplicados = { versao: VERSION, sincronizar };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();