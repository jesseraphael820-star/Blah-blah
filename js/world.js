'use strict';
// ===== Constantes do mundo =====
const T = 32;              // tamanho do tile em px
const P = 14;              // período do quarteirão em tiles (4 rua + 10 lote)
const RW = 4;              // largura da rua em tiles
const NB = 9;              // quarteirões por eixo
const PT = P * T, RWP = RW * T;
const CITY_T = NB * P + RW;
const MAP_TW = CITY_T + 16, MAP_TH = CITY_T;
const WW = MAP_TW * T, WH = MAP_TH * T;
const WATER_X = (CITY_T + 5) * T;
const TILE = { ROAD: 0, WALK: 1, GRASS: 2, LOT: 3, SAND: 4, WATER: 5, PATH: 6 };

// ===== Utilidades =====
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const angN = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * f) | 0, g = Math.min(255, ((n >> 8) & 255) * f) | 0, b = Math.min(255, (n & 255) * f) | 0;
  return `rgb(${r},${g},${b})`;
}

// ===== Distritos e locais especiais =====
const PARKS = new Set(['1,1', '6,4', '4,7', '7,7', '0,4']);
const SPECIAL = {
  safe: { bx: 3, by: 6, label: 'CASA', col: '#c98b5a', roof: '#8a3b2a', ht: 42 },
  hospital: { bx: 5, by: 3, label: 'HOSPITAL', col: '#e8e8e8', roof: '#f4f4f4', ht: 90 },
  police: { bx: 3, by: 3, label: 'POLÍCIA', col: '#5a6f9a', roof: '#3b4a6b', ht: 80 },
  bank: { bx: 4, by: 4, label: 'BANCO', col: '#c9b27a', roof: '#a8925c', ht: 210 },
  guns: { bx: 2, by: 4, label: 'ARMAS', col: '#6b5a48', roof: '#3d342a', ht: 40 },
  paint: { bx: 6, by: 6, label: 'PINTURA', col: '#4f9a8a', roof: '#2f6b60', ht: 45 },
  garage: { bx: 7, by: 2, label: 'OFICINA', col: '#9a8a6a', roof: '#6b6050', ht: 55 },
  dock: { bx: 1, by: 7, label: 'GALPÃO', col: '#7a6a5a', roof: '#5a4a3a', ht: 60 },
};
const SPECIAL_BY_BLOCK = {};
for (const k in SPECIAL) { const s = SPECIAL[k]; s.key = k; SPECIAL_BY_BLOCK[s.bx + ',' + s.by] = s; }

function districtOf(bx, by) {
  if (PARKS.has(bx + ',' + by)) return 'park';
  if (bx === NB - 1) return 'beach';
  if (bx <= 2 && by >= 6) return 'industrial';
  if (Math.abs(bx - 4) <= 1 && Math.abs(by - 4) <= 1) return 'downtown';
  return 'suburb';
}
const lotX = bx => bx * PT + RWP + T;   // início do interior do lote
const lotY = by => by * PT + RWP + T;
const LOT = 8 * T;                      // 256
// posição do marcador na calçada em frente ao local
function spotOf(key) {
  const s = SPECIAL[key];
  if (key === 'paint') return { x: lotX(s.bx) + 128, y: lotY(s.by) + 185 };
  return { x: lotX(s.bx) + 128, y: s.by * PT + 13 * T + 16 };
}

// ===== Geração =====
const tiles = new Uint8Array(MAP_TW * MAP_TH);
const tileAt = (tx, ty) => (tx < 0 || ty < 0 || tx >= MAP_TW || ty >= MAP_TH) ? TILE.WATER : tiles[ty * MAP_TW + tx];
const BUILDINGS = [];
const TREES = [];
const DECOS = [];  // decorações no chão: piscinas, vagas, fontes
const BLOCK_OBS = []; // obstáculos por quarteirão
for (let i = 0; i < (NB + 2) * (NB + 2); i++) BLOCK_OBS.push([]);
const blockIdx = (bx, by) => (bx < 0 || by < 0 || bx > NB || by > NB) ? -1 : bx + by * (NB + 1);

function genWorld() {
  for (let ty = 0; ty < MAP_TH; ty++) for (let tx = 0; tx < MAP_TW; tx++) {
    let t;
    if (tx >= CITY_T) t = tx < CITY_T + 5 ? TILE.SAND : TILE.WATER;
    else {
      const mx = tx % P, my = ty % P;
      if (mx < 4 || my < 4) t = TILE.ROAD;
      else if (mx === 4 || mx === 13 || my === 4 || my === 13) t = TILE.WALK;
      else {
        const bx = Math.floor(tx / P), by = Math.floor(ty / P);
        const d = districtOf(bx, by);
        const sp = SPECIAL_BY_BLOCK[bx + ',' + by];
        if (sp) t = TILE.LOT;
        else if (d === 'park') t = (mx === 8 || my === 8 || mx === 9 || my === 9) ? TILE.PATH : TILE.GRASS;
        else if (d === 'suburb') t = TILE.GRASS;
        else if (d === 'beach') t = TILE.SAND;
        else t = TILE.LOT;
      }
    }
    tiles[ty * MAP_TW + tx] = t;
  }
  for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) genBlock(bx, by);
  // palmeiras na praia
  const r = rng(999);
  for (let y = 40; y < WH - 40; y += 90 + r() * 120) {
    TREES.push({ x: (CITY_T + 1) * T + r() * 3 * T, y, r: 16, palm: true });
  }
  for (const t of TREES) addObs({ type: 'c', x: t.x, y: t.y, r: 8 });
}
function addObs(o) {
  const x = o.type === 'c' ? o.x : o.x + o.w / 2, y = o.type === 'c' ? o.y : o.y + o.h / 2;
  const i = blockIdx(Math.floor(x / PT), Math.floor(y / PT));
  if (i >= 0) BLOCK_OBS[i].push(o);
}
function addB(x, y, w, h, ht, col, roof, label) {
  const b = { type: 'r', x, y, w, h, ht, col, roof, label, details: [] };
  const r = Math.random;
  const n = label ? 1 : Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const dw = 10 + r() * 14, dh = 8 + r() * 10;
    b.details.push({ x: x + 8 + r() * (w - dw - 16), y: y + 8 + r() * (h - dh - 16), w: dw, h: dh });
  }
  BUILDINGS.push(b); addObs(b);
  return b;
}
function genBlock(bx, by) {
  const r = rng(bx * 131 + by * 7919 + 17);
  const x0 = lotX(bx), y0 = lotY(by);
  const sp = SPECIAL_BY_BLOCK[bx + ',' + by];
  const d = districtOf(bx, by);
  if (sp) {
    if (sp.key === 'paint') {
      addB(x0 + 6, y0 + 6, 244, 110, sp.ht, sp.col, sp.roof, sp.label);
      DECOS.push({ type: 'stripe', x: x0 + 40, y: y0 + 130, w: 176, h: 110 });
    } else if (sp.key === 'safe') {
      addB(x0 + 40, y0 + 30, 170, 130, sp.ht, sp.col, sp.roof, sp.label);
      DECOS.push({ type: 'pool', x: x0 + 150, y: y0 + 175, w: 80, h: 50 });
      TREES.push({ x: x0 + 30, y: y0 + 200, r: 18 });
    } else if (sp.key === 'bank' || sp.key === 'hospital' || sp.key === 'police') {
      addB(x0 + 20, y0 + 16, 216, 170, sp.ht, sp.col, sp.roof, sp.label);
      DECOS.push({ type: 'park', x: x0 + 20, y: y0 + 200, w: 216, h: 46 });
    } else {
      addB(x0 + 24, y0 + 20, 208, 150, sp.ht, sp.col, sp.roof, sp.label);
      DECOS.push({ type: 'park', x: x0 + 24, y: y0 + 190, w: 208, h: 50 });
    }
    return;
  }
  if (d === 'park') {
    const n = 7 + Math.floor(r() * 6);
    for (let i = 0; i < n; i++) {
      const tx = x0 + 20 + r() * 216, ty = y0 + 20 + r() * 216;
      if (Math.abs(tx - (x0 + 128)) < 40 || Math.abs(ty - (y0 + 128)) < 40) continue;
      TREES.push({ x: tx, y: ty, r: 14 + r() * 10 });
    }
    DECOS.push({ type: 'fountain', x: x0 + 128, y: y0 + 128, w: 0, h: 0 });
    addObs({ type: 'c', x: x0 + 128, y: y0 + 128, r: 26 });
    return;
  }
  if (d === 'downtown') {
    const cols = ['#7d8fa3', '#8a8f99', '#5d7189', '#a3a39a', '#6a7d8a', '#8c7f73'];
    const lay = r();
    if (lay < 0.35) addB(x0 + 10, y0 + 10, 236, 236, 150 + r() * 120, pick(cols), shade(pick(cols), 0.8), null);
    else if (lay < 0.7) {
      addB(x0 + 8, y0 + 8, 112, 240, 110 + r() * 130, pick(cols), shade(pick(cols), 0.8), null);
      addB(x0 + 136, y0 + 8, 112, 240, 110 + r() * 130, pick(cols), shade(pick(cols), 0.8), null);
    } else {
      for (let i = 0; i < 4; i++) addB(x0 + 8 + (i % 2) * 128, y0 + 8 + (i >> 1) * 128, 112, 112, 80 + r() * 140, pick(cols), shade(pick(cols), 0.8), null);
    }
    return;
  }
  if (d === 'industrial') {
    const cols = ['#9a8f7a', '#7f8a8a', '#a0927a'];
    addB(x0 + 10, y0 + 12, 236, 120, 50 + r() * 25, pick(cols), '#6f6f6a', null);
    addB(x0 + 10, y0 + 150, 120, 96, 40 + r() * 20, pick(cols), '#7a6f60', null);
    DECOS.push({ type: 'park', x: x0 + 140, y: y0 + 150, w: 106, h: 96 });
    return;
  }
  // subúrbio / praia: casas
  const wallC = d === 'beach' ? ['#f2c6a0', '#a8e0e0', '#f5e08a', '#f0a8c0', '#ffffff'] : ['#d9c7a6', '#c9a98a', '#e6dccb', '#b8a48a', '#d6b38f'];
  const roofC = d === 'beach' ? ['#2a8f9a', '#d9583a', '#3a6fd9', '#e08a2a'] : ['#8a3b2a', '#6b4a3a', '#5a5a6a', '#9a4a3a', '#4a5a3a'];
  for (let i = 0; i < 4; i++) {
    const qx = x0 + (i % 2) * 128, qy = y0 + (i >> 1) * 128;
    if (r() < 0.15) { TREES.push({ x: qx + 64, y: qy + 64, r: 22 }); continue; }
    const w = 70 + r() * 30, h = 64 + r() * 30;
    const hx = qx + 14 + r() * (114 - w - 14), hy = qy + 14 + r() * (114 - h - 14);
    addB(hx, hy, w, h, 28 + r() * 18, pick(wallC), pick(roofC), null);
    if (r() < 0.3 && d === 'suburb') DECOS.push({ type: 'pool', x: qx + 10, y: qy + 98, w: 40, h: 24 });
    if (r() < 0.5) TREES.push({ x: qx + 110 + r() * 10, y: qy + 12 + r() * 100, r: 12 + r() * 6 });
  }
}

// ===== Colisão =====
function resolveCircle(o, r) {
  let nx = 0, ny = 0, hit = false;
  if (o.x < r) { o.x = r; nx += 1; hit = true; }
  if (o.y < r) { o.y = r; ny += 1; hit = true; }
  if (o.y > WH - r) { o.y = WH - r; ny -= 1; hit = true; }
  if (o.x > WATER_X - r) { o.x = WATER_X - r; nx -= 1; hit = true; }
  const bx = Math.floor(o.x / PT), by = Math.floor(o.y / PT);
  const i = blockIdx(bx, by);
  if (i < 0) return hit ? { nx, ny } : null;
  for (const b of BLOCK_OBS[i]) {
    if (b.type === 'r') {
      const cx = clamp(o.x, b.x, b.x + b.w), cy = clamp(o.y, b.y, b.y + b.h);
      let dx = o.x - cx, dy = o.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 === 0) { // dentro do retângulo
        const l = o.x - b.x, rr = b.x + b.w - o.x, t = o.y - b.y, bt = b.y + b.h - o.y;
        const m = Math.min(l, rr, t, bt);
        if (m === l) { o.x = b.x - r; nx -= 1; } else if (m === rr) { o.x = b.x + b.w + r; nx += 1; }
        else if (m === t) { o.y = b.y - r; ny -= 1; } else { o.y = b.y + b.h + r; ny += 1; }
      } else {
        const d = Math.sqrt(d2); dx /= d; dy /= d;
        o.x = cx + dx * r; o.y = cy + dy * r; nx += dx; ny += dy;
      }
      hit = true;
    } else {
      let dx = o.x - b.x, dy = o.y - b.y; const d = Math.hypot(dx, dy), rr = r + b.r;
      if (d >= rr || d === 0) continue;
      dx /= d; dy /= d; o.x = b.x + dx * rr; o.y = b.y + dy * rr; nx += dx; ny += dy; hit = true;
    }
  }
  if (!hit) return null;
  const l = Math.hypot(nx, ny) || 1;
  return { nx: nx / l, ny: ny / l };
}
function solidAt(x, y) {
  if (x < 0 || y < 0 || y > WH || x > WATER_X) return true;
  const i = blockIdx(Math.floor(x / PT), Math.floor(y / PT));
  if (i < 0) return false;
  for (const b of BLOCK_OBS[i]) if (b.type === 'r' && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  return false;
}
function los(a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 16);
  for (let i = 1; i < n; i++) if (solidAt(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false;
  return true;
}
const isRoad = (x, y) => tileAt(Math.floor(x / T), Math.floor(y / T)) === TILE.ROAD;

// ===== Chão em pedaços (cache) =====
const CH = 512, CHT = CH / T;
const chunkCache = new Map();
const TCOL = ['#3b3d42', '#a3a198', '#4f8a3a', '#77766f', '#e3d09a', '#2a7fb8', '#b9a57a'];
function renderChunk(cx, cy) {
  const c = document.createElement('canvas'); c.width = c.height = CH;
  const g = c.getContext('2d');
  const r = rng(cx * 977 + cy * 131);
  for (let j = 0; j < CHT; j++) for (let i = 0; i < CHT; i++) {
    const tx = cx * CHT + i, ty = cy * CHT + j, t = tileAt(tx, ty), x = i * T, y = j * T;
    let col = TCOL[t];
    if (t === TILE.LOT && districtOf(Math.floor(tx / P), Math.floor(ty / P)) === 'industrial') col = '#66625a';
    g.fillStyle = col; g.fillRect(x, y, T, T);
    // textura
    for (let k = 0; k < 4; k++) {
      g.fillStyle = `rgba(${r() < .5 ? '0,0,0' : '255,255,255'},${0.03 + r() * 0.04})`;
      g.fillRect(x + r() * T, y + r() * T, 2 + r() * 5, 2 + r() * 5);
    }
    if (t === TILE.WALK) { g.strokeStyle = 'rgba(0,0,0,.12)'; g.strokeRect(x + .5, y + .5, T - 1, T - 1); }
    if (t === TILE.GRASS) for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(30,70,20,.35)'; g.fillRect(x + r() * T, y + r() * T, 2, 3); }
    if (t === TILE.WATER) { g.strokeStyle = 'rgba(255,255,255,.18)'; g.beginPath(); const wy = y + r() * T; g.moveTo(x + 4, wy); g.quadraticCurveTo(x + 16, wy - 4, x + 28, wy); g.stroke(); }
    if (t === TILE.ROAD && tx < CITY_T) {
      const mx = tx % P, my = ty % P;
      g.fillStyle = 'rgba(255,255,255,.75)';
      const inter = mx < 4 && my < 4;
      if (!inter && my === 1 && mx >= 5 && mx <= 12) { g.fillStyle = '#e8c547'; g.fillRect(x + 4, y + T - 2, 18, 4); }
      if (!inter && mx === 1 && my >= 5 && my <= 12) { g.fillStyle = '#e8c547'; g.fillRect(x + T - 2, y + 4, 4, 18); }
      g.fillStyle = 'rgba(255,255,255,.7)';
      if (my < 4 && (mx === 4 || mx === 13)) for (let s = 0; s < 4; s++) g.fillRect(x + 6, y + 2 + s * 8, 20, 4);
      if (mx < 4 && (my === 4 || my === 13)) for (let s = 0; s < 4; s++) g.fillRect(x + 2 + s * 8, y + 6, 4, 20);
    }
    if (t === TILE.SAND && tileAt(tx + 1, ty) === TILE.WATER) { g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(x + T - 4, y, 4, T); }
  }
  // meio-fio
  g.fillStyle = 'rgba(0,0,0,.25)';
  for (let j = 0; j < CHT; j++) for (let i = 0; i < CHT; i++) {
    const tx = cx * CHT + i, ty = cy * CHT + j;
    if (tileAt(tx, ty) !== TILE.ROAD) continue;
    if (tileAt(tx, ty - 1) === TILE.WALK) g.fillRect(i * T, j * T, T, 3);
    if (tileAt(tx, ty + 1) === TILE.WALK) g.fillRect(i * T, j * T + T - 3, T, 3);
    if (tileAt(tx - 1, ty) === TILE.WALK) g.fillRect(i * T, j * T, 3, T);
    if (tileAt(tx + 1, ty) === TILE.WALK) g.fillRect(i * T + T - 3, j * T, 3, T);
  }
  g.save(); g.translate(-cx * CH, -cy * CH);
  for (const d of DECOS) {
    if (d.x > (cx + 1) * CH + 40 || d.x + d.w < cx * CH - 40 || d.y > (cy + 1) * CH + 40 || d.y + d.h < cy * CH - 40) continue;
    if (d.type === 'pool') { g.fillStyle = '#ddd'; g.fillRect(d.x - 3, d.y - 3, d.w + 6, d.h + 6); g.fillStyle = '#3fb6e0'; g.fillRect(d.x, d.y, d.w, d.h); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(d.x + 4, d.y + 4, d.w * .5, 3); }
    if (d.type === 'park') { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; for (let x = d.x; x <= d.x + d.w; x += 30) { g.beginPath(); g.moveTo(x, d.y); g.lineTo(x, d.y + d.h * .6); g.stroke(); } }
    if (d.type === 'stripe') { g.fillStyle = '#e8c547'; for (let x = d.x; x < d.x + d.w; x += 28) { g.save(); g.translate(x, d.y); g.fillRect(0, 0, 12, 6); g.fillRect(0, d.h - 6, 12, 6); g.restore(); } }
    if (d.type === 'fountain') { g.fillStyle = '#bbb'; g.beginPath(); g.arc(d.x, d.y, 30, 0, 7); g.fill(); g.fillStyle = '#4fb8e8'; g.beginPath(); g.arc(d.x, d.y, 24, 0, 7); g.fill(); g.fillStyle = '#ddd'; g.beginPath(); g.arc(d.x, d.y, 6, 0, 7); g.fill(); }
  }
  g.restore();
  return c;
}
function getChunk(cx, cy) {
  const k = cx + ',' + cy;
  let c = chunkCache.get(k);
  if (c) { chunkCache.delete(k); chunkCache.set(k, c); return c; }
  c = renderChunk(cx, cy); chunkCache.set(k, c);
  if (chunkCache.size > 24) chunkCache.delete(chunkCache.keys().next().value);
  return c;
}
function drawGround(ctx, v) {
  const x0 = Math.floor(v.x0 / CH), x1 = Math.floor(v.x1 / CH), y0 = Math.floor(v.y0 / CH), y1 = Math.floor(v.y1 / CH);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    if (cx * CHT >= MAP_TW + 20 || cy * CHT >= MAP_TH + 20) { ctx.fillStyle = '#2a7fb8'; ctx.fillRect(cx * CH, cy * CH, CH, CH); continue; }
    ctx.drawImage(getChunk(cx, cy), cx * CH, cy * CH, CH + 1, CH + 1);
  }
}

// ===== Minimapa =====
let MINIMAP;
function buildMinimap() {
  MINIMAP = document.createElement('canvas'); MINIMAP.width = MAP_TW; MINIMAP.height = MAP_TH;
  const g = MINIMAP.getContext('2d'); const id = g.createImageData(MAP_TW, MAP_TH);
  const C = [[70, 70, 78], [120, 120, 112], [70, 120, 55], [95, 95, 90], [215, 195, 140], [40, 110, 170], [150, 135, 100]];
  for (let i = 0; i < tiles.length; i++) { const c = C[tiles[i]]; id.data[i * 4] = c[0]; id.data[i * 4 + 1] = c[1]; id.data[i * 4 + 2] = c[2]; id.data[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0);
  g.fillStyle = '#2b2b30';
  for (const b of BUILDINGS) g.fillRect(b.x / T, b.y / T, b.w / T, b.h / T);
}

// ===== Prédios em pseudo-3D =====
function drawBuildings(ctx, cam, v, night) {
  const list = [];
  for (const b of BUILDINGS) if (b.x + b.w > v.x0 - 200 && b.x < v.x1 + 200 && b.y + b.h > v.y0 - 200 && b.y < v.y1 + 200) list.push(b);
  for (const t of TREES) if (t.x > v.x0 - 60 && t.x < v.x1 + 60 && t.y > v.y0 - 60 && t.y < v.y1 + 60) list.push(t);
  const dc = o => { const x = (o.w ? o.x + o.w / 2 : o.x) - cam.x, y = (o.h ? o.y + o.h / 2 : o.y) - cam.y; return x * x + y * y; };
  list.sort((a, b) => (a.ht || 20) - (b.ht || 20) || dc(b) - dc(a));
  for (const o of list) o.w ? drawBuilding(ctx, o, cam, night) : drawTree(ctx, o, cam);
}
function drawTree(ctx, t, cam) {
  const k = 1 + (t.palm ? 60 : 35) * 0.0017;
  const x = cam.x + (t.x - cam.x) * k, y = cam.y + (t.y - cam.y) * k;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(t.x + 6, t.y + 6, t.r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#5a3d22'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(x, y); ctx.stroke();
  if (t.palm) {
    ctx.fillStyle = '#3f9a3a';
    for (let i = 0; i < 6; i++) { const a = i * 1.047 + t.y; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 11, y + Math.sin(a) * 11, 13, 4, a, 0, 7); ctx.fill(); }
  } else {
    ctx.fillStyle = '#2f6b2a'; ctx.beginPath(); ctx.arc(x, y, t.r, 0, 7); ctx.fill();
    ctx.fillStyle = '#3f8a35'; ctx.beginPath(); ctx.arc(x - t.r * .25, y - t.r * .25, t.r * .65, 0, 7); ctx.fill();
  }
}
const NORM = [[0, -1, 0.55], [1, 0, 0.72], [0, 1, 0.85], [-1, 0, 0.62]];
function drawBuilding(ctx, b, cam, night) {
  const k = 1 + b.ht * 0.0017;
  const bc = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
  const rc = bc.map(p => [cam.x + (p[0] - cam.x) * k, cam.y + (p[1] - cam.y) * k]);
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.fillRect(b.x + 8, b.y + 8, b.w + b.ht * 0.08, b.h + b.ht * 0.08);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, n = NORM[i];
    const mx = (bc[i][0] + bc[j][0]) / 2, my = (bc[i][1] + bc[j][1]) / 2;
    if (n[0] * (cam.x - mx) + n[1] * (cam.y - my) <= 0) continue;
    ctx.fillStyle = shade(b.col, n[2]);
    ctx.beginPath(); ctx.moveTo(bc[i][0], bc[i][1]); ctx.lineTo(bc[j][0], bc[j][1]); ctx.lineTo(rc[j][0], rc[j][1]); ctx.lineTo(rc[i][0], rc[i][1]); ctx.fill();
    // andares / janelas
    const floors = Math.floor(b.ht / 22);
    ctx.strokeStyle = night ? 'rgba(255,220,120,.55)' : 'rgba(30,40,60,.35)'; ctx.lineWidth = night ? 2 : 1.5;
    ctx.beginPath();
    for (let f = 1; f <= floors; f++) {
      const t = (f - 0.4) / (floors + 0.3);
      ctx.moveTo(lerp(bc[i][0], rc[i][0], t) + (bc[j][0] - bc[i][0]) * 0.06, lerp(bc[i][1], rc[i][1], t) + (bc[j][1] - bc[i][1]) * 0.06);
      ctx.lineTo(lerp(bc[j][0], rc[j][0], t) - (bc[j][0] - bc[i][0]) * 0.06, lerp(bc[j][1], rc[j][1], t) - (bc[j][1] - bc[i][1]) * 0.06);
    }
    ctx.stroke();
  }
  ctx.fillStyle = b.roof;
  ctx.beginPath(); ctx.moveTo(rc[0][0], rc[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(rc[i][0], rc[i][1]); ctx.fill();
  const rx = rc[0][0], ry = rc[0][1], rw = rc[2][0] - rx, rh = rc[2][1] - ry;
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 3; ctx.strokeRect(rx + 4, ry + 4, rw - 8, rh - 8);
  for (const d of b.details) {
    const x = cam.x + (d.x - cam.x) * k, y = cam.y + (d.y - cam.y) * k;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x + 3, y + 3, d.w * k, d.h * k);
    ctx.fillStyle = shade(b.col, 1.1); ctx.fillRect(x, y, d.w * k, d.h * k);
  }
  if (b.label) {
    const cx = rx + rw / 2, cy = ry + rh / 2;
    if (b.label === 'HOSPITAL') { ctx.fillStyle = '#d33'; ctx.fillRect(cx - 9 * k, cy - 30 * k, 18 * k, 50 * k); ctx.fillRect(cx - 25 * k, cy - 14 * k, 50 * k, 18 * k); }
    ctx.font = `900 ${Math.round(20 * k)}px "Arial Black", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(b.label, cx + 2, cy + 2 + (b.label === 'HOSPITAL' ? 40 * k : 0));
    ctx.fillStyle = '#fff'; ctx.fillText(b.label, cx, cy + (b.label === 'HOSPITAL' ? 40 * k : 0));
  }
}
