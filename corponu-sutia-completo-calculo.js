(() => {
  "use strict";

  const VERSION = "2026-08-11-componentes-opcionais-calculo-170";
  const FB = "10.12.5";
  const CONFIG_DOC = "sutia-completo-pagamento";
  const PROCESSO_COMPLETO = "SUTIÃ COMPLETO";
  const PROCESSO_LATERAL = "LATERAL";
  const PROCESSO_BOJO = "ENCAPAR BOJO";
  const DEFAULTS = Object.freeze({
    valorBaseGeral: 5.5,
    referenciaEspecial: "912",
    valorBaseReferenciaEspecial: 6.5,
    descontoFechoNaoFeito: 0.25,
    descontoPontoLuzNaoFeito: 0.15
  });

  if (window.__CORPONU_SUTIA_COMPLETO_CALCULO__ === VERSION) return;
  window.__CORPONU_SUTIA_COMPLETO_CALCULO__ = VERSION;

  let firebasePromise = null;
  let perfilAtual = null;
  let configAtual = { ...DEFAULTS };
  let precosCache = { expiraEm: 0, itens: [] };
  let chegadaAtual = null;
  let chegadaManualAtual = null;
  let preparandoChegadaPadraoId = "";
  let preparandoChegadaManualChave = "";
  const processando = new Set();

  const texto = valor => String(valor ?? "").trim();
  const normalizar = valor => texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  const referenciaNormalizada = valor => texto(valor).replace(/\s+/g, "").toUpperCase();
  const numero = (valor, padrao = 0) => {
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : padrao;
    const bruto = texto(valor);
    if (!bruto) return padrao;
    const convertido = Number(bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto);
    return Number.isFinite(convertido) ? convertido : padrao;
  };
  const arred4 = valor => Math.round((numero(valor) + Number.EPSILON) * 10000) / 10000;
  const arred2 = valor => Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
  const moeda2 = valor => numero(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const moeda4 = valor => `R$ ${numero(valor).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
  const esperar = ms => new Promise(resolve => window.setTimeout(resolve, ms));
  const escapar = valor => String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function processoCanonico(valor) {
    const chave = normalizar(valor);
    const mapa = {
      "SUTIA COMPLETO": PROCESSO_COMPLETO,
      "SUTIA MONTAGEM": "SUTIÃ MONTAGEM",
      "ENCAPAR BOJO": PROCESSO_BOJO,
      "ENCAPAR BOJOS": PROCESSO_BOJO,
      "BOJO": PROCESSO_BOJO,
      "LATERAL": PROCESSO_LATERAL
    };
    return mapa[chave] || texto(valor).toUpperCase();
  }

  function avisar(mensagem, tipo = "info") {
    const principal = document.getElementById("toast");
    if (principal) {
      principal.textContent = mensagem;
      principal.classList.remove("hidden");
      window.clearTimeout(window.__sutCompletoToast51);
      window.__sutCompletoToast51 = window.setTimeout(() => principal.classList.add("hidden"), 6500);
      return;
    }

    let toast = document.getElementById("toastSutiaCompleto51");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toastSutiaCompleto51";
      toast.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:100050;max-width:430px;padding:13px 15px;border-radius:13px;color:#fff;box-shadow:0 18px 42px #0f172a44;font:800 13px/1.45 Arial,sans-serif";
      document.body.appendChild(toast);
    }
    toast.style.background = tipo === "erro" ? "#991b1b" : tipo === "ok" ? "#166534" : "#0f172a";
    toast.textContent = mensagem;
    window.clearTimeout(toast._timer);
    toast._timer = window.setTimeout(() => toast.remove(), 6500);
  }

  async function firebase() {
    if (firebasePromise) return firebasePromise;
    firebasePromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-firestore.js`)
    ]).then(([appMod, authMod, fs]) => {
      if (!appMod.getApps().length) throw new Error("Firebase ainda não foi inicializado.");
      const app = appMod.getApp();
      return {
        fs,
        auth: authMod.getAuth(app),
        db: fs.getFirestore(app)
      };
    }).catch(error => {
      firebasePromise = null;
      throw error;
    });
    return firebasePromise;
  }

  async function obterPerfil() {
    const ctx = await firebase();
    const usuario = ctx.auth.currentUser;
    if (!usuario) return null;
    if (perfilAtual?.uid === usuario.uid) return perfilAtual;

    const snap = await ctx.fs.getDoc(ctx.fs.doc(ctx.db, "usuarios", usuario.uid));
    perfilAtual = {
      uid: usuario.uid,
      ...(snap.exists() ? snap.data() : {})
    };
    return perfilAtual;
  }

  function ehAdmin(perfil) {
    return ["ADMIN", "ADMINISTRADOR"].includes(normalizar(perfil?.tipo || perfil?.perfil || perfil?.role));
  }

  async function carregarConfig() {
    const ctx = await firebase();
    const snap = await ctx.fs.getDoc(ctx.fs.doc(ctx.db, "configuracoes", CONFIG_DOC));
    const dados = snap.exists() ? snap.data() : {};

    configAtual = {
      valorBaseGeral: Math.max(0, numero(dados.valorBaseGeral, DEFAULTS.valorBaseGeral)),
      referenciaEspecial: referenciaNormalizada(dados.referenciaEspecial || DEFAULTS.referenciaEspecial),
      valorBaseReferenciaEspecial: Math.max(0, numero(dados.valorBaseReferenciaEspecial, DEFAULTS.valorBaseReferenciaEspecial)),
      descontoFechoNaoFeito: Math.max(0, numero(dados.descontoFechoNaoFeito, DEFAULTS.descontoFechoNaoFeito)),
      descontoPontoLuzNaoFeito: Math.max(0, numero(dados.descontoPontoLuzNaoFeito, DEFAULTS.descontoPontoLuzNaoFeito))
    };

    preencherFormularioConfig();
    return configAtual;
  }

  function injetarEstilos() {
    if (document.getElementById("styleSutiaCompleto51")) return;
    const style = document.createElement("style");
    style.id = "styleSutiaCompleto51";
    style.textContent = `
      #configSutiaCompleto51{margin-bottom:18px}
      #configSutiaCompleto51 .sc51-grid{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:12px}
      #configSutiaCompleto51 .sc51-grid label{margin:0}
      #configSutiaCompleto51 .sc51-ajuda{margin-top:12px;padding:11px 12px;border:1px solid #c4b5fd;border-radius:11px;background:#f5f3ff;color:#5b21b6;font-size:12px;font-weight:800;line-height:1.45}
      #configSutiaCompleto51 .sc51-recalcular{display:flex;align-items:flex-start;gap:9px;margin-top:12px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc}
      #configSutiaCompleto51 .sc51-recalcular input{width:18px;height:18px;margin-top:1px;accent-color:#7c3aed}
      #configSutiaCompleto51 .sc51-status{display:block;margin-top:8px;color:#64748b;font-size:11px;font-weight:800}
      .sc51-chegada{margin-top:13px;padding:13px;border:1px solid #c4b5fd;border-radius:13px;background:#faf8ff}
      .sc51-chegada.hidden{display:none!important}
      .sc51-chegada h4{margin:0;color:#4c1d95;font-size:14px}
      .sc51-chegada>p{margin:4px 0 12px;color:#64748b;font-size:11px}
      .sc51-componentes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .sc51-componente{padding:10px;border:1px solid #ddd6fe;border-radius:11px;background:#fff}
      .sc51-componente strong{display:block;color:#1e293b;font-size:12px}
      .sc51-componente small{display:block;margin-top:4px;color:#64748b;font-size:10px;line-height:1.35}
      .sc51-componente select,.sc51-componente input[type="text"]{width:100%;margin-top:7px;box-sizing:border-box}
      .sc51-opcoes-fixas{display:flex;flex-wrap:wrap;gap:9px;margin-top:10px}
      .sc51-check{display:flex;align-items:center;gap:8px;min-height:38px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#334155;font-size:11px;font-weight:900;cursor:pointer}
      .sc51-check input{width:17px;height:17px;accent-color:#16a34a}
      .sc51-resumo{margin-top:10px;padding:9px 10px;border-radius:9px;background:#ede9fe;color:#5b21b6;font-size:11px;font-weight:900;line-height:1.45}
      .sc51-pill{display:inline-flex;margin-top:7px;padding:4px 7px;border-radius:999px;font-size:10px;font-weight:900}
      .sc51-pill.sim{background:#dcfce7;color:#166534}
      .sc51-pill.nao{background:#f1f5f9;color:#475569}
      .sc51-pill.pendente{background:#fef3c7;color:#92400e}
      #revisaoComponentes .rev-grid.sc51-sem-config-antiga{grid-template-columns:1fr!important}
      @media(max-width:980px){#configSutiaCompleto51 .sc51-grid{grid-template-columns:repeat(2,minmax(150px,1fr))}}
      @media(max-width:620px){#configSutiaCompleto51 .sc51-grid,.sc51-componentes{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function preencherFormularioConfig() {
    const campos = {
      sc51ValorBaseGeral: configAtual.valorBaseGeral,
      sc51ValorBase912: configAtual.valorBaseReferenciaEspecial,
      sc51Fecho: configAtual.descontoFechoNaoFeito,
      sc51PontoLuz: configAtual.descontoPontoLuzNaoFeito
    };
    Object.entries(campos).forEach(([id, valor]) => {
      const input = document.getElementById(id);
      if (input && document.activeElement !== input) input.value = arred4(valor).toFixed(4);
    });
    const ref = document.getElementById("sc51ReferenciaEspecial");
    if (ref && document.activeElement !== ref) ref.value = configAtual.referenciaEspecial;
  }

  async function injetarConfigProcessos() {
    injetarEstilos();
    const secao = document.getElementById("processos");
    if (!secao || document.getElementById("configSutiaCompleto51")) return;

    const perfil = await obterPerfil().catch(() => null);
    if (!ehAdmin(perfil)) return;

    const form = document.createElement("form");
    form.id = "configSutiaCompleto51";
    form.className = "panel form admin-only-block";
    form.innerHTML = `
      <div class="panel-header">
        <div>
          <h3>Configuração do Sutiã Completo</h3>
          <p>Valores gerais usados no cálculo automático das chegadas de SUTIÃ COMPLETO.</p>
        </div>
      </div>
      <div class="sc51-grid">
        <label>Valor geral do Sutiã Completo
          <input id="sc51ValorBaseGeral" type="number" min="0" step="0.0001" required>
        </label>
        <label>Referência especial
          <input id="sc51ReferenciaEspecial" type="text" maxlength="30" required>
        </label>
        <label>Valor da referência especial
          <input id="sc51ValorBase912" type="number" min="0" step="0.0001" required>
        </label>
        <label>Desconto do fecho não feito
          <input id="sc51Fecho" type="number" min="0" step="0.0001" required>
        </label>
        <label>Desconto do ponto de luz não feito
          <input id="sc51PontoLuz" type="number" min="0" step="0.0001" required>
        </label>
      </div>
      <div class="sc51-ajuda">
        Lateral e Encapar Bojo continuam usando os valores ativos por referência já cadastrados nesta aba.
        Sutiã Montagem não recebe estes descontos.
      </div>
      <label class="sc51-recalcular">
        <input id="sc51RecalcularPendentes" type="checkbox">
        <span>Recalcular pagamentos pendentes de SUTIÃ COMPLETO após salvar. Pagamentos pagos nunca serão alterados.</span>
      </label>
      <div class="actions">
        <button class="btn btn-primary" type="submit">Salvar configuração</button>
      </div>
      <small id="sc51StatusConfig" class="sc51-status"></small>
    `;

    const alvo = document.getElementById("tituloTabelaValores")?.closest(".panel") ||
      document.getElementById("tituloTabelaValores")?.parentElement ||
      secao.firstElementChild;
    if (alvo?.parentElement === secao) secao.insertBefore(form, alvo);
    else secao.prepend(form);

    form.addEventListener("submit", salvarConfiguracao);
    await carregarConfig().catch(error => console.warn("Configuração do Sutiã Completo não carregada.", error));
  }

  async function salvarConfiguracao(event) {
    event.preventDefault();
    const perfil = await obterPerfil().catch(() => null);
    if (!ehAdmin(perfil)) {
      avisar("Somente o administrador pode alterar estes valores.", "erro");
      return;
    }

    const nova = {
      valorBaseGeral: Math.max(0, numero(document.getElementById("sc51ValorBaseGeral")?.value)),
      referenciaEspecial: referenciaNormalizada(document.getElementById("sc51ReferenciaEspecial")?.value),
      valorBaseReferenciaEspecial: Math.max(0, numero(document.getElementById("sc51ValorBase912")?.value)),
      descontoFechoNaoFeito: Math.max(0, numero(document.getElementById("sc51Fecho")?.value)),
      descontoPontoLuzNaoFeito: Math.max(0, numero(document.getElementById("sc51PontoLuz")?.value))
    };

    if (!nova.valorBaseGeral || !nova.referenciaEspecial || !nova.valorBaseReferenciaEspecial) {
      avisar("Preencha os valores-base e a referência especial.", "erro");
      return;
    }

    const recalcular = document.getElementById("sc51RecalcularPendentes")?.checked === true;
    const mensagem = [
      "Confirmar a configuração do Sutiã Completo?",
      "",
      `Valor geral: ${moeda4(nova.valorBaseGeral)}`,
      `Referência ${nova.referenciaEspecial}: ${moeda4(nova.valorBaseReferenciaEspecial)}`,
      `Fecho não feito: ${moeda4(nova.descontoFechoNaoFeito)}`,
      `Ponto de luz não feito: ${moeda4(nova.descontoPontoLuzNaoFeito)}`,
      recalcular ? "" : "\nOs pagamentos pendentes não serão recalculados agora.",
      recalcular ? "\nOs pagamentos pendentes com informações completas serão recalculados." : ""
    ].filter(Boolean).join("\n");

    if (!window.confirm(mensagem)) return;

    const botao = event.submitter;
    const status = document.getElementById("sc51StatusConfig");
    if (botao) {
      botao.disabled = true;
      botao.textContent = recalcular ? "Salvando e recalculando..." : "Salvando...";
    }

    try {
      const ctx = await firebase();
      const usuario = ctx.auth.currentUser;
      await ctx.fs.setDoc(ctx.fs.doc(ctx.db, "configuracoes", CONFIG_DOC), {
        ...nova,
        atualizadoPor: usuario?.uid || "",
        atualizadoPorNome: perfil?.nome || usuario?.displayName || usuario?.email || "",
        atualizadoEm: ctx.fs.serverTimestamp(),
        versao: VERSION
      }, { merge: true });

      await ctx.fs.setDoc(ctx.fs.doc(ctx.db, "configuracoes", "revisao-componentes-confeccao"), {
        descontoLateralUnitario: 0,
        descontoBojoUnitario: 0,
        lateralConfigurada: false,
        bojoConfigurado: false,
        substituidaPorCalculoSutiaCompleto: true,
        substituidaEm: ctx.fs.serverTimestamp(),
        substituidaPor: usuario?.uid || "",
        versaoSubstituta: VERSION
      }, { merge: true });

      configAtual = nova;
      preencherFormularioConfig();
      if (status) status.textContent = "Configuração salva com sucesso.";

      let resultado = { atualizados: 0, ignorados: 0, aguardando: 0 };
      if (recalcular) resultado = await recalcularPendentes();

      avisar(
        recalcular
          ? `Configuração salva. ${resultado.atualizados} pagamento(s) recalculado(s), ${resultado.aguardando} aguardando informação/valor e ${resultado.ignorados} preservado(s).`
          : "Configuração salva. Novas chegadas já usarão estes valores.",
        "ok"
      );
    } catch (error) {
      console.error(error);
      avisar("Não foi possível salvar a configuração.", "erro");
      if (status) status.textContent = "Erro ao salvar.";
    } finally {
      if (botao) {
        botao.disabled = false;
        botao.textContent = "Salvar configuração";
      }
    }
  }

  function esconderConfigAntigaRevisao() {
    const form = document.getElementById("formConfigRev");
    if (!form) return;
    form.classList.add("hidden");
    form.hidden = true;
    form.style.setProperty("display", "none", "important");
    form.setAttribute("aria-hidden", "true");
    form.closest(".rev-grid")?.classList.add("sc51-sem-config-antiga");
  }

  async function carregarPrecos(force = false) {
    if (!force && precosCache.expiraEm > Date.now()) return precosCache.itens;
    const ctx = await firebase();
    const snap = await ctx.fs.getDocs(ctx.fs.collection(ctx.db, "precosReferencia"));
    precosCache = {
      expiraEm: Date.now() + 90_000,
      itens: snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        .filter(item => item.ativo !== false)
    };
    return precosCache.itens;
  }

  async function buscarPreco(processo, referencia) {
    const itens = await carregarPrecos();
    const p = normalizar(processo);
    const r = referenciaNormalizada(referencia);
    const candidatos = itens.filter(item =>
      normalizar(item.processo || item.servicoNome) === p &&
      referenciaNormalizada(item.referencia) === r
    );
    if (!candidatos.length) return null;
    const escolhido = candidatos.find(item => numero(item.valor) > 0) || candidatos[0];
    return { id: escolhido.id, valor: Math.max(0, numero(escolhido.valor)), dados: escolhido };
  }

  async function buscarOPPorNumero(numeroOP) {
    const api = window.CorpoNuRevisaoComponentes;
    if (typeof api?.buscarOP === "function") {
      const op = await api.buscarOP(numeroOP).catch(() => null);
      if (op) return op;
    }

    const ctx = await firebase();
    const textoOP = texto(numeroOP);
    if (!textoOP) return null;

    try {
      const direto = await ctx.fs.getDoc(ctx.fs.doc(ctx.db, "ordensProducao", textoOP));
      if (direto.exists()) return { id: direto.id, ...direto.data() };
    } catch (_) {}

    const consultas = [["numeroOP", textoOP], ["numeroOPExterno", textoOP]];
    const numeroOPNumerico = Number(textoOP);
    if (Number.isFinite(numeroOPNumerico)) consultas.splice(1, 0, ["numeroOP", numeroOPNumerico]);

    for (const [campo, valor] of consultas) {
      try {
        const snap = await ctx.fs.getDocs(ctx.fs.query(
          ctx.fs.collection(ctx.db, "ordensProducao"),
          ctx.fs.where(campo, "==", valor),
          ctx.fs.limit(1)
        ));
        if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
      } catch (_) {}
    }
    return null;
  }

  async function carregarMovimentacoesDaOP(op) {
    const ctx = await firebase();
    if (op?.id) {
      try {
        const snap = await ctx.fs.getDocs(ctx.fs.query(
          ctx.fs.collection(ctx.db, "movimentacoesProducao"),
          ctx.fs.where("opId", "==", op.id)
        ));
        return snap.docs.map(item => ({ id: item.id, ...item.data() }));
      } catch (error) {
        console.warn("Consulta de movimentações por opId indisponível.", error);
      }
    }

    const numeroOP = texto(op?.numeroOP || op?.numeroOPExterno);
    if (!numeroOP) return [];
    try {
      const snap = await ctx.fs.getDocs(ctx.fs.query(
        ctx.fs.collection(ctx.db, "movimentacoesProducao"),
        ctx.fs.where("numeroOP", "==", numeroOP)
      ));
      return snap.docs.map(item => ({ id: item.id, ...item.data() }));
    } catch (error) {
      console.warn("Consulta de movimentações por número da OP indisponível.", error);
      return [];
    }
  }

  function quantidadeRecebidaMov(mov) {
    const recebida = numero(mov?.quantidadeRecebida, NaN);
    if (Number.isFinite(recebida) && recebida >= 0) return recebida;
    return Math.max(numero(mov?.quantidadeEnviada) - numero(mov?.falta), 0);
  }

  function movimentoChegou(mov) {
    return Boolean(mov?.dataChegada) || ["RETORNOU", "FINALIZADO", "ENCAMINHADO"].includes(normalizar(mov?.status));
  }

  function informacaoManualComponente(op, componente) {
    const revisao = op?.revisaoComponentesConfeccao || {};
    const ativa = revisao.ativa === true;
    const chavePronto = componente === "lateral" ? "lateralFeita" : "bojoFeito";
    const topPronto = componente === "lateral"
      ? op?.lateralFeitaConfeccao
      : (op?.bojoEncapadoConfeccao ?? op?.bojoProntoConfeccao);

    const possuiCampo = Object.prototype.hasOwnProperty.call(revisao, chavePronto) ||
      topPronto === true || topPronto === false;

    if (!ativa && !possuiCampo) return { conhecido: false, pronto: false, origem: "", responsavel: "" };

    const pronto = revisao[chavePronto] === true || topPronto === true;
    const responsavel = componente === "lateral"
      ? texto(revisao.lateralFeitaPorNome || revisao.lateralResponsavel || op?.revisaoLateralFeitaPor)
      : texto(revisao.bojoFeitoPorNome || revisao.bojoResponsavel || op?.revisaoBojoFeitoPor);

    return {
      conhecido: true,
      pronto,
      descontar: pronto,
      feitoPelaFaccao: false,
      feitoPelaConfeccao: pronto,
      origemExecucao: pronto ? "confeccao" : "",
      origem: revisao.origemAtualizacao === "pagamento_manual" ? "Pagamento manual" : "Revisão manual",
      responsavel
    };
  }

  function informacaoConsolidadaSalva(op, componente) {
    const salvo = op?.componentesConsolidados?.[componente] || {};
    if (salvo.informado !== true && salvo.pronto !== true && salvo.pronto !== false) {
      return { conhecido: false, pronto: false, origem: "", responsavel: "", quantidade: 0 };
    }
    return {
      conhecido: salvo.informado === true || salvo.pronto === true || salvo.pronto === false,
      pronto: salvo.pronto === true,
      descontar: salvo.descontarNoSutiaCompleto === true ? true : salvo.descontarNoSutiaCompleto === false ? false : salvo.feitoPelaConfeccao === true ? true : salvo.feitoPelaFaccao === true ? false : salvo.pronto === true,
      feitoPelaFaccao: salvo.feitoPelaFaccao === true,
      feitoPelaConfeccao: salvo.feitoPelaConfeccao === true,
      origemExecucao: texto(salvo.origemExecucao || ""),
      origem: texto(salvo.origemLabel || salvo.origem || "Registro consolidado"),
      responsavel: texto(salvo.responsavel || salvo.quemFez),
      quantidade: Math.max(0, numero(salvo.quantidadePronta))
    };
  }

  async function obterContextoComponentes(op) {
    const movimentos = await carregarMovimentacoesDaOP(op);
    const totalOP = Math.max(0, numero(op?.quantidade || op?.quantidadeTotal));

    function componente(nome) {
      const processo = nome === "lateral" ? PROCESSO_LATERAL : PROCESSO_BOJO;
      const automaticos = movimentos.filter(mov =>
        movimentoChegou(mov) && processoCanonico(mov.processo || mov.servicoNome) === processo
      );
      const quantidadeAutomatica = automaticos.reduce((soma, mov) => soma + quantidadeRecebidaMov(mov), 0);
      const manual = informacaoManualComponente(op, nome);
      const salvo = informacaoConsolidadaSalva(op, nome);

      if (quantidadeAutomatica > 0) {
        const ultimo = automaticos.slice().sort((a, b) =>
          texto(b.dataChegada).localeCompare(texto(a.dataChegada))
        )[0];
        return {
          conhecido: true,
          pronto: true,
          descontar: true,
          feitoPelaFaccao: false,
          feitoPelaConfeccao: false,
          origemExecucao: "processo_anterior",
          origem: `Chegada de ${processo}`,
          responsavel: texto(ultimo?.destino),
          quantidade: totalOP > 0 ? Math.min(totalOP, quantidadeAutomatica) : quantidadeAutomatica,
          quantidadeTotal: totalOP,
          status: totalOP > 0 && quantidadeAutomatica < totalOP ? "parcial" : "completo",
          automaticos
        };
      }

      if (manual.conhecido) {
        return {
          ...manual,
          quantidade: manual.pronto ? totalOP : 0,
          quantidadeTotal: totalOP,
          status: manual.pronto ? "completo" : "nao_pronto",
          automaticos
        };
      }

      if (salvo.conhecido) {
        return {
          ...salvo,
          quantidadeTotal: totalOP,
          status: salvo.pronto ? "completo" : "nao_pronto",
          automaticos
        };
      }

      return {
        conhecido: false,
        pronto: false,
        origem: "",
        responsavel: "",
        quantidade: 0,
        quantidadeTotal: totalOP,
        status: "nao_informado",
        automaticos
      };
    }

    return {
      op,
      movimentos,
      totalOP,
      lateral: componente("lateral"),
      bojo: componente("bojo")
    };
  }

  function informacaoDefinitiva(info) {
    return info?.conhecido === true && info?.status !== "parcial";
  }

  async function salvarConsolidado(op, contexto) {
    if (!op?.id || !contexto) return;
    const ctx = await firebase();
    const usuario = ctx.auth.currentUser;

    const montar = (nome, info) => ({
      informado: info.conhecido === true,
      pronto: info.pronto === true,
      status: info.status || (info.pronto ? "completo" : "nao_pronto"),
      quantidadePronta: Math.max(0, numero(info.quantidade)),
      quantidadeTotal: Math.max(0, numero(contexto.totalOP)),
      descontarNoSutiaCompleto: info.descontar === true || (info.descontar !== false && info.pronto === true),
      feitoPelaFaccao: info.feitoPelaFaccao === true,
      feitoPelaConfeccao: info.feitoPelaConfeccao === true,
      origemExecucao: info.origemExecucao || "",
      origem: info.origem || "",
      origemLabel: info.origem || "",
      responsavel: info.responsavel || "",
      atualizadoPor: usuario?.uid || "",
      atualizadoEm: ctx.fs.serverTimestamp(),
      versao: VERSION
    });

    await ctx.fs.updateDoc(ctx.fs.doc(ctx.db, "ordensProducao", op.id), {
      "componentesConsolidados.lateral": montar("lateral", contexto.lateral),
      "componentesConsolidados.bojo": montar("bojo", contexto.bojo),
      componentesConsolidadosAtualizadoPor: usuario?.uid || "",
      componentesConsolidadosAtualizadoEm: ctx.fs.serverTimestamp()
    });
  }

  function valorBaseParaReferencia(referencia) {
    return referenciaNormalizada(referencia) === referenciaNormalizada(configAtual.referenciaEspecial)
      ? configAtual.valorBaseReferenciaEspecial
      : configAtual.valorBaseGeral;
  }

  function criarBlocoComponente(nome, info, prefixo) {
    const titulo = nome === "lateral" ? "Lateral" : "Bojo";
    const idSituacao = `${prefixo}${nome === "lateral" ? "LateralSituacao" : "BojoSituacao"}`;
    const idResponsavel = `${prefixo}${nome === "lateral" ? "LateralResponsavel" : "BojoResponsavel"}`;

    if (informacaoDefinitiva(info)) {
      return `
        <div class="sc51-componente" data-componente="${nome}" data-descontar="${info.descontar === true || (info.descontar !== false && info.pronto === true) ? "1" : "0"}" data-feito-faccao="${info.feitoPelaFaccao === true ? "1" : "0"}" data-feito-confeccao="${info.feitoPelaConfeccao === true ? "1" : "0"}" data-origem-execucao="${escapar(info.origemExecucao || "")}">
          <strong>${titulo}</strong>
          <span class="sc51-pill ${info.pronto ? "sim" : "nao"}">${info.pronto ? "Pronta" : "Não pronta"}</span>
          <small>${info.origem || "Informação registrada"}${info.responsavel ? ` • ${info.responsavel}` : ""}</small>
        </div>`;
    }

    const parcial = info?.status === "parcial";
    const detalheParcial = parcial
      ? `${numero(info.quantidade).toLocaleString("pt-BR")} de ${numero(info.quantidadeTotal || 0).toLocaleString("pt-BR")} peças registradas como prontas. Confirme esta chegada.`
      : "Nenhuma informação registrada na OP.";

    return `
      <div class="sc51-componente" data-componente="${nome}">
        <strong>${parcial ? `${titulo} parcialmente registrada` : `${titulo} sem informação`}</strong>
        <select id="${idSituacao}" required>
          <option value="">Informe a situação</option>
          <option value="faccao">${nome === "lateral" ? "Lateral feita pela facção" : "Bojo feito pela facção"}</option>
          <option value="confeccao">${nome === "lateral" ? "Lateral feita pela confecção" : "Bojo feito pela confecção"}</option>
          <option value="nao_informado">Não sei / não informado</option>
        </select>
        <input id="${idResponsavel}" type="text" maxlength="120" placeholder="Quem fez? (opcional)" value="${parcial ? escapar(info.responsavel || "") : ""}" disabled>
        <small>${detalheParcial} A escolha será usada neste cálculo${parcial ? "" : " e ficará registrada na OP"}.</small>
      </div>`;
  }

  function criarPainelChegada(prefixo, contexto) {
    const id = prefixo === "sc51" ? "sutCompletoComponentesChegada" : "sutCompletoComponentesChegadaManual";
    return `
      <div id="${id}" class="sc51-chegada">
        <h4>Conferência do Sutiã Completo</h4>
        <p>Confirme o que veio pronto. Fecho e ponto de luz só geram desconto quando não vieram feitos.</p>
        <div class="sc51-componentes">
          ${criarBlocoComponente("lateral", contexto.lateral, prefixo)}
          ${criarBlocoComponente("bojo", contexto.bojo, prefixo)}
        </div>
        <div class="sc51-opcoes-fixas">
          <label class="sc51-check">
            <input id="${prefixo}FechoPronto" type="checkbox">
            <span>Fecho veio pronto</span>
          </label>
          <label class="sc51-check">
            <input id="${prefixo}PontoLuzPronto" type="checkbox">
            <span>Ponto de luz veio pronto</span>
          </label>
        </div>
        <div id="${prefixo}ResumoCalculo" class="sc51-resumo">Carregando memória de cálculo...</div>
      </div>`;
  }

  function configurarCampoSituacao(prefixo, componente) {
    const nome = componente === "lateral" ? "Lateral" : "Bojo";
    const select = document.getElementById(`${prefixo}${nome}Situacao`);
    const input = document.getElementById(`${prefixo}${nome}Responsavel`);
    if (!select || !input || select.dataset.sc51 === "1") return;
    select.dataset.sc51 = "1";
    select.addEventListener("change", () => {
      const feitoPelaFaccao = select.value === "faccao";
      input.disabled = !feitoPelaFaccao;
      input.required = false;
      if (!feitoPelaFaccao) input.value = "";
      atualizarResumoChegada(prefixo);
    });
    input.addEventListener("input", () => atualizarResumoChegada(prefixo));
  }

  function dadosDoPainel(prefixo, contexto) {
    const ler = (nome, info) => {
      if (informacaoDefinitiva(info)) {
        return {
          conhecido: true,
          pronto: info.pronto,
          descontar: info.descontar === true || (info.descontar !== false && info.pronto === true),
          feitoPelaFaccao: info.feitoPelaFaccao === true,
          feitoPelaConfeccao: info.feitoPelaConfeccao === true,
          origemExecucao: info.origemExecucao || "",
          origem: info.origem,
          responsavel: info.responsavel
        };
      }
      const titulo = nome === "lateral" ? "Lateral" : "Bojo";
      const valor = texto(document.getElementById(`${prefixo}${titulo}Situacao`)?.value);
      return {
        conhecido: valor === "faccao" || valor === "confeccao" || valor === "nao_informado",
        pronto: valor === "faccao" || valor === "confeccao",
        descontar: valor === "confeccao",
        indefinido: valor === "nao_informado",
        feitoPelaFaccao: valor === "faccao",
        feitoPelaConfeccao: valor === "confeccao",
        origemExecucao: valor === "nao_informado" ? "nao_informado" : valor,
        origem: valor === "faccao" ? "Feito pela facção na chegada do Sutiã Completo" : valor === "confeccao" ? "Feito pela confecção" : "Origem ainda não informada",
        responsavel: texto(document.getElementById(`${prefixo}${titulo}Responsavel`)?.value)
      };
    };

    return {
      lateral: ler("lateral", contexto.lateral),
      bojo: ler("bojo", contexto.bojo),
      fechoPronto: document.getElementById(`${prefixo}FechoPronto`)?.checked === true,
      pontoLuzPronto: document.getElementById(`${prefixo}PontoLuzPronto`)?.checked === true
    };
  }

  async function calcularMemoria(referencia, contexto, dados) {
    const base = valorBaseParaReferencia(referencia);
    const precoLateral = dados.lateral.descontar ? await buscarPreco(PROCESSO_LATERAL, referencia) : null;
    const precoBojo = dados.bojo.descontar ? await buscarPreco(PROCESSO_BOJO, referencia) : null;
    const faltantes = [];

    if (dados.lateral.indefinido) faltantes.push("definição da LATERAL");
    else if (dados.lateral.descontar && !precoLateral) faltantes.push(`${PROCESSO_LATERAL} da referência ${referencia}`);
    if (dados.bojo.indefinido) faltantes.push("definição do BOJO");
    else if (dados.bojo.descontar && !precoBojo) faltantes.push(`${PROCESSO_BOJO} da referência ${referencia}`);

    const descontos = {
      lateral: dados.lateral.descontar && precoLateral ? arred4(precoLateral.valor) : 0,
      bojo: dados.bojo.descontar && precoBojo ? arred4(precoBojo.valor) : 0,
      fecho: dados.fechoPronto ? 0 : arred4(configAtual.descontoFechoNaoFeito),
      pontoLuz: dados.pontoLuzPronto ? 0 : arred4(configAtual.descontoPontoLuzNaoFeito)
    };

    const valorUnitario = arred4(Math.max(base - descontos.lateral - descontos.bojo - descontos.fecho - descontos.pontoLuz, 0));
    return { base, descontos, valorUnitario, faltantes, precoLateral, precoBojo };
  }

  async function atualizarResumoChegada(prefixo) {
    const atual = prefixo === "sc51" ? chegadaAtual : chegadaManualAtual;
    const resumo = document.getElementById(`${prefixo}ResumoCalculo`);
    if (!atual?.contexto || !resumo) return;

    const dados = dadosDoPainel(prefixo, atual.contexto);
    if (!dados.lateral.conhecido || !dados.bojo.conhecido) {
      resumo.textContent = "Informe lateral e bojo quando a OP ainda não possuir essa informação.";
      return;
    }

    try {
      const memoria = await calcularMemoria(atual.referencia, atual.contexto, dados);
      const partes = [
        `Base ${moeda4(memoria.base)}`,
        dados.lateral.indefinido ? "Lateral aguardando informação" : dados.lateral.descontar ? `Lateral − ${memoria.precoLateral ? moeda4(memoria.descontos.lateral) : "valor não cadastrado"}` : "Lateral sem desconto",
        dados.bojo.indefinido ? "Bojo aguardando informação" : dados.bojo.descontar ? `Bojo − ${memoria.precoBojo ? moeda4(memoria.descontos.bojo) : "valor não cadastrado"}` : "Bojo sem desconto",
        dados.fechoPronto ? "Fecho sem desconto" : `Fecho − ${moeda4(memoria.descontos.fecho)}`,
        dados.pontoLuzPronto ? "Ponto de luz sem desconto" : `Ponto de luz − ${moeda4(memoria.descontos.pontoLuz)}`
      ];
      resumo.textContent = memoria.faltantes.length
        ? `${partes.join(" • ")} • Pagamento ficará aguardando: ${memoria.faltantes.join(" e ")}.`
        : `${partes.join(" • ")} • Final por peça: ${moeda4(memoria.valorUnitario)}.`;
    } catch (error) {
      console.warn("Resumo do Sutiã Completo não calculado.", error);
      resumo.textContent = "Não foi possível carregar todos os valores agora. A chegada continuará protegida.";
    }
  }

  function instalarEventosPainel(prefixo) {
    configurarCampoSituacao(prefixo, "lateral");
    configurarCampoSituacao(prefixo, "bojo");
    [`${prefixo}FechoPronto`, `${prefixo}PontoLuzPronto`].forEach(id => {
      const input = document.getElementById(id);
      if (input && input.dataset.sc51 !== "1") {
        input.dataset.sc51 = "1";
        input.addEventListener("change", () => atualizarResumoChegada(prefixo));
      }
    });
  }

  async function prepararChegadaPadrao() {
    const id = texto(document.getElementById("chegadaMovimentacaoId")?.value);
    const modal = document.getElementById("modalChegadaMovimentacao");
    if (!id || !modal || modal.classList.contains("hidden")) return;
    if (chegadaAtual?.mov?.id === id && chegadaAtual?.contexto && document.getElementById("sutCompletoComponentesChegada")) return;
    if (preparandoChegadaPadraoId === id) return;

    preparandoChegadaPadraoId = id;
    try {
      const ctx = await firebase();
      const snap = await ctx.fs.getDoc(ctx.fs.doc(ctx.db, "movimentacoesProducao", id));
      if (!snap.exists()) return;
      const mov = { id: snap.id, ...snap.data() };
      const processo = processoCanonico(mov.processo);

      document.getElementById("sutCompletoComponentesChegada")?.remove();
      chegadaAtual = { mov, referencia: mov.referencia || "", contexto: null };

      if (processo !== PROCESSO_COMPLETO) return;

      await carregarConfig();
      const opSnap = mov.opId
        ? await ctx.fs.getDoc(ctx.fs.doc(ctx.db, "ordensProducao", mov.opId))
        : null;
      const op = opSnap?.exists()
        ? { id: opSnap.id, ...opSnap.data() }
        : await buscarOPPorNumero(mov.numeroOP);
      if (!op) throw new Error("OP da movimentação não encontrada.");

      const contexto = await obterContextoComponentes(op);
      chegadaAtual = { mov, op, referencia: mov.referencia || op.referencia || "", contexto };

      const grupoDefeito = document.getElementById("grupoChegadaDefeito");
      const container = document.createElement("div");
      container.innerHTML = criarPainelChegada("sc51", contexto);
      const painel = container.firstElementChild;

      if (grupoDefeito?.parentElement) grupoDefeito.insertAdjacentElement("afterend", painel);
      else document.getElementById("formChegadaMovimentacao")?.querySelector(".actions")?.insertAdjacentElement("beforebegin", painel);

      instalarEventosPainel("sc51");
      await atualizarResumoChegada("sc51");
    } finally {
      if (preparandoChegadaPadraoId === id) preparandoChegadaPadraoId = "";
    }
  }

  async function prepararChegadaManual() {
    const form = document.getElementById("formChegadaManualFaccao");
    if (!form || form.closest(".modal-backdrop")?.classList.contains("hidden")) return;

    const processo = processoCanonico(document.getElementById("chegadaManualProcesso")?.value);
    const numeroOP = texto(document.getElementById("chegadaManualOP")?.value);
    const chavePreparacao = `${processo}|${numeroOP}`;

    if (processo !== PROCESSO_COMPLETO) {
      document.getElementById("sutCompletoComponentesChegadaManual")?.remove();
      chegadaManualAtual = null;
      return;
    }
    if (!numeroOP) return;
    if (chegadaManualAtual?.numeroOP === numeroOP && chegadaManualAtual?.contexto && document.getElementById("sutCompletoComponentesChegadaManual")) return;
    if (preparandoChegadaManualChave === chavePreparacao) return;

    preparandoChegadaManualChave = chavePreparacao;
    try {
      document.getElementById("sutCompletoComponentesChegadaManual")?.remove();
      chegadaManualAtual = null;

      await carregarConfig();
      const op = await buscarOPPorNumero(numeroOP);
      if (!op) return;
      const contexto = await obterContextoComponentes(op);
      chegadaManualAtual = {
        op,
        numeroOP,
        referencia: texto(document.getElementById("chegadaManualRef")?.value || op.referencia),
        contexto
      };

      const container = document.createElement("div");
      container.innerHTML = criarPainelChegada("sc51m", contexto);
      const painel = container.firstElementChild;
      form.querySelector(".actions")?.insertAdjacentElement("beforebegin", painel);
      instalarEventosPainel("sc51m");
      await atualizarResumoChegada("sc51m");
    } finally {
      if (preparandoChegadaManualChave === chavePreparacao) preparandoChegadaManualChave = "";
    }
  }

  function validarDadosChegada(prefixo, atual) {
    if (!atual?.contexto) {
      avisar("Aguarde o carregamento das informações da OP antes de confirmar.", "erro");
      return null;
    }

    const dados = dadosDoPainel(prefixo, atual.contexto);
    if (!dados.lateral.conhecido) {
      document.getElementById(`${prefixo}LateralSituacao`)?.focus();
      avisar("Informe quem fez a lateral: facção ou confecção.", "erro");
      return null;
    }
    if (!dados.bojo.conhecido) {
      document.getElementById(`${prefixo}BojoSituacao`)?.focus();
      avisar("Informe quem fez o bojo: facção ou confecção.", "erro");
      return null;
    }

    return dados;
  }

  async function construirConfirmacao(atual, dados) {
    const memoria = await calcularMemoria(atual.referencia, atual.contexto, dados);
    return {
      memoria,
      texto: [
        `Confirmar a chegada de SUTIÃ COMPLETO da OP ${atual.mov?.numeroOP || atual.numeroOP || atual.op?.numeroOP || "-"}?`,
        "",
        `Valor-base: ${moeda4(memoria.base)}`,
        `Lateral: ${dados.lateral.indefinido ? "não informada — pagamento aguardará definição" : dados.lateral.descontar ? (memoria.precoLateral ? `feita pela confecção — desconto ${moeda4(memoria.descontos.lateral)}` : "feita pela confecção, mas sem valor cadastrado") : "feita pela facção — sem desconto"}`,
        `Bojo: ${dados.bojo.indefinido ? "não informado — pagamento aguardará definição" : dados.bojo.descontar ? (memoria.precoBojo ? `feito pela confecção — desconto ${moeda4(memoria.descontos.bojo)}` : "feito pela confecção, mas sem valor cadastrado") : "feito pela facção — sem desconto"}`,
        `Fecho: ${dados.fechoPronto ? "veio pronto — sem desconto" : `não feito — desconto ${moeda4(memoria.descontos.fecho)}`}`,
        `Ponto de luz: ${dados.pontoLuzPronto ? "veio pronto — sem desconto" : `não feito — desconto ${moeda4(memoria.descontos.pontoLuz)}`}`,
        "",
        memoria.faltantes.length
          ? `O pagamento ficará aguardando: ${memoria.faltantes.join(" e ")}.`
          : `Valor final por peça: ${moeda4(memoria.valorUnitario)}.`
      ].join("\n")
    };
  }

  async function registrarLog(acao, alvoId, detalhes) {
    try {
      const ctx = await firebase();
      const usuario = ctx.auth.currentUser;
      await ctx.fs.addDoc(ctx.fs.collection(ctx.db, "logsAlteracoes"), {
        acao,
        entidade: "movimentacaoProducao",
        entidadeId: alvoId || "",
        tipoAlvo: "movimentacaoProducao",
        alvoId: alvoId || "",
        detalhes,
        usuarioId: usuario?.uid || "",
        usuarioUid: usuario?.uid || "",
        usuarioEmail: usuario?.email || "",
        criadoPor: usuario?.uid || "",
        criadoEm: ctx.fs.serverTimestamp(),
        versao: VERSION
      });
    } catch (error) {
      console.warn("Log complementar do Sutiã Completo não criado.", error);
    }
  }

  async function esperarChegadaSalva(id, tentativas = 24) {
    const ctx = await firebase();
    for (let i = 0; i < tentativas; i += 1) {
      await esperar(i === 0 ? 500 : 350);
      const snap = await ctx.fs.getDoc(ctx.fs.doc(ctx.db, "movimentacoesProducao", id));
      if (snap.exists()) {
        const mov = { id: snap.id, ...snap.data() };
        if (mov.dataChegada || movimentoChegou(mov)) return mov;
      }
    }
    return null;
  }

  async function localizarChegadaManual(chave) {
    const ctx = await firebase();
    for (let tentativa = 0; tentativa < 22; tentativa += 1) {
      await esperar(tentativa === 0 ? 650 : 400);
      try {
        const snap = await ctx.fs.getDocs(ctx.fs.query(
          ctx.fs.collection(ctx.db, "movimentacoesProducao"),
          ctx.fs.where("numeroOP", "==", chave.numeroOP)
        ));
        const candidatos = snap.docs
          .map(item => ({ id: item.id, ...item.data() }))
          .filter(mov =>
            mov.origemManual === true &&
            processoCanonico(mov.processo) === chave.processo &&
            normalizar(mov.destino) === normalizar(chave.faccao) &&
            texto(mov.dataChegada) === chave.dataChegada
          )
          .sort((a, b) => {
            const ta = numero(a.criadoEm?.seconds) || numero(a.atualizadoEm?.seconds) || 0;
            const tb = numero(b.criadoEm?.seconds) || numero(b.atualizadoEm?.seconds) || 0;
            return tb - ta;
          });
        if (candidatos.length) return candidatos[0];
      } catch (error) {
        if (tentativa >= 21) throw error;
      }
    }
    return null;
  }

  async function atualizarMovimentacaoComConferencia(mov, dados, memoria) {
    const ctx = await firebase();
    const usuario = ctx.auth.currentUser;
    await ctx.fs.setDoc(ctx.fs.doc(ctx.db, "movimentacoesProducao", mov.id), {
      sutiaCompletoConferencia: {
        lateralPronta: dados.lateral.pronto,
        lateralDescontada: dados.lateral.descontar === true,
        lateralFeitaPelaFaccao: dados.lateral.feitoPelaFaccao === true,
        lateralFeitaPelaConfeccao: dados.lateral.feitoPelaConfeccao === true,
        lateralOrigemExecucao: dados.lateral.origemExecucao || "",
        lateralOrigem: dados.lateral.origem || "",
        lateralResponsavel: dados.lateral.responsavel || "",
        bojoPronto: dados.bojo.pronto,
        bojoDescontado: dados.bojo.descontar === true,
        bojoFeitoPelaFaccao: dados.bojo.feitoPelaFaccao === true,
        bojoFeitoPelaConfeccao: dados.bojo.feitoPelaConfeccao === true,
        bojoOrigemExecucao: dados.bojo.origemExecucao || "",
        bojoOrigem: dados.bojo.origem || "",
        bojoResponsavel: dados.bojo.responsavel || "",
        fechoPronto: dados.fechoPronto,
        pontoLuzPronto: dados.pontoLuzPronto,
        valorBase: memoria.base,
        descontoLateral: memoria.descontos.lateral,
        descontoBojo: memoria.descontos.bojo,
        descontoFecho: memoria.descontos.fecho,
        descontoPontoLuz: memoria.descontos.pontoLuz,
        valorUnitarioCalculado: memoria.valorUnitario,
        faltantes: memoria.faltantes,
        confirmadoPor: usuario?.uid || "",
        confirmadoEm: ctx.fs.serverTimestamp(),
        versao: VERSION
      },
      fechoVeioPronto: dados.fechoPronto,
      pontoLuzVeioPronto: dados.pontoLuzPronto,
      lateralProntaSutiaCompleto: dados.lateral.pronto,
      bojoProntoSutiaCompleto: dados.bojo.pronto,
      atualizadoPor: usuario?.uid || "",
      atualizadoEm: ctx.fs.serverTimestamp()
    }, { merge: true });
  }

  async function registrarEscolhasNaOP(op, contexto, dados) {
    if (!op?.id) return;
    const ctx = await firebase();
    const usuario = ctx.auth.currentUser;
    const atualizacoes = {};
    const agora = ctx.fs.serverTimestamp();

    function incluir(nome, original, novo) {
      if (original.conhecido || novo.indefinido === true) return;
      atualizacoes[`componentesConsolidados.${nome}`] = {
        informado: true,
        pronto: novo.pronto,
        status: novo.pronto ? "completo" : "nao_pronto",
        quantidadePronta: novo.pronto ? Math.max(0, numero(contexto.totalOP)) : 0,
        descontarNoSutiaCompleto: novo.descontar === true,
        feitoPelaFaccao: novo.feitoPelaFaccao === true,
        feitoPelaConfeccao: novo.feitoPelaConfeccao === true,
        origemExecucao: novo.origemExecucao || "",
        quantidadeTotal: Math.max(0, numero(contexto.totalOP)),
        origem: "chegada_sutia_completo",
        origemLabel: "Informado na chegada do Sutiã Completo",
        responsavel: novo.responsavel || "",
        atualizadoPor: usuario?.uid || "",
        atualizadoEm: agora,
        versao: VERSION
      };
    }

    incluir("lateral", contexto.lateral, dados.lateral);
    incluir("bojo", contexto.bojo, dados.bojo);

    if (!Object.keys(atualizacoes).length) return;
    atualizacoes.componentesConsolidadosAtualizadoPor = usuario?.uid || "";
    atualizacoes.componentesConsolidadosAtualizadoEm = agora;
    await ctx.fs.updateDoc(ctx.fs.doc(ctx.db, "ordensProducao", op.id), atualizacoes);
  }

  function statusImutavel(pagamento) {
    const status = normalizar(pagamento?.statusPagamento);
    return pagamento?.excluido === true || ["PAGO", "CANCELADO", "EXCLUIDO"].includes(status);
  }

  async function pagamentosDaMovimentacao(movimentacaoId, tentativas = 18) {
    const ctx = await firebase();
    for (let tentativa = 0; tentativa < tentativas; tentativa += 1) {
      if (tentativa > 0) await esperar(300);
      const snap = await ctx.fs.getDocs(ctx.fs.query(
        ctx.fs.collection(ctx.db, "entregasPagamento"),
        ctx.fs.where("movimentacaoId", "==", movimentacaoId)
      ));
      if (!snap.empty) return snap.docs.map(item => ({ id: item.id, ...item.data() }));
    }
    return [];
  }

  async function aplicarCalculoAoPagamento(mov, dados, memoria) {
    const pagamentos = await pagamentosDaMovimentacao(mov.id);
    const editaveis = pagamentos.filter(item => !statusImutavel(item));
    if (!editaveis.length) return { atualizados: 0, pagosPreservados: pagamentos.length };

    const quantidade = Math.max(0, quantidadeRecebidaMov(mov));
    const descontoDefeito = Math.max(0, numero(mov.descontoDefeito ?? mov.defeito));
    const subtotalCalculado = arred2(quantidade * memoria.valorUnitario);
    const totalCalculado = arred2(Math.max(subtotalCalculado - descontoDefeito, 0));
    const faltando = memoria.faltantes.length > 0;
    const ctx = await firebase();
    const usuario = ctx.auth.currentUser;

    const alvo = editaveis.find(item => texto(item.precoReferenciaId)) || editaveis[0];
    const patch = {
      processo: PROCESSO_COMPLETO,
      processoMovimentacao: PROCESSO_COMPLETO,
      servicoNome: PROCESSO_COMPLETO,
      valorBaseSutiaCompleto: arred4(memoria.base),
      descontoSutiaCompletoLateral: arred4(memoria.descontos.lateral),
      descontoSutiaCompletoBojo: arred4(memoria.descontos.bojo),
      descontoSutiaCompletoFecho: arred4(memoria.descontos.fecho),
      descontoSutiaCompletoPontoLuz: arred4(memoria.descontos.pontoLuz),
      precoLateralReferenciaId: memoria.precoLateral?.id || "",
      precoBojoReferenciaId: memoria.precoBojo?.id || "",
      lateralPronta: dados.lateral.pronto,
      lateralDescontada: dados.lateral.descontar === true,
      lateralFeitaPelaFaccao: dados.lateral.feitoPelaFaccao === true,
      lateralFeitaPelaConfeccao: dados.lateral.feitoPelaConfeccao === true,
      lateralOrigemExecucao: dados.lateral.origemExecucao || "",
      lateralOrigem: dados.lateral.origem || "",
      lateralResponsavel: dados.lateral.responsavel || "",
      bojoPronto: dados.bojo.pronto,
      bojoDescontado: dados.bojo.descontar === true,
      bojoFeitoPelaFaccao: dados.bojo.feitoPelaFaccao === true,
      bojoFeitoPelaConfeccao: dados.bojo.feitoPelaConfeccao === true,
      bojoOrigemExecucao: dados.bojo.origemExecucao || "",
      bojoOrigem: dados.bojo.origem || "",
      bojoResponsavel: dados.bojo.responsavel || "",
      fechoPronto: dados.fechoPronto,
      pontoLuzPronto: dados.pontoLuzPronto,
      quantidade,
      falta: Math.max(0, numero(mov.falta)),
      descontoDefeito,
      valorUnitario: faltando ? 0 : arred4(memoria.valorUnitario),
      subtotal: faltando ? 0 : subtotalCalculado,
      total: faltando ? 0 : totalCalculado,
      valorUnitarioCalculadoSutiaCompleto: arred4(memoria.valorUnitario),
      subtotalCalculadoSutiaCompleto: subtotalCalculado,
      totalCalculadoSutiaCompleto: totalCalculado,
      valorTotalDefinidoManualmente: !faltando,
      valorManualFinanceiro: false,
      formaValorPagamento: "CALCULO_AUTOMATICO_SUTIA_COMPLETO",
      statusPagamento: faltando ? "sem_valor" : "pendente",
      valorPendente: faltando,
      avisoPagamento: faltando
        ? `Aguardando ${memoria.faltantes.join(" e ")}.`
        : "",
      memoriaCalculoSutiaCompleto: {
        referencia: mov.referencia || "",
        valorBase: arred4(memoria.base),
        lateralPronta: dados.lateral.pronto,
        descontoLateral: arred4(memoria.descontos.lateral),
        bojoPronto: dados.bojo.pronto,
        descontoBojo: arred4(memoria.descontos.bojo),
        fechoPronto: dados.fechoPronto,
        descontoFecho: arred4(memoria.descontos.fecho),
        pontoLuzPronto: dados.pontoLuzPronto,
        descontoPontoLuz: arred4(memoria.descontos.pontoLuz),
        valorUnitarioFinal: arred4(memoria.valorUnitario),
        quantidade,
        descontoDefeito,
        totalFinal: totalCalculado,
        faltantes: memoria.faltantes,
        versao: VERSION
      },
      observacoes: faltando
        ? `Cálculo automático aguardando valor. ${memoria.faltantes.join(" | ")}.`
        : `Cálculo automático do Sutiã Completo: base ${moeda4(memoria.base)}, valor final ${moeda4(memoria.valorUnitario)} por peça.`,
      calculoSutiaCompletoVersao: VERSION,
      calculoSutiaCompletoAtualizadoPor: usuario?.uid || "",
      calculoSutiaCompletoAtualizadoEm: ctx.fs.serverTimestamp(),
      atualizadoPor: usuario?.uid || "",
      atualizadoEm: ctx.fs.serverTimestamp()
    };

    await ctx.fs.setDoc(ctx.fs.doc(ctx.db, "entregasPagamento", alvo.id), patch, { merge: true });
    return { atualizados: 1, faltando, total: totalCalculado };
  }

  async function processarChegadaCompleto(mov, dados, opInformada = null) {
    if (!mov?.id || processando.has(`completo:${mov.id}`)) return;
    processando.add(`completo:${mov.id}`);

    try {
      await carregarConfig();
      const op = opInformada || (mov.opId
        ? await (async () => {
          const ctx = await firebase();
          const snap = await ctx.fs.getDoc(ctx.fs.doc(ctx.db, "ordensProducao", mov.opId));
          return snap.exists() ? { id: snap.id, ...snap.data() } : null;
        })()
        : await buscarOPPorNumero(mov.numeroOP));

      if (!op) throw new Error("OP não localizada para concluir o cálculo.");
      const contexto = await obterContextoComponentes(op);
      const dadosFinais = {
        lateral: informacaoDefinitiva(contexto.lateral)
          ? { conhecido: true, pronto: contexto.lateral.pronto, descontar: contexto.lateral.descontar === true || (contexto.lateral.descontar !== false && contexto.lateral.pronto === true), feitoPelaFaccao: contexto.lateral.feitoPelaFaccao === true, feitoPelaConfeccao: contexto.lateral.feitoPelaConfeccao === true, origemExecucao: contexto.lateral.origemExecucao || "", origem: contexto.lateral.origem, responsavel: contexto.lateral.responsavel }
          : dados.lateral,
        bojo: informacaoDefinitiva(contexto.bojo)
          ? { conhecido: true, pronto: contexto.bojo.pronto, descontar: contexto.bojo.descontar === true || (contexto.bojo.descontar !== false && contexto.bojo.pronto === true), feitoPelaFaccao: contexto.bojo.feitoPelaFaccao === true, feitoPelaConfeccao: contexto.bojo.feitoPelaConfeccao === true, origemExecucao: contexto.bojo.origemExecucao || "", origem: contexto.bojo.origem, responsavel: contexto.bojo.responsavel }
          : dados.bojo,
        fechoPronto: dados.fechoPronto,
        pontoLuzPronto: dados.pontoLuzPronto
      };

      await salvarConsolidado(op, contexto).catch(error => {
        console.warn("Status consolidado da OP não foi salvo antes do cálculo.", error);
      });

      const memoria = await calcularMemoria(mov.referencia || op.referencia, contexto, dadosFinais);
      await atualizarMovimentacaoComConferencia(mov, dadosFinais, memoria).catch(error => {
        console.warn("Conferência não foi gravada na movimentação, mas o pagamento continuará.", error);
      });
      await registrarEscolhasNaOP(op, contexto, dadosFinais).catch(error => {
        console.warn("Escolhas da chegada não foram gravadas na OP, mas o pagamento continuará.", error);
      });
      const resultado = await aplicarCalculoAoPagamento(mov, dadosFinais, memoria);

      await registrarLog(
        "calculo_sutia_completo_aplicado",
        mov.id,
        `OP ${mov.numeroOP || op.numeroOP || "-"} | base ${moeda4(memoria.base)} | lateral ${dadosFinais.lateral.descontar ? moeda4(memoria.descontos.lateral) : "sem desconto"} | bojo ${dadosFinais.bojo.descontar ? moeda4(memoria.descontos.bojo) : "sem desconto"} | fecho ${dadosFinais.fechoPronto ? "pronto" : `-${moeda4(memoria.descontos.fecho)}`} | ponto de luz ${dadosFinais.pontoLuzPronto ? "pronto" : `-${moeda4(memoria.descontos.pontoLuz)}`}`
      );

      if (resultado?.faltando) {
        avisar(`Chegada salva. O pagamento ficou aguardando ${memoria.faltantes.join(" e ")}.`, "info");
      } else if (resultado?.atualizados) {
        avisar(`Pagamento do Sutiã Completo calculado automaticamente: ${moeda2(resultado.total)}.`, "ok");
      }
    } catch (error) {
      console.error("Falha no cálculo automático do Sutiã Completo.", error);
      avisar("A chegada foi preservada, mas o cálculo automático precisa ser conferido em Pagamentos.", "erro");
    } finally {
      processando.delete(`completo:${mov.id}`);
    }
  }

  async function sincronizarComponenteAutomatico(mov) {
    const processo = processoCanonico(mov?.processo);
    if (![PROCESSO_LATERAL, PROCESSO_BOJO].includes(processo) || !movimentoChegou(mov)) return;
    if (!mov?.opId && !mov?.numeroOP) return;

    const chave = `status:${mov.id}`;
    if (processando.has(chave)) return;
    processando.add(chave);
    try {
      const op = mov.opId
        ? await (async () => {
          const ctx = await firebase();
          const snap = await ctx.fs.getDoc(ctx.fs.doc(ctx.db, "ordensProducao", mov.opId));
          return snap.exists() ? { id: snap.id, ...snap.data() } : null;
        })()
        : await buscarOPPorNumero(mov.numeroOP);
      if (!op) return;

      const contexto = await obterContextoComponentes(op);
      await salvarConsolidado(op, contexto);
      await registrarLog(
        processo === PROCESSO_LATERAL ? "status_lateral_automatico" : "status_bojo_automatico",
        mov.id,
        `OP ${mov.numeroOP || op.numeroOP || "-"} | ${processo} recebido | ${quantidadeRecebidaMov(mov)} peças`
      );
    } catch (error) {
      console.warn("Status automático de lateral/bojo não sincronizado.", error);
    } finally {
      processando.delete(chave);
    }
  }

  async function processarDepoisChegadaPadrao(id, dados) {
    const mov = await esperarChegadaSalva(id);
    if (!mov) return;
    const processo = processoCanonico(mov.processo);
    if (processo === PROCESSO_COMPLETO) await processarChegadaCompleto(mov, dados);
    else if ([PROCESSO_LATERAL, PROCESSO_BOJO].includes(processo)) await sincronizarComponenteAutomatico(mov);
  }

  async function processarDepoisChegadaManual(chave, dados) {
    const mov = await localizarChegadaManual(chave);
    if (!mov) return;
    if (chave.processo === PROCESSO_COMPLETO) await processarChegadaCompleto(mov, dados, chegadaManualAtual?.op || null);
    else if ([PROCESSO_LATERAL, PROCESSO_BOJO].includes(chave.processo)) await sincronizarComponenteAutomatico(mov);
  }

  async function aoSubmitChegadaPadrao(event) {
    const form = event.currentTarget;
    const submitter = event.submitter;
    const id = texto(document.getElementById("chegadaMovimentacaoId")?.value);
    const atual = chegadaAtual;
    const processo = processoCanonico(atual?.mov?.processo);

    if (!id || !atual?.mov || !(form instanceof HTMLFormElement)) return;

    if (processo !== PROCESSO_COMPLETO) {
      if ([PROCESSO_LATERAL, PROCESSO_BOJO].includes(processo)) {
        window.setTimeout(() => processarDepoisChegadaPadrao(id, null), 0);
      }
      return;
    }

    const dados = validarDadosChegada("sc51", atual);
    if (!dados) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      const confirmacao = await construirConfirmacao(atual, dados);
      if (!window.confirm(confirmacao.texto)) return;

      form.removeEventListener("submit", aoSubmitChegadaPadrao, true);
      window.setTimeout(() => {
        form.addEventListener("submit", aoSubmitChegadaPadrao, true);
      }, 0);

      if (submitter instanceof HTMLElement) form.requestSubmit(submitter);
      else form.requestSubmit();
      window.setTimeout(() => processarDepoisChegadaPadrao(id, dados), 0);
    } catch (error) {
      console.error(error);
      avisar("Não foi possível preparar a memória de cálculo. Tente novamente.", "erro");
    }
  }

  async function aoSubmitChegadaManual(event) {
    const form = event.currentTarget;
    const submitter = event.submitter;
    const processo = processoCanonico(document.getElementById("chegadaManualProcesso")?.value);
    const numeroOP = texto(document.getElementById("chegadaManualOP")?.value);
    const faccao = texto(document.getElementById("chegadaManualFaccao")?.value);
    const dataChegada = texto(document.getElementById("chegadaManualDataChegada")?.value);

    if (![PROCESSO_COMPLETO, PROCESSO_LATERAL, PROCESSO_BOJO].includes(processo)) return;
    if (!(form instanceof HTMLFormElement)) return;

    let dados = null;
    if (processo === PROCESSO_COMPLETO) {
      dados = validarDadosChegada("sc51m", chegadaManualAtual);
      if (!dados) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      try {
        const confirmacao = await construirConfirmacao(
          { ...chegadaManualAtual, numeroOP },
          dados
        );
        if (!window.confirm(confirmacao.texto)) return;

        form.removeEventListener("submit", aoSubmitChegadaManual, true);
        window.setTimeout(() => form.addEventListener("submit", aoSubmitChegadaManual, true), 0);
        if (submitter instanceof HTMLElement) form.requestSubmit(submitter);
        else form.requestSubmit();
      } catch (error) {
        console.error(error);
        avisar("Não foi possível preparar a memória de cálculo.", "erro");
        return;
      }
    }

    const chave = { numeroOP, processo, faccao, dataChegada };
    window.setTimeout(() => processarDepoisChegadaManual(chave, dados), 0);
  }

  async function recalcularPagamentoExistente(pagamento) {
    if (statusImutavel(pagamento)) return { tipo: "ignorado" };
    if (processoCanonico(pagamento.processo || pagamento.servicoNome || pagamento.processoMovimentacao) !== PROCESSO_COMPLETO) {
      return { tipo: "ignorado" };
    }
    if (!pagamento.movimentacaoId) return { tipo: "ignorado" };

    const ctx = await firebase();
    const movSnap = await ctx.fs.getDoc(ctx.fs.doc(ctx.db, "movimentacoesProducao", pagamento.movimentacaoId));
    if (!movSnap.exists()) return { tipo: "ignorado" };
    const mov = { id: movSnap.id, ...movSnap.data() };
    const conferencia = mov.sutiaCompletoConferencia || {};

    if (typeof conferencia.fechoPronto !== "boolean" || typeof conferencia.pontoLuzPronto !== "boolean") {
      return { tipo: "aguardando" };
    }

    const op = mov.opId
      ? await (async () => {
        const opSnap = await ctx.fs.getDoc(ctx.fs.doc(ctx.db, "ordensProducao", mov.opId));
        return opSnap.exists() ? { id: opSnap.id, ...opSnap.data() } : null;
      })()
      : await buscarOPPorNumero(mov.numeroOP);
    if (!op) return { tipo: "aguardando" };

    const contexto = await obterContextoComponentes(op);
    const dados = {
      lateral: {
        conhecido: true,
        pronto: typeof conferencia.lateralPronta === "boolean" ? conferencia.lateralPronta : contexto.lateral.pronto,
        origem: conferencia.lateralOrigem || contexto.lateral.origem,
        responsavel: conferencia.lateralResponsavel || contexto.lateral.responsavel
      },
      bojo: {
        conhecido: true,
        pronto: typeof conferencia.bojoPronto === "boolean" ? conferencia.bojoPronto : contexto.bojo.pronto,
        origem: conferencia.bojoOrigem || contexto.bojo.origem,
        responsavel: conferencia.bojoResponsavel || contexto.bojo.responsavel
      },
      fechoPronto: conferencia.fechoPronto,
      pontoLuzPronto: conferencia.pontoLuzPronto
    };
    const memoria = await calcularMemoria(mov.referencia || pagamento.referencia, contexto, dados);
    const resultado = await aplicarCalculoAoPagamento(mov, dados, memoria);
    return { tipo: memoria.faltantes.length ? "aguardando" : (resultado.atualizados ? "atualizado" : "ignorado") };
  }

  async function recalcularPendentes() {
    await carregarConfig();
    precosCache.expiraEm = 0;
    await carregarPrecos(true);

    const ctx = await firebase();
    const snap = await ctx.fs.getDocs(ctx.fs.collection(ctx.db, "entregasPagamento"));
    const pagamentos = snap.docs.map(item => ({ id: item.id, ...item.data() }));
    const resultado = { atualizados: 0, ignorados: 0, aguardando: 0 };

    for (const pagamento of pagamentos) {
      try {
        const item = await recalcularPagamentoExistente(pagamento);
        if (item.tipo === "atualizado") resultado.atualizados += 1;
        else if (item.tipo === "aguardando") resultado.aguardando += 1;
        else resultado.ignorados += 1;
      } catch (error) {
        console.warn("Pagamento não recalculado.", pagamento.id, error);
        resultado.aguardando += 1;
      }
    }
    return resultado;
  }

  async function recalcularPendentesDaOP(op) {
    if (!op?.id) return;
    const ctx = await firebase();
    let snap;
    try {
      snap = await ctx.fs.getDocs(ctx.fs.query(
        ctx.fs.collection(ctx.db, "entregasPagamento"),
        ctx.fs.where("opId", "==", op.id)
      ));
    } catch (error) {
      console.warn("Pagamentos da OP não consultados.", error);
      return;
    }

    for (const docSnap of snap.docs) {
      const pagamento = { id: docSnap.id, ...docSnap.data() };
      if (processoCanonico(pagamento.processo || pagamento.servicoNome || pagamento.processoMovimentacao) !== PROCESSO_COMPLETO) continue;
      await recalcularPagamentoExistente(pagamento).catch(error => console.warn("Pagamento da OP não atualizado.", error));
    }
  }

  async function aposRevisaoManual() {
    const numeroOP = texto(document.getElementById("revNumeroOP")?.value);
    if (!numeroOP) return;
    for (let tentativa = 0; tentativa < 8; tentativa += 1) {
      await esperar(tentativa === 0 ? 800 : 450);
      const op = await buscarOPPorNumero(numeroOP).catch(() => null);
      if (!op) continue;
      try {
        const contexto = await obterContextoComponentes(op);
        await salvarConsolidado(op, contexto);
        await recalcularPendentesDaOP(op);
      } catch (error) {
        if (tentativa >= 7) console.warn("Revisão manual não consolidada.", error);
        continue;
      }
      return;
    }
  }

  function instalarEventosFormularios() {
    const formChegada = document.getElementById("formChegadaMovimentacao");
    if (formChegada && formChegada.dataset.sc51 !== "1") {
      formChegada.dataset.sc51 = "1";
      formChegada.addEventListener("submit", aoSubmitChegadaPadrao, true);
    }

    const formManual = document.getElementById("formChegadaManualFaccao");
    if (formManual && formManual.dataset.sc51 !== "1") {
      formManual.dataset.sc51 = "1";
      formManual.addEventListener("submit", aoSubmitChegadaManual, true);
    }

    const formRevisao = document.getElementById("formRevisaoComponentes");
    if (formRevisao && formRevisao.dataset.sc51 !== "1") {
      formRevisao.dataset.sc51 = "1";
      formRevisao.addEventListener("submit", () => {
        window.setTimeout(aposRevisaoManual, 0);
      }, true);
    }
  }

  function prepararEventosGlobais() {
    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (!alvo) return;

      if (alvo.closest('[onclick*="registrarChegadaMovimentacao"]')) {
        [100, 350, 800].forEach(ms => window.setTimeout(() => {
          prepararChegadaPadrao().catch(error => {
            console.warn("Chegada do Sutiã Completo não preparada.", error);
          });
        }, ms));
      }

      if (alvo.closest("#btnAbrirChegadaManualFaccao")) {
        [100, 350, 750].forEach(ms => window.setTimeout(() => {
          instalarEventosFormularios();
          prepararChegadaManual().catch(() => {});
        }, ms));
      }

      if (alvo.closest('[data-page="processos"]')) {
        [0, 250, 800].forEach(ms => window.setTimeout(() => {
          injetarConfigProcessos().catch(() => {});
        }, ms));
      }

      if (alvo.closest('[data-page="revisao-componentes"]')) {
        [100, 400, 1000].forEach(ms => window.setTimeout(() => {
          esconderConfigAntigaRevisao();
          instalarEventosFormularios();
        }, ms));
      }
    }, true);

    document.addEventListener("change", event => {
      if (event.target?.id === "chegadaManualProcesso") {
        window.setTimeout(() => prepararChegadaManual().catch(() => {}), 0);
      }
    }, true);

    let timerOPManual;
    document.addEventListener("input", event => {
      if (event.target?.id !== "chegadaManualOP") return;
      window.clearTimeout(timerOPManual);
      timerOPManual = window.setTimeout(() => prepararChegadaManual().catch(() => {}), 450);
    }, true);
  }

  function iniciar() {
    injetarEstilos();
    prepararEventosGlobais();
    instalarEventosFormularios();
    esconderConfigAntigaRevisao();

    let tentativas = 0;
    const intervalo = window.setInterval(() => {
      tentativas += 1;
      instalarEventosFormularios();
      esconderConfigAntigaRevisao();
      injetarConfigProcessos().catch(() => {});
      if (tentativas >= 30) window.clearInterval(intervalo);
    }, 500);

    window.addEventListener("pageshow", () => {
      esconderConfigAntigaRevisao();
      instalarEventosFormularios();
    });
  }

  window.CorpoNuSutiaCompleto = {
    versao: VERSION,
    carregarConfig,
    recalcularPendentes,
    atualizarStatusOP: async numeroOP => {
      const op = await buscarOPPorNumero(numeroOP);
      if (!op) return false;
      const contexto = await obterContextoComponentes(op);
      await salvarConsolidado(op, contexto);
      return true;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();