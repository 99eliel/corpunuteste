const { test, expect } = require('@playwright/test');

test.describe('Atualização e módulos legados', () => {
  test('somente o atualizador principal verifica release', async ({ request }) => {
    const principal = await request.get('/corponu-atualizador.js');
    expect(principal.ok()).toBeTruthy();
    const codigoPrincipal = await principal.text();

    expect(codigoPrincipal).toContain('2026-08-22-otimizacao-v2-273');
    expect(codigoPrincipal).toContain('INTERVALO_VERIFICACAO = 60 * 1000');
    expect(codigoPrincipal).toContain('MODULOS_APOS_LOGIN');
    expect(codigoPrincipal).toContain('corponu-dual-ready-bridge.js');
    expect(codigoPrincipal).toContain('corponu-restantes-pendentes-filtro-op-225.js');
    expect(codigoPrincipal).toContain('corponu-sutia-completo-ponto-luz-411-206.js');
    expect(codigoPrincipal).toContain('corponu-manejo-calcinha-estavel-204.js');
    expect(codigoPrincipal).not.toContain('corponu-faccoes-lateral-select-212.js');
    expect(codigoPrincipal).not.toContain('corponu-chegada-manual-sutia-pagamento-automatico.js');

    const compat = await request.get('/corponu-auto-update-runtime-203.js');
    expect(compat.ok()).toBeTruthy();
    const codigoCompat = await compat.text();

    expect(codigoCompat).toContain('2026-08-21-runtime-203-compatibilidade-245');
    expect(codigoCompat).not.toContain('setInterval');
    expect(codigoCompat).not.toContain('setTimeout');
    expect(codigoCompat).not.toContain('fetch(');
    expect(codigoCompat).not.toContain('createElement("script")');
  });

  test('seletor legado Lateral/Alça foi removido', async ({ request }) => {
    const antigo = await request.get('/corponu-faccoes-lateral-select-212.js');
    expect(antigo.status()).toBe(404);

    const novo = await request.get('/corponu-faccoes-tres-abas-saida.js');
    expect(novo.ok()).toBeTruthy();
    const codigoNovo = await novo.text();
    expect(codigoNovo).toContain('corte: ["LATERAL", "ALÇA"]');
    expect(codigoNovo).toContain('preencherProcessos');
  });
});