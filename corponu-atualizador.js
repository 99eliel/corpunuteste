(() => {
  "use strict";

  const LOCAL_RELEASE = "2026-08-19-manejo-calcinha-fase-lista-real-219";
  const INTERVALO_VERIFICACAO = 60 * 1000;
  const RELOAD_KEY = "corponu_web_release_recarregada";

  if (window.__CORPONU_ATUALIZADOR_WEB__ === LOCAL_RELEASE) return;
  window.__CORPONU_ATUALIZADOR_WEB__ = LOCAL_RELEASE;
  window.CORPONU_RELEASE_VERSION = LOCAL_RELEASE;
  window.__corponuAutoUpdateIniciado = true;

  let verificando = false;

  function reservarModoCalcinhaOpcional() {
    if (document.querySelector('script[data-corponu-dual-mode="1"]')) return;
    const marcador = document.createElement("script");
    marcador.dataset.corponuDualMode = "1";
    marcador.dataset.corponuDualOpcionalGuard = LOCAL_RELEASE;
    document.head.appendChild(marcador);
  }

  function carregarScript(nomeArquivo, marcador, mensagemErro) {
    const existente = [...document.scripts].find(script => String(script.src || "").includes(nomeArquivo));
    if (existente) return existente;
    const script = document.createElement("script");
    script.src = `./${nomeArquivo}?v=${encodeURIComponent(LOCAL_RELEASE)}&t=${Date.now()}`;
    script.async = false;
    script.dataset.corponuModulo = marcador;
    script.onerror = () => console.error(mensagemErro);
    document.head.appendChild(script);
    return script;
  }

  function carregarModulos() {
    const modulos = [
      ["corponu-calcinha-planejamento-opcional-129.js", "calcinha-planejamento-opcional-129", "Não foi possível tornar serviço e facção opcionais nas OPs de calcinha."],
      ["corponu-remover-lancamento-manual-pagamentos.js", "remover-lancamento-manual-pagamentos", "Não foi possível remover a criação manual de pagamentos."],
      ["corponu-chegada-manual-sutia-pagamento-automatico.js", "chegada-manual-sutia-pagamento-automatico", "Não foi possível ativar o pagamento automático do Sutiã Completo na chegada manual."],
      ["corponu-chegada-manual-trava-movimentacao.js", "chegada-manual-trava-movimentacao", "Não foi possível carregar a trava de movimentação da chegada manual."],
      ["corponu-pagamento-antiduplicidade-isolada.js", "pagamento-antiduplicidade-isolada", "Não foi possível carregar a proteção isolada contra pagamentos duplicados."],
      ["corponu-revisao-lateral-bojo-fix.js", "revisao-lateral-bojo-fix", "Não foi possível carregar a proteção da área Revisão lateral e bojo."],
      ["corponu-revisao-responsaveis.js", "revisao-responsaveis", "Não foi possível carregar o registro de quem fez lateral e bojo."],
      ["corponu-revisao-faccoes-select.js", "revisao-faccoes-select", "Não foi possível carregar as facções por processo na revisão."],
      ["corponu-revisao-limpar-apos-salvar.js", "revisao-limpar-apos-salvar", "Não foi possível limpar a revisão após o salvamento."],
      ["corponu-revisao-lista-estavel.js", "revisao-lista-estavel", "Não foi possível carregar a lista estável de lateral e bojo."],
      ["corponu-componentes-consolidados-hotfix.js", "componentes-nao-informados", "Não foi possível proteger componentes ainda não informados."],
      ["corponu-reenvio-sutia-componentes.js", "reenvio-sutia-componentes", "Não foi possível conferir lateral e bojo no reenvio para Sutiã Completo."],
      ["corponu-sutia-912-fluxo-rapido.js", "sutia-912-fluxo-rapido", "Não foi possível ativar o fluxo rápido da referência 912."],
      ["corponu-sutia-completo-calculo.js", "sutia-completo-calculo", "Não foi possível carregar o cálculo automático do Sutiã Completo."],
      ["corponu-sutia-completo-chegada-rapida.js", "sutia-completo-chegada-rapida", "Não foi possível ativar a chegada rápida e atômica do Sutiã Completo."],
      ["corponu-sutia-completo-fallbacks-off.js", "sutia-completo-fallbacks-off", "Não foi possível desativar as reconciliações antigas do Sutiã Completo."],
      ["corponu-sutia-completo-reconciliacao-manual.js", "sutia-completo-reconciliacao-manual", "Não foi possível reconciliar o pagamento da chegada manual de Sutiã Completo."],
      ["corponu-sutia-completo-referencia-especial-integral.js", "sutia-especial-integral", "Não foi possível aplicar o valor integral da referência especial."],
      ["corponu-sutia-912-chegada-manual-sem-verificacoes.js", "sutia-912-sem-verificacoes", "Não foi possível remover as verificações da referência 912 na chegada manual."],
      ["corponu-processos-somente-valores.js", "processos-somente-valores", "Não foi possível simplificar a aba Processos para gestão de valores."],
      ["corponu-sutia-completo-compatibilidade.js", "sutia-completo-compatibilidade", "Não foi possível desativar a fonte antiga de descontos."],
      ["corponu-faccoes-corte.js", "faccoes-corte", "Não foi possível carregar a área interna das facções."],
      ["corponu-faccoes-grupos-processos.js", "faccoes-grupos-processos", "Não foi possível carregar os grupos de processos das facções."],
      ["corponu-faccoes-grupos-processos-integracao.js", "faccoes-grupos-processos-integracao", "Não foi possível concluir a integração dos grupos de facções."],
      ["corponu-faccoes-grupos-saida-fix.js", "faccoes-grupos-saida-fix", "Não foi possível carregar as facções habilitadas do processo."],
      ["corponu-faccoes-label-lateral.js", "faccoes-label-lateral", "Não foi possível aplicar o nome Lateral e Alça na área de facções."],
      ["corponu-faccoes-lateral-alca-integracao.js", "faccoes-lateral-alca-integracao", "Não foi possível integrar Lateral e Alça na área de facções."],
      ["corponu-faccoes-lateral-alca-exclusao.js", "faccoes-lateral-alca-exclusao", "Não foi possível carregar a exclusão segura de movimentações de Alça."],
      ["corponu-faccoes-exclusao-pagamento-vinculado.js", "faccoes-exclusao-pagamento-vinculado", "Não foi possível vincular a exclusão da facção ao pagamento pendente."],
      ["corponu-faccoes-ocultar-registrar-chegada-topo.js", "faccoes-ocultar-chegada-topo", "Não foi possível ocultar o botão superior Registrar chegada."],
      ["corponu-faccao-cadastro-recolhido.js", "faccao-cadastro-recolhido", "Não foi possível abrir o cadastro e a edição de facção em card."],
      ["corponu-chegada-sem-componentes-duplicados.js", "chegada-sem-componentes-duplicados", "Não foi possível remover a conferência duplicada de lateral e bojo."],
      ["corponu-chegada-manual-sem-componentes-duplicados.js", "chegada-manual-sem-componentes-duplicados", "Não foi possível remover a conferência duplicada na chegada manual."],
      ["corponu-chegada-sutia-sync-legado.js", "chegada-sutia-definitiva", "Não foi possível ativar a chegada definitiva do Sutiã Completo."],
      ["corponu-pagamentos-interface.js", "pagamentos-interface", "Não foi possível carregar a organização visual de Pagamentos."],
      ["corponu-pagamentos-interface-fix.js", "pagamentos-interface-fix", "Não foi possível estabilizar a interface de Pagamentos."],
      ["corponu-pagamentos-manual-op-auto.js", "pagamentos-manual-op-auto", "Não foi possível carregar a busca automática da OP no lançamento manual."],
      ["corponu-pagamento-manual-componentes.js", "pagamento-manual-componentes", "Não foi possível carregar a definição de lateral e bojo no lançamento manual."],
      ["corponu-pagamento-manual-sutia-completo.js", "pagamento-manual-sutia-completo", "Não foi possível carregar a conferência completa do Sutiã Completo no lançamento manual."],
      ["corponu-chegada-manual-visual.js", "chegada-manual-visual", "Não foi possível carregar a aparência da chegada manual."],
      ["corponu-pagamentos-filtro-op.js", "pagamentos-filtro-op", "Não foi possível carregar o filtro de OP em Pagamentos."],
      ["corponu-pagamentos-multifiltro.js", "pagamentos-multifiltro-processos", "Não foi possível carregar a seleção de múltiplos processos."],
      ["corponu-pagamentos-multifiltro-visual.js", "pagamentos-multifiltro-visual", "Não foi possível carregar o acabamento visual do multifiltro."],
      ["corponu-pagamentos-alerta-sem-valor.js", "pagamentos-alerta-sem-valor", "Não foi possível destacar as movimentações filtradas sem valor."],
      ["corponu-pagamentos-alerta-duplicidades.js", "pagamentos-alerta-duplicidades", "Não foi possível verificar duplicidades nos pagamentos filtrados."],
      ["corponu-pendencias-modal-estavel.js", "pendencias-modal-estavel", "Não foi possível restaurar a abertura das pendências de valores."],
      ["corponu-pendencias-valor-seguro.js", "pendencias-valor-seguro", "Não foi possível salvar e recalcular os valores pendentes com segurança."],
      ["corponu-verificacao-sutia-completo.js", "verificacao-sutia-completo-segura", "Não foi possível carregar a verificação segura do Sutiã Completo."],
      ["corponu-valores-pendentes-financeiro.js", "valores-pendentes-financeiro", "Não foi possível carregar a área de Valores pendentes."],
      ["corponu-valores-pendentes-auth-214.js", "valores-pendentes-auth-214", "Não foi possível estabilizar a autenticação de Valores pendentes."],
      ["corponu-manejo-calcinha-fase-definitivo-216.js", "manejo-calcinha-fase-lista-real-219", "Não foi possível carregar o seletor estável da Fase do Manejo Calcinha."]
    ];
    modulos.forEach(([arquivo, marcador, erro]) => carregarScript(arquivo, marcador, erro));
  }

  function removerAvisosAntigos() {
    ["corponuToastAtualizacaoAutomatica", "toastAtualizacaoSistema", "toastAtualizadorCorpoNu"]
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
        await Promise.all(chaves.filter(chave => chave.startsWith("op-confeccao-")).map(chave => caches.delete(chave)));
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
    } catch (error) {}
    url.searchParams.set("release", release);
    url.searchParams.set("t", String(Date.now()));
    setTimeout(() => window.location.replace(url.toString()), 250);
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
    reservarModoCalcinhaOpcional();
    carregarModulos();
    removerAvisosAntigos();
    await removerPwaAntigo();
    await verificarRelease();
    setInterval(verificarRelease, INTERVALO_VERIFICACAO);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) verificarRelease(); });
    window.addEventListener("focus", verificarRelease);
    window.addEventListener("online", verificarRelease);
  }

  reservarModoCalcinhaOpcional();
  carregarModulos();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();