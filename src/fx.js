import * as THREE from 'three';
import { heightAt } from './world.js';

function softTex() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

// destroços (peças que voam e ficam no chão), faíscas, fumaça, fogo, explosões e respingos
export class FX {
  constructor(scene) {
    this.scene = scene;
    this.N = 320;
    this.deb = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.35 }), this.N);
    this.deb.castShadow = true;
    this.deb.frustumCulled = false;
    this.pieces = [];
    this.cursor = 0;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.N; i++) {
      this.deb.setMatrixAt(i, zero);
      this.deb.setColorAt(i, new THREE.Color(1, 1, 1));
      this.pieces.push(null);
    }
    scene.add(this.deb);
    this.tex = softTex();
    this.sprites = [];
    this.light = 1; // fumaça/borrifo não brilham no escuro
    this.flash = new THREE.PointLight(0xffa040, 0, 60, 1.5);
    scene.add(this.flash);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._s = new THREE.Vector3(); this._c = new THREE.Color();
  }

  piece(x, y, z, vx, vy, vz, sx, sy, sz, color, life = 40) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.N;
    this.pieces[i] = {
      p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(vx, vy, vz), r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      w: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14), s: new THREE.Vector3(sx, sy, sz), life, rest: false,
    };
    this.deb.setColorAt(i, this._c.set(color));
    this.deb.instanceColor.needsUpdate = true;
  }

  // batida: lascas da lataria e vidro voando do ponto de impacto
  impact(v, strength, cx, cz) {
    const n = Math.min(14, Math.floor(strength * 0.8));
    const sh = Math.sin(v.heading), ch = Math.cos(v.heading);
    const sp = v.speed || 1;
    let dx = sp > 1 ? v.vel.x / sp : sh, dz = sp > 1 ? v.vel.z / sp : ch;
    let x = v.pos.x + dx * v.t.length * 0.45, z = v.pos.z + dz * v.t.length * 0.45;
    if (cx !== undefined) { x = cx; z = cz; const d = Math.hypot(cx - v.pos.x, cz - v.pos.z) || 1; dx = (cx - v.pos.x) / d; dz = (cz - v.pos.z) / d; }
    const y = v.pos.y + v.t.wheelR + 0.4;
    for (let k = 0; k < n; k++) {
      const glass = Math.random() < 0.4;
      const s = glass ? 0.06 + Math.random() * 0.08 : 0.08 + Math.random() * 0.2;
      this.piece(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5),
        -dx * strength * 0.2 + (Math.random() - 0.5) * 5, 2 + Math.random() * 4, -dz * strength * 0.2 + (Math.random() - 0.5) * 5,
        s, glass ? 0.01 : 0.03, s * (0.6 + Math.random()), glass ? 0xbfe6ff : v.color);
    }
    this.sparks(x, y - 0.2, z, Math.min(30, strength * 2));
  }

  // peça grande que se solta (para-choque)
  detach(v, mesh) {
    if (!mesh || !mesh.visible) return;
    mesh.visible = false;
    const wp = new THREE.Vector3();
    mesh.getWorldPosition(wp);
    const g = mesh.geometry.parameters;
    const sh = Math.sin(v.heading), ch = Math.cos(v.heading);
    this.piece(wp.x, wp.y, wp.z, v.vel.x * 0.5 + (Math.random() - 0.5) * 3, 2.5, v.vel.z * 0.5 + (Math.random() - 0.5) * 3,
      g.width, g.height, g.depth, mesh.material.color ? mesh.material.color.getHex() : 0x222222, 90);
    const p = this.pieces[(this.cursor - 1 + this.N) % this.N];
    p.r.set(0, v.heading, 0); p.w.multiplyScalar(0.3);
    void sh; void ch;
  }

  // vidro/farol estilhaçando: some a peça e voam cacos
  glass(v, mesh) {
    mesh.visible = false;
    const wp = new THREE.Vector3();
    mesh.getWorldPosition(wp);
    const red = mesh.material.emissive && mesh.material.emissive.r > 0.9 && mesh.material.emissive.g < 0.3;
    const col = red ? 0xff3020 : mesh.material.emissive && mesh.material.emissive.r > 0.9 ? 0xfff4d0 : 0xcfeaff;
    for (let k = 0; k < 12; k++) {
      const s = 0.04 + Math.random() * 0.09;
      this.piece(wp.x + (Math.random() - 0.5) * 0.6, wp.y, wp.z + (Math.random() - 0.5) * 0.6, v.vel.x * 0.4 + (Math.random() - 0.5) * 4, 1 + Math.random() * 3, v.vel.z * 0.4 + (Math.random() - 0.5) * 4, s, 0.01, s, col, 30);
    }
  }

  sprite(x, y, z, o) {
    const m = new THREE.SpriteMaterial({ map: this.tex, color: o.add ? o.color : this._c.set(o.color).multiplyScalar(this.light), transparent: true, opacity: o.op, depthWrite: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true });
    const s = new THREE.Sprite(m);
    s.position.set(x, y, z);
    s.scale.setScalar(o.size);
    this.scene.add(s);
    this.sprites.push({ s, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: o.life, max: o.life, grow: o.grow || 1, op: o.op, g: o.g || 0 });
  }

  sparks(x, y, z, n) {
    for (let k = 0; k < n; k++) this.sprite(x, y, z, { color: 0xffb040, op: 1, add: true, size: 0.15, life: 0.4 + Math.random() * 0.4, vx: (Math.random() - 0.5) * 10, vy: Math.random() * 6, vz: (Math.random() - 0.5) * 10, g: 14, grow: 0.2 });
  }

  smoke(x, y, z, dark, wind) {
    this.sprite(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4, { color: dark ? 0x222222 : 0x9a9a9a, op: 0.5, size: 0.6, life: 2.5, vy: 1.6, vx: wind.x * 0.25, vz: wind.y * 0.25, grow: 2.2 });
  }
  tireSmoke(x, y, z) {
    this.sprite(x, y, z, { color: 0xd8d8d8, op: 0.35, size: 0.7, life: 1.6, vy: 0.8, grow: 2.4 });
  }
  fire(x, y, z) {
    this.sprite(x + (Math.random() - 0.5) * 0.8, y, z + (Math.random() - 0.5) * 0.8, { color: Math.random() < 0.5 ? 0xff7a1a : 0xffc040, op: 0.9, add: true, size: 0.9, life: 0.6, vy: 2.5, grow: 0.8 });
  }

  splash(x, y, z, big) {
    const n = big ? 40 : 16;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.28, r = Math.random() * (big ? 4 : 2);
      this.sprite(x, y, z, { color: 0xe8f4ff, op: 0.8, size: 0.35, life: 0.9, vx: Math.cos(a) * r, vy: 3 + Math.random() * (big ? 6 : 3), vz: Math.sin(a) * r, g: 12, grow: 1.6 });
    }
  }
  // borrifo dos pneus no asfalto molhado (névoa atrás do carro)
  spray(x, y, z, vx, vz, amt) {
    this.sprite(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3, { color: 0xc9d2da, op: 0.22 * amt, size: 0.55, life: 0.7 + Math.random() * 0.5, vx: vx * 0.35 + (Math.random() - 0.5), vy: 0.6 + Math.random() * 0.8, vz: vz * 0.35 + (Math.random() - 0.5), grow: 3 });
  }
  // roda passando na poça: lençol d'água para os lados
  puddle(x, y, z, sx, sz, vx, vz, spd) {
    const n = Math.min(14, 4 + spd * 0.4);
    for (let k = 0; k < n; k++) {
      const out = 1.5 + Math.random() * spd * 0.22;
      this.sprite(x, y, z, { color: 0xdfe8ef, op: 0.5, size: 0.22 + Math.random() * 0.2, life: 0.5 + Math.random() * 0.4, vx: sx * out + vx * 0.5, vy: 1.5 + Math.random() * (1 + spd * 0.12), vz: sz * out + vz * 0.5, g: 11, grow: 2.2 });
    }
  }
  bubbles(x, y, z) {
    this.sprite(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3, { color: 0xddf4ff, op: 0.6, size: 0.08, life: 1.6, vy: 1.4, grow: 1.4 });
  }

  explode(x, y, z, color) {
    this.flash.position.set(x, y + 2, z);
    this.flash.intensity = 2000;
    for (let k = 0; k < 26; k++) this.sprite(x, y + 1, z, { color: k % 3 ? 0xff8a20 : 0xffd060, op: 1, add: true, size: 2, life: 0.9 + Math.random() * 0.5, vx: (Math.random() - 0.5) * 12, vy: Math.random() * 9, vz: (Math.random() - 0.5) * 12, grow: 2.4 });
    for (let k = 0; k < 16; k++) this.sprite(x, y + 1.5, z, { color: 0x1a1a1a, op: 0.7, size: 2.5, life: 4 + Math.random() * 2, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3, vz: (Math.random() - 0.5) * 3, grow: 3 });
    for (let k = 0; k < 22; k++) {
      const s = 0.15 + Math.random() * 0.5;
      this.piece(x, y + 1, z, (Math.random() - 0.5) * 22, 6 + Math.random() * 12, (Math.random() - 0.5) * 22, s, 0.05 + Math.random() * 0.1, s, k % 4 ? color : 0x1a1a1a, 60);
    }
    this.sparks(x, y + 1, z, 40);
  }

  update(dt, cam) {
    this.flash.intensity *= Math.exp(-dt * 6);
    let changed = false;
    for (let i = 0; i < this.N; i++) {
      const p = this.pieces[i];
      if (!p) continue;
      p.life -= dt;
      if (p.life <= 0) { this.pieces[i] = null; this.deb.setMatrixAt(i, this._m.makeScale(0, 0, 0)); changed = true; continue; }
      if (!p.rest) {
        p.v.y -= 9.81 * dt;
        p.p.addScaledVector(p.v, dt);
        p.r.x += p.w.x * dt; p.r.y += p.w.y * dt; p.r.z += p.w.z * dt;
        const gy = Math.max(heightAt(p.p.x, p.p.z), -0.3) + p.s.y / 2;
        if (p.p.y < gy) {
          p.p.y = gy;
          if (Math.abs(p.v.y) < 1.5) { p.rest = true; p.r.x = Math.round(p.r.x / Math.PI) * Math.PI; p.r.z = Math.round(p.r.z / Math.PI) * Math.PI; }
          p.v.y *= -0.3; p.v.x *= 0.6; p.v.z *= 0.6; p.w.multiplyScalar(0.5);
        }
      }
      const sc = p.life < 2 ? p.life / 2 : 1;
      this._q.setFromEuler(p.r);
      this.deb.setMatrixAt(i, this._m.compose(p.p, this._q, this._s.copy(p.s).multiplyScalar(sc)));
      changed = true;
    }
    if (changed) this.deb.instanceMatrix.needsUpdate = true;
    for (let k = this.sprites.length - 1; k >= 0; k--) {
      const o = this.sprites[k];
      o.life -= dt;
      if (o.life <= 0) { this.scene.remove(o.s); o.s.material.dispose(); this.sprites.splice(k, 1); continue; }
      o.vy -= o.g * dt;
      o.s.position.x += o.vx * dt; o.s.position.y += o.vy * dt; o.s.position.z += o.vz * dt;
      o.s.scale.multiplyScalar(1 + (o.grow - 1) * dt);
      o.s.material.opacity = o.op * (o.life / o.max);
    }
    void cam;
  }
}
