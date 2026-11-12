/* Simulação: demanda RCI, crescimento, energia, água, poluição, valor do solo, orçamento */
(function () {
  const C = window.CITY, N = C.N;
  const W = C.world;
  const CAP = { R: [0, 12, 90, 420], C: [0, 8, 45, 200], I: [0, 18, 55, 110] };
  const PWR = { R: [0, 2, 10, 40], C: [0, 3, 12, 45], I: [0, 8, 20, 25] };
  const WTR = { R: [0, 2, 12, 45], C: [0, 1, 6, 25], I: [0, 5, 12, 15] };
  const POL = { I: [0, 6, 9, 1.5] };
  C.CAP = CAP;

  const S = (C.sim = {
    name: 'Nova Cidade', money: 200000, day: 0, tax: 9, speed: 1,
    pop: 0, jobsC: 0, jobsI: 0, jobsS: 0, demand: { R: 0.6, C: 0.3, I: 0.6 },
    power: { prod: 0, use: 0 }, water: { prod: 0, use: 0 },
    happy: 60, monthIncome: 0, monthExpense: 0, popHist: [],
    pol: new Float32Array(N * N), lv: new Float32Array(N * N),
    cover: { police: new Uint8Array(N * N), fire: new Uint8Array(N * N), health: new Uint8Array(N * N), edu: new Uint8Array(N * N) },
    flags: {}, listeners: []
  });
  const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  S.dateStr = () => {
    const d = S.day, y = 2026 + Math.floor(d / 360), m = Math.floor((d % 360) / 30), dd = (d % 30) + 1;
    return `${dd} ${MONTHS[m]} ${y}`;
  };
  S.fmt = (v) => '§ ' + Math.round(v).toLocaleString('pt-BR');
  S.notify = (msg, kind) => { for (const l of S.listeners) l(msg, kind || 'info'); };
  S.canAfford = (v) => S.money >= v;
  S.spend = (v) => { if (S.money < v) return false; S.money -= v; return true; };

  // ---------- mapas ----------
  function stamp(arr, x0, z0, w, h, amt, r, mode) {
    const cx = x0 + w / 2 - 0.5, cz = z0 + h / 2 - 0.5;
    for (let z = Math.floor(cz - r - h / 2); z <= cz + r + h / 2; z++) for (let x = Math.floor(cx - r - w / 2); x <= cx + r + w / 2; x++) {
      if (!W.inb(x, z)) continue;
      const d = Math.max(0, Math.hypot(x - cx, z - cz) - Math.max(w, h) / 2 + 0.5);
      if (d > r) continue;
      const i = W.idx(x, z);
      if (mode === 'flag') arr[i] = 1;
      else arr[i] += amt * (1 - d / (r + 1));
    }
  }
  S.computeMaps = function () {
    const pol = S.pol, lv = S.lv;
    pol.fill(0); lv.fill(0);
    for (const k in S.cover) S.cover[k].fill(0);
    let smart = 0;
    for (const s of W.services.values()) {
      const it = C.CATALOG[s.type], e = it.eff || {};
      if (e.smart && s.active) smart = Math.max(smart, e.smart);
    }
    for (let i = 0; i < N * N; i++) {
      const t = W.tiles[i];
      if (t.b && t.b.zone === 'I') stamp(pol, i % N, (i / N) | 0, 1, 1, POL.I[t.b.level] * Math.max(0.3, t.b.occ), 2 + t.b.level, 0);
      if (t.trees && t.t === 'empty') stamp(pol, i % N, (i / N) | 0, 1, 1, -0.6 * t.trees, 1, 0);
    }
    for (const s of W.services.values()) {
      const it = C.CATALOG[s.type], e = it.eff || {};
      if (!s.active) continue;
      if (e.pol) stamp(pol, s.x0, s.z0, s.w, s.h, e.pol[0], e.pol[1]);
      if (e.lv) stamp(lv, s.x0, s.z0, s.w, s.h, e.lv[0], e.lv[1]);
      if (e.cover) stamp(S.cover[e.cover[0]], s.x0, s.z0, s.w, s.h, 1, e.cover[1], 'flag');
    }
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const i = W.idx(x, z);
      pol[i] = Math.max(0, Math.min(100, pol[i] * (1 - smart * 0.55)));
      let v = 0.28 + lv[i];
      let water = false, trees = 0;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const t = W.get(x + dx, z + dz);
        if (!t) continue;
        if (t.water) water = true;
        if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1 && t.t === 'empty') trees += t.trees;
      }
      if (water) v += 0.1;
      v += Math.min(0.12, trees * 0.015);
      v += (S.cover.police[i] + S.cover.fire[i] + S.cover.health[i] + S.cover.edu[i]) * 0.045;
      v -= pol[i] / 100 * 0.7;
      lv[i] = Math.max(0, Math.min(1, v));
    }
    S.smart = smart;
  };

  // ---------- passo diário ----------
  let mapsVersion = -1, dayCounter = 0;
  S.step = function () {
    S.day++;
    dayCounter++;
    // serviços ativos precisam de rua conectada
    for (const s of W.services.values()) s.active = W.svcHasRoad(s);
    if (mapsVersion !== W.version || dayCounter % 5 === 0) { S.computeMaps(); mapsVersion = W.version; }
    const smartF = 1 - (S.smart || 0);

    // utilidades
    let pProd = 0, wProd = 0, sJobs = 0, happyBonus = 0, upkeep = 0;
    for (const s of W.services.values()) {
      const it = C.CATALOG[s.type], e = it.eff || {};
      upkeep += it.upkeep || 0;
      if (!s.active) continue;
      pProd += e.power || 0; wProd += e.water || 0; sJobs += e.jobs || 0; happyBonus += e.happy || 0;
    }
    let pUse = 0, wUse = 0, pop = 0, jC = 0, jI = 0, roads = 0;
    const rTiles = [];
    for (let i = 0; i < N * N; i++) {
      const t = W.tiles[i];
      if (t.t === 'road') roads++;
      if (!t.b) continue;
      const b = t.b, l = b.level;
      pUse += PWR[b.zone][l] * smartF; wUse += WTR[b.zone][l] * smartF;
      const cap = CAP[b.zone][l] * b.occ;
      if (b.zone === 'R') { pop += cap; rTiles.push(i); }
      else if (b.zone === 'C') jC += cap; else jI += cap;
    }
    const powerOK = pProd >= pUse, waterOK = wProd >= wUse;
    S.power = { prod: pProd, use: pUse }; S.water = { prod: wProd, use: wUse };
    S.pop = Math.round(pop); S.jobsC = Math.round(jC); S.jobsI = Math.round(jI); S.jobsS = sJobs;

    // demanda
    const jobs = jC + jI + sJobs;
    const taxF = 1 - (S.tax - 9) * 0.06;
    const happyF = (S.happy - 50) / 100;
    S.demand.R = clamp(((jobs * 1.5 - pop + 80) / Math.max(120, pop * 0.25)) * taxF + happyF, -1, 1);
    S.demand.C = clamp(((pop * 0.28 - jC + 12) / Math.max(30, jC * 0.5 + 25)) * taxF, -1, 1);
    S.demand.I = clamp(((pop * 0.32 - jI + 35) / Math.max(45, jI * 0.5 + 25)) * taxF, -1, 1);

    // crescimento
    const spareP = pProd - pUse, spareW = wProd - wUse;
    for (let i = 0; i < N * N; i++) {
      const t = W.tiles[i];
      if (t.t !== 'zone' || !t.zone) continue;
      const x = i % N, z = (i / N) | 0;
      const d = S.demand[t.zone];
      if (!t.b) {
        if (d <= 0.02 || spareP < 3 || spareW < 3) continue;
        if (!W.access(x, z, 2)) continue;
        if (Math.random() < 0.06 + d * 0.22) {
          const lv = S.lv[i];
          const level = lv > 0.75 && S.pop > 4000 && Math.random() < 0.3 ? 2 : 1;
          spawn(x, z, t.zone, level, false);
        }
      } else {
        const b = t.b;
        b.age++;
        const ok = powerOK && waterOK && W.access(x, z, 2);
        const target = ok ? (d > -0.3 ? 1 : 0.65) : 0.4;
        b.occ += (target - b.occ) * (ok ? 0.06 : 0.03);
        b.occ = clamp(b.occ, 0, 1);
        if (!b.direct && ok && b.level < 3 && b.occ > 0.9 && b.age > 25 && d > 0.15 && Math.random() < 0.02 * d) {
          const lv = S.lv[i];
          if ((b.level === 1 && lv > 0.42 && S.pop > 150) || (b.level === 2 && lv > 0.6 && S.pop > 2500)) {
            spawn(x, z, b.zone, b.level + 1, false, b.occ * 0.4);
          }
        }
        if (!b.direct && d < -0.6 && Math.random() < 0.004) W.clearBuilding(x, z, true);
      }
    }

    // felicidade
    let hs = 0;
    for (const i of rTiles) {
      let h = 45;
      h += (S.cover.police[i] + S.cover.fire[i] + S.cover.health[i] + S.cover.edu[i]) * 7;
      h += S.lv[i] * 20 - S.pol[i] * 0.4;
      hs += h;
    }
    let happy = rTiles.length ? hs / rTiles.length : 60;
    happy += Math.min(20, happyBonus) - (S.tax - 9) * 2.5;
    if (!powerOK) happy -= 15;
    if (!waterOK) happy -= 15;
    S.happy = clamp(S.happy + (clamp(happy, 0, 100) - S.happy) * 0.1, 0, 100);

    // orçamento (aplicado diariamente)
    const income = (pop * 1.6 + (jC + jI) * 1.0) * S.tax / 9 * (0.85 + S.happy / 400);
    const expense = upkeep + roads * 2;
    S.monthIncome = income; S.monthExpense = expense;
    S.money += (income - expense) / 30;

    if (S.day % 5 === 0) { S.popHist.push(S.pop); if (S.popHist.length > 120) S.popHist.shift(); }

    // avisos
    warn('power', !powerOK && pUse > 0, '⚡ Falta energia! Construa uma usina.', 'warn');
    warn('water', !waterOK && wUse > 0, '💧 Falta água! Construa uma torre de água.', 'warn');
    warn('money', S.money < 0, '💸 A prefeitura está no vermelho! Aumente os impostos ou corte gastos.', 'bad');
    milestones();
  };

  function warn(key, cond, msg, kind) {
    if (cond && !S.flags[key]) { S.flags[key] = true; S.notify(msg, kind); }
    if (!cond) S.flags[key] = false;
  }
  const MILES = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
  function milestones() {
    S.flags.mile = S.flags.mile || 0;
    while (S.flags.mile < MILES.length && S.pop >= MILES[S.flags.mile]) {
      S.notify(`🎉 ${S.name} alcançou ${MILES[S.flags.mile].toLocaleString('pt-BR')} habitantes!`, 'good');
      S.flags.mile++;
    }
  }

  function spawn(x, z, zone, level, direct, occ) {
    const list = C.models.archList(zone, level);
    const arch = list[Math.floor(Math.random() * list.length)];
    W.setBuilding(x, z, { zone, level, arch, rot: W.faceRoad(x, z), occ: occ || 0.05, age: 0, direct: !!direct });
  }
  S.spawn = spawn;
  S.placeDirect = function (x, z, growKey) {
    const zone = growKey[0], level = +growKey[1];
    spawn(x, z, zone, level, true, 0.05);
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  S.clamp = clamp;
})();
