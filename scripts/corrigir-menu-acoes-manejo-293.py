from pathlib import Path
import re

ARQUIVO = Path('app.js')
source = ARQUIVO.read_text(encoding='utf-8')


def substituir_unico(antigo: str, novo: str, descricao: str) -> None:
    global source
    qtd = source.count(antigo)
    if qtd != 1:
        raise RuntimeError(f'{descricao}: esperado 1 trecho, encontrado {qtd}')
    source = source.replace(antigo, novo, 1)


# 1) O botão deixa de depender de onclick inline/event global.
substituir_unico(
    'onclick="toggleMenuAcoesManejo(event, \'${op.id}\')"',
    'data-manejo-acoes-id="${op.id}"',
    'botão de ações do Manejo'
)

# 2) Menu global ancorado ao botão, com posicionamento adaptativo.
padrao_posicao = re.compile(
    r'function posicionarMenuAcoesManejo\(menu, botao\) \{[\s\S]*?\n\}\n\nfunction toggleMenuAcoesManejo\(event, ordemId\) \{[\s\S]*?\n\}\n\nfunction fecharMenusAcoesManejo\(\) \{',
    re.M
)
if len(padrao_posicao.findall(source)) != 1:
    raise RuntimeError('bloco estrutural do menu de ações não encontrado uma única vez')

novo_bloco = '''function posicionarMenuAcoesManejo(menu, botao) {
  if (!menu || !botao || !botao.isConnected) return;

  const margem = 8;
  const rect = botao.getBoundingClientRect();
  const largura = Math.min(Math.max(menu.offsetWidth || 250, 250), Math.max(250, window.innerWidth - margem * 2));
  const altura = menu.offsetHeight || 260;

  const left = Math.max(
    margem,
    Math.min(window.innerWidth - largura - margem, rect.right - largura)
  );

  const espacoAbaixo = window.innerHeight - rect.bottom - margem;
  const espacoAcima = rect.top - margem;
  const abrirAbaixo = espacoAbaixo >= altura || espacoAbaixo >= espacoAcima;
  const topDesejado = abrirAbaixo
    ? rect.bottom + margem
    : rect.top - altura - margem;
  const top = Math.max(
    margem,
    Math.min(window.innerHeight - altura - margem, topDesejado)
  );

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function toggleMenuAcoesManejo(ordemId, botao) {
  if (!ordemId || !botao) return;

  const menu = getMenuAcoesManejoGlobal();
  const mesmoMenuAberto = menu.classList.contains("open") && menu.dataset.ordemId === String(ordemId);

  fecharMenusAcoesManejo();
  if (mesmoMenuAberto) return;

  menu.dataset.ordemId = String(ordemId);
  menu.innerHTML = montarMenuAcoesManejoHtml(ordemId);
  menu.__botaoAncoraManejo = botao;
  menu.classList.add("open");
  botao.setAttribute("aria-expanded", "true");
  posicionarMenuAcoesManejo(menu, botao);
}

function fecharMenusAcoesManejo() {'''
source = padrao_posicao.sub(novo_bloco, source, count=1)

# 3) Fechar limpa também o estado do botão âncora.
substituir_unico(
    '''    menu.classList.remove("open");
    menu.removeAttribute("style");
    if (menu.id === "menu-acoes-manejo-global") {
      menu.removeAttribute("data-ordem-id");
''',
    '''    menu.classList.remove("open");
    menu.removeAttribute("style");
    if (menu.id === "menu-acoes-manejo-global") {
      menu.__botaoAncoraManejo?.setAttribute?.("aria-expanded", "false");
      menu.__botaoAncoraManejo = null;
      menu.removeAttribute("data-ordem-id");
''',
    'limpeza do estado do menu global'
)

# 4) Substitui o listener antigo: um único listener delegado abre/fecha o menu.
bloco_eventos_antigo = '''document.addEventListener("click", event => {
  if (!event.target.closest(".action-menu-wrap") && !event.target.closest(".action-menu")) fecharMenusAcoesManejo();
});

window.addEventListener("resize", fecharMenusAcoesManejo);
window.addEventListener("scroll", fecharMenusAcoesManejo, true);
'''

bloco_eventos_novo = '''document.addEventListener("click", event => {
  const botaoAcoesManejo = event.target.closest?.("[data-manejo-acoes-id]");
  if (botaoAcoesManejo) {
    event.preventDefault();
    event.stopPropagation();
    toggleMenuAcoesManejo(botaoAcoesManejo.dataset.manejoAcoesId, botaoAcoesManejo);
    return;
  }

  if (!event.target.closest?.(".action-menu")) fecharMenusAcoesManejo();
});

let frameReposicionamentoMenuManejo = 0;
function agendarReposicionamentoMenuAcoesManejo() {
  const menu = document.getElementById("menu-acoes-manejo-global");
  if (!menu?.classList.contains("open")) return;

  if (frameReposicionamentoMenuManejo) cancelAnimationFrame(frameReposicionamentoMenuManejo);
  frameReposicionamentoMenuManejo = requestAnimationFrame(() => {
    frameReposicionamentoMenuManejo = 0;
    const botao = menu.__botaoAncoraManejo;
    if (!botao?.isConnected) {
      fecharMenusAcoesManejo();
      return;
    }
    posicionarMenuAcoesManejo(menu, botao);
  });
}

window.addEventListener("resize", agendarReposicionamentoMenuAcoesManejo);
window.addEventListener("scroll", agendarReposicionamentoMenuAcoesManejo, true);
'''
substituir_unico(bloco_eventos_antigo, bloco_eventos_novo, 'eventos globais do menu de ações')

# Invariantes: não pode sobrar o mecanismo frágil antigo.
proibidos = [
    'onclick="toggleMenuAcoesManejo(event,',
    'function toggleMenuAcoesManejo(event, ordemId)',
    'window.addEventListener("scroll", fecharMenusAcoesManejo, true)',
]
for trecho in proibidos:
    if trecho in source:
        raise RuntimeError(f'mecanismo antigo ainda presente: {trecho}')

esperados = [
    'data-manejo-acoes-id="${op.id}"',
    'function toggleMenuAcoesManejo(ordemId, botao)',
    'botaoAcoesManejo.dataset.manejoAcoesId',
    'menu.__botaoAncoraManejo = botao',
    'function agendarReposicionamentoMenuAcoesManejo()',
    'window.addEventListener("scroll", agendarReposicionamentoMenuAcoesManejo, true)',
    'const abrirAbaixo = espacoAbaixo >= altura || espacoAbaixo >= espacoAcima',
]
for trecho in esperados:
    if trecho not in source:
        raise RuntimeError(f'invariante ausente: {trecho}')

ARQUIVO.write_text(source, encoding='utf-8')
print('Menu de ações do Manejo corrigido estruturalmente.')
