const { test, expect } = require('@playwright/test');

const TEST_OP = process.env.TEST_OP_CALCINHA || '12345';
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

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

function linhaDaOp(page) {
  return page
    .locator('#listaManejoInline tr[data-manejo-row="1"]')
    .filter({ hasText: TEST_OP })
    .first();
}

async function tentarFiltrarOp(page) {
  const row = linhaDaOp(page);
  if (await row.isVisible().catch(() => false)) return;

  const candidatos = page.locator([
    '#manejo input[id*="op" i]',
    '#manejo input[placeholder*="OP" i]',
    '#manejo input[aria-label*="OP" i]'
  ].join(','));

  const total = await candidatos.count();
  for (let i = 0; i < total; i += 1) {
    const campo = candidatos.nth(i);
    if (!(await campo.isVisible().catch(() => false))) continue;
    const tipo = await campo.getAttribute('type');
    if (tipo === 'number' || tipo === 'search' || tipo === 'text' || !tipo) {
      await campo.fill(TEST_OP).catch(() => {});
      await campo.dispatchEvent('input').catch(() => {});
      await page.waitForTimeout(300);
      if (await row.isVisible().catch(() => false)) return;
    }
  }
}

async function aguardarLinha(page) {
  await tentarFiltrarOp(page);
  const row = linhaDaOp(page);
  await expect(row, `A OP ${TEST_OP} de Calcinha precisa existir no ambiente corpunuteste`).toBeVisible({ timeout: 25_000 });
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
  test('OP 12345 salva, persiste e não reconstrói a linha ao confirmar', async ({ page, context }, testInfo) => {
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

    let row = await aguardarLinha(page);
    let select = row.locator('.corponu-fase-calcinha-select-223');
    await expect(select).toBeVisible({ timeout: 20_000 });
    await expect(select).toBeEnabled({ timeout: 20_000 });

    const faseOriginal = await select.inputValue();
    const opcoes = await select.locator('option:not([disabled])').evaluateAll(options =>
      options
        .map(option => ({ value: String(option.value || '').trim(), text: String(option.textContent || '').trim() }))
        .filter(option => option.value)
    );

    const destino = opcoes.find(option => option.value !== faseOriginal)?.value;
    expect(destino, 'Cadastre pelo menos duas Fases oficiais para a Calcinha no ambiente de teste').toBeTruthy();

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

    // Captura também qualquer reconstrução atrasada causada pelo snapshot do Firestore.
    await page.waitForTimeout(1_500);

    const metricas = await page.evaluate(() => {
      window.__corponuTestePiscarObserver?.disconnect();
      return window.__corponuTestePiscar;
    });
    metricas.duracaoSalvamentoMs = duracaoMs;
    metricas.faseOriginal = faseOriginal;
    metricas.faseDestino = destino;
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

    // Confirma persistência real: recarrega o navegador e lê novamente do Firestore.
    await page.reload();
    await expect(page.locator('#appShell')).toBeVisible({ timeout: 30_000 });
    await abrirManejoCalcinha(page);
    row = await aguardarLinha(page);
    select = row.locator('.corponu-fase-calcinha-select-223');
    await expect(select).toBeVisible({ timeout: 20_000 });
    await expect(select).toHaveValue(destino, { timeout: 20_000 });

    // O objetivo visual é não remover e recriar a linha da OP durante o ACK do Firestore.
    expect(metricas.linhasOpRemovidas, `A linha da OP ${TEST_OP} foi removida durante o salvamento: ${JSON.stringify(metricas)}`).toBe(0);
    expect(metricas.linhasOpAdicionadas, `A linha da OP ${TEST_OP} foi recriada durante o salvamento: ${JSON.stringify(metricas)}`).toBe(0);

    // Não torna milissegundos de rede um falso positivo, mas acusa um salvamento realmente travado.
    expect(duracaoMs, `Salvar somente a Fase levou ${duracaoMs}ms`).toBeLessThan(8_000);
  });
});
