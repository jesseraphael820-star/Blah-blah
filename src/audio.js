// Fully synthesized audio (Web Audio API): engines, siren, impacts, gunshots, radio beat, ambience.
export class Audio {
  constructor() { this.ctx = null; this.muted = false; }
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = C.createGain(); this.master.gain.value = 0.55; this.master.connect(C.destination);
    this.comp = C.createDynamicsCompressor(); this.comp.connect(this.master);
    // noise buffer
    const len = C.sampleRate * 2; const buf = C.createBuffer(1, len, C.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // engine
    this.eng = C.createOscillator(); this.eng.type = 'sawtooth';
    this.eng2 = C.createOscillator(); this.eng2.type = 'square';
    this.engF = C.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 600;
    this.engG = C.createGain(); this.engG.gain.value = 0;
    this.eng.connect(this.engF); this.eng2.connect(this.engF); this.engF.connect(this.engG); this.engG.connect(this.comp);
    this.eng.start(); this.eng2.start();
    // tyre skid
    this.skid = C.createBufferSource(); this.skid.buffer = buf; this.skid.loop = true;
    this.skidF = C.createBiquadFilter(); this.skidF.type = 'bandpass'; this.skidF.frequency.value = 1800; this.skidF.Q.value = 3;
    this.skidG = C.createGain(); this.skidG.gain.value = 0;
    this.skid.connect(this.skidF); this.skidF.connect(this.skidG); this.skidG.connect(this.comp); this.skid.start();
    // siren
    this.sir = C.createOscillator(); this.sir.type = 'triangle'; this.sirG = C.createGain(); this.sirG.gain.value = 0;
    this.sir.connect(this.sirG); this.sirG.connect(this.comp); this.sir.start();
    // ambience (city rumble + wind)
    this.amb = C.createBufferSource(); this.amb.buffer = buf; this.amb.loop = true;
    const af = C.createBiquadFilter(); af.type = 'lowpass'; af.frequency.value = 380;
    this.ambG = C.createGain(); this.ambG.gain.value = 0.05;
    this.amb.connect(af); af.connect(this.ambG); this.ambG.connect(this.comp); this.amb.start();
    // radio bus
    this.radioG = C.createGain(); this.radioG.gain.value = 0; this.radioG.connect(this.comp);
    this.radioOn = false; this.nextBeat = 0; this.step = 0;
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.55; }
  burst({ dur = 0.2, freq = 1000, type = 'lowpass', gain = 0.5, q = 1, attack = 0.002, pitchEnv = null, dist = 0 }) {
    if (!this.ctx) return;
    const C = this.ctx, t = C.currentTime;
    const s = C.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = C.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (pitchEnv) f.frequency.exponentialRampToValueAtTime(pitchEnv, t + dur);
    const g = C.createGain(); const vol = gain / (1 + dist * 0.04);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.comp); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  tone({ f0 = 440, f1 = 220, dur = 0.2, type = 'sine', gain = 0.3 }) {
    if (!this.ctx) return;
    const C = this.ctx, t = C.currentTime;
    const o = C.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    const g = C.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.comp); o.start(t); o.stop(t + dur + 0.02);
  }
  distTo(pos, game) { return game && game.camPos ? pos.distanceTo(game.camPos) : 0; }
  punch() { this.burst({ dur: 0.12, freq: 900, gain: 0.6 }); this.tone({ f0: 160, f1: 60, dur: 0.1, gain: 0.4 }); }
  whoosh() { this.burst({ dur: 0.15, freq: 2500, type: 'bandpass', gain: 0.12, q: 0.7 }); }
  gun(pos, game) { const d = pos ? this.distTo(pos, game) : 0; this.burst({ dur: 0.35, freq: 3000, gain: 0.9, pitchEnv: 300, dist: d }); this.tone({ f0: 120, f1: 40, dur: 0.2, gain: 0.6 / (1 + d * 0.04) }); }
  crash(k, pos, game) { const d = this.distTo(pos, game); this.burst({ dur: 0.5 + k * 0.4, freq: 1200, gain: 0.3 + k * 0.6, pitchEnv: 200, dist: d }); this.tone({ f0: 90, f1: 30, dur: 0.3, gain: 0.4 * k }); }
  explosion(pos, game) { const d = this.distTo(pos, game); this.burst({ dur: 2.2, freq: 900, gain: 1.4, pitchEnv: 60, attack: 0.01, dist: d * 0.5 }); this.tone({ f0: 70, f1: 20, dur: 1.5, gain: 1.0 / (1 + d * 0.02) }); }
  horn(pos, game) {
    if (!this.ctx) return; const d = this.distTo(pos, game); if (d > 60) return;
    for (const f of [392, 494]) this.tone({ f0: f, f1: f, dur: 0.45, type: 'square', gain: 0.06 / (1 + d * 0.05) });
  }
  pickup() { this.tone({ f0: 660, f1: 1320, dur: 0.18, type: 'triangle', gain: 0.25 }); setTimeout(() => this.tone({ f0: 990, f1: 1980, dur: 0.2, type: 'triangle', gain: 0.2 }), 90); }
  mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone({ f0: f, f1: f, dur: 0.35, type: 'triangle', gain: 0.22 }), i * 130)); }
  fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone({ f0: f, f1: f * 0.95, dur: 0.4, type: 'sawtooth', gain: 0.12 }), i * 180)); }
  checkpoint() { this.tone({ f0: 880, f1: 1760, dur: 0.15, type: 'sine', gain: 0.3 }); }
  step() { this.burst({ dur: 0.05, freq: 500, gain: 0.05 }); }

  update(dt, s) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // engine
    if (s.inCar) {
      const sp = Math.abs(s.speed);
      const gear = Math.min(5, Math.floor(sp / 11));
      const rpm = 0.25 + ((sp - gear * 11) / 11) * 0.75 + s.throttle * 0.15;
      const f = 38 + rpm * 70 + gear * 6;
      this.eng.frequency.setTargetAtTime(f, t, 0.05); this.eng2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
      this.engF.frequency.setTargetAtTime(400 + rpm * 1400 + s.throttle * 500, t, 0.05);
      this.engG.gain.setTargetAtTime(0.09 + s.throttle * 0.07, t, 0.08);
      this.skidG.gain.setTargetAtTime(Math.min(0.25, Math.max(0, s.skid - 3) * 0.03), t, 0.05);
    } else { this.engG.gain.setTargetAtTime(0, t, 0.1); this.skidG.gain.setTargetAtTime(0, t, 0.05); }
    // siren
    if (s.sirenDist < 120) {
      const w = (Math.sin(t * 3.2) + 1) / 2; this.sir.frequency.setTargetAtTime(650 + w * 550, t, 0.02);
      this.sirG.gain.setTargetAtTime(0.06 / (1 + s.sirenDist * 0.05), t, 0.1);
    } else this.sirG.gain.setTargetAtTime(0, t, 0.2);
    this.ambG.gain.setTargetAtTime(s.inCar ? 0.02 : 0.05, t, 0.5);
    // procedural radio (in car)
    this.radioG.gain.setTargetAtTime(s.inCar && s.radio ? 0.22 : 0, t, 0.3);
    if (s.inCar && s.radio) this.radioTick();
  }
  radioTick() {
    const C = this.ctx, bpm = 96, sp = 60 / bpm / 4;
    if (this.nextBeat < C.currentTime) this.nextBeat = C.currentTime + 0.05;
    while (this.nextBeat < C.currentTime + 0.2) {
      const st = this.step % 16, t = this.nextBeat;
      const out = this.radioG;
      const env = (node, dur, g) => { const gn = C.createGain(); gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur); node.connect(gn); gn.connect(out); return gn; };
      if (st === 0 || st === 7 || st === 10) { const o = C.createOscillator(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); env(o, 0.25, 0.9); o.start(t); o.stop(t + 0.3); }
      if (st === 4 || st === 12) { const s = C.createBufferSource(); s.buffer = this.noise; const f = C.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500; s.connect(f); env(f, 0.18, 0.5); s.start(t); s.stop(t + 0.2); }
      if (st % 2 === 0) { const s = C.createBufferSource(); s.buffer = this.noise; const f = C.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; s.connect(f); env(f, 0.04, 0.18); s.start(t); s.stop(t + 0.05); }
      const bar = Math.floor(this.step / 16) % 4;
      const roots = [41.2, 49.0, 55.0, 36.7];
      if ([0, 3, 6, 8, 11, 14].includes(st)) { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = roots[bar] * (st === 11 ? 1.5 : 1); const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; o.connect(f); env(f, sp * 1.8, 0.35); o.start(t); o.stop(t + sp * 2); }
      if (st === 0 || st === 8) {
        for (const m of [4, 5, 6]) { const o = C.createOscillator(); o.type = 'triangle'; o.frequency.value = roots[bar] * m * (m === 5 ? 1.19 / 1.25 * 1.25 : 1); env(o, sp * 6, 0.04); o.start(t); o.stop(t + sp * 6.2); }
      }
      this.step++; this.nextBeat += sp;
    }
  }
}
