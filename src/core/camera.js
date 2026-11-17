// Câmera com antecipação de movimento, zoom dinâmico pela velocidade e tremor.

import { lerp, clamp, rand } from './math.js';

export class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.zoom = 1; // pixels CSS por pixel de mundo
    this.viewW = 800; this.viewH = 600; // área visível em pixels de mundo
    this.shakeT = 0; this.shakeA = 0;
    this.sx = 0; this.sy = 0;
  }

  snap(x, y) {
    this.x = x; this.y = y;
  }

  shake(amount, t = 0.3) {
    this.shakeA = Math.max(this.shakeA, amount);
    this.shakeT = Math.max(this.shakeT, t);
  }

  update(dt, tx, ty, vx, vy, speed, cssW, cssH, userZoom) {
    const look = 0.38;
    const gx = tx + vx * look, gy = ty + vy * look;
    const k = 1 - Math.exp(-dt * 4.5);
    this.x = lerp(this.x, gx, k);
    this.y = lerp(this.y, gy, k);
    const diag = Math.hypot(cssW, cssH);
    const base = clamp(diag / 960, 0.75, 2.3) * userZoom;
    const target = base * (1 - 0.32 * clamp(speed / 480, 0, 1));
    this.zoom = lerp(this.zoom, target, 1 - Math.exp(-dt * 1.6));
    this.viewW = cssW / this.zoom;
    this.viewH = cssH / this.zoom;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      this.sx = rand(-1, 1) * this.shakeA;
      this.sy = rand(-1, 1) * this.shakeA;
      if (this.shakeT <= 0) { this.shakeA = 0; this.sx = 0; this.sy = 0; }
    }
  }

  get view() {
    return { x0: this.x - this.viewW / 2, y0: this.y - this.viewH / 2, x1: this.x + this.viewW / 2, y1: this.y + this.viewH / 2 };
  }

  visible(x, y, m = 0) {
    return Math.abs(x - this.x) < this.viewW / 2 + m && Math.abs(y - this.y) < this.viewH / 2 + m;
  }
}
