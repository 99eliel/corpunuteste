(() => {
  "use strict";

  const VERSION = "2026-08-17-auto-update-runtime-203";
  const RELEASE_URL = "./corponu-release.json";
  const INTERVALO = 15 * 1000;

  if (window.__CORPONU_AUTO_UPDATE_RUNTIME__ === VERSION) return;
  window.__CORPONU_AUTO_UPDATE_RUNTIME__ = VERSION;

  let verificando = false;
  let atualizando = false;

  function releaseCarregada() {
    try {
      return String(
        window.__CORPONU_RELEASE_REAL__ ||
        new URL(window.location.href).searchParams.get("release") ||
        ""
      ).trim();
    } catch (_) {
      return String(window.__CORPONU_RELEASE_REAL__ || "").trim();
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

  async function limparCachesAntigos() {
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

  function mostrarStatus(texto) {
    let aviso = document.getElementById("corponuAutoUpdateRuntime203Status");
    if (!aviso) {
      aviso = document.createElement("div");
      aviso.id = "corponuAutoUpdateRuntime203Status";
      aviso.style.cssText = [
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
      (document.body || document.documentElement).appendChild(aviso);
    }
    aviso.textContent = texto;
  }

  function versionarAssets(html, release) {
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

  async function aplicarRelease(remoteRelease) {
    if (atualizando) return;
    atualizando = true;
    mostrarStatus("Nova versão disponível. Atualizando automaticamente...");

    try {
      await limparCachesAntigos();

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
      url.searchParams.delete("_cb");
      window.history.replaceState(null, "", url.toString());

      window.__CORPONU_RELEASE_REAL__ = remoteRelease;
      const htmlAtualizado = versionarAssets(html, remoteRelease);
      document.open();
      document.write(htmlAtualizado);
      document.close();
    } catch (erro) {
      console.warn("[CorpoNu Auto Update] Falha na troca direta; usando navegação.", erro);
      const url = new URL(window.location.href);
      url.searchParams.set("release", remoteRelease);
      url.searchParams.set("autoupdate", String(Date.now()));
      url.searchParams.set("_cb", String(Date.now()));
      window.location.replace(url.toString());
    }
  }

  async function verificar() {
    if (verificando || atualizando) return;
    verificando = true;
    try {
      const remote = await buscarRelease();
      if (!remote) return;
      const carregada = releaseCarregada();

      if (!carregada) {
        window.__CORPONU_RELEASE_REAL__ = remote;
        try {
          const url = new URL(window.location.href);
          url.searchParams.set("release", remote);
          window.history.replaceState(null, "", url.toString());
        } catch (_) {}
        return;
      }

      if (remote !== carregada) {
        await aplicarRelease(remote);
      }
    } catch (erro) {
      console.debug("[CorpoNu Auto Update] Verificação temporariamente indisponível.", erro);
    } finally {
      verificando = false;
    }
  }

  function iniciar() {
    setTimeout(verificar, 2500);
    setInterval(verificar, INTERVALO);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) verificar();
    });
    window.addEventListener("focus", verificar);
    window.addEventListener("pageshow", verificar);
    window.addEventListener("online", verificar);

    console.info(`[CorpoNu] Atualizador automático ativo: ${VERSION}`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();

(() => {
  "use strict";

  if (document.querySelector('script[data-corponu-manejo-calcinha-estavel="204"]')) return;

  const script = document.createElement("script");
  script.src = `./corponu-manejo-calcinha-estavel-204.js?v=2026-08-17-manejo-calcinha-estavel-204&t=${Date.now()}`;
  script.async = false;
  script.dataset.corponuManejoCalcinhaEstavel = "204";
  script.onerror = () => console.error("Não foi possível carregar a estabilização visual do Manejo Calcinha 204.");
  (document.head || document.documentElement).appendChild(script);
})();

(() => {
  "use strict";

  if (document.querySelector('script[data-corponu-ponto-luz-411="207"]')) return;

  const script = document.createElement("script");
  script.src = `./corponu-sutia-completo-ponto-luz-411-206.js?v=2026-08-17-ponto-luz-somente-411-207&t=${Date.now()}`;
  script.async = false;
  script.dataset.corponuPontoLuz411 = "207";
  script.onerror = () => console.error("Não foi possível carregar a regra de ponto de luz da REF 411.");
  (document.head || document.documentElement).appendChild(script);
})();

(() => {
  "use strict";

  if (document.querySelector('script[data-corponu-faccoes-lateral-select="212"]')) return;

  const script = document.createElement("script");
  script.src = `./corponu-faccoes-lateral-select-212.js?v=2026-08-18-lateral-select-estavel-212&t=${Date.now()}`;
  script.async = false;
  script.dataset.corponuFaccoesLateralSelect = "212";
  script.onerror = () => console.error("Não foi possível carregar a correção do seletor de Lateral e Alça 212.");
  (document.head || document.documentElement).appendChild(script);
})();

(() => {
  "use strict";

  if (document.querySelector('script[data-corponu-restantes-filtro-op="225"]')) return;

  const script = document.createElement("script");
  script.src = `./corponu-restantes-pendentes-filtro-op-225.js?v=2026-08-19-restantes-pendentes-filtro-op-225&t=${Date.now()}`;
  script.async = false;
  script.dataset.corponuRestantesFiltroOp = "225";
  script.onerror = () => console.error("Não foi possível carregar o filtro seguro de OP em Restantes pendentes.");
  (document.head || document.documentElement).appendChild(script);
})();
