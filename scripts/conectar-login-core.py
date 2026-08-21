from pathlib import Path

arquivo = Path("index.html")
texto = arquivo.read_text(encoding="utf-8")

marcador_login = 'src="./login-core.js'
if marcador_login in texto or 'src="login-core.js' in texto:
    print("login-core.js já está conectado ao index.html")
    raise SystemExit(0)

alvo = '<script type="module" src="app.js?v=2026-08-12-precos-selecao-estavel-187"></script>'
insercao = (
    '<script type="module" src="./login-core.js?v=homologacao-playwright-1"></script>\n'
    '  ' + alvo
)

if alvo not in texto:
    raise SystemExit("ERRO: não encontrei o carregamento esperado de app.js no index.html")

texto_novo = texto.replace(alvo, insercao, 1)

if texto_novo.count("login-core.js") != 1:
    raise SystemExit("ERRO: login-core.js não ficou conectado exatamente uma vez")

arquivo.write_text(texto_novo, encoding="utf-8")
print("login-core.js conectado antes de app.js com sucesso")
