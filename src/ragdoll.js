import * as THREE from 'three';
import { clamp } from './util.js';
import { groundAt } from './world.js';

// atropelamento: o pedestre vira um corpo rígido (75 kg, 1,75 m) que bate na silhueta do carro
// (para-choque, capô, para-brisa, teto) e no chão. Daí saem naturalmente os casos reais:
// devagar ele é empurrado e cai na frente; a 30–50 km/h a perna é varrida, o corpo enrola no capô,
// a cabeça bate no para-brisa e ele é jogado à frente quando o carro freia; muito rápido ele passa
// por cima do teto e cai atrás; de raspão ele gira e cai de lado; em caminhonete (frente alta) é arremessado reto.
const MASS = 75, COM = 1.0;
const I = new THREE.Vector3(1 / 13, 1 / 1.4, 1 / 13);
// pontos de contato no corpo (relativos ao centro de massa, quadril) e raio de cada um
const PTS = [
  [0.12, -0.95, 0, 0.06, 'foot'], [-0.12, -0.95, 0, 0.06, 'foot'],
  [0.1, -0.5, 0.04, 0.07, 'knee'], [-0.1, -0.5, 0.04, 0.07, 'knee'],
  [0.17, 0, 0, 0.12, 'hip'], [-0.17, 0, 0, 0.12, 'hip'],
  [0.2, 0.4, 0, 0.12, 'chest'], [-0.2, 0.4, 0, 0.12, 'chest'],
  [0, 0.72, 0, 0.11, 'head'],
].map(([x, y, z, r, n]) => ({ p: new THREE.Vector3(x, y, z), r, n }));
const UP = new THREE.Vector3(0, 1, 0);
const _r = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _a = new THREE.Vector3(), _q = new THREE.Quaternion(), _n = new THREE.Vector3(), _t = new THREE.Vector3(), _J = new THREE.Vector3();

// altura da lataria na coordenada f (frente +) do carro; e a inclinação (dh/df)
function carSurface(v, f) {
  const t = v.t, P = v.parts && v.parts.prof;
  if (!P) return [t.twoWheel ? 0.95 : t.height * 0.6, 0];
  const L = t.length / 2;
  // capô sobe um pouco até a base do para-brisa; para-brisa inclinado até o teto
  const ws0 = P.fz0 + 0.35, ws1 = P.fz0 - 0.25;
  if (f > ws0) { const k = (L - f) / Math.max(0.1, L - ws0); return [P.top - 0.06 + k * 0.08, -0.08 / Math.max(0.1, L - ws0)]; }
  if (f > ws1) { const k = (ws0 - f) / (ws0 - ws1); return [P.top + 0.02 + k * (P.roof - P.top - 0.02), -(P.roof - P.top - 0.02) / (ws0 - ws1)]; }
  if (f > P.bz0 + 0.15) return [P.roof, 0];
  if (f > P.bz0 - 0.2) return [P.top + 0.02, 0];
  return [P.top - 0.02, 0];
}

export class RagBody {
  // q opcional: começa de uma pose já caída (corpo no chão sendo atropelado de novo)
  constructor(feet, heading, vel, q) {
    this.q = q ? q.clone() : new THREE.Quaternion().setFromAxisAngle(UP, heading);
    this.pos = new THREE.Vector3(0, COM, 0).applyQuaternion(this.q).add(feet);
    this.vel = vel.clone();
    this.w = new THREE.Vector3();
    this.rest = 0; this.done = false; this.onGround = false; this.air = 0;
    this.hits = []; // impactos do passo: { dv, n (nome do ponto), car, x, y, z, where }
    this.flail = 1;
  }

  invI(w) { _q.copy(this.q).invert(); return w.applyQuaternion(_q).multiply(I).applyQuaternion(this.q); }
  effMass(r, n) { _w.crossVectors(r, n); this.invI(_w); _a.crossVectors(_w, r); return 1 / (1 / MASS + _a.dot(n)); }
  impulse(r, J) { this.vel.addScaledVector(J, 1 / MASS); _w.crossVectors(r, J); this.w.add(this.invI(_w)); }

  // contato de um ponto com velocidade relativa rel (já com a do obstáculo descontada)
  contact(r, n, rel, e, mu) {
    const vn = rel.dot(n);
    if (vn >= 0) return 0;
    const jn = -(1 + e) * vn * this.effMass(r, n);
    _J.copy(n).multiplyScalar(jn);
    _t.copy(rel).addScaledVector(n, -vn);
    const tl = _t.length();
    if (tl > 1e-4) {
      _t.divideScalar(-tl);
      _J.addScaledVector(_t, Math.min(mu * jn, tl * this.effMass(r, _t)));
    }
    this.impulse(r, _J);
    return jn;
  }

  step(dt, cars, col) {
    this.hits.length = 0;
    const sub = 8, h = dt / sub;
    for (let s = 0; s < sub; s++) this.sub(h, cars, col, dt - (s + 1) * h);
    // ainda em movimento? (no chão, quase parado por meio segundo = assentou)
    const slow = this.vel.lengthSq() < 0.09 && this.w.lengthSq() < 0.3;
    this.rest = this.onGround && slow ? this.rest + dt : 0;
    if (this.rest > 0.5) this.done = true;
    this.flail = clamp(this.flail + ((this.onGround ? 0 : 1) - this.flail) * dt * (this.onGround ? 3 : 6), 0, 1);
    this.air = this.onGround ? 0 : this.air + dt;
  }

  sub(h, cars, col, back) {
    this.vel.y -= 9.81 * h;
    // arrasto do ar (corpo de 0,6 m² de área): a 90 km/h tira o corpo de cima do teto
    const sp = this.vel.length();
    if (sp > 1) this.vel.multiplyScalar(1 - Math.min(0.5, 0.0048 * sp * h));
    this.pos.addScaledVector(this.vel, h);
    const wl = this.w.length();
    if (wl > 25) this.w.multiplyScalar(25 / wl);
    if (wl > 1e-6) { _q.setFromAxisAngle(_a.copy(this.w).divideScalar(wl), wl * h); this.q.premultiply(_q).normalize(); }
    this.w.multiplyScalar(Math.exp(-h * 0.6));
    // carros por perto: posição recuada para o instante deste subpasso
    for (const v of cars) {
      const hd = v.heading - v.yawRate * back, sh = Math.sin(hd), ch = Math.cos(hd);
      const cx = v.pos.x - v.vel.x * back, cz = v.pos.z - v.vel.z * back, cy = v.pos.y;
      const L = v.t.length / 2, W = v.t.width / 2;
      for (const P of PTS) {
        const r = _r.copy(P.p).applyQuaternion(this.q);
        const wx = this.pos.x + r.x - cx, wy = this.pos.y + r.y - cy, wz = this.pos.z + r.z - cz;
        const f = wx * sh + wz * ch, l = wx * ch - wz * sh;
        if (Math.abs(f) > L + P.r || Math.abs(l) > W + P.r || wy < 0.12) continue;
        const [top, slope] = carSurface(v, f);
        if (wy > top + P.r) continue;
        // menor saída: por cima (normal da superfície), pela frente, por trás ou pelo lado
        const ny = 1 / Math.hypot(1, slope), nf = -slope * ny;
        const pTop = (top + P.r - wy) * ny, pF = L + P.r - f, pB = f + L + P.r, pS = W + P.r - Math.abs(l);
        let pen = pTop, lf = nf, ll = 0, lyN = ny, where = f > (v.parts && v.parts.prof ? v.parts.prof.fz0 + 0.7 : 0) ? 'hood' : f > (v.parts && v.parts.prof ? v.parts.prof.fz0 - 0.4 : -9) ? 'glass' : 'roof';
        if (pF < pen) { pen = pF; lf = 1; ll = 0; lyN = 0; where = 'front'; }
        if (pB < pen) { pen = pB; lf = -1; ll = 0; lyN = 0; where = 'rear'; }
        if (pS < pen) { pen = pS; lf = 0; ll = Math.sign(l); lyN = 0; where = 'side'; }
        _n.set(lf * sh + ll * ch, lyN, lf * ch - ll * sh).normalize();
        this.pos.addScaledVector(_n, pen * 0.8);
        // velocidade do ponto do carro (translação + giro)
        const rx = this.pos.x + r.x - cx, rz = this.pos.z + r.z - cz;
        _v.crossVectors(this.w, r).add(this.vel);
        _v.x -= v.vel.x + v.yawRate * rz; _v.z -= v.vel.z - v.yawRate * rx;
        const vn = -_v.dot(_n);
        const jn = this.contact(r, _n, _v, where === 'front' ? 0.25 : 0.12, where === 'front' ? 0.5 : 0.3);
        if (jn > 0) {
          // reação no carro (75 kg contra uma tonelada e pouco: freia um tiquinho)
          const k = jn / (v.t.mass + (v.driver ? 75 : 0));
          v.vel.x -= _n.x * k; v.vel.z -= _n.z * k;
          if (vn > 1.5) this.hits.push({ dv: vn, n: P.n, car: v, x: this.pos.x + r.x, y: this.pos.y + r.y, z: this.pos.z + r.z, where, nx: _n.x, nz: _n.z });
        }
      }
    }
    // chão
    this.onGround = false;
    for (const P of PTS) {
      const r = _r.copy(P.p).applyQuaternion(this.q);
      const x = this.pos.x + r.x, z = this.pos.z + r.z, gy = groundAt(x, z) + P.r;
      const pen = gy - (this.pos.y + r.y);
      if (pen <= 0) continue;
      this.onGround = true;
      this.pos.y += pen * 0.7;
      _v.crossVectors(this.w, r).add(this.vel);
      const vn = -_v.y;
      if (this.contact(r, UP, _v, vn > 4 ? 0.15 : 0, 0.65) > 0 && vn > 3) this.hits.push({ dv: vn, n: P.n, car: null, x, y: gy - P.r, z, where: 'ground' });
    }
    if (this.onGround) { this.w.multiplyScalar(Math.exp(-h * 2.5)); const k = Math.exp(-h * 0.8); this.vel.x *= k; this.vel.z *= k; }
    // paredes: o corpo para e escorrega
    if (col) {
      const p = { x: this.pos.x, z: this.pos.z }, n = { x: 0, z: 0 };
      if (col.resolveCircle(p, 0.3, this.pos.y - 0.6, n)) {
        this.pos.x = p.x; this.pos.z = p.z;
        const vn = this.vel.x * n.x + this.vel.z * n.z;
        if (vn < 0) {
          this.vel.x -= n.x * vn * 1.2; this.vel.z -= n.z * vn * 1.2;
          if (-vn > 3) this.hits.push({ dv: -vn, n: 'chest', car: null, x: this.pos.x, y: this.pos.y, z: this.pos.z, where: 'wall' });
        }
      }
    }
  }

  // posição dos pés (origem do personagem) e orientação para o modelo
  apply(root) {
    root.quaternion.copy(this.q);
    root.position.copy(_r.set(0, -COM, 0).applyQuaternion(this.q).add(this.pos));
  }
  get feet() { return _r.set(0, -COM, 0).applyQuaternion(this.q).add(this.pos); }
  get speed() { return this.vel.length(); }
}

// começa o corpo encostado na lataria do carro (sem nascer enfiado dentro dele)
export function startRag(pos, heading, vel, v, q) {
  const t = v.t, sh = Math.sin(v.heading), ch = Math.cos(v.heading);
  const dx = pos.x - v.pos.x, dz = pos.z - v.pos.z;
  let f = dx * sh + dz * ch, l = dx * ch - dz * sh;
  const L = t.length / 2, W = t.width / 2;
  // dentro da largura do carro: foi a frente (ou a traseira, de ré) que pegou, mesmo que num quadro rápido ele já tenha entrado fundo
  const fwd = v.vel.x * sh + v.vel.z * ch;
  if (Math.abs(l) < W - 0.15 || L - Math.abs(f) > W - Math.abs(l)) f = (Math.abs(fwd) > 1 ? Math.sign(fwd) : Math.sign(f || 1)) * (L + 0.12);
  else l = Math.sign(l || 1) * (W + 0.12);
  pos.x = v.pos.x + sh * f + ch * l; pos.z = v.pos.z + ch * f - sh * l;
  return new RagBody(pos, heading, vel, q);
}

// efeitos de cada pancada do corpo: sangue, poeira, para-brisa estourando, capô amassando, tranco na câmera
// hurt(dv, cabeça?) aplica o dano em quem estiver no corpo
export function ragHits(g, R, hurt, fxV) {
  const cam = g.camera.position;
  for (const h of R.hits) {
    const head = h.n === 'head';
    if (h.dv > 3.5) hurt(h.dv, head);
    const d = Math.hypot(h.x - cam.x, h.z - cam.z);
    if (h.dv > 4 && d < 120) { if (g.combat) g.combat.blood(h.x, h.y, h.z, head ? 6 : 3); g.audio.thud(d, h.dv); }
    if (h.car && h.car.parts) {
      const P = h.car.parts, sh = Math.sin(h.car.heading), ch = Math.cos(h.car.heading);
      if (h.where === 'glass' && (head || h.n === 'chest') && h.dv > 5 && P.paneF && P.paneF.visible && fxV) fxV.glass(h.car, P.paneF);
      if ((h.where === 'hood' || h.where === 'glass') && h.dv > 4) h.car.damage(Math.min(5, h.dv * 0.45), h.x, h.z, -sh, -ch);
      if (h.car.driver === 'player') { g.cam.shake = Math.max(g.cam.shake, clamp(h.dv * 0.015, 0.02, 0.15)); g.input.rumble(0.4, 0.3, 90); }
    }
    if (h.where === 'ground' && h.dv > 4 && d < 120) for (let k = 0; k < 3; k++) g.fx.sprite(h.x, h.y + 0.1, h.z, { color: 0x9b8f7c, op: 0.3, size: 0.4, life: 0.9, vx: (Math.random() - 0.5) * 2, vy: 0.4, vz: (Math.random() - 0.5) * 2, grow: 2.5 });
  }
}

// levantar: fica deitado um instante e gira em volta do quadril até ficar de pé
export function getUp(root, restQ, restPos, heading, tLeft, ch) {
  if (tLeft < 0.9) {
    const u = clamp(1 - tLeft / 0.9, 0, 1), e = u * u * (3 - 2 * u);
    const hip = _v.set(0, COM, 0).applyQuaternion(restQ).add(restPos);
    _q.setFromAxisAngle(UP, heading);
    root.quaternion.slerpQuaternions(restQ, _q, e);
    root.position.set(hip.x, groundAt(hip.x, hip.z), hip.z).lerp(restPos, 1 - e);
    ch.getup = 1 - e * 0.8;
  } else { root.quaternion.copy(restQ); root.position.copy(restPos); ch.getup = 0; }
  ch.ragK = 0.1;
}
