// Sword vs. walls: the blade no longer passes through walls, rocks and cliffs.
// When a swing reaches a solid surface before any enemy, it bounces off with
// sparks and a clang, and leaves scratch marks on the surface (they fade out
// slowly).
import * as THREE from 'three';
import { G } from '../core/context.js';

let scratchTex = null;
function scratchTexture() {
  if (scratchTex) return scratchTex;
  const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  c.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * 9 + (Math.random() - 0.5) * 3;
    const x0 = 10 + off, y0 = 12 + Math.random() * 4, x1 = 54 + off, y1 = 50 + Math.random() * 4;
    c.strokeStyle = 'rgba(20,16,12,0.75)'; c.lineWidth = 4; c.beginPath(); c.moveTo(x0, y0 + 1.5); c.lineTo(x1, y1 + 1.5); c.stroke();
    c.strokeStyle = 'rgba(255,250,235,0.85)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  }
  scratchTex = new THREE.CanvasTexture(cv);
  scratchTex.magFilter = THREE.NearestFilter;
  return scratchTex;
}

export class WallHits {
  constructor() {
    this.decals = [];
    this.geo = new THREE.PlaneGeometry(0.9, 0.9);
    this.tmp = new THREE.Vector3();
  }

  // returns the distance to a solid surface in front of the player (or null)
  probe(P, reach, y) {
    const ph = G.physics;
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    const ax = P.pos.x + fx * 0.3, az = P.pos.z + fz * 0.3, ay = P.pos.y + y;
    const bx = ax + fx * reach, bz = az + fz * reach;
    const f = ph.rayFraction(ax, ay, az, bx, ay, bz);
    if (f >= 1) return null;
    // refine the hit point
    let lo = Math.max(0, f - 1 / 24), hi = Math.min(1, f + 1 / 24);
    const solid = (k) => ph.rayFraction(ax, ay, az, ax + fx * reach * k, ay, az + fz * reach * k) < 1;
    for (let i = 0; i < 6; i++) { const m = (lo + hi) / 2; if (solid(m)) hi = m; else lo = m; }
    const d = reach * hi;
    if (d < 0.25) return null;
    return { d, x: ax + fx * d, y: ay, z: az + fz * d, fx, fz };
  }

  // called during each swing; true = the blade bounced off a wall
  check(P, progress, hitAt, reach) {
    if (P.wallBounced || P.mounted) return false;
    const k = Math.min(1, progress / hitAt);
    if (k < 0.35) return false;
    const hit = this.probe(P, reach * k, 1.15);
    if (!hit) return false;
    // an enemy closer than the wall takes the hit instead
    for (const e of G.entities.enemies.list) {
      if (e.dead) continue;
      const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, de = Math.hypot(dx, dz);
      if (de < hit.d + 0.6 && (dx * hit.fx + dz * hit.fz) / (de || 1) > 0.5) return false;
    }
    P.wallBounced = true;
    this.impact(hit, P);
    return true;
  }

  impact(hit, P) {
    // surface normal: the dominant axis facing back toward the player (walls are voxel boxes)
    const n = Math.abs(hit.fx) > Math.abs(hit.fz) ? new THREE.Vector3(-Math.sign(hit.fx), 0, 0) : new THREE.Vector3(0, 0, -Math.sign(hit.fz));
    for (const c of G.physics.query(hit.x, hit.z, 0.4)) {
      if (c.t !== 'box' && c.r) { n.set(hit.x - c.x, 0, hit.z - c.z).normalize(); break; }
    }
    const px = hit.x + n.x * 0.03, pz = hit.z + n.z * 0.03;
    this.addDecal(px, hit.y + (Math.random() - 0.5) * 0.3, pz, n);
    // sparks + chips of the surface
    const sw = P.sword;
    for (let i = 0; i < 14; i++) {
      G.particles.glow.spawn(px, hit.y, pz, n.x * 3 + (Math.random() - 0.5) * 5, 1 + Math.random() * 3, n.z * 3 + (Math.random() - 0.5) * 5, Math.random() < 0.6 ? 0xffe9a0 : 0xffffff, 0.08, 0.35, { gravity: 9 });
    }
    G.particles.dust(px, hit.y - 0.3, pz, 5, 0x9a9488);
    G.audio.sfx('clang', { vol: 0.8, rate: 0.9 + Math.random() * 0.2 });
    G.cam.shake(0.18);
    if (G.combat) G.combat.hitstop = Math.max(G.combat.hitstop || 0, 0.06);
    // recoil: the hero is pushed back a little and the swing ends early
    P.knock = new THREE.Vector3(-hit.fx * 4, 0, -hit.fz * 4);
    if (sw.glow) G.particles.burst(px, hit.y, pz, sw.glow, 6, 2, { life: 0.3 });
  }

  addDecal(x, y, z, n) {
    const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ map: scratchTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, opacity: 0.95, fog: true }));
    m.position.set(x, y, z);
    m.lookAt(x + n.x, y + n.y, z + n.z);
    m.rotateZ((Math.random() - 0.5) * 1.4);
    const s = 0.7 + Math.random() * 0.5; m.scale.set(s, s, 1);
    G.scene.add(m);
    this.decals.push({ m, t: 0 });
    if (this.decals.length > 40) { const o = this.decals.shift(); G.scene.remove(o.m); o.m.material.dispose(); }
  }

  update(dt) {
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.t += dt;
      if (d.t > 90) d.m.material.opacity = Math.max(0, 0.95 - (d.t - 90) / 30);
      if (d.t > 120) { G.scene.remove(d.m); d.m.material.dispose(); this.decals.splice(i, 1); }
    }
  }
}
