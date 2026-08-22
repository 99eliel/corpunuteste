const { test, expect } = require('@playwright/test');

const email = process.env.TEST_EMAIL;
const senha = process.env.TEST_PASSWORD;
const temCredenciais = Boolean(email && senha);

test.describe('CorpoNu - login autenticado', () => {
  test.skip(!temCredenciais, 'Configure TEST_EMAIL e TEST_PASSWORD nos GitHub Actions Secrets.');

  test('faz login e navega por telas sem alterar dados', async ({ page }) => {
    const errosConsole = [];
    page.on('console', msg => { if (msg.type() === 'error') errosConsole.push(msg.text()); });
    page.on('pageerror', erro => errosConsole.push(String(erro)));

    await page.goto('/');
    await page.locator('#loginEmail').fill(email);
    await page.locator('#loginSenha').fill(senha);
    await page.locator('#loginForm button[type="submit"]').click();

    const appShell = page.locator('#appShell');
    try {
      await expect(appShell).toBeVisible({ timeout: 25_000 });
    } catch (erro) {
      const toast = page.locator('#toast');
      const toastTexto = await toast.isVisible().catch(() => false) ? (await toast.textContent())?.trim() : '';
      throw new Error(`Login de homologação não abriu o sistema. Mensagem: ${toastTexto || '(nenhuma)'}`);
    }

    await expect(page.locator('#authScreen')).toHaveClass(/hidden/);
    const telas = [['manejo', 'Manejo'], ['faccoes', 'Facções'], ['pagamentos', 'Pagamentos'], ['relatorios', 'Relatórios']];
    for (const [pagina, titulo] of telas) {
      const botao = page.locator(`.nav-btn[data-page="${pagina}"]`);
      if (!(await botao.isVisible())) continue;
      await botao.click();
      await expect(page.locator(`#${pagina}`)).toHaveClass(/active/);
      await expect(page.locator('#pageTitle')).toHaveText(titulo);
    }
  });
});
