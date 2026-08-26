/*
 * Módulo nativo de Facções / Lateral e Alça.
 * As correções válidas do loader legado são incorporadas aqui, sem remendos em runtime.
 */
(() => {
  "use strict";

  const VERSION = "2026-08-26-faccoes-lateral-alca-nativo-254";
  const FB = "10.12.5";
  const CONFIG_ID = "processos-corte";
  const AREA = "corte"; // campo legado preservado para compatibilidade com movimentos/pagamentos existentes
  const FLUXO = "lateral_alca";
  const PROCESSOS_OFICIAIS = Object.freeze([
    { id: "lateral", nome: "LATERAL", ativo: true, atendeSutia: true, atendeCalcinha: false, marcaLateralPronta: true },
    { id: "alca", nome: "ALÇA", ativo: true, atendeSutia: true, atendeCalcinha: false, marcaLateralPronta: false }
  ]);

  if (window.__CORPONU_FACCOES_CORTE__ === VERSION) return;
  window.__CORPONU_FACCOES_CORTE__ = VERSION;

  let ctxPromise = null;
  let user = null;
  let perfil = null;
  let processos = [];
  let faccoes = [];
  let movimentos = [];
  let precos = [];
  let pagamentosCorte = [];
  let opSaida = null;
  let movimentoChegada = null;
  let processoEdicaoId = "";
  let carregando = false;

  const norm = value => String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

  const html = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const numero = (value, fallback = 0) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
    const text = String(value ?? "").trim();
    if (!text) return fallback;
    const parsed = Number(text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const arredondar = value => Math.round((numero(value) + Number.EPSILON) * 100) / 100;
  const dinheiro = value => numero(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const quantidade = value => numero(value).toLocaleString("pt-BR");
  const hoje = () => new Date().toISOString().slice(0, 10);
  const slug = value => norm(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
  const statusNormalizado = value => norm(value || "PENDENTE");
  const pagamentoPago = pagamento => statusNormalizado(pagamento?.statusPagamento) === "PAGO";
  const movimentoCancelado = movimento => ["CANCELADO", "CANCELADA", "EXCLUIDO", "EXCLUÍDO"].includes(norm(movimento?.status)) || movimento?.cancelado === true || movimento?.excluido === true;

  function processoCanonico(valor) {
    const chave = norm(valor);
    if (["ALCA", "ALCAS", "ALÇAS"].includes(chave)) return "ALÇA";
    if (chave === "LATERAL") return "LATERAL";
    return String(valor ?? "").trim().toUpperCase();
  }

  function pertenceLateralAlca(item) {
    const processo = processoCanonico(item?.processo || item?.servicoNome || item?.processoMovimentacao);
    return item?.area === AREA || item?.movimentacaoCorte === true || processo === "LATERAL" || processo === "ALÇA";
  }

  function movimentoLegadoForaCorte(item) {
    return Boolean(item) && item.area !== AREA && item.movimentacaoCorte !== true;
  }

  function movimentacaoUsaFluxoLegado(item) {
    if (!movimentoLegadoForaCorte(item)) return false;
    const processo = processoCanonico(item?.processo || item?.servicoNome || item?.processoMovimentacao);
    return processo === "LATERAL" || processo === "ALÇA";
  }

  function abrirChegadaLegada(movementId) {
    const id = String(movementId || "");
    if (!id) return false;

    if (typeof window.registrarChegadaMovimentacao === "function") {
      const modal = document.getElementById("modalChegadaMovimentacao");
      window.registrarChegadaMovimentacao(id);
      if (!modal || !modal.classList.contains("hidden")) return true;
    }

    const botaoOriginal = [...document.querySelectorAll("button[onclick]")].find(botao => {
      const codigo = String(botao.getAttribute("onclick") || "");
      return codigo.includes("registrarChegadaMovimentacao") && codigo.includes(id);
    });
    if (botaoOriginal instanceof HTMLButtonElement) {
      botaoOriginal.click();
      return true;
    }

    toast("Não foi possível abrir esta chegada antiga. Atualize os dados de Facções e tente novamente.", "error");
    return false;
  }

  function abrirChegadaCompatibilidade(movementId, editing = false) {
    const movement = movimentos.find(item => String(item.id) === String(movementId));
    if (!movement) return toast("Movimentação não encontrada.", "error");
    if (movimentacaoUsaFluxoLegado(movement)) return abrirChegadaLegada(movement.id);
    return abrirChegada(movement.id, editing);
  }

  const ehAdmin = () => norm(perfil?.tipo) === "ADMIN";

  function dataBR(value) {
    if (!value) return "-";
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      const [ano, mes, dia] = String(value).split("-");
      return `${dia}/${mes}/${ano}`;
    }
    const d = value?.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("pt-BR");
  }

  function dataHora(value) {
    if (!value) return "-";
    const d = value?.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("pt-BR");
  }

  function toast(message, type = "info") {
    const principal = document.getElementById("toast");
    if (principal) {
      principal.textContent = message;
      principal.classList.remove("hidden");
      clearTimeout(window.__corteToast);
      window.__corteToast = setTimeout(() => principal.classList.add("hidden"), 6500);
      return;
    }

    let element = document.getElementById("toastFaccoesCorte");
    if (!element) {
      element = document.createElement("div");
      element.id = "toastFaccoesCorte";
      element.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:100020;max-width:440px;padding:13px 15px;border-radius:13px;color:#fff;box-shadow:0 18px 42px #0f172a44;font:800 13px/1.45 Arial";
      document.body.appendChild(element);
    }
    element.style.background = type === "error" ? "#991b1b" : type === "ok" ? "#166534" : "#0f172a";
    element.textContent = message;
    clearTimeout(element._timer);
    element._timer = setTimeout(() => element.remove(), 6500);
  }

  async function contexto() {
    if (ctxPromise) return ctxPromise;
    ctxPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-firestore.js`)
    ]).then(([appMod, authMod, fs]) => {
      if (!appMod.getApps().length) throw new Error("Firebase ainda não foi inicializado");
      const app = appMod.getApp();
      return {
        auth: authMod.getAuth(app),
        onAuth: authMod.onAuthStateChanged,
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
    let lastError;
    for (let attempt = 0; attempt < 35; attempt += 1) {
      try {
        return await contexto();
      } catch (error) {
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    throw lastError || new Error("Firebase indisponível");
  }

  function tipoDaOP(op) {
    const text = norm([
      op?.tipoPeca,
      op?.tipoPecaLabel,
      op?.tipo,
      op?.setor,
      op?.produtoNome,
      op?.nomeProduto,
      op?.descricao,
      op?.observacoes
    ].join(" "));
    return text.includes("CALCINHA") ? "calcinha" : "sutia";
  }

  function quantidadeDaOP(op) {
    return Math.max(0, numero(op?.quantidade ?? op?.quantidadeTotal ?? op?.qtd ?? op?.qti));
  }

  function processoPorId(id) {
    return processos.find(item => String(item.id) === String(id)) || null;
  }

  function processoPorNome(nome) {
    const key = norm(nome);
    return processos.find(item => norm(item.nome) === key) || null;
  }

  function processoCompativelComOP(processo, op) {
    if (!processo || !op) return false;
    const tipo = tipoDaOP(op);
    return tipo === "calcinha" ? processo.atendeCalcinha === true : processo.atendeSutia === true;
  }

  function inferirClassificacaoFaccao(faccao) {
    const processosPermitidos = Array.isArray(faccao?.processosPermitidos) ? faccao.processosPermitidos : [];
    const grupos = Array.isArray(faccao?.gruposPermitidos) ? faccao.gruposPermitidos : [];
    const texto = norm([...processosPermitidos, ...grupos, faccao?.grupo].join(" "));
    return {
      sutia: faccao?.trabalhaSutia === true || faccao?.atendeSutia === true || /SUTIA|BOJO|ALCA/.test(texto),
      calcinha: faccao?.trabalhaCalcinha === true || faccao?.atendeCalcinha === true || texto.includes("CALCINHA")
    };
  }

  function faccoesCompativeis(op) {
    const tipo = tipoDaOP(op);
    return faccoes
      .filter(item => item.ativo !== false && !item.cadastroPendente && !item.duplicadaDe && item.statusImportacao !== "duplicada_consolidada")
      .filter(item => {
        const classificacao = inferirClassificacaoFaccao(item);
        return tipo === "calcinha" ? classificacao.calcinha : classificacao.sutia;
      })
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { numeric: true }));
  }

  function injetarEstilo() {
    if (document.getElementById("styleFaccoesCorte")) return;
    const style = document.createElement("style");
    style.id = "styleFaccoesCorte";
    style.textContent = `
      #painelFaccoesCorte.hidden,.corte-admin.hidden,.corte-modal.hidden,.corte-preview.hidden,.corte-classificacao.hidden{display:none!important}
      #painelFaccoesCorte{display:grid;gap:16px}.corte-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.corte-cards{display:grid;grid-template-columns:repeat(5,minmax(145px,1fr));gap:12px}
      .corte-card{padding:14px;border:1px solid #e2e8f0;border-radius:14px;background:#fff}.corte-card span{display:block;color:#64748b;font-size:12px;font-weight:800}.corte-card strong{display:block;margin-top:5px;font-size:23px;color:#0f172a}.corte-card.alerta{background:#fff7ed;border-color:#fed7aa}.corte-card.alerta strong{color:#9a3412}
      .corte-filtros{display:grid;grid-template-columns:2fr repeat(5,minmax(135px,1fr)) auto;gap:10px;align-items:end}.corte-filtros label{margin:0}.corte-filtros input,.corte-filtros select{width:100%}
      .corte-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;font-size:11px;font-weight:900;white-space:nowrap}.corte-pill.andamento{background:#fef3c7;color:#92400e}.corte-pill.retornou{background:#dcfce7;color:#166534}.corte-pill.cancelado{background:#fee2e2;color:#991b1b}.corte-pill.lateral{background:#dcfce7;color:#166534}.corte-pill.valor{background:#ffedd5;color:#9a3412}
      .corte-empty{text-align:center!important;padding:28px!important;color:#64748b}.corte-actions{display:flex;gap:6px;flex-wrap:wrap}.corte-actions .btn{white-space:nowrap}
      .corte-modal{position:fixed;inset:0;z-index:100015;background:#0f172a99;display:flex;align-items:center;justify-content:center;padding:18px}.corte-modal-card{width:min(780px,100%);max-height:94vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 25px 70px #0f172a55;padding:20px}.corte-modal-head{display:flex;justify-content:space-between;gap:15px;align-items:start;margin-bottom:14px}.corte-modal-head h3{margin:0}.corte-modal-head p{margin:4px 0 0;color:#64748b}.corte-modal-close{border:0;background:#f1f5f9;border-radius:10px;width:36px;height:36px;font-size:22px;cursor:pointer}
      .corte-grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.corte-grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.corte-preview{padding:13px;border:1px solid #ddd6fe;background:#faf5ff;border-radius:13px;margin:10px 0}.corte-preview-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.corte-preview-item{padding:9px;background:#fff;border:1px solid #e2e8f0;border-radius:9px}.corte-preview-item small{display:block;color:#64748b}.corte-preview-item strong{display:block;margin-top:3px}
      .corte-admin-wrap{display:grid;grid-template-columns:minmax(310px,.75fr) minmax(0,1.25fr);gap:16px;align-items:start}.corte-admin-list{display:grid;gap:8px}.corte-processo-item,.corte-preco-item{padding:11px;border:1px solid #e2e8f0;border-radius:11px;background:#f8fafc;display:flex;justify-content:space-between;gap:12px;align-items:center}.corte-processo-item small,.corte-preco-item small{display:block;color:#64748b;margin-top:3px}
      .corte-classificacao{grid-column:1/-1;padding:12px;border:1px solid #ddd6fe;border-radius:12px;background:#faf5ff}.corte-classificacao strong{display:block;margin-bottom:8px}.corte-classificacao .checks{display:flex;gap:16px;flex-wrap:wrap}
      .corte-note{padding:11px;border:1px solid #bfdbfe;border-radius:10px;background:#eff6ff;color:#1e3a8a;font-size:12px;font-weight:700}.corte-warning{padding:11px;border:1px solid #fed7aa;border-radius:10px;background:#fff7ed;color:#9a3412;font-size:12px;font-weight:700}
      @media(max-width:1200px){.corte-cards{grid-template-columns:repeat(3,1fr)}.corte-filtros{grid-template-columns:repeat(3,1fr)}.corte-admin-wrap{grid-template-columns:1fr}}
      @media(max-width:760px){.corte-cards,.corte-filtros,.corte-grid-2,.corte-grid-3,.corte-preview-grid{grid-template-columns:1fr}.corte-modal{padding:8px}.corte-modal-card{padding:14px;border-radius:14px}}
    `;
    document.head.appendChild(style);
  }

  function montarPainelCorte() {
    return `
      <div class="panel-header">
        <div><h3>Lateral e Alça</h3><p>Acompanhe saídas e chegadas dos processos de Lateral e Alça.</p></div>
        <div class="corte-toolbar">
          <button class="btn btn-primary" id="btnCorteRegistrarSaida" type="button">Registrar saída</button>
          <button class="btn btn-success" id="btnChegadaManualLateralAlca" type="button">Chegada manual</button>
          <button class="btn" id="btnCorteAtualizar" type="button">Atualizar</button>
          <button class="btn btn-print" id="btnCorteImprimir" type="button">Imprimir</button>
        </div>
      </div>

      <div class="corte-cards">
        <div class="corte-card"><span>OPs em andamento</span><strong id="corteTotalAndamento">0</strong></div>
        <div class="corte-card"><span>Peças enviadas</span><strong id="corteTotalEnviadas">0</strong></div>
        <div class="corte-card"><span>Peças recebidas</span><strong id="corteTotalRecebidas">0</strong></div>
        <div class="corte-card"><span>Faltas</span><strong id="corteTotalFaltas">0</strong></div>
        <div class="corte-card alerta"><span>Valores a definir</span><strong id="corteTotalSemValor">0</strong></div>
      </div>

      <div class="corte-filtros">
        <label>Buscar<input id="corteBusca" type="text" placeholder="OP, referência, cor ou facção"></label>
        <label>Processo<select id="corteFiltroProcesso"><option value="">Todos</option></select></label>
        <label>Facção<select id="corteFiltroFaccao"><option value="">Todas</option></select></label>
        <label>Status<select id="corteFiltroStatus"><option value="">Todos</option><option value="em_andamento">Em andamento</option><option value="retornou">Retornou</option><option value="cancelado">Cancelada</option></select></label>
        <label>Lateral<select id="corteFiltroLateral"><option value="">Todas</option><option value="sim">Lateral pronta</option><option value="nao">Sem lateral pronta</option></select></label>
        <label>Data inicial<input id="corteFiltroInicio" type="date"></label>
        <label>Data final<input id="corteFiltroFim" type="date"></label>
        <button class="btn" id="btnCorteLimparFiltros" type="button">Limpar</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr><th>OP</th><th>REF</th><th>Cor</th><th>Processo</th><th>Facção</th><th>Qtd.</th><th>Saída</th><th>Chegada</th><th>Falta</th><th>Status</th><th>Componente</th><th>Ações</th></tr></thead>
          <tbody id="listaFaccoesCorte"><tr><td colspan="12" class="corte-empty">Carregue os dados de Lateral e Alça.</td></tr></tbody>
        </table>
      </div>

    `;
  }

  function montarModais() {
    if (document.getElementById("modalSaidaCorte")) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div id="modalSaidaCorte" class="corte-modal hidden">
        <div class="corte-modal-card">
          <div class="corte-modal-head"><div><h3>Registrar saída de Lateral e Alça</h3><p>Informe a OP, escolha o processo e quem fará.</p></div><button class="corte-modal-close" type="button" data-fechar-corte="modalSaidaCorte">×</button></div>
          <form id="formSaidaCorte" class="form">
            <div class="corte-grid-2"><label>Número da OP<input id="saidaCorteOP" type="text" inputmode="numeric" autocomplete="off" required></label><div class="actions" style="align-items:end"><button class="btn" id="btnBuscarOPCorte" type="button">Buscar OP</button></div></div>
            <div id="saidaCortePreview" class="corte-preview hidden"></div>
            <div id="saidaCorteCampos" class="hidden">
              <div class="corte-grid-3">
                <label>Processo<select id="saidaCorteProcesso" required><option value="">Selecione</option></select></label>
                <label>Quem vai fazer<select id="saidaCorteFaccao" required disabled><option value="">Escolha o processo</option></select></label>
                <label>Data da saída<input id="saidaCorteData" type="date" required></label>
              </div>
              <div id="saidaCorteAviso" class="corte-note">A quantidade enviada será sempre o total da OP.</div>
              <div class="actions"><button class="btn btn-primary" type="submit">Confirmar saída</button><button class="btn" type="button" data-fechar-corte="modalSaidaCorte">Cancelar</button></div>
            </div>
          </form>
        </div>
      </div>

      <div id="modalChegadaCorte" class="corte-modal hidden">
        <div class="corte-modal-card">
          <div class="corte-modal-head"><div><h3 id="tituloChegadaCorte">Registrar chegada de Lateral e Alça</h3><p>Informe o retorno, faltas, defeitos e observações.</p></div><button class="corte-modal-close" type="button" data-fechar-corte="modalChegadaCorte">×</button></div>
          <form id="formChegadaCorte" class="form">
            <input id="chegadaCorteMovId" type="hidden">
            <div id="chegadaCortePreview" class="corte-preview"></div>
            <div class="corte-grid-3">
              <label>Data da chegada<input id="chegadaCorteData" type="date" required></label>
              <label>Quantidade recebida<input id="chegadaCorteRecebida" type="number" min="0" step="1" required></label>
              <label>Falta<input id="chegadaCorteFalta" type="number" min="0" step="1" value="0" required></label>
            </div>
            <div class="corte-grid-2">
              <label>Desconto por defeito (R$)<input id="chegadaCorteDefeito" type="number" min="0" step="0.01" value="0" required></label>
              <label>Observação (opcional)<textarea id="chegadaCorteObs" rows="2" placeholder="Opcional"></textarea></label>
            </div>
            <div class="actions"><button class="btn btn-success" type="submit">Salvar chegada</button><button class="btn" type="button" data-fechar-corte="modalChegadaCorte">Cancelar</button></div>
          </form>
        </div>
      </div>

      <div id="modalSelecionarChegadaCorte" class="corte-modal hidden">
        <div class="corte-modal-card">
          <div class="corte-modal-head"><div><h3>Selecionar movimentação em andamento</h3><p>Escolha qual OP retornou da facção.</p></div><button class="corte-modal-close" type="button" data-fechar-corte="modalSelecionarChegadaCorte">×</button></div>
          <label>Buscar<input id="buscaSelecionarChegadaCorte" type="text" placeholder="OP, processo ou facção"></label>
          <div class="table-wrap"><table><thead><tr><th>OP</th><th>Processo</th><th>Facção</th><th>Saída</th><th>Ação</th></tr></thead><tbody id="listaSelecionarChegadaCorte"></tbody></table></div>
        </div>
      </div>
    `;
    [...wrapper.children].forEach(child => document.body.appendChild(child));
  }

  function garantirProcessosChegadaManual() {
    const datalist = document.getElementById("chegadaManualProcessoList");
    if (!(datalist instanceof HTMLDataListElement)) return;
    ["LATERAL", "ALÇA"].forEach(processo => {
      const existe = [...datalist.options].some(option => norm(option.value) === norm(processo));
      if (existe) return;
      const option = document.createElement("option");
      option.value = processo;
      datalist.appendChild(option);
    });
  }

  function injetarUI() {
    injetarEstilo();
    montarModais();
    garantirProcessosChegadaManual();

    const page = document.getElementById("faccoes");
    const existing = page?.querySelector(":scope > .faccoes-operacional-panel");
    if (!page || !existing) return false;

    if (!document.getElementById("painelFaccoesCorte")) {
      const panel = document.createElement("div");
      panel.id = "painelFaccoesCorte";
      panel.className = "panel hidden";
      panel.innerHTML = montarPainelCorte();
      existing.insertAdjacentElement("afterend", panel);
    }

    atualizarVisibilidadeAdmin();
    return true;
  }

  function atualizarVisibilidadeAdmin() {
    document.querySelectorAll(".corte-admin").forEach(element => element.classList.toggle("hidden", !ehAdmin()));
  }

  function mostrarAreaLateralAlca() {
    const page = document.getElementById("faccoes");
    const geral = page?.querySelector(":scope > .faccoes-operacional-panel");
    const painel = document.getElementById("painelFaccoesCorte");
    if (!page || !geral || !painel) return false;
    geral.classList.add("hidden");
    painel.classList.remove("hidden");
    carregarTudoCorte();
    return true;
  }

  function ocultarAreaLateralAlca() {
    document.getElementById("painelFaccoesCorte")?.classList.add("hidden");
  }

  async function carregarPerfil() {
    const c = await aguardarContexto();
    user = c.auth.currentUser;
    if (!user) return;
    const snap = await c.fs.getDoc(c.fs.doc(c.db, "usuarios", user.uid));
    perfil = snap.exists() ? snap.data() : {};
    atualizarVisibilidadeAdmin();
  }

  async function carregarProcessos() {
    processos = PROCESSOS_OFICIAIS.map(item => ({ ...item }));
  }

  async function carregarFaccoes() {
    const c = await aguardarContexto();
    const snap = await c.fs.getDocs(c.fs.collection(c.db, "faccoes"));
    faccoes = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  }

  async function carregarMovimentos() {
    const c = await aguardarContexto();
    const colecao = c.fs.collection(c.db, "movimentacoesProducao");
    const consultas = [
      c.fs.query(colecao, c.fs.where("area", "==", AREA)),
      c.fs.query(colecao, c.fs.where("movimentacaoCorte", "==", true)),
      c.fs.query(colecao, c.fs.where("processo", "in", ["LATERAL", "ALÇA", "ALCA", "ALÇAS"]))
    ];

    const resultados = await Promise.allSettled(consultas.map(consulta => c.fs.getDocs(consulta)));
    const mapa = new Map();
    let consultasValidas = 0;

    resultados.forEach(resultado => {
      if (resultado.status !== "fulfilled") return;
      consultasValidas += 1;
      resultado.value.docs.forEach(docSnap => {
        const item = { id: docSnap.id, ...docSnap.data() };
        if (pertenceLateralAlca(item)) mapa.set(item.id, item);
      });
    });

    if (!consultasValidas) {
      const erro = resultados.find(resultado => resultado.status === "rejected")?.reason;
      throw erro || new Error("Não foi possível consultar movimentações de Lateral e Alça.");
    }

    movimentos = [...mapa.values()];
    movimentos.sort((a, b) => {
      const da = a.atualizadoEm?.toMillis?.() || a.criadoEm?.toMillis?.() || Date.parse(a.dataChegada || a.dataEnvio || "") || 0;
      const db = b.atualizadoEm?.toMillis?.() || b.criadoEm?.toMillis?.() || Date.parse(b.dataChegada || b.dataEnvio || "") || 0;
      return db - da;
    });
  }

  async function carregarPrecos() {
    const c = await aguardarContexto();
    try {
      const snap = await c.fs.getDocs(c.fs.query(c.fs.collection(c.db, "precosReferencia"), c.fs.where("setor", "==", AREA)));
      precos = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    } catch (error) {
      const snap = await c.fs.getDocs(c.fs.collection(c.db, "precosReferencia"));
      precos = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })).filter(item => item.setor === AREA || item.area === AREA);
    }
  }

  async function carregarPagamentosCorte() {
    const c = await aguardarContexto();
    try {
      const snap = await c.fs.getDocs(c.fs.query(c.fs.collection(c.db, "entregasPagamento"), c.fs.where("area", "==", AREA)));
      pagamentosCorte = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    } catch (error) {
      const snap = await c.fs.getDocs(c.fs.collection(c.db, "entregasPagamento"));
      pagamentosCorte = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })).filter(item => item.area === AREA || item.setor === AREA);
    }
  }

  async function carregarTudoCorte(forcar = false) {
    if (carregando) return;

    const estadoCache = window.__CORPONU_CORTE_CACHE_158__ || (window.__CORPONU_CORTE_CACHE_158__ = {
      completoEm: 0
    });
    const CACHE_COMPLETO_MS = 45 * 1000;
    const cacheAindaValido = !forcar &&
      estadoCache.completoEm > 0 &&
      Date.now() - estadoCache.completoEm < CACHE_COMPLETO_MS &&
      movimentos.length > 0;

    if (cacheAindaValido) {
      renderTudo();
      return;
    }

    carregando = true;
    const button = document.getElementById("btnCorteAtualizar");
    if (button) { button.disabled = true; button.textContent = "Atualizando..."; }

    const ordenarMovimentos = () => {
      movimentos.sort((a, b) => {
        const da = a.atualizadoEm?.toMillis?.() || a.criadoEm?.toMillis?.() || Date.parse(a.dataEnvio || "") || 0;
        const db = b.atualizadoEm?.toMillis?.() || b.criadoEm?.toMillis?.() || Date.parse(b.dataEnvio || "") || 0;
        return db - da;
      });
    };

    const tentarCacheLocalMovimentos = async () => {
      try {
        const c = await aguardarContexto();
        if (typeof c.fs.getDocsFromCache !== "function") return false;
        const consulta = c.fs.query(
          c.fs.collection(c.db, "movimentacoesProducao"),
          c.fs.where("area", "==", AREA)
        );
        const snap = await c.fs.getDocsFromCache(consulta);
        if (snap.empty) return false;
        movimentos = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        ordenarMovimentos();
        renderTudo();
        return true;
      } catch (error) {
        return false;
      }
    };

    try {
      await tentarCacheLocalMovimentos();
      await carregarMovimentos();
      renderTudo();

      const etapaPrincipal = [];
      if (!perfil) etapaPrincipal.push(carregarPerfil());
      etapaPrincipal.push(carregarProcessos());
      await Promise.allSettled(etapaPrincipal);
      renderTudo();

      await Promise.allSettled([
        carregarFaccoes(),
        carregarPrecos(),
        carregarPagamentosCorte()
      ]);
      renderTudo();
      estadoCache.completoEm = Date.now();
    } catch (error) {
      console.error(error);
      toast("Não foi possível carregar todos os dados de Lateral e Alça.", "error");
    } finally {
      carregando = false;
      if (button) { button.disabled = false; button.textContent = "Atualizar"; }
    }
  }

  function movimentosFiltrados() {
    const search = norm(document.getElementById("corteBusca")?.value);
    const process = document.getElementById("corteFiltroProcesso")?.value || "";
    const faccao = document.getElementById("corteFiltroFaccao")?.value || "";
    const status = document.getElementById("corteFiltroStatus")?.value || "";
    const lateral = document.getElementById("corteFiltroLateral")?.value || "";
    const start = document.getElementById("corteFiltroInicio")?.value || "";
    const end = document.getElementById("corteFiltroFim")?.value || "";

    return movimentos.filter(item => {
      const destino = item.destino || item.faccao || "";
      const processoAtual = processoCanonico(item.processo || item.servicoNome || item.processoMovimentacao);
      const text = norm([item.numeroOP, item.referencia, item.cor, processoAtual, destino, item.status].join(" "));
      if (!status && movimentoCancelado(item)) return false;
      if (search && !text.includes(search)) return false;
      if (process) {
        const processoFiltro = processoPorId(process)?.nome || process;
        const mesmoId = String(item.processoCorteId || "") === String(process);
        const mesmoNome = processoAtual === processoCanonico(processoFiltro);
        if (!mesmoId && !mesmoNome) return false;
      }
      if (faccao && String(destino) !== faccao) return false;
      if (status) {
        const current = movimentoCancelado(item) ? "cancelado" : norm(item.status || "em_andamento").toLowerCase();
        if (current !== status) return false;
      }
      if (lateral) {
        if (processoAtual === "ALÇA") return false;
        const processConfig = processoPorId(item.processoCorteId) || processoPorNome(item.processo);
        const ready = !movimentoCancelado(item) && Boolean(item.dataChegada) && (processoAtual === "LATERAL" || item.marcaLateralPronta === true || processConfig?.marcaLateralPronta === true);
        if (lateral === "sim" && !ready) return false;
        if (lateral === "nao" && ready) return false;
      }
      const date = item.dataChegada || item.dataEnvio || "";
      if (start && date && date < start) return false;
      if (end && date && date > end) return false;
      return true;
    });
  }

  function preencherFiltros() {
    const processSelect = document.getElementById("corteFiltroProcesso");
    const faccaoSelect = document.getElementById("corteFiltroFaccao");
    const currentProcess = processSelect?.value || "";
    const currentFaccao = faccaoSelect?.value || "";

    if (processSelect) {
      const opcoes = processos.map(item => ({ value: String(item.id), label: String(item.nome || item.id) }));
      movimentos.forEach(item => {
        const nome = processoCanonico(item.processo);
        if (!nome || !["LATERAL", "ALÇA"].includes(nome)) return;
        if (opcoes.some(opcao => processoCanonico(opcao.label) === nome)) return;
        opcoes.push({ value: nome, label: nome });
      });
      opcoes.sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true }));
      processSelect.innerHTML = `<option value="">Todos</option>` + opcoes.map(item => `<option value="${html(item.value)}">${html(item.label)}</option>`).join("");
      if ([...processSelect.options].some(option => option.value === currentProcess)) processSelect.value = currentProcess;
    }

    if (faccaoSelect) {
      const names = [...new Set(movimentos.map(item => item.destino || item.faccao).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
      faccaoSelect.innerHTML = `<option value="">Todas</option>` + names.map(name => `<option value="${html(name)}">${html(name)}</option>`).join("");
      if ([...faccaoSelect.options].some(option => option.value === currentFaccao)) faccaoSelect.value = currentFaccao;
    }
  }

  function renderResumo() {
    const validos = movimentos.filter(item => !movimentoCancelado(item));
    const andamento = validos.filter(item => !item.dataChegada && norm(item.status) === "EM_ANDAMENTO");
    const sent = validos.reduce((sum, item) => sum + numero(item.quantidadeEnviada), 0);
    const received = validos.reduce((sum, item) => sum + numero(item.quantidadeRecebida), 0);
    const missing = validos.reduce((sum, item) => sum + numero(item.falta), 0);
    const withoutValue = pagamentosCorte.filter(item => !pagamentoPago(item) && (item.valorPendente === true || statusNormalizado(item.statusPagamento) === "SEM_VALOR")).length;

    const set = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
    set("corteTotalAndamento", quantidade(andamento.length));
    set("corteTotalEnviadas", quantidade(sent));
    set("corteTotalRecebidas", quantidade(received));
    set("corteTotalFaltas", quantidade(missing));
    set("corteTotalSemValor", quantidade(withoutValue));
  }

  function labelStatus(item) {
    if (movimentoCancelado(item)) return `<span class="corte-pill cancelado">Cancelada</span>`;
    if (item.dataChegada || norm(item.status) === "RETORNOU") return `<span class="corte-pill retornou">Retornou</span>`;
    return `<span class="corte-pill andamento">Em andamento</span>`;
  }

  function pagamentoDoMovimento(movId) {
    return pagamentosCorte.find(item => String(item.movimentacaoId) === String(movId)) || null;
  }

  function renderMovimentos() {
    const body = document.getElementById("listaFaccoesCorte");
    if (!body) return;
    const items = movimentosFiltrados();
    if (!items.length) {
      body.innerHTML = `<tr><td colspan="12" class="corte-empty">Nenhuma movimentação de Lateral ou Alça encontrada.</td></tr>`;
      return;
    }

    body.innerHTML = items.map(item => {
      const pagamento = pagamentoDoMovimento(item.id);
      const legado = movimentacaoUsaFluxoLegado(item);
      const processoAtual = processoCanonico(item.processo || item.servicoNome || item.processoMovimentacao);
      const canCancelBefore = !legado && !movimentoCancelado(item) && !item.dataChegada && (ehAdmin() || String(item.criadoPor || "") === String(user?.uid || ""));
      const canCancelAfter = !legado && !movimentoCancelado(item) && item.dataChegada && ehAdmin();
      const canEditArrival = Boolean(item.dataChegada) && !movimentoCancelado(item) && (legado || !pagamentoPago(pagamento));
      const canArrival = !item.dataChegada && !movimentoCancelado(item);
      const processConfig = processoPorId(item.processoCorteId) || processoPorNome(item.processo);
      const marksLateral = processoAtual === "LATERAL" || item.marcaLateralPronta === true || processConfig?.marcaLateralPronta === true;
      const actions = [];
      if (canArrival) actions.push(`<button class="btn btn-sm btn-success" type="button" data-chegada-corte="${html(item.id)}">Registrar chegada</button>`);
      if (canEditArrival) actions.push(`<button class="btn btn-sm" type="button" data-editar-chegada-corte="${html(item.id)}">Editar chegada</button>`);
      if (canCancelBefore || canCancelAfter) actions.push(`<button class="btn btn-sm btn-danger" type="button" data-cancelar-corte="${html(item.id)}">Cancelar</button>`);

      let componente = "-";
      if (processoAtual === "ALÇA") componente = '<span class="corte-pill lateral">Alça</span>';
      else if (marksLateral && item.dataChegada && !movimentoCancelado(item)) componente = '<span class="corte-pill lateral">Lateral pronta</span>';
      else if (processoAtual === "LATERAL") componente = '<span class="corte-pill lateral">Lateral</span>';

      return `<tr data-movimentacao-id="${html(item.id)}">
        <td><strong>${html(item.numeroOP || "-")}</strong></td>
        <td>${html(item.referencia || "-")}</td>
        <td>${html(item.cor || "-")}</td>
        <td>${html(processoAtual || item.processo || "-")}</td>
        <td>${html(item.destino || item.faccao || "-")}</td>
        <td>${quantidade(item.quantidadeEnviada)}</td>
        <td>${html(dataBR(item.dataEnvio))}</td>
        <td>${html(dataBR(item.dataChegada))}</td>
        <td>${quantidade(item.falta)}</td>
        <td>${labelStatus(item)}${pagamento && (pagamento.valorPendente === true || statusNormalizado(pagamento.statusPagamento) === "SEM_VALOR") ? ' <span class="corte-pill valor">Valor a definir</span>' : ""}</td>
        <td>${componente}</td>
        <td><div class="corte-actions">${actions.join("") || "-"}</div></td>
      </tr>`;
    }).join("");
  }

  function renderProcessosAdmin() {
    const list = document.getElementById("listaProcessosCorteAdmin");
    const select = document.getElementById("precoCorteProcesso");
    if (select) {
      const current = select.value;
      select.innerHTML = `<option value="">Selecione</option>` + processos.map(item => `<option value="${html(item.id)}">${html(item.nome)}${item.ativo === false ? " (inativo)" : ""}</option>`).join("");
      if ([...select.options].some(option => option.value === current)) select.value = current;
    }
    if (!list) return;
    if (!processos.length) {
      list.innerHTML = `<div class="corte-empty">Nenhum processo cadastrado.</div>`;
      return;
    }
    list.innerHTML = processos.map(item => {
      const types = [item.atendeSutia ? "Sutiã" : "", item.atendeCalcinha ? "Calcinha" : ""].filter(Boolean).join(" e ") || "Sem tipo";
      return `<div class="corte-processo-item"><div><strong>${html(item.nome)}</strong>${item.marcaLateralPronta ? ' <span class="corte-pill lateral">Marca lateral pronta</span>' : ""}<small>${html(types)} • ${item.ativo === false ? "Inativo" : "Ativo"}</small></div><div class="corte-actions"><button class="btn btn-sm" type="button" data-editar-processo-corte="${html(item.id)}">Editar</button><button class="btn btn-sm btn-danger" type="button" data-excluir-processo-corte="${html(item.id)}">Excluir</button></div></div>`;
    }).join("");
  }

  function renderPrecosAdmin() {
    const list = document.getElementById("listaPrecosCorteAdmin");
    if (!list) return;
    const items = [...precos].sort((a, b) => `${a.processo}-${a.referencia}`.localeCompare(`${b.processo}-${b.referencia}`, "pt-BR", { numeric: true }));
    if (!items.length) {
      list.innerHTML = `<div class="corte-empty">Nenhum valor de Lateral/Alça cadastrado.</div>`;
      return;
    }
    list.innerHTML = items.map(item => `<div class="corte-preco-item"><div><strong>${html(item.processo || "-")} • Ref. ${html(item.referencia || "-")}</strong><small>${dinheiro(item.valor)} por peça</small></div><button class="btn btn-sm" type="button" data-editar-preco-corte="${html(item.id)}">Editar</button></div>`).join("");
  }

  function renderTudo() {
    atualizarVisibilidadeAdmin();
    preencherFiltros();
    renderResumo();
    renderMovimentos();
    renderProcessosAdmin();
    renderPrecosAdmin();
  }

  async function buscarOP(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    const c = await aguardarContexto();
    try {
      const direct = await c.fs.getDoc(c.fs.doc(c.db, "ordensProducao", text));
      if (direct.exists()) return { id: direct.id, ...direct.data() };
    } catch (error) {}

    const values = [text];
    const numeric = Number(text.replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(numeric)) values.push(numeric);
    for (const field of ["numeroOP", "numeroOPExterno", "op"]) {
      for (const current of values) {
        const snap = await c.fs.getDocs(c.fs.query(c.fs.collection(c.db, "ordensProducao"), c.fs.where(field, "==", current), c.fs.limit(1)));
        if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
      }
    }
    return null;
  }

  function abrirModal(id) {
    document.getElementById(id)?.classList.remove("hidden");
  }

  function fecharModal(id) {
    document.getElementById(id)?.classList.add("hidden");
  }

  function abrirSaida() {
    opSaida = null;
    document.getElementById("formSaidaCorte")?.reset();
    document.getElementById("saidaCortePreview")?.classList.add("hidden");
    document.getElementById("saidaCorteCampos")?.classList.add("hidden");
    const date = document.getElementById("saidaCorteData");
    if (date) date.value = hoje();
    abrirModal("modalSaidaCorte");
    setTimeout(() => document.getElementById("saidaCorteOP")?.focus(), 50);
  }

  function preencherProcessosSaida() {
    const select = document.getElementById("saidaCorteProcesso");
    if (!select || !opSaida) return;
    const compatible = processos.filter(item => item.ativo !== false && processoCompativelComOP(item, opSaida));
    select.innerHTML = `<option value="">Selecione</option>` + compatible.map(item => `<option value="${html(item.id)}">${html(item.nome)}</option>`).join("");
    const faccaoSelect = document.getElementById("saidaCorteFaccao");
    if (faccaoSelect) { faccaoSelect.disabled = true; faccaoSelect.innerHTML = `<option value="">Escolha o processo</option>`; }
  }

  async function preencherFaccoesSaida() {
    const select = document.getElementById("saidaCorteFaccao");
    const processId = document.getElementById("saidaCorteProcesso")?.value || "";
    if (!select || !opSaida) return;
    if (!processId) {
      select.disabled = true;
      select.innerHTML = `<option value="">Escolha o processo</option>`;
      return;
    }

    const processo = processoPorId(processId);
    if (!processo) {
      select.disabled = true;
      select.innerHTML = `<option value="">Processo inválido</option>`;
      return;
    }

    select.disabled = true;
    select.innerHTML = `<option value="">Carregando facções...</option>`;

    try {
      const api = window.CorpoNuFaccoesGrupos;
      if (!api?.listarFaccoesPorProcesso) throw new Error("Catálogo oficial de facções indisponível");
      const items = await api.listarFaccoesPorProcesso(processo.nome);
      select.innerHTML = `<option value="">Selecione</option>` + items
        .filter(item => item.ativo !== false)
        .map(item => `<option value="${html(item.nome || "")}">${html(item.nome || "")}</option>`)
        .join("");
      if (!items.length) select.innerHTML = `<option value="">Nenhuma facção cadastrada para ${html(processo.nome)}</option>`;
      select.disabled = items.length === 0;
    } catch (error) {
      console.error("Não foi possível carregar o grupo oficial de facções.", error);
      select.disabled = true;
      select.innerHTML = `<option value="">Falha ao carregar facções</option>`;
      toast("Não foi possível carregar as facções oficiais deste processo.", "error");
    }
  }

  async function salvarSaida(event) {
    event.preventDefault();
    if (!opSaida) return toast("Busque uma OP antes de registrar a saída.", "error");
    const process = processoPorId(document.getElementById("saidaCorteProcesso")?.value || "");
    const faccao = document.getElementById("saidaCorteFaccao")?.value || "";
    const date = document.getElementById("saidaCorteData")?.value || "";
    if (!process || process.ativo === false) return toast("Selecione um processo ativo.", "error");
    if (!processoCompativelComOP(process, opSaida)) return toast("Esse processo não atende o tipo desta OP.", "error");
    if (!faccao) return toast("Selecione quem fará o processo.", "error");
    if (!date) return toast("Informe a data da saída.", "error");

    const duplicate = await existeProcessoValidoNaOP(opSaida.id, process);
    if (duplicate) {
      return toast(`A OP já possui uma saída válida para o processo ${process.nome}. Cancele a saída anterior antes de tentar novamente.`, "error");
    }

    const total = quantidadeDaOP(opSaida);
    if (!total) return toast("A OP não possui quantidade válida.", "error");
    const opNumber = opSaida.numeroOP || opSaida.numeroOPExterno || opSaida.id;
    if (!confirm(`Confirmar saída?\nOP ${opNumber}\nProcesso: ${process.nome}\nFacção: ${faccao}\nQuantidade: ${quantidade(total)}`)) return;

    const button = event.submitter;
    if (button) { button.disabled = true; button.textContent = "Salvando..."; }
    try {
      const c = await aguardarContexto();
      const movement = {
        origem: "faccoes_lateral_alca",
        area: AREA,
        areaLabel: "Lateral e Alça",
        fluxoFaccoes: FLUXO,
        movimentacaoCorte: true,
        opId: opSaida.id,
        numeroOP: opNumber,
        referencia: opSaida.referencia || "",
        cor: opSaida.cor || "",
        produtoNome: opSaida.produtoNome || opSaida.nomeProduto || "",
        tipoPecaCorte: tipoDaOP(opSaida),
        tipoDestino: "faccao_corte",
        tipoDestinoLabel: "Facção • Lateral e Alça",
        destino: faccao,
        destinoId: faccoes.find(item => norm(item.nome) === norm(faccao))?.id || "",
        processo: process.nome,
        processoCorteId: process.id,
        marcaLateralPronta: process.marcaLateralPronta === true,
        setor: AREA,
        setorLabel: "Lateral e Alça",
        quantidadeEnviada: total,
        quantidadeRecebida: 0,
        dataEnvio: date,
        dataChegada: "",
        falta: 0,
        descontoDefeito: 0,
        defeito: 0,
        status: "em_andamento",
        criadoPor: user.uid,
        criadoPorNome: perfil?.nome || user.displayName || user.email || "Usuário",
        criadoEm: c.fs.serverTimestamp(),
        atualizadoPor: user.uid,
        atualizadoEm: c.fs.serverTimestamp(),
        versaoCorte: VERSION
      };
      const ref = await c.fs.addDoc(c.fs.collection(c.db, "movimentacoesProducao"), movement);
      await c.fs.setDoc(c.fs.doc(c.db, "ordensProducao", opSaida.id), {
        ultimaMovimentacaoCorteId: ref.id,
        ultimaMovimentacaoCorteProcesso: process.nome,
        ultimaMovimentacaoCorteDestino: faccao,
        ultimaMovimentacaoCorteEm: c.fs.serverTimestamp(),
        atualizadoPor: user.uid,
        atualizadoEm: c.fs.serverTimestamp()
      }, { merge: true });
      await registrarLog("corte_saida_registrada", "movimentacaoProducao", ref.id, `OP ${opNumber} | ${process.nome} | ${faccao} | ${total} peças`);
      fecharModal("modalSaidaCorte");
      toast("Saída de Lateral e Alça registrada com sucesso.", "ok");
      await carregarTudoCorte(true);
    } catch (error) {
      console.error(error);
      toast("Erro ao registrar a saída de Lateral e Alça.", "error");
    } finally {
      if (button) { button.disabled = false; button.textContent = "Confirmar saída"; }
    }
  }

  function abrirSeletorChegada() {
    renderSeletorChegada();
    abrirModal("modalSelecionarChegadaCorte");
    setTimeout(() => document.getElementById("buscaSelecionarChegadaCorte")?.focus(), 50);
  }

  function renderSeletorChegada() {
    const body = document.getElementById("listaSelecionarChegadaCorte");
    if (!body) return;
    const search = norm(document.getElementById("buscaSelecionarChegadaCorte")?.value);
    const items = movimentos.filter(item => !item.dataChegada && !movimentoCancelado(item) && (!search || norm([item.numeroOP, item.processo, item.destino || item.faccao].join(" ")).includes(search)));
    body.innerHTML = items.length ? items.map(item => `<tr><td><strong>${html(item.numeroOP || "-")}</strong></td><td>${html(processoCanonico(item.processo) || "-")}</td><td>${html(item.destino || item.faccao || "-")}</td><td>${html(dataBR(item.dataEnvio))}</td><td><button class="btn btn-sm btn-success" type="button" data-chegada-corte="${html(item.id)}">Selecionar</button></td></tr>`).join("") : `<tr><td colspan="5" class="corte-empty">Nenhuma saída em andamento.</td></tr>`;
  }

  async function abrirChegada(movementId, editing = false) {
    movimentoChegada = movimentos.find(item => String(item.id) === String(movementId)) || null;
    if (!movimentoChegada) return toast("Movimentação não encontrada.", "error");
    const payment = pagamentoDoMovimento(movimentoChegada.id);
    if (editing && pagamentoPago(payment)) return toast("A chegada não pode ser editada porque o pagamento já foi confirmado.", "error");
    fecharModal("modalSelecionarChegadaCorte");
    const sent = numero(movimentoChegada.quantidadeEnviada);
    const received = editing ? numero(movimentoChegada.quantidadeRecebida, sent - numero(movimentoChegada.falta)) : sent;
    const missing = editing ? numero(movimentoChegada.falta) : 0;
    document.getElementById("tituloChegadaCorte").textContent = editing ? "Editar chegada de Lateral e Alça" : "Registrar chegada de Lateral e Alça";
    document.getElementById("chegadaCorteMovId").value = movimentoChegada.id;
    document.getElementById("chegadaCorteData").value = movimentoChegada.dataChegada || hoje();
    document.getElementById("chegadaCorteRecebida").value = received;
    document.getElementById("chegadaCorteFalta").value = missing;
    document.getElementById("chegadaCorteDefeito").value = numero(movimentoChegada.descontoDefeito ?? movimentoChegada.defeito);
    document.getElementById("chegadaCorteObs").value = movimentoChegada.observacoesChegada || movimentoChegada.observacoes || "";
    document.getElementById("chegadaCortePreview").innerHTML = `<div class="corte-preview-grid"><div class="corte-preview-item"><small>OP</small><strong>${html(movimentoChegada.numeroOP || "-")}</strong></div><div class="corte-preview-item"><small>Processo</small><strong>${html(processoCanonico(movimentoChegada.processo) || "-")}</strong></div><div class="corte-preview-item"><small>Facção</small><strong>${html(movimentoChegada.destino || movimentoChegada.faccao || "-")}</strong></div><div class="corte-preview-item"><small>Enviado</small><strong>${quantidade(sent)}</strong></div></div>`;
    abrirModal("modalChegadaCorte");
  }

  function sincronizarChegada(origin) {
    if (!movimentoChegada) return;
    const sent = numero(movimentoChegada.quantidadeEnviada);
    const receivedInput = document.getElementById("chegadaCorteRecebida");
    const missingInput = document.getElementById("chegadaCorteFalta");
    if (!receivedInput || !missingInput) return;
    if (origin === "received") {
      const received = Math.min(sent, Math.max(0, numero(receivedInput.value)));
      receivedInput.value = received;
      missingInput.value = Math.max(sent - received, 0);
    } else {
      const missing = Math.min(sent, Math.max(0, numero(missingInput.value)));
      missingInput.value = missing;
      receivedInput.value = Math.max(sent - missing, 0);
    }
  }

  function precoDoMovimento(movement) {
    return precos.find(item => item.ativo !== false && norm(item.referencia) === norm(movement.referencia) && norm(item.processo) === norm(movement.processo)) || null;
  }

  async function criarOuAtualizarPagamento(movement) {
    const c = await aguardarContexto();
    const processoNormalizadoPagamento = norm(movement.processo);
    const ehAlcaGlobal = ["ALCA", "ALCAS"].includes(processoNormalizadoPagamento);
    const ehLateralReferencia = processoNormalizadoPagamento === "LATERAL";
    let conflitoPrecoLateral = false;
    let price = precoDoMovimento(movement);

    if (ehAlcaGlobal) {
      try {
        const globalSnap = await c.fs.getDoc(
          c.fs.doc(c.db, "precosReferencia", "valor-padrao-alca")
        );
        if (globalSnap.exists()) {
          const globalData = { id: globalSnap.id, ...globalSnap.data() };
          const valorGlobal = Math.max(
            numero(globalData.valor ?? globalData.valorUnitario ?? globalData.preco),
            0
          );
          if (globalData.ativo !== false && valorGlobal > 0) price = globalData;
        }
      } catch (error) {
        console.warn("Não foi possível ler o valor global da ALÇA.", error);
      }
    }

    if (ehLateralReferencia) {
      try {
        const referenciaTexto = String(movement.referencia ?? "").trim();
        const referenciasConsulta = [];
        if (referenciaTexto) referenciasConsulta.push(referenciaTexto);
        const referenciaNumero = Number(referenciaTexto.replace(",", "."));
        if (
          referenciaTexto &&
          Number.isFinite(referenciaNumero) &&
          !referenciasConsulta.some(item => typeof item === "number" && item === referenciaNumero)
        ) {
          referenciasConsulta.push(referenciaNumero);
        }

        if (referenciasConsulta.length) {
          const colecaoPrecos = c.fs.collection(c.db, "precosReferencia");
          const consultaPrecos = referenciasConsulta.length > 1
            ? c.fs.query(colecaoPrecos, c.fs.where("referencia", "in", referenciasConsulta))
            : c.fs.query(colecaoPrecos, c.fs.where("referencia", "==", referenciasConsulta[0]));
          const snapshotPrecos = await c.fs.getDocs(consultaPrecos);
          const candidatosLaterais = snapshotPrecos.docs
            .map(documento => ({ id: documento.id, ...documento.data() }))
            .filter(item => {
              const valor = Math.max(
                numero(item.valor ?? item.valorUnitario ?? item.preco ?? item.valorPorPeca),
                0
              );
              return item.ativo !== false && norm(item.processo) === "LATERAL" && valor > 0;
            });
          const valoresLaterais = [...new Set(candidatosLaterais.map(item =>
            Math.max(numero(item.valor ?? item.valorUnitario ?? item.preco ?? item.valorPorPeca), 0).toFixed(6)
          ))];

          if (valoresLaterais.length === 1) {
            price = [...candidatosLaterais].sort((a, b) => {
              const setorA = norm(a.setor) === "LATERAL" ? 0 : 1;
              const setorB = norm(b.setor) === "LATERAL" ? 0 : 1;
              return setorA - setorB || String(a.id).localeCompare(String(b.id), "pt-BR", { numeric: true });
            })[0] || price;
          } else if (valoresLaterais.length > 1) {
            price = null;
            conflitoPrecoLateral = true;
            console.error(
              "Existem valores ativos diferentes para a mesma referência de LATERAL.",
              movement.referencia,
              valoresLaterais
            );
          }
        }
      } catch (error) {
        console.warn("Não foi possível ler o valor cadastrado da LATERAL.", error);
      }
    }
    const paymentId = `corte-${slug(movement.id)}`;
    const paymentRef = c.fs.doc(c.db, "entregasPagamento", paymentId);
    const currentSnap = await c.fs.getDoc(paymentRef);
    const current = currentSnap.exists() ? currentSnap.data() : {};
    if (pagamentoPago(current)) return { ok: false, paid: true, motivo: "Pagamento já confirmado; não foi alterado." };

    const qty = Math.max(numero(movement.quantidadeRecebida), 0);
    const defect = Math.max(numero(movement.descontoDefeito ?? movement.defeito), 0);
    const valorBase = price
      ? Math.max(numero(price.valor ?? price.valorUnitario ?? price.preco ?? price.valorPorPeca), 0)
      : 0;
    const unit = ehAlcaGlobal
      ? Math.round((valorBase * 2 + Number.EPSILON) * 10000) / 10000
      : valorBase;
    const subtotal = arredondar(qty * unit);
    const total = arredondar(Math.max(subtotal - defect, 0));
    const createdBy = current.criadoPor || user.uid;
    const data = {
      origem: "movimentacao_corte",
      origemFluxo: "faccoes_lateral_alca",
      fluxoFaccoes: FLUXO,
      area: AREA,
      areaLabel: "Lateral e Alça",
      movimentacaoId: movement.id,
      opId: movement.opId,
      numeroOP: movement.numeroOP || "",
      referencia: movement.referencia || "",
      cor: movement.cor || "",
      produtoNome: movement.produtoNome || "",
      faccao: movement.destino || "",
      processo: movement.processo || "",
      processoMovimentacao: movement.processo || "",
      processoCorteId: movement.processoCorteId || "",
      servicoNome: movement.processo || "",
      precoReferenciaId: price?.id || "",
      servicoId: price?.id || "",
      setor: ehAlcaGlobal ? "alca" : (ehLateralReferencia ? "lateral" : AREA),
      setorLabel: ehAlcaGlobal ? "Alça" : (ehLateralReferencia ? "Lateral" : "Lateral e Alça"),
      dataEntrega: movement.dataChegada,
      quantidade: qty,
      ...(ehAlcaGlobal ? {
        quantidadeAlcas: qty * 2,
        multiplicadorAlcas: 2,
        valorUnitarioAlca: valorBase,
        formaValorPagamento: "valor_global_alca",
        calculoAlca: "quantidade_recebida_x_2_x_valor_alca"
      } : {}),
      ...(ehLateralReferencia ? {
        formaValorPagamento: "valor_unitario_referencia",
        calculoLateral: "quantidade_recebida_x_valor_referencia",
        origemPrecoLateral: "precosReferencia"
      } : {}),
      falta: numero(movement.falta),
      descontoDefeito: defect,
      subtotal,
      valorUnitario: unit,
      total,
      statusPagamento: price ? "pendente" : "sem_valor",
      valorPendente: !price,
      valorManualFinanceiroPendente: !price,
      avisoPagamento: price
        ? ""
        : (conflitoPrecoLateral
          ? `Existem valores ativos diferentes para Ref. ${movement.referencia || "-"} + LATERAL. Revise o Gerenciador de valores.`
          : `Adicionar valor para Ref. ${movement.referencia || "-"} + ${movement.processo || "-"}.`),
      observacoes: price
        ? (ehLateralReferencia
          ? "Gerado pela chegada da área Lateral e Alça com o valor cadastrado da referência."
          : "Gerado pela chegada da área Lateral e Alça.")
        : (conflitoPrecoLateral
          ? "Valor a definir: existem valores ativos diferentes para esta referência de LATERAL."
          : "Valor a definir: não existe preço cadastrado para esta referência e processo de Lateral/Alça."),
      criadoPor: createdBy,
      criadoEm: current.criadoEm || c.fs.serverTimestamp(),
      atualizadoPor: user.uid,
      atualizadoEm: c.fs.serverTimestamp(),
      versaoCorte: VERSION
    };
    await c.fs.setDoc(paymentRef, data, { merge: true });
    return { ok: Boolean(price), semValor: !price, total, paymentId };
  }

  async function marcarLateralPronta(movement) {
    const process = processoPorId(movement.processoCorteId) || processoPorNome(movement.processo);
    if (!(movement.marcaLateralPronta === true || process?.marcaLateralPronta === true || processoCanonico(movement.processo) === "LATERAL")) return;
    const c = await aguardarContexto();
    await c.fs.setDoc(c.fs.doc(c.db, "ordensProducao", movement.opId), {
      lateralProntaCorte: true,
      lateralProntaCorteAtiva: true,
      lateralProntaCorteMovimentacaoId: movement.id,
      lateralProntaCorteProcesso: movement.processo || "",
      lateralProntaCorteFaccao: movement.destino || "",
      lateralProntaCorteQuantidade: numero(movement.quantidadeRecebida),
      lateralProntaCorteUsuarioUid: user.uid,
      lateralProntaCorteUsuarioNome: perfil?.nome || user.displayName || user.email || "Usuário",
      lateralProntaCorteEm: c.fs.serverTimestamp(),
      lateralProntaOrigemAtual: "faccao_corte",
      lateralProntaOrigemAtualLabel: "Facção • Lateral e Alça",
      lateralProntaOrigemAtualEm: c.fs.serverTimestamp(),
      atualizadoPor: user.uid,
      atualizadoEm: c.fs.serverTimestamp()
    }, { merge: true });
  }

  async function opPorId(opId) {
    if (!opId) return null;
    const c = await aguardarContexto();
    const snap = await c.fs.getDoc(c.fs.doc(c.db, "ordensProducao", String(opId)));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  async function recalcularMontagemPorOP(opId, forceCorte = null) {
    try {
      const op = await opPorId(opId);
      if (!op) return;
      const corteAtivo = forceCorte === null ? op.lateralProntaCorte === true && op.lateralProntaCorteAtiva !== false : forceCorte;
      const api = window.CorpoNuRevisaoComponentes;
      if (!api?.recalcular) return;
      if (corteAtivo) {
        const internal = op.revisaoComponentesConfeccao || {};
        const synthetic = {
          ...op,
          revisaoComponentesConfeccao: {
            ...internal,
            ativa: true,
            lateralFeita: true,
            bojoFeito: internal.ativa === true && internal.bojoFeito === true
          },
          lateralFeitaConfeccao: true
        };
        await api.carregarConfig?.();
        await api.recalcular(synthetic);
      } else {
        await api.carregarConfig?.();
        await api.recalcular(op);
      }
    } catch (error) {
      console.warn("Pagamentos de montagem não recalculados após Lateral/Alça", error);
    }
  }

  async function salvarChegada(event) {
    event.preventDefault();
    if (!movimentoChegada) return toast("Selecione uma movimentação.", "error");
    const date = document.getElementById("chegadaCorteData")?.value || "";
    const received = Math.max(0, numero(document.getElementById("chegadaCorteRecebida")?.value));
    const missing = Math.max(0, numero(document.getElementById("chegadaCorteFalta")?.value));
    const defect = Math.max(0, numero(document.getElementById("chegadaCorteDefeito")?.value));
    const observation = document.getElementById("chegadaCorteObs")?.value?.trim() || "Sem observações";
    const sent = numero(movimentoChegada.quantidadeEnviada);
    if (!date) return toast("Informe a data da chegada.", "error");
    if (received > sent) return toast("A quantidade recebida não pode ser maior que a enviada.", "error");
    if (received + missing !== sent) return toast("Quantidade recebida + falta precisa ser igual à quantidade enviada.", "error");

    const currentPayment = pagamentoDoMovimento(movimentoChegada.id);
    if (pagamentoPago(currentPayment)) return toast("Não é possível editar uma chegada com pagamento confirmado.", "error");
    if (!confirm(`Confirmar chegada?\nOP ${movimentoChegada.numeroOP}\nRecebido: ${quantidade(received)}\nFalta: ${quantidade(missing)}\nDesconto por defeito: ${dinheiro(defect)}`)) return;

    const button = event.submitter;
    if (button) { button.disabled = true; button.textContent = "Salvando..."; }
    try {
      const c = await aguardarContexto();
      const patch = {
        dataChegada: date,
        quantidadeRecebida: received,
        falta: missing,
        descontoDefeito: defect,
        defeito: defect,
        observacoesChegada: observation,
        status: "retornou",
        atualizadoPor: user.uid,
        atualizadoEm: c.fs.serverTimestamp(),
        versaoCorte: VERSION
      };
      await c.fs.setDoc(c.fs.doc(c.db, "movimentacoesProducao", movimentoChegada.id), patch, { merge: true });
      const updated = { ...movimentoChegada, ...patch, atualizadoEm: new Date() };
      const payment = await criarOuAtualizarPagamento(updated);
      await marcarLateralPronta(updated);

      movimentoChegada = updated;
      movimentos = movimentos.map(item => String(item.id) === String(updated.id) ? updated : item);

      const pagamentoAnterior = pagamentoDoMovimento(updated.id);
      const pagamentoLocal = {
        ...(pagamentoAnterior || {}),
        id: payment.paymentId || pagamentoAnterior?.id || `corte-${slug(updated.id)}`,
        movimentacaoId: updated.id,
        area: AREA,
        setor: AREA,
        numeroOP: updated.numeroOP || "",
        referencia: updated.referencia || "",
        processo: updated.processo || "",
        faccao: updated.destino || "",
        dataEntrega: date,
        quantidade: received,
        falta: missing,
        descontoDefeito: defect,
        total: payment.total,
        statusPagamento: payment.semValor ? "sem_valor" : "pendente",
        valorPendente: payment.semValor === true
      };
      if (pagamentoAnterior) {
        pagamentosCorte = pagamentosCorte.map(item => String(item.id) === String(pagamentoAnterior.id) ? pagamentoLocal : item);
      } else {
        pagamentosCorte = [pagamentoLocal, ...pagamentosCorte];
      }

      fecharModal("modalChegadaCorte");
      renderTudo();
      toast(payment.semValor ? "Chegada registrada. O pagamento ficou como Valor a definir." : `Chegada registrada e pagamento gerado: ${dinheiro(payment.total)}.`, "ok");

      Promise.resolve(recalcularMontagemPorOP(updated.opId, true)).catch(error => {
        console.warn("Recálculo posterior da montagem não concluído", error);
      });
      Promise.resolve(registrarLog("corte_chegada_registrada", "movimentacaoProducao", updated.id, `OP ${updated.numeroOP} | ${updated.processo} | voltou ${received} | falta ${missing} | defeito ${dinheiro(defect)}`)).catch(error => {
        console.warn("Log posterior da chegada não concluído", error);
      });
      window.setTimeout(() => {
        Promise.resolve(carregarTudoCorte()).catch(error => {
          console.warn("Atualização posterior da área Lateral não concluída", error);
        });
      }, 1500);
    } catch (error) {
      console.error(error);
      toast("Erro ao registrar a chegada de Lateral e Alça.", "error");
    } finally {
      if (button) { button.disabled = false; button.textContent = "Salvar chegada"; }
    }
  }

  async function recalcularLateralCorteDaOP(opId) {
    const c = await aguardarContexto();
    const snap = await c.fs.getDocs(c.fs.query(c.fs.collection(c.db, "movimentacoesProducao"), c.fs.where("opId", "==", opId)));
    const valid = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })).filter(item => {
      const process = processoPorId(item.processoCorteId) || processoPorNome(item.processo);
      return pertenceLateralAlca(item) && !movimentoCancelado(item) && Boolean(item.dataChegada) && (item.marcaLateralPronta === true || process?.marcaLateralPronta === true || processoCanonico(item.processo) === "LATERAL");
    }).sort((a, b) => {
      const da = a.atualizadoEm?.toMillis?.() || Date.parse(a.dataChegada || "") || 0;
      const db = b.atualizadoEm?.toMillis?.() || Date.parse(b.dataChegada || "") || 0;
      return db - da;
    });
    const latest = valid[0] || null;
    let patch;
    if (latest) {
      patch = {
        lateralProntaCorte: true,
        lateralProntaCorteAtiva: true,
        lateralProntaCorteMovimentacaoId: latest.id,
        lateralProntaCorteProcesso: latest.processo || "",
        lateralProntaCorteFaccao: latest.destino || "",
        lateralProntaCorteQuantidade: numero(latest.quantidadeRecebida),
        lateralProntaOrigemAtual: "faccao_corte",
        lateralProntaOrigemAtualLabel: "Facção • Lateral e Alça",
        lateralProntaOrigemAtualEm: c.fs.serverTimestamp(),
        atualizadoPor: user.uid,
        atualizadoEm: c.fs.serverTimestamp()
      };
    } else {
      patch = {
        lateralProntaCorte: false,
        lateralProntaCorteAtiva: false,
        lateralProntaCorteMovimentacaoId: "",
        lateralProntaCorteProcesso: "",
        lateralProntaCorteFaccao: "",
        lateralProntaCorteQuantidade: 0,
        atualizadoPor: user.uid,
        atualizadoEm: c.fs.serverTimestamp()
      };
      const ordemSnap = await c.fs.getDoc(c.fs.doc(c.db, "ordensProducao", opId));
      const ordemAtual = ordemSnap.exists() ? ordemSnap.data() : {};
      if (ordemAtual.lateralProntaOrigemAtual === "faccao_corte") {
        patch.lateralProntaOrigemAtual = "";
        patch.lateralProntaOrigemAtualLabel = "";
        patch.lateralProntaOrigemAtualEm = c.fs.serverTimestamp();
      }
    }
    await c.fs.setDoc(c.fs.doc(c.db, "ordensProducao", opId), patch, { merge: true });
    await recalcularMontagemPorOP(opId, Boolean(latest));
  }

  async function cancelarMovimento(movementId) {
    const movement = movimentos.find(item => String(item.id) === String(movementId));
    if (!movement) return toast("Movimentação não encontrada.", "error");
    if (movimentacaoUsaFluxoLegado(movement)) return toast("Movimentações antigas devem ser canceladas pela listagem original de Facções.", "error");
    const beforeArrival = !movement.dataChegada;
    const isCreator = String(movement.criadoPor || "") === String(user?.uid || "");
    if (beforeArrival && !ehAdmin() && !isCreator) return toast("Somente quem registrou a saída ou o administrador pode cancelar.", "error");
    if (!beforeArrival && !ehAdmin()) return toast("Depois da chegada, somente o administrador pode cancelar.", "error");

    const payment = pagamentoDoMovimento(movement.id);
    const reason = beforeArrival ? "" : prompt("Informe a justificativa do cancelamento:", "");
    if (!beforeArrival && !reason?.trim()) return;
    if (!confirm(`Cancelar a movimentação da OP ${movement.numeroOP} para ${movement.processo}?`)) return;

    try {
      const c = await aguardarContexto();
      await c.fs.setDoc(c.fs.doc(c.db, "movimentacoesProducao", movement.id), {
        status: "cancelado",
        cancelado: true,
        canceladoAntesChegada: beforeArrival,
        motivoCancelamento: reason?.trim() || "Cancelada antes da chegada",
        canceladoPor: user.uid,
        canceladoEm: c.fs.serverTimestamp(),
        atualizadoPor: user.uid,
        atualizadoEm: c.fs.serverTimestamp()
      }, { merge: true });

      if (payment) {
        await c.fs.setDoc(c.fs.doc(c.db, "entregasPagamento", payment.id), {
          statusPagamento: "cancelado",
          cancelado: true,
          canceladoAposPagamento: pagamentoPago(payment),
          motivoCancelamento: reason?.trim() || "Movimentação cancelada",
          canceladoPor: user.uid,
          canceladoEm: c.fs.serverTimestamp(),
          atualizadoPor: user.uid,
          atualizadoEm: c.fs.serverTimestamp()
        }, { merge: true });
      }

      await recalcularLateralCorteDaOP(movement.opId);
      await registrarLog("corte_movimentacao_cancelada", "movimentacaoProducao", movement.id, `OP ${movement.numeroOP} | ${movement.processo} | ${reason?.trim() || "antes da chegada"}`);
      toast("Movimentação cancelada. A OP poderá ser enviada novamente para este processo se não houver outra saída válida.", "ok");
      await carregarTudoCorte(true);
    } catch (error) {
      console.error(error);
      toast("Erro ao cancelar a movimentação.", "error");
    }
  }

  function limparFormProcesso() {
    processoEdicaoId = "";
    document.getElementById("formProcessoCorte")?.reset();
    const active = document.getElementById("processoCorteAtivo");
    if (active) active.checked = true;
    const hidden = document.getElementById("processoCorteId");
    if (hidden) hidden.value = "";
  }

  function editarProcesso(id) {
    const item = processoPorId(id);
    if (!item) return;
    processoEdicaoId = item.id;
    document.getElementById("processoCorteId").value = item.id;
    document.getElementById("processoCorteNome").value = item.nome || "";
    document.getElementById("processoCorteDescricao").value = item.descricao || "";
    document.getElementById("processoCorteSutia").checked = item.atendeSutia === true;
    document.getElementById("processoCorteCalcinha").checked = item.atendeCalcinha === true;
    document.getElementById("processoCorteLateral").checked = item.marcaLateralPronta === true;
    document.getElementById("processoCorteAtivo").checked = item.ativo !== false;
    document.getElementById("processoCorteObs").value = item.observacoes || "";
    document.getElementById("processoCorteNome")?.focus();
  }

  async function salvarConfigProcessos(nextProcesses, action, details) {
    const c = await aguardarContexto();
    await c.fs.setDoc(c.fs.doc(c.db, "configuracoes", CONFIG_ID), {
      processos: nextProcesses,
      atualizadoPor: user.uid,
      atualizadoEm: c.fs.serverTimestamp(),
      versao: VERSION
    }, { merge: true });
    processos = nextProcesses;
    await registrarLog(action, "configuracao", CONFIG_ID, details);
  }

  async function salvarProcesso(event) {
    event.preventDefault();
    if (!ehAdmin()) return toast("Somente o administrador pode salvar processos.", "error");
    const name = norm(document.getElementById("processoCorteNome")?.value || "");
    const description = document.getElementById("processoCorteDescricao")?.value?.trim() || "";
    const sutia = document.getElementById("processoCorteSutia")?.checked === true;
    const calcinha = document.getElementById("processoCorteCalcinha")?.checked === true;
    const lateral = document.getElementById("processoCorteLateral")?.checked === true;
    const active = document.getElementById("processoCorteAtivo")?.checked !== false;
    const notes = document.getElementById("processoCorteObs")?.value?.trim() || "";
    if (!name) return toast("Informe o nome do processo.", "error");
    if (!sutia && !calcinha) return toast("Marque se o processo atende Sutiã, Calcinha ou ambos.", "error");
    const duplicate = processos.find(item => norm(item.nome) === name && String(item.id) !== String(processoEdicaoId));
    if (duplicate) return toast("Já existe um processo de Corte com esse nome.", "error");
    if (lateral && active && !confirm("Este processo será o único processo ativo que marca lateral pronta. Continuar?")) return;

    const now = new Date().toISOString();
    const id = processoEdicaoId || slug(name);
    let next = processos.map(item => lateral && active && String(item.id) !== String(id) ? { ...item, marcaLateralPronta: false, atualizadoEmISO: now } : { ...item });
    const current = next.find(item => String(item.id) === String(id));
    const record = {
      id,
      nome: name,
      descricao: description,
      atendeSutia: sutia,
      atendeCalcinha: calcinha,
      marcaLateralPronta: lateral,
      ativo: active,
      observacoes: notes,
      criadoPor: current?.criadoPor || user.uid,
      criadoEmISO: current?.criadoEmISO || now,
      atualizadoPor: user.uid,
      atualizadoEmISO: now
    };
    next = current ? next.map(item => String(item.id) === String(id) ? record : item) : [...next, record];
    next.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    try {
      await salvarConfigProcessos(next, current ? "corte_processo_atualizado" : "corte_processo_criado", `${name} | Sutiã ${sutia ? "sim" : "não"} | Calcinha ${calcinha ? "sim" : "não"} | lateral ${lateral ? "sim" : "não"}`);
      limparFormProcesso();
      renderTudo();
      toast("Processo de Corte salvo.", "ok");
    } catch (error) {
      console.error(error);
      toast("Erro ao salvar o processo de Lateral/Alça.", "error");
    }
  }

  async function excluirProcesso(id) {
    if (!ehAdmin()) return;
    const item = processoPorId(id);
    if (!item) return;
    try {
      const c = await aguardarContexto();
      const paymentSnap = await c.fs.getDocs(c.fs.query(c.fs.collection(c.db, "entregasPagamento"), c.fs.where("processo", "==", item.nome)));
      const hasPayment = paymentSnap.docs.some(docSnap => {
        const data = docSnap.data();
        return data.area === AREA || data.setor === AREA;
      });
      if (hasPayment) return toast("Esse processo já possui pagamento e não pode ser excluído. Edite e desative o processo.", "error");
      if (!confirm(`Excluir o processo ${item.nome}?`)) return;
      const next = processos.filter(process => String(process.id) !== String(id));
      await salvarConfigProcessos(next, "corte_processo_excluido", item.nome);
      renderTudo();
      toast("Processo excluído.", "ok");
    } catch (error) {
      console.error(error);
      toast("Erro ao excluir o processo.", "error");
    }
  }

  function editarPreco(id) {
    const item = precos.find(price => String(price.id) === String(id));
    if (!item) return;
    const process = processoPorNome(item.processo);
    document.getElementById("precoCorteProcesso").value = process?.id || item.processoCorteId || "";
    document.getElementById("precoCorteReferencia").value = item.referencia || "";
    document.getElementById("precoCorteValor").value = numero(item.valor);
    document.getElementById("precoCorteValor")?.focus();
  }

  async function pagamentosPendentesParaPreco(reference, processName) {
    const c = await aguardarContexto();
    const snap = await c.fs.getDocs(c.fs.collection(c.db, "entregasPagamento"));
    return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })).filter(item => (item.area === AREA || item.setor === AREA) && norm(item.referencia) === norm(reference) && norm(item.processo) === norm(processName) && !pagamentoPago(item) && !["CANCELADO", "EXCLUIDO"].includes(statusNormalizado(item.statusPagamento)));
  }

  async function recalcularPagamentosPreco(reference, process, price, priceId) {
    const pending = await pagamentosPendentesParaPreco(reference, process.nome);
    if (!pending.length) return 0;
    const c = await aguardarContexto();
    let batch = c.fs.writeBatch(c.db);
    let count = 0;
    for (const payment of pending) {
      const qty = Math.max(0, numero(payment.quantidade));
      const defect = Math.max(0, numero(payment.descontoDefeito ?? payment.defeito));
      const subtotal = arredondar(qty * price);
      const total = arredondar(Math.max(subtotal - defect, 0));
      batch.set(c.fs.doc(c.db, "entregasPagamento", payment.id), {
        precoReferenciaId: priceId,
        servicoId: priceId,
        valorUnitario: price,
        subtotal,
        total,
        statusPagamento: "pendente",
        valorPendente: false,
        avisoPagamento: "",
        observacoes: "Valor de Lateral/Alça definido e pagamento pendente recalculado.",
        atualizadoPor: user.uid,
        atualizadoEm: c.fs.serverTimestamp(),
        versaoCorte: VERSION
      }, { merge: true });
      count += 1;
      if (count % 400 === 0) {
        await batch.commit();
        batch = c.fs.writeBatch(c.db);
      }
    }
    if (count % 400 !== 0) await batch.commit();
    return count;
  }

  async function salvarPreco(event) {
    event.preventDefault();
    if (!ehAdmin()) return toast("Somente o administrador pode salvar valores.", "error");
    const process = processoPorId(document.getElementById("precoCorteProcesso")?.value || "");
    const reference = norm(document.getElementById("precoCorteReferencia")?.value || "");
    const price = Math.max(0, numero(document.getElementById("precoCorteValor")?.value));
    if (!process || !reference || price <= 0) return toast("Informe processo, referência e valor maior que zero.", "error");
    const pending = await pagamentosPendentesParaPreco(reference, process.nome);
    const message = pending.length ? `Salvar ${dinheiro(price)} para Ref. ${reference} + ${process.nome}?\n${pending.length} pagamento(s) pendente(s) serão recalculados.` : `Salvar ${dinheiro(price)} para Ref. ${reference} + ${process.nome}?`;
    if (!confirm(message)) return;
    const priceId = `corte-${slug(reference)}-${slug(process.id)}`;
    try {
      const c = await aguardarContexto();
      await c.fs.setDoc(c.fs.doc(c.db, "precosReferencia", priceId), {
        referencia: reference,
        processo: process.nome,
        processoCorteId: process.id,
        setor: AREA,
        setorLabel: "Corte",
        area: AREA,
        areaLabel: "Lateral e Alça",
        valor: arredondar(price),
        ativo: true,
        atualizadoPor: user.uid,
        atualizadoEm: c.fs.serverTimestamp(),
        criadoPor: precos.find(item => item.id === priceId)?.criadoPor || user.uid,
        criadoEm: precos.find(item => item.id === priceId)?.criadoEm || c.fs.serverTimestamp(),
        versaoCorte: VERSION
      }, { merge: true });
      const updated = await recalcularPagamentosPreco(reference, process, arredondar(price), priceId);
      await registrarLog("corte_valor_referencia_salvo", "precoReferencia", priceId, `${reference} | ${process.nome} | ${dinheiro(price)} | ${updated} pagamentos recalculados`);
      document.getElementById("formPrecoCorte")?.reset();
      await carregarTudoCorte(true);
      toast(`Valor salvo. ${updated} pagamento(s) pendente(s) recalculado(s).`, "ok");
    } catch (error) {
      console.error(error);
      toast("Erro ao salvar o valor de Lateral/Alça.", "error");
    }
  }

  function imprimirCorte() {
    const items = movimentosFiltrados();
    if (!items.length) return toast("Nenhuma movimentação filtrada para imprimir.", "error");
    const rows = items.map(item => `<tr><td>${html(item.numeroOP || "-")}</td><td>${html(item.referencia || "-")}</td><td>${html(item.cor || "-")}</td><td>${html(processoCanonico(item.processo) || "-")}</td><td>${html(item.destino || item.faccao || "-")}</td><td>${quantidade(item.quantidadeEnviada)}</td><td>${html(dataBR(item.dataEnvio))}</td><td>${html(dataBR(item.dataChegada))}</td><td>${quantidade(item.falta)}</td><td>${html(movimentoCancelado(item) ? "Cancelada" : item.dataChegada ? "Retornou" : "Em andamento")}</td></tr>`).join("");
    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) return toast("Permita pop-ups para imprimir.", "error");
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório Lateral e Alça</title><style>body{font-family:Arial;margin:18px;color:#0f172a}h1{margin:0}p{color:#475569}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}th{background:#f1f5f9}@media print{button{display:none}}</style></head><body><h1>Facções — Lateral e Alça</h1><p>Impresso em ${html(new Date().toLocaleString("pt-BR"))}</p><table><thead><tr><th>OP</th><th>REF</th><th>Cor</th><th>Processo</th><th>Facção</th><th>Qtd.</th><th>Saída</th><th>Chegada</th><th>Falta</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`);
    win.document.close();
  }

  async function preencherLateralNosModais(opId, prefix) {
    try {
      const op = await opPorId(opId);
      if (!op || op.lateralProntaCorte !== true || op.lateralProntaCorteAtiva === false) return;
      const field = document.getElementById(`${prefix}LateralPronta`);
      if (field) {
        field.value = "sim";
        field.title = "Lateral pronta — Facção de Lateral e Alça";
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } catch (error) {}
  }

  function argOnclick(button) {
    return String(button?.getAttribute("onclick") || "").match(/\(\s*['\"]([^'\"]+)['\"]/)?.[1] || "";
  }

  function programarRecalculoOP(opId) {
    [900, 2200, 4800].forEach(delay => setTimeout(() => recalcularMontagemPorOP(opId), delay));
  }

  async function atualizarOrigemAposRevisaoInterna() {
    const opNumber = document.getElementById("revNumeroOP")?.value?.trim() || "";
    if (!opNumber) return;
    const lateral = document.getElementById("revLateral")?.checked === true;
    setTimeout(async () => {
      try {
        const op = await buscarOP(opNumber);
        if (!op) return;
        if (!lateral) {
          await recalcularLateralCorteDaOP(op.id);
          return;
        }
        const c = await aguardarContexto();
        await c.fs.setDoc(c.fs.doc(c.db, "ordensProducao", op.id), {
          lateralProntaOrigemAtual: "confeccao",
          lateralProntaOrigemAtualLabel: "Confecção",
          lateralProntaOrigemAtualEm: c.fs.serverTimestamp(),
          atualizadoPor: user.uid,
          atualizadoEm: c.fs.serverTimestamp()
        }, { merge: true });
        await recalcularMontagemPorOP(op.id);
      } catch (error) {}
    }, 900);
  }

  inferirClassificacaoFaccao = faccao => {
    const processosPermitidos = Array.isArray(faccao?.processosPermitidos) ? faccao.processosPermitidos : [];
    const grupos = Array.isArray(faccao?.gruposPermitidos) ? faccao.gruposPermitidos : [];
    const texto = norm([...processosPermitidos, ...grupos, faccao?.grupo].join(" "));
    const sutiaInferido = faccao?.atendeSutia === true || /SUTIA|BOJO|ALCA/.test(texto);
    const calcinhaInferida = faccao?.atendeCalcinha === true || texto.includes("CALCINHA");
    return {
      sutia: typeof faccao?.trabalhaSutia === "boolean" ? faccao.trabalhaSutia : sutiaInferido,
      calcinha: typeof faccao?.trabalhaCalcinha === "boolean" ? faccao.trabalhaCalcinha : calcinhaInferida
    };
  };

  const abrirChegadaBaseCorte = abrirChegada;
  abrirChegada = async function(movementId, editing = false) {
    const movement = movimentos.find(item => String(item.id) === String(movementId));
    const payment = movement ? pagamentoDoMovimento(movement.id) : null;
    if (editing && payment && !ehAdmin() && String(payment.criadoPor || "") !== String(user?.uid || "")) {
      return toast("Somente quem registrou esta chegada ou o administrador pode editá-la.", "error");
    }
    return abrirChegadaBaseCorte(movementId, editing);
  };

  const salvarChegadaBaseCorte = salvarChegada;
  salvarChegada = async function(event) {
    const payment = movimentoChegada ? pagamentoDoMovimento(movimentoChegada.id) : null;
    if (payment && !ehAdmin() && String(payment.criadoPor || "") !== String(user?.uid || "")) {
      event?.preventDefault?.();
      return toast("Somente quem registrou esta chegada ou o administrador pode alterá-la.", "error");
    }
    return salvarChegadaBaseCorte(event);
  };

  async function recalcularTodasLateraisCorte() {
    try {
      const c = await aguardarContexto();
      const snap = await c.fs.getDocs(c.fs.query(c.fs.collection(c.db, "ordensProducao"), c.fs.where("lateralProntaCorte", "==", true)));
      for (const ordem of snap.docs) {
        const data = ordem.data();
        if (data.lateralProntaCorteAtiva !== false) await recalcularMontagemPorOP(ordem.id, true);
      }
    } catch (error) {
      console.warn("Não foi possível recalcular todas as laterais de Lateral/Alça.", error);
    }
  }

  function ligarEventos() {
    if (document.documentElement.dataset.eventosFaccoesCorte === VERSION) return;
    document.documentElement.dataset.eventosFaccoesCorte = VERSION;

    document.addEventListener("click", event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const navFaccoes = target.closest('.nav-btn[data-page="faccoes"]');
      if (navFaccoes) {
        setTimeout(() => {
          injetarUI();
          atualizarVisibilidadeAdmin();
          if (!document.getElementById("painelFaccoesCorte")?.classList.contains("hidden")) carregarTudoCorte();
        }, 0);
      }

      if (target.closest("#btnCorteRegistrarSaida")) return abrirSaida();
      if (target.closest("#btnChegadaManualLateralAlca")) {
        garantirProcessosChegadaManual();
        document.getElementById("btnAbrirChegadaManualFaccao")?.click();
        return;
      }
      if (target.closest("#btnCorteAtualizar")) return carregarTudoCorte(true);
      if (target.closest("#btnCorteImprimir")) return imprimirCorte();
      const close = target.closest("[data-fechar-corte]");
      if (close) return fecharModal(close.dataset.fecharCorte);
      if (target.closest("#btnBuscarOPCorte")) return acaoBuscarOPSaida();
      if (target.closest("#btnCorteLimparFiltros")) {
        ["corteBusca", "corteFiltroProcesso", "corteFiltroFaccao", "corteFiltroStatus", "corteFiltroLateral", "corteFiltroInicio", "corteFiltroFim"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
        renderMovimentos();
        return;
      }
      const arrival = target.closest("[data-chegada-corte]");
      if (arrival) return abrirChegadaCompatibilidade(arrival.dataset.chegadaCorte, false);
      const editArrival = target.closest("[data-editar-chegada-corte]");
      if (editArrival) return abrirChegadaCompatibilidade(editArrival.dataset.editarChegadaCorte, true);
      const cancelMovement = target.closest("[data-cancelar-corte]");
      if (cancelMovement) return cancelarMovimento(cancelMovement.dataset.cancelarCorte);
      const editProcess = target.closest("[data-editar-processo-corte]");
      if (editProcess) return editarProcesso(editProcess.dataset.editarProcessoCorte);
      const deleteProcess = target.closest("[data-excluir-processo-corte]");
      if (deleteProcess) return excluirProcesso(deleteProcess.dataset.excluirProcessoCorte);
      if (target.closest("#btnCancelarProcessoCorte")) return limparFormProcesso();
      const editPrice = target.closest("[data-editar-preco-corte]");
      if (editPrice) return editarPreco(editPrice.dataset.editarPrecoCorte);
      const cancelInternalRevision = target.closest("[data-cancelar-rev]");
      if (cancelInternalRevision) {
        const opId = cancelInternalRevision.dataset.cancelarRev || "";
        if (opId) [900, 2200, 4800].forEach(delay => setTimeout(() => recalcularLateralCorteDaOP(opId).catch(() => {}), delay));
      }


      const mainSend = target.closest('[onclick*="mandarParaFaccao"],[onclick*="abrirModalMovimentacao"]');
      if (mainSend) {
        const id = argOnclick(mainSend);
        if (id) [160, 600].forEach(delay => setTimeout(() => preencherLateralNosModais(id, "movimentacao"), delay));
      }
      const mainArrival = target.closest('[onclick*="registrarChegadaMovimentacao"]');
      if (mainArrival) {
        const movementId = argOnclick(mainArrival);
        if (movementId) {
          [200, 700].forEach(delay => setTimeout(async () => {
            const c = await aguardarContexto();
            const snap = await c.fs.getDoc(c.fs.doc(c.db, "movimentacoesProducao", movementId));
            if (snap.exists()) preencherLateralNosModais(snap.data().opId, "chegada");
          }, delay));
        }
      }
    }, true);

    document.addEventListener("input", event => {
      const target = event.target;
      if (target?.id === "corteBusca") renderMovimentos();
      if (target?.id === "buscaSelecionarChegadaCorte") renderSeletorChegada();
      if (target?.id === "chegadaCorteRecebida") sincronizarChegada("received");
      if (target?.id === "chegadaCorteFalta") sincronizarChegada("missing");
    }, true);

    document.addEventListener("change", event => {
      const target = event.target;
      if (["corteFiltroProcesso", "corteFiltroFaccao", "corteFiltroStatus", "corteFiltroLateral", "corteFiltroInicio", "corteFiltroFim"].includes(target?.id)) renderMovimentos();
      if (target?.id === "saidaCorteProcesso") Promise.resolve(preencherFaccoesSaida()).catch(error => console.error(error));
    }, true);

    document.addEventListener("submit", event => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.id === "formSaidaCorte") return salvarSaida(event);
      if (form.id === "formChegadaCorte") return salvarChegada(event);
      if (form.id === "formProcessoCorte") return salvarProcesso(event);
      if (form.id === "formPrecoCorte") return salvarPreco(event);
      if (form.id === "formRevisaoComponentes") atualizarOrigemAposRevisaoInterna();
      if (form.id === "formConfigRev") [1500, 3200, 5600].forEach(delay => setTimeout(recalcularTodasLateraisCorte, delay));
      if (["formChegadaMovimentacao", "formChegadaManualFaccao", "formEntregaPagamento"].includes(form.id)) {
        if (form.id === "formChegadaMovimentacao") {
          const movementId = document.getElementById("chegadaMovimentacaoId")?.value || "";
          if (movementId) {
            setTimeout(async () => {
              try {
                const c = await aguardarContexto();
                const snap = await c.fs.getDoc(c.fs.doc(c.db, "movimentacoesProducao", movementId));
                if (snap.exists()) programarRecalculoOP(snap.data().opId);
              } catch (error) {}
            }, 700);
          }
        } else {
          const opNumber = document.getElementById(form.id === "formEntregaPagamento" ? "entregaOP" : "chegadaManualOP")?.value || "";
          if (opNumber) [900, 2200, 4800].forEach(delay => setTimeout(async () => { const op = await buscarOP(opNumber); if (op) recalcularMontagemPorOP(op.id); }, delay));
        }
      }
    }, true);
  }

  async function iniciar() {
    injetarUI();
    ligarEventos();
    try {
      const c = await aguardarContexto();
      c.onAuth(c.auth, async current => {
        user = current;
        perfil = null;
        processos = [];
        faccoes = [];
        movimentos = [];
        precos = [];
        pagamentosCorte = [];
        if (current) {
          await carregarPerfil().catch(() => {});
          if (!document.getElementById("painelFaccoesCorte")?.classList.contains("hidden")) carregarTudoCorte();
        }
      });
    } catch (error) {
      return setTimeout(iniciar, 1200);
    }
  }

  const apiLateralAlca = {
    versao: VERSION,
    atualizar: carregarTudoCorte,
    mostrar: mostrarAreaLateralAlca,
    ocultar: ocultarAreaLateralAlca,
    recalcularMontagemPorOP
  };
  window.CorpoNuFaccoesLateralAlca = apiLateralAlca;
  window.CorpoNuFaccoesCorte = apiLateralAlca; // alias legado temporário

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();
