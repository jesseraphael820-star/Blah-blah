// Menu de pausa (inventário, equipamento, mapa, missões, personagens, facções, conquistas, configurações,
// salvar/carregar), lojas, ferreiro e estábulo.
import { G } from '../state.js';
import { h, $, clear, scaled } from './dom.js';
import { t, loc, LANGS, setLang, getLang } from '../core/i18n.js';
import { input, DEFAULT_BINDS } from '../core/input.js';
import { audio } from '../core/audio.js';
import { ITEMS, SHOPS, UPGRADE } from '../data/items.js';
import { NPCS, npcName } from '../data/npcs.js';
import { FACTIONS, FACTION_IDS, TERRITORIES, VILLAGES, REGIONS } from '../data/world.js';
import { QUESTS, MAIN_IDS, SIDE_IDS } from '../data/quests.js';
import * as inv from '../systems/inventory.js';
import { iconCanvas } from './hud.js';
import { renderMap, territoryAtMapPx, ownerOf, contested } from './mapview.js';
import { questTitle, questDesc, objText, objDone, isActive, isDone } from '../systems/quests.js';
import { portrait } from '../gfx/portraits.js';
import { charPreview } from '../gfx/chars.js';
import { emblemCanvas } from '../gfx/objects.js';
import { diplomacy, relation, territoriesOf, income } from '../systems/war.js';
import { ACHIEVEMENTS } from '../systems/achievements.js';
import { SLOTS, info as slotInfo, save as saveSlot, del as delSlot } from '../systems/save.js';
import { emit } from '../core/events.js';
import { HORSE_COATS } from '../gfx/animals.js';
import { Horse } from '../entities/creature.js';

let win, tabsEl, body, foot, current = 'inventory', selItem = null, mapMode = 'pol', hoverT = -1;
const TABS = ['inventory', 'equipment', 'map', 'quests', 'characters', 'factions', 'achievements', 'settings', 'saveload'];
export function initMenus(ui) {
  tabsEl = h('div', { class: 'tabs' }); body = h('div', { class: 'tabbody' }); foot = h('div', { class: 'foot' });
  win = h('div', { class: 'screen hidden', id: 'menu', onclick: (e) => { if (e.target.id === 'menu') closeMenu(); } }, h('div', { class: 'panel menuwin' }, tabsEl, body, foot));
  ui.append(win);
}
export function openMenu(tab = current) {
  if (G.mode !== 'play') return;
  G.mode = 'menu'; current = tab; win.classList.remove('hidden'); audio.sfx('click'); renderMenu();
}
export function closeMenu() { if (G.mode !== 'menu' && G.mode !== 'shop') return; win.classList.add('hidden'); G.mode = 'play'; audio.sfx('click'); G.menuKind = null; }
export function menuOpen() { return !win.classList.contains('hidden'); }
export function renderMenu() {
  if (G.menuKind === 'shop' || G.menuKind === 'smith' || G.menuKind === 'stable') { tabsEl.classList.add('hidden'); return renderService(); }
  tabsEl.classList.remove('hidden');
  clear(tabsEl).append(...TABS.map((k) => h('button', { class: 'tab' + (k === current ? ' on' : ''), onclick: () => { current = k; audio.sfx('click'); renderMenu(); } }, t('tab_' + k))),
    h('button', { class: 'tab', style: { marginInlineStart: 'auto' }, onclick: () => closeMenu() }, '✕'));
  clear(body); clear(foot).append(h('span', {}, t('ui_menu_hint')), h('span', {}, `${t('ui_chapter')} ${G.chapter} · ${t('ui_day')} ${G.day} · ${playTime()}`));
  ({ inventory: tabInventory, equipment: tabEquipment, map: tabMap, quests: tabQuests, characters: tabCharacters, factions: tabFactions, achievements: tabAchievements, settings: () => body.append(settingsPanel(() => renderMenu())), saveload: tabSave })[current]();
}
function playTime() { const s = Math.floor(G.playTime); return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`; }
const itemName = (id) => t('item_' + id);
const rarCls = (it) => (it.rarity ? 'rar' + it.rarity : '');

// ---------- inventário ----------
function itemDetail(id, actions = true) {
  const it = ITEMS[id]; if (!it) return h('div');
  const st = it.type === 'weapon' ? inv.weaponStats(id) : it;
  const rows = [];
  if (it.type === 'weapon') rows.push([t('st_dmg'), st.dmg + (st.level ? ` (+${st.level})` : '')], [t('st_speed'), (1 / st.speed).toFixed(1)], [t('st_reach'), st.reach], [t('st_stam'), st.stam], [t('st_type'), t('wt_' + it.wtype)]);
  if (it.type === 'bow') rows.push([t('st_dmg'), it.dmg], [t('st_draw'), it.draw + 's'], [t('st_type'), t('wt_bow')]);
  if (it.type === 'shield') rows.push([t('st_block'), Math.round(it.block * 100) + '%'], [t('st_parry'), it.parry + 's']);
  if (it.type === 'armor' || it.type === 'cloak') rows.push([t('st_def'), it.def || 0]); if (it.stam) rows.push([t('st_stam'), '+' + it.stam]);
  if (it.heal) rows.push([t('st_heal'), '+' + it.heal]); if (it.stamBuff) rows.push([t('st_stam'), '×2 (60s)']);
  if (it.price) rows.push([t('st_value'), inv.priceOf(id, true) + ' ◉']);
  const btns = [];
  if (actions) {
    const slot = inv.slotOf(it);
    if (slot && G.inv.items[id]) btns.push(h('button', { class: 'btn small gold', onclick: () => { inv.equip(id); G.player.refreshStats(); renderMenu(); } }, t('ui_equip')));
    if (it.type === 'consumable') btns.push(h('button', { class: 'btn small gold', onclick: () => { useItem(id); renderMenu(); } }, t('ui_use')));
    if (id === 'apple' && G.activeHorse) btns.push(h('button', { class: 'btn small', onclick: () => { inv.remove('apple', 1); G.activeHorse.stam = G.activeHorse.maxStam; audio.sfx('eat'); renderMenu(); } }, t('ui_feed_horse')));
  }
  return h('div', { class: 'detail' }, h('h3', { class: rarCls(it) }, itemName(id)), h('div', { class: 'kv' }, t('type_' + it.type)), ...rows.map(([a, b]) => h('div', { class: 'stat' }, a, h('b', {}, String(b)))), h('div', { style: { display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' } }, ...btns));
}
export function useItem(id) {
  const it = ITEMS[id], p = G.player;
  if (!it || !G.inv.items[id]) return false;
  if (it.heal) { if (p.hp >= p.maxHp) return false; p.hp = Math.min(p.maxHp, p.hp + it.heal); audio.sfx(id.startsWith('potion') ? 'drink' : 'eat'); audio.sfx('heal'); G.particles.burst(p.x, p.y - 12, 12, '#80ff90', 40, 0.8, { grav: -40 }); }
  else if (it.stamBuff) { G.buffStam = it.stamBuff; p.stam = p.maxStam; audio.sfx('drink'); }
  else return false;
  inv.remove(id, 1); return true;
}
function tabInventory() {
  const ids = Object.keys(G.inv.items).sort((a, b) => order(a) - order(b));
  const grid = h('div', { class: 'grid' }, ...ids.map((id) => h('div', { class: 'cell' + (selItem === id ? ' sel' : ''), title: itemName(id), onclick: () => { selItem = id; renderMenu(); } }, iconCanvas(id, 40), h('span', { class: 'n' }, G.inv.items[id] > 1 ? G.inv.items[id] : ''))));
  const side = h('div', { class: 'side' }, h('div', { class: 'detail', style: { marginBottom: '10px' } }, h('div', { class: 'stat' }, t('ui_gold'), h('b', {}, G.inv.gold + ' ◉')), h('div', { class: 'stat' }, t('ui_level'), h('b', {}, G.player.level)), h('div', { class: 'stat' }, 'XP', h('b', {}, `${G.player.xp} / ${G.player.xpToNext()}`))), selItem && G.inv.items[selItem] ? itemDetail(selItem) : h('div', { class: 'kv' }, t('ui_select_item')));
  body.append(h('div', { class: 'cols' }, h('div', { class: 'main' }, ids.length ? grid : h('div', { class: 'kv' }, t('ui_empty'))), side));
}
const order = (id) => ({ weapon: 0, bow: 1, shield: 2, armor: 3, cloak: 4, consumable: 5, ammo: 6, tool: 7, material: 8, quest: 9 }[ITEMS[id].type] ?? 10);
// ---------- equipamento ----------
function tabEquipment() {
  const p = G.player;
  const slots = ['weapon', 'bow', 'shield', 'armor', 'cloak'].map((s) => {
    const id = G.inv.equip[s];
    return h('div', { class: 'saveslot', style: { cursor: id ? 'pointer' : 'default' }, onclick: () => { if (id) { selItem = id; renderMenu(); } } },
      h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, id ? iconCanvas(id, 32) : h('div', { style: { width: '32px' } }), h('div', {}, h('div', { class: 'kv' }, t('slot_' + s)), h('div', { class: id ? rarCls(ITEMS[id]) : 'kv' }, id ? itemName(id) : '—'))),
      id && s !== 'armor' ? h('button', { class: 'btn small', onclick: (e) => { e.stopPropagation(); inv.unequip(s); p.refreshStats(); renderMenu(); } }, t('ui_unequip')) : null);
  });
  const prev = charPreview(p.look, 5); prev.style.imageRendering = 'pixelated';
  const stats = h('div', { class: 'detail' }, h('h3', {}, G.name), ...[[t('st_hp'), `${Math.ceil(p.hp)} / ${p.maxHp}`], [t('st_stam'), Math.round(p.maxStam)], [t('st_dmg'), p.weapon ? p.weapon.dmg : 0], [t('st_def'), p.def], [t('ui_level'), p.level], [t('ui_horse'), G.activeHorse ? t('coat_' + G.activeHorse.coat) : '—']].map(([a, b]) => h('div', { class: 'stat' }, a, h('b', {}, String(b)))));
  const list = Object.keys(G.inv.items).filter((id) => inv.slotOf(ITEMS[id]));
  body.append(h('div', { class: 'cols' }, h('div', { class: 'main' }, h('div', { class: 'slots' }, ...slots), h('h4', { class: 'panel-title' }, t('ui_available')), h('div', { class: 'grid' }, ...list.map((id) => h('div', { class: 'cell', title: itemName(id), onclick: () => { selItem = id; renderMenu(); } }, iconCanvas(id, 40))))),
    h('div', { class: 'side' }, h('div', { style: { textAlign: 'center' } }, prev), stats, selItem && (G.inv.items[selItem] || Object.values(G.inv.equip).includes(selItem)) ? itemDetail(selItem) : null)));
}
// ---------- mapa ----------
function tabMap() {
  if (!G.flags.unlock_stratmap && mapMode === 'pol') mapMode = 'geo';
  const cv = h('canvas', { class: 'big' });
  const scale = 3;
  const tinfo = h('div', { class: 'tinfo' }, t('ui_map_hover'));
  const draw = () => renderMap(cv, mapMode, scale, hoverT);
  cv.addEventListener('mousemove', (e) => {
    const r = cv.getBoundingClientRect(); const mx = ((e.clientX - r.left) / r.width) * cv.width, my = ((e.clientY - r.top) / r.height) * cv.height;
    const ti = territoryAtMapPx(mx, my, scale);
    if (ti !== hoverT) { hoverT = ti; draw(); showTerr(tinfo, ti); }
  });
  draw();
  const anim = setInterval(() => { if (!cv.isConnected) { clearInterval(anim); return; } if (mapMode === 'pol') draw(); }, 250);
  const modes = h('div', { style: { display: 'flex', gap: '6px' } },
    h('button', { class: 'btn small' + (mapMode === 'geo' ? ' gold' : ''), onclick: () => { mapMode = 'geo'; renderMenu(); } }, t('map_geo')),
    h('button', { class: 'btn small' + (mapMode === 'pol' ? ' gold' : ''), disabled: !G.flags.unlock_stratmap, onclick: () => { mapMode = 'pol'; renderMenu(); } }, t('map_pol')));
  const legend = h('div', { class: 'legend detail' }, h('b', {}, t('map_legend')), ...FACTION_IDS.map((f) => h('div', { class: 'li' }, h('span', { class: 'sw', style: { background: f === 'ravencross' ? '#3a3046' : FACTIONS[f].color } }), `${FACTIONS[f].name} (${territoriesOf(f).length})`)),
    h('div', { class: 'li' }, h('span', { class: 'sw', style: { background: 'repeating-linear-gradient(45deg,#c8bca0 0 3px,#6a6050 3px 6px)' } }), t('map_neutral')),
    h('div', { class: 'li' }, h('span', { class: 'sw', style: { background: 'repeating-linear-gradient(-45deg,#fff0c8 0 3px,#a03030 3px 6px)' } }), t('map_contested')),
    h('div', { class: 'li' }, h('span', { class: 'sw', style: { background: '#fff', borderRadius: '50%' } }), t('map_you')), h('div', { class: 'li' }, h('span', { class: 'sw', style: { background: '#ffd84a', transform: 'rotate(45deg)' } }), t('map_objective')));
  const travel = h('div', { class: 'detail' }, h('b', {}, t('map_travel')), ...Object.entries(VILLAGES).map(([vid, v]) => {
    const known = G.discovered['reg' + G.world.reg(v.x, v.y)] && (G.metVillages?.[vid] || G.discovered['v_' + vid]);
    const blocked = (vid === 'varden' && G.flags.fallen && !G.flags.restored) || G.map.interior || G.entities.some((e) => e.ai === 'enemy' && e.target === G.player && !e.dead && e.mapId === G.player.mapId) || G.flags.noTravel;
    return h('button', { class: 'btn small', style: { margin: '3px 3px 0 0' }, disabled: !known || blocked, onclick: () => { closeMenu(); emit('fastTravel', vid); } }, FACTIONS[v.faction].name);
  }), h('div', { class: 'kv', style: { marginTop: '6px' } }, t('map_travel_hint')));
  body.append(h('div', { class: 'mapwrap' }, h('div', { style: { flex: 1, overflow: 'auto', minWidth: 0 } }, cv), h('div', { class: 'maptools' }, modes, tinfo, legend, travel)));
}
function showTerr(el, ti) {
  if (ti < 0) { el.textContent = t('ui_map_hover'); return; }
  const tr = TERRITORIES[ti], own = ownerOf(ti);
  clear(el).append(h('b', { class: 'panel-title' }, tr.name), h('div', {}, `${t('map_owner')}: `, h('b', { style: { color: own ? FACTIONS[own].light : '#e8e0c8' } }, own ? FACTIONS[own].name : t('map_neutral'))),
    h('div', {}, `${t('map_importance')}: ${'★'.repeat(tr.imp)}`), h('div', {}, `${t('map_resource')}: ${t(tr.res)}`),
    tr.orig && tr.orig !== own ? h('div', { style: { color: '#ffb0a0' } }, `${t('map_orig')}: ${FACTIONS[tr.orig].name}`) : null, contested(ti) ? h('div', { style: { color: '#ffd84a' } }, t('map_contested')) : null);
}
// ---------- missões ----------
let selQuest = null;
function tabQuests() {
  const active = Object.keys(G.quests).filter((id) => isActive(id)), done = Object.keys(G.quests).filter((id) => isDone(id));
  if (!selQuest || !G.quests[selQuest]) selQuest = G.tracked || active[0] || done[0];
  const item = (id) => h('div', { class: 'q' + (id === selQuest ? ' sel' : '') + (isDone(id) ? ' done' : ''), onclick: () => { selQuest = id; renderMenu(); } }, (G.tracked === id ? '◆ ' : '') + questTitle(id), h('div', { class: 'kv' }, QUESTS[id].type === 'main' ? `${t('ui_chapter')} ${QUESTS[id].ch}` : t('ui_side')));
  const left = h('div', { class: 'main qlist' }, h('h4', {}, t('q_active')), ...active.map(item), h('h4', {}, t('q_done')), ...done.map(item),
    h('div', { class: 'kv', style: { marginTop: '10px' } }, `${t('q_progress')}: ${MAIN_IDS.filter(isDone).length}/${MAIN_IDS.length} · ${t('ui_side')}: ${SIDE_IDS.filter(isDone).length}/${SIDE_IDS.length}`));
  let right = h('div', { class: 'side' });
  if (selQuest) {
    const q = QUESTS[selQuest], st = G.quests[selQuest];
    right = h('div', { class: 'side detail' }, h('h3', {}, questTitle(selQuest)), h('p', { style: { lineHeight: 1.5 } }, questDesc(selQuest)),
      isActive(selQuest) ? h('div', {}, ...(q.stages[st.stage].obj || []).map((o, i) => h('div', { class: 'stat' }, objText(selQuest, i), h('b', {}, objDone(selQuest, i) ? '✔' : '…')))) : h('div', { style: { color: '#5ac070' } }, '✔ ' + t('q_completed')),
      isActive(selQuest) ? h('button', { class: 'btn small gold', style: { marginTop: '10px' }, onclick: () => { G.tracked = selQuest; renderMenu(); } }, t('q_track')) : null);
  }
  body.append(h('div', { class: 'cols' }, left, right));
}
// ---------- personagens ----------
function tabCharacters() {
  const list = Object.keys(NPCS).filter((id) => id !== 'narrator' && (G.metNpcs[id] || ['kael', 'oswin'].includes(id)));
  body.append(h('div', {}, ...list.map((id) => {
    const d = NPCS[id];
    const pc = scaled(portrait(d.look, id === 'kael' && G.quests.m19 && isDone('m19') && !G.flags.gameComplete ? 'sad' : 'neutral', 0, false), 2);
    const desc = id === 'kael' && G.quests.m19 && d.descLater ? d.descLater : d.desc;
    return h('div', { class: 'char' }, pc, h('div', {}, h('div', { class: 'cn' }, npcName(id, getLang())), h('div', { class: 'cf', style: { color: d.faction ? FACTIONS[d.faction].light : '#a898b8' } }, d.faction ? FACTIONS[d.faction].name : t('map_neutral')), h('p', {}, loc(desc))));
  })));
}
// ---------- facções ----------
function tabFactions() {
  body.append(h('div', { class: 'fac' }, ...FACTION_IDS.map((f) => {
    const F = FACTIONS[f];
    const em = scaled(emblemCanvas(f, '#ffffff', f === 'ravencross' ? '#3a3046' : F.color, 3), 1);
    const leader = NPCS[F.leader];
    return h('div', { class: 'f', style: { '--fc': f === 'ravencross' ? '#5a4a6a' : F.color } },
      h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, em, h('div', {}, h('h3', { style: { color: F.light } }, F.name), h('div', { class: 'kv' }, loc(F.motto)))),
      h('div', { class: 'row' }, `${t('fac_leader')}: `, h('b', {}, leader ? npcName(F.leader, getLang()) : '?')),
      h('div', { class: 'row' }, `${t('fac_economy')}: ${loc(F.economy)}`), h('div', { class: 'row' }, `${t('fac_culture')}: ${loc(F.culture)}`), h('div', { class: 'row' }, `${t('fac_army')}: ${loc(F.army)}`),
      h('div', { class: 'row' }, `${t('fac_history')}: ${loc(F.history)}`),
      h('div', { class: 'row' }, `${t('fac_resources')}: ${F.resources.map((r) => t(r)).join(', ')}`),
      h('div', { class: 'row' }, `${t('fac_territories')}: ${territoriesOf(f).length} · ${t('fac_income')}: ${income(f)} ◉/${t('ui_day').toLowerCase()} · ${t('fac_treasury')}: ${Math.round(G.treasury[f] || 0)} ◉`),
      h('div', { class: 'row' }, `${t('fac_rep')}: ${G.rep[f] || 0}`),
      h('div', { class: 'row' }, ...FACTION_IDS.filter((o) => o !== f).map((o) => h('span', { class: 'dip ' + diplomacy(f, o), title: `${relation(f, o)}` }, `${FACTIONS[o].name}: ${t('dip_' + diplomacy(f, o))}`))));
  })), h('h4', { class: 'panel-title', style: { marginTop: '14px' } }, t('fac_log')), h('div', {}, ...(G.warLog || []).slice(0, 12).map((l) => { const tr = TERRITORIES.find((x) => x.id === l.tid); return h('div', { class: 'kv' }, `${t('ui_day')} ${l.day}: ${tr.name} — ${l.from ? FACTIONS[l.from].name : t('map_neutral')} → ${l.to ? FACTIONS[l.to].name : t('map_neutral')}`); })));
}
// ---------- conquistas ----------
function tabAchievements() {
  const n = ACHIEVEMENTS.filter((a) => G.achievements[a]).length;
  body.append(h('div', { class: 'kv', style: { marginBottom: '10px' } }, `${n} / ${ACHIEVEMENTS.length}`), ...ACHIEVEMENTS.map((a) => h('div', { class: 'ach' + (G.achievements[a] ? '' : ' locked') }, h('div', { class: 'ic' }, '★'), h('div', {}, h('b', {}, t('ach_' + a)), h('div', { class: 'kv' }, t('achd_' + a))))));
}
// ---------- salvar / carregar ----------
function tabSave() {
  body.append(h('div', { class: 'slots' }, ...SLOTS.map((s) => {
    const inf = slotInfo(s);
    return h('div', { class: 'saveslot' }, h('div', {}, h('b', {}, s === 'auto' ? t('save_auto') : `${t('save_slot')} ${s}`), h('div', { class: 'meta' }, inf ? `${inf.name} · ${t('ui_level')} ${inf.level} · ${t('ui_chapter')} ${inf.chapter} · ${t('ui_day')} ${inf.day} · ${new Date(inf.savedAt).toLocaleString(getLang())}` : t('save_empty'))),
      h('div', { style: { display: 'flex', gap: '6px' } },
        s !== 'auto' ? h('button', { class: 'btn small gold', disabled: !canSave(), onclick: () => { if (saveSlot(s)) { emit('toast', 'tst_saved'); renderMenu(); } } }, t('save_save')) : null,
        inf ? h('button', { class: 'btn small', onclick: () => { closeMenu(); emit('loadGame', s); } }, t('save_load')) : null,
        inf && s !== 'auto' ? h('button', { class: 'btn small', onclick: () => { delSlot(s); renderMenu(); } }, '🗑') : null));
  }), h('button', { class: 'btn', style: { marginTop: '18px' }, onclick: () => { closeMenu(); emit('backToTitle'); } }, t('ui_quit_title')), !canSave() ? h('div', { class: 'kv' }, t('save_blocked')) : null));
}
export function canSave() { return G.mode !== 'cutscene' && !G.entities.some((e) => (e.ai === 'enemy' || e.team === 'W') && e.target === G.player && !e.dead && !e.removed && e.mapId === G.player.mapId); }

// ---------- configurações (compartilhado com a tela título) ----------
export function settingsPanel(rerender) {
  const S = G.settings;
  const apply = () => emit('settingsChanged');
  const slider = (key, label, min = 0, max = 1, step = 0.05) => h('div', { class: 'setrow' }, h('label', {}, t(label)), h('input', { type: 'range', min, max, step, value: S[key], oninput: (e) => { S[key] = Number(e.target.value); apply(); } }));
  const select = (key, label, opts) => h('div', { class: 'setrow' }, h('label', {}, t(label)), h('select', { onchange: (e) => { S[key] = isNaN(e.target.value) ? e.target.value : Number(e.target.value); apply(); rerender && rerender(); } }, ...opts.map(([v, l]) => h('option', { value: v, selected: String(S[key]) === String(v) }, l))));
  const toggle = (key, label) => h('div', { class: 'setrow' }, h('label', {}, t(label)), h('input', { type: 'checkbox', checked: S[key], onchange: (e) => { S[key] = e.target.checked; apply(); } }));
  const keys = h('div', { class: 'keys' }, ...Object.keys(DEFAULT_BINDS).flatMap((a) => [h('span', {}, t('key_' + a)), h('button', { class: 'btn small kbtn', onclick: (e) => { e.target.textContent = '…'; input.listening = (code) => { input.binds[a] = [code, ...(input.binds[a] || []).filter((c) => c !== code)].slice(0, 2); S.binds = input.binds; apply(); rerender && rerender(); }; } }, input.keyName(input.binds[a][0])), h('span', { class: 'kv' }, input.keyName(input.binds[a][1]))]));
  return h('div', { class: 'cols' }, h('div', { class: 'main' },
    h('h4', { class: 'panel-title' }, t('set_audio')), slider('master', 'set_master'), slider('music', 'set_music'), slider('sfx', 'set_sfx'),
    h('h4', { class: 'panel-title' }, t('set_video')),
    select('resolution', 'set_resolution', [[0, '320×180'], [1, '400×225'], [2, '480×270'], [3, '640×360']]),
    select('quality', 'set_quality', [[0, t('q_low')], [1, t('q_med')], [2, t('q_high')]]),
    slider('fxIntensity', 'set_fx'), toggle('fullscreen', 'set_fullscreen'), toggle('screenShake', 'set_shake'), toggle('showDamage', 'set_damage'),
    h('h4', { class: 'panel-title' }, t('set_game')),
    select('lang', 'set_lang', LANGS.map((l) => [l.code, l.name])),
    select('textSpeed', 'set_textspeed', [[0.6, t('ts_slow')], [1, t('ts_normal')], [1.8, t('ts_fast')], [3, t('ts_instant')]]),
    toggle('autosave', 'set_autosave')),
  h('div', { class: 'side' }, h('h4', { class: 'panel-title' }, t('set_controls')), keys, h('button', { class: 'btn small', style: { marginTop: '10px' }, onclick: () => { input.resetBinds(); S.binds = null; apply(); rerender && rerender(); } }, t('set_reset_keys')),
    h('div', { class: 'kv', style: { marginTop: '10px', lineHeight: 1.6 } }, t('set_pad_hint'))));
}

// ---------- serviços: loja, ferreiro, estábulo ----------
let shopId = null;
export function openService(kind, id) {
  G.menuKind = kind; shopId = id; G.mode = 'shop'; win.classList.remove('hidden'); renderMenu();
}
function renderService() {
  clear(body); clear(foot).append(h('span', {}, t('ui_esc_close')), h('span', { class: 'g', style: { color: '#f4dc8a' } }, `◉ ${G.inv.gold}`));
  const close = h('button', { class: 'btn small', style: { float: 'inline-end' }, onclick: () => closeMenu() }, '✕');
  if (G.menuKind === 'shop') {
    const stock = SHOPS[shopId] || [];
    const buy = stock.map((id) => { const pr = inv.priceOf(id) * (id === 'arrows' ? 10 : 1); const ok = G.inv.gold >= pr; return h('div', { class: 'it' + (ok ? '' : ' no'), onclick: () => { if (!ok) { audio.sfx('error'); return; } G.inv.gold -= pr; inv.add(id, id === 'arrows' ? 10 : 1); audio.sfx('coin'); renderMenu(); } }, iconCanvas(id), h('span', { class: rarCls(ITEMS[id]) }, itemName(id) + (id === 'arrows' ? ' ×10' : '')), h('span', { class: 'p' }, pr + ' ◉')); });
    const sell = Object.keys(G.inv.items).filter((id) => ITEMS[id].type !== 'quest' && ITEMS[id].price).map((id) => { const pr = inv.priceOf(id, true); return h('div', { class: 'it', onclick: () => { inv.remove(id, 1); inv.addGold(pr); audio.sfx('coin'); renderMenu(); } }, iconCanvas(id), h('span', {}, `${itemName(id)} ×${G.inv.items[id]}`), h('span', { class: 'p' }, '+' + pr + ' ◉')); });
    body.append(close, h('h3', { class: 'panel-title' }, t('shop_title')), h('div', { class: 'shop' }, h('div', { class: 'col' }, h('b', {}, t('shop_buy')), h('div', { class: 'list' }, ...buy)), h('div', { class: 'col' }, h('b', {}, t('shop_sell')), h('div', { class: 'list' }, ...sell))));
  } else if (G.menuKind === 'smith') {
    const weapons = [...new Set([G.inv.equip.weapon, ...Object.keys(G.inv.items).filter((id) => ITEMS[id].type === 'weapon')].filter(Boolean))];
    body.append(close, h('h3', { class: 'panel-title' }, t('smith_title')), h('div', { class: 'kv' }, t('smith_hint', { ore: G.inv.items.ore || 0 })), h('div', { class: 'shop' }, h('div', { class: 'col' }, h('div', { class: 'list' }, ...weapons.map((id) => {
      const c = inv.canUpgrade(id), st = inv.weaponStats(id);
      return h('div', { class: 'it' + (c.ok ? '' : ' no'), onclick: () => { if (inv.doUpgrade(id)) { G.player.refreshStats(); renderMenu(); } else audio.sfx('error'); } }, iconCanvas(id), h('span', { class: rarCls(ITEMS[id]) }, `${itemName(id)} +${st.level} (${t('st_dmg')} ${st.dmg})`), h('span', { class: 'p' }, c.max ? t('smith_max') : `${c.gold} ◉ · ${c.ore} ${itemName('ore')}`));
    })))));
  } else if (G.menuKind === 'stable') {
    const coats = [['brown', 120], ['chestnut', 160], ['black', 220], ['grey', 200], ['palomino', 260], ['bay', 240], ['white', 300]];
    body.append(close, h('h3', { class: 'panel-title' }, t('stable_title')), h('div', { class: 'kv' }, t('stable_hint')), h('div', { class: 'shop' }, h('div', { class: 'col' }, h('div', { class: 'list' }, ...coats.map(([c, pr]) => {
      const own = G.horses.includes(c);
      return h('div', { class: 'it' + (own || G.inv.gold >= pr ? '' : ' no'), onclick: () => {
        if (!own) { if (G.inv.gold < pr) { audio.sfx('error'); return; } G.inv.gold -= pr; G.horses.push(c); audio.sfx('coin'); }
        if (G.activeHorse) G.activeHorse.removed = true;
        const hh = new Horse(G.player.x + 20, G.player.y + 10, c, { owned: true }); hh.mapId = G.player.mapId; G.entities.push(hh); G.activeHorse = hh; audio.sfx('neigh'); renderMenu();
      } }, h('span', { class: 'sw2', style: { background: HORSE_COATS[c].body } }), h('span', {}, t('coat_' + c) + (G.activeHorse && G.activeHorse.coat === c ? ' ✔' : '')), h('span', { class: 'p' }, own ? t('stable_choose') : pr + ' ◉'));
    })))));
  }
}
