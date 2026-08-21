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
  test('boot não baixa módulos pesados de Pagamentos, Facções e chegada Sutiã', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForTimeout(700);

    await expect(page.locator(scriptCom('corponu-pagamento-antiduplicidade-isolada.js'))).toHaveCount(1);
    await expect(page.locator(scriptCom('corponu-pagamentos-interface.js'))).toHaveCount(0);
    await expect(page.locator(scriptCom('corponu-pagamentos-filtro-op.js'))).toHaveCount(0);
    await expect(page.locator(scriptCom('corponu-valores-pendentes-financeiro.js'))).toHaveCount(0);
    await expect(page.locator(scriptCom('corponu-verificacao-sutia-completo.js'))).toHaveCount(0);

    await expect(page.locator(scriptCom('corponu-faccoes-grupos-processos.js'))).toHaveCount(0);
    await expect(page.locator(scriptCom('corponu-sutia-completo-calculo.js'))).toHaveCount(0);
    await expect(page.locator(scriptCom('corponu-sutia-completo-chegada-rapida.js'))).toHaveCount(0);
    await expect(page.locator(scriptCom('corponu-chegada-manual-sutia-pagamento-automatico.js'))).toHaveCount(0);
    await expect(page.locator(scriptCom('corponu-chegada-sem-componentes-duplicados.js'))).toHaveCount(0);
    await expect(page.locator(scriptCom('corponu-faccoes-corte-definitivo.js'))).toHaveCount(0);
  });

  test('atualizador preserva o gatilho de grupos para envio direto do Manejo', async ({ request }) => {
    const resposta = await request.get('/corponu-atualizador.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-grupos-faccoes-sob-demanda-242');
    expect(codigo).toContain('garantirGruposParaManejo');
    expect(codigo).toContain('CorpoNuFaccoesGrupos?.filtrarManejo');
    expect(codigo).toContain('onclick.includes("mandarParaFaccao")');
  });

  test('carrega os módulos de Pagamentos quando a aba é solicitada', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await dispararNavegacao(page, 'pagamentos');

    const moduloInterface = page.locator(scriptCom('corponu-pagamentos-interface.js'));
    const moduloFiltro = page.locator(scriptCom('corponu-pagamentos-filtro-op.js'));
    const moduloPendencias = page.locator(scriptCom('corponu-valores-pendentes-financeiro.js'));
    const moduloVerificacaoSutia = page.locator(scriptCom('corponu-verificacao-sutia-completo.js'));

    await expect(moduloInterface).toHaveCount(1);
    await expect(moduloFiltro).toHaveCount(1);
    await expect(moduloPendencias).toHaveCount(1);
    await expect(moduloVerificacaoSutia).toHaveCount(1);

    const srcs = await page.locator('script[data-corponu-modulo]').evaluateAll(scripts =>
      scripts.map(script => script.src)
    );

    for (const src of srcs) {
      const url = new URL(src);
      expect(url.searchParams.has('v')).toBeTruthy();
      expect(url.searchParams.has('t')).toBeFalsy();
    }
  });

  test('Facções carrega grupos, interface e pacote Sutiã somente na primeira abertura', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });

    await expect(page.locator(scriptCom('corponu-faccoes-grupos-processos.js'))).toHaveCount(0);
    await expect(page.locator(scriptCom('corponu-faccao-cadastro-recolhido.js'))).toHaveCount(0);
    await expect(page.locator(scriptCom('corponu-faccoes-corte-definitivo.js'))).toHaveCount(0);
    await expect(page.locator(scriptCom('corponu-sutia-completo-calculo.js'))).toHaveCount(0);

    await dispararNavegacao(page, 'faccoes');

    await expect(page.locator(scriptCom('corponu-faccoes-grupos-processos.js'))).toHaveCount(1);
    await expect(page.locator(scriptCom('corponu-faccao-cadastro-recolhido.js'))).toHaveCount(1);
    await expect(page.locator(scriptCom('corponu-faccoes-corte-definitivo.js'))).toHaveCount(1);
    await expect(page.locator(scriptCom('corponu-faccoes-tres-abas-saida.js'))).toHaveCount(1);
    await expect(page.locator(scriptCom('corponu-sutia-completo-calculo.js'))).toHaveCount(1);
    await expect(page.locator(scriptCom('corponu-sutia-completo-chegada-rapida.js'))).toHaveCount(1);
    await expect(page.locator(scriptCom('corponu-chegada-manual-sutia-pagamento-automatico.js'))).toHaveCount(1);

    await dispararNavegacao(page, 'faccoes');
    await expect(page.locator(scriptCom('corponu-faccoes-grupos-processos.js'))).toHaveCount(1);
    await expect(page.locator(scriptCom('corponu-sutia-completo-calculo.js'))).toHaveCount(1);
    await expect(page.locator(scriptCom('corponu-faccoes-corte-definitivo.js'))).toHaveCount(1);
  });

  test('Processos carrega configuração de Sutiã e sua melhoria visual ao abrir', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });

    await expect(page.locator(scriptCom('corponu-processos-somente-valores.js'))).toHaveCount(0);
    await expect(page.locator(scriptCom('corponu-sutia-completo-calculo.js'))).toHaveCount(0);

    await dispararNavegacao(page, 'processos');
    await expect(page.locator(scriptCom('corponu-sutia-completo-calculo.js'))).toHaveCount(1);
    await expect(page.locator(scriptCom('corponu-processos-somente-valores.js'))).toHaveCount(1);
  });
});