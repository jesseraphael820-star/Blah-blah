// Fishing: stand on a shore facing water, cast, wait for a bite, then a timing
// mini-game (tap when the needle is in the green zone). Fish depend on the
// spot (lake / stream / sea), the time of day, the weather and fishing skill.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { t } from '../core/i18n.js';
import { STREAM } from '../data/world.js';

// rarity weights are adjusted by skill; night/rain/stream filters
export const FISH = {
  minnow:     { rar: 'common',    w: 30, sell: 4,   heal: 8,  xp: 4,  diff: 0.8 },
  perch:      { rar: 'common',    w: 26, sell: 7,   heal: 14, xp: 6,  diff: 1.0 },
  carp:       { rar: 'common',    w: 18, sell: 10,  heal: 18, xp: 8,  diff: 1.1, spot: 'lake' },
  trout:      { rar: 'rare',      w: 16, sell: 22,  heal: 26, xp: 14, diff: 1.35, spot: 'stream' },
  catfish:    { rar: 'rare',      w: 12, sell: 28,  heal: 30, xp: 16, diff: 1.4, night: true },
  salmon:     { rar: 'rare',      w: 10, sell: 34,  heal: 34, xp: 18, diff: 1.5, rain: true },
  goldfish:   { rar: 'epic',      w: 5,  sell: 90,  heal: 20, xp: 32, diff: 1.75 },
  glowfish:   { rar: 'epic',      w: 5,  sell: 110, heal: 30, energy: 30, xp: 36, diff: 1.8, night: true },
  pike_king:  { rar: 'legendary', w: 1.6, sell: 320, heal: 80, xp: 80, diff: 2.2 },
  aurora_koi: { rar: 'magic',     w: 0.5, sell: 900, heal: 200, energy: 100, xp: 160, diff: 2.6, night: true },
};
const JUNK = ['old_boot', 'seaweed'];
const RAR_BOOST = { common: 0, rare: 0.06, epic: 0.1, legendary: 0.14, magic: 0.18 };
const NEED = { common: 2, rare: 3, epic: 3, legendary: 4, magic: 5 };

export class Fishing {
  constructor() {
    this.state = 'idle'; // idle | cast | wait | bite | reel | done
    this.T = 0;
    this.spot = null;
    const s = G.state;
    s.fishing ||= { caught: {}, total: 0, best: null, lvl: 1, xp: 0 };
    // bobber + line
    this.bob = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.22), new THREE.MeshLambertMaterial({ color: 0xe03a3a }));
    const wht = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.2), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    red.position.y = 0.07; wht.position.y = -0.05;
    this.bob.add(red, wht); this.bob.visible = false;
    this.lineGeo = new THREE.BufferGeometry();
    this.lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 12), 3));
    this.line = new THREE.Line(this.lineGeo, new THREE.LineBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.8 }));
    this.line.frustumCulled = false; this.line.visible = false;
    G.scene.add(this.bob, this.line);
    // rod mesh (attached to the player's hand while fishing)
    this.rod = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.6, 0.06), new THREE.MeshLambertMaterial({ color: 0x8a6a3a }));
    stick.position.y = 1.1;
    const reel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), new THREE.MeshLambertMaterial({ color: 0x4a4f58 }));
    reel.position.set(0.06, 0.25, 0);
    this.rodTip = new THREE.Object3D(); this.rodTip.position.y = 2.4;
    this.rod.add(stick, reel, this.rodTip);
    this.rod.rotation.x = 0.9;
    this.tmp = new THREE.Vector3();
    this.buildUI();
    G.world.addInteractable({
      kind: 'fishing', x: 0, y: 0, z: 0, r: 2, dynamic: true,
      pos: () => G.player.pos,
      label: () => '🎣 ' + t('fish.cast'),
      can: () => this.state === 'idle' && !!this.findSpot(),
      act: () => this.start(),
    });
  }

  buildUI() {
    const d = document.createElement('div');
    d.id = 'fishui'; d.className = 'hidden';
    d.innerHTML = `<div class="fish-title"></div><div class="fish-bar"><div class="fish-zone"></div><div class="fish-needle"></div></div><div class="fish-pips"></div><div class="fish-hint"></div>`;
    document.body.appendChild(d);
    this.ui = d;
    d.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.tap(); });
  }

  // a point ~3.5 units ahead in deep enough water, while standing on dry ground
  findSpot() {
    const P = G.player;
    if (P.swimming || P.mounted || !P.onGround || P.dead || G.sky.indoor || G.sky.underground) return null;
    const ph = G.physics;
    for (const d of [3, 4.5, 6]) {
      const x = P.pos.x + Math.sin(P.yaw) * d, z = P.pos.z + Math.cos(P.yaw) * d;
      const w = ph.waterLevel(x, z);
      if (w < -100) continue;
      if (w - ph.terrainHeight(x, z) > 0.6 && P.pos.y > w - 0.3) {
        const stream = x > STREAM.x0 && x < STREAM.x1 && z > STREAM.z0 && z < STREAM.z1;
        const sea = Math.hypot(x, z) > 260;
        return { x, z, y: w, kind: stream ? 'stream' : sea ? 'sea' : 'lake' };
      }
    }
    return null;
  }

  start() {
    this.spot = this.findSpot();
    if (!this.spot) return;
    const P = G.player;
    P.sneaking = false;
    this.startPos = P.pos.clone();
    this.state = 'cast'; this.T = 0;
    this.attachRod(true);
    G.audio.sfx('swing');
    this.wait = 2 + Math.random() * 5 * (G.weather?.wet > 0.3 ? 0.7 : 1);
  }

  attachRod(on) {
    const m = G.player.model;
    if (on) { m.handR.add(this.rod); if (m.sword) m.sword.visible = false; }
    else { m.handR.remove(this.rod); if (m.sword) m.sword.visible = true; }
  }

  pick() {
    const night = G.state.world.time < 5.5 || G.state.world.time > 19.5;
    const rain = (G.weather?.wet || 0) > 0.3;
    const lvl = G.state.fishing.lvl;
    if (Math.random() < 0.07) return Math.random() < 0.35 ? 'treasure' : JUNK[(Math.random() * JUNK.length) | 0];
    const pool = [];
    let sum = 0;
    for (const [id, f] of Object.entries(FISH)) {
      if (f.night && !night) continue;
      if (f.spot && f.spot !== this.spot.kind) continue;
      let w = f.w * (1 + lvl * RAR_BOOST[f.rar]);
      if (f.rain && rain) w *= 2.5; else if (f.rain) w *= 0.4;
      if (this.spot.kind === 'sea' && f.rar !== 'common') w *= 1.3;
      pool.push([id, w]); sum += w;
    }
    let r = Math.random() * sum;
    for (const [id, w] of pool) { if ((r -= w) <= 0) return id; }
    return 'minnow';
  }

  tap() {
    if (this.state === 'bite') {
      this.catchId = this.pick();
      const f = FISH[this.catchId];
      this.need = f ? NEED[f.rar] : 1;
      this.hits = 0; this.miss = 0;
      this.speed = f ? 1.1 * f.diff : 0.9;
      this.zoneW = Math.max(0.12, 0.3 - (f ? f.diff * 0.06 : 0) + G.state.fishing.lvl * 0.008);
      this.newZone();
      this.needle = 0; this.dir = 1;
      this.state = 'reel'; this.T = 0;
      G.audio.sfx('click');
      this.showUI();
    } else if (this.state === 'reel') {
      const inZone = this.needle >= this.zone && this.needle <= this.zone + this.zoneW;
      if (inZone) {
        this.hits++; G.audio.sfx('blip'); G.water.ripple(this.bob.position.x, this.bob.position.z, 1, 0.5);
        if (this.hits >= this.need) return this.finish(true);
        this.newZone(); this.speed *= 1.08;
      } else {
        this.miss++; G.audio.sfx('error');
        if (this.miss >= 3) return this.finish(false);
      }
      this.showUI();
    } else if (this.state === 'wait' || this.state === 'cast') {
      this.cancel(true); // reeled in too early
    }
  }

  newZone() { this.zone = 0.05 + Math.random() * (0.9 - this.zoneW); }

  showUI() {
    const u = this.ui;
    u.classList.remove('hidden');
    const id = this.catchId;
    const f = FISH[id];
    u.querySelector('.fish-title').textContent = this.state === 'reel' ? (f ? '🐟 ' + t('fish.reel') : '❔ ' + t('fish.reel')) : '';
    const z = u.querySelector('.fish-zone');
    z.style.left = this.zone * 100 + '%'; z.style.width = this.zoneW * 100 + '%';
    u.querySelector('.fish-pips').innerHTML = '🟢'.repeat(this.hits) + '⚪'.repeat(Math.max(0, this.need - this.hits)) + '  ' + '❌'.repeat(this.miss);
    u.querySelector('.fish-hint').textContent = t(G.touch ? 'fish.hintTouch' : 'fish.hint');
  }

  finish(ok) {
    const id = this.catchId;
    this.ui.classList.add('hidden');
    G.audio.sfx('splash');
    G.water.splash(this.bob.position.x, this.bob.position.z, 0.6);
    if (ok) {
      const S = G.state.fishing;
      if (id === 'treasure') {
        const gold = 40 + ((Math.random() * 120) | 0);
        G.prog.addGold(gold, { source: 'fish' });
        if (Math.random() < 0.3) G.inv.add('crystal');
        G.ui.toast('💰 ' + t('fish.treasure', { n: gold }), 'gold');
        G.audio.sfx('chest');
      } else {
        G.inv.add(id);
        const f = FISH[id];
        if (f) {
          S.caught[id] = (S.caught[id] || 0) + 1; S.total++;
          G.state.ach.stats.fish = (G.state.ach.stats.fish || 0) + 1;
          if (f.rar === 'legendary' || f.rar === 'magic') G.state.ach.stats.fishRare = 1;
          const size = (20 + Math.random() * 40 * f.diff).toFixed(1);
          if (!S.best || +size > S.best.size) S.best = { id, size: +size };
          S.xp += f.xp;
          while (S.xp >= S.lvl * 40) { S.xp -= S.lvl * 40; S.lvl++; G.ui.toast('🎣 ' + t('fish.lvlUp', { n: S.lvl }), 'gold'); G.audio.sfx('levelup'); }
          G.prog.addXP(Math.round(f.xp * 0.6), G.player.pos);
          const name = t('item.' + id + '.name');
          G.ui.toast(`🐟 ${t('fish.caught', { name })} · ${size} cm`, f.rar === 'common' ? 'info' : 'gold');
          if (f.rar !== 'common') G.audio.sfx('achievement');
          else G.audio.sfx('pickup');
          if (f.rar === 'magic' || f.rar === 'legendary') G.particles.burst(this.bob.position.x, this.bob.position.y + 0.5, this.bob.position.z, f.rar === 'magic' ? 0xff7af0 : 0xffb22e, 30, 5);
        } else {
          G.ui.toast('🥾 ' + t('fish.junk', { name: t('item.' + id + '.name') }), 'info');
        }
      }
    } else {
      G.ui.toast('💨 ' + t('fish.escaped'), 'warn');
    }
    this.state = 'done'; this.T = 0;
  }

  cancel(early) {
    if (early) G.ui.toast(t('fish.early'), 'warn');
    this.ui.classList.add('hidden');
    this.state = 'done'; this.T = 0.4;
  }

  update(dt) {
    const P = G.player;
    if (this.state === 'idle') return;
    this.T += dt;
    if (this.state !== 'done') {
      const moved = this.startPos && Math.hypot(P.pos.x - this.startPos.x, P.pos.z - this.startPos.z) > 0.6;
      if (moved || P.dead || P.state === 'hurt' || P.swimming || P.mounted) { this.cancel(false); return; }
      // the tap / interact / attack button pulls the line
      if (G.input.consume('interact') || G.input.consume('attack')) this.tap();
    }
    const sp = this.spot;
    // rod tip world position
    this.rod.updateMatrixWorld(true);
    const tip = this.rodTip.getWorldPosition(this.tmp);
    let bx = sp.x, bz = sp.z, by = sp.y + 0.05;
    if (this.state === 'cast') {
      const k = Math.min(1, this.T / 0.7);
      bx = tip.x + (sp.x - tip.x) * k; bz = tip.z + (sp.z - tip.z) * k;
      by = tip.y + (sp.y - tip.y) * k + Math.sin(k * Math.PI) * 2.2;
      if (k >= 1) { this.state = 'wait'; this.T = 0; G.water.splash(sp.x, sp.z, 0.3); G.audio.sfx('splash', { vol: 0.4 }); }
    } else if (this.state === 'wait') {
      by += Math.sin(this.T * 2.5) * 0.04;
      if (Math.random() < dt * 0.6) G.water.ripple(sp.x, sp.z, 0.6, 0.3);
      if (this.T > this.wait * 0.7 && Math.random() < dt * 3) by -= 0.08; // nibble
      if (this.T > this.wait) {
        this.state = 'bite'; this.T = 0;
        G.audio.sfx('blip'); G.audio.sfx('splash', { vol: 0.5 });
        G.water.ripple(sp.x, sp.z, 1.4, 0.7);
        G.ui.toast('❗ ' + t('fish.bite'), 'gold');
      }
    } else if (this.state === 'bite') {
      by -= 0.25 + Math.sin(this.T * 30) * 0.08;
      if (this.T > 1.1) { G.ui.toast('💨 ' + t('fish.missed'), 'warn'); this.state = 'done'; this.T = 0; }
    } else if (this.state === 'reel') {
      by -= 0.15 + Math.sin(this.T * 18) * 0.06;
      bx += Math.sin(this.T * 3) * 0.3; bz += Math.cos(this.T * 2.3) * 0.3;
      this.needle += this.dir * dt * this.speed;
      if (this.needle > 1) { this.needle = 1; this.dir = -1; }
      if (this.needle < 0) { this.needle = 0; this.dir = 1; }
      this.ui.querySelector('.fish-needle').style.left = this.needle * 100 + '%';
      if (Math.random() < dt * 4) G.water.ripple(bx, bz, 0.7, 0.4);
    } else if (this.state === 'done') {
      const k = Math.min(1, this.T / 0.5);
      bx = sp.x + (tip.x - sp.x) * k; bz = sp.z + (tip.z - sp.z) * k; by = sp.y + (tip.y - sp.y) * k;
      if (this.T > 0.6) { this.state = 'idle'; this.attachRod(false); this.bob.visible = false; this.line.visible = false; this.ui.classList.add('hidden'); return; }
    }
    this.bob.position.set(bx, by, bz);
    this.bob.visible = true; this.line.visible = true;
    // sagging line from tip to bobber
    const a = this.lineGeo.attributes.position;
    const sag = this.state === 'reel' || this.state === 'bite' ? 0.1 : 0.8;
    for (let i = 0; i < 12; i++) {
      const k = i / 11;
      a.setXYZ(i, tip.x + (bx - tip.x) * k, tip.y + (by - tip.y) * k - Math.sin(k * Math.PI) * sag, tip.z + (bz - tip.z) * k);
    }
    a.needsUpdate = true;
    // face the water while fishing
    if (this.state !== 'done') P.yaw += Math.atan2(Math.sin(Math.atan2(sp.x - P.pos.x, sp.z - P.pos.z) - P.yaw), Math.cos(Math.atan2(sp.x - P.pos.x, sp.z - P.pos.z) - P.yaw)) * Math.min(1, dt * 6);
  }

  get active() { return this.state !== 'idle'; }
}
