import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp, smoothstep, fbm, rng } from './util.js';

export const HALF = 1600;
export const ROAD_W = 14;
export const SIDEWALK = 3.5;
export const CURB = 0.18;
export const TSEG = 320;
const TSTEP = (HALF * 2) / TSEG;

// ---------------------------------------------------------------- cidades
export const CITIES = [
  { id: 'porto', name: 'Porto Sereno', cx: 650, cz: 500, size: 720, block: 90, h0: 3, maxH: 150, minH: 10, kind: 'metro', park: 0.1 },
  { id: 'sao', name: 'São Cruzeiro', cx: -700, cz: 650, size: 420, block: 84, h0: 22, maxH: 38, minH: 7, kind: 'town', park: 0.16 },
  { id: 'vila', name: 'Vila Poeira', cx: -550, cz: -750, size: 252, block: 84, h0: 14, maxH: 7, minH: 4, kind: 'village', park: 0.08 },
  { id: 'pedra', name: 'Pedra Alta', cx: 600, cz: -700, size: 180, block: 90, h0: 30, maxH: 7, minH: 4, kind: 'village', park: 0.2 },
];
for (const c of CITIES) {
  c.n = Math.round(c.size / c.block);
  c.x0 = c.cx - c.size / 2; c.x1 = c.cx + c.size / 2;
  c.z0 = c.cz - c.size / 2; c.z1 = c.cz + c.size / 2;
  c.xs = []; c.zs = [];
  for (let i = 0; i <= c.n; i++) { c.xs.push(c.x0 + i * c.block); c.zs.push(c.z0 + i * c.block); }
}

export const ZONES = [
  { name: 'Monte Sereno', x: 20, z: 120 },
  { name: 'Deserto do Sal', x: -380, z: -420 },
  { name: 'Costa Esmeralda', x: 1130, z: 250 },
  { name: 'Serra Verde', x: -250, z: 300 },
  { name: 'Vale do Cobre', x: 150, z: -450 },
];

const boxDist = (c, x, z) => Math.max(Math.abs(x - c.cx), Math.abs(z - c.cz)) - c.size / 2;

export function desertMask(x, z) {
  return smoothstep(-150, -450, z) * smoothstep(250, -50, x);
}
function coastX(x, z) {
  return x + (fbm(z * 0.002 + 9, 5.5, 3) - 0.5) * 160;
}

export function natural(x, z) {
  const n = fbm(x * 0.0011 + 3.1, z * 0.0011 - 7.3, 5);
  const rg = 1 - Math.abs(fbm(x * 0.0007 + 11, z * 0.0007 + 2, 3) * 2 - 1);
  let h = n * 55 + rg * rg * 40 - 12;
  const md = Math.hypot(x - 20, z - 120);
  h += smoothstep(480, 0, md) * 150 * (0.7 + 0.3 * fbm(x * 0.01, z * 0.01, 2));
  h = lerp(h, 12 + fbm(x * 0.005, z * 0.005, 2) * 16, desertMask(x, z) * 0.85);
  const cx = coastX(x, z);
  h = lerp(h, 2.2, smoothstep(930, 1080, cx));
  h = lerp(h, -18, smoothstep(1090, 1300, cx));
  const r = Math.max(Math.abs(x), Math.abs(z)) + (fbm(x * 0.003, z * 0.003, 2) - 0.5) * 140;
  h = lerp(h, -18, smoothstep(1380, 1540, r));
  return h;
}

// ---------------------------------------------------------------- rodovias
const HW_NODES = [
  [[290, 500], [40, 530], [-220, 600], [-490, 650]],
  [[-700, 440], [-660, 150], [-560, -250], [-550, -624]],
  [[-424, -750], [-150, -780], [180, -730], [510, -700]],
  [[600, -610], [630, -350], [660, -80], [650, 140]],
  [[650, 860], [520, 1130], [-300, 1150], [-700, 860]],
];

export const HIGHWAYS = HW_NODES.map((nodes) => {
  const pts = nodes.map(([x, z], k) => {
    let y;
    if (k === 0 || k === nodes.length - 1) {
      const c = CITIES.find((c) => boxDist(c, x, z) < 2);
      y = c ? c.h0 : natural(x, z);
    } else y = clamp(natural(x, z), 6, 60);
    return new THREE.Vector3(x, y, z);
  });
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const len = curve.getLength();
  const N = Math.ceil(len / 8);
  const sp = curve.getSpacedPoints(N);
  const px = new Float32Array(N + 1), py = new Float32Array(N + 1), pz = new Float32Array(N + 1);
  sp.forEach((p, i) => { px[i] = p.x; py[i] = p.y; pz[i] = p.z; });
  const chunks = [];
  for (let k = 0; k < N; k += 8) {
    const k1 = Math.min(k + 8, N);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let q = k; q <= k1; q++) {
      x0 = Math.min(x0, px[q]); x1 = Math.max(x1, px[q]);
      z0 = Math.min(z0, pz[q]); z1 = Math.max(z1, pz[q]);
    }
    chunks.push({ k0: k, k1, x0: x0 - 82, x1: x1 + 82, z0: z0 - 82, z1: z1 + 82 });
  }
  return { curve, N, len, px, py, pz, chunks };
});

const NR = { d: 1e9, y: 0, hw: -1, k: 0, t: 0 };
export function nearestRoad(x, z) {
  NR.d = 1e9; NR.hw = -1;
  for (let h = 0; h < HIGHWAYS.length; h++) {
    const H = HIGHWAYS[h];
    for (const ch of H.chunks) {
      if (x < ch.x0 || x > ch.x1 || z < ch.z0 || z > ch.z1) continue;
      for (let k = ch.k0; k < ch.k1; k++) {
        const ax = H.px[k], az = H.pz[k];
        const dx = H.px[k + 1] - ax, dz = H.pz[k + 1] - az;
        let t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = ax + dx * t - x, ez = az + dz * t - z;
        const d = Math.sqrt(ex * ex + ez * ez);
        if (d < NR.d) {
          NR.d = d; NR.y = H.py[k] + (H.py[k + 1] - H.py[k]) * t;
          NR.hw = h; NR.k = k; NR.t = t;
        }
      }
    }
  }
  return NR;
}

export function heightAt(x, z) {
  let h = natural(x, z);
  let wc = 0, hc = 0;
  for (const c of CITIES) {
    const d = boxDist(c, x, z) - ROAD_W / 2;
    if (d < 170) {
      const w = 1 - smoothstep(0, 170, d);
      if (w > wc) { wc = w; hc = c.h0; }
    }
  }
  h = lerp(h, hc, wc);
  const r = nearestRoad(x, z);
  if (r.d < 80) h = lerp(h, r.y, (1 - smoothstep(ROAD_W * 0.75, 80, r.d)) * (1 - smoothstep(0.8, 1, wc)));
  return h;
}

export function cityAt(x, z, pad = ROAD_W / 2) {
  for (const c of CITIES)
    if (Math.abs(x - c.cx) <= c.size / 2 + pad && Math.abs(z - c.cz) <= c.size / 2 + pad) return c;
  return null;
}
export function onCityRoad(c, x, z) {
  const fx = (((x - c.x0) % c.block) + c.block) % c.block;
  const fz = (((z - c.z0) % c.block) + c.block) % c.block;
  return Math.min(fx, c.block - fx) < ROAD_W / 2 || Math.min(fz, c.block - fz) < ROAD_W / 2;
}
export function surfaceAt(x, z) {
  const c = cityAt(x, z);
  if (c) return onCityRoad(c, x, z) ? 'road' : 'walk';
  if (nearestRoad(x, z).d < ROAD_W / 2 + 0.6) return 'road';
  const h = natural(x, z);
  if (h < -0.9) return 'water';
  if (desertMask(x, z) > 0.5) return 'dirt';
  if (coastX(x, z) > 930 && h < 4) return 'sand';
  return 'grass';
}
export function groundAt(x, z) {
  const h = heightAt(x, z);
  const c = cityAt(x, z, -0.01);
  return c && !onCityRoad(c, x, z) ? h + CURB : h;
}
export function zoneName(x, z) {
  const c = cityAt(x, z, 30);
  if (c) return c.name;
  if (Math.hypot(x - 20, z - 120) < 420) return 'Monte Sereno';
  if (desertMask(x, z) > 0.4) return 'Deserto do Sal';
  if (coastX(x, z) > 880) return 'Costa Esmeralda';
  if (z < -200) return 'Vale do Cobre';
  return 'Serra Verde';
}

// ---------------------------------------------------------------- colisão
export class Collision {
  constructor(cell = 40) { this.cell = cell; this.map = new Map(); this.stamp = 0; }
  key(i, j) { return i * 100003 + j; }
  add(b) {
    b.s = 0;
    const c = this.cell;
    for (let i = Math.floor(b.x0 / c); i <= Math.floor(b.x1 / c); i++)
      for (let j = Math.floor(b.z0 / c); j <= Math.floor(b.z1 / c); j++) {
        const k = this.key(i, j);
        if (!this.map.has(k)) this.map.set(k, []);
        this.map.get(k).push(b);
      }
  }
  query(x, z, r, out) {
    out.length = 0;
    const s = ++this.stamp, c = this.cell;
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++)
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
        const a = this.map.get(this.key(i, j));
        if (!a) continue;
        for (const b of a) if (b.s !== s) { b.s = s; out.push(b); }
      }
    return out;
  }
  // empurra um círculo pra fora das caixas; retorna normal do maior impacto (ou null)
  resolveCircle(p, r, y, outN) {
    const list = this.query(p.x, p.z, r + 1, this._tmp || (this._tmp = []));
    let hit = false;
    for (const b of list) {
      if (y > b.y1 || y + 1.5 < b.y0) continue;
      const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1);
      let dx = p.x - cx, dz = p.z - cz;
      let d = Math.hypot(dx, dz);
      if (d >= r) continue;
      if (d < 1e-4) {
        const l = p.x - b.x0, rr = b.x1 - p.x, t = p.z - b.z0, bb = b.z1 - p.z;
        const m = Math.min(l, rr, t, bb);
        dx = m === l ? -1 : m === rr ? 1 : 0; dz = m === t ? -1 : m === bb ? 1 : 0;
        if (dx && dz) dz = 0;
        d = 0;
        p.x += dx * (r + (m === l || m === rr ? m : 0)); p.z += dz * (r + (m === t || m === bb ? m : 0));
      } else {
        dx /= d; dz /= d;
        p.x += dx * (r - d); p.z += dz * (r - d);
      }
      if (outN) { outN.x = dx; outN.z = dz; }
      hit = true;
    }
    return hit;
  }
}

// ---------------------------------------------------------------- texturas
function canvasTex(w, h, draw, srgb = true) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function speckle(g, w, h, n, a) {
  for (let i = 0; i < n; i++) {
    const v = Math.random() * 255 | 0;
    g.fillStyle = `rgba(${v},${v},${v},${a})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
}
const roadTex = () => canvasTex(128, 512, (g, w, h) => {
  g.fillStyle = '#2c2c2f'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 6000, 0.12);
  g.fillStyle = '#d8d8d0'; g.fillRect(5, 0, 3, h); g.fillRect(w - 8, 0, 3, h);
  g.fillStyle = '#e0b830'; g.fillRect(w / 2 - 3, 0, 2, h * 0.5); g.fillRect(w / 2 + 1, 0, 2, h * 0.5);
});
const asphaltTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#2e2e31'; g.fillRect(0, 0, w, h); speckle(g, w, h, 5000, 0.1);
});
const groundTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) {
    const v = 170 + Math.random() * 85 | 0;
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
});
function facadeTex(kind) {
  const cols = 8, rows = 8;
  const draw = (mode) => (g, w, h) => {
    const cw = w / cols, ch = h / rows;
    g.fillStyle = mode === 'map' ? '#e6e6e6' : mode === 'rough' ? '#e6e6e6' : '#000';
    g.fillRect(0, 0, w, h);
    if (mode === 'map') speckle(g, w, h, 1500, 0.08);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = i * cw + cw * 0.18, y = j * ch + ch * 0.2, ww = cw * 0.64, hh = ch * 0.55;
      if (kind === 'house' && (i + j) % 3 === 1) continue;
      if (mode === 'map') {
        const grd = g.createLinearGradient(x, y, x + ww, y + hh);
        grd.addColorStop(0, '#5a7088'); grd.addColorStop(1, '#1d2633');
        g.fillStyle = '#9a9a9a'; g.fillRect(x - 2, y - 2, ww + 4, hh + 4);
        g.fillStyle = grd; g.fillRect(x, y, ww, hh);
      } else if (mode === 'rough') {
        g.fillStyle = '#2a2a2a'; g.fillRect(x, y, ww, hh);
      } else if (Math.random() < 0.38) {
        const warm = Math.random() < 0.8;
        g.fillStyle = warm ? `hsl(${38 + Math.random() * 10},90%,${55 + Math.random() * 20}%)` : '#bfe3ff';
        g.fillRect(x, y, ww, hh);
      }
    }
  };
  return {
    map: canvasTex(256, 256, draw('map')),
    em: canvasTex(256, 256, draw('em')),
    rough: canvasTex(256, 256, draw('rough'), false),
  };
}

// ---------------------------------------------------------------- vento (shader)
export function addWind(mat, windU, { sway = 0.3, flutter = 0.03, ref = 6 } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windU.uTime;
    sh.uniforms.uWind = windU.uWind;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uWind;')
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4( transformed, 1.0 );
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          ip = instanceMatrix[3].xyz;
        #endif
        mvPosition = modelMatrix * mvPosition;
        {
          float hgt = max(position.y, 0.0) / ${ref.toFixed(3)};
          float ws = uWind.z;
          float ph = uTime * (1.1 + ws * 0.5) + ip.x * 0.13 + ip.z * 0.11;
          float gust = 0.6 + 0.4 * sin(uTime * 0.55 + ip.x * 0.013 + ip.z * 0.007);
          float bend = (0.55 + 0.45 * sin(ph) + 0.18 * sin(ph * 2.7)) * ws * gust * hgt * hgt * ${sway.toFixed(3)};
          mvPosition.xz += uWind.xy * bend;
          mvPosition.y -= abs(bend) * 0.15;
          float fl = sin(uTime * (7.0 + ws * 4.0) + dot(position, vec3(4.1, 3.3, 5.7)) + ip.x) * ${flutter.toFixed(3)} * (0.3 + ws) * hgt;
          mvPosition.xyz += vec3(fl, fl * 0.5, -fl * 0.8);
        }
        mvPosition = viewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  mat.customProgramCacheKey = () => `wind${sway}_${flutter}_${ref}`;
  return mat;
}

// ---------------------------------------------------------------- geometria auxiliar
function colorize(g, col) {
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function boxGeo(w, h, d, x, y, z, col, tile) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    let u = uv.getX(i), vv = uv.getY(i);
    if (f === 2 || f === 3) { u = 0.004; vv = 0.004; }
    else if (f < 2) { u *= d / tile; vv *= h / tile; }
    else { u *= w / tile; vv *= h / tile; }
    uv.setXY(i, u, vv);
  }
  g.translate(x, y + h / 2, z);
  return colorize(g, col);
}
function roofGeo(w, d, rh, x, y, z, col) {
  const swap = d > w;
  const W = swap ? d : w, D = swap ? w : d;
  const hw = W / 2 + 0.35, hd = D / 2 + 0.35;
  const A = [-hw, 0, -hd], B = [hw, 0, -hd], C = [hw, rh, 0], Dd = [-hw, rh, 0], E = [-hw, 0, hd], B2 = [hw, 0, hd];
  const tris = [A, C, B, A, Dd, C, E, B2, C, E, C, Dd, A, E, Dd, B, C, B2];
  const pos = new Float32Array(tris.flat());
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  if (swap) g.rotateY(Math.PI / 2);
  g.translate(x, y, z);
  return colorize(g, col);
}
function strip(ax, az, bx, bz, w, y, v0 = 0) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
  const nx = -dz / L * w / 2, nz = dx / L * w / 2;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    ax + nx, y, az + nz, ax - nx, y, az - nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz]), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, v0, 1, v0, 0, v0 + L / 12, 1, v0 + L / 12]), 2));
  g.setIndex([0, 2, 1, 1, 2, 3]);
  return g;
}
const sc = (hex) => new THREE.Color(hex);

// ---------------------------------------------------------------- mundo
export class World {
  constructor(scene, quality = 'high') {
    this.scene = scene;
    this.q = quality;
    this.col = new Collision(40);
    this.lamps = [];
    this.wetMats = [];
    this.treeTiles = [];
    this.buildRects = [];
    this.parkSpots = [];
    this.windU = { uTime: { value: 0 }, uWind: { value: new THREE.Vector3(1, 0, 0.3) } };
    this.R = rng(1993);
  }

  async build(progress = () => {}) {
    const tick = () => new Promise((r) => setTimeout(r, 0));
    progress('Moldando o terreno...'); await tick();
    this.buildTerrain();
    progress('Asfaltando as ruas...'); await tick();
    this.buildRoads();
    progress('Levantando prédios...'); await tick();
    this.buildCities();
    progress('Plantando árvores...'); await tick();
    this.buildTrees();
    this.buildGrass();
    progress('Enchendo o mar...'); await tick();
    this.buildWater();
    this.buildBillboards();
  }

  // ---------------- terreno
  buildTerrain() {
    const geo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, TSEG, TSEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const n = pos.count;
    this.heights = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const h = heightAt(pos.getX(i), pos.getZ(i));
      pos.setY(i, h);
      this.heights[i] = h;
    }
    geo.computeVertexNormals();
    const nor = geo.attributes.normal;
    const cols = new Float32Array(n * 3);
    const c = new THREE.Color(), tmp = new THREE.Color();
    const grassA = sc(0x4f6b2c), grassB = sc(0x7a8a3c), dry = sc(0x9c8f55), sand = sc(0xd8c79a), desert = sc(0xc49a62),
      rock = sc(0x7d7468), wet = sc(0x6b6146), city = sc(0x5a5a58);
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = this.heights[i];
      const nz = fbm(x * 0.01, z * 0.01, 3);
      c.copy(grassA).lerp(grassB, nz);
      c.lerp(dry, smoothstep(0.55, 0.8, fbm(x * 0.002 + 4, z * 0.002, 2)) * 0.7);
      c.lerp(desert, smoothstep(0.25, 0.6, desertMask(x, z)) * (0.8 + nz * 0.2));
      if (coastX(x, z) > 900 && h < 4.5) c.lerp(sand, smoothstep(4.5, 2.5, h));
      if (h < 0.4) c.copy(wet).lerp(tmp.copy(sand), 0.3);
      const slope = 1 - nor.getY(i);
      c.lerp(rock, smoothstep(0.12, 0.3, slope) * 0.85);
      if (h > 95) c.lerp(rock, smoothstep(95, 140, h) * 0.6);
      if (cityAt(x, z, 2)) c.copy(city);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const map = groundTex();
    map.repeat.set(380, 380);
    this.terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map });
    this.wetMats.push({ m: this.terrainMat, dry: 0.95, wet: 0.7 });
    const mesh = new THREE.Mesh(geo, this.terrainMat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.terrain = mesh;
  }

  // ---------------- ruas
  buildRoads() {
    const rt = roadTex();
    const roadMat = new THREE.MeshStandardMaterial({ map: rt, roughness: 0.85, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const at = asphaltTex(); at.repeat.set(60, 60);
    const baseMat = new THREE.MeshStandardMaterial({ map: at, roughness: 0.88, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.wetMats.push({ m: roadMat, dry: 0.85, wet: 0.12 }, { m: baseMat, dry: 0.88, wet: 0.15 });
    const strips = [];
    for (const c of CITIES) {
      const base = new THREE.Mesh(new THREE.PlaneGeometry(c.size + ROAD_W, c.size + ROAD_W).rotateX(-Math.PI / 2), baseMat);
      base.position.set(c.cx, c.h0 + 0.02, c.cz);
      base.receiveShadow = true;
      this.scene.add(base);
      const y = c.h0 + 0.045;
      for (let i = 0; i <= c.n; i++) for (let j = 0; j < c.n; j++) {
        strips.push(strip(c.xs[i], c.zs[j] + ROAD_W / 2, c.xs[i], c.zs[j + 1] - ROAD_W / 2, ROAD_W, y));
        strips.push(strip(c.xs[j] + ROAD_W / 2, c.zs[i], c.xs[j + 1] - ROAD_W / 2, c.zs[i], ROAD_W, y));
      }
    }
    for (const H of HIGHWAYS) {
      const N = H.N;
      const pos = new Float32Array((N + 1) * 6), uv = new Float32Array((N + 1) * 4), nrm = new Float32Array((N + 1) * 6);
      let v = 0;
      for (let k = 0; k <= N; k++) {
        const a = Math.max(0, k - 1), b = Math.min(N, k + 1);
        let dx = H.px[b] - H.px[a], dz = H.pz[b] - H.pz[a];
        const L = Math.hypot(dx, dz); dx /= L; dz /= L;
        const nx = -dz * ROAD_W / 2, nz = dx * ROAD_W / 2;
        const y = heightAt(H.px[k], H.pz[k]) + 0.07;
        pos.set([H.px[k] + nx, y, H.pz[k] + nz, H.px[k] - nx, y, H.pz[k] - nz], k * 6);
        nrm.set([0, 1, 0, 0, 1, 0], k * 6);
        if (k > 0) v += Math.hypot(H.px[k] - H.px[k - 1], H.pz[k] - H.pz[k - 1]) / 12;
        uv.set([0, v, 1, v], k * 4);
      }
      const idx = [];
      for (let k = 0; k < N; k++) { const q = k * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      strips.push(g);
      // guard rails / postes de rodovia a cada 60m
      for (let k = 4; k < N - 4; k += 8) this.lampAt(H.px[k], H.pz[k], H.px[k + 1] - H.px[k], H.pz[k + 1] - H.pz[k], ROAD_W / 2 + 1.2, heightAt(H.px[k], H.pz[k]), k % 16 === 4);
    }
    const mesh = new THREE.Mesh(mergeGeometries(strips), roadMat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  lampAt(x, z, dx, dz, off, y, side) {
    const L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L, nz = dx / L;
    const s = side ? 1 : -1;
    this.lamps.push({ x: x + nx * off * s, z: z + nz * off * s, y, rot: Math.atan2(nx * s, nz * s) });
  }

  // ---------------- cidades
  buildCities() {
    const R = this.R;
    const fac = facadeTex('tower'), facH = facadeTex('house');
    this.facadeMats = [];
    const mk = (f) => {
      const m = new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.em, emissive: 0xffffff, emissiveIntensity: 0, roughnessMap: f.rough, roughness: 1, metalness: 0.08, vertexColors: true });
      this.facadeMats.push(m);
      return m;
    };
    const towerMat = mk(fac), houseMat = mk(facH);
    const slabMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    this.wetMats.push({ m: slabMat, dry: 0.9, wet: 0.3 });
    const towers = [], houses = [], slabs = [], roofs = [];
    const walk = sc(0xa9a59c), grass = sc(0x4d7a33), plaza = sc(0xc2b8a3);
    const PAL = {
      metro: [0xb9b2a5, 0x8f9aa6, 0xd2c6b0, 0xa0533e, 0x6f7a80, 0xe8e2d4, 0x9d8c74, 0x5f6b77],
      town: [0xf1dcb5, 0xe8c1a0, 0xc9d8c5, 0xf3e6c8, 0xd9a07a, 0xbfc9d6],
      vila: [0xd9a76e, 0xc98e5a, 0xe2c08f, 0xb5764a],
      pedra: [0xf2f0ea, 0xdfe7ee, 0xf3e3c3, 0xcde0d4],
    };
    const ROOF = [0xa0412d, 0x8a3a28, 0x6b4a3a, 0x5d5f63];

    for (const c of CITIES) {
      const y0 = c.h0 + CURB;
      // postes ao longo das ruas
      for (let i = 0; i <= c.n; i++) for (let j = 0; j < c.n; j++) {
        for (let t = 0.25; t < 1; t += 0.5) {
          const zz = lerp(c.zs[j], c.zs[j + 1], t), xx = lerp(c.xs[j], c.xs[j + 1], t);
          if (i > 0 || true) this.lampAt(c.xs[i], zz, 0, 1, ROAD_W / 2 + 0.6, y0, (i + j) % 2 === 0);
          this.lampAt(xx, c.zs[i], 1, 0, ROAD_W / 2 + 0.6, y0, (i + j) % 2 === 1);
        }
      }
      for (let i = 0; i < c.n; i++) for (let j = 0; j < c.n; j++) {
        const bx0 = c.xs[i] + ROAD_W / 2, bx1 = c.xs[i + 1] - ROAD_W / 2;
        const bz0 = c.zs[j] + ROAD_W / 2, bz1 = c.zs[j + 1] - ROAD_W / 2;
        const bw = bx1 - bx0, bd = bz1 - bz0, bcx = (bx0 + bx1) / 2, bcz = (bz0 + bz1) / 2;
        const special = c.id === 'porto' && i === 4 && j === 7;
        const park = !special && R() < c.park;
        slabs.push(boxGeo(bw, CURB, bd, bcx, c.h0, bcz, walk, 10));
        const ix0 = bx0 + SIDEWALK, ix1 = bx1 - SIDEWALK, iz0 = bz0 + SIDEWALK, iz1 = bz1 - SIDEWALK;
        const iw = ix1 - ix0, id = iz1 - iz0;
        if (special) { this.buildOficina(c, ix0, ix1, iz0, iz1, towers, slabs); continue; }
        if (park) {
          slabs.push(boxGeo(iw, 0.06, id, bcx, y0, bcz, grass, 10));
          slabs.push(boxGeo(iw, 0.07, 3, bcx, y0, bcz, plaza, 10));
          slabs.push(boxGeo(3, 0.07, id, bcx, y0, bcz, plaza, 10));
          this.buildRects.push({ x0: ix0, x1: ix1, z0: iz0, z1: iz1, park: true });
          c.parks = c.parks || [];
          c.parks.push({ x0: ix0, x1: ix1, z0: iz0, z1: iz1, y: y0 });
          continue;
        }
        const dc = Math.hypot(bcx - c.cx, bcz - c.cz) / (c.size * 0.6);
        const lots = c.kind === 'metro' && R() < 0.25 ? 1 : 2;
        for (let a = 0; a < lots; a++) for (let b = 0; b < lots; b++) {
          const lx0 = ix0 + (iw / lots) * a, lz0 = iz0 + (id / lots) * b;
          const lw = iw / lots, ld = id / lots;
          if (c.kind === 'village') {
            const hw = Math.min(lw - 4, 8 + R() * 5), hd = Math.min(ld - 4, 8 + R() * 5);
            const hh = c.minH + R() * (c.maxH - c.minH);
            const hx = lx0 + lw / 2 + (R() - 0.5) * (lw - hw - 3), hz = lz0 + ld / 2 + (R() - 0.5) * (ld - hd - 3);
            const col = sc(PAL[c.id === 'vila' ? 'vila' : 'pedra'][Math.floor(R() * 4)]);
            houses.push(boxGeo(hw, hh, hd, hx, y0, hz, col, 14));
            roofs.push(roofGeo(hw, hd, 1.6 + R() * 1.2, hx, y0 + hh, hz, sc(ROOF[Math.floor(R() * ROOF.length)])));
            this.addBox(hx - hw / 2, hx + hw / 2, hz - hd / 2, hz + hd / 2, y0, y0 + hh + 2);
            if (R() < 0.5) this.parkSpots.push({ x: hx + hw / 2 + 2.5, z: hz, h: Math.PI * (R() < 0.5 ? 0 : 1), y0 });
          } else {
            const inset = 1 + R() * 2;
            const w = lw - inset * 2, d = ld - inset * 2;
            const k = c.kind === 'metro' ? Math.pow(clamp(1 - dc, 0, 1), 1.6) : clamp(1 - dc, 0.2, 1);
            let h = c.minH + (c.maxH - c.minH) * k * (0.45 + R() * 0.55);
            if (c.kind === 'metro' && lots === 1) h *= 1.25;
            h = Math.round(h / 3.5) * 3.5;
            const pal = c.kind === 'metro' ? PAL.metro : PAL.town;
            const col = sc(pal[Math.floor(R() * pal.length)]);
            const x = lx0 + lw / 2, z = lz0 + ld / 2;
            const tex = c.kind === 'metro' ? towers : houses;
            tex.push(boxGeo(w, h, d, x, y0, z, col, c.kind === 'metro' ? 28 : 20));
            if (h > 40 && R() < 0.7) tex.push(boxGeo(w * 0.7, h * 0.18, d * 0.7, x, y0 + h, z, col.clone().multiplyScalar(0.92), 28));
            if (R() < 0.6) slabs.push(boxGeo(3 + R() * 3, 1.6, 2 + R() * 3, x + (R() - 0.5) * w * 0.5, y0 + h, z + (R() - 0.5) * d * 0.5, sc(0x8a8a8a), 10));
            if (c.kind === 'town' && h < 14) roofs.push(roofGeo(w, d, 2.2, x, y0 + h, z, sc(ROOF[Math.floor(R() * 2)])));
            this.addBox(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y0, y0 + h + 2);
            this.buildRects.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
          }
        }
      }
      // vagas de estacionamento junto ao meio-fio
      for (let q = 0; q < (c.kind === 'metro' ? 26 : 8); q++) {
        const vertical = R() < 0.5;
        const li = 1 + Math.floor(R() * (c.n - 1)), sj = Math.floor(R() * c.n);
        const along = lerp(c.zs[sj] + 18, c.zs[sj + 1] - 18, R());
        const side = R() < 0.5 ? 1 : -1;
        const off = (ROAD_W / 2 - 1.3) * side;
        if (vertical) this.parkSpots.push({ x: c.xs[li] + off, z: along, h: side > 0 ? 0 : Math.PI, y0: c.h0 });
        else this.parkSpots.push({ x: lerp(c.xs[sj] + 18, c.xs[sj + 1] - 18, R()), z: c.zs[li] - off, h: side > 0 ? Math.PI / 2 : -Math.PI / 2, y0: c.h0 });
      }
    }
    const add = (list, mat, shadow = true) => {
      if (!list.length) return;
      const m = new THREE.Mesh(mergeGeometries(list), mat);
      m.castShadow = shadow; m.receiveShadow = true;
      this.scene.add(m);
    };
    add(towers, towerMat); add(houses, houseMat); add(slabs, slabMat); add(roofs, roofMat);
    this.buildLamps();
  }

  buildOficina(c, x0, x1, z0, z1, towers, slabs) {
    const y0 = c.h0 + CURB;
    const shedZ0 = z0 + 20, w = x1 - x0 - 4, d = z1 - shedZ0 - 2, cx = (x0 + x1) / 2, cz = shedZ0 + d / 2;
    towers.push(boxGeo(w, 8, d, cx, y0, cz, sc(0xb7703f), 28));
    slabs.push(boxGeo(x1 - x0, 0.05, 20, cx, y0, z0 + 10, sc(0x3b3b3d), 10));
    slabs.push(boxGeo(24, 5, 0.3, cx, y0, shedZ0 - 0.1, sc(0x3a3d42), 10));
    this.addBox(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, y0, y0 + 10);
    const sign = canvasTex(512, 128, (g, W, H) => {
      g.fillStyle = '#16130f'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#f0b429'; g.lineWidth = 8; g.strokeRect(6, 6, W - 12, H - 12);
      g.fillStyle = '#f0b429'; g.font = 'bold 64px Oswald, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('OFICINA VARGAS', W / 2, H / 2 + 4);
    });
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(22, 5.5), new THREE.MeshStandardMaterial({ map: sign, emissiveMap: sign, emissive: 0xffffff, emissiveIntensity: 0.25 }));
    sm.position.set(cx, y0 + 9.6, shedZ0 - 0.3);
    sm.rotation.y = Math.PI;
    this.scene.add(sm);
    this.signMat = sm.material;
    const post = new THREE.Mesh(new THREE.BoxGeometry(22, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    post.position.set(cx, y0 + 6.8, shedZ0 - 0.3);
    this.scene.add(post);
    this.oficina = { x: cx, z: z0 - 4, carX: cx, carZ: z0 + 10, y0 };
  }

  addBox(x0, x1, z0, z1, y0, y1) {
    this.col.add({ x0, x1, z0, z1, y0, y1 });
  }

  buildLamps() {
    const n = this.lamps.length;
    const poleG = new THREE.CylinderGeometry(0.09, 0.14, 7.5, 6).translate(0, 3.75, 0);
    const armG = new THREE.BoxGeometry(0.1, 0.1, 1.8).translate(0, 7.4, -0.8);
    const headG = new THREE.BoxGeometry(0.45, 0.14, 0.7).translate(0, 7.32, -1.6);
    const metal = new THREE.MeshStandardMaterial({ color: 0x55585c, metalness: 0.6, roughness: 0.4 });
    this.lampMat = new THREE.MeshStandardMaterial({ color: 0xfff1cf, emissive: 0xffd68a, emissiveIntensity: 0 });
    const pole = new THREE.InstancedMesh(poleG, metal, n), arm = new THREE.InstancedMesh(armG, metal, n), head = new THREE.InstancedMesh(headG, this.lampMat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    this.lamps.forEach((l, i) => {
      q.setFromAxisAngle(up, l.rot);
      m.compose(p.set(l.x, l.y, l.z), q, s);
      pole.setMatrixAt(i, m); arm.setMatrixAt(i, m); head.setMatrixAt(i, m);
      l.lx = l.x + Math.sin(l.rot) * -1.6; l.lz = l.z + Math.cos(l.rot) * -1.6; l.ly = l.y + 7.1;
      this.addBox(l.x - 0.15, l.x + 0.15, l.z - 0.15, l.z + 0.15, l.y, l.y + 7);
    });
    pole.castShadow = true;
    for (const im of [pole, arm, head]) this.scene.add(im);
  }

  // ---------------- árvores
  buildTrees() {
    const R = this.R;
    const list = { oak: [], pine: [], palm: [], shrub: [] };
    const step = this.q === 'low' ? 34 : this.q === 'mid' ? 26 : 21;
    for (let x = -HALF + 10; x < HALF; x += step) for (let z = -HALF + 10; z < HALF; z += step) {
      const px = x + (R() - 0.5) * step, pz = z + (R() - 0.5) * step;
      if (cityAt(px, pz, 22)) continue;
      const h = heightAt(px, pz);
      if (h < 1.2) continue;
      if (nearestRoad(px, pz).d < 13) continue;
      const dm = desertMask(px, pz);
      const dens = fbm(px * 0.004 + 7, pz * 0.004, 3);
      const coast = coastX(px, pz) > 880;
      if (coast && h < 8) { if (R() < 0.25) list.palm.push([px, h, pz, 0.8 + R() * 0.5]); continue; }
      if (dm > 0.5) { if (R() < 0.06) list.shrub.push([px, h, pz, 0.6 + R() * 0.7]); continue; }
      if (dens < 0.47 || R() > (dens - 0.4) * 2.2) continue;
      if (h > 70 || (h > 40 && R() < 0.5)) list.pine.push([px, h, pz, 0.8 + R() * 0.6]);
      else list.oak.push([px, h, pz, 0.75 + R() * 0.6]);
    }
    for (const c of CITIES) {
      for (const p of c.parks || []) {
        for (let k = 0; k < 7; k++) {
          const x = lerp(p.x0 + 3, p.x1 - 3, R()), z = lerp(p.z0 + 3, p.z1 - 3, R());
          if (Math.abs(x - (p.x0 + p.x1) / 2) < 3 || Math.abs(z - (p.z0 + p.z1) / 2) < 3) continue;
          (c.id === 'porto' && R() < 0.5 ? list.palm : list.oak).push([x, p.y, z, 0.8 + R() * 0.4]);
        }
      }
      if (c.id === 'porto') {
        // avenida das palmeiras
        for (let j = 0; j < c.n; j++) for (let t = 0.12; t < 1; t += 0.25) {
          const z = lerp(c.zs[j], c.zs[j + 1], t);
          for (const s of [-1, 1]) list.palm.push([c.xs[4] + s * (ROAD_W / 2 + 1.8), c.h0 + CURB, z, 0.9 + R() * 0.2]);
        }
      }
    }
    // geometrias
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.95 });
    const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: 0.9 });
    const leafMat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 });
    const det = this.q === 'low' ? 0 : 1;
    const G = {
      oak: {
        t: new THREE.CylinderGeometry(0.18, 0.3, 3.4, 6).translate(0, 1.7, 0),
        l: mergeGeometries([new THREE.IcosahedronGeometry(2.0, det).translate(0, 4.4, 0), new THREE.IcosahedronGeometry(1.5, det).translate(1.1, 3.7, 0.5), new THREE.IcosahedronGeometry(1.4, det).translate(-0.9, 3.9, -0.6)]),
        ref: 6, col: [0x3f6b2a, 0x56802f, 0x2f5a25, 0x6a8a35], sway: 0.35,
      },
      pine: {
        t: new THREE.CylinderGeometry(0.15, 0.26, 3, 6).translate(0, 1.5, 0),
        l: mergeGeometries([new THREE.ConeGeometry(2.0, 3.4, 8).translate(0, 3.6, 0), new THREE.ConeGeometry(1.5, 2.8, 8).translate(0, 5.2, 0), new THREE.ConeGeometry(0.95, 2.2, 8).translate(0, 6.6, 0)]),
        ref: 7.5, col: [0x2a4a2a, 0x2f5530, 0x243f26], sway: 0.25,
      },
      palm: (() => {
        const t = new THREE.CylinderGeometry(0.15, 0.25, 8.5, 6, 8).translate(0, 4.25, 0);
        const tp = t.attributes.position;
        for (let i = 0; i < tp.count; i++) { const y = tp.getY(i) / 8.5; tp.setX(i, tp.getX(i) + y * y * 0.9); }
        t.computeVertexNormals();
        const fr = [];
        for (let k = 0; k < 8; k++) {
          const f = new THREE.BoxGeometry(0.7, 0.04, 4.2, 1, 1, 5).translate(0, 0, 2.1);
          const fp = f.attributes.position;
          for (let i = 0; i < fp.count; i++) { const zz = fp.getZ(i); fp.setY(i, fp.getY(i) + zz * 0.35 - (zz / 4.2) ** 2 * 2.0); fp.setX(i, fp.getX(i) * (1 - zz / 5.5)); }
          f.computeVertexNormals();
          f.rotateY((k / 8) * Math.PI * 2 + 0.3).translate(0.9, 8.5, 0);
          fr.push(f.toNonIndexed());
        }
        fr.push(new THREE.IcosahedronGeometry(0.45, 0).translate(0.9, 8.3, 0));
        return { t, l: mergeGeometries(fr), ref: 8.5, col: [0x4f7a2a, 0x648c34, 0x3f6a22], sway: 0.45, trunkMat: palmTrunkMat };
      })(),
      shrub: {
        t: new THREE.CylinderGeometry(0.05, 0.08, 0.5, 4).translate(0, 0.25, 0),
        l: new THREE.IcosahedronGeometry(0.9, 0).scale(1, 0.7, 1).translate(0, 0.7, 0),
        ref: 1.4, col: [0x6e7040, 0x80733f, 0x5b6236], sway: 0.25,
      },
    };
    const TILE = 800;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sv = new THREE.Vector3(), pv = new THREE.Vector3(), col = new THREE.Color();
    for (const type of Object.keys(list)) {
      const g = G[type];
      const lm = addWind(leafMat(), this.windU, { sway: g.sway, flutter: type === 'palm' ? 0.06 : 0.035, ref: g.ref });
      const tm = addWind((g.trunkMat || trunkMat).clone(), this.windU, { sway: g.sway * 0.5, flutter: 0, ref: g.ref });
      const dl = addWind(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), this.windU, { sway: g.sway, flutter: 0, ref: g.ref });
      const tiles = new Map();
      for (const it of list[type]) {
        const k = Math.floor((it[0] + HALF) / TILE) + ',' + Math.floor((it[2] + HALF) / TILE);
        if (!tiles.has(k)) tiles.set(k, []);
        tiles.get(k).push(it);
        if (type !== 'shrub') this.addBox(it[0] - 0.35, it[0] + 0.35, it[2] - 0.35, it[2] + 0.35, it[1], it[1] + 6);
      }
      for (const [, arr] of tiles) {
        const tr = new THREE.InstancedMesh(g.t, tm, arr.length), lf = new THREE.InstancedMesh(g.l, lm, arr.length);
        let cx = 0, cz = 0;
        arr.forEach((it, i) => {
          q.setFromAxisAngle(up, R() * Math.PI * 2);
          m4.compose(pv.set(it[0], it[1] - 0.1, it[2]), q, sv.setScalar(it[3]));
          tr.setMatrixAt(i, m4); lf.setMatrixAt(i, m4);
          col.setHex(g.col[Math.floor(R() * g.col.length)]).multiplyScalar(0.85 + R() * 0.3);
          lf.setColorAt(i, col);
          cx += it[0]; cz += it[2];
        });
        lf.customDepthMaterial = dl;
        tr.castShadow = lf.castShadow = true;
        lf.receiveShadow = true;
        tr.computeBoundingSphere(); lf.computeBoundingSphere();
        this.scene.add(tr, lf);
        this.treeTiles.push({ meshes: [tr, lf], x: cx / arr.length, z: cz / arr.length });
      }
    }
    this.treeCount = Object.values(list).reduce((a, b) => a + b.length, 0);
  }

  // ---------------- grama perto do jogador
  buildGrass() {
    const N = this.q === 'low' ? 2500 : this.q === 'mid' ? 5000 : 8000;
    const blade = new THREE.PlaneGeometry(0.09, 0.6, 1, 3).translate(0, 0.3, 0);
    const bp = blade.attributes.position;
    for (let i = 0; i < bp.count; i++) bp.setX(i, bp.getX(i) * (1 - bp.getY(i) / 0.65));
    const parts = [];
    for (let k = 0; k < 3; k++) parts.push(blade.clone().rotateY((k * Math.PI) / 3).translate((k - 1) * 0.06, 0, (k % 2) * 0.05));
    const g = mergeGeometries(parts);
    const gp = g.attributes.position, gc = new Float32Array(gp.count * 3);
    for (let i = 0; i < gp.count; i++) { const t = 0.45 + gp.getY(i) / 0.6 * 0.55; gc[i * 3] = t; gc[i * 3 + 1] = t; gc[i * 3 + 2] = t; }
    g.setAttribute('color', new THREE.BufferAttribute(gc, 3));
    const mat = addWind(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }), this.windU, { sway: 0.22, flutter: 0.02, ref: 0.6 });
    this.grass = new THREE.InstancedMesh(g, mat, N);
    this.grass.frustumCulled = false;
    this.grass.receiveShadow = true;
    this.grassR = 46;
    this.grassPos = new Float32Array(N * 2).fill(1e6);
    this.grassCursor = 0;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      this.grass.setMatrixAt(i, zero);
      col.setHSL(0.2 + Math.random() * 0.06, 0.45, 0.28 + Math.random() * 0.12);
      this.grass.setColorAt(i, col);
    }
    this.scene.add(this.grass);
    this._gm = new THREE.Matrix4(); this._gq = new THREE.Quaternion(); this._gs = new THREE.Vector3(); this._gp = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
    this.grassFirst = true;
  }

  updateGrass(px, pz, fx, fz) {
    const N = this.grass.count, R = this.grassR;
    const budget = this.grassFirst ? N : 500;
    let changed = false;
    for (let n = 0; n < budget; n++) {
      const i = this.grassCursor;
      this.grassCursor = (i + 1) % N;
      const gx = this.grassPos[i * 2], gz = this.grassPos[i * 2 + 1];
      if (!this.grassFirst && (gx - px) ** 2 + (gz - pz) ** 2 < R * R) continue;
      const a = Math.random() * Math.PI * 2;
      const r = this.grassFirst ? Math.sqrt(Math.random()) * R : R * (0.75 + Math.random() * 0.25);
      let x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
      if (!this.grassFirst && (Math.cos(a) * fx + Math.sin(a) * fz) < -0.3) { x = px - Math.cos(a) * r; z = pz - Math.sin(a) * r; }
      this.grassPos[i * 2] = x; this.grassPos[i * 2 + 1] = z;
      changed = true;
      if (surfaceAt(x, z) !== 'grass') { this.grass.setMatrixAt(i, this._gm.makeScale(0, 0, 0)); continue; }
      const h = natural(x, z) < 1 ? -10 : heightAt(x, z);
      this._gq.setFromAxisAngle(this._up, Math.random() * 6.28);
      const s = 0.7 + Math.random() * 0.8;
      this._gm.compose(this._gp.set(x, h - 0.05, z), this._gq, this._gs.set(s, s * (0.7 + Math.random() * 0.6), s));
      this.grass.setMatrixAt(i, this._gm);
    }
    this.grassFirst = false;
    if (changed) this.grass.instanceMatrix.needsUpdate = true;
  }

  // ---------------- água (ondas seguem o vento)
  buildWater() {
    const W = TSEG + 1;
    const data = new Uint8Array(W * W * 4);
    for (let i = 0; i < W * W; i++) {
      const d = clamp(-this.heights[i] / 20, 0, 1) * 255;
      data[i * 4] = d; data[i * 4 + 3] = 255;
    }
    const depthTex = new THREE.DataTexture(data, W, W, THREE.RGBAFormat);
    depthTex.magFilter = depthTex.minFilter = THREE.LinearFilter;
    depthTex.needsUpdate = true;
    this.waterU = {
      uTime: { value: 0 }, uWind: this.windU.uWind, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunCol: { value: new THREE.Color(1, 1, 1) }, uSky: { value: new THREE.Color(0.5, 0.7, 0.9) }, uHorizon: { value: new THREE.Color(0.8, 0.85, 0.9) },
      uFogCol: { value: new THREE.Color() }, uFogD: { value: 0.0005 }, uDepth: { value: depthTex }, uHalf: { value: HALF }, uNight: { value: 0 }, uRain: { value: 0 },
    };
    const waves = `
      uniform float uTime; uniform vec3 uWind;
      const int NW = 7;
      vec3 waveSum(vec2 p, int count) {
        float h = 0.0; vec2 gr = vec2(0.0);
        float ang0 = atan(uWind.y, uWind.x);
        float st = 0.25 + uWind.z * 0.75;
        float offs[7] = float[7](0.0, 0.55, -0.45, 1.1, -0.9, 0.25, -1.6);
        float wls[7] = float[7](42.0, 23.0, 14.0, 8.0, 4.5, 2.4, 1.3);
        for (int i = 0; i < NW; i++) {
          if (i >= count) break;
          float a = ang0 + offs[i];
          vec2 d = vec2(cos(a), sin(a));
          float k = 6.2831 / wls[i];
          float amp = wls[i] * 0.011 * st;
          float ph = dot(d, p) * k - uTime * sqrt(9.8 * k);
          h += amp * sin(ph);
          gr += amp * k * cos(ph) * d;
        }
        return vec3(h, gr);
      }`;
    const mat = new THREE.ShaderMaterial({
      uniforms: this.waterU,
      transparent: true,
      vertexShader: `${waves}
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          w.y += waveSum(w.xz, 3).x;
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `${waves}
        uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uHorizon; uniform vec3 uFogCol; uniform float uFogD;
        uniform sampler2D uDepth; uniform float uHalf; uniform float uNight; uniform float uRain;
        varying vec3 vW;
        float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec3 ws = waveSum(vW.xz, 7);
          float rip = uRain * 0.25 * sin(length(fract(vW.xz * 0.7) - 0.5) * 40.0 - uTime * 12.0 + hsh(floor(vW.xz * 0.7)) * 6.28);
          vec3 n = normalize(vec3(-ws.y + rip * 0.3, 1.0, -ws.z + rip * 0.2));
          vec3 V = normalize(cameraPosition - vW);
          float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
          vec3 R = reflect(-V, n);
          vec3 sky = mix(uHorizon, uSky, clamp(R.y * 1.6, 0.0, 1.0));
          float depth = texture2D(uDepth, (vW.xz + uHalf) / (2.0 * uHalf)).r * 20.0;
          vec3 deep = mix(vec3(0.02, 0.09, 0.12), vec3(0.06, 0.32, 0.33), exp(-depth * 0.18));
          deep *= (1.0 - uNight * 0.85) * (0.4 + 0.6 * max(uSunDir.y, 0.0));
          vec3 col = mix(deep, sky, fres);
          float spec = pow(max(dot(R, normalize(uSunDir)), 0.0), 420.0) * 6.0 + pow(max(dot(R, normalize(uSunDir)), 0.0), 40.0) * 0.12;
          col += uSunCol * spec * step(0.0, uSunDir.y);
          float foam = smoothstep(1.4, 0.0, depth) * (0.55 + 0.45 * sin(vW.x * 0.9 + vW.z * 0.7 + uTime * 1.6 + ws.x * 6.0));
          foam += smoothstep(0.35, 0.6, ws.x * (0.6 + uWind.z * 0.4)) * smoothstep(0.7, 1.6, uWind.z) * 0.7;
          col = mix(col, vec3(0.9) * (1.0 - uNight * 0.8), clamp(foam, 0.0, 1.0) * 0.8);
          float dist = length(cameraPosition - vW);
          float f = 1.0 - exp(-uFogD * uFogD * dist * dist);
          col = mix(col, uFogCol, f);
          float alpha = mix(0.55, 0.97, smoothstep(0.0, 4.0, depth)) ;
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const seg = this.q === 'low' ? 120 : 220;
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600, seg, seg).rotateX(-Math.PI / 2), mat);
    this.water.frustumCulled = false;
    this.water.renderOrder = 1;
    this.scene.add(this.water);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000).rotateX(-Math.PI / 2), mat);
    far.position.y = -0.4; far.renderOrder = 0;
    this.scene.add(far);
    this.farWater = far;
  }

  buildBillboards() {
    const ads = [
      ['REFRI TCHAN!', 'o sabor do verão', '#d7263d', '#fff'],
      ['PIZZA DO ZÉ', 'entrega em 20 min ou é grátis*', '#f0b429', '#1b1b1b'],
      ['BANCO SERENO', 'seu dinheiro, nosso porto', '#1d4e89', '#fff'],
      ['RÁDIO SERENO 93.9', 'a voz da quebrada', '#111', '#f0b429'],
      ['MOTEL MIRAGEM', 'Vila Poeira - Saída 3', '#6a2c70', '#ffd6f0'],
      ['PNEUS TOURO', 'aguenta qualquer estrada', '#2d6a4f', '#fff'],
    ];
    const H = HIGHWAYS;
    const spots = [[0, 0.3], [0, 0.7], [1, 0.4], [2, 0.5], [3, 0.6], [4, 0.45]];
    spots.forEach(([hw, t], i) => {
      const hwy = H[hw];
      const k = Math.floor(hwy.N * t);
      const dx = hwy.px[k + 1] - hwy.px[k], dz = hwy.pz[k + 1] - hwy.pz[k], L = Math.hypot(dx, dz);
      const nx = -dz / L, nz = dx / L;
      const x = hwy.px[k] + nx * 22, z = hwy.pz[k] + nz * 22, y = heightAt(x, z);
      const [a, b, bg, fg] = ads[i];
      const tex = canvasTex(512, 256, (g, W, Hh) => {
        g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
        g.fillStyle = fg; g.textAlign = 'center';
        g.font = 'bold 74px Oswald, Impact, sans-serif'; g.fillText(a, W / 2, 130);
        g.font = 'italic 34px Oswald, Arial, sans-serif'; g.fillText(b, W / 2, 195);
      });
      const grp = new THREE.Group();
      const board = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 0.3), [0, 0, 0, 0, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })].map((m) => m || new THREE.MeshStandardMaterial({ color: 0x333333 })));
      board.position.y = 9;
      board.castShadow = true;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 0.4), new THREE.MeshStandardMaterial({ color: 0x444444 }));
      leg.position.y = 3.5;
      grp.add(board, leg);
      grp.position.set(x, y, z);
      grp.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
      this.scene.add(grp);
      this.addBox(x - 0.4, x + 0.4, z - 0.4, z + 0.4, y, y + 7);
    });
  }

  update(dt, cam, env) {
    this.windU.uTime.value += dt;
    this.waterU.uTime.value += dt;
    const s = 10;
    this.water.position.set(Math.round(cam.x / s) * s, 0, Math.round(cam.z / s) * s);
    const far2 = (2200 * (env ? env.drawDist : 1)) ** 2;
    for (const t of this.treeTiles) {
      const v = (t.x - cam.x) ** 2 + (t.z - cam.z) ** 2 < far2;
      t.meshes[0].visible = t.meshes[1].visible = v;
    }
  }
}
