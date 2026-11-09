// Combat resolution: player melee arcs, sword effects, projectiles, beams,
// telegraphs (ground warnings), hitstop.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { angleDiff, dist2d } from '../core/utils.js';

const ringGeo = new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2);
const discGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.projectiles = [];
    this.telegraphs = [];
    this.beams = [];
    this.hitstop = 0;
    this.orbGeo = new THREE.OctahedronGeometry(1, 0);
    this.rockGeo = new THREE.BoxGeometry(1, 1, 1);
  }
  enemies() { return G.entities.enemies.list; }

  nearestEnemy(pos, maxD, yaw, arc = Math.PI) {
    let best = null, bd = maxD;
    for (const e of this.enemies()) {
      if (e.dead) continue;
      const d = dist2d(pos.x, pos.z, e.pos.x, e.pos.z);
      if (d > bd) continue;
      if (Math.abs(e.pos.y - pos.y) > 6) continue;
      if (yaw !== null && yaw !== undefined) {
        const a = Math.atan2(e.pos.x - pos.x, e.pos.z - pos.z);
        if (Math.abs(angleDiff(yaw, a)) > arc) continue;
      }
      bd = d; best = e;
    }
    return best;
  }
  enemiesInRadius(x, z, r, y) {
    return this.enemies().filter((e) => !e.dead && dist2d(x, z, e.pos.x, e.pos.z) < r + e.radius && (y === undefined || Math.abs(e.pos.y - y) < 4));
  }

  playerMelee(o) {
    const P = G.player;
    G.physProps?.hitArc(P.pos, P.yaw, o.reach, o.arc, 3 + o.knock * 0.6);
    let hits = 0;
    for (const e of this.enemies()) {
      if (e.dead) continue;
      const d = dist2d(P.pos.x, P.pos.z, e.pos.x, e.pos.z);
      if (d > o.reach + e.radius) continue;
      if (Math.abs(e.pos.y + (e.def.fly ? e.def.fly * 0.5 : 0) - P.pos.y) > 3.2) continue;
      const a = Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
      if (Math.abs(angleDiff(P.yaw, a)) > o.arc) continue;
      const crit = Math.random() < o.crit;
      let dmg = o.dmg * (crit ? 1.8 : 1) * (0.92 + Math.random() * 0.16);
      if (e.status.frozen > 0) dmg *= 1.3;
      e.takeDamage(dmg, { crit, knock: o.knock });
      hits++;
      this.applyEffect(o.effect, e, dmg, o.finisher);
      const hx = e.pos.x, hz = e.pos.z, hy = e.pos.y + 1;
      G.particles.burst(hx, hy, hz, crit ? 0xffe060 : 0xffffff, crit ? 18 : 10, 5, { gravity: 8, size: 0.18 });
      G.particles.burst(hx, hy, hz, e.def.color, 8, 4, { solid: true, gravity: 12, size: 0.2 });
    }
    if (hits) {
      G.audio.sfx(hits > 1 || o.finisher ? 'crit' : 'hit');
      this.hitstop = o.finisher ? 0.09 : 0.05;
      G.cam.shake(o.finisher ? 0.3 : 0.12);
    }
    return hits;
  }

  applyEffect(effect, e, dmg, finisher) {
    if (!effect || e.dead) return;
    const P = G.player;
    switch (effect) {
      case 'burn': e.status.burn = 3; e.status.burnDps = dmg * 0.25; break;
      case 'chill': e.status.slow = 2.5; if (finisher) e.status.frozen = 1.2; G.particles.burst(e.pos.x, e.pos.y + 1, e.pos.z, 0x9fe8ff, 8, 3); break;
      case 'shock': {
        const near = this.enemiesInRadius(e.pos.x, e.pos.z, 6).filter((o) => o !== e).slice(0, 2);
        for (const o of near) {
          o.takeDamage(dmg * 0.45, { power: true });
          this.lightning(e.pos, o.pos, 0x9aa8ff);
        }
        break;
      }
      case 'leech': P.heal(Math.max(1, dmg * 0.08)); break;
      case 'quake': if (finisher) { for (const o of this.enemiesInRadius(e.pos.x, e.pos.z, 4)) if (o !== e) o.takeDamage(dmg * 0.5, { knock: 6 }); G.particles.ring(e.pos.x, e.pos.y + 0.2, e.pos.z, 0xffd36a, 4, 30); G.audio.sfx('slam', { vol: 0.6 }); } break;
      case 'dawn': if (finisher) { for (const o of this.enemiesInRadius(P.pos.x, P.pos.z, 5.5)) if (o !== e) o.takeDamage(dmg * 0.6, { knock: 8, power: true }); G.particles.ring(P.pos.x, P.pos.y + 1, P.pos.z, 0xffd36a, 5, 48, { speed: 9 }); } break;
      case 'void': e.status.slow = 2; if (finisher) { e.takeDamage(dmg * 0.4, { power: true }); G.particles.burst(e.pos.x, e.pos.y + 1, e.pos.z, 0xd04cff, 24, 5); } break;
      default: break;
    }
  }

  lightning(a, b, color) {
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      G.particles.glow.spawn(a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 0.6, a.y + 1 + (b.y - a.y) * t + (Math.random() - 0.5) * 0.6, a.z + (b.z - a.z) * t + (Math.random() - 0.5) * 0.6, 0, 0, 0, color, 0.3, 0.25);
    }
  }

  // ---------- projectiles ----------
  spawnProjectile(o) {
    const color = o.color || 0xffffff;
    const mesh = new THREE.Mesh(o.rock ? this.rockGeo : this.orbGeo, new THREE.MeshBasicMaterial({ color: o.rock ? 0x8a8070 : color }));
    mesh.scale.setScalar(o.size || 0.35);
    mesh.position.set(o.x, o.y, o.z);
    this.scene.add(mesh);
    const vel = new THREE.Vector3();
    if (o.dir) vel.copy(o.dir).normalize().multiplyScalar(o.speed);
    else if (o.target) {
      const tp = o.target.pos;
      vel.set(tp.x - o.x, tp.y + 1.1 - o.y, tp.z - o.z);
      const dist = vel.length();
      vel.normalize();
      if (o.spread) { const yaw = Math.atan2(vel.x, vel.z) + o.spread; const h = Math.hypot(vel.x, vel.z); vel.x = Math.sin(yaw) * h; vel.z = Math.cos(yaw) * h; }
      vel.multiplyScalar(o.speed);
      if (o.gravity) vel.y += (o.gravity * dist / o.speed) / 2;
    }
    this.projectiles.push({ ...o, mesh, vel, life: o.life || 3, color, hostile: !o.friendly });
  }

  telegraphCircle(x, y, z, r, dur) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.6, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, mat);
    const fill = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.25, depthWrite: false }));
    ring.scale.setScalar(r); ring.position.set(x, y + 0.08, z);
    fill.position.set(x, y + 0.06, z);
    this.scene.add(ring, fill);
    this.telegraphs.push({ ring, fill, r, t: 0, dur });
  }
  telegraphLine(enemy, range, dur) {
    const geo = new THREE.PlaneGeometry(1.4, range).rotateX(-Math.PI / 2).translate(0, 0, range / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.35, depthWrite: false }));
    this.scene.add(m);
    this.telegraphs.push({ line: m, enemy, t: 0, dur });
  }
  fireBeam(enemy, range, dmg, color) {
    const P = G.player;
    const yaw = enemy.yaw;
    const ox = enemy.pos.x, oz = enemy.pos.z;
    const dx = Math.sin(yaw), dz = Math.cos(yaw);
    const px = P.pos.x - ox, pz = P.pos.z - oz;
    const along = px * dx + pz * dz;
    const perp = Math.abs(px * dz - pz * dx);
    if (along > 0 && along < range && perp < 1.2) P.damage(dmg, enemy.pos, { enemy, knock: 8 });
    this.beamVisual(new THREE.Vector3(ox, enemy.pos.y + 2.2 * (enemy.def.scale || 1) * 0.6, oz), yaw, range, color);
    G.audio.sfxAt('ray', ox, oz, { range: 50 });
  }
  beamVisual(from, yaw, range, color, width = 0.6) {
    const geo = new THREE.BoxGeometry(width, width, range).translate(0, 0, range / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(from);
    m.rotation.y = yaw;
    this.scene.add(m);
    this.beams.push({ m, t: 0, dur: 0.35 });
    for (let i = 0; i < 20; i++) {
      const d = Math.random() * range;
      G.particles.trail(from.x + Math.sin(yaw) * d, from.y, from.z + Math.cos(yaw) * d, color, 0.3, 0.5);
    }
  }

  update(dt) {
    const P = G.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.gravity) p.vel.y -= p.gravity * dt;
      if (p.homing && p.homingTarget && !p.homingTarget.dead) {
        const tp = p.homingTarget.pos;
        const want = new THREE.Vector3(tp.x - p.mesh.position.x, tp.y + 1 - p.mesh.position.y, tp.z - p.mesh.position.z).normalize().multiplyScalar(p.vel.length());
        p.vel.lerp(want, Math.min(1, dt * p.homing));
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 6; p.mesh.rotation.y += dt * 8;
      const pos = p.mesh.position;
      if (Math.random() < 0.8) G.particles.trail(pos.x, pos.y, pos.z, p.rock ? 0x8a8070 : p.color, p.rock ? 0.25 : 0.22, 0.35);
      let hit = false;
      if (p.hostile) {
        if (Math.hypot(pos.x - P.pos.x, pos.y - (P.pos.y + 1), pos.z - P.pos.z) < 0.9 + (p.size || 0.3)) {
          P.damage(p.dmg, pos, { enemy: p.from, knock: 5 });
          hit = true;
        }
      } else {
        for (const e of this.enemies()) {
          if (e.dead) continue;
          const ey = e.pos.y + (e.def.fly ? e.def.fly : 0.8) * (e.def.scale || 1);
          if (Math.hypot(pos.x - e.pos.x, pos.y - ey, pos.z - e.pos.z) < e.radius + 0.6 + (p.size || 0.3)) {
            e.takeDamage(p.dmg, { power: true, knock: 5 });
            if (p.onHit) p.onHit(e, pos);
            hit = true;
            break;
          }
        }
      }
      const g = G.physics.groundAt(pos.x, pos.z, pos.y + 0.5);
      if (pos.y < g + 0.1) hit = true;
      if (hit || p.life <= 0) {
        G.particles.burst(pos.x, pos.y, pos.z, p.rock ? 0x8a8070 : p.color, 16, 4, { solid: !!p.rock });
        if (!p.hostile && p.onExplode) p.onExplode(pos);
        if (p.rock) G.audio.sfxAt('slam', pos.x, pos.z, { vol: 0.5 });
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.projectiles.splice(i, 1);
      }
    }
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const tg = this.telegraphs[i];
      tg.t += dt;
      const k = Math.min(1, tg.t / tg.dur);
      if (tg.ring) {
        tg.fill.scale.setScalar(tg.r * k);
        tg.ring.material.opacity = 0.4 + Math.sin(tg.t * 20) * 0.2;
      } else if (tg.line) {
        const e = tg.enemy;
        tg.line.position.set(e.pos.x, e.pos.y + 0.1, e.pos.z);
        if (k < 0.7) tg.line.rotation.y = e.yaw;
        tg.line.material.opacity = 0.2 + k * 0.4;
      }
      if (k >= 1 || (tg.enemy && tg.enemy.dead)) {
        if (tg.ring) this.scene.remove(tg.ring, tg.fill); else this.scene.remove(tg.line);
        this.telegraphs.splice(i, 1);
      }
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.t += dt;
      b.m.material.opacity = 0.9 * (1 - b.t / b.dur);
      b.m.scale.x = b.m.scale.y = 1 + b.t * 2;
      if (b.t >= b.dur) { this.scene.remove(b.m); this.beams.splice(i, 1); }
    }
  }
}
