/* Modelos 3D procedurais, materiais e catálogo de construções */
(function () {
  const C = window.CITY;
  const T = C.tex;
  const M = (C.models = {});
  C.nightMats = [];   // materiais com luz noturna (emissive)
  C.allMats = [];

  // ---------- materiais ----------
  const mcache = {};
  function std(key, opts, night) {
    if (mcache[key]) return mcache[key];
    const m = new THREE.MeshStandardMaterial(opts);
    mcache[key] = m;
    C.allMats.push(m);
    if (night) C.nightMats.push(m);
    return m;
  }
  M.std = std;
  M.facade = (style) => {
    const t = T.facade(style);
    const glass = style.indexOf('glass') === 0;
    return std('fac_' + style, {
      map: t.map, emissiveMap: t.emissive, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0,
      roughness: glass ? 0.12 : 0.88, metalness: glass ? 0.55 : 0.02, envMapIntensity: glass ? 1.4 : 0.6
    }, true);
  };
  M.roof = (kind) => std('roof_' + kind, { map: T.roof(kind), roughness: kind === 'metal' ? 0.5 : 0.95, metalness: kind === 'metal' ? 0.4 : 0, side: THREE.DoubleSide });
  M.color = (hex, rough, metal, extra) => std('col_' + hex + '_' + rough + '_' + metal + (extra ? JSON.stringify(Object.keys(extra)) : ''), Object.assign({ color: hex, roughness: rough == null ? 0.8 : rough, metalness: metal || 0 }, extra || {}));
  M.glow = (hex) => std('glow_' + hex, { color: hex, emissive: new THREE.Color(hex), emissiveIntensity: 0.4, roughness: 0.4 }, true);
  M.lot = (kind) => std('lot_' + kind, { map: T.lot(kind), roughness: 0.95 });

  // ---------- geometrias ----------
  const U = () => C.BAY * 4, V = () => C.FLOOR * 4;
  // caixa com UV em escala de andares/vãos, grupos: 0 = laterais, 1 = topo
  function bx(w, h, d) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    const uv = g.attributes.uv;
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      let u = uv.getX(i), v = uv.getY(i);
      if (f < 2) { u *= d / U(); v *= h / V(); }
      else if (f < 4) { u *= w / 4; v *= d / 4; }
      else { u *= w / U(); v *= h / V(); }
      uv.setXY(i, u, v);
    }
    const idx = g.index.array, ni = [];
    for (const f of [0, 1, 4, 5, 2]) for (let k = 0; k < 6; k++) ni.push(idx[f * 6 + k]);
    g.setIndex(ni);
    g.clearGroups(); g.addGroup(0, 24, 0); g.addGroup(24, 6, 1);
    return g;
  }
  M.bx = bx;

  // telhado de duas águas (cumeeira no eixo X) — grupos: 0 telhas, 1 oitões
  function gable(w, d, hr, over) {
    over = over == null ? 0.15 : over;
    const x0 = -w / 2 - over, x1 = w / 2 + over, z0 = -d / 2 - over, z1 = d / 2 + over;
    const pos = [], uv = [];
    const sl = Math.hypot(d / 2 + over, hr);
    function tri(a, b, c, ua, ub, uc) { pos.push(...a, ...b, ...c); uv.push(...ua, ...ub, ...uc); }
    function quad(a, b, c, d2, lenU) {
      tri(a, b, c, [0, 0], [lenU, 0], [lenU, sl / 2]);
      tri(a, c, d2, [0, 0], [lenU, sl / 2], [0, sl / 2]);
    }
    const L = (x1 - x0) / 2;
    quad([x0, 0, z1], [x1, 0, z1], [x1, hr, 0], [x0, hr, 0], L);
    quad([x1, 0, z0], [x0, 0, z0], [x0, hr, 0], [x1, hr, 0], L);
    const ha = hr * (d / 2) / (d / 2 + over);
    const s = 1 / (C.BAY * 4);
    tri([w / 2, 0, d / 2], [w / 2, 0, -d / 2], [w / 2, ha, 0], [0, 0], [d * s, 0], [d * s / 2, ha * s]);
    tri([-w / 2, 0, -d / 2], [-w / 2, 0, d / 2], [-w / 2, ha, 0], [0, 0], [d * s, 0], [d * s / 2, ha * s]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    g.addGroup(0, 12, 0); g.addGroup(12, 6, 1);
    return g;
  }
  M.gable = gable;

  function cyl(rt, rb, h, seg) { const g = new THREE.CylinderGeometry(rt, rb, h, seg || 16); g.translate(0, h / 2, 0); return g; }
  function plane(w, d) { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); return g; }
  M.cyl = cyl; M.plane = plane;

  const mtx = (x, y, z, ry, sx, sy, sz) => {
    const m = new THREE.Matrix4();
    m.compose(new THREE.Vector3(x || 0, y || 0, z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry || 0, 0)), new THREE.Vector3(sx || 1, sy || 1, sz || 1));
    return m;
  };
  M.mtx = mtx;
  const P = (geo, mat, x, y, z, ry) => ({ geo, mat, m: mtx(x, y, z, ry) });

  // ---------- arquétipos de prédios que crescem nas zonas ----------
  const A = (M.arch = {});
  function def(key, zone, level, lot, parts, h) { A[key] = { key, zone, level, lot, parts, height: h }; }
  const FL = (n) => C.FLOOR * n;
  const side = (s) => [M.facade(s), M.roof('gravel')];

  function buildArchetypes() {
    const gravel = M.roof('gravel');
    const dark = M.color('#2b2f33', 0.6);
    const white = M.color('#e9e7e1', 0.7);
    const awnR = M.color('#b8463a', 0.8), awnG = M.color('#3f7d4f', 0.8), awnB = M.color('#2f5f93', 0.8);
    const tankW = M.color('#d9dcdc', 0.4, 0.5);
    const brickC = M.color('#8a4430', 0.9);
    const poolM = M.color('#3fa4c9', 0.1, 0.1);
    const metalR = M.roof('metal');
    const solarM = std('solarPanel', { map: T.solar(), roughness: 0.2, metalness: 0.6 });

    // ---- Residencial nível 1: casas ----
    def('R1a', 'R', 1, 'lawn', [
      P(bx(2.2, 1.25, 1.8), [M.facade('house'), gravel], 0, 0, -0.4),
      P(gable(2.2, 1.8, 0.85), [M.roof('clay'), M.facade('house')], 0, 1.25, -0.4),
      P(bx(0.24, 0.7, 0.24), [brickC, gravel], 0.6, 1.3, -0.7),
      P(bx(0.95, 0.85, 1.3), [M.facade('house'), gravel], 1.4, 0, -0.1),
      P(bx(0.7, 0.62, 0.04), [M.color('#d8d6d0', 0.6), gravel], 1.4, 0, 0.56)
    ], 2.1);
    def('R1b', 'R', 1, 'lawn', [
      P(bx(2.0, 1.9, 1.7), [M.facade('house2'), gravel], -0.2, 0, -0.4),
      P(gable(1.7, 2.0, 0.8), [M.roof('slate'), M.facade('house2')], -0.2, 1.9, -0.4, Math.PI / 2),
      P(bx(2.0, 0.08, 0.7), [white, gravel], -0.2, 0.95, 0.8),
      P(bx(0.08, 0.95, 0.08), [white, gravel], -1.1, 0, 1.08),
      P(bx(0.08, 0.95, 0.08), [white, gravel], 0.7, 0, 1.08)
    ], 2.7);
    def('R1c', 'R', 1, 'lawn', [
      P(bx(2.4, 1.25, 1.4), [M.facade('house3'), gravel], 0, 0, -0.7),
      P(gable(2.4, 1.4, 0.7), [M.roof('clay'), M.facade('house3')], 0, 1.25, -0.7),
      P(bx(1.1, 1.25, 1.3), [M.facade('house3'), gravel], -0.65, 0, 0.5),
      P(gable(1.3, 1.1, 0.6), [M.roof('clay'), M.facade('house3')], -0.65, 1.25, 0.5, Math.PI / 2)
    ], 2.0);
    def('R1d', 'R', 1, 'lawn', [
      P(bx(2.6, 1.3, 1.8), [M.facade('house4'), gravel], 0, 0, -0.5),
      P(bx(1.6, 1.0, 1.5), [M.facade('house4'), gravel], -0.4, 1.3, -0.6),
      P(bx(1.2, 0.05, 0.8), [poolM, poolM], 0.9, 0.02, 0.9)
    ], 2.3);

    // ---- Residencial nível 2: prédios de apartamentos ----
    def('R2a', 'R', 2, 'lawn', [
      P(bx(3.0, FL(5), 2.6), side('brick'), 0, 0, -0.2),
      P(bx(0.8, 0.5, 0.8), [M.color('#77736c'), gravel], 0.6, FL(5), -0.6)
    ], FL(5) + 0.5);
    def('R2b', 'R', 2, 'plaza', [
      P(bx(3.2, FL(4), 2.8), side('beige'), 0, 0, -0.1),
      P(cyl(0.35, 0.35, 0.7, 12), [tankW, tankW], -0.8, FL(4), -0.6)
    ], FL(4) + 0.7);
    def('R2c', 'R', 2, 'lawn', [
      P(bx(2.8, FL(6), 2.6), side('white'), 0, 0, -0.2),
      P(bx(2.9, 0.1, 2.7), [dark, dark], 0, FL(6), -0.2)
    ], FL(6) + 0.1);
    def('R2d', 'R', 2, 'plaza', [
      P(bx(1.5, FL(5), 3.0), side('house3'), -0.75, 0, 0),
      P(bx(1.5, FL(4), 3.0), side('house2'), 0.78, 0, 0)
    ], FL(5));

    // ---- Residencial nível 3: torres ----
    def('R3a', 'R', 3, 'plaza', [
      P(bx(3.4, 0.9, 3.2), side('concrete'), 0, 0, 0),
      P(bx(2.4, FL(16), 2.4), side('white'), 0, 0.9, 0),
      P(bx(1.4, 0.7, 1.4), [M.color('#8f8d88'), gravel], 0, 0.9 + FL(16), 0)
    ], 0.9 + FL(16) + 0.7);
    def('R3b', 'R', 3, 'plaza', [
      P(bx(2.3, FL(20), 2.3), side('glassGreen'), 0, 0, 0),
      P(bx(1.8, 0.8, 1.8), side('glassGreen'), 0, FL(20), 0)
    ], FL(20) + 0.8);
    def('R3c', 'R', 3, 'lawn', [
      P(bx(2.9, FL(14), 2.1), side('beige'), 0, 0, -0.2),
      P(bx(3.0, 0.15, 2.2), [dark, dark], 0, FL(14), -0.2)
    ], FL(14));

    // ---- Comercial nível 1: lojas ----
    def('C1a', 'C', 1, 'parking', [
      P(bx(3.0, 1.3, 2.2), side('shop'), 0, 0, -0.7),
      P(bx(3.0, 0.08, 0.6), [awnR, awnR], 0, 0.95, 0.68),
      P(bx(1.6, 0.36, 0.06), [std('sign_m', { map: T.sign('MERCADO', '#b8463a') }), dark], 0, 1.35, 0.42)
    ], 1.7);
    def('C1b', 'C', 1, 'plaza', [
      P(bx(2.6, FL(3), 2.6), side('shop'), 0, 0, -0.3),
      P(bx(2.6, 0.08, 0.6), [awnG, awnG], 0, 0.95, 1.2)
    ], FL(3));
    def('C1c', 'C', 1, 'parking', [
      P(bx(2.0, 1.0, 1.6), side('shop'), -0.6, 0, -0.9),
      P(bx(2.8, 0.12, 1.6), [white, M.color('#c33b2e', 0.6)], 0.4, 1.3, 0.7),
      P(bx(0.12, 1.3, 0.12), [white, white], -0.6, 0, 0.7),
      P(bx(0.12, 1.3, 0.12), [white, white], 1.4, 0, 0.7),
      P(bx(0.3, 0.6, 0.3), [M.color('#c33b2e', 0.5), gravel], 0.4, 0, 0.7)
    ], 1.5);
    def('C1d', 'C', 1, 'plaza', [
      P(bx(3.1, FL(2), 2.4), side('shop'), 0, 0, -0.4),
      P(bx(3.1, 0.08, 0.6), [awnB, awnB], 0, 0.95, 1.1),
      P(bx(1.6, 0.36, 0.06), [std('sign_c', { map: T.sign('CAFÉ', '#2f5f93') }), dark], 0, FL(2) + 0.05, 0.82)
    ], FL(2) + 0.4);

    // ---- Comercial nível 2: escritórios ----
    def('C2a', 'C', 2, 'plaza', [
      P(bx(3.0, FL(8), 2.6), side('glassBlue'), 0, 0, -0.2)
    ], FL(8));
    def('C2b', 'C', 2, 'plaza', [
      P(bx(3.2, FL(2), 3.0), side('shop'), 0, 0, 0),
      P(bx(2.6, FL(7), 2.4), side('beige'), 0, FL(2), 0)
    ], FL(9));
    def('C2c', 'C', 2, 'plaza', [
      P(bx(2.6, FL(10), 2.6), side('glassDark'), 0, 0, 0),
      P(bx(0.06, 1.2, 0.06), [dark, dark], 0.8, FL(10), 0.8)
    ], FL(10) + 1.2);

    // ---- Comercial nível 3: arranha-céus ----
    def('C3a', 'C', 3, 'plaza', [
      P(bx(2.8, FL(26), 2.8), side('glassDark'), 0, 0, 0),
      P(bx(2.0, FL(6), 2.0), side('glassDark'), 0, FL(26), 0),
      P(cyl(0.04, 0.07, 2.5, 6), [dark, dark], 0, FL(32), 0)
    ], FL(32) + 2.5);
    def('C3b', 'C', 3, 'plaza', [
      P(bx(3.0, FL(24), 3.0), side('glassBlue'), 0, 0, 0),
      P(new THREE.CylinderGeometry(0.05, 2.1, 2.2, 4).rotateY(Math.PI / 4).translate(0, 1.1, 0), [M.facade('glassBlue'), M.facade('glassBlue')], 0, FL(24), 0)
    ], FL(24) + 2.2);
    def('C3c', 'C', 3, 'plaza', [
      P(bx(3.2, 1.2, 3.2), side('concrete'), 0, 0, 0),
      P(bx(2.5, FL(30), 2.5), side('glassGold'), 0, 1.2, 0),
      P(bx(1.6, 0.6, 1.6), [M.color('#5b4a2a', 0.4, 0.6), gravel], 0, 1.2 + FL(30), 0)
    ], 1.8 + FL(30));

    // ---- Industrial nível 1 ----
    def('I1a', 'I', 1, 'industrial', [
      P(bx(3.2, 1.6, 2.4), [M.facade('industrial'), metalR], 0, 0, -0.5),
      P(cyl(0.16, 0.22, 3.4, 12), [brickC, dark], 1.1, 0, -1.2),
      P(bx(1.2, 0.9, 0.05), [M.color('#5b6066', 0.5, 0.4), gravel], -0.6, 0, 0.72)
    ], 3.4);
    def('I1b', 'I', 1, 'industrial', [
      P(bx(2.2, 1.4, 2.0), [M.facade('industrial'), metalR], -0.7, 0, -0.6),
      P(cyl(0.5, 0.5, 1.6, 16), [tankW, tankW], 1.1, 0, -0.8),
      P(cyl(0.5, 0.5, 1.6, 16), [tankW, tankW], 1.1, 0, 0.5)
    ], 1.6);

    // ---- Industrial nível 2 ----
    def('I2a', 'I', 2, 'industrial', [
      P(bx(3.6, 2.3, 3.0), [M.facade('industrial'), metalR], 0, 0, -0.3),
      P(bx(0.9, 0.5, 0.5), [dark, dark], -1.0, 0, 1.4),
      P(bx(0.9, 0.5, 0.5), [dark, dark], 0.2, 0, 1.4),
      P(cyl(0.2, 0.25, 4.2, 12), [M.color('#d5d2cc', 0.7), dark], 1.4, 0, -1.4)
    ], 4.2);
    def('I2b', 'I', 2, 'industrial', [
      P(cyl(0.55, 0.55, 3.4, 20), [M.color('#c7c9c4', 0.35, 0.5), M.color('#a7a9a4', 0.4, 0.5)], -1.1, 0, -0.9),
      P(cyl(0.55, 0.55, 3.4, 20), [M.color('#c7c9c4', 0.35, 0.5), M.color('#a7a9a4', 0.4, 0.5)], 0.1, 0, -0.9),
      P(bx(3.0, 1.4, 1.2), [M.facade('industrial'), metalR], -0.2, 0, 0.6),
      P(bx(0.4, 3.8, 0.4), [M.color('#6e7378', 0.6, 0.3), gravel], 1.3, 0, -0.9)
    ], 3.8);

    // ---- Industrial nível 3: alta tecnologia ----
    def('I3a', 'I', 3, 'plaza', [
      P(bx(3.3, 1.9, 2.8), side('glassGreen'), 0, 0, -0.2),
      P(new THREE.BoxGeometry(1.2, 0.05, 0.8).rotateX(-0.35).translate(0, 0.3, 0), solarM, -0.8, 1.9, -0.5),
      P(new THREE.BoxGeometry(1.2, 0.05, 0.8).rotateX(-0.35).translate(0, 0.3, 0), solarM, 0.7, 1.9, -0.5),
      P(new THREE.BoxGeometry(1.2, 0.05, 0.8).rotateX(-0.35).translate(0, 0.3, 0), solarM, -0.8, 1.9, 0.5),
      P(new THREE.BoxGeometry(1.2, 0.05, 0.8).rotateX(-0.35).translate(0, 0.3, 0), solarM, 0.7, 1.9, 0.5)
    ], 2.4);
    def('I3b', 'I', 3, 'plaza', [
      P(bx(3.0, FL(4), 2.4), side('hospital'), 0, 0, -0.4),
      P(bx(1.4, FL(2), 1.0), side('glassBlue'), -0.6, 0, 1.2),
      P(bx(0.6, 0.4, 0.6), [M.color('#9aa0a6', 0.5, 0.5), gravel], 0.8, FL(4), -0.6)
    ], FL(4) + 0.4);

    // ---- árvores ----
    const canopyG = new THREE.IcosahedronGeometry(0.62, 1);
    const p = canopyG.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      const n = 1 + (C.hash(Math.round(v.x * 100), Math.round(v.z * 100), Math.round(v.y * 100)) - 0.5) * 0.35;
      p.setXYZ(i, v.x * n, v.y * n * 0.9, v.z * n);
    }
    canopyG.computeVertexNormals();
    canopyG.translate(0, 1.15, 0);
    const trunkG = cyl(0.06, 0.1, 0.8, 7);
    const coneG = new THREE.ConeGeometry(0.5, 1.6, 8); coneG.translate(0, 1.3, 0);
    const trunkM = M.color('#5a4030', 0.95);
    const leafM = std('leaf', { color: 0xffffff, roughness: 0.85, flatShading: true });
    M.tree = { trunkG, canopyG, coneG, trunkM, leafM };
  }

  // ---------- serviços e marcos (grupos não instanciados) ----------
  function mesh(geo, mat, x, y, z, ry) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    if (ry) m.rotation.y = ry;
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function pad(g, w, d, kind) {
    const tex = T.lot(kind).clone(); tex.needsUpdate = true;
    if (kind === 'concrete' || kind === 'gravel' || kind === 'plaza') tex.repeat.set(w / 4, d / 4);
    const m = mesh(plane(w, d), std('lotpad_' + kind + w + 'x' + d, { map: tex, roughness: 0.95 }), 0, 0.025, 0);
    m.castShadow = false;
    g.add(m);
  }
  function smallTree(g, x, z, s) {
    const t = M.tree;
    const tr = mesh(t.trunkG, t.trunkM, x, 0, z); tr.scale.setScalar(s || 1);
    const cn = mesh(t.canopyG, M.color('#4f7a32', 0.85, 0, { flatShading: true }), x, 0, z); cn.scale.setScalar(s || 1);
    g.add(tr, cn);
  }
  function car(color) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.46, 0.2, 1.0).translate(0, 0.16, 0), M.color(color, 0.3, 0.4)));
    g.add(mesh(new THREE.BoxGeometry(0.4, 0.16, 0.55).translate(0, 0.34, -0.05), M.color('#1b232b', 0.15, 0.6)));
    return g;
  }
  M.car = car;

  const SVC = (M.svc = {});
  SVC.prefeitura = () => {
    const g = new THREE.Group();
    pad(g, 8, 8, 'plaza');
    g.add(mesh(bx(6.2, 2.3, 4.0), [M.facade('stone'), M.roof('gravel')], 0, 0, -1.2));
    g.add(mesh(bx(6.6, 0.3, 4.4), [M.color('#d8d1c0', 0.8), M.color('#cfc8b6', 0.8)], 0, 2.3, -1.2));
    for (let i = 0; i < 6; i++) g.add(mesh(cyl(0.14, 0.16, 2.2, 12), M.color('#efe9dc', 0.6), -1.75 + i * 0.7, 0.3, 1.25));
    g.add(mesh(bx(4.2, 0.3, 0.6), [M.color('#e3dccb', 0.7), M.color('#e3dccb', 0.7)], 0, 0, 1.25));
    g.add(mesh(gable(4.2, 1.2, 0.6, 0.05), [M.color('#e3dccb', 0.7), M.color('#d9d2c0', 0.7)], 0, 2.5, 1.0));
    g.add(mesh(cyl(1.1, 1.1, 0.9, 24), [M.facade('stone')], 0, 2.6, -1.2));
    const dome = new THREE.SphereGeometry(1.15, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    g.add(mesh(dome, M.color('#6f9a8a', 0.4, 0.5), 0, 3.5, -1.2));
    g.add(mesh(cyl(0.03, 0.03, 3, 6), M.color('#cccccc', 0.3, 0.8), 2.8, 0, 3.2));
    g.add(mesh(bx(0.9, 0.55, 0.02), [M.color('#1d8a3c', 0.7), M.color('#1d8a3c')], 3.25, 2.4, 3.2));
    g.add(mesh(cyl(0.8, 0.9, 0.3, 24), M.color('#bcb6aa', 0.7), -2.2, 0, 2.6));
    g.add(mesh(cyl(0.65, 0.65, 0.05, 24), M.color('#4aa3c4', 0.1, 0.2), -2.2, 0.27, 2.6));
    smallTree(g, 3.2, -3.4); smallTree(g, -3.2, -3.4); smallTree(g, 3.3, 1.2, 0.8);
    return g;
  };
  SVC.hospital = () => {
    const g = new THREE.Group();
    pad(g, 8, 8, 'concrete');
    g.add(mesh(bx(6.0, FL(6), 3.6), [M.facade('hospital'), M.roof('gravel')], 0, 0, -1.6));
    g.add(mesh(bx(3.0, FL(3), 3.4), [M.facade('hospital'), M.roof('gravel')], -1.4, 0, 1.6));
    g.add(mesh(new THREE.BoxGeometry(1.0, 0.3, 0.06), M.glow('#d0182b'), 1.6, FL(6) - 0.6, 0.23));
    g.add(mesh(new THREE.BoxGeometry(0.3, 1.0, 0.06), M.glow('#d0182b'), 1.6, FL(6) - 0.6, 0.23));
    g.add(mesh(cyl(1.2, 1.2, 0.08, 28), M.color('#4f5a55', 0.8), 0.6, FL(6), -1.6));
    g.add(mesh(new THREE.BoxGeometry(0.12, 0.02, 0.9), M.color('#ffffff'), 0.3, FL(6) + 0.09, -1.6));
    g.add(mesh(new THREE.BoxGeometry(0.12, 0.02, 0.9), M.color('#ffffff'), 0.9, FL(6) + 0.09, -1.6));
    g.add(mesh(new THREE.BoxGeometry(0.6, 0.02, 0.12), M.color('#ffffff'), 0.6, FL(6) + 0.09, -1.6));
    const amb = car('#f4f4f4'); amb.position.set(2.2, 0, 2.4); g.add(amb);
    smallTree(g, 3.3, 3.3, 0.8);
    return g;
  };
  SVC.policia = () => {
    const g = new THREE.Group();
    pad(g, 4, 4, 'concrete');
    g.add(mesh(bx(3.0, FL(3), 2.2), [M.facade('police'), M.roof('gravel')], 0, 0, -0.7));
    g.add(mesh(bx(1.8, 0.4, 0.06), [std('sign_pol', { map: T.sign('POLÍCIA', '#1f4f9a') }), M.color('#1f4f9a')], 0, FL(3) - 0.5, 0.43));
    g.add(mesh(cyl(0.02, 0.03, 1.4, 6), M.color('#888', 0.4, 0.8), 1.1, FL(3), -1.2));
    const c1 = car('#1c2a3a'); c1.position.set(-0.8, 0, 1.2); c1.rotation.y = Math.PI / 2; g.add(c1);
    const c2 = car('#f0f0f0'); c2.position.set(0.8, 0, 1.2); c2.rotation.y = Math.PI / 2; g.add(c2);
    return g;
  };
  SVC.bombeiros = () => {
    const g = new THREE.Group();
    pad(g, 8, 4, 'concrete');
    g.add(mesh(bx(6.4, FL(3), 2.6), [M.facade('fire'), M.roof('gravel')], -0.4, 0, -0.5));
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.BoxGeometry(1.2, 1.1, 0.05).translate(0, 0.55, 0), M.color('#d7d2c8', 0.5, 0.3), -2.4 + i * 1.6, 0, 0.82));
    g.add(mesh(bx(1.0, 3.6, 1.0), [M.facade('fire'), M.roof('gravel')], 2.9, 0, -1.0));
    const tr = new THREE.Group();
    tr.add(mesh(new THREE.BoxGeometry(0.55, 0.42, 1.5).translate(0, 0.28, 0), M.color('#c21f1f', 0.35, 0.3)));
    tr.add(mesh(new THREE.BoxGeometry(0.5, 0.08, 1.3).translate(0, 0.54, 0.05), M.color('#c0c0c0', 0.3, 0.8)));
    tr.position.set(-0.8, 0, 1.4); tr.rotation.y = Math.PI / 2; g.add(tr);
    return g;
  };
  SVC.escola = () => {
    const g = new THREE.Group();
    pad(g, 8, 8, 'plaza');
    g.add(mesh(bx(7.0, FL(3), 2.2), [M.facade('school'), M.roof('gravel')], 0, 0, -2.6));
    g.add(mesh(bx(2.2, FL(3), 4.4), [M.facade('school'), M.roof('gravel')], -2.4, 0, 0.6));
    const f = mesh(plane(4.0, 3.2), std('field', { map: T.field(), roughness: 0.9 }), 1.4, 0.04, 1.2); f.castShadow = false; g.add(f);
    g.add(mesh(cyl(0.03, 0.03, 2.6, 6), M.color('#ccc', 0.3, 0.8), -0.8, 0, 3.4));
    g.add(mesh(bx(0.8, 0.5, 0.02), [M.color('#2b7a3b'), M.color('#2b7a3b')], -0.38, 2.0, 3.4));
    smallTree(g, 3.4, -0.8, 0.8);
    return g;
  };
  SVC.carvao = () => {
    const g = new THREE.Group();
    pad(g, 8, 8, 'industrial');
    g.add(mesh(bx(4.0, 2.6, 2.6), [M.facade('industrial'), M.roof('metal')], -1.6, 0, 1.8));
    const prof = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(1.25 - Math.sin(t * Math.PI) * 0.45 + (t > 0.8 ? 0.05 : 0), t * 4.2)); }
    const tower = new THREE.LatheGeometry(prof, 28);
    const tm = std('coolTower', { color: '#d4d0c8', roughness: 0.85, side: THREE.DoubleSide });
    g.add(mesh(tower, tm, 1.6, 0, -1.6));
    g.add(mesh(tower, tm, -1.6, 0, -1.8));
    const ch = mesh(cyl(0.25, 0.4, 7, 16), M.color('#b23a2a', 0.7), 2.6, 0, 2.4); g.add(ch);
    for (let i = 0; i < 3; i++) g.add(mesh(cyl(0.27 + 0.02 * (2 - i), 0.27 + 0.02 * (2 - i), 0.5, 16), M.color('#f2f2f2', 0.7), 2.6, 4.5 + i * 0.9 - (i * 0.0), 2.4));
    g.userData.smoke = [new THREE.Vector3(1.6, 4.3, -1.6), new THREE.Vector3(-1.6, 4.3, -1.8), new THREE.Vector3(2.6, 7.1, 2.4)];
    return g;
  };
  SVC.solar = () => {
    const g = new THREE.Group();
    pad(g, 8, 8, 'gravel');
    const sm = std('solarPanel', { map: T.solar(), roughness: 0.2, metalness: 0.6 });
    const pg = new THREE.BoxGeometry(1.5, 0.05, 0.9);
    const leg = cyl(0.03, 0.03, 0.5, 5);
    const legM = M.color('#9a9ea2', 0.4, 0.8);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
      const x = -2.6 + c * 1.75, z = -3.0 + r * 1.45;
      const p = mesh(pg, sm, x, 0.55, z); p.rotation.x = -0.45; g.add(p);
      g.add(mesh(leg, legM, x, 0, z + 0.2));
    }
    g.add(mesh(bx(0.8, 0.7, 0.6), [M.color('#d8d8d2', 0.6), M.roof('gravel')], 3.3, 0, 3.4));
    return g;
  };
  SVC.eolica = () => {
    const g = new THREE.Group();
    pad(g, 4, 4, 'lawn');
    const wm = M.color('#f3f3f0', 0.45, 0.1);
    g.add(mesh(cyl(0.12, 0.24, 9.5, 16), wm, 0, 0, 0));
    const head = new THREE.Group(); head.position.set(0, 9.6, 0);
    head.add(mesh(new THREE.BoxGeometry(0.4, 0.4, 1.0), wm, 0, 0, -0.2));
    const rotor = new THREE.Group(); rotor.position.set(0, 0, 0.35);
    rotor.add(mesh(new THREE.SphereGeometry(0.18, 12, 8), wm));
    const blade = new THREE.BoxGeometry(0.22, 4.2, 0.05); blade.translate(0, 2.1, 0);
    for (let i = 0; i < 3; i++) { const b = mesh(blade, wm); b.rotation.z = i * Math.PI * 2 / 3; rotor.add(b); }
    head.add(rotor); g.add(head);
    g.userData.rotor = rotor;
    return g;
  };
  SVC.agua = () => {
    const g = new THREE.Group();
    pad(g, 4, 4, 'concrete');
    const lm = M.color('#7d8790', 0.5, 0.6);
    for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
      const l = mesh(cyl(0.07, 0.09, 4.2, 8), lm, x, 0, z); g.add(l);
    }
    g.add(mesh(cyl(1.3, 1.1, 1.6, 24), M.color('#7fb2d4', 0.35, 0.4), 0, 4.0, 0));
    g.add(mesh(new THREE.ConeGeometry(1.35, 0.6, 24).translate(0, 0.3, 0), M.color('#5d8eb0', 0.4, 0.4), 0, 5.6, 0));
    return g;
  };
  SVC.parque = () => {
    const g = new THREE.Group();
    pad(g, 4, 4, 'park');
    smallTree(g, -1.2, -1.2, 1.1); smallTree(g, 1.3, -1.0, 0.9); smallTree(g, -1.1, 1.3, 0.8); smallTree(g, 1.4, 1.4, 1.0);
    const bench = M.color('#7a5a3a', 0.8);
    g.add(mesh(bx(0.7, 0.2, 0.22), [bench, bench], 0.4, 0, 0.2));
    g.add(mesh(cyl(0.03, 0.03, 1.0, 6), M.color('#333'), -0.4, 0, -0.3));
    g.add(mesh(new THREE.SphereGeometry(0.08, 8, 6), M.glow('#fff1c8'), -0.4, 1.05, -0.3));
    return g;
  };
  SVC.parque_grande = () => {
    const g = new THREE.Group();
    pad(g, 8, 8, 'park');
    const pond = mesh(new THREE.CircleGeometry(1.6, 32).rotateX(-Math.PI / 2), M.color('#3f8fb0', 0.08, 0.2), 1.2, 0.05, 1.0); pond.castShadow = false; g.add(pond);
    const pts = [[-3, -3], [-2, -1.5], [-3.2, 0.5], [-1, -3.2], [2.8, -3], [3.2, -1.4], [-2.8, 3], [0, 3.4], [3.3, 3.2], [-0.8, 0.3]];
    pts.forEach(([x, z], i) => smallTree(g, x, z, 0.8 + (i % 3) * 0.2));
    g.add(mesh(cyl(0.9, 0.9, 0.12, 8), M.color('#e8e2d4', 0.7), -1.5, 0, -0.2));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(mesh(cyl(0.04, 0.04, 1.0, 6), M.color('#fafafa', 0.6), -1.5 + Math.cos(a) * 0.75, 0.12, -0.2 + Math.sin(a) * 0.75)); }
    g.add(mesh(new THREE.ConeGeometry(1.05, 0.6, 8).translate(0, 0.3, 0), M.roof('slate'), -1.5, 1.1, -0.2));
    return g;
  };
  SVC.praca = () => {
    const g = new THREE.Group();
    pad(g, 4, 4, 'plaza');
    g.add(mesh(cyl(0.9, 1.0, 0.3, 24), M.color('#bdb5a6', 0.7), 0, 0, 0));
    const w = mesh(cyl(0.8, 0.8, 0.05, 24), M.color('#5bb2d6', 0.05, 0.3), 0, 0.27, 0); w.castShadow = false; g.add(w);
    g.add(mesh(cyl(0.12, 0.18, 0.9, 12), M.color('#cfc8b8', 0.6), 0, 0.3, 0));
    smallTree(g, -1.4, -1.4, 0.7); smallTree(g, 1.4, 1.4, 0.7); smallTree(g, 1.4, -1.4, 0.7); smallTree(g, -1.4, 1.4, 0.7);
    return g;
  };
  SVC.reciclagem = () => {
    const g = new THREE.Group();
    pad(g, 8, 8, 'industrial');
    g.add(mesh(bx(4.6, 2.4, 3.0), [M.facade('industrial'), M.roof('green')], -1.2, 0, -2.2));
    const cols = ['#2e8b57', '#2f6fb3', '#e0b62d', '#c0392b'];
    for (let i = 0; i < 8; i++) g.add(mesh(bx(0.9, 0.7, 0.6), [M.color(cols[i % 4], 0.6), M.color(cols[i % 4], 0.6)], -2.8 + (i % 4) * 1.15, 0, 1.0 + Math.floor(i / 4) * 0.9));
    g.add(mesh(new THREE.ConeGeometry(0.9, 0.8, 10).translate(0, 0.4, 0), M.color('#6d6a62', 0.95), 2.6, 0, 2.4));
    g.add(mesh(bx(1.6, 0.5, 0.06), [std('sign_rec', { map: T.sign('RECICLA', '#2e8b57') }), M.color('#2e8b57')], -1.2, 1.7, -0.68));
    return g;
  };
  SVC.hub = () => {
    const g = new THREE.Group();
    pad(g, 4, 4, 'plaza');
    g.add(mesh(bx(2.4, 1.6, 1.8), [M.facade('glassGreen'), M.roof('green')], 0, 0, -0.6));
    g.add(mesh(new THREE.BoxGeometry(2.6, 0.05, 1.0), M.glow('#33e0d0'), 0, 1.62, -0.6));
    g.add(mesh(cyl(0.03, 0.05, 3.2, 6), M.color('#cfd6da', 0.3, 0.8), 0.9, 1.6, -1.1));
    g.add(mesh(new THREE.SphereGeometry(0.12, 10, 8), M.glow('#33e0d0'), 0.9, 4.85, -1.1));
    const sm = std('solarPanel', { map: T.solar(), roughness: 0.2, metalness: 0.6 });
    const can = mesh(new THREE.BoxGeometry(2.6, 0.06, 1.0), sm, 0, 1.25, 1.1); can.rotation.x = -0.15; g.add(can);
    for (const x of [-1.1, 1.1]) g.add(mesh(cyl(0.04, 0.04, 1.25, 6), M.color('#cfd6da', 0.3, 0.8), x, 0, 1.1));
    for (const x of [-0.7, 0, 0.7]) { g.add(mesh(bx(0.18, 0.5, 0.14), [M.color('#e8eef0', 0.4), M.color('#e8eef0')], x, 0, 1.5)); }
    return g;
  };
  SVC.torre = () => {
    const g = new THREE.Group();
    pad(g, 4, 4, 'plaza');
    const wm = M.color('#e6e4de', 0.5, 0.2);
    g.add(mesh(cyl(0.35, 0.9, 16, 20), wm, 0, 0, 0));
    g.add(mesh(new THREE.SphereGeometry(1.2, 24, 16), M.facade('glassGold'), 0, 15.2, 0));
    g.add(mesh(cyl(1.35, 1.35, 0.25, 24), wm, 0, 14.6, 0));
    g.add(mesh(cyl(0.12, 0.2, 5, 10), wm, 0, 16.2, 0));
    g.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), M.glow('#ff2a2a'), 0, 21.3, 0));
    return g;
  };
  SVC.estadio = () => {
    const g = new THREE.Group();
    pad(g, 12, 12, 'parking');
    const prof = [new THREE.Vector2(3.4, 0), new THREE.Vector2(5.4, 0), new THREE.Vector2(5.4, 2.4), new THREE.Vector2(5.2, 2.5), new THREE.Vector2(3.4, 0.6)];
    const ring = new THREE.LatheGeometry(prof, 48);
    const st = mesh(ring, std('stands', { color: '#c9ccd2', roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide }), 0, 0, 0); st.scale.set(1, 1, 0.78); g.add(st);
    const roofR = new THREE.LatheGeometry([new THREE.Vector2(4.4, 2.6), new THREE.Vector2(5.6, 2.6)], 48);
    const rr = mesh(roofR, std('standsRoof', { color: '#f2f2f2', roughness: 0.4, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }), 0, 0, 0); rr.scale.set(1, 1, 0.78); g.add(rr);
    const f = mesh(new THREE.CircleGeometry(3.45, 40).rotateX(-Math.PI / 2), std('field2', { map: T.field(), roughness: 0.9 }), 0, 0.06, 0); f.scale.set(1, 1, 0.78); f.castShadow = false; g.add(f);
    for (const [x, z] of [[-5.4, -4.4], [5.4, -4.4], [-5.4, 4.4], [5.4, 4.4]]) {
      g.add(mesh(cyl(0.08, 0.12, 5.5, 8), M.color('#888', 0.4, 0.8), x, 0, z));
      g.add(mesh(new THREE.BoxGeometry(0.9, 0.5, 0.15), M.glow('#fffbe8'), x, 5.6, z));
    }
    return g;
  };
  SVC.corporativo = () => {
    const g = new THREE.Group();
    pad(g, 8, 8, 'plaza');
    g.add(mesh(bx(6.4, 1.6, 6.4), [M.facade('concrete'), M.roof('green')], 0, 0, 0));
    g.add(mesh(bx(4.4, FL(46), 4.4), [M.facade('glassBlue'), M.roof('gravel')], 0, 1.6, 0));
    g.add(mesh(bx(3.4, FL(8), 3.4), [M.facade('glassBlue'), M.roof('gravel')], 0, 1.6 + FL(46), 0));
    g.add(mesh(new THREE.CylinderGeometry(0.05, 1.8, 3.5, 4).rotateY(Math.PI / 4).translate(0, 1.75, 0), M.facade('glassDark'), 0, 1.6 + FL(54), 0));
    g.add(mesh(cyl(0.03, 0.06, 3, 6), M.color('#aaa', 0.3, 0.8), 0, 5.1 + FL(54), 0));
    g.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), M.glow('#ff2a2a'), 0, 8.2 + FL(54), 0));
    return g;
  };
  SVC.shopping = () => {
    const g = new THREE.Group();
    pad(g, 8, 8, 'parking');
    g.add(mesh(bx(6.8, 2.6, 4.2), [M.facade('shop'), M.roof('gravel')], 0, 0, -1.6));
    g.add(mesh(new THREE.SphereGeometry(1.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std('glassDome', { color: '#9fc4dc', roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.8 }), 0, 2.6, -1.6));
    g.add(mesh(bx(3.0, 0.6, 0.08), [std('sign_sh', { map: T.sign('SHOPPING', '#7a2d8f') }), M.color('#7a2d8f')], 0, 2.0, 0.5));
    for (let i = 0; i < 6; i++) { const c = car(['#c33', '#eee', '#335', '#2a6', '#888', '#da3'][i]); c.position.set(-3 + i * 1.1, 0, 3.0); g.add(c); }
    return g;
  };
  // edifícios "diretos" (prédios a construir) usam os arquétipos das zonas

  // ---------- catálogo ----------
  // cat: roads, zones, buildings, services, utilities, environment, landmarks
  const CAT = (C.CATALOG = {
    road:        { name: 'Rua', cat: 'roads', cost: 100, upkeep: 2, desc: 'Arraste para construir ruas. Conecte à rodovia para trazer moradores.' },
    zoneR:       { name: 'Zona Residencial', cat: 'zones', cost: 10, zone: 'R', color: '#3fbf5a', desc: 'Casas e apartamentos crescem aqui.' },
    zoneC:       { name: 'Zona Comercial', cat: 'zones', cost: 10, zone: 'C', color: '#3b8fe0', desc: 'Lojas e escritórios geram empregos.' },
    zoneI:       { name: 'Zona Industrial', cat: 'zones', cost: 10, zone: 'I', color: '#e3b23c', desc: 'Fábricas geram muitos empregos, mas poluem.' },
    dezone:      { name: 'Remover zona', cat: 'zones', cost: 0, desc: 'Remove zoneamento de lotes vazios.' },

    casa:        { name: 'Casa', cat: 'buildings', cost: 3000, w: 1, h: 1, grow: 'R1', desc: 'Casa térrea para uma família.' },
    edificio:    { name: 'Edifício Residencial', cat: 'buildings', cost: 18000, w: 1, h: 1, grow: 'R2', desc: 'Prédio de apartamentos de média densidade.' },
    torre_res:   { name: 'Torre Residencial', cat: 'buildings', cost: 60000, w: 1, h: 1, grow: 'R3', desc: 'Arranha-céu residencial de alta densidade.' },
    loja:        { name: 'Loja', cat: 'buildings', cost: 4000, w: 1, h: 1, grow: 'C1', desc: 'Pequeno comércio de bairro.' },
    escritorio:  { name: 'Escritórios', cat: 'buildings', cost: 25000, w: 1, h: 1, grow: 'C2', desc: 'Prédio comercial de escritórios.' },
    arranha_ceu: { name: 'Arranha-céu', cat: 'buildings', cost: 90000, w: 1, h: 1, grow: 'C3', desc: 'Torre comercial de vidro.' },
    fabrica:     { name: 'Fábrica', cat: 'buildings', cost: 6000, w: 1, h: 1, grow: 'I1', desc: 'Indústria leve.' },
    armazem:     { name: 'Armazém', cat: 'buildings', cost: 15000, w: 1, h: 1, grow: 'I2', desc: 'Logística e silos.' },
    tecnologia:  { name: 'Indústria de Tecnologia', cat: 'buildings', cost: 40000, w: 1, h: 1, grow: 'I3', desc: 'Indústria limpa de alta tecnologia.' },

    prefeitura:  { name: 'Prefeitura', cat: 'services', cost: 15000, upkeep: 100, w: 2, h: 2, unique: true, eff: { happy: 5, lv: [0.2, 10] }, desc: 'Sede do governo. Aumenta a felicidade.' },
    hospital:    { name: 'Hospital', cat: 'services', cost: 30000, upkeep: 450, w: 2, h: 2, eff: { cover: ['health', 16], lv: [0.1, 8], jobs: 60 }, desc: 'Saúde num raio de 16 lotes.' },
    policia:     { name: 'Delegacia', cat: 'services', cost: 12000, upkeep: 220, w: 1, h: 1, eff: { cover: ['police', 13], jobs: 25 }, desc: 'Segurança num raio de 13 lotes.' },
    bombeiros:   { name: 'Bombeiros', cat: 'services', cost: 14000, upkeep: 220, w: 2, h: 1, eff: { cover: ['fire', 14], jobs: 25 }, desc: 'Proteção contra incêndio num raio de 14 lotes.' },
    escola:      { name: 'Escola', cat: 'services', cost: 20000, upkeep: 320, w: 2, h: 2, eff: { cover: ['edu', 14], lv: [0.1, 8], jobs: 40 }, desc: 'Educação num raio de 14 lotes.' },

    carvao:      { name: 'Usina a Carvão', cat: 'utilities', cost: 18000, upkeep: 300, w: 2, h: 2, eff: { power: 1400, pol: [30, 9], jobs: 40 }, desc: 'Muita energia, mas polui bastante.' },
    solar:       { name: 'Usina Solar', cat: 'utilities', cost: 32000, upkeep: 120, w: 2, h: 2, eff: { power: 600 }, desc: 'Energia limpa e renovável.' },
    eolica:      { name: 'Turbina Eólica', cat: 'utilities', cost: 9000, upkeep: 40, w: 1, h: 1, eff: { power: 180 }, desc: 'Energia limpa do vento.' },
    agua:        { name: 'Torre de Água', cat: 'utilities', cost: 7000, upkeep: 60, w: 1, h: 1, eff: { water: 700 }, desc: 'Abastece água para a cidade.' },

    parque:      { name: 'Parque', cat: 'environment', cost: 2500, upkeep: 20, w: 1, h: 1, eff: { lv: [0.15, 5], pol: [-6, 4], happy: 0.5 }, desc: 'Valoriza a vizinhança.' },
    parque_grande:{ name: 'Parque Grande', cat: 'environment', cost: 8000, upkeep: 60, w: 2, h: 2, eff: { lv: [0.3, 8], pol: [-12, 7], happy: 1.5 }, desc: 'Lago, árvores e coreto.' },
    praca:       { name: 'Praça com Fonte', cat: 'environment', cost: 3500, upkeep: 25, w: 1, h: 1, eff: { lv: [0.14, 5], happy: 0.5 }, desc: 'Ponto de encontro dos moradores.' },
    arvore:      { name: 'Árvores', cat: 'environment', cost: 60, desc: 'Arraste para plantar. Reduz poluição.' },
    reciclagem:  { name: 'Centro de Reciclagem', cat: 'environment', cost: 16000, upkeep: 150, w: 2, h: 2, eff: { pol: [-25, 12], jobs: 30, happy: 1 }, desc: 'Reduz poluição na região.' },
    hub:         { name: 'Hub Cidade Inteligente', cat: 'environment', cost: 22000, upkeep: 120, w: 1, h: 1, unique: true, eff: { smart: 0.18, happy: 3 }, desc: 'Sensores e rede elétrica inteligente: −18% de consumo de energia e água, −10% poluição.' },

    torre:       { name: 'Torre Panorâmica', cat: 'landmarks', cost: 70000, upkeep: 200, w: 1, h: 1, unique: true, eff: { lv: [0.35, 14], happy: 6, jobs: 50 }, desc: 'Marco da cidade. Atrai turistas.' },
    estadio:     { name: 'Estádio', cat: 'landmarks', cost: 150000, upkeep: 700, w: 3, h: 3, unique: true, eff: { happy: 10, jobs: 200, lv: [0.15, 10] }, desc: 'Grande arena esportiva.' },
    corporativo: { name: 'Torre Corporativa', cat: 'landmarks', cost: 120000, upkeep: 300, w: 2, h: 2, unique: true, eff: { jobs: 900, lv: [0.25, 12] }, desc: 'Sede de uma multinacional com 900 empregos.' },
    shopping:    { name: 'Shopping Center', cat: 'landmarks', cost: 60000, upkeep: 150, w: 2, h: 2, eff: { jobs: 300, happy: 3, lv: [0.12, 8] }, desc: 'Centro de compras com estacionamento.' },

    bulldoze:    { name: 'Demolir', cat: 'tools', cost: 20, desc: 'Arraste para demolir.' }
  });
  for (const k in CAT) CAT[k].id = k;

  M.init = function () { buildArchetypes(); };
  M.archList = (zone, level) => Object.values(A).filter((a) => a.zone === zone && a.level === level).map((a) => a.key);
})();
