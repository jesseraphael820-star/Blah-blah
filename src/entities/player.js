// Jogador: controles, combate, arco, montaria, estamina, passos por superfície e progressão.
import { Actor } from './actor.js';
import { G } from '../state.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { emit } from '../core/events.js';
import { TILE_INFO } from '../gfx/tiles.js';
import { dirFromVec } from '../core/util.js';
import { weaponStats, playerDef, playerStamBonus } from '../systems/inventory.js';
import { ITEMS } from '../data/items.js';

export class Player extends Actor {
  constructor(x, y, look) {
    super(x, y, { look, hp: 100, team: 'P', ai: 'player', speed: 72, name: G.name });
    this.level = 1; this.xp = 0; this.bowMode = false; this.mount = null; this.stepT = 0; this.running = false; this.lantern = true;
    this.refreshStats();
  }
  xpToNext() { return 60 + (this.level - 1) * 55; }
  gainXp(n) {
    this.xp += n;
    while (this.xp >= this.xpToNext()) {
      this.xp -= this.xpToNext(); this.level++;
      this.baseHp = 100 + (this.level - 1) * 12; this.refreshStats(); this.hp = this.maxHp; this.stam = this.maxStam;
      audio.sfx('level'); emit('levelUp', this.level);
      G.particles.burst(this.x, this.y - 12, 24, '#ffe080', 70, 0.9, { grav: -40 });
    }
  }
  refreshStats() {
    const eq = G.inv ? G.inv.equip : {};
    this.weapon = weaponStats(eq.weapon);
    if (this.weapon) this.weapon.dmg = Math.round(this.weapon.dmg * (1 + (this.level - 1) * 0.06));
    this.bow = eq.bow ? Object.assign({}, ITEMS[eq.bow]) : null;
    this.shield = eq.shield ? ITEMS[eq.shield] : null;
    this.def = G.inv ? playerDef() : 0;
    this.maxHp = (this.baseHp || 100);
    this.maxStam = 100 + (G.inv ? playerStamBonus() : 0) + (this.level - 1) * 3;
    this.hp = Math.min(this.hp, this.maxHp);
    const armor = eq.armor && ITEMS[eq.armor];
    this.armorSlow = armor && armor.slow ? armor.slow : 0;
    // visual: armadura e manto mudam o visual
    const look = Object.assign({}, G.playerLook);
    if (eq.armor === 'a_chain' || eq.armor === 'a_plate') look.armor = eq.armor === 'a_plate' ? '#a0a0ac' : '#7a7a86';
    if (eq.armor === 'a_fur') look.top = '#8a6a4a';
    if (eq.cloak) { look.cape = ITEMS[eq.cloak].color; look.capeEmblem = eq.cloak === 'c_varden'; }
    if (eq.cloak === 'c_varden') look.tabard = '#7b3fa0';
    this.setLook(look);
  }
  aimAngleFromInput() {
    if (input.mouse.usedRecently > 0 && input.lastDevice === 'kb') {
      const mx = input.mouse.sx + G.cam.x, my = input.mouse.sy + G.cam.y;
      return Math.atan2(my - (this.y - 10), mx - this.x);
    }
    return this.facingAngle();
  }
  update(dt) {
    this.moving = false;
    if (G.mode !== 'play' || this.frozen) { this.running = false; if (this.state === 'walk') this.state = 'idle'; super.update(dt); return; }
    const [ax, ay] = input.axis();
    const wantsRun = input.held('run') && (ax || ay);
    // montaria
    if (this.mount) { this.updateMounted(dt, ax, ay, wantsRun); return; }
    if (input.pressed('bow') && this.bow) { this.bowMode = !this.bowMode; audio.sfx('click'); emit('bowMode', this.bowMode); }
    if (input.pressed('potion')) emit('quickPotion');
    // bloqueio
    if (input.held('block') && this.shield && !this.busy) { if (this.state !== 'block') { this.state = 'block'; this.blockStart = G.t; this.stateT = 0; } }
    else if (this.state === 'block' && !input.held('block')) this.state = 'idle';
    // esquiva
    if (input.pressed('dodge') && (ax || ay || true)) {
      const a = ax || ay ? Math.atan2(ay, ax) : this.facingAngle() + Math.PI;
      if (this.state === 'attack' && this.stateT > this.atkDur * 0.5) this.state = 'idle';
      this.startRoll(a);
    }
    // ataque
    if (this.bowMode && this.bow) {
      if (input.held('attack') && !this.busy && this.state !== 'block') { if ((G.inv.items.arrows || 0) > 0) { this.state = 'bowdraw'; this.stateT = 0; } else if (input.pressed('attack')) emit('noArrows'); }
      if (this.state === 'bowdraw') {
        this.aimAngle = this.aimAngleFromInput(); this.dir = dirFromVec(Math.cos(this.aimAngle), Math.sin(this.aimAngle));
        if (!input.held('attack')) {
          const power = Math.min(1, this.stateT / this.bow.draw);
          this.state = 'idle';
          if (power > 0.25) { G.inv.items.arrows--; if (G.inv.items.arrows <= 0) delete G.inv.items.arrows; emit('fireArrow', this, this.aimAngle, this.bow, power); emit('invChanged'); }
        }
      }
    } else if (input.pressed('attack')) {
      const a = this.aimAngleFromInput();
      if (this.state === 'attack' && this.stateT > this.atkDur * 0.35) { this.comboQueued = true; this.queuedAngle = a; }
      else if (!this.busy) { if (this.state === 'block') this.state = 'idle'; this.startAttack(a); }
    }
    // movimento
    this.running = false;
    if (!this.busy && this.state !== 'block') {
      if (ax || ay) {
        let spd = this.speed * (1 - this.armorSlow);
        if (wantsRun && this.stam > 1) { spd *= 1.6; this.running = true; this.stam -= dt * 14; }
        const t = this.map.tileAtPx(this.x, this.y); spd *= TILE_INFO[t].speed;
        if (this.state === 'bowdraw') spd *= 0.4;
        this.tryMove(ax * spd * dt, ay * spd * dt);
        if (this.state !== 'bowdraw') this.dir = dirFromVec(ax, ay);
        this.moving = true;
        this.stepT -= dt * (this.running ? 1.6 : 1);
        if (this.stepT <= 0) { this.stepT = 0.32; this.footstep(); G.stats.steps++; }
      }
    } else if (this.state === 'block' && (ax || ay)) { this.tryMove(ax * 25 * dt, ay * 25 * dt); }
    if (this.stam < this.maxStam && !this.running && this.state !== 'block') this.stam = Math.min(this.maxStam, this.stam + dt * 8 * (G.buffStam > 0 ? 2 : 0));
    const wasState = this.state;
    super.update(dt);
    if (wasState === 'walk' && !this.moving && this.state === 'walk') this.state = 'idle';
    if (this.moving && this.state === 'idle') this.state = 'walk';
  }
  footstep() {
    const t = this.map.tileAtPx(this.x, this.y);
    const s = TILE_INFO[t].surf;
    audio.sfx('step_' + s, null, this.running ? 0.9 : 0.6);
    if (s === 'water' || s === 'mud') G.particles.burst(this.x, this.y, 3, s === 'water' ? '#c0e0f0' : '#5a4a30', 30, 0.3);
    else if (s === 'snow' || (s === 'dirt' && this.running)) G.particles.add({ x: this.x + (Math.random() - 0.5) * 4, y: this.y, vy: -8, life: 0.4, color: s === 'snow' ? '#ffffff' : '#a08a6a', size: 1 });
  }
  updateMounted(dt, ax, ay, run) {
    const h = this.mount;
    this.state = 'idle';
    let spd = 0;
    if (ax || ay) {
      spd = run && h.stam > 1 ? 170 : 105;
      if (run && h.stam > 1) h.stam -= dt * 10;
      const t = this.map.tileAtPx(h.x, h.y); spd *= Math.max(0.6, TILE_INFO[t].speed);
      h.tryMove(ax * spd * dt, ay * spd * dt);
      h.dir = dirFromVec(ax, ay); this.dir = h.dir;
    }
    if (!run || !(ax || ay)) h.stam = Math.min(h.maxStam, h.stam + dt * 12);
    h.gait = spd > 120 ? 'gallop' : spd > 0 ? 'walk' : 'idle';
    this.x = h.x; this.y = h.y; this.running = spd > 120;
    this.stepT -= dt * (spd > 120 ? 2.4 : 1.3);
    if (spd && this.stepT <= 0) { this.stepT = 0.3; audio.sfx('gallop', null, spd > 120 ? 0.8 : 0.5); if (spd > 120) G.particles.add({ x: h.x - Math.sign(ax || 0) * 10, y: h.y, vy: -6, vx: -ax * 10, life: 0.5, color: '#b0a080', type: 'smoke', size: 3 }); }
    this.animT += dt; this.stateT += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.emoteT > 0) { this.emoteT -= dt; if (this.emoteT <= 0) this.emote = null; }
  }
  takeDamage(amount, src, knock, ranged, crit) {
    if (this.mount && amount > 0) { emit('dismount', true); }
    return super.takeDamage(amount, src, knock, ranged, crit);
  }
  die(src) {
    this.state = 'dead'; this.stateT = 0; this.hp = 0; this.dead = true;
    audio.sfx('death'); G.stats.deaths++;
    emit('playerDied', src);
  }
  draw(ctx, cam) { if (this.mount) return; super.draw(ctx, cam); }
}
