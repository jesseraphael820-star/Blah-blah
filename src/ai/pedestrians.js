// IA de pedestres: caminham pelas calçadas com rotas variadas, atravessam na
// faixa quando o sinal permite, desviam de carros e fogem de perigo.

import { T, DIRS, TT } from '../world/constants.js';
import { Human, moveHuman, updateDownHuman } from '../entities/human.js';
import { rand, TAU, wrapAngle } from '../core/math.js';

export class Pedestrians {
  constructor(game) {
    this.game = game;
  }

  get target() {
    return this.game.lowQuality ? 16 : 28;
  }

  update(dt) {
    const g = this.game;
    let count = 0;
    for (const h of g.humans) if (h.kind === 'ped') count++;
    if (count < this.target) this.trySpawn();
    const cam = g.camera;
    for (const h of g.humans) {
      if (h.kind !== 'ped') continue;
      this.updatePed(h, dt);
      const d2 = (h.x - cam.x) ** 2 + (h.y - cam.y) ** 2;
      if (d2 > 1100 * 1100 && !cam.visible(h.x, h.y, 60)) h.dead = true;
    }
  }

  trySpawn() {
    const g = this.game, c = g.city, cam = g.camera;
    for (let k = 0; k < 8; k++) {
      const ang = rand(0, TAU), d = rand(420, 850);
      const x = cam.x + Math.cos(ang) * d, y = cam.y + Math.sin(ang) * d;
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (!c.pedWalkable(tx, ty)) continue;
      const p = c.center(tx, ty);
      if (cam.visible(p.x, p.y, 30)) continue;
      const h = new Human('ped', p.x + rand(-6, 6), p.y + rand(-6, 6));
      h.ai = { tx, ty, dir: DIRS[(Math.random() * 4) | 0], crossing: false, wait: 0, speed: rand(42, 62), dodge: 0 };
      g.humans.push(h);
      return;
    }
  }

  scare(x, y, radius = 220) {
    for (const h of this.game.humans) {
      if (h.kind !== 'ped' || h.state === 'down') continue;
      if ((h.x - x) ** 2 + (h.y - y) ** 2 < radius * radius) this.flee(h, x, y, rand(3, 6));
    }
  }

  flee(h, fx, fy, t = 4) {
    if (h.state === 'down') return;
    h.state = 'flee';
    h.fleeT = t;
    h.fx = fx; h.fy = fy;
  }

  updatePed(h, dt) {
    const g = this.game, city = g.city;
    if (h.punchT > 0) h.punchT -= dt;
    if (h.state === 'down') {
      updateDownHuman(h, dt, city);
      h.moving = 0;
      h.down -= dt;
      if (h.down <= 0) {
        if (h.ko) { h.fade -= dt * 0.5; if (h.fade <= 0) h.dead = true; }
        else { h.state = 'walk'; this.flee(h, g.player.x, g.player.y, 5); }
      }
      return;
    }
    // desviar de carros vindo rápido
    for (const v of g.vehicles) {
      if (v.speed < 140) continue;
      const rx = h.x - v.x, ry = h.y - v.y;
      if (rx * rx + ry * ry > 90 * 90) continue;
      const ux = v.vx / v.speed, uy = v.vy / v.speed;
      const along = rx * ux + ry * uy, lat = -rx * uy + ry * ux;
      if (along > 0 && Math.abs(lat) < 26 && Math.random() < 0.5) {
        // pula para o lado oposto à trajetória do carro
        const s = Math.sign(lat || 1);
        h.state = 'flee'; h.fleeT = 0.8;
        h.fx = h.x + uy * s * 50; h.fy = h.y - ux * s * 50;
      }
    }
    if (h.state === 'flee') {
      let dx = h.x - h.fx, dy = h.y - h.fy;
      const l = Math.hypot(dx, dy) || 1;
      dx /= l; dy /= l;
      // contorna paredes testando ângulos
      let ang = Math.atan2(dy, dx);
      for (const off of [0, 0.6, -0.6, 1.2, -1.2, 2]) {
        const a = ang + off;
        if (!city.solidW(h.x + Math.cos(a) * 18, h.y + Math.sin(a) * 18)) { ang = a; break; }
      }
      const sp = 125;
      moveHuman(h, Math.cos(ang) * sp * dt, Math.sin(ang) * sp * dt, city);
      h.a = ang;
      h.moving = 2;
      h.phase += dt * 14;
      h.fleeT -= dt;
      if (h.fleeT <= 0) {
        h.state = 'walk';
        const tx = Math.floor(h.x / T), ty = Math.floor(h.y / T);
        const near = city.nearest(h.x, h.y, (x, y) => city.pedWalkable(x, y), 4);
        if (near) { h.ai.tx = near.tx; h.ai.ty = near.ty; } else { h.ai.tx = tx; h.ai.ty = ty; }
        h.ai.crossing = false;
      }
      return;
    }
    // caminhada por tiles
    const ai = h.ai;
    const cx = (ai.tx + 0.5) * T + ((h.id * 7) % 11) - 5, cy = (ai.ty + 0.5) * T + ((h.id * 13) % 11) - 5;
    const dx = cx - h.x, dy = cy - h.y;
    const d = Math.hypot(dx, dy);
    if (ai.wait > 0) {
      ai.wait -= dt;
      h.moving = 0;
      const next = this.canCross(ai.pending, city);
      if (next || ai.wait <= 0) {
        ai.wait = 0;
        if (next) { ai.crossing = true; ai.dir = ai.pending.d; ai.tx = ai.pending.x; ai.ty = ai.pending.y; }
      }
      return;
    }
    if (d < 3) {
      this.chooseNext(h, city);
    } else {
      const sp = ai.speed;
      moveHuman(h, (dx / d) * sp * dt, (dy / d) * sp * dt, city);
      const ta = Math.atan2(dy, dx);
      h.a += wrapAngle(ta - h.a) * Math.min(1, dt * 10);
      h.moving = 1;
      h.phase += dt * sp * 0.16;
      if (Math.abs(dx) + Math.abs(dy) > 70) this.chooseNext(h, city, true);
    }
  }

  canCross(p, city) {
    if (!p) return false;
    const i = city.idx(p.x, p.y);
    const axis = city.crossAxis[i] === 2 ? 'v' : 'h';
    if (city.lightState(city.cross[i], axis) !== 'r') return false;
    // não entra na faixa se houver um carro parado sobre ela
    return !this.game.vehicleNear((p.x + 0.5) * T, (p.y + 0.5) * T, 6);
  }

  chooseNext(h, city, reset = false) {
    const ai = h.ai;
    if (reset) {
      const n = city.nearest(h.x, h.y, (x, y) => city.pedWalkable(x, y), 3);
      if (n) { ai.tx = n.tx; ai.ty = n.ty; }
      return;
    }
    if (ai.crossing) {
      const nx = ai.tx + ai.dir.dx, ny = ai.ty + ai.dir.dy;
      if (city.t(nx, ny) === TT.ROAD || city.pedWalkable(nx, ny)) {
        ai.tx = nx; ai.ty = ny;
        if (city.pedWalkable(nx, ny)) ai.crossing = false;
        return;
      }
      ai.crossing = false;
    }
    const opts = [];
    for (const d of DIRS) {
      const nx = ai.tx + d.dx, ny = ai.ty + d.dy;
      if (city.pedWalkable(nx, ny)) opts.push({ d, x: nx, y: ny, w: d === ai.dir ? 6 : d.b === ai.dir.opp ? 0.15 : 1.5 });
      else if (city.inb(nx, ny) && city.cross[city.idx(nx, ny)] >= 0) {
        const axis = city.crossAxis[city.idx(nx, ny)];
        // só atravessa perpendicular à rua
        if ((axis === 2 && d.axis === 'h') || (axis === 1 && d.axis === 'v')) opts.push({ d, x: nx, y: ny, w: 1.2, cross: true });
      }
    }
    if (!opts.length) return;
    let tot = 0;
    for (const o of opts) tot += o.w;
    let r = Math.random() * tot, pickO = opts[0];
    for (const o of opts) { r -= o.w; if (r <= 0) { pickO = o; break; } }
    if (pickO.cross) {
      if (this.canCross(pickO, city)) { ai.crossing = true; ai.dir = pickO.d; ai.tx = pickO.x; ai.ty = pickO.y; }
      else { ai.pending = pickO; ai.wait = rand(4, 9); h.a = pickO.d.a; }
      return;
    }
    ai.dir = pickO.d; ai.tx = pickO.x; ai.ty = pickO.y;
  }
}
