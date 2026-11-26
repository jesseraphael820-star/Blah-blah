// Interações do jogador: conversar, portas, baús, coleta, alavancas, captura de postos, pesca, montaria.
import { G } from '../state.js';
import { dist, TILE, hashStr } from '../core/util.js';
import { audio } from '../core/audio.js';
import { emit } from '../core/events.js';
import { t, loc } from '../core/i18n.js';
import * as inv from './inventory.js';
import { enterDoor, exitInterior, dismount, canCapture, owner, refreshChestSprites, npcEntity } from './world.js';
import { questDialogueFor, sideOfferFor } from './quests.js';
import { startDialogue } from './dialogue.js';
import { setOwner } from './war.js';
import { propSprite, plantSprite, rockSprite } from '../gfx/objects.js';
import { NPCS } from '../data/npcs.js';
import { idleLine, villagerLine } from '../data/idle.js';
import { DLG } from '../data/dialogue.js';
import { skipHours } from './time.js';
import { TERRITORIES } from '../data/world.js';
import { T } from '../gfx/tiles.js';
import { ITEMS } from '../data/items.js';

export function updateInteract() {
  const p = G.player; G.interactTarget = null;
  if (!p || G.mode !== 'play' || p.dead) return;
  const m = G.map;
  // saída automática de interiores
  if (m.interior && m.exitDoor && p.y > m.exitDoor.y - 6 && Math.abs(p.x - m.exitDoor.x) < 14) { exitInterior(); return; }
  if (p.mount) { G.interactTarget = { kind: 'dismount', label: 'act_dismount' }; return; }
  const fx = p.x + [0, -8, 8, 0][p.dir], fy = p.y - 4 + [8, 0, 0, -10][p.dir];
  let best = null, bd = 26;
  const consider = (kind, target, x, y, label, r = 26) => { const d = dist(fx, fy, x, y); if (d < Math.min(bd, r)) { bd = d; best = { kind, target, label, x, y }; } };
  for (const e of G.entities) {
    if (e.mapId !== p.mapId || e.dead || e.removed || e === p) continue;
    if (e.catchId) { consider('catch', e, e.x, e.y - 4, 'act_catch', 24); continue; }
    if (e.isHorse) { if (e.owned) consider('mount', e, e.x, e.y - 6, 'act_mount', 24); else consider('tame', e, e.x, e.y - 6, 'act_tame', 24); continue; }
    if (e.team === 'E' || e.team === 'W' || e.ai === 'enemy') continue;
    if (e.npcId || e.villager || e.traveler || e.deserter || e.merchantEvent || e.questVillager || e.guard || e.caravan || (e.ai === 'ally' && G.phase === 'fall')) consider('talk', e, e.x, e.y - 8, 'act_talk');
  }
  if (!m.interior) for (const d of m.doors) consider('door', d, d.x, d.y - 2, d.cave ? 'act_enter_cave' : 'act_enter', 22);
  for (const o of m.objectsIn(p.x - 40, p.y - 40, p.x + 40, p.y + 40)) {
    if (o.removed || o.hidden) continue;
    if (o.kind === 'chest' && !G.opened[o.cid]) consider('chest', o, o.x, o.y - 4, 'act_open');
    else if (o.kind === 'gather' && !depleted(o)) consider('gather', o, o.x, o.y - 4, 'act_gather_' + o.res);
    else if (o.kind === 'lever') consider('lever', o, o.x, o.y - 4, 'act_lever');
    else if (o.isFlag) consider('flag', o, o.x, o.y - 6, 'act_capture', 30);
    else if (o.kind === 'qprop') consider('qprop', o, o.x, o.y - 4, o.label, 28);
    else if (o.kind === 'bed') consider('bed', o, o.x, o.y - 10, 'act_rest');
    else if (o.kind === 'sign' || o.kind === 'mural' || o.kind === 'shrine' || o.kind === 'statue' || o.kind === 'tablet') consider('read', o, o.x, o.y - 6, 'act_read');
    else if (o.kind === 'well') consider('well', o, o.x, o.y - 4, 'act_drink');
  }
  // pesca: água à frente
  if (!best && !m.interior) {
    const tx = Math.floor((p.x + [0, -18, 18, 0][p.dir]) / TILE), ty = Math.floor((p.y + [18, 0, 0, -18][p.dir]) / TILE);
    const tt = m.get(tx, ty);
    if ((tt === T.WATER || tt === T.DEEP) && inv.count('fishing_rod')) best = { kind: 'fish', label: 'act_fish', x: tx * TILE + 8, y: ty * TILE + 8 };
  }
  G.interactTarget = best;
  // entrar em portas andando para cima
  if (best && best.kind === 'door' && p.dir === 3 && p.moving && bd < 12) doInteract(best);
}
function depleted(o) { const k = gKey(o); const d = G.gathered[k]; return d != null && G.day - d < 3; }
const gKey = (o) => `${o.map ? o.map.id : 'w'}:${Math.round(o.x)}:${Math.round(o.y)}`;

export function doInteract(it) {
  if (!it) return;
  const p = G.player;
  switch (it.kind) {
    case 'dismount': dismount(); break;
    case 'mount': { const h = it.target; if (p.state !== 'idle' && p.state !== 'walk') return; p.mount = h; h.rider = p; h.called = false; G.activeHorse = h; audio.sfx('neigh', h); emit('mounted'); break; }
    case 'tame': return tame(it.target);
    case 'door': enterDoor(it.target); break;
    case 'talk': return talkTo(it.target);
    case 'chest': return openChest(it.target);
    case 'catch': { const c = it.target; audio.sfx(c.D.sfx || 'pickup', c); G.particles.burst(c.x, c.y - 6, 10, '#ffffff', 50, 0.5); c.removed = true; emit('questInteract', c.catchId); emit('toast', 'tst_caught'); break; }
    case 'gather': return gather(it.target);
    case 'lever': return pullLever(it.target);
    case 'flag': return startCapture(it.target);
    case 'qprop': {
      const o = it.target; audio.sfx('pickup'); G.particles.burst(o.x, o.y - 6, 10, '#ffe080', 50, 0.5, { grav: -30 });
      if (o.give) inv.add(o.give, 1);
      emit('questInteract', o.qid);
      if (o.once) o.map.removeObject(o);
      if (o.dlg) startDialogue(o.dlg);
      break;
    }
    case 'bed': startDialogue('sys_rest'); break;
    case 'read': {
      const o = it.target;
      if (o.kind === 'mural') startDialogue(G.quests.m23 ? 'mural_seven' : 'read_mural');
      else if (o.kind === 'shrine') startDialogue('read_shrine');
      else if (o.kind === 'statue') startDialogue('read_statue');
      else startDialogue('read_sign');
      break;
    }
    case 'well': p.hp = Math.min(p.maxHp, p.hp + 10); audio.sfx('drink'); emit('toast', 'tst_refreshed'); break;
    case 'fish': return startFishing();
  }
}

function talkTo(e) {
  if (e.npcId) {
    G.metNpcs[e.npcId] = true;
    const q = questDialogueFor(e.npcId);
    if (q) return startDialogue(q, e);
    const offer = sideOfferFor(e.npcId);
    if (offer) return startDialogue(offer, e);
    const d = NPCS[e.npcId];
    const shopId = G.phase === 'fall' && d.fallShop ? d.fallShop : d.shop;
    const lines = idleLine(e.npcId, G.phase, G.chapter);
    return startDynamic(e, lines, shopId, d.smith, d.stable);
  }
  if (e.merchantEvent) return startDynamic(e, [[null, 'happy', t('zeca_hello')]], 'zeca');
  if (e.traveler) return startDialogue(inv.count('potion') ? 'ev_traveler' : 'ev_traveler_nopotion', e);
  if (e.deserter) return startDialogue('ev_deserter', e);
  if (e.caravan) return startDynamic(e, [[null, 'happy', villagerLine('caravan', G.phase, e.id)]]);
  if (e.questVillager) return startDialogue(e.questVillager, e);
  if (e.guard) return startDynamic(e, [[null, 'neutral', villagerLine('guard_' + e.vfaction, G.phase, e.id)]]);
  if (e.ai === 'ally') return startDynamic(e, [[null, 'sad', villagerLine('survivor', G.phase, e.id)]]);
  return startDynamic(e, [[null, e.lineSeed % 3 === 0 ? 'happy' : 'neutral', villagerLine(e.vfaction || 'varden', G.phase, e.id)]]);
}
// diálogo dinâmico (falas ociosas + serviços)
function startDynamic(e, lines, shopId, smith, stable) {
  const sp = e.npcId || 'villager';
  const L = lines.map(([s, ex, text]) => [s || sp, ex || 'neutral', text]);
  const choices = [];
  if (shopId) choices.push([t('svc_trade'), null, { openShop: shopId }]);
  if (smith) choices.push([t('svc_upgrade'), null, { openSmith: true }]);
  if (stable) choices.push([t('svc_stable'), null, { openStable: true }]);
  if (choices.length) { choices.push([t('svc_bye'), null, null]); L.push(['>', choices]); }
  DLG.__dyn = L;
  startDialogue('__dyn', e);
}

function openChest(o) {
  G.opened[o.cid] = true; G.stats.chests++;
  audio.sfx('chest');
  G.particles.burst(o.x, o.y - 8, 16, '#ffe080', 60, 0.8, { grav: -20 });
  if (o.gold) inv.addGold(o.gold);
  for (const [id, n] of o.loot) inv.add(id, n);
  refreshChestSprites();
  emit('chestOpened', o);
}
function gather(o) {
  const res = o.res;
  const map = { herb: ['herb', 1, 'pickup'], mushroom: ['mushroom', 1, 'pickup'], ore: ['ore', 1 + (Math.random() < 0.3 ? 1 : 0), 'mine'], wood: ['wood', 2, 'chop'], gem: ['gem', 1, 'mine'] }[res];
  if (!map) return;
  const [id, n, s] = map;
  if (res === 'ore' || res === 'gem') { G.player.state = 'attack'; G.player.stateT = 0; G.player.atkDur = 0.3; G.player.hitDone = true; G.player.atkAngle = G.player.facingAngle(); }
  audio.sfx(s); G.particles.burst(o.x, o.y - 6, 8, res === 'ore' ? '#a09080' : res === 'wood' ? '#8a6a3a' : '#6ac040', 50, 0.5);
  inv.add(id, n); G.stats.gathered++;
  G.gathered[gKey(o)] = G.day;
  o.hidden = true;
  emit('gathered', id);
}
export function refreshGatherables() {
  for (const m of Object.values(G.maps)) for (const o of m.objects) if (o.kind === 'gather') o.hidden = depleted(o);
}
function pullLever(o) {
  const on = !G.flags[o.lever];
  if (on) G.flags[o.lever] = true; else delete G.flags[o.lever];
  o.spr = propSprite('lever', '', on ? 1 : 0);
  audio.sfx('lever');
  if (G.flags.lever1 && G.flags.lever2 && G.flags.lever3 && !G.flags.tomb_gate_open) {
    G.flags.tomb_gate_open = true;
    for (const ob of [...o.map.objects]) if (ob.gate === 'tomb_gate') o.map.removeObject(ob);
    audio.sfx('rumble'); G.cam.shake = 4; emit('toast', 'tst_gate_open');
  }
  emit('flagsChanged');
}
export function applyLeverState(m) {
  for (const o of m.objects) if (o.kind === 'lever') o.spr = propSprite('lever', '', G.flags[o.lever] ? 1 : 0);
  if (G.flags.tomb_gate_open) for (const ob of [...m.objects]) if (ob.gate === 'tomb_gate') m.removeObject(ob);
}

// captura de postos (segurar a tecla de interação)
function startCapture(o) {
  const tid = o.territory;
  const c = canCapture(tid);
  if (!c.ok) { audio.sfx('error'); emit('toast', c.reason); return; }
  G.capture = { tid, t: 0, o };
}
export function updateCapture(dt, holding) {
  const C = G.capture; if (!C) return;
  const p = G.player;
  if (!holding || dist(p.x, p.y, C.o.x, C.o.y) > 40 || G.mode !== 'play') { G.capture = null; return; }
  C.t += dt;
  if (Math.random() < 0.3) G.particles.add({ x: C.o.x + (Math.random() - 0.5) * 20, y: C.o.y - Math.random() * 30, vy: -20, life: 0.6, color: '#b88ad8', size: 1 });
  if (C.t >= 2.5) {
    G.capture = null;
    setOwner(C.tid, 'varden');
    G.stats.captures++;
    audio.sfx('capture');
    G.particles.burst(C.o.x, C.o.y - 20, 30, '#b88ad8', 80, 1, { grav: -20 });
    emit('capture', C.tid);
  }
}

// pesca
function startFishing() { G.fishing = { t: 0, bite: 1.2 + Math.random() * 2.5, hooked: false, done: false }; audio.sfx('splash'); G.player.state = 'idle'; }
export function updateFishing(dt, pressed) {
  const F = G.fishing; if (!F) return;
  F.t += dt;
  if (!F.hooked && F.t >= F.bite) { F.hooked = true; F.hookT = F.t; audio.sfx('fish'); G.player.showEmote('!', 0.7); }
  if (pressed) {
    if (F.hooked && F.t - F.hookT < 0.75) { inv.add('fish', 1); G.stats.fish++; emit('fished'); emit('toast', 'tst_fish'); audio.sfx('pickup'); }
    else emit('toast', 'tst_fish_miss');
    G.fishing = null; return;
  }
  if (F.hooked && F.t - F.hookT > 0.9) { emit('toast', 'tst_fish_miss'); G.fishing = null; }
  const [ax, ay] = [0, 0];
  if (G.player.moving) G.fishing = null;
}

// domar cavalos
function tame(h) {
  if (h.legendary && !G.flags.nevoa_trust) { audio.sfx('neigh', h); emit('toast', 'tst_nevoa_refuse'); return; }
  if (!inv.count('apple')) { emit('toast', 'tst_need_apple'); audio.sfx('error'); return; }
  inv.remove('apple', 1); audio.sfx('eat', h);
  if (h.legendary || Math.random() < 0.7) {
    h.setOwned(true); h.wild = false; h.tag = null;
    if (G.activeHorse && G.activeHorse !== h) { G.activeHorse.removed = true; }
    G.activeHorse = h; if (!G.horses.includes(h.coat)) G.horses.push(h.coat);
    audio.sfx('neigh', h); emit('toast', 'tst_tamed'); emit('horseGained', h.coat);
    if (h.legendary) emit('legendHorse');
  } else { h.calm = false; audio.sfx('snort', h); emit('toast', 'tst_tame_fail'); }
}
