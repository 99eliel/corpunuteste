(() => {
  "use strict";

  const VERSION = "2026-08-12-faccoes-otimizadas-183";
  const FB = "10.12.5";
  const CONFIG_ID = "grupos-faccoes-processos";
  const FORM_ID = "formFaccao";
  const PAINEL_ID = "painelGerenciarFaccoes";
  const GERENCIADOR_ID = "gerenciadorGruposFaccoesProcessos";
  const FORM_PROCESSOS_ID = "processosPermitidosFaccao43";

  const PROCESSOS_PADRAO = [
    { nome: "ENCAPAR BOJO", atendeSutia: true, atendeCalcinha: false },
    { nome: "ALÇA", atendeSutia: true, atendeCalcinha: false },
    { nome: "LATERAL", atendeSutia: true, atendeCalcinha: false },
    { nome: "INTERLOCK", atendeSutia: true, atendeCalcinha: true },
    { nome: "SUTIÃ MONTAGEM", atendeSutia: true, atendeCalcinha: false },
    { nome: "SUTIÃ COMPLETO", atendeSutia: true, atendeCalcinha: false },
    { nome: "CALCINHA MONTAGEM", atendeSutia: false, atendeCalcinha: true },
    { nome: "CALCINHA COMPLETA", atendeSutia: false, atendeCalcinha: true }
  ];

  const FACCOES_PADRAO = {
    "ENCAPAR BOJO": ["DIVINA", "GRACIANE", "JESSICA", "LARISSA", "ALINE BATISTA", "DAIANY", "NAGILA", "DELMA", "GIRLAINE"],
    "ALÇA": ["JANAINA", "IVONE", "LUANA", "KARYTA", "SIMEI", "SIMONE"],
    "CALCINHA MONTAGEM": ["ANA FLAVIA", "KAUANE", "LIANA", "DAIANA", "LEIDIANE", "ANDREZA"],
    "CALCINHA COMPLETA": ["LORENA", "JEAN", "SCHENEIDER", "DANIELA", "KAMILA", "LIANDRA", "JUZENI", "THEILLOR", "SILVANY", "LEONARDO", "MATHEUS", "BEATRIZ", "MARILIA", "DARLLEN", "RONEIDIA"],
    "SUTIÃ MONTAGEM": ["LIVIA", "FRACEILDA", "MOCINHA", "NAYARA", "NAGILA", "GIRLAINE", "JHENIFER"],
    "SUTIÃ COMPLETO": ["DANUBIA", "KAKA", "GISLAINY", "ITAMAR", "LUCIA", "GOIANIRA"]
  };

  if (window.__CORPONU_FACCOES_GRUPOS_PROCESSOS__ === VERSION) return;
  window.__CORPONU_FACCOES_GRUPOS_PROCESSOS__ = VERSION;

  let contextoPromise = null;
  let dadosCache = null;
  let cacheEm = 0;
  let processoAtual = "";
  let observadorTabela = null;
  let salvandoGrupo = false;
  let salvandoFormulario = false;

  const normalizar = valor => String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

  const escapar = valor => String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function processoCanonico(valor) {
    const texto = normalizar(valor);
    const aliases = {
      "BOJO": "ENCAPAR BOJO",
      "ENCAPAR": "ENCAPAR BOJO",
      "ENCAPA BOJO": "ENCAPAR BOJO",
      "ENCAPAR BOJOS": "ENCAPAR BOJO",
      "ALCA": "ALÇA",
      "ALCAS": "ALÇA",
      "ALÇAS": "ALÇA",
      "SUTIA MONTAGEM": "SUTIÃ MONTAGEM",
      "SUTIA COMPLETO": "SUTIÃ COMPLETO",
      "MONTAGEM CALCINHA": "CALCINHA MONTAGEM"
    };
    return aliases[texto] || texto;
  }

  function slug(valor) {
    return normalizar(valor)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "processo";
  }

  function docIdSeguro(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 180) || `faccao-${Date.now()}`;
  }

  function nomeFaccaoCanonico(valor) {
    const texto = normalizar(valor);
    const aliases = {
      "LARA CRISTINA KAKA": "KAKA",
      "LARA CRISTINA (KAKA)": "KAKA",
      "LARA CRISTINA/KAKA": "KAKA",
      "GISLAINE": "GISLAINY"
    };
    return aliases[texto] || texto;
  }

  function toast(mensagem) {
    const principal = document.getElementById("toast");
    if (principal) {
      principal.textContent = mensagem;
      principal.classList.remove("hidden");
      window.clearTimeout(window.__gfp43Toast);
      window.__gfp43Toast = window.setTimeout(() => principal.classList.add("hidden"), 6000);
      return;
    }
    window.alert(mensagem);
  }

  async function contexto() {
    if (contextoPromise) return contextoPromise;
    contextoPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-firestore.js`)
    ]).then(([appMod, authMod, fs]) => {
      if (!appMod.getApps().length) throw new Error("Firebase ainda não inicializado.");
      const app = appMod.getApp();
      return { auth: authMod.getAuth(app), db: fs.getFirestore(app), fs };
    }).catch(error => {
      contextoPromise = null;
      throw error;
    });
    return contextoPromise;
  }

  async function aguardarUsuario(auth) {
    if (auth.currentUser) return auth.currentUser;
    for (let tentativa = 0; tentativa < 40; tentativa += 1) {
      await new Promise(resolve => setTimeout(resolve, 150));
      if (auth.currentUser) return auth.currentUser;
    }
    throw new Error("Usuário ainda não autenticado.");
  }

  function adicionarProcesso(mapa, valor, metadados = {}) {
    const nome = processoCanonico(typeof valor === "string" ? valor : valor?.nome || valor?.processo || valor?.servicoNome || "");
    if (!nome || ["TODOS", "TODAS", "SELECIONE"].includes(nome)) return;
    const atual = mapa.get(nome) || { nome, atendeSutia: false, atendeCalcinha: false };
    const setor = normalizar(metadados.setor || metadados.area || metadados.tipoPeca || valor?.setor || valor?.area || "");
    const atendeSutia = metadados.atendeSutia === true || valor?.atendeSutia === true || setor.includes("SUTIA") || /SUTIA|BOJO|ALCA|LATERAL/.test(normalizar(nome));
    const atendeCalcinha = metadados.atendeCalcinha === true || valor?.atendeCalcinha === true || setor.includes("CALCINHA") || normalizar(nome).includes("CALCINHA");
    atual.atendeSutia = atual.atendeSutia || atendeSutia;
    atual.atendeCalcinha = atual.atendeCalcinha || atendeCalcinha;
    if (!atual.atendeSutia && !atual.atendeCalcinha) {
      atual.atendeSutia = true;
      atual.atendeCalcinha = true;
    }
    mapa.set(nome, atual);
  }

  function processosDaFaccao(faccao) {
    return [...new Set((Array.isArray(faccao?.processosPermitidos) ? faccao.processosPermitidos : [])
      .map(processoCanonico)
      .filter(Boolean))];
  }

  function grupoDerivado(processo, faccoes) {
    const nome = processoCanonico(processo);
    const nomesPadrao = new Set((FACCOES_PADRAO[nome] || []).map(nomeFaccaoCanonico));
    return faccoes.filter(faccao => {
      const permitidos = processosDaFaccao(faccao);
      return permitidos.includes(nome) || nomesPadrao.has(nomeFaccaoCanonico(faccao.nome));
    }).map(faccao => faccao.id);
  }

  async function carregarDados(forcar = false) {
    if (!forcar && dadosCache && Date.now() - cacheEm < 25000) return dadosCache;
    const { auth, db, fs } = await contexto();
    const usuario = await aguardarUsuario(auth);
    const [perfilSnap, faccoesSnap, precosSnap, processosCorteSnap, gruposSnap] = await Promise.all([
      fs.getDoc(fs.doc(db, "usuarios", usuario.uid)),
      fs.getDocs(fs.collection(db, "faccoes")),
      fs.getDocs(fs.collection(db, "precosReferencia")),
      fs.getDoc(fs.doc(db, "configuracoes", "processos-corte")),
      fs.getDoc(fs.doc(db, "configuracoes", CONFIG_ID))
    ]);

    const perfil = perfilSnap.exists() ? perfilSnap.data() : {};
    const faccoes = faccoesSnap.docs.map(item => ({ id: item.id, ...item.data() }))
      .filter(item => item.ativo !== false && !item.cadastroPendente && !item.duplicadaDe && item.statusImportacao !== "duplicada_consolidada")
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { numeric: true }));

    const mapaProcessos = new Map();
    PROCESSOS_PADRAO.forEach(item => adicionarProcesso(mapaProcessos, item, item));
    faccoes.forEach(faccao => processosDaFaccao(faccao).forEach(nome => adicionarProcesso(mapaProcessos, nome)));
    precosSnap.docs.forEach(item => {
      const preco = item.data();
      if (preco.ativo === false) return;
      adicionarProcesso(mapaProcessos, preco.processo || preco.servicoNome, preco);
    });
    const configCorte = processosCorteSnap.exists() ? processosCorteSnap.data() : {};
    (Array.isArray(configCorte.processos) ? configCorte.processos : []).forEach(item => {
      if (item?.ativo === false) return;
      adicionarProcesso(mapaProcessos, item, item);
    });

    const processos = [...mapaProcessos.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
    const configuracao = gruposSnap.exists() ? gruposSnap.data() : {};
    const gruposSalvos = configuracao.grupos && typeof configuracao.grupos === "object" ? configuracao.grupos : {};
    const grupos = {};
    processos.forEach(processo => {
      const chave = slug(processo.nome);
      const salvo = gruposSalvos[chave];
      const ids = Array.isArray(salvo?.faccaoIds) ? salvo.faccaoIds.filter(id => faccoes.some(faccao => faccao.id === id)) : grupoDerivado(processo.nome, faccoes);
      grupos[chave] = {
        processo: processo.nome,
        faccaoIds: [...new Set(ids)],
        configurado: Boolean(salvo?.configurado)
      };
    });

    dadosCache = { usuario, perfil, faccoes, processos, grupos, gruposSalvos };
    cacheEm = Date.now();
    return dadosCache;
  }

  function ehAdmin(dados = dadosCache) {
    return normalizar(dados?.perfil?.tipo) === "ADMIN" && dados?.perfil?.ativo !== false;
  }

  function injetarEstilos() {
    if (document.getElementById("styleFaccoesGruposProcessos43")) return;
    const style = document.createElement("style");
    style.id = "styleFaccoesGruposProcessos43";
    style.textContent = `
      #${GERENCIADOR_ID}{margin:14px 0;padding:17px;border:1px solid #d8e2ee;border-radius:17px;background:#fff;box-shadow:0 7px 20px rgba(15,23,42,.045)}
      #${GERENCIADOR_ID}.hidden{display:none!important}.gfp43-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}.gfp43-head h3{margin:0;color:#0f172a;font-size:18px}.gfp43-head p{margin:4px 0 0;color:#64748b;font-size:12px}.gfp43-controles{display:grid;grid-template-columns:minmax(220px,.9fr) minmax(230px,1.2fr) auto;gap:10px;align-items:end;padding:13px;border:1px solid #e2e8f0;border-radius:13px;background:#f8fafc}.gfp43-controles label{margin:0}.gfp43-controles select,.gfp43-controles input{width:100%;min-height:42px;margin-top:5px}.gfp43-acoes{display:flex;gap:7px;flex-wrap:wrap}.gfp43-resumo{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:13px 2px 9px;color:#475569;font-size:11px;font-weight:800}.gfp43-lista{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;max-height:420px;overflow:auto;padding:2px}.gfp43-faccao{display:flex;align-items:flex-start;gap:10px;padding:11px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;cursor:pointer}.gfp43-faccao:hover{border-color:#a78bfa;background:#faf5ff}.gfp43-faccao.selecionada{border-color:#7c3aed;background:#f5f3ff;box-shadow:0 0 0 2px rgba(124,58,237,.08)}.gfp43-faccao input{width:18px;height:18px;margin:1px 0 0;accent-color:#7c3aed}.gfp43-faccao strong{display:block;color:#0f172a;font-size:12px}.gfp43-faccao small{display:block;margin-top:3px;color:#64748b;font-size:10px}.gfp43-vazio{grid-column:1/-1;padding:26px;border:1px dashed #cbd5e1;border-radius:12px;color:#64748b;text-align:center}
      #${FORM_PROCESSOS_ID}{grid-column:1/-1;padding:14px;border:1px solid #c4b5fd;border-radius:14px;background:#faf5ff}#${FORM_PROCESSOS_ID} h4{margin:0;color:#4c1d95;font-size:14px}#${FORM_PROCESSOS_ID}>p{margin:4px 0 11px;color:#64748b;font-size:11px}.gfp43-form-grupos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.gfp43-form-grupo{padding:10px;border:1px solid #e2e8f0;border-radius:11px;background:#fff}.gfp43-form-grupo>strong{display:block;margin-bottom:7px;color:#334155;font-size:11px;text-transform:uppercase}.gfp43-form-checks{display:grid;gap:6px}.gfp43-form-check{display:flex;align-items:center;gap:7px;margin:0;color:#0f172a;font-size:11px;font-weight:800}.gfp43-form-check input{width:16px;height:16px;accent-color:#7c3aed}.gfp43-processos-cell{min-width:220px}.gfp43-chips{display:flex;gap:4px;flex-wrap:wrap}.gfp43-chip{display:inline-flex;padding:4px 7px;border-radius:999px;background:#ede9fe;color:#5b21b6;font-size:9px;font-weight:900}.gfp43-chip.extra{background:#f1f5f9;color:#475569}
      @media(max-width:1050px){.gfp43-lista{grid-template-columns:repeat(2,minmax(0,1fr))}.gfp43-controles{grid-template-columns:1fr 1fr}.gfp43-acoes{grid-column:1/-1}.gfp43-form-grupos{grid-template-columns:1fr 1fr}}
      @media(max-width:680px){#${GERENCIADOR_ID}{padding:13px}.gfp43-head{flex-direction:column}.gfp43-controles,.gfp43-lista,.gfp43-form-grupos{grid-template-columns:1fr}.gfp43-acoes{display:grid;grid-template-columns:1fr 1fr}.gfp43-acoes .btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function garantirGerenciador() {
    const painel = document.getElementById(PAINEL_ID);
    const form = document.getElementById(FORM_ID);
    if (!painel || !form) return null;
    let box = document.getElementById(GERENCIADOR_ID);
    if (!box) {
      box = document.createElement("section");
      box.id = GERENCIADOR_ID;
      box.className = "admin-only-block hidden";
      box.innerHTML = `
        <div class="gfp43-head"><div><h3>Grupos de trabalho por processo</h3><p>Escolha um processo e defina exatamente quais facções podem realizá-lo.</p></div><span class="badge info">Somente administradores</span></div>
        <div class="gfp43-controles">
          <label>Processo<select id="gfp43Processo"><option value="">Carregando processos...</option></select></label>
          <label>Buscar facção<input id="gfp43Busca" type="search" placeholder="Nome ou cidade..." autocomplete="off"></label>
          <div class="gfp43-acoes"><button class="btn" id="gfp43SelecionarVisiveis" type="button">Selecionar visíveis</button><button class="btn" id="gfp43Limpar" type="button">Limpar</button><button class="btn btn-primary" id="gfp43Salvar" type="button">Salvar grupo</button></div>
        </div>
        <div class="gfp43-resumo"><span id="gfp43TextoResumo">Selecione um processo.</span><span id="gfp43Contagem">0 selecionadas</span></div>
        <div class="gfp43-lista" id="gfp43Lista"><div class="gfp43-vazio">Selecione um processo para gerenciar o grupo.</div></div>`;
      const referencia = painel.querySelector(".faccoes-import-box") || form;
      referencia.insertAdjacentElement("afterend", box);
      configurarEventosGerenciador();
    }
    return box;
  }

  function garantirProcessosNoFormulario() {
    const form = document.getElementById(FORM_ID);
    if (!form) return null;
    let box = document.getElementById(FORM_PROCESSOS_ID);
    if (!box) {
      box = document.createElement("section");
      box.id = FORM_PROCESSOS_ID;
      box.innerHTML = `<h4>Processos que esta facção realiza</h4><p>As escolhas definem em quais grupos a facção aparecerá durante o registro de saída.</p><div class="gfp43-form-grupos" id="gfp43FormGrupos"></div>`;
      const classificacao = document.getElementById("corteClassificacaoFaccao");
      const observacoes = document.getElementById("faccaoObs")?.closest("label");
      if (classificacao?.parentElement === form) classificacao.insertAdjacentElement("afterend", box);
      else if (observacoes) form.insertBefore(box, observacoes);
      else form.appendChild(box);
    }
    return box;
  }

  function gruposProcessosFormulario(processos) {
    return [
      { titulo: "Sutiã", itens: processos.filter(item => item.atendeSutia && !item.atendeCalcinha) },
      { titulo: "Calcinha", itens: processos.filter(item => item.atendeCalcinha && !item.atendeSutia) },
      { titulo: "Gerais", itens: processos.filter(item => item.atendeSutia && item.atendeCalcinha) }
    ].filter(grupo => grupo.itens.length);
  }

  function renderProcessosFormulario(dados, selecionados = []) {
    garantirProcessosNoFormulario();
    const destino = document.getElementById("gfp43FormGrupos");
    if (!destino) return;
    const marcados = new Set(selecionados.map(processoCanonico));
    destino.innerHTML = gruposProcessosFormulario(dados.processos).map(grupo => `
      <div class="gfp43-form-grupo"><strong>${escapar(grupo.titulo)}</strong><div class="gfp43-form-checks">${grupo.itens.map(item => `
        <label class="gfp43-form-check"><input type="checkbox" data-gfp43-processo="${escapar(item.nome)}" ${marcados.has(item.nome) ? "checked" : ""}><span>${escapar(item.nome)}</span></label>`).join("")}</div></div>`).join("");
    sincronizarClassificacaoFormulario();
  }

  function processosMarcadosFormulario() {
    return [...document.querySelectorAll("#gfp43FormGrupos [data-gfp43-processo]:checked")]
      .map(input => processoCanonico(input.dataset.gfp43Processo))
      .filter(Boolean);
  }

  function sincronizarClassificacaoFormulario() {
    if (!dadosCache) return;
    const selecionados = new Set(processosMarcadosFormulario());
    const sutia = dadosCache.processos.some(item => selecionados.has(item.nome) && item.atendeSutia);
    const calcinha = dadosCache.processos.some(item => selecionados.has(item.nome) && item.atendeCalcinha);
    const campoSutia = document.getElementById("faccaoTrabalhaSutia");
    const campoCalcinha = document.getElementById("faccaoTrabalhaCalcinha");
    if (campoSutia) campoSutia.checked = sutia;
    if (campoCalcinha) campoCalcinha.checked = calcinha;
  }

  function faccaoAtualDoFormulario(dados) {
    const id = document.getElementById("faccaoId")?.value || "";
    const nome = nomeFaccaoCanonico(document.getElementById("faccaoNome")?.value || "");
    return dados.faccoes.find(item => item.id === id) || dados.faccoes.find(item => nomeFaccaoCanonico(item.nome) === nome) || null;
  }

  async function prepararFormularioEdicao(novo = false) {
    const dados = await carregarDados();
    if (!ehAdmin(dados)) return;
    const faccao = novo ? null : faccaoAtualDoFormulario(dados);
    renderProcessosFormulario(dados, faccao ? processosDaFaccao(faccao) : []);
  }

  function renderListaGrupo() {
    const dados = dadosCache;
    const lista = document.getElementById("gfp43Lista");
    const resumo = document.getElementById("gfp43TextoResumo");
    const contagem = document.getElementById("gfp43Contagem");
    if (!dados || !lista) return;
    const grupo = dados.grupos[slug(processoAtual)];
    if (!processoAtual || !grupo) {
      lista.innerHTML = '<div class="gfp43-vazio">Selecione um processo para gerenciar o grupo.</div>';
      if (resumo) resumo.textContent = "Selecione um processo.";
      if (contagem) contagem.textContent = "0 selecionadas";
      return;
    }
    const busca = normalizar(document.getElementById("gfp43Busca")?.value || "");
    const selecionadas = new Set(grupo.faccaoIds || []);
    const faccoes = dados.faccoes.filter(item => !busca || normalizar(`${item.nome} ${item.cidade}`).includes(busca));
    lista.innerHTML = faccoes.length ? faccoes.map(faccao => `
      <label class="gfp43-faccao ${selecionadas.has(faccao.id) ? "selecionada" : ""}" data-gfp43-faccao-card>
        <input type="checkbox" data-gfp43-faccao="${escapar(faccao.id)}" ${selecionadas.has(faccao.id) ? "checked" : ""}>
        <span><strong>${escapar(faccao.nome || "-")}</strong><small>${escapar(faccao.cidade || "Cidade não informada")}</small></span>
      </label>`).join("") : '<div class="gfp43-vazio">Nenhuma facção encontrada.</div>';
    if (resumo) resumo.textContent = `Facções autorizadas para ${processoAtual}`;
    if (contagem) contagem.textContent = `${selecionadas.size.toLocaleString("pt-BR")} selecionada(s)`;
  }

  function atualizarSelecaoVisual() {
    document.querySelectorAll("[data-gfp43-faccao-card]").forEach(card => card.classList.toggle("selecionada", Boolean(card.querySelector("input")?.checked)));
    const total = document.querySelectorAll("#gfp43Lista [data-gfp43-faccao]:checked").length;
    const contagem = document.getElementById("gfp43Contagem");
    if (contagem) contagem.textContent = `${total.toLocaleString("pt-BR")} selecionada(s)`;
  }

  function selecionarVisiveis(valor) {
    document.querySelectorAll("#gfp43Lista [data-gfp43-faccao]").forEach(input => {
      const card = input.closest("[data-gfp43-faccao-card]");
      if (card && getComputedStyle(card).display !== "none") input.checked = valor;
    });
    atualizarSelecaoVisual();
  }

  async function registrarLog(fs, db, usuario, acao, detalhes) {
    try {
      await fs.addDoc(fs.collection(db, "logsAlteracoes"), {
        acao,
        tipoAlvo: "faccao",
        alvoId: CONFIG_ID,
        detalhes,
        usuarioUid: usuario.uid,
        usuarioEmail: usuario.email || "",
        criadoEm: fs.serverTimestamp(),
        versao: VERSION
      });
    } catch (error) {
      console.warn("Alteração salva, mas o log complementar não foi criado.", error);
    }
  }

  async function salvarGrupo() {
    if (salvandoGrupo || !processoAtual) return;
    const dados = await carregarDados(true);
    if (!ehAdmin(dados)) return toast("Apenas administradores podem gerenciar grupos de facções.");
    const selecionados = [...document.querySelectorAll("#gfp43Lista [data-gfp43-faccao]:checked")].map(input => input.dataset.gfp43Faccao);
    const botao = document.getElementById("gfp43Salvar");
    salvandoGrupo = true;
    if (botao) { botao.disabled = true; botao.textContent = "Salvando grupo..."; }
    try {
      const { auth, db, fs } = await contexto();
      const usuario = await aguardarUsuario(auth);
      const chave = slug(processoAtual);
      const gruposAtuaisSnap = await fs.getDoc(fs.doc(db, "configuracoes", CONFIG_ID));
      const configAtual = gruposAtuaisSnap.exists() ? gruposAtuaisSnap.data() : {};
      const grupos = { ...(configAtual.grupos || {}) };
      grupos[chave] = { processo: processoAtual, faccaoIds: selecionados, configurado: true };

      const batch = fs.writeBatch(db);
      dados.faccoes.forEach(faccao => {
        const atuais = new Set(processosDaFaccao(faccao));
        if (selecionados.includes(faccao.id)) atuais.add(processoAtual); else atuais.delete(processoAtual);
        const lista = [...atuais].sort((a, b) => a.localeCompare(b, "pt-BR"));
        const sutia = dados.processos.some(item => lista.includes(item.nome) && item.atendeSutia);
        const calcinha = dados.processos.some(item => lista.includes(item.nome) && item.atendeCalcinha);
        batch.set(fs.doc(db, "faccoes", faccao.id), {
          processosPermitidos: lista,
          trabalhaSutia: sutia,
          trabalhaCalcinha: calcinha,
          atualizadoPor: usuario.uid,
          atualizadoEm: fs.serverTimestamp()
        }, { merge: true });
      });
      batch.set(fs.doc(db, "configuracoes", CONFIG_ID), {
        grupos,
        atualizadoPor: usuario.uid,
        atualizadoEm: fs.serverTimestamp(),
        versao: VERSION
      }, { merge: true });
      await batch.commit();
      await registrarLog(fs, db, usuario, "grupo_faccoes_processo_atualizado", `${processoAtual} | ${selecionados.length} facção(ões)`);
      dadosCache = null;
      await inicializarDados(true);
      toast(`Grupo de ${processoAtual} salvo com ${selecionados.length} facção(ões).`);
    } catch (error) {
      console.error(error);
      toast("Não foi possível salvar o grupo de facções.");
    } finally {
      salvandoGrupo = false;
      if (botao) { botao.disabled = false; botao.textContent = "Salvar grupo"; }
    }
  }

  async function salvarProcessosDoFormulario(snapshot) {
    if (salvandoFormulario || !snapshot.nome || !snapshot.cidade) return;
    salvandoFormulario = true;
    try {
      const dados = await carregarDados(true);
      if (!ehAdmin(dados)) return;
      const { auth, db, fs } = await contexto();
      const usuario = await aguardarUsuario(auth);
      const id = snapshot.id || docIdSeguro(snapshot.nome);
      const existente = dados.faccoes.find(item => item.id === id) || dados.faccoes.find(item => nomeFaccaoCanonico(item.nome) === nomeFaccaoCanonico(snapshot.nome));
      const anteriores = new Set(processosDaFaccao(existente || {}));
      const selecionados = [...new Set(snapshot.processos.map(processoCanonico))].sort((a, b) => a.localeCompare(b, "pt-BR"));
      const sutia = dados.processos.some(item => selecionados.includes(item.nome) && item.atendeSutia);
      const calcinha = dados.processos.some(item => selecionados.includes(item.nome) && item.atendeCalcinha);

      await new Promise(resolve => setTimeout(resolve, 180));
      await fs.setDoc(fs.doc(db, "faccoes", id), {
        processosPermitidos: selecionados,
        trabalhaSutia: sutia,
        trabalhaCalcinha: calcinha,
        gruposPermitidos: [sutia ? "SUTIÃ" : "", calcinha ? "CALCINHA" : ""].filter(Boolean),
        atualizadoPor: usuario.uid,
        atualizadoEm: fs.serverTimestamp()
      }, { merge: true });

      const configSnap = await fs.getDoc(fs.doc(db, "configuracoes", CONFIG_ID));
      const config = configSnap.exists() ? configSnap.data() : {};
      const grupos = { ...(config.grupos || {}) };
      const tocados = new Set([...anteriores, ...selecionados]);
      tocados.forEach(processo => {
        const chave = slug(processo);
        const base = grupos[chave] || dados.grupos[chave] || { processo, faccaoIds: [] };
        const ids = new Set(Array.isArray(base.faccaoIds) ? base.faccaoIds : []);
        if (selecionados.includes(processo)) ids.add(id); else ids.delete(id);
        grupos[chave] = { processo, faccaoIds: [...ids], configurado: true };
      });
      await fs.setDoc(fs.doc(db, "configuracoes", CONFIG_ID), {
        grupos,
        atualizadoPor: usuario.uid,
        atualizadoEm: fs.serverTimestamp(),
        versao: VERSION
      }, { merge: true });
      await registrarLog(fs, db, usuario, "processos_faccao_atualizados", `${snapshot.nome} | ${selecionados.join(", ") || "sem processos"}`);
      dadosCache = null;
      window.setTimeout(() => inicializarDados(true), 350);
    } catch (error) {
      console.error("Erro ao salvar os processos da facção.", error);
      toast("A facção foi salva, mas não foi possível atualizar os grupos de processos.");
    } finally {
      salvandoFormulario = false;
    }
  }

  function configurarEventosGerenciador() {
    document.getElementById("gfp43Processo")?.addEventListener("change", event => {
      processoAtual = processoCanonico(event.target.value);
      renderListaGrupo();
    });
    document.getElementById("gfp43Busca")?.addEventListener("input", renderListaGrupo);
    document.getElementById("gfp43SelecionarVisiveis")?.addEventListener("click", () => selecionarVisiveis(true));
    document.getElementById("gfp43Limpar")?.addEventListener("click", () => selecionarVisiveis(false));
    document.getElementById("gfp43Salvar")?.addEventListener("click", salvarGrupo);
    document.getElementById("gfp43Lista")?.addEventListener("change", atualizarSelecaoVisual);
  }

  function preencherGerenciador(dados) {
    const box = garantirGerenciador();
    if (!box) return;
    box.classList.toggle("hidden", !ehAdmin(dados));
    if (!ehAdmin(dados)) return;
    const select = document.getElementById("gfp43Processo");
    if (select) {
      const anterior = processoAtual || select.value;
      select.innerHTML = '<option value="">Selecione o processo</option>' + dados.processos.map(item => `<option value="${escapar(item.nome)}">${escapar(item.nome)}</option>`).join("");
      if (dados.processos.some(item => item.nome === anterior)) select.value = anterior;
    }
    renderListaGrupo();
  }

  function atualizarColunaProcessos(dados) {
    const tabela = document.querySelector("#listaFaccoes")?.closest("table");
    const cabecalho = tabela?.querySelector("thead tr");
    if (!tabela || !cabecalho) return;
    if (!cabecalho.querySelector(".gfp43-th-processos")) {
      const th = document.createElement("th");
      th.className = "gfp43-th-processos";
      th.textContent = "Processos";
      const status = [...cabecalho.children].find(item => normalizar(item.textContent) === "STATUS");
      cabecalho.insertBefore(th, status || cabecalho.lastElementChild);
    }
    document.querySelectorAll("#listaFaccoes tr").forEach(linha => {
      if (linha.querySelector(".empty") || linha.querySelector(".gfp43-processos-cell")) return;
      const botaoEditar = linha.querySelector("button[onclick*='editarFaccao']");
      const id = botaoEditar?.getAttribute("onclick")?.match(/editarFaccao\(['\"]([^'\"]+)/)?.[1] || "";
      const nome = linha.querySelector("td strong")?.textContent || "";
      const faccao = dados.faccoes.find(item => item.id === id) || dados.faccoes.find(item => nomeFaccaoCanonico(item.nome) === nomeFaccaoCanonico(nome));
      const td = document.createElement("td");
      td.className = "gfp43-processos-cell";
      const processos = processosDaFaccao(faccao || {});
      td.innerHTML = processos.length ? `<div class="gfp43-chips">${processos.slice(0, 3).map(item => `<span class="gfp43-chip">${escapar(item)}</span>`).join("")}${processos.length > 3 ? `<span class="gfp43-chip extra">+${processos.length - 3}</span>` : ""}</div>` : '<span class="muted">Nenhum processo</span>';
      const statusCell = [...linha.children].find(item => item.querySelector(".status-dot"));
      linha.insertBefore(td, statusCell || linha.lastElementChild);
    });
  }

  function instalarObservadorTabela() {
    const tbody = document.getElementById("listaFaccoes");
    if (!tbody) return;
    observadorTabela?.disconnect();
    observadorTabela = new MutationObserver(() => {
      if (dadosCache) atualizarColunaProcessos(dadosCache);
    });
    observadorTabela.observe(tbody, { childList: true });
  }

  function faccoesDoGrupo(processo, dados) {
    const grupo = dados.grupos[slug(processo)];
    const ids = new Set(grupo?.faccaoIds || []);
    return dados.faccoes.filter(item => ids.has(item.id));
  }

  async function preencherSelectFaccoesPorProcesso(selectProcesso, selectFaccao) {
    if (!(selectProcesso instanceof HTMLSelectElement || selectProcesso instanceof HTMLInputElement) || !(selectFaccao instanceof HTMLSelectElement)) return;
    const processo = processoCanonico(selectProcesso.value);
    if (!processo) {
      selectFaccao.innerHTML = '<option value="">Escolha o processo primeiro</option>';
      selectFaccao.disabled = true;
      return;
    }
    try {
      const dados = await carregarDados();
      const atual = selectFaccao.value;
      const faccoes = faccoesDoGrupo(processo, dados);
      selectFaccao.innerHTML = faccoes.length
        ? '<option value="">Selecione a facção</option>' + faccoes.map(item => `<option value="${escapar(item.nome || "")}">${escapar(item.nome || "")}</option>`).join("")
        : '<option value="">Nenhuma facção habilitada para este processo</option>';
      selectFaccao.disabled = !faccoes.length;
      if (faccoes.some(item => normalizar(item.nome) === normalizar(atual))) selectFaccao.value = atual;
    } catch (error) {
      console.error("Erro ao filtrar facções por processo.", error);
    }
  }

  function aplicarFiltrosSaida() {
    const processoSaida = document.getElementById("s3processo");
    const faccaoSaida = document.getElementById("s3faccao");
    if (processoSaida && faccaoSaida && !processoSaida.dataset.gfp43Filtro) {
      processoSaida.dataset.gfp43Filtro = "1";
      processoSaida.addEventListener("change", () => preencherSelectFaccoesPorProcesso(processoSaida, faccaoSaida));
    }
    const processoMov = document.getElementById("movimentacaoProcessoSelect") || document.getElementById("movimentacaoProcesso");
    const faccaoMov = document.getElementById("movimentacaoDestino");
    if (processoMov && faccaoMov && !processoMov.dataset.gfp43Filtro) {
      processoMov.dataset.gfp43Filtro = "1";
      const atualizar = () => window.setTimeout(() => preencherSelectFaccoesPorProcesso(processoMov, faccaoMov), 0);
      processoMov.addEventListener("change", atualizar);
      processoMov.addEventListener("input", atualizar);
    }
  }

  async function inicializarDados(forcar = false) {
    try {
      const dados = await carregarDados(forcar);
      garantirGerenciador();
      garantirProcessosNoFormulario();
      preencherGerenciador(dados);
      renderProcessosFormulario(dados, processosMarcadosFormulario());
      atualizarColunaProcessos(dados);
      instalarObservadorTabela();
      aplicarFiltrosSaida();
    } catch (error) {
      console.error("Não foi possível carregar os grupos de facções.", error);
    }
  }

  function instalarEventosGlobais() {
    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (!alvo) return;
      if (alvo.closest("#btnToggleGerenciarFaccoes")) window.setTimeout(() => inicializarDados(true), 100);
      if (alvo.closest("#btnAbrirCadastroFaccao")) window.setTimeout(() => prepararFormularioEdicao(true), 50);
      if (alvo.closest("button[onclick*='editarFaccao']")) window.setTimeout(() => prepararFormularioEdicao(false), 50);
      if (alvo.closest("#btnSaidaAbas, #btnSaidaCorteNovo, [onclick*='mandarParaFaccao']")) {
        window.setTimeout(aplicarFiltrosSaida, 100);
        window.setTimeout(aplicarFiltrosSaida, 500);
      }
    }, true);

    document.addEventListener("change", event => {
      if (event.target instanceof Element && event.target.matches("#gfp43FormGrupos [data-gfp43-processo]")) sincronizarClassificacaoFormulario();
    });

    const form = document.getElementById(FORM_ID);
    if (form && !form.dataset.gfp43Submit) {
      form.dataset.gfp43Submit = "1";
      form.addEventListener("submit", () => {
        const snapshot = {
          id: document.getElementById("faccaoId")?.value || "",
          nome: document.getElementById("faccaoNome")?.value?.trim() || "",
          cidade: document.getElementById("faccaoCidade")?.value?.trim() || "",
          processos: processosMarcadosFormulario()
        };
        window.setTimeout(() => salvarProcessosDoFormulario(snapshot), 0);
      }, true);
    }
  }

  function iniciar() {
    injetarEstilos();
    garantirGerenciador();
    garantirProcessosNoFormulario();
    instalarEventosGlobais();
    let tentativas = 0;
    const intervalo = window.setInterval(() => {
      tentativas += 1;
      garantirGerenciador();
      garantirProcessosNoFormulario();
      aplicarFiltrosSaida();
      if (tentativas === 1 || tentativas === 5 || tentativas === 12) inicializarDados(tentativas > 1);
      if (tentativas >= 20) window.clearInterval(intervalo);
    }, 300);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();