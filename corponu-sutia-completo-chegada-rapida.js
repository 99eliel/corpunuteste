(() => {
  "use strict";

  const VERSION = "2026-08-11-origem-componentes-chegada-169";
  const FIREBASE_VERSION = "10.12.5";
  const PROCESSO_COMPLETO = "SUTIÃ COMPLETO";
  const PROCESSO_LATERAL = "LATERAL";
  const PROCESSO_BOJO = "ENCAPAR BOJO";
  const CONFIG_DOC = "sutia-completo-pagamento";
  const FORM_PADRAO = "formChegadaMovimentacao";
  const FORM_MANUAL = "formChegadaManualFaccao";

  if (window.__CORPONU_SUTIA_CHEGADA_RAPIDA_107__ === VERSION) return;
  window.__CORPONU_SUTIA_CHEGADA_RAPIDA_107__ = VERSION;

  let firebasePromise = null;
  let configCache = null;
  let configCacheEm = 0;
  let precosCache = null;
  let precosCacheEm = 0;
  let observer = null;
  const processando = new Set();

  const texto = valor => String(valor ?? "").trim();
  const normalizar = valor => texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  const normalizarReferencia = valor => texto(valor).replace(/\s+/g, "").toUpperCase();
  const numero = (valor, padrao = 0) => {
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : padrao;
    const bruto = texto(valor);
    if (!bruto) return padrao;
    const convertido = Number(bruto.includes(",")
      ? bruto.replace(/\./g, "").replace(",", ".")
      : bruto);
    return Number.isFinite(convertido) ? convertido : padrao;
  };
  const arred4 = valor => Math.round((numero(valor) + Number.EPSILON) * 10000) / 10000;
  const arred2 = valor => Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
  const moeda = valor => numero(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const moeda4 = valor => `R$ ${numero(valor).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;

  function processoCanonico(valor) {
    const chave = normalizar(valor);
    if (chave === "SUTIA COMPLETO") return PROCESSO_COMPLETO;
    if (chave === "LATERAL" || chave === "CORTE") return PROCESSO_LATERAL;
    if (["ENCAPAR BOJO", "ENCAPAR BOJOS", "BOJO"].includes(chave)) return PROCESSO_BOJO;
    return texto(valor).toUpperCase();
  }

  function docIdSeguro(valor) {
    return texto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 220) || `item-${Date.now()}`;
  }

  function escapar(valor) {
    return String(valor ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function avisar(mensagem, erro = false) {
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = mensagem;
      toast.classList.remove("hidden");
      toast.style.background = erro ? "#991b1b" : "#166534";
      window.clearTimeout(window.__corponuSutiaRapidoToast107);
      window.__corponuSutiaRapidoToast107 = window.setTimeout(() => {
        toast.classList.add("hidden");
        toast.style.background = "";
      }, 6500);
      return;
    }
    window.alert(mensagem);
  }

  async function firebase() {
    if (firebasePromise) return firebasePromise;
    firebasePromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
    ]).then(([appMod, authMod, fs]) => {
      if (!appMod.getApps().length) throw new Error("Firebase ainda não foi inicializado.");
      const app = appMod.getApp();
      return {
        fs,
        db: fs.getFirestore(app),
        auth: authMod.getAuth(app)
      };
    }).catch(error => {
      firebasePromise = null;
      throw error;
    });
    return firebasePromise;
  }

  function injetarEstilos() {
    if (document.getElementById("styleSutiaChegadaRapida107")) return;
    const style = document.createElement("style");
    style.id = "styleSutiaChegadaRapida107";
    style.textContent = `
      .sc107-binario{display:flex!important;flex:1 1 220px;flex-direction:column;align-items:stretch!important;gap:5px!important;cursor:default!important}
      .sc107-binario>span{color:#334155;font-size:11px;font-weight:900}
      .sc107-binario select{width:100%;min-height:40px;padding:8px 10px;border:1px solid #a78bfa;border-radius:9px;background:#fff;color:#0f172a;font:800 12px/1.3 inherit}
      .sc107-binario select:invalid{border-color:#f59e0b;background:#fffbeb}
      .sc107-binario small{color:#64748b;font-size:10px;line-height:1.35}
      .sc107-salvando{opacity:.72;pointer-events:none}
    `;
    document.head.appendChild(style);
  }

  function prefixoDoPainel(painel) {
    return painel?.id === "sutCompletoComponentesChegadaManual" ? "sc51m" : "sc51";
  }

  function formularioDoPrefixo(prefixo) {
    return document.getElementById(prefixo === "sc51m" ? FORM_MANUAL : FORM_PADRAO);
  }

  function criarSelectBinario(prefixo, tipo, checkbox, label) {
    const id = `${prefixo}${tipo === "fecho" ? "FechoResposta107" : "PontoLuzResposta107"}`;
    let select = document.getElementById(id);
    if (select) return select;

    const wrapper = checkbox?.closest("label");
    if (!(wrapper instanceof HTMLElement)) return null;

    checkbox.hidden = true;
    checkbox.tabIndex = -1;
    checkbox.setAttribute("aria-hidden", "true");
    wrapper.classList.add("sc107-binario");
    wrapper.innerHTML = `
      <span>${escapar(label)}</span>
      <select id="${id}" required>
        <option value="">Selecione</option>
        <option value="sim">Sim</option>
        <option value="nao">Não</option>
      </select>
      <small>Escolha obrigatória para gerar o pagamento.</small>
    `;
    wrapper.appendChild(checkbox);
    select = document.getElementById(id);

    select?.addEventListener("change", () => {
      checkbox.checked = select.value === "sim";
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    });
    return select;
  }

  function ajustarEspecial(form, prefixo) {
    const especial = form?.dataset?.sutia912Rapido === "1";
    ["FechoResposta107", "PontoLuzResposta107"].forEach(sufixo => {
      const select = document.getElementById(`${prefixo}${sufixo}`);
      if (!(select instanceof HTMLSelectElement)) return;
      if (especial) {
        select.value = "sim";
        select.required = false;
        select.disabled = true;
        const checkboxId = sufixo.startsWith("Fecho") ? `${prefixo}FechoPronto` : `${prefixo}PontoLuzPronto`;
        const checkbox = document.getElementById(checkboxId);
        if (checkbox instanceof HTMLInputElement) checkbox.checked = true;
      } else {
        select.disabled = false;
        select.required = true;
      }
    });
  }

  function aprimorarPainel(painel) {
    if (!(painel instanceof HTMLElement)) return;
    const prefixo = prefixoDoPainel(painel);
    const form = formularioDoPrefixo(prefixo);
    const fecho = document.getElementById(`${prefixo}FechoPronto`);
    const ponto = document.getElementById(`${prefixo}PontoLuzPronto`);

    if (fecho instanceof HTMLInputElement) criarSelectBinario(prefixo, "fecho", fecho, "A peça veio com fecho?");
    if (ponto instanceof HTMLInputElement) criarSelectBinario(prefixo, "ponto", ponto, "A peça veio com ponto de luz?");
    ajustarEspecial(form, prefixo);
  }

  function aprimorarPaineis() {
    aprimorarPainel(document.getElementById("sutCompletoComponentesChegada"));
    aprimorarPainel(document.getElementById("sutCompletoComponentesChegadaManual"));
  }

  function componenteDoPainel(prefixo, nome) {
    const titulo = nome === "lateral" ? "Lateral" : "Bojo";
    const select = document.getElementById(`${prefixo}${titulo}Situacao`);
    const responsavelInput = document.getElementById(`${prefixo}${titulo}Responsavel`);
    const card = document.querySelector(`#${prefixo === "sc51m" ? "sutCompletoComponentesChegadaManual" : "sutCompletoComponentesChegada"} [data-componente="${nome}"]`);

    if (select instanceof HTMLSelectElement) {
      const valor = texto(select.value);
      return {
        conhecido: ["faccao", "confeccao", "sim", "nao"].includes(valor),
        pronto: ["faccao", "confeccao", "sim"].includes(valor),
        descontar: valor === "confeccao" || valor === "sim",
        feitoPelaFaccao: valor === "faccao",
        feitoPelaConfeccao: valor === "confeccao",
        origemExecucao: valor === "faccao" ? "faccao" : valor === "confeccao" ? "confeccao" : "legado",
        responsavel: texto(responsavelInput?.value),
        origem: valor === "faccao" ? "Feito pela facção na chegada do Sutiã Completo" : valor === "confeccao" ? "Feito pela confecção" : "Informado na chegada do Sutiã Completo",
        informadoAgora: true
      };
    }

    const pill = card?.querySelector(".sc51-pill");
    const pronto = pill?.classList.contains("sim") === true || normalizar(pill?.textContent).includes("PRONTA");
    const nao = pill?.classList.contains("nao") === true || normalizar(pill?.textContent).includes("NAO PRONTA");
    const detalhe = texto(card?.querySelector("small")?.textContent);
    const partes = detalhe.split("•").map(item => item.trim()).filter(Boolean);

    const descontoAttr = texto(card?.dataset?.descontar);
    const feitoPelaFaccao = card?.dataset?.feitoFaccao === "1";
    const feitoPelaConfeccao = card?.dataset?.feitoConfeccao === "1";
    return {
      conhecido: pronto || nao,
      pronto,
      descontar: descontoAttr === "1" ? true : descontoAttr === "0" ? false : pronto,
      feitoPelaFaccao,
      feitoPelaConfeccao,
      origemExecucao: texto(card?.dataset?.origemExecucao || ""),
      origem: partes[0] || "Informação registrada na OP",
      responsavel: partes.length > 1 ? partes[partes.length - 1] : "",
      informadoAgora: false
    };
  }

  function respostaBinaria(prefixo, tipo, especial) {
    if (especial) return true;
    const id = `${prefixo}${tipo === "fecho" ? "FechoResposta107" : "PontoLuzResposta107"}`;
    const select = document.getElementById(id);
    return select instanceof HTMLSelectElement ? select.value === "sim" : false;
  }

  function dadosPainel(prefixo, especial = false) {
    return {
      lateral: componenteDoPainel(prefixo, "lateral"),
      bojo: componenteDoPainel(prefixo, "bojo"),
      fechoPronto: respostaBinaria(prefixo, "fecho", especial),
      pontoLuzPronto: respostaBinaria(prefixo, "ponto", especial)
    };
  }

  function validarPainel(prefixo, especial = false) {
    if (especial) return dadosPainel(prefixo, true);
    const form = formularioDoPrefixo(prefixo);
    ajustarEspecial(form, prefixo);

    const fecho = document.getElementById(`${prefixo}FechoResposta107`);
    const ponto = document.getElementById(`${prefixo}PontoLuzResposta107`);
    if (fecho instanceof HTMLSelectElement && !fecho.value) {
      fecho.focus();
      avisar("Informe se a peça veio com fecho.", true);
      return null;
    }
    if (ponto instanceof HTMLSelectElement && !ponto.value) {
      ponto.focus();
      avisar("Informe se a peça veio com ponto de luz.", true);
      return null;
    }

    const dados = dadosPainel(prefixo, false);
    if (!dados.lateral.conhecido || !dados.bojo.conhecido) return null;
    return dados;
  }

  function moedaDoTexto(valor) {
    return numero(texto(valor).replace(/^R\$\s*/i, ""));
  }

  function extrairMoeda(resumo, regex) {
    const match = resumo.match(regex);
    return match ? moedaDoTexto(match[1]) : null;
  }

  function memoriaDoResumo(prefixo) {
    const resumo = texto(document.getElementById(`${prefixo}ResumoCalculo`)?.textContent);
    if (!resumo || /carregando|não foi possível/i.test(resumo)) return null;

    const base = extrairMoeda(resumo, /Base\s+(R\$\s*[\d.,]+)/i);
    const final = extrairMoeda(resumo, /Final por peça:\s*(R\$\s*[\d.,]+)/i);
    const lateral = extrairMoeda(resumo, /Lateral\s*[−-]\s*(R\$\s*[\d.,]+)/i) ?? 0;
    const bojo = extrairMoeda(resumo, /Bojo\s*[−-]\s*(R\$\s*[\d.,]+)/i) ?? 0;
    const fecho = extrairMoeda(resumo, /Fecho\s*[−-]\s*(R\$\s*[\d.,]+)/i) ?? 0;
    const pontoLuz = extrairMoeda(resumo, /Ponto de luz\s*[−-]\s*(R\$\s*[\d.,]+)/i) ?? 0;
    const faltantes = [];
    if (/Lateral[^•]*valor não cadastrado/i.test(resumo)) faltantes.push("LATERAL");
    if (/Bojo[^•]*valor não cadastrado/i.test(resumo)) faltantes.push("ENCAPAR BOJO");

    if (base === null || (final === null && !faltantes.length)) return null;
    return {
      base: arred4(base),
      descontos: {
        lateral: arred4(lateral),
        bojo: arred4(bojo),
        fecho: arred4(fecho),
        pontoLuz: arred4(pontoLuz)
      },
      valorUnitario: arred4(final ?? Math.max(base - lateral - bojo - fecho - pontoLuz, 0)),
      faltantes,
      precoLateralId: "",
      precoBojoId: "",
      origem: "resumo_pre_calculado"
    };
  }

  async function carregarConfig(forcar = false) {
    if (!forcar && configCache && Date.now() - configCacheEm < 120000) return configCache;
    const { fs, db } = await firebase();
    const snap = await fs.getDoc(fs.doc(db, "configuracoes", CONFIG_DOC));
    const dados = snap.exists() ? snap.data() : {};
    configCache = {
      valorBaseGeral: Math.max(0, numero(dados.valorBaseGeral, 5.5)),
      referenciaEspecial: normalizarReferencia(dados.referenciaEspecial || "912"),
      valorBaseReferenciaEspecial: Math.max(0, numero(dados.valorBaseReferenciaEspecial, 6.5)),
      descontoFechoNaoFeito: Math.max(0, numero(dados.descontoFechoNaoFeito, 0.25)),
      descontoPontoLuzNaoFeito: Math.max(0, numero(dados.descontoPontoLuzNaoFeito, 0.15))
    };
    configCacheEm = Date.now();
    return configCache;
  }

  async function carregarPrecos(forcar = false) {
    if (!forcar && precosCache && Date.now() - precosCacheEm < 120000) return precosCache;
    const { fs, db } = await firebase();
    const snap = await fs.getDocs(fs.collection(db, "precosReferencia"));
    precosCache = snap.docs.map(item => ({ id: item.id, ...item.data() })).filter(item => item.ativo !== false);
    precosCacheEm = Date.now();
    return precosCache;
  }

  function buscarPrecoEmLista(lista, processo, referencia) {
    const p = normalizar(processo);
    const r = normalizarReferencia(referencia);
    const candidatos = lista.filter(item =>
      normalizar(item.processo || item.servicoNome) === p &&
      normalizarReferencia(item.referencia) === r
    );
    const escolhido = candidatos.find(item => numero(item.valor) > 0) || candidatos[0];
    return escolhido ? { id: escolhido.id, valor: Math.max(0, numero(escolhido.valor)) } : null;
  }

  async function calcularFallback(referencia, dados, especialForcado = false) {
    const config = await carregarConfig();
    const especial = especialForcado || normalizarReferencia(referencia) === config.referenciaEspecial;
    if (especial) {
      return {
        especial: true,
        base: arred4(config.valorBaseReferenciaEspecial),
        descontos: { lateral: 0, bojo: 0, fecho: 0, pontoLuz: 0 },
        valorUnitario: arred4(config.valorBaseReferenciaEspecial),
        faltantes: [],
        precoLateralId: "",
        precoBojoId: "",
        origem: "config_referencia_especial"
      };
    }

    const precos = await carregarPrecos();
    const precoLateral = dados.lateral.descontar ? buscarPrecoEmLista(precos, PROCESSO_LATERAL, referencia) : null;
    const precoBojo = dados.bojo.descontar ? buscarPrecoEmLista(precos, PROCESSO_BOJO, referencia) : null;
    const faltantes = [];
    if (dados.lateral.descontar && !precoLateral) faltantes.push(`${PROCESSO_LATERAL} da referência ${referencia}`);
    if (dados.bojo.descontar && !precoBojo) faltantes.push(`${PROCESSO_BOJO} da referência ${referencia}`);

    const descontos = {
      lateral: dados.lateral.descontar && precoLateral ? arred4(precoLateral.valor) : 0,
      bojo: dados.bojo.descontar && precoBojo ? arred4(precoBojo.valor) : 0,
      fecho: dados.fechoPronto ? 0 : arred4(config.descontoFechoNaoFeito),
      pontoLuz: dados.pontoLuzPronto ? 0 : arred4(config.descontoPontoLuzNaoFeito)
    };
    return {
      especial: false,
      base: arred4(config.valorBaseGeral),
      descontos,
      valorUnitario: arred4(Math.max(config.valorBaseGeral - descontos.lateral - descontos.bojo - descontos.fecho - descontos.pontoLuz, 0)),
      faltantes,
      precoLateralId: precoLateral?.id || "",
      precoBojoId: precoBojo?.id || "",
      origem: "fallback_cache_valores"
    };
  }

  async function obterMemoria(prefixo, referencia, dados, especial) {
    if (!especial) {
      const resumo = memoriaDoResumo(prefixo);
      if (resumo) return resumo;
    }
    return calcularFallback(referencia, dados, especial);
  }

  function suprimirPosProcessamentoLegado(tipo) {
    const original = window.setTimeout;
    let restaurado = false;
    const alvo = tipo === "manual" ? "processarDepoisChegadaManual" : "processarDepoisChegadaPadrao";

    const restaurar = () => {
      if (restaurado) return;
      restaurado = true;
      if (window.setTimeout === interceptador) window.setTimeout = original;
    };

    function interceptador(callback, atraso, ...args) {
      const fonte = typeof callback === "function" ? Function.prototype.toString.call(callback) : "";
      if (Number(atraso || 0) === 0 && fonte.includes(alvo)) {
        restaurar();
        return 0;
      }
      const retorno = original.call(window, callback, atraso, ...args);
      restaurar();
      return retorno;
    }

    window.setTimeout = interceptador;
    original.call(window, restaurar, 80);
  }

  function bloquearForm(form, bloqueado) {
    if (!(form instanceof HTMLFormElement)) return;
    form.classList.toggle("sc107-salvando", bloqueado);
    form.querySelectorAll('button[type="submit"], input[type="submit"]').forEach(botao => {
      botao.disabled = bloqueado;
      if (bloqueado && !botao.dataset.textoSc107) {
        botao.dataset.textoSc107 = botao.textContent || botao.value || "";
        if ("value" in botao && botao.tagName === "INPUT") botao.value = "Salvando...";
        else botao.textContent = "Salvando...";
      } else if (!bloqueado && botao.dataset.textoSc107) {
        if ("value" in botao && botao.tagName === "INPUT") botao.value = botao.dataset.textoSc107;
        else botao.textContent = botao.dataset.textoSc107;
        delete botao.dataset.textoSc107;
      }
    });
  }

  function montarConferencia(dados, memoria, usuario, quantidade) {
    return {
      lateralPronta: dados.lateral.pronto,
      lateralDescontada: dados.lateral.descontar === true,
      lateralFeitaPelaFaccao: dados.lateral.feitoPelaFaccao === true,
      lateralFeitaPelaConfeccao: dados.lateral.feitoPelaConfeccao === true,
      lateralOrigemExecucao: dados.lateral.origemExecucao || "",
      lateralOrigem: dados.lateral.origem || "",
      lateralResponsavel: dados.lateral.responsavel || "",
      bojoPronto: dados.bojo.pronto,
      bojoDescontado: dados.bojo.descontar === true,
      bojoFeitoPelaFaccao: dados.bojo.feitoPelaFaccao === true,
      bojoFeitoPelaConfeccao: dados.bojo.feitoPelaConfeccao === true,
      bojoOrigemExecucao: dados.bojo.origemExecucao || "",
      bojoOrigem: dados.bojo.origem || "",
      bojoResponsavel: dados.bojo.responsavel || "",
      fechoPronto: dados.fechoPronto,
      pontoLuzPronto: dados.pontoLuzPronto,
      valorBase: arred4(memoria.base),
      descontoLateral: arred4(memoria.descontos.lateral),
      descontoBojo: arred4(memoria.descontos.bojo),
      descontoFecho: arred4(memoria.descontos.fecho),
      descontoPontoLuz: arred4(memoria.descontos.pontoLuz),
      valorUnitarioCalculado: arred4(memoria.valorUnitario),
      quantidade,
      faltantes: memoria.faltantes || [],
      regraReferenciaEspecialIntegral: memoria.especial === true,
      confirmadoPor: usuario?.uid || "",
      confirmadoEm: null,
      versao: VERSION
    };
  }

  function montarPagamento(mov, memoria, dados, quantidade, falta, descontoDefeito, usuario, agora) {
    const especial = memoria.especial === true;
    const faltando = (memoria.faltantes || []).length > 0;
    const descontoAplicado = especial ? 0 : Math.max(0, numero(descontoDefeito));
    const subtotalCalculado = arred2(quantidade * memoria.valorUnitario);
    const totalCalculado = arred2(Math.max(subtotalCalculado - descontoAplicado, 0));
    const pagamentoReenvio = Boolean(mov.movimentacaoOrigemId || mov.reenvio || mov.origem === "movimentacao");

    return {
      origem: "movimentacao",
      movimentacaoId: mov.id,
      movimentacaoOrigemId: mov.movimentacaoOrigemId || "",
      pagamentoReenvio,
      opId: mov.opId || "",
      numeroOP: mov.numeroOP || "",
      referencia: mov.referencia || "",
      cor: mov.cor || "",
      produtoNome: mov.produtoNome || "",
      faccao: mov.destino || "",
      precoReferenciaId: especial ? "" : `calculo-sutia-completo-${normalizarReferencia(mov.referencia)}`,
      processo: PROCESSO_COMPLETO,
      processoMovimentacao: PROCESSO_COMPLETO,
      servicoId: "calculo-automatico-sutia-completo",
      servicoNome: PROCESSO_COMPLETO,
      setor: mov.setor || "sutia",
      setorLabel: "Sutiã",
      dataEntrega: mov.dataChegada || "",
      quantidade,
      falta,
      descontoDefeito: descontoAplicado,
      subtotal: faltando ? 0 : subtotalCalculado,
      valorUnitario: faltando ? 0 : arred4(memoria.valorUnitario),
      total: faltando ? 0 : totalCalculado,
      valorTotal: faltando ? 0 : totalCalculado,
      statusPagamento: faltando ? "sem_valor" : "pendente",
      valorPendente: faltando,
      avisoPagamento: faltando ? `Aguardando ${memoria.faltantes.join(" e ")}.` : "",
      valorBaseSutiaCompleto: arred4(memoria.base),
      descontoSutiaCompletoLateral: arred4(memoria.descontos.lateral),
      descontoSutiaCompletoBojo: arred4(memoria.descontos.bojo),
      descontoSutiaCompletoFecho: arred4(memoria.descontos.fecho),
      descontoSutiaCompletoPontoLuz: arred4(memoria.descontos.pontoLuz),
      precoLateralReferenciaId: memoria.precoLateralId || "",
      precoBojoReferenciaId: memoria.precoBojoId || "",
      lateralPronta: dados.lateral.pronto,
      lateralDescontada: dados.lateral.descontar === true,
      lateralFeitaPelaFaccao: dados.lateral.feitoPelaFaccao === true,
      lateralFeitaPelaConfeccao: dados.lateral.feitoPelaConfeccao === true,
      lateralOrigemExecucao: dados.lateral.origemExecucao || "",
      lateralOrigem: dados.lateral.origem || "",
      lateralResponsavel: dados.lateral.responsavel || "",
      bojoPronto: dados.bojo.pronto,
      bojoDescontado: dados.bojo.descontar === true,
      bojoFeitoPelaFaccao: dados.bojo.feitoPelaFaccao === true,
      bojoFeitoPelaConfeccao: dados.bojo.feitoPelaConfeccao === true,
      bojoOrigemExecucao: dados.bojo.origemExecucao || "",
      bojoOrigem: dados.bojo.origem || "",
      bojoResponsavel: dados.bojo.responsavel || "",
      fechoPronto: dados.fechoPronto,
      pontoLuzPronto: dados.pontoLuzPronto,
      valorUnitarioCalculadoSutiaCompleto: arred4(memoria.valorUnitario),
      subtotalCalculadoSutiaCompleto: subtotalCalculado,
      totalCalculadoSutiaCompleto: totalCalculado,
      valorTotalDefinidoManualmente: !faltando,
      valorManualFinanceiro: false,
      formaValorPagamento: especial
        ? "VALOR_INTEGRAL_REFERENCIA_ESPECIAL"
        : "CALCULO_AUTOMATICO_SUTIA_COMPLETO",
      regraReferenciaEspecialIntegral: especial,
      referenciaEspecialIntegral: especial ? normalizarReferencia(mov.referencia) : "",
      valorReferenciaEspecialIntegral: especial ? arred4(memoria.valorUnitario) : 0,
      memoriaCalculoSutiaCompleto: {
        referencia: mov.referencia || "",
        valorBase: arred4(memoria.base),
        lateralPronta: dados.lateral.pronto,
        descontoLateral: arred4(memoria.descontos.lateral),
        bojoPronto: dados.bojo.pronto,
        descontoBojo: arred4(memoria.descontos.bojo),
        fechoPronto: dados.fechoPronto,
        descontoFecho: arred4(memoria.descontos.fecho),
        pontoLuzPronto: dados.pontoLuzPronto,
        descontoPontoLuz: arred4(memoria.descontos.pontoLuz),
        valorUnitarioFinal: arred4(memoria.valorUnitario),
        quantidade,
        descontoDefeito: descontoAplicado,
        totalFinal: totalCalculado,
        faltantes: memoria.faltantes || [],
        regra: especial ? "REFERENCIA_ESPECIAL_VALOR_INTEGRAL" : "CHEGADA_BINARIA_OTIMIZADA",
        origemMemoria: memoria.origem || "",
        versao: VERSION
      },
      observacoes: faltando
        ? `Cálculo automático aguardando valor: ${memoria.faltantes.join(" | ")}.`
        : especial
          ? `Referência especial: valor integral de ${moeda4(memoria.valorUnitario)} por peça, sem descontos.`
          : `Cálculo automático do Sutiã Completo: base ${moeda4(memoria.base)}, valor final ${moeda4(memoria.valorUnitario)} por peça.`,
      calculoSutiaCompletoVersao: VERSION,
      calculoSutiaCompletoAtualizadoPor: usuario?.uid || "",
      calculoSutiaCompletoAtualizadoEm: agora,
      atualizadoPor: usuario?.uid || "",
      atualizadoEm: agora,
      criadoPor: usuario?.uid || "",
      criadoEm: agora
    };
  }

  function atualizacaoComponente(dados, total, usuario, agora) {
    const montar = info => ({
      informado: true,
      pronto: info.pronto,
      status: info.pronto ? "completo" : "nao_pronto",
      quantidadePronta: info.pronto ? total : 0,
      quantidadeTotal: total,
      descontarNoSutiaCompleto: info.descontar === true,
      feitoPelaFaccao: info.feitoPelaFaccao === true,
      feitoPelaConfeccao: info.feitoPelaConfeccao === true,
      origemExecucao: info.origemExecucao || "",
      origem: "chegada_sutia_completo",
      origemLabel: "Informado na chegada do Sutiã Completo",
      responsavel: info.responsavel || "",
      atualizadoPor: usuario?.uid || "",
      atualizadoEm: agora,
      versao: VERSION
    });

    const patch = {};
    if (dados.lateral.informadoAgora) patch["componentesConsolidados.lateral"] = montar(dados.lateral);
    if (dados.bojo.informadoAgora) patch["componentesConsolidados.bojo"] = montar(dados.bojo);
    if (Object.keys(patch).length) {
      patch.componentesConsolidadosAtualizadoPor = usuario?.uid || "";
      patch.componentesConsolidadosAtualizadoEm = agora;
    }
    return patch;
  }

  function montarLog(mov, quantidade, falta, descontoDefeito, dados, memoria, usuario, agora) {
    return {
      acao: "movimentacao_retorno_sutia_completo_otimizada",
      tipoAlvo: "movimentacaoProducao",
      alvoId: String(mov.id || ""),
      detalhes: `OP ${mov.numeroOP || "-"} | ${mov.destino || "-"} | voltou ${quantidade} peças | falta ${falta} | defeito ${moeda(descontoDefeito)} | lateral ${dados.lateral.feitoPelaFaccao ? "facção" : dados.lateral.feitoPelaConfeccao ? "confecção" : dados.lateral.descontar ? "desconto" : "sem desconto"} | bojo ${dados.bojo.feitoPelaFaccao ? "facção" : dados.bojo.feitoPelaConfeccao ? "confecção" : dados.bojo.descontar ? "desconto" : "sem desconto"} | fecho ${dados.fechoPronto ? "sim" : "não"} | ponto de luz ${dados.pontoLuzPronto ? "sim" : "não"} | valor ${moeda4(memoria.valorUnitario)}`,
      usuarioUid: usuario?.uid || "",
      usuarioNome: usuario?.displayName || "",
      usuarioEmail: usuario?.email || "",
      usuarioTipo: "",
      criadoEm: agora,
      versao: VERSION
    };
  }

  async function buscarMovimentacao(id) {
    const { fs, db } = await firebase();
    const snap = await fs.getDoc(fs.doc(db, "movimentacoesProducao", id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  async function buscarOPManual(numeroOP) {
    const { fs, db } = await firebase();
    const opTexto = texto(numeroOP);
    if (!opTexto) return null;

    try {
      const direto = await fs.getDoc(fs.doc(db, "ordensProducao", opTexto));
      if (direto.exists()) return { id: direto.id, ...direto.data() };
    } catch (_) {}

    const valores = [opTexto];
    const numerico = Number(opTexto);
    if (Number.isFinite(numerico)) valores.push(numerico);
    for (const valor of valores) {
      try {
        const snap = await fs.getDocs(fs.query(
          fs.collection(db, "ordensProducao"),
          fs.where("numeroOP", "==", valor),
          fs.limit(1)
        ));
        if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
      } catch (_) {}
    }
    return null;
  }

  async function salvarPadrao(form) {
    const id = texto(document.getElementById("chegadaMovimentacaoId")?.value);
    const chave = `padrao:${id}`;
    if (!id || processando.has(chave)) return;
    processando.add(chave);
    bloquearForm(form, true);

    try {
      const movOriginal = await buscarMovimentacao(id);
      if (!movOriginal || processoCanonico(movOriginal.processo) !== PROCESSO_COMPLETO) return;

      const especial = form.dataset.sutia912Rapido === "1";
      const dados = validarPainel("sc51", especial);
      if (!dados) return;

      const dataChegada = texto(document.getElementById("chegadaData")?.value);
      const falta = Math.max(0, numero(document.getElementById("chegadaFalta")?.value));
      const descontoDefeitoInformado = Math.max(0, numero(document.getElementById("chegadaDefeito")?.value));
      const quantidadeEnviada = Math.max(0, numero(movOriginal.quantidadeEnviada));
      const quantidade = Math.max(quantidadeEnviada - falta, 0);
      if (!dataChegada || falta > quantidadeEnviada) throw new Error("Dados de chegada inválidos.");

      const memoria = await obterMemoria("sc51", movOriginal.referencia, dados, especial);
      const { fs, db, auth } = await firebase();
      const usuario = auth.currentUser;
      const agora = fs.serverTimestamp();
      const descontoDefeito = memoria.especial ? 0 : descontoDefeitoInformado;
      const conferencia = montarConferencia(dados, memoria, usuario, quantidade);
      conferencia.confirmadoEm = agora;

      const mov = {
        ...movOriginal,
        dataChegada,
        falta,
        descontoDefeito,
        defeito: descontoDefeito,
        quantidadeRecebida: quantidade,
        status: "retornou",
        sutiaCompletoConferencia: conferencia,
        fechoVeioPronto: dados.fechoPronto,
        pontoLuzVeioPronto: dados.pontoLuzPronto,
        lateralProntaSutiaCompleto: dados.lateral.pronto,
        bojoProntoSutiaCompleto: dados.bojo.pronto
      };

      const pagamentoId = docIdSeguro(`mov-${id}-sut-completo-107`);
      const pagamento = montarPagamento(mov, memoria, dados, quantidade, falta, descontoDefeito, usuario, agora);
      const batch = fs.writeBatch(db);

      batch.set(fs.doc(db, "movimentacoesProducao", id), {
        dataChegada,
        falta,
        descontoDefeito,
        defeito: descontoDefeito,
        quantidadeRecebida: quantidade,
        status: "retornou",
        sutiaCompletoConferencia: conferencia,
        fechoVeioPronto: dados.fechoPronto,
        pontoLuzVeioPronto: dados.pontoLuzPronto,
        lateralProntaSutiaCompleto: dados.lateral.pronto,
        bojoProntoSutiaCompleto: dados.bojo.pronto,
        chegadaSutiaCompletoFluxoRapido: true,
        chegadaSutiaCompletoVersao: VERSION,
        atualizadoPor: usuario?.uid || "",
        atualizadoEm: agora
      }, { merge: true });
      batch.set(fs.doc(db, "entregasPagamento", pagamentoId), pagamento, { merge: true });

      const opPatch = atualizacaoComponente(dados, Math.max(0, numero(movOriginal.quantidadeEnviada)), usuario, agora);
      if (movOriginal.opId && Object.keys(opPatch).length) {
        batch.update(fs.doc(db, "ordensProducao", movOriginal.opId), opPatch);
      }
      batch.set(fs.doc(fs.collection(db, "logsAlteracoes")), montarLog(mov, quantidade, falta, descontoDefeito, dados, memoria, usuario, agora));
      await batch.commit();

      document.getElementById("modalChegadaMovimentacao")?.classList.add("hidden");
      form.reset();
      avisar((memoria.faltantes || []).length
        ? `Chegada salva. O pagamento ficou aguardando ${memoria.faltantes.join(" e ")}.`
        : `Chegada e pagamento salvos juntos: ${moeda(pagamento.total)}.`, false);
    } catch (error) {
      console.error("Falha na chegada rápida do Sutiã Completo.", error);
      avisar("Não foi possível concluir a chegada. Nenhuma gravação parcial foi feita.", true);
    } finally {
      bloquearForm(form, false);
      processando.delete(chave);
    }
  }

  async function salvarManual(form) {
    const numeroOP = texto(document.getElementById("chegadaManualOP")?.value);
    const referencia = normalizarReferencia(document.getElementById("chegadaManualRef")?.value);
    const cor = texto(document.getElementById("chegadaManualCor")?.value).toUpperCase();
    const quantidade = Math.max(0, numero(document.getElementById("chegadaManualQuantidade")?.value));
    const processo = processoCanonico(document.getElementById("chegadaManualProcesso")?.value);
    const faccao = texto(document.getElementById("chegadaManualFaccao")?.value).toUpperCase();
    const dataEnvio = texto(document.getElementById("chegadaManualDataEnvio")?.value);
    const dataChegada = texto(document.getElementById("chegadaManualDataChegada")?.value);
    const observacao = texto(document.getElementById("chegadaManualObs")?.value);
    const chave = `manual:${numeroOP}|${faccao}|${dataChegada}`;

    if (processo !== PROCESSO_COMPLETO || processando.has(chave)) return;
    processando.add(chave);
    bloquearForm(form, true);

    try {
      if (!numeroOP || !referencia || !cor || !quantidade || !faccao || !dataChegada) {
        throw new Error("Campos obrigatórios incompletos.");
      }

      const especial = form.dataset.sutia912Rapido === "1";
      const dados = validarPainel("sc51m", especial);
      if (!dados) return;
      const [memoria, op] = await Promise.all([
        obterMemoria("sc51m", referencia, dados, especial),
        buscarOPManual(numeroOP)
      ]);

      const { fs, db, auth } = await firebase();
      const usuario = auth.currentUser;
      const agora = fs.serverTimestamp();
      const id = docIdSeguro(`manual-chegada-faccao-${numeroOP}-${faccao}-${PROCESSO_COMPLETO}-${dataChegada}-${Date.now()}`);
      const conferencia = montarConferencia(dados, memoria, usuario, quantidade);
      conferencia.confirmadoEm = agora;

      const mov = {
        id,
        origem: "chegada_manual_faccao",
        origemManual: true,
        tipoDestino: "faccao",
        tipoDestinoLabel: "Facção",
        opId: op?.id || "",
        numeroOP,
        referencia,
        cor,
        produtoNome: op?.produtoNome || op?.nomeProduto || "",
        setor: op?.tipo || op?.setor || "sutia",
        destino: faccao,
        processo: PROCESSO_COMPLETO,
        quantidadeEnviada: quantidade,
        quantidadeRecebida: quantidade,
        dataEnvio,
        dataEnvioNaoInformada: !dataEnvio,
        dataChegada,
        falta: 0,
        descontoDefeito: 0,
        defeito: 0,
        status: "retornou",
        observacoes: observacao || "Chegada manual lançada pela aba Facções.",
        sutiaCompletoConferencia: conferencia,
        fechoVeioPronto: dados.fechoPronto,
        pontoLuzVeioPronto: dados.pontoLuzPronto,
        lateralProntaSutiaCompleto: dados.lateral.pronto,
        bojoProntoSutiaCompleto: dados.bojo.pronto,
        chegadaSutiaCompletoFluxoRapido: true,
        chegadaSutiaCompletoVersao: VERSION,
        criadoPor: usuario?.uid || "",
        criadoEm: agora,
        atualizadoPor: usuario?.uid || "",
        atualizadoEm: agora
      };

      const pagamentoId = docIdSeguro(`mov-${id}-sut-completo-107`);
      const pagamento = montarPagamento(mov, memoria, dados, quantidade, 0, 0, usuario, agora);
      const batch = fs.writeBatch(db);
      batch.set(fs.doc(db, "movimentacoesProducao", id), mov, { merge: true });
      batch.set(fs.doc(db, "entregasPagamento", pagamentoId), pagamento, { merge: true });

      const opPatch = atualizacaoComponente(dados, Math.max(0, numero(op?.quantidade || op?.quantidadeTotal || quantidade)), usuario, agora);
      if (op?.id && Object.keys(opPatch).length) batch.update(fs.doc(db, "ordensProducao", op.id), opPatch);
      batch.set(fs.doc(fs.collection(db, "logsAlteracoes")), montarLog(mov, quantidade, 0, 0, dados, memoria, usuario, agora));
      await batch.commit();

      document.getElementById("modalChegadaManualFaccao")?.classList.add("hidden");
      form.reset();
      avisar((memoria.faltantes || []).length
        ? `Chegada manual salva. O pagamento ficou aguardando ${memoria.faltantes.join(" e ")}.`
        : `Chegada manual e pagamento salvos juntos: ${moeda(pagamento.total)}.`, false);
    } catch (error) {
      console.error("Falha na chegada manual rápida do Sutiã Completo.", error);
      avisar("Não foi possível concluir a chegada manual. Nenhuma gravação parcial foi feita.", true);
    } finally {
      bloquearForm(form, false);
      processando.delete(chave);
    }
  }

  function instalarMarcadorReenvioSubmit() {
    if (window.__CORPONU_REQUEST_SUBMIT_MARCADO_107__) return;
    const original = HTMLFormElement.prototype.requestSubmit;
    if (typeof original !== "function") return;
    window.__CORPONU_REQUEST_SUBMIT_MARCADO_107__ = true;
    HTMLFormElement.prototype.requestSubmit = function(submitter) {
      if ([FORM_PADRAO, FORM_MANUAL].includes(this.id)) {
        const painelId = this.id === FORM_MANUAL
          ? "sutCompletoComponentesChegadaManual"
          : "sutCompletoComponentesChegada";
        if (document.getElementById(painelId)) this.dataset.sc107ReenvioSubmit = "1";
      }
      return original.call(this, submitter);
    };
  }

  function aoSubmit(event) {
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;

    const manual = form.id === FORM_MANUAL;
    const processo = manual
      ? processoCanonico(document.getElementById("chegadaManualProcesso")?.value)
      : processoCanonico(document.querySelector("#sutCompletoComponentesChegada") ? PROCESSO_COMPLETO : "");
    const painel = document.getElementById(manual ? "sutCompletoComponentesChegadaManual" : "sutCompletoComponentesChegada");
    if (processo !== PROCESSO_COMPLETO || !(painel instanceof HTMLElement)) return;
    if (form.dataset.sc107ReenvioSubmit !== "1") return;
    delete form.dataset.sc107ReenvioSubmit;

    event.preventDefault();
    event.stopImmediatePropagation();
    suprimirPosProcessamentoLegado(manual ? "manual" : "padrao");

    if (manual) void salvarManual(form);
    else void salvarPadrao(form);
  }

  function instalarForm(form) {
    if (!(form instanceof HTMLFormElement) || form.dataset.sc107 === "1") return;
    form.dataset.sc107 = "1";
    form.addEventListener("submit", aoSubmit, true);
  }

  function instalar() {
    injetarEstilos();
    instalarMarcadorReenvioSubmit();
    instalarForm(document.getElementById(FORM_PADRAO));
    instalarForm(document.getElementById(FORM_MANUAL));
    aprimorarPaineis();

    observer = new MutationObserver(() => {
      instalarForm(document.getElementById(FORM_PADRAO));
      instalarForm(document.getElementById(FORM_MANUAL));
      aprimorarPaineis();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-sutia912-rapido"]
    });

    let tentativas = 0;
    const intervalo = window.setInterval(() => {
      tentativas += 1;
      aprimorarPaineis();
      ajustarEspecial(document.getElementById(FORM_PADRAO), "sc51");
      ajustarEspecial(document.getElementById(FORM_MANUAL), "sc51m");
      if (tentativas >= 80) window.clearInterval(intervalo);
    }, 250);
  }

  window.CorpoNuSutiaChegadaRapida = {
    versao: VERSION,
    fluxoRapidoAtivo: true,
    limparCaches() {
      configCache = null;
      configCacheEm = 0;
      precosCache = null;
      precosCacheEm = 0;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", instalar, { once: true });
  } else {
    instalar();
  }
})();
