const fs = require('fs');

const ARQUIVO = 'update.js';
let source = fs.readFileSync(ARQUIVO, 'utf8');

function replaceOnce(antigo, novo, descricao) {
  const qtd = source.split(antigo).length - 1;
  if (qtd !== 1) throw new Error(`${descricao}: esperado 1 ocorrência, encontrado ${qtd}`);
  source = source.replace(antigo, novo);
}

const ancora = '  async function configurarUsuarioGestaoFases(user) {';
if ((source.split(ancora).length - 1) !== 1) {
  throw new Error('âncora configurarUsuarioGestaoFases não é única');
}

const reparo = `  let reparoListasPrincipaisV299Promessa = null;

  async function repararListasPrincipaisFasesV299() {
    if (reparoListasPrincipaisV299Promessa) return reparoListasPrincipaisV299Promessa;
    if (!usuarioEhAdminFases || !contextoFirebaseFases?.user) return false;

    const { firestore, db, user } = contextoFirebaseFases;
    reparoListasPrincipaisV299Promessa = (async () => {
      const referenciaSutia = firestore.doc(db, "configuracoes", "fasesManejo");
      const referenciaCalcinha = firestore.doc(db, "configuracoes", "fasesManejoCalcinha");
      const [snapshotSutia, snapshotCalcinha] = await Promise.all([
        firestore.getDoc(referenciaSutia),
        firestore.getDoc(referenciaCalcinha)
      ]);

      const dadosSutia = snapshotSutia.exists() ? snapshotSutia.data() : {};
      const dadosCalcinha = snapshotCalcinha.exists() ? snapshotCalcinha.data() : {};
      const atuaisSutia = ordenarFasesGerenciadas(dadosSutia?.sugestoes || []);
      const atuaisCalcinha = ordenarFasesGerenciadas(dadosCalcinha?.sugestoes || []);
      const precisaSutia = !atuaisSutia.length;
      const precisaCalcinha = !atuaisCalcinha.length;
      if (!precisaSutia && !precisaCalcinha) return false;

      const candidatasSutia = new Map();
      const candidatasCalcinha = new Map();
      const adicionar = (mapa, valor) => {
        const fase = normalizarFaseGerenciada(valor);
        const chave = chaveFaseGerenciada(fase);
        if (!fase || !chave) return;
        if ([
          "SEM FASE",
          "CAMPO VAZIO",
          "TODAS",
          "TODOS",
          "SELECIONE A FASE",
          "CARREGANDO FASES",
          "NAO FOI POSSIVEL CARREGAR AS FASES"
        ].includes(chave)) return;
        if (!mapa.has(chave)) mapa.set(chave, fase);
      };

      atuaisSutia.forEach(fase => adicionar(candidatasSutia, fase));
      atuaisCalcinha.forEach(fase => adicionar(candidatasCalcinha, fase));

      try {
        const extras = JSON.parse(localStorage.getItem("fasesManejoExtras") || "[]");
        if (Array.isArray(extras)) {
          extras.forEach(fase => {
            adicionar(candidatasSutia, fase);
            adicionar(candidatasCalcinha, fase);
          });
        }
      } catch (_) {}

      const textoIdentidade = dados => normalizarComparacao([
        dados?.tipoPeca,
        dados?.tipoPecaPadrao,
        dados?.setor,
        dados?.setorLabel,
        dados?.manejoSetor,
        dados?.categoria,
        dados?.processo,
        dados?.processoPlanejado,
        dados?.tipoPecaLabel,
        dados?.produtoNome,
        dados?.observacoes,
        dados?.pendencia
      ].filter(Boolean).join(" "));

      const coletarDocumento = dados => {
        if (!dados || typeof dados !== "object") return;
        const setores = dados.manejosSetores || {};
        const identidade = textoIdentidade(dados);
        const ehCalcinha = identidade.includes("CALCINHA") || Boolean(
          setores?.calcinha || dados?.manejoCalcinha || dados?.calcinha
        );

        [
          setores?.sutia?.fase,
          setores?.bojo?.fase,
          dados?.manejoSutia?.fase,
          dados?.sutia?.fase,
          dados?.faseSutia,
          dados?.faseBojo,
          dados?.manejo?.fase
        ].forEach(valor => adicionar(candidatasSutia, valor));

        [
          setores?.calcinha?.fase,
          dados?.manejoCalcinha?.fase,
          dados?.calcinha?.fase,
          dados?.faseCalcinha
        ].forEach(valor => adicionar(candidatasCalcinha, valor));

        if (dados?.fase) {
          adicionar(ehCalcinha ? candidatasCalcinha : candidatasSutia, dados.fase);
        }

        if (ehCalcinha) {
          adicionar(candidatasCalcinha, dados?.manejo?.fase);
        }

        const visitar = (objeto, caminho = [], profundidade = 0, visitados = new WeakSet()) => {
          if (!objeto || typeof objeto !== "object" || profundidade > 5) return;
          if (visitados.has(objeto)) return;
          visitados.add(objeto);

          Object.entries(objeto).forEach(([chaveOriginal, valor]) => {
            const chave = normalizarComparacao(chaveOriginal).replace(/[^A-Z0-9]/g, "");
            const caminhoTexto = normalizarComparacao([...caminho, chaveOriginal].join(" "));

            if (valor && typeof valor === "object") {
              visitar(valor, [...caminho, chaveOriginal], profundidade + 1, visitados);
              return;
            }

            if (!["FASE", "FASESUTIA", "FASEBOJO", "FASECALCINHA", "FASEMANEJO"].includes(chave)) return;
            if (caminhoTexto.includes("LATERAL")) return;

            if (chave === "FASECALCINHA" || caminhoTexto.includes("CALCINHA")) {
              adicionar(candidatasCalcinha, valor);
              return;
            }
            if (chave === "FASESUTIA" || chave === "FASEBOJO" || caminhoTexto.includes("SUTIA") || caminhoTexto.includes("BOJO")) {
              adicionar(candidatasSutia, valor);
              return;
            }
            if (chave === "FASE" || chave === "FASEMANEJO") {
              adicionar(ehCalcinha ? candidatasCalcinha : candidatasSutia, valor);
            }
          });
        };

        visitar(dados);
      };

      const snapshotOps = await firestore.getDocs(firestore.collection(db, "ordensProducao"));
      snapshotOps.forEach(documento => coletarDocumento(documento.data() || {}));

      try {
        const mapaOrdensDual = window.corponuDualMode?.state?.maps?.ordens;
        if (mapaOrdensDual instanceof Map) {
          mapaOrdensDual.forEach(op => coletarDocumento(op));
        }
      } catch (_) {}

      document.querySelectorAll("#manejoFasesList option, #manejoFasesListCalcinha option").forEach(option => {
        const valor = option.value || option.textContent || "";
        const idLista = option.parentElement?.id || "";
        if (idLista.includes("Calcinha")) adicionar(candidatasCalcinha, valor);
        else adicionar(candidatasSutia, valor);
      });

      const eventosSutia = new Map();
      const eventosCalcinha = new Map();
      try {
        const logs = await firestore.getDocs(firestore.collection(db, "logsAlteracoes"));
        logs.forEach(item => {
          const dados = item.data() || {};
          const tipo = normalizarComparacao(dados.tipoAlvo || "");
          const acao = normalizarComparacao(dados.acao || "");
          const fase = normalizarFaseGerenciada(dados.alvoId || "");
          const chave = chaveFaseGerenciada(fase);
          if (!fase || !chave) return;
          if (tipo.includes("LATERAL") || acao.includes("LATERAL")) return;

          const relacionadaAFase = tipo.includes("FASE") || acao.includes("SUGESTAO DE FASE") || acao.includes("SUGESTÃO DE FASE");
          if (!relacionadaAFase) return;

          const removida = acao.includes("REMOVID") || acao.includes("EXCLUID");
          const adicionada = acao.includes("ADICION") || acao.includes("CADASTR");
          if (!removida && !adicionada) return;

          const evento = {
            fase,
            removida,
            instante: dados.criadoEm?.toMillis?.() || 0,
            id: item.id
          };
          const calcinha = tipo.includes("CALCINHA") || acao.includes("CALCINHA");
          const mapa = calcinha ? eventosCalcinha : eventosSutia;
          const anterior = mapa.get(chave);
          if (!anterior || evento.instante > anterior.instante ||
              (evento.instante === anterior.instante && evento.id.localeCompare(anterior.id) > 0)) {
            mapa.set(chave, evento);
          }
          if (adicionada) adicionar(calcinha ? candidatasCalcinha : candidatasSutia, fase);
        });
      } catch (error) {
        console.warn("Reparo 299: logs administrativos não puderam ser lidos; usando as demais fontes.", error);
      }

      const montarResultado = (dadosAtuais, candidatas, eventos) => {
        const mapaExcluidas = new Map(
          ordenarFasesGerenciadas(dadosAtuais?.sugestoesExcluidas || [])
            .map(fase => [chaveFaseGerenciada(fase), fase])
        );
        eventos.forEach((evento, chave) => {
          if (evento.removida) mapaExcluidas.set(chave, evento.fase);
          else mapaExcluidas.delete(chave);
        });
        const lista = ordenarFasesGerenciadas(
          [...candidatas.values()].filter(fase => !mapaExcluidas.has(chaveFaseGerenciada(fase)))
        );
        return {
          lista,
          excluidas: ordenarFasesGerenciadas([...mapaExcluidas.values()])
        };
      };

      const resultadoSutia = montarResultado(dadosSutia, candidatasSutia, eventosSutia);
      const resultadoCalcinha = montarResultado(dadosCalcinha, candidatasCalcinha, eventosCalcinha);
      let reparadas = 0;

      const repararDocumento = async (referencia, resultado, tipoPeca) => {
        if (!resultado.lista.length) return false;
        return firestore.runTransaction(db, async transacao => {
          const snapshot = await transacao.get(referencia);
          const dados = snapshot.exists() ? snapshot.data() : {};
          const listaAtual = ordenarFasesGerenciadas(dados?.sugestoes || []);
          if (listaAtual.length) return false;

          transacao.set(referencia, {
            sugestoes: resultado.lista,
            sugestoesExcluidas: resultado.excluidas,
            reparoListasPrincipais20260909V299: true,
            reparadoEm: firestore.serverTimestamp(),
            reparadoPor: user.uid,
            atualizadoEm: firestore.serverTimestamp(),
            atualizadoPor: user.uid,
            versaoGerenciamento: APP_VERSION,
            tipoPeca
          }, { merge: true });
          return true;
        });
      };

      if (precisaSutia && await repararDocumento(referenciaSutia, resultadoSutia, "sutia")) reparadas += 1;
      if (precisaCalcinha && await repararDocumento(referenciaCalcinha, resultadoCalcinha, "calcinha")) reparadas += 1;

      if (reparadas) {
        console.info("Reparo 299 das listas principais concluído.", {
          sutia: resultadoSutia.lista.length,
          calcinha: resultadoCalcinha.lista.length
        });
        showUpdateToast(
          "Listas de fase recuperadas: " + resultadoSutia.lista.length +
          " do Sutiã e " + resultadoCalcinha.lista.length + " da Calcinha."
        );
      }
      return reparadas > 0;
    })();

    try {
      return await reparoListasPrincipaisV299Promessa;
    } catch (error) {
      console.error("Reparo 299 das listas principais falhou sem sobrescrever os dados.", error);
      return false;
    } finally {
      reparoListasPrincipaisV299Promessa = null;
    }
  }

`;

source = source.replace(ancora, reparo + ancora);

replaceOnce(
  '      contextoFirebaseFases = { ...contextoFirebaseFases, user, perfil };\n      await reconstruirListaFasesSutiaSeNecessario();',
  '      contextoFirebaseFases = { ...contextoFirebaseFases, user, perfil };\n      await repararListasPrincipaisFasesV299();\n      await reconstruirListaFasesSutiaSeNecessario();',
  'disparo 299 no Sutiã'
);

replaceOnce(
  '      contextoFirebaseFasesCalcinha = { ...contextoFirebaseFasesCalcinha, user, perfil };\n      await reconstruirListaFasesCalcinhaSeNecessario();',
  '      contextoFirebaseFasesCalcinha = { ...contextoFirebaseFasesCalcinha, user, perfil };\n      await repararListasPrincipaisFasesV299();\n      await reconstruirListaFasesCalcinhaSeNecessario();',
  'disparo 299 na Calcinha'
);

for (const esperado of [
  'reparoListasPrincipais20260909V299',
  'async function repararListasPrincipaisFasesV299()',
  'window.corponuDualMode?.state?.maps?.ordens',
  'firestore.collection(db, "logsAlteracoes")',
  'dados?.manejo?.fase',
  'dados?.faseCalcinha',
  'dados?.faseSutia'
]) {
  if (!source.includes(esperado)) throw new Error(`invariante ausente: ${esperado}`);
}

fs.writeFileSync(ARQUIVO, source, 'utf8');
console.log('Reparo estrutural das listas principais 299 aplicado ao update.js.');
