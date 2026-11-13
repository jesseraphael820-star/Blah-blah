'use strict';
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(1.75, window.devicePixelRatio || 1); W = window.innerWidth; H = window.innerHeight;
  cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  light.width = Math.ceil(W / 2); light.height = Math.ceil(H / 2);
}
const light = document.createElement('canvas'), lctx = light.getContext('2d');
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { if (document.hidden && Game.running && !Game.paused) Game.togglePause(true); });
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { } };

// ===== Entrada (toque + teclado) =====
const Input = { jx: 0, jy: 0, jm: 0, joyId: null, ox: 0, oy: 0, btn: {}, edge: {}, keys: {} };
(function setupInput() {
  const zone = document.getElementById('joyZone'), base = document.getElementById('joyBase'), knob = document.getElementById('joyKnob');
  const R = 55;
  zone.addEventListener('pointerdown', e => {
    if (Input.joyId !== null) return; Input.joyId = e.pointerId; Input.ox = e.clientX; Input.oy = e.clientY;
    base.style.left = (e.clientX - 65) + 'px'; base.style.top = (e.clientY - 65) + 'px'; base.classList.add('on'); knob.style.transform = 'translate(0,0)';
    e.preventDefault();
  });
  window.addEventListener('pointermove', e => {
    if (e.pointerId !== Input.joyId) return;
    let dx = e.clientX - Input.ox, dy = e.clientY - Input.oy; const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    Input.jx = dx / R; Input.jy = dy / R; Input.jm = Math.min(1, d / R);
    knob.style.transform = `translate(${dx}px,${dy}px)`;
  });
  const endJoy = e => { if (e.pointerId !== Input.joyId) return; Input.joyId = null; Input.jx = Input.jy = Input.jm = 0; base.classList.remove('on'); knob.style.transform = 'translate(0,0)'; };
  window.addEventListener('pointerup', endJoy); window.addEventListener('pointercancel', endJoy);
  document.querySelectorAll('[data-k]').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); Input.btn[k] = true; Input.edge[k] = true; b.classList.add('down'); });
    const up = () => { Input.btn[k] = false; b.classList.remove('down'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  });
  const map = { ' ': 'fire', Shift: 'run', f: 'enter', e: 'enter', q: 'weap', Control: 'hand' };
  window.addEventListener('keydown', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!Input.keys[k]) { if (map[k]) Input.edge[map[k]] = true; if (k === 'Escape' || k === 'p') Game.togglePause(); }
    Input.keys[k] = true; if (k === ' ' || k.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; Input.keys[k] = false; });
  window.addEventListener('blur', () => { Input.keys = {}; Input.btn = {}; });
  document.addEventListener('contextmenu', e => e.preventDefault());
})();
function readInput() {
  const k = Input.keys;
  const up = k.w || k.ArrowUp, dn = k.s || k.ArrowDown, lf = k.a || k.ArrowLeft, rt = k.d || k.ArrowRight;
  const r = { mx: Input.jx, my: Input.jy, mag: Input.jm, kb: false, up, dn, lf, rt,
    fire: Input.btn.fire || k[' '], run: Input.btn.run || k.Shift, hand: Input.btn.fire || k[' '] || k.Control, brake: Input.btn.run || k.Shift,
    enter: Input.edge.enter, weap: Input.edge.weap };
  if (up || dn || lf || rt) { r.kb = true; r.mx = (rt ? 1 : 0) - (lf ? 1 : 0); r.my = (dn ? 1 : 0) - (up ? 1 : 0); r.mag = Math.min(1, Math.hypot(r.mx, r.my)); }
  Input.edge = {};
  return r;
}

// ===== Jogo =====
const SPOT = {};
const MISSION_SPOT = {}, SAVE_SPOT = {};
const cam = { x: 0, y: 0, z: 1 };
let PICKS = [];
const Game = {
  running: false, paused: false, over: null, dialog: false,
  init() {
    genWorld(); buildMinimap();
    for (const k in SPECIAL) SPOT[k] = spotOf(k);
    Object.assign(MISSION_SPOT, { x: SPOT.safe.x - 70, y: SPOT.safe.y });
    Object.assign(SAVE_SPOT, { x: SPOT.safe.x + 60, y: SPOT.safe.y });
    resize();
  },
  newGame(load) {
    G.peds = []; G.cars = []; G.parts = []; G.tracers = []; G.skids = []; G.decals = []; G.pickups = [];
    G.heat = 0; G.wanted = 0; G.money = 250; G.armor = 0; G.time = 8 * 60; G.t = 0; G.msgs = [];
    G.ammo = [Infinity, 0, 0, 0]; G.weap = 0; G.mIdx = 0;
    const s = load && Game.loadSave();
    if (s) { G.money = s.money; G.mIdx = s.mIdx; G.ammo = [Infinity, ...s.ammo]; G.armor = s.armor || 0; }
    const pl = makePed(SPOT.safe.x, SPOT.safe.y - 10, 'player');
    pl.shirt = '#e0782a'; pl.pants = '#2a3550'; pl.skin = '#b07a52'; pl.hair = '#1a1008'; pl.cd = 0;
    G.player = pl; pl.a = Math.PI / 2;
    const car = makeCar(lotX(3) + 92, lotY(6) + 206, Math.PI / 2, 'sport'); car.col = '#e0281e'; G.cars.push(car);
    initPickups();
    M.active = null; M.cool = 0;
    cam.x = pl.x; cam.y = pl.y; cam.z = 1;
    for (let i = 0; i < 30; i++) spawnPed({ x: pl.x + rand(-300, 300), y: pl.y + rand(-300, 300) });
    for (let i = 0; i < 14; i++) spawnTraffic(pl);
    this.over = null; this.running = true; this.paused = false;
    if (!s) {
      showMsg('PORTO SOL', 'Use o analógico (esquerda) para andar', 4);
      setTimeout(() => showHint('Toque ENTRAR perto de um carro para dirigir. Vá até o M amarelo no radar para começar uma missão.'), 4500);
    } else showMsg('BEM-VINDO DE VOLTA', '$' + G.money, 3);
  },
  save() {
    try { localStorage.setItem('portosol_save', JSON.stringify({ money: G.money, mIdx: G.mIdx, ammo: G.ammo.slice(1), armor: G.armor })); } catch (e) { }
  },
  loadSave() { try { return JSON.parse(localStorage.getItem('portosol_save')); } catch (e) { return null; } },
  wasted() { if (this.over) return; buzz(300); this.over = { type: 'dead', t: 4 }; SFX.fail(); if (M.active) M.fail('', true); },
  busted() { if (this.over) return; this.over = { type: 'busted', t: 4 }; SFX.fail(); if (M.active) M.fail('', true); },
  respawn() {
    const pl = G.player, dead = this.over.type === 'dead';
    const at = dead ? SPOT.hospital : SPOT.police;
    if (pl.car) { pl.car.driver = null; pl.car = null; }
    pl.x = at.x; pl.y = at.y; pl.hp = 100; pl.arrest = 0; pl.state = 'walk';
    G.money = Math.max(0, G.money - 100); G.ammo = [Infinity, 0, 0, 0]; G.weap = 0; G.armor = 0;
    setWanted(0);
    G.cars = G.cars.filter(c => !c.police); G.peds = G.peds.filter(p => p.kind !== 'cop' && p.kind !== 'gang');
    this.over = null; cam.x = pl.x; cam.y = pl.y;
    showMsg(dead ? 'HOSPITAL' : 'DELEGACIA', '-$100 e armas perdidas', 3);
    Game.save();
  },
  togglePause(force) {
    if (!this.running || this.dialog) return;
    this.paused = force !== undefined ? force : !this.paused;
    document.getElementById('pause').classList.toggle('hidden', !this.paused);
  },
};
// ===== Mensagens =====
let bigMsg = null, hintMsg = null, objMsg = null;
function showMsg(t, sub, dur, col) { bigMsg = { t, sub, dur: dur || 3, life: dur || 3, col: col || '#ffd23f' }; }
function showHint(t, dur) { hintMsg = { t, life: dur || 6 }; }

// ===== Pickups =====
function initPickups() {
  G.pickups = [];
  const r = rng(4242);
  const types = [['cash', 30], ['health', 7], ['armor', 5], ['pistol', 4], ['smg', 3], ['shotgun', 3]];
  for (const [type, n] of types) for (let i = 0; i < n; i++) {
    const ring = { bx: Math.floor(r() * NB), by: Math.floor(r() * NB), p: r() * 1152, off: 0 };
    const [x, y] = ringPos(ring);
    G.pickups.push({ x, y, type, val: type === 'cash' ? 50 + Math.floor(r() * 6) * 25 : 0, respawn: 0, fixed: true });
  }
}
const PK = { cash: ['$', '#3c3'], health: ['+', '#e33'], armor: ['◆', '#39f'], pistol: ['P', '#888'], smg: ['S', '#a6f'], shotgun: ['E', '#f93'] };
function collectPickups(dt) {
  const pl = G.player, src = pl.car || pl;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const k = G.pickups[i];
    if (k.respawn > 0) { k.respawn -= dt; continue; }
    if (k.temp !== undefined) { k.temp -= dt; if (k.temp < 0) { G.pickups.splice(i, 1); continue; } }
    if (Math.abs(k.x - src.x) > 30 || Math.abs(k.y - src.y) > 30 || dist(k, src) > (pl.car ? 30 : 22)) continue;
    let ok = true;
    if (k.type === 'cash') { G.money += k.val; SFX.cash(); floatTxt(k.x, k.y, '+$' + k.val, '#6f6'); }
    else if (k.type === 'health') { if (pl.hp >= 100) ok = false; else { pl.hp = 100; SFX.pickup(); floatTxt(k.x, k.y, 'SAÚDE', '#f66'); } }
    else if (k.type === 'armor') { if (G.armor >= 100) ok = false; else { G.armor = 100; SFX.pickup(); floatTxt(k.x, k.y, 'COLETE', '#6af'); } }
    else { const wi = { pistol: 1, smg: 2, shotgun: 3 }[k.type]; const n = k.val || [0, 34, 90, 16][wi]; G.ammo[wi] += n; if (G.weap === 0) G.weap = wi; SFX.pickup(); floatTxt(k.x, k.y, WEAPONS[wi].name, '#ddd'); }
    if (!ok) continue;
    if (k.fixed) k.respawn = 90; else G.pickups.splice(i, 1);
  }
}
const floats = [];
function floatTxt(x, y, t, c) { floats.push({ x, y, t, c, life: 1.2 }); }

// ===== Missões =====
const RC = i => i * PT + 64;
const MISSIONS = [
  { name: 'De Volta a Porto Sol', reward: 500,
    intro: 'Cinco anos longe e a cidade mudou. O Beto, dono da oficina, guardou um trabalho pra você. Pegue um carro e vá até a OFICINA.',
    steps: [{ t: 'goto', pos: () => SPOT.garage, car: true, text: 'Leve um carro até a OFICINA do Beto' }] },
  { name: 'Entrega Quente', reward: 1200,
    intro: 'O Beto precisa que um pacote saia do GALPÃO do porto e chegue ao BANCO antes que alguém faça perguntas. Seja rápido.',
    steps: [
      { t: 'goto', pos: () => SPOT.dock, text: 'Busque o pacote no GALPÃO do porto' },
      { t: 'goto', pos: () => SPOT.bank, time: 95, text: 'Entregue o pacote no BANCO', enter: () => { setWanted(1); showHint('A polícia ficou desconfiada! Corra até o banco.'); } }] },
  { name: 'Acerto de Contas', reward: 2000,
    intro: 'A gangue dos Corvos está cobrando "proteção" dos quiosques da ORLA. O chefe deles anda armado. Mande um recado.',
    steps: [
      { t: 'goto', pos: () => ({ x: (CITY_T + 1) * T, y: 4 * PT + 120 }), r: 120, text: 'Vá até a ORLA', enter: () => { if (G.ammo[1] < 17) { G.ammo[1] += 34; showHint('O Beto te deu uma PISTOLA. Toque ARMA para trocar.'); } } },
      { t: 'kill', text: 'Elimine o chefe dos Corvos', spawn: () => {
        const bx = (CITY_T + 2) * T, by = 4 * PT + 200, out = [];
        const boss = makePed(bx, by, 'gang'); boss.hp = boss.maxHp = 260; boss.weapon = 2; boss.shirt = '#111'; boss.state = 'guard'; boss.keep = true; boss.boss = true; out.push(boss);
        for (let i = 0; i < 3; i++) { const g = makePed(bx + rand(-90, 90), by + rand(-90, 90), 'gang'); g.state = 'guard'; g.keep = true; out.push(g); }
        G.peds.push(...out); return [boss];
      } },
      { t: 'lose', text: 'Despiste a polícia', enter: () => setWanted(2) },
      { t: 'goto', pos: () => SPOT.safe, text: 'Volte pra CASA' }] },
  { name: 'Corrida da Orla', reward: 2500,
    intro: 'Racha clandestino à meia-noite... ou agora mesmo. Passe por todos os checkpoints antes do tempo acabar. Precisa de um carro rápido!',
    steps: [
      { t: 'goto', pos: () => ({ x: RC(4), y: RC(7) }), car: true, text: 'Vá de carro até a LARGADA' },
      { t: 'cp', car: true, time: 62, text: 'Passe pelos checkpoints!', list: [[7, 7], [9, 7], [9, 4], [9, 1], [6, 1], [6, 3], [3, 3], [3, 5], [4, 7]].map(([i, j]) => ({ x: RC(i), y: RC(j) })) }] },
  { name: 'O Grande Golpe', reward: 10000,
    intro: 'O cofre do BANCO de Porto Sol vai estar aberto por poucos minutos. Pegue o dinheiro, fuja da polícia e leve tudo pra CASA. Dica: a PINTURA tira as estrelas por $100.',
    steps: [
      { t: 'goto', pos: () => SPOT.bank, text: 'Vá até o BANCO' },
      { t: 'lose', text: 'Fuja da polícia! (PINTURA ou se esconda)', enter: () => { setWanted(4); showMsg('ALARME!', 'Saia daí rápido!', 2.5, '#f44'); } },
      { t: 'goto', pos: () => SPOT.safe, text: 'Leve o dinheiro pra CASA' }] },
];
const M = {
  active: null, step: 0, timer: 0, targets: [], cpi: 0, cool: 0, idx: 0,
  start(i) {
    this.active = MISSIONS[i]; this.idx = i; this.step = 0; this.targets = [];
    showMsg(this.active.name.toUpperCase(), '', 2.5, '#fff'); this.enter();
  },
  cur() { return this.active && this.active.steps[this.step]; },
  enter() {
    const s = this.cur(); this.timer = s.time || 0; this.cpi = 0;
    if (s.enter) s.enter();
    if (s.t === 'kill') this.targets = s.spawn();
    objMsg = s.text;
  },
  next() {
    this.step++;
    if (this.step >= this.active.steps.length) return this.complete();
    SFX.cp(); this.enter();
  },
  complete() {
    const m = this.active; G.money += m.reward; G.mIdx = Math.max(G.mIdx, this.idx + 1);
    showMsg('MISSÃO CUMPRIDA!', '+$' + m.reward, 4); SFX.win();
    this.active = null; objMsg = null; this.cleanup(); Game.save();
    if (G.mIdx >= MISSIONS.length) setTimeout(() => showMsg('PORTO SOL É SUA!', 'Todas as missões concluídas. Explore à vontade.', 5), 4200);
  },
  fail(reason, silent) {
    if (!silent) { showMsg('MISSÃO FRACASSADA', reason, 3.5, '#f44'); SFX.fail(); }
    this.active = null; objMsg = null; this.cleanup(); this.cool = 3;
  },
  cleanup() { for (const p of G.peds) if (p.keep) { p.keep = false; } this.targets = []; },
  target() {
    const s = this.cur(); if (!s) return null;
    if (s.t === 'goto') return s.pos();
    if (s.t === 'kill') { const t = this.targets.find(p => p.hp > 0); return t || null; }
    if (s.t === 'cp') return s.list[this.cpi];
    if (s.t === 'lose') return null;
  },
  update(dt) {
    const pl = G.player, me = pl.car || pl;
    if (!this.active) {
      this.cool -= dt;
      if (this.cool > 100 && dist(me, MISSION_SPOT) > 45) this.cool = 0;
      if (G.mIdx < MISSIONS.length && this.cool <= 0 && dist(me, MISSION_SPOT) < 30 && !Game.over) openMissionDialog(G.mIdx);
      return;
    }
    const s = this.cur();
    if (s.time) { this.timer -= dt; if (this.timer <= 0) return this.fail('O tempo acabou!'); }
    if (s.t === 'goto') {
      const p = s.pos();
      if (dist(me, p) < (s.r || 34)) { if (s.car && !pl.car) { if (!this._warn) { showHint('Você precisa estar em um carro!', 3); this._warn = 1; } } else { this._warn = 0; this.next(); } }
    } else if (s.t === 'kill') {
      if (this.targets.every(p => p.hp <= 0)) this.next();
    } else if (s.t === 'lose') {
      if (G.wanted === 0) this.next();
    } else if (s.t === 'cp') {
      const p = s.list[this.cpi];
      if (pl.car && dist(pl.car, p) < 80) { this.cpi++; SFX.cp(); if (this.cpi >= s.list.length) this.next(); }
    }
  },
};
function openMissionDialog(i) {
  const m = MISSIONS[i]; Game.dialog = true; Game.paused = true;
  document.getElementById('dTitle').textContent = m.name;
  document.getElementById('dText').textContent = m.intro;
  document.getElementById('dReward').textContent = 'Recompensa: $' + m.reward;
  document.getElementById('dOk').textContent = 'COMEÇAR';
  document.getElementById('dNo').textContent = 'AGORA NÃO';
  document.getElementById('dExtra').innerHTML = '';
  document.getElementById('dialog').classList.remove('hidden');
  dialogCb = ok => { if (ok) M.start(i); else M.cool = 1e9; };
}
let dialogCb = null;
function closeDialog(ok) {
  document.getElementById('dialog').classList.add('hidden'); Game.dialog = false; Game.paused = false;
  const cb = dialogCb; dialogCb = null; if (cb) cb(ok);
}
function openShop() {
  Game.dialog = true; Game.paused = true;
  document.getElementById('dTitle').textContent = 'LOJA DE ARMAS';
  document.getElementById('dText').textContent = 'Dinheiro: $' + G.money;
  document.getElementById('dReward').textContent = '';
  document.getElementById('dOk').textContent = 'SAIR';
  document.getElementById('dNo').textContent = '';
  const items = [['Pistola +34 balas', 200, () => G.ammo[1] += 34], ['Submetralhadora +90', 600, () => G.ammo[2] += 90], ['Escopeta +16', 700, () => G.ammo[3] += 16], ['Colete', 300, () => G.armor = 100], ['Kit médico', 150, () => G.player.hp = 100]];
  const ex = document.getElementById('dExtra'); ex.innerHTML = '';
  for (const [n, p, f] of items) {
    const b = document.createElement('button'); b.className = 'shopItem'; b.innerHTML = `<span>${n}</span><b>$${p}</b>`;
    b.onclick = () => { if (G.money < p) { b.classList.add('no'); setTimeout(() => b.classList.remove('no'), 300); return; } G.money -= p; f(); SFX.cash(); document.getElementById('dText').textContent = 'Dinheiro: $' + G.money; };
    ex.appendChild(b);
  }
  document.getElementById('dialog').classList.remove('hidden');
  dialogCb = () => { shopCool = 1e9; };
}
let shopCool = 0, paintCool = 0, saveCool = 0;
function updateServices(dt) {
  const pl = G.player, me = pl.car || pl;
  const near = (p, r) => dist(me, p) < r;
  if (!pl.car) { if (near(SPOT.guns, 30)) { if (shopCool <= 0) openShop(); } else shopCool = 0; }
  if (pl.car) {
    if (near(SPOT.paint, 50)) {
      if (paintCool <= 0) {
        paintCool = 1e9;
        if (G.wanted > 0 || pl.car.hp < 100) {
          if (G.money >= 100) { G.money -= 100; setWanted(0); pl.car.hp = 100; pl.car.col = pick(CARTYPES.sedan.cols); showMsg('PINTURA NOVA', 'Estrelas zeradas e carro consertado: -$100', 3, '#6f6'); SFX.cash(); }
          else showHint('Você precisa de $100 para a pintura.', 3);
        }
      }
    } else paintCool = 0;
  }
  if (!pl.car) {
    if (near(SAVE_SPOT, 26)) { if (saveCool <= 0) { saveCool = 1e9; Game.save(); showMsg('JOGO SALVO', '', 2, '#7cf'); } } else saveCool = 0;
  }
}

// ===== Jogador =====
function findTarget(pl, range, facing) {
  let best = null, bs = 1e9;
  for (const p of G.peds) {
    if (p.hp <= 0 || p.car) continue;
    const d = dist(p, pl); if (d > range) continue;
    const ad = Math.abs(angN(Math.atan2(p.y - pl.y, p.x - pl.x) - facing));
    if (ad > 1.0) continue;
    const hostile = p.kind === 'gang' || (p.kind === 'cop' && G.wanted > 0) || p.state === 'attack';
    const sc = d + ad * 150 - (hostile ? 250 : 0);
    if (sc < bs && los(pl, p)) { bs = sc; best = p; }
  }
  for (const c of G.cars) {
    if (c.wreck || !c.police || !c.driver || c.driver === pl) continue;
    const d = dist(c, pl); if (d > range) continue;
    const ad = Math.abs(angN(Math.atan2(c.y - pl.y, c.x - pl.x) - facing)); if (ad > 0.8) continue;
    if (d + ad * 150 < bs) { bs = d + ad * 150; best = c; }
  }
  return best;
}
let aimT = null;
function updatePlayer(dt, inp) {
  const pl = G.player;
  if (pl.hp <= 0) return;
  if (inp.weap && pl.car) Radio.next();
  else if (inp.weap) { const owned = [0, 1, 2, 3].filter(i => G.ammo[i] > 0); const i = owned.indexOf(G.weap); G.weap = owned[(i + 1) % owned.length]; SFX.pickup(); }
  if (G.ammo[G.weap] <= 0) G.weap = 0;
  pl.weapon = G.weap;
  pl.cd -= dt;
  if (pl.car) return updateDriving(dt, inp);
  const run = inp.run || inp.mag > 0.92;
  const sp = inp.mag > 0.12 ? (run ? 170 : 100) * Math.min(1, inp.mag * 1.25) : 0;
  if (sp > 0) {
    const a = Math.atan2(inp.my, inp.mx); pl.x += Math.cos(a) * sp * dt; pl.y += Math.sin(a) * sp * dt; pl.a = a; pl.walk += sp * dt * 0.16;
  }
  resolveCircle(pl, 8);
  for (const c of G.cars) {
    if (Math.abs(c.x - pl.x) > 50 || Math.abs(c.y - pl.y) > 50) continue;
    for (const [cx, cy] of carCircles(c)) {
      const dx = pl.x - cx, dy = pl.y - cy, d = Math.hypot(dx, dy), m = c.W * 0.55 + 8;
      if (d < m && d > 0) {
        pl.x = cx + dx / d * m; pl.y = cy + dy / d * m;
        if (c.spd > 110 && c.driver) { damagePed(pl, c.spd * 0.18, c); }
      }
    }
  }
  const w = WEAPONS[G.weap];
  aimT = findTarget(pl, w.melee ? 40 : w.range, pl.a);
  if (inp.fire && pl.cd <= 0) {
    const a = aimT ? Math.atan2(aimT.y - pl.y, aimT.x - pl.x) : pl.a;
    pl.a = a; shoot(pl, a, G.weap); pl.cd = w.cd;
    if (!w.melee) G.ammo[G.weap]--;
  }
  if (inp.enter) {
    let best = null, bd = 60;
    for (const c of G.cars) { if (c.wreck) continue; const d = dist(c, pl); if (d < bd) { bd = d; best = c; } }
    if (best) enterCar(best);
  }
  // prisão
  if (pl.arrest > 0) { pl.arrest -= dt * 0.35; if (pl.arrest > 1.3) Game.busted(); }
}
function enterCar(c) {
  const pl = G.player;
  if (c.driver && c.driver !== pl) {
    const d = c.driver; d.car = null; d.x = c.x - Math.sin(c.a) * 24; d.y = c.y + Math.cos(c.a) * 24; resolveCircle(d, 8);
    if (d.kind === 'cop') { d.state = 'chase'; crime(4); }
    else {
      d.state = Math.random() < 0.25 ? 'attack' : 'flee'; d.t = 6; d.from = { x: pl.x, y: pl.y }; d.ring = null;
      if (G.peds.some(p => p.kind === 'cop' && p.hp > 0 && dist(p, pl) < 400) || G.cars.some(o => o.police && o.driver && dist(o, pl) < 400)) crime(1);
    }
    G.peds.push(d);
    if (c.police) crime(4);
  }
  c.driver = pl; c.ai = null; pl.car = c; c.siren = false; c.cops = 0; SFX.door(); Radio.next();
  if (!G.droveHint) { G.droveHint = 1; showHint('Aponte o analógico para onde quer ir — o carro acelera sozinho. FREIO/RÉ para frear e dar ré, DRIFT para o freio de mão.', 7); }
  if (c.police) c.police = false;
  c.vx = Math.cos(c.a) * (c.spd || 0) * 0.3; c.vy = Math.sin(c.a) * (c.spd || 0) * 0.3;
}
function exitCar() {
  const pl = G.player, c = pl.car; if (!c) return;
  const lx = Math.sin(c.a), ly = -Math.cos(c.a);
  let ok = false;
  for (const s of [1, -1]) {
    const x = c.x + lx * s * (c.W / 2 + 12), y = c.y + ly * s * (c.W / 2 + 12);
    if (!solidAt(x, y)) { pl.x = x; pl.y = y; ok = true; break; }
  }
  if (!ok) { pl.x = c.x; pl.y = c.y; }
  c.driver = null; c.ai = null; pl.car = null; pl.a = c.a; SFX.door();
}
function updateDriving(dt, inp) {
  const pl = G.player, c = pl.car;
  pl.x = c.x; pl.y = c.y;
  if (inp.enter && c.spd < 140) { exitCar(); return; }
  let thr = 0, steer = 0, brake = false;
  if (inp.kb) {
    thr = inp.up ? 1 : 0; brake = !!inp.dn; steer = (inp.rt ? 1 : 0) - (inp.lf ? 1 : 0);
  } else if (inp.mag > 0.15) {
    const ja = Math.atan2(inp.my, inp.mx);
    const reversing = inp.brake && (c.fwd || 0) < 25;
    const head = reversing ? c.a + Math.PI : c.a;
    const diff = angN(ja - head);
    steer = clamp(diff * 2.4, -1, 1) * (reversing ? -1 : 1);
    if (reversing) { brake = true; }
    else if (Math.abs(diff) > 2.3 && (c.fwd || 0) > 60) brake = true;
    else thr = Math.min(1, inp.mag * 1.25) * (Math.abs(diff) > 1.6 ? 0.5 : 1);
    if (inp.brake && !reversing) brake = true;
  } else if (inp.brake) brake = true;
  const hand = inp.kb ? !!(Input.keys[' '] || Input.keys.Control) : !!Input.btn.fire;
  driveCar(c, thr, steer, brake, hand, dt);
  if (c.fire > 0 && c.fire < 1.5 && !Game.over) showHint('O carro vai explodir! Toque SAIR!', 1);
}

// ===== População =====
let popT = 0, polT = 0;
function populate(dt) {
  const pl = G.player, me = pl.car || pl;
  popT -= dt; if (popT > 0) return; popT = 0.35;
  G.cars = G.cars.filter(c => { const d = dist(c, me); if (c === pl.car) return true; if (c.keep) return true; if (c.wreck && d > 900) return false; return d < (c.police && G.wanted ? 1900 : 1400); });
  G.peds = G.peds.filter(p => { if (p.keep) return true; if (p.hp <= 0 && p.deadT > 25) return false; return dist(p, me) < 1300; });
  const night = darkness() > 0.3;
  const traffic = G.cars.filter(c => c.ai).length, civs = G.peds.filter(p => p.kind === 'civ' && p.hp > 0).length;
  if (traffic < (night ? 11 : 17)) spawnTraffic(me);
  if (civs < (night ? 14 : 28)) spawnPed(me);
  polT -= 0.35;
  if (G.wanted > 0 && polT <= 0) {
    const pc = G.cars.filter(c => c.police && c.driver && !c.wreck).length;
    const fc = G.peds.filter(p => p.kind === 'cop' && p.hp > 0 && dist(p, me) < 900).length;
    if (pc < [0, 1, 2, 3, 4, 6][G.wanted]) { spawnPolice(me); polT = 2.5 - G.wanted * 0.3; }
    else if (fc < Math.min(4, G.wanted + 1)) { spawnPed(me, 'cop'); polT = 2; }
  }
}
function updateWanted(dt) {
  if (G.wanted === 0) return;
  const me = G.player.car || G.player;
  let seen = false;
  for (const c of G.cars) if (c.police && c.driver && !c.wreck && dist(c, me) < 420) { seen = true; break; }
  if (!seen) for (const p of G.peds) if (p.kind === 'cop' && p.hp > 0 && !p.car && dist(p, me) < 380) { seen = true; break; }
  if (seen) G.unseen = 0; else G.unseen += dt;
  if (G.unseen > 13 + G.wanted * 3) { G.wanted--; G.heat = HEAT_THR[G.wanted]; G.unseen = 0; if (G.wanted === 0) showHint('Você despistou a polícia.', 3); }
}
function darkness() {
  const h = (G.time / 60) % 24;
  if (h < 5 || h >= 21) return 0.62; if (h < 7) return lerp(0.62, 0, (h - 5) / 2); if (h >= 19) return lerp(0, 0.62, (h - 19) / 2); return 0;
}

// ===== Loop principal =====
function update(dt) {
  G.t += dt; G.time = (G.time + dt) % 1440;
  const inp = Game.over ? { mx: 0, my: 0, mag: 0 } : readInput();
  if (Game.over) { Game.over.t -= dt; if (Game.over.t <= 0) Game.respawn(); }
  updatePlayer(dt, inp);
  const pl = G.player;
  for (const c of G.cars) {
    if (c === pl.car) { carWorldCollide(c); }
    else if (c.wreck || !c.driver) { driveCar(c, 0, 0, false, false, dt); if (c.spd > 2) carWorldCollide(c); }
    else if (c.driver.kind === 'cop') { aiPolice(c, dt); carWorldCollide(c); }
    else if (c.ai) {
      if (c.fire > 0 && c.driver) { const d = c.driver; d.car = null; d.x = c.x + 20; d.y = c.y; d.state = 'flee'; d.t = 5; d.from = c; d.ring = null; G.peds.push(d); c.driver = null; c.ai = null; continue; }
      aiTraffic(c, dt);
    }
    if (c.fire > 0) {
      c.fire -= dt; if (Math.random() < 0.6) G.parts.push({ x: c.x + rand(-10, 10), y: c.y + rand(-8, 8), vx: rand(-10, 10), vy: rand(-30, -10), life: .5, max: .5, size: rand(6, 12), type: 'fire' });
      if (c.fire <= 0) explode(c);
    } else if (!c.wreck && c.hp < 35 && Math.random() < 0.25) G.parts.push({ x: c.x + Math.cos(c.a) * c.L * .35, y: c.y + Math.sin(c.a) * c.L * .35, vx: rand(-10, 10), vy: rand(-25, -5), life: 1.2, max: 1.2, size: 6, type: 'smoke' });
  }
  // colisões carro x carro
  const cs = G.cars;
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) carCarCollide(cs[i], cs[j]);
  // carro x pedestre
  for (const c of cs) {
    if (c.spd < 30) continue;
    for (const p of G.peds) {
      if (p.hp <= 0 || p.car || Math.abs(p.x - c.x) > 45 || Math.abs(p.y - c.y) > 45) continue;
      for (const [cx, cy] of carCircles(c)) {
        const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy), m = c.W * 0.55 + 8;
        if (d < m && d > 0) {
          p.x = cx + dx / d * m; p.y = cy + dy / d * m;
          if (c.spd > 90) { damagePed(p, c.spd * 0.45, c.driver === pl ? pl : null); if (c === pl.car) { SFX.thud(); } p.x += c.vx * 0.06; p.y += c.vy * 0.06; }
          break;
        }
      }
    }
  }
  for (const p of G.peds) updatePed(p, dt);
  populate(dt); updateWanted(dt); collectPickups(dt); M.update(dt);
  if (!Game.over) updateServices(dt);
  // partículas
  for (const q of G.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94; q.life -= dt; if (q.type === 'smoke') q.size += dt * 14; }
  G.parts = G.parts.filter(q => q.life > 0); if (G.parts.length > 500) G.parts.splice(0, G.parts.length - 500);
  for (const t of G.tracers) t.life -= dt; G.tracers = G.tracers.filter(t => t.life > 0);
  for (const s of G.skids) s.life -= dt; G.skids = G.skids.filter(s => s.life > 0);
  for (const d of G.decals) d.life -= dt; G.decals = G.decals.filter(d => d.life > 0);
  for (const f of floats) { f.life -= dt; f.y -= 30 * dt; } for (let i = floats.length - 1; i >= 0; i--) if (floats[i].life <= 0) floats.splice(i, 1);
  Radio.t -= dt;
  if (bigMsg) { bigMsg.life -= dt; if (bigMsg.life <= 0) bigMsg = null; }
  if (hintMsg) { hintMsg.life -= dt; if (hintMsg.life <= 0) hintMsg = null; }
  starFlash = Math.max(0, starFlash - dt); G.shake = Math.max(0, G.shake - dt * 30); G.hurt = Math.max(0, (G.hurt || 0) - dt);
  // câmera
  const me = pl.car || pl;
  const look = pl.car ? 0.45 : 0;
  cam.x = lerp(cam.x, me.x + (me.vx || 0) * look, 1 - Math.pow(0.002, dt));
  cam.y = lerp(cam.y, me.y + (me.vy || 0) * look, 1 - Math.pow(0.002, dt));
  const viewH = pl.car ? 600 + Math.min(320, pl.car.spd * 0.9) : 530;
  const tz = Math.min(W, H * 1.6) / viewH;
  cam.z = lerp(cam.z, tz, 1 - Math.pow(0.15, dt));
  let sirD = 1e9; for (const c of G.cars) if (c.siren && !c.wreck) sirD = Math.min(sirD, dist(c, me));
  SFX.update(dt, pl.car ? pl.car.spd : 0, !!pl.car, sirD < 900, sirD); Radio.update(!!pl.car && !Game.over);
  updateButtons();
}
function carCarCollide(a, b) {
  if (Math.abs(a.x - b.x) > 75 || Math.abs(a.y - b.y) > 75) return;
  const ra = a.W * 0.55, rb = b.W * 0.55;
  for (const ca of carCircles(a)) for (const cb of carCircles(b)) {
    const dx = ca[0] - cb[0], dy = ca[1] - cb[1], d = Math.hypot(dx, dy), m = ra + rb;
    if (d >= m || d === 0) continue;
    const nx = dx / d, ny = dy / d, pen = m - d;
    a.x += nx * pen * 0.5; a.y += ny * pen * 0.5; b.x -= nx * pen * 0.5; b.y -= ny * pen * 0.5;
    const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (vn < 0) {
      const j = -vn * 0.6;
      if (a.ai) a.spd *= 0.4; else { a.vx += nx * j; a.vy += ny * j; }
      if (b.ai) b.spd *= 0.4; else { b.vx -= nx * j; b.vy -= ny * j; }
      if (-vn > 70) {
        const pl = G.player, inv = a === pl.car || b === pl.car;
        damageCar(a, -vn * 0.035, b === pl.car ? pl : null); damageCar(b, -vn * 0.035, a === pl.car ? pl : null);
        sparks((ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2, 6);
        if (inv) { buzz(40); SFX.crash(-vn / 400); G.shake = Math.max(G.shake, Math.min(10, -vn / 35)); }
      }
    }
    return;
  }
}
// ===== Botões contextuais =====
const bEnter = document.getElementById('bEnter'), bRun = document.getElementById('bRun'), bFire = document.getElementById('bFire'), bWeap = document.getElementById('bWeap');
let lastBtnState = '';
function updateButtons() {
  const pl = G.player; const inCar = !!pl.car;
  let near = false; if (!inCar) for (const c of G.cars) if (!c.wreck && dist(c, pl) < 60) { near = true; break; }
  const st = inCar + '|' + near + '|' + G.weap + '|' + G.ammo[G.weap];
  if (st === lastBtnState) return; lastBtnState = st;
  bEnter.textContent = inCar ? 'SAIR' : 'ENTRAR'; bEnter.classList.toggle('glow', near || inCar);
  bRun.textContent = inCar ? 'FREIO/RÉ' : 'CORRER';
  bFire.textContent = inCar ? 'DRIFT' : G.weap === 0 ? 'SOCO' : 'ATIRAR';
  bWeap.innerHTML = inCar ? '<small>RÁDIO</small>📻' : `<small>ARMA</small>${WEAPONS[G.weap].icon}`;
}

// ===== Render =====
function render() {
  const pl = G.player;
  const z = cam.z, sx = G.shake ? rand(-G.shake, G.shake) * 0.5 : 0, sy = G.shake ? rand(-G.shake, G.shake) * 0.5 : 0;
  ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - (cam.x + sx) * z), DPR * (H / 2 - (cam.y + sy) * z));
  const v = { x0: cam.x - W / 2 / z, x1: cam.x + W / 2 / z, y0: cam.y - H / 2 / z, y1: cam.y + H / 2 / z };
  ctx.imageSmoothingEnabled = true;
  drawGround(ctx, v);
  for (const d of G.decals) { ctx.fillStyle = d.c; ctx.globalAlpha = Math.min(1, d.life / 5); ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(15,15,15,.45)';
  for (const s of G.skids) { if (s.x < v.x0 || s.x > v.x1 || s.y < v.y0 || s.y > v.y1) continue; ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a); ctx.globalAlpha = Math.min(1, s.life / 3) * 0.6; ctx.fillRect(-4, -2.5, 8, 5); ctx.restore(); }
  ctx.globalAlpha = 1;
  drawMarkers(ctx, false);
  for (const k of G.pickups) {
    if (k.respawn > 0 || k.x < v.x0 - 20 || k.x > v.x1 + 20 || k.y < v.y0 - 20 || k.y > v.y1 + 20) continue;
    const b = Math.sin(G.t * 4 + k.x) * 2, [ch, col] = PK[k.type];
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(k.x, k.y + 6, 8, 3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(k.x, k.y - 4 + b, 9, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '900 11px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, k.x, k.y - 3.5 + b);
  }
  const inV = o => o.x > v.x0 - 60 && o.x < v.x1 + 60 && o.y > v.y0 - 60 && o.y < v.y1 + 60;
  for (const p of G.peds) if (p.hp <= 0 && inV(p)) drawPed(ctx, p);
  for (const q of G.parts) if (q.type === 'blood') { ctx.fillStyle = '#a01010'; ctx.fillRect(q.x - 1.5, q.y - 1.5, 3, 3); }
  for (const p of G.peds) if (p.hp > 0 && !p.car && inV(p)) drawPed(ctx, p);
  if (!pl.car && pl.hp > 0) drawPed(ctx, pl);
  if (!pl.car && pl.hp <= 0) drawPed(ctx, pl);
  for (const c of G.cars) if (inV(c)) drawCar(ctx, c);
  // alvo
  if (aimT && !pl.car && aimT.hp !== undefined && (aimT.hp > 0)) {
    ctx.strokeStyle = aimT.kind === 'civ' ? 'rgba(255,255,255,.8)' : 'rgba(255,60,60,.9)'; ctx.lineWidth = 2;
    const r = 13 + Math.sin(G.t * 10) * 2; ctx.beginPath(); ctx.arc(aimT.x, aimT.y, r, 0, 7); ctx.stroke();
    if (aimT.maxHp && aimT.hp < aimT.maxHp) { ctx.fillStyle = '#000'; ctx.fillRect(aimT.x - 14, aimT.y - 22, 28, 4); ctx.fillStyle = '#e33'; ctx.fillRect(aimT.x - 14, aimT.y - 22, 28 * aimT.hp / aimT.maxHp, 4); }
  }
  ctx.lineWidth = 1.5;
  for (const t of G.tracers) { ctx.strokeStyle = `rgba(255,230,150,${t.life * 12})`; ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke(); }
  const night = darkness() > 0.3;
  drawBuildings(ctx, cam, v, night);
  for (const q of G.parts) {
    if (q.type === 'blood') continue;
    const a = q.life / q.max;
    if (q.type === 'smoke') { ctx.fillStyle = `rgba(60,60,60,${a * 0.45})`; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.fill(); }
    else if (q.type === 'fire') { ctx.fillStyle = `rgba(255,${120 + a * 120 | 0},30,${a})`; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.5 + a * 0.5), 0, 7); ctx.fill(); }
    else if (q.type === 'spark') { ctx.fillStyle = '#ffdc6a'; ctx.fillRect(q.x - 1, q.y - 1, 2.5, 2.5); }
    else if (q.type === 'flash') { ctx.fillStyle = 'rgba(255,240,180,.9)'; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.fill(); }
  }
  drawMarkers(ctx, true);
  ctx.textAlign = 'center'; ctx.font = '900 14px Arial';
  for (const f of floats) { ctx.globalAlpha = Math.min(1, f.life * 2); ctx.fillStyle = '#000'; ctx.fillText(f.t, f.x + 1, f.y + 1); ctx.fillStyle = f.c; ctx.fillText(f.t, f.x, f.y); }
  ctx.globalAlpha = 1;
  // noite
  const dk = darkness();
  if (dk > 0.01) drawNight(dk, v, z);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (G.hurt > 0) { ctx.fillStyle = `rgba(200,0,0,${G.hurt * 0.5})`; ctx.fillRect(0, 0, W, H); }
  drawHUD();
}
function drawNight(dk, v, z) {
  const lw = light.width, lh = light.height, s = 0.5 * z;
  const tx = x => (x - cam.x) * s + lw / 2, ty = y => (y - cam.y) * s + lh / 2;
  lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(0, 0, lw, lh);
  lctx.fillStyle = `rgba(8,12,40,${dk})`; lctx.fillRect(0, 0, lw, lh);
  lctx.globalCompositeOperation = 'destination-out';
  const glow = (x, y, r, a) => { const g = lctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); lctx.fillStyle = g; lctx.fillRect(x - r, y - r, r * 2, r * 2); };
  // postes nas esquinas
  for (let i = Math.max(0, Math.floor(v.x0 / PT)); i <= Math.min(NB, Math.ceil(v.x1 / PT)); i++)
    for (let j = Math.max(0, Math.floor(v.y0 / PT)); j <= Math.min(NB, Math.ceil(v.y1 / PT)); j++) {
      glow(tx(i * PT + 140), ty(j * PT + 140), 90 * s, 0.75); glow(tx(i * PT - 12), ty(j * PT - 12), 90 * s, 0.75);
    }
  const me = G.player.car || G.player; glow(tx(me.x), ty(me.y), 110 * s, 0.5);
  for (const c of G.cars) {
    if (c.wreck || c.x < v.x0 - 200 || c.x > v.x1 + 200 || c.y < v.y0 - 200 || c.y > v.y1 + 200) continue;
    const fx = Math.cos(c.a), fy = Math.sin(c.a);
    for (let k = 1; k <= 3; k++) glow(tx(c.x + fx * (20 + k * 34)), ty(c.y + fy * (20 + k * 34)), (22 + k * 12) * s, 0.8);
  }
  for (const q of G.parts) if (q.type === 'fire' || q.type === 'flash') glow(tx(q.x), ty(q.y), 60 * s, 0.6);
  for (const k of G.pickups) if (k.respawn <= 0 && k.x > v.x0 && k.x < v.x1 && k.y > v.y0 && k.y < v.y1) glow(tx(k.x), ty(k.y), 30 * s, 0.6);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(light, 0, 0, cv.width, cv.height);
  // giroflex
  ctx.globalCompositeOperation = 'lighter';
  for (const c of G.cars) if (c.siren && !c.wreck) {
    const X = ((c.x - cam.x) * z + W / 2) * DPR, Y = ((c.y - cam.y) * z + H / 2) * DPR;
    if (X < -200 || Y < -200 || X > cv.width + 200 || Y > cv.height + 200) continue;
    const red = Math.floor(G.t * 8) % 2; const g = ctx.createRadialGradient(X, Y, 0, X, Y, 90 * z * DPR);
    g.addColorStop(0, red ? 'rgba(255,40,40,.35)' : 'rgba(40,80,255,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(X - 90 * z * DPR, Y - 90 * z * DPR, 180 * z * DPR, 180 * z * DPR);
  }
  ctx.globalCompositeOperation = 'source-over';
}
function markerList() {
  const out = [];
  if (!M.active && G.mIdx < MISSIONS.length) out.push({ p: MISSION_SPOT, c: '255,210,40', l: 'M', r: 22 });
  out.push({ p: SPOT.guns, c: '80,220,80', l: '$', r: 18 });
  out.push({ p: SPOT.paint, c: '255,100,200', l: '🎨', r: 34 });
  out.push({ p: SAVE_SPOT, c: '90,170,255', l: '💾', r: 16 });
  if (M.active) {
    const s = M.cur(), t = M.target();
    if (t && s.t !== 'kill') out.push({ p: t, c: s.t === 'cp' ? '255,60,60' : '255,210,40', l: s.t === 'cp' ? String(M.cpi + 1) : '', r: s.t === 'cp' ? 60 : (s.r || 28), obj: true });
  }
  return out;
}
function drawMarkers(c, top) {
  for (const m of markerList()) {
    const { x, y } = m.p, pulse = 1 + Math.sin(G.t * 5) * 0.08;
    if (!top) {
      c.fillStyle = `rgba(${m.c},.25)`; c.beginPath(); c.arc(x, y, m.r * pulse, 0, 7); c.fill();
      c.strokeStyle = `rgba(${m.c},.9)`; c.lineWidth = 3; c.beginPath(); c.arc(x, y, m.r * pulse, 0, 7); c.stroke();
    } else {
      const g = c.createLinearGradient(x, y, x, y - 90); g.addColorStop(0, `rgba(${m.c},.45)`); g.addColorStop(1, `rgba(${m.c},0)`);
      c.fillStyle = g; c.fillRect(x - m.r * 0.5, y - 90, m.r, 90);
      if (m.l) { const by = y - 40 + Math.sin(G.t * 3) * 5; c.fillStyle = `rgb(${m.c})`; c.beginPath(); c.arc(x, by, 12, 0, 7); c.fill(); c.fillStyle = '#111'; c.font = '900 13px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(m.l, x, by + 1); }
    }
  }
}
function txt(t, x, y, size, col, align, stroke) {
  ctx.font = `900 ${size}px "Arial Black", Arial, sans-serif`; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
  ctx.lineWidth = stroke || Math.max(3, size / 5); ctx.strokeStyle = '#000'; ctx.lineJoin = 'round'; ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.fillText(t, x, y);
}
function drawHUD() {
  const pl = G.player, u = clamp(Math.min(W, H) / 420, 0.75, 1.5);
  // radar
  const R = 62 * u, rx = 14 + R + (window.SAFE_L || 0), ry = 14 + R;
  ctx.save(); ctx.beginPath(); ctx.arc(rx, ry, R, 0, 7); ctx.clip();
  ctx.fillStyle = '#1a3f66'; ctx.fillRect(rx - R, ry - R, R * 2, R * 2);
  const ms = 2.2 * u, me = pl.car || pl;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(MINIMAP, rx - me.x / T * ms, ry - me.y / T * ms, MAP_TW * ms, MAP_TH * ms);
  ctx.imageSmoothingEnabled = true;
  ctx.restore();
  const blip = (x, y, col, sz, label, clampIt) => {
    let dx = (x - me.x) / T * ms, dy = (y - me.y) / T * ms; const d = Math.hypot(dx, dy);
    if (d > R - 6) { if (!clampIt) return; dx *= (R - 6) / d; dy *= (R - 6) / d; }
    ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(rx + dx, ry + dy, sz * u, 0, 7); ctx.fill(); ctx.stroke();
    if (label) { ctx.fillStyle = '#000'; ctx.font = `900 ${9 * u}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, rx + dx, ry + dy + 0.5); }
  };
  for (const k of G.pickups) if (k.respawn <= 0 && k.type !== 'cash') blip(k.x, k.y, PK[k.type][1], 2.2);
  blip(SPOT.guns.x, SPOT.guns.y, '#5d5', 5, '$', true);
  blip(SPOT.paint.x, SPOT.paint.y, '#f6c', 5, 'P', true);
  blip(SAVE_SPOT.x, SAVE_SPOT.y, '#5af', 5, 'C', true);
  for (const c of G.cars) if (c.police && c.driver && !c.wreck) blip(c.x, c.y, Math.floor(G.t * 6) % 2 ? '#f33' : '#36f', 3.5);
  for (const p of G.peds) if (p.hp > 0 && (p.kind === 'cop' && G.wanted > 0 || p.kind === 'gang' && p.keep)) blip(p.x, p.y, p.kind === 'cop' ? '#69f' : '#e33', 2.5);
  if (!M.active && G.mIdx < MISSIONS.length) blip(MISSION_SPOT.x, MISSION_SPOT.y, '#fd2', 6, 'M', true);
  const tg = M.target(); if (tg) blip(tg.x, tg.y, M.cur().t === 'cp' ? '#f44' : '#fd2', 5.5, '', true);
  ctx.save(); ctx.translate(rx, ry); ctx.rotate((pl.car ? pl.car.a : pl.a) + Math.PI / 2);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -7 * u); ctx.lineTo(5 * u, 6 * u); ctx.lineTo(0, 3 * u); ctx.lineTo(-5 * u, 6 * u); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 4 * u; ctx.beginPath(); ctx.arc(rx, ry, R, 0, 7); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(rx, ry, R - 2 * u, 0, 7); ctx.stroke();
  txt('N', rx, ry - R + 9 * u, 10 * u, '#fff', 'center', 3);
  // painel direito
  const X = W - 16 - (window.SAFE_R || 0); let y = 22 * u;
  const hh = Math.floor(G.time / 60), mm = Math.floor(G.time % 60);
  txt(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'), X, y, 20 * u, '#fff', 'right'); y += 26 * u;
  const bw = 130 * u, bh = 10 * u;
  ctx.fillStyle = '#000'; ctx.fillRect(X - bw - 2, y - 2, bw + 4, bh + 4);
  ctx.fillStyle = '#5a1010'; ctx.fillRect(X - bw, y, bw, bh);
  ctx.fillStyle = pl.hp < 25 && Math.floor(G.t * 4) % 2 ? '#ff6060' : '#d42a2a'; ctx.fillRect(X - bw, y, bw * pl.hp / 100, bh); y += bh + 6;
  if (G.armor > 0) { ctx.fillStyle = '#000'; ctx.fillRect(X - bw - 2, y - 2, bw + 4, bh * .7 + 4); ctx.fillStyle = '#ddd'; ctx.fillRect(X - bw, y, bw * G.armor / 100, bh * .7); y += bh * .7 + 6; }
  y += 12 * u;
  txt('$' + String(Math.floor(G.money)).padStart(8, '0'), X, y, 22 * u, '#5dd35d', 'right'); y += 28 * u;
  for (let i = 0; i < 5; i++) {
    const on = i < G.wanted, fl = starFlash > 0 && Math.floor(G.t * 8) % 2;
    const sx = X - i * 22 * u - 9 * u;
    ctx.font = `${20 * u}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = on ? (fl || (G.unseen > 2 && Math.floor(G.t * 3) % 2) ? '#fff' : '#ffc61a') : 'rgba(0,0,0,.35)';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText('★', sx, y); ctx.fillText('★', sx, y);
  }
  y += 26 * u;
  const w = WEAPONS[G.weap];
  txt(w.name + (w.melee ? '' : '  ' + G.ammo[G.weap]), X, y, 12 * u, '#eee', 'right', 3);
  // objetivo e timer
  if (M.active) {
    const s = M.cur();
    let t = objMsg || ''; if (s && s.t === 'cp') t += `  (${M.cpi}/${s.list.length})`;
    ctx.font = `900 ${14 * u}px Arial`; const tw = ctx.measureText(t).width + 24;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(ctx, W / 2 - tw / 2, H - 46 * u - 10, tw, 30 * u, 8); ctx.fill();
    txt(t, W / 2, H - 31 * u - 10, 14 * u, '#ffe27a', 'center', 3);
    if (s && s.time) { const tm = Math.max(0, M.timer); txt(`${Math.floor(tm / 60)}:${String(Math.floor(tm % 60)).padStart(2, '0')}`, W / 2, 30 * u, 26 * u, tm < 10 ? '#f55' : '#fff', 'center'); }
    // seta para objetivo
    if (tg) {
      const z = cam.z, sx = (tg.x - cam.x) * z + W / 2, sy = (tg.y - cam.y) * z + H / 2;
      if (sx < 0 || sx > W || sy < 0 || sy > H) {
        const a = Math.atan2(sy - H / 2, sx - W / 2);
        const ex = W / 2 + Math.cos(a) * (Math.min(W, H) / 2 - 40), ey = H / 2 + Math.sin(a) * (Math.min(W, H) / 2 - 40);
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-8, -12); ctx.lineTo(-3, 0); ctx.lineTo(-8, 12); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
  }
  if (hintMsg) {
    ctx.font = `700 ${13 * u}px Arial`;
    const lines = wrap(hintMsg.t, Math.min(W * 0.5, 420 * u));
    const lh = 18 * u, bx = rx - R, by = ry + R + 14, bw2 = Math.min(W * 0.5, 420 * u) + 20;
    ctx.globalAlpha = Math.min(1, hintMsg.life * 2);
    ctx.fillStyle = 'rgba(0,0,0,.7)'; rr(ctx, bx, by, bw2, lines.length * lh + 14, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + 10, by + 8 + i * lh));
    ctx.globalAlpha = 1;
  }
  if (Radio.t > 0 && pl.car) { ctx.globalAlpha = Math.min(1, Radio.t * 2); txt('♪ ' + Radio.name, W / 2, H - 90 * u, 16 * u, '#7cf', 'center', 4); ctx.globalAlpha = 1; }
  if (bigMsg) {
    const a = Math.min(1, bigMsg.life * 2, (bigMsg.dur - bigMsg.life) * 4);
    ctx.globalAlpha = a;
    txt(bigMsg.t, W / 2, H * 0.36, 34 * u, bigMsg.col, 'center', 7);
    if (bigMsg.sub) txt(bigMsg.sub, W / 2, H * 0.36 + 34 * u, 15 * u, '#fff', 'center', 4);
    ctx.globalAlpha = 1;
  }
  if (Game.over) {
    ctx.fillStyle = `rgba(0,0,0,${0.5 - Game.over.t * 0.08})`; ctx.fillRect(0, 0, W, H);
    txt(Game.over.type === 'dead' ? 'VOCÊ MORREU' : 'PRESO!', W / 2, H / 2, 48 * u, Game.over.type === 'dead' ? '#d22' : '#4a8cff', 'center', 9);
  }
}
function wrap(t, maxW) {
  const words = t.split(' '), out = []; let line = '';
  for (const w of words) { const tt = line ? line + ' ' + w : w; if (ctx.measureText(tt).width > maxW && line) { out.push(line); line = w; } else line = tt; }
  if (line) out.push(line); return out;
}

// ===== Início =====
let last = 0, saveT = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
  if (!Game.running) return;
  if (!Game.paused) {
    const steps = dt > 0.025 ? 2 : 1;
    for (let i = 0; i < steps; i++) update(dt / steps);
    saveT += dt; if (saveT > 20) { saveT = 0; if (!M.active) Game.save(); }
  }
  render();
}
Game.init();
requestAnimationFrame(frame);
function startGame(load) {
  SFX.init();
  const el = document.documentElement;
  try { if (el.requestFullscreen && !document.fullscreenElement && matchMedia('(pointer:coarse)').matches) el.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { })).catch(() => { }); } catch (e) { }
  document.getElementById('title').classList.add('hidden');
  document.getElementById('ui').classList.remove('hidden');
  Game.newGame(load);
}
document.getElementById('bNew').onclick = () => startGame(false);
const bCont = document.getElementById('bCont');
if (Game.loadSave()) { bCont.classList.remove('hidden'); bCont.onclick = () => startGame(true); }
document.getElementById('dOk').onclick = () => closeDialog(true);
document.getElementById('dNo').onclick = () => closeDialog(false);
document.getElementById('bPause').onclick = () => Game.togglePause();
document.getElementById('pResume').onclick = () => Game.togglePause(false);
document.getElementById('pSound').onclick = e => { SFX.on = !SFX.on; e.target.textContent = 'SOM: ' + (SFX.on ? 'LIGADO' : 'DESLIGADO'); };
document.getElementById('pFull').onclick = () => { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch (e) { } };
document.getElementById('pMenu').onclick = () => { Game.save(); Game.running = false; Game.paused = false; document.getElementById('pause').classList.add('hidden'); document.getElementById('ui').classList.add('hidden'); document.getElementById('title').classList.remove('hidden'); if (Game.loadSave()) { bCont.classList.remove('hidden'); bCont.onclick = () => startGame(true); } };
