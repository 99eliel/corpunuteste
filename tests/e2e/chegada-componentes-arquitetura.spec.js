const { test, expect } = require('@playwright/test');

test.describe('Chegadas - arquitetura de componentes', () => {
  test('chegada padrão observa somente o modal e não usa polling', async ({ request }) => {
    const resposta = await request.get('/corponu-chegada-sem-componentes-duplicados.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-chegada-componentes-direta-236');
    expect(codigo).toContain('observadorModal.observe(modal, { childList: true, subtree: true })');
    expect(codigo).not.toContain('setInterval');
    expect(codigo).not.toContain('pageshow');
    expect(codigo).not.toContain('.observe(document.body');
    expect(codigo).not.toContain('.observe(document.documentElement');
    expect(codigo).not.toContain('[60, 180, 450, 900]');
  });

  test('chegada manual observa somente o modal e não usa observer global', async ({ request }) => {
    const resposta = await request.get('/corponu-chegada-manual-sem-componentes-duplicados.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-chegada-manual-componentes-direta-237');
    expect(codigo).toContain('observador.observe(modal, { childList: true, subtree: true })');
    expect(codigo).not.toContain('setInterval');
    expect(codigo).not.toContain('pageshow');
    expect(codigo).not.toContain('.observe(document.documentElement');
    expect(codigo).not.toContain('[0, 100, 300, 700, 1200]');
    expect(codigo).not.toContain('[80, 220, 500, 900]');
  });

  test('limpeza de componentes legados é feita sob demanda uma vez por OP', async ({ request }) => {
    const resposta = await request.get('/corponu-componentes-consolidados-hotfix.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-componentes-legados-sob-demanda-238');
    expect(codigo).toContain('limposNaSessao');
    expect(codigo).toContain('limparPorMovimentacao');
    expect(codigo).toContain('limparPorNumero');
    expect(codigo).not.toContain('[0, 180, 700, 1800, 4200]');
    expect(codigo).not.toContain('[900, 2200, 4800]');
    expect(codigo).not.toContain('setInterval');
  });
});