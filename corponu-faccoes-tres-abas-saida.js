(() => {
  "use strict";

  const V = "2026-08-26-faccoes-abas-sem-saida-lateral-254";
  const FB = "10.12.5";
  const PROCESSOS_SAIDA = Object.freeze({
    sutia: ["ENCAPAR BOJO", "SUTIÃ COMPLETO", "INTERLOCK"],
    calcinha: ["CALCINHA COMPLETA", "CALCINHA MONTAGEM"]
  });
  const PROCESSOS_EXCLUSIVOS_CALCINHA = new Set(["CALCINHA MONTAGEM", "CALCINHA COMPLETA"]);
  const CLASSE_TIPO_INCOMPATIVEL = "cn230-faccao-tipo-incompativel";

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
    if (o.identidadeCalcinhaConfirmada === true || o.reparoCalcinha137 === true || norm(o.id).startsWith("CALCINHA-")) return "calcinha";

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

  const ordemAtiva = o => Boolean(o) && o.excluida !== true && norm(o.status) !== "EXCLUIDA";
  const hoje = () => new Date().toISOString().slice(0, 10);
  const processosPermitidos = tipoAba => PROCESSOS_SAIDA[tipoAba] || [];

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
    const bs = [...p.querySelectorAll("button")];
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
    window.CorpoNuFaccoesLateralAlca?.ocultar?.();
  }

  function mostrarCorte() {
    painelGeral()?.classList.add("hidden");
    window.CorpoNuFaccoesLateralAlca?.mostrar?.();
  }

  function marcar(a) {
    const x = abas();
    const c = document.getElementById("abaFaccaoCorte");
    if (!x) return;
    x.s.classList.toggle("active", a === "sutia");
    x.c.classList.toggle("active", a === "calcinha");
    c?.classList.toggle("active", a === "corte");
  }

  function indiceProcessoDaTabela(tabela) {
    const cabecalhos = [...(tabela?.querySelectorAll("thead th") || [])];
    return cabecalhos.findIndex(th => norm(th.textContent) === "PROCESSO");
  }

  function corrigirClassificacaoVisualMovimentacoes() {
    const esconderCalcinha = aba === "sutia";
    ["listaFaccoesMovimentacoes", "listaMovimentacoesUsuario"].forEach(id => {
      const tbody = document.getElementById(id);
      if (!tbody) return;
      const indice = indiceProcessoDaTabela(tbody.closest("table"));
      if (indice < 0) return;

      tbody.querySelectorAll(":scope > tr").forEach(linha => {
        if (linha.querySelector(".empty") || linha.cells.length <= indice) return;
        const processo = norm(linha.cells[indice]?.textContent || "");
        const incompatível = esconderCalcinha && PROCESSOS_EXCLUSIVOS_CALCINHA.has(processo);
        linha.classList.toggle(CLASSE_TIPO_INCOMPATIVEL, incompatível);
        if (!incompatível && aba === "calcinha" && PROCESSOS_EXCLUSIVOS_CALCINHA.has(processo)) linha.classList.remove("corponu-dual-hidden");
      });
    });
  }

  function estilo() {
    if (document.getElementById("stFaccoes3")) return;
    const s = document.createElement("style");
    s.id = "stFaccoes3";
    s.textContent = `#faccoes tr.${CLASSE_TIPO_INCOMPATIVEL}{display:none!important}#modalSaida3.hidden{display:none!important}#modalSaida3{position:fixed;inset:0;z-index:100080;background:#0f172a99;display:flex;align-items:center;justify-content:center;padding:18px}.s3card{width:min(760px,100%);max-height:94vh;overflow:auto;background:#fff;border-radius:18px;padding:20px;box-shadow:0 25px 70px #0f172a55}.s3head{display:flex;justify-content:space-between;gap:15px}.s3head h3{margin:0}.s3close{border:0;background:#f1f5f9;border-radius:10px;width:36px;height:36px;font-size:22px}.s3busca{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end}.s3grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.s3prev{margin:12px 0;padding:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px}.s3prev.hidden,.s3campos.hidden{display:none!important}.s3info{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.s3info div{background:#fff;border:1px solid #e2e8f0;border-radius:9px;padding:9px}.s3info small{display:block;color:#64748b}.s3info strong{display:block;margin-top:3px}@media(max-width:760px){.s3grid,.s3info,.s3busca{grid-template-columns:1fr}}`;
    document.head.appendChild(s);
  }

  function modal() {
    if (document.getElementById("modalSaida3")) return;
    const m = document.createElement("div");
    m.id = "modalSaida3";
    m.className = "hidden";
    m.innerHTML = `<div class="s3card"><div class="s3head"><div><h3 id="s3titulo">Registrar saída</h3><p>Informe a OP, o processo e quem fará.</p></div><button id="s3fechar" class="s3close" type="button">×</button></div><form id="s3form" class="form"><div class="s3busca"><label>Número da OP<input id="s3op" type="text" inputmode="numeric" required></label><button id="s3buscar" class="btn" type="button">Buscar OP</button></div><div id="s3prev" class="s3prev hidden"></div><div id="s3campos" class="s3campos hidden"><div class="s3grid"><label>Processo a ser feito<select id="s3processo" required><option value="">Selecione o processo</option></select></label><label>Quem vai fazer<select id="s3faccao" required disabled><option value="">Escolha o processo</option></select></label><label>Data da saída<input id="s3data" type="date" required></label></div><div class="notice small">A quantidade enviada será sempre o total da OP.</div><div class="actions"><button class="btn btn-primary" type="submit">Confirmar saída</button><button id="s3cancelar" class="btn" type="button">Cancelar</button></div></div></form></div>`;
    document.body.appendChild(m);
  }

  function preencherProcessos(tipoAba = aba) {
    const select = document.getElementById("s3processo");
    if (!(select instanceof HTMLSelectElement)) return;
    const anterior = norm(select.value);
    const itens = processosPermitidos(tipoAba);
    select.innerHTML = '<option value="">Selecione o processo</option>' + itens.map(nome => `<option value="${esc(nome)}">${esc(nome)}</option>`).join("");
    const recuperado = itens.find(item => norm(item) === anterior);
    if (recuperado) select.value = recuperado;
  }

  function preparar() {
    estilo();
    modal();
    preencherProcessos(aba);

    const x = abas();
    if (x && !document.getElementById("abaFaccaoCorte")) {
      const b = x.c.cloneNode(true);
      b.id = "abaFaccaoCorte";
      [...b.attributes].forEach(a => {
        if (a.name.startsWith("data-")) b.removeAttribute(a.name);
      });
      b.classList.remove("active");
      b.innerHTML = `Lateral e Alça <span id="contCorte">0</span>`;
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

    corrigirClassificacaoVisualMovimentacoes();
  }

  function abrir(a) {
    if (a === "corte") return;
    aba = a;
    op = null;
    document.getElementById("s3form")?.reset();
    preencherProcessos(a);
    document.getElementById("s3prev")?.classList.add("hidden");
    document.getElementById("s3campos")?.classList.add("hidden");
    document.getElementById("s3titulo").textContent = `Registrar saída • ${a === "sutia" ? "Sutiã" : a === "calcinha" ? "Calcinha" : "Lateral e Alça"}`;
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
    const idsPreferidos = new Set([s, slug, `calcinha-${slug}`, `op-${slug}`].filter(Boolean).map(norm));
    const encontrados = new Map();
    mapa.forEach((item, id) => {
      const numero = norm(item?.numeroOP || item?.numeroOPExterno || item?.op || "");
      if (numero === alvo || idsPreferidos.has(norm(id)) || idsPreferidos.has(norm(item?.id))) encontrados.set(String(id), { id: String(id), ...item });
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
        tarefas.push(c.f.getDocs(c.f.query(c.f.collection(c.db, "ordensProducao"), c.f.where(campo, "==", valor), c.f.limit(10))));
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
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(f => f.ativo !== false && !f.cadastroPendente && !f.duplicadaDe);
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
      if (aba !== "corte" && tp !== aba) return toast(`Esta OP é de ${tp === "calcinha" ? "Calcinha" : "Sutiã"}. Abra a aba correta.`);

      op = o;
      faccoes = await promessaFaccoes;
      const comp = faccoes.filter(f => {
        const x = classe(f);
        return tp === "calcinha" ? x.c : x.s;
      }).sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));

      document.getElementById("s3faccao").innerHTML = `<option value="">Escolha o processo</option>`;
      document.getElementById("s3faccao").disabled = true;
      document.getElementById("s3prev").innerHTML = `<div class="s3info"><div><small>OP</small><strong>${esc(o.numeroOP || o.numeroOPExterno || o.id)}</strong></div><div><small>Referência</small><strong>${esc(o.referencia || "-")}</strong></div><div><small>Cor</small><strong>${esc(o.cor || "-")}</strong></div><div><small>Quantidade / Tipo</small><strong>${qtd(o).toLocaleString("pt-BR")} • ${tp === "calcinha" ? "Calcinha" : "Sutiã"}</strong></div></div>`;
      document.getElementById("s3prev").classList.remove("hidden");
      document.getElementById("s3campos").classList.remove("hidden");
      preencherProcessos(aba);
      document.getElementById("s3processo").focus();
      console.info(`[Facções 230] OP ${v} localizada em ${Math.round(performance.now() - inicio)} ms (${tp}; ${comp.length} facções compatíveis por tipo).`);
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
    if (aba === "corte") return toast("Use o fluxo próprio de Lateral e Alça.");
    if (!op) return toast("Busque a OP primeiro.");

    const processo = norm(document.getElementById("s3processo").value);
    const faccao = norm(document.getElementById("s3faccao").value);
    const data = document.getElementById("s3data").value;
    const total = qtd(op);
    const permitidos = processosPermitidos(aba);
    if (!permitidos.some(item => norm(item) === processo)) return toast(`Selecione um processo permitido para esta aba: ${permitidos.join(", ")}.`);
    if (!faccao || !data || !total) return toast("Preencha processo, facção e data.");

    const c = await ctx();
    const u = c.auth.currentUser;
    if (!u) return toast("Usuário não autenticado.");

    const lista = await c.f.getDocs(c.f.query(c.f.collection(c.db, "movimentacoesProducao"), c.f.where("opId", "==", op.id)));
    if (lista.docs.some(d => {
      const m = d.data();
      return !m.dataChegada && !m.cancelado && !m.excluido && norm(m.status) !== "CANCELADO" && norm(m.processo) === processo && (aba !== "corte" || m.area === "corte" || m.movimentacaoCorte === true);
    })) return toast(`Já existe uma saída em andamento para ${processo}.`);

    const nop = op.numeroOP || op.numeroOPExterno || op.id;
    if (!confirm(`Confirmar saída?\nAba: ${aba === "sutia" ? "Sutiã" : aba === "calcinha" ? "Calcinha" : "Lateral e Alça"}\nOP ${nop}\nProcesso: ${processo}\nFacção: ${faccao}\nQuantidade: ${total.toLocaleString("pt-BR")}`)) return;

    const bt = ev.submitter;
    bt.disabled = true;
    bt.textContent = "Salvando...";

    try {
      const corte = false;
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
        processoLivre: false,
        setor: aba,
        setorLabel: aba === "sutia" ? "Sutiã" : "Calcinha",
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
      document.getElementById("btnAtualizarServidor")?.click();
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

    if (t.closest('.nav-btn[data-page="faccoes"]')) {
      setTimeout(() => {
        preparar();
        marcar(aba);
        corrigirClassificacaoVisualMovimentacoes();
      }, 0);
    }

    const x = abas();
    if (t.closest("#abaFaccaoCorte")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      aba = "corte";
      marcar(aba);
      corrigirClassificacaoVisualMovimentacoes();
      mostrarCorte();
      return;
    }

    if (x && (t.closest("button") === x.s || t.closest("button") === x.c)) {
      aba = t.closest("button") === x.c ? "calcinha" : "sutia";
      mostrarGeral();
      setTimeout(() => {
        marcar(aba);
        corrigirClassificacaoVisualMovimentacoes();
      }, 0);
    }

    if (t.closest("#btnSaidaAbas")) abrir(aba);
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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", preparar, { once: true });
  else preparar();
})();
