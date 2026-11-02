// Pedestrians, cops on foot, gang members and story characters.
import * as THREE from 'three';
import { Human } from './human.js';
import { clamp, damp, dampAngle, angleDiff } from './util.js';
import { N, CELL, ORIGIN } from './world.js';

const CORNER_X = [0, 1, 1, 0], CORNER_Z = [0, 0, 1, 1];
// crossings from each corner: [di, dj, targetCorner]
const CROSS = [
  [[-1, 0, 1], [0, -1, 3]],
  [[1, 0, 0], [0, -1, 2]],
  [[1, 0, 3], [0, 1, 1]],
  [[-1, 0, 2], [0, 1, 0]],
];

export const LOOKS = {
  cop: () => ({ shirt: 0x2b4a7e, pants: 0x14213d, hat: 'cap', hatColor: 0x14213d, badge: true, vest: 0x1d2633, longSleeve: true, bulk: 1.08 }),
  thug: () => ({ shirt: Math.random() < 0.5 ? 0x5a1f8a : 0x2a2a2a, pants: 0x1a1a1a, hat: 'bandana', hatColor: 0x6a1fb0, bulk: 1.1 }),
};

export class NPC {
  constructor(game, kind, look = {}, pos) {
    this.game = game; this.kind = kind;
    this.human = new Human(look);
    game.scene.add(this.human.root);
    this.pos = pos.clone(); this.pos.y = game.world.groundHeight(pos.x, pos.z);
    this.heading = Math.random() * Math.PI * 2;
    this.vel = new THREE.Vector3();
    this.knock = new THREE.Vector3();
    this.speed = 0;
    this.health = kind === 'cop' ? 110 : kind === 'thug' ? 90 : kind === 'story' ? 9999 : 45;
    this.state = kind === 'story' ? 'idle' : 'walk';
    this.walkSpeed = 1.2 + Math.random() * 0.5;
    this.timer = 0; this.attackCd = 1 + Math.random(); this.hasGun = false;
    this.deadT = 0; this.downT = 0; this.cower = false;
    this.threat = null;
    this.name = '';
    this.voice = { pitch: 1, rate: 1, gender: 'm' };
    if (kind !== 'story') this.pickCorner();
  }
  get alive() { return this.state !== 'dead'; }
  remove() { this.game.scene.remove(this.human.root); this.removed = true; }

  blockIdx() {
    return [clamp(Math.floor((this.pos.x - ORIGIN) / CELL), 0, N - 1), clamp(Math.floor((this.pos.z - ORIGIN) / CELL), 0, N - 1)];
  }
  cornerPos(i, j, c) {
    const b = this.game.world.blocks[i][j];
    return new THREE.Vector3(CORNER_X[c] ? b.x1 - 2 : b.x0 + 2, 0, CORNER_Z[c] ? b.z1 - 2 : b.z0 + 2);
  }
  pickCorner() {
    const [i, j] = this.blockIdx();
    let best = 0, bd = 1e9;
    for (let c = 0; c < 4; c++) { const p = this.cornerPos(i, j, c); const d = p.distanceToSquared(this.pos); if (d < bd) { bd = d; best = c; } }
    this.bi = i; this.bj = j; this.corner = best;
    this.target = this.cornerPos(i, j, best);
  }
  nextCorner() {
    if (Math.random() < 0.22) {
      const opts = CROSS[this.corner].filter(([di, dj]) => this.bi + di >= 0 && this.bi + di < N && this.bj + dj >= 0 && this.bj + dj < N);
      if (opts.length) {
        const [di, dj, tc] = opts[Math.floor(Math.random() * opts.length)];
        this.bi += di; this.bj += dj; this.corner = tc;
        this.target = this.cornerPos(this.bi, this.bj, tc); return;
      }
    }
    this.corner = (this.corner + (Math.random() < 0.5 ? 1 : 3)) % 4;
    this.target = this.cornerPos(this.bi, this.bj, this.corner);
  }

  hurt(dmg, from, cause = 'hit') {
    if (!this.alive || this.kind === 'story') return;
    this.health -= dmg;
    this.game.fx.blood(this.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), cause === 'car' ? 10 : 5);
    const byPlayer = from === this.game.player;
    if (this.health <= 0) {
      this.state = 'dead'; this.deadT = 0; this.human.showGun(false);
      if (byPlayer) this.game.onKill(this);
      return;
    }
    if (byPlayer) {
      this.game.onAssault(this);
      if (this.kind === 'ped') {
        if (Math.random() < 0.25 && cause === 'hit') { this.state = 'fight'; this.threat = from; }
        else { this.state = 'flee'; this.threat = from; this.timer = 8 + Math.random() * 6; }
      }
      if (this.kind === 'thug') { this.state = 'fight'; this.threat = from; }
    }
    if (cause === 'car') { this.downT = 2.2; }
  }

  scare(from, t = 8) {
    if (this.kind !== 'ped' || !this.alive || this.state === 'fight') return;
    this.state = 'flee'; this.threat = from; this.timer = t + Math.random() * 4;
    if (Math.random() < 0.15) this.cower = true;
  }

  update(dt) {
    const g = this.game, w = g.world, P = g.player;
    let moveX = 0, moveZ = 0, spd = 0;
    const ppos = P.vehicle ? P.vehicle.pos : P.pos;
    this.attackCd -= dt;
    if (this.state === 'dead') {
      this.deadT += dt;
      this.human.update(dt, { dead: true });
      this.knock.multiplyScalar(Math.exp(-4 * dt));
      this.pos.addScaledVector(this.knock, dt);
      this.sync();
      return;
    }
    if (this.downT > 0) {
      this.downT -= dt;
      this.knock.multiplyScalar(Math.exp(-3 * dt));
      this.pos.addScaledVector(this.knock, dt);
      w.collideCircle(this.pos, 0.35);
      this.human.update(dt, { dead: true });
      this.sync();
      if (this.downT <= 0 && this.kind === 'ped') { this.state = 'flee'; this.threat = P; this.timer = 10; }
      return;
    }
    const toP = new THREE.Vector3(ppos.x - this.pos.x, 0, ppos.z - this.pos.z);
    const dP = toP.length();
    let face = null;
    switch (this.state) {
      case 'idle': {
        if (dP < 8) face = Math.atan2(toP.x, toP.z);
        break;
      }
      case 'walk': {
        const d = new THREE.Vector3(this.target.x - this.pos.x, 0, this.target.z - this.pos.z);
        if (d.length() < 0.8) this.nextCorner();
        else { d.normalize(); moveX = d.x; moveZ = d.z; spd = this.walkSpeed; }
        if (this.kind === 'cop' && g.wanted > 0) this.state = 'chase';
        break;
      }
      case 'flee': {
        this.timer -= dt;
        if (this.timer <= 0) { this.state = 'walk'; this.cower = false; this.pickCorner(); break; }
        const tpos = this.threat && this.threat.pos ? (this.threat.vehicle ? this.threat.vehicle.pos : this.threat.pos) : ppos;
        const away = new THREE.Vector3(this.pos.x - tpos.x, 0, this.pos.z - tpos.z);
        if (this.cower && away.length() < 12) { spd = 0; break; }
        this.cower = false;
        away.normalize();
        // wobble to avoid sticking to walls
        const a = Math.sin(performance.now() / 700 + this.pos.x) * 0.5;
        moveX = away.x * Math.cos(a) - away.z * Math.sin(a); moveZ = away.x * Math.sin(a) + away.z * Math.cos(a);
        spd = 5.8;
        break;
      }
      case 'fight': {
        if (!P.alive) { this.state = 'walk'; this.pickCorner(); break; }
        face = Math.atan2(toP.x, toP.z);
        if (this.hasGun) {
          if (dP > 16) { moveX = toP.x / dP; moveZ = toP.z / dP; spd = 4.5; }
          else if (dP < 7) { moveX = -toP.x / dP; moveZ = -toP.z / dP; spd = 2; }
          if (this.attackCd <= 0 && dP < 30) { this.attackCd = 1.1 + Math.random() * 0.8; g.npcShoot(this, 0.33, 6); }
        } else if (dP > 1.15) { moveX = toP.x / dP; moveZ = toP.z / dP; spd = dP > 4 ? 5.5 : 3; }
        else if (this.attackCd <= 0) { this.attackCd = 0.9 + Math.random() * 0.5; this.human.punch(); g.npcMelee(this, 6 + Math.random() * 5); }
        if (this.kind === 'ped' && dP > 40) { this.state = 'walk'; this.pickCorner(); }
        break;
      }
      case 'chase': {
        if (g.wanted === 0) { this.state = 'leave'; this.timer = 0; break; }
        face = Math.atan2(toP.x, toP.z);
        const armed = g.wanted >= 2;
        this.human.showGun(armed);
        if (armed && dP < 24 && this.attackCd <= 0 && !P.vehicle) {
          this.attackCd = 1.3 + Math.random();
          g.npcShoot(this, 0.28 + g.wanted * 0.04, 5 + g.wanted);
        } else if (armed && P.vehicle && dP < 26 && this.attackCd <= 0) {
          this.attackCd = 1.2 + Math.random(); g.npcShoot(this, 0.45, 0, P.vehicle);
        }
        const keep = armed && !P.vehicle ? 6 : 1.0;
        if (dP > keep) { moveX = toP.x / dP; moveZ = toP.z / dP; spd = dP > 5 ? 6.2 : 3; }
        else if (!armed && this.attackCd <= 0 && !P.vehicle && g.wanted >= 2) { this.attackCd = 1; this.human.punch(); g.npcMelee(this, 5); }
        if (!armed && dP < 1.5 && !P.vehicle) g.bustProgress += dt;
        break;
      }
      case 'leave': {
        this.human.showGun(false);
        if (g.wanted > 0) { this.state = 'chase'; break; }
        if (!this.target) this.pickCorner();
        const d = new THREE.Vector3(this.target.x - this.pos.x, 0, this.target.z - this.pos.z);
        if (d.length() < 0.8) this.nextCorner(); else { d.normalize(); moveX = d.x; moveZ = d.z; spd = 1.5; }
        break;
      }
    }
    // integrate
    const tvx = moveX * spd, tvz = moveZ * spd;
    this.vel.x = damp(this.vel.x, tvx, 8, dt); this.vel.z = damp(this.vel.z, tvz, 8, dt);
    this.knock.multiplyScalar(Math.exp(-6 * dt));
    this.pos.x += (this.vel.x + this.knock.x) * dt; this.pos.z += (this.vel.z + this.knock.z) * dt;
    w.collideCircle(this.pos, 0.35);
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (face !== null) this.heading = dampAngle(this.heading, face, 8, dt);
    else if (this.speed > 0.3) this.heading = dampAngle(this.heading, Math.atan2(this.vel.x, this.vel.z), 8, dt);
    this.pos.y = damp(this.pos.y, w.groundHeight(this.pos.x, this.pos.z), 20, dt);
    let lookYaw = 0;
    if (dP < 10 && this.state !== 'flee') lookYaw = angleDiff(this.heading, Math.atan2(toP.x, toP.z));
    if (this.lookAt) lookYaw = angleDiff(this.heading, Math.atan2(this.lookAt.x - this.pos.x, this.lookAt.z - this.pos.z));
    this.human.update(dt, { speed: this.speed, grounded: true, aim: this.human.gun.visible && (this.state === 'chase' || this.state === 'fight'), cower: this.cower, lookYaw });
    this.sync();
  }
  sync() {
    this.human.root.position.copy(this.pos);
    this.human.root.rotation.y = this.heading;
  }
}
