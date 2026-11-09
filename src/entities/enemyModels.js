// Voxel creature models with per-instance materials (for hit flashes) and procedural animation.
import * as THREE from 'three';
import { unitBox } from '../render/voxel.js';
import { shade, TAU } from '../core/utils.js';

class ModelBase {
  constructor() { this.group = new THREE.Group(); this.mats = []; this.flashT = 0; this.flashCol = new THREE.Color(); this.t = Math.random() * 10; }
  mat(color, emissive = 0, ei = 1) {
    const m = new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: emissive ? ei : 1 });
    m.userData.baseEmissive = new THREE.Color(emissive);
    m.userData.baseEI = emissive ? ei : 1;
    this.mats.push(m);
    return m;
  }
  box(parent, sx, sy, sz, color, x = 0, y = 0, z = 0, emissive = 0) {
    const m = new THREE.Mesh(unitBox, this.mat(color, emissive, emissive ? 1.2 : 1));
    m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true;
    parent.add(m);
    return m;
  }
  flash(color = 0xffffff) { this.flashT = 0.12; this.flashCol.setHex(color); }
  tint(status) {
    for (const m of this.mats) {
      if (this.flashT > 0) { m.emissive.copy(this.flashCol); m.emissiveIntensity = 1.2; }
      else if (status === 'frozen') { m.emissive.setHex(0x6ac8ff); m.emissiveIntensity = 0.6; }
      else if (status === 'burn') { m.emissive.setHex(0xff5a1a); m.emissiveIntensity = 0.35 + Math.sin(this.t * 20) * 0.15; }
      else { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = m.userData.baseEI; }
    }
  }
  base(dt, status) { this.t += dt; this.flashT = Math.max(0, this.flashT - dt); this.tint(status); }
  setOpacity(o) { for (const m of this.mats) { m.transparent = o < 1; m.opacity = o; } }
}

// ---------- Slime (forest moss creature) ----------
class SlimeModel extends ModelBase {
  constructor(def) {
    super();
    const c = def.color;
    this.body = new THREE.Group(); this.group.add(this.body);
    this.core = this.box(this.body, 1.0, 0.85, 1.0, c, 0, 0.425, 0);
    this.box(this.body, 1.05, 0.2, 1.05, shade(c, 0.75), 0, 0.85, 0);
    this.box(this.body, 0.3, 0.25, 0.3, 0x5aa83a, 0.2, 1.05, 0.1);
    this.box(this.body, 0.15, 0.18, 0.15, 0xe04a8a, 0.2, 1.2, 0.1);
    this.eyeL = this.box(this.body, 0.14, 0.22, 0.04, 0x1a1a1a, -0.2, 0.5, 0.51);
    this.eyeR = this.box(this.body, 0.14, 0.22, 0.04, 0x1a1a1a, 0.2, 0.5, 0.51);
    this.box(this.body, 0.06, 0.06, 0.02, 0xffffff, -0.23, 0.57, 0.53); this.box(this.body, 0.06, 0.06, 0.02, 0xffffff, 0.17, 0.57, 0.53);
    this.mouth = this.box(this.body, 0.2, 0.06, 0.04, 0x3a1a1a, 0, 0.3, 0.51);
    if (def.color === 0xffcc33) { this.box(this.body, 0.5, 0.12, 0.5, 0xfff0a0, 0, 1.0, 0, 0xffd36a); this.mats.forEach((m) => { m.emissive.setHex(0x6a4a00); m.userData.baseEmissive.setHex(0x6a4a00); }); }
  }
  animate(dt, st, phase, speed) {
    const t = this.t;
    let sq = 1, hop = 0;
    if (st === 'chase' || st === 'wander' || st === 'flee') { const k = Math.abs(Math.sin(t * 7)); hop = k * 0.45; sq = 1 - (1 - k) * 0.25; }
    else if (st === 'windup') sq = 0.7 - phase * 0.1;
    else if (st === 'attack') { hop = Math.sin(phase * Math.PI) * 1.4; sq = 1.25; }
    else if (st === 'dead') sq = Math.max(0.05, 1 - phase);
    else sq = 1 + Math.sin(t * 3) * 0.05;
    this.body.position.y = hop;
    this.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    const blink = (t % 3.3) < 0.12;
    this.eyeL.scale.y = this.eyeR.scale.y = blink ? 0.04 : st === 'windup' ? 0.12 : 0.22;
    this.mouth.scale.x = st === 'windup' || st === 'attack' ? 0.32 : 0.2;
  }
}

// ---------- Wolf ----------
class WolfModel extends ModelBase {
  constructor(def) {
    super();
    const c = def.color, d = shade(c, 0.7), l = shade(c, 1.25);
    const eye = def.eye || 0xffe060;
    this.body = new THREE.Group(); this.body.position.y = 0.75; this.group.add(this.body);
    this.box(this.body, 0.62, 0.58, 1.25, c, 0, 0, 0);
    this.box(this.body, 0.66, 0.3, 0.6, l, 0, -0.18, 0.25);
    this.box(this.body, 0.7, 0.5, 0.5, d, 0, 0.12, 0.45);
    this.head = new THREE.Group(); this.head.position.set(0, 0.25, 0.75); this.body.add(this.head);
    this.box(this.head, 0.52, 0.46, 0.5, c, 0, 0, 0.1);
    this.jaw = this.box(this.head, 0.28, 0.12, 0.34, l, 0, -0.17, 0.48);
    this.box(this.head, 0.3, 0.2, 0.36, c, 0, -0.03, 0.48);
    this.box(this.head, 0.1, 0.08, 0.06, 0x1a1a1a, 0, 0.04, 0.68);
    this.box(this.head, 0.13, 0.22, 0.1, d, -0.17, 0.32, 0); this.box(this.head, 0.13, 0.22, 0.1, d, 0.17, 0.32, 0);
    this.box(this.head, 0.1, 0.07, 0.04, eye, -0.13, 0.08, 0.36, eye); this.box(this.head, 0.1, 0.07, 0.04, eye, 0.13, 0.08, 0.36, eye);
    this.tail = new THREE.Group(); this.tail.position.set(0, 0.15, -0.62); this.body.add(this.tail);
    this.box(this.tail, 0.18, 0.18, 0.62, d, 0, 0, -0.3);
    this.legs = [];
    for (const [x, z] of [[-0.2, 0.45], [0.2, 0.45], [-0.2, -0.45], [0.2, -0.45]]) {
      const g = new THREE.Group(); g.position.set(x, -0.2, z); this.body.add(g);
      this.box(g, 0.17, 0.55, 0.2, d, 0, -0.27, 0);
      this.legs.push(g);
    }
  }
  animate(dt, st, phase, speed) {
    const t = this.t;
    const run = st === 'chase' || st === 'flee' || st === 'charge';
    const w = t * (run ? 13 : 7);
    const amp = st === 'wander' || st === 'return' ? 0.5 : run ? 0.9 : 0;
    this.legs[0].rotation.x = Math.sin(w) * amp; this.legs[3].rotation.x = Math.sin(w) * amp;
    this.legs[1].rotation.x = -Math.sin(w) * amp; this.legs[2].rotation.x = -Math.sin(w) * amp;
    this.body.position.y = 0.75 + (amp ? Math.abs(Math.sin(w)) * 0.08 : Math.sin(t * 2) * 0.01);
    this.tail.rotation.x = 0.4 + Math.sin(t * 6) * 0.1; this.tail.rotation.y = Math.sin(t * (run ? 10 : 4)) * 0.4;
    let bodyX = 0;
    if (st === 'windup') { bodyX = 0.15; this.head.rotation.x = 0.25; this.jaw.position.y = -0.24; this.legs.forEach((l) => (l.rotation.x = 0.3)); }
    else if (st === 'attack') { bodyX = -0.25 * Math.sin(phase * Math.PI); this.head.rotation.x = -0.3; this.jaw.position.y = -0.17 - Math.sin(phase * Math.PI * 3) * 0.1; this.legs.forEach((l, i) => (l.rotation.x = i < 2 ? -1 : 0.8)); }
    else { this.head.rotation.x = st === 'idle' ? Math.sin(t * 0.8) * 0.1 : 0; this.jaw.position.y = -0.17; }
    if (st === 'dead') { this.group.rotation.z = Math.min(1.5, phase * 3); }
    else this.group.rotation.z = 0;
    this.body.rotation.x = bodyX;
  }
}

// ---------- Corrupted forest sprite ----------
class SpriteModel extends ModelBase {
  constructor(def) {
    super();
    const c = def.color;
    this.body = new THREE.Group(); this.body.position.y = 1.4; this.group.add(this.body);
    this.core = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), this.mat(c, c, 0.8)); this.core.castShadow = true; this.body.add(this.core);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; const b = this.box(this.body, 0.2, 0.36, 0.08, 0x3a7a3a, Math.cos(a) * 0.32, 0.4, Math.sin(a) * 0.32); b.rotation.y = -a; b.rotation.z = 0.4; }
    this.box(this.body, 0.12, 0.12, 0.04, 0xffffff, -0.14, 0.05, 0.36, 0xffffff); this.box(this.body, 0.12, 0.12, 0.04, 0xffffff, 0.14, 0.05, 0.36, 0xffffff);
    this.armL = this.box(this.body, 0.1, 0.32, 0.1, shade(c, 0.7), -0.45, -0.1, 0); this.armR = this.box(this.body, 0.1, 0.32, 0.1, shade(c, 0.7), 0.45, -0.1, 0);
    this.wisp = this.box(this.body, 0.18, 0.5, 0.18, shade(c, 0.6), 0, -0.55, 0, c);
  }
  animate(dt, st, phase) {
    const t = this.t;
    this.body.position.y = 1.4 + Math.sin(t * 2.4) * 0.2;
    this.core.rotation.y += dt * 2;
    this.wisp.rotation.z = Math.sin(t * 5) * 0.4;
    const cast = st === 'windup';
    this.armL.rotation.z = cast ? 2.2 : 0.4 + Math.sin(t * 3) * 0.2; this.armR.rotation.z = cast ? -2.2 : -0.4 - Math.sin(t * 3) * 0.2;
    this.core.scale.setScalar(cast ? 1 + phase * 0.4 : 1);
    if (st === 'dead') this.body.scale.setScalar(Math.max(0.01, 1 - phase));
  }
}

// ---------- Bat ----------
class BatModel extends ModelBase {
  constructor(def) {
    super();
    const c = def.color;
    this.body = new THREE.Group(); this.body.position.y = 2; this.group.add(this.body);
    this.box(this.body, 0.45, 0.42, 0.42, c, 0, 0, 0);
    this.box(this.body, 0.12, 0.2, 0.06, shade(c, 0.8), -0.14, 0.28, 0); this.box(this.body, 0.12, 0.2, 0.06, shade(c, 0.8), 0.14, 0.28, 0);
    this.box(this.body, 0.08, 0.08, 0.04, 0xff3a3a, -0.1, 0.05, 0.22, 0xff2a2a); this.box(this.body, 0.08, 0.08, 0.04, 0xff3a3a, 0.1, 0.05, 0.22, 0xff2a2a);
    this.box(this.body, 0.05, 0.08, 0.04, 0xffffff, -0.05, -0.12, 0.22); this.box(this.body, 0.05, 0.08, 0.04, 0xffffff, 0.05, -0.12, 0.22);
    this.wL = new THREE.Group(); this.wL.position.x = -0.22; this.body.add(this.wL);
    this.wR = new THREE.Group(); this.wR.position.x = 0.22; this.body.add(this.wR);
    this.box(this.wL, 0.7, 0.04, 0.45, shade(c, 0.7), -0.35, 0, 0); this.box(this.wR, 0.7, 0.04, 0.45, shade(c, 0.7), 0.35, 0, 0);
  }
  animate(dt, st, phase) {
    const t = this.t;
    const f = Math.sin(t * 22) * 0.8;
    this.wL.rotation.z = f; this.wR.rotation.z = -f;
    this.body.position.y = 2 + Math.sin(t * 3) * 0.3 + (st === 'attack' ? -1.2 * Math.sin(phase * Math.PI) : 0);
    if (st === 'dead') { this.body.position.y = Math.max(0.2, 2 - phase * 2); this.wL.rotation.z = 0.2; this.wR.rotation.z = -0.2; }
  }
}

// ---------- Golem / Golem King ----------
class GolemModel extends ModelBase {
  constructor(def) {
    super();
    const c = def.color, d = shade(c, 0.75);
    const cr = def.crystal || 0x6fe8ff;
    this.body = new THREE.Group(); this.group.add(this.body);
    this.hips = new THREE.Group(); this.hips.position.y = 1.0; this.body.add(this.hips);
    this.legL = new THREE.Group(); this.legL.position.x = -0.38; this.hips.add(this.legL);
    this.legR = new THREE.Group(); this.legR.position.x = 0.38; this.hips.add(this.legR);
    this.box(this.legL, 0.52, 1.0, 0.6, d, 0, -0.5, 0); this.box(this.legR, 0.52, 1.0, 0.6, d, 0, -0.5, 0);
    this.torso = new THREE.Group(); this.torso.position.y = 1.0; this.body.add(this.torso);
    this.box(this.torso, 1.5, 1.25, 0.95, c, 0, 0.65, 0);
    this.box(this.torso, 1.2, 0.3, 1.0, d, 0, 0.1, 0);
    for (let i = 0; i < 3; i++) this.box(this.torso, 0.3, 0.55 + i * 0.15, 0.3, cr, -0.4 + i * 0.4, 1.4 + i * 0.05, -0.4, cr);
    this.head = this.box(this.torso, 0.7, 0.6, 0.65, c, 0, 1.55, 0.15);
    this.box(this.torso, 0.14, 0.1, 0.04, cr, -0.15, 1.6, 0.49, cr); this.box(this.torso, 0.14, 0.1, 0.04, cr, 0.15, 1.6, 0.49, cr);
    if (def.boss) for (let i = 0; i < 5; i++) this.box(this.torso, 0.14, 0.35, 0.14, cr, -0.28 + i * 0.14, 1.95, 0.15, cr);
    this.armL = new THREE.Group(); this.armL.position.set(-0.98, 1.15, 0); this.torso.add(this.armL);
    this.armR = new THREE.Group(); this.armR.position.set(0.98, 1.15, 0); this.torso.add(this.armR);
    this.box(this.armL, 0.5, 1.3, 0.55, c, 0, -0.6, 0); this.box(this.armR, 0.5, 1.3, 0.55, c, 0, -0.6, 0);
    this.box(this.armL, 0.62, 0.5, 0.62, d, 0, -1.35, 0); this.box(this.armR, 0.62, 0.5, 0.62, d, 0, -1.35, 0);
  }
  animate(dt, st, phase) {
    const t = this.t;
    const walk = st === 'chase' || st === 'wander' || st === 'return';
    const w = t * 4;
    this.legL.rotation.x = walk ? Math.sin(w) * 0.5 : 0; this.legR.rotation.x = walk ? -Math.sin(w) * 0.5 : 0;
    let aL = walk ? -Math.sin(w) * 0.4 : Math.sin(t) * 0.05, aR = walk ? Math.sin(w) * 0.4 : -Math.sin(t) * 0.05;
    this.body.position.y = walk ? Math.abs(Math.sin(w)) * 0.08 : 0;
    this.torso.rotation.x = 0;
    if (st === 'windup') { aL = -2.8 * Math.min(1, phase * 1.5); aR = -2.8 * Math.min(1, phase * 1.5); this.torso.rotation.x = -0.15; }
    else if (st === 'attack') { aL = -2.8 + 3.2 * Math.min(1, phase * 3); aR = aL; this.torso.rotation.x = 0.35 * Math.min(1, phase * 3); }
    this.armL.rotation.x = aL; this.armR.rotation.x = aR;
    if (st === 'dead') { this.body.rotation.x = Math.min(1.5, phase * 2); this.body.position.y = -phase * 0.5; }
  }
}

// ---------- Stone sentinel / Ancient guardian ----------
class SentinelModel extends ModelBase {
  constructor(def) {
    super();
    const c = def.color, d = shade(c, 0.78);
    const eye = def.eye || 0x4fd0ff;
    this.body = new THREE.Group(); this.group.add(this.body);
    this.legL = new THREE.Group(); this.legL.position.set(-0.22, 0.85, 0); this.body.add(this.legL);
    this.legR = new THREE.Group(); this.legR.position.set(0.22, 0.85, 0); this.body.add(this.legR);
    this.box(this.legL, 0.34, 0.85, 0.4, d, 0, -0.42, 0); this.box(this.legR, 0.34, 0.85, 0.4, d, 0, -0.42, 0);
    this.torso = new THREE.Group(); this.torso.position.y = 0.85; this.body.add(this.torso);
    this.box(this.torso, 0.9, 0.85, 0.55, c, 0, 0.45, 0);
    this.box(this.torso, 0.3, 0.3, 0.06, eye, 0, 0.55, 0.29, eye);
    this.box(this.torso, 1.2, 0.25, 0.65, d, 0, 0.85, 0);
    this.box(this.torso, 0.55, 0.55, 0.55, c, 0, 1.2, 0);
    this.box(this.torso, 0.4, 0.08, 0.04, eye, 0, 1.22, 0.29, eye);
    this.box(this.torso, 0.1, 0.4, 0.5, d, 0, 1.55, 0);
    this.armL = new THREE.Group(); this.armL.position.set(-0.6, 0.8, 0); this.torso.add(this.armL);
    this.armR = new THREE.Group(); this.armR.position.set(0.6, 0.8, 0); this.torso.add(this.armR);
    this.box(this.armL, 0.28, 0.75, 0.3, c, 0, -0.35, 0); this.box(this.armR, 0.28, 0.75, 0.3, c, 0, -0.35, 0);
    this.box(this.armL, 0.12, 0.9, 0.7, d, -0.12, -0.5, 0.15);
    const sw = new THREE.Group(); sw.position.set(0, -0.75, 0.1); this.armR.add(sw);
    this.box(sw, 0.1, 0.12, 0.5, d, 0, 0, 0); this.box(sw, 0.14, 0.06, 1.6, 0xb8b0a0, 0, 0, 0.9, def.boss ? eye : 0);
    this.sword = sw;
  }
  animate(dt, st, phase) {
    const t = this.t;
    const walk = st === 'chase' || st === 'wander' || st === 'return' || st === 'charge';
    const w = t * (st === 'charge' ? 10 : 5);
    this.legL.rotation.x = walk ? Math.sin(w) * 0.6 : 0; this.legR.rotation.x = walk ? -Math.sin(w) * 0.6 : 0;
    let ar = walk ? 0.3 : -0.3, al = -0.5, rz = 0;
    if (st === 'windup') { ar = -2.6 * Math.min(1, phase * 1.4); rz = 0.3; }
    else if (st === 'attack') { ar = -2.6 + 3.0 * Math.min(1, phase * 3); rz = 0.3 - 0.6 * Math.min(1, phase * 3); }
    this.armR.rotation.x = ar; this.armR.rotation.z = rz; this.armL.rotation.x = al;
    this.torso.rotation.y = st === 'attack' ? -0.4 * Math.sin(phase * Math.PI) : 0;
    this.body.position.y = walk ? Math.abs(Math.sin(w)) * 0.06 : Math.sin(t * 1.5) * 0.02;
    if (st === 'dead') { this.body.rotation.x = -Math.min(1.5, phase * 2); }
  }
}

// ---------- Primordial Shadow ----------
class ShadowModel extends ModelBase {
  constructor(def) {
    super();
    const c = def.color, eye = def.eye;
    this.body = new THREE.Group(); this.body.position.y = 1; this.group.add(this.body);
    this.box(this.body, 0.8, 1.0, 0.5, c, 0, 0.6, 0);
    this.box(this.body, 0.6, 0.6, 0.55, c, 0, 1.4, 0);
    this.box(this.body, 0.12, 0.08, 0.04, eye, -0.13, 1.45, 0.28, eye); this.box(this.body, 0.12, 0.08, 0.04, eye, 0.13, 1.45, 0.28, eye);
    this.box(this.body, 0.14, 0.4, 0.14, shade(c, 1.4), -0.22, 1.85, 0); this.box(this.body, 0.14, 0.4, 0.14, shade(c, 1.4), 0.22, 1.85, 0);
    this.cape = [];
    for (let i = 0; i < 5; i++) { const s = this.box(this.body, 0.22, 1.3, 0.08, shade(c, 0.8 + i * 0.05), -0.44 + i * 0.22, -0.1, -0.24); this.cape.push(s); }
    this.armL = new THREE.Group(); this.armL.position.set(-0.55, 1.0, 0); this.body.add(this.armL);
    this.armR = new THREE.Group(); this.armR.position.set(0.55, 1.0, 0); this.body.add(this.armR);
    this.box(this.armL, 0.22, 0.9, 0.22, c, 0, -0.4, 0); this.box(this.armR, 0.22, 0.9, 0.22, c, 0, -0.4, 0);
    this.box(this.armL, 0.3, 0.3, 0.3, eye, 0, -0.9, 0, eye); this.box(this.armR, 0.3, 0.3, 0.3, eye, 0, -0.9, 0, eye);
    this.shards = new THREE.Group(); this.body.add(this.shards);
    for (let i = 0; i < 6; i++) { const s = this.box(this.shards, 0.18, 0.4, 0.18, eye, 0, 0, 0, eye); s.userData.a = (i / 6) * TAU; }
  }
  animate(dt, st, phase) {
    const t = this.t;
    this.body.position.y = 1 + Math.sin(t * 1.8) * 0.25;
    this.cape.forEach((s, i) => { s.rotation.x = 0.2 + Math.sin(t * 4 + i) * 0.2; });
    this.shards.children.forEach((s) => { const a = s.userData.a + t * 1.6; s.position.set(Math.cos(a) * 1.3, 0.8 + Math.sin(a * 2) * 0.3, Math.sin(a) * 1.3); s.rotation.y = a; });
    const cast = st === 'windup';
    this.armL.rotation.x = cast ? -2.4 : -0.2 + Math.sin(t * 2) * 0.15; this.armR.rotation.x = cast ? -2.4 : -0.2 - Math.sin(t * 2) * 0.15;
    this.armL.rotation.z = cast ? -0.4 : 0.3; this.armR.rotation.z = cast ? 0.4 : -0.3;
    if (st === 'dead') { this.body.scale.setScalar(Math.max(0.01, 1 - phase)); this.body.rotation.y += dt * 10; }
  }
}

export function makeEnemyModel(def) {
  let m;
  switch (def.model) {
    case 'slime': m = new SlimeModel(def); break;
    case 'wolf': m = new WolfModel(def); break;
    case 'sprite': m = new SpriteModel(def); break;
    case 'bat': m = new BatModel(def); break;
    case 'golem': m = new GolemModel(def); break;
    case 'sentinel': m = new SentinelModel(def); break;
    case 'shadow': m = new ShadowModel(def); break;
    default: m = new SlimeModel(def);
  }
  if (def.scale) m.group.scale.setScalar(def.scale);
  return m;
}
