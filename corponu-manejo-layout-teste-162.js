(() => {
  "use strict";

  const VERSION = "2026-08-10-teste-manejo-layout-162";
  const STYLE_ID = "corponuManejoLayoutTeste162";
  if (window.__CORPONU_MANEJO_LAYOUT_TESTE_162__ === VERSION) return;
  window.__CORPONU_MANEJO_LAYOUT_TESTE_162__ = VERSION;

  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    /* TESTE 162 — somente Manejo Sutiã com Fase Lateral ativa. */
    #manejo .table-wrap {
      max-width: 100% !important;
      overflow-x: auto !important;
    }

    #manejo .manejo-inline-table.manejo-fases-teste-157 {
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100% !important;
      table-layout: fixed !important;
    }

    #manejo .manejo-inline-table.manejo-fases-teste-157 th,
    #manejo .manejo-inline-table.manejo-fases-teste-157 td {
      min-width: 0 !important;
      box-sizing: border-box !important;
    }

    /* Nº OP: compacto e invariável. */
    #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(1),
    #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(1) {
      width: 82px !important;
      min-width: 82px !important;
      max-width: 82px !important;
    }

    /* Referência: compacta e invariável. */
    #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(2),
    #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(2) {
      width: 88px !important;
      min-width: 88px !important;
      max-width: 88px !important;
    }

    /* QTI vira a 7ª coluna após inserir Fase Lateral. */
    #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(7),
    #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(7) {
      width: 70px !important;
      min-width: 70px !important;
      max-width: 70px !important;
    }

    /* Ações permanece enxuta; todo o restante reparte o espaço livre. */
    #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(11),
    #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(11) {
      width: 58px !important;
      min-width: 58px !important;
      max-width: 58px !important;
    }

    #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(3),
    #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(3),
    #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(4),
    #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(4),
    #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(5),
    #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(5),
    #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(6),
    #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(6),
    #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(8),
    #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(8),
    #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(9),
    #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(9),
    #manejo .manejo-inline-table.manejo-fases-teste-157 th:nth-child(10),
    #manejo .manejo-inline-table.manejo-fases-teste-157 td:nth-child(10) {
      width: auto !important;
      min-width: 0 !important;
      max-width: none !important;
    }

    #manejo .manejo-inline-table.manejo-fases-teste-157 input,
    #manejo .manejo-inline-table.manejo-fases-teste-157 select,
    #manejo .manejo-inline-table.manejo-fases-teste-157 textarea,
    #manejo .manejo-inline-table.manejo-fases-teste-157 .silk-fields,
    #manejo .manejo-inline-table.manejo-fases-teste-157 .tecido-fields,
    #manejo .manejo-inline-table.manejo-fases-teste-157 .fase-plus {
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }

    @media (max-width: 1100px) {
      #manejo .manejo-inline-table.manejo-fases-teste-157 {
        min-width: 1120px !important;
      }
    }
  `;
  document.head.appendChild(style);
})();
