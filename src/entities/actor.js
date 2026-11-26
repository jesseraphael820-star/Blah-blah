// Atores humanoides: jogador, NPCs, aliados e inimigos. Combate (combos, esquiva, bloqueio, parry),
// IA (perseguir, flanquear, recuar, telegrafar golpes) e renderização com armas e efeitos.
import { G, hostile } from '../state.js';
import { TILE, clamp, dist, angleDiff, dirFromVec, DIR_VEC } from '../core/util.js';
import { charSheet, FW, FH, ANIMS, animFrames, weaponSprite } from '../gfx/chars.js';
import { emoteSprite } from '../gfx/icons.js';
import { audio } from '../core/audio.js';
import { emit } from '../core/events.js';
import { ITEMS } from '../data/items.js';
import { TILE_INFO } from '../gfx/tiles.js';

let UID = 1;
export class Entity {
  constructor(x, y) { this.id = UID++; this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.w = 10; this.h = 6; this.mapId = G.map ? G.map.id : 'world'; this.removed = false; this.solid = true; }
  get map() { return G.maps[this.mapId]; }
  boxAt(x, y) { return [x - this.w / 2, y - this.h, this.w, this.h]; }
  tryMove(dx, dy) {
    const m = this.map; if (!m) return;
    let moved = false;
    if (dx) { const [bx, by, bw, bh] = this.boxAt(this.x + dx, this.y); if (!m.collides(bx, by, bw, bh) && !this.blockedByWater(this.x + dx, this.y)) { this.x += dx; moved = true; } }
    if (dy) { const [bx, by, bw, bh] = this.boxAt(this.x, this.y + dy); if (!m.collides(bx, by, bw, bh) && !this.blockedByWater(this.x, this.y + dy)) { this.y += dy; moved = true; } }
    return moved;
  }
  blockedByWater() { return false; }
  update() {}
  draw() {}
}

export class Actor extends Entity {
  constructor(x, y, o = {}) {
    super(x, y);
    this.look = o.look || {}; this.sheet = charSheet(this.look);
    this.dir = 0; this.anim = 'idle'; this.animT = 0;
    this.state = 'idle'; this.stateT = 0;
    this.maxHp = o.hp || 40; this.hp = this.maxHp; this.maxStam = o.stam || 100; this.stam = this.maxStam;
    this.speed = o.speed || 55; this.team = o.team || 'N'; this.faction = o.faction || null;
    this.weapon = o.weapon ? Object.assign({}, ITEMS[o.weapon]) : null; this.bow = o.bow ? ITEMS[o.bow] : null; this.shield = o.shield ? ITEMS.s_iron : null;
    this.def = o.def || 0; this.dmgMul = o.dmgMul || 1;
    this.name = o.name || ''; this.npcId = o.npcId || null; this.tag = o.tag || null;
    this.ai = o.ai || 'npc'; this.home = { x, y }; this.boss = !!o.boss;
    this.hitFlash = 0; this.invuln = 0; this.kx = 0; this.ky = 0; this.combo = 0; this.comboQueued = false;
    this.blockStart = -9; this.emote = null; this.emoteT = 0; this.target = null; this.cool = 1 + Math.random(); this.lastHitT = -9;
    this.hpBarT = 0; this.wanderT = 0; this.wanderTo = null; this.path = null; this.stuckT = 0; this.talkTarget = null;
    this.etype = o.etype || null; this.xp = o.xp || 0; this.gold = o.gold || [0, 0]; this.loot = o.loot || [];
    this.dodgeChance = o.dodge || 0; this.teleports = !!o.teleport; this.phases = !!o.phases; this.phase2 = false; this.noKill = !!o.noKill;
    this.wanderR = o.wanderR ?? 0; this.alpha = 1; this.deadT = 0; this.scale = 1; this.sitting = false;
    this.voice = o.voice || null; this.atkAngle = 0;
  }
  setLook(look) { this.look = look; this.sheet = charSheet(look); }
  get busy() { return this.state === 'attack' || this.state === 'roll' || this.state === 'hurt' || this.state === 'stagger' || this.state === 'dead' || this.state === 'windup' || this.state === 'bowdraw'; }
  face(tx, ty) { this.dir = dirFromVec(tx - this.x, ty - this.y); }
  facingAngle() { const [dx, dy] = DIR_VEC[this.dir]; return Math.atan2(dy, dx); }
  showEmote(kind, t = 1.6) { this.emote = kind; this.emoteT = t; }
  blockedByWater(x, y) { const t = this.map.tileAtPx(x, y); return TILE_INFO[t].water && TILE_INFO[t].solid; }

  // ---------- combate ----------
  startAttack(angle) {
    if (this.busy || !this.weapon) return false;
    const cost = this.weapon.stam || 8;
    if (this.team === 'P' && this.stam < cost * 0.5) return false;
    this.state = 'attack'; this.stateT = 0; this.hitDone = false;
    this.atkAngle = angle ?? this.facingAngle();
    this.dir = dirFromVec(Math.cos(this.atkAngle), Math.sin(this.atkAngle));
    this.atkDur = this.weapon.speed * (this.combo === 2 ? 1.35 : 1);
    this.stam = Math.max(0, this.stam - cost);
    this.comboQueued = false;
    audio.sfx(this.combo === 2 || this.weapon.wtype === 'axe' || this.weapon.wtype === 'longsword' ? 'swingHeavy' : 'swing', this);
    // impulso para frente
    const lunge = this.weapon.wtype === 'spear' ? 50 : this.combo === 2 ? 70 : 35;
    this.kx += Math.cos(this.atkAngle) * lunge; this.ky += Math.sin(this.atkAngle) * lunge;
    emit('attackStart', this);
    return true;
  }
  performHit() {
    const w = this.weapon; const reach = w.reach + (this.boss ? 6 : 0);
    const arc = ((w.arc || 100) * Math.PI) / 180;
    const heavy = this.combo === 2;
    let dmg = w.dmg * this.dmgMul * (heavy ? 1.5 : 1);
    let any = false;
    const hx = this.x, hy = this.y - 6;
    for (const e of G.entities) {
      if (e === this || e.mapId !== this.mapId || e.removed || e.dead || !e.takeDamage) continue;
      if (!hostile(this, e) && !(this.team === 'P' && e.huntable)) continue;
      const ex = e.x, ey = e.y - (e.h || 6) / 2 - 2;
      const d = dist(hx, hy, ex, ey);
      if (d > reach + (e.radius || 6)) continue;
      const a = Math.atan2(ey - hy, ex - hx);
      if (d > 8 && Math.abs(angleDiff(this.atkAngle, a)) > arc / 2) continue;
      const crit = this.team === 'P' && Math.random() < 0.08;
      if (e.takeDamage(Math.round(dmg * (crit ? 1.6 : 1)), this, (w.knock || 40) * (heavy ? 1.6 : 1), false, crit)) any = true;
    }
    // bonecos de treino e objetos quebráveis
    if (this.team === 'P' && this.map) for (const o of this.map.objectsIn(hx - 40, hy - 40, hx + 40, hy + 40)) {
      if (!o.dummy) continue;
      const d = dist(hx, hy, o.x, o.y - 8); if (d > reach + 8) continue;
      const a = Math.atan2(o.y - 8 - hy, o.x - hx); if (Math.abs(angleDiff(this.atkAngle, a)) > arc / 2 + 0.3) continue;
      o.shake = 0.3; audio.sfx('hit', o); G.particles.burst(o.x, o.y - 10, 6, '#e8d090', 50, 0.4); emit('dummyHit', o); any = true;
    }
    if (any) { G.cam.shake = Math.max(G.cam.shake, heavy ? 3 : 1.5); if (this.team === 'P') G.hitStop = heavy ? 0.07 : 0.035; }
  }
  takeDamage(amount, src, knock = 40, ranged = false, crit = false) {
    if (this.state === 'dead' || this.invuln > 0) return false;
    const fromA = src ? Math.atan2(src.y - this.y, src.x - this.x) : 0;
    if (this.state === 'roll' && this.stateT < 0.32) { if (this.team === 'P') emit('dodged'); return false; }
    // esquiva automática da IA
    if (this.ai === 'enemy' && this.dodgeChance && !ranged && !this.busy && Math.random() < this.dodgeChance * 0.5) { this.startRoll(fromA + Math.PI + (Math.random() - 0.5) * 1.5); return false; }
    // bloqueio e parry
    if (this.state === 'block' && this.shield && Math.abs(angleDiff(this.facingAngle(), fromA)) < 1.9) {
      const sinceBlock = G.t - this.blockStart;
      if (!ranged && sinceBlock < (this.shield.parry || 0.15) && src && src.stagger) {
        src.stagger(1.1); audio.sfx('parry', this); G.particles.burst((this.x + src.x) / 2, this.y - 10, 12, '#fff8c0', 90, 0.35);
        if (this.team === 'P') { G.stats.parries++; emit('parry'); G.hitStop = 0.12; }
        return false;
      }
      const blocked = amount * (this.shield.block || 0.5);
      amount = Math.max(0, amount - blocked);
      this.stam -= blocked * 1.6;
      audio.sfx('clang', this); G.particles.burst(this.x + Math.cos(fromA) * 6, this.y - 10, 5, '#ffe080', 70, 0.25);
      this.kx -= Math.cos(fromA) * knock * 0.5; this.ky -= Math.sin(fromA) * knock * 0.5;
      if (this.stam <= 0) { this.stam = 0; this.stagger(0.8); }
      if (amount < 1) return true;
    }
    const dmg = Math.max(1, Math.round(amount - this.def * (this.team === 'P' ? 1 : 0.5)));
    this.hp -= dmg; this.hitFlash = 0.14; this.hpBarT = 3; this.lastHitT = G.t;
    if (G.settings.showDamage) G.particles.text(this.x + (Math.random() - 0.5) * 6, this.y - 30, String(dmg), this.team === 'P' ? '#ff6a6a' : crit ? '#ffe040' : '#ffffff');
    G.particles.burst(this.x, this.y - 10, 5 + (crit ? 6 : 0), this.blood || '#a01818', 70, 0.4);
    audio.sfx('hit', this);
    if (src) { this.kx -= Math.cos(fromA) * knock; this.ky -= Math.sin(fromA) * knock; }
    if (src && src !== this && this.ai !== 'player') { if (!this.target || Math.random() < 0.5) this.target = src; if (this.team === 'N') this.flee = src; }
    if (this.noKill && this.hp <= this.maxHp * 0.3) { this.hp = Math.ceil(this.maxHp * 0.3); emit('bossYield', this); return true; }
    if (this.hp <= 0) { this.die(src); return true; }
    if (!this.boss || Math.random() < 0.15) { if (this.state !== 'block') { this.state = 'hurt'; this.stateT = 0; } }
    if (this.team === 'P' && this.ai === 'player') { audio.sfx('hurt'); G.cam.shake = 3; emit('playerHurt', dmg); }
    if (this.phases && !this.phase2 && this.hp < this.maxHp * 0.5) { this.phase2 = true; this.speed *= 1.25; this.dmgMul *= 1.2; this.showEmote('anger', 2); emit('bossPhase', this); }
    return true;
  }
  stagger(t) { if (this.state === 'dead') return; this.state = 'stagger'; this.stateT = 0; this.staggerDur = t; this.showEmote('dots', t); }
  startRoll(angle) {
    if (this.busy && this.state !== 'block') return false;
    if (this.team === 'P' && this.ai === 'player' && this.stam < 18) return false;
    this.state = 'roll'; this.stateT = 0; this.rollA = angle; if (this.ai === 'player') this.stam -= 20;
    this.dir = dirFromVec(Math.cos(angle), Math.sin(angle));
    audio.sfx('roll', this);
    return true;
  }
  die(src) {
    this.state = 'dead'; this.stateT = 0; this.hp = 0; this.dead = true;
    audio.sfx('death', this);
    G.particles.burst(this.x, this.y - 8, 14, this.blood || '#a01818', 80, 0.6);
    emit('death', this, src);
  }

  // ---------- IA ----------
  findTarget(range) {
    let best = null, bd = range;
    for (const e of G.entities) {
      if (e === this || e.dead || e.removed || e.mapId !== this.mapId || !e.takeDamage || !hostile(this, e)) continue;
      if (e.ai === 'player' && (e.hidden || G.mode === 'cutscene')) continue;
      const d = dist(this.x, this.y, e.x, e.y);
      if (d < bd && this.map.lineClear(this.x, this.y - 4, e.x, e.y - 4)) { bd = d; best = e; }
    }
    return best;
  }
  moveToward(tx, ty, spd, dt) {
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    if (d < 2) return true;
    const vx = (dx / d) * spd * dt, vy = (dy / d) * spd * dt;
    const ok = this.tryMove(vx, vy);
    this.dir = dirFromVec(dx, dy);
    if (!ok) {
      // contornar obstáculo
      this.stuckT += dt;
      const side = (this.id % 2 ? 1 : -1);
      this.tryMove(-vy * side, vx * side);
    } else this.stuckT = Math.max(0, this.stuckT - dt);
    this.moving = true;
    return false;
  }
  aiCombat(dt) {
    const tgt = this.target;
    if (!tgt || tgt.dead || tgt.removed || tgt.mapId !== this.mapId || dist(this.x, this.y, tgt.x, tgt.y) > 340) { this.target = null; return false; }
    const d = dist(this.x, this.y, tgt.x, tgt.y);
    this.cool -= dt;
    if (this.bow) {
      // arqueiro: manter distância e atirar
      if (d < 60) this.moveToward(this.x - (tgt.x - this.x), this.y - (tgt.y - this.y), this.speed * 0.9, dt);
      else if (d > 150) this.moveToward(tgt.x, tgt.y, this.speed, dt);
      this.face(tgt.x, tgt.y);
      if (this.cool <= 0 && d < 190 && this.map.lineClear(this.x, this.y - 6, tgt.x, tgt.y - 6)) { this.state = 'bowdraw'; this.stateT = 0; this.cool = 1.6 + Math.random(); }
      return true;
    }
    const reach = (this.weapon ? this.weapon.reach : 16) + 4;
    if (this.teleports && this.cool < -1.5 && Math.random() < 0.02) {
      // Morwen: some na fumaça e reaparece atrás do alvo
      G.particles.burst(this.x, this.y - 8, 20, '#3a2a4a', 60, 0.8, { type: 'smoke', size: 4, grav: -20 });
      const a = Math.atan2(tgt.y - this.y, tgt.x - this.x);
      const nx = tgt.x + Math.cos(a) * 26, ny = tgt.y + Math.sin(a) * 26;
      const [bx, by, bw, bh] = this.boxAt(nx, ny);
      if (!this.map.collides(bx, by, bw, bh)) { this.x = nx; this.y = ny; }
      G.particles.burst(this.x, this.y - 8, 20, '#3a2a4a', 60, 0.8, { type: 'smoke', size: 4, grav: -20 });
      audio.sfx('roll', this); this.cool = 0.3;
      emit('throwDaggers', this, tgt);
    }
    if (d > reach) {
      // flanquear levemente
      const a = Math.atan2(tgt.y - this.y, tgt.x - this.x) + ((this.id % 3) - 1) * 0.35;
      this.moveToward(this.x + Math.cos(a) * 20, this.y + Math.sin(a) * 20, this.speed * (d > 90 ? 1.15 : 0.95), dt);
    } else {
      this.face(tgt.x, tgt.y);
      if (this.shield && tgt.state === 'attack' && Math.random() < 0.6 && !this.busy) { this.state = 'block'; this.stateT = 0; this.blockStart = G.t; }
      else if (this.cool <= 0) { this.state = 'windup'; this.stateT = 0; this.windDur = this.boss ? 0.35 : 0.45; this.showEmote('!', 0.4); this.atkAngle = Math.atan2(tgt.y - this.y, tgt.x - this.x); }
      else if (Math.random() < 0.01) { const a = Math.atan2(tgt.y - this.y, tgt.x - this.x) + Math.PI / 2; this.moveToward(this.x + Math.cos(a) * 10, this.y + Math.sin(a) * 10, this.speed * 0.6, dt); }
    }
    return true;
  }
  aiUpdate(dt) {
    if (this.ai === 'enemy' || this.ai === 'ally' || this.ai === 'follower') {
      if (!this.target || Math.random() < 0.02) { const t = this.findTarget(this.ai === 'enemy' ? (this.boss ? 260 : 150) : 170); if (t) this.target = t; }
      if (this.target && this.aiCombat(dt)) return;
    }
    if (this.ai === 'follower' || this.ai === 'ally') {
      const leader = G.player;
      if (leader && leader.mapId === this.mapId) {
        const d = dist(this.x, this.y, leader.x, leader.y);
        const keep = this.ai === 'ally' ? 34 + (this.id % 5) * 8 : 26;
        if (d > 300 && this.ai === 'follower') { this.teleportNear(leader); return; }
        if (d > keep) this.moveToward(leader.x + ((this.id % 3) - 1) * 14, leader.y + 12, this.speed * (d > 90 ? 1.6 : 1.05), dt);
        else this.face(leader.x, leader.y);
        if (this.stuckT > 2.5 && d > 60) { this.teleportNear(leader); this.stuckT = 0; }
      } else if (leader && this.ai === 'follower') this.teleportNear(leader);
      return;
    }
    if (this.ai === 'npc') {
      if (this.flee && !this.flee.dead && dist(this.x, this.y, this.flee.x, this.flee.y) < 120) { this.moveToward(this.x * 2 - this.flee.x, this.y * 2 - this.flee.y, this.speed * 1.3, dt); this.showEmote('sweat', 0.5); return; }
      this.flee = null;
      if (this.talkTarget) { this.face(this.talkTarget.x, this.talkTarget.y); return; }
      if (this.goal) { if (this.moveToward(this.goal.x, this.goal.y, this.speed * 0.8, dt) || this.stuckT > 4) { if (this.stuckT > 4) { this.x = this.goal.x; this.y = this.goal.y; } this.goal = null; this.stuckT = 0; if (this.goalDir != null) this.dir = this.goalDir; } return; }
      if (this.wanderR > 0) {
        this.wanderT -= dt;
        if (this.wanderTo) { if (this.moveToward(this.wanderTo.x, this.wanderTo.y, this.speed * 0.5, dt) || this.stuckT > 1) { this.wanderTo = null; this.stuckT = 0; } }
        else if (this.wanderT <= 0) { this.wanderT = 2 + Math.random() * 5; const a = Math.random() * Math.PI * 2, r = Math.random() * this.wanderR; this.wanderTo = { x: this.home.x + Math.cos(a) * r, y: this.home.y + Math.sin(a) * r }; }
      }
      // olhar para o jogador próximo
      const p = G.player;
      if (p && p.mapId === this.mapId && !this.wanderTo && dist(this.x, this.y, p.x, p.y) < 40) this.face(p.x, p.y);
      return;
    }
    if (this.ai === 'enemy') {
      // patrulha/retorno ao ponto de origem
      const dh = dist(this.x, this.y, this.home.x, this.home.y);
      if (dh > 40) { this.moveToward(this.home.x, this.home.y, this.speed * 0.6, dt); if (dh > 200) this.hp = Math.min(this.maxHp, this.hp + dt * 10); }
      else if (this.wanderR) { this.wanderT -= dt; if (this.wanderT <= 0) { this.wanderT = 3 + Math.random() * 4; this.wanderTo = { x: this.home.x + (Math.random() - 0.5) * this.wanderR, y: this.home.y + (Math.random() - 0.5) * this.wanderR }; } if (this.wanderTo && this.moveToward(this.wanderTo.x, this.wanderTo.y, this.speed * 0.4, dt)) this.wanderTo = null; }
    }
  }
  teleportNear(p) {
    this.mapId = p.mapId;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, x = p.x + Math.cos(a) * 24, y = p.y + Math.sin(a) * 18;
      const [bx, by, bw, bh] = this.boxAt(x, y);
      if (!this.map.collides(bx, by, bw, bh) && !this.blockedByWater(x, y)) { this.x = x; this.y = y; return; }
    }
    this.x = p.x; this.y = p.y + 6;
  }

  update(dt) {
    if (this.ai !== 'player') this.moving = false;
    this.animT += dt; this.stateT += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.emoteT > 0) { this.emoteT -= dt; if (this.emoteT <= 0) this.emote = null; }
    if (this.hpBarT > 0) this.hpBarT -= dt;
    if (this.state === 'dead') { this.deadT += dt; if (this.deadT > 4 && this.ai !== 'player' && !this.npcId) { this.alpha -= dt; if (this.alpha <= 0) this.removed = true; } return; }
    // máquina de estados
    switch (this.state) {
      case 'attack':
        if (!this.hitDone && this.stateT >= this.atkDur * 0.42) { this.hitDone = true; this.performHit(); }
        if (this.stateT >= this.atkDur) {
          this.state = 'idle';
          if (this.comboQueued && this.combo < 2) { this.combo++; this.startAttack(this.queuedAngle); }
          else { this.combo = this.comboQueued ? 0 : this.combo; this.comboResetT = 0.35; }
        }
        break;
      case 'windup':
        if (this.stateT >= this.windDur) { this.combo = this.boss && this.phase2 ? (this.combo + 1) % 3 : Math.random() < 0.3 ? 2 : 0; this.startAttack(this.atkAngle); this.cool = (this.boss ? 0.6 : 1.0) + Math.random() * (this.boss ? 0.6 : 1.1); if (this.boss && this.phase2 && Math.random() < 0.5) this.cool = 0.15; }
        break;
      case 'roll': {
        const sp = 170 * (1 - this.stateT / 0.42);
        this.tryMove(Math.cos(this.rollA) * sp * dt, Math.sin(this.rollA) * sp * dt);
        if (this.stateT >= 0.42) this.state = 'idle';
        break;
      }
      case 'hurt': if (this.stateT >= 0.25) this.state = 'idle'; break;
      case 'stagger': if (this.stateT >= this.staggerDur) this.state = 'idle'; break;
      case 'block': if (this.ai !== 'player' && this.stateT > 0.6) this.state = 'idle'; break;
      case 'bowdraw':
        if (this.ai !== 'player' && this.stateT >= 0.7) { this.state = 'idle'; if (this.target) emit('fireArrow', this, Math.atan2(this.target.y - this.y, this.target.x - this.x), this.bow); }
        break;
    }
    if (this.comboResetT > 0) { this.comboResetT -= dt; if (this.comboResetT <= 0) this.combo = 0; }
    // knockback
    if (Math.abs(this.kx) > 1 || Math.abs(this.ky) > 1) { this.tryMove(this.kx * dt, this.ky * dt); this.kx *= Math.pow(0.0005, dt); this.ky *= Math.pow(0.0005, dt); } else { this.kx = 0; this.ky = 0; }
    if (!this.busy && this.state !== 'block' && this.ai !== 'player') this.aiUpdate(dt);
    // estamina
    if (this.state !== 'block' && this.state !== 'attack' && this.state !== 'roll' && !this.running) this.stam = Math.min(this.maxStam, this.stam + dt * (this.ai === 'player' ? 26 : 30));
    // animação
    if (this.state === 'idle' || this.state === 'walk') this.state = this.moving ? 'walk' : 'idle';
  }

  frameInfo() {
    let anim = 'idle', f = 0;
    switch (this.state) {
      case 'walk': anim = 'walk'; f = Math.floor(this.animT * (this.running ? 12 : 8)) % 4; break;
      case 'attack': anim = 'attack'; f = Math.min(2, Math.floor((this.stateT / this.atkDur) * 3)); break;
      case 'windup': anim = 'attack'; f = 0; break;
      case 'block': anim = 'block'; break;
      case 'roll': anim = 'roll'; f = Math.min(3, Math.floor((this.stateT / 0.42) * 4)); break;
      case 'hurt': case 'stagger': anim = 'hurt'; break;
      case 'dead': anim = 'dead'; break;
      case 'bowdraw': anim = 'bowdraw'; f = this.stateT > 0.25 ? 1 : 0; break;
      default: anim = this.sitting ? 'sit' : 'idle'; f = Math.floor(this.animT * 1.6) % 2;
    }
    return [anim, f];
  }
  draw(ctx, cam) {
    const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
    if (x < -40 || y < -50 || x > G.view.w + 40 || y > G.view.h + 50) return;
    ctx.globalAlpha = this.alpha;
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y, this.boss ? 8 : 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    const [anim, f] = this.frameInfo();
    const sx = (this.dir * 4 + f) * FW, sy = ANIMS[anim] * FH;
    const s = this.scale;
    const behind = this.dir === 3;
    if (behind) this.drawGear(ctx, x, y);
    ctx.drawImage(this.sheet, sx, sy, FW, FH, x - (FW * s) / 2, y - FH * s + 2, FW * s, FH * s);
    if (this.hitFlash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8; ctx.drawImage(this.sheet, sx, sy, FW, FH, x - (FW * s) / 2, y - FH * s + 2, FW * s, FH * s); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = this.alpha; }
    if (this.state === 'windup' && Math.floor(this.stateT * 20) % 2 === 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; ctx.drawImage(this.sheet, sx, sy, FW, FH, x - FW / 2, y - FH + 2, FW, FH); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    if (!behind) this.drawGear(ctx, x, y);
    ctx.globalAlpha = 1;
    // barra de vida
    if (this.ai === 'enemy' && this.hpBarT > 0 && !this.boss && this.state !== 'dead') {
      ctx.fillStyle = '#1c1520'; ctx.fillRect(x - 9, y - 31, 18, 3); ctx.fillStyle = '#d83a3a'; ctx.fillRect(x - 8, y - 30, Math.round((16 * this.hp) / this.maxHp), 1);
    }
    if (this.emote) { const e = emoteSprite(this.emote); ctx.drawImage(e, x - 5, y - 40 + Math.round(Math.sin(G.t * 6) * 1)); }
  }
  drawGear(ctx, x, y) {
    const hand = { x: x + [0, -4, 4, 0][this.dir], y: y - 12 };
    if (this.state === 'attack' && this.weapon) {
      const w = this.weapon, spr = weaponSprite(w.wtype, w.tint || null);
      const t = clamp(this.stateT / this.atkDur, 0, 1);
      const arc = ((w.arc || 100) * Math.PI) / 180;
      let ang = this.atkAngle, off = 0;
      if (w.wtype === 'spear' || (w.wtype === 'dagger' && this.combo === 1)) off = Math.sin(t * Math.PI) * 9;
      else { const sgn = this.combo === 1 ? -1 : 1; ang = this.atkAngle - (arc / 2) * sgn + arc * sgn * easeOut(t); }
      ctx.save(); ctx.translate(hand.x + Math.cos(ang) * off, hand.y + Math.sin(ang) * off); ctx.rotate(ang); ctx.drawImage(spr, -2, -spr.height / 2); ctx.restore();
      // rastro do golpe
      if (t > 0.2 && t < 0.8 && w.wtype !== 'spear') {
        ctx.strokeStyle = this.team === 'P' ? 'rgba(255,255,240,0.55)' : 'rgba(255,200,180,0.5)'; ctx.lineWidth = this.combo === 2 ? 3 : 2;
        const sgn = this.combo === 1 ? -1 : 1;
        ctx.beginPath(); ctx.arc(hand.x, hand.y, w.reach - 2, this.atkAngle - (arc / 2) * sgn, ang, sgn < 0); ctx.stroke();
      }
    }
    if (this.state === 'block' && this.shield) {
      const spr = weaponSprite('shield', this.shield.tint || null);
      const a = this.facingAngle();
      ctx.drawImage(spr, Math.round(x + Math.cos(a) * 6 - 5), Math.round(y - 16 + Math.sin(a) * 4));
    }
    if (this.state === 'bowdraw' && this.bow) {
      const spr = weaponSprite('bow', this.bow.tint || null);
      const a = this.aimAngle ?? this.facingAngle();
      ctx.save(); ctx.translate(hand.x + Math.cos(a) * 5, hand.y + Math.sin(a) * 5); ctx.rotate(a); ctx.drawImage(spr, -3, -11); if (this.stateT > 0.15) { ctx.fillStyle = '#e8e0d0'; ctx.fillRect(-4 - Math.min(5, this.stateT * 10), 0, 9, 1); } ctx.restore();
    }
  }
}
const easeOut = (t) => 1 - (1 - t) * (1 - t);
