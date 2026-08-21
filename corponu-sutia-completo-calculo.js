(() => {
  "use strict";

  const LOADER_VERSION = "2026-08-11-admin-edita-componentes-chegada-175b";
  const BASE_FILE = "corponu-sutia-completo-calculo-base-174.js";
  const GUARD = "__CORPONU_SUTIA_COMPLETO_ADMIN_LOADER_175B__";

  if (window[GUARD] === LOADER_VERSION) return;
  window[GUARD] = LOADER_VERSION;

  function executarFonte(fonte, etiqueta) {
    const blob = new Blob([fonte], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const script = document.createElement("script");
    script.src = url;
    script.async = false;
    script.dataset.corponuSutiaCompletoFonte = etiqueta;
    script.onload = () => URL.revokeObjectURL(url);
    script.onerror = () => {
      URL.revokeObjectURL(url);
      console.error(`Não foi possível executar o cálculo do Sutiã Completo (${etiqueta}).`);
    };
    document.head.appendChild(script);
  }

  function aplicarEdicaoAdmin(fonteOriginal) {
    let fonte = String(fonteOriginal || "");

    const substituir = (antigo, novo, descricao) => {
      if (!fonte.includes(antigo)) throw new Error(`Trecho não encontrado: ${descricao}`);
      fonte = fonte.replace(antigo, novo);
    };

    const substituirRegex = (padrao, novo, descricao) => {
      if (!padrao.test(fonte)) throw new Error(`Função não encontrada: ${descricao}`);
      fonte = fonte.replace(padrao, novo);
    };

    substituir(
      'const VERSION = "2026-08-11-componentes-opcionais-calculo-170";',
      'const VERSION = "2026-08-11-admin-edita-componentes-chegada-175b";',
      "versão interna"
    );

    substituir(
      '      origemExecucao: texto(salvo.origemExecucao || ""),\n      origem: texto(salvo.origemLabel || salvo.origem || "Registro consolidado"),',
      '      origemExecucao: texto(salvo.origemExecucao || ""),\n      indefinido: normalizar(salvo.origemExecucao || "") === "NAO INFORMADO" || normalizar(salvo.status || "") === "NAO INFORMADO",\n      origem: texto(salvo.origemLabel || salvo.origem || "Registro consolidado"),',
      "origem consolidada"
    );

    substituir(
      '  function informacaoDefinitiva(info) {\n    return info?.conhecido === true && info?.status !== "parcial";\n  }\n',
      `  function informacaoDefinitiva(info) {\n    return info?.conhecido === true && info?.status !== "parcial";\n  }\n\n  function valorOrigemComponente(info) {\n    const origem = normalizar(info?.origemExecucao || "");\n    if (info?.indefinido === true || origem === "NAO INFORMADO") return "nao_informado";\n    if (info?.feitoPelaFaccao === true || origem === "FACCAO") return "faccao";\n    if (info?.feitoPelaConfeccao === true || origem === "CONFECCAO") return "confeccao";\n    if (typeof info?.descontar === "boolean") return info.descontar ? "confeccao" : "faccao";\n    if (typeof info?.pronto === "boolean") return info.pronto ? "confeccao" : "faccao";\n    return "";\n  }\n`,
      "helper da origem"
    );

    substituirRegex(
      /  function criarBlocoComponente\(nome, info, prefixo\) \{[\s\S]*?\n  \}\n\n  function criarPainelChegada/,
      `  function criarBlocoComponente(nome, info, prefixo) {
    const titulo = nome === "lateral" ? "Lateral" : "Bojo";
    const idSituacao = \`${'${prefixo}'}${'${nome === "lateral" ? "LateralSituacao" : "BojoSituacao"}'}\`;
    const idResponsavel = \`${'${prefixo}'}${'${nome === "lateral" ? "LateralResponsavel" : "BojoResponsavel"}'}\`;
    const definitiva = informacaoDefinitiva(info);
    const adminEdita = definitiva && ehAdmin(perfilAtual);

    if (definitiva && !adminEdita) {
      const valorOrigem = valorOrigemComponente(info);
      const rotuloOrigem = valorOrigem === "faccao"
        ? "Feito pela facção"
        : valorOrigem === "confeccao"
          ? "Feito pela confecção"
          : "Não informado";
      const classeOrigem = valorOrigem === "faccao" ? "sim" : valorOrigem === "confeccao" ? "nao" : "pendente";
      const descontar = valorOrigem === "confeccao";

      return \`
        <div class="sc51-componente" data-componente="${'${nome}'}" data-descontar="${'${descontar ? "1" : "0"}'}" data-feito-faccao="${'${valorOrigem === "faccao" ? "1" : "0"}'}" data-feito-confeccao="${'${valorOrigem === "confeccao" ? "1" : "0"}'}" data-origem-execucao="${'${escapar(info.origemExecucao || "")}'}">
          <strong>${'${titulo}'}</strong>
          <span class="sc51-pill ${'${classeOrigem}'}">${'${rotuloOrigem}'}</span>
          <small>${'${info.origem || "Informação registrada"}'}${'${info.responsavel ? ` • ${info.responsavel}` : ""}'}</small>
        </div>\`;
    }

    const parcial = info?.status === "parcial";
    const valorAtual = adminEdita ? valorOrigemComponente(info) : "";
    const detalheParcial = adminEdita
      ? "Informação atual carregada da OP. Como administrador, você pode corrigi-la antes de confirmar esta chegada."
      : parcial
        ? \`${'${numero(info.quantidade).toLocaleString("pt-BR")}'} de ${'${numero(info.quantidadeTotal || 0).toLocaleString("pt-BR")}'} peças registradas. Confirme esta chegada.\`
        : "Nenhuma informação registrada na OP.";
    const responsavelAtual = adminEdita && valorAtual === "faccao"
      ? escapar(info.responsavel || "")
      : parcial
        ? escapar(info.responsavel || "")
        : "";

    return \`
      <div class="sc51-componente" data-componente="${'${nome}'}" ${'${adminEdita ? \'data-edicao-admin="1"\' : ""}'}>
        <strong>${'${adminEdita ? `${titulo} — edição do administrador` : parcial ? `${titulo} parcialmente registrada` : `${titulo} sem informação`}'}</strong>
        <select id="${'${idSituacao}'}" required>
          <option value="">Informe a situação</option>
          <option value="faccao" ${'${valorAtual === "faccao" ? "selected" : ""}'}>${'${nome === "lateral" ? "Lateral feita pela facção" : "Bojo feito pela facção"}'}</option>
          <option value="confeccao" ${'${valorAtual === "confeccao" ? "selected" : ""}'}>${'${nome === "lateral" ? "Lateral feita pela confecção" : "Bojo feito pela confecção"}'}</option>
          <option value="nao_informado" ${'${valorAtual === "nao_informado" ? "selected" : ""}'}>Não sei / não informado</option>
        </select>
        <input id="${'${idResponsavel}'}" type="text" maxlength="120" placeholder="Quem fez? (opcional)" value="${'${responsavelAtual}'}" ${'${valorAtual === "faccao" ? "" : "disabled"}'}>
        <small>${'${detalheParcial}'} ${'${adminEdita ? "A alteração substituirá a informação anterior da OP." : `A escolha será usada neste cálculo${parcial ? "" : " e ficará registrada na OP"}.`}'}</small>
      </div>\`;
  }

  function criarPainelChegada`,
      "bloco editável de Lateral/Bojo"
    );

    substituirRegex(
      /  function dadosDoPainel\(prefixo, contexto\) \{[\s\S]*?\n  \}\n\n  async function calcularMemoria/,
      `  function dadosDoPainel(prefixo, contexto) {
    const ler = (nome, info) => {
      const titulo = nome === "lateral" ? "Lateral" : "Bojo";
      const select = document.getElementById(\`${'${prefixo}'}${'${titulo}'}Situacao\`);

      if (select instanceof HTMLSelectElement) {
        const valor = texto(select.value);
        return {
          conhecido: valor === "faccao" || valor === "confeccao" || valor === "nao_informado",
          pronto: valor === "faccao" || valor === "confeccao",
          descontar: valor === "confeccao",
          indefinido: valor === "nao_informado",
          feitoPelaFaccao: valor === "faccao",
          feitoPelaConfeccao: valor === "confeccao",
          origemExecucao: valor === "nao_informado" ? "nao_informado" : valor,
          origem: valor === "faccao" ? "Feito pela facção na chegada do Sutiã Completo" : valor === "confeccao" ? "Feito pela confecção" : "Origem ainda não informada",
          responsavel: texto(document.getElementById(\`${'${prefixo}'}${'${titulo}'}Responsavel\`)?.value)
        };
      }

      if (informacaoDefinitiva(info)) {
        const valorOrigem = valorOrigemComponente(info);
        return {
          conhecido: true,
          pronto: valorOrigem === "faccao" || valorOrigem === "confeccao",
          descontar: valorOrigem === "confeccao",
          indefinido: valorOrigem === "nao_informado",
          feitoPelaFaccao: valorOrigem === "faccao",
          feitoPelaConfeccao: valorOrigem === "confeccao",
          origemExecucao: valorOrigem,
          origem: info.origem,
          responsavel: info.responsavel
        };
      }

      return {
        conhecido: false,
        pronto: false,
        descontar: false,
        indefinido: false,
        feitoPelaFaccao: false,
        feitoPelaConfeccao: false,
        origemExecucao: "",
        origem: "",
        responsavel: ""
      };
    };

    return {
      lateral: ler("lateral", contexto.lateral),
      bojo: ler("bojo", contexto.bojo),
      fechoPronto: document.getElementById(\`${'${prefixo}'}FechoPronto\`)?.checked === true,
      pontoLuzPronto: document.getElementById(\`${'${prefixo}'}PontoLuzPronto\`)?.checked === true
    };
  }

  async function calcularMemoria`,
      "leitura do painel"
    );

    substituir(
      "      await carregarConfig();\n      const opSnap = mov.opId",
      "      await carregarConfig();\n      await obterPerfil().catch(() => null);\n      const opSnap = mov.opId",
      "perfil na chegada padrão"
    );

    substituir(
      "      await carregarConfig();\n      const op = await buscarOPPorNumero(numeroOP);",
      "      await carregarConfig();\n      await obterPerfil().catch(() => null);\n      const op = await buscarOPPorNumero(numeroOP);",
      "perfil na chegada manual"
    );

    substituirRegex(
      /  async function registrarEscolhasNaOP\(op, contexto, dados\) \{[\s\S]*?\n  \}\n\n  function statusImutavel/,
      `  async function registrarEscolhasNaOP(op, contexto, dados) {
    if (!op?.id) return;
    const ctx = await firebase();
    const usuario = ctx.auth.currentUser;
    const atualizacoes = {};
    const agora = ctx.fs.serverTimestamp();
    const admin = ehAdmin(perfilAtual);

    function incluir(nome, original, novo) {
      const edicaoAdmin = original?.conhecido === true && admin;
      if (original?.conhecido === true && !edicaoAdmin) return;
      if (novo.indefinido === true && !edicaoAdmin) return;

      const indefinido = novo.indefinido === true;
      atualizacoes[\`componentesConsolidados.${'${nome}'}\`] = {
        informado: true,
        pronto: indefinido ? false : novo.pronto,
        status: indefinido ? "nao_informado" : (novo.pronto ? "completo" : "nao_pronto"),
        quantidadePronta: indefinido ? 0 : (novo.pronto ? Math.max(0, numero(contexto.totalOP)) : 0),
        descontarNoSutiaCompleto: indefinido ? false : novo.descontar === true,
        feitoPelaFaccao: indefinido ? false : novo.feitoPelaFaccao === true,
        feitoPelaConfeccao: indefinido ? false : novo.feitoPelaConfeccao === true,
        origemExecucao: indefinido ? "nao_informado" : (novo.origemExecucao || ""),
        quantidadeTotal: Math.max(0, numero(contexto.totalOP)),
        origem: edicaoAdmin ? "chegada_sutia_completo_edicao_admin" : "chegada_sutia_completo",
        origemLabel: edicaoAdmin ? "Corrigido pelo administrador na chegada do Sutiã Completo" : "Informado na chegada do Sutiã Completo",
        responsavel: indefinido ? "" : (novo.responsavel || ""),
        atualizadoPor: usuario?.uid || "",
        atualizadoEm: agora,
        versao: VERSION
      };
    }

    incluir("lateral", contexto.lateral, dados.lateral);
    incluir("bojo", contexto.bojo, dados.bojo);

    if (!Object.keys(atualizacoes).length) return;
    atualizacoes.componentesConsolidadosAtualizadoPor = usuario?.uid || "";
    atualizacoes.componentesConsolidadosAtualizadoEm = agora;
    await ctx.fs.updateDoc(ctx.fs.doc(ctx.db, "ordensProducao", op.id), atualizacoes);
  }

  function statusImutavel`,
      "persistência da edição administrativa"
    );

    substituirRegex(
      /      const dadosFinais = \{[\s\S]*?\n      \};\n\n      await salvarConsolidado\(op, contexto\)/,
      `      const dadosFinais = {
        lateral: dados.lateral,
        bojo: dados.bojo,
        fechoPronto: dados.fechoPronto,
        pontoLuzPronto: dados.pontoLuzPronto
      };

      await salvarConsolidado(op, contexto)`,
      "prioridade das escolhas da chegada"
    );

    return fonte;
  }

  fetch(`./${BASE_FILE}?v=${encodeURIComponent(LOADER_VERSION)}&t=${Date.now()}`, { cache: "no-store" })
    .then(resposta => {
      if (!resposta.ok) throw new Error(`${BASE_FILE}: ${resposta.status}`);
      return resposta.text();
    })
    .then(fonteOriginal => {
      try {
        const fonteCorrigida = aplicarEdicaoAdmin(fonteOriginal);
        executarFonte(fonteCorrigida, LOADER_VERSION);
      } catch (error) {
        console.error("A edição administrativa de Lateral/Bojo não foi aplicada; carregando a base estável.", error);
        executarFonte(fonteOriginal, "base-estavel-174");
      }
    })
    .catch(error => {
      console.error("Não foi possível carregar o cálculo do Sutiã Completo.", error);
    });
})();
