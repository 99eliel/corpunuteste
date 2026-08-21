from pathlib import Path

ARQUIVOS = [Path('app.js'), Path('login-core.js')]

# Trocas mais específicas vêm antes das genéricas para não alterar
# parcialmente appId/domínios antes da substituição completa.
SUBSTITUICOES = [
    ('1:953146528035:web:6265bde138aca7ef123c96', '1:196591402351:web:b157dba29e4f747424bc9a'),
    ('AIzaSyBhIpXK6bPYiqdmjpuwEOcL5s87alz4HjE', 'AIzaSyD2uN5NrJfeSJEwZnj3Ni9V_Bh9HcDlbrY'),
    ('corponu-b4942.firebasestorage.app', 'corponuteste.firebasestorage.app'),
    ('corponu-b4942.firebaseapp.com', 'corponuteste.firebaseapp.com'),
    ('953146528035', '196591402351'),
    ('G-3FVRT3CD6W', 'G-Y4VWMD3TB1'),
    ('corponu-b4942', 'corponuteste'),
]

ESPERADOS = [
    'apiKey: "AIzaSyD2uN5NrJfeSJEwZnj3Ni9V_Bh9HcDlbrY"',
    'authDomain: "corponuteste.firebaseapp.com"',
    'projectId: "corponuteste"',
    'storageBucket: "corponuteste.firebasestorage.app"',
    'messagingSenderId: "196591402351"',
    'appId: "1:196591402351:web:b157dba29e4f747424bc9a"',
    'measurementId: "G-Y4VWMD3TB1"',
]

for arquivo in ARQUIVOS:
    if not arquivo.exists():
        raise SystemExit(f'Arquivo obrigatório não encontrado: {arquivo}')

    texto = arquivo.read_text(encoding='utf-8')
    original = texto

    for antigo, novo in SUBSTITUICOES:
        texto = texto.replace(antigo, novo)

    if 'corponu-b4942' in texto or '953146528035' in texto:
        raise SystemExit(f'ERRO: {arquivo} ainda contém referência ao Firebase de produção.')

    faltando = [valor for valor in ESPERADOS if valor not in texto]
    if faltando:
        raise SystemExit(f'ERRO: configuração incompleta em {arquivo}: {faltando}')

    if texto != original:
        arquivo.write_text(texto, encoding='utf-8')
        print(f'Atualizado: {arquivo}')
    else:
        print(f'Já estava correto: {arquivo}')

print('Firebase de homologação conferido com sucesso.')
