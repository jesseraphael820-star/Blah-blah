// Veículo com física arcade: aceleração, frenagem, derrapagem, colisões e danos.

import { MODELS, KMH } from './vehicle-models.js';
import { getVehicleSprite, SPRITE_PAD } from './vehicle-sprites.js';
import { T, TT } from '../world/constants.js';
import { clamp, pick, rand } from '../core/math.js';

let NEXT_ID = 1;

export class Vehicle {
  constructor(model, x, y, a = 0, color = null) {
    this.id = NEXT_ID++;
    this.model = model;
    this.m = MODELS[model];
    this.x = x; this.y = y; this.a = a;
    this.vx = 0; this.vy = 0;
    this.color = color || pick(this.m.colors);
    this.maxHp = this.m.hp;
    this.hp = this.m.hp;
    this.throttle = 0; this.brake = 0; this.steer = 0; this.handbrake = false;
    this.driver = null; // 'player' | 'ai' | null
    this.ai = null;
    this.parked = false;
    this.wrecked = false;
    this.burning = 0;
    this.dents = [];
    this.siren = false;
    this.sirenT = 0;
    this.skid = 0;
    this.lastImpact = 0;
    this.braking = false;
    this.mission = false;
    this.persistent = false;
    this.passengers = 0;
    this.radius = Math.hypot(this.m.l, this.m.w) / 2;
    this.sprite = getVehicleSprite(model, this.color);
    this.circ = [];
    this.updateCircles();
  }

  get speed() { return Math.hypot(this.vx, this.vy); }
  get kmh() { return Math.round(this.speed * KMH); }
  get fwdSpeed() { return this.vx * Math.cos(this.a) + this.vy * Math.sin(this.a); }
  get damage() { return 1 - this.hp / this.maxHp; }
  get isPolice() { return !!this.m.police; }

  setColor(c) {
    this.color = c;
    this.sprite = getVehicleSprite(this.model, c);
  }

  updateCircles() {
    const r = this.m.w / 2;
    const n = Math.max(2, Math.ceil(this.m.l / this.m.w) + 1);
    const span = this.m.l / 2 - r;
    const ca = Math.cos(this.a), sa = Math.sin(this.a);
    this.circ.length = n;
    for (let i = 0; i < n; i++) {
      const o = -span + (2 * span * i) / (n - 1);
      const c = this.circ[i] || (this.circ[i] = { x: 0, y: 0, r });
      c.x = this.x + ca * o; c.y = this.y + sa * o; c.r = r;
    }
  }

  // Ponto da porta do motorista (lado esquerdo)
  doorPoint(side = -1) {
    const s = Math.sin(this.a), c = Math.cos(this.a);
    const ly = side * (this.m.w / 2 + 10);
    return { x: this.x - ly * s, y: this.y + ly * c };
  }

  damageBy(amount, game) {
    if (this.wrecked || amount <= 0) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      if (!this.burning) this.burning = 4.5;
    }
    if (amount > 4 && this.dents.length < 8) {
      this.dents.push({ x: rand(-0.45, 0.45) * this.m.l, y: rand(-0.4, 0.4) * this.m.w, r: 2 + Math.min(4, amount * 0.15) });
    }
  }

  update(dt, city) {
    const m = this.m;
    const ca = Math.cos(this.a), sa = Math.sin(this.a);
    let vf = this.vx * ca + this.vy * sa;
    let vr = -this.vx * sa + this.vy * ca;
    const tile = city.typeW(this.x, this.y);
    const rough = tile === TT.GRASS || tile === TT.TREE;
    const perf = this.hp < this.maxHp * 0.3 ? 0.75 : 1;
    const maxS = m.maxSpeed * perf * (rough ? 0.55 : 1);
    this.braking = false;

    if (!this.wrecked && this.driver) {
      if (this.throttle > 0) {
        if (vf < -12) { vf += m.brake * dt; this.braking = true; }
        else {
          const f = 1 - Math.max(0, vf / maxS) ** 2;
          vf += m.accel * this.throttle * Math.max(0, f) * dt;
        }
      }
      if (this.brake > 0) {
        if (vf > 12) { vf -= m.brake * this.brake * dt; this.braking = true; }
        else { vf -= m.accel * 0.7 * this.brake * dt; if (vf < -maxS * 0.35) vf = -maxS * 0.35; }
      }
    }
    if ((this.throttle <= 0 && this.brake <= 0) || !this.driver || this.wrecked) {
      const dec = (25 + Math.abs(vf) * 0.35) * dt * (this.wrecked ? 4 : 1);
      vf = Math.abs(vf) <= dec ? 0 : vf - Math.sign(vf) * dec;
    }
    if (rough) vf *= 1 - 0.9 * dt;
    if (vf > maxS * 1.15) vf -= (vf - maxS) * 2 * dt;

    let grip = m.grip;
    if (this.handbrake && this.driver) {
      grip *= 0.18;
      const dec = 260 * dt;
      vf = Math.abs(vf) <= dec ? 0 : vf - Math.sign(vf) * dec;
      this.braking = true;
    }
    vr *= Math.exp(-grip * dt);
    this.skid = Math.abs(vr) > 70 ? Math.min(1, (Math.abs(vr) - 70) / 120) : 0;
    if (this.braking && Math.abs(vf) > 160 && this.brake > 0) this.skid = Math.max(this.skid, 0.5);

    if (!this.wrecked && this.driver) {
      const sf = clamp(vf / 90, -1, 1);
      const hi = 1 - 0.4 * Math.min(1, Math.abs(vf) / m.maxSpeed);
      const turn = m.turn * hi * (this.handbrake ? 1.5 : 1);
      this.a += this.steer * turn * sf * dt;
    }
    this.vx = ca * vf - sa * vr;
    this.vy = sa * vf + ca * vr;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.siren) this.sirenT += dt;
    this.updateCircles();
  }
}

// ---------- colisões ----------

export function collideVehicleWorld(v, city, game) {
  let pushX = 0, pushY = 0, nx = 0, ny = 0, hit = false;
  for (const c of v.circ) {
    const tx0 = Math.floor((c.x - c.r) / T), tx1 = Math.floor((c.x + c.r) / T);
    const ty0 = Math.floor((c.y - c.r) / T), ty1 = Math.floor((c.y + c.r) / T);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!city.solid(tx, ty)) continue;
        const px = clamp(c.x, tx * T, tx * T + T), py = clamp(c.y, ty * T, ty * T + T);
        let dx = c.x - px, dy = c.y - py;
        let d2 = dx * dx + dy * dy;
        if (d2 >= c.r * c.r) continue;
        let d = Math.sqrt(d2), pen;
        if (d < 0.001) {
          // centro dentro do tile: empurra pelo eixo mais curto
          const l = c.x - tx * T, r = tx * T + T - c.x, t = c.y - ty * T, b = ty * T + T - c.y;
          const mn = Math.min(l, r, t, b);
          if (mn === l) { dx = -1; dy = 0; } else if (mn === r) { dx = 1; dy = 0; } else if (mn === t) { dx = 0; dy = -1; } else { dx = 0; dy = 1; }
          pen = mn + c.r; d = 1;
        } else pen = c.r - d;
        const ux = dx / d, uy = dy / d;
        if (Math.abs(ux * pen) > Math.abs(pushX)) pushX = ux * pen;
        if (Math.abs(uy * pen) > Math.abs(pushY)) pushY = uy * pen;
        nx += ux; ny += uy; hit = true;
      }
    }
  }
  if (!hit) return 0;
  v.x += pushX; v.y += pushY;
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl; ny /= nl;
  const vn = v.vx * nx + v.vy * ny;
  let impact = 0;
  if (vn < 0) {
    impact = -vn;
    v.vx -= 1.35 * vn * nx;
    v.vy -= 1.35 * vn * ny;
    v.vx *= 0.88; v.vy *= 0.88;
    // giro ao bater de lado
    const tang = -v.vx * ny + v.vy * nx;
    v.a += clamp(tang * 0.0006 * Math.sign(Math.cos(v.a) * nx + Math.sin(v.a) * ny), -0.08, 0.08);
  }
  v.updateCircles();
  if (impact > 70) {
    v.damageBy((impact - 60) * 0.11, game);
    if (game) game.onImpact(v, null, impact, v.x - nx * v.m.l * 0.4, v.y - ny * v.m.l * 0.4);
  }
  return impact;
}

export function collideVehicles(a, b, game) {
  const R = a.radius + b.radius;
  const dx0 = a.x - b.x, dy0 = a.y - b.y;
  if (dx0 * dx0 + dy0 * dy0 > R * R) return;
  let best = null, bestPen = 0;
  for (const ca of a.circ) {
    for (const cb of b.circ) {
      const dx = ca.x - cb.x, dy = ca.y - cb.y;
      const rr = ca.r + cb.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 0.01;
      const pen = rr - d;
      if (pen > bestPen) { bestPen = pen; best = { nx: dx / d, ny: dy / d, x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 }; }
    }
  }
  if (!best) return;
  const ma = a.m.mass * (a.wrecked ? 1.5 : 1) * (a.parked ? 1.3 : 1), mb = b.m.mass * (b.wrecked ? 1.5 : 1) * (b.parked ? 1.3 : 1);
  const ia = 1 / ma, ib = 1 / mb;
  const { nx, ny } = best;
  const corr = bestPen / (ia + ib);
  a.x += nx * corr * ia; a.y += ny * corr * ia;
  b.x -= nx * corr * ib; b.y -= ny * corr * ib;
  const rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (rv < 0) {
    const j = (-(1 + 0.3) * rv) / (ia + ib);
    a.vx += j * ia * nx; a.vy += j * ia * ny;
    b.vx -= j * ib * nx; b.vy -= j * ib * ny;
    const imp = -rv;
    if (imp > 60) {
      a.damageBy((imp - 50) * 0.09 * (mb / ma) ** 0.5, game);
      b.damageBy((imp - 50) * 0.09 * (ma / mb) ** 0.5, game);
      if (game) game.onImpact(a, b, imp, best.x, best.y);
    }
  }
  a.updateCircles(); b.updateCircles();
}

// Desenho do veículo no mundo
export function drawVehicle(g, v, time, night) {
  const m = v.m;
  g.save();
  g.translate(v.x, v.y);
  g.rotate(v.a);
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.fillRect(-m.l / 2 + 3, -m.w / 2 + 3, m.l, m.w);
  const sp = v.wrecked ? getVehicleSprite(v.model, v.color, true) : v.sprite;
  g.drawImage(sp, -m.l / 2 - SPRITE_PAD, -m.w / 2 - SPRITE_PAD, m.l + SPRITE_PAD * 2, m.w + SPRITE_PAD * 2);
  // amassados
  if (v.dents.length) {
    g.fillStyle = 'rgba(30,30,30,.45)';
    for (const d of v.dents) { g.beginPath(); g.arc(d.x, d.y, d.r, 0, 7); g.fill(); }
  }
  if (!v.wrecked && v.damage > 0.5) {
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 0.6;
    const fx = m.l / 2 - 9;
    g.beginPath(); g.moveTo(fx, -4); g.lineTo(fx + 3, 1); g.lineTo(fx + 1, 5); g.moveTo(fx + 3, 1); g.lineTo(fx + 5, -2); g.stroke();
  }
  // luzes de freio
  if (v.braking && !v.wrecked) {
    g.fillStyle = '#ff2a2a';
    g.fillRect(-m.l / 2 - 1, -m.w / 2 + 2, 2.5, 4); g.fillRect(-m.l / 2 - 1, m.w / 2 - 6, 2.5, 4);
  }
  // sirene
  if (m.police && !v.wrecked) {
    const on = v.siren ? Math.floor(v.sirenT * 6) % 2 : -1;
    g.fillStyle = on === 0 ? '#ff3030' : '#7a1a1a'; g.fillRect(-1, -m.w / 2 + 2, 4, m.w / 2 - 2);
    g.fillStyle = on === 1 ? '#3070ff' : '#1a2a7a'; g.fillRect(-1, 0, 4, m.w / 2 - 2);
  }
  if (night && !v.wrecked && v.driver) {
    g.fillStyle = 'rgba(255,250,210,.9)';
    g.fillRect(m.l / 2 - 1, -m.w / 2 + 2, 2, 3.5); g.fillRect(m.l / 2 - 1, m.w / 2 - 5.5, 2, 3.5);
  }
  g.restore();
}
