from pathlib import Path

ARQUIVOS = [Path('app.js'), Path('login-core.js')]

SUBSTITUICOES = {
    'AIzaSyBhIpXK6bPYiqdmjpuwEOcL5s87alz4HjE': 'AIzaSyD2uN5NrJfeSJEwZnj3Ni9V_Bh9HcDlbrY',
    'corponu-b4942.firebaseapp.com': 'corponuteste.firebaseapp.com',
    'corponu-b4942': 'corponuteste',
    'corponu-b4942.firebasestorage.app': 'corponuteste.firebasestorage.app',
    '953146528035': '196591402351',
    '1:953146528035:web:6265bde138aca7ef123c96': '1:196591402351:web:b157dba29e4f747424bc9a',
    'G-3FVRT3CD6W': 'G-Y4VWMD3TB1',
}

for arquivo in ARQUIVOS:
    if not arquivo.exists():
        raise SystemExit(f'Arquivo obrigatório não encontrado: {arquivo}')

    texto = arquivo.read_text(encoding='utf-8')
    original = texto

    for antigo, novo in SUBSTITUICOES.items():
        texto = texto.replace(antigo, novo)

    if 'corponu-b4942' in texto:
        raise SystemExit(f'ERRO: {arquivo} ainda contém referência ao Firebase de produção.')

    if 'projectId: "corponuteste"' not in texto:
        raise SystemExit(f'ERRO: {arquivo} não ficou apontando para o projeto corponuteste.')

    if texto != original:
        arquivo.write_text(texto, encoding='utf-8')
        print(f'Atualizado: {arquivo}')
    else:
        print(f'Já estava correto: {arquivo}')

print('Firebase de homologação conferido com sucesso.')
