const { test, expect } = require('@playwright/test');

test.describe('CorpoNu - interface pública', () => {
  test('abre a tela de login corretamente', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#authScreen')).toBeVisible();
    await expect(page.locator('#loginForm')).toBeVisible();
    await expect(page.locator('#loginEmail')).toBeVisible();
    await expect(page.locator('#loginSenha')).toBeVisible();
    await expect(page.locator('#loginForm button[type="submit"]')).toHaveText(/Entrar/i);
    await expect(page.locator('#appShell')).toHaveClass(/hidden/);
  });

  test('botão mostrar/ocultar senha funciona', async ({ page }) => {
    await page.goto('/');

    const senha = page.locator('#loginSenha');
    const toggle = page.locator('.toggle-password[data-target="loginSenha"]');

    await expect(senha).toHaveAttribute('type', 'password');
    await toggle.click();
    await expect(senha).toHaveAttribute('type', 'text');
    await toggle.click();
    await expect(senha).toHaveAttribute('type', 'password');
  });

  test('tela de login não cria rolagem horizontal', async ({ page }) => {
    await page.goto('/');

    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });

    expect(overflow).toBeLessThanOrEqual(1);
  });
});
