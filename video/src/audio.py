"""Procedural cinematic score + sound design + narration mix. 96 BPM: every scene cut lands on a bar line."""
import json, numpy as np, soundfile as sf
from scipy import signal
SR = 48000; DUR = 165.0; N = int(SR*DUR)
BPM = 96; BEAT = 60/BPM; BAR = 4*BEAT
rng = np.random.default_rng(7)
t_all = np.arange(N)/SR
CUTS = [15, 40, 65, 90, 115, 145]
LOGO_HIT = 9.85; FINAL_HIT = 155.85

def midi(m): return 440*2**((m-69)/12)
def lp(x, fc, order=2): return signal.sosfilt(signal.butter(order, fc, 'low', fs=SR, output='sos'), x)
def hp(x, fc, order=2): return signal.sosfilt(signal.butter(order, fc, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi): return signal.sosfilt(signal.butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)
def saw(f, n, ph=0.0): return 2*((f*np.arange(n)/SR + ph) % 1) - 1
def env_interp(points):  # piecewise-linear automation [(t, v), ...]
    ts, vs = zip(*points); return np.interp(t_all, ts, vs)
def place(buf, x, t0, gain=1.0):
    i = int(t0*SR); j = min(N, i+len(x))
    if i < N: buf[i:j] += gain*x[:j-i]

L = np.zeros(N); R = np.zeros(N)
def add_st(x, t0, g=1.0, pan=0.0):
    place(L, x, t0, g*np.sqrt(0.5*(1-pan))*1.414); place(R, x, t0, g*np.sqrt(0.5*(1+pan))*1.414)

# ---------- intensity automation (0..1) ----------
inten = env_interp([(0,0),(14.5,0.15),(15,0.35),(39.5,0.5),(40,0.6),(64.5,0.65),(65,0.5),(89.5,0.6),(90,0.7),
                    (114.5,0.75),(115,0.6),(144,0.95),(145,0.25),(155.8,1.0),(158,0.55),(165,0)])

# ---------- sub drone ----------
drone = np.sin(2*np.pi*midi(26)*t_all) + 0.5*np.sin(2*np.pi*midi(33)*t_all + 0.3)
drone *= env_interp([(0,0),(0.8,0.9),(14,1),(15,0.7),(144,0.8),(145,1),(156,1),(163,0.3),(165,0)])
drone *= 0.18
L += drone; R += drone

# ---------- pads: Dm - Bb - F - C, two bars each ----------
CHORDS = [[50,53,57,62],[46,50,53,58],[45,48,53,57],[48,52,55,60]]
pad = np.zeros((2, N)); seg = 2*BAR; nseg = int(np.ceil(DUR/seg))+1
for k in range(nseg):
    t0 = k*seg; n = int((seg+1.2)*SR); ch = CHORDS[k % 4]
    a = np.minimum(1, np.arange(n)/(0.9*SR)); r = np.clip((seg+1.2 - np.arange(n)/SR)/1.2, 0, 1); e = a*r
    for side in range(2):
        v = np.zeros(n)
        for m in ch:
            for d in (-0.08, 0.0, 0.08):
                v += saw(midi(m)*2**((d + (0.03 if side else -0.03))/12), n, rng.random())
        i = int(t0*SR); j = min(N, i+n)
        if i < N: pad[side, i:j] += (v*e)[:j-i]
pad /= 12
bright = env_interp([(0,0),(15,0.2),(40,0.5),(65,0.35),(90,0.6),(115,0.5),(144,1),(145,0.1),(156,1),(165,0.6)])
for s, out in ((0, L), (1, R)):
    dark = lp(pad[s], 500); br = lp(pad[s], 2600)
    out += 0.22*(dark*(1-bright) + br*bright) * env_interp([(0,0),(1.5,0.5),(9.8,0.8),(15,1),(144.5,1),(145,0.6),(163,0.8),(165,0)])

# ---------- arpeggio plucks (8ths) ----------
arp = np.zeros((2, N))
step = BEAT/2; nsteps = int(DUR/step)
pattern = [0, 2, 1, 3, 2, 1, 3, 2]
for s in range(nsteps):
    t0 = s*step
    if t0 < 15 or (145 <= t0 < 151) or t0 > 157: continue
    ch = CHORDS[int(t0//seg) % 4]; m = ch[pattern[s % 8]] + 12
    n = int(0.5*SR); tt = np.arange(n)/SR
    x = lp(saw(midi(m), n) + 0.5*saw(midi(m)*1.004, n), 1800 + 2500*inten[int(t0*SR)]) * np.exp(-tt*9)
    pan = 0.45 if s % 2 else -0.45
    place(arp[0], x, t0, np.sqrt(0.5*(1-pan))); place(arp[1], x, t0, np.sqrt(0.5*(1+pan)))
arpg = 0.09*np.clip((inten-0.3)*2, 0, 1)
L += arp[0]*arpg; R += arp[1]*arpg

# ---------- drums (from scene 3, lighter in scene 4) ----------
def kick():
    n = int(0.5*SR); tt = np.arange(n)/SR; f = 45 + 90*np.exp(-tt*28)
    return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*7)
def hat():
    n = int(0.08*SR); return hp(rng.standard_normal(n), 7000)*np.exp(-np.arange(n)/SR*60)
K = kick()
for b in range(int(DUR/BEAT)):
    t0 = b*BEAT
    in_drums = (40 <= t0 < 64.9) or (90 <= t0 < 114.9) or (115 <= t0 < 144.9)
    if in_drums:
        add_st(K, t0, 0.35 if (90 <= t0 < 145) else 0.28)
        add_st(hat(), t0 + BEAT/2, 0.05, 0.3)
    if 65 <= t0 < 89.9 and b % 2 == 0: add_st(K, t0, 0.16)

# ---------- impacts, risers, whooshes ----------
def boom(length=4.0, gain=1.0):
    n = int(length*SR); tt = np.arange(n)/SR
    f = 30 + 70*np.exp(-tt*6)
    x = np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*1.2)
    x += 0.5*lp(rng.standard_normal(n), 400)*np.exp(-tt*4)
    return x*gain
def shimmer(length=5.0):
    n = int(length*SR); tt = np.arange(n)/SR; x = np.zeros(n)
    for m in (74, 81, 86, 89, 93):
        x += np.sin(2*np.pi*midi(m)*tt + rng.random()*6)*np.exp(-tt*0.9)
    return x/5*np.minimum(1, tt/0.02)
def riser(length=2.5):
    n = int(length*SR); tt = np.arange(n)/SR
    nz = rng.standard_normal(n); out = np.zeros(n); blk = 2400
    for i in range(0, n, blk):
        fc = 300 + 7000*(i/n)**2
        out[i:i+blk] = bp(nz[max(0,i-4800):i+blk], fc*0.7, min(fc*1.4, 20000))[-len(out[i:i+blk]):]
    return out*(tt/length)**2
def whoosh(length=1.2):
    n = int(length*SR); tt = np.arange(n)/SR
    return bp(rng.standard_normal(n), 400, 3000)*np.sin(np.pi*tt/length)**2

add_st(boom(5, 0.55), 0.6)
add_st(riser(3.0), LOGO_HIT-3.0, 0.22)
add_st(boom(6, 0.8), LOGO_HIT); add_st(shimmer(6), LOGO_HIT, 0.10, -0.2); add_st(shimmer(6), LOGO_HIT+0.03, 0.10, 0.2)
add_st(whoosh(1.6), 2.6, 0.12, -0.5)
for c in CUTS:
    add_st(riser(2.4), c-2.4, 0.16)
    add_st(boom(3, 0.45), c)
    add_st(whoosh(1.0), c-0.5, 0.10, 0.6)
for t0 in (148.6, 149.65, 150.75):  # three words of the tagline
    add_st(boom(2.5, 0.35), t0); add_st(shimmer(2.5), t0, 0.05)
add_st(riser(4.0), FINAL_HIT-4.0, 0.25)
add_st(boom(8, 1.0), FINAL_HIT); add_st(shimmer(8), FINAL_HIT, 0.14, -0.3); add_st(shimmer(8), FINAL_HIT+0.04, 0.14, 0.3)

# UI ticks during code typing / app build
def tick():
    n = int(0.03*SR); return hp(rng.standard_normal(n), 3000)*np.exp(-np.arange(n)/SR*250)
for t0 in np.arange(41.0, 63.0, 0.09):
    if rng.random() < 0.6: add_st(tick(), t0 + rng.random()*0.03, 0.025, rng.uniform(-.4,.4))
for t0 in (120.0, 123.6, 127.2, 131.0, 135.4, 140.2):
    add_st(shimmer(1.5), t0, 0.06)
for t0 in np.arange(127.4, 130.5, 0.08):
    if rng.random() < 0.6: add_st(tick(), t0, 0.022, rng.uniform(-.4,.4))
# test checkmarks
for i in range(6): add_st(shimmer(0.6)*np.hanning(int(0.6*SR)), 135.6 + i*0.35, 0.05)

# ---------- reverb on music bus ----------
irn = int(3.2*SR); irt = np.arange(irn)/SR
irL = rng.standard_normal(irn)*np.exp(-irt*2.2); irR = rng.standard_normal(irn)*np.exp(-irt*2.2)
irL = lp(irL, 5000); irR = lp(irR, 5000); irL /= np.sqrt((irL**2).sum()); irR /= np.sqrt((irR**2).sum())
wetL = signal.fftconvolve(L, irL)[:N]; wetR = signal.fftconvolve(R, irR)[:N]
L = L + 0.35*wetL; R = R + 0.35*wetR

# ---------- narration bus ----------
meta = json.load(open('assets/vo/meta.json'))
vo = np.zeros(N)
for m in meta:
    x, sr = sf.read(m['path'])
    if x.ndim > 1: x = x.mean(1)
    x = signal.resample_poly(x, SR, sr)
    place(vo, x, m['start'])
vo = hp(vo, 80)
vo = vo + 0.6*signal.sosfilt(signal.butter(2, [2500, 6000], 'band', fs=SR, output='sos'), vo)*0.25  # presence
vo /= np.max(np.abs(vo)) + 1e-9
irv = rng.standard_normal(int(1.0*SR))*np.exp(-np.arange(int(1.0*SR))/SR*7); irv /= np.sqrt((irv**2).sum())
vo_wet = signal.fftconvolve(vo, irv)[:N]
vo_mix = vo + 0.08*vo_wet

# sidechain duck: music -7 dB under voice
envv = lp(np.abs(vo), 6, order=1); envv /= envv.max()
duck = 1 - 0.55*np.clip(envv*4, 0, 1)
duck = lp(duck, 3, order=1)
L *= duck; R *= duck

mus_peak = max(np.abs(L).max(), np.abs(R).max())
L = L/mus_peak*0.55; R = R/mus_peak*0.55
outL = L + 0.62*vo_mix; outR = R + 0.62*vo_mix
fade = env_interp([(0,1),(163,1),(165,0)])
st = np.stack([outL*fade, outR*fade], 1)
st /= np.max(np.abs(st))/0.95
sf.write('assets/mix.wav', st.astype(np.float32), SR, subtype='FLOAT')
print('ok', st.shape)
