import numpy as np,wave,json
d=json.load(open('cuts.json'));T=d['total'];ev=d['events']
sr=44100;n=int(sr*T);t=np.arange(n)/sr;rng=np.random.default_rng(3);out=np.zeros(n)
L=lambda d:np.arange(int(d*sr))/sr
def put(sig,at,g=1):
    i=int(max(0,at)*sr);j=min(n,i+len(sig))
    if j>i: out[i:j]+=sig[:j-i]*g
# batida animada 140bpm
beat=60/140
k=L(.3);kick=np.sin(2*np.pi*(50+140*np.exp(-k*30))*k)*np.exp(-k*10)
h=L(.05);hat=rng.normal(size=len(h))*np.exp(-h*90)
cl=L(.15);clap=rng.normal(size=len(cl))*np.exp(-cl*25)
bass=[55,55,73.4,65.4]
mel=[440,523.3,659.3,587.3,523.3,440,392,440]
for b in range(int(T/beat)):
    at=b*beat
    if at>T-1.2: break
    put(kick,at,.8);put(hat,at+beat/2,.15);put(hat,at+beat*.75,.08)
    if b%2==1: put(clap,at,.3)
    f=bass[(b//8)%4];bl=L(beat*.8);put(np.sin(2*np.pi*f*bl)*np.exp(-bl*4)*.5+np.sign(np.sin(2*np.pi*f*bl))*.08*np.exp(-bl*6),at,.5)
    ml=L(beat*.5);fm=mel[b%8];put((np.sign(np.sin(2*np.pi*fm*ml))*.5+np.sin(2*np.pi*fm*2*ml)*.3)*np.exp(-ml*9)*.06,at+beat/2)
# SFX
def boom():
    x=L(1.6);return np.sin(2*np.pi*(45+40*np.exp(-x*4))*x)*np.exp(-x*2.4)*1.0+np.sin(2*np.pi*90*x)*np.exp(-x*5)*.4
def pop():
    x=L(.09);return np.sin(2*np.pi*(900-5000*x)*x)*np.exp(-x*45)
def whoosh():
    x=L(.4);nz=np.convolve(rng.normal(size=len(x)),np.ones(12)/12,'same');return nz*np.sin(np.pi*x/.4)**2*1.6
def scratch():
    x=L(.5);return np.sin(2*np.pi*(300+250*np.sin(2*np.pi*7*x))*x)*np.exp(-x*3)*.5+rng.normal(size=len(x))*np.exp(-x*6)*.25
def ding():
    x=L(1.2);return (np.sin(2*np.pi*1318*x)+.5*np.sin(2*np.pi*2637*x))*np.exp(-x*3)*.35
F={'boom':(boom,.9),'pop':(pop,.35),'whoosh':(whoosh,.35),'scratch':(scratch,.8),'ding':(ding,1)}
for e in ev:
    fn,g=F[e['type']];put(fn(),e['t']-(0.2 if e['type']=='whoosh' else 0),g)
# tique-taque
for i in range(int(T/0.5)):
    x=L(.03);put(rng.normal(size=len(x))*np.exp(-x*200),i*.5,.06)
# abaixa a batida durante o congelamento (scratch)
for e in ev:
    if e['type']=='scratch':
        i=int(e['t']*sr);j=min(n,int((e['t']+.9)*sr));out[i:j]*=.35
out*=np.minimum((T-t)/1.0,1)
out=np.tanh(out*1.3);out/=np.abs(out).max();out*=.92
st=np.stack([out,out],1);wv=wave.open('audio.wav','w');wv.setnchannels(2);wv.setsampwidth(2);wv.setframerate(sr);wv.writeframes((st*32767).astype(np.int16).tobytes());wv.close()
