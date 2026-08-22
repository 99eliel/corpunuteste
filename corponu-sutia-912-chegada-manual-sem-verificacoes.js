(() => {
  "use strict";

  const VERSION = "2026-08-21-sutia-912-fluxo-nativo-265";
  const FORM_ID = "formChegadaManualFaccao";
  const AVISO_ID = "avisoSutia912SemVerificacoes93";
  const CAMPOS_ID = "camposSutia912NaoAplicaveis93";
  const DESCONTO_ID = "chegadaManualDesconto";
  const REFERENCIA_ESPECIAL = "912";
  const PROCESSO_COMPLETO = "SUTIÃ COMPLETO";
  const CLASSE_DESCONTO = "cn253-desconto-especial-oculto";

  if (window.__CORPONU_SUTIA_912_CHEGADA_MANUAL_SEM_VERIFICACOES__ === VERSION) return;
  window.__CORPONU_SUTIA_912_CHEGADA_MANUAL_SEM_VERIFICACOES__ = VERSION;

  let observer = null;
  let formObservado = null;
  let aplicando = false;

  const texto = valor => String(valor ?? "").trim();
  const normalizar = valor => texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  const referencia = valor => texto(valor).replace(/\s+/g, "").toUpperCase();

  function ehSutiaCompleto912() {
    const processo = normalizar(document.getElementById("chegadaManualProcesso")?.value);
    const ref = referencia(document.getElementById("chegadaManualRef")?.value);
    return processo === normalizar(PROCESSO_COMPLETO) && ref === REFERENCIA_ESPECIAL;
  }

  function garantirEstilo() {
    if (document.getElementById("styleSutia912SemVerificacoes93")) return;
    const style = document.createElement("style");
    style.id = "styleSutia912SemVerificacoes93";
    style.textContent = `
      #${FORM_ID}.sutia-912-sem-verificacoes #sutCompletoComponentesChegadaManual,
      #${FORM_ID}.sutia-912-sem-verificacoes [id^="sutCompletoComponentesChegadaManual"]{display:none!important;visibility:hidden!important;pointer-events:none!important}
      #${FORM_ID} .${CLASSE_DESCONTO}{display:none!important}
      #${AVISO_ID}{grid-column:1/-1;margin:10px 0 2px;padding:12px 13px;border:1px solid #86efac;border-radius:12px;background:#f0fdf4;color:#166534;font-size:12px;font-weight:800;line-height:1.45}
      #${AVISO_ID} strong{display:block;margin-bottom:3px;color:#14532d;font-size:13px}
      #${CAMPOS_ID}{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function primeiroTexto(label) {
    return [...label.childNodes].find(node => node.nodeType === Node.TEXT_NODE && texto(node.textContent));
  }

  function ajustarRotuloFaccao(especial) {
    const select = document.getElementById("chegadaManualFaccao");
    const label = select?.closest("label");
    if (!(select instanceof HTMLSelectElement) || !(label instanceof HTMLLabelElement)) return;

    const noTexto = primeiroTexto(label);
    if (noTexto) {
      if (!label.dataset.rotuloOriginal93) label.dataset.rotuloOriginal93 = texto(noTexto.textContent);
      const desejado = especial ? "Facção que receberá o pagamento" : label.dataset.rotuloOriginal93;
      if (texto(noTexto.textContent) !== desejado) noTexto.textContent = `\n            ${desejado}\n            `;
    }

    const opcao = select.options?.[0];
    if (opcao) {
      if (!opcao.dataset.textoOriginal93) opcao.dataset.textoOriginal93 = opcao.textContent || "";
      opcao.textContent = especial
        ? "Selecione a facção responsável pelo Sutiã Completo"
        : opcao.dataset.textoOriginal93;
    }
  }

  function garantirContainerCampos(form) {
    let container = document.getElementById(CAMPOS_ID);
    if (!container) {
      container = document.createElement("div");
      container.id = CAMPOS_ID;
      container.setAttribute("aria-hidden", "true");
      form.appendChild(container);
    }
    return container;
  }

  function garantirCampoSelect(form, id, valor) {
    let campo = document.getElementById(id);
    if (!(campo instanceof HTMLSelectElement)) {
      campo = document.createElement("select");
      campo.id = id;
      campo.innerHTML = '<option value="nao_informado">Não se aplica</option>';
      garantirContainerCampos(form).appendChild(campo);
    }
    campo.value = valor;
    campo.required = false;
  }

  function garantirCampoTexto(form, id) {
    let campo = document.getElementById(id);
    if (!(campo instanceof HTMLInputElement)) {
      campo = document.createElement("input");
      campo.id = id;
      campo.type = "text";
      garantirContainerCampos(form).appendChild(campo);
    }
    campo.value = "";
    campo.required = false;
    campo.disabled = true;
  }

  function garantirCampoCheckbox(form, id) {
    let campo = document.getElementById(id);
    if (!(campo instanceof HTMLInputElement)) {
      campo = document.createElement("input");
      campo.id = id;
      campo.type = "checkbox";
      garantirContainerCampos(form).appendChild(campo);
    }
    campo.checked = true;
    campo.required = false;
  }

  function ajustarDescontoDefeito(especial) {
    const campo = document.getElementById(DESCONTO_ID);
    if (!(campo instanceof HTMLInputElement)) return;
    const wrapper = campo.closest("label") || campo.parentElement;

    if (especial) {
      if (campo.dataset.cn253OriginalSalvo !== "1") {
        campo.dataset.cn253OriginalSalvo = "1";
        campo.dataset.cn253ValorOriginal = campo.value || "";
        campo.dataset.cn253DisabledOriginal = campo.disabled ? "1" : "0";
        campo.dataset.cn253RequiredOriginal = campo.required ? "1" : "0";
      }
      campo.value = "0";
      campo.disabled = true;
      campo.required = false;
      wrapper?.classList.add(CLASSE_DESCONTO);
      return;
    }

    wrapper?.classList.remove(CLASSE_DESCONTO);
    if (campo.dataset.cn253OriginalSalvo !== "1") return;
    campo.value = campo.dataset.cn253ValorOriginal || "";
    campo.disabled = campo.dataset.cn253DisabledOriginal === "1";
    campo.required = campo.dataset.cn253RequiredOriginal === "1";
    delete campo.dataset.cn253OriginalSalvo;
    delete campo.dataset.cn253ValorOriginal;
    delete campo.dataset.cn253DisabledOriginal;
    delete campo.dataset.cn253RequiredOriginal;
  }

  function forcarNaoAplicavel(form) {
    garantirCampoSelect(form, "sc51mLateralSituacao", "nao_informado");
    garantirCampoSelect(form, "sc51mBojoSituacao", "nao_informado");
    garantirCampoTexto(form, "sc51mLateralResponsavel");
    garantirCampoTexto(form, "sc51mBojoResponsavel");
    garantirCampoCheckbox(form, "sc51mFechoPronto");
    garantirCampoCheckbox(form, "sc51mPontoLuzPronto");
    ajustarDescontoDefeito(true);
  }

  function garantirAviso(form) {
    let aviso = document.getElementById(AVISO_ID);
    if (!aviso) {
      aviso = document.createElement("div");
      aviso.id = AVISO_ID;
      const actions = form.querySelector(".actions");
      if (actions) actions.insertAdjacentElement("beforebegin", aviso);
      else form.appendChild(aviso);
    }
    aviso.innerHTML = "<strong>Referência 912: valor integral</strong>Não se aplicam descontos de lateral, bojo, fecho, ponto de luz ou defeito. Selecione apenas a facção que receberá o pagamento.";
  }

  function aplicar() {
    if (aplicando) return false;
    const form = document.getElementById(FORM_ID);
    if (!(form instanceof HTMLFormElement)) return false;

    aplicando = true;
    try {
      const especial = ehSutiaCompleto912();
      form.classList.toggle("sutia-912-sem-verificacoes", especial);
      ajustarRotuloFaccao(especial);

      if (!especial) {
        ajustarDescontoDefeito(false);
        document.getElementById(AVISO_ID)?.remove();
        document.getElementById(CAMPOS_ID)?.remove();
        return false;
      }

      forcarNaoAplicavel(form);
      garantirAviso(form);
      return true;
    } finally {
      aplicando = false;
    }
  }

  function observarFormulario() {
    const form = document.getElementById(FORM_ID);
    if (!(form instanceof HTMLFormElement)) return false;
    if (formObservado === form) return true;

    observer?.disconnect();
    formObservado = form;
    observer = new MutationObserver(() => {
      if (!aplicando) aplicar();
    });
    observer.observe(form, { childList: true, subtree: true });
    return true;
  }

  function instalarEventos() {
    document.addEventListener("submit", event => {
      if (event.target?.id === FORM_ID && ehSutiaCompleto912()) aplicar();
    }, true);

    ["input", "change"].forEach(tipo => {
      document.addEventListener(tipo, event => {
        const alvo = event.target;
        if (!(alvo instanceof HTMLInputElement || alvo instanceof HTMLSelectElement)) return;
        if (["chegadaManualOP", "chegadaManualRef", "chegadaManualProcesso"].includes(alvo.id)) aplicar();
      }, true);
    });

    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (!alvo?.closest("#btnAbrirChegadaManualFaccao, #btnBuscarOPChegadaManualFaccao")) return;
      queueMicrotask(() => {
        observarFormulario();
        aplicar();
      });
    }, true);
  }

  function iniciar() {
    garantirEstilo();
    instalarEventos();
    observarFormulario();
    aplicar();
  }

  window.CorpoNuSutia912Manual = { versao: VERSION, aplicar };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();