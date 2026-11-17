// Geração procedural (determinística) da cidade original "Porto Brasa".
// A malha viária é fixa (avenidas + ruas), os quarteirões são preenchidos
// conforme o distrito, e locais especiais são posicionados em quarteirões fixos.

import { T, MAP, TT, DIRS, DIR, SOLID, PED_WALK, DISTRICT, districtAt } from './constants.js';
import { RNG } from '../core/math.js';

export const VR = [];
export const HR = [];
for (let k = 0; k < 10; k++) {
  VR.push({ p: 4 + 16 * k, w: k === 3 || k === 6 ? 4 : 2 });
  HR.push({ p: 4 + 16 * k, w: k === 2 || k === 6 ? 4 : 2 });
}
// Trechos removidos para criar quarteirões maiores (mantendo a malha conectada).
const REMOVED = new Set(['v8_0', 'v8_1', 'h8_7', 'h8_8', 'v1_0', 'h1_5']);
export const segmentExists = (axis, road, seg) => !REMOVED.has(`${axis}${road}_${seg}`);

const PALETTES = {
  office: ['#5b6675', '#6d7787', '#4c5563', '#7a8291', '#55606e', '#62707f', '#837c74', '#4f5a6b'],
  house: ['#a4533b', '#8c4a3a', '#5e6a78', '#7a3f35', '#8e7552', '#4f6b5a', '#9b5f43'],
  warehouse: ['#7c8389', '#6b747b', '#8a8577', '#5f6a70', '#76705f'],
  container: ['#b8432f', '#2f6db8', '#2f9a5c', '#c58a22', '#7d3fa0', '#c4c4c4', '#1f7f86', '#a62f55'],
  shop: ['#8f6a50', '#6b6f7a', '#7c5b62', '#5d7466', '#8a7c5c'],
  awning: ['#d84b3c', '#2c8fd6', '#e0a12b', '#3fae6a', '#b04fd1', '#e86f2a'],
  apartment: ['#857f78', '#6f7680', '#8a7468', '#6c7a6e'],
  garage: ['#6b6f75', '#7d7166', '#5c666e'],
};

const SHOP_NAMES = ['PADARIA', 'FARMÁCIA', 'LANCHES', 'BAZAR', 'AÇAÍ', 'ÓTICA', 'MODAS', 'PEÇAS', 'CAFÉ', 'SORVETES', 'LIVROS', 'ELETRO'];

export class City {
  constructor(seed = 20251117) {
    const n = MAP * MAP;
    this.type = new Uint8Array(n);
    this.dirs = new Uint8Array(n);
    this.valid = new Uint8Array(n);
    this.inter = new Int16Array(n).fill(-1);
    this.cross = new Int16Array(n).fill(-1);
    this.crossAxis = new Uint8Array(n); // 1 = rua horizontal, 2 = rua vertical
    this.bld = new Int16Array(n).fill(-1);
    this.pier = new Uint8Array(n);
    this.buildings = [];
    this.intersections = [];
    this.lamps = [];
    this.parkingSpots = [];
    this.wrecks = [];
    this.cranes = [];
    this.locations = {};
    this.rng = new RNG(seed);
    this.generate();
  }

  // ---------- consultas ----------
  inb(x, y) {
    return x >= 0 && y >= 0 && x < MAP && y < MAP;
  }
  idx(x, y) {
    return y * MAP + x;
  }
  t(x, y) {
    return this.inb(x, y) ? this.type[y * MAP + x] : TT.WATER;
  }
  solid(x, y) {
    return !this.inb(x, y) || SOLID[this.type[y * MAP + x]] === 1;
  }
  solidW(wx, wy) {
    return this.solid(Math.floor(wx / T), Math.floor(wy / T));
  }
  typeW(wx, wy) {
    return this.t(Math.floor(wx / T), Math.floor(wy / T));
  }
  isRoad(x, y) {
    return this.t(x, y) === TT.ROAD;
  }
  pedWalkable(x, y) {
    return this.inb(x, y) && PED_WALK[this.type[y * MAP + x]] === 1;
  }
  center(tx, ty) {
    return { x: (tx + 0.5) * T, y: (ty + 0.5) * T };
  }

  nearest(wx, wy, pred, maxR = 12) {
    const cx = Math.floor(wx / T), cy = Math.floor(wy / T);
    let best = null, bd = Infinity;
    for (let r = 0; r <= maxR; r++) {
      for (let y = cy - r; y <= cy + r; y++) {
        for (let x = cx - r; x <= cx + r; x++) {
          if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
          if (!this.inb(x, y) || !pred(x, y)) continue;
          const d = ((x + 0.5) * T - wx) ** 2 + ((y + 0.5) * T - wy) ** 2;
          if (d < bd) { bd = d; best = { tx: x, ty: y, x: (x + 0.5) * T, y: (y + 0.5) * T }; }
        }
      }
      if (best) return best;
    }
    return best;
  }

  nearestRoadLane(wx, wy, maxR = 8) {
    return this.nearest(wx, wy, (x, y) => {
      const i = this.idx(x, y);
      if (this.type[i] !== TT.ROAD || this.inter[i] >= 0) return false;
      const d = this.dirs[i];
      return d === 1 || d === 2 || d === 4 || d === 8;
    }, maxR);
  }

  nearestSidewalk(wx, wy, maxR = 10) {
    return this.nearest(wx, wy, (x, y) => this.t(x, y) === TT.SIDEWALK, maxR);
  }

  // Centro de um cruzamento (k = rua vertical, j = rua horizontal)
  I(k, j) {
    return { x: (VR[k].p + VR[k].w / 2) * T, y: (HR[j].p + HR[j].w / 2) * T };
  }
  // Ponto na rua horizontal j entre as verticais k e k+1
  H(j, k, f = 0.5) {
    const a = VR[k].p + VR[k].w, b = VR[k + 1].p;
    return { x: (a + (b - a) * f) * T, y: (HR[j].p + HR[j].w / 2) * T };
  }
  // Ponto na rua vertical k entre as horizontais j e j+1
  V(k, j, f = 0.5) {
    const a = HR[j].p + HR[j].w, b = HR[j + 1].p;
    return { x: (VR[k].p + VR[k].w / 2) * T, y: (a + (b - a) * f) * T };
  }

  lightState(interId, axis) {
    const it = this.intersections[interId];
    if (!it || !it.light) return 'g';
    const c = it.cycle;
    if (axis === 'h') return c < 8 ? 'g' : c < 10 ? 'y' : 'r';
    return c >= 11 && c < 19 ? 'g' : c >= 19 && c < 21 ? 'y' : 'r';
  }

  updateLights(dt) {
    for (const it of this.intersections) {
      if (!it.light) continue;
      it.cycle = (it.cycle + dt) % 22;
    }
  }

  // ---------- geração ----------
  generate() {
    const R = this.rng;
    this.type.fill(TT.GRASS);
    for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) if (x >= 158 || y >= 158) this.type[this.idx(x, y)] = TT.WATER;

    this.paintRoads();
    this.buildIntersections();
    this.computeValidDirs();

    // calçadas: qualquer tile não-via adjacente (8 vizinhos) a uma via
    for (let y = 0; y < MAP; y++) {
      for (let x = 0; x < MAP; x++) {
        const i = this.idx(x, y);
        if (this.type[i] !== TT.GRASS) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (this.t(x + dx, y + dy) === TT.ROAD) { near = true; break; }
        if (near) this.type[i] = TT.SIDEWALK;
      }
    }

    this.buildCrosswalks();
    this.buildWaterfront();
    this.fillEdges();
    this.fillBlocks();
    this.placeLamps();
    this.collectParking();
    // Garante que os locais nomeados estejam em tiles acessíveis
    for (const k of Object.keys(this.locations)) {
      const L = this.locations[k];
      if (this.solid(Math.floor(L.x / T), Math.floor(L.y / T))) {
        const n = this.nearest(L.x, L.y, (x, y) => !this.solid(x, y), 6);
        if (n) { L.x = n.x; L.y = n.y; }
      }
    }
    R.next();
  }

  setRoad(x, y, d) {
    const i = this.idx(x, y);
    this.type[i] = TT.ROAD;
    this.dirs[i] |= d;
  }

  paintRoads() {
    for (let k = 0; k < 10; k++) {
      const r = VR[k];
      for (let j = 0; j < 9; j++) {
        if (!segmentExists('v', k, j)) continue;
        for (let y = HR[j].p; y < HR[j + 1].p + HR[j + 1].w; y++) {
          for (let i = 0; i < r.w; i++) this.setRoad(r.p + i, y, i < r.w / 2 ? DIR.S : DIR.N);
        }
      }
    }
    for (let j = 0; j < 10; j++) {
      const r = HR[j];
      for (let k = 0; k < 9; k++) {
        if (!segmentExists('h', j, k)) continue;
        for (let x = VR[k].p; x < VR[k + 1].p + VR[k + 1].w; x++) {
          for (let i = 0; i < r.w; i++) this.setRoad(x, r.p + i, i < r.w / 2 ? DIR.W : DIR.E);
        }
      }
    }
  }

  buildIntersections() {
    for (let k = 0; k < 10; k++) {
      for (let j = 0; j < 10; j++) {
        const up = j > 0 && segmentExists('v', k, j - 1);
        const down = j < 9 && segmentExists('v', k, j);
        const left = k > 0 && segmentExists('h', j, k - 1);
        const right = k < 9 && segmentExists('h', j, k);
        const arms = (up ? 1 : 0) + (down ? 1 : 0) + (left ? 1 : 0) + (right ? 1 : 0);
        if (arms < 2) continue;
        if (arms === 2 && ((up && down) || (left && right))) continue;
        const id = this.intersections.length;
        const it = {
          id, k, j,
          x: VR[k].p, y: HR[j].p, w: VR[k].w, h: HR[j].w,
          up, down, left, right,
          light: arms >= 3,
          cycle: this.rng.float(0, 22),
        };
        this.intersections.push(it);
        for (let y = it.y; y < it.y + it.h; y++) for (let x = it.x; x < it.x + it.w; x++) this.inter[this.idx(x, y)] = id;
      }
    }
  }

  computeValidDirs() {
    const v = this.valid;
    for (let y = 0; y < MAP; y++) {
      for (let x = 0; x < MAP; x++) {
        const i = this.idx(x, y);
        if (this.type[i] !== TT.ROAD) continue;
        for (const d of DIRS) {
          if (!(this.dirs[i] & d.b)) continue;
          const nx = x + d.dx, ny = y + d.dy;
          if (!this.inb(nx, ny)) continue;
          const ni = this.idx(nx, ny);
          if (this.type[ni] === TT.ROAD && this.dirs[ni] & d.b) v[i] |= d.b;
        }
      }
    }
    // remove opções que levam a becos sem saída
    for (let pass = 0; pass < 30; pass++) {
      let changed = false;
      for (let y = 0; y < MAP; y++) {
        for (let x = 0; x < MAP; x++) {
          const i = this.idx(x, y);
          if (!v[i]) continue;
          for (const d of DIRS) {
            if (!(v[i] & d.b)) continue;
            const ni = this.idx(x + d.dx, y + d.dy);
            if ((v[ni] & ~d.opp) === 0) { v[i] &= ~d.b; changed = true; }
          }
        }
      }
      if (!changed) break;
    }
  }

  buildCrosswalks() {
    for (const it of this.intersections) {
      if (!it.light) continue;
      const mark = (x, y, axis) => {
        if (!this.isRoad(x, y)) return;
        const i = this.idx(x, y);
        if (this.inter[i] >= 0) return;
        this.cross[i] = it.id;
        this.crossAxis[i] = axis;
      };
      if (it.up) for (let x = it.x; x < it.x + it.w; x++) mark(x, it.y - 1, 2);
      if (it.down) for (let x = it.x; x < it.x + it.w; x++) mark(x, it.y + it.h, 2);
      if (it.left) for (let y = it.y; y < it.y + it.h; y++) mark(it.x - 1, y, 1);
      if (it.right) for (let y = it.y; y < it.y + it.h; y++) mark(it.x + it.w, y, 1);
    }
  }

  fillRect(x, y, w, h, type) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (this.inb(xx, yy)) this.type[this.idx(xx, yy)] = type;
  }

  placeBuilding(x, y, w, h, style, opts = {}) {
    if (w < 1 || h < 1) return null;
    const R = this.rng;
    const id = this.buildings.length;
    const pal = PALETTES[style] || PALETTES.office;
    const b = {
      id, x, y, w, h, style,
      color: opts.color || R.pick(pal),
      height: opts.height ?? R.int(2, 4),
      label: opts.label || null,
      accent: opts.accent || R.pick(PALETTES.awning),
      seed: R.int(0, 1e6),
      door: opts.door || null,
    };
    this.buildings.push(b);
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        const i = this.idx(xx, yy);
        this.type[i] = TT.BUILDING;
        this.bld[i] = id;
      }
    }
    return b;
  }

  buildWaterfront() {
    // Píeres do porto
    const piers = [[108, 110, 165], [120, 122, 165], [144, 146, 163]];
    for (const [y0, y1, x1] of piers) {
      for (let y = y0; y <= y1; y++) for (let x = 158; x <= x1; x++) { this.type[this.idx(x, y)] = TT.DOCK; this.pier[this.idx(x, y)] = 1; }
    }
    // plataforma do farol
    for (let y = 143; y <= 147; y++) for (let x = 163; x <= 166; x++) { this.type[this.idx(x, y)] = TT.DOCK; this.pier[this.idx(x, y)] = 1; }
    this.placeBuilding(164, 144, 2, 2, 'lighthouse', { height: 9, label: null });
    this.locations.farol = { x: 162 * T, y: 145.5 * T, name: 'Farol da Ponta' };
    // navio atracado
    this.placeBuilding(159, 125, 7, 8, 'ship', { height: 4 });
    this.locations.navio = { x: 162 * T, y: 122.5 * T, name: 'Cais do Navio' };
    for (const y of [108, 120]) this.cranes.push({ x: 160 * T, y: y * T - 6, a: 0 });
  }

  fillEdges() {
    const R = this.rng;
    for (let y = 0; y < 158; y++) {
      for (let x = 0; x < 158; x++) {
        const inside = x >= 3 && y >= 3 && x <= 150 && y <= 150;
        if (inside) continue;
        const i = this.idx(x, y);
        if (this.type[i] !== TT.GRASS) continue;
        if (x < 3 || y < 3) {
          this.type[i] = R.chance(0.45) ? TT.TREE : TT.GRASS;
        } else if ((x >= 151 && y >= 100) || (y >= 151 && x >= 116)) {
          this.type[i] = TT.DOCK;
        } else if (y >= 151) {
          this.type[i] = (y === 155 && x % 7 === 0) ? TT.TREE : TT.PLAZA;
        } else {
          this.type[i] = TT.LOT;
        }
      }
    }
    // contêineres na faixa leste industrial
    for (let y = 8; y < 96; y += 3) {
      if (R.chance(0.6)) this.placeBuilding(153, y, 3, 1, 'container', { height: 1 });
    }
  }

  fillBlocks() {
    const seen = new Uint8Array(MAP * MAP);
    const blocks = [];
    for (let y = 3; y <= 150; y++) {
      for (let x = 3; x <= 150; x++) {
        const i = this.idx(x, y);
        if (seen[i] || this.type[i] !== TT.GRASS) continue;
        // flood fill
        let x0 = x, y0 = y, x1 = x, y1 = y, count = 0;
        const stack = [i];
        seen[i] = 1;
        while (stack.length) {
          const c = stack.pop();
          const cx = c % MAP, cy = (c / MAP) | 0;
          count++;
          if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
          for (const d of DIRS) {
            const nx = cx + d.dx, ny = cy + d.dy;
            if (!this.inb(nx, ny)) continue;
            const ni = this.idx(nx, ny);
            if (!seen[ni] && this.type[ni] === TT.GRASS) { seen[ni] = 1; stack.push(ni); }
          }
        }
        blocks.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, count });
      }
    }
    const specials = {
      workshopHQ: [28, 124], hospital: [45, 76], police: [92, 60], vertice: [76, 76],
      plaza: [76, 60], market: [92, 124], park: [28, 45], watertower: [140, 45],
    };
    for (const b of blocks) {
      if (b.count !== b.w * b.h) {
        // forma irregular: apenas grama e árvores
        continue;
      }
      let special = null;
      for (const [name, [sx, sy]] of Object.entries(specials)) {
        if (sx >= b.x && sx < b.x + b.w && sy >= b.y && sy < b.y + b.h) special = name;
      }
      b.district = districtAt(b.x + (b.w >> 1), b.y + (b.h >> 1));
      if (special) this['gen_' + special](b);
      else this.genBlock(b);
    }
  }

  bsp(x, y, w, h, min, max, out) {
    const R = this.rng;
    const canV = w >= min * 2, canH = h >= min * 2;
    if ((w <= max && h <= max && R.chance(0.35)) || (!canV && !canH)) {
      out.push({ x, y, w, h });
      return out;
    }
    if (canV && (w >= h || !canH)) {
      const s = R.int(min, w - min);
      this.bsp(x, y, s, h, min, max, out);
      this.bsp(x + s, y, w - s, h, min, max, out);
    } else {
      const s = R.int(min, h - min);
      this.bsp(x, y, w, s, min, max, out);
      this.bsp(x, y + s, w, h - s, min, max, out);
    }
    return out;
  }

  // ret.: retângulo do lote recuado 1 tile nos lados internos ao quarteirão
  insetInner(lot, b, extra = 0) {
    const l = lot.x > b.x ? 1 : extra, t = lot.y > b.y ? 1 : extra;
    const r = lot.x + lot.w < b.x + b.w ? 1 : extra, bt = lot.y + lot.h < b.y + b.h ? 1 : extra;
    return { x: lot.x + l, y: lot.y + t, w: lot.w - l - r, h: lot.h - t - bt };
  }

  genBlock(b) {
    const R = this.rng;
    switch (b.district) {
      case DISTRICT.DOWNTOWN: {
        for (const lot of this.bsp(b.x, b.y, b.w, b.h, 4, 8, [])) {
          const r = R.next();
          if (r < 0.68 && lot.w >= 3 && lot.h >= 3) {
            this.fillRect(lot.x, lot.y, lot.w, lot.h, TT.PLAZA);
            const q = this.insetInner(lot, b);
            this.placeBuilding(q.x, q.y, q.w, q.h, 'office', { height: R.int(5, 12) });
          } else if (r < 0.85) {
            this.genPlaza(lot);
          } else {
            this.genParking(lot);
          }
        }
        break;
      }
      case DISTRICT.RESIDENTIAL: {
        if (b.y < 36 && b.x >= 52) {
          for (const lot of this.bsp(b.x, b.y, b.w, b.h, 5, 9, [])) {
            this.fillRect(lot.x, lot.y, lot.w, lot.h, TT.GRASS);
            if (R.chance(0.75)) {
              const q = this.insetInner(lot, b, 1);
              this.placeBuilding(q.x, q.y, q.w, Math.max(1, q.h), 'apartment', { height: R.int(3, 6) });
            } else this.genParking(lot);
          }
          break;
        }
        if (R.chance(0.15)) { this.genPark(b); break; }
        for (const lot of this.bsp(b.x, b.y, b.w, b.h, 4, 6, [])) {
          this.fillRect(lot.x, lot.y, lot.w, lot.h, TT.GRASS);
          let hw = lot.w - 2, hh = lot.h - 2;
          if (hw < 2 || hh < 2) continue;
          let pool = false;
          if (lot.w >= 6 && lot.h >= 5 && R.chance(0.35)) { hw -= 3; pool = true; }
          this.placeBuilding(lot.x + 1, lot.y + 1, hw, hh, 'house', { height: 2 });
          if (pool) this.fillRect(lot.x + 1 + hw + 1, lot.y + 1, 2, 2, TT.POOL);
          if (R.chance(0.55)) {
            const corners = [[lot.x, lot.y], [lot.x + lot.w - 1, lot.y], [lot.x, lot.y + lot.h - 1], [lot.x + lot.w - 1, lot.y + lot.h - 1]];
            const [cx, cy] = R.pick(corners);
            if (this.t(cx, cy) === TT.GRASS) this.type[this.idx(cx, cy)] = TT.TREE;
          }
        }
        break;
      }
      case DISTRICT.INDUSTRIAL: {
        for (const lot of this.bsp(b.x, b.y, b.w, b.h, 5, 12, [])) {
          this.fillRect(lot.x, lot.y, lot.w, lot.h, TT.LOT);
          const r = R.next();
          if (r < 0.55 && lot.w >= 4 && lot.h >= 4) {
            const q = this.insetInner(lot, b, 1);
            this.placeBuilding(q.x, q.y, q.w, q.h, 'warehouse', { height: 3 });
          } else if (r < 0.85) {
            this.genContainers(lot);
          } else this.genParking(lot);
        }
        break;
      }
      case DISTRICT.PORT: {
        this.fillRect(b.x, b.y, b.w, b.h, TT.LOT);
        if (b.w >= 10 && b.h >= 16) {
          this.placeBuilding(b.x + 1, b.y + 1, b.w - 2, 6, 'warehouse', { height: 3 });
          this.genContainers({ x: b.x, y: b.y + 8, w: b.w, h: b.h - 8 });
        } else this.genContainers(b);
        break;
      }
      case DISTRICT.WORKSHOP: {
        for (const lot of this.bsp(b.x, b.y, b.w, b.h, 5, 8, [])) {
          this.fillRect(lot.x, lot.y, lot.w, lot.h, TT.LOT);
          const r = R.next();
          if (r < 0.6 && lot.w >= 4 && lot.h >= 4) {
            const q = this.insetInner(lot, b, 1);
            this.placeBuilding(q.x, q.y, q.w, Math.max(2, q.h - 1), 'garage', { height: 2 });
          } else if (r < 0.82) this.genParking(lot);
          else {
            for (let i = 0; i < 3; i++) this.wrecks.push({ x: (lot.x + R.float(0.8, lot.w - 0.8)) * T, y: (lot.y + R.float(0.8, lot.h - 0.8)) * T, a: R.float(0, 6.28), c: R.pick(['#6d4a3a', '#4f5a62', '#6e6a4d']) });
          }
        }
        break;
      }
      case DISTRICT.MIXED:
      default: {
        for (const lot of this.bsp(b.x, b.y, b.w, b.h, 4, 7, [])) {
          const r = R.next();
          if (r < 0.62 && lot.w >= 3 && lot.h >= 3) {
            this.fillRect(lot.x, lot.y, lot.w, lot.h, TT.PLAZA);
            const q = this.insetInner(lot, b);
            this.placeBuilding(q.x, q.y, q.w, q.h, 'shop', { height: R.int(2, 3), label: R.pick(SHOP_NAMES) });
          } else if (r < 0.82) this.genParking(lot);
          else this.genPlaza(lot);
        }
      }
    }
  }

  genPlaza(lot) {
    this.fillRect(lot.x, lot.y, lot.w, lot.h, TT.PLAZA);
    if (lot.w >= 4 && lot.h >= 4) {
      for (const [x, y] of [[lot.x + 1, lot.y + 1], [lot.x + lot.w - 2, lot.y + 1], [lot.x + 1, lot.y + lot.h - 2], [lot.x + lot.w - 2, lot.y + lot.h - 2]]) {
        this.type[this.idx(x, y)] = TT.TREE;
      }
    }
  }

  genParking(lot) {
    this.fillRect(lot.x, lot.y, lot.w, lot.h, TT.PARKING);
  }

  genContainers(lot) {
    const R = this.rng;
    for (let y = lot.y + 1; y < lot.y + lot.h - 1; y += 3) {
      for (let x = lot.x + 1; x + 2 < lot.x + lot.w - 1; x += 4) {
        if (R.chance(0.72)) this.placeBuilding(x, y, R.chance(0.5) ? 3 : 2, 1, 'container', { height: 1 });
      }
    }
  }

  genPark(b) {
    const R = this.rng;
    this.fillRect(b.x, b.y, b.w, b.h, TT.GRASS);
    const cx = b.x + (b.w >> 1), cy = b.y + (b.h >> 1);
    this.fillRect(b.x, cy, b.w, 1, TT.PLAZA);
    this.fillRect(cx, b.y, 1, b.h, TT.PLAZA);
    if (b.w >= 10 && b.h >= 9) this.fillRect(b.x + 2, b.y + 2, 3, 2, TT.WATER);
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        if (this.t(x, y) !== TT.GRASS) continue;
        if (Math.abs(x - cx) <= 1 || Math.abs(y - cy) <= 1) continue;
        if (R.chance(0.28)) this.type[this.idx(x, y)] = TT.TREE;
      }
    }
    return { x: (cx + 0.5) * T, y: (cy + 0.5) * T };
  }

  gen_workshopHQ(b) {
    this.fillRect(b.x, b.y, b.w, b.h, TT.LOT);
    this.placeBuilding(b.x, b.y, 6, 4, 'garage', { label: 'GARAGEM', color: '#3d5a73', height: 2, door: 'S' });
    this.placeBuilding(b.x + 7, b.y, b.w - 7, 4, 'garage', { label: 'PINTURA', color: '#6d3d73', height: 2, door: 'S' });
    this.placeBuilding(b.x, b.y + 8, b.w, b.h - 8, 'oficina', { label: 'OFICINA BRASA', color: '#9a4f22', height: 3, door: 'N' });
    this.locations.garage = { ...this.center(b.x + 3, b.y + 4), name: 'Garagem' };
    this.locations.respray = { ...this.center(b.x + 9, b.y + 4), name: 'Pintura Rápida' };
    this.locations.oficina = { ...this.center(b.x + 6, b.y + 7), name: 'Oficina Brasa' };
  }

  gen_hospital(b) {
    this.fillRect(b.x, b.y, b.w, b.h, TT.PLAZA);
    this.placeBuilding(b.x + 1, b.y + 1, b.w - 2, b.h - 5, 'hospital', { label: 'HOSPITAL', color: '#d9dde2', height: 5 });
    this.locations.hospital = { ...this.center(b.x + (b.w >> 1), b.y + b.h - 2), name: 'Hospital São Lucas' };
  }

  gen_police(b) {
    this.fillRect(b.x, b.y, b.w, b.h, TT.PLAZA);
    this.placeBuilding(b.x + 1, b.y + 1, b.w - 2, 6, 'police', { label: 'DELEGACIA', color: '#2b3a55', height: 4 });
    this.fillRect(b.x + 1, b.y + 9, b.w - 2, b.h - 10, TT.PARKING);
    this.locations.police = { ...this.center(b.x + (b.w >> 1), b.y + 8), name: 'Delegacia Central' };
  }

  gen_vertice(b) {
    this.fillRect(b.x, b.y, b.w, b.h, TT.PLAZA);
    this.placeBuilding(b.x + 2, b.y + 2, b.w - 4, b.h - 5, 'tower', { label: 'VÉRTICE', color: '#1c2430', height: 18 });
    for (const [x, y] of [[b.x, b.y], [b.x + b.w - 1, b.y], [b.x, b.y + b.h - 1], [b.x + b.w - 1, b.y + b.h - 1]]) this.type[this.idx(x, y)] = TT.TREE;
    this.locations.vertice = { ...this.center(b.x + (b.w >> 1), b.y + b.h - 2), name: 'Torre Vértice' };
  }

  gen_plaza(b) {
    this.fillRect(b.x, b.y, b.w, b.h, TT.PLAZA);
    const cx = b.x + (b.w >> 1) - 1, cy = b.y + (b.h >> 1) - 1;
    this.placeBuilding(cx, cy, 2, 2, 'fountain', { height: 1 });
    for (const [dx, dy] of [[-3, -3], [4, -3], [-3, 4], [4, 4], [-4, 0], [5, 1]]) {
      const x = cx + dx, y = cy + dy;
      if (x > b.x && y > b.y && x < b.x + b.w - 1 && y < b.y + b.h - 1) this.type[this.idx(x, y)] = TT.TREE;
    }
    this.locations.plaza = { ...this.center(cx + 1, cy + 3), name: 'Praça da Fonte' };
  }

  gen_market(b) {
    this.fillRect(b.x, b.y, b.w, b.h, TT.PLAZA);
    this.placeBuilding(b.x + 1, b.y + 1, b.w - 2, 6, 'market', { label: 'MERCADO NOVO', color: '#7a4a2c', height: 3 });
    this.fillRect(b.x + 1, b.y + 9, b.w - 2, b.h - 10, TT.PARKING);
    this.locations.market = { ...this.center(b.x + (b.w >> 1), b.y + 8), name: 'Mercado Novo' };
  }

  gen_park(b) {
    const c = this.genPark(b);
    this.locations.park = { ...c, name: 'Parque das Mangueiras' };
  }

  gen_watertower(b) {
    this.fillRect(b.x, b.y, b.w, b.h, TT.LOT);
    const cx = b.x + (b.w >> 1) - 1, cy = b.y + (b.h >> 1) - 2;
    this.placeBuilding(cx, cy, 3, 3, 'watertower', { height: 10 });
    this.genContainers({ x: b.x, y: b.y + b.h - 4, w: b.w, h: 4 });
    this.locations.watertower = { ...this.center(cx + 1, cy + 4), name: 'Caixa d\'Água' };
  }

  placeLamps() {
    for (let y = 0; y < MAP; y++) {
      for (let x = 0; x < MAP; x++) {
        if (this.t(x, y) !== TT.SIDEWALK) continue;
        if ((x * 7 + y * 13) % 6 !== 0) continue;
        for (const d of DIRS) {
          const nx = x + d.dx, ny = y + d.dy;
          if (this.isRoad(nx, ny) && this.cross[this.idx(nx, ny)] < 0) {
            this.lamps.push({ x: (x + 0.5) * T + d.dx * 12, y: (y + 0.5) * T + d.dy * 12, a: d.a });
            break;
          }
        }
      }
    }
  }

  collectParking() {
    for (let y = 0; y < MAP; y++) {
      for (let x = 0; x < MAP; x++) {
        if (this.t(x, y) !== TT.PARKING) continue;
        if (y % 3 !== 0 || this.t(x, y + 1) !== TT.PARKING) continue;
        this.parkingSpots.push({ x: (x + 0.5) * T, y: (y + 1) * T, a: (x + y) % 2 ? Math.PI / 2 : -Math.PI / 2, state: 0, car: null });
      }
    }
  }
}
