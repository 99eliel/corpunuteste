const { test, expect } = require('@playwright/test');

const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;
const FIREBASE_VERSION = '10.12.5';

test('prepara fases oficiais E2E da Calcinha somente em homologação', async ({ page }) => {
  expect(TEST_EMAIL, 'Crie TEST_EMAIL nos Secrets do corpunuteste').toBeTruthy();
  expect(TEST_PASSWORD, 'Crie TEST_PASSWORD nos Secrets do corpunuteste').toBeTruthy();

  await page.goto('/');
  const appShell = page.locator('#appShell');
  if (!(await appShell.isVisible().catch(() => false))) {
    await page.locator('#loginEmail').fill(TEST_EMAIL);
    await page.locator('#loginSenha').fill(TEST_PASSWORD);
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(appShell).toBeVisible({ timeout: 30_000 });
  }

  const resultado = await page.evaluate(async firebaseVersion => {
    const [appModule, authModule, firestore] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-firestore.js`)
    ]);

    const app = appModule.getApps()[0] || appModule.getApp();
    const auth = authModule.getAuth(app);
    const db = firestore.getFirestore(app);
    const user = auth.currentUser;
    if (!user) throw new Error('Usuário E2E não autenticado.');

    const projectId = String(app.options?.projectId || '').trim().toLowerCase();
    if (projectId !== 'corponuteste') {
      throw new Error(`Teste bloqueado: projectId atual é ${JSON.stringify(app.options?.projectId || '')}.`);
    }

    const ref = firestore.doc(db, 'configuracoes', 'fasesManejoCalcinha');
    const snap = await firestore.getDoc(ref);
    const atuais = (snap.exists() ? snap.data()?.sugestoes : []) || [];
    const fases = [...new Set(atuais.map(item => String(item || '').trim()).filter(Boolean))];

    for (const fase of ['E2E FASE A', 'E2E FASE B']) {
      if (!fases.includes(fase)) fases.push(fase);
    }

    await firestore.setDoc(ref, {
      sugestoes: fases,
      atualizadoPor: user.uid,
      atualizadoEm: firestore.serverTimestamp()
    }, { merge: true });

    return { projectId, fases };
  }, FIREBASE_VERSION);

  expect(resultado.projectId).toBe('corponuteste');
  expect(resultado.fases).toContain('E2E FASE A');
  expect(resultado.fases).toContain('E2E FASE B');
});
