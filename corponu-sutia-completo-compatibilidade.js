(() => {
  "use strict";

  const VERSION = "2026-08-21-sutia-compatibilidade-sob-demanda-257";
  const FB = "10.12.5";
  const CONFIG_ANTIGA = "revisao-componentes-confeccao";

  if (window.__CORPONU_SUTIA_COMPLETO_COMPATIBILIDADE__ === VERSION) return;
  window.__CORPONU_SUTIA_COMPLETO_COMPATIBILIDADE__ = VERSION;

  let firebasePromise = null;
  let migrando = false;
  let concluido = false;
  let tentativaRealizada = false;

  const texto = valor => String(valor ?? "").trim();
  const normalizar = valor => texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();

  async function firebase() {
    if (firebasePromise) return firebasePromise;
    firebasePromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-firestore.js`)
    ]).then(([appMod, authMod, fs]) => {
      if (!appMod.getApps().length) throw new Error("Firebase ainda não inicializado.");
      const app = appMod.getApp();
      return {
        auth: authMod.getAuth(app),
        db: fs.getFirestore(app),
        fs
      };
    }).catch(error => {
      firebasePromise = null;
      throw error;
    });
    return firebasePromise;
  }

  function esconderConfiguracaoAntiga() {
    const form = document.getElementById("formConfigRev");
    if (!form) return;
    form.hidden = true;
    form.classList.add("hidden");
    form.style.setProperty("display", "none", "important");
    form.setAttribute("aria-hidden", "true");
    form.querySelectorAll("input,button,select,textarea").forEach(campo => {
      campo.disabled = true;
    });
    form.closest(".rev-grid")?.style.setProperty("grid-template-columns", "1fr", "important");
  }

  async function usuarioEhAdmin(ctx, usuario) {
    if (!usuario) return false;
    const snap = await ctx.fs.getDoc(ctx.fs.doc(ctx.db, "usuarios", usuario.uid));
    const perfil = snap.exists() ? snap.data() : {};
    return ["ADMIN", "ADMINISTRADOR"].includes(normalizar(perfil.tipo || perfil.perfil || perfil.role));
  }

  async function atualizarConfigInternaDaRevisao() {
    const carregar = window.CorpoNuRevisaoComponentes?.carregarConfig;
    if (typeof carregar === "function") await Promise.resolve(carregar()).catch(() => {});
  }

  async function desativarFonteAntiga(forcar = false) {
    esconderConfiguracaoAntiga();
    if (migrando || concluido || (tentativaRealizada && !forcar)) return;
    tentativaRealizada = true;
    migrando = true;

    try {
      const ctx = await firebase();
      const usuario = ctx.auth.currentUser;
      if (!usuario) {
        tentativaRealizada = false;
        return;
      }

      const ref = ctx.fs.doc(ctx.db, "configuracoes", CONFIG_ANTIGA);
      const snap = await ctx.fs.getDoc(ref);
      const dados = snap.exists() ? snap.data() : {};

      if (dados.substituidaPorCalculoSutiaCompleto === true) {
        concluido = true;
        await atualizarConfigInternaDaRevisao();
        return;
      }

      if (!(await usuarioEhAdmin(ctx, usuario))) return;

      await ctx.fs.setDoc(ref, {
        valoresAnterioresMigracaoSutiaCompleto: {
          descontoLateralUnitario: Number(dados.descontoLateralUnitario || 0),
          descontoBojoUnitario: Number(dados.descontoBojoUnitario || 0),
          lateralConfigurada: dados.lateralConfigurada === true,
          bojoConfigurado: dados.bojoConfigurado === true
        },
        descontoLateralUnitario: 0,
        descontoBojoUnitario: 0,
        lateralConfigurada: false,
        bojoConfigurado: false,
        substituidaPorCalculoSutiaCompleto: true,
        substituidaPorCalculoSutiaCompletoEm: ctx.fs.serverTimestamp(),
        substituidaPorCalculoSutiaCompletoPor: usuario.uid,
        versaoSubstituta: VERSION
      }, { merge: true });

      concluido = true;
      await atualizarConfigInternaDaRevisao();
    } catch (error) {
      tentativaRealizada = false;
      console.warn("A fonte antiga de descontos ainda não pôde ser desativada.", error);
    } finally {
      migrando = false;
    }
  }

  function iniciar() {
    esconderConfiguracaoAntiga();
    void desativarFonteAntiga(false);

    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (!alvo?.closest('[data-page="revisao-componentes"],[data-page="processos"]')) return;
      queueMicrotask(() => {
        esconderConfiguracaoAntiga();
        void desativarFonteAntiga(false);
      });
    }, true);
  }

  window.CorpoNuSutiaCompatibilidade = {
    versao: VERSION,
    atualizar: () => desativarFonteAntiga(true),
    concluida: () => concluido
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();