const { test, expect } = require('@playwright/test');

test.describe('Manejo Calcinha e REF 411 - arquitetura sem polling', () => {
  test('Manejo Calcinha reage a eventos e Dual Ready', async ({ request }) => {
    const resposta = await request.get('/corponu-manejo-calcinha-estavel-204.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-manejo-calcinha-eventos-247');
    expect(codigo).toContain('corponu:dual-ready');
    expect(codigo).toContain('requestAnimationFrame');
    expect(codigo).not.toContain('setInterval');
    expect(codigo).not.toContain('addEventListener("focus"');
  });

  test('Fase Calcinha usa observers da tabela/lista sem timer permanente', async ({ request }) => {
    const resposta = await request.get('/corponu-manejo-calcinha-fase-definitivo-216.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-fase-calcinha-eventos-251');
    expect(codigo).toContain('observerTabela.observe(tbody, { childList: true, subtree: true })');
    expect(codigo).toContain('observerLista.observe(datalist, { childList: true, subtree: true })');
    expect(codigo).toContain('DRAFT_TTL');
    expect(codigo).toContain('corponu:dual-ready');
    expect(codigo).not.toContain('setInterval');
    expect(codigo).not.toContain('[150, 500, 1200, 2500, 5000]');
  });

  test('ponte do Dual Mode dispara evento único sem polling', async ({ request }) => {
    const resposta = await request.get('/corponu-dual-ready-bridge.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-dual-ready-bridge-249');
    expect(codigo).toContain('corponu:dual-ready');
    expect(codigo).toContain('observer.observe(document.head || document.documentElement');
    expect(codigo).not.toContain('setInterval');
    expect(codigo).not.toContain('setTimeout');
  });

  test('regra de ponto de luz 411 observa somente os modais de chegada', async ({ request }) => {
    const resposta = await request.get('/corponu-sutia-completo-ponto-luz-411-206.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-ponto-luz-411-eventos-246');
    expect(codigo).toContain('modalChegadaMovimentacao');
    expect(codigo).toContain('modalChegadaManualFaccao');
    expect(codigo).not.toContain('setInterval');
    expect(codigo).not.toContain('addEventListener("focus"');
    expect(codigo).not.toContain('addEventListener("pageshow"');
  });
});