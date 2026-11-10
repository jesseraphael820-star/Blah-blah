// Day/night cycle: sky dome shader (gradient, pixel sun & moon, stars),
// voxel clouds, sun/moon directional light with following shadow camera.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { clamp, lerp, smoothstep, makeRng } from '../core/utils.js';

const SKY_VS = `
varying vec3 vDir;
void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }`;
const SKY_FS = `
uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom; uniform vec3 uSunDir; uniform vec3 uMoonDir;
uniform vec3 uSunCol; uniform float uStars; uniform float uTime; uniform float uCloudy; uniform float uRetro; uniform vec3 uRetroDir;
varying vec3 vDir;
float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.65, h), 0.8)) : mix(uHorizon, uBottom, smoothstep(0.0, -0.3, h));
  // pixel-quantized direction for blocky sun/moon/stars
  vec3 q = floor(d * 220.0) / 220.0;
  float sd = dot(normalize(q), uSunDir);
  float sun = step(0.9988, sd);
  float glow = pow(max(dot(d, uSunDir), 0.0), 12.0) * 0.45 + pow(max(dot(d, uSunDir), 0.0), 220.0) * 0.6;
  col += uSunCol * glow * (1.0 - uCloudy * 0.7);
  col = mix(col, vec3(1.0, 0.98, 0.85), sun * (1.0 - uCloudy * 0.8) * step(-0.05, uSunDir.y));
  float md = dot(normalize(q), uMoonDir);
  float moon = step(0.9992, md);
  float moonCut = step(0.9993, dot(normalize(q), normalize(uMoonDir + vec3(0.012, 0.008, 0.0))));
  col = mix(col, vec3(0.92, 0.94, 1.0), moon * (1.0 - moonCut * 0.85) * (1.0 - uCloudy * 0.8));
  col += vec3(0.6, 0.7, 1.0) * pow(max(dot(d, uMoonDir), 0.0), 60.0) * 0.25 * uStars;
  // stars
  vec3 sq = floor(d * 160.0);
  float st = hash(sq);
  float tw = 0.6 + 0.4 * sin(uTime * 3.0 + st * 100.0);
  col += vec3(step(0.9965, st) * tw) * uStars * smoothstep(0.0, 0.25, h) * (1.0 - uCloudy);
  // Retro Fantasy: giant striped synthwave sun low on the horizon + neon horizon line
  if (uRetro > 0.001) {
    vec3 rd = normalize(uRetroDir);
    vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), rd));
    vec3 up = cross(rd, rt);
    vec3 qd = normalize(floor(d * 260.0) / 260.0);
    float fwd = dot(qd, rd);
    vec2 sp = vec2(dot(qd, rt), dot(qd, up)) / 0.2;
    float r = length(sp);
    float yy = sp.y * 0.5 + 0.5;
    vec3 scol = mix(vec3(1.0, 0.16, 0.55), vec3(1.0, 0.88, 0.32), smoothstep(0.05, 0.95, yy));
    float band = 1.0;
    if (yy < 0.55) { float f = fract((yy - uTime * 0.03) * 10.0); band = step(mix(0.6, 0.06, yy / 0.55), f); }
    float disc = step(r, 1.0) * band * step(0.0, fwd);
    col += vec3(1.0, 0.3, 0.65) * smoothstep(2.2, 0.9, r) * 0.35 * step(0.0, fwd) * uRetro;
    col = mix(col, scol, disc * uRetro);
    col += vec3(1.0, 0.35, 0.8) * exp(-abs(h) * 70.0) * 0.55 * uRetro;
    col += vec3(0.25, 0.9, 1.0) * exp(-abs(h + 0.02) * 40.0) * 0.18 * uRetro * step(h, 0.0);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// keyframes: hour -> palette
const KEYS = [
  { h: 0, top: 0x070c22, hor: 0x1a2648, bot: 0x0a0e1a, amb: 0x5a6aa0, gnd: 0x242a3a, ai: 0.95, sun: 0x9ab0ff, si: 0.6, fog: 0x18223c },
  { h: 4.6, top: 0x0c1430, hor: 0x2e2e52, bot: 0x0e1020, amb: 0x5e6a9a, gnd: 0x262a3a, ai: 0.95, sun: 0x9ab0ff, si: 0.5, fog: 0x1e2440 },
  { h: 5.6, top: 0x2a3a70, hor: 0xe08a6a, bot: 0x3a2a3a, amb: 0x7a6a9a, gnd: 0x3a3030, ai: 0.62, sun: 0xff9a6a, si: 0.7, fog: 0x8a6a7a },
  { h: 7, top: 0x4a8ad8, hor: 0xf4c89a, bot: 0x6a7a8a, amb: 0xb0c0e0, gnd: 0x5a6a4a, ai: 0.9, sun: 0xffd8a8, si: 1.9, fog: 0xc8c8d0 },
  { h: 12, top: 0x3a86e6, hor: 0xbfe2fa, bot: 0x8ab0c8, amb: 0xc8e0ff, gnd: 0x6a8a4a, ai: 1.05, sun: 0xfff4e4, si: 2.7, fog: 0xbad8f0 },
  { h: 16.5, top: 0x4a84d8, hor: 0xe8d0a8, bot: 0x8aa0b0, amb: 0xc0d0f0, gnd: 0x6a7a4a, ai: 0.98, sun: 0xffe0b0, si: 2.3, fog: 0xd0d0d0 },
  { h: 18.4, top: 0x3a4a8a, hor: 0xf08a5a, bot: 0x5a3a3a, amb: 0x9a7a9a, gnd: 0x4a3a3a, ai: 0.7, sun: 0xff8a4a, si: 1.1, fog: 0xa07070 },
  { h: 19.6, top: 0x1a2050, hor: 0x6a3a5a, bot: 0x1a1424, amb: 0x6a6a9a, gnd: 0x2a2a3a, ai: 0.9, sun: 0x9aa0ff, si: 0.45, fog: 0x3a3048 },
  { h: 21, top: 0x0a1028, hor: 0x1e2a4c, bot: 0x0a0e1a, amb: 0x5a6aa0, gnd: 0x242a3a, ai: 0.95, sun: 0x9ab0ff, si: 0.6, fog: 0x18223c },
  { h: 24, top: 0x070c22, hor: 0x1a2648, bot: 0x0a0e1a, amb: 0x5a6aa0, gnd: 0x242a3a, ai: 0.95, sun: 0x9ab0ff, si: 0.6, fog: 0x18223c },
];
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
function lerpHex(out, a, b, t) { tmpA.setHex(a); tmpB.setHex(b); return out.copy(tmpA).lerp(tmpB, t); }

export const HOUR_SECONDS = 30; // real seconds per in-game hour (24h = 12 min)

export class Sky {
  constructor(scene, renderer, mobile) {
    this.scene = scene;
    this.uniforms = {
      uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3() }, uMoonDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() },
      uStars: { value: 0 }, uTime: { value: 0 }, uCloudy: { value: 0 }, uRetro: { value: 0 }, uRetroDir: { value: new THREE.Vector3(1, 0.12, 0) },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    const ss = mobile ? 1024 : 2048;
    this.sun.shadow.mapSize.set(ss, ss);
    const sc = this.sun.shadow.camera;
    this.shadowHalf = mobile ? 40 : 60;
    sc.left = -this.shadowHalf; sc.right = this.shadowHalf; sc.top = this.shadowHalf; sc.bottom = -this.shadowHalf;
    sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun); scene.add(this.sun.target);

    this.lightDir = new THREE.Vector3(0, 1, 0);
    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3();
    this.sunSpec = new THREE.Color();
    this.horizonColor = new THREE.Color();
    this.fogColor = new THREE.Color();
    this.lightLevel = new THREE.Color(1, 1, 1);
    this.night = 0;
    this.dim = 1;          // weather dimming
    this.cloudCover = 0.4;
    this.underground = false;

    // voxel clouds
    const rng = makeRng(42);
    const boxes = [];
    for (let c = 0; c < 46; c++) {
      const cx = (rng() - 0.5) * 900, cz = (rng() - 0.5) * 900, cy = 120 + rng() * 40;
      const n = 4 + Math.floor(rng() * 6);
      for (let i = 0; i < n; i++) {
        boxes.push({ x: cx + (rng() - 0.5) * 30, y: cy + rng() * 5, z: cz + (rng() - 0.5) * 16, sx: 10 + rng() * 18, sy: 4 + rng() * 4, sz: 8 + rng() * 12, order: rng() });
      }
    }
    boxes.sort((a, b) => a.order - b.order);
    this.cloudBoxes = boxes;
    this.cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.55, fog: false });
    this.clouds = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.cloudMat, boxes.length);
    this.clouds.frustumCulled = false;
    this.cloudOffset = new THREE.Vector2();
    scene.add(this.clouds);
    this.dummy = new THREE.Object3D();
  }

  timeOfDay() { return G.state.world.time; }
  isNight() { const h = this.timeOfDay(); return h >= 20 || h < 5.5; }

  update(dt, camPos, focus) {
    const h = this.timeOfDay();
    let k = 0;
    while (k < KEYS.length - 2 && KEYS[k + 1].h <= h) k++;
    const A = KEYS[k], Bk = KEYS[k + 1];
    const t = clamp((h - A.h) / (Bk.h - A.h), 0, 1);
    const u = this.uniforms;
    const dim = this.dim;
    lerpHex(u.uTop.value, A.top, Bk.top, t).multiplyScalar(lerp(1, 0.55, 1 - dim));
    lerpHex(u.uHorizon.value, A.hor, Bk.hor, t).lerp(tmpA.setHex(0x8a8f98), (1 - dim) * 0.6 * (1 - this.night));
    lerpHex(u.uBottom.value, A.bot, Bk.bot, t);
    u.uTime.value = G.time;
    u.uCloudy.value = clamp((this.cloudCover - 0.5) * 2, 0, 1);

    const ang = ((h - 6) / 12) * Math.PI;
    this.sunDir.set(Math.cos(ang) * 0.75, Math.sin(ang), 0.42).normalize();
    this.moonDir.set(-this.sunDir.x, -this.sunDir.y, 0.3).normalize();
    u.uSunDir.value.copy(this.sunDir);
    u.uMoonDir.value.copy(this.moonDir);
    this.night = smoothstep(0.12, -0.12, this.sunDir.y);
    u.uStars.value = this.night;
    lerpHex(u.uSunCol.value, A.sun, Bk.sun, t);

    // lights
    lerpHex(this.hemi.color, A.amb, Bk.amb, t);
    lerpHex(this.hemi.groundColor, A.gnd, Bk.gnd, t);
    this.hemi.intensity = lerp(A.ai, Bk.ai, t) * lerp(0.82, 1, dim) * 1.15;
    lerpHex(this.sun.color, A.sun, Bk.sun, t);
    const useMoon = this.sunDir.y < 0.02;
    this.lightDir.copy(useMoon ? this.moonDir : this.sunDir);
    if (this.lightDir.y < 0.15) { this.lightDir.y = 0.15; this.lightDir.normalize(); }
    const horizonFade = smoothstep(0.0, 0.16, Math.abs(this.sunDir.y));
    this.sun.intensity = lerp(A.si, Bk.si, t) * dim * (0.5 + 0.5 * dim) * (0.3 + 0.7 * horizonFade);
    this.sunSpec.copy(this.sun.color).multiplyScalar(this.sun.intensity * 0.4 * (useMoon ? 0.6 : 1));
    lerpHex(this.fogColor, A.fog, Bk.fog, t).lerp(tmpA.setHex(0x8a9098), (1 - dim) * 0.6 * (1 - this.night));
    this.horizonColor.copy(u.uHorizon.value);
    // overall light level used by custom shaders (water, grass)
    const L = this.hemi.intensity * 0.65 + this.sun.intensity * 0.17;
    this.lightLevel.copy(this.hemi.color).multiplyScalar(0.5).add(tmpA.copy(this.sun.color).multiplyScalar(0.5)).multiplyScalar(clamp(L, 0.12, 1.25));

    if (this.underground && this.indoor) {
      // cozy house interiors: warm light from windows and the fireplace
      this.hemi.color.setHex(0xffe2b8); this.hemi.groundColor.setHex(0x5a3a28); this.hemi.intensity = 1.25;
      this.sun.intensity = 0.2; this.fogColor.setHex(0x1a120c);
      this.lightLevel.setRGB(0.8, 0.7, 0.6);
    } else if (this.underground) {
      this.hemi.color.setHex(0x7a7aa8); this.hemi.groundColor.setHex(0x2a2430); this.hemi.intensity = 1.05;
      this.sun.intensity = 0.15; this.fogColor.setHex(0x05040a);
      this.lightLevel.setRGB(0.45, 0.45, 0.58);
    }
    this.dome.visible = !this.underground;
    this.clouds.visible = !this.underground;

    // shadow camera follows the focus, snapped to texels to avoid shimmering
    const sh = this.shadowHalf * 2 / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / sh) * sh, fz = Math.round(focus.z / sh) * sh;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx + this.lightDir.x * 150, focus.y + this.lightDir.y * 150, fz + this.lightDir.z * 150);

    this.dome.position.copy(camPos);
    this.updateClouds(dt, camPos);
  }

  updateClouds(dt, camPos) {
    this.cloudOffset.x += dt * 2.2 * (G.weather ? G.weather.wind : 1);
    this.cloudOffset.y += dt * 0.8;
    const cover = this.cloudCover;
    const n = Math.floor(this.cloudBoxes.length * clamp(0.25 + cover * 0.75, 0, 1));
    this.clouds.count = n;
    const d = this.dummy;
    for (let i = 0; i < n; i++) {
      const b = this.cloudBoxes[i];
      let x = b.x + this.cloudOffset.x - camPos.x, z = b.z + this.cloudOffset.y - camPos.z;
      x = ((x + 450) % 900 + 900) % 900 - 450;
      z = ((z + 450) % 900 + 900) % 900 - 450;
      d.position.set(camPos.x + x, b.y, camPos.z + z);
      d.scale.set(b.sx, b.sy, b.sz);
      d.updateMatrix();
      this.clouds.setMatrixAt(i, d.matrix);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    const dark = clamp((cover - 0.6) * 1.6, 0, 0.75);
    tmpA.copy(this.hemi.color).lerp(tmpB.setHex(0xffffff), 0.5).multiplyScalar(lerp(1, 0.45, dark));
    this.cloudMat.color.copy(tmpA);
    this.cloudMat.emissive.copy(this.uniforms.uHorizon.value).lerp(tmpB.setHex(0xffffff), 0.3 * (1 - this.night)).multiplyScalar(lerp(0.7, 0.35, dark) * (1 - this.night * 0.6));
  }
}
