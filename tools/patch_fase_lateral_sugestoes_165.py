from pathlib import Path
import json


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Âncora não encontrada: {label}")
    return text.replace(old, new, 1)

update_path = Path('update.js')
update = update_path.read_text(encoding='utf-8')

# Deixa claro que a fase antiga do Sutiã agora é Fase Bojo.
update = update.replace('Opções do filtro Fase — Sutiã', 'Opções do filtro Fase Bojo — Sutiã')
update = update.replace(
    'Gerencie as opções mostradas no filtro múltiplo da coluna Fase e nas sugestões de edição do Sutiã.',
    'Gerencie as opções mostradas no filtro múltiplo da coluna Fase Bojo e nas sugestões de edição do Sutiã.'
)

anchor = '''  // =========================================================\n  // HOTFIX: SETA DOS CAMPOS COM SUGESTÕES NO MANEJO\n'''

snippet = r'''  // =========================================================
  // GESTÃO CENTRALIZADA DAS SUGESTÕES DA FASE LATERAL — SUTIÃ
  // - Usa o mesmo padrão já aplicado à Fase Bojo e à Calcinha.
  // - Lista oficial em configuracoes/fasesManejoSutiaLateral.
  // - Sem MutationObserver: atualização por snapshot e eventos pontuais.
  // - Recuperação histórica só lê todas as OPs quando o admin solicitar.
  // =========================================================
  const FASES_LATERAL_CONFIG_DOCUMENTO = "fasesManejoSutiaLateral";
  const ID_DATALIST_FASES_LATERAL = "manejoFasesLateraisList";
  const ID_DATALIST_FILTRO_FASES_LATERAL = "filtroManejoFaseLateralList";
  const ID_PAINEL_FASES_LATERAL = "painelSugestoesFasesLateralAdmin";
  let fasesLateralGerenciadas = [];
  let configuracaoFasesLateralExiste = false;
  let unsubscribeConfiguracaoFasesLateral = null;
  let inicializacaoFasesLateralTentada = false;
  let restauracaoFasesLateralEmAndamento = false;
  let eventosFasesLateralInstalados = false;
  let tentativasConexaoFasesLateral = 0;

  function contextoGestaoFasesLateral() {
    if (contextoFirebaseFasesCalcinha?.firestore && contextoFirebaseFasesCalcinha?.db) {
      return contextoFirebaseFasesCalcinha;
    }
    if (contextoFirebaseFases?.firestore && contextoFirebaseFases?.db) {
      return contextoFirebaseFases;
    }
    return null;
  }

  function usuarioEhAdminFasesLateral() {
    return Boolean(usuarioEhAdminFases || usuarioEhAdminFasesCalcinha);
  }

  function garantirDatalistFasesLateral(id) {
    let datalist = document.getElementById(id);
    if (datalist) return datalist;
    datalist = document.createElement("datalist");
    datalist.id = id;
    (document.body || document.documentElement).appendChild(datalist);
    return datalist;
  }

  function opcoesAtuaisFasesLateral() {
    const valores = [];
    [ID_DATALIST_FASES_LATERAL, ID_DATALIST_FILTRO_FASES_LATERAL].forEach(id => {
      document.querySelectorAll(`#${id} option`).forEach(option => {
        valores.push(option.value || option.textContent || "");
      });
    });
    try {
      const locais = JSON.parse(localStorage.getItem("fasesLateraisManejoExtras") || "[]");
      if (Array.isArray(locais)) valores.push(...locais);
    } catch (error) {
      console.warn("Não foi possível ler sugestões locais antigas da Fase Lateral.", error);
    }
    document.querySelectorAll('#manejo input[id$="-faseLateral"]').forEach(input => {
      if (input.value) valores.push(input.value);
    });
    return ordenarFasesGerenciadas(valores);
  }

  function renderDatalistsFasesLateral() {
    if (!configuracaoFasesLateralExiste) return;
    const oficiais = ordenarFasesGerenciadas(fasesLateralGerenciadas);
    [ID_DATALIST_FASES_LATERAL, ID_DATALIST_FILTRO_FASES_LATERAL].forEach(id => {
      const datalist = garantirDatalistFasesLateral(id);
      const atuais = [...datalist.querySelectorAll("option")]
        .map(option => normalizarFaseGerenciada(option.value || option.textContent || ""));
      const iguais = atuais.length === oficiais.length && atuais.every((item, indice) =>
        chaveFaseGerenciada(item) === chaveFaseGerenciada(oficiais[indice])
      );
      if (!iguais) {
        datalist.innerHTML = oficiais
          .map(fase => `<option value="${escapeHtmlFases(fase)}"></option>`)
          .join("");
      }
    });
  }

  function removerBotoesMaisFaseLateral() {
    document.querySelectorAll([
      '#manejo button[onclick*="adicionarFaseLateralSugestao"]',
      '#manejo .manejo-col-fase-lateral .fase-plus > button',
      '#manejo input[id$="-faseLateral"] + button'
    ].join(', ')).forEach(botao => botao.remove());

    document.querySelectorAll('#manejo input[id$="-faseLateral"]').forEach(input => {
      input.setAttribute("list", ID_DATALIST_FASES_LATERAL);
      input.title = "Digite a Fase Lateral ou escolha uma sugestão cadastrada pelo administrador.";
    });
  }

  function renderListaAdminFasesLateral() {
    const lista = document.getElementById("listaSugestoesFasesLateralAdmin");
    const contador = document.getElementById("contadorSugestoesFasesLateralAdmin");
    const status = document.getElementById("statusSugestoesFasesLateralAdmin");
    if (!lista) return;

    if (contador) contador.textContent = `${fasesLateralGerenciadas.length} opção(ões)`;
    if (status) {
      status.textContent = configuracaoFasesLateralExiste
        ? "Lista oficial da Fase Lateral sincronizada com todos os usuários."
        : "Preparando a lista inicial da Fase Lateral.";
      status.style.color = "#64748b";
    }

    if (!fasesLateralGerenciadas.length) {
      lista.innerHTML = `
        <div style="padding:14px;border:1px dashed #cbd5e1;border-radius:10px;color:#64748b;text-align:center;background:#fff;">
          Nenhuma sugestão de Fase Lateral cadastrada.
        </div>
      `;
      return;
    }

    lista.innerHTML = fasesLateralGerenciadas.map(fase => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;">
        <strong style="font-size:13px;overflow-wrap:anywhere;">${escapeHtmlFases(fase)}</strong>
        <button type="button" class="btn" data-remover-fase-lateral-admin="${escapeHtmlFases(fase)}"
          style="padding:7px 10px;color:#b91c1c;border-color:#fecaca;background:#fff7f7;flex:0 0 auto;">
          Remover
        </button>
      </div>
    `).join("");
  }

  function posicionarPainelAdminFasesLateral(painel) {
    if (!painel) return;
    const painelCalcinha = document.getElementById("painelSugestoesFasesCalcinhaAdmin");
    const painelBojo = document.getElementById("painelSugestoesFasesAdmin");
    const formularioUsuario = document.getElementById("formUsuario");

    if (painelCalcinha?.parentElement) {
      if (painel.nextElementSibling !== painelCalcinha) {
        painelCalcinha.parentElement.insertBefore(painel, painelCalcinha);
      }
      return;
    }
    if (painelBojo?.parentElement) {
      if (painelBojo.nextElementSibling !== painel) painelBojo.insertAdjacentElement("afterend", painel);
      return;
    }
    if (formularioUsuario?.parentElement && formularioUsuario.nextElementSibling !== painel) {
      formularioUsuario.insertAdjacentElement("afterend", painel);
    }
  }

  function criarPainelAdminFasesLateral() {
    if (!usuarioEhAdminFasesLateral()) {
      document.getElementById(ID_PAINEL_FASES_LATERAL)?.remove();
      return;
    }

    const existente = document.getElementById(ID_PAINEL_FASES_LATERAL);
    if (existente) {
      renderListaAdminFasesLateral();
      posicionarPainelAdminFasesLateral(existente);
      return;
    }

    const formularioUsuario = document.getElementById("formUsuario");
    if (!formularioUsuario) return;

    const painel = document.createElement("section");
    painel.id = ID_PAINEL_FASES_LATERAL;
    painel.className = "panel";
    painel.style.gridColumn = "1 / -1";
    painel.innerHTML = `
      <div class="panel-header" style="align-items:flex-start;gap:16px;">
        <div>
          <h3>Opções do filtro Fase Lateral — Sutiã</h3>
          <p>Gerencie as opções mostradas no filtro e nas sugestões de edição da nova Fase Lateral do Sutiã.</p>
        </div>
        <span id="contadorSugestoesFasesLateralAdmin" class="badge ok">0 opção(ões)</span>
        <button type="button" class="btn" id="btnRecuperarFasesLateralAntigas" style="margin-left:auto;white-space:nowrap;">Recuperar opções antigas</button>
      </div>
      <div class="notice small" style="margin-bottom:12px;">
        Esta lista controla diretamente a <strong>Fase Lateral do Sutiã</strong>. Os usuários podem digitar livremente, mas a opção só entra na lista oficial quando o administrador adicioná-la aqui.
      </div>
      <form id="formSugestaoFaseLateralAdmin" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px;">
        <label style="flex:1;min-width:240px;">
          Nova opção de Fase Lateral
          <input id="novaSugestaoFaseLateralAdmin" type="text" placeholder="Ex: CORTE, PRODUÇÃO, ENTRAR NA PRODUÇÃO" autocomplete="off" maxlength="80" />
        </label>
        <button class="btn btn-primary" type="submit">Adicionar opção</button>
      </form>
      <div id="statusSugestoesFasesLateralAdmin" style="font-size:12px;color:#64748b;margin-bottom:10px;">Carregando lista oficial...</div>
      <div id="listaSugestoesFasesLateralAdmin" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;"></div>
    `;

    formularioUsuario.insertAdjacentElement("afterend", painel);
    posicionarPainelAdminFasesLateral(painel);

    painel.querySelector("#formSugestaoFaseLateralAdmin")?.addEventListener("submit", async event => {
      event.preventDefault();
      const input = document.getElementById("novaSugestaoFaseLateralAdmin");
      const fase = normalizarFaseGerenciada(input?.value);
      if (!fase) {
        mostrarAvisoFormulario("Digite o nome da Fase Lateral antes de adicionar.");
        input?.focus();
        return;
      }
      await adicionarSugestaoFaseLateralAdmin(fase);
      if (input) input.value = "";
      input?.focus();
    });

    painel.querySelector("#listaSugestoesFasesLateralAdmin")?.addEventListener("click", async event => {
      const botao = event.target?.closest?.("[data-remover-fase-lateral-admin]");
      if (!botao) return;
      await removerSugestaoFaseLateralAdmin(botao.dataset.removerFaseLateralAdmin || "");
    });

    painel.querySelector("#btnRecuperarFasesLateralAntigas")?.addEventListener("click", () => {
      recuperarOpcoesAntigasFasesLateral();
    });

    renderListaAdminFasesLateral();
  }

  async function registrarLogFaseLateralAdmin(acao, fase) {
    const contexto = contextoGestaoFasesLateral();
    if (!contexto?.user || !contexto?.perfil) return;
    const { firestore, db, user, perfil } = contexto;
    try {
      await firestore.addDoc(firestore.collection(db, "logsAlteracoes"), {
        acao,
        tipoAlvo: "Sugestão de Fase Lateral do Sutiã",
        alvoId: fase,
        detalhes: `${acao}: ${fase}`,
        usuarioUid: user.uid,
        usuarioNome: perfil.nome || "",
        usuarioEmail: perfil.email || user.email || "",
        usuarioTipo: perfil.tipo || "admin",
        criadoEm: firestore.serverTimestamp()
      });
    } catch (error) {
      console.warn("Não foi possível registrar o log da Fase Lateral.", error);
    }
  }

  async function alterarListaFasesLateralComTransacao(transformar) {
    const contexto = contextoGestaoFasesLateral();
    if (!usuarioEhAdminFasesLateral() || !contexto?.user) {
      mostrarAvisoFormulario("Somente o administrador pode gerenciar sugestões da Fase Lateral.");
      return null;
    }

    const { firestore, db, user } = contexto;
    const referencia = firestore.doc(db, "configuracoes", FASES_LATERAL_CONFIG_DOCUMENTO);
    return firestore.runTransaction(db, async transacao => {
      const snapshot = await transacao.get(referencia);
      const listaAtual = ordenarFasesGerenciadas(
        snapshot.exists() ? snapshot.data()?.sugestoes : fasesLateralGerenciadas
      );
      const proximaLista = ordenarFasesGerenciadas(transformar(listaAtual));
      transacao.set(referencia, {
        sugestoes: proximaLista,
        atualizadoEm: firestore.serverTimestamp(),
        atualizadoPor: user.uid,
        versaoGerenciamento: APP_VERSION,
        tipoPeca: "sutia",
        campo: "faseLateral"
      }, { merge: true });
      return proximaLista;
    });
  }

  async function adicionarSugestaoFaseLateralAdmin(faseInformada) {
    const fase = normalizarFaseGerenciada(faseInformada);
    if (!fase) return;
    if (fasesLateralGerenciadas.some(item => chaveFaseGerenciada(item) === chaveFaseGerenciada(fase))) {
      mostrarAvisoFormulario(`A Fase Lateral "${fase}" já está cadastrada.`);
      return;
    }
    try {
      await alterarListaFasesLateralComTransacao(lista => [...lista, fase]);
      await registrarLogFaseLateralAdmin("Sugestão de Fase Lateral adicionada", fase);
      showUpdateToast(`Sugestão "${fase}" adicionada à Fase Lateral do Sutiã.`);
    } catch (error) {
      console.error("Erro ao adicionar sugestão da Fase Lateral.", error);
      mostrarAvisoFormulario("Não foi possível adicionar a sugestão da Fase Lateral.");
    }
  }

  async function removerSugestaoFaseLateralAdmin(faseInformada) {
    const fase = normalizarFaseGerenciada(faseInformada);
    if (!fase) return;
    if (!window.confirm(`Remover "${fase}" das sugestões da Fase Lateral?\n\nAs OPs antigas não serão alteradas.`)) return;
    try {
      await alterarListaFasesLateralComTransacao(lista =>
        lista.filter(item => chaveFaseGerenciada(item) !== chaveFaseGerenciada(fase))
      );
      await registrarLogFaseLateralAdmin("Sugestão de Fase Lateral removida", fase);
      showUpdateToast(`Sugestão "${fase}" removida da Fase Lateral.`);
    } catch (error) {
      console.error("Erro ao remover sugestão da Fase Lateral.", error);
      mostrarAvisoFormulario("Não foi possível remover a sugestão da Fase Lateral.");
    }
  }

  async function criarListaInicialFasesLateralSeNecessario() {
    const contexto = contextoGestaoFasesLateral();
    if (
      inicializacaoFasesLateralTentada ||
      !usuarioEhAdminFasesLateral() ||
      configuracaoFasesLateralExiste ||
      !contexto?.user
    ) return;

    inicializacaoFasesLateralTentada = true;
    await new Promise(resolve => setTimeout(resolve, 1600));
    const atuais = opcoesAtuaisFasesLateral();

    try {
      const { firestore, db, user } = contexto;
      const referencia = firestore.doc(db, "configuracoes", FASES_LATERAL_CONFIG_DOCUMENTO);
      await firestore.runTransaction(db, async transacao => {
        const snapshot = await transacao.get(referencia);
        if (snapshot.exists()) return;
        transacao.set(referencia, {
          sugestoes: atuais,
          criadoEm: firestore.serverTimestamp(),
          criadoPor: user.uid,
          atualizadoEm: firestore.serverTimestamp(),
          atualizadoPor: user.uid,
          versaoGerenciamento: APP_VERSION,
          tipoPeca: "sutia",
          campo: "faseLateral"
        });
      });
    } catch (error) {
      inicializacaoFasesLateralTentada = false;
      console.error("Erro ao criar lista inicial da Fase Lateral.", error);
    }
  }

  function iniciarSnapshotConfiguracaoFasesLateral() {
    const contexto = contextoGestaoFasesLateral();
    if (!contexto?.firestore || !contexto?.db) return false;
    unsubscribeConfiguracaoFasesLateral?.();

    const { firestore, db } = contexto;
    const referencia = firestore.doc(db, "configuracoes", FASES_LATERAL_CONFIG_DOCUMENTO);
    unsubscribeConfiguracaoFasesLateral = firestore.onSnapshot(
      referencia,
      snapshot => {
        configuracaoFasesLateralExiste = snapshot.exists();
        fasesLateralGerenciadas = ordenarFasesGerenciadas(
          configuracaoFasesLateralExiste ? snapshot.data()?.sugestoes : opcoesAtuaisFasesLateral()
        );
        renderDatalistsFasesLateral();
        removerBotoesMaisFaseLateral();
        criarPainelAdminFasesLateral();
        criarListaInicialFasesLateralSeNecessario();
      },
      error => console.error("Erro ao carregar sugestões da Fase Lateral.", error)
    );
    return true;
  }

  function conectarGestaoFasesLateral() {
    if (unsubscribeConfiguracaoFasesLateral) return;
    if (iniciarSnapshotConfiguracaoFasesLateral()) return;
    if (tentativasConexaoFasesLateral >= 30) {
      console.error("Não foi possível conectar a gestão da Fase Lateral ao Firebase.");
      return;
    }
    tentativasConexaoFasesLateral += 1;
    setTimeout(conectarGestaoFasesLateral, 350);
  }

  async function recuperarOpcoesAntigasFasesLateral() {
    if (restauracaoFasesLateralEmAndamento) return;
    const contexto = contextoGestaoFasesLateral();
    if (!usuarioEhAdminFasesLateral() || !contexto?.user) return;

    const botao = document.getElementById("btnRecuperarFasesLateralAntigas");
    const status = document.getElementById("statusSugestoesFasesLateralAdmin");
    restauracaoFasesLateralEmAndamento = true;
    if (botao) {
      botao.disabled = true;
      botao.textContent = "Recuperando...";
    }
    if (status) {
      status.textContent = "Recuperando Fases Laterais usadas anteriormente nas OPs...";
      status.style.color = "#475569";
    }

    try {
      const { firestore, db } = contexto;
      const encontradas = new Set(fasesLateralGerenciadas);
      opcoesAtuaisFasesLateral().forEach(fase => encontradas.add(fase));
      const snapshot = await firestore.getDocs(firestore.collection(db, "ordensProducao"));
      snapshot.forEach(documento => {
        const dados = documento.data() || {};
        [
          dados?.manejosSetores?.sutia?.faseLateral,
          dados?.manejoSutia?.faseLateral,
          dados?.sutia?.faseLateral,
          dados?.manejo?.faseLateral,
          dados?.faseLateral,
          dados?.faseLateralSutia
        ].forEach(valor => {
          const fase = normalizarFaseGerenciada(valor);
          if (fase) encontradas.add(fase);
        });
      });

      const antes = new Set(fasesLateralGerenciadas.map(chaveFaseGerenciada));
      const todas = ordenarFasesGerenciadas([...encontradas]);
      const novas = todas.filter(fase => !antes.has(chaveFaseGerenciada(fase)));
      await alterarListaFasesLateralComTransacao(lista => [...lista, ...todas]);
      await registrarLogFaseLateralAdmin("Opções antigas da Fase Lateral recuperadas", `${novas.length} nova(s)`);

      if (status) {
        status.textContent = novas.length
          ? `${novas.length} opção(ões) antiga(s) de Fase Lateral recuperada(s).`
          : "Todas as opções antigas da Fase Lateral já estavam disponíveis.";
        status.style.color = "#166534";
      }
      showUpdateToast(
        novas.length
          ? `${novas.length} opção(ões) antigas da Fase Lateral recuperadas.`
          : "Nenhuma nova opção antiga de Fase Lateral foi encontrada."
      );
    } catch (error) {
      console.error("Erro ao recuperar opções antigas da Fase Lateral.", error);
      if (status) {
        status.textContent = "Não foi possível recuperar as opções antigas da Fase Lateral agora.";
        status.style.color = "#b91c1c";
      }
      mostrarAvisoFormulario("Não foi possível recuperar as opções antigas da Fase Lateral.");
    } finally {
      restauracaoFasesLateralEmAndamento = false;
      if (botao) {
        botao.disabled = false;
        botao.textContent = "Recuperar opções antigas";
      }
    }
  }

  function aplicarGestaoFasesLateralNoDom() {
    renderDatalistsFasesLateral();
    removerBotoesMaisFaseLateral();
    criarPainelAdminFasesLateral();
  }

  function instalarEventosGestaoFasesLateral() {
    if (eventosFasesLateralInstalados) return;
    eventosFasesLateralInstalados = true;

    document.addEventListener("pointerdown", event => {
      const alvo = event.target;
      if (!(alvo instanceof HTMLInputElement)) return;
      if (
        alvo.id === "filtroManejoFaseLateral" ||
        alvo.id.endsWith("-faseLateral") ||
        alvo.getAttribute("list") === ID_DATALIST_FASES_LATERAL
      ) {
        renderDatalistsFasesLateral();
      }
    }, true);

    document.addEventListener("focusin", event => {
      const alvo = event.target;
      if (!(alvo instanceof HTMLInputElement)) return;
      if (alvo.id === "filtroManejoFaseLateral" || alvo.id.endsWith("-faseLateral")) {
        renderDatalistsFasesLateral();
        removerBotoesMaisFaseLateral();
      }
    }, true);

    document.addEventListener("click", event => {
      if (event.target?.closest?.('.nav-btn[data-page="usuarios"]')) {
        [80, 350, 800].forEach(delay => setTimeout(() => {
          criarPainelAdminFasesLateral();
          const painel = document.getElementById(ID_PAINEL_FASES_LATERAL);
          if (painel) posicionarPainelAdminFasesLateral(painel);
        }, delay));
      }
      if (
        event.target?.closest?.('.nav-btn[data-page="manejo"]') ||
        event.target?.closest?.('.manejo-setor-btn') ||
        event.target?.closest?.('#btnAtualizarServidor')
      ) {
        [50, 220, 600].forEach(delay => setTimeout(aplicarGestaoFasesLateralNoDom, delay));
      }
    }, true);
  }

  function iniciarGestaoFasesLateralSutia() {
    garantirDatalistFasesLateral(ID_DATALIST_FASES_LATERAL);
    garantirDatalistFasesLateral(ID_DATALIST_FILTRO_FASES_LATERAL);
    instalarEventosGestaoFasesLateral();
    conectarGestaoFasesLateral();
    [200, 700, 1500, 2600].forEach(delay => setTimeout(aplicarGestaoFasesLateralNoDom, delay));
  }

  iniciarGestaoFasesLateralSutia();

'''

if 'GESTÃO CENTRALIZADA DAS SUGESTÕES DA FASE LATERAL — SUTIÃ' in update:
    raise SystemExit('Patch 165 já aplicado.')
update = replace_once(update, anchor, snippet + anchor, 'inserção antes do hotfix de seta')
update_path.write_text(update, encoding='utf-8')

index_path = Path('index.html')
index = index_path.read_text(encoding='utf-8')
index = index.replace(
    'update.js?v=2026-07-30-rastreamento-enviar-manejo-17',
    'update.js?v=2026-08-10-teste-fase-lateral-sugestoes-165'
)
index_path.write_text(index, encoding='utf-8')

release_path = Path('corponu-release.json')
release = {
    "version": "2026-08-10-teste-fase-lateral-sugestoes-165",
    "updatedAt": "2026-08-10T14:15:00-03:00",
    "notes": "AMBIENTE DE TESTE. Gestão da Fase Lateral integrada ao mesmo update.js que já gerencia Fase Bojo e Calcinha. Novo painel administrativo para adicionar/remover/recuperar sugestões da Fase Lateral, sincronizado no Firebase. Sem módulo JS paralelo e sem alteração do layout ultrawide ou do sistema principal."
}
release_path.write_text(json.dumps(release, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
