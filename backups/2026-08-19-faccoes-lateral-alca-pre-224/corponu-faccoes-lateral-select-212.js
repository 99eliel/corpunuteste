(() => {
  "use strict";

  const VERSION = "2026-08-18-lateral-select-estavel-212";
  const PROCESSOS = ["LATERAL", "ALÇA"];

  if (window.__CORPONU_FACCOES_LATERAL_SELECT_212__ === VERSION) return;
  window.__CORPONU_FACCOES_LATERAL_SELECT_212__ = VERSION;

  const normalizar = valor => String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

  function contextoLateral() {
    const modal = document.getElementById("modalSaida3");
    if (!modal || modal.classList.contains("hidden")) return false;

    const gravado = normalizar(modal.dataset.corponuAbaSaida || "");
    if (["CORTE", "LATERAL", "LATERAL E ALCA", "LATERAL E ALÇA"].includes(gravado)) return true;

    const titulo = normalizar(document.getElementById("s3titulo")?.textContent || "");
    if (titulo.includes("LATERAL") || titulo.includes("CORTE")) return true;

    return document.getElementById("abaFaccaoCorte")?.classList.contains("active") === true;
  }

  function garantirSelect() {
    const atual = document.getElementById("s3processo");
    if (!atual) return null;

    if (atual instanceof HTMLSelectElement) return atual;

    const select = document.createElement("select");
    [...atual.attributes].forEach(atributo => {
      if (["type", "placeholder", "list"].includes(atributo.name)) return;
      select.setAttribute(atributo.name, atributo.value);
    });
    select.id = "s3processo";
    select.required = true;
    atual.replaceWith(select);
    return select;
  }

  function assinatura(select) {
    return [...select.options]
      .map(option => normalizar(option.value || option.textContent))
      .filter(Boolean)
      .join("|");
  }

  function preencher() {
    if (!contextoLateral()) return;

    const select = garantirSelect();
    if (!(select instanceof HTMLSelectElement)) return;

    const desejada = ["SELECIONE O PROCESSO", ...PROCESSOS.map(normalizar)].join("|");
    if (assinatura(select) === desejada) return;

    const anterior = normalizar(select.value);
    select.innerHTML = '<option value="">Selecione o processo</option>' + PROCESSOS
      .map(nome => `<option value="${nome}">${nome}</option>`)
      .join("");
    select.disabled = false;

    const mantido = PROCESSOS.find(nome => normalizar(nome) === anterior);
    if (mantido) select.value = mantido;
  }

  function sincronizar() {
    preencher();
    window.setTimeout(preencher, 0);
    window.setTimeout(preencher, 80);
    window.setTimeout(preencher, 250);
  }

  function observarModal() {
    const modal = document.getElementById("modalSaida3");
    if (!modal || modal.dataset.corponuLateralSelect212 === "1") return;
    modal.dataset.corponuLateralSelect212 = "1";

    const observer = new MutationObserver(() => {
      if (!modal.classList.contains("hidden")) sincronizar();
    });

    observer.observe(modal, {
      attributes: true,
      attributeFilter: ["class", "data-corponu-aba-saida"],
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  document.addEventListener("focusin", event => {
    if (event.target?.id === "s3processo") preencher();
  }, true);

  document.addEventListener("click", event => {
    const alvo = event.target instanceof Element ? event.target : null;
    if (!alvo) return;
    if (alvo.closest("#s3buscar, #s3processo")) sincronizar();
  }, true);

  document.addEventListener("keydown", event => {
    if (event.target?.id === "s3op" && event.key === "Enter") sincronizar();
  }, true);

  function iniciar() {
    let tentativas = 0;
    const timer = window.setInterval(() => {
      tentativas += 1;
      observarModal();
      if (contextoLateral()) sincronizar();
      if (tentativas >= 60 || document.getElementById("modalSaida3")) window.clearInterval(timer);
    }, 200);

    observarModal();
    sincronizar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
