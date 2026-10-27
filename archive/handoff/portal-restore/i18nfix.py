import re,subprocess,sys
P='/home/lam/projectX/akari-workspace/.work/portal-restore/akari-panel/portal'
v1=open('/home/lam/projectX/akari-workspace/.work/ref-v1.4.0/spa/src/i18n/dict.ts').read()
r=subprocess.run(['node','scripts/check-i18n.mjs'],cwd=P,capture_output=True,text=True); out=r.stdout+r.stderr
keys=[m.group(1) for m in re.finditer(r'no English for \([^)]*\): (.*)',out)]
dp=P+'/src/shared/i18n/dict.ts'; d=open(dp).read()
add=[];miss=[]
for k in dict.fromkeys(keys):
    m=re.search(r"^  '"+re.escape(k.replace("'","\\'"))+r"': .*$",v1,re.M)
    if m: add.append(m.group(0))
    else: miss.append(k)
if add:
    d=d.replace("\n};\n","\n  /* ── 门户恢复 v1.4.0 ── */\n"+"\n".join(add)+"\n};\n") if "门户恢复 v1.4.0" not in d else d.replace("  /* ── 门户恢复 v1.4.0 ── */\n","  /* ── 门户恢复 v1.4.0 ── */\n"+"\n".join(add)+"\n",1)
    open(dp,'w').write(d)
subprocess.run(['node','scripts/check-i18n.mjs','--fix'],cwd=P,capture_output=True)
print('added',len(add),'missing',miss)
