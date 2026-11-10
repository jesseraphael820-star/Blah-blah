// Procedural audio engine: every sound effect and all music are synthesized
// at runtime with WebAudio (no external files needed).
import { G } from './context.js';
import { clamp, makeRng } from './utils.js';

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pent: [0, 2, 4, 7, 9],
  minpent: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phryg: [0, 1, 3, 5, 7, 8, 10],
};

// Music themes: one per region/situation.
const THEMES = {
  title:   { bpm: 76, root: 57, scale: 'major', prog: [0, 5, 3, 4], lead: 'bell', pad: true, bass: true, drums: 0, density: 0.35 },
  village: { bpm: 96, root: 60, scale: 'major', prog: [0, 3, 4, 0, 5, 3, 1, 4], lead: 'pluck', pad: true, bass: true, drums: 1, density: 0.55 },
  field:   { bpm: 88, root: 62, scale: 'pent', prog: [0, 3, 4, 3], lead: 'flute', pad: true, bass: true, drums: 0, density: 0.4 },
  forest:  { bpm: 72, root: 57, scale: 'dorian', prog: [0, 6, 3, 4], lead: 'bell', pad: true, bass: true, drums: 0, density: 0.3 },
  night:   { bpm: 64, root: 55, scale: 'minpent', prog: [0, 5, 3, 4], lead: 'bell', pad: true, bass: false, drums: 0, density: 0.22 },
  cave:    { bpm: 60, root: 45, scale: 'phryg', prog: [0, 1, 0, 6], lead: 'bell', pad: true, bass: true, drums: 0, density: 0.18 },
  ruins:   { bpm: 70, root: 52, scale: 'minor', prog: [0, 5, 6, 4], lead: 'flute', pad: true, bass: true, drums: 0, density: 0.3 },
  combat:  { bpm: 138, root: 52, scale: 'minor', prog: [0, 5, 6, 4], lead: 'pluck', pad: false, bass: true, drums: 2, density: 0.6 },
  boss:    { bpm: 150, root: 50, scale: 'phryg', prog: [0, 1, 6, 0, 5, 1, 4, 0], lead: 'saw', pad: true, bass: true, drums: 3, density: 0.7 },
};

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.vol = { master: 0.8, music: 0.5, sfx: 0.8 };
    this.theme = null;
    this.nextTheme = 'title';
    this.step = 0;
    this.nextNoteTime = 0;
    this.rng = makeRng(77);
    this.loops = {};
    this.ambTimers = { bird: 2, cricket: 1, animal: 8 };
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.master = c.createGain();
    this.master.connect(this.comp); this.comp.connect(c.destination);
    this.musicGain = c.createGain(); this.musicGain.connect(this.master);
    this.sfxGain = c.createGain(); this.sfxGain.connect(this.master);
    this.ambGain = c.createGain(); this.ambGain.connect(this.master);
    // shared reverb-ish delay for music
    this.delay = c.createDelay(1); this.delay.delayTime.value = 0.33;
    this.fb = c.createGain(); this.fb.gain.value = 0.28;
    this.delay.connect(this.fb); this.fb.connect(this.delay);
    this.delayOut = c.createGain(); this.delayOut.gain.value = 0.35;
    this.delay.connect(this.delayOut); this.delayOut.connect(this.musicGain);
    // noise buffer
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.startLoops();
    this.nextNoteTime = c.currentTime + 0.1;
    this.ready = true;
  }

  setVolumes(v) { Object.assign(this.vol, v); this.applyVolumes(); }
  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master;
    this.musicGain.gain.value = this.vol.music * 0.32;
    this.sfxGain.gain.value = this.vol.sfx;
    this.ambGain.gain.value = this.vol.sfx * 0.9;
  }

  // ---------- low level building blocks ----------
  env(g, t, a, peak, dec, sustain = 0, rel = 0.05, hold = 0) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (sustain > 0) {
      g.gain.setTargetAtTime(sustain, t + a, dec / 3);
      g.gain.setTargetAtTime(0.0001, t + a + hold, rel / 3);
    } else {
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
    }
  }
  osc(type, freq, t, dur, vol, out, opts = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + (opts.slide || dur));
    if (opts.detune) o.detune.value = opts.detune;
    const g = c.createGain();
    let node = o;
    if (opts.lp) {
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; f.Q.value = opts.q || 0.7;
      o.connect(f); node = f;
    }
    node.connect(g); g.connect(out);
    if (opts.pan !== undefined && c.createStereoPanner) {
      const p = c.createStereoPanner(); p.pan.value = opts.pan; g.disconnect(); g.connect(p); p.connect(out);
    }
    this.env(g, t, opts.a || 0.005, vol, dur, opts.sus || 0, opts.rel || 0.1, opts.hold || 0);
    o.start(t); o.stop(t + dur + (opts.hold || 0) + (opts.rel || 0.1) + 0.05);
    return o;
  }
  noiseBurst(t, dur, vol, out, type = 'bandpass', freq = 1000, q = 1, opts = {}) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = opts.rate || 1;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const g = c.createGain();
    s.connect(f); f.connect(g); g.connect(out);
    this.env(g, t, opts.a || 0.003, vol, dur);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }

  // ---------- sound effects ----------
  sfx(name, opts = {}) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + 0.005, o = this.sfxGain;
    const v = clamp(opts.vol ?? 1, 0, 2);
    const r = 0.9 + Math.random() * 0.2;
    switch (name) {
      case 'step': {
        const s = opts.surface || 'grass';
        if (s === 'wood') { this.osc('triangle', 180 * r, t, 0.06, 0.18 * v, o, { to: 90 }); this.noiseBurst(t, 0.05, 0.12 * v, o, 'bandpass', 900, 2); }
        else if (s === 'stone') { this.noiseBurst(t, 0.05, 0.22 * v, o, 'highpass', 2500 * r, 1); }
        else if (s === 'water') { this.noiseBurst(t, 0.15, 0.2 * v, o, 'bandpass', 700 * r, 2, { to: 1600 }); }
        else if (s === 'dirt') { this.noiseBurst(t, 0.07, 0.2 * v, o, 'lowpass', 900 * r, 1); }
        else { this.noiseBurst(t, 0.08, 0.16 * v, o, 'bandpass', 1500 * r, 0.8); }
        break;
      }
      case 'jump': this.noiseBurst(t, 0.12, 0.15 * v, o, 'bandpass', 600, 1, { to: 1800 }); break;
      case 'land': this.noiseBurst(t, 0.12, 0.3 * v, o, 'lowpass', 500, 1); this.osc('sine', 90, t, 0.1, 0.25 * v, o, { to: 50 }); break;
      case 'swing': this.noiseBurst(t, 0.18, 0.32 * v, o, 'bandpass', 500 * r, 2.5, { to: 3000 * r }); break;
      case 'swingHeavy': this.noiseBurst(t, 0.3, 0.4 * v, o, 'bandpass', 300, 2, { to: 2200 }); this.osc('sine', 120, t, 0.25, 0.15 * v, o, { to: 60 }); break;
      case 'hit': this.osc('square', 160 * r, t, 0.09, 0.22 * v, o, { to: 60, lp: 1200 }); this.noiseBurst(t, 0.08, 0.35 * v, o, 'lowpass', 2000, 1); break;
      case 'crit': this.osc('square', 220, t, 0.12, 0.2 * v, o, { to: 70, lp: 2000 }); this.osc('sine', 1400, t, 0.15, 0.1 * v, o, { to: 2200 }); this.noiseBurst(t, 0.12, 0.4 * v, o, 'lowpass', 3000, 1); break;
      case 'clang': this.osc('square', 880 * r, t, 0.25, 0.12 * v, o, { lp: 4000 }); this.osc('sine', 1320 * r, t, 0.35, 0.12 * v, o); this.noiseBurst(t, 0.06, 0.3 * v, o, 'highpass', 3000, 1); break;
      case 'hurt': this.osc('sawtooth', 300, t, 0.18, 0.15 * v, o, { to: 120, lp: 1500 }); this.noiseBurst(t, 0.1, 0.3 * v, o, 'lowpass', 1200, 1); break;
      case 'enemyHurt': this.osc('square', 240 * r, t, 0.1, 0.1 * v, o, { to: 110, lp: 1400 }); break;
      case 'die': this.osc('sawtooth', 400, t, 0.6, 0.15 * v, o, { to: 60, lp: 1200 }); break;
      case 'enemyDie': this.osc('square', 300 * r, t, 0.35, 0.12 * v, o, { to: 40, lp: 1600 }); this.noiseBurst(t, 0.3, 0.25 * v, o, 'lowpass', 900, 1, { to: 200 }); break;
      case 'dodge': this.noiseBurst(t, 0.22, 0.25 * v, o, 'bandpass', 1200, 1.5, { to: 400 }); break;
      case 'coin': this.osc('square', 988, t, 0.07, 0.09 * v, o, { lp: 5000 }); this.osc('square', 1319, t + 0.07, 0.18, 0.09 * v, o, { lp: 5000 }); break;
      case 'pickup': this.osc('triangle', 660, t, 0.08, 0.15 * v, o); this.osc('triangle', 990, t + 0.06, 0.12, 0.15 * v, o); break;
      case 'chest': {
        this.osc('sawtooth', 110, t, 0.35, 0.08 * v, o, { to: 160, lp: 600 });
        [784, 988, 1175, 1568].forEach((f, i) => this.osc('triangle', f, t + 0.3 + i * 0.07, 0.4, 0.12 * v, o));
        break;
      }
      case 'quest': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.osc(i < 4 ? 'square' : 'triangle', f, t + i * 0.11, 0.35, 0.08 * v, o, { lp: 3500 })); break;
      case 'questStart': [392, 523, 659].forEach((f, i) => this.osc('triangle', f, t + i * 0.1, 0.4, 0.14 * v, o)); break;
      case 'levelup': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => { this.osc('square', f, t + i * 0.08, 0.5, 0.07 * v, o, { lp: 4000 }); this.osc('sine', f * 2, t + i * 0.08, 0.6, 0.05 * v, o); }); break;
      case 'achievement': [659, 880, 1109, 1319].forEach((f, i) => this.osc('triangle', f, t + i * 0.09, 0.5, 0.13 * v, o)); break;
      case 'blip': {
        const p = opts.pitch || 1;
        this.osc('square', (220 + Math.random() * 60) * p, t, 0.045, 0.06 * v, o, { lp: 2200 });
        break;
      }
      case 'talk': this.osc('sine', 600, t, 0.08, 0.12 * v, o, { to: 900 }); this.osc('sine', 900, t + 0.08, 0.12, 0.1 * v, o, { to: 1200 }); break;
      case 'click': this.osc('square', 1200, t, 0.03, 0.05 * v, o, { lp: 3000 }); break;
      case 'open': this.osc('triangle', 500, t, 0.1, 0.1 * v, o, { to: 900 }); break;
      case 'close': this.osc('triangle', 800, t, 0.1, 0.1 * v, o, { to: 400 }); break;
      case 'buy': this.sfx('coin', { vol: v }); this.osc('triangle', 1568, t + 0.2, 0.3, 0.1 * v, o); break;
      case 'error': this.osc('square', 180, t, 0.12, 0.1 * v, o, { lp: 1000 }); this.osc('square', 140, t + 0.12, 0.16, 0.1 * v, o, { lp: 1000 }); break;
      case 'equip': this.noiseBurst(t, 0.1, 0.2 * v, o, 'highpass', 3000, 1); this.osc('triangle', 700, t, 0.12, 0.1 * v, o, { to: 1000 }); break;
      case 'splash': this.noiseBurst(t, 0.4, 0.35 * v, o, 'bandpass', 800, 1, { to: 300 }); break;
      case 'orb': this.osc('sine', 400, t, 0.35, 0.2 * v, o, { to: 900 }); this.osc('triangle', 800, t, 0.3, 0.08 * v, o, { to: 1600 }); break;
      case 'ray': this.osc('sawtooth', 1200, t, 0.5, 0.1 * v, o, { to: 300, lp: 3000 }); this.osc('sine', 2400, t, 0.4, 0.06 * v, o, { to: 600 }); break;
      case 'explosion': this.noiseBurst(t, 0.8, 0.7 * v, o, 'lowpass', 1400, 1, { to: 80 }); this.osc('sine', 120, t, 0.6, 0.5 * v, o, { to: 30 }); break;
      case 'shield': [440, 554, 659].forEach((f, i) => this.osc('sine', f, t + i * 0.04, 0.6, 0.1 * v, o)); this.noiseBurst(t, 0.4, 0.1 * v, o, 'highpass', 5000, 1); break;
      case 'shieldHit': this.osc('sine', 880, t, 0.2, 0.15 * v, o, { to: 660 }); break;
      case 'fire': this.noiseBurst(t, 0.6, 0.45 * v, o, 'lowpass', 600, 1, { to: 2200, rate: 0.6 }); break;
      case 'freeze': this.noiseBurst(t, 0.5, 0.3 * v, o, 'highpass', 4000, 2); [1760, 2093, 2637].forEach((f, i) => this.osc('sine', f, t + i * 0.05, 0.5, 0.06 * v, o)); break;
      case 'blink': this.osc('sine', 300, t, 0.2, 0.2 * v, o, { to: 2000 }); this.noiseBurst(t, 0.2, 0.15 * v, o, 'bandpass', 3000, 3); break;
      case 'heal': [523, 784, 1047].forEach((f, i) => this.osc('sine', f, t + i * 0.08, 0.4, 0.12 * v, o)); break;
      case 'retro': {
        // dreamy synth arpeggio with a soft pad
        [261.6, 329.6, 392, 523.3, 659.3, 784, 1046.5, 784].forEach((f, i) => this.osc('sawtooth', f, t + i * 0.11, 0.5, 0.05 * v, o, { lp: 1800 }));
        [130.8, 196, 261.6].forEach((f) => this.osc('triangle', f, t, 2.4, 0.07 * v, o, { lp: 1200 }));
        break;
      }
      case 'legend': {
        // deep boom, rising choir chord and a shimmering bell
        this.osc('sine', 70, t, 1.6, 0.5 * v, o, { to: 40 });
        this.noiseBurst(t, 1.2, 0.35 * v, o, 'lowpass', 400, 1, { to: 80 });
        [220, 277.2, 329.6, 440, 554.4].forEach((f, i) => { this.osc('triangle', f, t + 0.15 + i * 0.12, 2.6, 0.06 * v, o, { lp: 2500 }); this.osc('sine', f * 2, t + 0.3 + i * 0.12, 2.2, 0.03 * v, o); });
        [1760, 2217, 2637, 3520].forEach((f, i) => this.osc('sine', f, t + 0.9 + i * 0.09, 1.2, 0.03 * v, o));
        break;
      }
      case 'drink': [0, 0.12, 0.24].forEach((d) => this.osc('sine', 300 + Math.random() * 100, t + d, 0.08, 0.15 * v, o, { to: 500 })); break;
      case 'thunder': this.noiseBurst(t, 2.5, 0.8 * v, o, 'lowpass', 300, 0.7, { to: 60, rate: 0.5 }); this.noiseBurst(t, 0.3, 0.5 * v, o, 'lowpass', 2000, 1); break;
      case 'howl': this.osc('sawtooth', 300, t, 1.8, 0.07 * v, o, { to: 560, slide: 0.7, lp: 1200, a: 0.3 }); break;
      case 'growl': this.osc('sawtooth', 90 * r, t, 0.5, 0.15 * v, o, { to: 70, lp: 500 }); this.noiseBurst(t, 0.5, 0.1 * v, o, 'lowpass', 400, 1); break;
      case 'bark': this.osc('square', 500, t, 0.08, 0.12 * v, o, { to: 250, lp: 1800 }); this.osc('square', 520, t + 0.15, 0.08, 0.1 * v, o, { to: 260, lp: 1800 }); break;
      case 'moo': this.osc('sawtooth', 140, t, 1.0, 0.08 * v, o, { to: 110, lp: 600, a: 0.1 }); break;
      case 'cluck': [0, 0.08, 0.16].forEach((d) => this.osc('square', 700 + Math.random() * 200, t + d, 0.04, 0.05 * v, o, { lp: 2500 })); break;
      case 'baa': this.osc('sawtooth', 380, t, 0.6, 0.06 * v, o, { lp: 1500, a: 0.05 }); break;
      case 'chirp': {
        const f = 2500 + Math.random() * 1500;
        for (let i = 0; i < 3; i++) this.osc('sine', f, t + i * 0.09, 0.06, 0.04 * v, this.ambGain, { to: f * 1.3, pan: opts.pan });
        break;
      }
      case 'cricket': for (let i = 0; i < 4; i++) this.osc('sine', 4200, t + i * 0.05, 0.025, 0.018 * v, this.ambGain, { pan: opts.pan }); break;
      case 'owl': this.osc('sine', 420, t, 0.3, 0.05 * v, this.ambGain, { to: 380, a: 0.05 }); this.osc('sine', 400, t + 0.45, 0.5, 0.05 * v, this.ambGain, { to: 350, a: 0.05 }); break;
      case 'slam': this.osc('sine', 80, t, 0.5, 0.6 * v, o, { to: 30 }); this.noiseBurst(t, 0.4, 0.5 * v, o, 'lowpass', 600, 1, { to: 100 }); break;
      case 'roar': this.osc('sawtooth', 120, t, 1.2, 0.18 * v, o, { to: 70, lp: 700, a: 0.1 }); this.noiseBurst(t, 1.2, 0.2 * v, o, 'lowpass', 700, 1); break;
      case 'waystone': [392, 587, 784, 1175].forEach((f, i) => this.osc('sine', f, t + i * 0.12, 0.9, 0.1 * v, o)); break;
      case 'discover': [587, 740, 880].forEach((f, i) => this.osc('triangle', f, t + i * 0.13, 0.6, 0.1 * v, o)); break;
      case 'rune': this.osc('sine', 220, t, 1.2, 0.2 * v, o, { to: 440, a: 0.2 }); this.osc('sine', 330, t, 1.2, 0.1 * v, o, { to: 660, a: 0.2 }); break;
      case 'mine': this.osc('square', 1400 * r, t, 0.08, 0.1 * v, o, { lp: 5000 }); this.noiseBurst(t, 0.08, 0.3 * v, o, 'highpass', 2000, 1); break;
      case 'harvest': this.noiseBurst(t, 0.15, 0.25 * v, o, 'bandpass', 2500, 1); this.osc('triangle', 880, t + 0.05, 0.1, 0.08 * v, o); break;
      case 'event': [440, 554, 659, 880].forEach((f, i) => this.osc('square', f, t + i * 0.15, 0.3, 0.06 * v, o, { lp: 2500 })); break;
      default: break;
    }
  }

  // positional helper: attenuates by distance to player and pans left/right
  sfxAt(name, x, z, opts = {}) {
    if (!this.ready || !G.player) return;
    const p = G.player.pos;
    const d = Math.hypot(x - p.x, z - p.z);
    const max = opts.range || 40;
    if (d > max) return;
    const att = Math.pow(1 - d / max, 1.5);
    this.sfx(name, { ...opts, vol: (opts.vol ?? 1) * att });
  }

  // ---------- ambient loops ----------
  makeLoop(type, freq, q) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(this.ambGain);
    s.start();
    return { s, f, g };
  }
  startLoops() {
    this.loops.wind = this.makeLoop('lowpass', 400, 0.6);
    this.loops.rain = this.makeLoop('highpass', 1200, 0.3);
    this.loops.rain2 = this.makeLoop('lowpass', 500, 0.5);
    this.loops.water = this.makeLoop('bandpass', 900, 0.6);
    this.loops.fire = this.makeLoop('lowpass', 300, 1);
  }
  setLoop(name, vol, freq) {
    const l = this.loops[name];
    if (!l) return;
    const t = this.ctx.currentTime;
    l.g.gain.setTargetAtTime(vol, t, 0.4);
    if (freq) l.f.frequency.setTargetAtTime(freq, t, 0.5);
  }

  // called every frame with environmental context
  updateAmbient(dt, amb) {
    if (!this.ready) return;
    const wind = amb.wind;
    this.setLoop('wind', 0.05 + wind * 0.12, 300 + wind * 500 + Math.sin(G.time * 0.3) * 120);
    this.setLoop('rain', amb.rain * 0.16);
    this.setLoop('rain2', amb.rain * 0.12);
    this.setLoop('water', amb.water * 0.12, 700 + Math.sin(G.time * 0.7) * 150);
    this.setLoop('fire', amb.fire * 0.2);
    if (amb.underground) return;
    const tm = this.ambTimers;
    tm.bird -= dt; tm.cricket -= dt; tm.animal -= dt;
    if (amb.day > 0.5 && amb.rain < 0.5 && tm.bird <= 0) {
      tm.bird = 1.5 + Math.random() * 4 / (0.5 + amb.forest);
      this.sfx('chirp', { vol: 0.6 + amb.forest * 0.5, pan: Math.random() * 2 - 1 });
    }
    if (amb.day < 0.35 && tm.cricket <= 0) {
      tm.cricket = 0.25 + Math.random() * 0.8;
      this.sfx('cricket', { vol: 1, pan: Math.random() * 2 - 1 });
      if (Math.random() < 0.03) this.sfx('owl', { vol: 0.8 });
    }
    if (tm.animal <= 0) {
      tm.animal = 10 + Math.random() * 15;
      if (amb.day < 0.3 && Math.random() < 0.4) this.sfx('howl', { vol: 0.5 });
    }
  }

  // ---------- generative music ----------
  setTheme(name) { if (THEMES[name]) this.nextTheme = name; }

  midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  degree(th, deg, oct = 0) {
    const sc = SCALES[th.scale];
    const o = Math.floor(deg / sc.length);
    const idx = ((deg % sc.length) + sc.length) % sc.length;
    return th.root + sc[idx] + 12 * (o + oct);
  }
  inst(kind, freq, t, dur, vol) {
    const out = this.musicGain;
    switch (kind) {
      case 'pluck':
        this.osc('triangle', freq, t, dur * 0.9, vol, out, { lp: 2400 });
        this.osc('square', freq, t, dur * 0.3, vol * 0.25, this.delay, { lp: 1800 });
        break;
      case 'bell':
        this.osc('sine', freq, t, dur * 2.2, vol, out);
        this.osc('sine', freq * 2.01, t, dur * 1.2, vol * 0.3, this.delay);
        break;
      case 'flute':
        this.osc('sine', freq, t, dur, vol, out, { a: 0.06, sus: vol * 0.7, hold: dur * 0.7, rel: 0.2 });
        this.osc('triangle', freq * 2, t, dur, vol * 0.15, this.delay, { a: 0.06 });
        break;
      case 'saw':
        this.osc('sawtooth', freq, t, dur, vol * 0.6, out, { lp: 1600, q: 3 });
        break;
      case 'bass':
        this.osc('triangle', freq, t, dur, vol, out, { lp: 600 });
        break;
      case 'pad':
        [-7, 7].forEach((dt) => this.osc('sawtooth', freq, t, dur, vol, out, { a: 0.6, sus: vol, hold: dur * 0.8, rel: 0.8, detune: dt, lp: 900 }));
        break;
      default: break;
    }
  }
  drum(kind, t, vol) {
    const out = this.musicGain;
    if (kind === 'k') this.osc('sine', 140, t, 0.25, vol, out, { to: 40, slide: 0.12 });
    else if (kind === 'h') this.noiseBurst(t, 0.04, vol * 0.35, out, 'highpass', 7000, 1);
    else if (kind === 's') { this.noiseBurst(t, 0.14, vol * 0.5, out, 'bandpass', 1800, 0.8); this.osc('triangle', 200, t, 0.08, vol * 0.3, out); }
  }

  updateMusic() {
    if (!this.ready) return;
    const c = this.ctx;
    while (this.nextNoteTime < c.currentTime + 0.25) {
      if (this.step % 16 === 0 && this.nextTheme !== this.theme && (this.step % 32 === 0 || !this.theme)) {
        this.theme = this.nextTheme;
      }
      const th = THEMES[this.theme || 'title'];
      const spb = 60 / th.bpm / 4; // 16th
      const t = this.nextNoteTime;
      const bar = Math.floor(this.step / 16);
      const s = this.step % 16;
      const chord = th.prog[bar % th.prog.length];
      const r = this.rng;
      // pad / bass at bar start
      if (s === 0) {
        if (th.pad) [0, 2, 4].forEach((d) => this.inst('pad', this.midi(this.degree(th, chord + d, -1)), t, spb * 16, 0.05));
      }
      if (th.bass && (s === 0 || s === 8 || (th.drums >= 2 && s % 4 === 0))) {
        this.inst('bass', this.midi(this.degree(th, chord, -2)), t, spb * 3.5, 0.22);
      }
      // melody
      const melodyStep = th.drums >= 2 ? 2 : 2;
      if (s % melodyStep === 0 && r() < th.density) {
        const deg = chord + [0, 2, 4, 1, 3, 5, 7][Math.floor(r() * 7)];
        this.inst(th.lead, this.midi(this.degree(th, deg, 1)), t, spb * (r() < 0.3 ? 4 : 2), th.lead === 'saw' ? 0.06 : 0.08);
      }
      // drums
      if (th.drums === 1) { if (s === 0 || s === 8) this.drum('k', t, 0.25); if (s % 4 === 2) this.drum('h', t, 0.2); }
      if (th.drums >= 2) {
        if (s % 4 === 0) this.drum('k', t, 0.4);
        if (s === 4 || s === 12) this.drum('s', t, 0.35);
        if (s % 2 === 1) this.drum('h', t, 0.25);
        if (th.drums === 3 && s === 14) this.drum('k', t, 0.3);
      }
      this.nextNoteTime += spb;
      this.step++;
    }
  }
}
