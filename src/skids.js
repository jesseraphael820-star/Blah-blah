import * as THREE from 'three';
import { heightAt } from './world.js';

// marcas de pneu no chão (anel de quads; as mais velhas são reaproveitadas)
export class Skids {
  constructor(scene, N = 4000) {
    this.N = N;
    this.pos = new Float32Array(N * 4 * 3);
    this.col = new Float32Array(N * 4 * 4);
    const idx = new Uint32Array(N * 6);
    for (let i = 0; i < N; i++) idx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3], i * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.i = 0;
    this.dirty = false;
  }

  quad(ax, az, bx, bz, w, rgb, alpha) {
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1;
    const nx = (-dz / L) * w / 2, nz = (dx / L) * w / 2;
    const ya = heightAt(ax, az) + 0.09, yb = heightAt(bx, bz) + 0.09;
    const o = this.i * 12;
    this.pos.set([ax + nx, ya, az + nz, ax - nx, ya, az - nz, bx + nx, yb, bz + nz, bx - nx, yb, bz - nz], o);
    const c = this.i * 16;
    for (let k = 0; k < 4; k++) this.col.set([rgb[0], rgb[1], rgb[2], alpha], c + k * 4);
    this.i = (this.i + 1) % this.N;
    this.dirty = true;
  }

  // chamado por carro a cada quadro
  track(v, dt, onSmoke) {
    const t = v.t;
    if (!v.onGround || v.inWater || v.speed < 1.2) { v._skid = null; return; }
    const sh = Math.sin(v.heading), ch = Math.cos(v.heading);
    const wx = t.twoWheel ? [0, 0] : [t.width / 2 - 0.13, -(t.width / 2 - 0.13)];
    const wheels = [];
    for (const x of wx) { wheels.push([x, t.a, true]); wheels.push([x, -t.b, false]); }
    if (!v._skid) v._skid = wheels.map(() => null);
    const road = v.surface === 'road' || v.surface === 'walk';
    const rgb = road ? [0.03, 0.03, 0.03] : [0.22, 0.16, 0.09];
    wheels.forEach(([x, z, front], i) => {
      const slideLat = Math.abs(front ? v.alphaF : v.alphaR) > 0.22 && v.speed > 4;
      const skid = (front ? v.lockF : v.lockR) || (!front && v.slipR > 0.12) || slideLat;
      const px = v.pos.x + ch * x + sh * z, pz = v.pos.z - sh * x + ch * z;
      if (!skid) { v._skid[i] = null; return; }
      const last = v._skid[i];
      if (!last) { v._skid[i] = [px, pz]; return; }
      if (Math.hypot(px - last[0], pz - last[1]) < 0.35) return;
      const strength = (front ? v.lockF : v.lockR) ? 0.75 : 0.55;
      this.quad(last[0], last[1], px, pz, t.twoWheel ? 0.12 : 0.24, rgb, strength);
      v._skid[i] = [px, pz];
      if (road && onSmoke && Math.random() < dt * 20) onSmoke(px, heightAt(px, pz) + 0.2, pz);
    });
  }

  flush() {
    if (!this.dirty) return;
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.dirty = false;
  }
}
