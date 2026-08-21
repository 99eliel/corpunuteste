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

  test('abre Facções sem loader, fragmentos ou remendos já incorporados', async ({ page }) => {
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

    // Elementos antigos deixam de nascer; não dependem mais de Observers para serem apagados.
    await expect(page.locator('#btnCorteGerenciar')).toHaveCount(0);
    await expect(page.locator('#cortePainelAdmin')).toHaveCount(0);
    await expect(page.locator('#btnCorteRegistrarChegada')).toHaveCount(0);

    // A observação já nasce opcional; não depende mais de timer/listener corretivo.
    const observacao = page.locator('#chegadaCorteObs');
    await expect(observacao).toHaveCount(1);
    await expect(observacao).not.toHaveAttribute('required', '');
    await expect(observacao).toHaveAttribute('placeholder', 'Opcional');

    const locais = requisicoes
      .map(url => new URL(url).pathname.split('/').pop())
      .filter(Boolean);

    const removidos = [
      'corponu-faccoes-corte.js',
      'corponu-faccoes-corte-sem-gerenciamento.js',
      'corponu-lateral-observacao-opcional.js',
      'corponu-faccoes-ocultar-registrar-chegada-topo.js'
    ];
    removidos.forEach(nome => expect(locais).not.toContain(nome));

    for (let parte = 1; parte <= 5; parte += 1) {
      expect(locais).not.toContain(`corponu-faccoes-corte-0${parte}.txt`);
    }

    expect(locais).toContain('corponu-faccoes-corte-definitivo.js');
    expect(errosPagina, `Erros JavaScript encontrados: ${errosPagina.join(' | ')}`).toEqual([]);
  });
});
