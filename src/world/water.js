// Stylized water: animated waves, fresnel sky reflection, sun glints,
// pixel shoreline foam (from heightmap), rain ripples, and a waterfall.
import * as THREE from 'three';
import { WORLD, STREAM } from '../data/world.js';
import { G } from '../core/context.js';

const VS = `
uniform float uTime;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float w = sin(wp.x*0.35 + uTime*1.3)*0.06 + sin(wp.z*0.5 - uTime*1.7)*0.05 + sin((wp.x+wp.z)*0.8 + uTime*2.3)*0.025;
  wp.y += w;
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FS = `
uniform sampler2D uHeight; uniform float uSize; uniform float uLevel; uniform float uTime;
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uLight; uniform float uRain;
varying vec3 vWorld;
#include <fog_pars_fragment>
void main(){
  vec2 uv = (vWorld.xz + uSize*0.5)/uSize;
  float th = texture2D(uHeight, uv).r;
  float depth = uLevel - th;
  if (depth < 0.0) discard;
  vec2 q = floor(vWorld.xz * 4.0) / 4.0; // pixelated normal sampling
  float t = uTime;
  vec3 n = normalize(vec3(
    cos(q.x*0.35+t*1.3)*0.03 + cos((q.x+q.y)*0.8+t*2.3)*0.03 + sin(q.x*2.1 + q.y*1.3 + t*3.0)*0.05,
    1.0,
    cos(q.y*0.5 - t*1.7)*0.03 + cos((q.x+q.y)*0.8+t*2.3)*0.03 + sin(q.y*2.4 - q.x*1.1 + t*2.6)*0.05));
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  vec3 shallow = vec3(0.22, 0.68, 0.74);
  vec3 deep = vec3(0.04, 0.22, 0.42);
  vec3 col = mix(shallow, deep, smoothstep(0.0, 4.5, depth));
  // caustic shimmer in shallow water
  float c = sin(q.x*1.7 + t*1.1) * sin(q.y*1.9 - t*1.3);
  col += vec3(0.08, 0.12, 0.1) * step(0.55, c) * (1.0 - smoothstep(0.0, 2.5, depth));
  col *= uLight;
  col = mix(col, uSky, clamp(fres * 0.75, 0.0, 0.85));
  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(n, H), 0.0), 180.0);
  col += uSunCol * step(0.4, spec) * 1.4;
  // shoreline foam (blocky, animated)
  float foamBand = 1.0 - smoothstep(0.0, 1.05, depth);
  float wob = 0.5 + 0.5 * sin(uTime * 2.2 + vWorld.x * 1.3 + vWorld.z * 0.9);
  col = mix(col, vec3(0.92, 0.97, 1.0) * max(uLight, vec3(0.25)), step(0.62, foamBand * (0.55 + 0.45 * wob)));
  // rain ripples
  if (uRain > 0.01) {
    vec2 rq = vWorld.xz * 0.8;
    vec2 cell = floor(rq); vec2 f = fract(rq) - 0.5;
    float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
    float ph = fract(uTime * 1.1 + h);
    float ring = abs(length(f) - ph * 0.45);
    col += vec3(0.5) * uRain * step(ring, 0.035) * (1.0 - ph) * uLight;
  }
  float alpha = clamp(0.62 + depth * 0.12 + fres * 0.3, 0.62, 0.94);
  gl_FragColor = vec4(col, alpha);
  #include <fog_fragment>
}`;

const FALL_VS = `
varying vec2 vUv; varying vec3 vWorld;
#include <fog_pars_vertex>
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FALL_FS = `
uniform float uTime; uniform vec3 uLight;
varying vec2 vUv; varying vec3 vWorld;
#include <fog_pars_fragment>
void main(){
  vec2 p = floor(vec2(vUv.x * 24.0, vUv.y * 60.0));
  float col = fract(sin(p.x * 91.7) * 47.3);
  float s = fract(vUv.y * 3.0 + uTime * (1.6 + col) + col);
  float streak = step(0.55, s);
  vec3 c = mix(vec3(0.35, 0.7, 0.85), vec3(0.85, 0.95, 1.0), streak);
  c = mix(c, vec3(1.0), smoothstep(0.12, 0.0, vUv.y));
  gl_FragColor = vec4(c * uLight, 0.82);
  #include <fog_fragment>
}`;

export class Water {
  constructor(scene, heightTex) {
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uHeight: { value: null }, uSize: { value: WORLD.size }, uLevel: { value: WORLD.water },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) },
      uSky: { value: new THREE.Color(0.6, 0.8, 1) }, uLight: { value: new THREE.Color(1, 1, 1) }, uRain: { value: 0 },
    }]);
    this.uniforms.uHeight.value = heightTex;
    const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: this.uniforms, transparent: true, fog: true, depthWrite: false });
    const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, 160, 160);
    geo.rotateX(-Math.PI / 2);
    this.main = new THREE.Mesh(geo, mat);
    this.main.position.y = WORLD.water - 0.15;
    this.main.renderOrder = 2;
    scene.add(this.main);
    // plateau stream (second water level, shares uniforms except level)
    const smat = mat.clone();
    smat.uniforms = THREE.UniformsUtils.clone(this.uniforms);
    smat.uniforms.uHeight.value = heightTex;
    smat.uniforms.uLevel.value = STREAM.level;
    this.streamMat = smat;
    const sgeo = new THREE.PlaneGeometry(STREAM.x1 - STREAM.x0, STREAM.z1 - STREAM.z0 + 0.6, 8, 40);
    sgeo.rotateX(-Math.PI / 2);
    this.stream = new THREE.Mesh(sgeo, smat);
    this.stream.position.set((STREAM.x0 + STREAM.x1) / 2, STREAM.level - 0.1, (STREAM.z0 + STREAM.z1) / 2 + 0.3);
    this.stream.renderOrder = 2;
    scene.add(this.stream);
    // waterfall sheet
    this.fallU = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uLight: { value: new THREE.Color(1, 1, 1) } }]);
    const fmat = new THREE.ShaderMaterial({ vertexShader: FALL_VS, fragmentShader: FALL_FS, uniforms: this.fallU, transparent: true, fog: true, side: THREE.DoubleSide, depthWrite: false });
    const fgeo = new THREE.PlaneGeometry(11, STREAM.level + 0.4, 1, 1);
    this.fall = new THREE.Mesh(fgeo, fmat);
    this.fall.position.set(110.5, (STREAM.level + 0.4) / 2 - 0.2, -92.6);
    this.fall.renderOrder = 3;
    scene.add(this.fall);
    this.fallPos = { x: 110.5, y: 0.2, z: -91.5 };
  }

  // splash + expanding foam ring + ripples (falling or jumping into water)
  splash(x, z, strength = 1) {
    const y = G.physics.waterLevel(x, z);
    if (!this.rings) this.rings = [];
    const n = Math.round(16 + strength * 30);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, s = (1.5 + Math.random() * 3) * (0.6 + strength * 0.6);
      G.particles.solid.spawn(x, y + 0.1, z, Math.cos(a) * s * 0.5, 3 + Math.random() * 5 * strength, Math.sin(a) * s * 0.5, Math.random() < 0.5 ? 0xffffff : 0xcfe8ff, 0.18 + Math.random() * 0.14, 0.8 + Math.random() * 0.5, { gravity: 14, alpha: 0.9 });
    }
    for (let i = 0; i < 14; i++) G.particles.solid.spawn(x + (Math.random() - 0.5), y + 0.15, z + (Math.random() - 0.5), (Math.random() - 0.5) * 2, 0.4, (Math.random() - 0.5) * 2, 0xffffff, 0.5, 1.4, { gravity: 0, drag: 2, alpha: 0.6, grow: 0.8 });
    this.ripple(x, z, 1.4 + strength * 1.6, 0.9);
    setTimeout(() => this.ripple(x, z, 1.0 + strength, 0.7), 180);
    G.audio.sfxAt('splash', x, z, { vol: 0.6 + strength * 0.6 });
    if (strength > 0.8) G.audio.sfxAt('land', x, z, { vol: 0.5 });
  }
  ripple(x, z, size = 1, alpha = 0.6) {
    if (!this.rings) this.rings = [];
    let r = this.rings.find((q) => q.t >= q.life);
    if (!r) {
      if (this.rings.length > 24) return;
      const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0, depthWrite: false }));
      m.renderOrder = 4; G.scene.add(m);
      r = { m, t: 0, life: 1 }; this.rings.push(r);
    }
    r.m.position.set(x, G.physics.waterLevel(x, z) + 0.02, z);
    r.t = 0; r.life = 1.1 + size * 0.3; r.size = size; r.a = alpha;
    r.m.visible = true;
  }
  update(dt, sky, rain) {
    if (this.rings) for (const r of this.rings) {
      if (r.t >= r.life) { r.m.visible = false; continue; }
      r.t += dt;
      const k = r.t / r.life;
      r.m.scale.setScalar(0.3 + k * r.size * 2.4);
      r.m.material.opacity = r.a * (1 - k);
    }
    const t = G.time;
    for (const u of [this.uniforms, this.streamMat.uniforms]) {
      u.uTime.value = t;
      u.uSunDir.value.copy(sky.lightDir);
      u.uSunCol.value.copy(sky.sunSpec);
      u.uSky.value.copy(sky.horizonColor);
      u.uLight.value.copy(sky.lightLevel);
      u.uRain.value = rain;
    }
    this.fallU.uTime.value = t;
    this.fallU.uLight.value.copy(sky.lightLevel);
    // mist at waterfall base
    const p = G.player?.pos;
    if (p && Math.abs(p.x - this.fallPos.x) < 70 && Math.abs(p.z - this.fallPos.z) < 70) {
      if (Math.random() < 0.6) {
        G.particles.solid.spawn(this.fallPos.x + (Math.random() - 0.5) * 10, 0.3, this.fallPos.z + Math.random() * 2,
          (Math.random() - 0.5) * 2, 1.5 + Math.random() * 2, 1 + Math.random() * 1.5, 0xe8f6ff, 0.45, 1.2, { gravity: 1, drag: 1, alpha: 0.5, grow: 0.6 });
      }
    }
  }
  // distance helper for ambient water sound
  waterProximity(p) {
    const d = Math.hypot(p.x - this.fallPos.x, p.z - this.fallPos.z);
    return Math.max(0, 1 - d / 45);
  }
}
