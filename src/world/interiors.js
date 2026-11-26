// Interiores de construções e masmorras (cavernas, minas, ruínas) gerados sob demanda.
import { TILE, mulberry32, hashStr } from '../core/util.js';
import { T } from '../gfx/tiles.js';
import { GameMap } from './map.js';
import { propSprite, rockSprite, plantSprite } from '../gfx/objects.js';
import { obj } from './gen.js';
import { FACTIONS } from '../data/world.js';

const STYLE_REG = { eldoria: 0, varden: 1, drakmor: 2, ravencross: 7, cinzamar: 4, solaria: 5, frostheim: 6, neutral: 1 };
const FAC_OF_STYLE = { varden: 'varden', eldoria: 'eldoria', drakmor: 'drakmor', solaria: 'solaria', frostheim: 'frostheim', cinzamar: 'cinzamar', ravencross: 'ravencross' };

function room(id, w, h, style, opts = {}) {
  const reg = STYLE_REG[style] ?? 1;
  const m = new GameMap(id, w, h, { fill: T.VOID, region: reg, interior: true, dark: opts.dark ?? 0.25, music: opts.music, name: id });
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) m.set(x, y, y <= 2 ? T.WALL : opts.floor ?? T.WOOD);
  for (let y = 0; y < h; y++) { m.set(0, y, T.WALL); m.set(w - 1, y, T.WALL); }
  for (let x = 0; x < w; x++) { m.set(x, 0, T.WALL); m.set(x, h - 1, T.WALL); }
  // saída no centro inferior
  const ex = w >> 1;
  m.set(ex, h - 1, opts.floor ?? T.WOOD);
  m.exitDoor = { x: ex * TILE + 8, y: (h - 1) * TILE + 8 };
  m.markers.entry = [ex * TILE + 8, (h - 2) * TILE + 6];
  m.markers.center = [ex * TILE + 8, (h >> 1) * TILE + 8];
  return m;
}
const P = (m, kind, tx, ty, a, b, extra = {}) => { const s = propSprite(kind, a, b); return m.addObject(obj(kind, tx * TILE + 8, ty * TILE + 12, s, extra)); };

export function createInterior(id, door) {
  const bid = id.replace(/^int_/, '');
  const style = (door && door.style) || 'neutral';
  const btype = (door && door.btype) || 'house';
  const fac = FAC_OF_STYLE[style];
  const fcol = fac ? FACTIONS[fac].color : '#8a6a3a';
  const r = mulberry32(hashStr(id));
  const music = fac || 'varden';
  let m;
  switch (btype) {
    case 'hall': {
      m = room(id, 22, 15, style, { floor: T.STONEF, music });
      for (let y = 4; y < 14; y++) for (let x = 9; x <= 12; x++) m.set(x, y, T.CARPET);
      P(m, 'throne', 11, 4, fcol); m.markers.throne = [11 * TILE + 8, 5 * TILE + 12];
      for (const x of [3, 18]) for (const y of [5, 9, 12]) P(m, 'pillar', x, y, '#a8a090');
      for (const x of [6, 15]) P(m, 'banner', x, 3, fcol, 0, { box: null });
      P(m, 'table', 5, 8, '', 1); P(m, 'table', 16, 8, '', 1);
      for (const [x, y] of [[4, 7], [6, 7], [15, 7], [17, 7]]) P(m, 'chair', x, y);
      P(m, 'fireplace', 3, 3, '', 0, { anim: 'fireplace', light: { r: 80, color: '#ff8030', flick: true } });
      P(m, 'fireplace', 18, 3, '', 0, { anim: 'fireplace', light: { r: 80, color: '#ff8030', flick: true } });
      m.markers.council1 = [5 * TILE, 10 * TILE]; m.markers.council2 = [16 * TILE, 10 * TILE]; m.markers.council3 = [8 * TILE, 7 * TILE]; m.markers.council4 = [14 * TILE, 7 * TILE];
      m.markers.spot1 = [8 * TILE, 11 * TILE]; m.markers.spot2 = [14 * TILE, 11 * TILE]; m.markers.guard1 = [9 * TILE, 13 * TILE]; m.markers.guard2 = [13 * TILE, 13 * TILE];
      if (bid === 'varden_hall') { // cofre do Coração atrás do trono
        P(m, 'pedestal', 15, 4); m.markers.pedestal = [15 * TILE + 8, 5 * TILE + 14];
        const heart = P(m, 'heart', 15, 3, '#b050ff', 0, { heartRelic: true, light: { r: 36, color: '#b050ff' }, passable: true }); heart.y -= 6;
      }
      break;
    }
    case 'tavern': {
      m = room(id, 18, 12, style, { music: 'varden' });
      P(m, 'counter', 5, 4); m.markers.counter = [5 * TILE + 8, 3 * TILE + 14];
      for (const [x, y] of [[11, 6], [14, 6], [11, 9], [5, 9]]) { P(m, 'table', x, y, '', r() < 0.6 ? 1 : 0); P(m, 'chair', x - 2, y); P(m, 'chair', x + 2, y); }
      P(m, 'fireplace', 15, 3, '', 0, { anim: 'fireplace', light: { r: 90, color: '#ff8030', flick: true } });
      for (let i = 0; i < 3; i++) P(m, 'barrel', 1 + i, 3);
      P(m, 'rug', 9, 8, fcol);
      m.markers.spot1 = [10 * TILE, 7 * TILE]; m.markers.spot2 = [13 * TILE, 10 * TILE]; m.markers.spot3 = [6 * TILE, 10 * TILE]; m.markers.bard = [15 * TILE, 9 * TILE];
      break;
    }
    case 'smithy': {
      m = room(id, 14, 10, style, { floor: T.STONEF, music: 'varden' });
      P(m, 'fireplace', 3, 3, '', 0, { anim: 'fireplace', light: { r: 90, color: '#ff6a20', flick: true } });
      P(m, 'anvil', 6, 5); P(m, 'weaponrack', 10, 3); P(m, 'barrel', 12, 6); P(m, 'crate', 12, 8);
      m.markers.forge = [6 * TILE + 8, 6 * TILE + 12];
      break;
    }
    case 'archive': {
      m = room(id, 16, 12, style, { music: 'ruins' });
      for (let x = 2; x < 14; x += 4) { P(m, 'shelf', x, 4); P(m, 'shelf', x, 7); }
      P(m, 'table', 8, 9, '', 1); P(m, 'chair', 6, 9); P(m, 'scroll', 9, 8);
      m.markers.desk = [8 * TILE + 8, 10 * TILE + 8];
      m.markers.clue1 = [3 * TILE + 8, 5 * TILE + 14]; m.markers.clue2 = [12 * TILE + 8, 9 * TILE + 8]; m.markers.clue3 = [13 * TILE + 8, 6 * TILE + 8];
      break;
    }
    case 'temple': {
      m = room(id, 16, 13, style, { floor: T.STONEF, music: fac || 'eldoria' });
      P(m, 'shrine', 8, 3, '', 0, { light: { r: 60, color: '#60ffb0' } });
      for (let y = 6; y < 11; y += 2) { P(m, 'chair', 4, y); P(m, 'chair', 6, y); P(m, 'chair', 10, y); P(m, 'chair', 12, y); }
      for (const x of [2, 14]) P(m, 'torch', x, 3, '', 0, { light: { r: 50, color: '#ffa040', flick: true } });
      m.markers.altar = [8 * TILE + 8, 5 * TILE + 8];
      break;
    }
    case 'fort': {
      m = room(id, 14, 10, style, { floor: T.STONEF, music });
      for (let x = 2; x < 12; x += 3) P(m, 'bed', x, 4, fcol);
      P(m, 'weaponrack', 7, 7); P(m, 'table', 10, 8);
      break;
    }
    case 'tower': {
      m = room(id, 10, 10, style, { floor: T.STONEF, music: 'tension', dark: 0.5 });
      P(m, 'pedestal', 5, 4); m.markers.pedestal = [5 * TILE + 8, 5 * TILE + 14];
      for (const x of [2, 8]) P(m, 'torch', x, 3, '', 0, { light: { r: 46, color: '#ffa040', flick: true } });
      break;
    }
    case 'stable': {
      m = room(id, 16, 10, style, { floor: T.DIRT, music: 'varden' });
      for (let x = 2; x < 14; x += 4) { P(m, 'hay', x, 4); P(m, 'fenceV', x + 2, 4); }
      m.markers.stalls = [8 * TILE, 7 * TILE];
      break;
    }
    case 'shop': {
      m = room(id, 14, 10, style, { music: 'varden' });
      P(m, 'counter', 7, 5); m.markers.counter = [7 * TILE + 8, 4 * TILE + 12];
      P(m, 'shelf', 3, 3); P(m, 'shelf', 11, 3); P(m, 'crate', 2, 7); P(m, 'barrel', 12, 7); P(m, 'pot', 4, 7);
      break;
    }
    default: { // casa
      m = room(id, 12, 9, style, { music: music === 'varden' ? 'varden' : music });
      P(m, 'bed', 2, 5, fcol); P(m, 'table', 7, 5, '', r() < 0.5 ? 1 : 0); P(m, 'chair', 5, 5); P(m, 'chair', 9, 5);
      P(m, 'fireplace', 9, 3, '', 0, { anim: 'fireplace', light: { r: 70, color: '#ff8030', flick: true } });
      P(m, 'shelf', 5, 3); P(m, 'rug', 6, 7, fcol); if (r() < 0.6) P(m, 'pot', 10, 7);
      m.markers.bed = [2 * TILE + 8, 6 * TILE]; m.markers.spot1 = [7 * TILE, 7 * TILE];
      m.markers.chest = [10 * TILE + 8, 7 * TILE + 8];
      if (bid === 'varden_kael_house') m.markers.kael_desk = [7 * TILE + 8, 6 * TILE + 12];
    }
  }
  m.parentDoor = door;
  return m;
}

// ---------- Masmorras ----------
export const DUNGEONS = {
  cave_whisper: { w: 56, h: 42, kind: 'cave', danger: 2, music: 'cave' },
  cave_smugglers: { w: 50, h: 38, kind: 'cave', danger: 2, music: 'cave' },
  mine_old: { w: 52, h: 40, kind: 'mine', danger: 2, music: 'cave' },
  cave_bear: { w: 44, h: 34, kind: 'ice', danger: 3, music: 'cave' },
  cave_ash: { w: 46, h: 36, kind: 'cave', danger: 3, music: 'cave' },
  cave_eldoria: { w: 44, h: 34, kind: 'moss', danger: 2, music: 'cave' },
  cave_swamp: { w: 44, h: 34, kind: 'moss', danger: 3, music: 'cave' },
  ruins_tomb: { w: 48, h: 44, kind: 'tomb', danger: 2, music: 'ruins' },
};

export function createDungeon(id) {
  const D = DUNGEONS[id];
  if (D.kind === 'tomb') return createTomb(id, D);
  const r = mulberry32(hashStr(id) + 5);
  const W = D.w, H = D.h;
  const reg = D.kind === 'ice' ? 6 : D.kind === 'moss' ? 0 : 4;
  const m = new GameMap(id, W, H, { fill: T.CAVEW, region: reg, interior: true, dark: 0.88, music: D.music, name: id });
  let g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = x < 2 || y < 2 || x > W - 3 || y > H - 3 ? 1 : r() < 0.44 ? 1 : 0;
  for (let it = 0; it < 5; it++) {
    const n = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; c += xx < 0 || yy < 0 || xx >= W || yy >= H ? 1 : g[yy * W + xx]; }
      n[y * W + x] = c >= 5 ? 1 : 0;
      if (x < 2 || y < 2 || x > W - 3 || y > H - 3) n[y * W + x] = 1;
    }
    g = n;
  }
  // entrada embaixo no centro, garantir corredor
  const ex = W >> 1, ey = H - 3;
  for (let y = ey - 6; y <= H - 2; y++) for (let x = ex - 1; x <= ex + 1; x++) g[y * W + x] = 0;
  // manter só a região conectada à entrada; distância BFS
  const dist = new Int32Array(W * H).fill(-1); const q = [ey * W + ex]; dist[ey * W + ex] = 0;
  for (let qi = 0; qi < q.length; qi++) { const c = q[qi]; const x = c % W, y = (c / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, nn = ny * W + nx; if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1 || g[nn] || dist[nn] >= 0) continue; dist[nn] = dist[c] + 1; q.push(nn); } }
  // se a área for pequena, cavar túneis aleatórios
  if (q.length < W * H * 0.25) {
    let x = ex, y = ey - 6;
    for (let s = 0; s < W * H * 0.3; s++) { g[y * W + x] = 0; g[y * W + x + 1] = 0; const d = Math.floor(r() * 4); x = Math.max(3, Math.min(W - 4, x + [1, -1, 0, 0][d])); y = Math.max(3, Math.min(H - 4, y + [0, 0, 1, -1][d] - (r() < 0.15 ? 1 : 0))); }
    return createDungeonFromGrid(id, D, m, g, r, W, H, ex, ey);
  }
  return createDungeonFromGrid(id, D, m, g, r, W, H, ex, ey);
}

function createDungeonFromGrid(id, D, m, g, r, W, H, ex, ey) {
  const dist = new Int32Array(W * H).fill(-1); const q = [ey * W + ex]; dist[ey * W + ex] = 0;
  for (let qi = 0; qi < q.length; qi++) { const c = q[qi]; const x = c % W, y = (c / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, nn = ny * W + nx; if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1 || g[nn] || dist[nn] >= 0) continue; dist[nn] = dist[c] + 1; q.push(nn); } }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const open = dist[y * W + x] >= 0;
    m.set(x, y, open ? (D.kind === 'ice' && (x + y) % 7 === 0 ? T.ICE : T.CAVEF) : T.CAVEW);
  }
  m.set(ex, H - 2, T.CAVEF); m.set(ex, H - 1, T.CAVEF);
  m.exitDoor = { x: ex * TILE + 8, y: (H - 1) * TILE + 8 };
  m.markers.entry = [ex * TILE + 8, (H - 3) * TILE + 8];
  // pontos por distância
  const cells = q.map((c) => [c % W, (c / W) | 0, dist[c]]).filter(([x, y]) => g[(y) * W + x] === 0 && m.get(x, y + 1) !== T.CAVEW && m.get(x + 1, y) !== T.CAVEW);
  cells.sort((a, b) => a[2] - b[2]);
  const maxD = cells.length ? cells[cells.length - 1][2] : 1;
  const pick = (frac) => { const target = maxD * frac; let best = cells[0]; for (const c of cells) if (Math.abs(c[2] - target) < Math.abs(best[2] - target)) best = c; return best; };
  const end = cells[cells.length - 1] || [ex, ey - 4];
  m.markers.end = [end[0] * TILE + 8, end[1] * TILE + 8];
  for (const [k, f] of [['mid1', 0.3], ['mid2', 0.55], ['mid3', 0.75], ['near', 0.12]]) { const c = pick(f); m.markers[k] = [c[0] * TILE + 8, c[1] * TILE + 8]; }
  // becos sem saída para baús
  const deadEnds = cells.filter(([x, y]) => { let walls = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (m.get(x + dx, y + dy) === T.CAVEW) walls++; return walls === 3; });
  m.chestSpots = deadEnds.slice(0, 3).map(([x, y]) => [x, y]);
  if (m.chestSpots.length < 2) m.chestSpots.push([end[0], end[1]]);
  // decoração
  for (const [x, y, d] of cells) {
    const h = r();
    if (d < 4) continue;
    if (h < 0.02) m.addObject(obj('rock', x * TILE + 8, y * TILE + 12, rockSprite(D.kind === 'ice' ? 'snow' : 'rock', Math.floor(r() * 4))));
    else if (h < 0.03) m.addObject(obj('plant', x * TILE + 8, y * TILE + 12, plantSprite(D.kind === 'moss' ? 'mushroom' : 'crystal', Math.floor(r() * 3)), { passable: true, light: D.kind !== 'moss' ? { r: 24, color: '#60c0ff' } : null }));
    else if (h < 0.036) m.addObject(obj('bones', x * TILE + 8, y * TILE + 12, propSprite('bones'), { passable: true }));
    else if (h < 0.045 && D.kind === 'mine') m.addObject(obj('gather', x * TILE + 8, y * TILE + 12, rockSprite('ore', Math.floor(r() * 4)), { res: 'ore' }));
    else if (h < 0.05 && D.kind === 'moss') m.addObject(obj('gather', x * TILE + 8, y * TILE + 12, plantSprite('mushroom', 1), { res: 'mushroom', passable: true }));
  }
  for (const f of [0.08, 0.35, 0.6, 0.85]) { const c = pick(f); m.addObject(obj('torch', c[0] * TILE + 8, c[1] * TILE + 12, propSprite('torch'), { light: { r: 54, color: '#ffa040', flick: true }, passable: true })); }
  return m;
}

// Tumba das ruínas: salas estruturadas + Sala dos Sete trancada
function createTomb(id, D) {
  const W = D.w, H = D.h;
  const m = new GameMap(id, W, H, { fill: T.VOID, region: 7, interior: true, dark: 0.85, music: 'ruins', name: id });
  const carve = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) m.set(x, y, T.RUINF); for (let x = x0 - 1; x <= x0 + w; x++) { if (m.get(x, y0 - 1) === T.VOID) m.set(x, y0 - 1, T.WALL); if (m.get(x, y0 - 2) === T.VOID) m.set(x, y0 - 2, T.WALL); if (m.get(x, y0 + h) === T.VOID) m.set(x, y0 + h, T.WALL); } for (let y = y0 - 2; y <= y0 + h; y++) { if (m.get(x0 - 1, y) === T.VOID) m.set(x0 - 1, y, T.WALL); if (m.get(x0 + w, y) === T.VOID) m.set(x0 + w, y, T.WALL); } };
  // salas
  carve(20, 34, 9, 7);   // entrada
  carve(23, 26, 3, 8);   // corredor
  carve(14, 18, 21, 8);  // salão das alavancas
  carve(4, 20, 10, 3);   // corredor oeste
  carve(3, 10, 10, 10);  // cripta oeste
  carve(35, 20, 9, 3);   // corredor leste
  carve(36, 8, 9, 12);   // galeria leste (biblioteca)
  carve(22, 10, 5, 8);   // corredor norte (portão)
  carve(17, 2, 15, 8);   // câmara da espada / Sala dos Sete
  m.set(24, 41, T.RUINF); m.set(24, 42, T.RUINF); m.set(24, 43, T.RUINF);
  m.exitDoor = { x: 24 * TILE + 8, y: 43 * TILE + 8 };
  m.markers.entry = [24 * TILE + 8, 38 * TILE + 8];
  m.markers.lever_hall = [24 * TILE + 8, 21 * TILE + 8];
  m.markers.crypt = [8 * TILE + 8, 14 * TILE + 8];
  m.markers.library = [40 * TILE + 8, 13 * TILE + 8];
  m.markers.sword_chamber = [24 * TILE + 8, 5 * TILE + 8];
  m.markers.mid1 = [24 * TILE + 8, 30 * TILE + 8]; m.markers.mid2 = [16 * TILE + 8, 22 * TILE + 8]; m.markers.mid3 = [32 * TILE + 8, 22 * TILE + 8];
  m.markers.end = m.markers.sword_chamber;
  m.markers.tome1 = [38 * TILE + 8, 10 * TILE + 8]; m.markers.tome2 = [43 * TILE + 8, 17 * TILE + 8]; m.markers.tome3 = [5 * TILE + 8, 12 * TILE + 8];
  // alavancas
  m.addObject(obj('lever', 16 * TILE + 8, 19 * TILE + 12, propSprite('lever', '', 0), { lever: 'lever1' }));
  m.addObject(obj('lever', 32 * TILE + 8, 19 * TILE + 12, propSprite('lever', '', 0), { lever: 'lever2' }));
  m.addObject(obj('lever', 8 * TILE + 8, 11 * TILE + 12, propSprite('lever', '', 0), { lever: 'lever3' }));
  // portão de pedra (removido quando as 3 alavancas estiverem ativas)
  for (let x = 22; x <= 26; x++) m.addObject(obj('gate', x * TILE + 8, 11 * TILE + 14, propSprite('stonewall', '#5a5650'), { gate: 'tomb_gate' }));
  // decoração
  for (const [x, y] of [[15, 19], [33, 19], [15, 24], [33, 24], [18, 3], [31, 3], [18, 8], [31, 8]]) m.addObject(obj('pillar', x * TILE + 8, y * TILE + 12, propSprite('pillar', '#8a847a', (x + y) % 3 === 0 ? 1 : 0)));
  for (const [x, y] of [[4, 12], [11, 12], [4, 17], [11, 17]]) m.addObject(obj('grave', x * TILE + 8, y * TILE + 12, propSprite('grave')));
  for (let x = 37; x < 45; x += 3) m.addObject(obj('shelf', x * TILE + 8, 9 * TILE + 12, propSprite('shelf')));
  m.addObject(obj('mural', 24 * TILE + 8, 3 * TILE + 4, propSprite('mural'), { mural: true, passable: true }));
  for (const [x, y] of [[21, 36], [27, 36], [17, 21], [31, 21], [6, 14], [40, 12], [20, 5], [29, 5]]) m.addObject(obj('torch', x * TILE + 8, y * TILE + 12, propSprite('torch'), { light: { r: 56, color: '#ffa040', flick: true }, passable: true }));
  m.chestSpots = [[11, 18], [43, 18]];
  return m;
}
