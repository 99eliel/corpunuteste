(() => {
  "use strict";

  const VERSION = "2026-08-19-fase-calcinha-oficial-220";
  const FIREBASE_VERSION = "10.12.5";
  const DATALIST_FASES_CALCINHA = "manejoFasesListCalcinha";

  if (window.__CORPONU_MANEJO_CALCINHA_SALVAR_FASE_220__ === VERSION) return;
  window.__CORPONU_MANEJO_CALCINHA_SALVAR_FASE_220__ = VERSION;

  let instalado = false;
  let contextoPromise = null;

  function calcinhaAtiva() {
    return document.querySelector("#manejo .manejo-setor-btn.active")?.dataset?.setor === "calcinha";
  }

  function normalizarComparacao(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .replace(/\s+/g, " ")
      .toUpperCase();
  }

  function localizarLinha(orderId) {
    const id = String(orderId || "");
    if (!id) return null;

    return [...document.querySelectorAll("#listaManejoInline tr[data-manejo-row='1']")].find(row => {
      const botao = row.querySelector(".btn-save-manejo");
      const onclick = String(botao?.getAttribute("onclick") || "");
      return onclick.includes(`salvarManejoLinha('${id}')`) || onclick.includes(`salvarManejoLinha(\"${id}\")`);
    }) || null;
  }

  function campoFaseDaLinha(orderId) {
    return localizarLinha(orderId)?.querySelector('input[id$="-fase"]') || null;
  }

  function fasesPermitidasCalcinha() {
    const datalist = document.getElementById(DATALIST_FASES_CALCINHA);
    if (!datalist) return [];

    const mapa = new Map();
    datalist.querySelectorAll("option").forEach(option => {
      const fase = String(option.value || option.textContent || "").trim();
      const chave = normalizarComparacao(fase);
      if (fase && chave && !mapa.has(chave)) mapa.set(chave, fase);
    });
    return [...mapa.entries()].map(([chave, fase]) => ({ chave, fase }));
  }

  function faseOficialDaLinha(orderId) {
    const campo = campoFaseDaLinha(orderId);
    const digitada = String(campo?.value || "").trim();
    const datalist = document.getElementById(DATALIST_FASES_CALCINHA);
    const permitidas = fasesPermitidasCalcinha();

    if (!digitada) {
      return {
        campo,
        digitada: "",
        oficial: "",
        listaDisponivel: Boolean(datalist),
        listaCarregada: permitidas.length > 0
      };
    }

    const chaveDigitada = normalizarComparacao(digitada);
    const encontrada = permitidas.find(item => item.chave === chaveDigitada);

    return {
      campo,
      digitada,
      oficial: encontrada?.fase || "",
      listaDisponivel: Boolean(datalist),
      listaCarregada: permitidas.length > 0
    };
  }

  function mostrarAviso(mensagem) {
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = mensagem;
      toast.classList.remove("hidden");
      window.clearTimeout(window.__faseCalcinha220Toast);
      window.__faseCalcinha220Toast = window.setTimeout(() => toast.classList.add("hidden"), 6500);
      return;
    }
    window.alert(mensagem);
  }

  async function obterContexto() {
    if (contextoPromise) return contextoPromise;

    contextoPromise = (async () => {
      const [appModule, authModule, firestoreModule] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
      ]);

      const app = appModule.getApps()[0] || appModule.getApp();
      return {
        auth: authModule.getAuth(app),
        db: firestoreModule.getFirestore(app),
        firestore: firestoreModule
      };
    })();

    return contextoPromise;
  }

  function instalarProtecao() {
    if (instalado) return true;
    const atual = window.salvarManejoLinha;
    if (typeof atual !== "function") return false;
    if (atual.__corponuFaseCalcinhaOficial220) {
      instalado = true;
      return true;
    }

    const original = atual;

    async function salvarManejoLinhaComFaseCalcinhaValidada220(orderId) {
      const ehCalcinha = calcinhaAtiva();
      let faseOficial = "";

      if (ehCalcinha) {
        const validacao = faseOficialDaLinha(orderId);

        if (!validacao.listaDisponivel) {
          mostrarAviso("A lista oficial de fases da Calcinha ainda está carregando. Aguarde um instante e tente salvar novamente.");
          return false;
        }

        if (!validacao.listaCarregada) {
          mostrarAviso("Nenhuma fase oficial está cadastrada para a Calcinha. Peça ao administrador para cadastrar as opções antes de salvar.");
          return false;
        }

        if (!validacao.digitada) {
          mostrarAviso("Selecione uma fase oficial da Calcinha antes de salvar.");
          return false;
        }

        if (!validacao.oficial) {
          mostrarAviso(`A fase \"${String(validacao.digitada).toUpperCase()}\" não pertence à lista oficial da Calcinha. Escolha uma das opções cadastradas pelo administrador.`);
          return false;
        }

        faseOficial = validacao.oficial;
        if (validacao.campo) {
          validacao.campo.value = faseOficial;
          validacao.campo.setAttribute("list", DATALIST_FASES_CALCINHA);
        }
      }

      const retorno = await original.apply(this, arguments);

      if (!ehCalcinha || !faseOficial) return retorno;

      try {
        const { auth, db, firestore } = await obterContexto();
        const user = auth.currentUser;
        if (!user) return retorno;

        await firestore.updateDoc(
          firestore.doc(db, "ordensProducao", String(orderId)),
          {
            "manejosSetores.calcinha.fase": faseOficial,
            "manejosSetores.calcinha.atualizadoPor": user.uid,
            "manejosSetores.calcinha.atualizadoEm": firestore.serverTimestamp(),
            atualizadoPor: user.uid,
            atualizadoEm: firestore.serverTimestamp()
          }
        );
      } catch (error) {
        console.error("Não foi possível preservar a fase oficial do Manejo Calcinha.", error);
      }

      return retorno;
    }

    salvarManejoLinhaComFaseCalcinhaValidada220.__corponuFaseCalcinhaOficial220 = true;
    window.salvarManejoLinha = salvarManejoLinhaComFaseCalcinhaValidada220;
    instalado = true;
    return true;
  }

  function iniciar() {
    window.setTimeout(instalarProtecao, 2200);
    window.setTimeout(() => {
      if (!instalado) instalarProtecao();
    }, 4200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();