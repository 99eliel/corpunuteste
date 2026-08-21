(() => {
  "use strict";

  const VERSION = "2026-08-12-precos-recalcular-pendencias-189";
  const FIREBASE_VERSION = "10.12.5";
  const MODAL_ID = "modalPendenciasValoresFinanceiro";

  if (window.__CORPONU_PRECOS_RECALCULAR_PENDENCIAS_189__ === VERSION) return;
  window.__CORPONU_PRECOS_RECALCULAR_PENDENCIAS_189__ = VERSION;

  let contextoPromise = null;
  let reconciliando = false;
  let pularProximaAtualizacao = false;
  let contextoUltimoSubmit = null;

  const texto = valor => String(valor ?? "").trim();
  const normalizar = valor => texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  function numeroMoeda(valor) {
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
    const bruto = texto(valor).replace(/R\$/gi, "").replace(/\s+/g, "");
    if (!bruto) return 0;
    const ajustado = bruto.includes(",")
      ? bruto.replace(/\./g, "").replace(",", ".")
      : bruto;
    const numero = Number(ajustado.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(numero) ? numero : 0;
  }

  function processoCanonico(valor) {
    const chave = normalizar(valor);
    const aliases = {
      BOJO: "ENCAPAR BOJO",
      ENCAPAR: "ENCAPAR BOJO",
      "ENCAPAR BOJOS": "ENCAPAR BOJO",
      ALCA: "ALÇA",
      ALCAS: "ALÇA",
      ALCAS: "ALÇA",
      CALCINHA: "CALCINHA COMPLETA",
      "MONTAGEM CALCINHA": "CALCINHA MONTAGEM",
      "MONTAR CALCINHA": "CALCINHA MONTAGEM",
      "SUTIA MONTAGEM": "SUTIÃ MONTAGEM",
      "SUTIA COMPLETO": "SUTIÃ COMPLETO"
    };
    return aliases[chave] || texto(valor).toUpperCase();
  }

  function processoDoItem(item) {
    return processoCanonico(
      item?.processo || item?.servicoNome || item?.processoMovimentacao || item?.nomeProcesso || ""
    );
  }

  function processoUsaValorUnitario(processo) {
    const chave = normalizar(processoCanonico(processo));
    return chave !== "SUTIA MONTAGEM" && chave !== "SUTIA COMPLETO";
  }

  function pagamentoAtivoSemValor(item) {
    const status = normalizar(item?.statusPagamento || item?.status || "");
    if (item?.pago === true || item?.cancelado === true || item?.excluido === true) return false;
    if ([
      "PAGO", "PAGA", "QUITADO", "QUITADA", "CANCELADO", "CANCELADA",
      "EXCLUIDO", "EXCLUIDA", "ESTORNADO", "ESTORNADA"
    ].includes(status)) return false;

    return item?.valorPendente === true ||
      item?.valorManualFinanceiroPendente === true ||
      ["SEM VALOR", "AGUARDANDO VALOR"].includes(status) ||
      !(numeroMoeda(item?.valorUnitario) > 0) ||
      !(numeroMoeda(item?.total ?? item?.valorTotal) > 0);
  }

  function setorDoPreco(preco, processo) {
    const salvo = texto(preco?.setor || preco?.area).toLowerCase();
    if (salvo) return salvo;
    const chave = normalizar(processo);
    if (chave === "LATERAL") return "lateral";
    if (chave.includes("BOJO")) return "bojo";
    if (chave.includes("ALCA")) return "alca";
    if (chave.includes("CALCINHA")) return "calcinha";
    if (chave.includes("SUTIA")) return "sutia";
    return "producao";
  }

  function labelSetor(setor) {
    const mapa = {
      lateral: "Lateral",
      corte: "Lateral",
      bojo: "Bojo",
      alca: "Alça",
      calcinha: "Calcinha",
      sutia: "Sutiã",
      producao: "Produção"
    };
    return mapa[texto(setor).toLowerCase()] || "Produção";
  }

  async function contexto() {
    if (contextoPromise) return contextoPromise;
    contextoPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
    ]).then(([appMod, authMod, fs]) => {
      if (!appMod.getApps().length) throw new Error("Firebase ainda não foi inicializado.");
      const app = appMod.getApp();
      return { fs, db: fs.getFirestore(app), auth: authMod.getAuth(app) };
    }).catch(error => {
      contextoPromise = null;
      throw error;
    });
    return contextoPromise;
  }

  async function aguardarUsuario(auth) {
    for (let tentativa = 0; tentativa < 25 && !auth.currentUser; tentativa += 1) {
      await new Promise(resolve => window.setTimeout(resolve, 120));
    }
    return auth.currentUser || null;
  }

  function referenciasConsulta(referencia) {
    const ref = texto(referencia).toUpperCase();
    const valores = [ref];
    const numerica = Number(ref);
    if (Number.isFinite(numerica)) valores.push(numerica);
    return valores.filter((item, indice, lista) =>
      lista.findIndex(outro => `${typeof outro}:${outro}` === `${typeof item}:${item}`) === indice
    );
  }

  async function buscarPrecoUnico(fs, db, referencia, processo) {
    const refs = referenciasConsulta(referencia);
    const consulta = refs.length > 1
      ? fs.query(fs.collection(db, "precosReferencia"), fs.where("referencia", "in", refs))
      : fs.query(fs.collection(db, "precosReferencia"), fs.where("referencia", "==", refs[0]));
    const snap = await fs.getDocs(consulta);

    const candidatos = snap.docs
      .map(documento => ({ id: documento.id, ...documento.data() }))
      .filter(item =>
        item?.ativo !== false &&
        normalizar(item?.referencia) === normalizar(referencia) &&
        normalizar(processoDoItem(item)) === normalizar(processo)
      );

    const porValor = new Map();
    candidatos.forEach(item => {
      const valor = numeroMoeda(item?.valor ?? item?.valorUnitario ?? item?.preco ?? item?.valorPorPeca);
      if (!(valor > 0)) return;
      const chave = valor.toFixed(6);
      if (!porValor.has(chave)) porValor.set(chave, item);
    });

    if (porValor.size !== 1) return null;
    const [chave, item] = [...porValor.entries()][0];
    return { ...item, valorResolvido: Number(chave) };
  }

  async function buscarPagamentosDaReferencia(fs, db, referencia) {
    const refs = referenciasConsulta(referencia);
    const consulta = refs.length > 1
      ? fs.query(fs.collection(db, "entregasPagamento"), fs.where("referencia", "in", refs))
      : fs.query(fs.collection(db, "entregasPagamento"), fs.where("referencia", "==", refs[0]));
    const snap = await fs.getDocs(consulta);
    return snap.docs.map(documento => ({ id: documento.id, ...documento.data() }));
  }

  async function aplicarPrecoEmPagamentos(fs, db, auth, preco, pagamentos) {
    const usuario = await aguardarUsuario(auth);
    if (!usuario) throw new Error("Usuário não autenticado.");

    const processo = processoDoItem(preco);
    if (!processoUsaValorUnitario(processo)) return 0;
    const valor = numeroMoeda(preco?.valorResolvido ?? preco?.valor ?? preco?.valorUnitario ?? preco?.preco);
    if (!(valor > 0)) return 0;

    const referencia = texto(preco?.referencia).toUpperCase();
    const setor = setorDoPreco(preco, processo);
    const correspondentes = pagamentos.filter(item =>
      pagamentoAtivoSemValor(item) &&
      normalizar(item?.referencia) === normalizar(referencia) &&
      normalizar(processoDoItem(item)) === normalizar(processo)
    );
    if (!correspondentes.length) return 0;

    let atualizados = 0;
    for (let inicio = 0; inicio < correspondentes.length; inicio += 400) {
      const parte = correspondentes.slice(inicio, inicio + 400);
      const batch = fs.writeBatch(db);
      const agora = fs.serverTimestamp();
      let operacoes = 0;

      parte.forEach(item => {
        const quantidade = Math.max(0, numeroMoeda(item?.quantidade ?? item?.quantidadeRecebida ?? 0));
        if (!(quantidade > 0)) return;
        const desconto = Math.max(0, numeroMoeda(item?.descontoDefeito ?? item?.defeito ?? 0));
        const subtotal = quantidade * valor;

        batch.set(fs.doc(db, "entregasPagamento", item.id), {
          precoReferenciaId: preco.id,
          servicoId: preco.id,
          processo,
          processoMovimentacao: item?.processoMovimentacao || processo,
          servicoNome: processo,
          setor,
          setorLabel: labelSetor(setor),
          valorUnitario: valor,
          subtotal,
          total: Math.max(subtotal - desconto, 0),
          statusPagamento: "pendente",
          valorPendente: false,
          valorManualFinanceiroPendente: false,
          formaValorPagamento: "valor_unitario_base",
          motivoValorPendente: "",
          avisoPagamento: "",
          valorInformadoPor: usuario.uid,
          valorInformadoEm: agora,
          atualizadoPor: usuario.uid,
          atualizadoEm: agora,
          origemAtualizacaoValor: "preco_cadastrado_automatico_189",
          versaoValorFinanceiro: VERSION
        }, { merge: true });
        operacoes += 1;
      });

      if (operacoes > 0) {
        await batch.commit();
        atualizados += operacoes;
      }
    }

    return atualizados;
  }

  function avisar(mensagem, erro = false) {
    let toast = document.getElementById("corponuPrecoPendenciaAuto189Toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "corponuPrecoPendenciaAuto189Toast";
      toast.style.cssText = [
        "position:fixed", "right:18px", "bottom:18px", "z-index:1000001",
        "max-width:min(480px,calc(100vw - 30px))", "padding:13px 15px",
        "border-radius:12px", "box-shadow:0 18px 45px rgba(15,23,42,.26)",
        "color:#fff", "font:800 13px/1.4 Arial,sans-serif"
      ].join(";");
      document.body.appendChild(toast);
    }
    toast.style.background = erro ? "#991b1b" : "#166534";
    toast.textContent = mensagem;
    window.clearTimeout(toast._timer);
    toast._timer = window.setTimeout(() => toast.remove(), erro ? 6500 : 4800);
  }

  async function reconciliarReferenciaProcesso(referencia, processo) {
    const ref = texto(referencia).toUpperCase();
    const proc = processoCanonico(processo);
    if (!ref || !proc || !processoUsaValorUnitario(proc) || reconciliando) return 0;

    reconciliando = true;
    try {
      const { fs, db, auth } = await contexto();
      const preco = await buscarPrecoUnico(fs, db, ref, proc);
      if (!preco) return 0;
      const pagamentos = await buscarPagamentosDaReferencia(fs, db, ref);
      const atualizados = await aplicarPrecoEmPagamentos(fs, db, auth, preco, pagamentos);
      if (atualizados > 0) {
        window.dispatchEvent(new CustomEvent("corponu:pendencias-recalculadas", {
          detail: { referencia: ref, processo: proc, valor: preco.valorResolvido, quantidade: atualizados }
        }));
      }
      return atualizados;
    } finally {
      reconciliando = false;
    }
  }

  async function reconciliarPendenciasVisiveis() {
    if (reconciliando) return 0;
    const modal = document.getElementById(MODAL_ID);
    if (!modal || modal.classList.contains("hidden")) return 0;

    const ids = [...modal.querySelectorAll('[data-acao-pendencia="salvar-unitario"][data-id]')]
      .map(botao => texto(botao.dataset.id))
      .filter(Boolean);
    if (!ids.length) return 0;

    reconciliando = true;
    try {
      const { fs, db, auth } = await contexto();
      const pagamentos = [];
      for (let inicio = 0; inicio < ids.length; inicio += 20) {
        const parte = ids.slice(inicio, inicio + 20);
        const snaps = await Promise.all(parte.map(id => fs.getDoc(fs.doc(db, "entregasPagamento", id))));
        snaps.forEach(snap => {
          if (snap.exists()) pagamentos.push({ id: snap.id, ...snap.data() });
        });
      }

      const grupos = new Map();
      pagamentos.filter(pagamentoAtivoSemValor).forEach(item => {
        const referencia = texto(item?.referencia).toUpperCase();
        const processo = processoDoItem(item);
        if (!referencia || !processo || !processoUsaValorUnitario(processo)) return;
        const chave = `${normalizar(referencia)}|||${normalizar(processo)}`;
        if (!grupos.has(chave)) grupos.set(chave, { referencia, processo, itens: [] });
        grupos.get(chave).itens.push(item);
      });

      let total = 0;
      for (const grupo of grupos.values()) {
        const preco = await buscarPrecoUnico(fs, db, grupo.referencia, grupo.processo);
        if (!preco) continue;
        total += await aplicarPrecoEmPagamentos(fs, db, auth, preco, grupo.itens);
      }

      if (total > 0) {
        window.dispatchEvent(new CustomEvent("corponu:pendencias-recalculadas", { detail: { quantidade: total } }));
        avisar(`${total} pendência(s) receberam automaticamente o valor já cadastrado.`);
        window.setTimeout(() => atualizarModalSemRecursao(), 120);
      }
      return total;
    } catch (error) {
      console.warn("Não foi possível reconciliar automaticamente as pendências visíveis.", error);
      return 0;
    } finally {
      reconciliando = false;
    }
  }

  function atualizarModalSemRecursao() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    const botao = [...modal.querySelectorAll("button")].find(item => normalizar(item.textContent) === "ATUALIZAR LISTA");
    if (!botao) return;
    pularProximaAtualizacao = true;
    botao.click();
  }

  function capturarContextoPreco() {
    const referencia = texto(document.getElementById("precoReferenciaRef")?.value).toUpperCase();
    const processo = processoCanonico(document.getElementById("precoReferenciaProcesso")?.value);
    const valor = numeroMoeda(document.getElementById("precoReferenciaValor")?.value);
    if (!referencia || !processo || !(valor > 0)) return null;
    return { referencia, processo, valor, instante: Date.now() };
  }

  function agendarReconciliacaoDoSubmit(contextoPreco) {
    if (!contextoPreco) return;
    contextoUltimoSubmit = contextoPreco;
    [350, 900, 1800].forEach((atraso, indice) => {
      window.setTimeout(async () => {
        if (contextoUltimoSubmit !== contextoPreco) return;
        try {
          const total = await reconciliarReferenciaProcesso(contextoPreco.referencia, contextoPreco.processo);
          if (total > 0) {
            contextoUltimoSubmit = null;
            avisar(`Valor cadastrado aplicado automaticamente em ${total} pendência(s) de ${contextoPreco.processo} / Ref. ${contextoPreco.referencia}.`);
          } else if (indice === 2) {
            contextoUltimoSubmit = null;
          }
        } catch (error) {
          if (indice === 2) {
            contextoUltimoSubmit = null;
            console.warn("Preço salvo, mas a reconciliação automática não foi concluída.", error);
          }
        }
      }, atraso);
    });
  }

  document.addEventListener("submit", event => {
    if (event.target?.id !== "formPrecoReferencia") return;
    agendarReconciliacaoDoSubmit(capturarContextoPreco());
  }, true);

  document.addEventListener("click", event => {
    const alvo = event.target instanceof Element ? event.target.closest("button, a") : null;
    if (!alvo) return;

    const dentroModal = alvo.closest(`#${MODAL_ID}`);
    const textoBotao = normalizar(alvo.textContent);

    if (dentroModal && textoBotao === "ATUALIZAR LISTA") {
      if (pularProximaAtualizacao) {
        pularProximaAtualizacao = false;
        return;
      }
      window.setTimeout(reconciliarPendenciasVisiveis, 180);
      window.setTimeout(reconciliarPendenciasVisiveis, 650);
      return;
    }

    if (alvo.id === "btnAtualizarConferenciaPagamentoFinal" || textoBotao.includes("VER PENDENCIAS DE VALOR")) {
      window.setTimeout(reconciliarPendenciasVisiveis, 350);
      window.setTimeout(reconciliarPendenciasVisiveis, 900);
    }
  }, true);

  window.addEventListener("pageshow", () => {
    window.setTimeout(reconciliarPendenciasVisiveis, 700);
  });
})();
