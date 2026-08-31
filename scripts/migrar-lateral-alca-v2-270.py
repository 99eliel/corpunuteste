#!/usr/bin/env python3
from pathlib import Path
import base64, gzip, json, re
ROOT = Path(__file__).resolve().parents[1]
RELEASE = "2026-08-31-lateral-alca-v2-270"
OLD_RELEASE = "2026-08-26-pagamentos-detalhes-sutia-completo-257"
V2_B64 = "".join((ROOT / f"scripts/.la2-v2-270.part{i}").read_text().strip() for i in range(1, 5))
TEST_B64 = (ROOT / "scripts/.la2-v2-270.tests").read_text().strip()
def fail(msg): raise SystemExit(f"ERRO: {msg}")
def payload(path, data): (ROOT/path).write_bytes(gzip.decompress(base64.b64decode(data)))
def once(text, old, new, label):
    n=text.count(old)
    if n != 1: fail(f"{label}: esperado 1 bloco, encontrado {n}")
    return text.replace(old,new,1)
payload("corponu-faccoes-corte-definitivo.js", V2_B64)
payload("tests/e2e/faccoes-consolidado.spec.js", TEST_B64)
p=ROOT/"corponu-faccoes-tres-abas-saida.js"; t=p.read_text(encoding="utf-8")
if "2026-08-21-faccoes-processos-na-origem-230" not in t: fail("versão-base inesperada nas abas")
t=t.replace('const V = "2026-08-21-faccoes-processos-na-origem-230";', f'const V = "{RELEASE}-abas";',1)
t=once(t,'  const PROCESSOS_SAIDA = Object.freeze({\n    sutia: ["ENCAPAR BOJO", "SUTIÃ COMPLETO", "INTERLOCK"],\n    calcinha: ["CALCINHA COMPLETA", "CALCINHA MONTAGEM"],\n    corte: ["LATERAL", "ALÇA"]\n  });','  const PROCESSOS_SAIDA = Object.freeze({\n    sutia: ["ENCAPAR BOJO", "SUTIÃ COMPLETO", "INTERLOCK"],\n    calcinha: ["CALCINHA COMPLETA", "CALCINHA MONTAGEM"]\n  });',"catálogo de saída")
t=t.replace('const processosPermitidos = tipoAba => PROCESSOS_SAIDA[tipoAba] || PROCESSOS_SAIDA.sutia;', 'const processosPermitidos = tipoAba => PROCESSOS_SAIDA[tipoAba] || [];',1)
t=once(t,'  function mostrarGeral() {\n    painelGeral()?.classList.remove("hidden");\n    document.getElementById("painelFaccoesCorte")?.classList.add("hidden");\n    document.querySelector(\'#faccoesAbasCorte [data-area-faccoes="geral"]\')?.click();\n  }\n\n  function mostrarCorte() {\n    painelGeral()?.classList.add("hidden");\n    document.getElementById("painelFaccoesCorte")?.classList.remove("hidden");\n    document.querySelector(\'#faccoesAbasCorte [data-area-faccoes="corte"]\')?.click();\n    setTimeout(() => document.getElementById("btnCorteAtualizar")?.click(), 0);\n  }','  function mostrarGeral() {\n    painelGeral()?.classList.remove("hidden");\n    window.CorpoNuFaccoesLateralAlca?.ocultar?.();\n  }\n\n  function mostrarCorte() {\n    painelGeral()?.classList.add("hidden");\n    window.CorpoNuFaccoesLateralAlca?.mostrar?.();\n  }',"integração da aba")
t=once(t,'  function marcar(a) {\n    const x = abas();\n    const c = document.getElementById("abaFaccaoCorte");\n    if (!x) return;\n    x.s.classList.toggle("active", a === "sutia");','  function marcar(a) {\n    const x = abas();\n    const c = document.getElementById("abaFaccaoCorte");\n    if (!x) return;\n    x.p.dataset.faccaoAbaAtiva = a;\n    x.s.classList.toggle("active", a === "sutia");',"marcação da aba")
t,n=re.subn(r'\n    const velha = document\.getElementById\("faccoesAbasCorte"\);\n    if \(velha\) \{.*?\n    \}\n',"\n",t,count=1,flags=re.S)
if n!=1: fail("bloco faccoesAbasCorte não encontrado")
t,n=re.subn(r'\n    const leg = document\.getElementById\("btnCorteRegistrarSaida"\);\n    if \(leg\) \{.*?\n    \}\n\n    const tc = document\.querySelector\("#painelFaccoesCorte \.corte-toolbar"\);\n    if \(tc && !document\.getElementById\("btnSaidaCorteNovo"\)\) \{.*?\n    \}\n',"\n",t,count=1,flags=re.S)
if n!=1: fail("injeção antiga de botões Corte não encontrada")
t=once(t,'  function abrir(a) {\n    aba = a;','  function abrir(a) {\n    if (a === "corte") return;\n    aba = a;',"proteção do modal genérico")
t=once(t,'  async function salvar(ev) {\n    ev.preventDefault();\n    if (!op)','  async function salvar(ev) {\n    ev.preventDefault();\n    if (aba === "corte") return toast("Use o fluxo próprio de Lateral e Alça.");\n    if (!op)',"proteção do salvamento genérico")
t,n=re.subn(r'\n    if \(t\.closest\("#btnSaidaCorteNovo"\)\) \{.*?\n    \}',"",t,count=1,flags=re.S)
if n not in (0,1): fail("bloco btnSaidaCorteNovo ambíguo")
if any(x in t for x in ['corte: ["LATERAL", "ALÇA"]',"btnSaidaCorteNovo","faccoesAbasCorte"]): fail("sobrou controle legado de Corte nas abas")
p.write_text(t,encoding="utf-8")
p=ROOT/"corponu-atualizador.js"; t=p.read_text(encoding="utf-8")
if OLD_RELEASE not in t: fail("release-base inesperada no atualizador")
t=t.replace(OLD_RELEASE,RELEASE).replace("Não foi possível carregar a área definitiva de Corte / Lateral e Alça.","Não foi possível carregar a área Lateral e Alça V2.")
p.write_text(t,encoding="utf-8")
for nome in ["index.html","update.js"]:
    p=ROOT/nome; t=p.read_text(encoding="utf-8").replace(OLD_RELEASE,RELEASE); p.write_text(t,encoding="utf-8")
notes='HOMOLOGAÇÃO. Lateral e Alça foi reconstruída como fluxo próprio e leve, substituindo a implementação antiga sem sobrepor hotfixes. A aba mantém leitura dos registros históricos de area=corte/movimentacaoCorte e novos registros usam fluxoFaccoes=lateral_alca. LATERAL continua usando valor por referência e marca lateral pronta; ALÇA mantém o valor global atual com regra de 2 alças por peça; dentro do grupo Alça foi incluído CORTAGEM E MONTAGEM com valor fixo de R$ 0,0540 por peça. Usuário comum apenas informa chegada e o administrador confirma a baixa, que gera pagamento e marca lateral pronta somente no processo LATERAL. Foram eliminados carregamentos completos de pagamentos/preços, renders repetidos e recálculos por temporizadores. Nenhuma regra do Firebase foi alterada e nenhum dado histórico foi migrado ou apagado.'
meta={"version":RELEASE,"updatedAt":"2026-08-31T13:30:00-03:00","notes":notes}
for nome in ["corponu-release.json","version.json"]: (ROOT/nome).write_text(json.dumps(meta,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
v=(ROOT/"corponu-faccoes-corte-definitivo.js").read_text(encoding="utf-8")
checks=[('const VERSION = "2026-08-31-lateral-alca-v2-270"',"versão V2"),('nome: "CORTAGEM E MONTAGEM"',"novo processo"),('const VALOR_FIXO_CORTAGEM_MONTAGEM = 0.0540',"valor fixo"),('faccaoProcesso: "ALÇA"',"grupo Alça"),('chegadaInformadaStatus: "aguardando_confirmacao_admin"',"aviso chegada"),('chegadaInformadaStatus: "confirmada_admin"',"baixa admin"),('c.fs.writeBatch(c.db)',"baixa atômica"),('window.CorpoNuFaccoesLateralAlca = api',"API V2")]
for trecho,label in checks:
    if trecho not in v: fail(f"pós-condição ausente: {label}")
for proibido in ["new MutationObserver","setInterval","[900, 2200, 4800]","[1500, 3200, 5600]",'CONFIG_ID = "processos-corte"']:
    if proibido in v: fail(f"padrão legado ainda presente: {proibido}")
print("Migração estrutural Lateral e Alça V2 preparada com sucesso.")
