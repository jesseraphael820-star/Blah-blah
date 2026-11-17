// Motor de missões: marcadores, início, etapas, cronômetro, falhas, recompensas.

import { buildMissions, CATEGORIES, STORY_ORDER } from './mission-data.js';
import { Vehicle } from '../entities/vehicle.js';
import { Human, randomLook, moveHuman } from '../entities/human.js';
import { makeLaneAI } from '../ai/traffic.js';
import { dist, rand } from '../core/math.js';
import { KMH } from '../entities/vehicle-models.js';

export class Missions {
  constructor(game) {
    this.game = game;
    this.defs = buildMissions(game.city);
    this.byId = Object.fromEntries(this.defs.map((d) => [d.id, d]));
    for (const d of this.defs) {
      if (d.timeAuto) d.time = Math.round(this.autoTime(d) / 5) * 5;
    }
    this.active = null;
    this.completed = new Set();
    this.giverCd = 0;
  }

  autoTime(d) {
    const g = this.game;
    let len = 0, prev = d.giver;
    for (const s of d.steps) {
      const pts = s.pts || (s.at ? [s.at] : []);
      for (const p of pts) { len += Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y); prev = p; }
    }
    void g;
    return len / d.timeAuto.speed + d.timeAuto.extra;
  }

  isUnlocked(d) {
    if (d.unlock && !this.completed.has(d.unlock)) return false;
    if (d.cat === 'story' || d.story) {
      // história: apenas a próxima missão não concluída
      const next = STORY_ORDER.find((id) => !this.completed.has(id));
      return d.id === next;
    }
    return true;
  }

  available() {
    return this.defs.filter((d) => this.isUnlocked(d));
  }

  nextStory() {
    const id = STORY_ORDER.find((x) => !this.completed.has(x));
    return id ? this.byId[id] : null;
  }

  category(d) {
    return CATEGORIES[d.cat];
  }

  // ---------- ciclo ----------
  update(dt) {
    const g = this.game;
    if (!this.active) {
      if (this.giverCd > 0) { this.giverCd -= dt; return; }
      const p = g.playerPos();
      for (const d of this.available()) {
        if (dist(p.x, p.y, d.giver.x, d.giver.y) < (g.player.vehicle ? 44 : 30)) {
          const rep = this.completed.has(d.id) ? ' (repetir)' : '';
          g.setPrompt(`Missão: ${d.name}${rep}`, () => g.ui.showBriefing(d));
          break;
        }
      }
      return;
    }
    this.updateActive(dt);
  }

  start(d) {
    const g = this.game;
    this.cleanup();
    this.active = {
      def: d, i: 0, t: d.time || 0, timed: !!d.time, mv: null, mvBase: 0, spawned: null,
      target: null, passenger: null, onBoard: false, idx: 0, got: new Set(), escapeT: 0, startedAt: g.time.total, boardT: 0,
    };
    g.audio.play('start');
    g.hud.missionBanner(d.name, CATEGORIES[d.cat].name);
    this.enterStep();
  }

  get step() {
    const a = this.active;
    return a ? a.def.steps[a.i] : null;
  }

  enterStep() {
    const a = this.active, s = this.step, g = this.game;
    if (!s) return;
    a.idx = 0; a.got = new Set();
    if (s.t === 'enter' && s.spawn && !s.use) {
      if (!a.spawned || a.spawned.remove || a.spawned.wrecked) {
        const sp = s.spawn;
        // afasta veículos que estejam no ponto
        for (const v of g.vehicles) if (v !== g.player.vehicle && dist(v.x, v.y, sp.at.x, sp.at.y) < 50 && !v.mission) v.remove = true;
        const v = new Vehicle(sp.model, sp.at.x, sp.at.y, sp.at.a || 0, sp.color || null);
        v.mission = true; v.persistent = true; v.parked = true;
        g.addVehicle(v);
        a.spawned = v;
      }
    }
    if (s.t === 'pickup') {
      const h = new Human('npc', s.at.x, s.at.y, randomLook());
      h.state = 'wait';
      h.name = s.name;
      g.humans.push(h);
      a.passenger = h;
      a.onBoard = false;
    }
    if (s.t === 'chase') {
      const v = new Vehicle(s.model, s.at.x, s.at.y, s.at.a, '#2a5f8f');
      v.driver = 'ai';
      v.driverLook = randomLook();
      v.mission = true; v.persistent = true;
      v.ai = makeLaneAI(g.city, v.x, v.y, 'flee');
      v.ai.cruise = v.m.maxSpeed * 0.8;
      const self = this;
      v.ai.scoreFn = (d, tx, ty) => {
        const p = self.game.playerPos();
        const ex = (tx + 0.5) * 32 - p.x, ey = (ty + 0.5) * 32 - p.y;
        const l = Math.hypot(ex, ey) || 1;
        return (d.dx * ex + d.dy * ey) / l;
      };
      g.addVehicle(v);
      a.target = v;
      a.escapeT = 0;
    }
    if (s.t === 'wanted') {
      g.police.setLevel(Math.max(g.police.level, s.level));
      g.hud.toast(s.text, 'warn');
      this.next();
    }
  }

  next() {
    const a = this.active;
    a.i++;
    if (a.i >= a.def.steps.length) { this.complete(); return; }
    this.game.audio.play('checkpoint');
    this.enterStep();
  }

  objective() {
    const a = this.active, s = this.step, g = this.game;
    if (!a || !s) return '';
    const pv = g.player.vehicle;
    if (s.t === 'goto' || s.t === 'dropoff') {
      if (s.mv && a.mv && pv !== a.mv) return 'Volte para o veículo da missão';
      if (s.t === 'dropoff' && a.mv && pv !== a.mv) return 'Volte para o veículo com o passageiro';
      if (s.mode === 'vehicle' && !pv) return 'Entre em um veículo';
      if (s.mode === 'foot' && pv) return 'Saia do veículo';
    }
    if (s.t === 'pickup' && !pv) return 'Entre em um veículo para buscar o passageiro';
    if (s.t === 'race') return `${s.text} (${a.idx + 1}/${s.pts.length})`;
    if (s.t === 'collect') {
      if (s.mode === 'foot' && pv) return 'Saia do veículo — este trabalho é a pé';
      return `${s.text} (${a.got.size}/${s.pts.length})`;
    }
    if (s.t === 'speed' && pv) return `${s.text} — atual: ${pv.kmh} km/h`;
    if (s.t === 'chase' && a.target) return `${s.text} (${Math.round((a.target.hp / a.target.maxHp) * 100)}%)`;
    return s.text;
  }

  // marcadores ativos {x, y, r, color, label, kind}
  markers() {
    const g = this.game, out = [];
    if (!this.active) {
      for (const d of this.available()) {
        const cat = CATEGORIES[d.cat];
        out.push({ x: d.giver.x, y: d.giver.y, r: 22, color: cat.color, icon: cat.icon, kind: 'giver', dim: this.completed.has(d.id), def: d });
      }
      return out;
    }
    const a = this.active, s = this.step, col = '#ffd23a';
    if (!s) return out;
    const pv = g.player.vehicle;
    if ((s.mv || s.t === 'dropoff') && a.mv && pv !== a.mv && !a.mv.wrecked) {
      out.push({ x: a.mv.x, y: a.mv.y, r: 0, color: '#4fc8f0', kind: 'vehicle' });
      return out;
    }
    switch (s.t) {
      case 'enter': {
        const v = s.use === 'target' ? a.target : a.spawned;
        if (v && !v.remove && pv !== v) out.push({ x: v.x, y: v.y, r: 0, color: '#4fc8f0', kind: 'vehicle' });
        break;
      }
      case 'goto': case 'dropoff':
        out.push({ x: s.at.x, y: s.at.y, r: s.r || 46, color: col, kind: 'target' });
        break;
      case 'pickup':
        if (a.passenger && !a.onBoard) out.push({ x: a.passenger.x, y: a.passenger.y, r: 34, color: '#ffe04a', kind: 'target' });
        break;
      case 'race':
        if (s.pts[a.idx]) out.push({ x: s.pts[a.idx].x, y: s.pts[a.idx].y, r: 64, color: '#ff7a2f', kind: 'target' });
        if (s.pts[a.idx + 1]) out.push({ x: s.pts[a.idx + 1].x, y: s.pts[a.idx + 1].y, r: 64, color: 'rgba(255,122,47,.35)', kind: 'next' });
        break;
      case 'collect':
        s.pts.forEach((p, k) => { if (!a.got.has(k)) out.push({ x: p.x, y: p.y, r: s.r || 50, color: '#4fc8f0', kind: 'target' }); });
        break;
      case 'chase':
        if (a.target) out.push({ x: a.target.x, y: a.target.y, r: 0, color: '#ff4f5e', kind: 'enemy' });
        break;
    }
    return out;
  }

  updateActive(dt) {
    const a = this.active, s = this.step, g = this.game;
    if (!s) return;
    const p = g.playerPos();
    const pv = g.player.vehicle;
    const def = a.def;

    // --- condições de falha globais ---
    if (a.timed) {
      a.t -= dt;
      if (a.t <= 0) return this.fail('O tempo acabou!');
    }
    const needsMv = a.mv && def.steps.slice(a.i).some((x) => x.mv || x.t === 'dropoff');
    if (needsMv && (a.mv.wrecked || a.mv.remove)) return this.fail('O veículo da missão foi destruído!');
    if (def.maxDamage && a.mv && (a.mvBase - a.mv.hp) / a.mv.maxHp > def.maxDamage) return this.fail('Danos excessivos ao veículo!');
    if (def.noWanted && g.police.level > 0) return this.fail('Você chamou a atenção da polícia!');
    if (needsMv && dist(p.x, p.y, a.mv.x, a.mv.y) > 2200) return this.fail('Você abandonou o veículo da missão.');
    if (a.passenger && a.passenger.state === 'down') return this.fail('O passageiro se feriu!');
    if (s.t === 'enter' && s.spawn && a.spawned && a.spawned.wrecked) return this.fail('O veículo foi destruído!');

    switch (s.t) {
      case 'enter': {
        if (!pv) break;
        let ok = false;
        if (s.use === 'target') ok = pv === a.target;
        else if (s.anyVehicle) ok = !s.model || pv.model === s.model;
        else if (a.spawned) ok = pv === a.spawned || (s.model && pv.model === s.model);
        else ok = !s.model || pv.model === s.model;
        if (ok) {
          a.mv = pv; a.mvBase = pv.hp; pv.mission = true; pv.persistent = true;
          if (s.alarm) { g.audio.play('alarm'); g.police.setLevel(Math.max(g.police.level, s.alarm)); g.hud.toast('O alarme disparou!', 'warn'); }
          this.next();
        }
        break;
      }
      case 'goto': {
        const r = s.r || 46;
        if (dist(p.x, p.y, s.at.x, s.at.y) > r) break;
        if (s.mode === 'vehicle' && !pv) break;
        if (s.mode === 'foot' && pv) break;
        if (s.mv && pv !== a.mv) break;
        if (s.stop && pv && pv.speed > 70) { g.hud.hint('Pare o veículo!'); break; }
        this.next();
        break;
      }
      case 'pickup': {
        const h = a.passenger;
        if (!h) break;
        if (!pv) { h.state = 'wait'; h.moving = 0; break; }
        const d = dist(h.x, h.y, pv.x, pv.y);
        if (d < 110 && pv.speed < 40) {
          h.state = 'board';
          const door = pv.doorPoint(1);
          const dx = door.x - h.x, dy = door.y - h.y;
          const dd = Math.hypot(dx, dy);
          if (dd < 14 || (a.boardT += dt) > 5) {
            const same = a.mv === pv;
            h.dead = true; a.onBoard = true; a.mv = pv;
            if (!same || !a.mvBase) a.mvBase = pv.hp;
            pv.mission = true; pv.persistent = true;
            pv.passengers++; a.passenger = null; a.boardT = 0;
            g.audio.play('door');
            this.next();
          } else {
            moveHuman(h, (dx / dd) * 90 * dt, (dy / dd) * 90 * dt, g.city);
            h.a = Math.atan2(dy, dx); h.moving = 1; h.phase += dt * 12;
          }
        } else {
          h.state = 'wait'; h.moving = 0;
          h.a = Math.atan2(p.y - h.y, p.x - h.x);
        }
        break;
      }
      case 'dropoff': {
        if (!pv || pv !== a.mv) break;
        if (dist(p.x, p.y, s.at.x, s.at.y) > (s.r || 52)) break;
        if (pv.speed > 40) { g.hud.hint('Pare para o passageiro descer'); break; }
        pv.passengers = Math.max(0, pv.passengers - 1);
        const door = pv.doorPoint(1);
        const h = new Human('npc', door.x, door.y, randomLook());
        h.state = 'leave'; h.leaveT = 3; h.a = Math.atan2(s.at.y - door.y, s.at.x - door.x);
        g.humans.push(h);
        g.audio.play('money');
        const tip = Math.round(rand(20, 60));
        g.addMoney(tip, 'Gorjeta');
        this.next();
        break;
      }
      case 'race': {
        const pt = s.pts[a.idx];
        if (!pv) break;
        if (dist(p.x, p.y, pt.x, pt.y) < 70) {
          a.idx++;
          if (a.idx >= s.pts.length) this.next();
          else g.audio.play('checkpoint');
        }
        break;
      }
      case 'collect': {
        if (s.mode === 'foot' && pv) break;
        s.pts.forEach((pt, k) => {
          if (!a.got.has(k) && dist(p.x, p.y, pt.x, pt.y) < (s.r || 50)) {
            a.got.add(k);
            g.audio.play('checkpoint');
            g.hud.toast(`📍 ${pt.name}`, 'ok');
          }
        });
        if (a.got.size >= s.pts.length) this.next();
        break;
      }
      case 'lose':
        if (g.police.level === 0) this.next();
        break;
      case 'speed':
        if (pv && pv.speed * KMH >= s.kmh) this.next();
        break;
      case 'chase': {
        const t = a.target;
        if (!t) break;
        if (t.hp / t.maxHp <= s.stopAt || t.wrecked) {
          // o motorista abandona o veículo
          t.driver = null; t.ai = null; t.throttle = 0; t.brake = 0;
          if (!t.wrecked) {
            const d = t.doorPoint(-1);
            const h = new Human('ped', d.x, d.y, t.driverLook || randomLook());
            h.ai = { tx: Math.floor(d.x / 32), ty: Math.floor(d.y / 32), dir: { dx: 1, dy: 0, b: 2, opp: 8, axis: 'h' }, crossing: false, wait: 0, speed: 50 };
            h.state = 'flee'; h.fleeT = 8; h.fx = p.x; h.fy = p.y;
            g.humans.push(h);
          } else return this.fail('O furgão foi destruído!');
          g.hud.toast('O furgão parou!', 'ok');
          this.next();
          break;
        }
        if (dist(p.x, p.y, t.x, t.y) > 1250) {
          a.escapeT += dt;
          if (a.escapeT > 6) return this.fail('O alvo escapou!');
        } else a.escapeT = 0;
        break;
      }
    }
  }

  complete() {
    const g = this.game, a = this.active, d = a.def;
    const repeat = this.completed.has(d.id);
    let reward = Math.round(d.reward * (repeat ? 0.5 : 1) * (g.character?.cashMul || 1));
    const time = g.time.total - a.startedAt;
    this.completed.add(d.id);
    this.active = null;
    this.release(a);
    g.addMoney(reward, null);
    g.stats.missions = this.completed.size;
    g.stats.missionRuns = (g.stats.missionRuns || 0) + 1;
    g.audio.play('mission');
    this.giverCd = 2;
    // missões recém-desbloqueadas
    const unlocked = this.defs.filter((x) => x.unlock === d.id && !(x.cat === 'story' || x.story)).map((x) => x.name);
    const nxt = this.nextStory();
    g.autosave();
    g.ui.showComplete(d, reward, time, unlocked, nxt && !repeat && (d.cat === 'story' || d.story) ? nxt.name : null);
  }

  fail(reason) {
    const g = this.game, a = this.active;
    if (!a) return;
    this.active = null;
    this.release(a);
    g.audio.play('fail');
    this.giverCd = 3;
    g.ui.showFail(a.def, reason);
  }

  // Abortar sem tela (ex.: carregar jogo)
  abort() {
    if (this.active) this.release(this.active);
    this.active = null;
  }

  release(a) {
    if (a.passenger) a.passenger.dead = true;
    for (const v of [a.mv, a.spawned, a.target]) {
      if (!v) continue;
      v.mission = false;
      v.persistent = false;
      v.passengers = 0;
      if (v === a.target && v.ai) { v.ai.type = 'traffic'; v.ai.scoreFn = null; v.ai.cruise = 130; }
    }
  }

  cleanup() {
    this.abort();
  }

  restart(d) {
    this.start(d);
  }
}
