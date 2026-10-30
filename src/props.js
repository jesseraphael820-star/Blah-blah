import * as THREE from 'three';
import { clamp } from './util.js';
import { groundAt, cityAt } from './world.js';

// objetos de rua que quebram: poste, semáforo, hidrante e lixeira
// E = energia (J) da batida para arrancar do chão; m = massa (kg) do pedaço que voa
const KINDS = {
  lamp: { E: 55000, m: 160, len: 7.5, com: 3.4 },
  tlight: { E: 38000, m: 110, len: 5, com: 2.4 },
  hydrant: { E: 14000, m: 70, len: 0.75, com: 0.35 },
  bin: { E: 250, m: 18, len: 0.95, com: 0.45 },
};
const RESPAWN_D = 260;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _r = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _ax = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

export class Props {
  constructor(game) {
    this.g = game;
    const W = game.world;
    this.W = W;
    this.items = [];
    this.bodies = [];
    this.wobbles = [];
    this.jets = [];
    W.lamps.forEach((l, i) => this.add('lamp', l.box, W.lampIM.map((im) => [im, i]), W.lampGeo, l.x, l.y, l.z, l.rot, { lamp: l }));
    if (W.lights) W.lights.poles.forEach((P, k) => this.add('tlight', P.box, [[W.lights.pole, k], [W.lights.head, k], [W.lights.bulbs, k * 3], [W.lights.bulbs, k * 3 + 1], [W.lights.bulbs, k * 3 + 2]], W.lights.geo, P.x, P.y, P.z, P.rot));
    this.buildStreet();
  }

  add(kind, box, ims, geo, x, y, z, rot, extra) {
    const it = Object.assign({ kind, K: KINDS[kind], box, ims, geo, x, y, z, rot, broken: false, t: 0 }, extra);
    box.prop = it;
    this.items.push(it);
    return it;
  }

  // hidrantes e lixeiras nas calçadas, perto dos postes da cidade
  buildStreet() {
    const W = this.W, spots = { hydrant: [], bin: [] };
    W.lamps.forEach((l, i) => {
      if (!cityAt(l.x, l.z, -2) || i % 3 === 2) return;
      const kind = i % 3 === 0 ? 'hydrant' : 'bin';
      const ax = Math.cos(l.rot), az = -Math.sin(l.rot), d = kind === 'hydrant' ? 5 : -6;
      const x = l.x + ax * d, z = l.z + az * d;
      if (W.col.query(x, z, 0.6, []).some((b) => x > b.x0 - 0.6 && x < b.x1 + 0.6 && z > b.z0 - 0.6 && z < b.z1 + 0.6)) return;
      spots[kind].push({ x, z, y: groundAt(x, z), rot: l.rot });
    });
    const red = new THREE.MeshStandardMaterial({ color: 0xb8231b, roughness: 0.45, metalness: 0.3 });
    const bin = new THREE.MeshStandardMaterial({ color: 0x2f5d3a, roughness: 0.7, metalness: 0.2 });
    const lid = new THREE.MeshStandardMaterial({ color: 0x1d2a20, roughness: 0.6 });
    const G = {
      hydrant: { parts: [
        [new THREE.CylinderGeometry(0.14, 0.17, 0.6, 10).translate(0, 0.3, 0), red],
        [new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.6, 0), red],
        [new THREE.CylinderGeometry(0.06, 0.06, 0.42, 8).rotateZ(Math.PI / 2).translate(0, 0.42, 0), red],
        [new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8).rotateX(Math.PI / 2).translate(0, 0.38, 0.15), red],
        [new THREE.CylinderGeometry(0.2, 0.2, 0.05, 10).translate(0, 0.03, 0), red],
      ] },
      bin: { parts: [
        [new THREE.CylinderGeometry(0.3, 0.26, 0.9, 12, 1, true).translate(0, 0.45, 0), bin],
        [new THREE.CylinderGeometry(0.26, 0.26, 0.04, 12).translate(0, 0.03, 0), bin],
        [new THREE.CylinderGeometry(0.32, 0.32, 0.06, 12).translate(0, 0.93, 0), lid],
      ] },
    };
    for (const kind of ['hydrant', 'bin']) {
      const arr = spots[kind], geo = G[kind];
      if (!arr.length) continue;
      const ims = geo.parts.map(([g, mat]) => { const im = new THREE.InstancedMesh(g, mat, arr.length); im.castShadow = true; im.receiveShadow = true; W.scene.add(im); return im; });
      const up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
      arr.forEach((s, i) => {
        _q.setFromAxisAngle(up, s.rot);
        _m.compose(p.set(s.x, s.y, s.z), _q, one);
        for (const im of ims) im.setMatrixAt(i, _m);
        const h = KINDS[kind].len, r = kind === 'bin' ? 0.3 : 0.18;
        const box = W.addBox(s.x - r, s.x + r, s.z - r, s.z + r, s.y, s.y + h);
        this.add(kind, box, ims.map((im) => [im, i]), geo, s.x, s.y, s.z, s.rot);
      });
      for (const im of ims) im.computeBoundingSphere();
    }
  }

  // chamado pelo carro ao encostar na caixa de um objeto; true = arrancou (o carro passa)
  hit(v, b, nx, nz, cx, cz) {
    const it = b.prop;
    const rx = cx - v.pos.x, rz = cz - v.pos.z;
    const vcx = v.vel.x + v.yawRate * rz, vcz = v.vel.z - v.yawRate * rx;
    const vn = vcx * nx + vcz * nz;
    if (vn >= -0.3) return false;
    const m = v.t.mass + (v.driver ? 75 : 0), E = 0.5 * m * vn * vn;
    if (it.kind === 'tree') { if (-vn > 5) this.shakeTree(it, -vn, cx, cz); return false; }
    if (it.broken) return true;
    if (E < it.K.E) {
      if (-vn > 1.2 && it.kind !== 'hydrant') this.wobble(it, -vn * Math.sqrt(m / it.K.E) * 0.6, -nx, -nz);
      return false;
    }
    // arrancou: o carro perde a energia gasta pra cortar a base e empurra o pedaço junto
    const mp = it.K.m, left = Math.sqrt(Math.max(0, E - it.K.E * 0.85) * 2 / m);
    const vAfter = (m * left) / (m + mp * 0.6);
    const dv = -vn - vAfter;
    v.vel.x += nx * dv; v.vel.z += nz * dv;
    v.yawRate += ((rz * nx - rx * nz) * dv * m) / v.t.I * 0.5;
    if (v.jolt) v.jolt(nx * dv, nz * dv);
    if (it.kind !== 'bin') v.damage(Math.min(14, dv * 0.9 + 2.5), cx, cz, nx, nz);
    else v.impact = Math.max(v.impact, 1.6);
    this.breakItem(it, v, -vn, -nx, -nz, cx, cz);
    return true;
  }

  breakItem(it, v, sp, dx, dz, cx, cz) {
    it.broken = true; it.t = 0;
    it.box.gone = true;
    if (it.lamp) it.lamp.off = true;
    this.unwobble(it);
    this.setVisible(it, false);
    const fx = this.g.fx, audio = this.g.audio, y = it.y + 0.5;
    const dist = v.pos.distanceTo(this.g.camera.position);
    // corpo rígido do pedaço: base levada pelo carro, topo atrasa (tomba por cima do capô)
    const body = this.makeBody(it);
    const vx = v.vel.x, vz = v.vel.z, light = it.kind === 'bin' || it.kind === 'hydrant';
    // choque inelástico na altura do para-choque (0,5 m): o ponto batido sai com a velocidade do carro;
    // abaixo do centro de massa -> a base vai junto e o topo atrasa (tomba por cima do capô)
    const r = new THREE.Vector3(0, 0.5 - it.K.com, 0), dir = new THREE.Vector3(dx, 0, dz);
    const J = dir.clone().multiplyScalar(sp * (light ? 1.15 : 1) * this.effMass(body, r, dir));
    this.impulse(body, r, J);
    body.vel.y += light ? 1.5 + sp * 0.1 : 0.4;
    body.w.y += (Math.random() - 0.5) * 1.5;
    if (dist < 160) {
      fx.sparks(cx, y, cz, it.kind === 'bin' ? 0 : 18);
      if (it.kind === 'lamp' || it.kind === 'tlight') {
        audio.clang(dist, 0.9);
        for (let i = 0; i < 6; i++) fx.piece(it.x, it.y + 0.1, it.z, (Math.random() - 0.5) * 4 + dx * sp * 0.2, 1 + Math.random() * 3, (Math.random() - 0.5) * 4 + dz * sp * 0.2, 0.06 + Math.random() * 0.1, 0.04, 0.08 + Math.random() * 0.1, 0x8a8a84, 30);
      } else if (it.kind === 'hydrant') {
        audio.clang(dist, 0.5); audio.crash(sp * 0.4);
        this.jets.push({ x: it.x, y: it.y, z: it.z, t: 22, acc: 0 });
      } else {
        audio.bin(dist);
        // lixo voando
        const cols = [0xe8e2d0, 0xd6c49a, 0x9fb5c8, 0x7a5a3a, 0xc7d3b0];
        for (let i = 0; i < 12; i++) fx.piece(it.x, it.y + 0.6, it.z, vx * 0.6 + (Math.random() - 0.5) * 5, 2 + Math.random() * 4, vz * 0.6 + (Math.random() - 0.5) * 5, 0.1 + Math.random() * 0.15, 0.01, 0.1 + Math.random() * 0.15, cols[i % cols.length], 45);
      }
    }
  }

  makeBody(it) {
    const grp = new THREE.Group(), inner = new THREE.Group();
    inner.position.y = -it.K.com;
    for (const [g, mat] of it.geo.parts) { const m = new THREE.Mesh(g, mat); m.castShadow = true; inner.add(m); }
    grp.add(inner);
    this.W.scene.add(grp);
    const L = it.K.len, M = it.K.m, c = it.K.com;
    // pontos de contato com o chão (no referencial do corpo, relativo ao centro de massa)
    const pts = [new THREE.Vector3(0, -c, 0), new THREE.Vector3(0, L - c, 0), new THREE.Vector3(0, L * 0.5 - c, 0)];
    if (it.kind === 'lamp') pts.push(new THREE.Vector3(0, 7.32 - c, -1.6), new THREE.Vector3(0, 7.4 - c, -0.8));
    if (it.kind === 'tlight') pts.push(new THREE.Vector3(0.17, 5 - c, 0.13), new THREE.Vector3(-0.17, 5 - c, -0.13));
    if (it.kind === 'bin' || it.kind === 'hydrant') {
      const r = it.kind === 'bin' ? 0.3 : 0.18;
      for (const y of [-c, L - c]) for (let a = 0; a < 4; a++) pts.push(new THREE.Vector3(Math.cos(a * 1.57) * r, y, Math.sin(a * 1.57) * r));
    }
    const rad = it.kind === 'bin' ? 0.3 : it.kind === 'hydrant' ? 0.18 : 0.1;
    const Ixx = M * (L * L / 12 + rad * rad / 4) + (it.kind === 'lamp' ? M * 0.4 : 0), Iyy = Math.max(M * rad * rad * 0.5, M * 0.04);
    const b = {
      it, grp, M, pts, invI: new THREE.Vector3(1 / Ixx, 1 / Iyy, 1 / Ixx),
      pos: new THREE.Vector3(it.x, it.y + c, it.z), q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot),
      vel: new THREE.Vector3(), w: new THREE.Vector3(), rest: 0, sleep: false, life: 0, clangT: 0,
    };
    it.body = b;
    this.bodies.push(b);
    this.sync(b);
    return b;
  }

  // w <- I⁻¹ (no mundo) · w
  applyInvI(b, w) {
    _q.copy(b.q).invert();
    w.applyQuaternion(_q).multiply(b.invI).applyQuaternion(b.q);
    return w;
  }

  // impulso J no ponto r (relativo ao centro de massa, no mundo)
  impulse(b, r, J) {
    b.vel.addScaledVector(J, 1 / b.M);
    _w.crossVectors(r, J);
    b.w.add(this.applyInvI(b, _w));
  }

  // massa efetiva no ponto r na direção n
  effMass(b, r, n) {
    _w.crossVectors(r, n);
    this.applyInvI(b, _w);
    _ax.crossVectors(_w, r);
    return 1 / (1 / b.M + _ax.dot(n));
  }

  sync(b) {
    b.grp.position.copy(b.pos);
    b.grp.quaternion.copy(b.q);
  }

  stepBody(b, dt) {
    const g = this.g, fx = g.fx;
    b.life += dt; b.clangT -= dt;
    b.vel.y -= 9.81 * dt;
    b.pos.addScaledVector(b.vel, dt);
    const wl = b.w.length();
    if (wl > 1e-6) { _q.setFromAxisAngle(_ax.copy(b.w).divideScalar(wl), wl * dt); b.q.premultiply(_q).normalize(); }
    b.w.multiplyScalar(Math.exp(-dt * 0.25));
    // contato com o chão: impulso normal com quique baixo + atrito
    const n = UP;
    let contact = 0, hard = 0, hx = 0, hz = 0;
    for (const lp of b.pts) {
      const r = _r.copy(lp).applyQuaternion(b.q);
      const wx = b.pos.x + r.x, wz = b.pos.z + r.z, gy = groundAt(wx, wz);
      const pen = gy - (b.pos.y + r.y);
      if (pen <= 0) continue;
      contact++;
      b.pos.y += pen * 0.6;
      const vp = _v.crossVectors(b.w, r).add(b.vel);
      const vn = vp.y;
      if (vn < 0) {
        if (-vn > hard) { hard = -vn; hx = wx; hz = wz; }
        const e = -vn > 3 ? 0.22 : 0;
        const jn = -(1 + e) * vn * this.effMass(b, r, n);
        const J = new THREE.Vector3(0, jn, 0);
        // atrito de Coulomb no plano
        const tx = vp.x, tz = vp.z, tl = Math.hypot(tx, tz);
        if (tl > 1e-4) {
          const tdir = new THREE.Vector3(-tx / tl, 0, -tz / tl);
          const jt = Math.min(0.55 * jn, tl * this.effMass(b, r, tdir));
          J.addScaledVector(tdir, jt);
          if (tl > 4 && b.it.kind !== 'bin' && Math.random() < dt * 30) fx.sparks(wx, gy + 0.05, wz, 2);
        }
        this.impulse(b, r, J);
      }
    }
    if (hard > 2.5 && b.clangT <= 0) {
      b.clangT = 0.18;
      const d = Math.hypot(hx - g.camera.position.x, hz - g.camera.position.z);
      if (b.it.kind === 'bin') g.audio.bin(d * 1.5); else g.audio.clang(d, clamp(hard / 8, 0.15, 0.8));
      if (d < 120) {
        if (b.it.kind === 'lamp' && b.life < 4) { fx.sparks(hx, groundAt(hx, hz) + 0.1, hz, 16); }
        for (let i = 0; i < 3; i++) fx.sprite(hx, groundAt(hx, hz) + 0.2, hz, { color: 0x9b8f7c, op: 0.3, size: 0.7, life: 1.4, vx: (Math.random() - 0.5) * 2, vy: 0.5, vz: (Math.random() - 0.5) * 2, grow: 2.5 });
      }
    }
    if (contact) { b.vel.x *= Math.exp(-dt * 0.6); b.vel.z *= Math.exp(-dt * 0.6); b.w.multiplyScalar(Math.exp(-dt * 1.2)); }
    // parado: dorme
    if (contact && b.vel.lengthSq() < 0.04 && b.w.lengthSq() < 0.04) { b.rest += dt; if (b.rest > 0.6) { b.sleep = true; b.vel.set(0, 0, 0); b.w.set(0, 0, 0); } } else b.rest = 0;
  }

  // carro empurra / passa por cima do pedaço caído
  pushBody(b, v) {
    const dx = b.pos.x - v.pos.x, dz = b.pos.z - v.pos.z, R = v.t.length / 2 + b.it.K.len + 1;
    if (dx * dx + dz * dz > R * R) return;
    const sp = v.speed;
    if (sp < 0.5) return;
    const dir = _ax.set(v.vel.x / sp, 0, v.vel.z / sp).clone();
    let bumped = false;
    for (const lp of b.pts) {
      const r = _r.copy(lp).applyQuaternion(b.q);
      const wx = b.pos.x + r.x, wy = b.pos.y + r.y, wz = b.pos.z + r.z;
      if (wy > v.pos.y + v.t.height * 0.75 || !v.contains(wx, wz, 0.15)) continue;
      const vp = _v.crossVectors(b.w, r).add(b.vel);
      const rel = sp - vp.dot(dir);
      if (rel <= 0) continue;
      // por cima: objeto baixo e carro pesado -> lombada; senão empurra
      if (wy < v.pos.y + 0.45 && b.it.kind !== 'bin') {
        if (!bumped && v.jolt) { v.sHv += Math.min(1.2, sp * 0.06); v.vel.multiplyScalar(0.995); bumped = true; }
        const J = dir.clone().multiplyScalar(rel * this.effMass(b, r, dir) * 0.3); J.y = rel * b.M * 0.05;
        this.impulse(b, r, J);
      } else {
        const J = dir.clone().multiplyScalar(rel * this.effMass(b, r, dir) * 1.05); J.y = rel * b.M * 0.12;
        this.impulse(b, r, J);
        const dvc = J.length() / v.t.mass;
        v.vel.addScaledVector(dir, -dvc);
      }
      b.sleep = false; b.rest = 0;
    }
  }

  // balanço do poste que levou uma batida sem quebrar (mola amortecida)
  wobble(it, amp, dx, dz) {
    let w = this.wobbles.find((o) => o.it === it);
    if (!w) {
      w = { it, a: 0, av: 0, ax: -dz, az: dx, base: it.ims.map(([im, i]) => { const M = new THREE.Matrix4(); im.getMatrixAt(i, M); return M; }) };
      this.wobbles.push(w);
    }
    w.ax = -dz; w.az = dx;
    w.av += clamp(amp, 0, 0.6) * (it.kind === 'bin' ? 2 : 1);
    const d = Math.hypot(it.x - this.g.camera.position.x, it.z - this.g.camera.position.z);
    if (it.kind === 'lamp' || it.kind === 'tlight') this.g.audio.clang(d, clamp(amp * 2, 0.1, 0.5));
  }
  unwobble(it) {
    const k = this.wobbles.findIndex((o) => o.it === it);
    if (k < 0) return;
    const w = this.wobbles[k];
    it.ims.forEach(([im, i], j) => { im.setMatrixAt(i, w.base[j]); im.instanceMatrix.needsUpdate = true; });
    this.wobbles.splice(k, 1);
  }

  setVisible(it, on) {
    if (!on) it.base = it.ims.map(([im, i]) => { const M = new THREE.Matrix4(); im.getMatrixAt(i, M); return M; });
    const zero = _m2.makeScale(0, 0, 0);
    it.ims.forEach(([im, i], j) => { im.setMatrixAt(i, on ? it.base[j] : zero); im.instanceMatrix.needsUpdate = true; });
  }

  // árvore: copa treme e solta folhas
  shakeTree(it, sp, cx, cz) {
    const now = performance.now();
    if (it.lastShake && now - it.lastShake < 600) return;
    it.lastShake = now;
    const fx = this.g.fx, n = Math.min(24, Math.floor(sp * 1.5));
    const cols = it.type === 'palm' ? [0x5d7a2e, 0x7a8a3a] : it.type === 'pine' ? [0x2f4a2a, 0x3a5530] : [0x4f6e2c, 0x6b8a36, 0x8a7a30];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, r = Math.random() * 2.5 * it.s;
      fx.piece(it.x + Math.cos(a) * r, it.y + 3 + Math.random() * 3 * it.s, it.z + Math.sin(a) * r, (Math.random() - 0.5) * 1.5, -0.5, (Math.random() - 0.5) * 1.5, 0.12, 0.01, 0.09, cols[i % cols.length], 12);
    }
    this.g.audio.thud(Math.hypot(cx - this.g.camera.position.x, cz - this.g.camera.position.z), sp);
  }

  update(dt) {
    const g = this.g, fx = g.fx, F = g.focus, cam = g.camera.position;
    // pedaços caídos
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const b = this.bodies[i];
      const sub = b.sleep ? 0 : Math.min(6, Math.ceil(dt / 0.006));
      for (let s = 0; s < sub; s++) this.stepBody(b, dt / sub);
      for (const v of g.vehicles) if (!v.t.boat && v.speed > 0.5 && Math.abs(v.pos.x - b.pos.x) < 14 && Math.abs(v.pos.z - b.pos.z) < 14) this.pushBody(b, v);
      if (!b.sleep) this.sync(b);
    }
    // balanço
    for (let i = this.wobbles.length - 1; i >= 0; i--) {
      const w = this.wobbles[i], h = Math.min(dt, 0.03);
      const k = w.it.kind === 'bin' ? 90 : 160, c = w.it.kind === 'bin' ? 4 : 2.2;
      w.av += (-k * w.a - c * w.av) * h; w.a += w.av * h;
      _q.setFromAxisAngle(_ax.set(w.ax, 0, w.az).normalize(), clamp(w.a, -0.25, 0.25) * 0.4);
      const it = w.it;
      _m.makeTranslation(it.x, it.y, it.z).multiply(_m2.makeRotationFromQuaternion(_q)).multiply(new THREE.Matrix4().makeTranslation(-it.x, -it.y, -it.z));
      it.ims.forEach(([im, idx], j) => { im.setMatrixAt(idx, _m2.multiplyMatrices(_m, w.base[j])); im.instanceMatrix.needsUpdate = true; });
      if (Math.abs(w.a) < 0.002 && Math.abs(w.av) < 0.01) this.unwobble(it);
    }
    // jato do hidrante
    for (let i = this.jets.length - 1; i >= 0; i--) {
      const J = this.jets[i];
      J.t -= dt;
      const d = Math.hypot(J.x - cam.x, J.z - cam.z);
      if (d < 150) {
        J.acc += dt * 45 * clamp(J.t / 4, 0, 1);
        while (J.acc > 1) {
          J.acc--;
          fx.sprite(J.x + (Math.random() - 0.5) * 0.2, J.y + 0.3, J.z + (Math.random() - 0.5) * 0.2, { color: 0xf2f8ff, op: 0.8, size: 0.45, life: 1.6, vx: (Math.random() - 0.5) * 2.2 + g.env.wind.x * 0.15, vy: 11 + Math.random() * 3, vz: (Math.random() - 0.5) * 2.2 + g.env.wind.y * 0.15, g: 9.8, grow: 3.5 });
          // água espirrando no chão em volta
          if (Math.random() < 0.3) { const a = Math.random() * 6.28, r = 1.5 + Math.random() * 3; fx.sprite(J.x + Math.cos(a) * r, J.y + 0.1, J.z + Math.sin(a) * r, { color: 0xe8f2fa, op: 0.5, size: 0.4, life: 0.6, vy: 1.5, grow: 2.5 }); }
        }
      }
      if (!this.jetNear || d < this.jetNear) this.jetNear = d;
      if (J.t <= 0) this.jets.splice(i, 1);
    }
    g.audio.setGush(this.jets.length ? clamp(1 - (this.jetNear || 999) / 60, 0, 1) : 0);
    this.jetNear = 0;
    // quebrados longe da vista voltam ao lugar
    this.chk = (this.chk || 0) - dt;
    if (this.chk <= 0) {
      this.chk = 1;
      for (const it of this.items) {
        if (!it.broken) continue;
        it.t += 1;
        const d = Math.hypot(it.x - F.x, it.z - F.z), bd = it.body ? Math.hypot(it.body.pos.x - F.x, it.body.pos.z - F.z) : d;
        if (it.t > 25 && d > RESPAWN_D && bd > RESPAWN_D) this.restore(it);
      }
    }
  }

  restore(it) {
    if (it.body) { this.W.scene.remove(it.body.grp); this.bodies.splice(this.bodies.indexOf(it.body), 1); it.body = null; }
    it.broken = false; it.box.gone = false;
    if (it.lamp) it.lamp.off = false;
    this.setVisible(it, true);
  }

  reset() { for (const it of this.items) if (it.broken) this.restore(it); this.jets.length = 0; }
}
