// Modelos 3D procedurais: armas, facas, granadas, personagens, braços e ícones.
import * as THREE from '../vendor/three.min.js';
import { skinTexture } from './textures.js';
import { SKINS, GLOVES, GRENADES, NADE_SKINS } from './data.js';

const M = (color, rough = 0.6, metal = 0.3, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const MAT = {
  dark: M(0x1d1f23, 0.55, 0.5), poly: M(0x2a2d31, 0.8, 0.1), steel: M(0x8d949b, 0.3, 0.9), wood: M(0x7a4622, 0.7, 0.05),
  black: M(0x0c0d0f, 0.5, 0.4), glass: M(0x3aa0ff, 0.1, 0.9, { emissive: 0x0a2a55 }), red: M(0xd01818, 0.4, 0.2, { emissive: 0x700000 }),
};
const skinMats = new Map();
export function skinMaterial(skinId, base = 0x3a3e44) {
  const key = skinId + base;
  if (skinMats.has(key)) return skinMats.get(key);
  const t = skinTexture(skinId);
  const rar = SKINS[skinId]?.rarity;
  const fancy = rar === 'lendario' || rar === 'especial';
  const m = t ? M(0xffffff, fancy ? 0.28 : 0.45, fancy ? 0.75 : 0.45, { map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: fancy ? 0.22 : 0.08 })
    : M(base, 0.5, 0.55);
  m.userData.fancy = fancy;
  skinMats.set(key, m); return m;
}

function box(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.x = rx; return m;
}
function cyl(r, len, mat, x = 0, y = 0, z = 0, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m;
}

const SPEC = {
  glock:  { kind: 'pistol', L: 0.19, H: 0.030, grip: 0.105 },
  usp:    { kind: 'pistol', L: 0.20, H: 0.032, grip: 0.105, sup: 0.13 },
  p250:   { kind: 'pistol', L: 0.18, H: 0.034, grip: 0.10 },
  deagle: { kind: 'pistol', L: 0.25, H: 0.046, grip: 0.115, W: 0.036 },
  ak47:   { kind: 'rifle', rec: 0.26, hg: 0.20, hgWood: true, bar: 0.24, stock: 0.26, stockMat: 'wood', mag: [0.20, -0.38, 0.055], gas: true },
  galil:  { kind: 'rifle', rec: 0.26, hg: 0.20, bar: 0.17, stock: 0.24, stockMat: 'dark', skel: true, mag: [0.19, -0.26, 0.05], gas: true },
  m4a4:   { kind: 'rifle', rec: 0.22, hg: 0.21, bar: 0.18, stock: 0.22, stockMat: 'poly', mag: [0.15, -0.1, 0.05], handle: true },
  m4a1s:  { kind: 'rifle', rec: 0.22, hg: 0.21, bar: 0.08, stock: 0.22, stockMat: 'poly', mag: [0.12, -0.1, 0.05], handle: true, sup: 0.2 },
  famas:  { kind: 'rifle', rec: 0.44, hg: 0.12, bar: 0.12, stock: 0, mag: [0.15, 0, 0.05], magZ: 0.12, longHandle: true, recZ: 0.1 },
  awp:    { kind: 'rifle', rec: 0.30, hg: 0.30, bar: 0.44, barR: 0.012, stock: 0.32, stockMat: 'skin', mag: [0.05, 0, 0.08], scope: true, tall: 0.075 },
  mp5:    { kind: 'rifle', rec: 0.22, hg: 0.14, bar: 0.05, stock: 0.2, stockMat: 'poly', skel: true, mag: [0.17, -0.32, 0.04] },
  ump45:  { kind: 'rifle', rec: 0.25, hg: 0.12, bar: 0.05, stock: 0.2, stockMat: 'poly', skel: true, mag: [0.19, 0, 0.045], tall: 0.08 },
  p90:    { kind: 'p90' },
  nova:   { kind: 'nova' },
};

export function buildWeapon(id, skinId = 'padrao') {
  const s = SPEC[id], g = new THREE.Group(), skin = skinMaterial(skinId), u = g.userData;
  u.id = id;
  if (s.kind === 'pistol') {
    const W = s.W || 0.028, L = s.L;
    const slide = box(W, s.H, L, skin, 0, 0.035, -L / 2 + 0.05); g.add(slide); u.slide = slide;
    g.add(box(W * 0.92, 0.02, L * 0.8, MAT.dark, 0, 0.012, -L * 0.4 + 0.05));
    g.add(box(W * 0.95, s.grip, 0.048, MAT.poly, 0, -0.045, 0.035, 0.22));
    g.add(box(0.008, 0.035, 0.05, MAT.dark, 0, -0.012, -0.02));
    g.add(cyl(0.006, 0.02, MAT.steel, 0, 0.035, -L + 0.045));
    g.add(box(0.006, 0.008, 0.008, MAT.black, 0, 0.035 + s.H / 2 + 0.004, -L + 0.07), box(0.014, 0.008, 0.008, MAT.black, 0, 0.035 + s.H / 2 + 0.004, 0.04));
    const mag = box(W * 0.7, s.grip * 0.9, 0.036, MAT.steel, 0, -0.05, 0.036, 0.22); g.add(mag); u.mag = mag;
    u.muzzle = new THREE.Vector3(0, 0.035, -L + 0.04);
    if (s.sup) { g.add(cyl(0.014, s.sup, MAT.black, 0, 0.035, -L + 0.05 - s.sup / 2, 12)); u.muzzle.z -= s.sup; }
    u.hold = 'pistol';
  } else if (s.kind === 'rifle') {
    const H = s.tall || 0.065, rz = s.recZ || 0, rec = box(0.046, H, s.rec, skin, 0, 0.03, -s.rec / 2 + 0.08 + rz); g.add(rec);
    const front = -s.rec + 0.08 + rz;
    g.add(box(0.042, H * 0.8, s.hg, s.hgWood ? MAT.wood : skin, 0, 0.03, front - s.hg / 2));
    const bz = front - s.hg, br = s.barR || 0.009;
    g.add(cyl(br, s.bar, MAT.dark, 0, 0.035, bz - s.bar / 2));
    if (s.gas) g.add(cyl(0.007, s.hg + 0.06, MAT.dark, 0, 0.062, front - s.hg / 2 - 0.02));
    g.add(box(0.006, 0.03, 0.012, MAT.black, 0, 0.06, bz - s.bar * 0.7));
    u.muzzle = new THREE.Vector3(0, 0.035, bz - s.bar);
    if (s.sup) { g.add(cyl(0.017, s.sup, MAT.black, 0, 0.035, bz - s.bar - s.sup / 2 + 0.02, 12)); u.muzzle.z -= s.sup - 0.02; }
    else g.add(cyl(br * 1.5, 0.03, MAT.black, 0, 0.035, bz - s.bar + 0.015));
    g.add(box(0.03, 0.1, 0.04, MAT.poly, 0, -0.045, 0.045, 0.3)); // punho
    g.add(box(0.006, 0.03, 0.06, MAT.dark, 0, -0.012, -0.01));
    if (s.stock) {
      const sm = s.stockMat === 'skin' ? skin : MAT[s.stockMat];
      if (s.skel) { g.add(box(0.02, 0.018, s.stock, sm, 0, 0.045, 0.08 + s.stock / 2), box(0.03, 0.09, 0.025, sm, 0, 0.01, 0.08 + s.stock)); }
      else { g.add(box(0.036, 0.06, s.stock, sm, 0, 0.012, 0.08 + s.stock / 2, -0.08), box(0.038, 0.1, 0.02, MAT.black, 0, 0, 0.08 + s.stock)); }
    }
    const [mh, tilt, md] = s.mag, mz = (s.magZ ?? -0.09) + rz;
    const mag = box(0.026, mh, md, id === 'ak47' ? MAT.steel : MAT.dark, 0, 0.0 - mh / 2, mz + Math.sin(-tilt) * mh * -0.5, tilt); g.add(mag); u.mag = mag;
    if (s.handle) { g.add(box(0.014, 0.012, 0.13, MAT.dark, 0, 0.1, -0.03), box(0.012, 0.035, 0.014, MAT.dark, 0, 0.08, 0.03), box(0.012, 0.035, 0.014, MAT.dark, 0, 0.08, -0.09)); }
    if (s.longHandle) { g.add(box(0.014, 0.012, 0.3, MAT.dark, 0, 0.11, -0.08), box(0.012, 0.045, 0.014, MAT.dark, 0, 0.085, 0.06), box(0.012, 0.045, 0.014, MAT.dark, 0, 0.085, -0.22)); }
    if (s.scope) {
      g.add(cyl(0.022, 0.3, MAT.black, 0, 0.105, -0.1, 14), cyl(0.03, 0.05, MAT.black, 0, 0.105, -0.26, 14), cyl(0.027, 0.04, MAT.black, 0, 0.105, 0.06, 14));
      g.add(cyl(0.026, 0.004, MAT.glass, 0, 0.105, -0.287, 14), box(0.012, 0.03, 0.02, MAT.dark, 0, 0.075, -0.16), box(0.012, 0.03, 0.02, MAT.dark, 0, 0.075, -0.02));
      g.add(box(0.008, 0.008, 0.05, MAT.steel, 0.035, 0.045, 0.02)); // ferrolho
    } else if (!s.handle && !s.longHandle) g.add(box(0.012, 0.022, 0.012, MAT.black, 0, 0.073, 0.05));
    u.hold = 'rifle';
  } else if (s.kind === 'p90') {
    g.add(box(0.05, 0.11, 0.36, skin, 0, 0.01, -0.02), box(0.046, 0.06, 0.14, skin, 0, 0.03, -0.26));
    g.add(box(0.03, 0.09, 0.03, MAT.poly, 0, -0.06, 0.0, 0.3), box(0.03, 0.08, 0.03, MAT.poly, 0, -0.06, -0.12, -0.2));
    const mag = box(0.04, 0.022, 0.27, M(0x4a4033, 0.4, 0.1, { transparent: true, opacity: 0.85 }), 0, 0.078, -0.06); g.add(mag); u.mag = mag;
    g.add(cyl(0.009, 0.06, MAT.dark, 0, 0.03, -0.35), box(0.02, 0.03, 0.1, MAT.dark, 0, 0.105, -0.16));
    u.muzzle = new THREE.Vector3(0, 0.03, -0.38); u.hold = 'rifle';
  } else { // nova
    g.add(box(0.045, 0.06, 0.24, skin, 0, 0.03, -0.04));
    g.add(cyl(0.013, 0.5, MAT.dark, 0, 0.045, -0.4), cyl(0.012, 0.42, MAT.dark, 0, 0.015, -0.36));
    const pump = box(0.044, 0.045, 0.16, MAT.poly, 0, 0.018, -0.3); g.add(pump); u.mag = pump; u.pump = true;
    g.add(box(0.036, 0.07, 0.3, skin, 0, 0.0, 0.2, -0.14), box(0.038, 0.1, 0.02, MAT.black, 0, -0.02, 0.35));
    g.add(box(0.03, 0.09, 0.04, MAT.poly, 0, -0.04, 0.05, 0.35));
    u.muzzle = new THREE.Vector3(0, 0.045, -0.65); u.hold = 'rifle';
  }
  u.skinMat = skin;
  return g;
}

// ---------- Facas ----------
function extrude(pts, depth, mat, holes) {
  const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: depth * 0.45, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 6 });
  geo.translate(0, 0, -depth / 2);
  geo.computeBoundingBox();
  const bb = geo.boundingBox, uv = geo.attributes.uv, pos = geo.attributes.position, sx = bb.max.x - bb.min.x;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - bb.min.x) / sx, (pos.getY(i) - bb.min.y) / sx + 0.3);
  return new THREE.Mesh(geo, mat);
}
const arc = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });

export function buildKnife(type = 'padrao', skinId = 'padrao') {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const blade = skinId === 'padrao' ? M(0xc9d1d8, 0.2, 0.95) : skinMaterial(skinId);
  const handle = MAT.poly, T = 0.005;
  const add = (pts, mat, d = T) => { const m = extrude(pts, d, mat); inner.add(m); return m; };
  if (type === 'karambit') {
    const outer = arc(0.0, -0.085, 0.115, 1.75, 0.05, 12), innerA = arc(0.0, -0.085, 0.082, 0.3, 1.75, 10);
    add([...outer, ...innerA], blade);
    add([[-0.02, 0.03], [-0.02, -0.002], [-0.115, -0.03], [-0.12, 0.0]], handle, 0.014);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 16), MAT.steel); ring.position.set(-0.135, -0.02, 0); inner.add(ring);
  } else if (type === 'butterfly') {
    add([[0, 0.012], [0.12, 0.012], [0.165, 0], [0.12, -0.012], [0, -0.012]], blade);
    const h1 = add([[0, 0.014], [0, 0.002], [-0.13, 0.002], [-0.13, 0.014]], MAT.steel, 0.012); h1.rotation.z = -0.22;
    const h2 = add([[0, -0.002], [0, -0.014], [-0.13, -0.014], [-0.13, -0.002]], MAT.steel, 0.012); h2.rotation.z = 0.22;
    for (const h of [h1, h2]) for (let i = 0; i < 3; i++) { const hole = box(0.02, 0.005, 0.014, MAT.black, -0.03 - i * 0.035, h === h1 ? 0.008 : -0.008, 0); h.add(hole); }
    g.userData.flipParts = [h1, h2];
  } else if (type === 'gut') {
    add([[0, 0.016], [0.1, 0.018], [0.118, 0.03], [0.128, 0.022], [0.118, 0.012], [0.135, 0.004], [0.11, -0.014], [0.03, -0.016], [0, -0.012]], blade);
    add([[0, 0.014], [0, -0.014], [-0.11, -0.016], [-0.115, 0.01]], handle, 0.016);
  } else if (type === 'flip') {
    add([[0, 0.011], [0.09, 0.013], [0.125, 0.004], [0.15, -0.004], [0.11, -0.016], [0.04, -0.014], [0, -0.01]], blade);
    add([[0, 0.012], [0, -0.012], [-0.06, -0.016], [-0.115, -0.008], [-0.118, 0.012]], handle, 0.014);
    inner.add(box(0.012, 0.012, 0.016, MAT.steel, -0.005, 0, 0));
  } else {
    const big = type === 'm9', L = big ? 0.19 : type === 'bayonet' ? 0.175 : 0.15, Hh = big ? 0.02 : 0.015;
    const pts = [[0, Hh], [L * 0.62, Hh], [L * 0.74, Hh * 0.55], [L, 0], [L * 0.8, -Hh], [0, -Hh]];
    if (big) pts.splice(1, 0, [L * 0.2, Hh], [L * 0.24, Hh * 0.6], [L * 0.28, Hh], [L * 0.34, Hh * 0.6], [L * 0.38, Hh]);
    add(pts, blade);
    add([[0, 0.013], [0, -0.013], [-0.11, -0.015], [-0.115, 0.013]], handle, 0.018);
    inner.add(box(0.012, big ? 0.06 : 0.048, 0.02, MAT.steel, -0.004, 0, 0));
    if (type === 'bayonet' || big) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.004, 6, 12), MAT.steel); ring.position.set(-0.004, 0.032, 0); ring.rotation.y = Math.PI / 2; inner.add(ring); }
    inner.add(box(0.014, 0.03, 0.02, MAT.steel, -0.118, 0, 0));
  }
  inner.rotation.y = Math.PI / 2; // lâmina aponta para -Z
  g.userData.hold = 'knife'; g.userData.skinMat = blade; g.userData.muzzle = new THREE.Vector3(0, 0, -0.15);
  return g;
}

export function buildGrenade(type, nadeSkin = 'padrao') {
  const g = new THREE.Group(), ns = NADE_SKINS[nadeSkin], col = ns?.color ?? GRENADES[type].color;
  const mat = M(col, 0.5, ns?.color ? 0.8 : 0.3, ns?.color ? { emissive: col, emissiveIntensity: 0.25 } : {});
  if (type === 'he') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat); b.scale.y = 1.2; g.add(b); }
  else if (type === 'fire') { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.032, 0.09, 10), mat); g.add(b, box(0.015, 0.03, 0.015, M(0xddd3b0), 0, 0.075, 0)); }
  else { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.1, 10), mat); g.add(b); const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0285, 0.0285, 0.015, 10), M(type === 'flash' ? 0x2b6cff : type === 'smoke' ? 0x2a9d4a : 0xd0a020)); band.position.y = 0.02; g.add(band); }
  g.add(box(0.02, 0.022, 0.02, MAT.steel, 0, 0.058, 0), box(0.006, 0.05, 0.016, MAT.steel, 0.022, 0.035, 0));
  g.userData.hold = 'nade'; g.userData.muzzle = new THREE.Vector3();
  return g;
}

export function buildBomb() {
  const g = new THREE.Group();
  g.add(box(0.26, 0.09, 0.18, M(0x3b3f33, 0.8, 0.1)), box(0.1, 0.02, 0.07, MAT.black, -0.05, 0.05, 0), cyl(0.02, 0.2, M(0x9a2a1a), 0.07, 0.06, 0), cyl(0.02, 0.2, M(0x9a2a1a), 0.07, 0.06, 0.045));
  const led = box(0.02, 0.012, 0.02, MAT.red.clone(), -0.05, 0.065, 0.05); g.add(led); g.userData.led = led;
  g.userData.hold = 'nade'; g.userData.muzzle = new THREE.Vector3();
  return g;
}

// ---------- Braços (1ª pessoa) ----------
export function buildArms(gloveId = 'padrao', team = 'CT') {
  const g = new THREE.Group(), glove = M(GLOVES[gloveId]?.color ?? 0x1c1f24, 0.7, gloveId === 'ouro' ? 0.7 : 0.1), sleeve = M(team === 'CT' ? 0x24364f : 0x6a5236, 0.9, 0);
  const arm = side => {
    const a = new THREE.Group();
    a.add(box(0.07, 0.07, 0.34, sleeve, 0, 0, 0.2), box(0.062, 0.058, 0.1, glove, 0, 0, 0), box(0.02, 0.03, 0.05, glove, -side * 0.035, 0.005, -0.03));
    return a;
  };
  g.userData.R = arm(1); g.userData.L = arm(-1); g.add(g.userData.R, g.userData.L);
  return g;
}
export function poseArms(arms, hold) {
  const { R, L } = arms.userData;
  L.visible = true;
  if (hold === 'rifle') { R.position.set(0.012, -0.075, 0.07); R.rotation.set(0.25, -0.12, 0.1); L.position.set(-0.03, -0.03, -0.27); L.rotation.set(0.35, -0.75, 0.3); }
  else if (hold === 'pistol') { R.position.set(0.01, -0.07, 0.07); R.rotation.set(0.2, -0.1, 0.1); L.position.set(-0.035, -0.085, 0.06); L.rotation.set(0.25, -0.55, 0.2); }
  else if (hold === 'knife') { R.position.set(0.0, -0.02, 0.1); R.rotation.set(0.1, 0, 0.6); L.visible = false; }
  else { R.position.set(0.0, -0.05, 0.08); R.rotation.set(0.3, -0.1, 0.2); L.visible = false; }
}

// ---------- Personagens ----------
const TEAM_LOOK = {
  T:  { top: 0x7a5a36, vest: 0x40382a, pants: 0x3b382e, head: 0x1b1b1d, skin: 0xc49a76, accent: 0xc0392b, boots: 0x1c1a17 },
  CT: { top: 0x35527c, vest: 0x1d2a3d, pants: 0x2a3a52, head: 0x24324a, skin: 0xd0a888, accent: 0x3a8dff, boots: 0x0f1216 },
};
const charMats = {};
function teamMats(team) {
  if (charMats[team]) return charMats[team];
  const L = TEAM_LOOK[team], o = {};
  for (const k in L) o[k] = new THREE.MeshLambertMaterial({ color: L[k] });
  o.accent = new THREE.MeshLambertMaterial({ color: L.accent, emissive: L.accent, emissiveIntensity: 0.35 });
  return charMats[team] = o;
}
export function buildCharacter(team, weaponId = 'ak47', skinId = 'padrao', detailed = false) {
  const m = teamMats(team), g = new THREE.Group(), u = g.userData;
  const sh = o => { o.traverse(c => { if (c.isMesh) c.castShadow = true; }); return o; };
  const limb = (w, h, d, mat, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); p.add(box(w, h, d, mat, 0, -h / 2, 0)); return p; };
  u.legL = limb(0.17, 0.86, 0.19, m.pants, -0.11, 0.86, 0); u.legR = limb(0.17, 0.86, 0.19, m.pants, 0.11, 0.86, 0);
  for (const l of [u.legL, u.legR]) l.add(box(0.18, 0.14, 0.26, m.boots, 0, -0.8, -0.03));
  const body = new THREE.Group(); u.body = body;
  body.add(box(0.44, 0.6, 0.24, m.top, 0, 1.15, 0), box(0.47, 0.4, 0.28, m.vest, 0, 1.18, 0), box(0.4, 0.1, 0.25, m.boots, 0, 0.88, 0));
  body.add(box(0.12, 0.1, 0.05, m.vest, -0.12, 1.08, -0.155), box(0.12, 0.1, 0.05, m.vest, 0.02, 1.08, -0.155), box(0.1, 0.03, 0.02, m.accent, 0.14, 1.3, -0.145));
  const head = new THREE.Group(); head.position.set(0, 1.47, 0); u.head = head;
  head.add(box(0.2, 0.22, 0.21, m.skin, 0, 0.13, 0));
  if (team === 'CT') { head.add(box(0.25, 0.14, 0.26, m.head, 0, 0.22, 0.005), box(0.22, 0.06, 0.03, m.accent, 0, 0.15, -0.12), box(0.05, 0.1, 0.2, m.head, -0.13, 0.12, 0), box(0.05, 0.1, 0.2, m.head, 0.13, 0.12, 0)); }
  else { head.add(box(0.215, 0.1, 0.225, m.head, 0, 0.2, 0), box(0.215, 0.09, 0.225, m.accent, 0, 0.06, 0), box(0.1, 0.03, 0.01, m.head, 0, 0.14, -0.107)); }
  body.add(head);
  u.armR = limb(0.13, 0.56, 0.14, m.top, 0.29, 1.4, 0); u.armL = limb(0.13, 0.56, 0.14, m.top, -0.29, 1.4, 0);
  for (const a of [u.armR, u.armL]) a.add(box(0.11, 0.1, 0.12, m.boots, 0, -0.56, 0));
  u.armR.rotation.set(-1.25, 0, -0.12); u.armL.rotation.set(-1.3, 0, 0.55);
  const gun = buildWeapon(weaponId, skinId); gun.position.set(0.2, 1.3, -0.42); gun.scale.setScalar(1.25); u.gun = gun;
  body.add(u.armR, u.armL, gun);
  g.add(sh(u.legL), sh(u.legR), sh(body));
  if (detailed) { body.add(box(0.3, 0.34, 0.12, m.vest, 0, 1.2, 0.18), box(0.08, 0.16, 0.08, m.vest, 0.26, 0.82, 0), box(0.5, 0.05, 0.3, m.boots, 0, 0.93, 0)); }
  return g;
}
export function setCharWeapon(ch, weaponId, skinId = 'padrao') {
  const u = ch.userData; if (u.gun.userData.id === weaponId) return;
  u.body.remove(u.gun); const gun = buildWeapon(weaponId, skinId); gun.position.copy(u.gun.position); gun.scale.setScalar(1.25); gun.traverse(c => { if (c.isMesh) c.castShadow = true; }); u.body.add(gun); u.gun = gun;
}

// ---------- Ícones (render 3D -> imagem) ----------
let iconR = null, iconScene = null, iconCam = null;
const icons = new Map();
export function iconFor(key, builder) {
  if (icons.has(key)) return icons.get(key);
  try {
    if (!iconR) {
      iconR = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      iconR.setSize(256, 128, false); iconR.setClearColor(0, 0);
      iconScene = new THREE.Scene(); iconScene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.2));
      const d = new THREE.DirectionalLight(0xffffff, 2.5); d.position.set(2, 3, 4); iconScene.add(d);
      iconCam = new THREE.OrthographicCamera(-1, 1, 0.5, -0.5, 0.01, 10);
    }
    const obj = builder(); obj.rotation.y = -Math.PI / 2; // lateral: cano para a direita
    const holder = new THREE.Group(); holder.add(obj); holder.rotation.x = 0.12; iconScene.add(holder);
    const bb = new THREE.Box3().setFromObject(holder), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
    const half = Math.max(sz.x / 2, sz.y) * 1.12;
    iconCam.left = -half; iconCam.right = half; iconCam.top = half / 2; iconCam.bottom = -half / 2; iconCam.updateProjectionMatrix();
    iconCam.position.set(c.x, c.y, 3); iconCam.lookAt(c.x, c.y, 0);
    iconR.render(iconScene, iconCam);
    const url = iconR.domElement.toDataURL('image/png');
    iconScene.remove(holder);
    icons.set(key, url); return url;
  } catch (e) { icons.set(key, ''); return ''; }
}
export function itemModel(it) { // it: item do catálogo
  if (it.kind === 'w') return buildWeapon(it.base, it.skin);
  if (it.kind === 'k') return buildKnife(it.base, it.skin);
  if (it.kind === 'g') { const a = buildArms(it.skin); poseArms(a, 'nade'); a.userData.R.position.set(0, 0, 0); a.userData.R.rotation.set(0, 0, 0); a.rotation.y = Math.PI; return a; }
  const g = new THREE.Group(); ['he', 'flash', 'smoke'].forEach((t, i) => { const n = buildGrenade(t, it.skin); n.position.z = (i - 1) * 0.09; g.add(n); }); return g;
}
export const weaponIcon = (id, skin = 'padrao') => iconFor(`w:${id}:${skin}`, () => buildWeapon(id, skin));
export const knifeIcon = (id, skin = 'padrao') => iconFor(`k:${id}:${skin}`, () => buildKnife(id, skin));
export const itemIcon = it => iconFor(it.id, () => itemModel(it));
