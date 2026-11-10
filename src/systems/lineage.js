// Altar of Lineages (in the Ruins): pay an offering and attempt to awaken a
// genetics. The rarer it is, the lower the chance. On success the hero takes
// that lineage: power bonus, visual features, an aura for the strongest ones
// and a cinematic awakening.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { t } from '../core/i18n.js';
import { LOC } from '../data/world.js';
import { GENES } from './adventurers.js';
import { GeneAura, AURA } from '../render/auras.js';

// chance (0..1), Gold cost, extra material
export const TRIALS = {
  beast:     { chance: 0.45, gold: 150,  mat: ['wolf_pelt', 2] },
  ghost:     { chance: 0.30, gold: 300,  mat: ['glowshroom', 3] },
  magic:     { chance: 0.28, gold: 350,  mat: ['essence', 1] },
  tech:      { chance: 0.24, gold: 450,  mat: ['iron_ore', 4] },
  elemental: { chance: 0.20, gold: 550,  mat: ['crystal', 2] },
  shadow:    { chance: 0.15, gold: 750,  mat: ['essence', 2] },
  dragon:    { chance: 0.09, gold: 1200, mat: ['stone_core', 1] },
  angel:     { chance: 0.06, gold: 1600, mat: ['stardust', 1] },
  ancestral: { chance: 0.025, gold: 2500, mat: ['stardust', 2] },
};
// visual features the hero gets with each lineage
export const GENE_FEATURES = {
  beast: { ears: true }, ghost: { ghost: true, glow: 0x9ad8ff }, magic: { glow: 0xb66cff }, tech: { visor: true },
  elemental: { glow: 0xff7a2a }, shadow: { glow: 0x6a2a8a }, dragon: { horns: true }, angel: { halo: true, glow: 0xffe8a0 },
  ancestral: { crownGlow: true, glow: 0xffc83a, eyeGold: true },
};
export function playerGene() { return G.state.player.gene || 'aurora'; }
export function geneMult() { const g = G.state.player.gene; return g && GENES[g] ? GENES[g].mult : 1; }

export class Lineage {
  constructor() {
    this.busy = false;
    this.pos = this.findSpot();
    this.build();
    G.world.addInteractable({
      kind: 'altar', x: this.pos.x, y: this.pos.y, z: this.pos.z, r: 3.2,
      label: () => '🧬 ' + t('lin.altar'),
      can: () => !this.busy,
      act: () => this.open(),
    });
    this.applyAura();
  }

  findSpot() {
    const ph = G.physics, c = LOC.ruins;
    for (let r = 0; r < 20; r += 1.5) for (let a = 0; a < 6.28; a += 0.5) {
      const x = c.x + Math.sin(a) * r, z = c.z + 8 + Math.cos(a) * r;
      const gy = ph.groundAt(x, z, 200), th = ph.terrainHeight(x, z);
      let ok = Math.abs(gy - th) < 0.05;
      for (let k = 0; k < 8 && ok; k++) { const ax = x + Math.sin(k) * 2.6, az = z + Math.cos(k) * 2.6; if (Math.abs(ph.groundAt(ax, az, 200) - th) > 0.05 || Math.abs(ph.terrainHeight(ax, az) - th) > 0.05) ok = false; }
      if (ok) return new THREE.Vector3(x, th, z);
    }
    return new THREE.Vector3(c.x, ph.terrainHeight(c.x, c.z), c.z);
  }

  build() {
    const g = this.g = new THREE.Group();
    const p = this.pos;
    g.position.copy(p);
    const stone = new THREE.MeshLambertMaterial({ color: 0x8a8478 }), dark = new THREE.MeshLambertMaterial({ color: 0x5a564e });
    const box = (sx, sy, sz, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; g.add(b); return b; };
    box(4.4, 0.4, 4.4, 0, 0.2, 0, dark);
    box(3.4, 0.4, 3.4, 0, 0.6, 0, stone);
    box(1.4, 1.1, 1.4, 0, 1.35, 0, dark);
    box(1.8, 0.2, 1.8, 0, 1.95, 0, stone);
    this.runes = [];
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2, x = Math.sin(a) * 2.1, z = Math.cos(a) * 2.1;
      box(0.45, 3 + (i % 2) * 0.6, 0.45, x, 1.7 + (i % 2) * 0.3, z, stone);
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.05), new THREE.MeshBasicMaterial({ color: 0x7affc8, transparent: true }));
      r.position.set(x * 1.12, 2.2, z * 1.12); r.lookAt(x * 3, 2.2, z * 3);
      g.add(r); this.runes.push(r);
    }
    // floating lineage crystal
    this.crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial({ color: 0x7affc8, transparent: true, opacity: 0.9 }));
    this.crystal.position.y = 3;
    this.crystalCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.crystal.add(this.crystalCore);
    g.add(this.crystal);
    G.scene.add(g);
    G.physics.addBox(p.x - 0.7, p.y, p.z - 0.7, p.x + 0.7, p.y + 2.05, p.z + 0.7, 'altar');
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; G.physics.addCyl(p.x + Math.sin(a) * 2.1, p.z + Math.cos(a) * 2.1, 0.32, p.y, p.y + 4, 'altar'); }
    this.T = 0;
  }

  update(dt) {
    this.T += dt;
    const P = G.player;
    if (this.ritual && this.ritual.src) this.updateRitual(dt);
    if (Math.abs(P.pos.x - this.pos.x) > 140 || Math.abs(P.pos.z - this.pos.z) > 140) { if (this.aura) this.aura.update(dt); return; }
    const c = this.crystal;
    c.rotation.y += dt * (this.busy ? 6 : 0.8);
    c.position.y = 3 + Math.sin(this.T * 1.6) * 0.15 + (this.busy ? 0.6 : 0);
    const col = this.ritual ? this.ritual.color : 0x7affc8;
    c.material.color.setHex(col);
    for (const r of this.runes) { r.material.color.setHex(col); r.material.opacity = 0.5 + Math.sin(this.T * 3 + r.position.x) * 0.4; }
    if (Math.random() < dt * 5) G.particles.glow.spawn(this.pos.x + (Math.random() - 0.5) * 3, this.pos.y + 0.5, this.pos.z + (Math.random() - 0.5) * 3, 0, 1 + Math.random(), 0, col, 0.15, 1.8);
    if (this.ritual && !this.ritual.src) this.updateRitual(dt);
    if (this.aura) this.aura.update(dt);
  }

  // ---------- menu ----------
  open() {
    const cur = playerGene();
    const list = Object.entries(TRIALS).map(([id, tr]) => {
      const g = GENES[id];
      const have = G.inv.count(tr.mat[0]) >= tr.mat[1];
      const gold = G.state.player.gold >= tr.gold;
      const mine = cur === id;
      return `<button class="lin-row ${mine ? 'mine' : ''}" data-g="${id}" ${mine ? 'disabled' : ''}>
        <span class="lin-ic">${g.icon}</span>
        <span class="lin-name"><b style="color:${g.color}">${t('gene.' + id)}</b><small>+${Math.round((g.mult - 1) * 100)}% ${t('lin.power')}</small></span>
        <span class="lin-chance"><i style="width:${tr.chance * 100}%"></i><em>${(tr.chance * 100).toFixed(tr.chance < 0.1 ? 1 : 0)}%</em></span>
        <span class="lin-cost ${gold ? '' : 'bad'}">🪙 ${tr.gold}</span>
        <span class="lin-cost ${have ? '' : 'bad'}">${t('item.' + tr.mat[0] + '.name')} ×${tr.mat[1]}</span>
      </button>`;
    }).join('');
    const d = document.createElement('div');
    d.className = 'overlay lineage';
    d.innerHTML = `<div class="ov-inner lin-box"><h2>🧬 ${t('lin.altar')}</h2><p class="lin-intro">${t('lin.intro')}</p>
      <p class="lin-cur">${t('lin.current')}: <b>${cur === 'aurora' ? '🌅 ' + t('gene.aurora') : GENES[cur].icon + ' ' + t('gene.' + cur)}</b></p>
      <div class="lin-list">${list}</div><button class="btn lin-close">${t('lin.close')}</button></div>`;
    document.body.appendChild(d);
    G.ui.overlay = 'lineage';
    G.input.unlock?.();
    G.audio.sfx('open');
    const close = () => { d.remove(); if (G.ui.overlay === 'lineage') G.ui.overlay = null; };
    d.querySelector('.lin-close').onclick = () => { G.audio.sfx('close'); close(); };
    d.querySelectorAll('.lin-row').forEach((b) => b.onclick = () => {
      const id = b.dataset.g, tr = TRIALS[id];
      if (G.state.player.gold < tr.gold || G.inv.count(tr.mat[0]) < tr.mat[1]) { G.audio.sfx('error'); G.ui.toast(t('lin.cant'), 'warn'); return; }
      close();
      this.attempt(id);
    });
  }

  // ---------- ritual ----------
  attempt(id) {
    const tr = TRIALS[id];
    G.prog.spendGold(tr.gold);
    G.inv.remove(tr.mat[0], tr.mat[1]);
    G.state.ach.stats.lineageTries = (G.state.ach.stats.lineageTries || 0) + 1;
    const ok = Math.random() < tr.chance;
    const col = parseInt(GENES[id].color.slice(1), 16);
    this.busy = true;
    this.ritual = { id, ok, t: 0, color: col, dur: 4.2 };
    G.audio.sfx('orb');
    G.ui.banner(`<small>${t('lin.ritual')}</small><b>${GENES[id].icon} ${t('gene.' + id)}</b>`, 'gold', 3.8);
  }

  // a friend shares their lineage with the hero (asked through dialogue)
  shareFrom(adv, ok) {
    const id = adv.gene;
    this.busy = true;
    this.ritual = { id, ok, t: 0, color: parseInt(GENES[id].color.slice(1), 16), dur: 4.2, src: adv, baseY: G.player.pos.y, from: adv.name };
    G.state.ach.stats.lineageTries = (G.state.ach.stats.lineageTries || 0) + 1;
    G.audio.sfx('orb');
    G.ui.banner(`<small>${t('lin.sharing', { name: adv.name })}</small><b>${GENES[id].icon} ${t('gene.' + id)}</b>`, 'gold', 3.8);
  }

  updateRitual(dt) {
    if (this.ritual.src) return this.updateShare(dt);
    const R = this.ritual, P = G.player;
    R.t += dt;
    const k = R.t / R.dur;
    // pull the hero to the altar's step and lift them in the light
    const tx = this.pos.x, tz = this.pos.z + 3.2;
    P.pos.x += (tx - P.pos.x) * Math.min(1, dt * 3); P.pos.z += (tz - P.pos.z) * Math.min(1, dt * 3);
    P.yaw = Math.atan2(this.pos.x - P.pos.x, this.pos.z - P.pos.z);
    P.hv.x = 0; P.hv.z = 0;
    P.vy = 0;
    P.pos.y = this.pos.y + Math.sin(Math.min(1, k) * Math.PI) * 1.4;
    // energy streams from the crystal spiralling into the hero
    for (let i = 0; i < 4; i++) {
      const a = R.t * 5 + i * 1.57, rr = 1.6 * (1 - (R.t % 1));
      G.particles.glow.spawn(P.pos.x + Math.sin(a) * rr, P.pos.y + 0.4 + (R.t * 2 % 2.4), P.pos.z + Math.cos(a) * rr, 0, 0.6, 0, R.color, 0.2, 0.7);
    }
    if (Math.random() < dt * 10) {
      const c = this.crystal.getWorldPosition(new THREE.Vector3());
      G.particles.glow.spawn(c.x, c.y, c.z, (P.pos.x - c.x) * 1.8, (P.pos.y + 1 - c.y) * 1.8, (P.pos.z - c.z) * 1.8, R.color, 0.25, 0.55);
    }
    if (!R.tick || R.t - R.tick > 0.45) { R.tick = R.t; G.audio.sfx('blip'); G.cam.shake(0.05 + k * 0.12); }
    if (R.t >= R.dur) this.resolve();
  }

  updateShare(dt) {
    const R = this.ritual, P = G.player, A = R.src;
    R.t += dt;
    const k = R.t / R.dur;
    P.yaw = Math.atan2(A.pos.x - P.pos.x, A.pos.z - P.pos.z);
    A.yaw = Math.atan2(P.pos.x - A.pos.x, P.pos.z - A.pos.z);
    A.atkT = 0.3; // casting pose
    P.hv.x = 0; P.hv.z = 0; P.vy = 0;
    P.pos.y = R.baseY + Math.sin(Math.min(1, k) * Math.PI) * 1.1;
    // a stream of lineage energy flows from the friend into the hero
    for (let i = 0; i < 3; i++) if (Math.random() < dt * 14) {
      const sx = A.pos.x, sy = A.pos.y + 1.3, sz = A.pos.z;
      G.particles.glow.spawn(sx, sy, sz, (P.pos.x - sx) * 1.9, (P.pos.y + 1 - sy) * 1.9 + 0.6, (P.pos.z - sz) * 1.9, R.color, 0.18, 0.5);
    }
    for (let i = 0; i < 3; i++) { const a = R.t * 5 + i * 2.1, rr = 1.3 * (1 - (R.t % 1)); G.particles.glow.spawn(P.pos.x + Math.sin(a) * rr, P.pos.y + 0.4 + (R.t * 2 % 2.2), P.pos.z + Math.cos(a) * rr, 0, 0.5, 0, R.color, 0.14, 0.6); }
    if (!R.tick || R.t - R.tick > 0.45) { R.tick = R.t; G.audio.sfx('blip'); G.cam.shake(0.04 + k * 0.1); }
    if (R.t >= R.dur) this.resolve();
  }

  resolve() {
    const R = this.ritual, P = G.player;
    this.ritual = null; this.busy = false;
    P.pos.y = G.physics.groundAt(P.pos.x, P.pos.z, P.pos.y + 1);
    if (R.ok) {
      const prev = G.state.player.gene;
      G.state.player.gene = R.id;
      G.state.ach.stats.lineage = Math.max(G.state.ach.stats.lineage || 0, GENES[R.id].mult >= 1.45 ? 2 : 1);
      P.refreshLook();
      this.applyAura();
      G.particles.ring(P.pos.x, P.pos.y + 0.3, P.pos.z, R.color, 7, 70);
      G.particles.burst(P.pos.x, P.pos.y + 1.2, P.pos.z, R.color, 70, 10, { life: 1.6 });
      G.audio.sfx('levelup');
      G.cam.shake(0.5);
      G.ui.banner(`<small>${t('lin.success')}</small><b>${GENES[R.id].icon} ${t('gene.' + R.id)}</b><em>+${Math.round((GENES[R.id].mult - 1) * 100)}% ${t('lin.power')}</em>`, 'gold', 5);
      if (prev !== R.id && this.aura && AURA[R.id]?.tier === 3) setTimeout(() => G.cinematics.start('player', this.aura, { name: G.state.appearance.name, sub: `${GENES[R.id].icon} ${t('gene.' + R.id)} · ${t('lin.awakened')}` }), 1800);
      G.game.save?.();
    } else {
      G.particles.burst(P.pos.x, P.pos.y + 1.2, P.pos.z, 0x5a5a6a, 30, 5, { life: 1 });
      G.particles.smoke?.(P.pos.x, P.pos.y + 1, P.pos.z, 0x666677);
      G.audio.sfx('error');
      G.cam.shake(0.2);
      G.ui.banner(`<small>${t('lin.fail')}</small><b>${t('lin.rejected')}</b><em>${t('lin.tryAgain')}</em>`, 'warn', 4);
    }
  }

  // the hero's own aura when their lineage manifests
  applyAura() {
    if (this.aura) { this.aura.dispose(); this.aura = null; }
    const g = G.state.player.gene;
    if (!g || !AURA[g]) return;
    const P = G.player;
    // the hero's giant spirit and pillar manifest when standing still (or in the awakening cinematic)
    const owner = { pos: P.pos, get model() { return P.model; }, look: P.look(), name: G.state.appearance.name, self: true };
    owner.calm = () => (G.cinematics?.active?.aura === this.aura) || (P.calmT || 0) > 2.5;
    this.aura = new GeneAura(owner, g);
  }
}

// adds the hero's lineage features to a look object
export function withGene(look) {
  const g = G.state?.player?.gene;
  const f = g && GENE_FEATURES[g];
  if (!f) return look;
  const L = { ...look, pal: { ...look.pal } };
  if (f.ears) L.ears = true;
  if (f.ghost) L.ghost = true;
  if (f.visor) L.visor = true;
  if (f.horns) L.horns = true;
  if (f.halo) L.halo = true;
  if (f.crownGlow) L.crownGlow = true;
  if (f.eyeGold) L.pal.eye = 0xffc83a;
  if (f.glow && !L.glow) L.glow = f.glow;
  return L;
}
