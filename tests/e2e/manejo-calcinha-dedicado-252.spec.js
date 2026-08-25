const { test, expect } = require('@playwright/test');

test.describe('Manejo Calcinha dedicado 252', () => {
  test('arquitetura não usa observers, polling ou wrapper do salvar genérico', async ({ request }) => {
    const resposta = await request.get('/corponu-manejo-calcinha-dedicado-252.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-25-manejo-calcinha-dedicado-252');
    expect(codigo).toContain('PAGE_SIZE = 80');
    expect(codigo).toContain('window.corponuDualMode?.state');
    expect(codigo).toContain('updateDoc(doc(state.db, "ordensProducao", id)');
    expect(codigo).not.toContain('MutationObserver');
    expect(codigo).not.toContain('setInterval');
    expect(codigo).not.toContain('window.salvarManejoLinha =');
    expect(codigo).not.toContain('onSnapshot(');
    expect(codigo).not.toContain('getDocs(');
  });

  test('atualizador carrega somente o novo Manejo Calcinha', async ({ request }) => {
    const resposta = await request.get('/corponu-atualizador.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('2026-08-25-manejo-calcinha-dedicado-252');
    expect(codigo).toContain('corponu-manejo-calcinha-dedicado-252.js');
    expect(codigo).not.toContain('corponu-manejo-calcinha-estavel-204.js');
    expect(codigo).not.toContain('corponu-manejo-calcinha-fase-definitivo-216.js');
  });

  test('Dual Mode ignora a tabela genérica quando o dedicado está ativo', async ({ request }) => {
    const resposta = await request.get('/corponu-dual-mode.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('function dedicatedCalcinhaActive()');
    expect(codigo).toContain('if (dedicatedCalcinhaActive()) return;');
    expect(codigo).toContain('#corponuManejoCalcinhaDedicado252');
  });

  test('rascunho sobrevive ao filtro e salvar faz uma única escrita sem reconstruir o card', async ({ page, request }) => {
    const resposta = await request.get('/corponu-manejo-calcinha-dedicado-252.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    await page.setContent(`
      <!doctype html>
      <html><head></head><body>
        <div id="appShell">
          <section id="manejo" class="page active">
            <input id="buscaManejoLinha" value="">
            <button class="manejo-setor-btn active" data-setor="calcinha">Calcinha</button>
            <div class="table-wrap">
              <table class="manejo-inline-table">
                <tbody id="listaManejoInline">
                  <tr data-manejo-row="1">
                    <td>12346</td>
                    <td><input id="manejo-op1-fase" value="FASE ANTIGA"></td>
                    <td><input id="manejo-op1-necessidade" value="ANTIGA"></td>
                    <td><button onclick="salvarManejoLinha('op1')">Salvar antigo</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <datalist id="manejoFasesList">
              <option value="FASE ANTIGA"></option>
              <option value="FASE NOVA"></option>
            </datalist>
          </section>
        </div>
      </body></html>
    `);

    await page.evaluate(() => {
      window.__updates252 = [];
      window.__salvarAntigo252 = 0;
      window.salvarManejoLinha = async () => { window.__salvarAntigo252 += 1; };
      const ordem = {
        id: 'op1',
        numeroOP: '12346',
        referencia: '900',
        cor: 'PRETO',
        produtoNome: 'Calcinha teste',
        quantidade: 25,
        tipoPeca: 'calcinha',
        tipoPecaPadrao: 'calcinha',
        tipoPecaLabel: 'Calcinha',
        linhaCalcinha: 'cotton_line',
        necessidade: 'ANTIGA',
        processoPlanejado: 'CALCINHA COMPLETA',
        faccaoPlanejada: 'TESTE',
        ocultarDoManejo: false,
        manejosSetores: {
          calcinha: {
            setor: 'calcinha',
            setorLabel: 'Calcinha',
            linhaCalcinha: 'cotton_line',
            linhaCalcinhaLabel: 'Cotton Line',
            fase: 'FASE ANTIGA',
            necessidade: 'ANTIGA',
            status: 'organizada'
          }
        },
        manejoStatusSetores: { calcinha: 'organizada' }
      };
      window.corponuDualMode = {
        state: {
          ready: true,
          db: { nome: 'db-teste' },
          auth: { currentUser: { uid: 'user-teste' } },
          firebase: {
            doc: (...args) => ({ args }),
            serverTimestamp: () => ({ __serverTimestamp: true }),
            updateDoc: async (ref, patch) => {
              window.__updates252.push({ ref, patch });
            }
          },
          maps: {
            ordens: new Map([['op1', ordem]]),
            movimentacoes: new Map()
          }
        },
        refresh: async () => {}
      };
    });

    await page.addScriptTag({ content: codigo });

    const root = page.locator('#corponuManejoCalcinhaDedicado252');
    await expect(root).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-corponu-calcinha-dedicado', '1');
    await expect(page.locator('#manejo .manejo-inline-table')).toHaveCSS('display', 'none');

    let card = root.locator('[data-cn252-op="op1"]');
    await expect(card).toBeVisible();
    await expect(card.locator('[data-campo="linha"]')).toHaveValue('cotton_line');
    await expect(card.locator('[data-campo="fase"]')).toHaveValue('FASE ANTIGA');
    await expect(card.locator('[data-campo="necessidade"]')).toHaveValue('ANTIGA');

    await card.locator('[data-campo="linha"]').selectOption('corpo_nu');
    await card.locator('[data-campo="fase"]').fill('FASE NOVA');
    await card.locator('[data-campo="necessidade"]').fill('URGENTE TESTE');

    // Força nova renderização pela busca. Os três valores editados devem sobreviver via drafts.
    await root.locator('#cn252Busca').fill('12346');
    await page.waitForTimeout(80);
    card = root.locator('[data-cn252-op="op1"]');
    await expect(card.locator('[data-campo="linha"]')).toHaveValue('corpo_nu');
    await expect(card.locator('[data-campo="fase"]')).toHaveValue('FASE NOVA');
    await expect(card.locator('[data-campo="necessidade"]')).toHaveValue('URGENTE TESTE');

    await page.evaluate(() => {
      const lista = document.getElementById('cn252Lista');
      window.__mutacoesLista252 = 0;
      window.__observerLista252 = new MutationObserver(registros => {
        window.__mutacoesLista252 += registros.filter(r => r.type === 'childList').length;
      });
      window.__observerLista252.observe(lista, { childList: true, subtree: false });
    });

    await card.locator('[data-acao="salvar"]').click();
    await expect(root.locator('#cn252Msg')).toContainText('salva');
    await page.waitForTimeout(100);

    const resultado = await page.evaluate(() => {
      window.__observerLista252?.disconnect();
      const op = window.corponuDualMode.state.maps.ordens.get('op1');
      return {
        updates: window.__updates252,
        salvarAntigo: window.__salvarAntigo252,
        mutacoesLista: window.__mutacoesLista252,
        linha: op.linhaCalcinha,
        fase: op.manejosSetores.calcinha.fase,
        necessidade: op.manejosSetores.calcinha.necessidade
      };
    });

    expect(resultado.salvarAntigo).toBe(0);
    expect(resultado.updates).toHaveLength(1);
    expect(resultado.mutacoesLista).toBe(0);
    expect(resultado.linha).toBe('corpo_nu');
    expect(resultado.fase).toBe('FASE NOVA');
    expect(resultado.necessidade).toBe('URGENTE TESTE');

    const patch = resultado.updates[0].patch;
    expect(patch['manejosSetores.calcinha.linhaCalcinha']).toBe('corpo_nu');
    expect(patch['manejosSetores.calcinha.fase']).toBe('FASE NOVA');
    expect(patch['manejosSetores.calcinha.necessidade']).toBe('URGENTE TESTE');
    expect(patch['manejoStatusSetores.calcinha']).toBe('organizada');
  });
});
