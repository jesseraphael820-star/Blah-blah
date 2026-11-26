// Gerenciador do mundo: mapas, transições, NPCs com rotinas, população de animais, postos,
// guarnições, eventos aleatórios, baús e estado visual das vilas (ocupação, refúgio).
import { G } from '../state.js';
import { TILE, dist, hash2, mulberry32, hashStr, clamp } from '../core/util.js';
import { generateWorld, obj } from '../world/gen.js';
import { createInterior, createDungeon, DUNGEONS } from '../world/interiors.js';
import { Actor } from '../entities/actor.js';
import { Creature, Horse, Bird, FishJump } from '../entities/creature.js';
import { NPCS, VILLAGER_TOPS } from '../data/npcs.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { REGIONS, VILLAGES, TERRITORIES, FACTIONS } from '../data/world.js';
import { propSprite, buildingSprite } from '../gfx/objects.js';
import { SKINS, HAIRS } from '../gfx/chars.js';
import { TILE_INFO, T } from '../gfx/tiles.js';
import { audio } from '../core/audio.js';
import { emit } from '../core/events.js';
import { atWar } from './war.js';

export function initWorld() {
  G.world = generateWorld();
  G.maps = { world: G.world };
  G.entities = [];
  placeChests(G.world);
  placeHerds(G.world);
}
export function getMap(id) {
  if (G.maps[id]) return G.maps[id];
  let m;
  if (id.startsWith('int_')) {
    const door = G.world.doors.find((d) => d.target === id);
    m = createInterior(id, door);
  } else if (DUNGEONS[id]) { m = createDungeon(id); placeChests(m); populateDungeon(m); }
  else { console.warn('mapa desconhecido', id); return G.world; }
  G.maps[id] = m;
  return m;
}
export function markerPos(mapId, name) {
  const m = getMap(mapId); const p = m.markers[name];
  if (!p) { console.warn('marcador ausente', mapId, name); return [m.w * 8, m.h * 8]; }
  return p;
}

// ---------- transição de mapas ----------
export function changeMap(mapId, at, opts = {}) {
  const m = getMap(mapId);
  const [x, y] = Array.isArray(at) ? at : markerPos(mapId, at || 'entry');
  const p = G.player;
  if (p.mount && m.interior) { dismount(); }
  p.mapId = mapId; p.x = x; p.y = y;
  if (p.mount) { p.mount.mapId = mapId; p.mount.x = x; p.mount.y = y; }
  G.map = m;
  for (const e of G.entities) if ((e.ai === 'follower') && !e.dead) e.teleportNear(p);
  G.cam.x = x - G.view.w / 2; G.cam.y = y - G.view.h / 2; G.cam.snap = true;
  if (!m.interior) G.discovered['reg' + m.regionAtPx(x, y)] = true;
  else G.discovered[mapId] = true;
  if (opts.sfx !== false) audio.sfx(m.interior || opts.door ? 'door' : 'click');
  // limpar entidades ambientais de outros mapas
  G.entities = G.entities.filter((e) => !(e.isAmbient && e.mapId !== mapId));
  emit('mapChanged', mapId);
}
export function enterDoor(door) {
  const target = door.target;
  const m = getMap(target);
  G.lastDoor = door;
  changeMap(target, 'entry', { door: true });
}
export function exitInterior() {
  const cur = G.map; const id = cur.id;
  const door = G.world.doors.find((d) => d.target === id);
  if (!door) { changeMap('world', 'varden_plaza'); return; }
  changeMap('world', [door.x, door.y + (door.cave ? 18 : 14)], { door: true });
  G.player.dir = 0;
}
export function dismount() {
  const p = G.player; const h = p.mount; if (!h) return;
  h.rider = null; p.mount = null; p.x = h.x + 12; p.y = h.y + 4;
  const [bx, by, bw, bh] = p.boxAt(p.x, p.y);
  if (p.map.collides(bx, by, bw, bh)) { p.x = h.x - 12; }
  h.gait = 'idle'; audio.sfx('snort', h);
}

// ---------- criação de atores ----------
export function spawnEnemy(type, x, y, mapId, o = {}) {
  const T0 = ENEMY_TYPES[type];
  let look = T0.look ? { ...T0.look } : null;
  if (type === 'kael_duel') look = NPCS.kael.look;
  if (look && !look.hair && !look.hood && !look.helm && !look.bald) look.hair = HAIRS[Math.floor(Math.random() * 6)];
  const lvl = G.player ? G.player.level : 1;
  const scale = 1 + (lvl - 1) * 0.08;
  const a = new Actor(x, y, {
    look, hp: Math.round(T0.hp * scale * (o.hpMul || 1)), team: o.team || 'E', ai: o.ai || 'enemy', speed: T0.speed, faction: T0.faction || o.faction,
    weapon: T0.weapon, bow: T0.bow, shield: T0.shield, tag: o.tag, etype: type, xp: T0.xp, gold: T0.gold, loot: T0.loot, boss: T0.boss, dodge: T0.dodge,
    teleport: T0.teleport, phases: T0.phases, noKill: T0.noKill, name: o.name, dmgMul: (T0.dmg / ((T0.weapon && ENEMY_DMG_BASE[T0.weapon]) || 8)) * (1 + (lvl - 1) * 0.05),
  });
  a.mapId = mapId; a.wanderR = o.wanderR ?? 40;
  if (o.team === 'P') { a.ai = 'ally'; a.dmgMul *= 0.8; }
  if (T0.faction && o.team === 'P') { /* aliado */ }
  G.entities.push(a);
  return a;
}
const ENEMY_DMG_BASE = { w_iron_sword: 10, w_dagger: 6, w_hatchet: 9, w_guard_spear: 14, w_drak_great: 23, w_drak_axe: 16, w_militia_long: 14, w_raven_dagger: 14, w_steel_sword: 15 };

export function brotherhoodSoldier(x, y, mapId, tag) {
  const a = new Actor(x, y, { look: { skin: SKINS[Math.floor(Math.random() * 5)], hair: HAIRS[Math.floor(Math.random() * 6)], helm: '#8a8a96', tabard: '#7b3fa0', top: '#4a3a5a', armor: '#7a7a86' }, hp: 60, team: 'P', ai: 'ally', speed: 58, weapon: 'w_guard_spear', tag, name: '' });
  a.mapId = mapId; a.dmgMul = 0.7;
  G.entities.push(a); return a;
}

export function randomVillagerLook(fac, r = Math.random) {
  const tops = VILLAGER_TOPS[fac] || VILLAGER_TOPS.varden;
  const look = { skin: SKINS[Math.floor(r() * SKINS.length)], hair: HAIRS[Math.floor(r() * HAIRS.length)], hairStyle: Math.floor(r() * 7), top: tops[Math.floor(r() * tops.length)], pants: ['#4a3a2e', '#3a3a4a', '#5a4a3a'][Math.floor(r() * 3)] };
  if (r() < 0.25) look.beard = look.hair; if (r() < 0.12) look.hat = ['#8a6a3a', '#5a3a2a', '#c8a860'][Math.floor(r() * 3)];
  if (fac === 'frostheim' && r() < 0.5) look.top = '#6a5a4a';
  return look;
}

// ---------- NPCs nomeados ----------
export function spawnNPCs() {
  for (const [id, d] of Object.entries(NPCS)) {
    if (id === 'narrator') continue;
    const a = new Actor(0, 0, { look: d.look, hp: 200, team: 'N', ai: 'npc', speed: 46, name: d.name, npcId: id, voice: d.voice });
    a.mapId = '__hidden';
    if (id === 'kael') { a.weapon = { ...weaponOf('w_steel_sword') }; a.hp = a.maxHp = 300; a.dmgMul = 0.8; }
    G.entities.push(a);
    placeNPC(a, true);
  }
  spawnVillagers();
}
const weaponOf = (id) => { const it = { w_steel_sword: { type: 'weapon', wtype: 'sword', dmg: 15, speed: 0.34, reach: 20, arc: 105, stam: 10, knock: 40 } }; return it[id]; };
export function npcEntity(id) { return G.entities.find((e) => e.npcId === id); }
export function npcTargetPos(id) {
  const d = NPCS[id]; if (!d) return null;
  if (G.npcOverride[id]) return G.npcOverride[id] === 'hidden' ? null : G.npcOverride[id];
  if (d.hiddenUntil && !G.flags[d.hiddenUntil]) return null;
  if (G.phase === 'fall' && d.faction === 'varden') return d.fall || null;
  const night = G.hour < 6 || G.hour >= 20.5;
  return (night && d.night) || d.day;
}
export function placeNPC(a, instant = false) {
  const pos = npcTargetPos(a.npcId);
  if (!pos) { a.mapId = '__hidden'; return; }
  const [mapId, marker, dx = 0, dy = 0] = pos;
  const m = G.maps[mapId] || (mapId.startsWith('int_') || mapId === 'world' ? getMap(mapId) : null);
  if (!m) return;
  const mp = m.markers[marker]; if (!mp) { console.warn('NPC sem marcador', a.npcId, marker); return; }
  const tx = mp[0] + dx, ty = mp[1] + dy;
  const p = G.player;
  const visible = p && a.mapId === p.mapId && Math.abs(a.x - p.x) < G.view.w * 0.7 && Math.abs(a.y - p.y) < G.view.h * 0.7;
  if (instant || a.mapId !== mapId || !visible) { a.mapId = mapId; a.x = tx; a.y = ty; a.home = { x: tx, y: ty }; a.goal = null; }
  else if (dist(a.x, a.y, tx, ty) > 6) { a.goal = { x: tx, y: ty }; a.home = { x: tx, y: ty }; }
  a.wanderR = a.ai === 'npc' && mapId === 'world' && !NPCS[a.npcId].shop ? 18 : 0;
}
export function updateNPCSchedules() {
  for (const e of G.entities) if (e.npcId && e.ai === 'npc' && !e.talkTarget) placeNPC(e);
}

// moradores genéricos
function spawnVillagers() {
  for (const [vid, v] of Object.entries(VILLAGES)) {
    const r = mulberry32(hashStr(vid));
    const n = vid === 'varden' ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const a = new Actor(0, 0, { look: randomVillagerLook(v.faction, r), hp: 30, team: 'N', ai: 'npc', speed: 34, name: '' });
      a.villager = vid; a.vfaction = v.faction; a.mapId = 'world';
      const ang = r() * Math.PI * 2, d = 3 + r() * 6;
      a.x = (v.x + Math.cos(ang) * d) * TILE; a.y = (v.y + Math.sin(ang) * d) * TILE; a.home = { x: a.x, y: a.y }; a.wanderR = 70;
      a.lineSeed = i;
      G.entities.push(a);
    }
    // guardas
    for (let i = 0; i < 2; i++) {
      const fac = v.faction, col = FACTIONS[fac].color;
      const a = new Actor(0, 0, { look: { skin: SKINS[i + 1], hair: HAIRS[i], helm: '#7a7a86', tabard: col, top: FACTIONS[fac].dark, armor: '#6a6a72' }, hp: 70, team: 'N', ai: 'npc', speed: 50, weapon: 'w_guard_spear', name: '' });
      a.guard = vid; a.vfaction = fac; a.mapId = 'world';
      a.x = (v.x + (i ? 3 : -3)) * TILE; a.y = (v.y + v.r - 1) * TILE; a.home = { x: a.x, y: a.y }; a.wanderR = 0; a.dir = 0;
      G.entities.push(a);
    }
  }
  // animais domésticos nas vilas
  for (const [vid, v] of Object.entries(VILLAGES)) {
    const kinds = vid === 'frostheim' ? ['dog', 'sheep', 'sheep'] : vid === 'solaria' ? ['cat', 'dog', 'chicken'] : vid === 'cinzamar' ? ['goat', 'chicken'] : vid === 'ravencross' ? ['cat'] : ['chicken', 'chicken', 'dog', 'cat', 'cow', 'sheep'];
    kinds.forEach((k, i) => { const c = new Creature((v.x - 8 + i * 3) * TILE, (v.y + 6 + (i % 2) * 3) * TILE, k, { persistent: true }); c.mapId = 'world'; c.home = { x: c.x, y: c.y }; c.persistent = true; c.village = vid; G.entities.push(c); });
  }
  // galinhas de Hobb e vacas
  const hf = G.world.markers.hobb_farm;
  for (let i = 0; i < 3; i++) { const c = new Creature(hf[0] + 40 + i * 12, hf[1] + 30, i < 2 ? 'cow' : 'sheep', { persistent: true }); c.mapId = 'world'; c.persistent = true; G.entities.push(c); }
}

// refletir o estado da história nos moradores (ocupação de Várden)
export function refreshVillagerState() {
  const occupied = G.flags.fallen && !G.flags.restored;
  for (const e of G.entities) {
    if (e.villager === 'varden' || e.guard === 'varden' || e.village === 'varden') {
      if (occupied) { if (e.mapId === 'world') { e.savedMap = 'world'; e.mapId = '__hidden'; } }
      else if (e.mapId === '__hidden' && e.savedMap) e.mapId = e.savedMap;
    }
    if (e.guard) e.team = atWar(e.vfaction, 'varden') && e.vfaction !== 'varden' ? 'E' : 'N';
    if (e.guard && e.team === 'E') { e.ai = 'enemy'; } else if (e.guard) e.ai = 'npc';
  }
}

// ---------- baús e acampamentos ----------
const CHEST_WEAPONS = ['w_elf_fang', 'b_hunter', 'w_rune_axe', 'w_frost_long', 's_iron', 'w_trident', 'a_chain', 'w_guard_spear', 'b_elven', 'w_steel_sword', 'w_drak_axe', 'c_ranger', 'w_guardian_sword', 'a_plate', 's_frost'];
export function placeChests(m) {
  const spots = m.chestSpots || [];
  spots.forEach(([tx, ty], i) => {
    const cid = `${m.id}_c${i}`;
    const r = mulberry32(hashStr(cid));
    const loot = [];
    let gold = 10 + Math.floor(r() * 40);
    const special = m.id === 'world' ? i % 3 === 0 : i === 0;
    if (special) loot.push([CHEST_WEAPONS[(hashStr(cid) >>> 3) % CHEST_WEAPONS.length], 1]);
    loot.push([['potion', 'arrows', 'gem', 'elixir', 'ore', 'bread'][Math.floor(r() * 6)], 1 + Math.floor(r() * 3)]);
    if (r() < 0.4) loot.push(['potion', 1]);
    if (m.interior) gold += 30;
    const [x, y] = m.findWalkableNear(tx, ty, 4);
    const o = m.addObject(obj('chest', x * TILE + 8, y * TILE + 12, propSprite('chest', special ? 'gold' : '', G.opened[cid] ? 1 : 0), { cid, loot, gold, golden: special }));
    // acampamento abandonado ao redor de alguns baús do mundo
    if (m.id === 'world' && i % 4 === 1) {
      m.addObject(obj('tent', o.x - 26, o.y - 8, buildingSprite('neutral', 'tent'), {}));
      m.addObject(obj('campfire', o.x + 18, o.y + 4, propSprite('campfire', '', 9), {}));
      m.addObject(obj('debris', o.x - 6, o.y + 14, propSprite('debris'), { passable: true }));
    }
  });
}
// tesouros especiais de missões laterais e de mapas
export function refreshChestSprites() {
  for (const m of Object.values(G.maps)) for (const o of m.objects) if (o.kind === 'chest') o.spr = propSprite('chest', o.golden ? 'gold' : '', G.opened[o.cid] ? 1 : 0);
}
function placeHerds(m) {
  // cavalos selvagens nas planícies e Névoa (lendária)
  const coats = ['brown', 'black', 'chestnut', 'grey', 'palomino', 'bay', 'white'];
  const r = mulberry32(99);
  for (let h = 0; h < 4; h++) {
    const cx = 120 + r() * 70, cy = 90 + r() * 60;
    for (let i = 0; i < 3; i++) {
      const [tx, ty] = m.findWalkableNear(Math.round(cx + (r() - 0.5) * 6), Math.round(cy + (r() - 0.5) * 6), 6);
      const horse = new Horse(tx * TILE + 8, ty * TILE + 8, coats[Math.floor(r() * coats.length)]); horse.mapId = 'world'; horse.wild = true; G.entities.push(horse);
    }
  }
}
function populateDungeon(m) {
  const id = m.id, D = DUNGEONS[id];
  if (m.populated) return; m.populated = true;
  const types = { cave_whisper: ['cultist', 'bat'], cave_smugglers: ['smuggler', 'smuggler'], mine_old: ['bandit', 'spider'], cave_bear: ['frostwolf'], cave_ash: ['bandit', 'bat', 'spider'], cave_eldoria: ['spider', 'bat'], cave_swamp: ['spider', 'cultist'], ruins_tomb: ['grave_robber', 'bat'] }[id] || ['bat'];
  for (const k of ['mid1', 'mid2', 'mid3']) {
    const [x, y] = m.markers[k];
    for (let i = 0; i < 2; i++) {
      const t = types[i % types.length];
      if (ENEMY_TYPES[t]) { const e = spawnEnemy(t, x + (i - 0.5) * 20, y, id, { tag: 'dng_' + id }); e.ambientDungeon = true; }
      else { const c = new Creature(x + (i - 0.5) * 20, y, t, { hostile: true }); c.mapId = id; c.ambientDungeon = true; G.entities.push(c); }
    }
  }
}
export function respawnDungeon(id) { const m = G.maps[id]; if (m) { m.populated = false; populateDungeon(m); } }

// ---------- população ambiente ----------
let spawnT = 0, birdT = 0, fishT = 0, eventT = 60, patrolT = 20;
export function ambientUpdate(dt) {
  const p = G.player; if (!p || G.map !== G.world) return;
  spawnT -= dt; birdT -= dt; fishT -= dt; eventT -= dt; patrolT -= dt;
  const reg = G.world.regionAtPx(p.x, p.y);
  G.discovered['reg' + reg] = true;
  // remover distantes
  for (const e of G.entities) {
    if (e.mapId !== 'world') continue;
    const d = dist(e.x, e.y, p.x, p.y);
    if ((e.ambient || e.isAmbient) && d > 700) e.removed = true;
  }
  if (spawnT <= 0) {
    spawnT = 2.5;
    const count = G.entities.filter((e) => e.ambient && e.mapId === 'world' && !e.dead && !e.removed).length;
    if (count < 9) {
      const R = REGIONS[reg];
      const night = G.hour < 6 || G.hour > 20;
      let kind = R.animals[Math.floor(Math.random() * R.animals.length)];
      if (kind === 'horse') return;
      if ((kind === 'wolf' || kind === 'bear' || kind === 'frostwolf') && !night && Math.random() < 0.5) kind = 'rabbit';
      if (kind === 'dog') kind = 'rabbit';
      const pos = offscreenSpot(p, 230, 360);
      if (pos) {
        const n = kind === 'wolf' || kind === 'frostwolf' ? 2 + Math.floor(Math.random() * 2) : kind === 'deer' ? 1 + Math.floor(Math.random() * 3) : 1;
        for (let i = 0; i < n; i++) { const c = new Creature(pos[0] + i * 14, pos[1] + (i % 2) * 10, kind); c.mapId = 'world'; c.ambient = true; G.entities.push(c); }
      }
    }
  }
  if (birdT <= 0) {
    birdT = 6 + Math.random() * 8;
    if (reg !== 4 && G.hour > 5 && G.hour < 20) {
      const pos = offscreenSpot(p, 120, 200, true);
      if (pos) { const col = reg === 5 ? '#e8e8e8' : reg === 3 || reg === 7 ? '#2a2a30' : ['#6a4a30', '#4a3a30', '#8a6a4a'][Math.floor(Math.random() * 3)]; for (let i = 0; i < 2 + Math.floor(Math.random() * 4); i++) { const b = new Bird(pos[0] + (Math.random() - 0.5) * 30, pos[1] + (Math.random() - 0.5) * 20, col); b.mapId = 'world'; G.entities.push(b); } }
    }
  }
  if (fishT <= 0) {
    fishT = 2 + Math.random() * 3;
    for (let i = 0; i < 6; i++) {
      const x = p.x + (Math.random() - 0.5) * G.view.w, y = p.y + (Math.random() - 0.5) * G.view.h;
      const t = G.world.tileAtPx(x, y);
      if (t === T.WATER || t === T.DEEP) { const f = new FishJump(x, y); f.mapId = 'world'; G.entities.push(f); break; }
    }
  }
  if (eventT <= 0) { eventT = 80 + Math.random() * 120; randomEvent(p, reg); }
  if (patrolT <= 0) { patrolT = 45 + Math.random() * 40; spawnPatrol(p); }
  outposts(dt);
  occupation();
}
function offscreenSpot(p, rmin, rmax, any = false) {
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2, d = rmin + Math.random() * (rmax - rmin);
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (!G.world.walkable(tx, ty)) continue;
    const t = G.world.get(tx, ty); if (t === T.ROAD || t === T.PLAZA) continue;
    if (!any) { let nearV = false; for (const v of Object.values(VILLAGES)) if (Math.hypot(tx - v.x, ty - v.y) < v.r + 6) nearV = true; if (nearV) continue; }
    if (G.world.collides(x - 6, y - 6, 12, 6)) continue;
    return [x, y];
  }
  return null;
}

// ---------- eventos aleatórios ----------
function randomEvent(p, reg) {
  if (G.mode !== 'play' || G.flags.noEvents) return;
  const night = G.hour < 6 || G.hour > 20;
  const roll = Math.random();
  const danger = REGIONS[reg].danger;
  if (roll < 0.3) {
    const pos = offscreenSpot(p, 200, 260); if (!pos) return;
    const type = REGIONS[reg].enemies[0] === 'smuggler' ? 'smuggler' : REGIONS[reg].enemies.includes('cultist') ? 'cultist' : 'bandit';
    const n = 1 + Math.floor(Math.random() * (1 + danger));
    for (let i = 0; i < n; i++) { const e = spawnEnemy(i === 0 && n > 2 ? 'bandit_archer' : type, pos[0] + i * 14, pos[1], 'world', { tag: 'event' }); e.ambient = true; e.target = p; }
    emit('toast', 'ev_ambush');
  } else if (roll < 0.45 && night) {
    const pos = offscreenSpot(p, 200, 260); if (!pos) return;
    const kind = reg === 6 ? 'frostwolf' : 'wolf';
    for (let i = 0; i < 3; i++) { const c = new Creature(pos[0] + i * 12, pos[1] + (i % 2) * 8, kind); c.mapId = 'world'; c.ambient = true; c.target = p; G.entities.push(c); }
    audio.sfx('howl', null, 0.8); emit('toast', 'ev_wolves');
  } else if (roll < 0.6) {
    const pos = offscreenSpot(p, 90, 140, true); if (!pos) return;
    const a = new Actor(pos[0], pos[1], { look: randomVillagerLook(['varden', 'solaria', 'eldoria'][Math.floor(Math.random() * 3)]), hp: 20, team: 'N', ai: 'npc', speed: 30, name: '' });
    a.mapId = 'world'; a.ambient = true; a.traveler = true; a.hp = 8; a.sitting = true; a.showEmote('sweat', 30); G.entities.push(a);
    emit('toast', 'ev_traveler');
  } else if (roll < 0.72) {
    const pos = offscreenSpot(p, 120, 180, true); if (!pos) return;
    const a = new Actor(pos[0], pos[1], { look: NPCS.zeca.look, hp: 50, team: 'N', ai: 'npc', speed: 30, name: 'Zeca', voice: NPCS.zeca.voice });
    a.mapId = 'world'; a.ambient = true; a.shopId = 'zeca'; a.wanderR = 30; a.npcId = null; a.merchantEvent = true; G.entities.push(a);
    const c = new Creature(pos[0] + 22, pos[1], 'goat'); c.mapId = 'world'; c.ambient = true; c.owner = a; G.entities.push(c);
    emit('toast', 'ev_merchant');
  } else if (roll < 0.82 && G.chapter >= 3) {
    // caravana atacada
    const pos = offscreenSpot(p, 180, 240); if (!pos) return;
    for (let i = 0; i < 2; i++) { const a = new Actor(pos[0] + i * 16, pos[1], { look: randomVillagerLook('solaria'), hp: 40, team: 'P', ai: 'npc', speed: 40, name: '' }); a.mapId = 'world'; a.ambient = true; a.caravan = true; G.entities.push(a); }
    for (let i = 0; i < 3; i++) { const e = spawnEnemy('bandit', pos[0] + 30 + i * 12, pos[1] + 20, 'world', { tag: 'caravan_raid' }); e.ambient = true; }
    G.world.addObject(obj('cart', pos[0] - 20, pos[1] - 4, propSprite('cart', '', 0), { ambientObj: true }));
    emit('toast', 'ev_caravan');
  } else if (night && roll < 0.9) {
    emit('meteor');
  } else if (G.chapter >= 3 && !G.flags.restored) {
    const pos = offscreenSpot(p, 100, 160, true); if (!pos) return;
    const a = new Actor(pos[0], pos[1], { look: { ...ENEMY_TYPES.soldier_drakmor.look, helm: null, hair: '#4a2e1a' }, hp: 30, team: 'N', ai: 'npc', speed: 40, name: '' });
    a.mapId = 'world'; a.ambient = true; a.deserter = true; a.showEmote('?', 20); G.entities.push(a);
    emit('toast', 'ev_deserter');
  }
}
function spawnPatrol(p) {
  if (G.mode !== 'play') return;
  const tr = territoryAt(p.x, p.y); if (!tr || !tr.owner) return;
  const fac = tr.owner; if (fac === 'varden' && G.phase === 'fall') return;
  const pos = offscreenSpot(p, 220, 300); if (!pos) return;
  const hostileF = atWar(fac, 'varden');
  const col = FACTIONS[fac].color;
  for (let i = 0; i < 2; i++) {
    let a;
    if (fac === 'drakmor' && hostileF) a = spawnEnemy(i ? 'archer_drakmor' : 'soldier_drakmor', pos[0] + i * 14, pos[1], 'world', { tag: 'patrol' });
    else { a = new Actor(pos[0] + i * 14, pos[1], { look: { skin: SKINS[i + 2], hair: HAIRS[i + 1], helm: '#7a7a86', tabard: col, top: FACTIONS[fac].dark }, hp: 60, team: hostileF ? 'E' : fac === 'varden' ? 'P' : 'N', ai: hostileF ? 'enemy' : 'npc', speed: 46, weapon: 'w_guard_spear', name: '' }); a.mapId = 'world'; G.entities.push(a); a.patrolTo = [p.x + (Math.random() - 0.5) * 400, p.y + (Math.random() - 0.5) * 300]; a.goal = { x: a.patrolTo[0], y: a.patrolTo[1] }; }
    a.ambient = true;
  }
}

// ---------- territórios e postos ----------
export function territoryAt(px, py) {
  const tx = px / TILE, ty = py / TILE;
  let best = null, bd = 1e9;
  for (const t of TERRITORIES) { const d = (t.x - tx) ** 2 + (t.y - ty) ** 2; if (d < bd) { bd = d; best = t; } }
  return best ? Object.assign(best, { owner: G.territory[best.id] ?? best.owner }) : null;
}
export function owner(tid) { return G.territory[tid] !== undefined ? G.territory[tid] : TERRITORIES.find((t) => t.id === tid).orig; }
const garrisons = {};
function outposts() {
  const p = G.player;
  for (const tr of TERRITORIES) {
    if (tr.id.endsWith('_capital')) continue;
    const mk = G.world.markers['out_' + tr.id]; if (!mk) continue;
    const d = dist(p.x, p.y, mk[0], mk[1]);
    const own = owner(tr.id);
    if (d < 260 && own && own !== 'varden' && atWar(own, 'varden') && !garrisons[tr.id] && (G.garrisonDead?.[tr.id] ?? -1) < G.day) {
      const types = own === 'drakmor' ? ['soldier_drakmor', 'archer_drakmor', 'soldier_drakmor', 'knight_drakmor'] : own === 'ravencross' ? ['cultist', 'cultist', 'raven_agent'] : ['mercenary', 'mercenary', 'bandit_archer'];
      const n = 2 + tr.imp;
      garrisons[tr.id] = [];
      for (let i = 0; i < n; i++) { const e = spawnEnemy(types[i % types.length], mk[0] + (i - n / 2) * 18, mk[1] + 24 + (i % 2) * 10, 'world', { tag: 'gar_' + tr.id, wanderR: 30 }); e.garrison = tr.id; garrisons[tr.id].push(e); }
    }
    if (garrisons[tr.id] && d > 700) { for (const e of garrisons[tr.id]) e.removed = true; delete garrisons[tr.id]; }
  }
}
export function garrisonAlive(tid) {
  const g = garrisons[tid]; if (!g) { const own = owner(tid); return own && own !== 'varden' && atWar(own, 'varden') && (G.garrisonDead?.[tid] ?? -1) < G.day; }
  const alive = g.filter((e) => !e.dead && !e.removed);
  if (!alive.length) { G.garrisonDead = G.garrisonDead || {}; G.garrisonDead[tid] = G.day; }
  return alive.length > 0;
}
export function canCapture(tid) {
  const own = owner(tid);
  if (own === 'varden') return { ok: false, reason: 'cap_ours' };
  if (!own) return { ok: false, reason: 'cap_neutral' };
  if (!atWar(own, 'varden')) return { ok: false, reason: 'cap_peace' };
  if (garrisonAlive(tid)) return { ok: false, reason: 'cap_garrison' };
  return { ok: true };
}

// ocupação de Várden por Drakmor
let occSpawned = false;
function occupation() {
  const occupied = G.flags.fallen && !G.flags.restored;
  const p = G.player;
  const v = VILLAGES.varden;
  const d = dist(p.x, p.y, v.x * TILE, v.y * TILE);
  if (occupied && d < 420 && !occSpawned && !G.flags.liberating) {
    occSpawned = true;
    const pts = [[-4, 2], [4, 2], [0, -4], [-8, -2], [8, -2], [0, 8]];
    pts.forEach(([dx, dy], i) => { const e = spawnEnemy(i % 3 === 2 ? 'archer_drakmor' : 'soldier_drakmor', (v.x + dx) * TILE, (v.y + dy) * TILE, 'world', { tag: 'occupier', wanderR: 40 }); e.occupier = true; });
  }
  if (occSpawned && d > 900) { for (const e of G.entities) if (e.occupier) e.removed = true; occSpawned = false; }
}
export function resetOccupation() { for (const e of G.entities) if (e.occupier) e.removed = true; occSpawned = false; }

// visibilidade de objetos dependentes do estado (refúgio, casas queimadas)
export function refreshWorldState() {
  const w = G.world; if (!w) return;
  const refuge = G.phase === 'fall' || G.flags.refugeKept;
  for (const o of w.objects) {
    if (o.refugeOnly) o.hidden = !refuge;
    if (o.kind === 'building' && o.style === 'varden' && o.btype !== 'hall') o.spr = buildingSprite('varden', o.btype, o.variant || 0, G.flags.fallen && !G.flags.rebuilt);
  }
  refreshVillagerState();
}
