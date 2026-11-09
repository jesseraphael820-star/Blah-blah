// Voxel geometry builder + shared world material (wind sway + night emissive).
import * as THREE from 'three';
import { hash2 } from '../core/utils.js';

export const WorldUniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uNight: { value: 0 },
  uWet: { value: 0 },
};

const FACES = [
  // dir, corners (unit cube 0..1), normal
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

export class VoxelBuilder {
  constructor() {
    this.pos = []; this.nrm = []; this.col = []; this.wind = []; this.emit = []; this.idx = [];
    this.vcount = 0;
  }
  get empty() { return this.vcount === 0; }

  // Axis aligned box from (x0,y0,z0) to (x1,y1,z1)
  box(x0, y0, z0, x1, y1, z1, color, o = {}) {
    const wind = o.wind || 0, windBase = o.windBase ?? wind, emit = o.emit || 0;
    const v = o.vary ?? 0.07;
    const jitter = v ? 1 + (hash2(Math.floor(x0 * 7.3 + z1 * 3.1), Math.floor(y0 * 5.7 + x1 * 1.3)) - 0.5) * 2 * v : 1;
    const r = Math.min(1, ((color >> 16) & 255) / 255 * jitter);
    const g = Math.min(1, ((color >> 8) & 255) / 255 * jitter);
    const b = Math.min(1, (color & 255) / 255 * jitter);
    const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
    for (let f = 0; f < 6; f++) {
      if (f === 3 && o.bottom !== true) continue;
      if (o.skip && o.skip[f]) continue;
      const F = FACES[f];
      const base = this.vcount;
      // side faces get slightly darker tint at the bottom for depth (baked AO-ish)
      for (let k = 0; k < 4; k++) {
        const c = F.c[k];
        this.pos.push(x0 + c[0] * sx, y0 + c[1] * sy, z0 + c[2] * sz);
        this.nrm.push(F.n[0], F.n[1], F.n[2]);
        const ao = (f !== 2 && c[1] === 0 && o.ao !== false) ? 0.82 : 1;
        const top = o.topColor !== undefined && f === 2;
        if (top) {
          const tc = o.topColor;
          this.col.push(((tc >> 16) & 255) / 255 * jitter, ((tc >> 8) & 255) / 255 * jitter, (tc & 255) / 255 * jitter);
        } else this.col.push(r * ao, g * ao, b * ao);
        this.wind.push(c[1] === 1 ? wind : windBase);
        this.emit.push(emit);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      this.vcount += 4;
    }
  }
  // centered convenience: center x,z ; bottom y ; size
  cube(cx, y, cz, sx, sy, sz, color, o) {
    this.box(cx - sx / 2, y, cz - sz / 2, cx + sx / 2, y + sy, cz + sz / 2, color, o);
  }
  // raw quad (for terrain): 4 points [x,y,z], normal, color
  quad(p0, p1, p2, p3, n, c0, c1 = c0) {
    const base = this.vcount;
    const pts = [p0, p1, p2, p3];
    for (let k = 0; k < 4; k++) {
      const p = pts[k];
      this.pos.push(p[0], p[1], p[2]);
      this.nrm.push(n[0], n[1], n[2]);
      const c = k < 2 ? c0 : c1;
      this.col.push(((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255);
      this.wind.push(0); this.emit.push(0);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.vcount += 4;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('wind', new THREE.Float32BufferAttribute(this.wind, 1));
    g.setAttribute('emit', new THREE.Float32BufferAttribute(this.emit, 1));
    g.setIndex(this.vcount > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

let worldMat = null;
export function getWorldMaterial() {
  if (worldMat) return worldMat;
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, WorldUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float wind; attribute float emit; varying float vEmit;
        uniform float uTime; uniform float uWind;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vEmit = emit;
        if (wind > 0.0) {
          float ph = position.x * 0.21 + position.z * 0.17;
          float sway = sin(uTime * 1.6 + ph) * 0.6 + sin(uTime * 3.7 + ph * 2.3) * 0.25;
          transformed.x += sway * wind * uWind * 0.22;
          transformed.z += cos(uTime * 1.3 + ph * 1.4) * wind * uWind * 0.14;
          transformed.y += sin(uTime * 2.1 + ph) * wind * uWind * 0.03;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vEmit; uniform float uNight; uniform float uWet;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= 1.0 - uWet * 0.28;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.85, 0.92, 1.05), uWet * 0.5);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float em = vEmit >= 1.5 ? (vEmit - 1.5) : vEmit * uNight;
        totalEmissiveRadiance += vColor.rgb * em * 1.6;`);
  };
  worldMat = m;
  return m;
}

// Simple cached Lambert materials for dynamic objects (characters, props)
const matCache = new Map();
export function colorMat(color, emissive = 0, emissiveIntensity = 1) {
  const key = color + ':' + emissive + ':' + emissiveIntensity;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity });
  matCache.set(key, m);
  return m;
}
export const unitBox = new THREE.BoxGeometry(1, 1, 1);
export function boxMesh(sx, sy, sz, color, o = {}) {
  const m = new THREE.Mesh(unitBox, o.mat || colorMat(color, o.emissive || 0, o.ei || 1));
  m.scale.set(sx, sy, sz);
  if (o.pos) m.position.set(o.pos[0], o.pos[1], o.pos[2]);
  m.castShadow = o.shadow !== false;
  m.receiveShadow = false;
  return m;
}

// Build a standalone mesh from a builder callback (used for props like swords)
export function buildMesh(fn, mat) {
  const vb = new VoxelBuilder();
  fn(vb);
  const mesh = new THREE.Mesh(vb.build(), mat || getWorldMaterial());
  mesh.castShadow = true;
  return mesh;
}
