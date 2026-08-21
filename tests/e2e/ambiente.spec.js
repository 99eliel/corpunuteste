const { test, expect } = require('@playwright/test');

const PROJETO_PRODUCAO = 'corponu-b4942';
const PROJETO_HOMOLOGACAO = 'corponuteste';

for (const arquivo of ['app.js', 'login-core.js']) {
  test(`${arquivo} usa somente o Firebase de homologação`, async ({ request }) => {
    const resposta = await request.get(`/${arquivo}?e2e=${Date.now()}`);
    expect(resposta.ok()).toBeTruthy();

    const codigo = await resposta.text();
    expect(codigo).toContain(`projectId: "${PROJETO_HOMOLOGACAO}"`);
    expect(codigo).not.toContain(PROJETO_PRODUCAO);
  });
}

test('E2E roda somente no servidor local da branch', async ({ page }) => {
  await page.goto('/');
  const url = new URL(page.url());

  expect(url.hostname).toBe('127.0.0.1');
  expect(url.port).toBe('4173');
});
