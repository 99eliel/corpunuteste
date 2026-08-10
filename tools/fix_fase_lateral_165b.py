from pathlib import Path
import json

p=Path('update.js')
s=p.read_text(encoding='utf-8')
old='  iniciarGestaoFasesLateralSutia();\n\n'
new='  setTimeout(iniciarGestaoFasesLateralSutia, 0);\n\n'
if old not in s:
    raise SystemExit('Âncora de inicialização da Fase Lateral não encontrada.')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

rp=Path('corponu-release.json')
data=json.loads(rp.read_text(encoding='utf-8'))
data['version']='2026-08-10-teste-fase-lateral-sugestoes-165b'
data['updatedAt']='2026-08-10T14:22:00-03:00'
data['notes']='AMBIENTE DE TESTE. Gestão da Fase Lateral integrada ao update.js existente, iniciada somente após o carregamento completo do arquivo para evitar conflito com a gestão de Fase Bojo/Calcinha. Painel administrativo com adicionar, remover e recuperar opções antigas. Sistema principal e layout ultrawide não alterados.'
rp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

ip=Path('index.html')
h=ip.read_text(encoding='utf-8')
h=h.replace('update.js?v=2026-08-10-teste-fase-lateral-sugestoes-165','update.js?v=2026-08-10-teste-fase-lateral-sugestoes-165b')
ip.write_text(h,encoding='utf-8')
