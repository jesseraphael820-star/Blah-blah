// Stepped voxel terrain: heightmap generation, biomes, chunk meshing,
// height texture for GPU grass/water and the pixel-art world map image.
import * as THREE from 'three';
import { WORLD, LOC, RIVER, RIVER_W, ROADS, FIELDS, STREAM, SECRET_CHAMBER } from '../data/world.js';
import { fbm, simplex2, smoothstep, lerp, clamp, distToPolyline, hash2, shade, mixColor } from '../core/utils.js';
import { VoxelBuilder } from '../render/voxel.js';

export const B = { GRASS: 0, FOREST: 1, ROAD: 2, SAND: 3, STONE: 4, SNOW: 5, SOIL: 6, COBBLE: 7, BED: 8, DARK: 9, MEADOW: 10 };
const TOP = {
  [B.GRASS]: 0x6aad42, [B.FOREST]: 0x4c8a34, [B.ROAD]: 0xb38c5c, [B.SAND]: 0xe3d196, [B.STONE]: 0x8d8a86,
  [B.SNOW]: 0xf2f5f8, [B.SOIL]: 0x7a5232, [B.COBBLE]: 0xa49d92, [B.BED]: 0xb8a878, [B.DARK]: 0x4a5e44, [B.MEADOW]: 0x7cbc4a,
};
export const FLAG = { NOTREE: 1, NOGRASS: 2, BUILDING: 4, FIELD: 8 };
const N = WORLD.n, CELL = WORLD.cell, HALF = WORLD.half;

function flatten(h, x, z, cx, cz, r, target, fall = 20) {
  const d = Math.hypot(x - cx, z - cz);
  if (d > r + fall) return h;
  const f = 1 - smoothstep(r, r + fall, d);
  return lerp(h, target, f);
}

export function forestMask(x, z) {
  const f = LOC.forest;
  const d = Math.hypot(x - f.x, z - f.z) * (1 + simplex2(x * 0.012, z * 0.012) * 0.25);
  let m = 1 - smoothstep(f.r * 0.6, f.r, d);
  // scattered groves elsewhere
  const g = fbm(x * 0.02 + 50, z * 0.02 - 30, 3);
  m = Math.max(m, smoothstep(0.28, 0.45, g) * 0.85);
  return m;
}

function inRect(x, z, x0, x1, z0, z1) { return x >= x0 && x <= x1 && z >= z0 && z <= z1; }

function rawHeight(x, z) {
  const se = smoothstep(0, 260, x * 0.6 + z * 0.6);
  let h = 5 + fbm(x * 0.007, z * 0.007, 4) * (5 + se * 6) + fbm(x * 0.03, z * 0.03, 2) * 1.2;
  const mN = fbm(x * 0.012 + 100, z * 0.012, 5);
  const north = smoothstep(-160, -238, z);
  h += north * (22 + mN * 16) + north * Math.abs(simplex2(x * 0.03, z * 0.03)) * 6;
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += smoothstep(272, 316, edge) * (20 + mN * 8);

  // hand designed areas
  h = flatten(h, x, z, LOC.village.x, LOC.village.z, LOC.village.r, LOC.village.h, 24);
  h = flatten(h, x, z, LOC.farm.x, LOC.farm.z, LOC.farm.r, LOC.farm.h, 26);
  h = flatten(h, x, z, LOC.camp.x, LOC.camp.z, LOC.camp.r, LOC.camp.h, 20);
  h = flatten(h, x, z, LOC.tower.x, LOC.tower.z, LOC.tower.r, LOC.tower.h, 40);
  h = flatten(h, x, z, LOC.watchtower.x, LOC.watchtower.z, LOC.watchtower.r, LOC.watchtower.h, 26);
  h = flatten(h, x, z, LOC.ruins.x, LOC.ruins.z, LOC.ruins.r, LOC.ruins.h, 18);
  h = flatten(h, x, z, LOC.forestHeart.x, LOC.forestHeart.z, LOC.forestHeart.r, 5, 14);
  h = flatten(h, x, z, LOC.peakShrine.x, LOC.peakShrine.z, LOC.peakShrine.r, LOC.peakShrine.h, 26);
  h = flatten(h, x, z, LOC.caveEntrance.x, LOC.caveEntrance.z + 4, 7, 9, 12);
  h = flatten(h, x, z, LOC.wolfDen.x, LOC.wolfDen.z, LOC.wolfDen.r, 7, 14);
  h = flatten(h, x, z, LOC.mushroomRing.x, LOC.mushroomRing.z, 7, 5, 10);
  h = flatten(h, x, z, LOC.hermit.x, LOC.hermit.z, 6, 2, 8);

  // waterfall plateau (cliff on the south side)
  const P = LOC.plateau;
  let onPlateau = false;
  if (x > P.x0 - 18 && x < P.x1 + 18 && z > P.z0 - 24 && z <= P.z1) {
    const dx = Math.max(0, P.x0 - x, x - P.x1);
    const dz = Math.max(0, P.z0 - z);
    const f = (1 - smoothstep(0, 18, dx)) * (1 - smoothstep(0, 24, dz));
    h = lerp(h, P.h, f);
    if (dx < 6) { h = Math.max(h, P.h * (1 - dx / 18)); onPlateau = true; }
  }
  if (!onPlateau) {
    // lake
    const L = LOC.lake;
    const ld = Math.hypot(x - L.x, z - L.z);
    const lr = L.r * (1 + simplex2(x * 0.035, z * 0.035) * 0.16);
    if (ld < lr + 18) {
      const target = ld < lr ? -1.2 - 4.5 * Math.sqrt(1 - ld / lr) : 0.6 + (ld - lr) * 0.3;
      h = Math.min(h, target);
    }
    // waterfall pool
    const wp = Math.hypot(x - 112, z - 88 * -1);
    if (wp < 12) h = Math.min(h, wp < 8 ? -2.5 : 0.6 + (wp - 8) * 0.4);
    // farm pond
    const fp = LOC.farmPond, pd = Math.hypot(x - fp.x, z - fp.z);
    if (pd < fp.r + 6) h = Math.min(h, pd < fp.r ? -1.5 - 2 * (1 - pd / fp.r) : 0.6 + (pd - fp.r) * 0.5);
    // river
    const rd = distToPolyline(x, z, RIVER);
    const w = RIVER_W * (1 + simplex2(x * 0.05, z * 0.05) * 0.2);
    if (rd < w + 14) {
      const target = rd < w ? -1.4 - 1.8 * (1 - rd / w) : 0.6 + (rd - w) * 0.35;
      h = Math.min(h, target);
    }
  }
  return h;
}

export class Terrain {
  constructor() {
    this.n = N;
    this.h = new Int16Array(N * N);
    this.biome = new Uint8Array(N * N);
    this.flags = new Uint8Array(N * N);
    this.roadD = new Float32Array(N * N);
  }
  idx(i, j) { return j * N + i; }
  cellI(x) { return Math.floor((x + HALF) / CELL); }
  cellX(i) { return -HALF + (i + 0.5) * CELL; }
  inside(i, j) { return i >= 0 && j >= 0 && i < N && j < N; }

  generate() {
    const hf = new Float32Array(N * N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = this.cellX(i), z = this.cellX(j);
        hf[this.idx(i, j)] = rawHeight(x, z);
        let rd = 99;
        for (const r of ROADS) rd = Math.min(rd, distToPolyline(x, z, r.pts) - r.w);
        this.roadD[this.idx(i, j)] = rd;
      }
    }
    // smooth heights along roads so they are walkable (but never inside rivers)
    const blur = this.boxBlur(hf, 4);
    for (let k = 0; k < N * N; k++) {
      const rd = this.roadD[k];
      if (rd < 3 && hf[k] > 0.5) {
        const f = 1 - smoothstep(0, 3, rd);
        hf[k] = lerp(hf[k], Math.max(blur[k], 0.8), f);
      }
    }
    // secret chamber + stream channel carving
    const S = SECRET_CHAMBER;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = this.cellX(i), z = this.cellX(j), k = this.idx(i, j);
      if (inRect(x, z, STREAM.x0 + 1, STREAM.x1 - 1, STREAM.z0, STREAM.z1)) hf[k] = 14;
      if (inRect(x, z, S.cx0, S.cx1, S.cz0, S.cz1) || inRect(x, z, S.rx0, S.rx1, S.rz0, S.rz1)) hf[k] = 1;
      this.h[k] = Math.round(hf[k]);
    }
    this.assignBiomes();
  }

  boxBlur(src, r) {
    const tmp = new Float32Array(N * N), out = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let s = 0, c = 0;
      for (let k = -r; k <= r; k++) { const ii = clamp(i + k, 0, N - 1); s += src[this.idx(ii, j)]; c++; }
      tmp[this.idx(i, j)] = s / c;
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let s = 0, c = 0;
      for (let k = -r; k <= r; k++) { const jj = clamp(j + k, 0, N - 1); s += tmp[this.idx(i, jj)]; c++; }
      out[this.idx(i, j)] = s / c;
    }
    return out;
  }

  assignBiomes() {
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = this.idx(i, j), x = this.cellX(i), z = this.cellX(j), h = this.h[k];
      let b = B.GRASS;
      const fm = forestMask(x, z);
      if (fm > 0.5) b = B.FOREST;
      if (Math.hypot(x - LOC.forestHeart.x, z - LOC.forestHeart.z) < 40 && fm > 0.4) b = B.DARK;
      if (fbm(x * 0.04, z * 0.04, 2) > 0.35 && b === B.GRASS) b = B.MEADOW;
      // slope -> stone
      let maxDiff = 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj;
        if (this.inside(ii, jj)) maxDiff = Math.max(maxDiff, Math.abs(this.h[this.idx(ii, jj)] - h));
      }
      if (h >= 15 || maxDiff >= 3) b = B.STONE;
      if (h >= 30) b = B.SNOW;
      if (h <= 1) b = h <= -1 ? B.BED : B.SAND;
      if (this.roadD[k] < 0 && h > 0) b = B.ROAD;
      const dv = Math.hypot(x - LOC.plaza.x, z - LOC.plaza.z);
      if (dv < 11) b = B.COBBLE;
      for (const f of FIELDS) if (inRect(x, z, f.x0, f.x1, f.z0, f.z1)) { b = B.SOIL; this.flags[k] |= FLAG.FIELD | FLAG.NOTREE | FLAG.NOGRASS; }
      this.biome[k] = b;
      if (b === B.ROAD || b === B.COBBLE || b === B.SAND || b === B.BED || b === B.STONE || b === B.SNOW) this.flags[k] |= FLAG.NOGRASS;
      if (b === B.ROAD || b === B.COBBLE || h <= 1) this.flags[k] |= FLAG.NOTREE;
      if (this.roadD[k] < 2.5) this.flags[k] |= FLAG.NOTREE;
    }
  }

  // ---------- queries ----------
  heightAt(x, z) {
    const i = this.cellI(x), j = this.cellI(z);
    if (!this.inside(i, j)) return 80;
    return this.h[this.idx(i, j)];
  }
  biomeAt(x, z) {
    const i = this.cellI(x), j = this.cellI(z);
    if (!this.inside(i, j)) return B.STONE;
    return this.biome[this.idx(i, j)];
  }
  flagAt(x, z) {
    const i = this.cellI(x), j = this.cellI(z);
    if (!this.inside(i, j)) return 255;
    return this.flags[this.idx(i, j)];
  }
  markRect(x0, z0, x1, z1, flag) {
    const i0 = this.cellI(x0), i1 = this.cellI(x1), j0 = this.cellI(z0), j1 = this.cellI(z1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (this.inside(i, j)) this.flags[this.idx(i, j)] |= flag;
  }
  setRectHeight(x0, z0, x1, z1, h) {
    const i0 = this.cellI(x0), i1 = this.cellI(x1), j0 = this.cellI(z0), j1 = this.cellI(z1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (this.inside(i, j)) this.h[this.idx(i, j)] = h;
  }
  surface(x, z) {
    const b = this.biomeAt(x, z);
    if (b === B.ROAD || b === B.SOIL) return 'dirt';
    if (b === B.STONE || b === B.COBBLE || b === B.SNOW) return 'stone';
    if (b === B.SAND || b === B.BED) return 'dirt';
    return 'grass';
  }

  // ---------- meshing ----------
  cellTopColor(i, j) {
    const k = this.idx(i, j), b = this.biome[k], h = this.h[k];
    let c = TOP[b];
    const n = hash2(i * 7 + 3, j * 13 + 1);
    if (b === B.GRASS || b === B.FOREST || b === B.MEADOW || b === B.DARK) {
      const big = fbm(i * 0.06, j * 0.06, 2);
      c = shade(c, 0.9 + big * 0.18 + (n - 0.5) * 0.12);
      if (b === B.DARK) c = mixColor(c, 0x5a4a7a, 0.18 + n * 0.1);
    } else if (b === B.SOIL) {
      c = (j % 2 === 0) ? shade(c, 0.85) : shade(c, 1.05);
    } else if (b === B.COBBLE) {
      c = ((i + j) % 2 === 0) ? shade(c, 0.94 + n * 0.1) : shade(c, 1.02 + n * 0.06);
    } else if (b === B.BED) {
      c = shade(c, clamp(1 + h * 0.08, 0.55, 1));
    } else {
      c = shade(c, 0.94 + n * 0.12);
    }
    return c;
  }
  sideColors(b, hTop, y0, y1, isTopBand) {
    if (isTopBand) {
      if (b === B.GRASS || b === B.FOREST || b === B.MEADOW || b === B.DARK) return [shade(TOP[b], 0.8), shade(TOP[b], 0.85)];
      if (b === B.SNOW) return [0xd8dde4, 0xe8ecf0];
    }
    if (b === B.SAND || b === B.BED) return [0xc0ae78, 0xcfbd86];
    const stone = hTop >= 12 || b === B.STONE || b === B.SNOW || b === B.COBBLE;
    if (stone) {
      const n = (Math.floor(y0) % 3) * 0.04;
      return [shade(0x6f6c6a, 0.85 + n), shade(0x86827e, 0.95 + n)];
    }
    return [0x6a4a30, 0x8a6442];
  }

  buildChunk(ci, cj, CH) {
    const vb = new VoxelBuilder();
    const i0 = ci * CH, j0 = cj * CH;
    for (let j = j0; j < j0 + CH; j++) {
      for (let i = i0; i < i0 + CH; i++) {
        const k = this.idx(i, j), h = this.h[k], b = this.biome[k];
        const x0 = -HALF + i * CELL, x1 = x0 + CELL, z0 = -HALF + j * CELL, z1 = z0 + CELL;
        const tc = this.cellTopColor(i, j);
        vb.quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], [0, 1, 0], tc, tc);
        // sides
        const nb = [
          [1, 0, [x1, z1], [x1, z0], [1, 0, 0]],
          [-1, 0, [x0, z0], [x0, z1], [-1, 0, 0]],
          [0, 1, [x0, z1], [x1, z1], [0, 0, 1]],
          [0, -1, [x1, z0], [x0, z0], [0, 0, -1]],
        ];
        for (const [di, dj, a, c, n] of nb) {
          const ii = i + di, jj = j + dj;
          const hn = this.inside(ii, jj) ? this.h[this.idx(ii, jj)] : -10;
          if (hn >= h) continue;
          const band = Math.min(0.4, h - hn);
          const yb = h - band;
          const [cb0, cb1] = this.sideColors(b, h, yb, h, true);
          vb.quad([a[0], yb, a[1]], [c[0], yb, c[1]], [c[0], h, c[1]], [a[0], h, a[1]], n, cb0, cb1);
          if (yb > hn) {
            const [c0, c1] = this.sideColors(b, h, hn, yb, false);
            vb.quad([a[0], hn, a[1]], [c[0], hn, c[1]], [c[0], yb, c[1]], [a[0], yb, a[1]], n, shade(c0, 0.8), c1);
          }
        }
      }
    }
    return vb;
  }

  // RGBA float texture: R height, G grass density, B forest tint
  heightTexture() {
    const data = new Float32Array(N * N * 4);
    for (let k = 0; k < N * N; k++) {
      const b = this.biome[k];
      let g = 0;
      if (!(this.flags[k] & FLAG.NOGRASS)) {
        g = b === B.MEADOW ? 1 : b === B.GRASS ? 0.85 : b === B.FOREST ? 0.6 : b === B.DARK ? 0.5 : 0;
      }
      data[k * 4] = this.h[k];
      data[k * 4 + 1] = g;
      data[k * 4 + 2] = b === B.FOREST ? 0.6 : b === B.DARK ? 1 : b === B.MEADOW ? 0.15 : 0.3;
      data[k * 4 + 3] = 1;
    }
    const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.FloatType);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }

  // Pixel-art map image (1px per cell) with hill shading
  mapCanvas() {
    const cv = document.createElement('canvas');
    cv.width = N; cv.height = N;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = this.idx(i, j), h = this.h[k];
      let c = TOP[this.biome[k]];
      if (this.biome[k] === B.FOREST) c = 0x3f7a2c;
      if (this.biome[k] === B.DARK) c = 0x4a4a62;
      const inStream = this.cellX(i) > STREAM.x0 && this.cellX(i) < STREAM.x1 && this.cellX(j) > STREAM.z0 && this.cellX(j) < STREAM.z1 && h < STREAM.level;
      if (h < 0 || inStream) c = mixColor(0x5ab0e0, 0x1f5a9a, clamp(-h / 6, 0, 1));
      const hw = this.inside(i - 1, j - 1) ? this.h[this.idx(i - 1, j - 1)] : h;
      const sh = clamp(1 + (h - hw) * 0.08, 0.75, 1.2);
      c = shade(c, sh * (0.9 + clamp(h, 0, 40) * 0.006));
      const p = k * 4;
      img.data[p] = (c >> 16) & 255; img.data[p + 1] = (c >> 8) & 255; img.data[p + 2] = c & 255; img.data[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}
