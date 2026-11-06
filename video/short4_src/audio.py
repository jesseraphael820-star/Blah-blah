import numpy as np,wave,json
d=json.load(open('cuts.json'));cuts=d['cuts'];T=d['total']
sr=44100;n=int(sr*T);t=np.arange(n)/sr;out=np.zeros(n);rng=np.random.default_rng(5)
beat=60/124
def put(sig,at,g=1):
    i=int(at*sr);j=min(n,i+len(sig))
    if j>i: out[i:j]+=sig[:j-i]*g
L=lambda d:np.arange(int(d*sr))/sr
k=L(.35);kick=np.sin(2*np.pi*(45+120*np.exp(-k*25))*k)*np.exp(-k*9)
h=L(.06);hat=rng.normal(size=len(h))*np.exp(-h*70)
s=L(.2);snare=(rng.normal(size=len(s))*.7+np.sin(2*np.pi*190*s))*np.exp(-s*18)
notes=[[220,261.6,329.6],[174.6,220,261.6],[196,246.9,293.7],[164.8,207.7,246.9]]
for b in range(int(T/beat)):
    at=b*beat
    bar=(b//4)%4
    pl=L(beat);put(sum(np.sin(2*np.pi*f*pl) for f in notes[bar])*np.exp(-pl*2.5)*.07,at)  # arpejo/pad sempre
    if at<1.0 or at>T-1: continue
    put(kick,at,.9);put(hat,at+beat/2,.18)
    if b%2==1: put(snare,at,.35)
    bl=L(beat*.9);put(np.sign(np.sin(2*np.pi*notes[bar][0]/4*bl))*np.exp(-bl*3)*.5,at,.25)
r=L(1.0);put(np.sin(2*np.pi*(200+900*r)*r)*r*.3,0)
bl=L(1.8);boom=np.sin(2*np.pi*(38+60*np.exp(-bl*6))*bl)*np.exp(-bl*2.2)+rng.normal(size=len(bl))*np.exp(-bl*7)*.4
put(boom,1.0,1.4)
for c in cuts[1:]:
    w=L(.45);nz=np.convolve(rng.normal(size=len(w)),np.ones(8)/8,'same');put(nz*np.sin(np.pi*w/.45)*.5,c-.2);put(boom[:int(.6*sr)],c,.6)
out*=np.minimum((T-t)/1.0,1);out=np.tanh(out*1.3);out/=np.abs(out).max();out*=.9
st=np.stack([out,out],1);wv=wave.open('audio.wav','w');wv.setnchannels(2);wv.setsampwidth(2);wv.setframerate(sr);wv.writeframes((st*32767).astype(np.int16).tobytes());wv.close()
