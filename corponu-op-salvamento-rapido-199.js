(() => {
  "use strict";

  const VERSION = "2026-08-14-op-salvamento-rapido-199";
  const FIREBASE_VERSION = "10.12.5";
  const PROCESSOS_CALCINHA = new Set(["CALCINHA MONTAGEM", "CALCINHA COMPLETA"]);

  if (window.__CORPONU_OP_SALVAMENTO_RAPIDO_199__ === VERSION) return;
  window.__CORPONU_OP_SALVAMENTO_RAPIDO_199__ = VERSION;

  let fbPromise = null;
  let salvando = false;

  const normalizar = valor => String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  const docIdSeguro = valor => String(valor || "").trim().replaceAll("/", "-").replaceAll("\\", "-").replaceAll("#", "-");
  const safeId = valor => normalizar(valor).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || `registro-${Date.now()}`;

  function toast(msg, tipo = "info") {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    el.style.background = tipo === "error" ? "#991b1b" : tipo === "success" ? "#166534" : "";
    clearTimeout(window.__corponuOp199Toast);
    window.__corponuOp199Toast = setTimeout(() => {
      el.classList.add("hidden");
      el.style.background = "";
    }, 5000);
  }

  function tipoFormulario() {
    const aba = document.querySelector('.corponu-dual-tabs[data-page="ordens"] .corponu-dual-tab.active');
    if (aba?.dataset?.type === "calcinha" || document.body.dataset.corponuFormType === "calcinha") return "calcinha";
    return "sutia";
  }

  function ehCalcinha(item) {
    return normalizar([item?.tipoPeca, item?.tipoPecaPadrao, item?.tipoPecaLabel, item?.setor, item?.setorLabel].join(" ")).includes("CALCINHA");
  }

  function mapa(nome) {
    const valor = window.corponuDualMode?.state?.maps?.[nome];
    return valor instanceof Map ? valor : null;
  }

  async function firebase() {
    if (fbPromise) return fbPromise;
    fbPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
    ]).then(([appMod, authMod, fs]) => {
      const apps = appMod.getApps();
      const app = apps.find(a => a.name === "[DEFAULT]") || apps[0] || appMod.getApp();
      return { ...fs, auth: authMod.getAuth(app), db: fs.getFirestore(app) };
    });
    return fbPromise;
  }

  function buscarProdutoLocal(referencia, tipo) {
    const m = mapa("produtos");
    if (!m) return null;
    const alvo = normalizar(referencia);
    const lista = [...m.values()].filter(p => normalizar(p?.referencia) === alvo);
    return lista.find(p => tipo === "calcinha" ? ehCalcinha(p) : !ehCalcinha(p)) || null;
  }

  async function buscarProduto(fb, referencia, tipo) {
    const local = buscarProdutoLocal(referencia, tipo);
    if (local) return local;
    const valores = [String(referencia).trim()];
    const n = Number(String(referencia).replace(",", "."));
    if (Number.isFinite(n)) valores.push(n);
    const filtro = valores.length > 1 ? fb.where("referencia", "in", [...new Set(valores)]) : fb.where("referencia", "==", valores[0]);
    const q = fb.query(fb.collection(fb.db, "produtos"), filtro);
    let snap = null;
    try { snap = await fb.getDocsFromCache(q); } catch (_) {}
    if (!snap?.docs?.length) snap = await fb.getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).find(p => tipo === "calcinha" ? ehCalcinha(p) : !ehCalcinha(p)) || null;
  }

  function ordensLocais(numeroOP) {
    const m = mapa("ordens");
    if (!m) return null;
    const alvo = normalizar(numeroOP);
    return [...m.values()].filter(op => normalizar(op?.numeroOP || op?.numeroOPExterno || op?.id) === alvo && op?.excluida !== true);
  }

  async function buscarOrdens(fb, numeroOP) {
    const locais = ordensLocais(numeroOP);
    if (locais) return locais;
    const valores = [String(numeroOP).trim()];
    const n = Number(String(numeroOP).replace(",", "."));
    if (Number.isFinite(n)) valores.push(n);
    const filtro = valores.length > 1 ? fb.where("numeroOP", "in", [...new Set(valores)]) : fb.where("numeroOP", "==", valores[0]);
    const q = fb.query(fb.collection(fb.db, "ordensProducao"), filtro);
    let snap = null;
    try { snap = await fb.getDocsFromCache(q); } catch (_) {}
    if (!snap?.docs?.length) snap = await fb.getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(op => op.excluida !== true);
  }

  function dataBRParaISO(valor) {
    const t = String(valor || "").trim();
    let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!m) m = t.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!m) return "";
    let ano = m[3] ? String(m[3]) : String(new Date().getFullYear());
    if (ano.length === 2) ano = `20${ano}`;
    return `${ano}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
  }

  function periodoNecessidade(texto) {
    const partes = normalizar(texto).split(/\s+(?:A|ATE)\s+|[-–—]/i).map(x => x.trim()).filter(Boolean);
    return { inicio: dataBRParaISO(partes[0] || ""), fim: dataBRParaISO(partes[1] || partes[0] || "") };
  }

  function mesPorISO(iso) {
    const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const m = String(iso).match(/^\d{4}-(\d{2})-/);
    return m ? meses[Number(m[1]) - 1] || "" : "";
  }

  function logAssincrono(fb, acao, alvoId, detalhes) {
    const u = fb.auth.currentUser;
    if (!u) return;
    fb.addDoc(fb.collection(fb.db, "logsAlteracoes"), {
      acao, tipoAlvo: "ordemProducao", alvoId: String(alvoId || ""), detalhes,
      usuarioUid: u.uid, usuarioEmail: u.email || "", criadoEm: fb.serverTimestamp()
    }).catch(err => console.warn("[OP199] OP salva, mas o log falhou.", err));
  }

  function sincronizarLocal(id, dados) {
    const m = mapa("ordens");
    if (!m) return;
    const anterior = m.get(String(id)) || {};
    m.set(String(id), { ...anterior, ...dados, id: String(id) });
  }

  function limparFormulario(tipo) {
    const form = document.getElementById("formOrdem");
    form?.reset();
    const id = document.getElementById("ordemId");
    const numero = document.getElementById("ordemNumero");
    const preview = document.getElementById("produtoPreview");
    if (id) id.value = "";
    if (numero) numero.readOnly = false;
    if (preview) { preview.classList.add("hidden"); preview.innerHTML = ""; }
    if (tipo === "calcinha") document.body.dataset.corponuFormType = "calcinha";
  }

  async function salvar(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "formOrdem") return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (salvando) return;
    salvando = true;

    const inicioTempo = performance.now();
    const botao = form.querySelector('button[type="submit"]');
    const texto = botao?.textContent || "Salvar OP";
    if (botao) { botao.disabled = true; botao.textContent = "Salvando..."; }

    try {
      const tipo = tipoFormulario();
      const fb = await firebase();
      const usuario = fb.auth.currentUser;
      if (!usuario) throw new Error("Sua sessão expirou. Entre novamente.");

      const currentId = String(document.getElementById("ordemId")?.value || "").trim();
      const numeroOP = normalizar(document.getElementById("ordemNumero")?.value || "");
      const referencia = normalizar(document.getElementById("ordemReferencia")?.value || "");
      const cor = normalizar(document.getElementById("ordemCor")?.value || "");
      const quantidade = Number(document.getElementById("ordemQuantidade")?.value || 0);
      const necessidadeLivre = String(document.getElementById("ordemNecessidadeTexto")?.value || "").trim();
      const observacoes = String(document.getElementById("ordemObs")?.value || "").trim();

      if (!numeroOP) throw new Error("Digite o número da OP antes de salvar.");
      if (!referencia) throw new Error("Informe a referência da OP.");
      if (!cor) throw new Error("Informe a cor da OP.");
      if (!Number.isFinite(quantidade) || quantidade <= 0) throw new Error("Informe uma quantidade válida.");

      const [produto, existentesTodos] = await Promise.all([
        buscarProduto(fb, referencia, tipo),
        buscarOrdens(fb, numeroOP)
      ]);
      if (!produto) throw new Error(`Cadastre a referência ${referencia} em Produtos antes de salvar a OP.`);

      const existentes = existentesTodos.filter(op => String(op.id) !== currentId);
      let documentoId = currentId || (tipo === "calcinha" ? `calcinha-${safeId(numeroOP)}` : docIdSeguro(numeroOP));
      let ordemAntiga = currentId ? (mapa("ordens")?.get(currentId) || {}) : {};

      if (tipo === "calcinha") {
        const calcinhaExistente = existentes.find(ehCalcinha);
        const outros = existentes.filter(op => !ehCalcinha(op));
        if (calcinhaExistente) throw new Error(`A OP ${numeroOP} já existe corretamente em Calcinha.`);
        if (outros.length > 1) throw new Error(`A OP ${numeroOP} possui mais de um registro conflitante. Confira antes de continuar.`);
        if (outros.length === 1) {
          const antiga = outros[0];
          if (!window.confirm(`A OP ${numeroOP} já existe classificada como Sutiã.\n\nDeseja corrigir esse registro para Calcinha usando os dados deste formulário?`)) return;
          documentoId = antiga.id;
          ordemAntiga = antiga;
        }
      } else if (existentes.length) {
        throw new Error(`A OP ${numeroOP} já existe no sistema. Edite a OP existente.`);
      }

      let dados;
      if (tipo === "calcinha") {
        const necessidadeInicio = document.getElementById("ordemCalcinhaNecessidadeInicio")?.value || "";
        const necessidadeFim = document.getElementById("ordemCalcinhaNecessidadeFim")?.value || "";
        const processo = normalizar(document.getElementById("ordemCalcinhaProcesso")?.value || "");
        const faccao = normalizar(document.getElementById("ordemCalcinhaFaccao")?.value || "");
        if (necessidadeInicio && necessidadeFim && necessidadeInicio > necessidadeFim) throw new Error("A data inicial da necessidade não pode ser maior que a final.");
        if (processo && !PROCESSOS_CALCINHA.has(processo)) throw new Error("O serviço informado não pertence ao fluxo de calcinha.");
        if (!processo && faccao) throw new Error("Selecione o serviço antes de informar a facção.");
        const necessidadeDatas = necessidadeInicio && necessidadeFim
          ? `${necessidadeInicio.split("-").reverse().join("/")} a ${necessidadeFim.split("-").reverse().join("/")}`
          : (necessidadeInicio || necessidadeFim ? (necessidadeInicio || necessidadeFim).split("-").reverse().join("/") : "");
        const necessidade = necessidadeLivre || necessidadeDatas || "";
        dados = {
          numeroOP, referencia, cor, produtoNome: produto.nome || `Calcinha Ref. ${referencia}`, quantidade,
          ano: Number((necessidadeInicio || necessidadeFim).slice(0,4)) || new Date().getFullYear(),
          necessidadeInicio, necessidadeFim, necessidade, necessidadeTexto: necessidade, necessidadeManual: Boolean(necessidade),
          observacoes, tipoPeca: "calcinha", tipoPecaPadrao: "calcinha", tipoPecaLabel: "Calcinha", setor: "calcinha",
          linhaCalcinha: ordemAntiga.linhaCalcinha || ordemAntiga.manejosSetores?.calcinha?.linhaCalcinha || "",
          processoPlanejado: processo, faccaoPlanejada: processo ? faccao : "", planejamentoCalcinhaPendente: !(processo && faccao),
          possuiAlca: false, possuiBojo: false, possuiRenda: false, identidadeCalcinhaConfirmada: true,
          identidadeCalcinhaVersao: VERSION, status: ordemAntiga.status || "aberta",
          atualizadoPor: usuario.uid, atualizadoEm: fb.serverTimestamp()
        };
      } else {
        if (!necessidadeLivre) throw new Error("Informe a necessidade da OP.");
        const periodo = periodoNecessidade(necessidadeLivre);
        if (periodo.inicio && periodo.fim && periodo.inicio > periodo.fim) throw new Error("A data inicial da necessidade não pode ser maior que a final.");
        dados = {
          numeroOP, referencia, cor, produtoNome: produto.nome || `Referência ${referencia}`, quantidade,
          semana: "", mes: periodo.inicio ? mesPorISO(periodo.inicio) : "", ano: periodo.inicio ? Number(periodo.inicio.slice(0,4)) : new Date().getFullYear(),
          necessidadeInicio: periodo.inicio || "", necessidadeFim: periodo.fim || "", necessidade: normalizar(necessidadeLivre),
          necessidadeTexto: normalizar(necessidadeLivre), necessidadeManual: true,
          possuiAlca: Boolean(produto.possuiAlca), possuiBojo: Boolean(produto.possuiBojo), possuiRenda: Boolean(produto.possuiRenda),
          observacoes, status: ordemAntiga.status || "aberta", atualizadoPor: usuario.uid, atualizadoEm: fb.serverTimestamp()
        };
      }

      if (!currentId && !ordemAntiga.criadoEm) {
        dados.criadoPor = usuario.uid;
        dados.criadoEm = fb.serverTimestamp();
      }

      await fb.setDoc(fb.doc(fb.db, "ordensProducao", documentoId), dados, { merge: true });
      sincronizarLocal(documentoId, dados);
      logAssincrono(fb, currentId ? "ordem_atualizada" : "ordem_criada", documentoId, `${tipo === "calcinha" ? "Calcinha" : "Sutiã"} | OP ${numeroOP} | Ref. ${referencia} | Cor ${cor} | Qtd. ${quantidade}`);

      limparFormulario(tipo);
      const tempo = Math.round(performance.now() - inicioTempo);
      console.info(`[OP199] ${numeroOP} salva em ${tempo} ms.`);
      toast(`OP ${numeroOP} salva.`, "success");
    } catch (error) {
      console.error("[OP199] Falha ao salvar OP.", error);
      toast(error?.message || "Erro ao salvar OP.", "error");
    } finally {
      salvando = false;
      if (botao) { botao.disabled = false; botao.textContent = texto; }
    }
  }

  window.__corponuSalvarOrdemRapida199 = salvar;
  window.addEventListener("submit", salvar, true);
  firebase().catch(() => {});
})();
