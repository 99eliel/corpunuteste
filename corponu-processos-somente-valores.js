(() => {
  "use strict";

  const VERSION = "2026-08-14-op-salvamento-rapido-199";
  const PAGINA_ID = "processos";
  const CLASSE_OCULTA = "cn61-processos-oculto";
  const CABECALHO_CALCINHA = "corponu-manejo-cabecalho-calcinha-191.js";
  const EXCLUIR_PROCESSO = "corponu-processos-excluir-195.js";
  const SALVAR_OP_RAPIDO = "corponu-op-salvamento-rapido-199.js";

  function carregarSalvarOp199() {
    if (window.__CORPONU_OP_SALVAMENTO_RAPIDO_199__ === VERSION) return;
    if ([...document.scripts].some(script => String(script.src || "").includes(SALVAR_OP_RAPIDO))) return;
    const script = document.createElement("script");
    script.src = `./${SALVAR_OP_RAPIDO}?v=${encodeURIComponent(VERSION)}&t=${Date.now()}`;
    script.async = false;
    script.dataset.corponuModulo = "op-salvamento-rapido-199";
    script.onerror = () => console.error("Não foi possível carregar o salvamento rápido de OP.");
    document.head.appendChild(script);
  }

  function carregarCabecalhoCalcinha191() {
    if ([...document.scripts].some(script => String(script.src || "").includes(CABECALHO_CALCINHA))) return;
    const script = document.createElement("script");
    script.src = `./${CABECALHO_CALCINHA}?v=2026-08-13-fase-calcinha-nao-reverter-194&t=${Date.now()}`;
    script.async = false;
    script.dataset.corponuModulo = "manejo-cabecalho-calcinha-191";
    script.onerror = () => console.error("Não foi possível estabilizar o cabeçalho do Manejo Calcinha.");
    document.head.appendChild(script);
  }

  function carregarExcluirProcesso195() {
    if ([...document.scripts].some(script => String(script.src || "").includes(EXCLUIR_PROCESSO))) return;
    const script = document.createElement("script");
    script.src = `./${EXCLUIR_PROCESSO}?v=${encodeURIComponent(VERSION)}&t=${Date.now()}`;
    script.async = false;
    script.dataset.corponuModulo = "processos-excluir-195";
    script.onerror = () => console.error("Não foi possível carregar a exclusão segura de processo.");
    document.head.appendChild(script);
  }

  carregarSalvarOp199();
  carregarCabecalhoCalcinha191();
  carregarExcluirProcesso195();

  if (window.__CORPONU_PROCESSOS_SOMENTE_VALORES__ === VERSION) return;
  window.__CORPONU_PROCESSOS_SOMENTE_VALORES__ = VERSION;

  let aplicando = false;

  function carregarRelatorioGeral() {
    const arquivo = "corponu-relatorio-geral-valores-190.js";
    if ([...document.scripts].some(script => String(script.src || "").includes(arquivo))) return;
    const script = document.createElement("script");
    script.src = `./${arquivo}?v=${encodeURIComponent(VERSION)}&t=${Date.now()}`;
    script.async = false;
    script.dataset.corponuModulo = "relatorio-geral-valores-190";
    script.onerror = () => console.error("Não foi possível carregar o relatório geral de valores.");
    document.head.appendChild(script);
  }

  function injetarEstilo() {
    document.getElementById("styleProcessosSomenteValores61")?.remove();

    const style = document.createElement("style");
    style.id = "styleProcessosSomenteValores61";
    style.textContent = `
      #${PAGINA_ID} > .${CLASSE_OCULTA}{display:none!important}
      #${PAGINA_ID} .cn61-intro{margin-bottom:16px;padding:15px 17px;border:1px solid #c4b5fd;border-radius:15px;background:linear-gradient(135deg,#faf5ff,#fff);color:#4c1d95}
      #${PAGINA_ID} .cn61-intro h3{margin:0 0 5px;color:#3b0764;font-size:17px}
      #${PAGINA_ID} .cn61-intro p{margin:0;color:#6b21a8;font-size:12px;line-height:1.45}
      #${PAGINA_ID} #configSutiaCompleto51{margin-bottom:16px}
      #${PAGINA_ID} .processos-valores-title strong{font-size:14px}
      #${PAGINA_ID} .processos-valores-title span{font-size:11px}
    `;
    document.head.appendChild(style);
  }

  function filhoDiretoDaPagina(elemento, pagina) {
    let atual = elemento;
    while (atual?.parentElement && atual.parentElement !== pagina) atual = atual.parentElement;
    return atual?.parentElement === pagina ? atual : null;
  }

  function garantirIntroducao(pagina) {
    let intro = document.getElementById("processosValoresIntro61");
    if (!intro) {
      intro = document.createElement("div");
      intro.id = "processosValoresIntro61";
      intro.className = "cn61-intro";
      pagina.prepend(intro);
    }

    let titulo = intro.querySelector(":scope > h3");
    if (!titulo) {
      titulo = document.createElement("h3");
      intro.prepend(titulo);
    }
    titulo.textContent = "Gestão de valores da produção";

    let descricao = intro.querySelector(":scope > p");
    if (!descricao) {
      descricao = document.createElement("p");
      titulo.insertAdjacentElement("afterend", descricao);
    }
    descricao.textContent = "Gerencie os valores por referência de todos os processos cadastrados. A escolha do processo permanece livre e não é alterada automaticamente.";

    return intro;
  }

  function restaurarTodosOsProcessos() {
    document.querySelectorAll(`#${PAGINA_ID} .cn61-processo-nao-usado`).forEach(item => {
      item.classList.remove("cn61-processo-nao-usado");
    });

    const lista = document.getElementById("listaProcessosValores");
    const titulo = lista?.closest("aside")?.querySelector(".processos-valores-title");
    const forte = titulo?.querySelector("strong");
    const ajuda = titulo?.querySelector("span");
    if (forte) forte.textContent = "Processos cadastrados";
    if (ajuda) ajuda.textContent = "Clique para selecionar.";

    const busca = document.getElementById("buscaProcessoValor");
    if (busca && /Lateral|Encapar Bojo/i.test(busca.placeholder || "")) {
      busca.placeholder = "Buscar processo...";
    }

    const selectProcesso = document.getElementById("precoReferenciaProcesso");
    if (selectProcesso instanceof HTMLSelectElement) {
      [...selectProcesso.options].forEach(option => {
        option.hidden = false;
        option.disabled = false;
      });
    }

    const tituloTabela = document.getElementById("tituloTabelaValores");
    if (tituloTabela && /Lateral e Encapar Bojo/i.test(tituloTabela.textContent || "")) {
      tituloTabela.textContent = "Valores cadastrados por referência";
    }
  }

  function focarEstrutura() {
    const pagina = document.getElementById(PAGINA_ID);
    if (!pagina || aplicando) return false;

    aplicando = true;
    try {
      injetarEstilo();
      const introducao = garantirIntroducao(pagina);
      const permitidos = new Set([introducao]);

      [
        document.getElementById("configSutiaCompleto51"),
        document.getElementById("formPrecoReferencia"),
        document.getElementById("listaProcessosValores"),
        document.getElementById("tituloTabelaValores"),
        document.getElementById("buscaProcessoValor")
      ].filter(Boolean).forEach(elemento => {
        const filho = filhoDiretoDaPagina(elemento, pagina);
        if (filho) permitidos.add(filho);
      });

      [...pagina.children].forEach(filho => {
        filho.classList.toggle(CLASSE_OCULTA, !permitidos.has(filho));
      });

      const titulo = document.getElementById("pageTitle");
      const subtitulo = document.getElementById("pageSubtitle");
      if (pagina.classList.contains("active")) {
        if (titulo) titulo.textContent = "Valores de produção";
        if (subtitulo) subtitulo.textContent = "Gerencie os valores por referência dos processos cadastrados.";
      }

      restaurarTodosOsProcessos();
      return permitidos.size > 1;
    } finally {
      aplicando = false;
    }
  }

  function aplicarDepois(atrasos = [60, 250, 700]) {
    atrasos.forEach(atraso => window.setTimeout(focarEstrutura, atraso));
  }

  function instalarEventos() {
    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (alvo?.closest('[data-page="processos"]')) aplicarDepois();
    }, true);

    document.addEventListener("submit", event => {
      if (event.target?.id === "formPrecoReferencia" || event.target?.id === "configSutiaCompleto51") {
        aplicarDepois([150, 500]);
      }
    }, true);
  }

  function iniciar() {
    carregarSalvarOp199();
    carregarCabecalhoCalcinha191();
    carregarExcluirProcesso195();
    carregarRelatorioGeral();
    instalarEventos();
    focarEstrutura();
    aplicarDepois([250, 800]);
  }

  carregarSalvarOp199();
  carregarCabecalhoCalcinha191();
  carregarExcluirProcesso195();
  carregarRelatorioGeral();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
