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

  test('migração da fonte antiga de descontos roda sob demanda', async ({ request }) => {
    const resposta = await request.get('/corponu-sutia-completo-compatibilidade.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-sutia-compatibilidade-sob-demanda-257');
    expect(codigo).toContain('substituidaPorCalculoSutiaCompleto');
    expect(codigo).toContain('desativarFonteAntiga');
    expect(codigo).toContain('tentativaRealizada');
    expect(codigo).not.toContain('setInterval');
    expect(codigo).not.toContain('addEventListener("pageshow"');
    expect(codigo).not.toContain('[0, 250, 700]');
  });
});