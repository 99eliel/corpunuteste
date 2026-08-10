(() => {
  "use strict";

  const VERSION = "2026-08-10-alca-recalculo-pendentes-163";
  const FIREBASE_VERSION = "10.12.5";
  const VALOR_ALCA = 0.0540;
  const ALCAS_POR_SUTIA = 2;
  const VALOR_POR_SUTIA = 0.1080;
  const MARCADOR_ID = "migracao-alca-pendentes-00540-163";
  const PRECO_ID = "valor-padrao-alca";
  const ALIASES_ALCA = ["ALÇA", "ALCA", "ALÇAS", "ALCAS"];

  if (window.__CORPONU_ALCA_RECALCULO_PENDENTES_163__ === VERSION) return;
  window.__CORPONU_ALCA_RECALCULO_PENDENTES_163__ = VERSION;

  let contextoPromise = null;
  let executando = false;

  const texto = valor => String(valor ?? "").trim();
  const normalizar = valor => texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  function numero(valor) {
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
    const bruto = texto(valor).replace(/R\$/gi, "").replace(/\s+/g, "");
    if (!bruto) return 0;
    const ajustado = bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto;
    const resultado = Number(ajustado.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(resultado) ? resultado : 0;
  }

  const arredondar4 = valor => Math.round((Number(valor || 0) + Number.EPSILON) * 10000) / 10000;
  const moeda4 = valor => `R$ ${Number(valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;

  function ehAlca(item) {
    const processo = normalizar(item?.processo || item?.servicoNome || item?.processoMovimentacao || "");
    return processo === "ALCA" || processo === "ALCAS";
  }

  function estaPendente(item) {
    if (!ehAlca(item)) return false;
    if (item?.pago === true || item?.quitado === true || item?.cancelado === true || item?.excluido === true) return false;
    const status = normalizar(item?.statusPagamento || item?.statusFinanceiro || item?.status || "PENDENTE");
    return !["PAGO", "PAGA", "QUITADO", "QUITADA", "CONFIRMADO", "CONFIRMADA", "CANCELADO", "CANCELADA", "EXCLUIDO", "EXCLUIDA", "ESTORNADO", "ESTORNADA"].includes(status);
  }

  function quantidadeSutias(item) {
    const valor = numero(item?.quantidade ?? item?.quantidadeRecebida ?? item?.quantidadeEnviada ?? item?.quantidadeSutias ?? item?.qtd);
    if (valor > 0) return valor;
    const alcas = numero(item?.quantidadeAlcas);
    return alcas > 0 ? alcas / ALCAS_POR_SUTIA : 0;
  }

  function descontoDefeito(item) {
    return Math.max(0, numero(item?.descontoDefeito ?? item?.descontoPorDefeito ?? item?.defeito ?? 0));
  }

  async function contexto() {
    if (contextoPromise) return contextoPromise;
    contextoPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
    ]).then(([appModulo, authModulo, firestore]) => {
      const app = appModulo.getApp();
      return { firestore, db: firestore.getFirestore(app), auth: authModulo.getAuth(app) };
    });
    return contextoPromise;
  }

  async function usuarioAdmin(firestore, db, auth) {
    for (let i = 0; i < 30 && !auth.currentUser; i += 1) await new Promise(r => setTimeout(r, 100));
    const usuario = auth.currentUser;
    if (!usuario) throw new Error("Usuário não autenticado.");
    const perfilSnap = await firestore.getDoc(firestore.doc(db, "usuarios", usuario.uid));
    const perfil = perfilSnap.exists() ? perfilSnap.data() : {};
    if (perfil.ativo === false || !normalizar(perfil.tipo || perfil.perfil || perfil.role).includes("ADMIN")) {
      throw new Error("Somente administrador pode executar este recalculo.");
    }
    return usuario;
  }

  function toast(mensagem, erro = false) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = mensagem;
    el.classList.remove("hidden");
    el.style.background = erro ? "#991b1b" : "#166534";
    clearTimeout(window.__alca163Toast);
    window.__alca163Toast = setTimeout(() => { el.classList.add("hidden"); el.style.removeProperty("background"); }, erro ? 7000 : 5000);
  }

  async function consultarAlca(firestore, db) {
    const col = firestore.collection(db, "entregasPagamento");
    const consultas = [
      firestore.query(col, firestore.where("setor", "==", "alca")),
      firestore.query(col, firestore.where("processo", "in", ALIASES_ALCA)),
      firestore.query(col, firestore.where("servicoNome", "in", ALIASES_ALCA)),
      firestore.query(col, firestore.where("processoMovimentacao", "in", ALIASES_ALCA))
    ];
    const resultados = await Promise.allSettled(consultas.map(q => firestore.getDocs(q)));
    const mapa = new Map();
    resultados.forEach(resultado => {
      if (resultado.status !== "fulfilled") return;
      resultado.value.docs.forEach(docSnap => {
        const dados = docSnap.data() || {};
        if (ehAlca(dados)) mapa.set(docSnap.id, { ref: docSnap.ref, dados });
      });
    });
    return [...mapa.values()];
  }

  function patch(item, usuarioUid, timestamp) {
    const quantidade = quantidadeSutias(item);
    const quantidadeAlcas = arredondar4(quantidade * ALCAS_POR_SUTIA);
    const desconto = descontoDefeito(item);
    const subtotal = arredondar4(quantidade * VALOR_POR_SUTIA);
    const total = arredondar4(Math.max(subtotal - desconto, 0));
    return {
      precoReferenciaId: PRECO_ID,
      servicoId: PRECO_ID,
      processo: "ALÇA",
      processoMovimentacao: "ALÇA",
      servicoNome: "ALÇA",
      setor: "alca",
      setorLabel: "Alça",
      quantidade,
      quantidadeAlcas,
      multiplicadorAlcas: ALCAS_POR_SUTIA,
      valorUnitarioAlca: VALOR_ALCA,
      valorUnitario: VALOR_POR_SUTIA,
      subtotal,
      descontoDefeito: desconto,
      total,
      statusPagamento: "pendente",
      statusFinanceiro: "pendente",
      valorPendente: false,
      valorManualFinanceiroPendente: false,
      formaValorPagamento: "valor_global_alca",
      calculoAlca: "quantidade_sutias_x_2_x_valor_alca",
      origemRecalculoAlca: VERSION,
      atualizadoPor: usuarioUid,
      atualizadoEm: timestamp,
      versaoValorAlca: VERSION
    };
  }

  async function executar(botao) {
    if (executando) return;
    executando = true;
    const original = botao?.textContent || "Recalcular pendentes de ALÇA";
    if (botao) { botao.disabled = true; botao.textContent = "Recalculando..."; }
    try {
      const { firestore, db, auth } = await contexto();
      const usuario = await usuarioAdmin(firestore, db, auth);
      const marcadorRef = firestore.doc(db, "configuracoes", MARCADOR_ID);
      const marcador = await firestore.getDoc(marcadorRef);
      if (marcador.exists() && marcador.data()?.concluida === true) {
        toast("Os pagamentos pendentes de ALÇA já foram recalculados para R$ 0,0540.");
        return;
      }

      const pendentes = (await consultarAlca(firestore, db)).filter(item => estaPendente(item.dados));
      const agora = firestore.serverTimestamp();
      let alterados = 0;
      let semQuantidade = 0;

      for (let inicio = 0; inicio < pendentes.length; inicio += 150) {
        const batch = firestore.writeBatch(db);
        let gravacoes = 0;
        pendentes.slice(inicio, inicio + 150).forEach(item => {
          if (!(quantidadeSutias(item.dados) > 0)) { semQuantidade += 1; return; }
          batch.set(item.ref, patch(item.dados, usuario.uid, agora), { merge: true });
          gravacoes += 1;
          alterados += 1;
        });
        if (gravacoes) await batch.commit();
        if (inicio + 150 < pendentes.length) await new Promise(r => setTimeout(r, 50));
      }

      await firestore.setDoc(marcadorRef, {
        concluida: true,
        valorAlca: VALOR_ALCA,
        valorPorSutia: VALOR_POR_SUTIA,
        pagamentosRecalculados: alterados,
        ignoradosSemQuantidade: semQuantidade,
        concluidoPor: usuario.uid,
        concluidoEm: firestore.serverTimestamp(),
        versao: VERSION
      }, { merge: true });

      toast(`${alterados} pagamento(s) pendente(s) de ALÇA recalculado(s) para ${moeda4(VALOR_ALCA)} por alça.`);
    } catch (error) {
      console.error(error);
      toast(error?.message || "Não foi possível recalcular os pagamentos pendentes de ALÇA.", true);
    } finally {
      executando = false;
      if (botao && document.contains(botao)) { botao.disabled = false; botao.textContent = original; }
    }
  }

  function garantirBotao() {
    if (document.getElementById("btnRecalcularPendentesAlca163")) return;
    const salvar = document.getElementById("btnSalvarValorPadraoAlca");
    if (!salvar?.parentElement) return;
    const botao = document.createElement("button");
    botao.id = "btnRecalcularPendentesAlca163";
    botao.type = "button";
    botao.className = "btn";
    botao.textContent = "Recalcular pendentes de ALÇA";
    botao.title = "Atualiza somente pagamentos de ALÇA ainda pendentes para R$ 0,0540. Pagos não são alterados.";
    botao.addEventListener("click", () => executar(botao));
    salvar.insertAdjacentElement("afterend", botao);
  }

  function iniciar() {
    garantirBotao();
    [150, 500, 1200, 2500].forEach(ms => setTimeout(garantirBotao, ms));
    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (alvo?.closest("#btnToggleGerenciarValores, .nav-btn[data-page='pagamentos'], .nav-btn[data-page='processos']")) {
        [50, 250, 700].forEach(ms => setTimeout(garantirBotao, ms));
      }
    }, true);
  }

  window.CorpoNuAlcaRecalculoPendentes163 = { versao: VERSION, executar: () => executar(document.getElementById("btnRecalcularPendentesAlca163")) };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();
