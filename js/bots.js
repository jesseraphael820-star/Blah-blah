// IA dos bots: percepção (visão/audição), combate, cobertura, objetivos e trabalho em equipe.
import * as THREE from '../vendor/three.min.js';
import { WEAPONS } from './data.js';
import { buildCharacter, setCharWeapon } from './models.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => { let d = (a - b) % 6.2832; if (d > Math.PI) d -= 6.2832; if (d < -Math.PI) d += 6.2832; return d; };
const _o = new THREE.Vector3(), _d = new THREE.Vector3();

export class Bot {
  constructor(game, team, name) {
    this.game = game; this.team = team; this.name = name; this.isPlayer = false;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.radius = 0.35; this.height = 1.8; this.onGround = true;
    this.yaw = 0; this.pitch = 0; this.crouch = false; this.hp = 100; this.armor = 0; this.helmet = false; this.kit = false; this.alive = false;
    this.money = 800; this.kills = 0; this.deaths = 0; this.hs = 0; this.score = 0;
    this.weapons = { primary: null, secondary: null, nades: {} }; this.cur = 'secondary'; this.hasBomb = false; this.blindUntil = 0; this.lastShotT = -9;
    this.mesh = buildCharacter(team, team === 'T' ? 'glock' : 'usp'); this.mesh.visible = false; game.scene.add(this.mesh);
    this.thinkT = Math.random() * 0.2; this.animT = Math.random() * 6;
  }
  get diff() { return this.game.diff; }
  get gun() { return this.weapons[this.cur] || this.weapons.secondary; }
  get W() { return WEAPONS[this.gun.id]; }

  setTeam(team) {
    this.team = team; this.game.scene.remove(this.mesh);
    this.mesh = buildCharacter(team, this.gun?.id || (team === 'T' ? 'glock' : 'usp')); this.game.scene.add(this.mesh);
  }
  spawn(sp) {
    { const c = this.game.world.cellPos(this.game.world.nearestFree(sp.x, sp.z)); if (!this.game.world.isFree(sp.x, sp.z)) { sp.x = c.x; sp.z = c.z; } } this.pos.set(sp.x, 0, sp.z); this.vel.set(0, 0, 0); this.yaw = sp.yaw; this.pitch = 0; this.hp = 100; this.alive = true; this.crouch = false; this.blindUntil = 0;
    this.target = null; this.lastSeen = null; this.heard = null; this.goal = null; this.path = null; this.reactT = 0; this.fireT = 0; this.burst = 0; this.pauseT = 0; this.reloadT = 0;
    this.strafeDir = 0; this.strafeT = 0; this.dwell = 0; this.stuckT = 0; this.stuckP = this.pos.clone(); this.actT = 0; this.acting = null; this.coverT = 0; this.nadeCd = rnd(4, 10); this.callT = 0; this.scanT = 0; this.lookYaw = sp.yaw; this.deathT = 0;
    this.mesh.visible = true; this.mesh.rotation.set(0, this.yaw, 0); this.mesh.position.copy(this.pos); this.mesh.scale.set(1, 1, 1);
    this.syncWeaponMesh();
  }
  syncWeaponMesh() { setCharWeapon(this.mesh, this.gun.id); }
  buy(pistolRound) {
    const w = this.weapons, T = this.team === 'T', g = this.game;
    if (!w.secondary) w.secondary = g.newGun(T ? 'glock' : 'usp');
    const pay = (c) => { if (this.money >= c) { this.money -= c; return true; } return false; };
    if (pistolRound) { if (Math.random() < 0.5) { if (pay(650)) this.armor = 100; } else if (Math.random() < 0.6 && pay(300)) w.secondary = g.newGun('p250'); }
    else {
      if (!w.primary) {
        const opts = T ? [['awp', 4750, 0.12], ['ak47', 2700, 1], ['galil', 1800, 1], ['ump45', 1200, 0.6], ['mp5', 1500, 0.8], ['nova', 1050, 0.25]]
          : [['awp', 4750, 0.12], ['m4a4', 3100, 0.55], ['m4a1s', 2900, 1], ['famas', 2050, 1], ['p90', 2350, 0.4], ['mp5', 1500, 0.8], ['nova', 1050, 0.25]];
        for (const [id, c, p] of opts) if (this.money >= c + 300 && Math.random() < p) { pay(c); w.primary = g.newGun(id); break; }
      }
      if ((this.armor < 50 || !this.helmet) && this.money >= 1000 && w.primary) { pay(1000); this.armor = 100; this.helmet = true; }
      else if (this.armor < 50 && pay(650)) this.armor = 100;
      if (w.secondary.id !== 'deagle' && this.money > 2500 && Math.random() < 0.3 && pay(700)) w.secondary = g.newGun('deagle');
    }
    if (!T && !this.kit && this.money >= 400 && Math.random() < 0.5 && pay(400)) this.kit = true;
    if (this.diff.nade > 0 && Math.random() < this.diff.nade + 0.2) { const t = ['he', 'flash', 'smoke', 'fire'][(Math.random() * 4) | 0], c = { he: 300, flash: 200, smoke: 300, fire: 500 }[t]; if (!w.nades[t] && pay(c)) w.nades[t] = 1; }
    for (const s of ['primary', 'secondary']) if (w[s]) { w[s].ammo = WEAPONS[w[s].id].mag; w[s].reserve = WEAPONS[w[s].id].reserve; }
    this.cur = w.primary ? 'primary' : 'secondary'; this.syncWeaponMesh();
  }

  eyeY() { return this.pos.y + (this.crouch ? 1.12 : 1.58); }
  canSee(c) {
    const g = this.game, dx = c.pos.x - this.pos.x, dz = c.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d > 85 || g.time < this.blindUntil) return false;
    const dot = (dx * -Math.sin(this.yaw) + dz * -Math.cos(this.yaw)) / (d || 1);
    if (d > 3.5 && dot < 0.38 && c !== this.target) return false;
    const ey = this.eyeY(), W = g.world;
    return W.los(this.pos.x, ey, this.pos.z, c.pos.x, c.pos.y + (c.crouch ? 0.8 : 1.2), c.pos.z) || W.los(this.pos.x, ey, this.pos.z, c.pos.x, c.pos.y + (c.crouch ? 1.12 : 1.6), c.pos.z);
  }
  hear(x, z) { if (!this.target && this.alive) { this.heard = { x, z, t: this.game.time }; } }
  onDamaged(att) {
    if (att && att !== this && att.alive && !this.target) { this.lastSeen = { x: att.pos.x, z: att.pos.z, t: this.game.time }; this.lookYaw = Math.atan2(-(att.pos.x - this.pos.x), -(att.pos.z - this.pos.z)); this.scanT = 1.5; this.goal = null; }
    this.acting = null; this.actT = 0;
  }

  think() {
    const g = this.game, now = g.time;
    // percepção
    let best = null, bd = 1e9;
    for (const c of g.all) {
      if (!c.alive || c.team === this.team) continue;
      if (this.canSee(c)) { const d = this.pos.distanceToSquared(c.pos); if (d < bd) { bd = d; best = c; } }
    }
    if (best) {
      if (this.target !== best) { this.reactT = this.diff.react * rnd(0.7, 1.3) * (this.target ? 0.5 : 1); this.burst = Math.round(rnd(...this.diff.burst)); }
      this.target = best; this.lastSeen = { x: best.pos.x, z: best.pos.z, t: now }; this.heard = null;
      if (now > this.callT) { // avisa aliados próximos
        this.callT = now + 2;
        for (const m of g.bots) if (m !== this && m.alive && m.team === this.team && !m.target && !m.acting && m.pos.distanceTo(this.pos) < 30 && Math.random() < 0.6) m.heard = { x: best.pos.x, z: best.pos.z, t: now };
      }
    } else if (this.target) {
      this.target = null;
      if (this.lastSeen && this.nadeCd <= 0 && Math.random() < this.diff.nade) this.tryNade();
    }
    if (this.target) { this.acting = null; this.actT = 0; return; }
    if (this.acting) return;
    this.decideGoal();
  }
  setGoal(x, z, kind) {
    if (this.goal && this.goal.kind === kind && Math.hypot(this.goal.x - x, this.goal.z - z) < 1.5 && this.path) return;
    this.goal = { x, z, kind }; this.path = this.game.world.findPath(this.pos.x, this.pos.z, x, z); this.pi = 0;
    if (!this.path) this.goal = null;
  }
  decideGoal() {
    const g = this.game, W = g.world, now = g.time, b = g.bomb, T = this.team === 'T', here = this.pos;
    const fire = g.nades.inFire(here.x, here.z);
    if (fire) { const p = W.pointNear(here.x + (here.x - fire.x) * 3, here.z + (here.z - fire.z) * 3, 3); return this.setGoal(p.x, p.z, 'flee'); }
    if (g.phase !== 'live') return;
    if (g.training) { if (this.lastSeen && now - this.lastSeen.t < 6) return this.setGoal(this.lastSeen.x, this.lastSeen.z, 'hunt'); if (this.heard && now - this.heard.t < 6) return this.setGoal(this.heard.x, this.heard.z, 'inv'); return this.roam(); }
    if (b.state === 'planted') {
      const d = Math.hypot(here.x - b.pos.x, here.z - b.pos.z);
      if (!T) {
        if (d < 1.4 && here.y < 0.5) { if (!b.defuser) { this.acting = 'defuse'; this.actT = 0; b.defuser = this; this.path = null; } else if (b.defuser !== this) this.guard(b.pos.x, b.pos.z, 5); return; }
        return this.setGoal(b.pos.x, b.pos.z, 'defuse');
      }
      if (this.lastSeen && now - this.lastSeen.t < 4) return this.setGoal(this.lastSeen.x, this.lastSeen.z, 'hunt');
      return this.guard(b.pos.x, b.pos.z, 9);
    }
    if (T && this.hasBomb) {
      const s = W.sites[g.tSite];
      if (Math.hypot(here.x - s.x, here.z - s.z) < s.r - 1.2 && here.y < 0.1) { this.acting = 'plant'; this.actT = 0; this.path = null; return; }
      return this.setGoal(s.x + this.off.x * 0.4, s.z + this.off.z * 0.4, 'plant');
    }
    if (T && b.state === 'dropped') {
      const mates = g.bots.filter(m => m.alive && m.team === 'T');
      const near = mates.reduce((a, m) => (!a || m.pos.distanceToSquared(b.pos) < a.pos.distanceToSquared(b.pos) ? m : a), null);
      if (near === this) return this.setGoal(b.pos.x, b.pos.z, 'pickup');
    }
    if (this.lastSeen && now - this.lastSeen.t < 5) return this.setGoal(this.lastSeen.x, this.lastSeen.z, 'hunt');
    if (this.heard && now - this.heard.t < 5 && (T || Math.hypot(this.heard.x - here.x, this.heard.z - here.z) < 22)) return this.setGoal(this.heard.x, this.heard.z, 'inv');
    if (T) { const s = W.sites[g.tSite]; if (Math.hypot(here.x - s.x, here.z - s.z) > 9) return this.setGoal(s.x + this.off.x, s.z + this.off.z, 'site'); return this.guard(s.x, s.z, 8); }
    // CT: defende o bomb site designado; sem inimigos por muito tempo, alguns rotacionam
    const s = W.sites[this.site];
    if (b.state === 'dropped' && Math.random() < 0.02) return this.setGoal(b.pos.x, b.pos.z, 'inv');
    this.guard(s.x, s.z, 8);
  }
  guard(x, z, r) {
    if (this.goal?.kind === 'guard' && this.path) return;
    if (this.goal?.kind === 'guard' && this.dwell > 0) return;
    const p = this.game.world.pointNear(x, z, r); this.setGoal(p.x, p.z, 'guard'); this.dwell = rnd(3, 7);
  }
  roam() { if (this.path) return; if (this.dwell > 0) return; const p = this.game.world.randomPoint(); this.setGoal(p.x, p.z, 'roam'); this.dwell = rnd(0.5, 2); }
  tryNade() {
    const ns = this.weapons.nades, type = Object.keys(ns).find(k => ns[k] > 0); if (!type) return;
    const dx = this.lastSeen.x - this.pos.x, dz = this.lastSeen.z - this.pos.z, d = Math.hypot(dx, dz); if (d < 7 || d > 28) return;
    ns[type]--; this.nadeCd = rnd(8, 16);
    _o.set(this.pos.x, this.eyeY(), this.pos.z); _d.set(dx / d, 0.28 + d * 0.012, dz / d).normalize();
    this.game.nades.throw(this, type, _o.clone(), _d.clone(), Math.min(22, 9 + d * 0.55));
  }

  update(dt) {
    const g = this.game;
    if (!this.alive) { if (this.deathT < 0.5) { this.deathT += dt; this.mesh.rotation.x = -Math.min(1, this.deathT / 0.45) * 1.5; this.mesh.position.y = this.pos.y + Math.min(1, this.deathT / 0.45) * 0.12; } return; }
    this.thinkT -= dt; this.nadeCd -= dt; this.fireT -= dt; this.scanT -= dt;
    if (this.thinkT <= 0) { this.thinkT = rnd(0.1, 0.18); this.think(); }
    const frozen = g.phase === 'freeze';
    let wx = 0, wz = 0, speed = 4.7 * (this.W.speed || 1), wantYaw = null, wantPitch = 0;

    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { const gun = this.gun, n = Math.min(this.W.mag - gun.ammo, gun.reserve); gun.ammo += n; gun.reserve -= n; if (gun.reserve < this.W.mag) gun.reserve = this.W.reserve; } }
    else if (this.gun.ammo <= 0) this.reloadT = this.W.reload;

    const t = this.target;
    if (t && t.alive) {
      const dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z, d = Math.hypot(dx, dz), W = this.W;
      const headshot = this.diff.err < 3 ? 0.5 : 0.15, ty = t.pos.y + (t.crouch ? 0.75 : 1.15) + (this.aimHead ? (t.crouch ? 0.35 : 0.42) : 0);
      wantYaw = Math.atan2(-dx, -dz); wantPitch = Math.atan2(ty - this.eyeY(), d);
      this.reactT -= dt;
      const err = Math.abs(angDiff(wantYaw, this.yaw));
      if (!frozen && this.reactT <= 0 && this.reloadT <= 0 && this.pauseT <= 0 && this.fireT <= 0 && err < (d < 6 ? 0.3 : 0.09)) {
        const tv = Math.hypot(t.vel.x, t.vel.z), mv = Math.hypot(this.vel.x, this.vel.z);
        const e = this.diff.err * (1 + tv * 0.12 + mv * 0.1) * (W.type === 'sniper' ? 0.45 : 1) * (this.crouch ? 0.8 : 1) * 0.01745;
        const yaw = this.yaw + (Math.random() + Math.random() - 1) * e, pit = this.pitch + (Math.random() + Math.random() - 1) * e;
        _o.set(this.pos.x, this.eyeY(), this.pos.z);
        for (let p = 0; p < (W.pellets || 1); p++) {
          const sy = yaw + (W.pellets ? (Math.random() - 0.5) * 0.09 : 0), sp = pit + (W.pellets ? (Math.random() - 0.5) * 0.09 : 0);
          _d.set(-Math.sin(sy) * Math.cos(sp), Math.sin(sp), -Math.cos(sy) * Math.cos(sp));
          g.fireBullet(this, _o, _d, W, this.gun.id, p === 0);
        }
        this.gun.ammo--; this.fireT = 60 / W.rpm * (W.auto ? 1 : rnd(1.3, 2.2)); this.lastShotT = g.time;
        g.sound3d('shot', this.pos, 1, W.sup ? 28 : 75, W.snd, W.sup); g.emitSound(this.pos.x, this.pos.z, W.sup ? 14 : 45, this.team);
        if (--this.burst <= 0) { this.burst = Math.round(rnd(...this.diff.burst)); this.pauseT = rnd(...this.diff.pause); this.aimHead = Math.random() < headshot; }
      }
      this.pauseT -= dt;
      // movimentação de combate
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeT = rnd(0.5, 1.4); this.strafeDir = Math.random() < this.diff.strafe ? (Math.random() < 0.5 ? -1 : 1) : 0; this.crouch = this.strafeDir === 0 && d > 8 && Math.random() < 0.35; }
      const needCover = (this.reloadT > 0 || this.hp < 30) && this.coverT <= 0;
      if (needCover) { const c = g.world.coverFrom(this.pos, t.pos, 7); this.coverT = 3; if (c) { this.path = g.world.findPath(this.pos.x, this.pos.z, c.x, c.z); this.pi = 0; this.goal = { x: c.x, z: c.z, kind: 'cover' }; } }
      this.coverT -= dt;
      if (this.goal?.kind === 'cover' && this.path) { /* segue caminho abaixo */ }
      else {
        this.path = null; this.goal = null;
        const far = d > (W.type === 'shotgun' ? 9 : W.type === 'sniper' ? 60 : 28), close = d < 4;
        const fx = dx / (d || 1), fz = dz / (d || 1);
        if (far) { wx = fx; wz = fz; } else if (close) { wx = -fx * 0.6; wz = -fz * 0.6; }
        wx += -fz * this.strafeDir * 0.8; wz += fx * this.strafeDir * 0.8; speed *= far ? 1 : 0.6;
      }
    } else { this.crouch = !!this.acting; }

    // ações: plantar / desarmar
    if (this.acting && !frozen) {
      this.actT += dt; const b = g.bomb;
      if (this.acting === 'plant') { if (!this.hasBomb || g.phase !== 'live') this.acting = null; else if (this.actT >= 3.2) { g.plantBomb(this); this.acting = null; } }
      else if (this.acting === 'defuse') { if (b.state !== 'planted') { this.acting = null; } else { b.defuseT = this.actT; b.defuseNeed = this.kit ? 5 : 10; if (this.actT >= b.defuseNeed) { g.defuseBomb(this); this.acting = null; } } }
      if (!this.acting && b.defuser === this) { b.defuser = null; b.defuseT = 0; }
    }
    // seguir caminho
    if (this.path && !this.acting) {
      const p = this.path[this.pi], dx = p.x - this.pos.x, dz = p.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.55) { if (++this.pi >= this.path.length) { this.path = null; if (this.goal?.kind === 'hunt' || this.goal?.kind === 'inv') { this.lastSeen = null; this.heard = null; this.scanT = 0; } if (this.goal?.kind === 'cover') this.goal = null; } }
      else { wx = dx / d; wz = dz / d; if (!t) wantYaw = Math.atan2(-dx, -dz); }
      if (this.goal?.kind === 'pickup' || this.goal?.kind === 'defuse') { /* corre */ } else if (!t && this.goal?.kind === 'guard') speed *= 0.75;
    } else if (!t && !this.acting) {
      this.dwell -= dt;
      if (this.scanT <= 0) { this.scanT = rnd(1.5, 3.5); const p = g.world.pointNear(this.pos.x, this.pos.z, 18); this.lookYaw = Math.atan2(-(p.x - this.pos.x), -(p.z - this.pos.z)); }
      wantYaw = this.lookYaw;
    }
    if (!t && this.scanT > 0 && !this.path) wantYaw = this.lookYaw;
    if (frozen || this.acting) { wx = wz = 0; }

    // separação entre personagens
    for (const c of g.all) { if (c === this || !c.alive) continue; const dx = this.pos.x - c.pos.x, dz = this.pos.z - c.pos.z, d2 = dx * dx + dz * dz; if (d2 < 0.8 && d2 > 1e-4) { const d = Math.sqrt(d2); wx += dx / d * 0.9; wz += dz / d * 0.9; } }
    const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
    if (this.crouch) speed *= 0.45;
    const k = Math.min(1, 10 * dt); this.vel.x += (wx * speed - this.vel.x) * k; this.vel.z += (wz * speed - this.vel.z) * k;
    this.height = this.crouch ? 1.3 : 1.8;
    g.world.move(this, dt);
    // travado? recalcula
    this.stuckT += dt;
    if (this.stuckT > 1.2) { if (wl > 0.3 && this.stuckP.distanceTo(this.pos) < 0.35) { if (this.goal && this.goal.kind !== 'cover') { this.path = g.world.findPath(this.pos.x, this.pos.z, this.goal.x, this.goal.z); this.pi = 0; } else { this.path = null; this.goal = null; } if (this.onGround) this.vel.y = 5.2; } this.stuckT = 0; this.stuckP.copy(this.pos); }
    // bomba no chão
    if (this.team === 'T' && g.bomb.state === 'dropped' && Math.hypot(this.pos.x - g.bomb.pos.x, this.pos.z - g.bomb.pos.z) < 1.1) g.pickupBomb(this);

    if (wantYaw !== null) { const d = angDiff(wantYaw, this.yaw), max = this.diff.turn * dt * (t ? 1 : 0.7); this.yaw += Math.abs(d) < max ? d : Math.sign(d) * max; }
    this.pitch += (wantPitch - this.pitch) * Math.min(1, 8 * dt);

    // visual
    const m = this.mesh, u = m.userData, sp = Math.hypot(this.vel.x, this.vel.z);
    m.position.copy(this.pos); m.rotation.set(0, this.yaw, 0);
    this.animT += dt * (2 + sp * 2.2); const sw = Math.sin(this.animT) * Math.min(1, sp / 3) * 0.7;
    if (this.crouch) { u.legL.rotation.x = -1.2; u.legR.rotation.x = 0.5; u.body.position.y = -0.42; u.legL.position.y = u.legR.position.y = 0.5; }
    else { u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.body.position.y = Math.abs(Math.cos(this.animT)) * 0.03 * Math.min(1, sp / 3); u.legL.position.y = u.legR.position.y = 0.86; }
    u.body.rotation.x = this.pitch * 0.5; u.head.rotation.x = this.pitch * 0.4;
  }
  die() {
    this.alive = false; this.deathT = 0; this.target = null; this.acting = null; this.path = null;
    if (this.game.bomb.defuser === this) { this.game.bomb.defuser = null; this.game.bomb.defuseT = 0; }
  }
}
