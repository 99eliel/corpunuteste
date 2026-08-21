const { test, expect } = require('@playwright/test');

function scriptCom(nomeArquivo) {
  return `script[src*="${nomeArquivo}"]`;
}

async function dispararNavegacao(page, pagina) {
  await page.evaluate(nomePagina => {
    const botao = document.querySelector(`.nav-btn[data-page="${nomePagina}"]`);
    if (!botao) throw new Error(`Botão da página ${nomePagina} não encontrado.`);
    botao.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
  }, pagina);
}

test.describe('CorpoNu - carregamento sob demanda dos módulos', () => {
  test('não baixa módulos visuais de Pagamentos no boot', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForTimeout(700);

    await expect(page.locator(scriptCom('corponu-pagamento-antiduplicidade-isolada.js'))).toHaveCount(1);
    await expect(page.locator(scriptCom('corponu-pagamentos-interface.js'))).toHaveCount(0);
    await expect(page.locator(scriptCom('corponu-pagamentos-filtro-op.js'))).toHaveCount(0);
    await expect(page.locator(scriptCom('corponu-valores-pendentes-financeiro.js'))).toHaveCount(0);
  });

  test('carrega os módulos de Pagamentos quando a aba é solicitada', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await dispararNavegacao(page, 'pagamentos');

    const moduloInterface = page.locator(scriptCom('corponu-pagamentos-interface.js'));
    const moduloFiltro = page.locator(scriptCom('corponu-pagamentos-filtro-op.js'));
    const moduloPendencias = page.locator(scriptCom('corponu-valores-pendentes-financeiro.js'));

    await expect(moduloInterface).toHaveCount(1);
    await expect(moduloFiltro).toHaveCount(1);
    await expect(moduloPendencias).toHaveCount(1);

    const srcs = await page.locator('script[data-corponu-modulo]').evaluateAll(scripts =>
      scripts.map(script => script.src)
    );

    for (const src of srcs) {
      const url = new URL(src);
      expect(url.searchParams.has('v')).toBeTruthy();
      expect(url.searchParams.has('t')).toBeFalsy();
    }
  });

  test('Facções e Processos também carregam suas melhorias somente ao abrir', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });

    await expect(page.locator(scriptCom('corponu-faccao-cadastro-recolhido.js'))).toHaveCount(0);
    await expect(page.locator(scriptCom('corponu-processos-somente-valores.js'))).toHaveCount(0);

    await dispararNavegacao(page, 'faccoes');
    await expect(page.locator(scriptCom('corponu-faccao-cadastro-recolhido.js'))).toHaveCount(1);

    await dispararNavegacao(page, 'processos');
    await expect(page.locator(scriptCom('corponu-processos-somente-valores.js'))).toHaveCount(1);
  });
});
