// Executor de ações de roteiro (usado por diálogos, missões e cenas).
import { G } from '../state.js';
import { emit } from '../core/events.js';
import { audio } from '../core/audio.js';
import * as inv from './inventory.js';
import { setOwner, setRelation, relation, addRep } from './war.js';
import { spawnEnemy, brotherhoodSoldier, npcEntity, placeNPC, changeMap, markerPos, getMap, refreshWorldState, resetOccupation, randomVillagerLook } from './world.js';
import { Actor } from '../entities/actor.js';
import { Creature, Horse } from '../entities/creature.js';
import { obj } from '../world/gen.js';
import { propSprite } from '../gfx/objects.js';
import { NPCS } from '../data/npcs.js';
import { startQuest } from './quests.js';
import { startCutscene } from './cutscene.js';
import { startDialogue } from './dialogue.js';
import { skipHours } from './time.js';
import { unlockAchievement } from './achievements.js';

export function runActions(list, ctx = {}) {
  if (!list) return;
  if (!Array.isArray(list)) list = [list];
  for (const a of list) runAction(a, ctx);
}

function spreadPos(x, y, i, n, spread) { if (n <= 1) return [x, y]; const ang = (i / n) * Math.PI * 2; return [x + Math.cos(ang) * spread, y + Math.sin(ang) * spread * 0.7]; }

export function runAction(a, ctx) {
  for (const [k, v] of Object.entries(a)) {
    switch (k) {
      case 'give': { const n = a.n || 1; if (v === 'gold') inv.addGold(n); else inv.add(v, n); break; }
      case 'take': inv.remove(v, a.n || 1); break;
      case 'gold': inv.addGold(v); break;
      case 'xp': G.player.gainXp(v); break;
      case 'flag': for (const f of [].concat(v)) G.flags[f] = true; emit('flagsChanged'); break;
      case 'unflag': for (const f of [].concat(v)) delete G.flags[f]; emit('flagsChanged'); break;
      case 'spawn': for (const s of [].concat(v)) spawnFromDef(s); break;
      case 'despawn': for (const e of G.entities) if (e.tag === v) e.removed = true; for (const m of Object.values(G.maps)) for (const o of [...m.objects]) if (o.qtag === v) m.removeObject(o); break;
      case 'prop': for (const s of [].concat(v)) spawnProp(s); break;
      case 'npcAt': { const [id, map, at, dx = 0, dy = 0] = v; G.npcOverride[id] = at === 'hidden' ? 'hidden' : [map, at, dx, dy]; const e = npcEntity(id); if (e) placeNPC(e, a.instant !== false); break; }
      case 'npcHome': for (const id of [].concat(v)) { delete G.npcOverride[id]; const e = npcEntity(id); if (e) placeNPC(e, true); } break;
      case 'npcWalk': { const [id, map, at, dx = 0, dy = 0] = v; G.npcOverride[id] = [map, at, dx, dy]; const e = npcEntity(id); if (e) { const [x, y] = markerPos(map, at); if (e.mapId === map) { e.goal = { x: x + dx, y: y + dy }; e.home = { x: x + dx, y: y + dy }; } else placeNPC(e, true); } break; }
      case 'follow': { const e = npcEntity(v); if (e) { e.ai = 'follower'; e.team = 'P'; e.teleportNear(G.player); G.flags['follow_' + v] = true; } break; }
      case 'unfollow': { const e = npcEntity(v); if (e) { e.ai = 'npc'; e.team = 'N'; e.target = null; delete G.flags['follow_' + v]; placeNPC(e, true); } break; }
      case 'territory': for (const [tid, own] of Object.entries(v)) setOwner(tid, own, !!a.silent); break;
      case 'relation': for (const [pair, val] of Object.entries(v)) { const [x, y] = pair.split('-'); setRelation(x, y, val); } break;
      case 'relAdd': for (const [pair, val] of Object.entries(v)) { const [x, y] = pair.split('-'); setRelation(x, y, relation(x, y) + val); } break;
      case 'rep': for (const [f, val] of Object.entries(v)) addRep(f, val); break;
      case 'music': G.musicOverride = v; audio.setTheme(v); break;
      case 'musicClear': G.musicOverride = null; break;
      case 'sfx': audio.sfx(v); break;
      case 'quest': startQuest(v); break;
      case 'cutscene': startCutscene(v); break;
      case 'dialogue': startDialogue(v, ctx.npc || null); break;
      case 'teleport': { const [map, at] = v; changeMap(map, at); break; }
      case 'phase': G.phase = v; refreshWorldState(); emit('phaseChanged', v); break;
      case 'chapter': G.chapter = v; emit('chapter', v); break;
      case 'time': { const target = v; let d = target - G.hour; if (d < 0) d += 24; skipHours(d); break; }
      case 'weather': G.weatherForce = v === 'clear' ? null : v === 'storm' ? { rain: 1, storm: 1, wind: 0.9, fog: 0.1 } : v === 'rain' ? { rain: 0.8, wind: 0.4 } : v === 'fog' ? { fog: 0.8 } : null; break;
      case 'horse': { const h = new Horse(G.player.x + 24, G.player.y, v, { owned: true }); h.mapId = G.player.mapId; G.entities.push(h); G.activeHorse = h; G.horses.push(v); emit('horseGained', v); break; }
      case 'achievement': unlockAchievement(v); break;
      case 'toast': emit('toast', v); break;
      case 'unlock': G.flags['unlock_' + v] = true; emit('toast', 'unlock_' + v); break;
      case 'heal': G.player.hp = G.player.maxHp; G.player.stam = G.player.maxStam; break;
      case 'refresh': refreshWorldState(); break;
      case 'resetOccupation': resetOccupation(); break;
      case 'ending': G.ending = v; break;
      case 'shake': G.cam.shake = v; break;
      case 'save': emit('autosave'); break;
      case 'removeHeart': { const m = getMap('int_varden_hall'); for (const o of [...m.objects]) if (o.heartRelic) m.removeObject(o); break; }
      case 'restoreHeart': { const m = getMap('int_varden_hall'); if (!m.objects.some((o) => o.heartRelic)) { const [x, y] = m.markers.pedestal; const h = m.addObject(obj('heart', x, y - 20, propSprite('heart', '#b050ff'), { heartRelic: true, light: { r: 36, color: '#b050ff' }, passable: true })); } break; }
      case 'emote': { const [id, kind] = v; const e = id === 'player' ? G.player : npcEntity(id); if (e) e.showEmote(kind, 2); break; }
      case 'face': { const [id, tid] = v; const e = id === 'player' ? G.player : npcEntity(id); const t = tid === 'player' ? G.player : npcEntity(tid); if (e && t) e.face(t.x, t.y); break; }
      case 'killTag': for (const e of G.entities) if (e.tag === v && !e.dead && e.die) e.die(null); break;
      case 'notify': emit('toast', v); break;
      case 'garrisonClear': G.garrisonDead = {}; break;
      case 'openShop': emit('openShop', v); break;
      case 'openSmith': emit('openSmith'); break;
      case 'openStable': emit('openStable'); break;
      case 'rest': { const d = (7 - G.hour + 24) % 24 || 24; skipHours(d); G.player.hp = G.player.maxHp; G.player.stam = G.player.maxStam; emit('rested'); emit('autosave'); break; }
      case 'giveTraveler': { inv.remove('potion', 1); inv.addGold(25 + Math.floor(Math.random() * 20)); addRep('varden', 3); if (ctx.npc) { ctx.npc.sitting = false; ctx.npc.emote = 'heart'; ctx.npc.emoteT = 2; ctx.npc.traveler = false; ctx.npc.wanderR = 40; } break; }
      case 'npcDone': if (ctx.npc) { ctx.npc.traveler = false; ctx.npc.deserter = false; ctx.npc.questVillager = null; ctx.npc.goal = { x: ctx.npc.x + 300, y: ctx.npc.y + 100 }; } break;
      case 'n': case 'silent': case 'instant': break;
      default: console.warn('ação desconhecida', k);
    }
  }
}

// def: { e:'bandit'|'ally'|'animal:wolf'|'villager'|'npc', at, map, n, spread, tag, boss, hpMul, team }
export function spawnFromDef(s) {
  const map = s.map || 'world';
  getMap(map);
  const [x0, y0] = Array.isArray(s.at) ? s.at : markerPos(map, s.at);
  const n = s.n || 1, spread = s.spread ?? 22;
  const out = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = spreadPos(x0 + (s.dx || 0), y0 + (s.dy || 0), i, n, spread);
    let e;
    if (s.e === 'ally') e = brotherhoodSoldier(x, y, map, s.tag);
    else if (s.e.startsWith('animal:')) { e = new Creature(x, y, s.e.slice(7), { tag: s.tag, hostile: s.hostile, hpMul: s.hpMul }); e.mapId = map; e.tag = s.tag; G.entities.push(e); }
    else if (s.e === 'villager') { e = new Actor(x, y, { look: randomVillagerLook(s.faction || 'varden'), hp: 30, team: s.team || 'N', ai: 'npc', speed: 34, name: '' }); e.mapId = map; e.tag = s.tag; e.wanderR = s.wander ?? 20; e.questVillager = s.line || null; G.entities.push(e); }
    else if (s.e === 'horse') { e = new Horse(x, y, s.coat || 'brown'); e.mapId = map; e.tag = s.tag; e.wild = true; if (s.legendary) e.legendary = true; G.entities.push(e); }
    else e = spawnEnemy(s.e, x, y, map, { tag: s.tag, team: s.team, hpMul: s.hpMul, wanderR: s.wander ?? 30, name: s.name });
    if (s.aggro && G.player) e.target = G.player;
    if (s.catch) { e.catchId = s.catch; e.huntable = false; }
    if (s.look) e.setLook(s.look);
    out.push(e);
  }
  return out;
}

// objetos interativos de missão: { id, kind, at, map, label, once, dx, dy }
export function spawnProp(s) {
  const map = getMap(s.map || 'world');
  const [x, y] = Array.isArray(s.at) ? s.at : markerPos(s.map || 'world', s.at);
  const kindSpr = { tracks: 'tracks', paws: 'pawprints', feather: 'feather', scroll: 'scroll', chest: 'chest', debris: 'debris', ram: 'ram', catapult: 'catapult', cart: 'cart', bell: 'bell', relic: 'tablet', offering: 'shrine', crate: 'crate', tome: 'scroll', heart: 'heart', campfire: 'campfire', grave: 'grave', pot: 'pot', wisp: 'wisp', tablet: 'tablet', bones: 'bones' }[s.kind] || s.kind;
  const spr = propSprite(kindSpr, s.color || (s.kind === 'chest' ? 'gold' : ''), s.kind === 'cart' ? 1 : 0);
  const o = map.addObject(obj('qprop', x + (s.dx || 0), y + (s.dy || 0), spr, { qid: s.id, qtag: s.tag || s.id, label: s.label || 'lbl_examine', once: s.once !== false, passable: s.solid ? false : true, glint: true, give: s.give || null, dlg: s.dlg || null }));
  if (s.kind === 'ram' || s.kind === 'catapult' || s.kind === 'cart') o.box = spr.box;
  return o;
}
