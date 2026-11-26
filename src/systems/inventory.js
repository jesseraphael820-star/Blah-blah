// Inventário, equipamento, ouro, melhorias e atributos derivados do jogador.
import { G } from '../state.js';
import { ITEMS, UPGRADE } from '../data/items.js';
import { emit } from '../core/events.js';
import { audio } from '../core/audio.js';

export function newInventory() {
  return { items: { potion: 2, bread: 2, apple: 1 }, gold: 15, equip: { weapon: null, bow: null, shield: null, armor: 'a_tunic', cloak: null }, upgrades: {}, owned: { a_tunic: 1 } };
}
export const inv = () => G.inv;
export function count(id) { return G.inv.items[id] || 0; }
export function has(id, n = 1) { return count(id) + (Object.values(G.inv.equip).includes(id) ? 1 : 0) >= n; }
export function add(id, n = 1, silent = false) {
  if (!ITEMS[id]) { console.warn('item desconhecido', id); return; }
  if (id === 'gold') { addGold(n); return; }
  G.inv.items[id] = (G.inv.items[id] || 0) + n;
  const it = ITEMS[id];
  // equipar automaticamente se slot vazio
  const slot = slotOf(it);
  if (slot && !G.inv.equip[slot]) equip(id);
  if (!silent) emit('itemGained', id, n);
  emit('invChanged');
}
export function remove(id, n = 1) {
  const c = G.inv.items[id] || 0;
  if (c < n) {
    // pode estar equipado
    if (Object.values(G.inv.equip).includes(id) && n === 1) { for (const k in G.inv.equip) if (G.inv.equip[k] === id) G.inv.equip[k] = null; emit('invChanged'); return true; }
    return false;
  }
  G.inv.items[id] = c - n;
  if (G.inv.items[id] <= 0) delete G.inv.items[id];
  emit('invChanged');
  return true;
}
export function addGold(n) { G.inv.gold = Math.max(0, G.inv.gold + n); if (n > 0) emit('goldGained', n); emit('invChanged'); }
export function slotOf(it) { return it.type === 'weapon' ? 'weapon' : it.type === 'bow' ? 'bow' : it.type === 'shield' ? 'shield' : it.type === 'armor' ? 'armor' : it.type === 'cloak' ? 'cloak' : null; }
export function equip(id) {
  const it = ITEMS[id]; const slot = slotOf(it); if (!slot) return;
  const cur = G.inv.equip[slot];
  if (!G.inv.items[id]) return;
  G.inv.items[id]--; if (G.inv.items[id] <= 0) delete G.inv.items[id];
  if (cur) G.inv.items[cur] = (G.inv.items[cur] || 0) + 1;
  G.inv.equip[slot] = id;
  audio.sfx('click');
  emit('equipChanged'); emit('invChanged');
}
export function unequip(slot) {
  const cur = G.inv.equip[slot]; if (!cur || slot === 'armor') return;
  G.inv.items[cur] = (G.inv.items[cur] || 0) + 1; G.inv.equip[slot] = null;
  emit('equipChanged'); emit('invChanged');
}
export function upgradeLevel(id) { return G.inv.upgrades[id] || 0; }
export function weaponStats(id) {
  if (!id) return null;
  const it = ITEMS[id]; const lv = upgradeLevel(id);
  return Object.assign({}, it, { dmg: Math.round(it.dmg * (1 + lv * UPGRADE.dmgPer)), level: lv });
}
export function playerDef() { let d = 0; for (const k of ['armor', 'cloak']) { const id = G.inv.equip[k]; if (id) d += ITEMS[id].def || 0; } return d; }
export function playerStamBonus() { const c = G.inv.equip.cloak; return c ? ITEMS[c].stam || 0 : 0; }
export function canUpgrade(id) {
  const lv = upgradeLevel(id); if (lv >= UPGRADE.max) return { ok: false, max: true };
  const gold = UPGRADE.gold[lv], ore = UPGRADE.ore[lv];
  return { ok: G.inv.gold >= gold && (G.inv.items.ore || 0) >= ore, gold, ore, lv };
}
export function doUpgrade(id) {
  const c = canUpgrade(id); if (!c.ok) return false;
  G.inv.gold -= c.gold; remove('ore', c.ore);
  G.inv.upgrades[id] = c.lv + 1;
  audio.sfx('clang'); audio.sfx('level');
  emit('weaponUpgraded', id, c.lv + 1);
  emit('invChanged');
  return true;
}
export function priceOf(id, selling = false) {
  const it = ITEMS[id]; let p = it.price || 0;
  // economia: Várden enfraquecida encarece; reputação reduz
  const mult = G.phase === 'fall' ? 1.25 : 1;
  return selling ? Math.max(1, Math.floor(p * 0.4)) : Math.ceil(p * mult);
}
