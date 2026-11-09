// Static collision world: terrain heightmap + axis-aligned boxes + vertical cylinders.
// Boxes can be stood upon (bridges, stairs, roofs, platforms).
import { WORLD, STREAM } from '../data/world.js';
import { G } from '../core/context.js';

const GC = 8;
export const STEP_UP = 1.1;

export class Physics {
  constructor() {
    this.grid = new Map();
    this.all = [];
    this.terrainFn = () => 0;
    this.regions = []; // special height regions (cave)
  }
  key(i, j) { return i * 73856093 ^ j * 19349663; }
  insert(c) {
    const i0 = Math.floor(c.x0 / GC), i1 = Math.floor(c.x1 / GC), j0 = Math.floor(c.z0 / GC), j1 = Math.floor(c.z1 / GC);
    c.cells = [];
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this.key(i, j);
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(c);
      c.cells.push(k);
    }
    this.all.push(c);
    return c;
  }
  remove(c) {
    if (!c || !c.cells) return;
    for (const k of c.cells) {
      const arr = this.grid.get(k);
      if (arr) { const i = arr.indexOf(c); if (i >= 0) arr.splice(i, 1); }
    }
    c.cells = null;
    const i = this.all.indexOf(c); if (i >= 0) this.all.splice(i, 1);
  }
  addBox(x0, y0, z0, x1, y1, z1, tag) {
    return this.insert({ t: 'box', x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0, y1, z0: Math.min(z0, z1), z1: Math.max(z0, z1), tag });
  }
  addCyl(x, z, r, y0, y1, tag) {
    return this.insert({ t: 'cyl', x, z, r, x0: x - r, x1: x + r, z0: z - r, z1: z + r, y0, y1, tag });
  }
  query(x, z, r) {
    const out = [];
    const i0 = Math.floor((x - r) / GC), i1 = Math.floor((x + r) / GC), j0 = Math.floor((z - r) / GC), j1 = Math.floor((z + r) / GC);
    const seen = new Set();
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const arr = this.grid.get(this.key(i, j));
      if (!arr) continue;
      for (const c of arr) if (!seen.has(c)) { seen.add(c); out.push(c); }
    }
    return out;
  }

  terrainHeight(x, z) {
    for (const r of this.regions) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.h;
    return this.terrainFn(x, z);
  }
  waterLevel(x, z) {
    for (const r of this.regions) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return -999;
    if (x > STREAM.x0 && x < STREAM.x1 && z > STREAM.z0 && z < STREAM.z1) return STREAM.level;
    return WORLD.water;
  }

  // highest walkable surface under (x,z) that is not above y + step
  groundAt(x, z, y, r = 0.3, step = STEP_UP) {
    let g = this.terrainHeight(x, z);
    const list = this.query(x, z, r);
    for (const c of list) {
      if (c.y1 > y + step || c.y1 <= g) continue;
      if (c.t === 'box') {
        if (x + r * 0.5 > c.x0 && x - r * 0.5 < c.x1 && z + r * 0.5 > c.z0 && z - r * 0.5 < c.z1) g = c.y1;
      } else {
        const dx = x - c.x, dz = z - c.z;
        if (dx * dx + dz * dz < c.r * c.r) g = c.y1;
      }
    }
    return g;
  }

  // Push a cylinder (x,z,radius) at height range [y, y+h] out of colliders. Mutates pos.
  resolve(pos, r, h, step = STEP_UP) {
    const list = this.query(pos.x, pos.z, r + 0.5);
    let hit = false;
    for (const c of list) {
      // while airborne only things below the feet can be stepped over: posts and walls stay solid mid-jump
      if (c.y1 <= pos.y + step || c.y0 >= pos.y + h) continue;
      if (c.t === 'box') {
        const cx = Math.max(c.x0, Math.min(pos.x, c.x1));
        const cz = Math.max(c.z0, Math.min(pos.z, c.z1));
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 < 1e-8) {
            // inside: push along shortest axis
            const px = Math.min(pos.x - c.x0, c.x1 - pos.x), pz = Math.min(pos.z - c.z0, c.z1 - pos.z);
            if (px < pz) pos.x = (pos.x - c.x0 < c.x1 - pos.x) ? c.x0 - r : c.x1 + r;
            else pos.z = (pos.z - c.z0 < c.z1 - pos.z) ? c.z0 - r : c.z1 + r;
          } else {
            const d = Math.sqrt(d2);
            pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r;
          }
          hit = true;
        }
      } else {
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const rr = r + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x = c.x + (dx / d) * rr; pos.z = c.z + (dz / d) * rr;
          hit = true;
        }
      }
    }
    return hit;
  }

  // Move with terrain step limits. Returns true if blocked.
  move(pos, dx, dz, r, h, airborne) {
    const lim = WORLD.half - 4;
    const tryAxis = (ax, d) => {
      if (d === 0) return false;
      const ox = pos.x, oz = pos.z;
      if (ax === 0) pos.x += d; else pos.z += d;
      const g = this.groundAt(pos.x, pos.z, pos.y, r, airborne ? 0.15 : STEP_UP);
      if (g > pos.y + (airborne ? 0.05 : STEP_UP)) { pos.x = ox; pos.z = oz; return true; }
      return false;
    };
    // sub-step to avoid tunnelling
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.4));
    let blocked = false;
    for (let s = 0; s < steps; s++) {
      blocked = tryAxis(0, dx / steps) || blocked;
      blocked = tryAxis(1, dz / steps) || blocked;
      this.resolve(pos, r, h, airborne ? 0.15 : STEP_UP);
    }
    if (!this.regions.some((q) => pos.x >= q.x0 - 50 && pos.x <= q.x1 + 50 && pos.z >= q.z0 - 50 && pos.z <= q.z1 + 50)) {
      pos.x = Math.max(-lim, Math.min(lim, pos.x));
      pos.z = Math.max(-lim, Math.min(lim, pos.z));
    }
    return blocked;
  }

  // camera: march from a to b, return safe fraction
  rayFraction(ax, ay, az, bx, by, bz) {
    const steps = 24;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t;
      if (this.terrainHeight(x, z) > y - 0.3) return Math.max(0.05, (s - 1) / steps);
      for (const c of this.query(x, z, 0.2)) {
        if (y < c.y0 || y > c.y1 || c.noCam) continue;
        if (c.t === 'box' ? (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) : ((x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r)) {
          return Math.max(0.05, (s - 1) / steps);
        }
      }
    }
    return 1;
  }

  lineOfSight(ax, ay, az, bx, by, bz) {
    return this.rayFraction(ax, ay, az, bx, by, bz) >= 0.99;
  }
}

export function getPhys() { return G.physics; }
