(() => {
  "use strict";

  const V = "2026-08-14-faccoes-busca-calcinha-rapida-201";
  const FB = "10.12.5";

  if (window.__FACCOES_3_ABAS__ === V) return;
  window.__FACCOES_3_ABAS__ = V;

  let aba = "sutia";
  let op = null;
  let faccoes = [];
  let faccoesCarregadasEm = 0;
  let faccoesPromise = null;
  const FACCOES_CACHE_MS = 60 * 1000;
  const OP_CACHE_MS = 2 * 60 * 1000;
  const cacheOps = new Map();
  let ctxP = null;

  const norm = v => String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

  const esc = v => String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const num = v => {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const s = String(v ?? "").trim();
    if (!s) return 0;
    const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
    return Number.isFinite(n) ? n : 0;
  };

  const qtd = o => Math.max(0, num(o?.quantidade ?? o?.quantidadeTotal ?? o?.qtd ?? o?.qti));
  const idSeguro = v => norm(v)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  function tipo(o) {
    if (!o) return "sutia";

    if (
      o.identidadeCalcinhaConfirmada === true ||
      o.reparoCalcinha137 === true ||
      norm(o.id).startsWith("CALCINHA-")
    ) {
      return "calcinha";
    }

    const identidade = norm([
      o.tipoPeca,
      o.tipoPecaPadrao,
      o.tipoPecaLabel,
      o.tipo,
      o.setor,
      o.setorLabel,
      o.processoPlanejado,
      o.processo,
      o.produtoNome,
      o.nomeProduto,
      o.observacoes
    ].join(" "));

    return identidade.includes("CALCINHA") ? "calcinha" : "sutia";
  }

  function ordemAtiva(o) {
    return Boolean(o) && o.excluida !== true && norm(o.status) !== "EXCLUIDA";
  }

  const hoje = () => new Date().toISOString().slice(0, 10);

  function toast(m) {
    const t = document.getElementById("toast");
    if (t) {
      t.textContent = m;
      t.classList.remove("hidden");
      clearTimeout(window.__f3t);
      window.__f3t = setTimeout(() => t.classList.add("hidden"), 6000);
      return;
    }
    alert(m);
  }

  async function ctx() {
    if (ctxP) return ctxP;
    ctxP = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-firestore.js`)
    ]).then(([a, u, f]) => {
      const app = a.getApp();
      return { auth: u.getAuth(app), db: f.getFirestore(app), f };
    }).catch(e => {
      ctxP = null;
      throw e;
    });
    return ctxP;
  }

  function abas() {
    const p = document.getElementById("faccoes");
    if (!p) return null;
    const bs = [...p.querySelectorAll("button")].filter(b => !b.closest("#faccoesAbasCorte"));
    const s = bs.find(b => /^SUTIA(?:\s+\d+)?$/.test(norm(b.textContent)));
    const c = bs.find(b => /^CALCINHA(?:\s+\d+)?$/.test(norm(b.textContent)));
    if (!s || !c) return null;
    let box = s.parentElement;
    while (box && !box.contains(c)) box = box.parentElement;
    return box ? { p, box, s, c } : null;
  }

  function painelGeral() {
    return document.querySelector("#faccoes > .faccoes-operacional-panel");
  }

  function mostrarGeral() {
    painelGeral()?.classList.remove("hidden");
    document.getElementById("painelFaccoesCorte")?.classList.add("hidden");
    document.querySelector('#faccoesAbasCorte [data-area-faccoes="geral"]')?.click();
  }

  function mostrarCorte() {
    painelGeral()?.classList.add("hidden");
    document.getElementById("painelFaccoesCorte")?.classList.remove("hidden");
    document.querySelector('#faccoesAbasCorte [data-area-faccoes="corte"]')?.click();
    setTimeout(() => document.getElementById("btnCorteAtualizar")?.click(), 0);
  }

  function marcar(a) {
    const x = abas();
    const c = document.getElementById("abaFaccaoCorte");
    if (!x) return;
    x.s.classList.toggle("active", a === "sutia");
    x.c.classList.toggle("active", a === "calcinha");
    c?.classList.toggle("active", a === "corte");
  }

  function estilo() {
    if (document.getElementById("stFaccoes3")) return;
    const s = document.createElement("style");
    s.id = "stFaccoes3";
    s.textContent = `#faccoesAbasCorte{display:none!important}#modalSaida3.hidden{display:none!important}#modalSaida3{position:fixed;inset:0;z-index:100080;background:#0f172a99;display:flex;align-items:center;justify-content:center;padding:18px}.s3card{width:min(760px,100%);max-height:94vh;overflow:auto;background:#fff;border-radius:18px;padding:20px;box-shadow:0 25px 70px #0f172a55}.s3head{display:flex;justify-content:space-between;gap:15px}.s3head h3{margin:0}.s3close{border:0;background:#f1f5f9;border-radius:10px;width:36px;height:36px;font-size:22px}.s3busca{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end}.s3grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.s3prev{margin:12px 0;padding:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px}.s3prev.hidden,.s3campos.hidden{display:none!important}.s3info{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.s3info div{background:#fff;border:1px solid #e2e8f0;border-radius:9px;padding:9px}.s3info small{display:block;color:#64748b}.s3info strong{display:block;margin-top:3px}@media(max-width:760px){.s3grid,.s3info,.s3busca{grid-template-columns:1fr}}`;
    document.head.appendChild(s);
  }

  function modal() {
    if (document.getElementById("modalSaida3")) return;
    const m = document.createElement("div");
    m.id = "modalSaida3";
    m.className = "hidden";
    m.innerHTML = `<div class="s3card"><div class="s3head"><div><h3 id="s3titulo">Registrar saída</h3><p>Informe a OP, o processo e quem fará.</p></div><button id="s3fechar" class="s3close" type="button">×</button></div><form id="s3form" class="form"><div class="s3busca"><label>Número da OP<input id="s3op" type="text" inputmode="numeric" required></label><button id="s3buscar" class="btn" type="button">Buscar OP</button></div><div id="s3prev" class="s3prev hidden"></div><div id="s3campos" class="s3campos hidden"><div class="s3grid"><label>Processo a ser feito<input id="s3processo" type="text" placeholder="Digite livremente" required></label><label>Quem vai fazer<select id="s3faccao" required><option value="">Selecione</option></select></label><label>Data da saída<input id="s3data" type="date" required></label></div><div class="notice small">A quantidade enviada será sempre o total da OP.</div><div class="actions"><button class="btn btn-primary" type="submit">Confirmar saída</button><button id="s3cancelar" class="btn" type="button">Cancelar</button></div></div></form></div>`;
    document.body.appendChild(m);
  }

  function preparar() {
    estilo();
    modal();
    const velha = document.getElementById("faccoesAbasCorte");
    if (velha) {
      velha.hidden = true;
      velha.style.setProperty("display", "none", "important");
    }

    const x = abas();
    if (x && !document.getElementById("abaFaccaoCorte")) {
      const b = x.c.cloneNode(true);
      b.id = "abaFaccaoCorte";
      [...b.attributes].forEach(a => {
        if (a.name.startsWith("data-")) b.removeAttribute(a.name);
      });
      b.classList.remove("active");
      b.innerHTML = `Corte <span id="contCorte">0</span>`;
      x.box.appendChild(b);
    }

    const ag = painelGeral()?.querySelector(":scope > .panel-header .actions") || painelGeral()?.querySelector(".panel-header .actions");
    if (ag && !document.getElementById("btnSaidaAbas")) {
      const b = document.createElement("button");
      b.id = "btnSaidaAbas";
      b.type = "button";
      b.className = "btn btn-primary";
      b.textContent = "Registrar saída";
      ag.insertBefore(b, ag.firstChild);
    }

    const leg = document.getElementById("btnCorteRegistrarSaida");
    if (leg) {
      leg.id = "btnCorteRegistrarSaidaLegado";
      leg.style.setProperty("display", "none", "important");
    }

    const tc = document.querySelector("#painelFaccoesCorte .corte-toolbar");
    if (tc && !document.getElementById("btnSaidaCorteNovo")) {
      const b = document.createElement("button");
      b.id = "btnSaidaCorteNovo";
      b.type = "button";
      b.className = "btn btn-primary";
      b.textContent = "Registrar saída";
      tc.insertBefore(b, tc.firstChild);
    }
  }

  function abrir(a) {
    aba = a;
    op = null;
    document.getElementById("s3form")?.reset();
    document.getElementById("s3prev")?.classList.add("hidden");
    document.getElementById("s3campos")?.classList.add("hidden");
    document.getElementById("s3titulo").textContent = `Registrar saída • ${a === "sutia" ? "Sutiã" : a === "calcinha" ? "Calcinha" : "Corte"}`;
    document.getElementById("s3data").value = hoje();
    document.getElementById("modalSaida3").classList.remove("hidden");
    carregarFaccoesRapido().catch(() => {});
    setTimeout(() => document.getElementById("s3op")?.focus(), 30);
  }

  function fechar() {
    document.getElementById("modalSaida3")?.classList.add("hidden");
    op = null;
  }

  function escolherOrdemEncontrada(encontrados, preferencia, s) {
    const ativos = [...encontrados.values()].filter(ordemAtiva);
    if (!ativos.length) return null;

    if (preferencia === "calcinha" || preferencia === "sutia") {
      const compativeis = ativos.filter(item => tipo(item) === preferencia);
      if (compativeis.length) {
        compativeis.sort((a, b) => {
          const confirmadoA = preferencia === "calcinha" && (a.identidadeCalcinhaConfirmada === true || a.reparoCalcinha137 === true) ? 0 : 1;
          const confirmadoB = preferencia === "calcinha" && (b.identidadeCalcinhaConfirmada === true || b.reparoCalcinha137 === true) ? 0 : 1;
          const idA = String(a.id) === s ? 0 : 1;
          const idB = String(b.id) === s ? 0 : 1;
          return confirmadoA - confirmadoB || idA - idB || String(a.id).localeCompare(String(b.id), "pt-BR", { numeric: true });
        });
        return compativeis[0];
      }
    }

    const direto = ativos.find(item => String(item.id) === s);
    return direto || ativos[0];
  }

  function buscarOPNoEstado(v, preferencia) {
    const mapa = window.corponuDualMode?.state?.maps?.ordens;
    if (!(mapa instanceof Map) || !mapa.size) return null;

    const s = String(v || "").trim();
    const alvo = norm(s);
    const slug = idSeguro(s);
    const idsPreferidos = new Set([
      s,
      slug,
      `calcinha-${slug}`,
      `op-${slug}`
    ].filter(Boolean).map(norm));

    const encontrados = new Map();
    mapa.forEach((item, id) => {
      const numero = norm(item?.numeroOP || item?.numeroOPExterno || item?.op || "");
      if (numero === alvo || idsPreferidos.has(norm(id)) || idsPreferidos.has(norm(item?.id))) {
        encontrados.set(String(id), { id: String(id), ...item });
      }
    });

    const escolhida = escolherOrdemEncontrada(encontrados, preferencia, s);
    if (!escolhida) return null;
    if (preferencia !== "corte" && tipo(escolhida) !== preferencia) return null;
    return escolhida;
  }

  async function executarConsultasOP(c, campos, valores, encontrados) {
    const tarefas = [];

    for (const campo of campos) {
      for (const valor of valores) {
        tarefas.push(
          c.f.getDocs(
            c.f.query(
              c.f.collection(c.db, "ordensProducao"),
              c.f.where(campo, "==", valor),
              c.f.limit(10)
            )
          )
        );
      }
    }

    const resultados = await Promise.allSettled(tarefas);
    resultados.forEach(resultado => {
      if (resultado.status !== "fulfilled") return;
      resultado.value.docs.forEach(d => encontrados.set(d.id, { id: d.id, ...d.data() }));
    });
  }

  async function buscarDocumentosDiretos(c, ids, encontrados, usarCache) {
    const tarefas = ids.map(id => {
      const ref = c.f.doc(c.db, "ordensProducao", id);
      return (usarCache ? c.f.getDocFromCache(ref) : c.f.getDoc(ref)).catch(() => null);
    });
    const resultados = await Promise.all(tarefas);
    resultados.forEach(d => {
      if (d?.exists?.()) encontrados.set(d.id, { id: d.id, ...d.data() });
    });
  }

  async function buscarOP(v, preferencia = aba) {
    const s = String(v || "").trim();
    if (!s) return null;

    const chaveCache = `${preferencia}|${s}`;
    const cache = cacheOps.get(chaveCache);
    if (cache && Date.now() - cache.em < OP_CACHE_MS) return cache.valor;

    const local = buscarOPNoEstado(s, preferencia);
    if (local) {
      cacheOps.set(chaveCache, { em: Date.now(), valor: local });
      return local;
    }

    const c = await ctx();
    const encontrados = new Map();
    const slug = idSeguro(s);
    const ids = preferencia === "calcinha"
      ? [...new Set([`calcinha-${slug}`, s, `op-${slug}`, slug].filter(Boolean))]
      : [...new Set([s, `op-${slug}`, slug, `calcinha-${slug}`].filter(Boolean))];

    await buscarDocumentosDiretos(c, ids, encontrados, true);
    let escolhida = escolherOrdemEncontrada(encontrados, preferencia, s);
    if (escolhida && (preferencia === "corte" || tipo(escolhida) === preferencia)) {
      cacheOps.set(chaveCache, { em: Date.now(), valor: escolhida });
      return escolhida;
    }

    await buscarDocumentosDiretos(c, ids, encontrados, false);
    escolhida = escolherOrdemEncontrada(encontrados, preferencia, s);
    if (escolhida && (preferencia === "corte" || tipo(escolhida) === preferencia)) {
      cacheOps.set(chaveCache, { em: Date.now(), valor: escolhida });
      return escolhida;
    }

    const valores = [s];
    const n = Number(s);
    if (Number.isFinite(n)) valores.push(n);
    const valoresUnicos = [...new Set(valores)];

    await executarConsultasOP(c, ["numeroOP"], valoresUnicos, encontrados);
    escolhida = escolherOrdemEncontrada(encontrados, preferencia, s);
    if (escolhida && (preferencia === "corte" || tipo(escolhida) === preferencia)) {
      cacheOps.set(chaveCache, { em: Date.now(), valor: escolhida });
      return escolhida;
    }

    await executarConsultasOP(c, ["numeroOPExterno", "op"], valoresUnicos, encontrados);
    escolhida = escolherOrdemEncontrada(encontrados, preferencia, s);
    cacheOps.set(chaveCache, { em: Date.now(), valor: escolhida || null });
    return escolhida;
  }

  function normalizarListaFaccoes(snapshot) {
    return snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(f => f.ativo !== false && !f.cadastroPendente && !f.duplicadaDe);
  }

  async function carregarFaccoesRapido() {
    if (faccoes.length && Date.now() - faccoesCarregadasEm < FACCOES_CACHE_MS) return faccoes;
    if (faccoesPromise) return faccoesPromise;

    faccoesPromise = (async () => {
      const c = await ctx();
      const colecao = c.f.collection(c.db, "faccoes");

      try {
        const cache = await c.f.getDocsFromCache(colecao);
        if (!cache.empty) {
          faccoes = normalizarListaFaccoes(cache);
          faccoesCarregadasEm = Date.now();

          c.f.getDocs(colecao).then(snapshot => {
            faccoes = normalizarListaFaccoes(snapshot);
            faccoesCarregadasEm = Date.now();
          }).catch(() => {});

          return faccoes;
        }
      } catch (_) {}

      const servidor = await c.f.getDocs(colecao);
      faccoes = normalizarListaFaccoes(servidor);
      faccoesCarregadasEm = Date.now();
      return faccoes;
    })().finally(() => {
      faccoesPromise = null;
    });

    return faccoesPromise;
  }

  function classe(f) {
    const t = norm([...(f.processosPermitidos || []), ...(f.gruposPermitidos || []), f.grupo].join(" "));
    return {
      s: typeof f.trabalhaSutia === "boolean" ? f.trabalhaSutia : (f.atendeSutia === true || /SUTIA|BOJO|ALCA/.test(t)),
      c: typeof f.trabalhaCalcinha === "boolean" ? f.trabalhaCalcinha : (f.atendeCalcinha === true || t.includes("CALCINHA"))
    };
  }

  async function pesquisar() {
    const b = document.getElementById("s3buscar");
    const v = document.getElementById("s3op").value.trim();
    if (!v) return toast("Digite a OP.");

    b.disabled = true;
    b.textContent = "Buscando...";
    const inicio = performance.now();

    try {
      const promessaFaccoes = carregarFaccoesRapido().catch(() => faccoes);
      const o = await buscarOP(v, aba);
      if (!o) return toast("OP não encontrada ou está excluída.");

      const tp = tipo(o);
      if (aba !== "corte" && tp !== aba) {
        return toast(`Esta OP é de ${tp === "calcinha" ? "Calcinha" : "Sutiã"}. Abra a aba correta.`);
      }

      op = o;
      faccoes = await promessaFaccoes;

      const comp = faccoes
        .filter(f => {
          const x = classe(f);
          return tp === "calcinha" ? x.c : x.s;
        })
        .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));

      document.getElementById("s3faccao").innerHTML = `<option value="">Selecione</option>` + comp
        .map(f => `<option value="${esc(f.nome || "")}">${esc(f.nome || "")}</option>`)
        .join("");

      document.getElementById("s3prev").innerHTML = `<div class="s3info"><div><small>OP</small><strong>${esc(o.numeroOP || o.numeroOPExterno || o.id)}</strong></div><div><small>Referência</small><strong>${esc(o.referencia || "-")}</strong></div><div><small>Cor</small><strong>${esc(o.cor || "-")}</strong></div><div><small>Quantidade / Tipo</small><strong>${qtd(o).toLocaleString("pt-BR")} • ${tp === "calcinha" ? "Calcinha" : "Sutiã"}</strong></div></div>`;
      document.getElementById("s3prev").classList.remove("hidden");
      document.getElementById("s3campos").classList.remove("hidden");
      document.getElementById("s3processo").focus();
      console.info(`[Facções 201] OP ${v} localizada em ${Math.round(performance.now() - inicio)} ms (${tp}).`);
    } catch (e) {
      console.error(e);
      toast("Erro ao buscar a OP.");
    } finally {
      b.disabled = false;
      b.textContent = "Buscar OP";
    }
  }

  async function salvar(ev) {
    ev.preventDefault();
    if (!op) return toast("Busque a OP primeiro.");

    const processo = norm(document.getElementById("s3processo").value);
    const faccao = norm(document.getElementById("s3faccao").value);
    const data = document.getElementById("s3data").value;
    const total = qtd(op);
    if (!processo || !faccao || !data || !total) return toast("Preencha processo, facção e data.");

    const c = await ctx();
    const u = c.auth.currentUser;
    if (!u) return toast("Usuário não autenticado.");

    const lista = await c.f.getDocs(
      c.f.query(c.f.collection(c.db, "movimentacoesProducao"), c.f.where("opId", "==", op.id))
    );

    if (lista.docs.some(d => {
      const m = d.data();
      return !m.dataChegada && !m.cancelado && !m.excluido && norm(m.status) !== "CANCELADO" && norm(m.processo) === processo && (aba !== "corte" || m.area === "corte" || m.movimentacaoCorte === true);
    })) {
      return toast(`Já existe uma saída em andamento para ${processo}.`);
    }

    const nop = op.numeroOP || op.numeroOPExterno || op.id;
    if (!confirm(`Confirmar saída?\nAba: ${aba === "sutia" ? "Sutiã" : aba === "calcinha" ? "Calcinha" : "Corte"}\nOP ${nop}\nProcesso: ${processo}\nFacção: ${faccao}\nQuantidade: ${total.toLocaleString("pt-BR")}`)) return;

    const bt = ev.submitter;
    bt.disabled = true;
    bt.textContent = "Salvando...";

    try {
      const corte = aba === "corte";
      const dest = faccoes.find(f => norm(f.nome) === faccao);
      const mov = {
        origem: corte ? "corte" : "faccoes_registro_saida",
        area: aba,
        areaLabel: aba === "sutia" ? "Sutiã" : aba === "calcinha" ? "Calcinha" : "Corte",
        movimentacaoCorte: corte,
        opId: op.id,
        numeroOP: nop,
        referencia: op.referencia || "",
        cor: op.cor || "",
        produtoNome: op.produtoNome || op.nomeProduto || "",
        tipoDestino: corte ? "faccao_corte" : "faccao",
        tipoDestinoLabel: corte ? "Facção • Corte" : "Facção",
        destino: faccao,
        destinoId: dest?.id || "",
        processo,
        processoLivre: true,
        setor: aba,
        setorLabel: aba === "sutia" ? "Sutiã" : aba === "calcinha" ? "Calcinha" : "Corte",
        quantidadeEnviada: total,
        quantidadeRecebida: 0,
        dataEnvio: data,
        dataChegada: "",
        falta: 0,
        descontoDefeito: 0,
        status: "em_andamento",
        criadoPor: u.uid,
        criadoEm: c.f.serverTimestamp(),
        atualizadoPor: u.uid,
        atualizadoEm: c.f.serverTimestamp(),
        versaoSaidaAbas: V
      };

      await c.f.addDoc(c.f.collection(c.db, "movimentacoesProducao"), mov);
      fechar();
      toast("Saída registrada com sucesso.");
      corte ? document.getElementById("btnCorteAtualizar")?.click() : document.getElementById("btnAtualizarServidor")?.click();
    } catch (e) {
      console.error(e);
      toast("Erro ao registrar a saída.");
    } finally {
      bt.disabled = false;
      bt.textContent = "Confirmar saída";
    }
  }

  document.addEventListener("click", e => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const x = abas();

    if (t.closest("#abaFaccaoCorte")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      aba = "corte";
      marcar(aba);
      mostrarCorte();
      return;
    }

    if (x && (t.closest("button") === x.s || t.closest("button") === x.c)) {
      aba = t.closest("button") === x.c ? "calcinha" : "sutia";
      mostrarGeral();
      setTimeout(() => marcar(aba), 0);
    }

    if (t.closest("#btnSaidaAbas")) abrir(aba);
    if (t.closest("#btnSaidaCorteNovo")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      abrir("corte");
    }
    if (t.closest("#s3buscar")) pesquisar();
    if (t.closest("#s3fechar,#s3cancelar")) fechar();
  }, true);

  document.addEventListener("submit", e => {
    if (e.target?.id === "s3form") salvar(e);
  }, true);

  document.addEventListener("keydown", e => {
    if (e.target?.id === "s3op" && e.key === "Enter") {
      e.preventDefault();
      pesquisar();
    }
  }, true);

  const ob = new MutationObserver(preparar);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      preparar();
      ob.observe(document.body, { childList: true, subtree: true });
    }, { once: true });
  } else {
    preparar();
    ob.observe(document.body, { childList: true, subtree: true });
  }
})();
