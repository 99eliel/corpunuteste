(() => {
  "use strict";

  const VERSION = "2026-08-10-fase-lateral-sugestoes-164";
  const PANEL_ID = "painelSugestoesFaseLateral164";
  const STYLE_ID = "styleSugestoesFaseLateral164";
  const CONFIG_DOC = "manejoFaseLateralV1";
  const FB = "10.12.5";

  if (window.__CORPONU_FASE_LATERAL_SUGESTOES_164__ === VERSION) return;
  window.__CORPONU_FASE_LATERAL_SUGESTOES_164__ = VERSION;

  let ctxPromise = null;
  let unsubscribe = null;
  let opcoes = [];
  let observer = null;

  const normalizar = valor => String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

  const escapeHtml = valor => String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function listaUnica(valores) {
    const mapa = new Map();
    (valores || []).forEach(valor => {
      const limpo = String(valor ?? "").trim().replace(/\s+/g, " ").toUpperCase();
      const chave = normalizar(limpo);
      if (chave) mapa.set(chave, limpo);
    });
    return [...mapa.values()].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  }

  function toast(mensagem) {
    const principal = document.getElementById("toast");
    if (principal) {
      principal.textContent = mensagem;
      principal.classList.remove("hidden");
      clearTimeout(window.__faseLateral164Toast);
      window.__faseLateral164Toast = setTimeout(() => principal.classList.add("hidden"), 4500);
      return;
    }
    alert(mensagem);
  }

  async function contexto() {
    if (ctxPromise) return ctxPromise;
    ctxPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-firestore.js`)
    ]).then(([appMod, authMod, fs]) => {
      if (!appMod.getApps().length) throw new Error("Firebase ainda não inicializado");
      const app = appMod.getApp();
      return {
        auth: authMod.getAuth(app),
        db: fs.getFirestore(app),
        fs
      };
    }).catch(error => {
      ctxPromise = null;
      throw error;
    });
    return ctxPromise;
  }

  async function aguardarContexto() {
    let ultimoErro = null;
    for (let tentativa = 0; tentativa < 40; tentativa++) {
      try {
        return await contexto();
      } catch (error) {
        ultimoErro = error;
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    throw ultimoErro || new Error("Firebase indisponível");
  }

  function usuarioEhAdmin() {
    const role = document.getElementById("userRole")?.textContent || "";
    return /admin/i.test(role);
  }

  function injetarEstilo() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{margin-top:12px;border-color:#c4b5fd;background:linear-gradient(135deg,#ffffff,#faf7ff)}
      #${PANEL_ID}.hidden{display:none!important}
      #${PANEL_ID} .fl164-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px}
      #${PANEL_ID} .fl164-title{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
      #${PANEL_ID} h3{margin:0 0 4px;font-size:18px;color:#111827}
      #${PANEL_ID} p{margin:0;color:#475569;font-size:13px}
      #${PANEL_ID} .fl164-count{display:inline-flex;align-items:center;justify-content:center;padding:4px 9px;border-radius:999px;background:#dcfce7;color:#166534;border:1px solid #86efac;font-size:11px;font-weight:900}
      #${PANEL_ID} .fl164-notice{margin:10px 0 12px;padding:10px 12px;border:1px solid #c4b5fd;border-radius:11px;background:#faf5ff;color:#6b21a8;font-size:12px;font-weight:800}
      #${PANEL_ID} .fl164-label{display:block;margin:0 0 6px;color:#111827;font-size:12px;font-weight:900}
      #${PANEL_ID} .fl164-add{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:center}
      #${PANEL_ID} .fl164-add input{min-height:42px}
      #${PANEL_ID} .fl164-info{display:block;margin:8px 0 10px;color:#166534;font-size:11px}
      #${PANEL_ID} .fl164-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:7px}
      #${PANEL_ID} .fl164-item{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:8px 9px;border:1px solid #e9d5ff;border-radius:10px;background:#fff}
      #${PANEL_ID} .fl164-item span{font-size:12px;font-weight:900;color:#111827;overflow-wrap:anywhere}
      #${PANEL_ID} .fl164-remove{border:1px solid #fecaca;background:#fff7f7;color:#dc2626;border-radius:9px;padding:6px 9px;font-size:11px;font-weight:900;cursor:pointer;white-space:nowrap}
      #${PANEL_ID} .fl164-empty{padding:15px;border:1px dashed #d8b4fe;border-radius:10px;color:#64748b;text-align:center;font-size:12px}
      @media(max-width:760px){#${PANEL_ID} .fl164-top{flex-direction:column}#${PANEL_ID} .fl164-add{grid-template-columns:1fr}#${PANEL_ID} .fl164-top .btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function localizarPainelFaseSutia() {
    const titulos = [...document.querySelectorAll("h1,h2,h3,h4")];
    const titulo = titulos.find(el => {
      const texto = normalizar(el.textContent);
      return texto.includes("OPCOES DO FILTRO FASE") && texto.includes("SUTIA") && !texto.includes("LATERAL");
    });
    return titulo?.closest(".panel") || titulo?.parentElement?.parentElement || null;
  }

  function localizarPainelCalcinha() {
    const titulos = [...document.querySelectorAll("h1,h2,h3,h4")];
    const titulo = titulos.find(el => {
      const texto = normalizar(el.textContent);
      return texto.includes("OPCOES DO FILTRO FASE") && texto.includes("CALCINHA");
    });
    return titulo?.closest(".panel") || titulo?.parentElement?.parentElement || null;
  }

  function criarPainel() {
    if (document.getElementById(PANEL_ID)) return document.getElementById(PANEL_ID);

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "panel hidden";
    panel.innerHTML = `
      <div class="fl164-top">
        <div>
          <div class="fl164-title">
            <h3>Opções do filtro Fase Lateral — Sutiã</h3>
            <span class="fl164-count" data-contador>0 opção(ões)</span>
          </div>
          <p>Gerencie as opções mostradas no filtro da Fase Lateral e nas sugestões de edição do Manejo Sutiã.</p>
        </div>
        <button class="btn" type="button" data-recuperar>Recuperar opções antigas</button>
      </div>
      <div class="fl164-notice">Esta lista controla diretamente o filtro e as sugestões da <strong>Fase Lateral do Sutiã</strong>. A Fase Bojo e a Calcinha continuam com suas listas próprias.</div>
      <label class="fl164-label" for="novaFaseLateral164">Nova opção de fase lateral</label>
      <div class="fl164-add">
        <input id="novaFaseLateral164" type="text" placeholder="Ex: CORTE, PREPARAR, PRODUÇÃO" autocomplete="off" />
        <button class="btn btn-primary" type="button" data-adicionar>Adicionar opção</button>
      </div>
      <small class="fl164-info" data-info>Lista da Fase Lateral sincronizada com todos os usuários.</small>
      <div class="fl164-list" data-lista></div>
    `;

    const painelSutia = localizarPainelFaseSutia();
    const painelCalcinha = localizarPainelCalcinha();
    if (painelSutia?.parentElement) {
      painelSutia.insertAdjacentElement("afterend", panel);
    } else if (painelCalcinha?.parentElement) {
      painelCalcinha.insertAdjacentElement("beforebegin", panel);
    } else {
      return null;
    }

    panel.querySelector("[data-adicionar]")?.addEventListener("click", adicionarOpcao);
    panel.querySelector("#novaFaseLateral164")?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        adicionarOpcao();
      }
    });
    panel.querySelector("[data-recuperar]")?.addEventListener("click", recuperarOpcoesAntigas);
    panel.querySelector("[data-lista]")?.addEventListener("click", event => {
      const botao = event.target.closest("[data-remover]");
      if (!botao) return;
      removerOpcao(botao.dataset.remover || "");
    });

    return panel;
  }

  function publicarOpcoesNoSistema() {
    window.__CORPONU_FASES_LATERAIS_OFICIAIS__ = [...opcoes];
    try {
      localStorage.setItem("fasesLateraisManejoExtras", JSON.stringify(opcoes));
    } catch (error) {}

    const atualizarDatalist = (id, valores) => {
      const lista = document.getElementById(id);
      if (!lista) return;
      const existentes = [...lista.querySelectorAll("option")].map(opt => opt.value);
      const unidas = listaUnica([...existentes, ...valores]);
      lista.innerHTML = unidas.map(valor => `<option value="${escapeHtml(valor)}"></option>`).join("");
    };

    atualizarDatalist("manejoFasesLateraisList", opcoes);
    atualizarDatalist("filtroManejoFaseLateralList", ["Campo vazio", ...opcoes]);
    window.dispatchEvent(new CustomEvent("corponu:fases-laterais-atualizadas", { detail: { opcoes: [...opcoes] } }));
  }

  function renderizar() {
    const panel = criarPainel();
    if (!panel) return;
    panel.classList.toggle("hidden", !usuarioEhAdmin());
    if (!usuarioEhAdmin()) return;

    const contador = panel.querySelector("[data-contador]");
    if (contador) contador.textContent = `${opcoes.length} opção(ões)`;

    const lista = panel.querySelector("[data-lista]");
    if (lista) {
      lista.innerHTML = opcoes.length
        ? opcoes.map(item => `
            <div class="fl164-item">
              <span>${escapeHtml(item)}</span>
              <button class="fl164-remove" type="button" data-remover="${escapeHtml(item)}">Remover</button>
            </div>`).join("")
        : '<div class="fl164-empty">Nenhuma opção de Fase Lateral cadastrada ainda.</div>';
    }

    publicarOpcoesNoSistema();
  }

  async function gravar(novas) {
    const ctx = await aguardarContexto();
    if (!ctx.auth.currentUser) throw new Error("Usuário não autenticado");
    const lista = listaUnica(novas);
    await ctx.fs.setDoc(ctx.fs.doc(ctx.db, "configuracoes", CONFIG_DOC), {
      opcoes: lista,
      tipo: "fase_lateral_sutia",
      atualizadoPor: ctx.auth.currentUser.uid,
      atualizadoEm: ctx.fs.serverTimestamp()
    }, { merge: true });
  }

  async function adicionarOpcao() {
    if (!usuarioEhAdmin()) return;
    const input = document.getElementById("novaFaseLateral164");
    const valor = String(input?.value || "").trim().replace(/\s+/g, " ").toUpperCase();
    if (!valor) {
      toast("Digite a nova opção da Fase Lateral.");
      input?.focus();
      return;
    }
    if (opcoes.some(item => normalizar(item) === normalizar(valor))) {
      toast("Essa opção já está cadastrada na Fase Lateral.");
      return;
    }
    try {
      await gravar([...opcoes, valor]);
      if (input) input.value = "";
      toast(`Opção “${valor}” adicionada à Fase Lateral.`);
    } catch (error) {
      console.error("[Fase Lateral 164] Erro ao adicionar opção.", error);
      toast("Não foi possível adicionar a opção da Fase Lateral.");
    }
  }

  async function removerOpcao(valor) {
    if (!usuarioEhAdmin()) return;
    const item = opcoes.find(opcao => normalizar(opcao) === normalizar(valor));
    if (!item) return;
    if (!confirm(`Remover “${item}” das sugestões oficiais da Fase Lateral? Os valores já salvos nas OPs não serão apagados.`)) return;
    try {
      await gravar(opcoes.filter(opcao => normalizar(opcao) !== normalizar(item)));
      toast(`Opção “${item}” removida das sugestões da Fase Lateral.`);
    } catch (error) {
      console.error("[Fase Lateral 164] Erro ao remover opção.", error);
      toast("Não foi possível remover a opção da Fase Lateral.");
    }
  }

  async function recuperarOpcoesAntigas() {
    if (!usuarioEhAdmin()) return;
    const botao = document.querySelector(`#${PANEL_ID} [data-recuperar]`);
    if (botao) {
      botao.disabled = true;
      botao.textContent = "Recuperando...";
    }
    try {
      const ctx = await aguardarContexto();
      const snapshot = await ctx.fs.getDocs(ctx.fs.collection(ctx.db, "ordensProducao"));
      const recuperadas = [];
      snapshot.forEach(docSnap => {
        const dados = docSnap.data() || {};
        const valor = dados?.manejosSetores?.sutia?.faseLateral;
        if (valor) recuperadas.push(valor);
      });

      try {
        const locais = JSON.parse(localStorage.getItem("fasesLateraisManejoExtras") || "[]");
        if (Array.isArray(locais)) recuperadas.push(...locais);
      } catch (error) {}

      const novas = listaUnica([...opcoes, ...recuperadas]);
      await gravar(novas);
      const adicionadas = Math.max(novas.length - opcoes.length, 0);
      toast(adicionadas
        ? `${adicionadas} opção(ões) antiga(s) recuperada(s) para a Fase Lateral.`
        : "Nenhuma opção antiga nova foi encontrada para a Fase Lateral.");
    } catch (error) {
      console.error("[Fase Lateral 164] Erro ao recuperar opções antigas.", error);
      toast("Não foi possível recuperar as opções antigas da Fase Lateral.");
    } finally {
      if (botao) {
        botao.disabled = false;
        botao.textContent = "Recuperar opções antigas";
      }
    }
  }

  async function iniciarSincronizacao() {
    if (unsubscribe) return;
    try {
      const ctx = await aguardarContexto();
      unsubscribe = ctx.fs.onSnapshot(
        ctx.fs.doc(ctx.db, "configuracoes", CONFIG_DOC),
        snap => {
          opcoes = listaUnica(Array.isArray(snap.data()?.opcoes) ? snap.data().opcoes : []);
          renderizar();
        },
        error => console.warn("[Fase Lateral 164] Não foi possível sincronizar sugestões.", error)
      );
    } catch (error) {
      console.warn("[Fase Lateral 164] Firebase ainda indisponível; nova tentativa em instantes.", error);
      setTimeout(iniciarSincronizacao, 1200);
    }
  }

  function observarInterface() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (!document.getElementById(PANEL_ID)) renderizar();
      else document.getElementById(PANEL_ID)?.classList.toggle("hidden", !usuarioEhAdmin());
      publicarOpcoesNoSistema();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function iniciar() {
    injetarEstilo();
    renderizar();
    observarInterface();
    iniciarSincronizacao();
    window.addEventListener("corponu:fase-lateral-pedir-opcoes", publicarOpcoesNoSistema);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();
