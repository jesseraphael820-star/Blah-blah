// Tiles procedurais com variações por região, transições suaves e água animada.
import { hash2, mulberry32, valueNoise } from '../core/util.js';
import { hexToRgb, mix, darken, lighten } from './canvas.js';

export const T = {
  GRASS: 0, FOREST: 1, DIRT: 2, ROAD: 3, SAND: 4, WATER: 5, DEEP: 6, SWAMPW: 7, MUD: 8, SNOW: 9, ICE: 10, ROCK: 11, CLIFF: 12,
  ASH: 13, PLAZA: 14, WOOD: 15, BRIDGE: 16, WALL: 17, CAVEF: 18, CAVEW: 19, FARM: 20, RUINF: 21, CARPET: 22, MARSH: 23, VOID: 24, STONEF: 25,
};
// prioridade de sobreposição nas bordas (maior invade o menor)
export const TILE_INFO = [];
const def = (id, o) => (TILE_INFO[id] = Object.assign({ solid: false, water: false, surf: 'grass', speed: 1, prio: 0 }, o));
def(T.GRASS, { prio: 6, surf: 'grass' });
def(T.FOREST, { prio: 7, surf: 'grass' });
def(T.DIRT, { prio: 3, surf: 'dirt' });
def(T.ROAD, { prio: 2, surf: 'dirt', speed: 1.12 });
def(T.SAND, { prio: 4, surf: 'dirt' });
def(T.WATER, { water: true, solid: true, surf: 'water' });
def(T.DEEP, { water: true, solid: true, surf: 'water' });
def(T.SWAMPW, { water: true, solid: false, surf: 'water', speed: 0.55 });
def(T.MUD, { prio: 2, surf: 'mud', speed: 0.8 });
def(T.SNOW, { prio: 8, surf: 'snow', speed: 0.92 });
def(T.ICE, { prio: 1, surf: 'stone', speed: 1.05 });
def(T.ROCK, { prio: 5, surf: 'stone' });
def(T.CLIFF, { solid: true, prio: 10, surf: 'stone' });
def(T.ASH, { prio: 4, surf: 'dirt', speed: 0.95 });
def(T.PLAZA, { prio: 1, surf: 'stone', speed: 1.1 });
def(T.WOOD, { surf: 'wood' });
def(T.BRIDGE, { surf: 'wood', speed: 1.1 });
def(T.WALL, { solid: true, surf: 'stone' });
def(T.CAVEF, { surf: 'stone' });
def(T.CAVEW, { solid: true, surf: 'stone' });
def(T.FARM, { prio: 1, surf: 'dirt', speed: 0.9 });
def(T.RUINF, { prio: 1, surf: 'stone' });
def(T.CARPET, { surf: 'wood' });
def(T.MARSH, { prio: 6, surf: 'mud', speed: 0.9 });
def(T.VOID, { solid: true });
def(T.STONEF, { surf: 'stone' });

// paletas de grama por região (0 Eldoria,1 Várden,2 Ferro,3 Pântano,4 Cinzas,5 Costa,6 Norte,7 Ruínas)
const GRASS_PAL = [
  ['#3f7a35', '#2f5e2a', '#5a9a43'], ['#5c9a3e', '#467d33', '#7cb850'], ['#6a7d4a', '#56663c', '#839560'], ['#5b6b33', '#47552a', '#727f3f'],
  ['#6b6b55', '#55554a', '#808067'], ['#86a248', '#6c873a', '#a2bd5c'], ['#7f9a8a', '#677f71', '#9bb3a5'], ['#6f8f4a', '#5a763c', '#89a85e'],
];
const WATER_PAL = [
  ['#2f6f8f', '#3f8fb0', '#a8dcef'], ['#3277a0', '#4592bd', '#b5e3f5'], ['#335f7c', '#45789a', '#a5cfe2'], ['#3e5a3a', '#4f6e45', '#8fae78'],
  ['#3d5560', '#4e6a78', '#9fb5bf'], ['#1f8aa8', '#36a9c6', '#c6f1fa'], ['#4a7fa8', '#6a9cc2', '#e0f2fb'], ['#30708a', '#4389a5', '#acdaeb'],
];
const FLOWERS = ['#f4e04d', '#ffffff', '#e8607c', '#a77de8', '#ff9b4a', '#7fd3ff'];

const SIZE = 16;
function newBuf() { return new Uint8ClampedArray(SIZE * SIZE * 4); }
function put(b, x, y, hex, a = 255) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const [r, g, bb] = hexToRgb(hex), i = (y * SIZE + x) * 4, t = a / 255;
  b[i] = b[i] * (1 - t) + r * t; b[i + 1] = b[i + 1] * (1 - t) + g * t; b[i + 2] = b[i + 2] * (1 - t) + bb * t; b[i + 3] = 255;
}
function fill(b, fn) { for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) put(b, x, y, fn(x, y)); }

const painters = {
  [T.GRASS](b, r, reg, v) {
    const [base, dark, light] = GRASS_PAL[reg];
    fill(b, (x, y) => { const n = valueNoise((x + v * 16) / 5, y / 5, 7); return n < 0.33 ? dark : n > 0.72 ? mix(base, light, 0.5) : base; });
    for (let i = 0; i < 14; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 15); put(b, x, y, light); put(b, x, y + 1, base); if (r() < 0.5) put(b, x + 1, y + 1, dark); }
    if (reg !== 4 && reg !== 6 && r() < 0.35) for (let i = 0; i < 1 + r() * 3; i++) { const x = 2 + Math.floor(r() * 12), y = 2 + Math.floor(r() * 12), c = FLOWERS[Math.floor(r() * FLOWERS.length)]; put(b, x, y, c); put(b, x, y + 1, dark); }
    if (reg === 6) for (let i = 0; i < 6; i++) put(b, Math.floor(r() * 16), Math.floor(r() * 16), '#e8f2f0');
  },
  [T.FOREST](b, r, reg, v) {
    const [base, dark] = GRASS_PAL[reg];
    const d2 = darken(base, 0.25), d3 = darken(base, 0.4);
    fill(b, (x, y) => { const n = valueNoise((x + v * 16) / 4, y / 4, 3); return n < 0.35 ? d3 : n < 0.65 ? d2 : dark; });
    const leaf = reg === 0 ? ['#6b4a2a', '#8a5f2e', '#4d6b2a'] : ['#5a4a30', '#6e5a35', '#46562a'];
    for (let i = 0; i < 9; i++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 15); put(b, x, y, leaf[i % 3]); put(b, x + 1, y, darken(leaf[i % 3], 0.2)); }
    if (r() < 0.4) { const x = 3 + Math.floor(r() * 10), y = 3 + Math.floor(r() * 10); put(b, x, y, '#d8d0b0'); put(b, x, y + 1, '#8a6a4a'); }
  },
  [T.DIRT](b, r, reg) {
    const base = reg === 4 ? '#6e6258' : reg === 3 ? '#5e4d33' : '#8a6a44';
    fill(b, (x, y) => { const n = r(); return n < 0.15 ? darken(base, 0.15) : n > 0.9 ? lighten(base, 0.12) : base; });
    for (let i = 0; i < 4; i++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 15); put(b, x, y, '#a38a6a'); put(b, x + 1, y, darken(base, 0.3)); }
  },
  [T.ROAD](b, r, reg) {
    const base = reg === 6 ? '#9a9286' : reg === 4 ? '#7a6e62' : '#a5865a';
    fill(b, (x, y) => { const n = valueNoise(x / 3, y / 3, 11 + Math.floor(r() * 3)); return n < 0.3 ? darken(base, 0.12) : n > 0.75 ? lighten(base, 0.1) : base; });
    for (let i = 0; i < 6; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16); put(b, x, y, darken(base, 0.35)); }
    for (let i = 0; i < 3; i++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 15); put(b, x, y, '#c9b18a'); }
  },
  [T.SAND](b, r, reg) {
    const base = reg === 5 ? '#e3cf8f' : '#cdb57a';
    fill(b, () => { const n = r(); return n < 0.12 ? darken(base, 0.08) : n > 0.9 ? lighten(base, 0.15) : base; });
    if (r() < 0.25) { const x = 3 + Math.floor(r() * 10), y = 3 + Math.floor(r() * 10); put(b, x, y, '#f4ece0'); put(b, x + 1, y, '#e8a0a0'); }
  },
  [T.MUD](b, r) {
    fill(b, (x, y) => { const n = valueNoise(x / 3, y / 3, r() * 100); return n < 0.4 ? '#3f3424' : n < 0.7 ? '#4a3d2a' : '#56472f'; });
    for (let i = 0; i < 3; i++) { const x = Math.floor(r() * 14), y = Math.floor(r() * 14); put(b, x, y, '#6a7a50'); put(b, x + 1, y, '#38452a'); }
  },
  [T.SNOW](b, r) {
    fill(b, (x, y) => { const n = valueNoise(x / 4, y / 4, r() * 99); return n < 0.3 ? '#d4e2ec' : n > 0.75 ? '#ffffff' : '#e8f1f6'; });
    for (let i = 0; i < 5; i++) put(b, Math.floor(r() * 16), Math.floor(r() * 16), '#bcd0de');
  },
  [T.ICE](b, r) {
    fill(b, (x, y) => ((x + y * 2) % 11 === 0 ? '#e8f8ff' : valueNoise(x / 5, y / 5, 5) < 0.4 ? '#9cc8e0' : '#b6dbee'));
    for (let i = 0; i < 2; i++) { const x = Math.floor(r() * 10), y = Math.floor(r() * 14); for (let k = 0; k < 5; k++) put(b, x + k, y + (k >> 1), '#7fb0cc'); }
  },
  [T.ROCK](b, r, reg) {
    const base = reg === 6 ? '#8a8f96' : reg === 4 ? '#5e5a58' : '#7a7068';
    fill(b, (x, y) => { const n = valueNoise(x / 4, y / 4, r() * 50); return n < 0.3 ? darken(base, 0.18) : n > 0.7 ? lighten(base, 0.12) : base; });
    for (let i = 0; i < 4; i++) { const x = Math.floor(r() * 14), y = Math.floor(r() * 14); put(b, x, y, lighten(base, 0.3)); put(b, x + 1, y + 1, darken(base, 0.35)); }
    if (reg !== 4 && r() < 0.5) for (let i = 0; i < 4; i++) put(b, Math.floor(r() * 16), Math.floor(r() * 16), GRASS_PAL[reg][1]);
  },
  [T.ASH](b, r) {
    fill(b, (x, y) => { const n = valueNoise(x / 4, y / 4, r() * 30); return n < 0.3 ? '#4a4644' : n > 0.72 ? '#76706a' : '#5e5955'; });
    for (let i = 0; i < 3; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16); put(b, x, y, r() < 0.3 ? '#c0542a' : '#2a2624'); }
  },
  [T.PLAZA](b, r, reg) {
    const base = reg === 5 ? '#d8cbb0' : reg === 2 ? '#6e6460' : reg === 6 ? '#9aa2a8' : '#9c948a';
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const row = Math.floor(y / 4), off = row % 2 ? 4 : 0, edge = y % 4 === 3 || (x + off) % 8 === 7;
      const stone = Math.floor((x + off) / 8) + row * 3;
      put(b, x, y, edge ? darken(base, 0.35) : hash2(stone, row, 3) < 0.3 ? darken(base, 0.1) : hash2(stone, row, 9) > 0.8 ? lighten(base, 0.1) : base);
    }
    if (r() < 0.3) put(b, Math.floor(r() * 16), Math.floor(r() * 16), '#5a8a3a');
  },
  [T.WOOD](b) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const plank = Math.floor(y / 4), seam = y % 4 === 3 || (x + plank * 5) % 16 === 0;
      put(b, x, y, seam ? '#4a2f1c' : hash2(x, plank, 4) < 0.15 ? '#6e4628' : (x + plank) % 7 === 0 ? '#8e5e36' : '#7d5232');
    }
  },
  [T.BRIDGE](b) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const plank = Math.floor(x / 4), seam = x % 4 === 3;
      put(b, x, y, seam ? '#3e2716' : hash2(plank, y, 8) < 0.1 ? '#6a4224' : '#8a5a32');
    }
  },
  [T.WALL](b, r, reg) {
    const base = ['#6e5a44', '#5e4a6e', '#5a4440', '#4a4a3a', '#5a5654', '#d8cdb5', '#6a7a8a', '#6a665e'][reg] || '#6e5a44';
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = Math.floor(y / 4), off = row % 2 ? 3 : 0; const edge = y % 4 === 0 || (x + off) % 6 === 0; put(b, x, y, edge ? darken(base, 0.3) : base); }
  },
  [T.CAVEF](b, r) {
    fill(b, (x, y) => { const n = valueNoise(x / 3, y / 3, r() * 40); return n < 0.3 ? '#2e2a2a' : n > 0.75 ? '#4a4442' : '#3a3534'; });
    for (let i = 0; i < 4; i++) put(b, Math.floor(r() * 16), Math.floor(r() * 16), '#55504c');
  },
  [T.CAVEW](b, r) { fill(b, (x, y) => { const n = valueNoise(x / 3, y / 3, r() * 60); return n < 0.4 ? '#1e1a1a' : '#2a2424'; }); },
  [T.FARM](b, r) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(b, x, y, y % 4 === 0 ? '#5a3e24' : y % 4 === 1 ? '#7a5634' : '#6a4a2c');
    for (let x = 1; x < 16; x += 3) { const h = Math.floor(r() * 3); put(b, x, 2 - h + 1, '#6aa040'); put(b, x, 6, '#5a9038'); put(b, x, 10, '#6aa040'); put(b, x, 14, '#5a9038'); }
  },
  [T.RUINF](b, r) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x % 8 === 0 || y % 8 === 0; put(b, x, y, edge ? '#5a5650' : hash2(Math.floor(x / 8), Math.floor(y / 8), 2) < 0.5 ? '#8a847a' : '#7a7468'); }
    for (let i = 0; i < 5; i++) put(b, Math.floor(r() * 16), Math.floor(r() * 16), '#4f7a3a');
    if (r() < 0.4) { const x = Math.floor(r() * 12); for (let k = 0; k < 4; k++) put(b, x + k, 4 + k, '#3a3630'); }
  },
  [T.CARPET](b, r, reg) {
    const col = ['#3f7a35', '#6a2f8a', '#8a2a24', '#4a4a3a', '#5a5654', '#b8902a', '#2a4f8a', '#2a2430'][reg] || '#6a2f8a';
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const border = x === 0 || x === 15 || y === 0 || y === 15; put(b, x, y, border ? '#d8b04a' : (x + y) % 6 === 0 ? lighten(col, 0.2) : col); }
  },
  [T.MARSH](b, r) {
    fill(b, (x, y) => { const n = valueNoise(x / 3, y / 3, r() * 20); return n < 0.35 ? '#3e4a26' : n > 0.7 ? '#5e6a34' : '#4c5a2c'; });
    for (let i = 0; i < 8; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 14); put(b, x, y, '#7a8a44'); put(b, x, y + 1, '#5a6a34'); put(b, x, y + 2, '#5a6a34'); }
  },
  [T.VOID](b) { fill(b, () => '#0c0a10'); },
  [T.STONEF](b, r, reg) {
    const base = reg === 2 ? '#5a5250' : reg === 5 ? '#c8bca4' : '#7e7870';
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x % 8 === 0 || y % 8 === 0; put(b, x, y, edge ? darken(base, 0.25) : hash2(Math.floor(x / 8), Math.floor(y / 8), 5 + Math.floor(r() * 2)) < 0.4 ? darken(base, 0.06) : base); }
  },
  [T.CLIFF](b, r, reg) { // topo do penhasco
    const base = reg === 6 ? '#9aa4ae' : reg === 4 ? '#4e4a48' : reg === 0 || reg === 3 ? '#5e6a4a' : '#7a6e64';
    fill(b, (x, y) => { const n = valueNoise(x / 3, y / 3, r() * 70); return n < 0.3 ? darken(base, 0.2) : n > 0.7 ? lighten(base, 0.15) : base; });
    if (reg !== 4) for (let i = 0; i < 5; i++) put(b, Math.floor(r() * 16), Math.floor(r() * 16), reg === 6 ? '#ffffff' : GRASS_PAL[reg][0]);
  },
};

function cliffFace(b, r, reg) {
  const base = reg === 6 ? '#7a848e' : reg === 4 ? '#3e3a38' : reg === 0 || reg === 3 ? '#4e5440' : '#64584e';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const strata = (y + Math.floor(hash2(x >> 2, 0, 3) * 3)) % 5 === 0;
    const crack = (x + Math.floor(y / 3)) % 7 === 0 && y > 3;
    put(b, x, y, y < 2 ? lighten(base, 0.25) : strata ? darken(base, 0.3) : crack ? darken(base, 0.45) : x % 5 === 0 ? darken(base, 0.12) : base);
  }
  for (let x = 0; x < 16; x++) put(b, x, 15, darken(base, 0.5));
}
function wallFace(b, r, reg) {
  const base = ['#8a6e50', '#7e6a8e', '#6e5450', '#5a5a48', '#6a6664', '#e8dcc0', '#7a8a9a', '#7a766e'][reg] || '#8a6e50';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const plank = x % 5 === 0;
    put(b, x, y, y > 12 ? darken(base, 0.4) : y < 2 ? lighten(base, 0.2) : plank ? darken(base, 0.2) : hash2(x, y, 3) < 0.08 ? darken(base, 0.1) : base);
  }
}

// cache de variantes: chave "tipo:região:var"
const cache = new Map();
export const VARIANTS = 4;
export function tileBuf(type, reg, v, face = false) {
  const key = `${type}:${reg}:${v}:${face ? 1 : 0}`;
  let b = cache.get(key);
  if (b) return b;
  b = newBuf();
  const r = mulberry32(type * 1000 + reg * 100 + v * 7 + 1);
  if (face && type === T.CLIFF) cliffFace(b, r, reg);
  else if (face && (type === T.WALL || type === T.CAVEW)) (type === T.WALL ? wallFace : cliffFace)(b, r, type === T.CAVEW ? 4 : reg);
  else (painters[type] || painters[T.GRASS])(b, r, reg, v);
  cache.set(key, b);
  return b;
}

// água animada: quadros 16x16 contínuos entre tiles (padrão baseado em coordenadas)
const waterCache = new Map();
export const WATER_FRAMES = 8;
export function waterFrame(type, reg, frame, tx, ty, ctxMaker) {
  const key = `${type}:${reg}:${frame}:${tx & 3}:${ty & 3}`;
  let c = waterCache.get(key);
  if (c) return c;
  c = ctxMaker(16, 16);
  const img = c.ctx.createImageData(16, 16), d = img.data;
  const pal = type === T.SWAMPW ? WATER_PAL[3] : WATER_PAL[reg];
  const deep = type === T.DEEP;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const wx = (tx & 3) * 16 + x, wy = (ty & 3) * 16 + y;
    const ph = (frame / WATER_FRAMES) * Math.PI * 2;
    const w = Math.sin(wx * 0.19 + wy * 0.08 + ph) + Math.sin(wy * 0.31 - wx * 0.05 + ph * 2) * 0.6;
    let col = deep ? darken(pal[0], 0.28) : pal[0];
    if (w > 1.05) col = pal[1];
    if (w > 1.45 && (wx + wy + frame) % 3 === 0) col = pal[2];
    if (type === T.SWAMPW && hash2(wx, wy, 77) < 0.04) col = '#6a8a40';
    const [r, g, b] = hexToRgb(col), i = (y * 16 + x) * 4;
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  c.ctx.putImageData(img, 0, 0);
  waterCache.set(key, c);
  return c;
}
export const isWaterTile = (t) => TILE_INFO[t] && TILE_INFO[t].water;
export const FOAM = '#e8f6fa';
