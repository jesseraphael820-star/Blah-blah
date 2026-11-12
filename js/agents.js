/* Moradores e carros circulando pelas ruas (instanciados, visíveis de longe) */
(function () {
  const C = window.CITY, N = C.N, TS = C.TS;
  const A = (C.agents = {});
  let W;
  const CAP_P = 800, CAP_C = 360;
  let pBody, pHead, cBody, cCab, cLight;
  const people = [], cars = [];
  A.scale = 1;

  const SHIRTS = ['#d64545', '#3d7dd8', '#f2c94c', '#27ae60', '#ffffff', '#9b51e0', '#f2994a', '#2d9cdb', '#eb5757', '#111111', '#e0e0e0', '#56ccf2'];
  const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0673c'];
  const CARS = ['#c0392b', '#ecf0f1', '#2c3e50', '#7f8c8d', '#2980b9', '#f1c40f', '#16a085', '#111418', '#d35400', '#bdc3c7', '#8e44ad'];

  function inst(geo, mat, cap) {
    const m = new THREE.InstancedMesh(geo, mat, cap);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    m.count = 0; m.frustumCulled = false; m.castShadow = true;
    return m;
  }

  A.init = function (scene) {
    W = C.world;
    const prof = [[0, 0], [0.035, 0], [0.04, 0.15], [0.056, 0.17], [0.062, 0.26], [0.046, 0.29], [0.018, 0.3], [0, 0.3]].map(([r, y]) => new THREE.Vector2(r, y));
    const bodyG = new THREE.LatheGeometry(prof, 8);
    const headG = new THREE.SphereGeometry(0.045, 8, 6); headG.translate(0, 0.34, 0);
    pBody = inst(bodyG, new THREE.MeshStandardMaterial({ roughness: 0.8 }), CAP_P);
    pHead = inst(headG, new THREE.MeshStandardMaterial({ roughness: 0.7 }), CAP_P);
    const cb = new THREE.BoxGeometry(0.5, 0.2, 1.05); cb.translate(0, 0.17, 0);
    const cc = new THREE.BoxGeometry(0.44, 0.17, 0.56); cc.translate(0, 0.355, -0.05);
    const cl = new THREE.BoxGeometry(0.42, 0.05, 0.03); cl.translate(0, 0.2, 0.53);
    cBody = inst(cb, new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.5 }), CAP_C);
    cCab = inst(cc, new THREE.MeshStandardMaterial({ color: '#1a2129', roughness: 0.1, metalness: 0.7 }), CAP_C);
    const lightMat = new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: new THREE.Color('#fff2c0'), emissiveIntensity: 0 });
    C.nightMats.push(lightMat);
    cLight = new THREE.InstancedMesh(cl, lightMat, CAP_C); cLight.count = 0; cLight.frustumCulled = false;
    scene.add(pBody, pHead, cBody, cCab, cLight);
  };

  function roadTiles() {
    const list = [];
    for (let i = 0; i < N * N; i++) if (W.connected[i] && W.tiles[i].t === 'road') list.push(i);
    return list;
  }
  let cachedVersion = -1, cachedRoads = [];
  function getRoads() {
    if (cachedVersion !== W.version) { cachedRoads = roadTiles(); cachedVersion = W.version; }
    return cachedRoads;
  }
  const ok = (x, z) => W.inb(x, z) && W.connected[W.idx(x, z)] && W.tiles[W.idx(x, z)].t === 'road';

  function chooseNext(a) {
    const opts = [];
    for (const [dx, dz] of W.DIRS) {
      const nx = a.x + dx, nz = a.z + dz;
      if (ok(nx, nz) && !(nx === a.px && nz === a.pz)) opts.push([nx, nz]);
    }
    if (!opts.length) {
      if (ok(a.px, a.pz)) opts.push([a.px, a.pz]);
      else return false;
    }
    const o = opts[Math.floor(Math.random() * opts.length)];
    a.nx = o[0]; a.nz = o[1];
    return true;
  }
  function spawn(list, kind) {
    const roads = getRoads();
    if (roads.length < 2) return null;
    const i = roads[Math.floor(Math.random() * roads.length)];
    const a = { x: i % N, z: (i / N) | 0, px: -9, pz: -9, nx: 0, nz: 0, t: Math.random(), kind };
    if (!chooseNext(a)) return null;
    a.pdx = a.nx - a.x; a.pdz = a.nz - a.z;
    if (kind === 'p') {
      a.speed = 0.55 + Math.random() * 0.35; a.side = Math.random() < 0.5 ? 1 : -1; a.off = 1.55 + Math.random() * 0.2;
      a.c1 = new THREE.Color(SHIRTS[Math.floor(Math.random() * SHIRTS.length)]);
      a.c2 = new THREE.Color(SKIN[Math.floor(Math.random() * SKIN.length)]);
      a.ph = Math.random() * 6;
    } else {
      a.speed = 2.6 + Math.random() * 1.6; a.side = 1; a.off = 0.62;
      a.c1 = new THREE.Color(CARS[Math.floor(Math.random() * CARS.length)]);
    }
    list.push(a);
    return a;
  }

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
  const ca = new THREE.Vector3(), cb2 = new THREE.Vector3();
  let lastVersion = -1;

  function step(list, dt) {
    for (let k = list.length - 1; k >= 0; k--) {
      const a = list[k];
      a.t += a.speed * dt / TS;
      while (a.t >= 1) {
        a.t -= 1;
        a.pdx = a.nx - a.x; a.pdz = a.nz - a.z;
        a.px = a.x; a.pz = a.z; a.x = a.nx; a.z = a.nz;
        if (!chooseNext(a)) { list.splice(k, 1); break; }
      }
    }
  }
  function place(a, out) {
    W.center(a.x, a.z, ca); W.center(a.nx, a.nz, cb2);
    const dx = a.nx - a.x, dz = a.nz - a.z;
    const f = Math.min(1, a.t / 0.5);
    // suaviza a curva: mistura a direção anterior com a atual
    const sdx = a.pdx + (dx - a.pdx) * f, sdz = a.pdz + (dz - a.pdz) * f;
    const len = Math.hypot(sdx, sdz) || 1;
    const perpX = (-sdz / len) * a.side * a.off, perpZ = (sdx / len) * a.side * a.off;
    out.set(ca.x + (cb2.x - ca.x) * a.t + perpX, 0.07, ca.z + (cb2.z - ca.z) * a.t + perpZ);
    return Math.atan2(sdx, sdz);
  }

  A.update = function (dt, simSpeed, camDist) {
    if (!pBody) return;
    const S = C.sim;
    if (W.version !== lastVersion) {
      lastVersion = W.version;
      for (const list of [people, cars]) for (let k = list.length - 1; k >= 0; k--) {
        const a = list[k];
        if (!ok(a.x, a.z) || !ok(a.nx, a.nz)) list.splice(k, 1);
      }
    }
    const wantP = Math.min(CAP_P, Math.round(S.pop / 5 + (S.pop > 0 ? 12 : 0)));
    const wantC = Math.min(CAP_C, Math.round((S.pop + S.jobsC + S.jobsI) / 14 + (S.pop > 0 ? 6 : 0)));
    for (let i = 0; i < 6 && people.length < wantP; i++) if (!spawn(people, 'p')) break;
    for (let i = 0; i < 4 && cars.length < wantC; i++) if (!spawn(cars, 'c')) break;
    while (people.length > wantP + 10) people.pop();
    while (cars.length > wantC + 10) cars.pop();

    const sdt = simSpeed > 0 ? dt * (0.8 + simSpeed * 0.2) : 0;
    step(people, sdt); step(cars, sdt);

    // moradores maiores quando a câmera está longe — para serem vistos de longe
    A.scale = Math.max(1, Math.min(7, camDist / 34));
    const ps = A.scale, cs = Math.max(1, Math.min(2.2, camDist / 90));
    const now = performance.now() / 1000;
    let n = 0;
    for (const a of people) {
      const yaw = place(a, _p);
      _p.y = 0.07 + (sdt > 0 ? Math.abs(Math.sin(now * 9 + a.ph)) * 0.025 : 0);
      _q.setFromEuler(_e.set(0, yaw, 0)); _s.set(ps, ps, ps);
      _m.compose(_p, _q, _s);
      pBody.setMatrixAt(n, _m); pHead.setMatrixAt(n, _m);
      pBody.setColorAt(n, a.c1); pHead.setColorAt(n, a.c2);
      n++;
    }
    pBody.count = pHead.count = n;
    pBody.instanceMatrix.needsUpdate = pHead.instanceMatrix.needsUpdate = true;
    pBody.instanceColor.needsUpdate = pHead.instanceColor.needsUpdate = true;
    n = 0;
    for (const a of cars) {
      const yaw = place(a, _p);
      _q.setFromEuler(_e.set(0, yaw, 0)); _s.set(cs, cs, cs);
      _m.compose(_p, _q, _s);
      cBody.setMatrixAt(n, _m); cCab.setMatrixAt(n, _m); cLight.setMatrixAt(n, _m);
      cBody.setColorAt(n, a.c1);
      n++;
    }
    cBody.count = cCab.count = cLight.count = n;
    cBody.instanceMatrix.needsUpdate = cCab.instanceMatrix.needsUpdate = cLight.instanceMatrix.needsUpdate = true;
    cBody.instanceColor.needsUpdate = true;
  };
  A.counts = () => ({ people: people.length, cars: cars.length });
})();
