// Shadows of the Kingdom — ponto de entrada: inicialização, laço principal e integração dos sistemas.
import { G, DEFAULT_SETTINGS } from './state.js';
import { TILE, clamp, dist, hashStr } from './core/util.js';
import { input } from './core/input.js';
import { audio } from './core/audio.js';
import { on, emit } from './core/events.js';
import { t, setLang, getLang, onLangChange } from './core/i18n.js';
import './i18n/index.js';
import './data/dialogue.js';
import { initWorld, getMap, changeMap, spawnNPCs, updateNPCSchedules, ambientUpdate, refreshWorldState, npcEntity, dismount, refreshChestSprites, markerPos, respawnDungeon } from './systems/world.js';
import { initWar, setOwner } from './systems/war.js';
import { newInventory, add as addItem, addGold } from './systems/inventory.js';
import * as inv from './systems/inventory.js';
import { Player } from './entities/player.js';
import { Horse, Projectile, Pickup } from './entities/creature.js';
import { startQuest, initQuestEvents, questTick, questDef, questDialogueFor, objDone, isActive, sideOfferFor } from './systems/quests.js';
import { startDialogue, chooseOption } from './systems/dialogue.js';
import { endCutscene } from './systems/cutscene.js';
import { QUESTS } from './data/quests.js';
import { updateDialogue, advance, endDialogue } from './systems/dialogue.js';
import { updateCutscene, startCutscene } from './systems/cutscene.js';
import { advanceTime, updateWeather } from './systems/time.js';
import { updateInteract, doInteract, updateCapture, updateFishing, refreshGatherables, applyLeverState } from './systems/interact.js';
import { checkAchievements, unlockAchievement } from './systems/achievements.js';
import { save, load, saveSettings, loadSettings } from './systems/save.js';
import { runActions } from './systems/actions.js';
import { renderScene } from './render.js';
import { initTouch, updateTouch } from './ui/touch.js';
import { initHUD, updateHUD, toast, chapterCard } from './ui/hud.js';
import { initDialogueUI, updateDialogueUI, dialogueKey, chooseByNumber } from './ui/dialogueUI.js';
import { initMenus, openMenu, closeMenu, menuOpen, openService, useItem, canSave, renderMenu } from './ui/menus.js';
import { initScreens, showTitle, hideTitle, showDeath, hideDeath, showEnding, showCredits, updateCinema } from './ui/screens.js';
import { VILLAGES, TERRITORIES, FACTIONS } from './data/world.js';
import { ITEMS } from './data/items.js';
import { loc } from './core/i18n.js';

const RES = [[320, 180], [400, 225], [480, 270], [640, 360]];
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const uiRoot = document.getElementById('ui');
globalThis.__G = G;

// ---------- configurações ----------
function applySettings() {
  const S = G.settings;
  audio.vol = { master: S.master, music: S.music, sfx: S.sfx }; audio.applyVolumes();
  if (S.binds) input.binds = JSON.parse(JSON.stringify(S.binds));
  if (getLang() !== S.lang) setLang(S.lang);
  const [w, h] = RES[S.resolution] || RES[1];
  if (canvas.width !== w) { canvas.width = w; canvas.height = h; G.view = { w, h }; ctx.imageSmoothingEnabled = false; }
  if (S.fullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  if (!S.fullscreen && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  fit();
  saveSettings(S);
}
function fit() {
  const sw = window.innerWidth, sh = window.innerHeight;
  const s = Math.max(1, Math.min(sw / canvas.width, sh / canvas.height));
  const scale = s >= 2 ? Math.floor(s * 4) / 4 : s;
  canvas.style.width = Math.floor(canvas.width * scale) + 'px'; canvas.style.height = Math.floor(canvas.height * scale) + 'px';
}
window.addEventListener('resize', fit);
on('settingsChanged', applySettings);
onLangChange(() => { if (menuOpen()) renderMenu(); });

// ---------- inicialização ----------
function boot() {
  const saved = loadSettings();
  if (saved) Object.assign(G.settings, saved);
  else { const nl = (navigator.language || 'pt').slice(0, 2); G.settings.lang = ['pt', 'en', 'es', 'fr', 'de', 'it', 'ja', 'ko', 'zh', 'ru', 'pl', 'tr', 'ar', 'hi'].includes(nl) ? nl : 'pt'; }
  input.attach(canvas);
  initHUD(uiRoot); initDialogueUI(uiRoot); initMenus(uiRoot); initScreens(uiRoot); initTouch(uiRoot);
  applySettings();
  initQuestEvents();
  wireEvents();
  initWorld(); initWar();
  G.titleCam = { t: 0 };
  showTitle();
  window.addEventListener('pointerdown', () => audio.init(), { once: true });
  window.addEventListener('keydown', () => audio.init(), { once: true });
  last = performance.now();
  requestAnimationFrame(frame);
}

function resetState() {
  Object.assign(G, { flags: {}, phase: 'peace', chapter: 1, quests: {}, tracked: null, day: 1, hour: 7.5, discovered: {}, opened: {}, gathered: {}, npcOverride: {}, metNpcs: {}, horses: [], activeHorse: null,
    stats: { kills: 0, chests: 0, captures: 0, parries: 0, fish: 0, animals: 0, gathered: 0, steps: 0, deaths: 0 }, ending: null, playTime: 0, musicOverride: null, weatherForce: null, dialogue: null, dialogueQueue: [], cut: null, capture: null, fishing: null, fade: null, card: null, letterbox: 0, garrisonDead: {}, buffStam: 0 });
  G.achievements = G.achievements || {};
  G.particles.list.length = 0;
}
function startWorld() {
  initWorld();
  G.player = new Player(0, 0, G.playerLook);
  G.player.mapId = 'world';
  G.entities.push(G.player);
  spawnNPCs();
}
function newGame() {
  audio.init();
  hideTitle();
  resetState(); initWar();
  if (!G.playerLook) G.playerLook = { skin: '#e0ac85', hair: '#4a2e1a', hairStyle: 0, top: '#5a4a6a', pants: '#3a3028', boots: '#2a1e18', eye: '#3a5a7a' };
  G.inv = newInventory();
  G.achievements = {};
  startWorld();
  G.player.refreshStats();
  changeMap('int_varden_house1', 'bed', { sfx: false });
  G.player.y += 14; G.player.dir = 0;
  refreshWorldState();
  G.mode = 'play';
  startCutscene('intro', () => { startQuest('m1'); chapterCard(1); });
}
function loadGame(slot) {
  const d = load(slot); if (!d) { toast(t('tst_load_fail'), 'bad'); return; }
  audio.init(); hideTitle(); hideDeath(); closeMenu();
  resetState();
  G.name = d.name; G.playerLook = d.look;
  Object.assign(G, { chapter: d.chapter, phase: d.phase, day: d.day, hour: d.hour, playTime: d.playTime, inv: d.inv, flags: d.flags, quests: d.quests, tracked: d.tracked, territory: d.territory, relations: d.relations, rep: d.rep, treasury: d.treasury, warLog: d.warLog || [],
    discovered: d.discovered, opened: d.opened, gathered: d.gathered, npcOverride: d.npcOverride, metNpcs: d.metNpcs || {}, horses: d.horses || [], achievements: d.achievements || {}, stats: d.stats, ending: d.ending, garrisonDead: d.garrisonDead || {} });
  startWorld();
  const P = G.player; P.level = d.player.level; P.xp = d.player.xp; P.baseHp = d.player.baseHp; P.refreshStats(); P.hp = Math.max(1, d.player.hp); P.bowMode = d.player.bowMode;
  getMap(d.player.map);
  changeMap(d.player.map, [d.player.x, d.player.y], { sfx: false });
  if (d.activeHorse) { const h = new Horse(d.activeHorse.x, d.activeHorse.y, d.activeHorse.coat, { owned: true }); h.mapId = d.activeHorse.map; G.entities.push(h); G.activeHorse = h; }
  refreshWorldState(); refreshChestSprites(); refreshGatherables();
  for (const id of Object.keys(G.flags)) if (id.startsWith('follow_')) runActions({ follow: id.slice(7) });
  // reconstruir entidades do estágio atual das missões ativas
  const SKIP = new Set(['give', 'take', 'gold', 'xp', 'time', 'relation', 'relAdd', 'territory', 'rep', 'horse', 'achievement', 'unlock', 'chapter', 'phase', 'garrisonClear']);
  for (const [id, st] of Object.entries(G.quests)) {
    if (st.state !== 'active') continue;
    const S = QUESTS[id].stages[st.stage];
    const acts = (S.start || []).map((a) => Object.fromEntries(Object.entries(a).filter(([k]) => !SKIP.has(k)))).filter((a) => Object.keys(a).length);
    // não recriar objetos de interação já concluídos
    const doneProps = new Set((S.obj || []).filter((o, i) => o.t === 'interact' && (st.c[i] || 0) >= (o.n || 1)).map((o) => o.id));
    for (const a of acts) { if (a.prop) a.prop = [].concat(a.prop).filter((p) => !doneProps.has(p.id)); }
    runActions(acts);
  }
  G.mode = 'play';
  toast(t('tst_loaded'));
}
function respawn() {
  const P = G.player;
  P.dead = false; P.state = 'idle'; P.hp = P.maxHp; P.stam = P.maxStam; P.alpha = 1;
  const lost = Math.floor(G.inv.gold * 0.1); G.inv.gold -= lost;
  for (const e of G.entities) if (e.ai === 'enemy' && e.target === P) { e.target = null; e.x = e.home.x; e.y = e.home.y; e.hp = e.maxHp; }
  for (const e of G.entities) if (e.boss && !e.dead) e.hp = e.maxHp;
  if (G.map.interior && G.map.id.startsWith('int_')) changeMap(G.map.id, 'entry');
  else if (G.map.interior) changeMap(G.map.id, 'entry');
  else if (G.flags.fallen && !G.flags.restored) changeMap('world', 'refuge');
  else { const near = Object.entries(VILLAGES).sort((a, b) => dist(P.x, P.y, a[1].x * TILE, a[1].y * TILE) - dist(P.x, P.y, b[1].x * TILE, b[1].y * TILE))[0]; changeMap('world', near[0] + '_center'); }
  G.mode = 'play'; if (lost) toast(t('tst_lost_gold', { n: lost }), 'bad');
}

// ---------- eventos ----------
function wireEvents() {
  on('newGame', newGame);
  on('loadGame', loadGame);
  on('respawn', respawn);
  on('backToTitle', () => { G.cut = null; G.dialogue = null; G.letterbox = 0; G.fade = null; G.card = null; hideDeath(); closeMenu(); G.player = null; initWorld(); showTitle(); });
  on('toast', (k) => toast(typeof k === 'object' ? loc(k) : t(k), String(k).startsWith('cap_') || String(k).startsWith('ev_ambush') ? 'bad' : ''));
  on('questStarted', (id) => { const q = QUESTS[id]; toast(`${t(q.type === 'main' ? 'tst_quest_new' : 'tst_side_new')}: ${t('q_' + id)}`, 'quest', 4); });
  on('questDone', (id) => {
    toast(`${t('tst_quest_done')}: ${t('q_' + id)}`, 'quest', 4);
    if (Object.keys(QUESTS).filter((k) => QUESTS[k].type === 'side').every((k) => G.quests[k] && G.quests[k].state === 'done')) unlockAchievement('side_all');
    autosave();
  });
  on('chapter', (n) => { setTimeout(() => chapterCard(n), 600); });
  on('itemGained', (id, n) => { if (G.mode !== 'title') toast(`+${n > 1 ? n + ' ' : ''}${t('item_' + id)}`, '', 2.2); if (id === 'w_dawnblade' || id.startsWith('w_') || id.startsWith('b_')) G.player && G.player.refreshStats(); });
  on('goldGained', (n) => { if (n >= 5) toast(`+${n} ◉`, '', 1.8); audio.sfx('coin'); });
  on('equipChanged', () => G.player && G.player.refreshStats());
  on('levelUp', (lv) => toast(t('tst_levelup', { n: lv }), 'quest', 3.5));
  on('achievement', (id) => toast(`🏆 ${t('ach_' + id)}`, 'ach', 4.5));
  on('territoryChanged', (tid, prev, own, tr) => {
    if (G.mode === 'title') return;
    if (own === 'varden') toast(t('tst_captured', { name: tr.name }), 'quest');
    else if (prev === 'varden') toast(t('tst_lost_territory', { name: tr.name, f: FACTIONS[own] ? FACTIONS[own].name : '?' }), 'bad');
    else if (G.flags.unlock_stratmap) toast(t('tst_terr_change', { name: tr.name, f: own ? FACTIONS[own].name : t('map_neutral') }), '', 3);
  });
  on('capture', () => checkAchievements());
  on('openShop', (id) => openService('shop', id));
  on('openSmith', () => openService('smith'));
  on('openStable', () => openService('stable'));
  on('autosave', () => autosave(true));
  on('rested', () => toast(t('tst_rested')));
  on('meteor', () => { for (let i = 0; i < 6; i++) setTimeout(() => { const p = G.player; if (!p) return; const x = p.x + (Math.random() - 0.3) * 300, y = p.y - 150; for (let k = 0; k < 14; k++) G.particles.add({ x: x - k * 4, y: y + k * 2, vx: 160, vy: 80, life: 0.6 + k * 0.02, color: k < 3 ? '#ffffff' : '#ffd080', size: 1 }); }, i * 500); toast(t('ev_meteor')); unlockAchievement('meteor'); });
  on('legendHorse', () => { G.flags.nevoa_owned = true; emit('flagsChanged'); });
  on('horseGained', () => unlockAchievement('first_horse'));
  on('noArrows', () => toast(t('tst_no_arrows'), 'bad', 1.8));
  on('quickPotion', () => { if (!useItem('potion_big') && !useItem('potion')) { if (G.player.hp >= G.player.maxHp) toast(t('tst_full_hp'), '', 1.5); else toast(t('tst_no_potion'), 'bad', 1.8); } });
  on('dismount', () => dismount());
  on('mapChanged', (id) => { const m = G.map; if (id === 'ruins_tomb') applyLeverState(m); if (m.interior && !id.startsWith('int_') && G.dungeonVisit?.[id] !== G.day) { G.dungeonVisit = G.dungeonVisit || {}; if (G.dungeonVisit[id] != null && G.dungeonVisit[id] < G.day - 2) respawnDungeon(id); G.dungeonVisit[id] = G.day; } autosave(); });
  on('newDay', () => { refreshGatherables(); if (G.buffStam > 0) G.buffStam = 0; });
  on('playerDied', () => { setTimeout(() => { if (G.player && G.player.dead) { G.mode = 'dead'; showDeath(); } }, 1600); });
  on('death', (e, src) => {
    if (e === G.player) return;
    if (src === G.player || (src && src.team === 'P')) {
      if (e.ai === 'enemy') G.stats.kills++;
      if (e.kind && e.huntable) G.stats.animals++;
      const xp = e.xp || (e.D && e.D.xp) || 0; if (xp && src === G.player) G.player.gainXp(xp);
      // espólio
      const loot = e.loot || (e.D && e.D.loot) || [];
      for (const [id, ch, n] of loot) if (ch && Math.random() < ch) G.entities.push(Object.assign(new Pickup(e.x, e.y - 4, id, n || 1), { mapId: e.mapId }));
      if (e.gold && e.gold[1]) { const g = e.gold[0] + Math.floor(Math.random() * (e.gold[1] - e.gold[0] + 1)); if (g) G.entities.push(Object.assign(new Pickup(e.x, e.y - 4, 'gold', g), { mapId: e.mapId })); }
      checkAchievements();
    }
  });
  on('pickup', (id, n) => { if (id === 'gold') addGold(n); else addItem(id, n); audio.sfx('pickup'); });
  on('fireArrow', (shooter, angle, bow, power = 1) => {
    const spd = (bow.arrowSpeed || 240) * (0.6 + power * 0.4);
    const dmg = Math.round(bow.dmg * (0.5 + power * 0.5) * (shooter.dmgMul || 1));
    const pr = new Projectile(shooter.x + Math.cos(angle) * 8, shooter.y - 2 + Math.sin(angle) * 6, angle, spd, shooter, dmg);
    G.entities.push(pr); audio.sfx('bow', shooter);
  });
  on('throwDaggers', (src, tgt) => { for (let i = -1; i <= 1; i++) { const a = Math.atan2(tgt.y - src.y, tgt.x - src.x) + i * 0.25; G.entities.push(new Projectile(src.x, src.y - 2, a, 170, src, Math.round(8 * src.dmgMul), 'dagger')); } });
  on('fastTravel', (vid) => {
    const v = VILLAGES[vid]; if (!v) return;
    const d = dist(G.player.x, G.player.y, v.x * TILE, v.y * TILE) / TILE;
    G.fade = { dir: 'out', t: 0, dur: 0.6 };
    setTimeout(() => { if (G.player.mount) dismount(); changeMap('world', vid + '_center'); advanceTime(d * 3); G.hour = (G.hour + d / 40) % 24; if (G.activeHorse) { G.activeHorse.mapId = 'world'; G.activeHorse.x = G.player.x + 30; G.activeHorse.y = G.player.y; } G.fade = { dir: 'in', t: 0, dur: 0.8 }; toast(t('tst_travel', { name: FACTIONS[v.faction].name })); }, 650);
  });
  on('showEnding', (_, cb) => { applyEnding(G.ending); unlockAchievement('end_' + G.ending); showEnding(G.ending, cb); });
  on('rollCredits', (cb) => showCredits(cb));
  on('bossPhase', (e) => { if (e.etype === 'vargan') { G.cam.shake = 5; toast(t('tst_boss_rage')); for (let i = 0; i < 2; i++) runActions({ spawn: { e: 'soldier_drakmor', at: [e.x + (i ? 40 : -40), e.y + 20], map: e.mapId, tag: 'm25v', aggro: true } }); } });
  on('gathered', () => checkAchievements());
  on('weaponUpgraded', () => checkAchievements());
}
function applyEnding(which) {
  const own = (ids, f) => { for (const id of ids) setOwner(id, f, true); };
  const vard = TERRITORIES.filter((t0) => t0.orig === 'varden').map((t0) => t0.id);
  if (which === 'union') { for (const tr of TERRITORIES) setOwner(tr.id, tr.orig, true); setOwner('ne_cinzas', 'cinzamar', true); setOwner('ne_encruz', 'cinzamar', true); for (const a of Object.keys(FACTIONS)) for (const b of Object.keys(FACTIONS)) if (a < b && a !== 'ravencross' && b !== 'ravencross') runActions({ relation: { [`${a}-${b}`]: 70 } }); }
  else if (which === 'conquest') { own(vard, 'varden'); own(['dk_trilha', 'dk_garganta', 'dk_minas', 'dk_passo', 'ne_encruz', 'rv_brejo'], 'varden'); runActions({ relation: { 'varden-drakmor': -20, 'varden-cinzamar': -60 } }); }
  else { for (const tr of TERRITORIES) setOwner(tr.id, tr.orig, true); own(['va_estrada'], 'solaria'); own(['va_vau'], 'cinzamar'); own(['ru_ruinas', 'ru_portal', 'ru_colinas'], null); runActions({ relation: { 'varden-drakmor': 40, 'varden-cinzamar': 50 } }); }
  G.flags.ending = which;
}
let lastAuto = -999;
function autosave(force = false) {
  if (!G.settings.autosave || !G.player || G.mode === 'title' || G.player.dead) return;
  if (!force && G.playTime - lastAuto < 45) return;
  if (!canSave() || G.mode !== 'play') { setTimeout(() => autosave(force), 3000); return; }
  lastAuto = G.playTime; save('auto');
}

// ---------- laço principal ----------
let last = 0, acc = 0;
const STEP = 1 / 60;
function frame(now) {
  const dtReal = Math.min(0.1, (now - last) / 1000); last = now;
  acc += dtReal;
  let steps = 0;
  requestAnimationFrame(frame);
  try {
    while (acc >= STEP && steps < 4) { update(STEP); acc -= STEP; steps++; input.endFrame(); }
    if (steps === 4) acc = 0;
    render(dtReal);
  } catch (e) { if (!frame.errT || now - frame.errT > 2000) { frame.errT = now; console.error('Erro no laço do jogo:', e); } input.endFrame(); }
}
function handleGlobalKeys() {
  const m = G.mode;
  if (m === 'dialogue') {
    if (G.dialogue && G.dialogue.choices) {
      if (input.pressed('up')) dialogueKey('up'); else if (input.pressed('down')) dialogueKey('down');
      else if (input.pressed('interact') || input.pressed('attack') || input.pressed('dodge')) dialogueKey('enter');
      for (let i = 0; i < 4; i++) if (input.down.has('Digit' + (i + 1)) && input.pressedSet.has('Digit' + (i + 1))) chooseByNumber(i);
    } else if (input.pressed('interact') || input.pressed('attack') || input.pressed('dodge')) advance();
    return;
  }
  if (m === 'menu' || m === 'shop') { if (input.pressed('menu') || (m === 'menu' && (input.pressed('inventory') || input.pressed('map') || input.pressed('quests')))) closeMenu(); return; }
  if (m === 'play') {
    if (input.pressed('menu')) openMenu('inventory');
    else if (input.pressed('inventory')) openMenu('inventory');
    else if (input.pressed('map')) openMenu('map');
    else if (input.pressed('political')) { openMenu('map'); }
    else if (input.pressed('quests')) openMenu('quests');
    if (input.pressed('interact')) { if (G.fishing) {} else if (G.interactTarget) doInteract(G.interactTarget); }
    if (input.pressed('mount')) { const p = G.player; if (p.mount) dismount(); else if (G.activeHorse && G.activeHorse.mapId === p.mapId && dist(p.x, p.y, G.activeHorse.x, G.activeHorse.y) < 36) doInteract({ kind: 'mount', target: G.activeHorse }); }
    if (input.pressed('whistle')) whistle();
  }
}
function whistle() {
  const p = G.player, h = G.activeHorse;
  audio.sfx('chirp'); p.showEmote('note', 1);
  if (!h || p.map.interior) { if (!h) toast(t('tst_no_horse'), '', 1.6); return; }
  if (h.mapId !== p.mapId) { h.mapId = p.mapId; h.x = p.x - 140; h.y = p.y; }
  h.called = true; setTimeout(() => audio.sfx('neigh', h), 400);
}
let schedT = 0;
function update(dt) {
  G.dt = dt;
  input.pollPad();
  if (G.mode === 'title' || G.mode === 'credits' || G.mode === 'ending') { G.t += dt; titleCamera(dt); G.particles.update(dt); return; }
  handleGlobalKeys();
  updateDialogue(dt);
  if (G.mode === 'menu' || G.mode === 'shop' || G.mode === 'dead') return;
  if (G.hitStop > 0) { G.hitStop -= dt; return; }
  G.t += dt; G.playTime += dt;
  if (G.mode === 'play') advanceTime(dt);
  if (G.buffStam > 0) G.buffStam -= dt;
  if (G.mode === 'cutscene') updateCutscene(dt);
  const p = G.player;
  // entidades do mapa atual
  const mid = p.mapId;
  for (const e of G.entities) if (e.mapId === mid && !e.removed) e.update(dt);
  // aliados/seguidores em outros mapas não ficam congelados longe do jogador
  if (Math.random() < 0.02) G.entities = G.entities.filter((e) => !e.removed);
  if (G.mode === 'play') {
    updateInteract();
    updateCapture(dt, input.held('interact'));
    updateFishing(dt, input.pressed('interact') && G.fishing && G.fishing.t > 0.2);
    ambientUpdate(dt);
    questTick(dt);
    schedT -= dt; if (schedT <= 0) { schedT = 3; updateNPCSchedules(); discoverVillages(); checkAchievements(); }
  }
  updateWeather(dt);
  G.particles.update(dt);
  updateCamera(dt);
  audio.listener = { x: p.x, y: p.y };
  musicTick();
}
function discoverVillages() { const p = G.player; if (G.map !== G.world) return; for (const [vid, v] of Object.entries(VILLAGES)) if (dist(p.x, p.y, v.x * TILE, v.y * TILE) < (v.r + 4) * TILE) { if (!G.discovered['v_' + vid]) { G.discovered['v_' + vid] = true; toast(t('tst_discovered', { name: FACTIONS[v.faction].name }), 'quest'); } } }
function updateCamera(dt) {
  const c = G.cam, p = G.player, m = G.map;
  let tx, ty;
  if (c.lock) { tx = c.lock.x - G.view.w / 2; ty = c.lock.y - G.view.h / 2; }
  else { const lead = p.mount ? 30 : 14; const [dx, dy] = [[0, 1], [-1, 0], [1, 0], [0, -1]][p.dir]; tx = p.x - G.view.w / 2 + (p.moving || p.mount ? dx * lead : 0); ty = p.y - 10 - G.view.h / 2 + (p.moving || p.mount ? dy * lead : 0); }
  const ox = c.x, oy = c.y;
  if (c.snap) { c.x = tx; c.y = ty; c.snap = false; }
  else { const k = 1 - Math.pow(c.lock ? 0.15 : 0.002, dt); c.x += (tx - c.x) * k; c.y += (ty - c.y) * k; }
  const mw = m.w * TILE, mh = m.h * TILE;
  if (mw > G.view.w) c.x = clamp(c.x, 0, mw - G.view.w); else c.x = (mw - G.view.w) / 2;
  if (mh > G.view.h) c.y = clamp(c.y, 0, mh - G.view.h); else c.y = (mh - G.view.h) / 2;
  c.dx = c.x - ox; c.dy = c.y - oy;
  if (c.shake > 0) c.shake = Math.max(0, c.shake - dt * 12);
}
function titleCamera(dt) {
  if (!G.world) return;
  G.map = G.world;
  const T0 = G.titleCam; T0.t += dt;
  const v = VILLAGES.varden;
  G.cam.x = v.x * TILE - G.view.w / 2 + Math.sin(T0.t * 0.05) * 260; G.cam.y = v.y * TILE - G.view.h / 2 - 40 + Math.cos(T0.t * 0.04) * 120;
  G.hour = 17.8 + Math.sin(T0.t * 0.02) * 0.5;
  for (const e of G.entities) if (e.mapId === 'world' && !e.removed && !e.npcId && e.update && !e.ai) e.update(dt);
  G.weatherState.leaves = 0;
}
let musicCheck = 0;
function musicTick() {
  musicCheck -= G.dt; if (musicCheck > 0) return; musicCheck = 1;
  if (G.musicOverride) { audio.setTheme(G.musicOverride); return; }
  const p = G.player, m = G.map;
  const fighting = G.entities.some((e) => (e.ai === 'enemy' || e.team === 'W') && e.target === p && !e.dead && !e.removed && e.mapId === p.mapId && dist(e.x, e.y, p.x, p.y) < 220);
  if (fighting) { audio.setTheme(G.entities.some((e) => e.boss && e.target === p && !e.dead) ? 'epic' : 'battle'); return; }
  if (G.phase === 'fall' && !m.interior && dist(p.x, p.y, ...markerPos('world', 'refuge')) < 400) { audio.setTheme('refuge'); return; }
  if (m.interior) { audio.setTheme(m.music || 'varden'); return; }
  for (const [vid, v] of Object.entries(VILLAGES)) if (dist(p.x, p.y, v.x * TILE, v.y * TILE) < (v.r + 6) * TILE) { audio.setTheme(vid === 'varden' && G.flags.fallen && !G.flags.restored ? 'sad' : v.music); return; }
  const reg = m.regionAtPx(p.x, p.y);
  audio.setTheme(['forest', 'plains', 'mountains', 'swamp', 'ash', 'coast', 'north', 'ruins'][reg]);
}
function render(dt) {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.view.w, G.view.h);
  if (G.map) renderScene(ctx);
  updateHUD(dt);
  updateDialogueUI(dt);
  updateCinema(dt);
  updateTouch();
}

// API de depuração/testes automatizados
globalThis.__game = { G, questDialogueFor, objDone, isActive, sideOfferFor, startDialogue, chooseOption, endCutscene, addItem, setOwner, dismount, startQuest, changeMap, runActions, doInteract, emit, save, load, newGame, loadGame, npcEntity, markerPos, getMap, QUESTS, endDialogue, advance };
boot();
