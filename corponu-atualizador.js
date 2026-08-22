(() => {
  "use strict";

  const LOCAL_RELEASE = "2026-08-21-sutia-gravador-unico-268";
  const INTERVALO_VERIFICACAO = 60 * 1000;
  const RELOAD_KEY = "corponu_web_release_recarregada";
  const MODULO_GRUPOS_FACCOES = ["corponu-faccoes-grupos-processos.js", "faccoes-grupos-processos", "Não foi possível carregar os grupos de processos das facções."];

  if (window.__CORPONU_ATUALIZADOR_WEB__ === LOCAL_RELEASE) return;
  window.__CORPONU_ATUALIZADOR_WEB__ = LOCAL_RELEASE;
  window.CORPONU_RELEASE_VERSION = LOCAL_RELEASE;
  window.__corponuAutoUpdateIniciado = true;

  let verificando = false;
  let modulosAposLoginAgendados = false;
  let observerLogin = null;

  const PACOTE_SUTIA_FACCOES = [
    ["corponu-chegada-manual-trava-movimentacao.js", "chegada-manual-trava-movimentacao", "Não foi possível carregar a trava de movimentação da chegada manual."],
    ["corponu-componentes-consolidados-hotfix.js", "componentes-nao-informados", "Não foi possível proteger componentes ainda não informados."],
    ["corponu-reenvio-sutia-componentes.js", "reenvio-sutia-componentes", "Não foi possível conferir lateral e bojo no reenvio para Sutiã Completo."],
    ["corponu-sutia-completo-calculo.js", "sutia-completo-calculo", "Não foi possível carregar o cálculo automático do Sutiã Completo."],
    ["corponu-sutia-completo-chegada-rapida.js", "sutia-completo-chegada-rapida", "Não foi possível ativar a chegada rápida e atômica do Sutiã Completo."],
    ["corponu-sutia-completo-referencia-especial-integral.js", "sutia-especial-integral", "Não foi possível aplicar o valor integral da referência especial."],
    ["corponu-sutia-912-chegada-manual-sem-verificacoes.js", "sutia-912-sem-verificacoes", "Não foi possível remover as verificações da referência 912 na chegada manual."],
    ["corponu-sutia-completo-compatibilidade.js", "sutia-completo-compatibilidade", "Não foi possível desativar a fonte antiga de descontos."],
    ["corponu-sutia-completo-ponto-luz-411-206.js", "sutia-ponto-luz-411", "Não foi possível carregar a regra de ponto de luz da referência 411."],
    ["corponu-chegada-sem-componentes-duplicados.js", "chegada-sem-componentes-duplicados", "Não foi possível remover a conferência duplicada de lateral e bojo."],
    ["corponu-chegada-manual-sem-componentes-duplicados.js", "chegada-manual-sem-componentes-duplicados", "Não foi possível remover a conferência duplicada na chegada manual."]
  ];

  const MODULOS_POR_PAGINA = Object.freeze({
    pagamentos: [
      ["corponu-remover-lancamento-manual-pagamentos.js", "remover-lancamento-manual-pagamentos", "Não foi possível remover a criação manual de pagamentos."],
      ["corponu-pagamentos-interface.js", "pagamentos-interface", "Não foi possível carregar a organização visual de Pagamentos."],
      ["corponu-pagamentos-interface-fix.js", "pagamentos-interface-fix", "Não foi possível estabilizar a interface de Pagamentos."],
      ["corponu-pagamentos-manual-op-auto.js", "pagamentos-manual-op-auto", "Não foi possível carregar a busca automática da OP no lançamento manual."],
      ["corponu-pagamento-manual-componentes.js", "pagamento-manual-componentes", "Não foi possível carregar a definição de lateral e bojo no lançamento manual."],
      ["corponu-pagamento-manual-sutia-completo.js", "pagamento-manual-sutia-completo", "Não foi possível carregar a conferência completa do Sutiã Completo no lançamento manual."],
      ["corponu-pagamentos-filtro-op.js", "pagamentos-filtro-op", "Não foi possível carregar o filtro de OP em Pagamentos."],
      ["corponu-pagamentos-multifiltro.js", "pagamentos-multifiltro-processos", "Não foi possível carregar a seleção de múltiplos processos."],
      ["corponu-pagamentos-multifiltro-visual.js", "pagamentos-multifiltro-visual", "Não foi possível carregar o acabamento visual do multifiltro."],
      ["corponu-pagamentos-alerta-sem-valor.js", "pagamentos-alerta-sem-valor", "Não foi possível destacar as movimentações filtradas sem valor."],
      ["corponu-pagamentos-alerta-duplicidades.js", "pagamentos-alerta-duplicidades", "Não foi possível verificar duplicidades nos pagamentos filtrados."],
      ["corponu-pendencias-modal-estavel.js", "pendencias-modal-estavel", "Não foi possível restaurar a abertura das pendências de valores."],
      ["corponu-valores-pendentes-financeiro.js", "valores-pendentes-financeiro", "Não foi possível carregar a área de Valores pendentes."],
      ["corponu-valores-pendentes-auth-214.js", "valores-pendentes-auth-214", "Não foi possível estabilizar a autenticação de Valores pendentes."],
      ["corponu-pendencias-valor-seguro.js", "pendencias-valor-seguro", "Não foi possível salvar e recalcular os valores pendentes com segurança."],
      ["corponu-verificacao-sutia-completo.js", "verificacao-sutia-completo-segura", "Não foi possível carregar a verificação segura do Sutiã Completo."],
      ["corponu-restantes-pendentes-filtro-op-225.js", "restantes-filtro-op", "Não foi possível carregar o filtro de OP em Restantes pendentes."]
    ],
    faccoes: [
      MODULO_GRUPOS_FACCOES,
      ["corponu-faccao-cadastro-recolhido.js", "faccao-cadastro-recolhido", "Não foi possível abrir o cadastro e a edição de facção em card."],
      ["corponu-chegada-manual-visual.js", "chegada-manual-visual", "Não foi possível carregar a aparência da chegada manual."],
      ["corponu-faccoes-corte-definitivo.js", "faccoes-corte-definitivo", "Não foi possível carregar a área definitiva de Corte / Lateral e Alça."],
      ["corponu-faccoes-tres-abas-saida.js", "faccoes-tres-abas-saida", "Não foi possível carregar as três abas de Facções."],
      ...PACOTE_SUTIA_FACCOES
    ],
    processos: [
      ["corponu-sutia-completo-calculo.js", "sutia-completo-calculo", "Não foi possível carregar a configuração do Sutiã Completo."],
      ["corponu-sutia-completo-referencia-especial-integral.js", "sutia-especial-integral", "Não foi possível carregar a regra da referência especial."],
      ["corponu-processos-somente-valores.js", "processos-somente-valores", "Não foi possível simplificar a aba Processos para gestão de valores."]
    ],
    "revisao-componentes": [
      ["corponu-revisao-faccoes.js", "revisao-faccoes", "Não foi possível carregar as facções por processo na revisão."],
      ["corponu-revisao-historico.js", "revisao-historico", "Não foi possível carregar o histórico consolidado de lateral e bojo."]
    ]
  });

  const MODULOS_CRITICOS = [
    ["corponu-pagamento-antiduplicidade-isolada.js", "pagamento-antiduplicidade-isolada", "Não foi possível carregar a proteção isolada contra pagamentos duplicados."],
    ["corponu-revisao-lateral-bojo.js", "revisao-lateral-bojo", "Não foi possível carregar a área Revisão lateral e bojo."],
    ["corponu-saida-sem-confirmacao.js", "saida-sem-confirmacao-dupla", "Não foi possível carregar a proteção contra saída duplicada."],
    ["corponu-faccoes-exclusao-pagamento-vinculado.js", "faccoes-exclusao-pagamento-vinculado", "Não foi possível vincular a exclusão da facção ao pagamento pendente."]
  ];

  const MODULOS_APOS_LOGIN = [
    ["corponu-calcinha-planejamento-opcional-129.js", "calcinha-planejamento-opcional-129", "Não foi possível tornar serviço e facção opcionais nas OPs de calcinha."],
    ["corponu-dual-ready-bridge.js", "dual-ready-bridge", "Não foi possível sincronizar o carregamento do Dual Mode."],
    ["corponu-manejo-calcinha-estavel-204.js", "manejo-calcinha-estavel", "Não foi possível carregar a estabilização do Manejo Calcinha."],
    ["corponu-manejo-calcinha-fase-definitivo-216.js", "manejo-calcinha-fase-lista-real-219", "Não foi possível carregar o seletor estável da Fase do Manejo Calcinha."]
  ];

  function carregarScript(nomeArquivo, marcador, mensagemErro) {
    const existente = [...document.scripts].find(script => String(script.src || "").includes(nomeArquivo));
    if (existente) return existente;
    const script = document.createElement("script");
    script.src = `./${nomeArquivo}?v=${encodeURIComponent(LOCAL_RELEASE)}`;
    script.async = false;
    script.dataset.corponuModulo = marcador;
    script.onerror = () => console.error(mensagemErro);
    document.head.appendChild(script);
    return script;
  }

  function carregarGrupo(modulos) {
    modulos.forEach(([arquivo, marcador, erro]) => carregarScript(arquivo, marcador, erro));
  }

  function carregarModulos() {
    carregarGrupo(MODULOS_CRITICOS);
  }

  function carregarModulosDaPagina(pagina) {
    const modulos = MODULOS_POR_PAGINA[String(pagina || "").trim()];
    if (!modulos?.length) return;
    carregarGrupo(modulos);
  }

  function appAutenticadoVisivel() {
    const shell = document.getElementById("appShell");
    if (!shell || shell.hidden || shell.classList.contains("hidden")) return false;
    return getComputedStyle(shell).display !== "none";
  }

  function carregarModulosAposLogin() {
    if (modulosAposLoginAgendados || !appAutenticadoVisivel()) return;
    modulosAposLoginAgendados = true;
    observerLogin?.disconnect();
    observerLogin = null;

    const executar = () => carregarGrupo(MODULOS_APOS_LOGIN);
    if ("requestIdleCallback" in window) window.requestIdleCallback(executar, { timeout: 1000 });
    else window.setTimeout(executar, 150);
  }

  function instalarCarregamentoAposLogin() {
    const shell = document.getElementById("appShell");
    if (!shell) return;
    carregarModulosAposLogin();
    if (modulosAposLoginAgendados) return;

    observerLogin?.disconnect();
    observerLogin = new MutationObserver(carregarModulosAposLogin);
    observerLogin.observe(shell, { attributes: true, attributeFilter: ["class", "hidden", "style"] });
  }

  function garantirGruposParaManejo() {
    const [arquivo, marcador, erro] = MODULO_GRUPOS_FACCOES;
    const aplicar = () => window.setTimeout(() => window.CorpoNuFaccoesGrupos?.filtrarManejo?.(), 0);

    if (window.CorpoNuFaccoesGrupos?.filtrarManejo) {
      aplicar();
      return;
    }

    const script = carregarScript(arquivo, marcador, erro);
    if (script.dataset.corponuGruposManejoLoad !== "1") {
      script.dataset.corponuGruposManejoLoad = "1";
      script.addEventListener("load", aplicar, { once: true });
    }
  }

  function instalarCarregamentoSobDemanda() {
    if (document.documentElement.dataset.corponuLazyModules === LOCAL_RELEASE) return;
    document.documentElement.dataset.corponuLazyModules = LOCAL_RELEASE;

    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      const botaoPagina = alvo?.closest?.(".nav-btn[data-page]");
      if (botaoPagina) carregarModulosDaPagina(botaoPagina.dataset.page);

      const botaoAcao = alvo?.closest?.("button,[role='button'],a");
      const onclick = String(botaoAcao?.getAttribute?.("onclick") || "");
      const rotulo = String(botaoAcao?.textContent || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();
      if (onclick.includes("mandarParaFaccao") || rotulo.includes("ENVIAR PARA FACCAO")) garantirGruposParaManejo();
    }, true);
  }

  function removerAvisosAntigos() {
    ["corponuToastAtualizacaoAutomatica", "toastAtualizacaoSistema", "toastAtualizadorCorpoNu", "corponuAutoUpdateRuntime203Status"]
      .forEach(id => document.getElementById(id)?.remove());
  }

  async function removerPwaAntigo() {
    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.getRegistrations) {
        const registros = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registros.map(registro => registro.unregister()));
      }
    } catch (error) {
      console.warn("Não foi possível remover o service worker antigo.", error);
    }
    try {
      if ("caches" in window) {
        const chaves = await caches.keys();
        await Promise.all(chaves.filter(chave => chave.startsWith("op-confeccao-") || chave.startsWith("corponu-")).map(chave => caches.delete(chave)));
      }
    } catch (error) {
      console.warn("Não foi possível remover o cache antigo do PWA.", error);
    }
  }

  function recarregarUmaVez(versao) {
    const release = String(versao || "").trim();
    if (!release || release === LOCAL_RELEASE) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("release") === release) return;
    const chave = `${RELOAD_KEY}_${release}`;
    try {
      const ultima = Number(sessionStorage.getItem(chave) || 0);
      if (Date.now() - ultima < 30000) return;
      sessionStorage.setItem(chave, String(Date.now()));
    } catch (_) {}
    url.searchParams.set("release", release);
    url.searchParams.set("t", String(Date.now()));
    window.setTimeout(() => window.location.replace(url.toString()), 250);
  }

  async function verificarRelease() {
    if (verificando) return;
    verificando = true;
    try {
      const resposta = await fetch(`corponu-release.json?ts=${Date.now()}`, { cache: "no-store" });
      if (!resposta.ok) return;
      const dados = await resposta.json();
      recarregarUmaVez(dados?.version);
    } catch (error) {
      console.warn("Não foi possível verificar a versão online do CorpoNu.", error);
    } finally {
      verificando = false;
    }
  }

  async function iniciar() {
    removerAvisosAntigos();
    instalarCarregamentoAposLogin();
    await removerPwaAntigo();
    await verificarRelease();
    window.setInterval(verificarRelease, INTERVALO_VERIFICACAO);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) verificarRelease(); });
    window.addEventListener("focus", verificarRelease);
    window.addEventListener("online", verificarRelease);
  }

  instalarCarregamentoSobDemanda();
  carregarModulos();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();