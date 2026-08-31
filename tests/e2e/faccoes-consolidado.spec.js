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

test.describe('Facções - Lateral e Alça V2', () => {
  test('arquitetura elimina o segundo sistema pesado e inclui Cortagem e montagem', async ({ request }) => {
    const resposta = await request.get('/corponu-faccoes-corte-definitivo.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-31-lateral-alca-v2-270');
    expect(codigo).toContain('nome: "LATERAL"');
    expect(codigo).toContain('nome: "ALÇA"');
    expect(codigo).toContain('nome: "CORTAGEM E MONTAGEM"');
    expect(codigo).toContain('VALOR_FIXO_CORTAGEM_MONTAGEM = 0.0540');
    expect(codigo).toContain('faccaoProcesso: "ALÇA"');
    expect(codigo).toContain('tipoValor: "fixo"');
    expect(codigo).toContain('chegadaInformadaStatus: "aguardando_confirmacao_admin"');
    expect(codigo).toContain('chegadaInformadaStatus: "confirmada_admin"');
    expect(codigo).toContain('writeBatch');
    expect(codigo).toContain('CorpoNuSutiaCompleto?.atualizarStatusOP');
    expect(codigo).toContain('painelFaccoesCorte');
    expect(codigo).toContain('CorpoNuFaccoesLateralAlca');

    expect(codigo).not.toContain('new MutationObserver');
    expect(codigo).not.toContain('setInterval');
    expect(codigo).not.toContain('[900, 2200, 4800]');
    expect(codigo).not.toContain('[1500, 3200, 5600]');
    expect(codigo).not.toContain('getDocs(c.fs.collection(c.db, "entregasPagamento"))');
    expect(codigo).not.toContain('getDocs(c.fs.collection(c.db, "precosReferencia"))');
    expect(codigo).not.toContain('CONFIG_ID = "processos-corte"');

    const respostaAbas = await request.get('/corponu-faccoes-tres-abas-saida.js');
    expect(respostaAbas.ok()).toBeTruthy();
    const codigoAbas = await respostaAbas.text();
    expect(codigoAbas).toContain('Lateral e Alça');
    expect(codigoAbas).not.toContain('new MutationObserver');

    const respostaGrupos = await request.get('/corponu-faccoes-grupos-processos.js');
    expect(respostaGrupos.ok()).toBeTruthy();
    const codigoGrupos = await respostaGrupos.text();
    expect(codigoGrupos).toContain('CorpoNuFaccoesGrupos');
  });

  test('abre Lateral e Alça e oferece o novo processo no fluxo próprio', async ({ page }) => {
    test.skip(!temCredenciais, 'Configure TEST_EMAIL e TEST_PASSWORD nos GitHub Actions Secrets.');

    const errosPagina = [];
    page.on('pageerror', error => errosPagina.push(String(error)));

    await entrar(page);
    await page.locator('.nav-btn[data-page="faccoes"]').click();
    await expect(page.locator('#pageTitle')).toHaveText('Facções');
    await expect(page.locator('#faccoes')).toBeVisible();

    await expect.poll(async () => page.evaluate(() => Boolean(window.CorpoNuFaccoesLateralAlca)), {
      timeout: 15_000
    }).toBeTruthy();

    await expect(page.locator('#abaFaccaoCorte')).toContainText('Lateral e Alça');
    await page.locator('#abaFaccaoCorte').click();

    await expect(page.locator('#painelFaccoesCorte')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#btnLA2RegistrarSaida')).toBeVisible();
    await expect(page.locator('#listaFaccoesLateralAlcaV2')).toHaveCount(1);

    await page.locator('#btnLA2RegistrarSaida').click();
    await expect(page.locator('#modalLA2Saida')).toBeVisible();
    await expect(page.locator('#la2SaidaProcesso option[value="lateral"]')).toHaveText('LATERAL');
    await expect(page.locator('#la2SaidaProcesso option[value="alca"]')).toHaveText('ALÇA');
    await expect(page.locator('#la2SaidaProcesso option[value="cortagem-montagem"]')).toContainText('CORTAGEM E MONTAGEM');
    await expect(page.locator('#la2SaidaProcesso option[value="cortagem-montagem"]')).toContainText('0,0540');

    expect(errosPagina, `Erros JavaScript encontrados: ${errosPagina.join(' | ')}`).toEqual([]);
  });
});
