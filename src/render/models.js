// Reusable voxel prop models: swords, chests, nodes.
import * as THREE from 'three';
import { SWORDS } from '../data/items.js';
import { buildMesh, getWorldMaterial } from './voxel.js';
import { shade } from '../core/utils.js';

const swordCache = new Map();
// Sword geometry: grip at origin, blade pointing +Y
export function swordGeometry(id) {
  if (swordCache.has(id)) return swordCache.get(id);
  const s = SWORDS[id] || SWORDS.wood_sword;
  const mesh = buildMesh((vb) => {
    const glow = s.glow ? 1.5 + 0.6 : 0;
    const L = s.len * 1.25, W = s.w, gw = s.gw;
    vb.box(-0.05, -0.3, -0.05, 0.05, 0.12, 0.05, s.grip);
    vb.box(-0.08, -0.38, -0.08, 0.08, -0.3, 0.08, s.guard);
    if (s.shape === 'shovel') {
      vb.box(-0.045, 0.12, -0.045, 0.045, L * 0.8, 0.045, s.grip);
      vb.box(-W / 2, L * 0.8, -0.03, W / 2, L * 1.15, 0.03, s.blade);
      vb.box(-W / 2 + 0.04, L * 1.15, -0.03, W / 2 - 0.04, L * 1.22, 0.03, s.edge);
      return;
    }
    vb.box(-gw / 2, 0.12, -0.07, gw / 2, 0.22, 0.07, s.guard, { emit: glow ? 0 : 0 });
    if (gw > 0.45) { vb.box(-gw / 2 - 0.05, 0.08, -0.06, -gw / 2 + 0.07, 0.3, 0.06, s.guard); vb.box(gw / 2 - 0.07, 0.08, -0.06, gw / 2 + 0.05, 0.3, 0.06, s.guard); }
    if (s.glow) vb.box(-0.05, 0.13, -0.08, 0.05, 0.21, 0.08, s.glow, { emit: 2.3 });
    vb.box(-W / 2, 0.22, -0.035, W / 2, 0.22 + L, 0.035, s.blade, { emit: glow ? 1.5 + 0.25 : 0 });
    vb.box(-W / 2 - 0.012, 0.3, -0.02, -W / 2 + 0.03, 0.22 + L - 0.05, 0.02, s.edge, { emit: glow ? 1.5 + 0.4 : 0 });
    vb.box(W / 2 - 0.03, 0.3, -0.02, W / 2 + 0.012, 0.22 + L - 0.05, 0.02, s.edge, { emit: glow ? 1.5 + 0.4 : 0 });
    vb.box(-W / 2 + 0.03, 0.22 + L, -0.03, W / 2 - 0.03, 0.22 + L + 0.08, 0.03, s.edge, { emit: glow ? 1.5 + 0.4 : 0 });
    vb.box(-W / 4, 0.22 + L + 0.08, -0.02, W / 4, 0.22 + L + 0.14, 0.02, s.edge, { emit: glow ? 1.5 + 0.4 : 0 });
    if (s.rarity === 'legendary' || s.rarity === 'magic') vb.box(-0.025, 0.3, -0.04, 0.025, 0.22 + L * 0.8, 0.04, s.glow, { emit: 2.4 });
  });
  const geo = mesh.geometry;
  swordCache.set(id, geo);
  return geo;
}
export function swordMesh(id) {
  const m = new THREE.Mesh(swordGeometry(id), getWorldMaterial());
  m.castShadow = true;
  return m;
}
export function swordLength(id) { return (SWORDS[id]?.len || 0.9) * 1.25 + 0.3; }

export const CHEST_COLORS = {
  common: { body: 0x9a6a3a, band: 0x5a5a5a, trim: 0x3a2a1a, glow: 0xffe0a0 },
  rare: { body: 0x3a5a8a, band: 0xb0b8c0, trim: 0x2a3a5a, glow: 0x6ac0ff },
  epic: { body: 0x5a2a7a, band: 0xd4a83a, trim: 0x2a1a3a, glow: 0xd08aff },
  legendary: { body: 0xd4a020, band: 0xfff0b0, trim: 0x8a5a10, glow: 0xffd36a },
};
export function chestModel(rarity) {
  const c = CHEST_COLORS[rarity] || CHEST_COLORS.common;
  const g = new THREE.Group();
  const base = buildMesh((vb) => {
    vb.box(-0.7, 0, -0.45, 0.7, 0.6, 0.45, c.body, { vary: 0.03 });
    vb.box(-0.72, 0, -0.47, -0.55, 0.62, 0.47, c.band); vb.box(0.55, 0, -0.47, 0.72, 0.62, 0.47, c.band);
    vb.box(-0.12, 0.35, 0.45, 0.12, 0.6, 0.52, c.band);
    vb.box(-0.66, 0.5, -0.41, 0.66, 0.612, 0.41, 0x1a1008); // slightly above the rim: no z-fighting flicker
  });
  const lid = buildMesh((vb) => {
    vb.box(-0.7, 0, -0.9, 0.7, 0.32, 0, c.body, { vary: 0.03 });
    vb.box(-0.6, 0.32, -0.8, 0.6, 0.42, -0.1, shade(c.body, 1.08));
    vb.box(-0.72, -0.02, -0.92, -0.55, 0.44, 0.02, c.band); vb.box(0.55, -0.02, -0.92, 0.72, 0.44, 0.02, c.band);
    vb.box(-0.12, -0.12, -0.04, 0.12, 0.12, 0.04, c.band);
  });
  lid.position.set(0, 0.6, 0.45);
  const pivot = new THREE.Group();
  pivot.position.set(0, 0.6, -0.45);
  lid.position.set(0, 0, 0.9);
  pivot.add(lid);
  g.add(base, pivot);
  g.userData.lid = pivot;
  return g;
}
