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
  await expect(page.locator('#listaManejoInline')).toBeVisible({ timeout: 20_000 });
}

async function prepararFixtureCalcinha(page) {
  const resultado = await page.evaluate(async ({ op, firebaseVersion }) => {
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
      tipoPeca: 'calcinha',
      tipoPecaPadrao: 'calcinha',
      tipoPecaLabel: 'Calcinha',
      linhaCalcinha: 'cotton_line',
      processoPlanejado: 'CALCINHA COMPLETA',
      faccaoPlanejada: '',
      planejamentoCalcinhaPendente: true,
      possuiAlca: false,
      possuiBojo: false,
      possuiRenda: false,
      status: 'aberta',
      manejosSetores: {
        calcinha: {
          setor: 'calcinha',
          setorLabel: 'Calcinha',
          linha: 'cotton_line',
          fase: faseInicial,
          necessidade: 'TESTE AUTOMATIZADO',
          status: 'organizada',
          atualizadoPor: user.uid,
          atualizadoEm: firestore.serverTimestamp()
        }
      },
      manejoStatusSetores: { calcinha: 'organizada' },
      atualizadoPor: user.uid,
      atualizadoEm: firestore.serverTimestamp()
    }, { merge: true });

    if (window.corponuDualMode?.refresh) {
      await window.corponuDualMode.refresh();
    }

    return { ordemId, fases, faseInicial };
  }, { op: TEST_OP, firebaseVersion: FIREBASE_VERSION });

  await page.waitForTimeout(500);
  return resultado;
}

function linhaDaOp(page) {
  return page
    .locator('#listaManejoInline tr[data-manejo-row="1"]')
    .filter({ hasText: TEST_OP })
    .first();
}

async function filtrarOp(page) {
  const campo = page.locator('#manejo input[placeholder*="Buscar OP" i], #manejo input[placeholder*="OP, ref" i]').first();
  if (await campo.isVisible().catch(() => false)) {
    await campo.fill(TEST_OP);
  }

  const filtroTabela = page.getByRole('textbox', { name: 'Digite a OP' });
  if (await filtroTabela.isVisible().catch(() => false)) {
    await filtroTabela.fill(TEST_OP);
  }
}

async function aguardarLinha(page) {
  await filtrarOp(page);
  const row = linhaDaOp(page);
  await expect(row, `A fixture de Calcinha OP ${TEST_OP} deveria aparecer no Manejo`).toBeVisible({ timeout: 20_000 });
  return row;
}

async function aguardarFimSalvamento(page) {
  await expect.poll(async () => {
    const row = linhaDaOp(page);
    if (!(await row.count())) return 'linha-ausente';
    return row.evaluate(el => {
      const btn = el.querySelector('.btn-save-manejo');
      const sujo = el.classList.contains('manejo-row-dirty');
      const pendente = el.classList.contains('manejo-row-pending');
      const salvando = btn?.hasAttribute('data-salvando-manejo') || btn?.hasAttribute('data-corponu-salvando');
      const desabilitado = Boolean(btn?.disabled);
      return (!sujo && !pendente && !salvando && !desabilitado) ? 'ok' : 'salvando';
    });
  }, {
    message: 'O salvamento da Fase não terminou no tempo esperado',
    timeout: 20_000,
    intervals: [100, 150, 250, 400, 700]
  }).toBe('ok');
}

test.describe('Manejo Calcinha - salvamento real da Fase', () => {
  test('salva, persiste e não reconstrói a linha ao confirmar', async ({ page, context }, testInfo) => {
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

    let row = await aguardarLinha(page);
    let select = row.locator('.corponu-fase-calcinha-select-223');
    await expect(select).toBeVisible({ timeout: 20_000 });
    await expect(select).toBeEnabled({ timeout: 20_000 });

    const faseOriginal = await select.inputValue();
    const destino = fixture.fases.find(fase => fase !== faseOriginal);
    expect(destino, 'A fixture precisa ter uma segunda Fase oficial disponível').toBeTruthy();

    await page.evaluate(op => {
      const tbody = document.getElementById('listaManejoInline');
      window.__corponuTestePiscar = {
        op: String(op),
        iniciouEm: performance.now(),
        mutacoesDiretas: 0,
        linhasOpRemovidas: 0,
        linhasOpAdicionadas: 0,
        detalhes: []
      };

      const contemOp = node => {
        if (!(node instanceof Element)) return false;
        if (node.matches('tr[data-manejo-row="1"]') && String(node.textContent || '').includes(String(op))) return true;
        return Boolean([...node.querySelectorAll?.('tr[data-manejo-row="1"]') || []]
          .find(row => String(row.textContent || '').includes(String(op))));
      };

      const observer = new MutationObserver(records => {
        const dados = window.__corponuTestePiscar;
        records.forEach(record => {
          if (record.target === tbody && record.type === 'childList') dados.mutacoesDiretas += 1;
          record.removedNodes.forEach(node => {
            if (contemOp(node)) {
              dados.linhasOpRemovidas += 1;
              dados.detalhes.push({ tipo: 'removeu-op', t: Math.round(performance.now() - dados.iniciouEm) });
            }
          });
          record.addedNodes.forEach(node => {
            if (contemOp(node)) {
              dados.linhasOpAdicionadas += 1;
              dados.detalhes.push({ tipo: 'adicionou-op', t: Math.round(performance.now() - dados.iniciouEm) });
            }
          });
        });
      });

      observer.observe(tbody, { childList: true, subtree: true });
      window.__corponuTestePiscarObserver = observer;
    }, TEST_OP);

    await select.selectOption(destino);
    await expect(select).toHaveValue(destino);

    row = linhaDaOp(page);
    const salvar = row.locator('.btn-save-manejo');
    await expect(salvar).toBeVisible({ timeout: 10_000 });

    const inicio = Date.now();
    await salvar.click();
    await aguardarFimSalvamento(page);
    const duracaoMs = Date.now() - inicio;

    // Observa também reconstruções atrasadas provocadas pelo snapshot do Firestore.
    await page.waitForTimeout(1_500);

    const metricas = await page.evaluate(() => {
      window.__corponuTestePiscarObserver?.disconnect();
      return window.__corponuTestePiscar;
    });
    metricas.duracaoSalvamentoMs = duracaoMs;
    metricas.faseOriginal = faseOriginal;
    metricas.faseDestino = destino;
    metricas.ordemId = fixture.ordemId;
    metricas.errosConsole = erros;

    console.log(`METRICAS_FASE_CALCINHA=${JSON.stringify(metricas)}`);
    await testInfo.attach('metricas-fase-calcinha.json', {
      body: Buffer.from(JSON.stringify(metricas, null, 2)),
      contentType: 'application/json'
    });
    await testInfo.attach('apos-salvar.png', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png'
    });

    row = linhaDaOp(page);
    select = row.locator('.corponu-fase-calcinha-select-223');
    await expect(select).toHaveValue(destino, { timeout: 10_000 });

    // Persistência real: recarrega o navegador e lê novamente do Firestore.
    await page.reload();
    await expect(page.locator('#appShell')).toBeVisible({ timeout: 30_000 });
    await abrirManejoCalcinha(page);
    row = await aguardarLinha(page);
    select = row.locator('.corponu-fase-calcinha-select-223');
    await expect(select).toBeVisible({ timeout: 20_000 });
    await expect(select).toHaveValue(destino, { timeout: 20_000 });

    expect(metricas.linhasOpRemovidas, `A linha da OP ${TEST_OP} foi removida durante o salvamento: ${JSON.stringify(metricas)}`).toBe(0);
    expect(metricas.linhasOpAdicionadas, `A linha da OP ${TEST_OP} foi recriada durante o salvamento: ${JSON.stringify(metricas)}`).toBe(0);
    expect(duracaoMs, `Salvar somente a Fase levou ${duracaoMs}ms`).toBeLessThan(8_000);
  });
});
