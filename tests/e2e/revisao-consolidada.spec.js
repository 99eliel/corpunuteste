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

test.describe('Revisão lateral e bojo consolidada', () => {
  test('carrega núcleo, facções e histórico sem os remendos antigos', async ({ request }) => {
    const resposta = await request.get('/corponu-revisao-lateral-bojo.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-revisao-responsaveis-no-core-233');
    expect(codigo).toContain('restaurarPaginasNormais');
    expect(codigo).toContain('revLateralQuemFez');
    expect(codigo).toContain('revBojoQuemFez');
    expect(codigo).toContain('lateralFeitaPorNome');
    expect(codigo).toContain('bojoFeitoPorNome');
    expect(codigo).toContain('Digite a próxima OP.');
    expect(codigo).not.toContain('new MutationObserver');

    const faccoes = await request.get('/corponu-revisao-faccoes.js');
    expect(faccoes.ok()).toBeTruthy();
    const codigoFaccoes = await faccoes.text();
    expect(codigoFaccoes).toContain('2026-08-21-revisao-faccoes-direto-234');
    expect(codigoFaccoes).toContain('grupos-faccoes-processos');
    expect(codigoFaccoes).not.toContain('setInterval');
    expect(codigoFaccoes).not.toContain('addEventListener("pageshow"');
    expect(codigoFaccoes).not.toContain('addEventListener("focus"');
    expect(codigoFaccoes).not.toContain('stopImmediatePropagation');

    const historico = await request.get('/corponu-revisao-historico.js');
    expect(historico.ok()).toBeTruthy();
    const codigoHistorico = await historico.text();
    expect(codigoHistorico).toContain('2026-08-21-revisao-historico-direto-235');
    expect(codigoHistorico).toContain('observerTabela.observe(tbody, { childList: true })');
    expect(codigoHistorico).toContain('LATERAL');
    expect(codigoHistorico).toContain('ENCAPAR BOJO');
    expect(codigoHistorico).not.toContain('setInterval');
    expect(codigoHistorico).not.toContain('.observe(document.body');
    expect(codigoHistorico).not.toContain('addEventListener("pageshow"');
    expect(codigoHistorico).not.toContain('addEventListener("focus"');

    const updater = await request.get('/corponu-atualizador.js');
    expect(updater.ok()).toBeTruthy();
    const codigoUpdater = await updater.text();
    expect(codigoUpdater).toContain('"revisao-componentes"');
    expect(codigoUpdater).toContain('corponu-revisao-lateral-bojo.js');
    expect(codigoUpdater).toContain('corponu-revisao-faccoes.js');
    expect(codigoUpdater).toContain('corponu-revisao-historico.js');
    expect(codigoUpdater).not.toContain('corponu-revisao-lista-estavel.js');
    expect(codigoUpdater).not.toContain('corponu-revisao-lateral-bojo-fix.js');
    expect(codigoUpdater).not.toContain('corponu-revisao-limpar-apos-salvar.js');
    expect(codigoUpdater).not.toContain('corponu-revisao-responsaveis.js');
    expect(codigoUpdater).not.toContain('corponu-revisao-faccoes-select.js');

    for (const arquivo of [
      'corponu-revisao-lista-estavel.js',
      'corponu-revisao-lateral-bojo-fix.js',
      'corponu-revisao-limpar-apos-salvar.js',
      'corponu-revisao-responsaveis.js',
      'corponu-revisao-faccoes-select.js'
    ]) {
      const antigo = await request.get(`/${arquivo}`);
      expect(antigo.status()).toBe(404);
    }
  });

  test('carrega facções e histórico somente quando a Revisão é aberta', async ({ page }) => {
    test.skip(!temCredenciais, 'Configure TEST_EMAIL e TEST_PASSWORD nos GitHub Actions Secrets.');

    const erros = [];
    page.on('pageerror', error => erros.push(String(error)));

    await entrar(page);

    const navRevisao = page.locator('.nav-btn[data-page="revisao-componentes"]');
    await expect(navRevisao).toBeVisible({ timeout: 15_000 });

    await expect.poll(async () => page.evaluate(() => Boolean(window.CorpoNuRevisaoFaccoes)), {
      timeout: 1_500
    }).toBeFalsy();
    await expect.poll(async () => page.evaluate(() => Boolean(window.CorpoNuRevisaoHistorico)), {
      timeout: 1_500
    }).toBeFalsy();

    await navRevisao.click();

    const revisao = page.locator('#revisaoComponentes');
    await expect(revisao).toHaveClass(/active/);
    await expect(revisao).not.toHaveClass(/hidden/);
    await expect(page.locator('#pageTitle')).toHaveText('Revisão lateral e bojo');

    await expect.poll(async () => page.evaluate(() => Boolean(window.CorpoNuRevisaoFaccoes)), {
      timeout: 10_000
    }).toBeTruthy();
    await expect.poll(async () => page.evaluate(() => Boolean(window.CorpoNuRevisaoHistorico)), {
      timeout: 10_000
    }).toBeTruthy();

    await expect(page.locator('#revLateralQuemFez')).toHaveCount(1);
    await expect(page.locator('#revBojoQuemFez')).toHaveCount(1);
    await expect(page.locator('#revHistoricoFiltros')).toHaveCount(1);

    await page.locator('.nav-btn[data-page="manejo"]').click();
    await expect(page.locator('#manejo')).toHaveClass(/active/);
    await expect(page.locator('#manejo')).not.toHaveClass(/hidden/);
    await expect(revisao).not.toHaveClass(/active/);
    await expect(revisao).toHaveClass(/hidden/);

    expect(erros, `Erros JavaScript encontrados: ${erros.join(' | ')}`).toEqual([]);
  });
});