(() => {
  "use strict";

  const VERSION = "2026-08-21-homologacao-demo-op-mov-226";

  if (window.__CORPONU_FACCOES_LABEL_LATERAL__ === VERSION) return;
  window.__CORPONU_FACCOES_LABEL_LATERAL__ = VERSION;

  const IDS_TEXTO = [
    "painelFaccoesCorte",
    "modalSaidaCorte",
    "modalChegadaCorte",
    "modalSelecionarChegadaCorte",
    "s3titulo"
  ];

  const STYLE_ID = "corponuLateralSemCanceladas161";
  const DEMO_OP_ID = "999821";
  const DEMO_MOV_ID = "demo-mov-999821-sutia-completo";
  const DEMO_PRODUTO_ID = "9999";

  let aplicando = false;
  let agendado = false;
  let demoIniciado = false;

  function substituirTexto(no) {
    const atual = String(no?.nodeValue || "");
    const novo = atual
      .replace(/\bCORTE\b/g, "LATERAL")
      .replace(/\bCorte\b/g, "Lateral");
    if (novo !== atual) no.nodeValue = novo;
  }

  function corrigirTextosVisiveis(raiz) {
    if (!raiz) return;

    const walker = document.createTreeWalker(
      raiz,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(no) {
          const pai = no.parentElement;
          if (!pai || ["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "OPTION"].includes(pai.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          return /\bCORTE\b|\bCorte\b/.test(no.nodeValue || "")
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const encontrados = [];
    while (walker.nextNode()) encontrados.push(walker.currentNode);
    encontrados.forEach(substituirTexto);
  }

  function corrigirBotaoAba() {
    const botao = document.getElementById("abaFaccaoCorte");
    if (!botao) return;

    const contador = botao.querySelector("#contCorte");
    if (contador) {
      let textoPrincipal = [...botao.childNodes].find(no => no.nodeType === Node.TEXT_NODE);
      if (!textoPrincipal) {
        textoPrincipal = document.createTextNode("Lateral e Alça ");
        botao.insertBefore(textoPrincipal, contador);
      } else if (String(textoPrincipal.nodeValue || "").trim() !== "Lateral e Alça") {
        textoPrincipal.nodeValue = "Lateral e Alça ";
      }
      return;
    }

    corrigirTextosVisiveis(botao);
  }

  function garantirEstiloCanceladas() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #painelFaccoesCorte #listaFaccoesCorte tr:has(.corte-pill.cancelado){
        display:none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function removerLinhasCanceladas() {
    const tbody = document.getElementById("listaFaccoesCorte");
    if (!tbody) return;

    [...tbody.querySelectorAll(":scope > tr")].forEach(linha => {
      const badgeCancelado = linha.querySelector(".corte-pill.cancelado");
      if (!badgeCancelado) return;
      linha.remove();
    });
  }

  function aplicarNomeLateral() {
    if (aplicando) return;
    aplicando = true;
    try {
      garantirEstiloCanceladas();
      corrigirBotaoAba();
      IDS_TEXTO.forEach(id => corrigirTextosVisiveis(document.getElementById(id)));
      document
        .querySelectorAll('#faccoes [data-area-faccoes="corte"]')
        .forEach(corrigirTextosVisiveis);
      removerLinhasCanceladas();
    } finally {
      aplicando = false;
    }
  }

  function agendarAplicacao() {
    if (agendado) return;
    agendado = true;
    window.requestAnimationFrame(() => {
      agendado = false;
      aplicarNomeLateral();
    });
  }

  function avisarDemo(mensagem) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = mensagem;
    toast.classList.remove("hidden");
    window.clearTimeout(window.__corponuDemoHomologacaoToast);
    window.__corponuDemoHomologacaoToast = window.setTimeout(() => toast.classList.add("hidden"), 7000);
  }

  async function semearDemoHomologacao() {
    if (demoIniciado) return;
    demoIniciado = true;

    try {
      const [appMod, authMod, fs] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js")
      ]);

      let app = null;
      for (let tentativa = 0; tentativa < 40; tentativa += 1) {
        if (appMod.getApps().length) {
          app = appMod.getApp();
          break;
        }
        await new Promise(resolve => window.setTimeout(resolve, 250));
      }

      if (!app || app.options?.projectId !== "corponuteste") return;

      const auth = authMod.getAuth(app);
      const db = fs.getFirestore(app);

      const usuario = await new Promise(resolve => {
        if (auth.currentUser) return resolve(auth.currentUser);
        const unsubscribe = authMod.onAuthStateChanged(auth, atual => {
          if (!atual) return;
          unsubscribe();
          resolve(atual);
        });
      });

      if (!usuario) return;

      const produtoRef = fs.doc(db, "produtos", DEMO_PRODUTO_ID);
      const opRef = fs.doc(db, "ordensProducao", DEMO_OP_ID);
      const movRef = fs.doc(db, "movimentacoesProducao", DEMO_MOV_ID);

      const [produtoSnap, opSnap, movSnap] = await Promise.all([
        fs.getDoc(produtoRef),
        fs.getDoc(opRef),
        fs.getDoc(movRef)
      ]);

      if (!produtoSnap.exists()) {
        await fs.setDoc(produtoRef, {
          referencia: "9999",
          nome: "SUTIÃ DEMO HOMOLOGAÇÃO",
          possuiAlca: true,
          possuiBojo: true,
          possuiRenda: false,
          observacoes: "Registro temporário criado para visualizar a homologação.",
          criadoPor: usuario.uid,
          criadoEm: fs.serverTimestamp(),
          atualizadoPor: usuario.uid,
          atualizadoEm: fs.serverTimestamp()
        });
      }

      if (!opSnap.exists()) {
        await fs.setDoc(opRef, {
          numeroOP: "999821",
          referencia: "9999",
          cor: "PRETO",
          produtoNome: "SUTIÃ DEMO HOMOLOGAÇÃO",
          semana: 34,
          mes: 8,
          ano: 2026,
          necessidadeInicio: "",
          necessidadeFim: "",
          necessidade: "TESTE HOMOLOGAÇÃO",
          necessidadeTexto: "TESTE HOMOLOGAÇÃO",
          necessidadeManual: true,
          quantidade: 120,
          possuiAlca: true,
          possuiBojo: true,
          possuiRenda: false,
          tipoPeca: "sutia",
          tipoPecaLabel: "Sutiã",
          observacoes: "OP temporária para conferir o fluxo visual do ambiente de teste.",
          referenciaPendente: false,
          statusReferencia: "conferida",
          status: "ativa",
          excluida: false,
          ocultarDoManejo: false,
          criadoPor: usuario.uid,
          criadoEm: fs.serverTimestamp(),
          atualizadoPor: usuario.uid,
          atualizadoEm: fs.serverTimestamp()
        });
      }

      if (!movSnap.exists()) {
        await fs.setDoc(movRef, {
          origem: "faccoes_registro_saida",
          area: "sutia",
          areaLabel: "Sutiã",
          movimentacaoCorte: false,
          opId: DEMO_OP_ID,
          numeroOP: "999821",
          referencia: "9999",
          cor: "PRETO",
          produtoNome: "SUTIÃ DEMO HOMOLOGAÇÃO",
          tipoDestino: "faccao",
          tipoDestinoLabel: "Facção",
          destino: "FACÇÃO TESTE",
          destinoId: "",
          processo: "SUTIÃ COMPLETO",
          processoLivre: true,
          setor: "sutia",
          setorLabel: "Sutiã",
          quantidadeEnviada: 120,
          quantidadeRecebida: 0,
          dataEnvio: "2026-08-21",
          dataChegada: "",
          falta: 0,
          descontoDefeito: 0,
          defeito: 0,
          status: "em_andamento",
          criadoPor: usuario.uid,
          criadoEm: fs.serverTimestamp(),
          atualizadoPor: usuario.uid,
          atualizadoEm: fs.serverTimestamp(),
          versaoDemoHomologacao: VERSION
        });
      }

      avisarDemo("Demo criada: OP 999821 + movimentação SUTIÃ COMPLETO para FACÇÃO TESTE.");

      window.setTimeout(() => {
        document.getElementById("btnAtualizarServidor")?.click();
        document.getElementById("btnCorteAtualizar")?.click();
      }, 500);
    } catch (error) {
      demoIniciado = false;
      console.error("Não foi possível criar a OP/movimentação demo da homologação.", error);
    }
  }

  function iniciar() {
    aplicarNomeLateral();
    semearDemoHomologacao();

    const raizFaccoes = document.getElementById("faccoes");
    if (raizFaccoes) {
      const observer = new MutationObserver(agendarAplicacao);
      observer.observe(raizFaccoes, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (alvo?.closest("#faccoes")) agendarAplicacao();
    }, true);

    window.addEventListener("pageshow", agendarAplicacao);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();