// Núcleo do jogo: laço principal, jogador, física, interações, economia,
// garagem, mortes/prisões, salvamento e renderização da cena.

import { T, TT, MAP } from './world/constants.js';
import { City } from './world/city.js';
import { WorldRenderer } from './world/world-renderer.js';
import { Camera } from './core/camera.js';
import { Input } from './core/input.js';
import { AudioSys } from './core/audio.js';
import { loadSettings, saveSettings, loadGame, saveGame } from './core/save.js';
import { clamp, dist, rand, pick, wrapAngle } from './core/math.js';
import { Vehicle, collideVehicleWorld, collideVehicles, drawVehicle } from './entities/vehicle.js';
import { MODELS, KMH } from './entities/vehicle-models.js';
import { Human, CHARACTERS, moveHuman, drawHuman, randomLook, updateDownHuman } from './entities/human.js';
import { Traffic } from './ai/traffic.js';
import { Pedestrians } from './ai/pedestrians.js';
import { Police } from './ai/police.js';
import { Missions } from './systems/missions.js';
import { DayNight } from './systems/daynight.js';
import { Particles } from './systems/particles.js';
import { Hud } from './ui/hud.js';
import { UI } from './ui/menus.js';
import { TouchControls } from './ui/touch.js';

const STEP = 1 / 60;

function freshStats() {
  return { playTime: 0, footDist: 0, carDist: 0, topSpeed: 0, stolen: 0, crashes: 0, maxWanted: 0, busted: 0, wasted: 0, knocked: 0, earned: 0, spent: 0, missions: 0 };
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.settings = loadSettings();
    this.city = new City();
    this.worldRenderer = new WorldRenderer(this.city);
    this.camera = new Camera();
    this.audio = new AudioSys();
    this.input = new Input();
    this.touch = new TouchControls();
    this.input.touch = this.touch;
    this.time = new DayNight();
    this.fx = new Particles();
    this.vehicles = [];
    this.humans = [];
    this.player = new Human('player', 0, 0);
    this.character = CHARACTERS[0];
    this.money = 0;
    this.stats = freshStats();
    this.garage = [];
    this.garageSize = 4;
    this.endingSeen = false;
    this.running = false;
    this.paused = true;
    this.prompt = null;
    this.dying = null;
    this.acc = 0;
    this.last = performance.now();
    this.fps = 60;
    this.fpsAcc = 0; this.fpsN = 0;
    this.saveT = 60;
    this.hud = new Hud(this);
    this.ui = new UI(this);
    this.traffic = new Traffic(this);
    this.peds = new Pedestrians(this);
    this.police = new Police(this);
    this.missions = new Missions(this);
    this.lightCv = document.createElement('canvas');
    this.lightG = this.lightCv.getContext('2d');
    this.lightSprite = this.makeLightSprite();
    this.applySettings();
    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.running) {
        this.autosave();
        if (!this.ui.open) this.ui.showPause('missions');
      }
      this.audio.suspend(document.hidden);
    });
    const unlock = () => this.audio.unlock();
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
    this.resize();
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---------------- configurações ----------------
  get lowQuality() {
    const q = this.settings.quality;
    if (q === 'low') return true;
    if (q === 'high') return false;
    return this.autoLow;
  }

  get touchOn() {
    const t = this.settings.touch;
    if (t === 'on') return true;
    if (t === 'off') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  applySettings() {
    const s = this.settings;
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;
    this.autoLow = cores <= 4 || mem <= 3;
    this.audio.setVolume(s.volume);
    this.worldRenderer.setQuality(this.lowQuality ? 'low' : 'high');
    this.touch.setStyle(s.controlsSize, s.controlsOpacity);
    this.touch.vibrate = s.vibration;
    this.touch.show(this.running && this.touchOn);
    this.resize();
  }

  updateSetting(key, v) {
    this.settings[key] = v;
    saveSettings(this.settings);
    this.applySettings();
  }

  resize() {
    const lowDpr = this.lowQuality ? 1 : Math.min(devicePixelRatio || 1, this.settings.quality === 'high' ? 2 : 1.5);
    this.dpr = lowDpr;
    this.cssW = innerWidth; this.cssH = innerHeight;
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.lightCv.width = Math.ceil(this.canvas.width / 3);
    this.lightCv.height = Math.ceil(this.canvas.height / 3);
  }

  makeLightSprite() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(0.5, 'rgba(0,0,0,.6)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    return c;
  }

  // ---------------- ciclo de vida ----------------
  hasSave() {
    return !!loadGame();
  }

  resetWorld() {
    this.missions.abort();
    this.vehicles = [];
    this.humans = [];
    this.fx = new Particles();
    this.police.clear();
    for (const s of this.city.parkingSpots) { s.state = 0; s.car = null; }
    this.player = new Human('player', 0, 0, { ...this.character.look });
    this.player.maxHealth = this.character.health;
    this.player.health = this.character.health;
    this.player.vehicle = null;
    this.dying = null;
  }

  newGame(charId) {
    this.character = CHARACTERS.find((c) => c.id === charId) || CHARACTERS[0];
    this.money = 300;
    this.stats = freshStats();
    this.garage = [{ model: 'brisa', color: '#3d7ac9', hp: MODELS.brisa.hp }];
    this.missions.completed = new Set();
    this.endingSeen = false;
    this.time = new DayNight();
    this.resetWorld();
    this.spawnAt(this.city.locations.garage, 0);
    this.begin();
    this.autosave();
    setTimeout(() => {
      this.hud.toast('Bem-vindo a Porto Brasa!', 'ok');
      this.hud.toast('★ Vá até a Oficina Brasa para começar a história', '');
    }, 600);
  }

  continueGame() {
    const d = loadGame();
    if (!d) return this.ui.showTitle();
    this.character = CHARACTERS.find((c) => c.id === d.character) || CHARACTERS[0];
    this.money = d.money ?? 0;
    this.stats = { ...freshStats(), ...(d.stats || {}) };
    this.garage = d.garage || [];
    this.missions.completed = new Set(d.completed || []);
    this.endingSeen = !!d.endingSeen;
    this.time = new DayNight();
    this.time.total = d.clock || 0;
    this.resetWorld();
    this.player.health = Math.max(30, Math.min(this.player.maxHealth, d.health ?? this.player.maxHealth));
    this.spawnAt(this.city.locations.garage, 0);
    this.begin();
    const next = this.missions.nextStory();
    setTimeout(() => this.hud.toast(next ? `★ Próxima missão: ${next.name}` : 'Campanha concluída — explore à vontade!', 'ok'), 500);
  }

  begin() {
    this.running = true;
    this.ui.close();
    this.hud.show(true);
    this.touch.show(this.touchOn);
    const p = this.playerPos();
    this.camera.snap(p.x, p.y);
    this.camera.zoom = 1.2;
  }

  quitToTitle() {
    this.running = false;
    this.missions.abort();
    this.audio.stopLoops();
    this.hud.show(false);
    this.touch.show(false);
    this.ui.showTitle();
  }

  autosave() {
    if (!this.running) return;
    saveGame({
      character: this.character.id,
      money: this.money,
      health: this.player.health,
      stats: this.stats,
      garage: this.garage,
      completed: [...this.missions.completed],
      clock: this.time.total,
      endingSeen: this.endingSeen,
    });
  }

  setPaused(p) {
    this.paused = p;
    if (p) { this.audio.stopLoops(); this.touch.reset(); }
  }

  togglePause() {
    if (!this.running) return;
    if (this.ui.open) { if (this.ui.current === 'pause') this.ui.close(); }
    else this.ui.showPause('missions');
  }

  retryMission(d) {
    if (this.dying) return;
    this.missions.start(d);
  }

  // ---------------- utilidades ----------------
  playerPos() {
    const v = this.player.vehicle;
    return v ? { x: v.x, y: v.y } : { x: this.player.x, y: this.player.y };
  }

  addVehicle(v) {
    this.vehicles.push(v);
    return v;
  }

  vehicleNear(x, y, r) {
    for (const v of this.vehicles) if ((v.x - x) ** 2 + (v.y - y) ** 2 < (r + v.radius) ** 2) return v;
    return null;
  }

  los(x1, y1, x2, y2) {
    const d = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.ceil(d / 14);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.city.typeW(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t) === TT.BUILDING) return false;
    }
    return true;
  }

  setPrompt(text, fn) {
    if (!this.prompt) this.prompt = { text, fn };
  }

  triggerPrompt() {
    if (this.prompt && !this.paused && !this.dying) {
      const p = this.prompt;
      this.prompt = null;
      p.fn();
    }
  }

  addMoney(n, label) {
    this.money += n;
    if (n > 0) this.stats.earned += n; else this.stats.spent -= n;
    this.hud.toast(`${n >= 0 ? '+' : '-'}$${Math.abs(n).toLocaleString('pt-BR')}${label ? ' · ' + label : ''}`, 'money');
    this.hud.moneyBump();
    if (n > 0) this.audio.play('money');
  }

  spend(n) {
    if (this.money < n) return false;
    this.money -= n;
    this.stats.spent += n;
    this.hud.moneyBump();
    return true;
  }

  honk(v) {
    if (this.camera.visible(v.x, v.y, 40)) this.audio.play('honk', v.m.mass > 2 ? 0.7 : 1);
  }

  damagePlayer(n) {
    if (this.dying) return;
    this.player.health -= n;
    if (this.settings.vibration && navigator.vibrate) navigator.vibrate(30);
    if (this.player.health <= 0) { this.player.health = 0; this.wasted(); }
  }

  spawnAt(loc, a = 0) {
    const n = this.city.nearest(loc.x, loc.y, (x, y) => !this.city.solid(x, y), 6) || loc;
    this.player.x = n.x; this.player.y = n.y; this.player.a = a;
    this.player.state = 'walk';
    this.player.vehicle = null;
    this.camera.snap(n.x, n.y);
  }

  // ---------------- morte / prisão ----------------
  wasted() {
    if (this.dying) return;
    this.stats.wasted++;
    this.startDeath('wasted', 'NOCAUTEADO');
  }

  busted() {
    if (this.dying) return;
    this.stats.busted++;
    this.audio.play('busted');
    this.startDeath('busted', 'DETIDO');
  }

  startDeath(kind, text) {
    const fade = document.getElementById('fade');
    fade.innerHTML = `<span class="${kind}">${text}</span>`;
    fade.classList.add('on');
    this.dying = { kind, t: 2.6 };
    this.audio.stopLoops();
    const failed = this.missions.active ? this.missions.active.def : null;
    if (failed) { this.missions.abort(); this.dying.failed = failed; }
  }

  finishDeath() {
    const d = this.dying;
    const fade = document.getElementById('fade');
    const v = this.player.vehicle;
    if (v) { v.driver = null; this.player.vehicle = null; }
    let cost, loc, msg;
    if (d.kind === 'wasted') {
      cost = Math.min(this.money, 100 + Math.round(this.money * 0.05));
      loc = this.city.locations.hospital;
      msg = `Conta do hospital: -$${cost}`;
      this.player.health = this.player.maxHealth;
    } else {
      cost = Math.min(this.money, 200 + 250 * this.police.level);
      loc = this.city.locations.police;
      msg = `Fiança paga: -$${cost}`;
      this.player.health = Math.max(this.player.health, this.player.maxHealth * 0.5);
    }
    this.money -= cost;
    this.stats.spent += cost;
    this.police.clear();
    // limpa policiais a pé
    for (const h of this.humans) if (h.kind === 'cop') h.dead = true;
    for (const vv of this.vehicles) if (vv.isPolice && vv.ai && vv.ai.mode !== 'patrol') vv.remove = true;
    this.spawnAt(loc, Math.PI / 2);
    this.dying = null;
    fade.classList.remove('on');
    this.hud.toast(msg, 'warn');
    this.autosave();
    if (d.failed) this.ui.showFail(d.failed, d.kind === 'wasted' ? 'Você foi nocauteado.' : 'Você foi detido pela polícia.');
  }

  // ---------------- veículos: entrar / sair ----------------
  nearestEnterable() {
    const p = this.player;
    let best = null, bd = Infinity;
    for (const v of this.vehicles) {
      const d = dist(p.x, p.y, v.x, v.y) - v.radius;
      if (d < 20 && d < bd) { bd = d; best = v; }
    }
    return best;
  }

  enterVehicle(v) {
    const p = this.player;
    if (v.wrecked || v.burning > 0) { this.hud.hint('Veículo destruído'); return; }
    const pp = { x: v.x, y: v.y };
    if (v.driver === 'ai') {
      const door = v.doorPoint(-1);
      const look = v.isPolice ? { skin: '#c68863', hair: '#1d1510', shirt: '#24324f', pants: '#1a2236', hairStyle: 'police' } : v.driverLook || randomLook();
      const h = new Human(v.isPolice ? 'cop' : 'ped', door.x, door.y, look);
      if (this.city.solidW(door.x, door.y)) { const d2 = v.doorPoint(1); h.x = d2.x; h.y = d2.y; }
      h.knock(Math.cos(v.a + Math.PI / 2) * -80, Math.sin(v.a + Math.PI / 2) * -80, false);
      h.down = 1.2;
      if (v.isPolice) h.ai = { car: null, mode: 'chase', hitCd: 0, speed: 130 };
      else h.ai = { tx: Math.floor(h.x / T), ty: Math.floor(h.y / T), dir: { dx: 1, dy: 0, b: 2, opp: 8, axis: 'h' }, crossing: false, wait: 0, speed: 50 };
      this.humans.push(h);
      this.police.crime(v.isPolice ? 'stealCop' : 'carjack', pp.x, pp.y);
      if (v.isPolice) this.police.setLevel(Math.max(this.police.level, 2));
      this.stats.stolen++;
      this.peds.scare(pp.x, pp.y, 160);
    } else if (!v.owned && !v.mission && !v.stolenOnce) {
      this.police.crime(v.isPolice ? 'stealCop' : 'steal', pp.x, pp.y);
      if (v.parked && Math.random() < 0.3) { this.audio.play('alarm'); this.peds.scare(pp.x, pp.y, 140); }
      this.stats.stolen++;
    }
    v.stolenOnce = true;
    v.driver = 'player';
    v.ai = null;
    v.parked = false;
    v.siren = false;
    v.throttle = 0; v.brake = 0; v.steer = 0;
    p.vehicle = v;
    this.audio.play('door');
  }

  exitVehicle() {
    const p = this.player, v = p.vehicle;
    if (!v) return;
    if (v.speed > 140) { this.hud.hint('Reduza a velocidade para sair'); return; }
    let spot = null;
    for (const side of [-1, 1]) {
      const d = v.doorPoint(side);
      if (!this.city.solidW(d.x, d.y)) { spot = d; break; }
    }
    if (!spot) {
      const back = { x: v.x - Math.cos(v.a) * (v.m.l / 2 + 12), y: v.y - Math.sin(v.a) * (v.m.l / 2 + 12) };
      spot = this.city.solidW(back.x, back.y) ? { x: v.x, y: v.y } : back;
    }
    p.x = spot.x; p.y = spot.y;
    p.a = v.a;
    p.vehicle = null;
    p.state = 'walk';
    v.driver = null;
    v.throttle = 0; v.brake = 0; v.handbrake = false; v.steer = 0;
    this.audio.setHorn(false);
    this.audio.play('door');
  }

  // ---------------- garagem / pintura ----------------
  storeVehicle() {
    const v = this.player.vehicle;
    if (!v) return;
    if (this.garage.length >= this.garageSize) { this.hud.toast('Garagem cheia! Venda ou retire um veículo.', 'warn'); return; }
    if (v.isPolice) { this.hud.toast('Viaturas não podem ser guardadas.', 'warn'); return; }
    this.garage.push({ model: v.model, color: v.color, hp: Math.max(10, v.hp) });
    this.exitVehicle();
    v.remove = true;
    this.hud.toast(`${v.m.name} guardado na garagem`, 'ok');
    this.audio.play('checkpoint');
    this.autosave();
  }

  takeFromGarage(i) {
    const s = this.garage[i];
    if (!s) return;
    if (this.player.vehicle) this.exitVehicle();
    this.garage.splice(i, 1);
    const L = this.city.locations.garage;
    const x = L.x + 40, y = L.y + 14;
    for (const v of this.vehicles) if (dist(v.x, v.y, x, y) < 60 && !v.mission) v.remove = true;
    const v = new Vehicle(s.model, x, y, 0, s.color);
    v.hp = s.hp;
    v.owned = true;
    this.addVehicle(v);
    this.player.x = x; this.player.y = y;
    this.enterVehicle(v);
    this.autosave();
  }

  sellFromGarage(i) {
    const s = this.garage[i];
    if (!s) return;
    const price = Math.round((MODELS[s.model].price || 2000) * 0.3);
    this.garage.splice(i, 1);
    this.addMoney(price, `Venda de ${MODELS[s.model].name}`);
    this.autosave();
  }

  buyVehicle(model) {
    const m = MODELS[model];
    if (this.garage.length >= this.garageSize) return;
    if (!this.spend(m.price)) return;
    this.garage.push({ model, color: m.colors[0], hp: m.hp });
    this.hud.toast(`${m.name} comprado!`, 'ok');
    this.audio.play('money');
    this.autosave();
  }

  respray() {
    const v = this.player.vehicle;
    if (!v) return;
    const cost = 250 + 150 * this.police.level;
    if (this.police.level > 0 && this.police.seen) { this.hud.toast('A polícia está vendo você!', 'warn'); return; }
    if (!this.spend(cost)) { this.hud.toast(`Dinheiro insuficiente ($${cost})`, 'warn'); return; }
    v.hp = v.maxHp;
    v.dents = [];
    v.burning = 0;
    const others = v.m.colors.filter((c) => c !== v.color);
    if (others.length) v.setColor(pick(others));
    const had = this.police.level > 0;
    this.police.clear();
    this.audio.play('money');
    this.hud.toast(had ? 'Carro consertado e pintado — polícia despistada!' : 'Carro consertado e pintado!', 'ok');
  }

  // ---------------- colisões e impactos ----------------
  onImpact(a, b, impact, x, y) {
    const pv = this.player.vehicle;
    const k = clamp((impact - 60) / 300, 0, 1);
    if (this.camera.visible(x, y, 50)) {
      this.fx.sparks(x, y, 4 + Math.round(k * 10));
      if (impact > 90 && (!a.lastImpactT || this.time.total - a.lastImpactT > 0.25)) {
        a.lastImpactT = this.time.total;
        const d = dist(x, y, this.camera.x, this.camera.y);
        this.audio.play('crash', k * clamp(1 - d / 700, 0.2, 1));
      }
    }
    if (pv && (a === pv || b === pv)) {
      if (impact > 110) {
        this.stats.crashes++;
        this.camera.shake(Math.min(7, impact / 60), 0.25);
        if (this.settings.vibration && navigator.vibrate) navigator.vibrate(Math.min(80, impact / 4));
      }
      const other = a === pv ? b : a;
      if (other) {
        if (other.isPolice && impact > 90) this.police.crime('ramCop', x, y);
        if (other.ai && other.ai.type === 'traffic') other.ai.panic = 5;
        // passageiro em missão se machuca? apenas dano ao veículo
      }
    }
  }

  explode(v) {
    v.wrecked = true;
    v.burning = 0;
    v.vx *= 0.3; v.vy *= 0.3;
    v.siren = false;
    this.fx.explosion(v.x, v.y);
    if (this.camera.visible(v.x, v.y, 200)) {
      this.audio.play('explosion');
      this.camera.shake(10, 0.6);
    }
    for (const o of this.vehicles) {
      if (o === v) continue;
      const d = dist(o.x, o.y, v.x, v.y);
      if (d < 100) {
        o.damageBy(70 * (1 - d / 100), this);
        const ux = (o.x - v.x) / (d || 1), uy = (o.y - v.y) / (d || 1);
        o.vx += ux * 160 * (1 - d / 100) / o.m.mass; o.vy += uy * 160 * (1 - d / 100) / o.m.mass;
      }
    }
    for (const h of this.humans) {
      if (h.state === 'down') continue;
      const d = dist(h.x, h.y, v.x, v.y);
      if (d < 90) h.knock((h.x - v.x) * 3, (h.y - v.y) * 3, d < 50);
    }
    const p = this.player;
    if (p.vehicle === v) {
      this.exitVehicle();
      p.vehicle = null;
      this.damagePlayer(70);
    } else if (!p.vehicle) {
      const d = dist(p.x, p.y, v.x, v.y);
      if (d < 90) this.damagePlayer(55 * (1 - d / 90));
    }
    this.peds.scare(v.x, v.y, 300);
    if (v.lastDriver === 'player') this.police.crime('explosion', v.x, v.y);
  }

  humanVsVehicles(h, isPlayer) {
    if (h.vehicle || h.dead) return;
    for (const v of this.vehicles) {
      const dx0 = h.x - v.x, dy0 = h.y - v.y;
      if (dx0 * dx0 + dy0 * dy0 > (v.radius + h.r + 2) ** 2) continue;
      for (const c of v.circ) {
        const dx = h.x - c.x, dy = h.y - c.y;
        const rr = c.r + h.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.01;
        const nx = dx / d, ny = dy / d;
        const sp = v.speed;
        const rel = -(v.vx * nx + v.vy * ny); // velocidade do carro em direção à pessoa
        if (sp > 85 && rel < -40 && h.state !== 'down') {
          const strong = sp > 260;
          if (isPlayer) {
            this.damagePlayer(clamp(sp * 0.1, 8, 60));
            h.state = 'down'; h.down = 1.2; h.vx = v.vx * 0.7 + nx * 60; h.vy = v.vy * 0.7 + ny * 60; h.spin = rand(-6, 6);
          } else {
            h.knock(v.vx * 0.75 + nx * 70, v.vy * 0.75 + ny * 70, strong);
            if (v.driver === 'player') {
              this.stats.knocked++;
              this.police.crime(h.kind === 'cop' ? 'hitCop' : 'hitPed', h.x, h.y);
              this.peds.scare(h.x, h.y, 200);
            }
          }
          v.damageBy(2, this);
          v.vx *= 0.92; v.vy *= 0.92;
          if (this.camera.visible(h.x, h.y)) this.audio.play('punch');
        } else {
          // empurra a pessoa para fora
          const pen = rr - d;
          moveHuman(h, nx * pen, ny * pen, this.city);
        }
        break;
      }
    }
  }

  // ---------------- atualização ----------------
  frame(t) {
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    const s = this.input.poll();
    if (this.running) {
      if (s.pause) this.togglePause();
      else if (s.map && !this.ui.open) this.ui.showPause('map');
      else if (s.map && this.ui.current === 'pause') this.ui.close();
      if (!this.paused) {
        this.acc += dt;
        let n = 0;
        while (this.acc >= STEP && n < 5) {
          this.update(STEP, s);
          s.punch = s.interact = s.enterExit = s.action = false;
          this.acc -= STEP; n++;
        }
        if (n === 5) this.acc = 0;
        this.hud.update(dt);
      }
      this.render();
    } else {
      this.renderIdle(dt);
    }
    this.input.endFrame();
    requestAnimationFrame((tt) => this.frame(tt));
  }

  update(dt, s) {
    this.prompt = null;
    this.time.update(dt);
    this.city.updateLights(dt);
    this.stats.playTime += dt;

    if (this.dying) {
      this.dying.t -= dt;
      if (this.dying.t <= 0) this.finishDeath();
    } else this.updatePlayer(dt, s);

    this.traffic.update(dt);
    this.peds.update(dt);
    this.police.update(dt);
    this.missions.update(dt);
    this.updateLocations();
    this.updateNPCs(dt);

    // física dos veículos
    const V = this.vehicles;
    for (const v of V) {
      if (v.driver === 'player') v.lastDriver = 'player';
      v.update(dt, this.city);
      collideVehicleWorld(v, this.city, this);
      if (v.burning > 0) {
        v.burning -= dt;
        if (Math.random() < 0.5) this.fx.fire(v.x, v.y);
        if (v.driver === 'ai') { v.driver = null; v.ai = null; }
        if (v === this.player.vehicle) this.hud.hint('O carro vai explodir! Saia já!');
        if (v.burning <= 0) this.explode(v);
      } else if (!v.wrecked && v.damage > 0.65 && Math.random() < v.damage * 0.25 && this.camera.visible(v.x, v.y, 40)) {
        this.fx.smoke(v.x + Math.cos(v.a) * v.m.l * 0.35, v.y + Math.sin(v.a) * v.m.l * 0.35, v.damage > 0.85);
      } else if (v.wrecked && Math.random() < 0.08 && this.camera.visible(v.x, v.y, 40)) this.fx.smoke(v.x, v.y, true, 5);
      // marcas de pneu
      if (v.skid > 0.3 && v.speed > 60 && this.camera.visible(v.x, v.y, 60)) {
        const ca = Math.cos(v.a), sa = Math.sin(v.a);
        const bx = v.x - ca * v.m.l * 0.32, by = v.y - sa * v.m.l * 0.32;
        const ox = -sa * v.m.w * 0.38, oy = ca * v.m.w * 0.38;
        if (v.skidPrev) {
          this.fx.skid(v.skidPrev[0], v.skidPrev[1], bx + ox, by + oy);
          this.fx.skid(v.skidPrev[2], v.skidPrev[3], bx - ox, by - oy);
        }
        v.skidPrev = [bx + ox, by + oy, bx - ox, by - oy];
        if (v === this.player.vehicle && Math.random() < 0.15) this.audio.play('skid', v.skid);
      } else v.skidPrev = null;
    }
    for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) collideVehicles(V[i], V[j], this);

    // humanos x veículos
    for (const h of this.humans) this.humanVsVehicles(h, false);
    if (!this.player.vehicle && !this.dying) this.humanVsVehicles(this.player, true);

    this.fx.update(dt);
    this.vehicles = V.filter((v) => !v.remove);
    this.humans = this.humans.filter((h) => !h.dead);

    const p = this.playerPos();
    const pv = this.player.vehicle;
    this.camera.update(dt, p.x, p.y, pv ? pv.vx : 0, pv ? pv.vy : 0, pv ? pv.speed : 0, this.cssW, this.cssH, this.settings.zoom);

    // áudio do motor
    if (pv) {
      const rpm = clamp(Math.abs(pv.fwdSpeed) / pv.m.maxSpeed, 0, 1);
      this.audio.updateEngine(!pv.wrecked, (rpm * 4) % 1 * 0.35 + rpm * 0.65, pv.throttle);
      this.audio.setHorn(s.horn && !pv.wrecked);
      this.stats.carDist += pv.speed * dt;
      this.stats.topSpeed = Math.max(this.stats.topSpeed, pv.speed * KMH);
    } else {
      this.audio.updateEngine(false, 0, 0);
      this.audio.setHorn(false);
    }

    // contexto dos botões touch
    if (this.touchOn) {
      const near = !pv && !!this.nearestEnterable();
      this.touch.setContext(pv ? 'car' : 'foot', near, !!this.prompt);
    }

    this.saveT -= dt;
    if (this.saveT <= 0) { this.saveT = 60; this.autosave(); }
  }

  updatePlayer(dt, s) {
    const p = this.player;
    const v = p.vehicle;
    const wantInteract = s.interact || (s.action && this.prompt);
    if (wantInteract && this.prompt) { this.triggerPrompt(); return; }

    if (v) {
      v.throttle = s.throttle;
      v.brake = s.brake;
      v.steer = s.steer;
      v.handbrake = s.handbrake && !this.prompt;
      p.x = v.x; p.y = v.y;
      if (s.horn && Math.random() < 0.1) {
        for (const h of this.humans) if (h.kind === 'ped' && dist(h.x, h.y, v.x, v.y) < 90) this.peds.flee(h, v.x, v.y, 2);
      }
      if (s.enterExit) this.exitVehicle();
      return;
    }

    if (p.punchT > 0) p.punchT -= dt;
    if (p.punchCd > 0) p.punchCd -= dt;
    if (p.state === 'down') {
      updateDownHuman(p, dt, this.city);
      p.down -= dt;
      if (p.down <= 0) p.state = 'walk';
      return;
    }
    let mx = s.moveX, my = s.moveY;
    const mag = Math.min(1, Math.hypot(mx, my));
    if (mag > 0.1) {
      // movimento em 8 direções
      const ang = Math.round(Math.atan2(my, mx) / (Math.PI / 4)) * (Math.PI / 4);
      const run = s.run;
      const sp = (run ? 165 * this.character.runMul : 82) * (this.touchOn && !run ? Math.max(0.55, mag) : 1);
      moveHuman(p, Math.cos(ang) * sp * dt, Math.sin(ang) * sp * dt, this.city);
      p.a += wrapAngle(ang - p.a) * Math.min(1, dt * 16);
      p.moving = run ? 2 : 1;
      p.phase += dt * sp * 0.15;
      this.stats.footDist += sp * dt;
      // empurra pedestres
      for (const h of this.humans) {
        if (h.state === 'down') continue;
        const dx = h.x - p.x, dy = h.y - p.y, d = Math.hypot(dx, dy);
        if (d < 13 && d > 0.01) moveHuman(h, (dx / d) * (13 - d), (dy / d) * (13 - d), this.city);
      }
    } else p.moving = 0;

    if ((s.punch || s.action) && !(p.punchCd > 0)) {
      p.punchT = 0.3;
      p.punchCd = 0.45;
      const fx = Math.cos(p.a), fy = Math.sin(p.a);
      for (const h of this.humans) {
        if (h.state === 'down' || h.state === 'board') continue;
        const dx = h.x - p.x, dy = h.y - p.y;
        const along = dx * fx + dy * fy, lat = Math.abs(-dx * fy + dy * fx);
        if (along > 0 && along < 24 && lat < 12) {
          h.knock(fx * 120, fy * 120, false);
          this.audio.play('punch');
          this.fx.sparks(h.x, h.y, 3, 0.4);
          this.police.crime(h.kind === 'cop' ? 'hitCop' : 'punch', h.x, h.y);
          this.peds.scare(h.x, h.y, 180);
          this.stats.knocked++;
          break;
        }
      }
    }
    if (s.enterExit) {
      const nv = this.nearestEnterable();
      if (nv) this.enterVehicle(nv);
    }
  }

  updateLocations() {
    if (this.dying) return;
    const L = this.city.locations, p = this.playerPos(), v = this.player.vehicle;
    const M = this.missions.active;
    if (dist(p.x, p.y, L.garage.x, L.garage.y) < 46) {
      if (v) {
        if (!(M && M.mv === v)) this.setPrompt('Guardar veículo na garagem', () => this.storeVehicle());
      } else this.setPrompt('Abrir garagem', () => this.ui.showGarage());
    }
    if (v && dist(p.x, p.y, L.respray.x, L.respray.y) < 46) {
      const cost = 250 + 150 * this.police.level;
      this.setPrompt(`Consertar e pintar ($${cost})`, () => this.respray());
    }
  }

  updateNPCs(dt) {
    for (const h of this.humans) {
      if (h.kind !== 'npc') continue;
      if (h.state === 'leave') {
        h.leaveT -= dt;
        moveHuman(h, Math.cos(h.a) * 45 * dt, Math.sin(h.a) * 45 * dt, this.city);
        h.moving = 1; h.phase += dt * 8;
        if (h.leaveT <= 0) { h.fade -= dt; if (h.fade <= 0) h.dead = true; }
      } else if (h.state === 'down') {
        updateDownHuman(h, dt, this.city);
        h.down -= dt;
        if (h.down <= 0 && !h.ko) h.state = 'wait';
      } else if (h.state === 'wait') {
        h.moving = 0;
      }
    }
  }

  // ---------------- renderização ----------------
  renderIdle(dt) {
    // fundo animado do menu: câmera passeando pela cidade
    const t = performance.now() / 1000;
    const cx = (MAP * T) / 2 + Math.cos(t * 0.05) * 1800, cy = (MAP * T) / 2 + Math.sin(t * 0.04) * 1500;
    this.camera.snap(cx, cy);
    this.camera.update(dt, cx, cy, 0, 0, 0, this.cssW, this.cssH, 0.9);
    const g = this.ctx;
    const z = this.camera.zoom * this.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0c0e13';
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(z, 0, 0, z, this.canvas.width / 2 - cx * z, this.canvas.height / 2 - cy * z);
    this.worldRenderer.draw(g, this.camera.view);
  }

  render() {
    const g = this.ctx, cam = this.camera;
    const W = this.canvas.width, H = this.canvas.height;
    const z = cam.zoom * this.dpr;
    const view = cam.view;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = true;
    g.setTransform(z, 0, 0, z, W / 2 - (cam.x + cam.sx) * z, H / 2 - (cam.y + cam.sy) * z);
    this.worldRenderer.draw(g, view);
    this.fx.drawSkids(g, view);
    this.drawTrafficLights(g, view);
    const markers = this.missions.markers();
    this.drawGroundMarkers(g, markers);

    const vis = (o, m = 60) => o.x > view.x0 - m && o.x < view.x1 + m && o.y > view.y0 - m && o.y < view.y1 + m;
    for (const h of this.humans) if (h.state === 'down' && vis(h)) drawHuman(g, h);
    if (this.player.state === 'down' && !this.player.vehicle) drawHuman(g, this.player);
    const night = this.time.darkness > 0.3;
    for (const v of this.vehicles) if (vis(v, 80)) drawVehicle(g, v, this.time.total, night);
    for (const h of this.humans) if (h.state !== 'down' && vis(h)) drawHuman(g, h);
    if (!this.player.vehicle && this.player.state !== 'down' && !this.dying) drawHuman(g, this.player);
    this.fx.draw(g);
    this.drawOverheadMarkers(g, markers);

    // iluminação noturna
    const dark = this.time.darkness;
    const tint = this.time.tint;
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (tint > 0.01) {
      g.fillStyle = `rgba(255,120,40,${tint * 0.5})`;
      g.fillRect(0, 0, W, H);
    }
    if (dark > 0.02) this.drawLighting(g, dark, view, z);
    this.drawObjectiveArrow(g, markers, W, H, z);
  }

  drawTrafficLights(g, view) {
    const col = { g: '#3cff6a', y: '#ffd23a', r: '#ff3b3b' };
    for (const it of this.city.intersections) {
      if (!it.light) continue;
      const x0 = it.x * T, y0 = it.y * T, x1 = (it.x + it.w) * T, y1 = (it.y + it.h) * T;
      if (x1 < view.x0 - 40 || x0 > view.x1 + 40 || y1 < view.y0 - 40 || y0 > view.y1 + 40) continue;
      const v = this.city.lightState(it.id, 'v'), h = this.city.lightState(it.id, 'h');
      const boxes = [[x0 - 10, y0 - 10, v], [x1 + 10, y1 + 10, v], [x0 - 10, y1 + 10, h], [x1 + 10, y0 - 10, h]];
      for (const [bx, by, st] of boxes) {
        g.fillStyle = '#15171b';
        g.fillRect(bx - 5, by - 5, 10, 10);
        g.fillStyle = col[st];
        g.beginPath(); g.arc(bx, by, 3.3, 0, 7); g.fill();
      }
    }
  }

  drawGroundMarkers(g, markers) {
    const t = this.time.total;
    for (const m of markers) {
      if (m.kind === 'vehicle' || m.kind === 'enemy') continue;
      if (!this.camera.visible(m.x, m.y, 80)) continue;
      const pulse = 1 + Math.sin(t * 4) * 0.08;
      if (m.kind === 'giver') {
        g.fillStyle = m.dim ? 'rgba(120,120,120,.25)' : this.hexA(m.color, 0.25);
        g.beginPath(); g.arc(m.x, m.y, m.r * 1.5 * pulse, 0, 7); g.fill();
        continue;
      }
      g.strokeStyle = m.color;
      g.lineWidth = 4;
      g.fillStyle = this.hexA(m.color, m.kind === 'next' ? 0.08 : 0.18);
      g.beginPath(); g.arc(m.x, m.y, m.r * pulse, 0, 7); g.fill();
      if (m.kind !== 'next') g.stroke();
    }
  }

  drawOverheadMarkers(g, markers) {
    const t = this.time.total;
    for (const m of markers) {
      if (!this.camera.visible(m.x, m.y, 60)) continue;
      const bob = Math.sin(t * 5) * 3;
      if (m.kind === 'giver') {
        // ícone de orelhão/contato
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.beginPath(); g.ellipse(m.x + 3, m.y + 4, 11, 6, 0, 0, 7); g.fill();
        g.fillStyle = m.dim ? '#888' : m.color;
        g.strokeStyle = '#111'; g.lineWidth = 2;
        g.beginPath(); g.arc(m.x, m.y - 14 + bob, 11, 0, 7); g.fill(); g.stroke();
        g.fillStyle = '#111'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(m.def ? this.missions.category(m.def).icon : '!', m.x, m.y - 13 + bob);
      } else if (m.kind === 'vehicle' || m.kind === 'enemy' || m.kind === 'target') {
        if (m.kind === 'target' && m.r > 0) continue;
        g.fillStyle = m.color; g.strokeStyle = '#111'; g.lineWidth = 2;
        const y = m.y - 34 + bob;
        g.beginPath(); g.moveTo(m.x - 9, y - 10); g.lineTo(m.x + 9, y - 10); g.lineTo(m.x, y + 3); g.closePath(); g.fill(); g.stroke();
      }
    }
  }

  drawObjectiveArrow(g, markers, W, H, z) {
    const cam = this.camera;
    const tgt = markers.find((m) => m.kind === 'target' || m.kind === 'vehicle' || m.kind === 'enemy');
    if (!tgt || cam.visible(tgt.x, tgt.y, -30)) return;
    const dx = tgt.x - cam.x, dy = tgt.y - cam.y;
    const a = Math.atan2(dy, dx);
    const m = 46 * this.dpr;
    const kx = (W / 2 - m) / Math.abs(Math.cos(a) || 1e-6), ky = (H / 2 - m) / Math.abs(Math.sin(a) || 1e-6);
    const k = Math.min(kx, ky);
    const x = W / 2 + Math.cos(a) * k, y = H / 2 + Math.sin(a) * k;
    g.save();
    g.translate(x, y);
    g.scale(this.dpr, this.dpr);
    g.rotate(a);
    g.fillStyle = tgt.color.startsWith('rgba') ? '#ffd23a' : tgt.color;
    g.strokeStyle = '#111'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(16, 0); g.lineTo(-8, -11); g.lineTo(-3, 0); g.lineTo(-8, 11); g.closePath(); g.fill(); g.stroke();
    g.restore();
    const dm = Math.round(Math.hypot(dx, dy) * 0.11);
    g.save();
    g.translate(x - Math.cos(a) * 30 * this.dpr, y - Math.sin(a) * 30 * this.dpr);
    g.scale(this.dpr, this.dpr);
    g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(-22, -8, 44, 16);
    g.fillStyle = '#fff'; g.fillText(dm > 999 ? (dm / 1000).toFixed(1) + 'km' : dm + 'm', 0, 0);
    g.restore();
    void z;
  }

  drawLighting(g, dark, view, z) {
    const L = this.lightG, cv = this.lightCv;
    const sc = cv.width / this.canvas.width;
    L.globalCompositeOperation = 'source-over';
    L.setTransform(1, 0, 0, 1, 0, 0);
    L.clearRect(0, 0, cv.width, cv.height);
    L.fillStyle = `rgba(6,10,28,${dark})`;
    L.fillRect(0, 0, cv.width, cv.height);
    L.globalCompositeOperation = 'destination-out';
    const zz = z * sc;
    L.setTransform(zz, 0, 0, zz, cv.width / 2 - (this.camera.x + this.camera.sx) * zz, cv.height / 2 - (this.camera.y + this.camera.sy) * zz);
    const spr = this.lightSprite;
    const inV = (x, y, m) => x > view.x0 - m && x < view.x1 + m && y > view.y0 - m && y < view.y1 + m;
    for (const l of this.city.lamps) {
      if (!inV(l.x, l.y, 90)) continue;
      const lx = l.x + Math.cos(l.a) * 9, ly = l.y + Math.sin(l.a) * 9;
      L.drawImage(spr, lx - 80, ly - 80, 160, 160);
    }
    for (const v of this.vehicles) {
      if (!v.driver || v.wrecked || !inV(v.x, v.y, 160)) continue;
      const ca = Math.cos(v.a), sa = Math.sin(v.a);
      for (let k = 1; k <= 2; k++) {
        const d = v.m.l / 2 + 26 * k;
        const r = 30 + 14 * k;
        L.drawImage(spr, v.x + ca * d - r, v.y + sa * d - r, r * 2, r * 2);
      }
    }
    if (!this.player.vehicle) L.drawImage(spr, this.player.x - 45, this.player.y - 45, 90, 90);
    for (const p of this.fx.list) if (p.t === 'fire' || p.t === 'flash') L.drawImage(spr, p.x - 40, p.y - 40, 80, 80);
    for (const it of this.city.intersections) {
      if (!it.light) continue;
      const cx = (it.x + it.w / 2) * T, cy = (it.y + it.h / 2) * T;
      if (!inV(cx, cy, 120)) continue;
      L.drawImage(spr, cx - 70, cy - 70, 140, 140);
    }
    g.drawImage(cv, 0, 0, this.canvas.width, this.canvas.height);
    // brilhos coloridos (sirenes, lâmpadas)
    g.globalCompositeOperation = 'lighter';
    g.setTransform(z, 0, 0, z, this.canvas.width / 2 - (this.camera.x + this.camera.sx) * z, this.canvas.height / 2 - (this.camera.y + this.camera.sy) * z);
    for (const v of this.vehicles) {
      if (!v.siren || v.wrecked || !inV(v.x, v.y, 100)) continue;
      const on = Math.floor(v.sirenT * 6) % 2;
      g.fillStyle = on ? 'rgba(255,40,40,.22)' : 'rgba(40,90,255,.22)';
      g.beginPath(); g.arc(v.x, v.y, 46, 0, 7); g.fill();
    }
    for (const l of this.city.lamps) {
      if (!inV(l.x, l.y, 30)) continue;
      g.fillStyle = `rgba(255,220,140,${0.18 * dark})`;
      g.beginPath(); g.arc(l.x + Math.cos(l.a) * 9, l.y + Math.sin(l.a) * 9, 22, 0, 7); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  hexA(hex, a) {
    if (!hex.startsWith('#')) return hex;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
}
