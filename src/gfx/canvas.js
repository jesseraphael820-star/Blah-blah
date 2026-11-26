// Helpers de pixel art: criação de canvas, cores e primitivas.
import { clamp } from '../core/util.js';

export function makeCanvas(w, h) {
  let c;
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') c = new OffscreenCanvas(w, h);
  else { c = document.createElement('canvas'); c.width = w; c.height = h; }
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  c.ctx = ctx;
  return c;
}

const rgbCache = new Map();
export function hexToRgb(hex) {
  let r = rgbCache.get(hex);
  if (r) return r;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  r = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  rgbCache.set(hex, r);
  return r;
}
export const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
export const darken = (c, t) => mix(c, '#000000', t);
export const lighten = (c, t) => mix(c, '#ffffff', t);
export function shade(c, amt) { return amt >= 0 ? lighten(c, amt) : darken(c, -amt); }
export function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }

// Desenhador de pixels com buffer ImageData para velocidade
export class PixelPainter {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.canvas = makeCanvas(w, h);
    this.img = this.canvas.ctx.createImageData(w, h);
    this.d = this.img.data;
  }
  set(x, y, hex, a = 255) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !hex) return;
    const [r, g, b] = hexToRgb(hex);
    const i = (y * this.w + x) * 4;
    if (a >= 255) { this.d[i] = r; this.d[i + 1] = g; this.d[i + 2] = b; this.d[i + 3] = 255; }
    else {
      const t = a / 255, ia = 1 - t, oa = this.d[i + 3] / 255;
      this.d[i] = r * t + this.d[i] * ia; this.d[i + 1] = g * t + this.d[i + 1] * ia; this.d[i + 2] = b * t + this.d[i + 2] * ia;
      this.d[i + 3] = Math.min(255, (t + oa * ia) * 255);
    }
  }
  get(x, y) { const i = (y * this.w + x) * 4; return this.d[i + 3] ? rgbToHex(this.d[i], this.d[i + 1], this.d[i + 2]) : null; }
  alpha(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0; return this.d[(y * this.w + x) * 4 + 3]; }
  rect(x, y, w, h, hex, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, hex, a); }
  hline(x, y, w, hex) { for (let i = 0; i < w; i++) this.set(x + i, y, hex); }
  vline(x, y, h, hex) { for (let j = 0; j < h; j++) this.set(x, y + j, hex); }
  ellipse(cx, cy, rx, ry, hex, a) {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx + 0.01) + (y * y) / (ry * ry + 0.01) <= 1) this.set(cx + x, cy + y, hex, a);
  }
  circle(cx, cy, r, hex, a) { this.ellipse(cx, cy, r, r, hex, a); }
  line(x0, y0, x1, y1, hex) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) { this.set(x0, y0, hex); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  // contorno automático escuro em pixels transparentes vizinhos de opacos
  outline(hex = '#1a1220', diag = false) {
    const pts = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.alpha(x, y)) continue;
      if (this.alpha(x - 1, y) > 128 || this.alpha(x + 1, y) > 128 || this.alpha(x, y - 1) > 128 || this.alpha(x, y + 1) > 128 ||
        (diag && (this.alpha(x - 1, y - 1) > 128 || this.alpha(x + 1, y + 1) > 128 || this.alpha(x + 1, y - 1) > 128 || this.alpha(x - 1, y + 1) > 128))) pts.push(x, y);
    }
    for (let i = 0; i < pts.length; i += 2) this.set(pts[i], pts[i + 1], hex);
  }
  done() { this.canvas.ctx.putImageData(this.img, 0, 0); return this.canvas; }
}

export function flipH(src) {
  const c = makeCanvas(src.width, src.height);
  c.ctx.translate(src.width, 0); c.ctx.scale(-1, 1); c.ctx.drawImage(src, 0, 0);
  return c;
}

export function tint(src, color, amount) {
  const c = makeCanvas(src.width, src.height);
  c.ctx.drawImage(src, 0, 0);
  c.ctx.globalCompositeOperation = 'source-atop';
  c.ctx.globalAlpha = amount; c.ctx.fillStyle = color; c.ctx.fillRect(0, 0, src.width, src.height);
  return c;
}

export function silhouette(src, color) { return tint(src, color, 1); }
