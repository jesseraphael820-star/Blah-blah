// GPU grass field: a single instanced draw call that wraps around the camera,
// reading height + density from the terrain data texture. Sways in the wind
// and bends away from the player.
import * as THREE from 'three';
import { WORLD } from '../data/world.js';
import { makeRng } from '../core/utils.js';

const VS = `
uniform vec3 uCenter; uniform float uR; uniform sampler2D uHeight; uniform float uSize;
uniform float uTime; uniform float uWind; uniform vec3 uPlayer; uniform vec3 uLight;
attribute vec2 offset; attribute float rnd; attribute float hgt;
varying vec3 vCol;
#include <fog_pars_vertex>
void main(){
  vec2 base = offset + uR * floor((uCenter.xz - offset) / uR + 0.5);
  vec2 uv = (base + uSize * 0.5) / uSize;
  vec4 hd = texture2D(uHeight, uv);
  float dist = length(base - uCenter.xz);
  float fade = 1.0 - smoothstep(uR * 0.36, uR * 0.5, dist);
  float s = step(rnd, hd.g) * fade;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) s = 0.0;
  vec3 p = position;
  p.y *= (0.65 + fract(rnd * 7.13) * 0.8);
  float a = rnd * 6.283;
  p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
  p *= s;
  float ph = base.x * 0.15 + base.y * 0.12;
  p.x += (sin(uTime * 1.8 + ph) * 0.16 + sin(uTime * 4.1 + ph * 3.0) * 0.05) * hgt * uWind * s;
  p.z += cos(uTime * 1.4 + ph) * 0.08 * hgt * uWind * s;
  vec2 d = base - uPlayer.xz;
  float dl = length(d);
  float push = (1.0 - smoothstep(0.2, 1.4, dl)) * step(abs(uPlayer.y - hd.r), 1.6);
  p.xz += (d / max(dl, 0.001)) * push * hgt * 0.7 * s;
  p.y -= push * hgt * 0.25 * s;
  vec3 world = vec3(base.x, hd.r, base.y) + p;
  vec3 dark = mix(vec3(0.24, 0.46, 0.17), vec3(0.18, 0.32, 0.17), hd.b);
  vec3 tip = mix(vec3(0.58, 0.8, 0.33), vec3(0.34, 0.5, 0.3), hd.b);
  tip = mix(tip, vec3(0.66, 0.78, 0.36), step(0.93, fract(rnd * 13.7)) * (1.0 - hd.b));
  vCol = mix(dark, tip, hgt) * uLight;
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FS = `
varying vec3 vCol;
#include <fog_pars_fragment>
void main(){
  gl_FragColor = vec4(vCol, 1.0);
  #include <fog_fragment>
}`;

export class Grass {
  constructor(scene, heightTex, count, radius) {
    // tuft = 3 thin vertical blades
    const blade = [];
    const hg = [];
    const rng = makeRng(3);
    for (let b = 0; b < 3; b++) {
      const ang = (b / 3) * Math.PI + rng() * 0.5;
      const ox = (rng() - 0.5) * 0.35, oz = (rng() - 0.5) * 0.35;
      const w = 0.07, h = 0.5 + rng() * 0.35;
      const cx = Math.cos(ang) * w, cz = Math.sin(ang) * w;
      blade.push(ox - cx, 0, oz - cz, ox + cx, 0, oz + cz, ox + cx * 0.4, h, oz + cz * 0.4,
        ox - cx, 0, oz - cz, ox + cx * 0.4, h, oz + cz * 0.4, ox - cx * 0.4, h, oz - cz * 0.4);
      hg.push(0, 0, 1, 0, 1, 1);
    }
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(blade, 3));
    geo.setAttribute('hgt', new THREE.Float32BufferAttribute(hg, 1));
    const off = new Float32Array(count * 2), rnd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      off[i * 2] = rng() * radius; off[i * 2 + 1] = rng() * radius;
      rnd[i] = rng();
    }
    geo.setAttribute('offset', new THREE.InstancedBufferAttribute(off, 2));
    geo.setAttribute('rnd', new THREE.InstancedBufferAttribute(rnd, 1));
    geo.instanceCount = count;
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uCenter: { value: new THREE.Vector3() }, uR: { value: radius }, uHeight: { value: null }, uSize: { value: WORLD.size },
      uTime: { value: 0 }, uWind: { value: 1 }, uPlayer: { value: new THREE.Vector3() }, uLight: { value: new THREE.Color(1, 1, 1) },
    }]);
    this.uniforms.uHeight.value = heightTex;
    const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: this.uniforms, side: THREE.DoubleSide, fog: true });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  update(t, center, player, wind, light) {
    this.uniforms.uTime.value = t;
    this.uniforms.uCenter.value.copy(center);
    this.uniforms.uPlayer.value.copy(player);
    this.uniforms.uWind.value = wind;
    this.uniforms.uLight.value.copy(light);
  }
}
