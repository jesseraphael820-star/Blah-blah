// Enemies: AI state machine (wander, chase, telegraphed attacks, bosses with
// phases), status effects, spawners with respawn and day/night/quest conditions.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { ENEMIES, SPAWNS } from '../data/enemies.js';
import { makeEnemyModel } from './enemyModels.js';
import { angleDiff, dampAngle, clamp, dist2d } from '../core/utils.js';
import { LOC } from '../data/world.js';
import { t } from '../core/i18n.js';

let UID = 1;
const ATTACK_DUR = { melee: 0.32, leap: 0.55, charge: 0.5, projectile: 0.25, volley: 0.4, slam: 0.35, beam: 0.55, summon: 0.45, teleport: 0.3 };

export class Enemy {
  constructor(type, x, z, o = {}) {
    this.id = UID++;
    this.type = type;
    this.def = { ...ENEMIES[type] };
    if (o.color) this.def.color = o.color;
    const d = this.def;
    this.boss = !!d.boss;
    this.level = d.level;
    this.maxHp = d.hp;
    this.hp = d.hp;
    this.pos = new THREE.Vector3(x, G.physics.groundAt(x, z, 200), z);
    this.home = new THREE.Vector3(x, 0, z);
    this.homeR = o.homeR || 10;
    this.yaw = Math.random() * Math.PI * 2;
    this.state = 'idle';
    this.stT = Math.random() * 2;
    this.cds = {};
    this.status = { burn: 0, burnDps: 0, frozen: 0, slow: 0 };
    this.model = makeEnemyModel(d);
    G.scene.add(this.model.group);
    this.radius = d.radius * (d.scale ? 1 : 1);
    this.spawner = o.spawner || null;
    this.raid = !!o.raid;
    this.summoned = !!o.summoned;
    this.phase = 0;
    this.aggro = false;
    this.vel = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.knock = new THREE.Vector3();
    this.lifeT = 0;
    this.lastHitBy = 0;
    if (o.aggro) { this.aggro = true; this.state = 'chase'; }
  }
  get dead() { return this.state === 'dead'; }

  speed() {
    let s = this.def.speed * (this.phase ? 1.25 : 1);
    if (this.status.slow > 0) s *= 0.5;
    return s;
  }
  set(state) { this.state = state; this.stT = 0; this.didHit = false; }

  update(dt) {
    const P = G.player;
    const m = this.model;
    this.lifeT += dt;
    // status effects
    const st = this.status;
    let tint = null;
    if (st.burn > 0) {
      st.burn -= dt; tint = 'burn';
      this.burnAcc = (this.burnAcc || 0) + dt;
      if (this.burnAcc > 0.5) { this.burnAcc = 0; this.takeDamage(st.burnDps * 0.5, { dot: true, color: 'burn' }); }
      if (Math.random() < 0.5) G.particles.fire(this.pos.x, this.pos.y + 0.5, this.pos.z, 0.6);
    }
    if (st.slow > 0) st.slow -= dt;
    if (st.frozen > 0) { st.frozen -= dt; tint = 'frozen'; }
    m.base(dt, tint);
    if (this.dead) {
      this.stT += dt;
      m.animate(dt, 'dead', Math.min(1, this.stT / 1), 0);
      if (this.stT > 1.2) m.setOpacity(Math.max(0, 1 - (this.stT - 1.2) * 2));
      this.place();
      return this.stT > 1.7;
    }
    if (st.frozen > 0) { this.place(); return false; }

    this.stT += dt;
    const dP = dist2d(this.pos.x, this.pos.z, P.pos.x, P.pos.z);
    const d = this.def;
    const playerOk = !P.dead && !G.ui.blocksGameplay();
    const inVillage = (x, z) => !this.raid && dist2d(x, z, LOC.village.x, LOC.village.z) < LOC.village.r - 4;
    const yToP = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
    let move = 0, moveYaw = this.yaw;
    const sameLevel = Math.abs(P.pos.y - this.pos.y) < 6 || d.fly;

    switch (this.state) {
      case 'idle':
        if (this.stT > 2 + Math.random() * 3) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * this.homeR;
          this.target.set(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
          this.set('wander');
        }
        break;
      case 'wander': {
        moveYaw = Math.atan2(this.target.x - this.pos.x, this.target.z - this.pos.z);
        move = this.speed() * 0.35;
        if (dist2d(this.pos.x, this.pos.z, this.target.x, this.target.z) < 1 || this.stT > 8) this.set('idle');
        break;
      }
      case 'chase': {
        if (!playerOk || inVillage(P.pos.x, P.pos.z) || dist2d(this.pos.x, this.pos.z, this.home.x, this.home.z) > Math.max(40, d.aggro * 2.6) && !this.raid && !this.summoned) {
          this.aggro = false; this.set('return'); break;
        }
        if (d.flee) { moveYaw = yToP + Math.PI + Math.sin(this.lifeT) * 0.6; move = this.speed(); if (this.lifeT > 45) this.despawn = true; break; }
        // weak creatures fear a much stronger hero and run away
        if (this.afraid) { moveYaw = yToP + Math.PI + Math.sin(this.lifeT) * 0.4; move = this.speed() * 0.9; if (dP > d.aggro * 1.6) { this.afraid = false; this.aggro = false; this.set('return'); } break; }
        moveYaw = yToP;
        const keep = d.keepDist;
        if (keep) {
          if (dP < keep - 1.5) { moveYaw = yToP + Math.PI; move = this.speed() * 0.8; }
          else if (dP > keep + 2) move = this.speed();
          else { moveYaw = yToP + Math.PI / 2 * Math.sign(Math.sin(this.lifeT * 0.7)); move = this.speed() * 0.4; }
        } else if (dP > d.radius + 1.4) move = this.speed();
        this.yaw = dampAngle(this.yaw, yToP, 8, dt);
        // pick an attack
        for (const a of d.attacks) {
          if ((this.cds[a.kind] || 0) > 0) continue;
          if (a.phase && this.phase < a.phase) continue;
          if (dP > a.range + d.radius || (a.minRange && dP < a.minRange)) continue;
          if (!sameLevel && a.kind !== 'projectile' && a.kind !== 'volley') continue;
          this.attack = a; this.set('windup');
          this.cds[a.kind] = a.cd * (0.85 + Math.random() * 0.3);
          this.onWindup(a);
          break;
        }
        break;
      }
      case 'windup': {
        const a = this.attack;
        if (a.kind !== 'beam' || this.stT < a.windup * 0.7) this.yaw = dampAngle(this.yaw, yToP, 10, dt);
        if (this.stT >= a.windup) { this.set('attack'); this.execute(a, dP); }
        break;
      }
      case 'attack': {
        const a = this.attack;
        const dur = ATTACK_DUR[a.kind] || 0.3;
        if (a.kind === 'leap' || a.kind === 'charge') {
          move = a.kind === 'leap' ? this.leapSpeed : this.speed() * 3.2;
          moveYaw = this.yaw;
          if (!this.didHit && dist2d(this.pos.x, this.pos.z, P.pos.x, P.pos.z) < d.radius + 1.0 && sameLevel) {
            this.didHit = true; this.hitPlayer(a.mult);
          }
        }
        if (this.stT >= dur) {
          if (a.kind === 'leap' && a.radius) this.aoe(a.radius * 0.6, a.mult, 0xc8b090);
          this.set('recover');
        }
        break;
      }
      case 'recover': if (this.stT > (this.boss ? 0.35 : 0.6)) this.set('chase'); break;
      case 'hurt': if (this.stT > (this.staggerT || 0.25)) this.set('chase'); break;
      case 'return': {
        moveYaw = Math.atan2(this.home.x - this.pos.x, this.home.z - this.pos.z);
        move = this.speed() * 0.8;
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.2 * dt);
        if (dist2d(this.pos.x, this.pos.z, this.home.x, this.home.z) < 2) this.set('idle');
        break;
      }
      default: break;
    }
    for (const k in this.cds) this.cds[k] -= dt;

    // aggro check
    if ((this.state === 'idle' || this.state === 'wander') && playerOk && sameLevel) {
      const range = d.aggro * (G.sky.night > 0.5 ? 1.2 : 1);
      if (dP < range && !inVillage(P.pos.x, P.pos.z)) { this.aggro = true; this.set('chase'); this.afraid = !this.boss && !this.raid && !this.def.guardian && this.level + 6 <= G.state.player.level; if (this.boss) this.onBossAggro(); else if (d.model === 'wolf') G.audio.sfxAt('growl', this.pos.x, this.pos.z); }
    }
    if (this.state === 'return' && dP < d.aggro * 0.6 && playerOk && !inVillage(P.pos.x, P.pos.z) && this.hp > this.maxHp * 0.5) this.set('chase');

    // movement
    if (move > 0) {
      if (this.state !== 'attack') this.yaw = dampAngle(this.yaw, moveYaw, 6, dt);
      const vx = Math.sin(moveYaw) * move * dt, vz = Math.cos(moveYaw) * move * dt;
      const nx = this.pos.x + vx, nz = this.pos.z + vz;
      if (!inVillage(nx, nz) || this.state === 'return') {
        const blocked = G.physics.move(this.pos, vx, vz, this.radius * 0.8, 1.5, d.fly ? false : false);
        if (blocked && this.state === 'wander') this.set('idle');
      }
    }
    if (this.knock.lengthSq() > 0.01) {
      G.physics.move(this.pos, this.knock.x * dt, this.knock.z * dt, this.radius * 0.8, 1.5, false);
      this.knock.multiplyScalar(Math.max(0, 1 - dt * (d.heavy || this.boss ? 14 : 7)));
    }
    // vertical: snap to ground (leap visually arcs)
    const g = G.physics.groundAt(this.pos.x, this.pos.z, this.pos.y + 1.5, this.radius * 0.5);
    this.pos.y = g;
    // water: non-flyers avoid deep water
    const wl = G.physics.waterLevel(this.pos.x, this.pos.z);
    if (!d.fly && wl - g > 1.2 && this.state !== 'return') { this.set('return'); }
    m.animate(dt, this.state === 'attack' && this.attack && this.attack.kind === 'charge' ? 'charge' : this.state, this.attackPhase(), move);
    this.place();
    return !!this.despawn;
  }

  attackPhase() {
    if (this.state === 'windup') return clamp(this.stT / this.attack.windup, 0, 1);
    if (this.state === 'attack') return clamp(this.stT / (ATTACK_DUR[this.attack.kind] || 0.3), 0, 1);
    return 0;
  }

  place() {
    const g = this.model.group;
    let y = this.pos.y;
    if (this.state === 'attack' && this.attack && this.attack.kind === 'leap') y += Math.sin(this.attackPhase() * Math.PI) * 2.2;
    g.position.set(this.pos.x, y, this.pos.z);
    g.rotation.y = this.yaw;
  }

  onWindup(a) {
    const d = this.def;
    this.model.flash(0xff5a3a);
    if (a.kind === 'slam') G.combat.telegraphCircle(this.pos.x, this.pos.y, this.pos.z, a.radius, a.windup);
    else if (a.kind === 'leap' && a.radius) {
      const P = G.player.pos;
      G.combat.telegraphCircle(P.x, P.y, P.z, a.radius * 0.6, a.windup + 0.4);
    } else if (a.kind === 'beam') G.combat.telegraphLine(this, a.range, a.windup);
    else if (a.kind === 'summon' || (this.boss && a.kind === 'volley')) { G.audio.sfxAt('roar', this.pos.x, this.pos.z, { range: 60 }); }
    if (d.model === 'wolf' && a.kind !== 'summon') G.audio.sfxAt('growl', this.pos.x, this.pos.z, { vol: 0.7 });
  }

  execute(a, dP) {
    const P = G.player;
    const d = this.def;
    switch (a.kind) {
      case 'melee': {
        const ang = Math.abs(angleDiff(this.yaw, Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z)));
        if (dist2d(this.pos.x, this.pos.z, P.pos.x, P.pos.z) < a.range + d.radius + 0.4 && ang < 1.3) this.hitPlayer(a.mult);
        G.audio.sfxAt('swing', this.pos.x, this.pos.z, { vol: 0.6 });
        break;
      }
      case 'leap': {
        const dist = Math.max(2, dist2d(this.pos.x, this.pos.z, P.pos.x, P.pos.z) - d.radius * 0.5);
        this.leapSpeed = dist / ATTACK_DUR.leap;
        this.yaw = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
        break;
      }
      case 'charge': G.audio.sfxAt('dodge', this.pos.x, this.pos.z); break;
      case 'projectile': {
        G.combat.spawnProjectile({ from: this, x: this.pos.x, y: this.pos.y + (d.fly || 1) * (d.scale || 1), z: this.pos.z, target: P, speed: a.speed || 12, dmg: d.dmg * a.mult, color: a.color || 0xc070ff, size: 0.35 });
        G.audio.sfxAt('orb', this.pos.x, this.pos.z, { vol: 0.6 });
        break;
      }
      case 'volley': {
        for (let i = 0; i < a.n; i++) {
          const spread = (i - (a.n - 1) / 2) * 0.22;
          G.combat.spawnProjectile({ from: this, x: this.pos.x, y: this.pos.y + 2.2 * (d.scale || 1) * 0.6, z: this.pos.z, target: P, speed: a.speed || 14, dmg: d.dmg * a.mult, color: a.color, size: a.rock ? 0.6 : 0.4, spread, rock: a.rock, gravity: a.rock ? 6 : 0 });
        }
        G.audio.sfxAt(a.rock ? 'slam' : 'orb', this.pos.x, this.pos.z);
        break;
      }
      case 'slam': {
        this.aoe(a.radius, a.mult, d.model === 'shadow' ? 0xd04cff : 0xb8a888);
        break;
      }
      case 'beam': G.combat.fireBeam(this, a.range, d.dmg * a.mult, a.color || 0x4fd0ff); break;
      case 'summon': {
        for (let i = 0; i < a.n; i++) {
          const ang = Math.random() * Math.PI * 2;
          G.entities.enemies.spawn(a.summon, this.pos.x + Math.cos(ang) * 4, this.pos.z + Math.sin(ang) * 4, { aggro: true, summoned: true });
          G.particles.burst(this.pos.x + Math.cos(ang) * 4, this.pos.y + 0.5, this.pos.z + Math.sin(ang) * 4, 0x8a3aaa, 20, 4);
        }
        if (d.model === 'wolf') G.audio.sfxAt('howl', this.pos.x, this.pos.z, { range: 80, vol: 1.4 });
        break;
      }
      case 'teleport': {
        const behind = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
        G.particles.burst(this.pos.x, this.pos.y + 1.5, this.pos.z, 0xd04cff, 30, 5);
        const nx = P.pos.x + Math.sin(behind) * 5, nz = P.pos.z + Math.cos(behind) * 5;
        this.pos.x = nx; this.pos.z = nz;
        G.particles.burst(nx, this.pos.y + 1.5, nz, 0xd04cff, 30, 5);
        G.audio.sfxAt('blink', nx, nz);
        break;
      }
      default: break;
    }
  }

  aoe(r, mult, color) {
    const P = G.player;
    G.particles.ring(this.pos.x, this.pos.y + 0.3, this.pos.z, color, r, 40, { speed: r * 1.6 });
    G.particles.dust(this.pos.x, this.pos.y, this.pos.z, 14, color);
    G.audio.sfxAt('slam', this.pos.x, this.pos.z, { range: 50 });
    G.physProps?.impulseRadius(this.pos.x, this.pos.y, this.pos.z, r + 2, 12);
    const dp = dist2d(this.pos.x, this.pos.z, P.pos.x, P.pos.z);
    if (dp < 25) G.cam.shake(0.45 * (1 - dp / 25));
    if (dp < r + 0.4 && Math.abs(P.pos.y - this.pos.y) < 2.5) this.hitPlayer(mult, 9);
  }

  hitPlayer(mult, knock = 6) {
    const dmg = this.def.dmg * mult * (this.phase ? 1.15 : 1);
    G.player.damage(dmg, this.pos, { enemy: this, knock });
  }

  stagger(dur) {
    if (this.dead) return;
    this.staggerT = dur;
    this.set('hurt');
    this.model.flash(0xffffff);
    G.ui.damageNumber(this.pos.x, this.pos.y + 2.5, this.pos.z, '!', 'crit');
  }

  takeDamage(amount, o = {}) {
    if (this.dead) return 0;
    const dmg = Math.max(1, Math.round(amount));
    this.hp -= dmg;
    this.model.flash(o.color === 'burn' ? 0xff7a2a : 0xffffff);
    if (!o.dot) G.audio.sfxAt('enemyHurt', this.pos.x, this.pos.z, { vol: 0.7 });
    G.ui.damageNumber(this.pos.x, this.pos.y + 1.6 * (this.def.scale || 1) + 0.6, this.pos.z, dmg, o.crit ? 'crit' : o.dot ? 'dot' : o.power ? 'power' : 'hit');
    if (!this.aggro) { this.aggro = true; if (this.boss) this.onBossAggro(); }
    if (o.knock && !this.boss) {
      const k = o.knock * (this.def.heavy ? 0.3 : 1);
      this.knock.set(this.pos.x - G.player.pos.x, 0, this.pos.z - G.player.pos.z).normalize().multiplyScalar(k);
    }
    if (this.hp <= 0) { this.die(); return dmg; }
    if (this.boss && this.phase === 0 && this.hp < this.maxHp * 0.5) {
      this.phase = 1;
      G.audio.sfxAt('roar', this.pos.x, this.pos.z, { range: 80, vol: 1.3 });
      G.ui.toast(t('ui.bossEnraged', { name: t('enemy.' + this.type) }), 'boss');
      G.particles.ring(this.pos.x, this.pos.y + 1, this.pos.z, 0xff3a3a, 6, 50);
      G.cam.shake(0.5);
    }
    if (this.state !== 'attack' && this.state !== 'windup' && !this.boss && !this.def.heavy) { this.staggerT = 0.22; this.set('hurt'); }
    else if ((this.state === 'idle' || this.state === 'wander' || this.state === 'return')) this.set('chase');
    return dmg;
  }

  onBossAggro() {
    G.ui.setBoss(this);
    G.audio.sfxAt('roar', this.pos.x, this.pos.z, { range: 80, vol: 1.2 });
  }

  die() {
    this.hp = 0;
    this.set('dead');
    const d = this.def;
    G.audio.sfxAt('enemyDie', this.pos.x, this.pos.z);
    G.particles.burst(this.pos.x, this.pos.y + 1, this.pos.z, d.color, 30, 5, { solid: true, gravity: 10, size: 0.3 });
    G.particles.burst(this.pos.x, this.pos.y + 1, this.pos.z, 0xffffff, 12, 3, { up: 2 });
    const gold = Math.floor(d.gold[0] + Math.random() * (d.gold[1] - d.gold[0] + 1));
    if (!this.summoned || Math.random() < 0.5) G.pickups.spawnCoins(this.pos.x, this.pos.y + 0.6, this.pos.z, this.summoned ? Math.ceil(gold / 3) : gold);
    G.prog.addXP(this.summoned ? Math.ceil(d.xp / 2) : d.xp, this.pos);
    const items = {};
    for (const [id, chance, n] of d.drops || []) if (Math.random() < chance) items[id] = (items[id] || 0) + n;
    if (Object.keys(items).length) G.prog.grant({ items }, { quiet: false, small: true });
    if (this.boss) {
      G.ui.setBoss(null);
      G.cam.shake(0.8);
      G.ui.screenFlash(0.6, '#ffffff');
      G.player.playAction('victory', 2.2);
      G.audio.sfx('levelup');
    }
    G.bus.emit('enemyKilled', { type: this.type, boss: this.boss, enemy: this });
  }

  dispose() { G.scene.remove(this.model.group); }
}

// ---------------- manager ----------------
export class EnemyManager {
  constructor() {
    this.list = [];
    this.spawners = SPAWNS.map((s) => ({ ...s, alive: [], timer: 0 }));
  }
  addSpawners(arr) { for (const s of arr) this.spawners.push({ ...s, alive: [], timer: 0 }); }
  spawn(type, x, z, o = {}) {
    const e = new Enemy(type, x, z, o);
    this.list.push(e);
    return e;
  }
  conditionOk(s) {
    if (s.night && !G.sky.isNight()) return false;
    if (s.quest) {
      const [qid, step] = s.quest;
      if (!G.quests.isActiveStep(qid, step)) return false;
    }
    if (s.flag) {
      const neg = s.flag.startsWith('!');
      const f = !!G.state.world.flags[s.flag.replace('!', '')];
      if (neg ? f : !f) return false;
    }
    return true;
  }
  update(dt) {
    const P = G.player.pos;
    // spawners
    for (const s of this.spawners) {
      s.alive = s.alive.filter((e) => this.list.includes(e) && !e.dead);
      const ok = this.conditionOk(s);
      const d = dist2d(P.x, P.z, s.x, s.z);
      if (!ok) {
        // night creatures fade at dawn
        if (s.night) for (const e of s.alive) if (!e.aggro) e.despawn = true;
        continue;
      }
      if (s.alive.length < s.n) {
        s.timer -= dt;
        const far = d > 45 || s.boss;
        const near = d < 140;
        if (s.timer <= 0 && near && (far || s.alive.length === 0 && d > 30)) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * (s.r || 6);
          let x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
          if (s.boss) { x = s.x; z = s.z; }
          if (G.physics.waterLevel(x, z) - G.physics.terrainHeight(x, z) > 0.5 && !ENEMIES[s.type].fly) { s.timer = 1; continue; }
          const e = this.spawn(s.type, x, z, { spawner: s, homeR: s.r || 8, color: s.color });
          if (s.onTower) { e.pos.y = G.world.towerTop; e.home.y = e.pos.y; }
          s.alive.push(e);
          s.timer = s.boss ? 3 : 25 + Math.random() * 35;
        }
      }
    }
    // update enemies, with distance-based sleeping
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      const d = dist2d(P.x, P.z, e.pos.x, e.pos.z);
      e.model.group.visible = d < G.world.viewDist * 0.6;
      if (d > 120 && !e.boss && !e.aggro) {
        if (e.summoned) { e.despawn = true; }
        else continue;
      }
      const remove = e.update(dt) || e.despawn;
      if (remove) {
        if (e.despawn && !e.dead) G.particles.burst(e.pos.x, e.pos.y + 1, e.pos.z, 0x5a3a7a, 20, 3);
        e.dispose();
        this.list.splice(i, 1);
        if (G.ui.bossTarget === e) G.ui.setBoss(null);
      }
    }
    // separation
    for (let i = 0; i < this.list.length; i++) {
      const a = this.list[i];
      if (a.dead) continue;
      for (let j = i + 1; j < this.list.length; j++) {
        const b = this.list[j];
        if (b.dead) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const rr = a.radius + b.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-4) {
          const d = Math.sqrt(d2), push = (rr - d) * 0.5;
          a.pos.x -= dx / d * push; a.pos.z -= dz / d * push;
          b.pos.x += dx / d * push; b.pos.z += dz / d * push;
        }
      }
      // keep off the player
      const dx = a.pos.x - P.x, dz = a.pos.z - P.z;
      const rr = a.radius + 0.4;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-4 && Math.abs(a.pos.y - P.y) < 2) { const d = Math.sqrt(d2); a.pos.x += dx / d * (rr - d); a.pos.z += dz / d * (rr - d); }
    }
  }
  alive() { return this.list.filter((e) => !e.dead); }
  clearAggro() { for (const e of this.list) { if (e.aggro && !e.dead) { e.aggro = false; e.set('return'); } } }
}
