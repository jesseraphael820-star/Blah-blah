// World container: terrain chunks, static voxel props (merged per chunk),
// emitters (smoke/fire), glow points, dynamic objects, lights and interactables.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { WORLD } from '../data/world.js';
import { Terrain } from './terrain.js';
import { VoxelBuilder, getWorldMaterial, WorldUniforms } from '../render/voxel.js';
import { dist2d } from '../core/utils.js';

const CH = 32; // cells per chunk
const CHUNK_SIZE = CH * WORLD.cell;
const NCH = WORLD.n / CH;

const GLOW_VS = `
attribute float size; attribute vec3 gcol; attribute float night;
uniform float uNight; uniform float uScale; uniform float uTime;
varying vec3 vCol; varying float vA;
#include <fog_pars_vertex>
void main(){
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float flick = 0.9 + 0.1 * sin(uTime * 7.0 + position.x * 3.0 + position.z);
  vA = mix(1.0, uNight, night) * flick;
  vCol = gcol;
  gl_PointSize = min(size * uScale / max(0.5, -mvPosition.z), 90.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const GLOW_FS = `
varying vec3 vCol; varying float vA;
#include <fog_pars_fragment>
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  a = floor(a * 5.0) / 5.0; // pixel-art banding
  if (a * vA < 0.02) discard;
  gl_FragColor = vec4(vCol * a * vA * 0.7, 1.0);
  #include <fog_fragment>
}`;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.terrain = new Terrain();
    this.chunks = [];
    this.extra = [];           // builders outside the terrain grid (cave)
    this.smokes = [];
    this.fires = [];
    this.glowsData = [];
    this.lightsSpots = [];     // candidate positions for dynamic point lights
    this.dynamics = [];
    this.interactables = [];
    this.viewDist = 220;
    this.group = new THREE.Group();
    scene.add(this.group);
    for (let j = 0; j < NCH; j++) for (let i = 0; i < NCH; i++) {
      this.chunks.push({ i, j, cx: -WORLD.half + (i + 0.5) * CHUNK_SIZE, cz: -WORLD.half + (j + 0.5) * CHUNK_SIZE, vb: new VoxelBuilder(), mesh: null, props: null, built: false });
    }
  }

  // ---------- builder API used by structures/worldgen ----------
  ground(x, z) { return G.physics.terrainHeight(x, z); }
  chunkAt(x, z) {
    const i = Math.floor((x + WORLD.half) / CHUNK_SIZE), j = Math.floor((z + WORLD.half) / CHUNK_SIZE);
    if (i < 0 || j < 0 || i >= NCH || j >= NCH) return null;
    return this.chunks[j * NCH + i];
  }
  box(x0, y0, z0, x1, y1, z1, color, o = {}) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const ch = this.chunkAt(cx, cz);
    const vb = ch ? ch.vb : this.extraBuilder(cx, cz);
    vb.box(x0, y0, z0, x1, y1, z1, color, o);
    if (o.col) this.collider(x0, y0, z0, x1, y1, z1, o);
  }
  extraBuilder(cx, cz) {
    let e = this.extra.find((q) => Math.abs(q.cx - cx) < 40 && Math.abs(q.cz - cz) < 40);
    if (!e) { e = { cx: Math.round(cx / 80) * 80, cz: Math.round(cz / 80) * 80, vb: new VoxelBuilder(), mesh: null }; this.extra.push(e); }
    return e.vb;
  }
  collider(x0, y0, z0, x1, y1, z1, o = {}) {
    const c = G.physics.addBox(x0, y0, z0, x1, y1, z1, o.tag);
    if (o.noCam) c.noCam = true;
    if (o.surface) c.surface = o.surface;
    return c;
  }
  cyl(x, z, r, y0, y1) { return G.physics.addCyl(x, z, r, y0, y1); }
  flag(x0, z0, x1, z1, f) { this.terrain.markRect(x0, z0, x1, z1, f); }
  smoke(x, y, z, color = 0xb8b8b8) { this.smokes.push({ x, y, z, color, acc: Math.random() }); }
  fire(x, y, z, scale = 1, light = false) {
    this.fires.push({ x, y, z, scale, acc: 0 });
    if (light) this.lightsSpots.push({ x, y: y + 0.6, z, color: 0xff8a3a, intensity: 2.2 * scale + 1, dist: 14, always: true });
  }
  glow(x, y, z, color, size = 2, nightOnly = true) {
    this.glowsData.push({ x, y, z, color, size, night: nightOnly ? 1 : 0 });
    if (nightOnly && size >= 1.5) this.lightsSpots.push({ x, y, z, color, intensity: 1.6, dist: 11, always: false });
  }
  dynamic(obj, update) { this.scene.add(obj); this.dynamics.push({ obj, update }); return obj; }
  addInteractable(def) { this.interactables.push(def); return def; }

  // ---------- finalize ----------
  buildGlows() {
    const n = this.glowsData.length;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), night = new Float32Array(n);
    this.glowsData.forEach((g, i) => {
      pos.set([g.x, g.y, g.z], i * 3);
      col.set([((g.color >> 16) & 255) / 255, ((g.color >> 8) & 255) / 255, (g.color & 255) / 255], i * 3);
      size[i] = g.size; night[i] = g.night;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('gcol', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('night', new THREE.BufferAttribute(night, 1));
    this.glowMat = new THREE.ShaderMaterial({
      vertexShader: GLOW_VS, fragmentShader: GLOW_FS,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uNight: { value: 0 }, uScale: { value: 300 }, uTime: { value: 0 } }]),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
    });
    this.glowPoints = new THREE.Points(geo, this.glowMat);
    this.glowPoints.frustumCulled = false;
    this.scene.add(this.glowPoints);
    // point light pool
    this.lightPool = [];
    const nL = G.mobile ? 2 : 4;
    for (let i = 0; i < nL; i++) {
      const l = new THREE.PointLight(0xffa050, 0, 12, 1.6);
      l.castShadow = false;
      this.scene.add(l);
      this.lightPool.push(l);
    }
  }

  buildChunkMeshes(ch) {
    const mat = getWorldMaterial();
    const tvb = this.terrain.buildChunk(ch.i, ch.j, CH);
    ch.mesh = new THREE.Mesh(tvb.build(), mat);
    ch.mesh.receiveShadow = true;
    ch.mesh.castShadow = true;
    this.group.add(ch.mesh);
    if (!ch.vb.empty) {
      ch.props = new THREE.Mesh(ch.vb.build(), mat);
      ch.props.castShadow = true; ch.props.receiveShadow = true;
      this.group.add(ch.props);
    }
    ch.vb = null; // free memory
    ch.built = true;
  }
  buildExtras() {
    const mat = getWorldMaterial();
    for (const e of this.extra) {
      if (e.mesh || e.vb.empty) continue;
      e.mesh = new THREE.Mesh(e.vb.build(), mat);
      e.mesh.castShadow = true; e.mesh.receiveShadow = true;
      this.group.add(e.mesh);
    }
  }
  // Build chunks near a point synchronously (loading screen)
  prebuild(x, z, radius) {
    for (const ch of this.chunks) if (!ch.built && dist2d(ch.cx, ch.cz, x, z) < radius) this.buildChunkMeshes(ch);
  }
  get builtCount() { return this.chunks.filter((c) => c.built).length; }

  // ---------- per frame ----------
  update(dt, camPos, nightF) {
    WorldUniforms.uTime.value = G.time;
    WorldUniforms.uNight.value = nightF;
    // lazy chunk streaming (one per frame) and distance culling
    let best = null, bd = Infinity;
    for (const ch of this.chunks) {
      const d = dist2d(ch.cx, ch.cz, camPos.x, camPos.z) - CHUNK_SIZE * 0.7;
      if (!ch.built) { if (d < this.viewDist && d < bd) { bd = d; best = ch; } continue; }
      const vis = d < this.viewDist;
      ch.mesh.visible = vis;
      if (ch.props) ch.props.visible = vis && d < this.viewDist * 0.95;
    }
    if (best) this.buildChunkMeshes(best);

    // emitters near camera
    const P = G.particles;
    for (const s of this.smokes) {
      if (Math.abs(s.x - camPos.x) > 90 || Math.abs(s.z - camPos.z) > 90) continue;
      s.acc += dt;
      if (s.acc > 0.35) { s.acc = 0; P.smoke(s.x, s.y, s.z, s.color); }
    }
    let fireNear = 0;
    for (const f of this.fires) {
      const d = dist2d(f.x, f.z, camPos.x, camPos.z);
      if (d > 70) continue;
      fireNear = Math.max(fireNear, 1 - d / 12);
      f.acc += dt;
      while (f.acc > 0.06 / f.scale) { f.acc -= 0.06 / f.scale; P.fire(f.x, f.y, f.z, f.scale); }
    }
    this.fireNear = Math.max(0, fireNear);
    for (const d of this.dynamics) d.update(dt, G.time);
    if (this.glowMat) {
      this.glowMat.uniforms.uNight.value = nightF;
      this.glowMat.uniforms.uTime.value = G.time;
    }
    this.updateLights(camPos, nightF);
  }

  updateLights(p, nightF) {
    if (!this.lightPool) return;
    const cand = [];
    for (const s of this.lightsSpots) {
      if (!s.always && nightF < 0.1) continue;
      const d = (s.x - p.x) ** 2 + (s.z - p.z) ** 2;
      if (d < 50 * 50) cand.push([d, s]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    this.lightPool.forEach((l, i) => {
      const c = cand[i];
      if (!c) { l.intensity = 0; return; }
      const s = c[1];
      l.position.set(s.x, s.y, s.z);
      l.color.setHex(s.color);
      l.distance = s.dist;
      const k = s.always ? Math.max(0.35, nightF) : nightF;
      l.intensity = s.intensity * k * (0.9 + Math.sin(G.time * 9 + i) * 0.1) * 3;
    });
  }
}

export { CHUNK_SIZE };
