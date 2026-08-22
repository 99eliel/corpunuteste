const { test, expect } = require('@playwright/test');

test('release publicado acompanha a versão do atualizador', async ({ request }) => {
  const [respostaUpdater, respostaRelease] = await Promise.all([
    request.get('/corponu-atualizador.js'),
    request.get('/corponu-release.json')
  ]);

  expect(respostaUpdater.ok()).toBeTruthy();
  expect(respostaRelease.ok()).toBeTruthy();

  const codigoUpdater = await respostaUpdater.text();
  const release = await respostaRelease.json();
  const match = codigoUpdater.match(/const LOCAL_RELEASE = "([^"]+)"/);

  expect(match, 'LOCAL_RELEASE não foi encontrado no atualizador').toBeTruthy();
  expect(release.version).toBe(match[1]);
});
