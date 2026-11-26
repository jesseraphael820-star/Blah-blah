// Motor de áudio procedural: música gerativa por tema, efeitos sonoros sintetizados,
// ambiência (chuva, vento, grilos, água, fogo) e "vozes" curtas para diálogos.
import { mulberry32, hashStr, clamp } from './util.js';

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10],
  harm: [0, 2, 3, 5, 7, 8, 11], penta: [0, 2, 4, 7, 9, 12, 14], mpenta: [0, 3, 5, 7, 10, 12, 15], locrian: [0, 1, 3, 5, 6, 8, 10],
};

export const THEMES = {
  menu: { bpm: 68, root: 50, scale: 'dorian', prog: [0, 5, 3, 4], lead: 'flute', pad: 'strings', arp: 'harp', bass: true, density: 0.5 },
  varden: { bpm: 96, root: 55, scale: 'mixo', prog: [0, 3, 4, 0, 5, 3, 4, 4], lead: 'lute', pad: 'strings', arp: 'lute', bass: true, perc: 'folk', density: 0.65 },
  eldoria: { bpm: 80, root: 52, scale: 'minor', prog: [0, 5, 6, 4], lead: 'flute', pad: 'strings', arp: 'harp', bass: true, density: 0.55 },
  drakmor: { bpm: 84, root: 50, scale: 'phrygian', prog: [0, 1, 0, 6], lead: 'horn', pad: 'strings', bass: true, perc: 'war', density: 0.45 },
  solaria: { bpm: 112, root: 57, scale: 'lydian', prog: [0, 1, 4, 0], lead: 'lute', pad: 'strings', arp: 'lute', bass: true, perc: 'tamb', density: 0.7 },
  frostheim: { bpm: 72, root: 47, scale: 'minor', prog: [0, 6, 5, 4], lead: 'horn', pad: 'choir', bass: true, perc: 'drum', density: 0.4 },
  cinzamar: { bpm: 66, root: 54, scale: 'minor', prog: [0, 3, 0, 4], lead: 'bell', pad: 'strings', bass: true, density: 0.35 },
  ravencross: { bpm: 70, root: 48, scale: 'harm', prog: [0, 1, 5, 4], lead: 'bell', pad: 'choir', bass: true, density: 0.35 },
  plains: { bpm: 88, root: 48, scale: 'penta', prog: [0, 3, 4, 3], lead: 'flute', pad: 'strings', arp: 'harp', bass: true, density: 0.5 },
  forest: { bpm: 76, root: 52, scale: 'dorian', prog: [0, 6, 3, 4], lead: 'flute', pad: 'strings', arp: 'harp', density: 0.45 },
  mountains: { bpm: 74, root: 50, scale: 'minor', prog: [0, 5, 2, 6], lead: 'horn', pad: 'strings', bass: true, density: 0.35 },
  swamp: { bpm: 62, root: 46, scale: 'phrygian', prog: [0, 1, 0, 5], lead: 'bell', pad: 'choir', density: 0.3 },
  ash: { bpm: 60, root: 45, scale: 'locrian', prog: [0, 0, 1, 0], lead: 'bell', pad: 'strings', bass: true, density: 0.25 },
  coast: { bpm: 92, root: 53, scale: 'lydian', prog: [0, 4, 5, 3], lead: 'flute', pad: 'strings', arp: 'harp', bass: true, density: 0.55 },
  north: { bpm: 66, root: 47, scale: 'mpenta', prog: [0, 5, 3, 4], lead: 'horn', pad: 'choir', density: 0.3 },
  ruins: { bpm: 64, root: 49, scale: 'dorian', prog: [0, 1, 0, 6], lead: 'bell', pad: 'choir', density: 0.3 },
  cave: { bpm: 56, root: 41, scale: 'phrygian', prog: [0, 0, 1, 0], lead: 'bell', pad: 'strings', density: 0.18 },
  battle: { bpm: 136, root: 50, scale: 'minor', prog: [0, 5, 6, 4], lead: 'horn', pad: 'strings', arp: 'saw', bass: true, perc: 'battle', density: 0.75 },
  sad: { bpm: 58, root: 57, scale: 'minor', prog: [0, 5, 3, 4, 0, 5, 6, 4], lead: 'bell', pad: 'strings', arp: 'harp', density: 0.4 },
  tension: { bpm: 100, root: 45, scale: 'phrygian', prog: [0, 0, 1, 0], lead: 'bell', pad: 'strings', arp: 'saw', bass: true, perc: 'drum', density: 0.3 },
  epic: { bpm: 108, root: 50, scale: 'dorian', prog: [0, 5, 3, 4, 0, 6, 3, 4], lead: 'horn', pad: 'choir', arp: 'harp', bass: true, perc: 'battle', density: 0.6 },
  credits: { bpm: 80, root: 55, scale: 'major', prog: [0, 4, 5, 3, 0, 4, 3, 4], lead: 'flute', pad: 'choir', arp: 'harp', bass: true, perc: 'folk', density: 0.55 },
  refuge: { bpm: 64, root: 52, scale: 'dorian', prog: [0, 3, 0, 5], lead: 'flute', pad: 'strings', density: 0.3 },
};

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

class Audio {
  constructor() {
    this.ctx = null; this.enabled = true;
    this.vol = { master: 0.8, music: 0.6, sfx: 0.8 };
    this.theme = null; this.players = [];
    this.amb = {}; this.listener = { x: 0, y: 0 };
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain(); this.master.connect(c.destination);
    this.musicBus = c.createGain(); this.sfxBus = c.createGain(); this.ambBus = c.createGain();
    this.comp = c.createDynamicsCompressor(); this.comp.connect(this.master);
    this.musicBus.connect(this.comp); this.sfxBus.connect(this.comp); this.ambBus.connect(this.comp);
    this.reverb = c.createConvolver(); this.reverb.buffer = this.makeImpulse(2.6, 2.2);
    this.revGain = c.createGain(); this.revGain.gain.value = 0.32; this.reverb.connect(this.revGain); this.revGain.connect(this.comp);
    this.noiseBuf = this.makeNoise(2);
    this.applyVolumes();
    this.startAmbience();
    this.sched = setInterval(() => this.tick(), 40);
    if (this.pendingTheme) { const t = this.pendingTheme; this.pendingTheme = null; this.setTheme(t); }
  }
  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.vol.sfx * 0.7, t, 0.05);
  }
  makeNoise(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  makeImpulse(sec, decay) {
    const c = this.ctx, len = c.sampleRate * sec, b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }

  // ---------------- Música ----------------
  setTheme(name, fade = 2.5) {
    if (!this.ctx) { this.pendingTheme = name; return; }
    if (this.theme === name) return;
    this.theme = name;
    const t = this.ctx.currentTime;
    for (const p of this.players) { p.gain.gain.cancelScheduledValues(t); p.gain.gain.setTargetAtTime(0, t, fade / 4); p.dying = t + fade * 1.5; }
    if (!name || !THEMES[name]) return;
    const g = this.ctx.createGain(); g.gain.value = 0.0001; g.connect(this.musicBus);
    const send = this.ctx.createGain(); send.gain.value = 0.5; g.connect(send); send.connect(this.reverb);
    g.gain.setTargetAtTime(1, t, fade / 3);
    const cfg = THEMES[name];
    const rng = mulberry32(hashStr(name) + ((Date.now() / 60000) | 0));
    this.players.push({ name, cfg, gain: g, rng, next: t + 0.1, step: 0, motif: this.makeMotif(cfg, rng), bar: 0 });
  }
  makeMotif(cfg, rng) {
    const m = [];
    for (let i = 0; i < 16; i++) m.push(rng() < cfg.density ? { deg: Math.floor(rng() * 7) - 1 + (rng() < 0.3 ? 7 : 0), len: rng() < 0.3 ? 2 : 1 } : null);
    return m;
  }
  tick() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.players = this.players.filter((p) => !(p.dying && now > p.dying && (p.gain.disconnect(), true)));
    for (const p of this.players) {
      if (p.dying) continue;
      const stepDur = 60 / p.cfg.bpm / 2; // colcheias
      this.curOut = p.gain;
      while (p.next < now + 0.25) { this.playStep(p, p.next, stepDur); p.next += stepDur; p.step++; }
    }
    this.updateBirds(now);
  }
  playStep(p, t, sd) {
    const cfg = p.cfg, sc = SCALES[cfg.scale], step = p.step % 16, barLen = 8;
    const barIdx = Math.floor(p.step / barLen);
    const chordDeg = cfg.prog[barIdx % cfg.prog.length];
    const note = (deg, oct = 0) => { const n = sc.length; const o = Math.floor(deg / n); const d = ((deg % n) + n) % n; return cfg.root + sc[d] + 12 * (o + oct); };
    const sib = p.step % barLen;
    if (sib === 0) {
      if (barIdx % 8 === 0 && p.rng() < 0.5) p.motif = this.makeMotif(cfg, p.rng);
      // pad: acorde da tríade
      [0, 2, 4].forEach((k) => this.voice(cfg.pad, mtof(note(chordDeg + k, 0)), t, sd * barLen * 1.05, 0.05));
      if (cfg.bass) this.voice('bass', mtof(note(chordDeg, -1)), t, sd * 3.5, 0.16);
    }
    if (cfg.bass && sib === 4 && cfg.perc) this.voice('bass', mtof(note(chordDeg + (p.rng() < 0.5 ? 4 : 0), -1)), t, sd * 3, 0.12);
    if (cfg.arp) {
      const pat = [0, 2, 4, 7, 4, 2, 0, 4];
      if (cfg.density > 0.4 || sib % 2 === 0) this.voice(cfg.arp, mtof(note(chordDeg + pat[sib], 1)), t, sd * 1.6, 0.045);
    }
    const m = p.motif[step];
    if (m && (barIdx % 4 !== 3 || sib < 4)) {
      const varDeg = barIdx % 2 === 1 && p.rng() < 0.3 ? 1 : 0;
      this.voice(cfg.lead, mtof(note(chordDeg + m.deg + varDeg, 1)), t, sd * m.len * 1.4, 0.07);
    }
    if (cfg.perc) this.perc(cfg.perc, sib, t, barIdx);
  }
  voice(type, f, t, dur, vol) {
    const c = this.ctx, g = c.createGain(), out = this.curOut;
    let o;
    const env = (a, r) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.02, dur + r)); };
    switch (type) {
      case 'flute': {
        o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.2; lg.gain.value = f * 0.008; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.5);
        env(0.06, 0.25); break;
      }
      case 'lute': case 'harp': {
        o = c.createOscillator(); o.type = type === 'lute' ? 'triangle' : 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(vol * 1.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (type === 'harp' ? 1.2 : 0.55)); break;
      }
      case 'bell': {
        o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.76; const g2 = c.createGain(); g2.gain.value = 0.3; o2.connect(g2); g2.connect(g); o2.start(t); o2.stop(t + 2.2);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 2); break;
      }
      case 'horn': {
        o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f * 3; lp.Q.value = 1;
        o.connect(lp); lp.connect(g); env(0.09, 0.3); g.connect(out); o.start(t); o.stop(t + dur + 0.5); return;
      }
      case 'saw': {
        o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
        o.connect(lp); lp.connect(g); g.gain.setValueAtTime(vol * 0.7, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); g.connect(out); o.start(t); o.stop(t + 0.3); return;
      }
      case 'strings': case 'choir': {
        const lp = c.createBiquadFilter(); lp.type = type === 'choir' ? 'bandpass' : 'lowpass'; lp.frequency.value = type === 'choir' ? 800 : 1200; lp.Q.value = type === 'choir' ? 0.8 : 0.5;
        for (const det of [-7, 0, 7]) { const oo = c.createOscillator(); oo.type = 'sawtooth'; oo.frequency.value = f; oo.detune.value = det; oo.connect(lp); oo.start(t); oo.stop(t + dur + 1.2); }
        lp.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * 0.5, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1); g.connect(out); return;
      }
      case 'bass': default: {
        o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); break;
      }
    }
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 2.3);
  }
  perc(kind, sib, t, bar) {
    const out = this.curOut;
    const kick = (v) => this.drum(t, 110, 40, 0.25, v, out);
    const snare = (v) => this.noiseHit(t, 1800, 0.15, v, out, 'bandpass');
    const hat = (v) => this.noiseHit(t, 7000, 0.04, v, out, 'highpass');
    if (kind === 'battle') { if (sib % 4 === 0) kick(0.5); if (sib === 4) snare(0.25); if (sib % 2 === 1) hat(0.06); if (sib === 7 && bar % 2) this.drum(t, 160, 70, 0.2, 0.3, out); }
    else if (kind === 'war') { if (sib === 0 || sib === 3) this.drum(t, 80, 45, 0.5, 0.45, out); if (sib === 6) this.drum(t, 120, 60, 0.3, 0.25, out); }
    else if (kind === 'folk') { if (sib === 0) kick(0.25); if (sib === 4) this.noiseHit(t, 3000, 0.08, 0.1, out, 'bandpass'); if (sib % 2) hat(0.03); }
    else if (kind === 'tamb') { if (sib % 2 === 0) this.noiseHit(t, 8000, 0.08, 0.06, out, 'highpass'); if (sib === 0 || sib === 5) kick(0.25); }
    else if (kind === 'drum') { if (sib === 0) this.drum(t, 70, 40, 0.6, 0.4, out); }
  }
  drum(t, f0, f1, dur, vol, out = this.sfxBus) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  noiseHit(t, freq, dur, vol, out = this.sfxBus, type = 'bandpass', q = 1) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    return f;
  }
  tone(t, type, f0, f1, dur, vol, out = this.sfxBus) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }

  // ---------------- Efeitos ----------------
  sfx(name, pos, vol = 1) {
    if (!this.ctx || !this.enabled) return;
    let v = vol;
    let out = this.sfxBus;
    if (pos) {
      const d = Math.hypot(pos.x - this.listener.x, pos.y - this.listener.y);
      v *= clamp(1 - d / 320, 0, 1);
      if (v < 0.02) return;
      const pan = this.ctx.createStereoPanner(); pan.pan.value = clamp((pos.x - this.listener.x) / 200, -1, 1); pan.connect(this.sfxBus); out = pan;
    }
    const t = this.ctx.currentTime, r = Math.random;
    switch (name) {
      case 'swing': this.noiseHit(t, 900 + r() * 400, 0.14, 0.25 * v, out, 'bandpass', 2).frequency.exponentialRampToValueAtTime(3000, t + 0.12); break;
      case 'swingHeavy': this.noiseHit(t, 500, 0.22, 0.32 * v, out, 'bandpass', 2).frequency.exponentialRampToValueAtTime(1800, t + 0.2); break;
      case 'hit': this.noiseHit(t, 600, 0.1, 0.4 * v, out, 'lowpass'); this.drum(t, 180, 60, 0.12, 0.35 * v, out); break;
      case 'clang': this.tone(t, 'square', 1250 + r() * 200, 1100, 0.18, 0.08 * v, out); this.tone(t, 'sine', 2600, 2500, 0.35, 0.08 * v, out); this.noiseHit(t, 4000, 0.06, 0.2 * v, out, 'highpass'); break;
      case 'parry': this.tone(t, 'sine', 1800, 1700, 0.5, 0.14 * v, out); this.tone(t, 'sine', 2700, 2650, 0.6, 0.08 * v, out); break;
      case 'hurt': this.tone(t, 'sawtooth', 300, 120, 0.18, 0.12 * v, out); break;
      case 'death': this.tone(t, 'sawtooth', 220, 50, 0.6, 0.12 * v, out); break;
      case 'bow': this.tone(t, 'triangle', 200, 90, 0.15, 0.2 * v, out); this.noiseHit(t, 2500, 0.1, 0.12 * v, out); break;
      case 'arrow': this.noiseHit(t, 1200, 0.06, 0.2 * v, out, 'bandpass'); break;
      case 'roll': this.noiseHit(t, 400, 0.2, 0.18 * v, out, 'lowpass'); break;
      case 'step_grass': this.noiseHit(t, 2200 + r() * 600, 0.05, 0.05 * v, out, 'bandpass', 0.7); break;
      case 'step_dirt': this.noiseHit(t, 900 + r() * 300, 0.05, 0.07 * v, out, 'lowpass'); break;
      case 'step_stone': this.noiseHit(t, 3000 + r() * 800, 0.03, 0.06 * v, out, 'highpass'); this.drum(t, 300, 200, 0.03, 0.04 * v, out); break;
      case 'step_wood': this.drum(t, 220 + r() * 40, 140, 0.06, 0.12 * v, out); break;
      case 'step_snow': this.noiseHit(t, 1500 + r() * 300, 0.09, 0.06 * v, out, 'lowpass', 3); break;
      case 'step_water': case 'splash': this.noiseHit(t, 1400, 0.16, 0.12 * v, out, 'bandpass', 0.6); this.tone(t, 'sine', 600 + r() * 300, 300, 0.1, 0.03 * v, out); break;
      case 'step_mud': this.noiseHit(t, 500, 0.1, 0.1 * v, out, 'lowpass', 4); break;
      case 'gallop': for (let i = 0; i < 2; i++) this.drum(t + i * 0.07, 160, 70, 0.07, 0.22 * v, out); break;
      case 'neigh': { const o = this.tone(t, 'sawtooth', 700, 400, 0.7, 0.07 * v, out); const l = this.ctx.createOscillator(), lg = this.ctx.createGain(); l.frequency.value = 18; lg.gain.value = 60; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 0.7); break; }
      case 'snort': this.noiseHit(t, 700, 0.3, 0.15 * v, out, 'bandpass', 2); break;
      case 'howl': { const o = this.tone(t, 'sine', 380, 560, 1.6, 0.08 * v, out); o.frequency.setValueAtTime(380, t); o.frequency.linearRampToValueAtTime(600, t + 0.6); o.frequency.linearRampToValueAtTime(450, t + 1.6); break; }
      case 'growl': { const o = this.tone(t, 'sawtooth', 90, 70, 0.7, 0.14 * v, out); const l = this.ctx.createOscillator(), lg = this.ctx.createGain(); l.frequency.value = 30; lg.gain.value = 20; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 0.7); break; }
      case 'bark': this.tone(t, 'square', 500, 300, 0.09, 0.06 * v, out); this.tone(t + 0.15, 'square', 480, 280, 0.09, 0.06 * v, out); break;
      case 'meow': this.tone(t, 'triangle', 700, 900, 0.35, 0.06 * v, out); break;
      case 'cluck': for (let i = 0; i < 3; i++) this.tone(t + i * 0.09, 'square', 900, 600, 0.05, 0.03 * v, out); break;
      case 'moo': this.tone(t, 'sawtooth', 140, 110, 0.9, 0.06 * v, out); break;
      case 'baa': { const o = this.tone(t, 'sawtooth', 420, 380, 0.5, 0.05 * v, out); const l = this.ctx.createOscillator(), lg = this.ctx.createGain(); l.frequency.value = 12; lg.gain.value = 25; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 0.5); break; }
      case 'chirp': for (let i = 0; i < 3; i++) this.tone(t + i * 0.08, 'sine', 3000 + r() * 1500, 4200, 0.05, 0.03 * v, out); break;
      case 'caw': this.tone(t, 'sawtooth', 600, 400, 0.25, 0.06 * v, out); break;
      case 'squeak': this.tone(t, 'sine', 2200, 2600, 0.08, 0.04 * v, out); break;
      case 'coin': this.tone(t, 'square', 990, 990, 0.08, 0.05 * v, out); this.tone(t + 0.08, 'square', 1320, 1320, 0.18, 0.05 * v, out); break;
      case 'pickup': this.tone(t, 'triangle', 660, 1320, 0.12, 0.1 * v, out); break;
      case 'chest': this.drum(t, 120, 80, 0.15, 0.2 * v, out); [660, 830, 990, 1320].forEach((f, i) => this.tone(t + 0.15 + i * 0.07, 'triangle', f, f, 0.3, 0.07 * v, out)); break;
      case 'door': this.noiseHit(t, 300, 0.3, 0.2 * v, out, 'lowpass', 3); this.tone(t, 'sawtooth', 160, 120, 0.25, 0.03 * v, out); break;
      case 'quest': [523, 659, 784, 1046].forEach((f, i) => this.tone(t + i * 0.12, 'triangle', f, f, 0.5, 0.1 * v, out)); break;
      case 'questStart': [392, 523, 659].forEach((f, i) => this.tone(t + i * 0.1, 'triangle', f, f, 0.4, 0.08 * v, out)); break;
      case 'level': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(t + i * 0.09, 'square', f, f, 0.3, 0.05 * v, out)); break;
      case 'achieve': [784, 988, 1175, 1568].forEach((f, i) => this.tone(t + i * 0.1, 'sine', f, f, 0.6, 0.1 * v, out)); break;
      case 'click': this.tone(t, 'square', 800, 600, 0.04, 0.04 * v, out); break;
      case 'hover': this.tone(t, 'sine', 1200, 1200, 0.03, 0.02 * v, out); break;
      case 'thunder': { const f = this.noiseHit(t, 300, 2.5, 0.6 * v, out, 'lowpass'); f.frequency.exponentialRampToValueAtTime(60, t + 2.5); break; }
      case 'horn': this.tone(t, 'sawtooth', 220, 220, 1.2, 0.08 * v, out); this.tone(t + 0.3, 'sawtooth', 330, 330, 1.2, 0.07 * v, out); break;
      case 'eat': for (let i = 0; i < 3; i++) this.noiseHit(t + i * 0.12, 1500, 0.06, 0.1 * v, out, 'bandpass', 3); break;
      case 'drink': for (let i = 0; i < 4; i++) this.tone(t + i * 0.1, 'sine', 400 + i * 60, 300, 0.08, 0.06 * v, out); break;
      case 'heal': [440, 554, 659, 880].forEach((f, i) => this.tone(t + i * 0.06, 'sine', f, f * 1.01, 0.4, 0.05 * v, out)); break;
      case 'fire': this.noiseHit(t, 2000, 0.05, 0.05 * v, out, 'highpass'); break;
      case 'chop': this.drum(t, 260, 120, 0.1, 0.25 * v, out); this.noiseHit(t, 1200, 0.08, 0.15 * v, out); break;
      case 'mine': this.tone(t, 'square', 1800, 1500, 0.08, 0.06 * v, out); this.noiseHit(t, 3000, 0.07, 0.18 * v, out, 'highpass'); break;
      case 'fish': this.noiseHit(t, 1600, 0.25, 0.18 * v, out, 'bandpass'); this.tone(t, 'sine', 900, 500, 0.2, 0.05 * v, out); break;
      case 'capture': [294, 392, 494, 587].forEach((f, i) => this.tone(t + i * 0.18, 'sawtooth', f, f, 0.6, 0.06 * v, out)); break;
      case 'lever': this.tone(t, 'square', 200, 120, 0.15, 0.06 * v, out); this.noiseHit(t, 600, 0.2, 0.12 * v, out, 'lowpass'); break;
      case 'dialogOpen': this.tone(t, 'sine', 500, 700, 0.12, 0.05 * v, out); break;
      case 'error': this.tone(t, 'square', 200, 150, 0.15, 0.05 * v, out); break;
      case 'rumble': this.noiseHit(t, 120, 1.4, 0.5 * v, out, 'lowpass'); break;
      default: break;
    }
  }
  // "Voz" de personagem: blip curto com timbre próprio
  blip(voice, ch) {
    if (!this.ctx || !voice) return;
    const t = this.ctx.currentTime;
    const vowel = /[aeiouáéíóúãõâêôAEIOU]/.test(ch) ? 1.0 : 0.85;
    const f = voice.pitch * vowel * (1 + (Math.random() - 0.5) * voice.var);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), lp = this.ctx.createBiquadFilter();
    o.type = voice.wave; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = f * 4;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(lp); lp.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + 0.08);
  }

  // ---------------- Ambiência ----------------
  startAmbience() {
    const c = this.ctx;
    const mk = (type, freq, q) => {
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.ambBus); s.start();
      return { g, f };
    };
    this.amb.rain = mk('highpass', 1200, 0.3);
    this.amb.wind = mk('bandpass', 400, 0.8);
    this.amb.water = mk('bandpass', 900, 0.4);
    this.amb.fire = mk('bandpass', 2500, 1);
    this.amb.sea = mk('lowpass', 500, 0.5);
    this.windPhase = 0; this.birdT = 0; this.crickT = 0;
  }
  setAmbience(a) {
    if (!this.ctx) return;
    this.ambTarget = a;
    const t = this.ctx.currentTime;
    this.windPhase += 0.05;
    const wind = (a.wind || 0) * (0.6 + Math.sin(this.windPhase) * 0.4);
    this.amb.rain.g.gain.setTargetAtTime((a.rain || 0) * 0.35, t, 0.5);
    this.amb.wind.g.gain.setTargetAtTime(wind * 0.3, t, 0.4);
    this.amb.wind.f.frequency.setTargetAtTime(300 + wind * 500, t, 0.4);
    this.amb.water.g.gain.setTargetAtTime((a.water || 0) * 0.12, t, 0.5);
    this.amb.fire.g.gain.setTargetAtTime((a.fire || 0) * 0.05, t, 0.3);
    this.amb.sea.g.gain.setTargetAtTime((a.sea || 0) * (0.2 + Math.sin(this.windPhase * 0.7) * 0.12), t, 0.5);
  }
  updateBirds(now) {
    const a = this.ambTarget; if (!a) return;
    if (a.birds && now > this.birdT) { this.birdT = now + 1.5 + Math.random() * 5; if (Math.random() < a.birds) this.sfx('chirp', null, 0.5 + Math.random() * 0.5); }
    if (a.night && now > this.crickT) {
      this.crickT = now + 0.4 + Math.random() * 0.8;
      if (Math.random() < a.night) for (let i = 0; i < 3; i++) this.tone(now + i * 0.05, 'sine', 4200, 4200, 0.03, 0.01, this.ambBus);
    }
    if (a.drip && Math.random() < 0.02) this.tone(now, 'sine', 1400 + Math.random() * 800, 600, 0.12, 0.03, this.ambBus);
    if (a.crows && Math.random() < 0.003) this.sfx('caw', null, 0.4);
  }
}
export const audio = new Audio();
