import numpy as np,wave,json,re
segs=json.loads(re.search(r'window.SEG=(.*?);window.TOTAL',open('timing.js').read()).group(1));T=float(re.search(r'TOTAL=([\d.]+)',open('timing.js').read()).group(1))
sr=44100;n=int(sr*T);t=np.arange(n)/sr;rng=np.random.default_rng(4)
vo=np.load('vo.npy')[:n];vo=np.pad(vo,(0,n-len(vo)))
vo=vo/np.abs(vo).max()*.9;vo=np.tanh(vo*1.6)/np.tanh(1.6)  # compressão leve
L=lambda d:np.arange(int(d*sr))/sr
mus=np.zeros(n);sfx=np.zeros(n)
def put(buf,sig,at,g=1):
    i=int(max(0,at)*sr);j=min(n,i+len(sig))
    if j>i: buf[i:j]+=sig[:j-i]*g
beat=60/128;k=L(.3);kick=np.sin(2*np.pi*(50+130*np.exp(-k*30))*k)*np.exp(-k*10);h=L(.05);hat=rng.normal(size=len(h))*np.exp(-h*90)
chords=[[220,261.6,329.6],[174.6,220,261.6],[196,246.9,293.7],[196,246.9,329.6]]
for b in range(int(T/beat)):
    at=b*beat;put(mus,kick,at,.7);put(mus,hat,at+beat/2,.15)
    c=chords[(b//4)%4];pl=L(beat);put(mus,sum(np.sin(2*np.pi*f*pl) for f in c)*np.exp(-pl*3)*.12,at)
    bl=L(beat*.8);put(mus,np.sin(2*np.pi*c[0]/4*bl)*np.exp(-bl*4)*.5,at)
x=L(1.4);boom=np.sin(2*np.pi*(45+45*np.exp(-x*4))*x)*np.exp(-x*2.6)
w=L(.4);wh=np.convolve(rng.normal(size=len(w)),np.ones(12)/12,'same')*np.sin(np.pi*w/.4)**2*1.6
dg=L(1);ding=(np.sin(2*np.pi*1318*dg)+.5*np.sin(2*np.pi*2637*dg))*np.exp(-dg*3.5)
for s in segs[1:]:
    put(sfx,wh,s['t0']-.22,.5);put(sfx,boom,s['t0'],.8 if s['k']!='end' else .4)
    if s['k'] not in('end',):put(sfx,ding,s['t0']+1.0,.25)
put(sfx,boom,0,.9)
# ducking: música baixa onde há voz
env=np.convolve(np.abs(vo),np.ones(4410)/4410,'same');duck=1-.65*np.clip(env/ .08,0,1)
mix=vo*1.0+mus*.32*duck+sfx*.55
mix*=np.minimum((T-t)/.8,1);mix=np.tanh(mix*1.1);mix/=np.abs(mix).max();mix*=.95
st=np.stack([mix,mix],1);wv=wave.open('audio.wav','w');wv.setnchannels(2);wv.setsampwidth(2);wv.setframerate(sr);wv.writeframes((st*32767).astype(np.int16).tobytes());wv.close()
