// Partículas, clima (chuva, neve, neblina, cinzas, tempestade), iluminação dinâmica e fonte de pixels.
import { makeCanvas, rgba } from './canvas.js';
import { fbm, clamp } from '../core/util.js';

// ---------- Partículas ----------
export class Particles {
  constructor() { this.list = []; this.max = 900; }
  add(o) { if (this.list.length < this.max) this.list.push(Object.assign({ vx: 0, vy: 0, life: 1, max: 1, size: 1, grav: 0, drag: 0, color: '#fff', type: 'dot', z: 0, vz: 0 }, o, { max: o.life || 1 })); }
  burst(x, y, n, color, speed = 60, life = 0.5, extra = {}) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7); this.add(Object.assign({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: life * (0.6 + Math.random() * 0.6), color, grav: 160, drag: 2 }, extra)); }
  }
  text(x, y, str, color = '#fff') { this.add({ x, y, vy: -28, life: 0.9, type: 'text', str, color, drag: 2.5 }); }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { L[i] = L[L.length - 1]; L.pop(); continue; }
      if (p.type === 'leaf') { p.vx += Math.sin(p.life * 3 + p.seed) * 30 * dt; }
      if (p.type === 'firefly') { p.vx += (Math.random() - 0.5) * 40 * dt; p.vy += (Math.random() - 0.5) * 40 * dt; }
      p.vy += p.grav * dt;
      if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
  draw(ctx, cx, cy) {
    for (const p of this.list) {
      const x = Math.round(p.x - cx), y = Math.round(p.y - cy);
      const a = clamp(p.life / p.max * (p.fadeIn ? Math.min(1, (p.max - p.life) * 3) : 1), 0, 1);
      if (p.type === 'text') { drawPixelText(ctx, p.str, x, y, p.color, a); continue; }
      ctx.globalAlpha = p.type === 'smoke' ? a * 0.35 : p.type === 'firefly' ? (0.5 + Math.sin(p.life * 8) * 0.5) : a;
      ctx.fillStyle = p.color;
      if (p.type === 'leaf') { ctx.fillRect(x, y, 2, 1); ctx.fillRect(x + (Math.sin(p.life * 6) > 0 ? 1 : 0), y + 1, 1, 1); }
      else if (p.type === 'smoke') { const s = Math.round(p.size * (1 + (1 - a) * 2)); ctx.fillRect(x - (s >> 1), y - (s >> 1), s, s); }
      else ctx.fillRect(x, y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}

// ---------- Fonte de pixels 3x5 ----------
const GLYPHS = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111',
  6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111', '+': '000010111010000', '-': '000000111000000',
  '!': '010010010000010', '?': '111001011000010', 'x': '000101010101000', ' ': '000000000000000', '/': '001001010100100', ':': '000010000010000',
};
export function drawPixelText(ctx, str, x, y, color, alpha = 1, scale = 1) {
  ctx.globalAlpha = alpha;
  const w = String(str).length * 4 * scale;
  let ox = x - (w >> 1);
  for (const ch of String(str)) {
    const g = GLYPHS[ch];
    if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') {
      const px = ox + (i % 3) * scale, py = y + Math.floor(i / 3) * scale;
      ctx.fillStyle = '#1c1520'; ctx.fillRect(px + scale, py + scale, scale, scale);
      ctx.fillStyle = color; ctx.fillRect(px, py, scale, scale);
    }
    ox += 4 * scale;
  }
  ctx.globalAlpha = 1;
}

// ---------- Clima ----------
export class Weather {
  constructor() {
    this.drops = []; this.flash = 0; this.fogTex = null; this.fogX = 0; this.fogY = 0;
  }
  makeFog() {
    const S = 192, c = makeCanvas(S, S), img = c.ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      // ruído periódico (tileable) por mistura de quatro amostras
      const fx = x / S, fy = y / S;
      const n = fbm(x / 32, y / 32, 3) * (1 - fx) * (1 - fy) + fbm((x - S) / 32, y / 32, 3) * fx * (1 - fy) + fbm(x / 32, (y - S) / 32, 3) * (1 - fx) * fy + fbm((x - S) / 32, (y - S) / 32, 3) * fx * fy;
      const i = (y * S + x) * 4; img.data[i] = 220; img.data[i + 1] = 226; img.data[i + 2] = 232; img.data[i + 3] = clamp((n - 0.35) * 2.2, 0, 1) * 255;
    }
    c.ctx.putImageData(img, 0, 0);
    this.fogTex = c;
  }
  // state: { rain, snow, ash, fog, storm, wind }
  draw(ctx, vw, vh, st, dt, camDX, camDY, intensity, particles, cam) {
    const fx = intensity;
    // chuva
    const rainN = Math.floor(st.rain * 220 * fx);
    while (this.drops.length < rainN) this.drops.push({ x: Math.random() * vw, y: Math.random() * vh, l: 4 + Math.random() * 5, s: 260 + Math.random() * 120 });
    if (this.drops.length > rainN) this.drops.length = rainN;
    if (rainN) {
      ctx.strokeStyle = 'rgba(180,200,230,0.55)'; ctx.lineWidth = 1; ctx.beginPath();
      const wind = (st.wind || 0) * 60 + 20;
      for (const d of this.drops) {
        d.y += d.s * dt; d.x += wind * dt - camDX; d.y -= camDY;
        if (d.y > vh) { d.y = -8; d.x = Math.random() * vw; if (Math.random() < 0.3 && particles) particles.add({ x: cam.x + Math.random() * vw, y: cam.y + Math.random() * vh, life: 0.25, color: '#c8dcf0', vx: 0, vy: 0 }); }
        if (d.x < -10) d.x += vw + 20; if (d.x > vw + 10) d.x -= vw + 20; if (d.y < -10) d.y += vh;
        ctx.moveTo(Math.round(d.x), Math.round(d.y)); ctx.lineTo(Math.round(d.x - wind * 0.03), Math.round(d.y - d.l));
      }
      ctx.stroke();
    }
    // neve e cinzas como partículas no mundo
    if (particles && (st.snow || st.ash)) {
      const n = (st.snow || st.ash) * 4 * fx;
      for (let i = 0; i < n; i++) if (Math.random() < 0.5) particles.add({ x: cam.x + Math.random() * (vw + 60) - 30, y: cam.y - 4 + Math.random() * vh * 0.3, vx: (st.wind || 0.2) * 30, vy: st.ash ? 12 : 22 + Math.random() * 12, life: 4, color: st.ash ? (Math.random() < 0.15 ? '#ff8a3a' : '#8a8480') : '#ffffff', type: 'leaf', seed: Math.random() * 9, size: 1, fadeIn: true });
    }
    // neblina
    if (st.fog > 0.02) {
      if (!this.fogTex) this.makeFog();
      this.fogX = (this.fogX + dt * 6 + camDX * 0.5) % 192; this.fogY = (this.fogY + dt * 2 + camDY * 0.5) % 192;
      ctx.globalAlpha = clamp(st.fog * 0.85 * fx, 0, 0.85);
      for (let y = -192; y < vh + 192; y += 192) for (let x = -192; x < vw + 192; x += 192) ctx.drawImage(this.fogTex, Math.round(x - this.fogX), Math.round(y - this.fogY));
      ctx.globalAlpha = 1;
    }
    // relâmpago
    if (this.flash > 0) { ctx.fillStyle = `rgba(230,235,255,${this.flash * 0.7 * fx})`; ctx.fillRect(0, 0, vw, vh); this.flash -= dt * 3; }
  }
}

// ---------- Iluminação ----------
export class Lighting {
  constructor() { this.canvas = null; }
  ensure(w, h) { if (!this.canvas || this.canvas.width !== w || this.canvas.height !== h) this.canvas = makeCanvas(w, h); }
  // darkness 0..1, tint cor ambiente; lights: [{x,y,r,color,flick}]
  draw(ctx, vw, vh, darkness, tint, lights, cam, quality, time) {
    if (darkness <= 0.02 && !lights.length) return;
    this.ensure(vw, vh);
    const L = this.canvas.ctx;
    L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, vw, vh);
    L.fillStyle = rgba(tint, darkness); L.fillRect(0, 0, vw, vh);
    if (darkness > 0.05) {
      L.globalCompositeOperation = 'destination-out';
      for (const l of lights) {
        const x = l.x - cam.x, y = l.y - cam.y;
        const flick = l.flick ? 1 + Math.sin(time * 13 + l.x) * 0.04 + Math.sin(time * 7.3 + l.y) * 0.04 : 1;
        const r = l.r * flick;
        if (!(r > 0) || !isFinite(x) || !isFinite(y)) continue;
        if (x < -r || y < -r || x > vw + r || y > vh + r) continue;
        if (quality >= 1) {
          const g = L.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          L.fillStyle = g; L.beginPath(); L.arc(x, y, r, 0, Math.PI * 2); L.fill();
        } else { L.fillStyle = 'rgba(0,0,0,0.8)'; L.beginPath(); L.arc(x, y, r * 0.7, 0, Math.PI * 2); L.fill(); }
      }
    }
    ctx.drawImage(this.canvas, 0, 0);
    // brilho aditivo quente
    if (quality >= 2 && darkness > 0.15) {
      ctx.globalCompositeOperation = 'lighter';
      for (const l of lights) {
        if (!l.color) continue;
        const x = l.x - cam.x, y = l.y - cam.y, r = l.r * 0.6;
        if (!(r > 0) || !isFinite(x) || !isFinite(y)) continue;
        if (x < -r || y < -r || x > vw + r || y > vh + r) continue;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba(l.color, 0.22 * darkness)); g.addColorStop(1, rgba(l.color, 0));
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}
