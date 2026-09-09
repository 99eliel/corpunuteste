const { test, expect } = require('@playwright/test');

test.describe('Menu de ações do Manejo 294', () => {
  test('usa um único controlador delegado para abrir e executar as ações', async ({ request }) => {
    const resposta = await request.get('/app.js');
    expect(resposta.ok()).toBeTruthy();
    const codigo = await resposta.text();

    // Abertura do menu.
    expect(codigo).toContain('data-manejo-acoes-id="${op.id}"');
    expect(codigo).toContain('function toggleMenuAcoesManejo(ordemId, botao)');
    expect(codigo).toContain('botaoAcoesManejo.dataset.manejoAcoesId');
    expect(codigo).toContain('menu.__botaoAncoraManejo = botao');

    // Ações do menu: nenhuma depende mais de onclick inline/window.*.
    expect(codigo).toContain('data-manejo-acao="faccao"');
    expect(codigo).toContain('data-manejo-acao="celula"');
    expect(codigo).toContain('data-manejo-acao="ajustar"');
    expect(codigo).toContain('data-manejo-acao="historico"');
    expect(codigo).toContain('data-manejo-acao="limpar"');
    expect(codigo).toContain('const botaoAcaoManejo = event.target.closest?.("[data-manejo-acao]")');
    expect(codigo).toContain('switch (acao)');
    expect(codigo).toContain('mandarParaFaccao(ordemId);');
    expect(codigo).toContain('mandarParaCelula(ordemId);');
    expect(codigo).toContain('abrirModalAjusteMigracao(ordemId);');
    expect(codigo).toContain('abrirRastreamentoOP(ordemId);');
    expect(codigo).toContain('limparManejoLinha(ordemId);');

    // Comportamento do menu flutuante durante rolagem.
    expect(codigo).toContain('function agendarReposicionamentoMenuAcoesManejo()');
    expect(codigo).toContain('window.addEventListener("scroll", agendarReposicionamentoMenuAcoesManejo, true)');
    expect(codigo).toContain('const abrirAbaixo = espacoAbaixo >= altura || espacoAbaixo >= espacoAcima');

    expect(codigo).not.toContain('onclick="toggleMenuAcoesManejo(event,');
    expect(codigo).not.toContain('function toggleMenuAcoesManejo(event, ordemId)');
    expect(codigo).not.toContain('window.addEventListener("scroll", fecharMenusAcoesManejo, true)');
    expect(codigo).not.toContain('onclick="window.fecharMenusAcoesManejo(); window.mandarParaFaccao');
    expect(codigo).not.toContain('onclick="window.fecharMenusAcoesManejo(); window.mandarParaCelula');
    expect(codigo).not.toContain('onclick="window.fecharMenusAcoesManejo(); window.abrirModalAjusteMigracao');
    expect(codigo).not.toContain('onclick="window.fecharMenusAcoesManejo(); window.abrirRastreamentoOP');
    expect(codigo).not.toContain('onclick="window.fecharMenusAcoesManejo(); window.limparManejoLinha');
  });
});
