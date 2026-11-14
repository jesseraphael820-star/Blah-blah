// Texturas procedurais (canvas) para mapas e skins. Tudo original, gerado em tempo de execução.
import * as THREE from '../vendor/three.min.js';

const cache = new Map();
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function canvas(size) { const c = document.createElement('canvas'); c.width = c.height = size; return [c, c.getContext('2d')]; }
function speckle(g, S, r, n, cols, a = 0.08, max = 2) {
  for (let i = 0; i < n; i++) { g.fillStyle = cols[(r() * cols.length) | 0]; g.globalAlpha = a * (0.4 + r()); const s = 1 + r() * max; g.fillRect(r() * S, r() * S, s, s); }
  g.globalAlpha = 1;
}
function stains(g, S, r, n, col = '#000', a = 0.06) {
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, rad = 10 + r() * S * 0.2, gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, col); gr.addColorStop(1, 'transparent'); g.globalAlpha = a * (0.5 + r()); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalAlpha = 1;
}
function tex(key, size, draw, repeat = true) {
  if (cache.has(key)) return cache.get(key);
  const [c, g] = canvas(size); draw(g, size, rng(key.length * 7919 + key.charCodeAt(0) * 31 + key.charCodeAt(key.length - 1)));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  cache.set(key, t); return t;
}

const MAP_TEX = {
  concrete(g, S, r, base = '#8d9094') {
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    speckle(g, S, r, 5000, ['#000', '#fff', '#555'], 0.07); stains(g, S, r, 12);
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 2; g.strokeRect(1, 1, S - 2, S - 2);
    g.beginPath(); g.moveTo(0, S / 2); g.lineTo(S, S / 2); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1;
    for (let i = 0; i < 3; i++) { let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 40; y += r() * 30; g.lineTo(x, y); } g.stroke(); }
  },
  brick(g, S, r, base = '#8a4b3a') {
    g.fillStyle = '#5b5148'; g.fillRect(0, 0, S, S);
    const bh = S / 8, bw = S / 4;
    for (let y = 0; y < 8; y++) for (let x = -1; x < 4; x++) {
      const ox = (y % 2) * bw / 2, l = 0.8 + r() * 0.4;
      g.fillStyle = base; g.globalAlpha = 1; g.fillRect(x * bw + ox + 2, y * bh + 2, bw - 4, bh - 4);
      g.fillStyle = l > 1 ? '#fff' : '#000'; g.globalAlpha = Math.abs(l - 1) * 0.5; g.fillRect(x * bw + ox + 2, y * bh + 2, bw - 4, bh - 4);
    }
    g.globalAlpha = 1; speckle(g, S, r, 3000, ['#000', '#fff'], 0.06); stains(g, S, r, 8);
  },
  metal(g, S, r, base = '#5d666e') {
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 200; i++) { g.fillStyle = r() > 0.5 ? '#fff' : '#000'; g.globalAlpha = 0.03; g.fillRect(0, r() * S, S, 1 + r() * 2); }
    g.globalAlpha = 1; stains(g, S, r, 8, '#3a2412', 0.12);
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2; g.strokeRect(1, 1, S - 2, S - 2);
    g.fillStyle = 'rgba(20,20,20,.6)';
    for (const [x, y] of [[10, 10], [S - 10, 10], [10, S - 10], [S - 10, S - 10]]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
  },
  container(g, S, r, base = '#2f6ea5') {
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += S / 16) { const gr = g.createLinearGradient(x, 0, x + S / 16, 0); gr.addColorStop(0, 'rgba(0,0,0,.28)'); gr.addColorStop(0.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(0,0,0,.28)'); g.fillStyle = gr; g.fillRect(x, 0, S / 16, S); }
    stains(g, S, r, 10, '#4a2a10', 0.14); speckle(g, S, r, 1500, ['#000', '#fff'], 0.06);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, S, 5); g.fillRect(0, S - 5, S, 5);
  },
  sand(g, S, r) {
    g.fillStyle = '#c9a56b'; g.fillRect(0, 0, S, S);
    speckle(g, S, r, 9000, ['#8c6a3a', '#f0d9a0', '#a8834c'], 0.12); stains(g, S, r, 14, '#7a5a2c', 0.07);
  },
  sandstone(g, S, r) {
    g.fillStyle = '#c2a070'; g.fillRect(0, 0, S, S);
    const bh = S / 4;
    for (let y = 0; y < 4; y++) for (let x = -1; x < 2; x++) { const ox = (y % 2) * S / 4; g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)'; g.fillRect(x * S / 2 + ox + 2, y * bh + 2, S / 2 - 4, bh - 4); g.strokeStyle = 'rgba(70,45,20,.45)'; g.lineWidth = 2; g.strokeRect(x * S / 2 + ox, y * bh, S / 2, bh); }
    speckle(g, S, r, 5000, ['#7a5a2c', '#f5e2b5'], 0.09); stains(g, S, r, 8, '#5a3d1a', 0.08);
  },
  wood(g, S, r) {
    g.fillStyle = '#8a6238'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(${r() > 0.5 ? '255,220,160' : '40,20,0'},.1)`; g.fillRect(0, i * S / 5, S, S / 5 - 2); g.fillStyle = 'rgba(30,15,5,.6)'; g.fillRect(0, (i + 1) * S / 5 - 2, S, 2); }
    for (let i = 0; i < 120; i++) { g.strokeStyle = 'rgba(50,25,5,.14)'; g.beginPath(); const y = r() * S; g.moveTo(0, y); g.bezierCurveTo(S / 3, y + r() * 6 - 3, S * 2 / 3, y + r() * 6 - 3, S, y); g.stroke(); }
    g.strokeStyle = '#4a3018'; g.lineWidth = S / 14; g.strokeRect(0, 0, S, S);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(S, S); g.stroke();
  },
  asphalt(g, S, r) {
    g.fillStyle = '#3a3d42'; g.fillRect(0, 0, S, S);
    speckle(g, S, r, 9000, ['#000', '#888', '#555'], 0.12, 1.5); stains(g, S, r, 10, '#000', 0.08);
  },
  plaster(g, S, r, base = '#b9ab95') {
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    speckle(g, S, r, 4000, ['#000', '#fff'], 0.05); stains(g, S, r, 10, '#3d2e1c', 0.07);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, S - S / 10, S, S / 10);
    g.fillStyle = 'rgba(20,28,36,.75)'; // janelas
    for (let i = 0; i < 2; i++) { g.fillRect(S * (0.14 + i * 0.5), S * 0.2, S * 0.22, S * 0.36); g.strokeStyle = 'rgba(240,240,230,.5)'; g.lineWidth = 3; g.strokeRect(S * (0.14 + i * 0.5), S * 0.2, S * 0.22, S * 0.36); }
  },
  tile(g, S, r) {
    g.fillStyle = '#6f757b'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)'; g.fillRect(x * S / 2, y * S / 2, S / 2, S / 2); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(x * S / 2, y * S / 2, S / 2, S / 2); }
    speckle(g, S, r, 4000, ['#000', '#fff'], 0.06); stains(g, S, r, 10);
  },
  sandbag(g, S, r) {
    g.fillStyle = '#4b4a36'; g.fillRect(0, 0, S, S);
    const bh = S / 4, bw = S / 2;
    for (let y = 0; y < 4; y++) for (let x = -1; x < 2; x++) { const ox = (y % 2) * bw / 2, gr = g.createLinearGradient(0, y * bh, 0, (y + 1) * bh); gr.addColorStop(0, '#a39a70'); gr.addColorStop(1, '#6f6848'); g.fillStyle = gr; g.beginPath(); g.roundRect(x * bw + ox + 3, y * bh + 3, bw - 6, bh - 5, 14); g.fill(); }
    speckle(g, S, r, 3000, ['#000', '#fff'], 0.07);
  },
};
const VARIANTS = {
  concreteDark: ['concrete', '#5f6468'], concreteGreen: ['concrete', '#6f7a66'], brickDark: ['brick', '#6b4034'], brickYellow: ['brick', '#a8874f'],
  metalRust: ['metal', '#7a5038'], metalGreen: ['metal', '#4d5a48'],
  contRed: ['container', '#a53a2f'], contBlue: ['container', '#2f6ea5'], contGreen: ['container', '#3b7d4f'], contYellow: ['container', '#c2992e'], contWhite: ['container', '#b9bec2'],
  plasterBlue: ['plaster', '#8fa0ad'], plasterRed: ['plaster', '#a8705f'], plasterYellow: ['plaster', '#c4ab6a'],
};
export function mapTexture(name) {
  const v = VARIANTS[name];
  const fn = MAP_TEX[v ? v[0] : name] || MAP_TEX.concrete;
  return tex('map_' + name, 256, (g, S, r) => fn(g, S, r, v ? v[1] : undefined));
}

// ---------- Skins ----------
const SKIN_TEX = {
  areia(g, S, r) {
    g.fillStyle = '#b79a68'; g.fillRect(0, 0, S, S);
    const cols = ['#8a6f42', '#d8c08c', '#6b5a3a'];
    for (let i = 0; i < 40; i++) { g.fillStyle = cols[i % 3]; g.beginPath(); g.ellipse(r() * S, r() * S, 10 + r() * 30, 6 + r() * 16, r() * 3, 0, 7); g.fill(); }
  },
  urbano(g, S, r) {
    g.fillStyle = '#7d848b'; g.fillRect(0, 0, S, S);
    const cols = ['#40464d', '#b5bcc2', '#1f2328'];
    for (let i = 0; i < 300; i++) { g.fillStyle = cols[(r() * 3) | 0]; const s = 8 + ((r() * 3) | 0) * 8; g.fillRect(((r() * S / 8) | 0) * 8, ((r() * S / 8) | 0) * 8, s, 8); }
  },
  teia(g, S, r) {
    const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, '#c2142a'); gr.addColorStop(1, '#5a0812'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.strokeStyle = '#0a0a0c'; g.lineWidth = 2.5;
    for (let c = 0; c < 4; c++) {
      const cx = r() * S, cy = r() * S, n = 9;
      for (let i = 0; i < n; i++) { const a = i / n * 6.283; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * S, cy + Math.sin(a) * S); g.stroke(); }
      for (let ring = 1; ring < 6; ring++) { g.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * 6.283, rr = ring * 22 * (0.9 + (i % 2) * 0.12); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    }
  },
  rubra(g, S, r) {
    g.fillStyle = '#16171a'; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(255,255,255,.05)'; for (let i = -S; i < S; i += 6) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); }
    g.strokeStyle = '#e2202c'; g.lineWidth = 7; g.beginPath(); g.moveTo(0, S * 0.62); g.lineTo(S * 0.35, S * 0.62); g.lineTo(S * 0.5, S * 0.4); g.lineTo(S, S * 0.4); g.stroke();
    g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, S * 0.7); g.lineTo(S * 0.38, S * 0.7); g.lineTo(S * 0.53, S * 0.48); g.lineTo(S, S * 0.48); g.stroke();
    g.fillStyle = '#e2202c'; g.font = `bold ${S / 9}px sans-serif`; g.fillText('RX-7', S * 0.08, S * 0.3);
  },
  vetor(g, S, r) {
    g.fillStyle = '#eceff1'; g.fillRect(0, 0, S, S);
    const poly = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0] * S, p[1] * S) : g.moveTo(p[0] * S, p[1] * S)); g.fill(); };
    poly([[0, 0.55], [0.3, 0.55], [0.45, 0.8], [0.45, 1], [0, 1]], '#ff7a1a');
    poly([[0.55, 0], [1, 0], [1, 0.3], [0.7, 0.3]], '#ff7a1a');
    poly([[0.3, 0.55], [0.62, 0.55], [0.7, 0.3], [0.55, 0], [0.4, 0], [0.4, 0.3]], '#17191c');
    poly([[0.6, 0.7], [1, 0.7], [1, 0.78], [0.64, 0.78]], '#17191c');
    g.fillStyle = '#17191c'; g.font = `bold ${S / 12}px monospace`; g.fillText('ORB//04', S * 0.06, S * 0.2); g.fillRect(S * 0.06, S * 0.25, S * 0.2, 3);
    for (let i = 0; i < 5; i++) g.fillRect(S * 0.72 + i * 9, S * 0.86, 5, S * 0.08);
  },
  fera(g, S, r) {
    const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, '#12c7c0'); gr.addColorStop(0.5, '#7a1fd1'); gr.addColorStop(1, '#ff2f92'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    const cols = ['#ffe23d', '#2dff7a', '#ff5a1f', '#101018'];
    for (let i = 0; i < 26; i++) { g.fillStyle = cols[i % 4]; g.beginPath(); const x = r() * S, y = r() * S; g.moveTo(x, y); for (let k = 0; k < 5; k++) g.quadraticCurveTo(x + (r() - 0.5) * 120, y + (r() - 0.5) * 120, x + (r() - 0.5) * 90, y + (r() - 0.5) * 90); g.fill(); }
    for (let i = 0; i < 3; i++) { const x = S * (0.2 + i * 0.3), y = S * (0.3 + r() * 0.4); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, y, 22, 13, 0.3, 0, 7); g.fill(); g.fillStyle = '#e0152a'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.ellipse(x, y, 3, 9, 0, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; for (let i = 0; i < 12; i++) { const x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 7, y + 20); g.lineTo(x + 14, y); g.fill(); }
  },
  aurora(g, S) {
    const gr = g.createLinearGradient(0, 0, S, S * 0.6);
    [[0, '#3b1c8f'], [0.3, '#c0249b'], [0.55, '#ff5a4a'], [0.8, '#ffc23d'], [1, '#fff3a8']].forEach(([p, c]) => gr.addColorStop(p, c));
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    const sh = g.createLinearGradient(0, 0, S, 0); sh.addColorStop(0.3, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,.35)'); sh.addColorStop(0.7, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(0, 0, S, S);
  },
  magma(g, S, r) {
    g.fillStyle = '#120806'; g.fillRect(0, 0, S, S);
    const cols = ['#ff3b0f', '#ffb21f', '#b3120a', '#fff0a0'];
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = cols[i % 4]; g.lineWidth = 2 + r() * 12; g.globalAlpha = 0.5 + r() * 0.5; g.beginPath();
      let x = r() * S, y = r() * S; g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { const nx = x + (r() - 0.5) * 150, ny = y + (r() - 0.5) * 150; g.bezierCurveTo(x + (r() - 0.5) * 100, y + (r() - 0.5) * 100, nx + (r() - 0.5) * 100, ny + (r() - 0.5) * 100, nx, ny); x = nx; y = ny; }
      g.stroke();
    }
    g.globalAlpha = 1;
  },
  nebulosa(g, S, r) {
    g.fillStyle = '#060818'; g.fillRect(0, 0, S, S);
    const cols = ['#2a3bff', '#9a2bff', '#12c2ff', '#ff3bd0'];
    for (let i = 0; i < 26; i++) { const x = r() * S, y = r() * S, rad = 30 + r() * 80, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, cols[i % 4]); gr.addColorStop(1, 'transparent'); g.globalAlpha = 0.45; g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    g.globalAlpha = 1; g.fillStyle = '#fff';
    for (let i = 0; i < 90; i++) { g.globalAlpha = r(); g.fillRect(r() * S, r() * S, 1 + r() * 1.5, 1 + r() * 1.5); }
    g.globalAlpha = 1;
  },
  lenda(g, S, r) {
    const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, '#f7dc7a'); gr.addColorStop(0.5, '#b8861b'); gr.addColorStop(1, '#f2c94c'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(70,40,0,.7)'; g.lineWidth = 2;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const cx = (x + 0.5) * S / 4, cy = (y + 0.5) * S / 4;
      for (let k = 0; k < 4; k++) { g.beginPath(); const a = k * 1.5708; for (let t = 0; t < 40; t++) { const rr = t * 0.75, aa = a + t * 0.16; const px = cx + Math.cos(aa) * rr, py = cy + Math.sin(aa) * rr; t ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }
      g.fillStyle = '#5a3a05'; g.beginPath(); g.arc(cx, cy, 4, 0, 7); g.fill();
    }
    g.strokeStyle = 'rgba(255,255,220,.5)'; g.lineWidth = 3; g.strokeRect(4, 4, S - 8, S - 8);
  },
  drakon(g, S, r) {
    const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, '#1e3b2c'); gr.addColorStop(1, '#0c1a14'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    // escamas
    const sc = S / 10;
    for (let y = -1; y < 11; y++) for (let x = -1; x < 11; x++) {
      const cx = x * sc + (y % 2) * sc / 2, cy = y * sc * 0.8, sg = g.createRadialGradient(cx, cy, 2, cx, cy, sc * 0.7);
      sg.addColorStop(0, '#f2cf5a'); sg.addColorStop(0.7, '#a8751a'); sg.addColorStop(1, '#3b2607');
      g.fillStyle = sg; g.beginPath(); g.arc(cx, cy, sc * 0.62, 0, Math.PI); g.fill();
      g.strokeStyle = '#2a1904'; g.lineWidth = 1.5; g.stroke();
    }
    // chamas
    for (let i = 0; i < 9; i++) {
      const x = r() * S, y = S * (0.5 + r() * 0.5), fg = g.createLinearGradient(x, y, x, y - 90); fg.addColorStop(0, 'rgba(255,90,20,.9)'); fg.addColorStop(1, 'rgba(255,220,80,0)');
      g.fillStyle = fg; g.beginPath(); g.moveTo(x - 16, y); g.quadraticCurveTo(x - 20, y - 50, x + 4, y - 95); g.quadraticCurveTo(x + 22, y - 45, x + 16, y); g.fill();
    }
    // olho do dragão
    g.fillStyle = '#ffd23d'; g.beginPath(); g.ellipse(S * 0.5, S * 0.3, 34, 18, -0.2, 0, 7); g.fill();
    g.fillStyle = '#120a00'; g.beginPath(); g.ellipse(S * 0.5, S * 0.3, 6, 17, -0.2, 0, 7); g.fill();
    g.strokeStyle = '#7a1408'; g.lineWidth = 4; g.beginPath(); g.ellipse(S * 0.5, S * 0.3, 36, 20, -0.2, 0, 7); g.stroke();
  },
};
export function skinTexture(id) {
  if (!SKIN_TEX[id]) return null;
  return tex('skin_' + id, 256, SKIN_TEX[id]);
}
export function skinPreviewCSS(id) { // miniatura 2D p/ UI
  if (!SKIN_TEX[id]) return '';
  return skinTexture(id).image.toDataURL();
}

export function softSprite() {
  return tex('soft', 64, (g, S) => { const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); }, false);
}
export function smokeSprite() {
  return tex('smokeP', 128, (g, S, r) => {
    for (let i = 0; i < 22; i++) { const x = S / 2 + (r() - 0.5) * S * 0.45, y = S / 2 + (r() - 0.5) * S * 0.45, rad = S * (0.14 + r() * 0.16), gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); }
  }, false);
}
export function labelTexture(text, color = '#ffd23d') {
  return tex('lbl_' + text + color, 256, (g, S) => {
    g.clearRect(0, 0, S, S); g.strokeStyle = color; g.lineWidth = 10; g.globalAlpha = 0.85; g.strokeRect(14, 14, S - 28, S - 28);
    g.setLineDash([18, 12]); g.lineWidth = 4; g.strokeRect(30, 30, S - 60, S - 60);
    g.fillStyle = color; g.font = `bold ${S * 0.55}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, S / 2, S / 2 + 6);
  }, false);
}
export function skyTexture(top, mid, bot) {
  return tex('sky' + top + mid + bot, 256, (g, S) => { const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, top); gr.addColorStop(0.5, mid); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, S, S); }, false);
}
