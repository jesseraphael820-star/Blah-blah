// Persistência local (localStorage): perfil, inventário, progresso, configurações.
import { ITEMS, xpFor } from './data.js';

const KEY = 'somx_save_v1';
const defaults = () => ({
  nick: '', avatar: 0, level: 1, xp: 0, coins: 2500, rankPts: 0,
  inventory: [],             // ids de itens cosméticos
  equipped: { skins: {}, knife: 'padrao:padrao', gloves: 'padrao', nades: 'padrao' },
  stats: { matches: 0, wins: 0, losses: 0, draws: 0, kills: 0, deaths: 0, headshots: 0, mvps: 0, plants: 0, defuses: 0 },
  history: [],
  market: { seed: 0, sold: [] },
  settings: {
    sens: 1.0, adsSens: 0.6, gyro: false, gyroSens: 1.0, invertY: false, autoFire: false,
    graphics: 'medio', volume: 0.8, showFps: false, crossColor: '#39ff88', hudOpacity: 0.85, layout: 'padrao',
  },
  hud: {},                   // posições personalizadas: id -> {x,y,s}
});

export let save = defaults();

function merge(base, obj) {
  for (const k in obj) {
    if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k]) && base[k] && typeof base[k] === 'object') merge(base[k], obj[k]);
    else base[k] = obj[k];
  }
  return base;
}
export function loadSave() {
  save = defaults();
  try { const raw = localStorage.getItem(KEY); if (raw) merge(save, JSON.parse(raw)); } catch (e) { /* save corrompido: recomeça */ }
  save.inventory = save.inventory.filter(id => ITEMS[id]);
  return save;
}
export function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* sem armazenamento */ } }
export function resetSave() { const s = save.settings; save = defaults(); save.settings = s; persist(); }

export const owns = id => save.inventory.includes(id);
export function addItem(id) { if (!owns(id)) { save.inventory.push(id); persist(); return true; } return false; }
export function removeItem(id) {
  const i = save.inventory.indexOf(id); if (i < 0) return;
  save.inventory.splice(i, 1);
  const it = ITEMS[id], e = save.equipped;
  if (it.kind === 'w' && e.skins[it.base] === it.skin) delete e.skins[it.base];
  if (it.kind === 'k' && e.knife === `${it.base}:${it.skin}`) e.knife = 'padrao:padrao';
  if (it.kind === 'g' && e.gloves === it.skin) e.gloves = 'padrao';
  if (it.kind === 'n' && e.nades === it.skin) e.nades = 'padrao';
  persist();
}
export function isEquipped(id) {
  const it = ITEMS[id], e = save.equipped;
  if (it.kind === 'w') return e.skins[it.base] === it.skin;
  if (it.kind === 'k') return e.knife === `${it.base}:${it.skin}`;
  if (it.kind === 'g') return e.gloves === it.skin;
  return e.nades === it.skin;
}
export function toggleEquip(id) {
  const it = ITEMS[id], e = save.equipped, on = isEquipped(id);
  if (it.kind === 'w') { if (on) delete e.skins[it.base]; else e.skins[it.base] = it.skin; }
  else if (it.kind === 'k') e.knife = on ? 'padrao:padrao' : `${it.base}:${it.skin}`;
  else if (it.kind === 'g') e.gloves = on ? 'padrao' : it.skin;
  else e.nades = on ? 'padrao' : it.skin;
  persist();
  return !on;
}
export const skinFor = weaponId => save.equipped.skins[weaponId] || 'padrao';
export function spend(n) { if (save.coins < n) return false; save.coins -= n; persist(); return true; }
export function addXp(n) {
  save.xp += n; let ups = 0;
  while (save.xp >= xpFor(save.level)) { save.xp -= xpFor(save.level); save.level++; ups++; save.coins += 250; }
  persist(); return ups;
}
