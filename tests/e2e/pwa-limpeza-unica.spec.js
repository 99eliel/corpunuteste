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

  const inicioLoadFinal = update.lastIndexOf('window.addEventListener("load", () => {');
  expect(inicioLoadFinal, 'listener final de load não encontrado no update.js').toBeGreaterThanOrEqual(0);
  const trechoLoad = update.slice(inicioLoadFinal, inicioLoadFinal + 420);

  expect(trechoLoad).toContain('rememberVersion()');
  expect(trechoLoad).toContain('iniciarRecursosDaVersao()');
  expect(trechoLoad).not.toContain('unregisterOldWorkers()');
  expect(trechoLoad).not.toContain('clearAppCaches()');
});