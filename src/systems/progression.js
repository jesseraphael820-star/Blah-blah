// XP, levels, attributes, gold economy and the generic reward granting pipeline.
import { G } from '../core/context.js';
import { geneMult } from './lineage.js';
import { t } from '../core/i18n.js';
import { ARMORS, SWORDS } from '../data/items.js';

export function xpForLevel(l) { return Math.floor(40 * Math.pow(l, 1.45)); }
export const MAX_LEVEL = 30;

export class Progression {
  get p() { return G.state.player; }
  hours() { return G.state.world.day * 24 + G.state.world.time; }
  // active buffs: rested (slept), coffee, mead, tea; tired after 2 days without sleep
  buffs() {
    const b = G.state.player.buffs || {}, h = this.hours();
    const on = (k) => (b[k] || 0) > h;
    const last = G.state.player.lastSleep ?? 0;
    return { rested: on('rested'), coffee: on('coffee'), mead: on('mead'), tea: on('tea'), tired: h - last > 48 && !on('rested') };
  }
  addBuff(k, hours) {
    const p = G.state.player;
    p.buffs = p.buffs || {};
    p.buffs[k] = Math.max(p.buffs[k] || 0, this.hours()) + hours;
  }
  stats() {
    const p = this.p, a = p.attrs, l = p.level;
    const armor = ARMORS[G.state.inv.equipped.armor] || ARMORS.cloth;
    const tb = G.training ? G.training.bonus() : {};
    const bf = this.buffs();
    const v = (k) => tb[k] || 0;
    return {
      level: l,
      str: a.str, vit: a.vit, spi: a.spi, agi: a.agi,
      maxHp: 100 + (l - 1) * 12 + a.vit * 10 + v('maxHp'),
      maxEnergy: 60 + (l - 1) * 4 + a.spi * 6 + v('maxEnergy'),
      maxStamina: 100 + a.agi * 5 + v('maxStamina'),
      atkMul: (1 + a.str * 0.05 + (l - 1) * 0.03) * (1 + v('melee')) * (bf.mead ? 1.15 : 1) * (1 + (geneMult() - 1) * 0.5) * (G.retro?.active ? 1.2 : 1),
      powMul: (1 + a.spi * 0.06 + (l - 1) * 0.03) * (1 + v('power')) * (1 + (geneMult() - 1) * 0.5) * (G.retro?.active ? 1.2 : 1),
      crit: 0.05 + a.agi * 0.01 + v('crit'),
      def: armor.def + a.vit * 0.5 + v('def'),
      speedMul: 1 + a.agi * 0.01,
      runMul: 1 + v('runSpeed'), swimMul: 1 + v('swimSpeed'), horseMul: 1 + v('horseSpeed'),
      drainMul: Math.max(0.3, 1 + v('staminaDrain')),
      energyRegen: bf.rested ? 1.5 : bf.tired ? 0.7 : 1,
      staminaRegen: (1 + v('staminaRegen')) * (bf.rested ? 1.25 : 1) * (bf.coffee ? 1.5 : 1) * (bf.tired ? 0.75 : 1),
      hpRegen: (bf.tea ? 3 : 1) * (G.retro?.active ? 1.5 : 1),
      buffs: bf,
    };
  }
  weaponDps() {
    const s = SWORDS[G.state.inv.equipped.sword];
    return Math.round(s.dmg * this.stats().atkMul * s.speed);
  }

  addXP(n, at) {
    if (n <= 0) return;
    const p = this.p;
    n = Math.round(n);
    p.xp += n;
    if (at) G.ui.damageNumber(at.x, at.y + 2.6, at.z, '+' + n + ' XP', 'xp');
    let leveled = false;
    while (p.level < MAX_LEVEL && p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level++;
      p.attrPoints += 3;
      leveled = true;
      this.onLevelUp(p.level);
    }
    if (leveled) G.game.autosave();
  }
  onLevelUp(l) {
    const st = this.stats();
    this.p.hp = st.maxHp; this.p.energy = st.maxEnergy;
    G.audio.sfx('levelup');
    const P = G.player;
    G.particles.burst(P.pos.x, P.pos.y + 1, P.pos.z, 0xffd36a, 60, 6, { up: 4, life: 1.4 });
    G.particles.ring(P.pos.x, P.pos.y + 0.2, P.pos.z, 0xffd36a, 3, 40);
    const bonus = l % 5 === 0 ? 100 * l : 0;
    if (bonus) this.addGold(bonus, { source: 'level' });
    if (l >= 3) this.addTitle('adventurer');
    G.ui.levelUpBanner(l, bonus);
    G.bus.emit('levelUp', l);
  }
  spendAttr(k) {
    if (this.p.attrPoints <= 0) return false;
    this.p.attrs[k]++;
    this.p.attrPoints--;
    G.audio.sfx('click');
    return true;
  }

  addGold(n, o = {}) {
    if (G.retro?.active && o.source !== 'sell' && o.source !== 'retro') n *= 1.25; // Retro Fantasy: more Gold all day
    n = Math.round(n);
    if (n <= 0) return;
    this.p.gold += n;
    G.state.ach.stats.goldEarned += n;
    G.events?.track('gold', n);
    G.ui.goldPulse(n);
    G.bus.emit('gold', n);
  }
  spendGold(n) {
    if (this.p.gold < n) return false;
    this.p.gold -= n;
    G.ui.goldPulse(-n);
    return true;
  }
  addTitle(id) {
    const tl = G.state.ach.titles;
    if (tl.includes(id)) return;
    tl.push(id);
    G.ui.toast(t('ui.newTitle', { title: t('title.' + id) }), 'title');
  }
  addRep(fac, n) {
    G.state.rep[fac] = (G.state.rep[fac] || 0) + n;
    G.ui.feed(`+${n} ${t('rep.' + fac)}`, 'rep');
  }

  // Generic reward pipeline used by quests, chests, events, achievements...
  grant(r, o = {}) {
    if (!r) return;
    const inv = G.inv;
    if (r.gold) this.addGold(r.gold, { source: o.source });
    if (r.xp) this.addXP(r.xp, o.at);
    if (r.items) for (const [id, n] of Object.entries(r.items)) { inv.add(id, n); G.ui.feed(`+${n} ${t('item.' + id + '.name')}`, 'item', id); }
    const own = (type, ids, key) => {
      for (const id of ids || []) if (inv.giveOwned(type, id)) { G.ui.toast(t('ui.unlocked', { name: t(key + '.' + id + '.name') }), 'unlock'); }
    };
    own('swords', r.swords, 'item');
    own('armors', r.armors, 'armor');
    own('hats', r.hats, 'hat');
    own('accessories', r.accessories, 'acc');
    own('skins', r.skins, 'skin');
    for (const id of r.powers || []) if (G.powers.unlock(id)) G.ui.toast(t('ui.powerUnlocked', { name: t('power.' + id + '.name') }), 'power');
    for (const id of r.pets || []) if (inv.giveOwned('pets', id)) { G.ui.toast(t('ui.petUnlocked', { name: t('pet.' + id) }), 'unlock'); inv.equip('pet', id); }
    for (const id of r.titles || []) this.addTitle(id);
    for (const f of r.flags || []) G.state.world.flags[f] = true;
    if (r.rep) for (const [k, v] of Object.entries(r.rep)) this.addRep(k, v);
    if (r.gold && !o.quiet && o.title) G.ui.toast(`${o.title} · +${r.gold} Gold`, 'gold');
    else if (o.title && !o.quiet) G.ui.toast(o.title, 'gold');
    G.bus.emit('inventory');
  }
}
