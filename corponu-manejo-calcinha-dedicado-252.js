(() => {
  "use strict";

  const VERSION = "2026-08-25-manejo-calcinha-dedicado-252";
  const GUARD = "__CORPONU_MANEJO_CALCINHA_DEDICADO_252__";
  const ROOT_ID = "corponuManejoCalcinhaDedicado252";
  const STYLE_ID = "corponuManejoCalcinhaDedicado252Style";
  const DATALIST_ID = "corponuManejoCalcinhaFases252";
  const PAGE_SIZE = 80;

  if (window[GUARD] === VERSION) return;
  window[GUARD] = VERSION;

  const drafts = new Map();
  let limite = PAGE_SIZE;
  let renderAgendado = false;
  let salvando = new Set();

  const texto = valor => String(valor ?? "").trim();
  const normalizar = valor => texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  const escapeHtml = valor => String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function dual() {
    return window.corponuDualMode?.state || null;
  }

  function calcinhaAtiva() {
    const pagina = document.querySelector(".page.active")?.id || "";
    const tab = document.querySelector('#manejo .manejo-setor-btn.active[data-setor="calcinha"]');
    return pagina === "manejo" && Boolean(tab);
  }

  function tipoCalcinha(op) {
    if (!op) return false;
    const tipo = normalizar(op.tipoPeca || op.tipoPecaPadrao || op.setor || op.setorLabel);
    if (tipo.includes("CALCINHA")) return true;
    const processo = normalizar(op.processo || op.processoPlanejado || op.manejosSetores?.calcinha?.processo);
    if (processo.startsWith("CALCINHA")) return true;
    const descricao = normalizar([
      op.tipoPecaLabel,
      op.produtoNome,
      op.observacoes,
      op.pendencia
    ].join(" "));
    return descricao.includes("CALCINHA") || Boolean(op.manejosSetores?.calcinha);
  }

  function labelLinha(valor) {
    const v = normalizar(valor).replace(/\s+/g, "_");
    if (["COTTON_LINE", "COTTON__LINE"].includes(v)) return "Cotton Line";
    if (v === "CORPO_NU") return "Corpo Nu";
    return "";
  }

  function valorLinha(valor) {
    const label = labelLinha(valor);
    if (label === "Cotton Line") return "cotton_line";
    if (label === "Corpo Nu") return "corpo_nu";
    return "";
  }

  function manejo(op) {
    return op?.manejosSetores?.calcinha || {};
  }

  function necessidadeDaOp(op) {
    const m = manejo(op);
    if (op?.necessidadeManual === true) {
      return texto(op.necessidadeTexto ?? op.necessidade ?? "");
    }
    return texto(
      m.necessidadeTexto ??
      m.necessidade ??
      op?.necessidadeTexto ??
      op?.necessidade ??
      op?.necessidadeOriginal ??
      ""
    );
  }

  function valoresDaOp(op) {
    const m = manejo(op);
    const draft = drafts.get(String(op?.id || ""));
    return {
      linha: draft?.linha ?? valorLinha(m.linhaCalcinha || op?.linhaCalcinha || ""),
      fase: draft?.fase ?? texto(m.fase || op?.fase || op?.manejo?.fase || ""),
      necessidade: draft?.necessidade ?? necessidadeDaOp(op)
    };
  }

  function statusDaOp(op) {
    const m = manejo(op);
    return texto(op?.manejoStatusSetores?.calcinha || m.status || "pendente").toLowerCase();
  }

  function movimentoAtivo(opId) {
    const mapa = dual()?.maps?.movimentacoes;
    if (!(mapa instanceof Map)) return false;
    return [...mapa.values()].some(item => {
      if (String(item?.opId || "") !== String(opId || "")) return false;
      if (String(item?.tipoDestino || "") !== "faccao") return false;
      if (!tipoCalcinha(item)) return false;
      return !["finalizado", "retornou", "encaminhado"].includes(String(item?.status || "").toLowerCase());
    });
  }

  function ordensCalcinha() {
    const mapa = dual()?.maps?.ordens;
    if (!(mapa instanceof Map)) return [];
    return [...mapa.values()]
      .filter(op => op && !op.ocultarDoManejo && tipoCalcinha(op));
  }

  function numeroOrdenacao(op) {
    const n = Number(String(op?.numeroOP || "").replace(/\D/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function fasesDisponiveis(ordens) {
    const fases = new Map();
    const adicionar = valor => {
      const bruto = texto(valor);
      const chave = normalizar(bruto);
      if (bruto && chave && !fases.has(chave)) fases.set(chave, bruto);
    };

    ordens.forEach(op => adicionar(manejo(op).fase || op?.fase || op?.manejo?.fase));
    document.querySelectorAll("#manejoFasesList option").forEach(option => adicionar(option.value || option.textContent));
    try {
      const extras = JSON.parse(localStorage.getItem("fasesManejoExtras") || "[]");
      if (Array.isArray(extras)) extras.forEach(adicionar);
    } catch (_) {}

    return [...fases.values()].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  }

  function injetarEstilo() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body[data-corponu-calcinha-dedicado="1"] #manejo .manejo-inline-table{display:none!important}
      body[data-corponu-calcinha-dedicado="1"] #manejo #buscaManejoLinha{display:none!important}
      #${ROOT_ID}{display:none;margin-top:14px}
      body[data-corponu-calcinha-dedicado="1"] #${ROOT_ID}{display:block}
      #${ROOT_ID} *{box-sizing:border-box}
      #${ROOT_ID} .cn252-topo{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;margin-bottom:12px;padding:14px 16px;border:1px solid #ddd6fe;border-radius:12px;background:#faf8ff}
      #${ROOT_ID} .cn252-topo h4{margin:0 0 4px;font-size:16px;color:#1e1b4b}
      #${ROOT_ID} .cn252-topo p{margin:0;color:#64748b;font-size:12px;line-height:1.45}
      #${ROOT_ID} .cn252-contador{white-space:nowrap;padding:7px 10px;border-radius:999px;background:#ede9fe;color:#5b21b6;font-size:12px;font-weight:800}
      #${ROOT_ID} .cn252-filtros{display:grid;grid-template-columns:minmax(220px,2fr) minmax(145px,1fr) minmax(160px,1fr) auto;gap:8px;margin-bottom:12px}
      #${ROOT_ID} input,#${ROOT_ID} select{width:100%;min-height:38px;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;background:#fff;color:#0f172a;font:inherit}
      #${ROOT_ID} input:focus,#${ROOT_ID} select:focus{outline:2px solid rgba(124,58,237,.18);border-color:#7c3aed}
      #${ROOT_ID} button{font:inherit}
      #${ROOT_ID} .cn252-btn{min-height:38px;border:1px solid #cbd5e1;border-radius:8px;padding:8px 12px;background:#fff;color:#334155;font-weight:800;cursor:pointer}
      #${ROOT_ID} .cn252-btn:hover{background:#f8fafc}
      #${ROOT_ID} .cn252-btn.salvar{border-color:#16a34a;background:#16a34a;color:#fff}
      #${ROOT_ID} .cn252-btn.enviar{border-color:#7c3aed;background:#7c3aed;color:#fff}
      #${ROOT_ID} .cn252-btn:disabled{opacity:.58;cursor:not-allowed}
      #${ROOT_ID} .cn252-lista{display:grid;gap:9px}
      #${ROOT_ID} .cn252-op{display:grid;grid-template-columns:minmax(160px,1.15fr) 105px minmax(145px,1fr) minmax(170px,1.25fr) minmax(190px,1.5fr) minmax(160px,1fr) auto;gap:8px;align-items:center;padding:11px;border:1px solid #e2e8f0;border-radius:11px;background:#fff}
      #${ROOT_ID} .cn252-op:hover{border-color:#c4b5fd;box-shadow:0 3px 12px rgba(15,23,42,.05)}
      #${ROOT_ID} .cn252-ident strong{display:block;font-size:14px;color:#0f172a}
      #${ROOT_ID} .cn252-ident span,#${ROOT_ID} .cn252-destino span{display:block;margin-top:2px;color:#64748b;font-size:11px;line-height:1.35}
      #${ROOT_ID} .cn252-qtd{font-weight:900;text-align:center;color:#334155}
      #${ROOT_ID} .cn252-destino strong{display:block;font-size:12px;color:#334155}
      #${ROOT_ID} .cn252-acoes{display:flex;gap:6px;justify-content:flex-end}
      #${ROOT_ID} .cn252-status{display:inline-flex;margin-top:5px;padding:3px 7px;border-radius:999px;background:#f1f5f9;color:#475569;font-size:10px;font-weight:900;text-transform:uppercase}
      #${ROOT_ID} .cn252-status.bipado{background:#dcfce7;color:#166534}
      #${ROOT_ID} .cn252-status.pendente{background:#fef3c7;color:#92400e}
      #${ROOT_ID} .cn252-vazio{padding:28px 16px;text-align:center;border:1px dashed #cbd5e1;border-radius:11px;color:#64748b;background:#f8fafc}
      #${ROOT_ID} .cn252-mais{display:flex;justify-content:center;margin-top:12px}
      #${ROOT_ID} .cn252-msg{min-height:18px;margin-top:8px;color:#64748b;font-size:11px}
      #${ROOT_ID} .cn252-msg.ok{color:#15803d;font-weight:800}
      #${ROOT_ID} .cn252-msg.erro{color:#b91c1c;font-weight:800}
      @media (max-width:1180px){#${ROOT_ID} .cn252-op{grid-template-columns:1.2fr 85px 1fr 1fr 1.3fr}.cn252-destino{display:none!important}#${ROOT_ID} .cn252-acoes{grid-column:auto}}
      @media (max-width:820px){#${ROOT_ID} .cn252-filtros{grid-template-columns:1fr 1fr}#${ROOT_ID} .cn252-op{grid-template-columns:1fr 1fr}#${ROOT_ID} .cn252-ident{grid-column:1/-1}#${ROOT_ID} .cn252-qtd{text-align:left}#${ROOT_ID} .cn252-acoes{grid-column:1/-1;justify-content:stretch}#${ROOT_ID} .cn252-acoes .cn252-btn{flex:1}}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function garantirEstrutura() {
    const manejoPage = document.getElementById("manejo");
    const tabela = manejoPage?.querySelector(".manejo-inline-table");
    if (!manejoPage || !tabela) return null;

    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("section");
      root.id = ROOT_ID;
      root.setAttribute("aria-label", "Manejo Calcinha dedicado");
      const wrapperTabela = tabela.closest(".table-wrap") || tabela;
      wrapperTabela.parentElement?.insertBefore(root, wrapperTabela);
      root.innerHTML = `
        <div class="cn252-topo">
          <div>
            <h4>Manejo Calcinha</h4>
            <p>Tela própria da Calcinha. Linha, Fase e Necessidade são salvas diretamente na OP, sem depender da tabela do Sutiã.</p>
          </div>
          <span class="cn252-contador" id="cn252Contador">0 OPs</span>
        </div>
        <div class="cn252-filtros">
          <input id="cn252Busca" type="search" autocomplete="off" placeholder="Buscar OP, referência, cor, fase ou facção...">
          <select id="cn252FiltroLinha">
            <option value="">Todas as linhas</option>
            <option value="cotton_line">Cotton Line</option>
            <option value="corpo_nu">Corpo Nu</option>
            <option value="sem_linha">A definir</option>
          </select>
          <select id="cn252FiltroStatus">
            <option value="">Todos os status</option>
            <option value="pendente">Pendente</option>
            <option value="organizada">Organizada</option>
            <option value="bipado">Bipado</option>
          </select>
          <button type="button" class="cn252-btn" id="cn252Atualizar">Atualizar</button>
        </div>
        <datalist id="${DATALIST_ID}"></datalist>
        <div class="cn252-lista" id="cn252Lista"></div>
        <div class="cn252-mais" id="cn252MaisWrap"></div>
        <div class="cn252-msg" id="cn252Msg" aria-live="polite"></div>
      `;
      instalarEventosRoot(root);
    }
    return root;
  }

  function filtros() {
    return {
      busca: normalizar(document.getElementById("cn252Busca")?.value),
      linha: texto(document.getElementById("cn252FiltroLinha")?.value),
      status: texto(document.getElementById("cn252FiltroStatus")?.value)
    };
  }

  function filtrarOrdens(ordens) {
    const f = filtros();
    return ordens.filter(op => {
      const v = valoresDaOp(op);
      if (f.linha === "sem_linha" && v.linha) return false;
      if (f.linha && f.linha !== "sem_linha" && v.linha !== f.linha) return false;
      if (f.status && statusDaOp(op) !== f.status) return false;
      if (f.busca) {
        const palheiro = normalizar([
          op.numeroOP,
          op.referencia,
          op.cor,
          op.produtoNome,
          v.fase,
          v.necessidade,
          manejo(op).faccao,
          op.faccaoPlanejada,
          manejo(op).processo,
          op.processoPlanejado
        ].join(" "));
        if (!palheiro.includes(f.busca)) return false;
      }
      return true;
    }).sort((a, b) => numeroOrdenacao(b) - numeroOrdenacao(a));
  }

  function statusLabel(status) {
    const s = String(status || "pendente").toLowerCase();
    if (s === "bipado") return "Bipado";
    if (s === "organizada") return "Organizada";
    return "Pendente";
  }

  function montarOp(op) {
    const id = String(op.id || "");
    const v = valoresDaOp(op);
    const m = manejo(op);
    const status = statusDaOp(op);
    const processo = texto(m.processo || op.processoPlanejado || op.processo || "");
    const faccao = texto(m.faccao || op.faccaoPlanejada || op.destino || "");
    const emMovimento = movimentoAtivo(id);
    const ocupado = salvando.has(id);

    return `
      <article class="cn252-op" data-cn252-op="${escapeHtml(id)}">
        <div class="cn252-ident">
          <strong>OP ${escapeHtml(op.numeroOP || "-")}</strong>
          <span>REF ${escapeHtml(op.referencia || "-")} • ${escapeHtml(op.cor || "-")}</span>
          <span class="cn252-status ${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>
        </div>
        <div class="cn252-qtd">${Number(op.quantidade || 0).toLocaleString("pt-BR")}</div>
        <select data-campo="linha" aria-label="Linha da OP ${escapeHtml(op.numeroOP || "")}">
          <option value="">A definir</option>
          <option value="cotton_line" ${v.linha === "cotton_line" ? "selected" : ""}>Cotton Line</option>
          <option value="corpo_nu" ${v.linha === "corpo_nu" ? "selected" : ""}>Corpo Nu</option>
        </select>
        <input data-campo="fase" type="text" list="${DATALIST_ID}" autocomplete="off" value="${escapeHtml(v.fase)}" placeholder="Fase">
        <input data-campo="necessidade" type="text" autocomplete="off" value="${escapeHtml(v.necessidade)}" placeholder="Necessidade livre">
        <div class="cn252-destino">
          <strong>${escapeHtml(processo || "Destino ainda não definido")}</strong>
          <span>${escapeHtml(faccao || "Sem facção planejada")}</span>
        </div>
        <div class="cn252-acoes">
          <button type="button" class="cn252-btn salvar" data-acao="salvar" ${ocupado ? "disabled" : ""}>${ocupado ? "Salvando..." : "Salvar"}</button>
          <button type="button" class="cn252-btn enviar" data-acao="enviar" ${ocupado || emMovimento ? "disabled" : ""}>${emMovimento ? "Em facção" : "Enviar"}</button>
        </div>
      </article>
    `;
  }

  function render() {
    renderAgendado = false;
    injetarEstilo();
    const root = garantirEstrutura();
    if (!root) return;

    const ativa = calcinhaAtiva();
    document.body?.toggleAttribute("data-corponu-calcinha-dedicado", ativa);
    if (!ativa) return;
    if (document.body) document.body.dataset.corponuCalcinhaDedicado = "1";

    const todas = ordensCalcinha();
    const fases = fasesDisponiveis(todas);
    const datalist = document.getElementById(DATALIST_ID);
    if (datalist) datalist.innerHTML = fases.map(fase => `<option value="${escapeHtml(fase)}"></option>`).join("");

    const filtradas = filtrarOrdens(todas);
    const visiveis = filtradas.slice(0, limite);
    const lista = document.getElementById("cn252Lista");
    const contador = document.getElementById("cn252Contador");
    const maisWrap = document.getElementById("cn252MaisWrap");

    if (contador) contador.textContent = `${filtradas.length.toLocaleString("pt-BR")} OP${filtradas.length === 1 ? "" : "s"}`;
    if (lista) lista.innerHTML = visiveis.length
      ? visiveis.map(montarOp).join("")
      : '<div class="cn252-vazio">Nenhuma OP de Calcinha encontrada para estes filtros.</div>';

    if (maisWrap) {
      maisWrap.innerHTML = filtradas.length > visiveis.length
        ? `<button type="button" class="cn252-btn" data-acao="mais">Carregar mais (${(filtradas.length - visiveis.length).toLocaleString("pt-BR")})</button>`
        : "";
    }
  }

  function agendarRender() {
    if (renderAgendado) return;
    renderAgendado = true;
    requestAnimationFrame(render);
  }

  function coletarDraft(article) {
    if (!(article instanceof HTMLElement)) return null;
    const id = String(article.dataset.cn252Op || "");
    if (!id) return null;
    return {
      id,
      linha: valorLinha(article.querySelector('[data-campo="linha"]')?.value || ""),
      fase: texto(article.querySelector('[data-campo="fase"]')?.value),
      necessidade: texto(article.querySelector('[data-campo="necessidade"]')?.value)
    };
  }

  function registrarDraft(article) {
    const draft = coletarDraft(article);
    if (!draft) return;
    drafts.set(draft.id, {
      linha: draft.linha,
      fase: draft.fase,
      necessidade: draft.necessidade
    });
  }

  function mensagem(textoMsg, tipo = "") {
    const el = document.getElementById("cn252Msg");
    if (!el) return;
    el.textContent = textoMsg || "";
    el.className = `cn252-msg${tipo ? ` ${tipo}` : ""}`;
  }

  function sincronizarLinhaOculta(orderId, dados) {
    const id = String(orderId || "");
    const rows = [...document.querySelectorAll("#listaManejoInline tr[data-manejo-row='1']")];
    const row = rows.find(item => {
      const html = item.innerHTML || "";
      return html.includes(`salvarManejoLinha('${id}')`) || html.includes(`salvarManejoLinha(\"${id}\")`) || item.querySelector(`.corponu-manejo-line-select[data-order-id="${CSS.escape(id)}"]`);
    });
    if (!row) return;

    const fase = row.querySelector('input[id$="-fase"], select[id$="-fase"]');
    const necessidade = row.querySelector('input[id$="-necessidade"], textarea[id$="-necessidade"]');
    const linha = row.querySelector(`.corponu-manejo-line-select[data-order-id="${CSS.escape(id)}"], .corponu-manejo-line-select`);
    if (fase) fase.value = dados.fase;
    if (necessidade) necessidade.value = dados.necessidade;
    if (linha) linha.value = dados.linha;
  }

  async function salvar(orderId, options = {}) {
    const id = String(orderId || "");
    if (!id || salvando.has(id)) return false;
    const state = dual();
    const op = state?.maps?.ordens?.get(id);
    if (!state?.firebase || !state?.db || !op) {
      mensagem("Os dados da Calcinha ainda não terminaram de carregar.", "erro");
      return false;
    }

    const article = document.querySelector(`#${ROOT_ID} [data-cn252-op="${CSS.escape(id)}"]`);
    const dados = article ? coletarDraft(article) : { id, ...(drafts.get(id) || valoresDaOp(op)) };
    if (!dados) return false;

    const atual = manejo(op);
    const user = state.auth?.currentUser;
    if (!user) {
      mensagem("Sua sessão expirou. Entre novamente.", "erro");
      return false;
    }

    const statusAtual = statusDaOp(op);
    const novoStatus = statusAtual === "bipado"
      ? "bipado"
      : (dados.linha || dados.fase || dados.necessidade ? "organizada" : "pendente");

    salvando.add(id);
    const botaoSalvarAtual = article?.querySelector('[data-acao="salvar"]');
    if (!options.silencioso && botaoSalvarAtual) {
      botaoSalvarAtual.disabled = true;
      botaoSalvarAtual.textContent = "Salvando...";
    }
    mensagem(`Salvando OP ${op.numeroOP || ""}...`);

    try {
      const { doc, updateDoc, serverTimestamp } = state.firebase;
      const agora = serverTimestamp();
      const linhaLabel = labelLinha(dados.linha);
      await updateDoc(doc(state.db, "ordensProducao", id), {
        tipoPeca: "calcinha",
        tipoPecaPadrao: "calcinha",
        tipoPecaLabel: "Calcinha",
        linhaCalcinha: dados.linha,
        linhaCalcinhaLabel: linhaLabel,
        necessidade: dados.necessidade,
        necessidadeTexto: dados.necessidade,
        necessidadeManual: true,
        "manejosSetores.calcinha.linhaCalcinha": dados.linha,
        "manejosSetores.calcinha.linhaCalcinhaLabel": linhaLabel,
        "manejosSetores.calcinha.fase": dados.fase,
        "manejosSetores.calcinha.necessidade": dados.necessidade,
        "manejosSetores.calcinha.necessidadeTexto": dados.necessidade,
        "manejosSetores.calcinha.setor": "calcinha",
        "manejosSetores.calcinha.setorLabel": "Calcinha",
        "manejosSetores.calcinha.status": novoStatus,
        "manejosSetores.calcinha.atualizadoPor": user.uid,
        "manejosSetores.calcinha.atualizadoEm": agora,
        "manejoStatusSetores.calcinha": novoStatus,
        atualizadoPor: user.uid,
        atualizadoEm: agora
      });

      state.maps.ordens.set(id, {
        ...op,
        tipoPeca: "calcinha",
        tipoPecaPadrao: "calcinha",
        tipoPecaLabel: "Calcinha",
        linhaCalcinha: dados.linha,
        linhaCalcinhaLabel: linhaLabel,
        necessidade: dados.necessidade,
        necessidadeTexto: dados.necessidade,
        necessidadeManual: true,
        manejosSetores: {
          ...(op.manejosSetores || {}),
          calcinha: {
            ...atual,
            linhaCalcinha: dados.linha,
            linhaCalcinhaLabel: linhaLabel,
            fase: dados.fase,
            necessidade: dados.necessidade,
            necessidadeTexto: dados.necessidade,
            setor: "calcinha",
            setorLabel: "Calcinha",
            status: novoStatus,
            atualizadoPor: user.uid
          }
        },
        manejoStatusSetores: {
          ...(op.manejoStatusSetores || {}),
          calcinha: novoStatus
        },
        atualizadoPor: user.uid
      });

      drafts.delete(id);
      sincronizarLinhaOculta(id, dados);
      if (!options.silencioso && article) {
        const badge = article.querySelector(".cn252-status");
        if (badge) {
          badge.className = `cn252-status ${novoStatus}`;
          badge.textContent = statusLabel(novoStatus);
        }
      }
      if (!options.silencioso) mensagem(`OP ${op.numeroOP || ""} salva.`, "ok");
      return true;
    } catch (error) {
      console.error("[Calcinha 252] Falha ao salvar.", error);
      mensagem(`Não foi possível salvar a OP ${op.numeroOP || ""}.`, "erro");
      return false;
    } finally {
      salvando.delete(id);
      if (!options.silencioso && botaoSalvarAtual) {
        botaoSalvarAtual.disabled = false;
        botaoSalvarAtual.textContent = "Salvar";
      }
    }
  }

  async function enviar(orderId) {
    const id = String(orderId || "");
    const state = dual();
    const op = state?.maps?.ordens?.get(id);
    if (!op) return;

    const ok = await salvar(id, { silencioso: true });
    if (!ok) {
      mensagem("Corrija o salvamento antes de enviar a OP.", "erro");
      agendarRender();
      return;
    }

    const atualizada = state.maps.ordens.get(id);
    const dados = valoresDaOp(atualizada);
    sincronizarLinhaOculta(id, dados);

    if (!dados.linha) {
      mensagem(`Escolha Cotton Line ou Corpo Nu antes de enviar a OP ${op.numeroOP || ""}.`, "erro");
      agendarRender();
      return;
    }

    if (typeof window.mandarParaFaccao !== "function") {
      mensagem("O envio para facção ainda não terminou de carregar.", "erro");
      agendarRender();
      return;
    }

    mensagem(`Abrindo envio da OP ${op.numeroOP || ""}...`);
    try {
      await window.mandarParaFaccao(id);
      mensagem("", "");
    } catch (error) {
      console.error("[Calcinha 252] Falha ao iniciar envio.", error);
      mensagem("Não foi possível iniciar o envio para facção.", "erro");
    } finally {
      agendarRender();
    }
  }

  async function atualizar() {
    const state = dual();
    if (!window.corponuDualMode?.refresh || !state) {
      mensagem("Os dados ainda estão carregando.");
      return;
    }
    mensagem("Atualizando OPs da Calcinha...");
    try {
      await window.corponuDualMode.refresh();
      drafts.clear();
      limite = PAGE_SIZE;
      mensagem("Lista atualizada.", "ok");
    } catch (error) {
      console.error("[Calcinha 252] Falha ao atualizar.", error);
      mensagem("Não foi possível atualizar a lista.", "erro");
    } finally {
      agendarRender();
    }
  }

  function instalarEventosRoot(root) {
    root.addEventListener("input", event => {
      const campo = event.target?.closest?.("[data-campo]");
      if (!campo) {
        if (event.target?.id === "cn252Busca") {
          limite = PAGE_SIZE;
          agendarRender();
        }
        return;
      }
      const article = campo.closest("[data-cn252-op]");
      registrarDraft(article);
    });

    root.addEventListener("change", event => {
      const campo = event.target?.closest?.("[data-campo]");
      if (campo) {
        registrarDraft(campo.closest("[data-cn252-op]"));
        return;
      }
      if (["cn252FiltroLinha", "cn252FiltroStatus"].includes(event.target?.id)) {
        limite = PAGE_SIZE;
        agendarRender();
      }
    });

    root.addEventListener("click", event => {
      const botao = event.target?.closest?.("button[data-acao]");
      if (!botao) return;
      const acao = botao.dataset.acao;
      if (acao === "mais") {
        limite += PAGE_SIZE;
        agendarRender();
        return;
      }
      const article = botao.closest("[data-cn252-op]");
      const id = article?.dataset?.cn252Op || "";
      if (!id) return;
      registrarDraft(article);
      if (acao === "salvar") void salvar(id);
      if (acao === "enviar") void enviar(id);
    });

    root.querySelector("#cn252Atualizar")?.addEventListener("click", () => void atualizar());
  }

  function sincronizarModo() {
    injetarEstilo();
    garantirEstrutura();
    const ativa = calcinhaAtiva();
    if (document.body) {
      if (ativa) document.body.dataset.corponuCalcinhaDedicado = "1";
      else delete document.body.dataset.corponuCalcinhaDedicado;
    }
    if (ativa) agendarRender();
  }

  function instalarEventosGlobais() {
    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (!alvo?.closest?.('.manejo-setor-btn[data-setor], .nav-btn[data-page]')) return;
      queueMicrotask(sincronizarModo);
      requestAnimationFrame(sincronizarModo);
    }, true);

    document.addEventListener("corponu:dual-ready", sincronizarModo);
    window.addEventListener("pageshow", sincronizarModo);
  }

  function iniciar() {
    injetarEstilo();
    garantirEstrutura();
    instalarEventosGlobais();
    sincronizarModo();
    console.info(`[CorpoNu] Manejo Calcinha dedicado ativo: ${VERSION}`);
  }

  window.CorpoNuManejoCalcinhaDedicado = {
    versao: VERSION,
    render,
    salvar,
    atualizar,
    drafts
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();
