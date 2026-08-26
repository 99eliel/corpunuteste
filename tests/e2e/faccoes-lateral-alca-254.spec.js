const { test, expect } = require('@playwright/test');

const email = process.env.TEST_EMAIL;
const senha = process.env.TEST_PASSWORD;
const temCredenciais = Boolean(email && senha);

async function entrar(page) {
  await page.goto('/');
  await page.locator('#loginEmail').fill(email);
  await page.locator('#loginSenha').fill(senha);
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#appShell')).toBeVisible({ timeout: 25_000 });
}

test.describe('Facções - Lateral e Alça 254', () => {
  test('arquitetura tem um único dono do fluxo e preserva fórmulas financeiras', async ({ request }) => {
    const modulo = await (await request.get('/corponu-faccoes-lateral-alca-254.js')).text();
    const abas = await (await request.get('/corponu-faccoes-tres-abas-saida.js')).text();
    const grupos = await (await request.get('/corponu-faccoes-grupos-processos.js')).text();
    const loader = await (await request.get('/corponu-atualizador.js')).text();

    expect(modulo).toContain('2026-08-26-faccoes-lateral-alca-nativo-254');
    expect(modulo).toContain('{ id: "lateral", nome: "LATERAL"');
    expect(modulo).toContain('{ id: "alca", nome: "ALÇA"');
    expect(modulo).toContain('api.listarFaccoesPorProcesso(processo.nome)');
    expect(modulo).toContain('const paymentId = `corte-${slug(movement.id)}`');
    expect(modulo).toContain('quantidade_recebida_x_2_x_valor_alca');
    expect(modulo).toContain('quantidade_recebida_x_valor_referencia');
    expect(modulo).toContain('if (pagamentoPago(current))');
    expect(modulo).not.toContain('new MutationObserver');
    expect(modulo).toContain('window.CorpoNuFaccoesLateralAlca = apiLateralAlca');
    expect(modulo).not.toContain('data-area-faccoes');
    expect(modulo).not.toContain('injetarClassificacaoFaccao');

    expect(abas).not.toContain('corte: ["LATERAL", "ALÇA"]');
    expect(abas).not.toContain('btnSaidaCorteNovo');
    expect(abas).toContain('if (a === "corte") return;');
    expect(abas).toContain('window.CorpoNuFaccoesLateralAlca?.mostrar?.()');
    expect(abas).not.toContain('faccoesAbasCorte');
    expect(abas).toContain('if (aba === "corte") return toast("Use o fluxo próprio de Lateral e Alça.")');

    expect(grupos).toContain('async function listarFaccoesPorProcesso');
    expect(loader).toContain('corponu-faccoes-lateral-alca-254.js');
    expect(loader).not.toContain('corponu-faccoes-corte-definitivo.js');
  });

  test('interface usa uma única saída e a lista oficial por processo', async ({ page }) => {
    test.skip(!temCredenciais, 'Configure TEST_EMAIL e TEST_PASSWORD.');
    const erros = [];
    page.on('pageerror', error => erros.push(String(error)));

    await entrar(page);
    await page.locator('.nav-btn[data-page="faccoes"]').click();
    await expect(page.locator('#faccoes')).toHaveClass(/active/);
    await expect.poll(() => page.evaluate(() => Boolean(window.CorpoNuFaccoesGrupos?.listarFaccoesPorProcesso)), { timeout: 15_000 }).toBeTruthy();
    await expect.poll(() => page.evaluate(() => Boolean(window.__CORPONU_FACCOES_CORTE__)), { timeout: 15_000 }).toBeTruthy();

    await expect(page.locator('#abaFaccaoCorte')).toHaveCount(1);
    await expect(page.locator('#faccoesAbasCorte')).toHaveCount(0);
    await page.locator('#abaFaccaoCorte').click();
    await expect(page.locator('#painelFaccoesCorte')).toBeVisible();

    await expect(page.locator('#btnCorteRegistrarSaida')).toHaveCount(1);
    await expect(page.locator('#btnSaidaCorteNovo')).toHaveCount(0);
    await expect(page.locator('#modalSaidaCorte')).toHaveCount(1);
    await page.locator('#btnCorteRegistrarSaida').click();
    await expect(page.locator('#modalSaidaCorte')).toBeVisible();

    const processosFonte = await page.evaluate(async () => {
      const itens = await window.CorpoNuFaccoesGrupos.listarProcessosOficiais();
      return itens.map(item => item.nome);
    });
    expect(processosFonte).toContain('LATERAL');
    expect(processosFonte).toContain('ALÇA');

    const grupos = await page.evaluate(async () => ({
      lateral: (await window.CorpoNuFaccoesGrupos.listarFaccoesPorProcesso('LATERAL')).map(item => item.nome),
      alca: (await window.CorpoNuFaccoesGrupos.listarFaccoesPorProcesso('ALÇA')).map(item => item.nome)
    }));
    expect(Array.isArray(grupos.lateral)).toBeTruthy();
    expect(Array.isArray(grupos.alca)).toBeTruthy();

    expect(erros, `Erros JavaScript: ${erros.join(' | ')}`).toEqual([]);
  });
});
