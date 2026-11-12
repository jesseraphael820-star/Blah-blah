/* Iara — assistente de IA da cidade.
   Entende pedidos em português, planeja onde construir, calcula o custo
   e só executa depois que o jogador confirma. */
(function () {
  const C = window.CITY, N = C.N;
  const W = C.world, S = C.sim, CAT = C.CATALOG;

  // =====================================================================
  // Ações (usadas tanto pelas ferramentas manuais quanto pela IA)
  // =====================================================================
  const act = (C.act = {});
  act.roadCost = (x, z) => (W.get(x, z) && W.get(x, z).water ? CAT.road.cost * 3 : CAT.road.cost);
  act.buildRoads = function (tiles) {
    let n = 0, cost = 0;
    for (const [x, z] of tiles) {
      const c = act.roadCost(x, z);
      if (!W.get(x, z) || W.get(x, z).t === 'road') continue;
      if (S.money < c) break;
      if (W.setRoad(x, z)) { S.money -= c; cost += c; n++; }
    }
    if (n) W.recompute();
    return { n, cost };
  };
  act.zone = function (tiles, zone) {
    let n = 0, cost = 0;
    const c = zone ? CAT.zoneR.cost : 0;
    for (const [x, z] of tiles) {
      if (S.money < c) break;
      if (W.setZone(x, z, zone)) { S.money -= c; cost += c; n++; }
    }
    if (n) W.version++;
    return { n, cost };
  };
  act.place = function (type, x0, z0, rot) {
    const it = CAT[type];
    if (it.grow) {
      if (!W.canPlace(type, x0, z0, 0) || S.money < it.cost) return false;
      S.money -= it.cost;
      S.placeDirect(x0, z0, it.grow);
      return true;
    }
    if (it.unique && [...W.services.values()].some((s) => s.type === type)) return false;
    if (!W.canPlace(type, x0, z0, rot) || S.money < it.cost) return false;
    S.money -= it.cost;
    W.placeService(type, x0, z0, rot);
    return true;
  };
  act.trees = function (tiles) {
    let n = 0;
    for (const [x, z] of tiles) {
      if (S.money < CAT.arvore.cost) break;
      if (W.addTrees(x, z, 2)) { S.money -= CAT.arvore.cost; n++; }
    }
    if (n) W.version++;
    return n;
  };
  act.bulldoze = function (tiles) {
    let n = 0, roads = false;
    for (const [x, z] of tiles) {
      if (S.money < CAT.bulldoze.cost) break;
      const t = W.get(x, z);
      if (!t) continue;
      const wasRoad = t.t === 'road';
      if (W.bulldoze(x, z)) { S.money -= CAT.bulldoze.cost; n++; if (wasRoad) roads = true; }
    }
    if (roads) W.recompute();
    W.version++;
    return n;
  };

  // =====================================================================
  // Linguagem
  // =====================================================================
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%,.\- ]/g, ' ').replace(/\s+/g, ' ').trim();
  const NUMW = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quinze: 15, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, cem: 100, alguns: 3, algumas: 3, varios: 4, varias: 4, muitos: 8, muitas: 8, poucos: 2, poucas: 2 };
  function qty(t, ignoreOne) {
    const m = t.match(/\b(\d{1,4})\b(?!\s*%)/);
    if (m) return parseInt(m[1], 10);
    for (const w of t.split(' ')) if (NUMW[w] && !(ignoreOne && NUMW[w] === 1)) return NUMW[w];
    return null;
  }
  const has = (t, arr) => arr.some((k) => t.indexOf(k) >= 0);

  const ITEMS = [
    { k: ['hub', 'cidade inteligente', 'inteligente', 'sensor', 'smart', 'rede eletrica inteligente'], id: 'hub' },
    { k: ['parque grande', 'grande parque', 'parques grandes', 'lago artificial'], id: 'parque_grande' },
    { k: ['reciclagem', 'reciclar', 'lixo', 'coleta seletiva'], id: 'reciclagem' },
    { k: ['parque', 'area verde', 'areas verdes', 'jardim', 'jardins'], id: 'parque' },
    { k: ['praca', 'fonte', 'chafariz'], id: 'praca' },
    { k: ['arvore', 'floresta', 'plantar', 'plante', 'reflorest', 'bosque', 'arborizar', 'arboriz'], id: 'arvore' },
    { k: ['hospital', 'hospitais', 'saude', 'clinica', 'posto de saude'], id: 'hospital' },
    { k: ['policia', 'delegacia', 'seguranca', 'policial'], id: 'policia' },
    { k: ['bombeiro', 'incendio'], id: 'bombeiros' },
    { k: ['escola', 'educacao', 'colegio', 'universidade', 'faculdade', 'creche'], id: 'escola' },
    { k: ['prefeitura', 'camara municipal', 'paco municipal'], id: 'prefeitura' },
    { k: ['solar', 'painel', 'paineis', 'placas solares', 'fotovolt'], id: 'solar' },
    { k: ['eolica', 'eolico', 'turbina', 'vento', 'catavento', 'cata-vento'], id: 'eolica' },
    { k: ['carvao', 'termeletrica', 'termoeletrica'], id: 'carvao' },
    { k: ['torre de agua', 'caixa d', 'reservatorio', 'abastecimento', 'agua'], id: 'agua' },
    { k: ['estadio', 'arena', 'futebol'], id: 'estadio' },
    { k: ['torre residencial', 'torres residenciais', 'predio alto', 'predios altos', 'arranha-ceu residencial', 'arranha ceu residencial'], id: 'torre_res' },
    { k: ['torre panoramica', 'mirante', 'torre de tv', 'torre'], id: 'torre' },
    { k: ['corporativ', 'multinacional', 'sede de empresa'], id: 'corporativo' },
    { k: ['shopping', 'centro de compras', 'mall'], id: 'shopping' },
    { k: ['arranha-ceu', 'arranha ceu', 'arranha-ceus', 'arranha ceus', 'arranhaceu'], id: 'arranha_ceu' },
    { k: ['escritorio'], id: 'escritorio' },
    { k: ['loja', 'mercado', 'padaria', 'cafe', 'restaurante', 'comercio local'], id: 'loja' },
    { k: ['fabrica'], id: 'fabrica' },
    { k: ['armazem', 'armazens', 'galpao', 'galpoes', 'silo', 'logistica'], id: 'armazem' },
    { k: ['tecnologia', 'high-tech', 'hightech', 'startup', 'laboratorio'], id: 'tecnologia' },
    { k: ['bairro', 'quarteirao', 'quarteiroes', 'loteamento', 'vizinhanca', 'conjunto habitacional'], id: 'bairro' },
    { k: ['casa', 'residencia', 'moradia', 'sobrado'], id: 'casa' },
    { k: ['predio', 'edificio', 'apartamento'], id: 'edificio' },
    { k: ['rua', 'estrada', 'avenida', 'via ', 'asfalt'], id: 'rua' },
    { k: ['energia', 'eletricidade', 'usina', 'luz'], id: 'energia' }
  ];
  function zoneOf(t) {
    if (has(t, ['misto', 'mista'])) return 'M';
    if (has(t, ['residenc', 'morad', 'habitac'])) return 'R';
    if (has(t, ['comerc', 'loja'])) return 'C';
    if (has(t, ['industri', 'fabri'])) return 'I';
    return null;
  }
  function hintsOf(t) {
    const h = {};
    if (/\b(rio|lago|beira|orla|margem)\b/.test(t) || /perto da agua/.test(t)) h.water = true;
    if (has(t, ['centro', 'meio da cidade', 'perto da prefeitura'])) h.center = true;
    if (has(t, ['longe', 'afastad', 'periferia', 'distante', 'fora da cidade'])) h.far = true;
    if (/\bnorte\b/.test(t)) h.dir = [0, -1];
    if (/\bsul\b/.test(t)) h.dir = [0, 1];
    if (/\bleste\b/.test(t)) h.dir = [1, 0];
    if (/\boeste\b/.test(t)) h.dir = [-1, 0];
    return h;
  }

  // =====================================================================
  // Planejamento espacial
  // =====================================================================
  function Plan() {
    this.actions = []; this.cost = 0; this.reserved = new Set(); this.roads = new Set(); this.lines = [];
  }
  Plan.prototype.reserve = function (x, z) { this.reserved.add(W.idx(x, z)); };
  Plan.prototype.free = function (x, z) { return W.isFree(x, z) && !this.reserved.has(W.idx(x, z)); };
  Plan.prototype.roadOK = function (x, z) { return W.inb(x, z) && (W.connected[W.idx(x, z)] === 1 || this.roads.has(W.idx(x, z))); };
  Plan.prototype.addRoads = function (tiles, label) {
    const list = tiles.filter(([x, z]) => !this.roads.has(W.idx(x, z)) && !W.isRoad(x, z));
    if (!list.length) return 0;
    let cost = 0;
    for (const [x, z] of list) { this.roads.add(W.idx(x, z)); this.reserve(x, z); cost += act.roadCost(x, z); }
    this.actions.push({ kind: 'road', tiles: list });
    this.cost += cost;
    this.lines.push({ label: label || `Rua (${list.length} lotes)`, cost });
    return cost;
  };

  function cityCenter() {
    let sx = 0, sz = 0, n = 0;
    for (let i = 0; i < N * N; i++) {
      const t = W.tiles[i];
      if ((t.t === 'road' && W.connected[i] && !t.fixed) || t.b || t.t === 'svc') { sx += i % N; sz += (i / N) | 0; n++; }
    }
    if (!n) return { x: 8, z: N / 2 };
    return { x: sx / n, z: sz / n };
  }
  function zoneCentroid(zone) {
    let sx = 0, sz = 0, n = 0;
    for (let i = 0; i < N * N; i++) if (W.tiles[i].zone === zone) { sx += i % N; sz += (i / N) | 0; n++; }
    return n ? { x: sx / n, z: sz / n } : null;
  }
  function targetOf(h, kind) {
    const c = cityCenter();
    let tx = c.x, tz = c.z;
    if (h.dir) { tx += h.dir[0] * 12; tz += h.dir[1] * 12; }
    if (h.water) {
      let best = null, bd = 1e9;
      for (let i = 0; i < N * N; i++) if (W.tiles[i].water) { const d = Math.hypot(i % N - tx, ((i / N) | 0) - tz); if (d < bd) { bd = d; best = i; } }
      if (best != null) { tx = best % N; tz = (best / N) | 0; }
    }
    const polluter = kind === 'polluter';
    const far = h.far || polluter;
    const r = zoneCentroid('R') || c;
    return { tx, tz, far, avoid: far ? r : null };
  }
  function score(tg, x, z) {
    let s = Math.hypot(x - tg.tx, z - tg.tz);
    if (tg.avoid) s = Math.abs(Math.hypot(x - tg.avoid.x, z - tg.avoid.z) - 14) + Math.hypot(x - tg.tx, z - tg.tz) * 0.3;
    return s;
  }

  // caminho de rua entre um conjunto de lotes de origem e a rede viária
  function connectPath(plan, starts, maxLen) {
    const prev = new Map(), q = [];
    for (const [x, z] of starts) { const i = W.idx(x, z); if (!prev.has(i)) { prev.set(i, -1); q.push(i); } }
    let head = 0, found = -1;
    while (head < q.length) {
      const i = q[head++];
      const x = i % N, z = (i / N) | 0;
      let depth = 0; for (let k = i; prev.get(k) !== -1; k = prev.get(k)) depth++;
      if (depth > maxLen) continue;
      for (const [dx, dz] of W.DIRS) {
        const nx = x + dx, nz = z + dz;
        if (!W.inb(nx, nz)) continue;
        const j = W.idx(nx, nz);
        if (prev.has(j)) continue;
        if (plan.roadOK(nx, nz)) { prev.set(j, i); found = j; head = q.length; break; }
        const tl = W.tiles[j];
        if (plan.free(nx, nz) || (tl.water && tl.t === 'water')) { prev.set(j, i); q.push(j); }
      }
    }
    if (found < 0) return null;
    const path = [];
    for (let k = prev.get(found); k !== -1 && k != null; k = prev.get(k)) path.push([k % N, (k / N) | 0]);
    return path;
  }

  // ---------- serviço / marco / utilidade ----------
  function planPlace(plan, id, h) {
    const it = CAT[id];
    const polluter = id === 'carvao' || id === 'reciclagem';
    const tg = targetOf(h, polluter ? 'polluter' : null);
    let best = null;
    const rots = (it.w || 1) === (it.h || 1) ? [0] : [0, 1];
    for (const rp of rots) {
      const f0 = W.footprint(id, 0, 0, rp);
      for (let z0 = 0; z0 + f0.h <= N; z0++) for (let x0 = 0; x0 + f0.w <= N; x0++) {
        let ok = true;
        for (let z = z0; z < z0 + f0.h && ok; z++) for (let x = x0; x < x0 + f0.w; x++) if (!plan.free(x, z)) { ok = false; break; }
        if (!ok) continue;
        // lado com rua
        let side = -1;
        for (let x = x0; x < x0 + f0.w && side < 0; x++) { if (plan.roadOK(x, z0 + f0.h)) side = 0; else if (plan.roadOK(x, z0 - 1)) side = 2; }
        for (let z = z0; z < z0 + f0.h && side < 0; z++) { if (plan.roadOK(x0 + f0.w, z)) side = 1; else if (plan.roadOK(x0 - 1, z)) side = 3; }
        let s = score(tg, x0 + f0.w / 2, z0 + f0.h / 2) + (side < 0 ? 25 : 0);
        if (id === 'eolica' || id === 'solar') s *= 0.9;
        if (!best || s < best.s) best = { s, x0, z0, w: f0.w, h: f0.h, side, rp };
      }
    }
    if (!best) return false;
    let rot;
    if (best.side >= 0) rot = rots.length === 1 ? best.side : (best.rp === 0 ? (best.side === 2 ? 2 : 0) : (best.side === 3 ? 3 : 1));
    else {
      const ring = [];
      for (let x = best.x0; x < best.x0 + best.w; x++) ring.push([x, best.z0 + best.h]);
      const path = connectPath(plan, ring.filter(([x, z]) => plan.free(x, z)), 40);
      if (!path) return false;
      plan.addRoads(path, 'Rua de acesso');
      rot = best.rp === 0 ? 0 : 1;
    }
    for (let z = best.z0; z < best.z0 + best.h; z++) for (let x = best.x0; x < best.x0 + best.w; x++) plan.reserve(x, z);
    plan.actions.push({ kind: 'place', type: id, x0: best.x0, z0: best.z0, rot });
    plan.cost += it.cost;
    plan.lines.push({ label: it.name, cost: it.cost });
    return true;
  }

  // ---------- extensão de rua ----------
  function planRoad(plan, len, h) {
    const tg = targetOf(h || {});
    let best = null;
    for (let i = 0; i < N * N; i++) {
      const x = i % N, z = (i / N) | 0;
      if (!plan.roadOK(x, z)) continue;
      let deg = 0;
      for (const [dx, dz] of W.DIRS) if (plan.roadOK(x + dx, z + dz)) deg++;
      for (const [dx, dz] of W.DIRS) {
        let run = 0;
        while (run < len) {
          const nx = x + dx * (run + 1), nz = z + dz * (run + 1);
          if (!plan.free(nx, nz)) break;
          // não colar em ruas paralelas
          const px = -dz, pz = dx;
          if (plan.roadOK(nx + px, nz + pz) || plan.roadOK(nx - px, nz - pz)) break;
          run++;
        }
        if (run < Math.min(len, 4)) continue;
        const ex = x + dx * run, ez = z + dz * run;
        const s = Math.hypot(ex - tg.tx, ez - tg.tz) * 0.5 + (len - run) * 2 + (deg === 1 ? -3 : 0) + Math.random() * 2;
        if (!best || s < best.s) best = { s, x, z, dx, dz, run };
      }
    }
    if (!best) return null;
    const tiles = [];
    for (let k = 1; k <= best.run; k++) tiles.push([best.x + best.dx * k, best.z + best.dz * k]);
    plan.addRoads(tiles, `Rua (${tiles.length} lotes)`);
    return tiles;
  }

  // ---------- lotes junto às ruas (zonas / prédios diretos) ----------
  function roadsideTiles(plan, maxDist) {
    const out = [];
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      if (!plan.free(x, z)) continue;
      let ok = false;
      for (const [dx, dz] of W.DIRS) if (plan.roadOK(x + dx, z + dz)) { ok = true; break; }
      if (!ok && maxDist > 1) for (const [dx, dz] of W.DIRS) if (plan.roadOK(x + dx * 2, z + dz * 2) && plan.free(x + dx, z + dz)) { ok = true; break; }
      if (ok) out.push([x, z]);
    }
    return out;
  }
  function planLots(plan, n, h, maxDist, polluter, cb) {
    const tg = targetOf(h, polluter ? 'polluter' : null);
    let picked = [];
    for (let attempt = 0; attempt < 4 && picked.length < n; attempt++) {
      const cand = roadsideTiles(plan, maxDist).sort((a, b) => score(tg, a[0], a[1]) - score(tg, b[0], b[1]));
      for (const c of cand) {
        if (picked.length >= n) break;
        if (!plan.free(c[0], c[1])) continue;
        picked.push(c); plan.reserve(c[0], c[1]);
      }
      if (picked.length < n && !planRoad(plan, 8 + Math.min(12, n - picked.length), h)) break;
    }
    if (!picked.length) return 0;
    cb(picked);
    return picked.length;
  }
  function planZone(plan, zone, n, h) {
    return planLots(plan, n, h, 2, zone === 'I', (tiles) => {
      plan.actions.push({ kind: 'zone', zone, tiles });
      const cost = tiles.length * CAT.zoneR.cost;
      plan.cost += cost;
      plan.lines.push({ label: `${CAT['zone' + zone].name} (${tiles.length} lotes)`, cost });
    });
  }
  function planDirect(plan, id, n, h) {
    const it = CAT[id];
    return planLots(plan, n, h, 1, it.grow[0] === 'I', (tiles) => {
      for (const [x, z] of tiles) plan.actions.push({ kind: 'place', type: id, x0: x, z0: z, rot: 0 });
      plan.cost += it.cost * tiles.length;
      plan.lines.push({ label: `${it.name} × ${tiles.length}`, cost: it.cost * tiles.length });
    });
  }
  function planTrees(plan, n, h) {
    const tg = targetOf(h);
    const cand = [];
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (plan.free(x, z) && W.get(x, z).trees < 2) {
      let nearRoad = false;
      for (const [dx, dz] of W.DIRS) if (plan.roadOK(x + dx, z + dz)) nearRoad = true;
      cand.push([x, z, score(tg, x, z) + (nearRoad ? 6 : 0) + C.hash(x, z, 5) * 3]);
    }
    cand.sort((a, b) => a[2] - b[2]);
    const tiles = cand.slice(0, Math.max(1, Math.ceil(n / 2))).map(([x, z]) => [x, z]);
    if (!tiles.length) return 0;
    tiles.forEach(([x, z]) => plan.reserve(x, z));
    plan.actions.push({ kind: 'trees', tiles });
    const cost = tiles.length * CAT.arvore.cost;
    plan.cost += cost;
    plan.lines.push({ label: `Árvores (${tiles.length * 2})`, cost });
    return tiles.length;
  }

  // ---------- bairro planejado ----------
  function planNeighborhood(plan, type, h) {
    const tg = targetOf(h, type === 'I' ? 'polluter' : null);
    const free = new Int32Array((N + 1) * (N + 1));
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const v = plan.free(x, z) ? 1 : 0;
      free[(z + 1) * (N + 1) + x + 1] = v + free[z * (N + 1) + x + 1] + free[(z + 1) * (N + 1) + x] - free[z * (N + 1) + x];
    }
    const rectFree = (x0, z0, w, hh) => free[(z0 + hh) * (N + 1) + x0 + w] - free[z0 * (N + 1) + x0 + w] - free[(z0 + hh) * (N + 1) + x0] + free[z0 * (N + 1) + x0] === w * hh;
    for (const size of [13, 9]) {
      let best = null;
      for (let z0 = 0; z0 + size <= N; z0++) for (let x0 = 0; x0 + size <= N; x0++) {
        if (!rectFree(x0, z0, size, size)) continue;
        let adj = false;
        for (let k = 0; k < size && !adj; k++) {
          if (plan.roadOK(x0 - 1, z0 + k) || plan.roadOK(x0 + size, z0 + k) || plan.roadOK(x0 + k, z0 - 1) || plan.roadOK(x0 + k, z0 + size)) adj = true;
        }
        const s = score(tg, x0 + size / 2, z0 + size / 2) + (adj ? 0 : 12);
        if (!best || s < best.s) best = { s, x0, z0, adj };
      }
      if (!best) continue;
      const { x0, z0 } = best;
      const roads = [], lots = [];
      for (let z = z0; z < z0 + size; z++) for (let x = x0; x < x0 + size; x++) {
        const lx = x - x0, lz = z - z0;
        if (lx % 4 === 0 || lz % 4 === 0) roads.push([x, z]); else lots.push([x, z]);
      }
      if (!best.adj) {
        const edge = roads.filter(([x, z]) => x === x0 || z === z0 || x === x0 + size - 1 || z === z0 + size - 1);
        const path = connectPath(plan, edge, 30);
        if (!path) continue;
        plan.addRoads(path, 'Rua de acesso');
      }
      plan.addRoads(roads, `Ruas do bairro (${roads.length} lotes)`);
      const groups = { R: [], C: [], I: [] };
      const blocks = (size - 1) / 4;
      for (const [x, z] of lots) {
        let zt = type || 'R';
        if (type === 'M' || !type) {
          const bx = Math.floor((x - x0) / 4), bz = Math.floor((z - z0) / 4);
          const mid = Math.floor(blocks / 2);
          zt = bx === mid && bz === mid ? 'C' : (bz === 0 && bx === blocks - 1 && type === 'M' ? 'I' : 'R');
        }
        groups[zt].push([x, z]);
        plan.reserve(x, z);
      }
      for (const z of ['R', 'C', 'I']) if (groups[z].length) {
        plan.actions.push({ kind: 'zone', zone: z, tiles: groups[z] });
        const cost = groups[z].length * CAT.zoneR.cost;
        plan.cost += cost;
        plan.lines.push({ label: `${CAT['zone' + z].name} (${groups[z].length} lotes)`, cost });
      }
      return true;
    }
    return false;
  }

  // =====================================================================
  // Diálogo
  // =====================================================================
  const AI = (C.ai = { pending: null });
  const fmt = (v) => S.fmt(v);

  function status() {
    const p = S.power, w = S.water;
    return `📊 <b>${S.name}</b> — ${S.dateStr()}<br>` +
      `👥 População: <b>${S.pop.toLocaleString('pt-BR')}</b><br>` +
      `💰 Caixa: <b>${fmt(S.money)}</b> (${S.monthIncome - S.monthExpense >= 0 ? '+' : ''}${fmt(S.monthIncome - S.monthExpense)}/mês)<br>` +
      `😊 Felicidade: <b>${Math.round(S.happy)}%</b><br>` +
      `⚡ Energia: ${Math.round(p.use)} / ${Math.round(p.prod)} MW · 💧 Água: ${Math.round(w.use)} / ${Math.round(w.prod)} m³<br>` +
      `🏢 Empregos: ${(S.jobsC + S.jobsI + S.jobsS).toLocaleString('pt-BR')} · Imposto: ${S.tax}%`;
  }
  function utilNow() {
    let p = 0, w = 0;
    for (const s of W.services.values()) { const e = CAT[s.type].eff || {}; if (W.svcHasRoad(s)) { p += e.power || 0; w += e.water || 0; } }
    return { p, w };
  }
  AI.advice = function () {
    const tips = [], chips = [];
    const u = utilNow();
    const svcCount = (t) => [...W.services.values()].filter((s) => s.type === t).length;
    let roads = 0, zones = 0;
    for (let i = 0; i < N * N; i++) { const t = W.tiles[i]; if (t.t === 'road' && !t.fixed) roads++; if (t.zone) zones++; }
    if (roads < 5) { tips.push('A cidade ainda não tem ruas. Que tal começar com um bairro conectado à rodovia?'); chips.push('Construa um bairro residencial'); }
    if (u.p <= S.power.use + 5 && (zones > 0 || S.pop > 0)) { tips.push('Precisamos de energia para os prédios crescerem.'); chips.push(S.money > 60000 ? 'Construa uma usina solar' : 'Construa 2 turbinas eólicas'); }
    if (u.w <= S.water.use + 5 && (zones > 0 || S.pop > 0)) { tips.push('Falta abastecimento de água.'); chips.push('Construa uma torre de água'); }
    if (S.demand.C > 0.4 && roads > 5) { tips.push('Os moradores querem comércio por perto.'); chips.push('Crie uma zona comercial com 10 lotes'); }
    if (S.demand.I > 0.45 && roads > 5) { tips.push('Há demanda por indústrias (empregos).'); chips.push('Crie uma zona industrial longe das casas'); }
    if (S.demand.R > 0.5 && roads > 5 && zones < 200) { tips.push('Muita gente quer morar aqui!'); chips.push('Construa um bairro residencial'); }
    if (S.pop > 80 && !svcCount('prefeitura')) { tips.push('A cidade merece uma prefeitura.'); chips.push('Construa a prefeitura no centro'); }
    if (S.pop > 250 && !svcCount('policia')) { tips.push('Sem polícia, a felicidade cai.'); chips.push('Construa uma delegacia'); }
    if (S.pop > 300 && !svcCount('bombeiros')) chips.push('Construa um quartel de bombeiros');
    if (S.pop > 500 && !svcCount('hospital')) { tips.push('Os moradores precisam de um hospital.'); chips.push('Construa um hospital'); }
    if (S.pop > 500 && !svcCount('escola')) chips.push('Construa uma escola');
    let maxPol = 0; for (let i = 0; i < N * N; i++) maxPol = Math.max(maxPol, S.pol[i]);
    if (maxPol > 30) { tips.push('A poluição está alta em algumas áreas.'); chips.push('Plante 20 árvores'); if (!svcCount('hub')) chips.push('Construa o hub de cidade inteligente'); }
    if (S.money < 15000) { tips.push('O caixa está baixo — considere aumentar um pouco os impostos.'); chips.push('Aumente os impostos'); }
    if (!tips.length) tips.push('Tudo em ordem! Você pode investir em parques, marcos ou expandir com novos bairros.');
    if (!chips.length) chips.push('Construa um parque grande', 'Construa uma torre panorâmica', 'Construa um bairro misto');
    return { tips, chips: chips.slice(0, 4) };
  };

  const HELP = `Eu sou a <b>Iara</b>, a IA da prefeitura. Peça qualquer coisa e eu planejo, mostro o preço e só construo se você confirmar. Exemplos:<br>
  • <i>construa um bairro residencial</i><br>
  • <i>crie uma zona industrial longe das casas</i><br>
  • <i>coloque 2 turbinas eólicas e uma torre de água</i><br>
  • <i>faça um hospital perto do centro</i><br>
  • <i>plante 30 árvores</i> · <i>construa 3 prédios comerciais</i><br>
  • <i>construa o hub de cidade inteligente</i> · <i>um estádio</i><br>
  • <i>aumente os impostos para 11%</i> · <i>como está a cidade?</i> · <i>o que devo fazer?</i>`;

  function splitClauses(t) {
    return t.split(/,|;| e tambem | tambem | alem disso | depois | \be\b (?=(?:um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|\d+|o|a|os|as|mais|crie|construa|coloque|faca|plante|faz|bota|bote|poe|ponha)\b)/).map((s) => s.trim()).filter(Boolean);
  }

  AI.handle = function (raw) {
    const t = norm(raw);
    if (!t) return { reply: 'Pode falar! 🙂' };
    if (/^(oi|ola|bom dia|boa tarde|boa noite|e ai|hey|opa)\b/.test(t) && t.split(' ').length < 4)
      return { reply: `Olá, prefeito(a)! Sou a Iara, sua assistente. Diga o que a cidade de <b>${S.name}</b> precisa e eu cuido do resto. Quer uma dica?`, chips: ['O que devo fazer?', 'Como está a cidade?', 'Ajuda'] };
    if (has(t, ['ajuda', 'comandos', 'o que voce faz', 'o que voce sabe', 'como funciona', 'help']))
      return { reply: HELP, chips: ['Construa um bairro residencial', 'O que devo fazer?'] };
    if (has(t, ['como esta', 'status', 'relatorio', 'situacao', 'resumo', 'quantos habitantes', 'populacao', 'quanto dinheiro', 'quanto tenho']) && !has(t, ['constr', 'cri', 'coloq', 'faca', 'faz']))
      return { reply: status(), chips: AI.advice().chips };
    if (has(t, ['o que devo', 'o que fazer', 'dica', 'conselho', 'sugest', 'o que falta', 'o que preciso', 'me ajude a crescer', 'recomend']) && !has(t, ['constr', 'cri']))
      { const a = AI.advice(); return { reply: '🧭 ' + a.tips.join('<br>🧭 ') + '<br>Posso cuidar disso — é só tocar numa sugestão.', chips: a.chips }; }
    if (/^(sim|confirmo|pode|ok|beleza|manda ver|confirmar|isso)\b/.test(t) && AI.pending) return { confirm: true };
    if (/^(nao|cancela|cancelar|deixa|esquece|negativo)\b/.test(t) && AI.pending) return { cancel: true };

    const plan = new Plan();
    const notes = [];
    // renomear
    const rn = raw.match(/(?:renome\w*|mud\w* o nome|troc\w* o nome|chamar? a cidade)(?:\s+(?:a|da|de)?\s*cidade)?\s*(?:para|pra|de|como)?\s*["“']?([^"”']+)["”']?\s*$/i);
    if (rn && rn[1] && rn[1].trim().length > 1) {
      const name = rn[1].trim().replace(/^(para|pra|de|como)\s+/i, '').replace(/[.!]+$/, '').slice(0, 32);
      plan.actions.push({ kind: 'rename', name }); plan.lines.push({ label: `Renomear para “${name}”`, cost: 0 });
      return finalize(plan, notes, raw);
    }
    // cidade inicial completa
    if (has(t, ['cidade inicial', 'comece a cidade', 'comecar a cidade', 'iniciar a cidade', 'cidade completa', 'cidade basica', 'monte a cidade', 'monte uma cidade', 'construa a cidade', 'construa uma cidade', 'faca uma cidade', 'crie uma cidade', 'faz uma cidade', 'kit inicial'])) {
      planNeighborhood(plan, 'M', {});
      planPlace(plan, 'eolica', {}); planPlace(plan, 'eolica', {}); planPlace(plan, 'eolica', {});
      planPlace(plan, 'agua', {});
      planZone(plan, 'I', 8, { far: true });
      planPlace(plan, 'parque', {});
      return finalize(plan, notes, raw, 'Montei um plano inicial completo: bairro misto, energia eólica limpa, água, zona industrial afastada e um parque.');
    }
    // impostos
    if (has(t, ['imposto', 'taxa', 'tributo', 'iptu'])) {
      const m = t.match(/(\d{1,2})\s*%?/);
      let v = S.tax;
      if (m) v = parseInt(m[1], 10);
      else if (has(t, ['aument', 'sub', 'elev', 'mais'])) v = S.tax + 2;
      else if (has(t, ['diminu', 'baix', 'reduz', 'menos', 'cort'])) v = S.tax - 2;
      v = Math.max(0, Math.min(20, v));
      plan.actions.push({ kind: 'tax', value: v });
      plan.lines.push({ label: `Imposto: ${S.tax}% → ${v}%`, cost: 0 });
      notes.push(v > S.tax ? 'Mais arrecadação, mas os moradores podem ficar menos felizes.' : 'Moradores mais felizes e mais demanda, porém menos arrecadação.');
      return finalize(plan, notes, raw);
    }
    // demolir serviço
    if (has(t, ['demol', 'destru', 'derrub', 'remov', 'tirar', 'tira '])) {
      const it = ITEMS.find((i) => has(t, i.k));
      if (it && CAT[it.id] && CAT[it.id].w) {
        const list = [...W.services.values()].filter((s) => s.type === it.id);
        if (!list.length) return { reply: `Não encontrei nenhum(a) ${CAT[it.id].name} na cidade.` };
        const n = Math.min(list.length, qty(t) || 1);
        for (const s of list.slice(0, n)) {
          const tiles = [[s.x0, s.z0]];
          plan.actions.push({ kind: 'bulldoze', tiles, svc: s.id });
          plan.cost += CAT.bulldoze.cost;
        }
        plan.lines.push({ label: `Demolir ${CAT[it.id].name} × ${n}`, cost: plan.cost });
        return finalize(plan, notes, raw);
      }
      return { reply: 'Para demolir ruas, zonas ou prédios use a ferramenta <b>Demolir</b> na barra inferior. Posso demolir serviços específicos — ex.: “demolir a usina a carvão”.' };
    }

    const clauses = splitClauses(t);
    let understood = false;
    for (const cl of clauses) {
      const n = qty(cl);
      const nLots = qty(cl, true); // "uma zona" / "uma rua" não significa 1 lote
      const h = hintsOf(cl);
      const z = zoneOf(cl);
      const isZone = /\bzona|zonea|lotes?\b|area (residencial|comercial|industrial)/.test(cl);
      if (isZone && z && z !== 'M') {
        understood = true;
        const tiles = Math.min(120, nLots || 12);
        if (!planZone(plan, z, tiles, h)) notes.push(`Não achei espaço para a ${CAT['zone' + z].name.toLowerCase()}.`);
        continue;
      }
      let item = ITEMS.find((i) => has(cl, i.k));
      if (!item) {
        if (z) item = { id: 'zone' };
        else continue;
      }
      understood = true;
      let id = item.id;
      // refinamentos por contexto
      if (id === 'edificio' || id === 'predio') {
        if (z === 'C') id = 'escritorio'; else if (z === 'I') id = 'armazem';
        else if (has(cl, ['alto', 'altos', 'arranha', 'torre', 'grande'])) id = 'torre_res';
      }
      if (id === 'arranha_ceu' && z === 'R') id = 'torre_res';
      if (id === 'casa' && z === 'C') id = 'loja';
      if (id === 'zone') {
        if (z === 'M') { if (!planNeighborhood(plan, 'M', h)) notes.push('Não encontrei espaço livre para um bairro.'); continue; }
        if (!planZone(plan, z, Math.min(120, nLots || 12), h)) notes.push('Não achei espaço para essa zona.');
        continue;
      }
      if (id === 'energia') {
        const clean = has(cl, ['limpa', 'renovav', 'verde', 'sustent']);
        if (!clean && S.money < 40000) { for (let i = 0; i < (n || 2); i++) planPlace(plan, 'eolica', h); notes.push('Escolhi turbinas eólicas: limpas e baratas.'); }
        else if (has(cl, ['barata', 'muita', 'carvao'])) planPlace(plan, 'carvao', h);
        else { planPlace(plan, 'solar', h); notes.push('Escolhi uma usina solar: energia limpa.'); }
        continue;
      }
      if (id === 'bairro') {
        const cnt = Math.min(3, n || 1);
        for (let i = 0; i < cnt; i++) if (!planNeighborhood(plan, z, h)) { notes.push('Não encontrei mais espaço livre para bairros.'); break; }
        continue;
      }
      if (id === 'rua') {
        if (!planRoad(plan, Math.min(30, nLots || 8), h)) notes.push('Não encontrei um bom lugar para estender as ruas.');
        continue;
      }
      if (id === 'arvore') { planTrees(plan, Math.min(200, n || 12), h); continue; }
      const it = CAT[id];
      if (!it) continue;
      if (it.grow) {
        const cnt = Math.min(40, n || (id === 'casa' ? 6 : id === 'loja' ? 4 : 2));
        if (!planDirect(plan, id, cnt, h)) notes.push(`Não achei lotes livres junto às ruas para ${it.name.toLowerCase()}.`);
        continue;
      }
      if (it.unique && ([...W.services.values()].some((s) => s.type === id) || plan.actions.some((a) => a.type === id))) { notes.push(`A cidade já tem ${it.name} (só pode existir uma).`); continue; }
      const cnt = it.unique ? 1 : Math.min(10, n || 1);
      let done = 0;
      for (let i = 0; i < cnt; i++) if (planPlace(plan, id, h)) done++;
      if (done < cnt) notes.push(done ? `Só encontrei espaço para ${done} × ${it.name}.` : `Não encontrei espaço livre para ${it.name}.`);
    }
    if (!understood) {
      return { reply: 'Hmm, não entendi bem. 🤔 Tente algo como <i>“construa um hospital”</i>, <i>“crie uma zona comercial”</i> ou <i>“o que devo fazer?”</i>.', chips: ['Ajuda', 'O que devo fazer?', 'Construa um bairro residencial'] };
    }
    return finalize(plan, notes, raw);
  };

  function finalize(plan, notes, raw, intro) {
    if (!plan.actions.length) return { reply: (notes.join('<br>') || 'Não consegui montar um plano para isso.') + '<br>Experimente construir mais ruas primeiro.', chips: ['Construa uma rua', 'Construa um bairro residencial'] };
    // agrupar linhas iguais
    const merged = [];
    for (const l of plan.lines) {
      const m = merged.find((x) => x.label === l.label);
      if (m) { m.cost += l.cost; m.n = (m.n || 1) + 1; } else merged.push(Object.assign({}, l));
    }
    plan.lines = merged.map((l) => ({ label: l.n ? `${l.label} × ${l.n}` : l.label, cost: l.cost }));
    plan.request = raw;
    plan.intro = intro || pickIntro();
    plan.notes = notes;
    AI.pending = plan;
    return { plan };
  }
  const INTROS = ['Planejei isto para você:', 'Encontrei um ótimo lugar! Veja o plano:', 'Pronto, aqui está a proposta:', 'Feito o estudo — eis o que proponho:'];
  const pickIntro = () => INTROS[Math.floor(Math.random() * INTROS.length)];

  AI.execute = function (plan) {
    const done = [];
    let spent = 0;
    const m0 = S.money;
    for (const a of plan.actions) {
      if (a.kind === 'road') act.buildRoads(a.tiles);
      else if (a.kind === 'zone') act.zone(a.tiles, a.zone);
      else if (a.kind === 'place') { if (act.place(a.type, a.x0, a.z0, a.rot)) done.push(a.type); }
      else if (a.kind === 'trees') act.trees(a.tiles);
      else if (a.kind === 'tax') S.tax = a.value;
      else if (a.kind === 'rename') { S.name = a.name; }
      else if (a.kind === 'bulldoze') { W.removeService(a.svc); S.money -= CAT.bulldoze.cost; }
    }
    spent = m0 - S.money;
    W.recompute();
    AI.pending = null;
    return { spent };
  };
})();
