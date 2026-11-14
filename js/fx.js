// Efeitos visuais (partículas, traçantes, decalques) e granadas com comportamento próprio.
import * as THREE from '../vendor/three.min.js';
import { softSprite, smokeSprite } from './textures.js';
import { buildGrenade } from './models.js';
import { sfx } from './audio.js';

const V = new THREE.Vector3();

export class Effects {
  constructor(game) {
    this.game = game; this.scene = game.scene; this.q = game.q; this.parts = []; this.pool = []; this.tracers = []; this.decals = []; this.di = 0; this.lights = [];
    this.soft = softSprite(); this.smokeTex = smokeSprite();
    this.decalGeo = new THREE.PlaneGeometry(0.14, 0.14);
    this.decalMat = new THREE.MeshBasicMaterial({ map: this.soft, color: 0x080808, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe7a0, transparent: true, opacity: 0.7 });
  }
  // partícula genérica (sprite)
  spawn(x, y, z, o) {
    let s = this.pool.pop();
    if (!s) { s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); }
    const m = s.material; m.map = o.smoke ? this.smokeTex : this.soft; m.color.set(o.color ?? 0xffffff); m.blending = o.add ? THREE.AdditiveBlending : THREE.NormalBlending; m.opacity = o.op ?? 1; m.rotation = Math.random() * 6.28; m.needsUpdate = true;
    s.position.set(x, y, z); s.scale.setScalar(o.size ?? 0.2);
    s.userData = { vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, g: o.g || 0, life: o.life ?? 0.5, t: 0, op: o.op ?? 1, grow: o.grow || 0, fadeIn: o.fadeIn || 0, drag: o.drag || 0 };
    this.scene.add(s); this.parts.push(s); return s;
  }
  burst(p, n, o) {
    n = Math.max(1, Math.round(n * this.q.fx));
    for (let i = 0; i < n; i++) { const sp = o.speed || 2, a = Math.random() * 6.283, e = (Math.random() - 0.3) * 1.6; this.spawn(p.x, p.y, p.z, { ...o, vx: Math.cos(a) * Math.cos(e) * sp * Math.random() + (o.dx || 0), vy: Math.sin(e) * sp * Math.random() + (o.dy || 0), vz: Math.sin(a) * Math.cos(e) * sp * Math.random() + (o.dz || 0) }); }
  }
  tracer(a, b) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]), l = new THREE.Line(g, this.tracerMat.clone()); l.userData.t = 0; this.scene.add(l); this.tracers.push(l);
  }
  impact(p, nx, ny, nz) {
    this.burst(p, 5, { color: 0xffd9a0, add: true, size: 0.06, life: 0.25, speed: 3, dx: nx * 2, dy: ny * 2, dz: nz * 2, g: 9 });
    this.spawn(p.x + nx * 0.05, p.y + ny * 0.05, p.z + nz * 0.05, { color: 0x9a948a, smoke: true, size: 0.25, grow: 1.2, life: 0.5, op: 0.5, vx: nx * 0.5, vy: ny * 0.5 + 0.3, vz: nz * 0.5 });
    let d = this.decals[this.di];
    if (!d) { d = new THREE.Mesh(this.decalGeo, this.decalMat); this.scene.add(d); this.decals[this.di] = d; }
    this.di = (this.di + 1) % this.q.decals;
    d.position.set(p.x + nx * 0.01, p.y + ny * 0.01, p.z + nz * 0.01); d.lookAt(p.x + nx, p.y + ny, p.z + nz);
  }
  blood(p) { this.burst(p, 6, { color: 0xa00c0c, size: 0.09, life: 0.4, speed: 2.5, g: 9 }); }
  muzzle(p) { this.spawn(p.x, p.y, p.z, { color: 0xffc860, add: true, size: 0.45, life: 0.05 }); this.light(p, 0xffb050, 14, 0.06); }
  light(p, color, intensity, life) {
    if (!this.q.lights) return;
    let l = this.lights.find(x => x.userData.t >= x.userData.life);
    if (!l) { if (this.lights.length >= 4) return; l = new THREE.PointLight(color, 0, 14, 1.6); this.scene.add(l); this.lights.push(l); }
    l.color.set(color); l.position.copy(p); l.userData = { t: 0, life, i: intensity }; l.intensity = intensity;
  }
  explosion(p) {
    this.spawn(p.x, p.y + 0.5, p.z, { color: 0xffe2a0, add: true, size: 7, life: 0.14 });
    this.burst(p, 16, { color: 0xff8a2a, add: true, size: 1.4, life: 0.45, speed: 7, dy: 2, grow: 2 });
    this.burst(p, 12, { color: 0x3a3632, smoke: true, size: 2, life: 1.8, speed: 3, dy: 1.5, grow: 1.5, op: 0.7, drag: 1.5 });
    this.burst(p, 14, { color: 0xffd080, add: true, size: 0.1, life: 0.8, speed: 14, g: 12 });
    this.light(p, 0xff9040, 120, 0.25);
  }
  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const s = this.parts[i], u = s.userData; u.t += dt;
      if (u.t >= u.life) { this.scene.remove(s); this.pool.push(s); this.parts[i] = this.parts[this.parts.length - 1]; this.parts.pop(); continue; }
      u.vy -= u.g * dt; if (u.drag) { const k = Math.max(0, 1 - u.drag * dt); u.vx *= k; u.vy *= k; u.vz *= k; }
      s.position.x += u.vx * dt; s.position.y += u.vy * dt; s.position.z += u.vz * dt;
      if (u.grow) s.scale.addScalar(u.grow * dt);
      const k = u.t / u.life; s.material.opacity = u.op * (u.fadeIn && u.t < u.fadeIn ? u.t / u.fadeIn : Math.min(1, (1 - k) * 2.5));
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) { const l = this.tracers[i]; l.userData.t += dt; l.material.opacity = 0.7 * (1 - l.userData.t / 0.07); if (l.userData.t > 0.07) { this.scene.remove(l); l.geometry.dispose(); l.material.dispose(); this.tracers.splice(i, 1); } }
    for (const l of this.lights) { const u = l.userData; if (u.t < u.life) { u.t += dt; l.intensity = u.t >= u.life ? 0 : u.i * (1 - u.t / u.life); } }
  }
  clear() {
    for (const s of this.parts) { this.scene.remove(s); this.pool.push(s); } this.parts.length = 0;
    for (const l of this.tracers) this.scene.remove(l); this.tracers.length = 0;
    for (const d of this.decals) if (d) d.position.y = -50;
  }
}

// ---------- Granadas ----------
export class Grenades {
  constructor(game) { this.game = game; this.list = []; this.zones = []; }
  throw(owner, type, origin, dir, power = 17) {
    const mesh = buildGrenade(type, owner.isPlayer ? this.game.nadeSkin : 'padrao'); mesh.scale.setScalar(1.6); mesh.position.copy(origin); this.game.scene.add(mesh);
    this.list.push({ type, owner, mesh, pos: origin.clone(), vel: dir.clone().multiplyScalar(power).add(new THREE.Vector3(0, 2.2, 0)), t: 0, rest: false, next: 0, emitted: 0 });
  }
  update(dt) {
    const G = this.game, W = G.world;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const n = this.list[i]; n.t += dt;
      if (!n.rest) {
        n.vel.y -= 16 * dt;
        const sp = n.vel.length(), step = sp * dt;
        if (step > 1e-5) {
          const h = W.raycast(n.pos.x, n.pos.y, n.pos.z, n.vel.x / sp, n.vel.y / sp, n.vel.z / sp, step + 0.08);
          if (h) {
            n.pos.addScaledVector(n.vel, Math.max(0, h.t - 0.08) / sp);
            const dot = n.vel.x * h.nx + n.vel.y * h.ny + n.vel.z * h.nz;
            n.vel.x -= 2 * dot * h.nx; n.vel.y -= 2 * dot * h.ny; n.vel.z -= 2 * dot * h.nz; n.vel.multiplyScalar(0.42);
            G.sound3d('bounce', n.pos, 0.4, 18);
            if (n.type === 'fire' && h.ny > 0.5) { this.detonate(n); this.remove(i); continue; }
            if (h.ny > 0.5 && n.vel.length() < 1.2) { n.rest = true; n.vel.set(0, 0, 0); }
          } else n.pos.addScaledVector(n.vel, dt);
        }
        if (n.pos.y < 0.06) { n.pos.y = 0.06; }
        n.mesh.position.copy(n.pos); n.mesh.rotation.x += dt * 9; n.mesh.rotation.z += dt * 6;
      }
      const fuse = { he: 1.7, flash: 1.5, smoke: 1.9, fire: 2.2, decoy: 2 }[n.type];
      if (n.type === 'decoy' && n.t >= fuse) {
        if (n.t > 12) { G.fx.explosion(n.pos); G.sound3d('explosion', n.pos, 0.4, 40); this.remove(i); continue; }
        if (n.t >= n.next) { n.next = n.t + 0.25 + Math.random() * 1.1; G.sound3d('shot', n.pos, 0.9, 55, [1700, 0.18, 100]); G.emitSound(n.pos.x, n.pos.z, 32, n.owner.team); G.fx.muzzle(V.copy(n.pos).setY(n.pos.y + 0.1)); }
      } else if (n.t >= fuse) { this.detonate(n); this.remove(i); }
    }
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i]; z.t += dt;
      if (z.type === 'smoke') {
        if (Math.random() < dt * 6 * G.q.fx) G.fx.spawn(z.x + (Math.random() - 0.5) * 5, 0.6 + Math.random() * 2.6, z.z + (Math.random() - 0.5) * 5, { color: 0xb8bcc0, smoke: true, size: 4.5, life: 2.6, op: 0.75, fadeIn: 0.6, vy: 0.15 });
      } else {
        if (Math.random() < dt * 30 * G.q.fx) { const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * z.r; G.fx.spawn(z.x + Math.cos(a) * d, 0.15, z.z + Math.sin(a) * d, { color: Math.random() < 0.5 ? 0xff7a1a : 0xffc23d, add: true, size: 0.9, life: 0.55, vy: 2.2, grow: -0.8 }); }
        z.tick -= dt;
        if (z.tick <= 0) { z.tick = 0.25; for (const c of G.all) if (c.alive && Math.abs(c.pos.y - z.y) < 2 && Math.hypot(c.pos.x - z.x, c.pos.z - z.z) < z.r && (c.team !== z.owner.team || c === z.owner)) G.damage(c, 8, z.owner, 'fire', false, true); }
        if (Math.random() < dt * 2) G.sound3d('fire', z, 0.35, 25);
      }
      if (z.t >= z.life) { if (z.smoke) { const k = G.world.smokes.indexOf(z.smoke); if (k >= 0) G.world.smokes.splice(k, 1); } this.zones.splice(i, 1); }
    }
  }
  remove(i) { this.game.scene.remove(this.list[i].mesh); this.list.splice(i, 1); }
  detonate(n) {
    const G = this.game, p = n.pos, W = G.world;
    if (n.type === 'he') {
      G.fx.explosion(p); G.sound3d('explosion', p, 1, 70); G.emitSound(p.x, p.z, 35, n.owner.team);
      for (const c of G.all) {
        if (!c.alive || (c.team === n.owner.team && c !== n.owner)) continue;
        const d = Math.hypot(c.pos.x - p.x, c.pos.y + 0.9 - p.y, c.pos.z - p.z); if (d > 7.5) continue;
        if (!W.los(p.x, p.y + 0.3, p.z, c.pos.x, c.pos.y + 1, c.pos.z, true)) continue;
        G.damage(c, 105 * (1 - d / 7.5) * (c === n.owner ? 0.6 : 1), n.owner, 'he', false);
      }
    } else if (n.type === 'flash') {
      G.fx.spawn(p.x, p.y, p.z, { color: 0xffffff, add: true, size: 9, life: 0.12 }); G.fx.light(p, 0xffffff, 200, 0.15); G.sound3d('explosion', p, 0.5, 50);
      for (const c of G.all) {
        if (!c.alive) continue;
        const ex = c.pos.x, ey = c.pos.y + 1.55, ez = c.pos.z, d = Math.hypot(ex - p.x, ey - p.y, ez - p.z); if (d > 32) continue;
        if (!W.los(p.x, p.y + 0.2, p.z, ex, ey, ez, true)) continue;
        const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), dot = d < 0.1 ? 1 : ((p.x - ex) * fx + (p.z - ez) * fz) / d;
        const dur = (dot > 0.2 ? 3.4 : dot > -0.3 ? 1.6 : 0.5) * Math.max(0.35, 1 - d / 40) * (c.team === n.owner.team && c !== n.owner ? 0.5 : 1);
        G.blind(c, dur);
      }
    } else if (n.type === 'smoke') {
      const s = { x: p.x, y: 1.5, z: p.z, r: 4.2 }; W.smokes.push(s); G.sound3d('smoke', p, 0.8, 30);
      this.zones.push({ type: 'smoke', x: p.x, y: p.y, z: p.z, t: 0, life: 15, smoke: s });
      for (let k = 0; k < 14 * G.q.fx; k++) G.fx.spawn(p.x + (Math.random() - 0.5) * 5, 0.6 + Math.random() * 2.6, p.z + (Math.random() - 0.5) * 5, { color: 0xb8bcc0, smoke: true, size: 4.5, life: 2.6 + Math.random(), op: 0.75, fadeIn: 0.5 });
    } else if (n.type === 'fire') {
      G.sound3d('fire', p, 1, 40); G.fx.burst(p, 10, { color: 0xff7a1a, add: true, size: 1.2, life: 0.5, speed: 5 }); G.fx.light(p, 0xff7020, 60, 0.4);
      this.zones.push({ type: 'fire', x: p.x, y: Math.max(0, p.y - 0.1), z: p.z, r: 3.2, t: 0, life: 6.5, tick: 0, owner: n.owner });
    }
  }
  inFire(x, z) { for (const f of this.zones) if (f.type === 'fire' && Math.hypot(x - f.x, z - f.z) < f.r + 0.6) return f; return null; }
  clear() { for (const n of this.list) this.game.scene.remove(n.mesh); this.list.length = 0; this.zones.length = 0; this.game.world.smokes.length = 0; }
}
