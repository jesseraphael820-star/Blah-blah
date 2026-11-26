// Ciclo dia/noite, clima regional e iluminação ambiente.
import { G } from '../state.js';
import { REGIONS } from '../data/world.js';
import { emit } from '../core/events.js';
import { audio } from '../core/audio.js';
import { dailyTick } from './war.js';

export const HOURS_PER_SEC = 24 / 1200; // 20 minutos reais por dia
export function advanceTime(dt) {
  if (G.timeFrozen) return;
  G.hour += dt * HOURS_PER_SEC;
  if (G.hour >= 24) { G.hour -= 24; G.day++; dailyTick(); emit('newDay', G.day); }
}
export function skipHours(h) {
  G.hour += h;
  while (G.hour >= 24) { G.hour -= 24; G.day++; dailyTick(); emit('newDay', G.day); }
}
export function isNight() { return G.hour < 5.5 || G.hour >= 20.5; }

// escuridão (0..1) e cor ambiente
export function ambientLight() {
  const m = G.map;
  if (m && m.interior) return { dark: m.dark, tint: '#0a0814' };
  const h = G.hour;
  let dark, tint = '#0c1430';
  if (h < 4.5 || h >= 21.5) dark = 0.78;
  else if (h < 7) { dark = 0.78 * (1 - (h - 4.5) / 2.5); tint = '#2a1838'; }
  else if (h < 17.5) dark = 0;
  else if (h < 19.5) { dark = ((h - 17.5) / 2) * 0.35; tint = '#3a1a2a'; }
  else { dark = 0.35 + ((h - 19.5) / 2) * 0.43; }
  const w = G.weatherState;
  dark = Math.min(0.9, dark + w.rain * 0.12 + w.storm * 0.18 + w.fog * 0.05 + w.ash * 0.1);
  return { dark, tint };
}
// tom de cor (por do sol/amanhecer) aplicado sobre a cena
export function colorGrade() {
  const h = G.hour;
  if (G.map && G.map.interior) return null;
  if (h > 16.5 && h < 19.8) return { color: '#ff8a3a', a: Math.sin(((h - 16.5) / 3.3) * Math.PI) * 0.14 };
  if (h > 5 && h < 7.5) return { color: '#ff9ac0', a: Math.sin(((h - 5) / 2.5) * Math.PI) * 0.1 };
  return null;
}

let changeT = 0, lightningT = 5;
export function updateWeather(dt) {
  const p = G.player; if (!p) return;
  const w = G.weatherState;
  const reg = G.map && !G.map.interior ? G.map.regionAtPx(p.x, p.y) : null;
  changeT -= dt;
  if (G.weatherForce) G.weatherTarget = G.weatherForce;
  else if (changeT <= 0 || G.lastReg !== reg) {
    if (changeT <= 0) changeT = 120 + Math.random() * 180;
    G.lastReg = reg;
    const R = reg != null ? REGIONS[reg] : null;
    const t = { rain: 0, snow: 0, ash: 0, fog: 0, storm: 0, wind: 0.2 };
    if (R) {
      const W = R.weather;
      if (W.snow) t.snow = Math.random() < 0.7 ? W.snow : 0.2;
      if (W.ash) t.ash = W.ash;
      if (W.rain && Math.random() < W.rain) { t.rain = 0.6 + Math.random() * 0.4; if (Math.random() < 0.25) t.storm = 1; }
      if (W.fog && (Math.random() < W.fog || G.hour < 8)) t.fog = 0.3 + Math.random() * 0.5;
      t.wind = (W.wind || 0.2) + t.storm * 0.6;
      if (W.leaves) t.leaves = 1;
    }
    G.weatherTarget = t;
  }
  const T0 = G.weatherTarget;
  for (const k of ['rain', 'snow', 'ash', 'fog', 'storm', 'wind']) w[k] += ((T0[k] || 0) - w[k]) * Math.min(1, dt * 0.25);
  w.leaves = T0.leaves || 0;
  const inside = G.map && G.map.interior;
  // relâmpagos
  if (w.storm > 0.5 && !inside) {
    lightningT -= dt;
    if (lightningT <= 0) { lightningT = 4 + Math.random() * 10; G.weather.flash = 1; setTimeout(() => audio.sfx('thunder'), 300 + Math.random() * 900); }
  }
  // ambiência sonora
  const night = isNight();
  const reg2 = reg ?? -1;
  let water = 0, sea = 0;
  if (!inside && G.map) {
    const m = G.map; let wc = 0;
    for (let i = 0; i < 12; i++) { const t = m.tileAtPx(p.x + (Math.random() - 0.5) * 220, p.y + (Math.random() - 0.5) * 160); if (t === 5 || t === 6 || t === 7) wc++; }
    water = wc / 12; sea = reg2 === 5 ? water * 1.5 : 0;
  }
  audio.setAmbience({
    rain: inside ? w.rain * 0.25 : w.rain, wind: inside ? 0.05 : w.wind * 0.7 + w.snow * 0.3, water: inside ? 0 : water, sea,
    fire: inside && G.map.dark < 0.5 ? 0.5 : 0, birds: !inside && !night && reg2 !== 4 && w.rain < 0.3 ? 0.5 : 0, night: !inside && night && reg2 !== 6 ? 0.6 : 0,
    drip: G.map && G.map.interior && G.map.dark > 0.6 ? 1 : 0, crows: reg2 === 3 || reg2 === 7 ? 1 : 0,
  });
}
