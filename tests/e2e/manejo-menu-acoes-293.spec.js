const { test, expect } = require('@playwright/test');

test.describe('Menu de ações do Manejo 293', () => {
  test('usa evento delegado e mantém o menu ancorado durante scroll', async ({ request }) => {
    const resposta = await request.get('/app.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    expect(codigo).toContain('data-manejo-acoes-id="${op.id}"');
    expect(codigo).toContain('function toggleMenuAcoesManejo(ordemId, botao)');
    expect(codigo).toContain('botaoAcoesManejo.dataset.manejoAcoesId');
    expect(codigo).toContain('menu.__botaoAncoraManejo = botao');
    expect(codigo).toContain('function agendarReposicionamentoMenuAcoesManejo()');
    expect(codigo).toContain('window.addEventListener("scroll", agendarReposicionamentoMenuAcoesManejo, true)');
    expect(codigo).toContain('const abrirAbaixo = espacoAbaixo >= altura || espacoAbaixo >= espacoAcima');

    expect(codigo).not.toContain('onclick="toggleMenuAcoesManejo(event,');
    expect(codigo).not.toContain('function toggleMenuAcoesManejo(event, ordemId)');
    expect(codigo).not.toContain('window.addEventListener("scroll", fecharMenusAcoesManejo, true)');
  });
});
