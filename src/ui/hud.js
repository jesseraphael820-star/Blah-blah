// HUD: vida/estamina/XP, minimapa, relógio e clima, rastreador de missão, prompt de interação,
// barras de chefe e captura, notificações e cartões de capítulo.
import { G } from '../state.js';
import { h, $, clear } from './dom.js';
import { t, loc, getLang } from '../core/i18n.js';
import { npcName } from '../data/npcs.js';
import { input } from '../core/input.js';
import { itemIcon } from '../gfx/icons.js';
import { drawMinimap } from './mapview.js';
import { questTitle, objText, objDone, isActive, questDef } from '../systems/quests.js';
import { formatTime, TILE } from '../core/util.js';
import { REGIONS } from '../data/world.js';
import { ITEMS } from '../data/items.js';

let root, els = {};
export function initHUD(ui) {
  root = h('div', { id: 'hud', class: 'passive hidden' });
  els.tl = h('div', { class: 'tl bars' },
    els.name = h('div', { class: 'name' }, h('span', {}, ''), h('span', { style: { color: '#b88ad8', fontSize: '12px' } }, '')),
    els.hp = h('div', { class: 'bar hp' }, h('b'), h('i'), h('span')),
    els.st = h('div', { class: 'bar st' }, h('i')),
    els.xp = h('div', { class: 'bar xp' }, h('i')),
    els.horse = h('div', { class: 'bar horse hidden' }, h('i')));
  els.minimap = h('canvas', { id: 'minimap', width: 180, height: 120, style: { width: '180px', height: '120px' } });
  els.clock = h('div', { class: 'chip' }); els.region = h('div', { class: 'chip' }); els.gold = h('div', { class: 'chip' });
  els.tr = h('div', { class: 'tr' }, els.minimap, els.region, els.clock, els.gold);
  els.tracker = h('div', { id: 'tracker' });
  els.wslot = h('div', { class: 'slot' }, h('span', { class: 'k' }, 'R'));
  els.pslot = h('div', { class: 'slot' }, h('span', { class: 'k' }, 'Q'), h('span', { class: 'n' }, '0'));
  els.bl = h('div', { class: 'bl' }, els.wslot, els.pslot);
  els.prompt = h('div', { id: 'prompt', class: 'hidden' });
  els.progress = h('div', { id: 'progress', class: 'hidden' }, h('div', { class: 'bar xp', style: { height: '10px' } }, h('i')));
  els.boss = h('div', { id: 'boss', class: 'hidden' }, h('div', { class: 'bn' }), h('div', { class: 'bar' }, h('i')));
  els.fish = h('div', { class: 'fishbar hidden' }, '');
  els.toasts = h('div', { id: 'toasts' });
  root.append(els.tl, els.tr, els.tracker, els.bl, els.prompt, els.progress, els.boss, els.fish);
  ui.append(root, els.toasts);
}
export function showHUD(v) { root.classList.toggle('hidden', !v); }
const bar = (el, f) => { el.querySelector('i').style.transform = `scaleX(${Math.max(0, Math.min(1, f))})`; };
let lastSlot = '', slowT = 0;
export function updateHUD(dt) {
  const p = G.player; if (!p || G.mode === 'title') { root.classList.add('hidden'); return; }
  const show = G.mode === 'play' || G.mode === 'dialogue';
  root.classList.toggle('hidden', !(G.mode === 'play' || G.mode === 'dialogue' || G.mode === 'cutscene') || G.mode === 'cutscene');
  if (!show) return;
  els.name.children[0].textContent = G.name;
  els.name.children[1].textContent = `${t('ui_level')} ${p.level}`;
  bar(els.hp, p.hp / p.maxHp); els.hp.querySelector('b').style.transform = `scaleX(${Math.max(0, p.hp / p.maxHp)})`;
  els.hp.querySelector('span').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
  bar(els.st, p.stam / p.maxStam); bar(els.xp, p.xp / p.xpToNext());
  els.horse.classList.toggle('hidden', !p.mount); if (p.mount) bar(els.horse, p.mount.stam / p.mount.maxStam);
  // prompt de interação
  const it = G.interactTarget;
  if (it && G.mode === 'play' && !G.capture) {
    els.prompt.classList.remove('hidden');
    const key = input.lastDevice === 'pad' ? 'A' : input.keyName(input.binds.interact[0]);
    let label = typeof it.label === 'object' ? loc(it.label) : t(it.label);
    if (it.kind === 'talk' && it.target.name) label = t('act_talk_to', { name: it.target.npcId ? npcName(it.target.npcId, getLang()) : it.target.name });
    els.prompt.replaceChildren(h('kbd', {}, key), label);
  } else els.prompt.classList.add('hidden');
  // progresso de captura
  els.progress.classList.toggle('hidden', !G.capture);
  if (G.capture) bar(els.progress.firstChild, G.capture.t / 2.5);
  // pesca
  els.fish.classList.toggle('hidden', !G.fishing);
  if (G.fishing) els.fish.textContent = G.fishing.hooked ? '❗ ' + t('ui_fish_now') : '〰 ' + t('ui_fish_wait');
  // chefe
  const boss = G.entities.find((e) => e.boss && !e.dead && !e.removed && e.mapId === p.mapId && (e.target === p || e.hpBarT > 0) && Math.hypot(e.x - p.x, e.y - p.y) < 300);
  els.boss.classList.toggle('hidden', !boss);
  if (boss) { els.boss.querySelector('.bn').textContent = boss.name || t('enemy_' + (boss.etype || boss.kind)); bar(els.boss.querySelector('.bar'), boss.hp / boss.maxHp); }
  slowT -= dt;
  if (slowT <= 0) {
    slowT = 0.25;
    drawMinimap(els.minimap);
    els.clock.textContent = `${t('ui_day')} ${G.day} · ${formatTime(G.hour)} ${weatherIcon()}`;
    els.region.textContent = G.map.interior ? t(mapLabel(G.map.id)) : t(REGIONS[G.world.regionAtPx(p.x, p.y)].key);
    els.gold.replaceChildren(h('span', { class: 'g' }, '◉ ' + G.inv.gold));
    updateTracker();
    // slots
    const w = G.inv.equip.weapon, b = G.inv.equip.bow;
    const sk = (p.bowMode && b ? b : w) + ':' + p.bowMode;
    if (sk !== lastSlot) { lastSlot = sk; const id = p.bowMode && b ? b : w; els.wslot.querySelectorAll('canvas').forEach((c) => c.remove()); if (id) els.wslot.append(iconCanvas(id)); els.wslot.classList.toggle('active', p.bowMode); }
    const pc = (G.inv.items.potion || 0) + (G.inv.items.potion_big || 0);
    els.pslot.querySelector('.n').textContent = pc;
    if (!els.pslot.querySelector('canvas')) els.pslot.append(iconCanvas('potion'));
    els.wslot.title = p.bowMode ? `${t('ui_arrows')}: ${G.inv.items.arrows || 0}` : '';
    if (p.bowMode) { let n = els.wslot.querySelector('.n'); if (!n) { n = h('span', { class: 'n' }); els.wslot.append(n); } n.textContent = G.inv.items.arrows || 0; } else els.wslot.querySelector('.n')?.remove();
  }
}
function mapLabel(id) { if (id.startsWith('int_')) { const parts = id.split('_'); return 'bld_' + parts[parts.length - 1].replace(/\d+$/, ''); } return 'dng_' + id; }
function weatherIcon() { const w = G.weatherState; if (G.map.interior) return ''; if (w.storm > 0.5) return '⛈'; if (w.rain > 0.3) return '🌧'; if (w.snow > 0.3) return '❄'; if (w.ash > 0.3) return '🌫'; if (w.fog > 0.4) return '🌫'; return G.hour > 6 && G.hour < 19 ? '☀' : '☾'; }
export function iconCanvas(id, size = 32) { const src = itemIcon(id); const c = document.createElement('canvas'); c.width = 16; c.height = 16; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0); c.style.width = size + 'px'; c.style.height = size + 'px'; return c; }
function updateTracker() {
  const id = G.tracked;
  if (!id || !isActive(id)) { clear(els.tracker); return; }
  const q = questDef(id), st = G.quests[id];
  const os = q.stages[st.stage].obj || [];
  clear(els.tracker).append(
    h('div', { class: 'qc' }, q.type === 'main' ? `${t('ui_chapter')} ${q.ch}` : t('ui_side')),
    h('div', { class: 'qt' }, questTitle(id)),
    ...os.map((o, i) => (o.t === 'kill' && o.req && !objDone(id, o.req[0]) ? null : h('div', { class: 'ob' + (objDone(id, i) ? ' done' : '') }, objText(id, i)))));
}
// ---------- notificações ----------
export function toast(text, cls = '', dur = 3.2) {
  const el = h('div', { class: 'toast ' + cls, style: { '--d': dur + 's' } }, text);
  els.toasts.append(el);
  setTimeout(() => el.remove(), (dur + 0.6) * 1000);
  while (els.toasts.children.length > 5) els.toasts.firstChild.remove();
}
export function chapterCard(n) {
  const el = h('div', { id: 'chapterCard', class: 'passive' }, h('div', { class: 'c1' }, `${t('ui_chapter').toUpperCase()} ${n}`), h('div', { class: 'c2' }, t('ch_' + n)));
  root.parentNode.append(el); setTimeout(() => el.remove(), 5200);
}
