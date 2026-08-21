(() => {
  "use strict";

  const VERSION = "2026-08-21-componentes-legados-sob-demanda-238";
  const FB = "10.12.5";

  if (window.__CORPONU_COMPONENTES_NAO_INFORMADOS__ === VERSION) return;
  window.__CORPONU_COMPONENTES_NAO_INFORMADOS__ = VERSION;

  let firebasePromise = null;
  let timerManual = null;
  const limpando = new Set();
  const limposNaSessao = new Set();

  const texto = valor => String(valor ?? "").trim();

  async function firebase() {
    if (firebasePromise) return firebasePromise;
    firebasePromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-firestore.js`)
    ]).then(([appMod, fs]) => {
      if (!appMod.getApps().length) throw new Error("Firebase ainda não inicializado.");
      const app = appMod.getApp();
      return { db: fs.getFirestore(app), fs };
    }).catch(error => {
      firebasePromise = null;
      throw error;
    });
    return firebasePromise;
  }

  async function buscarOPPorNumero(numeroOP) {
    const valor = texto(numeroOP);
    if (!valor) return null;
    const ctx = await firebase();

    try {
      const direto = await ctx.fs.getDoc(ctx.fs.doc(ctx.db, "ordensProducao", valor));
      if (direto.exists()) return { id: direto.id, ...direto.data() };
    } catch (_) {}

    const consultas = [["numeroOP", valor], ["numeroOPExterno", valor]];
    const numerico = Number(valor);
    if (Number.isFinite(numerico)) consultas.splice(1, 0, ["numeroOP", numerico]);

    for (const [campo, procurado] of consultas) {
      try {
        const snap = await ctx.fs.getDocs(ctx.fs.query(
          ctx.fs.collection(ctx.db, "ordensProducao"),
          ctx.fs.where(campo, "==", procurado),
          ctx.fs.limit(1)
        ));
        if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
      } catch (_) {}
    }
    return null;
  }

  async function limparOP(op, forcar = false) {
    if (!op?.id || limpando.has(op.id)) return false;
    if (!forcar && limposNaSessao.has(op.id)) return false;

    const componentes = op.componentesConsolidados || {};
    const removerLateral = componentes.lateral && componentes.lateral.informado !== true;
    const removerBojo = componentes.bojo && componentes.bojo.informado !== true;

    limposNaSessao.add(op.id);
    if (!removerLateral && !removerBojo) return false;

    limpando.add(op.id);
    try {
      const ctx = await firebase();
      const patch = {};
      if (removerLateral) patch["componentesConsolidados.lateral"] = ctx.fs.deleteField();
      if (removerBojo) patch["componentesConsolidados.bojo"] = ctx.fs.deleteField();
      patch.componentesConsolidadosHotfixVersao = VERSION;
      patch.componentesConsolidadosHotfixEm = ctx.fs.serverTimestamp();
      await ctx.fs.updateDoc(ctx.fs.doc(ctx.db, "ordensProducao", op.id), patch);
      document.getElementById("sutCompletoComponentesChegada")?.remove();
      document.getElementById("sutCompletoComponentesChegadaManual")?.remove();
      return true;
    } catch (error) {
      limposNaSessao.delete(op.id);
      console.warn("Status legado não informado de lateral/bojo não pôde ser limpo.", error);
      return false;
    } finally {
      limpando.delete(op.id);
    }
  }

  async function limparPorMovimentacao(id) {
    const movId = texto(id);
    if (!movId) return false;
    const ctx = await firebase();
    const snap = await ctx.fs.getDoc(ctx.fs.doc(ctx.db, "movimentacoesProducao", movId));
    if (!snap.exists()) return false;
    const mov = snap.data();
    let op = null;

    if (mov.opId) {
      const opSnap = await ctx.fs.getDoc(ctx.fs.doc(ctx.db, "ordensProducao", mov.opId));
      if (opSnap.exists()) op = { id: opSnap.id, ...opSnap.data() };
    }
    if (!op) op = await buscarOPPorNumero(mov.numeroOP);
    return limparOP(op);
  }

  async function limparPorNumero(numeroOP) {
    const op = await buscarOPPorNumero(numeroOP);
    return limparOP(op);
  }

  function idMovimentacaoDoBotao(botao) {
    const onclick = String(botao?.getAttribute("onclick") || "");
    return onclick.match(/registrarChegadaMovimentacao\s*\(\s*['\"]([^'\"]+)['\"]/i)?.[1] || "";
  }

  function iniciar() {
    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      const botao = alvo?.closest('[onclick*="registrarChegadaMovimentacao"]');
      if (!botao) return;
      const id = idMovimentacaoDoBotao(botao);
      if (id) void limparPorMovimentacao(id);
    }, true);

    document.addEventListener("input", event => {
      if (event.target?.id !== "chegadaManualOP") return;
      window.clearTimeout(timerManual);
      const numeroOP = texto(event.target.value);
      if (!numeroOP) return;
      timerManual = window.setTimeout(() => {
        void limparPorNumero(numeroOP);
      }, 250);
    }, true);

    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (!alvo?.closest("#btnBuscarChegadaManualOP")) return;
      const numeroOP = texto(document.getElementById("chegadaManualOP")?.value);
      if (numeroOP) void limparPorNumero(numeroOP);
    }, true);
  }

  window.CorpoNuComponentesLegados = {
    versao: VERSION,
    limparPorNumero,
    limparPorMovimentacao,
    limparOP
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();