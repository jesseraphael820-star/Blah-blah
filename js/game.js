// Núcleo da partida: jogador em 1ª pessoa, tiro, dano, rounds, bomba, economia e resultado.
import * as THREE from '../vendor/three.min.js';
import { WEAPONS, KNIFE, GRENADES, GRENADE_ORDER, EQUIPMENT, DIFFICULTY, MODES, BOT_NAMES } from './data.js';
import { World } from './maps.js';
import { buildWeapon, buildKnife, buildGrenade, buildBomb, buildArms, poseArms } from './models.js';
import { Effects, Grenades } from './fx.js';
import { Bot } from './bots.js';
import { Hud } from './hud.js';
import { input } from './controls.js';
import { sfx } from './audio.js';
import { save, skinFor } from './save.js';
import { softSprite } from './textures.js';

const DEG = Math.PI / 180, _v = new THREE.Vector3(), _o = new THREE.Vector3(), _d = new THREE.Vector3();
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const other = t => (t === 'T' ? 'CT' : 'T');

function hitTest(c, o, d, maxT) {
  const hy = c.pos.y + (c.crouch ? 1.14 : 1.6), r = 0.21, lx = c.pos.x - o.x, ly = hy - o.y, lz = c.pos.z - o.z, tca = lx * d.x + ly * d.y + lz * d.z;
  let th = Infinity;
  if (tca > 0) { const d2 = lx * lx + ly * ly + lz * lz - tca * tca; if (d2 < r * r) th = tca - Math.sqrt(r * r - d2); }
  const w = 0.31, top = c.pos.y + (c.crouch ? 0.98 : 1.42);
  let t0 = 0, t1 = maxT;
  for (const [oo, dd, lo, hi] of [[o.x, d.x, c.pos.x - w, c.pos.x + w], [o.y, d.y, c.pos.y, top], [o.z, d.z, c.pos.z - w, c.pos.z + w]]) {
    if (Math.abs(dd) < 1e-8) { if (oo < lo || oo > hi) { t0 = Infinity; break; } continue; }
    let a = (lo - oo) / dd, b = (hi - oo) / dd; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { t0 = Infinity; break; }
  }
  const t = Math.min(th, t0); if (!(t < maxT)) return null;
  const head = th <= t0;
  return { t, head, legs: !head && (o.y + d.y * t - c.pos.y) < 0.7 };
}

export class Game {
  constructor(engine, opts, cb) {
    this.engine = engine; this.q = engine.q; this.cb = cb; this.opts = opts;
    this.mode = MODES[opts.mode]; this.training = !!this.mode.training; this.diff = DIFFICULTY[opts.difficulty];
    this.scene = new THREE.Scene(); this.world = new World(opts.map); this.world.buildScene(this.scene, this.q);
    this.camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.08, 500); this.camera.rotation.order = 'YXZ';
    this.vmScene = new THREE.Scene(); this.vmCam = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.01, 6);
    this.vmScene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.6)); const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(1, 2, 1.5); this.vmScene.add(dl);
    this.vm = new THREE.Group(); this.vmScene.add(this.vm);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: 0xffc860, blending: THREE.AdditiveBlending, depthTest: false, transparent: true })); this.flash.visible = false; this.vmScene.add(this.flash);
    this.fx = new Effects(this); this.nades = new Grenades(this);
    this.time = 0; this.paused = false; this.timers = [];
    this.nadeSkin = save.equipped.nades;

    const pt = opts.team === 'auto' ? (Math.random() < 0.5 ? 'T' : 'CT') : opts.team;
    const p = this.player = {
      isPlayer: true, name: save.nick || 'Jogador', team: pt, pos: new THREE.Vector3(), vel: new THREE.Vector3(), radius: 0.35, height: 1.8, onGround: true,
      yaw: 0, pitch: 0, crouch: false, hp: 100, armor: 0, helmet: false, kit: false, alive: true, money: this.mode.startMoney, kills: 0, deaths: 0, hs: 0, score: 0,
      weapons: { primary: null, secondary: null, nades: {} }, cur: 'secondary', curNade: 'he', hasBomb: false, blindUntil: 0, lastShotT: -9, plants: 0, defuses: 0, dmg: 0,
    };
    this.eyeH = 1.6; this.recP = 0; this.recY = 0; this.shots = 0; this.cool = 0; this.reloadT = 0; this.reloadDur = 1; this.drawT = 0; this.kick = 0; this.adsK = 0; this.bob = 0; this.stepD = 0; this.useT = 0; this.fireHeld = false; this.aimOn = false; this.aimT = 0; this.spotT = 0;
    const names = shuffle([...BOT_NAMES]); this.bots = [];
    const nMates = this.training ? 0 : 4, nEnemy = 5;
    for (let i = 0; i < nMates; i++) this.bots.push(new Bot(this, pt, names.pop()));
    for (let i = 0; i < nEnemy; i++) this.bots.push(new Bot(this, other(pt), names.pop()));
    for (const b of this.bots) b.money = this.mode.startMoney;
    this.all = [p, ...this.bots];
    this.score = { us: 0, them: 0 }; this.streak = { us: 0, them: 0 }; this.round = 0; this.phase = 'freeze'; this.timer = 0; this.buyT = 0;
    this.bomb = { state: 'none', pos: new THREE.Vector3(), timer: 0, defuser: null, defuseT: 0, defuseNeed: 10, mesh: buildBomb(), beep: 0, planter: null };
    this.bomb.mesh.scale.setScalar(1.5); this.bomb.mesh.visible = false; this.scene.add(this.bomb.mesh);
    this.hud = new Hud(this, engine.hudRoot);
    this.onResize();
    this.startRound();
  }

  // ---------- utilidades ----------
  newGun(id) { return { id, ammo: WEAPONS[id].mag, reserve: WEAPONS[id].reserve }; }
  farPoint() { let p; for (let i = 0; i < 20; i++) { p = this.world.randomPoint(); if (Math.hypot(p.x - this.player.pos.x, p.z - this.player.pos.z) > 16) break; } return p; }
  after(sec, fn) { this.timers.push({ t: this.time + sec, fn }); }
  get W() { const p = this.player; return p.cur === 'knife' ? KNIFE : (p.cur === 'primary' || p.cur === 'secondary') ? WEAPONS[p.weapons[p.cur].id] : null; }
  get gun() { const p = this.player; return p.cur === 'primary' || p.cur === 'secondary' ? p.weapons[p.cur] : null; }
  side(c) { return c.team === this.player.team ? 'us' : 'them'; }
  alive(team) { return this.all.filter(c => c.alive && c.team === team).length; }
  canBuy() { return this.training || (this.player.alive && (this.phase === 'freeze' || (this.phase === 'live' && this.buyT > 0))); }
  onResize() { const a = innerWidth / innerHeight; this.camera.aspect = this.vmCam.aspect = a; this.camera.updateProjectionMatrix(); this.vmCam.updateProjectionMatrix(); }

  sound3d(kind, pos, vol, range, snd, sup) {
    const c = this.camera.position, dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), v = vol * Math.pow(Math.max(0, 1 - d / range), 1.6); if (v < 0.01) return;
    const pan = d < 0.5 ? 0 : (dx * Math.cos(this.player.yaw) - dz * Math.sin(this.player.yaw)) / d * 0.8;
    if (kind === 'shot') sfx.shot(snd, v, pan, sup); else sfx[kind](v, pan);
  }
  emitSound(x, z, radius, team) { for (const b of this.bots) if (b.alive && b.team !== team && Math.hypot(b.pos.x - x, b.pos.z - z) < radius * this.diff.hear) b.hear(x, z); }
  blind(c, dur) { c.blindUntil = Math.max(c.blindUntil, this.time + dur * 0.8); if (c.isPlayer) { this.hud.flash(dur); sfx.flash(Math.min(1, dur / 3)); } }

  // ---------- rounds ----------
  startRound() {
    const p = this.player, W = this.world; this.round++;
    this.fx.clear(); this.nades.clear(); this.timers.length = 0;
    const pistol = this.round === 1 || (this.mode.half && this.round === this.mode.half + 1);
    for (const team of ['T', 'CT']) {
      const sp = shuffle([...W.spawns[team]]); let i = 0, ci = 0;
      for (const c of this.all) {
        if (c.team !== team) continue;
        if (c.died || !c.weapons.secondary) { c.weapons = { primary: null, secondary: this.newGun(team === 'T' ? 'glock' : 'usp'), nades: {} }; c.armor = 0; c.helmet = false; c.kit = false; }
        c.died = false; c.hasBomb = false;
        if (this.mode.freeArmor || this.training) { c.armor = 100; c.helmet = true; }
        const s = this.training && !c.isPlayer ? { x: (Math.random() - 0.5) * 40, z: 5 + Math.random() * 20, yaw: Math.random() * 6.28 } : sp[i++ % sp.length];
        if (c.isPlayer) { c.pos.set(s.x, 0, s.z); c.vel.set(0, 0, 0); c.yaw = s.yaw; c.pitch = 0; c.hp = 100; c.alive = true; c.blindUntil = 0; for (const k of ['primary', 'secondary']) if (c.weapons[k]) { const w = WEAPONS[c.weapons[k].id]; c.weapons[k].ammo = w.mag; c.weapons[k].reserve = w.reserve; } }
        else { c.buy(pistol); c.spawn(s); c.site = ci++ % 2 ? 'B' : 'A'; c.off = { x: (Math.random() - 0.5) * 7, z: (Math.random() - 0.5) * 7 }; }
      }
    }
    this.tSite = Math.random() < 0.5 ? 'A' : 'B';
    const b = this.bomb; b.state = 'none'; b.mesh.visible = false; b.defuser = null; b.defuseT = 0; b.planter = null;
    if (!this.training) { const ts = this.all.filter(c => c.team === 'T'); const car = ts[(Math.random() * ts.length) | 0]; car.hasBomb = true; b.state = 'carried'; }
    this.phase = this.training ? 'live' : 'freeze'; this.timer = this.training ? 0 : 8; this.buyT = 15;
    this.spec = null; this.useT = 0; this.reloadT = 0; this.recP = this.recY = 0; input.ads = false;
    this.selectSlot(p.weapons.primary ? 'primary' : 'secondary', true);
    this.hud.roundStart(pistol);
    if (!this.training) this.hud.msg(`ROUND ${this.round}`, p.hasBomb ? 'Você está com a bomba — plante no A ou B' : p.team === 'T' ? 'Plante a bomba ou elimine os CTs' : 'Defenda os bombsites', 3);
    else this.hud.msg('TREINAMENTO', 'Dinheiro infinito · abra a loja quando quiser', 3);
  }
  endRound(winTeam, reason) {
    if (this.phase !== 'live') return;
    this.phase = 'post'; this.timer = 5; const p = this.player, usWon = winTeam === p.team, ws = usWon ? 'us' : 'them', ls = usWon ? 'them' : 'us';
    this.score[ws]++; this.streak[ws] = 0; this.streak[ls]++;
    for (const c of this.all) {
      let m = c.team === winTeam ? (reason === 'bomb' || reason === 'defuse' ? 3500 : 3250) : 1400 + 500 * Math.min(4, this.streak[ls] - 1);
      if (c.team === 'T' && c.team !== winTeam && this.bomb.planter) m += 800;
      c.money = Math.min(16000, c.money + m);
    }
    const txt = { elim: 'Equipe inimiga eliminada', bomb: 'A bomba explodiu', defuse: 'Bomba desarmada', time: 'Tempo esgotado' }[reason];
    this.hud.msg(usWon ? 'ROUND VENCIDO' : 'ROUND PERDIDO', `${winTeam === 'T' ? 'Terroristas' : 'Contra-Terroristas'} · ${txt}`, 4.5, usWon ? 'win' : 'lose'); sfx.round(usWon);
  }
  nextRound() {
    const m = this.mode, s = this.score, total = s.us + s.them;
    if (s.us >= m.winAt || s.them >= m.winAt || (m.half && total >= m.half * 2)) return this.finish();
    if (m.half && total === m.half) { // troca de lado
      for (const c of this.all) { c.team = other(c.team); c.money = m.startMoney; c.died = true; if (!c.isPlayer) c.setTeam(c.team); }
      this.streak = { us: 0, them: 0 };
      this.after(0.1, () => this.hud.msg('TROCA DE LADO', `Agora você é ${this.player.team === 'T' ? 'Terrorista' : 'Contra-Terrorista'}`, 3.5));
    }
    this.startRound();
  }
  finish(quit = false) {
    if (this.phase === 'over') return; this.phase = 'over';
    const p = this.player, s = this.score, won = this.training ? 'treino' : s.us > s.them ? 'win' : s.us < s.them ? 'loss' : 'draw';
    for (const c of this.all) c.score = c.kills * 2 + (c.plants || 0) * 2 + (c.defuses || 0) * 2;
    const top = [...this.all].sort((a, b) => b.score - a.score)[0], mvp = !this.training && !quit && top === p && p.kills > 0;
    let xp, coins, rank = 0;
    if (this.training) { xp = p.kills * 10; coins = p.kills * 3; }
    else {
      const k = this.opts.mode === 'casual' ? 0.7 : 1, base = quit ? 0 : won === 'win' ? 400 : won === 'draw' ? 250 : 150;
      xp = Math.round((base + p.kills * 40 + (s.us + s.them) * 20 + (mvp ? 60 : 0)) * k);
      coins = Math.round(((quit ? 0 : won === 'win' ? 300 : won === 'draw' ? 150 : 100) + p.kills * 15 + (p.plants + p.defuses) * 40) * k);
      if (this.mode.ranked) rank = quit ? -20 : won === 'win' ? 25 + Math.min(10, p.kills - p.deaths > 0 ? 5 : 0) : won === 'draw' ? 5 : -15;
    }
    const result = {
      mode: this.opts.mode, map: this.world.def.name, difficulty: this.diff.name, won: quit && !this.training ? 'loss' : won, quit, us: s.us, them: s.them,
      kills: p.kills, deaths: p.deaths, hs: p.hs, mvp, plants: p.plants, defuses: p.defuses, xp, coins, rank,
      board: this.all.map(c => ({ name: c.name, team: c.team, us: c.team === p.team, me: c.isPlayer, k: c.kills, d: c.deaths, score: c.score })),
    };
    this.after(quit ? 0 : 2.5, () => this.cb.onEnd(result));
    if (!quit) this.hud.msg(won === 'win' ? 'VITÓRIA' : won === 'loss' ? 'DERROTA' : won === 'draw' ? 'EMPATE' : 'FIM', `${s.us} : ${s.them}`, 3, won === 'win' ? 'win' : 'lose');
  }

  // ---------- bomba ----------
  dropBomb(c) { const b = this.bomb; c.hasBomb = false; b.state = 'dropped'; b.pos.set(c.pos.x, Math.max(0, c.pos.y) + 0.07, c.pos.z); b.mesh.position.copy(b.pos); b.mesh.visible = true; if (c.isPlayer && c.cur === 'bomb') this.selectSlot('secondary'); }
  pickupBomb(c) { const b = this.bomb; if (b.state !== 'dropped' || !c.alive) return; b.state = 'carried'; c.hasBomb = true; b.mesh.visible = false; if (c.isPlayer) { this.hud.msg('', 'Você pegou a bomba', 2); sfx.buy(); } }
  plantBomb(c) {
    const b = this.bomb; if (!c.hasBomb || this.phase !== 'live') return;
    c.hasBomb = false; c.plants = (c.plants || 0) + 1; c.money = Math.min(16000, c.money + 300); b.state = 'planted'; b.timer = 40; b.beep = 0; b.planter = c; b.defuser = null; b.defuseT = 0;
    b.pos.set(c.pos.x, c.pos.y + 0.07, c.pos.z); b.mesh.position.copy(b.pos); b.mesh.visible = true;
    b.site = Math.hypot(c.pos.x - this.world.sites.A.x, c.pos.z - this.world.sites.A.z) < Math.hypot(c.pos.x - this.world.sites.B.x, c.pos.z - this.world.sites.B.z) ? 'A' : 'B';
    this.hud.msg('BOMBA PLANTADA', `Bombsite ${b.site} · 40 segundos`, 3, 'lose'); sfx.plant();
    if (c.isPlayer && c.cur === 'bomb') this.selectSlot(c.weapons.primary ? 'primary' : 'secondary');
    for (const m of this.bots) { m.goal = null; m.path = null; }
  }
  defuseBomb(c) { const b = this.bomb; if (b.state !== 'planted') return; b.state = 'defused'; c.defuses = (c.defuses || 0) + 1; c.money = Math.min(16000, c.money + 300); this.endRound('CT', 'defuse'); }
  explodeBomb() {
    const b = this.bomb; b.state = 'exploded'; b.mesh.visible = false;
    for (let i = 0; i < 4; i++) this.fx.explosion(_v.set(b.pos.x + (Math.random() - 0.5) * 5, 0.5 + Math.random() * 2, b.pos.z + (Math.random() - 0.5) * 5));
    sfx.explosion(1, 0);
    for (const c of this.all) { if (!c.alive) continue; const d = c.pos.distanceTo(b.pos); if (d < 16) this.damage(c, 200 * (1 - d / 16), b.planter?.alive ? null : null, 'bomb', false, true); }
    this.endRound('T', 'bomb');
  }

  // ---------- combate ----------
  fireBullet(sh, o, d, W, wid, fx = true) {
    const wall = this.world.raycast(o.x, o.y, o.z, d.x, d.y, d.z, 160), maxT = wall ? wall.t : 160;
    let best = null, who = null;
    for (const c of this.all) { if (!c.alive || c.team === sh.team) continue; const h = hitTest(c, o, d, best ? best.t : maxT); if (h) { best = h; who = c; } }
    const t = best ? best.t : maxT; _v.set(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t);
    if (best) {
      let dmg = W.dmg * Math.pow(W.rf, t / 15) * (best.head ? 4 : best.legs ? 0.75 : 1);
      this.fx.blood(_v); this.damage(who, dmg, sh, wid, best.head);
    } else if (wall) this.fx.impact(_v, wall.nx, wall.ny, wall.nz);
    if (fx) {
      const from = sh.isPlayer ? this.muzzleWorld() : new THREE.Vector3(o.x - Math.sin(sh.yaw) * 0.7 + Math.cos(sh.yaw) * 0.2, o.y - 0.25, o.z - Math.cos(sh.yaw) * 0.7 - Math.sin(sh.yaw) * 0.2);
      if (!sh.isPlayer) this.fx.muzzle(from);
      if (Math.random() < 0.7 || !sh.isPlayer) this.fx.tracer(from, _v.clone());
    }
    return who;
  }
  muzzleWorld() { return _o.set(0.14, -0.1, -0.7).applyQuaternion(this.camera.quaternion).add(this.camera.position).clone(); }
  damage(v, amount, att, wid, head, quiet) {
    if (!v.alive || this.phase === 'over') return;
    const pen = WEAPONS[wid]?.pen ?? (wid === 'knife' ? 0.85 : wid === 'fire' || wid === 'bomb' ? 1 : 0.6);
    let hp = amount;
    if (pen < 1 && (head ? v.helmet : v.armor > 0)) { hp = amount * pen; v.armor = Math.max(0, v.armor - amount * (1 - pen) * 0.5); if (v.armor <= 0) v.helmet = false; }
    hp = Math.max(1, Math.round(hp)); v.hp -= hp;
    if (v.isPlayer) { if (!quiet || Math.random() < 0.3) sfx.hurt(); this.hud.hurt(att ? Math.atan2(att.pos.x - v.pos.x, att.pos.z - v.pos.z) : null); }
    else v.onDamaged(att);
    if (att?.isPlayer && v !== att) { att.dmg += hp; this.hud.hit(head); sfx.hit(head); }
    if (v.hp <= 0) this.kill(v, att, wid, head);
  }
  kill(v, att, wid, head) {
    v.hp = 0; v.alive = false; v.deaths++; v.died = true;
    if (att && att !== v && att.team !== v.team) {
      att.kills++; if (head) att.hs++;
      if (!this.training) att.money = Math.min(16000, att.money + (WEAPONS[wid]?.kill ?? (wid === 'knife' ? 1500 : 300)));
    }
    this.hud.kill(att && att !== v ? att : null, v, wid, head);
    if (v.hasBomb) this.dropBomb(v);
    if (v.isPlayer) { this.hud.flash(0); this.useT = 0; input.ads = false; this.deadT = this.time; this.killer = att; }
    else v.die();
    if (this.training) {
      if (v.isPlayer) this.after(2.5, () => { const s = this.world.spawns[v.team][2]; v.pos.set(s.x, 0, s.z); v.yaw = s.yaw; v.hp = 100; v.armor = 100; v.helmet = true; v.alive = true; this.selectSlot(v.weapons.primary ? 'primary' : 'secondary', true); });
      else this.after(3, () => { v.died = false; v.money = 16000; v.buy(false); v.armor = 100; v.spawn({ ...this.farPoint(), yaw: Math.random() * 6.28 }); });
      return;
    }
    this.checkRound();
  }
  checkRound() {
    if (this.phase !== 'live') return;
    const t = this.alive('T'), ct = this.alive('CT'), planted = this.bomb.state === 'planted';
    if (!ct) this.endRound('T', 'elim'); else if (!t && !planted) this.endRound('CT', 'elim');
  }

  // ---------- armas do jogador ----------
  slots() { const p = this.player, s = []; if (p.weapons.primary) s.push('primary'); s.push('secondary', 'knife'); if (p.hasBomb) s.push('bomb'); return s; }
  selectSlot(slot, force) {
    const p = this.player;
    if (slot === 'nade') { const have = GRENADE_ORDER.filter(k => p.weapons.nades[k] > 0); if (!have.length) { sfx.deny(); return; } const i = have.indexOf(p.curNade); p.curNade = p.cur === 'nade' ? have[(i + 1) % have.length] : (i >= 0 ? p.curNade : have[0]); }
    else if ((slot === 'primary' && !p.weapons.primary) || (slot === 'bomb' && !p.hasBomb)) return;
    else if (slot === p.cur && !force) return;
    p.cur = slot; this.reloadT = 0; this.drawT = 0.3; this.cool = Math.max(this.cool, 0.3); this.shots = 0; input.ads = false; this.engine.controls?.syncToggles();
    this.buildViewModel();
  }
  cycleWeapon() { const s = this.slots(), i = s.indexOf(this.player.cur); this.selectSlot(s[(i + 1) % s.length]); }
  buildViewModel() {
    const p = this.player, vm = this.vm; vm.clear();
    let m;
    if (p.cur === 'knife') { const [k, s] = save.equipped.knife.split(':'); m = buildKnife(k, s); m.scale.setScalar(1.25); }
    else if (p.cur === 'nade') { m = buildGrenade(p.curNade, this.nadeSkin); m.scale.setScalar(1.3); }
    else if (p.cur === 'bomb') { m = buildBomb(); m.scale.setScalar(0.8); }
    else { const id = p.weapons[p.cur].id; m = buildWeapon(id, skinFor(id)); }
    const arms = buildArms(save.equipped.gloves, p.team); poseArms(arms, m.userData.hold);
    if (m.userData.hold === 'knife') { m.rotation.set(0.25, 0.35, -0.5); }
    vm.add(m, arms); this.vmModel = m; this.vmMagY = m.userData.mag?.position.y ?? 0; this.vmMagZ = m.userData.mag?.position.z ?? 0;
  }
  reload() {
    const g = this.gun, W = this.W; if (!g || this.reloadT > 0 || g.ammo >= W.mag || g.reserve <= 0) return;
    this.reloadT = this.reloadDur = W.reload * 0.8; this.reloadSnd = 0; input.ads = false; this.engine.controls?.syncToggles();
  }
  buy(kind, id) {
    const p = this.player; if (!this.canBuy()) return false;
    const price = kind === 'weapon' ? WEAPONS[id].price : kind === 'nade' ? GRENADES[id].price : EQUIPMENT[id].price;
    const fail = () => { sfx.deny(); return false; };
    if (p.money < price) return fail();
    if (kind === 'weapon') {
      const W = WEAPONS[id]; if (W.team && W.team !== p.team) return fail();
      const slot = W.type === 'pistol' ? 'secondary' : 'primary'; if (p.weapons[slot]?.id === id) return fail();
      p.weapons[slot] = this.newGun(id); this.selectSlot(slot, true);
    } else if (kind === 'nade') {
      const n = p.weapons.nades; if (n[id] || Object.values(n).reduce((a, b) => a + b, 0) >= 4) return fail(); n[id] = 1;
    } else {
      if (id === 'vest') { if (p.armor >= 100) return fail(); p.armor = 100; }
      else if (id === 'helmet') { if (p.armor >= 100 && p.helmet) return fail(); p.armor = 100; p.helmet = true; }
      else { if (p.team !== 'CT' || p.kit) return fail(); p.kit = true; }
    }
    if (!this.training) p.money -= price; sfx.buy(); return true;
  }
  action(a) {
    const p = this.player;
    if (a === 'pause') return this.hud.togglePause();
    if (a === 'score') return this.hud.toggleScore(); if (a === 'scoreOn') return this.hud.toggleScore(true); if (a === 'scoreOff') return this.hud.toggleScore(false);
    if (a === 'buy') return this.hud.toggleBuy();
    if (!p.alive || this.paused) return;
    if (a === 'reload') this.reload(); else if (a === 'swap') this.cycleWeapon(); else if (a === 'nade') this.selectSlot('nade');
    else if (a === 'slot1') this.selectSlot('primary'); else if (a === 'slot2') this.selectSlot('secondary'); else if (a === 'slot3') this.selectSlot('knife'); else if (a === 'slot5') this.selectSlot('bomb');
  }
  playerFire(dt) {
    const p = this.player, W = this.W, cam = this.camera, pressed = input.fire || (save.settings.autoFire && this.aimOn && p.cur !== 'nade' && p.cur !== 'bomb');
    const edge = pressed && !this.fireHeld; this.fireHeld = pressed;
    if (!pressed || this.cool > 0 || this.phase === 'freeze' || this.drawT > 0.05) return;
    cam.getWorldDirection(_d);
    if (p.cur === 'nade') {
      if (!edge) return; const t = p.curNade; if (!p.weapons.nades[t]) return;
      p.weapons.nades[t]--; this.nades.throw(p, t, cam.position.clone().addScaledVector(_d, 0.4), _d.clone(), 18); this.cool = 0.6; sfx.knife(0.3);
      const have = GRENADE_ORDER.filter(k => p.weapons.nades[k] > 0); if (have.length) { p.curNade = have[0]; this.selectSlot(p.cur, true); } else this.selectSlot(p.weapons.primary ? 'primary' : 'secondary');
      return;
    }
    if (p.cur === 'bomb') return;
    if (p.cur === 'knife') {
      this.cool = 60 / KNIFE.rpm; this.kick = 1; sfx.knife();
      let best = null, who = null; for (const c of this.all) { if (!c.alive || c.team === p.team) continue; const h = hitTest(c, cam.position, _d, best ? best.t : KNIFE.range); if (h) { best = h; who = c; } }
      if (who) { const behind = Math.cos(who.yaw - p.yaw) > 0.5; this.fx.blood(_v.copy(cam.position).addScaledVector(_d, best.t)); this.damage(who, behind ? 180 : KNIFE.dmg, p, 'knife', false); }
      return;
    }
    const g = this.gun; if (this.reloadT > 0) return;
    if (g.ammo <= 0) { if (edge) sfx.reload(1); this.reload(); return; }
    const sp = Math.hypot(p.vel.x, p.vel.z), mv = Math.min(1, sp / 4.5);
    let spread = W.spread[0] + (W.spread[1] - W.spread[0]) * mv + (p.onGround ? 0 : 4) + Math.min(this.shots, 12) * 0.1 * W.recoil[0];
    if (W.zoom) spread = input.ads ? W.scopedSpread + mv * 3 : spread; else { if (input.ads) spread *= 0.6; if (p.crouch) spread *= 0.75; }
    const right = _o.set(1, 0, 0).applyQuaternion(cam.quaternion).clone(), up = _o.set(0, 1, 0).applyQuaternion(cam.quaternion).clone(), fwd = _d.clone();
    for (let i = 0; i < (W.pellets || 1); i++) {
      const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * spread * DEG * (W.pellets ? 1 : 1);
      _d.copy(fwd).addScaledVector(right, Math.cos(a) * Math.tan(r)).addScaledVector(up, Math.sin(a) * Math.tan(r)).normalize();
      this.fireBullet(p, cam.position, _d, W, g.id, i === 0);
    }
    g.ammo--; this.cool = 60 / W.rpm; this.shots++; this.shotT = this.time; p.lastShotT = this.time; this.kick = 1;
    this.recP += W.recoil[0] * (0.7 + Math.random() * 0.5) * (input.ads ? 0.75 : 1) * DEG * (this.shots > 1 ? 1 : 0.6); this.recY += W.recoil[1] * (Math.random() - 0.5) * 2 * DEG;
    sfx.shot(W.snd, 0.9, 0, W.sup); this.emitSound(p.pos.x, p.pos.z, W.sup ? 14 : 45, p.team);
    this.flash.visible = !W.sup && !(W.zoom && input.ads); this.flashT = 0.045;
    if (this.q.lights) this.fx.light(this.muzzleWorld(), 0xffb050, 10, 0.06);
    if (this.vmModel.userData.pump) this.pumpT = 0.5;
  }

  // ---------- atualização ----------
  update(dt) {
    if (this.paused) return;
    this.time += dt; const p = this.player, live = this.phase === 'live';
    for (let i = this.timers.length - 1; i >= 0; i--) if (this.time >= this.timers[i].t) { const f = this.timers[i].fn; this.timers.splice(i, 1); f(); }
    if (this.phase === 'over') { this.updateCamera(dt); return; }
    // fases
    if (!this.training) {
      this.timer -= dt;
      if (this.phase === 'freeze' && this.timer <= 0) { this.phase = 'live'; this.timer = 105; this.hud.msg('', 'VAI! VAI! VAI!', 1.2); }
      else if (live) {
        this.buyT -= dt; const b = this.bomb;
        if (b.state === 'planted') {
          b.timer -= dt; b.beep -= dt;
          if (b.beep <= 0) { b.beep = Math.max(0.12, b.timer / 40); this.sound3d('beep', b.pos, 0.7, 45); b.mesh.userData.led.material.emissiveIntensity = 3; } else b.mesh.userData.led.material.emissiveIntensity *= 0.85;
          if (b.timer <= 0) this.explodeBomb();
        } else if (this.timer <= 0) this.endRound('CT', 'time');
      } else if (this.phase === 'post' && this.timer <= 0) this.nextRound();
    }
    if (this.phase === 'over') return;
    if (p.alive) this.updatePlayer(dt);
    for (const b of this.bots) b.update(dt);
    this.nades.update(dt); this.fx.update(dt);
    // inimigos avistados (radar)
    this.spotT -= dt;
    if (this.spotT <= 0) {
      this.spotT = 0.3;
      for (const e of this.bots) { if (e.team === p.team) continue; e.spotted = false; if (!e.alive) continue; for (const m of this.all) if (m.alive && m.team === p.team && m.pos.distanceTo(e.pos) < 60 && this.world.los(m.pos.x, m.pos.y + 1.5, m.pos.z, e.pos.x, e.pos.y + 1.2, e.pos.z)) { e.spotted = true; break; } }
    }
    this.updateCamera(dt); this.hud.update(dt);
  }
  updatePlayer(dt) {
    const p = this.player, S = save.settings, W = this.W, frozen = this.phase === 'freeze', acting = this.useT > 0;
    const zoom = W?.zoom && input.ads, sens = 0.0032 * S.sens * (input.ads ? S.adsSens * (zoom ? 0.45 : 1) : 1);
    p.yaw -= input.lookX * sens; p.pitch -= input.lookY * sens * (S.invertY ? -1 : 1); p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch));
    this.swayX = (this.swayX || 0) * 0.85 + input.lookX * 0.0004; this.swayY = (this.swayY || 0) * 0.85 + input.lookY * 0.0004;
    input.lookX = input.lookY = 0;
    p.crouch = input.crouch;
    let speed = 5.2 * (W?.speed ?? 1) * (p.crouch ? 0.42 : input.walk ? 0.52 : 1) * (input.ads ? (zoom ? 0.45 : 0.7) : 1);
    let mx = input.mx, my = input.my; const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    if (frozen || acting) mx = my = 0;
    const s = Math.sin(p.yaw), c = Math.cos(p.yaw), wx = (-s * my + c * mx) * speed, wz = (-c * my - s * mx) * speed;
    const k = Math.min(1, (p.onGround ? 11 : 2.5) * dt); p.vel.x += (wx - p.vel.x) * k; p.vel.z += (wz - p.vel.z) * k;
    if (input.jump && p.onGround && !frozen && !acting) { p.vel.y = 5.7; p.onGround = false; }
    p.height = p.crouch ? 1.3 : 1.8;
    const ox = p.pos.x, oz = p.pos.z; this.world.move(p, dt);
    const moved = Math.hypot(p.pos.x - ox, p.pos.z - oz), sp = moved / dt;
    this.eyeH += ((p.crouch ? 1.1 : 1.6) - this.eyeH) * Math.min(1, 12 * dt);
    if (p.onGround && sp > 3) { this.stepD += moved; if (this.stepD > 2.3) { this.stepD = 0; sfx.step(0.22); this.emitSound(p.pos.x, p.pos.z, 13, p.team); } }
    this.bob += moved * 2.4;
    // fogo
    if (this.nades.inFire(p.pos.x, p.pos.z)) { /* dano aplicado pela zona */ }
    // recarga
    if (this.reloadT > 0) {
      this.reloadT -= dt; const ph = 1 - this.reloadT / this.reloadDur;
      if (this.reloadSnd === 0 && ph > 0.25) { sfx.reload(0); this.reloadSnd = 1; } else if (this.reloadSnd === 1 && ph > 0.72) { sfx.reload(1); this.reloadSnd = 2; }
      if (this.reloadT <= 0) { const g = this.gun; if (g) { const n = Math.min(this.W.mag - g.ammo, this.training ? 999 : g.reserve); g.ammo += n; if (!this.training) g.reserve -= n; } }
    }
    this.cool -= dt; this.drawT = Math.max(0, this.drawT - dt);
    // mira no inimigo (retículo vermelho / disparo automático)
    this.aimT -= dt;
    if (this.aimT <= 0) {
      this.aimT = 0.07; this.aimOn = false; this.camera.getWorldDirection(_d); const o = this.camera.position, wall = this.world.raycast(o.x, o.y, o.z, _d.x, _d.y, _d.z, 120), mt = wall ? wall.t : 120;
      for (const e of this.all) if (e.alive && e.team !== p.team && hitTest(e, o, _d, p.cur === 'knife' ? KNIFE.range : mt)) { this.aimOn = true; break; }
    }
    if (!acting) this.playerFire(dt);
    if (this.time - (this.shotT || -9) > 0.3) this.shots = 0;
    const rk = Math.min(1, (this.time - (this.shotT || -9) > 0.1 ? 7 : 2) * dt); this.recP -= this.recP * rk; this.recY -= this.recY * rk;
    // interação: plantar / desarmar
    const b = this.bomb; this.hint = ''; let need = 0, can = null;
    if (this.phase === 'live' && p.onGround) {
      if (p.hasBomb && p.team === 'T') { for (const sk of ['A', 'B']) { const st = this.world.sites[sk]; if (Math.hypot(p.pos.x - st.x, p.pos.z - st.z) < st.r) { can = 'plant'; need = 3.2; this.hint = 'Segure ✋ para plantar a bomba'; } } }
      else if (p.team === 'CT' && b.state === 'planted' && Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z) < 1.9 && (!b.defuser || b.defuser === p)) { can = 'defuse'; need = p.kit ? 5 : 10; this.hint = `Segure ✋ para desarmar${p.kit ? ' (kit)' : ''}`; }
    }
    if (can && input.interact) {
      this.useT += dt; this.useNeed = need; if (can === 'defuse') { b.defuser = p; b.defuseT = this.useT; b.defuseNeed = need; }
      if (this.useT >= need) { this.useT = 0; if (can === 'plant') this.plantBomb(p); else { b.defuser = null; this.defuseBomb(p); } }
    } else { if (this.useT > 0 && b.defuser === p) { b.defuser = null; b.defuseT = 0; } this.useT = 0; }
    if (p.team === 'T' && b.state === 'dropped' && Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z) < 1.1) this.pickupBomb(p);
  }
  updateCamera(dt) {
    const p = this.player, cam = this.camera, W = this.W;
    if (p.alive) {
      cam.position.set(p.pos.x, p.pos.y + this.eyeH, p.pos.z); cam.rotation.set(Math.max(-1.55, Math.min(1.55, p.pitch + this.recP)), p.yaw + this.recY, 0);
      const zoom = W?.zoom && input.ads; this.adsK += ((input.ads ? 1 : 0) - this.adsK) * Math.min(1, 14 * dt);
      const fov = zoom ? 74 * W.zoom * 1.6 : 74 - this.adsK * (W && !W.zoom && p.cur !== 'knife' ? 16 : 0);
      if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, 16 * dt); cam.updateProjectionMatrix(); }
      this.scoped = !!zoom && this.adsK > 0.7;
      // viewmodel
      const vm = this.vm, m = this.vmModel, hold = m.userData.hold, a = hold === 'rifle' || hold === 'pistol' ? this.adsK : 0, sp = Math.hypot(p.vel.x, p.vel.z) / 5;
      this.kick *= Math.pow(0.0005, dt);
      const bx = Math.sin(this.bob) * 0.006 * (1 - a * 0.8), by = Math.abs(Math.cos(this.bob)) * 0.006 * (1 - a * 0.8);
      const base = hold === 'knife' ? [0.17, -0.16, -0.36] : hold === 'nade' ? [0.16, -0.17, -0.36] : hold === 'pistol' ? [0.13, -0.15, -0.46] : [0.15, -0.17, -0.56];
      let rx = 0, y = base[1] * (1 - a) + (hold === 'pistol' ? -0.062 : -0.078) * a, z = base[2] * (1 - a) + (hold === 'pistol' ? -0.36 : -0.4) * a;
      if (this.reloadT > 0) { const ph = 1 - this.reloadT / this.reloadDur, w = Math.sin(ph * Math.PI); rx = -w * 0.55; y -= w * 0.07; if (m.userData.mag && !m.userData.pump) m.userData.mag.position.y = this.vmMagY - Math.sin(Math.min(1, ph * 1.4) * Math.PI) * 0.16; }
      else if (m.userData.mag && !m.userData.pump) m.userData.mag.position.y = this.vmMagY;
      if (m.userData.pump) { this.pumpT = Math.max(0, (this.pumpT || 0) - dt); m.userData.mag.position.z = this.vmMagZ + Math.sin(Math.min(1, this.pumpT / 0.5) * Math.PI) * 0.09; }
      if (m.userData.slide) m.userData.slide.position.z = -m.userData.slide.geometry.parameters.depth / 2 + 0.05 + this.kick * 0.03;
      y -= (this.drawT / 0.3) * 0.25; if (this.useT > 0) y -= 0.3;
      vm.position.set(base[0] * (1 - a) + bx - (this.swayX || 0), y + by + (this.swayY || 0) - (p.onGround ? 0 : 0.01), z + this.kick * (hold === 'knife' ? -0.12 : 0.045));
      vm.rotation.set(rx + this.kick * (hold === 'knife' ? -0.5 : 0.07), hold === 'knife' ? this.kick * 0.6 : 0, 0);
      vm.visible = !this.scoped;
      if (this.flashT > 0) { this.flashT -= dt; const mz = m.userData.muzzle; this.flash.position.set(vm.position.x + mz.x, vm.position.y + mz.y, vm.position.z + mz.z - 0.03); this.flash.scale.setScalar(0.14 + Math.random() * 0.1); this.flash.material.rotation = Math.random() * 6; if (this.flashT <= 0) this.flash.visible = false; }
      const sm = m.userData.skinMat; if (sm?.userData.fancy) sm.emissiveIntensity = 0.2 + Math.sin(this.time * 2.5) * 0.08;
    } else {
      this.vm.visible = false; this.scoped = false; if (cam.fov !== 74) { cam.fov = 74; cam.updateProjectionMatrix(); }
      const since = this.time - (this.deadT || 0);
      if (!this.spec || !this.spec.alive) this.spec = since > 1.6 ? this.bots.find(b => b.alive && b.team === p.team) || null : null;
      const s = this.spec;
      if (s) {
        const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), ey = s.pos.y + 1.9; let dist = 2.6;
        const h = this.world.raycast(s.pos.x, ey, s.pos.z, -fx, 0.12, -fz, dist + 0.3); if (h) dist = Math.max(0.3, h.t - 0.3);
        _v.set(s.pos.x - fx * dist, ey + dist * 0.12, s.pos.z - fz * dist); cam.position.lerp(_v, Math.min(1, 8 * dt)); cam.lookAt(s.pos.x + fx * 4, s.pos.y + 1.4, s.pos.z + fz * 4);
      } else { cam.position.y += (0.35 + p.pos.y - cam.position.y) * Math.min(1, 4 * dt); cam.rotation.z += (0.5 - cam.rotation.z) * Math.min(1, 4 * dt); }
    }
  }
  render() {
    const r = this.engine.renderer;
    r.autoClear = true; r.render(this.scene, this.camera);
    if (this.vm.visible && this.phase !== 'over') { r.autoClear = false; r.clearDepth(); r.render(this.vmScene, this.vmCam); r.autoClear = true; }
  }
  destroy() {
    this.hud.destroy();
    this.scene.traverse(o => { if (o.geometry && o.geometry !== this.fx.decalGeo) o.geometry.dispose?.(); });
  }
}
