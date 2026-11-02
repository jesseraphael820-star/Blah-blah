// Porto Sol — main game loop and systems glue.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { World } from './world.js';
import { Car, TrafficAI, ChaseAI, CAR_TYPES } from './vehicle.js';
import { NPC, LOOKS } from './npc.js';
import { Human } from './human.js';
import { Player } from './player.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { Voice } from './voice.js';
import { Audio } from './audio.js';
import { FX } from './fx.js';
import { clamp, damp, dampAngle, angleDiff, lerp, pick } from './util.js';

const QUALITY = {
  high: { pr: Math.min(devicePixelRatio, 2), bloom: true, peds: 34, traffic: 26, samples: 4 },
  medium: { pr: Math.min(devicePixelRatio, 1.25), bloom: true, peds: 24, traffic: 18, samples: 2 },
  low: { pr: 1, bloom: false, peds: 14, traffic: 12, samples: 0 },
};
const SAVE_KEY = 'portosol_save_v1';

class Input {
  constructor(el) {
    this.keys = new Set(); this.pressedSet = new Set();
    this.mouse = { dx: 0, dy: 0, left: false, right: false, leftPressed: false, moved: 0 };
    addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressedSet.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    el.addEventListener('mousedown', (e) => { if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; } if (e.button === 2) this.mouse.right = true; });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.left = false; if (e.button === 2) this.mouse.right = false; });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; this.mouse.moved = performance.now(); }
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  down(c) { return this.keys.has(c); }
  pressed(c) { return this.pressedSet.has(c); }
  endFrame() { this.pressedSet.clear(); this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.leftPressed = false; }
}

class Pickup {
  constructor(game, type, pos, value = 0, respawn = 0) {
    this.g = game; this.type = type; this.value = value; this.respawn = respawn; this.home = pos.clone();
    const color = type === 'health' ? 0xff3030 : type === 'armor' ? 0x3a7aff : 0x34c759;
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.4 });
    this.mesh = new THREE.Group();
    if (type === 'health') { this.mesh.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.16), mat), new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), mat)); }
    else if (type === 'armor') this.mesh.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.3), mat));
    else this.mesh.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.22), mat));
    this.mesh.position.copy(pos).add(new THREE.Vector3(0, 0.8, 0));
    game.scene.add(this.mesh);
    this.active = true; this.t = 0;
  }
  update(dt) {
    const g = this.g, P = g.player;
    if (!this.active) { this.t -= dt; if (this.t <= 0 && this.respawn) { this.active = true; this.mesh.visible = true; } return; }
    this.mesh.rotation.y += dt * 2.5; this.mesh.position.y = this.home.y + 0.8 + Math.sin(performance.now() / 300) * 0.1;
    if (!P.vehicle && P.alive && P.pos.distanceTo(this.home) < 1.3) {
      if (this.type === 'health') { if (P.health >= 100) return; P.health = 100; g.hud.help('Saúde restaurada', 1.5); }
      else if (this.type === 'armor') { P.armor = 100; g.hud.help('Colete à prova de balas', 1.5); }
      else { g.addMoney(this.value); }
      g.audio.pickup();
      this.active = false; this.mesh.visible = false; this.t = this.respawn;
      if (!this.respawn) this.dead = true;
    }
  }
  dispose() { this.g.scene.remove(this.mesh); }
}

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uNight: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uNight; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.07, 1.0, 0.88), 0.55 * (1.0 - uNight));
      c.rgb = mix(c.rgb, c.rgb * vec3(0.85, 0.95, 1.15), 0.4 * uNight);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114)); c.rgb = mix(vec3(l), c.rgb, 1.12);
      vec2 d = vUv - 0.5; float v = smoothstep(0.85, 0.3, length(d * vec2(1.1, 1.0)));
      c.rgb *= mix(0.62, 1.0, v);
      gl_FragColor = c; }`,
};

export class Game {
  constructor(quality = 'high') {
    this.q = QUALITY[quality] || QUALITY.high; this.qualityName = quality;
    const canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.q.bloom, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.q.pr);
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 6000);
    this.world = new World(this.scene, this.renderer, quality);
    this.setupComposer();
    this.input = new Input(canvas);
    this.audio = new Audio();
    this.voice = new Voice();
    this.fx = new FX(this.scene);
    this.cars = []; this.npcs = []; this.pickups = [];
    this.wanted = 0; this.heat = 0; this.wantedUnseen = 0; this.bustProgress = 0;
    this.policeSpawnT = 0; this.popT = 0; this.shake = 0;
    this.cam = { yaw: Math.PI, pitch: 0.25, dist: 4.6, pos: new THREE.Vector3() };
    this.camPos = this.camera.position;
    this.radioStation = true;
    this.state = 'play';
    this.cutsceneActive = false;
    this.player = new Player(this);
    this.load();
    this.hud = new HUD(this);
    this.spawnStory();
    const L = this.world.loc;
    this.player.pos.set(L.bento.x + 3, 0.15, L.bento.z + 9);
    this.player.heading = Math.PI;
    this.missions = new Missions(this, this.saveData.mission || 0);
    this.initPopulation();
    this.pickups.push(new Pickup(this, 'health', L.hospital.clone(), 0, 45));
    this.pickups.push(new Pickup(this, 'armor', L.police.clone().add(new THREE.Vector3(6, 0, 0)), 0, 90));
    this.pickups.push(new Pickup(this, 'health', L.safehouse.clone().add(new THREE.Vector3(-8, 0, 0)), 0, 60));
    // player car headlight
    this.headlight = new THREE.SpotLight(0xfff0d0, 0, 60, 0.55, 0.5, 1.2);
    this.headlight.castShadow = false;
    this.headTarget = new THREE.Object3D();
    this.scene.add(this.headlight, this.headTarget); this.headlight.target = this.headTarget;
    this.clock = new THREE.Clock();
    addEventListener('resize', () => this.resize());
    this.hud.help('Vá até o marcador amarelo (<b>B</b> no mapa) para falar com o <b>Tio Bento</b>.', 7);
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  setupComposer() {
    const size = new THREE.Vector2(innerWidth, innerHeight);
    const rt = new THREE.WebGLRenderTarget(innerWidth * this.q.pr, innerHeight * this.q.pr, { type: THREE.HalfFloatType, samples: this.q.samples });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setPixelRatio(this.q.pr);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (this.q.bloom) { this.bloom = new UnrealBloomPass(size.clone().multiplyScalar(0.5), 0.32, 0.5, 0.88); this.composer.addPass(this.bloom); }
    this.grade = new ShaderPass(GradeShader); this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }
  resize() {
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight); this.composer.setSize(innerWidth, innerHeight);
  }

  // ------------------------------------------------------------ save
  load() {
    try { this.saveData = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { this.saveData = {}; }
    const s = this.saveData;
    this.player.money = s.money || 0; this.player.hasPistol = !!s.pistol; this.player.ammo = s.ammo || 0;
  }
  save() {
    const P = this.player;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ mission: this.missions.index, money: P.money, pistol: P.hasPistol, ammo: P.ammo })); } catch { /* storage unavailable */ }
  }

  // ------------------------------------------------------------ spawning
  spawnStory() {
    const L = this.world.loc;
    const bento = new NPC(this, 'story', { skin: 0x5a3820, shirt: 0xc9a24a, pants: 0x3b3326, hair: 0x9a9a9a, bulk: 1.25, scale: 1.0 }, L.bento);
    bento.heading = 0; bento.name = 'Tio Bento'; bento.voice = { pitch: 0.75, rate: 0.95, gender: 'm' }; bento.home = L.bento.clone();
    const duda = new NPC(this, 'story', { skin: 0xc68a5a, shirt: 0x2a4a7a, pants: 0x2a3550, hair: 0x5a2a10, bulk: 0.88, scale: 0.94, hat: 'cap', hatColor: 0xff7a2a }, L.duda);
    duda.heading = 0; duda.name = 'Duda'; duda.voice = { pitch: 1.35, rate: 1.1, gender: 'f' }; duda.home = L.duda.clone();
    this.story = { bento, duda };
    this.npcs.push(bento, duda);
  }
  spawnNPC(kind, look, pos) { const n = new NPC(this, kind, look, pos); this.npcs.push(n); return n; }
  addCar(type, color) { const c = new Car(type, color); this.scene.add(c.group); this.cars.push(c); return c; }
  removeCar(c) { this.scene.remove(c.group); c.removed = true; const i = this.cars.indexOf(c); if (i >= 0) this.cars.splice(i, 1); }
  seatDriver(car, look) {
    const h = new Human(look); h.update(1, { sit: true }); h.update(1, { sit: true });
    h.root.position.copy(car.seat); car.group.add(h.root); car.driver = h; return h;
  }
  spawnTraffic(near, minD, maxD) {
    const lp = this.world.randomLanePoint(near, minD, maxD);
    if (!lp) return null;
    for (const c of this.cars) if (Math.hypot(c.pos.x - lp.x, c.pos.z - lp.z) < 10) return null;
    const type = pick(['sedan', 'sedan', 'sedan', 'taxi', 'van', 'pickup', 'sport', 'sedan', 'pickup']);
    const car = this.addCar(type);
    car.place(lp.x, lp.z, Math.atan2(lp.dir[0], lp.dir[1]));
    car.vel.set(lp.dir[0] * 8, 0, lp.dir[1] * 8);
    car.ai = new TrafficAI(car, lp.dir); car.driverKind = 'npc';
    this.seatDriver(car, {});
    return car;
  }
  spawnParkedCar(type, x, z, h, color) {
    const car = this.addCar(type, color); car.place(x, z, h); car.input.handbrake = true; car.persist = true; return car;
  }
  initPopulation() {
    const p = this.player.pos;
    for (let i = 0; i < this.q.peds; i++) { const s = this.world.randomSidewalkPoint(p, 8, 130); if (s) this.spawnNPC('ped', {}, new THREE.Vector3(s.x, 0, s.z)); }
    for (let i = 0; i < this.q.traffic; i++) this.spawnTraffic(p, 25, 200);
    // parking spots (lots + curbs)
    this.parkSpots = this.world.parkSpots.map((s) => ({ ...s }));
    const r = Math.random;
    for (let k = 0; k <= 8; k++) for (let seg = 0; seg < 8; seg++) {
      if (r() < 0.55) continue;
      const along = -320 + seg * 80 + 8 + 12 + r() * 40, line = -320 + k * 80, side = r() < 0.5 ? -1 : 1;
      if (r() < 0.5) this.parkSpots.push({ x: along, z: line + side * 6.7, h: side > 0 ? Math.PI / 2 : -Math.PI / 2 });
      else this.parkSpots.push({ x: line + side * 6.7, z: along, h: side > 0 ? Math.PI : 0 });
    }
    this.managePopulation(true);
  }
  managePopulation() {
    const P = this.player, p = P.vehicle ? P.vehicle.pos : P.pos;
    // peds
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const n = this.npcs[i];
      if (n.kind === 'story' || n.persist) continue;
      const d = Math.hypot(n.pos.x - p.x, n.pos.z - p.z);
      const chasing = n.kind === 'cop' && n.state === 'chase';
      if ((d > 150 && !chasing) || d > 260 || (n.state === 'dead' && n.deadT > 30 && d > 40)) { n.remove(); this.npcs.splice(i, 1); }
    }
    const peds = this.npcs.filter((n) => n.kind === 'ped').length;
    for (let k = peds; k < this.q.peds; k++) { const s = this.world.randomSidewalkPoint(p, 60, 130); if (s) this.spawnNPC('ped', {}, new THREE.Vector3(s.x, 0, s.z)); }
    // traffic
    for (const c of [...this.cars]) {
      if (c === P.vehicle || c.persist) continue;
      const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
      if (d > 240 || (c.dead && d > 80 && c.burnT > 30)) this.removeCar(c);
    }
    const traffic = this.cars.filter((c) => c.ai instanceof TrafficAI).length;
    for (let k = traffic; k < this.q.traffic; k++) this.spawnTraffic(p, 110, 210);
    // parked cars
    for (const s of this.parkSpots) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (!s.car && d < 170 && d > 50 && !s.used) {
        s.car = this.addCar(pick(['sedan', 'sedan', 'pickup', 'van', 'sport', 'taxi']));
        s.car.place(s.x, s.z, s.h); s.car.input.handbrake = true; s.car.parkSpot = s;
      } else if (s.car && d > 200) {
        if (s.car.driverKind === 'none' && !s.car.removed && s.car.pos.distanceTo(new THREE.Vector3(s.x, 0, s.z)) < 2) this.removeCar(s.car);
        s.car = null;
      }
    }
  }

  // ------------------------------------------------------------ crimes & police
  levelFromHeat(h) { return h >= 22 ? 5 : h >= 14 ? 4 : h >= 8 ? 3 : h >= 4 ? 2 : h >= 1 ? 1 : 0; }
  heatFor(l) { return [0, 1, 4, 8, 14, 22][l]; }
  crime(amount) {
    this.heat += amount;
    const lvl = this.levelFromHeat(this.heat);
    if (lvl > this.wanted) { this.wanted = lvl; }
    if (this.wanted > 0) this.wantedUnseen = 0;
  }
  setWanted(n) { this.wanted = n; this.heat = this.heatFor(n) + 0.5; this.wantedUnseen = 0; }
  copNear(pos, r = 45) {
    for (const n of this.npcs) if (n.kind === 'cop' && n.alive && n.pos.distanceTo(pos) < r) return true;
    for (const c of this.cars) if (c.typeKey === 'police' && c.driverKind === 'police' && c.pos.distanceTo(pos) < r) return true;
    return false;
  }
  onAssault(n) { if (n.kind === 'cop') this.crime(2); else if (n.kind === 'ped') this.crime(this.copNear(n.pos) ? 1.5 : 0.35); }
  onKill(n) {
    if (n.kind === 'cop') this.crime(4); else if (n.kind === 'thug') this.crime(0.25); else this.crime(this.copNear(n.pos) ? 2 : 1.2);
    if (n.kind !== 'cop' && Math.random() < 0.7) this.pickups.push(new Pickup(this, 'money', n.pos.clone(), 10 + Math.floor(Math.random() * 60), 0));
    for (const o of this.npcs) if (o !== n && o.pos.distanceTo(n.pos) < 25) o.scare(this.player, 10);
  }
  onCarjack(car, police = false) { this.crime(police ? 3 : this.copNear(car.pos, 50) ? 1.5 : 0.5); }
  onGunfire(pos) {
    for (const n of this.npcs) if (n.pos.distanceTo(pos) < 35) n.scare(this.player, 9);
    this.crime(this.copNear(pos, 60) ? 0.6 : 0.08);
  }
  onCarExplode(car) {
    const p = car.pos.clone();
    this.fx.explosion(p); this.audio.explosion(p, this); this.shake = 1.2;
    for (const n of this.npcs) { const d = n.pos.distanceTo(p); if (d < 7) { n.knock.subVectors(n.pos, p).setY(0).normalize().multiplyScalar(8); n.hurt(200, this.player, 'car'); } else if (d < 30) n.scare(this.player, 10); }
    const P = this.player, pp = P.vehicle ? P.vehicle.pos : P.pos, d = pp.distanceTo(p);
    if (d < 8) P.damage((8 - d) * 14 + (P.vehicle === car ? 100 : 0));
    for (const c of this.cars) if (c !== car && !c.dead) { const dd = c.pos.distanceTo(p); if (dd < 8) { c.damage(35 * (1 - dd / 8), this); c.vel.add(c.pos.clone().sub(p).setY(0).normalize().multiplyScalar(6)); } }
    if (d < 60) this.crime(1.5);
  }
  npcMelee(npc, dmg) {
    const P = this.player;
    if (P.vehicle || !P.alive) return;
    if (npc.pos.distanceTo(P.pos) < 1.7) { P.damage(dmg, npc); this.audio.punch(); P.vel.addScaledVector(new THREE.Vector3(P.pos.x - npc.pos.x, 0, P.pos.z - npc.pos.z).normalize(), 3); }
  }
  npcShoot(npc, chance, dmg, car = null) {
    const P = this.player;
    const from = npc.pos.clone().add(new THREE.Vector3(Math.sin(npc.heading) * 0.5, 1.4, Math.cos(npc.heading) * 0.5));
    const tgt = (car ? car.pos : P.pos).clone().add(new THREE.Vector3(0, 1.1, 0));
    if (this.world.lineBlocked(from, tgt)) return;
    const miss = Math.random() > chance;
    const end = tgt.clone().add(miss ? new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 1.5, (Math.random() - 0.5) * 3) : new THREE.Vector3());
    this.fx.muzzle(from); this.tracer(from, end); this.audio.gun(from, this);
    if (!miss) { if (car) car.damage(3.5, this); else P.damage(dmg, npc); }
  }
  tracer(a, b) { this.fx.tracer(a, b); }

  updatePolice(dt) {
    const P = this.player, pp = P.vehicle ? P.vehicle.pos : P.pos;
    const policeCars = this.cars.filter((c) => c.typeKey === 'police' && c.driverKind === 'police');
    const desired = this.wanted === 0 ? 0 : Math.min(4, this.wanted);
    this.policeSpawnT -= dt;
    if (this.wanted > 0) for (const c of policeCars) if (c.chaseAI && c.ai !== c.chaseAI) { c.ai = c.chaseAI; c.siren = true; }
    const chasing = policeCars.filter((c) => c.ai instanceof ChaseAI).length;
    const copsOnFoot = this.npcs.filter((n) => n.kind === 'cop' && n.alive).length;
    if (chasing < desired && this.policeSpawnT <= 0 && copsOnFoot < desired * 2 + 1) {
      this.policeSpawnT = 5;
      const lp = this.world.randomLanePoint(pp, 90, 150);
      if (lp) {
        const car = this.addCar('police'); car.place(lp.x, lp.z, Math.atan2(lp.dir[0], lp.dir[1]));
        car.driverKind = 'police'; car.siren = true; car.crew = this.wanted >= 3 ? 2 : 1; car.chaser = true;
        car.ai = car.chaseAI = new ChaseAI(car, () => (P.vehicle ? { x: P.vehicle.pos.x, z: P.vehicle.pos.z, vx: P.vehicle.vel.x, vz: P.vehicle.vel.z } : { x: P.pos.x, z: P.pos.z, onFoot: true }));
        this.seatDriver(car, LOOKS.cop());
      }
    }
    for (const car of policeCars) {
      const d = Math.hypot(car.pos.x - pp.x, car.pos.z - pp.z);
      if (this.wanted === 0 && car.ai instanceof ChaseAI) {
        car.siren = false;
        const h = car.heading, dir = Math.abs(Math.sin(h)) > Math.abs(Math.cos(h)) ? [Math.sign(Math.sin(h)), 0] : [0, Math.sign(Math.cos(h))];
        car.ai = new TrafficAI(car, dir);
      }
      if (this.wanted > 0 && car.crew > 0 && !P.vehicle && d < 15 && Math.abs(car.speed) < 3) {
        // cops get out
        if (car.driver) { car.group.remove(car.driver.root); car.driver = null; }
        for (let k = 0; k < car.crew; k++) {
          const door = car.doorPos();
          if (k === 1) door.add(new THREE.Vector3(-Math.cos(car.heading) * (car.w + 1.4), 0, Math.sin(car.heading) * (car.w + 1.4)));
          const cop = this.spawnNPC('cop', LOOKS.cop(), door); cop.state = 'chase';
        }
        car.crew = 0; car.ai = null; car.driverKind = 'none'; car.input.throttle = 0; car.input.handbrake = true;
      }
      if (this.wanted === 0 && d > 110) this.removeCar(car);
    }
    // line of sight / evasion
    if (this.wanted > 0) {
      const eye = pp.clone().add(new THREE.Vector3(0, 1.5, 0));
      let seen = false;
      const check = (pos) => {
        const d = pos.distanceTo(pp);
        if (d < 12) return true;
        if (d > 65) return false;
        return !this.world.lineBlocked(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), eye, 2);
      };
      for (const c of this.cars) if (c.typeKey === 'police' && (c.driverKind === 'police') && check(c.pos)) { seen = true; break; }
      if (!seen) for (const n of this.npcs) if (n.kind === 'cop' && n.alive && check(n.pos)) { seen = true; break; }
      this.wantedUnseen = seen ? 0 : this.wantedUnseen + dt;
      if (this.wantedUnseen > 9 + this.wanted * 2.5) {
        this.wanted--; this.heat = this.wanted ? this.heatFor(this.wanted) + 0.5 : 0; this.wantedUnseen = 0;
        if (this.wanted === 0) this.hud.help('Você despistou a polícia!', 3);
      }
    } else { this.heat = Math.max(0, this.heat - dt * 0.05); }
    // busted
    this.bustProgress = Math.max(0, this.bustProgress - dt * 0.6);
    if (this.bustProgress > 2.2 && this.state === 'play') this.onBusted();
  }

  // ------------------------------------------------------------ queries
  obstacleAhead(car, range) {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    let best = Infinity;
    const test = (x, z, half) => {
      const dx = x - car.pos.x, dz = z - car.pos.z;
      const along = dx * fx + dz * fz; if (along <= 0 || along > range + half) return;
      const lat = Math.abs(dx * fz - dz * fx); if (lat > 2.3) return;
      best = Math.min(best, along - half - car.len / 2);
    };
    for (const c of this.cars) if (c !== car && !c.removed) test(c.pos.x, c.pos.z, c.len / 2);
    const P = this.player; if (!P.vehicle) test(P.pos.x, P.pos.z, 0.4);
    for (const n of this.npcs) if (n.alive && n.speed !== undefined) test(n.pos.x, n.pos.z, 0.4);
    return best;
  }
  raycast(origin, dir, maxD, ignore) {
    let best = { t: maxD, point: origin.clone().addScaledVector(dir, maxD) };
    // world march
    for (let t = 0.5; t < maxD; t += 0.5) {
      const x = origin.x + dir.x * t, y = origin.y + dir.y * t, z = origin.z + dir.z * t;
      if (y < this.world.groundHeight(x, z) || this.world.pointInBuilding(x, y, z)) { best = { t, point: new THREE.Vector3(x, y, z), hitWorld: true }; break; }
    }
    const sphere = (c, r) => {
      const oc = origin.clone().sub(c); const b = oc.dot(dir); const cc = oc.lengthSq() - r * r; const h = b * b - cc;
      if (h < 0) return -1; const t = -b - Math.sqrt(h); return t > 0 ? t : -1;
    };
    for (const n of this.npcs) {
      if (!n.alive || n === ignore || n.kind === 'story') continue;
      if (n.pos.distanceTo(origin) > maxD + 2) continue;
      const head = sphere(n.pos.clone().add(new THREE.Vector3(0, 1.66, 0)), 0.17);
      if (head > 0 && head < best.t) { best = { t: head, point: origin.clone().addScaledVector(dir, head), npc: n, head: true }; continue; }
      for (const y of [1.25, 0.8, 0.4]) {
        const t = sphere(n.pos.clone().add(new THREE.Vector3(0, y, 0)), 0.33);
        if (t > 0 && t < best.t) { best = { t, point: origin.clone().addScaledVector(dir, t), npc: n }; break; }
      }
    }
    for (const c of this.cars) {
      if (c === this.player.vehicle || c.pos.distanceTo(origin) > maxD + 4) continue;
      for (const [cx, cz, r] of c.circles()) {
        const t = sphere(new THREE.Vector3(cx, 0.8, cz), r * 0.95);
        if (t > 0 && t < best.t) { best = { t, point: origin.clone().addScaledVector(dir, t), car: c }; }
      }
    }
    return best;
  }

  // ------------------------------------------------------------ death / busted
  onPlayerDead() {
    if (this.state !== 'play') return;
    this.state = 'wasted';
    this.hud.big('VOCÊ MORREU', 'Hospital de Porto Sol: -$100', '#d01818', 4);
    this.missions.onPlayerDown('Você morreu.');
    setTimeout(() => this.respawn('hospital'), 3800);
  }
  onBusted() {
    this.state = 'busted';
    this.hud.big('PRESO!', 'Você perdeu suas armas e 10% do dinheiro', '#3a7aff', 4);
    this.missions.onPlayerDown('Você foi preso.');
    setTimeout(() => this.respawn('police'), 3800);
  }
  respawn(where) {
    const P = this.player;
    this.hud.fade(true);
    setTimeout(() => {
      if (P.vehicle) P.exitVehicle(true);
      const L = this.world.loc;
      const p = where === 'hospital' ? L.hospital : L.police;
      P.pos.set(p.x, 0.15, p.z); P.vel.set(0, 0, 0); P.heading = 0;
      if (where === 'hospital') P.money = Math.max(0, P.money - 100);
      else { P.money = Math.floor(P.money * 0.9); P.hasPistol = false; P.ammo = 0; }
      P.weapon = 'fist'; P.human.showGun(false); P.health = 100; P.armor = 0;
      this.wanted = 0; this.heat = 0; this.bustProgress = 0;
      for (const c of [...this.cars]) if (c.typeKey === 'police' && c.chaser) this.removeCar(c);
      for (let i = this.npcs.length - 1; i >= 0; i--) { const n = this.npcs[i]; if (n.kind === 'cop' || n.kind === 'thug') { n.remove(); this.npcs.splice(i, 1); } }
      this.world.hour = (this.world.hour + 6) % 24;
      this.cam.yaw = Math.PI;
      this.save();
      this.state = 'play';
      setTimeout(() => this.hud.fade(false), 300);
    }, 700);
  }
  addMoney(n) { this.player.money += n; this.save(); }

  // ------------------------------------------------------------ cutscenes
  async playCutscene(lines) {
    const P = this.player;
    this.cutsceneActive = true;
    this.hud.letterbox(true);
    this.hud.setObjective('');
    P.vel.set(0, 0, 0);
    if (P.vehicle) P.exitVehicle(true);
    const resolve = (who) => (who === 'player' ? P : this.story[who]);
    const other = resolve(lines.find((l) => l.who !== 'player')?.who) || this.story.bento;
    for (const line of lines) {
      if (!this.cutsceneActive) break;
      const spk = resolve(line.who), lst = spk === P ? other : P;
      // face each other
      const dx = lst.pos.x - spk.pos.x, dz = lst.pos.z - spk.pos.z;
      spk.heading = Math.atan2(dx, dz); lst.heading = Math.atan2(-dx, -dz);
      if (spk !== P) spk.lookAt = P.pos; else other.lookAt = P.pos;
      const head = new THREE.Vector3(); spk.human.head.getWorldPosition(head);
      const dir = new THREE.Vector3(dx, 0, dz).normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const sgn = Math.random() < 0.5 ? 1 : -1;
      this.cine = {
        pos: head.clone().addScaledVector(dir, 1.35).addScaledVector(side, 0.55 * sgn).add(new THREE.Vector3(0, 0.08, 0)),
        look: head.clone().add(new THREE.Vector3(0, -0.04, 0)),
      };
      this.cineSnap = true;
      this.hud.subtitle(spk.name, line.text);
      this.skipLine = false;
      await this.voice.say(line.text, spk.human, spk.voice);
      await new Promise((r) => setTimeout(r, 250));
    }
    this.story.bento.lookAt = null; this.story.duda.lookAt = null;
    this.hud.subtitle(null);
    this.hud.letterbox(false);
    this.cine = null;
    this.cutsceneActive = false;
    this.cam.yaw = P.heading;
  }

  // ------------------------------------------------------------ simulation
  updateCars(dt) {
    const P = this.player, pp = P.vehicle ? P.vehicle.pos : P.pos;
    for (const c of this.cars) {
      const d = Math.abs(c.pos.x - pp.x) + Math.abs(c.pos.z - pp.z);
      if (c.ai && !c.dead) c.ai.update(dt, this);
      else if (c.driverKind === 'none' || c.dead) { c.input.throttle = 0; c.input.steer = 0; c.input.handbrake = true; }
      if (d < 320) { c.physics(dt, this.world, this); c.pos.y = damp(c.pos.y, this.world.groundHeight(c.pos.x, c.pos.z) * 0.6, 10, dt); }
      c.sync(dt);
      // fire & smoke
      if (!c.dead && c.health < 30) {
        if (Math.random() < dt * 8) this.fx.smoke(c.pos.clone().add(new THREE.Vector3(Math.sin(c.heading) * c.len * 0.38, 1.0, Math.cos(c.heading) * c.len * 0.38)), c.health < 15);
        if (c.health < 15) { if (Math.random() < dt * 20) this.fx.fire(c.pos.clone().add(new THREE.Vector3(Math.sin(c.heading) * c.len * 0.35, 0.9, Math.cos(c.heading) * c.len * 0.35))); c.damage(dt * 2.2, this); }
      }
      if (c.dead) { c.burnT += dt; if (c.burnT < 12 && Math.random() < dt * 14) this.fx.fire(c.pos.clone().add(new THREE.Vector3(0, 0.8, 0))); if (c.burnT < 25 && Math.random() < dt * 6) this.fx.smoke(c.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), true); }
    }
    // car vs car
    const cs = this.cars;
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j];
      if (Math.abs(a.pos.x - b.pos.x) > 7 || Math.abs(a.pos.z - b.pos.z) > 7) continue;
      for (const ca of a.circles()) for (const cb of b.circles()) {
        const dx = cb[0] - ca[0], dz = cb[1] - ca[1], dd = Math.hypot(dx, dz), m = ca[2] + cb[2];
        if (dd >= m || dd < 1e-4) continue;
        const nx = dx / dd, nz = dz / dd, pen = (m - dd) / 2;
        a.pos.x -= nx * pen; a.pos.z -= nz * pen; b.pos.x += nx * pen; b.pos.z += nz * pen;
        const rv = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
        if (rv < 0) {
          const imp = -rv * 0.65;
          a.vel.x -= nx * imp; a.vel.z -= nz * imp; b.vel.x += nx * imp; b.vel.z += nz * imp;
          if (-rv > 4) {
            a.damage((-rv - 4) * 1.6, this); b.damage((-rv - 4) * 1.6, this);
            this.audio.crash(Math.min(1, -rv / 20), a.pos, this);
            if (-rv > 8) this.fx.sparks(new THREE.Vector3((ca[0] + cb[0]) / 2, 0.7, (ca[1] + cb[1]) / 2), 12);
            if (P.vehicle === a || P.vehicle === b) {
              this.shake = Math.min(1, -rv / 25);
              const other = P.vehicle === a ? b : a;
              if (other.typeKey === 'police' && other.driverKind === 'police') this.crime(1);
            }
          }
        }
      }
    }
    // cars vs peds / player
    for (const c of cs) {
      const sp = c.vel.length();
      if (sp < 2.5) continue;
      const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
      const hit = (pos) => {
        const dx = pos.x - c.pos.x, dz = pos.z - c.pos.z;
        const along = dx * fx + dz * fz, lat = dx * fz - dz * fx;
        return Math.abs(along) < c.len / 2 + 0.35 && Math.abs(lat) < c.w / 2 + 0.35;
      };
      for (const n of this.npcs) {
        if (!n.alive || n.downT > 0 || n.kind === 'story') continue;
        if (Math.abs(n.pos.x - c.pos.x) > 4 || Math.abs(n.pos.z - c.pos.z) > 4) continue;
        if (hit(n.pos)) {
          n.knock.copy(c.vel).multiplyScalar(0.8); n.knock.y = 0;
          n.hurt(sp * 4.5, c === P.vehicle ? P : null, 'car');
          if (n.alive) n.downT = 2;
          c.vel.multiplyScalar(0.92);
          this.audio.punch();
        }
      }
      if (!P.vehicle && P.alive && c !== P.vehicle && hit(P.pos) && sp > 4) {
        P.damage(sp * 1.5); P.vel.copy(c.vel).multiplyScalar(0.7); P.vy = 3; P.grounded = false;
      }
    }
  }

  separateCrowd() {
    const all = this.npcs.filter((n) => n.alive);
    const P = this.player;
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (!P.vehicle) {
        const dx = a.pos.x - P.pos.x, dz = a.pos.z - P.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.7 && d > 1e-4) { const k = (0.7 - d) / 2; a.pos.x += (dx / d) * k; a.pos.z += (dz / d) * k; P.pos.x -= (dx / d) * k; P.pos.z -= (dz / d) * k; }
      }
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j], dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        if (Math.abs(dx) > 1 || Math.abs(dz) > 1) continue;
        const d = Math.hypot(dx, dz);
        if (d < 0.65 && d > 1e-4) { const k = (0.65 - d) / 2; a.pos.x -= (dx / d) * k; a.pos.z -= (dz / d) * k; b.pos.x += (dx / d) * k; b.pos.z += (dz / d) * k; }
      }
      // npcs vs cars
      for (const c of this.cars) {
        if (Math.abs(c.pos.x - a.pos.x) > 5 || Math.abs(c.pos.z - a.pos.z) > 5) continue;
        for (const [cx, cz, cr] of c.circles()) {
          const dx = a.pos.x - cx, dz = a.pos.z - cz, d = Math.hypot(dx, dz), m = cr + 0.35;
          if (d < m && d > 1e-4) { a.pos.x += (dx / d) * (m - d); a.pos.z += (dz / d) * (m - d); }
        }
      }
    }
  }

  updateCamera(dt) {
    const P = this.player, cam = this.cam, inp = this.input;
    if (this.cine) {
      if (this.cineSnap) { this.cineSnap = false; this.camera.position.copy(this.cine.pos); this.cineLook = this.cine.look.clone(); this.camera.fov = 42; }
      this.cine.pos.y += dt * 0.01; // slow push for a living shot
      this.camera.position.lerp(this.cine.pos, 1 - Math.exp(-dt * 5));
      if (!this.cineLook) this.cineLook = this.cine.look.clone();
      this.cineLook.lerp(this.cine.look, 1 - Math.exp(-dt * 6));
      this.camera.lookAt(this.cineLook);
      this.camera.fov = damp(this.camera.fov, 42, 4, dt); this.camera.updateProjectionMatrix();
      return;
    }
    this.cineLook = null;
    const sens = 0.0024;
    cam.yaw -= inp.mouse.dx * sens; cam.pitch = clamp(cam.pitch + inp.mouse.dy * sens * 0.9, -0.35, 1.2);
    const car = P.vehicle;
    let target, dist, shoulder = 0, fov = 65;
    if (car) {
      target = car.pos.clone().add(new THREE.Vector3(0, 1.7, 0));
      const sp = car.speed;
      dist = 7.2 + Math.min(4, Math.abs(sp) * 0.07) + (car.typeKey === 'van' || car.typeKey === 'pickup' ? 1 : 0);
      if (performance.now() - inp.mouse.moved > 1300 && Math.abs(sp) > 2) {
        cam.yaw = dampAngle(cam.yaw, car.heading + (sp < -2 ? 0 : 0), 3, dt);
        cam.pitch = damp(cam.pitch, 0.2, 2, dt);
      }
      fov = 65 + Math.min(14, Math.abs(sp) * 0.3);
    } else {
      target = P.pos.clone().add(new THREE.Vector3(0, P.alive ? 1.55 : 0.5, 0));
      dist = P.aiming ? 2.4 : 4.4; shoulder = P.aiming ? 0.65 : 0.25;
      if (P.aiming) fov = 55;
    }
    cam.dist = damp(cam.dist, dist, 6, dt);
    const f = new THREE.Vector3(Math.sin(cam.yaw), 0, Math.cos(cam.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    target.addScaledVector(r, shoulder);
    const want = target.clone().addScaledVector(f, -cam.dist * Math.cos(cam.pitch)).add(new THREE.Vector3(0, cam.dist * Math.sin(cam.pitch), 0));
    // collision
    const dir = want.clone().sub(target); const len = dir.length(); dir.normalize();
    let ok = len;
    for (let t = 0.3; t <= len; t += 0.3) {
      const p = target.clone().addScaledVector(dir, t);
      if (this.world.pointInBuilding(p.x, p.y, p.z)) { ok = Math.max(0.4, t - 0.4); break; }
    }
    const pos = target.clone().addScaledVector(dir, ok);
    pos.y = Math.max(pos.y, this.world.groundHeight(pos.x, pos.z) + 0.35);
    if (car) this.camera.position.lerp(pos, 1 - Math.exp(-dt * 14)); else this.camera.position.copy(pos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2);
      this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * this.shake * 0.4, (Math.random() - 0.5) * this.shake * 0.4, 0));
    }
    // look slightly above target, forward
    const look = target.clone().addScaledVector(f, 2 + (car ? 2 : 0));
    look.y += car ? -0.3 : -0.1 + (P.aiming ? 0.1 : 0);
    this.camera.lookAt(look);
    this.camera.fov = damp(this.camera.fov, fov, 6, dt); this.camera.updateProjectionMatrix();
  }

  updateHeadlight() {
    const car = this.player.vehicle, n = this.world.night;
    if (car && n > 0.1) {
      if (this.headlight.parent !== car.group) { car.group.add(this.headlight); car.group.add(this.headTarget); this.headlight.target = this.headTarget; }
      this.headlight.position.set(0, 0.8, car.len / 2); this.headTarget.position.set(0, 0, car.len / 2 + 20);
      this.headlight.intensity = 140 * n;
    } else if (this.headlight.parent !== this.scene) { this.scene.add(this.headlight, this.headTarget); this.headlight.intensity = 0; }
    else this.headlight.intensity = 0;
  }

  loop() {
    requestAnimationFrame(this.loop);
    let dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.paused) { this.input.endFrame(); return; }
    if (this.state !== 'play') dt *= 0.35; // slow motion while wasted/busted
    const P = this.player, inp = this.input;
    if (this.cutsceneActive) {
      if (inp.pressed('Space') || inp.pressed('Enter')) this.voice.stop();
      P.human.update(dt, { speed: 0, grounded: true, sit: !!P.vehicle });
      P.human.root.position.copy(P.pos); P.human.root.rotation.y = P.heading;
    } else if (this.state === 'play') P.update(dt, inp, this.cam);
    else P.update(dt, { down: () => false, pressed: () => false, mouse: {} }, this.cam);
    this.updateCars(dt);
    for (const n of this.npcs) {
      const pp = P.vehicle ? P.vehicle.pos : P.pos;
      if (n.kind === 'story' || Math.abs(n.pos.x - pp.x) + Math.abs(n.pos.z - pp.z) < 220) n.update(dt);
    }
    this.separateCrowd();
    if (this.state === 'play') this.updatePolice(dt);
    this.popT -= dt; if (this.popT <= 0) { this.popT = 0.5; this.managePopulation(); }
    for (let i = this.pickups.length - 1; i >= 0; i--) { const p = this.pickups[i]; p.update(dt); if (p.dead) { p.dispose(); this.pickups.splice(i, 1); } }
    if (!this.cutsceneActive) this.missions.update(dt); else { this.missions.marker && this.missions.marker.update(dt); }
    // F hint
    if (!P.vehicle && !this.cutsceneActive && this.state === 'play' && !P.entering) {
      const c = P.nearestCar(3); if (c && !this.hud.helpTimer) this.hud.help(`Aperte <b>F</b> para ${c.driver ? 'roubar' : 'entrar no'} ${c.type.name}`, 0.4);
    }
    this.voice.update(dt);
    this.fx.update(dt);
    this.updateCamera(dt);
    this.updateHeadlight();
    const focus = P.vehicle ? P.vehicle.pos : P.pos;
    this.world.update(dt, focus);
    if (this.grade) this.grade.uniforms.uNight.value = this.world.night;
    this.hud.update(dt);
    let sirenDist = 999;
    for (const c of this.cars) if (c.siren) sirenDist = Math.min(sirenDist, c.pos.distanceTo(this.camera.position));
    this.audio.update(dt, { inCar: !!P.vehicle, speed: P.vehicle ? P.vehicle.speed : 0, throttle: P.vehicle ? Math.abs(P.vehicle.input.throttle) : 0, skid: P.vehicle ? P.vehicle.skid : 0, sirenDist, radio: this.radioStation });
    this.composer.render();
    inp.endFrame();
  }
}

// ---------------------------------------------------------------- bootstrap
const menu = document.getElementById('menu');
const pauseEl = document.getElementById('pause');
let game = null;
function lock() { const c = document.getElementById('game'); if (c.requestPointerLock) c.requestPointerLock(); }
document.getElementById('play').addEventListener('click', () => {
  const q = document.getElementById('quality').value;
  document.getElementById('loading').style.display = 'block';
  setTimeout(() => {
    if (!game) {
      game = new Game(q); window.game = game;
      game.voice.enabled = document.getElementById('voiceOn').checked;
    }
    game.audio.start();
    menu.style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    lock();
  }, 30);
});
document.getElementById('resume').addEventListener('click', () => { pauseEl.style.display = 'none'; if (game) { game.paused = false; game.clock.getDelta(); } lock(); });
document.getElementById('resetSave').addEventListener('click', () => { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } location.reload(); });
document.addEventListener('pointerlockchange', () => {
  if (!game) return;
  if (!document.pointerLockElement && !game.cutsceneActive) { game.paused = true; pauseEl.style.display = 'flex'; if (game.audio.ctx) game.audio.ctx.suspend(); if (game.voice.synth) game.voice.synth.pause(); }
  else if (document.pointerLockElement) { game.paused = false; pauseEl.style.display = 'none'; if (game.audio.ctx) game.audio.ctx.resume(); if (game.voice.synth) game.voice.synth.resume(); }
});
document.getElementById('game').addEventListener('click', () => { if (game && !document.pointerLockElement) lock(); });
