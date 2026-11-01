import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp, smoothstep } from './util.js';
import { heightAt, surfaceAt, puddleAt } from './world.js';

// massa kg, medidas m, torque N·m, CdA m²
export const VTYPES = {
  bike: { name: 'BMX', shape: 'bike', mass: 95, wheelbase: 1.05, width: 0.62, length: 1.7, height: 1.1, cgh: 0.95, wheelR: 0.33, pedal: true, power: 950, maxF: 380, grip: 1.05, CdA: 0.6, brakeF: 1200, steer: 0.55, steerFall: 0.05, drive: 'rear', twoWheel: true, seat: [0, 0.52, -0.2] },
  moto: { name: 'Sanhaço 250', shape: 'moto', mass: 240, wheelbase: 1.42, width: 0.75, length: 2.1, height: 1.2, cgh: 0.7, wheelR: 0.31, torque: 95, idle: 1200, redline: 10500, gears: [2.8, 2.0, 1.6, 1.3, 1.1, 0.95], final: 3.9, grip: 1.1, CdA: 0.55, brakeF: 4100, steer: 0.5, steerFall: 0.045, drive: 'rear', twoWheel: true, seat: [0, 0.55, -0.35] },
  sedan: { name: 'Prima', shape: 'sedan', mass: 1300, wheelbase: 2.7, width: 1.8, length: 4.5, height: 1.45, cgh: 0.55, wheelR: 0.32, torque: 220, idle: 850, redline: 6300, gears: [3.4, 2.1, 1.45, 1.05, 0.82], final: 3.9, grip: 1.0, CdA: 0.68, brakeF: 14900, steer: 0.6, steerFall: 0.03, drive: 'rear', seat: [0.38, 0.2, -0.25] },
  taxi: { name: 'Táxi Prima', shape: 'taxi', mass: 1330, wheelbase: 2.7, width: 1.8, length: 4.5, height: 1.45, cgh: 0.55, wheelR: 0.32, torque: 220, idle: 850, redline: 6300, gears: [3.4, 2.1, 1.45, 1.05, 0.82], final: 3.9, grip: 1.0, CdA: 0.7, brakeF: 14900, steer: 0.6, steerFall: 0.03, drive: 'rear', seat: [0.38, 0.2, -0.25] },
  police: { name: 'Viatura', shape: 'police', mass: 1450, wheelbase: 2.8, width: 1.85, length: 4.7, height: 1.5, cgh: 0.55, wheelR: 0.33, torque: 360, idle: 800, redline: 6200, gears: [3.3, 2.1, 1.5, 1.12, 0.86], final: 3.7, grip: 1.12, CdA: 0.7, brakeF: 20200, steer: 0.6, steerFall: 0.028, drive: 'rear', seat: [0.4, 0.2, -0.25] },
  sport: { name: 'Faísca GT', shape: 'sport', mass: 1250, wheelbase: 2.55, width: 1.95, length: 4.4, height: 1.15, cgh: 0.45, wheelR: 0.33, torque: 520, idle: 950, redline: 7900, gears: [3.1, 2.2, 1.65, 1.28, 1.02, 0.84], final: 3.5, grip: 1.25, CdA: 0.6, ClA: 0.45, brakeF: 21600, steer: 0.55, steerFall: 0.03, drive: 'awd', seat: [0.4, -0.1, -0.35] },
  pickup: { name: 'Touro', shape: 'pickup', mass: 1900, wheelbase: 3.1, width: 2.0, length: 5.2, height: 1.85, cgh: 0.78, wheelR: 0.39, torque: 430, idle: 700, redline: 5200, gears: [3.6, 2.2, 1.45, 1.0, 0.76], final: 3.7, grip: 0.95, CdA: 1.1, brakeF: 20200, steer: 0.55, steerFall: 0.03, drive: 'rear', seat: [0.42, 0.45, 0.4] },
  // barcos: thrust N, vmax m/s (só andam na água)
  boat: { name: 'Lancha Maré', shape: 'boat', boat: true, mass: 950, wheelbase: 3.4, width: 2.1, length: 5.4, height: 1.3, cgh: 0.5, wheelR: 0.35, thrust: 11000, vmax: 21, idle: 900, redline: 5200, grip: 1, CdA: 1.2, brakeF: 0, steer: 0.6, steerFall: 0.02, drive: 'rear', seat: [0.4, 0.15, -0.9] },
  jetski: { name: 'Jet Onda', shape: 'jetski', boat: true, twoWheel: true, mass: 320, wheelbase: 2.2, width: 1.1, length: 3.0, height: 1.1, cgh: 0.5, wheelR: 0.3, thrust: 5200, vmax: 19, idle: 1500, redline: 7800, grip: 1, CdA: 0.7, brakeF: 0, steer: 0.7, steerFall: 0.02, drive: 'rear', seat: [0, 0.2, -0.25] },
};
for (const t of Object.values(VTYPES)) {
  t.a = t.wheelbase * 0.48; t.b = t.wheelbase * 0.52;
  t.I = (t.mass * (t.length ** 2 + t.width ** 2)) / 12;
}

const SURF = {
  road: { mu: 1.0, rr: 0.013 }, walk: { mu: 0.95, rr: 0.015 }, grass: { mu: 0.68, rr: 0.05 },
  dirt: { mu: 0.62, rr: 0.045 }, sand: { mu: 0.5, rr: 0.09 }, water: { mu: 0.3, rr: 0.2 },
};

export const CAR_COLORS = [0xb3201c, 0x1d3f8a, 0xe8e8e8, 0x151515, 0x2f6b3a, 0xc9a227, 0x6d6f73, 0x7a1f4d, 0x2a8fbd, 0xd9661f, 0x9c9c9c, 0x40251a];

const M = {
  glass: new THREE.MeshPhysicalMaterial({ color: 0x0e1620, metalness: 0.1, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.42 }),
  black: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.7 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.18 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.95 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xb8b8b8, metalness: 0.9, roughness: 0.3 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.5, roughness: 0.4 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x2a1d17, roughness: 0.8 }),
  cabin: new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.6 }),
  rimIn: new THREE.MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.8, roughness: 0.45, side: THREE.DoubleSide }),
  disc: new THREE.MeshStandardMaterial({ color: 0x6a6a6a, metalness: 0.9, roughness: 0.55 }),
  caliper: new THREE.MeshStandardMaterial({ color: 0xc41a12, roughness: 0.4 }),
  trim: new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.45, metalness: 0.2 }),
  grille: new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 0.7, metalness: 0.3 }),
  well: new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1, side: THREE.DoubleSide }),
  plastic: new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.8 }),
};
M.glassD = M.glass.clone(); M.glassD.side = THREE.DoubleSide;

// facho do farol visível na chuva/neblina (cone aditivo que some na ponta e nas bordas)
export const BEAM = { uBeam: { value: 0 } };
const beamGeo = new THREE.ConeGeometry(1, 1, 18, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2);
const beamMat = new THREE.ShaderMaterial({
  uniforms: BEAM, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `varying float vT; varying vec3 vN, vV;
    void main() { vT = position.z; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uBeam; varying float vT; varying vec3 vN, vV;
    void main() { float e = abs(dot(normalize(vN), normalize(vV))); float a = uBeam * pow(1.0 - vT, 1.6) * smoothstep(0.0, 0.06, vT) * e * e;
      gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * a, 1.0); }`,
});

// caixas subdivididas para a lataria poder amassar localmente
const seg = (v) => Math.max(1, Math.min(10, Math.ceil(v / 0.3)));
function addBox(parent, w, h, d, x, y, z, mat, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, seg(w), seg(h), seg(d)), mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ---------------------------------------------------------------- modelo do carro
// junta as peças fixas do mesmo material num só objeto (bem menos chamadas de desenho por carro)
function mergeGroup(g, keep) {
  const byMat = new Map();
  for (const m of g.children) {
    if (!m.isMesh || keep.has(m) || Array.isArray(m.material) || m.children.length) continue;
    if (!byMat.has(m.material)) byMat.set(m.material, []);
    byMat.get(m.material).push(m);
  }
  for (const [mat, list] of byMat) {
    if (list.length < 2) continue;
    let geos = list.map((m) => {
      m.updateMatrix();
      const ge = m.geometry.clone().applyMatrix4(m.matrix);
      for (const k of Object.keys(ge.attributes)) if (k !== 'position' && k !== 'normal' && !(k === 'uv' && mat.map)) ge.deleteAttribute(k);
      return ge;
    });
    if (!geos.every((ge) => ge.index)) geos = geos.map((ge) => (ge.index ? ge.toNonIndexed() : ge));
    const merged = mergeGeometries(geos);
    if (!merged) continue;
    const mm = new THREE.Mesh(merged, mat);
    mm.castShadow = list.some((m) => m.castShadow); mm.receiveShadow = true;
    for (const m of list) g.remove(m);
    g.add(mm);
  }
}
const geoCache = new Map();
const cached = (k, f) => geoCache.get(k) || geoCache.set(k, f()).get(k);
// pneu: perfil com ombro arredondado girado em volta do eixo
function tireGeo(r, w) {
  return cached(`tire${r}_${w}`, () => {
    const ri = r * 0.66, P = [[ri, -w / 2], [r * 0.92, -w / 2], [r * 0.975, -w * 0.44], [r, -w * 0.28], [r, w * 0.28], [r * 0.975, w * 0.44], [r * 0.92, w / 2], [ri, w / 2]];
    return new THREE.LatheGeometry(P.map(([x, y]) => new THREE.Vector2(x, y)), 26).rotateZ(Math.PI / 2);
  });
}
// raio do aro: afina do cubo pra borda
function spokeGeo(ri) {
  return cached(`spoke${ri}`, () => {
    const g = new THREE.BoxGeometry(0.035, ri * 0.82, 0.075).translate(0, ri * 0.47, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > ri * 0.5) p.setZ(i, p.getZ(i) * 0.55);
    g.computeVertexNormals();
    return g;
  });
}
// interpolação suave entre pontos-chave [u, y]
function keyAt(keys, u) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (u <= keys[i][0]) {
    const [u0, y0] = keys[i - 1], [u1, y1] = keys[i], k = (u - u0) / (u1 - u0);
    return y0 + (y1 - y0) * (1 - Math.cos(k * Math.PI)) / 2;
  }
  return keys[keys.length - 1][1];
}
// casca fechada a partir de seções: half(z) dá a meia seção direita (de baixo ao topo, x>=0)
function loftGeo(zs, half) {
  const pos = [], idx = [];
  let K = 0;
  for (const z of zs) {
    const h = half(z);
    const ring = h.concat(h.slice(1, -1).reverse().map(([x, y]) => [-x, y]));
    K = ring.length;
    for (const [x, y] of ring) pos.push(x, y, z);
  }
  const n = zs.length;
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < K; j++) {
    const a = i * K + j, b = i * K + ((j + 1) % K), c = (i + 1) * K + j, d = (i + 1) * K + ((j + 1) % K);
    idx.push(a, b, c, b, d, c);
  }
  // tampas com vértices próprios (aresta viva na frente e atrás)
  for (const [i, front] of [[0, false], [n - 1, true]]) {
    const base = pos.length / 3;
    let cx = 0, cy = 0;
    for (let j = 0; j < K; j++) { const o = (i * K + j) * 3; pos.push(pos[o], pos[o + 1], pos[o + 2]); cx += pos[o]; cy += pos[o + 1]; }
    pos.push(cx / K, cy / K, zs[i]);
    const c = base + K;
    for (let j = 0; j < K; j++) { const a = base + j, b = base + ((j + 1) % K); if (front) idx.push(c, a, b); else idx.push(c, b, a); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// placa bilinear (vidros) com curvatura nas bordas
function patchGeo(p00, p10, p01, p11, nu, nv, bend) {
  const g = new THREE.PlaneGeometry(1, 1, nu, nv), P = g.attributes.position, v = new THREE.Vector3(), w = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    const u = P.getX(i) + 0.5, t = P.getY(i) + 0.5;
    v.copy(p00).lerp(p10, u); w.copy(p01).lerp(p11, u); v.lerp(w, t);
    if (bend) v.z += bend * (2 * u - 1) ** 2;
    P.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
// barra entre dois pontos (colunas, frisos)
function beam(parent, p, q, w, h, mat) {
  const d = new THREE.Vector3().subVectors(q, p), len = d.length();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, len), mat);
  m.position.copy(p).add(q).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
  m.castShadow = true;
  parent.add(m);
  return m;
}
function canvasMat(w, h, draw, opts = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, ...opts });
}
// placa Mercosul: faixa azul com BRASIL e o código LLLNLNN
const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function plateMat() {
  const rnd = (s) => s[Math.floor(Math.random() * s.length)];
  const code = rnd(AZ) + rnd(AZ) + rnd(AZ) + rnd('0123456789') + rnd(AZ) + rnd('0123456789') + rnd('0123456789');
  return canvasMat(256, 84, (g, w, h) => {
    g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1b3f9a'; g.fillRect(0, 0, w, 20);
    g.fillStyle = '#fff'; g.font = 'bold 14px Arial'; g.textAlign = 'center'; g.fillText('BRASIL', w / 2, 15);
    g.fillStyle = '#111'; g.font = 'bold 50px "Arial Narrow", Arial'; g.fillText(code, w / 2, 72);
    g.strokeStyle = '#222'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
  });
}
let policeTex = null, checkerTex = null;
function policeDoor() {
  if (!policeTex) policeTex = canvasMat(256, 96, (g, w, h) => {
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1b2f6b'; g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.fillText('POLÍCIA', w / 2, 58);
    g.fillStyle = '#c4161c'; g.fillRect(0, 70, w, 8);
  }, { roughness: 0.35, metalness: 0.3 });
  return policeTex;
}
function taxiBand() {
  if (!checkerTex) checkerTex = canvasMat(256, 16, (g, w, h) => {
    for (let i = 0; i < w / 8; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#f2f2f2'; g.fillRect(i * 8, j * 8, 8, 8); }
  });
  return checkerTex;
}

// formas (u = z/(L/2), alturas em m para a altura nominal do tipo)
const SHAPES = {
  sedan: {
    H: 1.45, clr: 0.2, doors: 4,
    top: [[-1, 0.64], [-0.955, 0.88], [-0.87, 0.955], [-0.6, 0.985], [0.38, 0.985], [0.45, 0.95], [0.8, 0.865], [0.94, 0.8], [1, 0.62]],
    A: [0.38, 0.99], B: [0.02, 1.43], C: [-0.37, 1.43], D: [-0.6, 0.99], hood: [0.42, 0.93], deck: [-0.62, -0.95],
  },
  sport: {
    H: 1.15, clr: 0.13, doors: 2,
    top: [[-1, 0.58], [-0.95, 0.82], [-0.88, 0.86], [-0.84, 0.87], [0.25, 0.87], [0.3, 0.84], [0.75, 0.75], [0.93, 0.68], [1, 0.5]],
    A: [0.25, 0.88], B: [-0.12, 1.15], C: [-0.4, 1.15], D: [-0.84, 0.88], hood: [0.29, 0.92], deck: [-0.86, -0.95],
  },
  pickup: {
    H: 1.85, clr: 0.34, doors: 2, bed: true,
    top: [[-1, 1.17], [-0.15, 1.2], [-0.12, 1.25], [0.42, 1.25], [0.46, 1.19], [0.9, 1.16], [0.96, 1.1], [1, 0.9]],
    A: [0.42, 1.25], B: [0.2, 1.84], C: [-0.07, 1.84], D: [-0.12, 1.25], hood: [0.47, 0.95], deck: null,
  },
};
SHAPES.taxi = SHAPES.police = SHAPES.sedan;

function buildCar(t, color, { root, body, wheels, headMat, tailMat, paint, mkWheel }) {
  const S = SHAPES[t.shape], L = t.length, W = t.width, r = t.wheelR, hl = L / 2, ky = t.height / S.H;
  const ww = W / 2 - 0.13;
  mkWheel(ww, t.a, true); mkWheel(-ww, t.a, true); mkWheel(ww, -t.b, false); mkWheel(-ww, -t.b, false);
  const Z = (u) => u * hl, Y = (y) => y * ky;
  // planta arredondada nas pontas
  const hwid = (z) => { const e = hl - Math.abs(z); return (W / 2) * (e < 0.6 ? Math.sqrt(1 - ((0.6 - e) / 0.6) ** 2 * 0.3) : 1); };
  const inHood = (z) => z > Z(S.hood[0]) && z < Z(S.hood[1]);
  const inDeck = (z) => S.deck && z < Z(S.deck[0]) && z > Z(S.deck[1]);
  const ytop = (z) => Y(keyAt(S.top, z / hl));
  // fundo: vão livre, caixas de roda em arco e pontas levantadas (ângulo de ataque)
  const ybot = (z) => {
    let y = S.clr + smoothstep(hl - 0.5, hl, z) * 0.16 + smoothstep(-hl + 0.5, -hl, z) * 0.16;
    for (const wz of [t.a, -t.b]) { const d = Math.abs(z - wz), R = r + 0.07; if (d < R) y = Math.max(y, r + Math.sqrt(R * R - d * d)); }
    return y;
  };
  // cabine oca: dentro do vão das portas a casca desce até o assoalho (bancos e painel aparecem por dentro)
  const cz0 = Z(S.D[0]) + 0.06, cz1 = Z(S.A[0]) - 0.04, floorY = S.clr + 0.12;
  const inCab = (z) => z > cz0 && z < cz1;
  const zs = [];
  for (let z = -hl; z < hl - 1e-6; z += 0.075) zs.push(z);
  zs.push(cz0 - 0.01, cz0 + 0.01, cz1 - 0.01, cz1 + 0.01);
  zs.sort((p, q) => p - q);
  zs.push(hl);
  const shell = new THREE.Mesh(loftGeo(zs, (z) => {
    const yb = ybot(z), yt = inCab(z) ? floorY : ytop(z) - (inHood(z) || inDeck(z) ? 0.035 : 0), hw = hwid(z), H = Math.max(0.06, yt - yb), cr = inCab(z) ? 0 : 0.018;
    return [[0, yb], [hw * 0.86, yb], [hw * 0.965, yb + Math.min(0.05, H * 0.2)], [hw * 0.995, yb + H * 0.3], [hw, yb + H * 0.62], [hw * 0.985, yt - Math.min(0.07, H * 0.25)], [hw * 0.955, yt - 0.02], [hw * 0.88, yt], [hw * 0.5, yt + cr * 0.75], [0, yt + cr]];
  }), paint);
  shell.castShadow = shell.receiveShadow = true;
  body.add(shell);
  // forro escuro das caixas de roda (não aparece o fundo pintado)
  for (const wz of [t.a, -t.b]) {
    const R = r + 0.065;
    body.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, W * 0.94, 16, 1, true, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).translate(0, r, wz), M.well));
  }
  addBox(body, W * 0.78, 0.04, L * 0.7, 0, S.clr + 0.03, 0, M.plastic, false);

  // ---- cabine: vidros inclinados (afunilando pra cima), teto e colunas
  const A = [Z(S.A[0]), Y(S.A[1])], B = [Z(S.B[0]), Y(S.B[1])], C = [Z(S.C[0]), Y(S.C[1])], D = [Z(S.D[0]), Y(S.D[1])];
  const hb = (z) => hwid(z) * 0.93, hr = (z) => hwid(z) * 0.76;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const pt = (q, s, top) => V(s * (top ? hr(q[0]) : hb(q[0])), q[1], q[0]);
  const P = {};
  P.paneF = new THREE.Mesh(patchGeo(pt(A, -1), pt(A, 1), pt(B, -1, 1), pt(B, 1, 1), 8, 3, -0.07), M.glassD);
  P.paneB = new THREE.Mesh(patchGeo(pt(D, -1), pt(D, 1), pt(C, -1, 1), pt(C, 1, 1), 8, 3, 0.05), M.glassD);
  P.paneL = new THREE.Mesh(patchGeo(pt(A, 1), pt(D, 1), pt(B, 1, 1), pt(C, 1, 1), 6, 2), M.glassD);
  P.paneR = new THREE.Mesh(patchGeo(pt(A, -1), pt(D, -1), pt(B, -1, 1), pt(C, -1, 1), 6, 2), M.glassD);
  for (const k of ['paneF', 'paneB', 'paneL', 'paneR']) body.add(P[k]);
  const rz = [];
  for (let z = C[0] - 0.03; z < B[0] + 0.03; z += 0.08) rz.push(z);
  rz.push(B[0] + 0.03);
  const roofY = B[1];
  const roof = new THREE.Mesh(loftGeo(rz, (z) => { const hw = hr(Math.min(B[0], Math.max(C[0], z))) + 0.03; return [[0, roofY - 0.05], [hw * 0.9, roofY - 0.05], [hw, roofY - 0.025], [hw * 0.96, roofY + 0.005], [hw * 0.8, roofY + 0.02], [0, roofY + 0.035]]; }), paint);
  roof.castShadow = true; body.add(roof);
  for (const s of [1, -1]) {
    beam(body, pt(A, s), pt(B, s, 1), 0.07, 0.06, paint);
    beam(body, pt(D, s).add(V(0, 0, 0.02)), pt(C, s, 1), t.shape === 'sport' ? 0.06 : 0.14, 0.06, paint);
    const zm = A[0] + (D[0] - A[0]) * 0.47;
    beam(body, V(s * hb(zm), A[1], zm), V(s * hr(zm), roofY, zm - 0.03), 0.09, 0.07, M.trim);
    beam(body, pt(A, s).add(V(s * 0.01, -0.01, 0)), pt(D, s).add(V(s * 0.01, -0.01, 0)), 0.025, 0.03, M.chrome);
    beam(body, pt(B, s, 1), pt(C, s, 1), 0.04, 0.04, M.trim);
  }

  // ---- capô e tampa do porta-malas (peças que soltam)
  const lid = (z0, z1, wk) => {
    const y0 = ytop(z0), y1 = ytop(z1), len = Math.hypot(z1 - z0, y1 - y0), zc = (z0 + z1) / 2;
    const m = addBox(body, 2 * hwid(zc) * wk, 0.04, len, 0, (y0 + y1) / 2 - 0.012, zc, paint);
    m.rotation.x = Math.atan2(y0 - y1, z1 - z0);
    return m;
  };
  P.hood = lid(Z(S.hood[0]), Z(S.hood[1]), 0.9);
  if (S.deck) P.trunk = lid(Z(S.deck[1]), Z(S.deck[0]), 0.9);
  else {
    // caçamba: assoalho escuro entre as bordas e tampa traseira
    const z0 = Z(-0.14), z1 = -hl + 0.06, yb = Y(1.2) + 0.006;
    addBox(body, W - 0.2, 0.012, z0 - z1, 0, yb, (z0 + z1) / 2, M.plastic, false);
    for (const s of [1, -1]) addBox(body, 0.07, 0.03, z0 - z1, s * (W / 2 - 0.06), yb + 0.015, (z0 + z1) / 2, M.trim);
    P.trunk = addBox(body, W * 0.9, 0.42, 0.05, 0, Y(1.0), -hl - 0.005, paint);
    addBox(body, 0.22, 0.04, 0.02, 0, Y(1.1), -hl - 0.035, M.chrome);
  }

  // ---- frente e traseira
  const fy = ytop(hl - 0.05), ry = ytop(-hl + 0.05);
  const ly = Math.max(ybot(hl) + 0.2, fy - 0.11);
  const tly = Math.max(ybot(-hl) + 0.2, ry - 0.12);
  const tailRot = 0.1;
  for (const s of [1, -1]) {
    const k = s > 0 ? 'L' : 'R', x = s * (W / 2 - 0.33);
    const h = addBox(body, 0.38, 0.12, 0.08, x, ly, hl - 0.06 - Math.abs(x) * 0.06, headMat, false);
    h.rotation.y = -s * 0.12;
    const beamM = new THREE.Mesh(beamGeo, beamMat);
    beamM.scale.set(2.4, 2.4, 16); beamM.rotation.set(0.07, s * 0.16, 0); beamM.position.z = 0.04;
    beamM.visible = false; beamM.renderOrder = 3;
    h.add(beamM); P['beam' + k] = beamM;
    P['head' + k] = h;
    addBox(body, 0.4, 0.15, 0.06, x, ly, hl - 0.075 - Math.abs(x) * 0.06, M.trim, false).rotation.y = -s * 0.12;
    const tl = addBox(body, 0.4, 0.13, 0.07, s * (W / 2 - 0.3), tly, -hl + 0.04 + Math.abs(x) * 0.05, tailMat, false);
    tl.rotation.y = s * tailRot;
    P['tail' + k] = tl;
  }
  // grade com moldura cromada, entrada de ar embaixo
  const gw = t.shape === 'pickup' ? W * 0.62 : W * 0.4, gh = t.shape === 'pickup' ? 0.3 : 0.12, gy = t.shape === 'pickup' ? ly - 0.05 : ly - 0.04;
  addBox(body, gw + 0.04, gh + 0.04, 0.03, 0, gy, hl - 0.004, t.shape === 'pickup' ? M.chrome : M.trim, false);
  addBox(body, gw, gh, 0.03, 0, gy, hl + 0.005, M.grille, false);
  P.bumperF = addBox(body, 2 * hwid(hl - 0.1) * 0.99, 0.18, 0.14, 0, ybot(hl) + 0.1, hl - 0.04, t.shape === 'pickup' ? M.chrome : paint);
  addBox(body, W * 0.5, 0.07, 0.03, 0, ybot(hl) + 0.06, hl + 0.035, M.grille, false);
  P.bumperR = addBox(body, 2 * hwid(-hl + 0.1) * 0.99, 0.18, 0.14, 0, ybot(-hl) + 0.1, -hl + 0.04, t.shape === 'pickup' ? M.chrome : paint);
  const plate = plateMat();
  addBox(body, 0.4, 0.13, 0.012, 0, ybot(hl) + 0.12, hl + 0.035, plate, false);
  addBox(body, 0.4, 0.13, 0.012, 0, S.deck ? tly - 0.2 : Y(0.85), S.deck ? -hl - 0.012 : -hl - 0.035, plate, false).rotation.y = Math.PI;
  // pisca (âmbar) e luz de ré (branca)
  const blinkL = new THREE.MeshStandardMaterial({ color: 0x6a4000, emissive: 0xff9a10, emissiveIntensity: 0 }), blinkR = blinkL.clone();
  const revMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xffffff, emissiveIntensity: 0 });
  for (const s of [1, -1]) {
    const bm = s > 0 ? blinkL : blinkR;
    addBox(body, 0.1, 0.06, 0.05, s * (W / 2 - 0.1), ly, hl - 0.2, bm, false).rotation.y = -s * 0.5;
    addBox(body, 0.1, 0.06, 0.05, s * (W / 2 - 0.12), tly - 0.1, -hl + 0.08, bm, false);
    addBox(body, 0.1, 0.06, 0.05, s * (W / 2 - 0.42), tly - 0.1, -hl + 0.035, revMat, false);
  }
  // escapamento
  for (const s of t.shape === 'sport' ? [1, -1] : [1]) body.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.16, 10).rotateX(Math.PI / 2).translate(s * W * 0.28, S.clr + 0.08, -hl - 0.04), M.chrome));

  // ---- portas, frisos, maçanetas e retrovisores
  const belt = A[1];
  const nDoor = S.doors === 4;
  const zMid = A[0] + (D[0] - A[0]) * 0.47;
  const dz0 = cz1 + 0.04, dz1 = nDoor ? zMid : cz0 - 0.02;
  const police = t.shape === 'police';
  const doorM = police ? (() => { const w = new THREE.MeshPhysicalMaterial({ color: 0xf2f2f2, metalness: 0.4, roughness: 0.35, clearcoat: 1 }); const tx = policeDoor(); return [tx, tx, w, w, w, w]; })() : paint;
  const dyb = floorY - 0.03, dyt = belt - 0.012, dzc = (dz0 + dz1) / 2;
  for (const s of [1, -1]) {
    const k = s > 0 ? 'L' : 'R', xd = s * (hwid(dzc) + 0.012);
    const d = addBox(body, 0.025, dyt - dyb, dz0 - dz1, xd, (dyb + dyt) / 2, dzc, doorM);
    P['door' + k] = d;
    // vãos das portas
    for (const zz of nDoor ? [dz0, dz1, cz0 - 0.02] : [dz0, dz1]) addBox(body, 0.012, dyt - dyb, 0.012, s * (hwid(zz) + 0.026), (dyb + dyt) / 2, zz, M.trim, false);
    addBox(body, 0.02, 0.025, 0.13, s * (hwid(dz1 + 0.2) + 0.03), dyt - 0.12, dz1 + 0.2, M.chrome, false);
    if (nDoor) {
      const rz0 = dz1, rz1 = cz0 - 0.02, rc = (rz0 + rz1) / 2;
      addBox(body, 0.025, dyt - dyb, rz0 - rz1, s * (hwid(rc) + 0.012), (dyb + dyt) / 2, rc, police ? doorM[2] : doorM);
      addBox(body, 0.02, 0.025, 0.13, s * (hwid(rz1 + 0.15) + 0.03), dyt - 0.12, rz1 + 0.15, M.chrome, false);
    }
    // retrovisor: braço, carcaça na cor do carro e espelho
    const mx = s * (hb(A[0]) + 0.13), my = belt + 0.09, mz = A[0] - 0.12;
    addBox(body, 0.12, 0.03, 0.05, s * (hb(A[0]) + 0.05), belt + 0.03, mz, M.trim, false);
    addBox(body, 0.17, 0.11, 0.08, mx, my, mz, paint);
    addBox(body, 0.15, 0.09, 0.01, mx, my, mz - 0.042, M.chrome, false);
    if (t.shape === 'taxi') {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.07, A[0] - D[0]), [taxiBand(), taxiBand(), M.trim, M.trim, M.trim, M.trim]);
      band.position.set(s * (hwid(dzc) + 0.04), belt - 0.16, (A[0] + D[0]) / 2);
      body.add(band);
    }
  }

  // ---- teto: giroflex, luminoso do táxi, antena
  let siren = null;
  if (police) {
    addBox(body, 1.1, 0.06, 0.28, 0, roofY + 0.06, (B[0] + C[0]) / 2, M.trim, false);
    const red = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1010, emissiveIntensity: 0 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x000055, emissive: 0x1040ff, emissiveIntensity: 0 });
    addBox(body, 0.48, 0.11, 0.24, 0.27, roofY + 0.14, (B[0] + C[0]) / 2, red, false);
    addBox(body, 0.48, 0.11, 0.24, -0.27, roofY + 0.14, (B[0] + C[0]) / 2, blue, false);
    siren = { red, blue };
  }
  if (t.shape === 'taxi') {
    const sign = canvasMat(128, 32, (g, w, h) => { g.fillStyle = '#ffd21a'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 24px Arial'; g.textAlign = 'center'; g.fillText('TÁXI', w / 2, 25); }, { emissive: 0xffe066, emissiveIntensity: 0.5 });
    sign.emissiveMap = sign.map;
    addBox(body, 0.6, 0.2, 0.26, 0, roofY + 0.13, (B[0] + C[0]) / 2, sign, false);
  }
  body.add(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.28, 4).rotateX(-0.5).translate(0.3, roofY + 0.12, C[0] + 0.05), M.trim));
  if (t.shape === 'sport') {
    // aerofólio
    const sy = ytop(-hl + 0.25) + 0.16;
    for (const s of [1, -1]) addBox(body, 0.04, 0.16, 0.08, s * 0.5, sy - 0.08, -hl + 0.22, M.trim, false);
    addBox(body, W * 0.88, 0.03, 0.26, 0, sy, -hl + 0.2, paint).rotation.x = -0.1;
    for (const s of [1, -1]) addBox(body, 0.02, 0.12, 0.35, s * (hwid(-0.3) + 0.012), S.clr + 0.38, -0.3, M.grille, false);
  }
  if (t.shape === 'pickup') for (const s of [1, -1]) addBox(body, 0.16, 0.05, Math.abs(D[0] - A[0]) + 0.4, s * (W / 2 + 0.03), S.clr + 0.1, (A[0] + D[0]) / 2, M.trim);

  // ---- interior (aparece pelos vidros e na primeira pessoa)
  const fz0 = A[0], seatY = t.wheelR + t.seat[1] - 0.95, cl = cz1 - cz0, cc = (cz0 + cz1) / 2;
  const inner = new THREE.MeshStandardMaterial({ color: 0x2b2622, roughness: 0.85 });
  for (const s of [1, -1]) addBox(body, 0.03, belt - floorY, cl, s * (hwid(cc) - 0.035), (belt + floorY) / 2, cc, inner, false);
  addBox(body, hwid(cc) * 1.9, 0.02, cl, 0, floorY + 0.01, cc, M.plastic, false);
  addBox(body, hwid(cz1) * 1.9, belt - floorY, 0.03, 0, (belt + floorY) / 2, cz1 - 0.01, M.plastic, false);
  addBox(body, hwid(cz0) * 1.9, belt - floorY, 0.03, 0, (belt + floorY) / 2, cz0 + 0.01, inner, false);
  // painel com o quadro de instrumentos e console no meio
  addBox(body, hb(fz0) * 1.9, 0.18, 0.5, 0, belt - 0.06, fz0 - 0.27, M.black, false);
  addBox(body, 0.34, 0.1, 0.08, t.seat[0], belt + 0.03, fz0 - 0.5, M.black, false);
  addBox(body, 0.22, 0.32, 0.6, 0, floorY + 0.16, fz0 - 0.75, M.plastic, false);
  const sw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 6, 20), M.black);
  sw.position.set(t.seat[0], belt - 0.06, fz0 - 0.58); sw.rotation.x = -0.4;
  body.add(sw); P.wheelS = sw;
  for (const sx of [t.seat[0], -t.seat[0]]) {
    addBox(body, 0.5, 0.14, 0.5, sx, seatY + 0.88, t.seat[2] + 0.02, M.seat, false);
    const bk = addBox(body, 0.5, 0.66, 0.12, sx, seatY + 1.22, t.seat[2] - 0.26, M.seat, false); bk.rotation.x = -0.18;
    addBox(body, 0.26, 0.18, 0.1, sx, seatY + 1.66, t.seat[2] - 0.33, M.seat, false);
  }
  if (nDoor) { addBox(body, hb(C[0]) * 1.7, 0.14, 0.5, 0, seatY + 0.88, cz0 + 0.35, M.seat, false); addBox(body, hb(C[0]) * 1.7, 0.6, 0.12, 0, seatY + 1.2, cz0 + 0.1, M.seat, false); }
  P.eye = new THREE.Vector3(t.seat[0], seatY + 1.6, t.seat[2] + 0.1);
  // silhueta pra colisão com pedestre atropelado
  P.prof = { top: ytop((A[0] + hl) / 2) + 0.02, roof: roofY + 0.04, fz0: A[0], bz0: D[0] };

  mergeGroup(body, new Set(Object.values(P).filter((o) => o && o.isMesh)));
  const deform = body.children.filter((m) => m.isMesh && m.material !== headMat && m.material !== tailMat && !(siren && (m.material === siren.red || m.material === siren.blue)));
  return { root, body, wheels, headMat, tailMat, paint, siren, parts: P, deform, blinkL, blinkR, revMat };
}

function buildMesh(t, color) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.33, clearcoat: 1, clearcoatRoughness: 0.06 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff2c8, emissiveIntensity: 0.1 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x5a0000, emissive: 0xff1a0a, emissiveIntensity: 0.1 });
  const L = t.length, W = t.width, r = t.wheelR, a = t.a, b = t.b;
  const wheels = [];
  const mkWheel = (x, z, front, w = 0.24) => {
    const piv = new THREE.Group();
    piv.position.set(x, r, z);
    const spin = new THREE.Group();
    piv.add(spin);
    // pneu com ombro arredondado e flanco (perfil girado), aro com raios que giram junto
    const tire = new THREE.Mesh(tireGeo(r, w), M.tire);
    tire.castShadow = true;
    spin.add(tire);
    const out = Math.sign(x) || 1, ri = r * 0.66;
    if (t.twoWheel) {
      spin.add(new THREE.Mesh(new THREE.CylinderGeometry(ri, ri, w * 0.6, 14).rotateZ(Math.PI / 2), M.frame));
      for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.02, ri * 1.9, 0.02), M.rim); sp.rotation.x = (k * Math.PI) / 3; spin.add(sp); }
    } else {
      spin.add(new THREE.Mesh(new THREE.CylinderGeometry(ri * 0.98, ri * 0.98, w * 0.8, 16, 1, true).rotateZ(Math.PI / 2), M.rimIn));
      spin.add(new THREE.Mesh(new THREE.CylinderGeometry(ri * 0.62, ri * 0.62, 0.02, 16).rotateZ(Math.PI / 2).translate(out * 0.02, 0, 0), M.disc));
      const face = out * (w * 0.5 - 0.035);
      for (let k = 0; k < 5; k++) {
        const sp = new THREE.Mesh(spokeGeo(ri), M.rim);
        sp.rotation.x = (k * Math.PI * 2) / 5; sp.position.x = face;
        spin.add(sp);
      }
      spin.add(new THREE.Mesh(new THREE.CylinderGeometry(ri * 0.97, ri * 0.92, 0.04, 20, 1, true).rotateZ(Math.PI / 2).translate(face, 0, 0), M.rim));
      spin.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.04, 10).rotateZ(Math.PI / 2).translate(face + out * 0.01, 0, 0), M.chrome));
      // pinça do freio fica parada (não gira com a roda)
      piv.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.1).translate(out * 0.01, ri * 0.48, -ri * 0.3), t.shape === 'sport' ? M.caliper : M.frame));
    }
    mergeGroup(spin, new Set());
    root.add(piv);
    wheels.push({ piv, spin, front });
  };

  if (t.boat) {
    // casco: fundo em V (proa afinando), convés, para-brisa e motor de popa
    const hull = new THREE.MeshPhysicalMaterial({ color: 0xf2f2f2, metalness: 0.1, roughness: 0.3, clearcoat: 1 });
    const hs = new THREE.Shape();
    const hl = L / 2, hw = W / 2;
    hs.moveTo(0, hl); hs.quadraticCurveTo(hw, hl * 0.45, hw, -hl * 0.1); hs.lineTo(hw * 0.9, -hl); hs.lineTo(-hw * 0.9, -hl); hs.lineTo(-hw, -hl * 0.1); hs.quadraticCurveTo(-hw, hl * 0.45, 0, hl);
    const hg = new THREE.ExtrudeGeometry(hs, { depth: t.shape === 'boat' ? 0.75 : 0.45, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.08, bevelSegments: 2 });
    hg.rotateX(Math.PI / 2); hg.translate(0, t.shape === 'boat' ? 0.85 : 0.6, 0);
    const hm = new THREE.Mesh(hg, hull); hm.castShadow = true; body.add(hm);
    const stripe = new THREE.Mesh(hg.clone().scale(1.01, 0.18, 1.01).translate(0, 0.42, 0), paint); body.add(stripe);
    if (t.shape === 'boat') {
      addBox(body, W * 0.8, 0.05, L * 0.55, 0, 0.88, -L * 0.12, new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.8 }));
      const ws = addBox(body, W * 0.75, 0.45, 0.04, 0, 1.15, L * 0.12, M.glass, false); ws.rotation.x = -0.5;
      addBox(body, 0.5, 0.45, 0.5, 0.4, 1.05, -0.4, M.seat);
      addBox(body, 0.5, 0.45, 0.5, -0.4, 1.05, -0.4, M.seat);
      addBox(body, 0.35, 0.7, 0.4, 0, 0.8, -L / 2 - 0.15, M.black);
      addBox(body, 0.12, 0.1, 0.12, 0.25, 1.3, L * 0.05, headMat, false);
    } else {
      addBox(body, 0.4, 0.25, 0.9, 0, 0.75, -0.25, M.seat);
      addBox(body, 0.55, 0.3, 0.6, 0, 0.75, 0.55, paint);
      addBox(body, 0.7, 0.05, 0.05, 0, 1.0, 0.65, M.frame);
      addBox(body, 0.12, 0.08, 0.06, 0, 0.82, 0.86, headMat, false);
    }
    addBox(body, 0.18, 0.08, 0.05, 0, t.shape === 'boat' ? 0.95 : 0.7, -L / 2 + 0.02, tailMat, false);
    return { root, body, wheels, headMat, tailMat, paint };
  }

  if (t.twoWheel) {
    mkWheel(0, a, true, t.shape === 'bike' ? 0.05 : 0.14);
    mkWheel(0, -b, false, t.shape === 'bike' ? 0.06 : 0.17);
    const fm = t.shape === 'bike' ? new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.35 }) : paint;
    if (t.shape === 'bike') {
      addBox(body, 0.05, 0.05, 0.85, 0, r + 0.32, 0.05, fm);
      const d1 = addBox(body, 0.05, 0.05, 0.7, 0, r + 0.12, -0.1, fm); d1.rotation.x = 0.5;
      addBox(body, 0.05, 0.6, 0.05, 0, r + 0.2, a - 0.05, fm).rotation.x = -0.25;
      addBox(body, 0.05, 0.45, 0.05, 0, r + 0.2, -0.15, fm);
      addBox(body, 0.6, 0.04, 0.04, 0, r + 0.55, a - 0.12, M.frame);
      addBox(body, 0.14, 0.05, 0.24, 0, r + 0.47, -0.2, M.seat);
    } else {
      addBox(body, 0.36, 0.38, 0.95, 0, r + 0.25, 0.05, paint);
      addBox(body, 0.3, 0.14, 0.62, 0, r + 0.5, -0.38, M.seat);
      addBox(body, 0.22, 0.22, 0.6, 0, r + 0.05, -0.1, M.frame);
      addBox(body, 0.06, 0.6, 0.06, 0, r + 0.35, a - 0.12, M.chrome).rotation.x = -0.35;
      addBox(body, 0.7, 0.05, 0.05, 0, r + 0.72, a - 0.25, M.frame);
      addBox(body, 0.18, 0.16, 0.1, 0, r + 0.6, a - 0.06, headMat, false);
      addBox(body, 0.16, 0.08, 0.06, 0, r + 0.42, -b - 0.12, tailMat, false);
      addBox(body, 0.08, 0.08, 0.5, 0.14, r - 0.05, -0.55, M.chrome);
    }
    return { root, body, wheels, headMat, tailMat, paint };
  }

  return buildCar(t, color, { root, body, wheels, headMat, tailMat, paint, mkWheel });
}

let uid = 1;
export class Vehicle {
  constructor(type, color, x, z, heading = 0) {
    this.id = uid++;
    this.type = type;
    this.t = VTYPES[type];
    this.color = color;
    const m = buildMesh(this.t, color);
    Object.assign(this, m);
    this.pos = new THREE.Vector3(x, heightAt(x, z), z);
    this.vel = new THREE.Vector3();
    this.heading = heading;
    this.yawRate = 0;
    this.steer = 0;
    this.gear = 1;
    this.rpm = this.t.idle || 0;
    this.shiftT = 0;
    this.ax = 0; this.ay = 0;
    this.vy = 0; this.onGround = true; this.lastGy = this.pos.y;
    this.pitch = 0; this.roll = 0; this.lean = 0;
    // suspensão (massa suspensa): arfagem, rolagem e altura com mola + amortecedor
    this.sP = 0; this.sPv = 0; this.sR = 0; this.sRv = 0; this.sH = 0; this.sHv = 0;
    this.gradeF = 0; this.gradeL = 0; this.aqua = 0; this.pudL = 0; this.pudR = 0;
    this.health = 1000;
    this.driver = null;
    this.ai = null;
    this.rider = null;
    this.brakeOn = false;
    this.slip = 0;
    this.sleeping = true;
    this.inWater = false;
    this.lights = false;
    this.impact = 0;
    this.radius = this.t.width / 2;
    this.zones = { front: 0, rear: 0, left: 0, right: 0 };
    this.toe = 0;
    this.syncMesh();
  }

  get speed() { return Math.hypot(this.vel.x, this.vel.z); }
  get fwdSpeed() { return this.vel.x * Math.sin(this.heading) + this.vel.z * Math.cos(this.heading); }

  setRider(char) {
    if (this.rider) this.body.remove(this.rider.root);
    this.rider = char;
    if (char) {
      const s = this.t.seat;
      char.root.position.set(s[0], this.t.wheelR + s[1] - 0.95, s[2]);
      char.root.rotation.set(0, 0, 0);
      this.body.add(char.root);
    }
  }

  engineTorque(rpm) {
    const x = rpm / this.t.redline;
    return this.t.torque * clamp(1 - 1.4 * (x - 0.62) ** 2, 0.35, 1);
  }

  update(dt, ctrl, env, manual = false) {
    const t = this.t;
    this.px = this.pos.x; this.pz = this.pos.z;
    if (t.boat) { this.updateBoat(dt, ctrl, env); return; }
    if (ctrl && (ctrl.throttle > 0.02 || ctrl.brake > 0.02 || Math.abs(ctrl.steer) > 0.02)) this.sleeping = false;
    if (this.sleeping && !this.driver) { this.syncMesh(); return; }
    ctrl = ctrl || { throttle: 0, brake: 0, steer: 0, handbrake: this.driver ? false : true };
    const speed = this.speed;
    const maxSteer = t.steer / (1 + speed * t.steerFall);
    // frente batida desalinha a direção: o carro puxa de leve pra um lado
    const target = clamp(ctrl.steer, -1, 1) * maxSteer + (this.driver ? this.toe : 0);
    const rate = ctrl.analog ? 6 : 2.6;
    const back = Math.sign(target) !== Math.sign(this.steer) || Math.abs(target) < Math.abs(this.steer) ? 1.6 : 1;
    this.steer += clamp(target - this.steer, -rate * back * dt, rate * back * dt);

    // marcha à ré / freio
    const vx = this.fwdSpeed;
    let thr = ctrl.throttle, brk = ctrl.brake;
    if (this.gear === -1) {
      if (ctrl.throttle > 0.1 && vx > -1.2) this.gear = 1;
      else { thr = ctrl.brake; brk = ctrl.throttle; }
    } else if (ctrl.brake > 0.1 && vx < 0.8 && ctrl.throttle < 0.1) this.gear = -1;
    if (this.gear === -1 && ctrl.throttle > 0.1) { thr = 0; brk = ctrl.throttle; }
    this.thr = thr; this.brk = brk;
    if (this.ai) {
      if (Math.abs(ctrl.steer) > 0.3 && speed < 13) { this.blink = Math.sign(ctrl.steer); this.blinkHold = 1.2; }
      else if ((this.blinkHold = (this.blinkHold || 0) - dt) <= 0) this.blink = 0;
    }
    this.brakeOn = brk > 0.05;

    if (!t.pedal && this.gear > 0) {
      const ratio = t.gears[this.gear - 1] * t.final;
      const wrpm = (Math.abs(vx) / t.wheelR) * ratio * 9.549;
      if (manual) {
        if (ctrl.shiftUp && this.gear < t.gears.length) { this.gear++; this.shiftT = 0.18; }
        if (ctrl.shiftDown && this.gear > 1) { this.gear--; this.shiftT = 0.18; }
      } else if (this.shiftT <= 0) {
        if (wrpm > t.redline * 0.93 && this.gear < t.gears.length) { this.gear++; this.shiftT = 0.22; }
        else if (this.gear > 1 && wrpm < t.redline * 0.42) {
          const lower = (Math.abs(vx) / t.wheelR) * t.gears[this.gear - 2] * t.final * 9.549;
          if (lower < t.redline * 0.85) { this.gear--; this.shiftT = 0.18; }
        }
      }
    }
    this.shiftT -= dt;

    // inclinação do chão (gravidade na ladeira) e poças embaixo das rodas
    {
      const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
      const hf = heightAt(this.pos.x + sh * t.a, this.pos.z + ch * t.a), hb = heightAt(this.pos.x - sh * t.b, this.pos.z - ch * t.b);
      this.gradeF = (hf - hb) / t.wheelbase;
      if (!t.twoWheel) {
        const hw = t.width / 2;
        this.gradeL = (heightAt(this.pos.x + ch * hw, this.pos.z - sh * hw) - heightAt(this.pos.x - ch * hw, this.pos.z + sh * hw)) / t.width;
      } else this.gradeL = 0;
      const wet = env.wetness;
      if (wet > 0.25 && this.speed > 3) {
        const hw = t.width / 2 - 0.13, fx = this.pos.x + sh * t.a, fz = this.pos.z + ch * t.a;
        this.pudL = puddleAt(fx + ch * hw, fz - sh * hw, wet);
        this.pudR = t.twoWheel ? this.pudL : puddleAt(fx - ch * hw, fz + sh * hw, wet);
      } else this.pudL = this.pudR = 0;
      // aquaplanagem: lâmina d'água + velocidade alta → o pneu flutua e perde aderência
      const film = Math.max(this.pudL, this.pudR) * 0.85 + (wet > 0.6 ? (wet - 0.6) * 0.25 : 0);
      this.aqua = film * smoothstep(15, 27, this.speed);
    }

    const n = 4, h = dt / n;
    for (let i = 0; i < n; i++) this.step(h, ctrl, thr, brk, env);

    // rpm para som/HUD
    if (t.pedal) this.rpm = Math.abs(vx) / t.wheelR;
    else {
      const ratio = (this.gear > 0 ? t.gears[this.gear - 1] : 3.2) * t.final;
      const wr = (Math.abs(vx) / t.wheelR) * ratio * 9.549;
      const free = t.idle + thr * (t.redline - t.idle) * 0.9;
      const target = this.onGround && Math.abs(vx) > 0.5 ? Math.max(t.idle, wr + this.slip * 1500) : free;
      this.rpm = lerp(this.rpm, clamp(target, t.idle, t.redline * 1.02), 1 - Math.exp(-dt * 10));
    }
    if (!this.driver && this.speed < 0.05 && this.onGround && Math.abs(this.yawRate) < 0.01) this.sleeping = true;
    this.syncMesh(dt);
  }

  step(dt, ctrl, thr, brk, env) {
    const t = this.t, m = t.mass, g = 9.81;
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    const fx = sh, fz = ch, lx = ch, lz = -sh;
    const vx = this.vel.x * fx + this.vel.z * fz;
    const vy = this.vel.x * lx + this.vel.z * lz;
    const a = t.a, b = t.b, L = a + b;
    const surf = this.inWater ? 'water' : surfaceAt(this.pos.x, this.pos.z);
    const S = SURF[surf];
    const wetF = surf === 'road' || surf === 'walk' ? 1 - 0.3 * env.wetness : 1 - 0.15 * env.wetness;
    const mu0 = t.grip * S.mu * wetF * (1 - 0.8 * this.aqua);
    // asa/difusor: carga aerodinâmica cresce com v²
    const down = t.ClA ? 0.5 * 1.2 * t.ClA * vx * vx : 0;
    let NF = (m * g * b) / L - (m * this.ax * t.cgh) / L + down * 0.45;
    let NR = (m * g * a) / L + (m * this.ax * t.cgh) / L + down * 0.55;
    // sensibilidade à carga: a transferência lateral tira aderência do eixo (mais na frente → sai de frente no limite)
    const q = t.twoWheel ? 0 : Math.min(1, Math.abs(this.ay) * t.cgh / (g * t.width * 0.5));
    const mu = mu0, muFy = mu0 * (1 - 0.16 * q * q), muRy = mu0 * (1 - 0.09 * q * q);
    NF = Math.max(NF, m * g * 0.08); NR = Math.max(NR, m * g * 0.08);

    let Fdrive = 0;
    if (this.inWater) thr = 0;
    if (t.pedal) {
      Fdrive = thr * Math.min(t.power / Math.max(Math.abs(vx), 1.5), t.maxF);
      if (this.gear === -1) Fdrive = -thr * 120;
    } else if (this.shiftT <= 0 || this.gear < 0) {
      const ratio = (this.gear > 0 ? t.gears[this.gear - 1] : 3.2) * t.final;
      const rpm = Math.max(t.idle, (Math.abs(vx) / t.wheelR) * ratio * 9.549);
      let T = rpm > t.redline ? 0 : this.engineTorque(rpm) * thr;
      if (thr < 0.05 && this.gear > 0) T = -t.torque * 0.12 * (rpm / t.redline) * Math.sign(vx);
      Fdrive = ((T * ratio * 0.86) / t.wheelR) * (this.gear < 0 ? -1 : 1);
    }
    const fs = t.drive === 'awd' ? 0.4 : t.drive === 'front' ? 1 : 0;
    let FxF = Fdrive * fs, FxR = Fdrive * (1 - fs);
    const bdir = -clamp(vx * 3, -1, 1);
    const Fb = brk * t.brakeF;
    const bF = Fb * 0.62, bR = Fb * 0.38 + (ctrl.handbrake ? t.brakeF * 0.9 : 0);
    // sem ABS: a roda trava quando o freio pede mais do que o pneu aguenta
    const moving = Math.abs(vx) > 1.2 && this.onGround;
    const lockF = moving && bF > mu * NF * (this.lockF ? 0.7 : 0.92);
    const lockR = moving && bR > mu * NR * (this.lockR ? 0.7 : 0.92);
    if (!lockF) FxF += bF * bdir;
    if (!lockR) FxR += bR * bdir;

    const absvx = Math.max(Math.abs(vx), 0.6);
    const sg = vx >= 0 ? 1 : -1;
    const d = this.steer;
    const cd = Math.cos(d), sd = Math.sin(d);
    const alphaF = Math.atan2(vy + this.yawRate * a, absvx) - d * sg;
    const alphaR = Math.atan2(vy - this.yawRate * b, absvx);
    const tire = (al) => Math.sin(1.55 * Math.atan(8.5 * al));
    let FyF = -muFy * NF * tire(alphaF);
    let FyR = -muRy * NR * tire(alphaR);
    // pneu travado desliza: atrito cinético contra a velocidade do ponto de contato (não esterça)
    const muK = mu * 0.78;
    if (lockF) {
      const cx = vx, cy = vy + this.yawRate * a, cv = Math.hypot(cx, cy) || 1;
      const bx = (-muK * NF * cx) / cv, by = (-muK * NF * cy) / cv;
      FxF = bx * cd + by * sd; FyF = -bx * sd + by * cd;
    }
    if (lockR) {
      const cx = vx, cy = vy - this.yawRate * b, cv = Math.hypot(cx, cy) || 1;
      FxR = (-muK * NR * cx) / cv; FyR = (-muK * NR * cy) / cv;
    }

    let s = Math.hypot(FxR, FyR), lim = mu * NR;
    let slipR = 0;
    if (!lockR && s > lim) { slipR = 1 - lim / s; FxR *= lim / s; FyR *= lim / s; }
    s = Math.hypot(FxF, FyF); lim = mu * NF;
    if (!lockF && s > lim) { FxF *= lim / s; FyF *= lim / s; }
    const spdNow = Math.hypot(vx, vy);
    this.lockF = lockF; this.lockR = lockR; this.slipR = slipR; this.alphaF = alphaF; this.alphaR = alphaR;
    this.slip = lerp(this.slip, Math.max(slipR, lockF || lockR ? 1 : 0, Math.min(1, Math.abs(alphaR) * 2.2 - 0.25)) * clamp(spdNow / 4, 0, 1), 0.1);
    this.surface = surf;

    const rvx = this.vel.x - env.wind.x, rvz = this.vel.z - env.wind.y;
    const rv = Math.hypot(rvx, rvz);
    const k = 0.5 * 1.2 * t.CdA * rv;
    const dF = -k * (rvx * fx + rvz * fz), dL = -k * (rvx * lx + rvz * lz);
    const Froll = -S.rr * m * g * clamp(vx * 2, -1, 1);
    // água da poça segura a roda: lado com mais água puxa o carro
    const pk = m * 0.03, dPL = -this.pudL * pk * vx, dPR = -this.pudR * pk * vx;
    // gravidade na ladeira (ao longo e de lado)
    const gF = -m * g * this.gradeF / Math.sqrt(1 + this.gradeF * this.gradeF);
    const gL = -m * g * this.gradeL / Math.sqrt(1 + this.gradeL * this.gradeL);
    let Fx = FxR + FxF * cd - FyF * sd + dF + Froll + dPL + dPR + gF;
    let Fy = FyR + FyF * cd + FxF * sd + dL * (t.twoWheel ? 0.4 : 1) + gL;
    let Tz = a * (FyF * cd + FxF * sd) - b * FyR + (dPL - dPR) * (t.width / 2);
    if (!this.onGround) { Fx = dF; Fy = dL; Tz = 0; }
    this.FxNet = Fx; this.FyNet = Fy;
    if (this.inWater) { Fx -= vx * m * 1.2; Fy -= vy * m * 1.2; Tz -= this.yawRate * t.I * 1.5; }

    this.vel.x += ((fx * Fx + lx * Fy) / m) * dt;
    this.vel.z += ((fz * Fx + lz * Fy) / m) * dt;
    this.yawRate += (Tz / t.I) * dt;
    if (this.onGround) {
      // mistura com o modelo cinemático só quando o carro está quase parado (velocidade total, não só a frontal)
      const spd = Math.hypot(this.vel.x, this.vel.z);
      const kk = clamp((spd - 0.4) / 3, 0, 1);
      const kin = (vx * Math.tan(d)) / L;
      this.yawRate = lerp(kin, this.yawRate, kk);
      const vy2 = this.vel.x * lx + this.vel.z * lz;
      const kill = vy2 * (1 - kk) * Math.min(1, dt * 10);
      this.vel.x -= lx * kill; this.vel.z -= lz * kill;
      if (spd < 0.25 && thr < 0.02 && (brk > 0.05 || ctrl.handbrake || !this.driver)) {
        this.vel.x *= 0.8; this.vel.z *= 0.8; this.yawRate *= 0.8;
      }
    } else this.yawRate *= 0.999;
    this.ax = lerp(this.ax, clamp(Fx / m, -12, 12), 0.08);
    this.ay = lerp(this.ay, clamp(Fy / m, -12, 12), 0.08);
    this.heading += this.yawRate * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    // vertical: segue o chão, decola em lombadas
    const gy = heightAt(this.pos.x, this.pos.z);
    this.vy -= g * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= gy) {
      const rate = (gy - this.lastGy) / dt;
      if (!this.onGround && this.vy < -5) this.impact = Math.max(this.impact, -this.vy * 0.25);
      if (!this.onGround && this.vy < -1.5) this.sHv += this.vy * 0.6;
      this.pos.y = gy;
      this.vy = Math.max(this.vy, Math.min(rate, 25));
      this.onGround = true;
    } else this.onGround = this.pos.y - gy < 0.06;
    this.lastGy = gy;
    if (gy < -1.1) {
      this.inWater = true;
      if (this.pos.y < -1.0) { this.pos.y = Math.max(this.pos.y, -1.6); this.vy = Math.max(this.vy, -0.5); this.onGround = true; }
    } else this.inWater = false;
  }

  // ---------------- barco: empuxo, arrasto do casco, leme e boia nas ondas
  updateBoat(dt, ctrl, env) {
    const t = this.t, m = t.mass, W = Vehicle.world;
    if (ctrl && (ctrl.throttle > 0.02 || ctrl.brake > 0.02)) this.sleeping = false;
    if (this.sleeping && !this.driver) { this.floatMesh(dt, env); return; }
    ctrl = ctrl || { throttle: 0, brake: 0, steer: 0 };
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    const vx = this.vel.x * sh + this.vel.z * ch, vy = this.vel.x * ch - this.vel.z * sh;
    const bed = heightAt(this.pos.x + sh * t.length * 0.4, this.pos.z + ch * t.length * 0.4);
    const afloat = heightAt(this.pos.x, this.pos.z) < -0.7;
    this.inWater = false;
    this.steer += clamp(clamp(ctrl.steer, -1, 1) * t.steer - this.steer, -4 * dt, 4 * dt);
    let thr = ctrl.throttle - ctrl.brake * 0.45;
    if (!afloat) thr = 0;
    this.thr = Math.abs(thr); this.brakeOn = false;
    const cx = t.thrust / (t.vmax * t.vmax);
    let Fx = thr * t.thrust - cx * vx * Math.abs(vx) - vx * m * 0.05;
    let Fy = -vy * Math.abs(vy) * m * 0.9 - vy * m * 1.6;
    // vento empurra o barco de lado
    const wx = env.wind.x * ch - env.wind.y * sh;
    Fy += wx * Math.abs(wx) * t.CdA * 0.6;
    // leme: vira mais quanto mais rápido; jet-ski vira com o jato mesmo devagar
    const rudder = this.steer * (Math.abs(vx) * 0.55 + (t.shape === 'jetski' ? Math.abs(thr) * 3 : 0)) * Math.sign(vx || 1);
    this.yawRate += (rudder - this.yawRate) * Math.min(1, dt * 2.5);
    if (!afloat) { Fx = -vx * m * 6; Fy = -vy * m * 6; this.yawRate *= Math.exp(-dt * 6); }
    this.vel.x += ((sh * Fx + ch * Fy) / m) * dt;
    this.vel.z += ((ch * Fx - sh * Fy) / m) * dt;
    this.heading += this.yawRate * dt;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    // encalhou na areia: para
    if (bed > -0.4 && vx > 0) { this.vel.multiplyScalar(Math.exp(-dt * 5)); if (this.driver === 'player' && Vehicle.onBeach) Vehicle.onBeach(this); }
    this.ax = lerp(this.ax || 0, clamp(Fx / m, -8, 8), 0.1);
    this.ay = lerp(this.ay || 0, clamp(Fy / m, -8, 8), 0.1);
    this.rpm = lerp(this.rpm, t.idle + Math.abs(thr) * (t.redline - t.idle) * (0.6 + 0.4 * Math.min(1, Math.abs(vx) / t.vmax)), 1 - Math.exp(-dt * 4));
    this.onGround = true; this.surface = 'water';
    this.slip = clamp(Math.abs(vy) / 6, 0, 1);
    if (!this.driver && Math.hypot(this.vel.x, this.vel.z) < 0.05) this.sleeping = true;
    this.floatMesh(dt, env);
    if (W) void W;
  }

  // posição e inclinação seguindo as ondas (a proa sobe quando acelera)
  floatMesh(dt, env) {
    const t = this.t, W = Vehicle.world;
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    const w = W ? W.waveAt(this.pos.x, this.pos.z) : { h: 0, gx: 0, gz: 0 };
    const ground = heightAt(this.pos.x, this.pos.z);
    const target = Math.max(w.h - 0.35, ground);
    this.pos.y = lerp(this.pos.y, target, 1 - Math.exp(-dt * 6));
    const vx = this.fwdSpeed;
    const gF = w.gx * sh + w.gz * ch, gL = w.gx * ch - w.gz * sh;
    const plane = -clamp(vx / (t.vmax || 20), 0, 1) * (t.shape === 'boat' ? 0.12 : 0.08);
    const bob = Math.sin((this.t0 = (this.t0 || 0) + dt) * 1.7 + this.id) * 0.02;
    this.pitch = lerp(this.pitch, Math.atan(gF) * 0.8 + plane + bob, 1 - Math.exp(-dt * 4));
    this.roll = lerp(this.roll, -Math.atan(gL) * 0.8 + clamp(this.yawRate * vx * 0.03, -0.35, 0.35) * (t.shape === 'jetski' ? -1.4 : -0.6), 1 - Math.exp(-dt * 4));
    this.root.position.copy(this.pos);
    this.root.rotation.set(this.pitch, this.heading, this.roll, 'YXZ');
    this.headMat.emissiveIntensity = this.lights ? 4 : 0.15;
    this.tailMat.emissiveIntensity = this.lights ? 1.4 : 0.1;
    // esteira e espuma atrás quando anda
    if (Vehicle.fx && dt > 0 && Math.abs(vx) > 3 && Math.random() < dt * Math.abs(vx) * 0.8) {
      const bx = this.pos.x - sh * t.length * 0.5, bz = this.pos.z - ch * t.length * 0.5;
      Vehicle.fx.sprite(bx + (Math.random() - 0.5) * t.width, w.h + 0.1, bz + (Math.random() - 0.5) * t.width, { color: 0xf4f8fa, op: 0.55, size: 0.6, life: 1.6, vx: -sh * 1.5 + (Math.random() - 0.5) * 2, vy: 0.8, vz: -ch * 1.5 + (Math.random() - 0.5) * 2, g: 3, grow: 2.6 });
    }
  }

  syncMesh(dt = 0) {
    const t = this.t;
    this.root.position.copy(this.pos);
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    if (this.onGround && dt > 0) {
      const hf = heightAt(this.pos.x + sh * t.a, this.pos.z + ch * t.a);
      const hb = heightAt(this.pos.x - sh * t.b, this.pos.z - ch * t.b);
      const tp = Math.atan2(hb - hf, t.wheelbase);
      let tr = 0;
      if (!t.twoWheel) {
        const hl = heightAt(this.pos.x + ch * t.width * 0.5, this.pos.z - sh * t.width * 0.5);
        const hr = heightAt(this.pos.x - ch * t.width * 0.5, this.pos.z + sh * t.width * 0.5);
        tr = Math.atan2(hl - hr, t.width);
      }
      this.pitch = lerp(this.pitch, tp, 1 - Math.exp(-dt * 12));
      this.roll = lerp(this.roll, tr, 1 - Math.exp(-dt * 12));
    } else if (dt > 0) this.pitch = lerp(this.pitch, 0.15, dt * 0.4);
    if (t.twoWheel) {
      const vx = this.fwdSpeed;
      const want = clamp(-Math.atan((vx * this.yawRate) / 9.81), -0.75, 0.75);
      this.lean = lerp(this.lean, this.speed < 0.6 && !this.driver ? -0.25 : want, 1 - Math.exp(-dt * 8));
      this.root.rotation.set(this.pitch, this.heading, this.roll + this.lean, 'YXZ');
    } else {
      this.root.rotation.set(this.pitch, this.heading, this.roll, 'YXZ');
      if (dt > 0) {
        // mola ~1,3 Hz, amortecimento ~0,35 do crítico; mergulha ao frear, agacha ao acelerar, inclina na curva
        const w2 = 66, c = 5.6, sub = Math.min(4, Math.ceil(dt / 0.01)), h = dt / sub;
        const tp = clamp(-this.ax * 0.0075, -0.075, 0.075), tr = clamp(this.ay * 0.0095, -0.095, 0.095);
        for (let i = 0; i < sub; i++) {
          this.sPv += (w2 * (tp - this.sP) - c * this.sPv) * h; this.sP += this.sPv * h;
          this.sRv += (w2 * (tr - this.sR) - c * this.sRv) * h; this.sR += this.sRv * h;
          this.sHv += (w2 * 1.3 * -this.sH - c * 1.2 * this.sHv) * h; this.sH += this.sHv * h;
        }
        this.sH = clamp(this.sH, -0.14, 0.1);
      }
      this.body.rotation.x = this.sP;
      this.body.rotation.z = this.sR;
      this.body.position.y = this.sH;
    }
    const vx = this.fwdSpeed;
    for (const w of this.wheels) {
      if (w.front) w.piv.rotation.y = this.steer;
      // roda travada não gira; roda motriz patinando gira mais rápido que o chão
      const drv = t.drive === 'awd' || (t.drive === 'front') === w.front;
      if (!(w.front ? this.lockF : this.lockR)) w.spin.rotation.x += (vx / t.wheelR + (drv ? (this.slipR || 0) * 60 * Math.sign(this.thr || 0) : 0)) * dt;
    }
    if (this.inWater) this.root.position.y -= 0.3;
    if (this.parts && this.parts.wheelS) this.parts.wheelS.rotation.z = -this.steer * 6;
    this.headMat.emissiveIntensity = this.lights ? 4 : 0.15;
    if (this.parts && this.parts.beamL) this.parts.beamL.visible = this.parts.beamR.visible = this.lights && BEAM.uBeam.value > 0.005;
    this.tailMat.emissiveIntensity = this.brakeOn && this.driver ? 5 : this.lights ? 1.4 : 0.1;
    // luz de ré, setas (carros da cidade sinalizam a curva) e pisca-alerta no carro muito batido
    if (this.revMat) {
      this.revMat.emissiveIntensity = this.gear === -1 && this.driver ? 3 : 0;
      const on = (performance.now() % 760) < 380, hz = this.health < 350 && !this.exploded;
      this.blinkL.emissiveIntensity = on && (hz || this.blink > 0) ? 5 : 0;
      this.blinkR.emissiveIntensity = on && (hz || this.blink < 0) ? 5 : 0;
    }
  }

  // colisão com prédios: três círculos ao longo do carro; em alta velocidade testa o caminho em passos (não atravessa poste fino)
  collideWorld(col) {
    const t = this.t;
    const r = Math.max(0.3, t.width / 2);
    const ex = this.pos.x, ez = this.pos.z, px = this.px ?? ex, pz = this.pz ?? ez;
    const steps = Math.min(8, Math.max(1, Math.ceil(Math.hypot(ex - px, ez - pz) / (r * 0.6))));
    this.preVel = this.preVel || new THREE.Vector3();
    this.preVel.copy(this.vel);
    let worst = 0;
    this.scrapeNow = 0;
    for (let k = 1; k <= steps; k++) {
      if (steps > 1) { this.pos.x = px + ((ex - px) * k) / steps; this.pos.z = pz + ((ez - pz) * k) / steps; }
      const w = this.collideStep(col, r);
      if (w < 0) continue;
      worst = Math.max(worst, w);
      break;
    }
    if (worst > 1.5) this.damage(worst, ...this._hit);
    this.hitV = worst;
    return worst;
  }

  // -1 = sem contato; senão velocidade normal do pior impacto
  collideStep(col, r) {
    const t = this.t;
    const off = Math.max(0, t.length / 2 - r);
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    let worst = -1;
    const p = this._p || (this._p = { x: 0, z: 0 }), n = this._n || (this._n = { x: 0, z: 0 });
    const brk = Vehicle.props ? (this._brk || (this._brk = (b, nx, nz) => Vehicle.props.hit(this, b, nx, nz, this._cx - nx * r, this._cz - nz * r))) : null;
    for (const s of [-1, 0, 1]) {
      const cx = this.pos.x + sh * off * s, cz = this.pos.z + ch * off * s;
      p.x = cx; p.z = cz; this._cx = cx; this._cz = cz;
      if (!col.resolveCircle(p, r, this.pos.y + 0.3, n, brk)) continue;
      if (worst < 0) worst = 0;
      this.pos.x += p.x - cx; this.pos.z += p.z - cz;
      const rx = cx - this.pos.x, rz = cz - this.pos.z;
      const vcx = this.vel.x + this.yawRate * rz, vcz = this.vel.z - this.yawRate * rx;
      const vn = vcx * n.x + vcz * n.z;
      if (vn >= 0) continue;
      // quique baixo quando a batida é forte (energia vai pra amassar a lataria)
      const e = clamp(0.3 - -vn * 0.012, 0.06, 0.3);
      const rn = rz * n.x - rx * n.z;
      const j = (-(1 + e) * vn) / (1 / t.mass + (rn * rn) / t.I);
      // atrito de raspão na parede (Coulomb): desliza encostado em vez de grudar
      const tx = -n.z, tz = n.x, vt = vcx * tx + vcz * tz, rt = rz * tx - rx * tz;
      const jt = clamp(-vt / (1 / t.mass + (rt * rt) / t.I), -0.35 * j, 0.35 * j);
      this.vel.x += (j * n.x + jt * tx) / t.mass; this.vel.z += (j * n.z + jt * tz) / t.mass;
      this.yawRate += (rn * j + rt * jt) / t.I;
      this.jolt((j * n.x + jt * tx) / t.mass, (j * n.z + jt * tz) / t.mass);
      if (Math.abs(vt) > 2.5) { this.scrapeNow = Math.max(this.scrapeNow, Math.abs(vt)); this._scr = [cx - n.x * r, cz - n.z * r]; }
      if (-vn > worst) { worst = -vn; this._hit = [cx - n.x * r, cz - n.z * r, n.x, n.z]; }
      this.sleeping = false;
    }
    return worst;
  }

  // tranco na carroceria (mola da suspensão) a partir de uma variação de velocidade no mundo
  jolt(dvx, dvz) {
    if (this.t.twoWheel || this.t.boat) return;
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    const df = dvx * sh + dvz * ch, dl = dvx * ch - dvz * sh;
    this.sPv += clamp(-df * 0.09, -1.6, 1.6);
    this.sRv += clamp(dl * 0.08, -1.4, 1.4);
    this.sHv -= Math.min(0.8, Math.hypot(df, dl) * 0.025);
  }

  // dano localizado: (cx,cz) ponto de contato no mundo, (nx,nz) direção do empurrão
  damage(v, cx, cz, nx, nz) {
    this.impact = Math.max(this.impact, v);
    this.health -= v * v * 1.2;
    if (Vehicle.onDamage) Vehicle.onDamage(this, v, cx, cz);
    if (cx === undefined || !this.deform) return;
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    const dx = cx - this.pos.x, dz = cz - this.pos.z;
    const lz = dx * sh + dz * ch, lx = dx * ch - dz * sh;
    const dX = nx * ch - nz * sh, dZ = nx * sh + nz * ch;
    const L = this.t.length, W = this.t.width;
    const zf = lz / (L / 2), zs = lx / (W / 2);
    const zone = Math.abs(zf) > Math.abs(zs) * 0.9 ? (zf > 0 ? 'front' : 'rear') : zs > 0 ? 'left' : 'right';
    this.zones[zone] += v * v * 1.2;
    if (zone === 'front' && v > 5) this.toe = clamp(this.toe + (lx > 0 ? 1 : -1) * v * 0.0007, -0.035, 0.035);
    this.dent(clamp(lx, -W / 2, W / 2), clamp(lz, -L / 2, L / 2), dX, dZ, v);
    this.breakZone(zone, lx);
  }

  dent(cx, cz, dX, dZ, v) {
    const amt = Math.min(0.26, v * 0.028), R = Math.min(1.8, 0.5 + v * 0.08);
    const dl = Math.hypot(dX, dZ) || 1; dX /= dl; dZ /= dl;
    for (const m of this.deform) {
      if (!m.visible) continue;
      const pos = m.geometry.attributes.position;
      const o = m.userData.orig || (m.userData.orig = pos.array.slice());
      let changed = false;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const d = Math.hypot(x + m.position.x - cx, z + m.position.z - cz);
        if (d >= R) continue;
        const k = amt * (1 - d / R) ** 2;
        let nx = x + dX * k, nz = z + dZ * k;
        const ox = o[i * 3], oz = o[i * 3 + 2], ex = nx - ox, ez = nz - oz, D = Math.hypot(ex, ez);
        if (D > 0.5) { nx = ox + (ex / D) * 0.5; nz = oz + (ez / D) * 0.5; }
        pos.setXYZ(i, nx, y > 0 ? Math.max(o[i * 3 + 1] - 0.15, y - k * 0.3) : y, nz);
        changed = true;
      }
      if (changed) { pos.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere(); }
    }
  }

  breakZone(zone, lx) {
    const z = this.zones[zone], P = this.parts, side = lx > 0 ? 'L' : 'R', fx = Vehicle.fx;
    if (!fx) return;
    const glass = (m) => m && m.visible && fx.glass(this, m);
    const part = (m) => m && m.visible && fx.detach(this, m);
    if (zone === 'front') {
      if (z > 140) glass(P['head' + side]);
      if (z > 300) part(P.bumperF);
      if (z > 420) glass(P.paneF);
      if (z > 700) part(P.hood);
      if (z > 900) { glass(P.headL); glass(P.headR); }
    } else if (zone === 'rear') {
      if (z > 140) glass(P['tail' + side]);
      if (z > 300) part(P.bumperR);
      if (z > 420) glass(P.paneB);
      if (z > 700) part(P.trunk);
    } else {
      const S = zone === 'left' ? 'L' : 'R';
      if (z > 320) glass(P['pane' + S]);
      if (z > 700) part(P['door' + S]);
    }
  }

  repairVisual() {
    for (const m of this.deform) {
      m.visible = true;
      if (m.userData.orig) { m.geometry.attributes.position.array.set(m.userData.orig); m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals(); }
    }
    for (const k in this.parts) this.parts[k].visible = true;
    this.zones = { front: 0, rear: 0, left: 0, right: 0 };
    this.toe = 0;
  }

  circles(out) {
    const t = this.t, r = Math.max(0.3, t.width / 2), off = Math.max(0, t.length / 2 - r);
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    for (let s = -1, i = 0; s <= 1; s++, i++) { out[i].x = this.pos.x + sh * off * s; out[i].z = this.pos.z + ch * off * s; out[i].r = r; }
    return out;
  }

  // ponto local -> testa se (x,z) está dentro do retângulo do carro (+margem)
  contains(x, z, m = 0) {
    const dx = x - this.pos.x, dz = z - this.pos.z;
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    const f = dx * sh + dz * ch, l = dx * ch - dz * sh;
    return Math.abs(f) < this.t.length / 2 + m && Math.abs(l) < this.t.width / 2 + m;
  }

  doorPoint(side = 1) {
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    const off = this.t.width / 2 + 0.7;
    return { x: this.pos.x + ch * off * side, z: this.pos.z - sh * off * side };
  }
}

const C3 = () => [{ x: 0, z: 0, r: 0 }, { x: 0, z: 0, r: 0 }, { x: 0, z: 0, r: 0 }];
const ca = C3(), cb = C3();
export function collideVehicles(list, onHit) {
  for (let i = 0; i < list.length; i++) {
    const A = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const B = list[j];
      const dd = (A.t.length + B.t.length) / 2 + 0.5;
      if (Math.abs(A.pos.x - B.pos.x) > dd || Math.abs(A.pos.z - B.pos.z) > dd) continue;
      if (Math.abs(A.pos.y - B.pos.y) > 2.5) continue;
      A.circles(ca); B.circles(cb);
      for (const p of ca) for (const q of cb) {
        let nx = p.x - q.x, nz = p.z - q.z;
        const d = Math.hypot(nx, nz), R = p.r + q.r;
        if (d >= R || d < 1e-5) continue;
        nx /= d; nz /= d;
        const pen = R - d;
        const ma = A.t.mass, mb = B.t.mass, tot = ma + mb;
        A.pos.x += nx * pen * (mb / tot); A.pos.z += nz * pen * (mb / tot);
        B.pos.x -= nx * pen * (ma / tot); B.pos.z -= nz * pen * (ma / tot);
        const cx = (p.x + q.x) / 2, cz = (p.z + q.z) / 2;
        const rax = cx - A.pos.x, raz = cz - A.pos.z, rbx = cx - B.pos.x, rbz = cz - B.pos.z;
        const vax = A.vel.x + A.yawRate * raz, vaz = A.vel.z - A.yawRate * rax;
        const vbx = B.vel.x + B.yawRate * rbz, vbz = B.vel.z - B.yawRate * rbx;
        const vn = (vax - vbx) * nx + (vaz - vbz) * nz;
        if (vn >= 0) continue;
        const rna = raz * nx - rax * nz, rnb = rbz * nx - rbx * nz;
        const e = clamp(0.35 - -vn * 0.015, 0.08, 0.35);
        const jj = (-(1 + e) * vn) / (1 / ma + 1 / mb + (rna * rna) / A.t.I + (rnb * rnb) / B.t.I);
        // atrito entre as latarias: batida de lado gira os dois carros
        const tx = -nz, tz = nx, vt = (vax - vbx) * tx + (vaz - vbz) * tz, rta = raz * tx - rax * tz, rtb = rbz * tx - rbx * tz;
        const jt = clamp(-vt / (1 / ma + 1 / mb + (rta * rta) / A.t.I + (rtb * rtb) / B.t.I), -0.4 * jj, 0.4 * jj);
        const Jx = jj * nx + jt * tx, Jz = jj * nz + jt * tz;
        A.vel.x += Jx / ma; A.vel.z += Jz / ma; A.yawRate += (rna * jj + rta * jt) / A.t.I;
        B.vel.x -= Jx / mb; B.vel.z -= Jz / mb; B.yawRate -= (rnb * jj + rtb * jt) / B.t.I;
        A.jolt(Jx / ma, Jz / ma); B.jolt(-Jx / mb, -Jz / mb);
        A.sleeping = B.sleeping = false;
        if (-vn > 2) { A.damage(-vn * 0.7, cx, cz, nx, nz); B.damage(-vn * 0.7, cx, cz, -nx, -nz); }
        if (onHit) onHit(A, B, -vn);
      }
    }
  }
}
