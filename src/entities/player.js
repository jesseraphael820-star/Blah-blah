// Player controller: movement, jumping, swimming, sprint, dodge roll,
// 3-hit sword combos, blocking/parry, powers and damage handling.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { Humanoid, playerLook } from './character.js';
import { SKINS, SWORDS, ITEMS } from '../data/items.js';
import { clamp, dampAngle, angleDiff, damp, lerp } from '../core/utils.js';
import { swordLength } from '../render/models.js';
import { SwordTrail } from '../render/trail.js';
import { STEP_UP } from '../world/physics.js';
import { t } from '../core/i18n.js';

const GRAV = 24;
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();

export class Player {
  constructor(scene) {
    const s = G.state.player;
    this.pos = new THREE.Vector3(s.x, s.y, s.z);
    this.vy = 0;
    this.yaw = s.yaw || 0;
    this.visualY = this.pos.y;
    this.radius = 0.38;
    this.height = 1.8;
    this.onGround = true;
    this.state = 'normal';
    this.stateT = 0;
    this.combo = 0;
    this.queued = false;
    this.hitDone = false;
    this.invuln = 0;
    this.blocking = false;
    this.blockT = 0;
    this.staminaDelay = 0;
    this.lastHurt = 99;
    this.fallStart = this.pos.y;
    this.stepAcc = 0;
    this.swimming = false;
    this.action = null;
    this.shield = 0;
    this.shieldT = 0;
    this.speedNow = 0;
    this.lockTarget = null;
    this.hv = { x: 0, z: 0 };
    this.jumpBuf = 0;
    this.squash = 0;
    this.model = new Humanoid(this.look());
    scene.add(this.model.root);
    this.trail = new SwordTrail(scene);
    this.shieldMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 1), new THREE.MeshBasicMaterial({ color: 0x7affc8, transparent: true, opacity: 0.25, wireframe: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.shieldMesh.visible = false;
    scene.add(this.shieldMesh);
    this.footprints = [];
    this.fpMat = new THREE.MeshBasicMaterial({ color: 0x3a2a1a, transparent: true, opacity: 0.35, depthWrite: false });
    this.fpGeo = new THREE.PlaneGeometry(0.22, 0.32).rotateX(-Math.PI / 2);
    this.fpSide = 1;
  }

  look() { return playerLook(G.state.appearance, G.state.inv.equipped, SKINS); }
  refreshLook() {
    const r = this.model.rot;
    this.model.build(this.look());
    this.model.rot = r;
  }
  get s() { return G.state.player; }
  get stats() { return G.prog.stats(); }
  get sword() { return SWORDS[G.state.inv.equipped.sword] || SWORDS.wood_sword; }
  get dead() { return this.state === 'dead'; }
  busy() { return ['attack', 'dodge', 'cast', 'hurt', 'dead', 'action'].includes(this.state); }

  setState(s) { this.state = s; this.stateT = 0; this.hitDone = false; }

  teleport(x, y, z, yaw) {
    this.pos.set(x, y, z);
    this.visualY = y;
    this.vy = 0;
    if (yaw !== undefined) this.yaw = yaw;
    this.fallStart = y;
    G.cam?.snap();
  }

  playAction(name, dur = 0.6) {
    if (this.dead) return;
    this.action = name;
    this.setState('action');
    this.actionDur = dur;
  }

  update(dt) {
    const I = G.input;
    const st = this.stats;
    const s = this.s;
    this.stateT += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.lastHurt += dt;
    const controlsOn = !G.ui.blocksGameplay();

    // ---------- regen ----------
    s.energy = Math.min(st.maxEnergy, s.energy + dt * (3 + st.spi * 0.25));
    this.staminaDelay -= dt;
    if (this.staminaDelay <= 0) s.stamina = Math.min(st.maxStamina, s.stamina + dt * 32);
    if (this.lastHurt > 6 && !this.dead) s.hp = Math.min(st.maxHp, s.hp + dt * (0.6 + st.vit * 0.1));
    if (this.shieldT > 0) { this.shieldT -= dt; if (this.shieldT <= 0) this.shield = 0; }

    if (this.dead) { this.updateDead(dt); this.animate(dt); return; }

    // ---------- input ----------
    let mv = controlsOn ? I.moveVector() : { x: 0, y: 0 };
    const camYaw = G.cam.yaw;
    const fwdX = Math.sin(camYaw), fwdZ = Math.cos(camYaw);
    // camera looks along (sin yaw, cos yaw); right vector = (-cos yaw, sin yaw)
    const rightX = -fwdZ, rightZ = fwdX;
    let dx = fwdX * mv.y + rightX * mv.x;
    let dz = fwdZ * mv.y + rightZ * mv.x;
    const mag = Math.min(1, Math.hypot(mv.x, mv.y));
    const wantRun = I.isDown('run') && mag > 0.1 && s.stamina > 1;

    if (controlsOn) {
      if (I.consume('attack')) this.tryAttack();
      if (I.consume('dodge')) this.tryDodge(dx, dz, mag);
      if (I.consume('jump')) this.jumpBuf = 0.16;
      if (this.jumpBuf > 0) { this.jumpBuf -= dt; if (this.tryJump()) this.jumpBuf = 0; }
      for (let i = 0; i < 4; i++) if (I.consume('power' + (i + 1))) G.powers.cast(i);
      if (I.consume('potion')) G.inv.quickPotion();
      if (I.consume('lockon')) this.toggleLock();
    }
    this.blocking = controlsOn && I.isDown('block') && !this.swimming && (this.state === 'normal') && s.stamina > 0;
    if (this.blocking) { this.blockT += dt; } else this.blockT = 0;

    // ---------- horizontal movement ----------
    let speed = 0;
    if (this.state === 'normal') {
      const base = this.swimming ? 3.2 : wantRun ? 8.6 : 5.0;
      speed = base * st.speedMul * mag * (this.blocking ? 0.4 : 1);
      if (wantRun && !this.swimming) { s.stamina = Math.max(0, s.stamina - dt * 14); this.staminaDelay = 0.6; }
      if (mag > 0.05) {
        const targetYaw = Math.atan2(dx, dz);
        if (!this.blocking || !this.lockTarget) this.yaw = dampAngle(this.yaw, targetYaw, 14, dt);
      }
      if (this.lockTarget && this.blocking) this.faceTarget(this.lockTarget, dt, 12);
    } else if (this.state === 'attack') {
      speed = 1.2 * mag;
      this.updateAttack(dt);
    } else if (this.state === 'dodge') {
      const k = this.stateT / 0.45;
      speed = 11 * (1 - k * 0.7);
      dx = Math.sin(this.dodgeYaw); dz = Math.cos(this.dodgeYaw);
      if (this.stateT > 0.45) this.setState('normal');
    } else if (this.state === 'cast') {
      speed = 0.6 * mag;
      if (this.stateT > this.castDur) this.setState('normal');
    } else if (this.state === 'hurt') {
      speed = 0;
      if (this.stateT > 0.32) this.setState('normal');
    } else if (this.state === 'action') {
      if (this.stateT > this.actionDur) this.setState('normal');
    }
    const len = Math.hypot(dx, dz) || 1;
    let mx = 0, mz = 0;
    if (speed > 0) {
      if (this.state === 'dodge') { mx = dx * speed * dt; mz = dz * speed * dt; }
      else if (this.state === 'attack') { mx = Math.sin(this.yaw) * speed * dt; mz = Math.cos(this.yaw) * speed * dt; }
      else { mx = (dx / len) * speed * dt; mz = (dz / len) * speed * dt; }
    }
    // momentum: walking/running accelerates and brakes smoothly (less control in the air)
    if (this.state === 'normal') {
      const wantX = mx / Math.max(dt, 1e-4), wantZ = mz / Math.max(dt, 1e-4);
      const moving = Math.hypot(wantX, wantZ) > 0.1;
      const acc = !this.onGround && !this.swimming ? 4 : moving ? 16 : 22;
      this.hv.x = damp(this.hv.x, wantX, acc, dt);
      this.hv.z = damp(this.hv.z, wantZ, acc, dt);
      mx = this.hv.x * dt; mz = this.hv.z * dt;
    } else if (this.state === 'dodge' || this.state === 'attack') { this.hv.x = mx / Math.max(dt, 1e-4); this.hv.z = mz / Math.max(dt, 1e-4); }
    else { this.hv.x *= 0.8; this.hv.z *= 0.8; }
    // attack lunge
    if (this.state === 'attack' && this.stateT < 0.18) { mx += Math.sin(this.yaw) * 3 * dt; mz += Math.cos(this.yaw) * 3 * dt; }
    if (this.knock) { mx += this.knock.x * dt; mz += this.knock.z * dt; this.knock.multiplyScalar(Math.max(0, 1 - dt * 8)); if (this.knock.lengthSq() < 0.05) this.knock = null; }
    const ox = this.pos.x, oz = this.pos.z;
    G.physics.move(this.pos, mx, mz, this.radius, this.height, !this.onGround);
    const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
    this.speedNow = moved / Math.max(dt, 1e-4);
    G.state.ach.stats.distance += moved;
    G.events?.track('distance', moved);

    // ---------- vertical ----------
    const ground = G.physics.groundAt(this.pos.x, this.pos.z, this.pos.y, this.radius);
    const water = G.physics.waterLevel(this.pos.x, this.pos.z);
    const wasSwim = this.swimming;
    this.swimming = water - ground > 1.25 && this.pos.y < water - 0.9;
    if (this.swimming) {
      const target = water - 1.15;
      this.vy = 0;
      this.pos.y = damp(this.pos.y, target, 8, dt);
      this.onGround = false;
      this.fallStart = this.pos.y;
      if (!wasSwim) { G.audio.sfx('splash'); G.particles.splash(this.pos.x, water, this.pos.z, 16); }
      if (this.speedNow > 1 && Math.random() < dt * 8) G.particles.splash(this.pos.x, water, this.pos.z, 2);
    } else {
      // heavier fall + short hop when the jump button is released early
      const g = this.vy < 0 ? GRAV * 1.3 : (!G.input.isDown('jump') && !G.mobile ? GRAV * 1.8 : GRAV);
      this.vy = Math.max(-38, this.vy - g * dt);
      this.pos.y += this.vy * dt;
      this.airT = this.onGround ? 0 : (this.airT || 0) + dt;
      if (this.pos.y <= ground) {
        if (!this.onGround) this.land(ground);
        this.pos.y = ground; this.vy = 0; this.onGround = true;
      } else if (this.pos.y > ground + 0.05) {
        if (this.onGround && this.pos.y - ground < STEP_UP + 0.1 && this.vy <= 0) { this.pos.y = ground; this.vy = 0; } // step down stairs smoothly
        else { if (this.onGround) this.fallStart = this.pos.y; this.onGround = false; }
      }
      if (this.onGround) { this.fallStart = this.pos.y; this.lastSafe = this.lastSafe || {}; this.lastSafe.x = this.pos.x; this.lastSafe.y = this.pos.y; this.lastSafe.z = this.pos.z; }
      else this.fallStart = Math.max(this.fallStart, this.pos.y);
    }
    if (this.pos.y < -30) this.respawnAt(this.s.respawn.x, this.s.respawn.z);

    // ---------- footsteps / dust / footprints ----------
    if (this.onGround && this.speedNow > 0.6 && this.state !== 'dodge') {
      this.stepAcc += this.speedNow * dt;
      const stride = wantRun ? 1.9 : 1.45;
      if (this.stepAcc > stride) {
        this.stepAcc = 0;
        const surf = this.surface();
        G.audio.sfx('step', { surface: surf, vol: wantRun ? 0.9 : 0.6 });
        if (surf === 'dirt' || (wantRun && surf !== 'wood')) G.particles.dust(this.pos.x, this.pos.y, this.pos.z, wantRun ? 4 : 2, surf === 'dirt' ? 0xb8a07a : 0x9aa070);
        if (surf === 'dirt') this.footprint();
      }
    } else if (this.swimming && this.speedNow > 0.6) {
      this.stepAcc += this.speedNow * dt;
      if (this.stepAcc > 2.2) { this.stepAcc = 0; G.audio.sfx('step', { surface: 'water', vol: 0.6 }); }
    }
    this.updateFootprints(dt);

    // ---------- shield bubble ----------
    this.shieldMesh.visible = this.shield > 0;
    if (this.shield > 0) {
      this.shieldMesh.position.set(this.pos.x, this.visualY + 1, this.pos.z);
      this.shieldMesh.rotation.y += dt;
      this.shieldMesh.material.opacity = 0.18 + Math.sin(G.time * 6) * 0.06;
    }
    if (this.lockTarget && (this.lockTarget.dead || this.lockTarget.pos.distanceTo(this.pos) > 30)) this.lockTarget = null;
    this.animate(dt);
  }

  surface() {
    for (const c of G.physics.query(this.pos.x, this.pos.z, 0.3)) {
      if (c.surface && Math.abs(c.y1 - this.pos.y) < 0.15 && this.pos.x > c.x0 - 0.3 && this.pos.x < c.x1 + 0.3 && this.pos.z > c.z0 - 0.3 && this.pos.z < c.z1 + 0.3) return c.surface;
    }
    if (G.sky.underground) return 'stone';
    return G.world.terrain.surface(this.pos.x, this.pos.z);
  }

  footprint() {
    const g = G.physics.terrainHeight(this.pos.x, this.pos.z);
    if (Math.abs(g - this.pos.y) > 0.1) return;
    let fp = this.footprints.length > 40 ? this.footprints.shift() : null;
    if (!fp) { fp = { m: new THREE.Mesh(this.fpGeo, this.fpMat.clone()), t: 0 }; G.scene.add(fp.m); }
    this.fpSide = -this.fpSide;
    fp.m.position.set(this.pos.x + Math.cos(this.yaw) * 0.15 * this.fpSide, g + 0.02, this.pos.z - Math.sin(this.yaw) * 0.15 * this.fpSide);
    fp.m.rotation.y = this.yaw;
    fp.t = 0;
    fp.m.visible = true;
    this.footprints.push(fp);
  }
  updateFootprints(dt) {
    for (const fp of this.footprints) {
      fp.t += dt;
      fp.m.material.opacity = Math.max(0, 0.35 * (1 - fp.t / 14));
      fp.m.visible = fp.t < 14;
    }
  }

  land(ground) {
    const fall = this.fallStart - ground;
    this.squash = Math.min(0.28, 0.08 + fall * 0.03);
    if (fall > 1.5) { G.audio.sfx('land', { vol: Math.min(1, fall / 6) }); G.particles.dust(this.pos.x, ground, this.pos.z, 8); }
    if (fall > 8) {
      const dmg = Math.floor((fall - 8) * 7);
      this.damage(dmg, null, { fall: true });
    }
  }

  tryJump() {
    if (this.swimming) { this.vy = 6; this.pos.y += 0.3; this.swimming = false; return true; }
    const coyote = !this.onGround && (this.airT || 0) < 0.13 && this.vy <= 0;
    if ((!this.onGround && !coyote) || this.busy()) return false;
    this.vy = 9.6;
    this.onGround = false;
    this.airT = 1;
    this.squash = 0.12;
    G.audio.sfx('jump');
    G.particles.dust(this.pos.x, this.pos.y, this.pos.z, 4);
    return true;
  }

  tryDodge(dx, dz, mag) {
    if (this.busy() && this.state !== 'attack') return;
    if (this.state === 'attack' && this.stateT < 0.15) return;
    if (this.s.stamina < 22 || this.swimming) return;
    this.s.stamina -= 22; this.staminaDelay = 0.8;
    this.dodgeYaw = mag > 0.1 ? Math.atan2(dx, dz) : this.yaw; // standing still: roll forward
    if (mag > 0.1) this.yaw = this.dodgeYaw;
    this.setState('dodge');
    this.invuln = 0.38;
    G.audio.sfx('dodge');
    G.particles.dust(this.pos.x, this.pos.y, this.pos.z, 6);
  }

  // ---------- melee ----------
  attackKinds() {
    const sp = this.sword.special === 'spin';
    return ['attack1', 'attack2', sp ? 'spin' : 'attack3'];
  }
  attackDuration(i) {
    const spd = this.sword.speed * (1 + this.stats.agi * 0.01);
    return [0.48, 0.46, 0.66][i] / spd;
  }
  tryAttack() {
    if (this.swimming) return;
    if (this.state === 'attack') {
      if (this.stateT > this.attackDur * 0.4 && this.combo < 2) this.queued = true;
      return;
    }
    if (this.busy()) return;
    if (this.s.stamina < 4) return;
    this.startAttack(0);
  }
  startAttack(i) {
    this.combo = i;
    this.queued = false;
    this.attackDur = this.attackDuration(i);
    this.setState('attack');
    this.s.stamina = Math.max(0, this.s.stamina - 6); this.staminaDelay = 0.5;
    const target = this.lockTarget || G.combat.nearestEnemy(this.pos, 5, this.yaw, 1.6);
    if (target) this.yaw = Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z);
    G.audio.sfx(i === 2 ? 'swingHeavy' : 'swing');
    const s = this.sword;
    this.trail.setColor(s.glow || 0xffffff);
    this.model.setExpression('fight');
  }
  updateAttack(dt) {
    const p = this.stateT / this.attackDur;
    const kinds = this.attackKinds();
    const kind = kinds[this.combo];
    const hitAt = kind === 'spin' ? 0.3 : kind === 'attack3' ? 0.45 : 0.36;
    if (!this.hitDone && p >= hitAt) {
      this.hitDone = true;
      const s = this.sword;
      const st = this.stats;
      const mult = [1, 1.1, 1.6][this.combo];
      G.combat.playerMelee({
        dmg: s.dmg * st.atkMul * mult,
        reach: swordLength(G.state.inv.equipped.sword) + 1.0 + (kind === 'attack3' ? 0.4 : 0),
        arc: kind === 'spin' ? Math.PI : kind === 'attack3' ? 0.9 : 1.25,
        knock: this.combo === 2 ? 9 : 4,
        effect: s.effect, finisher: this.combo === 2, crit: st.crit, kind,
      });
      if (kind === 'attack3' || kind === 'spin') {
        G.particles.dust(this.pos.x + Math.sin(this.yaw) * 1.6, this.pos.y, this.pos.z + Math.cos(this.yaw) * 1.6, 10);
        if (kind === 'spin') G.particles.ring(this.pos.x, this.pos.y + 1, this.pos.z, s.glow || 0xffffff, 3, 30);
        G.cam.shake(0.25);
      }
    }
    if (this.queued && p > 0.62 && this.combo < 2) { this.startAttack(this.combo + 1); return; }
    if (p >= 1) { this.setState('normal'); this.combo = 0; this.model.setExpression('neutral'); }
  }

  toggleLock() {
    if (this.lockTarget) { this.lockTarget = null; return; }
    this.lockTarget = G.combat.nearestEnemy(this.pos, 25, null);
    if (this.lockTarget) G.audio.sfx('click');
  }
  faceTarget(e, dt, l) {
    const y = Math.atan2(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
    this.yaw = dampAngle(this.yaw, y, l, dt);
  }

  startCast(anim, dur) {
    this.castAnim = anim;
    this.castDur = dur;
    this.setState('cast');
    this.model.setExpression('fight');
    setTimeout(() => { if (this.state !== 'attack') this.model.setExpression('neutral'); }, dur * 1000 + 200);
  }

  // ---------- damage ----------
  damage(amount, src, o = {}) {
    if (this.dead) return 0;
    if (!o.fall && (this.invuln > 0 || this.state === 'dodge')) { if (src) G.ui.damageNumber(this.pos.x, this.pos.y + 2, this.pos.z, t('ui.dodged'), 'miss'); return 0; }
    let dmg = amount;
    // blocking: frontal attacks
    if (!o.fall && this.blocking && src) {
      const a = Math.atan2(src.x - this.pos.x, src.z - this.pos.z);
      if (Math.abs(angleDiff(this.yaw, a)) < 1.3) {
        const perfect = this.blockT < 0.22;
        this.s.stamina = Math.max(0, this.s.stamina - (perfect ? 4 : 14));
        this.staminaDelay = 0.8;
        G.audio.sfx('clang');
        const sp = this.model.swordTip(tmpV, 0.8) || this.pos;
        G.particles.burst(sp.x, sp.y, sp.z, 0xffe8a0, perfect ? 22 : 10, 5, { gravity: 10, size: 0.18 });
        if (perfect) {
          G.ui.damageNumber(this.pos.x, this.pos.y + 2.2, this.pos.z, t('ui.parry'), 'crit');
          if (o.enemy) o.enemy.stagger?.(1.0);
          return 0;
        }
        dmg *= 0.25;
      }
    }
    // shield power absorbs
    if (this.shield > 0) {
      const ab = Math.min(this.shield, dmg);
      this.shield -= ab; dmg -= ab;
      G.audio.sfx('shieldHit');
      if (this.shield <= 0) { this.shieldT = 0; G.particles.burst(this.pos.x, this.pos.y + 1, this.pos.z, 0x7affc8, 30, 6); }
      if (dmg <= 0) return 0;
    }
    if (!o.fall) dmg = dmg * 100 / (100 + this.stats.def * 4);
    dmg = Math.max(1, Math.round(dmg));
    this.s.hp -= dmg;
    this.lastHurt = 0;
    G.audio.sfx('hurt');
    G.ui.damageNumber(this.pos.x, this.pos.y + 2, this.pos.z, dmg, 'player');
    G.ui.hurtFlash();
    G.cam.shake(Math.min(0.6, 0.15 + dmg / 60));
    this.model.setExpression('hurt');
    setTimeout(() => this.model.setExpression('neutral'), 450);
    if (src && !o.noKnock) {
      tmpV2.set(this.pos.x - src.x, 0, this.pos.z - src.z).normalize().multiplyScalar(o.knock || 6);
      this.knock = tmpV2.clone();
    }
    if (this.s.hp <= 0) { this.die(); return dmg; }
    if (this.state !== 'attack' && this.state !== 'cast' && dmg > 4) this.setState('hurt');
    this.invuln = 0.35;
    return dmg;
  }
  heal(n) {
    const st = this.stats;
    const before = this.s.hp;
    this.s.hp = Math.min(st.maxHp, this.s.hp + n);
    const d = Math.round(this.s.hp - before);
    if (d > 0) G.ui.damageNumber(this.pos.x, this.pos.y + 2.2, this.pos.z, '+' + d, 'heal');
    G.particles.burst(this.pos.x, this.pos.y + 1, this.pos.z, 0x7aff8a, 18, 2, { up: 2, gravity: -1, life: 0.9 });
  }

  die() {
    this.s.hp = 0;
    this.setState('dead');
    this.deadT = 0;
    this.lockTarget = null;
    G.audio.sfx('die');
    this.model.setExpression('hurt');
    G.state.ach.stats.deaths++;
    const lost = Math.floor(this.s.gold * 0.1);
    this.s.gold -= lost;
    G.ui.showDefeat(lost);
  }
  updateDead(dt) {
    this.deadT += dt;
    this.vy -= GRAV * dt;
    this.pos.y = Math.max(G.physics.groundAt(this.pos.x, this.pos.z, this.pos.y), this.pos.y + this.vy * dt);
  }
  revive() {
    const r = this.s.respawn;
    this.respawnAt(r.x, r.z);
    this.s.hp = this.stats.maxHp;
    this.s.energy = this.stats.maxEnergy;
    this.setState('normal');
    this.model.setExpression('neutral');
    this.invuln = 2;
    G.sky.underground = false;
    G.game.onTeleport();
  }
  respawnAt(x, z) {
    const y = G.physics.groundAt(x, z, 200);
    this.teleport(x, y + 0.5, z);
  }

  // ---------- animation ----------
  animate(dt) {
    const m = this.model;
    this.visualY = damp(this.visualY, this.pos.y, this.onGround ? 18 : 40, dt);
    if (Math.abs(this.visualY - this.pos.y) > 3) this.visualY = this.pos.y;
    m.root.position.set(this.pos.x, this.visualY, this.pos.z);
    // landing squash & stretch
    this.squash = Math.max(0, (this.squash || 0) - dt * 1.2);
    const k = Math.sin(Math.min(1, this.squash / 0.28) * Math.PI) * this.squash;
    m.root.scale.set(1 + k * 0.6, 1 - k, 1 + k * 0.6);
    m.root.rotation.y = this.yaw;
    let pose = 'idle', phase = 0;
    const armed = true;
    switch (this.state) {
      case 'attack': pose = this.attackKinds()[this.combo]; phase = this.stateT / this.attackDur; break;
      case 'dodge': pose = 'dodge'; phase = Math.min(1, this.stateT / 0.45); break;
      case 'hurt': pose = 'hurt'; break;
      case 'dead': pose = 'defeat'; break;
      case 'cast': pose = this.castAnim; phase = this.stateT / this.castDur; break;
      case 'action': pose = this.action; phase = this.stateT / this.actionDur; break;
      default:
        if (this.swimming) pose = 'swim';
        else if (!this.onGround && Math.abs(this.pos.y - G.physics.groundAt(this.pos.x, this.pos.z, this.pos.y)) > 0.4) pose = this.vy > 0 ? 'jump' : 'fall';
        else if (this.blocking) pose = 'block';
        else if (this.speedNow > 6.5) pose = 'run';
        else if (this.speedNow > 0.4) pose = 'walk';
        else if (G.dialogue?.active && G.dialogue.speaker === 'player') pose = 'talk';
    }
    m.pose(pose, phase, dt, { speed: this.speedNow, armed });
    m.updateFace(dt);
    // sword trail
    const swinging = this.state === 'attack' && (this.stateT / this.attackDur) > 0.18 && (this.stateT / this.attackDur) < 0.7;
    if (swinging && m.sword) {
      const L = swordLength(G.state.inv.equipped.sword) - 0.1;
      const tip = m.swordTip(new THREE.Vector3(), L);
      const base = m.swordTip(new THREE.Vector3(), L * 0.35);
      this.trail.push(base, tip);
      if (this.sword.glow && Math.random() < 0.6) G.particles.trail(tip.x, tip.y, tip.z, this.sword.glow, 0.2, 0.4);
    }
    this.trail.update(dt, swinging);
    // legendary/magic swords emit ambient sparkles
    if (this.sword.glow && m.sword && Math.random() < dt * 6) {
      const tip = m.swordTip(tmpV, Math.random() * swordLength(G.state.inv.equipped.sword));
      G.particles.trail(tip.x, tip.y, tip.z, this.sword.glow, 0.12, 0.6);
    }
  }

  saveToState() {
    const s = this.s;
    s.x = this.pos.x; s.y = this.pos.y; s.z = this.pos.z; s.yaw = this.yaw;
  }
}
