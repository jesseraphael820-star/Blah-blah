// Áudio sintetizado via WebAudio (sem arquivos externos).
let ctx = null, master = null, noiseBuf = null;
export let volume = 0.8;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = volume;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp); comp.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function setVolume(v) { volume = v; if (master) master.gain.value = v; }

function out(vol, pan) {
  const g = ctx.createGain(); g.gain.value = vol;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(master); }
  else g.connect(master);
  return g;
}
function noise(dur, freq, vol, pan, type = 'lowpass', q = 0.7) {
  const t = ctx.currentTime, src = ctx.createBufferSource();
  src.buffer = noiseBuf; src.loopStart = Math.random() * 0.5; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = out(1, pan);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); src.start(t, Math.random()); src.stop(t + dur + 0.02);
}
function tone(f0, f1, dur, vol, pan, type = 'sine') {
  const t = ctx.currentTime, o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = out(1, pan);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); o.start(t); o.stop(t + dur + 0.02);
}

// vol: 0..1 (já atenuado por distância). pan: -1..1
export const sfx = {
  shot(snd, vol = 1, pan = 0, sup = false) {
    if (!ctx || vol < 0.01) return;
    const [f, d, th] = snd;
    noise(d, f, vol * (sup ? 0.5 : 0.9), pan);
    noise(d * 0.35, f * 2.5, vol * (sup ? 0.15 : 0.5), pan, 'bandpass');
    tone(th * 2, th * 0.4, d * 0.8, vol * (sup ? 0.3 : 0.8), pan);
  },
  knife(vol = 0.5) { if (ctx) noise(0.12, 3500, vol, 0, 'bandpass', 2); },
  step(vol = 0.25, pan = 0) { if (ctx && vol > 0.01) { noise(0.07, 420, vol, pan); tone(120, 60, 0.05, vol * 0.5, pan); } },
  reload(part = 0) { if (ctx) { noise(0.04, part ? 2600 : 1500, 0.35, 0, 'bandpass', 3); tone(part ? 900 : 500, 300, 0.03, 0.15); } },
  click() { if (ctx) tone(880, 660, 0.05, 0.15, 0, 'triangle'); },
  buy() { if (ctx) { tone(700, 1100, 0.08, 0.18, 0, 'triangle'); noise(0.05, 3000, 0.1, 0, 'highpass'); } },
  deny() { if (ctx) tone(220, 160, 0.14, 0.2, 0, 'square'); },
  hit(head) { if (ctx) tone(head ? 1500 : 900, head ? 900 : 500, 0.07, 0.3, 0, 'triangle'); },
  hurt() { if (ctx) { noise(0.12, 600, 0.5); tone(180, 80, 0.12, 0.4); } },
  explosion(vol = 1, pan = 0) { if (ctx && vol > 0.01) { noise(0.9, 500, vol * 1.2, pan); tone(110, 30, 0.6, vol, pan); noise(0.25, 3000, vol * 0.5, pan, 'bandpass'); } },
  flash(vol = 1) { if (ctx) { noise(0.25, 5000, vol * 0.8, 0, 'highpass'); tone(3200, 3000, 1.6 * vol, vol * 0.25); } },
  smoke(vol = 1, pan = 0) { if (ctx && vol > 0.01) noise(1.2, 1800, vol * 0.4, pan, 'bandpass', 0.4); },
  fire(vol = 1, pan = 0) { if (ctx && vol > 0.01) { noise(0.7, 900, vol * 0.6, pan); noise(0.2, 4000, vol * 0.3, pan, 'highpass'); } },
  bounce(vol = 0.3, pan = 0) { if (ctx && vol > 0.01) tone(1300, 700, 0.05, vol, pan, 'triangle'); },
  beep(vol = 0.5, pan = 0) { if (ctx && vol > 0.01) tone(2400, 2400, 0.08, vol, pan, 'square'); },
  plant() { if (ctx) { tone(1000, 1000, 0.1, 0.3, 0, 'square'); setTimeout(() => ctx && tone(1400, 1400, 0.15, 0.3, 0, 'square'), 130); } },
  round(win) { if (!ctx) return; const n = win ? [523, 659, 784] : [392, 330, 262]; n.forEach((f, i) => setTimeout(() => tone(f, f, 0.22, 0.2, 0, 'triangle'), i * 140)); },
  drop() { if (!ctx) return; [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => tone(f, f, 0.18, 0.2, 0, 'triangle'), i * 90)); },
  tick() { if (ctx) tone(1200, 1000, 0.02, 0.08, 0, 'square'); },
};
