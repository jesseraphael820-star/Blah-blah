// Game orchestrator: boot, loading, system wiring, main loop, saving, settings.
import * as THREE from 'three';
import { G } from './core/context.js';
import { Bus } from './core/bus.js';
import { Input } from './core/input.js';
import { AudioSys } from './core/audio.js';
import { t, tr, setLang, detectLang } from './core/i18n.js';
import { loadSettings, saveSettings, loadState, newState, writeState, SPAWN } from './core/save.js';
import { isMobile, nextFrame, dist2d } from './core/utils.js';
import { Physics } from './world/physics.js';
import { World } from './world/world.js';
import { generateWorld } from './world/worldgen.js';
import { buildCave } from './world/cave.js';
import { Water } from './world/water.js';
import { Grass } from './world/grass.js';
import { Sky } from './world/sky.js';
import { Weather } from './world/weather.js';
import { forestMask } from './world/terrain.js';
import { Particles } from './render/particles.js';
import { getWorldMaterial } from './render/voxel.js';
import { Props } from './entities/props.js';
import { Player } from './entities/player.js';
import { CameraRig } from './entities/cameraRig.js';
import { NPCManager } from './entities/npc.js';
import { EnemyManager } from './entities/enemies.js';
import { Wildlife } from './entities/animals.js';
import { Horses } from './entities/horses.js';
import { Interiors } from './world/interiors.js';
import { Territory } from './systems/territory.js';
import { Training } from './systems/training.js';
import { Adventurers } from './systems/adventurers.js';
import { Fishing } from './systems/fishing.js';
import { Lineage } from './systems/lineage.js';
import { Cinematics } from './render/auras.js';
import { ArmorFinds } from './systems/armorFinds.js';
import { PLOTS } from './data/territory.js';
import { house } from './world/structures.js';
import { Pickups } from './entities/pickups.js';
import { PhysicsProps } from './entities/physicsProps.js';
import { Progression } from './systems/progression.js';
import { Inventory } from './systems/inventory.js';
import { Powers } from './systems/powers.js';
import { Quests } from './systems/quests.js';
import { Dialogue } from './systems/dialogue.js';
import { Combat } from './systems/combat.js';
import { Achievements } from './systems/achievements.js';
import { WorldEvents } from './systems/events.js';
import { Interact } from './systems/interact.js';
import { UI } from './ui/ui.js';
import { Menu } from './ui/menu.js';
import { Shop } from './ui/shop.js';
import { MapSys } from './ui/map.js';
import { Title } from './ui/title.js';
import { Touch } from './ui/touch.js';
import { LOC } from './data/world.js';
import { G_WIND } from './world/structures.js';

const QUALITY = {
  low: { shadows: false, shadowMap: 1024, pixel: 3, viewDist: 140, grass: 5000, grassR: 36 },
  medium: { shadows: true, shadowMap: 1024, pixel: 2, viewDist: 200, grass: 11000, grassR: 46 },
  high: { shadows: true, shadowMap: 2048, pixel: 2, viewDist: 260, grass: 20000, grassR: 56 },
};

export class Game {
  constructor() {
    G.game = this;
    window.G = G; // handy for debugging from the console
    this.autosaveT = 15;
    this.saveDebounce = null;
    this.loadEl = document.getElementById('loading');
    this.loadFill = document.getElementById('load-fill');
    this.loadText = document.getElementById('load-text');
    this.inCombat = false;
    this.bossMusic = false;
  }

  async boot() {
    G.mobile = isMobile();
    G.settings = loadSettings();
    const S = G.settings;
    setLang(S.lang || detectLang());
    if (!S.quality) S.quality = G.mobile ? 'low' : 'high';
    const Q = QUALITY[S.quality];
    if (!S.pixel) S.pixel = Q.pixel;
    if (!S.viewDist) S.viewDist = Q.viewDist;
    saveSettings(S);
    G.bus = new Bus();
    G.audio = new AudioSys();
    G.audio.setVolumes({ master: S.master, music: S.music, sfx: S.sfx });

    // renderer
    const r = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    document.getElementById('viewport').appendChild(r.domElement);
    G.renderer = r;
    G.scene = new THREE.Scene();
    G.scene.fog = new THREE.Fog(0xbad8f0, 60, 260);
    G.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1200);
    G.input = new Input(r.domElement);
    this.applySettings();
    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(false); });
    addEventListener('pagehide', () => { if (!this.noSave) this.save(false); });
    addEventListener('beforeunload', () => { if (!this.noSave && G.player) this.save(false); });
    this.loadEl.classList.add('hidden');
    // title screen (no world yet)
    G.ui = { overlay: 'title', blocksGameplay: () => true, blocksCamera: () => true, canLockPointer: () => false };
    G.dialogue = { active: false };
    this.title = new Title((app) => this.start(app));
    this.title.show();
    G.audio.setTheme('title');
    this.titleLoop();
  }

  titleLoop() {
    if (this.running) return;
    if (G.audio.ready) G.audio.updateMusic();
    requestAnimationFrame(() => this.titleLoop());
  }

  progress(f, text) {
    this.loadFill.style.width = Math.round(f * 100) + '%';
    this.loadText.textContent = text;
    return nextFrame();
  }

  async start(appearance) {
    this.loadEl.classList.remove('hidden');
    await this.progress(0.02, t('load.prepare'));
    const isNew = !!appearance;
    const saved = isNew ? null : loadState();
    G.state = saved || newState(appearance || undefined);
    const Q = QUALITY[G.settings.quality];
    try {
      G.physics = new Physics();
      G.world = new World(G.scene);
      G.world.viewDist = G.settings.viewDist;
      await this.progress(0.08, t('load.terrain'));
      G.world.terrain.generate();
      G.physics.terrainFn = (x, z) => G.world.terrain.heightAt(x, z);
      G.worldMat = getWorldMaterial();
      G.particles = new Particles(G.scene, G.mobile);
      // systems needed by worldgen
      G.prog = new Progression();
      G.inv = new Inventory();
      G.powers = new Powers();
      G.training = new Training();
      G.props = new Props(G.scene);
      await this.progress(0.25, t('load.village'));
      generateWorld(G.world);
      await this.progress(0.42, t('load.cave'));
      G.interiors = new Interiors();
      for (const h of G.world.houses) G.interiors.add(G.world, h);
      // rooms for the houses that will be built when the village grows
      const dry = { houses: null, lightsSpots: [], ground: (a, b) => G.world.ground(a, b), box() {}, collider() {}, cyl() {}, flag() {}, smoke() {}, glow() {}, fire() {}, dynamic() {} };
      PLOTS.forEach(([x, z, rot], i) => { const h = house(dry, x, z, rot, { w: 7, d: 6 }); G.interiors.add(G.world, h, () => G.state.village && G.state.village.residents.length > i); });
      G.cave = buildCave(G.world);
      G.world.buildGlows();
      G.world.buildExtras();
      await this.progress(0.5, t('load.water'));
      const htex = G.world.terrain.heightTexture();
      G.water = new Water(G.scene, htex);
      G.grass = new Grass(G.scene, htex, Q.grass, Q.grassR * 2);
      G.sky = new Sky(G.scene, G.renderer, G.mobile);
      G.weather = new Weather(G.scene, G.mobile);
      await this.progress(0.58, t('load.chunks'));
      const sp = G.state.player;
      const total = 20;
      let n = 0;
      // build terrain chunks around spawn progressively (loading screen)
      for (const ch of G.world.chunks.slice().sort((a, b) => dist2d(a.cx, a.cz, sp.x, sp.z) - dist2d(b.cx, b.cz, sp.x, sp.z))) {
        if (dist2d(ch.cx, ch.cz, sp.x, sp.z) > G.world.viewDist * 0.8) break;
        G.world.buildChunkMeshes(ch);
        if (++n % 4 === 0) await this.progress(0.58 + 0.25 * Math.min(1, n / total), t('load.chunks'));
      }
      await this.progress(0.86, t('load.life'));
      G.player = new Player(G.scene);
      if (!saved) { const gy = G.physics.groundAt(sp.x, sp.z, 200); G.player.teleport(sp.x, gy, sp.z, Math.PI); }
      else { const gy = G.physics.groundAt(sp.x, sp.z, sp.y + 1.2); G.player.teleport(sp.x, Math.max(sp.y, gy), sp.z, sp.yaw); }
      G.cam = new CameraRig(G.camera);
      G.cam.yaw = saved && sp.camYaw !== undefined ? sp.camYaw : G.player.yaw;
      if (saved && sp.camPitch !== undefined) G.cam.pitch = sp.camPitch;
      if (saved && sp.camDist) G.cam.dist = sp.camDist;
      else if (G.settings.camDist) G.cam.dist = G.settings.camDist;
      G.cam.snap();
      G.combat = new Combat(G.scene);
      G.entities = { npcs: null, enemies: new EnemyManager() };
      G.entities.enemies.addSpawners(G.cave.spawns);
      G.quests = new Quests();
      G.events = new WorldEvents();
      G.achievements = new Achievements();
      G.pickups = new Pickups(G.scene);
      G.pickups.scatterWorldCoins();
      G.physProps = new PhysicsProps(G.scene);
      // UI
      G.ui = new UI();
      G.dialogue = new Dialogue();
      G.entities.npcs = new NPCManager();
      G.wildlife = new Wildlife(G.scene);
      G.horses = new Horses();
      G.cinematics = new Cinematics();
      G.adventurers = new Adventurers();
      G.lineage = new Lineage();
      G.armorFinds = new ArmorFinds();
      G.fishing = new Fishing();
      G.mapSys = new MapSys(G.world.terrain.mapCanvas());
      G.menu = new Menu();
      G.shop = new Shop();
      G.interact = new Interact();
      G.ui.build();
      G.territory = new Territory();
      if (G.mobile) { G.touch = new Touch(); document.body.classList.add('touch'); }
      G.inv.spawnPet();
      G.sky.underground = G.player.pos.x > 600; G.sky.indoor = G.player.pos.x > 800;
      this.applySettings();
      await this.progress(1, t('load.done'));
    } catch (e) {
      console.error(e);
      this.fatal(e);
      return;
    }
    this.loadEl.classList.add('hidden');
    this.running = true;
    this.clock = new THREE.Clock();
    this.loop();
    if (isNew) this.creator();
    else this.begin(false);
  }

  creator() {
    G.ui.overlay = 'title';
    G.cam.mode = 'menu';
    this.title.el.classList.remove('hidden');
    this.title.app = { ...G.state.appearance, name: '' };
    this.title.onStart = (app) => {
      Object.assign(G.state.appearance, app);
      G.player.refreshLook();
      G.ui.overlay = null;
      this.begin(true);
    };
    this.title.renderCreate();
    G.ui.overlay = 'title';
  }

  begin(isNew) {
    G.ui.overlay = null;
    G.cam.mode = 'follow';
    G.ui.show();
    G.touch?.show();
    if (isNew) {
      setTimeout(() => {
        const tomas = G.entities.npcs.get('tomas');
        G.dialogue.open(tomas, tr('intro.lines'), null, () => setTimeout(() => G.dialogue.talkTo(tomas), 50));
      }, 900);
      this.save(false);
    } else {
      G.ui.toast(t('ui.welcomeBack', { name: G.state.appearance.name }), 'info');
      G.world.prebuild(G.player.pos.x, G.player.pos.z, 120);
    }
    if (G.events.canClaimDaily()) setTimeout(() => G.ui.toast(t('ui.dailyReady'), 'gold'), 4000);
    if (!G.mobile) setTimeout(() => G.ui.toast(t('ui.clickToPlay'), 'info'), 1500);
  }

  // ---------- settings ----------
  applySettings() {
    const S = G.settings;
    const r = G.renderer;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    r.setPixelRatio(dpr / (S.pixel || 2));
    r.setSize(innerWidth, innerHeight);
    r.domElement.style.imageRendering = (S.pixel || 2) > 1 ? 'pixelated' : 'auto';
    r.shadowMap.enabled = !!S.shadows && QUALITY[S.quality].shadows !== false;
    if (G.sky) {
      G.sky.sun.castShadow = r.shadowMap.enabled;
      const sz = QUALITY[S.quality].shadowMap;
      if (G.sky.sun.shadow.mapSize.x !== sz) { G.sky.sun.shadow.mapSize.set(sz, sz); G.sky.sun.shadow.map?.dispose(); G.sky.sun.shadow.map = null; }
    }
    if (G.world) G.world.viewDist = S.viewDist;
    G.camera.far = Math.max(400, (S.viewDist || 200) + 100);
    G.camera.fov = S.fov || 60;
    const root = document.documentElement.style;
    root.setProperty('--hud-scale', S.hudScale ?? 1);
    root.setProperty('--hud-op', S.hudOpacity ?? 1);
    root.setProperty('--touch-scale', S.touchScale ?? 1);
    root.setProperty('--touch-op', S.touchOpacity ?? 0.85);
    const bc = document.body.classList;
    bc.toggle('no-minimap', S.minimap === false);
    bc.toggle('no-tracker', S.tracker === false);
    bc.toggle('no-dmg', S.dmgNumbers === false);
    bc.toggle('no-names', S.nameTags === false);
    G.camera.updateProjectionMatrix();
    G.audio?.setVolumes({ master: S.master, music: S.music, sfx: S.sfx });
    this.resize();
  }
  resize() {
    const r = G.renderer;
    r.setSize(innerWidth, innerHeight);
    G.camera.aspect = innerWidth / innerHeight;
    G.camera.updateProjectionMatrix();
    const h = r.domElement.height;
    const scale = h / (2 * Math.tan((G.camera.fov * Math.PI) / 360));
    G.particles?.setScale(scale);
    if (G.world?.glowMat) G.world.glowMat.uniforms.uScale.value = scale;
  }

  // ---------- saving ----------
  save(notify) {
    if (!G.player || !G.state || this.noSave) return;
    G.player.saveToState();
    // never store a mid-air or dead position: use the last solid ground the hero stood on
    const sp = G.state.player;
    if (G.player.dead) { sp.x = sp.respawn.x; sp.z = sp.respawn.z; sp.y = G.physics.groundAt(sp.x, sp.z, 300); sp.hp = Math.max(1, sp.hp); }
    else if (!G.player.onGround && !G.player.swimming && G.player.lastSafe) { sp.x = G.player.lastSafe.x; sp.y = G.player.lastSafe.y; sp.z = G.player.lastSafe.z; }
    sp.camYaw = G.cam.yaw; sp.camPitch = G.cam.pitch; sp.camDist = G.cam.dist;
    G.state.savedAt = Date.now();
    G.mapSys?.serialize();
    const ok = writeState(G.state);
    if (notify) G.ui.toast(ok ? t('ui.saved') : t('ui.saveFailed'), ok ? 'info' : 'warn');
  }
  autosave() {
    clearTimeout(this.saveDebounce);
    this.saveDebounce = setTimeout(() => this.save(false), 1500);
  }

  // ---------- travel ----------
  travelPortal(target) {
    G.ui.fade(() => {
      if (target === 'cave') {
        const e = G.cave.entry;
        G.player.teleport(e.x, 0, e.z + 3.5, 0);
        G.sky.underground = true;
        G.audio.sfx('discover');
      } else {
        const x = LOC.caveEntrance.x, z = LOC.caveEntrance.z + 3;
        G.player.teleport(x, G.physics.groundAt(x, z, 200), z, 0);
        G.sky.underground = false;
      }
      this.onTeleport();
    });
  }
  onTeleport() {
    G.cam.yaw = G.player.yaw;
    G.cam.snap();
    G.entities.enemies.clearAggro();
    G.world.prebuild(G.player.pos.x, G.player.pos.z, 120);
    if (G.pet) G.pet.a.pos.copy(G.player.pos);
  }
  combatMusic(on) { this.bossMusic = on; }

  // ---------- audio context ----------
  ambient(dt) {
    const P = G.player.pos;
    const under = G.sky.underground;
    let water = G.water.waterProximity(P);
    if (!under) {
      for (const [ox, oz] of [[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]]) {
        const x = P.x + ox, z = P.z + oz;
        if (G.physics.waterLevel(x, z) - G.physics.terrainHeight(x, z) > 0.3) water = Math.max(water, 0.35);
      }
    }
    const fm = under ? 0 : forestMask(P.x, P.z);
    G.audio.updateAmbient(dt, {
      wind: under ? 0.2 : G.weather.wind * (0.6 + Math.min(1, P.y / 30) * 0.6), rain: G.weather.rain || 0, water, fire: G.world.fireNear || 0,
      day: 1 - G.sky.night, forest: fm, underground: under,
    });
    // pick music
    this.musicT = (this.musicT || 0) - dt;
    if (this.musicT <= 0) {
      this.musicT = 1;
      const near = G.entities.enemies.list.some((e) => e.aggro && !e.dead && dist2d(e.pos.x, e.pos.z, P.x, P.z) < 30);
      let theme = 'field';
      if (this.bossMusic) theme = 'boss';
      else if (near) theme = 'combat';
      else if (G.sky.indoor) theme = 'village';
      else if (under) theme = 'cave';
      else if (dist2d(P.x, P.z, LOC.ruins.x, LOC.ruins.z) < 50) theme = 'ruins';
      else if (dist2d(P.x, P.z, LOC.village.x, LOC.village.z) < 60 && !G.sky.isNight()) theme = 'village';
      else if (G.sky.isNight()) theme = 'night';
      else if (fm > 0.5) theme = 'forest';
      G.audio.setTheme(theme);
    }
  }

  // ---------- main loop ----------
  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    G.time += dt;
    G.dt = dt;
    try { this.update(dt); } catch (e) { console.error(e); if (!this.errShown) { this.errShown = true; G.ui.toast('Error: ' + e.message, 'warn'); } }
    G.renderer.render(G.scene, G.camera);
    G.input.endFrame();
  }

  update(dt) {
    const I = G.input;
    G.state.playTime += dt;
    // global hotkeys
    if (!G.ui.overlay && !G.dialogue.active && !G.ui.shopOpen) {
      if (G.menu.isOpen) G.menu.update();
      else {
        if (I.consume('pause')) G.menu.open('settings');
        else for (const k of ['inventory', 'journal', 'map', 'character', 'powers', 'swords']) if (I.consume(k)) { G.audio.sfx('open'); G.menu.open(k); break; }
      }
    }
    if (I.consume('fullscreen')) G.ui.toggleFullscreen?.();
    G.shop.update();
    G.dialogue.update(dt);
    if (G.ui.overlay === 'defeat' && (I.consume('interact') || I.consume('confirm'))) document.querySelector('.overlay.defeat button:not([disabled])')?.click();

    const paused = G.paused || G.ui.overlay === 'title';
    let sim = dt;
    if (G.combat.hitstop > 0) { G.combat.hitstop -= dt; sim = dt * 0.15; }
    if (G.cineSlow) sim *= G.cineSlow;
    G.sky.underground = G.player.pos.x > 600; G.sky.indoor = G.player.pos.x > 800;
    if (!paused) {
      G.events.update(sim);
      G.fishing.update(sim);
      G.player.update(sim);
      G.pet?.update(sim);
      G.entities.npcs.update(sim);
      G.entities.enemies.update(sim);
      G.wildlife.update(sim);
      G.horses.update(sim);
      G.adventurers.update(sim);
      G.lineage.update(sim);
      G.armorFinds.update(sim);
      G.territory.update(sim);
      G.interiors.update();
      G.pickups.update(sim);
      G.physProps.update(sim);
      G.combat.update(sim);
      G.props.update(sim);
      G.quests.update(sim);
      G.achievements.update(sim);
      G.interact.update();
      G.weather.update(sim, G.camera.position);
      G_WIND.v = G.weather.wind;
    } else {
      // keep the player model animating for character previews
      G.player.animate(dt);
      G.entities.npcs.update(0.0001);
    }
    G.cam.update(dt);
    G.cinematics.update(dt);
    const P = G.player.pos;
    G.sky.update(dt, G.camera.position, P);
    G.world.update(dt, G.camera.position, G.sky.night);
    G.water.update(dt, G.sky, G.weather.rain || 0);
    G.grass.update(G.time, G.camera.position.clone().lerp(P, 0.7), new THREE.Vector3(P.x, P.y, P.z), G.weather.wind, G.sky.lightLevel);
    G.grass.mesh.visible = !G.sky.underground;
    G.particles.update(dt);
    if (G.audio.ready) { this.ambient(dt); G.audio.updateMusic(); }
    G.ui.update(dt);
    G.touch?.update();
    this.autosaveT -= dt;
    if (this.autosaveT <= 0) { this.autosaveT = 15; this.save(false); }
  }

  fatal(e) {
    const f = document.getElementById('fatal');
    f.classList.remove('hidden');
    f.innerHTML = `<div><h2>Wild Lands</h2><p>${t('ui.fatal')}</p><pre>${String(e && e.stack || e)}</pre></div>`;
  }
}
export { SPAWN };
