import * as THREE from 'three';
import { clamp, lerp } from './util.js';

const geoCache = new Map(), matCache = new Map();
function box(w, h, d) {
  const k = `${w}_${h}_${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}
function mat(c, r = 0.8) {
  const k = `${c}_${r}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: r }));
  return matCache.get(k);
}
function part(parent, geo, m, x, y, z) {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  me.castShadow = true;
  parent.add(me);
  return me;
}
function pivot(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export const SKINS = [0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0x5c3a1e, 0x3d2412, 0xa86b3c];
export const SHIRTS = [0xffffff, 0x1f4e8c, 0xb3261e, 0x2f6b3a, 0xf0b429, 0x6a2c70, 0x222222, 0xd9661f, 0x7fb3d5, 0xe8d5b0];
export const PANTS = [0x2b3a67, 0x1b1b1b, 0x5a4632, 0x7a7a7a, 0x3d5a40, 0xc8b88a];
export const HAIRS = [0x111111, 0x2b1a10, 0x5a3a1e, 0x8a6a3a, 0x9a9a9a];

export function randomLook(r = Math.random) {
  const p = (a) => a[Math.floor(r() * a.length)];
  return { skin: p(SKINS), shirt: p(SHIRTS), pants: p(PANTS), hair: p(HAIRS), cap: r() < 0.2 ? p(SHIRTS) : null, scale: 0.92 + r() * 0.14, long: r() < 0.3 };
}

export class Character {
  constructor(o = {}) {
    const skin = o.skin ?? 0x8d5524, shirt = o.shirt ?? 0xffffff, pants = o.pants ?? 0x2b3a67, shoes = o.shoes ?? 0x151515, hair = o.hair ?? 0x111111;
    this.root = new THREE.Group();
    this.g = pivot(this.root, 0, 0, 0);
    this.g.scale.setScalar(o.scale ?? 1);
    const hips = (this.hips = pivot(this.g, 0, 0.95, 0));
    const fat = (this.fat = o.fat || 0);
    part(hips, box(0.36, 0.16, 0.22), mat(pants), 0, 0.02, 0).scale.set(1 + fat * 0.45, 1, 1 + fat * 0.6);
    const torso = (this.torso = pivot(hips, 0, 0.08, 0));
    const mu = (this.muscle = o.muscle || 0);
    part(torso, box(0.42, 0.5, 0.24), mat(shirt), 0, 0.27, 0).scale.set(1 + mu * 0.3 + fat * 0.5, 1, 1 + mu * 0.25 + fat * 0.7);
    // barriga (cresce comendo demais)
    if (fat > 0.05) part(torso, box(0.36, 0.3, 0.12), mat(shirt), 0, 0.16, 0.12 + fat * 0.06).scale.set(1 + fat * 0.4, 0.6 + fat * 0.6, fat * 1.6);
    if (o.uniform) {
      part(torso, box(0.08, 0.06, 0.02), mat(0xd4af37, 0.3), 0.1, 0.4, 0.125);
      part(torso, box(0.44, 0.05, 0.26), mat(0x111111), 0, 0.03, 0);
    }
    if (o.chain) part(torso, box(0.2, 0.02, 0.02), mat(0xd4af37, 0.3), 0, 0.42, 0.125);
    const neck = pivot(torso, 0, 0.54, 0);
    part(neck, box(0.1, 0.06, 0.1), mat(skin), 0, 0.0, 0);
    const head = (this.head = pivot(neck, 0, 0.03, 0));
    part(head, box(0.22, 0.26, 0.24), mat(skin), 0, 0.13, 0);
    part(head, box(0.235, 0.07, 0.25), mat(hair), 0, 0.27, -0.005);
    part(head, box(0.235, 0.18, 0.06), mat(hair), 0, 0.18, -0.1);
    if (o.long) part(head, box(0.24, 0.28, 0.08), mat(hair), 0, 0.05, -0.11);
    part(head, box(0.045, 0.03, 0.01), mat(0x111111), 0.055, 0.16, 0.121);
    part(head, box(0.045, 0.03, 0.01), mat(0x111111), -0.055, 0.16, 0.121);
    part(head, box(0.05, 0.05, 0.03), mat(skin), 0, 0.1, 0.13);
    // boca: abre e fecha quando o personagem fala
    this.mouth = part(head, box(0.08, 0.025, 0.012), mat(0x3a1414), 0, 0.045, 0.121);
    this.mouth.castShadow = false;
    if (o.cap) {
      part(head, box(0.25, 0.07, 0.27), mat(o.cap), 0, 0.29, 0);
      part(head, box(0.22, 0.02, 0.12), mat(o.cap), 0, 0.27, 0.17);
    }
    this.arms = [];
    this.legs = [];
    for (const side of [1, -1]) {
      const sh = pivot(torso, side * (0.27 + mu * 0.06), 0.48, 0);
      sh.scale.set(1 + mu * 0.45, 1, 1 + mu * 0.45);
      part(sh, box(0.12, 0.17, 0.13), mat(shirt), 0, -0.07, 0);
      part(sh, box(0.1, 0.15, 0.11), mat(o.sleeves ? shirt : skin), 0, -0.22, 0);
      const el = pivot(sh, 0, -0.3, 0);
      part(el, box(0.1, 0.27, 0.11), mat(o.sleeves ? shirt : skin), 0, -0.13, 0);
      part(el, box(0.09, 0.09, 0.1), mat(skin), 0, -0.31, 0);
      const hand = pivot(el, 0, -0.33, 0.02);
      this.arms.push({ sh, el, hand });
      const hp = pivot(hips, side * 0.11, -0.02, 0);
      part(hp, box(0.15, 0.45, 0.17), mat(pants), 0, -0.22, 0);
      const kn = pivot(hp, 0, -0.45, 0);
      part(kn, box(0.13, 0.43, 0.15), mat(o.shorts ? skin : pants), 0, -0.21, 0);
      part(kn, box(0.13, 0.07, 0.26), mat(shoes), 0, -0.45, 0.05);
      this.legs.push({ hp, kn });
    }
    this.phase = Math.random() * 6;
    this.punchT = 0;
    this.punchType = 0;
    this.guard = 0;
    this.hitT = 0;
    this.talk = 0;
    this.t = Math.random() * 10;
    this.weapon = null; this.aim = 0; this.aimPitch = 0; this.swingT = 0;
  }

  // cigarro entre os dedos da mão direita (ponta em brasa)
  setCig(on) {
    if (on && !this.cig) {
      const g = new THREE.Group();
      const paper = part(g, box(0.014, 0.014, 0.075), mat(0xf2f2ea, 0.9), 0, 0, 0.03);
      const filter = part(g, box(0.015, 0.015, 0.022), mat(0xd08a3a, 0.9), 0, 0, -0.018);
      this.cigTip = new THREE.Mesh(box(0.016, 0.016, 0.008), new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff5a10, emissiveIntensity: 1 }));
      this.cigTip.position.z = 0.07;
      g.add(this.cigTip);
      paper.castShadow = filter.castShadow = false;
      g.position.set(0.03, -0.02, 0.04);
      this.arms[1].hand.add(g);
      this.cig = g;
    } else if (!on && this.cig) { this.cig.parent.remove(this.cig); this.cig = null; this.cigTip = null; }
  }

  // arma na mão direita: bat, knife, pistol, shotgun
  setWeapon(type) {
    if (this.weaponMesh) { this.weaponMesh.parent.remove(this.weaponMesh); this.weaponMesh = null; }
    this.weapon = type;
    if (!type || type === 'fist') return;
    const g = new THREE.Group(), dark = mat(0x1a1a1a, 0.4), wood = mat(0x8a5a2b, 0.7), steel = mat(0xb8b8b8, 0.3);
    // o eixo -y da mão aponta pra frente quando o braço mira; +z vira "pra cima"
    if (type === 'bat') part(g, box(0.05, 0.75, 0.05), wood, 0, -0.32, 0);
    else if (type === 'knife') { part(g, box(0.03, 0.09, 0.04), dark, 0, -0.02, 0); part(g, box(0.012, 0.2, 0.035), steel, 0, -0.15, 0); }
    else if (type === 'pistol') { part(g, box(0.04, 0.2, 0.05), dark, 0, -0.08, 0.02); part(g, box(0.035, 0.04, 0.11), dark, 0, 0.0, -0.05); }
    else if (type === 'shotgun') { part(g, box(0.05, 0.95, 0.07), dark, 0, -0.3, 0.02); part(g, box(0.06, 0.32, 0.12), wood, 0, 0.22, -0.03); }
    this.arms[1].hand.add(g);
    this.weaponMesh = g;
  }

  animate(dt, speed, mode = 'ground') {
    this.t += dt;
    const [L, Rr] = this.legs, [AL, AR] = this.arms;
    const g = this.g;
    g.rotation.set(0, 0, 0);
    g.position.set(0, 0, 0);
    this.hips.position.y = 0.95;
    this.hips.rotation.set(0, 0, 0);
    this.torso.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    for (const a of this.arms) { a.sh.rotation.set(0, 0, 0); a.el.rotation.set(0, 0, 0); }
    for (const l of this.legs) { l.hp.rotation.set(0, 0, 0); l.kn.rotation.set(0, 0, 0); }

    if (mode === 'ground' || mode === 'air') {
      const run = clamp((speed - 2) / 5, 0, 1);
      const freq = speed < 0.15 ? 0 : 1.3 + speed * 0.5;
      this.phase += dt * freq * Math.PI;
      const amp = clamp(speed / 4, 0, 1) * 0.55 + run * 0.35;
      const s = Math.sin(this.phase), c = Math.cos(this.phase);
      if (mode === 'air') {
        L.hp.rotation.x = -0.7; L.kn.rotation.x = 1.1; Rr.hp.rotation.x = 0.2; Rr.kn.rotation.x = 0.5;
        AL.sh.rotation.x = -0.6; AR.sh.rotation.x = -0.9; AL.sh.rotation.z = 0.4; AR.sh.rotation.z = -0.4;
      } else {
        L.hp.rotation.x = -s * amp; Rr.hp.rotation.x = s * amp;
        L.kn.rotation.x = Math.max(0, c) * amp * 1.5 + 0.05;
        Rr.kn.rotation.x = Math.max(0, -c) * amp * 1.5 + 0.05;
        AL.sh.rotation.x = s * amp * 0.9; AR.sh.rotation.x = -s * amp * 0.9;
        AL.el.rotation.x = AR.el.rotation.x = -0.25 - run * 1.0;
        AL.sh.rotation.z = 0.07; AR.sh.rotation.z = -0.07;
        this.hips.position.y = 0.95 - run * 0.05 + Math.abs(c) * 0.04 * amp;
        this.torso.rotation.x = run * 0.22;
        this.torso.rotation.y = s * amp * 0.12;
        if (speed < 0.15) {
          const b = Math.sin(this.t * 1.7);
          this.torso.rotation.x = b * 0.012;
          AL.sh.rotation.z = 0.08 + b * 0.02; AR.sh.rotation.z = -0.08 - b * 0.02;
          this.head.rotation.y = Math.sin(this.t * 0.31) * 0.25;
        }
      }
    } else if (mode === 'drive') {
      for (const l of this.legs) { l.hp.rotation.x = -1.45; l.kn.rotation.x = 0.9; }
      AL.sh.rotation.x = AR.sh.rotation.x = -1.05;
      AL.el.rotation.x = AR.el.rotation.x = -0.35;
      AL.sh.rotation.z = -0.15; AR.sh.rotation.z = 0.15;
    } else if (mode === 'bike') {
      this.phase += dt * speed * 1.4;
      const s = Math.sin(this.phase);
      L.hp.rotation.x = -0.95 + s * 0.45; L.kn.rotation.x = 1.0 - s * 0.35;
      Rr.hp.rotation.x = -0.95 - s * 0.45; Rr.kn.rotation.x = 1.0 + s * 0.35;
      this.torso.rotation.x = 0.4;
      AL.sh.rotation.x = AR.sh.rotation.x = -1.2;
      AL.el.rotation.x = AR.el.rotation.x = -0.1;
      this.hips.position.y = 0.95;
    } else if (mode === 'moto') {
      for (const l of this.legs) { l.hp.rotation.x = -1.1; l.kn.rotation.x = 1.4; }
      L.hp.rotation.z = 0.25; Rr.hp.rotation.z = -0.25;
      this.torso.rotation.x = 0.35;
      AL.sh.rotation.x = AR.sh.rotation.x = -1.1;
    } else if (mode === 'down') {
      g.rotation.x = -Math.PI / 2;
      g.position.y = 0.12;
      g.position.z = -0.9;
      AL.sh.rotation.z = 0.8; AR.sh.rotation.z = -0.6;
      L.hp.rotation.z = 0.15; Rr.kn.rotation.x = 0.6;
    } else if (mode === 'swim') {
      this.phase += dt * 4;
      g.rotation.x = Math.PI / 2 * 0.85;
      g.position.y = -0.55;
      AL.sh.rotation.x = Math.sin(this.phase) * 1.6 - 1.5;
      AR.sh.rotation.x = Math.sin(this.phase + Math.PI) * 1.6 - 1.5;
      L.hp.rotation.x = Math.sin(this.phase * 2) * 0.3; Rr.hp.rotation.x = -Math.sin(this.phase * 2) * 0.3;
    }
    else if (mode === 'tread') {
      this.phase += dt * 3;
      g.position.y = -1.25;
      const s = Math.sin(this.phase);
      AL.sh.rotation.z = 0.9 + s * 0.4; AR.sh.rotation.z = -0.9 - s * 0.4;
      AL.el.rotation.x = AR.el.rotation.x = -0.5;
      L.hp.rotation.x = s * 0.5; Rr.hp.rotation.x = -s * 0.5;
      L.kn.rotation.x = 0.5 + s * 0.3; Rr.kn.rotation.x = 0.5 - s * 0.3;
    } else if (mode === 'swimUnder') {
      this.phase += dt * (1.5 + speed * 0.8);
      const s = Math.sin(this.phase), c = Math.cos(this.phase);
      g.rotation.x = Math.PI / 2;
      g.position.y = 0.3;
      g.position.z = -0.9;
      // nado de peito: braços abrem pra trás, pernas em tesoura
      AL.sh.rotation.x = AR.sh.rotation.x = -2.9 + Math.max(0, s) * 1.2;
      AL.sh.rotation.z = 0.2 + Math.max(0, s) * 1.1; AR.sh.rotation.z = -0.2 - Math.max(0, s) * 1.1;
      AL.el.rotation.x = AR.el.rotation.x = -Math.max(0, c) * 1.2;
      L.hp.rotation.z = 0.1 + Math.max(0, -s) * 0.5; Rr.hp.rotation.z = -0.1 - Math.max(0, -s) * 0.5;
      L.kn.rotation.x = Rr.kn.rotation.x = Math.max(0, c) * 1.4;
    } else if (mode === 'dive') {
      g.rotation.x = Math.PI * 0.62;
      g.position.y = 0.9;
      AL.sh.rotation.x = AR.sh.rotation.x = -3.05;
      AL.sh.rotation.z = 0.1; AR.sh.rotation.z = -0.1;
      L.hp.rotation.z = 0.02; Rr.hp.rotation.z = -0.02;
    } else if (mode === 'fall') {
      this.phase += dt * 14;
      const s = Math.sin(this.phase);
      AL.sh.rotation.z = 2.2 + s * 0.6; AR.sh.rotation.z = -2.2 + s * 0.6;
      AL.el.rotation.x = s * 0.8; AR.el.rotation.x = -s * 0.8;
      L.hp.rotation.x = -0.6 + s * 0.6; Rr.hp.rotation.x = -0.6 - s * 0.6;
      L.kn.rotation.x = Rr.kn.rotation.x = 0.9;
      this.torso.rotation.x = -0.25;
    } else if (mode === 'lift') {
      this.phase += dt * speed;
      const k = (Math.sin(this.phase) + 1) / 2;
      AL.sh.rotation.x = AR.sh.rotation.x = -0.2;
      AL.el.rotation.x = AR.el.rotation.x = -0.4 - k * 2.0;
      this.hips.position.y = 0.95;
    } else if (mode === 'tumble') {
      // rolando no asfalto: corpo encolhido girando em volta do quadril
      const a = this.rollA || 0, r = 0.45;
      g.rotation.x = a;
      g.position.y = r - r * Math.cos(a) + 0.05;
      g.position.z = -r * Math.sin(a);
      g.rotation.z = Math.sin(a * 0.5) * 0.25;
      for (const l of this.legs) { l.hp.rotation.x = -1.3; l.kn.rotation.x = 1.6; }
      AL.sh.rotation.x = AR.sh.rotation.x = -1.6; AL.el.rotation.x = AR.el.rotation.x = -1.8;
      AL.sh.rotation.z = 0.3; AR.sh.rotation.z = -0.3;
      this.torso.rotation.x = 0.5; this.head.rotation.x = 0.4;
    } else if (mode === 'bail') {
      // saltando da porta: braços abertos, corpo inclinado pro lado do pulo
      g.rotation.z = -0.6;
      AL.sh.rotation.z = 1.6; AR.sh.rotation.z = -1.2; AR.sh.rotation.x = -0.8;
      L.hp.rotation.x = -0.9; L.kn.rotation.x = 1.2; Rr.hp.rotation.x = 0.4; Rr.kn.rotation.x = 0.6;
      this.torso.rotation.x = 0.3;
    } else if (mode === 'dead') {
      g.rotation.x = -Math.PI / 2;
      g.position.y = 0.12;
      g.position.z = -0.9;
      AL.sh.rotation.z = 1.4; AR.sh.rotation.z = -0.4; AR.sh.rotation.x = -0.6;
      L.hp.rotation.z = 0.25; Rr.hp.rotation.z = -0.1; L.kn.rotation.x = 0.3;
      this.head.rotation.y = 0.6;
    } else if (mode === 'chat') {
      AR.sh.rotation.x = -0.3 + Math.sin(this.t * 2.3) * 0.25;
      AR.el.rotation.x = -1.1;
      AL.sh.rotation.z = 0.12;
      this.head.rotation.y = Math.sin(this.t * 0.7) * 0.15;
    }
    // guarda de luta depois de socar (punhos na frente do rosto, pernas abertas)
    if (this.guard > 0 && (mode === 'ground') ) {
      this.guard -= dt;
      const w = Math.min(1, this.guard * 3) * (speed < 2 ? 1 : 0.5);
      AL.sh.rotation.x = lerp(AL.sh.rotation.x, -1.1, w); AL.el.rotation.x = lerp(AL.el.rotation.x, -2.0, w);
      AR.sh.rotation.x = lerp(AR.sh.rotation.x, -0.9, w); AR.el.rotation.x = lerp(AR.el.rotation.x, -2.1, w);
      AL.sh.rotation.z = lerp(AL.sh.rotation.z, -0.25, w); AR.sh.rotation.z = lerp(AR.sh.rotation.z, 0.25, w);
      if (speed < 0.3) {
        const bob = Math.sin(this.t * 6) * 0.02;
        L.hp.rotation.x = -0.3; L.kn.rotation.x = 0.35; Rr.hp.rotation.x = 0.25; Rr.kn.rotation.x = 0.3;
        this.hips.position.y = 0.92 + bob;
        this.torso.rotation.y = 0.25;
        this.head.rotation.x = 0.1;
      }
    }
    // combo: 0 jab de esquerda, 1 direto de direita, 2 gancho de baixo pra cima
    if (this.punchT > 0) {
      this.punchT -= dt;
      const D = this.punchDur || 0.35;
      const u = clamp(1 - this.punchT / D, 0, 1);
      const ext = u < 0.4 ? u / 0.4 : 1 - (u - 0.4) / 0.6;
      const k = ext * ext * (3 - 2 * ext);
      const type = this.punchType || 0;
      AL.sh.rotation.z = -0.15; AR.sh.rotation.z = 0.15;
      if (type === 0) {
        AL.sh.rotation.x = lerp(-1.1, -1.6, k); AL.el.rotation.x = lerp(-2.0, -0.05, k);
        AR.sh.rotation.x = -0.9; AR.el.rotation.x = -2.1;
        this.torso.rotation.y = 0.3 + 0.25 * k;
        g.position.z = 0.08 * k;
      } else if (type === 1) {
        AR.sh.rotation.x = lerp(-0.9, -1.6, k); AR.el.rotation.x = lerp(-2.1, -0.05, k);
        AL.sh.rotation.x = -1.1; AL.el.rotation.x = -2.0;
        this.torso.rotation.y = 0.25 - 0.75 * k;
        this.hips.rotation.y = -0.3 * k;
        Rr.hp.rotation.x = 0.35 * k; Rr.kn.rotation.x = 0.2 + 0.3 * k;
        g.position.z = 0.18 * k;
      } else {
        const wind = u < 0.3 ? u / 0.3 : 1;
        AR.sh.rotation.x = u < 0.3 ? lerp(-0.9, -0.4, wind) : lerp(-0.4, -2.5, k);
        AR.el.rotation.x = u < 0.3 ? -2.2 : lerp(-2.2, -1.0, k);
        AL.sh.rotation.x = -1.1; AL.el.rotation.x = -2.0;
        this.hips.position.y = 0.95 - (u < 0.3 ? 0.1 * wind : 0.1 * (1 - k));
        L.kn.rotation.x = Rr.kn.rotation.x = u < 0.3 ? 0.4 * wind : 0.4 * (1 - k);
        L.hp.rotation.x = Rr.hp.rotation.x = u < 0.3 ? -0.25 * wind : -0.25 * (1 - k);
        this.torso.rotation.x = -0.25 * k;
        this.torso.rotation.y = -0.4 * k;
        g.position.z = 0.12 * k;
      }
    }
    if (this.hitT > 0) {
      // reação de quem leva o soco: cabeça e tronco jogados pra trás
      this.hitT -= dt;
      const k = Math.sin(clamp(1 - this.hitT / 0.4, 0, 1) * Math.PI);
      this.torso.rotation.x -= 0.45 * k; this.head.rotation.x -= 0.4 * k;
      AL.sh.rotation.z += 0.5 * k; AR.sh.rotation.z -= 0.5 * k;
    }
    if (this.talk > 0) {
      this.talk -= dt;
      this.head.rotation.x = Math.sin(this.t * 9) * 0.06;
      if (mode !== 'drive' && mode !== 'moto' && mode !== 'bike') { AR.sh.rotation.x += Math.sin(this.t * 3) * 0.15 - 0.2; AR.el.rotation.x -= 0.5; }
      // sílabas: a boca abre e fecha em ritmo irregular
      const o = Math.max(0, Math.sin(this.t * 17) * 0.6 + Math.sin(this.t * 7.3 + 1) * 0.5);
      this.mouth.scale.set(1 - o * 0.25, 1 + o * 2.6, 1);
    } else this.mouth.scale.set(1, 1, 1);
    // fumando: idle.hand 0 = braço abaixado, 1 = cigarro na boca; idle.lean encosta na parede com o pé nela
    const I = this.idle;
    if (I && mode === 'ground' && speed < 0.15) {
      if (I.lean > 0) {
        const w = I.lean;
        g.rotation.x = lerp(0, -0.1, w);
        Rr.hp.rotation.x = lerp(Rr.hp.rotation.x, -0.35, w); Rr.kn.rotation.x = lerp(Rr.kn.rotation.x, 1.75, w);
        L.hp.rotation.x = lerp(L.hp.rotation.x, 0.08, w);
        AL.sh.rotation.x = lerp(AL.sh.rotation.x, 0.25, w); AL.sh.rotation.z = lerp(AL.sh.rotation.z, 0.12, w); AL.el.rotation.x = lerp(AL.el.rotation.x, -0.3, w);
        this.head.rotation.y = Math.sin(this.t * 0.25) * 0.35;
      }
      const h = I.hand;
      // mão do lado do corpo → mão na boca
      AR.sh.rotation.x = lerp(-0.25, -0.55, h); AR.sh.rotation.z = lerp(-0.12, 0.42, h); AR.el.rotation.x = lerp(-1.1, -2.35, h);
      AR.sh.rotation.y = lerp(0, -0.25, h);
      if (I.pocket > 0) { AR.sh.rotation.x = 0.25 * I.pocket; AR.sh.rotation.z = -0.2 * I.pocket; AR.el.rotation.x = -0.4 * I.pocket; }
      this.head.rotation.x = lerp(this.head.rotation.x, -0.12, h);
      if (this.cigTip) this.cigTip.material.emissiveIntensity = 0.8 + I.glow * 5;
      this.mouth.scale.set(1 - I.puff * 0.3, 1 + I.puff * 1.2, 1);
    }
    // mirando: braço direito (pistola) ou os dois (escopeta) apontados pra frente
    if (this.aim > 0 && (mode === 'ground' || mode === 'air')) {
      const w = Math.min(1, this.aim), p = this.aimPitch;
      if (this.weapon === 'shotgun') {
        AR.sh.rotation.x = lerp(AR.sh.rotation.x, -1.45 - p, w); AR.el.rotation.x = lerp(AR.el.rotation.x, -0.1, w); AR.sh.rotation.z = lerp(AR.sh.rotation.z, 0.2, w);
        AL.sh.rotation.x = lerp(AL.sh.rotation.x, -1.35 - p, w); AL.el.rotation.x = lerp(AL.el.rotation.x, -0.5, w); AL.sh.rotation.z = lerp(AL.sh.rotation.z, -0.5, w);
        this.torso.rotation.y = lerp(this.torso.rotation.y, 0.25, w);
      } else {
        AR.sh.rotation.x = lerp(AR.sh.rotation.x, -1.55 - p, w); AR.el.rotation.x = lerp(AR.el.rotation.x, 0, w); AR.sh.rotation.z = lerp(AR.sh.rotation.z, 0.05, w);
      }
      this.head.rotation.x = -p * 0.6;
    }
    // golpe de taco/faca: arco de cima pra baixo
    if (this.swingT > 0) {
      this.swingT -= dt;
      const u = clamp(1 - this.swingT / 0.42, 0, 1), k = u < 0.35 ? u / 0.35 : 1 - (u - 0.35) / 0.65;
      AR.sh.rotation.x = u < 0.35 ? lerp(0, -2.6, k) : lerp(-0.3, -2.6, k);
      AR.sh.rotation.z = 0.3 * k; AR.el.rotation.x = -0.4 * k;
      this.torso.rotation.y = u < 0.35 ? 0.4 * k : -0.5 * (1 - k);
    }
  }
}
