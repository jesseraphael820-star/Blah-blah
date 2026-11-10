// Horses: wild horses of five breeds roam the meadows. Taming is a coin flip
// (50% accept / 50% reject): keep trying until the horse accepts you. Tamed
// horses can be ridden — faster the rarer the breed — and riding costs no stamina.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { unitBox, colorMat } from '../render/voxel.js';
import { dampAngle, dist2d, makeRng, shade } from '../core/utils.js';
import { t } from '../core/i18n.js';
import { RARITY } from '../data/items.js';

export const BREEDS = {
  common:    { speed: 11, jump: 10.5, coat: [0x8a5a32, 0x6a4428, 0xa0703a], mane: 0x2a1a10, rarity: 'common', weight: 50 },
  rare:      { speed: 13, jump: 11, coat: [0xd8d4cc, 0x9a9a9a], mane: 0xf0ece4, rarity: 'rare', weight: 26 },
  epic:      { speed: 15.5, jump: 11.5, coat: [0x1e1a24], mane: 0x6a3a9a, rarity: 'epic', weight: 14 },
  legendary: { speed: 18, jump: 12, coat: [0xe8b83a], mane: 0xfff0b0, rarity: 'legendary', weight: 7, glow: 0xffd36a },
  mythic:    { speed: 21, jump: 13, coat: [0x9ad8ff], mane: 0xffffff, rarity: 'magic', weight: 3, glow: 0x7ae8ff, wings: true },
};
const ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'];
const HORSE_SPOTS = [[-20, 150], [70, 110], [120, 30], [-130, 140], [-60, 30], [160, 200], [-170, 200], [200, -40], [90, -130], [-90, -100], [30, 200], [240, 160]];

function bx(p, sx, sy, sz, c, x, y, z, em = 0) {
  const m = new THREE.Mesh(unitBox, colorMat(c, em, em ? 0.7 : 1));
  m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m;
}

function horseModel(breed, coat) {
  const B = BREEDS[breed];
  const g = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 1.15; g.add(body);
  const em = B.glow ? shade(B.glow, 0.25) : 0;
  bx(body, 0.75, 0.75, 1.7, coat, 0, 0, 0, em);
  bx(body, 0.78, 0.3, 0.6, shade(coat, 1.12), 0, -0.2, 0.45, em);
  const neck = new THREE.Group(); neck.position.set(0, 0.25, 0.75); body.add(neck);
  bx(neck, 0.42, 0.85, 0.45, coat, 0, 0.35, 0.12, em).rotation.x = -0.45;
  const head = new THREE.Group(); head.position.set(0, 0.75, 0.42); neck.add(head);
  bx(head, 0.38, 0.38, 0.75, coat, 0, 0, 0.18, em);
  bx(head, 0.32, 0.26, 0.2, shade(coat, 0.75), 0, -0.07, 0.6);
  bx(head, 0.08, 0.08, 0.04, 0x111111, -0.2, 0.06, 0.25); bx(head, 0.08, 0.08, 0.04, 0x111111, 0.2, 0.06, 0.25);
  bx(head, 0.1, 0.2, 0.08, coat, -0.12, 0.25, -0.1); bx(head, 0.1, 0.2, 0.08, coat, 0.12, 0.25, -0.1);
  const mane = bx(neck, 0.14, 0.95, 0.22, B.mane, 0, 0.5, -0.12, B.glow ? B.glow : 0); mane.rotation.x = -0.45;
  const tail = new THREE.Group(); tail.position.set(0, 0.2, -0.85); body.add(tail);
  bx(tail, 0.16, 0.85, 0.16, B.mane, 0, -0.38, -0.1, B.glow ? B.glow : 0);
  const legs = [];
  for (const [x, z] of [[-0.24, 0.62], [0.24, 0.62], [-0.24, -0.62], [0.24, -0.62]]) {
    const l = new THREE.Group(); l.position.set(x, -0.35, z); body.add(l);
    bx(l, 0.18, 0.8, 0.2, coat, 0, -0.4, 0, em);
    bx(l, 0.2, 0.14, 0.22, 0x2a2420, 0, -0.82, 0);
    legs.push(l);
  }
  let wings = null;
  if (B.wings) {
    wings = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(s * 0.38, 0.3, 0.2); body.add(w);
      bx(w, 1.1, 0.06, 0.6, 0xffffff, s * 0.55, 0, 0, B.glow);
      w.userData.s = s; wings.push(w);
    }
  }
  const saddle = new THREE.Group(); body.add(saddle);
  bx(saddle, 0.82, 0.12, 0.6, 0x7a3a1e, 0, 0.42, -0.05);
  bx(saddle, 0.86, 0.36, 0.06, 0x7a3a1e, 0, 0.2, -0.05);
  bx(saddle, 0.3, 0.14, 0.08, 0xd4a83a, 0, 0.52, 0.24);
  saddle.visible = false;
  return { g, body, neck, head, tail, legs, wings, saddle };
}

class Horse {
  constructor(breed, x, z, o = {}) {
    this.breed = breed;
    this.B = BREEDS[breed];
    this.coat = o.coat ?? this.B.coat[Math.floor(Math.random() * this.B.coat.length)];
    this.m = horseModel(breed, this.coat);
    G.scene.add(this.m.g);
    this.pos = new THREE.Vector3(x, G.physics.groundAt(x, z, 200), z);
    this.home = { x, z };
    this.yaw = Math.random() * 6.28;
    this.target = null; this.wait = Math.random() * 3;
    this.phase = 0; this.speed = 0;
    this.rear = 0; this.cool = 0;
    this.owned = !!o.owned;
    this.id = o.id || null;
    this.m.saddle.visible = this.owned;
  }
  // keep the whole horse (head and hindquarters) out of walls, not just its center
  keepBodyClear(pos, yaw, airborne, ox, oz) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (const off of [1.35, -1.05]) {
      const p = { x: pos.x + fx * off, y: pos.y, z: pos.z + fz * off };
      const bx = p.x, bz = p.z;
      G.physics.resolve(p, 0.42, 2.2, airborne ? 0.15 : 1.1);
      pos.x += p.x - bx; pos.z += p.z - bz;
      const gh = G.physics.groundAt(p.x, p.z, pos.y, 0.3, airborne ? 0.15 : 1.1);
      if (gh > pos.y + (airborne ? 0.3 : 1.15) && ox !== undefined) { pos.x = ox; pos.z = oz; }
    }
  }
  // the ground under the horse is a wide floor (bridge, deck), not a thin fence rail
  onSolidFloor() {
    const y = this.pos.y;
    let n = 0;
    for (const [dx, dz] of [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]]) if (Math.abs(G.physics.groundAt(this.pos.x + dx, this.pos.z + dz, y + 0.2) - y) < 0.25) n++;
    return n >= 3;
  }
  // move to the nearest free spot of open ground around (x, z)
  unstick(x, z, nearPlayer) {
    const ph = G.physics;
    for (let r = nearPlayer ? 3 : 1.5; r < 9; r += 1) for (let a = 0; a < 6.28; a += 0.6) {
      const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
      const th = ph.terrainHeight(px, pz), gy = ph.groundAt(px, pz, th + 1.2);
      if (Math.abs(gy - th) > 0.05 || ph.waterLevel(px, pz) > th + 0.5) continue;
      const p = { x: px, y: gy, z: pz };
      ph.resolve(p, 0.7, 2, 1.1);
      if (Math.hypot(p.x - px, p.z - pz) > 0.05) continue;
      this.pos.set(px, gy, pz); this.air = false; this.vy = 0;
      G.particles.dust(px, gy, pz, 6);
      return true;
    }
    return false;
  }
  update(dt, ridden) {
    const P = G.player;
    const dP = dist2d(P.pos.x, P.pos.z, this.pos.x, this.pos.z);
    this.cool = Math.max(0, this.cool - dt);
    if (ridden) {
      this.pos.copy(P.pos); this.yaw = P.yaw; this.speed = P.speedNow;
    } else if (dP > 120) { this.m.g.visible = false; return; }
    else {
      this.m.g.visible = true;
      let move = 0;
      if (this.rear > 0) { this.rear -= dt; }
      else if (this.called) {
        const d = dist2d(P.pos.x, P.pos.z, this.pos.x, this.pos.z);
        if (d > 3.2) { this.yaw = dampAngle(this.yaw, Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z), 8, dt); move = Math.min(this.B.speed, d * 2); }
        else this.called = false;
      } else if (this.fleeT > 0) {
        this.fleeT -= dt;
        this.yaw = dampAngle(this.yaw, Math.atan2(this.pos.x - P.pos.x, this.pos.z - P.pos.z), 6, dt); move = 7;
      } else if (this.target) {
        this.yaw = dampAngle(this.yaw, Math.atan2(this.target.x - this.pos.x, this.target.z - this.pos.z), 4, dt); move = 1.6;
        if (dist2d(this.target.x, this.target.z, this.pos.x, this.pos.z) < 1) { this.target = null; this.wait = 3 + Math.random() * 6; }
      } else if (!this.owned) {
        this.wait -= dt;
        if (this.wait <= 0) { const a = Math.random() * 6.28, r = Math.random() * (this.pen ? 4 : 12); this.target = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r }; }
      }
      if (move > 0) {
        const vx = Math.sin(this.yaw) * move * dt, vz = Math.cos(this.yaw) * move * dt;
        const ox = this.pos.x, oz = this.pos.z;
        let blocked = G.physics.move(this.pos, vx, vz, 0.7, 2, !!this.air);
        if (Math.hypot(this.pos.x - ox, this.pos.z - oz) < move * dt * 0.3) blocked = true;
        if (blocked) this.target = null;
        // a called horse jumps fences on its way to you; if still stuck it trots around
        if (blocked && this.called && !this.air) { this.vy = this.B.jump || 11; this.air = true; this.jumpT = 0; }
        this.stuckT = blocked && this.called ? (this.stuckT || 0) + dt : 0;
        if (this.stuckT > 2.5) { this.stuckT = 0; this.unstick(P.pos.x, P.pos.z, true); }
        if (!this.called && !this.owned && G.physics.waterLevel(this.pos.x, this.pos.z) - G.physics.terrainHeight(this.pos.x, this.pos.z) > 1) { this.pos.x -= vx * 2; this.pos.z -= vz * 2; this.target = null; }
      }
      this.speed = move;
      this.keepBodyClear(this.pos, this.yaw, !!this.air);
      const wl = G.physics.waterLevel(this.pos.x, this.pos.z);
      if (this.air) {
        this.vy -= 28 * dt; this.pos.y += this.vy * dt;
        const g2 = G.physics.groundAt(this.pos.x, this.pos.z, this.pos.y, 0.3, Math.max(0.3, -this.vy * dt + 0.15));
        if (this.pos.y <= g2 && this.vy <= 0) { this.pos.y = g2; this.air = false; this.vy = 0; this.landT = 0.3; G.particles.dust(this.pos.x, g2, this.pos.z, 8); }
      }
      const gy = this.air ? this.pos.y : G.physics.groundAt(this.pos.x, this.pos.z, Math.max(this.pos.y, wl) + 1.2);
      if (!this.air) this.pos.y = wl - gy > 1.2 ? wl - 1.15 : gy; // floats in deep water
      // never left balancing on top of a fence or post
      if (!this.air && gy - G.physics.terrainHeight(this.pos.x, this.pos.z) > 0.5 && !this.onSolidFloor()) this.unstick(this.pos.x, this.pos.z, false);
      // a horse left in deep water swims to the nearest shore by itself
      if (wl - gy > 1.2 && !this.called && move === 0) {
        let best = null;
        for (let a = 0; a < 6.28; a += 0.5) { const x = this.pos.x + Math.sin(a) * 12, z = this.pos.z + Math.cos(a) * 12; if (G.physics.terrainHeight(x, z) > wl - 0.5) { best = a; break; } }
        if (best !== null) { this.yaw = dampAngle(this.yaw, best, 3, dt); G.physics.move(this.pos, Math.sin(this.yaw) * 3 * dt, Math.cos(this.yaw) * 3 * dt, 0.7, 2, false); }
      }
    }
    this.m.g.visible = true;
    this.animate(dt);
  }
  animate(dt) {
    const m = this.m;
    m.g.position.copy(this.pos);
    m.g.rotation.y = this.yaw;
    const sp = this.speed;
    this.phase += dt * (sp > 6 ? 11 : 6) * Math.min(1, sp / 2 + 0.01);
    const amp = sp > 0.3 ? (sp > 6 ? 0.9 : 0.5) : 0;
    const s = Math.sin(this.phase);
    if (sp > 6) { m.legs[0].rotation.x = s * amp; m.legs[1].rotation.x = Math.sin(this.phase + 0.5) * amp; m.legs[2].rotation.x = -s * amp; m.legs[3].rotation.x = -Math.sin(this.phase + 0.5) * amp; }
    else { m.legs[0].rotation.x = s * amp; m.legs[3].rotation.x = s * amp; m.legs[1].rotation.x = -s * amp; m.legs[2].rotation.x = -s * amp; }
    m.body.position.y = 1.15 + (sp > 6 ? Math.abs(Math.sin(this.phase)) * 0.18 : 0);
      // ridden jumps: lift the front, tuck the forelegs, stretch the hind legs, then land
    const P = G.player;
    const ridden = P.mounted === this;
    this.landT = Math.max(0, (this.landT || 0) - dt);
    // swimming: paddle with the head above water
    const wl = G.physics.waterLevel(this.pos.x, this.pos.z);
    if (wl - G.physics.terrainHeight(this.pos.x, this.pos.z) > 1.2 && this.pos.y < wl - 0.6) {
      const w = G.time * 6;
      m.legs.forEach((l, i) => (l.rotation.x = Math.sin(w + i * 1.6) * 0.9));
      m.body.rotation.x = -0.12; m.body.position.y = 1.15; m.neck.rotation.x = -0.25;
      if (Math.random() < 0.3) G.particles.splash(this.pos.x, wl, this.pos.z, 1);
      return;
    }
    if (ridden && !P.onGround && !P.swimming) {
      const pitch = Math.max(-0.45, Math.min(0.4, -P.vy * 0.045));
      m.body.rotation.x = pitch;
      m.legs[0].rotation.x = -1.3; m.legs[1].rotation.x = -1.15;
      m.legs[2].rotation.x = 0.9; m.legs[3].rotation.x = 1.05;
      m.body.position.y = 1.15;
      m.neck.rotation.x = -0.15 + P.vy * 0.02;
      m.tail.rotation.x = 0.9;
      if (m.wings) for (const w of m.wings) w.rotation.z = w.userData.s * Math.sin(G.time * 14) * 0.8;
      return;
    }
    if (this.landT > 0) {
      const k = Math.sin((this.landT / 0.35) * Math.PI);
      m.body.position.y = 1.15 - k * 0.22;
      m.body.rotation.x = k * 0.14;
      m.neck.rotation.x = 0.35 * k;
    } else if (this.rear > 0) { m.body.rotation.x = -0.6 * Math.sin(Math.min(1, (1.2 - this.rear) / 0.4) * Math.PI * 0.5); m.legs[0].rotation.x = -1.2 + Math.sin(G.time * 18) * 0.5; m.legs[1].rotation.x = -1.2 - Math.sin(G.time * 18) * 0.5; }
    else m.body.rotation.x = sp > 6 ? 0.05 : 0;
    if (this.landT > 0) { const k = Math.sin((this.landT / 0.35) * Math.PI); m.body.rotation.x = k * 0.14; m.body.position.y = 1.15 - k * 0.22; }
    m.neck.rotation.x = sp > 0.3 ? 0.1 + Math.sin(this.phase) * 0.05 : (Math.sin(G.time * 0.4 + this.home.x) > 0.6 ? 0.9 : 0.1);
    m.tail.rotation.x = 0.3 + sp * 0.04 + Math.sin(G.time * 3) * 0.08;
    m.tail.rotation.z = Math.sin(G.time * 2.3) * 0.2;
    if (m.wings) for (const w of m.wings) w.rotation.z = w.userData.s * (sp > 6 ? Math.sin(G.time * 10) * 0.6 : 0.2 + Math.sin(G.time * 1.5) * 0.1);
    if (this.B.glow && Math.random() < dt * 4) G.particles.trail(this.pos.x + (Math.random() - 0.5), this.pos.y + 1.4, this.pos.z + (Math.random() - 0.5), this.B.glow, 0.15, 0.8);
  }
  dispose() { G.scene.remove(this.m.g); }
}

export class Horses {
  constructor() {
    this.wild = [];
    this.mine = null;
    this.riding = false;
    const rng = makeRng(808);
    HORSE_SPOTS.forEach(([x, z], i) => this.spawnWild(x, z, rng, i));
    this.spawnOwned();
    // horses for sale wait in the corral next to the Golden Crow bar
    this.display = ['rare', 'epic', 'legendary'].map((b, i) => { const h = new Horse(b, 15 + i * 3, -8 + i * 3); h.home = { x: 18, z: -5 }; h.pen = true; return h; });
    G.world.addInteractable({
      kind: 'myhorse', x: 0, y: 0, z: 0, r: 3, dynamic: true, pos: () => (this.mine ? this.mine.pos : { x: 1e5, y: 0, z: 1e5 }),
      label: () => t('ui.mountHorse'),
      can: () => !!this.mine && !this.riding,
      act: () => this.mount(),
    });
  }
  rollBreed(rng) {
    const total = ORDER.reduce((a, k) => a + BREEDS[k].weight, 0);
    let r = rng() * total;
    for (const k of ORDER) { r -= BREEDS[k].weight; if (r <= 0) return k; }
    return 'common';
  }
  spawnWild(x, z, rng = Math.random, idx) {
    if (G.physics.terrainHeight(x, z) < 1) return;
    const breed = idx === 8 ? 'mythic' : this.rollBreed(rng); // one mythic horse waits near the waterfall mountains
    const h = new Horse(breed, x, z);
    this.wild.push(h);
    h.it = G.world.addInteractable({
      kind: 'horse', x: 0, y: 0, z: 0, r: 3, dynamic: true, pos: () => h.pos,
      label: () => t('ui.tameHorse', { breed: t('horse.' + h.breed) }),
      can: () => !this.riding && h.cool <= 0 && this.wild.includes(h),
      act: () => this.tryTame(h),
    });
  }
  spawnOwned() {
    const inv = G.state.inv;
    if (this.mine) { this.mine.dispose(); this.mine = null; }
    const id = inv.equipped.horse;
    const data = (inv.owned.horses || []).find((q) => q.id === id);
    if (!data) return;
    const P = G.player.pos;
    this.mine = new Horse(data.breed, P.x + 3, P.z + 3, { owned: true, coat: data.coat, id: data.id });
  }

  tryTame(h) {
    const P = G.player;
    P.yaw = Math.atan2(h.pos.x - P.pos.x, h.pos.z - P.pos.z);
    h.yaw = Math.atan2(P.pos.x - h.pos.x, P.pos.z - h.pos.z);
    G.audio.sfx('pickup');
    if (Math.random() < 0.5) {
      // accepted!
      const owned = G.state.inv.owned.horses;
      const id = 'h' + Date.now().toString(36);
      owned.push({ id, breed: h.breed, coat: h.coat });
      G.state.inv.equipped.horse = id;
      this.wild.splice(this.wild.indexOf(h), 1);
      h.dispose();
      this.spawnOwned();
      this.mine.pos.copy(h.pos); this.mine.yaw = h.yaw;
      G.audio.sfx('achievement');
      G.particles.burst(h.pos.x, h.pos.y + 1.5, h.pos.z, RARITY[h.B.rarity].hex, 40, 5, { up: 3 });
      G.ui.toast(t('ui.horseTamed', { breed: t('horse.' + h.breed) }), 'unlock');
      G.prog.addXP(40 + ORDER.indexOf(h.breed) * 40, h.pos);
      this.mount();
      // a new wild horse appears somewhere else later
      setTimeout(() => { const s = HORSE_SPOTS[Math.floor(Math.random() * HORSE_SPOTS.length)]; this.spawnWild(s[0] + (Math.random() - 0.5) * 20, s[1] + (Math.random() - 0.5) * 20); }, 60000);
      G.game.autosave();
    } else {
      // rejected: the horse rears up and throws the hero back
      h.rear = 1.2; h.cool = 1.4;
      G.audio.sfx('growl', { vol: 0.6 });
      G.player.knock = new THREE.Vector3(Math.sin(P.yaw + Math.PI) * 7, 0, Math.cos(P.yaw + Math.PI) * 7);
      G.cam.shake(0.2);
      G.particles.dust(h.pos.x, h.pos.y, h.pos.z, 10);
      G.ui.toast(t('ui.horseRejected'), 'warn');
      setTimeout(() => { if (Math.random() < 0.35) h.fleeT = 1.5; }, 1200);
    }
  }

  // bought at the Golden Crow: delivered next to the hero, saddled and ready
  buy(breed) {
    const owned = G.state.inv.owned.horses;
    const id = 'h' + Date.now().toString(36);
    owned.push({ id, breed, coat: BREEDS[breed].coat[0] });
    if (this.riding) this.dismount();
    G.state.inv.equipped.horse = id;
    this.spawnOwned();
    G.ui.toast(t('ui.horseTamed', { breed: t('horse.' + breed) }), 'unlock');
    G.game.autosave();
  }
  mount() {
    if (!this.mine || this.riding) return;
    this.riding = true;
    G.player.mounted = this.mine;
    G.player.teleport(this.mine.pos.x, this.mine.pos.y, this.mine.pos.z, this.mine.yaw);
    G.audio.sfx('jump');
  }
  dismount() {
    if (!this.riding) return;
    this.riding = false;
    const P = G.player;
    P.mounted = null;
    const side = P.yaw + Math.PI / 2;
    const x = P.pos.x + Math.sin(side) * 1.4, z = P.pos.z + Math.cos(side) * 1.4;
    this.mine.pos.copy(P.pos);
    this.mine.air = false; this.mine.vy = 0;
    P.teleport(x, G.physics.groundAt(x, z, P.pos.y + 1.2), z, P.yaw);
    // dismounting on a fence or in a tight spot: the horse steps out to open ground
    const m = this.mine, ph = G.physics;
    const probe = { x: m.pos.x, y: m.pos.y, z: m.pos.z }; ph.resolve(probe, 0.7, 2, 1.1);
    if (Math.hypot(probe.x - m.pos.x, probe.z - m.pos.z) > 0.1 || (m.pos.y - ph.terrainHeight(m.pos.x, m.pos.z) > 0.5 && !m.onSolidFloor())) m.unstick(m.pos.x, m.pos.z, false);
    G.audio.sfx('land', { vol: 0.5 });
  }
  // H / T key or the horse button: mount, dismount or call your horse
  toggle() {
    if (this.riding) { this.dismount(); return; }
    if (!this.mine) { G.ui.toast(t('ui.noHorse'), 'info'); return; }
    const P = G.player;
    const d = dist2d(P.pos.x, P.pos.z, this.mine.pos.x, this.mine.pos.z);
    if (d < 4) this.mount();
    else {
      if (d > 60 || G.sky.underground !== (this.mine.pos.x > 600)) { const a = P.yaw + Math.PI; this.mine.pos.set(P.pos.x + Math.sin(a) * 25, 0, P.pos.z + Math.cos(a) * 25); this.mine.pos.y = G.physics.groundAt(this.mine.pos.x, this.mine.pos.z, 300); }
      this.mine.called = true;
      G.audio.sfx('chirp', { vol: 1.5 });
      G.ui.toast(t('ui.horseComing'), 'info');
    }
  }

  update(dt) {
    if (G.input.consume('whistle') && !G.ui.blocksGameplay()) this.toggle();
    const P = G.player;
    if (this.riding && P.dead) this.dismount();
    for (const h of this.wild) h.update(dt, false);
    for (const h of this.display) h.update(dt, false);
    if (this.mine) {
      this.mine.update(dt, this.riding);
      if (this.riding) {
        const sp = P.speedNow;
        if (sp > 8 && Math.random() < dt * 6) G.particles.dust(P.pos.x - Math.sin(P.yaw) * 1, P.pos.y, P.pos.z - Math.cos(P.yaw) * 1, 2);
        this.stepAcc = (this.stepAcc || 0) + sp * dt;
        if (this.stepAcc > 2.4) { this.stepAcc = 0; G.audio.sfx('step', { surface: 'wood', vol: 0.5 }); }
      }
    }
  }
}
