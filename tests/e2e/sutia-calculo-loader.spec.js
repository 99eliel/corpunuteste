const { test, expect } = require('@playwright/test');

test.describe('Sutiã Completo - loader do cálculo', () => {
  test('usa cache versionado sem timestamp aleatório', async ({ request }) => {
    const resposta = await request.get('/corponu-sutia-completo-calculo.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-sutia-calculo-cacheavel-260');
    expect(codigo).toContain('corponu-sutia-completo-calculo-base-174.js');
    expect(codigo).toContain('fetch(`./${BASE_FILE}?v=${encodeURIComponent(LOADER_VERSION)}`)');
    expect(codigo).not.toContain('&t=${Date.now()}');
    expect(codigo).not.toContain('cache: "no-store"');
  });
});