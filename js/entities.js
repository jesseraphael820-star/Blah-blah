'use strict';
// ===== Estado global =====
const G = {
  player: null, peds: [], cars: [], pickups: [], parts: [], tracers: [], skids: [], decals: [],
  heat: 0, wanted: 0, unseen: 0, money: 0, time: 8 * 60, t: 0, msgs: [], shake: 0,
};
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1], DA = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const HEAT_THR = [0, 1, 4, 9, 16, 25];
const approach = (v, t, d) => v < t ? Math.min(t, v + d) : Math.max(t, v - d);

const WEAPONS = [
  { name: 'PUNHOS', dmg: 14, range: 30, cd: 0.38, melee: true, icon: '✊' },
  { name: 'PISTOLA', dmg: 30, range: 420, cd: 0.32, spread: 0.035, icon: '🔫', clip: 17 },
  { name: 'SUBMETRALHADORA', dmg: 15, range: 380, cd: 0.085, spread: 0.08, icon: 'SMG', clip: 30 },
  { name: 'ESCOPETA', dmg: 18, range: 240, cd: 0.8, spread: 0.16, pellets: 6, icon: 'ESC', clip: 8 },
];
const CARTYPES = {
  sedan: { L: 50, W: 24, max: 320, accel: 250, brakeF: 520, grip: 7, turn: 2.6, cols: ['#b33a3a', '#3a5fb3', '#d8d8d0', '#2e2e33', '#4a8a4a', '#a88a3a', '#7a3ab3', '#c86a2a'] },
  sport: { L: 50, W: 23, max: 440, accel: 400, brakeF: 650, grip: 8, turn: 2.9, cols: ['#e0281e', '#f2c21a', '#1e9ae0', '#111111', '#ff6a00'] },
  van: { L: 62, W: 28, max: 250, accel: 170, brakeF: 420, grip: 6, turn: 2.0, cols: ['#e8e8e8', '#8a8a7a', '#3a6a9a', '#c8a050'] },
  taxi: { L: 50, W: 24, max: 320, accel: 260, brakeF: 520, grip: 7, turn: 2.6, cols: ['#f2c21a'] },
  police: { L: 52, W: 25, max: 390, accel: 340, brakeF: 600, grip: 8, turn: 2.8, cols: ['#f4f4f4'] },
};
const SHIRTS = ['#d94a4a', '#4a7ad9', '#e8e8e8', '#e8b84a', '#5aa85a', '#9a5ad9', '#e87a3a', '#3ac8c8', '#333', '#d96aa8'];
const SKINS = ['#f1c9a5', '#d9a77a', '#a86e4a', '#7a4a2e', '#5a3620', '#e8b896'];

let NEXT_ID = 1;
function makeCar(x, y, a, type) {
  const s = CARTYPES[type];
  return { id: NEXT_ID++, x, y, a, vx: 0, vy: 0, spd: 0, type, L: s.L, W: s.W, max: s.max, accel: s.accel, brakeF: s.brakeF, grip: s.grip, turn: s.turn,
    col: pick(s.cols), hp: 100, driver: null, ai: null, fire: 0, wreck: false, siren: false, cops: type === 'police' ? 1 : 0, stuck: 0, rev: 0, horn: 0 };
}
function makePed(x, y, kind) {
  return { id: NEXT_ID++, x, y, a: rand(-3, 3), hp: 100, maxHp: 100, kind, shirt: kind === 'cop' ? '#2b4a8a' : kind === 'gang' ? '#6a1a1a' : pick(SHIRTS),
    pants: kind === 'cop' ? '#1a2440' : pick(['#2a3a5a', '#333', '#5a4a3a', '#3a3a3a', '#6a6a7a']), skin: pick(SKINS),
    walk: 0, state: 'walk', ring: null, t: 0, cd: rand(0, 1), weapon: kind === 'cop' ? 1 : kind === 'gang' ? 1 : 0, car: null, spd: 0, vx: 0, vy: 0, arrest: 0 };
}
// ===== Faixas =====
function laneCross(dir, road) { const b = road * PT; return dir === 0 ? b + 96 : dir === 2 ? b + 32 : dir === 1 ? b + 32 : b + 96; }
function spawnTraffic(near) {
  for (let tries = 0; tries < 12; tries++) {
    const dir = randi(0, 3), road = randi(0, NB), hor = dir % 2 === 0;
    const k = randi(0, NB - 1), s = k * PT + RWP + rand(20, PT - RWP - 20);
    const x = hor ? s : laneCross(dir, road), y = hor ? laneCross(dir, road) : s;
    const d = Math.hypot(x - near.x, y - near.y);
    if (d < 560 || d > 1100) continue;
    if (G.cars.some(c => Math.abs(c.x - x) < 70 && Math.abs(c.y - y) < 70)) continue;
    const type = pick(['sedan', 'sedan', 'sedan', 'sport', 'van', 'taxi', 'sedan']);
    const c = makeCar(x, y, DA[dir], type);
    c.ai = { dir, road, pend: null, cruise: rand(95, 140) };
    c.driver = makePed(x, y, 'civ'); c.driver.car = c; c.spd = c.ai.cruise * 0.6;
    G.cars.push(c); return c;
  }
  return null;
}
function ringPos(r) {
  const S = 288, L = r.bx * PT + 144, Tt = r.by * PT + 144;
  let p = ((r.p % (4 * S)) + 4 * S) % (4 * S); const seg = Math.floor(p / S), u = p - seg * S;
  if (seg === 0) return [L + u, Tt + r.off, 0];
  if (seg === 1) return [L + S - r.off, Tt + u, Math.PI / 2];
  if (seg === 2) return [L + S - u, Tt + S - r.off, Math.PI];
  return [L + r.off, Tt + S - u, -Math.PI / 2];
}
function spawnPed(near, kind) {
  for (let tries = 0; tries < 12; tries++) {
    const bx = clamp(Math.floor(near.x / PT) + randi(-3, 3), 0, NB - 1), by = clamp(Math.floor(near.y / PT) + randi(-2, 2), 0, NB - 1);
    const ring = { bx, by, p: rand(0, 1152), dir: Math.random() < .5 ? 1 : -1, off: rand(-9, 9) };
    const [x, y] = ringPos(ring);
    const d = Math.hypot(x - near.x, y - near.y);
    if (d < (kind === 'cop' ? 450 : 500) || d > 1000) continue;
    const p = makePed(x, y, kind || 'civ'); p.ring = ring; p.spd = rand(38, 55);
    if (kind === 'cop') { p.state = 'chase'; p.ring = null; }
    G.peds.push(p); return p;
  }
  return null;
}
function spawnPolice(near) {
  for (let tries = 0; tries < 12; tries++) {
    const dir = randi(0, 3), road = randi(0, NB), hor = dir % 2 === 0;
    const s = randi(0, NB - 1) * PT + RWP + rand(20, PT - RWP - 20);
    const x = hor ? s : laneCross(dir, road), y = hor ? laneCross(dir, road) : s;
    const d = Math.hypot(x - near.x, y - near.y);
    if (d < 480 || d > 850) continue;
    const c = makeCar(x, y, Math.atan2(near.y - y, near.x - x), 'police');
    c.police = true; c.siren = true; c.driver = makePed(x, y, 'cop'); c.driver.car = c;
    c.cops = 1; G.cars.push(c); return c;
  }
}
// ===== Física de carro =====
function driveCar(c, thr, steer, brake, hand, dt) {
  const fx = Math.cos(c.a), fy = Math.sin(c.a);
  let fwd = c.vx * fx + c.vy * fy, lat = -c.vx * fy + c.vy * fx;
  const hpF = c.hp < 30 ? 0.6 : 1;
  if (brake) { if (fwd > 15) fwd -= c.brakeF * dt; else fwd -= c.accel * 0.6 * dt; }
  else if (thr > 0) fwd += thr * c.accel * hpF * dt * (fwd < 0 ? 2.5 : 1) * (1 - Math.max(0, fwd) / c.max * 0.5);
  fwd = clamp(fwd, -c.max * 0.35, c.max * hpF);
  fwd -= fwd * (thr === 0 && !brake ? 0.8 : 0.15) * dt;
  lat *= Math.max(0, 1 - (hand ? 1.6 : c.grip) * dt);
  const tf = clamp(Math.abs(fwd) / 110, 0, 1) * (fwd >= 0 ? 1 : -1) * (1 - Math.abs(fwd) / c.max * 0.25);
  c.a = angN(c.a + steer * c.turn * (hand ? 1.35 : 1) * tf * dt);
  c.vx = fx * fwd - fy * lat; c.vy = fy * fwd + fx * lat;
  c.x += c.vx * dt; c.y += c.vy * dt;
  c.spd = Math.hypot(c.vx, c.vy); c.fwd = fwd;
  if (Math.abs(lat) > 70 && c.spd > 90) {
    for (const s of [-1, 1]) G.skids.push({ x: c.x - fx * c.L * 0.32 - fy * s * c.W * 0.38, y: c.y - fy * c.L * 0.32 + fx * s * c.W * 0.38, a: c.a, life: 8 });
    if (G.skids.length > 500) G.skids.splice(0, G.skids.length - 500);
    if (c === G.player.car) SFX.skid(clamp(Math.abs(lat) / 300, 0, 1));
  }
}
function carCircles(c) {
  const fx = Math.cos(c.a), fy = Math.sin(c.a), o = c.L * 0.27;
  return [[c.x + fx * o, c.y + fy * o], [c.x - fx * o, c.y - fy * o]];
}
function carWorldCollide(c) {
  const r = c.W * 0.55;
  for (const [px, py] of carCircles(c)) {
    const o = { x: px, y: py }; const n = resolveCircle(o, r);
    if (!n) continue;
    c.x += o.x - px; c.y += o.y - py;
    const vn = c.vx * n.nx + c.vy * n.ny;
    if (vn < 0) {
      c.vx -= n.nx * vn * 1.35; c.vy -= n.ny * vn * 1.35;
      if (-vn > 80) { damageCar(c, -vn * 0.05, null); sparks(px - n.nx * r, py - n.ny * r, 6); if (c === G.player.car) { buzz(40); SFX.crash(-vn / 400); G.shake = Math.min(12, -vn / 30); } }
    }
  }
}
// ===== IA de trânsito =====
function aiTraffic(c, dt) {
  const ai = c.ai, hor = ai.dir % 2 === 0, sgn = (ai.dir === 0 || ai.dir === 1) ? 1 : -1;
  const fx = DX[ai.dir], fy = DY[ai.dir];
  let tgt = ai.cruise; const look = 55 + c.spd * 0.5;
  ai.push = (ai.push || 0) - dt;
  let carBlock = false;
  if (ai.push <= 0) for (const o of G.cars) {
    if (o === c) continue; const dx = o.x - c.x, dy = o.y - c.y;
    if (Math.abs(dx) > 200 || Math.abs(dy) > 200) continue;
    const al = dx * fx + dy * fy, lt = Math.abs(-dx * fy + dy * fx);
    if (al > 0 && al < look && lt < 28) { tgt = Math.min(tgt, Math.max(0, (al - 48) * 2)); if (tgt < 10) carBlock = true; }
  }
  ai.wait = carBlock ? (ai.wait || 0) + dt : 0;
  if (ai.wait > 3.5) { ai.wait = 0; ai.push = 1.6; }
  const pl = G.player;
  const check = p => { const dx = p.x - c.x, dy = p.y - c.y; const al = dx * fx + dy * fy, lt = Math.abs(-dx * fy + dy * fx); if (al > 0 && al < look && lt < 22) { tgt = Math.min(tgt, Math.max(0, (al - 34) * 2)); return true; } return false; };
  if (!pl.car && pl.hp > 0 && check(pl) && c.spd < 5) { c.horn -= dt; if (c.horn < 0) { c.horn = rand(2, 5); if (dist(c, pl) < 300) SFX.horn(); } }
  for (const p of G.peds) if (p.hp > 0 && !p.car && Math.abs(p.x - c.x) < 120 && Math.abs(p.y - c.y) < 120) check(p);
  c.spd = approach(c.spd, tgt, (tgt < c.spd ? 450 : 110) * dt);
  let s = hor ? c.x : c.y;
  if (!ai.pend) {
    const k = sgn > 0 ? Math.floor(s / PT) + 1 : Math.floor((s - RWP) / PT);
    const opts = [];
    if (sgn > 0 ? k < NB : k > 0) opts.push(ai.dir, ai.dir, ai.dir);
    for (const nd of [(ai.dir + 1) % 4, (ai.dir + 3) % 4]) { const ps = (nd === 0 || nd === 1) ? 1 : -1; if (ps > 0 ? ai.road < NB : ai.road > 0) opts.push(nd); }
    const nd = pick(opts);
    ai.pend = { k, nd, target: nd === ai.dir ? k * PT + 64 : laneCross(nd, k) };
  }
  const p = ai.pend, ns = s + sgn * c.spd * dt;
  if ((sgn > 0 && ns >= p.target) || (sgn < 0 && ns <= p.target)) {
    if (p.nd !== ai.dir) { if (hor) c.x = p.target; else c.y = p.target; ai.dir = p.nd; ai.road = p.k; }
    else { if (hor) c.x = ns; else c.y = ns; }
    ai.pend = null;
  } else { if (hor) c.x = ns; else c.y = ns; }
  const lc = laneCross(ai.dir, ai.road);
  if (ai.dir % 2 === 0) c.y = approach(c.y, lc, 70 * dt); else c.x = approach(c.x, lc, 70 * dt);
  c.a = angN(c.a + clamp(angN(DA[ai.dir] - c.a), -7 * dt, 7 * dt));
  c.vx = DX[ai.dir] * c.spd; c.vy = DY[ai.dir] * c.spd;
}
// ===== IA da polícia =====
const roadC = v => clamp(Math.round((v - 64) / PT), 0, NB) * PT + 64;
function aiPolice(c, dt) {
  const pl = G.player, tgt = pl.car || pl;
  if (G.wanted === 0) { driveCar(c, 0, 0, true, false, dt); c.siren = false; return; }
  c.siren = true;
  const d = dist(c, tgt);
  let wx = tgt.x, wy = tgt.y;
  if (d > 280) {
    const vx = roadC(c.x), hy = roadC(c.y);
    const onV = Math.abs(c.x - vx) < 70, onH = Math.abs(c.y - hy) < 70;
    const py = roadC(tgt.y), px = roadC(tgt.x);
    if (onV && Math.abs(c.y - py) > 70) { wx = vx; wy = py; }
    else if (onH && Math.abs(c.x - px) > 70) { wx = px; wy = hy; }
    else if (!onV && !onH) { wx = vx; wy = hy; }
  }
  const des = Math.atan2(wy - c.y, wx - c.x), diff = angN(des - c.a);
  let thr = 1, steer = clamp(diff * 2.2, -1, 1), brake = false;
  if (Math.abs(diff) > 1.3 && (c.fwd || 0) > 150) { thr = 0; brake = true; }
  if (!pl.car && d < 150) { thr = 0; brake = (c.fwd || 0) > 10; }
  if ((c.fwd || 0) < 30 && thr > 0 && c.rev <= 0) { c.stuck += dt; if (c.stuck > 0.9) { c.rev = 0.9; c.stuck = 0; } } else c.stuck = 0;
  if (c.rev > 0) { c.rev -= dt; brake = true; thr = 0; steer = -steer; }
  driveCar(c, thr, steer, brake, false, dt);
  if (!pl.car && d < 170 && c.cops > 0 && c.spd < 40) {
    c.cops--; const cop = makePed(c.x - Math.sin(c.a) * 22, c.y + Math.cos(c.a) * 22, 'cop'); cop.state = 'chase'; G.peds.push(cop);
  }
}
// ===== Combate =====
function crime(pts) {
  G.heat = Math.min(40, G.heat + pts); G.unseen = 0;
  let w = 0; for (let i = 1; i <= 5; i++) if (G.heat >= HEAT_THR[i]) w = i;
  if (w > G.wanted) { G.wanted = w; flashStars(); }
}
function setWanted(n) { G.heat = HEAT_THR[n]; G.wanted = n; G.unseen = 0; if (n) flashStars(); }
let starFlash = 0; function flashStars() { starFlash = 2; }
function damagePed(p, dmg, src) {
  if (p.hp <= 0) return;
  if (p === G.player) {
    if (G.cheatGod) return;
    const ab = Math.min(G.armor, dmg * 0.7); G.armor -= ab; dmg -= ab;
    p.hp -= dmg; G.shake = Math.max(G.shake, 4); G.hurt = 0.4; buzz(25);
    if (p.hp <= 0) { p.hp = 0; Game.wasted(); }
    blood(p.x, p.y, 3); return;
  }
  p.hp -= dmg; blood(p.x, p.y, 4);
  if (src === G.player) {
    if (p.kind === 'cop') crime(p.hp <= 0 ? 6 : 2);
    else if (p.kind === 'civ') crime(p.hp <= 0 ? 2 : 1);
    if (p.kind !== 'cop' && p.kind !== 'gang') { p.state = 'flee'; p.t = 8; p.from = { x: src.x, y: src.y }; p.ring = null; }
    if (p.kind === 'gang') p.state = 'attack';
  }
  if (p.hp <= 0) killPed(p, src);
}
function killPed(p, src) {
  p.hp = 0; p.state = 'dead'; p.deadT = 0; SFX.thud();
  G.decals.push({ x: p.x + rand(-4, 4), y: p.y + rand(-4, 4), r: rand(10, 16), life: 30, c: 'rgba(120,10,10,.75)' });
  if (p.kind === 'gang' || Math.random() < 0.35) G.pickups.push({ x: p.x + 8, y: p.y, type: 'cash', val: p.kind === 'gang' ? randi(80, 200) : randi(10, 60), temp: 30 });
  if (p.kind === 'cop' && Math.random() < 0.5) G.pickups.push({ x: p.x - 8, y: p.y, type: 'pistol', val: 17, temp: 30 });
  if (p.onDie) p.onDie();
}
function damageCar(c, dmg, src) {
  if (c.wreck) return;
  c.hp -= dmg;
  if (src === G.player && c.police) crime(0.3);
  if (c.hp <= 0 && !c.fire) { c.hp = 0; c.fire = 3.2; }
}
function explode(c) {
  c.wreck = true; c.fire = 0; c.vx *= .3; c.vy *= .3; c.siren = false;
  SFX.boom(); G.shake = Math.max(G.shake, dist(c, G.player.car || G.player) < 500 ? 14 : 4);
  for (let i = 0; i < 40; i++) { const a = rand(0, 7), s = rand(40, 260); G.parts.push({ x: c.x, y: c.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(.4, 1), max: 1, size: rand(8, 22), type: 'fire' }); }
  for (let i = 0; i < 20; i++) G.parts.push({ x: c.x + rand(-20, 20), y: c.y + rand(-20, 20), vx: rand(-30, 30), vy: rand(-30, 30), life: rand(1.5, 3), max: 3, size: rand(14, 30), type: 'smoke' });
  G.decals.push({ x: c.x, y: c.y, r: 40, life: 40, c: 'rgba(20,20,20,.6)' });
  if (c.driver && c.driver !== G.player) { c.driver.hp = 0; c.driver = null; }
  if (G.player.car === c) { G.player.car = null; G.player.x = c.x; G.player.y = c.y; G.player.hp = 0; Game.wasted(); }
  for (const p of G.peds) if (p.hp > 0 && !p.car) { const d = dist(p, c); if (d < 100) damagePed(p, 140 * (1 - d / 100), c.lastHit); }
  if (!G.player.car && G.player.hp > 0) { const d = dist(G.player, c); if (d < 100) damagePed(G.player, 90 * (1 - d / 100), c); }
  for (const o of G.cars) if (o !== c && !o.wreck) { const d = dist(o, c); if (d < 110) { damageCar(o, 70 * (1 - d / 110), null); o.vx += (o.x - c.x) / d * 150; o.vy += (o.y - c.y) / d * 150; } }
  if (c.onDie) c.onDie();
}
function sparks(x, y, n) { for (let i = 0; i < n; i++) { const a = rand(0, 7), s = rand(60, 220); G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(.1, .35), max: .35, size: 2, type: 'spark' }); } }
function blood(x, y, n) { for (let i = 0; i < n; i++) { const a = rand(0, 7), s = rand(20, 90); G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(.2, .5), max: .5, size: 3, type: 'blood' }); } }

function shoot(sh, ang, wi) {
  const w = WEAPONS[wi];
  if (w.melee) {
    SFX.punch();
    const hx = sh.x + Math.cos(ang) * 20, hy = sh.y + Math.sin(ang) * 20;
    for (const p of G.peds) if (p !== sh && p.hp > 0 && !p.car && Math.hypot(p.x - hx, p.y - hy) < 18) {
      damagePed(p, w.dmg, sh); p.x += Math.cos(ang) * 10; p.y += Math.sin(ang) * 10;
      if (p.kind === 'civ' && p.hp > 0 && Math.random() < .3) { p.state = 'attack'; }
      break;
    }
    if (sh !== G.player && !G.player.car && Math.hypot(G.player.x - hx, G.player.y - hy) < 18) damagePed(G.player, w.dmg * 0.6, sh);
    return;
  }
  SFX.shot(wi, sh === G.player ? 1 : clamp(1 - dist(sh, G.player) / 700, 0, 1));
  const n = w.pellets || 1;
  for (let i = 0; i < n; i++) hitscan(sh, ang + rand(-w.spread, w.spread) * (sh === G.player ? 1 : 2.2), w.range, w.dmg * (sh === G.player ? 1 : 0.3));
  G.parts.push({ x: sh.x + Math.cos(ang) * 16, y: sh.y + Math.sin(ang) * 16, vx: 0, vy: 0, life: .06, max: .06, size: 9, type: 'flash' });
  if (sh === G.player) {
    for (const p of G.peds) {
      if (p.hp <= 0 || p.car) continue; const d = dist(p, sh);
      if (p.kind === 'civ' && d < 380 && p.state !== 'attack') { p.state = 'flee'; p.t = 7; p.from = { x: sh.x, y: sh.y }; p.ring = null; }
      if (p.kind === 'cop' && d < 420 && G.wanted === 0) crime(1);
    }
  }
}
function hitscan(sh, a, range, dmg) {
  const dx = Math.cos(a), dy = Math.sin(a); let ex = sh.x + dx * range, ey = sh.y + dy * range;
  const myCar = sh.car;
  outer: for (let d = 12; d < range; d += 6) {
    const x = sh.x + dx * d, y = sh.y + dy * d;
    if (solidAt(x, y)) { sparks(x, y, 3); ex = x; ey = y; break; }
    for (const p of G.peds) {
      if (p === sh || p.hp <= 0 || p.car) continue;
      if ((p.x - x) ** 2 + (p.y - y) ** 2 < 120) { damagePed(p, dmg, sh); ex = x; ey = y; break outer; }
    }
    const pl = G.player;
    if (sh !== pl && !pl.car && pl.hp > 0 && (pl.x - x) ** 2 + (pl.y - y) ** 2 < 110) { damagePed(pl, dmg, sh); ex = x; ey = y; break; }
    for (const c of G.cars) {
      if (c === myCar || c.wreck) continue;
      if (Math.abs(c.x - x) > 40 || Math.abs(c.y - y) > 40) continue;
      for (const [cx, cy] of carCircles(c)) if ((cx - x) ** 2 + (cy - y) ** 2 < 196) {
        c.lastHit = sh; damageCar(c, dmg * 0.45, sh); sparks(x, y, 4); ex = x; ey = y;
        if (c === pl.car && sh !== pl) G.hurt = 0.2;
        if (c.driver && c.driver.kind === 'civ' && c.ai && sh === pl) { c.ai.cruise = 260; }
        break outer;
      }
    }
  }
  G.tracers.push({ x1: sh.x + dx * 14, y1: sh.y + dy * 14, x2: ex, y2: ey, life: .07 });
}
// ===== IA de pedestres =====
function updatePed(p, dt) {
  if (p.hp <= 0) { p.deadT += dt; return; }
  const pl = G.player;
  let mvx = 0, mvy = 0, sp = 0;
  p.cd -= dt;
  if (p.state === 'walk' && p.ring) {
    p.ring.p += p.ring.dir * p.spd * dt;
    const [x, y, a] = ringPos(p.ring);
    p.vx = (x - p.x) / dt; p.vy = (y - p.y) / dt; p.x = x; p.y = y; p.a = p.ring.dir > 0 ? a : a + Math.PI; p.walk += dt * 9;
    return;
  }
  if (p.state === 'flee') {
    p.t -= dt; const a = Math.atan2(p.y - p.from.y, p.x - p.from.x) + Math.sin(G.t * 2 + p.id) * 0.5;
    mvx = Math.cos(a); mvy = Math.sin(a); sp = 135;
    if (p.t < 0) { p.state = 'wander'; p.t = rand(2, 5); p.wa = rand(-3, 3); }
  } else if (p.state === 'wander') {
    p.t -= dt; if (p.t < 0) { p.t = rand(2, 5); p.wa = rand(-3, 3); }
    mvx = Math.cos(p.wa); mvy = Math.sin(p.wa); sp = 45;
  } else if (p.state === 'chase' || p.state === 'attack' || p.state === 'guard') {
    const tgt = pl.car || pl, d = dist(p, tgt);
    if (p.kind === 'cop' && G.wanted === 0) { p.state = 'wander'; p.t = 3; p.wa = rand(-3, 3); return; }
    if (pl.hp <= 0) { sp = 0; }
    else if (p.state === 'guard' && d > 330) { sp = 0; }
    else {
      const a = Math.atan2(tgt.y - p.y, tgt.x - p.x); p.a = a;
      const canShoot = p.weapon > 0 && (p.kind !== 'cop' || G.wanted >= 2);
      if (canShoot && d < 330 && p.cd <= 0 && los(p, tgt)) { p.cd = p.kind === 'cop' ? rand(.7, 1.3) : rand(.6, 1.1); shoot(p, a, p.weapon); }
      const keep = canShoot ? 130 : 16;
      if (d > keep) { mvx = Math.cos(a); mvy = Math.sin(a); sp = p.kind === 'cop' ? 128 : 110; }
      if (!canShoot && d < 26 && p.cd <= 0) {
        if (p.kind === 'cop' && !pl.car) { p.cd = 0.2; pl.arrest = (pl.arrest || 0) + 0.25; }
        else if (!pl.car) { p.cd = 0.6; shoot(p, a, 0); }
      }
      if (p.state === 'guard' && d < 330) p.state = 'attack';
    }
  }
  if (sp > 0) {
    p.x += mvx * sp * dt; p.y += mvy * sp * dt; p.walk += dt * sp * 0.16;
    if (p.state !== 'chase' && p.state !== 'attack') p.a = Math.atan2(mvy, mvx);
    resolveCircle(p, 8);
  }
  // separação
  for (const o of G.peds) { if (o === p || o.hp <= 0 || o.car) continue; const dx = p.x - o.x, dy = p.y - o.y, d = dx * dx + dy * dy; if (d < 196 && d > 0) { const l = Math.sqrt(d); p.x += dx / l * (14 - l) * .5; p.y += dy / l * (14 - l) * .5; } }
}
// ===== Desenho =====
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawCar(ctx, c) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a);
  const L = c.L, W = c.W, hl = L / 2, hw = W / 2;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(ctx, -hl + 3, -hw + 4, L, W, 7); ctx.fill();
  ctx.fillStyle = '#111';
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) ctx.fillRect(sx * L * 0.3 - 6, sy * hw - 3 - (sy < 0 ? 0 : -0), 12, 6);
  const body = c.wreck ? '#2b2724' : c.col;
  ctx.fillStyle = body; rr(ctx, -hl, -hw, L, W, 6); ctx.fill();
  if (c.type === 'police' && !c.wreck) { ctx.fillStyle = '#16181f'; ctx.fillRect(hl * 0.35, -hw, hl * 0.6, W); ctx.fillRect(-hl, -hw, hl * 0.35, W); }
  ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(-hl + 4, -hw + 2, L - 8, 3);
  if (c.type === 'van') {
    ctx.fillStyle = c.wreck ? '#333' : shade(c.col, 0.9); ctx.fillRect(-hl + 2, -hw + 3, L * 0.68, W - 6);
    ctx.fillStyle = '#1b2633'; ctx.fillRect(hl * 0.36, -hw + 3, L * 0.12, W - 6);
  } else {
    ctx.fillStyle = '#1b2633'; ctx.fillRect(L * 0.08, -hw + 3, L * 0.17, W - 6); ctx.fillRect(-L * 0.36, -hw + 3, L * 0.1, W - 6);
    ctx.fillStyle = c.wreck ? '#222' : shade(c.col.startsWith('#') ? c.col : '#888888', c.type === 'police' ? 0.95 : 1.12); ctx.fillRect(-L * 0.26, -hw + 3, L * 0.34, W - 6);
  }
  if (!c.wreck) {
    ctx.fillStyle = '#fff6c0'; ctx.fillRect(hl - 3, -hw + 2, 3, 5); ctx.fillRect(hl - 3, hw - 7, 3, 5);
    ctx.fillStyle = '#d31'; ctx.fillRect(-hl, -hw + 2, 2, 5); ctx.fillRect(-hl, hw - 7, 2, 5);
  }
  if (c.type === 'taxi') { ctx.fillStyle = '#222'; ctx.fillRect(-6, -5, 10, 10); ctx.fillStyle = '#ffe'; ctx.fillRect(-5, -4, 8, 8); }
  if (c.type === 'police' && !c.wreck) {
    const f = c.siren && Math.floor(G.t * 8) % 2;
    ctx.fillStyle = f ? '#f22' : '#511'; ctx.fillRect(-4, -hw + 3, 7, hw - 3);
    ctx.fillStyle = f ? '#225' : '#29f'; ctx.fillRect(-4, 0, 7, hw - 3);
  }
  if (c.hp < 50 && !c.wreck) { ctx.fillStyle = `rgba(0,0,0,${(50 - c.hp) / 120})`; rr(ctx, -hl, -hw, L, W, 6); ctx.fill(); }
  ctx.restore();
}
function drawPed(ctx, p) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
  if (p.hp <= 0) {
    ctx.fillStyle = p.pants; ctx.fillRect(-14, -4, 12, 8);
    ctx.fillStyle = p.shirt; ctx.fillRect(-4, -7, 13, 14);
    ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(12, 0, 5, 0, 7); ctx.fill();
    ctx.restore(); return;
  }
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(2, 3, 9, 9, 0, 0, 7); ctx.fill();
  const w = Math.sin(p.walk) * 5;
  ctx.fillStyle = p.pants; ctx.fillRect(w - 3, -6, 7, 4); ctx.fillRect(-w - 3, 2, 7, 4);
  if (p.weapon > 0) { ctx.fillStyle = '#222'; ctx.fillRect(4, 1, p.weapon === 1 ? 11 : 15, 3); }
  ctx.fillStyle = p.shirt; ctx.beginPath(); ctx.ellipse(0, 0, 5.5, 9, 0, 0, 7); ctx.fill();
  ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(3, -8, 2.5, 0, 7); ctx.arc(3 + (p.weapon > 0 ? 3 : 0), 8, 2.5, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(0.5, 0, 4.6, 0, 7); ctx.fill();
  ctx.fillStyle = p.kind === 'cop' ? '#101a33' : p.kind === 'gang' ? '#111' : p.hair || '#2a1a10';
  ctx.beginPath(); ctx.arc(-0.5, 0, 4.4, Math.PI * 0.55, Math.PI * 1.45); ctx.fill();
  if (p.kind === 'cop') { ctx.fillRect(-3, -4.5, 5, 9); ctx.fillRect(2, -3, 3, 6); }
  ctx.restore();
}
