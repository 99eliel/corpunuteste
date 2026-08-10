(() => {
  "use strict";

  const VERSION = "2026-08-10-alca-00270-correcao-168";
  const FIREBASE_VERSION = "10.12.5";
  const PRECO_ID = "valor-padrao-alca";
  const VALOR_MIGRACAO = 0.0270;
  const VALOR_ANTIGO = 0.0540;
  const ALCAS_POR_SUTIA = 2;
  const MODAL_ID = "modalPendenciasValoresFinanceiro";

  if (window.__CORPONU_ALCA_PENDENCIA_LEVE_126__ === VERSION) return;
  window.__CORPONU_ALCA_PENDENCIA_LEVE_126__ = VERSION;

  let contextoPromise = null;
  let salvando = false;
  let valorAtual = VALOR_MIGRACAO;

  const texto = valor => String(valor ?? "").trim();

  function normalizar(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]+/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function numero(valor) {
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
    const bruto = texto(valor).replace(/R\$/gi, "").replace(/\s+/g, "");
    if (!bruto) return 0;
    const ajustado = bruto.includes(",")
      ? bruto.replace(/\./g, "").replace(",", ".")
      : bruto;
    const resultado = Number(ajustado.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(resultado) ? resultado : 0;
  }

  const arredondar4 = valor => Math.round((Number(valor || 0) + Number.EPSILON) * 10000) / 10000;

  function valor4(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    });
  }

  function valorInput4(valor, campo) {
    const base = Number(valor || 0).toFixed(4);
    return campo?.type === "number" ? base : base.replace(".", ",");
  }

  function moeda4(valor) {
    return `R$ ${valor4(valor)}`;
  }

  async function contexto() {
    if (contextoPromise) return contextoPromise;
    contextoPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
    ]).then(([appModulo, authModulo, firestore]) => {
      if (!appModulo.getApps().length) throw new Error("Firebase ainda não inicializado.");
      const app = appModulo.getApp();
      return {
        firestore,
        db: firestore.getFirestore(app),
        auth: authModulo.getAuth(app)
      };
    }).catch(error => {
      contextoPromise = null;
      throw error;
    });
    return contextoPromise;
  }

  async function usuarioAtual(auth) {
    for (let tentativa = 0; tentativa < 30 && !auth.currentUser; tentativa += 1) {
      await new Promise(resolve => window.setTimeout(resolve, 100));
    }
    if (!auth.currentUser) throw new Error("Usuário não autenticado.");
    return auth.currentUser;
  }

  function toast(mensagem, erro = false) {
    const principal = document.getElementById("toast");
    if (principal) {
      principal.textContent = mensagem;
      principal.classList.remove("hidden");
      principal.style.background = erro ? "#991b1b" : "#166534";
      window.clearTimeout(window.__corponuAlca126Toast);
      window.__corponuAlca126Toast = window.setTimeout(() => {
        principal.classList.add("hidden");
        principal.style.removeProperty("background");
      }, erro ? 7000 : 2600);
      return;
    }

    const aviso = document.createElement("div");
    aviso.textContent = mensagem;
    aviso.style.cssText = [
      "position:fixed", "right:18px", "bottom:18px", "z-index:1000030",
      "max-width:min(520px,calc(100vw - 32px))", "padding:14px 16px",
      "border-radius:13px", "box-shadow:0 18px 48px rgba(15,23,42,.28)",
      `background:${erro ? "#991b1b" : "#166534"}`, "color:#fff",
      "font:800 13px/1.45 Arial,sans-serif"
    ].join(";");
    document.body.appendChild(aviso);
    window.setTimeout(() => aviso.remove(), erro ? 7000 : 2600);
  }

  function atualizarTextos(valor = valorAtual) {
    valorAtual = arredondar4(valor > 0 ? valor : VALOR_MIGRACAO);
    const totalSutia = arredondar4(valorAtual * ALCAS_POR_SUTIA);

    const input = document.getElementById("inputValorPadraoAlca");
    if (input instanceof HTMLInputElement && document.activeElement !== input) {
      input.value = valorInput4(valorAtual, input);
    }
    if (input instanceof HTMLInputElement) {
      input.readOnly = false;
      input.inputMode = "decimal";
      input.step = "0.0001";
      input.title = `Valor atual: ${moeda4(valorAtual)} por alça`;
    }

    const botao = document.getElementById("btnSalvarValorPadraoAlca");
    if (botao instanceof HTMLButtonElement) {
      botao.type = "button";
      botao.textContent = "Salvar valor da ALÇA";
      botao.dataset.alcaLeve126 = "1";
    }

    const status = document.getElementById("statusValorPadraoAlca");
    if (status) {
      status.textContent = `Valor atual: ${moeda4(valorAtual)} por alça. Cada sutiã recebe 2 alças, totalizando ${moeda4(totalSutia)} por sutiã.`;
    }

    const modal = document.getElementById(MODAL_ID);
    if (modal) {
      [...modal.querySelectorAll("input")].forEach(campo => {
        const rotulo = normalizar(campo.closest("label")?.textContent || "");
        if (!rotulo.includes("VALOR DE UMA ALCA")) return;
        if (document.activeElement !== campo) campo.value = valorInput4(valorAtual, campo);
        campo.readOnly = false;
        campo.inputMode = "decimal";
        campo.step = "0.0001";
      });

      [...modal.querySelectorAll("button")].forEach(item => {
        const rotulo = normalizar(item.textContent);
        if (
          rotulo.includes("SALVAR E RECALCULAR") ||
          rotulo.includes("APLICAR R") ||
          item.dataset.alcaLeve126 === "1"
        ) {
          item.type = "button";
          item.textContent = "Salvar valor da ALÇA";
          item.dataset.alcaLeve126 = "1";
        }
      });
    }
  }

  function valorDigitadoNaTela() {
    const principal = document.getElementById("inputValorPadraoAlca");
    if (principal instanceof HTMLInputElement && numero(principal.value) > 0) return numero(principal.value);

    const modal = document.getElementById(MODAL_ID);
    if (modal) {
      const campo = [...modal.querySelectorAll("input")].find(input =>
        normalizar(input.closest("label")?.textContent || "").includes("VALOR DE UMA ALCA")
      );
      if (campo && numero(campo.value) > 0) return numero(campo.value);
    }

    return valorAtual;
  }

  async function salvarDocumentoValor(valor, origem = "edicao_manual") {
    const { firestore, db, auth } = await contexto();
    const usuario = await usuarioAtual(auth);
    const agora = firestore.serverTimestamp();
    const valorSeguro = arredondar4(valor);

    await firestore.setDoc(firestore.doc(db, "precosReferencia", PRECO_ID), {
      referencia: "TODAS",
      processo: "ALÇA",
      setor: "alca",
      setorLabel: "Alça",
      valor: valorSeguro,
      valorUnitario: valorSeguro,
      preco: valorSeguro,
      ativo: true,
      tipoValor: "padrao_global_alca",
      valorPadraoGlobalAlca: true,
      multiplicadorQuantidade: ALCAS_POR_SUTIA,
      atualizadoPor: usuario.uid,
      atualizadoEm: agora,
      origemAtualizacao: origem,
      versaoValorAlca: VERSION
    }, { merge: true });

    valorAtual = valorSeguro;
    return valorSeguro;
  }

  async function salvarValorAlca(botao) {
    if (salvando) return;
    const valor = arredondar4(valorDigitadoNaTela());
    if (!(valor > 0)) {
      toast("Informe um valor da ALÇA maior que zero.", true);
      return;
    }

    salvando = true;
    const textoOriginal = botao?.textContent || "Salvar valor da ALÇA";
    if (botao) {
      botao.disabled = true;
      botao.textContent = "Salvando...";
    }

    try {
      const salvo = await salvarDocumentoValor(valor, "edicao_manual_sem_recalculo");
      atualizarTextos(salvo);
      document.getElementById(MODAL_ID)?.classList.add("hidden");
      document.body.style.removeProperty("overflow");
      document.documentElement.style.removeProperty("overflow");
      toast(`Valor da ALÇA atualizado para ${moeda4(salvo)}. Novos lançamentos usarão este valor.`);
    } catch (error) {
      console.error("Não foi possível salvar o valor da ALÇA.", error);
      toast(error?.message || "Não foi possível salvar o valor da ALÇA.", true);
    } finally {
      salvando = false;
      if (botao && document.contains(botao)) {
        botao.disabled = false;
        botao.textContent = textoOriginal.includes("Salvando") ? "Salvar valor da ALÇA" : textoOriginal;
      }
      atualizarTextos(valorAtual);
    }
  }

  async function carregarValorEAplicarMigracao() {
    try {
      const { firestore, db } = await contexto();
      const snap = await firestore.getDoc(firestore.doc(db, "precosReferencia", PRECO_ID));
      const dados = snap.exists() ? snap.data() : {};
      const salvo = arredondar4(numero(dados.valor ?? dados.valorUnitario ?? dados.preco));
      valorAtual = salvo > 0 ? salvo : VALOR_MIGRACAO;
      atualizarTextos(valorAtual);

      if (!(salvo > 0) || Math.abs(salvo - VALOR_ANTIGO) < 0.0000001) {
        const migrado = await salvarDocumentoValor(VALOR_MIGRACAO, "correcao_0_0540_duas_alcas_para_0_0270_unitario");
        atualizarTextos(migrado);
      }
    } catch (error) {
      console.warn("Não foi possível carregar/migrar o valor global da ALÇA.", error);
      atualizarTextos(valorAtual);
    }
  }

  function botaoAlcaDoEvento(event) {
    const alvo = event.target instanceof Element ? event.target.closest("button") : null;
    if (!alvo) return null;
    if (alvo.id === "btnSalvarValorPadraoAlca" || alvo.dataset.alcaLeve126 === "1") return alvo;
    const rotulo = normalizar(alvo.textContent);
    if (alvo.closest(`#${MODAL_ID}`) && (rotulo.includes("SALVAR") || rotulo.includes("APLICAR R"))) return alvo;
    return null;
  }

  window.addEventListener("click", event => {
    const botao = botaoAlcaDoEvento(event);
    if (!botao) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    salvarValorAlca(botao);
  }, true);

  window.addEventListener("submit", event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "formValorPadraoAlca") return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    salvarValorAlca(document.getElementById("btnSalvarValorPadraoAlca"));
  }, true);

  document.addEventListener("click", event => {
    const alvo = event.target instanceof Element ? event.target : null;
    if (!alvo) return;
    if (alvo.closest("#btnToggleGerenciarValores, #btnAtualizarConferenciaPagamentoFinal, .nav-btn[data-page='pagamentos'], .nav-btn[data-page='processos']")) {
      [0, 100, 350, 800].forEach(atraso => window.setTimeout(() => atualizarTextos(valorAtual), atraso));
    }
  }, true);

  function iniciar() {
    atualizarTextos(valorAtual);
    carregarValorEAplicarMigracao();
    [100, 400, 1000, 2200].forEach(atraso => window.setTimeout(() => atualizarTextos(valorAtual), atraso));
  }

  window.CorpoNuAlcaPendenciaLeve = {
    versao: VERSION,
    valorAtual: () => valorAtual,
    aplicar: () => salvarValorAlca(document.getElementById("btnSalvarValorPadraoAlca")),
    formatarValor: moeda4
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
