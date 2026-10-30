import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, lerp, smoothstep, angleDiff } from './util.js';
import { World, groundAt, heightAt, zoneName, cityAt } from './world.js';
import { Vehicle, collideVehicles } from './vehicle.js';
import { Character } from './character.js';
import { Traffic, Peds } from './npc.js';
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
import { Air } from './air.js';
import { Shops } from './shops.js';
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
    const ch = new Character({ ...look, muscle });
    ch.root.position.copy(old.root.position); ch.root.rotation.copy(old.root.rotation);
    if (p.vehicle) p.vehicle.setRider(ch); else { scene.remove(old.root); scene.add(ch.root); }
    p.char = ch;
  },
  explode(v) {
    v.exploded = true; v.health = -1; v.dead = true;
    v.paint.color.setHex(0x161616); v.paint.clearcoat = 0; v.paint.metalness = 0.1; v.paint.roughness = 1;
    for (const part of v.parts || []) part.visible = false;
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
    p.swim = false; p.under = false; p.vy = 0;
    if (p.vehicle) this.exitVehicle(true);
    p.pos.set(x, groundAt(x, z), z); p.vel.set(0, 0, 0); p.heading = h; this.cam.yaw = h;
  },

  enterVehicle(v) {
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
    v.traffic = false;
    p.vehicle = v;
    scene.remove(p.char.root);
    v.setRider(p.char);
    this.audio.door();
    this.hud.vehicle(v.t.name);
    if (!v.t.twoWheel && this.audio.station) this.audio.startRadio();
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
    v.lights = false;
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
let env, hud, voice, traffic, peds, missions, police, air, shops;
const fx = (game.fx = new FX(scene));

// luzes dinâmicas: postes próximos e farol do jogador
const lampLights = [];
for (let i = 0; i < 6; i++) {
  const l = new THREE.PointLight(0xffc77a, 0, 26, 1.6);
  scene.add(l);
  lampLights.push(l);
}
const headlight = new THREE.SpotLight(0xfff1d6, 0, 70, 0.55, 0.45, 1.3);
scene.add(headlight, headlight.target);
let lampTimer = 0;

// ---------------------------------------------------------------- atualização do jogador a pé
const tmpP = { x: 0, z: 0 };
function updateOnFoot(dt, inp) {
  const p = player, ch = p.char;
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
  if (sprinting) p.stamina -= dt; else p.stamina = Math.min(shops.sprintMax, p.stamina + dt * 0.7);
  let top = p.swim ? (p.under ? 2.1 : sprinting ? 3.4 : 2.3) : sprinting ? 7.4 : 4.6;
  if (!inp.analog && !inp.walk) mag = mag > 0 ? 1 : 0;
  const speed = top * mag;
  if (wl > 0.01) p.heading += clamp(angleDiff(p.heading, Math.atan2(wx, wz)), -dt * 11, dt * 11);
  const k = 1 - Math.exp(-dt * (p.onGround || p.swim ? (p.swim ? 4 : 12) : 1.5));
  p.vel.x = lerp(p.vel.x, wx * speed, k);
  p.vel.z = lerp(p.vel.z, wz * speed, k);
  const ox = p.pos.x, oz = p.pos.z;
  p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;
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
    if (v.speed > 6 && p.down <= 0) {
      p.down = 2.2; p.health -= v.speed * 2.5;
      p.vel.copy(v.vel).multiplyScalar(0.8);
      audio.crash(v.speed * 0.5); input.rumble(0.8, 0.6, 250);
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
  if (free && inp.punch && p.onGround && ch.punchT <= 0) {
    ch.punchT = 0.35;
    setTimeout(() => {
      const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
      for (const q of peds.list) {
        const dx = q.pos.x - p.pos.x, dz = q.pos.z - p.pos.z, d = Math.hypot(dx, dz);
        if (d < 1.5 && (dx * fx + dz * fz) / (d || 1) > 0.4) { peds.knock(q, fx * 2.5, fz * 2.5, false); audio.punch(); input.rumble(0.3, 0.5, 90); peds.scare(p.pos.x, p.pos.z, 15); }
      }
      if (police.punch(p.pos.x, p.pos.z, fx, fz)) { audio.punch(); input.rumble(0.3, 0.5, 90); }
    }, 150);
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
  ch.root.position.copy(p.pos);
  ch.root.rotation.y = p.heading;
  if (!game.shops.open) ch.animate(dt, p.speed, mode);
  // entrar em veículo
  let near = null, nd = 1e9;
  for (const v of game.vehicles) {
    if (v.locked || v.health <= 0) continue;
    const d = v.pos.distanceTo(p.pos) - v.t.length / 2;
    if (d < 2.2 && d < nd) { nd = d; near = v; }
  }
  if (near && free && !game.hintShown) { hud.hint(ui('enterHint', settings.get('lang'), { k: input.scheme === 'gamepad' ? 'Y' : input.scheme === 'touch' ? '🚗' : 'F' }), 1500); game.hintShown = true; }
  if (!near) game.hintShown = false;
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
  if (!game.locked) {
    c.yaw -= inp.lookX;
    c.pitch = clamp(c.pitch + inp.lookY, -0.45, 1.25);
  }
  const sinceLook = (performance.now() - input.lastLook) / 1000;
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
  if (inp.cam) c.far = !c.far;
  if (c.far) dist *= 1.6;
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
    v.lights = env.lightsOn && !v.t.pedal;
    if (free && inp.enter) game.exitVehicle();
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
    if (car.ai && !car.lights) car.lights = env.lightsOn;
    car.update(dt, ctrl, env, car === p.vehicle && settings.get('gearbox') === 'manual');
    if (!car.sleeping || car === p.vehicle) car.collideWorld(world.col);
    awake.push(car);
    // estrago progressivo: peças caem, fumaça, fogo e explosão
    if (car.health < 700 && car.parts && car.parts[0].visible) fx.detach(car, car.parts[0]);
    if (car.health < 420 && car.parts && car.parts[1].visible) fx.detach(car, car.parts[1]);
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
      const d = (l.lx - cx) ** 2 + (l.lz - cz) ** 2;
      if (d > 120 * 120) continue;
      best.push([d, l]);
    }
    best.sort((a, b) => a[0] - b[0]);
    lampLights.forEach((L, i) => { const b = best[i]; if (b) L.position.set(b[1].lx, b[1].ly - 0.3, b[1].lz); L.userData.on = !!b; });
  }
  for (const L of lampLights) L.intensity = L.userData.on ? lit * 55 : 0;
  if (v && v.lights) {
    const sh = Math.sin(v.heading), ch = Math.cos(v.heading);
    headlight.position.set(v.pos.x + sh * v.t.length * 0.5, v.pos.y + v.t.wheelR + 0.5, v.pos.z + ch * v.t.length * 0.5);
    headlight.target.position.set(v.pos.x + sh * 30, v.pos.y - 1, v.pos.z + ch * 30);
    headlight.intensity = 180;
  } else headlight.intensity = 0;

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
    wind: env.windSpeed, speed: pv ? pv.speed : p.speed, rain: env.p.rain, indoor: false,
    slip: pv && pv.onGround && !pv.t.pedal ? clamp(pv.slip * 1.4, 0, 1) : 0,
    engine: !!pv && !pv.t.pedal && pv.health > 0, rpmN: pv && !pv.t.pedal ? (pv.rpm - pv.t.idle) / (pv.t.redline - pv.t.idle) : 0, throttle: pv ? pv.thr || 0 : 0,
  });
  hud.update(dt, game);
  render();
}

function render() {
  if (settings.get('bloom')) composer.render(); else renderer.render(scene, camera);
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
  game.setPlayerLook(shops.data.look, shops.data.muscle);
  player.stamina = shops.sprintMax; player.breath = shops.breathMax;
  Vehicle.onDamage = (v, strength) => {
    if (strength > 2.5 && v.pos.distanceTo(camera.position) < 150) fx.impact(v, strength);
  };
  // carros estacionados pelas cidades
  const types = ['sedan', 'sedan', 'pickup', 'sport', 'moto', 'taxi', 'sedan', 'pickup'];
  world.parkSpots.forEach((s, i) => {
    const t = types[i % types.length];
    const v = new Vehicle(t, t === 'taxi' ? 0xf2c014 : [0xb3201c, 0x1d3f8a, 0xe8e8e8, 0x151515, 0x2f6b3a, 0xc9a227, 0x6d6f73][i % 7], s.x, s.z, s.h);
    game.addVehicle(v);
  });
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
  window.__fta = game;
}

boot();
tick();
