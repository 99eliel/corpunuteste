(() => {
  "use strict";
  const VERSION = "2026-08-21-revisao-responsaveis-no-core-233";
  const FB = "10.12.5";
  const PAGINA = "revisaoComponentes";
  const NAV = "revisao-componentes";
  const CONFIG_ID = "revisao-componentes-confeccao";
  const PROCESSOS = new Set(["SUTIA MONTAGEM", "SUTIA COMPLETO"]);
  if (window.__CORPONU_REVISAO_COMPONENTES__ === VERSION) return;
  window.__CORPONU_REVISAO_COMPONENTES__ = VERSION;

  let ctxPromise = null;
  let user = null;
  let perfil = null;
  let opAtual = null;
  let lista = [];
  let config = { descontoLateralUnitario: 0, descontoBojoUnitario: 0, lateralConfigurada: false, bojoConfigurado: false };
  const cacheOP = new Map();
  const recalculando = new Set();

  const norm = v => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
  const html = v => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const num = (v, d = 0) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : d;
    const s = String(v ?? "").trim();
    if (!s) return d;
    const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
    return Number.isFinite(n) ? n : d;
  };
  const dinheiro = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const qtd = v => Number(v || 0).toLocaleString("pt-BR");
  const arred = v => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
  const perto = (a, b, t = .009) => Math.abs(num(a) - num(b)) <= t;
  const dataHora = v => {
    if (!v) return "-";
    const d = typeof v.toDate === "function" ? v.toDate() : new Date(v);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  function toast(msg, tipo = "info") {
    const principal = document.getElementById("toast");
    if (principal) {
      principal.textContent = msg;
      principal.classList.remove("hidden");
      clearTimeout(window.__revToast);
      window.__revToast = setTimeout(() => principal.classList.add("hidden"), 6000);
      return;
    }
    let el = document.getElementById("toastRevisaoComponentes");
    if (!el) {
      el = document.createElement("div");
      el.id = "toastRevisaoComponentes";
      el.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:100005;max-width:430px;padding:13px 15px;border-radius:13px;color:#fff;box-shadow:0 18px 42px #0f172a44;font:800 13px/1.45 Arial";
      document.body.appendChild(el);
    }
    el.style.background = tipo === "erro" ? "#991b1b" : tipo === "ok" ? "#166534" : "#0f172a";
    el.textContent = msg;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.remove(), 6500);
  }

  async function contexto() {
    if (ctxPromise) return ctxPromise;
    ctxPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-firestore.js`)
    ]).then(([appMod, authMod, fs]) => {
      if (!appMod.getApps().length) throw new Error("Firebase não inicializado");
      const app = appMod.getApp();
      return { auth: authMod.getAuth(app), onAuth: authMod.onAuthStateChanged, db: fs.getFirestore(app), fs };
    }).catch(e => { ctxPromise = null; throw e; });
    return ctxPromise;
  }

  async function aguardarCtx() {
    let erro;
    for (let i = 0; i < 30; i++) {
      try { return await contexto(); } catch (e) { erro = e; await new Promise(r => setTimeout(r, 300)); }
    }
    throw erro || new Error("Firebase indisponível");
  }

  const admin = () => norm(perfil?.tipo) === "ADMIN";
  const revisao = op => {
    const r = op?.revisaoComponentesConfeccao || {};
    return {
      ativa: r.ativa === true,
      lateral: r.lateralFeita === true || op?.lateralFeitaConfeccao === true,
      bojo: r.bojoFeito === true || op?.bojoEncapadoConfeccao === true,
      nome: r.usuarioNome || r.registradoPorNome || r.usuarioEmail || "Usuário",
      em: r.atualizadoEm || r.criadoEm || op?.revisaoComponentesAtualizadaEm,
      criadoEm: r.criadoEm,
      criadoPor: r.criadoPor || "",
      lateralQuem: String(r.lateralFeitaPorNome || r.lateralResponsavel || r.quemFezLateral || op?.lateralFeitaPorNome || op?.revisaoLateralFeitaPor || "").trim(),
      bojoQuem: String(r.bojoFeitoPorNome || r.bojoResponsavel || r.quemFezBojo || op?.bojoEncapadoPorNome || op?.revisaoBojoFeitoPor || "").trim()
    };
  };
  const ehCalcinha = op => norm([op?.tipoPeca, op?.tipoPecaLabel, op?.produtoNome, op?.nomeProduto, op?.observacoes].join(" ")).includes("CALCINHA");
  const processoAlvo = p => PROCESSOS.has(norm(p?.processo || p?.servicoNome || p?.processoMovimentacao));

  function estilo() {
    if (document.getElementById("styleRevisaoComponentes")) return;
    const s = document.createElement("style");
    s.id = "styleRevisaoComponentes";
    s.textContent = `
      #${PAGINA}{display:grid;gap:18px}#${PAGINA}.hidden{display:none!important}
      .rev-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr);gap:18px;align-items:start}
      .rev-busca{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end}.rev-busca label{margin:0}
      .rev-preview{margin-top:14px;padding:14px;border:1px solid #cbd5e1;border-radius:14px;background:#f8fafc}.rev-preview.hidden,.rev-box.hidden,.rev-admin.hidden{display:none!important}
      .rev-preview-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.rev-info{padding:9px;border:1px solid #e2e8f0;border-radius:9px;background:#fff}.rev-info small{display:block;color:#64748b}.rev-info strong{display:block;margin-top:3px}
      .rev-opcoes{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:14px}.rev-opcao{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;padding:14px;border:1px solid #cbd5e1;border-radius:13px;background:#fff}.rev-opcao>input{width:20px;height:20px;accent-color:#7c3aed}.rev-opcao>label{cursor:pointer}.rev-opcao strong,.rev-opcao span{display:block}.rev-opcao span span{margin-top:4px;color:#64748b;font-size:12px}
      .rev-responsavel-50{grid-column:1/-1;margin-top:3px;padding-top:11px;border-top:1px solid #e2e8f0}.rev-responsavel-50 label{display:block;margin:0;color:#334155;font-size:12px;font-weight:900}.rev-responsavel-50 input,.rev-responsavel-50 select{width:100%;min-height:42px;margin-top:6px;padding:9px 12px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f172a;font:700 13px/1.3 inherit;box-sizing:border-box}.rev-responsavel-50.desabilitado{opacity:.55}.rev-responsavel-50 small{display:block;margin-top:5px;color:#64748b;font-size:10px;font-weight:700}
      .rev-resumo{margin-top:12px;padding:11px;border-radius:10px;background:#f5f3ff;color:#5b21b6;font-size:12px;font-weight:800}.rev-config{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.rev-alerta{margin-top:12px;padding:11px;border:1px solid #fed7aa;border-radius:10px;background:#fff7ed;color:#9a3412;font-size:12px}
      .rev-pill{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:11px;font-weight:900}.rev-pill.sim{background:#dcfce7;color:#166534}.rev-pill.nao{background:#f1f5f9;color:#475569}.rev-vazio{text-align:center!important;color:#64748b;padding:24px!important}
      @media(max-width:980px){.rev-grid{grid-template-columns:1fr}}@media(max-width:720px){.rev-busca,.rev-preview-grid,.rev-opcoes,.rev-config{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function injetarUI() {
    const nav = document.querySelector("#appShell .sidebar nav");
    if (nav && !nav.querySelector(`[data-page="${NAV}"]`)) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "nav-btn"; b.dataset.page = NAV; b.textContent = "Revisão lateral e bojo";
      nav.insertBefore(b, nav.querySelector('[data-page="pagamentos"]'));
    }
    if (document.getElementById(PAGINA)) return;
    const sec = document.createElement("section");
    sec.id = PAGINA; sec.className = "page hidden";
    sec.innerHTML = `
      <div class="rev-grid">
        <div class="panel">
          <div class="panel-header"><div><h3>Registrar revisão da confecção</h3><p>Localize a OP e marque se lateral e/ou bojo já foram feitos pela confecção.</p></div></div>
          <form id="formRevisaoComponentes" class="form">
            <div class="rev-busca"><label>Número da OP<input id="revNumeroOP" type="text" inputmode="numeric" autocomplete="off" placeholder="Ex.: 58466" required></label><button class="btn btn-primary" id="btnBuscarRevOP" type="button">Buscar OP</button></div>
            <div id="revPreview" class="rev-preview hidden"></div>
            <div id="revBox" class="rev-box hidden">
              <div class="rev-opcoes">
                <div class="rev-opcao"><input id="revLateral" type="checkbox"><label for="revLateral"><strong>Lateral feita pela confecção</strong><span>Desconta o valor configurado por peça.</span></label><div class="rev-responsavel-50 desabilitado" data-responsavel-componente="lateral"><label for="revLateralQuemFez">Quem fez a lateral?</label><input id="revLateralQuemFez" type="text" maxlength="120" autocomplete="off" placeholder="Selecione ou informe a facção"><small>Esta informação fica registrada junto à OP.</small></div></div>
                <div class="rev-opcao"><input id="revBojo" type="checkbox"><label for="revBojo"><strong>Bojo encapado/pronto pela confecção</strong><span>Desconta o valor configurado por peça.</span></label><div class="rev-responsavel-50 desabilitado" data-responsavel-componente="bojo"><label for="revBojoQuemFez">Quem fez o bojo?</label><input id="revBojoQuemFez" type="text" maxlength="120" autocomplete="off" placeholder="Selecione ou informe a facção"><small>Esta informação fica registrada junto à OP.</small></div></div>
              </div>
              <div id="revResumo" class="rev-resumo"></div>
              <div class="actions"><button class="btn btn-success" type="submit">Salvar revisão</button><button class="btn" id="btnLimparRev" type="button">Limpar</button></div>
            </div>
          </form>
        </div>
        <form id="formConfigRev" class="panel rev-admin hidden">
          <div class="panel-header"><div><h3>Valores dos descontos</h3><p>Somente o administrador define os valores por peça.</p></div></div>
          <div class="rev-config"><label>Desconto da lateral<input id="revConfigLateral" type="number" min="0" step="0.01" placeholder="Em aberto"></label><label>Desconto do bojo<input id="revConfigBojo" type="number" min="0" step="0.01" placeholder="Em aberto"></label></div>
          <div class="rev-alerta">Os descontos são somados quando lateral e bojo estiverem marcados. Pagamentos pagos nunca são alterados.</div>
          <div class="actions"><button class="btn btn-primary" type="submit">Salvar valores e recalcular pendentes</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="panel-header"><div><h3>OPs com revisão registrada</h3><p>Veja componentes, usuário e data do registro.</p></div><div><input id="buscaRevLista" class="search" type="text" placeholder="Buscar OP, referência ou cor..."><button class="btn" id="btnAtualizarRev" type="button">Atualizar</button></div></div>
        <div class="table-wrap"><table><thead><tr><th>OP</th><th>REF</th><th>Cor</th><th>Qtd.</th><th>Lateral</th><th>Bojo</th><th>Desconto/peça</th><th>Registrado por</th><th>Data</th><th>Ações</th></tr></thead><tbody id="listaRev"><tr><td colspan="10" class="rev-vazio">Carregue a área para ver as revisões.</td></tr></tbody></table></div>
      </div>`;
    const main = document.querySelector("#appShell main.main");
    const ref = document.getElementById("pagamentos");
    if (ref) main.insertBefore(sec, ref); else main?.appendChild(sec);
  }

  function mostrarAdmin() { document.querySelectorAll(".rev-admin").forEach(e => e.classList.toggle("hidden", !admin())); renderLista(); }
  function manterNav() { const b = document.querySelector(`[data-page="${NAV}"]`); if (b) { b.hidden = false; b.classList.remove("hidden"); b.style.removeProperty("display"); } }

  function restaurarPaginasNormais() {
    document.querySelectorAll("#appShell main.main > .page").forEach(p => {
      if (p.id === PAGINA) return;
      p.classList.remove("hidden");
      p.hidden = false;
      p.style.removeProperty("display");
    });
  }

  function sincronizarResponsavel(tipo) {
    const checkbox = document.getElementById(tipo === "lateral" ? "revLateral" : "revBojo");
    const campo = document.getElementById(tipo === "lateral" ? "revLateralQuemFez" : "revBojoQuemFez");
    const bloco = campo?.closest(".rev-responsavel-50");
    if (!checkbox || !campo) return;
    campo.disabled = !checkbox.checked;
    campo.required = checkbox.checked;
    campo.setAttribute("aria-required", checkbox.checked ? "true" : "false");
    bloco?.classList.toggle("desabilitado", !checkbox.checked);
  }

  function preencherResponsaveis(op) {
    const r = revisao(op);
    const lateral = document.getElementById("revLateralQuemFez");
    const bojo = document.getElementById("revBojoQuemFez");
    if (lateral && !(lateral instanceof HTMLSelectElement) || lateral?.querySelector?.(`option[value="${CSS.escape(r.lateralQuem)}"]`)) {
      if (lateral) lateral.value = r.lateralQuem;
    } else if (lateral && r.lateralQuem) {
      lateral.dataset.valorAnterior = r.lateralQuem;
    }
    if (bojo && !(bojo instanceof HTMLSelectElement) || bojo?.querySelector?.(`option[value="${CSS.escape(r.bojoQuem)}"]`)) {
      if (bojo) bojo.value = r.bojoQuem;
    } else if (bojo && r.bojoQuem) {
      bojo.dataset.valorAnterior = r.bojoQuem;
    }
    sincronizarResponsavel("lateral");
    sincronizarResponsavel("bojo");
  }

  function abrirPagina() {
    restaurarPaginasNormais();
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const p = document.getElementById(PAGINA); p.classList.remove("hidden"); p.classList.add("active");
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelector(`[data-page="${NAV}"]`)?.classList.add("active");
    const t = document.getElementById("pageTitle"), st = document.getElementById("pageSubtitle");
    if (t) t.textContent = "Revisão lateral e bojo";
    if (st) st.textContent = "Componentes feitos pela confecção e descontos nos pagamentos pendentes.";
    carregarPagina();
  }

  function limpar() {
    opAtual = null;
    document.getElementById("formRevisaoComponentes")?.reset();
    const i = document.getElementById("revNumeroOP"); if (i) i.value = "";
    document.getElementById("revPreview")?.classList.add("hidden"); document.getElementById("revBox")?.classList.add("hidden");
    const lateral = document.getElementById("revLateralQuemFez"), bojo = document.getElementById("revBojoQuemFez");
    if (lateral) lateral.value = "";
    if (bojo) bojo.value = "";
    sincronizarResponsavel("lateral"); sincronizarResponsavel("bojo"); resumo();
  }

  function resumo() {
    const el = document.getElementById("revResumo"); if (!el) return;
    const lat = document.getElementById("revLateral")?.checked, boj = document.getElementById("revBojo")?.checked;
    const partes = [];
    if (lat) partes.push(`Lateral: ${config.lateralConfigurada ? dinheiro(config.descontoLateralUnitario) : "valor em aberto"}`);
    if (boj) partes.push(`Bojo: ${config.bojoConfigurado ? dinheiro(config.descontoBojoUnitario) : "valor em aberto"}`);
    el.textContent = partes.length ? `${partes.join(" + ")} • Total por peça: ${dinheiro((lat ? config.descontoLateralUnitario : 0) + (boj ? config.descontoBojoUnitario : 0))}.` : "Marque lateral, bojo ou os dois.";
  }

  function selecionarOP(op) {
    opAtual = op; cacheOP.set(String(op.id), op);
    const r = revisao(op), prev = document.getElementById("revPreview");
    prev.innerHTML = `<div class="rev-preview-grid"><div class="rev-info"><small>OP</small><strong>${html(op.numeroOP || op.numeroOPExterno || op.id)}</strong></div><div class="rev-info"><small>Referência</small><strong>${html(op.referencia || "-")}</strong></div><div class="rev-info"><small>Cor</small><strong>${html(op.cor || "-")}</strong></div><div class="rev-info"><small>Quantidade</small><strong>${qtd(op.quantidade || op.quantidadeTotal || 0)}</strong></div></div>${r.ativa ? '<div class="rev-resumo">Esta OP já possui revisão ativa. Você pode atualizar as marcações.</div>' : ""}`;
    prev.classList.remove("hidden"); document.getElementById("revBox").classList.remove("hidden");
    document.getElementById("revLateral").checked = r.ativa && r.lateral; document.getElementById("revBojo").checked = r.ativa && r.bojo;
    preencherResponsaveis(op); resumo();
  }

  async function buscarOP(numero) {
    const texto = String(numero || "").trim(); if (!texto) return null;
    const c = await aguardarCtx();
    try { const s = await c.fs.getDoc(c.fs.doc(c.db, "ordensProducao", texto)); if (s.exists()) return { id: s.id, ...s.data() }; } catch (_) {}
    const vals = [texto], n = Number(texto.replace(/\./g, "").replace(",", ".")); if (Number.isFinite(n)) vals.push(n);
    for (const campo of ["numeroOP", "numeroOPExterno"]) for (const v of vals) {
      const qy = c.fs.query(c.fs.collection(c.db, "ordensProducao"), c.fs.where(campo, "==", v), c.fs.limit(1));
      const s = await c.fs.getDocs(qy); if (!s.empty) return { id: s.docs[0].id, ...s.docs[0].data() };
    }
    return null;
  }

  async function acaoBuscar() {
    const input = document.getElementById("revNumeroOP"), b = document.getElementById("btnBuscarRevOP"), valor = input.value.trim();
    if (!valor) return toast("Digite o número da OP.", "erro");
    b.disabled = true; b.textContent = "Buscando...";
    try {
      const op = await buscarOP(valor);
      if (!op) return toast("OP não encontrada.", "erro");
      if (ehCalcinha(op)) return toast("Esta função é exclusiva para OPs de sutiã.", "erro");
      selecionarOP(op);
    } catch (e) { console.error(e); toast("Não foi possível buscar a OP.", "erro"); }
    finally { b.disabled = false; b.textContent = "Buscar OP"; }
  }

  async function carregarPerfil() {
    const c = await aguardarCtx(); user = c.auth.currentUser; if (!user) return;
    const s = await c.fs.getDoc(c.fs.doc(c.db, "usuarios", user.uid)); perfil = s.exists() ? s.data() : {};
    mostrarAdmin(); manterNav();
  }

  async function carregarConfig() {
    const c = await aguardarCtx(), s = await c.fs.getDoc(c.fs.doc(c.db, "configuracoes", CONFIG_ID)), d = s.exists() ? s.data() : {};
    config = { descontoLateralUnitario: Math.max(0, num(d.descontoLateralUnitario)), descontoBojoUnitario: Math.max(0, num(d.descontoBojoUnitario)), lateralConfigurada: d.lateralConfigurada === true || num(d.descontoLateralUnitario) > 0, bojoConfigurado: d.bojoConfigurado === true || num(d.descontoBojoUnitario) > 0 };
    const l = document.getElementById("revConfigLateral"), b = document.getElementById("revConfigBojo");
    if (l) l.value = config.lateralConfigurada ? config.descontoLateralUnitario : ""; if (b) b.value = config.bojoConfigurado ? config.descontoBojoUnitario : "";
    resumo(); renderLista();
  }

  function basePagamento(p) {
    const quantidade = Math.max(0, num(p.quantidade ?? p.quantidadeRecebida)), defeito = Math.max(0, num(p.descontoDefeito ?? p.defeito));
    const totalAtual = Math.max(0, num(p.total)), unitAtual = Math.max(0, num(p.valorUnitario));
    const manual = p.valorTotalDefinidoManualmente === true || p.valorManualFinanceiro === true || norm(p.formaValorPagamento).includes("MANUAL");
    let totalBase = totalAtual, unitBase = unitAtual;
    if (manual) {
      if (p.revisaoComponentesAplicada === true && perto(totalAtual, p.revisaoComponentesTotalCalculado)) totalBase = Math.max(0, num(p.valorTotalBaseRevisao, totalAtual + num(p.descontoRevisaoComponentesTotal)));
      unitBase = quantidade ? totalBase / quantidade : 0;
    } else {
      if (p.revisaoComponentesAplicada === true && perto(unitAtual, p.revisaoComponentesValorUnitarioCalculado, .0009)) unitBase = Math.max(0, num(p.valorUnitarioBaseRevisao, unitAtual + num(p.descontoRevisaoComponentesUnitario)));
      totalBase = Math.max(quantidade * unitBase - defeito, 0);
    }
    return { quantidade, defeito, manual, totalBase: arred(totalBase), unitBase };
  }

  function patchPagamento(p, r, c, uid, ts) {
    const base = basePagamento(p);
    const dl = r.ativa && r.lateral ? num(c.descontoLateralUnitario) : 0, db = r.ativa && r.bojo ? num(c.descontoBojoUnitario) : 0, du = arred(dl + db), dt = arred(base.quantidade * du);
    let unit, subtotal, total;
    if (base.manual) { total = arred(Math.max(base.totalBase - dt, 0)); subtotal = total; unit = base.quantidade ? total / base.quantidade : 0; }
    else { unit = Math.max(base.unitBase - du, 0); subtotal = arred(base.quantidade * unit); total = arred(Math.max(subtotal - base.defeito, 0)); }
    return { valorUnitario: unit, subtotal, total, valorUnitarioBaseRevisao: base.unitBase, valorTotalBaseRevisao: base.totalBase, revisaoComponentesAplicada: du > 0, revisaoLateralAtiva: r.ativa && r.lateral, revisaoBojoAtiva: r.ativa && r.bojo, descontoRevisaoLateralUnitario: arred(dl), descontoRevisaoBojoUnitario: arred(db), descontoRevisaoComponentesUnitario: du, descontoRevisaoComponentesTotal: dt, revisaoComponentesTotalCalculado: total, revisaoComponentesValorUnitarioCalculado: unit, revisaoComponentesVersao: VERSION, revisaoComponentesAtualizadaEm: ts(), atualizadoPor: uid, atualizadoEm: ts() };
  }

  function precisa(p, x) {
    if (p.revisaoComponentesVersao !== VERSION || p.revisaoComponentesAplicada !== x.revisaoComponentesAplicada || p.revisaoLateralAtiva !== x.revisaoLateralAtiva || p.revisaoBojoAtiva !== x.revisaoBojoAtiva) return true;
    return ["valorUnitario", "subtotal", "total", "descontoRevisaoComponentesUnitario", "descontoRevisaoComponentesTotal"].some(k => !perto(p[k], x[k], k.includes("Unitario") ? .0009 : .009));
  }

  async function recalcular(op) {
    if (!op?.id || recalculando.has(op.id)) return { atualizados: 0, erros: 0 };
    recalculando.add(op.id);
    try {
      const c = await aguardarCtx(), u = c.auth.currentUser, r = revisao(op);
      const s = await c.fs.getDocs(c.fs.query(c.fs.collection(c.db, "entregasPagamento"), c.fs.where("opId", "==", op.id)));
      let atualizados = 0, erros = 0;
      for (const d of s.docs) {
        const p = { id: d.id, ...d.data() }, st = norm(p.statusPagamento || "PENDENTE");
        if (["PAGO", "CANCELADO", "EXCLUIDO"].includes(st) || p.excluido === true || !processoAlvo(p)) continue;
        const x = patchPagamento(p, r, config, u.uid, c.fs.serverTimestamp); if (!precisa(p, x)) continue;
        try { await c.fs.updateDoc(c.fs.doc(c.db, "entregasPagamento", d.id), x); atualizados++; } catch (e) { erros++; console.warn("Pagamento não recalculado", d.id, e); }
      }
      return { atualizados, erros };
    } finally { recalculando.delete(op.id); }
  }

  async function log(acao, op, detalhes) {
    try {
      const c = await aguardarCtx();
      await c.fs.addDoc(c.fs.collection(c.db, "logsAlteracoes"), { acao, entidade: "ordemProducao", entidadeId: op.id, tipoAlvo: "ordemProducao", alvoId: op.id, detalhes, usuarioId: user.uid, usuarioUid: user.uid, usuarioEmail: user.email || "", criadoPor: user.uid, criadoEm: c.fs.serverTimestamp(), versao: VERSION });
    } catch (e) { console.warn("Log não criado", e); }
  }

  async function salvarRev(ev) {
    ev.preventDefault(); if (!opAtual) return toast("Primeiro busque uma OP.", "erro");
    const lateral = document.getElementById("revLateral").checked, bojo = document.getElementById("revBojo").checked;
    if (!lateral && !bojo) return toast("Marque lateral, bojo ou os dois.", "erro");
    const lateralQuem = lateral ? String(document.getElementById("revLateralQuemFez")?.value || "").trim() : "";
    const bojoQuem = bojo ? String(document.getElementById("revBojoQuemFez")?.value || "").trim() : "";
    if (lateral && !lateralQuem) return toast("Informe qual facção fez a lateral.", "erro");
    if (bojo && !bojoQuem) return toast("Informe qual facção fez o bojo.", "erro");
    const numero = opAtual.numeroOP || opAtual.numeroOPExterno || opAtual.id;
    if (!confirm(`Confirmar a revisão da OP ${numero}?`)) return;
    const botao = ev.submitter; if (botao) { botao.disabled = true; botao.textContent = "Salvando..."; }
    try {
      const c = await aguardarCtx(); user = c.auth.currentUser; if (!perfil) await carregarPerfil();
      const ant = revisao(opAtual), agora = c.fs.serverTimestamp();
      const r = {
        ativa: true,
        lateralFeita: lateral,
        bojoFeito: bojo,
        lateralFeitaPorNome: lateralQuem,
        bojoFeitoPorNome: bojoQuem,
        lateralResponsavel: lateralQuem,
        bojoResponsavel: bojoQuem,
        responsaveisAtualizadosPor: user.uid,
        responsaveisAtualizadosEm: agora,
        responsaveisVersao: VERSION,
        usuarioUid: user.uid,
        usuarioNome: perfil?.nome || user.displayName || user.email || "Usuário",
        usuarioEmail: perfil?.email || user.email || "",
        atualizadoPor: user.uid,
        atualizadoEm: agora,
        criadoPor: ant.criadoPor || user.uid,
        criadoEm: ant.criadoEm || agora,
        versao: VERSION
      };
      await c.fs.setDoc(c.fs.doc(c.db, "ordensProducao", opAtual.id), {
        revisaoComponentesConfeccao: r,
        lateralFeitaConfeccao: lateral,
        bojoEncapadoConfeccao: bojo,
        revisaoLateralFeitaPor: lateralQuem,
        revisaoBojoFeitoPor: bojoQuem,
        revisaoResponsaveisAtualizadosPor: user.uid,
        revisaoResponsaveisAtualizadosEm: agora,
        revisaoComponentesAtualizadaPor: user.uid,
        revisaoComponentesAtualizadaEm: agora
      }, { merge: true });
      opAtual = { ...opAtual, revisaoComponentesConfeccao: r, lateralFeitaConfeccao: lateral, bojoEncapadoConfeccao: bojo, revisaoLateralFeitaPor: lateralQuem, revisaoBojoFeitoPor: bojoQuem }; cacheOP.set(opAtual.id, opAtual);
      await log("revisao_lateral_bojo_registrada", opAtual, `OP ${numero} | lateral ${lateral ? lateralQuem : "não"} | bojo ${bojo ? bojoQuem : "não"}`);
      const res = await recalcular(opAtual); await carregarLista();
      const aberto = (lateral && !config.lateralConfigurada) || (bojo && !config.bojoConfigurado);
      limpar();
      document.getElementById("revNumeroOP")?.focus();
      toast(`Revisão salva. ${res.atualizados} pagamento(s) pendente(s) atualizado(s).${aberto ? " O administrador ainda precisa definir um ou mais valores." : ""}${res.erros ? ` ${res.erros} aguardam permissão.` : ""} Digite a próxima OP.`, "ok");
    } catch (e) { console.error(e); toast("Não foi possível salvar a revisão.", "erro"); }
    finally { if (botao) { botao.disabled = false; botao.textContent = "Salvar revisão"; } }
  }

  async function carregarLista() {
    const body = document.getElementById("listaRev"); if (body) body.innerHTML = '<tr><td colspan="10" class="rev-vazio">Carregando...</td></tr>';
    try {
      const c = await aguardarCtx(), s = await c.fs.getDocs(c.fs.query(c.fs.collection(c.db, "ordensProducao"), c.fs.where("revisaoComponentesConfeccao.ativa", "==", true)));
      lista = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (revisao(b).em?.toMillis?.() || 0) - (revisao(a).em?.toMillis?.() || 0));
      lista.forEach(op => cacheOP.set(op.id, op)); renderLista();
    } catch (e) { console.error(e); if (body) body.innerHTML = '<tr><td colspan="10" class="rev-vazio">Não foi possível carregar a lista.</td></tr>'; }
  }

  function renderLista() {
    const body = document.getElementById("listaRev"); if (!body) return;
    const busca = norm(document.getElementById("buscaRevLista")?.value), itens = lista.filter(op => !busca || norm([op.numeroOP, op.numeroOPExterno, op.referencia, op.cor].join(" ")).includes(busca));
    if (!itens.length) { body.innerHTML = `<tr><td colspan="10" class="rev-vazio">${busca ? "Nenhuma revisão encontrada." : "Nenhuma OP com revisão ativa."}</td></tr>`; return; }
    body.innerHTML = itens.map(op => {
      const r = revisao(op), desconto = (r.lateral ? config.descontoLateralUnitario : 0) + (r.bojo ? config.descontoBojoUnitario : 0);
      return `<tr><td><strong>${html(op.numeroOP || op.numeroOPExterno || op.id)}</strong></td><td><strong>${html(op.referencia || "-")}</strong></td><td>${html(op.cor || "-")}</td><td>${qtd(op.quantidade || op.quantidadeTotal || 0)}</td><td><span class="rev-pill ${r.lateral ? "sim" : "nao"}">${r.lateral ? "Feita" : "Não"}</span></td><td><span class="rev-pill ${r.bojo ? "sim" : "nao"}">${r.bojo ? "Pronto" : "Não"}</span></td><td><strong>${dinheiro(desconto)}</strong></td><td>${html(r.nome)}</td><td>${html(dataHora(r.em))}</td><td><button class="btn btn-sm" data-editar-rev="${html(op.id)}">Editar</button>${admin() ? `<button class="btn btn-sm btn-danger" data-cancelar-rev="${html(op.id)}">Cancelar</button>` : ""}</td></tr>`;
    }).join("");
  }

  async function cancelar(opId) {
    if (!admin()) return toast("Somente o administrador pode cancelar.", "erro");
    const op = cacheOP.get(String(opId)); if (!op) return toast("OP não encontrada.", "erro");
    const numero = op.numeroOP || op.numeroOPExterno || op.id;
    if (!confirm(`Cancelar a revisão da OP ${numero}?\nOs pagamentos pendentes voltarão ao valor base.`)) return;
    try {
      const c = await aguardarCtx(), agora = c.fs.serverTimestamp(), antigo = op.revisaoComponentesConfeccao || {};
      const r = { ...antigo, ativa: false, lateralFeita: false, bojoFeito: false, canceladoPor: user.uid, canceladoEm: agora, atualizadoPor: user.uid, atualizadoEm: agora, versao: VERSION };
      await c.fs.setDoc(c.fs.doc(c.db, "ordensProducao", op.id), { revisaoComponentesConfeccao: r, lateralFeitaConfeccao: false, bojoEncapadoConfeccao: false, revisaoComponentesAtualizadaPor: user.uid, revisaoComponentesAtualizadaEm: agora }, { merge: true });
      const atual = { ...op, revisaoComponentesConfeccao: r, lateralFeitaConfeccao: false, bojoEncapadoConfeccao: false };
      await log("revisao_lateral_bojo_cancelada", atual, `OP ${numero} | revisão cancelada`); const res = await recalcular(atual);
      lista = lista.filter(x => x.id !== op.id); cacheOP.set(op.id, atual); renderLista(); if (opAtual?.id === op.id) limpar();
      toast(`Marcação cancelada. ${res.atualizados} pagamento(s) restaurado(s).`, "ok");
    } catch (e) { console.error(e); toast("Não foi possível cancelar.", "erro"); }
  }

  async function salvarConfig(ev) {
    ev.preventDefault(); if (!admin()) return;
    const ls = document.getElementById("revConfigLateral").value.trim(), bs = document.getElementById("revConfigBojo").value.trim();
    const dl = ls ? Math.max(0, num(ls)) : 0, db = bs ? Math.max(0, num(bs)) : 0;
    if (!confirm(`Salvar valores?\nLateral: ${ls ? dinheiro(dl) : "em aberto"}\nBojo: ${bs ? dinheiro(db) : "em aberto"}\nOs pagamentos pendentes serão recalculados.`)) return;
    const botao = ev.submitter; if (botao) { botao.disabled = true; botao.textContent = "Recalculando..."; }
    try {
      const c = await aguardarCtx(); config = { descontoLateralUnitario: arred(dl), descontoBojoUnitario: arred(db), lateralConfigurada: !!ls, bojoConfigurado: !!bs };
      await c.fs.setDoc(c.fs.doc(c.db, "configuracoes", CONFIG_ID), { ...config, processosAplicaveis: ["SUTIÃ MONTAGEM", "SUTIÃ COMPLETO"], atualizadoPor: user.uid, atualizadoEm: c.fs.serverTimestamp(), versao: VERSION }, { merge: true });
      if (!lista.length) await carregarLista(); let total = 0, erros = 0;
      for (const op of lista) { const r = await recalcular(op); total += r.atualizados; erros += r.erros; }
      resumo(); renderLista(); toast(`Valores salvos. ${total} pagamento(s) recalculado(s).${erros ? ` ${erros} aguardam permissão.` : ""}`, "ok");
    } catch (e) { console.error(e); toast("Não foi possível salvar os valores.", "erro"); }
    finally { if (botao) { botao.disabled = false; botao.textContent = "Salvar valores e recalcular pendentes"; } }
  }

  async function opPorId(id) {
    if (!id) return null; if (cacheOP.has(String(id))) return cacheOP.get(String(id));
    const c = await aguardarCtx(), s = await c.fs.getDoc(c.fs.doc(c.db, "ordensProducao", String(id))); if (!s.exists()) return null;
    const op = { id: s.id, ...s.data() }; cacheOP.set(op.id, op); return op;
  }

  async function preencher(op, prefixo) {
    const r = revisao(op); if (!r.ativa) return;
    const l = document.getElementById(`${prefixo}LateralPronta`), b = document.getElementById(`${prefixo}BojoPronto`);
    if (l) { l.value = r.lateral ? "sim" : "nao"; l.title = "Preenchido pela Revisão lateral e bojo"; l.dispatchEvent(new Event("change", { bubbles: true })); }
    if (b) { b.value = r.bojo ? "sim" : "nao"; b.title = "Preenchido pela Revisão lateral e bojo"; b.dispatchEvent(new Event("change", { bubbles: true })); }
  }

  const argOnclick = b => String(b?.getAttribute("onclick") || "").match(/\(\s*['\"]([^'\"]+)['\"]/)?.[1] || "";
  const programar = fn => [900, 2200, 4800].forEach(ms => setTimeout(fn, ms));

  async function porMov(id, preencherPrefixo = "") {
    const c = await aguardarCtx(), s = await c.fs.getDoc(c.fs.doc(c.db, "movimentacoesProducao", String(id))); if (!s.exists()) return;
    const op = await opPorId(s.data().opId); if (!op) return; if (preencherPrefixo) await preencher(op, preencherPrefixo); else await recalcular(op);
  }

  function eventos() {
    if (document.documentElement.dataset.eventosRevisaoComponentes === VERSION) return;
    document.documentElement.dataset.eventosRevisaoComponentes = VERSION;
    document.addEventListener("click", e => {
      const a = e.target instanceof Element ? e.target : null; if (!a) return;
      const n = a.closest(`[data-page="${NAV}"]`); if (n) { e.preventDefault(); e.stopImmediatePropagation(); return abrirPagina(); }
      const navNormal = a.closest(".nav-btn[data-page]");
      if (navNormal && !n) {
        restaurarPaginasNormais();
        const revisaoPage = document.getElementById(PAGINA);
        revisaoPage?.classList.add("hidden");
        revisaoPage?.classList.remove("active");
        const destino = document.getElementById(navNormal.dataset.page || "");
        destino?.classList.remove("hidden");
      }
      const ed = a.closest("[data-editar-rev]"); if (ed) { const op = cacheOP.get(ed.dataset.editarRev); if (op) { document.getElementById("revNumeroOP").value = op.numeroOP || op.numeroOPExterno || op.id; selecionarOP(op); scrollTo({ top: 0, behavior: "smooth" }); } }
      const ca = a.closest("[data-cancelar-rev]"); if (ca) cancelar(ca.dataset.cancelarRev);
      const envio = a.closest('[onclick*="mandarParaFaccao"],[onclick*="abrirModalMovimentacao"]'); if (envio) { const id = argOnclick(envio); if (id) [150, 550].forEach(ms => setTimeout(async () => preencher(await opPorId(id), "movimentacao"), ms)); }
      const chegada = a.closest('[onclick*="registrarChegadaMovimentacao"]'); if (chegada) { const id = argOnclick(chegada); if (id) [180, 650].forEach(ms => setTimeout(() => porMov(id, "chegada"), ms)); }
    }, true);
    document.addEventListener("submit", e => {
      const f = e.target; if (!(f instanceof HTMLFormElement)) return;
      if (f.id === "formChegadaMovimentacao") { const id = document.getElementById("chegadaMovimentacaoId")?.value; if (id) programar(() => porMov(id)); }
      if (f.id === "formChegadaManualFaccao" || f.id === "formEntregaPagamento") {
        const n = document.getElementById(f.id === "formEntregaPagamento" ? "entregaOP" : "chegadaManualOP")?.value; if (n) programar(async () => { const op = await buscarOP(n); if (op) await recalcular(op); });
      }
      if (f.id === "formValorTotalManualOP") { const id = document.getElementById("valorTotalManualPagamentoId")?.value; if (id) programar(async () => { const c = await aguardarCtx(), s = await c.fs.getDoc(c.fs.doc(c.db, "entregasPagamento", id)); if (s.exists()) { const op = await opPorId(s.data().opId); if (op) await recalcular(op); } }); }
    }, true);
    let tm; document.addEventListener("input", e => { if (e.target?.id === "chegadaManualOP") { clearTimeout(tm); const v = e.target.value; if (v) tm = setTimeout(async () => { const op = await buscarOP(v); if (op) preencher(op, "chegadaManual"); }, 400); } }, true);
  }

  function eventosPagina() {
    const f = document.getElementById("formRevisaoComponentes"); if (f && !f.dataset.rev) {
      f.dataset.rev = VERSION; f.addEventListener("submit", salvarRev); document.getElementById("btnBuscarRevOP").addEventListener("click", acaoBuscar); document.getElementById("btnLimparRev").addEventListener("click", limpar);
      document.getElementById("revNumeroOP").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); acaoBuscar(); } });
      document.getElementById("revLateral").addEventListener("change", () => { resumo(); sincronizarResponsavel("lateral"); });
      document.getElementById("revBojo").addEventListener("change", () => { resumo(); sincronizarResponsavel("bojo"); });
      sincronizarResponsavel("lateral"); sincronizarResponsavel("bojo");
    }
    const fc = document.getElementById("formConfigRev"); if (fc && !fc.dataset.rev) { fc.dataset.rev = VERSION; fc.addEventListener("submit", salvarConfig); }
    const busca = document.getElementById("buscaRevLista"); if (busca && !busca.dataset.rev) { busca.dataset.rev = VERSION; busca.addEventListener("input", renderLista); }
    const at = document.getElementById("btnAtualizarRev"); if (at && !at.dataset.rev) { at.dataset.rev = VERSION; at.addEventListener("click", async () => { await carregarConfig(); await carregarLista(); toast("Lista atualizada.", "ok"); }); }
  }

  async function carregarPagina() { try { if (!perfil) await carregarPerfil(); await carregarConfig(); await carregarLista(); mostrarAdmin(); } catch (e) { console.error(e); toast("Não foi possível carregar todos os dados.", "erro"); } }

  async function iniciar() {
    estilo(); injetarUI(); eventosPagina(); eventos(); manterNav();
    try {
      const c = await aguardarCtx(); c.onAuth(c.auth, async u => { user = u; perfil = null; opAtual = null; lista = []; cacheOP.clear(); if (u) { await carregarPerfil().catch(() => {}); await carregarConfig().catch(() => {}); } });
    } catch (e) { return setTimeout(iniciar, 1200); }
  }

  window.CorpoNuRevisaoComponentes = { versao: VERSION, recalcular, buscarOP, carregarConfig, abrirPagina, limpar };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true }); else iniciar();
})();