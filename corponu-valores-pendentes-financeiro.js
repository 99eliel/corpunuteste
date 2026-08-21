(() => {
  "use strict";

  const VERSION = "2026-08-19-valores-pendentes-bilateral-213";
  const FIREBASE_VERSION = "10.12.5";
  const COLLECTION = "ajustesFinanceirosFaccoes";
  const BUTTON_ID = "btnValoresPendentesFinanceiro";
  const MODAL_ID = "modalValoresPendentesFinanceiro";
  const STYLE_ID = "styleValoresPendentesFinanceiro";
  const FLAG = "__CORPONU_VALORES_PENDENTES_FINANCEIRO__";

  if (window[FLAG] === VERSION) return;
  window[FLAG] = VERSION;

  let contextoPromise = null;
  let perfilPromise = null;
  let registros = [];
  let faccoes = [];
  let carregando = false;

  const normalizar = valor => String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const escapeHtml = valor => String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const moeda = valor => Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

  function dataLocalIso() {
    const data = new Date();
    const y = data.getFullYear();
    const m = String(data.getMonth() + 1).padStart(2, "0");
    const d = String(data.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function dataBr(valor) {
    const texto = String(valor || "");
    const m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (texto || "-");
  }

  function avisar(mensagem) {
    if (typeof window.mostrarAvisoFormulario === "function") {
      window.mostrarAvisoFormulario(mensagem);
      return;
    }
    window.alert(mensagem);
  }

  async function aguardarUsuario(auth, authMod) {
    if (auth.currentUser) return auth.currentUser;
    return new Promise((resolve, reject) => {
      let cancelar = null;
      const timer = window.setTimeout(() => {
        cancelar?.();
        reject(new Error("Usuário ainda não autenticado."));
      }, 10000);
      cancelar = authMod.onAuthStateChanged(auth, usuario => {
        if (!usuario) return;
        window.clearTimeout(timer);
        cancelar?.();
        resolve(usuario);
      }, erro => {
        window.clearTimeout(timer);
        cancelar?.();
        reject(erro);
      });
    });
  }

  async function contextoFirebase() {
    if (!contextoPromise) {
      contextoPromise = (async () => {
        const [appMod, firestore, authMod] = await Promise.all([
          import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
          import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
          import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`)
        ]);
        const app = appMod.getApps()[0];
        if (!app) throw new Error("O Firebase do sistema ainda não foi inicializado.");
        const auth = authMod.getAuth(app);
        const db = firestore.getFirestore(app);
        const usuario = await aguardarUsuario(auth, authMod);
        return { firestore, auth, db, usuario };
      })().catch(erro => {
        contextoPromise = null;
        throw erro;
      });
    }
    return contextoPromise;
  }

  async function obterPerfil() {
    if (!perfilPromise) {
      perfilPromise = (async () => {
        const { firestore, db, auth, usuario } = await contextoFirebase();
        const atual = auth.currentUser || usuario;
        const snap = await firestore.getDoc(firestore.doc(db, "usuarios", atual.uid));
        return snap.exists() ? snap.data() : {};
      })().catch(erro => {
        perfilPromise = null;
        throw erro;
      });
    }
    return perfilPromise;
  }

  function podeGerenciar(perfil) {
    if (perfil?.ativo !== true) return false;
    if (perfil?.tipo === "admin") return true;
    const recursos = perfil?.permissoes?.recursos || {};
    return recursos.gerenciarValores === true || recursos.marcarPagamentos === true;
  }

  function injetarEstilo() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${MODAL_ID}{position:fixed;inset:0;z-index:100500;background:rgba(15,23,42,.58);display:none;align-items:flex-start;justify-content:center;padding:28px 16px;overflow:auto}
      #${MODAL_ID}.aberto{display:flex}
      #${MODAL_ID} .vp-card{width:min(1180px,100%);background:#fff;border-radius:18px;box-shadow:0 24px 80px rgba(15,23,42,.3);overflow:hidden}
      #${MODAL_ID} .vp-topo{display:flex;gap:18px;align-items:flex-start;justify-content:space-between;padding:20px 22px;border-bottom:1px solid #e5e7eb}
      #${MODAL_ID} .vp-topo h3{margin:0 0 4px;font-size:21px}
      #${MODAL_ID} .vp-topo p{margin:0;color:#64748b;max-width:760px;font-size:13px;line-height:1.45}
      #${MODAL_ID} .vp-fechar{border:0;background:#f1f5f9;border-radius:10px;width:38px;height:38px;font-size:22px;cursor:pointer}
      #${MODAL_ID} .vp-corpo{padding:20px 22px 24px}
      #${MODAL_ID} .vp-resumo{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:18px}
      #${MODAL_ID} .vp-resumo-card{border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#f8fafc}
      #${MODAL_ID} .vp-resumo-card span{display:block;color:#64748b;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
      #${MODAL_ID} .vp-resumo-card strong{display:block;margin-top:5px;font-size:21px}
      #${MODAL_ID} .vp-resumo-card.desconto strong{color:#b91c1c}
      #${MODAL_ID} .vp-resumo-card.acrescimo strong{color:#166534}
      #${MODAL_ID} .vp-form{display:grid;grid-template-columns:minmax(180px,1.4fr) minmax(180px,1.1fr) minmax(120px,.7fr) minmax(140px,.8fr);gap:12px;align-items:end;padding:16px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;margin-bottom:16px}
      #${MODAL_ID} .vp-form label,#${MODAL_ID} .vp-filtros label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:800;color:#334155}
      #${MODAL_ID} input,#${MODAL_ID} select,#${MODAL_ID} textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:9px;padding:10px;background:#fff;color:#0f172a;font:inherit}
      #${MODAL_ID} textarea{min-height:68px;resize:vertical}
      #${MODAL_ID} .vp-motivo{grid-column:1/-1}
      #${MODAL_ID} .vp-form-acoes{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px}
      #${MODAL_ID} .vp-filtros{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin:10px 0 12px}
      #${MODAL_ID} .vp-filtros label{min-width:180px}
      #${MODAL_ID} .vp-filtros .vp-spacer{flex:1}
      #${MODAL_ID} .vp-table-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:12px}
      #${MODAL_ID} table{width:100%;border-collapse:collapse;min-width:850px}
      #${MODAL_ID} th,#${MODAL_ID} td{padding:10px 11px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top;font-size:12px}
      #${MODAL_ID} th{background:#f8fafc;color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:.04em;position:sticky;top:0}
      #${MODAL_ID} tr:last-child td{border-bottom:0}
      #${MODAL_ID} .vp-tipo{font-weight:800}
      #${MODAL_ID} .vp-tipo.desconto{color:#b91c1c}
      #${MODAL_ID} .vp-tipo.acrescimo{color:#166534}
      #${MODAL_ID} .vp-status{display:inline-flex;padding:4px 8px;border-radius:999px;font-weight:900;font-size:10px;text-transform:uppercase}
      #${MODAL_ID} .vp-status.pendente{background:#fef3c7;color:#92400e}
      #${MODAL_ID} .vp-status.quitado{background:#dcfce7;color:#166534}
      #${MODAL_ID} .vp-vazio{padding:26px;text-align:center;color:#64748b}
      #${MODAL_ID} .vp-ajuda{margin:0 0 16px;padding:11px 13px;border-radius:11px;background:#eff6ff;color:#1e3a8a;font-size:12px;line-height:1.5}
      #${MODAL_ID} .vp-btn{border:0;border-radius:9px;padding:9px 12px;font-weight:800;cursor:pointer;background:#e2e8f0;color:#0f172a}
      #${MODAL_ID} .vp-btn.primario{background:#0f766e;color:#fff}
      #${MODAL_ID} .vp-btn.secundario{background:#0f172a;color:#fff}
      #${MODAL_ID} .vp-btn:disabled{opacity:.55;cursor:wait}
      #${BUTTON_ID}{white-space:nowrap}
      @media(max-width:760px){
        #${MODAL_ID}{padding:10px}
        #${MODAL_ID} .vp-card{border-radius:14px}
        #${MODAL_ID} .vp-topo,#${MODAL_ID} .vp-corpo{padding:16px}
        #${MODAL_ID} .vp-resumo{grid-template-columns:1fr}
        #${MODAL_ID} .vp-form{grid-template-columns:1fr}
        #${MODAL_ID} .vp-motivo,#${MODAL_ID} .vp-form-acoes{grid-column:1}
      }
    `;
    document.head.appendChild(style);
  }

  function criarModal() {
    if (document.getElementById(MODAL_ID)) return;
    const modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Valores pendentes");
    modal.innerHTML = `
      <div class="vp-card">
        <div class="vp-topo">
          <div>
            <h3>Valores pendentes</h3>
            <p>Registre ajustes entre a empresa e as facções sem alterar os pagamentos já gerados. Se a facção deve, o valor representa desconto; se o financeiro deve, representa acréscimo.</p>
          </div>
          <button type="button" class="vp-fechar" data-vp-fechar aria-label="Fechar">×</button>
        </div>
        <div class="vp-corpo">
          <p class="vp-ajuda"><strong>Regra:</strong> Facção deve à empresa = descontar. Financeiro deve à facção = acrescentar. Os lançamentos ficam em histórico próprio e só mudam de status quando forem quitados.</p>

          <div class="vp-resumo">
            <div class="vp-resumo-card desconto"><span>A descontar</span><strong id="vpTotalDescontar">R$ 0,00</strong></div>
            <div class="vp-resumo-card acrescimo"><span>A acrescentar</span><strong id="vpTotalAcrescentar">R$ 0,00</strong></div>
            <div class="vp-resumo-card"><span>Ajuste líquido</span><strong id="vpTotalLiquido">R$ 0,00</strong></div>
          </div>

          <form class="vp-form" id="vpForm">
            <label>Facção
              <input id="vpFaccao" list="vpFaccoesLista" autocomplete="off" placeholder="Selecione ou digite a facção" required />
              <datalist id="vpFaccoesLista"></datalist>
            </label>
            <label>Quem está devendo
              <select id="vpTipo" required>
                <option value="faccao_deve_empresa">Facção deve à empresa</option>
                <option value="empresa_deve_faccao">Financeiro deve à facção</option>
              </select>
            </label>
            <label>Valor
              <input id="vpValor" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0,00" required />
            </label>
            <label>Data
              <input id="vpData" type="date" required />
            </label>
            <label class="vp-motivo">Motivo / observação
              <textarea id="vpMotivo" maxlength="500" placeholder="Ex.: diferença de pagamento, adiantamento, desconto combinado..."></textarea>
            </label>
            <div class="vp-form-acoes">
              <button type="submit" class="vp-btn primario" id="vpSalvar">Salvar valor pendente</button>
            </div>
          </form>

          <div class="vp-filtros">
            <label>Filtrar facção
              <select id="vpFiltroFaccao"><option value="">Todas</option></select>
            </label>
            <label>Status
              <select id="vpFiltroStatus">
                <option value="pendente">Pendentes</option>
                <option value="quitado">Quitados</option>
                <option value="">Todos</option>
              </select>
            </label>
            <span class="vp-spacer"></span>
            <button type="button" class="vp-btn" id="vpAtualizar">Atualizar</button>
            <button type="button" class="vp-btn secundario" id="vpImprimir">Imprimir extrato</button>
          </div>

          <div class="vp-table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Facção</th><th>Tipo</th><th>Motivo</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead>
              <tbody id="vpLista"><tr><td colspan="7" class="vp-vazio">Abra Valores pendentes para carregar os lançamentos.</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelectorAll("[data-vp-fechar]").forEach(btn => btn.addEventListener("click", fecharModal));
    modal.addEventListener("click", event => { if (event.target === modal) fecharModal(); });
    modal.querySelector("#vpForm")?.addEventListener("submit", salvarRegistro);
    modal.querySelector("#vpFiltroFaccao")?.addEventListener("change", renderizar);
    modal.querySelector("#vpFiltroStatus")?.addEventListener("change", renderizar);
    modal.querySelector("#vpAtualizar")?.addEventListener("click", () => carregarRegistros(true));
    modal.querySelector("#vpImprimir")?.addEventListener("click", imprimirExtrato);
    modal.querySelector("#vpLista")?.addEventListener("click", tratarAcaoLista);
    const data = modal.querySelector("#vpData");
    if (data) data.value = dataLocalIso();
  }

  function abrirModal() {
    injetarEstilo();
    criarModal();
    document.getElementById(MODAL_ID)?.classList.add("aberto");
    document.body.style.overflow = "hidden";
    carregarRegistros(false);
  }

  function fecharModal() {
    document.getElementById(MODAL_ID)?.classList.remove("aberto");
    document.body.style.overflow = "";
  }

  function nomesFaccoesDoFiltroPagamento() {
    const select = document.getElementById("pagamentoFiltroFaccao");
    return [...(select?.options || [])]
      .map(option => String(option.value || option.textContent || "").trim())
      .filter(Boolean)
      .filter(nome => normalizar(nome) !== "TODAS");
  }

  async function carregarFaccoes(contexto) {
    const nomes = new Set(nomesFaccoesDoFiltroPagamento());
    try {
      const snap = await contexto.firestore.getDocs(contexto.firestore.collection(contexto.db, "faccoes"));
      snap.forEach(docSnap => {
        const nome = String(docSnap.data()?.nome || "").trim();
        if (nome) nomes.add(nome);
      });
    } catch (erro) {
      console.warn("Valores pendentes: não foi possível complementar a lista de facções.", erro);
    }
    faccoes = [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    preencherFaccoes();
  }

  function preencherFaccoes() {
    const lista = document.getElementById("vpFaccoesLista");
    const filtro = document.getElementById("vpFiltroFaccao");
    if (lista) lista.innerHTML = faccoes.map(nome => `<option value="${escapeHtml(nome)}"></option>`).join("");
    if (filtro) {
      const atual = filtro.value;
      filtro.innerHTML = `<option value="">Todas</option>${faccoes.map(nome => `<option value="${escapeHtml(nome)}">${escapeHtml(nome)}</option>`).join("")}`;
      if ([...filtro.options].some(option => option.value === atual)) filtro.value = atual;
    }
  }

  async function carregarRegistros(forcar) {
    if (carregando) return;
    carregando = true;
    const lista = document.getElementById("vpLista");
    if (lista) lista.innerHTML = `<tr><td colspan="7" class="vp-vazio">Carregando...</td></tr>`;
    try {
      const contexto = await contextoFirebase();
      const perfil = await obterPerfil();
      if (!podeGerenciar(perfil)) throw new Error("Seu usuário não possui permissão para gerenciar valores pendentes.");
      if (forcar || !faccoes.length) await carregarFaccoes(contexto);

      const snap = await contexto.firestore.getDocs(contexto.firestore.collection(contexto.db, COLLECTION));
      registros = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      registros.sort((a, b) => {
        const da = String(a.data || "");
        const db = String(b.data || "");
        if (da !== db) return db.localeCompare(da);
        const ta = Number(a.createdAt?.seconds || 0);
        const tb = Number(b.createdAt?.seconds || 0);
        return tb - ta;
      });

      for (const item of registros) {
        const nome = String(item.faccao || "").trim();
        if (nome && !faccoes.some(f => normalizar(f) === normalizar(nome))) faccoes.push(nome);
      }
      faccoes.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
      preencherFaccoes();
      renderizar();
    } catch (erro) {
      console.error("Valores pendentes:", erro);
      if (lista) lista.innerHTML = `<tr><td colspan="7" class="vp-vazio">${escapeHtml(erro?.message || "Não foi possível carregar os valores pendentes.")}</td></tr>`;
      avisar(erro?.message || "Não foi possível carregar os valores pendentes.");
    } finally {
      carregando = false;
    }
  }

  function registrosFiltrados() {
    const faccao = String(document.getElementById("vpFiltroFaccao")?.value || "");
    const status = String(document.getElementById("vpFiltroStatus")?.value || "pendente");
    return registros.filter(item => {
      if (faccao && normalizar(item.faccao) !== normalizar(faccao)) return false;
      if (status && String(item.status || "pendente") !== status) return false;
      return true;
    });
  }

  function resumoPendentes() {
    const faccaoFiltro = String(document.getElementById("vpFiltroFaccao")?.value || "");
    const base = registros.filter(item => {
      if (String(item.status || "pendente") !== "pendente") return false;
      if (faccaoFiltro && normalizar(item.faccao) !== normalizar(faccaoFiltro)) return false;
      return true;
    });
    const descontar = base
      .filter(item => item.tipo === "faccao_deve_empresa")
      .reduce((soma, item) => soma + Number(item.valor || 0), 0);
    const acrescentar = base
      .filter(item => item.tipo === "empresa_deve_faccao")
      .reduce((soma, item) => soma + Number(item.valor || 0), 0);
    return { descontar, acrescentar, liquido: acrescentar - descontar };
  }

  function renderizar() {
    const lista = document.getElementById("vpLista");
    if (!lista) return;
    const itens = registrosFiltrados();
    const resumo = resumoPendentes();
    const elDescontar = document.getElementById("vpTotalDescontar");
    const elAcrescentar = document.getElementById("vpTotalAcrescentar");
    const elLiquido = document.getElementById("vpTotalLiquido");
    if (elDescontar) elDescontar.textContent = moeda(resumo.descontar);
    if (elAcrescentar) elAcrescentar.textContent = moeda(resumo.acrescentar);
    if (elLiquido) {
      elLiquido.textContent = `${resumo.liquido > 0 ? "+" : resumo.liquido < 0 ? "−" : ""}${moeda(Math.abs(resumo.liquido))}`;
      elLiquido.style.color = resumo.liquido > 0 ? "#166534" : (resumo.liquido < 0 ? "#b91c1c" : "#0f172a");
    }

    if (!itens.length) {
      lista.innerHTML = `<tr><td colspan="7" class="vp-vazio">Nenhum lançamento neste filtro.</td></tr>`;
      return;
    }

    lista.innerHTML = itens.map(item => {
      const desconto = item.tipo === "faccao_deve_empresa";
      const status = String(item.status || "pendente");
      const tipoTexto = desconto ? "Facção deve à empresa" : "Financeiro deve à facção";
      const tipoClasse = desconto ? "desconto" : "acrescimo";
      const valorAssinado = `${desconto ? "−" : "+"}${moeda(item.valor)}`;
      const acao = status === "pendente" ? "Marcar quitado" : "Reabrir";
      const proximo = status === "pendente" ? "quitado" : "pendente";
      return `<tr>
        <td>${escapeHtml(dataBr(item.data))}</td>
        <td><strong>${escapeHtml(item.faccao || "-")}</strong></td>
        <td><span class="vp-tipo ${tipoClasse}">${escapeHtml(tipoTexto)}</span></td>
        <td>${escapeHtml(item.motivo || item.observacao || "-")}</td>
        <td><strong class="vp-tipo ${tipoClasse}">${escapeHtml(valorAssinado)}</strong></td>
        <td><span class="vp-status ${status === "quitado" ? "quitado" : "pendente"}">${status === "quitado" ? "Quitado" : "Pendente"}</span></td>
        <td><button type="button" class="vp-btn" data-vp-id="${escapeHtml(item.id)}" data-vp-status="${proximo}">${acao}</button></td>
      </tr>`;
    }).join("");
  }

  async function salvarRegistro(event) {
    event.preventDefault();
    const btn = document.getElementById("vpSalvar");
    const faccao = String(document.getElementById("vpFaccao")?.value || "").trim();
    const tipo = String(document.getElementById("vpTipo")?.value || "");
    const valor = Number(document.getElementById("vpValor")?.value || 0);
    const data = String(document.getElementById("vpData")?.value || "");
    const motivo = String(document.getElementById("vpMotivo")?.value || "").trim();

    if (!faccao) return avisar("Informe a facção.");
    if (!["faccao_deve_empresa", "empresa_deve_faccao"].includes(tipo)) return avisar("Escolha quem está devendo.");
    if (!Number.isFinite(valor) || valor <= 0) return avisar("Informe um valor maior que zero.");
    if (!data) return avisar("Informe a data do lançamento.");

    const descricao = tipo === "faccao_deve_empresa" ? "desconto da facção" : "acréscimo para a facção";
    if (!window.confirm(`Confirma ${descricao} de ${moeda(valor)} para ${faccao}?`)) return;

    try {
      if (btn) btn.disabled = true;
      const contexto = await contextoFirebase();
      const perfil = await obterPerfil();
      if (!podeGerenciar(perfil)) throw new Error("Seu usuário não possui permissão para gerenciar valores pendentes.");
      const usuario = contexto.auth.currentUser || contexto.usuario;
      await contexto.firestore.addDoc(contexto.firestore.collection(contexto.db, COLLECTION), {
        faccao,
        faccaoNormalizada: normalizar(faccao),
        tipo,
        valor: Number(valor.toFixed(2)),
        data,
        motivo,
        observacao: motivo,
        status: "pendente",
        origem: "valores_pendentes_financeiro",
        versaoOrigem: VERSION,
        createdBy: usuario.uid,
        createdByEmail: String(usuario.email || ""),
        createdAt: contexto.firestore.serverTimestamp(),
        updatedAt: contexto.firestore.serverTimestamp()
      });
      document.getElementById("vpValor").value = "";
      document.getElementById("vpMotivo").value = "";
      avisar("Valor pendente salvo com sucesso.");
      await carregarRegistros(true);
    } catch (erro) {
      console.error("Valores pendentes: falha ao salvar.", erro);
      avisar(erro?.message || "Não foi possível salvar o valor pendente.");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function tratarAcaoLista(event) {
    const btn = event.target.closest("[data-vp-id]");
    if (!btn) return;
    const id = String(btn.dataset.vpId || "");
    const novoStatus = String(btn.dataset.vpStatus || "");
    const item = registros.find(registro => registro.id === id);
    if (!item || !["pendente", "quitado"].includes(novoStatus)) return;
    const texto = novoStatus === "quitado" ? "marcar como quitado" : "reabrir como pendente";
    if (!window.confirm(`Deseja ${texto} o lançamento de ${moeda(item.valor)} de ${item.faccao}?`)) return;

    try {
      btn.disabled = true;
      const contexto = await contextoFirebase();
      const perfil = await obterPerfil();
      if (!podeGerenciar(perfil)) throw new Error("Seu usuário não possui permissão para gerenciar valores pendentes.");
      const usuario = contexto.auth.currentUser || contexto.usuario;
      await contexto.firestore.updateDoc(contexto.firestore.doc(contexto.db, COLLECTION, id), {
        status: novoStatus,
        updatedAt: contexto.firestore.serverTimestamp(),
        updatedBy: usuario.uid,
        quitadoAt: novoStatus === "quitado" ? contexto.firestore.serverTimestamp() : null,
        quitadoPor: novoStatus === "quitado" ? usuario.uid : null
      });
      await carregarRegistros(true);
    } catch (erro) {
      console.error("Valores pendentes: falha ao alterar status.", erro);
      avisar(erro?.message || "Não foi possível alterar o status do lançamento.");
      btn.disabled = false;
    }
  }

  function imprimirExtrato() {
    const itens = registrosFiltrados();
    if (!itens.length) return avisar("Não há lançamentos neste filtro para imprimir.");
    const resumo = resumoPendentes();
    const faccaoFiltro = document.getElementById("vpFiltroFaccao")?.selectedOptions?.[0]?.textContent || "Todas";
    const statusFiltro = document.getElementById("vpFiltroStatus")?.selectedOptions?.[0]?.textContent || "Todos";
    const linhas = itens.map(item => {
      const desconto = item.tipo === "faccao_deve_empresa";
      return `<tr>
        <td>${escapeHtml(dataBr(item.data))}</td>
        <td>${escapeHtml(item.faccao || "-")}</td>
        <td>${desconto ? "Facção deve à empresa" : "Financeiro deve à facção"}</td>
        <td>${escapeHtml(item.motivo || "-")}</td>
        <td style="text-align:right;font-weight:700">${desconto ? "−" : "+"}${escapeHtml(moeda(item.valor))}</td>
        <td>${String(item.status || "pendente") === "quitado" ? "Quitado" : "Pendente"}</td>
      </tr>`;
    }).join("");
    const janela = window.open("", "_blank");
    if (janela) janela.opener = null;
    if (!janela) return avisar("O navegador bloqueou a janela de impressão.");
    janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Valores pendentes</title><style>
      body{font-family:Arial,sans-serif;color:#111827;padding:28px}h1{font-size:22px;margin:0 0 6px}p{margin:3px 0;color:#475569;font-size:12px}.cards{display:flex;gap:10px;margin:18px 0}.card{border:1px solid #d1d5db;border-radius:9px;padding:10px 12px;min-width:170px}.card span{font-size:10px;text-transform:uppercase;color:#6b7280;font-weight:700}.card strong{display:block;margin-top:4px;font-size:16px}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{padding:8px;border-bottom:1px solid #e5e7eb;text-align:left;font-size:11px}th{background:#f3f4f6;text-transform:uppercase;font-size:10px}@media print{body{padding:0}}
    </style></head><body>
      <h1>Valores pendentes</h1><p>Facção: ${escapeHtml(faccaoFiltro)} | Status: ${escapeHtml(statusFiltro)}</p><p>Gerado em ${new Date().toLocaleString("pt-BR")}</p>
      <div class="cards"><div class="card"><span>A descontar</span><strong>${moeda(resumo.descontar)}</strong></div><div class="card"><span>A acrescentar</span><strong>${moeda(resumo.acrescentar)}</strong></div><div class="card"><span>Ajuste líquido</span><strong>${resumo.liquido > 0 ? "+" : resumo.liquido < 0 ? "−" : ""}${moeda(Math.abs(resumo.liquido))}</strong></div></div>
      <table><thead><tr><th>Data</th><th>Facção</th><th>Tipo</th><th>Motivo</th><th>Valor</th><th>Status</th></tr></thead><tbody>${linhas}</tbody></table>
      <script>window.addEventListener('load',()=>{window.print();});<\/script>
    </body></html>`);
    janela.document.close();
  }

  function injetarBotao() {
    if (document.getElementById(BUTTON_ID)) return true;
    const gerenciar = document.getElementById("btnToggleGerenciarValores");
    const actions = gerenciar?.closest(".actions");
    if (!actions) return false;
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "btn btn-warning";
    botao.id = BUTTON_ID;
    botao.textContent = "Valores pendentes";
    botao.addEventListener("click", abrirModal);
    actions.insertBefore(botao, gerenciar);
    return true;
  }

  function iniciar() {
    injetarEstilo();
    criarModal();
    if (injetarBotao()) return;
    const observer = new MutationObserver(() => {
      if (injetarBotao()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 20000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();