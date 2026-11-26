// Motor de missões: estágios, objetivos (falar, ir, derrotar, coletar, interagir, capturar, flag),
// recompensas, encadeamento da campanha e marcadores para o mapa/HUD.
import { G } from '../state.js';
import { on, emit } from '../core/events.js';
import { QUESTS } from '../data/quests.js';
import { runActions } from './actions.js';
import { count } from './inventory.js';
import * as inv from './inventory.js';
import { audio } from '../core/audio.js';
import { dist } from '../core/util.js';
import { markerPos, npcEntity } from './world.js';
import { t, loc } from '../core/i18n.js';
import { NPCS, npcName } from '../data/npcs.js';
import { getLang } from '../core/i18n.js';

export function questDef(id) { return QUESTS[id]; }
export function activeQuests() { return Object.entries(G.quests).filter(([, s]) => s.state === 'active').map(([id]) => id); }
export function isDone(id) { return G.quests[id] && G.quests[id].state === 'done'; }
export function isActive(id) { return G.quests[id] && G.quests[id].state === 'active'; }

export function startQuest(id) {
  const q = QUESTS[id];
  if (!q) { console.warn('missão inexistente', id); return; }
  if (G.quests[id]) return;
  G.quests[id] = { state: 'active', stage: 0, c: {}, started: G.day };
  if (q.ch && q.type === 'main') { if (q.ch !== G.chapter) { G.chapter = q.ch; emit('chapter', q.ch); } G.tracked = id; }
  else if (!G.tracked || !isActive(G.tracked)) G.tracked = id;
  audio.sfx('questStart');
  emit('questStarted', id);
  enterStage(id, 0);
}
function enterStage(id, idx) {
  const q = QUESTS[id], st = G.quests[id];
  st.stage = idx; st.c = {};
  const S = q.stages[idx];
  if (S.start) runActions(S.start);
  // objetivos de coleta podem já estar completos
  setTimeout(() => checkPolled(), 50);
  emit('questUpdated', id);
}
function completeStage(id) {
  const q = QUESTS[id], st = G.quests[id];
  if (!st || st.state !== 'active') return;
  const S = q.stages[st.stage];
  if (S.done) runActions(S.done);
  if (G.quests[id].state !== 'active') return;
  if (st.stage + 1 >= q.stages.length) completeQuest(id);
  else { audio.sfx('pickup'); enterStage(id, st.stage + 1); }
}
export function completeQuest(id) {
  const q = QUESTS[id], st = G.quests[id];
  st.state = 'done'; st.doneDay = G.day;
  const R = q.reward || {};
  if (R.gold) inv.addGold(R.gold);
  if (R.xp) G.player.gainXp(R.xp);
  if (R.items) for (const [it, n] of Object.entries(R.items)) inv.add(it, n);
  if (R.rep) for (const [f, v] of Object.entries(R.rep)) { G.rep[f] = Math.max(-100, Math.min(100, (G.rep[f] || 0) + v)); }
  audio.sfx('quest');
  emit('questDone', id);
  if (q.after) runActions(q.after);
  if (G.tracked === id) G.tracked = null;
  if (q.next) setTimeout(() => { if (!G.quests[q.next]) startQuest(q.next); }, q.nextDelay ?? 1500);
  if (!G.tracked) { const a = activeQuests(); G.tracked = a.find((x) => QUESTS[x].type === 'main') || a[0] || null; }
}

function objs(id) { const q = QUESTS[id], st = G.quests[id]; return q.stages[st.stage].obj || []; }
export function objDone(id, i) {
  const o = objs(id)[i], st = G.quests[id];
  switch (o.t) {
    case 'collect': return count(o.item) >= (o.n || 1);
    case 'flag': return !!G.flags[o.flag];
    default: return (st.c[i] || 0) >= (o.n || 1);
  }
}
function reqOk(id, o) { return !o.req || o.req.every((j) => objDone(id, j)); }
// missões secundárias oferecidas por um NPC
export function sideOfferFor(npcId) {
  for (const [id, q] of Object.entries(QUESTS)) {
    if (q.type !== 'side' || q.giver !== npcId || G.quests[id]) continue;
    const a = q.avail || {};
    if (a.done && !isDone(a.done)) continue;
    if (a.chapter && G.chapter < a.chapter) continue;
    if (a.notPhase && G.phase === a.notPhase) continue;
    if (G.flags.ending_chosen && !G.flags.gameComplete) continue;
    return q.offer;
  }
  return null;
}
export function hasOffer(npcId) { return !!sideOfferFor(npcId); }
function checkStage(id) {
  if (!isActive(id)) return;
  const os = objs(id);
  if (os.every((_, i) => objDone(id, i))) completeStage(id);
}
function bump(id, i, by = 1) { const st = G.quests[id]; st.c[i] = (st.c[i] || 0) + by; emit('questUpdated', id); checkStage(id); }

// ---------- eventos que avançam objetivos ----------
export function initQuestEvents() {
  on('dlgEnd', (dlgId, npcId) => {
    for (const id of activeQuests()) objs(id).forEach((o, i) => { if (o.t === 'talk' && (o.dlg === dlgId || (Array.isArray(o.dlg) && o.dlg.includes(dlgId))) && !objDone(id, i) && reqOk(id, o)) bump(id, i); });
  });
  on('death', (e, src) => {
    for (const id of activeQuests()) objs(id).forEach((o, i) => {
      if (o.t !== 'kill' || objDone(id, i)) return;
      if ((o.tag && e.tag === o.tag) || (o.kind && (e.kind === o.kind || e.etype === o.kind) && (!o.region || G.world.regionAtPx(e.x, e.y) === o.region) && src === G.player)) bump(id, i);
    });
  });
  on('questInteract', (pid) => { for (const id of activeQuests()) objs(id).forEach((o, i) => { if (o.t === 'interact' && o.id === pid && !objDone(id, i)) bump(id, i); }); });
  on('capture', () => { for (const id of activeQuests()) objs(id).forEach((o, i) => { if (o.t === 'capture' && !objDone(id, i)) bump(id, i); }); });
  on('dummyHit', () => { for (const id of activeQuests()) objs(id).forEach((o, i) => { if (o.t === 'dummy' && !objDone(id, i)) bump(id, i); }); });
  on('parry', () => { for (const id of activeQuests()) objs(id).forEach((o, i) => { if (o.t === 'parry' && !objDone(id, i)) bump(id, i); }); });
  on('dodged', () => { for (const id of activeQuests()) objs(id).forEach((o, i) => { if (o.t === 'dodge' && !objDone(id, i)) bump(id, i); }); });
  on('invChanged', () => checkPolled());
  on('flagsChanged', () => checkPolled());
  on('mounted', () => { for (const id of activeQuests()) objs(id).forEach((o, i) => { if (o.t === 'mount' && !objDone(id, i)) bump(id, i); }); });
  on('fished', () => { for (const id of activeQuests()) objs(id).forEach((o, i) => { if (o.t === 'fish' && !objDone(id, i)) bump(id, i); }); });
  on('bossYield', (e) => { if (e.tag) G.flags['yield_' + e.tag] = true; checkPolled(); });
}
let pollT = 0;
export function questTick(dt) {
  pollT -= dt; if (pollT > 0) return; pollT = 0.25;
  const p = G.player; if (!p) return;
  for (const id of activeQuests()) {
    objs(id).forEach((o, i) => {
      if (o.t === 'goto' && !objDone(id, i)) {
        const map = o.map || 'world';
        if (p.mapId !== map) return;
        const [x, y] = markerPos(map, o.at);
        if (dist(p.x, p.y, x, y) < (o.r || 40)) bump(id, i);
      }
      if (o.t === 'wait' && !objDone(id, i)) { const st = G.quests[id]; st.c['w' + i] = (st.c['w' + i] || 0) + 0.25; if (st.c['w' + i] >= o.sec) bump(id, i); }
      if (o.t === 'killAll' && !objDone(id, i)) { const alive = G.entities.some((e) => e.tag === o.tag && !e.dead && !e.removed); const spawned = G.quests[id].c['s' + i] || G.entities.some((e) => e.tag === o.tag); if (spawned) G.quests[id].c['s' + i] = 1; if (G.quests[id].c['s' + i] && !alive) bump(id, i); }
    });
  }
  checkPolled();
}
function checkPolled() { for (const id of activeQuests()) checkStage(id); }

// diálogo de missão para um NPC (primeiro objetivo 'talk' pendente)
export function questDialogueFor(npcId) {
  for (const id of [G.tracked, ...activeQuests()]) {
    if (!id || !isActive(id)) continue;
    const os = objs(id);
    for (let i = 0; i < os.length; i++) {
      const o = os[i];
      if (o.t === 'talk' && o.npc === npcId && !objDone(id, i)) {
        // pré-requisitos: outros objetivos do estágio concluídos?
        if (!reqOk(id, o)) continue;
        if (o.needItem && count(o.needItem) < (o.needN || 1)) continue;
        return o.start || o.dlg;
      }
    }
  }
  return null;
}
// texto do objetivo (templates traduzidos em 14 idiomas)
export function objText(id, i) {
  const o = objs(id)[i], st = G.quests[id];
  if (o.label) return loc(o.label) + (o.n > 1 ? ` (${Math.min(st.c[i] || 0, o.n)}/${o.n})` : '');
  switch (o.t) {
    case 'talk': return t('obj_talk', { npc: npcName(o.npc, getLang()) });
    case 'goto': return t('obj_goto', { place: placeName(o.at) });
    case 'kill': return t('obj_kill', { n: Math.min(st.c[i] || 0, o.n || 1), total: o.n || 1 });
    case 'killAll': return t('obj_killall');
    case 'collect': return t('obj_collect', { item: 'item_' + o.item, n: Math.min(count(o.item), o.n || 1), total: o.n || 1 });
    case 'interact': return t('obj_interact');
    case 'capture': return t('obj_capture', { n: Math.min(st.c[i] || 0, o.n || 1), total: o.n || 1 });
    case 'dummy': return t('obj_dummy', { n: Math.min(st.c[i] || 0, o.n), total: o.n });
    case 'mount': return t('obj_mount');
    case 'fish': return t('obj_fish', { n: Math.min(st.c[i] || 0, o.n), total: o.n });
    default: return '…';
  }
}
export function placeName(marker) { const k = 'pl_' + marker; const s = t(k); return s === k ? marker : s; }
export function questTitle(id) { return t('q_' + id); }
export function questDesc(id) { const q = QUESTS[id]; const st = G.quests[id]; const S = q.stages[Math.min(st ? st.stage : 0, q.stages.length - 1)]; return loc(S.hint || q.desc); }

// posição de objetivos para marcadores (HUD/mapa)
export function objectiveTargets(id) {
  const out = [];
  if (!isActive(id)) return out;
  objs(id).forEach((o, i) => {
    if (objDone(id, i)) return;
    if (o.t === 'goto') { const [x, y] = markerPos(o.map || 'world', o.at); out.push({ map: o.map || 'world', x, y }); }
    else if (o.t === 'talk') { const e = npcEntity(o.npc); if (e && e.mapId !== '__hidden') out.push({ map: e.mapId, x: e.x, y: e.y, npc: o.npc }); }
    else if (o.t === 'kill' || o.t === 'killAll') { for (const e of G.entities) if (o.tag && e.tag === o.tag && !e.dead && !e.removed) { out.push({ map: e.mapId, x: e.x, y: e.y }); break; } if (o.hint) { const [x, y] = markerPos(o.hintMap || 'world', o.hint); out.push({ map: o.hintMap || 'world', x, y }); } }
    else if (o.t === 'interact') { for (const m of Object.values(G.maps)) for (const ob of m.objects) if (ob.qid === o.id && !ob.removed) out.push({ map: m.id, x: ob.x, y: ob.y }); }
    else if (o.hint) { const [x, y] = markerPos(o.hintMap || 'world', o.hint); out.push({ map: o.hintMap || 'world', x, y }); }
  });
  return out;
}
