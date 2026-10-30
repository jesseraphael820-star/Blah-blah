import { clamp } from './util.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export const STATIONS = [
  null,
  { name: 'Rádio Sereno 93.9', genre: 'G-Funk', bpm: 92 },
  { name: 'Batida FM 101', genre: 'Funk Carioca', bpm: 130 },
  { name: 'Brisa FM 88.5', genre: 'Bossa Lo-fi', bpm: 76 },
];

export class Audio {
  constructor(settings) {
    this.s = settings;
    this.ctx = null;
    this.station = 0;
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = C.createGain();
    this.master.connect(C.destination);
    this.sfx = C.createGain(); this.sfx.connect(this.master);
    this.music = C.createGain(); this.music.connect(this.master);
    this.applyVolume();
    const len = C.sampleRate * 2;
    const buf = C.createBuffer(1, len, C.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const noiseChain = (type, f, q) => {
      const src = C.createBufferSource(); src.buffer = buf; src.loop = true;
      const fl = C.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = C.createGain(); g.gain.value = 0;
      src.connect(fl); fl.connect(g); g.connect(this.sfx); src.start();
      return { g, fl };
    };
    this.wind = noiseChain('lowpass', 500, 0.7);
    this.rain = noiseChain('bandpass', 2500, 0.5);
    this.tire = noiseChain('bandpass', 1700, 6);
    this.road = noiseChain('lowpass', 180, 0.5);
    this.hiss = noiseChain('highpass', 3200, 0.7); // pneu no asfalto molhado
    // motor
    this.eg = C.createGain(); this.eg.gain.value = 0;
    this.ef = C.createBiquadFilter(); this.ef.type = 'lowpass'; this.ef.frequency.value = 900; this.ef.Q.value = 3;
    this.eo1 = C.createOscillator(); this.eo1.type = 'sawtooth';
    this.eo2 = C.createOscillator(); this.eo2.type = 'square';
    this.eo3 = C.createOscillator(); this.eo3.type = 'sine';
    const g2 = C.createGain(); g2.gain.value = 0.4;
    this.eo1.connect(this.ef); this.eo2.connect(g2); g2.connect(this.ef); this.eo3.connect(this.ef);
    this.ef.connect(this.eg); this.eg.connect(this.sfx);
    for (const o of [this.eo1, this.eo2, this.eo3]) { o.frequency.value = 40; o.start(); }
    this.horn = null;
    this.radioTimer = null;
    // sirene: tom com LFO (wail)
    this.sg = C.createGain(); this.sg.gain.value = 0;
    this.so = C.createOscillator(); this.so.type = 'sawtooth'; this.so.frequency.value = 900;
    const sf = C.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 2200;
    this.slfo = C.createOscillator(); this.slfo.frequency.value = 0.35;
    const sd = C.createGain(); sd.gain.value = 380;
    this.slfo.connect(sd); sd.connect(this.so.frequency);
    this.so.connect(sf); sf.connect(this.sg); this.sg.connect(this.sfx);
    this.so.start(); this.slfo.start();
    // helicóptero: ruído grave pulsando
    this.heli = noiseChain('lowpass', 260, 1);
    const hl = C.createOscillator(); hl.frequency.value = 17;
    const hd = C.createGain(); hd.gain.value = 0;
    this.heliDepth = hd;
    hl.connect(hd); hd.connect(this.heli.g.gain); hl.start();
    this.plane = noiseChain('lowpass', 140, 0.6);
  }

  setSiren(v, stars) {
    if (!this.ctx) return;
    this.set(this.sg, v * 0.07, 0.2);
    this.slfo.frequency.setTargetAtTime(stars >= 4 ? 2.5 : 0.35, this.ctx.currentTime, 0.3);
  }
  setHeli(v) { if (!this.ctx) return; this.set(this.heli.g, v * 0.22, 0.3); this.heliDepth.gain.setTargetAtTime(v * 0.2, this.ctx.currentTime, 0.3); }
  setPlane(v) { if (!this.ctx) return; this.set(this.plane.g, v * v * 0.3, 0.5); }
  splash(big) { if (!this.ctx) return; this.burst(big ? 0.9 : 0.4, 900, big ? 0.6 : 0.3, 'lowpass'); this.burst(0.3, 3000, 0.2, 'highpass'); }
  // conversa ao fundo: sílaba sintética (voz com formante de vogal), sem palavras
  syllable(vol, female) {
    if (!this.ctx || vol < 0.004) return;
    const C = this.ctx, t = C.currentTime, d = 0.09 + Math.random() * 0.14;
    const f0 = (female ? 200 : 115) * (0.85 + Math.random() * 0.35);
    const o = C.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (0.85 + Math.random() * 0.3), t + d);
    const F = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [300, 870]][Math.floor(Math.random() * 5)];
    const g = C.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    for (const [f, q, k] of [[F[0], 6, 1], [F[1], 9, 0.5]]) {
      const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const kg = C.createGain(); kg.gain.value = k;
      o.connect(bp); bp.connect(kg); kg.connect(g);
    }
    g.connect(this.sfx); o.start(t); o.stop(t + d + 0.02);
  }
  gun(type, dist = 0) {
    if (!this.ctx) return;
    const v = Math.max(0.05, 1 - dist / 180);
    if (type === 'shotgun') { this.burst(0.5, 700, 0.9 * v); this.burst(0.18, 3500, 0.5 * v, 'highpass'); this.tone(80, 40, 0.25, 0.5 * v); }
    else { this.burst(0.22, 1600, 0.7 * v); this.burst(0.08, 5000, 0.4 * v, 'highpass'); this.tone(150, 60, 0.1, 0.3 * v); }
  }
  click() { if (!this.ctx) return; this.tone(1800, 1200, 0.04, 0.15, 'square'); }
  swing() { if (!this.ctx) return; this.burst(0.18, 1400, 0.25, 'bandpass'); }
  bark(dist = 0) {
    if (!this.ctx) return;
    const v = Math.max(0, 1 - dist / 60) * 0.35;
    for (let i = 0; i < 2; i++) { this.tone(520, 240, 0.12, v, 'sawtooth', i * 0.22); this.burst(0.1, 900, v * 0.6, 'bandpass'); }
  }
  gull(dist = 0) {
    if (!this.ctx) return;
    const v = Math.max(0, 1 - dist / 90) * 0.12;
    for (let i = 0; i < 3; i++) this.tone(1500, 900, 0.18, v, 'triangle', i * 0.2);
  }
  chirp(dist = 0) {
    if (!this.ctx) return;
    const v = Math.max(0, 1 - dist / 70) * 0.06;
    for (let i = 0; i < 4; i++) this.tone(3200 + Math.random() * 800, 4200, 0.05, v, 'sine', i * 0.08);
  }
  eat() { if (!this.ctx) return; for (let i = 0; i < 3; i++) this.burst(0.08, 1200, 0.2, 'bandpass'); }
  cash() { if (!this.ctx) return; this.tone(1320, 1320, 0.08, 0.15, 'square'); this.tone(1760, 1760, 0.12, 0.12, 'square', 0.07); }
  boom() { if (!this.ctx) return; this.burst(2.5, 220, 1); this.tone(90, 30, 1.2, 0.8); this.burst(0.6, 2500, 0.5, 'bandpass'); }
  jingle() { if (!this.ctx) return; [72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n), NOTE(n), 0.3, 0.15, 'triangle', i * 0.12)); }

  applyVolume() {
    if (!this.ctx) return;
    this.master.gain.value = this.s.get('volume');
    this.music.gain.value = this.s.get('musicVol') * 0.5;
  }

  set(g, v, t = 0.08) { g.gain.setTargetAtTime(v, this.ctx.currentTime, t); }

  update(st) {
    if (!this.ctx) return;
    const C = this.ctx, now = C.currentTime;
    this.set(this.wind.g, clamp(st.wind / 16, 0, 1) * 0.12 + clamp(st.speed / 60, 0, 1) * 0.18);
    this.wind.fl.frequency.setTargetAtTime(300 + st.wind * 40 + st.speed * 10, now, 0.2);
    this.set(this.rain.g, st.rain * 0.16 * (st.indoor ? 0.4 : 1), 0.4);
    this.set(this.tire.g, st.slip * 0.18);
    this.set(this.road.g, st.engine ? clamp(st.speed / 40, 0, 1) * 0.12 : 0);
    this.set(this.hiss.g, st.engine ? (st.wet || 0) * clamp(st.speed / 30, 0, 1) * 0.11 : 0, 0.15);
    if (st.engine) {
      const f = 28 + st.rpmN * 150;
      this.eo1.frequency.setTargetAtTime(f, now, 0.03);
      this.eo2.frequency.setTargetAtTime(f * 0.5, now, 0.03);
      this.eo3.frequency.setTargetAtTime(f * 2, now, 0.03);
      this.ef.frequency.setTargetAtTime(300 + st.throttle * 1500 + st.rpmN * 800, now, 0.05);
      this.set(this.eg, 0.05 + st.throttle * 0.07, 0.05);
    } else this.set(this.eg, 0, 0.1);
  }

  burst(dur, f, vol, type = 'lowpass', dest = this.sfx) {
    if (!this.ctx) return;
    const C = this.ctx;
    const src = C.createBufferSource(); src.buffer = this.noise;
    const fl = C.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
    const g = C.createGain();
    g.gain.setValueAtTime(vol, C.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, C.currentTime + dur);
    src.connect(fl); fl.connect(g); g.connect(dest);
    src.start(C.currentTime, Math.random()); src.stop(C.currentTime + dur + 0.05);
  }
  tone(f0, f1, dur, vol, type = 'sine', t0 = 0, dest = this.sfx) {
    const C = this.ctx; const t = C.currentTime + t0;
    const o = C.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    const g = C.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }
  crash(v) { if (!this.ctx) return; this.burst(0.4, 1200, clamp(v / 15, 0.1, 0.9)); this.tone(120, 40, 0.3, clamp(v / 20, 0.05, 0.6)); }
  punch() { if (!this.ctx) return; this.burst(0.12, 900, 0.5); this.tone(160, 60, 0.12, 0.4); }
  door() { if (!this.ctx) return; this.tone(220, 80, 0.12, 0.3, 'square'); this.burst(0.08, 2000, 0.2); }
  thunder() { if (!this.ctx) return; this.burst(3.5, 160, 0.9); this.burst(1.2, 400, 0.4); }
  checkpoint() { if (!this.ctx) return; this.tone(880, 880, 0.12, 0.25, 'square'); this.tone(1320, 1320, 0.2, 0.2, 'square', 0.1); }
  passed() {
    if (!this.ctx) return;
    [67, 71, 74, 79, 74, 79].forEach((n, i) => this.tone(NOTE(n), NOTE(n), 0.35, 0.18, 'triangle', i * 0.16));
    [43, 50, 55].forEach((n, i) => this.tone(NOTE(n), NOTE(n), 1.2, 0.2, 'sawtooth', i * 0.32));
  }
  failed() { if (!this.ctx) return; [62, 58, 55].forEach((n, i) => this.tone(NOTE(n), NOTE(n) * 0.98, 0.5, 0.2, 'sawtooth', i * 0.3)); }
  setHorn(on) {
    if (!this.ctx) return;
    if (on && !this.horn) {
      const C = this.ctx, g = C.createGain(); g.gain.value = 0.12;
      const o1 = C.createOscillator(), o2 = C.createOscillator();
      o1.type = o2.type = 'square'; o1.frequency.value = 392; o2.frequency.value = 494;
      o1.connect(g); o2.connect(g); g.connect(this.sfx); o1.start(); o2.start();
      this.horn = { o1, o2, g };
    } else if (!on && this.horn) {
      this.horn.o1.stop(); this.horn.o2.stop(); this.horn = null;
    }
  }
  beep(dist) { if (!this.ctx) return; const v = clamp(1 - dist / 60, 0, 1) * 0.1; if (v > 0.005) { this.tone(415, 415, 0.25, v, 'square'); this.tone(523, 523, 0.25, v * 0.8, 'square'); } }

  // ------------------------------------------------ rádio procedural
  cycleRadio() {
    this.station = (this.station + 1) % STATIONS.length;
    this.stopRadio();
    if (this.station) this.startRadio();
    return STATIONS[this.station];
  }
  stopRadio() { clearInterval(this.radioTimer); this.radioTimer = null; }
  startRadio() {
    if (!this.ctx) return;
    const st = STATIONS[this.station];
    const spb = 60 / st.bpm / 4;
    this.step = 0;
    this.nextT = this.ctx.currentTime + 0.1;
    this.radioTimer = setInterval(() => {
      while (this.nextT < this.ctx.currentTime + 0.15) {
        this.playStep(this.station, this.step, this.nextT);
        this.step++;
        this.nextT += spb * (this.station === 3 && this.step % 2 ? 1.12 : this.station === 3 ? 0.88 : 1);
      }
    }, 30);
  }
  kick(t, v = 0.9) { const C = this.ctx; const o = C.createOscillator(); const g = C.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.32); }
  hat(t, v = 0.15, d = 0.04) { const C = this.ctx; const s = C.createBufferSource(); s.buffer = this.noise; const f = C.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500; const g = C.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); s.connect(f); f.connect(g); g.connect(this.music); s.start(t, Math.random()); s.stop(t + d + 0.02); }
  snare(t, v = 0.4) { const C = this.ctx; const s = C.createBufferSource(); s.buffer = this.noise; const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; const g = C.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); s.connect(f); f.connect(g); g.connect(this.music); s.start(t, Math.random()); s.stop(t + 0.2); this.note(t, 190, 0.08, 0.2, 'triangle'); }
  note(t, f, dur, v, type = 'sawtooth', glide = 0, cut = 0) {
    const C = this.ctx; const o = C.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur * 0.6);
    const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = o;
    if (cut) { const fl = C.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cut; o.connect(fl); out = fl; }
    out.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.05);
    if (type === 'sine' && glide === 0 && dur > 0.4) {
      const l = C.createOscillator(); const lg = C.createGain(); l.frequency.value = 5.5; lg.gain.value = f * 0.012; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur);
    }
  }
  playStep(stn, i, t) {
    const s = i % 16, bar = Math.floor(i / 16) % 4;
    if (stn === 1) {
      // G-funk: Gm - Cm, sintetizador agudo deslizando
      if ([0, 7, 10].includes(s)) this.kick(t);
      if (s === 4 || s === 12) this.snare(t);
      if (s % 2 === 0) this.hat(t, s % 4 === 2 ? 0.12 : 0.07);
      const root = bar % 2 === 0 ? 43 : 48;
      const bass = { 0: 0, 3: 0, 6: 3, 8: 5, 11: 7, 14: 5 };
      if (bass[s] !== undefined) this.note(t, NOTE(root + bass[s]), 0.3, 0.25, 'sawtooth', 0, 500);
      if (s === 0) { const lead = [79, 77, 82, 74][bar]; this.note(t, NOTE(lead), 1.6, 0.06, 'sine', 0); }
      if (s === 0 || s === 8) [0, 3, 7, 10].forEach((n) => this.note(t, NOTE(root + 24 + n), 0.9, 0.025, 'triangle'));
    } else if (stn === 2) {
      // tamborzão
      if ([0, 3, 6, 10, 12].includes(s)) this.kick(t, 0.85);
      if ([2, 5, 8, 11, 14].includes(s)) this.note(t, 180 + (s % 3) * 40, 0.12, 0.25, 'sine', 90);
      if (s === 4 || s === 12) this.snare(t, 0.35);
      if (s % 2 === 1) this.hat(t, 0.06);
      if (s === 0 && bar % 2 === 0) this.note(t, NOTE(70), 0.25, 0.08, 'square', NOTE(65));
      if (s === 8) this.note(t, NOTE(41 + (bar % 2) * 3), 0.5, 0.25, 'sawtooth', 0, 300);
    } else if (stn === 3) {
      // bossa lo-fi
      const prog = [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [45, 48, 52, 55]][bar];
      if ([0, 3, 6, 10, 13].includes(s)) prog.forEach((n, k) => this.note(t + k * 0.008, NOTE(n), 0.35, 0.035, 'triangle'));
      if (s === 0 || s === 8) this.note(t, NOTE(prog[0] - 12), 0.6, 0.18, 'sine');
      if ([3, 6, 11, 14].includes(s)) this.hat(t, 0.08, 0.03);
      if (s === 0 || s === 9) this.kick(t, 0.4);
    }
  }
}
