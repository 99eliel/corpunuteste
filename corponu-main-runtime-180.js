(() => {
  "use strict";

  const VERSION = "2026-08-17-main-runtime-estavel-180";
  const RELEASE_URL = "./corponu-release.json";
  const INTERVALO_VERIFICACAO = 15 * 1000;
  const PAUSA_OBSERVADOR_MS = 1000;

  if (window.__CORPONU_MAIN_RUNTIME__ === VERSION) return;
  window.__CORPONU_MAIN_RUNTIME__ = VERSION;

  let verificandoRelease = false;
  let atualizandoRelease = false;
  let dual = null;
  let observadorPagina = null;
  let timerObservador = 0;

  function normalizar(valor) {
    return String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function manejoCalcinhaAtivo() {
    return document.body?.dataset?.corponuManejoTipo === "calcinha"
      || Boolean(document.querySelector('.manejo-setor-btn.active[data-setor="calcinha"]'));
  }

  function ehCampoFaseCalcinha(alvo) {
    if (!(alvo instanceof HTMLInputElement)) return false;
    if (!manejoCalcinhaAtivo()) return false;
    if (!alvo.closest("#listaManejoInline")) return false;
    return /-fase(?:Lateral)?$/i.test(alvo.id || "");
  }

  function instalarCssCalcinha() {
    if (document.getElementById("corponuMainRuntimeCalcinha180Styles")) return;
    const style = document.createElement("style");
    style.id = "corponuMainRuntimeCalcinha180Styles";
    style.textContent = `
      body[data-corponu-manejo-tipo="calcinha"] #listaManejoInline tr[data-manejo-row="1"] > td:has(.silk-fields),
      body[data-corponu-manejo-tipo="calcinha"] #listaManejoInline tr[data-manejo-row="1"] > td:has(.tecido-fields){
        display:none!important;
        visibility:hidden!important;
      }
      body[data-corponu-manejo-tipo="calcinha"] #manejo .manejo-inline-table,
      body[data-corponu-manejo-tipo="calcinha"] #listaManejoInline,
      body[data-corponu-manejo-tipo="calcinha"] #listaManejoInline tr[data-manejo-row="1"]{
        opacity:1!important;
        visibility:visible!important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function ocultarCamposSutiaAgora() {
    if (!manejoCalcinhaAtivo()) return;

    document.querySelectorAll("#listaManejoInline tr[data-manejo-row='1']").forEach(row => {
      [...row.children].forEach(cell => {
        if (!(cell instanceof HTMLElement)) return;
        if (cell.querySelector(".silk-fields") || cell.querySelector(".tecido-fields")) {
          cell.style.setProperty("display", "none", "important");
          cell.dataset.corponuCalcinhaOculto180 = "1";
        }
      });
    });
  }

  function restaurarCamposSutia() {
    document.querySelectorAll('[data-corponu-calcinha-oculto180="1"]').forEach(cell => {
      if (!(cell instanceof HTMLElement)) return;
      cell.style.removeProperty("display");
      delete cell.dataset.corponuCalcinhaOculto180;
    });
  }

  function capturarObservadorGenerico() {
    dual = window.corponuDualMode || dual;
    const lista = dual?.state?.observers;
    if (!Array.isArray(lista) || !lista.length) return false;
    observadorPagina = lista[lista.length - 1] || null;
    return Boolean(observadorPagina);
  }

  function pausarObservadorGenerico() {
    if (!manejoCalcinhaAtivo()) return;
    if (!observadorPagina) capturarObservadorGenerico();
    if (!observadorPagina) return;

    clearTimeout(timerObservador);
    try {
      observadorPagina.takeRecords?.();
      observadorPagina.disconnect();
    } catch (_) {}

    timerObservador = setTimeout(() => {
      const shell = document.getElementById("appShell") || document.body;
      try {
        observadorPagina.observe(shell, {
          attributes: true,
          subtree: true,
          attributeFilter: ["class"]
        });
      } catch (_) {}
    }, PAUSA_OBSERVADOR_MS);
  }

  function protegerEdicaoFase(evento) {
    if (!ehCampoFaseCalcinha(evento.target)) return;
    pausarObservadorGenerico();
    ocultarCamposSutiaAgora();
  }

  function instalarProtecaoCalcinha() {
    instalarCssCalcinha();

    ["pointerdown", "focusin", "input", "change"].forEach(tipo => {
      document.addEventListener(tipo, protegerEdicaoFase, true);
    });

    document.addEventListener("click", evento => {
      const botao = evento.target?.closest?.(".manejo-setor-btn[data-setor]");
      if (!botao) return;

      if (botao.dataset.setor === "calcinha") {
        document.body.dataset.corponuManejoTipo = "calcinha";
        queueMicrotask(ocultarCamposSutiaAgora);
      } else if (botao.dataset.setor === "sutia") {
        document.body.dataset.corponuManejoTipo = "sutia";
        queueMicrotask(restaurarCamposSutia);
      }
    }, true);

    const tbody = document.getElementById("listaManejoInline");
    if (tbody) {
      const observer = new MutationObserver(() => {
        if (manejoCalcinhaAtivo()) ocultarCamposSutiaAgora();
      });
      observer.observe(tbody, { childList: true, subtree: true });
    }

    let tentativas = 0;
    const timer = setInterval(() => {
      tentativas += 1;
      capturarObservadorGenerico();
      if (manejoCalcinhaAtivo()) ocultarCamposSutiaAgora();
      if (observadorPagina || tentativas >= 30) clearInterval(timer);
    }, 200);
  }

  function releaseDaAba() {
    try {
      return new URL(window.location.href).searchParams.get("release") || "";
    } catch (_) {
      return "";
    }
  }

  async function buscarRelease() {
    const resposta = await fetch(`${RELEASE_URL}?watch=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
      }
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const dados = await resposta.json();
    return String(dados?.version || "").trim();
  }

  function mostrarAtualizacao(texto) {
    let toast = document.getElementById("corponuMainRuntimeUpdateToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "corponuMainRuntimeUpdateToast";
      toast.style.cssText = [
        "position:fixed",
        "right:18px",
        "bottom:18px",
        "z-index:2147483647",
        "background:#111827",
        "color:#fff",
        "padding:12px 15px",
        "border-radius:12px",
        "box-shadow:0 14px 40px rgba(15,23,42,.28)",
        "font:700 13px/1.4 Arial,sans-serif",
        "max-width:360px"
      ].join(";");
      document.body.appendChild(toast);
    }
    toast.textContent = texto;
  }

  async function limparCaches() {
    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.getRegistrations) {
        const registros = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registros.map(registro => registro.unregister()));
      }
    } catch (_) {}

    try {
      if ("caches" in window) {
        const chaves = await caches.keys();
        await Promise.all(
          chaves
            .filter(chave => chave.startsWith("op-confeccao-") || chave.startsWith("corponu-"))
            .map(chave => caches.delete(chave))
        );
      }
    } catch (_) {}
  }

  function aplicarVersaoNosAssets(html, release) {
    const versao = encodeURIComponent(release);
    const instante = Date.now();
    let resultado = String(html || "").replace(
      /((?:src|href)=["'](?:\.\/)?(?!https?:|\/\/)[^"'?#]+?\.(?:js|css))(?:\?[^"']*)?(["'])/gi,
      `$1?v=${versao}&cb=${instante}$2`
    );

    resultado = resultado.replace(
      /(<meta\s+name=["']app-version["']\s+content=["'])[^"']*(["'])/i,
      `$1${release}$2`
    );

    return resultado.replace(
      /<head>/i,
      `<head><script>window.__CORPONU_RELEASE_REAL__=${JSON.stringify(release)};<\/script>`
    );
  }

  async function carregarVersaoNova(remoteRelease) {
    if (atualizandoRelease) return;
    atualizandoRelease = true;
    mostrarAtualizacao("Nova versão encontrada. Atualizando automaticamente...");

    try {
      await limparCaches();
      const resposta = await fetch(`./index.html?autoupdate=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        }
      });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

      const html = await resposta.text();
      if (!/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html)) {
        throw new Error("HTML principal inválido");
      }

      const url = new URL(window.location.href);
      url.searchParams.set("release", remoteRelease);
      url.searchParams.set("autoupdate", String(Date.now()));
      url.searchParams.delete("t");
      url.searchParams.delete("v");
      window.history.replaceState(null, "", url.toString());

      const htmlAtualizado = aplicarVersaoNosAssets(html, remoteRelease);
      document.open();
      document.write(htmlAtualizado);
      document.close();
    } catch (error) {
      console.warn("[CorpoNu Main Runtime] Falha no reload direto; usando navegação.", error);
      const url = new URL(window.location.href);
      url.searchParams.set("release", remoteRelease);
      url.searchParams.set("autoupdate", String(Date.now()));
      url.searchParams.set("_cb", String(Date.now()));
      window.location.replace(url.toString());
    }
  }

  async function verificarRelease() {
    if (verificandoRelease || atualizandoRelease) return;
    verificandoRelease = true;
    try {
      const remote = await buscarRelease();
      if (!remote) return;
      const carregada = releaseDaAba();
      if (remote !== carregada) {
        await carregarVersaoNova(remote);
      }
    } catch (error) {
      console.debug("[CorpoNu Main Runtime] Verificação de versão indisponível.", error);
    } finally {
      verificandoRelease = false;
    }
  }

  function instalarAtualizador() {
    setTimeout(verificarRelease, 2500);
    setInterval(verificarRelease, INTERVALO_VERIFICACAO);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) verificarRelease();
    });
    window.addEventListener("focus", verificarRelease);
    window.addEventListener("pageshow", verificarRelease);
    window.addEventListener("online", verificarRelease);
  }

  function removerAvisoLegadoCtrlF5() {
    const limpar = () => {
      const toast = document.getElementById("toastAtualizacaoSistema");
      if (toast && /ctrl\s*\+?\s*f5/i.test(toast.textContent || "")) toast.remove();
    };
    limpar();
    const observer = new MutationObserver(limpar);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function iniciar() {
    instalarProtecaoCalcinha();
    instalarAtualizador();
    removerAvisoLegadoCtrlF5();
    console.info(`[CorpoNu] Runtime principal ${VERSION} iniciado.`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();