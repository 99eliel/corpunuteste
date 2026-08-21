const { test, expect } = require('@playwright/test');

const email = process.env.TEST_EMAIL;
const senha = process.env.TEST_PASSWORD;
const temCredenciais = Boolean(email && senha);

async function entrar(page) {
  await page.goto('/');
  await page.locator('#loginEmail').fill(email);
  await page.locator('#loginSenha').fill(senha);
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#appShell')).toBeVisible({ timeout: 25_000 });
}

test.describe('Facções - módulo consolidado', () => {
  test('código definitivo não depende de integrações paralelas nem Observers globais', async ({ request }) => {
    const respostaCorte = await request.get('/corponu-faccoes-corte-definitivo.js');
    expect(respostaCorte.ok()).toBeTruthy();
    const codigoCorte = await respostaCorte.text();

    expect(codigoCorte).toContain('2026-08-21-lateral-alca-fluxo-legado-227');
    expect(codigoCorte).toContain('movimentacaoUsaFluxoLegado');
    expect(codigoCorte).toContain('abrirChegadaCompatibilidade');
    expect(codigoCorte).not.toContain('new MutationObserver');
    expect(codigoCorte).not.toContain('__CORPONU_FACCOES_LATERAL_ALCA__');

    const respostaAbas = await request.get('/corponu-faccoes-tres-abas-saida.js');
    expect(respostaAbas.ok()).toBeTruthy();
    const codigoAbas = await respostaAbas.text();

    expect(codigoAbas).toContain('2026-08-21-faccoes-processos-na-origem-230');
    expect(codigoAbas).toContain('PROCESSOS_SAIDA');
    expect(codigoAbas).toContain('<select id="s3processo"');
    expect(codigoAbas).toContain('Lateral e Alça');
    expect(codigoAbas).not.toContain('new MutationObserver');

    const respostaGrupos = await request.get('/corponu-faccoes-grupos-processos.js');
    expect(respostaGrupos.ok()).toBeTruthy();
    const codigoGrupos = await respostaGrupos.text();

    expect(codigoGrupos).toContain('2026-08-21-faccoes-grupos-consolidados-229');
    expect(codigoGrupos).toContain('preencherSelectFaccoesPorProcesso');
    expect(codigoGrupos).toContain('CorpoNuFaccoesGrupos');
    expect(codigoGrupos).not.toContain('stopImmediatePropagation');
    expect(codigoGrupos).not.toContain('setInterval');

    const respostaExclusaoLegada = await request.get('/corponu-faccoes-lateral-alca-exclusao.js');
    expect(respostaExclusaoLegada.status()).toBe(404);
  });

  test('abre Facções sem loader, fragmentos ou remendos já incorporados', async ({ page }) => {
    test.skip(!temCredenciais, 'Configure TEST_EMAIL e TEST_PASSWORD nos GitHub Actions Secrets.');

    const requisicoes = [];
    const errosPagina = [];

    page.on('request', request => requisicoes.push(request.url()));
    page.on('pageerror', error => errosPagina.push(String(error)));

    await entrar(page);

    await expect.poll(async () => page.evaluate(() => Boolean(window.__CORPONU_FACCOES_CORTE__)), {
      timeout: 15_000
    }).toBeTruthy();

    await page.locator('.nav-btn[data-page="faccoes"]').click();
    await expect(page.locator('#faccoes')).toHaveClass(/active/);
    await expect(page.locator('#pageTitle')).toHaveText('Facções');

    await expect.poll(async () => page.locator('#painelFaccoesCorte').count(), {
      timeout: 15_000
    }).toBeGreaterThan(0);

    await expect(page.locator('#btnCorteGerenciar')).toHaveCount(0);
    await expect(page.locator('#cortePainelAdmin')).toHaveCount(0);
    await expect(page.locator('#btnCorteRegistrarChegada')).toHaveCount(0);

    const observacao = page.locator('#chegadaCorteObs');
    await expect(observacao).toHaveCount(1);
    await expect(observacao).not.toHaveAttribute('required', '');
    await expect(observacao).toHaveAttribute('placeholder', 'Opcional');

    await expect(page.locator('#btnChegadaManualLateralAlca')).toHaveCount(1);
    await expect(page.locator('#abaFaccaoCorte')).toContainText('Lateral e Alça');

    await expect.poll(async () => page.evaluate(() => Boolean(window.__CORPONU_FACCOES_LATERAL_ALCA__)), {
      timeout: 2_000
    }).toBeFalsy();

    await expect.poll(async () => page.evaluate(() => Boolean(window.CorpoNuFaccoesGrupos)), {
      timeout: 10_000
    }).toBeTruthy();

    const locais = requisicoes
      .map(url => new URL(url).pathname.split('/').pop())
      .filter(Boolean);

    const removidos = [
      'corponu-faccoes-corte.js',
      'corponu-faccoes-corte-sem-gerenciamento.js',
      'corponu-lateral-observacao-opcional.js',
      'corponu-faccoes-ocultar-registrar-chegada-topo.js',
      'corponu-faccoes-lateral-alca-integracao.js',
      'corponu-faccoes-label-lateral.js',
      'corponu-faccoes-processos-cadastrados.js',
      'corponu-faccoes-grupos-processos-integracao.js',
      'corponu-faccoes-grupos-saida-fix.js',
      'corponu-faccoes-lateral-alca-exclusao.js'
    ];
    removidos.forEach(nome => expect(locais).not.toContain(nome));

    for (let parte = 1; parte <= 5; parte += 1) {
      expect(locais).not.toContain(`corponu-faccoes-corte-0${parte}.txt`);
    }

    expect(locais).toContain('corponu-faccoes-corte-definitivo.js');
    expect(locais).toContain('corponu-faccoes-grupos-processos.js');
    expect(errosPagina, `Erros JavaScript encontrados: ${errosPagina.join(' | ')}`).toEqual([]);
  });
});
