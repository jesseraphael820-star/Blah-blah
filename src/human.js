// Procedural articulated humanoid with walk/run/punch/aim/sit/dead poses and a talking mouth.
import * as THREE from 'three';
import { damp, clamp } from './util.js';

const matCache = new Map();
function mat(color, rough = 0.75, metal = 0) {
  const k = `${color}|${rough}|${metal}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  return matCache.get(k);
}
const geoCache = new Map();
function geo(k, fn) { if (!geoCache.has(k)) geoCache.set(k, fn()); return geoCache.get(k); }
const cap = (r, l) => geo(`cap${r}|${l}`, () => new THREE.CapsuleGeometry(r, l, 4, 10));
const sph = (r, w = 14, h = 10) => geo(`sph${r}|${w}`, () => new THREE.SphereGeometry(r, w, h));
const box = (x, y, z) => geo(`box${x}|${y}|${z}`, () => new THREE.BoxGeometry(x, y, z));

export const SKINS = [0xf1c7a5, 0xd9a27c, 0xb57a52, 0x8d5a3a, 0x5e3a24, 0x3f2618];
export const HAIRS = [0x111111, 0x2b1a10, 0x5a3a1c, 0x9b7a4a, 0x444444];
export const SHIRTS = [0xffffff, 0x1f6fbf, 0xd23c3c, 0x2f8f4f, 0xe0b030, 0x333333, 0xe27a2a, 0x8a5fbf, 0x7fbfe0, 0xc8c8c8];
export const PANTS = [0x2a3550, 0x222222, 0x6b5a45, 0x3d4a3a, 0x8a8a8a, 0x1b2a44];

function part(parent, geometry, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = false;
  parent.add(m); return m;
}
function pivot(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

export class Human {
  constructor(o = {}) {
    const r = Math.random;
    o = { ...o };
    o.skin ??= SKINS[Math.floor(r() * SKINS.length)];
    o.shirt ??= SHIRTS[Math.floor(r() * SHIRTS.length)];
    o.pants ??= PANTS[Math.floor(r() * PANTS.length)];
    o.hair ??= HAIRS[Math.floor(r() * HAIRS.length)];
    o.scale ??= 0.95 + r() * 0.1;
    o.bulk ??= 0.9 + r() * 0.25;
    this.look = o;
    const skin = mat(o.skin, 0.6);
    const shirt = mat(o.shirt, 0.85);
    const pants = mat(o.pants, 0.9);
    const shoes = mat(o.shoes ?? 0x1a1a1a, 0.5);
    const hairM = mat(o.hair, 0.9);
    const lipM = mat(0x8a4a3e, 0.5), dark = mat(0x1a0606, 1), white = mat(0xf4f4f0, 0.3), iris = mat(o.eyes ?? 0x3a2412, 0.2);
    const scale = o.scale, bulk = o.bulk;

    this.root = new THREE.Group();
    this.model = pivot(this.root); this.model.scale.setScalar(scale);
    this.hips = pivot(this.model, 0, 0.95, 0);
    part(this.hips, box(0.34 * bulk, 0.16, 0.2), pants, 0, 0, 0);
    this.spine = pivot(this.hips, 0, 0.06, 0);
    const torso = part(this.spine, cap(0.17, 0.26), shirt, 0, 0.24, 0);
    torso.scale.set(1.12 * bulk, 1, 0.72 * bulk);
    if (o.vest) part(this.spine, box(0.36 * bulk, 0.34, 0.27 * bulk), mat(o.vest, 0.7), 0, 0.27, 0);
    if (o.badge) part(this.spine, box(0.05, 0.05, 0.01), mat(0xffd34a, 0.3, 0.8), 0.09, 0.36, 0.13 * bulk, false);
    this.neck = pivot(this.spine, 0, 0.5, 0);
    part(this.neck, cap(0.05, 0.06), skin, 0, 0.03, 0);
    this.head = pivot(this.neck, 0, 0.14, 0);
    const skull = part(this.head, sph(0.12, 20, 16), skin, 0, 0, 0);
    skull.scale.set(0.9, 1.06, 1);
    // jaw/chin volume
    const chin = part(this.head, sph(0.085, 14, 10), skin, 0, -0.06, 0.03); chin.scale.set(1, 0.8, 1);
    // hair
    if (!o.bald) { const hm = part(this.head, sph(0.125, 18, 10), hairM, 0, 0.025, -0.012); hm.scale.set(0.93, 0.9, 1); }
    if (o.hat === 'cap') { part(this.head, geo('capHat', () => new THREE.CylinderGeometry(0.125, 0.13, 0.08, 16)), mat(o.hatColor ?? 0x15243f, 0.6), 0, 0.1, 0); part(this.head, box(0.2, 0.015, 0.12), mat(o.hatColor ?? 0x15243f, 0.6), 0, 0.07, 0.12); }
    if (o.hat === 'bandana') { const bd = part(this.head, sph(0.128, 16, 8), mat(o.hatColor ?? 0x6a1fb0, 0.8), 0, 0.03, 0); bd.scale.set(0.95, 0.75, 1.02); }
    // ears & nose
    part(this.head, box(0.025, 0.05, 0.03), skin, 0.108, -0.005, 0, false);
    part(this.head, box(0.025, 0.05, 0.03), skin, -0.108, -0.005, 0, false);
    const nose = part(this.head, geo('nose', () => new THREE.ConeGeometry(0.02, 0.05, 6)), skin, 0, -0.01, 0.125, false);
    nose.rotation.x = Math.PI / 2;
    // eyes
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const e = pivot(this.head, 0.04 * sx, 0.025, 0.098);
      part(e, sph(0.02, 10, 8), white, 0, 0, 0, false);
      part(e, sph(0.011, 8, 6), iris, 0, 0, 0.014, false);
      const lid = part(e, sph(0.022, 10, 6), skin, 0, 0.002, 0.002, false); lid.scale.set(1, 0.05, 1);
      e.userData.lid = lid;
      part(this.head, box(0.045, 0.008, 0.01), hairM, 0.042 * sx, 0.055, 0.11, false); // eyebrow
      this.eyes.push(e);
    }
    // mouth: interior, upper lip, jaw pivot with lower lip
    this.mouth = pivot(this.head, 0, -0.05, 0.112);
    this.mouthInner = part(this.mouth, box(0.05, 0.03, 0.01), dark, 0, -0.004, 0.001, false);
    this.teeth = part(this.mouth, box(0.04, 0.008, 0.008), white, 0, 0.006, 0.004, false);
    this.upperLip = part(this.mouth, box(0.056, 0.012, 0.016), lipM, 0, 0.011, 0.007, false);
    this.jaw = pivot(this.mouth, 0, 0.004, -0.03);
    this.lowerLip = part(this.jaw, box(0.052, 0.013, 0.016), lipM, 0, -0.016, 0.037, false);
    this.mouthOpen = 0; this.mouthWide = 0.5;

    // arms
    const mkArm = (sx) => {
      const sh = pivot(this.spine, 0.215 * sx * bulk, 0.44, 0);
      part(sh, sph(0.075), shirt, 0, 0, 0);
      part(sh, cap(0.058, 0.2), o.longSleeve ? shirt : skin, 0, -0.15, 0);
      if (!o.longSleeve) part(sh, cap(0.064, 0.08), shirt, 0, -0.06, 0);
      const el = pivot(sh, 0, -0.29, 0);
      part(el, cap(0.05, 0.2), skin, 0, -0.13, 0);
      const hand = part(el, sph(0.055, 10, 8), skin, 0, -0.28, 0.01); hand.scale.set(0.8, 1, 0.65);
      return { sh, el, hand };
    };
    this.armL = mkArm(1); this.armR = mkArm(-1);
    // legs
    const mkLeg = (sx) => {
      const hp = pivot(this.hips, 0.1 * sx * bulk, -0.04, 0);
      part(hp, cap(0.085 * bulk, 0.3), pants, 0, -0.22, 0);
      const kn = pivot(hp, 0, -0.44, 0);
      part(kn, cap(0.068, 0.3), pants, 0, -0.21, 0);
      part(kn, box(0.11, 0.08, 0.26), shoes, 0, -0.45, 0.05);
      return { hp, kn };
    };
    this.legL = mkLeg(1); this.legR = mkLeg(-1);

    // weapon
    this.gun = new THREE.Group();
    part(this.gun, box(0.04, 0.07, 0.2), mat(0x1c1c1e, 0.35, 0.8), 0, 0.02, 0.05, false);
    part(this.gun, box(0.035, 0.1, 0.04), mat(0x2a2016, 0.6), 0, -0.04, -0.03, false);
    this.gun.position.set(0, -0.31, 0.04); this.gun.rotation.x = -Math.PI / 2;
    this.armR.el.add(this.gun); this.gun.visible = false;

    this.phase = Math.random() * 6;
    this.blinkT = 2 + Math.random() * 3;
    this.punchT = 0; this.punchSide = 1;
    this.deadT = 0;
    this.pose = { lean: 0, tuck: 0, sit: 0, aim: 0, dead: 0, cower: 0, hands: 0 };
    this.headYaw = 0;
  }

  punch() { this.punchT = 0.38; this.punchSide = -this.punchSide; }

  // ctx: {speed, grounded, aim, sit, dead, cower, talk, lookYaw}
  update(dt, ctx) {
    const sp = ctx.speed || 0;
    const P = this.pose;
    P.sit = damp(P.sit, ctx.sit ? 1 : 0, 12, dt);
    P.dead = damp(P.dead, ctx.dead ? 1 : 0, 6, dt);
    P.aim = damp(P.aim, ctx.aim ? 1 : 0, 14, dt);
    P.cower = damp(P.cower, ctx.cower ? 1 : 0, 8, dt);
    P.tuck = damp(P.tuck, ctx.grounded === false ? 1 : 0, 10, dt);
    const run = clamp((sp - 2.2) / 4, 0, 1);
    P.lean = damp(P.lean, run * 0.22, 6, dt);
    this.phase += dt * (sp > 0.1 ? 1.6 + sp * 1.25 : 0);
    const ph = this.phase;
    const moving = clamp(sp / 1.5, 0, 1);
    const legA = moving * (0.45 + run * 0.45), kneeA = moving * (0.5 + run * 0.9);
    const armA = moving * (0.35 + run * 0.6);
    const s = Math.sin(ph), c = Math.cos(ph);
    const t = performance.now() / 1000;
    const breathe = Math.sin(t * 1.8) * 0.015;

    let lHip = -s * legA, rHip = s * legA;
    let lKnee = Math.max(0, c) * kneeA + 0.05, rKnee = Math.max(0, -c) * kneeA + 0.05;
    let lSh = s * armA, rSh = -s * armA;
    let lEl = -0.25 - run * 0.9, rEl = -0.25 - run * 0.9;
    let lShZ = 0.08, rShZ = -0.08;
    let hipsY = 0.95 - Math.abs(c) * 0.05 * moving - run * 0.03;
    let spineX = P.lean + breathe, spineY = 0;

    // air tuck
    lHip = lHip * (1 - P.tuck) - 0.6 * P.tuck; rHip = rHip * (1 - P.tuck) - 0.2 * P.tuck;
    lKnee = lKnee * (1 - P.tuck) + 1.1 * P.tuck; rKnee = rKnee * (1 - P.tuck) + 0.5 * P.tuck;
    lSh -= 0.5 * P.tuck; rSh -= 0.5 * P.tuck; lShZ += 0.4 * P.tuck; rShZ -= 0.4 * P.tuck;

    // punch
    if (this.punchT > 0) {
      this.punchT -= dt;
      const k = Math.sin(clamp(1 - this.punchT / 0.38, 0, 1) * Math.PI);
      if (this.punchSide > 0) { rSh = -1.55 * k + rSh * (1 - k); rEl = -0.1 * k + rEl * (1 - k); spineY = -0.4 * k; }
      else { lSh = -1.55 * k + lSh * (1 - k); lEl = -0.1 * k + lEl * (1 - k); spineY = 0.4 * k; }
      lEl = Math.min(lEl, -1.6 * (1 - k) * 0.5 - 0.2); // guard
    }
    // aim pistol (right arm forward)
    if (P.aim > 0.01) {
      const a = P.aim;
      rSh = rSh * (1 - a) - 1.5 * a; rEl = rEl * (1 - a) + 0 * a; rShZ = rShZ * (1 - a) + 0.05 * a;
      lSh = lSh * (1 - a) - 1.2 * a; lEl = lEl * (1 - a) - 0.5 * a; lShZ = lShZ * (1 - a) - 0.45 * a;
      spineY += -0.1 * a;
    }
    // cower (hands up)
    if (P.cower > 0.01) {
      const a = P.cower;
      lSh = lSh * (1 - a) - 2.6 * a; rSh = rSh * (1 - a) - 2.6 * a; lEl = lEl * (1 - a) - 0.6 * a; rEl = rEl * (1 - a) - 0.6 * a;
      lShZ += 0.3 * a; rShZ -= 0.3 * a;
    }
    // sit
    if (P.sit > 0.01) {
      const a = P.sit;
      lHip = lHip * (1 - a) - 1.45 * a; rHip = rHip * (1 - a) - 1.45 * a;
      lKnee = lKnee * (1 - a) + 1.45 * a; rKnee = rKnee * (1 - a) + 1.45 * a;
      lSh = lSh * (1 - a) - 0.9 * a; rSh = rSh * (1 - a) - 0.9 * a; lEl = lEl * (1 - a) - 0.7 * a; rEl = rEl * (1 - a) - 0.7 * a;
      hipsY = hipsY * (1 - a) + 0.5 * a; spineX = spineX * (1 - a) - 0.12 * a;
    }

    const L = this.legL, R = this.legR, AL = this.armL, AR = this.armR;
    L.hp.rotation.x = lHip; R.hp.rotation.x = rHip; L.kn.rotation.x = lKnee; R.kn.rotation.x = rKnee;
    AL.sh.rotation.x = lSh; AR.sh.rotation.x = rSh; AL.sh.rotation.z = lShZ; AR.sh.rotation.z = rShZ;
    AL.el.rotation.x = lEl; AR.el.rotation.x = rEl;
    this.hips.position.y = hipsY;
    this.spine.rotation.x = spineX; this.spine.rotation.y = spineY;
    this.hips.rotation.y = -spineY * 0.3;

    // dead: fall on back
    this.model.rotation.x = -P.dead * Math.PI / 2;
    this.model.position.y = P.dead * 0.12;
    this.model.position.z = P.dead * 0.9;
    if (P.dead > 0.5) { AL.sh.rotation.z = 1.2; AR.sh.rotation.z = -1.2; L.hp.rotation.z = 0.2; R.hp.rotation.z = -0.2; }
    else { L.hp.rotation.z = 0; R.hp.rotation.z = 0; }

    // head look
    this.headYaw = damp(this.headYaw, clamp(ctx.lookYaw || 0, -1.1, 1.1), 6, dt);
    this.head.rotation.y = this.headYaw;
    this.neck.rotation.x = -spineX * 0.6;

    // blink
    this.blinkT -= dt;
    const closed = this.blinkT < 0.12 || ctx.dead;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 4;
    for (const e of this.eyes) e.userData.lid.scale.y = closed ? 1 : 0.05;

    // mouth (lip sync driven from outside via setMouth)
    const open = this.mouthOpen, wide = this.mouthWide;
    this.jaw.rotation.x = open * 0.42;
    this.mouthInner.scale.set(0.6 + wide * 0.5, 0.15 + open * 1.6, 1);
    this.mouthInner.position.y = -0.004 - open * 0.012;
    this.upperLip.scale.x = 0.85 + wide * 0.3; this.lowerLip.scale.x = 0.85 + wide * 0.3;
    this.teeth.visible = open > 0.15;
  }

  setMouth(open, wide = 0.5) { this.mouthOpen = open; this.mouthWide = wide; }
  showGun(v) { this.gun.visible = v; }
}
