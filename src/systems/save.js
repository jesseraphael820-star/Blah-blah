// Salvamento manual (3 espaços) e automático em localStorage.
import { G } from '../state.js';
import { TERRITORIES } from '../data/world.js';
const KEY = 'sotk_save_';
export const SLOTS = ['auto', '1', '2', '3'];
function safe(fn, fallback = null) { try { return fn(); } catch (e) { console.warn('armazenamento indisponível', e); return fallback; } }
export function serialize() {
  const p = G.player;
  const npcPos = {};
  return {
    v: 1, savedAt: Date.now(), name: G.name, look: G.playerLook, chapter: G.chapter, phase: G.phase, day: G.day, hour: G.hour, playTime: G.playTime,
    player: { x: p.x, y: p.y, map: p.mapId, hp: p.hp, level: p.level, xp: p.xp, baseHp: p.baseHp || 100, bowMode: p.bowMode },
    inv: G.inv, flags: G.flags, quests: G.quests, tracked: G.tracked, territory: G.territory, relations: G.relations, rep: G.rep, treasury: G.treasury, warLog: G.warLog,
    discovered: G.discovered, opened: G.opened, gathered: G.gathered, npcOverride: G.npcOverride, metNpcs: G.metNpcs,
    horses: G.horses, activeHorse: G.activeHorse ? { coat: G.activeHorse.coat, x: G.activeHorse.x, y: G.activeHorse.y, map: G.activeHorse.mapId } : null,
    achievements: G.achievements, stats: G.stats, ending: G.ending, garrisonDead: G.garrisonDead || {},
  };
}
export function save(slot) { const d = serialize(); return safe(() => { localStorage.setItem(KEY + slot, JSON.stringify(d)); localStorage.setItem(KEY + 'last', slot); return true; }, false); }
export function load(slot) { return safe(() => JSON.parse(localStorage.getItem(KEY + slot))); }
export function info(slot) { const d = load(slot); return d ? { chapter: d.chapter, day: d.day, savedAt: d.savedAt, name: d.name, level: d.player.level, playTime: d.playTime } : null; }
export function lastSlot() { return safe(() => { const s = localStorage.getItem(KEY + 'last'); return s && load(s) ? s : null; }); }
export function anySave() { return SLOTS.some((s) => info(s)); }
export function del(slot) { safe(() => localStorage.removeItem(KEY + slot)); }
export function saveSettings(s) { safe(() => localStorage.setItem('sotk_settings', JSON.stringify(s))); }
export function loadSettings() { return safe(() => JSON.parse(localStorage.getItem('sotk_settings'))); }
