import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD2uN5NrJfeSJEwZnj3Ni9V_Bh9HcDlbrY",
  authDomain: "corponuteste.firebaseapp.com",
  projectId: "corponuteste",
  storageBucket: "corponuteste.firebasestorage.app",
  messagingSenderId: "196591402351",
  appId: "1:196591402351:web:b157dba29e4f747424bc9a",
  measurementId: "G-Y4VWMD3TB1"
};

window.OP_APP_AUTH_READY = true;
window.OP_LOGIN_CORE_ACTIVE = true;

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function el(id){ return document.getElementById(id); }

function setStatus(message, type = "info") {
  const box = el("loginStatus");
  if (!box) return;
  box.textContent = message || "";
  box.className = `notice small login-status ${type}`;
  box.classList.toggle("hidden", !message);
}

function openShell(user, perfil) {
  window.OP_LOGIN_PRELOADED_USER = user;
  window.OP_LOGIN_PRELOADED_PERFIL = perfil;
  el("authScreen")?.classList.add("hidden");
  el("appShell")?.classList.remove("hidden");
  if (el("userName")) el("userName").textContent = perfil?.nome || user?.email || "Usuário";
  if (el("userRole")) el("userRole").textContent = (perfil?.tipo === "admin" || perfil?.admin === true) ? "Admin" : "Acesso personalizado";
}

async function carregarPerfil(user) {
  const snap = await getDoc(doc(db, "usuarios", user.uid));
  if (!snap.exists()) {
    throw new Error(`LOGIN_SEM_PERFIL::${user.uid}`);
  }
  const perfil = { uid: user.uid, ...snap.data() };
  if (perfil.ativo === false) throw new Error("LOGIN_USUARIO_INATIVO");
  if (perfil.ativo === undefined) perfil.ativo = true;
  return perfil;
}

async function loginComFirebase() {
  const form = el("loginForm");
  const email = el("loginEmail")?.value?.trim();
  const senha = el("loginSenha")?.value;
  if (!email || !senha) {
    setStatus("Digite e-mail e senha.", "erro");
    return;
  }
  const btn = form?.querySelector('button[type="submit"]');
  if (btn) {
    btn.disabled = true;
    btn.dataset.textoOriginal = btn.textContent;
    btn.textContent = "Entrando...";
  }
  try {
    setStatus("Conferindo login no Firebase...", "info");
    const cred = await signInWithEmailAndPassword(auth, email, senha);
    setStatus("Login confirmado. Conferindo perfil do usuário...", "info");
    const perfil = await carregarPerfil(cred.user);
    setStatus("Perfil encontrado. Abrindo sistema...", "sucesso");
    openShell(cred.user, perfil);
  } catch (error) {
    console.error("Erro login-core:", error);
    let msg = "Não foi possível entrar. Confira e-mail, senha e conexão.";
    if (String(error?.message || "").startsWith("LOGIN_SEM_PERFIL::")) {
      const uid = String(error.message).split("::")[1];
      msg = `O login existe no Authentication, mas não achei o perfil em usuarios/${uid}.`;
    } else if (error?.message === "LOGIN_USUARIO_INATIVO") {
      msg = "Usuário encontrado, mas está marcado como inativo.";
    } else if (error?.code === "auth/invalid-credential" || error?.code === "auth/wrong-password" || error?.code === "auth/user-not-found") {
      msg = "E-mail ou senha incorretos no Firebase Authentication.";
    } else if (String(error?.code || "").includes("permission-denied")) {
      msg = "Entrou no Authentication, mas o Firestore bloqueou a leitura do perfil. Confira as regras.";
    }
    setStatus(msg, "erro");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset.textoOriginal || "Entrar";
    }
  }
}

function bindLogin() {
  document.querySelectorAll(".toggle-password").forEach(btn => {
    if (btn.dataset.loginCoreReady === "1") return;
    btn.dataset.loginCoreReady = "1";
    btn.addEventListener("click", () => {
      const input = el(btn.dataset.target);
      if (!input) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.textContent = showing ? "Mostrar" : "Ocultar";
    });
  });

  const form = el("loginForm");
  if (form && form.dataset.loginCoreReady !== "1") {
    form.dataset.loginCoreReady = "1";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      event.stopPropagation();
      loginComFirebase();
    }, true);
  }

  el("btnResetSenha")?.addEventListener("click", async () => {
    const email = el("loginEmail")?.value?.trim();
    if (!email) {
      setStatus("Digite seu e-mail primeiro.", "erro");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setStatus("E-mail de redefinição enviado.", "sucesso");
    } catch (error) {
      console.error(error);
      setStatus("Não consegui enviar redefinição de senha.", "erro");
    }
  });
}

document.addEventListener("DOMContentLoaded", bindLogin);

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    const perfil = await carregarPerfil(user);
    window.OP_LOGIN_PRELOADED_USER = user;
    window.OP_LOGIN_PRELOADED_PERFIL = perfil;
  } catch (error) {
    console.warn("Auth existe, mas perfil ainda não foi carregado pelo login-core.", error);
  }
});
