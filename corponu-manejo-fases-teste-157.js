(() => {
  "use strict";

  const VERSION = "2026-08-10-teste-manejo-fases-157";
  const STYLE_ID = "corponuManejoFasesTeste157Style";
  const POPUP_ID = "corponuFiltroFaseLateral157";
  const MODAL_ID = "corponuGerenciarFaseLateral157";
  const CONFIG_DOC = "manejoFaseLateralV1";

  if (window.__CORPONU_MANEJO_FASES_TESTE_157__ === VERSION) return;
  window.__CORPONU_MANEJO_FASES_TESTE_157__ = VERSION;

  const lateralPorOp = new Map();
  const carregandoOp = new Set();
  let sugestoesLaterais = [];
  let filtroSelecionado = new Set();
  let observerManejo = null;
  let rafAplicar = 0;
  let firebase = null;
  let unsubscribeConfig = null;
  let salvarOriginal = null;
  let limparOriginal = null;

  const normalizar = valor => String(valor ?? "").trim();
  const normalizarChave = valor => normalizar(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  function setorAtual() {
    return document.querySelector('#manejo .manejo-setor-btn.active[data-setor]')?.dataset?.setor || "sutia";
  }

  function usuarioEhAdmin() {
    return /admin/i.test(document.getElementById("userRole")?.textContent || "");
  }

  function escapeHtml(valor) {
    return String(valor ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function injetarEstilo() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* 157 TESTE — escopo estritamente limitado à aba Manejo. */
      #manejo .manejo-fase-toolbar-157{
        display:flex;justify-content:flex-end;align-items:center;gap:8px;
        margin:8px 0 10px;
      }
      #manejo .manejo-fase-toolbar-157 .btn{
        padding:8px 11px;font-size:12px;
      }

      #manejo .table-wrap{max-width:100%!important;overflow-x:auto!important;overflow-y:visible!important}
      #manejo .manejo-inline-table.manejo-fases-teste-157{
        width:100%!important;
        min-width:1500px!important;
        max-width:none!important;
        table-layout:fixed!important;
      }
      #manejo .manejo-inline-table.manejo-fases-teste-157 th,
      #manejo .manejo-inline-table.manejo-fases-teste-157 td{
        box-sizing:border-box!important;min-width:0!important;
      }
      #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(1),
      #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(1){width:6%!important}
      #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(2),
      #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(2){width:6%!important}
      #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(3),
      #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(3){width:15%!important}
      #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(4),
      #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(4){width:15%!important}
      #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(5),
      #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(5){width:13%!important}
      #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(6),
      #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(6){width:13%!important}
      #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(7),
      #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(7){width:5%!important}
      #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(8),
      #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(8){width:8%!important}
      #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(9),
      #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(9){width:9%!important}
      #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(10),
      #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(10){width:6%!important}
      #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(11),
      #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(11){width:4%!important}

      #manejo .manejo-inline-table.manejo-fases-teste-157 input,
      #manejo .manejo-inline-table.manejo-fases-teste-157 select,
      #manejo .manejo-inline-table.manejo-fases-teste-157 textarea{
        min-width:0!important;max-width:100%!important;width:100%!important;box-sizing:border-box!important;
      }
      #manejo .manejo-inline-table.manejo-fases-teste-157 .silk-fields,
      #manejo .manejo-inline-table.manejo-fases-teste-157 .tecido-fields,
      #manejo .manejo-inline-table.manejo-fases-teste-157 .fase-plus{
        min-width:0!important;max-width:100%!important;box-sizing:border-box!important;
      }
      #manejo .manejo-inline-table.manejo-fases-teste-157 .fase-plus input{min-width:0!important}
      #manejo .manejo-inline-table.manejo-fases-teste-157 .manejo-fase-lateral-select-157{
        height:34px;padding:7px 28px 7px 9px;border-radius:9px;font-size:12px;
      }
      #manejo .manejo-filtro-lateral-box-157{position:relative;display:flex;align-items:center;width:100%}
      #manejo .manejo-filtro-lateral-box-157 input{
        width:100%!important;padding-right:30px!important;cursor:pointer!important;background:#fff!important;
      }
      #manejo .manejo-filtro-lateral-box-157 button{
        position:absolute;right:2px;top:50%;transform:translateY(-50%);
        width:26px;height:26px;border:0;background:transparent;cursor:pointer;
        font-size:11px;color:#475569;border-radius:7px;
      }
      #manejo .manejo-filtro-lateral-box-157 button:hover{background:#eef2ff;color:#4f46e5}

      #${POPUP_ID}{
        position:fixed;z-index:100000;width:min(360px,calc(100vw - 24px));
        max-height:min(520px,calc(100vh - 24px));display:none;flex-direction:column;
        padding:14px;background:#fff;border:1px solid #d7dfeb;border-radius:16px;
        box-shadow:0 20px 50px rgba(15,23,42,.22);color:#182338;box-sizing:border-box;
      }
      #${POPUP_ID}.aberto{display:flex}
      #${POPUP_ID} .fl157-titulo{font-size:14px;font-weight:900;margin:0;color:#182338}
      #${POPUP_ID} .fl157-sub{font-size:11px;color:#64748b;margin:2px 0 10px}
      #${POPUP_ID} .fl157-busca{height:35px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:9px;font-size:12px;margin-bottom:8px}
      #${POPUP_ID} .fl157-todos,
      #${POPUP_ID} .fl157-opcao{
        display:flex!important;align-items:center!important;gap:9px!important;width:100%!important;
        padding:8px 7px!important;border-radius:8px!important;font-size:12px!important;font-weight:700!important;
        cursor:pointer!important;box-sizing:border-box!important;
      }
      #${POPUP_ID} .fl157-todos:hover,#${POPUP_ID} .fl157-opcao:hover{background:#f4f6fb}
      #${POPUP_ID} input[type="checkbox"]{width:16px!important;height:16px!important;min-width:16px!important;max-width:16px!important;margin:0!important;padding:0!important;flex:0 0 16px!important}
      #${POPUP_ID} .fl157-lista{overflow:auto;min-height:72px;max-height:270px;border-top:1px solid #edf0f5;border-bottom:1px solid #edf0f5;padding:4px 0;margin:4px 0 10px}
      #${POPUP_ID} .fl157-vazio{color:#94a3b8;font-size:12px;padding:12px 7px}
      #${POPUP_ID} .fl157-rodape{display:flex;align-items:center;justify-content:flex-end;gap:7px}
      #${POPUP_ID} .fl157-rodape button{padding:8px 11px;border-radius:9px;border:1px solid #d5dce8;background:#fff;font-size:11px;font-weight:800;cursor:pointer}
      #${POPUP_ID} .fl157-rodape button[data-aplicar]{background:#6d5ce7;border-color:#6d5ce7;color:#fff}

      #${MODAL_ID}{position:fixed;inset:0;z-index:100001;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.48)}
      #${MODAL_ID}.aberto{display:flex}
      #${MODAL_ID} .fl157-modal-card{width:min(520px,100%);max-height:min(650px,calc(100vh - 36px));overflow:auto;background:#fff;border-radius:18px;padding:18px;box-shadow:0 24px 70px rgba(15,23,42,.3)}
      #${MODAL_ID} .fl157-modal-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}
      #${MODAL_ID} h3{margin:0 0 4px;font-size:18px}
      #${MODAL_ID} p{margin:0;color:#64748b;font-size:12px;line-height:1.45}
      #${MODAL_ID} .fl157-adicionar{display:grid;grid-template-columns:1fr auto;gap:8px;margin:12px 0}
      #${MODAL_ID} .fl157-adicionar input{min-width:0}
      #${MODAL_ID} .fl157-ger-lista{display:grid;gap:7px;margin-top:10px}
      #${MODAL_ID} .fl157-ger-item{display:flex;justify-content:space-between;align-items:center;gap:10px;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;font-size:12px;font-weight:800}
      #${MODAL_ID} .fl157-ger-item button{border:0;background:#fff1f2;color:#be123c;border-radius:8px;padding:6px 8px;cursor:pointer;font-weight:800}
      #${MODAL_ID} .fl157-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}

      @media(max-width:900px){#manejo .manejo-inline-table.manejo-fases-teste-157{min-width:1420px!important}}
    `;
    document.head.appendChild(style);
  }

  async function iniciarFirebase() {
    if (firebase) return firebase;
    const [{ getApps }, firestoreMod, authMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js")
    ]);
    const app = getApps()[0];
    if (!app) throw new Error("Firebase ainda não inicializado.");
    const db = firestoreMod.getFirestore(app);
    const auth = authMod.getAuth(app);
    firebase = { db, auth, ...firestoreMod };
    return firebase;
  }

  function opcoesLateraisCompletas() {
    const mapa = new Map();
    sugestoesLaterais.forEach(v => {
      const valor = normalizar(v);
      if (valor) mapa.set(normalizarChave(valor), valor);
    });
    lateralPorOp.forEach(v => {
      const valor = normalizar(v);
      if (valor) mapa.set(normalizarChave(valor), valor);
    });
    return [...mapa.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  function atualizarSelectLateral(select, valorAtual = select?.value || "") {
    if (!select) return;
    const valor = normalizar(valorAtual);
    const opcoes = opcoesLateraisCompletas();
    if (valor && !opcoes.some(o => normalizarChave(o) === normalizarChave(valor))) opcoes.push(valor);
    select.innerHTML = '<option value=""></option>' + opcoes
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
      .join("");
    select.value = valor;
  }

  function extrairOpId(row) {
    const botao = row?.querySelector('button[onclick*="salvarManejoLinha"]');
    const onclick = botao?.getAttribute("onclick") || "";
    const match = onclick.match(/salvarManejoLinha\(['\"]([^'\"]+)['\"]\)/);
    return match?.[1] || "";
  }

  async function carregarValorLateral(opId) {
    if (!opId || lateralPorOp.has(opId) || carregandoOp.has(opId)) return;
    carregandoOp.add(opId);
    try {
      const f = await iniciarFirebase();
      const ref = f.doc(f.db, "ordensProducao", opId);
      let snap;
      try { snap = await f.getDocFromCache(ref); }
      catch (_) { snap = await f.getDoc(ref); }
      const valor = normalizar(snap.data()?.manejosSetores?.sutia?.faseLateral || "");
      lateralPorOp.set(opId, valor);
      const select = document.querySelector(`#manejo select.manejo-fase-lateral-select-157[data-op-id="${CSS.escape(opId)}"]`);
      if (select && !select.dataset.usuarioAlterou) atualizarSelectLateral(select, valor);
      aplicarFiltroNasLinhas();
    } catch (error) {
      console.warn("[Manejo 157] Não foi possível carregar Fase Lateral da OP.", opId, error);
    } finally {
      carregandoOp.delete(opId);
    }
  }

  async function salvarValorLateral(opId, valor) {
    if (!opId) return;
    const f = await iniciarFirebase();
    const limpo = normalizar(valor).toUpperCase();
    await f.updateDoc(f.doc(f.db, "ordensProducao", opId), {
      "manejosSetores.sutia.faseLateral": limpo,
      atualizadoPor: f.auth.currentUser?.uid || "",
      atualizadoEm: f.serverTimestamp()
    });
    lateralPorOp.set(opId, limpo);
  }

  async function limparValorLateral(opId) {
    if (!opId) return;
    try {
      const f = await iniciarFirebase();
      await f.updateDoc(f.doc(f.db, "ordensProducao", opId), {
        "manejosSetores.sutia.faseLateral": f.deleteField(),
        atualizadoPor: f.auth.currentUser?.uid || "",
        atualizadoEm: f.serverTimestamp()
      });
    } catch (error) {
      console.warn("[Manejo 157] Fase Lateral já estava vazia ou não pôde ser removida.", error);
    }
    lateralPorOp.set(opId, "");
  }

  function instalarWrappersSalvar() {
    if (typeof window.salvarManejoLinha === "function" && !window.salvarManejoLinha.__faseLateral157) {
      salvarOriginal = window.salvarManejoLinha;
      const wrapper = async function(opId) {
        const select = document.querySelector(`#manejo select.manejo-fase-lateral-select-157[data-op-id="${CSS.escape(String(opId))}"]`);
        const valorLateral = setorAtual() === "sutia" && select ? select.value : null;
        const retorno = await salvarOriginal.apply(this, arguments);
        if (valorLateral !== null) {
          try { await salvarValorLateral(String(opId), valorLateral); }
          catch (error) {
            console.error("[Manejo 157] Erro ao salvar Fase Lateral.", error);
            alert("Os demais dados do Manejo foram salvos, mas a Fase Lateral não pôde ser salva. Tente novamente.");
          }
        }
        return retorno;
      };
      wrapper.__faseLateral157 = true;
      window.salvarManejoLinha = wrapper;
    }

    if (typeof window.limparManejoLinha === "function" && !window.limparManejoLinha.__faseLateral157) {
      limparOriginal = window.limparManejoLinha;
      const wrapperLimpar = async function(opId) {
        const eraSutia = setorAtual() === "sutia";
        const retorno = await limparOriginal.apply(this, arguments);
        if (eraSutia) await limparValorLateral(String(opId));
        return retorno;
      };
      wrapperLimpar.__faseLateral157 = true;
      window.limparManejoLinha = wrapperLimpar;
    }
  }

  function garantirToolbar() {
    const manejo = document.getElementById("manejo");
    const tabs = manejo?.querySelector(".manejo-setor-tabs");
    if (!tabs) return;
    let toolbar = manejo.querySelector(".manejo-fase-toolbar-157");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.className = "manejo-fase-toolbar-157";
      toolbar.innerHTML = '<button type="button" class="btn btn-sm" id="btnGerenciarFaseLateral157">Gerenciar Fase Lateral</button>';
      tabs.insertAdjacentElement("afterend", toolbar);
      toolbar.querySelector("button")?.addEventListener("click", abrirGerenciador);
    }
    toolbar.style.display = setorAtual() === "sutia" && usuarioEhAdmin() ? "flex" : "none";
  }

  function garantirCabecalho(tabela) {
    const head = tabela.querySelector("thead .manejo-head-row");
    const filtro = tabela.querySelector("thead .manejo-filter-row");
    if (!head || !filtro) return;

    const faseHead = head.children[4];
    if (faseHead) faseHead.textContent = "FASE BOJO";

    if (!head.querySelector(".manejo-fase-lateral-head-157")) {
      const th = document.createElement("th");
      th.className = "manejo-fase-lateral-head-157";
      th.textContent = "FASE LATERAL";
      faseHead?.insertAdjacentElement("afterend", th);
    }

    const faseFiltro = filtro.children[4];
    document.getElementById("filtroManejoFase")?.setAttribute("title", "Fase Bojo");
    if (!filtro.querySelector(".manejo-fase-lateral-filter-157")) {
      const th = document.createElement("th");
      th.className = "manejo-fase-lateral-filter-157";
      th.innerHTML = `
        <div class="manejo-filtro-lateral-box-157">
          <input id="filtroManejoFaseLateral157" type="text" value="Todas" readonly aria-label="Filtro Fase Lateral" />
          <button type="button" aria-label="Abrir filtro Fase Lateral" title="Filtrar Fase Lateral">▼</button>
        </div>`;
      faseFiltro?.insertAdjacentElement("afterend", th);
      th.querySelector("input")?.addEventListener("click", event => abrirPopupFiltro(event.currentTarget));
      th.querySelector("button")?.addEventListener("click", event => abrirPopupFiltro(event.currentTarget));
    }
  }

  function garantirLinhas(tabela) {
    tabela.querySelectorAll("tbody#listaManejoInline > tr").forEach(row => {
      if (row.querySelector("td.empty")) {
        row.querySelector("td.empty")?.setAttribute("colspan", "11");
        return;
      }
      const faseInput = row.querySelector('input[id$="-fase"]');
      const faseTd = faseInput?.closest("td");
      if (!faseTd) return;
      const opId = extrairOpId(row);
      if (!opId) return;

      let lateralTd = row.querySelector("td.manejo-fase-lateral-cell-157");
      if (!lateralTd) {
        lateralTd = document.createElement("td");
        lateralTd.className = "manejo-fase-lateral-cell-157";
        lateralTd.innerHTML = `<select class="manejo-fase-lateral-select-157" data-op-id="${escapeHtml(opId)}" aria-label="Fase Lateral da OP"></select>`;
        faseTd.insertAdjacentElement("afterend", lateralTd);
        const select = lateralTd.querySelector("select");
        atualizarSelectLateral(select, lateralPorOp.get(opId) || "");
        select.addEventListener("change", () => {
          select.dataset.usuarioAlterou = "1";
          aplicarFiltroNasLinhas();
        });
      } else {
        const select = lateralTd.querySelector("select");
        if (select && !select.dataset.usuarioAlterou) atualizarSelectLateral(select, lateralPorOp.get(opId) || select.value);
      }
      carregarValorLateral(opId);
    });
  }

  function limparEstruturaSutia(tabela) {
    tabela.classList.remove("manejo-fases-teste-157");
    const head = tabela.querySelector("thead .manejo-head-row");
    if (head?.children[4]) head.children[4].textContent = "FASE";
    tabela.querySelector(".manejo-fase-lateral-head-157")?.remove();
    tabela.querySelector(".manejo-fase-lateral-filter-157")?.remove();
    tabela.querySelectorAll("td.manejo-fase-lateral-cell-157").forEach(td => td.remove());
    tabela.querySelectorAll("tbody#listaManejoInline td.empty").forEach(td => td.setAttribute("colspan", "10"));
    fecharPopupFiltro();
  }

  function aplicarEstrutura() {
    injetarEstilo();
    instalarWrappersSalvar();
    garantirToolbar();
    const tabela = document.querySelector("#manejo .manejo-inline-table");
    if (!tabela) return;
    if (setorAtual() !== "sutia") {
      limparEstruturaSutia(tabela);
      return;
    }
    tabela.classList.add("manejo-fases-teste-157");
    garantirCabecalho(tabela);
    garantirLinhas(tabela);
    aplicarFiltroNasLinhas();
  }

  function agendarAplicacao() {
    cancelAnimationFrame(rafAplicar);
    rafAplicar = requestAnimationFrame(() => aplicarEstrutura());
  }

  function resumoFiltro() {
    const input = document.getElementById("filtroManejoFaseLateral157");
    if (!input) return;
    if (!filtroSelecionado.size) input.value = "Todas";
    else if (filtroSelecionado.size === 1) input.value = [...filtroSelecionado][0] === "__VAZIO__" ? "Campo vazio" : [...filtroSelecionado][0];
    else input.value = `${filtroSelecionado.size} selecionados`;
  }

  function aplicarFiltroNasLinhas() {
    resumoFiltro();
    document.querySelectorAll("#manejo tbody#listaManejoInline > tr").forEach(row => {
      row.classList.remove("manejo-lateral-filtrado-oculto-157");
      if (!filtroSelecionado.size || row.querySelector("td.empty")) return;
      const select = row.querySelector("select.manejo-fase-lateral-select-157");
      if (!select) return;
      const valor = normalizarChave(select.value);
      const atende = [...filtroSelecionado].some(item => item === "__VAZIO__" ? !valor : normalizarChave(item) === valor);
      if (!atende) row.classList.add("manejo-lateral-filtrado-oculto-157");
    });
    let styleFiltro = document.getElementById("corponuFiltroLateralLinha157Style");
    if (!styleFiltro) {
      styleFiltro = document.createElement("style");
      styleFiltro.id = "corponuFiltroLateralLinha157Style";
      styleFiltro.textContent = "#manejo tr.manejo-lateral-filtrado-oculto-157{display:none!important}";
      document.head.appendChild(styleFiltro);
    }
  }

  function garantirPopupFiltro() {
    let popup = document.getElementById(POPUP_ID);
    if (popup) return popup;
    popup = document.createElement("div");
    popup.id = POPUP_ID;
    popup.innerHTML = `
      <div class="fl157-titulo">Fase Lateral</div>
      <div class="fl157-sub">Opções definidas pelo administrador</div>
      <input class="fl157-busca" type="text" placeholder="Pesquisar nas opções..." autocomplete="off" />
      <label class="fl157-todos"><input type="checkbox" data-todos /><span>Selecionar tudo</span></label>
      <div class="fl157-lista"></div>
      <div class="fl157-rodape">
        <button type="button" data-limpar>Limpar</button>
        <button type="button" data-cancelar>Cancelar</button>
        <button type="button" data-aplicar>Aplicar</button>
      </div>`;
    document.body.appendChild(popup);
    popup.querySelector(".fl157-busca")?.addEventListener("input", renderizarOpcoesPopup);
    popup.querySelector("[data-todos]")?.addEventListener("change", event => {
      popup.querySelectorAll('.fl157-lista input[type="checkbox"]').forEach(chk => chk.checked = event.target.checked);
    });
    popup.querySelector("[data-limpar]")?.addEventListener("click", () => {
      popup.querySelectorAll('input[type="checkbox"]').forEach(chk => chk.checked = false);
    });
    popup.querySelector("[data-cancelar]")?.addEventListener("click", fecharPopupFiltro);
    popup.querySelector("[data-aplicar]")?.addEventListener("click", () => {
      const nova = new Set();
      popup.querySelectorAll('.fl157-lista input[type="checkbox"]:checked').forEach(chk => nova.add(chk.value));
      filtroSelecionado = nova;
      aplicarFiltroNasLinhas();
      fecharPopupFiltro();
    });
    return popup;
  }

  function renderizarOpcoesPopup() {
    const popup = garantirPopupFiltro();
    const busca = normalizarChave(popup.querySelector(".fl157-busca")?.value || "");
    const lista = popup.querySelector(".fl157-lista");
    const itens = [
      { valor: "__VAZIO__", texto: "Campo vazio" },
      ...opcoesLateraisCompletas().map(valor => ({ valor, texto: valor }))
    ].filter(item => !busca || normalizarChave(item.texto).includes(busca));

    lista.innerHTML = itens.length ? itens.map(item => `
      <label class="fl157-opcao">
        <input type="checkbox" value="${escapeHtml(item.valor)}" ${filtroSelecionado.has(item.valor) ? "checked" : ""} />
        <span>${escapeHtml(item.texto)}</span>
      </label>`).join("") : '<div class="fl157-vazio">Nenhuma opção encontrada.</div>';

    const checkTodos = popup.querySelector("[data-todos]");
    const checks = [...lista.querySelectorAll('input[type="checkbox"]')];
    if (checkTodos) checkTodos.checked = !!checks.length && checks.every(chk => chk.checked);
  }

  function posicionarPopup(ancora) {
    const popup = garantirPopupFiltro();
    const rect = ancora?.getBoundingClientRect();
    if (!rect) return;
    const margem = 8;
    const largura = Math.min(360, window.innerWidth - 24);
    popup.style.width = `${largura}px`;
    popup.style.left = `${Math.min(Math.max(12, rect.left), window.innerWidth - largura - 12)}px`;
    popup.style.top = "12px";
    popup.classList.add("aberto");
    const altura = popup.getBoundingClientRect().height || 420;
    const abaixo = rect.bottom + margem;
    const acima = rect.top - altura - margem;
    popup.style.top = `${abaixo + altura <= window.innerHeight - 12 ? abaixo : Math.max(12, acima)}px`;
  }

  function abrirPopupFiltro(ancora) {
    if (setorAtual() !== "sutia") return;
    const popup = garantirPopupFiltro();
    popup.querySelector(".fl157-busca").value = "";
    renderizarOpcoesPopup();
    posicionarPopup(document.getElementById("filtroManejoFaseLateral157") || ancora);
  }

  function fecharPopupFiltro() {
    document.getElementById(POPUP_ID)?.classList.remove("aberto");
  }

  function reposicionarPopup() {
    const popup = document.getElementById(POPUP_ID);
    if (!popup?.classList.contains("aberto")) return;
    const ancora = document.getElementById("filtroManejoFaseLateral157");
    if (!ancora) return fecharPopupFiltro();
    const r = ancora.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return fecharPopupFiltro();
    posicionarPopup(ancora);
  }

  async function iniciarConfigSugestoes() {
    if (unsubscribeConfig) return;
    try {
      const f = await iniciarFirebase();
      unsubscribeConfig = f.onSnapshot(f.doc(f.db, "configuracoes", CONFIG_DOC), snap => {
        sugestoesLaterais = Array.isArray(snap.data()?.opcoes)
          ? snap.data().opcoes.map(v => normalizar(v).toUpperCase()).filter(Boolean)
          : [];
        document.querySelectorAll("#manejo select.manejo-fase-lateral-select-157").forEach(select => atualizarSelectLateral(select, select.value));
        renderizarGerenciadorLista();
        if (document.getElementById(POPUP_ID)?.classList.contains("aberto")) renderizarOpcoesPopup();
      }, error => console.warn("[Manejo 157] Sugestões da Fase Lateral indisponíveis.", error));
    } catch (error) {
      console.warn("[Manejo 157] Firebase ainda não pronto para sugestões.", error);
      setTimeout(iniciarConfigSugestoes, 1200);
    }
  }

  function garantirModalGerenciador() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.innerHTML = `
      <div class="fl157-modal-card">
        <div class="fl157-modal-top">
          <div><h3>Gerenciar Fase Lateral</h3><p>Cadastre aqui as opções que aparecerão no campo e no filtro da Fase Lateral. Isso não altera a Fase Bojo.</p></div>
          <button class="btn btn-sm" type="button" data-fechar>✕</button>
        </div>
        <div class="fl157-adicionar">
          <input type="text" data-nova placeholder="Nova sugestão de Fase Lateral" autocomplete="off" />
          <button class="btn btn-primary" type="button" data-adicionar>Adicionar</button>
        </div>
        <div class="fl157-ger-lista"></div>
        <div class="fl157-modal-actions"><button class="btn" type="button" data-fechar>Fechar</button></div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-fechar]").forEach(btn => btn.addEventListener("click", () => modal.classList.remove("aberto")));
    modal.addEventListener("click", event => { if (event.target === modal) modal.classList.remove("aberto"); });
    modal.querySelector("[data-adicionar]")?.addEventListener("click", adicionarSugestaoGerenciador);
    modal.querySelector("[data-nova]")?.addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); adicionarSugestaoGerenciador(); }
    });
    return modal;
  }

  function abrirGerenciador() {
    if (!usuarioEhAdmin()) return;
    const modal = garantirModalGerenciador();
    renderizarGerenciadorLista();
    modal.classList.add("aberto");
    setTimeout(() => modal.querySelector("[data-nova]")?.focus(), 0);
  }

  function renderizarGerenciadorLista() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    const lista = modal.querySelector(".fl157-ger-lista");
    if (!lista) return;
    lista.innerHTML = sugestoesLaterais.length
      ? sugestoesLaterais.map((item, i) => `<div class="fl157-ger-item"><span>${escapeHtml(item)}</span><button type="button" data-remover="${i}">Remover</button></div>`).join("")
      : '<div class="fl157-vazio">Nenhuma sugestão cadastrada ainda.</div>';
    lista.querySelectorAll("[data-remover]").forEach(btn => btn.addEventListener("click", () => removerSugestaoGerenciador(Number(btn.dataset.remover))));
  }

  async function gravarSugestoes(novas) {
    const f = await iniciarFirebase();
    const unicas = [...new Map(novas
      .map(v => normalizar(v).toUpperCase())
      .filter(Boolean)
      .map(v => [normalizarChave(v), v])).values()]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    await f.setDoc(f.doc(f.db, "configuracoes", CONFIG_DOC), {
      opcoes: unicas,
      versao: VERSION,
      atualizadoPor: f.auth.currentUser?.uid || "",
      atualizadoEm: f.serverTimestamp()
    }, { merge: true });
  }

  async function adicionarSugestaoGerenciador() {
    const modal = garantirModalGerenciador();
    const input = modal.querySelector("[data-nova]");
    const valor = normalizar(input?.value).toUpperCase();
    if (!valor) return;
    try {
      await gravarSugestoes([...sugestoesLaterais, valor]);
      input.value = "";
      input.focus();
    } catch (error) {
      console.error("[Manejo 157] Erro ao salvar sugestão.", error);
      alert("Não foi possível salvar a sugestão. Confirme se você está logado como administrador.");
    }
  }

  async function removerSugestaoGerenciador(indice) {
    if (!Number.isInteger(indice) || indice < 0 || indice >= sugestoesLaterais.length) return;
    try { await gravarSugestoes(sugestoesLaterais.filter((_, i) => i !== indice)); }
    catch (error) {
      console.error("[Manejo 157] Erro ao remover sugestão.", error);
      alert("Não foi possível remover a sugestão.");
    }
  }

  function instalarEventosGlobaisMinimos() {
    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (!alvo) return;
      if (alvo.closest("#manejo .manejo-setor-btn")) setTimeout(agendarAplicacao, 0);
      const popup = document.getElementById(POPUP_ID);
      if (popup?.classList.contains("aberto") && !alvo.closest(`#${POPUP_ID}`) && !alvo.closest(".manejo-filtro-lateral-box-157")) fecharPopupFiltro();
    }, true);
    window.addEventListener("resize", reposicionarPopup, { passive: true });
    window.addEventListener("scroll", reposicionarPopup, { passive: true, capture: true });
  }

  function observarSomenteManejo() {
    const manejo = document.getElementById("manejo");
    if (!manejo || observerManejo) return;
    observerManejo = new MutationObserver(() => agendarAplicacao());
    observerManejo.observe(manejo, { childList: true, subtree: true });
  }

  function iniciar() {
    injetarEstilo();
    instalarEventosGlobaisMinimos();
    observarSomenteManejo();
    iniciarConfigSugestoes();
    aplicarEstrutura();
    const esperaFuncoes = setInterval(() => {
      instalarWrappersSalvar();
      garantirToolbar();
      if (window.salvarManejoLinha?.__faseLateral157 && window.limparManejoLinha?.__faseLateral157) clearInterval(esperaFuncoes);
    }, 400);
    setTimeout(() => clearInterval(esperaFuncoes), 15000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();
