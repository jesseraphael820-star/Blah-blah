// Geração determinística do mundo aberto: regiões, relevo, rios, estradas, vilas, postos e marcadores.
import { TILE, mulberry32, fbm, hash2, valueNoise, clamp } from '../core/util.js';
import { T, TILE_INFO } from '../gfx/tiles.js';
import { GameMap } from './map.js';
import { MAP_W, MAP_H, REGIONS, VILLAGES, RIVERS, LAKES, TERRITORIES, SITES } from '../data/world.js';
import { treeSprite, rockSprite, plantSprite, buildingSprite, propSprite } from '../gfx/objects.js';
import { FACTIONS } from '../data/world.js';

const SEED = 7741;
export const REG_SCALE = [1.05, 1.25, 1.0, 0.95, 0.95, 1.0, 1.0, 0.8];

export function obj(kind, x, y, spr, extra = {}) {
  return Object.assign({ kind, x, y, spr, box: spr && spr.box ? spr.box : null }, extra);
}

class Heap {
  constructor() { this.a = []; }
  push(n, p) { const a = this.a; a.push([p, n]); let i = a.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; [a[i], a[j]] = [a[j], a[i]]; i = j; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } } return top[1]; }
  get size() { return this.a.length; }
}

export function astar(map, sx, sy, ex, ey, costFn, maxIter = 200000) {
  const W = map.w, H = map.h, N = W * H;
  const g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const s = sy * W + sx, e = ey * W + ex;
  g[s] = 0; const open = new Heap(); open.push(s, 0);
  let it = 0;
  while (open.size && it++ < maxIter) {
    const cur = open.pop();
    if (cur === e) break;
    if (closed[cur]) continue; closed[cur] = 1;
    const cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy; if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue;
      const n = ny * W + nx; if (closed[n]) continue;
      const c = costFn(nx, ny); if (c === Infinity) continue;
      const ng = g[cur] + c;
      if (ng < g[n]) { g[n] = ng; from[n] = cur; open.push(n, ng + (Math.abs(nx - ex) + Math.abs(ny - ey)) * 0.9); }
    }
  }
  if (from[e] === -1 && s !== e) return null;
  const path = []; let c = e; while (c !== -1) { path.push([c % W, (c / W) | 0]); c = from[c]; } path.reverse();
  return path;
}

export function generateWorld() {
  const r = mulberry32(SEED);
  const m = new GameMap('world', MAP_W, MAP_H, { region: 1, music: 'plains', name: 'world' });
  const W = MAP_W, H = MAP_H;
  const elev = new Float32Array(W * H);
  // 1) regiões com distorção
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wx = x + (fbm(x / 40, y / 40, SEED) - 0.5) * 46, wy = y + (fbm(x / 40, y / 40, SEED + 9) - 0.5) * 46;
    let best = 0, bd = Infinity;
    for (const R of REGIONS) { const d = Math.hypot(wx - R.cx, (wy - R.cy) * 1.1) / REG_SCALE[R.id]; if (d < bd) { bd = d; best = R.id; } }
    m.region[y * W + x] = best;
    elev[y * W + x] = fbm(x / 18, y / 18, SEED + 3, 5);
  }
  // 2) terreno base
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const reg = m.region[y * W + x], e = elev[y * W + x], n = fbm(x / 9, y / 9, SEED + 11, 3), n2 = valueNoise(x / 5, y / 5, SEED + 17);
    let t = T.GRASS;
    switch (reg) {
      case 0: t = n > 0.47 ? T.FOREST : T.GRASS; if (n2 > 0.86) t = T.DIRT; break;
      case 1: t = T.GRASS; if (n2 > 0.88) t = T.DIRT; break;
      case 2: t = T.ROCK; if (n < 0.4) t = T.GRASS; if (e > 0.6) t = T.CLIFF; if (e > 0.56 && y < 40 && t !== T.CLIFF) t = T.SNOW; break;
      case 3: t = T.MARSH; if (n > 0.56) t = T.SWAMPW; else if (n2 > 0.7) t = T.MUD; if (n < 0.34) t = T.GRASS; break;
      case 4: t = T.ASH; if (n > 0.6) t = T.ROCK; if (n2 > 0.85) t = T.DIRT; if (e > 0.66) t = T.CLIFF; break;
      case 5: t = T.GRASS; if (n2 > 0.8) t = T.SAND; break;
      case 6: t = T.SNOW; if (n > 0.62) t = T.ICE; if (n2 > 0.8) t = T.ROCK; if (e > 0.64) t = T.CLIFF; break;
      case 7: t = T.GRASS; if (n > 0.55) t = T.FOREST; if (e > 0.67) t = T.CLIFF; break;
    }
    m.tiles[y * W + x] = t;
  }
  // 3) mar a leste e borda do mundo
  for (let y = 0; y < H; y++) {
    const coast = 283 + (fbm(0, y / 14, SEED + 5) - 0.5) * 16 + (y < 90 ? 40 : 0);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (x > coast + 4) m.tiles[i] = T.DEEP; else if (x > coast) m.tiles[i] = T.WATER; else if (x > coast - 4 && y >= 90) m.tiles[i] = T.SAND;
      const border = x < 3 || y < 3 || y > H - 4 || (x > W - 4 && y < 90);
      if (border && m.tiles[i] !== T.DEEP && m.tiles[i] !== T.WATER) m.tiles[i] = T.CLIFF;
    }
  }
  // 4) rios e lagos
  for (const R of RIVERS) {
    for (let k = 0; k < R.pts.length - 1; k++) {
      const [x0, y0] = R.pts[k], [x1, y1] = R.pts[k + 1];
      const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps; let x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        x += (fbm(x / 10, y / 10, SEED + 21) - 0.5) * 8; y += (fbm(x / 10, y / 10, SEED + 23) - 0.5) * 8;
        const w = R.w + valueNoise(s / 20, k, SEED) * 1.2;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          if (dx * dx + dy * dy > w * w) continue;
          const tx = Math.round(x + dx), ty = Math.round(y + dy); if (!m.inb(tx, ty)) continue;
          const reg = m.reg(tx, ty);
          m.set(tx, ty, reg === 3 ? T.SWAMPW : dx * dx + dy * dy < (w - 1.2) * (w - 1.2) ? T.DEEP : T.WATER);
        }
      }
    }
  }
  for (const [lx, ly, rx, ry] of LAKES) for (let y = -ry - 2; y <= ry + 2; y++) for (let x = -rx - 2; x <= rx + 2; x++) {
    const d = (x * x) / (rx * rx) + (y * y) / (ry * ry) + (valueNoise((lx + x) / 3, (ly + y) / 3, 4) - 0.5) * 0.5;
    if (d < 1) m.set(lx + x, ly + y, d < 0.45 ? T.DEEP : T.WATER); else if (d < 1.35 && m.reg(lx + x, ly + y) !== 6) { const t = m.get(lx + x, ly + y); if (t !== T.WATER && t !== T.DEEP) m.set(lx + x, ly + y, T.SAND); }
  }
  // 5) limpar áreas de vilas, sítios e territórios
  const clearArea = (cx, cy, rad, tile) => {
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
      if (x * x + y * y > rad * rad) continue;
      const tx = cx + x, ty = cy + y; if (!m.inb(tx, ty) || tx < 3 || ty < 3 || tx > W - 4 || ty > H - 4) continue;
      const cur = m.get(tx, ty);
      if (cur === T.CLIFF || TILE_INFO[cur].water || cur === T.SWAMPW) m.set(tx, ty, tile ?? baseFor(m.reg(tx, ty)));
    }
  };
  for (const v of Object.values(VILLAGES)) clearArea(v.x, v.y, v.r + 2, v.style === 'ravencross' ? T.MARSH : undefined);
  for (const s of Object.values(SITES)) clearArea(s.x, s.y + 2, 4);
  for (const tr of TERRITORIES) clearArea(tr.x, tr.y, 4);
  // 6) estradas (A*)
  const roadCost = (x, y) => {
    const t = m.get(x, y);
    if (t === T.ROAD || t === T.BRIDGE) return 0.35;
    if (t === T.CLIFF) return x < 3 || y < 3 || x > W - 4 || y > H - 4 ? Infinity : 30;
    if (t === T.DEEP) return x > 270 ? Infinity : 22; if (t === T.WATER) return 14; if (t === T.SWAMPW) return 5;
    return 1 + valueNoise(x / 6, y / 6, 9) * 1.5;
  };
  const roads = [['varden', 'eldoria'], ['varden', 'drakmor'], ['varden', 'solaria'], ['varden', 'cinzamar'], ['varden', 'ruins'], ['ruins', 'frostheim'], ['eldoria', 'ravencross'],
    ['cinzamar', 'solaria'], ['eldoria', 'frostheim'], ['drakmor', 'solaria'], ['cinzamar', 'ravencross']];
  const pos = (k) => (k === 'ruins' ? [SITES.ruins_main.x, SITES.ruins_main.y + 6] : [VILLAGES[k].x, VILLAGES[k].y]);
  m.roadPaths = {};
  for (const [a, b] of roads) {
    const [sx, sy] = pos(a), [ex, ey] = pos(b);
    const path = astar(m, sx, sy, ex, ey, roadCost);
    if (!path) continue;
    m.roadPaths[a + '-' + b] = path;
    for (const [x, y] of path) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) carveRoad(m, x + dx, y + dy);
  }
  // 7) vilas
  m.villages = {};
  for (const [vid, v] of Object.entries(VILLAGES)) buildVillage(m, vid, v, r);
  // 8) sítios especiais e locais de missão
  buildSites(m, r);
  // 9) postos de territórios
  for (const tr of TERRITORIES) {
    if (tr.id.endsWith('_capital')) continue;
    const [tx, ty] = m.findWalkableNear(tr.x, tr.y, 8);
    tr.px = tx; tr.py = ty;
    const ox = tx * TILE + 8, oy = ty * TILE + 8;
    m.markers['out_' + tr.id] = [ox, oy];
    const flag = m.addObject(obj('flag', ox, oy, null, { territory: tr.id, box: { x: -2, y: -3, w: 6, h: 3 } }));
    flag.isFlag = true;
    m.addObject(obj('palisade', ox - 28, oy + 4, propSprite('palisade')));
    m.addObject(obj('palisade', ox + 28, oy + 4, propSprite('palisade')));
    m.addObject(obj('tent', ox - 22, oy - 20, buildingSprite('neutral', 'tent'), { tentFaction: true, territory: tr.id }));
    const cf = m.addObject(obj('campfire', ox + 18, oy - 14, propSprite('campfire', '', 0), { anim: 'campfire', light: { r: 56, color: '#ff9040', flick: true }, nightOnly: true }));
    cf.box = propSprite('campfire').box;
  }
  // 10) conectividade: garantir que tudo seja alcançável a pé a partir de Várden
  ensureConnectivity(m);
  // 11) vegetação, rochas e recursos
  decorate(m, r);
  return m;
}

function baseFor(reg) { return [T.GRASS, T.GRASS, T.ROCK, T.MARSH, T.ASH, T.GRASS, T.SNOW, T.GRASS][reg]; }
function carveRoad(m, x, y) {
  if (!m.inb(x, y) || x < 3 || y < 3 || x > m.w - 4 || y > m.h - 4) return;
  const t = m.get(x, y);
  if (t === T.WATER || t === T.DEEP || t === T.SWAMPW) m.set(x, y, T.BRIDGE);
  else if (t !== T.BRIDGE && t !== T.PLAZA) m.set(x, y, T.ROAD);
}

function addBuilding(m, style, type, tx, ty, id, opts = {}) {
  const spr = buildingSprite(style, type, opts.variant || 0);
  const px = tx * TILE + 8, py = ty * TILE + 14;
  const b = m.addObject(obj('building', px, py, spr, { bid: id, style, btype: type, variant: opts.variant || 0 }));
  // bloquear tiles cobertos pela base (exceto porta)
  const bx0 = Math.floor((px + spr.box.x) / TILE), bx1 = Math.floor((px + spr.box.x + spr.box.w - 1) / TILE);
  const by0 = Math.floor((py + spr.box.y) / TILE), by1 = Math.floor((py + spr.box.y + spr.box.h - 1) / TILE);
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) { const t = m.get(x, y); if (!TILE_INFO[t].water) m.set(x, y, t === T.ROAD ? T.DIRT : t); }
  // chão em frente à porta
  const dtx = Math.floor(px / TILE), dty = Math.floor(py / TILE) + 1;
  for (let k = -1; k <= 1; k++) { m.set(dtx + k, dty, T.PLAZA); m.set(dtx + k, dty + 1, T.ROAD); }
  if (opts.door !== false && type !== 'tent') {
    const door = { x: px, y: py + 4, target: 'int_' + id, bid: id, style, btype: type };
    m.doors.push(door); b.door = door;
    m.markers[id + '_door'] = [px, py + 14];
  }
  // luz das janelas à noite
  if (type !== 'stable' && type !== 'tent') { const l = m.addObject(obj('light', px, py - 6, null, { light: { r: Math.min(72, (spr.w || 48) * 0.6), color: '#ffb050', flick: false }, nightOnly: true, passable: true })); l.box = null; }
  if (type === 'smithy') { const l = m.addObject(obj('light', px - spr.w / 2 + 10, py - 6, null, { light: { r: 50, color: '#ff7020', flick: true } })); l.box = null; m.addObject(obj('anvil', px + 16, py + 18, propSprite('anvil'))); }
  return b;
}

function buildVillage(m, vid, v, r) {
  const F = FACTIONS[v.faction];
  const cx = v.x, cy = v.y;
  const vr = mulberry32(cx * 31 + cy);
  // praça central
  for (let y = -4; y <= 4; y++) for (let x = -5; x <= 5; x++) if (x * x / 30 + y * y / 20 <= 1) m.set(cx + x, cy + y, T.PLAZA);
  // ruas em cruz
  for (let k = -v.r; k <= v.r; k++) { for (const o of [0, 1]) { if (m.get(cx + k, cy + o) !== T.PLAZA) m.set(cx + k, cy + o, T.ROAD); if (m.get(cx + o, cy + k) !== T.PLAZA) m.set(cx + o, cy + k, T.ROAD); } }
  const info = { id: vid, x: cx, y: cy, buildings: {}, faction: v.faction, style: v.style };
  m.villages[vid] = info;
  for (const [bid, type, dx, dy] of v.buildings) {
    const id = `${vid}_${bid}`;
    const b = addBuilding(m, v.style, type, cx + dx, cy + dy, id, { variant: Math.floor(vr() * 3) });
    info.buildings[bid] = b;
  }
  // poço, fogueiras, barracas, bandeiras
  m.addObject(obj('well', (cx + 3) * TILE, (cy + 3) * TILE, propSprite('well')));
  for (const [dx, dy] of [[-5, -3], [6, -3], [-5, 4], [6, 4]]) m.addObject(obj('lamp', (cx + dx) * TILE + 8, (cy + dy) * TILE + 8, propSprite('lamppost'), { light: { r: 64, color: '#ffc060', flick: true }, nightOnly: true }));
  for (const [dx, dy] of [[-2, -5], [3, -5]]) m.addObject(obj('banner', (cx + dx) * TILE + 8, (cy + dy) * TILE + 8, null, { banner: true, village: vid, box: { x: -1, y: -3, w: 3, h: 3 } }));
  m.addObject(obj('stall', (cx - 3) * TILE, (cy + 3) * TILE + 8, propSprite('stall', F.color)));
  for (let i = 0; i < 6; i++) { const a = vr() * Math.PI * 2, d = 6 + vr() * (v.r - 6); const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d); if (m.get(x, y) === T.ROAD || m.get(x, y) === T.PLAZA) continue; m.addObject(obj(['barrel', 'crate', 'hay'][i % 3], x * TILE + 8, y * TILE + 12, propSprite(['barrel', 'crate', 'hay'][i % 3]))); }
  // muralha / paliçada com portões nas ruas e estradas
  if (v.wall) {
    const R = v.r + 1;
    const spr = v.wall === 'palisade' ? propSprite('palisade') : propSprite('stonewall', v.style === 'drakmor' ? '#5a504c' : '#6a6662');
    const placed = new Set();
    for (let a = 0; a < Math.PI * 2; a += 0.02) {
      const tx = Math.round(cx + Math.cos(a) * R), ty = Math.round(cy + Math.sin(a) * R * 0.85);
      const k = tx + ',' + ty; if (placed.has(k)) continue; placed.add(k);
      const t = m.get(tx, ty);
      if (t === T.ROAD || t === T.BRIDGE || t === T.PLAZA) { m.markers[`${vid}_gate_${Math.round(a * 10)}`] = [tx * TILE + 8, ty * TILE + 8]; continue; }
      if (TILE_INFO[t].water) continue;
      m.addObject(obj('wall', tx * TILE + 8, ty * TILE + 14, spr));
    }
  }
  m.markers[vid + '_plaza'] = [cx * TILE + 8, cy * TILE + 8];
  m.markers[vid + '_center'] = [cx * TILE + 8, (cy + 2) * TILE + 8];
  m.markers[vid + '_south'] = [cx * TILE + 8, (cy + v.r + 4) * TILE];
  m.markers[vid + '_east'] = [(cx + v.r + 4) * TILE, cy * TILE + 8];
  m.markers[vid + '_west'] = [(cx - v.r - 4) * TILE, cy * TILE + 8];
  m.markers[vid + '_north'] = [cx * TILE + 8, (cy - v.r - 4) * TILE];
  // fazenda/estábulo extra para Várden
  if (vid === 'varden') {
    const st = info.buildings.stable;
    for (let i = 0; i < 4; i++) m.addObject(obj('fenceH', st.x - 40 + i * 16, st.y + 34, propSprite('fenceH')));
    m.markers.varden_stable_yard = [st.x, st.y + 24];
    m.markers.varden_training = [(cx + 6) * TILE, (cy - 3) * TILE];
    for (let i = 0; i < 3; i++) m.addObject(obj('dummy', (cx + 4 + i * 2) * TILE + 8, (cy - 4) * TILE + 12, propSprite('dummy'), { dummy: true, did: 'dummy' + i }));
  }
}

function placeFarm(m, cx, cy, w, h) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const t = m.get(cx + x, cy + y); if (t !== T.ROAD && !TILE_INFO[t].solid) m.set(cx + x, cy + y, T.FARM); }
  for (let x = -1; x <= w; x++) { if (x % 3 === 0) continue; m.addObject(obj('fenceH', (cx + x) * TILE + 8, (cy - 1) * TILE + 14, propSprite('fenceH'))); }
}

function buildSites(m, r) {
  const M = m.markers;
  const at = (k, tx, ty) => { const [x, y] = m.findWalkableNear(tx, ty, 10); M[k] = [x * TILE + 8, y * TILE + 8]; return [x, y]; };
  // Fazenda de Hobb
  const [hx, hy] = at('hobb_farm', 132, 122);
  addBuilding(m, 'varden', 'house', hx, hy - 2, 'hobb_house', { variant: 1 });
  placeFarm(m, hx + 3, hy + 1, 8, 5); placeFarm(m, hx - 10, hy + 2, 7, 4);
  m.addObject(obj('hay', (hx + 2) * TILE, (hy + 1) * TILE, propSprite('hay')));
  at('hobb_coop', hx - 4, hy + 0);
  at('forest_edge', 112, 112); at('wolf_den', 100, 104); at('track1', 116, 116); at('track2', 108, 108); at('track3', 102, 101);
  at('burned_camp', 93, 97); at('fen_spot', 96, 101); at('feather_spot', 92, 95);
  at('jorund_wagon', 190, 121); at('bandit_camp1', 196, 106);
  at('abandoned_camp', 38, 100); at('camp_letter', 36, 99); at('camp_cloth', 41, 102); at('camp_map', 37, 104);
  at('mill', 126, 140); addBuilding(m, 'neutral', 'house', 126, 138, 'old_mill', { variant: 2, door: false });
  at('mill_meet', 128, 141); at('kael_trail1', 140, 128); at('kael_trail2', 133, 134);
  at('watch_eld', 102, 116); at('watch_drak', 198, 86); at('watch_sol', 214, 122);
  for (const k of ['watch_eld', 'watch_drak', 'watch_sol']) { const [x, y] = M[k]; m.addObject(obj('tower', x + 24, y - 8, buildingSprite('varden', 'tower'), { })); }
  at('troops_drak', 206, 76); at('troops_eld', 92, 120); at('troops_sol', 222, 128);
  // Vau de Ferro (aldeia)
  const [ix, iy] = at('ironford', 204, 96);
  addBuilding(m, 'neutral', 'house', ix - 4, iy - 3, 'ironford_h1', { door: false }); addBuilding(m, 'neutral', 'house', ix + 4, iy - 3, 'ironford_h2', { door: false, variant: 1 });
  at('ironford_v1', ix - 2, iy + 2); at('ironford_v2', ix + 3, iy + 2); at('ironford_v3', ix, iy + 4); at('ironford_exit', ix - 14, iy + 10);
  // ponte da batalha: ponte mais próxima de (178,132)
  let best = null, bd = 1e9;
  for (let y = 100; y < 160; y++) for (let x = 150; x < 210; x++) if (m.get(x, y) === T.BRIDGE) { const d = Math.hypot(x - 180, y - 130); if (d < bd) { bd = d; best = [x, y]; } }
  if (best) { at('bridge_battle', best[0], best[1]); at('bridge_west', best[0] - 6, best[1] + 1); at('bridge_east', best[0] + 7, best[1] - 1); }
  else { at('bridge_battle', 178, 132); at('bridge_west', 172, 133); at('bridge_east', 185, 131); }
  best = null; bd = 1e9;
  for (let y = 70; y < 130; y++) for (let x = 160; x < 220; x++) if (m.get(x, y) === T.BRIDGE) { const d = Math.hypot(x - 192, y - 102); if (d < bd) { bd = d; best = [x, y]; } }
  at('betrayal_bridge', best ? best[0] : 190, best ? best[1] : 104);
  at('betrayal_far', (best ? best[0] : 190) + 8, (best ? best[1] : 104) - 8);
  // cerco de Eldoria
  at('siege1', 55, 100); at('siege2', 40, 121); at('siege3', 70, 127);
  // refúgio no Bosque da Fronteira
  const [rx, ry] = at('refuge', 103, 124);
  for (const [dx, dy] of [[-4, -2], [3, -3], [-3, 3], [4, 2]]) m.addObject(obj('tent', (rx + dx) * TILE, (ry + dy) * TILE, buildingSprite('varden', 'tent'), { refugeOnly: true, box: buildingSprite('varden', 'tent').box }));
  const rcf = m.addObject(obj('campfire', rx * TILE + 8, ry * TILE + 8, propSprite('campfire'), { anim: 'campfire', light: { r: 70, color: '#ff9040', flick: true }, refugeOnly: true }));
  rcf.box = propSprite('campfire').box;
  for (const k of ['refuge_oswin', 'refuge_mira', 'refuge_tessa', 'refuge_bram', 'refuge_roderic', 'refuge_s1', 'refuge_s2', 'refuge_s3']) at(k, rx + Math.round((r() - 0.5) * 10), ry + Math.round((r() - 0.5) * 8));
  at('recruit1', 120, 104); at('recruit2', 140, 150); at('recruit3', 168, 100);
  // Ruínas Antigas
  const rs = SITES.ruins_main;
  for (let y = -6; y <= 6; y++) for (let x = -8; x <= 8; x++) if (x * x / 64 + y * y / 36 < 1 && m.walkable(rs.x + x, rs.y + y)) m.set(rs.x + x, rs.y + y, T.RUINF);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; m.addObject(obj('pillar', (rs.x + Math.cos(a) * 7) * TILE, (rs.y + Math.sin(a) * 5) * TILE, propSprite('pillar', '', i % 3 === 0 ? 1 : 0))); }
  m.addObject(obj('arch', rs.x * TILE + 8, (rs.y - 4) * TILE, propSprite('arch'), { box: null }));
  m.addObject(obj('statue', (rs.x - 4) * TILE, (rs.y + 1) * TILE, propSprite('statue')));
  m.addObject(obj('statue', (rs.x + 5) * TILE, (rs.y + 1) * TILE, propSprite('statue')));
  addDungeonEntrance(m, 'stairs', rs.x, rs.y, 'ruins_tomb');
  M.ruins_center = [rs.x * TILE + 8, (rs.y + 3) * TILE];
  at('teodoro_spot', rs.x + 3, rs.y + 4);
  // cavernas
  for (const [k, s] of Object.entries(SITES)) if (s.kind !== 'ruins') addDungeonEntrance(m, s.kind === 'mine' ? 'mine' : 'cave', s.x, s.y, k);
  // ermitã do pântano, criança perdida, Carvalho Ancestral etc.
  at('witch_hut', 30, 186); addBuilding(m, 'ravencross', 'house', 30, 184, 'witch_hut', { variant: 2 });
  at('lost_child', 22, 204); at('swamp_light1', 40, 206); at('swamp_light2', 28, 210);
  const [ox, oy] = at('ancient_oak', 26, 86);
  m.addObject(obj('tree', (ox + 2) * TILE, (oy - 1) * TILE, treeSprite('ancient', 0), { canopy: true }));
  m.addObject(obj('shrine', (ox - 2) * TILE, (oy + 2) * TILE, propSprite('shrine')));
  at('offering1', 18, 96); at('offering2', 34, 80); at('offering3', 14, 78);
  at('ash_relic1', 128, 172); at('ash_relic2', 176, 176); at('ash_relic3', 196, 186);
  at('bell_piece', 30, 30); at('wolf_alpha', 44, 50); at('frost_temple', 76, 27);
  at('fisher_spot', 272, 138); at('old_fisher', 274, 142); at('smuggler_beach', 276, 196);
  at('white_horse', 176, 102); at('lost_dog', 166, 140); at('fence_farm_a', 140, 100); at('fence_farm_b', 146, 98);
  placeFarm(m, 136, 101, 4, 3); placeFarm(m, 147, 96, 4, 3);
  at('hunter_ground', 70, 140); at('mine_ore', 232, 74); at('drakmor_gate', 240, 58); at('drakmor_camp', 238, 66);
  at('arena', 160, 112); at('tournament', 160, 112);
  at('coast_cliff', 280, 98); at('postcredit_shore', 278, 160); at('postcredit_sea', 296, 160);
  at('cinzamar_maren', 156, 199);
  at('caravan_road', 230, 176);
}

function addDungeonEntrance(m, kind, tx, ty, target) {
  const [x, y] = m.findWalkableNear(tx, ty, 6);
  const px = x * TILE + 8, py = y * TILE + 8;
  if (kind === 'stairs') m.addObject(obj('stairs', px, py + 8, propSprite('stairs'), { box: null }));
  else {
    // rochedo em volta da entrada
    m.addObject(obj('cave', px, py, propSprite('cave'), { box: null }));
    m.addObject(obj('rock', px - 26, py + 2, rockSprite('boulder', 1)));
    m.addObject(obj('rock', px + 26, py + 2, rockSprite('boulder', 2)));
  }
  const door = { x: px, y: py + 2, target, cave: true };
  m.doors.push(door);
  m.markers[target + '_entrance'] = [px, py + 16];
}

function ensureConnectivity(m) {
  const W = m.w, H = m.h;
  const reach = () => {
    const seen = new Uint8Array(W * H), q = [];
    const s = VILLAGES.varden; q.push(s.y * W + s.x); seen[s.y * W + s.x] = 1;
    while (q.length) { const c = q.pop(); const x = c % W, y = (c / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; const n = ny * W + nx; if (!m.inb(nx, ny) || seen[n] || m.solidTile(nx, ny)) continue; seen[n] = 1; q.push(n); } }
    return seen;
  };
  const targets = Object.values(m.markers).map(([px, py]) => [Math.floor(px / TILE), Math.floor(py / TILE)]);
  for (const d of m.doors) targets.push([Math.floor(d.x / TILE), Math.floor(d.y / TILE) + 1]);
  let seen = reach();
  for (const [tx, ty] of targets) {
    if (!m.inb(tx, ty) || seen[ty * W + tx]) continue;
    // escavar caminho até a área alcançável mais próxima
    const path = astar(m, tx, ty, VILLAGES.varden.x, VILLAGES.varden.y, (x, y) => { const t = m.get(x, y); if (x < 3 || y < 3 || x > W - 4 || y > H - 4) return Infinity; if (seen[y * W + x]) return 0.5; if (t === T.DEEP && x > 270) return Infinity; return TILE_INFO[t].solid ? 8 : 1; });
    if (path) for (const [x, y] of path) { if (seen[y * W + x]) break; const t = m.get(x, y); if (TILE_INFO[t].water) m.set(x, y, T.BRIDGE); else if (TILE_INFO[t].solid) m.set(x, y, T.DIRT); m.block[y * W + x] = 0; }
    seen = reach();
  }
}

function decorate(m, r) {
  const W = m.w, H = m.h;
  const nearProtected = (tx, ty) => {
    const t = m.get(tx, ty);
    if (t === T.ROAD || t === T.PLAZA || t === T.BRIDGE || t === T.FARM || t === T.RUINF || TILE_INFO[t].solid) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) { const n = m.get(tx + dx, ty + dy); if (n === T.ROAD || n === T.PLAZA || n === T.BRIDGE) return true; }
    return false;
  };
  const vil = Object.values(VILLAGES), terr = TERRITORIES;
  const marks = Object.values(m.markers);
  const reserved = (tx, ty) => {
    for (const v of vil) if (Math.hypot(tx - v.x, ty - v.y) < v.r + 2.5) return true;
    for (const s of Object.values(SITES)) if (Math.hypot(tx - s.x, ty - s.y) < 6) return true;
    for (const t of terr) if (Math.hypot(tx - (t.px ?? t.x), ty - (t.py ?? t.y)) < 4) return true;
    return false;
  };
  const markerNear = (tx, ty) => { for (const [mx, my] of marks) if (Math.abs(mx / TILE - tx) < 2.5 && Math.abs(my / TILE - ty) < 2.5) return true; return false; };
  m.chestSpots = [];
  for (let ty = 4; ty < H - 4; ty++) for (let tx = 4; tx < W - 4; tx++) {
    if (nearProtected(tx, ty) || reserved(tx, ty) || markerNear(tx, ty)) continue;
    const reg = m.reg(tx, ty), R = REGIONS[reg], t = m.get(tx, ty);
    if (t === T.SWAMPW) { if (hash2(tx, ty, 31) < 0.05) m.addObject(obj('plant', tx * TILE + 8, ty * TILE + 12, plantSprite('reeds', tx % 3), { passable: true })); continue; }
    const h = hash2(tx, ty, 5), clump = fbm(tx / 7, ty / 7, 77, 2);
    let dens = R.treeDensity * (reg === 0 ? (t === T.FOREST ? 1.4 : 0.6) : 1) * (clump > 0.5 ? 1.6 : 0.5);
    if (reg === 1) dens *= clump > 0.62 ? 6 : 0.4;
    const px = tx * TILE + 8 + Math.floor((hash2(tx, ty, 8) - 0.5) * 8), py = ty * TILE + 12 + Math.floor((hash2(tx, ty, 9) - 0.5) * 6);
    if (h < dens && (tx + ty) % 2 === 0) {
      let kind = R.trees[Math.floor(hash2(tx, ty, 6) * R.trees.length)];
      if (reg === 2 && t === T.SNOW) kind = 'snowpine';
      if (reg === 7 && t === T.FOREST) kind = 'oak';
      m.addObject(obj('tree', px, py, treeSprite(kind, Math.floor(hash2(tx, ty, 7) * 4)), { canopy: true, tk: kind }));
      continue;
    }
    const h2 = hash2(tx, ty, 41);
    if (h2 < 0.012) { const k = reg === 6 ? 'snow' : reg === 4 ? 'ash' : reg === 0 ? 'mossy' : 'rock'; m.addObject(obj('rock', px, py, rockSprite(hash2(tx, ty, 2) < 0.3 ? 'boulder' : k, Math.floor(h2 * 1000) % 4))); continue; }
    if (h2 < 0.028) { const k = reg === 6 ? 'snowbush' : reg === 4 ? 'ashbush' : hash2(tx, ty, 3) < 0.25 ? 'berry' : 'bush'; m.addObject(obj('bush', px, py, plantSprite(k, (tx * 7 + ty) % 4), { box: { x: -6, y: -4, w: 12, h: 4 }, berry: k === 'berry' })); continue; }
    if (h2 < 0.06) {
      const k = reg === 3 ? (hash2(tx, ty, 4) < 0.5 ? 'reeds' : 'fern') : reg === 6 ? null : reg === 4 ? 'deadbush' : reg === 0 ? (hash2(tx, ty, 4) < 0.5 ? 'fern' : 'flowers') : reg === 5 ? 'tallgrass' : hash2(tx, ty, 4) < 0.5 ? 'tallgrass' : 'flowers';
      if (k) m.addObject(obj('plant', px, py, plantSprite(k, (tx + ty * 3) % 4), { passable: true }));
      continue;
    }
    // recursos coletáveis
    const h3 = hash2(tx, ty, 61);
    if (h3 < 0.0045 && (reg === 0 || reg === 1 || reg === 7 || reg === 5)) { m.addObject(obj('gather', px, py, plantSprite('herb'), { res: 'herb', passable: true })); continue; }
    if (h3 < 0.006 && reg === 3) { m.addObject(obj('gather', px, py, plantSprite('mushroom'), { res: 'mushroom', passable: true })); continue; }
    if (h3 < 0.008 && reg === 2) { m.addObject(obj('gather', px, py, rockSprite('ore', tx % 4), { res: 'ore' })); continue; }
    if (h3 < 0.003 && (reg === 0 || reg === 6)) { m.addObject(obj('gather', px, py, plantSprite('log'), { res: 'wood', box: { x: -12, y: -4, w: 24, h: 4 } })); continue; }
    if (h3 < 0.003 && reg === 4) { m.addObject(obj('gather', px, py, rockSprite('gem', tx % 4), { res: 'gem' })); continue; }
    if (h3 < 0.0045 && reg === 4) { m.addObject(obj('vent', px, py, propSprite('vent'), { passable: true, smoke: true })); continue; }
    if (h3 > 0.9985) m.chestSpots.push([tx, ty]);
  }
  // pontos de pesca ao longo da água
  m.fishSpots = [];
  for (let ty = 4; ty < H - 4; ty += 3) for (let tx = 4; tx < W - 4; tx += 3) {
    const t = m.get(tx, ty);
    if ((t === T.WATER) && hash2(tx, ty, 71) < 0.06) {
      let shore = false; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (m.walkable(tx + dx, ty + dy)) shore = true;
      if (shore) m.fishSpots.push([tx, ty]);
    }
  }
}
