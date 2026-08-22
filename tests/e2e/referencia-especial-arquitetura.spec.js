const { test, expect } = require('@playwright/test');

test.describe('Sutiã Completo - referência especial', () => {
  test('prepara referência especial pelo fluxo nativo sem reconciliação por chegada', async ({ request }) => {
    const resposta = await request.get('/corponu-sutia-completo-referencia-especial-integral.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-referencia-especial-fluxo-nativo-264');
    expect(codigo).toContain('reconciliarReferencia');
    expect(codigo).toContain('prepararManual');
    expect(codigo).toContain('prepararNormal');
    expect(codigo).toContain('regraReferenciaEspecialIntegral');
    expect(codigo).toContain('descontoDefeito: 0');
    expect(codigo).toContain('lateral.value = "nao_informado"');
    expect(codigo).toContain('bojo.value = "nao_informado"');

    expect(codigo).not.toContain('agendarAssinatura');
    expect(codigo).not.toContain('aplicarAssinatura');
    expect(codigo).not.toContain('[250, 750, 1600, 3200]');
    expect(codigo).not.toContain('const tentativas = new Map()');
  });

  test('reconciliação histórica preserva pagamentos quitados', async ({ request }) => {
    const resposta = await request.get('/corponu-sutia-completo-referencia-especial-integral.js');
    const codigo = await resposta.text();

    expect(codigo).toContain('statusImutavel');
    expect(codigo).toContain('"PAGO", "PAGA", "QUITADO", "QUITADA"');
    expect(codigo).toContain('if (statusImutavel(item) || !pagamentoEhEspecial(item, config)) return false');
  });
});