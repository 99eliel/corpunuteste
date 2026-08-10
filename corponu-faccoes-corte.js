(() => {
  "use strict";
  const VERSION = "2026-08-10-lateral-carregamento-158";
  if (window.__CORPONU_FACCOES_CORTE_LOADER__ === VERSION) return;
  window.__CORPONU_FACCOES_CORTE_LOADER__ = VERSION;

  const parts = [
    "corponu-faccoes-corte-01.txt",
    "corponu-faccoes-corte-02.txt",
    "corponu-faccoes-corte-03.txt",
    "corponu-faccoes-corte-04.txt",
    "corponu-faccoes-corte-05.txt"
  ];

  function carregarScript(nomeArquivo, marcador, mensagemErro, aoCarregar) {
    const existente = [...document.scripts].find(script => String(script.src || "").includes(nomeArquivo));
    if (existente) {
      aoCarregar?.();
      return existente;
    }

    const script = document.createElement("script");
    script.src = `./${nomeArquivo}?v=${encodeURIComponent(VERSION)}&t=${Date.now()}`;
    script.async = false;
    script.dataset.corponuModulo = marcador;
    script.onload = () => aoCarregar?.();
    script.onerror = () => console.error(mensagemErro);
    document.head.appendChild(script);
    return script;
  }

  function aplicarHotfixLateralEAlcaNoFonte(fonteOriginal) {
    let fonte = String(fonteOriginal || "");

    const inicioAntigo = `  async function criarOuAtualizarPagamento(movement) {
    const c = await aguardarContexto();
    const price = precoDoMovimento(movement);`;

    const inicioNovo = `  async function criarOuAtualizarPagamento(movement) {
    const c = await aguardarContexto();
    const processoNormalizadoPagamento = norm(movement.processo);
    const ehAlcaGlobal = ["ALCA", "ALCAS"].includes(processoNormalizadoPagamento);
    const ehLateralReferencia = processoNormalizadoPagamento === "LATERAL";
    let conflitoPrecoLateral = false;
    let price = precoDoMovimento(movement);

    if (ehAlcaGlobal) {
      try {
        const globalSnap = await c.fs.getDoc(
          c.fs.doc(c.db, "precosReferencia", "valor-padrao-alca")
        );
        if (globalSnap.exists()) {
          const globalData = { id: globalSnap.id, ...globalSnap.data() };
          const valorGlobal = Math.max(
            numero(globalData.valor ?? globalData.valorUnitario ?? globalData.preco),
            0
          );
          if (globalData.ativo !== false && valorGlobal > 0) price = globalData;
        }
      } catch (error) {
        console.warn("Não foi possível ler o valor global da ALÇA.", error);
      }
    }

    if (ehLateralReferencia) {
      try {
        const referenciaTexto = String(movement.referencia ?? "").trim();
        const referenciasConsulta = [];
        if (referenciaTexto) referenciasConsulta.push(referenciaTexto);
        const referenciaNumero = Number(referenciaTexto.replace(",", "."));
        if (
          referenciaTexto &&
          Number.isFinite(referenciaNumero) &&
          !referenciasConsulta.some(item => typeof item === "number" && item === referenciaNumero)
        ) {
          referenciasConsulta.push(referenciaNumero);
        }

        if (referenciasConsulta.length) {
          const colecaoPrecos = c.fs.collection(c.db, "precosReferencia");
          const consultaPrecos = referenciasConsulta.length > 1
            ? c.fs.query(colecaoPrecos, c.fs.where("referencia", "in", referenciasConsulta))
            : c.fs.query(colecaoPrecos, c.fs.where("referencia", "==", referenciasConsulta[0]));
          const snapshotPrecos = await c.fs.getDocs(consultaPrecos);
          const candidatosLaterais = snapshotPrecos.docs
            .map(documento => ({ id: documento.id, ...documento.data() }))
            .filter(item => {
              const valor = Math.max(
                numero(item.valor ?? item.valorUnitario ?? item.preco ?? item.valorPorPeca),
                0
              );
              return item.ativo !== false && norm(item.processo) === "LATERAL" && valor > 0;
            });
          const valoresLaterais = [...new Set(candidatosLaterais.map(item =>
            Math.max(numero(item.valor ?? item.valorUnitario ?? item.preco ?? item.valorPorPeca), 0).toFixed(6)
          ))];

          if (valoresLaterais.length === 1) {
            price = [...candidatosLaterais].sort((a, b) => {
              const setorA = norm(a.setor) === "LATERAL" ? 0 : 1;
              const setorB = norm(b.setor) === "LATERAL" ? 0 : 1;
              return setorA - setorB || String(a.id).localeCompare(String(b.id), "pt-BR", { numeric: true });
            })[0] || price;
          } else if (valoresLaterais.length > 1) {
            price = null;
            conflitoPrecoLateral = true;
            console.error(
              "Existem valores ativos diferentes para a mesma referência de LATERAL.",
              movement.referencia,
              valoresLaterais
            );
          }
        }
      } catch (error) {
        console.warn("Não foi possível ler o valor cadastrado da LATERAL.", error);
      }
    }`;

    const calculoAntigo = `    const unit = price ? Math.max(numero(price.valor), 0) : 0;
    const subtotal = arredondar(qty * unit);`;

    const calculoNovo = `    const valorBase = price
      ? Math.max(numero(price.valor ?? price.valorUnitario ?? price.preco ?? price.valorPorPeca), 0)
      : 0;
    const unit = ehAlcaGlobal
      ? Math.round((valorBase * 2 + Number.EPSILON) * 10000) / 10000
      : valorBase;
    const subtotal = arredondar(qty * unit);`;

    const setorAntigo = `      precoReferenciaId: price?.id || "",
      servicoId: price?.id || "",
      setor: AREA,
      setorLabel: "Corte",
      dataEntrega: movement.dataChegada,`;

    const setorNovo = `      precoReferenciaId: price?.id || "",
      servicoId: price?.id || "",
      setor: ehAlcaGlobal ? "alca" : (ehLateralReferencia ? "lateral" : AREA),
      setorLabel: ehAlcaGlobal ? "Alça" : (ehLateralReferencia ? "Lateral" : "Corte"),
      dataEntrega: movement.dataChegada,`;

    const quantidadeAntiga = `      quantidade: qty,
      falta: numero(movement.falta),`;

    const quantidadeNova = `      quantidade: qty,
      ...(ehAlcaGlobal ? {
        quantidadeAlcas: qty * 2,
        multiplicadorAlcas: 2,
        valorUnitarioAlca: valorBase,
        formaValorPagamento: "valor_global_alca",
        calculoAlca: "quantidade_recebida_x_2_x_valor_alca"
      } : {}),
      ...(ehLateralReferencia ? {
        formaValorPagamento: "valor_unitario_referencia",
        calculoLateral: "quantidade_recebida_x_valor_referencia",
        origemPrecoLateral: "precosReferencia"
      } : {}),
      falta: numero(movement.falta),`;

    const statusAntigo = `      statusPagamento: price ? "pendente" : "sem_valor",
      valorPendente: !price,
      avisoPagamento: price ? "" : \`Adicionar valor para Ref. \${movement.referencia || "-"} + \${movement.processo || "-"}.\`,
      observacoes: price ? "Gerado pela chegada da área Corte." : "Valor a definir: não existe preço cadastrado para esta referência e processo de Corte.",`;

    const statusNovo = `      statusPagamento: price ? "pendente" : "sem_valor",
      valorPendente: !price,
      valorManualFinanceiroPendente: !price,
      avisoPagamento: price
        ? ""
        : (conflitoPrecoLateral
          ? \`Existem valores ativos diferentes para Ref. \${movement.referencia || "-"} + LATERAL. Revise o Gerenciador de valores.\`
          : \`Adicionar valor para Ref. \${movement.referencia || "-"} + \${movement.processo || "-"}.\`),
      observacoes: price
        ? (ehLateralReferencia
          ? "Gerado pela chegada da área Lateral e Alça com o valor cadastrado da referência."
          : "Gerado pela chegada da área Corte.")
        : (conflitoPrecoLateral
          ? "Valor a definir: existem valores ativos diferentes para esta referência de LATERAL."
          : "Valor a definir: não existe preço cadastrado para esta referência e processo de Corte."),`;

    const carregamentoAntigo = `  async function carregarTudoCorte() {
    if (carregando) return;
    carregando = true;
    const button = document.getElementById("btnCorteAtualizar");
    if (button) { button.disabled = true; button.textContent = "Atualizando..."; }
    try {
      if (!perfil) await carregarPerfil();
      await Promise.all([carregarProcessos(), carregarFaccoes(), carregarMovimentos(), carregarPrecos(), carregarPagamentosCorte()]);
      renderTudo();
    } catch (error) {
      console.error(error);
      toast("Não foi possível carregar todos os dados da área Corte.", "error");
    } finally {
      carregando = false;
      if (button) { button.disabled = false; button.textContent = "Atualizar"; }
    }
  }`;

    const carregamentoNovo = `  async function carregarTudoCorte(forcar = false) {
    if (carregando) return;

    const estadoCache = window.__CORPONU_CORTE_CACHE_158__ || (window.__CORPONU_CORTE_CACHE_158__ = {
      completoEm: 0
    });
    const CACHE_COMPLETO_MS = 45 * 1000;
    const cacheAindaValido = !forcar &&
      estadoCache.completoEm > 0 &&
      Date.now() - estadoCache.completoEm < CACHE_COMPLETO_MS &&
      movimentos.length > 0;

    if (cacheAindaValido) {
      renderTudo();
      return;
    }

    carregando = true;
    const button = document.getElementById("btnCorteAtualizar");
    if (button) { button.disabled = true; button.textContent = "Atualizando..."; }

    const ordenarMovimentos = () => {
      movimentos.sort((a, b) => {
        const da = a.atualizadoEm?.toMillis?.() || a.criadoEm?.toMillis?.() || Date.parse(a.dataEnvio || "") || 0;
        const db = b.atualizadoEm?.toMillis?.() || b.criadoEm?.toMillis?.() || Date.parse(b.dataEnvio || "") || 0;
        return db - da;
      });
    };

    const tentarCacheLocalMovimentos = async () => {
      try {
        const c = await aguardarContexto();
        if (typeof c.fs.getDocsFromCache !== "function") return false;
        const consulta = c.fs.query(
          c.fs.collection(c.db, "movimentacoesProducao"),
          c.fs.where("area", "==", AREA)
        );
        const snap = await c.fs.getDocsFromCache(consulta);
        if (snap.empty) return false;
        movimentos = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        ordenarMovimentos();
        renderTudo();
        return true;
      } catch (error) {
        return false;
      }
    };

    try {
      // 1) Mostra imediatamente o que já estiver no cache persistente do navegador.
      await tentarCacheLocalMovimentos();

      // 2) Prioriza somente as movimentações do servidor. A tabela aparece antes
      // de esperar perfil, processos, facções, preços e pagamentos.
      await carregarMovimentos();
      renderTudo();

      // 3) Completa perfil e processos. Eles refinam permissões, rótulos e filtros.
      const etapaPrincipal = [];
      if (!perfil) etapaPrincipal.push(carregarPerfil());
      etapaPrincipal.push(carregarProcessos());
      await Promise.allSettled(etapaPrincipal);
      renderTudo();

      // 4) Dados auxiliares terminam em segundo plano lógico e só então refinam
      // cartões financeiros, facções e valores. Não bloqueiam a tabela principal.
      await Promise.allSettled([
        carregarFaccoes(),
        carregarPrecos(),
        carregarPagamentosCorte()
      ]);
      renderTudo();
      estadoCache.completoEm = Date.now();
    } catch (error) {
      console.error(error);
      toast("Não foi possível carregar todos os dados da área Lateral e Alça.", "error");
    } finally {
      carregando = false;
      if (button) { button.disabled = false; button.textContent = "Atualizar"; }
    }
  }`;

    const cliqueAtualizarAntigo = `      if (target.closest("#btnCorteAtualizar")) return carregarTudoCorte();`;
    const cliqueAtualizarNovo = `      if (target.closest("#btnCorteAtualizar")) return carregarTudoCorte(true);`;

    const substituicoes = [
      [inicioAntigo, inicioNovo, "início do gerador"],
      [calculoAntigo, calculoNovo, "cálculo de LATERAL e ALÇA"],
      [setorAntigo, setorNovo, "setor do pagamento"],
      [quantidadeAntiga, quantidadeNova, "metadados de quantidade"],
      [statusAntigo, statusNovo, "situação do pagamento"],
      [carregamentoAntigo, carregamentoNovo, "carregamento progressivo de Lateral e Alça"],
      [cliqueAtualizarAntigo, cliqueAtualizarNovo, "atualização manual forçada de Lateral e Alça"]
    ];

    substituicoes.forEach(([antigo, novo, descricao]) => {
      if (!fonte.includes(antigo)) {
        console.error(`Hotfix de LATERAL e ALÇA não encontrou: ${descricao}.`);
        return;
      }
      fonte = fonte.replace(antigo, novo);
    });

    // Depois de operações que realmente alteram dados, não reutiliza o cache curto.
    fonte = fonte.replaceAll("await carregarTudoCorte();", "await carregarTudoCorte(true);");

    return fonte;
  }

  function carregarAjustesFinais() {
    carregarScript(
      "corponu-faccoes-corte-sem-gerenciamento.js",
      "faccoes-corte-sem-gerenciamento",
      "Não foi possível remover o gerenciamento duplicado da aba Corte."
    );

    carregarScript(
      "corponu-faccoes-processos-cadastrados.js",
      "faccoes-processos-cadastrados",
      "Não foi possível carregar os processos cadastrados no registro de saída."
    );

    carregarScript(
      "corponu-faccoes-sem-resumo-processos.js",
      "faccoes-sem-resumo-processos",
      "Não foi possível remover o bloco de processos da tela de Facções."
    );

    carregarScript(
      "corponu-lateral-observacao-opcional.js",
      "lateral-observacao-opcional",
      "Não foi possível tornar a observação opcional na chegada de Lateral."
    );
  }

  function carregarCorrecaoTresAbas() {
    carregarScript(
      "corponu-faccoes-tres-abas-saida.js",
      "faccoes-tres-abas-saida",
      "Não foi possível carregar a correção das três abas de Facções.",
      carregarAjustesFinais
    );
  }

  function iniciarAreaFaccoes() {
    Promise.all(parts.map(name => fetch(`./${name}?v=${encodeURIComponent(VERSION)}&t=${Date.now()}`, { cache: "no-store" }).then(response => {
      if (!response.ok) throw new Error(`${name}: ${response.status}`);
      return response.text();
    }))).then(chunks => {
      const fonteCorrigida = aplicarHotfixLateralEAlcaNoFonte(chunks.join(""));
      const blob = new Blob([fonteCorrigida], { type: "text/javascript" });
      const url = URL.createObjectURL(blob);
      const script = document.createElement("script");
      script.src = url;
      script.async = false;
      script.dataset.corponuFaccoesCorte = VERSION;
      script.onload = () => {
        URL.revokeObjectURL(url);
        carregarCorrecaoTresAbas();
      };
      script.onerror = () => {
        URL.revokeObjectURL(url);
        console.error("Não foi possível iniciar a área Corte das facções.");
      };
      document.head.appendChild(script);
    }).catch(error => console.error("Não foi possível carregar a área Corte das facções.", error));
  }

  carregarScript(
    "corponu-saida-sem-confirmacao.js",
    "saida-sem-confirmacao-dupla",
    "Não foi possível carregar a proteção contra saída duplicada.",
    iniciarAreaFaccoes
  );
})();