import numpy as np,wave,json,re,subprocess
sr=24000;w=wave.open('in/orig.wav');x=np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(np.float32)/32768
# trechos de fala (detectados com silencedetect -35dB, 0.3s)
sil=[(3.824,4.618),(6.909,7.661),(8.671,9.002),(10.462,11.212),(13.453,14.205),(15.220,15.588),(17.255,18.006),(19.593,19.918),(21.556,22.331),(24.293,25.059),(27.840,28.589),(31.103,31.859),(34.248,35.034),(36.645,37.403),(40.841,41.596),(42.298,42.718),(44.476,45.36)]
speech=[];a=0.0
for s,e in sil: speech.append((a,s));a=e
texts=[("hook","Cinco lugares onde você não sobreviveria nem um minuto."),("hook","E o número um nem fica na Terra."),
("dallol","Número cinco:"),("dallol","Dallol, na Etiópia."),("dallol","Calor extremo e lagos de ácido."),
("mariana","Número quatro:"),("mariana","a Fossa das Marianas."),("mariana","Onze quilômetros de fundo,"),("mariana","e pressão mil vezes maior."),
("antartida","Número três: a Antártida."),("antartida","Já fez oitenta e nove graus negativos."),
("everest","Número dois: o topo do Everest."),("everest","Só um terço do oxigênio no ar."),
("venus","E o número um: Vênus."),("venus","Quatrocentos e sessenta graus, e chuva de ácido."),
("end","Comenta aí:"),("end","qual desses você encararia?")]
assert len(speech)==len(texts),(len(speech),len(texts))
# monta áudio com pausas curtas
pad=0.06;out=[];t=0.15;pieces=[];prev=None
out.append(np.zeros(int(t*sr)))
for i,((s,e),(k,txt)) in enumerate(zip(speech,texts)):
    seg=x[int(max(0,s-pad)*sr):int(min(len(x)/sr,e+pad)*sr)]
    if i>0:
        g=0.30 if texts[i-1][1][-1] in '.?' else 0.16
        if k!=texts[i-1][0]: g=0.34
        out.append(np.zeros(int(g*sr)));t+=g
    pieces.append((k,txt,t,len(seg)/sr));out.append(seg);t+=len(seg)/sr
y=np.concatenate(out+[np.zeros(int(.2*sr))])
wo=wave.open('in/tight.wav','w');wo.setnchannels(1);wo.setsampwidth(2);wo.setframerate(sr);wo.writeframes((np.clip(y,-1,1)*32767).astype(np.int16).tobytes());wo.close()
SPEED=1.08
subprocess.run(['ffmpeg','-y','-loglevel','error','-i','in/tight.wav','-af',f'atempo={SPEED}','-ar','44100','in/vo.wav'],check=True)
w2=wave.open('in/vo.wav');vo=np.frombuffer(w2.readframes(w2.getnframes()),np.int16).astype(np.float32)/32768;np.save('vo.npy',vo)
VOT=len(vo)/44100
# cenas
order=[];[order.append(p[0]) for p in pieces if p[0] not in order]
segs=[]
for k in order:
    ps=[p for p in pieces if p[0]==k];st=ps[0][2]/SPEED-0.08
    words=[]
    for _,txt,pt,pd in ps:
        ws=txt.split();wts=[len(re.sub(r'\W','',w_))+1.5 for w_ in ws];tot=sum(wts);acc=0
        for w_,wt in zip(ws,wts):words.append([w_,round((pt+acc/tot*pd*.92)/SPEED-st,3)]);acc+=wt
    segs.append({'k':k,'t0':round(st,3),'words':words})
segs[0]['t0']=0
T=round(VOT+0.7,3)
for i,s in enumerate(segs):s['d']=round((segs[i+1]['t0'] if i+1<len(segs) else T)-s['t0'],3)
open('timing.js','w').write('window.SEG='+json.dumps(segs,ensure_ascii=False)+';window.TOTAL='+str(T)+';')
print('TOTAL',T);[print(s['k'],s['t0'],s['d'],len(s['words'])) for s in segs]
