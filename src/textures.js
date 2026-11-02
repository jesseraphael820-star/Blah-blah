// Procedural textures (all generated at runtime on canvas — no external assets).
import * as THREE from 'three';
import { mulberry32 } from './util.js';

let ANISO = 8;
export function setAniso(a) { ANISO = a; }

function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = ANISO;
  t.needsUpdate = true;
  return t;
}
function speckle(g, w, h, n, alpha, rand) {
  for (let i = 0; i < n; i++) {
    const v = rand();
    g.fillStyle = rand() < 0.5 ? `rgba(0,0,0,${alpha * v})` : `rgba(255,255,255,${alpha * v})`;
    g.fillRect(rand() * w, rand() * h, 1 + rand() * 2.5, 1 + rand() * 2.5);
  }
}

export const FACADE_STYLES = [
  { name: 'stucco-beige', wall: '#d6c09a', frame: '#f3ead8', ac: true },
  { name: 'stucco-pink', wall: '#d79a92', frame: '#f6e4dc', ac: true },
  { name: 'brick', wall: '#8b4632', frame: '#ddd3c2', ac: true, brick: true },
  { name: 'concrete', wall: '#9b9a94', frame: '#c9c7c0', ac: true },
  { name: 'glass-blue', wall: '#253645', glass: true, glassTop: '#b9d3e8', glassCol: '#4d6f8e', glassBot: '#1c2b3a', mullion: '#1a232c', metal: true },
  { name: 'modern-white', wall: '#e9e8e2', wide: true, mullion: '#c7c7c2', glassTop: '#c2d6e4', glassCol: '#46596b' },
  { name: 'glass-teal', wall: '#2e5250', glass: true, glassTop: '#c8e6df', glassCol: '#3f7570', glassBot: '#183331', mullion: '#132422', metal: true },
  { name: 'stucco-yellow', wall: '#dfc06a', frame: '#fbf3da', ac: true },
  { name: 'stucco-mint', wall: '#9cc7b0', frame: '#eef7f1', ac: true },
  { name: 'gang-dirty', wall: '#6c6258', frame: '#8a8075', ac: true, dirty: true },
];

export function makeFacade(s, seed) {
  const rand = mulberry32(seed);
  const S = 512, cell = 128;
  const c = mk(S, S), g = c.getContext('2d');
  const e = mk(S, S), ge = e.getContext('2d');
  g.fillStyle = s.wall; g.fillRect(0, 0, S, S);
  speckle(g, S, S, 9000, s.dirty ? 0.18 : 0.07, rand);
  if (s.brick) {
    g.strokeStyle = 'rgba(40,20,10,0.35)'; g.lineWidth = 1;
    for (let y = 0; y < S; y += 8) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke();
      for (let x = (y / 8) % 2 ? 0 : 8; x < S; x += 16) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 8); g.stroke(); }
    }
  }
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  for (let r = 0; r < 4; r++) {
    if (!s.glass) {
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, r * cell + cell - 6, S, 6);
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, r * cell + cell - 8, S, 2);
    }
    for (let k = 0; k < 4; k++) {
      const x = k * cell, y = r * cell;
      let wx, wy, ww, wh;
      if (s.glass) { wx = x + 3; wy = y + 6; ww = cell - 6; wh = cell - 16; }
      else if (s.wide) { wx = x; wy = y + 34; ww = cell; wh = 58; }
      else { wx = x + 30; wy = y + 24; ww = 68; wh = 76; }
      if (!s.glass && !s.wide) {
        g.fillStyle = s.frame; g.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
        g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(wx - 8, wy + wh + 6, ww + 16, 6);
      }
      const gr = g.createLinearGradient(0, wy, 0, wy + wh);
      gr.addColorStop(0, s.glassTop || '#a9c0d2');
      gr.addColorStop(0.55, s.glassCol || '#34475a');
      gr.addColorStop(1, s.glassBot || '#1b2631');
      g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
      // reflections streak
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.beginPath(); g.moveTo(wx + ww * 0.1, wy + wh); g.lineTo(wx + ww * 0.45, wy); g.lineTo(wx + ww * 0.6, wy); g.lineTo(wx + ww * 0.25, wy + wh); g.fill();
      g.fillStyle = s.mullion || s.frame;
      if (s.glass) { g.fillRect(wx + ww / 2 - 1, wy, 2, wh); }
      else if (s.wide) { for (let m = 0; m < 4; m++) g.fillRect(x + m * 32, wy, 3, wh); }
      else { g.fillRect(wx + ww / 2 - 2, wy, 4, wh); g.fillRect(wx, wy + wh * 0.38, ww, 3); }
      if (!s.glass && rand() < 0.35) {
        g.fillStyle = `rgba(${(200 + rand() * 55) | 0},${(170 + rand() * 70) | 0},${(140 + rand() * 90) | 0},0.7)`;
        g.fillRect(wx, wy, ww * (0.2 + rand() * 0.3), wh);
      }
      if (s.ac && rand() < 0.18) {
        g.fillStyle = '#c4c4c0'; g.fillRect(wx + ww - 28, wy + wh - 8, 26, 18);
        g.fillStyle = '#6d6d6d'; for (let q = 0; q < 4; q++) g.fillRect(wx + ww - 26, wy + wh - 5 + q * 4, 22, 1.5);
      }
      if (rand() < (s.dirty ? 0.15 : 0.4)) {
        const b = 0.55 + rand() * 0.45, warm = rand() < 0.78;
        ge.fillStyle = warm ? `rgb(${(255 * b) | 0},${(196 * b) | 0},${(118 * b) | 0})` : `rgb(${(170 * b) | 0},${(205 * b) | 0},${(255 * b) | 0})`;
        ge.fillRect(wx, wy, ww, wh);
        ge.fillStyle = '#000';
        if (s.glass) ge.fillRect(wx + ww / 2 - 1, wy, 2, wh);
        else if (!s.wide) { ge.fillRect(wx + ww / 2 - 2, wy, 4, wh); ge.fillRect(wx, wy + wh * 0.38, ww, 3); }
      }
    }
  }
  for (let i = 0; i < 50; i++) {
    g.fillStyle = `rgba(0,0,0,${s.dirty ? 0.08 : 0.035})`;
    g.fillRect(rand() * S, rand() * S * 0.5, 2 + rand() * 7, S * (0.3 + rand() * 0.7));
  }
  return { map: tex(c), emissive: tex(e) };
}

export function makeRoof(seed = 7) {
  const rand = mulberry32(seed);
  const c = mk(256, 256), g = c.getContext('2d');
  g.fillStyle = '#6b6862'; g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 256, 8000, 0.2, rand);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
  for (let i = 0; i < 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  return tex(c);
}

function asphalt(g, w, h, rand) {
  g.fillStyle = '#3b3b3d'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, w * h * 0.12, 0.22, rand);
  for (let i = 0; i < 18; i++) {
    g.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.08})`;
    g.beginPath(); g.ellipse(rand() * w, rand() * h, 10 + rand() * 40, 5 + rand() * 20, rand() * 3, 0, Math.PI * 2); g.fill();
  }
}

// 256px = 16m wide x 16m long. v runs along the road.
export function makeRoad() {
  const rand = mulberry32(11);
  const c = mk(256, 256), g = c.getContext('2d');
  asphalt(g, 256, 256, rand);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (const x of [52, 76, 180, 204]) g.fillRect(x - 6, 0, 12, 256);
  g.fillStyle = '#e8e4d8';
  g.fillRect(10, 0, 3, 256); g.fillRect(243, 0, 3, 256);
  g.fillStyle = '#e2b93b';
  g.fillRect(124, 0, 3, 256); g.fillRect(129, 0, 3, 256);
  speckle(g, 256, 256, 3000, 0.25, rand);
  return tex(c);
}

export function makeIntersection() {
  const rand = mulberry32(12);
  const c = mk(256, 256), g = c.getContext('2d');
  asphalt(g, 256, 256, rand);
  g.fillStyle = '#e8e4d8';
  for (let i = 18; i < 238; i += 18) {
    g.fillRect(i, 4, 10, 34); g.fillRect(i, 218, 10, 34);
    g.fillRect(4, i, 34, 10); g.fillRect(218, i, 34, 10);
  }
  speckle(g, 256, 256, 4000, 0.3, rand);
  return tex(c);
}

export function makeSidewalk() {
  const rand = mulberry32(13);
  const c = mk(256, 256), g = c.getContext('2d');
  g.fillStyle = '#a9a59c'; g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 256, 9000, 0.12, rand);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    g.fillStyle = `rgba(${rand() < 0.5 ? 0 : 255},${rand() < 0.5 ? 0 : 255},0,${0.02 + rand() * 0.03})`;
    g.fillRect(x * 64, y * 64, 64, 64);
  }
  g.strokeStyle = 'rgba(60,55,50,0.55)'; g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  return tex(c);
}

export function makeGrass() {
  const rand = mulberry32(14);
  const c = mk(256, 256), g = c.getContext('2d');
  g.fillStyle = '#5d7a37'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 14000; i++) {
    const v = rand();
    g.fillStyle = `rgba(${(60 + v * 70) | 0},${(90 + v * 70) | 0},${(30 + v * 30) | 0},0.5)`;
    g.fillRect(rand() * 256, rand() * 256, 1, 2 + rand() * 3);
  }
  for (let i = 0; i < 20; i++) {
    g.fillStyle = 'rgba(120,100,50,0.12)';
    g.beginPath(); g.arc(rand() * 256, rand() * 256, 8 + rand() * 22, 0, 7); g.fill();
  }
  return tex(c);
}

export function makeSand() {
  const rand = mulberry32(15);
  const c = mk(256, 256), g = c.getContext('2d');
  g.fillStyle = '#d9c497'; g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 256, 14000, 0.14, rand);
  return tex(c);
}

export function makeWaterNormal() {
  const S = 256;
  const c = mk(S, S), g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const hgt = (x, y) => {
    const u = (x / S) * Math.PI * 2, v = (y / S) * Math.PI * 2;
    return Math.sin(u * 3 + v * 2) * 0.5 + Math.sin(u * 7 - v * 5) * 0.25 + Math.sin(u * 13 + v * 11) * 0.12 + Math.cos(v * 9 - u * 4) * 0.2;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1);
    let nx = -dx * 2, ny = -dy * 2, nz = 1; const l = Math.hypot(nx, ny, nz);
    const i = (y * S + x) * 4;
    img.data[i] = ((nx / l) * 0.5 + 0.5) * 255; img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255; img.data[i + 2] = ((nz / l) * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, false);
}

export function makeGlow() {
  const c = mk(128, 128), g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,220,160,1)'); gr.addColorStop(0.4, 'rgba(255,190,110,0.45)'); gr.addColorStop(1, 'rgba(255,170,80,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return tex(c, true, false);
}

export function makeSoftDot() {
  const c = mk(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return tex(c, true, false);
}

export function makeLeaf() {
  const c = mk(64, 256), g = c.getContext('2d');
  g.clearRect(0, 0, 64, 256);
  g.strokeStyle = '#4d6b22'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 256); g.stroke();
  for (let y = 6; y < 250; y += 7) {
    const len = 28 * Math.sin((y / 256) * Math.PI) + 3;
    const col = `rgb(${50 + ((y * 7) % 30)},${100 + ((y * 13) % 40)},${30})`;
    g.strokeStyle = col; g.lineWidth = 4;
    g.beginPath(); g.moveTo(32, y); g.lineTo(32 - len, y + 10); g.stroke();
    g.beginPath(); g.moveTo(32, y); g.lineTo(32 + len, y + 10); g.stroke();
  }
  const t = tex(c, true, false);
  return t;
}

export function makeSign(text, { bg = '#1b1b1b', fg = '#ffd24a', w = 512, h = 128, font = 'bold 72px Impact, Arial Black, sans-serif', border = null } = {}) {
  const c = mk(w, h), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (border) { g.strokeStyle = border; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); }
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 4);
  return tex(c, true, false);
}

export function makeGraffiti(text, seed = 3) {
  const rand = mulberry32(seed);
  const c = mk(512, 256), g = c.getContext('2d');
  g.clearRect(0, 0, 512, 256);
  g.save(); g.translate(256, 128); g.rotate((rand() - 0.5) * 0.2);
  g.font = 'bold 120px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 16; g.strokeStyle = '#120a1c'; g.strokeText(text, 0, 0);
  const gr = g.createLinearGradient(0, -60, 0, 60); gr.addColorStop(0, '#d38cff'); gr.addColorStop(1, '#6a1fb0');
  g.fillStyle = gr; g.fillText(text, 0, 0);
  g.restore();
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(140,60,200,0.6)'; g.fillRect(rand() * 512, 150 + rand() * 90, 2, 6 + rand() * 30); }
  return tex(c, true, false);
}
