// Testes de integridade dos dados: missões, diálogos, NPCs, itens, marcadores e traduções.
import './shim.js';
import ALL from '../src/i18n/index.js';
import { DLG } from '../src/data/dialogue.js';
import { QUESTS } from '../src/data/quests.js';
import { NPCS } from '../src/data/npcs.js';
import { ITEMS } from '../src/data/items.js';
import { CUTSCENES } from '../src/data/cutscenes.js';
import { ENEMY_TYPES, CREATURES } from '../src/data/enemies.js';
import { generateWorld } from '../src/world/gen.js';
import { createInterior, createDungeon, DUNGEONS } from '../src/world/interiors.js';
import { ACHIEVEMENTS } from '../src/systems/achievements.js';
import { dlgAvailable } from '../src/core/i18n.js';
import main1 from '../src/data/dlg_main1.js'; import main2 from '../src/data/dlg_main2.js'; import side from '../src/data/dlg_side.js';

let errors = 0; const err = (m) => { errors++; console.error('✗', m); };
const world = generateWorld();
const maps = { world };
const getMap = (id) => { if (maps[id]) return maps[id]; if (id.startsWith('int_')) { const door = world.doors.find((d) => d.target === id); if (!door) { err('interior sem porta: ' + id); return null; } return (maps[id] = createInterior(id, door)); } if (DUNGEONS[id]) return (maps[id] = createDungeon(id)); err('mapa desconhecido ' + id); return null; };
const marker = (map, at, ctx) => { if (Array.isArray(at)) return; const m = getMap(map || 'world'); if (m && !m.markers[at]) err(`${ctx}: marcador "${at}" ausente em ${map || 'world'}`); };
// NPCs: posições
for (const [id, d] of Object.entries(NPCS)) for (const k of ['day', 'night', 'fall']) { const p = d[k]; if (p) marker(p[0], p[1], `NPC ${id}.${k}`); }
// ações
function checkActs(list, ctx) {
  for (const a of [].concat(list || [])) for (const [k, v] of Object.entries(a)) {
    if (k === 'give' || k === 'take') { if (v !== 'gold' && !ITEMS[v]) err(`${ctx}: item ${v}`); }
    if (k === 'dialogue' && !DLG[v]) err(`${ctx}: diálogo ${v}`);
    if (k === 'cutscene' && !CUTSCENES[v]) err(`${ctx}: cena ${v}`);
    if (k === 'quest' && !QUESTS[v]) err(`${ctx}: missão ${v}`);
    if (k === 'achievement' && !ACHIEVEMENTS.includes(v)) err(`${ctx}: conquista ${v}`);
    if (k === 'npcAt' || k === 'npcWalk') { if (!NPCS[v[0]]) err(`${ctx}: npc ${v[0]}`); if (v[2] !== 'hidden') marker(v[1], v[2], ctx); }
    if (k === 'follow' || k === 'unfollow') if (!NPCS[v]) err(`${ctx}: npc ${v}`);
    if (k === 'npcHome') for (const n of [].concat(v)) if (!NPCS[n]) err(`${ctx}: npc ${n}`);
    if (k === 'teleport') marker(v[0], v[1], ctx);
    if (k === 'spawn') for (const s of [].concat(v)) { marker(s.map, s.at, ctx); const e = s.e; if (!(e === 'ally' || e === 'villager' || e === 'horse' || e.startsWith('animal:') && CREATURES[e.slice(7)] || ENEMY_TYPES[e])) err(`${ctx}: inimigo ${e}`); if (s.line && !DLG[s.line]) err(`${ctx}: fala ${s.line}`); }
    if (k === 'prop') for (const s of [].concat(v)) { marker(s.map, s.at, ctx); if (s.give && !ITEMS[s.give]) err(`${ctx}: item ${s.give}`); if (s.dlg && !DLG[s.dlg]) err(`${ctx}: diálogo ${s.dlg}`); }
  }
}
// missões
for (const [id, q] of Object.entries(QUESTS)) {
  if (q.next && !QUESTS[q.next]) err(`${id}.next`);
  if (q.giver && !NPCS[q.giver]) err(`${id}.giver`);
  if (q.offer && !DLG[q.offer]) err(`${id}.offer ${q.offer}`);
  if (q.reward && q.reward.items) for (const it of Object.keys(q.reward.items)) if (!ITEMS[it]) err(`${id} recompensa ${it}`);
  checkActs(q.after, id + '.after');
  q.stages.forEach((S, si) => {
    const ctx = `${id}[${si}]`;
    checkActs(S.start, ctx + '.start'); checkActs(S.done, ctx + '.done');
    if (!S.obj || !S.obj.length) err(ctx + ' sem objetivos');
    for (const o of S.obj || []) {
      if (o.t === 'talk') { if (o.npc && !NPCS[o.npc]) err(`${ctx} npc ${o.npc}`); for (const d of [].concat(o.dlg || []).concat(o.start ? [o.start] : [])) if (!DLG[d]) err(`${ctx} dlg ${d}`); }
      if (o.t === 'goto') marker(o.map, o.at, ctx);
      if (o.hint) marker(o.hintMap, o.hint, ctx + ' hint');
      if (o.t === 'collect' && !ITEMS[o.item]) err(`${ctx} item ${o.item}`);
      if (o.needItem && !ITEMS[o.needItem]) err(`${ctx} needItem`);
      // spawns/props que satisfazem kill/interact precisam existir
      if (o.t === 'killAll' || (o.t === 'kill' && o.tag)) { const all = JSON.stringify([q.stages.slice(0, si + 1).map((x) => x.start), Object.values(CUTSCENES)]); if (!all.includes(`"tag":"${o.tag}"`)) err(`${ctx}: ninguém gera a tag ${o.tag}`); }
      if (o.t === 'interact') { const all = JSON.stringify(q.stages.slice(0, si + 1).map((x) => x.start)); if (!all.includes(`"id":"${o.id}"`) && !all.includes(`"catch":"${o.id}"`)) err(`${ctx}: ninguém cria o objeto ${o.id}`); }
      if (o.t === 'flag') { const all = JSON.stringify([q.stages, Object.values(CUTSCENES), main1, main2, side]); if (!all.includes(o.flag) && !['tomb_gate_open', 'nevoa_owned'].includes(o.flag) && !o.flag.startsWith('yield_')) err(`${ctx}: flag ${o.flag} nunca é definida`); }
    }
  });
}
// cenas
for (const [id, steps] of Object.entries(CUTSCENES)) for (const s of steps) { checkActs(s.act, 'cena ' + id); if (s.dlg && !DLG[s.dlg]) err(`cena ${id} dlg ${s.dlg}`); if (s.choice && !DLG[s.choice]) err(`cena ${id} escolha`); if (s.teleport) marker(s.teleport[0], s.teleport[1], 'cena ' + id); if (s.cam && typeof s.cam === 'string' && !s.cam.startsWith('npc:') && s.cam !== 'player') marker(s.map, s.cam, 'cena ' + id); }
// diálogos
for (const src of [main1, main2, side]) for (const [id, lines] of Object.entries(src)) lines.forEach((L, i) => {
  if (L[0] === '>') { for (const c of L[1]) { if (typeof c[0] !== 'string' || typeof c[1] !== 'string') err(`dlg ${id}[${i}] escolha sem PT/EN`); if (c[2] && !DLG[c[2]]) err(`dlg ${id}[${i}] → ${c[2]}`); checkActs(c[3], `dlg ${id}`); } }
  else { if (L.length < 4 || typeof L[2] !== 'string' || typeof L[3] !== 'string') err(`dlg ${id}[${i}] formato`); if (!NPCS[L[0]] && !['player', 'narrator', 'villager', 'stranger'].includes(L[0])) err(`dlg ${id}[${i}] falante ${L[0]}`); checkActs(L[4], `dlg ${id}`); }
});
// traduções
const en = ALL.en, keys = Object.keys(en);
for (const id of Object.keys(ITEMS)) if (!en['item_' + id]) err('tradução item_' + id);
for (const id of Object.keys(QUESTS)) if (!en['q_' + id]) err('tradução q_' + id);
for (const a of ACHIEVEMENTS) { if (!en['ach_' + a]) err('ach_' + a); if (!en['achd_' + a]) err('achd_' + a); }
const optional = (k) => k.startsWith('pl_') || /^cr_.*_d$/.test(k);
let missing = {};
for (const [lang, tab] of Object.entries(ALL)) {
  for (const k of keys) if (!(k in tab) && !optional(k)) (missing[lang] = missing[lang] || []).push(k);
  for (const k of Object.keys(tab)) if (!(k in en)) err(`${lang}: chave extra ${k}`);
  for (const [k, v] of Object.entries(tab)) { const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(','); if (en[k] && ph(v) !== ph(en[k])) err(`${lang}.${k}: placeholders diferentes`); }
}
for (const [l, ks] of Object.entries(missing)) err(`${l}: faltam ${ks.length} chaves: ${ks.slice(0, 8).join(', ')}`);
console.log(`Missões: ${Object.keys(QUESTS).filter((k) => QUESTS[k].type === 'main').length} principais, ${Object.keys(QUESTS).filter((k) => QUESTS[k].type === 'side').length} secundárias · Diálogos: ${Object.keys(DLG).length} · Idiomas: ${Object.keys(ALL).length} · Chaves de UI: ${keys.length}`);
console.log(errors ? `\n${errors} ERRO(S)` : '\n✓ Dados íntegros');
process.exit(errors ? 1 : 0);
