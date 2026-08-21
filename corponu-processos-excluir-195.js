(() => {
  "use strict";

  const VERSION = "2026-08-13-excluir-processo-valores-195";
  const FIREBASE_VERSION = "10.12.5";
  const BUTTON_ID = "btnExcluirProcessoInteiro195";
  const BOX_ID = "boxExcluirProcessoInteiro195";
  const STYLE_ID = "styleExcluirProcessoInteiro195";

  if (window.__CORPONU_EXCLUIR_PROCESSO_195__ === VERSION) return;
  window.__CORPONU_EXCLUIR_PROCESSO_195__ = VERSION;

  let contextoPromise = null;
  let excluindo = false;

  function normalizar(valor) {
    return String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function setorNormalizadoPorProcesso(processo, setor) {
    const nome = normalizar(processo);
    if (nome.includes("CALCINHA")) return "calcinha";
    if (nome.includes("SUTIA")) return "sutia";
    if (nome === "ENCAPAR BOJO" || nome === "BOJO") return "bojo";
    if (nome === "LATERAL") return "lateral";
    if (nome === "ALCA" || nome === "ALCAS") return "alca";
    return String(setor || "").trim().toLowerCase();
  }

  function labelSetor(setor) {
    const mapa = {
      bojo: "Bojo",
      alca: "Alça",
      lateral: "Lateral",
      renda: "Renda",
      sutia: "Sutiã",
      calcinha: "Calcinha"
    };
    return mapa[setor] || setor || "-";
  }

  function selecaoAtual() {
    const select = document.getElementById("valorProcessoAtivo");
    const chave = String(select?.value || select?.dataset?.chaveSelecionada || "").trim();
    const [setor, ...resto] = chave.split("__");
    return {
      chave,
      setor: String(setor || "").trim().toLowerCase(),
      processo: String(resto.join("__") || "").trim().toUpperCase()
    };
  }

  function toast(mensagem, tipo = "info") {
    let el = document.getElementById("corponuExcluirProcessoToast195");
    if (!el) {
      el = document.createElement("div");
      el.id = "corponuExcluirProcessoToast195";
      document.body.appendChild(el);
    }
    el.dataset.tipo = tipo;
    el.textContent = mensagem;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 5000);
  }

  function injetarEstilo() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BOX_ID}{
        margin-top:14px;padding:14px;border:1px solid #fecaca;border-radius:13px;
        background:#fff7f7;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap
      }
      #${BOX_ID} .cn195-texto{display:grid;gap:3px;min-width:220px}
      #${BOX_ID} .cn195-texto strong{color:#991b1b;font-size:13px}
      #${BOX_ID} .cn195-texto span{color:#7f1d1d;font-size:11px;line-height:1.35}
      #${BUTTON_ID}{background:#dc2626!important;border-color:#dc2626!important;color:#fff!important;font-weight:900}
      #${BUTTON_ID}:hover{background:#b91c1c!important;border-color:#b91c1c!important}
      #${BUTTON_ID}[disabled]{opacity:.6;cursor:wait}
      #corponuExcluirProcessoToast195{position:fixed;right:18px;bottom:18px;z-index:100100;max-width:430px;padding:13px 16px;border-radius:12px;background:#172033;color:#fff;font:800 13px/1.4 Arial,sans-serif;box-shadow:0 18px 45px rgba(0,0,0,.25);opacity:0;transform:translateY(14px);pointer-events:none;transition:.18s ease}
      #corponuExcluirProcessoToast195.show{opacity:1;transform:translateY(0)}
      #corponuExcluirProcessoToast195[data-tipo="erro"]{background:#991b1b}
      #corponuExcluirProcessoToast195[data-tipo="ok"]{background:#166534}
    `;
    document.head.appendChild(style);
  }

  async function obterContexto() {
    if (contextoPromise) return contextoPromise;
    contextoPromise = (async () => {
      const [appModule, authModule, firestoreModule] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
      ]);
      const app = appModule.getApps()[0] || appModule.getApp();
      return {
        auth: authModule.getAuth(app),
        db: firestoreModule.getFirestore(app),
        fs: firestoreModule
      };
    })();
    return contextoPromise;
  }

  async function obterPerfilAdmin(ctx) {
    const user = ctx.auth.currentUser;
    if (!user) return null;
    const ref = ctx.fs.doc(ctx.db, "usuarios", user.uid);
    let snap;
    try {
      snap = await ctx.fs.getDocFromCache(ref);
    } catch {
      snap = await ctx.fs.getDoc(ref);
    }
    const perfil = snap.exists() ? snap.data() : {};
    const tipo = normalizar(perfil.tipo || perfil.perfil || document.getElementById("userRole")?.textContent || "");
    return tipo === "ADMIN" ? { user, perfil } : null;
  }

  function atualizarInterfaceDepoisExcluir(chave, processo) {
    const select = document.getElementById("valorProcessoAtivo");
    if (select) {
      const option = [...select.options].find(item => item.value === chave);
      option?.remove();
      select.value = "";
      select.dataset.chaveSelecionada = "";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    document.querySelectorAll("#listaProcessosValores .processo-valor-item").forEach(item => {
      const onclick = String(item.getAttribute("onclick") || "");
      const nome = normalizar(item.querySelector("strong")?.textContent || "");
      if (onclick.includes(chave) || nome === normalizar(processo)) item.remove();
    });

    const processoInput = document.getElementById("precoReferenciaProcesso");
    const setorInput = document.getElementById("precoReferenciaSetor");
    const renomearInput = document.getElementById("valorRenomearProcesso");
    const tbody = document.getElementById("listaPrecosReferencia");
    if (processoInput) processoInput.value = "";
    if (setorInput) setorInput.value = "";
    if (renomearInput) renomearInput.value = "";
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="empty">Selecione um processo para visualizar os valores.</td></tr>`;

    const textos = {
      valorProcessoSelecionadoLabel: "Nenhum",
      valorTotalReferencias: "0",
      valorTotalAtivos: "0",
      valorTotalInativos: "0"
    };
    Object.entries(textos).forEach(([id, valor]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = valor;
    });
  }

  async function excluirProcessoSelecionado() {
    if (excluindo) return;
    const selecao = selecaoAtual();
    if (!selecao.processo || !selecao.setor) {
      toast("Selecione um processo antes de excluir.", "erro");
      return;
    }

    excluindo = true;
    const botao = document.getElementById(BUTTON_ID);
    if (botao) {
      botao.disabled = true;
      botao.textContent = "Conferindo...";
    }

    try {
      const ctx = await obterContexto();
      const admin = await obterPerfilAdmin(ctx);
      if (!admin) {
        toast("Apenas administrador pode excluir um processo inteiro.", "erro");
        return;
      }

      // Consulta somente o processo selecionado. O filtro do setor é feito em memória
      // para também alcançar registros antigos cujo setor foi salvo incorretamente.
      const consulta = ctx.fs.query(
        ctx.fs.collection(ctx.db, "precosReferencia"),
        ctx.fs.where("processo", "==", selecao.processo)
      );
      const snapshot = await ctx.fs.getDocs(consulta);
      const documentos = snapshot.docs.filter(item => {
        const dados = item.data() || {};
        return setorNormalizadoPorProcesso(dados.processo, dados.setor) === selecao.setor;
      });

      if (!documentos.length) {
        toast("Nenhum valor foi encontrado para esse processo.", "erro");
        return;
      }

      const total = documentos.length;
      const primeira = window.confirm(
        `Excluir o processo ${selecao.processo} (${labelSetor(selecao.setor)}) e TODOS os ${total} valor(es) cadastrados?\n\nPagamentos históricos, OPs e movimentações NÃO serão apagados.`
      );
      if (!primeira) return;

      const digitado = window.prompt(
        `Confirmação final: digite exatamente o nome do processo para excluir ${total} valor(es):\n\n${selecao.processo}`,
        ""
      );
      if (normalizar(digitado) !== normalizar(selecao.processo)) {
        toast("Exclusão cancelada: o nome digitado não confere.", "erro");
        return;
      }

      if (botao) botao.textContent = `Excluindo ${total}...`;

      let batch = ctx.fs.writeBatch(ctx.db);
      let contador = 0;
      let apagados = 0;

      for (const item of documentos) {
        batch.delete(item.ref);
        contador += 1;
        apagados += 1;
        if (contador >= 400) {
          await batch.commit();
          batch = ctx.fs.writeBatch(ctx.db);
          contador = 0;
        }
      }
      if (contador > 0) await batch.commit();

      try {
        await ctx.fs.addDoc(ctx.fs.collection(ctx.db, "logsAlteracoes"), {
          acao: "processo_valores_excluido",
          tipoAlvo: "precosReferencia",
          alvoId: selecao.chave,
          detalhes: `${selecao.processo} | ${labelSetor(selecao.setor)} | ${apagados} valor(es) excluído(s)`,
          usuarioUid: admin.user.uid,
          usuarioNome: admin.perfil.nome || "",
          usuarioEmail: admin.perfil.email || admin.user.email || "",
          usuarioTipo: admin.perfil.tipo || "admin",
          criadoEm: ctx.fs.serverTimestamp()
        });
      } catch (errorLog) {
        console.warn("Não foi possível registrar o log da exclusão do processo.", errorLog);
      }

      atualizarInterfaceDepoisExcluir(selecao.chave, selecao.processo);
      toast(`Processo ${selecao.processo} excluído. ${apagados} valor(es) removido(s).`, "ok");
    } catch (error) {
      console.error("Erro ao excluir processo inteiro.", error);
      toast("Erro ao excluir o processo. Nenhuma exclusão adicional será tentada.", "erro");
    } finally {
      excluindo = false;
      if (botao) {
        botao.disabled = false;
        botao.textContent = "Excluir processo inteiro";
      }
    }
  }

  function instalar() {
    injetarEstilo();
    if (document.getElementById(BOX_ID)) return true;

    const editor = document.querySelector("#painelGerenciarValores .valor-processo-editor");
    if (!editor) return false;

    const box = document.createElement("div");
    box.id = BOX_ID;
    box.innerHTML = `
      <div class="cn195-texto">
        <strong>Excluir processo completo</strong>
        <span>Remove todas as referências e valores do processo selecionado. Histórico de pagamentos e movimentações é preservado.</span>
      </div>
      <button class="btn btn-danger" id="${BUTTON_ID}" type="button">Excluir processo inteiro</button>
    `;
    editor.insertAdjacentElement("afterend", box);
    document.getElementById(BUTTON_ID)?.addEventListener("click", excluirProcessoSelecionado);
    return true;
  }

  function iniciar() {
    instalar();
    const observer = new MutationObserver(() => instalar());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
