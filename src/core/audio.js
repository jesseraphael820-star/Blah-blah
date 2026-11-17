// Áudio 100% sintetizado com WebAudio (sem arquivos externos):
// motor dinâmico, sirene, buzina, batidas, socos, explosões e jingles.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
    this.engine = null;
    this.siren = null;
    this.hornNode = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  suspend(on) {
    if (!this.ctx) return;
    if (on) this.ctx.suspend(); else this.ctx.resume();
  }

  // ---------- sons contínuos ----------
  updateEngine(active, rpm, throttle) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (!this.engine) {
      const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth';
      const o2 = this.ctx.createOscillator(); o2.type = 'square';
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
      const g = this.ctx.createGain(); g.gain.value = 0;
      const g2 = this.ctx.createGain(); g2.gain.value = 0.35;
      o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(this.master);
      o1.start(); o2.start();
      this.engine = { o1, o2, f, g };
    }
    const e = this.engine;
    const base = 38 + rpm * 110;
    e.o1.frequency.setTargetAtTime(base, t, 0.05);
    e.o2.frequency.setTargetAtTime(base * 0.5, t, 0.05);
    e.f.frequency.setTargetAtTime(350 + rpm * 900 + throttle * 300, t, 0.08);
    e.g.gain.setTargetAtTime(active ? 0.05 + throttle * 0.05 + rpm * 0.03 : 0, t, 0.1);
  }

  updateSiren(intensity) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (!this.siren) {
      const o = this.ctx.createOscillator(); o.type = 'triangle';
      const lfo = this.ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 1.6;
      const lg = this.ctx.createGain(); lg.gain.value = 170;
      lfo.connect(lg); lg.connect(o.frequency);
      o.frequency.value = 780;
      const g = this.ctx.createGain(); g.gain.value = 0;
      o.connect(g); g.connect(this.master);
      o.start(); lfo.start();
      this.siren = { o, g };
    }
    this.siren.g.gain.setTargetAtTime(intensity * 0.05, t, 0.2);
  }

  setHorn(on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (!this.hornNode) {
      const o1 = this.ctx.createOscillator(); o1.type = 'square'; o1.frequency.value = 392;
      const o2 = this.ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 494;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
      const g = this.ctx.createGain(); g.gain.value = 0;
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
      o1.start(); o2.start();
      this.hornNode = g;
    }
    this.hornNode.gain.setTargetAtTime(on ? 0.06 : 0, t, 0.02);
  }

  stopLoops() {
    if (!this.ctx) return;
    this.updateEngine(false, 0, 0);
    this.updateSiren(0);
    this.setHorn(false);
  }

  // ---------- efeitos ----------
  noiseBurst(dur, freq, gain, q = 1) {
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur);
  }

  tone(freq, dur, type = 'square', gain = 0.08, when = 0, slide = 0) {
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  play(name, k = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'crash': this.noiseBurst(0.25 + k * 0.25, 900 + k * 1500, Math.min(0.5, 0.12 + k * 0.3)); this.tone(90, 0.2, 'sawtooth', 0.08 * k, 0, -50); break;
      case 'punch': this.noiseBurst(0.12, 500, 0.3); this.tone(140, 0.1, 'sine', 0.15, 0, -80); break;
      case 'door': this.tone(220, 0.06, 'square', 0.05); this.noiseBurst(0.08, 1200, 0.12); break;
      case 'explosion': this.noiseBurst(1.4, 400, 0.7, 0.7); this.tone(60, 0.9, 'sawtooth', 0.2, 0, -30); break;
      case 'click': this.tone(880, 0.04, 'square', 0.03); break;
      case 'checkpoint': this.tone(660, 0.08, 'square', 0.06); this.tone(990, 0.12, 'square', 0.06, 0.08); break;
      case 'money': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, 'square', 0.05, i * 0.07)); break;
      case 'mission': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'square', 0.06, i * 0.11)); break;
      case 'start': [392, 523, 659].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.08, i * 0.09)); break;
      case 'fail': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.25, 'sawtooth', 0.05, i * 0.18)); break;
      case 'wanted': this.tone(880, 0.1, 'square', 0.05); this.tone(660, 0.14, 'square', 0.05, 0.1); break;
      case 'alarm': for (let i = 0; i < 6; i++) this.tone(i % 2 ? 900 : 1200, 0.14, 'square', 0.04, i * 0.15); break;
      case 'busted': [600, 500, 400].forEach((f, i) => this.tone(f, 0.3, 'square', 0.06, i * 0.25)); break;
      case 'honk': this.tone(415 * k, 0.12, 'square', 0.03); this.tone(415 * k, 0.16, 'square', 0.03, 0.16); break;
      case 'skid': this.noiseBurst(0.2, 2500, 0.04 * k, 4); break;
    }
  }
}
