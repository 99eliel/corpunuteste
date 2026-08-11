(() => {
  "use strict";

  const VERSION = "2026-08-11-pendencias-motivo-171b";
  const FIREBASE_VERSION = "10.12.5";
  const MODAL_ID = "modalPendenciasValoresFinanceiro";
  const STYLE_ID = "corponuPendenciasMotivo171Style";

  if (window.__CORPONU_PENDENCIAS_MOTIVO_171__ === VERSION) return;
  window.__CORPONU_PENDENCIAS_MOTIVO_171__ = VERSION;

  let firebasePromise = null;
  let observer = null;
  let timer = 0;
  const pagamentosCache = new Map();

  const texto = valor => String(valor ?? "").trim();
  const normalizar = valor => texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  function injetarEstilos() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${MODAL_ID} .corponu-pendencia-motivo-171 {
        display:flex;align-items:flex-start;gap:8px;margin:8px 0 10px;padding:9px 11px;
        border:1px solid #f6c453;border-radius:10px;background:#fffbeb;color:#92400e;
        font-size:11px;font-weight:800;line-height:1.4;
      }
      #${MODAL_ID} .corponu-pendencia-motivo-171 strong { color:#78350f; }
    `;
    document.head.appendChild(style);
  }

  async function firebase() {
    if (firebasePromise) return firebasePromise;
    firebasePromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
    ]).then(([appMod, fs]) => {
      if (!appMod.getApps().length) throw new Error("Firebase ainda não inicializado.");
      return { fs, db: fs.getFirestore(appMod.getApp()) };
    }).catch(error => {
      firebasePromise = null;
      throw error;
    });
    return firebasePromise;
  }

  function idPagamentoDoItem(item) {
    const comDataId = item.querySelector("[data-id]");
    const dataId = texto(comDataId?.dataset?.id);
    if (dataId) return dataId;
    const input = item.querySelector('input[id^="valorPendencia-"]');
    const idInput = texto(input?.id);
    return idInput.startsWith("valorPendencia-") ? idInput.slice("valorPendencia-".length) : "";
  }

  async function obterPagamento(id) {
    if (!id) return null;
    if (pagamentosCache.has(id)) return pagamentosCache.get(id);
    const promessa = (async () => {
      const { fs, db } = await firebase();
      const ref = fs.doc(db, "entregasPagamento", id);
      let snap = null;
      try { snap = await fs.getDocFromCache(ref); } catch (_) {}
      if (!snap?.exists()) snap = await fs.getDoc(ref);
      return snap?.exists() ? { id: snap.id, ...snap.data() } : null;
    })().catch(error => {
      console.warn("[Pendências 171b] Motivo da pendência não carregado.", error);
      return null;
    });
    pagamentosCache.set(id, promessa);
    return promessa;
  }

  function faltantesDoPagamento(pagamento) {
    const memoria = pagamento?.memoriaCalculoSutiaCompleto?.faltantes;
    if (Array.isArray(memoria) && memoria.length) return memoria.map(texto).filter(Boolean);
    const aviso = texto(pagamento?.avisoPagamento);
    if (aviso) {
      const limpo = aviso.replace(/^Aguardando\s+/i, "").replace(/[.]$/, "").trim();
      if (limpo) return [limpo];
    }
    const observacao = texto(pagamento?.observacoes);
    const match = observacao.match(/aguardando(?:\s+valor)?\s*:\s*(.+?)(?:\.|$)/i);
    return match?.[1] ? [texto(match[1])] : [];
  }

  function motivosAmigaveis(pagamento) {
    const referencia = texto(pagamento?.referencia);
    const motivos = [];
    const adicionar = motivo => { if (motivo && !motivos.includes(motivo)) motivos.push(motivo); };
    faltantesDoPagamento(pagamento).forEach(faltante => {
      const chave = normalizar(faltante);
      if (chave.includes("DEFINICAO DA LATERAL")) return adicionar("Falta definir quem fez a LATERAL");
      if (chave.includes("DEFINICAO DO BOJO")) return adicionar("Falta definir quem fez o BOJO");
      if (chave.includes("LATERAL")) return adicionar(referencia ? `Falta valor da LATERAL — Ref. ${referencia}` : "Falta valor da LATERAL");
      if (chave.includes("ENCAPAR BOJO") || chave.includes("BOJO")) return adicionar(referencia ? `Falta valor do ENCAPAR BOJO — Ref. ${referencia}` : "Falta valor do ENCAPAR BOJO");
      adicionar(`Pendência: ${faltante}`);
    });
    return motivos;
  }

  function atualizarSituacao(item, motivos) {
    if (!motivos.length) return;
    const textoCurto = motivos.join(" • ");
    [...item.querySelectorAll("span, strong, div")]
      .filter(el => el.children.length === 0 && normalizar(el.textContent) === "AGUARDANDO VALOR")
      .forEach(el => {
        el.textContent = textoCurto;
        el.title = textoCurto;
      });
  }

  function inserirMotivo(item, motivos) {
    if (!motivos.length) return;
    const textoMotivo = motivos.join(" • ");
    let aviso = item.querySelector(":scope .corponu-pendencia-motivo-171");
    if (!aviso) {
      aviso = document.createElement("div");
      aviso.className = "corponu-pendencia-motivo-171";
      const conteudo = item.firstElementChild instanceof HTMLElement ? item.firstElementChild : item;
      const cabecalho = conteudo.querySelector(".corponu-pendencia-cabecalho");
      if (cabecalho) cabecalho.insertAdjacentElement("afterend", aviso);
      else conteudo.prepend(aviso);
    }
    if (aviso.dataset.motivo === textoMotivo) return;
    aviso.dataset.motivo = textoMotivo;
    aviso.innerHTML = `<span aria-hidden="true">⚠</span><span><strong>Motivo da pendência:</strong> ${textoMotivo}</span>`;
  }

  async function processarItem(item) {
    if (!(item instanceof HTMLElement)) return;
    const id = idPagamentoDoItem(item);
    if (!id) return;
    const pagamento = await obterPagamento(id);
    if (!pagamento) return;
    const motivos = motivosAmigaveis(pagamento);
    if (!motivos.length) return;
    inserirMotivo(item, motivos);
    atualizarSituacao(item, motivos);
    item.dataset.motivoPendencia171 = motivos.join(" | ");
  }

  async function processar() {
    const modal = document.getElementById(MODAL_ID);
    if (!(modal instanceof HTMLElement)) return;
    await Promise.all([...modal.querySelectorAll(".corponu-pendencia-item")].map(processarItem));
  }

  function agendar() {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => processar().catch(() => {}), 60);
  }

  function observarModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!(modal instanceof HTMLElement)) return false;
    if (!observer) {
      observer = new MutationObserver(agendar);
      observer.observe(modal, { childList: true, subtree: true });
    }
    agendar();
    return true;
  }

  function iniciar() {
    injetarEstilos();
    observarModal();
    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target.closest("button, a") : null;
      if (!alvo) return;
      const chave = normalizar(`${alvo.id} ${alvo.textContent}`);
      if (chave.includes("PENDENCIA") || chave.includes("ATUALIZAR LISTA")) {
        [0, 80, 220, 500].forEach(atraso => window.setTimeout(() => { observarModal(); agendar(); }, atraso));
      }
    }, true);
    let tentativas = 0;
    const intervalo = window.setInterval(() => {
      tentativas += 1;
      if (observarModal() || tentativas >= 30) window.clearInterval(intervalo);
    }, 250);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();
