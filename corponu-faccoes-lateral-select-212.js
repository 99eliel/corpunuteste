(() => {
  "use strict";

  const VERSION = "2026-08-19-lateral-alca-pc-lento-224";
  const PROCESSOS = ["LATERAL", "ALÇA"];

  if (window.__CORPONU_FACCOES_LATERAL_SELECT_212__ === VERSION) return;
  window.__CORPONU_FACCOES_LATERAL_SELECT_212__ = VERSION;

  let ultimoProcesso = "";
  let monitorTimer = 0;
  let monitorAte = 0;
  let restaurando = false;
  let selectObservado = null;
  let selectObserver = null;
  let modalAberto = false;

  const normalizar = valor => String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

  function processoCanonico(valor) {
    const alvo = normalizar(valor);
    return PROCESSOS.find(nome => normalizar(nome) === alvo) || "";
  }

  function contextoLateral() {
    const modal = document.getElementById("modalSaida3");
    if (!modal || modal.classList.contains("hidden")) return false;

    const gravado = normalizar(modal.dataset.corponuAbaSaida || "");
    if (["CORTE", "LATERAL", "LATERAL E ALCA", "LATERAL E ALÇA"].includes(gravado)) return true;

    const titulo = normalizar(document.getElementById("s3titulo")?.textContent || "");
    if (titulo.includes("LATERAL") || titulo.includes("CORTE")) return true;

    return document.getElementById("abaFaccaoCorte")?.classList.contains("active") === true;
  }

  function congelarContextoLateral() {
    const modal = document.getElementById("modalSaida3");
    if (!modal || !contextoLateral()) return;
    if (modal.dataset.corponuAbaSaida !== "corte") modal.dataset.corponuAbaSaida = "corte";
  }

  function garantirSelect() {
    const atual = document.getElementById("s3processo");
    if (!atual) return null;

    if (atual instanceof HTMLSelectElement) {
      observarSelect(atual);
      return atual;
    }

    const select = document.createElement("select");
    [...atual.attributes].forEach(atributo => {
      if (["type", "placeholder", "list"].includes(atributo.name)) return;
      select.setAttribute(atributo.name, atributo.value);
    });
    select.id = "s3processo";
    select.required = true;
    atual.replaceWith(select);
    observarSelect(select);
    return select;
  }

  function assinatura(select) {
    return [...select.options]
      .map(option => normalizar(option.value || option.textContent))
      .filter(Boolean)
      .join("|");
  }

  function avisarMudancaRestaurada(select) {
    if (restaurando) return;
    restaurando = true;
    try {
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    } finally {
      window.setTimeout(() => { restaurando = false; }, 0);
    }
  }

  function memorizarValorAtual(select, reagendar = false) {
    if (!(select instanceof HTMLSelectElement) || !contextoLateral()) return false;
    const valido = processoCanonico(select.value);
    if (!valido) return false;

    const mudou = ultimoProcesso !== valido;
    ultimoProcesso = valido;
    if (mudou && reagendar) estabilizarAposEscolha();
    return true;
  }

  function preencher() {
    if (!contextoLateral()) return;
    congelarContextoLateral();

    const select = garantirSelect();
    if (!(select instanceof HTMLSelectElement)) return;

    const valorAntes = processoCanonico(select.value);
    if (valorAntes) ultimoProcesso = valorAntes;

    const desejada = ["SELECIONE O PROCESSO", ...PROCESSOS.map(normalizar)].join("|");
    const precisaReconstruir = assinatura(select) !== desejada;

    if (precisaReconstruir) {
      select.innerHTML = '<option value="">Selecione o processo</option>' + PROCESSOS
        .map(nome => `<option value="${nome}">${nome}</option>`)
        .join("");
    }

    select.disabled = false;

    const atual = processoCanonico(select.value);
    const restaurar = atual || valorAntes || ultimoProcesso;
    if (restaurar && processoCanonico(select.value) !== restaurar) {
      select.value = restaurar;
      ultimoProcesso = restaurar;
      avisarMudancaRestaurada(select);
    }
  }

  function sincronizar() {
    preencher();
    [0, 80, 250, 700, 1400, 2500].forEach(atraso => window.setTimeout(preencher, atraso));
  }

  function estabilizarAposEscolha() {
    [0, 60, 180, 450, 900, 1600, 2800].forEach(atraso => window.setTimeout(preencher, atraso));
  }

  function monitorarEscolha() {
    monitorAte = Date.now() + 5000;
    if (monitorTimer) return;

    monitorTimer = window.setInterval(() => {
      const select = document.getElementById("s3processo");
      if (select instanceof HTMLSelectElement && contextoLateral()) {
        memorizarValorAtual(select, true);
        preencher();
      }

      if (Date.now() >= monitorAte || !contextoLateral()) {
        window.clearInterval(monitorTimer);
        monitorTimer = 0;
      }
    }, 80);
  }

  function observarSelect(select) {
    if (!(select instanceof HTMLSelectElement) || selectObservado === select) return;

    selectObserver?.disconnect();
    selectObservado = select;
    selectObserver = new MutationObserver(() => {
      if (!contextoLateral()) return;
      window.setTimeout(preencher, 0);
    });
    selectObserver.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
  }

  function observarModal() {
    const modal = document.getElementById("modalSaida3");
    if (!modal || modal.dataset.corponuLateralSelect224 === "1") return;
    modal.dataset.corponuLateralSelect224 = "1";
    modalAberto = !modal.classList.contains("hidden");

    const observer = new MutationObserver(() => {
      const abertoAgora = !modal.classList.contains("hidden");

      if (abertoAgora && !modalAberto) {
        ultimoProcesso = "";
        congelarContextoLateral();
        sincronizar();
      }

      if (!abertoAgora && modalAberto) {
        ultimoProcesso = "";
        if (monitorTimer) {
          window.clearInterval(monitorTimer);
          monitorTimer = 0;
        }
      }

      modalAberto = abertoAgora;

      if (abertoAgora && contextoLateral()) {
        congelarContextoLateral();
        preencher();
      }
    });

    observer.observe(modal, {
      attributes: true,
      attributeFilter: ["class", "data-corponu-aba-saida"]
    });
  }

  document.addEventListener("focusin", event => {
    if (event.target?.id !== "s3processo" || !contextoLateral()) return;
    memorizarValorAtual(event.target, false);
    monitorarEscolha();
    preencher();
  }, true);

  document.addEventListener("pointerdown", event => {
    if (event.target?.id === "s3processo" && contextoLateral()) monitorarEscolha();
  }, true);

  document.addEventListener("click", event => {
    const alvo = event.target instanceof Element ? event.target : null;
    if (!alvo) return;
    if (alvo.closest("#s3buscar") && contextoLateral()) sincronizar();
    if (alvo.closest("#s3fechar,#s3cancelar")) ultimoProcesso = "";
  }, true);

  document.addEventListener("keydown", event => {
    if (event.target?.id === "s3op" && event.key === "Enter" && contextoLateral()) sincronizar();
  }, true);

  function iniciar() {
    let tentativas = 0;
    const timer = window.setInterval(() => {
      tentativas += 1;
      observarModal();
      const select = document.getElementById("s3processo");
      if (select instanceof HTMLSelectElement) observarSelect(select);
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
