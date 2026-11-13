'use strict';
// ===== Modelos 3D detalhados: pessoas e carros =====
function mergeGeo(list) {
  let n = 0;
  const gs = list.map(([g, c]) => { const x = g.index ? g.toNonIndexed() : g; n += x.attributes.position.count; return [x, c]; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), cc = new THREE.Color();
  let o = 0;
  for (const [g, c] of gs) {
    const k = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); cc.set(c);
    for (let i = 0; i < k; i++) { col[(o + i) * 3] = cc.r; col[(o + i) * 3 + 1] = cc.g; col[(o + i) * 3 + 2] = cc.b; }
    o += k; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere(); return out;
}
const gB = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const gS = (r, x, y, z, sx = 1, sy = 1, sz = 1, ws = 10, hs = 8) => new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz).translate(x, y, z);
const gC = (r, len, x, y, z) => new THREE.CapsuleGeometry(r, len, 3, 8).translate(x, y, z);
const gCy = (rt, rb, h, x, y, z, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y, z);

// ---------- Pessoas ----------
const HAIR_COLS = ['#1a1008', '#2a1a10', '#3a2416', '#5a3a20', '#8a6a3a', '#c9a868', '#111111', '#7a2a14', '#8a8a8a'];
function makeLook(p) {
  const L = {
    skin: p.skin, female: Math.random() < 0.45, build: rand(0.92, 1.07), hair: pick(HAIR_COLS), style: randi(0, 4),
    top: pick(['tee', 'tee', 'tee', 'shirt', 'jacket', 'tank', 'hoodie']), topCol: p.shirt, top2: pick(SHIRTS), print: Math.random() < 0.4,
    pants: p.pants, shorts: Math.random() < 0.22, shoes: pick(['#222222', '#eeeeee', '#5a3a20', '#333333', '#aa3333', '#2a4a8a']),
    glasses: Math.random() < 0.15, cap: Math.random() < 0.14 ? pick(SHIRTS) : null, beard: false, skirt: false, bag: Math.random() < 0.2,
  };
  if (!L.female) L.beard = Math.random() < 0.22;
  else { L.style = pick([1, 1, 2, 3, 0]); L.skirt = !L.shorts && Math.random() < 0.3; if (L.top === 'tank' && Math.random() < .5) L.top = 'tee'; }
  if (p.kind === 'cop') Object.assign(L, { top: 'uniform', topCol: '#2b4a8a', pants: '#1a2440', shorts: false, skirt: false, cap: '#14203d', shoes: '#111111', glasses: Math.random() < 0.4, print: false, bag: false });
  if (p.kind === 'gang') Object.assign(L, { top: pick(['tank', 'hoodie', 'tee']), topCol: pick(['#111111', '#2a2a2a', '#3a1010']), pants: '#1a1a1a', bandana: '#b01818', cap: null, shorts: false, skirt: false, print: false, bag: false });
  if (p.jog) Object.assign(L, { top: 'tank', topCol: pick(['#e84a4a', '#3ac8a0', '#f2c21a', '#4a8ae8', '#e86ab0']), shorts: true, skirt: false, pants: '#222222', shoes: '#f4f4f4', headband: true, cap: null, bag: false, print: false });
  if (p.kind === 'vendor') Object.assign(L, { top: 'tee', topCol: '#ffffff', apron: true, cap: '#d23a2a', print: false, bag: false });
  return L;
}
const PED_MAT = () => R3.pedMat || (R3.pedMat = new THREE.MeshLambertMaterial({ vertexColors: true }));
function makePedModel(p) {
  const L = p.look || (p.look = makeLook(p));
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const top = L.topCol, skin = L.skin, hair = L.hair, fem = L.female;
  const cw = fem ? 9.0 : 10.4;
  const P = [];
  P.push([gB(5, 3.6, cw - 1, 0, 16.3, 0), L.pants]);
  P.push([gB(5.4, 1.2, cw - 0.6, 0, 18.2, 0), L.top === 'uniform' ? '#111111' : '#3a2a1a']);
  P.push([gB(4.8, 4.6, cw - (fem ? 2.2 : 1.6), 0, 20.9, 0), top]);
  P.push([gB(5.4, 5.4, cw, 0.1, 25.1, 0), top]);
  for (const s of [-1, 1]) P.push([gS(2.1, 0, 26.6, s * (cw / 2 - 0.5), 1, 0.9, 1), L.top === 'tank' ? skin : top]);
  if (fem) for (const s of [-1, 1]) P.push([gS(1.55, 2.3, 24.2, s * 1.8, 1, 0.9, 1), top]);
  if (L.top === 'tank') P.push([gB(0.3, 2.2, 3.2, 2.85, 26.4, 0), skin]);
  if (L.top === 'jacket') { P.push([gB(0.4, 9, 3, 2.85, 22.9, 0), L.top2], [gB(3, 1, cw * 0.62, 0.6, 27.9, 0), top]); }
  if (L.top === 'hoodie') { P.push([gB(3, 3.2, 6.4, -2.5, 28.1, 0), top], [gB(0.3, 2.6, 5.4, 2.85, 20.6, 0), shade(top, 0.8)]); }
  if (L.top === 'shirt') { P.push([gB(0.3, 8.6, 0.5, 2.85, 23, 0), '#dddddd'], [gB(2.4, 1, cw * 0.55, 1.2, 27.9, 0), top]); }
  if (L.top === 'tee' && L.print) P.push([gB(0.3, 2.6, 3.6, 2.85, 24.2, 0), L.top2]);
  if (L.top === 'uniform') { P.push([gB(0.4, 1.4, 1.1, 2.9, 25.6, 2.3), '#e8c547'], [gB(0.3, 6, 1, 2.9, 24, 0), '#101010'], [gB(1.2, 1.6, 1.4, 0, 27.4, 4.6), '#111111'], [gB(1.6, 3, 2, 0, 16.6, 5.4), '#111111']); }
  if (L.apron) P.push([gB(0.4, 10, cw - 2, 2.9, 19.5, 0), '#f4f4f4']);
  if (L.bag) P.push([gB(2.2, 4, 3, -1, 20, -cw / 2 - 1.4), '#5a3a20'], [gB(0.4, 9, 0.6, 0, 24.5, -cw / 2 + 0.6), '#5a3a20']);
  // pescoço e cabeça
  P.push([gCy(1.3, 1.45, 2.6, 0.2, 28.6, 0), skin]);
  P.push([gS(3.3, 0.3, 31.6, 0, 1, 1.15, 0.95, 12, 10), skin]);
  for (const s of [-1, 1]) {
    P.push([gS(0.9, 0, 31.6, s * 3.15, 0.6, 1, 0.6, 6, 5), skin]);
    P.push([gB(0.4, 0.75, 0.95, 3.25, 32.3, s * 1.25), '#f4f4f4'], [gB(0.45, 0.55, 0.45, 3.42, 32.3, s * 1.25), '#1a1410']);
    P.push([gB(0.5, 0.45, 1.5, 3.3, 33.25, s * 1.25), hair]);
  }
  P.push([gB(1.3, 1.5, 0.9, 3.55, 31.3, 0), skin], [gB(0.4, 0.35, 1.7, 3.35, 29.95, 0), '#7a3a30']);
  if (L.beard) P.push([gB(2.6, 2.4, 6.2, 1.7, 29.9, 0), hair]);
  const st = L.style;
  if (!L.cap || st === 1) {
    if (st === 0 || st === 1 || st === 2) P.push([gS(3.45, 0, 33.0, 0, 1, 0.82, 1.02, 10, 7), hair], [gB(2.6, 4, 6.4, -2, 31.3, 0), hair]);
    if (st === 1) P.push([gB(2.4, 9, 6.8, -2.3, 28.9, 0), hair], [gB(3.6, 6, 0.8, 0.2, 30.4, 3.35), hair], [gB(3.6, 6, 0.8, 0.2, 30.4, -3.35), hair]);
    if (st === 2) P.push([gC(1.0, 4, -3.9, 29.2, 0), hair]);
    if (st === 3) P.push([gS(4.2, -0.4, 33.1, 0, 1, 0.85, 1.05, 8, 6), hair]);
    if (st === 4) P.push([gS(3.38, 0.2, 32.5, 0, 1, 0.82, 1, 10, 7), hair]);
  }
  if (L.cap) {
    if (p.kind === 'cop') P.push([gCy(3.8, 3.5, 2.4, 0, 34.5, 0, 12), L.cap], [gB(3.2, 0.5, 6.4, 3.2, 33.6, 0), '#0a0a0a'], [gB(0.3, 1, 1, 3.8, 34.6, 0), '#e8c547']);
    else P.push([gS(3.6, 0, 33.5, 0, 1, 0.55, 1, 10, 6), L.cap], [gB(4, 0.5, 5.6, 3.4, 33.1, 0), L.cap]);
  }
  if (L.glasses) P.push([gB(0.5, 1.1, 5.4, 3.65, 32.3, 0), '#111111']);
  if (L.headband) P.push([gCy(3.5, 3.5, 1.0, 0.3, 33.5, 0, 12), '#ffffff']);
  if (L.bandana) P.push([gCy(3.55, 3.55, 1.4, 0.3, 33.6, 0, 12), L.bandana], [gB(1.5, 1.4, 1.5, -3.8, 33.2, 0), L.bandana]);
  if (L.skirt) P.push([gCy(4.6, 6.4, 5.8, 0, 13.6, 0, 12), L.top2]);
  const torso = new THREE.Mesh(mergeGeo(P), PED_MAT()); torso.castShadow = true; body.add(torso);
  const u = { body, torso };
  const shin = L.shorts || L.skirt ? skin : L.pants;
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0, 15.6, s * 2.3 * cw / 10.4); body.add(hip);
    const tg = L.shorts ? mergeGeo([[gC(2.05, 1.8, 0, -2.4, 0), L.pants], [gC(1.9, 3.2, 0, -5.4, 0), skin]]) : mergeGeo([[gC(2.0, 4.6, 0, -4.3, 0), L.skirt ? skin : L.pants]]);
    const thigh = new THREE.Mesh(tg, PED_MAT()); thigh.castShadow = true; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -8.6; hip.add(knee);
    const sh = new THREE.Mesh(mergeGeo([[gC(1.75, 4.0, 0, -3.6, 0), shin], [gB(5.4, 2.2, 3.2, 1.1, -6.4, 0), L.shoes], [gB(5.7, 0.6, 3.4, 1.1, -7.5, 0), '#151515']]), PED_MAT());
    sh.castShadow = true; knee.add(sh);
    const shoulder = new THREE.Group(); shoulder.position.set(0, 26.7, s * (cw / 2 + 0.7)); body.add(shoulder);
    const longSleeve = ['shirt', 'jacket', 'hoodie'].includes(L.top), sleeve = L.top === 'tank' ? skin : top;
    shoulder.add(new THREE.Mesh(mergeGeo([[gC(1.55, 3.8, 0, -3.1, 0), sleeve]]), PED_MAT()));
    const elbow = new THREE.Group(); elbow.position.y = -6.4; shoulder.add(elbow);
    elbow.add(new THREE.Mesh(mergeGeo([[gC(1.4, 3.4, 0, -2.9, 0), longSleeve ? top : skin], [gS(1.55, 0.2, -6.4, 0, 1, 1.25, 0.85, 8, 6), skin]]), PED_MAT()));
    if (s > 0) {
      u.gun = new THREE.Mesh(mergeGeo([[gB(1.7, 8, 1.4, 0.8, -10, 0), '#1c1c1c'], [gB(1.6, 3, 1.3, -0.4, -6.8, 0), '#2a2a2a']]), PED_MAT());
      elbow.add(u.gun); u.phone = new THREE.Mesh(mergeGeo([[gB(1.8, 3.2, 0.6, 1.1, -7, 0.6), '#111111']]), PED_MAT()); elbow.add(u.phone);
    }
    u[s < 0 ? 'hipL' : 'hipR'] = hip; u[s < 0 ? 'kneeL' : 'kneeR'] = knee; u[s < 0 ? 'shL' : 'shR'] = shoulder; u[s < 0 ? 'elL' : 'elR'] = elbow;
  }
  g.scale.setScalar(0.76 * L.build);
  g.userData = u; u.px = p.x; u.py = p.y; u.mv = 0;
  return g;
}
function disposeModel(m) { m.traverse(o => { if (o.geometry && !o.geometry.shared) o.geometry.dispose(); }); }
function animPed(p, m, dt) {
  const u = m.userData, t = G.t + p.id;
  m.position.set(p.x, 0, p.y); m.rotation.y = -p.a;
  const inst = Math.hypot(p.x - u.px, p.y - u.py) / Math.max(dt, 1e-3); u.px = p.x; u.py = p.y;
  u.mv = lerp(u.mv, Math.min(inst, 260), 1 - Math.exp(-10 * dt));
  const B = u.body;
  B.rotation.set(0, 0, 0); B.position.set(0, 0, 0);
  u.shL.rotation.set(0.1, 0, 0); u.shR.rotation.set(-0.1, 0, 0); u.hipL.rotation.set(0, 0, 0); u.hipR.rotation.set(0, 0, 0);
  u.gun.visible = p.weapon > 0; u.phone.visible = false;
  if (p.hp <= 0) {
    B.rotation.z = Math.PI / 2; B.position.set(-1, 3, 0);
    u.shL.rotation.set(1.3, 0, 0.3); u.shR.rotation.set(-1.3, 0, 0.3); u.elL.rotation.z = u.elR.rotation.z = 0.3;
    u.hipL.rotation.set(0.15, 0, 0.1); u.hipR.rotation.set(-0.15, 0, 0); u.kneeL.rotation.z = -0.4; u.kneeR.rotation.z = 0;
    u.gun.visible = false; return;
  }
  const mv = u.mv, run = mv > 100, A = clamp(mv / 70, 0, 1) * (run ? 0.95 : 0.6), w = p.walk;
  const sL = Math.sin(w), sR = Math.sin(w + Math.PI);
  u.hipL.rotation.z = sL * A; u.hipR.rotation.z = sR * A;
  u.kneeL.rotation.z = -Math.max(0, Math.cos(w)) * A * 1.5 - 0.05; u.kneeR.rotation.z = -Math.max(0, Math.cos(w + Math.PI)) * A * 1.5 - 0.05;
  u.shL.rotation.z = -sL * A * 0.9; u.shR.rotation.z = -sR * A * 0.9;
  u.elL.rotation.z = u.elR.rotation.z = 0.15 + A * (run ? 1.3 : 0.35);
  B.rotation.z = run ? -0.16 : -A * 0.04;
  B.position.y = Math.abs(Math.cos(w)) * A * (run ? 1.6 : 0.6);
  if (A < 0.05) { B.position.y = Math.sin(t * 2) * 0.12; u.shL.rotation.z = Math.sin(t * 1.3) * 0.03; u.shR.rotation.z = -Math.sin(t * 1.3) * 0.03; }
  const an = p.anim;
  if (an === 'phone') { u.shR.rotation.set(0.35, 0, 0.55); u.elR.rotation.z = 2.45; u.phone.visible = true; }
  else if (an === 'talk') { u.shR.rotation.set(-0.15, 0, 0.45 + Math.sin(t * 3) * 0.25); u.elR.rotation.z = 1.1 + Math.sin(t * 4.3) * 0.35; u.shL.rotation.set(0.15, 0, 0.25 + Math.sin(t * 2.6 + 1) * 0.2); u.elL.rotation.z = 0.9; B.rotation.y = Math.sin(t * 0.7) * 0.1; }
  else if (an === 'sit') { u.hipL.rotation.z = u.hipR.rotation.z = 1.5; u.kneeL.rotation.z = u.kneeR.rotation.z = -1.5; B.position.y = -5.4; u.shL.rotation.z = u.shR.rotation.z = 0.35; u.elL.rotation.z = u.elR.rotation.z = 0.9; u.hipL.rotation.x = 0.12; u.hipR.rotation.x = -0.12; }
  else if (an === 'handsup') { u.shL.rotation.set(0.25, 0, 2.9); u.shR.rotation.set(-0.25, 0, 2.9); u.elL.rotation.z = u.elR.rotation.z = 0.5; }
  else if (an === 'wave') { u.shR.rotation.set(-0.3, 0, 2.6); u.elR.rotation.z = 0.6 + Math.sin(t * 9) * 0.45; }
  else if (an === 'dance') { const d = Math.sin(t * 7); B.position.y = Math.abs(d) * 1.2; B.rotation.y = Math.sin(t * 3.5) * 0.4; u.shL.rotation.set(0.3, 0, 2.2 + d * 0.5); u.shR.rotation.set(-0.3, 0, 2.2 - d * 0.5); u.elL.rotation.z = u.elR.rotation.z = 0.8; u.hipL.rotation.z = d * 0.25; u.hipR.rotation.z = -d * 0.25; }
  else if (an === 'sell') { u.shL.rotation.set(0.1, 0, 0.6); u.elL.rotation.z = 1.4; u.shR.rotation.set(-0.1, 0, 0.5 + Math.max(0, Math.sin(t * 1.5)) * 1.8); u.elR.rotation.z = 0.5; }
  const aiming = p.weapon > 0 && (p === G.player ? (Input.btn.fire || Input.keys[' '] || (aimT && aimT.hp > 0)) : (p.state === 'attack' || (p.state === 'chase' && (p.kind !== 'cop' || G.wanted > 1))));
  if (aiming && an !== 'sit') { u.shR.rotation.set(-0.05, 0, Math.PI / 2); u.elR.rotation.z = 0; u.shL.rotation.set(-0.5, 0, 1.3); u.elL.rotation.z = 0.4; }
  if (p.punchT > 0 && p.weapon === 0) { const k = Math.sin(p.punchT / 0.2 * Math.PI); u.shR.rotation.set(-0.1, 0, 0.6 + k * 1.0); u.elR.rotation.z = 1.6 - k * 1.5; B.rotation.y = -k * 0.3; }
}

// ---------- Carros ----------
const PROF = {
  sedan: h => ({ top: [[h, 3.4], [h + 0.6, 8], [h - 0.8, 11.4], [h - 12, 13.4], [-h + 10.5, 13.6], [-h + 1.2, 12.8], [-h - 0.4, 8.5], [-h, 3.4]], cab: [[h - 12.5, 13.2], [h - 20.5, 21], [-h + 15, 21.2], [-h + 10.5, 13.4]], arch: h - 10.5, ar: 5.6 }),
  sport: h => ({ top: [[h, 3], [h + 0.8, 6.2], [h - 1.5, 9.2], [h - 15, 11.2], [-h + 9, 11.8], [-h + 0.6, 11.4], [-h - 0.3, 7], [-h, 3]], cab: [[h - 15.5, 11], [h - 24, 18.2], [-h + 16, 18.4], [-h + 8.5, 11.6]], arch: h - 10, ar: 5.8 }),
  van: h => ({ top: [[h, 3.6], [h + 0.4, 10], [h - 1.8, 14.6], [h - 8.5, 26], [-h + 1, 27.2], [-h - 0.4, 25.6], [-h - 0.4, 6], [-h, 3.6]], cab: [[h - 1.4, 15], [h - 7.7, 25.6], [h - 13, 25.6], [h - 13, 15]], arch: h - 11, ar: 5.8, van: true }),
};
const CARM = {};
function paintMat(c) { return CARM[c] || (CARM[c] = new THREE.MeshPhongMaterial({ color: new THREE.Color(c), shininess: 80, specular: 0x666666 })); }
function carGlass() { return CARM._g || (CARM._g = new THREE.MeshPhongMaterial({ color: 0x18222e, shininess: 140, specular: 0xcccccc })); }
function carTrim() { return CARM._t || (CARM._t = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 40, specular: 0x333333 })); }
function textTex(t, bg, fg, w = 256, h = 64) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.fillStyle = fg; g.font = `900 ${h * 0.62}px "Arial Black", Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, h / 2 + 2);
  return new THREE.CanvasTexture(c);
}
const CAR_GEO = {};
function carGeos(type, L, W) {
  const key = type + L + W; if (CAR_GEO[key]) return CAR_GEO[key];
  const h = L / 2, P = (PROF[type] || PROF.sedan)(h);
  const s = new THREE.Shape(), t = P.top;
  s.moveTo(t[0][0], t[0][1]); for (let i = 1; i < t.length; i++) s.lineTo(t[i][0], t[i][1]);
  s.lineTo(-P.arch - P.ar, 3.4); s.absarc(-P.arch, 3.4, P.ar, Math.PI, 0, true);
  s.lineTo(P.arch - P.ar, 3.4); s.absarc(P.arch, 3.4, P.ar, Math.PI, 0, true); s.lineTo(t[0][0], t[0][1]);
  const ex = (shape, d, bev = 1) => new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 2, curveSegments: 6 }).translate(0, 0, -d / 2);
  const shp = pts => { const q = new THREE.Shape(); q.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) q.lineTo(p[0], p[1]); return q; };
  const c = P.cab, gw = W - 2.4;
  const paint = [[ex(s, W - 2), '#fff']];
  const glass = ex(shp(P.van ? c.map(([x, y], i) => [i < 2 ? x + 0.5 : x, y]) : c), P.van ? W - 1.2 : gw - 2, 0.8);
  if (!P.van) {
    paint.push([ex(shp([[c[1][0] + 0.4, c[1][1] - 0.4], [c[2][0] - 0.4, c[2][1] - 0.4], [c[2][0] - 0.8, c[2][1] + 1.0], [c[1][0] - 0.6, c[1][1] + 1.0]]), gw - 1.6, 0.6), '#fff']);
    const pillar = (a, b, z) => { const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy); return new THREE.BoxGeometry(len, 1.3, 1.1).rotateZ(Math.atan2(dy, dx)).translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z); };
    const bx = (c[0][0] + c[3][0]) / 2 - 1;
    for (const zs of [-1, 1]) {
      const z = zs * (gw / 2 - 0.1);
      paint.push([pillar(c[0], c[1], z), '#fff'], [pillar(c[3], c[2], z), '#fff'], [new THREE.BoxGeometry(1.6, c[1][1] - c[0][1], 1.1).translate(bx, (c[0][1] + c[1][1]) / 2, z), '#fff']);
    }
  } else {
    paint.push([gB(1.4, 10, W - 0.4, h - 13.2, 20.5, 0), '#fff']);
  }
  for (const zs of [-1, 1]) paint.push([gB(2.2, 1.6, 2.2, c[0][0] - 1, c[0][1] + 1.2, zs * (W / 2 + 1.1)), '#fff']);
  // acabamentos: para-choques, grade, placas, frisos, escapamento
  const T = [
    [gB(2.4, 3.2, W + 0.6, h + 0.2, 5.2, 0), '#26282c'], [gB(2.4, 3.2, W + 0.6, -h - 0.2, 5.2, 0), '#26282c'],
    [gB(0.8, P.van ? 4 : 2.8, W * 0.52, h + 0.9, P.van ? 9 : 8.3, 0), '#111214'],
    [gB(0.4, 2.2, 6.4, h + 1.5, 5.4, 0), '#f2f2f2'], [gB(0.4, 2.2, 6.4, -h - 1.5, 5.4, 0), '#f2f2f2'],
    [gB(L * 0.52, 1.1, W + 0.3, 0, 4.4, 0), '#1c1d20'],
    [new THREE.CylinderGeometry(0.8, 0.8, 3, 8).rotateZ(Math.PI / 2).translate(-h - 0.9, 4.2, W / 2 - 5), '#777777'],
  ];
  if (!P.van) for (const x of [h - 12.6, -1.2]) T.push([gB(0.3, 7.6, W + 0.15, x, 8.8, 0), '#1a1a1a']);
  for (const zs of [-1, 1]) T.push([gB(2.2, 0.6, 0.5, -3, 12, zs * (W / 2 + 0.2)), '#bbbbbb']);
  if (type === 'sport') T.push([gB(4, 0.7, W - 2, -h + 2.4, 14.6, 0), '#151515'], [gB(1, 2.6, 1, -h + 2.4, 12.6, W / 2 - 4), '#151515'], [gB(1, 2.6, 1, -h + 2.4, 12.6, -W / 2 + 4), '#151515']);
  const lights = {
    head: mergeGeo([-1, 1].map(zs => [gB(0.8, 2.2, 4.6, h + 0.25, P.van ? 11 : 10.2, zs * (W / 2 - 3.6)), '#fff'])),
    tail: mergeGeo([-1, 1].map(zs => [gB(0.8, 2.4, 4.2, -h - 0.25, P.van ? 13 : 10.4, zs * (W / 2 - 3.4)), '#fff'])),
    rev: mergeGeo([-1, 1].map(zs => [gB(0.8, 1.3, 1.5, -h - 0.25, P.van ? 10 : 8.4, zs * (W / 2 - 6.6)), '#fff'])),
    bl: mergeGeo([[gB(1, 1.4, 1.6, h, 8.2, -(W / 2 - 0.9)), '#fff'], [gB(1, 1.4, 1.6, -h, 8.6, -(W / 2 - 0.9)), '#fff']]),
    br: mergeGeo([[gB(1, 1.4, 1.6, h, 8.2, (W / 2 - 0.9)), '#fff'], [gB(1, 1.4, 1.6, -h, 8.6, (W / 2 - 0.9)), '#fff']]),
  };
  const wheel = mergeGeo([
    [gCy(4.6, 4.6, 3.4, 0, 0, 0, 16).rotateX(Math.PI / 2), '#141414'], [gCy(3.0, 3.0, 3.6, 0, 0, 0, 12).rotateX(Math.PI / 2), '#b8bcc4'],
    [gB(5.4, 0.9, 3.7, 0, 0, 0), '#8a8e96'], [gB(0.9, 5.4, 3.7, 0, 0, 0), '#8a8e96'], [gCy(0.9, 0.9, 3.9, 0, 0, 0, 8).rotateX(Math.PI / 2), '#555555'],
  ]);
  return (CAR_GEO[key] = { paint: mergeGeo(paint), glass, trim: mergeGeo(T), lights, wheel, P, h });
}
function makeCarModel(c) {
  const L = c.L, W = c.W, G0 = carGeos(c.type === 'taxi' || c.type === 'police' ? 'sedan' : c.type, L, W), P = G0.P, h = G0.h;
  const g = new THREE.Group(), ch = new THREE.Group(); g.add(ch);
  const paint = new THREE.Mesh(G0.paint, paintMat(c.col)); paint.castShadow = true; paint.receiveShadow = true; ch.add(paint);
  const glass = new THREE.Mesh(G0.glass, carGlass()); glass.castShadow = true; ch.add(glass);
  ch.add(new THREE.Mesh(G0.trim, carTrim()));
  const M = {
    head: new THREE.MeshBasicMaterial({ color: 0xbdb9a8 }), tail: new THREE.MeshBasicMaterial({ color: 0x6a0c0c }),
    rev: new THREE.MeshBasicMaterial({ color: 0x8a8a8a }), bl: new THREE.MeshBasicMaterial({ color: 0x6a4208 }), br: new THREE.MeshBasicMaterial({ color: 0x6a4208 }),
  };
  for (const k in M) ch.add(new THREE.Mesh(G0.lights[k], M[k]));
  if (c.type === 'police') {
    const blk = new THREE.Mesh(mergeGeo([[gB(12, 1.4, W - 3, h - 6.5, 13.2, 0), '#14161c'], [gB(9, 1.4, W - 3, -h + 5, 13.3, 0), '#14161c'], [gB(1.4, 6, W * 0.8, h + 2.2, 7, 0), '#111111'], [gB(4, 1.6, W * 0.72, -3, 22.9, 0), '#222222']]), carTrim());
    ch.add(blk);
    M.lbR = new THREE.MeshBasicMaterial({ color: 0x551111 }); M.lbB = new THREE.MeshBasicMaterial({ color: 0x112255 });
    const r = new THREE.Mesh(GEO.box, M.lbR); r.scale.set(3.4, 1.8, W * 0.32); r.position.set(-3, 24.4, -W * 0.18); ch.add(r);
    const b = new THREE.Mesh(GEO.box, M.lbB); b.scale.set(3.4, 1.8, W * 0.32); b.position.set(-3, 24.4, W * 0.18); ch.add(b);
    const tex = R3.policeTex || (R3.policeTex = textTex('POLÍCIA', null, '#1a2a6a'));
    for (const zs of [-1, 1]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(22, 5.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); d.position.set(-1, 8.6, zs * (W / 2 + 0.25)); if (zs < 0) d.rotation.y = Math.PI; ch.add(d); }
  }
  if (c.type === 'taxi') {
    const tex = R3.taxiTex || (R3.taxiTex = textTex('TÁXI', '#f2c21a', '#111', 128, 48));
    const sign = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.4, 11), [mat('#f2c21a'), mat('#f2c21a'), mat('#f2c21a'), mat('#f2c21a'), new THREE.MeshBasicMaterial({ map: tex }), new THREE.MeshBasicMaterial({ map: tex })]);
    sign.position.set(-3, 24.4, 0); ch.add(sign);
    const ck = new THREE.Mesh(mergeGeo([-1, 1].map(zs => [gB(16, 1.2, 0.3, -2, 9, zs * (W / 2 + 0.15)), '#111111'])), carTrim()); ch.add(ck);
  }
  if (c.type === 'van') {
    const st = new THREE.Mesh(mergeGeo([-1, 1].map(zs => [gB(L * 0.6, 2.4, 0.3, -4, 14, zs * (W / 2 + 0.2)), pick(['#d23a2a', '#2a6ad2', '#2aa25a', '#f2a21a'])])), carTrim()); ch.add(st);
  }
  // motorista
  const drv = new THREE.Group();
  drv.add(new THREE.Mesh(mergeGeo([[gB(4.2, 6.5, 6.4, 0, 0, 0), '#fff']]), mat('#888888')));
  const head = new THREE.Mesh(mergeGeo([[gS(2.4, 0.3, 5.4, 0, 1, 1.12, 0.95, 10, 8), '#fff']]), mat('#c08a62')); drv.add(head);
  drv.position.set(P.van ? h - 16 : -2.5, P.van ? 17 : 14.5, -W * 0.2); ch.add(drv);
  // rodas
  const wheels = [];
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    const piv = new THREE.Group(), spin = new THREE.Mesh(G0.wheel, carTrim());
    spin.castShadow = true; piv.position.set(sx * P.arch, 4.6, sz * (W / 2 - 1.6)); piv.add(spin); g.add(piv);
    wheels.push({ piv, spin, front: sx > 0 });
  }
  // luz dos faróis no chão (noite)
  const pool = new THREE.Mesh(R3.poolGeo, R3.poolMat); pool.position.set(h + 62, 0.45, 0); pool.visible = false; g.add(pool);
  g.userData = { ch, paint, glass, M, wheels, pool, drv, drvBody: drv.children[0], drvHead: head, col: c.col, wreck: false, pa: c.a, ps: 0, roll: 0, pitch: 0, drvId: -1 };
  return g;
}
function updCarModel(c, m, dt, dk) {
  const u = m.userData, pl = G.player;
  m.position.set(c.x, 0, c.y); m.rotation.y = -c.a;
  const spd = c.ai ? c.spd : (c.fwd || 0);
  const yawRate = angN(c.a - u.pa) / Math.max(dt, 1e-3); u.pa = c.a;
  const acc = (spd - u.ps) / Math.max(dt, 1e-3); u.ps = spd;
  u.roll = lerp(u.roll, clamp(yawRate * spd * 0.00022, -0.075, 0.075), 1 - Math.exp(-6 * dt));
  u.pitch = lerp(u.pitch, clamp(acc * 0.00011, -0.05, 0.05), 1 - Math.exp(-5 * dt));
  u.ch.rotation.set(u.roll, 0, u.pitch); u.ch.position.y = (c.hp < 30 ? -0.6 : 0) + Math.sin(G.t * 30 + c.id) * (c.driver && !c.wreck && Math.abs(spd) < 5 ? 0.08 : 0);
  const steerVis = c === pl.car ? (c.steerVis || 0) : clamp(yawRate * 0.35, -1, 1);
  for (const w of u.wheels) { w.spin.rotation.z -= spd * dt / 4.6; if (w.front) w.piv.rotation.y = -steerVis * 0.42; }
  if (c.wreck && !u.wreck) { u.wreck = true; u.paint.material = paintMat('#2b2724'); u.glass.visible = false; u.drv.visible = false; }
  if (u.col !== c.col && !c.wreck) { u.col = c.col; u.paint.material = paintMat(c.col); }
  const on = c.lights && !c.wreck, M = u.M;
  M.head.color.setHex(on ? 0xfff6d2 : 0xbdb9a8);
  M.tail.color.setHex(c.wreck ? 0x200404 : c.braking ? 0xff2020 : on ? 0xc01414 : 0x6a0c0c);
  M.rev.color.setHex(c.reversing && !c.wreck ? 0xffffff : 0x8a8a8a);
  const bk = Math.floor(G.t * 3) % 2 === 0;
  M.bl.color.setHex((c.blink === 'L' || c.hazard) && bk ? 0xffaa22 : 0x6a4208);
  M.br.color.setHex((c.blink === 'R' || c.hazard) && bk ? 0xffaa22 : 0x6a4208);
  if (M.lbR) { const f = c.siren && Math.floor(G.t * 8) % 2; M.lbR.color.setHex(c.siren ? (f ? 0xff2222 : 0x661111) : 0x551111); M.lbB.color.setHex(c.siren ? (f ? 0x112255 : 0x3399ff) : 0x112255); }
  u.pool.visible = on && dk > 0.15; if (u.pool.visible) u.pool.material.opacity = 0.55 * dk;
  const d = c.driver;
  u.drv.visible = !!d && !c.wreck;
  if (d && u.drvId !== d.id) {
    u.drvId = d.id; const L = d.look || (d.look = makeLook(d));
    u.drvBody.material = mat(L.topCol); u.drvHead.material = mat(L.skin);
  }
}
