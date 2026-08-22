(() => {
  "use strict";

  const VERSION = "2026-08-21-chegada-manual-trava-precheck-270";
  const FIREBASE_VERSION = "10.12.5";
  const FORM_ID = "formChegadaManualFaccao";
  const MARCADOR_LIBERADO = "cnChegadaManualMov86Liberada";
  const MARCADOR_SUBMIT_FINAL = "sc107ReenvioSubmit";

  if (window.__CORPONU_CHEGADA_MANUAL_TRAVA_MOVIMENTACAO__ === VERSION) return;
  window.__CORPONU_CHEGADA_MANUAL_TRAVA_MOVIMENTACAO__ = VERSION;

  let contextoPromise = null;
  const operacoesEmCurso = new Set();

  const texto = valor => String(valor ?? "").trim();
  const normalizar = valor => texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  function avisar(mensagem) {
    const toast = document.getElementById("toast");
    if (!toast) {
      window.alert(mensagem);
      return;
    }

    toast.textContent = mensagem;
    toast.classList.remove("hidden");
    toast.style.background = "#991b1b";
    window.clearTimeout(window.__cnChegadaManualMov86Toast);
    window.__cnChegadaManualMov86Toast = window.setTimeout(() => {
      toast.classList.add("hidden");
      toast.style.background = "";
    }, 7000);
  }

  async function contextoFirebase() {
    if (contextoPromise) return contextoPromise;

    contextoPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
    ]).then(([appModulo, firestore]) => {
      if (!appModulo.getApps().length) throw new Error("Firebase ainda não inicializado.");
      return {
        db: firestore.getFirestore(appModulo.getApp()),
        firestore
      };
    }).catch(error => {
      contextoPromise = null;
      throw error;
    });

    return contextoPromise;
  }

  function extrairNumeroOP(valor) {
    return texto(texto(valor).split(" - ")[0]).replace(/^OP\s*/i, "");
  }

  function variantesNumeroOP(numeroOP) {
    const bruto = extrairNumeroOP(numeroOP);
    const variantes = [bruto];
    const numero = Number(bruto);
    if (bruto && Number.isFinite(numero)) variantes.push(numero);

    const vistas = new Set();
    return variantes.filter(valor => {
      const chave = `${typeof valor}:${String(valor)}`;
      if (!valor || vistas.has(chave)) return false;
      vistas.add(chave);
      return true;
    });
  }

  async function consultar(colecao, campo, valores, limite = 50) {
    const { db, firestore } = await contextoFirebase();
    const documentos = new Map();

    for (const valor of valores) {
      const consulta = firestore.query(
        firestore.collection(db, colecao),
        firestore.where(campo, "==", valor),
        firestore.limit(limite)
      );
      const snapshot = await firestore.getDocs(consulta);
      snapshot.docs.forEach(documento => {
        documentos.set(documento.id, { id: documento.id, ...documento.data() });
      });
    }

    return [...documentos.values()];
  }

  function movimentacaoValida(movimento) {
    const status = normalizar(movimento?.status || "");
    const tipo = normalizar(movimento?.tipoDestino || movimento?.tipoDestinoLabel || "");

    if (movimento?.excluido === true || movimento?.cancelado === true) return false;
    if (["CANCELADO", "CANCELADA", "EXCLUIDO", "EXCLUIDA"].includes(status)) return false;
    return !tipo || tipo.includes("FACCAO");
  }

  async function buscarMovimentacoesDaOP(numeroOP) {
    const variantes = variantesNumeroOP(numeroOP);
    const documentos = new Map();
    const adicionar = itens => itens.forEach(item => documentos.set(item.id, item));

    adicionar(await consultar("movimentacoesProducao", "numeroOP", variantes));

    if (!documentos.size) adicionar(await consultar("movimentacoesProducao", "numeroOPExterno", variantes));
    if (!documentos.size) adicionar(await consultar("movimentacoesProducao", "op", variantes));

    if (!documentos.size) {
      const ordens = new Map();
      for (const campo of ["numeroOP", "numeroOPExterno", "op"]) {
        const encontradas = await consultar("ordensProducao", campo, variantes, 5);
        encontradas.forEach(ordem => ordens.set(ordem.id, ordem));
      }
      for (const ordemId of ordens.keys()) adicionar(await consultar("movimentacoesProducao", "opId", [ordemId]));
    }

    return [...documentos.values()].filter(movimentacaoValida);
  }

  function encontrarCorrespondente(movimentacoes, processo, faccao) {
    return movimentacoes.find(movimento =>
      normalizar(movimento.processo || movimento.servicoNome || "") === processo &&
      normalizar(movimento.destino || movimento.faccao || "") === faccao
    ) || null;
  }

  function dataParaBR(dataISO) {
    const partes = texto(dataISO).split("-");
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : texto(dataISO);
  }

  function bloquearBotao(form) {
    const botao = form.querySelector('button[type="submit"]');
    if (!botao) return () => {};

    const textoOriginal = botao.textContent;
    const estadoOriginal = botao.disabled;
    botao.disabled = true;
    botao.textContent = "Conferindo movimentações...";

    return () => {
      botao.disabled = estadoOriginal;
      botao.textContent = textoOriginal;
    };
  }

  function liberarFormulario(form) {
    form.dataset[MARCADOR_LIBERADO] = "1";
    form.requestSubmit();
  }

  document.addEventListener("submit", event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== FORM_ID) return;

    // O cálculo base já validou/confirmou o Sutiã e marcou este submit como final.
    // Não repetimos consultas antes da gravação atômica.
    if (form.dataset[MARCADOR_SUBMIT_FINAL] === "1") return;

    if (form.dataset[MARCADOR_LIBERADO] === "1") {
      delete form.dataset[MARCADOR_LIBERADO];
      return;
    }

    const numeroOP = extrairNumeroOP(document.getElementById("chegadaManualOP")?.value);
    const processo = normalizar(document.getElementById("chegadaManualProcesso")?.value);
    const faccao = normalizar(document.getElementById("chegadaManualFaccao")?.value);

    if (!numeroOP || !processo || !faccao) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const chave = `${numeroOP}|${processo}|${faccao}`;
    if (operacoesEmCurso.has(chave)) {
      avisar("Esta chegada manual já está sendo conferida. Aguarde.");
      return;
    }

    operacoesEmCurso.add(chave);
    const restaurar = bloquearBotao(form);

    buscarMovimentacoesDaOP(numeroOP)
      .then(movimentacoes => {
        const existente = encontrarCorrespondente(movimentacoes, processo, faccao);

        if (!existente) {
          restaurar();
          operacoesEmCurso.delete(chave);
          liberarFormulario(form);
          return;
        }

        const nomeFaccao = texto(existente.destino || existente.faccao || faccao);
        const nomeProcesso = texto(existente.processo || processo);

        if (existente.dataChegada) {
          const data = dataParaBR(existente.dataChegada);
          avisar(`Esta OP já possui uma chegada registrada para ${nomeFaccao} no processo ${nomeProcesso}${data ? ` em ${data}` : ""}. O lançamento manual foi bloqueado.`);
        } else {
          avisar(`Esta OP já possui uma saída registrada para ${nomeFaccao} no processo ${nomeProcesso}. Use o botão Chegada da movimentação existente.`);
        }

        restaurar();
        operacoesEmCurso.delete(chave);
      })
      .catch(error => {
        console.error("Erro ao conferir movimentações antes da chegada manual.", error);
        avisar("Não foi possível conferir as movimentações da OP. A chegada manual não foi registrada.");
        restaurar();
        operacoesEmCurso.delete(chave);
      });
  }, true);
})();