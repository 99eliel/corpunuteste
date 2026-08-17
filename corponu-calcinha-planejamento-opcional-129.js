(() => {
  "use strict";

  const VERSION = "2026-08-04-calcinha-planejamento-opcional-129";
  const GUARD_SELECTOR = 'script[data-corponu-dual-mode="1"]';
  const SOURCE_URL = "./corponu-dual-mode.js";

  if (window.__CORPONU_CALCINHA_PLANEJAMENTO_OPCIONAL_129__ === VERSION) return;
  window.__CORPONU_CALCINHA_PLANEJAMENTO_OPCIONAL_129__ = VERSION;

  function substituirUma(fonte, antigo, novo, descricao) {
    if (!fonte.includes(antigo)) {
      throw new Error(`Trecho não encontrado: ${descricao}.`);
    }
    return fonte.replace(antigo, novo);
  }

  function substituirTodas(fonte, antigo, novo, quantidadeEsperada, descricao) {
    const quantidade = fonte.split(antigo).length - 1;
    if (quantidade !== quantidadeEsperada) {
      throw new Error(`${descricao}: esperado ${quantidadeEsperada}, encontrado ${quantidade}.`);
    }
    return fonte.split(antigo).join(novo);
  }

  function aplicarCorrecao(fonteOriginal) {
    let fonte = String(fonteOriginal || "");

    fonte = substituirUma(
      fonte,
      'const VERSION = "2026-07-28-calcinha-sem-silk-envio-historico-2";',
      `const VERSION = "${VERSION}";`,
      "versão do modo Sutiã/Calcinha"
    );

    fonte = substituirUma(
      fonte,
      '? "Informe necessidade, serviço e facção no planejamento. Cotton Line/Corpo Nu será preenchido no Manejo."',
      '? "Informe a necessidade. Serviço e facção são opcionais e podem ser definidos somente no envio para facção. Cotton Line/Corpo Nu será preenchido no Manejo."',
      "descrição do cadastro da OP de calcinha"
    );

    fonte = substituirUma(
      fonte,
      '<div class="notice small"><strong>Planejamento da calcinha:</strong> a linha Cotton Line/Corpo Nu ficará em branco e será informada depois no Manejo.</div>',
      '<div class="notice small"><strong>Planejamento da calcinha:</strong> serviço e facção são opcionais. Quando ficarem vazios, serão escolhidos somente no envio para facção. A linha Cotton Line/Corpo Nu será informada no Manejo.</div>',
      "aviso do planejamento manual"
    );

    fonte = substituirUma(
      fonte,
      '<label class="corponu-dual-field">Serviço<select id="ordemCalcinhaProcesso"><option value="">Selecione</option>',
      '<label class="corponu-dual-field">Serviço (opcional)<select id="ordemCalcinhaProcesso"><option value="">Deixar para definir no envio</option>',
      "campo de serviço manual"
    );

    fonte = substituirUma(
      fonte,
      '<label class="corponu-dual-field">Facção<select id="ordemCalcinhaFaccao" disabled><option value="">Primeiro selecione o serviço</option></select></label>',
      '<label class="corponu-dual-field">Facção (opcional)<select id="ordemCalcinhaFaccao" disabled><option value="">Deixar para definir no envio</option></select></label>',
      "campo de facção manual"
    );

    fonte = substituirUma(
      fonte,
      '<span>Serviço da calcinha</span><select id="pdfCalcinhaProcesso"><option value="">Selecione</option>',
      '<span>Serviço da calcinha (opcional)</span><select id="pdfCalcinhaProcesso"><option value="">Deixar para definir no envio</option>',
      "campo de serviço do PDF"
    );

    fonte = substituirUma(
      fonte,
      '<span>Facção de destino</span><select id="pdfCalcinhaFaccao" disabled><option value="">Primeiro selecione o serviço</option></select>',
      '<span>Facção de destino (opcional)</span><select id="pdfCalcinhaFaccao" disabled><option value="">Deixar para definir no envio</option></select>',
      "campo de facção do PDF"
    );

    fonte = substituirUma(
      fonte,
      'select.innerHTML = `<option value="">Primeiro selecione o serviço</option>`;',
      'select.innerHTML = `<option value="">Deixar para definir no envio</option>`;',
      "estado vazio do seletor de facção"
    );

    fonte = substituirUma(
      fonte,
      'select.innerHTML = `<option value="">Selecione a facção</option>${[...new Set(names.map(item => String(item || "").trim()).filter(Boolean))].map(name => `<option value="${escapeHtml(normalize(name))}">${escapeHtml(normalize(name))}</option>`).join("")}`;',
      'select.innerHTML = `<option value="">Deixar facção para definir no envio</option>${[...new Set(names.map(item => String(item || "").trim()).filter(Boolean))].map(name => `<option value="${escapeHtml(normalize(name))}">${escapeHtml(normalize(name))}</option>`).join("")}`;',
      "opção vazia da facção"
    );

    const validacaoManual = `    if (!CALCINHA_PROCESSES.includes(process) || !faction) {
      toast("Selecione o serviço e a facção planejada.", "error");
      return;
    }
`;
    fonte = substituirUma(fonte, validacaoManual, "", "validação obrigatória no cadastro manual");

    const validacaoPdf = `    if (!CALCINHA_PROCESSES.includes(process) || !faction) {
      toast("Selecione o serviço e a facção de destino das calcinhas.", "error");
      return;
    }
`;
    fonte = substituirUma(fonte, validacaoPdf, "", "validação obrigatória na importação do PDF");

    fonte = substituirTodas(
      fonte,
      "      planejamentoCalcinhaPendente: false,",
      "      planejamentoCalcinhaPendente: !(CALCINHA_PROCESSES.includes(process) && Boolean(faction)),",
      2,
      "marcação do planejamento pendente"
    );

    fonte = substituirUma(
      fonte,
      'await registerLog(currentId ? "ordem_atualizada" : "ordem_criada", "ordemProducao", documentId, `Calcinha | OP ${opNumber} | Ref. ${reference} | ${process} | ${faction}`);',
      'await registerLog(currentId ? "ordem_atualizada" : "ordem_criada", "ordemProducao", documentId, `Calcinha | OP ${opNumber} | Ref. ${reference} | ${process || "SERVIÇO A DEFINIR"} | ${faction || "FACÇÃO A DEFINIR"}`);',
      "log da OP manual"
    );

    const envioAntigo = `    if (historical) {
      const choice = await chooseHistoricalPantyDestination(order);
      if (!choice) return;
      process = choice.process;
      faction = choice.faction;
    } else if (!CALCINHA_PROCESSES.includes(process) || !faction) {
      toast("Esta nova OP não possui serviço/facção planejados. Edite a OP na aba Ordens → Calcinha.", "error");
      return;
    }
`;
    const envioNovo = `    if (historical || !CALCINHA_PROCESSES.includes(process) || !faction) {
      const choice = await chooseHistoricalPantyDestination(order);
      if (!choice) return;
      process = choice.process;
      faction = choice.faction;
    }
`;
    fonte = substituirUma(fonte, envioAntigo, envioNovo, "escolha no momento do envio");

    fonte = substituirUma(
      fonte,
      '<h3 id="corponuHistoricoEnvioTitulo">Enviar calcinha histórica para facção</h3>',
      '<h3 id="corponuHistoricoEnvioTitulo">Escolher serviço e facção para o envio</h3>',
      "título do modal de envio"
    );

    fonte = substituirUma(
      fonte,
      '<div class="notice small"><strong>Registro importado:</strong> como esta OP veio da planilha antiga, o planejamento de serviço e facção será definido agora.</div>',
      '<div class="notice small"><strong>Definição no envio:</strong> escolha agora o serviço e a facção desta OP. Esses campos são opcionais no cadastro/importação da ordem.</div>',
      "aviso do modal de envio"
    );

    fonte = substituirUma(
      fonte,
      'if (!confirm(`Importar ${records.length} OP(s) de calcinha para ${faction}, serviço ${process}? A linha Cotton Line/Corpo Nu ficará em branco para preenchimento no Manejo.`)) return;',
      'const planejamentoImportacao = process && faction ? ` para ${faction}, serviço ${process}` : " sem serviço e facção definidos";\n    if (!confirm(`Importar ${records.length} OP(s) de calcinha${planejamentoImportacao}? A linha Cotton Line/Corpo Nu ficará em branco para preenchimento no Manejo.`)) return;',
      "confirmação da importação"
    );

    fonte = substituirUma(
      fonte,
      'observacoes: `Importada do PDF como calcinha. Serviço: ${process}. Facção: ${faction}. Linha a definir no Manejo.`,',
      'observacoes: process && faction\n            ? `Importada do PDF como calcinha. Serviço: ${process}. Facção: ${faction}. Linha a definir no Manejo.`\n            : "Importada do PDF como calcinha. Serviço e facção serão definidos no envio. Linha a definir no Manejo.",',
      "observação da OP importada"
    );

    fonte = substituirUma(
      fonte,
      'await registerLog("pdf_importado", "importacao", "pdf-calcinha", `${imported} OPs de calcinha importadas. Serviço ${process}; facção ${faction}; ignoradas ${skipped}.`);',
      'await registerLog("pdf_importado", "importacao", "pdf-calcinha", `${imported} OPs de calcinha importadas. ${process && faction ? `Serviço ${process}; facção ${faction}` : "Serviço e facção a definir no envio"}; ignoradas ${skipped}.`);',
      "log da importação"
    );

    return fonte;
  }

  function carregarFonteOriginal() {
    return fetch(`${SOURCE_URL}?v=${encodeURIComponent(VERSION)}&t=${Date.now()}`, { cache: "no-store" })
      .then(response => {
        if (!response.ok) throw new Error(`Falha ao carregar o modo Sutiã/Calcinha (${response.status}).`);
        return response.text();
      });
  }

  function executarFonte(fonte) {
    let marcador = document.querySelector(GUARD_SELECTOR);
    if (!marcador) {
      marcador = document.createElement("script");
      marcador.dataset.corponuDualMode = "1";
      marcador.dataset.corponuDualOpcionalGuard = VERSION;
      document.head.appendChild(marcador);
    }

    const blob = new Blob([fonte], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    marcador.async = false;
    marcador.src = url;
    marcador.onload = () => URL.revokeObjectURL(url);
    marcador.onerror = () => {
      URL.revokeObjectURL(url);
      console.error("Não foi possível executar o modo Sutiã/Calcinha com planejamento opcional.");
    };
  }

  async function iniciar() {
    try {
      const fonte = await carregarFonteOriginal();
      executarFonte(aplicarCorrecao(fonte));
    } catch (error) {
      console.error("Planejamento opcional de calcinha não pôde ser ativado.", error);
      const marcador = document.querySelector(GUARD_SELECTOR);
      if (marcador && !marcador.src) {
        marcador.src = `${SOURCE_URL}?fallback=1&t=${Date.now()}`;
      }
    }
  }

  iniciar();
})();

// Proteção visual isolada do salvamento no Manejo Calcinha.
// Não altera a gravação nem o renderizador do sistema. Apenas mantém a tabela
// visualmente estável enquanto os snapshots do Firestore são processados.
(() => {
  "use strict";

  const VERSION = "2026-08-17-calcinha-manejo-salvamento-estavel-168";
  const TEMPO_ESTABILIZACAO = 650;
  const TEMPO_SEGURANCA = 10000;

  if (window.__CORPONU_CALCINHA_MANEJO_SALVAMENTO_ESTAVEL__ === VERSION) return;
  window.__CORPONU_CALCINHA_MANEJO_SALVAMENTO_ESTAVEL__ = VERSION;

  let salvamentoProtegido = false;
  let timerSeguranca = 0;

  function manejoCalcinhaAtivo() {
    const ativa = document.querySelector('.manejo-setor-btn.active[data-setor="calcinha"]');
    return Boolean(ativa) || document.body.dataset.corponuManejoTipo === "calcinha";
  }

  function copiarEstadoDosCampos(origem, copia) {
    const originais = [...origem.querySelectorAll("input, select, textarea")];
    const copias = [...copia.querySelectorAll("input, select, textarea")];

    originais.forEach((campo, indice) => {
      const destino = copias[indice];
      if (!destino) return;

      if (campo instanceof HTMLInputElement && destino instanceof HTMLInputElement) {
        destino.value = campo.value;
        destino.checked = campo.checked;
      } else if (campo instanceof HTMLSelectElement && destino instanceof HTMLSelectElement) {
        destino.value = campo.value;
        destino.selectedIndex = campo.selectedIndex;
      } else if (campo instanceof HTMLTextAreaElement && destino instanceof HTMLTextAreaElement) {
        destino.value = campo.value;
        destino.textContent = campo.value;
      }
    });
  }

  function criarProtecaoVisual(botao) {
    const tabelaWrap = botao?.closest(".table-wrap") || document.querySelector("#manejo .table-wrap");
    if (!(tabelaWrap instanceof HTMLElement)) return () => {};

    const retangulo = tabelaWrap.getBoundingClientRect();
    if (!retangulo.width || !retangulo.height) return () => {};

    const botoesOriginais = [...tabelaWrap.querySelectorAll(".btn-save-manejo")];
    const indiceBotao = botoesOriginais.indexOf(botao);

    const copia = tabelaWrap.cloneNode(true);
    copiarEstadoDosCampos(tabelaWrap, copia);

    const botoesCopia = [...copia.querySelectorAll(".btn-save-manejo")];
    const botaoCopia = indiceBotao >= 0 ? botoesCopia[indiceBotao] : null;
    if (botaoCopia) {
      botaoCopia.textContent = "Salvando...";
      botaoCopia.disabled = true;
    }

    // Evita IDs duplicados e qualquer ação acidental dentro da cópia visual.
    copia.removeAttribute("id");
    copia.querySelectorAll("[id]").forEach(elemento => elemento.removeAttribute("id"));
    copia.querySelectorAll("[onclick]").forEach(elemento => elemento.removeAttribute("onclick"));

    Object.assign(copia.style, {
      position: "fixed",
      left: `${retangulo.left}px`,
      top: `${retangulo.top}px`,
      width: `${retangulo.width}px`,
      height: `${retangulo.height}px`,
      maxWidth: `${retangulo.width}px`,
      maxHeight: `${retangulo.height}px`,
      margin: "0",
      zIndex: "99960",
      background: "#ffffff",
      overflow: "hidden",
      pointerEvents: "auto",
      boxSizing: "border-box"
    });

    copia.setAttribute("aria-hidden", "true");
    copia.dataset.corponuManejoCalcinhaProtecao = VERSION;

    const bloqueador = document.createElement("div");
    Object.assign(bloqueador.style, {
      position: "absolute",
      inset: "0",
      zIndex: "10",
      cursor: "wait",
      background: "transparent"
    });
    bloqueador.addEventListener("click", evento => {
      evento.preventDefault();
      evento.stopPropagation();
    });
    copia.appendChild(bloqueador);

    document.body.appendChild(copia);
    copia.scrollLeft = tabelaWrap.scrollLeft;
    copia.scrollTop = tabelaWrap.scrollTop;

    let removida = false;
    return () => {
      if (removida) return;
      removida = true;
      copia.remove();
    };
  }

  function finalizarProtecao(removerProtecao) {
    window.clearTimeout(timerSeguranca);
    timerSeguranca = 0;

    window.setTimeout(() => {
      try {
        removerProtecao?.();
      } finally {
        salvamentoProtegido = false;
      }
    }, TEMPO_ESTABILIZACAO);
  }

  function protegerCliqueDeSalvar(evento) {
    const alvo = evento.target instanceof Element ? evento.target : null;
    const botao = alvo?.closest?.(".btn-save-manejo");
    if (!botao || !manejoCalcinhaAtivo()) return;

    if (salvamentoProtegido) {
      evento.preventDefault();
      evento.stopPropagation();
      evento.stopImmediatePropagation();
      return;
    }

    const salvarOriginal = window.salvarManejoLinha;
    if (typeof salvarOriginal !== "function") return;

    // Fecha qualquer lista de nomes aberta antes dos snapshots começarem.
    const campoAtivo = document.activeElement;
    if (campoAtivo instanceof HTMLInputElement && campoAtivo.hasAttribute("list")) {
      campoAtivo.blur();
    }

    const removerProtecao = criarProtecaoVisual(botao);
    salvamentoProtegido = true;

    let wrapper;
    const restaurarFuncaoOriginal = () => {
      if (window.salvarManejoLinha === wrapper) {
        window.salvarManejoLinha = salvarOriginal;
      }
    };

    wrapper = async function salvarManejoLinhaCalcinhaEstavel(...argumentos) {
      try {
        return await salvarOriginal.apply(this, argumentos);
      } finally {
        restaurarFuncaoOriginal();
        finalizarProtecao(removerProtecao);
      }
    };

    // O onclick já existente chama este wrapper somente nesta gravação.
    window.salvarManejoLinha = wrapper;

    // Fallback: nunca deixa a proteção presa se houver uma exceção externa.
    timerSeguranca = window.setTimeout(() => {
      restaurarFuncaoOriginal();
      removerProtecao();
      salvamentoProtegido = false;
    }, TEMPO_SEGURANCA);
  }

  document.addEventListener("click", protegerCliqueDeSalvar, true);
})();
