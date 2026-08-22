const { test, expect } = require('@playwright/test');
const fs = require('fs');

const email = process.env.TEST_EMAIL;
const senha = process.env.TEST_PASSWORD;

async function prepararMedicao(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    window.__corponuLongTasks = [];
    try {
      const observer = new PerformanceObserver(lista => {
        for (const entry of lista.getEntries()) {
          window.__corponuLongTasks.push({ startTime: entry.startTime, duration: entry.duration });
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch (_) {}
  });
}

async function coletarMetricas(page, nome, inicioMs) {
  const metricas = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const recursos = performance.getEntriesByType('resource');
    const scripts = recursos.filter(item => item.initiatorType === 'script' || /\.m?js(?:[?#]|$)/i.test(item.name));
    const locais = recursos.filter(item => item.name.startsWith(location.origin));
    const longTasks = window.__corponuLongTasks || [];
    const modulosDinamicos = [...document.querySelectorAll('script[data-corponu-modulo]')];
    return {
      navigation: nav ? {
        domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
        loadMs: Math.round(nav.loadEventEnd),
        responseEndMs: Math.round(nav.responseEnd)
      } : null,
      recursosTotal: recursos.length,
      scriptsTotal: scripts.length,
      modulosDinamicosTotal: modulosDinamicos.length,
      modulosDinamicos: modulosDinamicos.map(script => new URL(script.src).pathname.split('/').pop()).filter(Boolean),
      bytesTransferidosLocais: Math.round(locais.reduce((soma, item) => soma + (item.transferSize || 0), 0)),
      bytesScriptsLocais: Math.round(scripts.filter(item => item.name.startsWith(location.origin)).reduce((soma, item) => soma + (item.transferSize || 0), 0)),
      longTasksTotal: longTasks.length,
      longTasksMs: Math.round(longTasks.reduce((soma, item) => soma + item.duration, 0)),
      piorLongTaskMs: Math.round(Math.max(0, ...longTasks.map(item => item.duration)))
    };
  });
  metricas.tempoParedeMs = Date.now() - inicioMs;
  metricas.cenario = nome;
  metricas.cpuThrottling = '4x';
  return metricas;
}

async function salvar(testInfo, nomeArquivo, metricas) {
  const json = JSON.stringify(metricas, null, 2);
  fs.mkdirSync('test-results', { recursive: true });
  fs.writeFileSync(`test-results/${nomeArquivo}`, json);
  await testInfo.attach(nomeArquivo, { body: Buffer.from(json), contentType: 'application/json' });
  console.log(`[PERF] ${nomeArquivo}: ${json}`);
}

test.describe('CorpoNu - baseline de desempenho em CPU 4x mais lenta', () => {
  test('mede abertura pública sem alterar dados', async ({ page }, testInfo) => {
    await prepararMedicao(page);
    const inicio = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loginForm')).toBeVisible();
    await page.waitForTimeout(2500);
    const metricas = await coletarMetricas(page, 'abertura-publica', inicio);
    await salvar(testInfo, 'performance-abertura-publica.json', metricas);

    expect(metricas.tempoParedeMs).toBeLessThan(30_000);
    expect(metricas.modulosDinamicosTotal, `Módulos carregados no boot: ${metricas.modulosDinamicos.join(', ')}`).toBeLessThanOrEqual(8);
  });

  test('mede login e primeira renderização do Manejo', async ({ page }, testInfo) => {
    test.skip(!(email && senha), 'Credenciais de homologação não configuradas.');
    await prepararMedicao(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('#loginEmail').fill(email);
    await page.locator('#loginSenha').fill(senha);

    const inicio = Date.now();
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page.locator('#appShell')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#manejo')).toHaveClass(/active/);
    await page.waitForTimeout(3000);

    const metricas = await coletarMetricas(page, 'login-primeiro-manejo', inicio);
    metricas.linhasManejoRenderizadas = await page.locator('#listaManejoInline tr').count();
    await salvar(testInfo, 'performance-login-manejo.json', metricas);

    expect(metricas.tempoParedeMs).toBeLessThan(35_000);
    expect(metricas.modulosDinamicosTotal, `Módulos carregados após login no Manejo: ${metricas.modulosDinamicos.join(', ')}`).toBeLessThanOrEqual(8);
  });
});