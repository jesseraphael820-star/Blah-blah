import numpy as np,wave,json
d=json.load(open('cuts.json'));cuts=d['cuts'];T=d['total']
sr=44100;n=int(sr*T);t=np.arange(n)/sr;rng=np.random.default_rng(9)
L=lambda d:np.arange(int(d*sr))/sr
out=np.zeros(n)
def put(sig,at,g=1):
    i=int(at*sr);j=min(n,i+len(sig))
    if j>i: out[i:j]+=sig[:j-i]*g
# drone grave com LFO
lfo=.5+.5*np.sin(2*np.pi*.08*t)
drone=(np.sin(2*np.pi*36.7*t)+.7*np.sin(2*np.pi*55.1*t+np.sin(2*np.pi*.3*t))+.35*np.sin(2*np.pi*73.4*t))*(.25+.2*lfo)
# vento: ruído filtrado
nz=rng.normal(size=n);k=np.ones(400)/400;wind=np.convolve(nz,k,'same')*6*(.3+.7*lfo)
# pad agudo misterioso
pad=(np.sin(2*np.pi*220*t)+np.sin(2*np.pi*261.6*t*1.002)+np.sin(2*np.pi*329.6*t*.998))*.03*(.5+.5*np.sin(2*np.pi*.12*t))
out+=drone*.6+wind*.25+pad
# coração acelerando
bt=.9;tt=.6
while tt<T-1.5:
    h=L(.18);thump=np.sin(2*np.pi*48*h)*np.exp(-h*22)
    put(thump,tt,.9);put(thump,tt+.22,.55)
    bt=max(.45,bt*.985);tt+=bt
# glitch nas transições
for c in cuts[1:]:
    g=L(.25);gl=np.sign(np.sin(2*np.pi*(800+rng.random()*1200)*g))*(rng.random(len(g))>.5)*np.exp(-g*8)*.35
    put(gl,c-.12);put(np.convolve(rng.normal(size=int(.6*sr)),np.ones(30)/30,'same')*np.exp(-L(.6)*5)*2.5,c-.05)
# impacto final "whoomp"
w=L(2.5);put(np.sin(2*np.pi*(30+80*np.exp(-w*3))*w)*np.exp(-w*1.5),cuts[-2],1.2)
out*=np.minimum(t/0.8,1)*np.minimum((T-t)/1.2,1)
out=np.tanh(out*1.4);out/=np.abs(out).max();out*=.92
st=np.stack([out,out],1);wv=wave.open('audio.wav','w');wv.setnchannels(2);wv.setsampwidth(2);wv.setframerate(sr);wv.writeframes((st*32767).astype(np.int16).tobytes());wv.close()
