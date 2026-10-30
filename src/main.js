import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, lerp, smoothstep, angleDiff } from './util.js';
import { World, surfaceAt, groundAt, heightAt, zoneName, cityAt, puddleAt, LIGHTS_N, crossingAhead, lightAt, gangAt, ROAD_W, GANGS } from './world.js';
import { Vehicle, collideVehicles, BEAM, VTYPES } from './vehicle.js';
import { Character } from './character.js';
import { Traffic, Peds, Driver } from './npc.js';
import { Environment } from './sky.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { Settings, buildSettingsUI } from './settings.js';
import { Audio, STATIONS } from './audio.js';
import { Voice } from './voice.js';
import { Missions } from './missions.js';
import { LINES, ui } from './i18n.js';
import { Police } from './police.js';
import { FX } from './fx.js';
import { Skids } from './skids.js';
import { Air } from './air.js';
import { Shops, PLACES } from './shops.js';
import { Combat } from './combat.js';
import { Animals } from './animals.js';
import { Props } from './props.js';
import { startRag, ragHits, getUp } from './ragdoll.js';
import { periodAt } from './sky.js';

const settings = new Settings();
const Q = settings.get('quality');

const renderer = new THREE.WebGLRenderer({ antialias: Q !== 'low', powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q === 'high' ? 1.5 : Q === 'mid' ? 1 : 0.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.65;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 4200);
camera.position.set(1300, 150, 1000);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.5, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- jogador
class Player {
  constructor() {
    this.char = new Character({ skin: 0x6b4226, shirt: 0xf4f4f4, pants: 0x1f3a6b, hair: 0x111111, chain: true });
    this.pos = new THREE.Vector3(389, 3.2, 645);
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.heading = 0;
    this.health = 100;
    this.vehicle = null;
    this.onGround = true;
    this.swim = false;
    this.down = 0;
    this.speed = 0;
    this.stamina = 5;
    this.breath = 15;
    this.under = false;
    this.airT = 0;
    scene.add(this.char.root);
  }
}

// ---------------------------------------------------------------- jogo
const game = {
  scene, camera, renderer, settings,
  vehicles: [], blips: [], markers: [], actors: [], waiters: [],
  money: 0, wanted: 0, wantedFlash: 0, crimeT: 0,
  simTime: 0, playing: false, paused: false, mapOpen: false, locked: false,
  ui: { nearCar: false }, // o que a tela de toque precisa mostrar agora
  cine: null, cam: { yaw: Math.PI, pitch: 0.22, dist: 4.5, shake: 0, pos: new THREE.Vector3() },
  focus: new THREE.Vector3(), camForward: new THREE.Vector3(0, 0, 1),
  token: null, failReason: '',

  addVehicle(v) { this.vehicles.push(v); scene.add(v.root); return v; },
  removeVehicle(v) {
    const i = this.vehicles.indexOf(v);
    if (i >= 0) this.vehicles.splice(i, 1);
    scene.remove(v.root);
  },
  spawnVehicle(type, color, x, z, h) { const v = new Vehicle(type, color, x, z, h); v.mission = true; return this.addVehicle(v); },
  addWanted(x) { this.wanted = clamp(this.wanted + x, 0, 5); this.crimeT = 0; this.wantedFlash = 2; },
  addActor(ch, x, z, h) {
    const a = { ch, pos: new THREE.Vector3(x, groundAt(x, z), z), heading: h };
    ch.root.position.copy(a.pos); ch.root.rotation.y = h;
    scene.add(ch.root);
    this.actors.push(a);
    return a;
  },
  addBlip(b) { this.removeBlip(b.id); this.blips.push(b); },
  removeBlip(id) { this.blips = this.blips.filter((b) => b.id !== id); },
  addMarker(x, z, color, r = 2.5) {
    const y = heightAt(x, z);
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 5, 32, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    m.position.y = 2.5;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 8, 48).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color }));
    ring.position.y = 0.2;
    g.add(m, ring);
    g.position.set(x, y, z);
    scene.add(g);
    this.markers.push(g);
    return g;
  },
  removeMarker(g) { scene.remove(g); this.markers = this.markers.filter((m) => m !== g); },
  clearMission() {
    this.waiters.length = 0;
    this.blips = this.blips.filter((b) => b.keep);
    for (const m of [...this.markers]) this.removeMarker(m);
  },
  until(fn, failFn) { return new Promise((res, rej) => this.waiters.push({ fn, failFn, res, rej })); },
  wait(s) { const t = this.simTime + s; return this.until(() => this.simTime >= t); },
  say(spk, line, ch, opts = {}) { return this.voice.say(spk, line, { char: ch, ...opts }); },
  lock(v) { this.locked = v; this.hud.setVisible(!v); },
  cineSet(p, l) { this.cine = { p0: new THREE.Vector3(...p), p1: new THREE.Vector3(...p), l0: new THREE.Vector3(...l), l1: new THREE.Vector3(...l), t: 1, dur: 1 }; },
  cineTo(p0, p1, l0, l1, dur) {
    this.cine = { p0: new THREE.Vector3(...p0), p1: new THREE.Vector3(...p1), l0: new THREE.Vector3(...l0), l1: new THREE.Vector3(...l1), t: 0, dur };
    const c = this.cine;
    return this.until(() => c.t >= c.dur || this.cine !== c);
  },
  cineTitle(a, b) { this.hud.cineTitle(a, b); },
  camYawTo(y) { this.cam.yaw = y; },
  setPlayerLook(look, muscle) {
    const p = this.player, old = p.char;
    stopSmoking(this.player, false);
    const ch = new Character({ ...look, muscle, fat: this.shops ? this.shops.data.fat : 0 });
    if (this.combat) ch.setWeapon(this.combat.current);
    ch.root.position.copy(old.root.position); ch.root.rotation.copy(old.root.rotation);
    if (p.vehicle) p.vehicle.setRider(ch); else { scene.remove(old.root); scene.add(ch.root); }
    p.char = ch;
  },
  explode(v) {
    v.exploded = true; v.health = -1; v.dead = true;
    v.paint.color.setHex(0x161616); v.paint.clearcoat = 0; v.paint.metalness = 0.1; v.paint.roughness = 1;
    for (const k in v.parts || {}) if (v.parts[k].visible && Math.random() < 0.6) (k.startsWith('pane') || k.startsWith('head') || k.startsWith('tail') ? fx.glass(v, v.parts[k]) : fx.detach(v, v.parts[k]));
    fx.explode(v.pos.x, v.pos.y, v.pos.z, v.color);
    audio.boom();
    v.vy = 7; v.onGround = false; v.yawRate += (Math.random() - 0.5) * 3;
    const d = v.pos.distanceTo(camera.position);
    this.cam.shake = Math.max(this.cam.shake, Math.max(0, 1.2 - d / 60));
    input.rumble(1, 1, 500);
    if (this.player.vehicle === v) { this.exitVehicle(true); this.player.health -= 70; this.player.down = 2.5; }
    else if (this.player.pos.distanceTo(v.pos) < 7) { this.player.health -= 40; this.player.down = 2; }
    for (const o of this.vehicles) if (o !== v && o.pos.distanceTo(v.pos) < 9) { const dir = o.pos.clone().sub(v.pos).setY(0).normalize(); o.vel.addScaledVector(dir, 6); o.sleeping = false; o.damage(4); }
    peds.scare(v.pos.x, v.pos.z, 40);
    if (v.driver === 'player' || this.player.pos.distanceTo(v.pos) < 40) this.addWanted(0.5);
  },
  placePlayer(x, z, h) {
    const p = this.player;
    p.swim = false; p.under = false; p.vy = 0; p.tumble = null; p.down = 0; p.rag = null; p.getupT = 0; if (p.char) { p.char.getup = 0; p.char.root.rotation.set(0, p.heading || 0, 0); } stopSmoking(p, false); p.idleT = 0;
    if (p.vehicle) this.exitVehicle(true);
    p.pos.set(x, groundAt(x, z), z); p.vel.set(0, 0, 0); p.heading = h; this.cam.yaw = h;
  },

  enterVehicle(v) {
    stopSmoking(this.player, false);
    const p = this.player;
    if (v.police) { this.addWanted(2); v.police = false; if (v.siren) v.siren.red.emissiveIntensity = v.siren.blue.emissiveIntensity = 0; }
    if (v.driver === 'ai' && v.rider) {
      const ch = v.rider;
      v.setRider(null);
      const d = v.doorPoint(1);
      ch.animate(0, 0, 'ground');
      this.peds.spawnAt(d.x, d.z, ch, { x: p.pos.x, z: p.pos.z });
      this.voice.say('pedM', LINES.jack[Math.floor(Math.random() * 3)], { ambient: true, char: ch, pitch: 0.9 + Math.random() * 0.3 });
      this.addWanted(0.5);
      v.ai = null;
    }
    v.driver = 'player';
    v.sleeping = false;
    if (!v.lightTouched && !v.t.pedal) v.headOn = env.lightsOn;
    v.traffic = false;
    p.vehicle = v;
    scene.remove(p.char.root);
    v.setRider(p.char);
    this.audio.door();
    this.hud.vehicle(v.t.name);
    if (!v.t.twoWheel && this.audio.station) this.audio.startRadio();
  },
  // pular do veículo andando: sai pela porta com a velocidade do carro, rola no chão e se machuca
  bailOut() {
    const p = this.player, v = p.vehicle;
    if (!v) return;
    const sp = v.speed;
    this.exitVehicle(true);
    // empurra pro lado da porta por onde saiu
    const sh = Math.sin(v.heading), ch = Math.cos(v.heading);
    const side = Math.sign((p.pos.x - v.pos.x) * ch - (p.pos.z - v.pos.z) * sh) || 1;
    p.vel.set(v.vel.x * 0.85 + ch * side * 3.2, 0, v.vel.z * 0.85 - sh * side * 3.2);
    p.vy = 2.8; p.onGround = false;
    p.pos.y += 0.6;
    p.tumble = { t: 0, roll: 0, hit: false, dmg: Math.min(75, Math.max(0, sp - 6) * 2.6 + 4), sp };
    p.heading = Math.atan2(p.vel.x, p.vel.z);
    // carro sem motorista continua rodando até parar sozinho
    v.coastT = 6; v.sleeping = false;
    this.audio.door();
  },
  exitVehicle(force) {
    const p = this.player, v = p.vehicle;
    if (!v) return;
    if (!force && v.speed > 12) return;
    let d = v.doorPoint(1);
    const tmp = { x: d.x, z: d.z };
    if (this.world.col.resolveCircle(tmp, 0.4, v.pos.y)) d = v.doorPoint(-1);
    v.setRider(null);
    v.driver = null;
    game.lastCar = v;
    p.vehicle = null;
    p.pos.set(d.x, groundAt(d.x, d.z), d.z);
    p.vel.copy(v.vel).multiplyScalar(0.5);
    p.heading = v.heading;
    scene.add(p.char.root);
    this.audio.stopRadio();
    this.audio.setHorn(false);
    this.audio.door();
  },
};

const player = (game.player = new Player());
const world = (game.world = new World(scene, Q));
const input = (game.input = new Input(settings, renderer.domElement));
const audio = (game.audio = new Audio(settings));
let env, hud, voice, traffic, peds, missions, police, air, shops, combat, animals, props;
const fx = (game.fx = new FX(scene));
const skids = new Skids(scene);

// luzes dinâmicas: postes próximos e farol do jogador
const lampLights = [];
for (let i = 0; i < 6; i++) {
  const l = new THREE.PointLight(0xffc77a, 0, 26, 1.6);
  scene.add(l);
  lampLights.push(l);
}
const headlight = new THREE.SpotLight(0xfff1d6, 0, 70, 0.55, 0.45, 1.3);
scene.add(headlight, headlight.target);
let lampTimer = 0, lampNear = [];

// pneus no molhado: névoa atrás das rodas e água espirrando quando passa na poça
function wetTires(car, dt, mine) {
  const sp = car.speed, t = car.t;
  if (!car.onGround || car.inWater || sp < 5 || (car.surface !== 'road' && car.surface !== 'walk')) return;
  const sh = Math.sin(car.heading), ch = Math.cos(car.heading), hw = t.twoWheel ? 0 : t.width / 2 - 0.13;
  const y = car.pos.y + 0.25;
  const amt = env.wetness * Math.min(1, sp / 22);
  for (const s of t.twoWheel ? [0] : [1, -1]) {
    const x = car.pos.x + ch * hw * s - sh * (t.b + 0.3), z = car.pos.z - sh * hw * s - ch * (t.b + 0.3);
    if (Math.random() < dt * sp * 0.9) fx.spray(x, y, z, car.vel.x, car.vel.z, amt);
  }
  car._pudT = (car._pudT || 0) - dt;
  for (const [s, pd] of [[1, car.pudL], [-1, car.pudR]]) {
    if (pd < 0.35 || car._pudT > 0) continue;
    const x = car.pos.x + ch * hw * s + sh * t.a, z = car.pos.z - sh * hw * s + ch * t.a;
    fx.puddle(x, car.pos.y + 0.15, z, ch * s, -sh * s, car.vel.x, car.vel.z, sp);
    car._pudT = 0.12;
    if (mine) { audio.splash(false); if (car.aqua > 0.25) input.rumble(0.25, 0.4, 120); }
  }
}

// luzes que se refletem no chão molhado (postes próximos + faróis e lanternas dos carros perto da câmera)
function updateWetLights(lit) {
  const U = world.wetU, L = U.uL.value, C = U.uLC.value;
  let n = 0;
  const put = (x, y, z, w, r, g, b) => { if (n < LIGHTS_N) { L[n].set(x, y, z, w); C[n].setRGB(r, g, b); n++; } };
  if (env.wetness > 0.05) {
    for (const l of lampNear) put(l.lx, l.ly, l.lz, lit * 7, 1, 0.78, 0.45);
    const cx = camera.position.x, cz = camera.position.z;
    const cars = game.vehicles.filter((c) => (c.lights || (c.brakeOn && c.driver)) && !c.exploded && Math.abs(c.pos.x - cx) + Math.abs(c.pos.z - cz) < 90)
      .sort((a, b) => a.pos.distanceToSquared(camera.position) - b.pos.distanceToSquared(camera.position));
    for (const c of cars) {
      const sh = Math.sin(c.heading), ch = Math.cos(c.heading), t = c.t, y = c.pos.y + t.wheelR + 0.45;
      const fx = c.pos.x + sh * t.length * 0.5, fz = c.pos.z + ch * t.length * 0.5;
      const bx = c.pos.x - sh * t.length * 0.5, bz = c.pos.z - ch * t.length * 0.5;
      const ox = ch * t.width * 0.33, oz = -sh * t.width * 0.33;
      if (c.lights) { put(fx + ox, y, fz + oz, 8, 1, 0.95, 0.82); if (!t.twoWheel) put(fx - ox, y, fz - oz, 8, 1, 0.95, 0.82); }
      put(bx, y, bz, c.brakeOn && c.driver ? 6 : 2, 1, 0.08, 0.03);
    }
  }
  for (let i = n; i < LIGHTS_N; i++) L[i].w = 0;
}

// ---------------------------------------------------------------- atualização do jogador a pé
const tmpP = { x: 0, z: 0 };
function updateTumble(dt) {
  const p = player, ch = p.char, T = p.tumble;
  T.t += dt;
  p.vy -= 20 * dt;
  p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt; p.pos.y += p.vy * dt;
  const gy = groundAt(p.pos.x, p.pos.z);
  let mode = 'bail';
  if (p.pos.y <= gy) {
    p.pos.y = gy;
    if (!T.hit) {
      // impacto com o chão: o dano depende da velocidade
      T.hit = true;
      p.health -= T.dmg;
      audio.crash(T.sp * 0.5); audio.punch();
      input.rumble(clamp(T.sp / 25, 0.4, 1), 0.8, 350);
      game.cam.shake = Math.max(game.cam.shake, clamp(T.sp * 0.02, 0.15, 0.5));
      if (T.sp > 14) combat.blood(p.pos.x, p.pos.y + 0.3, p.pos.z, 6);
    }
    p.vy = Math.abs(p.vy) > 3 && T.t < 1.2 ? -p.vy * 0.25 : 0;
    // atrito do asfalto (grama segura mais)
    const sp = Math.hypot(p.vel.x, p.vel.z), fr = (surfaceAtCached(p.pos.x, p.pos.z) === 'grass' ? 9 : 6.5) * dt;
    const k = sp > fr ? (sp - fr) / sp : 0;
    p.vel.x *= k; p.vel.z *= k;
    T.roll += (sp / 0.45) * dt;
    mode = 'tumble';
    if (Math.random() < dt * sp * 2) fx.sprite(p.pos.x, p.pos.y + 0.1, p.pos.z, { color: 0xb5a890, op: 0.5, size: 0.4, life: 0.8, vy: 0.5, grow: 2.2 });
    if (sp < 0.6) {
      // termina deitado e depois levanta
      p.tumble = null; p.down = 1.8; p.vel.set(0, 0, 0); p.onGround = true;
      ch.rollA = 0;
    }
  } else T.roll += dt * 3;
  // parede ou carro no caminho: bate e para
  const bx = p.pos.x, bz = p.pos.z;
  if (world.col.resolveCircle(p.pos, 0.35, p.pos.y) && Math.hypot(p.vel.x, p.vel.z) > 4) {
    p.health -= Math.hypot(p.vel.x, p.vel.z) * 1.5; audio.crash(5); game.cam.shake = 0.3;
    p.vel.multiplyScalar(-0.2);
  }
  void bx; void bz;
  ch.rollA = T ? T.roll : 0;
  ch.root.position.copy(p.pos);
  ch.root.rotation.y = p.heading;
  ch.animate(dt, 0, p.tumble ? mode : 'down');
  p.speed = Math.hypot(p.vel.x, p.vel.z);
  game.ui.nearCar = false;
}
// jogador atropelado: mesma física do pedestre; depois fica caído e levanta
function updatePlayerRag(dt) {
  const p = player, ch = p.char;
  if (p.rag) {
    const R = p.rag;
    const near = game.vehicles.filter((v) => v !== p.vehicle && !v.t.boat && Math.abs(v.pos.x - R.pos.x) < 9 && Math.abs(v.pos.z - R.pos.z) < 9);
    R.step(dt, near, world.col);
    ragHits(game, R, (dv, head) => {
      p.health -= (dv - 3.5) * (head ? 5 : 2.2);
      game.cam.shake = Math.max(game.cam.shake, clamp(dv * 0.03, 0.08, 0.4)); input.rumble(clamp(dv / 12, 0.3, 1), 0.6, 160);
    }, fx);
    R.apply(ch.root);
    const f = R.feet;
    p.pos.set(f.x, f.y, f.z);
    p.vel.copy(R.vel).setY(0);
    ch.ragK = R.flail;
    ch.animate(dt, 0, 'rag');
    if (R.done || R.air > 8) {
      p.rag = null; p.restQ = ch.root.quaternion.clone(); p.restPos = ch.root.position.clone();
      p.getupT = 1.6; p.vel.set(0, 0, 0);
    }
  } else {
    p.getupT -= dt;
    getUp(ch.root, p.restQ, p.restPos, p.heading, p.getupT, ch);
    ch.animate(dt, 0, 'rag');
    if (p.getupT <= 0) {
      p.pos.set(ch.root.position.x, groundAt(ch.root.position.x, ch.root.position.z), ch.root.position.z);
      ch.root.rotation.set(0, p.heading, 0); ch.getup = 0; p.getupT = 0; p.onGround = true; p.vy = 0;
    }
  }
  p.speed = Math.hypot(p.vel.x, p.vel.z);
  game.ui.nearCar = false;
}
const surfaceAtCached = (x, z) => surfaceAt(x, z);

// parado um tempo: tira o cigarro do bolso, acende e fuma; perto da parede encosta com o pé nela
const _tip = new THREE.Vector3(), _mouth = new THREE.Vector3(), colQ = [];
function wallNear(p) {
  let best = null;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, sx = Math.sin(a), sz = Math.cos(a);
    for (const r of [0.45, 0.65, 0.85, 1.05]) {
      const x = p.pos.x + sx * r, z = p.pos.z + sz * r;
      const hit = world.col.query(x, z, 0.05, colQ).some((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && b.y0 < p.pos.y + 1 && b.y1 > p.pos.y + 1.5);
      if (hit) { if (!best || r < best.r) best = { r, a }; break; }
    }
  }
  return best;
}
function stopSmoking(p, flick) {
  const ch = p.char, S = p.smk;
  if (!S) return;
  if (flick && ch.cigTip && S.lit) {
    ch.cigTip.getWorldPosition(_tip);
    fx.sprite(_tip.x, _tip.y, _tip.z, { color: 0xff7a20, op: 1, add: true, size: 0.06, life: 0.7, vx: Math.sin(p.heading) * 2.5, vy: 1.5, vz: Math.cos(p.heading) * 2.5, g: 9, grow: 0.8 });
  }
  ch.setCig(false);
  ch.idle = null;
  p.smk = null;
}
function updateIdle(dt, inp, mode) {
  const p = player, ch = p.char;
  const calm = mode === 'ground' && p.speed < 0.15 && inp.mag < 0.05 && !inp.punch && !inp.jump && !inp.aim && !inp.enter && combat.current === 'fist'
    && !shops.open && !game.locked && !game.cine && game.wanted < 0.5 && ch.punchT <= 0 && ch.guard <= 0 && p.health > 0;
  if (!calm) { p.idleT = 0; if (p.smk) stopSmoking(p, true); return; }
  p.idleT = (p.idleT || 0) + dt;
  if (!p.smk) {
    if (p.idleT < 7) return;
    const w = wallNear(p);
    p.smk = { t: 0, lit: false, cycle: 0, wall: w, lean: 0, exhaleT: -1, wispT: 0 };
    ch.idle = { hand: 0, pocket: 0, glow: 0, puff: 0, lean: 0 };
  }
  const S = p.smk, I = ch.idle;
  S.t += dt;
  // encosta: vira de costas pra parede e chega rente a ela
  if (S.wall) {
    const a = S.wall.a, want = S.wall.r - 0.42;
    p.heading += angleDiff(p.heading, a + Math.PI) * Math.min(1, dt * 4);
    const mv = Math.min(dt * 0.8, Math.max(0, want - (S.moved || 0)));
    S.moved = (S.moved || 0) + mv;
    p.pos.x += Math.sin(a) * mv; p.pos.z += Math.cos(a) * mv;
    I.lean = Math.min(1, I.lean + dt * 1.5);
  }
  const t = S.t;
  I.pocket = 0; I.puff = 0;
  if (t < 0.7) I.pocket = Math.sin((t / 0.7) * Math.PI);
  else if (!ch.cig) ch.setCig(true);
  if (t >= 0.7 && t < 2.9) {
    // primeira tragada: leva à boca, acende com o isqueiro, puxa e abaixa
    I.hand = t < 1.3 ? (t - 0.7) / 0.6 : t < 2.3 ? 1 : 1 - (t - 2.3) / 0.6;
    if (t > 1.4 && !S.lit) {
      S.lit = true; audio.click();
      ch.cigTip.getWorldPosition(_tip);
      for (let k = 0; k < 3; k++) fx.sprite(_tip.x, _tip.y, _tip.z + 0.02, { color: 0xffb040, op: 1, add: true, size: 0.07, life: 0.25, vy: 0.4, grow: 0.6 });
    }
    I.glow = S.lit && t < 2.3 ? 1 : Math.max(0, I.glow - dt * 2);
    I.puff = t > 1.5 && t < 2.3 ? 0.4 : 0;
    if (t > 2.6 && S.exhaleT < 0) S.exhaleT = 0;
  } else if (t >= 2.9) {
    // depois: tragada a cada ~6 s
    const c = (t - 2.9) % 6.2;
    I.hand = c < 0.7 ? c / 0.7 : c < 1.9 ? 1 : c < 2.5 ? 1 - (c - 1.9) / 0.6 : 0;
    I.glow = c > 0.7 && c < 1.9 ? 1 : Math.max(0, I.glow - dt * 1.5);
    I.puff = c > 0.8 && c < 1.9 ? 0.35 : 0;
    const cyc = Math.floor((t - 2.9) / 6.2);
    if (c > 2.6 && S.cycle <= cyc) { S.cycle = cyc + 1; S.exhaleT = 0; }
  }
  // fumaça soltando pela boca e pelo nariz depois da tragada
  if (S.exhaleT >= 0) {
    S.exhaleT += dt;
    I.puff = Math.max(I.puff, 0.25);
    ch.head.getWorldPosition(_mouth);
    const fx_ = Math.sin(p.heading), fz_ = Math.cos(p.heading);
    if (Math.random() < dt * 30) fx.sprite(_mouth.x + fx_ * 0.16, _mouth.y + 0.05, _mouth.z + fz_ * 0.16, { color: 0xd4d4d4, op: 0.32, size: 0.1, life: 2.4, vx: fx_ * 0.55 + env.wind.x * 0.06, vy: 0.22, vz: fz_ * 0.55 + env.wind.y * 0.06, grow: 2.6 });
    if (S.exhaleT > 1.1) S.exhaleT = -1;
  }
  // fiozinho de fumaça subindo da ponta acesa
  if (S.lit && ch.cigTip) {
    S.wispT -= dt;
    if (S.wispT <= 0) {
      S.wispT = 0.12;
      ch.cigTip.getWorldPosition(_tip);
      fx.sprite(_tip.x, _tip.y + 0.02, _tip.z, { color: 0xc8c8c8, op: 0.18, size: 0.035, life: 2.2, vx: env.wind.x * 0.05 + (Math.random() - 0.5) * 0.05, vy: 0.35, vz: env.wind.y * 0.05 + (Math.random() - 0.5) * 0.05, grow: 2.2 });
    }
  }
}

function updateOnFoot(dt, inp) {
  const p = player, ch = p.char;
  if (p.tumble) { updateTumble(dt); return; }
  if (p.rag || p.getupT > 0) { updatePlayerRag(dt); return; }
  const free = !game.locked && p.down <= 0;
  let mx = free ? inp.moveX : 0, my = free ? inp.moveY : 0, mag = free ? inp.mag : 0;
  const yaw = game.cam.yaw;
  let wx = Math.sin(yaw) * my - Math.cos(yaw) * mx, wz = Math.cos(yaw) * my + Math.sin(yaw) * mx;
  const wl = Math.hypot(wx, wz);
  if (wl > 0.01) { wx /= wl; wz /= wl; }
  const gy = groundAt(p.pos.x, p.pos.z);
  const deep = gy < -1.35;
  if (deep && !p.swim && p.pos.y < 0.15) {
    p.swim = true; p.under = false;
    fx.splash(p.pos.x, 0, p.pos.z, p.vy < -6);
    audio.splash(p.vy < -6);
    if (p.vy < -6) { p.under = true; p.vy = Math.max(p.vy * 0.25, -3); }
  }
  if (!deep && p.swim && p.pos.y > gy - 0.6) { p.swim = false; p.under = false; }
  const shops = game.shops;
  const sprinting = inp.sprint && p.stamina > 0 && mag > 0.1;
  p.sprinting = sprinting;
  if (sprinting) p.stamina -= dt; else p.stamina = Math.min(shops.sprintMax, p.stamina + dt * 0.7);
  let top = p.swim ? (p.under ? 2.1 : sprinting ? 3.4 : 2.3) : sprinting ? 7.4 : 4.6;
  top *= 1 - shops.data.fat * 0.18;
  if (p.char.aim > 0.5) top = Math.min(top, 2.4);
  if (!inp.analog && !inp.walk) mag = mag > 0 ? 1 : 0;
  const speed = top * mag;
  if (settings.get('view') === 'first' && !p.swim && p.down <= 0) p.heading += clamp(angleDiff(p.heading, yaw), -dt * 14, dt * 14);
  else if (wl > 0.01) p.heading += clamp(angleDiff(p.heading, Math.atan2(wx, wz)), -dt * 11, dt * 11);
  const k = 1 - Math.exp(-dt * (p.onGround || p.swim ? (p.swim ? 4 : 12) : 1.5));
  p.vel.x = lerp(p.vel.x, wx * speed, k);
  p.vel.z = lerp(p.vel.z, wz * speed, k);
  const ox = p.pos.x, oz = p.pos.z;
  p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;
  // pisando em poça: espirra água a cada passo
  const hs = Math.hypot(p.vel.x, p.vel.z);
  const spotW = props ? props.wetAt(p.pos.x, p.pos.z) : 0;
  if (!p.swim && p.onGround && hs > 1.2 && (env.wetness > 0.3 || spotW > 0.2)) {
    p.stepT = (p.stepT || 0) - dt * hs * 0.6;
    if (p.stepT <= 0) {
      p.stepT = 1;
      if (puddleAt(p.pos.x, p.pos.z, env.wetness) > 0.3 || spotW > 0.35) {
        for (let k = 0; k < 5; k++) fx.sprite(p.pos.x, p.pos.y + 0.05, p.pos.z, { color: 0xdfe8ef, op: 0.45, size: 0.1, life: 0.35, vx: (Math.random() - 0.5) * 2 + p.vel.x * 0.3, vy: 1 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 2 + p.vel.z * 0.3, g: 12, grow: 1.5 });
      }
    }
  }
  if (!p.swim && p.onGround && groundAt(p.pos.x, p.pos.z) - p.pos.y > 0.6) { p.pos.x = ox; p.pos.z = oz; }
  if (p.swim) {
    p.onGround = false;
    const bed = heightAt(p.pos.x, p.pos.z) + 0.5;
    if (free && inp.dive) p.under = true;
    if (p.under) {
      const want = free && inp.dive ? -2.4 : free && inp.up ? 2.8 : 0.7;
      p.vy = lerp(p.vy, want, 1 - Math.exp(-dt * 3));
      p.pos.y += p.vy * dt;
      if (p.pos.y < bed) { p.pos.y = bed; p.vy = Math.max(p.vy, 0); }
      if (p.pos.y >= -0.35) { p.under = false; p.pos.y = -0.35; if (p.breath < shops.breathMax * 0.5) audio.splash(false); }
      p.breath -= dt;
      if (p.breath < 0) p.health -= dt * 10;
      if (Math.random() < dt * 3) fx.bubbles(p.pos.x + Math.sin(p.heading) * 0.9, p.pos.y + 0.3, p.pos.z + Math.cos(p.heading) * 0.9);
    } else {
      p.vy = 0;
      p.pos.y = lerp(p.pos.y, -0.35 + Math.sin(game.simTime * 1.7) * 0.06 * (1 + env.windStrength), 1 - Math.exp(-dt * 4));
      p.breath = Math.min(shops.breathMax, p.breath + dt * 5);
      if (free && inp.jump && gy > -2.2) { p.vy = 4; p.swim = false; }
    }
  } else {
    p.breath = Math.min(shops.breathMax, p.breath + dt * 5);
    if (free && inp.jump && p.onGround) { p.vy = 6.2; p.onGround = false; p.airT = 0; }
    p.vy -= 20 * dt;
    p.pos.y += p.vy * dt;
    if (p.pos.y <= gy || (p.onGround && p.pos.y - gy < 0.45)) {
      if (!p.onGround && p.vy < -14) { p.health -= (-p.vy - 14) * 6; input.rumble(0.6, 0.4, 200); game.cam.shake = 0.3; }
      p.pos.y = gy; p.vy = 0; p.onGround = true; p.airT = 0;
    } else { p.onGround = false; p.airT = (p.airT || 0) + dt; }
  }
  world.col.resolveCircle(p.pos, 0.35, p.pos.y);
  // carros
  for (const v of game.vehicles) {
    if (Math.abs(v.pos.x - p.pos.x) > 6 || Math.abs(v.pos.z - p.pos.z) > 6) continue;
    if (!v.contains(p.pos.x, p.pos.z, 0.35) || p.pos.y > v.pos.y + v.t.height + 0.2) continue;
    if (v.speed > 4 && !p.rag) {
      // atropelado: corpo físico batendo na lataria e no chão
      stopSmoking(p, true);
      p.rag = startRag(p.pos, p.heading, p.vel, v);
      p.health -= Math.max(0, v.speed - 3) * 2.5;
      ch.ragHead = 0; ch.ragTurn = 0;
      audio.crash(v.speed * 0.5); audio.thud(0, v.speed); input.rumble(0.8, 0.6, 250);
      game.cam.shake = Math.max(game.cam.shake, clamp(v.speed * 0.02, 0.1, 0.45));
      return;
    }
    const sh = Math.sin(v.heading), chh = Math.cos(v.heading);
    const dx = p.pos.x - v.pos.x, dz = p.pos.z - v.pos.z;
    const f = dx * sh + dz * chh, l = dx * chh - dz * sh;
    const of = v.t.length / 2 + 0.35 - Math.abs(f), ol = v.t.width / 2 + 0.35 - Math.abs(l);
    if (of < ol) { p.pos.x += sh * of * Math.sign(f); p.pos.z += chh * of * Math.sign(f); }
    else { p.pos.x += chh * ol * Math.sign(l); p.pos.z -= sh * ol * Math.sign(l); }
  }
  p.speed = Math.hypot(p.vel.x, p.vel.z);
  // soco
  if (free && inp.punch && p.onGround && !p.swim && ch.punchT <= 0.06 && combat.current === 'fist') {
    // combo jab -> direto -> gancho se apertar no ritmo
    game.combo = game.simTime - (game.lastPunch ?? -9) < 0.8 ? ((game.combo || 0) + 1) % 3 : 0;
    game.lastPunch = game.simTime;
    const type = game.combo;
    // vira na direção do pedestre mais próximo à frente
    let best = null, bd = 2.6;
    for (const q of peds.list) {
      if (q.state === 'down' || q.state === 'dead') continue;
      const d = Math.hypot(q.pos.x - p.pos.x, q.pos.z - p.pos.z);
      const dot = ((q.pos.x - p.pos.x) * Math.sin(p.heading) + (q.pos.z - p.pos.z) * Math.cos(p.heading)) / (d || 1);
      if (d < bd && dot > 0.2) { bd = d; best = q; }
    }
    if (best) p.heading = Math.atan2(best.pos.x - p.pos.x, best.pos.z - p.pos.z);
    ch.punchType = type; ch.punchDur = type === 2 ? 0.5 : 0.3; ch.punchT = ch.punchDur; ch.guard = 3;
    p.vel.x += Math.sin(p.heading) * (type === 1 ? 1.5 : 0.8); p.vel.z += Math.cos(p.heading) * (type === 1 ? 1.5 : 0.8);
    audio.burst(0.12, 1800, 0.08, 'bandpass');
    setTimeout(() => {
      const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
      let hit = false;
      for (const q of peds.list) {
        const dx = q.pos.x - p.pos.x, dz = q.pos.z - p.pos.z, d = Math.hypot(dx, dz);
        if (d < 1.6 && (dx * fx + dz * fz) / (d || 1) > 0.35) { peds.punched(q, fx, fz, type); hit = true; }
      }
      if (police.punch(p.pos.x, p.pos.z, fx, fz)) hit = true;
      if (hit) { audio.punch(); input.rumble(type === 2 ? 0.7 : 0.35, 0.5, type === 2 ? 160 : 90); game.cam.shake = Math.max(game.cam.shake, type === 2 ? 0.12 : 0.05); peds.scare(p.pos.x, p.pos.z, 15); }
    }, ch.punchDur * 400);
  }
  let mode = p.swim ? (p.under ? 'swimUnder' : p.speed > 0.4 ? 'swim' : 'tread') : p.onGround ? 'ground' : 'air';
  if (!p.swim && !p.onGround) {
    if (deep && p.pos.y > 0.8 && p.vy < 1) mode = 'dive';
    else if (p.vy < -9 || p.airT > 1.1) mode = 'fall';
  }
  if (p.down > 0) {
    p.down -= dt; mode = 'down';
    p.vel.multiplyScalar(Math.exp(-dt * 3));
  }
  updateIdle(dt, inp, mode);
  ch.root.position.copy(p.pos);
  ch.root.rotation.y = p.heading;
  if (!game.shops.open) ch.animate(dt, p.speed, mode);
  // levando choque: corpo treme
  if (p.shockT > 0) { p.shockT -= dt; ch.root.rotation.x = (Math.random() - 0.5) * 0.25; ch.root.rotation.z = (Math.random() - 0.5) * 0.25; ch.root.position.y += Math.random() * 0.05; }
  else if (p.shockT !== undefined && p.shockT > -1) { p.shockT = -1; ch.root.rotation.x = ch.root.rotation.z = 0; }
  // entrar em veículo
  let near = null, nd = 1e9;
  for (const v of game.vehicles) {
    if (v.locked || v.health <= 0) continue;
    const d = v.pos.distanceTo(p.pos) - v.t.length / 2;
    if (d < 2.2 && d < nd) { nd = d; near = v; }
  }
  if (near && free && !game.hintShown) { hud.hint(ui('enterHint', settings.get('lang'), { k: input.scheme === 'gamepad' ? 'Y' : input.scheme === 'touch' ? '🚗' : 'F' }), 1500); game.hintShown = true; }
  if (!near) game.hintShown = false;
  game.ui.nearCar = !!near && free;
  if (near && free && inp.enter) game.enterVehicle(near);
}

// ---------------------------------------------------------------- câmera
const ray = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const colTmp = [];
function camBlocked(x, y, z) {
  if (y < heightAt(x, z) + 0.3) return true;
  for (const b of world.col.query(x, z, 0.3, colTmp)) if (x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3 && y < b.y1 && y > b.y0 - 0.5) return true;
  return false;
}
function updateCamera(dt, inp) {
  const c = game.cam, v = player.vehicle;
  if (game.cine) {
    player.char.head.visible = true;
    const C = game.cine;
    C.t = Math.min(C.dur, C.t + dt);
    const k = smoothstep(0, 1, C.t / C.dur);
    camera.position.lerpVectors(C.p0, C.p1, k);
    camTarget.lerpVectors(C.l0, C.l1, k);
    camera.lookAt(camTarget);
    camera.fov = lerp(camera.fov, 55, 0.1);
    camera.updateProjectionMatrix();
    return;
  }
  // C / R3 / 👁 alterna: terceira pessoa → terceira (longe) → primeira pessoa
  if (inp.cam) {
    const order = ['third', 'far', 'first'], next = order[(order.indexOf(settings.get('view')) + 1) % 3];
    settings.set('view', next);
    hud.hint(ui('view_' + next, settings.get('lang')), 1200);
  }
  const fp = settings.get('view') === 'first' && !game.shops.open;
  player.char.head.visible = !fp;
  if (!game.locked) {
    c.yaw -= inp.lookX;
    c.pitch = clamp(c.pitch + inp.lookY, fp ? -1.2 : -0.45, fp ? 1.3 : 1.25);
  }
  const sinceLook = (performance.now() - input.lastLook) / 1000;
  if (fp) { firstPerson(dt, c, v, sinceLook); return; }
  if (camera.near !== 0.3) { camera.near = 0.3; camera.updateProjectionMatrix(); }
  let dist;
  if (v) {
    camTarget.set(v.pos.x, v.pos.y + v.t.height * 0.85 + 0.6, v.pos.z);
    const sp = v.speed;
    if (settings.get('camAuto') && sinceLook > 1.4 && sp > 2.5) {
      const vx = v.fwdSpeed;
      const want = vx >= -1 ? Math.atan2(v.vel.x, v.vel.z) : v.heading;
      c.yaw += angleDiff(c.yaw, want) * Math.min(1, dt * (1.2 + sp * 0.06));
      c.pitch = lerp(c.pitch, 0.16, dt * 1.2);
    }
    dist = v.t.length * 1.15 + 3.4 + clamp(sp * 0.05, 0, 2.5);
    c.shake = Math.max(c.shake, v.impact * 0.06);
  } else {
    camTarget.set(player.pos.x, player.pos.y + 1.55, player.pos.z);
    dist = player.swim ? 5 : 4.4;
  }
  if (settings.get('view') === 'far') dist *= 1.6;
  c.dist = lerp(c.dist, dist, 1 - Math.exp(-dt * 4));
  const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
  ray.set(-Math.sin(c.yaw) * cp, sp, -Math.cos(c.yaw) * cp);
  let d = c.dist;
  for (let s = 0.6; s <= c.dist; s += 0.35) {
    if (camBlocked(camTarget.x + ray.x * s, camTarget.y + ray.y * s, camTarget.z + ray.z * s)) { d = Math.max(0.6, s - 0.35); break; }
  }
  const want = camTarget.clone().addScaledVector(ray, d);
  if (!v && player.swim && player.under) want.y = Math.min(want.y, -0.6);
  if (!c.init) { c.pos.copy(want); c.init = true; }
  c.pos.lerp(want, 1 - Math.exp(-dt * (v ? 14 : 22)));
  if (d < c.dist - 0.3) c.pos.copy(want);
  camera.position.copy(c.pos);
  c.shake *= Math.exp(-dt * 6);
  if (c.shake > 0.005) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * c.shake, (Math.random() - 0.5) * c.shake, (Math.random() - 0.5) * c.shake));
  camera.lookAt(camTarget);
  const fov = 62 + (v ? clamp(v.speed - 12, 0, 40) * 0.32 : 0);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = lerp(camera.fov, fov, 1 - Math.exp(-dt * 3)); camera.updateProjectionMatrix(); }
}

// primeira pessoa: câmera nos olhos do personagem (a cabeça some para não atrapalhar)
const eye = new THREE.Vector3(), look = new THREE.Vector3();
function firstPerson(dt, c, v, sinceLook) {
  if (camera.near !== 0.08) { camera.near = 0.08; camera.updateProjectionMatrix(); }
  const ch = player.char;
  if (v && v.parts && v.parts.eye) { v.body.updateMatrixWorld(true); eye.copy(v.parts.eye); v.body.localToWorld(eye); }
  else { ch.root.updateMatrixWorld(true); ch.head.getWorldPosition(eye); eye.y += 0.12; }
  if (v) {
    // no carro o olhar volta para a frente sozinho quando você solta a câmera
    if (sinceLook > 1.0) {
      c.yaw += angleDiff(c.yaw, v.heading) * Math.min(1, dt * 3);
      c.pitch = lerp(c.pitch, 0.06, dt * 3);
    }
  }
  const cp = Math.cos(c.pitch);
  look.set(Math.sin(c.yaw) * cp, -Math.sin(c.pitch), Math.cos(c.yaw) * cp);
  eye.addScaledVector(look, v ? 0.05 : 0.14);
  if (!v && player.swim && !player.under) eye.y = Math.max(eye.y, 0.12);
  c.pos.copy(eye); c.init = true; c.dist = 0.5;
  camera.position.copy(eye);
  c.shake *= Math.exp(-dt * 6);
  if (v) c.shake = Math.max(c.shake, v.impact * 0.04);
  if (c.shake > 0.005) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * c.shake, (Math.random() - 0.5) * c.shake, (Math.random() - 0.5) * c.shake));
  camera.lookAt(camTarget.copy(camera.position).add(look));
  const fov = 72 + (v ? clamp(v.speed - 12, 0, 40) * 0.2 : 0);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = lerp(camera.fov, fov, 1 - Math.exp(-dt * 3)); camera.updateProjectionMatrix(); }
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let zoneT = 0, lastZone = '';
let frames = 0;

function setPaused(on) {
  game.paused = on;
  const el = document.getElementById('pause');
  el.classList.toggle('hidden', !on);
  if (on) { document.exitPointerLock?.(); renderPause(); audio.ctx?.suspend(); speechSynthesis?.pause?.(); }
  else { audio.ctx?.resume(); speechSynthesis?.resume?.(); }
  input.wantLock = !on;
}
let renderPause = () => {};

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  frames++;
  if (!game.playing) {
    if (env) { env.update(dt, camera.position, camera.position); world.update(dt, camera.position, env); }
    camera.position.set(900 + Math.sin(performance.now() * 0.00005) * 500, 160, 900 + Math.cos(performance.now() * 0.00005) * 300);
    camera.lookAt(650, 30, 500);
    render();
    return;
  }
  const inp = input.poll(dt);
  if (inp.pause && !game.mapOpen && !(shops && shops.open)) setPaused(!game.paused);
  if (inp.map && !game.paused && !game.locked) { game.mapOpen = !game.mapOpen; hud.showFullMap(game, game.mapOpen); if (game.mapOpen) document.exitPointerLock?.(); }
  if (game.mapOpen && inp.pause) { game.mapOpen = false; hud.showFullMap(game, false); }
  if (game.paused || game.mapOpen) { render(); return; }
  input.wantLock = true;
  game.simTime += dt;
  if (game.cine && inp.skip) voice.skip();

  if (shops.update(dt, inp)) { inp.moveX = inp.moveY = inp.mag = 0; inp.jump = inp.punch = inp.enter = false; inp.lookX = inp.lookY = 0; }
  const p = player, v = p.vehicle;
  if (v) {
    const free = !game.locked;
    const ctrl = free ? {
      throttle: v.health > 0 ? inp.throttle : 0, brake: inp.brake, steer: inp.steer, handbrake: inp.handbrake, analog: inp.analog,
      shiftUp: inp.shiftUp, shiftDown: inp.shiftDown,
    } : { throttle: 0, brake: 0.5, steer: 0, handbrake: true };
    v.ctrl = ctrl;
    if (free && inp.lights && !v.t.pedal) {
      v.headOn = !v.headOn; v.lightTouched = true;
      hud.hint(settings.get('lang') === 'pt' ? (v.headOn ? 'Farol ligado' : 'Farol desligado') : v.headOn ? 'Headlights on' : 'Headlights off', 1500);
      audio.tone(900, 900, 0.05, 0.08, 'square');
    }
    v.lights = !!v.headOn;
    if (free && inp.enter) { if (v.speed > 6 && !v.t.boat) game.bailOut(); else game.exitVehicle(); }
    if (free && inp.radio && !v.t.twoWheel) {
      const st = audio.cycleRadio();
      hud.radio(st ? `${st.name} — ${st.genre}` : ui('radioOff', settings.get('lang')));
      if (st && st.name.includes('93.9')) voice.say('dj', LINES.dj[0], { ambient: true });
      if (st && st.name.includes('Batida')) voice.say('dj', LINES.dj[1], { ambient: true });
    }
    audio.setHorn(free && inp.horn && !v.t.pedal);
    if (free && inp.horn) peds.scare(v.pos.x, v.pos.z, 14);
    p.pos.copy(v.pos);
    p.char.animate(dt, v.speed, v.t.shape === 'bike' ? 'bike' : v.t.twoWheel ? 'moto' : 'drive');
  } else updateOnFoot(dt, inp);
  combat.update(dt, inp);
  game.focus.copy(p.vehicle ? p.vehicle.pos : p.pos);

  // veículos
  const awake = [];
  for (const car of game.vehicles) {
    const d = Math.abs(car.pos.x - game.focus.x) + Math.abs(car.pos.z - game.focus.z);
    if (d > 500 && car !== p.vehicle) continue;
    let ctrl = null;
    if (car === p.vehicle) ctrl = car.ctrl;
    else if (car.ai) ctrl = car.ai.controls(dt, game);
    else if (car.driver === 'ai') ctrl = { throttle: 0, brake: 0.6, steer: 0, handbrake: true };
    else if (car.coastT > 0) { car.coastT -= dt; ctrl = { throttle: 0, brake: 0, steer: 0, handbrake: false }; }
    if (car.ai && !car.lights) car.lights = env.lightsOn;
    car.update(dt, ctrl, env, car === p.vehicle && settings.get('gearbox') === 'manual');
    if (d < 220) skids.track(car, dt, (x, y, z) => fx.tireSmoke(x, y, z));
    if (d < 140 && env.wetness > 0.3) wetTires(car, dt, car === p.vehicle);
    if (!car.sleeping || car === p.vehicle) car.collideWorld(world.col);
    awake.push(car);
    // raspando na parede: faíscas e chiado de metal
    car.scrape = Math.max(car.scrapeNow || 0, (car.scrape || 0) * Math.exp(-dt * 10));
    if (car.scrapeNow > 2.5 && d < 120 && car._scr && Math.random() < dt * 40) fx.sparks(car._scr[0], car.pos.y + 0.45, car._scr[1], 3);
    // moto/bicicleta batendo forte: o piloto voa por cima do guidão
    if (car === p.vehicle && car.t.twoWheel && !car.t.boat && car.hitV > 7) {
      const pv = car.preVel.clone();
      game.bailOut();
      p.vel.set(pv.x * 0.75, 0, pv.z * 0.75);
      p.vy = 3.5 + car.hitV * 0.15;
      p.tumble.dmg = Math.min(70, car.hitV * 3.2);
      p.heading = Math.atan2(pv.x, pv.z);
      car.coastT = 0;
    }
    // estrago progressivo: peças caem, fumaça, fogo e explosão
    if (!car.exploded && d < 260) {
      const hx = car.pos.x + Math.sin(car.heading) * car.t.length * 0.35, hz = car.pos.z + Math.cos(car.heading) * car.t.length * 0.35, hy = car.pos.y + car.t.height * 0.7;
      if (car.health < 450 && Math.random() < dt * (car.health < 250 ? 14 : 6)) fx.smoke(hx, hy, hz, car.health < 250, env.wind);
      if (car.health < 150) {
        if (!car.burnT) { car.burnT = 6; car.dead = true; }
        if (Math.random() < dt * 25) fx.fire(hx, hy, hz);
        car.burnT -= dt;
        if (car.burnT <= 0 && !car.t.pedal) game.explode(car);
        else if (car.burnT <= 0) car.exploded = true;
      }
    } else if (car.exploded && Math.random() < dt * 3 && d < 200) fx.smoke(car.pos.x, car.pos.y + 1, car.pos.z, true, env.wind);
  }
  skids.flush();
  collideVehicles(awake, (A, B, vn) => {
    if ((A === p.vehicle && B.police) || (B === p.vehicle && A.police)) game.addWanted(vn > 4 ? 1 : 0.4);
    if (A === p.vehicle || B === p.vehicle) { audio.crash(vn); input.rumble(clamp(vn / 12, 0.2, 1), 0.5, 220); game.cam.shake = Math.max(game.cam.shake, vn * 0.05); if (vn > 6) game.addWanted(0.15); }
  });
  if (v) {
    if (v.impact > 1.5) { audio.crash(v.impact); input.rumble(clamp(v.impact / 12, 0.2, 1), 0.6, 220); }
    v.impact = 0;
  }
  for (const car of game.vehicles) car.impact = 0;

  traffic.update(dt);
  police.update(dt);
  air.update(dt);
  animals.update(dt);
  props.update(dt);
  world.updateTrafficLights(game.simTime);
  redLightCheck(dt);
  gangZoneHint();
  fx.light = 0.1 + 0.9 * (env.day ?? 1);
  BEAM.uBeam.value = (0.12 + 0.88 * env.night) * (0.05 + env.p.rain * 0.35 + clamp((env.p.fog - 0.0005) * 60, 0, 0.3));
  fx.update(dt, camera.position);
  peds.update(dt);
  for (const a of game.actors) { a.ch.root.position.copy(a.pos); a.ch.root.rotation.y = a.heading; a.ch.animate(dt, 0, 'ground'); }
  // marcadores e blips que seguem objetos
  for (const m of game.markers) { m.children[1].position.y = 0.2 + Math.sin(game.simTime * 3) * 0.15; m.children[0].material.opacity = 0.25 + Math.sin(game.simTime * 4) * 0.08; }
  for (const b of game.blips) if (b.follow) { b.x = b.follow.pos.x; b.z = b.follow.pos.z; }

  // procurado: some com o tempo
  game.crimeT += dt;
  game.wantedFlash = Math.max(0, game.wantedFlash - dt);
  if (game.crimeT > 25) game.wanted = Math.max(0, game.wanted - dt * 0.04);

  // vida
  if (p.health <= 0 && !game.dead) {
    game.dead = true;
    hud.big(ui('wasted', settings.get('lang')), '', 3500, 'fail');
    setTimeout(() => {
      const of = world.oficina;
      game.placePlayer(of.x - 4, of.z + 6, Math.PI);
      p.health = 100; p.down = 0; game.money = Math.max(0, game.money - 100); game.wanted = 0; game.dead = false; police.clear();
    }, 3500);
  }
  if (p.health < 100 && game.crimeT > 8) p.health = Math.min(100, p.health + dt * 1.5);

  // missões
  for (const w of [...game.waiters]) {
    const f = w.failFn && w.failFn();
    if (f) { game.waiters.splice(game.waiters.indexOf(w), 1); game.failReason = f; w.rej('fail'); continue; }
    if (w.fn()) { game.waiters.splice(game.waiters.indexOf(w), 1); w.res(); }
  }

  updateCamera(dt, inp);
  game.camForward.set(Math.sin(game.cam.yaw), 0, Math.cos(game.cam.yaw));
  if (game.cine) { camera.getWorldDirection(game.camForward); }
  env.update(dt, camera.position, game.focus);
  // câmera debaixo d'água
  const underCam = camera.position.y < -0.15 && heightAt(camera.position.x, camera.position.z) < -0.6;
  if (underCam) { scene.fog.color.setRGB(0.02, 0.12, 0.16).multiplyScalar(1 - env.night * 0.8); scene.fog.density = 0.045; }
  document.body.classList.toggle('underwater', underCam);
  world.update(dt, camera.position, env);
  if (frames % 2 === 0) world.updateGrass(camera.position.x, camera.position.z, game.camForward.x, game.camForward.z);

  // luzes de poste mais próximas (só à noite / com chuva)
  lampTimer -= dt;
  const lit = world.lampMat.emissiveIntensity / 6;
  if (lampTimer <= 0) {
    lampTimer = 0.4;
    const cx = camera.position.x, cz = camera.position.z;
    const best = [];
    if (lit > 0.05) for (const l of world.lamps) {
      if (l.off) continue;
      const d = (l.lx - cx) ** 2 + (l.lz - cz) ** 2;
      if (d > 120 * 120) continue;
      best.push([d, l]);
    }
    best.sort((a, b) => a[0] - b[0]);
    lampLights.forEach((L, i) => { const b = best[i]; if (b) L.position.set(b[1].lx, b[1].ly - 0.3, b[1].lz); L.userData.on = !!b; });
    lampNear = best.slice(0, 6).map((b) => b[1]);
  }
  updateWetLights(lit);
  for (const L of lampLights) L.intensity = L.userData.on ? lit * 55 : 0;
  const lc = v || (game.lastCar && game.lastCar.lights && game.lastCar.pos.distanceTo(camera.position) < 150 ? game.lastCar : null);
  if (lc && lc.lights) {
    const v = lc;
    const sh = Math.sin(v.heading), ch = Math.cos(v.heading);
    headlight.position.set(v.pos.x + sh * v.t.length * 0.5, v.pos.y + v.t.wheelR + 0.5, v.pos.z + ch * v.t.length * 0.5);
    headlight.target.position.set(v.pos.x + sh * 30, v.pos.y - 1, v.pos.z + ch * 30);
    headlight.intensity = 180;
  } else headlight.intensity = 0;

  // oficina conserta o carro (só amassados e peças; carcaça explodida não tem conserto)
  if (v && !v.exploded && v.health < 1000 && v.speed < 1.5 && world.oficina) {
    const of = world.oficina;
    if (Math.hypot(v.pos.x - of.carX, v.pos.z - of.carZ) < 8) {
      v.health = 1000; v.dead = false; v.burnT = 0; v.repairVisual?.();
      game.money = Math.max(0, game.money - 50);
      audio.jingle(); hud.hint(settings.get('lang') === 'pt' ? 'Oficina Vargas: carro consertado (-$50).' : 'Vargas Garage: car repaired (-$50).', 3000);
    }
  }
  // período do dia
  const per = periodAt(env.time);
  if (per !== game.period) { if (game.period && !game.locked) hud.hint(ui('period', settings.get('lang'), { n: per[settings.get('lang')] }), 3500); game.period = per; }
  // zona
  zoneT -= dt;
  if (zoneT <= 0) {
    zoneT = 0.5;
    const z = zoneName(game.focus.x, game.focus.z);
    if (z !== lastZone) { lastZone = z; if (!game.locked) hud.zone(z); }
  }

  // som
  const pv = p.vehicle;
  audio.update({
    wind: env.windSpeed, speed: pv ? pv.speed : p.speed, rain: env.p.rain, indoor: !!pv && !pv.t.twoWheel, wet: pv && (pv.surface === 'road' || pv.surface === 'walk') ? env.wetness : 0,
    slip: pv && pv.onGround && !pv.t.pedal ? clamp(pv.slip * 1.4, 0, 1) : 0,
    scrape: pv ? clamp((pv.scrape || 0) / 12, 0, 1) : 0,
    engine: !!pv && !pv.t.pedal && pv.health > 0, rpmN: pv && !pv.t.pedal ? (pv.rpm - pv.t.idle) / (pv.t.redline - pv.t.idle) : 0, throttle: pv ? pv.thr || 0 : 0,
  });
  hud.update(dt, game);
  render();
}

function render() {
  if (settings.get('bloom')) composer.render(); else renderer.render(scene, camera);
}

// ---------------------------------------------------------------- marina, veículos comprados, sinal vermelho, gangues
const MARINA = [{ x: 1100, z: 516, h: Math.PI / 2 }, { x: 1080, z: 486, h: Math.PI / 2 }, { x: 1130, z: 486, h: Math.PI / 2 }, { x: 1150, z: 520, h: Math.PI / 2 }];
function waterSpot(x, z) {
  // anda pro mar até ter fundo suficiente
  for (let k = 0; k < 60 && heightAt(x, z) > -1.6; k++) x += 4;
  return { x, z };
}
function spawnMarina() {
  [['boat', 0xb3201c], ['jetski', 0x2a8fbd], ['jetski', 0xf0b429]].forEach(([t, c], i) => {
    const s = waterSpot(MARINA[i].x, MARINA[i].z);
    const v = new Vehicle(t, c, s.x, s.z, MARINA[i].h);
    v.pos.y = 0;
    game.addVehicle(v);
  });
  game.addBlip({ id: 'marina', x: 1080, z: 500, color: '#4cc3ff', shape: 'sq', label: 'M', keep: true });
}
// vaga na beira da rua em frente a um lugar (a placa fica na calçada, 8,5 m do meio da rua)
const curb = (p) => p.x - Math.sign(Math.sin(p.face)) * 3.5;
game.deliverVehicle = (type, color) => {
  const t = VTYPES[type];
  let x, z, h;
  if (t.boat) { const s = waterSpot(MARINA[3].x, MARINA[3].z + (Math.random() - 0.5) * 10); x = s.x; z = s.z; h = Math.PI / 2; }
  else { const d = PLACES.find((p) => p.id === 'dealer'); x = curb(d); z = d.z - 10 + Math.random() * 6; h = 0; }
  const v = new Vehicle(type, color, x, z, h);
  if (t.boat) v.pos.y = 0;
  v.owned = true;
  game.addVehicle(v);
  return v;
};
function spawnOwned(atHouse) {
  const hs = PLACES.find((p) => p.id === 'house');
  if (atHouse) game.placePlayer(hs.x + 1.5, hs.z + 2, Math.PI);
  shops.data.cars.forEach((c, i) => {
    const t = VTYPES[c.type];
    if (t.boat) { game.deliverVehicle(c.type, c.color); return; }
    const base = atHouse ? hs : PLACES.find((p) => p.id === 'dealer');
    const x = curb(base), z = base.z - 12 + i * 7;
    const v = new Vehicle(c.type, c.color, x, z, 0);
    v.owned = true;
    game.addVehicle(v);
  });
}
// furar o vermelho com a polícia olhando dá estrela
let redState = null;
function redLightCheck() {
  const v = player.vehicle;
  if (!v || v.t.boat) { redState = null; return; }
  const X = crossingAhead(v.pos.x, v.pos.z, Math.atan2(v.vel.x, v.vel.z), 4);
  const inside = X && X.dist < ROAD_W / 2 && X.dist > -ROAD_W / 2;
  if (inside && !redState && v.speed > 4) {
    redState = X;
    if (lightAt(X.c, X.i, X.j, X.axis, game.simTime) === 'r') {
      const cop = police.cars.some((c) => c.pos.distanceTo(v.pos) < 55) || police.cops.some((c) => !c.dead && c.pos.distanceTo(v.pos) < 40);
      if (cop && game.wanted < 1) { game.addWanted(1); hud.hint(ui('redLight', settings.get('lang')), 3000); }
    }
  } else if (!inside) redState = null;
}
let lastGang = null;
function gangZoneHint() {
  const G = gangAt(game.focus.x, game.focus.z);
  if (G && G !== lastGang) hud.hint(ui('gangZone', settings.get('lang'), { n: G.name }), 3000);
  lastGang = G;
}

// ---------------------------------------------------------------- boot
async function boot() {
  const bar = document.getElementById('loadbar'), txt = document.getElementById('loadtxt');
  const steps = ['Moldando o terreno...', 'Asfaltando as ruas...', 'Levantando prédios...', 'Plantando árvores...', 'Enchendo o mar...'];
  await world.build((m) => { txt.textContent = m; bar.style.width = `${((steps.indexOf(m) + 1) / (steps.length + 1)) * 100}%`; });
  env = game.env = new Environment(scene, renderer, world, settings);
  env.onThunder = () => { audio.thunder(); input.rumble(0.4, 0.2, 400); };
  hud = game.hud = new HUD(world, settings);
  voice = game.voice = new Voice(settings, hud);
  traffic = game.traffic = new Traffic(game);
  peds = game.peds = new Peds(game);
  missions = game.missions = new Missions(game);
  police = game.police = new Police(game);
  air = game.air = new Air(game);
  shops = game.shops = new Shops(game);
  combat = game.combat = new Combat(game);
  animals = game.animals = new Animals(game);
  props = game.props = new Props(game);
  Vehicle.props = props;
  game.vtypes = VTYPES; game.gangs = GANGS;
  Vehicle.world = world;
  game.setPlayerLook(shops.data.look, shops.data.muscle);
  player.stamina = shops.sprintMax; player.breath = shops.breathMax;
  Vehicle.fx = fx;
  Vehicle.onDamage = (v, strength, cx, cz) => {
    if (strength > 2.5 && v.pos.distanceTo(camera.position) < 150) fx.impact(v, strength, cx, cz);
  };
  // carros estacionados pelas cidades
  const types = ['sedan', 'sedan', 'pickup', 'sport', 'moto', 'taxi', 'sedan', 'pickup'];
  world.parkSpots.forEach((s, i) => {
    const t = types[i % types.length];
    const v = new Vehicle(t, t === 'taxi' ? 0xf2c014 : [0xb3201c, 0x1d3f8a, 0xe8e8e8, 0x151515, 0x2f6b3a, 0xc9a227, 0x6d6f73][i % 7], s.x, s.z, s.h);
    game.addVehicle(v);
  });
  spawnMarina();
  bar.style.width = '100%';
  txt.textContent = settings.get('lang') === 'pt' ? 'Pronto!' : 'Ready!';
  document.getElementById('menu').classList.remove('hidden');
  const btnCont = document.getElementById('btnCont');
  btnCont.classList.toggle('hidden', missions.stage < 1);
  const lang = settings.get('lang');
  document.getElementById('btnNew').textContent = ui('newGame', lang);
  btnCont.textContent = ui('cont', lang);
  document.getElementById('btnSet').textContent = ui('settings', lang);
  const start = (fresh) => {
    audio.init();
    document.getElementById('title').classList.add('hidden');
    game.playing = true;
    input.wantLock = true;
    if (!input.touchActive()) renderer.domElement.requestPointerLock?.();
    hud.setVisible(true);
    missions.start(fresh).catch((e) => console.error(e));
    if (fresh) { shops.data.cars = []; shops.data.house = false; }
    spawnOwned(!fresh && shops.data.house && missions.stage >= 2);
  };
  document.getElementById('btnNew').onclick = () => start(true);
  btnCont.onclick = () => start(false);
  document.getElementById('btnSet').onclick = () => {
    const box = document.getElementById('titleSettings');
    box.classList.toggle('hidden');
    buildSettingsUI(box, settings, () => box.classList.add('hidden'));
  };
  const pauseBox = document.getElementById('pauseSettings');
  renderPause = () => buildSettingsUI(pauseBox, settings, () => setPaused(false));
  document.getElementById('btnResume').onclick = () => setPaused(false);
  settings.on((k, val) => {
    if (k === 'period' && val !== 'free') { const P = { morning: 8, noon: 12.5, afternoon: 16.5, night: 20.5, dawn: 2.5 }[val]; if (P != null) env.time = P; }
    if (k === 'volume' || k === 'musicVol') audio.applyVolume();
    if (k === 'quality') { if (confirm(settings.get('lang') === 'pt' ? 'Recarregar o jogo para aplicar a qualidade?' : 'Reload the game to apply quality?')) location.reload(); }
    if (k === 'lang') document.getElementById('btnResume').textContent = ui('resume', settings.get('lang'));
  });
  document.getElementById('btnResume').textContent = ui('resume', lang);
  window.__fta = game; game.Driver = Driver;
}

boot();
tick();
