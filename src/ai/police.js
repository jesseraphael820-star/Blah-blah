// Sistema de procurado (5 estrelas) e IA policial: detecção de infrações,
// perseguição com campo de fluxo, busca pela última posição conhecida,
// bloqueios, policiais a pé e desistência quando o jogador some.

import { T, DIR_BY_BIT } from '../world/constants.js';
import { Vehicle } from '../entities/vehicle.js';
import { Human, COP_LOOK, moveHuman, updateDownHuman } from '../entities/human.js';
import { FlowField } from '../world/flowfield.js';
import { laneDrive, makeLaneAI, reacquireLane, steerTo, speedControl } from './traffic.js';
import { clamp, rand, TAU, dist } from '../core/math.js';

export const WANTED_POINTS = [0, 1, 6, 14, 26, 42];
const SEVERITY = { punch: 1, hitPed: 2, carjack: 2, steal: 1, hitCop: 7, ramCop: 3, stealCop: 9, speeding: 1, explosion: 4, mission: 0 };
const CIVIL_WITNESS = { punch: 0.5, hitPed: 0.7, carjack: 0.6, explosion: 1 };
const CRIME_NAMES = { punch: 'Agressão', hitPed: 'Atropelamento', carjack: 'Roubo de veículo', steal: 'Furto de veículo', hitCop: 'Agressão a policial', ramCop: 'Colisão com viatura', stealCop: 'Roubo de viatura', speeding: 'Excesso de velocidade', explosion: 'Explosão' };

export class Police {
  constructor(game) {
    this.game = game;
    this.points = 0;
    this.level = 0;
    this.unseen = 0;
    this.seen = false;
    this.lastSeen = { x: 0, y: 0 };
    this.losTimer = 0;
    this.fieldTimer = 0;
    this.spawnTimer = 0;
    this.roadblockT = 15;
    this.speedCd = 0;
    this.bustT = 0;
    this.drive = new FlowField(game.city, 'drive');
    this.walk = new FlowField(game.city, 'walk');
  }

  get evadeTime() {
    return (9 + this.level * 4) * (this.game.character?.wantedMul ?? 1);
  }

  levelFromPoints(p) {
    let l = 0;
    for (let i = 1; i <= 5; i++) if (p >= WANTED_POINTS[i]) l = i;
    return l;
  }

  setLevel(n) {
    n = clamp(n, 0, 5);
    const prev = this.level;
    this.level = n;
    this.points = WANTED_POINTS[n];
    this.unseen = 0;
    const p = this.game.playerPos();
    this.lastSeen = { x: p.x, y: p.y };
    if (n > prev) { this.game.audio.play('wanted'); this.game.hud.flashStars(); }
    if (n > this.game.stats.maxWanted) this.game.stats.maxWanted = n;
    if (n === 0) this.calmDown();
  }

  clear() {
    this.setLevel(0);
    this.bustT = 0;
  }

  // Verifica se alguma unidade policial enxerga o ponto
  policeSees(x, y, range = 400) {
    const g = this.game;
    for (const v of g.vehicles) {
      if (!v.isPolice || v.wrecked || v.driver !== 'ai') continue;
      if ((v.x - x) ** 2 + (v.y - y) ** 2 < range * range && g.los(v.x, v.y, x, y)) return true;
    }
    for (const h of g.humans) {
      if (h.kind !== 'cop' || h.state === 'down') continue;
      if ((h.x - x) ** 2 + (h.y - y) ** 2 < range * range && g.los(h.x, h.y, x, y)) return true;
    }
    return false;
  }

  crime(kind, x, y) {
    const sev = SEVERITY[kind] ?? 1;
    if (!sev) return;
    let add = 0;
    if (this.level > 0 || this.policeSees(x, y, 420)) add = sev;
    else if (Math.random() < (CIVIL_WITNESS[kind] ?? 0)) add = Math.max(1, sev * 0.5);
    if (!add) return;
    const before = this.level;
    this.points += add;
    const nl = Math.max(this.level, this.levelFromPoints(this.points));
    if (nl > before) {
      this.level = nl;
      this.game.audio.play('wanted');
      this.game.hud.flashStars();
      this.game.hud.toast(`🚨 ${CRIME_NAMES[kind] || 'Infração'}`, 'warn');
      if (nl > this.game.stats.maxWanted) this.game.stats.maxWanted = nl;
    }
    this.unseen = 0;
    const p = this.game.playerPos();
    this.lastSeen = { x: p.x, y: p.y };
  }

  calmDown() {
    const g = this.game;
    for (const v of g.vehicles) {
      if (!v.isPolice || v.driver !== 'ai' || !v.ai) continue;
      if (v.ai.mode !== 'patrol') {
        v.siren = false;
        const lane = makeLaneAI(g.city, v.x, v.y);
        if (lane) { Object.assign(v.ai, lane, { type: 'police', mode: 'leave' }); }
        else v.ai.mode = 'leave';
      }
    }
    for (const h of g.humans) if (h.kind === 'cop' && h.ai) h.ai.mode = 'return';
  }

  update(dt) {
    const g = this.game;
    const p = g.playerPos();
    if (this.speedCd > 0) this.speedCd -= dt;

    // visão
    this.losTimer -= dt;
    if (this.losTimer <= 0) {
      this.losTimer = 0.2;
      const range = 380 + this.level * 45;
      this.seen = this.level > 0 && this.policeSees(p.x, p.y, range);
      // infração: excesso de velocidade perto de viatura
      const pv = g.player.vehicle;
      if (this.level === 0 && pv && pv.speed > 300 && this.speedCd <= 0 && this.policeSees(p.x, p.y, 260)) {
        this.speedCd = 6;
        this.crime('speeding', p.x, p.y);
      }
    }
    if (this.level > 0) {
      if (this.seen) {
        this.unseen = 0;
        this.lastSeen.x = p.x; this.lastSeen.y = p.y;
      } else {
        this.unseen += dt;
        if (this.unseen > this.evadeTime) {
          this.level--;
          this.points = WANTED_POINTS[this.level];
          this.unseen = 0;
          if (this.level === 0) {
            this.calmDown();
            g.hud.toast('Você despistou a polícia!', 'ok');
          }
        }
      }
    }

    // campos de fluxo
    this.fieldTimer -= dt;
    if (this.level > 0 && this.fieldTimer <= 0) {
      this.fieldTimer = 0.35;
      const tgt = this.seen ? p : this.lastSeen;
      const tx = Math.floor(tgt.x / T), ty = Math.floor(tgt.y / T);
      this.drive.compute(tx, ty, 700);
      this.walk.compute(tx, ty, 260);
    }

    this.manageUnits(dt);

    // atualizar viaturas
    for (const v of g.vehicles) {
      if (!v.isPolice || v.driver !== 'ai' || !v.ai || v.wrecked) continue;
      this.driveUnit(v, dt);
    }
    // policiais a pé
    let contact = false;
    for (const h of g.humans) {
      if (h.kind !== 'cop') continue;
      if (this.updateCop(h, dt)) contact = true;
    }
    if (contact && this.level > 0) {
      this.bustT += dt;
      if (this.bustT > 1.1) { this.bustT = 0; g.busted(); }
    } else this.bustT = Math.max(0, this.bustT - dt * 0.5);

    // som da sirene proporcional à proximidade
    let near = Infinity;
    for (const v of g.vehicles) if (v.siren && !v.wrecked) near = Math.min(near, dist(v.x, v.y, p.x, p.y));
    g.audio.updateSiren(near < 700 ? 1 - near / 700 : 0);
  }

  manageUnits(dt) {
    const g = this.game, cam = g.camera;
    let cars = 0, patrols = 0;
    for (const v of g.vehicles) {
      if (!v.isPolice || v.driver !== 'ai' || v.wrecked) continue;
      if (v.ai.mode === 'patrol') patrols++; else cars++;
    }
    // patrulhas convertem para perseguição
    if (this.level > 0) {
      for (const v of g.vehicles) {
        if (v.isPolice && v.driver === 'ai' && v.ai && (v.ai.mode === 'patrol' || v.ai.mode === 'leave') && !v.wrecked) {
          const d = dist(v.x, v.y, this.lastSeen.x, this.lastSeen.y);
          if (d < 1100) { v.ai.mode = 'chase'; v.siren = true; cars++; }
        }
      }
    }
    const want = [0, 1, 2, 3, 4, 6][this.level];
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.level >= 3 ? 1.5 : 3;
      if (this.level > 0 && cars < want) this.spawnCar('chase');
      else if (this.level === 0 && patrols < 2) this.spawnCar('patrol');
    }
    // bloqueios em nível alto
    if (this.level >= 4) {
      this.roadblockT -= dt;
      if (this.roadblockT <= 0) { this.roadblockT = 22; this.roadblock(); }
    }
    // remover unidades distantes
    for (const v of g.vehicles) {
      if (!v.isPolice || v.driver !== 'ai') continue;
      const d = dist(v.x, v.y, cam.x, cam.y);
      if (d > 1500 && !cam.visible(v.x, v.y, 80)) v.remove = true;
      if (this.level === 0 && v.ai?.mode === 'leave' && d > 750 && !cam.visible(v.x, v.y, 60)) v.remove = true;
      if (this.level === 0 && v.ai?.mode === 'patrol' && patrols > 2 && d > 800 && !cam.visible(v.x, v.y, 60)) { v.remove = true; patrols--; }
    }
  }

  spawnCar(mode) {
    const g = this.game, c = g.city, cam = g.camera;
    const center = mode === 'chase' ? this.lastSeen : cam;
    for (let k = 0; k < 8; k++) {
      const ang = rand(0, TAU), d = rand(600, 950);
      const lane = c.nearestRoadLane(center.x + Math.cos(ang) * d, center.y + Math.sin(ang) * d, 4);
      if (!lane || cam.visible(lane.x, lane.y, 100) || g.vehicleNear(lane.x, lane.y, 80)) continue;
      const dir = DIR_BY_BIT[c.dirs[c.idx(lane.tx, lane.ty)]];
      const model = this.level >= 4 && Math.random() < 0.45 ? 'tatica' : 'patrulha';
      const v = new Vehicle(model, lane.x, lane.y, dir.a);
      v.driver = 'ai';
      const lai = makeLaneAI(c, lane.x, lane.y);
      v.ai = { ...lai, type: 'police', mode, officers: model === 'tatica' ? 3 : 2, deployCd: 0 };
      v.siren = mode === 'chase';
      g.addVehicle(v);
      return v;
    }
    return null;
  }

  roadblock() {
    const g = this.game, c = g.city, cam = g.camera;
    const p = g.playerPos();
    const pv = g.player.vehicle;
    let dx = 0, dy = 0;
    if (pv && pv.speed > 50) { dx = pv.vx / pv.speed; dy = pv.vy / pv.speed; } else return;
    const lane = c.nearestRoadLane(p.x + dx * 620, p.y + dy * 620, 4);
    if (!lane || cam.visible(lane.x, lane.y, 30)) return;
    const d = DIR_BY_BIT[c.dirs[c.idx(lane.tx, lane.ty)]];
    const perp = d.a + Math.PI / 2;
    for (const s of [-1, 1]) {
      const x = lane.x + Math.cos(d.a + Math.PI / 2) * 24 * s + (s > 0 ? 0 : 0);
      const y = lane.y + Math.sin(d.a + Math.PI / 2) * 24 * s;
      if (g.vehicleNear(x, y, 30)) continue;
      const v = new Vehicle('patrulha', x, y, perp + (s > 0 ? 0 : Math.PI));
      v.driver = 'ai';
      v.ai = { ...makeLaneAI(c, x, y), type: 'police', mode: 'block', officers: 2, deployCd: 0 };
      v.siren = true;
      g.addVehicle(v);
    }
  }

  driveUnit(v, dt) {
    const g = this.game, ai = v.ai;
    const p = g.playerPos();
    if (ai.deployCd > 0) ai.deployCd -= dt;
    if (ai.mode === 'patrol' || ai.mode === 'leave' || ai.mode === 'search') {
      if (ai.mode === 'search') {
        ai.cruise = 190;
        ai.searchT = (ai.searchT || 0) + dt;
        if (this.level === 0) ai.mode = 'leave';
        if (this.seen && this.level > 0) ai.mode = 'chase';
      }
      laneDrive(v, ai, g, dt);
      return;
    }
    if (this.level === 0) { this.calmDown(); return; }
    const dP = dist(v.x, v.y, p.x, p.y);
    if (ai.mode === 'block') {
      v.throttle = 0; v.brake = 0; v.handbrake = true;
      if (dP < 160 || this.unseen > 6) ai.mode = 'chase';
      this.maybeDeploy(v, dP);
      return;
    }
    // perseguição
    const onFoot = !g.player.vehicle;
    const pv = g.player.vehicle;
    let aimX, aimY;
    const direct = dP < 230 && g.los(v.x, v.y, p.x, p.y);
    if (direct) {
      aimX = p.x + (pv ? pv.vx * 0.35 : 0);
      aimY = p.y + (pv ? pv.vy * 0.35 : 0);
    } else {
      const a = this.drive.aim(v.x, v.y, 4);
      if (a) { aimX = a.x; aimY = a.y; } else { aimX = this.lastSeen.x; aimY = this.lastSeen.y; }
      // chegou à última posição e não vê o jogador → procura pelas ruas
      if (!this.seen && dist(v.x, v.y, this.lastSeen.x, this.lastSeen.y) < 120) {
        ai.mode = 'search';
        ai.searchT = 0;
        reacquireLane(v, ai, g.city);
        return;
      }
    }
    if (ai.rev > 0) {
      ai.rev -= dt;
      v.throttle = 0; v.brake = 1; v.handbrake = false;
      steerTo(v, aimX, aimY);
      v.steer = -v.steer;
      return;
    }
    const diff = steerTo(v, aimX, aimY, 2.8);
    let desired = v.m.maxSpeed * (0.7 + this.level * 0.06);
    if (Math.abs(diff) > 0.8) desired *= 0.45;
    if (onFoot && dP < 110) desired = 0;
    if (pv && pv.speed < 40 && dP < 70) desired = 0;
    speedControl(v, desired);
    if (v.throttle > 0.3 && v.speed < 10) {
      ai.stuck += dt;
      if (ai.stuck > 1.2) { ai.rev = 0.8 + Math.random() * 0.5; ai.stuck = 0; }
    } else ai.stuck = Math.max(0, ai.stuck - dt);
    this.maybeDeploy(v, dP);
  }

  maybeDeploy(v, dP) {
    const g = this.game, ai = v.ai;
    const pv = g.player.vehicle;
    const shouldExit = (!pv && dP < 170) || (pv && pv.speed < 45 && dP < 150);
    if (!shouldExit || ai.officers <= 0 || ai.deployCd > 0 || v.speed > 60) return;
    let onFoot = 0;
    for (const h of g.humans) if (h.kind === 'cop') onFoot++;
    if (onFoot >= 7) return;
    ai.deployCd = 0.6;
    ai.officers--;
    const dp = v.doorPoint(ai.officers % 2 ? 1 : -1);
    const spot = g.city.solidW(dp.x, dp.y) ? { x: v.x, y: v.y } : dp;
    const h = new Human('cop', spot.x, spot.y, { ...COP_LOOK });
    h.health = 60;
    h.ai = { car: v, mode: 'chase', hitCd: 0, speed: 128 + this.level * 8 + rand(-6, 6) };
    g.humans.push(h);
  }

  // retorna true se o policial está em contato para prender
  updateCop(h, dt) {
    const g = this.game, city = g.city;
    if (h.state === 'down') {
      updateDownHuman(h, dt, city);
      h.down -= dt;
      h.moving = 0;
      if (h.down <= 0) { if (h.ko) { h.fade -= dt * 0.5; if (h.fade <= 0) h.dead = true; } else h.state = 'walk'; }
      return false;
    }
    const ai = h.ai;
    if (ai.hitCd > 0) ai.hitCd -= dt;
    if (h.punchT > 0) h.punchT -= dt;
    const p = g.player;
    const pp = g.playerPos();
    if (this.level === 0) ai.mode = 'return';
    let tx, ty, contact = false;
    if (ai.mode === 'return') {
      const car = ai.car;
      if (car && !car.remove && !car.wrecked) { tx = car.x; ty = car.y; }
      else {
        if (!g.camera.visible(h.x, h.y, 40)) h.dead = true;
        tx = h.x + Math.cos(h.a) * 50; ty = h.y + Math.sin(h.a) * 50;
      }
      if (car && dist(h.x, h.y, car.x, car.y) < car.m.l / 2 + 14) {
        car.ai.officers++;
        h.dead = true;
        return false;
      }
      if (this.level > 0 && dist(h.x, h.y, pp.x, pp.y) < 300) ai.mode = 'chase';
    } else {
      tx = pp.x; ty = pp.y;
      const d = dist(h.x, h.y, pp.x, pp.y);
      const pv = p.vehicle;
      if (pv && d > 320) ai.mode = 'return';
      if (!pv) {
        if (d < 17) {
          contact = true;
          if (this.level >= 2 && ai.hitCd <= 0) {
            ai.hitCd = 1.1;
            h.punchT = 0.3;
            g.damagePlayer(this.level >= 4 ? 9 : 6);
            g.audio.play('punch');
          }
        }
      } else {
        const door = pv.doorPoint(-1);
        tx = door.x; ty = door.y;
        if (dist(h.x, h.y, door.x, door.y) < 16 && pv.speed < 25) contact = true;
      }
      if (!pv || d < 160) {
        // caminho direto se houver visão, senão segue o campo de fluxo a pé
        if (!g.los(h.x, h.y, tx, ty)) {
          const a = this.walk.aim(h.x, h.y, 2);
          if (a) { tx = a.x; ty = a.y; }
        }
      }
    }
    const dx = tx - h.x, dy = ty - h.y;
    const d = Math.hypot(dx, dy);
    if (d > 6) {
      const sp = ai.mode === 'return' ? 90 : ai.speed;
      moveHuman(h, (dx / d) * sp * dt, (dy / d) * sp * dt, city);
      h.a = Math.atan2(dy, dx);
      h.moving = 2;
      h.phase += dt * 15;
    } else h.moving = 0;
    return contact;
  }
}
