/* Núcleo do jogo: renderer, câmera, entrada, ferramentas, dia/noite, loop, salvar/carregar */
(function () {
  const C = window.CITY, N = C.N, TS = C.TS;
  const W = C.world, S = C.sim, CAT = C.CATALOG, UI = C.ui, M = C.models;
  const G = (C.game = { tool: null, speed: 1, map: null, dayMode: 'auto', tod: 0.36 });
  const SPEEDS = [0, 1, 2.5, 6];
  const SAVE_KEY = 'metropolis_save_v1';

  const canvas = document.getElementById('view');
  let renderer, scene, camera, sun, hemi, skyMesh, skyU;

  // ======================= renderer / cena =======================
  function initRenderer() {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    C.maxAniso = renderer.capabilities.getMaxAnisotropy();

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xcfe2ee, 320, 1150);
    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 2600);

    // céu com gradiente e sol
    skyU = {
      top: { value: new THREE.Color('#3d7cc9') }, horizon: { value: new THREE.Color('#cfe2ee') }, bottom: { value: new THREE.Color('#7d8a70') },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color('#fff2d8') }
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vW;
        void main(){ vec3 d = normalize(vW - cameraPosition); float h = d.y;
          vec3 c = h > 0.0 ? mix(horizon, top, pow(min(1.0, h*1.8), 0.6)) : mix(horizon, bottom, min(1.0, -h*5.0));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          c += sunCol * (pow(s, 900.0) * 3.0 + pow(s, 12.0) * 0.22);
          gl_FragColor = vec4(c, 1.0); }`
    });
    skyMesh = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), skyMat);
    skyMesh.frustumCulled = false;
    scene.add(skyMesh);

    // mapa de ambiente (reflexos nos vidros)
    const pm = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ map: C.tex.sky(), side: THREE.BackSide })));
    const sunBall = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    sunBall.position.set(20, 30, 15); envScene.add(sunBall);
    C.envMap = pm.fromScene(envScene, 0.02).texture;
    scene.environment = C.envMap;
    pm.dispose();

    hemi = new THREE.HemisphereLight(0xd6e8ff, 0x5c6a48, 0.5);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff4e6, 2.2);
    sun.castShadow = true;
    const ms = renderer.capabilities.maxTextureSize >= 8192 ? 4096 : 2048;
    sun.shadow.mapSize.set(ms, ms);
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 600;
    scene.add(sun, sun.target);
  }

  // ======================= câmera =======================
  const cam = { tx: -78, tz: 6, dist: 95, yaw: -0.75, pitch: 0.82 };
  const camT = Object.assign({}, cam);
  const HALF = N * TS / 2;
  function clampCam(c) {
    c.tx = Math.max(-HALF - 20, Math.min(HALF + 20, c.tx));
    c.tz = Math.max(-HALF - 20, Math.min(HALF + 20, c.tz));
    c.dist = Math.max(10, Math.min(340, c.dist));
    c.pitch = Math.max(0.22, Math.min(1.45, c.pitch));
  }
  function applyCam() {
    const cp = Math.cos(cam.pitch);
    camera.position.set(cam.tx + Math.sin(cam.yaw) * cp * cam.dist, Math.sin(cam.pitch) * cam.dist, cam.tz + Math.cos(cam.yaw) * cp * cam.dist);
    camera.lookAt(cam.tx, 0, cam.tz);
    camera.updateMatrixWorld();
  }
  function updateCam(dt) {
    clampCam(camT);
    const k = 1 - Math.exp(-dt * 9);
    for (const key in cam) cam[key] += (camT[key] - cam[key]) * k;
    applyCam();
  }
  G.flyTo = function (x, z, dist) { camT.tx = x; camT.tz = z; if (dist) camT.dist = dist; };

  const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2();
  function groundAt(cx, cy, out) {
    ndc.set(cx / window.innerWidth * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(ground, out || new THREE.Vector3());
  }
  function tileAt(cx, cy) {
    const p = groundAt(cx, cy);
    if (!p) return null;
    const t = W.toTile(p);
    return W.inb(t.x, t.z) ? t : null;
  }

  // ======================= pré-visualização =======================
  let tileGhost, planTiles, ghostMatOK, ghostMatBad, toolGhost = null, toolGhostId = null;
  const planGroup = new THREE.Group();
  function initGhosts() {
    const g = M.plane(TS * 0.96, TS * 0.96);
    const mk = () => {
      const im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false }), N * N);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * N * 3).fill(1), 3);
      im.count = 0; im.frustumCulled = false; im.renderOrder = 10;
      scene.add(im); return im;
    };
    tileGhost = mk(); planTiles = mk();
    ghostMatOK = new THREE.MeshStandardMaterial({ color: '#6fd6ff', emissive: new THREE.Color('#1b86c4'), emissiveIntensity: 0.7, transparent: true, opacity: 0.6, depthWrite: false, roughness: 0.4 });
    ghostMatBad = new THREE.MeshStandardMaterial({ color: '#ff7a6e', emissive: new THREE.Color('#b0251b'), emissiveIntensity: 0.7, transparent: true, opacity: 0.6, depthWrite: false });
    scene.add(planGroup);
  }
  const _m = new THREE.Matrix4(), _c = new THREE.Color();
  function setTiles(im, list, y) {
    let n = 0;
    for (const [x, z, col] of list) {
      if (n >= N * N) break;
      _m.copy(W.tileMatrix(x, z, 0, y || 0.18));
      im.setMatrixAt(n, _m);
      im.setColorAt(n, _c.set(col));
      n++;
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }
  function makeGhost(id, mat) {
    const it = CAT[id];
    let g;
    if (it.grow) {
      const list = M.archList(it.grow[0], +it.grow[1]);
      const a = M.arch[list[0]];
      g = new THREE.Group();
      for (const p of a.parts) { const m = new THREE.Mesh(p.geo, mat); m.applyMatrix4(p.m); g.add(m); }
    } else {
      g = M.svc[id]();
      g.traverse((o) => { if (o.isMesh) { o.material = mat; o.castShadow = false; o.receiveShadow = false; } });
    }
    g.renderOrder = 11;
    return g;
  }

  G.previewPlan = function (plan) {
    G.clearPreview();
    const list = [];
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
    const ext = (x, z) => { minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); };
    for (const a of plan.actions) {
      if (a.kind === 'road') a.tiles.forEach(([x, z]) => { list.push([x, z, '#2f6fd6']); ext(x, z); });
      else if (a.kind === 'zone') a.tiles.forEach(([x, z]) => { list.push([x, z, CAT['zone' + a.zone].color]); ext(x, z); });
      else if (a.kind === 'trees') a.tiles.forEach(([x, z]) => { list.push([x, z, '#4caf50']); ext(x, z); });
      else if (a.kind === 'place') {
        const f = W.footprint(a.type, a.x0, a.z0, a.rot);
        const g = makeGhost(a.type, ghostMatOK);
        g.position.set((f.x0 + f.w / 2 - N / 2) * TS, 0.05, (f.z0 + f.h / 2 - N / 2) * TS);
        g.rotation.y = (CAT[a.type].grow ? W.faceRoad(a.x0, a.z0) : a.rot) * Math.PI / 2;
        planGroup.add(g);
        for (let z = f.z0; z < f.z0 + f.h; z++) for (let x = f.x0; x < f.x0 + f.w; x++) { list.push([x, z, '#6fd6ff']); ext(x, z); }
      } else if (a.kind === 'bulldoze') {
        const s = W.services.get(a.svc);
        if (s) for (let z = s.z0; z < s.z0 + s.h; z++) for (let x = s.x0; x < s.x0 + s.w; x++) { list.push([x, z, '#ff5a4e']); ext(x, z); }
      }
    }
    setTiles(planTiles, list, 0.2);
    if (minx < 1e9) {
      const cx = ((minx + maxx + 1) / 2 - N / 2) * TS, cz = ((minz + maxz + 1) / 2 - N / 2) * TS;
      const span = Math.max(maxx - minx + 1, maxz - minz + 1) * TS;
      G.flyTo(cx, cz, Math.max(45, Math.min(300, span * 1.6 + 20)));
    }
  };
  G.clearPreview = function () {
    planTiles.count = 0;
    while (planGroup.children.length) planGroup.remove(planGroup.children[0]);
  };

  // ======================= ferramentas =======================
  const kindOf = (id) => (id === 'road' ? 'line' : (id.startsWith('zone') || id === 'dezone' || id === 'bulldoze' || id === 'arvore') ? 'rect' : 'place');
  let toolDrag = null, hover = null, lastPointer = { x: 0, y: 0 };

  G.setTool = function (id) {
    G.tool = id ? { id, kind: kindOf(id), rot: 0 } : null;
    toolDrag = null;
    tileGhost.count = 0;
    if (toolGhost) { scene.remove(toolGhost); toolGhost = null; toolGhostId = null; }
    if (G.tool && G.tool.kind === 'place') { toolGhost = makeGhost(id, ghostMatOK); toolGhostId = id; toolGhost.visible = false; scene.add(toolGhost); }
    UI.refreshTrayTool();
    UI.tooltip(null);
    if (id) UI.hideInfo();
    canvas.style.cursor = id ? 'crosshair' : 'default';
    if (hover) updateToolPreview();
  };

  function lpath(a, b) {
    const out = [], seen = new Set();
    const push = (x, z) => { const k = x + ',' + z; if (!seen.has(k)) { seen.add(k); out.push([x, z]); } };
    const seg = (p, q) => {
      const dx = Math.sign(q.x - p.x), dz = Math.sign(q.z - p.z);
      let x = p.x, z = p.z;
      push(x, z);
      while (x !== q.x || z !== q.z) { x += dx; z += dz; push(x, z); }
    };
    const corner = Math.abs(b.x - a.x) >= Math.abs(b.z - a.z) ? { x: b.x, z: a.z } : { x: a.x, z: b.z };
    seg(a, corner); seg(corner, b);
    return out;
  }
  function rect(a, b) {
    const out = [];
    for (let z = Math.min(a.z, b.z); z <= Math.max(a.z, b.z); z++) for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) out.push([x, z]);
    return out;
  }
  function placeOrigin(id, t, rot) {
    const f = W.footprint(id, 0, 0, rot);
    return { x0: t.x - Math.floor((f.w - 1) / 2), z0: t.z - Math.floor((f.h - 1) / 2), w: f.w, h: f.h };
  }

  function evalTool() {
    const tl = G.tool, id = tl.id, it = CAT[id];
    const res = { tiles: [], cost: 0, n: 0, valid: [] };
    if (tl.kind === 'line') {
      const tiles = toolDrag ? lpath(toolDrag.start, hover) : [[hover.x, hover.z]];
      for (const [x, z] of tiles) {
        const t = W.get(x, z);
        if (!t) continue;
        if (t.t === 'road') { res.tiles.push([x, z, '#cfd8e3']); continue; }
        const ok = (t.t === 'empty' || t.t === 'water' || (t.t === 'zone' && !t.b));
        res.tiles.push([x, z, ok ? '#2f6fd6' : '#ff5a4e']);
        if (ok) { res.valid.push([x, z]); res.cost += C.act.roadCost(x, z); }
      }
      res.n = res.valid.length;
      res.label = `${it.name}: ${res.n} lote${res.n === 1 ? '' : 's'}`;
    } else if (tl.kind === 'rect') {
      const tiles = toolDrag ? rect(toolDrag.start, hover) : [[hover.x, hover.z]];
      for (const [x, z] of tiles) {
        const t = W.get(x, z);
        if (!t) continue;
        let ok = false, col = '#ff5a4e';
        if (it.zone) { ok = (t.t === 'empty' || t.t === 'zone') && !t.b && !t.water && t.zone !== it.zone; col = it.color; }
        else if (id === 'dezone') { ok = t.t === 'zone' && !t.b; col = '#ffffff'; }
        else if (id === 'bulldoze') { ok = (t.t === 'road' && !t.fixed) || t.t === 'svc' || !!t.b || !!t.zone || t.trees > 0; col = '#ff5a4e'; }
        else if (id === 'arvore') { ok = t.t === 'empty' && !t.water && t.trees < 3; col = '#4caf50'; }
        if (ok) { res.valid.push([x, z]); res.tiles.push([x, z, col]); }
        else if (!toolDrag) res.tiles.push([x, z, id === 'bulldoze' ? '#888888' : '#ff5a4e']);
      }
      res.n = res.valid.length;
      res.cost = res.n * (it.cost || 0);
      res.label = `${it.name}: ${res.n} lote${res.n === 1 ? '' : 's'}`;
    } else {
      const o = placeOrigin(id, hover, it.grow ? 0 : tl.rot);
      res.origin = o;
      let ok = W.canPlace(id, o.x0, o.z0, it.grow ? 0 : tl.rot);
      if (it.unique && [...W.services.values()].some((s) => s.type === id)) { ok = false; res.why = 'Só pode existir um(a)'; }
      let road = false;
      for (let z = o.z0 - 1; z <= o.z0 + o.h; z++) for (let x = o.x0 - 1; x <= o.x0 + o.w; x++) if (W.inb(x, z) && W.connected[W.idx(x, z)]) road = true;
      for (let z = o.z0; z < o.z0 + o.h; z++) for (let x = o.x0; x < o.x0 + o.w; x++) res.tiles.push([x, z, ok ? '#6fd6ff' : '#ff5a4e']);
      res.ok = ok; res.road = road; res.cost = it.cost; res.n = ok ? 1 : 0;
      res.label = it.name + (ok && !road ? ' <span class="bad">(sem rua conectada)</span>' : '') + (!ok ? ` <span class="bad">— ${res.why || 'local ocupado'}</span>` : '');
    }
    return res;
  }

  function updateToolPreview() {
    if (!G.tool || !hover) { tileGhost.count = 0; UI.tooltip(null); if (toolGhost) toolGhost.visible = false; return; }
    const r = evalTool();
    setTiles(tileGhost, r.tiles, 0.16);
    if (toolGhost && r.origin) {
      const o = r.origin;
      toolGhost.visible = true;
      toolGhost.position.set((o.x0 + o.w / 2 - N / 2) * TS, 0.05, (o.z0 + o.h / 2 - N / 2) * TS);
      const it = CAT[G.tool.id];
      toolGhost.rotation.y = (it.grow ? W.faceRoad(hover.x, hover.z) : G.tool.rot) * Math.PI / 2;
      toolGhost.traverse((m) => { if (m.isMesh) m.material = r.ok ? ghostMatOK : ghostMatBad; });
    }
    const afford = S.money >= r.cost;
    const cost = r.cost ? ` · <span class="${afford ? '' : 'bad'}">${S.fmt(r.cost)}</span>` : '';
    UI.tooltip(r.label + cost + (G.tool.kind === 'place' && !CAT[G.tool.id].grow && (CAT[G.tool.id].w || 1) !== (CAT[G.tool.id].h || 1) ? ' · R gira' : ''), lastPointer.x, lastPointer.y);
  }

  function applyTool() {
    const tl = G.tool, id = tl.id;
    const r = evalTool();
    if (tl.kind === 'line') {
      const out = C.act.buildRoads(r.valid);
      if (out.n < r.valid.length) UI.toast('Dinheiro insuficiente para concluir a rua.', 'bad');
    } else if (tl.kind === 'rect') {
      if (CAT[id].zone) C.act.zone(r.valid, CAT[id].zone);
      else if (id === 'dezone') C.act.zone(r.valid, null);
      else if (id === 'bulldoze') C.act.bulldoze(r.valid);
      else if (id === 'arvore') C.act.trees(r.valid);
    } else {
      if (!r.ok) { UI.toast(r.why || 'Não é possível construir aqui.', 'bad'); return; }
      if (S.money < r.cost) { UI.toast('Dinheiro insuficiente.', 'bad'); return; }
      C.act.place(id, r.origin.x0, r.origin.z0, CAT[id].grow ? 0 : tl.rot);
      if (!r.road) UI.toast('Atenção: conecte uma rua para que funcione.', 'warn');
      if (CAT[id].unique) G.setTool(null);
    }
  }

  // ======================= entrada =======================
  const pointers = new Map();
  let drag = null;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastPointer = { x: e.clientX, y: e.clientY };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      toolDrag = null;
      drag = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), a0: Math.atan2(b.y - a.y, b.x - a.x), dist0: camT.dist, yaw0: camT.yaw, my0: (a.y + b.y) / 2, pitch0: camT.pitch };
      return;
    }
    if (e.button === 2 || (e.button === 0 && e.shiftKey)) startPan(e);
    else if (e.button === 1 || (e.button === 0 && e.altKey)) drag = { mode: 'rotate', x: e.clientX, y: e.clientY };
    else if (e.button === 0) {
      const t = tileAt(e.clientX, e.clientY);
      if (G.tool) {
        if (!t) return;
        hover = t;
        if (G.tool.kind === 'place') { applyTool(); updateToolPreview(); }
        else { toolDrag = { start: t }; updateToolPreview(); }
      } else { startPan(e); drag.click = true; drag.sx = e.clientX; drag.sy = e.clientY; }
    }
  });
  function startPan(e) {
    drag = { mode: 'pan', grab: groundAt(e.clientX, e.clientY) };
  }
  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastPointer = { x: e.clientX, y: e.clientY };
    if (drag && drag.mode === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      camT.dist = drag.dist0 * drag.d0 / Math.max(10, d);
      camT.yaw = drag.yaw0 - (ang - drag.a0);
      camT.pitch = drag.pitch0 + ((a.y + b.y) / 2 - drag.my0) * 0.004;
      return;
    }
    if (drag && drag.mode === 'pan' && drag.grab) {
      if (drag.click && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.click = false;
      const p = groundAt(e.clientX, e.clientY);
      if (p) {
        cam.tx += drag.grab.x - p.x; cam.tz += drag.grab.z - p.z;
        clampCam(cam); camT.tx = cam.tx; camT.tz = cam.tz; applyCam();
      }
      return;
    }
    if (drag && drag.mode === 'rotate') {
      camT.yaw -= (e.clientX - drag.x) * 0.006; camT.pitch += (e.clientY - drag.y) * 0.004;
      drag.x = e.clientX; drag.y = e.clientY;
      return;
    }
    const t = tileAt(e.clientX, e.clientY);
    const changed = !hover || !t || t.x !== hover.x || t.z !== hover.z;
    hover = t;
    if (G.tool) { if (changed || !t) updateToolPreview(); else UI.tooltip(document.getElementById('tooltip').innerHTML, e.clientX, e.clientY); }
  });
  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (drag && drag.mode === 'pinch') { if (pointers.size < 2) drag = null; return; }
    if (drag && drag.click) {
      const t = tileAt(e.clientX, e.clientY);
      if (t) UI.showInfo(t.x, t.z); else UI.hideInfo();
    }
    drag = null;
    if (toolDrag && G.tool) { applyTool(); toolDrag = null; updateToolPreview(); }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', () => { if (!toolDrag) { hover = null; updateToolPreview(); } });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const f = Math.exp(Math.sign(e.deltaY) * Math.min(0.35, Math.abs(e.deltaY) * 0.0018));
    // zoom em direção ao cursor
    const p = groundAt(e.clientX, e.clientY);
    const nd = Math.max(10, Math.min(340, camT.dist * f));
    if (p && f < 1) { const k = 1 - nd / camT.dist; camT.tx += (p.x - camT.tx) * k * 0.6; camT.tz += (p.z - camT.tz) * k * 0.6; }
    camT.dist = nd;
  }, { passive: false });

  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    keys.add(e.key.toLowerCase());
    if (e.key === 'Escape') { G.setTool(null); UI.closeTray(); UI.hideInfo(); }
    if (e.key.toLowerCase() === 'r' && G.tool) { G.tool.rot = (G.tool.rot + 1) % 4; updateToolPreview(); }
    if (e.key === ' ') { e.preventDefault(); UI.setSpeed(G.speed === 0 ? 1 : 0); }
    if (e.key === '1' || e.key === '2' || e.key === '3') UI.setSpeed(+e.key);
    if (e.key === 'b' || e.key === 'B') G.setTool('bulldoze');
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  function keyCam(dt) {
    const sp = camT.dist * 1.1 * dt;
    let fx = 0, fz = 0;
    if (keys.has('w') || keys.has('arrowup')) fz -= 1;
    if (keys.has('s') || keys.has('arrowdown')) fz += 1;
    if (keys.has('a') || keys.has('arrowleft')) fx -= 1;
    if (keys.has('d') || keys.has('arrowright')) fx += 1;
    if (fx || fz) {
      const sy = Math.sin(camT.yaw), cy = Math.cos(camT.yaw);
      camT.tx += (fx * cy + fz * sy) * sp; camT.tz += (-fx * sy + fz * cy) * sp;
    }
    if (keys.has('q')) camT.yaw += dt * 1.4;
    if (keys.has('e')) camT.yaw -= dt * 1.4;
    if (keys.has('+') || keys.has('=')) camT.dist *= 1 - dt;
    if (keys.has('-')) camT.dist *= 1 + dt;
  }
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // ======================= mapas de dados =======================
  G.setMap = function (id) { G.map = id; refreshMap(); };
  function refreshMap() {
    const id = G.map;
    if (!id) { W.setOverlay(null); return; }
    W.setOverlay((x, z) => {
      const i = W.idx(x, z), t = W.tiles[i];
      if (id === 'pol') { const v = S.pol[i]; if (v < 1.5) return 'rgba(80,200,120,0.25)'; const k = Math.min(1, v / 40); return `rgba(${Math.round(180 + 60 * k)},${Math.round(200 - 150 * k)},40,${0.35 + k * 0.5})`; }
      if (id === 'lv') { if (t.water) return null; return `hsla(${Math.round(S.lv[i] * 130)},80%,50%,0.6)`; }
      if (id === 'cov') { const n = S.cover.police[i] + S.cover.fire[i] + S.cover.health[i] + S.cover.edu[i]; return n ? `rgba(30,136,229,${0.15 + n * 0.17})` : 'rgba(226,70,59,0.25)'; }
      if (id === 'zones') { if (t.t === 'road') return 'rgba(60,60,60,0.8)'; if (t.zone) return CAT['zone' + t.zone].color; if (t.t === 'svc') return 'rgba(155,81,224,0.85)'; return null; }
      return null;
    });
  }

  // ======================= dia / noite =======================
  const COL = {
    dayTop: new THREE.Color('#3d7cc9'), nightTop: new THREE.Color('#070f22'),
    dayHor: new THREE.Color('#cfe2ee'), nightHor: new THREE.Color('#18264a'), duskHor: new THREE.Color('#f1a46a'),
    dayBot: new THREE.Color('#7d8a70'), nightBot: new THREE.Color('#0d1424'),
    sunWarm: new THREE.Color('#ffc58a'), sunDay: new THREE.Color('#fff4e6'), moon: new THREE.Color('#9db4ff')
  };
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const _sd = new THREE.Vector3(), _md = new THREE.Vector3(0.35, 0.85, 0.4).normalize();
  function dayNight(dt) {
    if (G.dayMode === 'auto') G.tod = (G.tod + dt * SPEEDS[G.speed] / 300) % 1;
    else { const goal = G.dayMode === 'day' ? 0.42 : 0.93; G.tod += (goal - G.tod) * Math.min(1, dt * 2); }
    const e = Math.sin((G.tod - 0.25) * Math.PI * 2) + 0.22;
    const d = smooth(-0.12, 0.3, e);
    const az = G.tod * Math.PI * 2 + 0.6, el = Math.max(0.14, Math.min(1.25, e * 1.1));
    _sd.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();
    const dir = _sd.clone().lerp(_md, 1 - d).normalize();
    const dusk = d * Math.max(0, 1 - Math.abs(e - 0.12) / 0.3);
    sun.color.copy(COL.moon).lerp(COL.sunWarm, d).lerp(COL.sunDay, smooth(0.2, 0.7, e) * d);
    sun.intensity = 0.32 + 1.95 * d;
    hemi.intensity = 0.16 + 0.42 * d;
    skyU.top.value.copy(COL.nightTop).lerp(COL.dayTop, d);
    skyU.horizon.value.copy(COL.nightHor).lerp(COL.dayHor, d).lerp(COL.duskHor, dusk * 0.8);
    skyU.bottom.value.copy(COL.nightBot).lerp(COL.dayBot, d);
    skyU.sunDir.value.copy(_sd);
    skyU.sunCol.value.copy(COL.sunWarm).lerp(COL.sunDay, smooth(0.2, 0.7, e)).multiplyScalar(d);
    scene.fog.color.copy(skyU.horizon.value).convertSRGBToLinear();
    renderer.toneMappingExposure = 0.88 + 0.22 * d;
    const night = 1 - smooth(-0.02, 0.28, e);
    for (const m of C.nightMats) m.emissiveIntensity = m.emissiveMap ? night * 1.5 : 0.35 + night * 1.6;
    for (const m of C.allMats) { if (m.userData.envBase == null) m.userData.envBase = m.envMapIntensity; m.envMapIntensity = m.userData.envBase * (0.12 + 0.88 * d); }
    // sombra segue a câmera
    const half = Math.max(40, Math.min(170, cam.dist * 0.95));
    const sc = sun.shadow.camera;
    if (sc.right !== half) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix(); }
    sun.target.position.set(cam.tx, 0, cam.tz);
    sun.position.set(cam.tx + dir.x * 300, dir.y * 300, cam.tz + dir.z * 300);
    skyMesh.position.copy(camera.position);
  }

  // ======================= salvar / carregar =======================
  G.save = function () {
    const data = {
      v: 1, name: S.name, money: S.money, day: S.day, tax: S.tax, popHist: S.popHist, mile: S.flags.mile || 0, tod: G.tod,
      tiles: W.tiles.map((t) => [t.t, t.zone || 0, t.trees, t.fixed ? 1 : 0, t.water ? 1 : 0, t.b ? [t.b.arch, t.b.level, t.b.rot, +t.b.occ.toFixed(3), t.b.age, t.b.direct ? 1 : 0] : 0]),
      services: [...W.services.values()].map((s) => [s.type, s.x0, s.z0, s.rot, s.id]),
      cam: camT
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch (e) { UI.toast('Não foi possível salvar.', 'bad'); return false; }
  };
  G.hasSave = () => { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } };
  G.load = function () {
    let data;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
    if (!data || data.v !== 1) return false;
    W.reset();
    W.tiles = data.tiles.map((a) => ({ t: a[0] === 'svc' ? 'empty' : a[0], zone: a[1] || null, b: null, svc: 0, fixed: !!a[3], water: !!a[4], trees: a[2] || 0 }));
    W.buildTerrain();
    data.tiles.forEach((a, i) => {
      if (!a[5]) return;
      const [arch, level, rot, occ, age, direct] = a[5];
      if (!M.arch[arch]) return;
      W.setBuilding(i % N, (i / N) | 0, { zone: arch[0], level, arch, rot, occ, age, direct: !!direct });
    });
    for (const [type, x0, z0, rot, id] of data.services) W.placeService(type, x0, z0, rot, id);
    W.recompute(); W.markTrees(); W.markZones();
    Object.assign(S, { name: data.name, money: data.money, day: data.day, tax: data.tax, popHist: data.popHist || [] });
    S.flags.mile = data.mile || 0;
    G.tod = data.tod || 0.36;
    if (data.cam) Object.assign(camT, data.cam);
    S.step(); S.day--;
    return true;
  };

  // ======================= loop =======================
  let last = performance.now(), acc = 0, elapsed = 0, mapTimer = 0, lastAutosave = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now; elapsed += dt;
    keyCam(dt);
    updateCam(dt);
    acc += dt * SPEEDS[G.speed];
    let k = 0;
    while (acc >= 1 && k < 8) { S.step(); acc -= 1; k++; }
    if (k >= 8) acc = 0;
    if (S.day - lastAutosave >= 30 && started) { lastAutosave = S.day; G.save(); }
    W.update(dt, elapsed);
    C.agents.update(dt, SPEEDS[G.speed], cam.dist);
    dayNight(dt);
    if (G.map) { mapTimer += dt; if (mapTimer > 1) { mapTimer = 0; refreshMap(); } }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // ======================= início =======================
  let started = false;
  function welcome(isNew) {
    if (isNew) {
      UI.say(`Olá, prefeito(a)! 👋 Eu sou a <b>Iara</b>, a inteligência artificial de <b>${S.name}</b>.<br>A rodovia regional chega pelo <b>oeste</b>. Me peça qualquer obra — eu escolho o melhor lugar, mostro o preço e você decide se <b>confirma</b> ou <b>não</b>.`);
      UI.chips(['Monte uma cidade inicial completa', 'Construa um bairro residencial', 'Ajuda']);
    } else {
      UI.say(`Bem-vindo(a) de volta a <b>${S.name}</b>! Temos ${S.pop.toLocaleString('pt-BR')} habitantes. Em que posso ajudar?`);
      UI.chips(C.ai.advice().chips);
    }
  }
  function boot() {
    initRenderer();
    M.init();
    W.init(scene);
    W.generate(20261112);
    C.agents.init(scene);
    initGhosts();
    UI.init();
    try { UI.makeThumbs(); } catch (e) { console.warn('miniaturas indisponíveis', e); }
    applyCam();
    document.getElementById('loading').classList.add('hidden');
    requestAnimationFrame(frame);
    const modal = document.getElementById('start');
    const btnLoad = document.getElementById('btnLoad');
    if (G.hasSave()) btnLoad.hidden = false;
    UI.setSpeed(0);
    document.getElementById('btnNew').onclick = () => {
      const n = document.getElementById('nameIn').value.trim();
      S.name = n || 'Nova Esperança';
      modal.classList.add('hidden'); started = true;
      UI.setSpeed(1); UI.update(); welcome(true);
    };
    btnLoad.onclick = () => {
      if (G.load()) { modal.classList.add('hidden'); started = true; lastAutosave = S.day; UI.setSpeed(1); UI.update(); welcome(false); }
      else UI.toast('Não foi possível carregar o jogo salvo.', 'bad');
    };
    document.getElementById('nameIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('btnNew').click(); });
    G.debug = { cam, camT, scene, renderer, camera };
  }
  window.addEventListener('load', () => setTimeout(boot, 30));
})();
