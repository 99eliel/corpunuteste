(() => {
  "use strict";

  const VERSION = "2026-07-28-calcinha-sem-silk-envio-historico-2";
  const FIREBASE_VERSION = "10.12.5";
  const HISTORY_URL = `calcinhas-historico-2026.json?v=${encodeURIComponent(VERSION)}`;
  const TYPES = Object.freeze({ sutia: "Sutiã", calcinha: "Calcinha" });
  const CALCINHA_PROCESSES = Object.freeze(["CALCINHA MONTAGEM", "CALCINHA COMPLETA"]);
  const FALLBACK_FACTIONS = Object.freeze({
    "CALCINHA MONTAGEM": ["ANA FLAVIA", "KAUANE", "LIANA", "DAIANA", "LEIDIANE", "ANDREZA"],
    "CALCINHA COMPLETA": ["LORENA", "JEAN", "SCHENEIDER", "DANIELA", "KAMILA", "LIANDRA", "JUZENI", "THEILLOR", "SILVANY", "LEONARDO", "MATHEUS", "BEATRIZ", "MARILIA", "DARLLEN", "RONEIDIA"]
  });
  const state = {
    ready: false,
    firebase: null,
    db: null,
    auth: null,
    profile: null,
    active: {
      produtos: "sutia",
      ordens: "sutia",
      faccoes: "sutia",
      rastreamento: "sutia"
    },
    maps: {
      produtos: new Map(),
      ordens: new Map(),
      movimentacoes: new Map(),
      faccoes: new Map()
    },
    original: {},
    refreshPromise: null,
    refreshTimer: 0,
    applying: false,
    observers: [],
    historicalImporting: false
  };

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function safeId(value) {
    return normalize(value)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || `registro-${Date.now()}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDateBR(iso) {
    const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }

  function parseBrazilianNumber(value) {
    const text = String(value ?? "")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "");
    const number = Number(text || 0);
    return Number.isFinite(number) ? number : 0;
  }

  function toast(message, kind = "info") {
    let element = document.getElementById("corponuDualToast");
    if (!element) {
      element = document.createElement("div");
      element.id = "corponuDualToast";
      document.body.appendChild(element);
    }
    element.dataset.kind = kind;
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(element._timer);
    element._timer = setTimeout(() => element.classList.remove("show"), 5500);
  }

  function typeOfData(data) {
    const type = normalize(data?.tipoPeca || data?.tipoPecaPadrao || data?.setor || data?.setorLabel);
    if (type.includes("CALCINHA")) return "calcinha";
    const process = normalize(data?.processo || data?.processoPlanejado);
    if (process.startsWith("CALCINHA")) return "calcinha";
    return "sutia";
  }

  function lineLabel(value) {
    const normalized = normalize(value).replace(/\s+/g, "_");
    if (normalized === "COTTON_LINE" || normalized === "COTTON__LINE") return "Cotton Line";
    if (normalized === "CORPO_NU") return "Corpo Nu";
    return "";
  }

  function lineValue(value) {
    const label = lineLabel(value);
    if (label === "Cotton Line") return "cotton_line";
    if (label === "Corpo Nu") return "corpo_nu";
    return "";
  }

  function getCurrentPage() {
    return document.querySelector(".page.active")?.id || "manejo";
  }

  function dedicatedCalcinhaActive() {
    return document.body?.dataset?.corponuCalcinhaDedicado === "1"
      && document.querySelector("#manejo .manejo-setor-btn.active")?.dataset?.setor === "calcinha";
  }

  function isAdmin() {
    return state.profile?.tipo === "admin" || normalize(document.getElementById("userRole")?.textContent) === "ADMIN";
  }

  function currentUser() {
    return state.auth?.currentUser || null;
  }

  function todayISO() {
    const date = new Date();
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function rowIdByFunction(row, functions) {
    if (!row) return "";
    const html = row.innerHTML || "";
    for (const functionName of functions) {
      const regex = new RegExp(`${functionName}\\(['\"]([^'\"]+)['\"]`, "i");
      const match = html.match(regex);
      if (match?.[1]) return match[1];
    }
    return row.dataset?.documentId || row.dataset?.id || row.dataset?.movimentacaoId || "";
  }

  async function initializeFirebase() {
    if (state.firebase) return state.firebase;
    const [appModule, authModule, firestoreModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
    ]);
    const app = appModule.getApps()[0] || appModule.getApp();
    state.db = firestoreModule.getFirestore(app);
    state.auth = authModule.getAuth(app);
    state.firebase = { ...firestoreModule, ...authModule, ...appModule };
    return state.firebase;
  }

  async function loadProfile() {
    const user = currentUser();
    if (!user || !state.db) return null;
    try {
      const { doc, getDocFromCache, getDoc } = state.firebase;
      const reference = doc(state.db, "usuarios", user.uid);
      let snapshot;
      try {
        snapshot = await getDocFromCache(reference);
      } catch {
        snapshot = await getDoc(reference);
      }
      state.profile = snapshot.exists() ? { uid: user.uid, ...snapshot.data() } : null;
    } catch (error) {
      console.warn("[CorpoNu Dual] Perfil não carregado.", error);
    }
    return state.profile;
  }

  async function readCollectionFromCache(name, allowServerFallback = true) {
    const { collection, getDocsFromCache, getDocs } = state.firebase;
    const reference = collection(state.db, name);
    try {
      const snapshot = await getDocsFromCache(reference);
      if (snapshot.size || !allowServerFallback) return snapshot;
    } catch (error) {
      console.debug(`[CorpoNu Dual] Cache ${name} indisponível.`, error);
    }
    if (!allowServerFallback) return null;
    return getDocs(reference);
  }

  async function refreshData(options = {}) {
    if (state.refreshPromise && !options.force) return state.refreshPromise;
    state.refreshPromise = (async () => {
      await initializeFirebase();
      const collections = options.collections || ["produtos", "ordensProducao", "movimentacoesProducao", "faccoes"];
      await Promise.all(collections.map(async name => {
        try {
          const snapshot = await readCollectionFromCache(name, options.serverFallback !== false);
          if (!snapshot) return;
          const mapName = name === "ordensProducao" ? "ordens" : name === "movimentacoesProducao" ? "movimentacoes" : name;
          state.maps[mapName] = new Map(snapshot.docs.map(item => [item.id, { id: item.id, ...item.data() }]));
        } catch (error) {
          console.warn(`[CorpoNu Dual] Não foi possível atualizar ${name}.`, error);
        }
      }));
      await loadProfile();
      return state.maps;
    })().finally(() => {
      state.refreshPromise = null;
    });
    return state.refreshPromise;
  }

  function scheduleRefreshAndApply(delay = 90, serverFallback = false) {
    clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(async () => {
      await refreshData({ serverFallback }).catch(() => {});
      applyAll();
    }, delay);
  }

  async function registerLog(action, targetType, targetId, details) {
    const user = currentUser();
    if (!user) return;
    try {
      const { addDoc, collection, serverTimestamp } = state.firebase;
      await addDoc(collection(state.db, "logsAlteracoes"), {
        acao: action,
        tipoAlvo: targetType,
        alvoId: String(targetId || ""),
        detalhes: String(details || ""),
        usuarioUid: user.uid,
        usuarioNome: state.profile?.nome || "",
        usuarioEmail: state.profile?.email || user.email || "",
        usuarioTipo: state.profile?.tipo || "",
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.warn("[CorpoNu Dual] Log não salvo.", error);
    }
  }

  function injectStyles() {
    if (document.getElementById("corponuDualStyles")) return;
    const style = document.createElement("style");
    style.id = "corponuDualStyles";
    style.textContent = `
      .corponu-dual-tabs{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 14px;padding:7px;background:#eef4fb;border:1px solid #cbd9e8;border-radius:14px}
      .corponu-dual-tab{appearance:none;border:1px solid #b9c9da;background:#fff;color:#20344b;border-radius:10px;padding:9px 16px;font-weight:900;cursor:pointer;transition:.16s ease}
      .corponu-dual-tab:hover{transform:translateY(-1px);border-color:#6c8caf}
      .corponu-dual-tab.active{background:#173c69;color:#fff;border-color:#173c69;box-shadow:0 6px 14px rgba(23,60,105,.18)}
      .corponu-dual-tab .count{display:inline-flex;min-width:22px;height:22px;align-items:center;justify-content:center;border-radius:999px;margin-left:7px;padding:0 6px;background:rgba(255,255,255,.18);font-size:11px}
      .corponu-dual-hint{font-size:12px;color:#52677e;margin:-5px 0 14px}
      .corponu-calcinha-field{display:none}
      body[data-corponu-form-type="calcinha"] .corponu-calcinha-field{display:block}
      body[data-corponu-form-type="calcinha"] #formProduto .checks{display:none!important}
      .corponu-dual-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .corponu-dual-field{display:flex;flex-direction:column;gap:6px;font-weight:800;color:#1f3348}
      .corponu-dual-field select,.corponu-dual-field input{min-height:42px;border:1px solid #bfccda;border-radius:10px;padding:8px 10px;background:#fff;color:#14283e}
      .corponu-manejo-line-select{width:100%;min-width:120px;border:1px solid #b7c7d8;border-radius:8px;padding:8px;background:#fff;font-weight:800}
      .corponu-manejo-line-select.pending{border-color:#e4a11b;background:#fff9e8;color:#854d0e}
      .corponu-dual-hidden{display:none!important}
      .corponu-dual-badge{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:900;background:#e7eef7;color:#203e62}
      .corponu-dual-badge.pending{background:#fff3cd;color:#7b4b00}
      .corponu-history-panel{border:1px solid #a9c5e0;background:linear-gradient(145deg,#f8fbff,#eef6ff)}
      .corponu-history-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}
      .corponu-history-card{background:#fff;border:1px solid #cfdfef;border-radius:12px;padding:12px}
      .corponu-history-card span{display:block;font-size:11px;color:#5d7186;font-weight:800}.corponu-history-card strong{font-size:20px;color:#173c69}
      #corponuDualToast{position:fixed;right:18px;bottom:18px;z-index:100000;max-width:390px;padding:13px 15px;border-radius:13px;background:#172334;color:#fff;font:800 13px/1.4 Arial,sans-serif;box-shadow:0 16px 40px rgba(0,0,0,.24);opacity:0;transform:translateY(16px);pointer-events:none;transition:.2s ease}
      #corponuDualToast.show{opacity:1;transform:translateY(0)}#corponuDualToast[data-kind="error"]{background:#991b1b}#corponuDualToast[data-kind="success"]{background:#166534}
      .corponu-import-progress{height:10px;background:#dce8f3;border-radius:99px;overflow:hidden;margin-top:10px}.corponu-import-progress>span{display:block;height:100%;width:0;background:#1f6fb2;transition:width .2s}
      .corponu-history-send-overlay{position:fixed;inset:0;z-index:100020;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.55);backdrop-filter:blur(2px)}
      .corponu-history-send-overlay.show{display:flex}
      .corponu-history-send-card{width:min(560px,100%);background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.3);overflow:hidden}
      .corponu-history-send-head{padding:18px 20px;background:#173c69;color:#fff}.corponu-history-send-head h3{margin:0 0 5px}.corponu-history-send-head p{margin:0;opacity:.9;font-size:12px}
      .corponu-history-send-body{display:grid;gap:14px;padding:20px}.corponu-history-send-body label{display:grid;gap:6px;font-weight:900;color:#20344b}.corponu-history-send-body select{min-height:44px;border:1px solid #b8c7d8;border-radius:10px;padding:8px 10px;background:#fff}
      .corponu-history-send-actions{display:flex;justify-content:flex-end;gap:10px;padding:0 20px 20px}
      body[data-corponu-manejo-tipo="calcinha"] #avisoFiltrosExcelManejo{border-color:#a9c5e0;background:#eef6ff}
      @media(max-width:720px){.corponu-dual-grid,.corponu-history-summary{grid-template-columns:1fr}.corponu-dual-tabs{position:sticky;top:0;z-index:15}.corponu-dual-tab{flex:1}.corponu-history-send-actions{flex-direction:column-reverse}.corponu-history-send-actions .btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function makeTabs(pageId) {
    const page = document.getElementById(pageId);
    if (!page || page.querySelector(`.corponu-dual-tabs[data-page="${pageId}"]`)) return;
    const anchor = page.querySelector(":scope > .panel, :scope > .grid-2") || page.firstElementChild;
    const tabs = document.createElement("div");
    tabs.className = "corponu-dual-tabs";
    tabs.dataset.page = pageId;
    tabs.innerHTML = `
      <button type="button" class="corponu-dual-tab active" data-type="sutia">Sutiã <span class="count" data-count-type="sutia">0</span></button>
      <button type="button" class="corponu-dual-tab" data-type="calcinha">Calcinha <span class="count" data-count-type="calcinha">0</span></button>
    `;
    tabs.addEventListener("click", event => {
      const button = event.target.closest(".corponu-dual-tab");
      if (!button) return;
      setActiveType(pageId, button.dataset.type);
    });
    if (anchor) page.insertBefore(tabs, anchor);
    else page.prepend(tabs);
  }

  function setActiveType(pageId, type, options = {}) {
    if (!TYPES[type]) return;
    state.active[pageId] = type;
    const tabs = document.querySelector(`.corponu-dual-tabs[data-page="${pageId}"]`);
    tabs?.querySelectorAll(".corponu-dual-tab").forEach(button => button.classList.toggle("active", button.dataset.type === type));
    if (pageId === "produtos" || pageId === "ordens") {
      document.body.dataset.corponuFormType = type;
      if (!options.keepForm) resetFormForType(pageId, type);
      updateFormTypeUI(pageId, type);
    }
    applyPage(pageId);
  }

  function resetFormForType(pageId, type) {
    if (pageId === "produtos") {
      const form = document.getElementById("formProduto");
      form?.reset();
      const id = document.getElementById("produtoId");
      if (id) id.value = "";
    }
    if (pageId === "ordens") {
      const form = document.getElementById("formOrdem");
      form?.reset();
      const id = document.getElementById("ordemId");
      if (id) id.value = "";
      const number = document.getElementById("ordemNumero");
      if (number) number.readOnly = false;
      if (type === "calcinha") {
        const needText = document.getElementById("ordemNecessidadeTexto");
        if (needText) needText.value = "";
      }
    }
  }

  function updateFormTypeUI(pageId, type) {
    if (pageId === "produtos") {
      const title = document.querySelector("#formProduto .panel-header h3");
      const description = document.querySelector("#formProduto .panel-header p");
      if (title) title.textContent = type === "calcinha" ? "Cadastrar produto de calcinha" : "Cadastrar produto de sutiã";
      if (description) description.textContent = type === "calcinha"
        ? "A referência fica separada das referências de sutiã, mesmo quando o número for igual."
        : "Somente admin cadastra/edita referências de sutiã.";
    }
    if (pageId === "ordens") {
      const title = document.querySelector("#formOrdem .panel-header h3");
      const description = document.querySelector("#formOrdem .panel-header p");
      if (title) title.textContent = type === "calcinha" ? "Adicionar OP de calcinha" : "Adicionar OP de sutiã";
      if (description) description.textContent = type === "calcinha"
        ? "Informe necessidade, serviço e facção no planejamento. Cotton Line/Corpo Nu será preenchido no Manejo."
        : "Cadastre a OP de sutiã mantendo o fluxo atual.";
      updateOrderProductDatalist();
      setTimeout(updateOrderProductPreview, 0);
    }
  }

  function injectOrderCalcinhaFields() {
    const form = document.getElementById("formOrdem");
    if (!form || document.getElementById("ordemCalcinhaPlanejamento")) return;
    const observationLabel = document.getElementById("ordemObs")?.closest("label");
    const wrapper = document.createElement("div");
    wrapper.id = "ordemCalcinhaPlanejamento";
    wrapper.className = "corponu-calcinha-field";
    wrapper.innerHTML = `
      <div class="notice small"><strong>Planejamento da calcinha:</strong> a linha Cotton Line/Corpo Nu ficará em branco e será informada depois no Manejo.</div>
      <div class="corponu-dual-grid">
        <label class="corponu-dual-field">Início da necessidade<input id="ordemCalcinhaNecessidadeInicio" type="date"></label>
        <label class="corponu-dual-field">Final da necessidade<input id="ordemCalcinhaNecessidadeFim" type="date"></label>
        <label class="corponu-dual-field">Serviço<select id="ordemCalcinhaProcesso"><option value="">Selecione</option>${CALCINHA_PROCESSES.map(item => `<option value="${item}">${item}</option>`).join("")}</select></label>
        <label class="corponu-dual-field">Facção<select id="ordemCalcinhaFaccao" disabled><option value="">Primeiro selecione o serviço</option></select></label>
      </div>
    `;
    if (observationLabel) form.insertBefore(wrapper, observationLabel);
    else form.querySelector(".actions")?.before(wrapper);
    document.getElementById("ordemCalcinhaProcesso")?.addEventListener("change", () => fillFactionSelect("ordemCalcinhaProcesso", "ordemCalcinhaFaccao"));
  }

  function injectPdfCalcinhaFields() {
    const grid = document.querySelector("#backup .pdf-pro-grid");
    if (!grid || document.getElementById("pdfCalcinhaProcesso")) return;
    const processLabel = document.createElement("label");
    processLabel.className = "pro-field corponu-pdf-calcinha-field";
    processLabel.innerHTML = `<span>Serviço da calcinha</span><select id="pdfCalcinhaProcesso"><option value="">Selecione</option>${CALCINHA_PROCESSES.map(item => `<option value="${item}">${item}</option>`).join("")}</select>`;
    const factionLabel = document.createElement("label");
    factionLabel.className = "pro-field corponu-pdf-calcinha-field";
    factionLabel.innerHTML = `<span>Facção de destino</span><select id="pdfCalcinhaFaccao" disabled><option value="">Primeiro selecione o serviço</option></select>`;
    grid.append(processLabel, factionLabel);
    document.getElementById("pdfCalcinhaProcesso")?.addEventListener("change", () => fillFactionSelect("pdfCalcinhaProcesso", "pdfCalcinhaFaccao"));
    document.getElementById("pdfTipoPeca")?.addEventListener("change", updatePdfFieldsVisibility);
    updatePdfFieldsVisibility();
  }

  function updatePdfFieldsVisibility() {
    const isCalcinha = document.getElementById("pdfTipoPeca")?.value === "calcinha";
    document.querySelectorAll(".corponu-pdf-calcinha-field").forEach(element => element.classList.toggle("corponu-dual-hidden", !isCalcinha));
  }

  function factionProcesses(faction) {
    const candidates = [faction?.processos, faction?.servicos, faction?.tiposProcesso, faction?.processo, faction?.tipoProcesso];
    return candidates.flatMap(item => Array.isArray(item) ? item : item ? [item] : []).map(normalize).filter(Boolean);
  }

  function factionsForProcess(process) {
    const normalizedProcess = normalize(process);
    const all = [...state.maps.faccoes.values()].filter(item => item?.ativo !== false);
    let filtered = all.filter(item => factionProcesses(item).some(candidate => candidate === normalizedProcess));
    if (!filtered.length) {
      const allowedNames = new Set((FALLBACK_FACTIONS[normalizedProcess] || []).map(normalize));
      filtered = all.filter(item => allowedNames.has(normalize(item.nome || item.razaoSocial || item.id)));
    }
    return filtered.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { sensitivity: "base" }));
  }

  function fillFactionSelect(processId, factionId, selected = "") {
    const process = document.getElementById(processId)?.value || "";
    const select = document.getElementById(factionId);
    if (!select) return;
    if (!process) {
      select.disabled = true;
      select.innerHTML = `<option value="">Primeiro selecione o serviço</option>`;
      return;
    }
    const factions = factionsForProcess(process);
    const fallback = FALLBACK_FACTIONS[normalize(process)] || [];
    const names = factions.length ? factions.map(item => item.nome || item.razaoSocial || item.id) : fallback;
    select.disabled = false;
    select.innerHTML = `<option value="">Selecione a facção</option>${[...new Set(names.map(item => String(item || "").trim()).filter(Boolean))].map(name => `<option value="${escapeHtml(normalize(name))}">${escapeHtml(normalize(name))}</option>`).join("")}`;
    if (selected) select.value = normalize(selected);
  }

  function isHistoricalPanty(order) {
    const origins = [
      order?.origem,
      order?.origemImportacao,
      order?.manejamentosSetores?.calcinha?.origem,
      order?.manejosSetores?.calcinha?.origem
    ].map(normalize);
    return origins.some(item => item.includes("PLANILHA_CALCINHAS_HISTORICO"));
  }

  let historicalSendResolver = null;

  function closeHistoricalSendModal(result = null) {
    const modal = document.getElementById("corponuHistoricoEnvioModal");
    modal?.classList.remove("show");
    document.body.style.overflow = "";
    const resolver = historicalSendResolver;
    historicalSendResolver = null;
    if (resolver) resolver(result);
  }

  function ensureHistoricalSendModal() {
    let modal = document.getElementById("corponuHistoricoEnvioModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "corponuHistoricoEnvioModal";
    modal.className = "corponu-history-send-overlay";
    modal.innerHTML = `
      <div class="corponu-history-send-card" role="dialog" aria-modal="true" aria-labelledby="corponuHistoricoEnvioTitulo">
        <div class="corponu-history-send-head">
          <h3 id="corponuHistoricoEnvioTitulo">Enviar calcinha histórica para facção</h3>
          <p id="corponuHistoricoEnvioResumo">Escolha o serviço e a facção para esta movimentação.</p>
        </div>
        <form id="corponuHistoricoEnvioForm">
          <div class="corponu-history-send-body">
            <div class="notice small"><strong>Registro importado:</strong> como esta OP veio da planilha antiga, o planejamento de serviço e facção será definido agora.</div>
            <label>Serviço
              <select id="corponuHistoricoEnvioProcesso" required>
                <option value="">Selecione o serviço</option>
                ${CALCINHA_PROCESSES.map(item => `<option value="${item}">${item}</option>`).join("")}
              </select>
            </label>
            <label>Facção
              <select id="corponuHistoricoEnvioFaccao" required disabled>
                <option value="">Primeiro selecione o serviço</option>
              </select>
            </label>
          </div>
          <div class="corponu-history-send-actions">
            <button type="button" class="btn" id="btnCancelarHistoricoEnvio">Cancelar</button>
            <button type="submit" class="btn btn-primary">Continuar envio</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(modal);
    const processSelect = document.getElementById("corponuHistoricoEnvioProcesso");
    processSelect?.addEventListener("change", () => fillFactionSelect("corponuHistoricoEnvioProcesso", "corponuHistoricoEnvioFaccao"));
    document.getElementById("btnCancelarHistoricoEnvio")?.addEventListener("click", () => closeHistoricalSendModal(null));
    modal.addEventListener("pointerdown", event => {
      if (event.target === modal) closeHistoricalSendModal(null);
    });
    document.getElementById("corponuHistoricoEnvioForm")?.addEventListener("submit", event => {
      event.preventDefault();
      const process = normalize(document.getElementById("corponuHistoricoEnvioProcesso")?.value);
      const faction = normalize(document.getElementById("corponuHistoricoEnvioFaccao")?.value);
      if (!CALCINHA_PROCESSES.includes(process)) {
        toast("Selecione o serviço da calcinha.", "error");
        return;
      }
      if (!faction) {
        toast("Selecione a facção de destino.", "error");
        return;
      }
      closeHistoricalSendModal({ process, faction });
    });
    return modal;
  }

  function chooseHistoricalPantyDestination(order) {
    if (historicalSendResolver) {
      toast("Finalize a escolha de serviço/facção que já está aberta.", "error");
      return Promise.resolve(null);
    }
    const modal = ensureHistoricalSendModal();
    const processSelect = document.getElementById("corponuHistoricoEnvioProcesso");
    const factionSelect = document.getElementById("corponuHistoricoEnvioFaccao");
    const summary = document.getElementById("corponuHistoricoEnvioResumo");
    if (summary) summary.textContent = `OP ${order?.numeroOP || "-"} • Ref. ${order?.referencia || "-"} • ${order?.cor || "-"}`;
    if (processSelect) processSelect.value = "";
    if (factionSelect) {
      factionSelect.value = "";
      factionSelect.disabled = true;
      factionSelect.innerHTML = '<option value="">Primeiro selecione o serviço</option>';
    }
    modal.classList.add("show");
    document.body.style.overflow = "hidden";
    setTimeout(() => processSelect?.focus(), 50);
    return new Promise(resolve => { historicalSendResolver = resolve; });
  }

  function applyManejoTypeLayout() {
    const table = document.querySelector("#manejo .manejo-inline-table");
    if (!table) return;
    const isCalcinha = document.querySelector(".manejo-setor-btn.active")?.dataset?.setor === "calcinha";
    document.body.dataset.corponuManejoTipo = isCalcinha ? "calcinha" : "sutia";
    const headRow = table.querySelector("thead .manejo-head-row");
    const filterRow = table.querySelector("thead .manejo-filter-row");
    const headers = [...(headRow?.children || [])];
    const hiddenIndexes = headers
      .map((cell, index) => ({ index, label: normalize(cell.textContent) }))
      .filter(item => item.label === "SILK" || item.label === "TECIDO")
      .map(item => item.index);
    hiddenIndexes.forEach(index => {
      if (headRow?.children[index]) headRow.children[index].style.display = isCalcinha ? "none" : "";
      if (filterRow?.children[index]) filterRow.children[index].style.display = isCalcinha ? "none" : "";
      document.querySelectorAll("#listaManejoInline tr[data-manejo-row='1']").forEach(row => {
        if (row.children[index]) row.children[index].style.display = isCalcinha ? "none" : "";
      });
    });
    if (isCalcinha) {
      const silkFilter = document.getElementById("filtroManejoSilk");
      const tecidoFilter = document.getElementById("filtroManejoDataTecido");
      if (silkFilter) silkFilter.value = "";
      if (tecidoFilter) tecidoFilter.value = "";
    }
    const info = document.getElementById("manejoSetorInfo");
    if (info) info.textContent = isCalcinha
      ? "Mostrando OPs de calcinha. Informe Linha, Fase e Necessidade; Silk e Tecido não são utilizados para calcinha."
      : "Mostrando OPs de sutiã importadas do PDF. A separação vem automaticamente da importação.";
    const notice = document.querySelector("#manejo .notice.small");
    if (notice) notice.innerHTML = isCalcinha
      ? "<strong>Funcionamento da calcinha:</strong> OP, referência, quantidade, cor e necessidade vêm da importação. No Manejo ficam Linha, Fase, localização e encaminhamento. Registros históricos perguntam serviço e facção no momento do envio; novas OPs usam o planejamento já definido."
      : "<strong>Funcionamento:</strong> Nº OP, REF, QTI, COR, NECESSIDADE e o tipo da peça vêm da importação. Aqui ficam Silk, Tecido, Fase e encaminhamentos. Use os botões para mandar a OP para Facção ou Célula.";
  }

  function updateOrderProductDatalist() {
    const datalist = document.getElementById("referenciasList");
    if (!datalist) return;
    const type = state.active.ordens || "sutia";
    const products = [...state.maps.produtos.values()].filter(item => typeOfData(item) === type && item.ativo !== false);
    const unique = new Map();
    products.forEach(item => unique.set(normalize(item.referencia), item));
    datalist.innerHTML = [...unique.values()]
      .sort((a, b) => String(a.referencia).localeCompare(String(b.referencia), "pt-BR", { numeric: true }))
      .map(item => `<option value="${escapeHtml(item.referencia)}">${escapeHtml(item.nome || "")}</option>`)
      .join("");
  }

  function updateOrderProductPreview() {
    const preview = document.getElementById("produtoPreview");
    const input = document.getElementById("ordemReferencia");
    if (!preview || !input) return;
    const reference = normalize(input.value);
    if (!reference) return;
    const type = state.active.ordens || "sutia";
    const product = [...state.maps.produtos.values()].find(item => typeOfData(item) === type && normalize(item.referencia) === reference);
    if (!product) {
      preview.classList.remove("hidden");
      preview.classList.add("warning");
      preview.innerHTML = `<strong>Referência não cadastrada em ${TYPES[type]}:</strong> ${escapeHtml(reference)}<br>Cadastre a referência na categoria correta antes de salvar.`;
      return;
    }
    preview.classList.remove("hidden", "warning");
    preview.innerHTML = type === "calcinha"
      ? `<strong>Produto de calcinha encontrado:</strong><br>Referência: ${escapeHtml(product.referencia)}<br>Produto: ${escapeHtml(product.nome || "-")}`
      : `<strong>Produto de sutiã encontrado:</strong><br>Referência: ${escapeHtml(product.referencia)}<br>Produto: ${escapeHtml(product.nome || "-")}<br>Alça: ${product.possuiAlca ? "Sim" : "Não"} | Bojo: ${product.possuiBojo ? "Sim" : "Não"} | Renda: ${product.possuiRenda ? "Sim" : "Não"}`;
  }

  function restorePendingOrderAfterProduct(reference, type) {
    try {
      const raw = sessionStorage.getItem("op_confeccao_ordem_pendente");
      if (!raw) return;
      const pending = JSON.parse(raw);
      if (normalize(pending.referencia) !== normalize(reference)) return;
      sessionStorage.removeItem("op_confeccao_ordem_pendente");
      setActiveType("ordens", type, { keepForm: true });
      document.querySelector('.nav-btn[data-page="ordens"]')?.click();
      setTimeout(() => {
        const values = {
          ordemNumero: pending.numeroOP || "",
          ordemReferencia: reference || "",
          ordemCor: pending.cor || "",
          ordemQuantidade: pending.quantidade || "",
          ordemNecessidadeTexto: pending.necessidade || "",
          ordemObs: pending.observacoes || ""
        };
        Object.entries(values).forEach(([id, value]) => { const element = document.getElementById(id); if (element) element.value = value; });
        updateOrderProductPreview();
      }, 80);
    } catch (error) {
      console.warn("[CorpoNu Dual] Não foi possível restaurar a OP pendente.", error);
    }
  }

  async function handleProductSubmit(event) {
    const form = event.target;
    if (form?.id !== "formProduto") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!isAdmin()) {
      toast("Apenas administradores podem salvar produtos.", "error");
      return;
    }
    const type = state.active.produtos || "sutia";
    const currentId = document.getElementById("produtoId")?.value || "";
    const reference = normalize(document.getElementById("produtoReferencia")?.value);
    const name = String(document.getElementById("produtoNome")?.value || "").trim();
    if (!reference || !name) {
      toast("Preencha referência e nome do produto.", "error");
      return;
    }
    const duplicate = [...state.maps.produtos.values()].find(item => item.id !== currentId && typeOfData(item) === type && normalize(item.referencia) === reference);
    if (duplicate) {
      toast(`A referência ${reference} já existe em ${TYPES[type]}.`, "error");
      return;
    }
    const user = currentUser();
    const { doc, setDoc, serverTimestamp, writeBatch } = state.firebase;
    const documentId = currentId || (type === "calcinha" ? `calcinha-${safeId(reference)}` : safeId(reference));
    const data = {
      referencia: reference,
      nome: name,
      tipoPeca: type,
      tipoPecaPadrao: type,
      tipoPecaLabel: TYPES[type],
      possuiAlca: type === "sutia" ? Boolean(document.getElementById("produtoAlca")?.checked) : false,
      possuiBojo: type === "sutia" ? Boolean(document.getElementById("produtoBojo")?.checked) : false,
      possuiRenda: type === "sutia" ? Boolean(document.getElementById("produtoRenda")?.checked) : false,
      observacoes: String(document.getElementById("produtoObs")?.value || "").trim(),
      cadastroPendente: false,
      statusCadastro: "conferido",
      ativo: true,
      atualizadoPor: user?.uid || "",
      atualizadoEm: serverTimestamp()
    };
    if (!currentId) {
      data.criadoPor = user?.uid || "";
      data.criadoEm = serverTimestamp();
    }
    try {
      await setDoc(doc(state.db, "produtos", documentId), data, { merge: true });
      const matchingOrders = [...state.maps.ordens.values()].filter(order => typeOfData(order) === type && normalize(order.referencia) === reference);
      for (let start = 0; start < matchingOrders.length; start += 350) {
        const batch = writeBatch(state.db);
        matchingOrders.slice(start, start + 350).forEach(order => batch.set(doc(state.db, "ordensProducao", order.id), {
          produtoNome: name,
          possuiAlca: data.possuiAlca,
          possuiBojo: data.possuiBojo,
          possuiRenda: data.possuiRenda,
          tipoPeca: type,
          tipoPecaLabel: TYPES[type],
          atualizadoPor: user?.uid || "",
          atualizadoEm: serverTimestamp()
        }, { merge: true }));
        await batch.commit();
      }
      state.maps.produtos.set(documentId, { id: documentId, ...data });
      await registerLog(currentId ? "produto_atualizado" : "produto_criado", "produto", documentId, `${TYPES[type]} | Referência ${reference} - ${name}`);
      form.reset();
      document.getElementById("produtoId").value = "";
      restorePendingOrderAfterProduct(reference, type);
      toast(`Produto de ${TYPES[type]} salvo.`, "success");
      scheduleRefreshAndApply(300, false);
    } catch (error) {
      console.error(error);
      toast("Erro ao salvar produto.", "error");
    }
  }

  function parseNeedFromDates(start, end) {
    if (!start || !end) return "";
    return `${formatDateBR(start)} a ${formatDateBR(end)}`;
  }

  async function handleOrderSubmit(event) {
    const form = event.target;
    if (form?.id !== "formOrdem" || state.active.ordens !== "calcinha") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const currentId = document.getElementById("ordemId")?.value || "";
    const opNumber = normalize(document.getElementById("ordemNumero")?.value);
    const reference = normalize(document.getElementById("ordemReferencia")?.value);
    const color = normalize(document.getElementById("ordemCor")?.value);
    const quantity = Number(document.getElementById("ordemQuantidade")?.value || 0);
    const needStart = document.getElementById("ordemCalcinhaNecessidadeInicio")?.value || "";
    const needEnd = document.getElementById("ordemCalcinhaNecessidadeFim")?.value || "";
    const process = normalize(document.getElementById("ordemCalcinhaProcesso")?.value);
    const faction = normalize(document.getElementById("ordemCalcinhaFaccao")?.value);
    const observation = String(document.getElementById("ordemObs")?.value || "").trim();
    if (!opNumber || !reference || !color || quantity <= 0) {
      toast("Informe OP, referência, cor e quantidade válida.", "error");
      return;
    }
    if (!needStart || !needEnd || needStart > needEnd) {
      toast("Informe um intervalo de necessidade válido.", "error");
      return;
    }
    if (!CALCINHA_PROCESSES.includes(process) || !faction) {
      toast("Selecione o serviço e a facção planejada.", "error");
      return;
    }
    const product = [...state.maps.produtos.values()].find(item => typeOfData(item) === "calcinha" && normalize(item.referencia) === reference);
    if (!product) {
      toast(`Cadastre a referência ${reference} na aba Produtos → Calcinha antes de salvar a OP.`, "error");
      return;
    }
    const duplicate = [...state.maps.ordens.values()].find(item => item.id !== currentId && normalize(item.numeroOP || item.numeroOPExterno) === opNumber);
    if (duplicate) {
      toast(`A OP ${opNumber} já existe no sistema.`, "error");
      return;
    }
    const user = currentUser();
    const needText = parseNeedFromDates(needStart, needEnd);
    const year = Number(needStart.slice(0, 4)) || new Date().getFullYear();
    const documentId = currentId || `calcinha-${safeId(opNumber)}`;
    const { doc, setDoc, serverTimestamp } = state.firebase;
    const old = state.maps.ordens.get(currentId) || {};
    const data = {
      numeroOP: old.numeroOP || opNumber,
      referencia: reference,
      cor: color,
      produtoNome: product.nome || `Calcinha Ref. ${reference}`,
      quantidade: quantity,
      semana: "",
      mes: "",
      ano: year,
      necessidadeInicio: needStart,
      necessidadeFim: needEnd,
      necessidade: needText,
      necessidadeTexto: needText,
      necessidadeManual: true,
      observacoes: observation,
      tipoPeca: "calcinha",
      tipoPecaPadrao: "calcinha",
      tipoPecaLabel: "Calcinha",
      linhaCalcinha: old.linhaCalcinha || "",
      processoPlanejado: process,
      faccaoPlanejada: faction,
      planejamentoCalcinhaPendente: false,
      possuiAlca: false,
      possuiBojo: false,
      possuiRenda: false,
      status: old.status || "aberta",
      atualizadoPor: user?.uid || "",
      atualizadoEm: serverTimestamp()
    };
    if (!currentId) {
      data.criadoPor = user?.uid || "";
      data.criadoEm = serverTimestamp();
    }
    try {
      await setDoc(doc(state.db, "ordensProducao", documentId), data, { merge: true });
      state.maps.ordens.set(documentId, { id: documentId, ...old, ...data });
      await registerLog(currentId ? "ordem_atualizada" : "ordem_criada", "ordemProducao", documentId, `Calcinha | OP ${opNumber} | Ref. ${reference} | ${process} | ${faction}`);
      form.reset();
      document.getElementById("ordemId").value = "";
      document.getElementById("ordemNumero").readOnly = false;
      toast("OP de calcinha salva. A linha Cotton Line/Corpo Nu será informada no Manejo.", "success");
      scheduleRefreshAndApply(350, false);
    } catch (error) {
      console.error(error);
      toast("Erro ao salvar a OP de calcinha.", "error");
    }
  }

  function wrapEditFunctions() {
    if (!state.original.editarProduto && typeof window.editarProduto === "function") {
      state.original.editarProduto = window.editarProduto;
      window.editarProduto = function corponuEditarProduto(id) {
        const product = state.maps.produtos.get(String(id));
        const type = typeOfData(product);
        setActiveType("produtos", type, { keepForm: true });
        state.original.editarProduto(id);
      };
    }
    if (!state.original.editarOrdem && typeof window.editarOrdem === "function") {
      state.original.editarOrdem = window.editarOrdem;
      window.editarOrdem = function corponuEditarOrdem(id) {
        const order = state.maps.ordens.get(String(id));
        const type = typeOfData(order);
        setActiveType("ordens", type, { keepForm: true });
        state.original.editarOrdem(id);
        if (type === "calcinha" && order) {
          setTimeout(() => {
            document.getElementById("ordemCalcinhaNecessidadeInicio").value = order.necessidadeInicio || "";
            document.getElementById("ordemCalcinhaNecessidadeFim").value = order.necessidadeFim || "";
            document.getElementById("ordemCalcinhaProcesso").value = normalize(order.processoPlanejado || order.processo);
            fillFactionSelect("ordemCalcinhaProcesso", "ordemCalcinhaFaccao", order.faccaoPlanejada || order.destino || "");
          }, 20);
        }
      };
    }
  }

  function countByType(map) {
    const result = { sutia: 0, calcinha: 0 };
    map.forEach(item => result[typeOfData(item)]++);
    return result;
  }

  function updateTabCounts(pageId, counts) {
    const tabs = document.querySelector(`.corponu-dual-tabs[data-page="${pageId}"]`);
    if (!tabs) return;
    Object.entries(counts).forEach(([type, count]) => {
      const target = tabs.querySelector(`[data-count-type="${type}"]`);
      if (target) target.textContent = formatNumber(count);
    });
  }

  function filterRowsByMap(tbodyId, pageId, mapName, functionNames) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const activeType = state.active[pageId] || "sutia";
    const map = state.maps[mapName];
    let visible = 0;
    tbody.querySelectorAll(":scope > tr").forEach(row => {
      if (row.querySelector(".empty") || row.cells.length <= 1) return;
      const id = rowIdByFunction(row, functionNames);
      const data = map.get(String(id));
      let type = data ? typeOfData(data) : "";
      if (!type && mapName === "ordens") {
        const op = normalize(row.cells[0]?.textContent || row.cells[0]?.querySelector("input")?.value);
        const ref = normalize(row.cells[2]?.textContent || row.cells[2]?.querySelector("input")?.value);
        const candidate = [...map.values()].find(item => normalize(item.numeroOP) === op && (!ref || normalize(item.referencia) === ref));
        type = typeOfData(candidate);
      }
      if (!type) type = "sutia";
      const show = type === activeType;
      row.classList.toggle("corponu-dual-hidden", !show);
      if (show) visible++;
    });
    return visible;
  }

  function applyProducts() {
    updateTabCounts("produtos", countByType(state.maps.produtos));
    filterRowsByMap("listaProdutos", "produtos", "produtos", ["editarProduto", "excluirProduto"]);
    const pending = document.getElementById("listaProdutosPendentes");
    if (pending) {
      const activeType = state.active.produtos;
      pending.querySelectorAll(":scope > tr").forEach(row => {
        const ref = normalize(row.cells[0]?.textContent);
        const product = [...state.maps.produtos.values()].find(item => normalize(item.referencia) === ref && (item.cadastroPendente || item.statusCadastro === "pendente"));
        row.classList.toggle("corponu-dual-hidden", product ? typeOfData(product) !== activeType : activeType !== "sutia");
      });
    }
  }

  function applyOrders() {
    updateTabCounts("ordens", countByType(state.maps.ordens));
    filterRowsByMap("listaOrdens", "ordens", "ordens", ["editarOrdem", "excluirOrdem"]);
    updateOrderProductDatalist();
  }

  function getMovementFromRow(row) {
    const id = rowIdByFunction(row, ["registrarChegadaMovimentacao", "biparMovimentacao", "encaminharMovimentacao", "editarMovimentacaoRegistradaUsuario", "excluirMovimentacaoRegistradaUsuario", "abrirModalEditarLocalMovimentacao"]);
    if (id && state.maps.movimentacoes.has(String(id))) return state.maps.movimentacoes.get(String(id));
    const op = normalize(row.cells[0]?.textContent);
    const ref = normalize(row.cells[1]?.textContent);
    const destination = normalize(row.cells[4]?.textContent || row.cells[3]?.textContent);
    return [...state.maps.movimentacoes.values()].find(item => normalize(item.numeroOP) === op && normalize(item.referencia) === ref && (!destination || normalize(item.destino) === destination));
  }

  function movementCounts(type) {
    const list = [...state.maps.movimentacoes.values()].filter(item => item.tipoDestino === "faccao" && typeOfData(item) === type);
    return {
      total: list.length,
      inProgress: list.filter(item => !item.dataChegada && !["finalizado", "retornou", "encaminhado"].includes(item.status)).length,
      sent: list.reduce((sum, item) => sum + Number(item.quantidadeEnviada || 0), 0),
      received: list.reduce((sum, item) => sum + Number(item.quantidadeRecebida || 0), 0)
    };
  }

  function applyFaccoes() {
    const movementCountsByType = {
      sutia: [...state.maps.movimentacoes.values()].filter(item => item.tipoDestino === "faccao" && typeOfData(item) === "sutia").length,
      calcinha: [...state.maps.movimentacoes.values()].filter(item => item.tipoDestino === "faccao" && typeOfData(item) === "calcinha").length
    };
    updateTabCounts("faccoes", movementCountsByType);
    const activeType = state.active.faccoes;
    ["listaFaccoesMovimentacoes", "listaMovimentacoesUsuario"].forEach(id => {
      const tbody = document.getElementById(id);
      tbody?.querySelectorAll(":scope > tr").forEach(row => {
        if (row.querySelector(".empty") || row.cells.length <= 1) return;
        const movement = getMovementFromRow(row);
        const type = movement ? typeOfData(movement) : "sutia";
        row.classList.toggle("corponu-dual-hidden", type !== activeType);
      });
    });
    const counts = movementCounts(activeType);
    const total = document.getElementById("faccoesOpsEmAndamento");
    const sent = document.getElementById("faccoesPecasEnviadas");
    const received = document.getElementById("faccoesPecasRecebidas");
    if (total) total.textContent = formatNumber(counts.inProgress);
    if (sent) sent.textContent = formatNumber(counts.sent);
    if (received) received.textContent = formatNumber(counts.received);
  }

  function applyTracking() {
    const counts = countByType(state.maps.movimentacoes);
    updateTabCounts("rastreamento", counts);
    const activeType = state.active.rastreamento;
    const tbody = document.getElementById("listaRastreamento");
    let visibleMovements = [];
    tbody?.querySelectorAll(":scope > tr").forEach(row => {
      if (row.querySelector(".empty") || row.cells.length <= 1) return;
      const movement = getMovementFromRow(row);
      let type = movement ? typeOfData(movement) : "";
      if (!type) {
        const op = normalize(row.cells[0]?.textContent);
        const ref = normalize(row.cells[1]?.textContent);
        const order = [...state.maps.ordens.values()].find(item => normalize(item.numeroOP) === op && normalize(item.referencia) === ref);
        type = typeOfData(order);
      }
      const show = (type || "sutia") === activeType;
      row.classList.toggle("corponu-dual-hidden", !show);
      if (show && movement) visibleMovements.push(movement);
    });
    if (!visibleMovements.length) visibleMovements = [...state.maps.movimentacoes.values()].filter(item => typeOfData(item) === activeType);
    const total = visibleMovements.length;
    const inProgress = visibleMovements.filter(item => !item.dataChegada && !["finalizado", "retornou", "encaminhado"].includes(item.status)).length;
    const returned = visibleMovements.filter(item => Boolean(item.dataChegada) || item.status === "retornou").length;
    const finished = visibleMovements.filter(item => item.status === "finalizado" || item.bipado === true).length;
    const targets = {
      rastTotalMovimentacoes: total,
      rastEmAndamento: inProgress,
      rastRetornaram: returned,
      rastFinalizadas: finished
    };
    Object.entries(targets).forEach(([id, value]) => { const element = document.getElementById(id); if (element) element.textContent = formatNumber(value); });
  }

  function injectManejoLineColumn() {
    const table = document.querySelector("#manejo .manejo-inline-table");
    if (!table) return;
    const headRow = table.querySelector("thead .manejo-head-row");
    if (headRow && !headRow.querySelector('[data-corponu-line-head="1"]')) {
      const th = document.createElement("th");
      th.dataset.corponuLineHead = "1";
      th.textContent = "LINHA";
      headRow.children[1]?.after(th);
    }
    const filterRow = table.querySelector("thead .manejo-filter-row");
    if (filterRow && !document.getElementById("filtroManejoLinhaCalcinha")) {
      const th = document.createElement("th");
      th.dataset.corponuLineFilter = "1";
      th.innerHTML = `<select id="filtroManejoLinhaCalcinha"><option value="">Todas</option><option value="Cotton Line">Cotton Line</option><option value="Corpo Nu">Corpo Nu</option><option value="A definir">A definir</option></select>`;
      filterRow.children[1]?.after(th);
    }
    const isCalcinha = document.querySelector(".manejo-setor-btn.active")?.dataset?.setor === "calcinha";
    document.querySelectorAll("#listaManejoInline tr[data-manejo-row='1']").forEach(row => {
      if (row.querySelector('[data-corponu-line-cell="1"]')) return;
      const orderId = rowIdByFunction(row, ["salvarManejoLinha", "toggleMenuAcoesManejo"]);
      const order = state.maps.ordens.get(String(orderId));
      const cell = document.createElement("td");
      cell.dataset.corponuLineCell = "1";
      if (isCalcinha || typeOfData(order) === "calcinha") {
        const value = lineValue(order?.linhaCalcinha || order?.manejosSetores?.calcinha?.linhaCalcinha || "");
        cell.innerHTML = `<select class="corponu-manejo-line-select ${value ? "" : "pending"}" data-order-id="${escapeHtml(orderId)}"><option value="">A definir</option><option value="cotton_line" ${value === "cotton_line" ? "selected" : ""}>Cotton Line</option><option value="corpo_nu" ${value === "corpo_nu" ? "selected" : ""}>Corpo Nu</option></select>`;
      } else {
        cell.innerHTML = `<input class="manejo-readonly" value="SUTIÃ" readonly>`;
      }
      row.children[1]?.after(cell);
    });
    applyManejoTypeLayout();
  }

  async function saveCalcinhaLine(orderId, value) {
    if (!orderId) return;
    const user = currentUser();
    const { doc, setDoc, serverTimestamp } = state.firebase;
    const normalized = lineValue(value);
    const current = state.maps.ordens.get(orderId) || {};
    const managementCurrent = current?.manejosSetores?.calcinha || {};
    await setDoc(doc(state.db, "ordensProducao", orderId), {
      tipoPeca: "calcinha",
      tipoPecaLabel: "Calcinha",
      linhaCalcinha: normalized,
      linhaCalcinhaLabel: lineLabel(normalized),
      manejosSetores: {
        ...(current.manejosSetores || {}),
        calcinha: {
          ...managementCurrent,
          linhaCalcinha: normalized,
          linhaCalcinhaLabel: lineLabel(normalized),
          atualizadoPor: user?.uid || "",
          atualizadoEm: serverTimestamp()
        }
      },
      atualizadoPor: user?.uid || "",
      atualizadoEm: serverTimestamp()
    }, { merge: true });
    state.maps.ordens.set(orderId, { ...current, id: orderId, tipoPeca: "calcinha", linhaCalcinha: normalized, linhaCalcinhaLabel: lineLabel(normalized) });
  }

  function wrapManejoSave() {
    if (!state.original.salvarManejoLinha && typeof window.salvarManejoLinha === "function") {
      state.original.salvarManejoLinha = window.salvarManejoLinha;
      window.salvarManejoLinha = async function corponuSalvarManejoLinha(orderId) {
        const result = await state.original.salvarManejoLinha(orderId);
        const order = state.maps.ordens.get(String(orderId));
        if (typeOfData(order) === "calcinha" || document.querySelector(".manejo-setor-btn.active")?.dataset?.setor === "calcinha") {
          const select = document.querySelector(`.corponu-manejo-line-select[data-order-id="${CSS.escape(String(orderId))}"]`);
          await saveCalcinhaLine(String(orderId), select?.value || "");
          select?.classList.toggle("pending", !select.value);
        }
        return result;
      };
    }
  }

  function readManejoRow(orderId) {
    const row = [...document.querySelectorAll("#listaManejoInline tr[data-manejo-row='1']")].find(item => rowIdByFunction(item, ["salvarManejoLinha"]) === String(orderId));
    if (!row) return {};
    const bySuffix = suffix => row.querySelector(`[id$="-${suffix}"]`)?.value || "";
    return {
      silkNome: bySuffix("silkNome"),
      silkData: bySuffix("silkData"),
      tecidoNome: bySuffix("tecidoNome"),
      dataTecido: bySuffix("dataTecido"),
      fase: bySuffix("fase"),
      necessidade: bySuffix("necessidade"),
      linhaCalcinha: row.querySelector(".corponu-manejo-line-select")?.value || ""
    };
  }

  async function sendCalcinhaToFaction(orderId) {
    await refreshData({ collections: ["ordensProducao", "movimentacoesProducao", "faccoes"], serverFallback: false });
    const order = state.maps.ordens.get(String(orderId));
    if (!order || typeOfData(order) !== "calcinha") {
      toast("OP de calcinha não encontrada.", "error");
      return;
    }
    const historical = isHistoricalPanty(order);
    let process = normalize(order.processoPlanejado);
    let faction = normalize(order.faccaoPlanejada);
    const rowData = readManejoRow(orderId);
    const line = lineValue(rowData.linhaCalcinha || order.linhaCalcinha);
    if (!line) {
      toast("Antes de enviar, escolha Cotton Line ou Corpo Nu na coluna Linha e salve.", "error");
      return;
    }
    if (historical) {
      const choice = await chooseHistoricalPantyDestination(order);
      if (!choice) return;
      process = choice.process;
      faction = choice.faction;
    } else if (!CALCINHA_PROCESSES.includes(process) || !faction) {
      toast("Esta nova OP não possui serviço/facção planejados. Edite a OP na aba Ordens → Calcinha.", "error");
      return;
    }
    const duplicate = [...state.maps.movimentacoes.values()].find(item => item.opId === order.id && typeOfData(item) === "calcinha" && item.tipoDestino === "faccao" && !["finalizado", "retornou", "encaminhado"].includes(item.status));
    if (duplicate) {
      toast(`A OP ${order.numeroOP} já possui uma movimentação de calcinha em andamento.`, "error");
      return;
    }
    if (!confirm(`Enviar a OP ${order.numeroOP} (${lineLabel(line)}) para ${faction}, serviço ${process}, com ${formatNumber(order.quantidade)} peças?`)) return;
    const user = currentUser();
    const { addDoc, collection, doc, setDoc, serverTimestamp, writeBatch } = state.firebase;
    const movementData = {
      origem: historical ? "manejo_historico_calcinha" : "manejo",
      movimentacaoOrigemId: "",
      opId: order.id,
      numeroOP: order.numeroOP || "",
      referencia: order.referencia || "",
      cor: order.cor || "",
      produtoNome: order.produtoNome || "",
      tipoDestino: "faccao",
      tipoDestinoLabel: "Facção",
      destino: faction,
      destinoId: factionsForProcess(process).find(item => normalize(item.nome) === faction)?.id || "",
      processo: process,
      setor: "calcinha",
      setorLabel: "Calcinha",
      linhaCalcinha: line,
      linhaCalcinhaLabel: lineLabel(line),
      quantidadeEnviada: Number(order.quantidade || 0),
      dataEnvio: todayISO(),
      dataChegada: "",
      falta: 0,
      quantidadeRecebida: 0,
      status: "em_andamento",
      reenvio: false,
      criadoPor: user?.uid || "",
      criadoEm: serverTimestamp(),
      atualizadoPor: user?.uid || "",
      atualizadoEm: serverTimestamp()
    };
    try {
      const movementRef = await addDoc(collection(state.db, "movimentacoesProducao"), movementData);
      const management = {
        fase: rowData.fase || "",
        necessidade: rowData.necessidade || order.necessidade || "",
        linhaCalcinha: line,
        linhaCalcinhaLabel: lineLabel(line),
        faccao: faction,
        processo: process,
        origemEnvio: historical ? "historico_escolha_no_envio" : "planejamento_op",
        status: "organizada",
        atualizadoPor: user?.uid || "",
        atualizadoEm: serverTimestamp()
      };
      await setDoc(doc(state.db, "ordensProducao", order.id), {
        tipoPeca: "calcinha",
        tipoPecaLabel: "Calcinha",
        linhaCalcinha: line,
        linhaCalcinhaLabel: lineLabel(line),
        manejosSetores: { ...(order.manejosSetores || {}), calcinha: management },
        atualizadoPor: user?.uid || "",
        atualizadoEm: serverTimestamp()
      }, { merge: true });
      state.maps.movimentacoes.set(movementRef.id, { id: movementRef.id, ...movementData });
      await registerLog("movimentacao_criada", "movimentacaoProducao", movementRef.id, `Calcinha ${historical ? "histórica" : "nova"} | OP ${order.numeroOP} | ${lineLabel(line)} | ${process} | ${faction}`);
      toast(`OP ${order.numeroOP} enviada para ${faction}.`, "success");
      scheduleRefreshAndApply(400, false);
    } catch (error) {
      console.error(error);
      toast("Erro ao enviar a OP de calcinha para a facção.", "error");
    }
  }

  function wrapSendToFaction() {
    if (!state.original.mandarParaFaccao && typeof window.mandarParaFaccao === "function") {
      state.original.mandarParaFaccao = window.mandarParaFaccao;
      window.mandarParaFaccao = function corponuMandarParaFaccao(orderId) {
        const order = state.maps.ordens.get(String(orderId));
        const currentManagementType = document.querySelector(".manejo-setor-btn.active")?.dataset?.setor;
        if (typeOfData(order) === "calcinha" || currentManagementType === "calcinha") {
          return sendCalcinhaToFaction(String(orderId));
        }
        return state.original.mandarParaFaccao(orderId);
      };
    }
  }

  function parsePreviewPdfRows() {
    return [...document.querySelectorAll("#pdfPreviewBody tr")].map(row => {
      const cells = [...row.cells].map(cell => String(cell.textContent || "").trim());
      return {
        numeroOP: normalize(cells[0]),
        lote: normalize(cells[1]),
        referencia: normalize(cells[2]),
        produtoNome: cells[3] || `Calcinha Ref. ${cells[2] || ""}`,
        cor: normalize(cells[4]),
        quantidade: parseBrazilianNumber(cells[5])
      };
    }).filter(item => item.numeroOP && item.referencia && item.cor && item.quantidade > 0);
  }

  async function importCalcinhaPdf(event) {
    if (document.getElementById("pdfTipoPeca")?.value !== "calcinha") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!isAdmin()) {
      toast("Apenas administradores podem importar PDF.", "error");
      return;
    }
    const records = parsePreviewPdfRows();
    const needStart = document.getElementById("pdfNecessidadeInicio")?.value || "";
    const needEnd = document.getElementById("pdfNecessidadeFim")?.value || "";
    const process = normalize(document.getElementById("pdfCalcinhaProcesso")?.value);
    const faction = normalize(document.getElementById("pdfCalcinhaFaccao")?.value);
    if (!records.length) {
      toast("Leia o PDF e confira a prévia antes de importar.", "error");
      return;
    }
    if (!needStart || !needEnd || needStart > needEnd) {
      toast("Informe um intervalo de necessidade válido.", "error");
      return;
    }
    if (!CALCINHA_PROCESSES.includes(process) || !faction) {
      toast("Selecione o serviço e a facção de destino das calcinhas.", "error");
      return;
    }
    if (!confirm(`Importar ${records.length} OP(s) de calcinha para ${faction}, serviço ${process}? A linha Cotton Line/Corpo Nu ficará em branco para preenchimento no Manejo.`)) return;
    const user = currentUser();
    const { doc, writeBatch, serverTimestamp } = state.firebase;
    const needText = parseNeedFromDates(needStart, needEnd);
    const existingOps = new Set([...state.maps.ordens.values()].map(item => normalize(item.numeroOP)));
    let imported = 0;
    let skipped = 0;
    let batch = writeBatch(state.db);
    let operations = 0;
    const productWrites = new Set();
    try {
      for (const record of records) {
        if (existingOps.has(record.numeroOP)) {
          skipped++;
          continue;
        }
        const productId = `calcinha-${safeId(record.referencia)}`;
        if (!state.maps.produtos.has(productId) && !productWrites.has(productId)) {
          batch.set(doc(state.db, "produtos", productId), {
            referencia: record.referencia,
            nome: record.produtoNome || `Calcinha Ref. ${record.referencia}`,
            tipoPeca: "calcinha",
            tipoPecaPadrao: "calcinha",
            tipoPecaLabel: "Calcinha",
            possuiAlca: false,
            possuiBojo: false,
            possuiRenda: false,
            cadastroPendente: true,
            statusCadastro: "pendente",
            pendencia: "Conferir cadastro da referência de calcinha.",
            ativo: true,
            origem: "pdf_externo",
            criadoPor: user?.uid || "",
            criadoEm: serverTimestamp(),
            atualizadoPor: user?.uid || "",
            atualizadoEm: serverTimestamp()
          }, { merge: true });
          productWrites.add(productId);
          operations++;
        }
        const orderId = `calcinha-pdf-${safeId(record.numeroOP)}-${safeId(record.referencia)}-${safeId(record.cor)}`;
        batch.set(doc(state.db, "ordensProducao", orderId), {
          numeroOP: record.numeroOP,
          lote: record.lote || "",
          referencia: record.referencia,
          cor: record.cor,
          produtoNome: record.produtoNome || `Calcinha Ref. ${record.referencia}`,
          quantidade: record.quantidade,
          necessidadeInicio: needStart,
          necessidadeFim: needEnd,
          necessidade: needText,
          necessidadeTexto: needText,
          necessidadeManual: true,
          tipoPeca: "calcinha",
          tipoPecaPadrao: "calcinha",
          tipoPecaLabel: "Calcinha",
          linhaCalcinha: "",
          processoPlanejado: process,
          faccaoPlanejada: faction,
          planejamentoCalcinhaPendente: false,
          possuiAlca: false,
          possuiBojo: false,
          possuiRenda: false,
          status: "aberta",
          origem: "pdf_externo",
          observacoes: `Importada do PDF como calcinha. Serviço: ${process}. Facção: ${faction}. Linha a definir no Manejo.`,
          criadoPor: user?.uid || "",
          criadoEm: serverTimestamp(),
          atualizadoPor: user?.uid || "",
          atualizadoEm: serverTimestamp()
        }, { merge: true });
        operations++;
        imported++;
        existingOps.add(record.numeroOP);
        if (operations >= 380) {
          await batch.commit();
          batch = writeBatch(state.db);
          operations = 0;
        }
      }
      if (operations) await batch.commit();
      await registerLog("pdf_importado", "importacao", "pdf-calcinha", `${imported} OPs de calcinha importadas. Serviço ${process}; facção ${faction}; ignoradas ${skipped}.`);
      document.getElementById("pdfImportResumo")?.classList.add("hidden");
      document.getElementById("pdfPreviewWrap")?.classList.add("hidden");
      document.getElementById("pdfPreviewBody").innerHTML = "";
      document.getElementById("btnConfirmarImportacaoPDF").disabled = true;
      toast(`Importação concluída: ${imported} OP(s) de calcinha. ${skipped} ignorada(s) por já existirem.`, "success");
      scheduleRefreshAndApply(700, true);
    } catch (error) {
      console.error(error);
      toast("Erro ao importar o PDF de calcinha.", "error");
    }
  }

  function injectHistoryImportPanel() {
    const page = document.getElementById("backup");
    if (!page || document.getElementById("painelImportacaoHistoricoCalcinhas")) return;
    const panel = document.createElement("div");
    panel.id = "painelImportacaoHistoricoCalcinhas";
    panel.className = "panel form backup-pro-panel corponu-history-panel admin-only-block";
    panel.innerHTML = `
      <div class="panel-header"><div><h3>Importar histórico das calcinhas</h3><p>Importa somente as abas Calcinhas Cotton Line e Calcinhas Corpo Nu. Não altera as OPs de sutiã.</p></div></div>
      <div class="notice small"><strong>Importação protegida:</strong> é manual, ignora IDs já existentes e preserva canceladas/encerradas para consulta.</div>
      <div class="corponu-history-summary">
        <div class="corponu-history-card"><span>OPs históricas</span><strong>1.440</strong></div>
        <div class="corponu-history-card"><span>Cotton Line</span><strong>465</strong></div>
        <div class="corponu-history-card"><span>Corpo Nu</span><strong>975</strong></div>
        <div class="corponu-history-card"><span>Referências</span><strong>113</strong></div>
      </div>
      <div class="actions"><button type="button" class="btn btn-primary" id="btnImportarHistoricoCalcinhas">Conferir e importar histórico</button></div>
      <div id="statusImportacaoHistoricoCalcinhas" class="corponu-dual-hint">Nenhuma importação foi iniciada.</div>
      <div class="corponu-import-progress"><span id="progressoImportacaoHistoricoCalcinhas"></span></div>
    `;
    const firstBackupPanel = page.querySelector(".backup-pro-panel");
    if (firstBackupPanel) firstBackupPanel.before(panel);
    else page.appendChild(panel);
    document.getElementById("btnImportarHistoricoCalcinhas")?.addEventListener("click", importHistoricalPanties);
  }

  async function importHistoricalPanties() {
    if (state.historicalImporting) return;
    if (!isAdmin()) {
      toast("Apenas administradores podem importar o histórico.", "error");
      return;
    }
    state.historicalImporting = true;
    const button = document.getElementById("btnImportarHistoricoCalcinhas");
    const status = document.getElementById("statusImportacaoHistoricoCalcinhas");
    const progress = document.getElementById("progressoImportacaoHistoricoCalcinhas");
    if (button) button.disabled = true;
    try {
      if (status) status.textContent = "Lendo e conferindo o arquivo histórico...";
      const response = await fetch(HISTORY_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`Arquivo histórico não encontrado (${response.status}).`);
      const payload = await response.json();
      const products = Array.isArray(payload.products) ? payload.products : [];
      const orders = Array.isArray(payload.orders) ? payload.orders : [];
      await refreshData({ collections: ["produtos", "ordensProducao"], serverFallback: true, force: true });
      const newProducts = products.filter(item => !state.maps.produtos.has(String(item.id)));
      const newOrders = orders.filter(item => !state.maps.ordens.has(String(item.id)));
      if (!newProducts.length && !newOrders.length) {
        if (status) status.textContent = "O histórico já está totalmente importado. Nenhum documento foi alterado.";
        toast("O histórico das calcinhas já está importado.", "success");
        return;
      }
      const message = `Conferência concluída:\n\nProdutos novos: ${newProducts.length}\nOPs novas: ${newOrders.length}\nOPs já existentes e preservadas: ${orders.length - newOrders.length}\n\nContinuar a importação?`;
      if (!confirm(message)) {
        if (status) status.textContent = "Importação cancelada após a conferência.";
        return;
      }
      const user = currentUser();
      const { doc, writeBatch, serverTimestamp } = state.firebase;
      const allItems = [
        ...newProducts.map(item => ({ kind: "product", item })),
        ...newOrders.map(item => ({ kind: "order", item }))
      ];
      let batch = writeBatch(state.db);
      let operations = 0;
      let completed = 0;
      for (const entry of allItems) {
        const item = entry.item;
        if (entry.kind === "product") {
          const { id, ...data } = item;
          batch.set(doc(state.db, "produtos", id), {
            ...data,
            tipoPeca: "calcinha",
            tipoPecaPadrao: "calcinha",
            tipoPecaLabel: "Calcinha",
            possuiAlca: false,
            possuiBojo: false,
            possuiRenda: false,
            cadastroPendente: false,
            statusCadastro: "conferido",
            criadoPor: user?.uid || "",
            criadoEm: serverTimestamp(),
            atualizadoPor: user?.uid || "",
            atualizadoEm: serverTimestamp()
          }, { merge: true });
        } else {
          const { id, ...data } = item;
          const management = data.fase ? {
            fase: data.fase,
            necessidade: data.necessidade || data.necessidadeOriginal || "",
            linhaCalcinha: data.linhaCalcinha || "",
            linhaCalcinhaLabel: data.linhaCalcinhaLabel || lineLabel(data.linhaCalcinha),
            status: "organizada",
            origem: "planilha_calcinhas_historico",
            atualizadoPor: user?.uid || "",
            atualizadoEm: serverTimestamp()
          } : {
            linhaCalcinha: data.linhaCalcinha || "",
            linhaCalcinhaLabel: data.linhaCalcinhaLabel || lineLabel(data.linhaCalcinha),
            necessidade: data.necessidade || data.necessidadeOriginal || "",
            status: "pendente",
            origem: "planilha_calcinhas_historico",
            atualizadoPor: user?.uid || "",
            atualizadoEm: serverTimestamp()
          };
          batch.set(doc(state.db, "ordensProducao", id), {
            ...data,
            tipoPeca: "calcinha",
            tipoPecaPadrao: "calcinha",
            tipoPecaLabel: "Calcinha",
            observacoes: data.observacao || data.observacoes || "",
            manejosSetores: { calcinha: management },
            criadoPor: user?.uid || "",
            criadoEm: serverTimestamp(),
            atualizadoPor: user?.uid || "",
            atualizadoEm: serverTimestamp()
          }, { merge: true });
        }
        operations++;
        completed++;
        if (operations >= 350) {
          await batch.commit();
          batch = writeBatch(state.db);
          operations = 0;
          if (progress) progress.style.width = `${Math.round(completed / allItems.length * 100)}%`;
          if (status) status.textContent = `Importando: ${formatNumber(completed)} de ${formatNumber(allItems.length)} documentos...`;
        }
      }
      if (operations) await batch.commit();
      if (progress) progress.style.width = "100%";
      if (status) status.textContent = `Concluído: ${newProducts.length} produtos e ${newOrders.length} OPs históricas adicionados. Registros existentes foram preservados.`;
      await registerLog("historico_calcinhas_importado", "importacao", "planilha-calcinhas", `${newProducts.length} produtos e ${newOrders.length} OPs de calcinha importados.`);
      toast("Histórico das calcinhas importado com sucesso.", "success");
      scheduleRefreshAndApply(900, true);
    } catch (error) {
      console.error(error);
      if (status) status.textContent = `Erro: ${error.message || "não foi possível importar"}`;
      toast("Erro ao importar o histórico das calcinhas.", "error");
    } finally {
      state.historicalImporting = false;
      if (button) button.disabled = false;
    }
  }

  function applyPage(pageId) {
    if (state.applying) return;
    state.applying = true;
    try {
      if (pageId === "produtos") applyProducts();
      if (pageId === "ordens") applyOrders();
      if (pageId === "faccoes") applyFaccoes();
      if (pageId === "rastreamento") applyTracking();
      if (pageId === "manejo" && !dedicatedCalcinhaActive()) { injectManejoLineColumn(); applyManejoTypeLayout(); }
    } finally {
      state.applying = false;
    }
  }

  function applyAll() {
    if (!state.ready) return;
    wrapEditFunctions();
    wrapManejoSave();
    wrapSendToFaction();
    if (!dedicatedCalcinhaActive()) {
      injectManejoLineColumn();
      applyManejoTypeLayout();
    }
    applyProducts();
    applyOrders();
    applyFaccoes();
    applyTracking();
    const activePage = getCurrentPage();
    if (activePage === "produtos" || activePage === "ordens") {
      document.body.dataset.corponuFormType = state.active[activePage];
      updateFormTypeUI(activePage, state.active[activePage]);
    }
  }

  function installObservers() {
    const ids = ["listaProdutos", "listaProdutosPendentes", "listaOrdens", "listaManejoInline", "listaFaccoesMovimentacoes", "listaMovimentacoesUsuario", "listaRastreamento"];
    ids.forEach(id => {
      const target = document.getElementById(id);
      if (!target) return;
      let scheduled = false;
      const observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          if (id === "listaManejoInline") {
            if (dedicatedCalcinhaActive()) return;
            injectManejoLineColumn();
            applyManejoTypeLayout();
          }
          if (id.includes("Produto")) applyProducts();
          else if (id === "listaOrdens") applyOrders();
          else if (id.includes("Faccoes") || id === "listaMovimentacoesUsuario") applyFaccoes();
          else if (id === "listaRastreamento") applyTracking();
        });
      });
      observer.observe(target, { childList: true, subtree: true });
      state.observers.push(observer);
    });
    const pageObserver = new MutationObserver(records => {
      if (dedicatedCalcinhaActive() && records.every(record => record.target instanceof Element && record.target.closest?.("#corponuManejoCalcinhaDedicado252"))) return;
      const page = getCurrentPage();
      if (["produtos", "ordens", "faccoes", "rastreamento", "manejo"].includes(page)) {
        if (page === "produtos" || page === "ordens") document.body.dataset.corponuFormType = state.active[page];
        scheduleRefreshAndApply(80, false);
      }
    });
    const appShell = document.getElementById("appShell") || document.body;
    pageObserver.observe(appShell, { attributes: true, subtree: true, attributeFilter: ["class"] });
    state.observers.push(pageObserver);
  }

  function installEvents() {
    document.addEventListener("submit", handleProductSubmit, true);
    document.addEventListener("submit", handleOrderSubmit, true);
    document.getElementById("btnConfirmarImportacaoPDF")?.addEventListener("click", importCalcinhaPdf, true);
    document.addEventListener("change", event => {
      const select = event.target.closest?.(".corponu-manejo-line-select");
      if (!select) return;
      select.classList.toggle("pending", !select.value);
    }, true);
    document.querySelectorAll(".manejo-setor-btn").forEach(button => button.addEventListener("click", () => setTimeout(() => {
      injectManejoLineColumn();
      applyManejoTypeLayout();
      scheduleRefreshAndApply(60, false);
    }, 30)));
    document.addEventListener("click", event => {
      const nav = event.target.closest?.(".nav-btn[data-page]");
      if (nav) setTimeout(() => scheduleRefreshAndApply(70, false), 30);
    }, true);
    document.getElementById("ordemReferencia")?.addEventListener("input", () => setTimeout(updateOrderProductPreview, 0), true);
    document.getElementById("btnCancelarProduto")?.addEventListener("click", () => setTimeout(() => updateFormTypeUI("produtos", state.active.produtos), 0));
    document.getElementById("btnCancelarOrdem")?.addEventListener("click", () => setTimeout(() => updateFormTypeUI("ordens", state.active.ordens), 0));
  }

  async function start() {
    if (window.__corponuDualModeStarted) return;
    window.__corponuDualModeStarted = true;
    try {
      injectStyles();
      await initializeFirebase();
      await refreshData({ serverFallback: true, force: true });
      ["produtos", "ordens", "faccoes", "rastreamento"].forEach(makeTabs);
      injectOrderCalcinhaFields();
      injectPdfCalcinhaFields();
      injectHistoryImportPanel();
      installEvents();
      wrapEditFunctions();
      wrapManejoSave();
      wrapSendToFaction();
      installObservers();
      state.ready = true;
      setActiveType("produtos", "sutia", { keepForm: true });
      setActiveType("ordens", "sutia", { keepForm: true });
      setActiveType("faccoes", "sutia", { keepForm: true });
      setActiveType("rastreamento", "sutia", { keepForm: true });
      injectManejoLineColumn();
      applyManejoTypeLayout();
      applyAll();
      window.corponuDualMode = {
        version: VERSION,
        refresh: () => refreshData({ force: true, serverFallback: true }).then(applyAll),
        state,
        importHistoricalPanties
      };
      console.info(`[CorpoNu Dual] Versão ${VERSION} iniciada.`);
    } catch (error) {
      console.error("[CorpoNu Dual] Falha ao iniciar.", error);
      toast("A extensão Sutiã/Calcinha não conseguiu iniciar. O fluxo antigo continua disponível.", "error");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
