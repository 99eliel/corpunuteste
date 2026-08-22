const { test, expect } = require('@playwright/test');

test.describe('Chegada manual - pré-checagem', () => {
  test('consulta movimentações somente antes do submit final atômico', async ({ request }) => {
    const resposta = await request.get('/corponu-chegada-manual-trava-movimentacao.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-chegada-manual-trava-precheck-270');
    expect(codigo).toContain('const MARCADOR_SUBMIT_FINAL = "sc107ReenvioSubmit"');
    expect(codigo).toContain('if (form.dataset[MARCADOR_SUBMIT_FINAL] === "1") return');
    expect(codigo).toContain('buscarMovimentacoesDaOP(numeroOP)');
    expect(codigo).toContain('form.requestSubmit()');
  });
});
