(() => {
  "use strict";

  const VERSION = "2026-08-19-valores-pendentes-auth-214";
  if (window.__CORPONU_PENDENCIAS_VALOR_BOOTSTRAP__ === VERSION) return;
  window.__CORPONU_PENDENCIAS_VALOR_BOOTSTRAP__ = VERSION;

  function carregarScript(src, modulo, aoCarregar) {
    const existente = [...document.scripts].find(script => String(script.src || "").includes(src.replace("./", "")));
    if (existente) {
      aoCarregar?.();
      return existente;
    }
    const script = document.createElement("script");
    script.src = `${src}?v=${encodeURIComponent(VERSION)}&t=${Date.now()}`;
    script.async = false;
    script.dataset.corponuModulo = modulo;
    script.onload = () => aoCarregar?.();
    script.onerror = () => console.error(`Não foi possível carregar o módulo ${modulo}.`);
    document.head.appendChild(script);
    return script;
  }

  carregarScript(
    "./corponu-valores-4-casas-162.js",
    "valores-4-casas-162"
  );

  carregarScript(
    "./corponu-faccoes-layout-141.js",
    "faccoes-layout-141"
  );

  carregarScript(
    "./corponu-faccoes-sem-bipar-156.js",
    "faccoes-sem-bipar-156"
  );

  carregarScript(
    "./corponu-chegada-estabilidade-132.js",
    "chegada-estabilidade-132",
    () => carregarScript(
      "./corponu-aviso-chegada-admin-130.js",
      "aviso-chegada-admin-130",
      () => carregarScript(
        "./corponu-chegada-informar-155.js",
        "informar-chegada-estavel-155"
      )
    )
  );

  carregarScript(
    "./corponu-alca-pendencia-leve-126.js",
    "alca-pendencia-leve-162",
    () => carregarScript(
      "./corponu-alca-recalcular-pendentes-163.js",
      "alca-recalcular-pendentes-163"
    )
  );

  carregarScript(
    "./corponu-lateral-unificada-118-seguro.js",
    "lateral-unificada-118",
    () => carregarScript(
      "./corponu-pendencias-valor-seguro-117.js",
      "pendencias-valor-seguro-117",
      () => carregarScript(
        "./corponu-precos-recalcular-pendencias-189.js",
        "precos-recalcular-pendencias-189"
      )
    )
  );

  carregarScript(
    "./corponu-chegada-manual-faccoes-processo-119-seguro.js",
    "chegada-manual-faccoes-processo-119"
  );

  carregarScript(
    "./corponu-valores-pendentes-financeiro.js",
    "valores-pendentes-financeiro-213",
    () => carregarScript(
      "./corponu-valores-pendentes-auth-214.js",
      "valores-pendentes-auth-214"
    )
  );
})();