// Particles, tracers, explosions and mission markers.
import * as THREE from 'three';
import { makeSoftDot } from './textures.js';

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.dot = makeSoftDot();
    this.parts = [];
    this.pool = [];
    this.tracers = [];
    this.flash = new THREE.PointLight(0xffc070, 0, 14, 2); scene.add(this.flash);
    this.boom = new THREE.PointLight(0xff8030, 0, 60, 1.6); scene.add(this.boom);
    this.flashT = 0; this.boomT = 0;
  }
  spawn(pos, { vel = new THREE.Vector3(), color = 0xffffff, size = 0.5, grow = 1, life = 1, gravity = 0, additive = false, opacity = 1, drag = 0.5 }) {
    let s = this.pool.pop();
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dot, transparent: true, depthWrite: false }));
      this.scene.add(s);
    }
    s.visible = true;
    s.material.color.set(color); s.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    s.material.opacity = opacity;
    s.position.copy(pos); s.scale.setScalar(size);
    this.parts.push({ s, vel: vel.clone(), life, max: life, size, grow, gravity, opacity, drag });
    if (this.parts.length > 400) this.kill(0);
  }
  kill(i) { const p = this.parts[i]; p.s.visible = false; this.pool.push(p.s); this.parts.splice(i, 1); }
  smoke(pos, dark = false) {
    this.spawn(pos, { vel: new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.5 + Math.random(), (Math.random() - 0.5) * 0.6), color: dark ? 0x222222 : 0x9a9a9a, size: 0.6, grow: 2.2, life: 2.2, opacity: 0.55 });
  }
  fire(pos) {
    this.spawn(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0, (Math.random() - 0.5) * 1.2)), { vel: new THREE.Vector3(0, 2 + Math.random() * 2, 0), color: Math.random() < 0.5 ? 0xff7a1a : 0xffc040, size: 0.9, grow: -0.4, life: 0.7, additive: true });
  }
  sparks(pos, n = 8) {
    for (let i = 0; i < n; i++) this.spawn(pos, { vel: new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 5, (Math.random() - 0.5) * 8), color: 0xffd080, size: 0.12, grow: -0.1, life: 0.5, gravity: 12, additive: true, drag: 0.1 });
  }
  blood(pos, n = 6) {
    for (let i = 0; i < n; i++) this.spawn(pos, { vel: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3), color: 0x8a0a0a, size: 0.14, grow: 0, life: 0.6, gravity: 9, drag: 0.1 });
  }
  dust(pos) { this.spawn(pos, { vel: new THREE.Vector3((Math.random() - 0.5), 0.6, (Math.random() - 0.5)), color: 0xbbb0a0, size: 0.4, grow: 1.5, life: 0.9, opacity: 0.35 }); }
  muzzle(pos) { this.flash.position.copy(pos); this.flash.intensity = 30; this.flashT = 0.06; this.spawn(pos, { color: 0xffe0a0, size: 0.5, grow: -4, life: 0.06, additive: true }); }
  explosion(pos) {
    this.boom.position.copy(pos).add(new THREE.Vector3(0, 2, 0)); this.boom.intensity = 900; this.boomT = 0.8;
    for (let i = 0; i < 40; i++) this.spawn(pos.clone().add(new THREE.Vector3(0, 1, 0)), { vel: new THREE.Vector3((Math.random() - 0.5) * 14, Math.random() * 10, (Math.random() - 0.5) * 14), color: [0xff5a10, 0xffb030, 0xffe080][i % 3], size: 1.4, grow: 1.5, life: 0.9, additive: true, drag: 2 });
    for (let i = 0; i < 25; i++) this.spawn(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), { vel: new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 5, (Math.random() - 0.5) * 6), color: 0x1a1a1a, size: 2, grow: 3, life: 3, opacity: 0.7, drag: 1.2 });
    this.sparks(pos.clone().add(new THREE.Vector3(0, 1, 0)), 30);
  }
  tracer(a, b) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
    this.scene.add(l); this.tracers.push({ l, t: 0.07 });
  }
  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.kill(i); continue; }
      p.vel.y -= p.gravity * dt; p.vel.multiplyScalar(Math.exp(-p.drag * dt));
      p.s.position.addScaledVector(p.vel, dt);
      if (p.gravity && p.s.position.y < 0.05) { p.s.position.y = 0.05; p.vel.set(0, 0, 0); }
      p.s.scale.setScalar(Math.max(0.01, p.s.scale.x + p.grow * dt));
      p.s.material.opacity = p.opacity * Math.min(1, (p.life / p.max) * 2);
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]; t.t -= dt;
      if (t.t <= 0) { this.scene.remove(t.l); t.l.geometry.dispose(); t.l.material.dispose(); this.tracers.splice(i, 1); }
    }
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash.intensity = 0; }
    if (this.boomT > 0) { this.boomT -= dt; this.boom.intensity = Math.max(0, this.boomT / 0.8) * 900; }
  }
}

// glowing column marker (mission start / checkpoints / destinations)
export class Marker {
  constructor(scene, pos, color = 0xffd23a, radius = 1.6, height = 3) {
    this.scene = scene;
    this.group = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 32, 1, true), m);
    cyl.position.y = height / 2; this.group.add(cyl);
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.8, radius, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; this.group.add(ring);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 4), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.5 }));
    arrow.rotation.x = Math.PI; arrow.position.y = height + 1.2; this.group.add(arrow);
    this.arrow = arrow; this.cyl = cyl;
    this.group.position.copy(pos);
    this.radius = radius; this.color = color;
    scene.add(this.group);
  }
  get pos() { return this.group.position; }
  update(dt) {
    const t = performance.now() / 1000;
    this.arrow.position.y = this.cyl.geometry.parameters.height + 1.2 + Math.sin(t * 3) * 0.25;
    this.arrow.rotation.y += dt * 2;
    this.cyl.material.opacity = 0.25 + Math.sin(t * 4) * 0.08;
  }
  dispose() { this.scene.remove(this.group); }
}
