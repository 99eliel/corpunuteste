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
