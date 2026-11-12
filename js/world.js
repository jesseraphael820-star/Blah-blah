/* Mundo: grade de lotes, terreno, ruas, zonas, prédios e serviços */
(function () {
  const C = window.CITY, N = C.N, TS = C.TS;
  const W = (C.world = {});
  let scene, M, T;

  W.tiles = [];
  W.services = new Map();
  W.connected = new Uint8Array(N * N);
  W.version = 0; // incrementa a cada mudança estrutural
  let nextSvc = 1;

  const idx = (W.idx = (x, z) => z * N + x);
  W.inb = (x, z) => x >= 0 && z >= 0 && x < N && z < N;
  W.get = (x, z) => (W.inb(x, z) ? W.tiles[idx(x, z)] : null);
  W.center = (x, z, out) => (out || new THREE.Vector3()).set((x - N / 2 + 0.5) * TS, 0, (z - N / 2 + 0.5) * TS);
  W.toTile = (p) => ({ x: Math.floor(p.x / TS + N / 2), z: Math.floor(p.z / TS + N / 2) });
  const DIRS = (W.DIRS = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]]); // N L S O

  // ---------- pool de instâncias ----------
  class Pool {
    constructor(parts, opts) {
      this.parts = parts; this.opts = opts || {};
      this.items = new Map(); this.cap = 0; this.meshes = []; this.dirty = true;
    }
    set(key, m, color) { this.items.set(key, { m, c: color }); this.dirty = true; }
    del(key) { if (this.items.delete(key)) this.dirty = true; }
    clear() { if (this.items.size) { this.items.clear(); this.dirty = true; } }
    ensure(n) {
      if (n <= this.cap && this.meshes.length) return;
      const cap = Math.max(16, 1 << Math.ceil(Math.log2(Math.max(1, n))));
      for (const m of this.meshes) { scene.remove(m.im); m.im.dispose(); }
      this.meshes = this.parts.map((p) => {
        const im = new THREE.InstancedMesh(p.geo, p.mat, cap);
        im.castShadow = this.opts.shadow !== false;
        im.receiveShadow = this.opts.receive !== false;
        im.frustumCulled = false;
        if (this.opts.renderOrder) im.renderOrder = this.opts.renderOrder;
        if (p.colored) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
        im.count = 0;
        scene.add(im);
        return { im, local: p.m || null, colored: p.colored };
      });
      this.cap = cap;
    }
    update() {
      if (!this.dirty) return;
      this.dirty = false;
      this.ensure(this.items.size);
      const tmp = new THREE.Matrix4();
      let i = 0;
      for (const it of this.items.values()) {
        for (const m of this.meshes) {
          if (m.local) { tmp.multiplyMatrices(it.m, m.local); m.im.setMatrixAt(i, tmp); }
          else m.im.setMatrixAt(i, it.m);
          if (m.colored && it.c) m.im.setColorAt(i, it.c);
        }
        i++;
      }
      for (const m of this.meshes) {
        m.im.count = i;
        m.im.instanceMatrix.needsUpdate = true;
        if (m.im.instanceColor) m.im.instanceColor.needsUpdate = true;
      }
    }
  }
  W.Pool = Pool;

  const pools = { road: [], zone: {}, lot: {}, arch: {}, tree: [] };
  let roadsDirty = true, zonesDirty = true, treesDirty = true;

  const _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _e = new THREE.Euler();
  function tileMatrix(x, z, rot, y, scale) {
    W.center(x, z, _p); _p.y = y || 0;
    _q.setFromEuler(_e.set(0, (rot || 0) * Math.PI / 2, 0));
    _s.set(scale || 1, scale || 1, scale || 1);
    return new THREE.Matrix4().compose(_p, _q, _s);
  }
  W.tileMatrix = tileMatrix;

  // ---------- inicialização ----------
  W.init = function (sc) {
    scene = sc; M = C.models; T = C.tex;
    const roadGeo = M.plane(TS, TS);
    for (let m = 0; m < 16; m++) {
      const mat = M.std('road' + m, { map: T.road(m), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      pools.road[m] = new Pool([{ geo: roadGeo, mat }], { shadow: false });
    }
    const zg = M.plane(TS * 0.94, TS * 0.94);
    for (const z of ['R', 'C', 'I']) {
      const col = C.CATALOG['zone' + z].color;
      const mat = new THREE.MeshBasicMaterial({ map: T.zone(), color: col, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      pools.zone[z] = new Pool([{ geo: zg, mat }], { shadow: false, receive: false, renderOrder: 2 });
    }
    const lg = M.plane(TS, TS);
    for (const k of ['lawn', 'plaza', 'industrial', 'parking']) {
      pools.lot[k] = new Pool([{ geo: lg, mat: M.std('lotp_' + k, { map: T.lot(k), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }) }], { shadow: false });
    }
    for (const key in M.arch) {
      const a = M.arch[key];
      pools.arch[key] = new Pool(a.parts.map((p) => ({ geo: p.geo, mat: p.mat, m: p.m })));
    }
    const t = M.tree;
    pools.tree[0] = new Pool([{ geo: t.trunkG, mat: t.trunkM }, { geo: t.canopyG, mat: t.leafM, colored: true }]);
    pools.tree[1] = new Pool([{ geo: t.trunkG, mat: t.trunkM }, { geo: t.coneG, mat: t.leafM, colored: true }]);
  };

  // ---------- geração do terreno ----------
  W.generate = function (seed) {
    const r = C.rand(seed || 42);
    W.tiles = [];
    for (let i = 0; i < N * N; i++) W.tiles.push({ t: 'empty', zone: null, b: null, svc: 0, fixed: false, water: false, trees: 0 });
    // rio a leste
    for (let z = 0; z < N; z++) {
      const cx = 52 + Math.sin(z / 7) * 3 + Math.sin(z / 3.1) * 0.8;
      const wdt = 1.6 + Math.sin(z / 5) * 0.5;
      for (let x = 0; x < N; x++) if (Math.abs(x - cx) <= wdt) { const tl = W.tiles[idx(x, z)]; tl.t = 'water'; tl.water = true; }
    }
    // lago a noroeste
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const d = Math.hypot((x - 13) / 1.3, z - 11);
      if (d < 3.2 + Math.sin(x * 1.7 + z) * 0.4) { const tl = W.tiles[idx(x, z)]; tl.t = 'water'; tl.water = true; }
    }
    // rodovia regional entrando pelo oeste
    const hz = N / 2;
    for (let x = 0; x < 3; x++) { const tl = W.tiles[idx(x, hz)]; tl.t = 'road'; tl.fixed = true; tl.water = false; }
    // florestas
    for (let k = 0; k < 26; k++) {
      const cx = Math.floor(r() * N), cz = Math.floor(r() * N), rad = 2 + r() * 4;
      if (Math.abs(cz - hz) < 6 && cx < 22) continue;
      for (let z = Math.floor(cz - rad); z <= cz + rad; z++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
        if (!W.inb(x, z)) continue;
        const tl = W.tiles[idx(x, z)];
        if (tl.t !== 'empty') continue;
        const d = Math.hypot(x - cx, z - cz) / rad;
        if (d < 1 && r() > d * 0.7) tl.trees = 1 + Math.floor(r() * 3);
      }
    }
    W.buildTerrain();
    W.recompute();
  };

  let groundMesh, waterMesh, outerGround, hwMesh, overlayMesh, overlayCanvas, overlayTex;
  W.buildTerrain = function () {
    if (groundMesh) { scene.remove(groundMesh); groundMesh.material.map.dispose(); }
    const gt = T.ground(W.tiles, N);
    groundMesh = new THREE.Mesh(M.plane(N * TS, N * TS), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }));
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    if (!outerGround) {
      const tex = T.grass().clone(); tex.needsUpdate = true; tex.repeat.set(40, 40);
      outerGround = new THREE.Mesh(M.plane(N * TS * 10, N * TS * 10), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
      outerGround.position.y = -0.05;
      outerGround.receiveShadow = true;
      scene.add(outerGround);
      // extensão visual da rodovia até o horizonte
      const ht = T.road(10).clone(); ht.needsUpdate = true; ht.wrapS = THREE.RepeatWrapping; ht.repeat.set(120, 1);
      hwMesh = new THREE.Mesh(M.plane(TS * 120, TS), new THREE.MeshStandardMaterial({ map: ht, roughness: 0.9 }));
      hwMesh.position.set(-N / 2 * TS - TS * 60, 0.02, (N / 2 - N / 2 + 0.5) * TS);
      hwMesh.receiveShadow = true;
      scene.add(hwMesh);
      // florestas decorativas ao redor do mapa
      const r = C.rand(99), t = M.tree;
      const outer = [new Pool([{ geo: t.trunkG, mat: t.trunkM }, { geo: t.canopyG, mat: t.leafM, colored: true }]), new Pool([{ geo: t.trunkG, mat: t.trunkM }, { geo: t.coneG, mat: t.leafM, colored: true }])];
      const lim = N * TS / 2 + 6;
      let k = 0;
      for (let c = 0; c < 70; c++) {
        const a = r() * Math.PI * 2, d = lim + 20 + r() * 260;
        const cx = Math.cos(a) * d, cz = Math.sin(a) * d, rad = 10 + r() * 30;
        const cnt = 20 + Math.floor(r() * 40);
        for (let i = 0; i < cnt; i++) {
          const x = cx + (r() - 0.5) * rad * 2, z = cz + (r() - 0.5) * rad * 2;
          if (Math.abs(x) < lim && Math.abs(z) < lim) continue;
          if (Math.abs(z - 2) < 6 && x < 0) continue; // rodovia
          const s = 0.9 + r() * 1.2;
          const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6.28, 0)), new THREE.Vector3(s, s, s));
          const col = new THREE.Color().setHSL(0.22 + r() * 0.1, 0.4 + r() * 0.2, 0.2 + r() * 0.1);
          outer[r() < 0.4 ? 1 : 0].set('o' + k++, m, col);
        }
      }
      outer.forEach((p) => p.update());
    }
    // água
    if (waterMesh) scene.remove(waterMesh);
    const pos = [], uv = [];
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      if (!W.tiles[idx(x, z)].water) continue;
      const x0 = (x - N / 2) * TS, z0 = (z - N / 2) * TS, x1 = x0 + TS, z1 = z0 + TS;
      pos.push(x0, 0, z0, x0, 0, z1, x1, 0, z1, x0, 0, z0, x1, 0, z1, x1, 0, z0);
      for (const [a, b] of [[x0, z0], [x0, z1], [x1, z1], [x0, z0], [x1, z1], [x1, z0]]) uv.push(a / 24, b / 24);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const wt = T.water();
    waterMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: wt, roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.9, envMapIntensity: 1.2 }));
    waterMesh.position.y = 0.05;
    waterMesh.receiveShadow = true;
    scene.add(waterMesh);

    // camada de mapas de dados
    if (!overlayMesh) {
      overlayCanvas = C.canvas(N, N);
      overlayTex = new THREE.CanvasTexture(overlayCanvas);
      overlayTex.magFilter = THREE.NearestFilter; overlayTex.minFilter = THREE.NearestFilter;
      overlayMesh = new THREE.Mesh(M.plane(N * TS, N * TS), new THREE.MeshBasicMaterial({ map: overlayTex, transparent: true, depthWrite: false, opacity: 0.6 }));
      overlayMesh.position.y = 0.3; overlayMesh.renderOrder = 5; overlayMesh.visible = false;
      scene.add(overlayMesh);
    }
  };

  W.setOverlay = function (fn) {
    if (!fn) { overlayMesh.visible = false; return; }
    const g = overlayCanvas.getContext('2d');
    g.clearRect(0, 0, N, N);
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const c = fn(x, z);
      if (c) { g.fillStyle = c; g.fillRect(x, z, 1, 1); }
    }
    overlayTex.needsUpdate = true;
    overlayMesh.visible = true;
  };

  // ---------- conectividade de ruas ----------
  W.recompute = function () {
    W.connected.fill(0);
    const q = [];
    for (let i = 0; i < N * N; i++) if (W.tiles[i].fixed) { W.connected[i] = 1; q.push(i); }
    while (q.length) {
      const i = q.pop(), x = i % N, z = (i / N) | 0;
      for (const [dx, dz] of DIRS) {
        const nx = x + dx, nz = z + dz;
        if (!W.inb(nx, nz)) continue;
        const j = idx(nx, nz);
        if (!W.connected[j] && W.tiles[j].t === 'road') { W.connected[j] = 1; q.push(j); }
      }
    }
    roadsDirty = true;
    W.version++;
  };

  W.isRoad = (x, z) => { const t = W.get(x, z); return !!t && t.t === 'road'; };
  W.roadMask = function (x, z) {
    let m = 0;
    for (const [dx, dz, b] of DIRS) if (W.isRoad(x + dx, z + dz)) m |= b;
    if (x === 0 && W.get(x, z).fixed) m |= 8;
    return m;
  };
  // há rua conectada a até `dist` lotes (distância de Manhattan)?
  W.access = function (x, z, dist) {
    dist = dist || 2;
    for (let dz = -dist; dz <= dist; dz++) for (let dx = -dist; dx <= dist; dx++) {
      if (Math.abs(dx) + Math.abs(dz) > dist || (dx === 0 && dz === 0)) continue;
      const nx = x + dx, nz = z + dz;
      if (W.inb(nx, nz) && W.connected[idx(nx, nz)]) return true;
    }
    return false;
  };
  // direção da rua adjacente mais próxima (rot 0=S,1=L,2=N,3=O)
  W.faceRoad = function (x, z) {
    const order = [[0, 1, 0], [1, 0, 1], [0, -1, 2], [-1, 0, 3]];
    for (const [dx, dz, r] of order) if (W.isRoad(x + dx, z + dz)) return r;
    for (const [dx, dz, r] of order) if (W.isRoad(x + dx * 2, z + dz * 2)) return r;
    return Math.floor(C.hash(x, z, 9) * 4);
  };

  // ---------- operações ----------
  function clearTile(t) { t.trees = 0; treesDirty = true; }

  W.setRoad = function (x, z) {
    const t = W.get(x, z);
    if (!t || t.t === 'road' || t.t === 'svc' || t.b) return false;
    if (t.zone) { t.zone = null; zonesDirty = true; }
    clearTile(t);
    t.t = 'road';
    return true;
  };
  W.setZone = function (x, z, zone) {
    const t = W.get(x, z);
    if (!t || (t.t !== 'empty' && t.t !== 'zone') || t.b) return false;
    if (t.zone === zone) return false;
    if (zone && t.trees) clearTile(t);
    t.zone = zone; t.t = zone ? 'zone' : 'empty';
    zonesDirty = true;
    return true;
  };
  W.addTrees = function (x, z, n) {
    const t = W.get(x, z);
    if (!t || t.t !== 'empty' || t.trees >= 3) return false;
    t.trees = Math.min(3, t.trees + (n || 2));
    treesDirty = true;
    return true;
  };

  W.setBuilding = function (x, z, b) {
    const t = W.get(x, z);
    if (t.b) W.clearBuilding(x, z, true);
    clearTile(t);
    t.b = b; t.t = 'zone'; t.zone = b.zone;
    const key = idx(x, z), m = tileMatrix(x, z, b.rot);
    pools.arch[b.arch].set(key, m);
    pools.lot[M.arch[b.arch].lot].set(key, m);
    zonesDirty = true;
    W.version++;
  };
  W.clearBuilding = function (x, z, keepZone) {
    const t = W.get(x, z);
    if (!t || !t.b) return;
    const key = idx(x, z);
    pools.arch[t.b.arch].del(key);
    pools.lot[M.arch[t.b.arch].lot].del(key);
    t.b = null;
    if (!keepZone) { t.zone = null; t.t = 'empty'; }
    zonesDirty = true;
    W.version++;
  };

  W.footprint = function (type, x0, z0, rot) {
    const it = C.CATALOG[type];
    let w = it.w || 1, h = it.h || 1;
    if (rot % 2) { const s = w; w = h; h = s; }
    return { x0, z0, w, h };
  };
  W.canPlace = function (type, x0, z0, rot) {
    const f = W.footprint(type, x0, z0, rot);
    for (let z = f.z0; z < f.z0 + f.h; z++) for (let x = f.x0; x < f.x0 + f.w; x++) {
      const t = W.get(x, z);
      if (!t || t.water || t.b || (t.t !== 'empty' && t.t !== 'zone')) return false;
    }
    return true;
  };
  W.svcHasRoad = function (s) {
    for (let z = s.z0 - 1; z <= s.z0 + s.h; z++) for (let x = s.x0 - 1; x <= s.x0 + s.w; x++) {
      if (W.inb(x, z) && W.connected[idx(x, z)]) return true;
    }
    return false;
  };
  W.placeService = function (type, x0, z0, rot, id) {
    const f = W.footprint(type, x0, z0, rot);
    id = id || nextSvc++;
    nextSvc = Math.max(nextSvc, id + 1);
    for (let z = f.z0; z < f.z0 + f.h; z++) for (let x = f.x0; x < f.x0 + f.w; x++) {
      const t = W.get(x, z);
      clearTile(t); t.zone = null; t.t = 'svc'; t.svc = id;
    }
    zonesDirty = true;
    const g = C.models.svc[type]();
    const cx = (f.x0 + f.w / 2 - N / 2) * TS, cz = (f.z0 + f.h / 2 - N / 2) * TS;
    g.position.set(cx, 0, cz);
    g.rotation.y = rot * Math.PI / 2;
    g.traverse((o) => { if (o.isMesh) { o.castShadow = o.castShadow !== false; o.receiveShadow = true; } });
    g.userData.svcId = id;
    scene.add(g);
    const s = { id, type, x0: f.x0, z0: f.z0, w: f.w, h: f.h, rot, group: g, active: true };
    W.services.set(id, s);
    W.version++;
    return s;
  };
  W.removeService = function (id) {
    const s = W.services.get(id);
    if (!s) return;
    for (let z = s.z0; z < s.z0 + s.h; z++) for (let x = s.x0; x < s.x0 + s.w; x++) {
      const t = W.get(x, z); t.t = 'empty'; t.svc = 0;
    }
    scene.remove(s.group);
    W.services.delete(id);
    W.version++;
  };
  W.bulldoze = function (x, z) {
    const t = W.get(x, z);
    if (!t) return false;
    if (t.t === 'road') {
      if (t.fixed) return false;
      t.t = t.water ? 'water' : 'empty';
      return true;
    }
    if (t.t === 'svc') { W.removeService(t.svc); return true; }
    if (t.b) { W.clearBuilding(x, z); return true; }
    if (t.zone) { t.zone = null; t.t = 'empty'; zonesDirty = true; return true; }
    if (t.trees) { t.trees = 0; treesDirty = true; return true; }
    return false;
  };
  W.isFree = (x, z) => { const t = W.get(x, z); return !!t && !t.water && t.t === 'empty'; };

  // ---------- atualização visual ----------
  const _col = new THREE.Color();
  function rebuildRoads() {
    for (const p of pools.road) p.clear();
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const t = W.tiles[idx(x, z)];
      if (t.t !== 'road') continue;
      pools.road[W.roadMask(x, z)].set(idx(x, z), tileMatrix(x, z, 0, t.water ? 0.12 : 0.06));
    }
  }
  function rebuildZones() {
    for (const k in pools.zone) pools.zone[k].clear();
    for (let i = 0; i < N * N; i++) {
      const t = W.tiles[i];
      if (t.zone && !t.b && t.t === 'zone') pools.zone[t.zone].set(i, tileMatrix(i % N, (i / N) | 0, 0, 0.09));
    }
  }
  function rebuildTrees() {
    pools.tree[0].clear(); pools.tree[1].clear();
    for (let i = 0; i < N * N; i++) {
      const t = W.tiles[i];
      if (!t.trees || t.t !== 'empty') continue;
      const x = i % N, z = (i / N) | 0;
      for (let k = 0; k < t.trees; k++) {
        const h1 = C.hash(x, z, k * 3 + 1), h2 = C.hash(x, z, k * 3 + 2), h3 = C.hash(x, z, k * 3 + 3);
        const p = W.center(x, z);
        p.x += (h1 - 0.5) * TS * 0.7; p.z += (h2 - 0.5) * TS * 0.7;
        const s = 0.8 + h3 * 0.9;
        const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, h1 * 6.28, 0)), new THREE.Vector3(s, s, s));
        const kind = h3 > 0.65 ? 1 : 0;
        _col.setHSL(0.22 + h2 * 0.1, 0.42 + h1 * 0.2, 0.22 + h3 * 0.1);
        pools.tree[kind].set(i * 4 + k, m, _col.clone());
      }
    }
  }
  W.markTrees = () => { treesDirty = true; };
  W.markZones = () => { zonesDirty = true; };
  W.markRoads = () => { roadsDirty = true; };

  W.update = function (dt, time) {
    if (roadsDirty) { rebuildRoads(); roadsDirty = false; }
    if (zonesDirty) { rebuildZones(); zonesDirty = false; }
    if (treesDirty) { rebuildTrees(); treesDirty = false; }
    for (const p of pools.road) p.update();
    for (const k in pools.zone) pools.zone[k].update();
    for (const k in pools.lot) pools.lot[k].update();
    for (const k in pools.arch) pools.arch[k].update();
    pools.tree[0].update(); pools.tree[1].update();
    if (waterMesh) { waterMesh.material.map.offset.set(time * 0.012, time * 0.007); }
    // turbinas e fumaça
    for (const s of W.services.values()) {
      const u = s.group.userData;
      if (u.rotor) u.rotor.rotation.z += dt * (s.active ? 1.6 : 0.2);
      if (u.smoke && s.active) {
        u.smokeT = (u.smokeT || 0) + dt;
        if (u.smokeT > 0.35) { u.smokeT = 0; for (const e of u.smoke) spawnSmoke(s.group.localToWorld(e.clone())); }
      }
    }
    updateSmoke(dt);
  };

  // ---------- fumaça ----------
  const smoke = [];
  let smokeMat;
  function spawnSmoke(p) {
    if (smoke.length > 160) return;
    if (!smokeMat) smokeMat = new THREE.SpriteMaterial({ map: T.puff(), color: 0xdddddd, transparent: true, depthWrite: false, opacity: 0.6 });
    const s = new THREE.Sprite(smokeMat.clone());
    s.position.copy(p); s.scale.setScalar(1);
    s.userData = { life: 0, vx: 0.4 + Math.random() * 0.3, vz: 0.15 * (Math.random() - 0.5) };
    scene.add(s); smoke.push(s);
  }
  function updateSmoke(dt) {
    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i], u = s.userData;
      u.life += dt;
      s.position.y += dt * 1.4; s.position.x += dt * u.vx; s.position.z += dt * u.vz;
      s.scale.setScalar(1 + u.life * 1.5);
      s.material.opacity = Math.max(0, 0.55 * (1 - u.life / 5));
      if (u.life > 5) { scene.remove(s); s.material.dispose(); smoke.splice(i, 1); }
    }
  }

  W.reset = function () {
    for (const s of [...W.services.keys()]) W.removeService(s);
    for (const k in pools.arch) pools.arch[k].clear();
    for (const k in pools.lot) pools.lot[k].clear();
  };
})();
