// Retro Fantasy: a rare magical "weather" inspired by 80s/90s retro fantasy and
// synthwave art: a neon sunset sky (magenta, violet and teal), a giant striped
// retro sun on the horizon, pastel sparkles and petals in the air and a soft VHS
// glow. While it lasts, people (villagers, adventurers and the hero) glow and
// become stronger and calmer; enemies are not affected. You also get a medium
// Gold bonus that day.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { t } from '../core/i18n.js';

const DURATION = 7; // game hours
const CHANCE = 0.2; // per day, rolled at dawn
const SKY = { top: 0x2a0b5e, hor: 0xff5fa8, bot: 0x1a8a9a, fog: 0x8a4a9a, amb: 0xd8a0ff, gnd: 0x3a5a8a, sun: 0xffa0c8 };
const SKY_NIGHT = { top: 0x0e0428, hor: 0xb02a8a, bot: 0x0a2a4a, fog: 0x3a1a5a, amb: 0x8a6ad8, gnd: 0x1a2a4a, sun: 0x9a7aff };
const PASTELS = [0xff8ad8, 0x8af0ff, 0xfff08a, 0xc89aff, 0x8affc8];

export class RetroFantasy {
  constructor() {
    this.k = 0; // blend 0..1
    this.T = 0;
    this.lastRolledDay = G.state.world.retroRolled || 0;
    this.overlay = document.createElement('div');
    this.overlay.id = 'retro-fx';
    document.body.appendChild(this.overlay);
    // re-tint the sky right after it updates every frame
    const sky = G.sky, orig = sky.update.bind(sky);
    sky.update = (...a) => { orig(...a); this.applySky(); };
  }

  get active() { const r = G.state.world.retro; return !!r && G.prog.hours() < r.until; }

  start(silent) {
    G.state.world.retro = { until: G.prog.hours() + DURATION };
    if (silent) return;
    const bonus = 120 + Math.floor(Math.random() * 140);
    G.ui.banner(`<small>${t('retro.sub')}</small><b class="retro-title">✦ RETRO FANTASY ✦</b><em>${t('retro.desc')}</em>`, 'retro', 6);
    G.audio.sfx('retro');
    setTimeout(() => { if (G.prog) { G.prog.addGold(bonus, { source: 'retro' }); G.ui.toast('🌆 ' + t('retro.bonus', { n: bonus }), 'gold'); } }, 1800);
    G.state.ach.stats.retro = (G.state.ach.stats.retro || 0) + 1;
  }

  applySky() {
    const k = this.k;
    if (k <= 0.001 || G.sky.underground) return;
    const S = G.sky, u = S.uniforms, n = S.night;
    const pick = (key) => new THREE.Color(SKY[key]).lerp(new THREE.Color(SKY_NIGHT[key]), n);
    u.uTop.value.lerp(pick('top'), k * 0.85);
    u.uHorizon.value.lerp(pick('hor'), k * 0.8);
    u.uBottom.value.lerp(pick('bot'), k * 0.7);
    S.fogColor.lerp(pick('fog'), k * 0.6);
    S.horizonColor.copy(u.uHorizon.value);
    S.hemi.color.lerp(pick('amb'), k * 0.45);
    S.hemi.groundColor.lerp(pick('gnd'), k * 0.4);
    S.sun.color.lerp(pick('sun'), k * 0.5);
    S.lightLevel.lerp(new THREE.Color(0xe0b0ff), k * 0.25);
  }

  update(dt) {
    this.T += dt;
    const W = G.state.world;
    // roll once a day at dawn (never two days in a row)
    if (W.time > 6 && W.time < 7 && this.lastRolledDay !== W.day) {
      this.lastRolledDay = W.day; W.retroRolled = W.day;
      const yesterday = W.retro && W.retro.until > (W.day - 1) * 24;
      if (!this.active && !yesterday && Math.random() < CHANCE) this.start();
    }
    const on = this.active && !G.sky.indoor;
    this.k += ((on && !G.sky.underground ? 1 : 0) - this.k) * Math.min(1, dt * 0.6);
    document.body.classList.toggle('retro', this.k > 0.05);
    this.overlay.style.opacity = (this.k * (G.sky.underground ? 0.3 : 1)).toFixed(3);
    // giant striped sun drawn by the sky dome, low on the horizon in the sun's direction
    const u = G.sky.uniforms, sd = G.sky.sunDir;
    u.uRetro.value = G.sky.underground ? 0 : this.k * (1 - G.sky.night * 0.3);
    const l = Math.hypot(sd.x, sd.z) || 1;
    u.uRetroDir.value.set(sd.x / l, 0.24, sd.z / l);
    if (this.k < 0.05) return;
    // pastel sparkles and petals in the air around the hero
    const P = G.player.pos;
    const rate = (G.mobile ? 10 : 22) * this.k;
    for (let i = 0; i < 2; i++) if (Math.random() < dt * rate) {
      const x = P.x + (Math.random() - 0.5) * 30, z = P.z + (Math.random() - 0.5) * 30;
      const y = G.physics.terrainHeight(x, z) + 0.5 + Math.random() * 5;
      const c = PASTELS[(Math.random() * PASTELS.length) | 0];
      if (Math.random() < 0.6) G.particles.glow.spawn(x, y, z, (Math.random() - 0.5) * 0.4, 0.3 + Math.random() * 0.4, (Math.random() - 0.5) * 0.4, c, 0.1 + Math.random() * 0.08, 2.5);
      else G.particles.solid.spawn(x, y + 3, z, (G.weather?.wind || 1) * 0.6, -0.5, 0.3, Math.random() < 0.5 ? 0xffb0d8 : 0xffe0f0, 0.1, 4, { drag: 0.4 });
    }
    // people shine: a soft pastel glow around villagers, adventurers and the hero
    const people = [G.player, ...(G.entities.npcs?.list || []), ...(G.adventurers?.list || [])];
    for (const p of people) {
      const pos = p.pos; if (!pos) continue;
      if (Math.abs(pos.x - P.x) > 40 || Math.abs(pos.z - P.z) > 40) continue;
      if (Math.random() < dt * 2.2) {
        const c = PASTELS[(Math.random() * PASTELS.length) | 0];
        G.particles.glow.spawn(pos.x + (Math.random() - 0.5) * 1.1, pos.y + 0.3 + Math.random() * 1.2, pos.z + (Math.random() - 0.5) * 1.1, 0, 0.5, 0, c, p === G.player ? 0.05 : 0.08, 1.2);
      }
      // calm and happy faces
      const m = p.model || p.m;
      if (m && p !== G.player && m.face && m.face.expr === 'neutral' && Math.random() < dt * 0.5) m.setExpression?.('happy');
    }
  }

  // multipliers used by other systems
  get mult() { return this.active ? 1 : 0; }
}
