// Renderização do cenário estático em "chunks" pré-desenhados (cache LRU),
// essencial para manter 60 FPS em celulares.

import { T, MAP, TT } from './constants.js';
import { hash2 } from '../core/math.js';

const CH = 16; // tiles por chunk
const CPX = CH * T;

const C = {
  grass: ['#3f6b38', '#43703b', '#3b6635'],
  road: '#383b40',
  sidewalk: '#8f8f8a',
  sidewalkEdge: '#6c6c68',
  plaza: '#b3a68f',
  parking: '#46494e',
  lot: '#7f7663',
  dock: '#6c6b66',
  pier: '#7a5b3c',
  water: '#1d4a66',
};

export class WorldRenderer {
  constructor(city) {
    this.city = city;
    this.cache = new Map();
    this.scale = 2;
    this.maxChunks = 16;
    this.frame = 0;
  }

  setQuality(q) {
    const s = q === 'low' ? 1 : 2;
    const max = q === 'low' ? 20 : 16;
    if (s !== this.scale) this.cache.clear();
    this.scale = s;
    this.maxChunks = max;
  }

  getChunk(cx, cy) {
    const key = cy * 100 + cx;
    let e = this.cache.get(key);
    if (!e) {
      e = { canvas: this.renderChunk(cx, cy), used: 0 };
      this.cache.set(key, e);
      if (this.cache.size > this.maxChunks) {
        let oldK = null, oldU = Infinity;
        for (const [k, v] of this.cache) if (v.used < oldU && k !== key) { oldU = v.used; oldK = k; }
        if (oldK !== null) this.cache.delete(oldK);
      }
    }
    e.used = this.frame;
    return e.canvas;
  }

  draw(ctx, view) {
    this.frame++;
    const x0 = Math.max(0, Math.floor(view.x0 / CPX)), y0 = Math.max(0, Math.floor(view.y0 / CPX));
    const x1 = Math.min(Math.ceil(MAP / CH) - 1, Math.floor(view.x1 / CPX));
    const y1 = Math.min(Math.ceil(MAP / CH) - 1, Math.floor(view.y1 / CPX));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        ctx.drawImage(this.getChunk(cx, cy), cx * CPX, cy * CPX, CPX, CPX);
      }
    }
    // fora do mapa: água
    ctx.fillStyle = C.water;
    if (view.x1 > MAP * T) ctx.fillRect(MAP * T, view.y0, view.x1 - MAP * T, view.y1 - view.y0);
    if (view.y1 > MAP * T) ctx.fillRect(view.x0, MAP * T, view.x1 - view.x0, view.y1 - MAP * T);
    if (view.x0 < 0) ctx.fillRect(view.x0, view.y0, -view.x0, view.y1 - view.y0);
    if (view.y0 < 0) ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, -view.y0);
  }

  renderChunk(cx, cy) {
    const s = this.scale;
    const cv = document.createElement('canvas');
    cv.width = cv.height = CPX * s;
    const g = cv.getContext('2d');
    g.scale(s, s);
    g.translate(-cx * CPX, -cy * CPX);
    const tx0 = cx * CH, ty0 = cy * CH;
    const city = this.city;
    for (let y = ty0; y < ty0 + CH; y++) for (let x = tx0; x < tx0 + CH; x++) this.drawTile(g, x, y);
    // decoração por cima do chão
    for (let y = ty0; y < ty0 + CH; y++) for (let x = tx0; x < tx0 + CH; x++) this.drawTileDecor(g, x, y);
    // carcaças decorativas
    for (const w of city.wrecks) {
      if (w.x < cx * CPX - 40 || w.x > (cx + 1) * CPX + 40 || w.y < cy * CPX - 40 || w.y > (cy + 1) * CPX + 40) continue;
      g.save(); g.translate(w.x, w.y); g.rotate(w.a);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-17, -8, 38, 20);
      g.fillStyle = w.c; g.fillRect(-19, -10, 38, 20);
      g.fillStyle = '#2b2b2b'; g.fillRect(-8, -8, 14, 16);
      g.restore();
    }
    // sombras e telhados dos prédios que tocam o chunk (sombras podem vir de prédios vizinhos)
    const bx0 = cx * CPX - 12 * T, by0 = cy * CPX - 12 * T, bx1 = (cx + 1) * CPX, by1 = (cy + 1) * CPX;
    const blds = city.buildings.filter((b) => b.x * T < bx1 && (b.x + b.w) * T > bx0 && b.y * T < by1 && (b.y + b.h) * T > by0);
    for (const b of blds) this.drawShadow(g, b);
    for (const b of blds) this.drawBuilding(g, b);
    // árvores por cima (copas transbordam)
    for (let y = ty0 - 1; y < ty0 + CH + 1; y++) for (let x = tx0 - 1; x < tx0 + CH + 1; x++) if (city.t(x, y) === TT.TREE && city.inb(x, y)) this.drawTree(g, x, y);
    // postes
    for (const l of city.lamps) {
      if (l.x < cx * CPX - 8 || l.x > (cx + 1) * CPX + 8 || l.y < cy * CPX - 8 || l.y > (cy + 1) * CPX + 8) continue;
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(l.x + 2, l.y + 2, 2.6, 0, 7); g.fill();
      g.fillStyle = '#2d3036'; g.beginPath(); g.arc(l.x, l.y, 2.4, 0, 7); g.fill();
      g.strokeStyle = '#2d3036'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(l.x, l.y);
      g.lineTo(l.x + Math.cos(l.a) * 9, l.y + Math.sin(l.a) * 9); g.stroke();
      g.fillStyle = '#e8e2c4'; g.fillRect(l.x + Math.cos(l.a) * 9 - 2, l.y + Math.sin(l.a) * 9 - 2, 4, 4);
    }
    // guindastes do porto
    for (const cr of city.cranes) {
      if (Math.abs(cr.x - (cx + 0.5) * CPX) > CPX || Math.abs(cr.y - (cy + 0.5) * CPX) > CPX) continue;
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(cr.x + 10, cr.y + 14, 150, 10);
      g.fillStyle = '#d9a420'; g.fillRect(cr.x, cr.y, 160, 9);
      g.strokeStyle = '#8a6810'; g.lineWidth = 1;
      for (let i = 0; i < 160; i += 8) { g.beginPath(); g.moveTo(cr.x + i, cr.y); g.lineTo(cr.x + i + 8, cr.y + 9); g.stroke(); }
      g.fillStyle = '#c2401f'; g.fillRect(cr.x + 4, cr.y - 6, 18, 20);
    }
    return cv;
  }

  drawTile(g, x, y) {
    const city = this.city;
    const px = x * T, py = y * T;
    const t = city.t(x, y);
    const h = hash2(x, y);
    const i = city.idx(x, y);
    switch (t) {
      case TT.GRASS:
      case TT.TREE: {
        g.fillStyle = C.grass[(h * 3) | 0];
        g.fillRect(px, py, T, T);
        g.fillStyle = 'rgba(255,255,255,.05)';
        for (let k = 0; k < 4; k++) g.fillRect(px + hash2(x * 3 + k, y) * 30, py + hash2(x, y * 5 + k) * 30, 2, 2);
        break;
      }
      case TT.ROAD: this.drawRoad(g, x, y, px, py, i); break;
      case TT.SIDEWALK: {
        g.fillStyle = C.sidewalk; g.fillRect(px, py, T, T);
        g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1;
        g.strokeRect(px + 0.5, py + 0.5, T / 2, T / 2); g.strokeRect(px + T / 2 + 0.5, py + T / 2 + 0.5, T / 2 - 1, T / 2 - 1);
        g.fillStyle = C.sidewalkEdge;
        if (city.isRoad(x, y - 1)) g.fillRect(px, py, T, 3);
        if (city.isRoad(x, y + 1)) g.fillRect(px, py + T - 3, T, 3);
        if (city.isRoad(x - 1, y)) g.fillRect(px, py, 3, T);
        if (city.isRoad(x + 1, y)) g.fillRect(px + T - 3, py, 3, T);
        break;
      }
      case TT.PLAZA: {
        g.fillStyle = C.plaza; g.fillRect(px, py, T, T);
        g.strokeStyle = 'rgba(80,60,40,.18)'; g.lineWidth = 1;
        for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(px, py + k * 8 + 0.5); g.lineTo(px + T, py + k * 8 + 0.5); g.stroke(); }
        for (let k = 0; k < 4; k++) { const off = (k % 2) * 8; g.beginPath(); g.moveTo(px + off + 0.5, py + k * 8); g.lineTo(px + off + 0.5, py + k * 8 + 8); g.moveTo(px + off + 16.5, py + k * 8); g.lineTo(px + off + 16.5, py + k * 8 + 8); g.stroke(); }
        break;
      }
      case TT.PARKING: {
        g.fillStyle = C.parking; g.fillRect(px, py, T, T);
        if (y % 3 === 0 && city.t(x, y + 1) === TT.PARKING) {
          g.fillStyle = '#d8d8d0';
          g.fillRect(px, py + 2, 2, T * 2 - 4);
        }
        break;
      }
      case TT.LOT: {
        g.fillStyle = C.lot; g.fillRect(px, py, T, T);
        g.fillStyle = 'rgba(40,30,20,.12)';
        if (h > 0.6) { g.beginPath(); g.ellipse(px + h * 20 + 6, py + 16, 8, 5, h * 3, 0, 7); g.fill(); }
        g.strokeStyle = 'rgba(0,0,0,.08)'; g.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
        break;
      }
      case TT.DOCK: {
        if (city.pier[i]) {
          g.fillStyle = C.pier; g.fillRect(px, py, T, T);
          g.fillStyle = 'rgba(0,0,0,.25)';
          for (let k = 0; k < 4; k++) g.fillRect(px, py + k * 8 + 7, T, 1);
        } else {
          g.fillStyle = C.dock; g.fillRect(px, py, T, T);
          g.strokeStyle = 'rgba(0,0,0,.15)'; g.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
          if (city.t(x + 1, y) === TT.WATER || city.t(x, y + 1) === TT.WATER) {
            g.fillStyle = '#d9b72c';
            if (city.t(x + 1, y) === TT.WATER) g.fillRect(px + T - 4, py, 4, T);
            if (city.t(x, y + 1) === TT.WATER) g.fillRect(px, py + T - 4, T, 4);
          }
        }
        break;
      }
      case TT.WATER: {
        g.fillStyle = C.water; g.fillRect(px, py, T, T);
        g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1.5;
        g.beginPath(); const wy = py + 8 + h * 16;
        g.moveTo(px + 4, wy); g.quadraticCurveTo(px + 10, wy - 3, px + 16, wy); g.quadraticCurveTo(px + 22, wy + 3, px + 28, wy); g.stroke();
        // espuma na margem
        g.fillStyle = 'rgba(220,240,255,.25)';
        if (city.inb(x - 1, y) && city.t(x - 1, y) !== TT.WATER) g.fillRect(px, py, 3, T);
        if (city.inb(x, y - 1) && city.t(x, y - 1) !== TT.WATER) g.fillRect(px, py, T, 3);
        if (city.inb(x + 1, y) && city.t(x + 1, y) !== TT.WATER && city.t(x + 1, y) !== TT.BUILDING) g.fillRect(px + T - 3, py, 3, T);
        if (city.inb(x, y + 1) && city.t(x, y + 1) !== TT.WATER && city.t(x, y + 1) !== TT.BUILDING) g.fillRect(px, py + T - 3, T, 3);
        break;
      }
      case TT.POOL: {
        g.fillStyle = '#e9e5da'; g.fillRect(px, py, T, T);
        g.fillStyle = '#3fb4d8'; g.fillRect(px + 3, py + 3, T - 6, T - 6);
        break;
      }
      case TT.BUILDING: {
        // chão sob prédios (base), o prédio é desenhado depois
        const b = city.buildings[city.bld[i]];
        g.fillStyle = b && (b.style === 'ship') ? C.water : '#55524c';
        g.fillRect(px, py, T, T);
        break;
      }
      default:
        g.fillStyle = '#444'; g.fillRect(px, py, T, T);
    }
  }

  drawRoad(g, x, y, px, py, i) {
    const city = this.city;
    g.fillStyle = C.road; g.fillRect(px, py, T, T);
    const h = hash2(x, y);
    if (h > 0.7) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(px + h * 18, py + h * 9, 6, 4); }
    if (city.inter[i] >= 0) return;
    const d = city.dirs[i];
    const crossing = city.cross[i] >= 0;
    if (crossing) {
      g.fillStyle = 'rgba(235,235,225,.85)';
      if (city.crossAxis[i] === 2) for (let k = 2; k < T; k += 8) g.fillRect(px + k, py + 4, 4, T - 8);
      else for (let k = 2; k < T; k += 8) g.fillRect(px + 4, py + k, T - 8, 4);
      return;
    }
    // faixas: linha entre sentidos opostos (amarela) ou mesmo sentido (branca tracejada)
    const vertical = d === 1 || d === 4;
    if (vertical) {
      const r = city.dirs[city.idx(x + 1, y)];
      if (city.isRoad(x + 1, y) && city.inter[city.idx(x + 1, y)] < 0 && (r === 1 || r === 4)) {
        if (r !== d) { g.fillStyle = '#d6b23a'; g.fillRect(px + T - 2, py, 2, T); g.fillRect(px + T + 1, py, 2, T); }
        else if (y % 2 === 0) { g.fillStyle = '#d8d8d0'; g.fillRect(px + T - 1, py + 4, 2, 16); }
      }
    } else {
      const r = city.dirs[city.idx(x, y + 1)];
      if (city.isRoad(x, y + 1) && city.inter[city.idx(x, y + 1)] < 0 && (r === 2 || r === 8)) {
        if (r !== d) { g.fillStyle = '#d6b23a'; g.fillRect(px, py + T - 2, T, 2); g.fillRect(px, py + T + 1, T, 2); }
        else if (x % 2 === 0) { g.fillStyle = '#d8d8d0'; g.fillRect(px + 4, py + T - 1, 16, 2); }
      }
    }
    // linha de retenção antes da faixa de pedestres
    for (const [dx, dy, dir] of [[0, 1, 4], [0, -1, 1], [1, 0, 2], [-1, 0, 8]]) {
      if (d === dir && city.inb(x + dx, y + dy) && city.cross[city.idx(x + dx, y + dy)] >= 0) {
        g.fillStyle = '#e8e8e0';
        if (dir === 4) g.fillRect(px, py + T - 3, T, 3);
        if (dir === 1) g.fillRect(px, py, T, 3);
        if (dir === 2) g.fillRect(px + T - 3, py, 3, T);
        if (dir === 8) g.fillRect(px, py, 3, T);
      }
    }
  }

  drawTileDecor(g, x, y) {
    const city = this.city;
    const t = city.t(x, y);
    const h = hash2(x + 11, y + 7);
    if (t === TT.SIDEWALK && h > 0.93) {
      // hidrante / lixeira
      g.fillStyle = h > 0.965 ? '#c23a2a' : '#3a4a3a';
      g.beginPath(); g.arc(x * T + 8 + h * 12, y * T + 10 + h * 10, 3, 0, 7); g.fill();
    }
    if (t === TT.PLAZA && h > 0.9) {
      g.fillStyle = '#6b4a2e'; g.fillRect(x * T + 6, y * T + 12, 20, 6);
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x * T + 7, y * T + 18, 20, 2);
    }
    if (t === TT.LOT && h > 0.94) {
      g.fillStyle = '#5a3e22'; g.fillRect(x * T + 6, y * T + 6, 12, 12);
      g.strokeStyle = '#3a2810'; g.strokeRect(x * T + 6.5, y * T + 6.5, 11, 11);
    }
  }

  drawTree(g, x, y) {
    const h = hash2(x, y);
    const cx = (x + 0.5) * T + (h - 0.5) * 6, cy = (y + 0.5) * T + (hash2(y, x) - 0.5) * 6;
    const r = 15 + h * 6;
    const palm = this.city.t(x, y + 1) === TT.WATER || (y >= 151 && x < 116);
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.beginPath(); g.arc(cx + 6, cy + 6, r, 0, 7); g.fill();
    if (palm) {
      g.strokeStyle = '#2f7a3a'; g.lineWidth = 5; g.lineCap = 'round';
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + h;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke();
      }
      g.fillStyle = '#6b4a2a'; g.beginPath(); g.arc(cx, cy, 3, 0, 7); g.fill();
      return;
    }
    const base = h > 0.5 ? '#2d5a2a' : '#355f2c';
    g.fillStyle = base; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.fillStyle = h > 0.5 ? '#3c7335' : '#467a37';
    g.beginPath(); g.arc(cx - r * 0.25, cy - r * 0.25, r * 0.65, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.08)';
    g.beginPath(); g.arc(cx - r * 0.35, cy - r * 0.4, r * 0.3, 0, 7); g.fill();
  }

  drawShadow(g, b) {
    const off = Math.min(26, 3 + b.height * 2.2);
    g.fillStyle = 'rgba(0,0,0,.32)';
    const x = b.x * T, y = b.y * T, w = b.w * T, h = b.h * T;
    if (b.style === 'watertower' || b.style === 'lighthouse' || b.style === 'fountain') {
      g.beginPath(); g.arc(x + w / 2 + off, y + h / 2 + off, w / 2, 0, 7); g.fill();
      return;
    }
    g.beginPath();
    g.moveTo(x + w, y); g.lineTo(x + w + off, y + off); g.lineTo(x + w + off, y + h + off);
    g.lineTo(x + off, y + h + off); g.lineTo(x, y + h); g.lineTo(x + w, y + h); g.closePath(); g.fill();
  }

  drawBuilding(g, b) {
    const x = b.x * T, y = b.y * T, w = b.w * T, h = b.h * T;
    const rnd = (k) => hash2(b.seed + k, b.id);
    switch (b.style) {
      case 'house': {
        const horiz = w >= h;
        g.fillStyle = b.color; g.fillRect(x, y, w, h);
        g.fillStyle = 'rgba(0,0,0,.22)';
        if (horiz) g.fillRect(x, y + h / 2, w, h / 2); else g.fillRect(x + w / 2, y, w / 2, h);
        g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
        if (horiz) { for (let k = 6; k < h; k += 6) { g.beginPath(); g.moveTo(x, y + k); g.lineTo(x + w, y + k); g.stroke(); } }
        else { for (let k = 6; k < w; k += 6) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k, y + h); g.stroke(); } }
        g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2; g.beginPath();
        if (horiz) { g.moveTo(x + 2, y + h / 2); g.lineTo(x + w - 2, y + h / 2); } else { g.moveTo(x + w / 2, y + 2); g.lineTo(x + w / 2, y + h - 2); }
        g.stroke();
        if (rnd(1) > 0.6) { g.fillStyle = '#6a6a6a'; g.fillRect(x + w * 0.7, y + h * 0.2, 6, 6); }
        break;
      }
      case 'warehouse': {
        g.fillStyle = b.color; g.fillRect(x, y, w, h);
        g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1;
        for (let k = 4; k < w; k += 5) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k, y + h); g.stroke(); }
        g.fillStyle = 'rgba(190,220,235,.55)';
        for (let k = 1; k < b.h; k += 2) g.fillRect(x + w / 2 - 8, y + k * T + 6, 16, 18);
        g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
        break;
      }
      case 'container': {
        g.fillStyle = b.color; g.fillRect(x + 1, y + 2, w - 2, h - 4);
        g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1;
        for (let k = 4; k < w - 2; k += 4) { g.beginPath(); g.moveTo(x + 1 + k, y + 2); g.lineTo(x + 1 + k, y + h - 2); g.stroke(); }
        g.strokeRect(x + 1.5, y + 2.5, w - 3, h - 5);
        break;
      }
      case 'garage':
      case 'oficina': {
        g.fillStyle = b.color; g.fillRect(x, y, w, h);
        g.fillStyle = 'rgba(255,255,255,.08)';
        for (let k = 0; k < h; k += 8) g.fillRect(x, y + k, w, 4);
        g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
        // portão
        g.fillStyle = '#c9c4b5';
        const dw = Math.min(w - 16, 72);
        if (b.door === 'S') g.fillRect(x + (w - dw) / 2, y + h - 5, dw, 5);
        else if (b.door === 'N') g.fillRect(x + (w - dw) / 2, y, dw, 5);
        else g.fillRect(x + (w - dw) / 2, y + h - 5, dw, 5);
        break;
      }
      case 'shop': {
        g.fillStyle = b.color; g.fillRect(x, y, w, h);
        g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x + 4, y + 4, w - 8, h - 8);
        g.fillStyle = b.accent;
        for (let k = 0; k < w; k += 12) { g.fillStyle = (k / 12) % 2 ? '#f2efe6' : b.accent; g.fillRect(x + k, y + h - 7, Math.min(12, w - k), 7); }
        g.fillStyle = '#777'; g.fillRect(x + 8, y + 8, 8, 8);
        break;
      }
      case 'apartment': {
        g.fillStyle = b.color; g.fillRect(x, y, w, h);
        g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; g.strokeRect(x + 3, y + 3, w - 6, h - 6);
        g.fillStyle = '#5d6168';
        for (let k = 0; k < 3; k++) g.fillRect(x + 10 + rnd(k) * (w - 30), y + 10 + rnd(k + 5) * (h - 30), 10, 10);
        g.fillStyle = '#3b8dbf'; if (rnd(9) > 0.6 && w > 60 && h > 60) g.fillRect(x + w - 34, y + h - 30, 22, 16);
        break;
      }
      case 'hospital': {
        g.fillStyle = b.color; g.fillRect(x, y, w, h);
        g.strokeStyle = '#9aa2aa'; g.lineWidth = 3; g.strokeRect(x + 2, y + 2, w - 4, h - 4);
        const cx = x + w / 2, cy = y + h / 2;
        g.fillStyle = '#c8ccd0'; g.beginPath(); g.arc(cx, cy, 26, 0, 7); g.fill();
        g.strokeStyle = '#e45a2a'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 26, 0, 7); g.stroke();
        g.fillStyle = '#e45a2a'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', cx, cy + 1);
        break;
      }
      case 'police': {
        g.fillStyle = b.color; g.fillRect(x, y, w, h);
        g.strokeStyle = '#8aa0c8'; g.lineWidth = 3; g.strokeRect(x + 2, y + 2, w - 4, h - 4);
        this.star(g, x + w - 30, y + 28, 14, '#e8c440');
        break;
      }
      case 'market': {
        g.fillStyle = b.color; g.fillRect(x, y, w, h);
        g.fillStyle = 'rgba(255,255,255,.12)';
        for (let k = 0; k < w; k += 24) { g.beginPath(); g.ellipse(x + k + 12, y + h / 2, 10, h / 2 - 6, 0, 0, 7); g.fill(); }
        g.strokeStyle = '#3d2414'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
        break;
      }
      case 'tower': {
        g.fillStyle = b.color; g.fillRect(x, y, w, h);
        const gr = g.createLinearGradient(x, y, x + w, y + h);
        gr.addColorStop(0, 'rgba(90,140,190,.45)'); gr.addColorStop(1, 'rgba(20,30,50,.2)');
        g.fillStyle = gr; g.fillRect(x + 4, y + 4, w - 8, h - 8);
        g.strokeStyle = 'rgba(160,200,240,.25)'; g.lineWidth = 1;
        for (let k = 16; k < w; k += 16) { g.beginPath(); g.moveTo(x + k, y + 4); g.lineTo(x + k, y + h - 4); g.stroke(); }
        // logotipo original: losango duplo
        const cx = x + w / 2, cy = y + h / 2;
        g.strokeStyle = '#e2564a'; g.lineWidth = 5; g.beginPath();
        g.moveTo(cx - 30, cy - 22); g.lineTo(cx, cy + 26); g.lineTo(cx + 30, cy - 22); g.stroke();
        g.strokeStyle = '#d9dee6'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 18, cy - 22); g.lineTo(cx, cy + 8); g.lineTo(cx + 18, cy - 22); g.stroke();
        break;
      }
      case 'fountain': {
        const cx = x + w / 2, cy = y + h / 2;
        g.fillStyle = '#9d9789'; g.beginPath(); g.arc(cx, cy, w / 2, 0, 7); g.fill();
        g.fillStyle = '#3fa3cf'; g.beginPath(); g.arc(cx, cy, w / 2 - 6, 0, 7); g.fill();
        g.fillStyle = '#d7f2ff'; g.beginPath(); g.arc(cx, cy, 6, 0, 7); g.fill();
        return;
      }
      case 'watertower': {
        const cx = x + w / 2, cy = y + h / 2;
        g.fillStyle = '#7d8a93'; g.beginPath(); g.arc(cx, cy, w / 2 - 2, 0, 7); g.fill();
        g.fillStyle = '#a7b4bc'; g.beginPath(); g.arc(cx - 6, cy - 6, w / 2 - 14, 0, 7); g.fill();
        g.strokeStyle = '#4a555c'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, w / 2 - 2, 0, 7); g.stroke();
        return;
      }
      case 'lighthouse': {
        const cx = x + w / 2, cy = y + h / 2;
        g.fillStyle = '#f2f2ee'; g.beginPath(); g.arc(cx, cy, w / 2, 0, 7); g.fill();
        g.fillStyle = '#c63a2c'; g.beginPath(); g.arc(cx, cy, w / 2 - 8, 0, 7); g.fill();
        g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(cx, cy, 8, 0, 7); g.fill();
        return;
      }
      case 'ship': {
        g.fillStyle = '#7a2e2a';
        g.beginPath(); g.moveTo(x + 6, y + 12); g.lineTo(x + w / 2, y - 10); g.lineTo(x + w - 6, y + 12);
        g.lineTo(x + w - 6, y + h - 6); g.lineTo(x + 6, y + h - 6); g.closePath(); g.fill();
        g.fillStyle = '#ddd'; g.fillRect(x + 20, y + h - 60, w - 40, 44);
        const cols = ['#b8432f', '#2f6db8', '#2f9a5c', '#c58a22'];
        for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { g.fillStyle = cols[(r + c) % 4]; g.fillRect(x + 22 + c * 58, y + 24 + r * 28, 52, 22); }
        return;
      }
      case 'office':
      default: {
        g.fillStyle = b.color; g.fillRect(x, y, w, h);
        const tall = b.height >= 9;
        g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x, y, w, 4); g.fillRect(x, y, 4, h);
        g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + w - 4, y, 4, h); g.fillRect(x, y + h - 4, w, 4);
        g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + 8, y + 8, w - 16, h - 16);
        const n = 1 + Math.floor(rnd(2) * 3);
        for (let k = 0; k < n; k++) {
          const ax = x + 12 + rnd(k + 3) * Math.max(1, w - 40), ay = y + 12 + rnd(k + 7) * Math.max(1, h - 40);
          g.fillStyle = '#9aa0a6'; g.fillRect(ax, ay, 14, 12);
          g.fillStyle = '#5c6066'; g.beginPath(); g.arc(ax + 7, ay + 6, 4, 0, 7); g.fill();
        }
        if (tall && w >= 96 && h >= 96) {
          const cx = x + w / 2, cy = y + h / 2;
          g.strokeStyle = '#d8c94a'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 22, 0, 7); g.stroke();
          g.fillStyle = '#d8c94a'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', cx, cy + 1);
        }
      }
    }
    if (b.label) {
      g.font = `bold ${b.style === 'shop' ? 9 : 13}px sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const lx = x + w / 2, ly = b.style === 'shop' ? y + h / 2 - 2 : (b.style === 'hospital' ? y + 14 : y + h / 2);
      const tw = g.measureText(b.label).width + 10;
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(lx - tw / 2, ly - 9, tw, 18);
      g.fillStyle = '#f4f1e8'; g.fillText(b.label, lx, ly + 1);
    }
  }

  star(g, cx, cy, r, color) {
    g.fillStyle = color; g.beginPath();
    for (let k = 0; k < 10; k++) {
      const rr = k % 2 ? r * 0.45 : r;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
  }

  // Imagem do mapa inteiro (1 tile = `px` pixels) para minimapa e mapa grande.
  buildMapImage(px = 2) {
    const city = this.city;
    const cv = document.createElement('canvas');
    cv.width = cv.height = MAP * px;
    const g = cv.getContext('2d');
    const col = {
      [TT.GRASS]: '#2f4a2c', [TT.TREE]: '#24401f', [TT.ROAD]: '#5d6168', [TT.SIDEWALK]: '#3e4146', [TT.BUILDING]: '#1c1e23',
      [TT.WATER]: '#173247', [TT.PARKING]: '#45484e', [TT.PLAZA]: '#4f4a40', [TT.LOT]: '#3f3a31', [TT.DOCK]: '#3c3b38', [TT.POOL]: '#2a6b84',
    };
    for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
      g.fillStyle = col[city.t(x, y)] || '#333';
      g.fillRect(x * px, y * px, px, px);
    }
    return cv;
  }
}
