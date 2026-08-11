import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.mjs";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  runTransaction,
  writeBatch,
  getDocs,
  getCountFromServer,
  addDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBhIpXK6bPYiqdmjpuwEOcL5s87alz4HjE",
  authDomain: "corponu-b4942.firebaseapp.com",
  projectId: "corponu-b4942",
  storageBucket: "corponu-b4942.firebasestorage.app",
  messagingSenderId: "953146528035",
  appId: "1:953146528035:web:6265bde138aca7ef123c96",
  measurementId: "G-3FVRT3CD6W"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

const secondaryApp = initializeApp(firebaseConfig, "SecondaryUserCreator");
const secondaryAuth = getAuth(secondaryApp);

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.mjs";

const state = {
  currentUser: null,
  perfil: null,
  produtos: [],
  ordens: [],
  faccoes: [],
  celulas: [],
  movimentacoesProducao: [],
  manejos: [],
  fasesManejoExtras: [],
  fasesLateraisManejoExtras: [],
  faccoesManejoExtras: [],
  celusManejoExtras: [],
  precosReferencia: [],
  entregasPagamento: [],
  usuarios: [],
  logs: [],
  pdfImportacaoPendente: [],
  relatorioAtual: "enfesto",
  manejoSetorAtual: "sutia",
  dadosCarregados: {},
  carregandoDados: {},
  listenersPorChave: {},
  limitesRenderTabela: {},
  unsubscribers: []
};

// Otimização de leituras Firestore:
// - cache persistente do Firebase acima evita reler tudo em cada F5/atualização de PWA.
// - telas pesadas só carregam quando abertas.
// - renderização fica limitada à tela ativa para não travar filtros/digitação.
const OTIMIZACAO_LEITURAS_ATIVA = true;

function paginaAtivaAtual() {
  return document.querySelector(".page.active")?.id || "manejo";
}

function renderPaginaAtiva() {
  const page = paginaAtivaAtual();

  if (page === "produtos") {
    renderProdutos();
    renderProdutosPendentes();
  }
  if (page === "ordens") renderOrdens();
  if (page === "manejo") {
    renderFiltrosColunasManejo();
    renderManejoInline();
    renderDatalistManejo();
    renderDatalistReferencias();
    renderDatalistCores();
    renderDatalistNecessidadesOrdem();
  }
  if (page === "processos") renderProcessos();
  if (page === "faccoes") {
    renderFaccoes();
    renderFaccoesPendentes();
    renderFaccoesMovimentacoes();
  }
  if (page === "celulas") {
    renderCelulas();
    renderCelulasMovimentacoes();
  }
  if (page === "rastreamento") renderRastreamento();
  if (page === "pagamentos") renderPagamentos();
  if (page === "relatorios") renderRelatorio();
  if (page === "usuarios") renderUsuarios();
  if (page === "logs") renderLogs();

  aplicarPermissoesTela();
}

const pageInfo = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Resumo geral das ordens e referências cadastradas."
  },
  produtos: {
    title: "Produtos / Referências",
    subtitle: "Cadastre as referências e marque se usam alça, bojo e renda."
  },
  ordens: {
    title: "Ordens de Produção",
    subtitle: "Crie OPs informando referência, cor, quantidade e necessidade livre."
  },
  manejo: {
    title: "Manejo",
    subtitle: "Preparação interna da OP e encaminhamento para facção ou célula."
  },
  processos: {
    title: "Processos",
    subtitle: "Visualização em tempo real das informações do manejo."
  },
  faccoes: {
    title: "Facções",
    subtitle: "Cadastre facções externas, dados de pagamento e contato."
  },
  celulas: {
    title: "Células",
    subtitle: "Cadastre as células internas da produção."
  },
  rastreamento: {
    title: "Rastreamento",
    subtitle: "Veja onde cada peça/OP está no fluxo de produção."
  },
  pagamentos: {
    title: "Pagamentos",
    subtitle: "Use a tabela de preços e as movimentações de facção para fechar pagamentos."
  },
  relatorios: {
    title: "Relatórios",
    subtitle: "Relatórios gerais, silk obrigatório e específicos por setor."
  },
  usuarios: {
    title: "Usuários",
    subtitle: "Gerencie logins comuns e admins."
  },
  logs: {
    title: "Logs / Auditoria",
    subtitle: "Acompanhe quem fez as ações importantes no sistema."
  },
  backup: {
    title: "Importar / Backup",
    subtitle: "Importe dados da planilha ou baixe backup atual."
  }
};

const reportInfo = {
  enfesto: {
    title: "Relatório de Enfesto",
    subtitle: "Processo geral: todas as ordens aparecem neste relatório.",
    tipo: "geral"
  },
  corte: {
    title: "Relatório de Corte",
    subtitle: "Processo geral: todas as ordens aparecem neste relatório.",
    tipo: "geral"
  },
  silk: {
    title: "Relatório de Silk",
    subtitle: "Processo obrigatório: todas as ordens aparecem neste relatório.",
    tipo: "geral"
  },
  separacao: {
    title: "Relatório de Separação",
    subtitle: "Processo geral: todas as ordens aparecem neste relatório.",
    tipo: "geral"
  },
  renda: {
    title: "Relatório de Renda",
    subtitle: "Relatório específico: mostra somente referências que possuem renda.",
    tipo: "especifico",
    campo: "possuiRenda",
    coluna: "Renda"
  },
  alca: {
    title: "Relatório de Alça",
    subtitle: "Relatório específico: mostra somente referências que possuem alça.",
    tipo: "especifico",
    campo: "possuiAlca",
    coluna: "Alça"
  },
  bojo: {
    title: "Relatório de Bojo",
    subtitle: "Relatório específico: mostra somente referências que possuem bojo.",
    tipo: "especifico",
    campo: "possuiBojo",
    coluna: "Bojo"
  },
  bipadas: {
    title: "Relatório de Peças Bipadas",
    subtitle: "Mostra movimentações finalizadas/bipadas em Facções e Células.",
    tipo: "bipado",
    coluna: "Bipado"
  }
};


const FACCOES_EXTRAIDAS_PLANILHA = [];
const LIGIA_MIGRACAO_DADOS_URL = 'dados-ligia-migracao.json';

// Processos e facções oficiais usados no envio para facção.
// A escolha agora segue a ordem: primeiro processo, depois facções permitidas.
const PROCESSOS_FACCAO_PADRAO = [
  "ENCAPAR BOJO",
  "ALÇA",
  "CALCINHA MONTAGEM",
  "CALCINHA COMPLETA",
  "SUTIÃ MONTAGEM",
  "SUTIÃ COMPLETO"
];

// No envio do Manejo Sutiã, aparecem somente processos relacionados a sutiã.
// Isso evita selecionar processo de calcinha por engano e também filtra as facções corretas.
const PROCESSOS_FACCAO_POR_SETOR_PADRAO = {
  sutia: ["ENCAPAR BOJO", "SUTIÃ COMPLETO", "SUTIÃ MONTAGEM", "ALÇA"],
  calcinha: ["CALCINHA MONTAGEM", "CALCINHA COMPLETA"]
};

const FACCOES_POR_PROCESSO_PADRAO = {
  "ENCAPAR BOJO": ["DIVINA", "GRACIANE", "JESSICA", "LARISSA", "ALINE BATISTA", "DAIANY", "NAGILA", "DELMA", "GIRLAINE"],
  "ALÇA": ["JANAINA", "IVONE", "LUANA", "KARYTA", "SIMEI", "SIMONE"],
  "CALCINHA MONTAGEM": ["ANA FLAVIA", "KAUANE", "LIANA", "DAIANA", "LEIDIANE", "ANDREZA"],
  "CALCINHA COMPLETA": ["LORENA", "JEAN", "SCHENEIDER", "DANIELA", "KAMILA", "LIANDRA", "JUZENI", "THEILLOR", "SILVANY", "LEONARDO", "MATHEUS", "BEATRIZ", "MARILIA", "DARLLEN", "RONEIDIA"],
  "SUTIÃ MONTAGEM": ["LIVIA", "FRACEILDA", "MOCINHA", "NAYARA", "NAGILA", "GIRLAINE", "JHENIFER"],
  "SUTIÃ COMPLETO": ["DANUBIA", "KAKA", "GISLAINY", "ITAMAR", "LUCIA", "GOIANIRA"]
};

const ALIASES_PROCESSO_FACCAO = {
  "BOJO": "ENCAPAR BOJO",
  "ENCAPAR": "ENCAPAR BOJO",
  "ENCAPAR BOJOS": "ENCAPAR BOJO",
  "ALCA": "ALÇA",
  "ALCAS": "ALÇA",
  "ALÇAS": "ALÇA",
  "CALCINHA": "CALCINHA COMPLETA",
  "MONTAGEM CALCINHA": "CALCINHA MONTAGEM",
  "SUTIA MONTAGEM": "SUTIÃ MONTAGEM",
  "SUTIÃ MONTAGEM": "SUTIÃ MONTAGEM",
  "SUTIA COMPLETO": "SUTIÃ COMPLETO",
  "SUTIÃ COMPLETO": "SUTIÃ COMPLETO"
};

const ALIASES_NOME_FACCAO = {
  "LARA CRISTINA KAKA": "KAKA",
  "LARA CRISTINA (KAKA)": "KAKA",
  "LARA CRISTINA(KAKA)": "KAKA",
  "LARA CRISTINA / KAKA": "KAKA",
  "LARA CRISTINA/KAKA": "KAKA",
  "KAKA LARA CRISTINA": "KAKA",
  // Variação comum da mesma facção na planilha/cadastro.
  "GISLAINE": "GISLAINY"
};


function carregarSugestoesFaccoesCelus() {
  try {
    const faccoes = JSON.parse(localStorage.getItem("faccoesManejoExtras") || "[]");
    state.faccoesManejoExtras = Array.isArray(faccoes) ? faccoes : [];
  } catch (error) {
    state.faccoesManejoExtras = [];
  }

  try {
    const celus = JSON.parse(localStorage.getItem("celusManejoExtras") || "[]");
    state.celusManejoExtras = Array.isArray(celus) ? celus : [];
  } catch (error) {
    state.celusManejoExtras = [];
  }
}



const SIDEBAR_STORAGE_KEY = "op_confeccao_sidebar_collapsed";

function sidebarEstaRecolhida() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch (error) {
    return false;
  }
}

function salvarEstadoSidebar(recolhida) {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, recolhida ? "1" : "0");
  } catch (error) {
    console.warn("Não foi possível salvar o estado da sidebar.", error);
  }
}

function aplicarEstadoSidebar(recolhida) {
  const shell = document.getElementById("appShell");
  const btn = document.getElementById("btnToggleSidebar");
  if (!shell) return;

  shell.classList.toggle("sidebar-collapsed", !!recolhida);

  if (btn) {
    btn.textContent = recolhida ? "▶" : "◀";
    btn.setAttribute("aria-label", recolhida ? "Expandir menu" : "Recolher menu");
    btn.setAttribute("title", recolhida ? "Expandir menu" : "Recolher menu");
  }
}

function alternarSidebar() {
  const proximoEstado = !sidebarEstaRecolhida();
  salvarEstadoSidebar(proximoEstado);
  aplicarEstadoSidebar(proximoEstado);
}

function configurarSidebarRetratil() {
  const btn = document.getElementById("btnToggleSidebar");
  if (btn) {
    btn.addEventListener("click", alternarSidebar);
  }

  aplicarEstadoSidebar(sidebarEstaRecolhida());
}


document.addEventListener("DOMContentLoaded", () => {
  carregarSugestoesFaccoesCelus();
  carregarSugestoesExtrasManejo();
  configurarVisibilidadeSenhas();
  configurarSidebarRetratil();
  configurarAuth();
  configurarNavegacao();
  document.getElementById("btnAtualizarServidor")?.addEventListener("click", atualizarDadosServidorAgora);
  configurarProduto();
  configurarOrdem();
  configurarManejo();
  configurarProcessos();
  configurarFaccoes();
  configurarCelulas();
  configurarRastreamento();
  configurarModalMovimentacao();
  configurarModalChegadaMovimentacao();
  configurarChegadaManualFaccao();
  configurarPagamentos();
  configurarRelatorios();
  configurarUsuarios();
  configurarLogs();
  configurarImportadorPDF();
  configurarBackup();
  preencherAnoAtual();
  preencherCamposPDFImportacao();
});


function configurarVisibilidadeSenhas() {
  document.querySelectorAll(".toggle-password").forEach(botao => {
    botao.addEventListener("click", () => {
      const targetId = botao.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;

      const mostrando = input.type === "text";
      input.type = mostrando ? "password" : "text";
      botao.textContent = mostrando ? "Mostrar" : "Ocultar";
    });
  });
}

function configurarAuth() {
  document.getElementById("loginForm").addEventListener("submit", async event => {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const senha = document.getElementById("loginSenha").value;

    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (error) {
      console.error(error);
      toast("Erro ao entrar. Confira e-mail e senha.");
    }
  });

  document.getElementById("btnResetSenha").addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value.trim();

    if (!email) {
      toast("Digite seu e-mail primeiro.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      toast("E-mail de redefinição enviado.");
    } catch (error) {
      console.error(error);
      toast("Não foi possível enviar o e-mail de redefinição.");
    }
  });

  document.getElementById("btnLogout").addEventListener("click", async () => {
    await signOut(auth);
  });

  onAuthStateChanged(auth, async user => {
    limparListeners();

    if (!user) {
      state.currentUser = null;
      state.perfil = null;
      mostrarTelaLogin();
      return;
    }

    state.currentUser = user;

    try {
      const perfilSnap = await getDoc(doc(db, "usuarios", user.uid));

      if (!perfilSnap.exists()) {
        await signOut(auth);
        toast("Login sem perfil no Firestore. Crie o documento em usuarios usando o UID deste usuário.");
        return;
      }

      const perfil = {
        uid: user.uid,
        ...perfilSnap.data()
      };

      if (!perfil.ativo) {
        await signOut(auth);
        toast("Usuário inativo. Fale com o administrador.");
        return;
      }

      state.perfil = perfil;
      mostrarSistema();
      iniciarListenersFirestore();
      registrarLog("login", "sistema", "Sistema", "Usuário entrou no sistema.");
    } catch (error) {
      console.error(error);
      await signOut(auth);
      toast("Erro de permissão. Confira as regras do Firestore e o perfil do usuário.");
    }
  });
}

function mostrarTelaLogin() {
  document.getElementById("authScreen").classList.remove("hidden");
  document.getElementById("appShell").classList.add("hidden");
}

function mostrarSistema() {
  document.getElementById("authScreen").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");

  document.getElementById("userName").textContent = state.perfil.nome || state.currentUser.email;
  document.getElementById("userRole").textContent = ehAdmin() ? "Admin" : "Acesso personalizado";

  aplicarEstadoSidebar(sidebarEstaRecolhida());
  aplicarPermissoesTela();
  abrirPagina(getPrimeiraPaginaPermitida());
}

function limparListeners() {
  state.unsubscribers.forEach(unsub => {
    try {
      unsub();
    } catch (error) {
      console.warn(error);
    }
  });

  Object.values(state.listenersPorChave || {}).forEach(unsub => {
    try {
      if (typeof unsub === "function") unsub();
    } catch (error) {
      console.warn(error);
    }
  });

  state.unsubscribers = [];
  state.listenersPorChave = {};
  state.dadosCarregados = {};
  state.carregandoDados = {};
}

function registrarListenerChave(chave, unsubscribe) {
  if (!chave || typeof unsubscribe !== "function") return;

  if (state.listenersPorChave[chave]) {
    try {
      state.listenersPorChave[chave]();
    } catch (error) {
      console.warn(error);
    }
  }

  state.listenersPorChave[chave] = unsubscribe;
  state.unsubscribers.push(unsubscribe);
}

function marcarCarregado(chave) {
  state.dadosCarregados[chave] = true;
  state.carregandoDados[chave] = false;
}

function iniciarListenersFirestore() {
  iniciarDadosEssenciais();
}

function iniciarDadosEssenciais() {
  const produtosQuery = query(collection(db, "produtos"), orderBy("referencia", "asc"));
  const ordensQuery = query(collection(db, "ordensProducao"), orderBy("criadoEm", "desc"));

  registrarListenerChave("produtos", onSnapshot(produtosQuery, snapshot => {
    state.produtos = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    marcarCarregado("produtos");
    renderPaginaAtiva();
  }, error => {
    console.error(error);
    toast("Erro ao carregar produtos. Verifique as permissões.");
  }));

  registrarListenerChave("ordens", onSnapshot(ordensQuery, snapshot => {
    state.ordens = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).filter(op => op.excluida !== true);
    marcarCarregado("ordens");
    renderPaginaAtiva();
  }, error => {
    console.error(error);
    toast("Erro ao carregar ordens. Verifique as permissões.");
  }));

  // Dados pequenos/operacionais usados no Manejo para envio.
  carregarFaccoesSeNecessario();
  carregarCelulasSeNecessario();
}

function carregarFaccoesSeNecessario() {
  if (state.dadosCarregados.faccoes || state.carregandoDados.faccoes || state.listenersPorChave.faccoes) return;
  state.carregandoDados.faccoes = true;

  const faccoesQuery = query(collection(db, "faccoes"), orderBy("nome", "asc"));

  registrarListenerChave("faccoes", onSnapshot(faccoesQuery, snapshot => {
    state.faccoes = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    marcarCarregado("faccoes");
    renderFaccoes();
    renderFaccoesPendentes();
    renderFaccoesMovimentacoes();
    renderDatalistManejo();
    if (document.getElementById("pagamentos")?.classList.contains("active")) renderPagamentos();
  }, error => {
    state.carregandoDados.faccoes = false;
    console.error(error);
    toast("Erro ao carregar facções. Verifique as permissões.");
  }));
}

function carregarCelulasSeNecessario() {
  if (state.dadosCarregados.celulas || state.carregandoDados.celulas || state.listenersPorChave.celulas) return;
  state.carregandoDados.celulas = true;

  const celulasQuery = query(collection(db, "celulas"), orderBy("nome", "asc"));

  registrarListenerChave("celulas", onSnapshot(celulasQuery, snapshot => {
    state.celulas = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    marcarCarregado("celulas");
    renderCelulas();
    renderCelulasMovimentacoes();
    if (document.getElementById("rastreamento")?.classList.contains("active")) renderRastreamento();
  }, error => {
    state.carregandoDados.celulas = false;
    console.error(error);
    toast("Erro ao carregar células. Verifique as permissões.");
  }));
}

function carregarMovimentacoesSeNecessario() {
  if (state.dadosCarregados.movimentacoes || state.carregandoDados.movimentacoes || state.listenersPorChave.movimentacoes) return;
  state.carregandoDados.movimentacoes = true;

  const movimentacoesQuery = query(collection(db, "movimentacoesProducao"), orderBy("criadoEm", "desc"));

  registrarListenerChave("movimentacoes", onSnapshot(movimentacoesQuery, snapshot => {
    state.movimentacoesProducao = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    marcarCarregado("movimentacoes");
    renderRastreamento();
    renderFaccoesMovimentacoes();
    renderCelulasMovimentacoes();
    if (document.getElementById("pagamentos")?.classList.contains("active")) renderPagamentos();
  }, error => {
    state.carregandoDados.movimentacoes = false;
    console.error(error);
    toast("Erro ao carregar movimentações. Verifique as permissões.");
  }));
}

function carregarPrecosReferenciaSeNecessario() {
  if (state.dadosCarregados.precosReferencia || state.carregandoDados.precosReferencia || state.listenersPorChave.precosReferencia) return;
  state.carregandoDados.precosReferencia = true;

  const precosReferenciaQuery = query(collection(db, "precosReferencia"), orderBy("referencia", "asc"));

  registrarListenerChave("precosReferencia", onSnapshot(precosReferenciaQuery, snapshot => {
    state.precosReferencia = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    marcarCarregado("precosReferencia");
    preencherProcessosValores();
    renderProcessosValores();
    renderPrecosReferencia();

    if (document.getElementById("manejo")?.classList.contains("active")) renderManejoInline();
    if (document.getElementById("pagamentos")?.classList.contains("active")) renderPagamentos();
  }, error => {
    state.carregandoDados.precosReferencia = false;
    console.error(error);
    toast("Erro ao carregar tabela de preços. Verifique as permissões.");
  }));
}

function carregarEntregasPagamentoSeNecessario() {
  if (!podeAcessarTela("pagamentos")) return;
  if (state.dadosCarregados.entregasPagamento || state.carregandoDados.entregasPagamento || state.listenersPorChave.entregasPagamento) return;
  state.carregandoDados.entregasPagamento = true;

  const entregasPagamentoQuery = query(collection(db, "entregasPagamento"), orderBy("dataEntrega", "desc"));

  registrarListenerChave("entregasPagamento", onSnapshot(entregasPagamentoQuery, snapshot => {
    state.entregasPagamento = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    marcarCarregado("entregasPagamento");
    renderPagamentos();
  }, error => {
    state.carregandoDados.entregasPagamento = false;
    console.error(error);
    toast("Erro ao carregar entregas de pagamento. Verifique as permissões.");
  }));
}

function carregarUsuariosSeNecessario() {
  if (!ehAdmin()) return;
  if (state.dadosCarregados.usuarios || state.carregandoDados.usuarios || state.listenersPorChave.usuarios) return;
  state.carregandoDados.usuarios = true;

  const usuariosQuery = query(collection(db, "usuarios"), orderBy("nome", "asc"));

  registrarListenerChave("usuarios", onSnapshot(usuariosQuery, snapshot => {
    state.usuarios = snapshot.docs.map(item => ({ uid: item.id, ...item.data() }));
    marcarCarregado("usuarios");
    renderUsuarios();
  }, error => {
    state.carregandoDados.usuarios = false;
    console.error(error);
    toast("Erro ao carregar usuários.");
  }));
}

function carregarLogsSeNecessario() {
  if (!ehAdmin()) return;
  if (state.dadosCarregados.logs || state.carregandoDados.logs || state.listenersPorChave.logs) return;
  state.carregandoDados.logs = true;

  const logsQuery = query(collection(db, "logsAlteracoes"), orderBy("criadoEm", "desc"));

  registrarListenerChave("logs", onSnapshot(logsQuery, snapshot => {
    state.logs = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    marcarCarregado("logs");
    renderLogs();
  }, error => {
    state.carregandoDados.logs = false;
    console.error(error);
    toast("Erro ao carregar logs.");
  }));
}

function carregarDadosDaPagina(page) {
  if (page === "manejo") {
    carregarPrecosReferenciaSeNecessario();
    carregarFaccoesSeNecessario();
    carregarCelulasSeNecessario();
    // Não carregar movimentações aqui. O Manejo precisa filtrar e movimentar OPs,
    // mas não precisa ler o histórico inteiro. O histórico carrega apenas no Rastreamento,
    // Processos, Facções ou Células.
  }

  if (page === "processos" || page === "rastreamento") {
    carregarMovimentacoesSeNecessario();
    carregarFaccoesSeNecessario();
    carregarCelulasSeNecessario();
  }

  if (page === "faccoes") {
    carregarFaccoesSeNecessario();
    carregarMovimentacoesSeNecessario();
  }

  if (page === "celulas") {
    carregarCelulasSeNecessario();
    carregarMovimentacoesSeNecessario();
  }

  if (page === "pagamentos") {
    carregarEntregasPagamentoSeNecessario();
    carregarPrecosReferenciaSeNecessario();
    carregarFaccoesSeNecessario();
  }

  if (page === "usuarios") {
    carregarUsuariosSeNecessario();
  }

  if (page === "logs") {
    carregarLogsSeNecessario();
  }

  if (page === "relatorios") {
    // Relatórios só usam o que já estiver carregado. Consultas maiores devem ser feitas por filtro/período em versões futuras.
  }
}


function aplicarPermissoesTela() {
  const admin = ehAdmin();

  document.querySelectorAll(".nav-btn").forEach(btn => {
    const page = btn.dataset.page;
    btn.classList.toggle("hidden", !podeAcessarTela(page));
  });

  document.querySelectorAll(".admin-only-block, .admin-only-cell").forEach(el => {
    el.classList.toggle("hidden", !admin);
  });

  const btnValores = document.getElementById("btnToggleGerenciarValores");
  if (btnValores) btnValores.classList.toggle("hidden", !podeUsarRecurso("gerenciarValores"));

  const painelValores = document.getElementById("painelGerenciarValores");
  if (painelValores && !podeUsarRecurso("gerenciarValores")) {
    painelValores.classList.add("hidden");
  }

  const btnMarcarPagos = document.getElementById("btnMarcarPagamentosFiltrados");
  if (btnMarcarPagos) btnMarcarPagos.classList.toggle("hidden", !podeUsarRecurso("marcarPagamentos"));

  const btnGerenciarFaccoes = document.getElementById("btnToggleGerenciarFaccoes");
  if (btnGerenciarFaccoes) btnGerenciarFaccoes.classList.toggle("hidden", !podeUsarRecurso("gerenciarFaccoes"));

  const painelFaccoes = document.getElementById("painelGerenciarFaccoes");
  if (painelFaccoes && !podeUsarRecurso("gerenciarFaccoes")) {
    painelFaccoes.classList.add("hidden");
  }

  const btnGerenciarCelulas = document.getElementById("btnToggleGerenciarCelulas");
  if (btnGerenciarCelulas) btnGerenciarCelulas.classList.toggle("hidden", !podeUsarRecurso("gerenciarCelulas"));

  const painelCelulas = document.getElementById("painelGerenciarCelulas");
  if (painelCelulas && !podeUsarRecurso("gerenciarCelulas")) {
    painelCelulas.classList.add("hidden");
  }

  atualizarBotoesManejoSetor();

  const paginaAtiva = document.querySelector(".page.active")?.id;

  if (paginaAtiva && !podeAcessarTela(paginaAtiva)) {
    abrirPagina(getPrimeiraPaginaPermitida());
  }
}

function ehAdmin() {
  return state.perfil?.tipo === "admin";
}

function configurarNavegacao() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!podeAcessarTela(btn.dataset.page)) {
        toast("Seu usuário não tem acesso a esta tela.");
        return;
      }

      abrirPagina(btn.dataset.page);
    });
  });
}

function abrirPagina(page) {
  if (!podeAcessarTela(page)) {
    toast("Seu usuário não tem acesso a esta tela.");
    page = getPrimeiraPaginaPermitida();
  }

  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));

  document.querySelector(`.nav-btn[data-page="${page}"]`)?.classList.add("active");
  document.getElementById(page)?.classList.add("active");

  if (pageInfo[page]) {
    document.getElementById("pageTitle").textContent = pageInfo[page].title;
    document.getElementById("pageSubtitle").textContent = pageInfo[page].subtitle;
  }

  carregarDadosDaPagina(page);

  if (page === "produtos") {
    renderProdutos();
    renderProdutosPendentes();
  }
  if (page === "ordens") renderOrdens();
  if (page === "manejo") {
    atualizarBotoesManejoSetor();
    atualizarManejoComSoma();
  }
  if (page === "processos") renderProcessos();
  if (page === "faccoes") renderFaccoesMovimentacoes();
  if (page === "celulas") renderCelulasMovimentacoes();
  if (page === "rastreamento") renderRastreamento();
  if (page === "pagamentos") renderPagamentos();
  if (page === "relatorios") renderRelatorio();
  if (page === "usuarios") renderUsuarios();
  if (page === "logs") renderLogs();
}

function configurarProduto() {
  const form = document.getElementById("formProduto");

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!ehAdmin()) {
      toast("Apenas admin pode salvar produtos.");
      return;
    }

    const produtoIdAtual = document.getElementById("produtoId").value;
    const referencia = normalizarReferencia(document.getElementById("produtoReferencia").value);
    const nome = document.getElementById("produtoNome").value.trim();

    if (!referencia || !nome) {
      toast("Preencha referência e nome do produto.");
      return;
    }

    const produto = {
      referencia,
      nome,
      possuiAlca: document.getElementById("produtoAlca").checked,
      possuiBojo: document.getElementById("produtoBojo").checked,
      possuiRenda: document.getElementById("produtoRenda").checked,
      observacoes: document.getElementById("produtoObs").value.trim(),
      cadastroPendente: false,
      statusCadastro: "conferido",
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    };

    if (!produtoIdAtual) {
      produto.criadoPor = state.currentUser.uid;
      produto.criadoEm = serverTimestamp();
    }

    try {
      const docId = produtoIdAtual || docIdSeguro(referencia);
      await setDoc(doc(db, "produtos", docId), produto, { merge: true });
      const ordensAtualizadas = await atualizarOrdensDaReferencia(produto);
      await registrarLog(
        produtoIdAtual ? "produto_atualizado" : "produto_criado",
        "produto",
        docId,
        `Referência ${referencia} - ${nome}. Ordens atualizadas: ${ordensAtualizadas}`
      );

      limparFormProduto();
      toast("Produto salvo no Firebase.");
      restaurarOrdemPendenteSePossivel({ id: docId, ...produto });
    } catch (error) {
      console.error(error);
      toast("Erro ao salvar produto.");
    }
  });

  document.getElementById("buscaProduto").addEventListener("input", renderProdutos);
  document.getElementById("btnCancelarProduto").addEventListener("click", limparFormProduto);
}

function limparFormProduto() {
  document.getElementById("produtoId").value = "";
  document.getElementById("produtoReferencia").value = "";
  document.getElementById("produtoNome").value = "";
  document.getElementById("produtoAlca").checked = false;
  document.getElementById("produtoBojo").checked = false;
  document.getElementById("produtoRenda").checked = false;
  document.getElementById("produtoObs").value = "";
}

function editarProduto(id) {
  if (!ehAdmin()) {
    toast("Apenas admin pode editar produtos.");
    return;
  }

  const produto = state.produtos.find(p => p.id === id);
  if (!produto) return;

  document.getElementById("produtoId").value = produto.id;
  document.getElementById("produtoReferencia").value = produto.referencia;
  document.getElementById("produtoNome").value = produto.nome;
  document.getElementById("produtoAlca").checked = Boolean(produto.possuiAlca);
  document.getElementById("produtoBojo").checked = Boolean(produto.possuiBojo);
  document.getElementById("produtoRenda").checked = Boolean(produto.possuiRenda);
  document.getElementById("produtoObs").value = produto.observacoes || "";

  abrirPagina("produtos");
}

async function excluirProduto(id) {
  if (!ehAdmin()) {
    toast("Apenas admin pode excluir produtos.");
    return;
  }

  const produto = state.produtos.find(p => p.id === id);
  if (!produto) return;

  const possuiOP = state.ordens.some(op => op.referencia === produto.referencia);
  const mensagem = possuiOP
    ? "Essa referência já possui ordens cadastradas. Excluir mesmo assim?"
    : "Deseja excluir este produto?";

  if (!confirm(mensagem)) return;

  try {
    await deleteDoc(doc(db, "produtos", id));
    await registrarLog("produto_excluido", "produto", id, `Referência ${produto.referencia} - ${produto.nome}`);
    toast("Produto excluído.");
  } catch (error) {
    console.error(error);
    toast("Erro ao excluir produto.");
  }
}


function montarTextoNecessidade(inicio, fim) {
  if (!inicio || !fim) return "";
  return `${dataISOParaBR(inicio)} a ${dataISOParaBR(fim)}`;
}

function normalizarNecessidadeOrdem(valor) {
  return String(valor || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function dataBRCurtaParaISO(valor, anoPadrao = new Date().getFullYear()) {
  const texto = String(valor || "").trim();
  let match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const dia = String(match[1]).padStart(2, "0");
    const mes = String(match[2]).padStart(2, "0");
    let ano = String(match[3]);
    if (ano.length === 2) ano = `20${ano}`;
    return `${ano}-${mes}-${dia}`;
  }

  match = texto.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (match) {
    const dia = String(match[1]).padStart(2, "0");
    const mes = String(match[2]).padStart(2, "0");
    return `${anoPadrao}-${mes}-${dia}`;
  }

  return "";
}

function extrairPeriodoNecessidade(texto) {
  const necessidade = normalizarNecessidadeOrdem(texto);
  if (!necessidade) return { inicio: "", fim: "" };

  const anoPadrao = new Date().getFullYear();
  const partes = necessidade
    .split(/\s+(?:A|ATÉ|ATE)\s+|[-–—]/i)
    .map(parte => parte.trim())
    .filter(Boolean);

  const inicio = dataBRCurtaParaISO(partes[0], anoPadrao);
  const fim = dataBRCurtaParaISO(partes[1] || partes[0], anoPadrao);

  return { inicio, fim };
}


function configurarOrdem() {
  const form = document.getElementById("formOrdem");

  document.getElementById("ordemReferencia").addEventListener("input", mostrarPreviewProduto);

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const id = document.getElementById("ordemId").value;
    const numeroOPDigitado = normalizarNumeroOP(document.getElementById("ordemNumero")?.value || "");
    const referencia = normalizarReferencia(document.getElementById("ordemReferencia").value);
    const produto = state.produtos.find(p => p.referencia === referencia);

    if (!numeroOPDigitado) {
      toast("Digite o número da OP antes de salvar.");
      document.getElementById("ordemNumero")?.focus();
      return;
    }

    const docIdDigitado = docIdSeguro(numeroOPDigitado);
    const opDuplicada = state.ordens.find(op => {
      const mesmoId = String(op.id || "") === String(docIdDigitado);
      const mesmoNumero = normalizarNumeroOP(op.numeroOP || "") === numeroOPDigitado;
      return (mesmoId || mesmoNumero) && String(op.id || "") !== String(id || "");
    });

    if (opDuplicada) {
      toast(`A OP ${numeroOPDigitado} já existe no sistema. Use o rastreamento ou edite a OP existente.`);
      return;
    }

    if (!produto) {
      const cadastrarAgora = confirm(`A referência ${referencia || "(vazia)"} ainda não está cadastrada. Deseja cadastrar esse produto agora?`);

      if (cadastrarAgora) {
        if (!ehAdmin()) {
          toast("Apenas admin pode cadastrar nova referência.");
          return;
        }

        iniciarCadastroProdutoPelaOrdem(referencia);
      } else {
        toast("Cadastre a referência antes de salvar a OP.");
      }

      return;
    }

    const cor = normalizarCor(document.getElementById("ordemCor").value);
    const quantidade = Number(document.getElementById("ordemQuantidade").value);
    const necessidade = normalizarNecessidadeOrdem(document.getElementById("ordemNecessidadeTexto")?.value || "");
    const periodoNecessidade = extrairPeriodoNecessidade(necessidade);
    const necessidadeInicio = periodoNecessidade.inicio;
    const necessidadeFim = periodoNecessidade.fim;
    const semana = "";
    const mes = necessidadeInicio ? nomeMesPorDataISO(necessidadeInicio) : "";
    const ano = necessidadeInicio ? anoPorDataISO(necessidadeInicio) : new Date().getFullYear();

    if (!cor) {
      toast("Informe a cor da OP.");
      return;
    }

    if (!quantidade || quantidade <= 0) {
      toast("Informe uma quantidade válida.");
      return;
    }

    if (!necessidade) {
      toast("Informe a necessidade da OP. Ex: URGENTE, 24/07 ou 24/07 a 30/07.");
      document.getElementById("ordemNecessidadeTexto")?.focus();
      return;
    }

    if (necessidadeInicio && necessidadeFim && necessidadeInicio > necessidadeFim) {
      toast("Confira a necessidade: a data inicial não pode ser maior que a final.");
      return;
    }

    try {
      if (id) {
        const opAntiga = state.ordens.find(op => op.id === id);
        const ordemAtualizada = montarDadosOrdem({
          numeroOP: opAntiga?.numeroOP || numeroOPDigitado || id,
          produto,
          referencia,
          cor,
          quantidade,
          semana,
          mes,
          ano,
          necessidadeInicio,
          necessidadeFim,
          necessidade,
          observacoes: document.getElementById("ordemObs").value.trim(),
          criada: false
        });

        await setDoc(doc(db, "ordensProducao", id), ordemAtualizada, { merge: true });
        await registrarLog("ordem_atualizada", "ordemProducao", id, `${ordemAtualizada.numeroOP} | Ref. ${referencia} | Cor ${cor} | Qtd. ${quantidade}`);
        toast("OP atualizada.");
      } else {
        const numeroOP = numeroOPDigitado;
        const ordemNova = montarDadosOrdem({
          numeroOP,
          produto,
          referencia,
          cor,
          quantidade,
          semana,
          mes,
          ano,
          necessidadeInicio,
          necessidadeFim,
          necessidade,
          observacoes: document.getElementById("ordemObs").value.trim(),
          criada: true
        });

        const ordemDocId = docIdSeguro(numeroOP);
        await setDoc(doc(db, "ordensProducao", ordemDocId), ordemNova);
        await registrarLog("ordem_criada", "ordemProducao", ordemDocId, `${numeroOP} | Ref. ${referencia} | Cor ${cor} | Qtd. ${quantidade}`);
        toast("OP cadastrada.");
      }

      limparFormOrdem();
    } catch (error) {
      console.error(error);
      toast("Erro ao salvar OP.");
    }
  });

  document.getElementById("buscaOrdem").addEventListener("input", renderOrdens);
  document.getElementById("btnCancelarOrdem").addEventListener("click", limparFormOrdem);
}

function montarDadosOrdem({ numeroOP, produto, referencia, cor, quantidade, semana, mes, ano, necessidadeInicio, necessidadeFim, necessidade, observacoes, criada }) {
  const dados = {
    numeroOP,
    referencia,
    cor,
    produtoNome: produto.nome,
    semana,
    mes,
    ano,
    necessidadeInicio,
    necessidadeFim,
    necessidade,
    necessidadeTexto: necessidade,
    necessidadeManual: true,
    quantidade,
    possuiAlca: Boolean(produto.possuiAlca),
    possuiBojo: Boolean(produto.possuiBojo),
    possuiRenda: Boolean(produto.possuiRenda),
    observacoes,
    atualizadoPor: state.currentUser.uid,
    atualizadoEm: serverTimestamp()
  };

  if (criada) {
    dados.status = "aberta";
    dados.criadoPor = state.currentUser.uid;
    dados.criadoEm = serverTimestamp();
  }

  return dados;
}

async function gerarNumeroOPFirebase(ano) {
  const configRef = doc(db, "configuracoes", "sistema");

  return await runTransaction(db, async transaction => {
    const snap = await transaction.get(configRef);
    const atual = snap.exists() ? Number(snap.data().ultimoNumeroOP || 0) : 0;
    const proximo = atual + 1;

    transaction.set(configRef, {
      ultimoNumeroOP: proximo,
      anoAtual: ano,
      nomeSistema: "Sistema OP Confecção",
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    return `OP-${ano}-${String(proximo).padStart(4, "0")}`;
  });
}

function mostrarPreviewProduto() {
  const referencia = normalizarReferencia(document.getElementById("ordemReferencia").value);
  const produto = state.produtos.find(p => p.referencia === referencia);
  const preview = document.getElementById("produtoPreview");

  if (!referencia) {
    preview.classList.add("hidden");
    preview.classList.remove("warning");
    preview.innerHTML = "";
    return;
  }

  if (!produto) {
    preview.classList.remove("hidden");
    preview.classList.add("warning");

    const botaoCadastro = ehAdmin()
      ? `<div class="preview-actions">
          <button type="button" class="btn btn-sm btn-primary" onclick="iniciarCadastroProdutoPelaOrdem('${encodeURIComponent(referencia)}')">
            Cadastrar essa referência
          </button>
        </div>`
      : `<br><strong>Peça para um admin cadastrar essa referência.</strong>`;

    preview.innerHTML = `
      <strong>Referência não cadastrada:</strong> ${escapeHtml(referencia)}<br>
      Para salvar essa OP, o produto precisa estar cadastrado.
      ${botaoCadastro}
    `;
    return;
  }

  preview.classList.remove("hidden");
  preview.classList.remove("warning");
  preview.innerHTML = `
    <strong>Produto encontrado:</strong><br>
    Referência: ${escapeHtml(produto.referencia)}<br>
    Produto: ${escapeHtml(produto.nome)}<br>
    Alça: ${produto.possuiAlca ? "Sim" : "Não"} |
    Bojo: ${produto.possuiBojo ? "Sim" : "Não"} |
    Renda: ${produto.possuiRenda ? "Sim" : "Não"}
  `;
}

function capturarOrdemPendente(referencia) {
  const necessidade = normalizarNecessidadeOrdem(document.getElementById("ordemNecessidadeTexto")?.value || "");

  return {
    numeroOP: normalizarNumeroOP(document.getElementById("ordemNumero")?.value || ""),
    referencia: normalizarReferencia(referencia),
    cor: normalizarCor(document.getElementById("ordemCor").value),
    quantidade: document.getElementById("ordemQuantidade").value,
    necessidade,
    observacoes: document.getElementById("ordemObs").value
  };
}

function iniciarCadastroProdutoPelaOrdem(referenciaEncoded) {
  if (!ehAdmin()) {
    toast("Apenas admin pode cadastrar referência.");
    return;
  }

  const referencia = normalizarReferencia(decodeURIComponent(referenciaEncoded));
  if (!referencia) {
    toast("Digite a referência primeiro.");
    return;
  }

  sessionStorage.setItem("op_confeccao_ordem_pendente", JSON.stringify(capturarOrdemPendente(referencia)));

  limparFormProduto();
  abrirPagina("produtos");

  document.getElementById("produtoReferencia").value = referencia;
  document.getElementById("produtoNome").focus();

  toast("Cadastre essa referência. Depois o sistema volta para a OP.");
}

function restaurarOrdemPendenteSePossivel(produtoCadastrado) {
  const raw = sessionStorage.getItem("op_confeccao_ordem_pendente");
  if (!raw) return false;

  try {
    const pendente = JSON.parse(raw);

    if (normalizarReferencia(pendente.referencia) !== produtoCadastrado.referencia) {
      return false;
    }

    sessionStorage.removeItem("op_confeccao_ordem_pendente");
    abrirPagina("ordens");

    document.getElementById("ordemNumero").value = pendente.numeroOP || "";
    document.getElementById("ordemNumero").readOnly = false;
    document.getElementById("ordemReferencia").value = produtoCadastrado.referencia;
    document.getElementById("ordemCor").value = pendente.cor || "";
    document.getElementById("ordemQuantidade").value = pendente.quantidade || "";
    document.getElementById("ordemNecessidadeTexto").value = pendente.necessidade || "";
    document.getElementById("ordemObs").value = pendente.observacoes || "";

    mostrarPreviewProduto();

    toast("Produto cadastrado. Confira os dados e salve a OP.");
    return true;
  } catch (error) {
    sessionStorage.removeItem("op_confeccao_ordem_pendente");
    return false;
  }
}

function limparFormOrdem() {
  document.getElementById("ordemId").value = "";
  document.getElementById("ordemNumero").value = "";
  document.getElementById("ordemNumero").readOnly = false;
  document.getElementById("ordemReferencia").value = "";
  document.getElementById("ordemCor").value = "";
  document.getElementById("ordemQuantidade").value = "";
  document.getElementById("ordemNecessidadeTexto").value = "";
  document.getElementById("ordemObs").value = "";
  document.getElementById("produtoPreview").classList.add("hidden");
}

function editarOrdem(id) {
  const ordem = state.ordens.find(op => op.id === id);
  if (!ordem) return;

  document.getElementById("ordemId").value = ordem.id;
  document.getElementById("ordemNumero").value = ordem.numeroOP || ordem.id || "";
  document.getElementById("ordemNumero").readOnly = true;
  document.getElementById("ordemReferencia").value = ordem.referencia;
  document.getElementById("ordemCor").value = ordem.cor || "";
  document.getElementById("ordemQuantidade").value = ordem.quantidade;
  document.getElementById("ordemNecessidadeTexto").value = getNecessidadeDaOrdem(ordem) || "";
  document.getElementById("ordemObs").value = ordem.observacoes || "";

  mostrarPreviewProduto();
  abrirPagina("ordens");
}

async function excluirOrdem(id) {
  if (!ehAdmin()) {
    toast("Apenas admin pode excluir OP.");
    return;
  }

  const ordem = state.ordens.find(op => op.id === id);
  if (!ordem) {
    toast("OP não encontrada.");
    return;
  }

  const confirmar = confirm(`Excluir a OP ${ordem.numeroOP || id} do uso normal?\n\nPor segurança, o sistema vai ocultar a OP e manter histórico/movimentações no Firebase.`);
  if (!confirmar) return;

  try {
    await setDoc(doc(db, "ordensProducao", id), {
      excluida: true,
      ocultarDoManejo: true,
      status: "excluida",
      excluidaPor: state.currentUser.uid,
      excluidaEm: serverTimestamp(),
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    await registrarLog("ordem_excluida_segura", "ordemProducao", id, `${ordem.numeroOP || id} | Ref. ${ordem.referencia || "-"} | Cor ${ordem.cor || "-"}`);
    toast("OP excluída do uso normal com segurança. O histórico foi preservado.");
  } catch (error) {
    console.error(error);
    toast("Erro ao excluir OP.");
  }
}






const TELAS_PERMISSAO = {
  produtos: "Produtos / Referências",
  ordens: "Ordens de Produção",
  manejo: "Manejo",
  processos: "Processos",
  faccoes: "Facções",
  celulas: "Células",
  rastreamento: "Rastreamento",
  pagamentos: "Pagamentos",
  relatorios: "Relatórios"
};

const PAGINAS_SOMENTE_ADMIN = ["usuarios", "logs", "backup"];

const MANEJOS_PERMISSAO = {
  sutia: "Manejo Sutiã",
  calcinha: "Manejo Calcinha"
};

const RECURSOS_PERMISSAO = {
  gerenciarValores: "Gerenciar valores",
  marcarPagamentos: "Marcar pagamentos como pagos",
  gerenciarFaccoes: "Gerenciar facções",
  gerenciarCelulas: "Gerenciar células"
};

function getPermissoesPadrao(tipo = "usuario") {
  if (tipo === "admin") {
    return {
      telas: Object.fromEntries(Object.keys(TELAS_PERMISSAO).map(chave => [chave, true])),
      manejo: Object.fromEntries(Object.keys(MANEJOS_PERMISSAO).map(chave => [chave, true])),
      recursos: Object.fromEntries(Object.keys(RECURSOS_PERMISSAO).map(chave => [chave, true]))
    };
  }

  return {
    telas: {
      produtos: true,
      ordens: true,
      manejo: true,
      processos: true,
      faccoes: false,
      celulas: false,
      rastreamento: true,
      pagamentos: false,
      relatorios: true
    },
    manejo: {
      sutia: true,
      calcinha: true
    },
    recursos: {
      gerenciarValores: false,
      marcarPagamentos: false,
      gerenciarFaccoes: false,
      gerenciarCelulas: false
    }
  };
}

function getPermissoesUsuario(usuario = state.perfil) {
  const base = getPermissoesPadrao(usuario?.tipo || "usuario");

  if (usuario?.tipo === "admin") {
    return base;
  }

  const salvas = usuario?.permissoes || {};

  return {
    telas: {
      ...base.telas,
      ...(salvas.telas || {})
    },
    manejo: {
      ...base.manejo,
      ...(salvas.manejo || {})
    },
    recursos: {
      ...base.recursos,
      ...(salvas.recursos || {})
    }
  };
}

function podeAcessarTela(page, usuario = state.perfil) {
  if (!page) return false;
  if (usuario?.tipo === "admin") return true;
  if (PAGINAS_SOMENTE_ADMIN.includes(page)) return false;
  const permissoes = getPermissoesUsuario(usuario);
  return Boolean(permissoes.telas?.[page]);
}

function podeUsarRecurso(recurso, usuario = state.perfil) {
  if (usuario?.tipo === "admin") return true;

  const permissoes = getPermissoesUsuario(usuario);
  return Boolean(permissoes.recursos?.[recurso]);
}

function podeVerManejo(tipo, usuario = state.perfil) {
  if (usuario?.tipo === "admin") return true;

  const permissoes = getPermissoesUsuario(usuario);
  return Boolean(permissoes.telas?.manejo && permissoes.manejo?.[tipo]);
}

function getManejosPermitidos(usuario = state.perfil) {
  return Object.keys(MANEJOS_PERMISSAO).filter(tipo => podeVerManejo(tipo, usuario));
}

function getPrimeiraPaginaPermitida(usuario = state.perfil) {
  const ordem = ["manejo", "processos", "rastreamento", "pagamentos", "faccoes", "celulas", "produtos", "ordens", "relatorios"];

  return ordem.find(page => podeAcessarTela(page, usuario)) || "manejo";
}

function resumoPermissoesUsuario(usuario) {
  if (usuario?.tipo === "admin") return "Acesso total";

  const permissoes = getPermissoesUsuario(usuario);
  const telas = Object.entries(permissoes.telas || {})
    .filter(([, permitido]) => permitido)
    .map(([chave]) => TELAS_PERMISSAO[chave])
    .filter(Boolean);

  const manejos = Object.entries(permissoes.manejo || {})
    .filter(([, permitido]) => permitido)
    .map(([chave]) => MANEJOS_PERMISSAO[chave])
    .filter(Boolean);

  return [...telas.slice(0, 4), ...manejos].join(", ") || "Sem acesso definido";
}

const manejoSetoresInfo = {
  sutia: {
    label: "Sutiã",
    tipoPeca: "sutia",
    descricao: "Mostrando OPs de sutiã importadas do PDF. A separação vem automaticamente da importação."
  },
  calcinha: {
    label: "Calcinha",
    tipoPeca: "calcinha",
    descricao: "Mostrando OPs de calcinha importadas do PDF. A separação vem automaticamente da importação."
  }
};

function getTipoPecaManejoOP(op) {
  const texto = normalizarTexto([
    op?.tipoPeca,
    op?.tipoPecaLabel,
    op?.produtoNome,
    op?.observacoes,
    op?.pendencia
  ].join(" "));

  if (texto.includes("calcinha")) return "calcinha";
  if (texto.includes("sutia")) return "sutia";

  // Fallback para OPs antigas/importações antigas: se possuía bojo/alça/renda, normalmente é sutiã.
  if (op?.possuiBojo || op?.possuiAlca || op?.possuiRenda) return "sutia";

  return "sutia";
}

function getManejoSetorAtual() {
  return state.manejoSetorAtual || "sutia";
}

function getInfoManejoSetor(setor = getManejoSetorAtual()) {
  return manejoSetoresInfo[setor] || manejoSetoresInfo.sutia;
}

function ordemPertenceAoSetorManejo(op, setor = getManejoSetorAtual()) {
  const info = getInfoManejoSetor(setor);
  return getTipoPecaManejoOP(op) === info.tipoPeca;
}

function getOrdensDoSetorManejo(setor = getManejoSetorAtual()) {
  if (!podeVerManejo(setor)) return [];
  return [...state.ordens].filter(op => !op.ocultarDoManejo && ordemPertenceAoSetorManejo(op, setor));
}

function atualizarBotoesManejoSetor() {
  const permitidos = getManejosPermitidos();
  let setorAtual = getManejoSetorAtual();

  if (!permitidos.includes(setorAtual)) {
    setorAtual = permitidos[0] || "sutia";
    state.manejoSetorAtual = setorAtual;
  }

  document.querySelectorAll(".manejo-setor-btn").forEach(btn => {
    const permitido = podeVerManejo(btn.dataset.setor);
    btn.classList.toggle("hidden", !permitido);
    btn.classList.toggle("active", permitido && btn.dataset.setor === setorAtual);
  });

  const setText = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
  };

  setText("contadorManejoSutia", getOrdensDoSetorManejo("sutia").length);
  setText("contadorManejoCalcinha", getOrdensDoSetorManejo("calcinha").length);

  const info = document.getElementById("manejoSetorInfo");
  if (info) info.textContent = getInfoManejoSetor(setorAtual).descricao;

  const tabelaManejo = document.querySelector("#manejo .manejo-inline-table");
  if (tabelaManejo) tabelaManejo.classList.toggle("manejo-sutia-ativo", setorAtual === "sutia");
  const cabecalhoFase = tabelaManejo?.querySelector(".manejo-head-row th:nth-child(5)");
  if (cabecalhoFase) cabecalhoFase.textContent = setorAtual === "sutia" ? "FASE BOJO" : "FASE";
}

function selecionarManejoSetor(setor) {
  if (!manejoSetoresInfo[setor]) return;

  if (!podeVerManejo(setor)) {
    toast("Seu usuário não tem acesso a este manejo.");
    return;
  }

  state.manejoSetorAtual = setor;
  limparFiltrosColunasManejo();
  atualizarBotoesManejoSetor();
  renderFiltrosColunasManejo();
  atualizarManejoComSoma();
}

function montarPatchManejoSetor(setor, manejo, status, extras = {}) {
  if (setor === "bojo") {
    return {
      manejo,
      manejoStatus: status,
      ...extras
    };
  }

  return {
    manejosSetores: {
      [setor]: manejo
    },
    manejoStatusSetores: {
      [setor]: status
    },
    bipadoSetores: {
      [setor]: status === "bipado"
    },
    ...extras
  };
}


let timerAtualizacaoManejo = null;

function atualizarManejoComSoma() {
  if (timerAtualizacaoManejo) {
    clearTimeout(timerAtualizacaoManejo);
    timerAtualizacaoManejo = null;
  }

  renderManejoInline();
  setTimeout(renderResumoSomasManejoPeloDOM, 0);
}

function agendarAtualizacaoManejoComSoma(delay = 260) {
  if (timerAtualizacaoManejo) clearTimeout(timerAtualizacaoManejo);

  timerAtualizacaoManejo = setTimeout(() => {
    timerAtualizacaoManejo = null;
    renderManejoInline();
    setTimeout(renderResumoSomasManejoPeloDOM, 0);
  }, delay);
}

function configurarManejo() {
  document.querySelectorAll(".manejo-setor-btn").forEach(btn => {
    btn.addEventListener("click", () => selecionarManejoSetor(btn.dataset.setor));
  });

  const busca = document.getElementById("buscaManejoLinha");
  if (busca) {
    busca.addEventListener("input", () => agendarAtualizacaoManejoComSoma(220));
  }

  [
    "filtroManejoStatus",
    "filtroManejoOP",
    "filtroManejoReferencia",
    "filtroManejoSilk",
    "filtroManejoDataTecido",
    "filtroManejoFase",
    "filtroManejoFaseLateral",
    "filtroManejoQuantidade",
    "filtroManejoCor",
    "filtroManejoFaccao",
    "filtroManejoChegada",
    "filtroManejoFalta",
    "filtroManejoCelu",
    "filtroManejoNecessidade",
    "filtroManejoOrdenacao"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      resetarLimitesRenderTabelaPrefixo("manejo");
      agendarAtualizacaoManejoComSoma(id === "filtroManejoOP" ? 180 : 260);
    });
    el.addEventListener("change", () => {
      resetarLimitesRenderTabelaPrefixo("manejo");
      atualizarManejoComSoma();
    });
  });

  const limpar = document.getElementById("btnLimparFiltrosManejo");
  if (limpar) {
    limpar.addEventListener("click", () => {
      limparFiltrosColunasManejo();
      resetarLimitesRenderTabelaPrefixo("manejo");
      atualizarManejoComSoma();
    });
  }

  const toggleSoma = document.getElementById("btnToggleSomaManejo");
  if (toggleSoma) {
    toggleSoma.addEventListener("click", () => {
      const painel = document.getElementById("painelSomaManejo");
      if (painel) painel.classList.toggle("hidden");
    });
  }

  const imprimir = document.getElementById("btnImprimirManejoFiltrado");
  if (imprimir) {
    imprimir.addEventListener("click", imprimirManejoFiltrado);
  }
}


function valorManejoParaImpressao(op, campo) {
  const setor = getManejoSetorAtual();
  const valorTela = valorLinhaManejo(op, campo);
  if (valorTela !== "") return valorTela;

  const manejo = getManejoDaOrdem(op, setor);
  return manejo?.[campo] ?? "";
}

function getLinhasManejoParaImpressao() {
  return filtrarOrdensManejoPorColunas().map(op => {
    const setor = getManejoSetorAtual();
    const manejo = getManejoDaOrdem(op, setor);

    return {
      numeroOP: op.numeroOP || "",
      referencia: op.referencia || "",
      silkNome: valorManejoParaImpressao(op, "silkNome") || getSilkNomeManejo(manejo),
      silkData: valorManejoParaImpressao(op, "silkData"),
      tecidoNome: valorManejoParaImpressao(op, "tecidoNome"),
      dataTecido: valorManejoParaImpressao(op, "dataTecido"),
      fase: valorManejoParaImpressao(op, "fase"),
      quantidade: numeroQuantidadeOP(op),
      cor: op.cor || "",
      faccao: valorManejoParaImpressao(op, "faccao"),
      chegada: valorManejoParaImpressao(op, "chegada"),
      falta: Number(valorManejoParaImpressao(op, "falta") || 0),
      celu: valorManejoParaImpressao(op, "celu"),
      necessidade: getNecessidadeDaOrdem(op),
      status: getStatusManejo(op, setor) === "bipado" ? "Bipado" : getStatusManejo(op, setor) === "organizada" ? "Organizada" : "Pendente"
    };
  });
}

function imprimirManejoFiltrado() {
  const linhas = getLinhasManejoParaImpressao();

  if (!linhas.length) {
    toast("Nenhum item filtrado para imprimir.");
    return;
  }

  const totalPecas = linhas.reduce((soma, item) => soma + Number(item.quantidade || 0), 0);
  const totalFalta = linhas.reduce((soma, item) => soma + Number(item.falta || 0), 0);
  const filtroAtivo = getFiltrosManejoAtivosTexto();
  const dataImpressao = new Date().toLocaleString("pt-BR");

  const linhasTabela = linhas.map(item => `
    <tr>
      <td>${escapeHtml(item.numeroOP)}</td>
      <td>${escapeHtml(item.referencia)}</td>
      <td>${escapeHtml(item.silkNome || "-")}</td>
      <td>${escapeHtml(formatarDataSimples(item.silkData))}</td>
      <td>${escapeHtml(formatarDataSimples(item.dataTecido))}</td>
      <td>${escapeHtml(item.fase || "-")}</td>
      <td class="num">${escapeHtml(item.quantidade)}</td>
      <td>${escapeHtml(item.cor || "-")}</td>
      <td>${escapeHtml(formatarDataSimples(item.data))}</td>
      <td>${escapeHtml(item.faccao || "-")}</td>
      <td>${escapeHtml(formatarDataSimples(item.chegada))}</td>
      <td class="num">${escapeHtml(item.falta || 0)}</td>
      <td>${escapeHtml(formatarDataSimples(item.producao))}</td>
      <td>${escapeHtml(item.celu || "-")}</td>
      <td>${escapeHtml(item.necessidade || "-")}</td>
      <td>${escapeHtml(item.status)}</td>
    </tr>
  `).join("");

  const htmlImpressao = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Impressão Manejo</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            color: #0f172a;
            margin: 18px;
            font-size: 11px;
          }
          .print-header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 10px;
            margin-bottom: 12px;
          }
          h1 {
            margin: 0 0 4px;
            font-size: 20px;
          }
          .muted {
            color: #475569;
            font-size: 11px;
          }
          .summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin: 12px 0;
          }
          .summary div {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 8px;
          }
          .summary span {
            display: block;
            color: #475569;
            font-size: 10px;
          }
          .summary strong {
            display: block;
            font-size: 15px;
            margin-top: 3px;
          }
          .filter-box {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 8px;
            margin-bottom: 12px;
            background: #f8fafc;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 5px 4px;
            vertical-align: top;
          }
          th {
            background: #eef2ff;
            font-size: 10px;
            text-align: left;
          }
          td.num {
            text-align: right;
            font-weight: bold;
          }
          tr:nth-child(even) td {
            background: #f8fafc;
          }
          @page {
            size: landscape;
            margin: 10mm;
          }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div>
            <h1>Manejo - Itens filtrados</h1>
            <div class="muted">Sistema OP Confecção</div>
          </div>
          <div class="muted">
            Impresso em:<br><strong>${escapeHtml(dataImpressao)}</strong>
          </div>
        </div>

        <div class="filter-box">
          <strong>${escapeHtml(filtroAtivo)}</strong>
        </div>

        <div class="summary">
          <div><span>OPs</span><strong>${linhas.length.toLocaleString("pt-BR")}</strong></div>
          <div><span>Total de peças</span><strong>${totalPecas.toLocaleString("pt-BR")}</strong></div>
          <div><span>Total em falta</span><strong>${totalFalta.toLocaleString("pt-BR")}</strong></div>
          <div><span>Status</span><strong>${escapeHtml(document.getElementById("somaManejoStatus")?.textContent || "-")}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>OP</th>
              <th>REF</th>
              <th>Silk nome</th>
              <th>Silk data</th>
              <th>Data tecido</th>
              <th>Fase</th>
              <th>QTI</th>
              <th>Cor</th>
              
              <th>Facção</th>
              <th>Chegada</th>
              <th>Falta</th>
              
              <th>CELU</th>
              <th>Necessidade</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${linhasTabela}</tbody>
        </table>

        <script>
          window.addEventListener("load", () => {
            window.focus();
            window.print();
          });
        </script>
      </body>
    </html>
  `;

  const janela = window.open("", "_blank");
  if (!janela) {
    toast("O navegador bloqueou a impressão. Permita pop-ups para este site.");
    return;
  }

  janela.document.open();
  janela.document.write(htmlImpressao);
  janela.document.close();
}



function getPrecosReferenciaAtivos() {
  return [...state.precosReferencia]
    .filter(preco => preco && preco.ativo !== false)
    .sort((a, b) => {
      const refCompare = String(a.referencia || "").localeCompare(String(b.referencia || ""), "pt-BR", { numeric: true });
      if (refCompare !== 0) return refCompare;
      return String(a.processo || "").localeCompare(String(b.processo || ""), "pt-BR", { numeric: true });
    });
}

function getPrecosReferenciaPorOPSetor(op, setor) {
  const referencia = normalizarReferencia(op?.referencia || "");

  return getPrecosReferenciaAtivos().filter(preco => {
    return normalizarReferencia(preco.referencia || "") === referencia && preco.setor === setor;
  });
}

function optionsPrecosReferenciaManejo(op, setor, selecionado = "") {
  const precos = getPrecosReferenciaPorOPSetor(op, setor);

  if (!precos.length) {
    return `<option value="">Preço não cadastrado</option>`;
  }

  return `<option value="">Processo / preço</option>` + precos.map(preco => {
    const selected = preco.id === selecionado ? " selected" : "";
    return `<option value="${escapeHtml(preco.id)}"${selected}>${escapeHtml(preco.processo)} - ${escapeHtml(formatarValorUnitarioBR(preco.valor))}</option>`;
  }).join("");
}

function getDataHojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function totalEntreguePagamento(opId, precoReferenciaId) {
  return state.entregasPagamento
    .filter(entrega => entrega.opId === opId && (entrega.precoReferenciaId === precoReferenciaId || entrega.servicoId === precoReferenciaId))
    .reduce((soma, entrega) => soma + Number(entrega.quantidade || 0), 0);
}

async function registrarEntregaManejo(ordemId) {
  if (!ehAdmin()) {
    toast("Apenas admin pode registrar entregas para pagamento.");
    return;
  }

  const ordem = state.ordens.find(op => String(op.id) === String(ordemId) || String(op.numeroOP) === String(ordemId));
  if (!ordem) {
    toast("OP não encontrada.");
    return;
  }

  const setor = getManejoSetorAtual();
  const rowId = idLinhaManejo(ordem);
  const precoId = document.getElementById(`${rowId}-precoReferencia`)?.value || "";
  const dataEntrega = document.getElementById(`${rowId}-dataEntregaPagamento`)?.value || "";
  const quantidade = Number(document.getElementById(`${rowId}-qtdEntregaPagamento`)?.value || 0);
  const preco = getPrecoReferencia(precoId);

  if (!preco) {
    toast("Selecione um preço cadastrado para essa referência/processo.");
    return;
  }

  if (preco.setor !== setor) {
    toast(`Esse preço pertence ao setor ${getLabelSetorPagamento(preco.setor)}. Troque o manejo ou selecione outro preço.`);
    return;
  }

  if (normalizarReferencia(preco.referencia || "") !== normalizarReferencia(ordem.referencia || "")) {
    toast("Esse preço não pertence à referência desta OP.");
    return;
  }

  const faccao = limparTexto(valorLinhaManejo(ordem, "faccao") || getManejoDaOrdem(ordem, setor)?.faccao || "").toUpperCase();

  if (!faccao) {
    toast("Informe a facção na linha antes de registrar a entrega.");
    return;
  }

  if (!dataEntrega || quantidade <= 0) {
    toast("Informe data da entrega e quantidade entregue.");
    return;
  }

  if (quantidade > numeroQuantidadeOP(ordem)) {
    const continuar = confirm("A quantidade entregue é maior que a quantidade da OP. Deseja continuar mesmo assim?");
    if (!continuar) return;
  }

  const valorUnitario = Number(preco.valor || 0);
  const total = quantidade * valorUnitario;

  const dadosEntrega = {
    origem: "manejo",
    opId: ordem.id,
    numeroOP: ordem.numeroOP || "",
    referencia: ordem.referencia || "",
    cor: ordem.cor || "",
    produtoNome: ordem.produtoNome || "",
    faccao,
    precoReferenciaId: preco.id,
    processo: preco.processo,
    servicoId: preco.id,
    servicoNome: preco.processo,
    setor: preco.setor,
    setorLabel: getLabelSetorPagamento(preco.setor),
    dataEntrega,
    quantidade,
    valorUnitario,
    total,
    statusPagamento: "pendente",
    observacoes: `Registrado pelo Manejo ${getInfoManejoSetor(setor).label}`,
    criadoPor: state.currentUser.uid,
    criadoEm: serverTimestamp(),
    atualizadoPor: state.currentUser.uid,
    atualizadoEm: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "entregasPagamento"), dadosEntrega);

    const totalEntregue = totalEntreguePagamento(ordem.id, preco.id) + quantidade;
    const faltaCalculada = Math.max(numeroQuantidadeOP(ordem) - totalEntregue, 0);
    const faltaInput = document.getElementById(`${rowId}-falta`);
    if (faltaInput) faltaInput.value = faltaCalculada;

    const manejoExistente = getManejoDaOrdem(ordem, setor) || {};
    const silkNome = limparTexto(valorLinhaManejo(ordem, "silkNome")).toUpperCase() || manejoExistente.silkNome || manejoExistente.silk || "";
    const silkData = valorLinhaManejo(ordem, "silkData") || manejoExistente.silkData || "";
    const fase = limparTexto(valorLinhaManejo(ordem, "fase")).toUpperCase() || manejoExistente.fase || "ENTREGA";

    const manejo = {
      ...manejoExistente,
      silk: silkNome,
      silkNome,
      silkData,
      setor,
      setorLabel: getInfoManejoSetor(setor).label,
      dataTecido: valorLinhaManejo(ordem, "dataTecido") || manejoExistente.dataTecido || "",
      fase,
      faccao,
      chegada: valorLinhaManejo(ordem, "chegada") || manejoExistente.chegada || dataEntrega,
      falta: faltaCalculada,
      celu: limparTexto(valorLinhaManejo(ordem, "celu")) || manejoExistente.celu || "",
      necessidade: getNecessidadeDaOrdem(ordem),
      ultimoPrecoReferenciaId: preco.id,
      ultimoProcessoPagamento: preco.processo,
      ultimaEntregaPagamento: dataEntrega,
      ultimaQuantidadeEntregue: quantidade,
      totalEntreguePagamento: totalEntregue,
      status: faltaCalculada <= 0 ? "bipado" : "organizada",
      bipado: faltaCalculada <= 0,
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    };

    if (!manejoExistente?.criadoEm) {
      manejo.criadoPor = state.currentUser.uid;
      manejo.criadoEm = serverTimestamp();
    }

    const statusManejo = faltaCalculada <= 0 ? "bipado" : "organizada";
    const patch = montarPatchManejoSetor(setor, manejo, statusManejo, {
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    });

    await setDoc(doc(db, "ordensProducao", ordem.id), patch, { merge: true });
    await sincronizarPagamentoPeloManejo(ordem, setor, manejo);

    await registrarLog(
      "entrega_manejo_pagamento",
      "entregaPagamento",
      ordem.id,
      `OP ${ordem.numeroOP} | Ref. ${ordem.referencia} | ${faccao} | ${preco.processo} | ${quantidade} peças | Falta ${faltaCalculada} | ${formatarMoedaBR(total)}`
    );

    document.getElementById(`${rowId}-qtdEntregaPagamento`).value = "";
    toast(`Entrega registrada. Falta atual: ${faltaCalculada} peça(s).`);
  } catch (error) {
    console.error(error);
    toast("Erro ao registrar entrega pelo manejo.");
  }
}


function renderManejoInline() {
  const tbody = document.getElementById("listaManejoInline");
  if (!tbody) return;

  atualizarBotoesManejoSetor();

  const setor = getManejoSetorAtual();

  if (!podeVerManejo(setor)) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty">Seu usuário não tem acesso a este manejo.</td></tr>`;
    renderResumoSomasManejo([]);
    return;
  }

  const ordensFiltradas = filtrarOrdensManejoPorColunas();
  const chaveRender = `manejo-${setor}`;
  const ordens = limitarItensRenderTabela(chaveRender, ordensFiltradas);

  renderResumoSomasManejo(ordensFiltradas);

  if (!ordensFiltradas.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty">Nenhuma ordem de produção encontrada para o manejo.</td></tr>`;
    limparControleRenderTabela(chaveRender);
    return;
  }

  tbody.innerHTML = ordens.map(op => {
    const manejo = getManejoDaOrdem(op, setor);
    const rowId = idLinhaManejo(op);
    const rowClass = manejo ? "manejo-row-saved" : "manejo-row-pending";
    const status = getStatusManejo(op, setor);
    const movimentosAbertos = getMovimentacoesDaOrdem(op.id)
      .filter(mov => mov.status !== "finalizado" && mov.status !== "retornou").length;

    return `
      <tr class="${rowClass}" data-manejo-row="1" data-qti="${escapeHtml(numeroQuantidadeOP(op))}" data-falta="0" data-status="${escapeHtml(status)}" data-fase="${escapeHtml(manejo?.fase || "Sem fase")}" data-cor="${escapeHtml(op.cor || "Sem cor")}">
        <td><input class="manejo-readonly" value="${escapeHtml(op.numeroOP || "")}" readonly /></td>
        <td><input class="manejo-readonly" value="${escapeHtml(op.referencia || "")}" readonly /></td>
        <td>
          <div class="silk-fields">
            <label class="mini-field">
              <span>Nome</span>
              <input id="${rowId}-silkNome" value="${escapeHtml(getSilkNomeManejo(manejo))}" list="manejoSilkNomesList" placeholder="Quem fez" />
            </label>
            <label class="mini-field">
              <span>Data</span>
              <input id="${rowId}-silkData" type="date" value="${escapeHtml(manejo?.silkData || "")}" title="Data do silk" />
            </label>
          </div>
        </td>
        <td>
          <div class="silk-fields tecido-fields">
            <label class="mini-field">
              <span>Nome</span>
              <input id="${rowId}-tecidoNome" value="${escapeHtml(manejo?.tecidoNome || manejo?.tecido || "")}" list="manejoTecidoNomesList" placeholder="Quem fez" />
            </label>
            <label class="mini-field">
              <span>Data</span>
              <input id="${rowId}-dataTecido" type="date" value="${escapeHtml(manejo?.dataTecido || "")}" title="Data do tecido" />
            </label>
          </div>
        </td>
        <td>
          <div class="fase-plus">
            <input id="${rowId}-fase" value="${escapeHtml(manejo?.fase || "")}" list="manejoFasesList" placeholder="Digite a fase" />
            <button class="btn-plus" type="button" onclick="adicionarFaseSugestao('${op.id}')" title="Adicionar Fase Bojo às sugestões">+</button>
          </div>
        </td>
        <td class="manejo-col-fase-lateral">
          <div class="fase-plus">
            <input id="${rowId}-faseLateral" value="${escapeHtml(manejo?.faseLateral || "")}" list="manejoFasesLateraisList" placeholder="Digite a fase" />
            <button class="btn-plus" type="button" onclick="adicionarFaseLateralSugestao('${op.id}')" title="Adicionar Fase Lateral às sugestões">+</button>
          </div>
        </td>
        <td><input class="manejo-readonly" type="number" value="${escapeHtml(op.quantidade ?? 0)}" readonly /></td>
        <td><input class="manejo-readonly" value="${escapeHtml(op.cor || "")}" readonly /></td>
        <td><input id="${rowId}-necessidade" value="${escapeHtml(getNecessidadeDaOrdem(op, setor))}" placeholder="Necessidade" title="Digite ou edite a necessidade" /></td>
        <td>
          ${manejoStatusBadge(manejo, op, setor)}
          ${movimentosAbertos ? `<small class="mov-aberto">${movimentosAbertos} mov.</small>` : ""}
        </td>
        <td>
          <div class="manejo-actions-inline">
            <button class="btn-save-manejo" type="button" onclick="salvarManejoLinha('${op.id}')" title="Salvar edição rápida" aria-label="Salvar edição rápida da OP ${escapeHtml(op.numeroOP || '')}">✓</button>
            <div class="action-menu-wrap">
              <button class="btn-kebab" type="button" onclick="toggleMenuAcoesManejo(event, '${op.id}')" title="Mais ações da OP" aria-label="Mais ações da OP ${escapeHtml(op.numeroOP || '')}">⋮</button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  renderControleRenderTabela(tbody, chaveRender, ordensFiltradas.length, ordens.length, "OPs do manejo");
  renderResumoSomasManejoPeloDOM();
}

function valorSilkAntigoValido(valor) {
  const texto = limparTexto(valor).toUpperCase();
  if (!texto) return "";
  if (["SIM", "NÃO", "NAO", "PENDENTE"].includes(texto)) return "";
  return texto;
}

function getSilkNomeManejo(manejo) {
  if (!manejo) return "";

  const silkNome = valorSilkAntigoValido(manejo.silkNome);
  if (silkNome) return silkNome;

  return valorSilkAntigoValido(manejo.silk);
}

function getStatusManejo(op, setor = "sutia") {
  const manejo = getManejoDaOrdem(op, setor);

  if (setor === "bojo") {
    if (op?.manejoStatus && op.manejoStatus !== "bipado") return op.manejoStatus;
    return manejo ? "organizada" : "pendente";
  }

  const statusSetor = op?.manejoStatusSetores?.[setor];

  if (statusSetor && statusSetor !== "bipado") return statusSetor;

  return manejo ? "organizada" : "pendente";
}

function silkPreenchidoManejo(manejo) {
  if (!manejo) return false;
  return Boolean(getSilkNomeManejo(manejo) || manejo.silkData || manejo.dataSilk);
}

function getValorSilkManejoParaFiltro(manejo) {
  if (!manejo) return "";

  const nome = getSilkNomeManejo(manejo);
  if (nome) return nome;

  return manejo.silkData || manejo.dataSilk || "";
}

function getDadosLinhaOuManejoObrigatorios(op, setor = getManejoSetorAtual()) {
  const manejo = getManejoDaOrdem(op, setor) || {};
  const silkNomeLinha = limparTexto(valorLinhaManejo(op, "silkNome")).toUpperCase();
  const silkDataLinha = valorLinhaManejo(op, "silkData") || "";
  const tecidoNomeLinha = limparTexto(valorLinhaManejo(op, "tecidoNome")).toUpperCase();
  const dataTecidoLinha = valorLinhaManejo(op, "dataTecido") || "";

  const silkNome = silkNomeLinha || getSilkNomeManejo(manejo);
  const silkData = silkDataLinha || manejo.silkData || manejo.dataSilk || "";
  const tecidoNome = tecidoNomeLinha || manejo.tecidoNome || manejo.tecido || "";
  const dataTecido = dataTecidoLinha || manejo.dataTecido || "";

  return {
    silkNome,
    silkData,
    tecidoNome,
    dataTecido,
    silkPreenchido: Boolean(silkNome || silkData),
    tecidoPreenchido: Boolean(dataTecido)
  };
}

function validarSilkETecidoAntesDeMovimentar(op, setor = getManejoSetorAtual()) {
  const dados = getDadosLinhaOuManejoObrigatorios(op, setor);
  const faltando = [];

  if (!dados.silkPreenchido) faltando.push("SILK");
  if (!dados.tecidoPreenchido) faltando.push("DATA TECIDO");

  if (faltando.length) {
    toast(`Antes de seguir, preencha ${faltando.join(" e ")} da OP ${op.numeroOP || ""}.`);
    return { ok: false, ...dados };
  }

  return { ok: true, ...dados };
}

async function salvarSilkETecidoAntesDeMovimentar(op, setor = getManejoSetorAtual(), dadosObrigatorios = null) {
  if (!op?.id) return;

  const dados = dadosObrigatorios || getDadosLinhaOuManejoObrigatorios(op, setor);
  const manejoExistente = getManejoDaOrdem(op, setor) || {};
  const faseLinha = limparTexto(valorLinhaManejo(op, "fase")).toUpperCase();
  const fase = faseLinha || manejoExistente.fase || "PRONTO PARA MOVIMENTAR";
  const faseLateral = setor === "sutia"
    ? (limparTexto(valorLinhaManejo(op, "faseLateral")).toUpperCase() || manejoExistente.faseLateral || "")
    : (manejoExistente.faseLateral || "");

  const manejo = {
    ...manejoExistente,
    setor,
    setorLabel: getInfoManejoSetor(setor).label,
    silk: dados.silkNome || manejoExistente.silk || "",
    silkNome: dados.silkNome || manejoExistente.silkNome || manejoExistente.silk || "",
    silkData: dados.silkData || manejoExistente.silkData || "",
    tecido: dados.tecidoNome || manejoExistente.tecido || "",
    tecidoNome: dados.tecidoNome || manejoExistente.tecidoNome || manejoExistente.tecido || "",
    dataTecido: dados.dataTecido || manejoExistente.dataTecido || "",
    fase,
    faseLateral,
    faccao: limparTexto(valorLinhaManejo(op, "faccao")).toUpperCase() || manejoExistente.faccao || "",
    chegada: valorLinhaManejo(op, "chegada") || manejoExistente.chegada || "",
    falta: Number(valorLinhaManejo(op, "falta") || manejoExistente.falta || 0),
    celu: limparTexto(valorLinhaManejo(op, "celu")) || manejoExistente.celu || "",
    necessidade: getNecessidadeDaOrdem(op),
    status: manejoExistente.status || "organizada",
    atualizadoPor: state.currentUser.uid,
    atualizadoEm: serverTimestamp()
  };

  if (!manejoExistente?.criadoEm) {
    manejo.criadoPor = state.currentUser.uid;
    manejo.criadoEm = serverTimestamp();
  }

  const patch = montarPatchManejoSetor(setor, manejo, getStatusManejo(op, setor) || "organizada", {
    atualizadoPor: state.currentUser.uid,
    atualizadoEm: serverTimestamp()
  });

  await setDoc(doc(db, "ordensProducao", op.id), patch, { merge: true });
}


function getValorTecidoManejoParaFiltro(manejo) {
  if (!manejo) return "";
  return [manejo.tecidoNome || manejo.tecido || "", manejo.dataTecido || ""].filter(Boolean).join(" ").trim();
}

function getValorManejoParaFiltro(op, campo, setor = getManejoSetorAtual()) {
  const manejo = getManejoDaOrdem(op, setor);

  const mapa = {
    status: getStatusManejo(op, setor),
    op: op.numeroOP || "",
    referencia: op.referencia || "",
    silk: getValorSilkManejoParaFiltro(manejo),
    dataTecido: getValorTecidoManejoParaFiltro(manejo),
    fase: manejo?.fase || "",
    faseLateral: setor === "sutia" ? (manejo?.faseLateral || "") : "",
    quantidade: op.quantidade ?? "",
    cor: op.cor || "",
    faccao: manejo?.faccao || "",
    chegada: manejo?.chegada || "",
    falta: manejo?.falta ?? "",
    celu: manejo?.celu || "",
    necessidade: getNecessidadeDaOrdem(op)
  };

  return String(mapa[campo] ?? "");
}

const CAMPOS_FILTRO_MANEJO_EXATO_QUANDO_OPCAO = new Set([
  "op",
  "referencia",
  "silk",
  "dataTecido",
  "fase",
  "faseLateral",
  "quantidade",
  "cor",
  "faccao",
  "chegada",
  "falta",
  "celu",
  "necessidade"
]);

function getOpcoesFiltroManejoNormalizadas(campo, setor = getManejoSetorAtual()) {
  const ordens = getOrdensDoSetorManejo(setor);
  const extrasPorCampo = {
    fase: state.fasesManejoExtras || [],
    faseLateral: state.fasesLateraisManejoExtras || [],
    faccao: state.faccoesManejoExtras || [],
    celu: state.celusManejoExtras || []
  };

  return new Set([
    ...ordens.map(op => getValorManejoParaFiltro(op, campo, setor)),
    ...(extrasPorCampo[campo] || [])
  ]
    .map(valor => normalizarTexto(valor).trim())
    .filter(Boolean));
}

function filtroManejoCombina(campo, valorFiltroOriginal, valorItemOriginal, setor = getManejoSetorAtual(), opcoesNormalizadasPorCampo = null) {
  if (!valorFiltroOriginal) return true;

  if (campo === "status") {
    return String(valorItemOriginal || "") === String(valorFiltroOriginal || "");
  }

  const valorFiltro = normalizarTexto(valorFiltroOriginal).trim();
  const valorItem = normalizarTexto(valorItemOriginal).trim();

  if (!valorFiltro) return true;

  // Opção universal para o Manejo: permite localizar rapidamente campos vazios
  // sem quebrar os filtros exatos, como CASA x DISPONÍVEL P CASA.
  const filtrosCampoVazio = [
    "campo vazio",
    "vazio",
    "sem preenchimento",
    "sem preencher",
    "nao preenchido",
    "não preenchido",
    "em branco"
  ];
  const filtrosCampoPreenchido = [
    "preenchido",
    "preenchida",
    "preenchidos",
    "com preenchimento"
  ];

  if (filtrosCampoVazio.includes(valorFiltro)) {
    return !valorItem;
  }

  if (filtrosCampoPreenchido.includes(valorFiltro)) {
    return Boolean(valorItem);
  }

  // Filtros especiais do SILK e da DATA TECIDO:
  // "Preenchido" mostra tudo que já tem qualquer informação salva no campo,
  // sem obrigar o usuário a escolher um nome/data específica.
  if (campo === "silk") {
    if (["com silk", "silk preenchido"].includes(valorFiltro)) {
      return Boolean(valorItem);
    }

    if (["sem silk"].includes(valorFiltro)) {
      return !valorItem;
    }
  }

  if (campo === "dataTecido") {
    if (["com tecido", "tecido preenchido"].includes(valorFiltro)) {
      return Boolean(valorItem);
    }

    if (["sem tecido"].includes(valorFiltro)) {
      return !valorItem;
    }
  }

  if (campo === "necessidade") {
    if (["urgente", "urgencia", "urgência"].includes(valorFiltro)) {
      return valorItem.includes("urgente") || valorItem.includes("urgencia");
    }

    if (["sem necessidade"].includes(valorFiltro)) {
      return !valorItem;
    }
  }

  // Quando o valor digitado existe exatamente nas opções do filtro, compara exato.
  // Isso impede o bug: filtrar FASE = CASA trazendo também DISPONIVEL P CASA.
  // Se digitar só parte do texto, continua funcionando como busca parcial.
  if (CAMPOS_FILTRO_MANEJO_EXATO_QUANDO_OPCAO.has(campo)) {
    const opcoes = opcoesNormalizadasPorCampo?.[campo] || getOpcoesFiltroManejoNormalizadas(campo, setor);
    if (opcoes.has(valorFiltro)) {
      return valorItem === valorFiltro;
    }
  }

  return valorItem.includes(valorFiltro);
}


function getNumeroOrdenacaoOP(op) {
  const valor = String(op?.numeroOP || op?.id || "").replace(/\D/g, "");
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? numero : 0;
}

function getDataOrdenacaoNecessidade(op, setor = getManejoSetorAtual()) {
  const necessidade = getNecessidadeDaOrdem(op, setor);
  const periodo = extrairPeriodoNecessidade(necessidade);
  const data = periodo.inicio || periodo.fim || "";
  return data || "0000-00-00";
}

function getPrioridadeUrgenteNecessidade(op, setor = getManejoSetorAtual()) {
  const texto = normalizarTexto(getNecessidadeDaOrdem(op, setor));
  return (texto.includes("urgente") || texto.includes("urgencia")) ? 1 : 0;
}

function compararPadraoManejo(a, b, setor = getManejoSetorAtual()) {
  const dataA = getDataOrdenacaoNecessidade(a, setor);
  const dataB = getDataOrdenacaoNecessidade(b, setor);
  return dataA.localeCompare(dataB)
    || getNumeroOrdenacaoOP(a) - getNumeroOrdenacaoOP(b)
    || String(a?.numeroOP || "").localeCompare(String(b?.numeroOP || ""), "pt-BR", { numeric: true });
}

function aplicarOrdenacaoManejo(ordens) {
  const tipo = document.getElementById("filtroManejoOrdenacao")?.value || "padrao";
  const setor = getManejoSetorAtual();
  const lista = [...ordens];

  const comparaTextoNecessidade = (a, b) => String(getNecessidadeDaOrdem(a, setor) || "").localeCompare(String(getNecessidadeDaOrdem(b, setor) || ""), "pt-BR", { numeric: true });

  switch (tipo) {
    case "necessidade_desc":
      return lista.sort((a, b) => {
        const urgente = getPrioridadeUrgenteNecessidade(b, setor) - getPrioridadeUrgenteNecessidade(a, setor);
        if (urgente) return urgente;
        const data = getDataOrdenacaoNecessidade(b, setor).localeCompare(getDataOrdenacaoNecessidade(a, setor));
        if (data) return data;
        return comparaTextoNecessidade(b, a) || getNumeroOrdenacaoOP(b) - getNumeroOrdenacaoOP(a);
      });

    case "necessidade_asc":
      return lista.sort((a, b) => {
        const data = getDataOrdenacaoNecessidade(a, setor).localeCompare(getDataOrdenacaoNecessidade(b, setor));
        if (data) return data;
        return comparaTextoNecessidade(a, b) || getNumeroOrdenacaoOP(a) - getNumeroOrdenacaoOP(b);
      });

    case "urgente_primeiro":
      return lista.sort((a, b) => {
        const urgente = getPrioridadeUrgenteNecessidade(b, setor) - getPrioridadeUrgenteNecessidade(a, setor);
        if (urgente) return urgente;
        return getDataOrdenacaoNecessidade(a, setor).localeCompare(getDataOrdenacaoNecessidade(b, setor)) || getNumeroOrdenacaoOP(a) - getNumeroOrdenacaoOP(b);
      });

    case "op_desc":
      return lista.sort((a, b) => getNumeroOrdenacaoOP(b) - getNumeroOrdenacaoOP(a));

    case "op_asc":
      return lista.sort((a, b) => getNumeroOrdenacaoOP(a) - getNumeroOrdenacaoOP(b));

    case "qtd_desc":
      return lista.sort((a, b) => numeroQuantidadeOP(b) - numeroQuantidadeOP(a) || getNumeroOrdenacaoOP(a) - getNumeroOrdenacaoOP(b));

    case "qtd_asc":
      return lista.sort((a, b) => numeroQuantidadeOP(a) - numeroQuantidadeOP(b) || getNumeroOrdenacaoOP(a) - getNumeroOrdenacaoOP(b));

    default:
      return lista.sort((a, b) => compararPadraoManejo(a, b, setor));
  }
}

function filtrarOrdensManejoPorColunas() {
  const setor = getManejoSetorAtual();
  const busca = normalizarTexto(document.getElementById("buscaManejoLinha")?.value || "");

  const filtros = {
    status: document.getElementById("filtroManejoStatus")?.value || "",
    op: document.getElementById("filtroManejoOP")?.value || "",
    referencia: document.getElementById("filtroManejoReferencia")?.value || "",
    silk: document.getElementById("filtroManejoSilk")?.value || "",
    dataTecido: document.getElementById("filtroManejoDataTecido")?.value || "",
    fase: document.getElementById("filtroManejoFase")?.value || "",
    faseLateral: setor === "sutia" ? (document.getElementById("filtroManejoFaseLateral")?.value || "") : "",
    quantidade: document.getElementById("filtroManejoQuantidade")?.value || "",
    cor: document.getElementById("filtroManejoCor")?.value || "",
    faccao: document.getElementById("filtroManejoFaccao")?.value || "",
    chegada: document.getElementById("filtroManejoChegada")?.value || "",
    falta: document.getElementById("filtroManejoFalta")?.value || "",
    celu: document.getElementById("filtroManejoCelu")?.value || "",
    necessidade: document.getElementById("filtroManejoNecessidade")?.value || ""
  };

  const opcoesNormalizadasPorCampo = {};
  Object.entries(filtros).forEach(([campo, valor]) => {
    if (valor && CAMPOS_FILTRO_MANEJO_EXATO_QUANDO_OPCAO.has(campo)) {
      opcoesNormalizadasPorCampo[campo] = getOpcoesFiltroManejoNormalizadas(campo, setor);
    }
  });

  const filtradas = getOrdensDoSetorManejo(setor).filter(op => {
    const manejo = getManejoDaOrdem(op, setor);

    const textoGeral = normalizarTexto([
      op.numeroOP,
      op.numeroOPExterno,
      op.referencia,
      op.cor,
      op.produtoNome,
      op.quantidade,
      getNecessidadeDaOrdem(op),
      getSilkNomeManejo(manejo),
      manejo?.silkData,
      manejo?.dataTecido,
      manejo?.fase,
      manejo?.faseLateral,
      manejo?.faccao,
      manejo?.chegada,
      manejo?.falta,
      manejo?.celu
    ].join(" "));

    if (busca && !textoGeral.includes(busca)) return false;

    return Object.entries(filtros).every(([campo, valor]) => {
      if (!valor) return true;

      const valorItem = getValorManejoParaFiltro(op, campo, setor);
      return filtroManejoCombina(campo, valor, valorItem, setor, opcoesNormalizadasPorCampo);
    });
  });

  return aplicarOrdenacaoManejo(filtradas);
}

function limparFiltrosColunasManejo() {
  [
    "buscaManejoLinha",
    "filtroManejoStatus",
    "filtroManejoOP",
    "filtroManejoReferencia",
    "filtroManejoSilk",
    "filtroManejoDataTecido",
    "filtroManejoFase",
    "filtroManejoFaseLateral",
    "filtroManejoQuantidade",
    "filtroManejoCor",
    "filtroManejoFaccao",
    "filtroManejoChegada",
    "filtroManejoFalta",
    "filtroManejoCelu",
    "filtroManejoNecessidade",
    "filtroManejoOrdenacao"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = id === "filtroManejoOrdenacao" ? "padrao" : "";
  });
}

function preencherSelectFiltroManejo(id, valores, labelTodos = "Todos") {
  const campo = document.getElementById(id);
  if (!campo) return;

  const atual = campo.value;
  const limposBase = [...new Set(valores.map(valor => String(valor ?? "").trim()).filter(Boolean))];

  // Mantém opções especiais no topo do datalist para facilitar o uso no dia a dia.
  // SILK e DATA TECIDO precisam ter a opção "Preenchido" para listar rapidamente
  // tudo que já está liberado para seguir.
  const opcoesFixasPorFiltro = {
    filtroManejoReferencia: ["Campo vazio"],
    filtroManejoSilk: ["Preenchido", "Campo vazio", "Sem silk"],
    filtroManejoDataTecido: ["Preenchido", "Campo vazio", "Sem tecido"],
    filtroManejoFase: ["Campo vazio"],
    filtroManejoFaseLateral: ["Campo vazio"],
    filtroManejoQuantidade: ["Campo vazio"],
    filtroManejoCor: ["Campo vazio"],
    filtroManejoFaccao: ["Campo vazio"],
    filtroManejoChegada: ["Campo vazio"],
    filtroManejoFalta: ["Campo vazio"],
    filtroManejoCelu: ["Campo vazio"],
    filtroManejoNecessidade: ["URGENTE", "Campo vazio", "Sem necessidade"]
  };
  const fixas = opcoesFixasPorFiltro[id] || [];
  const fixasNormalizadas = new Set(fixas.map(valor => normalizarTexto(valor).trim()));
  const dinamicas = limposBase
    .filter(valor => !fixasNormalizadas.has(normalizarTexto(valor).trim()))
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const limpos = [...fixas, ...dinamicas];

  const datalist = document.getElementById(`${id}List`);

  if (datalist) {
    datalist.innerHTML = limpos.map(valor => {
      return `<option value="${escapeHtml(valor)}"></option>`;
    }).join("");

    campo.value = atual;
    return;
  }

  campo.innerHTML = `<option value="">${labelTodos}</option>` + limpos.map(valor => {
    return `<option value="${escapeHtml(valor)}">${escapeHtml(valor)}</option>`;
  }).join("");

  if (limpos.includes(atual)) {
    campo.value = atual;
  }
}

function prepararFiltroOPManejoDigitado() {
  const campo = document.getElementById("filtroManejoOP");
  const datalist = document.getElementById("filtroManejoOPList");

  // O filtro de OP fica somente digitável.
  // Não carregamos todas as OPs como sugestão porque isso deixa o navegador lento
  // quando a base cresce e o usuário precisa digitar rapidamente o número.
  if (campo) {
    campo.removeAttribute("list");
    campo.setAttribute("inputmode", "numeric");
    campo.setAttribute("autocomplete", "off");
  }

  if (datalist) datalist.innerHTML = "";
}

function renderFiltrosColunasManejo() {
  const setor = getManejoSetorAtual();
  const ordens = getOrdensDoSetorManejo(setor);

  prepararFiltroOPManejoDigitado();
  preencherSelectFiltroManejo("filtroManejoReferencia", ordens.map(op => getValorManejoParaFiltro(op, "referencia")), "Todas");
  preencherSelectFiltroManejo("filtroManejoSilk", [
    "Preenchido",
    "Campo vazio",
    "Sem silk",
    ...ordens.map(op => getValorManejoParaFiltro(op, "silk"))
  ], "Todos");
  preencherSelectFiltroManejo("filtroManejoDataTecido", [
    "Preenchido",
    "Campo vazio",
    "Sem tecido",
    ...ordens.map(op => getValorManejoParaFiltro(op, "dataTecido"))
  ], "Todas");
  preencherSelectFiltroManejo("filtroManejoFase", [
    ...ordens.map(op => getValorManejoParaFiltro(op, "fase")),
    ...state.fasesManejoExtras
  ], "Todas");
  if (setor === "sutia") {
    preencherSelectFiltroManejo("filtroManejoFaseLateral", [
      ...ordens.map(op => getValorManejoParaFiltro(op, "faseLateral")),
      ...state.fasesLateraisManejoExtras
    ], "Todas");
  } else {
    const filtroLateral = document.getElementById("filtroManejoFaseLateral");
    if (filtroLateral) filtroLateral.value = "";
  }
  preencherSelectFiltroManejo("filtroManejoQuantidade", ordens.map(op => getValorManejoParaFiltro(op, "quantidade")), "Todas");
  preencherSelectFiltroManejo("filtroManejoCor", ordens.map(op => getValorManejoParaFiltro(op, "cor")), "Todas");
  preencherSelectFiltroManejo("filtroManejoFaccao", [
    ...ordens.map(op => getValorManejoParaFiltro(op, "faccao")),
    ...state.faccoesManejoExtras
  ], "Todas");
  preencherSelectFiltroManejo("filtroManejoChegada", ordens.map(op => getValorManejoParaFiltro(op, "chegada")), "Todas");
  preencherSelectFiltroManejo("filtroManejoFalta", ordens.map(op => getValorManejoParaFiltro(op, "falta")), "Todas");
  preencherSelectFiltroManejo("filtroManejoCelu", [
    ...ordens.map(op => getValorManejoParaFiltro(op, "celu")),
    ...state.celusManejoExtras
  ], "Todos");
  preencherSelectFiltroManejo("filtroManejoNecessidade", [
    "URGENTE",
    "Campo vazio",
    "Sem necessidade",
    ...ordens.map(op => getValorManejoParaFiltro(op, "necessidade"))
  ], "Todas");
}


function numeroQuantidadeOP(op) {
  const valor = Number(op?.quantidade || 0);
  return Number.isFinite(valor) ? valor : 0;
}

function numeroFaltaManejo(op, setor = "bojo") {
  const manejo = getManejoDaOrdem(op, setor);
  const valor = Number(manejo?.falta || 0);
  return Number.isFinite(valor) ? valor : 0;
}

function formatarNumeroInteiro(valor) {
  return Number(valor || 0).toLocaleString("pt-BR");
}

function agruparSomaManejo(ordens, obterNome) {
  const mapa = new Map();

  ordens.forEach(op => {
    const nome = String(obterNome(op) || "Sem informação").trim() || "Sem informação";
    const atual = mapa.get(nome) || { ops: 0, pecas: 0 };

    atual.ops += 1;
    atual.pecas += numeroQuantidadeOP(op);

    mapa.set(nome, atual);
  });

  return [...mapa.entries()]
    .map(([nome, dados]) => ({ nome, ...dados }))
    .sort((a, b) => b.pecas - a.pecas || b.ops - a.ops || a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
}

function renderTabelaSomaManejo(tbodyId, linhas) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  if (!linhas.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty">Sem dados.</td></tr>`;
    return;
  }

  tbody.innerHTML = linhas.map(item => `
    <tr>
      <td><strong>${escapeHtml(item.nome)}</strong></td>
      <td>${formatarNumeroInteiro(item.ops)}</td>
      <td>${formatarNumeroInteiro(item.pecas)}</td>
    </tr>
  `).join("");
}


function textoSelectSelecionado(id) {
  const campo = document.getElementById(id);
  if (!campo || !campo.value) return "";

  if (campo.tagName === "SELECT") {
    const label = campo.options[campo.selectedIndex]?.textContent || campo.value;
    return label.trim();
  }

  return String(campo.value || "").trim();
}

function getFiltrosManejoAtivosTexto() {
  const filtros = [
    ["Status", "filtroManejoStatus"],
    ["OP", "filtroManejoOP"],
    ["REF", "filtroManejoReferencia"],
    ["Silk", "filtroManejoSilk"],
    ["Data tecido", "filtroManejoDataTecido"],
    ["Fase Bojo", "filtroManejoFase"],
    ["Fase Lateral", "filtroManejoFaseLateral"],
    ["QTI", "filtroManejoQuantidade"],
    ["Cor", "filtroManejoCor"],
    ["Data", "filtroManejoData"],
    ["Facção", "filtroManejoFaccao"],
    ["Chegada", "filtroManejoChegada"],
    ["Falta", "filtroManejoFalta"],
    ["Produção", "filtroManejoProducao"],
    ["CELU", "filtroManejoCelu"],
    ["Necessidade", "filtroManejoNecessidade"]
  ];

  const busca = document.getElementById("buscaManejoLinha")?.value?.trim();
  const ativos = filtros
    .map(([nome, id]) => {
      const valor = textoSelectSelecionado(id);
      return valor ? `${nome}: ${valor}` : "";
    })
    .filter(Boolean);

  if (busca) ativos.unshift(`Busca: ${busca}`);

  const ordenacao = textoSelectSelecionado("filtroManejoOrdenacao");
  if (ordenacao && document.getElementById("filtroManejoOrdenacao")?.value !== "padrao") {
    ativos.push(`Ordenação: ${ordenacao}`);
  }

  return ativos.length ? `Filtro: ${ativos.join(" + ")}` : "Filtro: todos os registros";
}


function renderResumoSomasManejo(ordens) {
  const setor = getManejoSetorAtual();
  const totalOps = ordens.length;
  const totalPecas = ordens.reduce((soma, op) => soma + numeroQuantidadeOP(op), 0);
  const totalFalta = ordens.reduce((soma, op) => soma + numeroFaltaManejo(op, setor), 0);
  const organizadas = ordens.filter(op => getStatusManejo(op, setor) === "organizada" || getStatusManejo(op, setor) === "bipado").length;
  const pendentes = ordens.filter(op => getStatusManejo(op, setor) === "pendente").length;

  const setText = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
  };

  setText("somaManejoOps", formatarNumeroInteiro(totalOps));
  setText("somaManejoPecas", formatarNumeroInteiro(totalPecas));
  setText("somaManejoFalta", formatarNumeroInteiro(totalFalta));
  setText("somaManejoStatus", `${formatarNumeroInteiro(organizadas)} org. | ${formatarNumeroInteiro(pendentes)} pend.`);
  setText("somaManejoPecasCompacto", `${formatarNumeroInteiro(totalPecas)} peças`);
  setText("somaManejoFiltroAtivo", getFiltrosManejoAtivosTexto());
  setText(
    "somaManejoResumoCompacto",
    `${formatarNumeroInteiro(totalOps)} OPs | ${formatarNumeroInteiro(totalFalta)} falta | ${formatarNumeroInteiro(organizadas)} org. | ${formatarNumeroInteiro(pendentes)} pend.`
  );

  renderTabelaSomaManejo("somaManejoFases", agruparSomaManejo(ordens, op => op.manejo?.fase || getManejoDaOrdem(op)?.fase || "Sem fase"));
  renderTabelaSomaManejo("somaManejoCores", agruparSomaManejo(ordens, op => op.cor || "Sem cor"));
}



function renderResumoSomasManejoPeloDOM() {
  const linhas = [...document.querySelectorAll("#listaManejoInline tr[data-manejo-row='1']")];

  if (!linhas.length) {
    renderResumoSomasManejo([]);
    return;
  }

  const ordensVisiveis = linhas.map(linha => {
    const qti = Number(linha.dataset.qti || 0);
    const falta = Number(linha.dataset.falta || 0);
    const status = linha.dataset.status || "pendente";
    const fase = linha.dataset.fase || "Sem fase";
    const cor = linha.dataset.cor || "Sem cor";

    return {
      quantidade: Number.isFinite(qti) ? qti : 0,
      cor,
      manejo: {
        falta: Number.isFinite(falta) ? falta : 0,
        fase
      },
      manejoStatus: status
    };
  });

  renderResumoSomasManejo(ordensVisiveis);
}


function getNecessidadeDaOrdem(op, setor = "") {
  if (!op) return "";

  // Quando o usuário já editou manualmente, respeita exatamente o campo salvo,
  // inclusive se ele deixou em branco de propósito.
  if (op.necessidadeManual === true) {
    return limparTexto(op.necessidade ?? op.necessidadeTexto ?? "");
  }

  const camposDiretos = [
    op.necessidade,
    op.necessidadeTexto,
    op.necessidadeOriginalLigia
  ];

  for (const valor of camposDiretos) {
    const texto = limparTexto(valor);
    if (texto) return texto;
  }

  // Na migração da Lígia, algumas necessidades vieram dentro do manejo do setor.
  // Antes o sistema ignorava isso e acabava mostrando a data de criação/hoje.
  const manejoSetor = setor ? getManejoDaOrdem(op, setor) : null;
  const manejoPadrao = manejoSetor || getManejoDaOrdem(op, getManejoSetorAtual?.() || "sutia") || getManejoDaOrdem(op, "sutia") || getManejoDaOrdem(op, "bojo");
  const necessidadeManejo = limparTexto(manejoPadrao?.necessidade || manejoPadrao?.necessidadeTexto || "");
  if (necessidadeManejo) return necessidadeManejo;

  const camposCompatibilidade = [
    op.previsaoEntrega,
    op.dataNecessidade,
    op.dataEntrega
  ];

  for (const valor of camposCompatibilidade) {
    const texto = limparTexto(valor);
    if (texto) return texto;
  }

  if (op.mes && op.ano && op.semana) {
    return `Semana ${op.semana} - ${op.mes}/${op.ano}`;
  }

  // Não usa mais criadoEm como necessidade, porque isso mostrava a data de hoje
  // em OPs que estavam sem necessidade preenchida.
  return "";
}

function getManejoDaOrdem(op, setor = "sutia") {
  if (!op) return null;

  // Mantém compatibilidade com registros antigos que usavam "bojo" como manejo principal.
  if (setor === "bojo") {
    if (op.manejo) {
      return {
        id: op.id,
        setor,
        ...op.manejo
      };
    }

    return null;
  }

  const manejoSetor = op.manejosSetores?.[setor];

  if (manejoSetor) {
    return {
      id: op.id,
      setor,
      ...manejoSetor
    };
  }

  return null;
}

function idLinhaManejo(op) {
  return `manejo-${docIdSeguro(op.id || op.numeroOP)}`;
}

function valorLinhaManejo(op, campo) {
  const el = document.getElementById(`${idLinhaManejo(op)}-${campo}`);
  return el ? el.value : "";
}


function getPrecosReferenciaDoManejo(op, setor) {
  const referencia = normalizarReferencia(op?.referencia || "");

  return getPrecosReferenciaAtivos().filter(preco => {
    return normalizarReferencia(preco.referencia || "") === referencia;
  });
}

function idPagamentoManejo(op, setor, preco) {
  return docIdSeguro(`manejo-${op.id}-${setor}-${preco.id}`);
}

async function sincronizarPagamentoPeloManejo(op, setor, manejo) {
  if (!op || !manejo) {
    return {
      ok: false,
      total: 0,
      motivo: "OP ou manejo não encontrado."
    };
  }

  const faccao = limparTexto(manejo.faccao || "").toUpperCase();
  const dataEntrega = manejo.chegada || "";

  if (!faccao || !dataEntrega) {
    return {
      ok: false,
      total: 0,
      motivo: "Para gerar pagamento, preencha Facção e Chegada no Manejo."
    };
  }

  const precos = getPrecosReferenciaDoManejo(op, setor);
  if (!precos.length) {
    return {
      ok: false,
      total: 0,
      motivo: `Não há preço cadastrado para a referência ${op.referencia || "-"} no setor ${getInfoManejoSetor(setor).label}.`
    };
  }

  const falta = Math.max(0, Number(manejo.falta || 0));
  const quantidadePagar = Math.max(numeroQuantidadeOP(op) - falta, 0);
  let totalGeral = 0;
  let gerados = 0;

  for (const preco of precos) {
    const pagamentoId = idPagamentoManejo(op, setor, preco);
    const pagamentoRef = doc(db, "entregasPagamento", pagamentoId);
    const atualSnap = await getDoc(pagamentoRef);
    const dadosAtuais = atualSnap.exists() ? atualSnap.data() : {};
    const statusAtual = dadosAtuais.statusPagamento || "pendente";

    const valorUnitario = Number(preco.valor || 0);
    const total = quantidadePagar * valorUnitario;
    totalGeral += total;
    gerados += 1;

    await setDoc(pagamentoRef, {
      origem: "manejo",
      opId: op.id,
      numeroOP: op.numeroOP || "",
      referencia: op.referencia || "",
      cor: op.cor || "",
      produtoNome: op.produtoNome || "",
      faccao,
      precoReferenciaId: preco.id,
      processo: preco.processo,
      servicoId: preco.id,
      servicoNome: preco.processo,
      setor: preco.setor,
      setorLabel: getLabelSetorPagamento(preco.setor),
      dataEntrega,
      quantidade: quantidadePagar,
      falta,
      valorUnitario,
      total,
      statusPagamento: statusAtual,
      observacoes: `Gerado automaticamente pelo Manejo ${getInfoManejoSetor(setor).label}`,
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp(),
      criadoPor: dadosAtuais.criadoPor || state.currentUser.uid,
      criadoEm: dadosAtuais.criadoEm || serverTimestamp()
    }, { merge: true });
  }

  return {
    ok: true,
    total: gerados,
    valor: totalGeral,
    quantidade: quantidadePagar,
    falta,
    motivo: `${gerados} pagamento(s) gerado(s)/atualizado(s).`
  };
}

async function salvarManejoLinha(ordemId) {
  const ordem = state.ordens.find(op => op.id === ordemId);
  if (!ordem) {
    toast("OP não encontrada.");
    return;
  }

  const setor = getManejoSetorAtual();
  const infoSetor = getInfoManejoSetor(setor);
  const manejoExistente = getManejoDaOrdem(ordem, setor);
  const fase = limparTexto(valorLinhaManejo(ordem, "fase")).toUpperCase();
  const faseLateral = setor === "sutia"
    ? limparTexto(valorLinhaManejo(ordem, "faseLateral")).toUpperCase()
    : (manejoExistente?.faseLateral || "");

  if (!fase) {
    toast("Informe a fase antes de salvar.");
    return;
  }

  const silkNome = limparTexto(valorLinhaManejo(ordem, "silkNome")).toUpperCase();
  const silkData = valorLinhaManejo(ordem, "silkData") || "";
  const tecidoNome = limparTexto(valorLinhaManejo(ordem, "tecidoNome")).toUpperCase();
  const necessidadeLinha = normalizarNecessidadeOrdem(valorLinhaManejo(ordem, "necessidade"));
  const periodoNecessidadeLinha = extrairPeriodoNecessidade(necessidadeLinha);

  const manejo = {
    silk: silkNome,
    silkNome,
    silkData,
    tecido: tecidoNome,
    tecidoNome,
    setor,
    setorLabel: infoSetor.label,
    dataTecido: valorLinhaManejo(ordem, "dataTecido") || "",
    fase,
    faseLateral,
    faccao: limparTexto(valorLinhaManejo(ordem, "faccao")).toUpperCase(),
    chegada: valorLinhaManejo(ordem, "chegada") || "",
    falta: Number(valorLinhaManejo(ordem, "falta") || 0),
    celu: limparTexto(valorLinhaManejo(ordem, "celu")),
    necessidade: necessidadeLinha,
    necessidadeTexto: necessidadeLinha,
    coluna: "",
    status: "organizada",
    atualizadoPor: state.currentUser.uid,
    atualizadoEm: serverTimestamp()
  };

  if (!manejoExistente) {
    manejo.criadoPor = state.currentUser.uid;
    manejo.criadoEm = serverTimestamp();
  }

  try {
    const patch = montarPatchManejoSetor(setor, manejo, "organizada", {
      necessidade: necessidadeLinha,
      necessidadeTexto: necessidadeLinha,
      necessidadeManual: true,
      necessidadeInicio: periodoNecessidadeLinha.inicio || "",
      necessidadeFim: periodoNecessidadeLinha.fim || "",
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    });

    await setDoc(doc(db, "ordensProducao", ordem.id), patch, { merge: true });

    await registrarLog(
      manejoExistente ? "manejo_atualizado" : "manejo_criado",
      "ordemProducao",
      ordem.id,
      `OP ${ordem.numeroOP} | Setor ${infoSetor.label} | Ref. ${ordem.referencia} | Fase ${fase}`
    );

    toast(`Manejo ${infoSetor.label} salvo.`);
  } catch (error) {
    console.error(error);

    if (error?.code === "permission-denied") {
      toast("Sem permissão para salvar manejo. Publique novamente as regras do firebase-rules.txt.");
    } else {
      toast(`Erro ao salvar manejo: ${error?.message || "verifique o console"}`);
    }
  }
}

async function biparManejoLinha(ordemId) {
  const ordem = state.ordens.find(op => op.id === ordemId);
  if (!ordem) {
    toast("OP não encontrada.");
    return;
  }

  const setor = getManejoSetorAtual();
  const infoSetor = getInfoManejoSetor(setor);
  const manejoExistente = getManejoDaOrdem(ordem, setor) || {};
  const faseAtual = limparTexto(valorLinhaManejo(ordem, "fase")).toUpperCase() || manejoExistente.fase || "";
  const faseLateralAtual = setor === "sutia"
    ? (limparTexto(valorLinhaManejo(ordem, "faseLateral")).toUpperCase() || manejoExistente.faseLateral || "")
    : (manejoExistente.faseLateral || "");

  if (!faseAtual) {
    const continuar = confirm("Essa OP ainda está sem fase preenchida. Deseja marcar como bipada mesmo assim?");
    if (!continuar) return;
  }

  const confirmar = confirm(`Marcar a OP ${ordem.numeroOP} como BIPADA/finalizada no manejo ${infoSetor.label}?`);
  if (!confirmar) return;

  const silkNome = limparTexto(valorLinhaManejo(ordem, "silkNome")).toUpperCase() || manejoExistente.silkNome || manejoExistente.silk || "";
  const silkData = valorLinhaManejo(ordem, "silkData") || manejoExistente.silkData || "";
  const tecidoNome = limparTexto(valorLinhaManejo(ordem, "tecidoNome")).toUpperCase() || manejoExistente.tecidoNome || manejoExistente.tecido || "";
  const necessidadeLinha = normalizarNecessidadeOrdem(valorLinhaManejo(ordem, "necessidade"));
  const periodoNecessidadeLinha = extrairPeriodoNecessidade(necessidadeLinha);

  const manejo = {
    ...manejoExistente,
    silk: silkNome,
    silkNome,
    silkData,
    tecido: tecidoNome,
    tecidoNome,
    setor,
    setorLabel: infoSetor.label,
    dataTecido: valorLinhaManejo(ordem, "dataTecido") || manejoExistente.dataTecido || "",
    fase: faseAtual,
    faseLateral: faseLateralAtual,
    faccao: limparTexto(valorLinhaManejo(ordem, "faccao")).toUpperCase() || manejoExistente.faccao || "",
    chegada: valorLinhaManejo(ordem, "chegada") || manejoExistente.chegada || "",
    falta: Number(valorLinhaManejo(ordem, "falta") || manejoExistente.falta || 0),
    celu: limparTexto(valorLinhaManejo(ordem, "celu")) || manejoExistente.celu || "",
    necessidade: necessidadeLinha,
    necessidadeTexto: necessidadeLinha,
    coluna: "",
    status: "bipado",
    bipado: true,
    bipadoPor: state.currentUser.uid,
    bipadoEm: serverTimestamp(),
    atualizadoPor: state.currentUser.uid,
    atualizadoEm: serverTimestamp()
  };

  if (!manejoExistente?.criadoEm) {
    manejo.criadoPor = state.currentUser.uid;
    manejo.criadoEm = serverTimestamp();
  }

  try {
    const extras = setor === "bojo"
      ? {
          bipado: true,
          bipadoPor: state.currentUser.uid,
          bipadoEm: serverTimestamp()
        }
      : {};

    const patch = montarPatchManejoSetor(setor, manejo, "bipado", {
      ...extras,
      necessidade: necessidadeLinha,
      necessidadeTexto: necessidadeLinha,
      necessidadeManual: true,
      necessidadeInicio: periodoNecessidadeLinha.inicio || "",
      necessidadeFim: periodoNecessidadeLinha.fim || "",
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    });

    await setDoc(doc(db, "ordensProducao", ordem.id), patch, { merge: true });

    await registrarLog("op_bipada", "ordemProducao", ordem.id, `OP ${ordem.numeroOP} | Setor ${infoSetor.label} | Ref. ${ordem.referencia} | Cor ${ordem.cor || "-"} | Fase ${faseAtual || "-"}`);
    toast(`OP marcada como bipada/finalizada no manejo ${infoSetor.label}.`);
  } catch (error) {
    console.error(error);
    toast("Erro ao marcar OP como bipada.");
  }
}

async function limparManejoLinha(ordemId) {
  if (!ehAdmin()) {
    toast("Apenas admin pode limpar manejo.");
    return;
  }

  const ordem = state.ordens.find(op => op.id === ordemId);
  if (!ordem) return;

  const setor = getManejoSetorAtual();
  const infoSetor = getInfoManejoSetor(setor);
  const manejo = getManejoDaOrdem(ordem, setor);
  if (!manejo) return;

  if (!confirm(`Limpar o manejo ${infoSetor.label} da OP ${ordem.numeroOP}?`)) return;

  try {
    let patch;

    if (setor === "bojo") {
      patch = {
        manejo: null,
        manejoStatus: "pendente",
        bipado: false,
        atualizadoPor: state.currentUser.uid,
        atualizadoEm: serverTimestamp()
      };
    } else {
      patch = {
        manejosSetores: {
          [setor]: null
        },
        manejoStatusSetores: {
          [setor]: "pendente"
        },
        bipadoSetores: {
          [setor]: false
        },
        atualizadoPor: state.currentUser.uid,
        atualizadoEm: serverTimestamp()
      };
    }

    await setDoc(doc(db, "ordensProducao", ordem.id), patch, { merge: true });

    await registrarLog("manejo_excluido", "ordemProducao", ordem.id, `OP ${ordem.numeroOP} | Setor ${infoSetor.label} | Fase ${manejo.fase || "-"}`);
    toast(`Manejo ${infoSetor.label} limpo.`);
  } catch (error) {
    console.error(error);
    toast("Erro ao limpar manejo.");
  }
}

function manejoStatusBadge(manejo, op = null, setor = "bojo") {
  const status = op ? getStatusManejo(op, setor) : (manejo?.bipado || manejo?.status === "bipado" ? "bipado" : manejo ? "organizada" : "pendente");

  if (status === "organizada" || status === "bipado") {
    return `<span class="badge ok">Organizada</span>`;
  }

  return `<span class="badge pending">Pendente</span>`;
}



function carregarListaLocalManejo(chave) {
  try {
    const salvo = JSON.parse(localStorage.getItem(chave) || "[]");
    return Array.isArray(salvo)
      ? salvo.map(item => String(item || "").trim().toUpperCase()).filter(Boolean)
      : [];
  } catch (error) {
    return [];
  }
}

function salvarListaLocalManejo(chave, lista) {
  try {
    localStorage.setItem(chave, JSON.stringify(lista));
  } catch (error) {
    console.warn("Não foi possível salvar sugestões localmente.", error);
  }
}

function carregarSugestoesExtrasManejo() {
  state.fasesManejoExtras = carregarListaLocalManejo("fasesManejoExtras");
  state.fasesLateraisManejoExtras = carregarListaLocalManejo("fasesLateraisManejoExtras");
  state.faccoesManejoExtras = carregarListaLocalManejo("faccoesManejoExtras");
  state.celusManejoExtras = carregarListaLocalManejo("celusManejoExtras");
}

function adicionarSugestaoManejo(ordemId, campo, listaState, chaveStorage, nomeCampo) {
  const ordem = state.ordens.find(op => op.id === ordemId);
  if (!ordem) {
    toast("OP não encontrada.");
    return;
  }

  const valor = limparTexto(valorLinhaManejo(ordem, campo)).toUpperCase();

  if (!valor) {
    toast(`Digite ${nomeCampo} antes de adicionar.`);
    return;
  }

  if (!state[listaState].includes(valor)) {
    state[listaState].push(valor);
    state[listaState].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
    salvarListaLocalManejo(chaveStorage, state[listaState]);
  }

  renderDatalistManejo();
  renderProcessos();
  renderFiltrosColunasManejo();
  toast(`${nomeCampo} "${valor}" adicionada às sugestões.`);
}

function adicionarFaseSugestao(ordemId) {
  adicionarSugestaoManejo(ordemId, "fase", "fasesManejoExtras", "fasesManejoExtras", "Fase Bojo");
}

function adicionarFaseLateralSugestao(ordemId) {
  adicionarSugestaoManejo(ordemId, "faseLateral", "fasesLateraisManejoExtras", "fasesLateraisManejoExtras", "Fase Lateral");
}

function adicionarFaccaoSugestao(ordemId) {
  adicionarSugestaoManejo(ordemId, "faccao", "faccoesManejoExtras", "faccoesManejoExtras", "Facção");
}

function adicionarCeluSugestao(ordemId) {
  adicionarSugestaoManejo(ordemId, "celu", "celusManejoExtras", "celusManejoExtras", "CELU");
}


function getTodosManejosDaOrdem(op) {
  const lista = [];

  if (op?.manejo) lista.push(op.manejo);

  Object.values(op?.manejosSetores || {}).forEach(manejo => {
    if (manejo) lista.push(manejo);
  });

  return lista;
}


function renderDatalistManejo() {
  const fasesList = document.getElementById("manejoFasesList");
  const fasesLateraisList = document.getElementById("manejoFasesLateraisList");
  const faccaoList = document.getElementById("manejoFaccaoList");
  const celuList = document.getElementById("manejoCeluList");
  const silkNomesList = document.getElementById("manejoSilkNomesList");
  const tecidoNomesList = document.getElementById("manejoTecidoNomesList");

  if (fasesList) {
    const fases = new Set();

    state.fasesManejoExtras.forEach(fase => {
      if (fase) fases.add(String(fase).toUpperCase());
    });

    state.ordens.forEach(op => {
      getTodosManejosDaOrdem(op).forEach(manejo => {
        if (manejo?.fase) fases.add(String(manejo.fase).toUpperCase());
      });
    });

    fasesList.innerHTML = [...fases].sort().map(fase => `<option value="${escapeHtml(fase)}"></option>`).join("");
  }

  if (fasesLateraisList) {
    const fasesLaterais = new Set();

    state.fasesLateraisManejoExtras.forEach(fase => {
      if (fase) fasesLaterais.add(String(fase).toUpperCase());
    });

    state.ordens.forEach(op => {
      const manejoSutia = getManejoDaOrdem(op, "sutia");
      if (manejoSutia?.faseLateral) fasesLaterais.add(String(manejoSutia.faseLateral).toUpperCase());
    });

    fasesLateraisList.innerHTML = [...fasesLaterais]
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }))
      .map(fase => `<option value="${escapeHtml(fase)}"></option>`)
      .join("");
  }

  if (faccaoList) {
    const faccoes = new Set();

    getFaccoesUnicas().forEach(faccao => {
      if (faccao?.nome) faccoes.add(nomeFaccaoCanonico(faccao.nome));
    });

    state.faccoesManejoExtras.forEach(faccao => {
      if (faccao) faccoes.add(String(faccao).toUpperCase());
    });

    state.ordens.forEach(op => {
      getTodosManejosDaOrdem(op).forEach(manejo => {
        if (manejo?.faccao) faccoes.add(String(manejo.faccao).toUpperCase());
      });
    });

    faccaoList.innerHTML = [...faccoes].sort().map(faccao => `<option value="${escapeHtml(faccao)}"></option>`).join("");
  }

  if (celuList) {
    const celus = new Set();

    state.celusManejoExtras.forEach(celu => {
      if (celu) celus.add(String(celu).toUpperCase());
    });

    state.ordens.forEach(op => {
      getTodosManejosDaOrdem(op).forEach(manejo => {
        if (manejo?.celu) celus.add(String(manejo.celu).toUpperCase());
      });
    });

    celuList.innerHTML = [...celus].sort().map(celu => `<option value="${escapeHtml(celu)}"></option>`).join("");
  }

  if (silkNomesList) {
    const nomes = new Set();

    state.ordens.forEach(op => {
      getTodosManejosDaOrdem(op).forEach(manejo => {
        const nome = getSilkNomeManejo(manejo);
        if (nome) nomes.add(nome);
      });
    });

    silkNomesList.innerHTML = [...nomes].sort().map(nome => `<option value="${escapeHtml(nome)}"></option>`).join("");
  }

  if (tecidoNomesList) {
    const nomes = new Set();

    state.ordens.forEach(op => {
      getTodosManejosDaOrdem(op).forEach(manejo => {
        const nome = limparTexto(manejo?.tecidoNome || manejo?.tecido || "").toUpperCase();
        if (nome) nomes.add(nome);
      });
    });

    tecidoNomesList.innerHTML = [...nomes].sort().map(nome => `<option value="${escapeHtml(nome)}"></option>`).join("");
  }
}

function renderManejos() {
  renderManejoInline();
}

function editarManejo(id) {
  abrirPagina("manejo");
  const busca = document.getElementById("buscaManejoLinha");
  const op = state.ordens.find(ordem => String(ordem.id) === String(id) || String(ordem.numeroOP) === String(id));

  if (busca && op) {
    busca.value = op.numeroOP || "";
    renderManejoInline();
  }
}

async function excluirManejo(id) {
  await limparManejoLinha(id);
}

function iniciarManejoParaOrdem(ordemId) {
  abrirPagina("manejo");
  const ordem = state.ordens.find(op => op.id === ordemId);
  if (!ordem) return;

  const busca = document.getElementById("buscaManejoLinha");
  if (busca) {
    busca.value = ordem.numeroOP || "";
    renderManejoInline();
  }
}

function filtrarManejosPorOP(numeroOP) {
  abrirPagina("manejo");
  const busca = document.getElementById("buscaManejoLinha");
  if (busca) {
    busca.value = numeroOP;
    renderManejoInline();
  }
}

function formatarDataSimples(valor) {
  if (!valor) return "-";
  const partes = String(valor).split("-");
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return escapeHtml(valor);
}



function configurarProcessos() {
  const busca = document.getElementById("buscaProcessos");
  if (busca) {
    busca.addEventListener("input", renderProcessos);
  }

  [
    "processoFiltroStatus",
    "processoFiltroReferencia",
    "processoFiltroCor",
    "processoFiltroFase",
    "processoFiltroFaccao",
    "processoFiltroCelu",
    "processoFiltroNecessidade"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", renderProcessos);
  });

  const limpar = document.getElementById("btnLimparFiltrosProcessos");
  if (limpar) {
    limpar.addEventListener("click", () => {
      limparFiltrosProcessos();
      renderProcessos();
    });
  }

  const imprimir = document.getElementById("btnImprimirProcessosFiltrados");
  if (imprimir) {
    imprimir.addEventListener("click", imprimirProcessosFiltrados);
  }
}

function preencherSelectProcessos(id, valores, labelTodos = "Todos") {
  const select = document.getElementById(id);
  if (!select) return;

  const atual = select.value;
  const limpos = [...new Set(valores.map(valor => String(valor ?? "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

  select.innerHTML = `<option value="">${labelTodos}</option>` + limpos.map(valor => {
    return `<option value="${escapeHtml(valor)}">${escapeHtml(valor)}</option>`;
  }).join("");

  if (limpos.includes(atual)) select.value = atual;
}

function getMovTimestamp(mov) {
  const valor = mov?.atualizadoEm || mov?.criadoEm || mov?.bipadoEm || mov?.encaminhadoEm;
  if (valor && typeof valor.toDate === "function") return valor.toDate().getTime();
  if (valor instanceof Date) return valor.getTime();
  const data = mov?.dataChegada || mov?.dataEnvio || "";
  const parsed = data ? Date.parse(data) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function getOrdemDaMovimentacao(mov) {
  if (!mov) return null;
  return state.ordens.find(op => op.id === mov.opId || op.numeroOP === mov.numeroOP) || null;
}

function quantidadeRecebidaMovimentacao(mov) {
  const recebida = Number(mov?.quantidadeRecebida || 0);
  if (recebida > 0) return recebida;
  return Math.max(Number(mov?.quantidadeEnviada || 0) - Number(mov?.falta || 0), 0);
}

function getMovimentacoesProcessos() {
  return [...state.movimentacoesProducao].sort((a, b) => {
    const tempo = getMovTimestamp(b) - getMovTimestamp(a);
    if (tempo !== 0) return tempo;
    return String(a.numeroOP || "").localeCompare(String(b.numeroOP || ""), "pt-BR", { numeric: true });
  });
}

function renderFiltrosProcessos() {
  const movimentos = getMovimentacoesProcessos();

  preencherSelectProcessos("processoFiltroReferencia", movimentos.map(mov => mov.referencia), "Todas");
  preencherSelectProcessos("processoFiltroCor", movimentos.map(mov => mov.cor), "Todas");
  preencherSelectProcessos("processoFiltroFase", movimentos.map(mov => mov.processo), "Todas");
  preencherSelectProcessos("processoFiltroFaccao", movimentos.map(mov => mov.destino), "Todas");
  preencherSelectProcessos("processoFiltroCelu", movimentos.map(mov => mov.tipoDestinoLabel || labelTipoMovimento(mov.tipoDestino)), "Todos");
  preencherSelectProcessos("processoFiltroNecessidade", movimentos.map(mov => getNecessidadeDaOrdem(getOrdemDaMovimentacao(mov))), "Todas");
}

function getFiltrosProcessos() {
  return {
    busca: normalizarTexto(document.getElementById("buscaProcessos")?.value || ""),
    status: document.getElementById("processoFiltroStatus")?.value || "",
    referencia: document.getElementById("processoFiltroReferencia")?.value || "",
    cor: document.getElementById("processoFiltroCor")?.value || "",
    processo: document.getElementById("processoFiltroFase")?.value || "",
    destino: document.getElementById("processoFiltroFaccao")?.value || "",
    tipo: document.getElementById("processoFiltroCelu")?.value || "",
    necessidade: document.getElementById("processoFiltroNecessidade")?.value || ""
  };
}

function filtrarOrdensProcessos() {
  const filtros = getFiltrosProcessos();

  return getMovimentacoesProcessos().filter(mov => {
    const ordem = getOrdemDaMovimentacao(mov);
    const status = mov.status || "em_andamento";
    const tipoLabel = mov.tipoDestinoLabel || labelTipoMovimento(mov.tipoDestino);
    const necessidade = getNecessidadeDaOrdem(ordem);

    const texto = normalizarTexto([
      mov.numeroOP,
      mov.referencia,
      mov.cor,
      mov.destino,
      mov.processo,
      tipoLabel,
      mov.quantidadeEnviada,
      mov.quantidadeRecebida,
      mov.falta,
      labelStatusMovimento(status),
      status,
      necessidade
    ].join(" "));

    if (filtros.busca && !texto.includes(filtros.busca)) return false;
    if (filtros.status && status !== filtros.status) return false;
    if (filtros.referencia && String(mov.referencia || "") !== filtros.referencia) return false;
    if (filtros.cor && String(mov.cor || "") !== filtros.cor) return false;
    if (filtros.processo && String(mov.processo || "") !== filtros.processo) return false;
    if (filtros.destino && String(mov.destino || "") !== filtros.destino) return false;
    if (filtros.tipo && String(tipoLabel || "") !== filtros.tipo) return false;
    if (filtros.necessidade && String(necessidade || "") !== filtros.necessidade) return false;

    return true;
  });
}

function limparFiltrosProcessos() {
  [
    "buscaProcessos",
    "processoFiltroStatus",
    "processoFiltroReferencia",
    "processoFiltroCor",
    "processoFiltroFase",
    "processoFiltroFaccao",
    "processoFiltroCelu",
    "processoFiltroNecessidade"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

function renderResumoProcessos(movimentos) {
  const totalEtapas = movimentos.length;
  const totalPecas = movimentos.reduce((soma, mov) => soma + Number(mov.quantidadeEnviada || 0), 0);
  const totalFalta = movimentos.reduce((soma, mov) => soma + Number(mov.falta || 0), 0);
  const emAndamento = movimentos.filter(mov => mov.status === "em_andamento" || !mov.status).length;
  const bipadas = movimentos.filter(mov => mov.status === "finalizado").length;
  const encaminhadas = movimentos.filter(mov => mov.status === "encaminhado").length;

  const setText = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
  };

  setText("processosTotalOps", totalEtapas.toLocaleString("pt-BR"));
  setText("processosTotalPecas", totalPecas.toLocaleString("pt-BR"));
  setText("processosTotalFalta", totalFalta.toLocaleString("pt-BR"));
  setText("processosOrganizadas", emAndamento.toLocaleString("pt-BR"));
  setText("processosBipadas", bipadas.toLocaleString("pt-BR"));
  setText("processosPendentes", encaminhadas.toLocaleString("pt-BR"));
}

function getTextoFiltrosProcessosAtivos() {
  const filtros = [
    ["Status", "processoFiltroStatus"],
    ["Referência", "processoFiltroReferencia"],
    ["Cor", "processoFiltroCor"],
    ["Processo", "processoFiltroFase"],
    ["Destino", "processoFiltroFaccao"],
    ["Tipo", "processoFiltroCelu"],
    ["Necessidade", "processoFiltroNecessidade"]
  ];

  const busca = document.getElementById("buscaProcessos")?.value?.trim();
  const ativos = filtros.map(([nome, id]) => {
    const el = document.getElementById(id);
    if (!el || !el.value) return "";
    const texto = el.options?.[el.selectedIndex]?.textContent || el.value;
    return `${nome}: ${texto}`;
  }).filter(Boolean);

  if (busca) ativos.unshift(`Busca: ${busca}`);

  return ativos.length ? `Filtro: ${ativos.join(" + ")}` : "Filtro: todas as movimentações";
}

function imprimirProcessosFiltrados() {
  const movimentos = filtrarOrdensProcessos();

  if (!movimentos.length) {
    toast("Nenhum processo filtrado para imprimir.");
    return;
  }

  const totalPecas = movimentos.reduce((soma, mov) => soma + Number(mov.quantidadeEnviada || 0), 0);
  const totalFalta = movimentos.reduce((soma, mov) => soma + Number(mov.falta || 0), 0);
  const filtroAtivo = getTextoFiltrosProcessosAtivos();
  const dataImpressao = new Date().toLocaleString("pt-BR");

  const linhasTabela = movimentos.map(mov => {
    const tipoLabel = mov.tipoDestinoLabel || labelTipoMovimento(mov.tipoDestino);
    return `
      <tr>
        <td>${escapeHtml(mov.numeroOP || "-")}</td>
        <td>${escapeHtml(mov.referencia || "-")}</td>
        <td>${escapeHtml(mov.cor || "-")}</td>
        <td class="num">${escapeHtml(Number(mov.quantidadeEnviada || 0).toLocaleString("pt-BR"))}</td>
        <td>${escapeHtml(tipoLabel)}</td>
        <td>${escapeHtml(mov.destino || "-")}</td>
        <td>${escapeHtml(mov.processo || "-")}</td>
        <td>${escapeHtml(dataISOParaBR(mov.dataEnvio) || mov.dataEnvio || "-")}</td>
        <td>${escapeHtml(dataISOParaBR(mov.dataChegada) || mov.dataChegada || "-")}</td>
        <td class="num">${escapeHtml(Number(mov.falta || 0).toLocaleString("pt-BR"))}</td>
        <td class="num">${escapeHtml(quantidadeRecebidaMovimentacao(mov).toLocaleString("pt-BR"))}</td>
        <td>${escapeHtml(mov.movimentacaoOrigemId ? "Reenvio" : "Manejo")}</td>
        <td>${escapeHtml(labelStatusMovimento(mov.status))}</td>
      </tr>
    `;
  }).join("");

  const htmlImpressao = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Impressão Processos</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 18px; font-size: 11px; }
          .print-header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; }
          h1 { margin: 0 0 4px; font-size: 20px; }
          .muted { color: #475569; font-size: 11px; }
          .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
          .summary div { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; }
          .summary span { display: block; color: #475569; font-size: 10px; }
          .summary strong { display: block; font-size: 15px; margin-top: 3px; }
          .filter-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; margin-bottom: 12px; background: #f8fafc; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #cbd5e1; padding: 5px; }
          th { background: #eef2ff; text-align: left; }
          .num { text-align: right; font-weight: bold; }
          @page { size: landscape; margin: 8mm; }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div>
            <h1>Processos / Movimentações</h1>
            <div class="muted">Sistema OP Confecção</div>
          </div>
          <div class="muted">Impresso em:<br><strong>${escapeHtml(dataImpressao)}</strong></div>
        </div>

        <div class="filter-box">${escapeHtml(filtroAtivo)}</div>

        <div class="summary">
          <div><span>Etapas</span><strong>${movimentos.length.toLocaleString("pt-BR")}</strong></div>
          <div><span>Peças enviadas</span><strong>${totalPecas.toLocaleString("pt-BR")}</strong></div>
          <div><span>Falta</span><strong>${totalFalta.toLocaleString("pt-BR")}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>OP</th><th>REF</th><th>Cor</th><th>Qtd</th><th>Etapa</th><th>Destino</th><th>Processo</th>
              <th>Envio</th><th>Chegada</th><th>Falta</th><th>Recebida</th><th>Origem</th><th>Status</th>
            </tr>
          </thead>
          <tbody>${linhasTabela}</tbody>
        </table>

        <script>
          window.addEventListener("load", () => {
            window.focus();
            window.print();
          });
        </script>
      </body>
    </html>
  `;

  const janela = window.open("", "_blank");
  if (!janela) {
    toast("O navegador bloqueou a impressão. Permita pop-ups para este site.");
    return;
  }

  janela.document.open();
  janela.document.write(htmlImpressao);
  janela.document.close();
}

function renderProcessos() {
  const tbody = document.getElementById("listaProcessos");
  if (!tbody) return;

  renderFiltrosProcessos();

  const movimentosFiltrados = filtrarOrdensProcessos();
  const chaveRender = "processos";
  const movimentos = limitarItensRenderTabela(chaveRender, movimentosFiltrados);
  renderResumoProcessos(movimentosFiltrados);

  if (!movimentosFiltrados.length) {
    tbody.innerHTML = `<tr><td colspan="13" class="empty">Nenhuma movimentação encontrada com os filtros selecionados.</td></tr>`;
    limparControleRenderTabela(chaveRender);
    return;
  }

  tbody.innerHTML = movimentos.map(mov => {
    const tipoLabel = mov.tipoDestinoLabel || labelTipoMovimento(mov.tipoDestino);
    const status = mov.status || "em_andamento";

    return `
      <tr class="processo-mov-row processo-status-${escapeHtml(status)}">
        <td><strong>${escapeHtml(mov.numeroOP || "-")}</strong></td>
        <td>${escapeHtml(mov.referencia || "-")}</td>
        <td><strong>${escapeHtml(mov.cor || "-")}</strong></td>
        <td class="num">${escapeHtml(Number(mov.quantidadeEnviada || 0).toLocaleString("pt-BR"))}</td>
        <td>${escapeHtml(tipoLabel)}</td>
        <td><strong>${escapeHtml(mov.destino || "-")}</strong></td>
        <td>${escapeHtml(mov.processo || "-")}</td>
        <td>${escapeHtml(dataISOParaBR(mov.dataEnvio) || mov.dataEnvio || "-")}</td>
        <td>${escapeHtml(dataISOParaBR(mov.dataChegada) || mov.dataChegada || "-")}</td>
        <td class="num">${escapeHtml(Number(mov.falta || 0).toLocaleString("pt-BR"))}</td>
        <td class="num">${escapeHtml(quantidadeRecebidaMovimentacao(mov).toLocaleString("pt-BR"))}</td>
        <td>${escapeHtml(mov.movimentacaoOrigemId ? "Reenvio" : "Manejo")}</td>
        <td><span class="badge ${classeStatusMovimento(status)}">${escapeHtml(labelStatusMovimento(status))}</span></td>
      </tr>
    `;
  }).join("");
  renderControleRenderTabela(tbody, chaveRender, movimentosFiltrados.length, movimentos.length, "movimentações");
}


function configurarFaccoes() {
  const form = document.getElementById("formFaccao");
  if (form) {
    form.addEventListener("submit", salvarFaccao);
  }

  const busca = document.getElementById("buscaFaccao");
  if (busca) {
    busca.addEventListener("input", renderFaccoes);
  }

  const buscaMovimentacoes = document.getElementById("buscaFaccaoMovimentacoes");
  if (buscaMovimentacoes) {
    buscaMovimentacoes.addEventListener("input", renderFaccoesMovimentacoes);
  }

  [
    "faccaoMovFiltroNome",
    "faccaoMovFiltroProcesso",
    "faccaoMovFiltroStatus",
    "faccaoMovFiltroDataTipo",
    "faccaoMovFiltroDataInicio",
    "faccaoMovFiltroDataFim"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", renderFaccoesMovimentacoes);
  });

  const limparFiltrosFaccaoMov = document.getElementById("btnLimparFiltrosFaccaoMovimentacoes");
  if (limparFiltrosFaccaoMov) {
    limparFiltrosFaccaoMov.addEventListener("click", () => {
      limparFiltrosFaccoesMovimentacoes();
      renderFaccoesMovimentacoes();
    });
  }

  const toggleGerenciar = document.getElementById("btnToggleGerenciarFaccoes");
  if (toggleGerenciar) {
    toggleGerenciar.addEventListener("click", () => {
      const painel = document.getElementById("painelGerenciarFaccoes");
      if (!painel) return;

      const abrindo = painel.classList.contains("hidden");
      painel.classList.toggle("hidden");
      toggleGerenciar.textContent = abrindo ? "Ocultar gerenciamento" : "Gerenciar facções";
    });
  }

  const abrirCadastro = document.getElementById("btnAbrirCadastroFaccao");
  if (abrirCadastro) {
    abrirCadastro.addEventListener("click", () => {
      const painel = document.getElementById("painelGerenciarFaccoes");
      const formFaccao = document.getElementById("formFaccao");

      if (painel) painel.classList.remove("hidden");

      if (formFaccao) {
        formFaccao.classList.remove("hidden");
        document.getElementById("faccaoNome")?.focus();
      }
    });
  }

  const cancelar = document.getElementById("btnCancelarFaccao");
  if (cancelar) {
    cancelar.addEventListener("click", limparFormFaccao);
  }

  const importarFaccoes = document.getElementById("btnImportarFaccoesExtraidas");
  if (importarFaccoes) {
    importarFaccoes.addEventListener("click", importarFaccoesExtraidasPlanilha);
  }

  const organizarDuplicadas = document.getElementById("btnOrganizarFaccoesDuplicadas");
  if (organizarDuplicadas) {
    organizarDuplicadas.addEventListener("click", organizarFaccoesDuplicadas);
  }

  const importarLigia = document.getElementById("btnImportarLigiaNovaLogica");
  if (importarLigia) {
    importarLigia.addEventListener("click", importarLigiaNovaLogica);
  }

  const conferenciaSeguraLigia = document.getElementById("btnConferenciaSeguraLigia");
  if (conferenciaSeguraLigia) {
    conferenciaSeguraLigia.addEventListener("click", mostrarConferenciaSeguraLigia);
  }

  const resumoLigia = document.getElementById("btnResumoLigiaNovaLogica");
  if (resumoLigia) {
    resumoLigia.addEventListener("click", mostrarResumoLigiaNovaLogica);
  }

  configurarModalAjusteMigracao();
}

function limparFormFaccao() {
  const form = document.getElementById("formFaccao");
  if (form) {
    form.reset();
    form.classList.add("hidden");
  }

  const id = document.getElementById("faccaoId");
  if (id) id.value = "";
}

async function salvarFaccao(event) {
  event.preventDefault();

  if (!ehAdmin()) {
    toast("Apenas admin pode salvar facções.");
    return;
  }

  const idAtual = document.getElementById("faccaoId").value;
  const nome = limparTexto(document.getElementById("faccaoNome").value).toUpperCase();
  const cidade = limparTexto(document.getElementById("faccaoCidade").value).toUpperCase();
  const chavePix = document.getElementById("faccaoPix").value.trim();
  const celular = document.getElementById("faccaoCelular").value.trim();
  const observacoes = document.getElementById("faccaoObs").value.trim();

  if (!nome || !cidade) {
    toast("Informe nome da facção e cidade.");
    return;
  }

  const dados = {
    nome,
    cidade,
    chavePix,
    celular,
    observacoes,
    ativo: true,
    cadastroPendente: false,
    statusImportacao: "ok",
    pendenciaImportacao: "",
    atualizadoPor: state.currentUser.uid,
    atualizadoEm: serverTimestamp()
  };

  if (!idAtual) {
    dados.criadoPor = state.currentUser.uid;
    dados.criadoEm = serverTimestamp();
  }

  try {
    const docId = idAtual || docIdSeguro(nome);
    await setDoc(doc(db, "faccoes", docId), dados, { merge: true });

    await registrarLog(
      idAtual ? "faccao_atualizada" : "faccao_criada",
      "faccao",
      docId,
      `${nome} | ${cidade} | ${celular || "sem celular"}`
    );

    limparFormFaccao();
    toast("Facção salva com sucesso.");
  } catch (error) {
    console.error(error);
    toast("Erro ao salvar facção.");
  }
}

async function organizarFaccoesDuplicadas() {
  if (!ehAdmin()) {
    toast("Apenas admin pode organizar facções duplicadas.");
    return;
  }

  const grupos = new Map();
  (state.faccoes || []).forEach(faccao => {
    if (!faccao?.nome) return;
    if (faccao.statusImportacao === "duplicada_consolidada" || faccao.duplicadaDe) return;
    const chave = chaveFaccaoCanonica(faccao.nome);
    if (!chave) return;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(faccao);
  });

  const duplicadas = [...grupos.values()].filter(grupo => grupo.length > 1);

  if (!duplicadas.length) {
    toast("Nenhuma facção duplicada encontrada. A lista visual já está unificada.");
    return;
  }

  const totalDuplicadas = duplicadas.reduce((soma, grupo) => soma + grupo.length - 1, 0);
  if (!confirm(`Encontramos ${totalDuplicadas} cadastro(s) duplicado(s). Vou manter um cadastro principal ativo e marcar os repetidos como duplicados/inativos. Continuar?`)) {
    return;
  }

  try {
    let batch = writeBatch(db);
    let contador = 0;
    let gruposCorrigidos = 0;

    for (const grupo of duplicadas) {
      const ordenado = [...grupo].sort((a, b) => scoreFaccaoParaUnificar(b) - scoreFaccaoParaUnificar(a));
      const principal = ordenado[0];
      const nomePrincipal = nomeFaccaoCanonico(principal.nome);
      const principalId = principal.id || docIdSeguro(nomePrincipal);
      const consolidado = ordenado.reduce((acc, item) => mergeFaccoesCadastro(acc, item), principal);
      const processosPermitidos = listaUnicaNormalizada([
        ...(consolidado.processosPermitidos || []),
        ...getProcessosPadraoDaFaccao(nomePrincipal)
      ].map(normalizarNomeProcesso));

      batch.set(doc(db, "faccoes", principalId), {
        ...consolidado,
        nome: nomePrincipal,
        processosPermitidos,
        ativo: true,
        cadastroPendente: false,
        statusImportacao: "ok",
        pendenciaImportacao: "",
        consolidadoDuplicadas: true,
        quantidadeDuplicadasConsolidadas: grupo.length - 1,
        atualizadoPor: state.currentUser.uid,
        atualizadoEm: serverTimestamp()
      }, { merge: true });
      contador++;

      for (const duplicada of ordenado.slice(1)) {
        if (!duplicada.id || duplicada.id === principalId) continue;
        batch.set(doc(db, "faccoes", duplicada.id), {
          ativo: false,
          cadastroPendente: true,
          statusImportacao: "duplicada_consolidada",
          pendenciaImportacao: `Cadastro duplicado consolidado em ${nomePrincipal}`,
          duplicadaDe: principalId,
          duplicadaDeNome: nomePrincipal,
          atualizadoPor: state.currentUser.uid,
          atualizadoEm: serverTimestamp()
        }, { merge: true });
        contador++;
      }

      gruposCorrigidos++;
      if (contador >= 430) {
        await batch.commit();
        batch = writeBatch(db);
        contador = 0;
      }
    }

    if (contador > 0) await batch.commit();

    await registrarLog("faccoes_duplicadas_consolidadas", "faccao", "duplicadas", `${gruposCorrigidos} grupos corrigidos | ${totalDuplicadas} duplicadas marcadas`);
    renderFaccoes();
    renderFaccoesPendentes();
    renderDatalistManejo();
    toast(`${gruposCorrigidos} grupo(s) de facções duplicadas organizado(s).`);
  } catch (error) {
    console.error(error);
    toast("Erro ao organizar facções duplicadas.");
  }
}


function renderFaccoes() {
  const tbody = document.getElementById("listaFaccoes");
  if (!tbody) return;

  const busca = normalizarTexto(document.getElementById("buscaFaccao")?.value || "");
  let faccoes = getFaccoesUnicas().filter(faccao => !faccao.cadastroPendente && faccao.ativo !== false);

  if (busca) {
    faccoes = faccoes.filter(faccao => {
      const texto = normalizarTexto([
        faccao.nome,
        faccao.cidade,
        faccao.chavePix,
        faccao.celular,
        faccao.observacoes,
        faccao.origemImportacao,
        faccao.titularPix
      ].join(" "));
      return texto.includes(busca);
    });
  }

  const faccoesFiltradas = faccoes;
  const chaveRender = "faccoes-cadastro";
  faccoes = limitarItensRenderTabela(chaveRender, faccoesFiltradas);

  if (!faccoesFiltradas.length) {
    tbody.innerHTML = `<tr><td colspan="${ehAdmin() ? 6 : 5}" class="empty">Nenhuma facção cadastrada.</td></tr>`;
    limparControleRenderTabela(chaveRender);
    return;
  }

  tbody.innerHTML = faccoes.map(faccao => `
    <tr>
      <td><strong>${escapeHtml(faccao.nome || "-")}</strong></td>
      <td>${escapeHtml(faccao.cidade || "-")}</td>
      <td>${escapeHtml(faccao.chavePix || "-")}</td>
      <td>${escapeHtml(faccao.celular || "-")}</td>
      <td>
        <span class="status-dot ${faccao.ativo !== false ? "active" : "inactive"}">
          ${faccao.ativo !== false ? "Ativa" : "Inativa"}
        </span>
      </td>
      ${ehAdmin() ? `<td class="admin-only-cell">
        <button class="btn btn-sm" onclick="editarFaccao('${faccao.id}')">Editar</button>
        <button class="btn btn-sm ${faccao.ativo !== false ? "btn-warning" : "btn-success"}" onclick="alternarFaccao('${faccao.id}')">
          ${faccao.ativo !== false ? "Inativar" : "Ativar"}
        </button>
        <button class="btn btn-sm btn-danger" onclick="excluirFaccao('${faccao.id}')">Excluir</button>
      </td>` : ""}
    </tr>
  `).join("");
  renderControleRenderTabela(tbody, chaveRender, faccoesFiltradas.length, faccoes.length, "facções");
}

function renderFaccoesPendentes() {
  const tbody = document.getElementById("listaFaccoesPendentes");
  if (!tbody) return;

  const pendentes = getFaccoesUnicas({ incluirPendentes: true, somentePendentes: true })
    .filter(faccao => faccao.statusImportacao !== "duplicada_consolidada" && !faccao.duplicadaDe)
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { numeric: true }));

  if (!pendentes.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Nenhuma facção pendente. Tudo pronto.</td></tr>`;
    return;
  }

  tbody.innerHTML = pendentes.map(faccao => `
    <tr class="faccao-pendente-row">
      <td><strong>${escapeHtml(faccao.nome || "-")}</strong></td>
      <td>${escapeHtml(faccao.cidade || "-")}</td>
      <td>${escapeHtml(faccao.chavePix || "-")}</td>
      <td>
        <span class="badge pending">${escapeHtml(faccao.pendenciaImportacao || "Revisar dados")}</span>
      </td>
      <td>${escapeHtml(faccao.origemImportacao || "-")}</td>
      <td class="admin-only-cell">
        <button class="btn btn-sm btn-primary" onclick="editarFaccao('${faccao.id}')">Editar / completar</button>
        <button class="btn btn-sm btn-danger" onclick="excluirFaccao('${faccao.id}')">Excluir</button>
      </td>
    </tr>
  `).join("");
}



async function carregarDadosLigiaNovaLogica() {
  const resposta = await fetch(LIGIA_MIGRACAO_DADOS_URL, { cache: "no-store" });
  if (!resposta.ok) throw new Error("Não foi possível carregar dados-ligia-migracao.json");
  return await resposta.json();
}

async function mostrarResumoLigiaNovaLogica() {
  const box = document.getElementById("resumoLigiaNovaLogica");
  if (!box) return;

  try {
    const dados = await carregarDadosLigiaNovaLogica();
    const resumo = dados.resumo || {};
    box.classList.remove("hidden");
    box.innerHTML = `
      <strong>Resumo da migração Lígia</strong><br>
      OPs: ${Number(dados.meta?.totalOPs || 0).toLocaleString("pt-BR")}<br>
      Movimentações ativas: ${Number(resumo.movimentacoes || 0).toLocaleString("pt-BR")}<br>
      Relatórios separados: ${Number(resumo.relatoriosSeparados || 0).toLocaleString("pt-BR")}<br>
      Referências únicas: ${Number(resumo.produtos || 0).toLocaleString("pt-BR")} <small>(referências únicas; isso não é limite de OP)</small><br>
      Facções: ${Number(resumo.faccoes || 0).toLocaleString("pt-BR")}<br>
      Células: ${Number(resumo.celulas || 0).toLocaleString("pt-BR")}<br>
      Datas incoerentes para conferência: ${Number(resumo.datasIncoerentes || 0).toLocaleString("pt-BR")}<br>
      BOJOS ENCAPADOS: ${Number(resumo.bojosEncapadosPecas || resumo.faseSomas?.["BOJOS ENCAPADOS"] || 0).toLocaleString("pt-BR")} peças<br>
      <br><strong>Importante:</strong> esta versão não importa pagamentos históricos.<br>
      <strong>Conferência:</strong> depois de importar, a tela de Manejo/Ordens deve mostrar ${Number(dados.meta?.totalOPs || 0).toLocaleString("pt-BR")} OPs cadastradas e BOJOS ENCAPADOS = ${Number(resumo.bojosEncapadosPecas || 0).toLocaleString("pt-BR")} peças.<br>
      <strong>Modo seguro:</strong> esta versão NÃO apaga e NÃO sobrescreve OPs já existentes. Ela só adiciona itens faltantes e preserva o que os usuários já lançaram.
    `;
  } catch (error) {
    console.error(error);
    toast("Erro ao carregar o resumo da migração Lígia.");
  }
}

function prepararDocumentoImportacaoLigia(item) {
  const copia = { ...item };
  delete copia.id;
  copia.importadoLigiaNovaLogica = true;
  copia.modoImportacaoLigia = "seguro_sem_sobrescrever";
  copia.atualizadoPor = state.currentUser.uid;
  copia.atualizadoEm = serverTimestamp();
  if (!copia.criadoPor) copia.criadoPor = state.currentUser.uid;
  if (!copia.criadoEm) copia.criadoEm = serverTimestamp();
  return copia;
}

function idDocumentoLigia(colecao, item) {
  return item.id || docIdSeguro(
    item.numeroOP ||
    item.numeroOPExterno ||
    item.op ||
    item.nome ||
    item.referencia ||
    item.processo ||
    `${colecao}-${Math.random().toString(36).slice(2)}`
  );
}

function ehDocumentoLigia(data = {}) {
  const origem = String(data.origem || data.origemMigracao || data.origemImportacao || "").toLowerCase();
  return data.importadoLigiaNovaLogica === true || origem.includes("ligia") || origem.includes("lígia") || origem.includes("migracao_ligia");
}

function temUsoDepoisDaMigracao(data = {}) {
  return Boolean(
    data.ajusteManualMigracao ||
    data.migracaoProtegida ||
    data.ultimoMotivoAjusteMigracao ||
    data.ultimaEntregaPagamento ||
    data.ultimoProcessoPagamento ||
    data.totalEntreguePagamento ||
    data.manejosSetores ||
    data.manejo ||
    data.bipado ||
    data.status === "bipado" ||
    data.status === "organizada"
  );
}

async function importarColecaoLigiaSemSobrescrever(colecao, itens, contadorGeral, erros) {
  const lista = Array.isArray(itens) ? itens : [];
  contadorGeral.porColecao[colecao] = contadorGeral.porColecao[colecao] || { novos: 0, preservados: 0, erros: 0 };
  if (!lista.length) return;

  let batch = writeBatch(db);
  let batchCount = 0;

  for (const item of lista) {
    const id = idDocumentoLigia(colecao, item);
    const ref = doc(db, colecao, id);

    try {
      const existente = await getDoc(ref);
      if (existente.exists()) {
        contadorGeral.preservados++;
        contadorGeral.porColecao[colecao].preservados++;
        continue;
      }

      batch.set(ref, prepararDocumentoImportacaoLigia(item), { merge: true });
      contadorGeral.total++;
      contadorGeral.novos++;
      contadorGeral.porColecao[colecao].novos++;
      batchCount++;

      if (batchCount >= 420) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    } catch (error) {
      console.error(`Erro ao importar ${colecao}/${id}.`, error);
      erros.push({ colecao, id, mensagem: error?.message || "Erro desconhecido" });
      contadorGeral.erros++;
      contadorGeral.porColecao[colecao].erros++;
    }
  }

  if (batchCount > 0) await batch.commit();
}

async function contarDocumentosColecao(nomeColecao) {
  try {
    const snap = await getCountFromServer(collection(db, nomeColecao));
    return Number(snap.data().count || 0);
  } catch (error) {
    console.warn(`Não foi possível contar ${nomeColecao}.`, error);
    return null;
  }
}

async function verificarTotaisImportacaoLigia(dados) {
  const [ordens, produtos, movimentos, relatorios] = await Promise.all([
    contarDocumentosColecao("ordensProducao"),
    contarDocumentosColecao("produtos"),
    contarDocumentosColecao("movimentacoesProducao"),
    contarDocumentosColecao("relatoriosMigracaoLigia")
  ]);

  return {
    ordens,
    produtos,
    movimentos,
    relatorios,
    esperadoOrdens: Number((dados.ordensProducao || []).length || 0),
    esperadoProdutos: Number((dados.produtos || []).length || 0),
    esperadoMovimentos: Number((dados.movimentacoesProducao || []).length || 0),
    esperadoRelatorios: Number((dados.relatoriosMigracaoLigia || []).length || 0)
  };
}

function textoValidacaoImportacaoLigia(validacao) {
  if (!validacao) return "";

  const linhas = [
    `OPs no Firestore: ${Number(validacao.ordens || 0).toLocaleString("pt-BR")} | Base Lígia atual: ${validacao.esperadoOrdens.toLocaleString("pt-BR")}`,
    `Referências únicas no Firestore: ${Number(validacao.produtos || 0).toLocaleString("pt-BR")} | Base Lígia atual: ${validacao.esperadoProdutos.toLocaleString("pt-BR")}`,
    `Movimentações no Firestore: ${Number(validacao.movimentos || 0).toLocaleString("pt-BR")} | Base Lígia atual: ${validacao.esperadoMovimentos.toLocaleString("pt-BR")}`,
    `Relatórios separados no Firestore: ${Number(validacao.relatorios || 0).toLocaleString("pt-BR")} | Base Lígia atual: ${validacao.esperadoRelatorios.toLocaleString("pt-BR")}`
  ];

  return linhas.join("\n");
}

async function gerarConferenciaSeguraLigia(dados) {
  const baseOps = Array.isArray(dados?.ordensProducao) ? dados.ordensProducao : [];
  const idsBase = new Set(baseOps.map(item => idDocumentoLigia("ordensProducao", item)));
  const snap = await getDocs(collection(db, "ordensProducao"));

  const resultado = {
    baseOps: baseOps.length,
    sistemaOps: snap.size,
    novosParaAdicionar: 0,
    existentesPreservados: 0,
    foraDaPlanilhaAtual: 0,
    ligiaAntigaForaDaPlanilha: 0,
    criadosNoSistema: 0,
    protegidosPorUso: 0,
    exemplosNovos: [],
    exemplosForaDaPlanilha: [],
    exemplosProtegidos: [],
    bojosEncapadosPecas: Number(dados?.resumo?.bojosEncapadosPecas || dados?.resumo?.faseSomas?.["BOJOS ENCAPADOS"] || 0)
  };

  const idsSistema = new Set();
  snap.forEach(documento => {
    idsSistema.add(documento.id);
    const data = documento.data() || {};
    const numeroOP = data.numeroOP || documento.id;

    if (idsBase.has(documento.id)) {
      resultado.existentesPreservados++;
      if (temUsoDepoisDaMigracao(data)) {
        resultado.protegidosPorUso++;
        if (resultado.exemplosProtegidos.length < 8) resultado.exemplosProtegidos.push(numeroOP);
      }
    } else {
      resultado.foraDaPlanilhaAtual++;
      if (ehDocumentoLigia(data)) resultado.ligiaAntigaForaDaPlanilha++;
      else resultado.criadosNoSistema++;
      if (resultado.exemplosForaDaPlanilha.length < 8) resultado.exemplosForaDaPlanilha.push(numeroOP);
    }
  });

  for (const item of baseOps) {
    const id = idDocumentoLigia("ordensProducao", item);
    if (!idsSistema.has(id)) {
      resultado.novosParaAdicionar++;
      if (resultado.exemplosNovos.length < 8) resultado.exemplosNovos.push(item.numeroOP || id);
    }
  }

  return resultado;
}

function montarHtmlConferenciaSeguraLigia(conf, dados) {
  return `
    <strong>Conferência segura antes de importar</strong><br>
    Base atual da Lígia: <strong>${Number(conf.baseOps || 0).toLocaleString("pt-BR")}</strong> OPs<br>
    OPs existentes no sistema agora: <strong>${Number(conf.sistemaOps || 0).toLocaleString("pt-BR")}</strong><br>
    Novas OPs que serão adicionadas: <strong>${Number(conf.novosParaAdicionar || 0).toLocaleString("pt-BR")}</strong><br>
    OPs já existentes que serão preservadas sem sobrescrever: <strong>${Number(conf.existentesPreservados || 0).toLocaleString("pt-BR")}</strong><br>
    OPs já movimentadas/corrigidas no sistema e protegidas: <strong>${Number(conf.protegidosPorUso || 0).toLocaleString("pt-BR")}</strong><br>
    OPs que existem no sistema, mas não estão na planilha atual: <strong>${Number(conf.foraDaPlanilhaAtual || 0).toLocaleString("pt-BR")}</strong><br>
    Dessas, vindas de migração antiga da Lígia: <strong>${Number(conf.ligiaAntigaForaDaPlanilha || 0).toLocaleString("pt-BR")}</strong><br>
    Criadas/lançadas no sistema: <strong>${Number(conf.criadosNoSistema || 0).toLocaleString("pt-BR")}</strong><br>
    BOJOS ENCAPADOS na base atual: <strong>${Number(conf.bojosEncapadosPecas || 0).toLocaleString("pt-BR")}</strong> peças<br>
    <br>
    <strong>Regra de segurança:</strong> nada será apagado e nenhuma OP existente será sobrescrita. O sistema só adiciona o que estiver faltando.<br>
    ${conf.exemplosNovos.length ? `<br>Exemplos de OPs novas: ${conf.exemplosNovos.map(escapeHtml).join(", ")}` : ""}
    ${conf.exemplosForaDaPlanilha.length ? `<br>Exemplos fora da planilha atual: ${conf.exemplosForaDaPlanilha.map(escapeHtml).join(", ")}` : ""}
    ${conf.exemplosProtegidos.length ? `<br>Exemplos protegidos por uso/correção: ${conf.exemplosProtegidos.map(escapeHtml).join(", ")}` : ""}
  `;
}

async function mostrarConferenciaSeguraLigia() {
  const box = document.getElementById("resumoLigiaNovaLogica");
  if (!box) return;
  try {
    box.classList.remove("hidden");
    box.innerHTML = "Conferindo base atual do sistema com a planilha da Lígia...";
    const dados = await carregarDadosLigiaNovaLogica();
    const conferencia = await gerarConferenciaSeguraLigia(dados);
    box.innerHTML = montarHtmlConferenciaSeguraLigia(conferencia, dados);
  } catch (error) {
    console.error(error);
    toast("Erro ao conferir a base da Lígia.");
  }
}

async function importarLigiaNovaLogicaObjeto(dados, origem = "Planilha Lígia") {
  if (!dados || !Array.isArray(dados.ordensProducao)) {
    throw new Error("Arquivo da Lígia inválido: ordensProducao não encontrado.");
  }

  const conferenciaAntes = await gerarConferenciaSeguraLigia(dados);
  const contador = { total: 0, novos: 0, preservados: 0, erros: 0, porColecao: {}, conferenciaAntes };
  const erros = [];

  // MODO PRODUÇÃO SEGURO:
  // Não limpa coleção nenhuma e não sobrescreve documentos existentes.
  // Isso protege lançamentos reais, ajustes manuais, movimentações e dados criados pelos usuários.
  await importarColecaoLigiaSemSobrescrever("ordensProducao", dados.ordensProducao || [], contador, erros);
  await importarColecaoLigiaSemSobrescrever("produtos", dados.produtos || [], contador, erros);
  await importarColecaoLigiaSemSobrescrever("faccoes", dados.faccoes || [], contador, erros);
  await importarColecaoLigiaSemSobrescrever("celulas", dados.celulas || [], contador, erros);
  await importarColecaoLigiaSemSobrescrever("movimentacoesProducao", dados.movimentacoesProducao || [], contador, erros);
  await importarColecaoLigiaSemSobrescrever("relatoriosMigracaoLigia", dados.relatoriosMigracaoLigia || [], contador, erros);
  await importarColecaoLigiaSemSobrescrever("datasIncoerentesLigia", dados.datasIncoerentes || [], contador, erros);
  await importarColecaoLigiaSemSobrescrever("processosMigracao", dados.processos || [], contador, erros);

  const validacao = await verificarTotaisImportacaoLigia(dados);

  try {
    await setDoc(doc(db, "configuracoes", "migracaoLigiaNovaLogica"), {
      ...dados.meta,
      resumo: dados.resumo || {},
      regrasAplicadas: dados.regrasAplicadas || [],
      origemImportacao: origem,
      modoImportacao: "seguro_sem_apagar_sem_sobrescrever",
      totalDocumentosNovos: contador.novos,
      documentosPreservados: contador.preservados,
      porColecao: contador.porColecao,
      conferenciaAntes,
      validacaoDepois: validacao,
      errosImportacao: erros,
      importadoPor: state.currentUser.uid,
      importadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn("Não foi possível salvar configuração da migração.", error);
    erros.push({ colecao: "configuracoes/migracaoLigiaNovaLogica", mensagem: error?.message || "Erro desconhecido" });
  }

  try {
    await registrarLog(
      "migracao_ligia_modo_seguro",
      "importacao",
      origem,
      `${contador.novos} documentos novos. ${contador.preservados} preservados. Nada apagado. OPs base: ${(dados.ordensProducao || []).length}. Erros: ${erros.length}.`
    );
  } catch (error) {
    console.warn("Não foi possível registrar log da migração.", error);
  }

  return { contador, validacao, erros };
}

async function importarLigiaNovaLogica() {
  if (!ehAdmin()) {
    toast("Apenas admin pode importar a migração da Lígia.");
    return;
  }

  try {
    const dados = await carregarDadosLigiaNovaLogica();
    const conferencia = await gerarConferenciaSeguraLigia(dados);
    const mensagem = [
      "ATUALIZAÇÃO SEGURA DA LÍGIA",
      "",
      `Base atual da planilha: ${Number(conferencia.baseOps || 0).toLocaleString("pt-BR")} OPs`,
      `Novas OPs que serão adicionadas: ${Number(conferencia.novosParaAdicionar || 0).toLocaleString("pt-BR")}`,
      `OPs já existentes preservadas: ${Number(conferencia.existentesPreservados || 0).toLocaleString("pt-BR")}`,
      `OPs protegidas por uso/correção: ${Number(conferencia.protegidosPorUso || 0).toLocaleString("pt-BR")}`,
      `OPs fora da planilha atual que NÃO serão apagadas: ${Number(conferencia.foraDaPlanilhaAtual || 0).toLocaleString("pt-BR")}`,
      "",
      "Nada será apagado e nenhuma OP existente será sobrescrita.",
      "Antes de confirmar, baixe o backup atual caso ainda não tenha feito."
    ].join("\n");

    const confirmar = confirm(mensagem);
    if (!confirmar) return;

    const resultado = await importarLigiaNovaLogicaObjeto(dados, "Atualização segura da Lígia");
    const validacaoTexto = textoValidacaoImportacaoLigia(resultado.validacao);

    const avisoErros = resultado.erros?.length ? " Algumas coleções falharam: publique novamente o firebase-rules.txt." : "";
    toast(`Atualização segura concluída. Novos: ${Number(resultado.contador?.novos || 0).toLocaleString("pt-BR")}. Preservados: ${Number(resultado.contador?.preservados || 0).toLocaleString("pt-BR")}.${avisoErros}`);
    if (validacaoTexto) console.info("Validação da importação Lígia:\n" + validacaoTexto);
    mostrarConferenciaSeguraLigia();
  } catch (error) {
    console.error(error);
    toast("Erro ao atualizar a migração da Lígia. Confira o console para detalhes.");
  }
}

function getMenuAcoesManejoGlobal() {
  let menu = document.getElementById("menu-acoes-manejo-global");

  if (!menu) {
    menu = document.createElement("div");
    menu.id = "menu-acoes-manejo-global";
    menu.className = "action-menu action-menu-floating";
    document.body.appendChild(menu);
  }

  return menu;
}

function montarMenuAcoesManejoHtml(ordemId) {
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

function posicionarMenuAcoesManejo(menu, botao) {
  if (!menu || !botao) return;

  const largura = Math.min(300, Math.max(250, window.innerWidth - 16));
  menu.style.width = `${largura}px`;
  menu.style.right = "auto";
  menu.style.bottom = "auto";

  const rect = botao.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - largura - 8, rect.right - largura));
  menu.style.left = `${left}px`;

  const alturaMenu = menu.offsetHeight || 260;
  const topPreferido = rect.top - alturaMenu - 8;
  const topSeguro = Math.max(8, topPreferido);
  menu.style.top = `${topSeguro}px`;
}

function toggleMenuAcoesManejo(event, ordemId) {
  event?.stopPropagation?.();
  const menu = getMenuAcoesManejoGlobal();
  const botao = event?.currentTarget || event?.target;
  const mesmoMenuAberto = menu.classList.contains("open") && menu.dataset.ordemId === String(ordemId);

  fecharMenusAcoesManejo();

  if (mesmoMenuAberto) return;

  menu.dataset.ordemId = String(ordemId);
  menu.innerHTML = montarMenuAcoesManejoHtml(ordemId);
  menu.classList.add("open");
  posicionarMenuAcoesManejo(menu, botao);
}

function fecharMenusAcoesManejo() {
  document.querySelectorAll(".action-menu.open").forEach(menu => {
    menu.classList.remove("open");
    menu.removeAttribute("style");
    if (menu.id === "menu-acoes-manejo-global") {
      menu.removeAttribute("data-ordem-id");
    }
  });
}

document.addEventListener("click", event => {
  if (!event.target.closest(".action-menu-wrap") && !event.target.closest(".action-menu")) fecharMenusAcoesManejo();
});

window.addEventListener("resize", fecharMenusAcoesManejo);
window.addEventListener("scroll", fecharMenusAcoesManejo, true);

async function abrirRastreamentoOP(ordemId) {
  const ordem = state.ordens.find(op => String(op.id) === String(ordemId) || String(op.numeroOP) === String(ordemId));
  if (!ordem) return;
  carregarMovimentacoesSeNecessario();
  abrirPagina("rastreamento");
  const busca = document.getElementById("buscaRastreamento");
  if (busca) {
    busca.value = ordem.numeroOP || ordem.referencia || "";
    busca.dispatchEvent(new Event("input"));
  }
}

function configurarModalAjusteMigracao() {
  document.getElementById("btnFecharModalAjusteMigracao")?.addEventListener("click", fecharModalAjusteMigracao);
  document.getElementById("btnCancelarModalAjusteMigracao")?.addEventListener("click", fecharModalAjusteMigracao);
  document.getElementById("formAjusteMigracao")?.addEventListener("submit", salvarAjusteMigracao);

  const modal = document.getElementById("modalAjusteMigracao");
  modal?.addEventListener("click", event => {
    if (event.target === modal) fecharModalAjusteMigracao();
  });
}

function abrirModalAjusteMigracao(ordemId) {
  fecharMenusAcoesManejo();
  const ordem = state.ordens.find(op => String(op.id) === String(ordemId) || String(op.numeroOP) === String(ordemId));
  if (!ordem) {
    toast("OP não encontrada.");
    return;
  }

  const modal = document.getElementById("modalAjusteMigracao");
  const info = document.getElementById("ajusteMigracaoInfo");
  const local = document.getElementById("ajusteMigracaoLocal");
  const destino = document.getElementById("ajusteMigracaoDestino");
  const processo = document.getElementById("ajusteMigracaoProcesso");
  const dataEnvio = document.getElementById("ajusteMigracaoDataEnvio");
  const dataChegada = document.getElementById("ajusteMigracaoDataChegada");
  const proximo = document.getElementById("ajusteMigracaoProximoDestino");

  document.getElementById("ajusteMigracaoOpId").value = ordem.id;
  const localAtual = getLocalizacaoAtualOrdem(ordem);
  const ultimaMov = getUltimaMovimentacaoOrdem(ordem);
  if (info) {
    info.innerHTML = `
      <strong>OP ${escapeHtml(ordem.numeroOP || ordem.id)} | Ref. ${escapeHtml(ordem.referencia || "-")}</strong>
      <span>Fase original: ${escapeHtml(ordem.faseOriginalLigia || "-")} | Facção original: ${escapeHtml(ordem.faccaoOriginalLigia || "-")} | QTD ${escapeHtml(ordem.quantidade || 0)}</span>
      <span>Status atual: ${escapeHtml(localAtual.local || ordem.statusMigracaoLigia || ordem.status || "-")} | Destino: ${escapeHtml(localAtual.destino || "-")}</span>
    `;
  }

  if (local) local.value = normalizarStatusParaLocalAjuste(ordem.localAtualMigracao || ordem.statusMigracaoLigia || localAtual.local || "MANEJO_AGUARDANDO_DESTINO");
  if (destino) destino.value = ordem.destinoAtualMigracao || localAtual.destino || ordem.faccaoAtual || ordem.faccaoOriginalLigia || ordem.celulaOriginalLigia || "";
  if (processo) processo.value = ordem.processoAtualMigracao || localAtual.processo || ultimaMov?.processo || "";
  if (dataEnvio) dataEnvio.value = normalizarDataISO(ordem.dataEnvioAtualMigracao || ultimaMov?.dataEnvio || "");
  if (dataChegada) dataChegada.value = normalizarDataISO(ordem.dataChegadaAtualMigracao || ultimaMov?.dataChegada || "");
  if (proximo) proximo.value = ordem.proximoDestinoMigracao || "";
  document.getElementById("ajusteMigracaoMotivo").value = "";

  modal?.classList.remove("hidden");
}

function fecharModalAjusteMigracao() {
  document.getElementById("modalAjusteMigracao")?.classList.add("hidden");
  document.getElementById("formAjusteMigracao")?.reset();
}

function normalizarDataISO(valor) {
  if (!valor) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  return "";
}

async function salvarAjusteMigracao(event) {
  event.preventDefault();

  if (!ehAdmin()) {
    toast("Apenas admin pode corrigir migração.");
    return;
  }

  const ordemId = document.getElementById("ajusteMigracaoOpId")?.value || "";
  const ordem = state.ordens.find(op => String(op.id) === String(ordemId) || String(op.numeroOP) === String(ordemId));
  if (!ordem) {
    toast("OP não encontrada.");
    return;
  }

  const local = normalizarStatusParaLocalAjuste(document.getElementById("ajusteMigracaoLocal")?.value || "");
  const destino = limparTexto(document.getElementById("ajusteMigracaoDestino")?.value || "").toUpperCase();
  const processo = limparTexto(document.getElementById("ajusteMigracaoProcesso")?.value || "").toUpperCase();
  const dataEnvio = document.getElementById("ajusteMigracaoDataEnvio")?.value || "";
  const dataChegada = document.getElementById("ajusteMigracaoDataChegada")?.value || "";
  const proximoDestino = limparTexto(document.getElementById("ajusteMigracaoProximoDestino")?.value || "").toUpperCase();
  const motivo = limparTexto(document.getElementById("ajusteMigracaoMotivo")?.value || "");

  if (!motivo) {
    toast("Informe o motivo da correção.");
    return;
  }

  const ocultarDoManejo = ["RELATORIO_CELULAS", "FINALIZADO_BIPADO", "CANCELADA"].includes(local);
  const setorAjuste = getSetorPrincipalOrdem(ordem);
  const patch = {
    statusMigracaoLigia: local,
    localAtualMigracao: local,
    destinoAtualMigracao: destino,
    processoAtualMigracao: processo,
    dataEnvioAtualMigracao: dataEnvio,
    dataChegadaAtualMigracao: dataChegada,
    proximoDestinoMigracao: proximoDestino,
    ocultarDoManejo,
    ajusteManualMigracao: true,
    ultimoMotivoAjusteMigracao: motivo,
    relatorioMigracao: ocultarDoManejo ? labelLocalAjusteMigracao(local) : "",
    atualizadoPor: state.currentUser.uid,
    atualizadoEm: serverTimestamp()
  };

  if (!ocultarDoManejo) {
    const manejoExistente = getManejoDaOrdem(ordem, setorAjuste) || {};
    const faseCorrigida = processo || (local === "DISPONIVEL_CASA" ? "DISPONÍVEL P CASA" : local === "EM_FACCAO" ? "AGUARDANDO CHEGADA FACÇÃO" : local === "EM_CELULA" ? "PRODUÇÃO / CÉLULA" : "AGUARDANDO DESTINO");
    const manejoCorrigido = {
      ...manejoExistente,
      fase: faseCorrigida,
      data: dataEnvio || manejoExistente.data || "",
      chegada: dataChegada || manejoExistente.chegada || "",
      faccao: local === "EM_FACCAO" ? destino : (manejoExistente.faccao || ""),
      celu: local === "EM_CELULA" ? destino : (manejoExistente.celu || ""),
      proximoDestino,
      processoAtualMigracao: processo,
      statusMigracao: local,
      observacoes: [manejoExistente.observacoes || "", `Ajustado manualmente: ${motivo}`].filter(Boolean).join(" | ")
    };

    Object.assign(patch, montarPatchManejoSetor(setorAjuste, manejoCorrigido, "organizada"));
  }

  const ajusteRef = doc(collection(db, "ajustesMigracao"));

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, "ordensProducao", ordemId), patch, { merge: true });
    batch.set(ajusteRef, {
      opId: ordemId,
      numeroOP: ordem.numeroOP || "",
      referencia: ordem.referencia || "",
      antes: {
        statusMigracaoLigia: ordem.statusMigracaoLigia || "",
        localAtualMigracao: ordem.localAtualMigracao || "",
        destinoAtualMigracao: ordem.destinoAtualMigracao || "",
        processoAtualMigracao: ordem.processoAtualMigracao || ""
      },
      depois: patch,
      motivo,
      criadoPor: state.currentUser.uid,
      criadoEm: serverTimestamp()
    });

    if (["EM_FACCAO", "EM_CELULA"].includes(local) && destino) {
      const tipoDestino = local === "EM_CELULA" ? "celula" : "faccao";
      const movId = docIdSeguro(`ajuste-${ordem.numeroOP || ordem.id}-${tipoDestino}-${destino}-${Date.now()}`);
      batch.set(doc(db, "movimentacoesProducao", movId), {
        origem: "ajuste_migracao",
        ajusteMigracaoId: ajusteRef.id,
        opId: ordemId,
        numeroOP: ordem.numeroOP || "",
        referencia: ordem.referencia || "",
        cor: ordem.cor || "",
        produtoNome: ordem.produtoNome || "",
        tipoDestino,
        tipoDestinoLabel: tipoDestino === "faccao" ? "Facção" : "Célula",
        destino,
        destinoId: docIdSeguro(destino),
        processo: tipoDestino === "celula" ? "CÉLULA INTERNA" : (processo || "PROCESSO A DEFINIR"),
        setor: setorAjuste,
        setorLabel: getInfoManejoSetor(setorAjuste).label,
        quantidadeEnviada: Number(ordem.quantidade || 0),
        dataEnvio,
        dataChegada,
        falta: 0,
        quantidadeRecebida: dataChegada ? Number(ordem.quantidade || 0) : 0,
        status: dataChegada ? "retornou" : "em_andamento",
        observacoes: `Criado por ajuste manual de migração. Motivo: ${motivo}`,
        criadoPor: state.currentUser.uid,
        criadoEm: serverTimestamp(),
        atualizadoPor: state.currentUser.uid,
        atualizadoEm: serverTimestamp()
      }, { merge: true });
    }

    await batch.commit();
    await registrarLog("ajuste_migracao_op", "ordensProducao", ordemId, `OP ${ordem.numeroOP || ordemId} | ${local} | ${destino || "sem destino"} | ${motivo}`);
    fecharModalAjusteMigracao();
    renderRastreamento();
    atualizarManejoComSoma();
    toast("Correção de migração salva com histórico.");
  } catch (error) {
    console.error(error);
    toast("Erro ao salvar ajuste de migração.");
  }
}

async function importarFaccoesExtraidasPlanilha() {
  if (!ehAdmin()) {
    toast("Apenas admin pode importar facções.");
    return;
  }

  if (!Array.isArray(FACCOES_EXTRAIDAS_PLANILHA) || !FACCOES_EXTRAIDAS_PLANILHA.length) {
    toast("Nenhuma facção preparada para importar.");
    return;
  }

  try {
    let batch = writeBatch(db);
    let contador = 0;
    let ok = 0;
    let pendentes = 0;
    let puladas = 0;

    for (const item of FACCOES_EXTRAIDAS_PLANILHA) {
      const nome = limparTexto(item.nome || "").toUpperCase();
      if (!nome) continue;

      const pendente = item.status !== "ok";
      const docId = docIdSeguro(nome);
      const existente = state.faccoes.find(faccao => faccao.id === docId || limparTexto(faccao.nome || "").toUpperCase() === nome);

      if (pendente && existente && existente.cadastroPendente === false) {
        puladas++;
        continue;
      }

      const observacoes = [
        item.observacoes || "",
        item.titularPix ? `Titular PIX: ${item.titularPix}` : "",
        item.pixConfianca ? `Confiança PIX: ${item.pixConfianca}` : "",
        item.origem ? `Origem: ${item.origem}` : ""
      ].filter(Boolean).join(" | ");

      batch.set(doc(db, "faccoes", docId), {
        nome,
        cidade: limparTexto(item.cidade || "").toUpperCase(),
        chavePix: item.pix || "",
        celular: item.celular || "",
        observacoes,
        titularPix: item.titularPix || "",
        pixConfianca: item.pixConfianca || "",
        origemImportacao: item.origem || "",
        importadoDaPlanilha: true,
        cadastroPendente: pendente,
        statusImportacao: pendente ? "pendente" : "ok",
        pendenciaImportacao: pendente ? (item.pendencia || "Revisar dados") : "",
        ativo: !pendente,
        atualizadoPor: state.currentUser.uid,
        atualizadoEm: serverTimestamp(),
        criadoPor: state.currentUser.uid,
        criadoEm: serverTimestamp()
      }, { merge: true });

      if (pendente) pendentes++;
      else ok++;

      contador++;
      if (contador === 450) {
        await batch.commit();
        batch = writeBatch(db);
        contador = 0;
      }
    }

    if (contador > 0) {
      await batch.commit();
    }

    await registrarLog("faccoes_importadas_planilha", "faccao", "importacao", `${ok} OK | ${pendentes} pendentes | ${puladas} puladas`);
    toast(`${ok} facções importadas. ${pendentes} ficaram pendentes para revisar.${puladas ? ` ${puladas} já estavam completas e foram mantidas.` : ""}`);
  } catch (error) {
    console.error(error);
    toast("Erro ao importar facções da planilha.");
  }
}



function normalizarDataMovimentacaoParaISO(valor) {
  const texto = limparTexto(valor);
  if (!texto) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) return dataBrasileiraParaISO(texto);
  const curta = dataBRCurtaParaISO(texto);
  if (curta) return curta;

  const meses = {
    JAN: "01", JANEIRO: "01", FEV: "02", FEVEREIRO: "02", MAR: "03", MARCO: "03", MARÇO: "03",
    ABR: "04", ABRIL: "04", MAI: "05", MAIO: "05", JUN: "06", JUNHO: "06", JUL: "07", JULHO: "07",
    AGO: "08", AGOSTO: "08", SET: "09", SETEMBRO: "09", OUT: "10", OUTUBRO: "10", NOV: "11", NOVEMBRO: "11",
    DEZ: "12", DEZEMBRO: "12"
  };

  const match = texto.toUpperCase().match(/^(\d{1,2})\s*\/\s*([A-ZÀ-ÿ]{3,})$/);
  if (match) {
    const dia = String(match[1]).padStart(2, "0");
    const mes = meses[normalizarTexto(match[2]).toUpperCase()];
    if (mes) return `${new Date().getFullYear()}-${mes}-${dia}`;
  }

  return "";
}

function getDataMovimentacaoFaccoes(mov, tipoData) {
  const campo = tipoData === "chegada" ? mov?.dataChegada : mov?.dataEnvio;
  return normalizarDataMovimentacaoParaISO(campo);
}

function preencherFiltrosFaccoesMovimentacoes(movimentosBase) {
  preencherSelectProcessos("faccaoMovFiltroNome", movimentosBase.map(mov => mov.destino), "Todas");
  preencherSelectProcessos("faccaoMovFiltroProcesso", movimentosBase.map(mov => mov.processo), "Todos");
}

function getFiltrosFaccoesMovimentacoes() {
  return {
    busca: normalizarTexto(document.getElementById("buscaFaccaoMovimentacoes")?.value || ""),
    faccao: document.getElementById("faccaoMovFiltroNome")?.value || "",
    processo: document.getElementById("faccaoMovFiltroProcesso")?.value || "",
    status: document.getElementById("faccaoMovFiltroStatus")?.value || "",
    tipoData: document.getElementById("faccaoMovFiltroDataTipo")?.value || "envio",
    dataInicio: document.getElementById("faccaoMovFiltroDataInicio")?.value || "",
    dataFim: document.getElementById("faccaoMovFiltroDataFim")?.value || ""
  };
}

function limparFiltrosFaccoesMovimentacoes() {
  [
    "buscaFaccaoMovimentacoes",
    "faccaoMovFiltroNome",
    "faccaoMovFiltroProcesso",
    "faccaoMovFiltroStatus",
    "faccaoMovFiltroDataInicio",
    "faccaoMovFiltroDataFim"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const tipoData = document.getElementById("faccaoMovFiltroDataTipo");
  if (tipoData) tipoData.value = "envio";
}


function renderResumoFiltroFaccoes(movimentos, filtros) {
  const box = document.getElementById("resumoFaccoesPeriodo");
  if (!box) return;

  const totalOps = movimentos.length;
  const usandoChegada = filtros.tipoData === "chegada";
  const totalPecas = movimentos.reduce((soma, mov) => {
    return soma + Number(usandoChegada ? quantidadeRecebidaMovimentacao(mov) : (mov.quantidadeEnviada || 0));
  }, 0);
  const totalRecebidas = movimentos.reduce((soma, mov) => soma + Number(quantidadeRecebidaMovimentacao(mov) || 0), 0);
  const emAberto = movimentos.filter(mov => (mov.status || "em_andamento") === "em_andamento").length;
  const retornaram = movimentos.filter(mov => mov.status === "retornou" || mov.status === "encaminhado" || mov.status === "finalizado").length;

  const porDia = new Map();
  movimentos.forEach(mov => {
    const data = getDataMovimentacaoFaccoes(mov, filtros.tipoData) || "SEM DATA";
    const atual = porDia.get(data) || { ops: 0, pecas: 0 };
    atual.ops += 1;
    atual.pecas += Number(usandoChegada ? quantidadeRecebidaMovimentacao(mov) : (mov.quantidadeEnviada || 0));
    porDia.set(data, atual);
  });

  const dias = [...porDia.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .slice(0, 8)
    .map(([data, dados]) => `${data === "SEM DATA" ? "Sem data" : dataISOParaBR(data)}: ${dados.pecas.toLocaleString("pt-BR")} peças`)
    .join(" | ");

  const periodo = filtros.dataInicio || filtros.dataFim
    ? `${filtros.dataInicio ? dataISOParaBR(filtros.dataInicio) : "início"} até ${filtros.dataFim ? dataISOParaBR(filtros.dataFim) : "hoje"}`
    : "todos os períodos";

  const nomeData = filtros.tipoData === "chegada" ? "chegaram" : "saíram para facção";
  box.innerHTML = `
    <strong>Resumo do filtro:</strong>
    ${totalOps.toLocaleString("pt-BR")} OPs | ${totalPecas.toLocaleString("pt-BR")} peças ${nomeData} | ${totalRecebidas.toLocaleString("pt-BR")} recebidas | ${emAberto.toLocaleString("pt-BR")} em aberto | ${retornaram.toLocaleString("pt-BR")} retornadas/encaminhadas<br>
    <small>Período: ${escapeHtml(periodo)}${filtros.faccao ? ` | Facção: ${escapeHtml(filtros.faccao)}` : ""}${filtros.processo ? ` | Processo: ${escapeHtml(filtros.processo)}` : ""}</small>
    ${dias ? `<br><small><strong>Por dia:</strong> ${escapeHtml(dias)}</small>` : ""}
  `;
}

function renderFaccoesMovimentacoes() {
  const tbody = document.getElementById("listaFaccoesMovimentacoes");
  if (!tbody) return;

  const movimentosBase = state.movimentacoesProducao.filter(mov => mov.tipoDestino === "faccao");
  preencherFiltrosFaccoesMovimentacoes(movimentosBase);

  const filtros = getFiltrosFaccoesMovimentacoes();
  let movimentos = movimentosBase.filter(mov => {
    const status = mov.status || "em_andamento";
    const dataFiltro = getDataMovimentacaoFaccoes(mov, filtros.tipoData);

    const texto = normalizarTexto([
      mov.numeroOP,
      mov.referencia,
      mov.cor,
      mov.destino,
      mov.processo,
      status,
      labelStatusMovimento(status),
      mov.dataEnvio,
      mov.dataChegada
    ].join(" "));

    if (filtros.busca && !texto.includes(filtros.busca)) return false;
    if (filtros.faccao && String(mov.destino || "") !== filtros.faccao) return false;
    if (filtros.processo && String(mov.processo || "") !== filtros.processo) return false;
    if (filtros.status && status !== filtros.status) return false;
    if (filtros.dataInicio && (!dataFiltro || dataFiltro < filtros.dataInicio)) return false;
    if (filtros.dataFim && (!dataFiltro || dataFiltro > filtros.dataFim)) return false;

    return true;
  });

  const emFaccoes = movimentos.filter(mov => mov.status === "em_andamento" || !mov.status);
  const pecasEnviadas = movimentos.reduce((soma, mov) => soma + Number(mov.quantidadeEnviada || 0), 0);
  const pecasRecebidas = movimentos.reduce((soma, mov) => soma + Number(mov.quantidadeRecebida || 0), 0);
  const descontoDefeito = movimentos.reduce((soma, mov) => soma + Number(mov.descontoDefeito ?? mov.defeito ?? 0), 0);

  const setText = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.textContent = Number(valor || 0).toLocaleString("pt-BR");
  };

  setText("faccoesTotalCadastradas", getFaccoesUnicas().filter(faccao => !faccao.cadastroPendente && faccao.ativo !== false).length);
  setText("faccoesOpsEmAndamento", emFaccoes.length);
  setText("faccoesPecasEnviadas", pecasEnviadas);
  setText("faccoesPecasRecebidas", pecasRecebidas);
  const descontoDefeitoEl = document.getElementById("faccoesPecasDefeito");
  if (descontoDefeitoEl) descontoDefeitoEl.textContent = formatarMoedaBR(descontoDefeito);
  renderResumoFiltroFaccoes(movimentos, filtros);

  const movimentosFiltrados = movimentos;
  const chaveRender = "faccoes-movimentacoes";
  movimentos = limitarItensRenderTabela(chaveRender, movimentosFiltrados);

  if (!movimentosFiltrados.length) {
    tbody.innerHTML = `<tr><td colspan="12" class="empty">Nenhuma movimentação de facção encontrada com os filtros selecionados.</td></tr>`;
    limparControleRenderTabela(chaveRender);
    return;
  }

  tbody.innerHTML = movimentos.map(mov => `
    <tr class="${mov.status === "em_andamento" || !mov.status ? "mov-em-faccao" : ""}">
      <td><strong>${escapeHtml(mov.numeroOP || "-")}</strong></td>
      <td><strong>${escapeHtml(mov.referencia || "-")}</strong></td>
      <td>${escapeHtml(mov.cor || "-")}</td>
      <td><strong>${escapeHtml(mov.destino || "-")}</strong></td>
      <td>${escapeHtml(mov.processo || "-")}</td>
      <td><strong>${escapeHtml(Number(mov.quantidadeEnviada || 0).toLocaleString("pt-BR"))}</strong></td>
      <td>${escapeHtml(dataISOParaBR(mov.dataEnvio) || mov.dataEnvio || "-")}</td>
      <td>${escapeHtml(dataISOParaBR(mov.dataChegada) || mov.dataChegada || "-")}</td>
      <td>${escapeHtml(Number(mov.falta || 0).toLocaleString("pt-BR"))}</td>
      <td>${escapeHtml(formatarMoedaBR(mov.descontoDefeito ?? mov.defeito ?? 0))}</td>
      <td>
        <span class="badge ${classeStatusMovimento(mov.status)}">
          ${escapeHtml(labelStatusMovimento(mov.status))}
        </span>
      </td>
      <td>
        ${mov.status === "encaminhado" ? `<span class="badge info">Saiu da facção</span>` : ""}
        ${mov.status !== "finalizado" && mov.status !== "encaminhado" ? `<button class="btn btn-sm btn-success" onclick="registrarChegadaMovimentacao('${mov.id}')">Chegada</button>` : ""}
        ${podeEncaminharMovimentacao(mov) ? `<button class="btn btn-sm" onclick="enviarMovimentacaoParaCelula('${mov.id}')">Mandar célula</button>` : ""}
        ${podeEncaminharMovimentacao(mov) ? `<button class="btn btn-sm" onclick="reenviarMovimentacaoParaFaccao('${mov.id}')">Reenviar facção</button>` : ""}
        ${mov.status === "finalizado" ? `<span class="badge ok">Bipado ✓</span>` : mov.status === "encaminhado" ? "" : `<button class="btn btn-sm btn-bipado" onclick="biparMovimentacao('${mov.id}')">Bipar</button>`}
        ${ehAdmin() ? `<button class="btn btn-sm btn-danger" onclick="excluirMovimentacao('${mov.id}')">Excluir</button>` : ""}
      </td>
    </tr>
  `).join("");
  renderControleRenderTabela(tbody, chaveRender, movimentosFiltrados.length, movimentos.length, "movimentações de facção");
}


function editarFaccao(id) {
  const faccao = state.faccoes.find(item => item.id === id);
  if (!faccao) return;

  abrirPagina("faccoes");
  document.getElementById("painelGerenciarFaccoes")?.classList.remove("hidden");
  const toggleGerenciar = document.getElementById("btnToggleGerenciarFaccoes");
  if (toggleGerenciar) toggleGerenciar.textContent = "Ocultar gerenciamento";
  document.getElementById("formFaccao")?.classList.remove("hidden");

  document.getElementById("faccaoId").value = faccao.id;
  document.getElementById("faccaoNome").value = faccao.nome || "";
  document.getElementById("faccaoCidade").value = faccao.cidade || "";
  document.getElementById("faccaoPix").value = faccao.chavePix || "";
  document.getElementById("faccaoCelular").value = faccao.celular || "";
  document.getElementById("faccaoObs").value = faccao.observacoes || "";

  if (faccao.cadastroPendente) {
    toast("Complete cidade/PIX e salve. A facção sairá dos pendentes.");
  }
}

async function alternarFaccao(id) {
  if (!ehAdmin()) {
    toast("Apenas admin pode alterar facções.");
    return;
  }

  const faccao = state.faccoes.find(item => item.id === id);
  if (!faccao) return;

  const ativo = faccao.ativo === false;

  try {
    await setDoc(doc(db, "faccoes", id), {
      ativo,
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    await registrarLog(ativo ? "faccao_ativada" : "faccao_inativada", "faccao", id, `${faccao.nome || id}`);
    toast(ativo ? "Facção ativada." : "Facção inativada.");
  } catch (error) {
    console.error(error);
    toast("Erro ao alterar status da facção.");
  }
}

async function excluirFaccao(id) {
  if (!ehAdmin()) {
    toast("Apenas admin pode excluir facções.");
    return;
  }

  const faccao = state.faccoes.find(item => item.id === id);
  if (!confirm(`Excluir a facção ${faccao?.nome || id}?`)) return;

  try {
    await deleteDoc(doc(db, "faccoes", id));
    await registrarLog("faccao_excluida", "faccao", id, `${faccao?.nome || id}`);
    toast("Facção excluída.");
  } catch (error) {
    console.error(error);
    toast("Erro ao excluir facção.");
  }
}







function nomeCelulaCanonico(valor) {
  const limpo = limparTexto(valor).toUpperCase().replace(/\bCÉLULA\b/g, "CELULA").replace(/\s+/g, " ").trim();
  if (!limpo) return "";

  const semAcento = normalizarTexto(limpo).toUpperCase().replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  return semAcento.replace(/\b0+(\d+)\b/g, "$1");
}

function chaveCelulaCanonica(valor) {
  return normalizarTexto(nomeCelulaCanonico(valor))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function scoreCelulaParaUnificar(celula) {
  let score = 0;
  if (celula?.ativo !== false) score += 20;
  if (!celula?.duplicadaDe && celula?.statusImportacao !== "duplicada_consolidada") score += 10;
  if (celula?.criadoEm) score += 2;
  return score;
}

function mergeCelulasCadastro(base, item) {
  const nome = nomeCelulaCanonico(base?.nome || item?.nome || "");
  return {
    ...base,
    id: base?.id || item?.id || docIdSeguro(nome),
    nome,
    ativo: base?.ativo !== false || item?.ativo !== false,
    unificadoVisualmente: Boolean(base?.id && item?.id && base.id !== item.id)
  };
}

function getCelulasUnicas(opcoes = {}) {
  const incluirInativas = Boolean(opcoes.incluirInativas);

  const ordenadas = [...(state.celulas || [])].sort((a, b) => {
    const scoreDiff = scoreCelulaParaUnificar(b) - scoreCelulaParaUnificar(a);
    if (scoreDiff) return scoreDiff;
    return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { numeric: true });
  });

  const mapa = new Map();
  ordenadas.forEach(item => {
    if (!item?.nome) return;
    if (!incluirInativas && item.ativo === false) return;
    if (item.statusImportacao === "duplicada_consolidada" || item.duplicadaDe) return;

    const chave = chaveCelulaCanonica(item.nome);
    if (!chave) return;

    const atual = mapa.get(chave);
    mapa.set(chave, atual ? mergeCelulasCadastro(atual, item) : mergeCelulasCadastro(item, item));
  });

  return [...mapa.values()].sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { numeric: true }));
}

async function organizarCelulasDuplicadas() {
  if (!ehAdmin()) {
    toast("Apenas admin pode organizar células duplicadas.");
    return;
  }

  const grupos = new Map();
  (state.celulas || []).forEach(celula => {
    if (!celula?.nome) return;
    if (celula.statusImportacao === "duplicada_consolidada" || celula.duplicadaDe) return;
    const chave = chaveCelulaCanonica(celula.nome);
    if (!chave) return;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(celula);
  });

  const duplicadas = [...grupos.values()].filter(grupo => grupo.length > 1);

  if (!duplicadas.length) {
    toast("Nenhuma célula duplicada encontrada. A lista visual já está unificada.");
    return;
  }

  const totalDuplicadas = duplicadas.reduce((soma, grupo) => soma + grupo.length - 1, 0);
  if (!confirm(`Encontramos ${totalDuplicadas} cadastro(s) duplicado(s) de células. Vou manter um cadastro principal ativo e marcar os repetidos como duplicados/inativos, sem apagar movimentações. Continuar?`)) {
    return;
  }

  try {
    let batch = writeBatch(db);
    let contador = 0;
    let gruposCorrigidos = 0;

    for (const grupo of duplicadas) {
      const ordenado = [...grupo].sort((a, b) => scoreCelulaParaUnificar(b) - scoreCelulaParaUnificar(a));
      const principal = ordenado[0];
      const nomePrincipal = nomeCelulaCanonico(principal.nome);
      const principalId = principal.id || docIdSeguro(nomePrincipal);
      const consolidado = ordenado.reduce((acc, item) => mergeCelulasCadastro(acc, item), principal);

      batch.set(doc(db, "celulas", principalId), {
        ...consolidado,
        nome: nomePrincipal,
        ativo: true,
        consolidadoDuplicadas: true,
        quantidadeDuplicadasConsolidadas: grupo.length - 1,
        atualizadoPor: state.currentUser.uid,
        atualizadoEm: serverTimestamp()
      }, { merge: true });
      contador++;

      for (const duplicada of ordenado.slice(1)) {
        if (!duplicada.id || duplicada.id === principalId) continue;
        batch.set(doc(db, "celulas", duplicada.id), {
          ativo: false,
          statusImportacao: "duplicada_consolidada",
          pendenciaImportacao: `Cadastro duplicado consolidado em ${nomePrincipal}`,
          duplicadaDe: principalId,
          duplicadaDeNome: nomePrincipal,
          atualizadoPor: state.currentUser.uid,
          atualizadoEm: serverTimestamp()
        }, { merge: true });
        contador++;
      }

      gruposCorrigidos++;
      if (contador >= 430) {
        await batch.commit();
        batch = writeBatch(db);
        contador = 0;
      }
    }

    if (contador > 0) await batch.commit();

    await registrarLog("celulas_duplicadas_consolidadas", "celula", "duplicadas", `${gruposCorrigidos} grupos corrigidos | ${totalDuplicadas} duplicadas marcadas`);
    renderCelulas();
    renderCelulasMovimentacoes();
    toast(`${gruposCorrigidos} grupo(s) de células duplicadas organizado(s).`);
  } catch (error) {
    console.error(error);
    toast("Erro ao organizar células duplicadas.");
  }
}

function configurarCelulas() {
  const form = document.getElementById("formCelula");
  if (form) {
    form.addEventListener("submit", salvarCelula);
  }

  const busca = document.getElementById("buscaCelula");
  if (busca) {
    busca.addEventListener("input", renderCelulas);
  }

  const buscaMovimentacoes = document.getElementById("buscaCelulaMovimentacoes");
  if (buscaMovimentacoes) {
    buscaMovimentacoes.addEventListener("input", renderCelulasMovimentacoes);
  }

  const toggleGerenciar = document.getElementById("btnToggleGerenciarCelulas");
  if (toggleGerenciar) {
    toggleGerenciar.addEventListener("click", () => {
      const painel = document.getElementById("painelGerenciarCelulas");
      if (!painel) return;

      const abrindo = painel.classList.contains("hidden");
      painel.classList.toggle("hidden");
      toggleGerenciar.textContent = abrindo ? "Ocultar gerenciamento" : "Gerenciar células";
    });
  }

  const organizarDuplicadas = document.getElementById("btnOrganizarCelulasDuplicadas");
  if (organizarDuplicadas) {
    organizarDuplicadas.addEventListener("click", organizarCelulasDuplicadas);
  }

  const abrirCadastro = document.getElementById("btnAbrirCadastroCelula");
  if (abrirCadastro) {
    abrirCadastro.addEventListener("click", () => {
      const painel = document.getElementById("painelGerenciarCelulas");
      const formCelula = document.getElementById("formCelula");

      if (painel) painel.classList.remove("hidden");

      if (formCelula) {
        formCelula.classList.remove("hidden");
        document.getElementById("celulaNome")?.focus();
      }
    });
  }

  const cancelar = document.getElementById("btnCancelarCelula");
  if (cancelar) {
    cancelar.addEventListener("click", limparFormCelula);
  }
}

function limparFormCelula() {
  const form = document.getElementById("formCelula");
  if (form) {
    form.reset();
    form.classList.add("hidden");
  }

  const id = document.getElementById("celulaId");
  if (id) id.value = "";
}

async function salvarCelula(event) {
  event.preventDefault();

  if (!ehAdmin()) {
    toast("Apenas admin pode salvar células.");
    return;
  }

  const idAtual = document.getElementById("celulaId").value;
  const nome = limparTexto(document.getElementById("celulaNome").value).toUpperCase();

  if (!nome) {
    toast("Informe o nome da célula.");
    return;
  }

  const dados = {
    nome,
    ativo: true,
    atualizadoPor: state.currentUser.uid,
    atualizadoEm: serverTimestamp()
  };

  if (!idAtual) {
    dados.criadoPor = state.currentUser.uid;
    dados.criadoEm = serverTimestamp();
  }

  try {
    const docId = idAtual || docIdSeguro(nome);
    await setDoc(doc(db, "celulas", docId), dados, { merge: true });

    await registrarLog(idAtual ? "celula_atualizada" : "celula_criada", "celula", docId, nome);
    limparFormCelula();
    toast("Célula salva.");
  } catch (error) {
    console.error(error);
    toast("Erro ao salvar célula.");
  }
}

function renderCelulas() {
  const tbody = document.getElementById("listaCelulas");
  if (!tbody) return;

  const busca = normalizarTexto(document.getElementById("buscaCelula")?.value || "");
  let celulas = getCelulasUnicas();

  if (busca) {
    celulas = celulas.filter(celula => normalizarTexto(celula.nome || "").includes(busca));
  }

  const celulasFiltradas = celulas;
  const chaveRender = "celulas-cadastro";
  celulas = limitarItensRenderTabela(chaveRender, celulasFiltradas);

  if (!celulasFiltradas.length) {
    tbody.innerHTML = `<tr><td colspan="${ehAdmin() ? 3 : 2}" class="empty">Nenhuma célula cadastrada.</td></tr>`;
    limparControleRenderTabela(chaveRender);
    return;
  }

  tbody.innerHTML = celulas.map(celula => `
    <tr>
      <td><strong>${escapeHtml(celula.nome || "-")}</strong></td>
      <td>
        <span class="status-dot ${celula.ativo !== false ? "active" : "inactive"}">
          ${celula.ativo !== false ? "Ativa" : "Inativa"}
        </span>
      </td>
      ${ehAdmin() ? `
        <td>
          <button class="btn btn-sm" onclick="editarCelula('${celula.id}')">Editar</button>
          <button class="btn btn-sm ${celula.ativo !== false ? "btn-warning" : "btn-success"}" onclick="alternarCelula('${celula.id}')">
            ${celula.ativo !== false ? "Inativar" : "Ativar"}
          </button>
          <button class="btn btn-sm btn-danger" onclick="excluirCelula('${celula.id}')">Excluir</button>
        </td>
      ` : ""}
    </tr>
  `).join("");
  renderControleRenderTabela(tbody, chaveRender, celulasFiltradas.length, celulas.length, "células");
}


function renderCelulasMovimentacoes() {
  const tbody = document.getElementById("listaCelulasMovimentacoes");
  if (!tbody) return;

  const busca = normalizarTexto(document.getElementById("buscaCelulaMovimentacoes")?.value || "");
  let movimentos = state.movimentacoesProducao.filter(mov => mov.tipoDestino === "celula");

  if (busca) {
    movimentos = movimentos.filter(mov => {
      const texto = normalizarTexto([
        mov.numeroOP,
        mov.referencia,
        mov.cor,
        mov.destino,
        mov.processo,
        mov.status
      ].join(" "));
      return texto.includes(busca);
    });
  }

  const emCelulas = movimentos.filter(mov => mov.status === "em_andamento" || !mov.status);
  const pecasEnviadas = movimentos.reduce((soma, mov) => soma + Number(mov.quantidadeEnviada || 0), 0);
  const pecasRecebidas = movimentos.reduce((soma, mov) => soma + Number(mov.quantidadeRecebida || 0), 0);

  const setText = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.textContent = Number(valor || 0).toLocaleString("pt-BR");
  };

  setText("celulasTotalCadastradas", getCelulasUnicas().length);
  setText("celulasOpsEmAndamento", emCelulas.length);
  setText("celulasPecasEnviadas", pecasEnviadas);
  setText("celulasPecasRecebidas", pecasRecebidas);

  const movimentosFiltrados = movimentos;
  const chaveRender = "celulas-movimentacoes";
  movimentos = limitarItensRenderTabela(chaveRender, movimentosFiltrados);

  if (!movimentosFiltrados.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty">Nenhuma OP enviada para célula ainda.</td></tr>`;
    limparControleRenderTabela(chaveRender);
    return;
  }

  tbody.innerHTML = movimentos.map(mov => `
    <tr class="${mov.status === "em_andamento" || !mov.status ? "mov-em-celula" : ""}">
      <td><strong>${escapeHtml(mov.numeroOP || "-")}</strong></td>
      <td><strong>${escapeHtml(mov.referencia || "-")}</strong></td>
      <td>${escapeHtml(mov.cor || "-")}</td>
      <td><strong>${escapeHtml(mov.destino || "-")}</strong></td>
      <td>${escapeHtml(mov.processo || "-")}</td>
      <td><strong>${escapeHtml(Number(mov.quantidadeEnviada || 0).toLocaleString("pt-BR"))}</strong></td>
      <td>${escapeHtml(dataISOParaBR(mov.dataEnvio) || mov.dataEnvio || "-")}</td>
      <td>${escapeHtml(dataISOParaBR(mov.dataChegada) || mov.dataChegada || "-")}</td>
      <td>${escapeHtml(Number(mov.falta || 0).toLocaleString("pt-BR"))}</td>
      <td>
        <span class="badge ${classeStatusMovimento(mov.status)}">
          ${escapeHtml(labelStatusMovimento(mov.status))}
        </span>
      </td>
      <td>
        ${mov.status === "encaminhado" ? `<span class="badge info">Encaminhado</span>` : ""}
        ${mov.status !== "finalizado" && mov.status !== "encaminhado" ? `<button class="btn btn-sm btn-success" onclick="registrarChegadaMovimentacao('${mov.id}')">Chegada</button>` : ""}
        ${mov.status === "finalizado" ? `<span class="badge ok">Bipado ✓</span>` : mov.status === "encaminhado" ? "" : `<button class="btn btn-sm btn-bipado" onclick="biparMovimentacao('${mov.id}')">Bipar</button>`}
        ${ehAdmin() ? `<button class="btn btn-sm btn-danger" onclick="excluirMovimentacao('${mov.id}')">Excluir</button>` : ""}
      </td>
    </tr>
  `).join("");
  renderControleRenderTabela(tbody, chaveRender, movimentosFiltrados.length, movimentos.length, "movimentações de célula");
}


function editarCelula(id) {
  const celula = state.celulas.find(item => item.id === id);
  if (!celula) return;

  abrirPagina("celulas");
  document.getElementById("painelGerenciarCelulas")?.classList.remove("hidden");
  const toggleGerenciar = document.getElementById("btnToggleGerenciarCelulas");
  if (toggleGerenciar) toggleGerenciar.textContent = "Ocultar gerenciamento";
  document.getElementById("formCelula")?.classList.remove("hidden");

  document.getElementById("celulaId").value = celula.id;
  document.getElementById("celulaNome").value = celula.nome || "";
}

async function alternarCelula(id) {
  if (!ehAdmin()) {
    toast("Apenas admin pode alterar células.");
    return;
  }

  const celula = state.celulas.find(item => item.id === id);
  if (!celula) return;

  const ativo = celula.ativo === false;

  try {
    await setDoc(doc(db, "celulas", id), {
      ativo,
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    await registrarLog(ativo ? "celula_ativada" : "celula_inativada", "celula", id, celula.nome || id);
    toast(ativo ? "Célula ativada." : "Célula inativada.");
  } catch (error) {
    console.error(error);
    toast("Erro ao alterar célula.");
  }
}

async function excluirCelula(id) {
  if (!ehAdmin()) {
    toast("Apenas admin pode excluir células.");
    return;
  }

  const celula = state.celulas.find(item => item.id === id);
  if (!confirm(`Excluir a célula ${celula?.nome || id}?`)) return;

  try {
    await deleteDoc(doc(db, "celulas", id));
    await registrarLog("celula_excluida", "celula", id, celula?.nome || id);
    toast("Célula excluída.");
  } catch (error) {
    console.error(error);
    toast("Erro ao excluir célula.");
  }
}

let timerBuscaRastreamento = null;

function configurarRastreamento() {
  const busca = document.getElementById("buscaRastreamento");
  if (busca) {
    // Busca global sem datalist e com pequeno atraso para não travar ao digitar OP.
    busca.removeAttribute("list");
    busca.setAttribute("autocomplete", "off");
    busca.addEventListener("input", () => {
      if (timerBuscaRastreamento) clearTimeout(timerBuscaRastreamento);
      timerBuscaRastreamento = setTimeout(renderRastreamento, 160);
    });
  }
}

function getMovimentacoesDaOrdem(opId) {
  return state.movimentacoesProducao.filter(mov => mov.opId === opId);
}

function getDestinoMovimento(tipo, nome) {
  const lista = tipo === "faccao" ? getFaccoesUnicas() : getCelulasUnicas({ incluirInativas: true });
  const texto = chaveFaccaoCanonica(nome);
  return lista.find(item => tipo === "faccao" ? chaveFaccaoCanonica(item.nome || "") === texto : limparTexto(item.nome || "").toUpperCase() === limparTexto(nome).toUpperCase()) || null;
}

function labelTipoMovimento(tipo) {
  return tipo === "celula" ? "Célula" : "Facção";
}

function labelStatusMovimento(status) {
  const mapa = {
    em_andamento: "Em andamento",
    retornou: "Retornou",
    encaminhado: "Encaminhado",
    finalizado: "Bipado"
  };

  return mapa[status] || status || "Em andamento";
}

function classeStatusMovimento(status) {
  if (status === "finalizado") return "ok";
  if (status === "encaminhado") return "info";
  if (status === "retornou") return "bipado";
  return "pending";
}

let movimentacaoModalContexto = null;

function configurarModalMovimentacao() {
  const form = document.getElementById("formMovimentacaoProducao");
  if (form) {
    form.addEventListener("submit", confirmarMovimentacaoProducao);
  }

  const fechar = document.getElementById("btnFecharModalMovimentacao");
  if (fechar) {
    fechar.addEventListener("click", fecharModalMovimentacao);
  }

  const cancelar = document.getElementById("btnCancelarModalMovimentacao");
  if (cancelar) {
    cancelar.addEventListener("click", fecharModalMovimentacao);
  }

  const modal = document.getElementById("modalMovimentacao");
  if (modal) {
    modal.addEventListener("click", event => {
      if (event.target === modal) fecharModalMovimentacao();
    });
  }

  const processoSelect = document.getElementById("movimentacaoProcessoSelect");
  if (processoSelect) {
    processoSelect.addEventListener("change", () => {
      const processoInput = document.getElementById("movimentacaoProcesso");
      if (processoInput && processoSelect.value) {
        processoInput.value = processoSelect.value;
      }
      atualizarDestinosMovimentacaoPorProcesso();
    });
  }

  const processoInput = document.getElementById("movimentacaoProcesso");
  if (processoInput) {
    processoInput.addEventListener("input", atualizarDestinosMovimentacaoPorProcesso);
  }
}

function normalizarNomeProcesso(valor) {
  const texto = limparTexto(valor).toUpperCase();
  if (!texto) return "";

  const semAcento = normalizarTexto(texto).toUpperCase().replace(/\s+/g, " ").trim();
  return ALIASES_PROCESSO_FACCAO[texto] || ALIASES_PROCESSO_FACCAO[semAcento] || texto;
}

function nomeFaccaoCanonico(valor) {
  const nome = limparTexto(valor).toUpperCase().replace(/\s+/g, " ").trim();
  if (!nome) return "";
  const semAcento = normalizarTexto(nome).toUpperCase().replace(/\s+/g, " ").trim();
  return ALIASES_NOME_FACCAO[nome] || ALIASES_NOME_FACCAO[semAcento] || nome;
}

function chaveFaccaoCanonica(valor) {
  return normalizarTexto(nomeFaccaoCanonico(valor))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function listaUnicaNormalizada(valores) {
  const mapa = new Map();
  (valores || []).forEach(valor => {
    const limpo = limparTexto(valor).toUpperCase();
    if (!limpo) return;
    const chave = normalizarTexto(limpo).trim();
    if (!mapa.has(chave)) mapa.set(chave, limpo);
  });
  return [...mapa.values()].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
}

function getProcessosPadraoDaFaccao(nome) {
  const chaveNome = chaveFaccaoCanonica(nome);
  const processos = [];

  Object.entries(FACCOES_POR_PROCESSO_PADRAO).forEach(([processo, faccoes]) => {
    const existe = (faccoes || []).some(faccao => chaveFaccaoCanonica(faccao) === chaveNome);
    if (existe) processos.push(processo);
  });

  return processos;
}

function scoreFaccaoParaUnificar(faccao) {
  let score = 0;
  if (faccao?.ativo !== false) score += 20;
  if (!faccao?.cadastroPendente) score += 20;
  if (faccao?.celular) score += 4;
  if (faccao?.chavePix) score += 4;
  if (Array.isArray(faccao?.processosPermitidos) && faccao.processosPermitidos.length) score += 3;
  if (faccao?.cidade) score += 2;
  return score;
}

function mergeFaccoesCadastro(base, item) {
  const nome = nomeFaccaoCanonico(base?.nome || item?.nome || "");
  const processos = listaUnicaNormalizada([
    ...(base?.processosPermitidos || []),
    ...(item?.processosPermitidos || []),
    ...getProcessosPadraoDaFaccao(nome)
  ].map(normalizarNomeProcesso));

  return {
    ...base,
    id: base?.id || item?.id || docIdSeguro(nome),
    nome,
    cidade: base?.cidade || item?.cidade || "",
    chavePix: base?.chavePix || item?.chavePix || "",
    celular: base?.celular || item?.celular || "",
    observacoes: listaUnicaNormalizada([base?.observacoes, item?.observacoes]).join(" | "),
    processosPermitidos: processos,
    gruposPermitidos: listaUnicaNormalizada([...(base?.gruposPermitidos || []), ...(item?.gruposPermitidos || []), base?.grupo, item?.grupo]),
    ativo: base?.ativo !== false || item?.ativo !== false,
    cadastroPendente: Boolean(base?.cadastroPendente && item?.cadastroPendente),
    unificadoVisualmente: Boolean(base?.id && item?.id && base.id !== item.id)
  };
}

function getFaccoesUnicas(opcoes = {}) {
  const incluirPendentes = Boolean(opcoes.incluirPendentes);
  const somentePendentes = Boolean(opcoes.somentePendentes);
  const incluirInativas = Boolean(opcoes.incluirInativas);

  const ordenadas = [...(state.faccoes || [])].sort((a, b) => {
    const scoreDiff = scoreFaccaoParaUnificar(b) - scoreFaccaoParaUnificar(a);
    if (scoreDiff) return scoreDiff;
    return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { numeric: true });
  });

  const mapa = new Map();

  ordenadas.forEach(item => {
    if (!item?.nome) return;
    if (!incluirInativas && item.ativo === false) return;
    if (somentePendentes && !item.cadastroPendente) return;
    if (!incluirPendentes && item.cadastroPendente) return;
    if (item.statusImportacao === "duplicada_consolidada" || item.duplicadaDe) return;

    const chave = chaveFaccaoCanonica(item.nome);
    if (!chave) return;

    const atual = mapa.get(chave);
    mapa.set(chave, atual ? mergeFaccoesCadastro(atual, item) : mergeFaccoesCadastro(item, item));
  });

  return [...mapa.values()].sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { numeric: true }));
}

function getProcessosDaFaccao(faccao) {
  return listaUnicaNormalizada([
    ...(faccao?.processosPermitidos || []),
    ...getProcessosPadraoDaFaccao(faccao?.nome || "")
  ].map(normalizarNomeProcesso));
}

function getProcessosPermitidosMovimentacaoPorSetor(setor = "sutia") {
  const chaveSetor = String(setor || "sutia").toLowerCase();
  const base = PROCESSOS_FACCAO_POR_SETOR_PADRAO[chaveSetor] || PROCESSOS_FACCAO_POR_SETOR_PADRAO.sutia;
  return listaUnicaNormalizada(base.map(normalizarNomeProcesso));
}

function processoPermitidoNoSetor(processo, setor = "sutia") {
  const normalizado = normalizarNomeProcesso(processo);
  if (!normalizado) return false;
  return getProcessosPermitidosMovimentacaoPorSetor(setor).includes(normalizado);
}

function getProcessosSugeridosMovimentacao(op, setor, tipoDestino) {
  if (tipoDestino === "celula") return ["CÉLULA INTERNA"];

  const referencia = normalizarReferencia(op?.referencia || "");
  const processosTabela = getPrecosReferenciaAtivos()
    .filter(preco => normalizarReferencia(preco.referencia || "") === referencia)
    .map(preco => normalizarNomeProcesso(preco.processo));

  const processosHistorico = state.movimentacoesProducao
    .filter(mov => normalizarReferencia(mov.referencia || "") === referencia && mov.tipoDestino === "faccao")
    .map(mov => normalizarNomeProcesso(mov.processo));

  const permitidos = new Set(getProcessosPermitidosMovimentacaoPorSetor(setor));

  return listaUnicaNormalizada([
    ...getProcessosPermitidosMovimentacaoPorSetor(setor),
    ...processosTabela.filter(processo => permitidos.has(processo)),
    ...processosHistorico.filter(processo => permitidos.has(processo))
  ]);
}

function getFaccoesPermitidasPorProcesso(processo) {
  const processoNormalizado = normalizarNomeProcesso(processo);
  const faccoesUnicas = getFaccoesUnicas();

  if (!processoNormalizado) return [];

  const nomesOficiais = FACCOES_POR_PROCESSO_PADRAO[processoNormalizado] || [];
  const chavesOficiais = new Set(nomesOficiais.map(chaveFaccaoCanonica).filter(Boolean));
  const mapa = new Map();

  faccoesUnicas.forEach(faccao => {
    const processos = getProcessosDaFaccao(faccao).map(normalizarNomeProcesso);
    const chave = chaveFaccaoCanonica(faccao.nome);
    const permitido = processos.includes(processoNormalizado) || chavesOficiais.has(chave);
    if (!permitido || !chave) return;

    const atual = mapa.get(chave);
    mapa.set(chave, atual ? mergeFaccoesCadastro(atual, faccao) : mergeFaccoesCadastro(faccao, faccao));
  });

  return [...mapa.values()].sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { numeric: true }));
}

function atualizarDestinosMovimentacaoPorProcesso() {
  if (!movimentacaoModalContexto) return;

  const tipoDestino = document.getElementById("movimentacaoTipoDestino")?.value || movimentacaoModalContexto.tipoDestino || "";
  const destinoSelect = document.getElementById("movimentacaoDestino");
  if (!destinoSelect) return;

  if (tipoDestino !== "faccao") return;

  const processo = normalizarNomeProcesso(document.getElementById("movimentacaoProcessoSelect")?.value || document.getElementById("movimentacaoProcesso")?.value || "");
  const destinoAtual = destinoSelect.value;

  if (!processo) {
    destinoSelect.innerHTML = `<option value="">Escolha o processo primeiro</option>`;
    destinoSelect.disabled = true;
    return;
  }

  const destinos = getFaccoesPermitidasPorProcesso(processo);

  destinoSelect.disabled = false;
  destinoSelect.innerHTML = `<option value="">Agora selecione a facção</option>` + destinos.map(destino => {
    return `<option value="${escapeHtml(destino.nome || "")}">${escapeHtml(destino.nome || "")}</option>`;
  }).join("");

  if (destinos.some(destino => limparTexto(destino.nome || "").toUpperCase() === limparTexto(destinoAtual).toUpperCase())) {
    destinoSelect.value = destinoAtual;
  }
}


function abrirModalMovimentacao(ordemId, tipoDestino, opcoes = {}) {
  const ordem = state.ordens.find(op => op.id === ordemId);
  if (!ordem) {
    toast("OP não encontrada.");
    return;
  }

  const setor = opcoes.setor || getManejoSetorAtual();
  const label = labelTipoMovimento(tipoDestino);
  const origemMovimentacao = opcoes.origem || "manejo";

  if (origemMovimentacao === "manejo" && ["faccao", "celula"].includes(tipoDestino)) {
    const validacao = validarSilkETecidoAntesDeMovimentar(ordem, setor);
    if (!validacao.ok) return;
  }

  const destinosBase = tipoDestino === "faccao"
    ? getFaccoesUnicas()
    : getCelulasUnicas().filter(item => item.ativo !== false);

  if (!destinosBase.length) {
    if (state.carregandoDados?.[tipoDestino === "faccao" ? "faccoes" : "celulas"]) {
      toast(`Carregando ${label.toLowerCase()}s. Tente novamente em alguns segundos.`);
      return;
    }

    toast(`Cadastre pelo menos uma ${label.toLowerCase()} antes de enviar a OP.`);
    abrirPagina(tipoDestino === "faccao" ? "faccoes" : "celulas");

    if (tipoDestino === "faccao") {
      document.getElementById("painelGerenciarFaccoes")?.classList.remove("hidden");
      const toggle = document.getElementById("btnToggleGerenciarFaccoes");
      if (toggle) toggle.textContent = "Ocultar gerenciamento";
    } else {
      document.getElementById("painelGerenciarCelulas")?.classList.remove("hidden");
      const toggle = document.getElementById("btnToggleGerenciarCelulas");
      if (toggle) toggle.textContent = "Ocultar gerenciamento";
    }

    return;
  }

  const quantidadePadrao = Math.max(0, Number(opcoes.quantidadePadrao ?? numeroQuantidadeOP(ordem)));
  const quantidadeMaxima = Math.max(0, Number(opcoes.quantidadeMaxima ?? numeroQuantidadeOP(ordem)));

  movimentacaoModalContexto = {
    ordemId,
    tipoDestino,
    setor,
    origem: origemMovimentacao,
    movimentacaoOrigemId: opcoes.movimentacaoOrigemId || "",
    quantidadeMaxima,
    origemResumo: opcoes.origemResumo || ""
  };

  const titulo = document.getElementById("modalMovimentacaoTitulo");
  const resumo = document.getElementById("modalMovimentacaoResumo");
  const info = document.getElementById("movimentacaoOpInfo");
  const destinoSelect = document.getElementById("movimentacaoDestino");
  const processoSelect = document.getElementById("movimentacaoProcessoSelect");
  const processoInput = document.getElementById("movimentacaoProcesso");
  const quantidadeInput = document.getElementById("movimentacaoQuantidade");
  const dataInput = document.getElementById("movimentacaoDataEnvio");
  const ordemInput = document.getElementById("movimentacaoOrdemId");
  const tipoInput = document.getElementById("movimentacaoTipoDestino");

  if (titulo) titulo.textContent = opcoes.titulo || `Mandar para ${label}`;
  if (resumo) resumo.textContent = opcoes.resumo || `Escolha uma ${label.toLowerCase()} já cadastrada e confirme os dados do envio.`;
  if (info) {
    info.innerHTML = `
      <strong>OP ${escapeHtml(ordem.numeroOP || "-")}</strong>
      <span>Ref. ${escapeHtml(ordem.referencia || "-")} | Cor ${escapeHtml(ordem.cor || "-")} | QTI ${escapeHtml(numeroQuantidadeOP(ordem))}</span>
      ${opcoes.origemResumo ? `<span class="origem-mov-info">${escapeHtml(opcoes.origemResumo)} | Disponível: ${escapeHtml(quantidadeMaxima.toLocaleString("pt-BR"))} peças</span>` : ""}
    `;
  }

  if (ordemInput) ordemInput.value = ordemId;
  if (tipoInput) tipoInput.value = tipoDestino;

  if (destinoSelect) {
    if (tipoDestino === "faccao") {
      destinoSelect.innerHTML = `<option value="">Escolha o processo primeiro</option>`;
      destinoSelect.disabled = true;
    } else {
      destinoSelect.innerHTML = `<option value="">Selecione ${escapeHtml(label.toLowerCase())}</option>` + destinosBase.map(destino => {
        return `<option value="${escapeHtml(destino.nome || "")}">${escapeHtml(destino.nome || "")}</option>`;
      }).join("");
      destinoSelect.disabled = false;
      destinoSelect.value = opcoes.destinoPadrao || "";
    }
  }

  const grupoProcesso = document.getElementById("grupoMovimentacaoProcesso");
  const exigeProcesso = tipoDestino === "faccao";

  if (grupoProcesso) {
    grupoProcesso.classList.toggle("hidden", !exigeProcesso);
  }

  if (processoInput) {
    processoInput.required = false;
    processoInput.readOnly = true;
    processoInput.classList.toggle("hidden", exigeProcesso);
  }

  const processos = getProcessosSugeridosMovimentacao(ordem, setor, tipoDestino);

  const processoInicial = exigeProcesso
    ? (opcoes.forcarEscolhaProcesso ? "" : (opcoes.processoPadrao || processos[0] || ""))
    : "";

  if (processoSelect) {
    processoSelect.required = exigeProcesso;
    processoSelect.disabled = !exigeProcesso;
    processoSelect.innerHTML = `<option value="">Primeiro selecione o processo</option>` + processos.map(processo => {
      return `<option value="${escapeHtml(processo)}">${escapeHtml(processo)}</option>`;
    }).join("");
    processoSelect.value = processoInicial;
  }

  if (processoInput) processoInput.value = exigeProcesso ? processoInicial : "CÉLULA INTERNA";
  atualizarDestinosMovimentacaoPorProcesso();
  if (destinoSelect && opcoes.destinoPadrao && !destinoSelect.disabled) destinoSelect.value = opcoes.destinoPadrao;
  if (quantidadeInput) {
    quantidadeInput.value = quantidadePadrao || "";
    quantidadeInput.max = quantidadeMaxima || "";
    quantidadeInput.title = quantidadeMaxima ? `Máximo disponível: ${quantidadeMaxima}` : "";
  }
  if (dataInput) dataInput.value = getDataHojeISO();

  document.getElementById("modalMovimentacao")?.classList.remove("hidden");
  if (tipoDestino === "faccao") {
    (processoSelect || processoInput)?.focus();
  } else {
    destinoSelect?.focus();
  }
}

function fecharModalMovimentacao() {
  document.getElementById("modalMovimentacao")?.classList.add("hidden");
  document.getElementById("formMovimentacaoProducao")?.reset();
  movimentacaoModalContexto = null;
}

async function confirmarMovimentacaoProducao(event) {
  event.preventDefault();

  const ordemId = document.getElementById("movimentacaoOrdemId")?.value || movimentacaoModalContexto?.ordemId || "";
  const tipoDestino = document.getElementById("movimentacaoTipoDestino")?.value || movimentacaoModalContexto?.tipoDestino || "";
  const setor = movimentacaoModalContexto?.setor || getManejoSetorAtual();
  const ordem = state.ordens.find(op => op.id === ordemId);

  if (!ordem) {
    toast("OP não encontrada.");
    return;
  }

  const label = labelTipoMovimento(tipoDestino);
  const destino = limparTexto(document.getElementById("movimentacaoDestino")?.value || "").toUpperCase();
  const processoSelecionado = limparTexto(document.getElementById("movimentacaoProcessoSelect")?.value || "").toUpperCase();
  const processoDigitado = limparTexto(document.getElementById("movimentacaoProcesso")?.value || "").toUpperCase();
  const processo = tipoDestino === "celula" ? "CÉLULA INTERNA" : normalizarNomeProcesso(processoSelecionado || processoDigitado);
  const quantidadeEnviada = Number(document.getElementById("movimentacaoQuantidade")?.value || 0);
  const dataEnvio = document.getElementById("movimentacaoDataEnvio")?.value || "";

  let dadosObrigatoriosManejo = null;
  if ((movimentacaoModalContexto?.origem || "manejo") === "manejo" && ["faccao", "celula"].includes(tipoDestino)) {
    const validacaoObrigatoria = validarSilkETecidoAntesDeMovimentar(ordem, setor);
    if (!validacaoObrigatoria.ok) return;
    dadosObrigatoriosManejo = validacaoObrigatoria;
  }

  if (tipoDestino === "faccao" && !processo) {
    toast("Primeiro escolha o processo que a facção vai fazer.");
    return;
  }

  if (tipoDestino === "faccao" && !processoPermitidoNoSetor(processo, setor)) {
    toast("Escolha um processo permitido para este manejo. No sutiã, use Encapar bojo, Sutiã completo, Sutiã montagem ou Alça.");
    return;
  }

  if (!destino) {
    toast(`Depois do processo, selecione para qual ${label.toLowerCase()} será enviado.`);
    return;
  }

  if (tipoDestino === "faccao") {
    const permitidas = getFaccoesPermitidasPorProcesso(processo);
    const destinoPermitido = permitidas.some(faccao => chaveFaccaoCanonica(faccao.nome) === chaveFaccaoCanonica(destino));
    if (!destinoPermitido) {
      toast("Essa facção não está ligada ao processo escolhido. Se for um processo novo, cadastre ou ajuste a facção antes.");
      return;
    }
  }

  if (!quantidadeEnviada || quantidadeEnviada <= 0) {
    toast("Informe uma quantidade válida.");
    return;
  }

  if (!dataEnvio) {
    toast("Informe a data de envio.");
    return;
  }

  const quantidadeMaxima = Number(movimentacaoModalContexto?.quantidadeMaxima || numeroQuantidadeOP(ordem));

  if (quantidadeMaxima > 0 && quantidadeEnviada > quantidadeMaxima) {
    toast(`Quantidade maior que o disponível: ${quantidadeMaxima.toLocaleString("pt-BR")} peças.`);
    return;
  }

  const infoSetor = getInfoManejoSetor(setor);
  const destinoCadastrado = getDestinoMovimento(tipoDestino, destino);

  const dados = {
    origem: movimentacaoModalContexto?.origem || "manejo",
    movimentacaoOrigemId: movimentacaoModalContexto?.movimentacaoOrigemId || "",
    opId: ordem.id,
    numeroOP: ordem.numeroOP || "",
    referencia: ordem.referencia || "",
    cor: ordem.cor || "",
    produtoNome: ordem.produtoNome || "",
    tipoDestino,
    tipoDestinoLabel: label,
    destino,
    destinoId: destinoCadastrado?.id || "",
    processo,
    setor,
    setorLabel: infoSetor.label,
    quantidadeEnviada,
    dataEnvio,
    dataChegada: "",
    falta: 0,
    quantidadeRecebida: 0,
    status: "em_andamento",
    reenvio: Boolean(movimentacaoModalContexto?.movimentacaoOrigemId),
    criadoPor: state.currentUser.uid,
    criadoEm: serverTimestamp(),
    atualizadoPor: state.currentUser.uid,
    atualizadoEm: serverTimestamp()
  };

  try {
    if ((movimentacaoModalContexto?.origem || "manejo") === "manejo" && dadosObrigatoriosManejo) {
      await salvarSilkETecidoAntesDeMovimentar(ordem, setor, dadosObrigatoriosManejo);
    }

    const ref = await addDoc(collection(db, "movimentacoesProducao"), dados);
    const veioDeMovimentacao = Boolean(dados.movimentacaoOrigemId);

    if (veioDeMovimentacao) {
      await setDoc(doc(db, "movimentacoesProducao", dados.movimentacaoOrigemId), {
        status: "encaminhado",
        encaminhado: true,
        encaminhadoParaTipo: tipoDestino,
        encaminhadoParaLabel: label,
        encaminhadoParaDestino: destino,
        encaminhadoParaProcesso: processo,
        movimentacaoDestinoId: ref.id,
        encaminhadoPor: state.currentUser.uid,
        encaminhadoEm: serverTimestamp(),
        atualizadoPor: state.currentUser.uid,
        atualizadoEm: serverTimestamp()
      }, { merge: true });
    }

    await registrarLog(
      dados.reenvio ? "movimentacao_reenvio_criado" : "movimentacao_criada",
      "movimentacaoProducao",
      ref.id,
      `OP ${dados.numeroOP} | ${label} ${destino} | ${processo} | ${quantidadeEnviada} peças${dados.movimentacaoOrigemId ? ` | origem ${dados.movimentacaoOrigemId}` : ""}`
    );

    if (veioDeMovimentacao) {
      await registrarLog(
        "movimentacao_encaminhada",
        "movimentacaoProducao",
        dados.movimentacaoOrigemId,
        `OP ${dados.numeroOP} | saiu da etapa anterior e foi para ${label}: ${destino}`
      );
    }

    fecharModalMovimentacao();

    if (veioDeMovimentacao) {
      abrirPagina(tipoDestino === "celula" ? "celulas" : "faccoes");
    }

    toast(veioDeMovimentacao
      ? `OP saiu da etapa anterior e foi para ${label}: ${destino}.`
      : `OP enviada para ${label}: ${destino}.`);
  } catch (error) {
    console.error(error);
    toast("Erro ao criar movimentação.");
  }
}


function quantidadeDisponivelMovimentacao(mov) {
  if (!mov) return 0;

  const recebida = Number(mov.quantidadeRecebida || 0);
  if (recebida > 0) return recebida;

  return Math.max(Number(mov.quantidadeEnviada || 0) - Number(mov.falta || 0), 0);
}

function podeEncaminharMovimentacao(mov) {
  if (!mov) return false;
  if (mov.status === "finalizado" || mov.status === "encaminhado") return false;
  if (!mov.dataChegada) return false;
  return quantidadeDisponivelMovimentacao(mov) > 0;
}

function encaminharMovimentacao(id, tipoDestino) {
  if (tipoDestino === "faccao") {
    carregarFaccoesSeNecessario();
    carregarPrecosReferenciaSeNecessario();
  }

  if (tipoDestino === "celula") {
    carregarCelulasSeNecessario();
  }

  const mov = state.movimentacoesProducao.find(item => item.id === id);

  if (!mov) {
    toast("Movimentação não encontrada.");
    return;
  }

  if (!podeEncaminharMovimentacao(mov)) {
    toast("Registre a chegada antes de encaminhar para outra etapa.");
    return;
  }

  const quantidadeDisponivel = quantidadeDisponivelMovimentacao(mov);
  const label = labelTipoMovimento(tipoDestino);

  if (tipoDestino === "faccao") {
    carregarPrecosReferenciaSeNecessario();
  }

  abrirModalMovimentacao(mov.opId, tipoDestino, {
    origem: "movimentacao",
    movimentacaoOrigemId: mov.id,
    setor: mov.setor || getManejoSetorAtual(),
    quantidadePadrao: quantidadeDisponivel,
    quantidadeMaxima: quantidadeDisponivel,
    processoPadrao: "",
    destinoPadrao: "",
    forcarEscolhaProcesso: tipoDestino === "faccao",
    origemResumo: `${mov.tipoDestinoLabel || labelTipoMovimento(mov.tipoDestino)} anterior: ${mov.destino || "-"}`,
    titulo: tipoDestino === "faccao" ? "Reenviar para facção" : "Mandar para célula",
    resumo: tipoDestino === "faccao"
      ? "Escolha para qual facção será reenviado e informe qual processo será feito agora."
      : "Escolha para qual célula será enviado. Ao confirmar, a OP já aparecerá na aba Células."
  });
}

function reenviarMovimentacaoParaFaccao(id) {
  encaminharMovimentacao(id, "faccao");
}

function enviarMovimentacaoParaCelula(id) {
  encaminharMovimentacao(id, "celula");
}

function mandarParaFaccao(ordemId) {
  carregarFaccoesSeNecessario();
  carregarPrecosReferenciaSeNecessario();
  abrirModalMovimentacao(ordemId, "faccao", {
    setor: "sutia",
    forcarEscolhaProcesso: true,
    titulo: "Enviar para facção",
    resumo: "Primeiro escolha o processo do sutiã. Depois o sistema mostra somente as facções desse processo, sem duplicar nomes."
  });
}

function mandarParaCelula(ordemId) {
  abrirModalMovimentacao(ordemId, "celula");
}

async function garantirPrecosReferenciaCarregados() {
  if (state.dadosCarregados.precosReferencia && state.precosReferencia.length) return;

  try {
    const snap = await getDocs(query(collection(db, "precosReferencia"), orderBy("referencia", "asc")));
    state.precosReferencia = snap.docs.map(item => ({ id: item.id, ...item.data() }));
    marcarCarregado("precosReferencia");
    preencherProcessosValores();
    renderProcessosValores();
    renderPrecosReferencia();
  } catch (error) {
    console.error(error);
  }
}

function getPrecoReferenciaPorMovimento(mov) {
  const candidatos = getPrecosReferenciaAtivos().filter(preco => {
    return normalizarReferencia(preco.referencia || "") === normalizarReferencia(mov.referencia || "") &&
      normalizarTexto(preco.processo || "") === normalizarTexto(mov.processo || "");
  });

  if (!candidatos.length) return null;

  return candidatos[0];
}

async function gerarPagamentoPorMovimentacao(mov) {
  await garantirPrecosReferenciaCarregados();

  if (!mov || mov.tipoDestino !== "faccao" || !mov.dataChegada) {
    return { ok: false, motivo: "Pagamento só é gerado para facção com data de chegada." };
  }

  const preco = getPrecoReferenciaPorMovimento(mov);

  if (!preco) {
    const pagamentoPendenteId = docIdSeguro(`mov-${mov.id}-sem-valor`);
    const quantidadePendente = Math.max(Number(mov.quantidadeEnviada || 0) - Number(mov.falta || 0), 0);

    await setDoc(doc(db, "entregasPagamento", pagamentoPendenteId), {
      origem: "movimentacao",
      movimentacaoId: mov.id,
      movimentacaoOrigemId: mov.movimentacaoOrigemId || "",
      pagamentoReenvio: Boolean(mov.movimentacaoOrigemId || mov.reenvio || mov.origem === "movimentacao"),
      opId: mov.opId,
      numeroOP: mov.numeroOP || "",
      referencia: mov.referencia || "",
      cor: mov.cor || "",
      produtoNome: mov.produtoNome || "",
      faccao: mov.destino || "",
      precoReferenciaId: "",
      processo: mov.processo || "",
      processoMovimentacao: mov.processo || "",
      servicoId: "",
      servicoNome: mov.processo || "",
      setor: mov.setor || "sutia",
      setorLabel: getLabelSetorPagamento(mov.setor || "sutia"),
      dataEntrega: mov.dataChegada,
      quantidade: quantidadePendente,
      falta: Number(mov.falta || 0),
      descontoDefeito: Number(mov.descontoDefeito ?? mov.defeito ?? 0),
      subtotal: 0,
      valorUnitario: 0,
      total: 0,
      statusPagamento: "sem_valor",
      valorPendente: true,
      avisoPagamento: `Adicionar valor para Ref. ${mov.referencia || "-"} + ${mov.processo || "-"}.`,
      observacoes: "Pagamento ficou em aberto porque não existe valor cadastrado para REF + PROCESSO.",
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp(),
      criadoPor: state.currentUser.uid,
      criadoEm: serverTimestamp()
    }, { merge: true });

    return {
      ok: false,
      semValor: true,
      motivo: `Pagamento em aberto: adicione valor para Ref. ${mov.referencia} + ${mov.processo}.`
    };
  }

  const quantidade = Math.max(Number(mov.quantidadeEnviada || 0) - Number(mov.falta || 0), 0);
  const valorUnitario = Number(preco.valor || 0);
  const subtotal = quantidade * valorUnitario;
  const descontoDefeito = Number(mov.descontoDefeito ?? mov.defeito ?? 0);
  const total = Math.max(subtotal - descontoDefeito, 0);
  // Cada movimentação de facção gera um pagamento próprio.
  // Se a OP for reenviada para facção, ela recebe outro mov.id e gera outro pagamento separado.
  const pagamentoId = docIdSeguro(`mov-${mov.id}-${preco.id}`);
  const pagamentoReenvio = Boolean(mov.movimentacaoOrigemId || mov.reenvio || mov.origem === "movimentacao");

  await setDoc(doc(db, "entregasPagamento", pagamentoId), {
    origem: "movimentacao",
    movimentacaoId: mov.id,
    movimentacaoOrigemId: mov.movimentacaoOrigemId || "",
    pagamentoReenvio,
    opId: mov.opId,
    numeroOP: mov.numeroOP || "",
    referencia: mov.referencia || "",
    cor: mov.cor || "",
    produtoNome: mov.produtoNome || "",
    faccao: mov.destino || "",
    precoReferenciaId: preco.id,
    processo: preco.processo,
    processoMovimentacao: mov.processo || preco.processo,
    servicoId: preco.id,
    servicoNome: preco.processo,
    setor: preco.setor,
    setorLabel: getLabelSetorPagamento(preco.setor),
    dataEntrega: mov.dataChegada,
    quantidade,
    falta: Number(mov.falta || 0),
    descontoDefeito,
    subtotal,
    valorUnitario,
    total,
    statusPagamento: "pendente",
    observacoes: pagamentoReenvio
      ? "Gerado por retorno de reenvio para facção. Este pagamento é separado da etapa anterior."
      : "Gerado pela chegada da movimentação de facção, descontando falta e valor de defeito",
    atualizadoPor: state.currentUser.uid,
    atualizadoEm: serverTimestamp(),
    criadoPor: state.currentUser.uid,
    criadoEm: serverTimestamp()
  }, { merge: true });

  return { ok: true, quantidade, total, subtotal, descontoDefeito, pagamentoReenvio };
}

let chegadaModalMovimentacaoId = "";

function configurarModalChegadaMovimentacao() {
  const form = document.getElementById("formChegadaMovimentacao");
  if (form) {
    form.addEventListener("submit", confirmarChegadaMovimentacao);
  }

  const fechar = document.getElementById("btnFecharModalChegada");
  if (fechar) {
    fechar.addEventListener("click", fecharModalChegadaMovimentacao);
  }

  const cancelar = document.getElementById("btnCancelarModalChegada");
  if (cancelar) {
    cancelar.addEventListener("click", fecharModalChegadaMovimentacao);
  }

  const modal = document.getElementById("modalChegadaMovimentacao");
  if (modal) {
    modal.addEventListener("click", event => {
      if (event.target === modal) fecharModalChegadaMovimentacao();
    });
  }
}


function configurarChegadaManualFaccao() {
  const btnAbrir = document.getElementById("btnAbrirChegadaManualFaccao");
  if (btnAbrir) btnAbrir.addEventListener("click", abrirModalChegadaManualFaccao);

  const form = document.getElementById("formChegadaManualFaccao");
  if (form) form.addEventListener("submit", confirmarChegadaManualFaccao);

  const btnFechar = document.getElementById("btnFecharModalChegadaManualFaccao");
  if (btnFechar) btnFechar.addEventListener("click", fecharModalChegadaManualFaccao);

  const btnCancelar = document.getElementById("btnCancelarChegadaManualFaccao");
  if (btnCancelar) btnCancelar.addEventListener("click", fecharModalChegadaManualFaccao);

  const modal = document.getElementById("modalChegadaManualFaccao");
  if (modal) {
    modal.addEventListener("click", event => {
      if (event.target === modal) fecharModalChegadaManualFaccao();
    });
  }

  const opInput = document.getElementById("chegadaManualOP");
  if (opInput) {
    opInput.addEventListener("blur", preencherChegadaManualPorOP);
    opInput.addEventListener("change", preencherChegadaManualPorOP);
  }
}

function preencherDatalistsChegadaManualFaccao() {
  const faccaoList = document.getElementById("chegadaManualFaccaoList");
  if (faccaoList) {
    const nomes = new Set();
    getFaccoesUnicas().forEach(faccao => {
      if (faccao?.nome) nomes.add(nomeFaccaoCanonico(faccao.nome));
    });
    state.movimentacoesProducao
      .filter(mov => mov.tipoDestino === "faccao" && mov.destino)
      .forEach(mov => nomes.add(nomeFaccaoCanonico(mov.destino)));
    faccaoList.innerHTML = [...nomes].sort().map(nome => `<option value="${escapeHtml(nome)}"></option>`).join("");
  }

  const processoList = document.getElementById("chegadaManualProcessoList");
  if (processoList) {
    const processos = new Set(["ENCAPAR BOJO", "SUTIÃ COMPLETO", "SUTIÃ MONTAGEM", "ALÇA"]);
    state.precosReferencia.forEach(preco => {
      const processo = normalizarNomeProcesso(preco.processo || preco.servicoNome || "");
      if (processo) processos.add(processo);
    });
    state.movimentacoesProducao.forEach(mov => {
      const processo = normalizarNomeProcesso(mov.processo || "");
      if (processo) processos.add(processo);
    });
    processoList.innerHTML = [...processos].sort().map(processo => `<option value="${escapeHtml(processo)}"></option>`).join("");
  }
}

function abrirModalChegadaManualFaccao() {
  preencherDatalistsChegadaManualFaccao();

  const form = document.getElementById("formChegadaManualFaccao");
  if (form) form.reset();

  const dataChegada = document.getElementById("chegadaManualDataChegada");
  if (dataChegada) dataChegada.value = getDataHojeISO();

  document.getElementById("modalChegadaManualFaccao")?.classList.remove("hidden");
  document.getElementById("chegadaManualOP")?.focus();
}

function fecharModalChegadaManualFaccao() {
  document.getElementById("modalChegadaManualFaccao")?.classList.add("hidden");
  document.getElementById("formChegadaManualFaccao")?.reset();
}

function buscarOrdemPorNumeroOP(numeroOP) {
  const numero = limparTexto(numeroOP);
  if (!numero) return null;
  return state.ordens.find(op => limparTexto(op.numeroOP || op.op || op.id) === numero) || null;
}

function preencherChegadaManualPorOP() {
  const numeroOP = document.getElementById("chegadaManualOP")?.value || "";
  const ordem = buscarOrdemPorNumeroOP(numeroOP);
  if (!ordem) return;

  const ref = document.getElementById("chegadaManualRef");
  const cor = document.getElementById("chegadaManualCor");
  const qtd = document.getElementById("chegadaManualQuantidade");

  if (ref && !ref.value) ref.value = ordem.referencia || "";
  if (cor && !cor.value) cor.value = ordem.cor || "";
  if (qtd && !qtd.value) qtd.value = numeroQuantidadeOP(ordem) || "";
}

async function confirmarChegadaManualFaccao(event) {
  event.preventDefault();

  const numeroOP = limparTexto(document.getElementById("chegadaManualOP")?.value || "");
  const referencia = normalizarReferencia(document.getElementById("chegadaManualRef")?.value || "");
  const cor = normalizarCor(document.getElementById("chegadaManualCor")?.value || "");
  const quantidade = Math.max(0, Number(document.getElementById("chegadaManualQuantidade")?.value || 0));
  const processo = normalizarNomeProcesso(document.getElementById("chegadaManualProcesso")?.value || "");
  const faccao = nomeFaccaoCanonico(document.getElementById("chegadaManualFaccao")?.value || "");
  const dataEnvio = document.getElementById("chegadaManualDataEnvio")?.value || "";
  const dataChegada = document.getElementById("chegadaManualDataChegada")?.value || "";
  const observacao = document.getElementById("chegadaManualObs")?.value?.trim() || "";

  if (!numeroOP || !referencia || !cor || !quantidade || !processo || !faccao || !dataChegada) {
    toast("Preencha OP, REF, cor, quantidade, processo, facção e data de chegada.");
    return;
  }

  const ordem = buscarOrdemPorNumeroOP(numeroOP);
  const docId = docIdSeguro(`manual-chegada-faccao-${numeroOP}-${faccao}-${processo}-${dataChegada}-${Date.now()}`);

  const movimentacao = {
    id: docId,
    origem: "chegada_manual_faccao",
    origemManual: true,
    tipoDestino: "faccao",
    tipoDestinoLabel: "Facção",
    opId: ordem?.id || "",
    numeroOP,
    referencia,
    cor,
    produtoNome: ordem?.produtoNome || ordem?.nomeProduto || "",
    setor: ordem?.tipo || ordem?.setor || "sutia",
    destino: faccao,
    processo,
    quantidadeEnviada: quantidade,
    quantidadeRecebida: quantidade,
    dataEnvio,
    dataEnvioNaoInformada: !dataEnvio,
    dataChegada,
    falta: 0,
    descontoDefeito: 0,
    defeito: 0,
    status: "retornou",
    observacoes: observacao || "Chegada manual lançada pela aba Facções.",
    criadoPor: state.currentUser.uid,
    criadoEm: serverTimestamp(),
    atualizadoPor: state.currentUser.uid,
    atualizadoEm: serverTimestamp()
  };

  try {
    await setDoc(doc(db, "movimentacoesProducao", docId), movimentacao, { merge: true });

    const pagamento = await gerarPagamentoPorMovimentacao(movimentacao);

    await registrarLog(
      "chegada_manual_faccao",
      "movimentacaoProducao",
      docId,
      `OP ${numeroOP} | ${faccao} | ${processo} | chegou ${quantidade} peças | lançamento manual`
    );

    fecharModalChegadaManualFaccao();
    renderFaccoesMovimentacoes();

    toast(pagamento.ok
      ? `Chegada manual salva e pagamento gerado: ${formatarMoedaBR(pagamento.total)}.`
      : `Chegada manual salva. ${pagamento.motivo || "Pagamento ficou pendente para conferência."}`);
  } catch (error) {
    console.error(error);
    toast("Erro ao salvar chegada manual. Verifique permissões e tente novamente.");
  }
}

function registrarChegadaMovimentacao(id) {
  const mov = state.movimentacoesProducao.find(item => item.id === id);
  if (!mov) return;

  chegadaModalMovimentacaoId = id;

  const modal = document.getElementById("modalChegadaMovimentacao");
  const titulo = document.getElementById("modalChegadaTitulo");
  const resumo = document.getElementById("modalChegadaResumo");
  const info = document.getElementById("chegadaMovimentacaoInfo");
  const idInput = document.getElementById("chegadaMovimentacaoId");
  const dataInput = document.getElementById("chegadaData");
  const faltaInput = document.getElementById("chegadaFalta");
  const defeitoInput = document.getElementById("chegadaDefeito");
  const grupoDefeito = document.getElementById("grupoChegadaDefeito");
  const mostraDefeito = mov.tipoDestino === "faccao";

  if (grupoDefeito) grupoDefeito.classList.toggle("hidden", !mostraDefeito);

  if (titulo) titulo.textContent = `Registrar chegada - ${mov.tipoDestinoLabel || labelTipoMovimento(mov.tipoDestino)}`;
  if (resumo) resumo.textContent = mostraDefeito
    ? "Informe a data, a falta e o desconto em reais por defeito, se houver."
    : "Informe a data de retorno e a falta, se houver.";

  if (info) {
    info.innerHTML = `
      <strong>OP ${escapeHtml(mov.numeroOP || "-")} | Ref. ${escapeHtml(mov.referencia || "-")}</strong>
      <span>${escapeHtml(mov.destino || "-")} | ${escapeHtml(mov.processo || "-")} | Enviado: ${escapeHtml(Number(mov.quantidadeEnviada || 0).toLocaleString("pt-BR"))} peças</span>
    `;
  }

  if (idInput) idInput.value = id;
  if (dataInput) dataInput.value = mov.dataChegada || getDataHojeISO();
  if (faltaInput) faltaInput.value = Number(mov.falta || 0);
  if (defeitoInput) defeitoInput.value = mostraDefeito ? Number(mov.descontoDefeito ?? mov.defeito ?? 0) : 0;

  modal?.classList.remove("hidden");
  dataInput?.focus();
}

function fecharModalChegadaMovimentacao() {
  document.getElementById("modalChegadaMovimentacao")?.classList.add("hidden");
  document.getElementById("formChegadaMovimentacao")?.reset();
  chegadaModalMovimentacaoId = "";
}

async function confirmarChegadaMovimentacao(event) {
  event.preventDefault();

  const id = document.getElementById("chegadaMovimentacaoId")?.value || chegadaModalMovimentacaoId;
  const mov = state.movimentacoesProducao.find(item => item.id === id);

  if (!mov) {
    toast("Movimentação não encontrada.");
    return;
  }

  const dataChegada = document.getElementById("chegadaData")?.value || "";
  const falta = Math.max(0, Number(document.getElementById("chegadaFalta")?.value || 0));
  const descontoDefeito = mov.tipoDestino === "faccao"
    ? Math.max(0, Number(document.getElementById("chegadaDefeito")?.value || 0))
    : 0;
  const quantidadeRecebida = Math.max(Number(mov.quantidadeEnviada || 0) - falta, 0);

  if (!dataChegada) {
    toast("Informe a data de chegada/retorno.");
    return;
  }

  if (falta > Number(mov.quantidadeEnviada || 0)) {
    toast("A falta não pode ser maior que a quantidade enviada.");
    return;
  }

  try {
    await setDoc(doc(db, "movimentacoesProducao", id), {
      dataChegada,
      falta,
      descontoDefeito,
      defeito: descontoDefeito,
      quantidadeRecebida,
      status: "retornou",
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    const movAtualizada = {
      ...mov,
      dataChegada,
      falta,
      descontoDefeito,
      defeito: descontoDefeito,
      quantidadeRecebida,
      status: "retornou"
    };

    const pagamento = await gerarPagamentoPorMovimentacao(movAtualizada);

    await registrarLog(
      "movimentacao_retorno",
      "movimentacaoProducao",
      id,
      `OP ${mov.numeroOP} | ${mov.destino} | voltou ${quantidadeRecebida} peças | falta ${falta} | desconto defeito ${formatarMoedaBR(descontoDefeito)}`
    );

    fecharModalChegadaMovimentacao();

    if (mov.tipoDestino === "faccao") {
      toast(pagamento.ok
        ? `${pagamento.pagamentoReenvio ? "Chegada de reenvio registrada e novo pagamento gerado" : "Chegada registrada e pagamento gerado"}: ${formatarMoedaBR(pagamento.total)}.`
        : `Chegada registrada. ${pagamento.motivo}`);
    } else {
      toast("Chegada da célula registrada.");
    }
  } catch (error) {
    console.error(error);
    toast("Erro ao registrar chegada.");
  }
}


async function biparMovimentacao(id) {
  const mov = state.movimentacoesProducao.find(item => item.id === id);
  if (!mov) return;

  if (mov.status === "finalizado") {
    toast("Essa movimentação já está bipada.");
    return;
  }

  if (mov.status === "encaminhado") {
    toast("Essa etapa já foi encaminhada para outra fase.");
    return;
  }

  if (!mov.dataChegada) {
    toast("Registre a chegada antes de bipar.");
    return;
  }

  try {
    await setDoc(doc(db, "movimentacoesProducao", id), {
      status: "finalizado",
      bipado: true,
      bipadoPor: state.currentUser.uid,
      bipadoEm: serverTimestamp(),
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    await registrarLog("movimentacao_bipada", "movimentacaoProducao", id, `OP ${mov.numeroOP} | ${mov.destino}`);
    toast("Movimentação bipada.");
  } catch (error) {
    console.error(error);
    toast("Erro ao bipar movimentação.");
  }
}

async function finalizarMovimentacao(id) {
  return biparMovimentacao(id);
}

async function excluirMovimentacao(id) {
  const mov = state.movimentacoesProducao.find(item => item.id === id);
  if (!mov) return;

  if (!confirm(`Excluir movimentação da OP ${mov.numeroOP}?`)) return;

  try {
    await deleteDoc(doc(db, "movimentacoesProducao", id));
    await registrarLog("movimentacao_excluida", "movimentacaoProducao", id, `OP ${mov.numeroOP} | ${mov.destino}`);
    toast("Movimentação excluída.");
  } catch (error) {
    console.error(error);
    toast("Erro ao excluir movimentação.");
  }
}


const LOCAIS_AJUSTE_MIGRACAO_LABELS = {
  MANEJO_AGUARDANDO_DESTINO: "Manejo / aguardando destino",
  DISPONIVEL_CASA: "Disponível casa",
  EM_FACCAO: "Em facção / aguardando chegada",
  EM_CELULA: "Em célula",
  RELATORIO_CELULAS: "Relatório células",
  FINALIZADO_BIPADO: "Finalizado / bipado",
  CANCELADA: "Cancelada"
};

function normalizarStatusParaLocalAjuste(status) {
  const s = limparTexto(status || "").toUpperCase();
  if (!s) return "MANEJO_AGUARDANDO_DESTINO";
  if (s.includes("RELATORIO_CELULAS") || s.includes("CELULAS_SEM_ACAO")) return "RELATORIO_CELULAS";
  if (s.includes("FINALIZADO") || s.includes("BIPADO")) return "FINALIZADO_BIPADO";
  if (s.includes("CANCEL")) return "CANCELADA";
  if (s.includes("DISPONIVEL") && s.includes("CASA")) return "DISPONIVEL_CASA";
  if (s.includes("EM_FACCAO") || s.includes("AGUARDANDO_CHEGADA")) return "EM_FACCAO";
  if (s.includes("EM_CELULA") || s === "PRODUCAO" || s.includes("PRODUÇÃO")) return "EM_CELULA";
  return "MANEJO_AGUARDANDO_DESTINO";
}

function labelLocalAjusteMigracao(local) {
  return LOCAIS_AJUSTE_MIGRACAO_LABELS[local] || local || "Manejo / aguardando destino";
}

function getSetorPrincipalOrdem(op) {
  return getTipoPecaManejoOP(op) === "calcinha" ? "calcinha" : "sutia";
}

function getMovimentacoesDaOrdemOrdenadas(opId) {
  return getMovimentacoesDaOrdem(opId).sort((a, b) => getMovTimestamp(b) - getMovTimestamp(a));
}

function getUltimaMovimentacaoOrdem(op) {
  const movimentos = getMovimentacoesDaOrdemOrdenadas(op?.id);
  return movimentos[0] || null;
}

function montarTextoBuscaGlobalOP(op, movimentos = []) {
  return normalizarTexto([
    op?.numeroOP,
    op?.numeroOPExterno,
    op?.referencia,
    op?.cor,
    op?.produtoNome,
    op?.tipoPeca,
    op?.tipoPecaLabel,
    op?.status,
    op?.statusMigracaoLigia,
    op?.localAtualMigracao,
    op?.relatorioMigracao,
    op?.faseOriginalLigia,
    op?.faccaoOriginalLigia,
    op?.dataOriginalLigia,
    op?.chegadaOriginalLigia,
    op?.producaoOriginalLigia,
    op?.celulaOriginalLigia,
    op?.necessidadeOriginalLigia,
    op?.destinoAtualMigracao,
    op?.processoAtualMigracao,
    op?.proximoDestinoMigracao,
    ...movimentos.flatMap(mov => [mov.destino, mov.processo, mov.tipoDestinoLabel, mov.status, mov.dataEnvio, mov.dataChegada])
  ].join(" "));
}

function getLocalizacaoAtualOrdem(op) {
  const movimentos = getMovimentacoesDaOrdemOrdenadas(op?.id);
  const ultima = movimentos[0] || null;
  const localAjustado = normalizarStatusParaLocalAjuste(op?.localAtualMigracao || op?.statusMigracaoLigia || "");
  const destinoAjustado = op?.destinoAtualMigracao || op?.faccaoAtual || op?.celulaAtual || "";
  const processoAjustado = op?.processoAtualMigracao || "";

  if (op?.ajusteManualMigracao) {
    return {
      local: labelLocalAjusteMigracao(localAjustado),
      tipo: localAjustado === "EM_CELULA" ? "Célula" : localAjustado === "EM_FACCAO" ? "Facção" : "Ajuste manual",
      destino: destinoAjustado || op?.proximoDestinoMigracao || "-",
      processo: processoAjustado || ultima?.processo || "-",
      dataEnvio: op?.dataEnvioAtualMigracao || ultima?.dataEnvio || "",
      dataChegada: op?.dataChegadaAtualMigracao || ultima?.dataChegada || "",
      status: "Corrigida manualmente",
      statusClasse: "info",
      origem: "Ajuste manual"
    };
  }

  if (op?.ocultarDoManejo || ["RELATORIO_CELULAS", "FINALIZADO_BIPADO", "CANCELADA"].includes(localAjustado)) {
    return {
      local: labelLocalAjusteMigracao(localAjustado),
      tipo: localAjustado === "RELATORIO_CELULAS" ? "Relatório" : "Histórico",
      destino: op?.celulaOriginalLigia || op?.destinoAtualMigracao || op?.faccaoOriginalLigia || "-",
      processo: op?.processoAtualMigracao || op?.faseOriginalLigia || "-",
      dataEnvio: op?.producaoOriginalLigia || op?.dataEnvioAtualMigracao || "",
      dataChegada: op?.dataChegadaAtualMigracao || op?.chegadaOriginalLigia || "",
      status: op?.relatorioMigracao || labelLocalAjusteMigracao(localAjustado),
      statusClasse: localAjustado === "CANCELADA" ? "danger" : "bipado",
      origem: "Relatório separado"
    };
  }

  if (ultima) {
    const tipoLabel = ultima.tipoDestinoLabel || labelTipoMovimento(ultima.tipoDestino);
    if (ultima.status === "finalizado") {
      return {
        local: "Finalizado / bipado",
        tipo: tipoLabel,
        destino: ultima.destino || "-",
        processo: ultima.processo || "-",
        dataEnvio: ultima.dataEnvio || "",
        dataChegada: ultima.dataChegada || "",
        status: labelStatusMovimento(ultima.status),
        statusClasse: classeStatusMovimento(ultima.status),
        origem: "Movimentação"
      };
    }

    if (ultima.status === "retornou") {
      return {
        local: `Retornou de ${tipoLabel.toLowerCase()}`,
        tipo: tipoLabel,
        destino: ultima.destino || "-",
        processo: ultima.processo || "-",
        dataEnvio: ultima.dataEnvio || "",
        dataChegada: ultima.dataChegada || "",
        status: labelStatusMovimento(ultima.status),
        statusClasse: classeStatusMovimento(ultima.status),
        origem: "Movimentação"
      };
    }

    return {
      local: `${tipoLabel} / em andamento`,
      tipo: tipoLabel,
      destino: ultima.destino || "-",
      processo: ultima.processo || "-",
      dataEnvio: ultima.dataEnvio || "",
      dataChegada: ultima.dataChegada || "",
      status: labelStatusMovimento(ultima.status),
      statusClasse: classeStatusMovimento(ultima.status),
      origem: "Movimentação"
    };
  }

  const setor = getSetorPrincipalOrdem(op);
  const manejo = getManejoDaOrdem(op, setor);
  if (manejo) {
    return {
      local: labelLocalAjusteMigracao(localAjustado),
      tipo: getInfoManejoSetor(setor).label,
      destino: manejo.faccao || manejo.celu || manejo.proximoDestino || "Manejo",
      processo: manejo.fase || processoAjustado || "-",
      dataEnvio: manejo.data || "",
      dataChegada: manejo.chegada || "",
      status: labelLocalAjusteMigracao(localAjustado),
      statusClasse: "pending",
      origem: "Manejo"
    };
  }

  return {
    local: labelLocalAjusteMigracao(localAjustado),
    tipo: op?.tipoPecaLabel || "OP",
    destino: destinoAjustado || op?.faccaoOriginalLigia || op?.celulaOriginalLigia || "-",
    processo: processoAjustado || op?.faseOriginalLigia || "-",
    dataEnvio: op?.dataEnvioAtualMigracao || op?.dataOriginalLigia || "",
    dataChegada: op?.dataChegadaAtualMigracao || op?.chegadaOriginalLigia || "",
    status: labelLocalAjusteMigracao(localAjustado),
    statusClasse: "pending",
    origem: "OP"
  };
}

function formatarFaltaRastreamentoOP(op) {
  const valor = op?.faltaOriginalLigia;
  if (valor === undefined || valor === null || valor === "") return "0";
  const numero = Number(valor);
  if (Number.isFinite(numero)) return numero.toLocaleString("pt-BR");
  return String(valor);
}

function formatarDataRastreamento(valor) {
  if (!valor) return "";
  return dataISOParaBR(valor) || String(valor);
}

function timestampDataRastreamento(valor, ordemPadrao = 0) {
  if (!valor) return ordemPadrao;
  const texto = String(valor).trim().toLowerCase();

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime();

  const meses = {
    jan: 0, janeiro: 0, fev: 1, fevereiro: 1, mar: 2, marco: 2, março: 2,
    abr: 3, abril: 3, mai: 4, maio: 4, jun: 5, junho: 5, jul: 6, julho: 6,
    ago: 7, agosto: 7, set: 8, setembro: 8, out: 9, outubro: 9, nov: 10, novembro: 10, dez: 11, dezembro: 11
  };

  const barraNumero = texto.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (barraNumero) {
    const ano = barraNumero[3] ? Number(barraNumero[3].length === 2 ? `20${barraNumero[3]}` : barraNumero[3]) : 2026;
    return new Date(ano, Number(barraNumero[2]) - 1, Number(barraNumero[1])).getTime();
  }

  const barraMes = texto.match(/^(\d{1,2})\/([a-zçãéíóú]+)$/i);
  if (barraMes && meses[barraMes[2]] !== undefined) {
    return new Date(2026, meses[barraMes[2]], Number(barraMes[1])).getTime();
  }

  return ordemPadrao;
}

function inferirProcessoHistoricoLigia(op, nomeFaccao = "") {
  const fase = normalizarTexto(op?.faseOriginalLigia || "").toUpperCase();
  const processos = getProcessosPadraoDaFaccao(nomeFaccao).map(normalizarNomeProcesso);

  // Na planilha da Lígia, a coluna FACÇÃO da primeira ida geralmente representa o bojo.
  // Quando a OP está em FASE=PRODUÇÃO, ela já passou pela facção inicial e foi para célula.
  if (processos.includes("ENCAPAR BOJO")) return "ENCAPAR BOJO";
  if (fase.includes("BOJO") || fase.includes("ENCAP")) return "ENCAPAR BOJO";

  return processos[0] || op?.processoAtualMigracao || op?.faseOriginalLigia || "Processo não informado";
}

function adicionarEventoRastreamento(eventos, evento) {
  if (!evento || !evento.titulo) return;

  const chave = normalizarTexto([
    evento.titulo,
    evento.tipo,
    evento.destino,
    evento.processo,
    evento.data,
    evento.status
  ].join("|"));

  if (eventos.some(item => item._chave === chave)) return;
  eventos.push({ ...evento, _chave: chave });
}

function getLinhaTempoRastreamentoOP(op) {
  const eventos = [];
  let ordemPadrao = 1;

  if (op?.dataTecidoOriginalLigia) {
    adicionarEventoRastreamento(eventos, {
      titulo: "Tecido preenchido",
      tipo: "Preparação",
      destino: "Manejo",
      processo: "Tecido",
      data: op.dataTecidoOriginalLigia,
      status: "Informado na planilha",
      detalhe: "Data de tecido encontrada na planilha da Lígia.",
      ordem: ordemPadrao++
    });
  }

  const faccaoInicial = limparTexto(op?.faccaoOriginalLigia || "").toUpperCase();
  if (faccaoInicial) {
    const processoInicial = inferirProcessoHistoricoLigia(op, faccaoInicial);
    adicionarEventoRastreamento(eventos, {
      titulo: "Enviado para facção",
      tipo: "Facção",
      destino: faccaoInicial,
      processo: processoInicial,
      data: op?.dataOriginalLigia || "",
      status: op?.chegadaOriginalLigia ? "Já retornou" : "Aguardando chegada",
      detalhe: processoInicial === "ENCAPAR BOJO" ? `${faccaoInicial} encapou o bojo desta OP.` : `Primeira facção registrada: ${faccaoInicial}.`,
      ordem: ordemPadrao++
    });

    if (op?.chegadaOriginalLigia) {
      adicionarEventoRastreamento(eventos, {
        titulo: "Chegada da facção",
        tipo: "Retorno",
        destino: faccaoInicial,
        processo: processoInicial,
        data: op.chegadaOriginalLigia,
        status: "Chegou",
        detalhe: `Retornou da facção ${faccaoInicial}.`,
        ordem: ordemPadrao++
      });
    }
  }

  const faseOriginal = normalizarTexto(op?.faseOriginalLigia || "").toUpperCase();
  const celulaOriginal = limparTexto(op?.celulaOriginalLigia || "").toUpperCase();
  if (op?.producaoOriginalLigia || faseOriginal === "PRODUCAO" || faseOriginal === "PRODUÇÃO") {
    adicionarEventoRastreamento(eventos, {
      titulo: "Foi para produção / célula",
      tipo: "Célula",
      destino: celulaOriginal || op?.destinoAtualMigracao || "CÉLULA NÃO INFORMADA",
      processo: "PRODUÇÃO",
      data: op?.producaoOriginalLigia || "",
      status: "Já nas células",
      detalhe: "Pela regra definida, FASE=PRODUÇÃO fica em relatório separado e não precisa movimentar mais.",
      ordem: ordemPadrao++
    });
  }

  const movimentos = getMovimentacoesDaOrdem(op?.id)
    .slice()
    .sort((a, b) => {
      const dataA = timestampDataRastreamento(a.dataEnvio || a.criadoEm?.toDate?.()?.toISOString?.() || "", a.criadoEm?.seconds || 0);
      const dataB = timestampDataRastreamento(b.dataEnvio || b.criadoEm?.toDate?.()?.toISOString?.() || "", b.criadoEm?.seconds || 0);
      return dataA - dataB;
    });

  movimentos.forEach(mov => {
    const tipo = mov.tipoDestinoLabel || labelTipoMovimento(mov.tipoDestino);
    adicionarEventoRastreamento(eventos, {
      titulo: `Enviado para ${tipo.toLowerCase()}`,
      tipo,
      destino: mov.destino || "-",
      processo: mov.processo || "-",
      data: mov.dataEnvio || "",
      status: labelStatusMovimento(mov.status),
      detalhe: mov.movimentacaoOrigemId ? "Movimento criado por reenvio/continuação." : "Movimento registrado no sistema.",
      ordem: ordemPadrao++
    });

    if (mov.dataChegada) {
      adicionarEventoRastreamento(eventos, {
        titulo: `Chegada de ${tipo.toLowerCase()}`,
        tipo: "Retorno",
        destino: mov.destino || "-",
        processo: mov.processo || "-",
        data: mov.dataChegada || "",
        status: mov.falta ? `Chegou com falta ${mov.falta}` : "Chegou",
        detalhe: `Quantidade recebida: ${Number(mov.quantidadeRecebida || mov.quantidadeEnviada || 0).toLocaleString("pt-BR")}.`,
        ordem: ordemPadrao++
      });
    }
  });

  if (op?.ajusteManualMigracao) {
    const local = getLocalizacaoAtualOrdem(op);
    adicionarEventoRastreamento(eventos, {
      titulo: "Correção manual de local",
      tipo: "Ajuste",
      destino: local.destino || "-",
      processo: local.processo || "-",
      data: op?.dataEnvioAtualMigracao || op?.dataChegadaAtualMigracao || "",
      status: "Corrigida manualmente",
      detalhe: `Local atual corrigido para: ${local.local}.`,
      ordem: ordemPadrao++
    });
  }

  const localAtual = getLocalizacaoAtualOrdem(op);
  adicionarEventoRastreamento(eventos, {
    titulo: "Local atual",
    tipo: localAtual.tipo || "Atual",
    destino: localAtual.destino || "-",
    processo: localAtual.processo || "-",
    data: localAtual.dataChegada || localAtual.dataEnvio || "",
    status: localAtual.status || localAtual.local || "Atual",
    detalhe: `A OP aparece agora como: ${localAtual.local}.`,
    ordem: ordemPadrao++
  });

  return eventos
    .map((evento, indice) => ({
      ...evento,
      ordemFinal: timestampDataRastreamento(evento.data, evento.ordem || indice + 1) || evento.ordem || indice + 1
    }))
    .sort((a, b) => a.ordemFinal - b.ordemFinal);
}

function renderLinhaHistoricoRastreamentoOP(op) {
  const eventos = getLinhaTempoRastreamentoOP(op);
  const faccaoInicial = limparTexto(op?.faccaoOriginalLigia || "").toUpperCase();
  const processoInicial = faccaoInicial ? inferirProcessoHistoricoLigia(op, faccaoInicial) : "";
  const quemEncapou = processoInicial === "ENCAPAR BOJO" && faccaoInicial ? faccaoInicial : "Não identificado";

  return `
    <tr class="rastreamento-historico-row">
      <td colspan="12">
        <div class="rastreamento-historico-card">
          <div class="rastreamento-historico-head">
            <div>
              <strong>Por onde a OP ${escapeHtml(op.numeroOP || op.id || "-")} passou</strong>
              <span>Quem encapou: <b>${escapeHtml(quemEncapou)}</b>${processoInicial ? ` · Processo inicial: ${escapeHtml(processoInicial)}` : ""}</span>
            </div>
            ${ehAdmin() ? `<button class="btn btn-sm btn-primary" onclick="abrirModalAjusteMigracao('${op.id}')">Mover / corrigir local</button>` : ""}
          </div>
          <div class="rastreamento-timeline">
            ${eventos.map((evento, index) => `
              <div class="rastreamento-step">
                <div class="rastreamento-step-dot">${index + 1}</div>
                <div class="rastreamento-step-body">
                  <strong>${escapeHtml(evento.titulo)}</strong>
                  <span>${escapeHtml(evento.tipo || "-")} · ${escapeHtml(evento.destino || "-")} · ${escapeHtml(evento.processo || "-")}</span>
                  <small>${escapeHtml(formatarDataRastreamento(evento.data) || "Sem data")} · ${escapeHtml(evento.status || "-")}</small>
                  ${evento.detalhe ? `<p>${escapeHtml(evento.detalhe)}</p>` : ""}
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </td>
    </tr>
  `;
}

function deveMostrarHistoricoRastreamento(op, busca, totalResultados) {
  if (!busca) return false;
  const opTexto = normalizarTexto(op?.numeroOP || op?.id || "");
  return totalResultados <= 3 || opTexto === busca;
}


const ordensEmBipadoDireto = new Set();
const ordensEnviandoManejoDireto = new Set();
const FASE_MANEJO_AGUARDANDO_MOVIMENTACAO = "AGUARDANDO MOVIMENTAÇÃO";

async function enviarOrdemParaManejoDireto(opId) {
  const id = String(opId || "").trim();
  if (!id || ordensEnviandoManejoDireto.has(id)) return;

  const ordem = state.ordens.find(item => String(item.id) === id);
  if (!ordem) {
    toast("OP não encontrada no Rastreamento.");
    return;
  }

  ordensEnviandoManejoDireto.add(id);
  try {
    const setor = getTipoPecaManejoOP(ordem);
    const infoSetor = getInfoManejoSetor(setor);
    const manejoExistente = getManejoDaOrdem(ordem, setor) || {};

    const manejo = {
      ...manejoExistente,
      setor,
      setorLabel: infoSetor.label,
      fase: FASE_MANEJO_AGUARDANDO_MOVIMENTACAO,
      faccao: "",
      chegada: "",
      falta: 0,
      celu: "",
      status: "organizada",
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    };

    if (!manejoExistente?.criadoEm) {
      manejo.criadoPor = state.currentUser.uid;
      manejo.criadoEm = serverTimestamp();
    }

    const patch = montarPatchManejoSetor(setor, manejo, "organizada", {
      ocultarDoManejo: false,
      localAtualMigracao: "MANEJO_AGUARDANDO_DESTINO",
      statusMigracaoLigia: "MANEJO_ABERTO_AGUARDANDO_DESTINO",
      relatorioMigracao: "Manejo / aguardando movimentação",
      ajusteManualMigracao: true,
      destinoAtualMigracao: "MANEJO",
      processoAtualMigracao: FASE_MANEJO_AGUARDANDO_MOVIMENTACAO,
      proximoDestinoMigracao: "",
      dataEnvioAtualMigracao: "",
      dataChegadaAtualMigracao: "",
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    });

    await setDoc(doc(db, "ordensProducao", id), patch, { merge: true });

    await registrarLog(
      "op_enviada_manejo_pelo_rastreamento",
      "ordemProducao",
      id,
      `OP ${ordem.numeroOP || ordem.numeroOPExterno || id} | enviada ao Manejo ${infoSetor.label} | fase ${FASE_MANEJO_AGUARDANDO_MOVIMENTACAO}`
    );

    toast(`OP ${ordem.numeroOP || ordem.numeroOPExterno || id} enviada para o Manejo com a fase ${FASE_MANEJO_AGUARDANDO_MOVIMENTACAO}.`);
  } catch (error) {
    console.error("Erro ao enviar OP para o Manejo pelo Rastreamento.", error);
    toast(error?.code === "permission-denied"
      ? "Seu usuário não possui permissão para enviar esta OP ao Manejo."
      : "Erro ao enviar a OP para o Manejo.");
  } finally {
    ordensEnviandoManejoDireto.delete(id);
  }
}

async function biparOrdemDireto(opId) {
  const id = String(opId || "").trim();
  if (!id || ordensEmBipadoDireto.has(id)) return;

  const ordem = state.ordens.find(item => String(item.id) === id);
  if (!ordem) {
    toast("OP não encontrada no Rastreamento.");
    return;
  }

  ordensEmBipadoDireto.add(id);
  try {
    const hoje = getDataHojeISO();
    const movimentacoesAbertas = state.movimentacoesProducao
      .filter(mov => {
        if (String(mov.opId || "") !== id) return false;
        return !["finalizado", "encaminhado"].includes(String(mov.status || "em_andamento"));
      })
      .sort((a, b) => getMovTimestamp(b) - getMovTimestamp(a));

    const movimentacaoPrincipal = movimentacoesAbertas[0] || null;
    const quantidade = Math.max(0, Number(
      movimentacaoPrincipal?.quantidadeRecebida ||
      movimentacaoPrincipal?.quantidadeEnviada ||
      ordem.quantidade ||
      ordem.quantidadeTotal ||
      0
    ));
    const processo = limparTexto(
      movimentacaoPrincipal?.processo ||
      ordem.processoAtualMigracao ||
      ordem.faseOriginalLigia ||
      "FINALIZAÇÃO"
    ).toUpperCase() || "FINALIZAÇÃO";
    const movimentacaoId = movimentacaoPrincipal?.id || docIdSeguro(`bipado-direto-${id}`);
    const numeroOP = ordem.numeroOP || ordem.numeroOPExterno || id;

    const lote = writeBatch(db);

    if (movimentacaoPrincipal) {
      lote.set(doc(db, "movimentacoesProducao", movimentacaoId), {
        status: "finalizado",
        bipado: true,
        bipadoInternamente: true,
        origemBipado: "rastreamento_direto_op",
        encerradoAutomaticamente: true,
        bipadoPor: state.currentUser.uid,
        bipadoEm: serverTimestamp(),
        atualizadoPor: state.currentUser.uid,
        atualizadoEm: serverTimestamp()
      }, { merge: true });
    } else {
      lote.set(doc(db, "movimentacoesProducao", movimentacaoId), {
        id: movimentacaoId,
        origem: "rastreamento_bipado_direto",
        origemManual: true,
        opId: id,
        numeroOP,
        referencia: ordem.referencia || "",
        cor: ordem.cor || "",
        produtoNome: ordem.produtoNome || ordem.nomeProduto || "",
        setor: getSetorPrincipalOrdem(ordem),
        tipoDestino: "interno",
        tipoDestinoLabel: "Interno",
        destino: "FINALIZADO / BIPADO",
        processo,
        quantidadeEnviada: quantidade,
        quantidadeRecebida: quantidade,
        dataEnvio: ordem.dataEnvioAtualMigracao || ordem.dataOriginalLigia || "",
        dataChegada: hoje,
        falta: 0,
        descontoDefeito: 0,
        defeito: 0,
        status: "finalizado",
        bipado: true,
        bipadoInternamente: true,
        origemBipado: "rastreamento_direto_op",
        bipadoPor: state.currentUser.uid,
        bipadoEm: serverTimestamp(),
        atualizadoPor: state.currentUser.uid,
        atualizadoEm: serverTimestamp(),
        criadoPor: state.currentUser.uid,
        criadoEm: serverTimestamp()
      }, { merge: true });
    }

    movimentacoesAbertas.slice(1).forEach(mov => {
      lote.set(doc(db, "movimentacoesProducao", String(mov.id)), {
        status: "encaminhado",
        encaminhado: true,
        encaminhadoParaTipo: "finalizado",
        encaminhadoParaLabel: "Finalizado / bipado",
        encaminhadoParaDestino: "FINALIZADO / BIPADO",
        movimentacaoDestinoId: movimentacaoId,
        encerradoAutomaticamente: true,
        encerradoPorBipadoDireto: true,
        atualizadoPor: state.currentUser.uid,
        atualizadoEm: serverTimestamp()
      }, { merge: true });
    });

    lote.set(doc(db, "ordensProducao", id), {
      localAtualMigracao: "FINALIZADO_BIPADO",
      statusMigracaoLigia: "FINALIZADO_BIPADO",
      relatorioMigracao: "Finalizado / bipado",
      ajusteManualMigracao: true,
      ocultarDoManejo: true,
      destinoAtualMigracao: "FINALIZADO / BIPADO",
      processoAtualMigracao: processo,
      dataChegadaAtualMigracao: hoje,
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    await lote.commit();

    await registrarLog(
      "op_bipada_direto_rastreamento",
      "movimentacaoProducao",
      movimentacaoId,
      `OP ${numeroOP} | bipada diretamente no Rastreamento | ${quantidade} peças | ${movimentacoesAbertas.length} movimentação(ões) aberta(s) encerrada(s)`
    );

    toast(`OP ${numeroOP} bipada e enviada para o relatório de bipadas.`);
  } catch (error) {
    console.error("Erro ao bipar OP diretamente pelo Rastreamento.", error);
    toast(error?.code === "permission-denied"
      ? "Seu usuário não possui permissão para bipar esta OP."
      : "Erro ao bipar a OP pelo Rastreamento.");
  } finally {
    ordensEmBipadoDireto.delete(id);
  }
}

function renderLinhaRastreamentoGlobalOP(op) {
  const local = getLocalizacaoAtualOrdem(op);
  const quantidade = Number(op?.quantidade || 0);
  const jaPossuiBipadoReal = /finalizado|bipado/i.test(`${local.local || ""} ${local.status || ""}`);
  const botaoBipar = !jaPossuiBipadoReal
    ? `<button class="btn btn-sm btn-bipado" data-bipar-op-direto="${escapeHtml(op.id)}" onclick="biparOrdemDireto('${op.id}')">Bipar</button>`
    : `<span class="badge ok">Bipado ✓</span>`;
  const botaoManejo = `<button class="btn btn-sm" data-enviar-manejo-direto="${escapeHtml(op.id)}" onclick="enviarOrdemParaManejoDireto('${op.id}')">Enviar para manejo</button>`;
  const acoes = ehAdmin()
    ? `${botaoBipar}
       ${botaoManejo}
       <button class="btn btn-sm btn-primary" onclick="abrirModalAjusteMigracao('${op.id}')">Editar local</button>
       <button class="btn btn-sm" onclick="filtrarManejosPorOP('${escapeHtml(op.numeroOP || op.id)}')">Abrir manejo</button>`
    : `${botaoBipar}
       ${botaoManejo}
       <button class="btn btn-sm" onclick="filtrarManejosPorOP('${escapeHtml(op.numeroOP || op.id)}')">Abrir manejo</button>`;

  return `
    <tr class="rastreamento-global-row">
      <td><strong>${escapeHtml(op.numeroOP || op.id || "-")}</strong></td>
      <td><strong>${escapeHtml(op.referencia || "-")}</strong></td>
      <td>${escapeHtml(op.cor || "-")}</td>
      <td>${escapeHtml(local.tipo || op.tipoPecaLabel || "OP")}</td>
      <td>
        <strong>${escapeHtml(local.local || "-")}</strong><br>
        <small>${escapeHtml(local.destino || "-")}</small>
      </td>
      <td>${escapeHtml(local.processo || "-")}</td>
      <td><strong>${escapeHtml(quantidade.toLocaleString("pt-BR"))}</strong></td>
      <td>${escapeHtml(dataISOParaBR(local.dataEnvio) || local.dataEnvio || "-")}</td>
      <td>${escapeHtml(dataISOParaBR(local.dataChegada) || local.dataChegada || "-")}</td>
      <td>${escapeHtml(formatarFaltaRastreamentoOP(op))}</td>
      <td>
        <span class="badge ${escapeHtml(local.statusClasse || "pending")}">${escapeHtml(local.status || "-")}</span><br>
        <small>${escapeHtml(local.origem || "-")}</small>
      </td>
      <td>${acoes}</td>
    </tr>
  `;
}

function renderRastreamento() {
  const tbody = document.getElementById("listaRastreamento");
  if (!tbody) return;

  const buscaOriginal = document.getElementById("buscaRastreamento")?.value || "";
  const busca = normalizarTexto(buscaOriginal);

  // Busca global: quando digita uma OP/ref/cor/destino, pesquisa também em ordens que não têm movimentação ativa
  // ou que foram separadas em relatórios, como FASE=PRODUÇÃO.
  if (busca) {
    const ordensEncontradas = state.ordens
      .filter(op => montarTextoBuscaGlobalOP(op, getMovimentacoesDaOrdem(op.id)).includes(busca))
      .sort((a, b) => {
        const aExata = normalizarTexto(a.numeroOP || a.id) === busca ? 0 : 1;
        const bExata = normalizarTexto(b.numeroOP || b.id) === busca ? 0 : 1;
        if (aExata !== bExata) return aExata - bExata;
        return String(a.numeroOP || "").localeCompare(String(b.numeroOP || ""), "pt-BR", { numeric: true });
      });

    const total = ordensEncontradas.length;
    const emAndamento = ordensEncontradas.filter(op => {
      const loc = getLocalizacaoAtualOrdem(op);
      return /andamento|facção|faccao|célula|celula/i.test(`${loc.local} ${loc.status}`);
    }).length;
    const retornaram = ordensEncontradas.filter(op => /retornou/i.test(getLocalizacaoAtualOrdem(op).local)).length;
    const finalizadas = ordensEncontradas.filter(op => {
      const loc = getLocalizacaoAtualOrdem(op);
      return /bipado|finalizado|relatório células|relatorio celulas/i.test(`${loc.local} ${loc.status}`);
    }).length;

    const setText = (id, valor) => {
      const el = document.getElementById(id);
      if (el) el.textContent = Number(valor || 0).toLocaleString("pt-BR");
    };

    setText("rastTotalMovimentacoes", total);
    setText("rastEmAndamento", emAndamento);
    setText("rastRetornaram", retornaram);
    setText("rastFinalizadas", finalizadas);

    if (!ordensEncontradas.length) {
      tbody.innerHTML = `<tr><td colspan="12" class="empty">Nenhuma OP encontrada. Confira se o número foi digitado corretamente.</td></tr>`;
      return;
    }

    tbody.innerHTML = ordensEncontradas.map(op => {
      const linhaPrincipal = renderLinhaRastreamentoGlobalOP(op);
      const historico = deveMostrarHistoricoRastreamento(op, busca, total) ? renderLinhaHistoricoRastreamentoOP(op) : "";
      return linhaPrincipal + historico;
    }).join("");
    return;
  }

  let movimentos = [...state.movimentacoesProducao];

  const total = movimentos.length;
  const emAndamento = movimentos.filter(mov => mov.status === "em_andamento" || !mov.status).length;
  const retornaram = movimentos.filter(mov => mov.status === "retornou" || mov.status === "encaminhado").length;
  const finalizadas = movimentos.filter(mov => mov.status === "finalizado").length;

  const setText = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.textContent = Number(valor || 0).toLocaleString("pt-BR");
  };

  setText("rastTotalMovimentacoes", total);
  setText("rastEmAndamento", emAndamento);
  setText("rastRetornaram", retornaram);
  setText("rastFinalizadas", finalizadas);

  if (!movimentos.length) {
    tbody.innerHTML = `<tr><td colspan="12" class="empty">Nenhuma movimentação encontrada. Digite o número de uma OP para fazer a busca global.</td></tr>`;
    return;
  }

  movimentos = movimentos.sort((a, b) => getMovTimestamp(b) - getMovTimestamp(a));

  tbody.innerHTML = movimentos.map(mov => {
    const ordem = getOrdemDaMovimentacao(mov);
    const editarLocal = ordem && ehAdmin()
      ? `<button class="btn btn-sm btn-primary" onclick="abrirModalAjusteMigracao('${ordem.id}')">Editar local</button>`
      : "";

    return `
      <tr>
        <td><strong>${escapeHtml(mov.numeroOP || "-")}</strong></td>
        <td><strong>${escapeHtml(mov.referencia || "-")}</strong></td>
        <td>${escapeHtml(mov.cor || "-")}</td>
        <td>${escapeHtml(mov.tipoDestinoLabel || labelTipoMovimento(mov.tipoDestino))}</td>
        <td><strong>${escapeHtml(mov.destino || "-")}</strong></td>
        <td>${escapeHtml(mov.processo || "-")}</td>
        <td><strong>${escapeHtml(Number(mov.quantidadeEnviada || 0).toLocaleString("pt-BR"))}</strong></td>
        <td>${escapeHtml(dataISOParaBR(mov.dataEnvio) || mov.dataEnvio || "-")}</td>
        <td>${escapeHtml(dataISOParaBR(mov.dataChegada) || mov.dataChegada || "-")}</td>
        <td>${escapeHtml(Number(mov.falta || 0).toLocaleString("pt-BR"))}</td>
        <td>
          <span class="badge ${classeStatusMovimento(mov.status)}">
            ${escapeHtml(labelStatusMovimento(mov.status))}
          </span>
        </td>
        <td>
          ${editarLocal}
          ${mov.status === "encaminhado" ? `<span class="badge info">Encaminhado</span>` : ""}
          ${mov.status !== "finalizado" && mov.status !== "encaminhado" ? `<button class="btn btn-sm btn-success" onclick="registrarChegadaMovimentacao('${mov.id}')">Chegada</button>` : ""}
          ${mov.status === "finalizado" ? `<span class="badge ok">Bipado ✓</span>` : mov.status === "encaminhado" ? "" : `<button class="btn btn-sm btn-bipado" onclick="biparMovimentacao('${mov.id}')">Bipar</button>`}
          ${ehAdmin() ? `<button class="btn btn-sm btn-danger" onclick="excluirMovimentacao('${mov.id}')">Excluir</button>` : ""}
        </td>
      </tr>
    `;
  }).join("");
}

function configurarPagamentos() {
  const formPreco = document.getElementById("formPrecoReferencia");
  if (formPreco) {
    formPreco.addEventListener("submit", salvarPrecoReferencia);
  }

  const cancelarPreco = document.getElementById("btnCancelarPrecoReferencia");
  if (cancelarPreco) {
    cancelarPreco.addEventListener("click", limparFormPrecoReferencia);
  }

  const toggleValores = document.getElementById("btnToggleGerenciarValores");
  if (toggleValores) {
    toggleValores.addEventListener("click", abrirGerenciarValores);
  }

  const fecharValores = document.getElementById("btnFecharGerenciarValores");
  if (fecharValores) {
    fecharValores.addEventListener("click", fecharGerenciarValores);
  }

  const processoAtivo = document.getElementById("valorProcessoAtivo");
  if (processoAtivo) {
    processoAtivo.addEventListener("change", () => {
      aplicarProcessoValorSelecionado(processoAtivo.value);
      renderPrecosReferencia();
    });
  }

  const buscaProcesso = document.getElementById("buscaProcessoValor");
  if (buscaProcesso) {
    buscaProcesso.addEventListener("input", renderProcessosValores);
  }

  const buscaPrecos = document.getElementById("buscaPrecosReferencia");
  if (buscaPrecos) {
    buscaPrecos.addEventListener("input", renderPrecosReferencia);
  }

  const usarNovoProcesso = document.getElementById("btnUsarNovoProcesso");
  if (usarNovoProcesso) {
    usarNovoProcesso.addEventListener("click", usarNovoProcessoValor);
  }

  const renomearProcesso = document.getElementById("btnRenomearProcesso");
  if (renomearProcesso) {
    renomearProcesso.addEventListener("click", renomearProcessoSelecionado);
  }

  const importarValores = document.getElementById("btnImportarValoresColados");
  if (importarValores) {
    importarValores.addEventListener("click", importarValoresColados);
  }

  const limparImportacao = document.getElementById("btnLimparImportacaoValores");
  if (limparImportacao) {
    limparImportacao.addEventListener("click", () => {
      const textarea = document.getElementById("valoresImportacaoTexto");
      if (textarea) textarea.value = "";
    });
  }

  const carregarBojo = document.getElementById("btnCarregarBojoEncapado");
  if (carregarBojo) {
    carregarBojo.addEventListener("click", carregarModeloBojoEncapado);
  }

  const formEntrega = document.getElementById("formEntregaPagamento");
  if (formEntrega) {
    formEntrega.addEventListener("submit", salvarEntregaPagamento);
  }

  const cancelarEntrega = document.getElementById("btnCancelarEntregaPagamento");
  if (cancelarEntrega) {
    cancelarEntrega.addEventListener("click", limparFormEntregaPagamento);
  }

  [
    "pagamentoDataInicio",
    "pagamentoDataFim",
    "pagamentoFiltroFaccao",
    "pagamentoFiltroReferencia",
    "pagamentoFiltroPreco",
    "pagamentoFiltroStatus"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", agendarRenderPagamentosFiltrados);
  });

  const entregaPreco = document.getElementById("entregaPreco");
  if (entregaPreco) {
    entregaPreco.addEventListener("change", preencherFaccaoDaEntregaPeloManejo);
  }

  const entregaOP = document.getElementById("entregaOP");
  if (entregaOP) {
    entregaOP.addEventListener("change", () => {
      preencherFiltrosPagamento();
      preencherFaccaoDaEntregaPeloManejo();
    });
  }

  const limpar = document.getElementById("btnLimparFiltrosPagamento");
  if (limpar) {
    limpar.addEventListener("click", () => {
      ["pagamentoDataInicio", "pagamentoDataFim", "pagamentoFiltroFaccao", "pagamentoFiltroReferencia", "pagamentoFiltroPreco"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      const status = document.getElementById("pagamentoFiltroStatus");
      if (status) status.value = "pendente";
      renderPagamentos();
    });
  }

  const marcarPagos = document.getElementById("btnMarcarPagamentosFiltrados");
  if (marcarPagos) {
    marcarPagos.addEventListener("click", marcarPagamentosFiltradosComoPagos);
  }

  const imprimir = document.getElementById("btnImprimirPagamento");
  if (imprimir) {
    imprimir.addEventListener("click", imprimirRelatorioPagamento);
  }
}

function formatarMoedaBR(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatarValorUnitarioBR(valor) {
  return `R$ ${Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  })}`;
}

function getLabelSetorPagamento(setor) {
  const mapa = {
    bojo: "Bojo",
    alca: "Alça",
    renda: "Renda",
    sutia: "Sutiã",
    calcinha: "Calcinha"
  };

  return mapa[setor] || setor || "-";
}

function getCampoSetorPagamento(setor) {
  const mapa = {
    bojo: "possuiBojo",
    alca: "possuiAlca",
    renda: "possuiRenda"
  };

  return mapa[setor] || "";
}

function getPrecoReferencia(id) {
  return state.precosReferencia.find(preco => preco.id === id) || null;
}

let processoValorAtivo = "";

function chaveProcessoValor(processo, setor) {
  return `${limparTexto(setor || "").toLowerCase()}__${limparTexto(processo || "").toUpperCase()}`;
}

function getProcessoValorDeChave(chave) {
  const [setor, ...resto] = String(chave || "").split("__");
  return {
    setor: setor || "",
    processo: resto.join("__") || ""
  };
}

function getProcessosValores() {
  const mapa = new Map();

  state.precosReferencia.forEach(preco => {
    const processo = limparTexto(preco.processo || "").toUpperCase();
    const setor = preco.setor || "";
    if (!processo || !setor) return;

    const chave = chaveProcessoValor(processo, setor);

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        chave,
        processo,
        setor,
        setorLabel: getLabelSetorPagamento(setor),
        total: 0,
        ativos: 0,
        inativos: 0
      });
    }

    const grupo = mapa.get(chave);
    grupo.total += 1;

    if (preco.ativo === false) {
      grupo.inativos += 1;
    } else {
      grupo.ativos += 1;
    }
  });

  return [...mapa.values()].sort((a, b) => {
    const procCompare = a.processo.localeCompare(b.processo, "pt-BR", { numeric: true });
    if (procCompare !== 0) return procCompare;
    return a.setorLabel.localeCompare(b.setorLabel, "pt-BR", { numeric: true });
  });
}

function preencherProcessosValores() {
  const select = document.getElementById("valorProcessoAtivo");
  if (!select) return;

  const processos = getProcessosValores();
  const atual = processoValorAtivo || select.value;

  select.innerHTML = `<option value="">Todos os processos</option>` + processos.map(item => {
    return `<option value="${escapeHtml(item.chave)}">${escapeHtml(item.processo)} | ${escapeHtml(item.setorLabel)} (${item.total})</option>`;
  }).join("");

  if (atual && processos.some(item => item.chave === atual)) {
    select.value = atual;
    processoValorAtivo = atual;
  } else if (!processoValorAtivo && processos.length) {
    select.value = processos[0].chave;
    processoValorAtivo = processos[0].chave;
  } else {
    select.value = processoValorAtivo || "";
  }

  aplicarProcessoValorSelecionado(select.value);
}

function aplicarProcessoValorSelecionado(chave) {
  processoValorAtivo = chave || "";
  const { processo, setor } = getProcessoValorDeChave(processoValorAtivo);

  const processoInput = document.getElementById("precoReferenciaProcesso");
  const setorInput = document.getElementById("precoReferenciaSetor");

  if (processoInput && processo) processoInput.value = processo;
  if (setorInput && setor) setorInput.value = setor || "bojo";

  const renomearInput = document.getElementById("valorRenomearProcesso");
  if (renomearInput) renomearInput.value = processo || "";
}

function abrirGerenciarValores() {
  carregarPrecosReferenciaSeNecessario();

  if (!podeUsarRecurso("gerenciarValores")) {
    toast("Seu usuário não tem permissão para gerenciar valores.");
    return;
  }

  const painel = document.getElementById("painelGerenciarValores");
  const botao = document.getElementById("btnToggleGerenciarValores");

  if (!painel) return;

  const abrindo = painel.classList.contains("hidden");
  painel.classList.toggle("hidden");

  if (botao) {
    botao.textContent = abrindo ? "Ocultar gerenciamento" : "Gerenciar valores";
  }

  if (abrindo) {
    preencherProcessosValores();
    renderProcessosValores();
    renderPrecosReferencia();

    setTimeout(() => {
      painel.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }
}

function fecharGerenciarValores() {
  const painel = document.getElementById("painelGerenciarValores");
  const botao = document.getElementById("btnToggleGerenciarValores");

  if (painel) painel.classList.add("hidden");
  if (botao) botao.textContent = "Gerenciar valores";
}

function usarNovoProcessoValor() {
  const processo = limparTexto(document.getElementById("valorNovoProcesso")?.value || "").toUpperCase();
  const setor = document.getElementById("valorNovoSetor")?.value || "bojo";

  if (!processo) {
    toast("Digite o nome do processo.");
    return;
  }

  const chave = chaveProcessoValor(processo, setor);
  processoValorAtivo = chave;

  const select = document.getElementById("valorProcessoAtivo");
  const existeOpcao = select && [...select.options].some(option => option.value === chave);

  if (select && !existeOpcao) {
    const option = document.createElement("option");
    option.value = chave;
    option.textContent = `${processo} | ${getLabelSetorPagamento(setor)} (novo)`;
    select.appendChild(option);
  }

  if (select) select.value = chave;

  document.getElementById("precoReferenciaProcesso").value = processo;
  document.getElementById("precoReferenciaSetor").value = setor;
  document.getElementById("precoReferenciaRef")?.focus();

  renderProcessosValores();
  renderPrecosReferencia();
  toast("Processo selecionado. Agora cadastre as referências e valores.");
}


async function renomearProcessoSelecionado() {
  if (!podeUsarRecurso("gerenciarValores")) {
    toast("Seu usuário não tem permissão para gerenciar valores.");
    return;
  }

  const { processo, setor } = getProcessoValorDeChave(processoValorAtivo);
  const novoProcesso = limparTexto(document.getElementById("valorRenomearProcesso")?.value || "").toUpperCase();

  if (!processo) {
    toast("Selecione um processo antes de renomear.");
    return;
  }

  if (!novoProcesso) {
    toast("Digite o novo nome do processo.");
    return;
  }

  if (novoProcesso === processo) {
    toast("O processo já está com esse nome.");
    return;
  }

  const valores = state.precosReferencia.filter(preco => {
    return limparTexto(preco.processo || "").toUpperCase() === processo &&
      (!setor || preco.setor === setor);
  });

  if (!valores.length) {
    toast("Nenhum valor encontrado para esse processo.");
    return;
  }

  try {
    let batch = writeBatch(db);
    let contador = 0;
    let total = 0;

    for (const preco of valores) {
      batch.set(doc(db, "precosReferencia", preco.id), {
        processo: novoProcesso,
        atualizadoPor: state.currentUser.uid,
        atualizadoEm: serverTimestamp()
      }, { merge: true });

      contador++;
      total++;

      if (contador === 450) {
        await batch.commit();
        batch = writeBatch(db);
        contador = 0;
      }
    }

    if (contador > 0) {
      await batch.commit();
    }

    processoValorAtivo = chaveProcessoValor(novoProcesso, setor || "bojo");
    await registrarLog("processo_valor_renomeado", "precosReferencia", "processo", `${processo} -> ${novoProcesso} | ${total} valores`);

    preencherProcessosValores();
    renderProcessosValores();
    renderPrecosReferencia();
    toast(`Processo renomeado em ${total} valor(es).`);
  } catch (error) {
    console.error(error);
    toast("Erro ao renomear processo.");
  }
}

function renderProcessosValores() {
  const container = document.getElementById("listaProcessosValores");
  if (!container) return;

  const busca = normalizarTexto(document.getElementById("buscaProcessoValor")?.value || "");
  let processos = getProcessosValores();

  if (busca) {
    processos = processos.filter(item => normalizarTexto(item.processo).includes(busca));
  }

  if (!processos.length) {
    container.innerHTML = `<div class="empty-card">Nenhum processo com valores cadastrados ainda.</div>`;
    return;
  }

  container.innerHTML = processos.map(item => `
    <button class="processo-valor-item ${item.chave === processoValorAtivo ? "active" : ""}" type="button" onclick="selecionarProcessoValor('${escapeHtml(item.chave)}')">
      <div>
        <strong>${escapeHtml(item.processo)}</strong>
        <span>${item.total} referências</span>
      </div>
      <small>${item.ativos} ativos / ${item.inativos} inativos</small>
    </button>
  `).join("");
}

function selecionarProcessoValor(chave) {
  const select = document.getElementById("valorProcessoAtivo");
  processoValorAtivo = chave || "";

  if (select) select.value = processoValorAtivo;

  aplicarProcessoValorSelecionado(processoValorAtivo);
  renderProcessosValores();
  renderPrecosReferencia();
}

function limparFormPrecoReferencia() {
  const form = document.getElementById("formPrecoReferencia");
  const chaveAtual = processoValorAtivo;

  if (form) form.reset();

  const id = document.getElementById("precoReferenciaId");
  if (id) id.value = "";

  aplicarProcessoValorSelecionado(chaveAtual);
}

async function salvarPrecoReferencia(event) {
  event.preventDefault();

  if (!podeUsarRecurso("gerenciarValores")) {
    toast("Seu usuário não tem permissão para gerenciar valores.");
    return;
  }

  const idAtual = document.getElementById("precoReferenciaId").value;
  const referencia = normalizarReferencia(document.getElementById("precoReferenciaRef").value);
  const processo = limparTexto(document.getElementById("precoReferenciaProcesso").value).toUpperCase();
  const setor = document.getElementById("precoReferenciaSetor").value;
  const valor = Number(document.getElementById("precoReferenciaValor").value || 0);

  if (!referencia || !processo || valor <= 0) {
    toast("Informe referência, processo e valor maior que zero.");
    return;
  }

  const docId = idAtual || docIdSeguro(`${referencia}-${setor}-${processo}`);

  const dados = {
    referencia,
    processo,
    setor,
    setorLabel: getLabelSetorPagamento(setor),
    valor,
    ativo: true,
    atualizadoPor: state.currentUser.uid,
    atualizadoEm: serverTimestamp()
  };

  if (!idAtual) {
    dados.criadoPor = state.currentUser.uid;
    dados.criadoEm = serverTimestamp();
  }

  try {
    await setDoc(doc(db, "precosReferencia", docId), dados, { merge: true });
    await registrarLog(
      idAtual ? "preco_referencia_atualizado" : "preco_referencia_criado",
      "precoReferencia",
      docId,
      `Ref. ${referencia} | ${processo} | ${formatarMoedaBR(valor)}`
    );

    processoValorAtivo = chaveProcessoValor(processo, setor);
    limparFormPrecoReferencia();
    preencherProcessosValores();
    renderProcessosValores();
    renderPrecosReferencia();
    toast("Valor salvo.");
  } catch (error) {
    console.error(error);
    toast("Erro ao salvar valor da referência.");
  }
}

function renderPrecosReferencia() {
  const tbody = document.getElementById("listaPrecosReferencia");
  if (!tbody) return;

  preencherProcessosValores();

  const busca = normalizarTexto(document.getElementById("buscaPrecosReferencia")?.value || "");
  const { processo, setor } = getProcessoValorDeChave(processoValorAtivo);

  let precos = [...state.precosReferencia];

  if (processoValorAtivo && processo && setor) {
    precos = precos.filter(preco => {
      return limparTexto(preco.processo || "").toUpperCase() === processo && preco.setor === setor;
    });
  }

  if (busca) {
    precos = precos.filter(preco => {
      const texto = normalizarTexto(`${preco.referencia} ${preco.processo} ${preco.setorLabel} ${preco.valor}`);
      return texto.includes(busca);
    });
  }

  precos = precos.sort((a, b) => {
    const procCompare = String(a.processo || "").localeCompare(String(b.processo || ""), "pt-BR", { numeric: true });
    if (procCompare !== 0) return procCompare;
    const setorCompare = String(getLabelSetorPagamento(a.setor)).localeCompare(String(getLabelSetorPagamento(b.setor)), "pt-BR", { numeric: true });
    if (setorCompare !== 0) return setorCompare;
    return String(a.referencia || "").localeCompare(String(b.referencia || ""), "pt-BR", { numeric: true });
  });

  const total = precos.length;
  const ativos = precos.filter(preco => preco.ativo !== false).length;
  const inativos = precos.filter(preco => preco.ativo === false).length;

  const setText = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
  };

  setText("valorProcessoSelecionadoLabel", processo || "Todos");
  setText("valorTotalReferencias", Number(total).toLocaleString("pt-BR"));
  setText("valorTotalAtivos", Number(ativos).toLocaleString("pt-BR"));
  setText("valorTotalInativos", Number(inativos).toLocaleString("pt-BR"));

  const titulo = document.getElementById("tituloTabelaValores");
  if (titulo) titulo.textContent = processo ? `5. Valores cadastrados — ${processo}` : "5. Todos os valores cadastrados";

  if (!precos.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Nenhum valor cadastrado para esse processo.</td></tr>`;
    return;
  }

  tbody.innerHTML = precos.map(preco => `
    <tr>
      <td><strong>${escapeHtml(preco.processo || "-")}</strong></td>
      <td><strong>${escapeHtml(preco.referencia || "-")}</strong></td>
      <td><strong>${escapeHtml(formatarValorUnitarioBR(preco.valor))}</strong></td>
      <td>
        <span class="status-dot ${preco.ativo !== false ? "active" : "inactive"}">
          ${preco.ativo !== false ? "Ativo" : "Inativo"}
        </span>
      </td>
      <td>
        <button class="btn btn-sm" onclick="editarPrecoReferencia('${preco.id}')">Editar</button>
        <button class="btn btn-sm" onclick="alternarPrecoReferencia('${preco.id}')">${preco.ativo !== false ? "Inativar" : "Ativar"}</button>
        <button class="btn btn-sm btn-danger" onclick="excluirPrecoReferencia('${preco.id}')">Excluir</button>
      </td>
    </tr>
  `).join("");
}

const MODELO_BOJO_ENCAPADO_CN = [
  ["400", "0,2943"],
  ["407", "0,2943"],
  ["409", "0,2943"],
  ["411", "0,2943"],
  ["412", "0,2943"],
  ["414", "0,2943"],
  ["416", "0,2943"],
  ["425", "0,5249"],
  ["429", "0,2943"],
  ["438", "0,4029"],
  ["440", "0,4029"],
  ["441", "0,4029"],
  ["442", "0,4360"],
  ["450", "0,6540"],
  ["460", "0,2943"],
  ["465", "0,2943"],
  ["480", "0,2943"],
  ["481", "0,2943"],
  ["482", "0,2943"],
  ["486", "0,3500"],
  ["488", "0,2943"],
  ["495", "0,2943"],
  ["500", "0,2943"],
  ["502", "0,2943"],
  ["504", "0,2943"],
  ["505", "0,2943"],
  ["508", "0,2943"],
  ["509", "0,2943"],
  ["515", "0,4029"],
  ["518", "0,2943"],
  ["520", "0,4029"],
  ["526", "0,2943"],
  ["534", "0,2943"],
  ["535", "0,5249"],
  ["540", "0,2943"],
  ["549", "0,2943"],
  ["550", "0,2943"],
  ["552", "0,2943"],
  ["555", "0,2943"],
  ["557", "0,2943"],
  ["558", "0,6540"],
  ["568", "0,2943"],
  ["580", "0,5249"],
  ["582", "0,5249"],
  ["751", "0,6540"],
  ["752", "0,7085"],
  ["754", "0,6540"],
  ["755", "0,6540"],
  ["762", "0,6540"],
  ["770", "0,2943"],
  ["777", "0,4029"],
  ["900", "0,5249"],
  ["902", "0,5249"],
  ["903", "0,2943"],
  ["906", "0,5249"],
  ["908", "0,2943"],
  ["910", "0,2943"],
  ["920", "0,5249"],
  ["1001", "0,2943"],
  ["1002", "0,2943"],
  ["2000", "0,4029"],
  ["5051", "0,4029"],
  ["5151", "0,4029"]
];

function carregarModeloBojoEncapado() {
  processoValorAtivo = chaveProcessoValor("ENCAPAR BOJO", "bojo");

  const novoProcesso = document.getElementById("valorNovoProcesso");
  const novoSetor = document.getElementById("valorNovoSetor");
  const processoInput = document.getElementById("precoReferenciaProcesso");
  const setorInput = document.getElementById("precoReferenciaSetor");
  const select = document.getElementById("valorProcessoAtivo");
  const textarea = document.getElementById("valoresImportacaoTexto");

  if (novoProcesso) novoProcesso.value = "ENCAPAR BOJO";
  if (novoSetor) novoSetor.value = "bojo";
  if (processoInput) processoInput.value = "ENCAPAR BOJO";
  if (setorInput) setorInput.value = "bojo";

  preencherProcessosValores();

  if (select) {
    const existe = [...select.options].some(option => option.value === processoValorAtivo);

    if (!existe) {
      const option = document.createElement("option");
      option.value = processoValorAtivo;
      option.textContent = "ENCAPAR BOJO (modelo)";
      select.appendChild(option);
    }

    select.value = processoValorAtivo;
  }

  if (textarea) {
    textarea.value = MODELO_BOJO_ENCAPADO_CN
      .map(([referencia, valor]) => `${referencia}\t${valor}`)
      .join("\n");

    textarea.focus();
  }

  renderProcessosValores();
  renderPrecosReferencia();
  toast("Modelo BOJO ENCAPADO carregado. Agora clique em Importar valores colados.");
}

function parseValorMonetario(texto) {
  const limpo = String(texto || "")
    .trim()
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : 0;
}

function quebrarLinhaImportacaoValor(linha) {
  if (linha.includes("\t")) return linha.split("\t").map(item => item.trim()).filter(Boolean);
  if (linha.includes(";")) return linha.split(";").map(item => item.trim()).filter(Boolean);

  const partesVirgula = linha.split(",").map(item => item.trim()).filter(Boolean);
  if (partesVirgula.length > 2) return partesVirgula;

  return linha.trim().split(/\s{2,}/).map(item => item.trim()).filter(Boolean);
}

async function importarValoresColados() {
  if (!podeUsarRecurso("gerenciarValores")) {
    toast("Seu usuário não tem permissão para importar valores.");
    return;
  }

  const texto = document.getElementById("valoresImportacaoTexto")?.value || "";
  const { processo: processoAtivo, setor: setorAtivo } = getProcessoValorDeChave(processoValorAtivo);

  if (!texto.trim()) {
    toast("Cole os dados da planilha antes de importar.");
    return;
  }

  const linhas = texto.split(/\r?\n/).map(linha => linha.trim()).filter(Boolean);
  const registros = [];

  linhas.forEach(linha => {
    const colunas = quebrarLinhaImportacaoValor(linha);
    const primeira = normalizarTexto(colunas[0] || "");

    if (!colunas.length || primeira.includes("referencia") || primeira.includes("referência")) return;

    let referencia = "";
    let processo = processoAtivo;
    let setor = setorAtivo;
    let valor = 0;

    if (colunas.length >= 4) {
      referencia = normalizarReferencia(colunas[0]);
      processo = limparTexto(colunas[1]).toUpperCase();
      setor = "bojo";
      valor = parseValorMonetario(colunas[colunas.length - 1]);
    } else if (colunas.length >= 3 && !processoAtivo) {
      referencia = normalizarReferencia(colunas[0]);
      processo = limparTexto(colunas[1]).toUpperCase();
      setor = setor || "bojo";
      valor = parseValorMonetario(colunas[2]);
    } else {
      referencia = normalizarReferencia(colunas[0]);
      valor = parseValorMonetario(colunas[colunas.length - 1]);
    }

    if (referencia && processo && setor && valor > 0) {
      registros.push({ referencia, processo, setor, valor });
    }
  });

  if (!registros.length) {
    toast("Não encontrei linhas válidas. Use Referência + Valor ou Referência + Processo + Valor.");
    return;
  }

  try {
    let batch = writeBatch(db);
    let contador = 0;
    let total = 0;

    for (const item of registros) {
      const id = docIdSeguro(`${item.referencia}-${item.setor}-${item.processo}`);
      batch.set(doc(db, "precosReferencia", id), {
        referencia: item.referencia,
        processo: item.processo,
        setor: item.setor,
        setorLabel: getLabelSetorPagamento(item.setor),
        valor: item.valor,
        ativo: true,
        atualizadoPor: state.currentUser.uid,
        atualizadoEm: serverTimestamp(),
        criadoPor: state.currentUser.uid,
        criadoEm: serverTimestamp()
      }, { merge: true });

      contador++;
      total++;

      if (contador === 450) {
        await batch.commit();
        batch = writeBatch(db);
        contador = 0;
      }
    }

    if (contador > 0) {
      await batch.commit();
    }

    const primeiro = registros[0];
    processoValorAtivo = chaveProcessoValor(primeiro.processo, primeiro.setor);

    await registrarLog("precos_referencia_importados", "precosReferencia", "importacao", `${total} valores importados/atualizados`);
    document.getElementById("valoresImportacaoTexto").value = "";
    preencherProcessosValores();
    renderProcessosValores();
    renderPrecosReferencia();
    toast(`${total} valores importados/atualizados.`);
  } catch (error) {
    console.error(error);
    toast("Erro ao importar valores.");
  }
}


function editarPrecoReferencia(id) {
  const preco = getPrecoReferencia(id);
  if (!preco) return;

  const painel = document.getElementById("painelGerenciarValores");
  if (painel) painel.classList.remove("hidden");
  const botao = document.getElementById("btnToggleGerenciarValores");
  if (botao) botao.textContent = "Ocultar gerenciamento";

  processoValorAtivo = chaveProcessoValor(preco.processo, preco.setor);
  preencherProcessosValores();

  document.getElementById("precoReferenciaId").value = preco.id;
  document.getElementById("precoReferenciaRef").value = preco.referencia || "";
  document.getElementById("precoReferenciaProcesso").value = preco.processo || "";
  document.getElementById("precoReferenciaSetor").value = preco.setor || "";
  document.getElementById("precoReferenciaValor").value = Number(preco.valor || 0).toFixed(4);
  document.getElementById("precoReferenciaRef")?.focus();
}

async function alternarPrecoReferencia(id) {
  if (!podeUsarRecurso("gerenciarValores")) {
    toast("Seu usuário não tem permissão para alterar valores.");
    return;
  }

  const preco = getPrecoReferencia(id);
  if (!preco) return;

  const ativo = preco.ativo === false;

  try {
    await setDoc(doc(db, "precosReferencia", id), {
      ativo,
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    await registrarLog(ativo ? "preco_referencia_ativado" : "preco_referencia_inativado", "precoReferencia", id, `Ref. ${preco.referencia} | ${preco.processo}`);
    toast(ativo ? "Preço ativado." : "Preço inativado.");
  } catch (error) {
    console.error(error);
    toast("Erro ao alterar preço.");
  }
}

async function excluirPrecoReferencia(id) {
  if (!podeUsarRecurso("gerenciarValores")) {
    toast("Seu usuário não tem permissão para excluir valores.");
    return;
  }

  const preco = getPrecoReferencia(id);
  if (!confirm(`Excluir o preço da referência ${preco?.referencia || id} - ${preco?.processo || ""}?`)) return;

  try {
    await deleteDoc(doc(db, "precosReferencia", id));
    await registrarLog("preco_referencia_excluido", "precoReferencia", id, `Ref. ${preco?.referencia || id} | ${preco?.processo || "-"}`);
    toast("Preço excluído.");
  } catch (error) {
    console.error(error);
    toast("Erro ao excluir preço.");
  }
}

function getOrdemPorEntradaPagamento(valor) {
  const texto = limparTexto(valor);
  if (!texto) return null;

  return state.ordens.find(op => {
    return String(op.numeroOP || "") === texto ||
      String(op.numeroOPExterno || "") === texto ||
      String(op.id || "") === texto ||
      `${op.numeroOP || ""} - ${op.referencia || ""} - ${op.cor || ""}` === texto;
  }) || null;
}

function getPrecosValidosParaEntregaManual(op) {
  const referencia = normalizarReferencia(op?.referencia || "");
  if (!referencia) return getPrecosReferenciaAtivos();

  return getPrecosReferenciaAtivos().filter(preco => normalizarReferencia(preco.referencia || "") === referencia);
}

function getFaccaoSugeridaEntrega(op, preco) {
  if (!op || !preco) return "";

  const manejo = getManejoDaOrdem(op, preco.setor);
  return limparTexto(manejo?.faccao || "").toUpperCase();
}

function preencherFaccaoDaEntregaPeloManejo() {
  const op = getOrdemPorEntradaPagamento(document.getElementById("entregaOP")?.value || "");
  const preco = getPrecoReferencia(document.getElementById("entregaPreco")?.value || "");
  const faccao = getFaccaoSugeridaEntrega(op, preco);
  const inputFaccao = document.getElementById("entregaFaccao");

  if (inputFaccao && faccao && !inputFaccao.value) {
    inputFaccao.value = faccao;
  }
}

function limparFormEntregaPagamento() {
  const form = document.getElementById("formEntregaPagamento");
  if (form) form.reset();

  const id = document.getElementById("entregaPagamentoId");
  if (id) id.value = "";
}

async function salvarEntregaPagamento(event) {
  event.preventDefault();

  if (!ehAdmin()) {
    toast("Apenas admin pode registrar entregas.");
    return;
  }

  const idAtual = document.getElementById("entregaPagamentoId").value;
  const op = getOrdemPorEntradaPagamento(document.getElementById("entregaOP").value);
  const preco = getPrecoReferencia(document.getElementById("entregaPreco").value);
  const faccao = limparTexto(document.getElementById("entregaFaccao").value).toUpperCase();
  const dataEntrega = document.getElementById("entregaData").value;
  const quantidade = Number(document.getElementById("entregaQuantidade").value || 0);
  const observacoes = document.getElementById("entregaObs").value.trim();

  if (!op) {
    toast("Selecione uma OP válida.");
    return;
  }

  if (!preco) {
    toast("Selecione um preço/processo cadastrado.");
    return;
  }

  if (normalizarReferencia(preco.referencia || "") !== normalizarReferencia(op.referencia || "")) {
    toast("Esse preço não pertence à referência da OP selecionada.");
    return;
  }

  if (!faccao || !dataEntrega || quantidade <= 0) {
    toast("Informe facção, data e quantidade entregue.");
    return;
  }

  if (!op[getCampoSetorPagamento(preco.setor)]) {
    toast(`Essa OP não pertence ao setor ${getLabelSetorPagamento(preco.setor)}.`);
    return;
  }

  const valorUnitario = Number(preco.valor || 0);
  const total = quantidade * valorUnitario;

  const dados = {
    opId: op.id,
    numeroOP: op.numeroOP || "",
    referencia: op.referencia || "",
    cor: op.cor || "",
    produtoNome: op.produtoNome || "",
    faccao,
    precoReferenciaId: preco.id,
    processo: preco.processo,
    servicoId: preco.id,
    servicoNome: preco.processo,
    setor: preco.setor,
    setorLabel: getLabelSetorPagamento(preco.setor),
    dataEntrega,
    quantidade,
    valorUnitario,
    total,
    statusPagamento: idAtual ? (state.entregasPagamento.find(e => e.id === idAtual)?.statusPagamento || "pendente") : "pendente",
    observacoes,
    atualizadoPor: state.currentUser.uid,
    atualizadoEm: serverTimestamp()
  };

  if (!idAtual) {
    dados.criadoPor = state.currentUser.uid;
    dados.criadoEm = serverTimestamp();
  }

  try {
    if (idAtual) {
      await setDoc(doc(db, "entregasPagamento", idAtual), dados, { merge: true });
    } else {
      await addDoc(collection(db, "entregasPagamento"), dados);
    }

    await registrarLog(
      idAtual ? "entrega_pagamento_atualizada" : "entrega_pagamento_criada",
      "entregaPagamento",
      idAtual || dados.numeroOP,
      `${dados.dataEntrega} | OP ${dados.numeroOP} | Ref. ${dados.referencia} | ${dados.faccao} | ${dados.processo} | ${dados.quantidade} peças | ${formatarMoedaBR(dados.total)}`
    );

    limparFormEntregaPagamento();
    toast("Entrega registrada para pagamento.");
  } catch (error) {
    console.error(error);
    toast("Erro ao registrar entrega.");
  }
}

function editarEntregaPagamento(id) {
  const entrega = state.entregasPagamento.find(item => item.id === id);
  if (!entrega) return;

  document.getElementById("entregaPagamentoId").value = entrega.id;
  document.getElementById("entregaOP").value = entrega.numeroOP || entrega.opId || "";
  document.getElementById("entregaPreco").value = entrega.precoReferenciaId || entrega.servicoId || "";
  document.getElementById("entregaFaccao").value = entrega.faccao || "";
  document.getElementById("entregaData").value = entrega.dataEntrega || "";
  document.getElementById("entregaQuantidade").value = entrega.quantidade || "";
  document.getElementById("entregaObs").value = entrega.observacoes || "";
}

async function alternarStatusEntregaPagamento(id) {
  if (!ehAdmin()) {
    toast("Apenas admin pode alterar pagamento.");
    return;
  }

  const entrega = state.entregasPagamento.find(item => item.id === id);
  if (!entrega) return;

  const novoStatus = entrega.statusPagamento === "pago" ? "pendente" : "pago";

  try {
    await setDoc(doc(db, "entregasPagamento", id), {
      statusPagamento: novoStatus,
      pagoEm: novoStatus === "pago" ? serverTimestamp() : null,
      pagoPor: novoStatus === "pago" ? state.currentUser.uid : "",
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    await registrarLog(
      novoStatus === "pago" ? "entrega_pagamento_paga" : "entrega_pagamento_reaberta",
      "entregaPagamento",
      id,
      `OP ${entrega.numeroOP} | ${entrega.faccao} | ${entrega.processo || entrega.servicoNome} | ${entrega.quantidade} peças`
    );

    toast(novoStatus === "pago" ? "Entrega marcada como paga." : "Entrega reaberta como pendente.");
  } catch (error) {
    console.error(error);
    toast("Erro ao alterar status do pagamento.");
  }
}

async function excluirEntregaPagamento(id) {
  if (!ehAdmin()) {
    toast("Apenas admin pode excluir entrega.");
    return;
  }

  const entrega = state.entregasPagamento.find(item => item.id === id);
  if (!confirm(`Excluir a entrega da OP ${entrega?.numeroOP || id}?`)) return;

  try {
    await deleteDoc(doc(db, "entregasPagamento", id));
    await registrarLog("entrega_pagamento_excluida", "entregaPagamento", id, `OP ${entrega?.numeroOP || id}`);
    toast("Entrega excluída.");
  } catch (error) {
    console.error(error);
    toast("Erro ao excluir entrega.");
  }
}

function getEntregasPagamentoFiltradas() {
  const inicio = document.getElementById("pagamentoDataInicio")?.value || "";
  const fim = document.getElementById("pagamentoDataFim")?.value || "";
  const filtroFaccao = document.getElementById("pagamentoFiltroFaccao")?.value || "";
  const filtroReferencia = document.getElementById("pagamentoFiltroReferencia")?.value || "";
  const filtroPreco = document.getElementById("pagamentoFiltroPreco")?.value || "";
  const filtroStatus = document.getElementById("pagamentoFiltroStatus")?.value || "pendente";

  return [...state.entregasPagamento].filter(item => {
    if (inicio && String(item.dataEntrega || "") < inicio) return false;
    if (fim && String(item.dataEntrega || "") > fim) return false;
    if (filtroFaccao && item.faccao !== filtroFaccao) return false;
    if (filtroReferencia && normalizarReferencia(item.referencia || "") !== normalizarReferencia(filtroReferencia)) return false;
    if (filtroPreco && (item.precoReferenciaId || item.servicoId) !== filtroPreco) return false;
    if (filtroStatus && (item.statusPagamento || "pendente") !== filtroStatus) return false;
    return true;
  });
}

function preencherFiltrosPagamento() {
  const selectFaccao = document.getElementById("pagamentoFiltroFaccao");
  const selectReferencia = document.getElementById("pagamentoFiltroReferencia");
  const selectPreco = document.getElementById("pagamentoFiltroPreco");
  const entregaPreco = document.getElementById("entregaPreco");
  const entregaOPList = document.getElementById("entregaOPList");
  const entregaFaccaoList = document.getElementById("entregaFaccaoList");

  const precos = getPrecosReferenciaAtivos();
  const opEntrega = getOrdemPorEntradaPagamento(document.getElementById("entregaOP")?.value || "");
  const precosEntrega = getPrecosValidosParaEntregaManual(opEntrega);

  if (selectFaccao) {
    const atual = selectFaccao.value;
    const faccoes = [...new Set([
      ...state.entregasPagamento.map(item => item.faccao),
      ...state.faccoes.map(item => item.nome),
      ...state.ordens.map(op => op.manejo?.faccao),
      ...state.ordens.flatMap(op => Object.values(op.manejosSetores || {}).map(m => m?.faccao))
    ].map(item => limparTexto(item).toUpperCase()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

    selectFaccao.innerHTML = `<option value="">Todas</option>` + faccoes.map(faccao => {
      return `<option value="${escapeHtml(faccao)}">${escapeHtml(faccao)}</option>`;
    }).join("");

    if (faccoes.includes(atual)) selectFaccao.value = atual;
  }

  if (selectReferencia) {
    const atual = selectReferencia.value;
    const referencias = [...new Set([
      ...state.entregasPagamento.map(item => item.referencia),
      ...state.precosReferencia.map(item => item.referencia),
      ...state.ordens.map(item => item.referencia)
    ].map(item => normalizarReferencia(item || "")).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), "pt-BR", { numeric: true }));

    selectReferencia.innerHTML = `<option value="">Todas</option>` + referencias.map(ref => `<option value="${escapeHtml(ref)}">${escapeHtml(ref)}</option>`).join("");
    if (referencias.includes(atual)) selectReferencia.value = atual;
  }

  if (selectPreco) {
    const atual = selectPreco.value;

    selectPreco.innerHTML = `<option value="">Todos</option>` + precos.map(preco => {
      return `<option value="${escapeHtml(preco.id)}">${escapeHtml(preco.referencia)} - ${escapeHtml(preco.processo)} - ${escapeHtml(formatarValorUnitarioBR(preco.valor))}</option>`;
    }).join("");

    if (precos.some(preco => preco.id === atual)) selectPreco.value = atual;
  }

  if (entregaPreco) {
    const atual = entregaPreco.value;

    entregaPreco.innerHTML = `<option value="">Selecione</option>` + precosEntrega.map(preco => {
      return `<option value="${escapeHtml(preco.id)}">${escapeHtml(preco.referencia)} - ${escapeHtml(preco.processo)} - ${escapeHtml(formatarValorUnitarioBR(preco.valor))}</option>`;
    }).join("");

    if (precosEntrega.some(preco => preco.id === atual)) entregaPreco.value = atual;
  }

  if (entregaOPList) {
    entregaOPList.innerHTML = state.ordens.map(op => {
      const label = `${op.numeroOP || ""} - ${op.referencia || ""} - ${op.cor || ""}`;
      return `<option value="${escapeHtml(label)}"></option>`;
    }).join("");
  }

  if (entregaFaccaoList) {
    const faccoes = [...new Set([
      ...state.faccoes.map(item => item.nome),
      ...state.entregasPagamento.map(item => item.faccao),
      ...state.ordens.map(op => op.manejo?.faccao),
      ...state.ordens.flatMap(op => Object.values(op.manejosSetores || {}).map(m => m?.faccao))
    ].map(item => limparTexto(item).toUpperCase()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

    entregaFaccaoList.innerHTML = faccoes.map(faccao => `<option value="${escapeHtml(faccao)}"></option>`).join("");
  }
}

function agruparPagamento(entregas) {
  const mapa = new Map();

  entregas.forEach(item => {
    const processo = item.processo || item.servicoNome || "-";
    const precoId = item.precoReferenciaId || item.servicoId || `${item.referencia}-${item.setor}-${processo}`;
    const chave = `${item.faccao}||${precoId}`;

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        faccao: item.faccao,
        referencia: item.referencia || "-",
        precoReferenciaId: precoId,
        processo,
        setor: item.setor,
        setorLabel: item.setorLabel || getLabelSetorPagamento(item.setor),
        entregas: 0,
        quantidade: 0,
        valorUnitario: Number(item.valorUnitario || 0),
        total: 0
      });
    }

    const grupo = mapa.get(chave);
    grupo.entregas += 1;
    grupo.quantidade += Number(item.quantidade || 0);
    grupo.valorUnitario = Number(item.valorUnitario || 0);
    grupo.total += Number(item.total || 0);
  });

  return [...mapa.values()].sort((a, b) => {
    const faccaoCompare = a.faccao.localeCompare(b.faccao, "pt-BR", { numeric: true });
    if (faccaoCompare !== 0) return faccaoCompare;
    const refCompare = String(a.referencia).localeCompare(String(b.referencia), "pt-BR", { numeric: true });
    if (refCompare !== 0) return refCompare;
    return a.processo.localeCompare(b.processo, "pt-BR", { numeric: true });
  });
}

function labelOrigemPagamento(item) {
  return item?.pagamentoReenvio ? "Reenvio" : "Normal";
}

let timerRenderFiltrosPagamento = 0;
let renderFiltrosPagamentoEmAndamento = false;

function agendarRenderPagamentosFiltrados() {
  window.clearTimeout(timerRenderFiltrosPagamento);
  timerRenderFiltrosPagamento = window.setTimeout(() => {
    if (renderFiltrosPagamentoEmAndamento) return;
    renderFiltrosPagamentoEmAndamento = true;
    try {
      resetarLimitesRenderTabelaPrefixo("pagamentos");
      renderPagamentos({ somenteResultados: true });
    } catch (error) {
      console.error("Falha ao aplicar filtros leves de Pagamentos.", error);
      renderPagamentos();
    } finally {
      renderFiltrosPagamentoEmAndamento = false;
    }
  }, 80);
}

function renderPagamentos(opcoes = {}) {
  const tbody = document.getElementById("listaPagamento");
  if (!tbody) return;

  const somenteResultados = opcoes?.somenteResultados === true;
  if (!somenteResultados) {
    renderPrecosReferencia();
    preencherFiltrosPagamento();
  }

  const entregas = getEntregasPagamentoFiltradas();
  const grupos = agruparPagamento(entregas);

  const totalFaccoes = new Set(grupos.map(g => g.faccao)).size;
  const totalEntregas = entregas.length;
  const totalRecebidas = grupos.reduce((soma, g) => soma + g.quantidade, 0);
  const totalValor = grupos.reduce((soma, g) => soma + g.total, 0);

  const setText = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
  };

  setText("pagamentoTotalFaccoes", totalFaccoes.toLocaleString("pt-BR"));
  setText("pagamentoTotalEntregas", totalEntregas.toLocaleString("pt-BR"));
  setText("pagamentoTotalRecebidas", totalRecebidas.toLocaleString("pt-BR"));
  setText("pagamentoTotalValor", formatarMoedaBR(totalValor));

  if (!getPrecosReferenciaAtivos().length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Cadastre pelo menos um preço por referência para gerar pagamentos.</td></tr>`;
  } else if (!grupos.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Nenhuma entrega encontrada para o período/filtro selecionado.</td></tr>`;
  } else {
    const gruposFiltrados = grupos;
    const chaveRender = "pagamentos-grupos";
    const gruposVisiveis = limitarItensRenderTabela(chaveRender, gruposFiltrados);
    tbody.innerHTML = gruposVisiveis.map(grupo => `
      <tr class="${grupo.faccao === "SEM FACÇÃO" ? "pagamento-sem-faccao" : ""}">
        <td><strong>${escapeHtml(grupo.faccao)}</strong></td>
        <td><strong>${escapeHtml(grupo.referencia)}</strong></td>
        <td><strong>${escapeHtml(grupo.processo)}</strong></td>
        <td>${escapeHtml(grupo.entregas.toLocaleString("pt-BR"))}</td>
        <td><strong>${escapeHtml(grupo.quantidade.toLocaleString("pt-BR"))}</strong></td>
        <td>${escapeHtml(formatarValorUnitarioBR(grupo.valorUnitario))}</td>
        <td><strong>${escapeHtml(formatarMoedaBR(grupo.total))}</strong></td>
      </tr>
    `).join("");
    renderControleRenderTabela(tbody, chaveRender, gruposFiltrados.length, gruposVisiveis.length, "grupos de pagamento");
  }

  renderEntregasPagamento(entregas);
}

function renderEntregasPagamento(entregas = getEntregasPagamentoFiltradas()) {
  const tbody = document.getElementById("listaEntregasPagamento");
  if (!tbody) return;

  const entregasFiltradas = entregas;
  const chaveRender = "pagamentos-entregas";
  entregas = limitarItensRenderTabela(chaveRender, entregasFiltradas);

  if (!entregasFiltradas.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty">Nenhuma entrega registrada para os filtros selecionados.</td></tr>`;
    limparControleRenderTabela(chaveRender);
    return;
  }

  tbody.innerHTML = entregas.map(entrega => `
    <tr>
      <td>${escapeHtml(dataISOParaBR(entrega.dataEntrega) || entrega.dataEntrega || "-")}</td>
      <td><strong>${escapeHtml(entrega.numeroOP || "-")}</strong></td>
      <td><strong>${escapeHtml(entrega.referencia || "-")}</strong></td>
      <td>${escapeHtml(entrega.faccao || "-")}</td>
      <td>
        ${escapeHtml(entrega.processo || entrega.servicoNome || "-")}
        ${entrega.pagamentoReenvio ? `<small class="pagamento-origem-badge">Reenvio</small>` : ""}
      </td>
      <td><strong>${escapeHtml(Number(entrega.quantidade || 0).toLocaleString("pt-BR"))}</strong></td>
      <td><strong>${escapeHtml(formatarMoedaBR(entrega.total))}</strong></td>
      <td>
        <span class="badge ${entrega.statusPagamento === "pago" ? "ok" : "pending"}">
          ${entrega.statusPagamento === "pago" ? "Pago" : "Pendente"}
        </span>
      </td>
      <td>
        <button class="btn btn-sm ${entrega.statusPagamento === "pago" ? "btn-warning" : "btn-success"}" onclick="alternarStatusEntregaPagamento('${entrega.id}')">
          ${entrega.statusPagamento === "pago" ? "Reabrir" : "Pagar"}
        </button>
        <button class="btn btn-sm btn-danger" onclick="excluirEntregaPagamento('${entrega.id}')">Excluir</button>
      </td>
    </tr>
  `).join("");
  renderControleRenderTabela(tbody, chaveRender, entregasFiltradas.length, entregas.length, "entregas de pagamento");
}

async function marcarPagamentosFiltradosComoPagos() {
  if (!ehAdmin()) {
    toast("Apenas admin pode fechar pagamentos.");
    return;
  }

  const entregas = getEntregasPagamentoFiltradas().filter(item => item.statusPagamento !== "pago");

  if (!entregas.length) {
    toast("Nenhuma entrega pendente encontrada no filtro atual.");
    return;
  }

  const total = entregas.reduce((soma, item) => soma + Number(item.total || 0), 0);

  if (!confirm(`Marcar ${entregas.length} entregas filtradas como pagas? Total: ${formatarMoedaBR(total)}`)) {
    return;
  }

  try {
    const batch = writeBatch(db);

    entregas.forEach(entrega => {
      batch.set(doc(db, "entregasPagamento", entrega.id), {
        statusPagamento: "pago",
        pagoEm: serverTimestamp(),
        pagoPor: state.currentUser.uid,
        atualizadoPor: state.currentUser.uid,
        atualizadoEm: serverTimestamp()
      }, { merge: true });
    });

    await batch.commit();
    await registrarLog("pagamentos_filtrados_fechados", "entregaPagamento", "lote", `${entregas.length} entregas | ${formatarMoedaBR(total)}`);
    toast("Entregas filtradas marcadas como pagas.");
  } catch (error) {
    console.error(error);
    toast("Erro ao fechar pagamentos filtrados.");
  }
}

function getTextoFiltrosPagamento() {
  const inicio = document.getElementById("pagamentoDataInicio")?.value || "";
  const fim = document.getElementById("pagamentoDataFim")?.value || "";
  const faccao = document.getElementById("pagamentoFiltroFaccao")?.value || "";
  const referencia = document.getElementById("pagamentoFiltroReferencia")?.value || "";
  const preco = document.getElementById("pagamentoFiltroPreco")?.selectedOptions?.[0]?.textContent || "Todos";
  const status = document.getElementById("pagamentoFiltroStatus")?.selectedOptions?.[0]?.textContent || "Pendentes";

  const partes = [];
  if (inicio || fim) partes.push(`Período: ${inicio ? dataISOParaBR(inicio) : "início"} até ${fim ? dataISOParaBR(fim) : "hoje"}`);
  if (faccao) partes.push(`Facção: ${faccao}`);
  if (referencia) partes.push(`Referência: ${referencia}`);
  if (preco && preco !== "Todos") partes.push(`Processo: ${preco}`);
  if (status) partes.push(`Pagamento: ${status}`);

  return partes.length ? `Filtro: ${partes.join(" + ")}` : "Filtro: todos os pagamentos";
}

function imprimirRelatorioPagamento() {
  const grupos = agruparPagamento(getEntregasPagamentoFiltradas());

  if (!grupos.length) {
    toast("Não há dados para imprimir.");
    return;
  }

  const totalEntregas = grupos.reduce((soma, g) => soma + g.entregas, 0);
  const totalRecebidas = grupos.reduce((soma, g) => soma + g.quantidade, 0);
  const totalValor = grupos.reduce((soma, g) => soma + g.total, 0);
  const dataImpressao = new Date().toLocaleString("pt-BR");
  const filtro = getTextoFiltrosPagamento();

  const linhas = grupos.map(grupo => `
    <tr>
      <td>${escapeHtml(grupo.faccao)}</td>
      <td>${escapeHtml(grupo.referencia)}</td>
      <td>${escapeHtml(grupo.processo)}</td>
      <td class="num">${escapeHtml(grupo.entregas.toLocaleString("pt-BR"))}</td>
      <td class="num">${escapeHtml(grupo.quantidade.toLocaleString("pt-BR"))}</td>
      <td class="num">${escapeHtml(formatarValorUnitarioBR(grupo.valorUnitario))}</td>
      <td class="num">${escapeHtml(formatarMoedaBR(grupo.total))}</td>
    </tr>
  `).join("");

  const htmlImpressao = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Relatório de Pagamento</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 18px; font-size: 12px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; }
          h1 { margin: 0; font-size: 22px; }
          .muted { color: #475569; font-size: 11px; }
          .filter { border: 1px solid #cbd5e1; background: #f8fafc; padding: 8px; border-radius: 8px; margin-bottom: 12px; }
          .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
          .summary div { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; }
          .summary span { display: block; color: #475569; font-size: 11px; }
          .summary strong { display: block; font-size: 17px; margin-top: 3px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #cbd5e1; padding: 7px; }
          th { background: #eef2ff; text-align: left; }
          .num { text-align: right; font-weight: bold; }
          @page { size: landscape; margin: 10mm; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Relatório de Pagamento</h1>
            <div class="muted">Sistema OP Confecção</div>
          </div>
          <div class="muted">Impresso em:<br><strong>${escapeHtml(dataImpressao)}</strong></div>
        </div>

        <div class="filter"><strong>${escapeHtml(filtro)}</strong></div>

        <div class="summary">
          <div><span>Entregas</span><strong>${totalEntregas.toLocaleString("pt-BR")}</strong></div>
          <div><span>Peças entregues</span><strong>${totalRecebidas.toLocaleString("pt-BR")}</strong></div>
          <div><span>Total a pagar</span><strong>${formatarMoedaBR(totalValor)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Facção</th>
              <th>Referência</th>
              <th>Processo</th>
              <th>Entregas</th>
              <th>Peças</th>
              <th>Valor unit.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>

        <script>
          window.addEventListener("load", () => {
            window.focus();
            window.print();
          });
        </script>
      </body>
    </html>
  `;

  const janela = window.open("", "_blank");
  if (!janela) {
    toast("O navegador bloqueou a impressão. Permita pop-ups para este site.");
    return;
  }

  janela.document.open();
  janela.document.write(htmlImpressao);
  janela.document.close();
}


function configurarRelatorios() {
  document.querySelectorAll(".report-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".report-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.relatorioAtual = btn.dataset.relatorio;
      renderRelatorio();
    });
  });

  document.getElementById("btnAplicarFiltros").addEventListener("click", renderRelatorio);

  document.getElementById("btnLimparFiltros").addEventListener("click", () => {
    document.getElementById("filtroSemana").value = "";
    document.getElementById("filtroMes").value = "";
    document.getElementById("filtroAno").value = "";
    document.getElementById("filtroReferencia").value = "";
    document.getElementById("filtroCor").value = "";
    renderRelatorio();
  });

  document.getElementById("btnExportarCSV").addEventListener("click", exportarCSV);
  document.getElementById("btnImprimir").addEventListener("click", () => window.print());
}

function getOrdensRelatorio() {
  const info = reportInfo[state.relatorioAtual];
  let ordens = [...state.ordens];

  if (info.tipo === "especifico") {
    ordens = ordens.filter(op => Boolean(op[info.campo]));
  }

  if (info.tipo === "bipado") {
    ordens = ordens.filter(op => getStatusManejo(op) === "bipado");
  }

  const semana = document.getElementById("filtroSemana").value;
  const mes = document.getElementById("filtroMes").value;
  const ano = document.getElementById("filtroAno").value;
  const referencia = normalizarReferencia(document.getElementById("filtroReferencia").value);
  const cor = normalizarCor(document.getElementById("filtroCor").value);

  if (semana) ordens = ordens.filter(op => String(op.semana) === String(semana));
  if (mes) ordens = ordens.filter(op => op.mes === mes);
  if (ano) ordens = ordens.filter(op => String(op.ano) === String(ano));
  if (referencia) ordens = ordens.filter(op => String(op.referencia).includes(referencia));
  if (cor) ordens = ordens.filter(op => normalizarCor(op.cor).includes(cor));

  return ordens.sort((a, b) => {
    if (Number(a.ano) !== Number(b.ano)) return Number(a.ano) - Number(b.ano);
    if (a.mes !== b.mes) return ordemMes(a.mes) - ordemMes(b.mes);
    if (Number(a.semana) !== Number(b.semana)) return Number(a.semana) - Number(b.semana);
    return String(a.referencia).localeCompare(String(b.referencia));
  });
}

function getMovimentacoesRelatorioBipadas() {
  let movimentos = state.movimentacoesProducao.filter(mov => mov.status === "finalizado");

  const semana = document.getElementById("filtroSemana").value;
  const mes = document.getElementById("filtroMes").value;
  const ano = document.getElementById("filtroAno").value;
  const referencia = normalizarReferencia(document.getElementById("filtroReferencia").value);
  const cor = normalizarCor(document.getElementById("filtroCor").value);

  movimentos = movimentos.filter(mov => {
    const ordem = getOrdemDaMovimentacao(mov);

    if (semana && String(ordem?.semana || "") !== String(semana)) return false;
    if (mes && ordem?.mes !== mes) return false;
    if (ano && String(ordem?.ano || "") !== String(ano)) return false;
    if (referencia && !String(mov.referencia || "").includes(referencia)) return false;
    if (cor && !normalizarCor(mov.cor || "").includes(cor)) return false;

    return true;
  });

  return movimentos.sort((a, b) => getMovTimestamp(b) - getMovTimestamp(a));
}


function ordemMes(mes) {
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  return meses.indexOf(mes) + 1;
}

function renderRelatorio() {
  const info = reportInfo[state.relatorioAtual];
  document.getElementById("tituloRelatorio").textContent = info.title;
  document.getElementById("subtituloRelatorio").textContent = info.subtitle;

  const thead = document.getElementById("cabecalhoRelatorio");
  const tbody = document.getElementById("corpoRelatorio");
  const ordens = getOrdensRelatorio();


  if (info.tipo === "bipado") {
    const movimentos = getMovimentacoesRelatorioBipadas();

    thead.innerHTML = `
      <tr>
        <th>OP</th>
        <th>Referência</th>
        <th>Cor</th>
        <th>Etapa</th>
        <th>Destino</th>
        <th>Processo</th>
        <th>Qtd. recebida</th>
        <th>Chegada</th>
        <th>Origem</th>
        <th>Status</th>
      </tr>
    `;

    if (!movimentos.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="empty">Nenhuma movimentação bipada encontrada.</td></tr>`;
      return;
    }

    tbody.innerHTML = movimentos.map(mov => `
      <tr>
        <td><strong>${escapeHtml(mov.numeroOP || "-")}</strong></td>
        <td>${escapeHtml(mov.referencia || "-")}</td>
        <td><strong>${escapeHtml(mov.cor || "-")}</strong></td>
        <td>${escapeHtml(mov.tipoDestinoLabel || labelTipoMovimento(mov.tipoDestino))}</td>
        <td><strong>${escapeHtml(mov.destino || "-")}</strong></td>
        <td>${escapeHtml(mov.processo || "-")}</td>
        <td>${escapeHtml(quantidadeRecebidaMovimentacao(mov).toLocaleString("pt-BR"))}</td>
        <td>${escapeHtml(dataISOParaBR(mov.dataChegada) || mov.dataChegada || "-")}</td>
        <td>${escapeHtml(mov.movimentacaoOrigemId ? "Reenvio" : "Manejo")}</td>
        <td><span class="badge ok">Bipado</span></td>
      </tr>
    `).join("");

    return;
  }

  if (info.tipo === "geral") {
    thead.innerHTML = `
      <tr>
        <th>OP</th>
        <th>Necessidade</th>
        <th>Referência</th>
        <th>Cor</th>
        <th>Produto</th>
        <th>Qtd.</th>
        <th>Alça</th>
        <th>Bojo</th>
        <th>Renda</th>
        <th>Obs.</th>
      </tr>
    `;

    if (!ordens.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="empty">Nenhuma ordem encontrada para este relatório.</td></tr>`;
      return;
    }

    tbody.innerHTML = ordens.map(op => `
      <tr>
        <td><strong>${escapeHtml(op.numeroOP)}</strong></td>
        <td>${escapeHtml(getNecessidadeDaOrdem(op) || "-")}</td>
        <td>${escapeHtml(op.referencia)}</td>
        <td><strong>${escapeHtml(op.cor || "-")}</strong></td>
        <td>${escapeHtml(op.produtoNome)}</td>
        <td>${op.quantidade}</td>
        <td>${simNaoBadge(op.possuiAlca)}</td>
        <td>${simNaoBadge(op.possuiBojo)}</td>
        <td>${simNaoBadge(op.possuiRenda)}</td>
        <td>${escapeHtml(op.observacoes || "-")}</td>
      </tr>
    `).join("");

    return;
  }

  thead.innerHTML = `
    <tr>
      <th>OP</th>
      <th>Necessidade</th>
      <th>Referência</th>
      <th>Cor</th>
      <th>Quantidade</th>
      <th>${escapeHtml(info.coluna)}</th>
    </tr>
  `;

  if (!ordens.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Nenhuma ordem encontrada para este relatório.</td></tr>`;
    return;
  }

  tbody.innerHTML = ordens.map(op => `
    <tr>
      <td><strong>${escapeHtml(op.numeroOP)}</strong></td>
      <td>${escapeHtml(getNecessidadeDaOrdem(op) || "-")}</td>
      <td>${escapeHtml(op.referencia)}</td>
      <td><strong>${escapeHtml(op.cor || "-")}</strong></td>
      <td>${op.quantidade}</td>
      <td>${simNaoBadge(true)}</td>
    </tr>
  `).join("");
}

function configurarUsuarios() {
  const formUsuario = document.getElementById("formUsuario");

  if (formUsuario) {
    formUsuario.addEventListener("submit", async event => {
      event.preventDefault();

      if (!ehAdmin()) {
        toast("Apenas admin pode criar usuários.");
        return;
      }

      const nome = document.getElementById("usuarioNome").value.trim();
      const email = document.getElementById("usuarioEmail").value.trim();
      const senha = document.getElementById("usuarioSenha").value;
      const tipo = document.getElementById("usuarioTipo").value;

      if (!nome || !email || !senha || senha.length < 6) {
        toast("Preencha nome, e-mail e senha com pelo menos 6 caracteres.");
        return;
      }

      try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, senha);

        await setDoc(doc(db, "usuarios", cred.user.uid), {
          nome,
          email,
          tipo,
          ativo: true,
          permissoes: getPermissoesPadrao(tipo),
          criadoPor: state.currentUser.uid,
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp()
        });

        await registrarLog("usuario_criado", "usuario", cred.user.uid, `${nome} | ${email} | ${tipo}`);
        await signOut(secondaryAuth);

        document.getElementById("formUsuario").reset();
        document.getElementById("usuarioTipo").value = "usuario";

        toast("Usuário criado. Agora clique em Gerenciar permissões para ajustar o acesso.");
      } catch (error) {
        console.error(error);
        toast("Erro ao criar usuário. Confira se o e-mail já existe.");
      }
    });
  }

  const formPermissoes = document.getElementById("formPermissoesUsuario");
  if (formPermissoes) {
    formPermissoes.addEventListener("submit", salvarPermissoesUsuario);
  }

  const cancelarPermissoes = document.getElementById("btnCancelarPermissoesUsuario");
  if (cancelarPermissoes) {
    cancelarPermissoes.addEventListener("click", fecharPermissoesUsuario);
  }

  const tipoPermissao = document.getElementById("permissaoUsuarioTipo");
  if (tipoPermissao) {
    tipoPermissao.addEventListener("change", atualizarEstadoCamposPermissaoPeloTipo);
  }

  const fecharExcluir = document.getElementById("btnFecharModalExcluirUsuario");
  if (fecharExcluir) {
    fecharExcluir.addEventListener("click", fecharModalExcluirUsuario);
  }

  const cancelarExcluir = document.getElementById("btnCancelarExcluirUsuario");
  if (cancelarExcluir) {
    cancelarExcluir.addEventListener("click", fecharModalExcluirUsuario);
  }

  const confirmarExcluir = document.getElementById("btnConfirmarExcluirUsuario");
  if (confirmarExcluir) {
    confirmarExcluir.addEventListener("click", confirmarExcluirUsuario);
  }

  const modalExcluir = document.getElementById("modalExcluirUsuario");
  if (modalExcluir) {
    modalExcluir.addEventListener("click", event => {
      if (event.target === modalExcluir) fecharModalExcluirUsuario();
    });
  }
}

function renderUsuarios() {
  const tbody = document.getElementById("listaUsuarios");
  if (!tbody) return;

  if (!state.usuarios.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Nenhum usuário encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.usuarios.map(usuario => `
    <tr>
      <td><strong>${escapeHtml(usuario.nome || "-")}</strong></td>
      <td>${escapeHtml(usuario.email || "-")}</td>
      <td>${usuario.tipo === "admin" ? "Admin" : "Usuário comum"}</td>
      <td class="usuario-acessos">${escapeHtml(resumoPermissoesUsuario(usuario))}</td>
      <td>
        <span class="status-dot ${usuario.ativo ? "active" : "inactive"}">
          ${usuario.ativo ? "Ativo" : "Inativo"}
        </span>
      </td>
      <td class="usuario-actions">
        <button class="btn btn-sm" onclick="abrirPermissoesUsuario('${usuario.uid}')">Gerenciar</button>
        <button class="btn btn-sm" onclick="alternarTipoUsuario('${usuario.uid}')">
          ${usuario.tipo === "admin" ? "Virar usuário" : "Virar admin"}
        </button>
        <button class="btn btn-sm ${usuario.ativo ? "btn-warning" : "btn-success"}" onclick="alternarUsuario('${usuario.uid}', ${usuario.ativo ? "false" : "true"})">
          ${usuario.ativo ? "Desativar" : "Ativar"}
        </button>
        <button class="btn btn-sm btn-danger" onclick="abrirModalExcluirUsuario('${usuario.uid}')">Excluir</button>
      </td>
    </tr>
  `).join("");
}

function abrirPermissoesUsuario(uid) {
  if (!ehAdmin()) {
    toast("Apenas admin pode gerenciar permissões.");
    return;
  }

  const usuario = state.usuarios.find(item => item.uid === uid);
  if (!usuario) return;

  const painel = document.getElementById("formPermissoesUsuario");
  const resumo = document.getElementById("permissaoUsuarioResumo");
  const uidInput = document.getElementById("permissaoUsuarioUid");

  if (uidInput) uidInput.value = uid;

  if (resumo) {
    resumo.innerHTML = `<strong>${escapeHtml(usuario.nome || "-")}</strong><br><small>${escapeHtml(usuario.email || "-")}</small>`;
  }

  const tipoSelect = document.getElementById("permissaoUsuarioTipo");
  if (tipoSelect) {
    tipoSelect.value = usuario.tipo === "admin" ? "admin" : "usuario";
    tipoSelect.disabled = usuario.uid === state.currentUser.uid;
  }

  preencherCamposPermissaoUsuario(usuario);

  painel?.classList.remove("hidden");
  painel?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (usuario.tipo === "admin") {
    toast("Admin já tem acesso total. As permissões ficam travadas.");
  }
}

function preencherCamposPermissaoUsuario(usuario) {
  const tipoAtual = document.getElementById("permissaoUsuarioTipo")?.value || usuario?.tipo || "usuario";
  const usuarioParaPermissao = {
    ...usuario,
    tipo: tipoAtual
  };
  const permissoes = getPermissoesUsuario(usuarioParaPermissao);
  const travar = tipoAtual === "admin";

  document.querySelectorAll("[data-permissao-tela]").forEach(input => {
    const tela = input.dataset.permissaoTela;
    input.checked = Boolean(permissoes.telas?.[tela]);
    input.disabled = travar;
  });

  document.querySelectorAll("[data-permissao-manejo]").forEach(input => {
    const manejo = input.dataset.permissaoManejo;
    input.checked = Boolean(permissoes.manejo?.[manejo]);
    input.disabled = travar;
  });

  document.querySelectorAll("[data-permissao-recurso]").forEach(input => {
    const recurso = input.dataset.permissaoRecurso;
    input.checked = Boolean(permissoes.recursos?.[recurso]);
    input.disabled = travar;
  });
}

function atualizarEstadoCamposPermissaoPeloTipo() {
  const uid = document.getElementById("permissaoUsuarioUid")?.value || "";
  const usuario = state.usuarios.find(item => item.uid === uid);
  if (!usuario) return;

  preencherCamposPermissaoUsuario(usuario);

  const tipo = document.getElementById("permissaoUsuarioTipo")?.value || "usuario";
  if (tipo === "admin") {
    toast("Admin terá acesso total.");
  }
}

function fecharPermissoesUsuario() {
  const form = document.getElementById("formPermissoesUsuario");
  if (form) form.classList.add("hidden");

  const uidInput = document.getElementById("permissaoUsuarioUid");
  if (uidInput) uidInput.value = "";
}

function coletarPermissoesUsuarioForm() {
  const telas = {};
  const manejo = {};
  const recursos = {};

  document.querySelectorAll("[data-permissao-tela]").forEach(input => {
    telas[input.dataset.permissaoTela] = Boolean(input.checked);
  });

  document.querySelectorAll("[data-permissao-manejo]").forEach(input => {
    manejo[input.dataset.permissaoManejo] = Boolean(input.checked);
  });

  document.querySelectorAll("[data-permissao-recurso]").forEach(input => {
    recursos[input.dataset.permissaoRecurso] = Boolean(input.checked);
  });

  return { telas, manejo, recursos };
}

async function salvarPermissoesUsuario(event) {
  event.preventDefault();

  if (!ehAdmin()) {
    toast("Apenas admin pode salvar permissões.");
    return;
  }

  const uid = document.getElementById("permissaoUsuarioUid")?.value || "";
  const usuario = state.usuarios.find(item => item.uid === uid);

  if (!usuario) {
    toast("Selecione um usuário.");
    return;
  }

  const novoTipo = document.getElementById("permissaoUsuarioTipo")?.value || usuario.tipo || "usuario";

  if (uid === state.currentUser.uid && novoTipo !== "admin") {
    toast("Você não pode rebaixar seu próprio usuário.");
    return;
  }

  const permissoes = novoTipo === "admin" ? getPermissoesPadrao("admin") : coletarPermissoesUsuarioForm();

  if (novoTipo !== "admin" && permissoes.telas.manejo && !permissoes.manejo.sutia && !permissoes.manejo.calcinha) {
    toast("Para liberar Manejo, marque Sutiã ou Calcinha.");
    return;
  }

  try {
    await setDoc(doc(db, "usuarios", uid), {
      tipo: novoTipo,
      permissoes,
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    await registrarLog("usuario_permissoes_atualizadas", "usuario", uid, `${usuario.nome || uid} | tipo: ${novoTipo} | ${resumoPermissoesUsuario({ ...usuario, tipo: novoTipo, permissoes })}`);

    fecharPermissoesUsuario();
    toast("Permissões salvas.");
  } catch (error) {
    console.error(error);
    toast("Erro ao salvar permissões.");
  }
}

async function alternarTipoUsuario(uid) {
  if (!ehAdmin()) {
    toast("Apenas admin pode alterar tipo de usuário.");
    return;
  }

  const usuario = state.usuarios.find(item => item.uid === uid);
  if (!usuario) return;

  if (uid === state.currentUser.uid) {
    toast("Você não pode alterar o tipo do próprio usuário.");
    return;
  }

  const novoTipo = usuario.tipo === "admin" ? "usuario" : "admin";
  const permissoes = getPermissoesPadrao(novoTipo);

  try {
    await setDoc(doc(db, "usuarios", uid), {
      tipo: novoTipo,
      permissoes,
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    await registrarLog("usuario_tipo_alterado", "usuario", uid, `${usuario.nome || uid} | ${usuario.tipo || "usuario"} -> ${novoTipo}`);
    toast(novoTipo === "admin" ? "Usuário virou Admin." : "Admin virou Usuário comum.");
  } catch (error) {
    console.error(error);
    toast("Erro ao alterar tipo do usuário.");
  }
}

function abrirModalExcluirUsuario(uid) {
  if (!ehAdmin()) {
    toast("Apenas admin pode excluir usuários.");
    return;
  }

  const usuario = state.usuarios.find(item => item.uid === uid);
  if (!usuario) return;

  if (uid === state.currentUser.uid) {
    toast("Você não pode excluir seu próprio usuário.");
    return;
  }

  const modal = document.getElementById("modalExcluirUsuario");
  const input = document.getElementById("excluirUsuarioUid");
  const info = document.getElementById("excluirUsuarioInfo");

  if (input) input.value = uid;

  if (info) {
    info.innerHTML = `
      <strong>${escapeHtml(usuario.nome || "-")}</strong>
      <span>${escapeHtml(usuario.email || "-")} | ${usuario.tipo === "admin" ? "Admin" : "Usuário comum"}</span>
    `;
  }

  modal?.classList.remove("hidden");
}

function fecharModalExcluirUsuario() {
  document.getElementById("modalExcluirUsuario")?.classList.add("hidden");
  const input = document.getElementById("excluirUsuarioUid");
  if (input) input.value = "";
}

async function confirmarExcluirUsuario() {
  if (!ehAdmin()) {
    toast("Apenas admin pode excluir usuários.");
    return;
  }

  const uid = document.getElementById("excluirUsuarioUid")?.value || "";
  const usuario = state.usuarios.find(item => item.uid === uid);

  if (!usuario) {
    toast("Usuário não encontrado.");
    return;
  }

  if (uid === state.currentUser.uid) {
    toast("Você não pode excluir seu próprio usuário.");
    return;
  }

  try {
    await deleteDoc(doc(db, "usuarios", uid));
    await registrarLog("usuario_excluido", "usuario", uid, `${usuario.nome || uid} | ${usuario.email || "-"}`);
    fecharModalExcluirUsuario();
    fecharPermissoesUsuario();
    toast("Acesso do usuário excluído.");
  } catch (error) {
    console.error(error);
    toast("Erro ao excluir usuário.");
  }
}

async function alternarUsuario(uid, novoStatus) {
  if (!ehAdmin()) {
    toast("Apenas admin pode alterar usuários.");
    return;
  }

  if (uid === state.currentUser.uid && novoStatus === false) {
    toast("Você não pode desativar seu próprio usuário.");
    return;
  }

  try {
    await updateDoc(doc(db, "usuarios", uid), {
      ativo: novoStatus,
      atualizadoEm: serverTimestamp()
    });

    const usuario = state.usuarios.find(item => item.uid === uid);
    await registrarLog("usuario_status_alterado", "usuario", uid, `${usuario?.nome || uid} | status: ${novoStatus ? "ativo" : "inativo"}`);

    toast("Usuário atualizado.");
  } catch (error) {
    console.error(error);
    toast("Erro ao atualizar usuário.");
  }
}


function configurarLogs() {
  const busca = document.getElementById("buscaLog");
  if (busca) {
    busca.addEventListener("input", renderLogs);
  }

  const btn = document.getElementById("btnExportarLogs");
  if (btn) {
    btn.addEventListener("click", exportarLogsCSV);
  }
}

function renderLogs() {
  const tbody = document.getElementById("listaLogs");
  if (!tbody) return;

  if (!ehAdmin()) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Apenas admin pode visualizar logs.</td></tr>`;
    return;
  }

  const busca = normalizarTexto(document.getElementById("buscaLog")?.value || "");
  let logs = [...state.logs];

  if (busca) {
    logs = logs.filter(log => {
      const texto = normalizarTexto([
        log.usuarioNome,
        log.usuarioEmail,
        log.usuarioTipo,
        log.acao,
        log.tipoAlvo,
        log.alvoId,
        log.detalhes
      ].join(" "));
      return texto.includes(busca);
    });
  }

  if (!logs.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Nenhum log encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.slice(0, 300).map(log => `
    <tr>
      <td>${escapeHtml(formatarDataHora(log.criadoEm))}</td>
      <td>
        <strong>${escapeHtml(log.usuarioNome || "-")}</strong><br>
        <small>${escapeHtml(log.usuarioEmail || "-")}</small>
      </td>
      <td><span class="log-action">${escapeHtml(labelAcaoLog(log.acao))}</span></td>
      <td>${escapeHtml(log.tipoAlvo || "-")}</td>
      <td>${escapeHtml(log.alvoId || "-")}</td>
      <td class="log-detail">${escapeHtml(log.detalhes || "-")}</td>
    </tr>
  `).join("");
}

function exportarLogsCSV() {
  if (!ehAdmin()) {
    toast("Apenas admin pode exportar logs.");
    return;
  }

  const logs = [...state.logs];

  if (!logs.length) {
    toast("Não há logs para exportar.");
    return;
  }

  const linhas = [
    ["Data/Hora", "Usuário", "E-mail", "Tipo usuário", "Ação", "Tipo alvo", "Item", "Detalhes"]
  ];

  logs.forEach(log => {
    linhas.push([
      formatarDataHora(log.criadoEm),
      log.usuarioNome || "",
      log.usuarioEmail || "",
      log.usuarioTipo || "",
      labelAcaoLog(log.acao),
      log.tipoAlvo || "",
      log.alvoId || "",
      log.detalhes || ""
    ]);
  });

  const csv = linhas
    .map(linha => linha.map(campo => `"${String(campo).replaceAll('"', '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "logs-auditoria-op-confeccao.csv";
  link.click();

  URL.revokeObjectURL(url);
  registrarLog("logs_exportados", "auditoria", "logsAlteracoes", `${logs.length} logs exportados em CSV`);
}

async function registrarLog(acao, tipoAlvo, alvoId, detalhes = "") {
  if (!state.currentUser || !state.perfil) return;

  try {
    await addDoc(collection(db, "logsAlteracoes"), {
      acao,
      tipoAlvo,
      alvoId: String(alvoId || ""),
      detalhes: String(detalhes || ""),
      usuarioUid: state.currentUser.uid,
      usuarioNome: state.perfil.nome || "",
      usuarioEmail: state.perfil.email || state.currentUser.email || "",
      usuarioTipo: state.perfil.tipo || "",
      criadoEm: serverTimestamp()
    });
  } catch (error) {
    console.warn("Não foi possível registrar log:", error);
  }
}

function labelAcaoLog(acao) {
  const labels = {
    login: "Login",
    produto_criado: "Produto criado",
    produto_atualizado: "Produto atualizado",
    produto_excluido: "Produto excluído",
    ordem_criada: "OP criada",
    ordem_atualizada: "OP atualizada",
    ordem_excluida: "OP excluída",
    usuario_criado: "Usuário criado",
    usuario_status_alterado: "Status de usuário",
    backup_importado: "Backup importado",
    backup_exportado: "Backup exportado",
    relatorio_exportado: "Relatório exportado",
    logs_exportados: "Logs exportados",
    manejo_criado: "Manejo criado",
    manejo_atualizado: "Manejo atualizado",
    manejo_excluido: "Manejo excluído",
    pdf_importado: "PDF importado",
    ordens_zeradas: "Ordens zeradas"
  };

  return labels[acao] || acao || "-";
}

function formatarDataHora(valor) {
  if (!valor) return "-";
  const data = typeof valor.toDate === "function" ? valor.toDate() : new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";

  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function normalizarTexto(valor) {
  return String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}




function nomeMesPorDataISO(dataISO) {
  const match = String(dataISO || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";

  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  return meses[Number(match[2]) - 1] || "";
}

function anoPorDataISO(dataISO) {
  const match = String(dataISO || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? Number(match[1]) : new Date().getFullYear();
}


function getConfiguracaoImportacaoPDF() {
  const tipoPeca = document.getElementById("pdfTipoPeca")?.value || "";
  const inicio = document.getElementById("pdfNecessidadeInicio")?.value || "";
  const fim = document.getElementById("pdfNecessidadeFim")?.value || "";

  if (!tipoPeca) {
    return { ok: false, mensagem: "Selecione se o PDF é de calcinha ou sutiã." };
  }

  if (!inicio || !fim) {
    return { ok: false, mensagem: "Informe a data inicial e a data final da necessidade." };
  }

  if (inicio > fim) {
    return { ok: false, mensagem: "A data inicial não pode ser maior que a data final." };
  }

  const necessidadeTexto = `${dataISOParaBR(inicio)} a ${dataISOParaBR(fim)}`;
  const tipoPecaLabel = tipoPeca === "sutia" ? "Sutiã" : "Calcinha";

  return {
    ok: true,
    tipoPeca,
    tipoPecaLabel,
    necessidadeInicio: inicio,
    necessidadeFim: fim,
    necessidadeTexto
  };
}


function configurarImportadorPDF() {
  const input = document.getElementById("inputImportarPDF");
  const confirmar = document.getElementById("btnConfirmarImportacaoPDF");
  const zerar = document.getElementById("btnZerarOrdens");

  if (input) {
    input.addEventListener("change", async event => {
      const file = event.target.files[0];
      if (!file) return;

      if (!ehAdmin()) {
        toast("Apenas admin pode importar relatório PDF.");
        event.target.value = "";
        return;
      }

      const configPDF = getConfiguracaoImportacaoPDF();
      if (!configPDF.ok) {
        toast(configPDF.mensagem);
        event.target.value = "";
        return;
      }

      try {
        toast("Lendo PDF, aguarde...");
        const texto = await extrairTextoPDF(file);
        const registros = extrairOrdensDoRelatorioPDF(texto);

        state.pdfImportacaoPendente = registros;
        renderPreviewPDF(registros);

        if (registros.length) {
          toast(`${registros.length} ordens encontradas no PDF.`);
        } else {
          toast("Nenhuma ordem foi encontrada no PDF.");
        }
      } catch (error) {
        console.error(error);
        toast("Erro ao ler PDF. Verifique se o arquivo é um relatório válido.");
      }

      event.target.value = "";
    });
  }

  if (confirmar) {
    confirmar.addEventListener("click", importarPDFConfirmado);
  }

  if (zerar) {
    zerar.addEventListener("click", zerarOrdensProducao);
  }
}

function preencherCamposPDFImportacao() {
  // A importação por PDF agora usa o intervalo de necessidade no calendário.
  // Semana, mês e ano não são mais preenchidos manualmente nesta tela.
}

async function extrairTextoPDF(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let textoFinal = "";

  for (let pagina = 1; pagina <= pdf.numPages; pagina++) {
    const page = await pdf.getPage(pagina);
    const content = await page.getTextContent();

    const itens = content.items
      .map(item => ({
        str: item.str,
        x: item.transform[4],
        y: Math.round(item.transform[5])
      }))
      .filter(item => String(item.str || "").trim());

    itens.sort((a, b) => {
      if (Math.abs(b.y - a.y) > 2) return b.y - a.y;
      return a.x - b.x;
    });

    const linhas = [];
    let linhaAtual = [];
    let yAtual = null;

    for (const item of itens) {
      if (yAtual === null || Math.abs(item.y - yAtual) <= 2) {
        linhaAtual.push(item);
        yAtual = yAtual === null ? item.y : yAtual;
      } else {
        linhas.push(linhaAtual.sort((a, b) => a.x - b.x).map(i => i.str).join(" ").replace(/\s+/g, " ").trim());
        linhaAtual = [item];
        yAtual = item.y;
      }
    }

    if (linhaAtual.length) {
      linhas.push(linhaAtual.sort((a, b) => a.x - b.x).map(i => i.str).join(" ").replace(/\s+/g, " ").trim());
    }

    textoFinal += "\n" + linhas.join("\n") + "\n";
  }

  return textoFinal;
}

function extrairOrdensDoRelatorioPDF(texto) {
  const registros = [];
  const regex = /OP-Lote:\s*([^\n]+?)\s+Situação:[\s\S]*?Referência:\s*([^\n]+)\n[\s\S]*?COR\s*\/\s*TAMANHO[^\n]*\n([\s\S]*?)Planejado:\s*([\d.,]+)/g;
  let match;

  while ((match = regex.exec(texto)) !== null) {
    const opLote = limparTexto(match[1]);
    const blocoCompleto = match[0] || "";
    const referenciaLinha = limparTexto(match[2]);
    const blocoCor = match[3] || "";
    const planejadoTexto = limparTexto(match[4]);

    const cadastro = extrairDataDoBloco(blocoCompleto, "Cadastro");
    const liberacao = extrairDataDoBloco(blocoCompleto, "Liberação");
    const previsaoEntrega = extrairDataDoBloco(blocoCompleto, "Previsão entrega");

    const refMatch = referenciaLinha.match(/^([^\s-]+)\s*-\s*(.+)$/);
    const referencia = normalizarReferencia(refMatch ? refMatch[1] : referenciaLinha);
    const produto = limparTexto(refMatch ? refMatch[2] : "");

    const corLinha = encontrarLinhaCor(blocoCor);
    const corMatch = corLinha.match(/^(\d{3,4})\s*-\s*(.+?)(?:\s+\d{1,4},\d{2}|\s+Planejado:|$)/);

    const corCodigo = corMatch ? limparTexto(corMatch[1]) : "";
    const cor = normalizarCor(corMatch ? corMatch[2] : corLinha);

    const partesOp = opLote.split("-").map(parte => parte.trim());
    const numeroOrdem = partesOp[0] || opLote;
    const lote = partesOp[1] || "";

    if (!numeroOrdem || !referencia || !cor || !planejadoTexto) continue;

    registros.push({
      numeroOP: numeroOrdem,
      opLote,
      lote,
      referencia,
      produto,
      corCodigo,
      cor,
      planejadoTexto,
      quantidade: numeroBrasileiroParaFloat(planejadoTexto),
      cadastro,
      liberacao,
      previsaoEntrega,
      necessidade: previsaoEntrega || cadastro || ""
    });
  }

  const unicos = new Map();

  for (const item of registros) {
    const chave = `${item.numeroOP}-${item.lote}-${item.referencia}-${item.cor}`;
    if (!unicos.has(chave)) {
      unicos.set(chave, item);
    }
  }

  return [...unicos.values()];
}

function dataBrasileiraParaISO(dataBR) {
  const match = String(dataBR || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function dataISOParaBR(dataISO) {
  const match = String(dataISO || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function extrairDataDoBloco(bloco, rotulo) {
  const regex = new RegExp(`${rotulo}:\\s*(\\d{2}\\/\\d{2}\\/\\d{4})`, "i");
  const match = String(bloco || "").match(regex);
  return match ? match[1] : "";
}

function encontrarLinhaCor(bloco) {
  const linhas = String(bloco || "").split(/\n/).map(limparTexto).filter(Boolean);
  return linhas.find(linha => /^\d{3,4}\s*-\s*/.test(linha)) || "";
}

function limparTexto(valor) {
  return String(valor || "").replace(/\s+/g, " ").trim();
}

function numeroBrasileiroParaFloat(valor) {
  const normalizado = String(valor || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  return Number(normalizado || 0);
}

function renderPreviewPDF(registros) {
  const resumo = document.getElementById("pdfImportResumo");
  const wrap = document.getElementById("pdfPreviewWrap");
  const tbody = document.getElementById("pdfPreviewBody");
  const btnConfirmar = document.getElementById("btnConfirmarImportacaoPDF");

  if (!resumo || !wrap || !tbody || !btnConfirmar) return;

  if (!registros.length) {
    resumo.classList.remove("hidden");
    wrap.classList.add("hidden");
    btnConfirmar.disabled = true;
    resumo.innerHTML = "<strong>Nenhuma OP encontrada.</strong><br>Confira se o PDF está no formato correto.";
    tbody.innerHTML = "";
    return;
  }

  const referenciasExistentes = new Set(state.produtos.map(produto => normalizarReferencia(produto.referencia)));
  const refsNovas = [...new Set(registros.map(item => item.referencia).filter(ref => !referenciasExistentes.has(ref)))];

  resumo.classList.remove("hidden");
  wrap.classList.remove("hidden");
  btnConfirmar.disabled = false;

  const configPDF = getConfiguracaoImportacaoPDF();

  resumo.innerHTML = `
    <strong>Prévia do PDF:</strong><br>
    Ordens encontradas: ${registros.length}<br>
    Tipo: ${configPDF.ok ? configPDF.tipoPecaLabel : "Não informado"}<br>
    Necessidade: ${configPDF.ok ? configPDF.necessidadeTexto : "Não informada"}<br>
    Referências novas: ${refsNovas.length}${refsNovas.length ? ` (${refsNovas.slice(0, 12).join(", ")}${refsNovas.length > 12 ? "..." : ""})` : ""}
  `;

  tbody.innerHTML = registros.slice(0, 300).map(item => {
    const existe = referenciasExistentes.has(item.referencia);
    return `
      <tr>
        <td><strong>${escapeHtml(item.numeroOP)}</strong></td>
        <td>${escapeHtml(item.lote || "-")}</td>
        <td>${escapeHtml(item.referencia)}</td>
        <td>${escapeHtml(item.produto || "-")}</td>
        <td>${escapeHtml(item.cor)}</td>
        <td>${escapeHtml(item.planejadoTexto)}</td>
        <td>${escapeHtml(configPDF.ok ? configPDF.tipoPecaLabel : "-")}</td>
        <td>${escapeHtml(configPDF.ok ? configPDF.necessidadeTexto : "-")}</td>
        <td class="${existe ? "pdf-ok" : "pdf-missing"}">${existe ? "Cadastrada" : "Nova"}</td>
      </tr>
    `;
  }).join("");
}

async function importarPDFConfirmado() {
  if (!ehAdmin()) {
    toast("Apenas admin pode importar PDF.");
    return;
  }

  const registros = state.pdfImportacaoPendente || [];

  if (!registros.length) {
    toast("Nenhum PDF lido para importar.");
    return;
  }

  const criarProdutos = document.getElementById("pdfCriarProdutos").checked;
  const configPDF = getConfiguracaoImportacaoPDF();
  const semana = "";
  const mes = configPDF.ok ? nomeMesPorDataISO(configPDF.necessidadeInicio) : "";
  const ano = configPDF.ok ? anoPorDataISO(configPDF.necessidadeInicio) : new Date().getFullYear();

  if (!configPDF.ok) {
    toast(configPDF.mensagem);
    return;
  }

  const referenciasExistentes = new Set(state.produtos.map(produto => normalizarReferencia(produto.referencia)));
  const refsNovas = [...new Set(registros.map(item => item.referencia).filter(ref => !referenciasExistentes.has(ref)))];

  if (refsNovas.length && !criarProdutos) {
    toast("Existem referências novas. Marque a opção para cadastrar automaticamente ou cadastre antes.");
    return;
  }

  const confirmar = confirm(`Importar ${registros.length} ordens do PDF como ${configPDF.tipoPecaLabel}, com necessidade ${configPDF.necessidadeTexto}?`);
  if (!confirmar) return;

  try {
    let batch = writeBatch(db);
    let contador = 0;

    if (criarProdutos) {
      const mapaProdutosNovos = new Map();

      for (const item of registros) {
        if (!referenciasExistentes.has(item.referencia) && !mapaProdutosNovos.has(item.referencia)) {
          mapaProdutosNovos.set(item.referencia, item.produto || `Referência ${item.referencia}`);
        }
      }

      for (const [referencia, nome] of mapaProdutosNovos.entries()) {
        batch.set(doc(db, "produtos", docIdSeguro(referencia)), {
          referencia,
          nome,
          possuiAlca: false,
          possuiBojo: false,
          possuiRenda: false,
          cadastroPendente: true,
          statusCadastro: "pendente",
          pendencia: "Conferir se esta referência possui alça, bojo e renda/sutiã.",
          tipoPecaPadrao: configPDF.tipoPeca,
          tipoPecaPadraoLabel: configPDF.tipoPecaLabel,
          observacoes: `Cadastrado automaticamente pela importação de relatório externo PDF como ${configPDF.tipoPecaLabel}. Conferir alça, bojo e renda/sutiã.`,
          criadoPor: state.currentUser.uid,
          criadoEm: serverTimestamp(),
          atualizadoPor: state.currentUser.uid,
          atualizadoEm: serverTimestamp()
        }, { merge: true });

        contador++;
      }
    }

    for (const item of registros) {
      const produtoExistente = state.produtos.find(prod => normalizarReferencia(prod.referencia) === item.referencia);
      const referenciaPendente = !produtoExistente || Boolean(produtoExistente?.cadastroPendente) || produtoExistente?.statusCadastro === "pendente";

      const docId = docIdSeguro(`PDF-${item.numeroOP}-${item.lote || "SEMLOTE"}`);

      batch.set(doc(db, "ordensProducao", docId), {
        numeroOP: String(item.numeroOP),
        numeroOPExterno: String(item.numeroOP),
        loteExterno: String(item.lote || ""),
        opLoteExterno: item.opLote,
        referencia: item.referencia,
        cor: item.cor,
        corCodigo: item.corCodigo,
        produtoNome: produtoExistente?.nome || item.produto || `Referência ${item.referencia}`,
        semana,
        mes,
        ano,
        quantidade: item.quantidade,
        quantidadePlanejadaTexto: item.planejadoTexto,
        cadastroExterno: item.cadastro || "",
        liberacaoExterna: item.liberacao || "",
        previsaoEntrega: item.previsaoEntrega || "",
        tipoPeca: configPDF.tipoPeca,
        tipoPecaLabel: configPDF.tipoPecaLabel,
        necessidadeInicio: configPDF.necessidadeInicio,
        necessidadeFim: configPDF.necessidadeFim,
        necessidade: configPDF.necessidadeTexto,
        necessidadeOrigemPDF: item.necessidade || item.previsaoEntrega || "",
        possuiAlca: Boolean(produtoExistente?.possuiAlca),
        possuiBojo: Boolean(produtoExistente?.possuiBojo),
        possuiRenda: Boolean(produtoExistente?.possuiRenda),
        referenciaPendente,
        statusReferencia: referenciaPendente ? "pendente" : "conferida",
        pendencia: referenciaPendente ? "Referência nova cadastrada automaticamente. Conferir alça, bojo e renda/sutiã no cadastro do produto." : "",
        observacoes: `Importado do relatório externo PDF como ${configPDF.tipoPecaLabel}. Necessidade: ${configPDF.necessidadeTexto}. OP-Lote: ${item.opLote}.${referenciaPendente ? " Referência pendente de conferência." : ""}`,
        status: "aberta",
        origem: "pdf_externo",
        criadoPor: state.currentUser.uid,
        criadoEm: serverTimestamp(),
        atualizadoPor: state.currentUser.uid,
        atualizadoEm: serverTimestamp()
      }, { merge: true });

      contador++;

      if (contador >= 430) {
        await batch.commit();
        batch = writeBatch(db);
        contador = 0;
      }
    }

    if (contador > 0) {
      await batch.commit();
    }

    await registrarLog("pdf_importado", "importacao", "relatorio-pdf", `${registros.length} ordens importadas do PDF como ${configPDF.tipoPecaLabel}. Necessidade: ${configPDF.necessidadeTexto}. Referências novas: ${refsNovas.length}.`);

    state.pdfImportacaoPendente = [];
    renderPreviewPDF([]);

    toast("PDF importado com sucesso.");
  } catch (error) {
    console.error(error);
    toast("Erro ao importar PDF para o Firestore.");
  }
}

async function zerarOrdensProducao() {
  if (!ehAdmin()) {
    toast("Apenas admin pode zerar ordens.");
    return;
  }

  if (!confirm("Tem certeza que deseja apagar TODAS as ordens de produção do Firestore?")) return;
  if (!confirm("Confirma novamente? Essa ação não apaga produtos, usuários nem logs, apenas ordens de produção.")) return;

  try {
    const snap = await getDocs(collection(db, "ordensProducao"));
    let batch = writeBatch(db);
    let contador = 0;
    let total = 0;

    for (const documento of snap.docs) {
      batch.delete(doc(db, "ordensProducao", documento.id));
      contador++;
      total++;

      if (contador >= 430) {
        await batch.commit();
        batch = writeBatch(db);
        contador = 0;
      }
    }

    if (contador > 0) {
      await batch.commit();
    }

    await setDoc(doc(db, "configuracoes", "sistema"), {
      ultimoNumeroOP: 0,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    await registrarLog("ordens_zeradas", "ordensProducao", "todas", `${total} ordens de produção foram removidas.`);

    toast(`${total} ordens de produção foram apagadas.`);
  } catch (error) {
    console.error(error);
    toast("Erro ao zerar ordens de produção.");
  }
}

function configurarBackup() {
  document.getElementById("inputImportarFirestore").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;

    if (!ehAdmin()) {
      toast("Apenas admin pode importar dados.");
      return;
    }

    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const backup = JSON.parse(reader.result);

        if (Array.isArray(backup.ordensProducao)) {
          const totalOps = backup.ordensProducao.length;
          const totalRefs = Array.isArray(backup.produtos) ? backup.produtos.length : 0;
          const confirmarLigia = confirm(`Detectei o banco da Lígia. Importar ${totalOps.toLocaleString("pt-BR")} OPs e ${totalRefs.toLocaleString("pt-BR")} referências únicas? Não serão importados pagamentos históricos.`);
          if (!confirmarLigia) return;

          const resultado = await importarLigiaNovaLogicaObjeto(backup, `Arquivo ${file.name}`);
          const validacaoTexto = textoValidacaoImportacaoLigia(resultado.validacao);
          await registrarLog("backup_ligia_importado", "importacao", file.name, validacaoTexto || `${totalOps} OPs importadas`);
          const avisoErros = resultado.erros?.length ? " Algumas coleções falharam: publique novamente o firebase-rules.txt." : "";
          toast(`Banco da Lígia importado. OPs no sistema: ${Number(resultado.validacao?.ordens || totalOps).toLocaleString("pt-BR")}. Referências únicas: ${Number(resultado.validacao?.produtos || totalRefs).toLocaleString("pt-BR")}.${avisoErros}`);
          mostrarResumoLigiaNovaLogica();
          return;
        }

        if (!Array.isArray(backup.produtos) || !Array.isArray(backup.ordens)) {
          throw new Error("Formato inválido. Use um backup do sistema ou o banco dados-ligia-migracao.json.");
        }

        if (!confirm("Importar estes dados para o Firestore? Documentos com mesmo ID serão atualizados.")) return;

        await importarBackupFirestore(backup);
        await registrarLog("backup_importado", "importacao", "backup-json", `${backup.produtos.length} produtos e ${backup.ordens.length} ordens importados`);
        toast(`Dados importados. OPs: ${backup.ordens.length.toLocaleString("pt-BR")}; referências: ${backup.produtos.length.toLocaleString("pt-BR")}.`);
      } catch (error) {
        console.error(error);
        toast("Erro ao importar backup. Confira se o arquivo é o JSON correto.");
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  });

  document.getElementById("btnBaixarBackupAtual").addEventListener("click", baixarBackupAtual);
}

async function importarBackupFirestore(backup) {
  let batch = writeBatch(db);
  let contador = 0;

  for (const produto of backup.produtos) {
    const referencia = normalizarReferencia(produto.referencia);
    if (!referencia) continue;

    const produtoRef = doc(db, "produtos", docIdSeguro(referencia));

    batch.set(produtoRef, {
      referencia,
      nome: produto.nome || `Referência ${referencia}`,
      possuiAlca: Boolean(produto.possuiAlca),
      possuiBojo: Boolean(produto.possuiBojo),
      possuiRenda: Boolean(produto.possuiRenda),
      observacoes: produto.observacoes || "",
      importadoPor: state.currentUser.uid,
      importadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    contador++;
  }

  let maiorOP = 0;

  for (const op of backup.ordens) {
    const numeroOP = op.numeroOP || op.id || `OP-IMPORTADA-${Date.now()}-${contador}`;
    const match = String(numeroOP).match(/(\d+)$/);

    if (match) {
      maiorOP = Math.max(maiorOP, Number(match[1]));
    }

    const ordemRef = doc(db, "ordensProducao", docIdSeguro(numeroOP));

    batch.set(ordemRef, {
      numeroOP,
      referencia: normalizarReferencia(op.referencia),
      cor: normalizarCor(op.cor || extrairCorDeObservacao(op.observacoes)),
      produtoNome: op.produtoNome || `Referência ${op.referencia}`,
      semana: Number(op.semana || 1),
      mes: op.mes || "",
      ano: Number(op.ano || new Date().getFullYear()),
      quantidade: Number(op.quantidade || 0),
      possuiAlca: Boolean(op.possuiAlca),
      possuiBojo: Boolean(op.possuiBojo),
      possuiRenda: Boolean(op.possuiRenda),
      observacoes: op.observacoes || "",
      status: op.status || "aberta",
      importadoPor: state.currentUser.uid,
      importadoEm: serverTimestamp(),
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    contador++;

    if (contador >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      contador = 0;
    }
  }

  if (contador > 0) {
    await batch.commit();
  }

  await setDoc(doc(db, "configuracoes", "sistema"), {
    ultimoNumeroOP: maiorOP,
    nomeSistema: "Sistema OP Confecção",
    atualizadoEm: serverTimestamp()
  }, { merge: true });
}

function baixarBackupAtual() {
  const backup = {
    produtos: state.produtos,
    ordens: state.ordens,
    ordensProducao: state.ordens,
    faccoes: state.faccoes,
    celulas: state.celulas,
    movimentacoesProducao: state.movimentacoesProducao,
    entregasPagamento: state.entregasPagamento,
    usuarios: ehAdmin() ? state.usuarios.map(u => ({
      uid: u.uid,
      nome: u.nome,
      email: u.email,
      tipo: u.tipo,
      ativo: u.ativo
    })) : [],
    observacao: "Produtos são referências únicas. Ordens/ordensProducao são as OPs do sistema.",
    exportadoEm: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "backup-op-confeccao-firebase.json";
  link.click();

  URL.revokeObjectURL(url);
  registrarLog("backup_exportado", "exportacao", "backup-atual", `${state.produtos.length} produtos e ${state.ordens.length} ordens exportados`);
}

function renderTudo() {
  // Otimizado: renderiza só a tela atual.
  // As demais telas são renderizadas quando o usuário abrir cada aba.
  renderPaginaAtiva();
}

function renderDashboard() {
  const setText = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
  };

  const faccoesAtivas = state.movimentacoesProducao.filter(mov => mov.tipoDestino === "faccao" && (mov.status === "em_andamento" || !mov.status)).length;
  const celulasAtivas = state.movimentacoesProducao.filter(mov => mov.tipoDestino === "celula" && (mov.status === "em_andamento" || !mov.status)).length;
  const pagamentosPendentes = state.entregasPagamento.filter(item => (item.statusPagamento || "pendente") === "pendente").length;

  setText("totalProdutos", state.produtos.length);
  setText("totalOrdens", state.ordens.length);
  setText("totalRenda", faccoesAtivas);
  setText("totalAlca", celulasAtivas);
  setText("totalBojo", pagamentosPendentes);

  const totalPendentesEl = document.getElementById("totalPendentes");
  if (totalPendentesEl) {
    totalPendentesEl.textContent = state.ordens.filter(op => op.referenciaPendente || op.statusReferencia === "pendente").length;
  }

  const tbody = document.getElementById("ultimasOrdens");
  if (!tbody) return;

  const ultimasMovimentacoes = [...state.movimentacoesProducao]
    .sort((a, b) => getMovTimestamp(b) - getMovTimestamp(a))
    .slice(0, 8);

  if (!ultimasMovimentacoes.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty">Nenhuma movimentação criada ainda.</td></tr>`;
    return;
  }

  tbody.innerHTML = ultimasMovimentacoes.map(mov => `
    <tr>
      <td><strong>${escapeHtml(mov.numeroOP || "-")}</strong></td>
      <td>${escapeHtml(mov.referencia || "-")}</td>
      <td><strong>${escapeHtml(mov.cor || "-")}</strong></td>
      <td>${escapeHtml(mov.tipoDestinoLabel || labelTipoMovimento(mov.tipoDestino))}</td>
      <td><strong>${escapeHtml(mov.destino || "-")}</strong></td>
      <td>${escapeHtml(mov.processo || "-")}</td>
      <td>${escapeHtml(Number(mov.quantidadeEnviada || 0).toLocaleString("pt-BR"))}</td>
      <td><span class="badge ${classeStatusMovimento(mov.status)}">${escapeHtml(labelStatusMovimento(mov.status))}</span></td>
      <td>${escapeHtml(dataISOParaBR(mov.dataEnvio) || mov.dataEnvio || "-")}</td>
      <td>${escapeHtml(dataISOParaBR(mov.dataChegada) || mov.dataChegada || "-")}</td>
    </tr>
  `).join("");
}


function renderProdutos() {
  const busca = normalizarReferencia(document.getElementById("buscaProduto")?.value || "");
  let produtos = [...state.produtos];

  if (busca) {
    produtos = produtos.filter(p => String(p.referencia).includes(busca) || String(p.nome).toUpperCase().includes(busca));
  }

  produtos.sort((a, b) => String(a.referencia).localeCompare(String(b.referencia)));

  const tbody = document.getElementById("listaProdutos");

  const produtosFiltrados = produtos;
  const chaveRender = "produtos";
  produtos = limitarItensRenderTabela(chaveRender, produtosFiltrados);

  if (!produtosFiltrados.length) {
    tbody.innerHTML = `<tr><td colspan="${ehAdmin() ? 7 : 6}" class="empty">Nenhum produto cadastrado.</td></tr>`;
    limparControleRenderTabela(chaveRender);
    return;
  }

  tbody.innerHTML = produtos.map(produto => `
    <tr>
      <td><strong>${escapeHtml(produto.referencia)}</strong></td>
      <td>${escapeHtml(produto.nome)}</td>
      <td>${simNaoBadge(produto.possuiAlca)}</td>
      <td>${simNaoBadge(produto.possuiBojo)}</td>
      <td>${simNaoBadge(produto.possuiRenda)}</td>
      <td>${statusProdutoBadge(produto)}</td>
      ${ehAdmin() ? `<td>
        <button class="btn btn-sm" onclick="editarProduto('${produto.id}')">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="excluirProduto('${produto.id}')">Excluir</button>
      </td>` : ""}
    </tr>
  `).join("");
  renderControleRenderTabela(tbody, chaveRender, produtosFiltrados.length, produtos.length, "referências");
}


function renderProdutosPendentes() {
  const tbody = document.getElementById("listaProdutosPendentes");
  const totalEl = document.getElementById("totalProdutosPendentes");

  if (!tbody || !totalEl) return;

  const pendentes = state.produtos
    .filter(produto => Boolean(produto.cadastroPendente) || produto.statusCadastro === "pendente")
    .sort((a, b) => String(a.referencia).localeCompare(String(b.referencia)));

  totalEl.textContent = `${pendentes.length} pendente${pendentes.length === 1 ? "" : "s"}`;

  if (!pendentes.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Nenhuma referência pendente no momento.</td></tr>`;
    return;
  }

  tbody.innerHTML = pendentes.map(produto => {
    const totalOps = state.ordens.filter(op => {
      return normalizarReferencia(op.referencia) === normalizarReferencia(produto.referencia)
        && (op.referenciaPendente || op.statusReferencia === "pendente");
    }).length;

    return `
      <tr>
        <td><strong>${escapeHtml(produto.referencia)}</strong></td>
        <td>${escapeHtml(produto.nome || "-")}</td>
        <td>${totalOps}</td>
        <td>${escapeHtml(produto.pendencia || "Conferir alça, bojo e renda/sutiã.")}</td>
        <td>
          ${ehAdmin() ? `<button class="btn btn-sm btn-primary" onclick="conferirReferenciaPendente('${produto.id}')">Conferir</button>` : ""}
          <button class="btn btn-sm" onclick="verOrdensDaReferencia('${escapeHtml(produto.referencia)}')">Ver OPs</button>
        </td>
      </tr>
    `;
  }).join("");
}

function conferirReferenciaPendente(id) {
  if (!ehAdmin()) {
    toast("Apenas admin pode conferir referências pendentes.");
    return;
  }

  editarProduto(id);
  toast("Marque alça, bojo e renda/sutiã. Ao salvar, as OPs dessa referência serão atualizadas.");
}

function verOrdensDaReferencia(referencia) {
  abrirPagina("ordens");
  const busca = document.getElementById("buscaOrdem");

  if (busca) {
    busca.value = normalizarReferencia(referencia);
    renderOrdens();
  }
}

function renderOrdens() {
  const busca = normalizarReferencia(document.getElementById("buscaOrdem")?.value || "");
  let ordens = [...state.ordens];

  if (busca) {
    ordens = ordens.filter(op => {
      return String(op.numeroOP).toUpperCase().includes(busca) ||
        String(op.referencia).includes(busca) ||
        String(op.cor || "").toUpperCase().includes(busca) ||
        normalizarTexto(getNecessidadeDaOrdem(op)).includes(normalizarTexto(busca)) ||
        String(op.produtoNome).toUpperCase().includes(busca);
    });
  }

  const tbody = document.getElementById("listaOrdens");

  const ordensFiltradas = ordens;
  const chaveRender = "ordens";
  ordens = limitarItensRenderTabela(chaveRender, ordensFiltradas);

  if (!ordensFiltradas.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty">Nenhuma ordem cadastrada.</td></tr>`;
    limparControleRenderTabela(chaveRender);
    return;
  }

  tbody.innerHTML = ordens.map(op => `
    <tr>
      <td><strong>${escapeHtml(op.numeroOP)}</strong></td>
      <td><strong>${escapeHtml(getNecessidadeDaOrdem(op) || "-")}</strong></td>
      <td>${escapeHtml(op.referencia)}</td>
      <td><strong>${escapeHtml(op.cor || "-")}</strong></td>
      <td>${escapeHtml(op.produtoNome)}</td>
      <td>${op.quantidade}</td>
      <td>${simNaoBadge(op.possuiAlca)}</td>
      <td>${simNaoBadge(op.possuiBojo)}</td>
      <td>${simNaoBadge(op.possuiRenda)}</td>
      <td>${statusReferenciaBadge(op)}</td>
      <td>
        <button class="btn btn-sm" onclick="editarOrdem('${op.id}')">Editar</button>
        ${ehAdmin() ? `<button class="btn btn-sm btn-danger" onclick="excluirOrdem('${op.id}')">Excluir</button>` : ""}
      </td>
    </tr>
  `).join("");
  renderControleRenderTabela(tbody, chaveRender, ordensFiltradas.length, ordens.length, "OPs");
}

function renderDatalistReferencias() {
  const datalist = document.getElementById("referenciasList");

  datalist.innerHTML = state.produtos.map(produto => {
    return `<option value="${escapeHtml(produto.referencia)}">${escapeHtml(produto.nome)}</option>`;
  }).join("");
}

function renderDatalistNecessidadesOrdem() {
  const datalist = document.getElementById("necessidadesOrdemList");
  if (!datalist) return;

  const opcoesFixas = ["URGENTE", "PRIORIDADE", "NORMAL"];
  const valoresSistema = state.ordens
    .map(op => getNecessidadeDaOrdem(op))
    .map(valor => normalizarNecessidadeOrdem(valor))
    .filter(Boolean);

  const unicos = [...new Set([...opcoesFixas, ...valoresSistema])]
    .sort((a, b) => {
      const ai = opcoesFixas.indexOf(a);
      const bi = opcoesFixas.indexOf(b);
      if (ai >= 0 || bi >= 0) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
      return a.localeCompare(b, "pt-BR", { numeric: true });
    });

  datalist.innerHTML = unicos.map(valor => `<option value="${escapeHtml(valor)}"></option>`).join("");
}

function renderDatalistCores() {
  const datalist = document.getElementById("coresList");
  const cores = [...new Set(state.ordens.map(op => normalizarCor(op.cor)).filter(Boolean))].sort();

  datalist.innerHTML = cores.map(cor => `<option value="${escapeHtml(cor)}"></option>`).join("");
}

function getLinhasCSVRelatorio(ordens) {
  const info = reportInfo[state.relatorioAtual];

  if (info.tipo === "bipado") {
    const linhas = [
      ["OP", "Referência", "Cor", "Etapa", "Destino", "Processo", "Qtd. recebida", "Chegada", "Origem", "Status"]
    ];

    getMovimentacoesRelatorioBipadas().forEach(mov => {
      linhas.push([
        mov.numeroOP || "",
        mov.referencia || "",
        mov.cor || "",
        mov.tipoDestinoLabel || labelTipoMovimento(mov.tipoDestino),
        mov.destino || "",
        mov.processo || "",
        quantidadeRecebidaMovimentacao(mov),
        dataISOParaBR(mov.dataChegada) || mov.dataChegada || "",
        mov.movimentacaoOrigemId ? "Reenvio" : "Manejo",
        "Bipado"
      ]);
    });

    return linhas;
  }

  if (info.tipo === "geral") {
    const linhas = [
      ["OP", "Necessidade", "Referência", "Cor", "Produto", "Quantidade", "Alça", "Bojo", "Renda", "Observações"]
    ];

    ordens.forEach(op => {
      linhas.push([
        op.numeroOP,
        getNecessidadeDaOrdem(op) || "",
        op.referencia,
        op.cor || "",
        op.produtoNome,
        op.quantidade,
        op.possuiAlca ? "Sim" : "Não",
        op.possuiBojo ? "Sim" : "Não",
        op.possuiRenda ? "Sim" : "Não",
        op.observacoes || ""
      ]);
    });

    return linhas;
  }

  const linhas = [
    ["OP", "Necessidade", "Referência", "Cor", "Quantidade", info.coluna]
  ];

  ordens.forEach(op => {
    linhas.push([
      op.numeroOP,
      getNecessidadeDaOrdem(op) || "",
      op.referencia,
      op.cor || "",
      op.quantidade,
      "Sim"
    ]);
  });

  return linhas;
}


function exportarCSV() {
  const info = reportInfo[state.relatorioAtual];
  const ordens = getOrdensRelatorio();
  const temDados = info.tipo === "bipado" ? getMovimentacoesRelatorioBipadas().length : ordens.length;

  if (!temDados) {
    toast("Não há dados para exportar.");
    return;
  }

  const linhas = getLinhasCSVRelatorio(ordens);

  const csv = linhas
    .map(linha => linha.map(campo => `"${String(campo).replaceAll('"', '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${reportInfo[state.relatorioAtual].title.replaceAll(" ", "_")}.csv`;
  link.click();

  URL.revokeObjectURL(url);
  registrarLog("relatorio_exportado", "relatorio", state.relatorioAtual, `${reportInfo[state.relatorioAtual].title} exportado em CSV`);
}

function preencherAnoAtual() {
  // Campo Ano foi removido da tela de OP. O ano é calculado pela data inicial da necessidade.
}

function normalizarNumeroOP(valor) {
  return String(valor || "").trim().toUpperCase();
}

function normalizarReferencia(valor) {
  return String(valor || "").trim().toUpperCase();
}

function normalizarCor(valor) {
  return String(valor || "").trim().toUpperCase();
}

function docIdSeguro(valor) {
  return String(valor || "")
    .trim()
    .replaceAll("/", "-")
    .replaceAll("\\", "-")
    .replaceAll("#", "-")
    .replaceAll("?", "-");
}

function extrairCorDeObservacao(texto) {
  const match = String(texto || "").match(/cor\s*:\s*([^|,\n\r;]+)/i);
  return match ? match[1].trim() : "";
}


function statusReferenciaBadge(op) {
  const pendente = Boolean(op?.referenciaPendente) || op?.statusReferencia === "pendente";

  if (pendente) {
    return `<span class="badge pending">Pendente</span>`;
  }

  return `<span class="badge ok">Conferida</span>`;
}

function statusProdutoBadge(produto) {
  const pendente = Boolean(produto?.cadastroPendente) || produto?.statusCadastro === "pendente";

  if (pendente) {
    return `<span class="badge pending">Pendente</span>`;
  }

  return `<span class="badge ok">Conferido</span>`;
}

async function atualizarOrdensDaReferencia(produto) {
  if (!produto?.referencia) return 0;

  const ordensQuery = query(
    collection(db, "ordensProducao"),
    where("referencia", "==", normalizarReferencia(produto.referencia))
  );

  const snap = await getDocs(ordensQuery);

  if (snap.empty) return 0;

  let batch = writeBatch(db);
  let contador = 0;
  let total = 0;

  snap.docs.forEach(documento => {
    batch.set(doc(db, "ordensProducao", documento.id), {
      produtoNome: produto.nome,
      possuiAlca: Boolean(produto.possuiAlca),
      possuiBojo: Boolean(produto.possuiBojo),
      possuiRenda: Boolean(produto.possuiRenda),
      referenciaPendente: false,
      statusReferencia: "conferida",
      pendencia: "",
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    contador++;
    total++;
  });

  if (contador > 0) {
    await batch.commit();
  }

  return total;
}

function simNaoBadge(valor) {
  return `<span class="badge ${valor ? "yes" : "no"}">${valor ? "Sim" : "Não"}</span>`;
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");

  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    el.classList.add("hidden");
  }, 3500);
}

const TAMANHO_LOTE_RENDER_TABELA = 50;

function normalizarChaveRenderTabela(chave) {
  return String(chave || "tabela").replace(/[^a-zA-Z0-9_-]/g, "-");
}

function getLimiteRenderTabela(chave) {
  const id = normalizarChaveRenderTabela(chave);
  const limite = Number(state.limitesRenderTabela?.[id] || TAMANHO_LOTE_RENDER_TABELA);
  return Number.isFinite(limite) && limite > 0 ? limite : TAMANHO_LOTE_RENDER_TABELA;
}

function limitarItensRenderTabela(chave, itens) {
  const lista = Array.isArray(itens) ? itens : [];
  return lista.slice(0, getLimiteRenderTabela(chave));
}

function limparControleRenderTabela(chave) {
  const id = `controle-render-${normalizarChaveRenderTabela(chave)}`;
  document.getElementById(id)?.remove();
}

function renderControleRenderTabela(tbody, chave, total, exibidos, label = "registros") {
  if (!tbody) return;

  const id = `controle-render-${normalizarChaveRenderTabela(chave)}`;
  const alvo = tbody.closest(".table-wrap") || tbody.closest("table")?.parentElement || tbody.parentElement;

  if (!alvo) return;

  if (!total || total <= TAMANHO_LOTE_RENDER_TABELA) {
    document.getElementById(id)?.remove();
    return;
  }

  let controle = document.getElementById(id);
  if (!controle) {
    controle = document.createElement("div");
    controle.id = id;
    controle.className = "table-render-control";
    alvo.insertAdjacentElement("afterend", controle);
  }

  const temMais = exibidos < total;
  controle.innerHTML = `
    <div>
      Mostrando <strong>${Number(exibidos || 0).toLocaleString("pt-BR")}</strong> de
      <strong>${Number(total || 0).toLocaleString("pt-BR")}</strong> ${escapeHtml(label)}.
      <small>Os filtros e a impressão continuam usando todos os dados filtrados.</small>
    </div>
    <div class="table-render-actions">
      ${temMais ? `<button class="btn btn-sm" type="button" onclick="aumentarLimiteRenderTabela('${normalizarChaveRenderTabela(chave)}')">Carregar mais 50</button>` : ""}
      ${temMais ? `<button class="btn btn-sm btn-primary" type="button" onclick="mostrarTodosRenderTabela('${normalizarChaveRenderTabela(chave)}')">Mostrar todos filtrados</button>` : `<span class="badge ok">Todos visíveis</span>`}
    </div>
  `;
}

function aumentarLimiteRenderTabela(chave) {
  const id = normalizarChaveRenderTabela(chave);
  state.limitesRenderTabela[id] = getLimiteRenderTabela(id) + TAMANHO_LOTE_RENDER_TABELA;
  renderPaginaAtiva();
}

function mostrarTodosRenderTabela(chave) {
  const id = normalizarChaveRenderTabela(chave);
  state.limitesRenderTabela[id] = 999999;
  renderPaginaAtiva();
}

function resetarLimiteRenderTabela(chave) {
  const id = normalizarChaveRenderTabela(chave);
  state.limitesRenderTabela[id] = TAMANHO_LOTE_RENDER_TABELA;
}

function resetarLimitesRenderTabelaPrefixo(prefixo) {
  const p = normalizarChaveRenderTabela(prefixo);
  Object.keys(state.limitesRenderTabela || {}).forEach(chave => {
    if (chave.startsWith(p)) state.limitesRenderTabela[chave] = TAMANHO_LOTE_RENDER_TABELA;
  });
}

async function atualizarDadosServidorAgora() {
  toast("Atualizando dados do servidor...");

  const pagina = paginaAtivaAtual();

  // Reinicia somente os listeners necessários da tela atual.
  const chavesPorPagina = {
    produtos: ["produtos", "ordens"],
    ordens: ["produtos", "ordens"],
    manejo: ["produtos", "ordens", "faccoes", "celulas", "precosReferencia"],
    processos: ["movimentacoes", "faccoes", "celulas"],
    faccoes: ["faccoes", "movimentacoes"],
    celulas: ["celulas", "movimentacoes"],
    rastreamento: ["produtos", "ordens", "movimentacoes", "faccoes", "celulas"],
    pagamentos: ["entregasPagamento", "precosReferencia", "faccoes"],
    relatorios: ["produtos", "ordens"],
    usuarios: ["usuarios"],
    logs: ["logs"]
  };

  (chavesPorPagina[pagina] || []).forEach(chave => {
    if (state.listenersPorChave[chave]) {
      try { state.listenersPorChave[chave](); } catch (error) { console.warn(error); }
      delete state.listenersPorChave[chave];
    }
    state.dadosCarregados[chave] = false;
    state.carregandoDados[chave] = false;
  });

  iniciarDadosEssenciais();
  carregarDadosDaPagina(pagina);
  renderPaginaAtiva();
}

window.atualizarDadosServidorAgora = atualizarDadosServidorAgora;
window.aumentarLimiteRenderTabela = aumentarLimiteRenderTabela;
window.mostrarTodosRenderTabela = mostrarTodosRenderTabela;
window.editarProduto = editarProduto;
window.excluirProduto = excluirProduto;
window.editarOrdem = editarOrdem;
window.excluirOrdem = excluirOrdem;
window.abrirPermissoesUsuario = abrirPermissoesUsuario;
window.alternarTipoUsuario = alternarTipoUsuario;
window.abrirModalExcluirUsuario = abrirModalExcluirUsuario;
window.alternarUsuario = alternarUsuario;
window.iniciarCadastroProdutoPelaOrdem = iniciarCadastroProdutoPelaOrdem;
window.conferirReferenciaPendente = conferirReferenciaPendente;
window.verOrdensDaReferencia = verOrdensDaReferencia;
window.editarManejo = editarManejo;
window.editarManejo = editarManejo;
window.excluirManejo = excluirManejo;
window.iniciarManejoParaOrdem = iniciarManejoParaOrdem;
window.filtrarManejosPorOP = filtrarManejosPorOP;
window.salvarManejoLinha = salvarManejoLinha;
window.limparManejoLinha = limparManejoLinha;
window.adicionarFaseSugestao = adicionarFaseSugestao;
window.adicionarFaseLateralSugestao = adicionarFaseLateralSugestao;
window.adicionarFaccaoSugestao = adicionarFaccaoSugestao;
window.adicionarCeluSugestao = adicionarCeluSugestao;
window.imprimirManejoFiltrado = imprimirManejoFiltrado;
window.imprimirProcessosFiltrados = imprimirProcessosFiltrados;
window.editarFaccao = editarFaccao;
window.alternarFaccao = alternarFaccao;
window.excluirFaccao = excluirFaccao;
window.imprimirRelatorioPagamento = imprimirRelatorioPagamento;

window.excluirEntregaPagamento = excluirEntregaPagamento;
window.alternarStatusEntregaPagamento = alternarStatusEntregaPagamento;
window.editarEntregaPagamento = editarEntregaPagamento;




window.selecionarProcessoValor = selecionarProcessoValor;
window.editarPrecoReferencia = editarPrecoReferencia;
window.alternarPrecoReferencia = alternarPrecoReferencia;
window.excluirPrecoReferencia = excluirPrecoReferencia;
window.editarCelula = editarCelula;
window.alternarCelula = alternarCelula;
window.excluirCelula = excluirCelula;
window.organizarCelulasDuplicadas = organizarCelulasDuplicadas;
window.mandarParaFaccao = mandarParaFaccao;
window.mandarParaCelula = mandarParaCelula;

window.toggleMenuAcoesManejo = toggleMenuAcoesManejo;
window.fecharMenusAcoesManejo = fecharMenusAcoesManejo;
window.abrirModalAjusteMigracao = abrirModalAjusteMigracao;
window.abrirRastreamentoOP = abrirRastreamentoOP;
window.abrirModalChegadaManualFaccao = abrirModalChegadaManualFaccao;
window.registrarChegadaMovimentacao = registrarChegadaMovimentacao;
window.encaminharMovimentacao = encaminharMovimentacao;
window.reenviarMovimentacaoParaFaccao = reenviarMovimentacaoParaFaccao;
window.enviarMovimentacaoParaCelula = enviarMovimentacaoParaCelula;
window.biparMovimentacao = biparMovimentacao;
window.biparOrdemDireto = biparOrdemDireto;
window.enviarOrdemParaManejoDireto = enviarOrdemParaManejoDireto;
window.finalizarMovimentacao = finalizarMovimentacao;
window.excluirMovimentacao = excluirMovimentacao;