const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const MODULO = path.join(process.cwd(), 'corponu-pagamentos-detalhes-sutia-completo-257.js');
const ATUALIZADOR = path.join(process.cwd(), 'corponu-atualizador.js');

test.describe('Pagamentos - memória do Sutiã Completo 257', () => {
  test('injeta informação somente em Sutiã Completo e preserva ações existentes', async ({ page }) => {
    const fonte = fs.readFileSync(MODULO, 'utf8');

    await page.setContent(`
      <section id="pagamentos">
        <table>
          <thead>
            <tr><th>OP</th><th>Processo</th><th>Total</th><th>Status</th><th>Ações</th></tr>
          </thead>
          <tbody id="listaEntregasPagamento">
            <tr id="sutia">
              <td>12345</td><td>SUTIÃ COMPLETO</td><td>R$ 425,00</td><td>Pendente</td>
              <td><button onclick="alternarStatusEntregaPagamento('pag-sutia')">Pagar</button><button onclick="excluirEntregaPagamento('pag-sutia')">Excluir</button></td>
            </tr>
            <tr id="alca">
              <td>12346</td><td>ALÇA</td><td>R$ 80,00</td><td>Pendente</td>
              <td><button onclick="alternarStatusEntregaPagamento('pag-alca')">Pagar</button><button onclick="excluirEntregaPagamento('pag-alca')">Excluir</button></td>
            </tr>
          </tbody>
        </table>
      </section>
    `);

    await page.addScriptTag({ content: fonte });
    await page.evaluate(() => window.CorpoNuPagamentosDetalhesSutiaCompleto.aplicar());

    await expect(page.locator('#sutia .pag257-info')).toHaveCount(1);
    await expect(page.locator('#sutia .pag257-info')).toHaveAttribute('data-pagamento-id', 'pag-sutia');
    await expect(page.locator('#alca .pag257-info')).toHaveCount(0);
    await expect(page.locator('#sutia button')).toHaveCount(3);
    await expect(page.locator('#sutia button[onclick*="alternarStatusEntregaPagamento"]')).toHaveText('Pagar');
    await expect(page.locator('#sutia button[onclick*="excluirEntregaPagamento"]')).toHaveText('Excluir');
  });

  test('monta a conta histórica completa sem recalcular valores', async ({ page }) => {
    const fonte = fs.readFileSync(MODULO, 'utf8');
    await page.setContent('<section id="pagamentos"><table><thead><tr><th>Processo</th><th>Ações</th></tr></thead><tbody id="listaEntregasPagamento"></tbody></table></section>');
    await page.addScriptTag({ content: fonte });

    const html = await page.evaluate(() => window.CorpoNuPagamentosDetalhesSutiaCompleto.renderizarDetalhes(
      {
        numeroOP: '12345',
        referencia: '411',
        faccao: 'FACÇÃO TESTE',
        dataEntrega: '2026-08-26',
        quantidade: 100,
        subtotalCalculadoSutiaCompleto: 435,
        descontoDefeito: 10,
        totalCalculadoSutiaCompleto: 425,
        total: 425
      },
      {
        valorBase: 5.5,
        descontoLateral: 0.5,
        descontoBojo: 0.25,
        descontoFecho: 0.25,
        descontoPontoLuz: 0.15,
        lateralPronta: true,
        bojoPronto: true,
        fechoPronto: false,
        pontoLuzPronto: false,
        valorUnitarioFinal: 4.35,
        quantidade: 100,
        descontoDefeito: 10,
        totalFinal: 425,
        versao: 'fixture-257'
      },
      'pagamento'
    ));

    expect(html).toContain('Valor base do Sutiã Completo');
    expect(html).toContain('Lateral descontado do valor da facção');
    expect(html).toContain('Bojo descontado do valor da facção');
    expect(html).toContain('Fecho descontado do valor da facção');
    expect(html).toContain('Ponto de luz descontado do valor da facção');
    expect(html).toContain('R$ 5,5000');
    expect(html).toContain('R$ 4,3500');
    expect(html).toContain('R$ 425,00');
    expect(html).toContain('fixture-257');
  });

  test('é somente leitura e está carregado apenas na página Pagamentos', async () => {
    const fonte = fs.readFileSync(MODULO, 'utf8');
    const atualizador = fs.readFileSync(ATUALIZADOR, 'utf8');

    expect(atualizador).toContain('corponu-pagamentos-detalhes-sutia-completo-257.js');
    expect(atualizador).toContain('2026-08-26-pagamentos-detalhes-sutia-completo-257');
    expect(fonte).toContain('getDoc');
    expect(fonte).not.toMatch(/\b(updateDoc|setDoc|deleteDoc|addDoc|writeBatch|runTransaction)\b/);
  });
});
