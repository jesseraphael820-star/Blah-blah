// Inventory: stackable items, owned equipment collections, equipping and consumables.
import { G } from '../core/context.js';
import { t } from '../core/i18n.js';
import { ITEMS, SWORDS, ARMORS, itemCategory } from '../data/items.js';
import { Pet } from '../entities/animals.js';

const TYPE_KEY = { sword: 'swords', armor: 'armors', hat: 'hats', accessory: 'accessories', skin: 'skins', pet: 'pets' };

export class Inventory {
  get s() { return G.state.inv; }
  count(id) { return this.s.items[id] || 0; }
  add(id, n = 1) {
    if (SWORDS[id]) { this.giveOwned('swords', id); return; }
    this.s.items[id] = (this.s.items[id] || 0) + n;
    G.bus.emit('inventory', id);
  }
  remove(id, n = 1) {
    const c = this.count(id);
    if (c < n) return false;
    this.s.items[id] = c - n;
    if (this.s.items[id] <= 0) delete this.s.items[id];
    G.bus.emit('inventory', id);
    return true;
  }
  owns(type, id) { return (this.s.owned[type] || []).includes(id); }
  giveOwned(type, id) {
    const arr = this.s.owned[type];
    if (!arr || arr.includes(id)) return false;
    arr.push(id);
    G.bus.emit('owned', { type, id });
    return true;
  }
  equip(slot, id) {
    const key = TYPE_KEY[slot];
    if (id && id !== 'none' && id !== 'custom' && key && !this.owns(key, id)) return false;
    this.s.equipped[slot] = id;
    if (slot === 'pet') this.spawnPet();
    else G.player.refreshLook();
    G.audio.sfx('equip');
    G.bus.emit('equip', { slot, id });
    return true;
  }
  spawnPet() {
    if (G.pet) { G.pet.dispose(); G.pet = null; }
    const id = this.s.equipped.pet;
    if (id && this.owns('pets', id)) G.pet = new Pet(id);
  }

  use(id) {
    const d = ITEMS[id];
    if (!d || d.cat !== 'consumable' || this.count(id) <= 0) return false;
    const P = G.player, st = G.prog.stats();
    if (d.heal && G.state.player.hp >= st.maxHp && !d.energy && !d.buff) { G.ui.toast(t('ui.fullHealth'), 'info'); return false; }
    this.remove(id, 1);
    if (d.heal) P.heal(d.heal);
    if (d.energy) G.state.player.energy = Math.min(st.maxEnergy, G.state.player.energy + d.energy);
    if (d.buff) { G.prog.addBuff(d.buff, d.hours || 2); G.ui.toast(t('buff.' + d.buff) + ' · ' + t('buff.' + d.buff + 'Desc'), 'power'); }
    G.audio.sfx(id.includes('potion') || id === 'elixir' ? 'drink' : 'pickup');
    G.audio.sfx('heal', { vol: 0.5 });
    return true;
  }
  quickPotion() {
    const st = G.prog.stats();
    const missing = st.maxHp - G.state.player.hp;
    const order = missing > 80 ? ['potion_large', 'potion_small', 'stew', 'bread', 'apple', 'elixir'] : ['potion_small', 'bread', 'apple', 'stew', 'potion_large', 'elixir'];
    for (const id of order) if (this.count(id) > 0) { if (this.use(id)) G.ui.feed(t('item.' + id + '.name'), 'use', id); return; }
    G.ui.toast(t('ui.noPotions'), 'warn');
    G.audio.sfx('error');
  }
  sellPrice(id) { return ITEMS[id]?.sell || 0; }
  sell(id, n = 1) {
    const p = this.sellPrice(id);
    if (!p || this.count(id) < n || ITEMS[id].cat === 'quest') return false;
    this.remove(id, n);
    G.prog.addGold(p * n, { source: 'sell' });
    G.audio.sfx('coin');
    return true;
  }
  list(cat) {
    return Object.entries(this.s.items).filter(([id, n]) => n > 0 && itemCategory(id) === cat).map(([id, n]) => ({ id, n }));
  }
  totalItems() { return Object.values(this.s.items).reduce((a, b) => a + b, 0); }
}
export { ARMORS };
