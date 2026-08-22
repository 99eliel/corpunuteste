const { test, expect } = require('@playwright/test');

test.describe('Sutiã Completo - fluxo sem fallbacks legados', () => {
  test('fallbacks, patches globais e segundo gravador foram removidos do projeto', async ({ request }) => {
    for (const arquivo of [
      'corponu-sutia-completo-fallbacks-off.js',
      'corponu-sutia-completo-reconciliacao-manual.js',
      'corponu-chegada-sutia-sync-legado.js',
      'corponu-sutia-912-fluxo-rapido.js',
      'corponu-chegada-manual-sutia-pagamento-automatico.js'
    ]) {
      const resposta = await request.get(`/${arquivo}`);
      expect(resposta.status(), `${arquivo} ainda existe`).toBe(404);
    }

    const updater = await request.get('/corponu-atualizador.js');
    expect(updater.ok()).toBeTruthy();
    const codigoUpdater = await updater.text();
    expect(codigoUpdater).toContain('2026-08-21-sutia-gravador-unico-268');
    expect(codigoUpdater).not.toContain('corponu-sutia-completo-fallbacks-off.js');
    expect(codigoUpdater).not.toContain('corponu-sutia-completo-reconciliacao-manual.js');
    expect(codigoUpdater).not.toContain('corponu-chegada-sutia-sync-legado.js');
    expect(codigoUpdater).not.toContain('corponu-sutia-912-fluxo-rapido.js');
    expect(codigoUpdater).not.toContain('corponu-chegada-manual-sutia-pagamento-automatico.js');
  });

  test('fluxo rápido é o único gravador e mantém proteção transacional', async ({ request }) => {
    const resposta = await request.get('/corponu-sutia-completo-chegada-rapida.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-sutia-manual-unificado-271');
    expect(codigo).toContain('form.dataset.corponuSutiaRapidoTratou = "1"');
    expect(codigo).toContain('observarModal("modalChegadaMovimentacao")');
    expect(codigo).toContain('observarModal("modalChegadaManualFaccao")');
    expect(codigo).toContain('const precosCache = new Map()');
    expect(codigo).toContain('fs.where("referencia", "==", valor)');
    expect(codigo).toContain('carregarPrecos(referencia)');
    expect(codigo).toContain('document.getElementById("chegadaManualFalta")');
    expect(codigo).toContain('document.getElementById("chegadaManualDesconto")');
    expect(codigo).toContain('await fs.runTransaction(db, async transacao =>');
    expect(codigo).toContain('PAGAMENTO_JA_PAGO');
    expect(codigo).toContain('CHEGADA_JA_CALCULADA');
    expect(codigo).toContain('CHEGADA_DUPLICADA');
    expect(codigo).toContain('manual-chegada-sutia-${numeroOP}-${faccao}-${dataChegada}');

    expect(codigo).not.toContain('fs.getDocs(fs.collection(db, "precosReferencia"))');
    expect(codigo).not.toContain('suprimirPosProcessamentoLegado');
    expect(codigo).not.toContain('window.setTimeout =');
    expect(codigo).not.toContain('HTMLFormElement.prototype.requestSubmit =');
    expect(codigo).not.toContain('observer.observe(document.documentElement');
    expect(codigo).not.toContain('setInterval');
    expect(codigo).not.toContain('EventTarget.prototype.addEventListener =');
    expect(codigo).not.toContain('marcarReenvioNoCapture');
  });

  test('migração da fonte antiga de descontos roda sob demanda', async ({ request }) => {
    const resposta = await request.get('/corponu-sutia-completo-compatibilidade.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-21-sutia-compatibilidade-sob-demanda-257');
    expect(codigo).toContain('substituidaPorCalculoSutiaCompleto');
    expect(codigo).toContain('desativarFonteAntiga');
    expect(codigo).toContain('tentativaRealizada');
    expect(codigo).not.toContain('setInterval');
    expect(codigo).not.toContain('addEventListener("pageshow"');
    expect(codigo).not.toContain('[0, 250, 700]');
  });
});