from pathlib import Path

ARQUIVO = Path('app.js')
source = ARQUIVO.read_text(encoding='utf-8')

antigo_menu = '''function montarMenuAcoesManejoHtml(ordemId) {
  const ordem = state.ordens.find(op => String(op.id) === String(ordemId));
  const setor = getManejoSetorAtual();
  const manejo = ordem ? getManejoDaOrdem(ordem, setor) : null;
  const podeLimpar = Boolean(manejo && ehAdmin());

  return `
    <button type="button" onclick="window.fecharMenusAcoesManejo(); window.mandarParaFaccao('${ordemId}')">Enviar para facção</button>
    <button type="button" onclick="window.fecharMenusAcoesManejo(); window.mandarParaCelula('${ordemId}')">Enviar para célula</button>
    <button type="button" onclick="window.fecharMenusAcoesManejo(); window.abrirModalAjusteMigracao('${ordemId}')">Mover / editar local</button>
    <button type="button" onclick="window.fecharMenusAcoesManejo(); window.abrirRastreamentoOP('${ordemId}')">Ver histórico/rastreamento</button>
    ${podeLimpar ? `<button class="danger" type="button" onclick="window.fecharMenusAcoesManejo(); window.limparManejoLinha('${ordemId}')">Limpar manejo</button>` : ""}
  `;
}
'''

novo_menu = '''function montarMenuAcoesManejoHtml(ordemId) {
  const ordem = state.ordens.find(op => String(op.id) === String(ordemId));
  const setor = getManejoSetorAtual();
  const manejo = ordem ? getManejoDaOrdem(ordem, setor) : null;
  const podeLimpar = Boolean(manejo && ehAdmin());
  const ordemIdHtml = escapeHtml(String(ordemId || ""));

  return `
    <button type="button" data-manejo-acao="faccao" data-ordem-id="${ordemIdHtml}">Enviar para facção</button>
    <button type="button" data-manejo-acao="celula" data-ordem-id="${ordemIdHtml}">Enviar para célula</button>
    <button type="button" data-manejo-acao="ajustar" data-ordem-id="${ordemIdHtml}">Mover / editar local</button>
    <button type="button" data-manejo-acao="historico" data-ordem-id="${ordemIdHtml}">Ver histórico/rastreamento</button>
    ${podeLimpar ? `<button class="danger" type="button" data-manejo-acao="limpar" data-ordem-id="${ordemIdHtml}">Limpar manejo</button>` : ""}
  `;
}
'''

antigo_listener = '''document.addEventListener("click", event => {
  const botaoAcoesManejo = event.target.closest?.("[data-manejo-acoes-id]");
  if (botaoAcoesManejo) {
    event.preventDefault();
    event.stopPropagation();
    toggleMenuAcoesManejo(botaoAcoesManejo.dataset.manejoAcoesId, botaoAcoesManejo);
    return;
  }

  if (!event.target.closest?.(".action-menu")) fecharMenusAcoesManejo();
});
'''

novo_listener = '''document.addEventListener("click", event => {
  const botaoAcoesManejo = event.target.closest?.("[data-manejo-acoes-id]");
  if (botaoAcoesManejo) {
    event.preventDefault();
    event.stopPropagation();
    toggleMenuAcoesManejo(botaoAcoesManejo.dataset.manejoAcoesId, botaoAcoesManejo);
    return;
  }

  const botaoAcaoManejo = event.target.closest?.("[data-manejo-acao]");
  if (botaoAcaoManejo) {
    event.preventDefault();
    event.stopPropagation();

    const ordemId = String(botaoAcaoManejo.dataset.ordemId || "");
    const acao = String(botaoAcaoManejo.dataset.manejoAcao || "");
    fecharMenusAcoesManejo();

    if (!ordemId) return;

    switch (acao) {
      case "faccao":
        mandarParaFaccao(ordemId);
        break;
      case "celula":
        mandarParaCelula(ordemId);
        break;
      case "ajustar":
        abrirModalAjusteMigracao(ordemId);
        break;
      case "historico":
        abrirRastreamentoOP(ordemId);
        break;
      case "limpar":
        limparManejoLinha(ordemId);
        break;
      default:
        console.warn("Ação desconhecida no menu do Manejo:", acao);
    }
    return;
  }

  if (!event.target.closest?.(".action-menu")) fecharMenusAcoesManejo();
});
'''

for antigo, novo, nome in [
    (antigo_menu, novo_menu, 'HTML das ações do menu'),
    (antigo_listener, novo_listener, 'controlador delegado do menu'),
]:
    qtd = source.count(antigo)
    if qtd != 1:
        raise RuntimeError(f'{nome}: esperado 1 trecho, encontrado {qtd}')
    source = source.replace(antigo, novo, 1)

# Invariantes: nenhuma ação do menu volta a depender de onclick/window.
for trecho in [
    'onclick="window.fecharMenusAcoesManejo(); window.mandarParaFaccao',
    'onclick="window.fecharMenusAcoesManejo(); window.mandarParaCelula',
    'onclick="window.fecharMenusAcoesManejo(); window.abrirModalAjusteMigracao',
    'onclick="window.fecharMenusAcoesManejo(); window.abrirRastreamentoOP',
    'onclick="window.fecharMenusAcoesManejo(); window.limparManejoLinha',
]:
    if trecho in source:
        raise RuntimeError(f'handler inline legado ainda presente: {trecho}')

for trecho in [
    'data-manejo-acao="faccao"',
    'data-manejo-acao="celula"',
    'data-manejo-acao="ajustar"',
    'data-manejo-acao="historico"',
    'data-manejo-acao="limpar"',
    'switch (acao)',
    'mandarParaFaccao(ordemId);',
    'mandarParaCelula(ordemId);',
    'abrirModalAjusteMigracao(ordemId);',
    'abrirRastreamentoOP(ordemId);',
    'limparManejoLinha(ordemId);',
]:
    if trecho not in source:
        raise RuntimeError(f'invariante ausente: {trecho}')

ARQUIVO.write_text(source, encoding='utf-8')
print('Correção estrutural das ações do menu Manejo 294 aplicada com sucesso.')
