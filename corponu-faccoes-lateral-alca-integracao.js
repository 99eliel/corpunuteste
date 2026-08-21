(() => {
  "use strict";

  const VERSION = "2026-08-18-lateral-alca-sob-demanda-211";
  const FIREBASE_VERSION = "10.12.5";
  const VALOR_FILTRO_ALCA = "__CORPONU_ALCA__";
  const CACHE_MS = 12000;

  if (window.__CORPONU_FACCOES_LATERAL_ALCA__ === VERSION) return;
  window.__CORPONU_FACCOES_LATERAL_ALCA__ = VERSION;

  let firebasePromise = null;
  let cache = { expiraEm: 0, movimentos: [] };
  let carregando = null;
  let renderizandoExtras = false;
  let timerRender = 0;
  let observerTabela = null;

  const texto = valor => String(valor ?? "").trim();
  const normalizar = valor => texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  const numero = valor => {
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
    const bruto = texto(valor);
    if (!bruto) return 0;
    const convertido = Number(bruto.includes(",")
      ? bruto.replace(/\./g, "").replace(",", ".")
      : bruto);
    return Number.isFinite(convertido) ? convertido : 0;
  };

  const escapar = valor => String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function processoCanonico(valor) {
    const chave = normalizar(valor);
    if (["ALCA", "ALCAS"].includes(chave)) return "ALÇA";
    if (chave === "LATERAL") return "LATERAL";
    return texto(valor).toUpperCase();
  }

  function processoEhLateralAlca(valor) {
    const processo = processoCanonico(valor);
    return processo === "LATERAL" || processo === "ALÇA";
  }

  function painelLateralAtivo() {
    return Boolean(
      document.getElementById("faccoes")?.classList.contains("active") &&
      document.getElementById("abaFaccaoCorte")?.classList.contains("active")
    );
  }

  function movimentoCancelado(item) {
    const status = normalizar(item?.status || item?.statusMovimentacao || "");
    return item?.cancelado === true || item?.excluido === true || [
      "CANCELADO", "CANCELADA", "EXCLUIDO", "EXCLUIDA"
    ].includes(status);
  }

  function pertenceLateralAlca(item) {
    const processo = processoCanonico(item?.processo || item?.servicoNome || item?.processoMovimentacao);
    return item?.area === "corte" || item?.movimentacaoCorte === true ||
      processo === "LATERAL" || processo === "ALÇA";
  }

  function jaCarregadoPeloPainelLateral(item) {
    return item?.area === "corte" || item?.movimentacaoCorte === true;
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

  async function consultarMovimentos(forcar = false) {
    if (!forcar && cache.expiraEm > Date.now()) return cache.movimentos;
    if (carregando) return carregando;

    carregando = (async () => {
      const { fs, db } = await firebase();
      const colecao = fs.collection(db, "movimentacoesProducao");
      const consultas = [
        fs.query(colecao, fs.where("area", "==", "corte")),
        fs.query(colecao, fs.where("movimentacaoCorte", "==", true)),
        fs.query(colecao, fs.where("processo", "in", ["LATERAL", "ALÇA", "ALCA", "ALÇAS"]))
      ];

      const mapa = new Map();
      await Promise.all(consultas.map(async consulta => {
        try {
          const snap = await fs.getDocs(consulta);
          snap.docs.forEach(docSnap => {
            const item = { id: docSnap.id, ...docSnap.data() };
            if (pertenceLateralAlca(item)) mapa.set(item.id, item);
          });
        } catch (error) {
          console.warn("Uma consulta de Lateral e Alça não pôde ser executada.", error);
        }
      }));

      const movimentos = [...mapa.values()].sort((a, b) => {
        const ta = a.atualizadoEm?.toMillis?.() || a.criadoEm?.toMillis?.() || Date.parse(a.dataChegada || a.dataEnvio || "") || 0;
        const tb = b.atualizadoEm?.toMillis?.() || b.criadoEm?.toMillis?.() || Date.parse(b.dataChegada || b.dataEnvio || "") || 0;
        return tb - ta;
      });

      cache = { expiraEm: Date.now() + CACHE_MS, movimentos };
      return movimentos;
    })().finally(() => {
      carregando = null;
    });

    return carregando;
  }

  function corrigirNomeAba() {
    const botao = document.getElementById("abaFaccaoCorte");
    if (botao) {
      const contador = botao.querySelector("#contCorte");
      let noTexto = [...botao.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
      if (!noTexto) {
        noTexto = document.createTextNode("Lateral e Alça ");
        botao.insertBefore(noTexto, contador || botao.firstChild);
      } else if (texto(noTexto.nodeValue) !== "Lateral e Alça") {
        noTexto.nodeValue = "Lateral e Alça ";
      }
    }

    const titulo = document.querySelector("#painelFaccoesCorte .panel-header h3");
    if (titulo && titulo.textContent !== "Lateral e Alça") titulo.textContent = "Lateral e Alça";

    const subtitulo = document.querySelector("#painelFaccoesCorte .panel-header p");
    if (subtitulo) subtitulo.textContent = "Acompanhe saídas e chegadas dos processos de Lateral e Alça.";
  }

  function garantirProcessosChegadaManual() {
    const datalist = document.getElementById("chegadaManualProcessoList");
    if (!(datalist instanceof HTMLDataListElement)) return;
    ["LATERAL", "ALÇA"].forEach(processo => {
      const existe = [...datalist.options].some(option => normalizar(option.value) === normalizar(processo));
      if (!existe) {
        const option = document.createElement("option");
        option.value = processo;
        datalist.appendChild(option);
      }
    });
  }

  function garantirBotaoChegadaManual() {
    const toolbar = document.querySelector("#painelFaccoesCorte .corte-toolbar");
    if (!toolbar || document.getElementById("btnChegadaManualLateralAlca")) return;

    const botao = document.createElement("button");
    botao.id = "btnChegadaManualLateralAlca";
    botao.type = "button";
    botao.className = "btn btn-success";
    botao.textContent = "Chegada manual";

    const chegadaNormal = document.getElementById("btnCorteRegistrarChegada");
    if (chegadaNormal?.parentElement === toolbar) chegadaNormal.insertAdjacentElement("afterend", botao);
    else toolbar.insertBefore(botao, toolbar.firstChild);
  }

  function dataBR(valor) {
    const data = texto(valor);
    const match = data.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : (data || "-");
  }

  function statusDoMovimento(item) {
    if (movimentoCancelado(item)) return "cancelado";
    const status = normalizar(item?.status);
    if (item?.dataChegada || ["RETORNOU", "FINALIZADO", "FINALIZADA"].includes(status)) return "retornou";
    return "em_andamento";
  }

  function passaFiltros(item) {
    const busca = normalizar(document.getElementById("corteBusca")?.value);
    const processoFiltro = document.getElementById("corteFiltroProcesso")?.value || "";
    const faccao = document.getElementById("corteFiltroFaccao")?.value || "";
    const status = document.getElementById("corteFiltroStatus")?.value || "";
    const lateral = document.getElementById("corteFiltroLateral")?.value || "";
    const inicio = document.getElementById("corteFiltroInicio")?.value || "";
    const fim = document.getElementById("corteFiltroFim")?.value || "";
    const processo = processoCanonico(item?.processo);

    if (busca && !normalizar([
      item?.numeroOP, item?.referencia, item?.cor, processo, item?.destino, item?.status
    ].join(" ")).includes(busca)) return false;

    if (processoFiltro) {
      if (processoFiltro === VALOR_FILTRO_ALCA) {
        if (processo !== "ALÇA") return false;
      } else {
        return false;
      }
    }

    if (faccao && texto(item?.destino) !== faccao) return false;
    if (status && statusDoMovimento(item) !== status) return false;
    if (lateral) return false;

    const data = texto(item?.dataChegada || item?.dataEnvio);
    if (inicio && data && data < inicio) return false;
    if (fim && data && data > fim) return false;
    return true;
  }

  function garantirOpcaoAlcaFiltro() {
    const select = document.getElementById("corteFiltroProcesso");
    if (!(select instanceof HTMLSelectElement)) return;
    if (![...select.options].some(option => option.value === VALOR_FILTRO_ALCA)) {
      const option = document.createElement("option");
      option.value = VALOR_FILTRO_ALCA;
      option.textContent = "ALÇA";
      select.appendChild(option);
    }
  }

  function linhaExtra(item) {
    const processo = processoCanonico(item?.processo);
    const status = statusDoMovimento(item);
    const chegou = status === "retornou";
    const badge = status === "cancelado"
      ? '<span class="corte-pill cancelado">Cancelada</span>'
      : chegou
        ? '<span class="corte-pill retornou">Retornou</span>'
        : '<span class="corte-pill andamento">Em andamento</span>';
    const componente = processo === "ALÇA"
      ? '<span class="corte-pill lateral">Alça</span>'
      : (chegou ? '<span class="corte-pill lateral">Lateral pronta</span>' : '<span class="corte-pill lateral">Lateral</span>');
    const acao = status === "em_andamento"
      ? `<button class="btn btn-sm btn-success" type="button" data-chegada-lateral-alca="${escapar(item.id)}">Registrar chegada</button>`
      : "-";

    return `<tr data-lateral-alca-extra="1" data-movimentacao-id="${escapar(item.id)}">
      <td><strong>${escapar(item.numeroOP || "-")}</strong></td>
      <td>${escapar(item.referencia || "-")}</td>
      <td>${escapar(item.cor || "-")}</td>
      <td>${escapar(processo || "-")}</td>
      <td>${escapar(item.destino || item.faccao || "-")}</td>
      <td>${numero(item.quantidadeEnviada).toLocaleString("pt-BR")}</td>
      <td>${escapar(dataBR(item.dataEnvio))}</td>
      <td>${escapar(dataBR(item.dataChegada))}</td>
      <td>${numero(item.falta).toLocaleString("pt-BR")}</td>
      <td>${badge}</td>
      <td>${componente}</td>
      <td><div class="corte-actions">${acao}</div></td>
    </tr>`;
  }

  function atualizarContador(movimentos) {
    const total = movimentos.filter(item => !movimentoCancelado(item)).length;
    const contador = document.getElementById("contCorte");
    if (contador) contador.textContent = total.toLocaleString("pt-BR");
  }

  async function renderizar(forcar = false) {
    // Esta integração não consulta mais o Firestore enquanto a aba estiver oculta.
    // Isso evita leituras e processamento concorrendo com cadastro de OP e outras facções.
    if (!painelLateralAtivo()) return;

    corrigirNomeAba();
    garantirBotaoChegadaManual();
    garantirProcessosChegadaManual();

    const movimentos = await consultarMovimentos(forcar).catch(error => {
      console.warn("Não foi possível atualizar Lateral e Alça.", error);
      return cache.movimentos || [];
    });
    atualizarContador(movimentos);

    const tbody = document.getElementById("listaFaccoesCorte");
    if (!(tbody instanceof HTMLTableSectionElement)) return;

    garantirOpcaoAlcaFiltro();
    renderizandoExtras = true;
    try {
      tbody.querySelectorAll('[data-lateral-alca-extra="1"]').forEach(row => row.remove());
      const extras = movimentos
        .filter(item => !jaCarregadoPeloPainelLateral(item))
        .filter(item => passaFiltros(item));

      if (extras.length) {
        tbody.querySelectorAll("tr .corte-empty").forEach(cell => cell.closest("tr")?.remove());
        tbody.insertAdjacentHTML("beforeend", extras.map(linhaExtra).join(""));
      } else {
        const vazio = tbody.querySelector(".corte-empty");
        if (vazio) vazio.textContent = "Nenhuma movimentação de Lateral ou Alça encontrada.";
      }
    } finally {
      renderizandoExtras = false;
    }

    observarTabela();
  }

  function agendarRender(forcar = false, atraso = 90) {
    window.clearTimeout(timerRender);
    timerRender = window.setTimeout(() => renderizar(forcar), atraso);
  }

  function observarTabela() {
    const tbody = document.getElementById("listaFaccoesCorte");
    if (!(tbody instanceof HTMLTableSectionElement)) return;
    if (observerTabela?.__alvo === tbody) return;
    observerTabela?.disconnect();

    observerTabela = new MutationObserver(mutations => {
      if (renderizandoExtras || !painelLateralAtivo()) return;
      const alteracaoBase = mutations.some(mutation =>
        [...mutation.addedNodes].some(node => !(node instanceof HTMLElement) || node.dataset?.lateralAlcaExtra !== "1")
      );
      if (alteracaoBase) agendarRender(false, 80);
    });
    observerTabela.__alvo = tbody;
    observerTabela.observe(tbody, { childList: true });
  }

  function abrirChegadaOriginal(id) {
    if (typeof window.registrarChegadaMovimentacao === "function") {
      window.registrarChegadaMovimentacao(id);
      return;
    }

    const botaoOriginal = [...document.querySelectorAll("button[onclick]")].find(botao => {
      const codigo = botao.getAttribute("onclick") || "";
      return codigo.includes("registrarChegadaMovimentacao") && codigo.includes(id);
    });
    if (botaoOriginal instanceof HTMLButtonElement) botaoOriginal.click();
  }

  function instalarEventos() {
    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (!alvo) return;

      const chegada = alvo.closest("[data-chegada-lateral-alca]");
      if (chegada) {
        event.preventDefault();
        event.stopImmediatePropagation();
        abrirChegadaOriginal(chegada.getAttribute("data-chegada-lateral-alca") || "");
        return;
      }

      if (alvo.closest("#btnChegadaManualLateralAlca")) {
        event.preventDefault();
        garantirProcessosChegadaManual();
        document.getElementById("btnAbrirChegadaManualFaccao")?.click();
        window.setTimeout(garantirProcessosChegadaManual, 120);
        return;
      }

      if (alvo.closest("#abaFaccaoCorte")) {
        cache.expiraEm = 0;
        agendarRender(true, 350);
        return;
      }

      if (alvo.closest("#btnCorteAtualizar")) {
        cache.expiraEm = 0;
        agendarRender(true, 250);
        return;
      }

      if (alvo.closest("#btnAtualizarServidor") && painelLateralAtivo()) {
        cache.expiraEm = 0;
        agendarRender(true, 250);
      }
    }, true);

    ["input", "change"].forEach(tipo => {
      document.addEventListener(tipo, event => {
        const alvo = event.target;
        if (!(alvo instanceof HTMLInputElement || alvo instanceof HTMLSelectElement)) return;
        if ([
          "corteBusca", "corteFiltroProcesso", "corteFiltroFaccao", "corteFiltroStatus",
          "corteFiltroLateral", "corteFiltroInicio", "corteFiltroFim"
        ].includes(alvo.id)) {
          agendarRender(false, 100);
        }
      }, true);
    });

    document.addEventListener("submit", event => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      if (form.id === "formChegadaManualFaccao") {
        const processo = document.getElementById("chegadaManualProcesso")?.value;
        if (!processoEhLateralAlca(processo)) return;

        cache.expiraEm = 0;
        window.setTimeout(() => agendarRender(true, 0), 1200);
        return;
      }

      if (form.id === "s3form") {
        const processo = document.getElementById("s3processo")?.value;
        if (!processoEhLateralAlca(processo)) return;

        cache.expiraEm = 0;
        window.setTimeout(() => agendarRender(true, 0), 1000);
        return;
      }

      if (form.id === "formChegadaMovimentacao" && painelLateralAtivo()) {
        cache.expiraEm = 0;
        window.setTimeout(() => agendarRender(true, 0), 1000);
      }
    }, true);

    window.addEventListener("focus", () => {
      if (painelLateralAtivo()) agendarRender(false, 180);
    });
    window.addEventListener("pageshow", () => {
      if (painelLateralAtivo()) agendarRender(true, 250);
    });
  }

  function iniciar() {
    instalarEventos();
    let tentativas = 0;
    const timer = window.setInterval(() => {
      tentativas += 1;
      corrigirNomeAba();
      garantirBotaoChegadaManual();
      garantirProcessosChegadaManual();
      observarTabela();
      if (painelLateralAtivo()) agendarRender(tentativas === 1, 0);
      if (tentativas >= 50 || document.getElementById("abaFaccaoCorte")) window.clearInterval(timer);
    }, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();