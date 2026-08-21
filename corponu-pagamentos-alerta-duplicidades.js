(() => {
  "use strict";

  const VERSION_DUPLICIDADE = "2026-08-06-duplicidade-tabela-135";
  const VERSION_RESTAURACAO_OPS = "2026-08-06-ops-excluidas-restauracao-139";
  const VERSION_NECESSIDADE_OPCIONAL = "2026-08-07-calcinha-aba-fix-144";
  const VERSION_ATUALIZACAO_SAIDA_FACCOES = "2026-08-07-faccoes-saida-atualizacao-imediata-143";
  const VERSION_IDENTIDADE_FLOW = "2026-08-07-corpo-nu-flow-identidade-145";
  const VERSION_CALCINHA_SALVAMENTO_RAPIDO = "2026-08-07-calcinha-salvamento-rapido-147";
  const VERSION_QUANTIDADE_SEM_SCROLL = "2026-08-07-quantidade-sem-scroll-148";
  const VERSION_LATERAL_CANCELADAS = "2026-08-10-lateral-canceladas-dom-160";
  const VERSION_PENDENCIAS_MOTIVO = "2026-08-11-pendencias-motivo-171b";

  function carregarScript(nomeArquivo, modulo, versao, mensagemErro) {
    const existente = [...document.scripts].find(script =>
      String(script.src || "").includes(nomeArquivo)
    );
    if (existente) return existente;

    const script = document.createElement("script");
    script.src = `./${nomeArquivo}?v=${encodeURIComponent(versao)}&t=${Date.now()}`;
    script.async = false;
    script.dataset.corponuModulo = modulo;
    script.onerror = () => console.error(mensagemErro);
    document.head.appendChild(script);
    return script;
  }

  carregarScript(
    "corponu-identidade-corpo-nu-flow-145.js",
    "identidade-corpo-nu-flow-145",
    VERSION_IDENTIDADE_FLOW,
    "Não foi possível carregar a identidade Corpo Nu Flow."
  );

  carregarScript(
    "corponu-quantidade-sem-scroll-148.js",
    "quantidade-sem-scroll-148",
    VERSION_QUANTIDADE_SEM_SCROLL,
    "Não foi possível ativar a proteção da quantidade da OP contra o scroll do mouse."
  );

  carregarScript(
    "corponu-ops-excluidas-restauracao-139.js",
    "ops-excluidas-restauracao-139",
    VERSION_RESTAURACAO_OPS,
    "Não foi possível carregar a lixeira/restauração de OPs excluídas."
  );

  carregarScript(
    "corponu-calcinha-salvamento-rapido-147.js",
    "calcinha-salvamento-rapido-147",
    VERSION_CALCINHA_SALVAMENTO_RAPIDO,
    "Não foi possível ativar o salvamento rápido das OPs de Calcinha."
  );

  carregarScript(
    "corponu-ordens-necessidade-opcional-fix-144.js",
    "ordens-necessidade-opcional-fix-144",
    VERSION_NECESSIDADE_OPCIONAL,
    "Não foi possível carregar a correção da aba Calcinha com necessidade opcional."
  );

  carregarScript(
    "corponu-faccoes-saida-atualizacao-imediata-143.js",
    "faccoes-saida-atualizacao-imediata-143",
    VERSION_ATUALIZACAO_SAIDA_FACCOES,
    "Não foi possível atualizar a lista de Facções imediatamente após a saída."
  );

  carregarScript(
    "corponu-lateral-canceladas-160.js",
    "lateral-canceladas-160",
    VERSION_LATERAL_CANCELADAS,
    "Não foi possível ocultar movimentações canceladas de Lateral e Alça."
  );

  carregarScript(
    "corponu-pendencias-motivo-171.js",
    "pendencias-motivo-171",
    VERSION_PENDENCIAS_MOTIVO,
    "Não foi possível mostrar o motivo específico das pendências financeiras."
  );

  if (window.__CORPONU_DUPLICIDADE_TABELA_LOADER_135__ === VERSION_DUPLICIDADE) return;
  window.__CORPONU_DUPLICIDADE_TABELA_LOADER_135__ = VERSION_DUPLICIDADE;

  try {
    const restaurar = window.__restaurarMutationObserverDuplicidade133;
    if (typeof restaurar === "function") restaurar();
  } catch (error) {
    console.warn("[Pagamentos 135] Observer global já estava normal.", error);
  }

  [
    "alertaPagamentosDuplicadosFiltrado113",
    "stylePagamentosDuplicadosFiltrado113",
    "corponuDuplicidadeFiltro127",
    "corponuDuplicidadeFiltroStyle127",
    "corponuDuplicidadeFiltro133",
    "corponuDuplicidadeFiltroStyle133",
    "corponuDuplicidadeTabela135",
    "corponuDuplicidadeTabelaStyle135"
  ].forEach(id => document.getElementById(id)?.remove());

  carregarScript(
    "corponu-pagamentos-duplicidade-tabela-135.js",
    "pagamentos-duplicidade-tabela-135",
    VERSION_DUPLICIDADE,
    "Não foi possível carregar a conferência visual de duplicidades."
  );
})();
