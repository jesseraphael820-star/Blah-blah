// Mapas: minimapa, mapa geográfico e mapa político (territórios por facção, fronteiras, regiões disputadas).
import { G } from '../state.js';
import { TILE, fbm } from '../core/util.js';
import { TERRITORIES, FACTIONS, VILLAGES, NEUTRAL_COLOR, SITES } from '../data/world.js';
import { T } from '../gfx/tiles.js';
import { hexToRgb } from '../gfx/canvas.js';
import { emblemCanvas } from '../gfx/objects.js';
import { atWar } from '../systems/war.js';
import { objectiveTargets } from '../systems/quests.js';

const TCOL = { [T.GRASS]: [92, 150, 62], [T.FOREST]: [46, 92, 40], [T.DIRT]: [138, 106, 68], [T.ROAD]: [196, 166, 110], [T.SAND]: [222, 204, 142], [T.WATER]: [52, 120, 162], [T.DEEP]: [32, 82, 124],
  [T.SWAMPW]: [60, 88, 58], [T.MUD]: [74, 61, 42], [T.SNOW]: [230, 238, 244], [T.ICE]: [180, 216, 236], [T.ROCK]: [122, 112, 104], [T.CLIFF]: [72, 62, 58], [T.ASH]: [94, 89, 85], [T.PLAZA]: [200, 190, 176],
  [T.BRIDGE]: [160, 100, 50], [T.FARM]: [120, 84, 48], [T.RUINF]: [150, 144, 132], [T.MARSH]: [76, 90, 44] };
let base = null, terrIdx = null;

export function territoryIndex() {
  if (terrIdx) return terrIdx;
  const m = G.world; terrIdx = new Int16Array(m.w * m.h).fill(-1);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const t = m.get(x, y); if (t === T.WATER || t === T.DEEP) continue;
    const wx = x + (fbm(x / 12, y / 12, 51) - 0.5) * 14, wy = y + (fbm(x / 12, y / 12, 77) - 0.5) * 14;
    let best = -1, bd = 1e9;
    for (let i = 0; i < TERRITORIES.length; i++) { const tr = TERRITORIES[i]; const d = (tr.x - wx) ** 2 + (tr.y - wy) ** 2; if (d < bd) { bd = d; best = i; } }
    terrIdx[y * m.w + x] = best;
  }
  return terrIdx;
}
function baseImage() {
  if (base) return base;
  const m = G.world, c = document.createElement('canvas'); c.width = m.w; c.height = m.h;
  const x = c.getContext('2d'), img = x.createImageData(m.w, m.h);
  for (let i = 0; i < m.w * m.h; i++) {
    const col = TCOL[m.tiles[i]] || [90, 140, 60];
    const shade = (m.tiles[i] === T.CLIFF ? 0.8 : 1) * (0.94 + ((i * 2654435761) % 13) / 200);
    img.data[i * 4] = col[0] * shade; img.data[i * 4 + 1] = col[1] * shade; img.data[i * 4 + 2] = col[2] * shade; img.data[i * 4 + 3] = 255;
  }
  for (const o of m.objects) if (o.kind === 'tree') { const tx = Math.floor(o.x / TILE), ty = Math.floor(o.y / TILE), i = (ty * m.w + tx) * 4; img.data[i] *= 0.6; img.data[i + 1] *= 0.7; img.data[i + 2] *= 0.6; }
  x.putImageData(img, 0, 0);
  base = c; return c;
}
export function ownerOf(i) { const tr = TERRITORIES[i]; return G.territory[tr.id] !== undefined ? G.territory[tr.id] : tr.orig; }
export function contested(i) {
  const tr = TERRITORIES[i], own = ownerOf(i); if (!own) return false;
  if (own !== tr.orig && tr.orig && atWar(own, tr.orig)) return true;
  return false;
}

// desenha o mapa em um canvas. mode: 'geo' | 'pol'
export function renderMap(cv, mode, scale = 3, hover = -1) {
  const m = G.world, W = m.w * scale, H = m.h * scale;
  if (cv.width !== W) { cv.width = W; cv.height = H; }
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(baseImage(), 0, 0, W, H);
  const idx = territoryIndex();
  if (mode === 'pol') {
    const ov = x.createImageData(W, H), d = ov.data;
    const t = performance.now() / 1000;
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
      const ti = idx[ty * m.w + tx]; if (ti < 0) continue;
      const own = ownerOf(ti);
      const col = own ? hexToRgb(own === 'ravencross' ? '#3a3046' : FACTIONS[own].color) : hexToRgb(NEUTRAL_COLOR);
      const border = (idx[ty * m.w + tx + 1] !== ti && tx < m.w - 1 && idx[ty * m.w + tx + 1] >= 0) || (ty < m.h - 1 && idx[(ty + 1) * m.w + tx] !== ti && idx[(ty + 1) * m.w + tx] >= 0) || (tx > 0 && idx[ty * m.w + tx - 1] !== ti && idx[ty * m.w + tx - 1] >= 0) || (ty > 0 && idx[(ty - 1) * m.w + tx] !== ti && idx[(ty - 1) * m.w + tx] >= 0);
      const ownBorder = border && [[1, 0], [0, 1], [-1, 0], [0, -1]].some(([dx, dy]) => { const n = idx[(ty + dy) * m.w + tx + dx]; return n >= 0 && ownerOf(n) !== own; });
      const isC = contested(ti), isHover = ti === hover;
      for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
        const px = tx * scale + sx, py = ty * scale + sy, i = (py * W + px) * 4;
        let a = own ? 0.62 : 0.28;
        if (!own && ((px + py) % 6 < 2)) a = 0.6;
        if (isC && ((px - py + Math.floor(t * 8)) % 10 < 3)) { d[i] = 255; d[i + 1] = 240; d[i + 2] = 200; d[i + 3] = 120; continue; }
        if (isHover) a += 0.2;
        if (ownBorder) { d[i] = 20; d[i + 1] = 14; d[i + 2] = 24; d[i + 3] = 230; continue; }
        if (border) a += 0.15;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = a * 255;
      }
    }
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; tmp.getContext('2d').putImageData(ov, 0, 0);
    x.drawImage(tmp, 0, 0);
    // marcadores de importância
    for (let i = 0; i < TERRITORIES.length; i++) {
      const tr = TERRITORIES[i]; const own = ownerOf(i);
      const px = tr.x * scale, py = tr.y * scale;
      if (tr.id.endsWith('_capital')) continue;
      x.fillStyle = '#0a0710'; x.beginPath(); x.arc(px, py, 3 + tr.imp * 1.5, 0, Math.PI * 2); x.fill();
      x.fillStyle = own ? FACTIONS[own].light : '#e8e0c8'; x.beginPath(); x.arc(px, py, 2 + tr.imp * 1.5, 0, Math.PI * 2); x.fill();
      if (tr.imp >= 2) { x.fillStyle = '#0a0710'; x.fillRect(px - 1, py - 1, 2, 2); }
    }
  } else {
    // névoa de áreas não descobertas (por região)
    x.fillStyle = 'rgba(10,6,14,0.62)';
    for (let ty = 0; ty < m.h; ty += 2) for (let tx = 0; tx < m.w; tx += 2) if (!G.discovered['reg' + m.reg(tx, ty)]) x.fillRect(tx * scale, ty * scale, scale * 2, scale * 2);
  }
  // vilas com emblema
  for (const [vid, v] of Object.entries(VILLAGES)) {
    const fac = v.faction;
    const own = TERRITORIES.find((t) => t.id.endsWith('_capital') && t.x === v.x && t.y === v.y);
    const o = own ? (G.territory[own.id] ?? own.orig) : fac;
    const em = emblemCanvas(fac, '#ffffff', FACTIONS[o].color === '#2a2430' ? '#3a3046' : FACTIONS[o].color, 2);
    x.fillStyle = '#0a0710'; x.fillRect(v.x * scale - 10, v.y * scale - 10, 20, 20);
    x.drawImage(em, v.x * scale - 9, v.y * scale - 9);
    x.font = `bold ${Math.max(10, scale * 4)}px Cinzel, serif`; x.textAlign = 'center';
    x.fillStyle = '#000'; x.fillText(FACTIONS[fac].name, v.x * scale + 1, v.y * scale + 23);
    x.fillStyle = '#f4ecd8'; x.fillText(FACTIONS[fac].name, v.x * scale, v.y * scale + 22);
  }
  // locais especiais
  for (const [k, s] of Object.entries(SITES)) { x.fillStyle = '#0a0710'; x.fillRect(s.x * scale - 3, s.y * scale - 3, 6, 6); x.fillStyle = s.kind === 'ruins' ? '#c8c0a8' : '#8a7a6a'; x.fillRect(s.x * scale - 2, s.y * scale - 2, 4, 4); }
  // objetivos e jogador
  if (G.tracked) for (const tg of objectiveTargets(G.tracked)) {
    let px = tg.x, py = tg.y;
    if (tg.map !== 'world') { const d = G.world.doors.find((dd) => dd.target === tg.map); if (!d) continue; px = d.x; py = d.y; }
    drawDiamond(x, (px / TILE) * scale, (py / TILE) * scale, '#ffd84a');
  }
  const p = G.player;
  if (p) {
    let px = p.x, py = p.y;
    if (p.mapId !== 'world') { const d = G.world.doors.find((dd) => dd.target === p.mapId); if (d) { px = d.x; py = d.y; } }
    const X = (px / TILE) * scale, Y = (py / TILE) * scale;
    x.fillStyle = '#000'; x.beginPath(); x.arc(X, Y, 6, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#ffffff'; x.beginPath(); x.arc(X, Y, 4, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#7b3fa0'; x.beginPath(); x.arc(X, Y, 2, 0, Math.PI * 2); x.fill();
  }
}
function drawDiamond(x, X, Y, col) { x.fillStyle = '#000'; x.beginPath(); x.moveTo(X, Y - 8); x.lineTo(X + 6, Y); x.lineTo(X, Y + 8); x.lineTo(X - 6, Y); x.fill(); x.fillStyle = col; x.beginPath(); x.moveTo(X, Y - 6); x.lineTo(X + 4, Y); x.lineTo(X, Y + 6); x.lineTo(X - 4, Y); x.fill(); }
export function territoryAtMapPx(mx, my, scale) { const idx = territoryIndex(); const tx = Math.floor(mx / scale), ty = Math.floor(my / scale); if (tx < 0 || ty < 0 || tx >= G.world.w || ty >= G.world.h) return -1; return idx[ty * G.world.w + tx]; }

// minimapa (canvas pequeno no HUD)
export function drawMinimap(cv) {
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
  const p = G.player; if (!p) return;
  const W = cv.width, H = cv.height;
  x.fillStyle = '#0a0710'; x.fillRect(0, 0, W, H);
  if (G.map.interior) {
    x.fillStyle = '#a898b8'; x.font = '11px sans-serif'; x.textAlign = 'center';
    const m = G.map, s = Math.min(W / m.w, H / m.h);
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) { if (m.solidTile(tx, ty) && m.get(tx, ty) !== T.WOOD) continue; x.fillStyle = '#4a3e5a'; x.fillRect((W - m.w * s) / 2 + tx * s, (H - m.h * s) / 2 + ty * s, s, s); }
    x.fillStyle = '#fff'; x.fillRect((W - m.w * s) / 2 + (p.x / TILE) * s - 2, (H - m.h * s) / 2 + (p.y / TILE) * s - 2, 4, 4);
    return;
  }
  const zoom = 2; // pixels por tile
  const cx = p.x / TILE, cy = p.y / TILE;
  x.drawImage(baseImage(), cx - W / zoom / 2, cy - H / zoom / 2, W / zoom, H / zoom, 0, 0, W, H);
  // vilas
  for (const v of Object.values(VILLAGES)) { const X = (v.x - cx) * zoom + W / 2, Y = (v.y - cy) * zoom + H / 2; if (X < 0 || Y < 0 || X > W || Y > H) continue; x.fillStyle = '#000'; x.fillRect(X - 3, Y - 3, 6, 6); x.fillStyle = FACTIONS[v.faction].light; x.fillRect(X - 2, Y - 2, 4, 4); }
  if (G.tracked) for (const tg of objectiveTargets(G.tracked)) {
    let px = tg.x, py = tg.y;
    if (tg.map !== 'world') { const d = G.world.doors.find((dd) => dd.target === tg.map); if (!d) continue; px = d.x; py = d.y; }
    let X = (px / TILE - cx) * zoom + W / 2, Y = (py / TILE - cy) * zoom + H / 2;
    X = Math.max(5, Math.min(W - 5, X)); Y = Math.max(5, Math.min(H - 5, Y));
    drawDiamond(x, X, Y, '#ffd84a');
  }
  x.fillStyle = '#000'; x.fillRect(W / 2 - 3, H / 2 - 3, 6, 6); x.fillStyle = '#fff'; x.fillRect(W / 2 - 2, H / 2 - 2, 4, 4);
}
