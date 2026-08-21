const { test, expect } = require('@playwright/test');

test.describe('Saída para facção - arquitetura', () => {
  test('trava clique duplo sem polling', async ({ request }) => {
    const resposta = await request.get('/corponu-saida-sem-confirmacao.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-saida-trava-sem-polling-243');
    expect(codigo).toContain('observer.observe(modal, { attributes: true, attributeFilter: ["class"] })');
    expect(codigo).toContain('observer.observe(botao, { attributes: true, attributeFilter: ["disabled"] })');
    expect(codigo).toContain('TEMPO_MAXIMO_TRAVA = 20000');
    expect(codigo).not.toContain('setInterval');
    expect(codigo).not.toContain('150);');
  });
});