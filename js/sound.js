// Efeitos sonoros sintetizados (Web Audio). Desativados por padrão.
import { storageGet, storageSet } from './utils.js';

let ctx = null;
let enabled = storageGet('phonecheck.sound', false) === true;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, start, dur, { type = 'sine', vol = 0.08 } = {}) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + start;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

const SOUNDS = {
  start: () => { tone(660, 0, 0.12); tone(990, 0.09, 0.16); },
  tick: () => tone(1400, 0, 0.04, { type: 'triangle', vol: 0.03 }),
  pass: () => { tone(880, 0, 0.09, { vol: 0.06 }); tone(1320, 0.07, 0.14, { vol: 0.06 }); },
  warn: () => { tone(520, 0, 0.14, { type: 'triangle', vol: 0.07 }); },
  fail: () => { tone(300, 0, 0.18, { type: 'sawtooth', vol: 0.04 }); tone(220, 0.14, 0.22, { type: 'sawtooth', vol: 0.04 }); },
  done: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, { vol: 0.07 })); },
};

export const sound = {
  get enabled() { return enabled; },
  toggle() { enabled = !enabled; storageSet('phonecheck.sound', enabled); if (enabled) SOUNDS.tick(); return enabled; },
  play(name) { if (enabled) try { SOUNDS[name]?.(); } catch { /* sem áudio */ } },
};
