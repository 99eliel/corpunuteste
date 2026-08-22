const { test, expect } = require('@playwright/test');

test('arquivo grande de valores usa cache versionado', async ({ request }) => {
  const resposta = await request.get('/update.js');
  expect(resposta.ok()).toBeTruthy();
  const codigo = await resposta.text();

  expect(codigo).toContain('const VERSAO_ARQUIVO_VALORES_PROCESSOS = "2026-08-22-valores-cacheaveis-272"');
  expect(codigo).toContain('const versaoArquivo = window.CORPONU_RELEASE_VERSION || VERSAO_ARQUIVO_VALORES_PROCESSOS');
  expect(codigo).toContain('`${ARQUIVO_VALORES_PROCESSOS}?v=${encodeURIComponent(versaoArquivo)}`');
  expect(codigo).toContain('forcar ? { cache: "reload" } : undefined');

  expect(codigo).not.toContain('`${ARQUIVO_VALORES_PROCESSOS}?v=${encodeURIComponent(APP_VERSION)}&ts=${Date.now()}`');
});
