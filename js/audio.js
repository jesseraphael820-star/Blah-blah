'use strict';
// ===== Som sintetizado (WebAudio) =====
const SFX = {
  ctx: null, on: true, master: null, noise: null, last: {},
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext; this.ctx = new C();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate; const b = this.ctx.createBuffer(1, len, len); const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
      // motor
      this.eng = this.ctx.createOscillator(); this.eng.type = 'sawtooth'; this.eng.frequency.value = 50;
      this.engF = this.ctx.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 500;
      this.engG = this.ctx.createGain(); this.engG.gain.value = 0;
      this.eng.connect(this.engF); this.engF.connect(this.engG); this.engG.connect(this.master); this.eng.start();
      // sirene
      this.sir = this.ctx.createOscillator(); this.sir.type = 'square'; this.sir.frequency.value = 700;
      this.sirG = this.ctx.createGain(); this.sirG.gain.value = 0; this.sir.connect(this.sirG); this.sirG.connect(this.master); this.sir.start();
      // derrapagem
      const sk = this.ctx.createBufferSource(); sk.buffer = this.noise; sk.loop = true;
      const skf = this.ctx.createBiquadFilter(); skf.type = 'bandpass'; skf.frequency.value = 1800; skf.Q.value = 3;
      this.skG = this.ctx.createGain(); this.skG.gain.value = 0; sk.connect(skf); skf.connect(this.skG); this.skG.connect(this.master); sk.start();
    } catch (e) { this.ctx = null; }
  },
  ok(name, gap) { if (!this.ctx || !this.on) return false; const t = this.ctx.currentTime; if (gap && this.last[name] && t - this.last[name] < gap) return false; this.last[name] = t; return true; },
  burst(dur, freq, vol, type, q) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq; if (q) f.Q.value = q;
    const g = c.createGain(); const t = c.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },
  tone(freq, dur, type, vol, slide) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  shot(wi, v) { if (!this.ok('shot' + wi, 0.04) || v <= 0.02) return; const f = [0, 1800, 2400, 900][wi]; this.burst(wi === 3 ? 0.35 : 0.16, f, 0.9 * v); this.tone(wi === 3 ? 90 : 160, 0.12, 'square', 0.25 * v, 40); },
  punch() { if (this.ok('punch', 0.1)) { this.burst(0.08, 600, 0.5); } },
  thud() { if (this.ok('thud', 0.1)) this.tone(120, 0.18, 'sine', 0.5, 50); },
  boom() { if (!this.ok('boom', 0.1)) return; this.burst(1.4, 400, 1.2); this.tone(70, 0.9, 'sine', 0.8, 25); },
  crash(v) { if (this.ok('crash', 0.15)) { this.burst(0.3, 1200, clamp(v, 0.2, 1)); this.tone(90, 0.2, 'triangle', 0.4 * clamp(v, .2, 1), 40); } },
  skid(v) { if (this.ctx) this.skV = Math.max(this.skV || 0, v); },
  horn() { if (this.ok('horn', 0.5)) { this.tone(392, 0.4, 'square', 0.12); this.tone(494, 0.4, 'square', 0.1); } },
  pickup() { if (this.ok('pick', 0.05)) { this.tone(880, 0.1, 'square', 0.15); setTimeout(() => this.tone(1320, 0.15, 'square', 0.15), 70); } },
  cash() { if (this.ok('cash', 0.05)) { this.tone(1200, 0.08, 'square', 0.12); setTimeout(() => this.tone(1600, 0.2, 'square', 0.12), 60); } },
  door() { if (this.ok('door', 0.2)) { this.burst(0.12, 300, 0.6); } },
  star() { if (this.ok('star', 0.3)) { this.tone(600, 0.15, 'triangle', 0.3, 300); } },
  win() { if (!this.ok('win', 1)) return; [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, 'triangle', 0.3), i * 140)); },
  fail() { if (!this.ok('fail', 1)) return; [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.45, 'sawtooth', 0.15), i * 200)); },
  cp() { if (this.ok('cp', 0.1)) this.tone(1046, 0.18, 'triangle', 0.3, 1568); },
  update(dt, carSpd, inCar, siren, sirD, type) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, on = this.on ? 1 : 0;
    this.engG.gain.setTargetAtTime(inCar ? 0.09 * on : 0, t, 0.1);
    const moto = type === 'moto', heavy = type === 'truck' || type === 'tractor';
    this.eng.frequency.setTargetAtTime((moto ? 70 : heavy ? 26 : 38) + carSpd * (moto ? 0.6 : heavy ? 0.22 : 0.32), t, 0.08);
    this.engF.frequency.setTargetAtTime((moto ? 600 : heavy ? 220 : 300) + carSpd * 2.5, t, 0.1);
    this.sirG.gain.setTargetAtTime(siren ? 0.035 * on * clamp(1 - sirD / 900, 0, 1) : 0, t, 0.2);
    this.sir.frequency.setTargetAtTime(Math.sin(t * 5) > 0 ? 960 : 720, t, 0.02);
    this.skG.gain.setTargetAtTime((this.skV || 0) * 0.25 * on, t, 0.05); this.skV = 0;
  },
};

// ===== Rádio do carro: música procedural simples =====
const Radio = {
  st: 0, next16: 0, step: 0, name: '', t: 0,
  stations: [
    { name: 'RÁDIO ORLA FM', bpm: 96, bass: [0, 0, 7, 0, 5, 0, 3, 5], root: 43, wave: 'square', hat: 1 },
    { name: 'BATIDÃO 104', bpm: 128, bass: [0, 12, 0, 12, 3, 15, 5, 17], root: 38, wave: 'sawtooth', hat: 2 },
    { name: 'NOITE LO-FI', bpm: 78, bass: [0, 3, 7, 10, 7, 3, 5, 2], root: 45, wave: 'triangle', hat: 0 },
  ],
  next() { this.st = (this.st + 1) % (this.stations.length + 1); this.name = this.st ? this.stations[this.st - 1].name : 'RÁDIO DESLIGADO'; this.t = 2.5; this.step = 0; this.next16 = 0; },
  update(on) {
    const c = SFX.ctx; if (!c || !SFX.on || !on || !this.st) return;
    const s = this.stations[this.st - 1], dur = 60 / s.bpm / 4;
    if (this.next16 < c.currentTime) this.next16 = c.currentTime + 0.05;
    while (this.next16 < c.currentTime + 0.15) {
      const t = this.next16, i = this.step % 16;
      if (i % 2 === 0) this.note(440 * Math.pow(2, (s.root + s.bass[(i / 2) | 0] - 69) / 12), t, dur * 1.8, s.wave, 0.06);
      if (i % 8 === 0 || (s.hat === 2 && i % 4 === 0)) this.kick(t);
      if (i % 8 === 4) this.snare(t);
      if (s.hat && i % 2 === 1) this.hat(t);
      if (i === 0 && (this.step / 16 | 0) % 2 === 1) for (const n of [12, 16, 19]) this.note(440 * Math.pow(2, (s.root + 12 + n - 69) / 12), t, dur * 8, 'triangle', 0.018);
      this.next16 += dur; this.step++;
    }
  },
  note(f, t, d, w, v) { const c = SFX.ctx, o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900; o.type = w; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(fl); fl.connect(g); g.connect(SFX.master); o.start(t); o.stop(t + d + 0.02); },
  kick(t) { const c = SFX.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g); g.connect(SFX.master); o.start(t); o.stop(t + 0.2); },
  noiseHit(t, f, v, d, type) { const c = SFX.ctx, s = c.createBufferSource(); s.buffer = SFX.noise; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); s.connect(fl); fl.connect(g); g.connect(SFX.master); s.start(t, Math.random()); s.stop(t + d + 0.02); },
  snare(t) { this.noiseHit(t, 1500, 0.09, 0.12, 'bandpass'); },
  hat(t) { this.noiseHit(t, 7000, 0.025, 0.04, 'highpass'); },
};
