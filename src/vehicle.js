// Vehicles: procedural car models, arcade physics with drift, traffic & police AI.
import * as THREE from 'three';
import { clamp, damp, angleDiff, lerp } from './util.js';
import { N, CELL, ORIGIN, LANE, nodeCoord } from './world.js';

export const CAR_TYPES = {
  sedan: { name: 'Corsa Sol', len: 4.5, w: 1.86, maxSpeed: 42, accel: 12, grip: 7.5, steer: 0.6, profile: 'sedan', colors: [0x8c1d1d, 0x1d3f8c, 0xd8d8d8, 0x222222, 0x3d6b3d, 0x9a8a6a, 0x5d2d6d] },
  sport: { name: 'Fúria GT', len: 4.4, w: 1.96, maxSpeed: 62, accel: 19, grip: 9, steer: 0.55, profile: 'sport', colors: [0xd11a1a, 0xf2c200, 0x111111, 0xff6a00, 0x1a7fd1, 0xeaeaea] },
  van: { name: 'Mula', len: 5.0, w: 2.02, maxSpeed: 31, accel: 8, grip: 6, steer: 0.55, profile: 'van', colors: [0xf0f0f0, 0x7a6a50, 0x3a5a7a, 0xb0a070] },
  pickup: { name: 'Jacaré', len: 5.1, w: 2.0, maxSpeed: 38, accel: 11, grip: 6.5, steer: 0.55, profile: 'pickup', colors: [0x6a3a1a, 0x2a4a2a, 0x8a8a8a, 0xa01a1a, 0x1a2a4a] },
  taxi: { name: 'Táxi Porto', len: 4.5, w: 1.86, maxSpeed: 40, accel: 12, grip: 7.5, steer: 0.6, profile: 'sedan', colors: [0xf2c41a], taxi: true },
  police: { name: 'Viatura', len: 4.6, w: 1.9, maxSpeed: 52, accel: 16, grip: 8.5, steer: 0.6, profile: 'sedan', colors: [0x111111], police: true },
};

const PROFILES = {
  sedan: {
    body: [[-2.25, 0.32], [2.25, 0.32], [2.3, 0.55], [2.2, 0.8], [0.95, 0.93], [-1.55, 0.96], [-2.2, 0.9], [-2.3, 0.6]],
    cabin: [[0.98, 0.9], [0.25, 1.38], [-1.0, 1.4], [-1.62, 0.94]], roof: [-0.95, 0.2, 1.4], wheelR: 0.35, wb: 2.7,
  },
  sport: {
    body: [[-2.2, 0.27], [2.2, 0.27], [2.28, 0.44], [2.12, 0.62], [0.75, 0.78], [-1.7, 0.84], [-2.2, 0.8], [-2.28, 0.5]],
    cabin: [[0.8, 0.76], [0.05, 1.12], [-0.85, 1.13], [-1.78, 0.82]], roof: [-0.8, 0.0, 1.13], wheelR: 0.36, wb: 2.6, spoiler: true,
  },
  van: {
    body: [[-2.5, 0.38], [2.5, 0.38], [2.55, 0.62], [2.45, 1.05], [1.6, 1.15], [-2.5, 1.15], [-2.55, 0.62]],
    cabin: [[1.62, 1.13], [1.0, 1.96], [0.4, 1.98], [0.4, 1.13]], cargo: [-2.5, 0.42, 1.13, 2.02], wheelR: 0.38, wb: 3.1,
  },
  pickup: {
    body: [[-2.55, 0.42], [2.5, 0.42], [2.55, 0.66], [2.45, 1.02], [1.2, 1.1], [-2.55, 1.1], [-2.6, 0.66]],
    cabin: [[1.22, 1.08], [0.6, 1.72], [-0.5, 1.74], [-0.5, 1.08]], roof: [-0.45, 0.55, 1.74], bed: true, wheelR: 0.42, wb: 3.1,
  },
};

const sharedMats = {
  glass: new THREE.MeshPhysicalMaterial({ color: 0x0b1216, roughness: 0.04, metalness: 0.3, transparent: true, opacity: 0.62, clearcoat: 1 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xc8c8c8, roughness: 0.25, metalness: 0.95 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.8 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.15, metalness: 1 }),
  head: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d0, emissiveIntensity: 2.2 }),
  red: new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff0000, emissiveIntensity: 3 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x000055, emissive: 0x0044ff, emissiveIntensity: 3 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.35, metalness: 0.3 }),
  taxiSign: new THREE.MeshStandardMaterial({ color: 0xfff3a0, emissive: 0xffd040, emissiveIntensity: 1.2 }),
  burnt: new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 1 }),
};
const geoCache = new Map();

function extrude(points, width, sx) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x * sx, y) : s.moveTo(x * sx, y)));
  s.closePath();
  const bev = 0.07;
  const g = new THREE.ExtrudeGeometry(s, { depth: width - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: 0.05, bevelSegments: 3, steps: 1 });
  g.translate(0, 0, -(width - bev * 2) / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

let carId = 0;
export class Car {
  constructor(typeKey, color) {
    this.id = carId++;
    this.typeKey = typeKey;
    const T = (this.type = CAR_TYPES[typeKey]);
    const P = PROFILES[T.profile];
    this.len = T.len; this.w = T.w;
    this.group = new THREE.Group();
    this.body = new THREE.Group(); this.group.add(this.body);
    const sx = T.len / (T.profile === 'van' || T.profile === 'pickup' ? 5.1 : 4.5);
    this.paint = new THREE.MeshPhysicalMaterial({ color: color ?? T.colors[Math.floor(Math.random() * T.colors.length)], metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 });
    const add = (g, m, shadow = true, parent = this.body) => { const mesh = new THREE.Mesh(g, m); mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh); return mesh; };
    const key = `${typeKey}`;
    if (!geoCache.has(key)) {
      geoCache.set(key, {
        body: extrude(P.body, T.w, sx),
        cabin: extrude(P.cabin, T.w - 0.16, sx),
      });
    }
    const G = geoCache.get(key);
    const bodyMesh = add(G.body, this.paint);
    if (T.police) {
      // white doors band for police
      const band = add(new THREE.BoxGeometry(T.w + 0.02, 0.32, 2.2 * sx), sharedMats.white, false);
      band.position.set(0, 0.62, -0.1);
    }
    add(G.cabin, sharedMats.glass, false);
    if (P.roof) {
      const [r0, r1, ry] = P.roof;
      const roof = add(new THREE.BoxGeometry(T.w - 0.2, 0.06, (r1 - r0) * sx), T.police ? sharedMats.white : this.paint);
      roof.position.set(0, ry - 0.01, ((r0 + r1) / 2) * sx);
    }
    if (P.cargo) {
      const [c0, c1, y0, y1] = P.cargo;
      const cg = add(new THREE.BoxGeometry(T.w - 0.04, y1 - y0, (c1 - c0) * sx), this.paint);
      cg.position.set(0, (y0 + y1) / 2, ((c0 + c1) / 2) * sx);
    }
    if (P.bed) {
      for (const s of [-1, 1]) { const side = add(new THREE.BoxGeometry(0.08, 0.35, 2.0), this.paint); side.position.set(s * (T.w / 2 - 0.06), 1.25, -1.5); }
      const tg = add(new THREE.BoxGeometry(T.w - 0.1, 0.35, 0.08), this.paint); tg.position.set(0, 1.25, -2.55);
    }
    if (P.spoiler) {
      const sp = add(new THREE.BoxGeometry(T.w - 0.2, 0.05, 0.35), sharedMats.dark); sp.position.set(0, 1.05, -2.05);
      for (const s of [-0.6, 0.6]) { const st = add(new THREE.BoxGeometry(0.06, 0.22, 0.1), sharedMats.dark); st.position.set(s, 0.92, -2.0); }
    }
    // interior & underbody
    const inter = add(new THREE.BoxGeometry(T.w - 0.3, 0.3, 2.2 * sx), sharedMats.dark, false); inter.position.set(0, 0.8, -0.2);
    const under = add(new THREE.BoxGeometry(T.w - 0.3, 0.25, T.len - 1), sharedMats.dark, false); under.position.set(0, 0.32, 0);
    // bumpers & grille
    const fb = add(new THREE.BoxGeometry(T.w - 0.05, 0.16, 0.12), sharedMats.dark); fb.position.set(0, 0.38, T.len / 2 + 0.02);
    const rb = add(new THREE.BoxGeometry(T.w - 0.05, 0.16, 0.12), sharedMats.dark); rb.position.set(0, 0.38, -T.len / 2 - 0.02);
    const gr = add(new THREE.BoxGeometry(0.8, 0.14, 0.04), sharedMats.chrome, false); gr.position.set(0, 0.58, T.len / 2 + 0.04);
    // lights
    for (const s of [-1, 1]) {
      const hl = add(new THREE.BoxGeometry(0.36, 0.12, 0.05), sharedMats.head, false); hl.position.set(s * (T.w / 2 - 0.32), 0.66, T.len / 2 + 0.03);
    }
    this.tailMat = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1010, emissiveIntensity: 0.6 });
    for (const s of [-1, 1]) {
      const tl = add(new THREE.BoxGeometry(0.4, 0.12, 0.05), this.tailMat, false); tl.position.set(s * (T.w / 2 - 0.3), 0.72, -T.len / 2 - 0.03);
    }
    // mirrors
    for (const s of [-1, 1]) { const m = add(new THREE.BoxGeometry(0.18, 0.1, 0.08), this.paint); m.position.set(s * (T.w / 2 + 0.06), 0.98, 0.9 * sx); }
    if (T.police) {
      const bar = add(new THREE.BoxGeometry(1.1, 0.1, 0.25), sharedMats.dark); bar.position.set(0, P.roof[2] + 0.08, -0.4);
      this.sirenR = add(new THREE.BoxGeometry(0.45, 0.12, 0.22), sharedMats.red.clone(), false); this.sirenR.position.set(0.28, P.roof[2] + 0.14, -0.4);
      this.sirenB = add(new THREE.BoxGeometry(0.45, 0.12, 0.22), sharedMats.blue.clone(), false); this.sirenB.position.set(-0.28, P.roof[2] + 0.14, -0.4);
    }
    if (T.taxi) { const ts = add(new THREE.BoxGeometry(0.6, 0.2, 0.25), sharedMats.taxiSign); ts.position.set(0, P.roof[2] + 0.1, -0.35); }
    // wheels
    this.wheelR = P.wheelR;
    this.wheels = [];
    const wg = geoCache.get('wheel' + P.wheelR) || (() => {
      const tire = new THREE.CylinderGeometry(P.wheelR, P.wheelR, 0.27, 20); tire.rotateZ(Math.PI / 2);
      const rim = new THREE.CylinderGeometry(P.wheelR * 0.62, P.wheelR * 0.62, 0.29, 10); rim.rotateZ(Math.PI / 2);
      const o = { tire, rim }; geoCache.set('wheel' + P.wheelR, o); return o;
    })();
    const wb = P.wb * sx / 2;
    for (const [sxw, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const steer = new THREE.Group(); steer.position.set(sxw * (T.w / 2 - 0.14), P.wheelR, sz * wb);
      const spin = new THREE.Group(); steer.add(spin);
      add(wg.tire, sharedMats.tire, true, spin); add(wg.rim, sharedMats.rim, false, spin);
      this.group.add(steer);
      this.wheels.push({ steer, spin, front: sz > 0 });
    }
    this.wheelbase = P.wb * sx;
    this.seat = new THREE.Vector3(0.38, T.profile === 'van' || T.profile === 'pickup' ? 0.3 : 0.08, T.profile === 'van' ? 0.9 : -0.2);

    // state
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.heading = 0;
    this.steerAngle = 0; this.health = 100; this.dead = false; this.burnT = 0;
    this.driver = null; this.driverKind = 'none'; this.ai = null;
    this.lastVl = 0; this.lastVf = 0; this.roll = 0; this.pitch = 0;
    this.siren = false; this.brakeLight = 0; this.input = { throttle: 0, steer: 0, handbrake: false };
    this.skid = 0;
  }

  get forward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }
  get speed() { return this.vel.dot(this.forward); }

  place(x, z, heading) { this.pos.set(x, 0, z); this.heading = heading; this.vel.set(0, 0, 0); this.sync(0); }

  physics(dt, world, game) {
    const T = this.type, inp = this.input;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const rx = -fz, rz = fx;
    let vf = this.vel.x * fx + this.vel.z * fz;
    let vl = this.vel.x * rx + this.vel.z * rz;
    const thr = this.dead ? 0 : inp.throttle;
    let braking = false;
    if (thr > 0) {
      if (vf < -0.5) { vf = Math.min(0, vf + 26 * dt); braking = true; }
      else vf += T.accel * thr * (1 - clamp(vf / T.maxSpeed, 0, 1) ** 2) * dt;
    } else if (thr < 0) {
      if (vf > 0.5) { vf = Math.max(0, vf - 26 * dt); braking = true; }
      else vf -= T.accel * 0.6 * -thr * (1 - clamp(-vf / (T.maxSpeed * 0.3), 0, 1)) * dt;
    } else {
      vf -= Math.sign(vf) * Math.min(Math.abs(vf), 2.5 * dt);
    }
    vf -= vf * Math.abs(vf) * 0.0009 * dt * 10;
    if (inp.handbrake) { vf -= Math.sign(vf) * Math.min(Math.abs(vf), 9 * dt); braking = true; }
    this.brakeLight = braking ? 1 : 0;
    const maxSteer = T.steer / (1 + Math.abs(vf) * 0.045);
    this.steerAngle = damp(this.steerAngle, inp.steer * maxSteer, 8, dt);
    const yawRate = (vf * Math.tan(this.steerAngle)) / this.wheelbase;
    this.heading += yawRate * dt * (inp.handbrake ? 1.35 : 1);
    const grip = inp.handbrake ? T.grip * 0.12 : T.grip * (Math.abs(vl) > 6 ? 0.55 : 1);
    vl *= Math.exp(-grip * dt);
    this.skid = Math.abs(vl);
    const nfx = Math.sin(this.heading), nfz = Math.cos(this.heading);
    const nrx = -nfz, nrz = nfx;
    this.vel.set(nfx * vf + nrx * vl, 0, nfz * vf + nrz * vl);
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    // static collisions with 3 circles along the body
    const r = this.w / 2 + 0.05, off = this.len / 2 - r;
    let impact = 0;
    for (const o of [off, 0, -off]) {
      const p = { x: this.pos.x + nfx * o, z: this.pos.z + nfz * o };
      const ox = p.x, oz = p.z;
      const n = world.collideCircle(p, r);
      if (n) {
        this.pos.x += p.x - ox; this.pos.z += p.z - oz;
        const vn = this.vel.x * n.x + this.vel.z * n.z;
        if (vn < 0) { this.vel.x -= n.x * vn * 1.25; this.vel.z -= n.z * vn * 1.25; impact = Math.max(impact, -vn); }
      }
    }
    if (impact > 0) this.onImpact(impact, game);
    this.lateralAcc = (vl - this.lastVl) / Math.max(dt, 1e-3); this.lastVl = vl;
    this.longAcc = (vf - this.lastVf) / Math.max(dt, 1e-3); this.lastVf = vf;
  }

  onImpact(v, game) {
    if (v > 3) {
      this.damage((v - 3) * 2.2, game);
      if (game && v > 5) game.audio.crash(Math.min(1, v / 20), this.pos, game);
      if (game && v > 7) game.fx.sparks(this.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 10);
    }
  }

  damage(d, game) {
    if (this.dead) return;
    this.health -= d;
    if (this.health <= 0) { this.health = 0; this.explode(game); }
  }

  explode(game) {
    this.dead = true; this.burnT = 0;
    this.body.traverse((m) => { if (m.isMesh && m.material !== sharedMats.glass) m.material = sharedMats.burnt; });
    this.tailMat.emissiveIntensity = 0;
    this.vel.y = 0; this.vel.multiplyScalar(0.3);
    if (game) game.onCarExplode(this);
  }

  sync(dt) {
    const g = this.group;
    g.position.set(this.pos.x, this.pos.y, this.pos.z);
    g.rotation.y = this.heading;
    const vf = this.speed;
    this.roll = damp(this.roll, clamp(-(this.lateralAcc || 0) * 0.004 + this.lastVl * 0.006, -0.08, 0.08), 6, dt || 1);
    this.pitch = damp(this.pitch, clamp(-(this.longAcc || 0) * 0.003, -0.05, 0.05), 5, dt || 1);
    this.body.rotation.z = this.roll; this.body.rotation.x = this.pitch;
    for (const w of this.wheels) {
      w.spin.rotation.x += (vf * (dt || 0)) / this.wheelR;
      if (w.front) w.steer.rotation.y = this.steerAngle;
    }
    this.tailMat.emissiveIntensity = this.dead ? 0 : 0.6 + this.brakeLight * 3;
    if (this.sirenR) {
      const t = performance.now() / 1000; const on = this.siren;
      const a = on ? (Math.sin(t * 14) > 0 ? 5 : 0.2) : 0.2, b = on ? (Math.sin(t * 14) > 0 ? 0.2 : 5) : 0.2;
      this.sirenR.material.emissiveIntensity = a; this.sirenB.material.emissiveIntensity = b;
    }
  }

  // world position of the driver's door
  doorPos() {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const lx = fz, lz = -fx; // left = -right
    return new THREE.Vector3(this.pos.x + lx * (this.w / 2 + 0.7) + fx * 0.2, 0, this.pos.z + lz * (this.w / 2 + 0.7) + fz * 0.2);
  }
  circles() {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading), r = this.w / 2 + 0.05, off = this.len / 2 - r;
    return [[this.pos.x + fx * off, this.pos.z + fz * off, r], [this.pos.x, this.pos.z, r], [this.pos.x - fx * off, this.pos.z - fz * off, r]];
  }
}

// ---------------------------------------------------------------- AI drivers
const rightOf = (d) => [-d[1], d[0]];
const leftOf = (d) => [d[1], -d[0]];

export class TrafficAI {
  constructor(car, dir) {
    this.car = car; this.d = dir; this.cruise = 11 + Math.random() * 5;
    this.honkT = 0; this.blockedT = 0;
    this.plan();
  }
  plan() {
    const c = this.car, d = this.d;
    let k, l;
    if (d[0] !== 0) {
      k = d[0] > 0 ? Math.floor((c.pos.x - ORIGIN) / CELL + 0.001) + 1 : Math.ceil((c.pos.x - ORIGIN) / CELL - 0.001) - 1;
      l = Math.round((c.pos.z - ORIGIN) / CELL);
    } else {
      l = d[1] > 0 ? Math.floor((c.pos.z - ORIGIN) / CELL + 0.001) + 1 : Math.ceil((c.pos.z - ORIGIN) / CELL - 0.001) - 1;
      k = Math.round((c.pos.x - ORIGIN) / CELL);
    }
    if (this.lastNode && this.lastNode[0] === k && this.lastNode[1] === l) { k += d[0]; l += d[1]; }
    k = clamp(k, 0, N); l = clamp(l, 0, N);
    this.lastNode = [k, l];
    const opts = [];
    for (const d2 of [d, d, leftOf(d), rightOf(d)]) {
      const nk = k + d2[0], nl = l + d2[1];
      if (nk >= 0 && nk <= N && nl >= 0 && nl <= N) opts.push(d2);
    }
    if (!opts.length) opts.push([-d[0], -d[1]]);
    const d2 = opts[Math.floor(Math.random() * opts.length)];
    const nx = nodeCoord(k), nz = nodeCoord(l);
    const r1 = rightOf(d), r2 = rightOf(d2);
    let wx, wz;
    if (d2[0] === d[0] && d2[1] === d[1]) { wx = nx + r1[0] * LANE + d[0] * LANE; wz = nz + r1[1] * LANE + d[1] * LANE; }
    else if (d2[0] === -d[0] && d2[1] === -d[1]) { wx = nx + d[0] * LANE; wz = nz + d[1] * LANE; }
    else { wx = nx + r1[0] * LANE + r2[0] * LANE; wz = nz + r1[1] * LANE + r2[1] * LANE; }
    this.w = [wx, wz]; this.d2 = d2; this.turning = !(d2[0] === d[0] && d2[1] === d[1]);
  }
  update(dt, game, depth = 0) {
    const c = this.car, d = this.d;
    const dx = this.w[0] - c.pos.x, dz = this.w[1] - c.pos.z;
    const along = dx * d[0] + dz * d[1];
    if (along < 0.5 && depth < 3) { this.d = this.d2; this.plan(); return this.update(dt, game, depth + 1); }
    let tx, tz;
    if (along > 9) {
      // follow the current lane line (W shares the lane's perpendicular coordinate)
      if (d[0] !== 0) { tx = c.pos.x + d[0] * 9; tz = this.w[1]; }
      else { tz = c.pos.z + d[1] * 9; tx = this.w[0]; }
    } else { tx = this.w[0] + this.d2[0] * 6; tz = this.w[1] + this.d2[1] * 6; }
    const ang = angleDiff(c.heading, Math.atan2(tx - c.pos.x, tz - c.pos.z));
    c.input.steer = clamp(ang * 2.2, -1, 1);
    let target = this.cruise;
    if (this.turning && along < 22) target = Math.min(target, 6.5);
    const obs = game.obstacleAhead(c, 16);
    if (obs < 16) target = Math.min(target, Math.max(0, (obs - 5) * 1.2));
    const sp = c.speed;
    c.input.throttle = sp < target - 0.5 ? clamp((target - sp) / 3, 0.2, 1) : sp > target + 1 ? -1 : 0;
    c.input.handbrake = false;
    if (target < 0.5 && sp < 0.5) c.input.throttle = 0;
    this.blockedT = sp < 0.5 && obs < 10 ? this.blockedT + dt : 0;
    if (this.blockedT > 2.5 && this.honkT <= 0) { game.audio.horn(c.pos, game); this.honkT = 3 + Math.random() * 3; }
    this.honkT -= dt;
  }
}

export class ChaseAI {
  constructor(car, getTarget) { this.car = car; this.getTarget = getTarget; this.stuckT = 0; this.reverseT = 0; }
  update(dt, game) {
    const c = this.car, t = this.getTarget();
    if (!t) { c.input.throttle = -0.3; c.input.steer = 0; return; }
    const tx = t.x + (t.vx || 0) * 0.6, tz = t.z + (t.vz || 0) * 0.6;
    const dist = Math.hypot(tx - c.pos.x, tz - c.pos.z);
    const ang = angleDiff(c.heading, Math.atan2(tx - c.pos.x, tz - c.pos.z));
    const sp = c.speed;
    if (this.reverseT > 0) {
      this.reverseT -= dt; c.input.throttle = -1; c.input.steer = -Math.sign(ang); c.input.handbrake = false; return;
    }
    c.input.steer = clamp(ang * 2.5, -1, 1);
    c.input.handbrake = Math.abs(ang) > 1.2 && sp > 12;
    const stopDist = t.onFoot ? 9 : 0;
    if (dist < stopDist) { c.input.throttle = sp > 0.5 ? -1 : 0; }
    else c.input.throttle = Math.abs(ang) > 1.5 && dist < 25 ? 0.4 : 1;
    if (Math.abs(sp) < 1 && dist > stopDist + 4) this.stuckT += dt; else this.stuckT = 0;
    if (this.stuckT > 1.6) { this.stuckT = 0; this.reverseT = 1.2; }
  }
}

export { sharedMats, lerp };
