import * as THREE from 'three';
import { clamp, lerp, smoothstep } from './util.js';
import { heightAt, surfaceAt, puddleAt } from './world.js';

// massa kg, medidas m, torque N·m, CdA m²
export const VTYPES = {
  bike: { name: 'BMX', shape: 'bike', mass: 95, wheelbase: 1.05, width: 0.62, length: 1.7, height: 1.1, cgh: 0.95, wheelR: 0.33, pedal: true, power: 950, maxF: 380, grip: 1.05, CdA: 0.6, brakeF: 1200, steer: 0.55, steerFall: 0.05, drive: 'rear', twoWheel: true, seat: [0, 0.52, -0.2] },
  moto: { name: 'Sanhaço 250', shape: 'moto', mass: 240, wheelbase: 1.42, width: 0.75, length: 2.1, height: 1.2, cgh: 0.7, wheelR: 0.31, torque: 95, idle: 1200, redline: 10500, gears: [2.8, 2.0, 1.6, 1.3, 1.1, 0.95], final: 3.9, grip: 1.1, CdA: 0.55, brakeF: 4100, steer: 0.5, steerFall: 0.045, drive: 'rear', twoWheel: true, seat: [0, 0.55, -0.35] },
  sedan: { name: 'Prima', shape: 'sedan', mass: 1300, wheelbase: 2.7, width: 1.8, length: 4.5, height: 1.45, cgh: 0.55, wheelR: 0.32, torque: 220, idle: 850, redline: 6300, gears: [3.4, 2.1, 1.45, 1.05, 0.82], final: 3.9, grip: 1.0, CdA: 0.68, brakeF: 14900, steer: 0.6, steerFall: 0.03, drive: 'rear', seat: [0.38, 0.2, -0.25] },
  taxi: { name: 'Táxi Prima', shape: 'taxi', mass: 1330, wheelbase: 2.7, width: 1.8, length: 4.5, height: 1.45, cgh: 0.55, wheelR: 0.32, torque: 220, idle: 850, redline: 6300, gears: [3.4, 2.1, 1.45, 1.05, 0.82], final: 3.9, grip: 1.0, CdA: 0.7, brakeF: 14900, steer: 0.6, steerFall: 0.03, drive: 'rear', seat: [0.38, 0.2, -0.25] },
  police: { name: 'Viatura', shape: 'police', mass: 1450, wheelbase: 2.8, width: 1.85, length: 4.7, height: 1.5, cgh: 0.55, wheelR: 0.33, torque: 360, idle: 800, redline: 6200, gears: [3.3, 2.1, 1.5, 1.12, 0.86], final: 3.7, grip: 1.12, CdA: 0.7, brakeF: 20200, steer: 0.6, steerFall: 0.028, drive: 'rear', seat: [0.4, 0.2, -0.25] },
  sport: { name: 'Faísca GT', shape: 'sport', mass: 1250, wheelbase: 2.55, width: 1.95, length: 4.4, height: 1.15, cgh: 0.45, wheelR: 0.33, torque: 520, idle: 950, redline: 7900, gears: [3.1, 2.2, 1.65, 1.28, 1.02, 0.84], final: 3.5, grip: 1.25, CdA: 0.6, ClA: 0.45, brakeF: 21600, steer: 0.55, steerFall: 0.03, drive: 'awd', seat: [0.4, -0.1, -0.35] },
  pickup: { name: 'Touro', shape: 'pickup', mass: 1900, wheelbase: 3.1, width: 2.0, length: 5.2, height: 1.85, cgh: 0.78, wheelR: 0.39, torque: 430, idle: 700, redline: 5200, gears: [3.6, 2.2, 1.45, 1.0, 0.76], final: 3.7, grip: 0.95, CdA: 1.1, brakeF: 20200, steer: 0.55, steerFall: 0.03, drive: 'rear', seat: [0.42, 0.45, 0.4] },
};
for (const t of Object.values(VTYPES)) {
  t.a = t.wheelbase * 0.48; t.b = t.wheelbase * 0.52;
  t.I = (t.mass * (t.length ** 2 + t.width ** 2)) / 12;
}

const SURF = {
  road: { mu: 1.0, rr: 0.013 }, walk: { mu: 0.95, rr: 0.015 }, grass: { mu: 0.68, rr: 0.05 },
  dirt: { mu: 0.62, rr: 0.045 }, sand: { mu: 0.5, rr: 0.09 }, water: { mu: 0.3, rr: 0.2 },
};

export const CAR_COLORS = [0xb3201c, 0x1d3f8a, 0xe8e8e8, 0x151515, 0x2f6b3a, 0xc9a227, 0x6d6f73, 0x7a1f4d, 0x2a8fbd, 0xd9661f, 0x9c9c9c, 0x40251a];

const M = {
  glass: new THREE.MeshPhysicalMaterial({ color: 0x0e1620, metalness: 0.1, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 }),
  black: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.7 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.18 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.95 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xb8b8b8, metalness: 0.9, roughness: 0.3 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.5, roughness: 0.4 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x2a1d17, roughness: 0.8 }),
  cabin: new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.6 }),
};

// caixas subdivididas para a lataria poder amassar localmente
const seg = (v) => Math.max(1, Math.min(10, Math.ceil(v / 0.3)));
function addBox(parent, w, h, d, x, y, z, mat, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, seg(w), seg(h), seg(d)), mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function buildMesh(t, color) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.33, clearcoat: 1, clearcoatRoughness: 0.06 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff2c8, emissiveIntensity: 0.1 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x5a0000, emissive: 0xff1a0a, emissiveIntensity: 0.1 });
  const L = t.length, W = t.width, r = t.wheelR, a = t.a, b = t.b;
  const wheels = [];
  const mkWheel = (x, z, front, w = 0.24) => {
    const piv = new THREE.Group();
    piv.position.set(x, r, z);
    const spin = new THREE.Group();
    piv.add(spin);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 18).rotateZ(Math.PI / 2), M.tire);
    tire.castShadow = true;
    spin.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.6, w + 0.02, 10).rotateZ(Math.PI / 2), t.twoWheel ? M.frame : M.rim);
    spin.add(rim);
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, r * 1.1, 0.05), M.rim);
    spin.add(spoke);
    root.add(piv);
    wheels.push({ piv, spin, front });
  };

  if (t.twoWheel) {
    mkWheel(0, a, true, t.shape === 'bike' ? 0.05 : 0.14);
    mkWheel(0, -b, false, t.shape === 'bike' ? 0.06 : 0.17);
    const fm = t.shape === 'bike' ? new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.35 }) : paint;
    if (t.shape === 'bike') {
      addBox(body, 0.05, 0.05, 0.85, 0, r + 0.32, 0.05, fm);
      const d1 = addBox(body, 0.05, 0.05, 0.7, 0, r + 0.12, -0.1, fm); d1.rotation.x = 0.5;
      addBox(body, 0.05, 0.6, 0.05, 0, r + 0.2, a - 0.05, fm).rotation.x = -0.25;
      addBox(body, 0.05, 0.45, 0.05, 0, r + 0.2, -0.15, fm);
      addBox(body, 0.6, 0.04, 0.04, 0, r + 0.55, a - 0.12, M.frame);
      addBox(body, 0.14, 0.05, 0.24, 0, r + 0.47, -0.2, M.seat);
    } else {
      addBox(body, 0.36, 0.38, 0.95, 0, r + 0.25, 0.05, paint);
      addBox(body, 0.3, 0.14, 0.62, 0, r + 0.5, -0.38, M.seat);
      addBox(body, 0.22, 0.22, 0.6, 0, r + 0.05, -0.1, M.frame);
      addBox(body, 0.06, 0.6, 0.06, 0, r + 0.35, a - 0.12, M.chrome).rotation.x = -0.35;
      addBox(body, 0.7, 0.05, 0.05, 0, r + 0.72, a - 0.25, M.frame);
      addBox(body, 0.18, 0.16, 0.1, 0, r + 0.6, a - 0.06, headMat, false);
      addBox(body, 0.16, 0.08, 0.06, 0, r + 0.42, -b - 0.12, tailMat, false);
      addBox(body, 0.08, 0.08, 0.5, 0.14, r - 0.05, -0.55, M.chrome);
    }
    return { root, body, wheels, headMat, tailMat, paint };
  }

  const ww = W / 2 - 0.13;
  mkWheel(ww, a, true); mkWheel(-ww, a, true); mkWheel(ww, -b, false); mkWheel(-ww, -b, false);
  const sh = t.shape;
  let siren = null, cab, top, bodyY, bodyH, hood = null, trunk = null, doorMat = paint;
  if (sh === 'sedan' || sh === 'taxi' || sh === 'police') {
    addBox(body, W, 0.55, L, 0, r + 0.32, 0, paint);
    cab = [W * 0.92, 0.5, L * 0.47, r + 0.84, -L * 0.06];
    top = r + 0.595; bodyY = r + 0.32; bodyH = 0.55;
    addBox(body, ...cab.slice(0, 3), 0, cab[3], cab[4], M.cabin);
    addBox(body, W * 0.9, 0.06, L * 0.42, 0, r + 1.11, -L * 0.07, paint);
    addBox(body, W * 0.93, 0.36, 0.08, 0, r + 0.77, -L * 0.06, paint).scale.set(1, 1, 1);
    if (sh === 'police') {
      const white = new THREE.MeshPhysicalMaterial({ color: 0xf2f2f2, metalness: 0.4, roughness: 0.35, clearcoat: 1 });
      addBox(body, W + 0.01, 0.4, L * 0.42, 0, r + 0.36, -L * 0.03, white);
      doorMat = white;
      const red = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1010, emissiveIntensity: 0 });
      const blue = new THREE.MeshStandardMaterial({ color: 0x000055, emissive: 0x1040ff, emissiveIntensity: 0 });
      addBox(body, 0.5, 0.14, 0.25, 0.3, r + 1.2, -L * 0.07, red, false);
      addBox(body, 0.5, 0.14, 0.25, -0.3, r + 1.2, -L * 0.07, blue, false);
      siren = { red, blue };
    }
    if (sh === 'taxi') {
      const sign = addBox(body, 0.75, 0.22, 0.3, 0, r + 1.25, -L * 0.07, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe066, emissiveIntensity: 0.6 }));
      sign.castShadow = false;
      addBox(body, W + 0.01, 0.12, L * 0.9, 0, r + 0.36, 0, new THREE.MeshStandardMaterial({ color: 0x111111 }));
    }
  } else if (sh === 'sport') {
    addBox(body, W, 0.42, L, 0, r + 0.2, 0, paint);
    hood = addBox(body, W * 0.96, 0.18, L * 0.32, 0, r + 0.48, L * 0.3, paint);
    cab = [W * 0.8, 0.36, L * 0.36, r + 0.58, -L * 0.08];
    top = r + 0.41; bodyY = r + 0.2; bodyH = 0.42;
    addBox(body, ...cab.slice(0, 3), 0, cab[3], cab[4], M.cabin);
    addBox(body, W * 0.78, 0.05, L * 0.28, 0, r + 0.78, -L * 0.1, paint);
    trunk = addBox(body, W * 0.95, 0.06, 0.35, 0, r + 0.72, -L * 0.47, M.black);
    addBox(body, 0.06, 0.28, 0.1, W * 0.35, r + 0.55, -L * 0.46, M.black);
    addBox(body, 0.06, 0.28, 0.1, -W * 0.35, r + 0.55, -L * 0.46, M.black);
    addBox(body, 0.3, 0.02, L * 0.98, 0, r + 0.42, 0, new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }));
  } else if (sh === 'pickup') {
    addBox(body, W, 0.7, L, 0, r + 0.42, 0, paint);
    cab = [W * 0.92, 0.6, L * 0.3, r + 1.07, L * 0.1];
    top = r + 0.77; bodyY = r + 0.42; bodyH = 0.7;
    addBox(body, ...cab.slice(0, 3), 0, cab[3], cab[4], M.cabin);
    addBox(body, W * 0.9, 0.06, L * 0.27, 0, r + 1.39, L * 0.1, paint);
    trunk = addBox(body, W, 0.35, 0.08, 0, r + 0.95, -L * 0.48, paint);
    addBox(body, 0.08, 0.35, L * 0.4, W / 2 - 0.04, r + 0.95, -L * 0.28, paint);
    addBox(body, 0.08, 0.35, L * 0.4, -W / 2 + 0.04, r + 0.95, -L * 0.28, paint);
    addBox(body, W * 1.02, 0.16, 0.2, 0, r + 0.18, L / 2, M.chrome);
  }
  const ly = sh === 'sport' ? r + 0.3 : r + 0.42;
  const P = {};
  for (const s of [1, -1]) {
    const k = s > 0 ? 'L' : 'R';
    P['head' + k] = addBox(body, 0.4, 0.14, 0.06, s * (W / 2 - 0.3), ly, L / 2, headMat, false);
    P['tail' + k] = addBox(body, 0.36, 0.14, 0.06, s * (W / 2 - 0.28), ly + 0.05, -L / 2, tailMat, false);
  }
  P.bumperF = addBox(body, W * 0.98, 0.14, 0.12, 0, r + 0.1, L / 2 - 0.02, M.black);
  P.bumperR = addBox(body, W * 0.98, 0.14, 0.12, 0, r + 0.1, -L / 2 + 0.02, M.black);
  // vidros, capô, porta-malas e portas como peças separadas
  const [cw, ch, cd, cy, cz] = cab;
  P.paneF = addBox(body, cw * 0.94, ch * 0.85, 0.03, 0, cy, cz + cd / 2 + 0.012, M.glass, false);
  P.paneB = addBox(body, cw * 0.94, ch * 0.85, 0.03, 0, cy, cz - cd / 2 - 0.012, M.glass, false);
  P.paneL = addBox(body, 0.03, ch * 0.8, cd * 0.9, cw / 2 + 0.012, cy, cz, M.glass, false);
  P.paneR = addBox(body, 0.03, ch * 0.8, cd * 0.9, -cw / 2 - 0.012, cy, cz, M.glass, false);
  const fz0 = cz + cd / 2, bz0 = cz - cd / 2;
  P.hood = hood || addBox(body, W * 0.94, 0.04, L / 2 - fz0 - 0.08, 0, top + 0.02, (fz0 + L / 2 - 0.08) / 2, paint);
  P.trunk = trunk || addBox(body, W * 0.94, 0.04, bz0 + L / 2 - 0.08, 0, top + 0.02, (bz0 - L / 2 + 0.08) / 2, paint);
  P.doorL = addBox(body, 0.04, bodyH * 0.8, cd, W / 2 + 0.02, bodyY + 0.03, cz, doorMat);
  P.doorR = addBox(body, 0.04, bodyH * 0.8, cd, -W / 2 - 0.02, bodyY + 0.03, cz, doorMat);
  const deform = body.children.filter((m) => m.isMesh && m.material !== headMat && m.material !== tailMat && !(siren && (m.material === siren.red || m.material === siren.blue)));
  return { root, body, wheels, headMat, tailMat, paint, siren, parts: P, deform };
}

let uid = 1;
export class Vehicle {
  constructor(type, color, x, z, heading = 0) {
    this.id = uid++;
    this.type = type;
    this.t = VTYPES[type];
    this.color = color;
    const m = buildMesh(this.t, color);
    Object.assign(this, m);
    this.pos = new THREE.Vector3(x, heightAt(x, z), z);
    this.vel = new THREE.Vector3();
    this.heading = heading;
    this.yawRate = 0;
    this.steer = 0;
    this.gear = 1;
    this.rpm = this.t.idle || 0;
    this.shiftT = 0;
    this.ax = 0; this.ay = 0;
    this.vy = 0; this.onGround = true; this.lastGy = this.pos.y;
    this.pitch = 0; this.roll = 0; this.lean = 0;
    // suspensão (massa suspensa): arfagem, rolagem e altura com mola + amortecedor
    this.sP = 0; this.sPv = 0; this.sR = 0; this.sRv = 0; this.sH = 0; this.sHv = 0;
    this.gradeF = 0; this.gradeL = 0; this.aqua = 0; this.pudL = 0; this.pudR = 0;
    this.health = 1000;
    this.driver = null;
    this.ai = null;
    this.rider = null;
    this.brakeOn = false;
    this.slip = 0;
    this.sleeping = true;
    this.inWater = false;
    this.lights = false;
    this.impact = 0;
    this.radius = this.t.width / 2;
    this.zones = { front: 0, rear: 0, left: 0, right: 0 };
    this.syncMesh();
  }

  get speed() { return Math.hypot(this.vel.x, this.vel.z); }
  get fwdSpeed() { return this.vel.x * Math.sin(this.heading) + this.vel.z * Math.cos(this.heading); }

  setRider(char) {
    if (this.rider) this.body.remove(this.rider.root);
    this.rider = char;
    if (char) {
      const s = this.t.seat;
      char.root.position.set(s[0], this.t.wheelR + s[1] - 0.95, s[2]);
      char.root.rotation.set(0, 0, 0);
      this.body.add(char.root);
    }
  }

  engineTorque(rpm) {
    const x = rpm / this.t.redline;
    return this.t.torque * clamp(1 - 1.4 * (x - 0.62) ** 2, 0.35, 1);
  }

  update(dt, ctrl, env, manual = false) {
    const t = this.t;
    if (ctrl && (ctrl.throttle > 0.02 || ctrl.brake > 0.02 || Math.abs(ctrl.steer) > 0.02)) this.sleeping = false;
    if (this.sleeping && !this.driver) { this.syncMesh(); return; }
    ctrl = ctrl || { throttle: 0, brake: 0, steer: 0, handbrake: this.driver ? false : true };
    const speed = this.speed;
    const maxSteer = t.steer / (1 + speed * t.steerFall);
    const target = clamp(ctrl.steer, -1, 1) * maxSteer;
    const rate = ctrl.analog ? 6 : 2.6;
    const back = Math.sign(target) !== Math.sign(this.steer) || Math.abs(target) < Math.abs(this.steer) ? 1.6 : 1;
    this.steer += clamp(target - this.steer, -rate * back * dt, rate * back * dt);

    // marcha à ré / freio
    const vx = this.fwdSpeed;
    let thr = ctrl.throttle, brk = ctrl.brake;
    if (this.gear === -1) {
      if (ctrl.throttle > 0.1 && vx > -1.2) this.gear = 1;
      else { thr = ctrl.brake; brk = ctrl.throttle; }
    } else if (ctrl.brake > 0.1 && vx < 0.8 && ctrl.throttle < 0.1) this.gear = -1;
    if (this.gear === -1 && ctrl.throttle > 0.1) { thr = 0; brk = ctrl.throttle; }
    this.thr = thr; this.brk = brk;
    this.brakeOn = brk > 0.05;

    if (!t.pedal && this.gear > 0) {
      const ratio = t.gears[this.gear - 1] * t.final;
      const wrpm = (Math.abs(vx) / t.wheelR) * ratio * 9.549;
      if (manual) {
        if (ctrl.shiftUp && this.gear < t.gears.length) { this.gear++; this.shiftT = 0.18; }
        if (ctrl.shiftDown && this.gear > 1) { this.gear--; this.shiftT = 0.18; }
      } else if (this.shiftT <= 0) {
        if (wrpm > t.redline * 0.93 && this.gear < t.gears.length) { this.gear++; this.shiftT = 0.22; }
        else if (this.gear > 1 && wrpm < t.redline * 0.42) {
          const lower = (Math.abs(vx) / t.wheelR) * t.gears[this.gear - 2] * t.final * 9.549;
          if (lower < t.redline * 0.85) { this.gear--; this.shiftT = 0.18; }
        }
      }
    }
    this.shiftT -= dt;

    // inclinação do chão (gravidade na ladeira) e poças embaixo das rodas
    {
      const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
      const hf = heightAt(this.pos.x + sh * t.a, this.pos.z + ch * t.a), hb = heightAt(this.pos.x - sh * t.b, this.pos.z - ch * t.b);
      this.gradeF = (hf - hb) / t.wheelbase;
      if (!t.twoWheel) {
        const hw = t.width / 2;
        this.gradeL = (heightAt(this.pos.x + ch * hw, this.pos.z - sh * hw) - heightAt(this.pos.x - ch * hw, this.pos.z + sh * hw)) / t.width;
      } else this.gradeL = 0;
      const wet = env.wetness;
      if (wet > 0.25 && this.speed > 3) {
        const hw = t.width / 2 - 0.13, fx = this.pos.x + sh * t.a, fz = this.pos.z + ch * t.a;
        this.pudL = puddleAt(fx + ch * hw, fz - sh * hw, wet);
        this.pudR = t.twoWheel ? this.pudL : puddleAt(fx - ch * hw, fz + sh * hw, wet);
      } else this.pudL = this.pudR = 0;
      // aquaplanagem: lâmina d'água + velocidade alta → o pneu flutua e perde aderência
      const film = Math.max(this.pudL, this.pudR) * 0.85 + (wet > 0.6 ? (wet - 0.6) * 0.25 : 0);
      this.aqua = film * smoothstep(15, 27, this.speed);
    }

    const n = 4, h = dt / n;
    for (let i = 0; i < n; i++) this.step(h, ctrl, thr, brk, env);

    // rpm para som/HUD
    if (t.pedal) this.rpm = Math.abs(vx) / t.wheelR;
    else {
      const ratio = (this.gear > 0 ? t.gears[this.gear - 1] : 3.2) * t.final;
      const wr = (Math.abs(vx) / t.wheelR) * ratio * 9.549;
      const free = t.idle + thr * (t.redline - t.idle) * 0.9;
      const target = this.onGround && Math.abs(vx) > 0.5 ? Math.max(t.idle, wr + this.slip * 1500) : free;
      this.rpm = lerp(this.rpm, clamp(target, t.idle, t.redline * 1.02), 1 - Math.exp(-dt * 10));
    }
    if (!this.driver && this.speed < 0.05 && this.onGround && Math.abs(this.yawRate) < 0.01) this.sleeping = true;
    this.syncMesh(dt);
  }

  step(dt, ctrl, thr, brk, env) {
    const t = this.t, m = t.mass, g = 9.81;
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    const fx = sh, fz = ch, lx = ch, lz = -sh;
    const vx = this.vel.x * fx + this.vel.z * fz;
    const vy = this.vel.x * lx + this.vel.z * lz;
    const a = t.a, b = t.b, L = a + b;
    const surf = this.inWater ? 'water' : surfaceAt(this.pos.x, this.pos.z);
    const S = SURF[surf];
    const wetF = surf === 'road' || surf === 'walk' ? 1 - 0.3 * env.wetness : 1 - 0.15 * env.wetness;
    const mu0 = t.grip * S.mu * wetF * (1 - 0.8 * this.aqua);
    // asa/difusor: carga aerodinâmica cresce com v²
    const down = t.ClA ? 0.5 * 1.2 * t.ClA * vx * vx : 0;
    let NF = (m * g * b) / L - (m * this.ax * t.cgh) / L + down * 0.45;
    let NR = (m * g * a) / L + (m * this.ax * t.cgh) / L + down * 0.55;
    // sensibilidade à carga: a transferência lateral tira aderência do eixo (mais na frente → sai de frente no limite)
    const q = t.twoWheel ? 0 : Math.min(1, Math.abs(this.ay) * t.cgh / (g * t.width * 0.5));
    const mu = mu0, muFy = mu0 * (1 - 0.16 * q * q), muRy = mu0 * (1 - 0.09 * q * q);
    NF = Math.max(NF, m * g * 0.08); NR = Math.max(NR, m * g * 0.08);

    let Fdrive = 0;
    if (this.inWater) thr = 0;
    if (t.pedal) {
      Fdrive = thr * Math.min(t.power / Math.max(Math.abs(vx), 1.5), t.maxF);
      if (this.gear === -1) Fdrive = -thr * 120;
    } else if (this.shiftT <= 0 || this.gear < 0) {
      const ratio = (this.gear > 0 ? t.gears[this.gear - 1] : 3.2) * t.final;
      const rpm = Math.max(t.idle, (Math.abs(vx) / t.wheelR) * ratio * 9.549);
      let T = rpm > t.redline ? 0 : this.engineTorque(rpm) * thr;
      if (thr < 0.05 && this.gear > 0) T = -t.torque * 0.12 * (rpm / t.redline) * Math.sign(vx);
      Fdrive = ((T * ratio * 0.86) / t.wheelR) * (this.gear < 0 ? -1 : 1);
    }
    const fs = t.drive === 'awd' ? 0.4 : t.drive === 'front' ? 1 : 0;
    let FxF = Fdrive * fs, FxR = Fdrive * (1 - fs);
    const bdir = -clamp(vx * 3, -1, 1);
    const Fb = brk * t.brakeF;
    const bF = Fb * 0.62, bR = Fb * 0.38 + (ctrl.handbrake ? t.brakeF * 0.9 : 0);
    // sem ABS: a roda trava quando o freio pede mais do que o pneu aguenta
    const moving = Math.abs(vx) > 1.2 && this.onGround;
    const lockF = moving && bF > mu * NF * (this.lockF ? 0.7 : 0.92);
    const lockR = moving && bR > mu * NR * (this.lockR ? 0.7 : 0.92);
    if (!lockF) FxF += bF * bdir;
    if (!lockR) FxR += bR * bdir;

    const absvx = Math.max(Math.abs(vx), 0.6);
    const sg = vx >= 0 ? 1 : -1;
    const d = this.steer;
    const cd = Math.cos(d), sd = Math.sin(d);
    const alphaF = Math.atan2(vy + this.yawRate * a, absvx) - d * sg;
    const alphaR = Math.atan2(vy - this.yawRate * b, absvx);
    const tire = (al) => Math.sin(1.55 * Math.atan(8.5 * al));
    let FyF = -muFy * NF * tire(alphaF);
    let FyR = -muRy * NR * tire(alphaR);
    // pneu travado desliza: atrito cinético contra a velocidade do ponto de contato (não esterça)
    const muK = mu * 0.78;
    if (lockF) {
      const cx = vx, cy = vy + this.yawRate * a, cv = Math.hypot(cx, cy) || 1;
      const bx = (-muK * NF * cx) / cv, by = (-muK * NF * cy) / cv;
      FxF = bx * cd + by * sd; FyF = -bx * sd + by * cd;
    }
    if (lockR) {
      const cx = vx, cy = vy - this.yawRate * b, cv = Math.hypot(cx, cy) || 1;
      FxR = (-muK * NR * cx) / cv; FyR = (-muK * NR * cy) / cv;
    }

    let s = Math.hypot(FxR, FyR), lim = mu * NR;
    let slipR = 0;
    if (!lockR && s > lim) { slipR = 1 - lim / s; FxR *= lim / s; FyR *= lim / s; }
    s = Math.hypot(FxF, FyF); lim = mu * NF;
    if (!lockF && s > lim) { FxF *= lim / s; FyF *= lim / s; }
    const spdNow = Math.hypot(vx, vy);
    this.lockF = lockF; this.lockR = lockR; this.slipR = slipR; this.alphaF = alphaF; this.alphaR = alphaR;
    this.slip = lerp(this.slip, Math.max(slipR, lockF || lockR ? 1 : 0, Math.min(1, Math.abs(alphaR) * 2.2 - 0.25)) * clamp(spdNow / 4, 0, 1), 0.1);
    this.surface = surf;

    const rvx = this.vel.x - env.wind.x, rvz = this.vel.z - env.wind.y;
    const rv = Math.hypot(rvx, rvz);
    const k = 0.5 * 1.2 * t.CdA * rv;
    const dF = -k * (rvx * fx + rvz * fz), dL = -k * (rvx * lx + rvz * lz);
    const Froll = -S.rr * m * g * clamp(vx * 2, -1, 1);
    // água da poça segura a roda: lado com mais água puxa o carro
    const pk = m * 0.03, dPL = -this.pudL * pk * vx, dPR = -this.pudR * pk * vx;
    // gravidade na ladeira (ao longo e de lado)
    const gF = -m * g * this.gradeF / Math.sqrt(1 + this.gradeF * this.gradeF);
    const gL = -m * g * this.gradeL / Math.sqrt(1 + this.gradeL * this.gradeL);
    let Fx = FxR + FxF * cd - FyF * sd + dF + Froll + dPL + dPR + gF;
    let Fy = FyR + FyF * cd + FxF * sd + dL * (t.twoWheel ? 0.4 : 1) + gL;
    let Tz = a * (FyF * cd + FxF * sd) - b * FyR + (dPL - dPR) * (t.width / 2);
    if (!this.onGround) { Fx = dF; Fy = dL; Tz = 0; }
    this.FxNet = Fx; this.FyNet = Fy;
    if (this.inWater) { Fx -= vx * m * 1.2; Fy -= vy * m * 1.2; Tz -= this.yawRate * t.I * 1.5; }

    this.vel.x += ((fx * Fx + lx * Fy) / m) * dt;
    this.vel.z += ((fz * Fx + lz * Fy) / m) * dt;
    this.yawRate += (Tz / t.I) * dt;
    if (this.onGround) {
      // mistura com o modelo cinemático só quando o carro está quase parado (velocidade total, não só a frontal)
      const spd = Math.hypot(this.vel.x, this.vel.z);
      const kk = clamp((spd - 0.4) / 3, 0, 1);
      const kin = (vx * Math.tan(d)) / L;
      this.yawRate = lerp(kin, this.yawRate, kk);
      const vy2 = this.vel.x * lx + this.vel.z * lz;
      const kill = vy2 * (1 - kk) * Math.min(1, dt * 10);
      this.vel.x -= lx * kill; this.vel.z -= lz * kill;
      if (spd < 0.25 && thr < 0.02 && (brk > 0.05 || ctrl.handbrake || !this.driver)) {
        this.vel.x *= 0.8; this.vel.z *= 0.8; this.yawRate *= 0.8;
      }
    } else this.yawRate *= 0.999;
    this.ax = lerp(this.ax, clamp(Fx / m, -12, 12), 0.08);
    this.ay = lerp(this.ay, clamp(Fy / m, -12, 12), 0.08);
    this.heading += this.yawRate * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    // vertical: segue o chão, decola em lombadas
    const gy = heightAt(this.pos.x, this.pos.z);
    this.vy -= g * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= gy) {
      const rate = (gy - this.lastGy) / dt;
      if (!this.onGround && this.vy < -5) this.impact = Math.max(this.impact, -this.vy * 0.25);
      if (!this.onGround && this.vy < -1.5) this.sHv += this.vy * 0.6;
      this.pos.y = gy;
      this.vy = Math.max(this.vy, Math.min(rate, 25));
      this.onGround = true;
    } else this.onGround = this.pos.y - gy < 0.06;
    this.lastGy = gy;
    if (gy < -1.1) {
      this.inWater = true;
      if (this.pos.y < -1.0) { this.pos.y = Math.max(this.pos.y, -1.6); this.vy = Math.max(this.vy, -0.5); this.onGround = true; }
    } else this.inWater = false;
  }

  syncMesh(dt = 0) {
    const t = this.t;
    this.root.position.copy(this.pos);
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    if (this.onGround && dt > 0) {
      const hf = heightAt(this.pos.x + sh * t.a, this.pos.z + ch * t.a);
      const hb = heightAt(this.pos.x - sh * t.b, this.pos.z - ch * t.b);
      const tp = Math.atan2(hb - hf, t.wheelbase);
      let tr = 0;
      if (!t.twoWheel) {
        const hl = heightAt(this.pos.x + ch * t.width * 0.5, this.pos.z - sh * t.width * 0.5);
        const hr = heightAt(this.pos.x - ch * t.width * 0.5, this.pos.z + sh * t.width * 0.5);
        tr = Math.atan2(hl - hr, t.width);
      }
      this.pitch = lerp(this.pitch, tp, 1 - Math.exp(-dt * 12));
      this.roll = lerp(this.roll, tr, 1 - Math.exp(-dt * 12));
    } else if (dt > 0) this.pitch = lerp(this.pitch, 0.15, dt * 0.4);
    if (t.twoWheel) {
      const vx = this.fwdSpeed;
      const want = clamp(-Math.atan((vx * this.yawRate) / 9.81), -0.75, 0.75);
      this.lean = lerp(this.lean, this.speed < 0.6 && !this.driver ? -0.25 : want, 1 - Math.exp(-dt * 8));
      this.root.rotation.set(this.pitch, this.heading, this.roll + this.lean, 'YXZ');
    } else {
      this.root.rotation.set(this.pitch, this.heading, this.roll, 'YXZ');
      if (dt > 0) {
        // mola ~1,3 Hz, amortecimento ~0,35 do crítico; mergulha ao frear, agacha ao acelerar, inclina na curva
        const w2 = 66, c = 5.6, sub = Math.min(4, Math.ceil(dt / 0.01)), h = dt / sub;
        const tp = clamp(-this.ax * 0.0075, -0.075, 0.075), tr = clamp(this.ay * 0.0095, -0.095, 0.095);
        for (let i = 0; i < sub; i++) {
          this.sPv += (w2 * (tp - this.sP) - c * this.sPv) * h; this.sP += this.sPv * h;
          this.sRv += (w2 * (tr - this.sR) - c * this.sRv) * h; this.sR += this.sRv * h;
          this.sHv += (w2 * 1.3 * -this.sH - c * 1.2 * this.sHv) * h; this.sH += this.sHv * h;
        }
        this.sH = clamp(this.sH, -0.14, 0.1);
      }
      this.body.rotation.x = this.sP;
      this.body.rotation.z = this.sR;
      this.body.position.y = this.sH;
    }
    const vx = this.fwdSpeed;
    for (const w of this.wheels) {
      if (w.front) w.piv.rotation.y = this.steer;
      // roda travada não gira; roda motriz patinando gira mais rápido que o chão
      const drv = t.drive === 'awd' || (t.drive === 'front') === w.front;
      if (!(w.front ? this.lockF : this.lockR)) w.spin.rotation.x += (vx / t.wheelR + (drv ? (this.slipR || 0) * 60 * Math.sign(this.thr || 0) : 0)) * dt;
    }
    if (this.inWater) this.root.position.y -= 0.3;
    this.headMat.emissiveIntensity = this.lights ? 4 : 0.15;
    this.tailMat.emissiveIntensity = this.brakeOn && this.driver ? 5 : this.lights ? 1.4 : 0.1;
  }

  // colisão com prédios: três círculos ao longo do carro
  collideWorld(col) {
    const t = this.t;
    const r = Math.max(0.3, t.width / 2);
    const off = Math.max(0, t.length / 2 - r);
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    let worst = 0;
    const p = this._p || (this._p = { x: 0, z: 0 }), n = this._n || (this._n = { x: 0, z: 0 });
    for (const s of [-1, 0, 1]) {
      const cx = this.pos.x + sh * off * s, cz = this.pos.z + ch * off * s;
      p.x = cx; p.z = cz;
      if (!col.resolveCircle(p, r, this.pos.y + 0.3, n)) continue;
      this.pos.x += p.x - cx; this.pos.z += p.z - cz;
      const rx = cx - this.pos.x, rz = cz - this.pos.z;
      const vcx = this.vel.x + this.yawRate * rz, vcz = this.vel.z - this.yawRate * rx;
      const vn = vcx * n.x + vcz * n.z;
      if (vn >= 0) continue;
      const rn = rz * n.x - rx * n.z;
      const j = (-(1 + 0.25) * vn) / (1 / t.mass + (rn * rn) / t.I);
      this.vel.x += (j * n.x) / t.mass; this.vel.z += (j * n.z) / t.mass;
      this.yawRate += (rn * j) / t.I;
      this.vel.x *= 0.92; this.vel.z *= 0.92;
      if (-vn > worst) { worst = -vn; this._hit = [cx - n.x * r, cz - n.z * r, n.x, n.z]; }
      this.sleeping = false;
    }
    if (worst > 1.5) this.damage(worst, ...this._hit);
    return worst;
  }

  // dano localizado: (cx,cz) ponto de contato no mundo, (nx,nz) direção do empurrão
  damage(v, cx, cz, nx, nz) {
    this.impact = Math.max(this.impact, v);
    this.health -= v * v * 1.2;
    if (Vehicle.onDamage) Vehicle.onDamage(this, v, cx, cz);
    if (cx === undefined || !this.deform) return;
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    const dx = cx - this.pos.x, dz = cz - this.pos.z;
    const lz = dx * sh + dz * ch, lx = dx * ch - dz * sh;
    const dX = nx * ch - nz * sh, dZ = nx * sh + nz * ch;
    const L = this.t.length, W = this.t.width;
    const zf = lz / (L / 2), zs = lx / (W / 2);
    const zone = Math.abs(zf) > Math.abs(zs) * 0.9 ? (zf > 0 ? 'front' : 'rear') : zs > 0 ? 'left' : 'right';
    this.zones[zone] += v * v * 1.2;
    this.dent(clamp(lx, -W / 2, W / 2), clamp(lz, -L / 2, L / 2), dX, dZ, v);
    this.breakZone(zone, lx);
  }

  dent(cx, cz, dX, dZ, v) {
    const amt = Math.min(0.26, v * 0.028), R = Math.min(1.8, 0.5 + v * 0.08);
    const dl = Math.hypot(dX, dZ) || 1; dX /= dl; dZ /= dl;
    for (const m of this.deform) {
      if (!m.visible) continue;
      const pos = m.geometry.attributes.position;
      const o = m.userData.orig || (m.userData.orig = pos.array.slice());
      let changed = false;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const d = Math.hypot(x + m.position.x - cx, z + m.position.z - cz);
        if (d >= R) continue;
        const k = amt * (1 - d / R) ** 2;
        let nx = x + dX * k, nz = z + dZ * k;
        const ox = o[i * 3], oz = o[i * 3 + 2], ex = nx - ox, ez = nz - oz, D = Math.hypot(ex, ez);
        if (D > 0.5) { nx = ox + (ex / D) * 0.5; nz = oz + (ez / D) * 0.5; }
        pos.setXYZ(i, nx, y > 0 ? Math.max(o[i * 3 + 1] - 0.15, y - k * 0.3) : y, nz);
        changed = true;
      }
      if (changed) { pos.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere(); }
    }
  }

  breakZone(zone, lx) {
    const z = this.zones[zone], P = this.parts, side = lx > 0 ? 'L' : 'R', fx = Vehicle.fx;
    if (!fx) return;
    const glass = (m) => m && m.visible && fx.glass(this, m);
    const part = (m) => m && m.visible && fx.detach(this, m);
    if (zone === 'front') {
      if (z > 140) glass(P['head' + side]);
      if (z > 300) part(P.bumperF);
      if (z > 420) glass(P.paneF);
      if (z > 700) part(P.hood);
      if (z > 900) { glass(P.headL); glass(P.headR); }
    } else if (zone === 'rear') {
      if (z > 140) glass(P['tail' + side]);
      if (z > 300) part(P.bumperR);
      if (z > 420) glass(P.paneB);
      if (z > 700) part(P.trunk);
    } else {
      const S = zone === 'left' ? 'L' : 'R';
      if (z > 320) glass(P['pane' + S]);
      if (z > 700) part(P['door' + S]);
    }
  }

  repairVisual() {
    for (const m of this.deform) {
      m.visible = true;
      if (m.userData.orig) { m.geometry.attributes.position.array.set(m.userData.orig); m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals(); }
    }
    for (const k in this.parts) this.parts[k].visible = true;
    this.zones = { front: 0, rear: 0, left: 0, right: 0 };
  }

  circles(out) {
    const t = this.t, r = Math.max(0.3, t.width / 2), off = Math.max(0, t.length / 2 - r);
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    for (let s = -1, i = 0; s <= 1; s++, i++) { out[i].x = this.pos.x + sh * off * s; out[i].z = this.pos.z + ch * off * s; out[i].r = r; }
    return out;
  }

  // ponto local -> testa se (x,z) está dentro do retângulo do carro (+margem)
  contains(x, z, m = 0) {
    const dx = x - this.pos.x, dz = z - this.pos.z;
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    const f = dx * sh + dz * ch, l = dx * ch - dz * sh;
    return Math.abs(f) < this.t.length / 2 + m && Math.abs(l) < this.t.width / 2 + m;
  }

  doorPoint(side = 1) {
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    const off = this.t.width / 2 + 0.7;
    return { x: this.pos.x + ch * off * side, z: this.pos.z - sh * off * side };
  }
}

const C3 = () => [{ x: 0, z: 0, r: 0 }, { x: 0, z: 0, r: 0 }, { x: 0, z: 0, r: 0 }];
const ca = C3(), cb = C3();
export function collideVehicles(list, onHit) {
  for (let i = 0; i < list.length; i++) {
    const A = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const B = list[j];
      const dd = (A.t.length + B.t.length) / 2 + 0.5;
      if (Math.abs(A.pos.x - B.pos.x) > dd || Math.abs(A.pos.z - B.pos.z) > dd) continue;
      if (Math.abs(A.pos.y - B.pos.y) > 2.5) continue;
      A.circles(ca); B.circles(cb);
      for (const p of ca) for (const q of cb) {
        let nx = p.x - q.x, nz = p.z - q.z;
        const d = Math.hypot(nx, nz), R = p.r + q.r;
        if (d >= R || d < 1e-5) continue;
        nx /= d; nz /= d;
        const pen = R - d;
        const ma = A.t.mass, mb = B.t.mass, tot = ma + mb;
        A.pos.x += nx * pen * (mb / tot); A.pos.z += nz * pen * (mb / tot);
        B.pos.x -= nx * pen * (ma / tot); B.pos.z -= nz * pen * (ma / tot);
        const cx = (p.x + q.x) / 2, cz = (p.z + q.z) / 2;
        const rax = cx - A.pos.x, raz = cz - A.pos.z, rbx = cx - B.pos.x, rbz = cz - B.pos.z;
        const vax = A.vel.x + A.yawRate * raz, vaz = A.vel.z - A.yawRate * rax;
        const vbx = B.vel.x + B.yawRate * rbz, vbz = B.vel.z - B.yawRate * rbx;
        const vn = (vax - vbx) * nx + (vaz - vbz) * nz;
        if (vn >= 0) continue;
        const rna = raz * nx - rax * nz, rnb = rbz * nx - rbx * nz;
        const jj = (-(1 + 0.3) * vn) / (1 / ma + 1 / mb + (rna * rna) / A.t.I + (rnb * rnb) / B.t.I);
        A.vel.x += (jj * nx) / ma; A.vel.z += (jj * nz) / ma; A.yawRate += (rna * jj) / A.t.I;
        B.vel.x -= (jj * nx) / mb; B.vel.z -= (jj * nz) / mb; B.yawRate -= (rnb * jj) / B.t.I;
        A.sleeping = B.sleeping = false;
        if (-vn > 2) { A.damage(-vn * 0.7, cx, cz, nx, nz); B.damage(-vn * 0.7, cx, cz, -nx, -nz); }
        if (onHit) onHit(A, B, -vn);
      }
    }
  }
}
