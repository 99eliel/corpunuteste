(() => {
  "use strict";

  const VERSION = "2026-08-26-pagamentos-detalhes-sutia-completo-257";
  const GUARD = "__CORPONU_PAGAMENTOS_DETALHES_SUTIA_COMPLETO_257__";
  const FB = "10.12.5";
  const MODAL_ID = "corponuPagamentoSutiaDetalhes257";
  const STYLE_ID = "corponuPagamentoSutiaDetalhes257Style";

  if (window[GUARD] === VERSION) return;
  window[GUARD] = VERSION;

  let firebasePromise = null;
  let observerTabela = null;
  let aplicandoBotoes = false;

  const texto = valor => String(valor ?? "").trim();
  const normalizar = valor => texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  const numero = valor => {
    const n = Number(valor ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  const moeda2 = valor => numero(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const moeda4 = valor => `R$ ${numero(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  })}`;
  const escapeHtml = valor => String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function processoSutiaCompleto(valor) {
    return normalizar(valor) === "SUTIA COMPLETO";
  }

  function injetarEstilos() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #pagamentos .pag257-info{
        width:34px;height:34px;min-width:34px;padding:0!important;
        display:inline-flex;align-items:center;justify-content:center;
        border:1px solid #c4b5fd!important;border-radius:9px!important;
        background:#f5f3ff!important;color:#5b21b6!important;
        font-size:18px!important;font-weight:900!important;line-height:1!important;
        vertical-align:middle;cursor:pointer;
      }
      #pagamentos .pag257-info:hover{background:#ede9fe!important;border-color:#8b5cf6!important}
      #${MODAL_ID}[hidden]{display:none!important}
      #${MODAL_ID}{position:fixed;inset:0;z-index:100200;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.48);backdrop-filter:blur(2px)}
      #${MODAL_ID} .pag257-card{width:min(720px,100%);max-height:min(820px,92vh);overflow:auto;border:1px solid #d8e2ee;border-radius:18px;background:#fff;box-shadow:0 28px 80px rgba(15,23,42,.32)}
      #${MODAL_ID} .pag257-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:19px 20px 16px;border-bottom:1px solid #e2e8f0;background:linear-gradient(180deg,#fff,#faf8ff)}
      #${MODAL_ID} .pag257-header h3{margin:0;color:#1e1b4b;font-size:19px}
      #${MODAL_ID} .pag257-header p{margin:4px 0 0;color:#64748b;font-size:12px;line-height:1.45}
      #${MODAL_ID} .pag257-fechar{width:36px;height:36px;flex:0 0 36px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#475569;font-size:20px;cursor:pointer}
      #${MODAL_ID} .pag257-body{padding:18px 20px 20px}
      #${MODAL_ID} .pag257-identidade{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:14px}
      #${MODAL_ID} .pag257-meta{padding:9px 10px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;min-width:0}
      #${MODAL_ID} .pag257-meta span{display:block;color:#64748b;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}
      #${MODAL_ID} .pag257-meta strong{display:block;margin-top:4px;color:#0f172a;font-size:13px;overflow-wrap:anywhere}
      #${MODAL_ID} .pag257-calculo{border:1px solid #ddd6fe;border-radius:14px;overflow:hidden}
      #${MODAL_ID} .pag257-calculo-titulo{padding:11px 13px;background:#f5f3ff;color:#5b21b6;font-size:12px;font-weight:900}
      #${MODAL_ID} .pag257-linha{display:grid;grid-template-columns:minmax(180px,1fr) minmax(180px,1.25fr) auto;gap:10px;align-items:center;padding:10px 13px;border-top:1px solid #ede9fe}
      #${MODAL_ID} .pag257-linha:first-of-type{border-top:0}
      #${MODAL_ID} .pag257-linha .nome{font-weight:850;color:#334155}
      #${MODAL_ID} .pag257-linha .situacao{color:#64748b;font-size:11px}
      #${MODAL_ID} .pag257-linha .valor{text-align:right;white-space:nowrap;font-weight:900;color:#0f172a}
      #${MODAL_ID} .pag257-linha.desconto .valor{color:#b45309}
      #${MODAL_ID} .pag257-linha.final{background:#f0fdf4}
      #${MODAL_ID} .pag257-linha.final .nome,#${MODAL_ID} .pag257-linha.final .valor{color:#166534;font-size:14px}
      #${MODAL_ID} .pag257-formula{margin-top:12px;padding:11px 12px;border:1px solid #c4b5fd;border-radius:11px;background:#faf8ff;color:#4c1d95;font-size:12px;font-weight:800;line-height:1.55}
      #${MODAL_ID} .pag257-totais{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}
      #${MODAL_ID} .pag257-total{padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff}
      #${MODAL_ID} .pag257-total span{display:block;color:#64748b;font-size:9px;font-weight:900;text-transform:uppercase}
      #${MODAL_ID} .pag257-total strong{display:block;margin-top:5px;color:#0f172a;font-size:15px}
      #${MODAL_ID} .pag257-total.destaque{border-color:#86efac;background:#f0fdf4}
      #${MODAL_ID} .pag257-total.destaque strong{color:#166534}
      #${MODAL_ID} .pag257-aviso{padding:12px;border:1px solid #fcd34d;border-radius:11px;background:#fffbeb;color:#92400e;font-size:12px;line-height:1.5}
      #${MODAL_ID} .pag257-carregando{padding:28px;text-align:center;color:#64748b;font-weight:800}
      @media(max-width:700px){
        #${MODAL_ID}{padding:10px;align-items:flex-end}
        #${MODAL_ID} .pag257-card{max-height:92vh;border-radius:16px 16px 10px 10px}
        #${MODAL_ID} .pag257-identidade,#${MODAL_ID} .pag257-totais{grid-template-columns:1fr 1fr}
        #${MODAL_ID} .pag257-linha{grid-template-columns:1fr auto}
        #${MODAL_ID} .pag257-linha .situacao{grid-column:1/-1;grid-row:2}
      }
    `;
    document.head.appendChild(style);
  }

  async function firebase() {
    if (firebasePromise) return firebasePromise;
    firebasePromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FB}/firebase-firestore.js`)
    ]).then(([appMod, fs]) => {
      if (!appMod.getApps().length) throw new Error("Firebase ainda não foi inicializado.");
      const app = appMod.getApp();
      return { fs, db: fs.getFirestore(app) };
    }).catch(error => {
      firebasePromise = null;
      throw error;
    });
    return firebasePromise;
  }

  function garantirModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.hidden = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "pag257Titulo");
    modal.innerHTML = `
      <div class="pag257-card">
        <div class="pag257-header">
          <div>
            <h3 id="pag257Titulo">Memória do pagamento — Sutiã Completo</h3>
            <p>Mostra exatamente os valores gravados quando este pagamento foi calculado.</p>
          </div>
          <button type="button" class="pag257-fechar" data-pag257-fechar aria-label="Fechar">×</button>
        </div>
        <div class="pag257-body" id="pag257Conteudo"><div class="pag257-carregando">Carregando memória do cálculo...</div></div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function extrairIdPagamento(linha) {
    if (!(linha instanceof HTMLElement)) return "";
    const botao = linha.querySelector('button[onclick*="alternarStatusEntregaPagamento"], button[onclick*="excluirEntregaPagamento"]');
    const onclick = texto(botao?.getAttribute("onclick"));
    const match = onclick.match(/(?:alternarStatusEntregaPagamento|excluirEntregaPagamento)\(['"]([^'"]+)['"]\)/);
    return match?.[1] || "";
  }

  function indicesTabela(tbody) {
    const tabela = tbody?.closest("table");
    const headers = [...(tabela?.querySelectorAll("thead th") || [])].map(th => normalizar(th.textContent));
    return {
      processo: headers.findIndex(item => item.includes("PROCESSO")),
      acoes: headers.findIndex(item => item.includes("ACOES"))
    };
  }

  function aplicarBotoesDetalhes() {
    if (aplicandoBotoes) return;
    const tbody = document.getElementById("listaEntregasPagamento");
    if (!tbody) return;
    aplicandoBotoes = true;
    try {
      const indices = indicesTabela(tbody);
      if (indices.processo < 0 || indices.acoes < 0) return;

      tbody.querySelectorAll("tr").forEach(linha => {
        if (!(linha instanceof HTMLTableRowElement)) return;
        const celulas = [...linha.children];
        const processo = texto(celulas[indices.processo]?.textContent);
        const acoes = celulas[indices.acoes];
        const existente = linha.querySelector(".pag257-info");

        if (!processoSutiaCompleto(processo)) {
          existente?.remove();
          return;
        }

        const id = extrairIdPagamento(linha);
        if (!id || !(acoes instanceof HTMLTableCellElement)) return;
        if (existente) {
          existente.dataset.pagamentoId = id;
          return;
        }

        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "btn btn-sm pag257-info";
        botao.dataset.pagamentoId = id;
        botao.textContent = "ⓘ";
        botao.title = "Ver como o valor do Sutiã Completo foi calculado";
        botao.setAttribute("aria-label", "Ver detalhes do cálculo deste pagamento");
        acoes.prepend(botao);
      });
    } finally {
      aplicandoBotoes = false;
    }
  }

  function instalarObserverTabela() {
    const tbody = document.getElementById("listaEntregasPagamento");
    if (!tbody) return false;
    observerTabela?.disconnect();
    observerTabela = new MutationObserver(() => queueMicrotask(aplicarBotoesDetalhes));
    observerTabela.observe(tbody, { childList: true, subtree: true });
    aplicarBotoesDetalhes();
    return true;
  }

  function memoriaDoPagamento(item, conferenciaMov = null) {
    const direta = item?.memoriaCalculoSutiaCompleto;
    if (direta && typeof direta === "object") {
      return { memoria: direta, origem: "pagamento" };
    }
    if (conferenciaMov && typeof conferenciaMov === "object" && Object.keys(conferenciaMov).length) {
      return { memoria: conferenciaMov, origem: "movimentacao" };
    }
    return { memoria: null, origem: "" };
  }

  function normalizarMemoria(item, memoria) {
    const m = memoria || {};
    const quantidade = numero(m.quantidade || item?.quantidade);
    const valorBase = numero(m.valorBase);
    const descontoLateral = numero(m.descontoLateral);
    const descontoBojo = numero(m.descontoBojo);
    const descontoFecho = numero(m.descontoFecho);
    const descontoPontoLuz = numero(m.descontoPontoLuz);
    const valorUnitario = numero(
      m.valorUnitarioFinal ??
      m.valorUnitarioCalculado ??
      item?.valorUnitarioCalculadoSutiaCompleto ??
      item?.valorUnitario
    );
    const subtotal = numero(
      item?.subtotalCalculadoSutiaCompleto ??
      item?.subtotal ??
      (quantidade * valorUnitario)
    );
    const descontoDefeito = numero(m.descontoDefeito ?? item?.descontoDefeito);
    const total = numero(
      m.totalFinal ??
      item?.totalCalculadoSutiaCompleto ??
      item?.total
    );

    return {
      valorBase,
      descontoLateral,
      descontoBojo,
      descontoFecho,
      descontoPontoLuz,
      lateralPronta: typeof m.lateralPronta === "boolean" ? m.lateralPronta : null,
      bojoPronto: typeof m.bojoPronto === "boolean" ? m.bojoPronto : null,
      fechoPronto: typeof m.fechoPronto === "boolean" ? m.fechoPronto : null,
      pontoLuzPronto: typeof m.pontoLuzPronto === "boolean" ? m.pontoLuzPronto : null,
      lateralDescontada: typeof m.lateralDescontada === "boolean" ? m.lateralDescontada : descontoLateral > 0,
      bojoDescontado: typeof m.bojoDescontado === "boolean" ? m.bojoDescontado : descontoBojo > 0,
      quantidade,
      valorUnitario,
      subtotal,
      descontoDefeito,
      total,
      versao: texto(m.versao || item?.calculoSutiaCompletoVersao)
    };
  }

  function situacaoComponente(nome, memoria, desconto) {
    if (desconto > 0) return `${nome} descontado do valor da facção`;
    if (nome === "Fecho" && memoria.fechoPronto === true) return "Fecho veio pronto — sem desconto";
    if (nome === "Ponto de luz" && memoria.pontoLuzPronto === true) return "Ponto de luz veio pronto — sem desconto";
    if (nome === "Lateral" && memoria.lateralDescontada === false) return "Lateral sem desconto aplicado";
    if (nome === "Bojo" && memoria.bojoDescontado === false) return "Bojo sem desconto aplicado";
    return "Sem desconto registrado";
  }

  function linhaCalculo(nome, situacao, desconto, classe = "") {
    return `
      <div class="pag257-linha ${desconto > 0 ? "desconto" : ""} ${classe}">
        <div class="nome">${escapeHtml(nome)}</div>
        <div class="situacao">${escapeHtml(situacao)}</div>
        <div class="valor">${desconto > 0 ? `− ${moeda4(desconto)}` : moeda4(0)}</div>
      </div>
    `;
  }

  function renderizarDetalhes(item, memoriaOriginal, origem = "pagamento") {
    const m = normalizarMemoria(item, memoriaOriginal);
    const possuiBaseHistorica = memoriaOriginal && Number.isFinite(Number(memoriaOriginal.valorBase));

    if (!memoriaOriginal || !possuiBaseHistorica) {
      return `
        <div class="pag257-identidade">
          <div class="pag257-meta"><span>OP</span><strong>${escapeHtml(item?.numeroOP || "-")}</strong></div>
          <div class="pag257-meta"><span>Referência</span><strong>${escapeHtml(item?.referencia || "-")}</strong></div>
          <div class="pag257-meta"><span>Facção</span><strong>${escapeHtml(item?.faccao || "-")}</strong></div>
          <div class="pag257-meta"><span>Total salvo</span><strong>${moeda2(item?.total)}</strong></div>
        </div>
        <div class="pag257-aviso"><strong>Memória detalhada não encontrada.</strong><br>Este lançamento foi criado por uma versão que não deixou a composição completa do cálculo salva no pagamento nem na movimentação. O valor final continua preservado, mas o sistema não vai inventar descontos que não estão registrados.</div>
      `;
    }

    const somaDescontos = m.descontoLateral + m.descontoBojo + m.descontoFecho + m.descontoPontoLuz;
    const subtotalFormula = m.subtotal || (m.valorUnitario * m.quantidade);
    const totalFormula = m.total || Math.max(subtotalFormula - m.descontoDefeito, 0);

    return `
      <div class="pag257-identidade">
        <div class="pag257-meta"><span>OP</span><strong>${escapeHtml(item?.numeroOP || "-")}</strong></div>
        <div class="pag257-meta"><span>Referência</span><strong>${escapeHtml(item?.referencia || m.referencia || "-")}</strong></div>
        <div class="pag257-meta"><span>Facção</span><strong>${escapeHtml(item?.faccao || "-")}</strong></div>
        <div class="pag257-meta"><span>Data</span><strong>${escapeHtml(item?.dataEntrega || "-")}</strong></div>
      </div>

      <div class="pag257-calculo">
        <div class="pag257-calculo-titulo">Composição por peça</div>
        <div class="pag257-linha">
          <div class="nome">Valor base do Sutiã Completo</div>
          <div class="situacao">Valor de partida registrado neste cálculo</div>
          <div class="valor">${moeda4(m.valorBase)}</div>
        </div>
        ${linhaCalculo("Lateral", situacaoComponente("Lateral", m, m.descontoLateral), m.descontoLateral)}
        ${linhaCalculo("Bojo", situacaoComponente("Bojo", m, m.descontoBojo), m.descontoBojo)}
        ${linhaCalculo("Fecho", situacaoComponente("Fecho", m, m.descontoFecho), m.descontoFecho)}
        ${linhaCalculo("Ponto de luz", situacaoComponente("Ponto de luz", m, m.descontoPontoLuz), m.descontoPontoLuz)}
        <div class="pag257-linha final">
          <div class="nome">Valor final por peça</div>
          <div class="situacao">Base menos os descontos acima</div>
          <div class="valor">${moeda4(m.valorUnitario)}</div>
        </div>
      </div>

      <div class="pag257-formula">
        ${moeda4(m.valorBase)} − ${moeda4(somaDescontos)} = <strong>${moeda4(m.valorUnitario)} por peça</strong><br>
        ${moeda4(m.valorUnitario)} × ${m.quantidade.toLocaleString("pt-BR")} peça(s) = ${moeda2(subtotalFormula)}${m.descontoDefeito > 0 ? ` • defeito − ${moeda2(m.descontoDefeito)}` : ""}
      </div>

      <div class="pag257-totais">
        <div class="pag257-total"><span>Quantidade</span><strong>${m.quantidade.toLocaleString("pt-BR")}</strong></div>
        <div class="pag257-total"><span>Subtotal</span><strong>${moeda2(subtotalFormula)}</strong></div>
        <div class="pag257-total"><span>Desconto defeito</span><strong>${m.descontoDefeito > 0 ? `− ${moeda2(m.descontoDefeito)}` : moeda2(0)}</strong></div>
        <div class="pag257-total destaque"><span>Total final</span><strong>${moeda2(totalFormula)}</strong></div>
      </div>

      <div style="margin-top:9px;color:#94a3b8;font-size:10px">Memória lida da ${origem === "movimentacao" ? "movimentação original" : "fotografia gravada no pagamento"}${m.versao ? ` • versão ${escapeHtml(m.versao)}` : ""}.</div>
    `;
  }

  async function carregarRegistroPagamento(id) {
    const ctx = await firebase();
    const snap = await ctx.fs.getDoc(ctx.fs.doc(ctx.db, "entregasPagamento", id));
    if (!snap.exists()) throw new Error("Pagamento não encontrado.");
    const item = { id: snap.id, ...snap.data() };

    let conferenciaMov = null;
    if (!item.memoriaCalculoSutiaCompleto && item.movimentacaoId) {
      const movSnap = await ctx.fs.getDoc(ctx.fs.doc(ctx.db, "movimentacoesProducao", item.movimentacaoId));
      if (movSnap.exists()) conferenciaMov = movSnap.data()?.sutiaCompletoConferencia || null;
    }

    return { item, ...memoriaDoPagamento(item, conferenciaMov) };
  }

  async function abrirDetalhes(id) {
    const modal = garantirModal();
    const conteudo = document.getElementById("pag257Conteudo");
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    if (conteudo) conteudo.innerHTML = '<div class="pag257-carregando">Carregando memória do cálculo...</div>';

    try {
      const { item, memoria, origem } = await carregarRegistroPagamento(id);
      if (!processoSutiaCompleto(item.processo || item.servicoNome || item.processoMovimentacao)) {
        throw new Error("Este lançamento não é de Sutiã Completo.");
      }
      if (conteudo) conteudo.innerHTML = renderizarDetalhes(item, memoria, origem);
    } catch (error) {
      console.error("[Pagamentos 257] Falha ao abrir memória do Sutiã Completo.", error);
      if (conteudo) conteudo.innerHTML = `<div class="pag257-aviso"><strong>Não foi possível abrir os detalhes.</strong><br>${escapeHtml(error?.message || "Atualize a tela e tente novamente.")}</div>`;
    }
  }

  function fecharModal() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) modal.hidden = true;
    document.body.style.overflow = "";
  }

  function iniciar() {
    injetarEstilos();
    garantirModal();
    aplicarBotoesDetalhes();
    if (!instalarObserverTabela()) {
      let tentativas = 0;
      const tentar = () => {
        tentativas += 1;
        if (instalarObserverTabela() || tentativas >= 20) return;
        window.setTimeout(tentar, 250);
      };
      tentar();
    }
    console.info(`[CorpoNu] Detalhes de pagamento do Sutiã Completo ativos: ${VERSION}`);
  }

  document.addEventListener("click", event => {
    const alvo = event.target instanceof Element ? event.target : null;
    const info = alvo?.closest?.(".pag257-info");
    if (info) {
      event.preventDefault();
      event.stopPropagation();
      const id = texto(info.dataset.pagamentoId);
      if (id) void abrirDetalhes(id);
      return;
    }
    if (alvo?.closest?.("[data-pag257-fechar]")) {
      fecharModal();
      return;
    }
    const modal = alvo?.closest?.(`#${MODAL_ID}`);
    if (modal && alvo === modal) fecharModal();
  }, true);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !document.getElementById(MODAL_ID)?.hidden) fecharModal();
  });

  window.CorpoNuPagamentosDetalhesSutiaCompleto = {
    versao: VERSION,
    aplicar: aplicarBotoesDetalhes,
    renderizarDetalhes,
    normalizarMemoria
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();
