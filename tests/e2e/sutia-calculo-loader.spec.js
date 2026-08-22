const { test, expect } = require('@playwright/test');

test.describe('Sutiã Completo - loader do cálculo', () => {
  test('usa cache versionado e marca somente o submit final para o fluxo rápido', async ({ request }) => {
    const resposta = await request.get('/corponu-sutia-completo-calculo.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-sutia-submit-final-explicito-268');
    expect(codigo).toContain('corponu-sutia-completo-calculo-base-174.js');
    expect(codigo).toContain('fetch(`./${BASE_FILE}?v=${encodeURIComponent(LOADER_VERSION)}`)');
    expect(codigo).toContain('form.dataset.sc107ReenvioSubmit = "1"');
    expect(codigo).toContain('form.dataset.corponuSutiaRapidoTratou === "1"');
    expect(codigo).toContain('marcador do submit final da chegada padrão');
    expect(codigo).toContain('marcador do submit final da chegada manual');
    expect(codigo).toContain('trava explícita do pós-processamento da chegada padrão');
    expect(codigo).toContain('trava explícita do pós-processamento da chegada manual');
    expect(codigo).not.toContain('&t=${Date.now()}');
    expect(codigo).not.toContain('cache: "no-store"');
  });
});