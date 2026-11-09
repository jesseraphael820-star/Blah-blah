// Ambient wildlife & farm animals, quest animals (runaway chickens, lost dog),
// and companion pets that follow the player and help.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { unitBox, colorMat } from '../render/voxel.js';
import { dampAngle, dist2d, shade, makeRng } from '../core/utils.js';
import { LOC } from '../data/world.js';
import { t } from '../core/i18n.js';

function bx(parent, sx, sy, sz, c, x, y, z, em = 0) {
  const m = new THREE.Mesh(unitBox, colorMat(c, em, em ? 0.8 : 1));
  m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
}

// generic small quadruped
function quadModel(kind) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const P = {
    cow: { c: 0xf0ece4, spots: 0x2a2a2a, s: [0.9, 0.8, 1.6], leg: 0.6, head: [0.6, 0.55, 0.6], snout: 0xe8b0a0, horns: true },
    sheep: { c: 0xf4f0e8, s: [0.85, 0.75, 1.1], leg: 0.45, head: [0.4, 0.4, 0.45], face: 0x3a3a3a, fluffy: true },
    pig: { c: 0xf0a0a8, s: [0.75, 0.6, 1.05], leg: 0.32, head: [0.5, 0.45, 0.45], snout: 0xe07a88 },
    dog: { c: 0xc8955a, s: [0.42, 0.42, 0.8], leg: 0.34, head: [0.42, 0.38, 0.42], snout: 0xe8c8a0, ears: 0x8a5a30, tail: true },
    cat: { c: 0x8a8a90, s: [0.34, 0.34, 0.68], leg: 0.28, head: [0.36, 0.34, 0.34], ears: 0x6a6a70, tail: true, pointy: true },
    fox: { c: 0xe0762a, s: [0.38, 0.38, 0.75], leg: 0.3, head: [0.38, 0.34, 0.4], snout: 0xffffff, ears: 0x3a2a1a, tail: true, pointy: true, tailTip: 0xffffff },
  }[kind];
  const [sx, sy, sz] = P.s;
  const by = P.leg + sy / 2;
  body.position.y = by;
  bx(body, sx, sy, sz, P.c, 0, 0, 0);
  if (P.spots) { bx(body, sx + 0.02, sy * 0.5, sz * 0.3, P.spots, 0, 0.1, 0.2); bx(body, sx * 0.5, sy * 0.4, sz * 0.25, P.spots, sx * 0.26, -0.05, -0.4); }
  if (P.fluffy) bx(body, sx + 0.1, sy * 0.4, sz + 0.06, shade(P.c, 1.03), 0, sy * 0.35, 0);
  const head = new THREE.Group(); head.position.set(0, sy * 0.35, sz / 2 + P.head[2] * 0.35); body.add(head);
  const [hx, hy, hz] = P.head;
  bx(head, hx, hy, hz, P.face || P.c, 0, 0, 0);
  if (P.snout) bx(head, hx * 0.6, hy * 0.45, 0.12, P.snout, 0, -hy * 0.18, hz / 2 + 0.05);
  bx(head, 0.07, 0.07, 0.03, 0x1a1a1a, -hx * 0.28, hy * 0.12, hz / 2 + 0.01); bx(head, 0.07, 0.07, 0.03, 0x1a1a1a, hx * 0.28, hy * 0.12, hz / 2 + 0.01);
  if (P.horns) { bx(head, 0.08, 0.16, 0.08, 0xe8e0c8, -hx * 0.4, hy * 0.6, 0); bx(head, 0.08, 0.16, 0.08, 0xe8e0c8, hx * 0.4, hy * 0.6, 0); }
  if (P.ears) {
    if (P.pointy) { bx(head, 0.1, 0.16, 0.06, P.ears, -hx * 0.32, hy * 0.62, -0.02); bx(head, 0.1, 0.16, 0.06, P.ears, hx * 0.32, hy * 0.62, -0.02); }
    else { bx(head, 0.1, 0.2, 0.1, P.ears, -hx * 0.55, hy * 0.1, -0.02); bx(head, 0.1, 0.2, 0.1, P.ears, hx * 0.55, hy * 0.1, -0.02); }
  }
  let tail = null;
  if (P.tail) {
    tail = new THREE.Group(); tail.position.set(0, sy * 0.3, -sz / 2); body.add(tail);
    bx(tail, 0.1, 0.1, kind === 'fox' ? 0.5 : 0.36, P.c, 0, 0.05, -0.18);
    if (P.tailTip) bx(tail, 0.12, 0.12, 0.14, P.tailTip, 0, 0.06, -0.44);
  }
  const legs = [];
  for (const [x, z] of [[-sx * 0.32, sz * 0.36], [sx * 0.32, sz * 0.36], [-sx * 0.32, -sz * 0.36], [sx * 0.32, -sz * 0.36]]) {
    const l = new THREE.Group(); l.position.set(x, -sy / 2, z); body.add(l);
    bx(l, Math.min(0.2, sx * 0.25), P.leg, Math.min(0.2, sx * 0.25), kind === 'sheep' ? 0x3a3a3a : shade(P.c, 0.85), 0, -P.leg / 2, 0);
    legs.push(l);
  }
  return { g, body, head, tail, legs, by };
}

function chickenModel(white = true) {
  const g = new THREE.Group(); const body = new THREE.Group(); body.position.y = 0.3; g.add(body);
  const c = white ? 0xf8f4ec : 0xc8742a;
  bx(body, 0.34, 0.3, 0.42, c, 0, 0, 0);
  bx(body, 0.06, 0.22, 0.3, shade(c, 0.9), -0.2, 0.02, -0.02); bx(body, 0.06, 0.22, 0.3, shade(c, 0.9), 0.2, 0.02, -0.02);
  const head = new THREE.Group(); head.position.set(0, 0.22, 0.18); body.add(head);
  bx(head, 0.2, 0.24, 0.2, c, 0, 0, 0);
  bx(head, 0.08, 0.06, 0.1, 0xf0b030, 0, -0.02, 0.14);
  bx(head, 0.06, 0.1, 0.12, 0xe03a3a, 0, 0.16, 0.02);
  bx(head, 0.04, 0.04, 0.02, 0x1a1a1a, -0.07, 0.04, 0.1); bx(head, 0.04, 0.04, 0.02, 0x1a1a1a, 0.07, 0.04, 0.1);
  bx(body, 0.12, 0.16, 0.08, shade(c, 0.9), 0, 0.1, -0.24);
  const legs = [];
  for (const x of [-0.08, 0.08]) { const l = new THREE.Group(); l.position.set(x, -0.15, 0); body.add(l); bx(l, 0.04, 0.16, 0.04, 0xf0b030, 0, -0.08, 0); legs.push(l); }
  return { g, body, head, legs, by: 0.3 };
}

function birdModel(color) {
  const g = new THREE.Group();
  bx(g, 0.18, 0.14, 0.32, color, 0, 0, 0);
  bx(g, 0.12, 0.12, 0.12, color, 0, 0.05, 0.2);
  bx(g, 0.05, 0.04, 0.08, 0xf0b030, 0, 0.04, 0.3);
  const wl = new THREE.Group(); wl.position.x = -0.08; g.add(wl); bx(wl, 0.36, 0.03, 0.2, shade(color, 0.8), -0.18, 0, 0);
  const wr = new THREE.Group(); wr.position.x = 0.08; g.add(wr); bx(wr, 0.36, 0.03, 0.2, shade(color, 0.8), 0.18, 0, 0);
  return { g, wl, wr };
}

class Animal {
  constructor(kind, x, z, area, o = {}) {
    this.kind = kind;
    this.m = kind === 'chicken' ? chickenModel(o.white !== false) : quadModel(kind);
    G.scene.add(this.m.g);
    this.pos = new THREE.Vector3(x, 0, z);
    this.pos.y = G.physics.groundAt(x, z, 100);
    this.area = area; // {x0,x1,z0,z1} or {x,z,r}
    this.yaw = Math.random() * 6.28;
    this.target = null;
    this.t = Math.random() * 5;
    this.waitT = Math.random() * 3;
    this.speed = { cow: 1, sheep: 1.2, pig: 1.3, chicken: 1.6, dog: 4.5, cat: 4, fox: 4.8 }[kind] || 1.2;
    this.soundT = 5 + Math.random() * 20;
    this.flee = kind === 'chicken';
    this.walkPhase = 0;
    this.follow = null;
  }
  pickTarget() {
    const a = this.area;
    if (a.r) { const ang = Math.random() * 6.28, r = Math.random() * a.r; return new THREE.Vector3(a.x + Math.cos(ang) * r, 0, a.z + Math.sin(ang) * r); }
    return new THREE.Vector3(a.x0 + Math.random() * (a.x1 - a.x0), 0, a.z0 + Math.random() * (a.z1 - a.z0));
  }
  update(dt) {
    this.t += dt;
    const P = G.player.pos;
    const dP = dist2d(P.x, P.z, this.pos.x, this.pos.z);
    if (dP > 90) { this.m.g.visible = false; return; }
    this.m.g.visible = true;
    let move = 0;
    if (this.follow) {
      const f = this.follow;
      const d = dist2d(f.x, f.z, this.pos.x, this.pos.z);
      if (d > 30) { this.pos.set(f.x - 1.5, f.y, f.z - 1.5); }
      if (d > 2.6) { this.yaw = dampAngle(this.yaw, Math.atan2(f.x - this.pos.x, f.z - this.pos.z), 10, dt); move = Math.min(this.speed * (d > 6 ? 1.6 : 1), d * 2); }
    } else if (this.flee && dP < 3.5) {
      this.yaw = dampAngle(this.yaw, Math.atan2(this.pos.x - P.x, this.pos.z - P.z), 10, dt);
      move = this.speed * 1.8;
      if (Math.random() < dt * 2) G.audio.sfxAt('cluck', this.pos.x, this.pos.z, { range: 20 });
    } else if (this.target) {
      const d = dist2d(this.target.x, this.target.z, this.pos.x, this.pos.z);
      this.yaw = dampAngle(this.yaw, Math.atan2(this.target.x - this.pos.x, this.target.z - this.pos.z), 5, dt);
      move = this.speed;
      if (d < 0.5) { this.target = null; this.waitT = 2 + Math.random() * 6; }
    } else {
      this.waitT -= dt;
      if (this.waitT <= 0) this.target = this.pickTarget();
    }
    if (move > 0) {
      const ox = this.pos.x, oz = this.pos.z;
      G.physics.move(this.pos, Math.sin(this.yaw) * move * dt, Math.cos(this.yaw) * move * dt, 0.35, 1, false);
      const a = this.area;
      if (!this.follow && a.x0 !== undefined) { this.pos.x = Math.max(a.x0, Math.min(a.x1, this.pos.x)); this.pos.z = Math.max(a.z0, Math.min(a.z1, this.pos.z)); }
      if (Math.hypot(this.pos.x - ox, this.pos.z - oz) < move * dt * 0.2) this.target = null;
      this.walkPhase += dt * move * 4;
    }
    this.pos.y = G.physics.groundAt(this.pos.x, this.pos.z, this.pos.y + 1.2);
    const m = this.m;
    m.g.position.copy(this.pos);
    m.g.rotation.y = this.yaw;
    const sw = move > 0 ? Math.sin(this.walkPhase) * 0.6 : 0;
    m.legs.forEach((l, i) => (l.rotation.x = (i % 2 === (i < 2 ? 0 : 1) ? sw : -sw)));
    m.body.position.y = m.by + (move > 0 ? Math.abs(Math.sin(this.walkPhase)) * 0.04 : 0);
    if (m.head) m.head.rotation.x = move > 0 ? 0 : (this.kind === 'chicken' ? (Math.sin(this.t * 4) > 0.6 ? 0.8 : 0) : Math.max(0, Math.sin(this.t * 0.5)) * 0.5);
    if (m.tail) m.tail.rotation.y = Math.sin(this.t * (this.follow ? 12 : 4)) * 0.5;
    this.soundT -= dt;
    if (this.soundT <= 0 && dP < 25) {
      this.soundT = 10 + Math.random() * 25;
      const s = { cow: 'moo', chicken: 'cluck', sheep: 'baa', pig: 'growl', dog: 'bark' }[this.kind];
      if (s) G.audio.sfxAt(s, this.pos.x, this.pos.z, { range: 28, vol: this.kind === 'pig' ? 0.3 : 0.8 });
    }
  }
}

export class Wildlife {
  constructor(scene) {
    this.scene = scene;
    this.animals = [];
    const farm = LOC.farm;
    const pen = { x0: -125, x1: -109, z0: 79, z1: 96 };
    for (let i = 0; i < 4; i++) this.animals.push(new Animal('cow', -120 + i * 3, 85 + (i % 2) * 5, pen));
    for (let i = 0; i < 3; i++) this.animals.push(new Animal('sheep', -116 + i * 2, 92, pen));
    for (let i = 0; i < 3; i++) this.animals.push(new Animal('pig', -88 + i * 2, 80, { x: -86, z: 80, r: 5 }));
    for (let i = 0; i < 7; i++) this.animals.push(new Animal('chicken', -50 + Math.random() * 4, 88 + Math.random() * 4, { x: -50, z: 90, r: 6 }, { white: i % 3 !== 0 }));
    this.animals.push(new Animal('cat', 30, 60, { x: 30, z: 55, r: 12 }));
    this.animals.push(new Animal('dog', 262, 100, { x: 262, z: 104, r: 6 }));
    // runaway chickens (quest)
    this.runaways = [[-38, 68], [-112, 130], [-134, 58], [-22, 112]].map(([x, z], i) => {
      const a = new Animal('chicken', x, z, { x, z, r: 4 }, { white: false });
      a.runawayIdx = i;
      G.world.addInteractable({ kind: 'chicken', x: 0, y: 0, z: 0, r: 2.2, dynamic: true, pos: () => a.pos,
        label: () => t('ui.catchChicken'),
        can: () => this.runawayActive(a),
        act: () => {
          G.state.world.flags['chicken' + i] = true;
          G.audio.sfx('cluck'); G.particles.burst(a.pos.x, a.pos.y + 0.5, a.pos.z, 0xffffff, 14, 3, { solid: true });
          a.pos.set(-50, 0, 90); a.area = { x: -50, z: 90, r: 6 }; a.target = null;
          G.quests.tryInteract('chicken');
        } });
      this.animals.push(a);
      return a;
    });
    // lost dog Biscoito (quest)
    this.lostDog = new Animal('dog', LOC.dogSpot.x, LOC.dogSpot.z, { x: LOC.dogSpot.x, z: LOC.dogSpot.z, r: 1.5 });
    this.lostDog.flee = false;
    this.animals.push(this.lostDog);
    G.world.addInteractable({ kind: 'lostdog', x: 0, y: 0, z: 0, r: 2.6, dynamic: true, pos: () => this.lostDog.pos,
      label: () => t('ui.petDog'),
      can: () => G.quests.isActiveStep('side_dog', 1) && !this.lostDog.follow,
      act: () => {
        G.audio.sfx('bark');
        this.lostDog.follow = G.player.pos;
        G.particles.burst(this.lostDog.pos.x, this.lostDog.pos.y + 0.8, this.lostDog.pos.z, 0xff7aa0, 10, 2, { up: 2, gravity: -1 });
        G.quests.tryInteract('lostdog');
      } });

    // birds
    this.flocks = [];
    const colors = [0x3a3a4a, 0x8a5a3a, 0x4a6aa8];
    for (let f = 0; f < 3; f++) {
      const birds = [];
      for (let i = 0; i < 5; i++) { const b = birdModel(colors[f]); scene.add(b.g); birds.push({ ...b, off: Math.random() * 6.28, r: 2 + Math.random() * 3 }); }
      this.flocks.push({ birds, ang: Math.random() * 6.28, r: 30 + f * 20, h: 22 + f * 6, cx: 0, cz: 0, speed: 0.15 + f * 0.05 });
    }
    // butterflies
    this.butterflies = [];
    const bc = [0xffd040, 0xff7ab0, 0x7ad0ff, 0xffffff, 0xff9a3a];
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      const c = bc[i % bc.length];
      const wl = bx(g, 0.18, 0.02, 0.14, c, -0.09, 0, 0, c); const wr = bx(g, 0.18, 0.02, 0.14, c, 0.09, 0, 0, c);
      wl.castShadow = wr.castShadow = false;
      scene.add(g);
      this.butterflies.push({ g, wl, wr, anchor: new THREE.Vector3(), ph: Math.random() * 10, set: false });
    }
    this.fishT = 4;
    this.fish = [];
    this.fireflyAcc = 0;
  }
  runawayActive(a) { return G.quests.isActiveStep('side_chickens', 0) && !G.state.world.flags['chicken' + a.runawayIdx]; }

  update(dt) {
    const P = G.player.pos;
    for (const a of this.animals) {
      if (a.runawayIdx !== undefined) {
        const active = this.runawayActive(a);
        a.m.g.visible = active || G.state.world.flags['chicken' + a.runawayIdx];
        if (!active && !G.state.world.flags['chicken' + a.runawayIdx]) continue;
      }
      if (a === this.lostDog) {
        const show = G.quests.isActive('side_dog') && !G.state.inv.owned.pets.includes('dog');
        a.m.g.visible = show;
        if (!show) { a.follow = null; continue; }
      }
      a.update(dt);
    }
    if (G.sky.underground && Math.random() < dt * 10) G.particles.glow.spawn(P.x + (Math.random() - 0.5) * 20, P.y + Math.random() * 5, P.z + (Math.random() - 0.5) * 20, 0.1, 0.05, 0, 0x9ab0d8, 0.06, 5, { drag: 0.1, alpha: 0.5 });
    if (G.sky.underground) { this.flocks.forEach((f) => f.birds.forEach((b) => (b.g.visible = false))); this.butterflies.forEach((b) => (b.g.visible = false)); return; }
    const day = G.sky.night < 0.5 && (G.weather.rain || 0) < 0.4;
    // birds circle above the player area
    for (const f of this.flocks) {
      f.ang += dt * f.speed;
      f.cx += (P.x - f.cx) * dt * 0.05; f.cz += (P.z - f.cz) * dt * 0.05;
      for (const b of f.birds) {
        b.g.visible = day;
        if (!day) continue;
        const a = f.ang + b.off * 0.15;
        b.g.position.set(f.cx + Math.cos(a) * f.r + Math.cos(b.off + G.time) * b.r, f.h + Math.sin(G.time * 2 + b.off) * 1.2, f.cz + Math.sin(a) * f.r + Math.sin(b.off + G.time) * b.r);
        b.g.rotation.y = -a;
        const fl = Math.sin(G.time * 14 + b.off) * 0.7;
        b.wl.rotation.z = fl; b.wr.rotation.z = -fl;
      }
    }
    // butterflies in daylight meadows
    for (const b of this.butterflies) {
      if (!day) { b.g.visible = false; b.set = false; continue; }
      if (!b.set || b.anchor.distanceTo(P) > 26) {
        const a = Math.random() * 6.28, r = 6 + Math.random() * 14;
        b.anchor.set(P.x + Math.cos(a) * r, 0, P.z + Math.sin(a) * r);
        b.anchor.y = G.physics.terrainHeight(b.anchor.x, b.anchor.z);
        const biome = G.world.terrain.biomeAt(b.anchor.x, b.anchor.z);
        b.set = true;
        b.g.visible = b.anchor.y > 1 && (biome === 0 || biome === 10);
      }
      b.ph += dt;
      b.g.position.set(b.anchor.x + Math.sin(b.ph * 0.7) * 2, b.anchor.y + 0.8 + Math.sin(b.ph * 1.3) * 0.4, b.anchor.z + Math.cos(b.ph * 0.5) * 2);
      b.g.rotation.y = b.ph * 0.6;
      const fl = Math.sin(b.ph * 18) * 1.1;
      b.wl.rotation.z = fl; b.wr.rotation.z = -fl;
    }
    // ambient atmosphere: pollen in sunny meadows, falling leaves in forests, snow on the peaks
    this.ambAcc = (this.ambAcc || 0) + dt * (G.mobile ? 6 : 12);
    while (this.ambAcc > 1) {
      this.ambAcc--;
      const a = Math.random() * 6.28, r = 2 + Math.random() * 16;
      const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
      const h = G.physics.terrainHeight(x, z);
      const biome = G.world.terrain.biomeAt(x, z);
      const wind = G.weather.wind;
      if (h >= 26) G.particles.solid.spawn(x, h + 6 + Math.random() * 4, z, wind * 0.8, -1.2, 0.3, 0xffffff, 0.12, 5, { drag: 0.2, alpha: 0.9 });
      else if ((biome === 1 || biome === 9) && Math.random() < 0.5) {
        const leaf = biome === 9 ? 0x8a6ab0 : [0x6a9a3a, 0xc8a03a, 0x9ab040][Math.floor(Math.random() * 3)];
        G.particles.solid.spawn(x, h + 5 + Math.random() * 4, z, wind * 0.9, -0.9, (Math.random() - 0.5) * 0.6, leaf, 0.16, 6, { drag: 0.4, alpha: 0.95 });
      } else if (day && (biome === 0 || biome === 10) && Math.random() < 0.35) {
        G.particles.glow.spawn(x, h + 0.5 + Math.random() * 2.5, z, wind * 0.3, 0.05, (Math.random() - 0.5) * 0.2, 0xfff2b0, 0.07, 4, { drag: 0.1, alpha: 0.6 });
      }
    }
    // fireflies at night
    if (G.sky.night > 0.6) {
      this.fireflyAcc += dt * (G.mobile ? 8 : 16);
      while (this.fireflyAcc > 1) {
        this.fireflyAcc--;
        const a = Math.random() * 6.28, r = 3 + Math.random() * 20;
        const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
        const y = G.physics.terrainHeight(x, z);
        if (y < 0.5) continue;
        G.particles.glow.spawn(x, y + 0.5 + Math.random() * 2, z, (Math.random() - 0.5) * 0.4, (Math.random() - 0.3) * 0.3, (Math.random() - 0.5) * 0.4, Math.random() < 0.7 ? 0xd8ff6a : 0x8affc8, 0.22, 2.5 + Math.random() * 2, { drag: 0.2 });
      }
    }
    // jumping fish in lakes/river
    this.fishT -= dt;
    if (this.fishT <= 0) {
      this.fishT = 3 + Math.random() * 6;
      for (let k = 0; k < 8; k++) {
        const a = Math.random() * 6.28, r = 6 + Math.random() * 30;
        const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
        if (G.physics.waterLevel(x, z) - G.physics.terrainHeight(x, z) > 1.5) {
          const m = new THREE.Mesh(unitBox, colorMat(0x8ab0c8)); m.scale.set(0.15, 0.2, 0.5);
          G.scene.add(m);
          this.fish.push({ m, x, z, t: 0, yaw: Math.random() * 6.28, wl: G.physics.waterLevel(x, z) });
          G.particles.splash(x, G.physics.waterLevel(x, z), z, 6);
          break;
        }
      }
    }
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i];
      f.t += dt;
      const k = f.t / 0.8;
      f.m.position.set(f.x + Math.sin(f.yaw) * k * 1.5, f.wl - 0.2 + Math.sin(k * Math.PI) * 1.4, f.z + Math.cos(f.yaw) * k * 1.5);
      f.m.rotation.set(-Math.cos(k * Math.PI) * 1.2, f.yaw, 0);
      if (k >= 1) { G.particles.splash(f.m.position.x, f.wl, f.m.position.z, 6); G.audio.sfxAt('splash', f.m.position.x, f.m.position.z, { range: 25, vol: 0.4 }); G.scene.remove(f.m); this.fish.splice(i, 1); }
    }
  }
}

// ---------------- companion pet ----------------
export class Pet {
  constructor(kind) {
    this.kind = kind;
    this.a = new Animal(kind, G.player.pos.x - 1.5, G.player.pos.z - 1.5, { x: 0, z: 0, r: 1 });
    this.a.follow = G.player.pos;
    this.a.flee = false;
    this.abilityT = 5;
  }
  update(dt) {
    this.a.update(dt);
    this.abilityT -= dt;
    if (this.abilityT > 0) return;
    const P = G.player;
    if (this.kind === 'dog') {
      this.abilityT = 2.5;
      const e = G.combat.nearestEnemy(this.a.pos, 7, null);
      if (e && e.aggro) {
        this.a.pos.lerp(e.pos, 0.6);
        G.audio.sfxAt('bark', this.a.pos.x, this.a.pos.z);
        e.takeDamage(6 + P.stats.level * 1.2, {});
      }
    } else if (this.kind === 'cat') {
      this.abilityT = 6;
      if (G.state.player.hp < P.stats.maxHp) P.heal(3 + P.stats.level * 0.5);
    } else if (this.kind === 'fox') {
      this.abilityT = 45;
      const g = 4 + Math.floor(Math.random() * 8);
      G.pickups.spawnCoins(this.a.pos.x, this.a.pos.y + 0.6, this.a.pos.z, g);
      G.ui.bubble({ pos: this.a.pos, def: { scale: 0.4 } }, '✦', 1.2);
    }
  }
  dispose() { G.scene.remove(this.a.m.g); }
}
