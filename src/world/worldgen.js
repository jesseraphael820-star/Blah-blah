// Places every static structure, prop and plant in the overworld.
import { G } from '../core/context.js';
import { LOC, ROADS, RIVER, RIVER_W, WAYSTONES, CHESTS, ORES, GLOWSHROOMS, HERBS, FIELDS, WORLD } from '../data/world.js';
import { makeRng, distToPolyline, shade, simplex2, hash2 } from '../core/utils.js';
import { FLAG, B as BIOME, forestMask } from './terrain.js';
import * as S from './structures.js';

// ---------------- vegetation ----------------
function oak(B, x, z, s, rng, palette) {
  const y = B.ground(x, z);
  const th = (2.6 + rng() * 1.4) * s, tw = 0.45 * s;
  B.box(x - tw, y - 0.5, z - tw, x + tw, y + th, z + tw, palette.trunk, { windBase: 0, wind: 0.08 });
  const leaves = palette.leaves;
  const n = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const r = (1.3 + rng() * 0.9) * s;
    const ox = (rng() - 0.5) * 1.8 * s, oz = (rng() - 0.5) * 1.8 * s, oy = th - 0.4 + rng() * 1.4 * s;
    const c = leaves[Math.floor(rng() * leaves.length)];
    B.box(x + ox - r, y + oy, z + oz - r, x + ox + r, y + oy + r * 1.3, z + oz + r, c, { wind: 0.55, windBase: 0.35, vary: 0.05 });
  }
  if (palette.fruit) for (let i = 0; i < 4; i++) {
    const a = rng() * 6.28, rr = 1.3 * s;
    B.box(x + Math.cos(a) * rr - 0.15, y + th + 0.3 + rng(), z + Math.sin(a) * rr - 0.15, x + Math.cos(a) * rr + 0.15, y + th + 0.6 + rng(), z + Math.sin(a) * rr + 0.15, palette.fruit, { wind: 0.5 });
  }
  B.cyl(x, z, tw + 0.15, y - 1, y + th + 1);
}
function pine(B, x, z, s, rng, snow) {
  const y = B.ground(x, z);
  const th = (1.6 + rng()) * s, tw = 0.35 * s;
  B.box(x - tw, y - 0.5, z - tw, x + tw, y + th + 1, z + tw, 0x5a3a24, { wind: 0.05, windBase: 0 });
  const tiers = 4 + Math.floor(rng() * 2);
  const green = rng() < 0.5 ? 0x2f6a3a : 0x3a7a44;
  for (let k = 0; k < tiers; k++) {
    const r = (2.0 - k * 0.38) * s;
    const yy = y + th + k * 1.25 * s;
    B.box(x - r, yy, z - r, x + r, yy + 1.35 * s, z + r, k % 2 ? shade(green, 1.1) : green, { wind: 0.25 + k * 0.1, windBase: 0.15 + k * 0.1, vary: 0.05 });
    if (snow) B.box(x - r * 0.7, yy + 1.35 * s, z - r * 0.7, x + r * 0.7, yy + 1.45 * s, z + r * 0.7, 0xf4f8fc, { wind: 0.3 + k * 0.1 });
  }
  B.box(x - 0.3 * s, y + th + tiers * 1.25 * s, z - 0.3 * s, x + 0.3 * s, y + th + tiers * 1.25 * s + 0.8 * s, z + 0.3 * s, green, { wind: 0.7 });
  B.cyl(x, z, tw + 0.15, y - 1, y + th + 4);
}
function birch(B, x, z, s, rng) {
  const y = B.ground(x, z);
  const th = (3.5 + rng() * 1.5) * s, tw = 0.3 * s;
  B.box(x - tw, y - 0.5, z - tw, x + tw, y + th, z + tw, 0xe8e4dc, { wind: 0.1, windBase: 0 });
  for (let k = 0; k < 4; k++) B.box(x - tw - 0.02, y + 0.6 + k * th * 0.22, z - tw - 0.02, x + tw + 0.02, y + 0.8 + k * th * 0.22, z + tw * 0.2, 0x2a2a2a);
  for (let i = 0; i < 4; i++) {
    const r = (0.9 + rng() * 0.6) * s;
    const ox = (rng() - 0.5) * 1.4 * s, oz = (rng() - 0.5) * 1.4 * s, oy = th - 1 + rng() * 2 * s;
    B.box(x + ox - r, y + oy, z + oz - r, x + ox + r, y + oy + r * 1.4, z + oz + r, rng() < 0.5 ? 0x9ad05a : 0x86c24a, { wind: 0.7, windBase: 0.45 });
  }
  B.cyl(x, z, tw + 0.15, y - 1, y + th + 1);
}
function mystic(B, x, z, s, rng) {
  const y = B.ground(x, z);
  const th = (3 + rng() * 2) * s, tw = 0.55 * s;
  B.box(x - tw, y - 0.5, z - tw, x + tw, y + th, z + tw, 0x3a2a34, { wind: 0.05, windBase: 0 });
  B.box(x - tw * 2, y - 0.5, z - tw * 0.6, x + tw * 2, y + 0.6, z + tw * 0.6, 0x3a2a34);
  for (let i = 0; i < 5; i++) {
    const r = (1.2 + rng() * 1.1) * s;
    const ox = (rng() - 0.5) * 2.4 * s, oz = (rng() - 0.5) * 2.4 * s, oy = th - 0.5 + rng() * 1.8 * s;
    const c = rng() < 0.4 ? 0x5a4a8a : rng() < 0.5 ? 0x2a5a4a : 0x3a4a6a;
    B.box(x + ox - r, y + oy, z + oz - r, x + ox + r, y + oy + r * 1.2, z + oz + r, c, { wind: 0.45, windBase: 0.3 });
  }
  if (rng() < 0.5) B.box(x - 0.12, y + th + 0.3, z + 1.4 * s, x + 0.12, y + th + 0.9, z + 1.6 * s, 0x6affd8, { emit: 1.9, wind: 0.6 });
  B.cyl(x, z, tw + 0.15, y - 1, y + th + 1);
}
function bush(B, x, z, s, color, rng, berries) {
  const y = B.ground(x, z);
  B.box(x - 0.8 * s, y - 0.1, z - 0.7 * s, x + 0.8 * s, y + 0.9 * s, z + 0.7 * s, color, { wind: 0.35, windBase: 0.05 });
  B.box(x - 0.5 * s + rng() * 0.2, y + 0.6 * s, z - 0.4 * s, x + 0.4 * s, y + 1.25 * s, z + 0.5 * s, shade(color, 1.1), { wind: 0.45, windBase: 0.2 });
  if (berries) for (let i = 0; i < 3; i++) B.box(x + (rng() - 0.5) * 1.2 * s, y + 0.6 + rng() * 0.4, z + 0.68 * s, x + (rng() - 0.5) * 1.2 * s + 0.15, y + 0.75 + rng() * 0.4, z + 0.76 * s, berries, { wind: 0.4 });
}
const FLOWER = [0xf04a5a, 0xf0d040, 0xf0f0f0, 0xb070f0, 0x5aa0f0, 0xff8a3a];
function flowers(B, x, z, rng) {
  const y = B.ground(x, z);
  const c = FLOWER[Math.floor(rng() * FLOWER.length)];
  const n = 2 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const ox = x + (rng() - 0.5) * 1.6, oz = z + (rng() - 0.5) * 1.6;
    const h = 0.25 + rng() * 0.3;
    B.box(ox - 0.03, y, oz - 0.03, ox + 0.03, y + h, oz + 0.03, 0x3a8a2a, { wind: 0.4, windBase: 0, vary: 0 });
    B.box(ox - 0.11, y + h, oz - 0.11, ox + 0.11, y + h + 0.16, oz + 0.11, c, { wind: 0.5, windBase: 0.4, vary: 0.05 });
  }
}
function log(B, x, z, rng) {
  const y = B.ground(x, z);
  if (rng() < 0.5) B.box(x - 1.8, y - 0.1, z - 0.4, x + 1.8, y + 0.7, z + 0.4, 0x5a3c26, { topColor: 0x6a8a3a });
  else B.box(x - 0.4, y - 0.1, z - 1.8, x + 0.4, y + 0.7, z + 1.8, 0x5a3c26, { topColor: 0x6a8a3a });
  B.cyl(x, z, 0.8, y, y + 0.7);
}

const OAK = { trunk: 0x6a4428, leaves: [0x4f9a3a, 0x5aa840, 0x44883a] };
const FRUIT = { trunk: 0x6a4428, leaves: [0x5aa840, 0x4f9a3a], fruit: 0xe03a2a };
const AUTUMN = { trunk: 0x5a3a24, leaves: [0xe08a2a, 0xd05a2a, 0xe0b03a, 0xc04a2a] };
const FOREST_OAK = { trunk: 0x4a3020, leaves: [0x3a7a30, 0x2f6a2a, 0x447a34] };

// ---------------- crops ----------------
function crops(B, f) {
  for (let x = f.x0 + 1; x < f.x1 - 0.5; x += 2) {
    for (let z = f.z0 + 1; z < f.z1 - 0.5; z += 2) {
      const y = B.ground(x, z);
      if (f.crop === 'wheat') {
        for (let k = 0; k < 4; k++) {
          const ox = x - 0.5 + (k % 2) * 0.9, oz = z - 0.5 + Math.floor(k / 2) * 0.9;
          B.box(ox - 0.12, y, oz - 0.12, ox + 0.12, y + 0.9, oz + 0.12, 0xc8b048, { wind: 0.6, windBase: 0, topColor: 0xe8d070 });
        }
      } else if (f.crop === 'corn') {
        B.box(x - 0.12, y, z - 0.12, x + 0.12, y + 2.2, z + 0.12, 0x5a9a3a, { wind: 0.5, windBase: 0 });
        B.box(x - 0.5, y + 1.2, z - 0.06, x + 0.5, y + 1.32, z + 0.06, 0x6aaa44, { wind: 0.5, windBase: 0.2 });
        B.box(x + 0.1, y + 1.4, z - 0.12, x + 0.3, y + 1.8, z + 0.12, 0xf0d040, { wind: 0.5, windBase: 0.3 });
      } else if (f.crop === 'pumpkin') {
        if ((Math.round(x + z) % 4) === 0) {
          B.box(x - 0.5, y, z - 0.5, x + 0.5, y + 0.75, z + 0.5, 0xe08a1a, { topColor: 0xf09a2a });
          B.box(x - 0.08, y + 0.75, z - 0.08, x + 0.08, y + 1, z + 0.08, 0x3a6a2a);
        } else B.box(x - 0.6, y, z - 0.15, x + 0.6, y + 0.2, z + 0.15, 0x4a8a2a, { wind: 0.2 });
      } else {
        B.box(x - 0.25, y, z - 0.25, x + 0.25, y + 0.35, z + 0.25, 0x5aaa3a, { wind: 0.4, windBase: 0 });
        B.box(x - 0.1, y - 0.05, z - 0.1, x + 0.1, y + 0.05, z + 0.1, 0xf07a2a);
      }
    }
  }
}

// ---------------- main placement ----------------
export function generateWorld(W) {
  const B = W;
  const rng = makeRng(2024);
  const T = W.terrain;

  // ===== VILLAGE (Vila Aurora) =====
  S.house(B, 6, 22, 0, { w: 10, d: 8, roof: 0x6a4a8a, wall: 0xe8dcc0, sign: 0x6a4a8a });          // elder Tomás
  S.house(B, 5, 42, 3, { w: 8, d: 7, roof: 0xd0609a, wall: 0xf4e6d4, sign: 0xe07ab0 });          // tailor Lia
  S.house(B, 34, 72, 2, { w: 12, d: 9, floors: 2, roof: 0x8a4a2a, wall: 0xe4d2ac, sign: 0x3a8a6a }); // inn Rosa
  S.house(B, 60, 66, 2, { w: 8, d: 7, floors: 2, roof: 0x2a4a8a, wall: 0xdcd4c4, sign: 0x2a4a8a }); // library Ísis
  S.house(B, 62, 84, 2, { w: 7, d: 6, roof: 0xc0802a });                                          // Pedrinho
  S.house(B, 14, 86, 2, { w: 8, d: 6, roof: 0xa84a32 });
  S.house(B, 76, 44, 1, { w: 7, d: 6, roof: 0x4a7a4a });
  S.house(B, 12, 4, 0, { w: 8, d: 7, roof: 0x8a5a3a });
  S.house(B, 48, 88, 2, { w: 7, d: 6, roof: 0x7a3a5a });
  S.house(B, 82, 22, 1, { w: 8, d: 7, roof: 0xa86a3a });
  S.forge(B, 56, 32, 0);
  S.well(B, 30, 40);
  S.guardTower(B, 40, 8);
  S.stall(B, 20, 31, 0, 0xd04a3a);
  S.stall(B, 41, 31, 0, 0x3a7ad0, [0xf0e0a0, 0xa0d060, 0xe07030]);
  S.stall(B, 18, 51, 3, 0xe0b030, [0xf04a8a, 0xf0d040, 0xffffff]);
  for (const [x, z] of [[18, 40], [43, 40], [30, 27], [24, 56], [50, 52], [30, 64], [56, 76], [12, 30], [36, 16], [70, 56], [-4, 60]]) S.lampPost(B, x, z);
  for (const [x, z] of [[62, 38], [63, 39.6], [61, 36.6], [28, 80], [40, 80], [72, 72], [-1, 46]]) S.crate(B, x, z, 0.9);
  for (const [x, z] of [[41, 66], [42.2, 67], [27, 66], [66, 30], [-1, 38]]) S.barrel(B, x, z);
  S.flagPole(B, 24, 46, 0xffb22e); S.flagPole(B, 36, 34, 0x3a7ad0);
  S.signpost(B, 22, 24, ['-x', 'z']); S.signpost(B, 46, 58, ['x', 'z']); S.signpost(B, 34, -2, ['-z']);
  // village flower beds + benches
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const x = 30 + Math.cos(a) * 12.5, z = 40 + Math.sin(a) * 12.5;
    if (T.roadD[T.idx(T.cellI(x), T.cellI(z))] < 0.5) continue;
    flowers(B, x, z, rng);
  }
  for (const [x, z, ax] of [[24, 36, 'x'], [36, 36, 'x'], [24, 49, 'x']]) {
    const y = B.ground(x, z);
    B.box(x - 1.1, y + 0.5, z - 0.35, x + 1.1, y + 0.7, z + 0.35, 0x8a6038, { col: true, noCam: true });
    B.box(x - 1, y, z - 0.25, x - 0.8, y + 0.5, z + 0.25, 0x5a3a20); B.box(x + 0.8, y, z - 0.25, x + 1, y + 0.5, z + 0.25, 0x5a3a20);
  }
  // village perimeter fences
  S.fence(B, -16, 6, -16, 18); S.fence(B, 90, 30, 90, 50); S.fence(B, 70, 96, 30, 100);

  // ===== FARM =====
  S.house(B, -58, 100, 2, { w: 9, d: 7, roof: 0xc84a3a, wall: 0xf0e4c8 }); // Marta
  S.barn(B, -96, 70, 0);
  S.windmill(B, -72, 64);
  S.coop(B, -46, 86, 3);
  S.fenceRect(B, -126, 78, -108, 97, [-120, -114]);
  for (const f of FIELDS) crops(B, f);
  S.fenceRect(B, FIELDS[0].x0 - 1, FIELDS[0].z0 - 1, FIELDS[0].x1 + 1, FIELDS[0].z1 + 1, [-88, -80]);
  S.scarecrow(B, -83, 108);
  S.scarecrow(B, -112, 114);
  for (const [x, z] of [[-86, 64], [-84, 61], [-110, 70], [-66, 92]]) S.hay(B, x, z);
  for (const [x, z] of [[-64, 92], [-50, 96], [-52, 97.2]]) S.crate(B, x, z);
  S.barrel(B, -62.5, 95); S.barrel(B, -54, 95.3);
  S.lampPost(B, -70, 92); S.lampPost(B, -90, 82);
  S.signpost(B, -40, 78, ['x', '-x']);
  // cart
  { const x = -80, z = 78, y = B.ground(x, z);
    B.box(x - 1.5, y + 0.6, z - 0.9, x + 1.5, y + 1.4, z + 0.9, 0x8a6038, { col: true });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(x + sx * 1 - 0.35, y, z + sz * 1 - 0.08, x + sx * 1 + 0.35, y + 0.75, z + sz * 1 + 0.08, 0x5a3a20);
    B.box(x - 0.6, y + 1.4, z - 0.7, x + 1.2, y + 1.9, z + 0.7, 0xe0c060); }

  // ===== LAKE =====
  S.pier(B, 76, 92, -12, 1.4);
  S.hut(B, 163, -58, 3);
  { const y = 0.1, x = 94, z = -4; // boat
    B.box(x - 1.6, y - 0.2, z - 0.7, x + 1.6, y + 0.35, z + 0.7, 0x7a5232); B.box(x - 1.2, y + 0.1, z - 0.5, x + 1.2, y + 0.38, z + 0.5, 0x5a3a20); }
  for (let i = 0; i < 30; i++) { // reeds and lily pads
    const a = rng() * Math.PI * 2, r = 40 + rng() * 6;
    const x = LOC.lake.x + Math.cos(a) * r, z = LOC.lake.z + Math.sin(a) * r;
    const y = B.ground(x, z);
    if (y > 1.5 || y < -1) continue;
    for (let k = 0; k < 4; k++) B.box(x + (rng() - 0.5) * 1.5 - 0.04, Math.max(y, -0.5), z + (rng() - 0.5) * 1.5 - 0.04, x + (rng() - 0.5) * 1.5 + 0.04, 0.9 + rng() * 0.6, z + (rng() - 0.5) * 1.5 + 0.04, 0x5a8a3a, { wind: 0.6, windBase: 0 });
  }
  for (let i = 0; i < 18; i++) {
    const a = rng() * Math.PI * 2, r = 20 + rng() * 18;
    const x = LOC.lake.x + Math.cos(a) * r, z = LOC.lake.z + Math.sin(a) * r;
    B.box(x - 0.5, 0.02, z - 0.5, x + 0.5, 0.08, z + 0.5, 0x4a9a3a, { vary: 0.15 });
    if (rng() < 0.3) B.box(x - 0.15, 0.08, z - 0.15, x + 0.15, 0.25, z + 0.15, 0xf0a0c0);
  }

  // ===== CAMP =====
  S.tent(B, 270, 114, 2, 0x8a7a5a); S.tent(B, 252, 115, 2, 0x6a7a4a); S.tent(B, 277, 98, 1, 0x7a5a4a);
  S.campfire(B, 262, 105);
  S.guardTower(B, 243, 87);
  for (const [x, z] of [[268, 96], [269, 97.5]]) S.crate(B, x, z);
  { const x = 256, z = 96, y = B.ground(x, z); // pelt rack
    B.box(x - 1.6, y, z - 0.1, x - 1.4, y + 2.4, z + 0.1, 0x5a3a20); B.box(x + 1.4, y, z - 0.1, x + 1.6, y + 2.4, z + 0.1, 0x5a3a20);
    B.box(x - 1.6, y + 2.2, z - 0.1, x + 1.6, y + 2.4, z + 0.1, 0x5a3a20);
    B.box(x - 1.2, y + 0.9, z - 0.05, x - 0.2, y + 2.2, z + 0.05, 0x9a9a9a, { wind: 0.2, windBase: 0 }); B.box(x + 0.2, y + 1.1, z - 0.05, x + 1.2, y + 2.2, z + 0.05, 0x8a6a4a, { wind: 0.2, windBase: 0 });
    B.collider(x - 1.6, y, z - 0.3, x + 1.6, y + 2.4, z + 0.3); }
  S.flagPole(B, 280, 110, 0x4a6a3a);

  // ===== FOREST HEART =====
  S.ancientTree(B, -205, -96);
  const altarTop = S.altar(B, -205, -84);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; S.mushroom(B, -205 + Math.cos(a) * 7, -84 + Math.sin(a) * 7, 1.2, true); }

  // ===== MUSHROOM RING (secret) =====
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; S.mushroom(B, LOC.mushroomRing.x + Math.cos(a) * 5, LOC.mushroomRing.z + Math.sin(a) * 5, 1.6, i % 2 === 0); }

  // ===== RUINS =====
  const rr = makeRng(5);
  const R = LOC.ruins;
  S.ruinsWall(B, R.x - 22, R.z - 22, R.x + 22, R.z - 22, 5, rr);
  S.ruinsWall(B, R.x - 22, R.z - 22, R.x - 22, R.z + 14, 4, rr);
  S.ruinsWall(B, R.x + 22, R.z - 22, R.x + 22, R.z + 8, 4, rr);
  S.ruinsWall(B, R.x - 22, R.z + 14, R.x - 8, R.z + 14, 3, rr);
  S.ruinsWall(B, R.x + 8, R.z + 14, R.x + 22, R.z + 14, 3, rr);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    S.ruinsColumn(B, R.x + Math.cos(a) * 13, R.z - 6 + Math.sin(a) * 13, 3 + Math.floor(rr() * 3), rr() < 0.5, rr);
  }
  S.statue(B, R.x, R.z - 19);
  { const y = B.ground(R.x, R.z - 6); // arena floor
    for (let i = -6; i <= 6; i++) for (let k = -6; k <= 6; k++) {
      if (i * i + k * k > 40) continue;
      B.box(R.x + i * 1.5 - 0.72, y - 0.3, R.z - 6 + k * 1.5 - 0.72, R.x + i * 1.5 + 0.72, y + 0.08, R.z - 6 + k * 1.5 + 0.72, (i + k) % 2 ? 0xa8a090 : 0x9a9284, { vary: 0.1 });
    } }

  // ===== WOLF DEN =====
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + 0.3; if (i === 2) continue; S.rock(B, LOC.wolfDen.x + Math.cos(a) * 13, LOC.wolfDen.z + Math.sin(a) * 13, 1.6 + rng(), 0x7a7470, rng); }
  S.bones(B, -38, -146); S.bones(B, -44, -152); S.bones(B, -35, -156);

  // ===== PEAK SHRINE =====
  { const x = LOC.peakShrine.x, z = LOC.peakShrine.z - 4, y = B.ground(x, z);
    B.box(x - 2, y - 0.5, z - 1.5, x + 2, y + 0.4, z + 1.5, 0x8a8478);
    for (const sx of [-1.6, 1.6]) B.box(x + sx - 0.2, y + 0.4, z - 0.2, x + sx + 0.2, y + 3.4, z + 0.2, 0xa83a2a);
    B.box(x - 2.4, y + 3.4, z - 0.4, x + 2.4, y + 3.8, z + 0.4, 0xa83a2a);
    B.box(x - 2.0, y + 2.8, z - 0.25, x + 2.0, y + 3.0, z + 0.25, 0xa83a2a);
    B.collider(x - 2, y - 1, z - 1.5, x + 2, y + 0.4, z + 1.5);
    for (let i = 0; i < 6; i++) B.box(x - 5 + i * 2, y + 2, z + 3, x - 4.4 + i * 2, y + 2.6, z + 3.05, FLOWER[i], { wind: 0.6, windBase: 0.3 });
    B.glow(x, y + 1.2, z, 0xffd36a, 2, false); }

  // ===== CAVE ENTRANCE / TOWERS / HUT =====
  S.caveEntrance(B, LOC.caveEntrance.x, LOC.caveEntrance.z - 3);
  W.towerTop = S.oldTower(B, LOC.tower.x, LOC.tower.z);
  W.watchTop = S.watchTower(B, LOC.watchtower.x, LOC.watchtower.z);
  // small camp ruins near tower
  S.ruinsWall(B, -240, 205, -232, 210, 2, rr);
  S.statue(B, -205, 205, 0x8a8490);

  // ===== BRIDGES (auto at road/river crossings) =====
  for (const road of ROADS) {
    const pts = road.pts;
    let run = null;
    const runs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      for (let s = 0; s <= L; s += 0.5) {
        const x = ax + (bx - ax) * (s / L), z = az + (bz - az) * (s / L);
        const inR = distToPolyline(x, z, RIVER) < RIVER_W * 1.25 + 1;
        if (inR) { if (!run) run = []; run.push([x, z]); } else if (run) { runs.push(run); run = null; }
      }
    }
    if (run) runs.push(run);
    for (const r of runs) {
      const [cx, cz] = r[Math.floor(r.length / 2)];
      // river direction near crossing
      let best = 0, bd = Infinity;
      for (let i = 0; i < RIVER.length - 1; i++) {
        const mx = (RIVER[i][0] + RIVER[i + 1][0]) / 2, mz = (RIVER[i][1] + RIVER[i + 1][1]) / 2;
        const d = Math.hypot(mx - cx, mz - cz); if (d < bd) { bd = d; best = i; }
      }
      const rdx = RIVER[best + 1][0] - RIVER[best][0], rdz = RIVER[best + 1][1] - RIVER[best][1];
      const axis = Math.abs(rdx) > Math.abs(rdz) ? 'z' : 'x';
      const L = RIVER_W * 2.6 + 6;
      const a0 = (axis === 'x' ? cx : cz) - L / 2, a1 = a0 + L;
      const c = axis === 'x' ? cz : cx;
      const e0 = axis === 'x' ? B.ground(a0, c) : B.ground(c, a0), e1 = axis === 'x' ? B.ground(a1, c) : B.ground(c, a1);
      const deck = Math.max(2.5, Math.max(e0, e1) + 0.6);
      S.bridge(B, axis, a0, a1, c, deck);
      B.flag(cx - L / 2 - 4, cz - L / 2 - 4, cx + L / 2 + 4, cz + L / 2 + 4, FLAG.NOTREE);
    }
  }

  // ===== WAYSTONES / CHESTS / NODES (interactive props) =====
  for (const w of WAYSTONES) { const y = S.waystone(B, w.x, w.z); G.props.addWaystone(w, y); }
  for (const c of CHESTS) {
    let y = B.ground(c.x, c.z);
    if (c.id === 'c_watch') y = W.watchTop;
    if (c.id === 'c_tower') { c.x = LOC.tower.x + 6; c.z = LOC.tower.z - 6; y = W.towerTop; }
    B.flag(c.x - 2, c.z - 2, c.x + 2, c.z + 2, FLAG.NOTREE);
    G.props.addChest(c, y);
  }
  for (const [x, z] of ORES) { B.flag(x - 2, z - 2, x + 2, z + 2, FLAG.NOTREE); G.props.addHarvest('ore', x, z); }
  for (const [x, z] of GLOWSHROOMS) { B.flag(x - 2, z - 2, x + 2, z + 2, FLAG.NOTREE); G.props.addHarvest('shroom', x, z); }
  for (const [x, z] of HERBS) G.props.addHarvest('herb', x, z);
  // harvestable wheat sheaves in the wheat field
  const wf = FIELDS[0];
  for (let i = 0; i < 14; i++) {
    const x = wf.x0 + 3 + (i % 7) * 3.4, z = wf.z0 + 4 + Math.floor(i / 7) * 10 + (i % 2) * 2;
    G.props.addHarvest('wheat', x, z);
  }
  G.props.addAltar(-205, altarTop, -84);
  const pil = [[R.x - 10, R.z - 2], [R.x + 10, R.z - 2], [R.x, R.z - 14]];
  pil.forEach(([x, z], i) => { const y = B.ground(x, z); B.box(x - 1, y - 0.5, z - 1, x + 1, y + 0.4, z + 1, 0x7a7468); G.props.addPillar(i, x, y + 0.4, z); });
  G.props.addPortal('caveIn', LOC.caveEntrance.x, B.ground(LOC.caveEntrance.x, LOC.caveEntrance.z), LOC.caveEntrance.z - 4.6, 'cave');

  // ===== VEGETATION =====
  const avoid = [
    [LOC.village.x, LOC.village.z, LOC.village.r + 4], [LOC.farm.x, LOC.farm.z, LOC.farm.r], [LOC.camp.x, LOC.camp.z, LOC.camp.r + 4],
    [LOC.ruins.x, LOC.ruins.z, 24], [LOC.forestHeart.x, LOC.forestHeart.z, 13], [LOC.wolfDen.x, LOC.wolfDen.z, 11],
    [LOC.tower.x, LOC.tower.z, 14], [LOC.mushroomRing.x, LOC.mushroomRing.z, 7], [LOC.peakShrine.x, LOC.peakShrine.z, 8],
    [LOC.caveEntrance.x, LOC.caveEntrance.z, 9], [LOC.watchtower.x, LOC.watchtower.z, 8], [LOC.hermit.x, LOC.hermit.z, 8],
  ];
  const blocked = (x, z, pad = 0) => avoid.some(([ax, az, ar]) => (x - ax) ** 2 + (z - az) ** 2 < (ar + pad) ** 2);
  const vr = makeRng(777);
  const step = 3.4;
  let trees = 0;
  const maxTrees = G.mobile ? 1300 : 2200;
  for (let gz = -WORLD.half + 6; gz < WORLD.half - 6; gz += step) {
    for (let gx = -WORLD.half + 6; gx < WORLD.half - 6; gx += step) {
      const x = gx + (vr() - 0.5) * step * 0.9, z = gz + (vr() - 0.5) * step * 0.9;
      const fl = T.flagAt(x, z);
      const h = T.heightAt(x, z);
      const b = T.biomeAt(x, z);
      if (h <= 1) continue;
      const fm = forestMask(x, z);
      const r = vr();
      if (fl & FLAG.NOTREE || blocked(x, z)) {
        if (!(fl & FLAG.BUILDING) && !(fl & FLAG.FIELD) && b !== BIOME.ROAD && b !== BIOME.COBBLE && r < 0.08 && h > 1) flowers(B, x, z, vr);
        continue;
      }
      let p = 0.018 + fm * 0.62;
      if (h >= 16) p = h < 30 ? 0.16 : 0.03;
      if (b === BIOME.MEADOW) p *= 0.4;
      if (r < p && trees < maxTrees) {
        trees++;
        const s = 0.85 + vr() * 0.55;
        const autumn = simplex2(x * 0.01 + 40, z * 0.01) > 0.45 && x > 0;
        if (h >= 16) pine(B, x, z, s, vr, h > 24);
        else if (b === BIOME.DARK) mystic(B, x, z, s * 1.1, vr);
        else if (fm > 0.5) { const q = vr(); if (q < 0.45) oak(B, x, z, s * 1.1, vr, FOREST_OAK); else if (q < 0.8) pine(B, x, z, s, vr, false); else birch(B, x, z, s, vr); }
        else if (autumn) oak(B, x, z, s, vr, AUTUMN);
        else { const q = vr(); if (q < 0.15) oak(B, x, z, s, vr, FRUIT); else if (q < 0.65) oak(B, x, z, s, vr, OAK); else if (q < 0.85) birch(B, x, z, s, vr); else pine(B, x, z, s, vr, false); }
        continue;
      }
      const r2 = vr();
      if (fm > 0.4 && r2 < 0.07) { if (vr() < 0.4) S.mushroom(B, x, z, 0.8 + vr() * 0.5, b === BIOME.DARK); else if (vr() < 0.5) log(B, x, z, vr); else bush(B, x, z, 1, 0x3a7a30, vr, vr() < 0.3 ? 0xd03a5a : 0); }
      else if (r2 < 0.035) bush(B, x, z, 0.8 + vr() * 0.4, 0x4f9a3a, vr, vr() < 0.25 ? 0x4a5ad0 : 0);
      else if (r2 < (b === BIOME.MEADOW ? 0.28 : 0.08) && h < 16) flowers(B, x, z, vr);
      else if (r2 < 0.1 && (h >= 12 || b === BIOME.STONE)) S.rock(B, x, z, 0.8 + vr() * 1.4, h > 24 ? 0x9a9aa0 : 0x8a8680, vr);
      else if (r2 < 0.102) S.rock(B, x, z, 0.5 + vr() * 0.6, 0x8a8680, vr);
    }
  }
  W.treeCount = trees;
}
