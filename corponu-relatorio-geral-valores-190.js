(() => {
  "use strict";

  const VERSION = "2026-08-12-relatorio-geral-valores-190";
  const FIREBASE_VERSION = "10.12.5";
  const CONFIG_SUTIA_DOC = "sutia-completo-pagamento";
  const BOTAO_ID = "btnRelatorioGeralValores190";
  const STYLE_ID = "styleRelatorioGeralValores190";
  const VALOR_INTERLOCK_PADRAO = 0.18;

  if (window.__CORPONU_RELATORIO_GERAL_VALORES_190__ === VERSION) return;
  window.__CORPONU_RELATORIO_GERAL_VALORES_190__ = VERSION;

  let firebasePromise = null;
  let gerando = false;

  const texto = valor => String(valor ?? "").trim();
  const normalizar = valor => texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9*]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  const escapar = valor => String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function numero(valor) {
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
    const bruto = texto(valor).replace(/R\$/gi, "").replace(/\s+/g, "");
    if (!bruto) return 0;
    const ajustado = bruto.includes(",")
      ? bruto.replace(/\./g, "").replace(",", ".")
      : bruto;
    const convertido = Number(ajustado.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(convertido) ? convertido : 0;
  }

  function moeda4(valor) {
    return `R$ ${numero(valor).toLocaleString("pt-BR", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    })}`;
  }

  function valorDoPreco(item) {
    for (const campo of ["valor", "valorUnitario", "preco", "valorPorPeca"]) {
      const valor = numero(item?.[campo]);
      if (valor > 0) return valor;
    }
    return 0;
  }

  function processoCanonico(valor) {
    const chave = normalizar(valor);
    const aliases = {
      BOJO: "ENCAPAR BOJO",
      ENCAPAR: "ENCAPAR BOJO",
      "ENCAPAR BOJOS": "ENCAPAR BOJO",
      ALCA: "ALÇA",
      ALCAS: "ALÇA",
      "MONTAGEM CALCINHA": "CALCINHA MONTAGEM",
      "MONTAR CALCINHA": "CALCINHA MONTAGEM",
      "SUTIA MONTAGEM": "SUTIÃ MONTAGEM",
      "SUTIA COMPLETO": "SUTIÃ COMPLETO"
    };
    return aliases[chave] || texto(valor).toUpperCase();
  }

  function referenciaGlobal(valor) {
    const chave = normalizar(valor);
    return ["TODAS", "TODOS", "GERAL", "GLOBAL", "*"].includes(chave);
  }

  function precoGlobal(item) {
    const tipo = normalizar(item?.tipoValor);
    return item?.valorPadraoGlobalAlca === true ||
      item?.valorPadraoGlobalInterlock === true ||
      tipo.includes("GLOBAL") ||
      referenciaGlobal(item?.referencia);
  }

  async function firebase() {
    if (firebasePromise) return firebasePromise;
    firebasePromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
    ]).then(([appMod, fs]) => {
      if (!appMod.getApps().length) throw new Error("Firebase ainda não foi inicializado.");
      return { fs, db: fs.getFirestore(appMod.getApp()) };
    }).catch(error => {
      firebasePromise = null;
      throw error;
    });
    return firebasePromise;
  }

  function toast(mensagem, erro = false) {
    const principal = document.getElementById("toast");
    if (principal) {
      principal.textContent = mensagem;
      principal.classList.remove("hidden");
      principal.style.background = erro ? "#991b1b" : "#166534";
      window.clearTimeout(window.__corponuRelValores190Toast);
      window.__corponuRelValores190Toast = window.setTimeout(() => {
        principal.classList.add("hidden");
        principal.style.removeProperty("background");
      }, erro ? 6500 : 3500);
      return;
    }
    window.alert(mensagem);
  }

  function injetarEstiloBotao() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #processosValoresIntro61 .rgv190-acoes{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}
      #${BOTAO_ID}{border:0;border-radius:10px;padding:10px 14px;background:#111827;color:#fff;font-weight:900;font-size:12px;cursor:pointer;box-shadow:0 7px 18px rgba(15,23,42,.14)}
      #${BOTAO_ID}:hover{background:#020617}
      #${BOTAO_ID}:disabled{opacity:.65;cursor:wait}
    `;
    document.head.appendChild(style);
  }

  function garantirBotao() {
    const pagina = document.getElementById("processos");
    if (!pagina || document.getElementById(BOTAO_ID)) return false;

    injetarEstiloBotao();
    const intro = document.getElementById("processosValoresIntro61") || pagina.querySelector(".cn61-intro") || pagina.firstElementChild;
    if (!intro) return false;

    let acoes = intro.querySelector(".rgv190-acoes");
    if (!acoes) {
      acoes = document.createElement("div");
      acoes.className = "rgv190-acoes";
      intro.appendChild(acoes);
    }

    const botao = document.createElement("button");
    botao.id = BOTAO_ID;
    botao.type = "button";
    botao.textContent = "Relatório geral de valores";
    botao.title = "Reunir todos os valores cadastrados e regras globais em um relatório imprimível";
    botao.addEventListener("click", gerarRelatorio);
    acoes.appendChild(botao);
    return true;
  }

  async function carregarDados() {
    const { fs, db } = await firebase();
    const [precosSnap, configSnap] = await Promise.all([
      fs.getDocs(fs.collection(db, "precosReferencia")),
      fs.getDoc(fs.doc(db, "configuracoes", CONFIG_SUTIA_DOC))
    ]);

    const precos = precosSnap.docs.map(documento => ({ id: documento.id, ...documento.data() }));
    const configSalva = configSnap.exists();
    const dadosConfig = configSalva ? configSnap.data() : {};
    const config = {
      valorBaseGeral: numero(dadosConfig.valorBaseGeral) || 5.5,
      referenciaEspecial: texto(dadosConfig.referenciaEspecial) || "912",
      valorBaseReferenciaEspecial: numero(dadosConfig.valorBaseReferenciaEspecial) || 6.5,
      descontoFechoNaoFeito: numero(dadosConfig.descontoFechoNaoFeito) || 0.25,
      descontoPontoLuzNaoFeito: numero(dadosConfig.descontoPontoLuzNaoFeito) || 0.15,
      origem: configSalva ? "Configuração salva" : "Padrão do sistema"
    };

    return { precos, config };
  }

  function ordenarReferencias(a, b) {
    return String(a?.referencia || "").localeCompare(String(b?.referencia || ""), "pt-BR", { numeric: true });
  }

  function construirRelatorio({ precos, config }) {
    const globais = precos.filter(precoGlobal);
    const especificos = precos.filter(item => !precoGlobal(item));

    const alca = globais.find(item =>
      item.id === "valor-padrao-alca" ||
      item?.valorPadraoGlobalAlca === true ||
      normalizar(processoCanonico(item?.processo || item?.servicoNome)) === "ALCA"
    );
    const valorAlca = valorDoPreco(alca);
    const multiplicadorAlca = Math.max(1, numero(alca?.multiplicadorQuantidade) || 2);

    const interlockSalvo = globais.find(item =>
      item.id === "valor-padrao-interlock" ||
      item?.valorPadraoGlobalInterlock === true ||
      normalizar(processoCanonico(item?.processo || item?.servicoNome)) === "INTERLOCK"
    );
    const valorInterlock = valorDoPreco(interlockSalvo) || VALOR_INTERLOCK_PADRAO;

    const outrosGlobais = globais.filter(item => item !== alca && item !== interlockSalvo);

    const grupos = new Map();
    especificos.forEach(item => {
      const processo = processoCanonico(item?.processo || item?.servicoNome || "SEM PROCESSO");
      if (!grupos.has(processo)) grupos.set(processo, []);
      grupos.get(processo).push(item);
    });

    const processosOrdenados = [...grupos.keys()].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
    const totalAtivos = especificos.filter(item => item?.ativo !== false).length;
    const totalInativos = especificos.filter(item => item?.ativo === false).length;
    const dataGeracao = new Date().toLocaleString("pt-BR");

    const globaisHtml = [
      ["SUTIÃ COMPLETO", "Valor base geral por peça", "Geral", config.valorBaseGeral, config.origem],
      ["SUTIÃ COMPLETO", `Valor da referência especial ${config.referenciaEspecial}`, `Ref. ${config.referenciaEspecial}`, config.valorBaseReferenciaEspecial, config.origem],
      ["FECHO", "Desconto por peça quando não veio feito", "Sutiã Completo", config.descontoFechoNaoFeito, config.origem],
      ["PONTO DE LUZ", "Desconto por peça quando não veio feito", "Sutiã Completo", config.descontoPontoLuzNaoFeito, config.origem],
      ["ALÇA", "Valor de uma alça", "Todas as referências aplicáveis", valorAlca, alca ? "Valor global salvo" : "Valor não localizado"],
      ["ALÇA", `${multiplicadorAlca} alças por sutiã`, "Total de alças por peça", valorAlca * multiplicadorAlca, alca ? "Calculado a partir do valor global" : "Valor não localizado"],
      ["INTERLOCK", "Valor por peça", "Todas as referências", valorInterlock, interlockSalvo ? "Valor global salvo" : "Regra fixa do sistema"]
    ].map(([processo, item, abrangencia, valor, origem]) => `
      <tr>
        <td><strong>${escapar(processo)}</strong></td>
        <td>${escapar(item)}</td>
        <td>${escapar(abrangencia)}</td>
        <td class="valor">${valor > 0 ? escapar(moeda4(valor)) : "Não informado"}</td>
        <td>${escapar(origem)}</td>
      </tr>
    `).join("");

    const outrosGlobaisHtml = outrosGlobais.length ? `
      <h2>Outros valores globais encontrados</h2>
      <table>
        <thead><tr><th>Processo</th><th>Referência / abrangência</th><th>Valor</th><th>Status</th></tr></thead>
        <tbody>${outrosGlobais.sort((a, b) => processoCanonico(a?.processo).localeCompare(processoCanonico(b?.processo), "pt-BR")).map(item => `
          <tr>
            <td><strong>${escapar(processoCanonico(item?.processo || item?.servicoNome || "GLOBAL"))}</strong></td>
            <td>${escapar(item?.referencia || "Geral")}</td>
            <td class="valor">${escapar(moeda4(valorDoPreco(item)))}</td>
            <td>${item?.ativo === false ? '<span class="inativo">Inativo</span>' : '<span class="ativo">Ativo</span>'}</td>
          </tr>
        `).join("")}</tbody>
      </table>
    ` : "";

    const processosHtml = processosOrdenados.map(processo => {
      const itens = [...grupos.get(processo)].sort(ordenarReferencias);
      const ativos = itens.filter(item => item?.ativo !== false).length;
      const inativos = itens.length - ativos;
      return `
        <section class="processo-bloco">
          <div class="processo-titulo">
            <h2>${escapar(processo)}</h2>
            <span>${itens.length.toLocaleString("pt-BR")} referência(s) · ${ativos} ativa(s)${inativos ? ` · ${inativos} inativa(s)` : ""}</span>
          </div>
          <table>
            <thead><tr><th>Referência</th><th>Valor por peça</th><th>Setor</th><th>Status</th></tr></thead>
            <tbody>${itens.map(item => `
              <tr>
                <td><strong>${escapar(item?.referencia || "-")}</strong></td>
                <td class="valor">${escapar(moeda4(valorDoPreco(item)))}</td>
                <td>${escapar(item?.setorLabel || item?.setor || "-")}</td>
                <td>${item?.ativo === false ? '<span class="inativo">Inativo</span>' : '<span class="ativo">Ativo</span>'}</td>
              </tr>
            `).join("")}</tbody>
          </table>
        </section>
      `;
    }).join("");

    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório Geral de Valores - CorpoNu</title>
<style>
  *{box-sizing:border-box} body{margin:0;background:#f3f4f6;color:#111827;font-family:Arial,sans-serif;font-size:12px;line-height:1.4}
  .pagina{max-width:1150px;margin:24px auto;padding:26px;background:#fff;border:1px solid #dbe3ef;border-radius:16px;box-shadow:0 16px 45px rgba(15,23,42,.08)}
  .topo{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding-bottom:16px;border-bottom:2px solid #111827}
  h1{margin:0;font-size:24px}.sub{margin-top:5px;color:#64748b}.acoes{display:flex;gap:8px;flex-wrap:wrap}
  button{border:0;border-radius:9px;padding:10px 13px;background:#111827;color:#fff;font-weight:800;cursor:pointer}
  .resumo{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}.card{padding:12px;border:1px solid #dbe3ef;border-radius:11px;background:#f8fafc}.card span{display:block;color:#64748b;font-size:10px;font-weight:800;text-transform:uppercase}.card strong{display:block;margin-top:4px;font-size:18px}
  h2{margin:22px 0 9px;font-size:17px;color:#1e293b}table{width:100%;border-collapse:collapse;margin-bottom:16px}th,td{padding:8px 9px;border:1px solid #dbe3ef;text-align:left;vertical-align:middle}th{background:#eef2ff;font-size:10px;text-transform:uppercase;letter-spacing:.02em}.valor{text-align:right;font-weight:900;white-space:nowrap}
  .ativo,.inativo{display:inline-flex;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:900}.ativo{background:#dcfce7;color:#166534}.inativo{background:#fee2e2;color:#991b1b}
  .processo-bloco{break-inside:avoid-page;margin-top:18px}.processo-titulo{display:flex;align-items:end;justify-content:space-between;gap:12px}.processo-titulo h2{margin-bottom:7px}.processo-titulo span{color:#64748b;font-weight:700;margin-bottom:8px}
  .rodape{margin-top:26px;padding-top:12px;border-top:1px solid #cbd5e1;color:#64748b;font-size:10px}
  @media(max-width:760px){.pagina{margin:0;padding:14px;border:0;border-radius:0}.topo{display:block}.acoes{margin-top:12px}.resumo{grid-template-columns:repeat(2,1fr)}.processo-titulo{display:block}.processo-titulo span{display:block}}
  @media print{body{background:#fff}.pagina{max-width:none;margin:0;padding:0;border:0;box-shadow:none}.acoes{display:none}.processo-bloco{break-inside:avoid-page}thead{display:table-header-group}@page{size:A4 portrait;margin:10mm}}
</style>
</head>
<body>
<main class="pagina">
  <header class="topo">
    <div><h1>Relatório Geral de Valores</h1><div class="sub">CorpoNu · Gerado em ${escapar(dataGeracao)}</div></div>
    <div class="acoes"><button type="button" onclick="window.print()">Imprimir / Salvar PDF</button></div>
  </header>

  <div class="resumo">
    <div class="card"><span>Processos por referência</span><strong>${processosOrdenados.length}</strong></div>
    <div class="card"><span>Referências / registros</span><strong>${especificos.length.toLocaleString("pt-BR")}</strong></div>
    <div class="card"><span>Ativos</span><strong>${totalAtivos.toLocaleString("pt-BR")}</strong></div>
    <div class="card"><span>Inativos</span><strong>${totalInativos.toLocaleString("pt-BR")}</strong></div>
  </div>

  <h2>Valores globais e regras do sistema</h2>
  <table>
    <thead><tr><th>Processo / item</th><th>Regra</th><th>Abrangência</th><th>Valor</th><th>Origem</th></tr></thead>
    <tbody>${globaisHtml}</tbody>
  </table>

  ${outrosGlobaisHtml}

  <h2>Valores cadastrados por referência</h2>
  ${processosHtml || '<p>Nenhum valor por referência cadastrado.</p>'}

  <div class="rodape">Este relatório é uma fotografia dos valores existentes no sistema no momento da geração. Valores inativos são exibidos para fins de conferência e auditoria.</div>
</main>
</body>
</html>`;
  }

  async function gerarRelatorio() {
    if (gerando) return;
    const botao = document.getElementById(BOTAO_ID);
    const janela = window.open("", "_blank");
    if (!janela) {
      toast("O navegador bloqueou a abertura do relatório. Permita pop-ups para este site.", true);
      return;
    }

    gerando = true;
    if (botao) {
      botao.disabled = true;
      botao.textContent = "Gerando relatório...";
    }
    janela.document.open();
    janela.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Gerando relatório...</title></head><body style="font-family:Arial;padding:30px"><h2>Gerando relatório geral de valores...</h2><p>Consultando os valores cadastrados no sistema.</p></body></html>');
    janela.document.close();

    try {
      const dados = await carregarDados();
      const html = construirRelatorio(dados);
      janela.document.open();
      janela.document.write(html);
      janela.document.close();
      janela.focus();
    } catch (error) {
      console.error("Não foi possível gerar o relatório geral de valores.", error);
      try {
        janela.document.open();
        janela.document.write(`<p style="font-family:Arial;padding:24px;color:#991b1b"><strong>Não foi possível gerar o relatório.</strong><br>${escapar(error?.message || "Erro desconhecido")}</p>`);
        janela.document.close();
      } catch (_) {}
      toast(error?.message || "Não foi possível gerar o relatório geral de valores.", true);
    } finally {
      gerando = false;
      if (botao && document.contains(botao)) {
        botao.disabled = false;
        botao.textContent = "Relatório geral de valores";
      }
    }
  }

  function instalar() {
    garantirBotao();
    [100, 350, 800, 1600].forEach(atraso => window.setTimeout(garantirBotao, atraso));
    document.addEventListener("click", event => {
      const alvo = event.target instanceof Element ? event.target : null;
      if (alvo?.closest('.nav-btn[data-page="processos"]')) {
        [50, 180, 500].forEach(atraso => window.setTimeout(garantirBotao, atraso));
      }
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", instalar, { once: true });
  else instalar();
})();
