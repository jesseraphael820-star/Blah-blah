// Loose physics objects (balls, crates, barrels, pumpkins, buckets): pushed by
// the player, knocked by sword hits and explosions, roll, bounce and float.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { buildMesh } from '../render/voxel.js';
import { dist2d } from '../core/utils.js';

const TYPES = {
  ball: { r: 0.36, mass: 0.4, bounce: 0.7, friction: 1.2, float: true },
  pumpkin: { r: 0.42, mass: 1.6, bounce: 0.25, friction: 3, float: true },
  crate: { r: 0.45, mass: 2.2, bounce: 0.15, friction: 6, float: true, box: true },
  barrel: { r: 0.42, mass: 2.6, bounce: 0.2, friction: 3, float: true },
  bucket: { r: 0.28, mass: 0.6, bounce: 0.3, friction: 4, float: true },
};

function geoFor(kind) {
  return buildMesh((vb) => {
    if (kind === 'ball') {
      vb.box(-0.3, -0.3, -0.3, 0.3, 0.3, 0.3, 0xf0f0f0, { vary: 0 });
      vb.box(-0.32, -0.1, -0.32, 0.32, 0.1, 0.32, 0xe03a3a, { vary: 0, bottom: true });
      vb.box(-0.1, -0.32, -0.1, 0.1, 0.32, 0.1, 0x3a6ad0, { vary: 0, bottom: true });
    } else if (kind === 'pumpkin') {
      vb.box(-0.4, -0.32, -0.4, 0.4, 0.32, 0.4, 0xe08a1a, { topColor: 0xf09a2a, bottom: true });
      vb.box(-0.42, -0.25, -0.12, 0.42, 0.25, 0.12, 0xc8761a, { bottom: true });
      vb.box(-0.06, 0.32, -0.06, 0.06, 0.5, 0.06, 0x3a6a2a);
    } else if (kind === 'crate') {
      vb.box(-0.42, -0.42, -0.42, 0.42, 0.42, 0.42, 0xa07a48, { topColor: 0xb08a58, bottom: true });
      vb.box(-0.44, -0.08, -0.44, 0.44, 0.08, 0.44, 0x5a3a20, { bottom: true });
    } else if (kind === 'barrel') {
      vb.box(-0.38, -0.5, -0.38, 0.38, 0.5, 0.38, 0x8a5a32, { topColor: 0x9a6a3a, bottom: true });
      vb.box(-0.4, -0.32, -0.4, 0.4, -0.22, 0.4, 0x4a4a4a, { bottom: true });
      vb.box(-0.4, 0.22, -0.4, 0.4, 0.32, 0.4, 0x4a4a4a, { bottom: true });
    } else {
      vb.box(-0.24, -0.26, -0.24, 0.24, 0.26, 0.24, 0x8a949c, { bottom: true });
      vb.box(-0.2, 0.2, -0.2, 0.2, 0.27, 0.2, 0x2a5a8a);
    }
  }).geometry;
}

export class PhysicsProps {
  constructor(scene) {
    this.scene = scene;
    this.bodies = [];
    this.geos = {};
    const place = [
      ['ball', 28, 47], ['ball', 36, 53], ['ball', 60, 72], ['crate', 64, 41], ['crate', 64.2, 42.2], ['barrel', 44, 70], ['bucket', 27, 43],
      ['crate', 22, 62], ['barrel', 8, 58], ['ball', -4, 34],
      ['pumpkin', -60, 108], ['pumpkin', -63, 110], ['pumpkin', -58, 111], ['pumpkin', -70, 96], ['crate', -86, 77], ['barrel', -64, 90], ['bucket', -52, 93],
      ['barrel', 266, 99], ['crate', 255, 108], ['crate', 255.2, 109.4], ['bucket', 260, 101],
      ['barrel', 78, -10], ['crate', 158, -54],
    ];
    for (const [k, x, z] of place) this.add(k, x, z);
  }
  add(kind, x, z) {
    const T = TYPES[kind];
    if (!this.geos[kind]) this.geos[kind] = geoFor(kind);
    const mesh = new THREE.Mesh(this.geos[kind], G.worldMat);
    mesh.castShadow = true;
    this.scene.add(mesh);
    const y = G.physics.groundAt(x, z, 200);
    const b = { kind, T, mesh, pos: new THREE.Vector3(x, y + T.r, z), vel: new THREE.Vector3(), q: new THREE.Quaternion(), rest: 0 };
    mesh.rotation.y = Math.random() * 6;
    b.q.copy(mesh.quaternion);
    mesh.position.copy(b.pos);
    this.bodies.push(b);
    return b;
  }

  // kick everything in a radius away from a point
  impulseRadius(x, y, z, r, force) {
    for (const b of this.bodies) {
      const d = Math.hypot(b.pos.x - x, b.pos.z - z);
      if (d > r || Math.abs(b.pos.y - y) > 4) continue;
      const k = (1 - d / r) * force / b.T.mass;
      const nx = (b.pos.x - x) / (d || 1), nz = (b.pos.z - z) / (d || 1);
      b.vel.x += nx * k; b.vel.z += nz * k; b.vel.y += k * 0.45;
      b.rest = 0;
    }
  }
  // sword swing: push bodies in front of the player
  hitArc(pos, yaw, reach, arc, force) {
    let hit = false;
    for (const b of this.bodies) {
      const dx = b.pos.x - pos.x, dz = b.pos.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > reach + b.T.r || Math.abs(b.pos.y - pos.y - 0.5) > 2) continue;
      let a = Math.atan2(dx, dz) - yaw; a = Math.atan2(Math.sin(a), Math.cos(a));
      if (Math.abs(a) > arc) continue;
      const k = force / b.T.mass;
      b.vel.x += Math.sin(yaw) * k + dx / (d || 1) * k * 0.3; b.vel.z += Math.cos(yaw) * k + dz / (d || 1) * k * 0.3; b.vel.y += k * 0.35;
      b.rest = 0; hit = true;
      G.particles.dust(b.pos.x, b.pos.y - b.T.r, b.pos.z, 3);
    }
    if (hit) G.audio.sfx('hit', { vol: 0.5 });
  }

  update(dt) {
    const P = G.player;
    const pv = P.hv || { x: 0, z: 0 };
    const tmp = new THREE.Vector3(), axis = new THREE.Vector3(), dq = new THREE.Quaternion();
    for (const b of this.bodies) {
      const T = b.T;
      const dP = dist2d(b.pos.x, b.pos.z, P.pos.x, P.pos.z);
      if (dP > 80) { b.mesh.visible = false; continue; }
      b.mesh.visible = true;
      // player push (walk into it to push, run into it to kick)
      const rr = T.r + P.radius;
      if (dP < rr && Math.abs(P.pos.y + 0.6 - b.pos.y) < 1.2) {
        const nx = (b.pos.x - P.pos.x) / (dP || 1), nz = (b.pos.z - P.pos.z) / (dP || 1);
        const into = Math.max(0, pv.x * nx + pv.z * nz);
        b.pos.x = P.pos.x + nx * rr; b.pos.z = P.pos.z + nz * rr;
        const kick = into * (1.1 / T.mass + 0.25);
        b.vel.x += nx * kick * 0.6; b.vel.z += nz * kick * 0.6;
        if (into > 6 && T.mass < 1) b.vel.y += 2.5;
        b.rest = 0;
      }
      if (b.rest > 1.5 && b.vel.lengthSq() < 0.01) continue; // sleeping
      // integrate
      const water = G.physics.waterLevel(b.pos.x, b.pos.z);
      b.vel.y -= 22 * dt;
      if (b.pos.y < water && !b.wet && b.vel.y < -4) G.water.splash(b.pos.x, b.pos.z, 0.4);
      b.wet = b.pos.y < water;
      if (T.float && b.pos.y < water) { b.vel.y += 30 * dt * Math.min(1, (water - b.pos.y) * 2); b.vel.multiplyScalar(Math.max(0, 1 - dt * 2.5)); }
      const ox = b.pos.x, oz = b.pos.z;
      G.physics.move(b.pos, b.vel.x * dt, b.vel.z * dt, T.r * 0.8, T.r * 2, false);
      // bounce off walls
      if (Math.abs(b.pos.x - ox - b.vel.x * dt) > 1e-3) b.vel.x *= -T.bounce;
      if (Math.abs(b.pos.z - oz - b.vel.z * dt) > 1e-3) b.vel.z *= -T.bounce;
      b.pos.y += b.vel.y * dt;
      const g = G.physics.groundAt(b.pos.x, b.pos.z, b.pos.y - T.r + 0.6, T.r * 0.5) + T.r;
      let grounded = false;
      if (b.pos.y <= g) {
        b.pos.y = g;
        if (b.vel.y < -3) { b.vel.y = -b.vel.y * T.bounce; if (Math.abs(b.vel.y) > 2) G.audio.sfxAt(b.kind === 'ball' ? 'jump' : 'land', b.pos.x, b.pos.z, { vol: 0.35, range: 25 }); }
        else b.vel.y = 0;
        grounded = true;
        const f = Math.max(0, 1 - T.friction * dt);
        b.vel.x *= f; b.vel.z *= f;
      }
      // separation between bodies
      for (const o of this.bodies) {
        if (o === b) continue;
        const dx = o.pos.x - b.pos.x, dz = o.pos.z - b.pos.z, dy = o.pos.y - b.pos.y;
        const d = Math.hypot(dx, dy, dz), m = T.r + o.T.r;
        if (d < m && d > 1e-4) {
          const push = (m - d) / 2;
          b.pos.x -= dx / d * push; b.pos.z -= dz / d * push; b.pos.y -= dy / d * push;
          o.pos.x += dx / d * push; o.pos.z += dz / d * push; o.pos.y += dy / d * push;
          o.vel.x += b.vel.x * 0.3; o.vel.z += b.vel.z * 0.3; o.rest = 0;
        }
      }
      // rolling rotation (crates tumble less)
      const hs = Math.hypot(b.vel.x, b.vel.z);
      if (hs > 0.05 && (grounded || b.kind === 'ball')) {
        axis.set(b.vel.z, 0, -b.vel.x).normalize();
        dq.setFromAxisAngle(axis, (hs * dt / T.r) * (T.box ? 0.35 : 1));
        b.mesh.quaternion.premultiply(dq);
      } else if (T.box && grounded) {
        // settle crates flat
        tmp.set(0, 1, 0).applyQuaternion(b.mesh.quaternion);
        const e = new THREE.Euler().setFromQuaternion(b.mesh.quaternion, 'YXZ');
        e.x *= 0.85; e.z *= 0.85;
        b.mesh.quaternion.setFromEuler(e);
      }
      b.rest = hs < 0.08 && grounded && Math.abs(b.vel.y) < 0.1 ? b.rest + dt : 0;
      if (b.pos.y < -20) { b.pos.set(ox, G.physics.groundAt(ox, oz, 200) + T.r + 1, oz); b.vel.set(0, 0, 0); }
      b.mesh.position.copy(b.pos);
    }
  }
}
