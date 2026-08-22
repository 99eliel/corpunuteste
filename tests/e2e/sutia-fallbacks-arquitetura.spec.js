const { test, expect } = require('@playwright/test');

test.describe('Sutiã Completo - fallbacks legados', () => {
  test('não altera APIs globais para bloquear callbacks antigos', async ({ request }) => {
    const resposta = await request.get('/corponu-sutia-completo-fallbacks-off.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-sutia-fallbacks-compatibilidade-255');
    expect(codigo).toContain('ativo: false');
    expect(codigo).not.toContain('window.setTimeout =');
    expect(codigo).not.toContain('HTMLFormElement.prototype.requestSubmit =');
    expect(codigo).not.toContain('addEventListener("submit"');
  });

  test('não agenda reconciliação manual sete segundos após a chegada', async ({ request }) => {
    const resposta = await request.get('/corponu-sutia-completo-reconciliacao-manual.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-sutia-reconciliacao-manual-compatibilidade-256');
    expect(codigo).toContain('ativo: false');
    expect(codigo).not.toContain('7000');
    expect(codigo).not.toContain('executarFallback');
    expect(codigo).not.toContain('getDocs');
    expect(codigo).not.toContain('setTimeout');
  });
});