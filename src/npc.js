import * as THREE from 'three';
import { clamp, angleDiff, pick } from './util.js';
import { CITIES, ROAD_W, cityAt, groundAt } from './world.js';
import { Vehicle, CAR_COLORS } from './vehicle.js';
import { Character, randomLook } from './character.js';
import { LINES } from './i18n.js';

const LANE = 3.3;

// motorista IA: segue a malha de ruas (mão direita) ou um caminho fixo
export class Driver {
  constructor(v, opts = {}) {
    this.v = v;
    this.route = [];
    this.cruise = opts.cruise || 11 + Math.random() * 3;
    this.mode = opts.path ? 'path' : 'grid';
    if (opts.path) this.route = opts.path.map((p) => ({ x: p[0], z: p[1] }));
    this.city = opts.city; this.cur = opts.cur; this.prev = opts.prev;
    this.stuck = 0; this.rev = 0; this.honkT = 0; this.blocked = 0;
    this.waitFor = opts.waitFor || null;
    this.done = false;
  }

  extend() {
    const c = this.city;
    const [i, j] = this.cur;
    const nb = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a <= c.n && b <= c.n);
    let opts = nb.filter(([a, b]) => !this.prev || a !== this.prev[0] || b !== this.prev[1]);
    if (!opts.length) opts = nb;
    const nx = pick(opts);
    this.route.push(laneTarget(c, this.cur, nx));
    this.prev = this.cur; this.cur = nx;
  }

  controls(dt, game) {
    const v = this.v;
    if (this.mode === 'grid') while (this.route.length < 2) this.extend();
    if (!this.route.length) { this.done = true; return { throttle: 0, brake: 1, steer: 0, handbrake: true }; }
    const tg = this.route[0];
    const dx = tg.x - v.pos.x, dz = tg.z - v.pos.z;
    const dist = Math.hypot(dx, dz);
    const last = this.mode === 'path' && this.route.length === 1;
    if (dist < (last ? 3.5 : 8)) { this.route.shift(); if (!this.route.length && this.mode === 'path') this.done = true; }
    const want = Math.atan2(dx, dz);
    const vx = v.fwdSpeed;
    let diff = angleDiff(v.heading, want);
    let desired = this.cruise * (1 - Math.min(Math.abs(diff), 1.2) * 0.55);
    if (last) desired = Math.min(desired, dist * 0.6);
    // obstáculos à frente
    const sh = Math.sin(v.heading), ch = Math.cos(v.heading);
    let ahead = 99;
    const test = (x, z, w) => {
      const rx = x - v.pos.x, rz = z - v.pos.z;
      const f = rx * sh + rz * ch, l = Math.abs(rx * ch - rz * sh);
      if (f > 0 && f < 22 && l < w) ahead = Math.min(ahead, f);
    };
    for (const o of game.vehicles) if (o !== v && Math.abs(o.pos.x - v.pos.x) < 24 && Math.abs(o.pos.z - v.pos.z) < 24) test(o.pos.x, o.pos.z, 2.4);
    if (!game.player.vehicle) test(game.player.pos.x, game.player.pos.z, 1.8);
    for (const p of game.peds.list) if (p.state !== 'down' && Math.abs(p.pos.x - v.pos.x) < 22 && Math.abs(p.pos.z - v.pos.z) < 22) test(p.pos.x, p.pos.z, 1.8);
    const front = v.t.length / 2 + 3;
    if (ahead < 99) desired = Math.min(desired, Math.max(0, (ahead - front) * 0.7));
    if (this.waitFor) {
      const d = this.waitFor();
      if (d > 0) desired = Math.min(desired, d);
    }
    let throttle = clamp((desired - vx) * 0.35, 0, 1);
    let brake = clamp((vx - desired) * 0.5, 0, 1);
    if (desired < 0.3 && vx < 0.6) brake = 0.4;
    // buzina se o jogador fica parado na frente
    if (ahead < front + 2 && vx < 1) {
      this.blocked += dt;
      if (this.blocked > 2.5 && (this.honkT -= dt) <= 0) { this.honkT = 2 + Math.random() * 3; game.audio.beep(v.pos.distanceTo(game.camera.position)); }
    } else this.blocked = 0;
    // desencalhar
    if (throttle > 0.4 && Math.abs(vx) < 0.4 && ahead > front + 2) this.stuck += dt; else this.stuck = Math.max(0, this.stuck - dt);
    if (this.stuck > 2.5) { this.rev = 1.6; this.stuck = 0; }
    if (this.rev > 0) { this.rev -= dt; return { throttle: 0, brake: 1, steer: -clamp(diff * 2, -1, 1), handbrake: false }; }
    return { throttle, brake, steer: clamp(diff * 2.2, -1, 1), handbrake: false };
  }
}

export function nodePos(c, i, j) { return { x: c.xs[i], z: c.zs[j] }; }
export function laneTarget(c, a, b) {
  const A = nodePos(c, ...a), B = nodePos(c, ...b);
  let dx = B.x - A.x, dz = B.z - A.z;
  const L = Math.hypot(dx, dz); dx /= L; dz /= L;
  return { x: B.x - dz * LANE - dx * 5, z: B.z + dx * LANE - dz * 5 };
}
// ponto da faixa da direita a uma fração t do segmento a->b
export function lanePoint(c, a, b, t) {
  const A = nodePos(c, ...a), B = nodePos(c, ...b);
  let dx = B.x - A.x, dz = B.z - A.z;
  const L = Math.hypot(dx, dz); dx /= L; dz /= L;
  return { x: A.x + (B.x - A.x) * t - dz * LANE, z: A.z + (B.z - A.z) * t + dx * LANE, h: Math.atan2(dx, dz) };
}

// ---------------------------------------------------------------- trânsito
const TRAFFIC_TYPES = [['sedan', 45], ['taxi', 14], ['pickup', 18], ['sport', 8], ['moto', 9]];
function weighted(list) {
  let t = list.reduce((a, b) => a + b[1], 0), r = Math.random() * t;
  for (const [n, w] of list) { r -= w; if (r <= 0) return n; }
  return list[0][0];
}

export class Traffic {
  constructor(game) { this.g = game; this.cars = []; this.timer = 0; }

  target(c) { return !c ? 0 : c.kind === 'metro' ? 18 : c.kind === 'town' ? 8 : 4; }

  spawnCar(type, c, nearX, nearZ) {
    for (let tries = 0; tries < 12; tries++) {
      const i = Math.floor(Math.random() * (c.n + 1)), j = Math.floor(Math.random() * (c.n + 1));
      const nb = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a <= c.n && b <= c.n);
      const nx = pick(nb);
      const p = lanePoint(c, [i, j], nx, 0.3 + Math.random() * 0.4);
      const d = Math.hypot(p.x - nearX, p.z - nearZ);
      if (d < 70 || d > 300) continue;
      if (this.g.vehicles.some((o) => Math.abs(o.pos.x - p.x) < 9 && Math.abs(o.pos.z - p.z) < 9)) continue;
      const v = new Vehicle(type, type === 'taxi' ? 0xf2c014 : pick(CAR_COLORS), p.x, p.z, p.h);
      v.driver = 'ai';
      v.sleeping = false;
      v.ai = new Driver(v, { city: c, cur: nx, prev: [i, j] });
      v.ai.route.push(laneTarget(c, [i, j], nx));
      const ch = new Character(randomLook());
      ch.animate(0, 0, v.t.twoWheel ? 'moto' : 'drive');
      v.setRider(ch);
      v.traffic = true;
      this.g.addVehicle(v);
      this.cars.push(v);
      return v;
    }
    return null;
  }

  update(dt) {
    const g = this.g, P = g.focus;
    this.timer -= dt;
    for (let k = this.cars.length - 1; k >= 0; k--) {
      const v = this.cars[k];
      const d = Math.hypot(v.pos.x - P.x, v.pos.z - P.z);
      if (v.driver === 'player' || !v.traffic) { this.cars.splice(k, 1); continue; }
      if (d > 380 || (v.health <= 0 && d > 60)) { g.removeVehicle(v); this.cars.splice(k, 1); }
    }
    if (this.timer > 0) return;
    this.timer = 0.4;
    const c = cityAt(P.x, P.z, 220);
    const target = Math.round(this.target(c) * (g.settings.get('quality') === 'low' ? 0.6 : 1));
    if (c && this.cars.length < target) this.spawnCar(weighted(TRAFFIC_TYPES), c, P.x, P.z);
  }
}

// ---------------------------------------------------------------- pedestres
export class Peds {
  constructor(game) { this.g = game; this.list = []; this.timer = 0; this.talkT = 0; }

  loopRect(c, i, j) {
    const m = ROAD_W / 2 + 1.5;
    return [
      [c.xs[i] + m, c.zs[j] + m], [c.xs[i + 1] - m, c.zs[j] + m],
      [c.xs[i + 1] - m, c.zs[j + 1] - m], [c.xs[i] + m, c.zs[j + 1] - m],
    ];
  }

  spawn(c, P) {
    for (let tries = 0; tries < 10; tries++) {
      const i = Math.floor(Math.random() * c.n), j = Math.floor(Math.random() * c.n);
      const rect = this.loopRect(c, i, j);
      const k = Math.floor(Math.random() * 4);
      const a = rect[k], b = rect[(k + 1) % 4], t = Math.random();
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      const d = Math.hypot(x - P.x, z - P.z);
      if (d < 35 || d > 150) continue;
      const look = randomLook();
      const ch = new Character(look);
      const p = {
        ch, look, c, i, j, corner: (k + 1) % 4, dir: Math.random() < 0.5 ? 1 : -1,
        pos: new THREE.Vector3(x, groundAt(x, z), z), heading: 0, speed: 1.2 + Math.random() * 0.5,
        state: 'walk', t: 0, vel: new THREE.Vector3(), female: look.long, cross: null, said: 0,
      };
      if (p.dir < 0) p.corner = k;
      this.g.scene.add(ch.root);
      this.list.push(p);
      if (Math.random() < 0.3) {
        // dupla parada conversando
        const look2 = randomLook();
        const ch2 = new Character(look2);
        const ox = (b[1] - a[1]) === 0 ? 0 : 1.1, oz = ox ? 0 : 1.1;
        const q = { ...p, ch: ch2, look: look2, female: look2.long, pos: new THREE.Vector3(x + ox, p.pos.y, z + oz), vel: new THREE.Vector3(), said: 0 };
        this.g.scene.add(ch2.root);
        this.list.push(q);
        const conv = { a: p, b: q, line: Math.floor(Math.random() * LINES.chat.length), step: 0, t: 0 };
        for (const m of [p, q]) { m.state = 'chat'; m.t = 25 + Math.random() * 30; m.conv = conv; }
        p.heading = Math.atan2(ox, oz); q.heading = p.heading + Math.PI;
      }
      return p;
    }
  }

  // pedestre solto num ponto (ex.: motorista arrancado do carro)
  spawnAt(x, z, ch, flee) {
    const c = cityAt(x, z, 40) || CITIES[0];
    const p = {
      ch, look: {}, c, i: 0, j: 0, corner: 0, dir: 1, pos: new THREE.Vector3(x, groundAt(x, z), z), heading: 0, speed: 1.4,
      state: 'walk', t: 0, vel: new THREE.Vector3(), female: false, cross: null, said: 0,
    };
    ch.root.position.set(0, 0, 0); ch.root.rotation.set(0, 0, 0);
    this.g.scene.add(ch.root);
    this.list.push(p);
    if (flee) { p.state = 'flee'; p.t = 6; p.from = flee; } else this.rejoin(p);
    return p;
  }

  remove(p) {
    this.g.scene.remove(p.ch.root);
    this.list.splice(this.list.indexOf(p), 1);
  }

  say(p, kind) {
    if (p.said > 0) return;
    p.said = 4;
    const g = this.g;
    if (p.pos.distanceTo(g.camera.position) > 35) return;
    g.voice.say(p.female ? 'pedF' : 'pedM', pick(LINES[kind]), { ambient: true, char: p.ch, seed: Math.floor(Math.random() * 3), pitch: (p.female ? 1.25 : 0.95) + Math.random() * 0.2, vol: 0.8 });
  }

  knock(p, vx, vz, strong) {
    if (p.state === 'down') return;
    p.state = 'down';
    p.t = 3 + Math.random() * 2;
    p.vel.set(vx, strong ? 3 : 0, vz);
    this.say(p, 'hit');
    this.g.addWanted(strong ? 0.6 : 0.25);
  }

  // soco: dois primeiros cambaleiam, o gancho (ou o 3º golpe) derruba
  punched(p, fx, fz, type) {
    if (p.state === 'down') return;
    p.hits = (p.hits || 0) + 1;
    if (type === 2 || p.hits >= 3) { this.knock(p, fx * (type === 2 ? 4 : 2.5), fz * (type === 2 ? 4 : 2.5), type === 2); p.hits = 0; return; }
    p.ch.hitT = 0.4;
    p.pos.x += fx * 0.45; p.pos.z += fz * 0.45;
    p.heading = Math.atan2(-fx, -fz);
    p.state = 'flee'; p.t = 4; p.from = { x: p.pos.x - fx * 3, z: p.pos.z - fz * 3 };
    this.say(p, 'hit');
    this.g.addWanted(0.15);
  }

  scare(x, z, r = 25) {
    for (const p of this.list) if (p.state !== 'down' && Math.hypot(p.pos.x - x, p.pos.z - z) < r) { p.state = 'flee'; p.t = 5 + Math.random() * 3; p.from = { x, z }; }
  }

  update(dt) {
    const g = this.g, P = g.focus;
    this.timer -= dt;
    const c = cityAt(P.x, P.z, 120);
    const target = !c ? 0 : (c.kind === 'metro' ? 34 : c.kind === 'town' ? 16 : 8) * (g.settings.get('quality') === 'low' ? 0.5 : 1);
    if (this.timer <= 0) {
      this.timer = 0.25;
      if (c && this.list.length < target) this.spawn(c, P);
    }
    const plr = g.player;
    for (let n = this.list.length - 1; n >= 0; n--) {
      const p = this.list[n];
      const dP = Math.hypot(p.pos.x - P.x, p.pos.z - P.z);
      if (dP > 190 && !p.keep) { this.remove(p); continue; }
      p.said -= dt;
      let speed = 0, mode = 'ground';
      if (p.state === 'down') {
        p.t -= dt;
        p.vel.x *= Math.exp(-dt * 3); p.vel.z *= Math.exp(-dt * 3);
        p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;
        mode = 'down';
        if (p.t <= 0) { p.state = 'flee'; p.t = 6; p.from = { x: plr.pos.x, z: plr.pos.z }; }
      } else if (p.state === 'flee') {
        p.t -= dt;
        const dx = p.pos.x - p.from.x, dz = p.pos.z - p.from.z;
        p.heading = Math.atan2(dx, dz) + Math.sin(p.t * 1.3) * 0.3;
        speed = 5.2;
        if (p.t <= 0) this.rejoin(p);
      } else if (p.state === 'chat') {
        p.t -= dt;
        mode = 'ground';
        const cv = p.conv;
        if (cv.a === p) {
          cv.t -= dt;
          const talker = cv.step % 2 === 0 ? cv.a : cv.b;
          talker.ch.talk = Math.max(talker.ch.talk, 0.3);
          if (cv.t <= 0) {
            cv.t = 3.5 + Math.random() * 2;
            const pair = LINES.chat[cv.line];
            if (Math.hypot(p.pos.x - plr.pos.x, p.pos.z - plr.pos.z) < 14 && cv.step < 2) {
              const who = pair[cv.step] ? (cv.step % 2 === 0 ? cv.a : cv.b) : null;
              if (who) g.voice.say(who.female ? 'pedF' : 'pedM', pair[cv.step], { ambient: true, char: who.ch, seed: who === cv.a ? 1 : 2, pitch: (who.female ? 1.25 : 0.9) + (who === cv.a ? 0 : 0.15), vol: 0.8 });
              cv.step++;
              if (cv.step >= 2) { cv.step = 0; cv.line = (cv.line + 1) % LINES.chat.length; cv.t = 10; }
            }
          }
        }
        if (p.t <= 0) { p.state = 'walk'; p.conv = null; }
        if (p.ch.talk <= 0) mode = 'chat';
      } else if (p.state === 'walk' || p.state === 'cross') {
        const tg = p.cross || this.loopRect(p.c, p.i, p.j)[p.corner];
        const dx = tg[0] - p.pos.x, dz = tg[1] - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.8) {
          if (p.cross) { p.cross = null; p.state = 'walk'; }
          else if (Math.random() < 0.3) this.startCross(p);
          else p.corner = (p.corner + p.dir + 4) % 4;
        }
        const want = Math.atan2(dx, dz);
        p.heading += clamp(angleDiff(p.heading, want), -dt * 5, dt * 5);
        speed = p.speed;
        if (p.state === 'cross') speed *= 1.25;
        // espera carro passar antes de atravessar
        if (p.state === 'cross') for (const v of g.vehicles) if (v.speed > 3 && v.contains(p.pos.x + Math.sin(p.heading) * 3, p.pos.z + Math.cos(p.heading) * 3, 4)) speed = 0;
      }
      if (p.state !== 'down') {
        p.pos.x += Math.sin(p.heading) * speed * dt;
        p.pos.z += Math.cos(p.heading) * speed * dt;
      }
      g.world.col.resolveCircle(p.pos, 0.35, p.pos.y);
      // carros
      for (const v of g.vehicles) {
        if (!v.contains(p.pos.x, p.pos.z, 0.4)) continue;
        const sp = v.speed;
        if (sp > 3.5 && p.state !== 'down') {
          this.knock(p, v.vel.x * 0.7, v.vel.z * 0.7, sp > 9);
          v.vel.multiplyScalar(0.94);
          g.audio.crash(sp * 0.4);
          if (v.driver === 'player') g.input.rumble(0.5, 0.4, 150);
        } else {
          const dx = p.pos.x - v.pos.x, dz = p.pos.z - v.pos.z, d = Math.hypot(dx, dz) || 1;
          p.pos.x += (dx / d) * 0.08; p.pos.z += (dz / d) * 0.08;
        }
      }
      // reações ao jogador
      if (plr.vehicle && plr.vehicle.speed > 14 && p.state === 'walk') {
        const d = Math.hypot(p.pos.x - plr.vehicle.pos.x, p.pos.z - plr.vehicle.pos.z);
        if (d < 7) { this.say(p, 'miss'); p.state = 'flee'; p.t = 3; p.from = { x: plr.vehicle.pos.x, z: plr.vehicle.pos.z }; }
      } else if (!plr.vehicle && p.state === 'walk') {
        const d = Math.hypot(p.pos.x - plr.pos.x, p.pos.z - plr.pos.z);
        if (d < 0.75) { this.say(p, 'bump'); const k = (0.75 - d) / 0.75; p.pos.x += (p.pos.x - plr.pos.x) * k; p.pos.z += (p.pos.z - plr.pos.z) * k; }
        else if (d < 3 && plr.speed < 0.2 && (this.talkT -= dt) < 0 && Math.random() < 0.01) { this.talkT = 12; this.say(p, g.env.p.rain > 0.3 ? 'idleRain' : 'idle'); }
      }
      p.pos.y = groundAt(p.pos.x, p.pos.z);
      p.ch.root.position.copy(p.pos);
      p.ch.root.rotation.y = p.heading;
      if (dP < 90) p.ch.animate(dt, speed, mode);
      p.ch.root.visible = dP < 160;
    }
  }

  startCross(p) {
    const c = p.c;
    const dirs = [[[0, -1], [-1, 0]], [[1, 0], [0, -1]], [[0, 1], [1, 0]], [[-1, 0], [0, 1]]][p.corner];
    const [di, dj] = pick(dirs);
    const ni = p.i + di, nj = p.j + dj;
    if (ni < 0 || nj < 0 || ni >= c.n || nj >= c.n) { p.corner = (p.corner + p.dir + 4) % 4; return; }
    const rect = this.loopRect(c, ni, nj);
    let best = 0, bd = 1e9;
    rect.forEach((q, k) => { const d = Math.hypot(q[0] - p.pos.x, q[1] - p.pos.z); if (d < bd) { bd = d; best = k; } });
    p.i = ni; p.j = nj; p.corner = best; p.cross = rect[best]; p.state = 'cross';
  }

  rejoin(p) {
    const c = cityAt(p.pos.x, p.pos.z, -1) || p.c;
    p.c = c;
    p.i = clamp(Math.floor((p.pos.x - c.x0) / c.block), 0, c.n - 1);
    p.j = clamp(Math.floor((p.pos.z - c.z0) / c.block), 0, c.n - 1);
    const rect = this.loopRect(c, p.i, p.j);
    let best = 0, bd = 1e9;
    rect.forEach((q, k) => { const d = Math.hypot(q[0] - p.pos.x, q[1] - p.pos.z); if (d < bd) { bd = d; best = k; } });
    p.corner = best; p.state = 'walk'; p.cross = null;
  }
}

export { CITIES };
