// Game menu (pauses the game): Inventory, Character, Swords, Powers, Journal,
// Map, Achievements/Leaderboard and Settings.
import { G } from '../core/context.js';
import { t, setLang, getLang, LANG_LIST } from '../core/i18n.js';
import { fmt, clamp } from '../core/utils.js';
import { icon, swordIcon, powerIcon, itemIcon, img, rarityColor } from './icons.js';
import { SWORDS, ARMORS, HATS, ACCESSORIES, SKINS, PETS, POWERS, ITEMS, RARITY, POWER_MAX, powerUpgradeCost, itemCategory } from '../data/items.js';
import { QUESTS, QUEST_ORDER, ACHIEVEMENTS, RIVALS, DAILY_REWARDS } from '../data/quests.js';
import { WAYSTONES } from '../data/world.js';
import { repTier } from '../data/npcs.js';
import { saveSettings, deleteSave } from '../core/save.js';

const TABS = ['inventory', 'character', 'swords', 'powers', 'journal', 'map', 'achievements', 'settings'];
const TAB_ICON = { inventory: ['bag'], character: ['user', '#4aa8ff'], swords: ['__sword'], powers: ['orb', '#6fd8ff'], journal: ['scroll'], map: ['map'], achievements: ['trophy'], settings: ['gear'] };
const HAIR_STYLES = ['short', 'long', 'spiky', 'ponytail', 'bun', 'braid', 'messy', 'bald'];
export const HAIR_COLORS = [0x2a1a10, 0x5a3a22, 0x8a5a2a, 0xd0a050, 0xf0e0a0, 0xb83a2a, 0x3a3a3a, 0xe8e8e8, 0x3a6ad0, 0xd05aa0, 0x4ab06a];
export const SKIN_TONES = [0xf8d8b8, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5a3a24];
export const CLOTH_COLORS = [0x3f7fbf, 0xc84a3a, 0x4a9a4a, 0xe0b030, 0x7a4ab0, 0x2a2a3a, 0xf0ece0, 0xe07ab0, 0x3ab0b0, 0x8a5a32, 0x4a3b2a, 0x5a6a7a];
export const EYE_COLORS = [0x2b4a7a, 0x3a2a1a, 0x3a7a3a, 0x6a3a8a, 0x1a1a1a, 0x8a5a1a];
const hx = (n) => '#' + n.toString(16).padStart(6, '0');

export class Menu {
  constructor() {
    this.el = document.getElementById('menu');
    this.tab = 'inventory';
    this.invCat = 'weapons';
    this.sel = null;
    this.mapView = { cx: 0, cz: 0, zoom: 1 };
    this.journalTab = 'active';
    this.achTab = 'ach';
  }
  get isOpen() { return G.ui.menuOpen; }

  open(tab = 'inventory', opts = {}) {
    if (G.dialogue.active || G.ui.overlay || G.ui.shopOpen) return;
    G.ui.menuOpen = true;
    G.paused = true;
    G.input.unlock();
    G.input.releaseAll();
    this.tab = TABS.includes(tab) ? tab : 'inventory';
    this.opts = opts;
    if (this.tab === 'map') { const p = G.sky.underground ? { x: 40, z: -186 } : G.player.pos; this.mapView = { cx: p.x, cz: p.z, zoom: 1.6 }; }
    this.el.classList.remove('hidden');
    requestAnimationFrame(() => this.el.classList.add('show'));
    this.render();
  }
  close() {
    if (!this.isOpen) return;
    G.ui.menuOpen = false;
    G.paused = false;
    G.cam.mode = 'follow';
    this.el.classList.remove('show');
    setTimeout(() => { if (!this.isOpen) this.el.classList.add('hidden'); }, 200);
    G.audio.sfx('close');
    G.game.autosave();
    saveSettings(G.settings);
  }
  toggle(tab) { if (this.isOpen && this.tab === tab) this.close(); else if (this.isOpen) { this.tab = tab; this.render(); } else this.open(tab); }

  render() {
    G.cam.mode = this.tab === 'character' ? 'menu' : 'follow';
    const tabs = TABS.map((k) => {
      const [ic, col] = TAB_ICON[k];
      const src = ic === '__sword' ? swordIcon('iron_sword') : icon(ic, col);
      return `<button class="mtab ${k === this.tab ? 'on' : ''}" data-tab="${k}">${img(src)}<span>${t('menu.' + k)}</span></button>`;
    }).join('');
    this.el.innerHTML = `
      <div class="menu-frame ${this.tab}">
        <nav class="menu-tabs">${tabs}</nav>
        <section class="menu-body">
          <header class="menu-head"><h1>${t('menu.' + this.tab)}</h1>
            <div class="mh-right">${img(icon('coin'))}<b>${fmt(G.state.player.gold)}</b><button class="close" title="Esc">✕</button></div>
          </header>
          <div class="menu-content"></div>
        </section>
      </div>`;
    this.el.querySelectorAll('.mtab').forEach((b) => b.onclick = () => { G.audio.sfx('click'); this.tab = b.dataset.tab; this.sel = null; if (this.tab === 'map') { const p = G.sky.underground ? { x: 40, z: -186 } : G.player.pos; this.mapView = { cx: p.x, cz: p.z, zoom: 1.6 }; } this.render(); });
    this.el.querySelector('.close').onclick = () => this.close();
    this.content = this.el.querySelector('.menu-content');
    this['r_' + this.tab]();
  }
  rerender() { const sc = this.content?.scrollTop; this.render(); if (this.content) this.content.scrollTop = sc || 0; }

  // ================= INVENTORY =================
  r_inventory() {
    const cats = ['weapons', 'armor', 'skins', 'powers', 'materials', 'consumables', 'quest'];
    const inv = G.state.inv;
    let items = [];
    if (this.invCat === 'weapons') items = inv.owned.swords.map((id) => ({ id, kind: 'sword' }));
    else if (this.invCat === 'armor') items = inv.owned.armors.map((id) => ({ id, kind: 'armor' })).concat(inv.owned.hats.filter((h) => h !== 'none').map((id) => ({ id, kind: 'hat' }))).concat(inv.owned.accessories.filter((h) => h !== 'none').map((id) => ({ id, kind: 'acc' })));
    else if (this.invCat === 'skins') items = inv.owned.skins.map((id) => ({ id, kind: 'skin' })).concat(inv.owned.pets.map((id) => ({ id, kind: 'pet' })));
    else if (this.invCat === 'powers') items = inv.owned.powers.map((id) => ({ id, kind: 'power' }));
    else items = G.inv.list(this.invCat).map(({ id, n }) => ({ id, n, kind: 'item' }));
    const grid = items.map((it, i) => {
      const { src, rar } = this.itemVisual(it);
      const eq = this.isEquipped(it);
      return `<button class="islot ${rar} ${eq ? 'eq' : ''} ${this.sel && this.sel.id === it.id && this.sel.kind === it.kind ? 'sel' : ''}" data-i="${i}" style="--rc:${rarityColor(rar)}">${img(src)}${it.n ? `<b>${it.n}</b>` : ''}${eq ? '<i>E</i>' : ''}</button>`;
    }).join('') || `<div class="empty-msg">${t('menu.emptyCat')}</div>`;
    const st = G.prog.stats();
    this.content.innerHTML = `
      <div class="inv-layout">
        <div class="inv-left">
          <div class="subtabs">${cats.map((c) => `<button class="${c === this.invCat ? 'on' : ''}" data-c="${c}">${t('cat.' + c)}</button>`).join('')}</div>
          <div class="inv-grid">${grid}</div>
          <div class="inv-stats">
            <div>${img(icon('heart'))} ${Math.round(G.state.player.hp)}/${st.maxHp}</div>
            <div>${img(icon('bolt'))} ${Math.round(G.state.player.energy)}/${st.maxEnergy}</div>
            <div>${img(swordIcon(inv.equipped.sword))} ${t('ui.dps')} ${G.prog.weaponDps()}</div>
            <div>${img(icon('armor'))} ${t('ui.defense')} ${st.def.toFixed(0)}</div>
          </div>
        </div>
        <div class="inv-detail">${this.detail(this.sel)}</div>
      </div>`;
    this.content.querySelectorAll('.subtabs button').forEach((b) => b.onclick = () => { this.invCat = b.dataset.c; this.sel = null; G.audio.sfx('click'); this.rerender(); });
    this.content.querySelectorAll('.islot').forEach((b) => b.onclick = () => { this.sel = items[+b.dataset.i]; G.audio.sfx('click'); this.rerender(); });
    this.bindDetail();
  }
  itemVisual(it) {
    switch (it.kind) {
      case 'sword': return { src: swordIcon(it.id), rar: SWORDS[it.id].rarity };
      case 'armor': return { src: icon('armor'), rar: ARMORS[it.id].def >= 14 ? 'epic' : ARMORS[it.id].def >= 8 ? 'rare' : 'common' };
      case 'hat': return { src: icon('hat', '#d8b850'), rar: (HATS[it.id].price || 0) > 900 ? 'epic' : 'common' };
      case 'acc': return { src: icon('star', '#ff7ab0'), rar: (ACCESSORIES[it.id].price || 0) > 1000 ? 'legendary' : 'rare' };
      case 'skin': return { src: icon('shirt', hx(SKINS[it.id].pal?.shirt || G.state.appearance.shirt)), rar: (SKINS[it.id].price || 0) > 2000 ? 'legendary' : (SKINS[it.id].price || 0) > 1000 ? 'epic' : 'rare' };
      case 'pet': return { src: icon('paw'), rar: 'special' };
      case 'power': return { src: powerIcon(it.id), rar: 'magic' };
      default: return { src: itemIcon(it.id, ITEMS[it.id]), rar: ITEMS[it.id]?.cat === 'quest' ? 'legendary' : 'common' };
    }
  }
  isEquipped(it) {
    const e = G.state.inv.equipped;
    return (it.kind === 'sword' && e.sword === it.id) || (it.kind === 'armor' && e.armor === it.id) || (it.kind === 'hat' && e.hat === it.id) || (it.kind === 'acc' && e.accessory === it.id) || (it.kind === 'skin' && e.skin === it.id) || (it.kind === 'pet' && e.pet === it.id) || (it.kind === 'power' && G.state.inv.powerSlots.includes(it.id));
  }
  detail(it) {
    if (!it) return `<div class="detail-empty">${img(icon('bag'), 'px big')}<p>${t('menu.selectItem')}</p></div>`;
    const { src, rar } = this.itemVisual(it);
    const nameKey = { sword: 'item', armor: 'armor', hat: 'hat', acc: 'acc', skin: 'skin', pet: 'pet', power: 'power', item: 'item' }[it.kind];
    const name = it.kind === 'pet' ? t('pet.' + it.id) : t(`${nameKey}.${it.id}.name`);
    const desc = it.kind === 'pet' ? t('pet.' + it.id + 'Desc') : t(`${nameKey}.${it.id}.desc`);
    let stats = '', actions = '';
    if (it.kind === 'sword') {
      const s = SWORDS[it.id];
      stats = this.statRows([[t('ui.damage'), s.dmg], [t('ui.speed'), s.speed.toFixed(2)], [t('ui.rarity'), `<span style="color:${rarityColor(s.rarity)}">${t('rarity.' + s.rarity)}</span>`], s.effect ? [t('ui.effect'), t('effect.' + s.effect)] : null]);
      actions = this.isEquipped(it) ? `<button class="btn" disabled>${t('ui.equipped')}</button>` : `<button class="btn primary" data-act="equip">${t('ui.equip')}</button>`;
    } else if (['armor', 'hat', 'acc', 'skin', 'pet'].includes(it.kind)) {
      if (it.kind === 'armor') stats = this.statRows([[t('ui.defense'), ARMORS[it.id].def]]);
      if (it.kind === 'pet') stats = this.statRows([[t('ui.ability'), t('petAbility.' + PETS[it.id].ability)]]);
      actions = this.isEquipped(it) ? `<button class="btn" data-act="unequip">${t('ui.unequip')}</button>` : `<button class="btn primary" data-act="equip">${t('ui.equip')}</button>`;
    } else if (it.kind === 'power') {
      stats = this.statRows([[t('ui.level'), G.powers.level(it.id)], [t('ui.cost'), G.powers.costFor(it.id) + ' ' + t('ui.energy')], [t('ui.cooldown'), G.powers.cdFor(it.id).toFixed(1) + 's']]);
      actions = `<button class="btn primary" data-act="topowers">${t('menu.powers')}</button>`;
    } else {
      const d = ITEMS[it.id];
      const rows = [[t('ui.owned'), it.n]];
      if (d.heal) rows.push([t('ui.heals'), d.heal >= 9999 ? t('ui.full') : '+' + d.heal]);
      if (d.energy) rows.push([t('ui.energy'), d.energy >= 9999 ? t('ui.full') : '+' + d.energy]);
      if (d.sell) rows.push([t('ui.sellValue'), d.sell + ' Gold']);
      stats = this.statRows(rows);
      if (d.cat === 'consumable') actions = `<button class="btn primary" data-act="use">${t('ui.use')}</button>`;
    }
    return `<div class="detail-card" style="--rc:${rarityColor(rar)}">
      <div class="dc-top">${img(src, 'px huge')}<div><h3>${name}</h3><small style="color:${rarityColor(rar)}">${t('kind.' + it.kind)}</small></div></div>
      <p class="dc-desc">${desc}</p>${stats}<div class="dc-actions">${actions}</div></div>`;
  }
  statRows(rows) { return `<table class="stats">${rows.filter(Boolean).map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>`; }
  bindDetail() {
    this.content.querySelectorAll('[data-act]').forEach((b) => b.onclick = () => {
      const it = this.sel, a = b.dataset.act;
      const slot = { sword: 'sword', armor: 'armor', hat: 'hat', acc: 'accessory', skin: 'skin', pet: 'pet' }[it.kind];
      if (a === 'equip') G.inv.equip(slot, it.id);
      if (a === 'unequip') G.inv.equip(slot, { hat: 'none', accessory: 'none', skin: 'custom', armor: 'cloth', pet: null }[slot]);
      if (a === 'use') { G.inv.use(it.id); if (G.inv.count(it.id) <= 0) this.sel = null; else this.sel.n = G.inv.count(it.id); }
      if (a === 'topowers') { this.tab = 'powers'; }
      this.rerender();
    });
  }

  // ================= CHARACTER =================
  r_character() {
    const A = G.state.appearance, p = G.state.player, st = G.prog.stats();
    const swatch = (key, list) => list.map((c) => `<button class="sw ${A[key] === c ? 'on' : ''}" data-k="${key}" data-v="${c}" style="background:${hx(c)}"></button>`).join('');
    const ownedRow = (type, list, slot) => list.map((id) => `<button class="chip ${G.state.inv.equipped[slot] === id ? 'on' : ''}" data-slot="${slot}" data-id="${id}">${t(`${type}.${id}.name`)}</button>`).join('');
    const attrs = ['str', 'vit', 'spi', 'agi'].map((k) => `<div class="attr"><b>${t('attr.' + k)}</b><span>${p.attrs[k]}</span><small>${t('attr.' + k + 'Desc')}</small><button class="btn sm" data-attr="${k}" ${p.attrPoints <= 0 ? 'disabled' : ''}>+</button></div>`).join('');
    const titles = G.state.ach.titles.map((id) => `<button class="chip ${p.title === id ? 'on' : ''}" data-title="${id}">${t('title.' + id)}</button>`).join('');
    const pets = G.state.inv.owned.pets;
    this.content.innerHTML = `
      <div class="char-layout">
        <div class="char-col">
          <div class="card"><h4>${t('char.name')}</h4><input class="name-in" maxlength="16" value="${(A.name || '').replace(/"/g, '')}"></div>
          <div class="card"><h4>${t('char.hair')}</h4><div class="chips">${HAIR_STYLES.map((h) => `<button class="chip ${A.hairStyle === h ? 'on' : ''}" data-hair="${h}">${t('hair.' + h)}</button>`).join('')}</div><div class="swatches">${swatch('hairColor', HAIR_COLORS)}</div></div>
          <div class="card"><h4>${t('char.skin')}</h4><div class="swatches">${swatch('skinTone', SKIN_TONES)}</div><h4>${t('char.eyes')}</h4><div class="swatches">${swatch('eyeColor', EYE_COLORS)}</div></div>
          <div class="card"><h4>${t('char.clothes')}</h4><small>${t('char.shirt')}</small><div class="swatches">${swatch('shirt', CLOTH_COLORS)}</div><small>${t('char.pants')}</small><div class="swatches">${swatch('pants', CLOTH_COLORS)}</div></div>
        </div>
        <div class="char-col">
          <div class="card"><h4>${t('char.outfit')}</h4>
            <small>${t('cat.skins')}</small><div class="chips">${ownedRow('skin', G.state.inv.owned.skins, 'skin')}</div>
            <small>${t('char.armor')}</small><div class="chips">${ownedRow('armor', G.state.inv.owned.armors, 'armor')}</div>
            <small>${t('char.hats')}</small><div class="chips">${ownedRow('hat', G.state.inv.owned.hats, 'hat')}</div>
            <small>${t('char.accessories')}</small><div class="chips">${ownedRow('acc', G.state.inv.owned.accessories, 'accessory')}</div>
            <small>${t('char.pet')}</small><div class="chips"><button class="chip ${!G.state.inv.equipped.pet ? 'on' : ''}" data-slot="pet" data-id="">${t('ui.none')}</button>${pets.map((id) => `<button class="chip ${G.state.inv.equipped.pet === id ? 'on' : ''}" data-slot="pet" data-id="${id}">${t('pet.' + id)}</button>`).join('')}</div>
            <small>${t('char.horse')}</small><div class="chips">${(G.state.inv.owned.horses || []).map((h) => `<button class="chip ${G.state.inv.equipped.horse === h.id ? 'on' : ''}" data-horse="${h.id}" style="${G.state.inv.equipped.horse === h.id ? '' : `border-color:${rarityColor({ common: 'common', rare: 'rare', epic: 'epic', legendary: 'legendary', mythic: 'magic' }[h.breed])}`}">${t('horse.' + h.breed)}</button>`).join('') || `<span class="hint">${t('char.noHorse')}</span>`}</div>
            <p class="hint">${t('char.shopHint')}</p>
          </div>
          <div class="card"><h4>${t('char.attributes')} <span class="pts">${t('ui.points')}: ${p.attrPoints}</span></h4><div class="attrs">${attrs}</div>
            <table class="stats compact"><tr><td>${t('ui.maxHp')}</td><td>${st.maxHp}</td><td>${t('ui.maxEnergy')}</td><td>${st.maxEnergy}</td></tr><tr><td>${t('ui.crit')}</td><td>${Math.round(st.crit * 100)}%</td><td>${t('ui.defense')}</td><td>${st.def.toFixed(0)}</td></tr></table></div>
          <div class="card"><h4>${t('char.titles')}</h4><div class="chips">${titles}</div></div>
          <div class="card"><h4>${t('char.reputation')}</h4>${['aurora', 'camp'].map((f) => { const v = G.state.rep[f] || 0; const tier = repTier(v); return `<div class="rep"><b>${t('rep.' + f)}</b><span>${t('repTier.' + tier.id)} (${v})</span><div class="bar mini"><i style="width:${clamp(v / 150 * 100, 0, 100)}%"></i></div><small>${t('ui.discount')} ${Math.round(tier.discount * 100)}%</small></div>`; }).join('')}</div>
        </div>
      </div>`;
    const c = this.content;
    c.querySelector('.name-in').oninput = (e) => { A.name = e.target.value.slice(0, 16) || 'Hero'; };
    c.querySelectorAll('[data-hair]').forEach((b) => b.onclick = () => { A.hairStyle = b.dataset.hair; G.player.refreshLook(); G.audio.sfx('click'); this.rerender(); });
    c.querySelectorAll('.sw').forEach((b) => b.onclick = () => { A[b.dataset.k] = +b.dataset.v; G.player.refreshLook(); G.audio.sfx('click'); this.rerender(); });
    c.querySelectorAll('[data-horse]').forEach((b) => b.onclick = () => { if (G.horses.riding) G.horses.dismount(); G.state.inv.equipped.horse = b.dataset.horse; G.horses.spawnOwned(); G.audio.sfx('equip'); this.rerender(); });
    c.querySelectorAll('[data-slot]').forEach((b) => b.onclick = () => { G.inv.equip(b.dataset.slot, b.dataset.id || null); this.rerender(); });
    c.querySelectorAll('[data-attr]').forEach((b) => b.onclick = () => { G.prog.spendAttr(b.dataset.attr); this.rerender(); });
    c.querySelectorAll('[data-title]').forEach((b) => b.onclick = () => { G.state.player.title = b.dataset.title; G.audio.sfx('click'); this.rerender(); });
  }

  // ================= SWORDS (collection) =================
  r_swords() {
    const ids = Object.keys(SWORDS).sort((a, b) => RARITY[SWORDS[a].rarity].order - RARITY[SWORDS[b].rarity].order || SWORDS[a].dmg - SWORDS[b].dmg);
    const owned = G.state.inv.owned.swords;
    const cards = ids.map((id) => {
      const s = SWORDS[id], has = owned.includes(id), eq = G.state.inv.equipped.sword === id;
      return `<div class="sword-card ${has ? '' : 'locked'} ${eq ? 'eq' : ''}" style="--rc:${rarityColor(s.rarity)}">
        <div class="sc-icon">${img(swordIcon(id), 'px huge')}</div>
        <div class="sc-info"><h4>${has ? t('item.' + id + '.name') : '???'}</h4><small style="color:${rarityColor(s.rarity)}">${t('rarity.' + s.rarity)}</small>
          <div class="sc-stats"><span>⚔ ${s.dmg}</span><span>⏱ ${s.speed.toFixed(2)}</span>${s.effect ? `<span>✦ ${t('effect.' + s.effect)}</span>` : ''}</div>
          <p>${has ? t('item.' + id + '.desc') : t('item.' + id + '.hint')}</p></div>
        <div class="sc-act">${has ? (eq ? `<button class="btn" disabled>${t('ui.equipped')}</button>` : `<button class="btn primary" data-eq="${id}">${t('ui.equip')}</button>`) : img(icon('lock'))}</div></div>`;
    }).join('');
    this.content.innerHTML = `<div class="collection-head">${t('menu.swordsOwned', { n: owned.length, total: ids.length })}</div><div class="sword-list">${cards}</div>`;
    this.content.querySelectorAll('[data-eq]').forEach((b) => b.onclick = () => { G.inv.equip('sword', b.dataset.eq); this.rerender(); });
  }

  // ================= POWERS =================
  r_powers() {
    const slots = G.state.inv.powerSlots;
    const owned = G.state.inv.owned.powers;
    const slotHtml = slots.map((id, i) => `<button class="pslot ${this.pickSlot === i ? 'pick' : ''}" data-slot="${i}"><kbd>${i + 1}</kbd>${id ? img(powerIcon(id), 'px big') : '<span>—</span>'}<small>${id ? t('power.' + id + '.name') : t('ui.empty')}</small></button>`).join('');
    const list = Object.keys(POWERS).map((id) => {
      const has = owned.includes(id), lvl = G.powers.level(id);
      const up = has ? G.powers.canUpgrade(id) : null;
      const cost = lvl < POWER_MAX ? powerUpgradeCost(lvl) : null;
      const pips = Array.from({ length: POWER_MAX }, (_, k) => `<i class="${k < lvl && has ? 'on' : ''}"></i>`).join('');
      return `<div class="power-card ${has ? '' : 'locked'}">
        <div class="pc-icon">${img(powerIcon(id), 'px huge')}</div>
        <div class="pc-info"><h4>${t('power.' + id + '.name')}</h4><div class="pips">${pips}</div><p>${t('power.' + id + '.desc')}</p>
          <div class="pc-stats"><span>${img(icon('bolt'))} ${G.powers.costFor(id)}</span><span>⏱ ${G.powers.cdFor(id).toFixed(1)}s</span>${POWERS[id].dmg ? `<span>⚔ ${Math.round(G.powers.dmgFor(id))}</span>` : ''}</div>
          ${has ? '' : `<small class="how">${t('power.' + id + '.how')}</small>`}</div>
        <div class="pc-act">${has ? `
          <button class="btn sm" data-assign="${id}">${t('ui.assign')}</button>
          ${cost ? `<button class="btn sm ${up.ok ? 'primary' : ''}" data-up="${id}" ${up.ok ? '' : 'disabled'} title="${up.reason ? t('ui.need_' + up.reason) : ''}">${t('ui.upgrade')} · ${img(icon('coin'))}${fmt(cost.gold)} · ${img(icon('essence'))}${cost.essence} · ${t('ui.lv')}${cost.level}</button>` : `<span class="maxed">${t('ui.max')}</span>`}` : img(icon('lock'))}</div></div>`;
    }).join('');
    this.content.innerHTML = `<div class="power-slots"><p>${t('menu.powerSlotsHint')}</p><div class="pslots">${slotHtml}</div></div><div class="power-list">${list}</div>`;
    this.content.querySelectorAll('[data-slot]').forEach((b) => b.onclick = () => { this.pickSlot = +b.dataset.slot; G.audio.sfx('click'); this.rerender(); });
    this.content.querySelectorAll('[data-assign]').forEach((b) => b.onclick = () => {
      const slot = this.pickSlot ?? Math.max(0, G.state.inv.powerSlots.indexOf(null));
      G.powers.equip(b.dataset.assign, slot);
      this.pickSlot = null;
      G.audio.sfx('equip');
      G.ui.refreshHotbar();
      this.rerender();
    });
    this.content.querySelectorAll('[data-up]').forEach((b) => b.onclick = () => { G.powers.upgrade(b.dataset.up); G.ui.refreshHotbar(); this.rerender(); });
  }

  // ================= JOURNAL =================
  r_journal() {
    const tabs = ['active', 'done', 'challenges', 'daily'];
    const head = `<div class="subtabs">${tabs.map((k) => `<button class="${k === this.journalTab ? 'on' : ''}" data-jt="${k}">${t('journal.' + k)}</button>`).join('')}</div>`;
    let body = '';
    if (this.journalTab === 'active' || this.journalTab === 'done') {
      const ids = this.journalTab === 'active' ? QUEST_ORDER.filter((id) => G.quests.isActive(id)) : G.state.quests.done.slice().reverse();
      const sel = this.selQuest && ids.includes(this.selQuest) ? this.selQuest : ids[0];
      this.selQuest = sel;
      const list = ids.map((id) => `<button class="qitem ${QUESTS[id].type} ${id === sel ? 'on' : ''}" data-q="${id}"><i>${QUESTS[id].type === 'main' ? t('journal.mainTag') : t('journal.sideTag')}</i><b>${t('q.' + id + '.title')}</b>${G.state.quests.tracked === id ? `<em>${img(icon('flag', '#ffc83a'))}</em>` : ''}</button>`).join('') || `<div class="empty-msg">${t('journal.none')}</div>`;
      body = `<div class="journal-layout"><div class="qlist">${list}</div><div class="qdetail">${sel ? this.questDetail(sel) : ''}</div></div>`;
    } else if (this.journalTab === 'challenges') {
      const ch = G.events.challenges();
      body = `<p class="hint">${t('journal.challengesHint')}</p><div class="challenge-list">${ch.map((c, i) => `<div class="challenge ${c.claimed ? 'claimed' : ''}"><b>${t('challenge.' + c.id, { n: c.n })}</b><div class="bar mini"><i style="width:${clamp(c.p / c.n * 100, 0, 100)}%"></i></div><span>${Math.min(c.p, c.n)}/${c.n}</span><em>${img(icon('coin'))}${c.gold} · ${c.xp} XP</em>${c.claimed ? `<button class="btn sm" disabled>✓</button>` : `<button class="btn sm ${c.p >= c.n ? 'primary' : ''}" data-claim="${i}" ${c.p >= c.n ? '' : 'disabled'}>${t('ui.claim')}</button>`}</div>`).join('')}</div>`;
    } else {
      const d = G.state.daily;
      const can = G.events.canClaimDaily();
      const streak = d.streak;
      body = `<p class="hint">${t('journal.dailyHint')}</p><div class="daily-grid">${DAILY_REWARDS.map((r, i) => {
        const done = i < (can ? streak % 7 : ((streak - 1) % 7) + 1);
        const today = can && i === streak % 7;
        return `<div class="daily ${done ? 'done' : ''} ${today ? 'today' : ''}"><small>${t('ui.day', { n: i + 1 })}</small>${img(icon(i === 6 ? 'chest' : 'coin'), 'px big')}<b>${r.gold}</b>${r.items ? `<em>+${Object.entries(r.items).map(([k, v]) => `${v} ${t('item.' + k + '.name')}`).join(', ')}</em>` : ''}</div>`;
      }).join('')}</div><div class="center"><button class="btn primary big" data-daily ${can ? '' : 'disabled'}>${can ? t('ui.claimDaily') : t('ui.comeBackTomorrow')}</button></div>`;
    }
    this.content.innerHTML = head + body;
    const c = this.content;
    c.querySelectorAll('[data-jt]').forEach((b) => b.onclick = () => { this.journalTab = b.dataset.jt; G.audio.sfx('click'); this.rerender(); });
    c.querySelectorAll('[data-q]').forEach((b) => b.onclick = () => { this.selQuest = b.dataset.q; G.audio.sfx('click'); this.rerender(); });
    c.querySelectorAll('[data-track]').forEach((b) => b.onclick = () => { G.state.quests.tracked = b.dataset.track; G.audio.sfx('click'); this.rerender(); });
    c.querySelectorAll('[data-abandon]').forEach((b) => b.onclick = () => { G.quests.abandon(b.dataset.abandon); this.rerender(); });
    c.querySelectorAll('[data-claim]').forEach((b) => b.onclick = () => { G.events.claimChallenge(+b.dataset.claim); this.rerender(); });
    c.querySelector('[data-daily]')?.addEventListener('click', () => { G.events.claimDaily(); this.rerender(); });
  }
  questDetail(id) {
    const q = QUESTS[id];
    const active = G.quests.isActive(id);
    const cur = active ? G.quests.stepIndex(id) : q.steps.length;
    const steps = q.steps.map((s, i) => {
      if (i > cur) return '';
      const done = i < cur;
      const prog = i === cur && s.n > 1 ? ` (${Math.min(G.quests.progress(id), s.n)}/${s.n})` : '';
      return `<li class="${done ? 'done' : 'cur'}">${done ? '✔' : '◆'} ${t(`q.${id}.s${i}`)}${prog}</li>`;
    }).join('');
    const r = q.rewards, rw = [];
    if (r.gold) rw.push(`${img(icon('coin'))} ${r.gold}`);
    if (r.xp) rw.push(`${img(icon('star'))} ${r.xp} XP`);
    for (const [k, v] of Object.entries(r.items || {})) rw.push(`${img(itemIcon(k, ITEMS[k]))} ${v}× ${t('item.' + k + '.name')}`);
    for (const s of r.swords || []) rw.push(`${img(swordIcon(s))} ${t('item.' + s + '.name')}`);
    for (const s of r.powers || []) rw.push(`${img(powerIcon(s))} ${t('power.' + s + '.name')}`);
    for (const s of r.armors || []) rw.push(`${img(icon('armor'))} ${t('armor.' + s + '.name')}`);
    for (const s of r.pets || []) rw.push(`${img(icon('paw'))} ${t('pet.' + s)}`);
    for (const [k, v] of Object.entries(r.rep || {})) rw.push(`${img(icon('flag', '#ffc83a'))} +${v} ${t('rep.' + k)}`);
    const progress = active ? Math.round(cur / q.steps.length * 100) : 100;
    return `<div class="qcard ${q.type}">
      <small>${q.type === 'main' ? t('journal.chapter', { n: q.chapter }) : t('journal.sideQuest')} · ${t('npc.' + q.giver + '.name')}</small>
      <h2>${t('q.' + id + '.title')}</h2><p>${t('q.' + id + '.desc')}</p>
      <div class="bar mini"><i style="width:${progress}%"></i></div>
      <h4>${t('journal.objectives')}</h4><ul class="steps">${steps}</ul>
      <h4>${t('journal.rewards')}</h4><div class="rewards">${rw.map((x) => `<span>${x}</span>`).join('')}</div>
      ${active ? `<div class="dc-actions"><button class="btn primary" data-track="${id}" ${G.state.quests.tracked === id ? 'disabled' : ''}>${G.state.quests.tracked === id ? t('journal.tracking') : t('journal.track')}</button>${q.type === 'side' ? `<button class="btn" data-abandon="${id}">${t('journal.abandon')}</button>` : ''}</div>` : ''}
    </div>`;
  }

  // ================= MAP =================
  r_map() {
    const travel = this.canTravel();
    this.content.innerHTML = `<div class="map-wrap"><canvas class="fullmap"></canvas>
      <div class="map-legend panel-glass">
        <div>${img(icon('quest'))} ${t('map.quest')}</div><div>${img(icon('travel', '#4fd0ff'))} ${t('map.waystone')}</div><div><i class="lg shop"></i> ${t('map.shop')}</div><div><i class="lg npc"></i> ${t('map.npcQuest')}</div>
        <p class="hint">${travel.ok ? t('map.travelHint') : t('map.noTravel_' + travel.reason)}</p>
        <p class="hint">${t('map.explored', { n: Math.round(G.mapSys.exploredFraction() * 100) })}</p>
      </div>
      <div class="map-zoom"><button data-z="1">+</button><button data-z="-1">−</button><button data-z="0">⌖</button></div></div>`;
    const cv = this.content.querySelector('.fullmap');
    const wrap = this.content.querySelector('.map-wrap');
    const resize = () => { cv.width = wrap.clientWidth; cv.height = wrap.clientHeight; this.mapGeom = G.mapSys.drawFull(cv, this.mapView); };
    requestAnimationFrame(resize);
    let drag = null, moved = false;
    cv.onpointerdown = (e) => { drag = { x: e.clientX, y: e.clientY, cx: this.mapView.cx, cz: this.mapView.cz }; moved = false; cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = (e) => {
      if (!drag || !this.mapGeom) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      this.mapView.cx = drag.cx - dx / this.mapGeom.s; this.mapView.cz = drag.cz - dy / this.mapGeom.s;
      this.mapGeom = G.mapSys.drawFull(cv, this.mapView);
    };
    cv.onpointerup = (e) => {
      drag = null;
      if (moved) return;
      const r = cv.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const hit = (G.mapSys.hit || []).find((h) => Math.hypot(h.x - x, h.y - y) < 14);
      if (hit) this.fastTravel(hit.id);
    };
    cv.onwheel = (e) => { e.preventDefault(); this.mapView.zoom = clamp(this.mapView.zoom * (e.deltaY < 0 ? 1.15 : 0.87), 1, 6); this.mapGeom = G.mapSys.drawFull(cv, this.mapView); };
    this.content.querySelectorAll('[data-z]').forEach((b) => b.onclick = () => {
      const z = +b.dataset.z;
      if (z === 0) { const p = G.player.pos; this.mapView.cx = p.x; this.mapView.cz = p.z; }
      else this.mapView.zoom = clamp(this.mapView.zoom * (z > 0 ? 1.3 : 0.77), 1, 6);
      this.mapGeom = G.mapSys.drawFull(cv, this.mapView);
    });
  }
  canTravel() {
    if (G.entities.enemies.list.some((e) => e.aggro && !e.dead)) return { ok: false, reason: 'combat' };
    if (G.sky.underground) return { ok: false, reason: 'cave' };
    return { ok: true };
  }
  fastTravel(id) {
    const c = this.canTravel();
    if (!c.ok) { G.ui.toast(t('map.noTravel_' + c.reason), 'warn'); G.audio.sfx('error'); return; }
    const w = WAYSTONES.find((q) => q.id === id);
    this.close();
    G.ui.fade(() => {
      G.player.respawnAt(w.x + 2.2, w.z + 2.2);
      G.state.player.respawn = { x: w.x + 2.2, z: w.z + 2.2 };
      G.audio.sfx('blink');
      G.game.onTeleport();
    });
  }

  // ================= ACHIEVEMENTS / LEADERBOARD =================
  r_achievements() {
    const tabs = ['ach', 'board', 'stats'];
    let body = '';
    if (this.achTab === 'ach') {
      const un = G.state.ach.unlocked;
      body = `<div class="collection-head">${t('menu.achCount', { n: un.length, total: ACHIEVEMENTS.length })}</div><div class="ach-grid">${ACHIEVEMENTS.map((a) => {
        const v = G.achievements.statValue(a.stat), got = un.includes(a.id);
        return `<div class="ach ${got ? 'got' : ''}">${img(icon(a.icon), 'px big')}<div><b>${t('ach.' + a.id + '.name')}</b><small>${t('ach.' + a.id + '.desc', { n: a.n })}</small><div class="bar mini"><i style="width:${clamp(v / a.n * 100, 0, 100)}%"></i></div><em>${img(icon('coin'))}${a.gold}${a.title ? ` · ${t('ui.title')}: ${t('title.' + a.title)}` : ''}</em></div></div>`;
      }).join('')}</div>`;
    } else if (this.achTab === 'board') {
      const day = G.state.world.day;
      const rows = RIVALS.map((r, i) => ({ name: r.name, level: Math.min(30, r.level + Math.floor(day / (3 + i))), title: r.title, me: false }));
      rows.push({ name: G.state.appearance.name, level: G.state.player.level, title: G.state.player.title, me: true });
      rows.sort((a, b) => b.level - a.level || (b.me ? 1 : -1));
      body = `<p class="hint">${t('board.hint')}</p><table class="board"><tr><th>#</th><th>${t('board.name')}</th><th>${t('ui.title')}</th><th>${t('ui.level')}</th></tr>${rows.map((r, i) => `<tr class="${r.me ? 'me' : ''}"><td>${i === 0 ? img(icon('crown')) : i + 1}</td><td>${r.name}</td><td>${t('title.' + r.title)}</td><td>${r.level}</td></tr>`).join('')}</table>`;
    } else {
      const s = G.state.ach.stats;
      const pt = G.state.playTime;
      body = this.statRows([
        [t('stats.playTime'), `${Math.floor(pt / 3600)}h ${Math.floor(pt / 60) % 60}m`], [t('stats.kills'), s.kills], [t('stats.bosses'), s.bosses.length],
        [t('stats.chests'), s.chests], [t('stats.gold'), fmt(s.goldEarned)], [t('stats.distance'), fmt(s.distance) + ' m'], [t('stats.powers'), s.powersUsed],
        [t('stats.deaths'), s.deaths], [t('stats.quests'), G.state.quests.done.length], [t('stats.discovered'), G.state.world.discovered.length], [t('stats.days'), G.state.world.day],
      ]);
    }
    this.content.innerHTML = `<div class="subtabs">${tabs.map((k) => `<button class="${k === this.achTab ? 'on' : ''}" data-at="${k}">${t('achTab.' + k)}</button>`).join('')}</div>${body}`;
    this.content.querySelectorAll('[data-at]').forEach((b) => b.onclick = () => { this.achTab = b.dataset.at; G.audio.sfx('click'); this.rerender(); });
  }

  // ================= SETTINGS =================
  r_settings() {
    const S = G.settings;
    const sel = (k, opts) => `<select data-s="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(S[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const range = (k, min, max, step) => `<input type="range" data-s="${k}" min="${min}" max="${max}" step="${step}" value="${S[k]}">`;
    const chk = (k) => `<label class="tgl"><input type="checkbox" data-s="${k}" ${S[k] ? 'checked' : ''}><i></i></label>`;
    this.content.innerHTML = `
      <div class="settings-grid">
        <div class="card"><h4>${t('set.general')}</h4>
          <div class="srow"><span>${t('set.language')}</span>${sel('lang', LANG_LIST.map((l) => [l.id, l.name]))}</div>
          <div class="srow"><span>${t('set.weather')}</span>${sel('weatherMode', ['dynamic', 'clear', 'cloudy', 'rain', 'fog', 'storm'].map((w) => [w, t('weather.' + w)]))}</div>
          <div class="srow"><span>${t('set.fps')}</span>${chk('showFps')}</div>
        </div>
        <div class="card"><h4>${t('set.camera')}</h4>
          <div class="srow"><span>${t('set.sensitivity')}</span>${range('sensitivity', 0.2, 3, 0.1)}</div>
          <div class="srow"><span>${t('set.touchSens')}</span>${range('touchSens', 0.3, 3, 0.1)}</div>
          <div class="srow"><span>${t('set.invertX')}</span>${chk('invertX')}</div>
          <div class="srow"><span>${t('set.invertY')}</span>${chk('invertY')}</div>
          <div class="srow"><span>${t('set.fov')}</span>${range('fov', 45, 90, 1)}</div>
          <div class="srow"><span>${t('set.camDist')}</span>${range('camDist', 2.5, 16, 0.5)}</div>
          <div class="srow"><span>${t('set.shake')}</span>${chk('shake')}</div>
        </div>
        <div class="card"><h4>${t('set.hud')}</h4>
          <div class="srow"><span>${t('set.hudScale')}</span>${range('hudScale', 0.6, 1.4, 0.05)}</div>
          <div class="srow"><span>${t('set.hudOpacity')}</span>${range('hudOpacity', 0.3, 1, 0.05)}</div>
          <div class="srow"><span>${t('set.minimap')}</span>${chk('minimap')}</div>
          <div class="srow"><span>${t('set.tracker')}</span>${chk('tracker')}</div>
          <div class="srow"><span>${t('set.dmgNumbers')}</span>${chk('dmgNumbers')}</div>
          <div class="srow"><span>${t('set.nameTags')}</span>${chk('nameTags')}</div>
          <div class="srow"><span>${t('set.touchScale')}</span>${range('touchScale', 0.6, 1.5, 0.05)}</div>
          <div class="srow"><span>${t('set.touchOpacity')}</span>${range('touchOpacity', 0.2, 1, 0.05)}</div>
          <div class="srow"><button class="btn sm" data-a="hudreset">${t('set.hudReset')}</button></div>
        </div>
        <div class="card"><h4>${t('set.audio')}</h4>
          <div class="srow"><span>${t('set.master')}</span>${range('master', 0, 1, 0.05)}</div>
          <div class="srow"><span>${t('set.music')}</span>${range('music', 0, 1, 0.05)}</div>
          <div class="srow"><span>${t('set.sfx')}</span>${range('sfx', 0, 1, 0.05)}</div>
        </div>
        <div class="card"><h4>${t('set.graphics')}</h4>
          <div class="srow"><span>${t('set.quality')}</span>${sel('quality', [['low', t('set.low')], ['medium', t('set.medium')], ['high', t('set.high')]])}</div>
          <div class="srow"><span>${t('set.pixel')}</span>${sel('pixel', [[1, '1× (HD)'], [2, '2×'], [3, '3×'], [4, '4× (Retro)']])}</div>
          <div class="srow"><span>${t('set.viewDist')}</span>${range('viewDist', 100, 320, 10)}</div>
          <div class="srow"><span>${t('set.shadows')}</span>${chk('shadows')}</div>
        </div>
        <div class="card"><h4>${t('set.game')}</h4>
          <div class="srow"><button class="btn primary" data-a="save">${t('set.saveNow')}</button><button class="btn" data-a="title">${t('set.toTitle')}</button></div>
          <div class="srow"><button class="btn danger" data-a="reset">${t('set.reset')}</button></div>
          <p class="hint">${t('set.autosave')}</p>
        </div>
        <div class="card wide"><h4>${t('set.controls')}</h4><div class="controls">${t('set.controlsText')}</div></div>
      </div>`;
    this.content.querySelectorAll('[data-s]').forEach((el) => {
      el.oninput = el.onchange = () => {
        const k = el.dataset.s;
        let v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
        if (k === 'pixel') v = +v;
        S[k] = v;
        if (k === 'lang') { setLang(v); this.render(); G.ui.refreshHotbar(); }
        if (k === 'camDist') G.cam.dist = v;
        G.game.applySettings();
        saveSettings(S);
      };
    });
    this.content.querySelector('[data-a="hudreset"]').onclick = () => { Object.assign(S, { hudScale: 1, hudOpacity: 1, minimap: true, tracker: true, dmgNumbers: true, nameTags: true, touchScale: 1, touchOpacity: 0.85 }); G.game.applySettings(); saveSettings(S); this.render(); };
    this.content.querySelector('[data-a="save"]').onclick = () => { G.game.save(true); };
    this.content.querySelector('[data-a="title"]').onclick = () => { G.game.save(false); location.reload(); };
    this.content.querySelector('[data-a="reset"]').onclick = (e) => {
      if (e.target.dataset.confirm) { deleteSave(); G.game.noSave = true; location.reload(); return; }
      e.target.dataset.confirm = '1'; e.target.textContent = t('set.resetConfirm');
    };
  }

  update() {
    const I = G.input;
    if (!this.isOpen) return;
    if (I.consume('pause')) { this.close(); return; }
    for (const [a, tab] of [['inventory', 'inventory'], ['journal', 'journal'], ['map', 'map'], ['character', 'character'], ['powers', 'powers'], ['swords', 'swords']]) {
      if (I.consume(a)) { this.toggle(tab); return; }
    }
  }
}
export { itemCategory };
