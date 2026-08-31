(() => {
  "use strict";

  const VERSION = "2026-08-31-lateral-alca-v2-270";
  const FB = "10.12.5";
  const AREA_LEGADA = "corte";
  const FLUXO = "lateral_alca";
  const CACHE_MS = 90 * 1000;
  const OP_CACHE_MS = 2 * 60 * 1000;
  const LIMITE_RENDER_INICIAL = 200;
  const VALOR_FIXO_CORTAGEM_MONTAGEM = 0.0540;

  const PROCESSOS = Object.freeze([
    Object.freeze({
      id: "lateral",
      nome: "LATERAL",
      grupo: "lateral",
      grupoLabel: "Lateral",
      faccaoProcesso: "LATERAL",
      tipoValor: "referencia",
      marcaLateralPronta: true
    }),
    Object.freeze({
      id: "alca",
      nome: "ALÇA",
      grupo: "alca",
      grupoLabel: "Alça",
      faccaoProcesso: "ALÇA",
      tipoValor: "global_alca",
      marcaLateralPronta: false
    }),
    Object.freeze({
      id: "cortagem-montagem",
      nome: "CORTAGEM E MONTAGEM",
      grupo: "alca",
      grupoLabel: "Alça",
      faccaoProcesso: "ALÇA",
      tipoValor: "fixo",
      valorFixo: VALOR_FIXO_CORTAGEM_MONTAGEM,
      marcaLateralPronta: false
    })
  ]);

  if (window.__CORPONU_FACCOES_LATERAL_ALCA_V2__ === VERSION) return;
  window.__CORPONU_FACCOES_LATERAL_ALCA_V2__ = VERSION;

  let contextoPromise = null;
  let usuario = null;
  let perfil = null;
  let movimentosArea = [];
  let movimentosLegados = [];
  let movimentos = [];
  let opSaida = null;
  let movimentoChegada = null;
  let listenerArea = null;
  let listenerPrimeiroSnapshot = null;
  let carregadoEm = 0;
  let carregando = false;
  let limiteRender = LIMITE_RENDER_INICIAL;
  let timerBusca = 0;
  const cacheOps = new Map();

  const norm = valor => String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

  const esc = valor => String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const num = (valor, fallback = 0) => {
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : fallback;
    const texto = String(valor ?? "").trim();
    if (!texto) return fallback;
    const parsed = Number(texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const arred2 = valor => Math.round((num(valor) + Number.EPSILON) * 100) / 100;
  const arred4 = valor => Math.round((num(valor) + Number.EPSILON) * 10000) / 10000;
  const qtd = valor => num(valor).toLocaleString("pt-BR");
  const dinheiro = valor => num(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dinheiro4 = valor => `R$ ${num(valor).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
  const hoje = () => new Date().toISOString().slice(0, 10);
  const slug = valor => norm(valor).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
  const ehAdmin = () => norm(perfil?.tipo) === "ADMIN" && perfil?.ativo !== false;
  const painelVisivel = () => !document.getElementById("painelFaccoesCorte")?.classList.contains("hidden");

  function processoCanonico(valor) {
    const chave = norm(valor);
    if (["ALCA", "ALCAS", "ALÇAS"].includes(chave)) return "ALÇA";
    if (["CORTAGEM MONTAGEM", "CORTAGEM E MONTAGEM", "CORTE E MONTAGEM"].includes(chave)) return "CORTAGEM E MONTAGEM";
    if (chave === "LATERAL") return "LATERAL";
    return chave;
  }

  function processoPorId(id) {
    return PROCESSOS.find(item => item.id === String(id || "")) || null;
  }

  function processoPorNome(nome) {
    const canonico = processoCanonico(nome);
    return PROCESSOS.find(item => item.nome === canonico) || null;
  }

  function movimentoCancelado(item) {
    return item?.cancelado === true ||
      item?.excluido === true ||
      ["CANCELADO", "CANCELADA", "EXCLUIDO", "EXCLUÍDO"].includes(norm(item?.status));
  }

  function pertenceLateralAlca(item) {
    if (!item) return false;
    if (item.fluxoFaccoes === FLUXO) return true;
    const processo = processoCanonico(item.processo || item.servicoNome || item.processoMovimentacao);
    if (!processoPorNome(processo)) return false;
    return item.area === AREA_LEGADA ||
      item.setor === AREA_LEGADA ||
      item.movimentacaoCorte === true ||
      processo === "LATERAL" ||
      processo === "ALÇA" ||
      processo === "CORTAGEM E MONTAGEM";
  }

  function dataBR(valor) {
    if (!valor) return "-";
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(valor))) {
      const [ano, mes, dia] = String(valor).split("-");
      return `${dia}/${mes}/${ano}`;
    }
    const data = valor?.toDate ? valor.toDate() : new Date(valor);
    return Number.isNaN(data.getTime()) ? String(valor) : data.toLocaleDateString("pt-BR");
  }

  function momento(item) {
    return item?.atualizadoEm?.toMillis?.() ||
      item?.criadoEm?.toMillis?.() ||
      Date.parse(item?.dataChegada || item?.dataEnvio || "") ||
      0;
  }

  function toast(mensagem, tipo = "info") {
    const principal = document.getElementById("toast");
    if (principal) {
      principal.textContent = mensagem;
      principal.classList.remove("hidden");
      clearTimeout(window.__la2Toast);
      window.__la2Toast = setTimeout(() => principal.classList.add("hidden"), 6000);
      return;
    }
    if (tipo === "error") console.error(mensagem);
    else console.info(mensagem);
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
      return { auth: authMod.getAuth(app), onAuth: authMod.onAuthStateChanged, db: fs.getFirestore(app), fs };
    }).catch(error => {
      contextoPromise = null;
      throw error;
    });
    return contextoPromise;
  }

  async function aguardarUsuario() {
    const c = await contexto();
    if (c.auth.currentUser) return c.auth.currentUser;
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe?.();
        reject(new Error("Usuário não autenticado."));
      }, 6000);
      const unsubscribe = c.onAuth(c.auth, current => {
        if (!current) return;
        clearTimeout(timeout);
        unsubscribe?.();
        resolve(current);
      });
    });
  }

  async function carregarPerfil() {
    const c = await contexto();
    usuario = await aguardarUsuario();
    if (perfil) return perfil;
    const snap = await c.fs.getDoc(c.fs.doc(c.db, "usuarios", usuario.uid));
    perfil = snap.exists() ? snap.data() : {};
    atualizarVisibilidadeAdmin();
    return perfil;
  }

  function unirMovimentos() {
    const mapa = new Map();
    [...movimentosLegados, ...movimentosArea].forEach(item => {
      if (pertenceLateralAlca(item)) mapa.set(String(item.id), item);
    });
    movimentos = [...mapa.values()].sort((a, b) => momento(b) - momento(a));
  }

  async function carregarLegados() {
    const c = await contexto();
    const consulta = c.fs.query(
      c.fs.collection(c.db, "movimentacoesProducao"),
      c.fs.where("processo", "in", ["LATERAL", "ALÇA", "ALCA", "ALÇAS", "CORTAGEM E MONTAGEM"])
    );
    const snap = await c.fs.getDocs(consulta);
    movimentosLegados = snap.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .filter(item => item.area !== AREA_LEGADA && item.movimentacaoCorte !== true && item.fluxoFaccoes !== FLUXO)
      .filter(pertenceLateralAlca);
  }

  function pararListenerArea() {
    try { listenerArea?.(); } catch (_) {}
    listenerArea = null;
    listenerPrimeiroSnapshot = null;
  }

  async function iniciarListenerArea() {
    if (listenerArea) return listenerPrimeiroSnapshot || Promise.resolve();
    const c = await contexto();
    listenerPrimeiroSnapshot = new Promise((resolve, reject) => {
      let primeiro = true;
      const consulta = c.fs.query(
        c.fs.collection(c.db, "movimentacoesProducao"),
        c.fs.where("area", "==", AREA_LEGADA)
      );
      listenerArea = c.fs.onSnapshot(consulta, snapshot => {
        movimentosArea = snapshot.docs
          .map(item => ({ id: item.id, ...item.data() }))
          .filter(pertenceLateralAlca);
        unirMovimentos();
        carregadoEm = Date.now();
        if (painelVisivel()) renderDados();
        if (primeiro) {
          primeiro = false;
          resolve();
        }
      }, error => {
        console.error("Listener de Lateral e Alça falhou.", error);
        if (primeiro) {
          primeiro = false;
          reject(error);
        }
      });
    });
    return listenerPrimeiroSnapshot;
  }

  async function carregarTudo(forcar = false) {
    if (carregando) return;
    const cacheValido = !forcar && carregadoEm && Date.now() - carregadoEm < CACHE_MS && movimentos.length;
    if (cacheValido) {
      await iniciarListenerArea().catch(() => {});
      renderDados();
      return;
    }

    carregando = true;
    const botao = document.getElementById("btnLA2Atualizar");
    if (botao) {
      botao.disabled = true;
      botao.textContent = "Atualizando...";
    }

    try {
      await carregarPerfil();
      if (forcar || !movimentosLegados.length) await carregarLegados();
      if (forcar) pararListenerArea();
      try {
        await iniciarListenerArea();
      } catch (error) {
        const c = await contexto();
        const snap = await c.fs.getDocs(c.fs.query(
          c.fs.collection(c.db, "movimentacoesProducao"),
          c.fs.where("area", "==", AREA_LEGADA)
        ));
        movimentosArea = snap.docs.map(item => ({ id: item.id, ...item.data() })).filter(pertenceLateralAlca);
        unirMovimentos();
      }
      carregadoEm = Date.now();
      limiteRender = LIMITE_RENDER_INICIAL;
      renderDados();
      if (ehAdmin()) carregarValorGlobalAlca().catch(() => {});
    } catch (error) {
      console.error(error);
      toast("Não foi possível carregar Lateral e Alça.", "error");
    } finally {
      carregando = false;
      if (botao) {
        botao.disabled = false;
        botao.textContent = "Atualizar";
      }
    }
  }

  function statusMovimento(item) {
    if (movimentoCancelado(item)) return "cancelado";
    if (item.dataChegada || norm(item.status) === "RETORNOU") return "retornou";
    if (item.chegadaInformada === true && norm(item.chegadaInformadaStatus) !== "CONFIRMADA_ADMIN") return "avisada";
    return "andamento";
  }

  function labelStatus(item) {
    const status = statusMovimento(item);
    if (status === "cancelado") return '<span class="la2-pill cancelado">Cancelada</span>';
    if (status === "retornou") return '<span class="la2-pill retornou">Retornou</span>';
    if (status === "avisada") return '<span class="la2-pill avisada">Chegada avisada</span>';
    return '<span class="la2-pill andamento">Em andamento</span>';
  }

  function movimentosFiltrados() {
    const busca = norm(document.getElementById("la2Busca")?.value);
    const processo = document.getElementById("la2FiltroProcesso")?.value || "";
    const faccao = document.getElementById("la2FiltroFaccao")?.value || "";
    const status = document.getElementById("la2FiltroStatus")?.value || "";
    const inicio = document.getElementById("la2FiltroInicio")?.value || "";
    const fim = document.getElementById("la2FiltroFim")?.value || "";

    return movimentos.filter(item => {
      const atual = processoCanonico(item.processo || item.servicoNome || item.processoMovimentacao);
      const destino = String(item.destino || item.faccao || "");
      const situacao = statusMovimento(item);
      const texto = norm([item.numeroOP, item.referencia, item.cor, atual, destino, situacao].join(" "));
      if (!status && situacao === "cancelado") return false;
      if (busca && !texto.includes(busca)) return false;
      if (processo && atual !== processoCanonico(processo)) return false;
      if (faccao && destino !== faccao) return false;
      if (status && situacao !== status) return false;
      const data = item.dataChegada || item.dataEnvio || "";
      if (inicio && data && data < inicio) return false;
      if (fim && data && data > fim) return false;
      return true;
    });
  }

  function preencherFiltros() {
    const processo = document.getElementById("la2FiltroProcesso");
    const faccao = document.getElementById("la2FiltroFaccao");
    if (processo) {
      const anterior = processo.value;
      processo.innerHTML = '<option value="">Todos</option>' + PROCESSOS.map(item =>
        `<option value="${esc(item.nome)}">${esc(item.nome)}</option>`
      ).join("");
      if ([...processo.options].some(opt => opt.value === anterior)) processo.value = anterior;
    }
    if (faccao) {
      const anterior = faccao.value;
      const nomes = [...new Set(movimentos.map(item => item.destino || item.faccao).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
      faccao.innerHTML = '<option value="">Todas</option>' + nomes.map(nome => `<option value="${esc(nome)}">${esc(nome)}</option>`).join("");
      if ([...faccao.options].some(opt => opt.value === anterior)) faccao.value = anterior;
    }
  }

  function renderResumo() {
    const validos = movimentos.filter(item => !movimentoCancelado(item));
    const andamento = validos.filter(item => statusMovimento(item) === "andamento").length;
    const avisadas = validos.filter(item => statusMovimento(item) === "avisada").length;
    const retornadas = validos.filter(item => statusMovimento(item) === "retornou").length;
    const enviadas = validos.reduce((soma, item) => soma + num(item.quantidadeEnviada), 0);
    const set = (id, valor) => {
      const el = document.getElementById(id);
      if (el) el.textContent = valor;
    };
    set("la2ResumoAndamento", qtd(andamento));
    set("la2ResumoAvisadas", qtd(avisadas));
    set("la2ResumoRetornadas", qtd(retornadas));
    set("la2ResumoEnviadas", qtd(enviadas));
  }

  function acoesMovimento(item) {
    const status = statusMovimento(item);
    if (status === "cancelado") return "-";
    const criador = String(item.criadoPor || "") === String(usuario?.uid || "");
    const acoes = [];

    if (status === "andamento") {
      if (ehAdmin()) {
        acoes.push(`<button class="btn btn-sm btn-success" type="button" data-la2-confirmar="${esc(item.id)}">Registrar chegada</button>`);
      } else {
        acoes.push(`<button class="btn btn-sm btn-success" type="button" data-la2-avisar="${esc(item.id)}">Informar chegada</button>`);
      }
    } else if (status === "avisada") {
      if (ehAdmin()) acoes.push(`<button class="btn btn-sm btn-success" type="button" data-la2-confirmar="${esc(item.id)}">Confirmar chegada</button>`);
      else acoes.push('<span class="muted">Aguardando baixa</span>');
    } else if (status === "retornou" && ehAdmin()) {
      acoes.push(`<button class="btn btn-sm" type="button" data-la2-editar="${esc(item.id)}">Editar chegada</button>`);
    }

    const podeCancelar = ehAdmin() || (status !== "retornou" && criador);
    if (podeCancelar) {
      acoes.push(`<button class="btn btn-sm btn-danger" type="button" data-la2-cancelar="${esc(item.id)}">Cancelar</button>`);
    }
    return acoes.join("");
  }

  function renderTabela() {
    const body = document.getElementById("listaFaccoesLateralAlcaV2");
    const info = document.getElementById("la2ResultadoInfo");
    const mais = document.getElementById("btnLA2MostrarMais");
    if (!body) return;

    const filtrados = movimentosFiltrados();
    const visiveis = filtrados.slice(0, limiteRender);
    if (!visiveis.length) {
      body.innerHTML = '<tr><td colspan="12" class="la2-empty">Nenhuma movimentação de Lateral e Alça encontrada.</td></tr>';
    } else {
      body.innerHTML = visiveis.map(item => {
        const processo = processoPorNome(item.processo) || { grupoLabel: item.grupoLateralAlca === "alca" ? "Alça" : "Lateral" };
        return `<tr data-la2-id="${esc(item.id)}">
          <td><strong>${esc(item.numeroOP || "-")}</strong></td>
          <td>${esc(item.referencia || "-")}</td>
          <td>${esc(item.cor || "-")}</td>
          <td>${esc(processoCanonico(item.processo) || "-")}</td>
          <td>${esc(processo.grupoLabel || "-")}</td>
          <td>${esc(item.destino || item.faccao || "-")}</td>
          <td>${qtd(item.quantidadeEnviada)}</td>
          <td>${esc(dataBR(item.dataEnvio))}</td>
          <td>${esc(dataBR(item.dataChegada))}</td>
          <td>${qtd(item.falta)}</td>
          <td>${labelStatus(item)}</td>
          <td><div class="la2-actions">${acoesMovimento(item)}</div></td>
        </tr>`;
      }).join("");
    }

    if (info) info.textContent = `Mostrando ${Math.min(visiveis.length, filtrados.length)} de ${filtrados.length} registro(s) filtrado(s).`;
    if (mais) {
      mais.classList.toggle("hidden", filtrados.length <= limiteRender);
      mais.textContent = `Mostrar mais ${Math.min(200, Math.max(0, filtrados.length - limiteRender))}`;
    }
  }

  function renderDados() {
    preencherFiltros();
    renderResumo();
    renderTabela();
    atualizarVisibilidadeAdmin();
  }

  function renderProcessosSaida() {
    const select = document.getElementById("la2SaidaProcesso");
    if (!select) return;
    select.innerHTML = `
      <option value="">Selecione</option>
      <optgroup label="Lateral">
        <option value="lateral">LATERAL</option>
      </optgroup>
      <optgroup label="Alça">
        <option value="alca">ALÇA</option>
        <option value="cortagem-montagem">CORTAGEM E MONTAGEM — ${dinheiro4(VALOR_FIXO_CORTAGEM_MONTAGEM)}</option>
      </optgroup>
    `;
  }

  function injetarEstilo() {
    if (document.getElementById("styleFaccoesLateralAlcaV2")) return;
    const style = document.createElement("style");
    style.id = "styleFaccoesLateralAlcaV2";
    style.textContent = `
      #painelFaccoesCorte.hidden,.la2-modal.hidden,.la2-admin.hidden,#btnLA2MostrarMais.hidden{display:none!important}
      #painelFaccoesCorte{display:grid;gap:15px}.la2-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}.la2-head h3{margin:0}.la2-head p{margin:4px 0 0;color:#64748b}.la2-toolbar{display:flex;gap:8px;flex-wrap:wrap}
      .la2-cards{display:grid;grid-template-columns:repeat(4,minmax(145px,1fr));gap:10px}.la2-card{padding:13px;border:1px solid #e2e8f0;border-radius:14px;background:#fff}.la2-card span{display:block;color:#64748b;font-size:11px;font-weight:800}.la2-card strong{display:block;margin-top:4px;font-size:22px;color:#0f172a}
      .la2-filtros{display:grid;grid-template-columns:2fr repeat(5,minmax(130px,1fr)) auto;gap:9px;align-items:end}.la2-filtros label{margin:0}.la2-filtros input,.la2-filtros select{width:100%}
      .la2-pill{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:900;white-space:nowrap}.la2-pill.andamento{background:#fef3c7;color:#92400e}.la2-pill.avisada{background:#dbeafe;color:#1d4ed8}.la2-pill.retornou{background:#dcfce7;color:#166534}.la2-pill.cancelado{background:#fee2e2;color:#991b1b}
      .la2-actions{display:flex;gap:5px;flex-wrap:wrap}.la2-empty{text-align:center!important;padding:26px!important;color:#64748b}.la2-result{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#64748b;font-size:12px}
      .la2-modal{position:fixed;inset:0;z-index:100120;background:#0f172a99;display:flex;align-items:center;justify-content:center;padding:18px}.la2-modal-card{width:min(760px,100%);max-height:94vh;overflow:auto;background:#fff;border-radius:18px;padding:20px;box-shadow:0 25px 70px #0f172a55}.la2-modal-head{display:flex;justify-content:space-between;gap:12px}.la2-modal-head h3{margin:0}.la2-modal-close{border:0;background:#f1f5f9;border-radius:10px;width:36px;height:36px;font-size:22px}
      .la2-grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.la2-grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.la2-preview{margin:12px 0;padding:12px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:12px}.la2-preview.hidden,.la2-saida-campos.hidden{display:none!important}.la2-preview-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.la2-preview-grid div{padding:8px;background:#fff;border:1px solid #dbeafe;border-radius:9px}.la2-preview-grid small{display:block;color:#64748b}.la2-preview-grid strong{display:block;margin-top:3px}
      .la2-admin-box{border:1px solid #e2e8f0;border-radius:14px;padding:15px;background:#f8fafc}.la2-admin-box h4{margin:0 0 10px}.la2-valores-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.la2-valor-card{padding:13px;border:1px solid #e2e8f0;border-radius:12px;background:#fff}.la2-valor-card h5{margin:0 0 8px}.la2-valor-card p{margin:4px 0;color:#64748b;font-size:12px}.la2-fixed{font-size:20px;font-weight:900;color:#166534}
      @media(max-width:1100px){.la2-filtros{grid-template-columns:repeat(3,minmax(0,1fr))}.la2-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.la2-valores-grid{grid-template-columns:1fr}}
      @media(max-width:700px){.la2-filtros,.la2-cards,.la2-grid-2,.la2-grid-3,.la2-preview-grid{grid-template-columns:1fr}.la2-head,.la2-result{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function montarPainel() {
    return `
      <div class="la2-head">
        <div><h3>Lateral e Alça</h3><p>Fluxo único de saída, aviso de chegada, baixa do administrador e pagamento.</p></div>
        <div class="la2-toolbar">
          <button id="btnLA2RegistrarSaida" class="btn btn-primary" type="button">Registrar saída</button>
          <button id="btnLA2Atualizar" class="btn" type="button">Atualizar</button>
        </div>
      </div>
      <div class="la2-cards">
        <div class="la2-card"><span>Em andamento</span><strong id="la2ResumoAndamento">0</strong></div>
        <div class="la2-card"><span>Chegadas avisadas</span><strong id="la2ResumoAvisadas">0</strong></div>
        <div class="la2-card"><span>Retornadas</span><strong id="la2ResumoRetornadas">0</strong></div>
        <div class="la2-card"><span>Peças enviadas</span><strong id="la2ResumoEnviadas">0</strong></div>
      </div>
      <div class="la2-filtros">
        <label>Buscar<input id="la2Busca" type="search" placeholder="OP, referência, facção..."></label>
        <label>Processo<select id="la2FiltroProcesso"><option value="">Todos</option></select></label>
        <label>Facção<select id="la2FiltroFaccao"><option value="">Todas</option></select></label>
        <label>Status<select id="la2FiltroStatus"><option value="">Ativos</option><option value="andamento">Em andamento</option><option value="avisada">Chegada avisada</option><option value="retornou">Retornou</option><option value="cancelado">Cancelada</option></select></label>
        <label>De<input id="la2FiltroInicio" type="date"></label>
        <label>Até<input id="la2FiltroFim" type="date"></label>
        <button id="btnLA2Limpar" class="btn" type="button">Limpar</button>
      </div>
      <div class="table-wrap"><table><thead><tr><th>OP</th><th>Ref.</th><th>Cor</th><th>Processo</th><th>Grupo</th><th>Facção</th><th>Qtd.</th><th>Saída</th><th>Chegada</th><th>Falta</th><th>Status</th><th>Ações</th></tr></thead><tbody id="listaFaccoesLateralAlcaV2"></tbody></table></div>
      <div class="la2-result"><span id="la2ResultadoInfo"></span><button id="btnLA2MostrarMais" class="btn hidden" type="button">Mostrar mais</button></div>
      <div id="la2ValoresAdmin" class="la2-admin la2-admin-box hidden">
        <h4>Valores de Lateral e Alça</h4>
        <div class="la2-valores-grid">
          <form id="formLA2ValorLateral" class="la2-valor-card">
            <h5>Lateral por referência</h5>
            <label>Referência<input id="la2ValorLateralRef" required></label>
            <label>Valor por peça<input id="la2ValorLateralValor" type="number" min="0.0001" step="0.0001" required></label>
            <button class="btn btn-primary" type="submit">Salvar valor</button>
          </form>
          <form id="formLA2ValorAlca" class="la2-valor-card">
            <h5>Alça — valor global</h5>
            <p>O valor cadastrado é por alça; o pagamento mantém a regra atual de 2 alças por peça.</p>
            <label>Valor por alça<input id="la2ValorAlcaValor" type="number" min="0.0001" step="0.0001" required></label>
            <button class="btn btn-primary" type="submit">Salvar valor</button>
          </form>
          <div class="la2-valor-card">
            <h5>Alça • Cortagem e montagem</h5>
            <p>Valor único e fixo por peça.</p>
            <div class="la2-fixed">${dinheiro4(VALOR_FIXO_CORTAGEM_MONTAGEM)}</div>
          </div>
        </div>
      </div>
    `;
  }

  function montarModais() {
    if (document.getElementById("modalLA2Saida")) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div id="modalLA2Saida" class="la2-modal hidden">
        <div class="la2-modal-card">
          <div class="la2-modal-head"><div><h3>Registrar saída • Lateral e Alça</h3><p>Busque a OP e escolha o processo.</p></div><button class="la2-modal-close" data-la2-fechar="modalLA2Saida" type="button">×</button></div>
          <form id="formLA2Saida" class="form">
            <div class="la2-grid-2"><label>Número da OP<input id="la2SaidaOP" required></label><div style="align-self:end"><button id="btnLA2BuscarOP" class="btn" type="button">Buscar OP</button></div></div>
            <div id="la2SaidaPreview" class="la2-preview hidden"></div>
            <div id="la2SaidaCampos" class="la2-saida-campos hidden">
              <div class="la2-grid-3">
                <label>Processo<select id="la2SaidaProcesso" required></select></label>
                <label>Quem vai fazer<select id="la2SaidaFaccao" required disabled><option value="">Escolha o processo</option></select></label>
                <label>Data da saída<input id="la2SaidaData" type="date" required></label>
              </div>
              <div class="actions"><button class="btn btn-primary" type="submit">Confirmar saída</button><button class="btn" data-la2-fechar="modalLA2Saida" type="button">Cancelar</button></div>
            </div>
          </form>
        </div>
      </div>
      <div id="modalLA2Chegada" class="la2-modal hidden">
        <div class="la2-modal-card">
          <div class="la2-modal-head"><div><h3 id="la2ChegadaTitulo">Confirmar chegada</h3><p>Somente a baixa confirmada gera pagamento e atualiza a lateral pronta.</p></div><button class="la2-modal-close" data-la2-fechar="modalLA2Chegada" type="button">×</button></div>
          <form id="formLA2Chegada" class="form">
            <div id="la2ChegadaPreview" class="la2-preview"></div>
            <div class="la2-grid-3">
              <label>Data da chegada<input id="la2ChegadaData" type="date" required></label>
              <label>Quantidade recebida<input id="la2ChegadaRecebida" type="number" min="0" step="1" required></label>
              <label>Falta<input id="la2ChegadaFalta" type="number" min="0" step="1" required></label>
            </div>
            <label>Desconto por defeito (R$)<input id="la2ChegadaDefeito" type="number" min="0" step="0.01" value="0"></label>
            <label>Observação<textarea id="la2ChegadaObs" rows="2"></textarea></label>
            <div class="actions"><button class="btn btn-primary" type="submit">Salvar chegada</button><button class="btn" data-la2-fechar="modalLA2Chegada" type="button">Cancelar</button></div>
          </form>
        </div>
      </div>
    `;
    [...wrapper.children].forEach(child => document.body.appendChild(child));
  }

  function injetarUI() {
    injetarEstilo();
    montarModais();
    const pagina = document.getElementById("faccoes");
    const geral = pagina?.querySelector(":scope > .faccoes-operacional-panel");
    if (!pagina || !geral) return false;
    if (!document.getElementById("painelFaccoesCorte")) {
      const painel = document.createElement("div");
      painel.id = "painelFaccoesCorte";
      painel.className = "panel hidden";
      painel.innerHTML = montarPainel();
      geral.insertAdjacentElement("afterend", painel);
    }
    renderProcessosSaida();
    atualizarVisibilidadeAdmin();
    ligarEventosLocais();
    return true;
  }

  function atualizarVisibilidadeAdmin() {
    document.querySelectorAll(".la2-admin").forEach(el => el.classList.toggle("hidden", !ehAdmin()));
  }

  function abrirModal(id) {
    document.getElementById(id)?.classList.remove("hidden");
  }

  function fecharModal(id) {
    document.getElementById(id)?.classList.add("hidden");
  }

  function abrirSaida() {
    opSaida = null;
    document.getElementById("formLA2Saida")?.reset();
    document.getElementById("la2SaidaPreview")?.classList.add("hidden");
    document.getElementById("la2SaidaCampos")?.classList.add("hidden");
    renderProcessosSaida();
    const data = document.getElementById("la2SaidaData");
    if (data) data.value = hoje();
    abrirModal("modalLA2Saida");
    setTimeout(() => document.getElementById("la2SaidaOP")?.focus(), 30);
  }

  function tipoDaOP(op) {
    const texto = norm([
      op?.tipoPeca, op?.tipoPecaPadrao, op?.tipoPecaLabel, op?.tipo, op?.setor,
      op?.produtoNome, op?.nomeProduto, op?.descricao, op?.observacoes
    ].join(" "));
    return texto.includes("CALCINHA") ? "calcinha" : "sutia";
  }

  function quantidadeDaOP(op) {
    return Math.max(0, num(op?.quantidade ?? op?.quantidadeTotal ?? op?.qtd ?? op?.qti));
  }

  function buscarOPNoEstado(valor) {
    const mapa = window.corponuDualMode?.state?.maps?.ordens;
    if (!(mapa instanceof Map) || !mapa.size) return null;
    const alvo = norm(valor);
    let encontrada = null;
    mapa.forEach((item, id) => {
      if (encontrada) return;
      const numero = norm(item?.numeroOP || item?.numeroOPExterno || item?.op || "");
      if (numero === alvo || norm(id) === alvo || norm(item?.id) === alvo) encontrada = { id: String(id), ...item };
    });
    return encontrada;
  }

  async function buscarOP(valor) {
    const texto = String(valor || "").trim();
    if (!texto) return null;
    const chave = norm(texto);
    const cache = cacheOps.get(chave);
    if (cache && Date.now() - cache.em < OP_CACHE_MS) return cache.valor;

    const local = buscarOPNoEstado(texto);
    if (local) {
      cacheOps.set(chave, { em: Date.now(), valor: local });
      return local;
    }

    const c = await contexto();
    const encontrados = new Map();
    const ids = [...new Set([texto, slug(texto), `op-${slug(texto)}`, `calcinha-${slug(texto)}`])];
    const diretos = await Promise.all(ids.map(id => c.fs.getDoc(c.fs.doc(c.db, "ordensProducao", id)).catch(() => null)));
    diretos.forEach(snap => {
      if (snap?.exists?.()) encontrados.set(snap.id, { id: snap.id, ...snap.data() });
    });

    if (!encontrados.size) {
      const valores = [texto];
      const numerico = Number(texto);
      if (Number.isFinite(numerico)) valores.push(numerico);
      for (const campo of ["numeroOP", "numeroOPExterno", "op"]) {
        for (const atual of [...new Set(valores)]) {
          const snap = await c.fs.getDocs(c.fs.query(
            c.fs.collection(c.db, "ordensProducao"),
            c.fs.where(campo, "==", atual),
            c.fs.limit(2)
          ));
          snap.docs.forEach(docSnap => encontrados.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
          if (encontrados.size) break;
        }
        if (encontrados.size) break;
      }
    }

    const ativa = [...encontrados.values()].find(item => item.excluida !== true && norm(item.status) !== "EXCLUIDA") || null;
    cacheOps.set(chave, { em: Date.now(), valor: ativa });
    return ativa;
  }

  async function acaoBuscarOP() {
    const botao = document.getElementById("btnLA2BuscarOP");
    const valor = document.getElementById("la2SaidaOP")?.value?.trim() || "";
    if (!valor) return toast("Digite a OP.", "error");
    if (botao) {
      botao.disabled = true;
      botao.textContent = "Buscando...";
    }
    try {
      const op = await buscarOP(valor);
      if (!op) return toast("OP não encontrada.", "error");
      if (tipoDaOP(op) !== "sutia") return toast("Lateral e Alça atende somente OP de Sutiã.", "error");
      opSaida = op;
      const total = quantidadeDaOP(op);
      document.getElementById("la2SaidaPreview").innerHTML = `<div class="la2-preview-grid">
        <div><small>OP</small><strong>${esc(op.numeroOP || op.numeroOPExterno || op.id)}</strong></div>
        <div><small>Referência</small><strong>${esc(op.referencia || "-")}</strong></div>
        <div><small>Cor</small><strong>${esc(op.cor || "-")}</strong></div>
        <div><small>Quantidade</small><strong>${qtd(total)}</strong></div>
      </div>`;
      document.getElementById("la2SaidaPreview").classList.remove("hidden");
      document.getElementById("la2SaidaCampos").classList.remove("hidden");
      renderProcessosSaida();
      document.getElementById("la2SaidaProcesso")?.focus();
    } catch (error) {
      console.error(error);
      toast("Erro ao buscar a OP.", "error");
    } finally {
      if (botao) {
        botao.disabled = false;
        botao.textContent = "Buscar OP";
      }
    }
  }

  async function preencherFaccoesSaida() {
    const select = document.getElementById("la2SaidaFaccao");
    const processo = processoPorId(document.getElementById("la2SaidaProcesso")?.value || "");
    if (!select) return;
    if (!processo) {
      select.disabled = true;
      select.innerHTML = '<option value="">Escolha o processo</option>';
      return;
    }
    select.disabled = true;
    select.innerHTML = '<option value="">Carregando...</option>';
    try {
      const api = window.CorpoNuFaccoesGrupos;
      if (!api?.listarFaccoesPorProcesso) throw new Error("Catálogo oficial de facções indisponível.");
      const itens = await api.listarFaccoesPorProcesso(processo.faccaoProcesso);
      select.innerHTML = itens.length
        ? '<option value="">Selecione</option>' + itens.filter(item => item.ativo !== false).map(item => `<option value="${esc(item.nome)}">${esc(item.nome)}</option>`).join("")
        : `<option value="">Nenhuma facção cadastrada para ${esc(processo.faccaoProcesso)}</option>`;
      select.disabled = !itens.length;
    } catch (error) {
      console.error(error);
      select.innerHTML = '<option value="">Falha ao carregar facções</option>';
      toast("Não foi possível carregar as facções desse processo.", "error");
    }
  }

  async function existeProcessoValido(opId, processo) {
    const c = await contexto();
    const snap = await c.fs.getDocs(c.fs.query(
      c.fs.collection(c.db, "movimentacoesProducao"),
      c.fs.where("opId", "==", opId)
    ));
    return snap.docs.some(docSnap => {
      const item = { id: docSnap.id, ...docSnap.data() };
      return pertenceLateralAlca(item) &&
        processoCanonico(item.processo) === processo.nome &&
        !movimentoCancelado(item);
    });
  }

  async function salvarSaida(event) {
    event.preventDefault();
    if (!opSaida) return toast("Busque uma OP primeiro.", "error");
    const processo = processoPorId(document.getElementById("la2SaidaProcesso")?.value || "");
    const faccao = document.getElementById("la2SaidaFaccao")?.value || "";
    const data = document.getElementById("la2SaidaData")?.value || "";
    if (!processo || !faccao || !data) return toast("Preencha processo, facção e data.", "error");
    if (await existeProcessoValido(opSaida.id, processo)) return toast(`A OP já possui uma saída válida para ${processo.nome}.`, "error");

    const total = quantidadeDaOP(opSaida);
    if (!total) return toast("A OP não possui quantidade válida.", "error");
    const numeroOP = opSaida.numeroOP || opSaida.numeroOPExterno || opSaida.id;
    if (!confirm(`Confirmar saída?\nOP ${numeroOP}\nProcesso: ${processo.nome}\nFacção: ${faccao}\nQuantidade: ${qtd(total)}`)) return;

    const botao = event.submitter;
    if (botao) {
      botao.disabled = true;
      botao.textContent = "Salvando...";
    }
    try {
      const c = await contexto();
      usuario = usuario || await aguardarUsuario();
      const movimento = {
        origem: "faccoes_lateral_alca_v2",
        area: AREA_LEGADA,
        areaLabel: "Lateral e Alça",
        fluxoFaccoes: FLUXO,
        grupoLateralAlca: processo.grupo,
        grupoLateralAlcaLabel: processo.grupoLabel,
        movimentacaoCorte: true,
        opId: opSaida.id,
        numeroOP,
        referencia: opSaida.referencia || "",
        cor: opSaida.cor || "",
        produtoNome: opSaida.produtoNome || opSaida.nomeProduto || "",
        tipoDestino: "faccao_corte",
        tipoDestinoLabel: "Facção • Lateral e Alça",
        destino: faccao,
        processo: processo.nome,
        processoCorteId: processo.id,
        marcaLateralPronta: processo.marcaLateralPronta === true,
        valorFixoUnitario: processo.tipoValor === "fixo" ? processo.valorFixo : null,
        setor: AREA_LEGADA,
        setorLabel: "Lateral e Alça",
        quantidadeEnviada: total,
        quantidadeRecebida: 0,
        dataEnvio: data,
        dataChegada: "",
        falta: 0,
        descontoDefeito: 0,
        status: "em_andamento",
        chegadaInformada: false,
        criadoPor: usuario.uid,
        criadoPorNome: perfil?.nome || usuario.displayName || usuario.email || "Usuário",
        criadoEm: c.fs.serverTimestamp(),
        atualizadoPor: usuario.uid,
        atualizadoEm: c.fs.serverTimestamp(),
        versaoLateralAlca: VERSION
      };
      const ref = await c.fs.addDoc(c.fs.collection(c.db, "movimentacoesProducao"), movimento);
      const local = { id: ref.id, ...movimento, criadoEm: new Date(), atualizadoEm: new Date() };
      movimentosArea = [local, ...movimentosArea.filter(item => item.id !== ref.id)];
      unirMovimentos();
      await registrarLog("lateral_alca_saida_registrada", "movimentacaoProducao", ref.id, `OP ${numeroOP} | ${processo.nome} | ${faccao} | ${total} peças`);
      fecharModal("modalLA2Saida");
      renderDados();
      toast("Saída registrada com sucesso.", "ok");
    } catch (error) {
      console.error(error);
      toast("Erro ao registrar a saída.", "error");
    } finally {
      if (botao) {
        botao.disabled = false;
        botao.textContent = "Confirmar saída";
      }
    }
  }

  async function registrarLog(acao, entidade, entidadeId, detalhes) {
    try {
      const c = await contexto();
      const atual = usuario || await aguardarUsuario();
      await c.fs.addDoc(c.fs.collection(c.db, "logsAlteracoes"), {
        acao, entidade, entidadeId, tipoAlvo: entidade, alvoId: entidadeId, detalhes,
        usuarioId: atual.uid, usuarioUid: atual.uid, usuarioEmail: atual.email || "",
        criadoPor: atual.uid, criadoEm: c.fs.serverTimestamp(), versao: VERSION
      });
    } catch (error) {
      console.warn("Log de Lateral e Alça não criado.", error);
    }
  }

  async function informarChegada(id) {
    const item = movimentos.find(m => String(m.id) === String(id));
    if (!item || movimentoCancelado(item) || item.dataChegada) return;
    if (item.chegadaInformada === true) return toast("Essa chegada já foi avisada.");
    try {
      const c = await contexto();
      usuario = usuario || await aguardarUsuario();
      const patch = {
        chegadaInformada: true,
        chegadaInformadaStatus: "aguardando_confirmacao_admin",
        chegadaInformadaPor: usuario.uid,
        chegadaInformadaPorNome: perfil?.nome || usuario.displayName || usuario.email || "Usuário",
        chegadaInformadaData: hoje(),
        chegadaInformadaEm: c.fs.serverTimestamp(),
        statusOperacional: "chegada_informada",
        atualizadoPor: usuario.uid,
        atualizadoEm: c.fs.serverTimestamp(),
        versaoLateralAlca: VERSION
      };
      await c.fs.setDoc(c.fs.doc(c.db, "movimentacoesProducao", item.id), patch, { merge: true });
      Object.assign(item, patch, { atualizadoEm: new Date() });
      renderDados();
      registrarLog("lateral_alca_chegada_avisada", "movimentacaoProducao", item.id, `OP ${item.numeroOP} | ${item.processo}`).catch(() => {});
      toast("Chegada avisada. Agora aguarda a baixa do administrador.", "ok");
    } catch (error) {
      console.error(error);
      toast("Não foi possível avisar a chegada.", "error");
    }
  }

  async function pagamentoPorMovimento(item) {
    const c = await contexto();
    const deterministico = `corte-${slug(item.id)}`;
    const direto = await c.fs.getDoc(c.fs.doc(c.db, "entregasPagamento", deterministico)).catch(() => null);
    if (direto?.exists?.()) return { id: direto.id, ...direto.data() };
    const snap = await c.fs.getDocs(c.fs.query(
      c.fs.collection(c.db, "entregasPagamento"),
      c.fs.where("movimentacaoId", "==", item.id),
      c.fs.limit(2)
    ));
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  function pagamentoPago(item) {
    return norm(item?.statusPagamento) === "PAGO" && item?.cancelado !== true;
  }

  async function abrirChegada(id, editar = false) {
    const item = movimentos.find(m => String(m.id) === String(id));
    if (!item) return toast("Movimentação não encontrada.", "error");
    if (!ehAdmin()) return toast("Somente o administrador pode dar baixa na chegada.", "error");
    if (editar) {
      const pagamento = await pagamentoPorMovimento(item);
      if (pagamentoPago(pagamento)) return toast("Pagamento já confirmado; a chegada não pode ser editada.", "error");
    }
    movimentoChegada = item;
    const enviado = num(item.quantidadeEnviada);
    const recebido = editar ? num(item.quantidadeRecebida, enviado - num(item.falta)) : enviado;
    const falta = editar ? num(item.falta) : 0;
    document.getElementById("la2ChegadaTitulo").textContent = editar ? "Editar chegada • Lateral e Alça" : (item.chegadaInformada ? "Confirmar chegada avisada" : "Registrar chegada");
    document.getElementById("la2ChegadaData").value = item.dataChegada || item.chegadaInformadaData || hoje();
    document.getElementById("la2ChegadaRecebida").value = recebido;
    document.getElementById("la2ChegadaFalta").value = falta;
    document.getElementById("la2ChegadaDefeito").value = num(item.descontoDefeito ?? item.defeito);
    document.getElementById("la2ChegadaObs").value = item.observacoesChegada || "";
    document.getElementById("la2ChegadaPreview").innerHTML = `<div class="la2-preview-grid">
      <div><small>OP</small><strong>${esc(item.numeroOP || "-")}</strong></div>
      <div><small>Processo</small><strong>${esc(processoCanonico(item.processo))}</strong></div>
      <div><small>Facção</small><strong>${esc(item.destino || item.faccao || "-")}</strong></div>
      <div><small>Enviado</small><strong>${qtd(enviado)}</strong></div>
    </div>`;
    abrirModal("modalLA2Chegada");
  }

  function sincronizarQuantidades(origem) {
    if (!movimentoChegada) return;
    const enviado = num(movimentoChegada.quantidadeEnviada);
    const recebido = document.getElementById("la2ChegadaRecebida");
    const falta = document.getElementById("la2ChegadaFalta");
    if (!recebido || !falta) return;
    if (origem === "recebido") {
      const r = Math.min(enviado, Math.max(0, num(recebido.value)));
      recebido.value = r;
      falta.value = Math.max(0, enviado - r);
    } else {
      const f = Math.min(enviado, Math.max(0, num(falta.value)));
      falta.value = f;
      recebido.value = Math.max(0, enviado - f);
    }
  }

  async function resolverValorUnitario(item) {
    const processo = processoPorNome(item.processo);
    if (!processo) return { valor: 0, origem: "sem_processo", semValor: true };

    if (processo.tipoValor === "fixo") {
      return { valor: arred4(processo.valorFixo), origem: "fixo_cortagem_montagem", semValor: false };
    }

    const c = await contexto();
    if (processo.tipoValor === "global_alca") {
      const snap = await c.fs.getDoc(c.fs.doc(c.db, "precosReferencia", "valor-padrao-alca"));
      const dados = snap.exists() ? snap.data() : {};
      const base = Math.max(0, num(dados.valor ?? dados.valorUnitario ?? dados.preco));
      const valor = arred4(base * 2);
      return { valor, origem: "valor-padrao-alca-x2", semValor: valor <= 0 };
    }

    const referenciaTexto = String(item.referencia ?? "").trim();
    const valores = referenciaTexto ? [referenciaTexto] : [];
    const referenciaNumero = Number(referenciaTexto.replace(",", "."));
    if (referenciaTexto && Number.isFinite(referenciaNumero)) valores.push(referenciaNumero);
    if (!valores.length) return { valor: 0, origem: "referencia_vazia", semValor: true };

    const consulta = valores.length > 1
      ? c.fs.query(c.fs.collection(c.db, "precosReferencia"), c.fs.where("referencia", "in", [...new Set(valores)]))
      : c.fs.query(c.fs.collection(c.db, "precosReferencia"), c.fs.where("referencia", "==", valores[0]));
    const snap = await c.fs.getDocs(consulta);
    const candidatos = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => {
      const valor = Math.max(0, num(d.valor ?? d.valorUnitario ?? d.preco ?? d.valorPorPeca));
      return d.ativo !== false && processoCanonico(d.processo || d.servicoNome) === "LATERAL" && valor > 0;
    });
    const valoresAtivos = [...new Set(candidatos.map(d => arred4(d.valor ?? d.valorUnitario ?? d.preco ?? d.valorPorPeca)))];
    if (valoresAtivos.length !== 1) return { valor: 0, origem: valoresAtivos.length > 1 ? "conflito_valores_lateral" : "sem_valor_lateral", semValor: true };
    return { valor: valoresAtivos[0], origem: "lateral_referencia", semValor: false };
  }

  async function salvarChegada(event) {
    event.preventDefault();
    if (!movimentoChegada || !ehAdmin()) return toast("Somente o administrador pode confirmar a chegada.", "error");

    const data = document.getElementById("la2ChegadaData")?.value || "";
    const recebido = Math.max(0, num(document.getElementById("la2ChegadaRecebida")?.value));
    const falta = Math.max(0, num(document.getElementById("la2ChegadaFalta")?.value));
    const defeito = Math.max(0, num(document.getElementById("la2ChegadaDefeito")?.value));
    const obs = document.getElementById("la2ChegadaObs")?.value?.trim() || "";
    const enviado = num(movimentoChegada.quantidadeEnviada);
    if (!data) return toast("Informe a data da chegada.", "error");
    if (recebido + falta !== enviado) return toast("Recebido + falta precisa ser igual ao enviado.", "error");

    const pagamentoAtual = await pagamentoPorMovimento(movimentoChegada);
    if (pagamentoPago(pagamentoAtual)) return toast("Pagamento já confirmado; nenhuma alteração foi feita.", "error");

    const resolucao = await resolverValorUnitario(movimentoChegada);
    const unitario = arred4(resolucao.valor);
    const subtotal = arred2(recebido * unitario);
    const total = arred2(Math.max(subtotal - defeito, 0));
    const processo = processoPorNome(movimentoChegada.processo);
    const paymentId = pagamentoAtual?.id || `corte-${slug(movimentoChegada.id)}`;

    if (!confirm(`Confirmar baixa da OP ${movimentoChegada.numeroOP}?\nProcesso: ${processoCanonico(movimentoChegada.processo)}\nRecebido: ${qtd(recebido)}\nFalta: ${qtd(falta)}\nValor unitário: ${dinheiro4(unitario)}\nTotal: ${dinheiro(total)}`)) return;

    const botao = event.submitter;
    if (botao) {
      botao.disabled = true;
      botao.textContent = "Salvando...";
    }

    try {
      const c = await contexto();
      usuario = usuario || await aguardarUsuario();
      const agora = c.fs.serverTimestamp();
      const patchMov = {
        dataChegada: data,
        quantidadeRecebida: recebido,
        falta,
        descontoDefeito: defeito,
        defeito,
        observacoesChegada: obs,
        status: "retornou",
        chegadaInformada: false,
        chegadaInformadaStatus: "confirmada_admin",
        confirmacaoChegadaFinanceira: true,
        chegadaConfirmadaPor: usuario.uid,
        chegadaConfirmadaPorNome: perfil?.nome || usuario.email || "Administrador",
        chegadaConfirmadaEm: agora,
        atualizadoPor: usuario.uid,
        atualizadoEm: agora,
        versaoLateralAlca: VERSION
      };

      const pagamento = {
        ...(pagamentoAtual || {}),
        origem: "movimentacao_corte",
        origemFluxo: "faccoes_lateral_alca_v2",
        fluxoFaccoes: FLUXO,
        area: AREA_LEGADA,
        areaLabel: "Lateral e Alça",
        setor: AREA_LEGADA,
        setorLabel: "Lateral e Alça",
        movimentacaoId: movimentoChegada.id,
        opId: movimentoChegada.opId,
        numeroOP: movimentoChegada.numeroOP || "",
        referencia: movimentoChegada.referencia || "",
        cor: movimentoChegada.cor || "",
        produtoNome: movimentoChegada.produtoNome || "",
        processo: processoCanonico(movimentoChegada.processo),
        grupoLateralAlca: processo?.grupo || movimentoChegada.grupoLateralAlca || "",
        faccao: movimentoChegada.destino || movimentoChegada.faccao || "",
        dataEntrega: data,
        quantidade: recebido,
        falta,
        descontoDefeito: defeito,
        valorUnitario: unitario,
        subtotal,
        total,
        valorPendente: resolucao.semValor === true,
        statusPagamento: resolucao.semValor ? "sem_valor" : "pendente",
        fonteValor: resolucao.origem,
        observacoes: resolucao.semValor ? "Valor não localizado automaticamente." : "",
        criadoPor: pagamentoAtual?.criadoPor || usuario.uid,
        criadoEm: pagamentoAtual?.criadoEm || agora,
        atualizadoPor: usuario.uid,
        atualizadoEm: agora,
        versaoLateralAlca: VERSION
      };

      const batch = c.fs.writeBatch(c.db);
      batch.set(c.fs.doc(c.db, "movimentacoesProducao", movimentoChegada.id), patchMov, { merge: true });
      batch.set(c.fs.doc(c.db, "entregasPagamento", paymentId), pagamento, { merge: true });

      if (processo?.marcaLateralPronta === true) {
        batch.set(c.fs.doc(c.db, "ordensProducao", movimentoChegada.opId), {
          lateralProntaCorte: true,
          lateralProntaCorteAtiva: true,
          lateralProntaCorteMovimentacaoId: movimentoChegada.id,
          lateralProntaCorteProcesso: processo.nome,
          lateralProntaCorteFaccao: movimentoChegada.destino || "",
          lateralProntaCorteQuantidade: recebido,
          lateralProntaOrigemAtual: "faccao_corte",
          lateralProntaOrigemAtualLabel: "Facção • Lateral e Alça",
          lateralProntaOrigemAtualEm: agora,
          atualizadoPor: usuario.uid,
          atualizadoEm: agora
        }, { merge: true });
      }

      const logRef = c.fs.doc(c.fs.collection(c.db, "logsAlteracoes"));
      batch.set(logRef, {
        acao: "lateral_alca_chegada_confirmada",
        entidade: "movimentacaoProducao",
        entidadeId: movimentoChegada.id,
        tipoAlvo: "movimentacaoProducao",
        alvoId: movimentoChegada.id,
        detalhes: `OP ${movimentoChegada.numeroOP} | ${processoCanonico(movimentoChegada.processo)} | recebido ${recebido} | falta ${falta} | total ${total}`,
        usuarioId: usuario.uid,
        usuarioUid: usuario.uid,
        usuarioEmail: usuario.email || "",
        criadoPor: usuario.uid,
        criadoEm: agora,
        versao: VERSION
      });
      await batch.commit();

      Object.assign(movimentoChegada, patchMov, { atualizadoEm: new Date() });
      fecharModal("modalLA2Chegada");
      renderDados();
      toast(resolucao.semValor ? "Chegada confirmada. Pagamento criado como Valor a definir." : `Chegada confirmada e pagamento gerado: ${dinheiro(total)}.`, "ok");

      if (processo?.marcaLateralPronta === true) {
        Promise.resolve(window.CorpoNuSutiaCompleto?.atualizarStatusOP?.(movimentoChegada.numeroOP)).catch(error => {
          console.warn("Atualização do Sutiã Completo não concluída.", error);
        });
      }
    } catch (error) {
      console.error(error);
      toast("Erro ao confirmar a chegada.", "error");
    } finally {
      if (botao) {
        botao.disabled = false;
        botao.textContent = "Salvar chegada";
      }
    }
  }

  async function recalcularLateralDaOP(opId, numeroOP) {
    const c = await contexto();
    const snap = await c.fs.getDocs(c.fs.query(
      c.fs.collection(c.db, "movimentacoesProducao"),
      c.fs.where("opId", "==", opId)
    ));
    const validas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(item => pertenceLateralAlca(item) &&
        processoCanonico(item.processo) === "LATERAL" &&
        !movimentoCancelado(item) &&
        Boolean(item.dataChegada))
      .sort((a, b) => momento(b) - momento(a));
    const ultima = validas[0] || null;
    const patch = ultima ? {
      lateralProntaCorte: true,
      lateralProntaCorteAtiva: true,
      lateralProntaCorteMovimentacaoId: ultima.id,
      lateralProntaCorteProcesso: "LATERAL",
      lateralProntaCorteFaccao: ultima.destino || "",
      lateralProntaCorteQuantidade: num(ultima.quantidadeRecebida),
      lateralProntaOrigemAtual: "faccao_corte",
      lateralProntaOrigemAtualLabel: "Facção • Lateral e Alça",
      atualizadoPor: usuario.uid,
      atualizadoEm: c.fs.serverTimestamp()
    } : {
      lateralProntaCorte: false,
      lateralProntaCorteAtiva: false,
      lateralProntaCorteMovimentacaoId: "",
      lateralProntaCorteProcesso: "",
      lateralProntaCorteFaccao: "",
      lateralProntaCorteQuantidade: 0,
      atualizadoPor: usuario.uid,
      atualizadoEm: c.fs.serverTimestamp()
    };
    await c.fs.setDoc(c.fs.doc(c.db, "ordensProducao", opId), patch, { merge: true });
    Promise.resolve(window.CorpoNuSutiaCompleto?.atualizarStatusOP?.(numeroOP)).catch(() => {});
  }

  async function cancelarMovimento(id) {
    const item = movimentos.find(m => String(m.id) === String(id));
    if (!item || movimentoCancelado(item)) return;
    const status = statusMovimento(item);
    const criador = String(item.criadoPor || "") === String(usuario?.uid || "");
    if (!ehAdmin() && (status === "retornou" || !criador)) return toast("Você não pode cancelar essa movimentação.", "error");
    const motivo = status === "retornou" ? prompt("Motivo do cancelamento:", "") : "Cancelada antes da chegada";
    if (status === "retornou" && !motivo?.trim()) return;
    if (!confirm(`Cancelar a movimentação da OP ${item.numeroOP} em ${processoCanonico(item.processo)}?`)) return;

    try {
      const c = await contexto();
      usuario = usuario || await aguardarUsuario();
      const pagamento = await pagamentoPorMovimento(item);
      const batch = c.fs.writeBatch(c.db);
      const agora = c.fs.serverTimestamp();
      batch.set(c.fs.doc(c.db, "movimentacoesProducao", item.id), {
        status: "cancelado",
        cancelado: true,
        motivoCancelamento: motivo?.trim() || "Cancelada",
        canceladoPor: usuario.uid,
        canceladoEm: agora,
        atualizadoPor: usuario.uid,
        atualizadoEm: agora,
        versaoLateralAlca: VERSION
      }, { merge: true });
      if (pagamento) {
        batch.set(c.fs.doc(c.db, "entregasPagamento", pagamento.id), {
          statusPagamento: "cancelado",
          cancelado: true,
          canceladoAposPagamento: pagamentoPago(pagamento),
          motivoCancelamento: motivo?.trim() || "Movimentação cancelada",
          canceladoPor: usuario.uid,
          canceladoEm: agora,
          atualizadoPor: usuario.uid,
          atualizadoEm: agora
        }, { merge: true });
      }
      await batch.commit();
      item.status = "cancelado";
      item.cancelado = true;
      item.atualizadoEm = new Date();

      if (processoCanonico(item.processo) === "LATERAL" && item.dataChegada) {
        await recalcularLateralDaOP(item.opId, item.numeroOP);
      }
      renderDados();
      registrarLog("lateral_alca_movimentacao_cancelada", "movimentacaoProducao", item.id, `OP ${item.numeroOP} | ${processoCanonico(item.processo)} | ${motivo || ""}`).catch(() => {});
      toast("Movimentação cancelada.", "ok");
    } catch (error) {
      console.error(error);
      toast("Erro ao cancelar a movimentação.", "error");
    }
  }

  async function carregarValorGlobalAlca() {
    if (!ehAdmin()) return;
    const c = await contexto();
    const snap = await c.fs.getDoc(c.fs.doc(c.db, "precosReferencia", "valor-padrao-alca"));
    const input = document.getElementById("la2ValorAlcaValor");
    if (input && snap.exists()) input.value = num(snap.data().valor ?? snap.data().valorUnitario ?? snap.data().preco) || "";
  }

  async function salvarValorAlca(event) {
    event.preventDefault();
    if (!ehAdmin()) return;
    const valor = arred4(document.getElementById("la2ValorAlcaValor")?.value);
    if (valor <= 0) return toast("Informe um valor válido para Alça.", "error");
    try {
      const c = await contexto();
      usuario = usuario || await aguardarUsuario();
      await c.fs.setDoc(c.fs.doc(c.db, "precosReferencia", "valor-padrao-alca"), {
        referencia: "PADRAO",
        processo: "ALÇA",
        setor: AREA_LEGADA,
        setorLabel: "Lateral e Alça",
        valor,
        ativo: true,
        atualizadoPor: usuario.uid,
        atualizadoEm: c.fs.serverTimestamp(),
        versaoLateralAlca: VERSION
      }, { merge: true });
      registrarLog("lateral_alca_valor_global_alca", "precoReferencia", "valor-padrao-alca", `ALÇA ${dinheiro4(valor)} por alça`).catch(() => {});
      toast("Valor global da Alça salvo.", "ok");
    } catch (error) {
      console.error(error);
      toast("Erro ao salvar valor da Alça.", "error");
    }
  }

  async function salvarValorLateral(event) {
    event.preventDefault();
    if (!ehAdmin()) return;
    const referencia = norm(document.getElementById("la2ValorLateralRef")?.value || "");
    const valor = arred4(document.getElementById("la2ValorLateralValor")?.value);
    if (!referencia || valor <= 0) return toast("Informe referência e valor válidos.", "error");
    const id = `corte-${slug(referencia)}-lateral`;
    try {
      const c = await contexto();
      usuario = usuario || await aguardarUsuario();
      await c.fs.setDoc(c.fs.doc(c.db, "precosReferencia", id), {
        referencia,
        processo: "LATERAL",
        processoCorteId: "lateral",
        setor: AREA_LEGADA,
        setorLabel: "Lateral e Alça",
        area: AREA_LEGADA,
        areaLabel: "Lateral e Alça",
        valor,
        ativo: true,
        atualizadoPor: usuario.uid,
        atualizadoEm: c.fs.serverTimestamp(),
        versaoLateralAlca: VERSION
      }, { merge: true });
      registrarLog("lateral_alca_valor_lateral", "precoReferencia", id, `${referencia} | LATERAL | ${dinheiro4(valor)}`).catch(() => {});
      toast("Valor de Lateral salvo.", "ok");
    } catch (error) {
      console.error(error);
      toast("Erro ao salvar valor de Lateral.", "error");
    }
  }

  function limparFiltros() {
    ["la2Busca", "la2FiltroProcesso", "la2FiltroFaccao", "la2FiltroStatus", "la2FiltroInicio", "la2FiltroFim"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    limiteRender = LIMITE_RENDER_INICIAL;
    renderTabela();
  }

  function ligarEventosLocais() {
    const painel = document.getElementById("painelFaccoesCorte");
    if (!painel || painel.dataset.la2Eventos === VERSION) return;
    painel.dataset.la2Eventos = VERSION;

    painel.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (!alvo) return;
      if (alvo.closest("#btnLA2RegistrarSaida")) return abrirSaida();
      if (alvo.closest("#btnLA2Atualizar")) return carregarTudo(true);
      if (alvo.closest("#btnLA2Limpar")) return limparFiltros();
      if (alvo.closest("#btnLA2MostrarMais")) {
        limiteRender += 200;
        return renderTabela();
      }
      const avisar = alvo.closest("[data-la2-avisar]");
      if (avisar) return informarChegada(avisar.dataset.la2Avisar);
      const confirmar = alvo.closest("[data-la2-confirmar]");
      if (confirmar) return abrirChegada(confirmar.dataset.la2Confirmar, false);
      const editar = alvo.closest("[data-la2-editar]");
      if (editar) return abrirChegada(editar.dataset.la2Editar, true);
      const cancelar = alvo.closest("[data-la2-cancelar]");
      if (cancelar) return cancelarMovimento(cancelar.dataset.la2Cancelar);
    });

    painel.addEventListener("input", event => {
      if (event.target?.id !== "la2Busca") return;
      clearTimeout(timerBusca);
      timerBusca = setTimeout(() => {
        limiteRender = LIMITE_RENDER_INICIAL;
        renderTabela();
      }, 180);
    });

    painel.addEventListener("change", event => {
      if (["la2FiltroProcesso", "la2FiltroFaccao", "la2FiltroStatus", "la2FiltroInicio", "la2FiltroFim"].includes(event.target?.id)) {
        limiteRender = LIMITE_RENDER_INICIAL;
        renderTabela();
      }
    });

    document.getElementById("formLA2ValorAlca")?.addEventListener("submit", salvarValorAlca);
    document.getElementById("formLA2ValorLateral")?.addEventListener("submit", salvarValorLateral);

    const modalSaida = document.getElementById("modalLA2Saida");
    const modalChegada = document.getElementById("modalLA2Chegada");

    modalSaida?.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (alvo?.closest("#btnLA2BuscarOP")) return acaoBuscarOP();
      const fechar = alvo?.closest("[data-la2-fechar]");
      if (fechar) fecharModal(fechar.dataset.la2Fechar);
    });
    modalSaida?.addEventListener("change", event => {
      if (event.target?.id === "la2SaidaProcesso") preencherFaccoesSaida();
    });
    document.getElementById("formLA2Saida")?.addEventListener("submit", salvarSaida);

    modalChegada?.addEventListener("click", event => {
      const fechar = event.target instanceof Element ? event.target.closest("[data-la2-fechar]") : null;
      if (fechar) fecharModal(fechar.dataset.la2Fechar);
    });
    modalChegada?.addEventListener("input", event => {
      if (event.target?.id === "la2ChegadaRecebida") sincronizarQuantidades("recebido");
      if (event.target?.id === "la2ChegadaFalta") sincronizarQuantidades("falta");
    });
    document.getElementById("formLA2Chegada")?.addEventListener("submit", salvarChegada);
  }

  async function mostrarArea() {
    injetarUI();
    const pagina = document.getElementById("faccoes");
    const geral = pagina?.querySelector(":scope > .faccoes-operacional-panel");
    const painel = document.getElementById("painelFaccoesCorte");
    if (!pagina || !geral || !painel) return false;
    geral.classList.add("hidden");
    painel.classList.remove("hidden");
    await carregarTudo(false);
    return true;
  }

  function ocultarArea() {
    document.getElementById("painelFaccoesCorte")?.classList.add("hidden");
    pararListenerArea();
  }

  function iniciar() {
    injetarUI();
    contexto().then(c => {
      c.onAuth(c.auth, current => {
        usuario = current;
        perfil = null;
        if (!current) {
          movimentosArea = [];
          movimentosLegados = [];
          movimentos = [];
          pararListenerArea();
          return;
        }
        carregarPerfil().catch(() => {});
      });
    }).catch(error => console.warn("Lateral e Alça aguardando Firebase.", error));
  }

  const api = {
    versao: VERSION,
    atualizar: carregarTudo,
    mostrar: mostrarArea,
    ocultar: ocultarArea,
    processos: PROCESSOS.map(item => ({ ...item })),
    valorFixoCortagemMontagem: VALOR_FIXO_CORTAGEM_MONTAGEM
  };
  window.CorpoNuFaccoesLateralAlca = api;
  window.CorpoNuFaccoesCorte = api;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();