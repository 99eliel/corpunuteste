const { test, expect } = require('@playwright/test');

test('update.js inicializa seus recursos apenas uma vez', async ({ request }) => {
  const resposta = await request.get('/update.js');
  expect(resposta.ok()).toBeTruthy();
  const codigo = await resposta.text();

  expect(codigo).toContain('let recursosDaVersaoIniciados = false');
  expect(codigo).toContain('if (recursosDaVersaoIniciados) return');
  expect(codigo).toContain('recursosDaVersaoIniciados = true');
  expect(codigo).toContain('document.addEventListener("DOMContentLoaded", iniciarRecursosDaVersao, { once: true })');
});
