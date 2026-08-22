const { test, expect } = require('@playwright/test');

const MODULOS_SUTIA = [
  'corponu-chegada-manual-trava-movimentacao.js',
  'corponu-componentes-consolidados-hotfix.js',
  'corponu-reenvio-sutia-componentes.js',
  'corponu-sutia-completo-calculo.js',
  'corponu-sutia-completo-chegada-rapida.js',
  'corponu-sutia-completo-referencia-especial-integral.js',
  'corponu-sutia-912-chegada-manual-sem-verificacoes.js',
  'corponu-sutia-completo-compatibilidade.js',
  'corponu-sutia-completo-ponto-luz-411-206.js',
  'corponu-chegada-sem-componentes-duplicados.js',
  'corponu-chegada-manual-sem-componentes-duplicados.js'
];

test('pacote de Sutiã não usa polling nem patches globais', async ({ request }) => {
  for (const arquivo of MODULOS_SUTIA) {
    const resposta = await request.get(`/${arquivo}`);
    expect(resposta.ok(), `${arquivo} não carregou`).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo, `${arquivo} voltou a usar setInterval`).not.toContain('setInterval(');
    expect(codigo, `${arquivo} observa documentElement`).not.toContain('.observe(document.documentElement');
    expect(codigo, `${arquivo} observa document.body`).not.toContain('.observe(document.body');
    expect(codigo, `${arquivo} altera EventTarget`).not.toContain('EventTarget.prototype.addEventListener =');
    expect(codigo, `${arquivo} altera requestSubmit`).not.toContain('HTMLFormElement.prototype.requestSubmit =');
    expect(codigo, `${arquivo} altera setTimeout global`).not.toContain('window.setTimeout =');
  }
});
