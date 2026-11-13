'use strict';
// ===== Detalhes da cidade: mobiliário urbano, semáforos, telhados, outdoors, praia, céu =====
const SEATS = [];       // bancos e pontos de ônibus onde NPCs sentam
const PARK_SPOTS = [];  // vagas de estacionamento
// semáforo: fase por cruzamento (i = rua vertical, j = rua horizontal)
function lightState(i, j) {
  const t = (G.t + ((i * 3 + j * 5) % 9) * 2) % 20;
  if (t < 8) return { ns: 'G', ew: 'R', left: 9 - t };
  if (t < 10) return { ns: 'Y', ew: 'R', left: 10 - t };
  if (t < 18) return { ns: 'R', ew: 'G', left: 19 - t };
  return { ns: 'R', ew: 'Y', left: 20 - t };
}
const VC = () => R3.vcMat || (R3.vcMat = new THREE.MeshLambertMaterial({ vertexColors: true }));
const VC2 = () => R3.vcMat2 || (R3.vcMat2 = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
function instanced(geo, list, matl, shadow) {
  if (!list.length) return null;
  const m = new THREE.InstancedMesh(geo, matl || VC(), list.length), d = new THREE.Object3D();
  list.forEach((o, i) => { d.position.set(o.x, o.h || 0, o.y); d.rotation.set(0, -(o.a || 0), 0); d.scale.setScalar(o.s || 1); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
  if (shadow) m.castShadow = true; m.receiveShadow = true;
  R3.scene.add(m); return m;
}
Object.assign(R3, {
  buildProps() {
    const r = rng(31337);
    const L = { bench: [], bin: [], hydrant: [], mailbox: [], news: [], planter: [], bus: [], cone: [], umbrella: [[], [], []], towel: [] };
    const ringXY = (bx, by, side, u, off) => {
      const S = 288, X = bx * PT + 144, Y = by * PT + 144;
      if (side === 0) return [X + u, Y - off, Math.PI / 2];          // calçada de cima: rua ao norte
      if (side === 1) return [X + S + off, Y + u, Math.PI];          // direita: rua a leste
      if (side === 2) return [X + S - u, Y + S + off, -Math.PI / 2]; // baixo
      return [X - off, Y + S - u, 0];                                // esquerda
    };
    for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
      const d = districtOf(bx, by);
      let busDone = false;
      for (let side = 0; side < 4; side++) {
        for (let u = 34; u < 260; u += 26 + r() * 40) {
          const [x, y, face] = ringXY(bx, by, side, u, 13);
          const k = r();
          const ringP = side * 288 + u;
          if (!busDone && (d === 'downtown' || d === 'suburb') && k < 0.08 && u > 80 && u < 200) {
            busDone = true; const [bx2, by2] = ringXY(bx, by, side, u, 10);
            L.bus.push({ x: bx2, y: by2, a: face + Math.PI });
            SEATS.push({ x: bx2 + Math.cos(face) * 3, y: by2 + Math.sin(face) * 3, a: face + Math.PI, ring: { bx, by, p: ringP }, bus: true });
            addObs({ type: 'c', x: bx2 - Math.cos(face) * 3, y: by2 - Math.sin(face) * 3, r: 6 });
            u += 30; continue;
          }
          if (k < 0.16) { L.bin.push({ x, y, a: face }); addObs({ type: 'c', x, y, r: 3.5 }); }
          else if (k < 0.26) { L.hydrant.push({ x, y, a: face }); addObs({ type: 'c', x, y, r: 3 }); }
          else if (k < 0.38 && d !== 'industrial') { const [x2, y2] = ringXY(bx, by, side, u, 12); L.bench.push({ x: x2, y: y2, a: face + Math.PI }); SEATS.push({ x: x2 + Math.cos(face + Math.PI) * -1, y: y2 + Math.sin(face + Math.PI) * -1, a: face + Math.PI, ring: { bx, by, p: ringP } }); }
          else if (k < 0.46 && d === 'suburb') { L.mailbox.push({ x, y, a: face }); }
          else if (k < 0.54 && d === 'downtown') { L.news.push({ x, y, a: face }); addObs({ type: 'c', x, y, r: 3 }); }
          else if (k < 0.64 && d === 'downtown') { L.planter.push({ x, y, a: face }); addObs({ type: 'c', x, y, r: 4.5 }); }
          else if (k < 0.68 && d === 'industrial') { L.cone.push({ x, y, a: face }); }
        }
      }
      if (d === 'park') { // bancos ao redor da fonte
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, x = lotX(bx) + 128 + Math.cos(a) * 52, y = lotY(by) + 128 + Math.sin(a) * 52; L.bench.push({ x, y, a: a }); SEATS.push({ x: x + Math.cos(a) * 1, y: y + Math.sin(a) * 1, a: a, park: true }); }
      }
    }
    // praia
    const bx0 = CITY_T * T + 20;
    for (let y = 60; y < WH - 60; y += 70 + r() * 90) {
      const x = bx0 + 20 + r() * 110;
      L.umbrella[Math.floor(r() * 3)].push({ x, y, a: r() * 6 });
      for (let k = 0; k < 2; k++) if (r() < 0.7) L.towel.push({ x: x + rand(-14, 14), y: y + rand(8, 18) * (k ? 1 : -1), a: r() * 0.6, c: pick(['#e84a4a', '#4ab0e8', '#f2c21a', '#ffffff', '#5ad06a', '#e86ab0']) });
    }
    // vagas de estacionamento
    for (const d of DECOS) if (d.type === 'park') for (let x = d.x + 15; x < d.x + d.w - 12; x += 30) PARK_SPOTS.push({ x, y: d.y + d.h / 2 + 2, a: Math.PI / 2 + (r() < .5 ? 0 : Math.PI), t: 0 });

    const wood = '#8a5a32', metal = '#3a3d44';
    instanced(mergeGeo([[gB(4.2, 0.9, 16, 0.4, 7.6, 0), wood], [gB(0.9, 5, 16, -1.9, 11.2, 0), wood], [gB(4, 7.6, 1, 0, 3.8, -6.5), metal], [gB(4, 7.6, 1, 0, 3.8, 6.5), metal], [gB(1, 4, 1, -2, 9.5, -6.5), metal], [gB(1, 4, 1, -2, 9.5, 6.5), metal]]), L.bench, null, true);
    instanced(mergeGeo([[gCy(2.6, 2.2, 8, 0, 4, 0, 10), '#2f5a3a'], [gCy(2.9, 2.9, 0.9, 0, 8.3, 0, 10), '#22262a'], [gB(0.3, 2, 2, 2.6, 5, 0), '#e8e8e8']]), L.bin, null, true);
    instanced(mergeGeo([[gCy(1.5, 1.8, 6, 0, 3, 0, 8), '#c82a20'], [gS(1.6, 0, 6, 0, 1, 0.8, 1, 8, 6), '#c82a20'], [new THREE.CylinderGeometry(0.7, 0.7, 4.4, 6).rotateX(Math.PI / 2).translate(0, 4, 0), '#d8d8d8'], [gCy(2.1, 2.1, 0.6, 0, 0.3, 0, 8), '#a8221a']]), L.hydrant, null, true);
    instanced(mergeGeo([[gB(0.8, 6, 0.8, 0, 3, 0), '#555555'], [gB(4, 2.6, 2.6, 0, 7.2, 0), '#2a4aa0'], [gB(0.3, 2, 0.4, 0.4, 9, 1.4), '#d23a2a']]), L.mailbox, null, true);
    instanced(mergeGeo([[gB(3.4, 7, 3.6, 0, 3.5, 0), '#d03a2a'], [gB(0.3, 2.6, 2.6, 1.75, 5, 0), '#cfe4f0'], [gB(3.6, 0.5, 3.8, 0, 7.2, 0), '#22262a']]), L.news, null, true);
    instanced(mergeGeo([[gB(7, 3.4, 7, 0, 1.7, 0), '#9a968c'], [gS(3.8, 0, 5.4, 0, 1, 0.8, 1, 7, 5), '#3a7a30'], [gS(2.2, 1.2, 7.6, 1, 1, 1, 1, 6, 4), '#d84a6a']]), L.planter, null, true);
    instanced(mergeGeo([[new THREE.ConeGeometry(1.8, 5, 8).translate(0, 2.5, 0), '#ff6a1a'], [gCy(1.15, 1.35, 1, 0, 2.6, 0, 8), '#ffffff'], [gB(4, 0.5, 4, 0, 0.25, 0), '#ff6a1a']]), L.cone, null, true);
    const busTex = textTex('ÔNIBUS', '#1a6ad0', '#fff', 128, 48);
    instanced(mergeGeo([
      [gB(12, 0.8, 30, 0, 18, 0), '#c8d0d8'], [gB(0.5, 12, 28, -5, 9.5, 0), '#9cc4d6'], [gB(9, 12, 0.5, 0, 9.5, -14), '#9cc4d6'],
      [gB(1, 18, 1, -5, 9, -14.5), metal], [gB(1, 18, 1, -5, 9, 14.5), metal], [gB(1, 18, 1, 4.5, 9, -14.5), metal], [gB(1, 18, 1, 4.5, 9, 14.5), metal],
      [gB(3.8, 0.9, 20, -2.6, 7.6, 2), wood], [gB(1, 3, 20, -4.4, 10, 2), wood], [gB(0.6, 21, 0.6, 6, 10.5, 13), metal], [gB(0.5, 4.6, 4.6, 6, 20, 13), '#1a6ad0'],
      [gB(0.3, 9, 7, -4.6, 10, -8), '#e8d070'],
    ]), L.bus, null, true);
    // guarda-sóis e toalhas
    const umb = ['#e83a3a', '#2a8ae8', '#f2c21a'];
    L.umbrella.forEach((lst, i) => instanced(mergeGeo([[gCy(0.4, 0.4, 17, 0, 8.5, 0, 6), '#eeeeee'], [new THREE.ConeGeometry(12, 4, 10).translate(0, 18, 0), umb[i]], [new THREE.ConeGeometry(4, 1.5, 10).translate(0, 20.5, 0), '#ffffff']]), lst, null, true));
    if (L.towel.length) { const tm = new THREE.InstancedMesh(new THREE.BoxGeometry(18, 0.4, 9), new THREE.MeshLambertMaterial(), L.towel.length), d = new THREE.Object3D(), c = new THREE.Color(); L.towel.forEach((o, i) => { d.position.set(o.x, 0.3, o.y); d.rotation.set(0, o.a, 0); d.updateMatrix(); tm.setMatrixAt(i, d.matrix); tm.setColorAt(i, c.set(o.c)); }); tm.receiveShadow = true; this.scene.add(tm); }
    this.buildBeach(); this.buildCurbs(); this.buildSignals(); this.buildBuildingDetails(); this.buildSky();
  },
  buildCurbs() {
    const P = [];
    for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
      const x0 = bx * PT + 128, y0 = by * PT + 128, s = 320;
      P.push([gB(s, 2.2, 2, x0 + s / 2, 1.1, y0), '#b8b4aa'], [gB(s, 2.2, 2, x0 + s / 2, 1.1, y0 + s), '#b8b4aa'], [gB(2, 2.2, s, x0, 1.1, y0 + s / 2), '#b8b4aa'], [gB(2, 2.2, s, x0 + s, 1.1, y0 + s / 2), '#b8b4aa']);
    }
    const m = new THREE.Mesh(mergeGeo(P), VC()); m.receiveShadow = true; this.scene.add(m);
  },
  buildSignals() {
    const poles = [], lamps = [];
    for (let j = 0; j <= NB; j++) for (let i = 0; i <= NB; i++) {
      const corners = [[i * PT + 134, j * PT + 134], [i * PT - 6, j * PT - 6]];
      for (const [x, y] of corners) {
        if (x < 40 || y < 40 || x > CITY_T * T - 40 || y > WH - 40) continue;
        poles.push({ x, y, a: 0 });
        // EW: lâmpadas olhando ±X ; NS: lâmpadas olhando ±Z
        for (const ax of ['ew', 'ns']) for (const sg of [-1, 1]) for (let k = 0; k < 3; k++) {
          const lx = ax === 'ew' ? x + sg * 2 : x, ly = ax === 'ns' ? y + sg * 2 : y;
          lamps.push({ x: lx + (ax === 'ns' ? 3.2 * (k - 1) * 0 : 0), y: ly, h: 41 - k * 3.2 + (ax === 'ns' ? -11 : 0), i, j, ax, k });
        }
      }
    }
    instanced(mergeGeo([[gCy(0.9, 1.2, 46, 0, 23, 0, 8), '#2a2d33'], [gB(3.4, 10.6, 3.4, 0, 38, 0), '#1a1c20'], [gB(3.4, 10.6, 3.4, 0, 27, 0), '#1a1c20'], [gCy(1.8, 1.8, 0.6, 0, 0.3, 0, 8), '#2a2d33']]), poles, null, true);
    const lm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 2.4, 1.2), new THREE.MeshBasicMaterial(), lamps.length), d = new THREE.Object3D();
    lamps.forEach((o, n) => { d.position.set(o.x, o.h, o.y); d.updateMatrix(); lm.setMatrixAt(n, d.matrix); lm.setColorAt(n, new THREE.Color(0x222222)); });
    this.scene.add(lm); this.sigLamps = lm; this.sigList = lamps; this.sigT = 0;
  },
  updateSignals(dt) {
    this.sigT -= dt; if (this.sigT > 0) return; this.sigT = 0.2;
    const ON = [new THREE.Color(0xff2a1a), new THREE.Color(0xffb020), new THREE.Color(0x30ff70)];
    const OFF = [new THREE.Color(0x3a0a08), new THREE.Color(0x3a2a08), new THREE.Color(0x0a3a14)];
    const cache = {};
    this.sigList.forEach((o, n) => {
      const key = o.i + ',' + o.j; const st = cache[key] || (cache[key] = lightState(o.i, o.j));
      const s = st[o.ax], lit = s === 'R' ? 0 : s === 'Y' ? 1 : 2;
      this.sigLamps.setColorAt(n, o.k === lit ? ON[o.k] : OFF[o.k]);
    });
    this.sigLamps.instanceColor.needsUpdate = true;
  },
  buildBuildingDetails() {
    const roofP = [], wallP = [], tanks = [], ants = [], aw = [];
    const r = rng(4711);
    const ads = [['REFRI SOL', 'Gelado de verdade', '#e8282a', '#fff'], ['BURGUER DO ZÉ', 'O mais suculento da orla', '#f2a21a', '#3a1a0a'], ['RÁDIO ORLA FM', '98.5 • a trilha da cidade', '#1a6ad0', '#fff'], ['SEGUROS TRANQUILO', 'Bateu? Relaxa.', '#2aa25a', '#fff'], ['PORTO SOL', 'Visite a orla mais bonita', '#ffb020', '#1a1a2a'], ['MOTO VELOZ', 'Entrega em 15 minutos', '#111', '#ffd23f']];
    const adTex = ads.map(([a, b, bg, fg]) => { const c = document.createElement('canvas'); c.width = 512; c.height = 200; const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 512, 200); g.fillStyle = fg; g.font = '900 64px "Arial Black", Arial'; g.textAlign = 'center'; g.fillText(a, 256, 95); g.font = '700 30px Arial'; g.fillText(b, 256, 150); g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(10, 10, 492, 180); return new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c), emissive: 0xffffff, emissiveIntensity: 0 }); });
    this.adMats = adTex;
    for (const b of BUILDINGS) {
      const bx = Math.floor(b.x / PT), by = Math.floor(b.y / PT), d = districtOf(bx, by), h = b.ht * HS;
      const cx = b.x + b.w / 2, front = b.y + b.h;
      if (b.house) {
        // telhado de duas águas
        const alongX = b.w >= b.h, o = 4, rh = Math.min(b.w, b.h) * 0.32;
        const x0 = b.x - o, x1 = b.x + b.w + o, z0 = b.y - o, z1 = b.y + b.h + o;
        const roof = new THREE.BufferGeometry(); let v;
        if (alongX) { const zm = (z0 + z1) / 2; v = [x0, h, z0, x1, h, z0, x1, h + rh, zm, x0, h, z0, x1, h + rh, zm, x0, h + rh, zm, x1, h, z1, x0, h, z1, x0, h + rh, zm, x1, h, z1, x0, h + rh, zm, x1, h + rh, zm]; }
        else { const xm = (x0 + x1) / 2; v = [x0, h, z1, x0, h, z0, xm, h + rh, z0, x0, h, z1, xm, h + rh, z0, xm, h + rh, z1, x1, h, z0, x1, h, z1, xm, h + rh, z1, x1, h, z0, xm, h + rh, z1, xm, h + rh, z0]; }
        roof.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); roof.computeVertexNormals();
        roofP.push([roof, b.roof]);
        // empenas (triângulos nas pontas)
        const gab = new THREE.BufferGeometry(); let gv;
        if (alongX) { const zm = b.y + b.h / 2; gv = [b.x, h, b.y + b.h, b.x, h, b.y, b.x, h + rh * 0.88, zm, b.x + b.w, h, b.y, b.x + b.w, h, b.y + b.h, b.x + b.w, h + rh * 0.88, zm]; }
        else { const xm = b.x + b.w / 2; gv = [b.x, h, b.y, b.x + b.w, h, b.y, xm, h + rh * 0.88, b.y, b.x + b.w, h, b.y + b.h, b.x, h, b.y + b.h, xm, h + rh * 0.88, b.y + b.h]; }
        gab.setAttribute('position', new THREE.Float32BufferAttribute(gv, 3)); gab.computeVertexNormals();
        wallP.push([gab, b.col]);
        if (r() < 0.5) roofP.push([gB(6, 14, 6, b.x + b.w * 0.25, h + rh * 0.5, b.y + b.h * 0.3), '#7a4a3a']);
        // porta, degrau e luminária
        wallP.push([gB(11, 18, 1, cx, 9, front + 0.5), '#5a3a22'], [gB(14, 1.2, 6, cx, 0.6, front + 3), '#a8a49a'], [gB(1, 1, 1, cx + 2.8, 9, front + 1.2), '#d8c070']);
      } else {
        if (b.label || d === 'downtown') wallP.push([gB(Math.min(30, b.w * 0.3), 22, 1, cx, 11, front + 0.5), '#1c242e'], [gB(Math.min(34, b.w * 0.34), 2, 1.6, cx, 23, front + 0.8), '#8a8e96']);
        if (d === 'industrial') wallP.push([gB(Math.min(60, b.w * 0.4), 30, 1, cx - b.w * 0.2, 15, front + 0.5), '#5a5e66'], [gB(Math.min(60, b.w * 0.4), 1.2, 1, cx - b.w * 0.2, 6, front + 0.6), '#e8c547']);
        if (d === 'downtown' && !b.label && r() < 0.6) aw.push({ x: cx + (r() - 0.5) * b.w * 0.3, y: front, w: Math.min(70, b.w * 0.5), c: pick(['#d23a2a', '#2a8a5a', '#2a5ad2', '#e8a21a', '#7a2ad2']) });
        if (d === 'downtown' && r() < 0.45 && b.w > 60) tanks.push({ x: b.x + 20 + r() * (b.w - 40), y: b.y + 20 + r() * (b.h - 40), h });
        if (b.ht > 190) ants.push({ x: cx, y: b.y + b.h / 2, h });
        if ((d === 'industrial' || (d === 'downtown' && b.ht < 120)) && !b.label && r() < 0.55) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 35), pick(adTex)); m.position.set(cx, h + 30, b.y + b.h * 0.6); this.scene.add(m);
          const back = new THREE.Mesh(new THREE.BoxGeometry(92, 37, 1.5), mat('#3a3d44')); back.position.set(cx, h + 30, b.y + b.h * 0.6 - 1); back.castShadow = true; this.scene.add(back);
          roofP.push([gB(1.5, 14, 1.5, cx - 35, h + 7, b.y + b.h * 0.6 - 2), '#3a3d44'], [gB(1.5, 14, 1.5, cx + 35, h + 7, b.y + b.h * 0.6 - 2), '#3a3d44']);
        }
      }
      if (b.label === 'BANCO') { const hp = new THREE.Mesh(new THREE.CircleGeometry(30, 24).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: textTex('H', '#3a3d44', '#ffd23f', 128, 128) })); hp.position.set(cx, h + 4.2, b.y + b.h / 2); this.scene.add(hp); }
    }
    for (const t of tanks) roofP.push([gCy(9, 9, 16, t.x, t.h + 14, t.y, 12), '#8a6a4a'], [new THREE.ConeGeometry(9.5, 5, 12).translate(t.x, t.h + 24.5, t.y), '#6a5038'], [gB(1, 8, 1, t.x - 6, t.h + 4, t.y - 6), '#333'], [gB(1, 8, 1, t.x + 6, t.h + 4, t.y + 6), '#333'], [gB(1, 8, 1, t.x - 6, t.h + 4, t.y + 6), '#333'], [gB(1, 8, 1, t.x + 6, t.h + 4, t.y - 6), '#333']);
    for (const a of ants) roofP.push([gCy(0.8, 1.6, 70, a.x, a.h + 35, a.y, 6), '#aaaaaa'], [gCy(4, 4, 2, a.x, a.h + 1, a.y, 8), '#666666']);
    this.antLights = ants.map(a => { const m = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 })); m.position.set(a.x, a.h + 71, a.y); this.scene.add(m); return m; });
    // toldos listrados
    const sc = document.createElement('canvas'); sc.width = 64; sc.height = 8; const sg = sc.getContext('2d');
    for (let i = 0; i < 8; i++) { sg.fillStyle = i % 2 ? '#ffffff' : '#bbbbbb'; sg.fillRect(i * 8, 0, 8, 8); }
    const stripes = new THREE.CanvasTexture(sc); stripes.wrapS = THREE.RepeatWrapping;
    for (const a of aw) {
      const t = stripes.clone(); t.needsUpdate = true; t.repeat.set(a.w / 16, 1);
      const m = new THREE.Mesh(new THREE.BoxGeometry(a.w, 0.8, 12), new THREE.MeshLambertMaterial({ color: a.c, map: t }));
      m.position.set(a.x, 19, a.y + 6); m.rotation.x = 0.32; m.castShadow = true; this.scene.add(m);
    }
    const rm = new THREE.Mesh(mergeGeo(roofP), VC2()); rm.castShadow = rm.receiveShadow = true;
    const wm = new THREE.Mesh(mergeGeo(wallP), VC2()); wm.castShadow = wm.receiveShadow = true;
    this.scene.add(rm, wm);
  },
  buildBeach() {
    const P = [], wx = WATER_X;
    // píer de madeira
    const py = 5 * PT + 200;
    P.push([gB(420, 2, 34, wx + 190, 4, py), '#8a6a48']);
    for (let x = wx - 10; x < wx + 400; x += 40) for (const s of [-1, 1]) P.push([gCy(1.8, 1.8, 14, x, -2, py + s * 15, 6), '#5a4030']);
    for (let x = wx - 20; x < wx + 400; x += 8) P.push([gB(0.6, 2.1, 34, x, 4.1, py), '#6a5038']);
    for (const s of [-1, 1]) P.push([gB(420, 1, 1, wx + 190, 11, py + s * 16.5), '#ddd8cc']);
    // salva-vidas
    const lx = CITY_T * T + 90, ly = 3 * PT + 200;
    for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) P.push([gB(1.4, 22, 1.4, lx + dx, 11, ly + dz), '#f4f4f4']);
    P.push([gB(16, 1.4, 16, lx, 22, ly), '#e84a2a'], [gB(15, 10, 15, lx, 28, ly), '#f4f4f4'], [gB(17, 1.4, 17, lx, 33.5, ly), '#e84a2a'], [gB(1, 16, 4, lx + 9, 10, ly), '#c8a868']);
    // rede de vôlei
    const vx = CITY_T * T + 70, vy = 6 * PT + 100;
    P.push([gB(1, 20, 1, vx, 10, vy - 30), '#ddd'], [gB(1, 20, 1, vx, 10, vy + 30), '#ddd'], [gB(0.3, 7, 60, vx, 16, vy), '#f4f4f4']);
    // carrinho de cachorro-quente
    const hx = CITY_T * T + 40, hy = 2 * PT + 300;
    P.push([gB(20, 10, 12, hx, 9, hy), '#e8e8e8'], [gB(20.4, 3, 12.4, hx, 11, hy), '#d23a2a'], [gCy(4, 4, 1.4, hx - 6, 4, hy + 6.5, 10).rotateX(0), '#222'], [gB(1, 24, 1, hx, 20, hy), '#999'], [new THREE.ConeGeometry(16, 5, 8).translate(hx, 33, hy), '#f2c21a']);
    this.vendorSpot = { x: hx + 2, y: hy - 12, a: Math.PI / 2 };
    const m = new THREE.Mesh(mergeGeo(P), VC()); m.castShadow = m.receiveShadow = true; this.scene.add(m);
    // barcos
    this.boats = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group(), c = pick(['#ffffff', '#e84a2a', '#2a6ad2', '#f2c21a']);
      g.add(new THREE.Mesh(mergeGeo([[gB(46, 6, 16, 0, 2, 0), c], [new THREE.ConeGeometry(8, 14, 4).rotateZ(-Math.PI / 2).rotateX(Math.PI / 4).scale(1, 0.45, 1).translate(30, 2.5, 0), c], [gB(14, 8, 11, -4, 8, 0), '#f4f4f4'], [gB(4, 3, 11.5, 2, 9, 0), '#1a2433'], [gB(44, 1, 16.4, 0, 4.6, 0), '#444']]), VC()));
      g.position.set(wx + 160 + Math.random() * 900, 0, 200 + Math.random() * (WH - 400)); g.rotation.y = Math.random() * 6; g.userData.ph = Math.random() * 6;
      this.scene.add(g); this.boats.push(g);
    }
    // ondas (textura que desliza)
    const wc = document.createElement('canvas'); wc.width = wc.height = 256; const wg = wc.getContext('2d');
    wg.strokeStyle = 'rgba(255,255,255,.35)'; wg.lineWidth = 2;
    for (let i = 0; i < 40; i++) { const x = Math.random() * 256, y = Math.random() * 256; wg.beginPath(); wg.moveTo(x, y); wg.quadraticCurveTo(x + 10, y - 4, x + 22, y); wg.stroke(); }
    const wt = new THREE.CanvasTexture(wc); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(40, 40);
    this.waveTex = wt;
    const waves = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: wt, transparent: true, depthWrite: false, opacity: 0.8 }));
    waves.position.set(WW / 2, 0.9, WH / 2); waves.renderOrder = 1; this.scene.add(waves); this.waves = waves;
  },
  buildSky() {
    // nuvens
    const cg = mergeGeo([[gS(60, 0, 0, 0, 1.4, 0.5, 1, 8, 6), '#fff'], [gS(45, 60, 8, 20, 1.2, 0.55, 1, 8, 6), '#fff'], [gS(40, -60, 4, -10, 1.3, 0.5, 1, 8, 6), '#fff'], [gS(35, 20, 22, -20, 1, 0.6, 1, 8, 6), '#fff']]);
    this.cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x666666, flatShading: true, fog: false, transparent: true, opacity: 0.92 });
    const list = []; for (let i = 0; i < 26; i++) list.push({ x: rand(-2000, WW + 2000), y: rand(-2000, WH + 2000), h: rand(750, 1050), s: rand(0.8, 1.8), a: rand(0, 6) });
    this.clouds = instanced(cg, list, this.cloudMat, false); this.clouds.receiveShadow = false;
    // estrelas
    const n = 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 + 0.15; pos[i * 3] = Math.cos(a) * Math.cos(e) * 2600; pos[i * 3 + 1] = Math.sin(e) * 2600; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 2600; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.frustumCulled = false; this.scene.add(this.stars);
    // sol e lua
    const disc = (col, r) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: col, fog: false, transparent: true })); this.scene.add(m); return m; };
    this.sunDisc = disc(0xfff2c0, 70); this.moonDisc = disc(0xe8eef8, 45);
  },
  updateProps(dt, dk) {
    this.updateSignals(dt);
    const cam = this.camera.position;
    this.stars.position.copy(cam); this.stars.material.opacity = clamp((dk - 0.4) * 2, 0, 1);
    this.clouds.position.x = (G.t * 6) % 3000 - 1500;
    this.cloudMat.color.setRGB(1 - dk * 0.8, 1 - dk * 0.78, 1 - dk * 0.7); this.cloudMat.emissive.setRGB(0.4 * (1 - dk), 0.4 * (1 - dk), 0.42 * (1 - dk));
    const h = (G.time / 60) % 24, ang = (h - 6) / 12 * Math.PI;
    const place = (m, a, vis) => { m.visible = vis; if (!vis) return; m.position.set(cam.x + Math.cos(a) * 2200, cam.y + Math.sin(a) * 1500 + 100, cam.z + 1400); m.lookAt(cam); };
    place(this.sunDisc, ang, Math.sin(ang) > -0.05); place(this.moonDisc, ang + Math.PI, Math.sin(ang + Math.PI) > 0.05 && dk > 0.3);
    for (const b of this.boats) { b.position.y = Math.sin(G.t * 1.5 + b.userData.ph) * 1.2; b.rotation.z = Math.sin(G.t * 1.1 + b.userData.ph) * 0.04; }
    this.waveTex.offset.set((G.t * 0.004) % 1, (G.t * 0.006) % 1);
    const blink = dk > 0.1 && Math.floor(G.t * 1.2) % 2 === 0;
    for (const a of this.antLights) a.material.color.setHex(blink ? 0xff2020 : 0x441010);
    for (const m of this.adMats) m.emissiveIntensity = dk * 0.6;
  },
});
