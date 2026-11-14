// Mapas originais + mundo físico: colisão AABB, raycast, linha de visão e navegação em grade (A*).
import * as THREE from '../vendor/three.min.js';
import { mapTexture, labelTexture, skyTexture } from './textures.js';

const HALF = 30, N = 60;
// Bloco: [cx, cz, largura(x), profundidade(z), altura, textura, y0?]
const cont = (cx, cz, rot, tex, stack = 1) => rot ? [cx, cz, 6, 2.5, 2.6 * stack, tex] : [cx, cz, 2.5, 6, 2.6 * stack, tex];

export const MAPS = {
  fundicao: {
    name: 'Fundição', tag: 'Cidade industrial', floor: 'asphalt', wall: 'brickDark',
    sky: ['#3d4a66', '#c98a5a', '#f0c088'], fog: [0xc79a78, 30, 110], sun: [0xffc898, 2.6, [-0.5, 0.7, 0.45]], hemi: [0xcfdcff, 0x8a7060, 1.7],
    A: [-21, -14], B: [21, -14],
    blocks: [
      [-10, 12, 8, 14, 6, 'brick'], [10, 12, 8, 14, 6, 'brickDark'], [0, -2, 12.6, 8, 5, 'metal'], [-10, -8, 8, 10, 6, 'brickDark'], [10, -8, 8, 10, 6, 'brick'],
      [-27, 2, 5, 6, 5, 'metalRust'], [27, 0, 5, 8, 5, 'metalRust'], [-12, -20, 10, 2, 4, 'concrete'], [12, -20, 10, 2, 4, 'concrete'],
      [-10, 12, 2, 2, 7, 'brickDark', 6], [10, -8, 2.4, 2.4, 9, 'brick', 6], [0, -2, 3, 3, 2, 'metalRust', 5],
      [-23, -15, 2, 2, 1.5, 'wood'], [-19, -12, 1.6, 1.6, 1.6, 'wood'], [-20.6, -17.4, 1.4, 1.4, 1.0, 'wood'],
      [24.5, -12, 2.4, 2.4, 1.5, 'wood'], [18.5, -16, 1.6, 1.6, 1.6, 'wood'], [24, -17.5, 1.4, 3, 1.1, 'metalRust'],
      [-22, 10, 2, 3, 1.4, 'wood'], [-18.5, 18, 1.5, 1.5, 1.5, 'wood'], [21, 12, 3, 1.6, 1.4, 'metalRust'], [18.5, 4.5, 1.5, 1.5, 1.5, 'wood'],
      [0, 12, 2, 2, 1.4, 'wood'], [-3.2, 5.5, 1.4, 1.4, 1.2, 'wood'], [3.4, -8.6, 1.6, 1.6, 1.5, 'wood'], [-1, -14.5, 3, 1.2, 1.2, 'concrete'],
      [-22, 10, 1.2, 1.2, 1.0, 'wood', 1.4],
    ],
  },
  bastiao: {
    name: 'Bastião', tag: 'Complexo militar', floor: 'concrete', wall: 'concreteGreen',
    sky: ['#4d7fc4', '#a9c6e8', '#dfe8ee'], fog: [0xc5d3dc, 40, 130], sun: [0xfff4dc, 3.0, [0.45, 0.8, 0.3]], hemi: [0xcfe2ff, 0x7a8070, 1.6],
    A: [-22, -18], B: [22, -18],
    blocks: [
      [-13, 11, 12, 10, 5, 'concreteGreen'], [13, 11, 12, 10, 5, 'concreteGreen'], [-13, -5, 12, 10, 5, 'concreteDark'], [13, -5, 12, 10, 5, 'concreteDark'],
      [0, 3, 4, 4, 8, 'metalGreen'], [0, 3, 5, 5, 0.6, 'concreteDark', 8], [0, -17, 14, 3, 4, 'concreteGreen'],
      [-24, 6, 4, 1, 1.1, 'sandbag'], [24, 2, 4, 1, 1.1, 'sandbag'], [-4.5, 13, 1, 4, 1.1, 'sandbag'], [4.5, -6, 1, 4, 1.1, 'sandbag'],
      [-24, -15.5, 3, 1, 1.1, 'sandbag'], [-19.5, -20, 1, 3, 1.1, 'sandbag'], [-22, -12.5, 2, 2, 1.5, 'metalGreen'],
      [24.5, -15, 1, 3, 1.1, 'sandbag'], [20, -19.5, 3, 1, 1.1, 'sandbag'], [21, -12.5, 2, 2, 1.6, 'metalGreen'],
      [-8, 22, 3, 1, 1.1, 'sandbag'], [8, 21, 1, 3, 1.1, 'sandbag'], [-25.5, 20, 2.4, 5, 2.2, 'metalGreen'], [25.5, -4, 2.4, 5, 2.2, 'metalGreen'],
      [0, 10.5, 2, 2, 1.5, 'wood'], [-1, -9, 1.5, 1.5, 1.5, 'wood'],
    ],
  },
  duna: {
    name: 'Duna', tag: 'Deserto', floor: 'sand', wall: 'sandstone',
    sky: ['#3f8fd8', '#9fd0ee', '#f3e3b8'], fog: [0xe8d4a8, 45, 140], sun: [0xfff0c8, 3.4, [0.3, 0.85, -0.4]], hemi: [0xdfeeff, 0xb08a50, 1.6],
    A: [-22, -16], B: [21, -15],
    blocks: [
      [-18, 14, 8, 8, 4.5, 'sandstone'], [-4, 15, 6, 6, 4, 'sandstone'], [12, 15, 10, 6, 5, 'sandstone'], [-23, -1, 6, 10, 4, 'sandstone'],
      [-9, 0, 8, 6, 5, 'sandstone'], [5, -2, 6, 8, 4.5, 'sandstone'], [20, 1, 8, 6, 4, 'sandstone'], [-11, -13, 6, 6, 4, 'sandstone'], [9, -14, 8, 5, 4.5, 'sandstone'],
      [0, -21, 14, 2, 3, 'sandstone'], [-9, 0, 4, 3, 2, 'plasterYellow', 5], [12, 15, 4, 3, 2.5, 'plasterYellow', 5],
      [-22, -13.5, 2, 2, 1.4, 'wood'], [-25.5, -18, 1.5, 1.5, 1.5, 'wood'], [-18.5, -19.5, 3, 1, 1.1, 'sandbag'],
      [22.5, -12.5, 2, 2, 1.5, 'wood'], [17.5, -17.5, 1.5, 1.5, 1.4, 'wood'], [24.5, -18, 1, 3, 1.1, 'sandbag'],
      [0.5, 7, 2, 2, 1.4, 'wood'], [-16.5, 6, 1.5, 1.5, 1.5, 'wood'], [12, 6.5, 3, 1, 1.1, 'sandbag'], [-1, -9, 1.6, 1.6, 1.5, 'wood'],
      [26.5, 10, 2, 2, 1.5, 'wood'], [-27.5, 9, 1.5, 1.5, 1.4, 'wood'], [3, 23, 3, 1, 1.1, 'sandbag'],
    ],
  },
  cais: {
    name: 'Cais 9', tag: 'Porto', floor: 'tile', wall: 'metal',
    sky: ['#5a7fa8', '#b8cbd8', '#e8e2d4'], fog: [0xc2ccd2, 35, 120], sun: [0xffeedd, 2.8, [-0.4, 0.75, -0.5]], hemi: [0xd0e4ff, 0x758090, 1.6],
    A: [-22, -16], B: [22, -15],
    blocks: [
      [0, 4, 12, 10, 7, 'metal'], [0, 4, 13, 11, 0.5, 'metalRust', 7],
      cont(-13, 17, 0, 'contRed'), cont(-13, 10.5, 0, 'contBlue', 2), cont(-13, -1, 0, 'contGreen'), cont(-13, -7.5, 0, 'contYellow', 2),
      cont(13, 15.5, 0, 'contYellow', 2), cont(13, 4, 0, 'contWhite'), cont(13, -2.5, 0, 'contRed', 2), cont(13, -9, 0, 'contBlue'),
      cont(-6, -14, 1, 'contRed'), cont(7, -17, 1, 'contBlue', 2), cont(-24, -11.5, 1, 'contGreen'), cont(-18.5, -19.5, 0, 'contYellow'),
      cont(24, -10.5, 1, 'contWhite'), cont(18.5, -18.5, 0, 'contRed', 2), cont(-22, 12, 0, 'contBlue', 2), cont(-25.5, 2, 1, 'contYellow'),
      cont(22, 8, 0, 'contGreen'), cont(25.5, -3, 1, 'contRed', 2), cont(-4, 20.5, 1, 'contWhite'), cont(7, 23.5, 1, 'contBlue'),
      [-25, -15.5, 1.6, 1.6, 1.5, 'wood'], [25, -14.5, 1.6, 1.6, 1.5, 'wood'], [0, -5, 2, 2, 1.4, 'wood'], [-8.5, 4, 1.5, 1.5, 1.5, 'wood'], [8.8, 10, 1.5, 1.5, 1.5, 'wood'],
      [28, 22, 1.5, 1.5, 16, 'metalRust'], [-28, -24, 1.5, 1.5, 16, 'metalRust'], [0, -9.5, 1.4, 1.4, 1.2, 'wood'],
    ],
  },
  distrito: {
    name: 'Distrito', tag: 'Instalação urbana', floor: 'asphalt', wall: 'concreteDark',
    sky: ['#1b2540', '#4a4f78', '#d08a6a'], fog: [0x6a6480, 28, 105], sun: [0xffb48a, 2.2, [0.6, 0.45, 0.5]], hemi: [0xb8c4ff, 0x685868, 1.9],
    A: [-20, -16], B: [20, -16],
    lamps: [[-22, 8.5], [22, 8.5], [-4.6, -9], [4.6, 19], [-14, -21], [14, -21]],
    blocks: [
      [-17, 13, 10, 10, 8, 'plaster'], [0, 13, 10, 8, 7, 'plasterBlue'], [17, 13, 10, 10, 9, 'plasterRed'], [-17, -3, 10, 8, 7, 'plasterYellow'],
      [0, -2, 10, 8, 10, 'concreteDark'], [17, -3, 10, 8, 8, 'plaster'], [-8, -17, 6, 6, 6, 'plasterRed'], [8, -17, 6, 6, 6, 'plasterBlue'],
      [-25.5, 5, 2, 4.4, 1.4, 'contRed'], [8.5, 5, 4.4, 2, 1.4, 'contBlue'], [25.5, -10, 2, 4.4, 1.4, 'contWhite'], [-9, 21, 4.4, 2, 1.4, 'contYellow'],
      [-21, -13.5, 2, 2, 1.5, 'wood'], [-23.5, -18.5, 1.5, 1.5, 1.5, 'wood'], [-18, -19.5, 3, 1, 1.1, 'concrete'],
      [21.5, -13.5, 2, 2, 1.5, 'wood'], [17.5, -18, 1.5, 1.5, 1.5, 'wood'], [24, -18.5, 1, 3, 1.1, 'concrete'],
      [0, -10.5, 3, 1, 1.1, 'concrete'], [-8.5, 4.5, 1.5, 1.5, 1.5, 'wood'], [26, 20, 1.6, 1.6, 1.5, 'wood'], [8, 22, 2, 4.4, 1.4, 'contRed'],
    ],
  },
};
export const MAP_ORDER = ['fundicao', 'bastiao', 'duna', 'cais', 'distrito'];
export const QUALITY = {
  baixo: { name: 'Baixo', pr: 0.6, shadow: 0, fx: 0.5, decals: 20 },
  medio: { name: 'Médio', pr: 0.85, shadow: 1024, fx: 0.8, decals: 40 },
  alto:  { name: 'Alto', pr: 1.25, shadow: 2048, fx: 1, decals: 70, lights: true },
  ultra: { name: 'Ultra', pr: 2, shadow: 4096, fx: 1.4, decals: 120, lights: true, soft: true },
};

const UNIT_UV = new Set(['wood']);
const TEX_SCALE = { plaster: 5, plasterBlue: 5, plasterRed: 5, plasterYellow: 5, contRed: 2.6, contBlue: 2.6, contGreen: 2.6, contYellow: 2.6, contWhite: 2.6, sandbag: 1.1, sandstone: 2.5 };

export class World {
  constructor(mapId) {
    this.id = mapId; this.def = MAPS[mapId]; this.boxes = [];
    const add = (cx, cz, w, d, h, tex, y0 = 0) => this.boxes.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, y0, y1: y0 + h, tex });
    const W = this.def.wall;
    add(0, -HALF - 0.5, 2 * HALF + 2, 1, 7, W); add(0, HALF + 0.5, 2 * HALF + 2, 1, 7, W); add(-HALF - 0.5, 0, 1, 2 * HALF, 7, W); add(HALF + 0.5, 0, 1, 2 * HALF, 7, W);
    for (const b of this.def.blocks) add(...b);
    for (const [x, z] of this.def.lamps || []) add(x, z, 0.25, 0.25, 5, 'metal');
    this.sites = { A: { x: this.def.A[0], z: this.def.A[1], r: 5 }, B: { x: this.def.B[0], z: this.def.B[1], r: 5 } };
    this.spawns = { T: [-6, -3, 0, 3, 6].map(x => ({ x, z: 26.5, yaw: 0 })), CT: [-6, -3, 0, 3, 6].map(x => ({ x, z: -26.5, yaw: Math.PI })) };
    this.smokes = []; // {x,y,z,r}
    this.buildNav();
  }

  // ---------- Navegação ----------
  buildNav() {
    const bl = this.blocked = new Uint8Array(N * N), m = 0.45;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = i - HALF + 0.5, z = j - HALF + 0.5;
      for (const b of this.boxes) if (b.y0 < 1.7 && b.y1 > 0.5 && x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m) { bl[i + j * N] = 1; break; }
    }
    this.free = []; for (let k = 0; k < N * N; k++) if (!bl[k]) this.free.push(k);
    this.g = new Float32Array(N * N); this.from = new Int32Array(N * N); this.stamp = new Uint32Array(N * N); this.closed = new Uint32Array(N * N); this.tick = 0;
  }
  cell(x, z) { const i = Math.floor(x + HALF), j = Math.floor(z + HALF); return i < 0 || j < 0 || i >= N || j >= N ? -1 : i + j * N; }
  cellPos(k) { return { x: (k % N) - HALF + 0.5, z: Math.floor(k / N) - HALF + 0.5 }; }
  isFree(x, z) { const k = this.cell(x, z); return k >= 0 && !this.blocked[k]; }
  nearestFree(x, z) {
    const k = this.cell(Math.max(-HALF + 0.5, Math.min(HALF - 0.5, x)), Math.max(-HALF + 0.5, Math.min(HALF - 0.5, z)));
    if (!this.blocked[k]) return k;
    const i0 = k % N, j0 = Math.floor(k / N);
    for (let r = 1; r < 8; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= N || j >= N) continue;
      if (!this.blocked[i + j * N]) return i + j * N;
    }
    return k;
  }
  randomPoint(rnd = Math.random) { return this.cellPos(this.free[Math.floor(rnd() * this.free.length)]); }
  pointNear(x, z, r, rnd = Math.random) {
    for (let t = 0; t < 12; t++) { const a = rnd() * 6.283, d = rnd() * r, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (this.isFree(px, pz)) return { x: px, z: pz }; }
    return this.cellPos(this.nearestFree(x, z));
  }
  walkable(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, n = Math.ceil(Math.hypot(dx, dz) / 0.4);
    for (let i = 1; i <= n; i++) if (!this.isFree(ax + dx * i / n, az + dz * i / n)) return false;
    return true;
  }
  findPath(ax, az, bx, bz) {
    const s = this.nearestFree(ax, az), e = this.nearestFree(bx, bz);
    if (s === e) return [{ x: bx, z: bz }];
    const { g, from, stamp, closed, blocked } = this, T = ++this.tick, ei = e % N, ej = Math.floor(e / N);
    const heap = [], hs = [];
    const push = (k, f) => { let i = heap.length; heap.push(k); hs.push(f); while (i > 0) { const p = (i - 1) >> 1; if (hs[p] <= f) break; heap[i] = heap[p]; hs[i] = hs[p]; i = p; } heap[i] = k; hs[i] = f; };
    const pop = () => { const top = heap[0], k = heap.pop(), f = hs.pop(), n = heap.length; if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && hs[c + 1] < hs[c]) c++; if (hs[c] >= f) break; heap[i] = heap[c]; hs[i] = hs[c]; i = c; } heap[i] = k; hs[i] = f; } return top; };
    const h = k => { const dx = Math.abs(k % N - ei), dz = Math.abs(Math.floor(k / N) - ej); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    g[s] = 0; stamp[s] = T; from[s] = -1; push(s, h(s));
    let found = false;
    while (heap.length) {
      const k = pop(); if (closed[k] === T) continue; closed[k] = T;
      if (k === e) { found = true; break; }
      const i = k % N, j = (k - i) / N;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const nk = ni + nj * N; if (blocked[nk] || closed[nk] === T) continue;
        if (di && dj && (blocked[i + di + j * N] || blocked[i + nj * N])) continue;
        const ng = g[k] + (di && dj ? 1.414 : 1);
        if (stamp[nk] !== T || ng < g[nk]) { g[nk] = ng; stamp[nk] = T; from[nk] = k; push(nk, ng + h(nk)); }
      }
    }
    if (!found) return null;
    const raw = []; for (let k = e; k !== -1; k = from[k]) raw.push(this.cellPos(k)); raw.reverse();
    if (this.isFree(bx, bz)) raw[raw.length - 1] = { x: bx, z: bz };
    // suavização (string pulling)
    const out = []; let cur = { x: ax, z: az }, i = 0;
    while (i < raw.length) { let j = raw.length - 1; while (j > i && !this.walkable(cur.x, cur.z, raw[j].x, raw[j].z)) j--; out.push(raw[j]); cur = raw[j]; i = j + 1; }
    return out;
  }
  // Ponto próximo de `pos` sem linha de visão para `threat`.
  coverFrom(pos, threat, maxR = 9) {
    let best = null, bd = 1e9;
    const i0 = Math.floor(pos.x + HALF), j0 = Math.floor(pos.z + HALF), R = Math.ceil(maxR);
    for (let di = -R; di <= R; di++) for (let dj = -R; dj <= R; dj++) {
      const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= N || j >= N || this.blocked[i + j * N]) continue;
      const d = di * di + dj * dj; if (d >= bd || d > maxR * maxR) continue;
      const x = i - HALF + 0.5, z = j - HALF + 0.5;
      if (!this.los(x, 1.3, z, threat.x, threat.y + 1.5, threat.z, true)) { bd = d; best = { x, z }; }
    }
    return best;
  }

  // ---------- Raycast ----------
  raycast(ox, oy, oz, dx, dy, dz, max = 200) {
    let best = max, nx = 0, ny = 0, nz = 0, hit = false;
    if (dy < -1e-6) { const t = -oy / dy; if (t > 0 && t < best) { best = t; nx = 0; ny = 1; nz = 0; hit = true; } }
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
    for (const b of this.boxes) {
      let t1 = (b.x0 - ox) * ix, t2 = (b.x1 - ox) * ix, tmin = Math.min(t1, t2), tmax = Math.max(t1, t2), ax = 0;
      t1 = (b.y0 - oy) * iy; t2 = (b.y1 - oy) * iy; let a = Math.min(t1, t2); if (a > tmin) { tmin = a; ax = 1; } tmax = Math.min(tmax, Math.max(t1, t2));
      t1 = (b.z0 - oz) * iz; t2 = (b.z1 - oz) * iz; a = Math.min(t1, t2); if (a > tmin) { tmin = a; ax = 2; } tmax = Math.min(tmax, Math.max(t1, t2));
      if (tmax >= tmin && tmin > 0 && tmin < best) { best = tmin; hit = true; nx = ax === 0 ? -Math.sign(dx) : 0; ny = ax === 1 ? -Math.sign(dy) : 0; nz = ax === 2 ? -Math.sign(dz) : 0; }
    }
    return hit ? { t: best, nx, ny, nz } : null;
  }
  los(ax, ay, az, bx, by, bz, ignoreSmoke = false) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz); if (d < 0.01) return true;
    const h = this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d);
    if (h && h.t < d - 0.05) return false;
    if (!ignoreSmoke) for (const s of this.smokes) {
      const t = Math.max(0, Math.min(1, ((s.x - ax) * dx + (s.y - ay) * dy + (s.z - az) * dz) / (d * d)));
      if (Math.hypot(ax + dx * t - s.x, ay + dy * t - s.y, az + dz * t - s.z) < s.r) return false;
    }
    return true;
  }

  // ---------- Movimento com colisão ----------
  move(e, dt) {
    const p = e.pos, v = e.vel, r = e.radius, h = e.height, B = this.boxes;
    for (let axis = 0; axis < 2; axis++) {
      const d = (axis ? v.z : v.x) * dt; if (!d) continue;
      if (axis) p.z += d; else p.x += d;
      for (const b of B) {
        if (p.x + r <= b.x0 || p.x - r >= b.x1 || p.z + r <= b.z0 || p.z - r >= b.z1 || p.y + h <= b.y0 || p.y + 0.02 >= b.y1) continue;
        if (e.onGround && b.y1 - p.y <= 0.45) { p.y = b.y1; continue; } // degrau
        if (axis) { p.z = d > 0 ? b.z0 - r : b.z1 + r; v.z = 0; } else { p.x = d > 0 ? b.x0 - r : b.x1 + r; v.x = 0; }
      }
    }
    const oldY = p.y; v.y -= 16 * dt; p.y += v.y * dt; e.onGround = false;
    const rr = r - 0.01;
    for (const b of B) {
      if (p.x + rr <= b.x0 || p.x - rr >= b.x1 || p.z + rr <= b.z0 || p.z - rr >= b.z1 || p.y + h <= b.y0 || p.y >= b.y1) continue;
      if (v.y <= 0 && oldY >= b.y1 - 0.06) { p.y = b.y1; v.y = 0; e.onGround = true; }
      else if (v.y > 0 && oldY + h <= b.y0 + 0.06) { p.y = b.y0 - h; v.y = 0; }
    }
    if (p.y <= 0) { p.y = 0; v.y = 0; e.onGround = true; }
  }

  // ---------- Cena ----------
  buildScene(scene, q) {
    const def = this.def, groups = {};
    const face = (G, a, b, c, d, n, uv) => { const i = G.pos.length / 3; G.pos.push(...a, ...b, ...c, ...d); for (let k = 0; k < 4; k++) G.nor.push(...n); G.uv.push(...uv); G.idx.push(i, i + 1, i + 2, i, i + 2, i + 3); };
    for (const b of this.boxes) {
      const G = groups[b.tex] ||= { pos: [], nor: [], uv: [], idx: [] }, { x0, x1, y0, y1, z0, z1 } = b, unit = UNIT_UV.has(b.tex), s = TEX_SCALE[b.tex] || 3;
      const U = (u0, u1, v0, v1) => unit ? [0, 0, 1, 0, 1, 1, 0, 1] : [u0 / s, v0 / s, u1 / s, v0 / s, u1 / s, v1 / s, u0 / s, v1 / s];
      face(G, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], U(x0, x1, y0, y1));
      face(G, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], U(-x1, -x0, y0, y1));
      face(G, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], U(-z1, -z0, y0, y1));
      face(G, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], U(z0, z1, y0, y1));
      if (y1 < 12) face(G, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], U(x0, x1, -z1, -z0));
      if (y0 > 0) face(G, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], U(x0, x1, z0, z1));
    }
    const root = new THREE.Group();
    for (const t in groups) {
      const G = groups[t], geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(G.pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(G.nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(G.uv, 2)); geo.setIndex(G.idx);
      const metal = t.startsWith('metal') || t.startsWith('cont');
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: mapTexture(t), roughness: metal ? 0.55 : 0.92, metalness: metal ? 0.35 : 0 }));
      mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    }
    const ft = mapTexture(def.floor).clone(); ft.needsUpdate = true; ft.repeat.set(26, 26);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF + 2, 2 * HALF + 2), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; root.add(floor);
    const out = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ color: def.fog[0] })); out.rotation.x = -Math.PI / 2; out.position.y = -0.05; root.add(out);
    for (const k of ['A', 'B']) {
      const s = this.sites[k], m = new THREE.Mesh(new THREE.PlaneGeometry(s.r * 1.7, s.r * 1.7), new THREE.MeshBasicMaterial({ map: labelTexture(k), transparent: true, depthWrite: false, opacity: 0.8 }));
      m.rotation.x = -Math.PI / 2; m.position.set(s.x, 0.03, s.z); root.add(m);
    }
    const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 16, 12), new THREE.MeshBasicMaterial({ map: skyTexture(...def.sky), side: THREE.BackSide, fog: false, depthWrite: false })); root.add(sky);
    scene.fog = new THREE.Fog(def.fog[0], def.fog[1], def.fog[2]); scene.background = new THREE.Color(def.fog[0]);
    root.add(new THREE.HemisphereLight(def.hemi[0], def.hemi[1], def.hemi[2]));
    const sun = new THREE.DirectionalLight(def.sun[0], def.sun[1]); sun.position.set(def.sun[2][0] * 70, def.sun[2][1] * 70, def.sun[2][2] * 70);
    if (q.shadow) {
      sun.castShadow = true; sun.shadow.mapSize.set(q.shadow, q.shadow);
      const c = sun.shadow.camera; c.left = c.bottom = -44; c.right = c.top = 44; c.near = 5; c.far = 160; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    }
    root.add(sun, sun.target);
    for (const [x, z] of def.lamps || []) {
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.6), new THREE.MeshBasicMaterial({ color: 0xffe2a8 })); bulb.position.set(x, 5.05, z); root.add(bulb);
      if (q.lights) { const pl = new THREE.PointLight(0xffc880, 40, 16, 1.8); pl.position.set(x, 4.6, z); root.add(pl); }
    }
    scene.add(root); this.root = root;
    return root;
  }
  // Imagem de radar (vista de cima)
  radarImage(size = 160) {
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), s = size / (2 * HALF);
    g.fillStyle = 'rgba(12,18,24,.82)'; g.fillRect(0, 0, size, size);
    for (const b of this.boxes) { if (b.y0 > 0.5) continue; g.fillStyle = b.y1 > 2 ? 'rgba(150,165,180,.85)' : 'rgba(110,120,130,.7)'; g.fillRect((b.x0 + HALF) * s, (b.z0 + HALF) * s, (b.x1 - b.x0) * s, (b.z1 - b.z0) * s); }
    g.font = `bold ${size / 9}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,210,61,.9)';
    for (const k of ['A', 'B']) g.fillText(k, (this.sites[k].x + HALF) * s, (this.sites[k].z + HALF) * s);
    return c;
  }
}
export const WORLD_HALF = HALF;
