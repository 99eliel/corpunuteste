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
  test('carrega o núcleo direto e não depende dos remendos antigos', async ({ request }) => {
    const resposta = await request.get('/corponu-revisao-lateral-bojo.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-revisao-core-consolidado-232');
    expect(codigo).toContain('restaurarPaginasNormais');
    expect(codigo).toContain('Digite a próxima OP.');
    expect(codigo).not.toContain('new MutationObserver');

    const updater = await request.get('/corponu-atualizador.js');
    expect(updater.ok()).toBeTruthy();
    const codigoUpdater = await updater.text();
    expect(codigoUpdater).toContain('corponu-revisao-lateral-bojo.js');
    expect(codigoUpdater).not.toContain('corponu-revisao-lateral-bojo-fix.js');
    expect(codigoUpdater).not.toContain('corponu-revisao-limpar-apos-salvar.js');

    const loaderAntigo = await request.get('/corponu-revisao-lateral-bojo-fix.js');
    const limpezaAntiga = await request.get('/corponu-revisao-limpar-apos-salvar.js');
    expect(loaderAntigo.status()).toBe(404);
    expect(limpezaAntiga.status()).toBe(404);
  });

  test('entra e sai da Revisão sem deixar as páginas normais escondidas', async ({ page }) => {
    test.skip(!temCredenciais, 'Configure TEST_EMAIL e TEST_PASSWORD nos GitHub Actions Secrets.');

    const erros = [];
    page.on('pageerror', error => erros.push(String(error)));

    await entrar(page);

    const navRevisao = page.locator('.nav-btn[data-page="revisao-componentes"]');
    await expect(navRevisao).toBeVisible({ timeout: 15_000 });
    await navRevisao.click();

    const revisao = page.locator('#revisaoComponentes');
    await expect(revisao).toHaveClass(/active/);
    await expect(revisao).not.toHaveClass(/hidden/);
    await expect(page.locator('#pageTitle')).toHaveText('Revisão lateral e bojo');

    await page.locator('.nav-btn[data-page="manejo"]').click();
    await expect(page.locator('#manejo')).toHaveClass(/active/);
    await expect(page.locator('#manejo')).not.toHaveClass(/hidden/);
    await expect(revisao).not.toHaveClass(/active/);
    await expect(revisao).toHaveClass(/hidden/);

    expect(erros, `Erros JavaScript encontrados: ${erros.join(' | ')}`).toEqual([]);
  });
});
