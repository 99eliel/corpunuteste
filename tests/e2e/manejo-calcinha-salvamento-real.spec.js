const { test, expect } = require('@playwright/test');

const TEST_OP = process.env.TEST_OP_CALCINHA || '12346';
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;
const FIREBASE_VERSION = '10.12.5';

async function entrar(page) {
  await page.goto('/');

  const appShell = page.locator('#appShell');
  if (await appShell.isVisible().catch(() => false)) return;

  await expect(page.locator('#loginEmail')).toBeVisible({ timeout: 20_000 });
  await page.locator('#loginEmail').fill(TEST_EMAIL);
  await page.locator('#loginSenha').fill(TEST_PASSWORD);
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(appShell).toBeVisible({ timeout: 30_000 });
}

async function abrirManejoCalcinha(page) {
  const nav = page.locator('.nav-btn[data-page="manejo"]');
  await expect(nav).toBeVisible({ timeout: 20_000 });
  await nav.click();
  await expect(page.locator('#manejo')).toHaveClass(/active/, { timeout: 15_000 });

  const calcinha = page.locator('#manejo .manejo-setor-btn[data-setor="calcinha"]');
  await expect(calcinha).toBeVisible({ timeout: 20_000 });
  await calcinha.click();
  await expect(calcinha).toHaveClass(/active/, { timeout: 15_000 });

  const dedicado = page.locator('#corponuManejoCalcinhaDedicado252');
  await expect(dedicado).toBeVisible({ timeout: 25_000 });
  await expect(page.locator('body')).toHaveAttribute('data-corponu-calcinha-dedicado', '1', { timeout: 25_000 });
  return dedicado;
}

async function prepararFixtureCalcinha(page) {
  return page.evaluate(async ({ op, firebaseVersion }) => {
    const [appModule, authModule, firestore] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-firestore.js`)
    ]);

    const app = appModule.getApps()[0] || appModule.getApp();
    const auth = authModule.getAuth(app);
    const db = firestore.getFirestore(app);
    const user = auth.currentUser;
    if (!user) throw new Error('Usuário de teste não autenticado.');

    const projectId = String(app.options?.projectId || '').trim().toLowerCase();
    if (projectId !== 'corponuteste') {
      throw new Error(`Fixture bloqueada fora da homologação: ${JSON.stringify(app.options?.projectId || '')}.`);
    }

    const configRef = firestore.doc(db, 'configuracoes', 'fasesManejoCalcinha');
    const configSnap = await firestore.getDoc(configRef);
    const sugestoes = (configSnap.exists() ? configSnap.data()?.sugestoes : []) || [];
    const fases = [...new Set(sugestoes.map(item => String(item || '').trim()).filter(Boolean))];
    if (fases.length < 2) {
      throw new Error(`O ambiente de teste precisa ter pelo menos duas Fases oficiais de Calcinha. Encontradas: ${fases.length}.`);
    }

    const referencia = 'E2E-CALCINHA';
    const produtoId = 'calcinha-e2e-calcinha';
    const ordemId = `calcinha-e2e-${String(op).replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}`;

    await firestore.setDoc(firestore.doc(db, 'produtos', produtoId), {
      referencia,
      nome: 'Calcinha E2E',
      tipoPeca: 'calcinha',
      tipoPecaPadrao: 'calcinha',
      tipoPecaLabel: 'Calcinha',
      possuiAlca: false,
      possuiBojo: false,
      possuiRenda: false,
      atualizadoPor: user.uid,
      atualizadoEm: firestore.serverTimestamp()
    }, { merge: true });

    const ordemRef = firestore.doc(db, 'ordensProducao', ordemId);
    const ordemSnap = await firestore.getDoc(ordemRef);
    const atual = ordemSnap.exists() ? ordemSnap.data() : {};
    const faseAtual = String(atual?.manejosSetores?.calcinha?.fase || '').trim();
    const faseInicial = fases.includes(faseAtual) ? faseAtual : fases[0];

    await firestore.setDoc(ordemRef, {
      numeroOP: String(op),
      referencia,
      produtoNome: 'Calcinha E2E',
      cor: 'TESTE AUTOMATIZADO',
      quantidade: 10,
      necessidade: 'TESTE AUTOMATIZADO',
      necessidadeTexto: 'TESTE AUTOMATIZADO',
      necessidadeManual: true,
      tipoPeca: 'calcinha',
      tipoPecaPadrao: 'calcinha',
      tipoPecaLabel: 'Calcinha',
      linhaCalcinha: 'cotton_line',
      linhaCalcinhaLabel: 'Cotton Line',
      processoPlanejado: 'CALCINHA COMPLETA',
      faccaoPlanejada: '',
      planejamentoCalcinhaPendente: true,
      possuiAlca: false,
      possuiBojo: false,
      possuiRenda: false,
      status: 'aberta',
      ocultarDoManejo: false,
      manejosSetores: {
        calcinha: {
          setor: 'calcinha',
          setorLabel: 'Calcinha',
          linhaCalcinha: 'cotton_line',
          linhaCalcinhaLabel: 'Cotton Line',
          fase: faseInicial,
          necessidade: 'TESTE AUTOMATIZADO',
          necessidadeTexto: 'TESTE AUTOMATIZADO',
          status: 'organizada',
          atualizadoPor: user.uid,
          atualizadoEm: firestore.serverTimestamp()
        }
      },
      manejoStatusSetores: { calcinha: 'organizada' },
      atualizadoPor: user.uid,
      atualizadoEm: firestore.serverTimestamp()
    }, { merge: true });

    const confirmacao = await firestore.getDoc(ordemRef);
    if (!confirmacao.exists()) throw new Error('A fixture da OP não foi encontrada logo após setDoc.');

    return { ordemId, fases, faseInicial, projectId };
  }, { op: TEST_OP, firebaseVersion: FIREBASE_VERSION });
}

function cardDaOp(page) {
  return page
    .locator('#corponuManejoCalcinhaDedicado252 [data-cn252-op]')
    .filter({ hasText: `OP ${TEST_OP}` })
    .first();
}

async function filtrarOp(page) {
  const busca = page.locator('#cn252Busca');
  await expect(busca).toBeVisible({ timeout: 20_000 });
  await busca.fill(TEST_OP);
}

async function aguardarCard(page) {
  await filtrarOp(page);
  const card = cardDaOp(page);
  await expect(card, `A fixture de Calcinha OP ${TEST_OP} deveria aparecer no Manejo dedicado`).toBeVisible({ timeout: 25_000 });
  return card;
}

async function aguardarFimSalvamento(page) {
  const mensagem = page.locator('#cn252Msg');
  await expect(mensagem).toContainText('salva', { timeout: 20_000 });
  const card = cardDaOp(page);
  await expect(card.locator('[data-acao="salvar"]')).toBeEnabled({ timeout: 20_000 });
}

test.describe('Manejo Calcinha dedicado - salvamento real', () => {
  test('salva Linha, Fase e Necessidade sem reconstruir o card e persiste após reload', async ({ page, context }, testInfo) => {
    expect(TEST_EMAIL, 'Crie o secret TEST_EMAIL no repositório corpunuteste').toBeTruthy();
    expect(TEST_PASSWORD, 'Crie o secret TEST_PASSWORD no repositório corpunuteste').toBeTruthy();

    const erros = [];
    page.on('pageerror', error => erros.push(`pageerror: ${String(error)}`));
    page.on('console', msg => {
      if (msg.type() === 'error') erros.push(`console: ${msg.text()}`);
    });

    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await entrar(page);
    await abrirManejoCalcinha(page);
    const fixture = await prepararFixtureCalcinha(page);

    // Reabre o app para a fixture entrar nos mapas reais do app e do Dual Mode.
    await page.reload();
    await expect(page.locator('#appShell')).toBeVisible({ timeout: 30_000 });
    await abrirManejoCalcinha(page);

    let card = await aguardarCard(page);
    const fase = card.locator('[data-campo="fase"]');
    const linha = card.locator('[data-campo="linha"]');
    const necessidade = card.locator('[data-campo="necessidade"]');

    await expect(fase).toBeVisible({ timeout: 20_000 });
    const faseOriginal = await fase.inputValue();
    const destino = fixture.fases.find(item => item !== faseOriginal);
    expect(destino, 'A fixture precisa ter uma segunda Fase oficial disponível').toBeTruthy();

    const linhaOriginal = await linha.inputValue();
    const linhaDestino = linhaOriginal === 'cotton_line' ? 'corpo_nu' : 'cotton_line';
    const necessidadeDestino = `E2E ${Date.now()}`;

    await linha.selectOption(linhaDestino);
    await fase.fill(destino);
    await necessidade.fill(necessidadeDestino);

    // Força uma reconstrução controlada pelo filtro ANTES de salvar. Os rascunhos devem sobreviver.
    await page.locator('#cn252Busca').fill(`${TEST_OP} `);
    await page.waitForTimeout(100);
    await page.locator('#cn252Busca').fill(TEST_OP);
    await page.waitForTimeout(100);

    card = cardDaOp(page);
    await expect(card.locator('[data-campo="linha"]')).toHaveValue(linhaDestino);
    await expect(card.locator('[data-campo="fase"]')).toHaveValue(destino);
    await expect(card.locator('[data-campo="necessidade"]')).toHaveValue(necessidadeDestino);

    await page.evaluate(op => {
      const lista = document.getElementById('cn252Lista');
      window.__corponuTesteCalcinha252 = {
        op: String(op),
        iniciouEm: performance.now(),
        mutacoesDiretas: 0,
        cardsRemovidos: 0,
        cardsAdicionados: 0,
        detalhes: []
      };
      const observer = new MutationObserver(records => {
        const dados = window.__corponuTesteCalcinha252;
        records.forEach(record => {
          if (record.target === lista && record.type === 'childList') dados.mutacoesDiretas += 1;
          record.removedNodes.forEach(node => {
            if (node instanceof Element && node.matches('[data-cn252-op]')) {
              dados.cardsRemovidos += 1;
              dados.detalhes.push({ tipo: 'removeu-card', t: Math.round(performance.now() - dados.iniciouEm) });
            }
          });
          record.addedNodes.forEach(node => {
            if (node instanceof Element && node.matches('[data-cn252-op]')) {
              dados.cardsAdicionados += 1;
              dados.detalhes.push({ tipo: 'adicionou-card', t: Math.round(performance.now() - dados.iniciouEm) });
            }
          });
        });
      });
      observer.observe(lista, { childList: true, subtree: false });
      window.__corponuTesteCalcinha252Observer = observer;
    }, TEST_OP);

    const inicio = Date.now();
    await card.locator('[data-acao="salvar"]').click();
    await aguardarFimSalvamento(page);
    const duracaoMs = Date.now() - inicio;
    await page.waitForTimeout(500);

    const metricas = await page.evaluate(() => {
      window.__corponuTesteCalcinha252Observer?.disconnect();
      return window.__corponuTesteCalcinha252;
    });
    metricas.duracaoSalvamentoMs = duracaoMs;
    metricas.faseOriginal = faseOriginal;
    metricas.faseDestino = destino;
    metricas.linhaOriginal = linhaOriginal;
    metricas.linhaDestino = linhaDestino;
    metricas.necessidadeDestino = necessidadeDestino;
    metricas.ordemId = fixture.ordemId;
    metricas.errosConsole = erros;

    console.log(`METRICAS_MANEJO_CALCINHA_252=${JSON.stringify(metricas)}`);
    await testInfo.attach('metricas-manejo-calcinha-252.json', {
      body: Buffer.from(JSON.stringify(metricas, null, 2)),
      contentType: 'application/json'
    });
    await testInfo.attach('apos-salvar-calcinha-252.png', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png'
    });

    card = cardDaOp(page);
    await expect(card.locator('[data-campo="linha"]')).toHaveValue(linhaDestino);
    await expect(card.locator('[data-campo="fase"]')).toHaveValue(destino);
    await expect(card.locator('[data-campo="necessidade"]')).toHaveValue(necessidadeDestino);

    expect(metricas.cardsRemovidos, `O card da OP ${TEST_OP} foi removido durante o salvamento: ${JSON.stringify(metricas)}`).toBe(0);
    expect(metricas.cardsAdicionados, `O card da OP ${TEST_OP} foi recriado durante o salvamento: ${JSON.stringify(metricas)}`).toBe(0);
    expect(duracaoMs, `Salvar Linha/Fase/Necessidade levou ${duracaoMs}ms`).toBeLessThan(8_000);

    await page.reload();
    await expect(page.locator('#appShell')).toBeVisible({ timeout: 30_000 });
    await abrirManejoCalcinha(page);
    card = await aguardarCard(page);
    await expect(card.locator('[data-campo="linha"]')).toHaveValue(linhaDestino, { timeout: 20_000 });
    await expect(card.locator('[data-campo="fase"]')).toHaveValue(destino, { timeout: 20_000 });
    await expect(card.locator('[data-campo="necessidade"]')).toHaveValue(necessidadeDestino, { timeout: 20_000 });
  });
});
