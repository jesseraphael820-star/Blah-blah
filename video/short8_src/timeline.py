import json,wave,numpy as np,re
S=json.load(open('script.json'));sr=16000;t=0.12;segs=[];clips=[]
for i,s in enumerate(S):
    w=wave.open(f"vo/{i}_{s['k']}.wav");x=np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(np.float32)/32768
    env=np.convolve(np.abs(x),np.ones(320)/320,'same');idx=np.where(env>0.02)[0];a,b=idx[0],idx[-1]
    a=max(0,a-400);b=min(len(x),b+800);x=x[a:b];d=len(x)/sr
    # tempo de cada palavra proporcional ao nº de letras (+pausa em pontuação)
    words=s['text'].split();wts=[len(re.sub(r'\W','',w))+1+(3 if re.search(r'[.,:!?]$',w) else 0) for w in words];tot=sum(wts);acc=0;wt=[]
    for w_,k in zip(words,wts):wt.append([w_,round(acc/tot*d,3)]);acc+=k
    gap=0.32 if s['k']!='hook' else 0.25
    segs.append({'k':s['k'],'t0':round(t,3),'vo':round(d,3),'d':round(d+gap,3),'words':wt});clips.append((t,x));t+=d+gap
segs[0]['d']+=segs[0]['t0'];segs[0]['t0']=0
T=round(t+0.6,3);segs[-1]['d']=round(T-segs[-1]['t0'],3)
open('timing.js','w').write('window.SEG='+json.dumps(segs,ensure_ascii=False)+';window.TOTAL='+str(T)+';')
vo=np.zeros(int(T*44100))
for t0,x in clips:
    y=np.interp(np.arange(int(len(x)*44100/sr))/44100*sr,np.arange(len(x)),x);i=int(t0*44100);vo[i:i+len(y)]+=y[:len(vo)-i]
np.save('vo.npy',vo);print('TOTAL',T);[print(s['k'],s['t0'],s['d']) for s in segs]
