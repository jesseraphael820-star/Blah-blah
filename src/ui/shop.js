// Village shops: buy swords, armor, skins, hats, accessories, powers, pets and
// consumables; sell materials. Reputation discounts and requirement gating.
import { G } from '../core/context.js';
import { t } from '../core/i18n.js';
import { fmt } from '../core/utils.js';
import { SHOPS, repTier } from '../data/npcs.js';
import { SWORDS, ARMORS, HATS, ACCESSORIES, SKINS, PETS, POWERS, ITEMS } from '../data/items.js';
import { icon, swordIcon, powerIcon, itemIcon, img, rarityColor } from './icons.js';

const DB = { swords: SWORDS, armors: ARMORS, hats: HATS, accessories: ACCESSORIES, skins: SKINS, pets: PETS, powers: POWERS, items: ITEMS };
const NAME = { swords: 'item', armors: 'armor', hats: 'hat', accessories: 'acc', skins: 'skin', powers: 'power', items: 'item' };

export class Shop {
  constructor() {
    this.el = document.getElementById('shop');
    this.cat = null;
    this.preview = null;
  }
  open(id, npc) {
    this.id = id;
    this.def = SHOPS[id];
    this.npc = npc;
    this.cat = Object.keys(this.def).find((k) => Array.isArray(this.def[k]) && this.def[k].length);
    G.ui.shopOpen = true;
    G.input.unlock(); G.input.releaseAll();
    G.audio.sfx('open');
    this.cosmetic = id === 'tailor';
    if (this.cosmetic) G.cam.mode = 'menu';
    this.el.classList.remove('hidden');
    requestAnimationFrame(() => this.el.classList.add('show'));
    this.render();
  }
  close() {
    G.ui.shopOpen = false;
    this.el.classList.remove('show');
    setTimeout(() => { if (!G.ui.shopOpen) this.el.classList.add('hidden'); }, 200);
    if (this.preview) { this.preview = null; G.player.refreshLook(); }
    G.cam.mode = 'follow';
    G.audio.sfx('close');
    G.game.autosave();
  }

  discount() { const f = this.def.rep; return f ? repTier(G.state.rep[f] || 0).discount : 0; }
  price(cat, id) {
    const base = DB[cat][id].price || 0;
    return Math.round(base * (this.def.markup || 1) * (1 - this.discount()));
  }
  owned(cat, id) {
    if (cat === 'items') return false;
    if (cat === 'powers') return G.powers.owned(id);
    return G.inv.owns(cat, id);
  }
  reqCheck(cat, id) {
    const d = DB[cat][id];
    const r = d.req;
    if (!r) return null;
    if (r.level && G.state.player.level < r.level) return t('shop.reqLevel', { n: r.level });
    if (r.rep && (G.state.rep[r.rep[0]] || 0) < r.rep[1]) return t('shop.reqRep', { n: r.rep[1], fac: t('rep.' + r.rep[0]) });
    if (r.flag && !G.state.world.flags[r.flag]) return t('shop.reqFlag_' + r.flag);
    return null;
  }
  icon(cat, id) {
    if (cat === 'swords') return swordIcon(id);
    if (cat === 'powers') return powerIcon(id);
    if (cat === 'items') return itemIcon(id, ITEMS[id]);
    if (cat === 'armors') return icon('armor');
    if (cat === 'hats') return icon('hat', '#d8b850');
    if (cat === 'skins') return icon('shirt', '#' + (SKINS[id].pal?.shirt || 0x3f7fbf).toString(16).padStart(6, '0'));
    if (cat === 'pets') return icon('paw');
    return icon('star', '#ff7ab0');
  }
  name(cat, id) { return cat === 'pets' ? t('pet.' + id) : t(`${NAME[cat]}.${id}.name`); }
  desc(cat, id) { return cat === 'pets' ? t('pet.' + id + 'Desc') : t(`${NAME[cat]}.${id}.desc`); }

  render() {
    const cats = Object.keys(this.def).filter((k) => Array.isArray(this.def[k]) && this.def[k].length);
    cats.push('sell');
    const disc = this.discount();
    const list = this.cat === 'sell' ? this.sellList() : this.def[this.cat].map((id) => {
      const price = this.price(this.cat, id);
      const own = this.owned(this.cat, id);
      const req = own ? null : this.reqCheck(this.cat, id);
      const afford = G.state.player.gold >= price;
      const d = DB[this.cat][id];
      const rar = d.rarity || (price > 4000 ? 'legendary' : price > 1500 ? 'epic' : price > 500 ? 'rare' : 'common');
      let stat = '';
      if (this.cat === 'swords') stat = `⚔ ${d.dmg} · ⏱ ${d.speed.toFixed(2)}${d.effect ? ' · ✦ ' + t('effect.' + d.effect) : ''}`;
      if (this.cat === 'armors') stat = `🛡 ${d.def}`;
      if (this.cat === 'items') stat = `${t('ui.owned')}: ${G.inv.count(id)}`;
      if (this.cat === 'powers') stat = `${img(icon('bolt'))} ${d.cost} · ⏱ ${d.cd}s`;
      return `<div class="shop-item ${own ? 'owned' : ''} ${req ? 'locked' : ''}" style="--rc:${rarityColor(rar)}">
        <div class="si-icon">${img(this.icon(this.cat, id), 'px big')}</div>
        <div class="si-info"><b>${this.name(this.cat, id)}</b><small>${stat}</small><p>${this.desc(this.cat, id)}</p>${req ? `<em class="req">${img(icon('lock'))} ${req}</em>` : ''}</div>
        <div class="si-act">
          ${this.cosmetic && ['skins', 'hats', 'accessories'].includes(this.cat) ? `<button class="btn sm" data-try="${id}">${t('shop.try')}</button>` : ''}
          ${own ? `<span class="owned-tag">${t('ui.owned')}</span>` : `<button class="btn ${afford && !req ? 'primary' : ''}" data-buy="${id}" ${afford && !req ? '' : 'disabled'}>${img(icon('coin'))} ${fmt(price)}</button>`}
        </div></div>`;
    }).join('');
    this.el.innerHTML = `
      <div class="shop-frame">
        <header><div><small>${t('npc.' + this.npc.id + '.role')}</small><h1>${t('shop.' + this.id)}</h1></div>
          <div class="mh-right">${disc ? `<span class="disc">-${Math.round(disc * 100)}%</span>` : ''}${img(icon('coin'))}<b>${fmt(G.state.player.gold)}</b><button class="close">✕</button></div></header>
        <div class="subtabs">${cats.map((c) => `<button class="${c === this.cat ? 'on' : ''}" data-c="${c}">${t('shopCat.' + c)}</button>`).join('')}</div>
        <div class="shop-list">${list || `<div class="empty-msg">${t('shop.nothing')}</div>`}</div>
      </div>`;
    const e = this.el;
    e.querySelector('.close').onclick = () => this.close();
    e.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { this.cat = b.dataset.c; G.audio.sfx('click'); this.render(); });
    e.querySelectorAll('[data-buy]').forEach((b) => b.onclick = () => this.buy(this.cat, b.dataset.buy));
    e.querySelectorAll('[data-try]').forEach((b) => b.onclick = () => this.tryOn(this.cat, b.dataset.try));
    e.querySelectorAll('[data-sell]').forEach((b) => b.onclick = () => { const [id, n] = b.dataset.sell.split(':'); if (G.inv.sell(id, +n)) this.render(); });
  }
  sellList() {
    const ids = Object.keys(G.state.inv.items).filter((id) => G.inv.count(id) > 0 && ITEMS[id] && ITEMS[id].cat !== 'quest' && ITEMS[id].sell);
    return ids.map((id) => {
      const n = G.inv.count(id), p = ITEMS[id].sell;
      return `<div class="shop-item"><div class="si-icon">${img(itemIcon(id, ITEMS[id]), 'px big')}</div>
        <div class="si-info"><b>${t('item.' + id + '.name')}</b><small>${t('ui.owned')}: ${n} · ${p} Gold</small></div>
        <div class="si-act"><button class="btn sm" data-sell="${id}:1">${t('shop.sell1')} · ${p}</button>${n > 1 ? `<button class="btn sm" data-sell="${id}:${n}">${t('shop.sellAll')} · ${p * n}</button>` : ''}</div></div>`;
    }).join('');
  }
  tryOn(cat, id) {
    const eq = { ...G.state.inv.equipped };
    const slot = { skins: 'skin', hats: 'hat', accessories: 'accessory' }[cat];
    const saved = G.state.inv.equipped[slot];
    G.state.inv.equipped[slot] = id;
    G.player.refreshLook();
    G.state.inv.equipped[slot] = saved;
    this.preview = { slot, id, eq };
    G.audio.sfx('equip');
  }
  buy(cat, id) {
    const price = this.price(cat, id);
    if (this.owned(cat, id) || this.reqCheck(cat, id)) return;
    if (!G.prog.spendGold(price)) { G.audio.sfx('error'); return; }
    if (cat === 'items') G.inv.add(id, 1);
    else if (cat === 'powers') G.powers.unlock(id);
    else {
      G.inv.giveOwned(cat, id);
      const slot = { swords: 'sword', armors: 'armor', hats: 'hat', accessories: 'accessory', skins: 'skin', pets: 'pet' }[cat];
      G.inv.equip(slot, id);
    }
    G.audio.sfx('buy');
    G.ui.toast(t('shop.bought', { name: this.name(cat, id) }), 'gold');
    G.bus.emit('purchased', { cat, id, price });
    if (this.npc) { this.npc.model.setExpression('happy'); setTimeout(() => this.npc.model.setExpression('neutral'), 1500); }
    this.preview = null;
    G.ui.refreshHotbar();
    this.render();
  }
  update() {
    if (!G.ui.shopOpen) return;
    if (G.input.consume('pause') || G.input.consume('interact')) this.close();
  }
}
