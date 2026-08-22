const { test, expect } = require('@playwright/test');

test('movimentações do usuário consultam campos legados só uma vez por UID', async ({ request }) => {
  const resposta = await request.get('/update.js');
  expect(resposta.ok()).toBeTruthy();
  const codigo = await resposta.text();

  expect(codigo).toContain('let compatibilidadeMovUsuarioConferidaUid = ""');
  expect(codigo).toContain('const precisaCompatibilidade = compatibilidadeMovUsuarioConferidaUid !== uid');
  expect(codigo).toContain('const porChegada = await consultarPorCampoMovUsuario("chegadaRegistradaPor", uid)');
  expect(codigo).toContain('if (precisaCompatibilidade) {');
  expect(codigo).toContain('consultarPorCampoMovUsuario("atualizadoPor", uid)');
  expect(codigo).toContain('consultarPorCampoMovUsuario("criadoPor", uid)');
  expect(codigo).toContain('if (precisaCompatibilidade) compatibilidadeMovUsuarioConferidaUid = uid');
});
