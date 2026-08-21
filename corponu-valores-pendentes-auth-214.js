(() => {
  "use strict";

  const VERSION = "2026-08-19-valores-pendentes-excluir-215";
  const FIREBASE_VERSION = "10.12.5";
  const BUTTON_ID = "btnValoresPendentesFinanceiro";
  const COLLECTION = "ajustesFinanceirosFaccoes";
  const FLAG = "__CORPONU_VALORES_PENDENTES_AUTH_214__";

  if (window[FLAG] === VERSION) return;
  window[FLAG] = VERSION;

  let preparando = false;
  let liberadoUmaVez = false;
  let contextoPromise = null;

  const esperar = ms => new Promise(resolve => setTimeout(resolve, ms));

  function erroPermissao(erro) {
    const codigo = String(erro?.code || "").toLowerCase();
    const mensagem = String(erro?.message || erro || "").toLowerCase();
    return codigo.includes("permission-denied") ||
      mensagem.includes("missing or insufficient permissions") ||
      mensagem.includes("permission-denied");
  }

  function moeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function avisar(mensagem) {
    if (typeof window.mostrarAvisoFormulario === "function") {
      window.mostrarAvisoFormulario(mensagem);
      return;
    }
    window.alert(mensagem);
  }

  async function aguardarUsuario(auth, authMod) {
    if (auth.currentUser) return auth.currentUser;
    return new Promise((resolve, reject) => {
      let cancelar = null;
      const timer = setTimeout(() => {
        cancelar?.();
        reject(new Error("Usuário ainda não autenticado."));
      }, 10000);
      cancelar = authMod.onAuthStateChanged(auth, usuario => {
        if (!usuario) return;
        clearTimeout(timer);
        cancelar?.();
        resolve(usuario);
      }, erro => {
        clearTimeout(timer);
        cancelar?.();
        reject(erro);
      });
    });
  }

  async function contextoFirebase() {
    if (!contextoPromise) {
      contextoPromise = (async () => {
        const [appMod, firestore, authMod] = await Promise.all([
          import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
          import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
          import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`)
        ]);
        const app = appMod.getApps()[0];
        if (!app) throw new Error("Firebase ainda não inicializado.");
        const auth = authMod.getAuth(app);
        const db = firestore.getFirestore(app);
        const usuario = await aguardarUsuario(auth, authMod);
        return { firestore, authMod, auth, db, usuario };
      })().catch(erro => {
        contextoPromise = null;
        throw erro;
      });
    }
    return contextoPromise;
  }

  async function validarAcesso() {
    const contexto = await contextoFirebase();
    const usuario = contexto.auth.currentUser || contexto.usuario;
    if (!usuario) throw new Error("Usuário ainda não autenticado.");

    try {
      if (typeof usuario.getIdToken === "function") {
        await usuario.getIdToken(true);
      }
    } catch (erro) {
      console.warn("Valores pendentes: não foi possível renovar o token antes da validação.", erro);
    }

    const atrasos = [0, 250, 650, 1200];
    let ultimoErro = null;

    for (let i = 0; i < atrasos.length; i++) {
      if (atrasos[i]) await esperar(atrasos[i]);
      try {
        const perfilSnap = await contexto.firestore.getDoc(
          contexto.firestore.doc(contexto.db, "usuarios", usuario.uid)
        );
        if (!perfilSnap.exists()) throw new Error("Perfil do usuário não encontrado.");

        const perfil = perfilSnap.data() || {};
        const recursos = perfil?.permissoes?.recursos || {};
        const autorizado = perfil?.ativo === true && (
          perfil?.tipo === "admin" ||
          recursos.gerenciarValores === true ||
          recursos.marcarPagamentos === true
        );
        if (!autorizado) throw new Error("Seu usuário não possui permissão para gerenciar valores pendentes.");

        await contexto.firestore.getDocs(
          contexto.firestore.collection(contexto.db, COLLECTION)
        );
        return true;
      } catch (erro) {
        ultimoErro = erro;
        if (!erroPermissao(erro) || i === atrasos.length - 1) throw erro;
        console.info(`Valores pendentes: sessão ainda estabilizando, tentativa ${i + 1}/${atrasos.length}.`);
      }
    }

    throw ultimoErro || new Error("Não foi possível validar o acesso aos valores pendentes.");
  }

  async function interceptarClique(event) {
    const botao = event.target.closest?.(`#${BUTTON_ID}`);
    if (!botao) return;

    if (botao.dataset.vpAuth214Liberado === "1") {
      delete botao.dataset.vpAuth214Liberado;
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    if (preparando) return;

    preparando = true;
    const textoOriginal = botao.textContent;
    const disabledOriginal = botao.disabled;
    botao.disabled = true;
    botao.textContent = "Validando acesso...";

    try {
      if (!liberadoUmaVez) {
        await validarAcesso();
        liberadoUmaVez = true;
      }
      botao.dataset.vpAuth214Liberado = "1";
      botao.disabled = disabledOriginal;
      botao.textContent = textoOriginal;
      botao.click();
    } catch (erro) {
      console.error("Valores pendentes: falha definitiva na validação de acesso.", erro);
      const mensagem = erroPermissao(erro)
        ? "O Firebase ainda não liberou o acesso a Valores pendentes. Aguarde alguns segundos e tente novamente."
        : (erro?.message || "Não foi possível validar o acesso a Valores pendentes.");
      avisar(mensagem);
    } finally {
      botao.disabled = disabledOriginal;
      botao.textContent = textoOriginal;
      preparando = false;
    }
  }

  function adicionarBotoesExcluir() {
    const lista = document.getElementById("vpLista");
    if (!lista) return false;

    lista.querySelectorAll("tr").forEach(linha => {
      const status = linha.querySelector(".vp-status");
      const botaoStatus = linha.querySelector("button[data-vp-id]");
      if (!status || !botaoStatus) return;

      const pendente = status.classList.contains("pendente") ||
        String(status.textContent || "").trim().toLowerCase() === "pendente";

      const existente = linha.querySelector("button[data-vp-excluir]");
      if (!pendente) {
        existente?.remove();
        return;
      }
      if (existente) return;

      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "vp-btn";
      botao.textContent = "Excluir";
      botao.dataset.vpExcluir = String(botaoStatus.dataset.vpId || "");
      botao.style.marginLeft = "6px";
      botao.style.background = "#fee2e2";
      botao.style.color = "#991b1b";
      botao.style.border = "1px solid #fecaca";
      botao.title = "Excluir este valor pendente";
      botaoStatus.parentElement?.appendChild(botao);
    });

    return true;
  }

  async function excluirValorPendente(botao) {
    const id = String(botao?.dataset?.vpExcluir || "").trim();
    if (!id || botao.disabled) return;

    const linha = botao.closest("tr");
    const nomeFaccao = String(linha?.children?.[1]?.textContent || "facção").trim();
    const valorTela = String(linha?.children?.[4]?.textContent || "").trim();

    if (!window.confirm(`Excluir este valor pendente de ${nomeFaccao}${valorTela ? ` (${valorTela})` : ""}?\n\nEsta ação remove o lançamento e não pode ser desfeita.`)) {
      return;
    }

    const textoOriginal = botao.textContent;
    try {
      botao.disabled = true;
      botao.textContent = "Excluindo...";

      const contexto = await contextoFirebase();
      const referencia = contexto.firestore.doc(contexto.db, COLLECTION, id);
      const snap = await contexto.firestore.getDoc(referencia);

      if (!snap.exists()) {
        avisar("Esse valor pendente já não existe mais.");
        document.getElementById("vpAtualizar")?.click();
        return;
      }

      const dados = snap.data() || {};
      if (String(dados.status || "pendente") !== "pendente") {
        avisar("Somente valores com status Pendente podem ser excluídos. Reabra o lançamento antes de excluir.");
        document.getElementById("vpAtualizar")?.click();
        return;
      }

      await contexto.firestore.deleteDoc(referencia);
      avisar(`Valor pendente de ${dados.faccao || nomeFaccao} (${moeda(dados.valor)}) excluído.`);
      document.getElementById("vpAtualizar")?.click();
    } catch (erro) {
      console.error("Valores pendentes: falha ao excluir lançamento.", erro);
      avisar(
        erroPermissao(erro)
          ? "O Firebase não permitiu excluir este valor. Confirme se as regras da versão 215 foram publicadas."
          : (erro?.message || "Não foi possível excluir o valor pendente.")
      );
    } finally {
      botao.disabled = false;
      botao.textContent = textoOriginal;
    }
  }

  function interceptarExclusao(event) {
    const botao = event.target.closest?.("button[data-vp-excluir]");
    if (!botao) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    excluirValorPendente(botao);
  }

  function iniciarExclusao() {
    let tentativas = 0;
    const timer = window.setInterval(() => {
      tentativas += 1;
      const lista = document.getElementById("vpLista");
      if (!lista) {
        if (tentativas >= 40) window.clearInterval(timer);
        return;
      }

      window.clearInterval(timer);
      adicionarBotoesExcluir();
      const observer = new MutationObserver(() => adicionarBotoesExcluir());
      observer.observe(lista, { childList: true, subtree: true });
    }, 250);
  }

  document.addEventListener("click", interceptarClique, true);
  document.addEventListener("click", interceptarExclusao, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarExclusao, { once: true });
  } else {
    iniciarExclusao();
  }
})();