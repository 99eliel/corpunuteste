const { test, expect } = require('@playwright/test');

const email = process.env.TEST_EMAIL;
const senha = process.env.TEST_PASSWORD;
const temCredenciais = Boolean(email && senha);

test.describe('CorpoNu - estabilidade real de Pagamentos', () => {
  test.skip(!temCredenciais, 'Configure TEST_EMAIL e TEST_PASSWORD nos GitHub Actions Secrets.');

  test('abre Pagamentos e continua responsivo após carregar módulos', async ({ page }) => {
    test.setTimeout(90_000);

    const erros = [];
    page.on('console', msg => {
      if (msg.type() === 'error') erros.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', erro => erros.push(`pageerror: ${String(erro)}`));

    await page.goto('/');
    await page.locator('#loginEmail').fill(email);
    await page.locator('#loginSenha').fill(senha);
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page.locator('#appShell')).toBeVisible({ timeout: 25_000 });

    const botaoPagamentos = page.locator('.nav-btn[data-page="pagamentos"]');
    await expect(botaoPagamentos).toBeVisible();
    await botaoPagamentos.click();
    await expect(page.locator('#pagamentos')).toHaveClass(/active/, { timeout: 10_000 });
    await expect(page.locator('#pageTitle')).toHaveText('Pagamentos');

    // Dá tempo para os módulos lazy de Pagamentos carregarem e qualquer loop aparecer.
    await page.waitForTimeout(2500);

    // Mede atraso real do event loop no browser. Em travamento, este evaluate não retorna a tempo.
    const latencias = await page.evaluate(async () => {
      const amostras = [];
      for (let i = 0; i < 12; i++) {
        const inicio = performance.now();
        await new Promise(resolve => setTimeout(resolve, 50));
        amostras.push(performance.now() - inicio);
      }
      return amostras;
    });

    const piorLatencia = Math.max(...latencias);
    expect(piorLatencia).toBeLessThan(1200);

    // Exercita filtros reais sem gravar nada.
    const status = page.locator('#pagamentoFiltroStatus');
    await expect(status).toBeVisible();

    for (const valor of ['todos', 'pendente', 'pago', 'pendente']) {
      const opcoes = await status.locator('option').evaluateAll(opts => opts.map(o => o.value));
      if (!opcoes.includes(valor)) continue;
      await status.selectOption(valor);
      await expect(status).toHaveValue(valor, { timeout: 3000 });
      await page.waitForTimeout(200);
    }

    const inicio = page.locator('#pagamentoDataInicio');
    if (await inicio.isVisible().catch(() => false)) {
      await inicio.fill('2026-01-01');
      await inicio.dispatchEvent('change');
      await page.waitForTimeout(250);
      await inicio.fill('');
      await inicio.dispatchEvent('change');
    }

    // O menu precisa continuar clicável depois de tudo.
    const botaoManejo = page.locator('.nav-btn[data-page="manejo"]');
    if (await botaoManejo.isVisible()) {
      await botaoManejo.click();
      await expect(page.locator('#manejo')).toHaveClass(/active/, { timeout: 5000 });
      await botaoPagamentos.click();
      await expect(page.locator('#pagamentos')).toHaveClass(/active/, { timeout: 5000 });
    }

    // Erros de permissão transitórios/recursos opcionais não são o foco;
    // falhas de loop/stack/observer/render são proibidas.
    const graves = erros.filter(texto => /maximum call stack|out of memory|mutation|observer|renderpagamentos|script error|page unresponsive/i.test(texto));
    expect(graves, `Erros graves detectados: ${graves.join('\n')}`).toEqual([]);
  });
});
