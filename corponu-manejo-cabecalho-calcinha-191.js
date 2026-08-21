(() => {
  "use strict";

  const MODULOS = [
    {
      arquivo: "corponu-manejo-calcinha-filtros-193.js",
      versao: "2026-08-12-calcinha-filtros-corretos-193",
      marcador: "manejo-calcinha-filtros-193",
      erro: "Não foi possível alinhar os filtros do Manejo Calcinha."
    },
    {
      arquivo: "corponu-manejo-calcinha-salvar-fase-194.js",
      versao: "2026-08-13-fase-calcinha-restrita-198",
      marcador: "manejo-calcinha-salvar-fase-198",
      erro: "Não foi possível validar a fase permitida do Manejo Calcinha."
    }
  ];

  MODULOS.forEach(({ arquivo, versao, marcador, erro }) => {
    if ([...document.scripts].some(script => String(script.src || "").includes(arquivo))) return;

    const script = document.createElement("script");
    script.src = `./${arquivo}?v=${encodeURIComponent(versao)}&t=${Date.now()}`;
    script.async = false;
    script.dataset.corponuModulo = marcador;
    script.onerror = () => console.error(erro);
    document.head.appendChild(script);
  });
})();
