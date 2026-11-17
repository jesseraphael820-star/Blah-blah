// Partículas (fumaça, faíscas, fogo, destroços) e marcas de pneu.

import { rand } from '../core/math.js';

export class Particles {
  constructor() {
    this.list = [];
    this.skids = [];
    this.max = 400;
  }

  add(p) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push(p);
  }

  smoke(x, y, dark = false, size = 6) {
    this.add({ t: 'smoke', x, y, vx: rand(-10, 10), vy: rand(-18, -6), life: rand(1.2, 2), max: 2, s: size, c: dark ? 30 : 140 });
  }

  sparks(x, y, n = 8, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.28), sp = rand(60, 220) * power;
      this.add({ t: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.2, 0.5), max: 0.5 });
    }
  }

  fire(x, y) {
    this.add({ t: 'fire', x: x + rand(-6, 6), y: y + rand(-6, 6), vx: rand(-8, 8), vy: rand(-25, -8), life: rand(0.4, 0.8), max: 0.8, s: rand(5, 9) });
  }

  explosion(x, y) {
    for (let i = 0; i < 26; i++) {
      const a = rand(0, 6.28), sp = rand(40, 260);
      this.add({ t: 'fire', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.4, 1), max: 1, s: rand(8, 16) });
    }
    for (let i = 0; i < 14; i++) this.add({ t: 'smoke', x: x + rand(-20, 20), y: y + rand(-20, 20), vx: rand(-30, 30), vy: rand(-30, 30), life: rand(1.5, 3), max: 3, s: rand(10, 18), c: 25 });
    this.sparks(x, y, 20, 1.6);
    this.add({ t: 'flash', x, y, life: 0.25, max: 0.25, s: 110 });
  }

  text(x, y, str, color = '#7cf29a') {
    this.add({ t: 'text', x, y, vx: 0, vy: -30, life: 1.4, max: 1.4, str, color });
  }

  skid(x1, y1, x2, y2) {
    if (this.skids.length > 600) this.skids.splice(0, 50);
    this.skids.push({ x1, y1, x2, y2, a: 0.5 });
  }

  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { L.splice(i, 1); continue; }
      if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; }
      if (p.t === 'spark') { p.vx *= 0.9; p.vy *= 0.9; }
      if (p.t === 'smoke') p.s += dt * 10;
    }
    for (const s of this.skids) s.a -= dt * 0.012;
    while (this.skids.length && this.skids[0].a <= 0) this.skids.shift();
  }

  drawSkids(g, view) {
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (const s of this.skids) {
      if (s.x1 < view.x0 - 10 || s.x1 > view.x1 + 10 || s.y1 < view.y0 - 10 || s.y1 > view.y1 + 10) continue;
      g.strokeStyle = `rgba(15,15,15,${s.a})`;
      g.beginPath(); g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2); g.stroke();
    }
  }

  draw(g) {
    for (const p of this.list) {
      const k = p.life / p.max;
      switch (p.t) {
        case 'smoke':
          g.fillStyle = `rgba(${p.c},${p.c},${p.c},${0.45 * k})`;
          g.beginPath(); g.arc(p.x, p.y, p.s, 0, 7); g.fill();
          break;
        case 'spark':
          g.fillStyle = `rgba(255,${200 * k + 40 | 0},80,${k})`;
          g.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4);
          break;
        case 'fire':
          g.fillStyle = `rgba(255,${120 + 120 * k | 0},30,${0.85 * k})`;
          g.beginPath(); g.arc(p.x, p.y, p.s * (0.5 + k * 0.5), 0, 7); g.fill();
          break;
        case 'flash':
          g.fillStyle = `rgba(255,230,160,${0.6 * k})`;
          g.beginPath(); g.arc(p.x, p.y, p.s, 0, 7); g.fill();
          break;
        case 'text':
          g.globalAlpha = Math.min(1, k * 2);
          g.font = 'bold 14px sans-serif'; g.textAlign = 'center';
          g.fillStyle = '#000'; g.fillText(p.str, p.x + 1, p.y + 1);
          g.fillStyle = p.color; g.fillText(p.str, p.x, p.y);
          g.globalAlpha = 1;
          break;
      }
    }
  }
}
