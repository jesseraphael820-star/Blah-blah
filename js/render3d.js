'use strict';
// ===== Renderização 3D (Three.js) — a simulação continua no plano (x,y) => (x, altura, y) =====
const HS = 1.8; // escala de altura dos prédios
const MATS = {};
function mat(c) { return MATS[c] || (MATS[c] = new THREE.MeshLambertMaterial({ color: new THREE.Color(c) })); }
const GEO = {};
function boxMesh(m, sx, sy, sz, x, y, z, shadow) {
  const b = new THREE.Mesh(GEO.box, m); b.scale.set(sx, sy, sz); b.position.set(x, y, z);
  if (shadow !== false) b.castShadow = true; return b;
}
function bldHeightAt(x, y) {
  const i = blockIdx(Math.floor(x / PT), Math.floor(y / PT)); if (i < 0) return 0;
  for (const b of BLOCK_OBS[i]) if (b.type === 'r' && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b.ht * HS;
  return 0;
}
// ===== Câmera estilo terceira pessoa =====
const CAM = {
  yaw: Math.PI / 2, pitch: 0.3, dist: 92, curDist: 92, manualT: 0, fov: 62,
  look(dx, dy) { this.yaw = angN(this.yaw + dx * 0.0068); this.pitch = clamp(this.pitch + dy * 0.0045, 0.04, 1.25); this.manualT = 2.2; },
  snap() { const pl = G.player; this.yaw = pl.car ? pl.car.a : pl.a; this.curDist = this.dist; },
  update(dt, camera) {
    const pl = G.player, c = pl.car, me = c || pl;
    const th = c && !c.two ? 17 : 19;
    if (c && !c.two) {
      this.dist = 98 + Math.min(70, c.spd * 0.16) + (c.type === 'van' || c.type === 'truck' ? 16 : 0);
      if (this.manualT <= 0) {
        const tgt = (c.fwd || 0) < -40 ? c.a : c.a; // GTA: a câmera fica atrás do carro, mesmo na ré
        this.yaw = angN(this.yaw + angN(tgt - this.yaw) * (1 - Math.exp(-(1.2 + c.spd / 120) * dt)));
        this.pitch = lerp(this.pitch, 0.27, 1 - Math.exp(-1.5 * dt));
      }
    } else {
      this.dist = c ? 88 + Math.min(40, c.spd * 0.1) : 82;
      if (pl.car && pl.car.two) { if (this.manualT <= 0) this.yaw = angN(this.yaw + angN(pl.car.a - this.yaw) * (1 - Math.exp(-1.5 * dt))); }
      else if (this.manualT <= 0 && pl.moving && Math.abs(angN(pl.a - this.yaw)) < 2.0) this.yaw = angN(this.yaw + angN(pl.a - this.yaw) * (1 - Math.exp(-0.9 * dt)));
    }
    this.manualT -= dt;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch), fx = Math.cos(this.yaw), fy = Math.sin(this.yaw);
    let d = this.dist;
    for (let s = 10; s < this.dist; s += 5) {
      const x = me.x - fx * cp * s, y = me.y - fy * cp * s, h = th + sp * s;
      if (bldHeightAt(x, y) > h - 5 || x > WATER_X + 3000) { d = Math.max(14, s - 8); break; }
    }
    this.curDist = d < this.curDist ? d : lerp(this.curDist, d, 1 - Math.exp(-2.5 * dt));
    const D = this.curDist, sh = G.shake ? G.shake * 0.4 : 0;
    camera.position.set(me.x - fx * cp * D + rand(-sh, sh), th + sp * D + rand(-sh, sh), me.y - fy * cp * D + rand(-sh, sh));
    this.kick = Math.max(0, (this.kick || 0) - dt * 0.25);
    camera.lookAt(me.x + fx * 12, th + 7 + this.kick * 120, me.y + fy * 12);
    const fov = 62 + (c ? Math.min(14, c.spd * 0.03) : 0);
    if (Math.abs(fov - camera.fov) > 0.1) { camera.fov = lerp(camera.fov, fov, 1 - Math.exp(-3 * dt)); camera.updateProjectionMatrix(); }
  },
};

const R3 = {
  carMeshes: new Map(), pedMeshes: new Map(), pickMeshes: new Map(), markers: [], shadows: true,
  init() {
    GEO.box = new THREE.BoxGeometry(1, 1, 1);
    GEO.leg = new THREE.BoxGeometry(4, 13, 4).translate(0, -6.5, 0);
    GEO.arm = new THREE.BoxGeometry(3, 11, 3).translate(0, -5.5, 0);
    GEO.wheel = new THREE.CylinderGeometry(4.6, 4.6, 3.6, 12).rotateX(Math.PI / 2);
    GEO.pick = new THREE.OctahedronGeometry(6, 0);
    this.mobile = matchMedia('(pointer:coarse)').matches;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c3d'), antialias: !this.mobile, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    const s = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 2, 3200);
    s.fog = new THREE.Fog(0x9fd0f0, 600, 2100); s.background = null;
    this.skyDome();
    this.hemi = new THREE.HemisphereLight(0xd6ecff, 0x6a5d48, 0.65); s.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xfff0d6, 1.0);
    sun.castShadow = true; sun.shadow.mapSize.set(this.mobile ? 1024 : 2048, this.mobile ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -380, right: 380, top: 380, bottom: -380, near: 10, far: 1800 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6;
    s.add(sun, sun.target);
    this.headL = new THREE.SpotLight(0xfff2cc, 0, 520, 0.55, 0.5, 1.2); s.add(this.headL, this.headL.target);
    this.siren = new THREE.PointLight(0xff2222, 0, 260, 1.5); s.add(this.siren);
    this.boomL = new THREE.PointLight(0xff9a40, 0, 420, 1.5); s.add(this.boomL);
    for (const b of BUILDINGS) { const d = districtOf(Math.floor(b.x / PT), Math.floor(b.y / PT)); b.house = (d === 'suburb' || d === 'beach' || d === 'rural') && (!b.label || b.label === 'CASA'); }
    this.buildGround(); this.buildCity(); this.buildTrees(); this.buildLamps(); this.buildFx(); this.buildProps();
    this.resize();
  },
  resize() { this.renderer.setSize(window.innerWidth, window.innerHeight, false); this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); },
  setShadows(on) { this.shadows = on; this.renderer.shadowMap.enabled = on; this.sun.castShadow = on; this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); },
  // ----- Chão -----
  buildGround() {
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    const nx = Math.ceil(MAP_TW / CHT), ny = Math.ceil(MAP_TH / CHT), RES = this.mobile ? 256 : 512;
    const geo = new THREE.PlaneGeometry(CH, CH).rotateX(-Math.PI / 2);
    for (let cy = 0; cy < ny; cy++) for (let cx = 0; cx < nx; cx++) {
      if (cx * CHT > CITY_T + 6) continue;
      const src = renderChunk(cx, cy);
      let cnv = src;
      if (RES !== CH) { cnv = document.createElement('canvas'); cnv.width = cnv.height = RES; cnv.getContext('2d').drawImage(src, 0, 0, RES, RES); }
      const tex = new THREE.CanvasTexture(cnv); tex.anisotropy = aniso;
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
      m.position.set(cx * CH + CH / 2, 0, cy * CH + CH / 2); m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
      this.scene.add(m);
    }
    // mar ao redor da ilha
    const wm = this.waterMat = new THREE.MeshPhongMaterial({ color: 0x2a7fb8, shininess: 90, specular: 0x6699aa, transparent: true, opacity: 0.94 });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000).rotateX(-Math.PI / 2), wm);
    sea.position.set(WW / 2, -1.5, WH / 2); this.scene.add(sea);
    const bay = new THREE.Mesh(new THREE.PlaneGeometry(6000, WH + 6000).rotateX(-Math.PI / 2), wm);
    bay.position.set(WATER_X + 3000, 0.6, WH / 2); bay.receiveShadow = true; this.scene.add(bay);
  },
  // ----- Prédios (uma malha só, com cores por vértice) -----
  buildCity() {
    const W = { p: [], n: [], u: [], c: [] }, Rf = { p: [], n: [], u: [], c: [] };
    const col = new THREE.Color();
    const quad = (A, a, b, c2, d, nrm, uvs, color) => {
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c2[0] - a[0], c2[1] - a[1], c2[2] - a[2]];
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      let v = [a, b, c2, d], t = uvs;
      if (cr[0] * nrm[0] + cr[1] * nrm[1] + cr[2] * nrm[2] < 0) { v = [a, d, c2, b]; t = [uvs[0], uvs[3], uvs[2], uvs[1]]; }
      for (const i of [0, 1, 2, 0, 2, 3]) { A.p.push(...v[i]); A.n.push(...nrm); A.u.push(...t[i]); A.c.push(color.r, color.g, color.b); }
    };
    const box = (A, x0, z0, x1, z1, y0, y1, color, roofColor, uvScale) => {
      const us = uvScale || 0;
      const faces = [
        [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], x1 - x0],
        [[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [0, 0, 1], x1 - x0],
        [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [-1, 0, 0], z1 - z0],
        [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], z1 - z0],
      ];
      for (const f of faces) {
        const uw = us ? f[5] / 96 : 0, uh = us ? (y1 - y0) / 104 : 0, v0 = us ? y0 / 104 : 0;
        quad(A, f[0], f[1], f[2], f[3], f[4], [[0, v0], [uw, v0], [uw, v0 + uh], [0, v0 + uh]], color);
      }
      if (roofColor) quad(Rf, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], roofColor);
    };
    for (const b of BUILDINGS) {
      const h = b.ht * HS;
      col.set(b.col); const rc = new THREE.Color(b.roof);
      box(W, b.x, b.y, b.x + b.w, b.y + b.h, 0, h, col, rc, 1);
      if (b.house) { if (b.label) this.addLabel(b, h); continue; }
      // mureta do telhado
      const pc = rc.clone().multiplyScalar(0.8), t = 3;
      box(Rf, b.x, b.y, b.x + b.w, b.y + t, h, h + 4, pc, pc); box(Rf, b.x, b.y + b.h - t, b.x + b.w, b.y + b.h, h, h + 4, pc, pc);
      box(Rf, b.x, b.y, b.x + t, b.y + b.h, h, h + 4, pc, pc); box(Rf, b.x + b.w - t, b.y, b.x + b.w, b.y + b.h, h, h + 4, pc, pc);
      for (const d of b.details) { const dc = new THREE.Color(b.col).multiplyScalar(1.1); box(Rf, d.x, d.y, d.x + d.w, d.y + d.h, h, h + 8 + (d.w % 6), dc, dc); }
      if (b.label) this.addLabel(b, h);
    }
    const mk = A => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(A.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(A.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(A.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(A.c, 3)); return g; };
    // textura de janelas (4x4 por bloco)
    const wc = document.createElement('canvas'); wc.width = wc.height = 128; const g = wc.getContext('2d');
    const ec = document.createElement('canvas'); ec.width = ec.height = 128; const e = ec.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); e.fillStyle = '#000'; e.fillRect(0, 0, 128, 128);
    const rr2 = rng(77);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      g.fillStyle = '#5d6b80'; g.fillRect(i * 32 + 7, j * 32 + 6, 18, 20);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(i * 32 + 7, j * 32 + 6, 18, 3);
      if (rr2() < 0.45) { e.fillStyle = rr2() < .5 ? '#ffd890' : '#ffeec8'; e.fillRect(i * 32 + 7, j * 32 + 6, 18, 20); }
    }
    g.fillStyle = 'rgba(0,0,0,.15)'; for (let j = 0; j < 4; j++) g.fillRect(0, j * 32 + 29, 128, 3);
    const wt = new THREE.CanvasTexture(wc); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.anisotropy = 4;
    const et = new THREE.CanvasTexture(ec); et.wrapS = et.wrapT = THREE.RepeatWrapping;
    this.wallMat = new THREE.MeshLambertMaterial({ map: wt, vertexColors: true, emissive: 0xffffff, emissiveMap: et, emissiveIntensity: 0 });
    this.buildShopfronts(); this.buildBaseAO();
    const walls = new THREE.Mesh(mk(W), this.wallMat); walls.castShadow = walls.receiveShadow = true;
    const roofs = new THREE.Mesh(mk(Rf), new THREE.MeshLambertMaterial({ vertexColors: true })); roofs.castShadow = roofs.receiveShadow = true;
    this.scene.add(walls, roofs);
  },
  buildBaseAO() {
    const c = document.createElement('canvas'); c.width = 4; c.height = 32; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 32); gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 32);
    const tex = new THREE.CanvasTexture(c);
    const P = [], N = [], U = [], m = 14;
    const quad = (a, b, c2, d) => { for (const v of [a, b, c2, a, c2, d]) { P.push(v[0], 0.35, v[1]); N.push(0, 1, 0); } U.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); };
    for (const b of BUILDINGS) {
      const x0 = b.x, x1 = b.x + b.w, z0 = b.y, z1 = b.y + b.h;
      quad([x0 - m, z0 - m], [x1 + m, z0 - m], [x1, z0], [x0, z0]); quad([x1 + m, z1 + m], [x0 - m, z1 + m], [x0, z1], [x1, z1]);
      quad([x0 - m, z1 + m], [x0 - m, z0 - m], [x0, z0], [x0, z1]); quad([x1 + m, z0 - m], [x1 + m, z1 + m], [x1, z1], [x1, z0]);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    // uv: 1 = encostado na parede (escuro), 0 = fora
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, uv.getY(i));
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })); mesh.renderOrder = 1; this.scene.add(mesh);
    tex.flipY = false;
  },
  buildShopfronts() {
    const names = ['PADARIA SOL', 'FARMÁCIA', 'LOJA 1,99', 'BAR DO TIÃO', 'CELULARES', 'AÇOUGUE', 'LAVANDERIA', 'PET SHOP', 'SALÃO DA BIA', 'LANCHES', 'ÓTICA', 'MERCADINHO', 'CAFÉ', 'SORVETERIA', 'TATTOO', 'PIZZARIA', 'ACADEMIA', 'LOTÉRICA'];
    const cols = ['#d23a2a', '#2a6ad2', '#2aa25a', '#e8a21a', '#7a2ad2', '#1a1a1a', '#e86ab0', '#1a8a8a'];
    const r = rng(2024);
    for (const b of BUILDINGS) {
      const bx = Math.floor(b.x / PT), by = Math.floor(b.y / PT), d = districtOf(bx, by);
      if (!(b.shop || (d === 'downtown' && !b.label && b.w >= 60)) || b.house) continue;
      const name = b.shop || names[Math.floor(r() * names.length)], col = cols[Math.floor(r() * cols.length)];
      const W = Math.min(b.w - 8, 140), c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
      g.fillStyle = '#2c3440'; g.fillRect(0, 0, 512, 96);
      g.fillStyle = '#9fc4dc'; for (let i = 0; i < 4; i++) g.fillRect(12 + i * 100 + (i >= 2 ? 100 : 0), 30, 88, 60);
      g.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 4; i++) g.fillRect(14 + i * 100 + (i >= 2 ? 100 : 0), 32, 20, 56);
      g.fillStyle = '#4a2a14'; g.fillRect(212, 30, 88, 66); g.fillStyle = '#d8c070'; g.fillRect(286, 62, 6, 6);
      g.fillStyle = col; g.fillRect(0, 0, 512, 26); g.fillStyle = '#fff'; g.font = '900 20px "Arial Black", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 256, 13);
      const tex = new THREE.CanvasTexture(c);
      const mat2 = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 });
      (this.shopMats || (this.shopMats = [])).push(mat2);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(W, W * 96 / 512), mat2); m.position.set(b.x + b.w / 2, W * 96 / 512 / 2 + 0.2, b.y + b.h + 0.6); this.scene.add(m);
    }
  },
  addLabel(b, h) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
    g.fillStyle = b.label === 'HOSPITAL' ? '#d22' : b.label === 'POLÍCIA' ? '#1a2a5a' : '#111'; g.fillRect(0, 0, 512, 96);
    g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 84);
    g.fillStyle = '#fff'; g.font = '900 60px "Arial Black", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(b.label, 256, 52);
    const t = new THREE.CanvasTexture(c);
    const w = Math.min(b.w * 0.8, 150);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 96 / 512), new THREE.MeshBasicMaterial({ map: t }));
    m.position.set(b.x + b.w / 2, Math.min(h - 12, 48), b.y + b.h + 0.8); this.scene.add(m);
    if (b.label === 'HOSPITAL') { const cr = new THREE.MeshBasicMaterial({ color: 0xdd2222 }); this.scene.add(boxMesh(cr, 40, 1, 12, b.x + b.w / 2, h + 0.6, b.y + b.h / 2, false), boxMesh(cr, 12, 1, 40, b.x + b.w / 2, h + 0.6, b.y + b.h / 2, false)); }
  },
  buildTrees() {
    const n = TREES.length, dummy = new THREE.Object3D();
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.6, 2.6, 1, 6).translate(0, 0.5, 0), mat('#5a3d22'), n);
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ flatShading: true }), n);
    const c = new THREE.Color();
    TREES.forEach((t, i) => {
      const th = t.palm ? 70 : 16 + t.r * 0.5;
      dummy.position.set(t.x, 0, t.y); dummy.rotation.set(t.palm ? 0.12 : 0, t.x, 0); dummy.scale.set(t.palm ? 1.2 : 1.4, th, t.palm ? 1.2 : 1.4); dummy.updateMatrix(); trunk.setMatrixAt(i, dummy.matrix);
      dummy.position.set(t.x, th + (t.palm ? 0 : t.r * 0.7), t.y); dummy.rotation.set(0, t.y, 0);
      if (t.palm) dummy.scale.set(26, 6, 26); else dummy.scale.set(t.r * 1.15, t.r * 1.05, t.r * 1.15);
      dummy.updateMatrix(); crown.setMatrixAt(i, dummy.matrix);
      c.set(t.palm ? '#3f9a3a' : pick(['#2f6b2a', '#3a7a30', '#2a5f2a', '#4a8a35'])); crown.setColorAt(i, c);
    });
    trunk.castShadow = crown.castShadow = true; crown.receiveShadow = true;
    this.scene.add(trunk, crown);
    // fontes
    for (const d of DECOS) if (d.type === 'fountain') {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(28, 30, 8, 20), mat('#bbbbbb')); f.position.set(d.x, 4, d.y); f.castShadow = f.receiveShadow = true;
      const w = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 1, 20), this.waterMat); w.position.set(d.x, 8, d.y);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 22, 8), mat('#dddddd')); p.position.set(d.x, 11, d.y);
      this.scene.add(f, w, p);
    }
  },
  buildLamps() {
    const pts = [];
    for (let j = 0; j < NB; j++) for (let i = 0; i < NB; i++) { const X = i * PT, Y = j * PT; pts.push([X + 288, Y + 132, 0, -1]); pts.push([X + 288, Y + 444, 0, 1]); pts.push([X + 132, Y + 288, -1, 0]); pts.push([X + 444, Y + 288, 1, 0]); }
    const dummy = new THREE.Object3D();
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.4, 46, 6).translate(0, 23, 0), mat('#3a3d44'), pts.length);
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0x777777 });
    const head = new THREE.InstancedMesh(new THREE.BoxGeometry(12, 3, 5), this.lampMat, pts.length);
    pts.forEach(([x, y, sx, sy], i) => {
      dummy.position.set(x, 0, y); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); pole.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x + sx * 6, 46, y + sy * 6); dummy.rotation.set(0, sx ? 0 : Math.PI / 2, 0); dummy.updateMatrix(); head.setMatrixAt(i, dummy.matrix);
      addObs({ type: 'c', x, y, r: 2 });
    });
    // poças de luz dos postes à noite
    this.lampPoolMat = new THREE.MeshBasicMaterial({ map: this.glowTex(), color: 0xffd890, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const lp = new THREE.InstancedMesh(new THREE.PlaneGeometry(110, 110).rotateX(-Math.PI / 2), this.lampPoolMat, pts.length);
    pts.forEach(([x, y, sx, sy], i) => { dummy.position.set(x + sx * 22, 0.5, y + sy * 22); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); lp.setMatrixAt(i, dummy.matrix); });
    lp.renderOrder = 2; this.scene.add(lp);
    pole.castShadow = true; this.scene.add(pole, head);
    this.lampPts = pts;
  },
  streakTex() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 8; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,240,200,.9)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 8); return new THREE.CanvasTexture(c);
  },
  flashTex() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.translate(32, 32); g.fillStyle = 'rgba(255,230,160,1)';
    for (let i = 0; i < 7; i++) { g.rotate(Math.PI * 2 / 7); g.beginPath(); g.moveTo(0, -3); g.lineTo(30, 0); g.lineTo(0, 3); g.fill(); }
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 14); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = gr; g.fillRect(-16, -16, 32, 32);
    return new THREE.CanvasTexture(c);
  },
  skyDome() {
    const geo = new THREE.SphereGeometry(2900, 24, 12), n = geo.attributes.position.count, cols = new Float32Array(n * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.sky.renderOrder = -10; this.sky.frustumCulled = false; this.scene.add(this.sky);
  },
  updateSky(dk, dusk) {
    const top = new THREE.Color(0x3f8fe0).lerp(new THREE.Color(0x02040f), dk), hor = new THREE.Color(0xb8dcf4).lerp(new THREE.Color(0x101a36), dk);
    hor.lerp(new THREE.Color(0xf4905a), dusk * 0.7); top.lerp(new THREE.Color(0x6a4a8a), dusk * 0.35);
    const pos = this.sky.geometry.attributes.position, c = this.sky.geometry.attributes.color;
    for (let i = 0; i < pos.count; i++) { const t = clamp(pos.getY(i) / 2900, -0.1, 1); const k = Math.pow(Math.max(0, t), 0.55); c.setXYZ(i, lerp(hor.r, top.r, k), lerp(hor.g, top.g, k), lerp(hor.b, top.b, k)); }
    c.needsUpdate = true; this.sky.position.copy(this.camera.position); this.scene.fog.color.copy(hor);
  },
  glowTex() {
    if (this._glow) return this._glow;
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return (this._glow = new THREE.CanvasTexture(c));
  },
  // ----- Efeitos -----
  buildFx() {
    this.poolGeo = new THREE.PlaneGeometry(120, 80).rotateX(-Math.PI / 2);
    this.poolMat = new THREE.MeshBasicMaterial({ map: this.glowTex(), color: 0xfff0c0, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
    const dc = document.createElement('canvas'); dc.width = dc.height = 64; const g = dc.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const dot = new THREE.CanvasTexture(dc);
    const mkP = (n, size, add, op) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const p = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: dot, vertexColors: true, transparent: true, depthWrite: false, opacity: op, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
      p.frustumCulled = false; p.n = n; this.scene.add(p); return p;
    };
    this.pFire = mkP(500, 16, true, 1); this.pSmoke = mkP(300, 34, false, 0.5); this.pSmall = mkP(300, 5, false, 1);
    // rastros de bala: quadros brilhantes (duas placas cruzadas)
    const tq = mergeGeo([[new THREE.PlaneGeometry(1, 1.6), '#fff'], [new THREE.PlaneGeometry(1, 1.6).rotateX(Math.PI / 2), '#fff']]);
    this.tracerM = new THREE.InstancedMesh(tq, new THREE.MeshBasicMaterial({ map: this.streakTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), 60);
    this.tracerM.frustumCulled = false; this.tracerM.count = 0; this.scene.add(this.tracerM);
    // clarão do cano
    const fq = mergeGeo([[new THREE.PlaneGeometry(1, 1).rotateY(Math.PI / 2).translate(0.5, 0, 0), '#fff'], [new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0), '#fff'], [new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2).translate(0.5, 0, 0), '#fff']]);
    this.flashM = new THREE.InstancedMesh(fq, new THREE.MeshBasicMaterial({ map: this.flashTex(), color: 0xffe0a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), 12);
    this.flashM.frustumCulled = false; this.flashM.count = 0; this.scene.add(this.flashM);
    this.gunL = new THREE.PointLight(0xffd080, 0, 160, 1.6); this.scene.add(this.gunL);
    // destroços e cápsulas
    this.debrisM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), 220);
    this.debrisM.frustumCulled = false; this.debrisM.count = 0; this.debrisM.castShadow = true; this.scene.add(this.debrisM);
    this.skids = new THREE.InstancedMesh(new THREE.PlaneGeometry(8, 5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.4, depthWrite: false }), 500);
    this.skids.frustumCulled = false; this.scene.add(this.skids);
    this.decals = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }), 80);
    this.decals.frustumCulled = false; this.decals.setColorAt(0, new THREE.Color()); this.scene.add(this.decals);
    // marcadores
    this.mkGeo = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true).translate(0, 0.5, 0);
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2);
    this.chev = new THREE.Mesh(new THREE.ConeGeometry(6, 13, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    this.scene.add(this.chev);
    this.reticle = new THREE.Mesh(new THREE.RingGeometry(10, 12.5, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3c3c, transparent: true, opacity: 0.85, depthTest: false }));
    this.scene.add(this.reticle);
  },
  marker(i, m) {
    let k = this.markers[i];
    if (!k) {
      const col = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const ring = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, side: THREE.DoubleSide });
      k = this.markers[i] = { cyl: new THREE.Mesh(this.mkGeo, col), ring: new THREE.Mesh(this.ringGeo, ring) };
      this.scene.add(k.cyl, k.ring);
    }
    const c = new THREE.Color(`rgb(${m.c})`), r = m.r * (1 + Math.sin(G.t * 4) * 0.05);
    k.cyl.material.color.copy(c); k.ring.material.color.copy(c);
    k.cyl.visible = k.ring.visible = true;
    k.cyl.position.set(m.p.x, 0.3, m.p.y); k.cyl.scale.set(r, m.obj && m.l ? 90 : 30, r);
    k.ring.position.set(m.p.x, 0.4, m.p.y); k.ring.scale.set(r, 1, r);
  },
  // ----- Sincronização por quadro -----
  sync(dt) {
    const pl = G.player;
    const dk = darkness() / 0.62, cp = this.camera.position;
    // carros
    const seen = new Set();
    for (const c of G.cars) {
      let m = this.carMeshes.get(c.id);
      if (!m) { m = makeVehicle(c); this.scene.add(m); this.carMeshes.set(c.id, m); }
      seen.add(c.id);
      const far = Math.abs(c.x - cp.x) > 1300 || Math.abs(c.y - cp.z) > 1300;
      m.visible = !far; if (!far) updCarModel(c, m, dt, dk);
    }
    for (const [id, m] of this.carMeshes) if (!seen.has(id)) { this.scene.remove(m); this.carMeshes.delete(id); }
    // pedestres
    const ps = new Set();
    const list = G.peds.filter(p => !p.car || p.car.two);
    if (!pl.car || pl.car.two) list.push(pl);
    for (const p of list) {
      if (Math.abs(p.x - cp.x) > 900 || Math.abs(p.y - cp.z) > 900) continue;
      let m = this.pedMeshes.get(p.id);
      if (!m) { m = makePedModel(p); this.scene.add(m); this.pedMeshes.set(p.id, m); }
      ps.add(p.id); animPed(p, m, dt);
    }
    for (const [id, m] of this.pedMeshes) if (!ps.has(id)) { this.scene.remove(m); disposeModel(m); this.pedMeshes.delete(id); }
    // itens
    const ks = new Set();
    G.pickups.forEach(k => {
      if (k.respawn > 0) return;
      if (!k.id) k.id = NEXT_ID++;
      let m = this.pickMeshes.get(k.id);
      const wi = { pistol: 1, smg: 2, shotgun: 3 }[k.type];
      if (!m) {
        if (wi) { m = new THREE.Mesh(gunGeo(wi), PED_MAT()); m.scale.setScalar(1.25); }
        else m = new THREE.Mesh(GEO.pick, new THREE.MeshLambertMaterial({ color: PK[k.type][1], emissive: PK[k.type][1], emissiveIntensity: 0.45 }));
        m.castShadow = true; this.scene.add(m); this.pickMeshes.set(k.id, m);
      }
      ks.add(k.id);
      if (k.drop) { m.position.set(k.x, 1.2, k.y); m.rotation.set(Math.PI / 2, 0, k.a || 0); }
      else { m.position.set(k.x, (wi ? 9 : 12) + Math.sin(G.t * 3 + k.x) * 3, k.y); m.rotation.set(0, G.t * 2, wi ? 0.3 : 0); }
    });
    for (const [id, m] of this.pickMeshes) if (!ks.has(id)) { this.scene.remove(m); this.pickMeshes.delete(id); }
    // marcadores
    const ml = markerList(); ml.forEach((m, i) => this.marker(i, m));
    for (let i = ml.length; i < this.markers.length; i++) this.markers[i].cyl.visible = this.markers[i].ring.visible = false;
    const tg = M.target();
    this.chev.visible = !!tg;
    if (tg) { const kill = M.cur().t === 'kill'; this.chev.position.set(tg.x, (kill ? 48 : 75) + Math.sin(G.t * 4) * 5, tg.y); this.chev.rotation.y = G.t * 2; this.chev.material.color.setHex(kill ? 0xff3333 : M.cur().t === 'cp' ? 0xff5555 : 0xffd23f); }
    this.reticle.visible = !!(aimT && !pl.car && aimT.hp > 0);
    if (this.reticle.visible) { this.reticle.position.set(aimT.x, 1, aimT.y); this.reticle.material.color.setHex(aimT.kind === 'civ' ? 0xffffff : 0xff3c3c); const s = 1 + Math.sin(G.t * 10) * 0.12; this.reticle.scale.set(s, 1, s); }
    // partículas
    const fp = this.pFire.geometry.attributes.position.array, fc = this.pFire.geometry.attributes.color.array;
    const sp = this.pSmoke.geometry.attributes.position.array, sc = this.pSmoke.geometry.attributes.color.array;
    const mp = this.pSmall.geometry.attributes.position.array, mc = this.pSmall.geometry.attributes.color.array;
    let nf = 0, ns = 0, nm = 0;
    for (const q of G.parts) {
      const a = q.life / q.max, age = q.max - q.life;
      if (q.type === 'fire' || q.type === 'flash') {
        if (nf >= this.pFire.n) continue;
        fp[nf * 3] = q.x; fp[nf * 3 + 1] = q.type === 'flash' ? 18 : 6 + age * 40; fp[nf * 3 + 2] = q.y;
        fc[nf * 3] = a; fc[nf * 3 + 1] = (q.type === 'flash' ? 0.95 : 0.35 + a * 0.45) * a; fc[nf * 3 + 2] = (q.type === 'flash' ? 0.6 : 0.1) * a; nf++;
      } else if (q.type === 'smoke' || q.type === 'dust' || q.type === 'bloodpuff') {
        if (ns >= this.pSmoke.n) continue;
        sp[ns * 3] = q.x; sp[ns * 3 + 1] = (q.type === 'smoke' ? 12 : 8) + age * (q.type === 'smoke' ? 30 : 12); sp[ns * 3 + 2] = q.y;
        if (q.type === 'dust') { sc[ns * 3] = 0.6; sc[ns * 3 + 1] = 0.52; sc[ns * 3 + 2] = 0.4; }
        else if (q.type === 'bloodpuff') { sc[ns * 3] = 0.45; sc[ns * 3 + 1] = 0.02; sc[ns * 3 + 2] = 0.02; }
        else { const v = 0.25 + (1 - a) * 0.2; sc[ns * 3] = sc[ns * 3 + 1] = sc[ns * 3 + 2] = v; }
        ns++;
      } else {
        if (nm >= this.pSmall.n) continue;
        mp[nm * 3] = q.x; mp[nm * 3 + 1] = q.type === 'blood' ? 10 - age * 20 : 12; mp[nm * 3 + 2] = q.y;
        if (q.type === 'blood') { mc[nm * 3] = 0.55; mc[nm * 3 + 1] = 0; mc[nm * 3 + 2] = 0; } else { mc[nm * 3] = 1; mc[nm * 3 + 1] = 0.85; mc[nm * 3 + 2] = 0.4; }
        nm++;
      }
    }
    for (const [p, n] of [[this.pFire, nf], [this.pSmoke, ns], [this.pSmall, nm]]) { p.geometry.setDrawRange(0, n); p.geometry.attributes.position.needsUpdate = true; p.geometry.attributes.color.needsUpdate = true; }
    const dmy = this._d || (this._d = new THREE.Object3D());
    let n = 0; const col = this._c || (this._c = new THREE.Color());
    for (const t of G.tracers) {
      if (n >= 60) break; const dx = t.x2 - t.x1, dy = t.y2 - t.y1, len = Math.hypot(dx, dy); if (len < 2) continue;
      const k = t.life / (t.max || 0.09), head = Math.min(len, 10 + (1 - k) * len * 1.2);
      const fr = Math.max(0, head - 110 * (1 - k) - 40) / len, to = head / len;
      dmy.position.set(t.x1 + dx * (fr + to) / 2, 17, t.y1 + dy * (fr + to) / 2); dmy.rotation.set(0, -Math.atan2(dy, dx), 0); dmy.scale.set(Math.max(4, len * (to - fr)), 1, 1); dmy.updateMatrix();
      this.tracerM.setMatrixAt(n, dmy.matrix); this.tracerM.setColorAt(n, col.setRGB(1, 0.9, 0.55 + 0.4 * k)); n++;
    }
    this.tracerM.count = n; this.tracerM.instanceMatrix.needsUpdate = true; if (this.tracerM.instanceColor) this.tracerM.instanceColor.needsUpdate = true;
    n = 0;
    for (const f of G.flashes) {
      if (n >= 12) break;
      dmy.position.set(f.x, 18, f.y); dmy.rotation.set(0, -f.a, 0); const sc2 = (f.big ? 26 : 16) * (0.6 + f.life / 0.07 * 0.6); dmy.scale.set(sc2, sc2, sc2); dmy.updateMatrix();
      this.flashM.setMatrixAt(n++, dmy.matrix);
    }
    this.flashM.count = n; this.flashM.instanceMatrix.needsUpdate = true;
    if (G.flashes.length) { const f = G.flashes[G.flashes.length - 1]; this.gunL.position.set(f.x, 22, f.y); this.gunL.intensity = 2.5 + 3 * (f.life / 0.07); } else this.gunL.intensity = 0;
    n = 0;
    for (const d of G.debris) {
      if (n >= 220) break;
      dmy.position.set(d.x, d.h + d.s * 0.5, d.y); dmy.rotation.set(d.rx, d.ry, 0); dmy.scale.set(d.s * (d.shell ? 1.6 : 1.4), d.s * (d.shell ? 0.45 : 0.4), d.s * (d.shell ? 0.45 : 1)); dmy.updateMatrix();
      this.debrisM.setMatrixAt(n, dmy.matrix); this.debrisM.setColorAt(n, col.set(d.col)); n++;
    }
    this.debrisM.count = n; this.debrisM.instanceMatrix.needsUpdate = true; if (this.debrisM.instanceColor) this.debrisM.instanceColor.needsUpdate = true;
    n = 0;
    for (const s of G.skids) { if (n >= 500) break; dmy.position.set(s.x, 0.25, s.y); dmy.rotation.set(0, -s.a, 0); dmy.scale.set(1, 1, 1); dmy.updateMatrix(); this.skids.setMatrixAt(n++, dmy.matrix); }
    this.skids.count = n; this.skids.instanceMatrix.needsUpdate = true;
    n = 0;
    for (const d of G.decals) { if (n >= 80) break; dmy.position.set(d.x, 0.3 + n * 0.005, d.y); dmy.rotation.set(0, 0, 0); dmy.scale.set(d.r, 1, d.r); dmy.updateMatrix(); this.decals.setMatrixAt(n, dmy.matrix); col.set(d.c.startsWith('rgba(120') ? '#6a0808' : '#141414'); this.decals.setColorAt(n, col); n++; }
    this.decals.count = n; this.decals.instanceMatrix.needsUpdate = true; if (this.decals.instanceColor) this.decals.instanceColor.needsUpdate = true;
  },
  // ----- Luz do dia / noite -----
  lighting(dt) {
    const dk = darkness() / 0.62, day = 1 - dk;
    const sky = new THREE.Color(0x9fd0f0).lerp(new THREE.Color(0x060a1c), dk);
    const dusk = 4 * dk * (1 - dk); sky.lerp(new THREE.Color(0xf09a6a), dusk * 0.55);
    this.updateSky(dk, dusk);
    this.scene.fog.near = lerp(600, 250, dk); this.scene.fog.far = lerp(2100, 1300, dk);
    this.sun.intensity = 0.1 + 0.95 * day; this.hemi.intensity = 0.28 + 0.4 * day;
    this.sun.color.setRGB(1, 0.94 - dusk * 0.25, 0.84 - dusk * 0.35);
    this.hemi.color.setRGB(0.84 - dk * 0.5, 0.92 - dk * 0.5, 1);
    const me = G.player.car || G.player, h = (G.time / 60) % 24, ang = (h - 6) / 12 * Math.PI;
    this.sun.position.set(me.x + Math.cos(ang) * 500 + 150, 200 + Math.max(0.15, Math.sin(ang)) * 650, me.y + 320);
    this.sun.target.position.set(me.x, 0, me.y); this.sun.target.updateMatrixWorld();
    this.wallMat.emissiveIntensity = dk * 0.95;
    if (this.shopMats) for (const m of this.shopMats) m.emissiveIntensity = dk * 0.7;
    this.lampMat.color.setRGB(0.47 + dk * 0.53, 0.47 + dk * 0.45, 0.47 + dk * 0.2);
    this.lampPoolMat.opacity = clamp((dk - 0.25) * 1.2, 0, 0.55);
    this.waterMat.color.setRGB(0.16 * (0.4 + day * 0.6), 0.5 * (0.4 + day * 0.6), 0.72 * (0.4 + day * 0.6));
    const c = G.player.car;
    if (c && c.lights && !c.wreck) {
      this.headL.intensity = 0.4 + 2.2 * dk; const fx = Math.cos(c.a), fy = Math.sin(c.a);
      this.headL.position.set(c.x + fx * 26, 12, c.y + fy * 26); this.headL.target.position.set(c.x + fx * 200, 0, c.y + fy * 200); this.headL.target.updateMatrixWorld();
    } else this.headL.intensity = 0;
    let best = null, bd = 700;
    for (const k of G.cars) if (k.siren && !k.wreck) { const d = dist(k, me); if (d < bd) { bd = d; best = k; } }
    if (best) { this.siren.intensity = (0.8 + dk * 2.5) * (1 - bd / 700); this.siren.color.setHex(Math.floor(G.t * 8) % 2 ? 0xff2222 : 0x2255ff); this.siren.position.set(best.x, 32, best.y); } else this.siren.intensity = 0;
    this.boomL.intensity = Math.max(0, this.boomL.intensity - dt * 8);
  },
  flash(x, y) { this.boomL.position.set(x, 40, y); this.boomL.intensity = 6; },
  autoQuality(dt) {
    // reduz a qualidade sozinho se o aparelho não aguentar ~40 FPS
    this.qT = (this.qT || 0) + dt; this.qN = (this.qN || 0) + 1;
    if (this.qT < 3) return;
    const fps = this.qN / this.qT; this.qT = 0; this.qN = 0;
    if (fps > 40 || this.lockQ) return;
    const pr = this.renderer.getPixelRatio();
    if (pr > 1.01) { this.renderer.setPixelRatio(Math.max(1, pr - 0.25)); this.resize(); }
    else if (this.shadows) { this.setShadows(false); const b = document.getElementById('pShadow'); if (b) b.textContent = 'SOMBRAS: DESLIGADAS'; }
    else if (pr > 0.76) { this.renderer.setPixelRatio(0.75); this.resize(); this.lockQ = true; }
  },
  render(dt) {
    if (this.mobile) this.autoQuality(dt);
    this.sync(dt); this.lighting(dt); this.updateProps(dt, darkness() / 0.62); CAM.update(dt, this.camera);
    this.renderer.render(this.scene, this.camera);
  },
  project(x, h, y) {
    const v = this._v || (this._v = new THREE.Vector3()); v.set(x, h, y).project(this.camera);
    if (v.z > 1) return null; return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight };
  },
};
