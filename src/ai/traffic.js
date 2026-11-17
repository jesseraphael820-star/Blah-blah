// IA de trânsito: carros seguem as faixas, respeitam semáforos, param para
// pedestres/veículos à frente e desviam de obstáculos parados.

import { T, DIRS, DIR_BY_BIT, TT } from '../world/constants.js';
import { Vehicle } from '../entities/vehicle.js';
import { TRAFFIC_BY_DISTRICT, PARKED_MODELS } from '../entities/vehicle-models.js';
import { randomLook } from '../entities/human.js';
import { clamp, wrapAngle, rand, pick, TAU, hash2 } from '../core/math.js';
import { districtAt } from '../world/constants.js';

export function chooseDir(city, tx, ty, from, ai, scoreFn = null) {
  const i = city.idx(tx, ty);
  const v = city.valid[i];
  let opts = DIRS.filter((d) => v & d.b && d.b !== from.opp);
  if (!opts.length) opts = DIRS.filter((d) => v & d.b);
  if (!opts.length) return from;
  const it = city.inter[i];
  if (it >= 0 && ai.turnedInter === it && opts.includes(from)) return from;
  let choice;
  if (scoreFn) {
    let best = -Infinity;
    for (const d of opts) {
      const s = scoreFn(d, tx, ty) + Math.random() * 0.4;
      if (s > best) { best = s; choice = d; }
    }
  } else {
    let total = 0;
    const w = opts.map((d) => (d === from ? 3 : 1));
    for (const x of w) total += x;
    let r = Math.random() * total;
    choice = opts[opts.length - 1];
    for (let k = 0; k < opts.length; k++) { r -= w[k]; if (r <= 0) { choice = opts[k]; break; } }
  }
  if (it >= 0 && choice !== from) ai.turnedInter = it;
  return choice;
}

export function makeLaneAI(city, x, y, type = 'traffic') {
  const lane = city.nearestRoadLane(x, y, 6);
  if (!lane) return null;
  const dir = DIR_BY_BIT[city.dirs[city.idx(lane.tx, lane.ty)]];
  const ai = {
    type, dir, tx: lane.tx, ty: lane.ty, nextDir: dir, turnedInter: -1,
    cruise: rand(105, 150), blocked: 0, avoid: 0, stuck: 0, rev: 0, panic: 0, lost: 0, honk: 0,
  };
  ai.nextDir = chooseDir(city, ai.tx, ai.ty, dir, ai);
  return ai;
}

export function reacquireLane(v, ai, city) {
  const lane = city.nearestRoadLane(v.x, v.y, 5);
  if (!lane) { ai.lost += 1; return false; }
  ai.dir = DIR_BY_BIT[city.dirs[city.idx(lane.tx, lane.ty)]];
  ai.tx = lane.tx; ai.ty = lane.ty;
  ai.turnedInter = -1;
  ai.nextDir = chooseDir(city, ai.tx, ai.ty, ai.dir, ai, ai.scoreFn);
  ai.lost = 0;
  return true;
}

// Calcula a distância livre à frente do veículo (outros carros, pessoas).
export function obstacleGap(v, game, latOff = 0, look = 120) {
  const fx = Math.cos(v.a), fy = Math.sin(v.a);
  let gap = Infinity;
  for (const o of game.vehicles) {
    if (o === v) continue;
    const rx = o.x - v.x, ry = o.y - v.y;
    const along = rx * fx + ry * fy;
    if (along <= 0 || along > look + o.radius) continue;
    const lat = -rx * fy + ry * fx - latOff;
    if (Math.abs(lat) > v.m.w / 2 + o.m.w / 2 + 4) continue;
    const g = along - v.m.l / 2 - o.radius * 0.75;
    if (g < gap) gap = g;
  }
  for (const h of game.humans) {
    if (h.inVehicle || h.dead) continue;
    const rx = h.x - v.x, ry = h.y - v.y;
    const along = rx * fx + ry * fy;
    if (along <= 0 || along > look) continue;
    const lat = -rx * fy + ry * fx - latOff;
    if (Math.abs(lat) > v.m.w / 2 + 9) continue;
    const g = along - v.m.l / 2 - 8;
    if (g < gap) gap = g;
  }
  const p = game.player;
  if (!p.vehicle && !p.hidden) {
    const rx = p.x - v.x, ry = p.y - v.y;
    const along = rx * fx + ry * fy;
    const lat = -rx * fy + ry * fx - latOff;
    if (along > 0 && along < look && Math.abs(lat) < v.m.w / 2 + 9) gap = Math.min(gap, along - v.m.l / 2 - 8);
  }
  return gap;
}

export function speedControl(v, desired) {
  const sp = v.fwdSpeed;
  v.handbrake = false;
  if (desired < 4 && sp < 25) {
    v.throttle = 0; v.brake = 0; v.handbrake = true;
    return;
  }
  if (sp < desired - 6) { v.throttle = clamp((desired - sp) / 50, 0.35, 1); v.brake = 0; }
  else if (sp > desired + 10) { v.throttle = 0; v.brake = clamp((sp - desired) / 70, 0.25, 1); }
  else { v.throttle = 0.12; v.brake = 0; }
}

export function steerTo(v, ax, ay, gain = 2.4) {
  const diff = wrapAngle(Math.atan2(ay - v.y, ax - v.x) - v.a);
  v.steer = clamp(diff * gain, -1, 1);
  return diff;
}

export function laneDrive(v, ai, game, dt) {
  const city = game.city;
  if (ai.panic > 0) ai.panic -= dt;
  let tcx = (ai.tx + 0.5) * T, tcy = (ai.ty + 0.5) * T;
  let dd = Math.hypot(v.x - tcx, v.y - tcy);
  if (dd > 120) {
    if (!reacquireLane(v, ai, city)) { v.throttle = 0; v.brake = 0; v.handbrake = true; return; }
    tcx = (ai.tx + 0.5) * T; tcy = (ai.ty + 0.5) * T;
    dd = Math.hypot(v.x - tcx, v.y - tcy);
  }
  const proj = (v.x - tcx) * ai.dir.dx + (v.y - tcy) * ai.dir.dy;
  if (proj > -6 && dd < 46) {
    ai.dir = ai.nextDir;
    ai.tx += ai.dir.dx; ai.ty += ai.dir.dy;
    ai.nextDir = chooseDir(city, ai.tx, ai.ty, ai.dir, ai, ai.scoreFn);
    tcx = (ai.tx + 0.5) * T; tcy = (ai.ty + 0.5) * T;
    dd = Math.hypot(v.x - tcx, v.y - tcy);
  }
  const flee = ai.type === 'flee';
  let desired = ai.cruise * (ai.panic > 0 ? 1.6 : 1);
  if (ai.nextDir !== ai.dir) desired = Math.min(desired, (flee ? 140 : 70) + Math.max(0, dd - 18) * 1.3);

  // semáforos
  if (!flee && ai.panic <= 0) {
    const ci = city.idx(Math.floor(v.x / T), Math.floor(v.y / T));
    if (city.cross[ci] < 0 && city.inter[ci] < 0) {
      let x = ai.tx, y = ai.ty;
      for (let n = 0; n < 3; n++) {
        if (!city.inb(x, y)) break;
        const ii = city.idx(x, y);
        if (city.cross[ii] >= 0) {
          const st = city.lightState(city.cross[ii], ai.dir.axis);
          if (st !== 'g') {
            const bx = (x + 0.5) * T - ai.dir.dx * T / 2, by = (y + 0.5) * T - ai.dir.dy * T / 2;
            const dl = (bx - v.x) * ai.dir.dx + (by - v.y) * ai.dir.dy - v.m.l / 2;
            if (dl > -4 && !(st === 'y' && dl < 18)) desired = Math.min(desired, Math.max(0, dl - 2) * 2.4);
          }
          break;
        }
        if (city.inter[ii] >= 0) break;
        x += ai.dir.dx; y += ai.dir.dy;
      }
    }
  }

  // desvio lateral (para a esquerda da faixa)
  const latOff = ai.avoid > 0 ? -24 : 0;
  if (ai.avoid > 0) ai.avoid -= dt;
  const look = 34 + Math.abs(v.fwdSpeed) * 0.7 + v.m.l / 2;
  const gap = obstacleGap(v, game, latOff, look);
  let obstDesired = Infinity;
  if (gap < look) obstDesired = Math.max(0, gap - 6) * 2.6;
  if (flee) obstDesired = Math.max(obstDesired, desired * 0.5);
  if (obstDesired < desired) {
    desired = obstDesired;
    if (desired < 8) {
      ai.blocked += dt;
      if (ai.blocked > 2 && ai.honk <= 0) { ai.honk = rand(2, 4); game.honk(v); }
      if (ai.blocked > (flee ? 0.4 : 4.5)) { ai.avoid = 2.2; ai.blocked = 0; }
    }
  } else ai.blocked = Math.max(0, ai.blocked - dt);
  if (ai.honk > 0) ai.honk -= dt;

  // alvo de mira
  let ax = tcx, ay = tcy;
  if (ai.nextDir === ai.dir) { ax += ai.dir.dx * T * 0.9; ay += ai.dir.dy * T * 0.9; }
  if (latOff) { ax += ai.dir.dy * latOff; ay += -ai.dir.dx * latOff; }
  if (flee) desired = Math.min(desired, v.m.maxSpeed * 0.82);

  // destravar (ré) se ficar preso
  if (ai.rev > 0) {
    ai.rev -= dt;
    v.throttle = 0; v.brake = 1; v.handbrake = false;
    steerTo(v, ax, ay);
    v.steer = -v.steer;
    return;
  }
  steerTo(v, ax, ay);
  speedControl(v, desired);
  if (v.throttle > 0.3 && v.speed < 8) {
    ai.stuck += dt;
    if (ai.stuck > 1.6) { ai.rev = 0.9; ai.stuck = 0; }
  } else ai.stuck = Math.max(0, ai.stuck - dt);
}

// ---------------- gerenciador ----------------

export class Traffic {
  constructor(game) {
    this.game = game;
    this.parkTimer = 0;
  }

  get target() {
    const s = this.game.settings;
    const base = this.game.lowQuality ? 13 : 20;
    return Math.round(base * (s.traffic ?? 1));
  }

  update(dt) {
    const g = this.game;
    let count = 0;
    for (const v of g.vehicles) if (v.ai && v.ai.type === 'traffic' && !v.isPolice) count++;
    if (count < this.target) this.trySpawn();

    for (const v of g.vehicles) {
      if (v.driver === 'ai' && v.ai && (v.ai.type === 'traffic' || v.ai.type === 'flee') && !v.wrecked) laneDrive(v, v.ai, g, dt);
    }

    // remove veículos distantes
    const cam = g.camera;
    for (const v of g.vehicles) {
      if (v.persistent || v.mission || v === g.player.vehicle) continue;
      const d2 = (v.x - cam.x) ** 2 + (v.y - cam.y) ** 2;
      if (d2 > 1400 * 1400 && !cam.visible(v.x, v.y, 100)) v.remove = true;
      else if (v.ai && v.ai.lost > 0 && !cam.visible(v.x, v.y, 60)) v.remove = true;
      else if (v.wrecked && v.burning <= 0 && d2 > 900 * 900 && !cam.visible(v.x, v.y, 60)) v.remove = true;
    }

    this.parkTimer -= dt;
    if (this.parkTimer <= 0) {
      this.parkTimer = 0.5;
      this.updateParking();
    }
  }

  trySpawn() {
    const g = this.game, c = g.city, cam = g.camera;
    for (let k = 0; k < 6; k++) {
      const ang = rand(0, TAU), d = rand(560, 1000);
      const lane = c.nearestRoadLane(cam.x + Math.cos(ang) * d, cam.y + Math.sin(ang) * d, 3);
      if (!lane || cam.visible(lane.x, lane.y, 90) || g.vehicleNear(lane.x, lane.y, 80)) continue;
      const dist = districtAt(lane.tx, lane.ty);
      const model = pick(TRAFFIC_BY_DISTRICT[dist] || TRAFFIC_BY_DISTRICT[0]);
      const dir = DIR_BY_BIT[c.dirs[c.idx(lane.tx, lane.ty)]];
      const v = new Vehicle(model, lane.x, lane.y, dir.a);
      v.driver = 'ai';
      v.driverLook = randomLook();
      v.ai = makeLaneAI(c, lane.x, lane.y);
      if (!v.ai) return;
      v.vx = Math.cos(dir.a) * v.ai.cruise * 0.6;
      v.vy = Math.sin(dir.a) * v.ai.cruise * 0.6;
      g.addVehicle(v);
      return v;
    }
    return null;
  }

  updateParking() {
    const g = this.game, cam = g.camera;
    for (const s of g.city.parkingSpots) {
      const d2 = (s.x - cam.x) ** 2 + (s.y - cam.y) ** 2;
      if (d2 > 1300 * 1300) {
        if (s.car && s.car.parked && !s.car.driver && !s.car.mission && Math.hypot(s.car.x - s.x, s.car.y - s.y) < 12) s.car.remove = true;
        s.car = null;
        s.state = 0;
        continue;
      }
      if (s.state === 0 && d2 < 950 * 950) {
        s.state = 1;
        if (cam.visible(s.x, s.y, 40)) { s.state = 0; continue; }
        if (hash2(Math.floor(s.x), Math.floor(s.y) + Math.floor(g.time.day)) < 0.45 && !g.vehicleNear(s.x, s.y, 30)) {
          const v = new Vehicle(pick(PARKED_MODELS), s.x, s.y, s.a);
          v.parked = true;
          s.car = v;
          g.addVehicle(v);
        }
      }
    }
  }
}

export function isRoadTile(city, x, y) {
  return city.t(Math.floor(x / T), Math.floor(y / T)) === TT.ROAD;
}
