// Procedural voxel structures: houses, barn, windmill, forge, bridges, ruins, tower...
// Every function writes boxes through the WorldBuilder (B) using a local Frame.
import * as THREE from 'three';
import { shade, makeRng, hash2 } from '../core/utils.js';
import { FLAG } from './terrain.js';
import { colorMat, boxMesh } from '../render/voxel.js';

// Local coordinate frame with quarter-turn rotation. Local +z = front.
export class Frame {
  constructor(B, ox, oy, oz, rot = 0) { this.B = B; this.ox = ox; this.oy = oy; this.oz = oz; this.rot = ((rot % 4) + 4) % 4; }
  xz(lx, lz) {
    switch (this.rot) {
      case 1: return [this.ox - lz, this.oz + lx];
      case 2: return [this.ox - lx, this.oz - lz];
      case 3: return [this.ox + lz, this.oz - lx];
      default: return [this.ox + lx, this.oz + lz];
    }
  }
  p(lx, ly, lz) { const [x, z] = this.xz(lx, lz); return [x, this.oy + ly, z]; }
  box(lx0, ly0, lz0, lx1, ly1, lz1, color, o) {
    const [ax, az] = this.xz(lx0, lz0), [bx, bz] = this.xz(lx1, lz1);
    this.B.box(Math.min(ax, bx), this.oy + ly0, Math.min(az, bz), Math.max(ax, bx), this.oy + ly1, Math.max(az, bz), color, o);
  }
  col(lx0, ly0, lz0, lx1, ly1, lz1, o) {
    const [ax, az] = this.xz(lx0, lz0), [bx, bz] = this.xz(lx1, lz1);
    return this.B.collider(Math.min(ax, bx), this.oy + ly0, Math.min(az, bz), Math.max(ax, bx), this.oy + ly1, Math.max(az, bz), o);
  }
  flag(lx0, lz0, lx1, lz1, f) {
    const [ax, az] = this.xz(lx0, lz0), [bx, bz] = this.xz(lx1, lz1);
    this.B.flag(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), f);
  }
}

const WOOD = 0x7a5232, WOOD_D = 0x5a3a20, STONE = 0x8e8a84, STONE_D = 0x6a6762, WINDOW = 0xffd88a;

function roofGable(f, w, d, y, color, wallColor, overhang = 0.6) {
  const half = d / 2 + overhang;
  const step = 0.55;
  let k = 0;
  for (let z = half; z > 0.2; z -= step, k++) {
    const c = k % 2 ? shade(color, 0.92) : color;
    f.box(-w / 2 - overhang, y + k * 0.5, -z, w / 2 + overhang, y + k * 0.5 + 0.5, z, c, { topColor: shade(c, 1.08) });
    if (z > 0.8) f.box(-w / 2 + 0.05, y + k * 0.5, -z + 0.6, w / 2 - 0.05, y + k * 0.5 + 0.5, z - 0.6, wallColor);
  }
  f.box(-w / 2 - overhang - 0.1, y + k * 0.5, -0.35, w / 2 + overhang + 0.1, y + k * 0.5 + 0.35, 0.35, shade(color, 0.75));
  return y + k * 0.5 + 0.35;
}

function windowAt(f, lx, ly, lz, face, o = {}) {
  // face: 'front' (z+), 'back', 'left' (x-), 'right'
  const w = o.w || 1.0, h = o.h || 1.0, t = 0.08;
  if (face === 'front' || face === 'back') {
    const s = face === 'front' ? 1 : -1;
    f.box(lx - w / 2 - 0.12, ly - 0.12, lz, lx + w / 2 + 0.12, ly + h + 0.12, lz + s * t, WOOD_D);
    f.box(lx - w / 2, ly, lz + s * t, lx + w / 2, ly + h, lz + s * (t + 0.04), WINDOW, { emit: 1, vary: 0 });
    f.box(lx - 0.05, ly, lz + s * (t + 0.04), lx + 0.05, ly + h, lz + s * (t + 0.08), WOOD_D);
    f.box(lx - w / 2 - 0.2, ly - 0.25, lz, lx + w / 2 + 0.2, ly - 0.12, lz + s * 0.3, WOOD_D);
    if (o.flowers) for (let i = 0; i < 3; i++) f.box(lx - 0.4 + i * 0.35, ly - 0.12, lz + s * 0.1, lx - 0.25 + i * 0.35, ly + 0.1, lz + s * 0.25, [0xe04a5a, 0xf0d040, 0xd070e0][i], { wind: 0.3 });
  } else {
    const s = face === 'right' ? 1 : -1;
    f.box(lx, ly - 0.12, lz - w / 2 - 0.12, lx + s * t, ly + h + 0.12, lz + w / 2 + 0.12, WOOD_D);
    f.box(lx + s * t, ly, lz - w / 2, lx + s * (t + 0.04), ly + h, lz + w / 2, WINDOW, { emit: 1, vary: 0 });
    f.box(lx + s * (t + 0.04), ly, lz - 0.05, lx + s * (t + 0.08), ly + h, lz + 0.05, WOOD_D);
  }
}

export function house(B, x, z, rot, o = {}) {
  const w = o.w || 8, d = o.d || 7, floors = o.floors || 1;
  const wall = o.wall ?? 0xeadcbc, roof = o.roof ?? 0xb04a32, beam = o.beam ?? WOOD;
  const y = B.ground(x, z);
  const f = new Frame(B, x, y, z, rot);
  const H = 3.1 * floors;
  f.flag(-w / 2 - 1.5, -d / 2 - 1.5, w / 2 + 1.5, d / 2 + 2.5, FLAG.NOTREE | FLAG.NOGRASS | FLAG.BUILDING);
  f.box(-w / 2 - 0.3, -1.5, -d / 2 - 0.3, w / 2 + 0.3, 0.45, d / 2 + 0.3, STONE, { topColor: 0x9e9890 });
  f.box(-w / 2, 0.45, -d / 2, w / 2, 0.45 + H, d / 2, wall);
  // timber frame
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.box(sx * w / 2 - 0.2, 0.45, sz * d / 2 - 0.2, sx * w / 2 + 0.2, 0.45 + H, sz * d / 2 + 0.2, beam);
  for (let fl = 1; fl <= floors; fl++) {
    f.box(-w / 2 - 0.1, 0.45 + fl * 3.1 - 0.25, -d / 2 - 0.1, w / 2 + 0.1, 0.45 + fl * 3.1, d / 2 + 0.1, beam);
  }
  if (floors > 1) f.box(-w / 2 - 0.08, 3.3, -d / 2 - 0.08, w / 2 + 0.08, 3.5, d / 2 + 0.08, shade(beam, 0.9));
  // door
  const dx = o.doorX || 0;
  f.box(dx - 0.85, 0.45, d / 2, dx + 0.85, 2.85, d / 2 + 0.12, WOOD_D);
  f.box(dx - 0.65, 0.45, d / 2 + 0.12, dx + 0.65, 2.65, d / 2 + 0.2, o.door ?? 0x6a4020);
  f.box(dx + 0.35, 1.5, d / 2 + 0.2, dx + 0.5, 1.65, d / 2 + 0.3, 0xd4a83a);
  f.box(dx - 1.2, 0.0, d / 2 + 0.2, dx + 1.2, 0.45, d / 2 + 1.2, STONE_D);
  // windows
  for (let fl = 0; fl < floors; fl++) {
    const wy = 1.4 + fl * 3.1;
    const wxs = w >= 8 ? [-w / 2 + 1.6, w / 2 - 1.6] : [w / 2 - 1.4];
    for (const wx of wxs) if (Math.abs(wx - dx) > 1.6 || fl > 0) windowAt(f, wx, wy, d / 2, 'front', { flowers: fl === 0 });
    windowAt(f, 0, wy, -d / 2, 'back');
    windowAt(f, -w / 2, wy, 0, 'left');
    windowAt(f, w / 2, wy, 0, 'right');
  }
  const top = roofGable(f, w, d, 0.45 + H, roof, wall);
  if (o.chimney !== false) {
    f.box(w / 4 - 0.5, H - 1, -d / 4 - 0.5, w / 4 + 0.5, top + 1.2, -d / 4 + 0.5, 0x8a5a4a);
    f.box(w / 4 - 0.6, top + 1.0, -d / 4 - 0.6, w / 4 + 0.6, top + 1.3, -d / 4 + 0.6, 0x6a4a3a);
    const p = f.p(w / 4, top + 1.4, -d / 4);
    B.smoke(p[0], p[1], p[2]);
  }
  // lantern by the door
  const lp = f.p(dx + 1.3, 2.4, d / 2 + 0.35);
  f.box(dx + 1.15, 2.2, d / 2 + 0.1, dx + 1.45, 2.6, d / 2 + 0.5, 0xffc860, { emit: 1, vary: 0 });
  B.glow(lp[0], lp[1], lp[2], 0xffb050, 1.6, true);
  if (o.sign) {
    f.box(dx + 1.2, 2.9, d / 2 + 0.1, dx + 1.3, 3.0, d / 2 + 1.4, WOOD_D);
    f.box(dx + 0.9, 2.1, d / 2 + 0.9, dx + 1.6, 2.9, d / 2 + 1.0, o.sign);
  }
  f.col(-w / 2 - 0.3, -1, -d / 2 - 0.3, w / 2 + 0.3, top, d / 2 + 0.3);
  return { f, y, top, door: f.p(dx, 0, d / 2 + 1.6) };
}

export function barn(B, x, z, rot) {
  const w = 14, d = 11, H = 6;
  const y = B.ground(x, z);
  const f = new Frame(B, x, y, z, rot);
  const red = 0xa83a2a, white = 0xf0ece0;
  f.flag(-w / 2 - 2, -d / 2 - 2, w / 2 + 2, d / 2 + 4, FLAG.NOTREE | FLAG.NOGRASS);
  f.box(-w / 2 - 0.3, -1.5, -d / 2 - 0.3, w / 2 + 0.3, 0.3, d / 2 + 0.3, STONE);
  f.box(-w / 2, 0.3, -d / 2, w / 2, H, d / 2, red);
  for (let i = -w / 2; i <= w / 2; i += 2) f.box(i - 0.12, 0.3, d / 2, i + 0.12, H, d / 2 + 0.08, shade(red, 0.8));
  for (const sx of [-1, 1]) f.box(sx * w / 2 - 0.25, 0.3, -d / 2 - 0.25, sx * w / 2 + 0.25, H, d / 2 + 0.25, white);
  // big door with X
  f.box(-2.4, 0.3, d / 2 + 0.05, 2.4, 4.4, d / 2 + 0.2, white);
  f.box(-2.1, 0.3, d / 2 + 0.2, 2.1, 4.1, d / 2 + 0.3, 0x7a2a1e);
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    f.box(-2 + t * 3.6, 0.5 + t * 3.4, d / 2 + 0.3, -1.6 + t * 3.6, 0.9 + t * 3.4, d / 2 + 0.38, white);
    f.box(1.6 - t * 3.6, 0.5 + t * 3.4, d / 2 + 0.3, 2 - t * 3.6, 0.9 + t * 3.4, d / 2 + 0.38, white);
  }
  f.box(-1, 5, d / 2 + 0.05, 1, 6.2, d / 2 + 0.25, 0x3a2010);
  f.box(-0.8, 5.1, d / 2 + 0.25, 0.8, 6.0, d / 2 + 0.35, 0xe8c860, { emit: 0.6 });
  // gambrel roof
  let yy = H, k = 0;
  for (let zz = d / 2 + 0.7; zz > 0.2; k++) {
    const c = k % 2 ? 0x5a4a44 : 0x6a5850;
    f.box(-w / 2 - 0.6, yy, -zz, w / 2 + 0.6, yy + 0.6, zz, c);
    if (zz > 1) f.box(-w / 2 + 0.05, yy, -zz + 0.7, w / 2 - 0.05, yy + 0.6, zz - 0.7, red);
    yy += 0.6;
    zz -= k < 3 ? 0.45 : 0.9;
  }
  f.col(-w / 2 - 0.3, -1, -d / 2 - 0.3, w / 2 + 0.3, yy, d / 2 + 0.3);
  // hay bales near
  for (let i = 0; i < 3; i++) hay(B, f.p(w / 2 + 2, 0, d / 2 - i * 2.2)[0], f.p(w / 2 + 2, 0, d / 2 - i * 2.2)[2]);
  return { f, y };
}

export function hay(B, x, z) {
  const y = B.ground(x, z);
  B.box(x - 0.9, y, z - 0.7, x + 0.9, y + 1.2, z + 0.7, 0xe0c060, { topColor: 0xecd070, col: true });
  B.box(x - 0.92, y + 0.5, z - 0.72, x + 0.92, y + 0.6, z + 0.72, 0xb08a3a);
}

export function windmill(B, x, z) {
  const y = B.ground(x, z);
  const f = new Frame(B, x, y, z, 0);
  f.flag(-5, -5, 5, 5, FLAG.NOTREE | FLAG.NOGRASS);
  for (let i = 0; i < 10; i++) {
    const r = 2.6 - i * 0.12;
    f.box(-r, i, -r, r, i + 1, r, i % 3 === 0 ? 0xe8e0d0 : 0xdcd4c4);
  }
  f.box(-0.7, 0, 2.3, 0.7, 2.2, 2.5, WOOD_D);
  windowAt(f, 0, 5, 1.9, 'front', { w: 0.7, h: 0.8 });
  f.box(-2, 10, -2, 2, 10.6, 2, 0x8a3a2a);
  f.box(-1.4, 10.6, -1.4, 1.4, 11.2, 1.4, 0x9a4a3a);
  f.box(-0.8, 11.2, -0.8, 0.8, 11.7, 0.8, 0xaa5a4a);
  f.col(-2.6, -1, -2.6, 2.6, 11.7, 2.6);
  // rotating blades (dynamic)
  const g = new THREE.Group();
  g.position.set(x, y + 9.4, z + 2.7);
  const hub = boxMesh(0.6, 0.6, 0.6, WOOD_D); g.add(hub);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    const beam = boxMesh(0.25, 6, 0.2, WOOD, { pos: [0, 3, 0] });
    const sail = boxMesh(1.2, 4.6, 0.08, 0xf0e8d8, { pos: [0.75, 3.6, 0.05] });
    arm.add(beam, sail);
    g.add(arm);
  }
  B.dynamic(g, (dt, t) => { g.rotation.z -= dt * 0.6 * (G_WIND.v); });
}
export const G_WIND = { v: 1 };

export function fence(B, x0, z0, x1, z1, o = {}) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 2));
  const color = o.color ?? 0x9a7048;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    const y = B.ground(x, z);
    B.box(x - 0.15, y, z - 0.15, x + 0.15, y + 1.5, z + 0.15, shade(color, 0.85));
    if (i < n) {
      const t2 = (i + 1) / n, xb = x0 + (x1 - x0) * t2, zb = z0 + (z1 - z0) * t2;
      const yb = B.ground(xb, zb);
      const ym = Math.min(y, yb);
      const ax = Math.min(x, xb) - 0.06, bx = Math.max(x, xb) + 0.06, az = Math.min(z, zb) - 0.06, bz = Math.max(z, zb) + 0.06;
      B.box(ax, ym + 0.55, az, bx, ym + 0.7, bz, color);
      B.box(ax, ym + 1.05, az, bx, ym + 1.2, bz, color);
      if (o.col !== false) B.collider(ax - 0.1, ym, az - 0.1, bx + 0.1, ym + 1.5, bz + 0.1, { noCam: true });
    }
  }
}

export function fenceRect(B, x0, z0, x1, z1, gap) {
  fence(B, x0, z0, x1, z0);
  fence(B, x1, z0, x1, z1);
  if (gap) { fence(B, x1, z1, gap[1], z1); fence(B, gap[0], z1, x0, z1); }
  else fence(B, x1, z1, x0, z1);
  fence(B, x0, z1, x0, z0);
}

export function lampPost(B, x, z) {
  const y = B.ground(x, z);
  B.box(x - 0.5, y, z - 0.5, x + 0.5, y + 0.3, z + 0.5, STONE_D);
  B.box(x - 0.12, y, z - 0.12, x + 0.12, y + 3.4, z + 0.12, 0x3a3a3a);
  B.box(x - 0.12, y + 3.2, z - 0.12, x + 0.8, y + 3.35, z + 0.12, 0x3a3a3a);
  B.box(x + 0.5, y + 2.6, z - 0.22, x + 0.94, y + 3.15, z + 0.22, 0xffd070, { emit: 1, vary: 0 });
  B.box(x + 0.45, y + 3.15, z - 0.27, x + 0.99, y + 3.25, z + 0.27, 0x2a2a2a);
  B.glow(x + 0.72, y + 2.85, z, 0xffb04a, 2.6, true);
  B.cyl(x, z, 0.25, y, y + 3.4);
  // the hanging lantern and its arm are solid too
  B.collider(x + 0.1, y + 2.55, z - 0.3, x + 1.0, y + 3.4, z + 0.3, { noCam: true });
}

export function well(B, x, z) {
  const y = B.ground(x, z);
  const f = new Frame(B, x, y, z, 0);
  f.box(-1.6, 0, -1.6, 1.6, 1.1, -1.1, STONE); f.box(-1.6, 0, 1.1, 1.6, 1.1, 1.6, STONE);
  f.box(-1.6, 0, -1.1, -1.1, 1.1, 1.1, STONE); f.box(1.1, 0, -1.1, 1.6, 1.1, 1.1, STONE);
  f.box(-1.1, 0, -1.1, 1.1, 0.5, 1.1, 0x2a5a8a, { emit: 0 });
  f.box(-1.5, 1.1, -0.15, -1.2, 3.2, 0.15, WOOD); f.box(1.2, 1.1, -0.15, 1.5, 3.2, 0.15, WOOD);
  f.box(-1.5, 2.8, -0.08, 1.5, 2.95, 0.08, WOOD_D);
  f.box(-2, 3.2, -1.4, 2, 3.5, 0, 0xa04a32); f.box(-2, 3.2, 0, 2, 3.5, 1.4, 0xa04a32);
  f.box(-2, 3.5, -0.8, 2, 3.8, 0.8, 0x8a3a2a);
  f.box(-0.25, 1.8, -0.25, 0.25, 2.3, 0.25, 0x6a4a2a);
  f.col(-1.6, -1, -1.6, 1.6, 1.4, 1.6);
}

export function stall(B, x, z, rot, cloth, goods = [0xe04a3a, 0xf0c040, 0x60b040]) {
  const y = B.ground(x, z);
  const f = new Frame(B, x, y, z, rot);
  f.flag(-2, -1.5, 2, 2, FLAG.NOGRASS | FLAG.NOTREE);
  for (const sx of [-1.6, 1.6]) for (const sz of [-1, 1]) f.box(sx - 0.1, 0, sz - 0.1, sx + 0.1, 2.6, sz + 0.1, WOOD);
  f.box(-1.7, 0.9, 0.6, 1.7, 1.1, 1.2, WOOD);
  f.box(-1.7, 0, 0.7, 1.7, 0.9, 1.1, WOOD_D);
  for (let i = 0; i < 6; i++) f.box(-1.8 + i * 0.6, 2.6, -1.3, -1.2 + i * 0.6, 2.85, 1.5, i % 2 ? 0xf0ece0 : cloth, { wind: 0.15 });
  for (let i = 0; i < 6; i++) f.box(-1.4 + i * 0.5, 1.1, 0.7, -1.1 + i * 0.5, 1.4, 1.0, goods[i % goods.length]);
  f.col(-1.8, -1, 0.5, 1.8, 1.2, 1.25);
}

export function crate(B, x, z, s = 1) {
  const y = B.ground(x, z);
  B.box(x - 0.5 * s, y, z - 0.5 * s, x + 0.5 * s, y + s, z + 0.5 * s, 0xa07a48, { col: true, topColor: 0xb08a58 });
  B.box(x - 0.52 * s, y + 0.4 * s, z - 0.52 * s, x + 0.52 * s, y + 0.55 * s, z + 0.52 * s, WOOD_D);
}
export function barrel(B, x, z) {
  const y = B.ground(x, z);
  B.box(x - 0.45, y, z - 0.45, x + 0.45, y + 1.2, z + 0.45, 0x8a5a32, { topColor: 0x9a6a3a });
  B.box(x - 0.48, y + 0.25, z - 0.48, x + 0.48, y + 0.35, z + 0.48, 0x4a4a4a);
  B.box(x - 0.48, y + 0.85, z - 0.48, x + 0.48, y + 0.95, z + 0.48, 0x4a4a4a);
  B.cyl(x, z, 0.45, y, y + 1.2);
}

export function forge(B, x, z, rot) {
  const y = B.ground(x, z);
  const f = new Frame(B, x, y, z, rot);
  f.flag(-5, -4, 5, 5, FLAG.NOGRASS | FLAG.NOTREE);
  f.box(-4.5, -1, -3.5, 4.5, 0.3, 3.5, STONE_D, { topColor: 0x7a7570 });
  for (const sx of [-4.2, 4.2]) for (const sz of [-3.2, 3.2]) { f.box(sx - 0.2, 0.3, sz - 0.2, sx + 0.2, 3.8, sz + 0.2, WOOD); }
  for (let k = 0; k < 4; k++) f.box(-4.8 + k * 0.1, 3.8 + k * 0.4, -3.9 + k * 0.9, 4.8 - k * 0.1, 4.2 + k * 0.4, 3.9 - k * 0.9, k % 2 ? 0x6a5a50 : 0x5a4a44);
  // furnace
  f.box(-4, 0.3, -3.4, -1.5, 3.2, -1.4, 0x7a6a62);
  f.box(-3.5, 0.6, -1.45, -2, 1.8, -1.3, 0xff7a2a, { emit: 2.3, vary: 0 });
  f.box(-3.2, 3.2, -3, -2.2, 6.4, -2, 0x6a5a52);
  const sp = f.p(-2.7, 6.6, -2.5);
  B.smoke(sp[0], sp[1], sp[2], 0x777777);
  const fp = f.p(-2.75, 1.2, -1.2);
  B.fire(fp[0], fp[1], fp[2], 0.5, true);
  // anvil
  f.box(0.2, 0.3, -0.4, 1.0, 1.0, 0.4, 0x3a3a40);
  f.box(-0.3, 1.0, -0.5, 1.5, 1.35, 0.5, 0x4a4a52);
  // weapon rack
  f.box(2.4, 0.3, -3.3, 4.0, 2.4, -3.0, WOOD);
  for (let i = 0; i < 4; i++) f.box(2.55 + i * 0.4, 0.8, -3.0, 2.65 + i * 0.4, 2.6, -2.9, i % 2 ? 0xc0c8d0 : 0xb08a5a);
  // counter
  f.box(-1, 0.3, 2.6, 3.6, 1.2, 3.3, WOOD_D);
  f.col(-4.2, -1, -3.5, -1.5, 3.2, -1.3);
  f.col(-1, -1, 2.5, 3.6, 1.3, 3.35);
  f.col(-0.3, -1, -0.5, 1.5, 1.35, 0.5);
  f.col(2.3, -1, -3.4, 4.1, 2.4, -2.8);
  for (const sx of [-4.2, 4.2]) for (const sz of [-3.2, 3.2]) { const [cx, cz] = f.xz(sx, sz); B.cyl(cx, cz, 0.25, y, y + 4); }
}

export function guardTower(B, x, z) {
  const y = B.ground(x, z);
  const f = new Frame(B, x, y, z, 0);
  f.flag(-3, -3, 3, 3, FLAG.NOTREE | FLAG.NOGRASS);
  for (const sx of [-1.6, 1.6]) for (const sz of [-1.6, 1.6]) { f.box(sx - 0.25, 0, sz - 0.25, sx + 0.25, 7, sz + 0.25, WOOD); const [cx, cz] = f.xz(sx, sz); B.cyl(cx, cz, 0.3, y, y + 7); }
  f.box(-2.2, 6, -2.2, 2.2, 6.4, 2.2, WOOD_D);
  for (const s of [-2.1, 2.1]) { f.box(-2.2, 6.4, s - 0.1, 2.2, 7.3, s + 0.1, WOOD); f.box(s - 0.1, 6.4, -2.2, s + 0.1, 7.3, 2.2, WOOD); }
  for (let k = 0; k < 3; k++) f.box(-2.6 + k * 0.7, 9 + k * 0.5, -2.6 + k * 0.7, 2.6 - k * 0.7, 9.5 + k * 0.5, 2.6 - k * 0.7, 0x2a5aa8);
  for (const sx of [-2, 2]) for (const sz of [-2, 2]) f.box(sx - 0.1, 7.3, sz - 0.1, sx + 0.1, 9, sz + 0.1, WOOD);
  // banner
  f.box(1.8, 3, 1.85, 2.2, 6, 1.95, 0x2a5aa8, { wind: 0.25, windBase: 0 });
  const t = f.p(0, 7.2, 0);
  B.glow(t[0], t[1], t[2], 0xffa040, 3, true);
}

export function tent(B, x, z, rot, color) {
  const y = B.ground(x, z);
  const f = new Frame(B, x, y, z, rot);
  f.flag(-3, -3, 3, 3, FLAG.NOGRASS | FLAG.NOTREE);
  for (let k = 0; k < 5; k++) {
    const w = 2.4 - k * 0.5;
    f.box(-w, k * 0.55, -2, w, k * 0.55 + 0.55, 2, k % 2 ? shade(color, 0.9) : color, { wind: k > 2 ? 0.08 : 0 });
  }
  f.box(-0.6, 0, 2, 0.6, 1.4, 2.05, 0x2a1a10);
  f.col(-2.4, -1, -2, 2.4, 2.5, 2);
}

export function campfire(B, x, z) {
  const y = B.ground(x, z);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    B.box(x + Math.cos(a) * 0.9 - 0.2, y, z + Math.sin(a) * 0.9 - 0.2, x + Math.cos(a) * 0.9 + 0.2, y + 0.3, z + Math.sin(a) * 0.9 + 0.2, 0x7a7a7a);
  }
  B.box(x - 0.7, y, z - 0.12, x + 0.7, y + 0.25, z + 0.12, 0x5a3a20);
  B.box(x - 0.12, y + 0.1, z - 0.7, x + 0.12, y + 0.35, z + 0.7, 0x4a2a18);
  B.box(x - 0.3, y + 0.2, z - 0.3, x + 0.3, y + 0.45, z + 0.3, 0xff8a2a, { emit: 2.5, vary: 0 });
  B.fire(x, y + 0.4, z, 1, true);
  B.cyl(x, z, 0.8, y, y + 0.5);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const lx = x + Math.cos(a) * 2.4, lz = z + Math.sin(a) * 2.4;
    B.box(lx - 0.8, y, lz - 0.3, lx + 0.8, y + 0.5, lz + 0.3, 0x6a4428, { topColor: 0x9a7048 });
  }
}

export function rock(B, x, z, s = 1, color = 0x8a8680, rng) {
  const y = B.ground(x, z) - 0.2;
  const r = rng || makeRng(Math.floor(x * 100 + z));
  B.box(x - s, y, z - s * 0.8, x + s, y + s * 1.1, z + s * 0.8, color, { topColor: shade(color, 1.1) });
  B.box(x - s * 0.6 + r() * 0.3, y + s * 1.0, z - s * 0.5, x + s * 0.5, y + s * 1.6, z + s * 0.4, shade(color, 1.05));
  if (r() < 0.5) B.box(x + s * 0.6, y, z + s * 0.2, x + s * 1.4, y + s * 0.7, z + s * 1.0, shade(color, 0.92));
  if (r() < 0.4) B.box(x - s * 0.9, y + s * 1.05, z - s * 0.7, x - s * 0.1, y + s * 1.2, z + s * 0.2, 0x5a8a3a, { vary: 0.15 });
  B.cyl(x, z, s * 1.0, y, y + s * 1.6);
}

// Bridge along an axis ('x' or 'z') from a to b (on that axis) at fixed cross coordinate c
export function bridge(B, axis, a, b, c, deckY) {
  const w = 1.8;
  const lo = Math.min(a, b), hi = Math.max(a, b);
  const P = (u, v) => (axis === 'x' ? [u, v] : [v, u]);
  const boxUV = (u0, y0, v0, u1, y1, v1, color, o) => {
    const [x0, z0] = P(u0, v0), [x1, z1] = P(u1, v1);
    B.box(Math.min(x0, x1), y0, Math.min(z0, z1), Math.max(x0, x1), y1, Math.max(z0, z1), color, o);
  };
  for (let u = lo; u < hi; u += 0.7) {
    const k = Math.round((u - lo) / 0.7);
    boxUV(u, deckY - 0.3, c - w, u + 0.66, deckY, c + w, k % 2 ? 0x9a7048 : 0x8a6038, { topColor: k % 2 ? 0xa87a50 : 0x9a6a40 });
  }
  for (let u = lo; u <= hi; u += 3) {
    for (const s of [-1, 1]) {
      boxUV(u - 0.15, -3, c + s * w - 0.15, u + 0.15, deckY + 1.3, c + s * w + 0.15, 0x6a4428);
    }
  }
  for (const s of [-1, 1]) boxUV(lo, deckY + 1.0, c + s * w - 0.1, hi, deckY + 1.2, c + s * w + 0.1, 0x7a5232);
  // deck colliders + rails
  const [x0, z0] = P(lo, c - w), [x1, z1] = P(hi, c + w);
  B.collider(Math.min(x0, x1), deckY - 0.4, Math.min(z0, z1), Math.max(x0, x1), deckY, Math.max(z0, z1), { noCam: true, surface: 'wood' });
  for (const s of [-1, 1]) {
    const [rx0, rz0] = P(lo, c + s * w - 0.1), [rx1, rz1] = P(hi, c + s * w + 0.1);
    B.collider(Math.min(rx0, rx1), deckY, Math.min(rz0, rz1), Math.max(rx0, rx1), deckY + 1.3, Math.max(rz0, rz1), { noCam: true });
  }
  // ramps down to terrain on both ends
  for (const [end, dir] of [[lo, -1], [hi, 1]]) {
    for (let s = 1; s <= 8; s++) {
      const u = end + dir * (s - 0.5) * 0.9;
      const [gx, gz] = P(u, c);
      const gy = B.ground(gx, gz);
      const yy = deckY - s * 0.9;
      if (yy <= gy - 0.2) break;
      boxUV(u - 0.45, Math.max(gy - 0.5, yy - 0.5), c - w, u + 0.45, yy, c + w, 0x8a6038);
      const [a0, b0] = P(u - 0.45, c - w), [a1, b1] = P(u + 0.45, c + w);
      B.collider(Math.min(a0, a1), yy - 0.5, Math.min(b0, b1), Math.max(a0, a1), yy, Math.max(b0, b1), { noCam: true, surface: 'wood' });
    }
  }
}

export function pier(B, x0, x1, z, deckY) {
  for (let x = x0; x < x1; x += 0.7) B.box(x, deckY - 0.25, z - 1.4, x + 0.66, deckY, z + 1.4, Math.round(x * 10) % 2 ? 0x9a7048 : 0x8a6038);
  for (let x = x0; x <= x1; x += 3) for (const s of [-1, 1]) B.box(x - 0.15, -3, z + s * 1.4 - 0.15, x + 0.15, deckY + 0.3, z + s * 1.4 + 0.15, 0x6a4428);
  B.collider(x0, deckY - 0.4, z - 1.4, x1, deckY, z + 1.4, { noCam: true, surface: 'wood' });
}

export function waystone(B, x, z) {
  const y = B.ground(x, z);
  B.flag(x - 3, z - 3, x + 3, z + 3, FLAG.NOTREE);
  B.box(x - 1.4, y - 0.5, z - 1.4, x + 1.4, y + 0.3, z + 1.4, 0x7a7670, { topColor: 0x8a8680 });
  B.box(x - 0.6, y + 0.3, z - 0.6, x + 0.6, y + 2.8, z + 0.6, 0x6a6a78);
  B.box(x - 0.45, y + 2.8, z - 0.45, x + 0.45, y + 3.3, z + 0.45, 0x5a5a68);
  B.box(x - 0.62, y + 1.0, z - 0.15, x + 0.62, y + 2.2, z + 0.15, 0x4fd0ff, { emit: 2.0, vary: 0 });
  B.cyl(x, z, 0.8, y, y + 3.3);
  return y;
}

export function ruinsColumn(B, x, z, h, broken, rng) {
  const y = B.ground(x, z);
  B.box(x - 0.9, y - 0.5, z - 0.9, x + 0.9, y + 0.5, z + 0.9, 0x9a9488);
  for (let k = 0; k < h; k++) {
    const moss = rng() < 0.25;
    const sh = broken && k === h - 1 ? 0.5 : 1;
    B.box(x - 0.6, y + 0.5 + k * 1.2, z - 0.6, x + 0.6, y + 0.5 + k * 1.2 + 1.2 * sh, z + 0.6, moss ? 0x7a9a5a : (k % 2 ? 0xb0a898 : 0xa8a090));
  }
  if (!broken) B.box(x - 1, y + 0.5 + h * 1.2, z - 1, x + 1, y + 1.1 + h * 1.2, z + 1, 0x9a9488);
  B.cyl(x, z, 0.8, y, y + 0.5 + h * 1.2);
}

export function ruinsWall(B, x0, z0, x1, z1, maxH, rng) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.round(len / 1.2);
  for (let i = 0; i < n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    const y = B.ground(x, z);
    const h = Math.max(1, Math.round(maxH * (0.3 + 0.7 * Math.abs(Math.sin(i * 0.7 + rng() * 2)))));
    for (let k = 0; k < h; k++) {
      B.box(x - 0.62, y + k * 0.9 - 0.4, z - 0.62, x + 0.62, y + k * 0.9 + 0.5, z + 0.62, rng() < 0.2 ? 0x7a9a5a : (k + i) % 2 ? 0xa8a090 : 0x9a9284);
    }
    B.cyl(x, z, 0.7, y, y + h * 0.9);
  }
}

export function statue(B, x, z, color = 0xa8a090) {
  const y = B.ground(x, z);
  B.box(x - 1.2, y, z - 1.2, x + 1.2, y + 1, z + 1.2, 0x8a8478);
  B.box(x - 0.5, y + 1, z - 0.4, x - 0.1, y + 2.2, z + 0.4, color); B.box(x + 0.1, y + 1, z - 0.4, x + 0.5, y + 2.2, z + 0.4, color);
  B.box(x - 0.7, y + 2.2, z - 0.45, x + 0.7, y + 3.6, z + 0.45, color);
  B.box(x - 0.5, y + 3.6, z - 0.5, x + 0.5, y + 4.5, z + 0.5, shade(color, 1.05));
  B.box(x + 0.75, y + 2.4, z - 0.2, x + 1.0, y + 5.2, z + 0.2, shade(color, 0.9));
  B.cyl(x, z, 1.2, y, y + 4.5);
}

// Tall tower with outside spiral staircase. Returns top platform height.
export function oldTower(B, x, z) {
  const y = B.ground(x, z);
  const H = 42;
  B.flag(x - 12, z - 12, x + 12, z + 12, FLAG.NOTREE);
  for (let seg = 0; seg < H; seg += 2) {
    const c = seg % 8 === 0 ? 0x6a6570 : seg % 4 === 0 ? 0x7a7580 : 0x857f8a;
    B.box(x - 4.6, y + seg - (seg === 0 ? 2 : 0), z - 3.2, x + 4.6, y + seg + 2, z + 3.2, c);
    B.box(x - 3.2, y + seg - (seg === 0 ? 2 : 0), z - 4.6, x + 3.2, y + seg + 2, z + 4.6, c);
    if (seg % 6 === 4) {
      B.box(x - 0.4, y + seg + 0.3, z + 4.6, x + 0.4, y + seg + 1.5, z + 4.7, 0x2a2030, { emit: 0.8 });
      B.box(x + 4.6, y + seg + 0.3, z - 0.4, x + 4.7, y + seg + 1.5, z + 0.4, 0x2a2030, { emit: 0.8 });
    }
  }
  B.collider(x - 4.6, y - 2, z - 3.2, x + 4.6, y + H, z + 3.2);
  B.collider(x - 3.2, y - 2, z - 4.6, x + 3.2, y + H, z + 4.6);
  // top deck with crenellations
  const T = y + H;
  B.box(x - 9, T - 0.6, z - 9, x + 9, T, z + 9, 0x6a6570, { topColor: 0x7a7a84 });
  B.collider(x - 9, T - 0.6, z - 9, x + 9, T, z + 9, { surface: 'stone' });
  for (let i = -9; i < 9; i += 2) {
    for (const [ax, az] of [[i, -9], [i, 8.2], [-9, i], [8.2, i]]) {
      if ((i / 2) % 2 === 0) {
        if (az === 8.2 && i >= -2 && i <= 1) continue; // gap for stairs arrival (south side)
        B.box(x + ax, T, z + az, x + ax + 0.8, T + 1.4, z + az + 0.8, 0x7a7580);
        B.collider(x + ax, T, z + az, x + ax + 0.8, T + 1.4, z + az + 0.8);
      }
    }
  }
  // low walls between merlons (prevent falls)
  for (const [x0, z0, x1, z1] of [[-9, -9, 9, -8.6], [-9, 8.6, -2, 9], [2, 8.6, 9, 9], [-9, -9, -8.6, 9], [8.6, -9, 9, 9]]) {
    B.box(x + x0, T, z + z0, x + x1, T + 0.7, z + z1, 0x6a6570);
    B.collider(x + x0, T, z + z0, x + x1, T + 1.2, z + z1, { noCam: true });
  }
  // glowing rune circle on top
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    B.box(x + Math.cos(a) * 5 - 0.3, T, z + Math.sin(a) * 5 - 0.3, x + Math.cos(a) * 5 + 0.3, T + 0.05, z + Math.sin(a) * 5 + 0.3, 0xd04cff, { emit: 1.9, vary: 0 });
  }
  // spiral stairs: start at south side going counter clockwise
  const R = 10.6, steps = H, per = 38;
  for (let s = 0; s < steps; s++) {
    const a = Math.PI / 2 - ((steps - 1 - s) / per) * Math.PI * 2;
    const sx = x + Math.cos(a) * R, sz = z + Math.sin(a) * R;
    const top = y + 1 + s;
    const st = Math.max(top - 2.5, y - 1);
    B.box(sx - 1.15, st, sz - 1.15, sx + 1.15, top, sz + 1.15, s % 2 ? 0x8a8490 : 0x7a7480, { topColor: 0x9a94a0 });
    B.collider(sx - 1.15, top - 1, sz - 1.15, sx + 1.15, top, sz + 1.15, { noCam: true, surface: 'stone' });
    if (s % 3 === 0) B.glow(sx, top + 0.6, sz, 0xb66cff, 0.9, true);
  }
  // landing between last step and deck
  B.box(x - 1.2, T - 0.5, z + 8.6, x + 1.2, T, z + 9.8, 0x7a7480);
  B.collider(x - 1.2, T - 0.5, z + 8.6, x + 1.2, T, z + 9.8, { noCam: true, surface: 'stone' });
  return T;
}

export function watchTower(B, x, z) {
  const y = B.ground(x, z);
  B.flag(x - 10, z - 4, x + 4, z + 4, FLAG.NOTREE);
  const T = y + 12;
  for (const sx of [-2.2, 2.2]) for (const sz of [-2.2, 2.2]) { B.box(x + sx - 0.25, y - 1, z + sz - 0.25, x + sx + 0.25, T + 2.5, z + sz + 0.25, 0x6a4428); B.cyl(x + sx, z + sz, 0.3, y - 1, T + 2.5); }
  B.box(x - 2.8, T - 0.4, z - 2.8, x + 2.8, T, z + 2.8, 0x8a6038);
  B.collider(x - 2.8, T - 0.4, z - 2.8, x + 2.8, T, z + 2.8, { surface: 'wood' });
  for (const [x0, z0, x1, z1] of [[-2.8, -2.8, 2.8, -2.6], [-2.8, 2.6, 2.8, 2.8], [2.6, -2.8, 2.8, 2.8]]) {
    B.box(x + x0, T, z + z0, x + x1, T + 1.0, z + z1, 0x7a5232);
    B.collider(x + x0, T, z + z0, x + x1, T + 1.3, z + z1, { noCam: true });
  }
  for (let k = 0; k < 3; k++) B.box(x - 3.2 + k * 0.9, T + 2.5 + k * 0.5, z - 3.2 + k * 0.9, x + 3.2 - k * 0.9, T + 3 + k * 0.5, z + 3.2 - k * 0.9, 0x5a6a3a);
  // stairs from west
  for (let s = 0; s < 12; s++) {
    const sx = x - 3.2 - (11 - s) * 0.9;
    const top = y + 1 + s;
    B.box(sx - 0.45, top - 1.2, z - 1, sx + 0.45, top, z + 1, s % 2 ? 0x8a6038 : 0x9a7048);
    B.collider(sx - 0.45, top - 1, z - 1, sx + 0.45, top, z + 1, { noCam: true, surface: 'wood' });
  }
  return T;
}

export function caveEntrance(B, x, z) {
  const y = B.ground(x, z);
  const c = 0x6a6660;
  B.box(x - 5, y - 1, z - 3, x - 2, y + 6, z + 1, c, { col: true });
  B.box(x + 2, y - 1, z - 3, x + 5, y + 6, z + 1, c, { col: true });
  B.box(x - 5.5, y + 5, z - 3.5, x + 5.5, y + 8, z + 1.2, shade(c, 0.9), { col: true });
  B.box(x - 2, y - 0.2, z - 3, x + 2, y + 5, z - 2.6, 0x050308, { vary: 0 });
  B.box(x - 2, y + 4.4, z - 2.6, x + 2, y + 5.1, z + 1, 0x5a5650);
  for (let i = -1; i <= 1; i++) B.box(x + i * 1.3 - 0.2, y + 3.6, z + 0.6, x + i * 1.3 + 0.2, y + 4.4, z + 1, 0x7a766e);
  for (const s of [-1, 1]) {
    B.box(x + s * 2.6 - 0.12, y, z + 1.4, x + s * 2.6 + 0.12, y + 2.4, z + 1.64, 0x5a3a20);
    B.fire(x + s * 2.6, y + 2.5, z + 1.5, 0.45, s === 1);
  }
  B.collider(x - 2, y - 1, z - 3.2, x + 2, y + 5, z - 2.4);
}

export function hut(B, x, z, rot) {
  const y = Math.max(B.ground(x, z), 1);
  const f = new Frame(B, x, y + 1.2, z, rot);
  for (const sx of [-1.8, 1.8]) for (const sz of [-1.5, 1.5]) f.box(sx - 0.15, -3, sz - 0.15, sx + 0.15, 0, sz + 0.15, 0x5a3a20);
  f.box(-2.3, -0.3, -2, 2.3, 0, 2.6, 0x8a6038);
  f.box(-2, 0, -1.7, 2, 2.6, 1.7, 0x7a6a4a);
  f.box(-0.5, 0, 1.7, 0.5, 1.9, 1.8, 0x3a2414);
  windowAt(f, 1.2, 1.1, 1.7, 'front', { w: 0.6, h: 0.6 });
  roofGable(f, 4, 3.4, 2.6, 0x4a5a3a, 0x7a6a4a, 0.4);
  f.col(-2.3, -1.4, -2, 2.3, 0, 2.6, { surface: 'wood' });
  f.col(-2, 0, -1.7, 2, 4.4, 1.7);
  const lp = f.p(-1.2, 1.9, 2.2);
  f.box(-1.35, 1.7, 2.05, -1.05, 2.1, 2.35, 0xb0c8ff, { emit: 1, vary: 0 });
  B.glow(lp[0], lp[1], lp[2], 0x9ab0ff, 1.6, true);
}

export function altar(B, x, z) {
  const y = B.ground(x, z);
  B.box(x - 2.5, y - 0.5, z - 2.5, x + 2.5, y + 0.3, z + 2.5, 0x6a6a72);
  B.box(x - 1.8, y + 0.3, z - 1.8, x + 1.8, y + 0.6, z + 1.8, 0x7a7a84);
  B.box(x - 0.8, y + 0.6, z - 0.8, x + 0.8, y + 1.6, z + 0.8, 0x5a5a64);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const px = x + Math.cos(a) * 2.2, pz = z + Math.sin(a) * 2.2;
    B.box(px - 0.3, y + 0.3, pz - 0.3, px + 0.3, y + 2.4, pz + 0.3, 0x6a6a72);
    B.box(px - 0.32, y + 1.5, pz - 0.32, px + 0.32, y + 1.8, pz + 0.32, 0xb66cff, { emit: 1.9, vary: 0 });
  }
  B.collider(x - 0.8, y - 1, z - 0.8, x + 0.8, y + 1.6, z + 0.8);
  return y + 1.6;
}

export function ancientTree(B, x, z) {
  const y = B.ground(x, z);
  const bark = 0x4a3428, leaf = 0x3a6a3a;
  for (let k = 0; k < 14; k++) {
    const w = 2.2 - k * 0.06;
    B.box(x - w, y + k - 1, z - w, x + w, y + k, z + w, k % 3 === 0 ? shade(bark, 0.9) : bark);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    B.box(x + Math.cos(a) * 2 - 0.6, y - 0.5, z + Math.sin(a) * 2 - 0.6, x + Math.cos(a) * 3.2 + 0.6, y + 0.8, z + Math.sin(a) * 3.2 + 0.6, bark);
  }
  B.cyl(x, z, 2.4, y - 1, y + 14);
  const rng = makeRng(99);
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2, r = rng() * 7, hy = 12 + rng() * 7;
    const s = 2 + rng() * 2.5;
    const c = rng() < 0.3 ? 0x6a4a8a : rng() < 0.5 ? shade(leaf, 1.15) : leaf;
    B.box(x + Math.cos(a) * r - s, y + hy, z + Math.sin(a) * r - s, x + Math.cos(a) * r + s, y + hy + s * 0.9, z + Math.sin(a) * r + s, c, { wind: 0.25, vary: 0.1 });
  }
  for (let i = 0; i < 10; i++) {
    const a = rng() * Math.PI * 2, r = 3 + rng() * 6;
    B.box(x + Math.cos(a) * r - 0.15, y + 10 + rng() * 4, z + Math.sin(a) * r - 0.15, x + Math.cos(a) * r + 0.15, y + 13 + rng() * 2, z + Math.sin(a) * r + 0.15, 0xc070ff, { emit: 1.9, wind: 0.6, vary: 0 });
  }
}

export function mushroom(B, x, z, s = 1, glow = false) {
  const y = B.ground(x, z);
  B.box(x - 0.12 * s, y, z - 0.12 * s, x + 0.12 * s, y + 0.5 * s, z + 0.12 * s, 0xf0e8d8);
  const cap = glow ? 0x4ae0d0 : 0xd83a3a;
  B.box(x - 0.4 * s, y + 0.5 * s, z - 0.4 * s, x + 0.4 * s, y + 0.75 * s, z + 0.4 * s, cap, { emit: glow ? 1 : 0 });
  if (!glow) B.box(x - 0.1 * s, y + 0.75 * s, z - 0.25 * s, x + 0.1 * s, y + 0.77 * s, z - 0.05 * s, 0xffffff);
}

export function signpost(B, x, z, dirs) {
  const y = B.ground(x, z);
  B.box(x - 0.12, y, z - 0.12, x + 0.12, y + 2.4, z + 0.12, 0x6a4428);
  dirs.forEach((d, i) => {
    const yy = y + 1.6 + i * 0.45;
    if (d === 'x') B.box(x - 0.1, yy, z - 0.12, x + 1.4, yy + 0.35, z + 0.12, 0xa07a48);
    else if (d === '-x') B.box(x - 1.4, yy, z - 0.12, x + 0.1, yy + 0.35, z + 0.12, 0xa07a48);
    else if (d === 'z') B.box(x - 0.12, yy, z - 0.1, x + 0.12, yy + 0.35, z + 1.4, 0xa07a48);
    else B.box(x - 0.12, yy, z - 1.4, x + 0.12, yy + 0.35, z + 0.1, 0xa07a48);
  });
  B.cyl(x, z, 0.2, y, y + 2.4);
}

export function scarecrow(B, x, z) {
  const y = B.ground(x, z);
  B.box(x - 0.1, y, z - 0.1, x + 0.1, y + 2.6, z + 0.1, 0x6a4428);
  B.box(x - 1.2, y + 1.8, z - 0.08, x + 1.2, y + 2.0, z + 0.08, 0x6a4428);
  B.box(x - 0.45, y + 1.2, z - 0.25, x + 0.45, y + 2.1, z + 0.25, 0x6a8ac8, { wind: 0.2, windBase: 0.05 });
  B.box(x - 0.3, y + 2.1, z - 0.3, x + 0.3, y + 2.7, z + 0.3, 0xe0c080);
  B.box(x - 0.55, y + 2.7, z - 0.55, x + 0.55, y + 2.8, z + 0.55, 0xd8b860);
  B.box(x - 0.3, y + 2.8, z - 0.3, x + 0.3, y + 3.1, z + 0.3, 0xd8b860);
}

export function coop(B, x, z, rot) {
  const y = B.ground(x, z);
  const f = new Frame(B, x, y, z, rot);
  for (const sx of [-1.5, 1.5]) for (const sz of [-1.2, 1.2]) f.box(sx - 0.12, 0, sz - 0.12, sx + 0.12, 0.8, sz + 0.12, WOOD_D);
  f.box(-1.6, 0.8, -1.3, 1.6, 2.4, 1.3, 0xd8c8a0);
  f.box(-0.35, 0, 1.3, 0.35, 1.2, 1.5, 0x9a7048);
  f.box(-0.3, 1.1, 1.3, 0.3, 1.6, 1.35, 0x1a1008);
  roofGable(f, 3.2, 2.6, 2.4, 0xa84a32, 0xd8c8a0, 0.3);
  f.col(-1.6, -1, -1.3, 1.6, 3.6, 1.3);
}

export function bones(B, x, z) {
  const y = B.ground(x, z);
  const r = makeRng(Math.floor(x * 31 + z * 17));
  for (let i = 0; i < 4; i++) {
    const ox = x + (r() - 0.5) * 3, oz = z + (r() - 0.5) * 3;
    if (r() < 0.5) B.box(ox - 0.5, y, oz - 0.08, ox + 0.5, y + 0.12, oz + 0.08, 0xeae4d4);
    else B.box(ox - 0.08, y, oz - 0.5, ox + 0.08, y + 0.12, oz + 0.5, 0xeae4d4);
  }
  B.box(x - 0.25, y, z - 0.25, x + 0.25, y + 0.35, z + 0.25, 0xf0ece0);
}

export function flagPole(B, x, z, color) {
  const y = B.ground(x, z);
  B.box(x - 0.08, y, z - 0.08, x + 0.08, y + 4, z + 0.08, 0x6a4428);
  B.box(x + 0.08, y + 3.0, z - 0.04, x + 1.4, y + 3.8, z + 0.04, color, { wind: 0.5, windBase: 0 });
}

export function pedestal(B, x, z, y) {
  B.box(x - 1.8, y - 0.2, z - 1.8, x + 1.8, y + 0.4, z + 1.8, 0x5a5a6a);
  B.box(x - 1.1, y + 0.4, z - 1.1, x + 1.1, y + 1.3, z + 1.1, 0x6a6a7a);
  B.box(x - 1.2, y + 1.3, z - 1.2, x + 1.2, y + 1.5, z + 1.2, 0xffc85a, { emit: 1.8, vary: 0 });
  B.collider(x - 1.1, y - 1, z - 1.1, x + 1.1, y + 1.5, z + 1.1);
  return y + 1.5;
}

export { hash2 };
