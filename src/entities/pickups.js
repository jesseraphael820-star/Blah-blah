// Physical pickups: gold coins (dropped by enemies or scattered across the map),
// falling-star stardust from events. Coins are magnetized to the player.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { makeRng, dist2d } from '../core/utils.js';
import { WORLD } from '../data/world.js';

export class Pickups {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.coinGeo = new THREE.BoxGeometry(0.34, 0.34, 0.09);
    this.coinMat = new THREE.MeshLambertMaterial({ color: 0xffc83a, emissive: 0x8a5a00, emissiveIntensity: 0.7 });
    this.starGeo = new THREE.OctahedronGeometry(0.28, 0);
    this.starMat = new THREE.MeshBasicMaterial({ color: 0xfff0a0 });
    this.world = [];
  }

  spawnCoins(x, y, z, amount) {
    if (amount <= 0) return;
    const n = Math.min(8, Math.max(1, Math.ceil(amount / 5)));
    let left = amount;
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? left : Math.floor(amount / n);
      left -= v;
      const m = new THREE.Mesh(this.coinGeo, this.coinMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      this.scene.add(m);
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 2.5;
      this.list.push({ kind: 'coin', m, v, vel: new THREE.Vector3(Math.cos(a) * s, 5 + Math.random() * 3, Math.sin(a) * s), t: 0 });
    }
  }
  spawnStar(x, z) {
    const y = G.physics.groundAt(x, z, 200);
    const m = new THREE.Mesh(this.starGeo, this.starMat);
    m.position.set(x, y + 40, z);
    this.scene.add(m);
    this.list.push({ kind: 'star', m, v: 1, vel: new THREE.Vector3(0, -30, 0), t: 0, groundY: y + 0.6, falling: true, life: 90 });
  }

  // Scattered world coins (respawn daily) reward exploration off the roads
  scatterWorldCoins() {
    const rng = makeRng(31337);
    let placed = 0;
    // coin piles everywhere (fields, forests, hills, beaches, mountains), plus rarer Gold sacks
    this.sackGeo = new THREE.BoxGeometry(0.55, 0.6, 0.5);
    this.sackMat = new THREE.MeshLambertMaterial({ color: 0x8a5a30 });
    this.tieMat = new THREE.MeshLambertMaterial({ color: 0xffc83a, emissive: 0x8a5a00, emissiveIntensity: 0.6 });
    for (let k = 0; k < 2400 && placed < 220; k++) {
      const x = (rng() - 0.5) * (WORLD.size - 40), z = (rng() - 0.5) * (WORLD.size - 40);
      const h = G.physics.terrainHeight(x, z);
      if (h < 0.5 || h > 44) continue;
      if (G.physics.waterLevel(x, z) > h) continue;
      if (dist2d(x, z, 30, 40) < 24) continue;
      const gy = G.physics.groundAt(x, z, 200);
      if (gy - h > 0.6) continue; // not on top of trees, roofs or rocks
      const id = 'coin_' + placed;
      const sack = rng() < 0.12, big = !sack && rng() < 0.25;
      const g = new THREE.Group();
      if (sack) {
        const b = new THREE.Mesh(this.sackGeo, this.sackMat); b.position.y = 0.3; b.castShadow = true;
        const tie = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.3), this.tieMat); tie.position.y = 0.66;
        const c = new THREE.Mesh(this.coinGeo, this.coinMat); c.position.set(0.32, 0.1, 0.1); c.rotation.x = 1.4;
        g.add(b, tie, c);
      } else {
        const n = big ? 6 : 3;
        for (let i = 0; i < n; i++) {
          const c = new THREE.Mesh(this.coinGeo, this.coinMat);
          c.position.set(((i % 3) - 1) * 0.25, 0.55 + (i % 2) * 0.2 + Math.floor(i / 3) * 0.3, Math.floor(i / 3) * 0.12);
          c.castShadow = true;
          g.add(c);
        }
      }
      g.position.set(x, gy, z);
      this.scene.add(g);
      const v = sack ? 60 + Math.floor(rng() * 90) : big ? 20 + Math.floor(rng() * 20) : 6 + Math.floor(rng() * 10);
      this.world.push({ id, g, x, z, v: Math.round(v * (1 + Math.max(0, h - 10) * 0.03)), sack });
      placed++;
    }
  }

  update(dt) {
    const P = G.player;
    const pp = P.pos;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      c.t += dt;
      c.m.rotation.y += dt * 5;
      const d = Math.hypot(c.m.position.x - pp.x, c.m.position.y - (pp.y + 1), c.m.position.z - pp.z);
      if (c.kind === 'star' && c.falling) {
        c.m.position.addScaledVector(c.vel, dt);
        G.particles.trail(c.m.position.x, c.m.position.y, c.m.position.z, 0xfff0a0, 0.4, 0.8);
        if (c.m.position.y <= c.groundY) { c.m.position.y = c.groundY; c.falling = false; G.particles.burst(c.m.position.x, c.groundY, c.m.position.z, 0xfff0a0, 30, 6); G.audio.sfxAt('explosion', c.m.position.x, c.m.position.z, { vol: 0.4 }); }
        continue;
      }
      if (c.kind === 'star') {
        c.life -= dt;
        c.m.position.y = c.groundY + Math.sin(c.t * 3) * 0.15;
        if (Math.random() < dt * 8) G.particles.trail(c.m.position.x, c.m.position.y, c.m.position.z, 0xfff0a0, 0.25, 0.8);
        if (d < 1.6) { G.prog.grant({ items: { stardust: 1 }, gold: 20 }, { quiet: false }); G.audio.sfx('pickup'); this.remove(i); continue; }
        if (c.life <= 0) this.remove(i);
        continue;
      }
      // coins: pop, then magnet
      if (c.t < 0.55 || d > 7) {
        c.vel.y -= 22 * dt;
        c.m.position.addScaledVector(c.vel, dt);
        const g = G.physics.groundAt(c.m.position.x, c.m.position.z, c.m.position.y + 0.5) + 0.2;
        if (c.m.position.y < g) { c.m.position.y = g; c.vel.y = Math.abs(c.vel.y) * 0.4; c.vel.x *= 0.6; c.vel.z *= 0.6; }
      } else {
        const sp = 6 + c.t * 14;
        const dir = new THREE.Vector3(pp.x - c.m.position.x, pp.y + 1 - c.m.position.y, pp.z - c.m.position.z).normalize();
        c.m.position.addScaledVector(dir, Math.min(d, sp * dt));
      }
      if (d < 0.9 && c.t > 0.3) {
        G.prog.addGold(c.v, { source: 'coin' });
        G.audio.sfx('coin', { vol: 0.7 });
        G.particles.burst(c.m.position.x, c.m.position.y, c.m.position.z, 0xffd36a, 5, 2, { gravity: 0, life: 0.3, size: 0.15 });
        this.remove(i);
      } else if (c.t > 60) this.remove(i);
    }
    // world coin stacks
    for (const w of this.world) {
      const ready = G.props.nodeReady({ id: w.id });
      w.g.visible = ready;
      if (!ready) continue;
      if (Math.abs(w.x - pp.x) > 60 || Math.abs(w.z - pp.z) > 60) continue;
      if (!w.sack) w.g.rotation.y += dt * 1.5;
      if (Math.random() < dt * (w.sack ? 1.5 : 0.8)) G.particles.glow.spawn(w.x + (Math.random() - 0.5) * 0.6, w.g.position.y + 0.5 + Math.random() * 0.6, w.z + (Math.random() - 0.5) * 0.6, 0, 0.6, 0, 0xffe27a, 0.22, 0.6);
      if (dist2d(w.x, w.z, pp.x, pp.z) < 1.4 && Math.abs(w.g.position.y - pp.y) < 2) {
        G.state.world.harvested[w.id] = G.state.world.day * 24 + G.state.world.time;
        this.spawnCoins(w.x, w.g.position.y + 0.8, w.z, w.v);
        G.audio.sfx(w.sack ? 'chest' : 'pickup');
        if (w.sack) G.ui.toast('💰 +' + w.v + ' Gold', 'gold');
      }
    }
  }
  remove(i) { this.scene.remove(this.list[i].m); this.list.splice(i, 1); }
}
