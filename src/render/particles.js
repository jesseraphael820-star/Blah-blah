// Pooled square-pixel particles (sparks, magic, dust, smoke, fire, debris).
import * as THREE from 'three';

const VS = `
attribute float size; attribute vec4 pcol;
varying vec4 vCol;
uniform float uScale;
#include <fog_pars_vertex>
void main(){
  vCol = pcol;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uScale / max(0.1, -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FS = `
varying vec4 vCol;
#include <fog_pars_fragment>
void main(){
  if (vCol.a < 0.01) discard;
  gl_FragColor = vCol;
  #include <fog_fragment>
}`;

class Pool {
  constructor(scene, max, additive) {
    this.max = max;
    this.n = 0;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.c = new Float32Array(max * 4);
    this.s = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.alpha0 = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.c, 4).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.s, 1).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.posAttr);
    this.geo.setAttribute('pcol', this.colAttr);
    this.geo.setAttribute('size', this.sizeAttr);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uScale: { value: 300 } }]),
      transparent: true, depthWrite: false, fog: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 10 : 9;
    scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, color, size, life, o = {}) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.c[i * 4] = ((color >> 16) & 255) / 255;
    this.c[i * 4 + 1] = ((color >> 8) & 255) / 255;
    this.c[i * 4 + 2] = (color & 255) / 255;
    this.alpha0[i] = o.alpha ?? 1;
    this.c[i * 4 + 3] = this.alpha0[i];
    this.s[i] = size;
    this.life[i] = life; this.maxLife[i] = life;
    this.grav[i] = o.gravity ?? 0;
    this.drag[i] = o.drag ?? 0;
    this.grow[i] = o.grow ?? 0;
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.kill(i); continue; }
      const k = i * 3;
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.v[k] *= d; this.v[k + 1] = this.v[k + 1] * d - this.grav[i] * dt; this.v[k + 2] *= d;
      this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.c[i * 4 + 3] = this.alpha0[i] * Math.min(1, t * 2.5);
      this.s[i] = Math.max(0, this.s[i] + this.grow[i] * dt);
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    this.posAttr.needsUpdate = true; this.colAttr.needsUpdate = true; this.sizeAttr.needsUpdate = true;
  }
  kill(i) {
    const j = --this.n;
    if (i === j) return;
    for (let a = 0; a < 3; a++) { this.p[i * 3 + a] = this.p[j * 3 + a]; this.v[i * 3 + a] = this.v[j * 3 + a]; }
    for (let a = 0; a < 4; a++) this.c[i * 4 + a] = this.c[j * 4 + a];
    this.s[i] = this.s[j]; this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j];
    this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j]; this.grow[i] = this.grow[j]; this.alpha0[i] = this.alpha0[j];
  }
}

export class Particles {
  constructor(scene, mobile) {
    this.glow = new Pool(scene, mobile ? 1500 : 3500, true);
    this.solid = new Pool(scene, mobile ? 1200 : 2500, false);
  }
  setScale(s) { this.glow.mat.uniforms.uScale.value = s; this.solid.mat.uniforms.uScale.value = s; }
  update(dt) { this.glow.update(dt); this.solid.update(dt); }

  // ---------- presets ----------
  burst(x, y, z, color, n = 12, speed = 4, o = {}) {
    const pool = o.solid ? this.solid : this.glow;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      pool.spawn(x, y, z, Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + (o.up || 0), Math.sin(a) * Math.cos(b) * s,
        color, (o.size || 0.25) * (0.6 + Math.random() * 0.8), (o.life || 0.6) * (0.6 + Math.random() * 0.6),
        { gravity: o.gravity ?? 6, drag: o.drag ?? 2 });
    }
  }
  ring(x, y, z, color, radius, n = 32, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sp = o.speed ?? 6;
      this.glow.spawn(x + Math.cos(a) * radius * 0.2, y, z + Math.sin(a) * radius * 0.2, Math.cos(a) * sp, o.up || 0.5, Math.sin(a) * sp,
        color, o.size || 0.3, o.life || 0.5, { drag: 3 });
    }
  }
  dust(x, y, z, n = 4, color = 0xb8a07a) {
    for (let i = 0; i < n; i++) {
      this.solid.spawn(x + (Math.random() - 0.5) * 0.5, y + 0.1, z + (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 1.5, Math.random() * 1.2, (Math.random() - 0.5) * 1.5, color, 0.25 + Math.random() * 0.2, 0.5 + Math.random() * 0.4,
        { gravity: 1, drag: 3, alpha: 0.6, grow: 0.3 });
    }
  }
  smoke(x, y, z, color = 0xbbbbbb) {
    this.solid.spawn(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3,
      0.3 + Math.random() * 0.3, 0.9 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3, color, 0.5, 3.5,
      { gravity: -0.05, drag: 0.3, alpha: 0.45, grow: 0.35 });
  }
  fire(x, y, z, scale = 1) {
    const c = Math.random() < 0.5 ? 0xff7a1a : Math.random() < 0.5 ? 0xffc83a : 0xff3a1a;
    this.glow.spawn(x + (Math.random() - 0.5) * 0.5 * scale, y, z + (Math.random() - 0.5) * 0.5 * scale,
      (Math.random() - 0.5) * 0.4, 1.5 + Math.random() * 1.5 * scale, (Math.random() - 0.5) * 0.4, c, 0.3 * scale, 0.5 + Math.random() * 0.4,
      { gravity: -0.5, drag: 1 });
  }
  trail(x, y, z, color, size = 0.2, life = 0.35) {
    this.glow.spawn(x, y, z, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, color, size, life, { drag: 2 });
  }
  splash(x, y, z, n = 8) {
    for (let i = 0; i < n; i++) {
      this.solid.spawn(x, y + 0.05, z, (Math.random() - 0.5) * 2.5, 2 + Math.random() * 2.5, (Math.random() - 0.5) * 2.5, 0xcfe8ff, 0.18, 0.6, { gravity: 12, alpha: 0.8 });
    }
  }
}
