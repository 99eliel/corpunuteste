# CorpoNu — Homologação e testes E2E

Esta estrutura protege o ambiente de testes do CorpoNu e executa testes automáticos com Playwright.

## Ambientes

- Produção: projeto Firebase `corponu-b4942` — NÃO usar nos testes.
- Homologação: projeto Firebase `corponuteste` — ambiente destinado aos testes.

O workflow `.github/workflows/playwright.yml` executa `scripts/aplicar-firebase-homologacao.py` antes de abrir o navegador. Se algum arquivo voltar a ser copiado da produção, os testes continuam isolados no Firebase `corponuteste`.

## O que a primeira versão testa

- carregamento da página;
- tela e formulário de login;
- campos de e-mail e senha;
- botão Mostrar/Ocultar senha;
- ausência de overflow horizontal na tela de login;
- configuração Firebase de homologação em `app.js` e `login-core.js`;
- desktop Chromium;
- viewport mobile;
- login real e navegação por Manejo, Facções, Pagamentos e Relatórios quando as credenciais de teste estiverem configuradas.

Os testes autenticados desta primeira versão são somente de leitura/navegação. Eles não criam, editam, pagam ou excluem registros.

## Preparar o Firebase de homologação

1. No Firebase `corponuteste`, habilite Authentication > Sign-in method > Email/Password.
2. Crie o Firestore Database.
3. Publique no projeto de homologação as regras contidas em `firestore-rules.txt`.
4. Se Storage for usado, publique também `storage-rules.txt`.
5. Crie um usuário exclusivo para os testes no Firebase Authentication.
6. Copie o UID desse usuário.
7. No Firestore, crie a coleção `usuarios` e um documento cujo ID seja exatamente o UID.
8. Para um usuário de testes com acesso completo, use ao menos:

```text
nome: Teste Automatizado
email: <email do usuário de teste>
tipo: admin
ativo: true
```

## Secrets do GitHub

No repositório, acesse Settings > Secrets and variables > Actions > New repository secret e crie:

- `TEST_EMAIL`
- `TEST_PASSWORD`

Nunca salve a senha do usuário automatizado em arquivos do repositório.

Sem esses Secrets, os testes públicos de interface continuam rodando e o teste de login autenticado é ignorado.

Status da homologação em 20/08/2026: Firebase separado, usuário de teste criado, regras publicadas e os dois Secrets do GitHub cadastrados. Primeiro teste autenticado liberado para execução.

## URL de homologação

Por padrão o GitHub Actions serve os arquivos localmente durante o teste.

Quando o Firebase Hosting de homologação estiver configurado, pode ser criada a variável de Actions:

- `E2E_BASE_URL`

com a URL pública do ambiente de homologação. O Playwright passará a testar o site publicado em vez do servidor local.

## Rodar localmente

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

Para login real, defina `TEST_EMAIL` e `TEST_PASSWORD` no ambiente antes da execução.

## Próximas fases sugeridas

Depois que o login automatizado estiver validado, adicionar testes controlados para OP, Manejo, Facções, chegada e Pagamentos usando somente registros com prefixo de teste e limpeza ao final.
