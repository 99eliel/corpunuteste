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

test.describe('Facções - módulo consolidado', () => {
  test.skip(!temCredenciais, 'Configure TEST_EMAIL e TEST_PASSWORD nos GitHub Actions Secrets.');

  test('abre Facções sem loader, fragmentos TXT ou Blob legado', async ({ page }) => {
    const requisicoes = [];
    const errosPagina = [];

    page.on('request', request => requisicoes.push(request.url()));
    page.on('pageerror', error => errosPagina.push(String(error)));

    await entrar(page);

    await expect.poll(async () => page.evaluate(() => Boolean(window.__CORPONU_FACCOES_CORTE__)), {
      timeout: 15_000
    }).toBeTruthy();

    await page.locator('.nav-btn[data-page="faccoes"]').click();
    await expect(page.locator('#faccoes')).toHaveClass(/active/);
    await expect(page.locator('#pageTitle')).toHaveText('Facções');

    await expect.poll(async () => page.locator('#painelFaccoesCorte').count(), {
      timeout: 15_000
    }).toBeGreaterThan(0);

    const locais = requisicoes
      .map(url => new URL(url).pathname.split('/').pop())
      .filter(Boolean);

    expect(locais).not.toContain('corponu-faccoes-corte.js');
    for (let parte = 1; parte <= 5; parte += 1) {
      expect(locais).not.toContain(`corponu-faccoes-corte-0${parte}.txt`);
    }

    expect(locais).toContain('corponu-faccoes-corte-definitivo.js');
    expect(errosPagina, `Erros JavaScript encontrados: ${errosPagina.join(' | ')}`).toEqual([]);
  });
});
