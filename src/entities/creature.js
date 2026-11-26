// Animais (selvagens e domésticos), cavalos, pássaros, peixes, projéteis e itens no chão.
import { Entity } from './actor.js';
import { G, hostile } from '../state.js';
import { dist, dirFromVec, clamp, TILE } from '../core/util.js';
import { animalFrames, birdFrames, fishFrame, batFrames, spiderFrames, horseFrames } from '../gfx/animals.js';
import { charSheet, FW, FH, ANIMS, weaponSprite } from '../gfx/chars.js';
import { CREATURES } from '../data/enemies.js';
import { audio } from '../core/audio.js';
import { emit } from '../core/events.js';
import { TILE_INFO } from '../gfx/tiles.js';
import { itemIcon } from '../gfx/icons.js';
import { emoteSprite } from '../gfx/icons.js';

export class Creature extends Entity {
  constructor(x, y, kind, o = {}) {
    super(x, y);
    this.kind = kind; const D = CREATURES[kind]; this.D = D;
    this.special = D.special;
    this.frames = D.special === 'bat' ? batFrames() : D.special === 'spider' ? spiderFrames() : animalFrames(kind);
    this.maxHp = D.hp * (o.hpMul || 1); this.hp = this.maxHp; this.speed = D.speed; this.behavior = D.behavior;
    this.team = D.behavior === 'hostile' ? 'W' : 'N'; this.huntable = D.behavior !== 'domestic';
    this.w = Math.min(16, (this.frames.w || 14) * 0.6); this.h = 6; this.radius = (this.frames.w || 14) / 2;
    this.home = { x, y }; this.state = 'idle'; this.stateT = 0; this.animT = Math.random() * 3; this.facing = Math.random() < 0.5 ? -1 : 1;
    this.cool = 1; this.hitFlash = 0; this.kx = 0; this.ky = 0; this.target = null; this.tag = o.tag || null; this.boss = !!D.boss;
    this.alpha = 1; this.deadT = 0; this.warnT = 0; this.wanderTo = null; this.wanderT = Math.random() * 3; this.hpBarT = 0;
    this.blood = kind === 'spider' ? '#5aa040' : '#a01818'; this.owner = o.owner || null; this.persistent = !!o.persistent;
    if (o.hostile) this.team = 'W';
  }
  blockedByWater(x, y) { const t = this.map.tileAtPx(x, y); if (this.D.swims || this.D.flying) return false; return TILE_INFO[t].water; }
  tryMove(dx, dy) { if (this.D.flying) { this.x += dx; this.y += dy; return true; } return super.tryMove(dx, dy); }
  takeDamage(amount, src, knock = 40, ranged) {
    if (this.state === 'dead') return false;
    this.hp -= amount; this.hitFlash = 0.14; this.hpBarT = 3;
    if (G.settings.showDamage) G.particles.text(this.x, this.y - this.frames.h - 4, String(Math.round(amount)), '#ffffff');
    G.particles.burst(this.x, this.y - 6, 5, this.blood, 60, 0.4);
    audio.sfx('hit', this);
    if (src) { const a = Math.atan2(this.y - src.y, this.x - src.x); this.kx += Math.cos(a) * knock; this.ky += Math.sin(a) * knock; }
    if (this.hp <= 0) { this.die(src); return true; }
    if (this.behavior === 'flee' || this.behavior === 'domestic') { this.fleeFrom = src; this.fleeT = 3; }
    else { this.target = src; this.provokedBy = src; if (this.D.pack) this.alertPack(src); }
    return true;
  }
  alertPack(src) { for (const e of G.entities) if (e !== this && e.kind === this.kind && e.mapId === this.mapId && !e.dead && dist(e.x, e.y, this.x, this.y) < 140) { e.target = src; e.provokedBy = src; } }
  die(src) {
    this.state = 'dead'; this.dead = true; this.stateT = 0;
    audio.sfx(this.D.sfx === 'growl' ? 'growl' : 'squeak', this, 0.6);
    emit('death', this, src);
  }
  update(dt) {
    this.animT += dt; this.stateT += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.hpBarT > 0) this.hpBarT -= dt;
    if (this.state === 'dead') { this.deadT += dt; if (this.deadT > 5) { this.alpha -= dt; if (this.alpha <= 0) this.removed = true; } return; }
    if (Math.abs(this.kx) > 1 || Math.abs(this.ky) > 1) { this.tryMove(this.kx * dt, this.ky * dt); this.kx *= Math.pow(0.001, dt); this.ky *= Math.pow(0.001, dt); }
    this.moving = false;
    const p = G.player;
    if (this.state === 'bite') {
      if (!this.bitten && this.stateT > 0.15) {
        this.bitten = true;
        const t = this.target;
        if (t && !t.dead && dist(this.x, this.y, t.x, t.y) < this.radius + 14) t.takeDamage(this.D.dmg, this, 50);
      }
      if (this.stateT > 0.45) this.state = 'idle';
      return;
    }
    if (this.state === 'lunge') {
      const sp = 150; this.tryMove(Math.cos(this.lungeA) * sp * dt, Math.sin(this.lungeA) * sp * dt);
      if (this.stateT > 0.22) { this.state = 'bite'; this.stateT = 0; this.bitten = false; }
      return;
    }
    if (this.fleeT > 0 || (this.behavior === 'flee' && p && p.mapId === this.mapId && dist(p.x, p.y, this.x, this.y) < (p.running ? 90 : 46))) {
      this.fleeT = Math.max(0, (this.fleeT || 1.5) - dt);
      const src = this.fleeFrom && !this.fleeFrom.dead ? this.fleeFrom : p;
      const a = Math.atan2(this.y - src.y, this.x - src.x) + Math.sin(this.animT * 2) * 0.4;
      const ok = this.tryMove(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt);
      if (!ok) this.tryMove(Math.cos(a + 1.4) * this.speed * dt, Math.sin(a + 1.4) * this.speed * dt);
      this.facing = Math.cos(a) < 0 ? -1 : 1; this.moving = true;
      return;
    }
    if (this.behavior === 'hostile' || this.behavior === 'territorial') {
      if (!this.target && p && p.mapId === this.mapId && !p.dead && G.mode !== 'cutscene') {
        const d = dist(p.x, p.y, this.x, this.y);
        if (this.behavior === 'hostile' && d < this.D.aggro) { this.target = p; if (this.D.pack) this.alertPack(p); if (this.D.sfx) audio.sfx(this.D.sfx, this, 0.7); }
        else if (this.behavior === 'territorial' && d < this.D.aggro) { this.warnT += dt; if (this.warnT > 0.05 && !this.warned) { this.warned = true; audio.sfx('growl', this); this.emote = '!'; this.emoteT = 1.2; } if (this.warnT > 1.4) { this.target = p; this.provokedBy = p; } }
        else this.warnT = Math.max(0, this.warnT - dt);
      }
      // também caça aliados/inimigos se provocado
      const t = this.target;
      if (t) {
        if (t.dead || t.removed || t.mapId !== this.mapId || dist(t.x, t.y, this.home.x, this.home.y) > 420) { this.target = null; this.warned = false; }
        else {
          const d = dist(t.x, t.y, this.x, this.y);
          this.cool -= dt;
          if (d < this.radius + 26 && this.cool <= 0) { this.state = 'lunge'; this.stateT = 0; this.lungeA = Math.atan2(t.y - this.y, t.x - this.x); this.cool = 0.9 + Math.random() * 0.9; this.facing = Math.cos(this.lungeA) < 0 ? -1 : 1; return; }
          const a = Math.atan2(t.y - this.y, t.x - this.x) + (d < 50 ? ((this.id % 2) * 2 - 1) * 0.9 : 0);
          if (d > this.radius + 10) { this.tryMove(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt); this.moving = true; }
          this.facing = t.x < this.x ? -1 : 1;
          return;
        }
      }
    }
    // vaguear / pastar
    this.wanderT -= dt;
    if (this.wanderTo) {
      const d = dist(this.x, this.y, this.wanderTo.x, this.wanderTo.y);
      if (d < 3 || this.wanderT < -4) this.wanderTo = null;
      else { const a = Math.atan2(this.wanderTo.y - this.y, this.wanderTo.x - this.x); const sp = this.speed * (this.behavior === 'domestic' ? 0.5 : 0.35); if (!this.tryMove(Math.cos(a) * sp * dt, Math.sin(a) * sp * dt)) this.wanderTo = null; this.facing = Math.cos(a) < 0 ? -1 : 1; this.moving = true; }
    } else if (this.wanderT <= 0) {
      this.wanderT = 2 + Math.random() * 6;
      const R = this.owner ? 50 : 90;
      const ox = this.owner && !this.owner.dead ? this.owner.x : this.home.x, oy = this.owner && !this.owner.dead ? this.owner.y : this.home.y;
      this.wanderTo = { x: ox + (Math.random() - 0.5) * R, y: oy + (Math.random() - 0.5) * R };
      this.eating = Math.random() < 0.4;
      if (this.D.sfx && this.behavior === 'domestic' && p && dist(p.x, p.y, this.x, this.y) < 120 && Math.random() < 0.3) audio.sfx(this.D.sfx, this, 0.6);
    }
    if (this.emoteT > 0) { this.emoteT -= dt; if (this.emoteT <= 0) this.emote = null; }
  }
  draw(ctx, cam) {
    const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
    if (x < -40 || y < -40 || x > G.view.w + 40 || y > G.view.h + 40) return;
    const F = this.frames;
    let img;
    if (this.special === 'bat') img = F['fly' + (Math.floor(this.animT * 10) % 2)];
    else if (this.special === 'spider') img = F['walk' + (this.moving ? Math.floor(this.animT * 10) % 2 : 0)];
    else if (this.state === 'dead') img = F.dead;
    else if (this.state === 'lunge' || this.state === 'bite') img = F.attack;
    else if (this.moving) img = F['walk' + (Math.floor(this.animT * (this.fleeT > 0 || this.target ? 12 : 7)) % 4)];
    else img = this.eating && Math.floor(this.animT) % 3 === 0 ? F.eat : F['idle' + (Math.floor(this.animT * 1.5) % 2)];
    ctx.globalAlpha = this.alpha;
    if (!this.D.flying) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y, img.width / 3, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
    const yo = this.D.flying ? -14 + Math.sin(this.animT * 4) * 3 : 0;
    ctx.save(); ctx.translate(x, y + yo); if (this.facing < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -img.width / 2, -img.height + 1);
    if (this.hitFlash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(img, -img.width / 2, -img.height + 1); ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore();
    ctx.globalAlpha = 1;
    if (this.hpBarT > 0 && this.state !== 'dead' && !this.boss) { ctx.fillStyle = '#1c1520'; ctx.fillRect(x - 9, y - img.height - 5, 18, 3); ctx.fillStyle = '#d83a3a'; ctx.fillRect(x - 8, y - img.height - 4, Math.round((16 * this.hp) / this.maxHp), 1); }
    if (this.emote) ctx.drawImage(emoteSprite(this.emote), x - 5, y - img.height - 14);
  }
}

// ---------- Cavalo ----------
export class Horse extends Entity {
  constructor(x, y, coat = 'brown', o = {}) {
    super(x, y);
    this.coat = coat; this.owned = !!o.owned; this.saddle = o.owned ? '#7b3fa0' : null; this.name = o.name || '';
    this.frames = horseFrames(coat, this.saddle); this.dir = 2; this.gait = 'idle'; this.animT = 0;
    this.w = 14; this.h = 6; this.stam = 100; this.maxStam = 100; this.rider = null; this.isHorse = true; this.team = 'N'; this.radius = 12;
    this.wanderT = 1; this.called = false; this.legendary = coat === 'nevoa'; this.huntable = false;
  }
  setOwned(v) { this.owned = v; this.saddle = v ? '#7b3fa0' : null; this.frames = horseFrames(this.coat, this.saddle); }
  blockedByWater(x, y) { const t = this.map.tileAtPx(x, y); return TILE_INFO[t].water && TILE_INFO[t].solid; }
  update(dt) {
    this.animT += dt;
    if (this.rider) return;
    const p = G.player;
    this.gait = 'idle';
    if (this.called && p && p.mapId === this.mapId) {
      const d = dist(this.x, this.y, p.x, p.y);
      if (d > 26) { const a = Math.atan2(p.y - this.y, p.x - this.x); const sp = d > 80 ? 150 : 80; if (!this.tryMove(Math.cos(a) * sp * dt, Math.sin(a) * sp * dt)) this.tryMove(Math.cos(a + 1.3) * sp * dt, Math.sin(a + 1.3) * sp * dt); this.dir = dirFromVec(Math.cos(a), Math.sin(a)); this.gait = sp > 100 ? 'gallop' : 'walk'; if (d > 600) { this.x = p.x - 40; this.y = p.y; } }
      else { this.called = false; audio.sfx('snort', this); }
      return;
    }
    if (!this.owned && p && p.mapId === this.mapId && dist(p.x, p.y, this.x, this.y) < (p.running || p.mount ? 110 : 34) && !this.calm) {
      const a = Math.atan2(this.y - p.y, this.x - p.x); this.tryMove(Math.cos(a) * 120 * dt, Math.sin(a) * 120 * dt); this.dir = dirFromVec(Math.cos(a), Math.sin(a)); this.gait = 'gallop';
      if (Math.random() < 0.01) audio.sfx('neigh', this);
      return;
    }
    this.wanderT -= dt;
    if (!this.owned && this.wanderT <= 0) { this.wanderT = 3 + Math.random() * 6; this.wto = Math.random() < 0.6 ? { x: this.x + (Math.random() - 0.5) * 90, y: this.y + (Math.random() - 0.5) * 60 } : null; this.eat = !this.wto; }
    if (this.wto) { const d = dist(this.x, this.y, this.wto.x, this.wto.y); if (d < 3) this.wto = null; else { const a = Math.atan2(this.wto.y - this.y, this.wto.x - this.x); if (!this.tryMove(Math.cos(a) * 30 * dt, Math.sin(a) * 30 * dt)) this.wto = null; this.dir = dirFromVec(Math.cos(a), Math.sin(a)); this.gait = 'walk'; } }
  }
  draw(ctx, cam) {
    const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
    if (x < -50 || y < -60 || x > G.view.w + 50 || y > G.view.h + 60) return;
    const F = this.frames;
    const speed = this.gait === 'gallop' ? 12 : 7;
    const n = this.gait === 'idle' ? (this.eat ? 'eat' : 'idle' + (Math.floor(this.animT * 1.4) % 2)) : this.gait + (Math.floor(this.animT * speed) % 4);
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y, this.dir === 0 || this.dir === 3 ? 7 : 13, 3, 0, 0, Math.PI * 2); ctx.fill();
    const rider = this.rider;
    if (this.dir === 1 || this.dir === 2) {
      const img = F.side[n] || F.side.idle0;
      ctx.save(); ctx.translate(x, y); if (this.dir === 1) ctx.scale(-1, 1); ctx.drawImage(img, -18, -img.height + 1); ctx.restore();
      if (rider) { const bob = this.gait === 'gallop' ? Math.round(Math.sin(this.animT * 24)) : this.gait === 'walk' ? Math.round(Math.sin(this.animT * 14) * 0.6) : 0; this.drawRider(ctx, rider, x + (this.dir === 1 ? 1 : -1), y - 17 + bob); }
    } else {
      const set = this.dir === 0 ? F.front : F.back; const k = this.gait === 'idle' ? 'idle0' : 'walk' + (Math.floor(this.animT * speed) % 4);
      const img = set[k] || set.idle0;
      if (rider && this.dir === 3) { ctx.drawImage(img, x - 10, y - img.height + 1); this.drawRider(ctx, rider, x, y - 16); }
      else { ctx.drawImage(img, x - 10, y - img.height + 1); if (rider) this.drawRider(ctx, rider, x, y - 16); }
    }
    if (this.legendary && Math.random() < 0.2) G.particles.add({ x: this.x + (Math.random() - 0.5) * 20, y: this.y - 10 - Math.random() * 14, vy: -10, life: 0.8, color: '#e0f0ff', size: 1 });
    if (!this.owned && this.calm && G.player && dist(G.player.x, G.player.y, this.x, this.y) < 40) ctx.drawImage(emoteSprite('heart'), x - 5, y - 40);
  }
  drawRider(ctx, r, x, y) {
    const sx = (r.dir * 4) * FW, sy = ANIMS.sit * FH;
    ctx.drawImage(r.sheet, sx, sy, FW, FH, x - FW / 2, y - FH + 6, FW, FH);
    if (r.hitFlash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(r.sheet, sx, sy, FW, FH, x - FW / 2, y - FH + 6, FW, FH); ctx.globalCompositeOperation = 'source-over'; }
  }
}

// ---------- Pássaros e peixes (ambiente) ----------
export class Bird extends Entity {
  constructor(x, y, col) { super(x, y); this.f = birdFrames(col); this.flying = false; this.vx = 0; this.vy = 0; this.t = Math.random() * 5; this.solid = false; this.isAmbient = true; this.z = 0; }
  update(dt) {
    this.t += dt; const p = G.player;
    if (!this.flying && p && p.mapId === this.mapId && dist(p.x, p.y, this.x, this.y) < (p.running || p.mount ? 80 : 44)) { this.flying = true; const a = Math.atan2(this.y - p.y, this.x - p.x); this.vx = Math.cos(a) * 70; this.vy = -40; audio.sfx('chirp', this, 0.5); }
    if (this.flying) { this.x += this.vx * dt; this.y += this.vy * dt; this.z += 30 * dt; if (this.t > 30 || this.z > 120) this.removed = true; }
    else if (Math.random() < dt * 0.6) this.x += (Math.random() - 0.5) * 3;
  }
  draw(ctx, cam) {
    const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y - this.z);
    if (x < -20 || y < -20 || x > G.view.w + 20 || y > G.view.h + 20) return;
    const img = this.flying ? this.f['fly' + (Math.floor(this.t * 12) % 2)] : this.f.sit;
    if (!this.flying) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x - 2, y, 4, 1); }
    else { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x - 2, Math.round(this.y - cam.y), 4, 1); }
    ctx.save(); ctx.translate(x, y); if (this.vx < 0) ctx.scale(-1, 1); ctx.drawImage(img, -5, -7); ctx.restore();
  }
}
export class FishJump extends Entity {
  constructor(x, y) { super(x, y); this.t = 0; this.solid = false; this.isAmbient = true; this.dirx = Math.random() < 0.5 ? -1 : 1; }
  update(dt) { this.t += dt; if (this.t > 0.9) { this.removed = true; G.particles.burst(this.x + this.dirx * 12, this.y, 6, '#d0f0ff', 40, 0.4); audio.sfx('splash', this, 0.4); } }
  draw(ctx, cam) {
    const k = this.t / 0.9, x = Math.round(this.x + this.dirx * k * 12 - cam.x), y = Math.round(this.y - Math.sin(k * Math.PI) * 14 - cam.y);
    ctx.save(); ctx.translate(x, y); ctx.rotate(this.dirx * (k - 0.5) * 2); if (this.dirx < 0) ctx.scale(-1, 1); ctx.drawImage(fishFrame(), -6, -3); ctx.restore();
  }
}

// ---------- Projéteis ----------
export class Projectile extends Entity {
  constructor(x, y, angle, speed, owner, dmg, kind = 'arrow') {
    super(x, y); this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed; this.owner = owner; this.dmg = dmg; this.kind = kind;
    this.life = 1.6; this.angle = angle; this.team = owner.team; this.solid = false; this.mapId = owner.mapId; this.stuck = 0; this.isProjectile = true;
    this.spr = weaponSprite(kind === 'dagger' ? 'dagger' : 'arrow', kind === 'dagger' ? '#b080ff' : null);
  }
  update(dt) {
    if (this.stuck) { this.stuck -= dt; if (this.stuck <= 0) this.removed = true; return; }
    this.life -= dt; if (this.life <= 0) { this.removed = true; return; }
    const steps = 3;
    for (let s = 0; s < steps; s++) {
      this.x += (this.vx * dt) / steps; this.y += (this.vy * dt) / steps;
      const m = this.map; const t = m.tileAtPx(this.x, this.y);
      if ((TILE_INFO[t].solid && !TILE_INFO[t].water) || m.collides(this.x - 1, this.y - 1, 2, 2)) { this.stuck = 2; audio.sfx('arrow', this, 0.6); return; }
      for (const e of G.entities) {
        if (e === this.owner || e.dead || e.removed || e.mapId !== this.mapId || !e.takeDamage) continue;
        if (!hostile(this.owner, e) && !(this.owner.team === 'P' && e.huntable)) continue;
        if (Math.abs(e.x - this.x) < (e.radius || 7) && this.y > e.y - 22 && this.y < e.y + 3) {
          e.takeDamage(this.dmg, this.owner, 30, true);
          this.removed = true; return;
        }
      }
    }
  }
  draw(ctx, cam) {
    const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
    ctx.save(); ctx.translate(x, y - 8); ctx.rotate(this.angle); ctx.globalAlpha = this.stuck ? Math.min(1, this.stuck) : 1; ctx.drawImage(this.spr, -this.spr.width + 2, -this.spr.height / 2); ctx.restore(); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x - 3, y, 6, 1);
  }
}

export class Pickup extends Entity {
  constructor(x, y, item, n = 1) { super(x, y); this.item = item; this.n = n; this.t = Math.random() * 3; this.solid = false; this.vz = 60; this.z = 0; this.isPickup = true; this.vx = (Math.random() - 0.5) * 50; this.vy = (Math.random() - 0.5) * 30; }
  update(dt) {
    this.t += dt;
    if (this.z > 0 || this.vz > 0) { this.vz -= 200 * dt; this.z = Math.max(0, this.z + this.vz * dt); this.tryMove(this.vx * dt, this.vy * dt); if (this.z === 0) { this.vz = 0; this.vx = 0; this.vy = 0; } }
    const p = G.player; if (!p || p.mapId !== this.mapId || this.t < 0.4) return;
    const d = dist(p.x, p.y, this.x, this.y);
    if (d < 36) { this.x += ((p.x - this.x) / d) * 140 * dt; this.y += ((p.y - this.y) / d) * 140 * dt; }
    if (d < 8) { this.removed = true; emit('pickup', this.item, this.n); }
    if (this.t > 90) this.removed = true;
  }
  draw(ctx, cam) {
    const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y - this.z - 3 - Math.sin(this.t * 4) * 1.5);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(Math.round(this.x - cam.x) - 3, Math.round(this.y - cam.y), 6, 1);
    if (this.item === 'gold') { ctx.fillStyle = '#e8c040'; ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillStyle = '#fff0a0'; ctx.fillRect(x - 1, y - 2, 1, 1); ctx.fillStyle = '#a07a20'; ctx.fillRect(x - 2, y + 1, 4, 1); }
    else ctx.drawImage(itemIcon(this.item), x - 8, y - 12);
  }
}
