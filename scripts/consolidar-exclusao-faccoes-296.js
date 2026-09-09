const fs = require('fs');

const APP = 'app.js';
const ATUALIZADOR = 'corponu-atualizador.js';

let app = fs.readFileSync(APP, 'utf8');
let atualizador = fs.readFileSync(ATUALIZADOR, 'utf8');

const antigo = `async function excluirMovimentacao(id) {
  const mov = state.movimentacoesProducao.find(item => item.id === id);
  if (!mov) return;

  if (!confirm(\`Excluir movimentação da OP \${mov.numeroOP}?\`)) return;

  try {
    await deleteDoc(doc(db, "movimentacoesProducao", id));
    await registrarLog("movimentacao_excluida", "movimentacaoProducao", id, \`OP \${mov.numeroOP} | \${mov.destino}\`);
    toast("Movimentação excluída.");
  } catch (error) {
    console.error(error);
    toast("Erro ao excluir movimentação.");
  }
}`;

if ((app.split(antigo).length - 1) !== 1) {
  throw new Error('Função original excluirMovimentacao não encontrada exatamente uma vez.');
}

const novo = `const exclusoesMovimentacaoEmAndamento = new Set();

function normalizarExclusaoMovimentacao(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, " ")
    .replace(/\\s+/g, " ")
    .trim()
    .toUpperCase();
}

function movimentacaoEhFaccaoParaExclusao(item) {
  const tipo = normalizarExclusaoMovimentacao(item?.tipoDestino || "");
  const area = normalizarExclusaoMovimentacao(item?.area || item?.setor || "");
  const processo = normalizarExclusaoMovimentacao(
    item?.processo || item?.servicoNome || item?.processoMovimentacao || ""
  );

  if (["FACCAO", "FACCAO CORTE"].includes(tipo)) return true;
  if (item?.movimentacaoCorte === true || area === "CORTE") return true;

  return !tipo &&
    Boolean(String(item?.destino || item?.faccao || "").trim()) &&
    ["LATERAL", "ALCA", "ALCAS"].includes(processo);
}

function pagamentoVinculadoAtivoParaExclusao(item) {
  const status = normalizarExclusaoMovimentacao(item?.statusPagamento || item?.status || "");
  return item?.cancelado !== true &&
    item?.excluido !== true &&
    !["CANCELADO", "CANCELADA", "EXCLUIDO", "EXCLUIDA", "ESTORNADO", "ESTORNADA"].includes(status);
}

function pagamentoVinculadoPagoParaExclusao(item) {
  const status = normalizarExclusaoMovimentacao(item?.statusPagamento || item?.status || "");
  return item?.pago === true || ["PAGO", "PAGA", "QUITADO", "QUITADA"].includes(status);
}

async function excluirMovimentacao(id) {
  const movimentacaoId = String(id || "").trim();
  if (!movimentacaoId || exclusoesMovimentacaoEmAndamento.has(movimentacaoId)) return;

  const mov = state.movimentacoesProducao.find(item => item.id === movimentacaoId);
  if (!mov) {
    toast("Essa movimentação já não está disponível.");
    return;
  }

  if (!ehAdmin()) {
    toast("Apenas admin pode excluir movimentações.");
    return;
  }

  if (!movimentacaoEhFaccaoParaExclusao(mov)) {
    if (!confirm(\`Excluir movimentação da OP \${mov.numeroOP}?\`)) return;
    exclusoesMovimentacaoEmAndamento.add(movimentacaoId);
    try {
      await deleteDoc(doc(db, "movimentacoesProducao", movimentacaoId));
      await registrarLog("movimentacao_excluida", "movimentacaoProducao", movimentacaoId, \`OP \${mov.numeroOP} | \${mov.destino}\`);
      toast("Movimentação excluída.");
    } catch (error) {
      console.error(error);
      toast("Erro ao excluir movimentação.");
    } finally {
      exclusoesMovimentacaoEmAndamento.delete(movimentacaoId);
    }
    return;
  }

  exclusoesMovimentacaoEmAndamento.add(movimentacaoId);
  toast("Verificando pagamentos vinculados...");

  try {
    const pagamentosSnap = await getDocs(query(
      collection(db, "entregasPagamento"),
      where("movimentacaoId", "==", movimentacaoId)
    ));
    const pagamentos = pagamentosSnap.docs.map(snapshot => ({
      id: snapshot.id,
      ref: snapshot.ref,
      ...snapshot.data()
    }));
    const ativos = pagamentos.filter(pagamentoVinculadoAtivoParaExclusao);
    const pagos = ativos.filter(pagamentoVinculadoPagoParaExclusao);

    if (pagos.length) {
      toast("Não é possível excluir: existe pagamento desta movimentação já marcado como pago.");
      return;
    }

    const pendentes = ativos.filter(item => !pagamentoVinculadoPagoParaExclusao(item));
    const op = String(mov.numeroOP || "-").trim();
    const processo = String(mov.processo || "-").trim();
    const faccao = String(mov.destino || mov.faccao || "-").trim();
    const complemento = pendentes.length
      ? \`\\nTambém será removido \${pendentes.length === 1 ? "o pagamento pendente vinculado" : \`\${pendentes.length} pagamentos pendentes vinculados\`}.\`
      : "\\nNenhum pagamento pendente vinculado foi encontrado.";

    const confirmar = window.confirm(
      \`Excluir esta movimentação de facção?\\n\\nOP: \${op}\\nProcesso: \${processo}\\nFacção: \${faccao}\${complemento}\\n\\nEssa ação não poderá ser desfeita.\`
    );
    if (!confirmar) return;

    toast("Excluindo movimentação...");
    const batch = writeBatch(db);
    pendentes.forEach(item => batch.delete(item.ref));
    batch.delete(doc(db, "movimentacoesProducao", movimentacaoId));

    const logRef = doc(collection(db, "logsAlteracoes"));
    batch.set(logRef, {
      acao: "movimentacao_faccao_excluida_com_pagamento",
      tipoAlvo: "movimentacaoProducao",
      alvoId: movimentacaoId,
      detalhes: \`OP \${op} | \${processo} | \${faccao} | \${pendentes.length} pagamento(s) pendente(s) vinculado(s) removido(s)\`,
      usuarioUid: state.currentUser?.uid || "",
      usuarioNome: state.perfil?.nome || "",
      usuarioEmail: state.perfil?.email || state.currentUser?.email || "",
      usuarioTipo: state.perfil?.tipo || "",
      criadoEm: serverTimestamp()
    });

    await batch.commit();
    toast("Movimentação e pagamentos pendentes vinculados foram excluídos.");
  } catch (error) {
    console.error("Erro ao excluir movimentação de facção.", error);
    toast("Não foi possível excluir a movimentação. Nenhum dado foi alterado.");
  } finally {
    exclusoesMovimentacaoEmAndamento.delete(movimentacaoId);
  }
}`;

app = app.replace(antigo, novo);

const linhasAntes = atualizador.split(/\r?\n/);
const linhasDepois = linhasAntes.filter(linha => !linha.includes('corponu-faccoes-exclusao-pagamento-vinculado.js'));
if (linhasDepois.length !== linhasAntes.length - 1) {
  throw new Error('Esperava remover exatamente um carregamento do módulo antigo de exclusão.');
}
atualizador = linhasDepois.join('\n') + (atualizador.endsWith('\n') ? '\n' : '');

for (const esperado of [
  'const exclusoesMovimentacaoEmAndamento = new Set();',
  'function movimentacaoEhFaccaoParaExclusao(item)',
  'where("movimentacaoId", "==", movimentacaoId)',
  'const batch = writeBatch(db);',
  'batch.delete(doc(db, "movimentacoesProducao", movimentacaoId));',
  'pagamentoVinculadoPagoParaExclusao',
  'Verificando pagamentos vinculados...'
]) {
  if (!app.includes(esperado)) throw new Error(`Invariante ausente no app.js: ${esperado}`);
}
if (atualizador.includes('corponu-faccoes-exclusao-pagamento-vinculado.js')) {
  throw new Error('Módulo antigo de exclusão continua carregado pelo atualizador.');
}

fs.writeFileSync(APP, app, 'utf8');
fs.writeFileSync(ATUALIZADOR, atualizador, 'utf8');
console.log('Exclusão de Facções consolidada no app.js; wrapper antigo retirado do runtime.');
