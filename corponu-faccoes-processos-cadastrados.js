(() => {
  "use strict";

  const VERSION = "2026-08-18-faccoes-contexto-explicito-211";
  const PROCESSOS_SAIDA = Object.freeze({
    sutia: ["ENCAPAR BOJO", "SUTIÃ COMPLETO", "INTERLOCK"],
    calcinha: ["CALCINHA COMPLETA", "CALCINHA MONTAGEM"],
    corte: ["LATERAL", "ALÇA"]
  });
  const PROCESSOS_EXCLUSIVOS_CALCINHA = new Set([
    "CALCINHA MONTAGEM",
    "CALCINHA COMPLETA"
  ]);
  const CLASSE_TIPO_INCOMPATIVEL = "cn200-faccao-tipo-incompativel";

  if (window.__CORPONU_FACCOES_PROCESSOS_CADASTRADOS__ === VERSION) return;
  window.__CORPONU_FACCOES_PROCESSOS_CADASTRADOS__ = VERSION;

  let classificacaoAgendada = 0;
  let observerSelect = null;
  let selectObservado = null;
  let preenchendo = false;
  let abaSaidaForcada = "";

  const normalizar = valor => String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

  const escapar = valor => String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function normalizarTipoAba(valor) {
    const tipo = String(valor || "").trim().toLowerCase();
    if (tipo === "sutia" || tipo === "sutiã") return "sutia";
    if (tipo === "calcinha") return "calcinha";
    if (["corte", "lateral", "lateral-alca", "lateral_alca", "lateral e alça", "lateral e alca"].includes(tipo)) return "corte";
    return "";
  }

  function garantirEstiloClassificacao() {
    if (document.getElementById("styleFaccaoClassificacaoVisual200")) return;
    const style = document.createElement("style");
    style.id = "styleFaccaoClassificacaoVisual200";
    style.textContent = `
      #faccoes #listaFaccoesMovimentacoes tr.${CLASSE_TIPO_INCOMPATIVEL},
      #faccoes #listaMovimentacoesUsuario tr.${CLASSE_TIPO_INCOMPATIVEL}{
        display:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function abaPrincipalFaccoesAtiva() {
    const corte = document.getElementById("abaFaccaoCorte");
    if (corte?.classList.contains("active")) return "corte";

    const ativa = document.querySelector('.corponu-dual-tabs[data-page="faccoes"] .corponu-dual-tab.active');
    const tipo = normalizarTipoAba(ativa?.dataset?.type || "");
    return tipo === "calcinha" || tipo === "sutia" ? tipo : "";
  }

  function indiceProcessoDaTabela(tabela) {
    if (!tabela) return -1;
    const cabecalhos = [...tabela.querySelectorAll("thead th")];
    return cabecalhos.findIndex(th => normalizar(th.textContent) === "PROCESSO");
  }

  function processoDaLinha(linha) {
    const tabela = linha?.closest("table");
    const indice = indiceProcessoDaTabela(tabela);
    if (indice < 0) return "";
    return normalizar(linha.cells?.[indice]?.textContent || "");
  }

  function corrigirClassificacaoVisualMovimentacoes() {
    garantirEstiloClassificacao();

    const aba = abaPrincipalFaccoesAtiva();
    if (!aba || aba === "corte") {
      document.querySelectorAll(`#faccoes tr.${CLASSE_TIPO_INCOMPATIVEL}`)
        .forEach(linha => linha.classList.remove(CLASSE_TIPO_INCOMPATIVEL));
      return;
    }

    ["listaFaccoesMovimentacoes", "listaMovimentacoesUsuario"].forEach(id => {
      const tbody = document.getElementById(id);
      if (!tbody) return;

      tbody.querySelectorAll(":scope > tr").forEach(linha => {
        if (linha.querySelector(".empty") || linha.cells.length <= 1) return;

        const processo = processoDaLinha(linha);
        const ehCalcinha = PROCESSOS_EXCLUSIVOS_CALCINHA.has(processo);

        if (!ehCalcinha) {
          linha.classList.remove(CLASSE_TIPO_INCOMPATIVEL);
          return;
        }

        linha.dataset.corponuTipoProcessoVisual = "calcinha";
        if (aba === "sutia") linha.classList.add(CLASSE_TIPO_INCOMPATIVEL);
        else {
          linha.classList.remove(CLASSE_TIPO_INCOMPATIVEL);
          linha.classList.remove("corponu-dual-hidden");
        }
      });
    });
  }

  function agendarClassificacaoVisual() {
    if (classificacaoAgendada) return;
    classificacaoAgendada = window.requestAnimationFrame(() => {
      classificacaoAgendada = 0;
      corrigirClassificacaoVisualMovimentacoes();
    });
  }

  function fixarAbaSaida(aba) {
    const tipo = normalizarTipoAba(aba);
    if (!tipo) return "";

    abaSaidaForcada = tipo;
    const modal = document.getElementById("modalSaida3");
    if (modal) modal.dataset.corponuAbaSaida = tipo;
    return tipo;
  }

  function tipoDaAbaClicada(alvo) {
    if (!alvo) return "";
    if (alvo.closest("#abaFaccaoCorte")) return "corte";

    const dual = alvo.closest('.corponu-dual-tabs[data-page="faccoes"] .corponu-dual-tab');
    if (dual) return normalizarTipoAba(dual.dataset.type || "");

    return "";
  }

  function abaSaidaAtual() {
    const modal = document.getElementById("modalSaida3");
    const gravadaNoModal = normalizarTipoAba(modal?.dataset?.corponuAbaSaida || "");
    if (gravadaNoModal) return gravadaNoModal;
    if (abaSaidaForcada) return abaSaidaForcada;

    const ativa = abaPrincipalFaccoesAtiva();
    if (ativa) return ativa;

    // Compatibilidade com telas antigas: título é apenas o último recurso,
    // nunca mais a fonte principal para decidir os processos.
    const titulo = normalizar(document.getElementById("s3titulo")?.textContent || "");
    if (titulo.includes("CALCINHA")) return "calcinha";
    if (titulo.includes("LATERAL") || titulo.includes("CORTE")) return "corte";
    return "sutia";
  }

  function processosPermitidos(aba = abaSaidaAtual()) {
    return PROCESSOS_SAIDA[aba] || PROCESSOS_SAIDA.sutia;
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
    select.innerHTML = '<option value="">Selecione o processo</option>';
    atual.replaceWith(select);
    return select;
  }

  function assinaturaSelect(select) {
    return [...select.options]
      .slice(1)
      .map(option => normalizar(option.value || option.textContent))
      .filter(Boolean)
      .join("|");
  }

  function preencherSelect() {
    if (preenchendo) return;
    const select = garantirSelect();
    if (!(select instanceof HTMLSelectElement)) return;

    const itens = processosPermitidos();
    const assinaturaDesejada = itens.map(normalizar).join("|");
    const atual = normalizar(select.value);

    if (assinaturaSelect(select) === assinaturaDesejada) {
      if (atual && !itens.some(item => normalizar(item) === atual)) select.value = "";
      select.disabled = false;
      return;
    }

    preenchendo = true;
    try {
      select.innerHTML = '<option value="">Selecione o processo</option>' + itens
        .map(nome => `<option value="${escapar(nome)}">${escapar(nome)}</option>`)
        .join("");
      select.disabled = false;

      const permitidoAnterior = itens.find(item => normalizar(item) === atual);
      if (permitidoAnterior) select.value = permitidoAnterior;
      else select.value = "";
    } finally {
      preenchendo = false;
    }

    observarSelect();
  }

  function observarSelect() {
    const select = garantirSelect();
    if (!(select instanceof HTMLSelectElement)) return;
    if (selectObservado === select) return;

    observerSelect?.disconnect();
    selectObservado = select;
    observerSelect = new MutationObserver(() => {
      if (!preenchendo) window.setTimeout(preencherSelect, 0);
    });
    observerSelect.observe(select, { childList: true });
  }

  function avisar(mensagem) {
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = mensagem;
      toast.classList.remove("hidden");
      window.clearTimeout(window.__faccoesProcessos211Toast);
      window.__faccoesProcessos211Toast = window.setTimeout(() => toast.classList.add("hidden"), 6000);
      return;
    }
    window.alert(mensagem);
  }

  function validarSubmit(event) {
    if (event.target?.id !== "s3form") return;
    const select = garantirSelect();
    if (!(select instanceof HTMLSelectElement)) return;

    const aba = abaSaidaAtual();
    const valor = normalizar(select.value);
    const permitidos = processosPermitidos(aba);
    const valido = permitidos.some(item => normalizar(item) === valor);
    if (valido) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    avisar(`Selecione um processo permitido para esta aba: ${permitidos.join(", ")}.`);
    preencherSelect();
    select.focus();
  }

  function preparar() {
    garantirSelect();
    observarSelect();
    agendarClassificacaoVisual();
  }

  document.addEventListener("click", event => {
    const alvo = event.target instanceof Element ? event.target : null;
    if (!alvo) return;

    const tipoClicado = tipoDaAbaClicada(alvo);
    if (tipoClicado) {
      fixarAbaSaida(tipoClicado);
      agendarClassificacaoVisual();
    }

    if (alvo.closest("#btnSaidaCorteNovo")) {
      fixarAbaSaida("corte");
      preencherSelect();
      window.setTimeout(preencherSelect, 80);
      return;
    }

    if (alvo.closest("#btnSaidaAbas")) {
      fixarAbaSaida(abaSaidaForcada || abaPrincipalFaccoesAtiva() || abaSaidaAtual());
      preencherSelect();
      window.setTimeout(preencherSelect, 80);
    }

    if (alvo.closest("#s3buscar")) {
      preencherSelect();
    }
  }, true);

  document.addEventListener("submit", validarSubmit, true);

  function iniciar() {
    const inicial = abaPrincipalFaccoesAtiva();
    if (inicial) fixarAbaSaida(inicial);
    preparar();
    window.setTimeout(() => {
      preparar();
      if (!document.getElementById("modalSaida3")?.classList.contains("hidden")) preencherSelect();
    }, 120);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();