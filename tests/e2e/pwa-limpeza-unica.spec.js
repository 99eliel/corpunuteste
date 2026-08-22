const { test, expect } = require('@playwright/test');

test('update legado não repete a limpeza automática do PWA no load', async ({ request }) => {
  const [respostaUpdate, respostaIndex, respostaAtualizador] = await Promise.all([
    request.get('/update.js'),
    request.get('/index.html'),
    request.get('/corponu-atualizador.js')
  ]);

  expect(respostaUpdate.ok()).toBeTruthy();
  expect(respostaIndex.ok()).toBeTruthy();
  expect(respostaAtualizador.ok()).toBeTruthy();

  const update = await respostaUpdate.text();
  const index = await respostaIndex.text();
  const atualizador = await respostaAtualizador.text();

  expect(index).toContain('navigator.serviceWorker.getRegistrations()');
  expect(atualizador).toContain('async function removerPwaAntigo()');
  expect(atualizador).toContain('await removerPwaAntigo()');

  const trechoLoad = update.match(/window\.addEventListener\("load", \(\) => \{[\s\S]*?\n  \}\);/)?.[0] || '';
  expect(trechoLoad).toContain('rememberVersion()');
  expect(trechoLoad).not.toContain('unregisterOldWorkers()');
  expect(trechoLoad).not.toContain('clearAppCaches()');
});
