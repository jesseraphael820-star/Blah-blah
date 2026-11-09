// Voxel humanoid used by the player and NPCs: customizable parts, pixel-art
// face texture (blinking eyes, talking mouth, expressions) and procedural animation.
import * as THREE from 'three';
import { unitBox, colorMat } from '../render/voxel.js';
import { swordGeometry } from '../render/models.js';
import { getWorldMaterial } from '../render/voxel.js';
import { damp, shade, clamp, TAU } from '../core/utils.js';
import { ARMORS } from '../data/items.js';

const hex = (c) => '#' + (c >>> 0).toString(16).padStart(6, '0');

function part(sx, sy, sz, color, px = 0, py = 0, pz = 0, emissive = 0) {
  const m = new THREE.Mesh(unitBox, colorMat(color, emissive, emissive ? 0.6 : 1));
  m.scale.set(sx, sy, sz);
  m.position.set(px, py, pz);
  m.castShadow = true;
  return m;
}

export class Humanoid {
  constructor(look) {
    this.root = new THREE.Group();
    this.look = look;
    this.face = { expr: 'neutral', mouth: 'closed', blink: 0, lookX: 0, talking: false, mouthT: 0, blinkT: 2 + Math.random() * 3 };
    this.canvas = document.createElement('canvas');
    this.canvas.width = 16; this.canvas.height = 16;
    this.ctx = this.canvas.getContext('2d');
    this.faceTex = new THREE.CanvasTexture(this.canvas);
    this.faceTex.magFilter = THREE.NearestFilter; this.faceTex.minFilter = THREE.NearestFilter;
    this.faceTex.colorSpace = THREE.SRGBColorSpace;
    this.rot = {};
    this.anim = { name: 'idle', phase: 0 };
    this.walkPhase = 0;
    this.build(look);
  }

  // ---------- construction ----------
  build(look) {
    this.look = look;
    if (this.body) this.root.remove(this.body);
    const pal = look.pal;
    const B = this.body = new THREE.Group();
    this.root.add(B);
    const shirt = pal.shirt, pants = pal.pants, skin = pal.skin, shoes = pal.shoes, trim = pal.trim ?? shade(shirt, 0.7);
    const glow = look.glow || 0;
    const armor = look.armor && ARMORS[look.armor] && ARMORS[look.armor].color ? ARMORS[look.armor] : null;
    // hips pivot
    this.hips = new THREE.Group(); this.hips.position.y = 0.64; B.add(this.hips);
    const mkLeg = (side) => {
      const g = new THREE.Group(); g.position.set(side * 0.15, 0, 0);
      g.add(part(0.26, 0.5, 0.28, pants, 0, -0.25, 0));
      g.add(part(0.28, 0.16, 0.34, shoes, 0, -0.56, 0.03));
      if (armor) g.add(part(0.29, 0.22, 0.31, armor.color, 0, -0.32, 0.01));
      this.hips.add(g); return g;
    };
    this.legL = mkLeg(-1); this.legR = mkLeg(1);
    // torso pivot (twist)
    this.torso = new THREE.Group(); this.torso.position.y = 0.64; B.add(this.torso);
    this.torso.add(part(0.62, 0.62, 0.36, shirt, 0, 0.31, 0, glow ? shade(glow, 0.3) : 0));
    this.torso.add(part(0.64, 0.09, 0.38, trim, 0, 0.05, 0));
    if (look.apron) this.torso.add(part(0.5, 0.55, 0.04, look.apron, 0, 0.22, 0.19));
    if (armor) {
      this.torso.add(part(0.68, 0.5, 0.42, armor.color, 0, 0.36, 0, armor.glow ? shade(armor.glow, 0.25) : 0));
      this.torso.add(part(0.7, 0.08, 0.44, armor.trim, 0, 0.6, 0, armor.glow || 0));
      this.torso.add(part(0.12, 0.3, 0.05, armor.trim, 0, 0.36, 0.22, armor.glow || 0));
    }
    // head
    this.neck = new THREE.Group(); this.neck.position.y = 0.62; this.torso.add(this.neck);
    const faceMat = new THREE.MeshLambertMaterial({ map: this.faceTex });
    const sk = colorMat(skin, glow ? shade(glow, 0.2) : 0);
    this.head = new THREE.Mesh(unitBox, [sk, sk, sk, sk, faceMat, sk]);
    this.head.scale.set(0.62, 0.62, 0.62);
    this.head.position.y = 0.31;
    this.head.castShadow = true;
    this.neck.add(this.head);
    this.headTop = new THREE.Group(); this.headTop.position.y = 0.31; this.neck.add(this.headTop);
    this.buildHair(look);
    this.buildHat(look);
    // arms
    const mkArm = (side) => {
      const g = new THREE.Group(); g.position.set(side * 0.41, 0.56, 0);
      g.add(part(0.2, 0.34, 0.22, shirt, 0, -0.15, 0, glow ? shade(glow, 0.3) : 0));
      g.add(part(0.18, 0.26, 0.2, skin, 0, -0.43, 0));
      if (armor && armor.pads) g.add(part(0.3, 0.16, 0.3, armor.trim, side * 0.02, 0.02, 0, armor.glow || 0));
      const hand = new THREE.Group(); hand.position.set(0, -0.54, 0.02); g.add(hand);
      this.torso.add(g);
      return { g, hand };
    };
    const L = mkArm(-1), R = mkArm(1);
    this.armL = L.g; this.armR = R.g; this.handL = L.hand; this.handR = R.hand;
    this.buildAccessory(look);
    this.buildTool(look);
    if (look.sword) this.setSword(look.sword);
    this.drawFace();
    this.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.root.scale.setScalar(look.scale || 1);
  }

  buildHair(look) {
    const hc = look.pal.hair, T = this.headTop;
    const st = look.hairStyle || 'short';
    if (st === 'bald') {
      T.add(part(0.64, 0.16, 0.2, hc, 0, -0.18, -0.24));
      return;
    }
    T.add(part(0.66, 0.14, 0.66, hc, 0, 0.05, 0));
    T.add(part(0.66, 0.42, 0.1, hc, 0, -0.18, -0.29));
    T.add(part(0.06, 0.26, 0.5, hc, -0.33, -0.08, -0.05));
    T.add(part(0.06, 0.26, 0.5, hc, 0.33, -0.08, -0.05));
    if (st === 'long') {
      T.add(part(0.68, 0.82, 0.14, hc, 0, -0.45, -0.3));
      T.add(part(0.1, 0.6, 0.2, hc, -0.33, -0.4, 0.15)); T.add(part(0.1, 0.6, 0.2, hc, 0.33, -0.4, 0.15));
    } else if (st === 'spiky') {
      for (let i = 0; i < 5; i++) T.add(part(0.16, 0.22, 0.16, hc, -0.24 + i * 0.12, 0.2 + (i % 2) * 0.05, -0.1 + (i % 3) * 0.12));
    } else if (st === 'ponytail') {
      T.add(part(0.2, 0.2, 0.2, hc, 0, 0, -0.38));
      const tail = part(0.16, 0.55, 0.16, hc, 0, -0.32, -0.42); this.tail = tail; T.add(tail);
    } else if (st === 'bun') {
      T.add(part(0.32, 0.26, 0.32, hc, 0, 0.18, -0.16));
    } else if (st === 'braid') {
      for (let i = 0; i < 4; i++) T.add(part(0.14 - i * 0.01, 0.16, 0.14, i % 2 ? shade(hc, 0.85) : hc, 0.18, -0.4 - i * 0.16, -0.3));
    } else if (st === 'messy') {
      T.add(part(0.2, 0.12, 0.2, hc, 0.2, 0.15, 0.1)); T.add(part(0.2, 0.12, 0.2, hc, -0.15, 0.14, -0.1)); T.add(part(0.18, 0.1, 0.18, hc, 0.05, 0.16, 0.22));
    }
    if (look.beard) T.add(part(0.5, 0.24, 0.08, hc, 0, -0.58, 0.31));
  }

  buildHat(look) {
    const T = this.headTop, h = look.hat || 'none';
    if (h === 'straw') {
      T.add(part(1.0, 0.06, 1.0, 0xe0c060, 0, 0.08, 0)); T.add(part(0.62, 0.22, 0.62, 0xd8b850, 0, 0.2, 0)); T.add(part(0.64, 0.06, 0.64, 0xc83a2a, 0, 0.12, 0));
    } else if (h === 'cap') {
      T.add(part(0.68, 0.18, 0.68, 0xc83a3a, 0, 0.1, 0)); T.add(part(0.5, 0.05, 0.32, 0xc83a3a, 0, 0.04, 0.44));
    } else if (h === 'flower') {
      const cs = [0xf04a8a, 0xf0d040, 0xffffff, 0xb070f0];
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; T.add(part(0.13, 0.13, 0.13, cs[i % 4], Math.cos(a) * 0.32, 0.12, Math.sin(a) * 0.32)); }
    } else if (h === 'hood') {
      const c = look.hoodColor || shade(look.pal.shirt, 0.85);
      T.add(part(0.74, 0.16, 0.74, c, 0, 0.08, -0.02)); T.add(part(0.74, 0.74, 0.1, c, 0, -0.26, -0.36));
      T.add(part(0.08, 0.66, 0.7, c, -0.37, -0.24, -0.02)); T.add(part(0.08, 0.66, 0.7, c, 0.37, -0.24, -0.02));
    } else if (h === 'helmet') {
      T.add(part(0.72, 0.36, 0.72, 0xa8b0b8, 0, -0.02, 0)); T.add(part(0.08, 0.26, 0.06, 0xa8b0b8, 0, -0.24, 0.36));
      T.add(part(0.1, 0.24, 0.5, 0xc83a3a, 0, 0.26, -0.05));
    } else if (h === 'wizard') {
      const c = look.pal.trim && look.skinId === 'mage' ? 0x5a1a8a : 0x3a2a8a;
      T.add(part(0.96, 0.06, 0.96, c, 0, 0.08, 0));
      for (let k = 0; k < 5; k++) T.add(part(0.6 - k * 0.11, 0.2, 0.6 - k * 0.11, k % 2 ? shade(c, 1.15) : c, 0, 0.2 + k * 0.2, -k * 0.04));
      T.add(part(0.12, 0.12, 0.12, 0xffd36a, 0, 1.2, -0.22, 0xffd36a));
    } else if (h === 'crown') {
      T.add(part(0.68, 0.14, 0.68, 0xffc83a, 0, 0.1, 0, 0x6a4a00));
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) T.add(part(0.1, 0.16, 0.1, 0xffc83a, s * 0.28, 0.24, -0.28 + i * 0.19));
      T.add(part(0.1, 0.1, 0.06, 0xff3a5a, 0, 0.14, 0.35, 0xaa1a2a));
    }
  }

  buildAccessory(look) {
    const a = look.acc || 'none';
    this.cape = null; this.wings = null;
    if (a === 'scarf') {
      this.torso.add(part(0.7, 0.14, 0.44, 0xd83a3a, 0, 0.6, 0));
      const tail = part(0.16, 0.5, 0.06, 0xd83a3a, 0.16, 0.36, -0.22); this.scarf = tail; this.torso.add(tail);
    } else if (a === 'backpack') {
      this.torso.add(part(0.5, 0.56, 0.24, 0x8a5a32, 0, 0.32, -0.3)); this.torso.add(part(0.4, 0.14, 0.08, 0x6a4422, 0, 0.18, -0.44));
    } else if (a === 'cape') {
      const g = new THREE.Group(); g.position.set(0, 0.6, -0.2);
      g.add(part(0.72, 1.15, 0.05, look.capeColor || 0xb02a3a, 0, -0.56, 0)); this.cape = g; this.torso.add(g);
    } else if (a === 'wings') {
      const g = new THREE.Group(); g.position.set(0, 0.42, -0.22);
      for (const s of [-1, 1]) {
        const w = new THREE.Group(); w.position.x = s * 0.1;
        w.add(part(0.9, 0.5, 0.04, 0xfff0c0, s * 0.5, 0.1, -0.02, 0xffd36a));
        w.add(part(0.6, 0.3, 0.04, 0xffe0a0, s * 0.45, -0.25, -0.02, 0xffd36a));
        w.userData.side = s; g.add(w);
      }
      this.wings = g; this.torso.add(g);
    }
  }

  buildTool(look) {
    if (look.staff) { const s = part(0.08, 1.9, 0.08, 0x6a4428, 0, 0.3, 0); const top = part(0.18, 0.18, 0.18, 0x6affd8, 0, 1.28, 0, 0x3ab0a0); this.handL.add(s, top); }
    if (look.spear) { this.handR.add(part(0.07, 2.4, 0.07, 0x7a5232, 0, 0.5, 0)); this.handR.add(part(0.12, 0.35, 0.05, 0xc0c8d0, 0, 1.85, 0)); }
    if (look.hoe) { this.handR.add(part(0.07, 1.6, 0.07, 0x8a5a30, 0, 0.3, 0)); this.handR.add(part(0.3, 0.08, 0.2, 0x8a949c, 0, 1.1, 0.1)); }
    if (look.book) { this.handL.add(part(0.34, 0.08, 0.26, 0x6a2a2a, 0.12, 0, 0.12)); }
    if (look.rod) { const r = part(0.05, 2.4, 0.05, 0x8a6a3a, 0, 0.9, 0.3); r.rotation.x = 0.7; this.handR.add(r); }
    if (look.bow) { this.torso.add(part(0.08, 1.1, 0.08, 0x6a4428, 0.2, 0.4, -0.25)); }
  }

  setSword(id) {
    if (this.sword) { this.handR.remove(this.sword); this.sword = null; }
    if (!id) return;
    const m = new THREE.Mesh(swordGeometry(id), getWorldMaterial());
    m.castShadow = true;
    m.position.set(0, -0.02, 0);
    m.rotation.x = Math.PI / 2;
    this.sword = m;
    this.handR.add(m);
  }

  // ---------- face ----------
  drawFace() {
    const c = this.ctx, F = this.face, look = this.look, pal = look.pal;
    const skel = look.skinId === 'skeleton';
    const px = (x, y, col) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
    const rect = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    rect(0, 0, 16, 16, hex(pal.skin));
    const hair = hex(pal.hair);
    const st = look.hairStyle || 'short';
    if (st !== 'bald' && look.hat !== 'helmet') {
      rect(0, 0, 16, 2, hair);
      const fringe = st === 'spiky' ? [0, 2, 3, 5, 7, 8, 10, 12, 13, 15] : st === 'long' || st === 'ponytail' || st === 'braid' ? [0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 15] : [0, 1, 2, 5, 6, 7, 8, 12, 13, 14, 15];
      for (const x of fringe) px(x, 2, hair);
      if (st === 'long' || st === 'braid') { rect(0, 3, 1, 8, hair); rect(15, 3, 1, 8, hair); }
      if (st === 'messy') { px(3, 3, hair); px(11, 3, hair); }
    } else if (look.hat === 'helmet') rect(0, 0, 16, 4, '#a8b0b8');
    const ex = F.lookX | 0;
    const eye = hex(pal.eye ?? 0x2a2a3a);
    const L = 4 + ex, R = 10 + ex;
    const e = F.blink > 0 ? 'blink' : F.expr;
    const dark = skel ? '#000000' : eye;
    // brows
    const brow = skel ? null : hex(shade(pal.hair, 0.8));
    if (brow) {
      if (F.expr === 'angry' || F.expr === 'fight') { px(L - 1, 5, brow); px(L, 5, brow); px(L + 1, 6, brow); px(R + 1, 5, brow); px(R + 2, 5, brow); px(R, 6, brow); }
      else if (F.expr === 'sad') { px(L - 1, 6, brow); px(L, 5, brow); px(L + 1, 5, brow); px(R, 5, brow); px(R + 1, 5, brow); px(R + 2, 6, brow); }
      else if (F.expr === 'surprised') { rect(L - 1, 4, 3, 1, brow); rect(R, 4, 3, 1, brow); }
      else { rect(L - 1, 5, 3, 1, brow); rect(R, 5, 3, 1, brow); }
    }
    if (skel) { rect(L - 1, 6, 3, 4, '#000'); rect(R - 0, 6, 3, 4, '#000'); px(L, 8, hex(pal.eye)); px(R + 1, 8, hex(pal.eye)); }
    else if (e === 'blink') { rect(L - 1, 8, 3, 1, dark); rect(R, 8, 3, 1, dark); }
    else if (e === 'happy') { px(L - 1, 8, dark); px(L, 7, dark); px(L + 1, 8, dark); px(R, 8, dark); px(R + 1, 7, dark); px(R + 2, 8, dark); }
    else if (e === 'hurt') { px(L - 1, 7, dark); px(L, 8, dark); px(L - 1, 9, dark); px(R + 2, 7, dark); px(R + 1, 8, dark); px(R + 2, 9, dark); }
    else if (e === 'surprised') { rect(L - 1, 6, 3, 4, '#ffffff'); rect(L, 7, 1, 2, dark); rect(R, 6, 3, 4, '#ffffff'); rect(R + 1, 7, 1, 2, dark); }
    else if (e === 'sleep') { rect(L - 1, 8, 3, 1, dark); rect(R, 8, 3, 1, dark); }
    else {
      rect(L - 1, 7, 2, 3, '#ffffff'); rect(R + 1, 7, 2, 3, '#ffffff');
      rect(L, 7, 2, 3, dark); rect(R, 7, 2, 3, dark);
      px(L, 7, '#ffffff'); px(R, 7, '#ffffff');
    }
    if (look.glasses || look.acc === 'glasses') {
      const g = '#2a2a2a';
      rect(2, 6, 5, 1, g); rect(2, 10, 5, 1, g); rect(2, 6, 1, 5, g); rect(6, 6, 1, 5, g);
      rect(9, 6, 5, 1, g); rect(9, 10, 5, 1, g); rect(9, 6, 1, 5, g); rect(13, 6, 1, 5, g); rect(7, 7, 2, 1, g);
    }
    // cheeks
    if ((F.expr === 'happy' || F.expr === 'smile') && !skel) { px(2, 10, '#f08a8a'); px(3, 10, '#f08a8a'); px(12, 10, '#f08a8a'); px(13, 10, '#f08a8a'); }
    // beard
    if (look.beard) { rect(2, 11, 12, 5, hair); rect(4, 10, 8, 1, hair); }
    if (look.mask) rect(0, 10, 16, 6, hex(look.mask));
    // mouth
    const m = F.mouth;
    const mc = skel ? '#000' : '#5a2a2a';
    const tongue = '#d05a5a';
    if (skel) { rect(5, 12, 6, 2, '#000'); for (let x = 5; x < 11; x += 2) px(x, 12, '#f0ece0'); px(7, 10, '#000'); px(8, 10, '#000'); }
    else if (!look.mask) {
      if (m === 'open') { rect(7, 11, 2, 3, mc); px(7, 13, tongue); px(8, 13, tongue); }
      else if (m === 'wide') { rect(6, 11, 4, 3, mc); rect(7, 13, 2, 1, tongue); }
      else if (m === 'smile') { px(5, 11, mc); rect(6, 12, 4, 1, mc); px(10, 11, mc); }
      else if (m === 'frown') { rect(6, 12, 4, 1, mc); px(5, 13, mc); px(10, 13, mc); }
      else if (m === 'o') { rect(7, 11, 2, 3, mc); }
      else rect(7, 12, 2, 1, mc);
    }
    this.faceTex.needsUpdate = true;
  }

  setExpression(expr) { if (this.face.expr !== expr) { this.face.expr = expr; this.faceDirty = true; } }
  setTalking(on) { this.face.talking = on; if (!on) { this.face.mouth = this.baseMouth(); this.faceDirty = true; } }
  baseMouth() {
    const e = this.face.expr;
    return e === 'happy' || e === 'smile' ? 'smile' : e === 'sad' || e === 'angry' ? 'frown' : e === 'surprised' ? 'o' : e === 'fight' ? 'wide' : 'closed';
  }

  updateFace(dt) {
    const F = this.face;
    F.blinkT -= dt;
    if (F.blink > 0) { F.blink -= dt; if (F.blink <= 0) this.faceDirty = true; }
    else if (F.blinkT <= 0) { F.blink = 0.12; F.blinkT = 2 + Math.random() * 4; this.faceDirty = true; }
    if (F.talking) {
      F.mouthT -= dt;
      if (F.mouthT <= 0) {
        F.mouthT = 0.07 + Math.random() * 0.08;
        const opts = ['open', 'wide', 'closed', 'open', 'o'];
        F.mouth = opts[Math.floor(Math.random() * opts.length)];
        this.faceDirty = true;
      }
    } else {
      const bm = this.baseMouth();
      if (F.mouth !== bm) { F.mouth = bm; this.faceDirty = true; }
    }
    if (this.faceDirty) { this.faceDirty = false; this.drawFace(); }
  }

  // ---------- animation ----------
  // name: pose id; phase: 0..1 for actions; speed: movement speed factor
  pose(name, phase, dt, o = {}) {
    const T = {
      bodyY: 0, bodyRX: 0, bodyRZ: 0, torsoY: 0, torsoX: 0,
      headX: 0, headY: o.headY || 0,
      aLX: 0, aLZ: 0.08, aRX: 0, aRZ: -0.08, aRY: 0, wristX: 0, wristY: 0,
      lLX: 0, lRX: 0, spin: 0,
    };
    let lam = 14;
    const t = performance.now() / 1000;
    const p = phase;
    switch (name) {
      case 'idle': {
        T.bodyY = Math.sin(t * 2.2) * 0.012;
        T.aLZ = 0.08 + Math.sin(t * 2.2) * 0.03; T.aRZ = -0.08 - Math.sin(t * 2.2) * 0.03;
        T.headX = Math.sin(t * 0.7) * 0.04;
        if (o.armed) { T.aRX = -0.25; T.wristX = 0.3; }
        break;
      }
      case 'walk': case 'run': {
        const run = name === 'run';
        this.walkPhase += dt * (o.speed || 4) * (run ? 1.25 : 1.6);
        const w = this.walkPhase;
        const amp = run ? 1.0 : 0.62;
        T.lLX = Math.sin(w) * amp; T.lRX = -Math.sin(w) * amp;
        T.aLX = -Math.sin(w) * amp * 0.85; T.aRX = Math.sin(w) * amp * 0.85 + (o.armed ? -0.2 : 0);
        T.bodyY = Math.abs(Math.sin(w)) * (run ? 0.11 : 0.06);
        T.bodyRX = run ? 0.22 : 0.05;
        T.torsoY = Math.sin(w) * 0.12;
        if (run) { T.aLX -= 0.3; T.aRX -= 0.3; }
        lam = 18;
        break;
      }
      case 'swim': {
        this.walkPhase += dt * 4;
        const w = this.walkPhase;
        T.bodyRX = 1.1; T.bodyY = -0.9;
        T.aLX = -2.4 + Math.sin(w) * 1.2; T.aRX = -2.4 - Math.sin(w) * 1.2;
        T.lLX = Math.sin(w * 2) * 0.4; T.lRX = -Math.sin(w * 2) * 0.4;
        T.headX = -0.8;
        break;
      }
      case 'jump': T.lLX = -0.7; T.lRX = 0.3; T.aLX = -2.5; T.aRX = -2.2; T.aLZ = 0.4; T.aRZ = -0.4; break;
      case 'fall': T.lLX = -0.3; T.lRX = 0.2; T.aLZ = 1.1; T.aRZ = -1.1; T.aLX = -0.5; T.aRX = -0.5; break;
      case 'attack1': { // diagonal slash
        lam = 34;
        const k = p < 0.28 ? p / 0.28 : p < 0.55 ? 1 + (p - 0.28) / 0.27 : 2;
        const s = Math.min(1, Math.max(0, k - 1));
        if (k < 1) { T.torsoY = 0.7 * k; T.aRX = -2.5 * k; T.aRZ = -0.1 + 0.5 * k; T.wristX = 1.0; }
        else { T.torsoY = 0.7 - 1.5 * s; T.aRX = -2.5 + 2.0 * s; T.aRZ = 0.4 - 0.9 * s; T.wristX = 1.0 + 1.2 * s; }
        if (p > 0.55) { const r = (p - 0.55) / 0.45; T.torsoY *= 1 - r; T.aRX *= 1 - r * 0.7; T.wristX = 2.2 - r * 1.6; }
        T.lLX = 0.35; T.lRX = -0.3; T.bodyRX = 0.12; T.aLX = 0.4; T.aLZ = 0.3;
        break;
      }
      case 'attack2': { // reverse horizontal
        lam = 34;
        const w = Math.min(1, p / 0.25), s = Math.min(1, Math.max(0, (p - 0.25) / 0.3));
        T.torsoY = -0.8 * w + 1.7 * s;
        T.aRX = -1.5; T.aRZ = -1.1 * w + 2.1 * s; T.aRY = 0; T.wristX = 1.57; T.wristY = 0.4;
        if (p > 0.6) { const r = (p - 0.6) / 0.4; T.torsoY *= 1 - r; T.aRZ *= 1 - r; T.aRX *= 1 - r * 0.8; }
        T.lLX = -0.3; T.lRX = 0.35; T.bodyRX = 0.1; T.aLX = 0.3; T.aLZ = 0.5;
        break;
      }
      case 'attack3': { // overhead finisher
        lam = 36;
        const w = Math.min(1, p / 0.32), s = Math.min(1, Math.max(0, (p - 0.32) / 0.2));
        T.aRX = -3.0 * w + 2.8 * s; T.aLX = -3.0 * w + 2.6 * s; T.aLZ = -0.3 * w; T.aRZ = 0.3 * w;
        T.wristX = 1.0 + 1.5 * s;
        T.bodyY = Math.sin(Math.min(1, p / 0.52) * Math.PI) * 0.35;
        T.bodyRX = -0.2 * w + 0.5 * s;
        T.lLX = 0.6 * s; T.lRX = -0.6 * s;
        if (p > 0.6) { const r = (p - 0.6) / 0.4; T.aRX *= 1 - r; T.aLX *= 1 - r; T.bodyRX *= 1 - r; }
        break;
      }
      case 'spin': {
        lam = 40;
        T.spin = p * TAU * 1.0;
        T.aRX = -1.5; T.aRZ = 1.45; T.wristX = 1.57; T.wristY = 1.4;
        T.aLX = -0.5; T.aLZ = 1.2;
        T.bodyY = Math.sin(p * Math.PI) * 0.4;
        T.lLX = 0.5; T.lRX = -0.5;
        break;
      }
      case 'block': T.aRX = -1.25; T.aRZ = 0.6; T.wristX = 1.57; T.wristY = 1.3; T.aLX = -1.0; T.aLZ = -0.4; T.bodyY = -0.06; T.bodyRX = -0.08; T.lLX = 0.3; T.lRX = -0.3; lam = 26; break;
      case 'dodge': {
        lam = 40;
        T.bodyRX = p * TAU; T.bodyY = Math.sin(p * Math.PI) * 0.35 - 0.2;
        T.lLX = -1.5; T.lRX = -1.5; T.aLX = -1.8; T.aRX = -1.8;
        break;
      }
      case 'hurt': T.bodyRX = -0.3; T.headX = -0.4; T.aLZ = 0.8; T.aRZ = -0.8; T.aLX = -0.4; T.aRX = -0.4; lam = 30; break;
      case 'victory': {
        const b = Math.abs(Math.sin(t * 5)) * 0.15;
        T.bodyY = b; T.aRX = -3.05; T.aRZ = -0.15; T.wristX = 0.1; T.aLX = 0.2; T.aLZ = 0.9; T.headX = -0.15; T.lLX = 0.1; T.lRX = -0.1;
        break;
      }
      case 'defeat': T.bodyRX = -1.52; T.bodyY = 0.25; T.aLZ = 1.3; T.aRZ = -1.3; T.headY = 0.3; lam = 6; break;
      case 'cast_ball': { lam = 30; const k = p < 0.35 ? p / 0.35 : 1; T.aRX = p < 0.35 ? 0.7 * k : -1.6; T.aLX = p < 0.35 ? 0.3 : -0.6; T.torsoY = p < 0.35 ? 0.5 * k : -0.25; T.bodyRX = p < 0.35 ? -0.05 : 0.15; T.lLX = 0.4; T.lRX = -0.4; break; }
      case 'cast_ray': { lam = 26; T.aRX = -1.6; T.aLX = -1.6; T.aLZ = -0.15; T.aRZ = 0.15; T.bodyRX = p > 0.3 ? -0.12 : 0.1; T.lLX = 0.45; T.lRX = -0.45; break; }
      case 'cast_burst': { lam = 30; const up = p < 0.45; T.aRX = up ? -3.0 : 0.2; T.aLX = up ? -3.0 : 0.2; T.aLZ = up ? -0.3 : 0.9; T.aRZ = up ? 0.3 : -0.9; T.bodyY = up ? 0.15 : -0.3; T.lLX = up ? 0 : -0.8; T.lRX = up ? 0 : 0.6; break; }
      case 'cast_shield': { lam = 28; T.aRX = -1.4; T.aLX = -1.4; T.aRZ = 0.95; T.aLZ = -0.95; T.bodyY = -0.05; break; }
      case 'cast_fire': { lam = 32; const s = Math.min(1, p / 0.6); T.torsoY = 0.8 - 1.6 * s; T.aRX = -1.5; T.aRZ = -0.9 + 1.8 * s; T.aLX = -1.2; T.aLZ = 0.5; T.lLX = 0.4; T.lRX = -0.4; break; }
      case 'cast_frost': { lam = 30; const up = p < 0.4; T.aLZ = up ? 1.4 : 0.6; T.aRZ = up ? -1.4 : -0.6; T.aLX = up ? -0.2 : 0.4; T.aRX = up ? -0.2 : 0.4; T.lRX = up ? -1.0 : 0.1; T.bodyY = up ? 0.1 : -0.15; break; }
      case 'cast_blink': { lam = 34; T.bodyY = p < 0.5 ? -0.3 : 0; T.bodyRX = p < 0.5 ? 0.5 : -0.1; T.aLX = 1; T.aRX = 1; T.lLX = -0.6; T.lRX = -0.6; break; }
      case 'talk': { T.aRX = -0.4 + Math.sin(t * 3.1) * 0.3; T.aRZ = -0.2; T.aLX = -0.2 + Math.sin(t * 2.3 + 1) * 0.15; T.headX = Math.sin(t * 2) * 0.06; T.bodyY = Math.sin(t * 2.2) * 0.012; break; }
      case 'hammer': { const k = Math.sin(t * 6); T.aRX = -1.4 - k * 0.8; T.aRZ = 0.1; T.aLX = -0.6; T.bodyRX = 0.2; T.headX = 0.3; break; }
      case 'farm': { const k = Math.sin(t * 3); T.aRX = -1.0 - k * 0.6; T.aLX = -1.0 - k * 0.6; T.bodyRX = 0.3 + k * 0.1; break; }
      case 'sit': T.lLX = -1.5; T.lRX = -1.5; T.bodyY = -0.5; T.aLX = -0.5; T.aRX = -0.5; break;
      case 'fish': T.aRX = -0.9; T.aLX = -0.9; T.aLZ = -0.3; T.headX = 0.15 + Math.sin(t) * 0.05; break;
      case 'read': T.aLX = -1.2; T.aLZ = -0.2; T.aRX = -1.1; T.aRZ = 0.4; T.headX = 0.35; break;
      case 'guard': T.aRX = -0.15; T.headX = Math.sin(t * 0.5) * 0.05; T.headY = Math.sin(t * 0.3) * 0.4; break;
      case 'play': { T.bodyY = Math.abs(Math.sin(t * 5)) * 0.25; T.aLX = -2.5; T.aRX = -2.5; T.aLZ = 0.5; T.aRZ = -0.5; break; }
      case 'gather': { lam = 20; T.bodyRX = 0.6 * Math.sin(Math.min(1, p) * Math.PI); T.aRX = -1.0; T.aLX = -1.0; T.lLX = 0.3; T.lRX = -0.2; break; }
      case 'mine': { lam = 28; const s = Math.sin(Math.min(1, p) * Math.PI); T.aRX = -2.6 + 2.4 * s; T.aLX = -2.4 + 2.2 * s; T.wristX = 1.6; T.bodyRX = 0.2 * s; break; }
      case 'sleep': T.bodyRX = -1.52; T.bodyY = 0.2; break;
      case 'float': T.bodyY = Math.sin(t * 1.5) * 0.15 + 0.3; T.aLZ = 0.4; T.aRZ = -0.4; T.lLX = 0.2; T.lRX = 0.2; break;
      default: break;
    }
    const r = this.rot;
    const D = (k, v, l = lam) => { r[k] = r[k] === undefined ? v : damp(r[k], v, l, dt); return r[k]; };
    this.body.position.y = D('bodyY', T.bodyY);
    // full roll / spin bypass smoothing
    if (name === 'dodge') { this.body.rotation.x = T.bodyRX; r.bodyRX = 0; this.body.position.y = T.bodyY; }
    else this.body.rotation.x = D('bodyRX', T.bodyRX, name === 'defeat' ? 5 : lam);
    this.body.rotation.y = name === 'spin' ? T.spin : D('spin', 0, 20);
    this.torso.rotation.y = D('torsoY', T.torsoY);
    this.neck.rotation.x = D('headX', T.headX);
    this.neck.rotation.y = D('headY', T.headY, 6);
    this.armL.rotation.x = D('aLX', T.aLX); this.armL.rotation.z = D('aLZ', T.aLZ);
    this.armR.rotation.x = D('aRX', T.aRX); this.armR.rotation.z = D('aRZ', T.aRZ); this.armR.rotation.y = D('aRY', T.aRY);
    this.handR.rotation.x = D('wristX', T.wristX); this.handR.rotation.y = D('wristY', T.wristY);
    this.legL.rotation.x = D('lLX', T.lLX); this.legR.rotation.x = D('lRX', T.lRX);
    // secondary motion
    const mv = o.speed || 0;
    if (this.cape) this.cape.rotation.x = damp(this.cape.rotation.x, 0.15 + clamp(mv * 0.08, 0, 0.9) + Math.sin(t * 3) * 0.05, 6, dt);
    if (this.scarf) this.scarf.rotation.x = damp(this.scarf.rotation.x, 0.3 + clamp(mv * 0.1, 0, 1), 6, dt);
    if (this.tail) this.tail.rotation.x = damp(this.tail.rotation.x, clamp(mv * 0.08, 0, 0.8) + Math.sin(t * 4) * 0.08, 8, dt);
    if (this.wings) for (const w of this.wings.children) w.rotation.y = w.userData.side * (0.4 + Math.sin(t * (name === 'jump' || name === 'fall' ? 12 : 2.5)) * 0.25);
  }

  // world-space tip of the sword (for trails)
  swordTip(out, len) {
    if (!this.sword) return null;
    out.set(0, len, 0);
    this.sword.localToWorld(out);
    return out;
  }
}

// Convert player save appearance + equipment into a Humanoid "look"
export function playerLook(app, eq, skins) {
  const sk = eq.skin && eq.skin !== 'custom' ? skins[eq.skin] : null;
  const pal = {
    skin: app.skinTone, hair: app.hairColor, eye: app.eyeColor, shirt: app.shirt, pants: app.pants, shoes: app.shoes, trim: shade(app.shirt, 0.65),
  };
  if (sk && sk.pal) Object.assign(pal, sk.pal);
  let hat = eq.hat;
  if ((!hat || hat === 'none') && sk && sk.pal.hat) hat = sk.pal.hat;
  return {
    pal, hairStyle: app.hairStyle, hat, acc: eq.accessory, armor: eq.armor, sword: eq.sword,
    glow: sk && sk.pal.glow ? sk.pal.glow : 0, mask: sk && sk.pal.mask, skinId: eq.skin,
  };
}
