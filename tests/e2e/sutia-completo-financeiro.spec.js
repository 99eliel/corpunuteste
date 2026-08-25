const { test, expect } = require('@playwright/test');

const email = process.env.TEST_EMAIL;
const senha = process.env.TEST_PASSWORD;
const temCredenciais = Boolean(email && senha);

async function login(page) {
  await page.goto('/');
  await page.locator('#loginEmail').fill(email);
  await page.locator('#loginSenha').fill(senha);
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#appShell')).toBeVisible({ timeout: 25_000 });
}

async function escreverFixture(page, id, dados) {
  await page.evaluate(async ({ id, dados }) => {
    const appMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    const fs = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
    const app = appMod.getApps()[0];
    if (!app) throw new Error('Firebase não inicializado no navegador E2E.');
    const db = fs.getFirestore(app);
    await fs.setDoc(fs.doc(db, 'entregasPagamento', id), dados, { merge: false });
  }, { id, dados });
}

async function apagarFixture(page, id) {
  await page.evaluate(async id => {
    const appMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    const fs = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
    const app = appMod.getApps()[0];
    if (!app) return;
    const db = fs.getFirestore(app);
    await fs.deleteDoc(fs.doc(db, 'entregasPagamento', id)).catch(() => {});
  }, id).catch(() => {});
}

async function abrirCentralPeloListenerReal(page) {
  await expect.poll(async () => page.evaluate(() => Boolean(
    document.documentElement.dataset.corponuPagamentosSeguro
  )), { timeout: 15_000 }).toBe(true);

  await page.evaluate(() => {
    document.getElementById('btnAtualizarConferenciaPagamentoFinal')?.remove();
    const botao = document.createElement('button');
    botao.id = 'btnAtualizarConferenciaPagamentoFinal';
    botao.type = 'button';
    botao.textContent = 'Abrir Central E2E';
    botao.style.position = 'fixed';
    botao.style.left = '8px';
    botao.style.top = '8px';
    botao.style.zIndex = '2147483647';
    document.body.appendChild(botao);
    botao.click();
  });
}

test.describe('Pagamentos - Sutiã Completo automático', () => {
  test.skip(!temCredenciais, 'Configure TEST_EMAIL e TEST_PASSWORD.');

  test('Sutiã Completo com valor calculado não entra na Central; Sutiã Montagem continua manual', async ({ page }) => {
    const sufixo = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const idCompleto = `e2e-sutia-completo-auto-${sufixo}`;
    const idMontagem = `e2e-sutia-montagem-manual-${sufixo}`;
    const opCompleto = `E2E-SC-${sufixo}`;
    const opMontagem = `E2E-SM-${sufixo}`;

    await login(page);

    const base = {
      origem: 'e2e',
      referencia: '900',
      cor: 'TESTE',
      faccao: 'E2E FACCAO',
      dataEntrega: '2099-12-31',
      quantidade: 4,
      descontoDefeito: 0,
      valorUnitario: 25,
      subtotal: 100,
      total: 100,
      statusPagamento: 'pendente',
      valorPendente: false,
      valorTotalDefinidoManualmente: false,
      excluido: false
    };

    try {
      await escreverFixture(page, idCompleto, {
        ...base,
        numeroOP: opCompleto,
        processo: 'SUTIÃ COMPLETO',
        servicoNome: 'SUTIÃ COMPLETO',
        formaValorPagamento: 'CALCULO_AUTOMATICO_SUTIA_COMPLETO',
        calculoSutiaCompletoVersao: 'e2e'
      });

      await escreverFixture(page, idMontagem, {
        ...base,
        numeroOP: opMontagem,
        processo: 'SUTIÃ MONTAGEM',
        servicoNome: 'SUTIÃ MONTAGEM'
      });

      await page.locator('.nav-btn[data-page="pagamentos"]').click();
      await expect(page.locator('#pagamentos')).toHaveClass(/active/);

      // Abre a Central usando exatamente o listener delegado instalado pelo módulo financeiro,
      // sem depender de um botão visual criado por outra camada da interface.
      await abrirCentralPeloListenerReal(page);

      const modal = page.locator('#modalPendenciasValoresFinanceiro');
      await expect(modal).toBeVisible({ timeout: 15_000 });

      // A abertura da Central já força leitura do servidor.
      await expect(modal.locator('#listaPendenciasValores')).not.toContainText('Buscando todos os pagamentos sem valor...', { timeout: 15_000 });

      const textoModal = await modal.innerText();
      expect(textoModal).not.toContain(opCompleto);
      expect(textoModal).toContain(opMontagem);

      // A página precisa continuar respondendo após a abertura da Central.
      await modal.locator('#btnFecharPendenciasValores').click();
      await expect(modal).toHaveClass(/hidden/);
      await page.locator('.nav-btn[data-page="manejo"]').click();
      await expect(page.locator('#manejo')).toHaveClass(/active/);
    } finally {
      await apagarFixture(page, idCompleto);
      await apagarFixture(page, idMontagem);
    }
  });
});
