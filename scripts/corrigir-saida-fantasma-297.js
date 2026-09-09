const fs = require('fs');

const ARQUIVO = 'corponu-faccoes-tres-abas-saida.js';
let src = fs.readFileSync(ARQUIVO, 'utf8');

const V_ANTIGA = '2026-09-04-faccoes-saida-controlada-285';
const V_NOVA = '2026-09-09-saida-fantasma-canonica-297';

if (!src.includes(`const V = "${V_ANTIGA}";`)) {
  throw new Error(`Versão-base esperada não encontrada: ${V_ANTIGA}`);
}
src = src.replace(`const V = "${V_ANTIGA}";`, `const V = "${V_NOVA}";`);

const ancoraHelpers = '  const processosPermitidos = tipoAba => PROCESSOS_SAIDA[tipoAba] || [];\n';
if ((src.split(ancoraHelpers).length - 1) !== 1) {
  throw new Error('Âncora dos helpers não encontrada exatamente uma vez.');
}

const helpers = `

  const STATUS_MOVIMENTACAO_ENCERRADA = new Set([
    "CANCELADO", "CANCELADA", "EXCLUIDO", "EXCLUIDA",
    "FINALIZADO", "FINALIZADA", "CONCLUIDO", "CONCLUIDA",
    "RETORNOU", "RETORNADA", "ENCAMINHADO", "ENCAMINHADA"
  ]);

  function tipoDestinoCanonicoMovimentacao(mov) {
    const informado = norm(mov?.tipoDestino || mov?.tipoDestinoLabel || "");
    if (informado.includes("FACCAO")) return informado.includes("CORTE") ? "faccao_corte" : "faccao";
    if (informado.includes("CELULA")) return "celula";

    const contexto = norm([
      mov?.area,
      mov?.setor,
      mov?.areaLabel,
      mov?.setorLabel
    ].filter(Boolean).join(" "));

    if (mov?.movimentacaoCorte === true || contexto.includes("CORTE")) return "faccao_corte";
    if (contexto.includes("CELULA")) return "celula";

    const processo = norm(mov?.processo || "");
    const destino = norm(mov?.destino || mov?.faccao || "");
    if (!informado && destino && processo && processo !== "CELULA INTERNA") return "faccao";

    return "";
  }

  function movimentacaoBloqueiaNovaSaida(mov, processoAtual) {
    if (!mov || tipoDestinoCanonicoMovimentacao(mov) !== "faccao") return false;
    if (!norm(mov?.destino || mov?.faccao || "")) return false;
    if (mov?.dataChegada) return false;
    if (mov?.cancelado === true || mov?.excluido === true) return false;
    if (STATUS_MOVIMENTACAO_ENCERRADA.has(norm(mov?.status || ""))) return false;
    return norm(mov?.processo || "") === norm(processoAtual || "");
  }

  function movimentacaoPrecisaCanonizacao(mov, processoAtual, abaAtual) {
    const abaCanonica = abaAtual === "calcinha" ? "calcinha" : "sutia";
    return norm(mov?.tipoDestino || "") !== "FACCAO" ||
      norm(mov?.tipoDestinoLabel || "") !== "FACCAO" ||
      norm(mov?.area || "") !== norm(abaCanonica) ||
      norm(mov?.setor || "") !== norm(abaCanonica) ||
      norm(mov?.processo || "") !== norm(processoAtual || "");
  }

  async function localizarSaidaFaccaoEmAndamento(c, processoAtual) {
    const snapshot = await c.f.getDocs(c.f.query(
      c.f.collection(c.db, "movimentacoesProducao"),
      c.f.where("opId", "==", op.id)
    ));

    const movimentos = snapshot.docs
      .map(docSnap => ({ id: docSnap.id, ref: docSnap.ref, ...docSnap.data() }))
      .filter(mov => movimentacaoBloqueiaNovaSaida(mov, processoAtual));

    if (!movimentos.length) return null;

    const abaCanonica = aba === "calcinha" ? "calcinha" : "sutia";
    const abaLabel = abaCanonica === "calcinha" ? "Calcinha" : "Sutiã";
    const paraNormalizar = movimentos.filter(mov => movimentacaoPrecisaCanonizacao(mov, processoAtual, abaCanonica));

    if (paraNormalizar.length) {
      const batch = c.f.writeBatch(c.db);
      paraNormalizar.forEach(mov => {
        batch.set(mov.ref, {
          tipoDestino: "faccao",
          tipoDestinoLabel: "Facção",
          area: abaCanonica,
          areaLabel: abaLabel,
          setor: abaCanonica,
          setorLabel: abaLabel,
          processo: norm(processoAtual),
          normalizadoSaidaFantasma297: true,
          normalizadoSaidaFantasma297Em: c.f.serverTimestamp(),
          atualizadoPor: c.auth.currentUser?.uid || "",
          atualizadoEm: c.f.serverTimestamp()
        }, { merge: true });
      });
      await batch.commit();
      document.getElementById("btnAtualizarServidor")?.click();
    }

    return { movimentos, normalizados: paraNormalizar.length };
  }
`;

src = src.replace(ancoraHelpers, ancoraHelpers + helpers);

const blocoAntigo = `    const lista = await c.f.getDocs(c.f.query(c.f.collection(c.db, "movimentacoesProducao"), c.f.where("opId", "==", op.id)));
    if (lista.docs.some(d => {
      const m = d.data();
      return !m.dataChegada && !m.cancelado && !m.excluido && norm(m.status) !== "CANCELADO" && norm(m.processo) === processo;
    })) return toast(\`Já existe uma saída em andamento para \${processo}.\`);
`;

if ((src.split(blocoAntigo).length - 1) !== 1) {
  throw new Error('Bloco antigo de detecção de saída não encontrado exatamente uma vez.');
}

const blocoNovo = `    const conflito = await localizarSaidaFaccaoEmAndamento(c, processo);
    if (conflito) {
      const totalConflitos = conflito.movimentos.length;
      const prefixo = totalConflitos === 1 ? "Já existe uma saída" : \`Já existem \${totalConflitos} saídas\`;
      if (conflito.normalizados > 0) {
        return toast(\`\${prefixo} de Facção em andamento para \${processo}. O registro antigo foi normalizado e voltou a ficar visível na aba Facções. Pesquise a OP novamente.\`);
      }
      return toast(\`\${prefixo} de Facção em andamento para \${processo}.\`);
    }
`;

src = src.replace(blocoAntigo, blocoNovo);

for (const esperado of [
  `const V = "${V_NOVA}";`,
  'function tipoDestinoCanonicoMovimentacao(mov)',
  'function movimentacaoBloqueiaNovaSaida(mov, processoAtual)',
  'function localizarSaidaFaccaoEmAndamento(c, processoAtual)',
  'tipoDestino: "faccao"',
  'normalizadoSaidaFantasma297: true',
  'const conflito = await localizarSaidaFaccaoEmAndamento(c, processo);'
]) {
  if (!src.includes(esperado)) throw new Error(`Invariante ausente: ${esperado}`);
}

if (src.includes('return !m.dataChegada && !m.cancelado && !m.excluido && norm(m.status) !== "CANCELADO" && norm(m.processo) === processo;')) {
  throw new Error('A regra antiga de bloqueio genérico continua presente.');
}

fs.writeFileSync(ARQUIVO, src, 'utf8');
console.log('Saída fantasma 297: classificação canônica aplicada ao fluxo de Facções.');
