// UI manager: HUD (bars, minimap, clock, gold, hotbar, tracker), world-space
// overlays (damage numbers, bubbles, enemy bars, waypoint), toasts and banners.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { t } from '../core/i18n.js';
import { fmt, clamp } from '../core/utils.js';
import { icon, powerIcon, itemIcon, img } from './icons.js';
import { xpForLevel } from '../systems/progression.js';
import { ITEMS } from '../data/items.js';
import { POIS } from '../data/world.js';

const v3 = new THREE.Vector3();
const WEATHER_ICON = { clear: '☀', cloudy: '☁', rain: '🌧', fog: '🌫', storm: '⛈' };

export class UI {
  constructor() {
    this.hud = document.getElementById('hud');
    this.worldUi = document.getElementById('world-ui');
    this.toasts = document.getElementById('toasts');
    this.flashEl = document.getElementById('flash');
    this.vignette = document.getElementById('vignette');
    this.menuOpen = false;
    this.shopOpen = false;
    this.overlay = null; // 'defeat' | 'ending' | 'title'
    this.dmgPool = [];
    this.bubbles = [];
    this.bars = new Map();
    this.bossTarget = null;
    this.fpsAcc = 0; this.fpsN = 0; this.fps = 60;
  }

  build() {
    this.hud.innerHTML = `
      <div class="hud-tl panel-glass">
        <div class="hud-portrait"><canvas width="48" height="48"></canvas><div class="hud-level"></div></div>
        <div class="hud-bars">
          <div class="hud-name"><b></b><span></span></div>
          <div class="bar hp"><i></i><em></em><span></span></div>
          <div class="bar en"><i></i><em></em><span></span></div>
          <div class="bar st"><i></i></div>
          <div class="bar xp"><i></i><span></span></div>
        </div>
      </div>
      <div class="hud-tr">
        <div class="minimap-wrap"><canvas class="minimap" width="168" height="168"></canvas><div class="minimap-ring"></div></div>
        <div class="hud-clock panel-glass"><span class="wx"></span><b class="time"></b><span class="day"></span></div>
        <div class="hud-gold panel-glass">${img(icon('coin'))}<b></b><span class="gold-delta"></span></div>
        <div class="tracker panel-glass hidden"><div class="tr-head">${img(icon('quest'))}<b></b></div><div class="tr-obj"></div><div class="tr-dist"></div></div>
      </div>
      <div class="hud-buttons">
        <button data-m="inventory" title="I">${img(icon('bag'))}</button>
        <button data-m="journal" title="J">${img(icon('scroll'))}</button>
        <button data-m="map" title="M">${img(icon('map'))}</button>
        <button data-m="character" title="K">${img(icon('user', '#4aa8ff'))}</button>
        <button data-m="settings" title="Esc">${img(icon('gear'))}</button>
      </div>
      <div class="hud-bottom">
        <div class="prompt hidden"><kbd>E</kbd><span></span></div>
        <div class="hotbar">
          ${[0, 1, 2, 3].map((i) => `<div class="slot power" data-i="${i}"><img class="px" alt=""><div class="cd"></div><kbd>${i + 1}</kbd><span class="cost"></span></div>`).join('')}
          <div class="slot potion"><img class="px" src="${icon('potion', '#e03a3a')}" alt=""><kbd>Q</kbd><span class="cnt"></span></div>
        </div>
      </div>
      <div class="boss-bar hidden"><div class="boss-name"></div><div class="bar boss"><i></i><em></em></div></div>
      <div class="feed"></div>
      <div class="banner hidden"></div>
      <div class="fps hidden"></div>
      <div class="lock-hint hidden"></div>`;
    const q = (s) => this.hud.querySelector(s);
    this.el = {
      portrait: q('.hud-portrait canvas'), level: q('.hud-level'), name: q('.hud-name b'), title: q('.hud-name span'),
      hp: q('.bar.hp'), en: q('.bar.en'), st: q('.bar.st'), xp: q('.bar.xp'),
      mini: q('.minimap'), time: q('.hud-clock .time'), day: q('.hud-clock .day'), wx: q('.hud-clock .wx'),
      gold: q('.hud-gold b'), goldDelta: q('.gold-delta'),
      tracker: q('.tracker'), trTitle: q('.tr-head b'), trObj: q('.tr-obj'), trDist: q('.tr-dist'),
      prompt: q('.prompt'), promptText: q('.prompt span'), powers: [...this.hud.querySelectorAll('.slot.power')], potion: q('.slot.potion'),
      boss: q('.boss-bar'), bossName: q('.boss-name'), bossBar: q('.bar.boss'),
      feed: q('.feed'), banner: q('.banner'), fps: q('.fps'), lockHint: q('.lock-hint'),
    };
    this.pctx = this.el.portrait.getContext('2d');
    this.pctx.imageSmoothingEnabled = false;
    this.hud.querySelectorAll('.hud-buttons button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); G.audio.sfx('open'); this.openMenu(b.dataset.m); }));
    this.el.powers.forEach((s, i) => s.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (!G.mobile) G.powers.cast(i); }));
    this.el.potion.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (!G.mobile) G.inv.quickPotion(); });
    // waypoint marker
    this.waypoint = document.createElement('div');
    this.waypoint.className = 'waypoint hidden';
    this.waypoint.innerHTML = `<i></i><span></span>`;
    this.worldUi.appendChild(this.waypoint);
    this.refreshHotbar();
    G.bus.on('powerUnlocked', () => this.refreshHotbar());
  }
  show() { this.hud.classList.remove('hidden'); }
  hide() { this.hud.classList.add('hidden'); }

  // ---------- state queries ----------
  blocksGameplay() { return this.menuOpen || this.shopOpen || G.dialogue.active || !!this.overlay || G.paused; }
  blocksCamera() { return this.menuOpen || this.shopOpen || !!this.overlay; }
  canLockPointer() { return !this.blocksCamera() && !G.dialogue.active; }
  setDialogueMode(on) { this.hud.classList.toggle('dialogue-mode', on); if (on) G.input.unlock(); }

  openMenu(tab, opts) { G.menu.open(tab, opts); }

  // ---------- per-frame HUD ----------
  update(dt) {
    const s = G.state.player, st = G.prog.stats();
    const e = this.el;
    const setBar = (el, v, max, label = true) => {
      const f = clamp(v / max, 0, 1);
      el.querySelector('i').style.width = (f * 100).toFixed(1) + '%';
      const lag = el.querySelector('em');
      if (lag) { const cur = parseFloat(lag.style.width) || 100; const nf = Math.max(f * 100, cur - dt * 40); lag.style.width = (f * 100 > cur ? f * 100 : nf).toFixed(1) + '%'; }
      if (label) { const sp = el.querySelector('span'); if (sp) sp.textContent = `${Math.ceil(v)} / ${Math.round(max)}`; }
    };
    setBar(e.hp, s.hp, st.maxHp);
    setBar(e.en, s.energy, st.maxEnergy);
    setBar(e.st, s.stamina, st.maxStamina, false);
    const need = xpForLevel(s.level);
    e.xp.querySelector('i').style.width = clamp(s.xp / need * 100, 0, 100) + '%';
    e.xp.querySelector('span').textContent = `${fmt(s.xp)} / ${fmt(need)} XP`;
    e.hp.classList.toggle('low', s.hp / st.maxHp < 0.3);
    e.st.classList.toggle('hidden-soft', s.stamina >= st.maxStamina - 0.5);
    e.level.textContent = s.level;
    e.name.textContent = G.state.appearance.name;
    e.title.textContent = t('title.' + s.title);
    if (s.attrPoints > 0) e.level.classList.add('pts'); else e.level.classList.remove('pts');
    e.gold.textContent = fmt(s.gold);
    // portrait
    const c = this.pctx;
    c.fillStyle = '#1d2433'; c.fillRect(0, 0, 48, 48);
    c.drawImage(G.player.model.canvas, 0, 0, 16, 16, 4, 4, 40, 40);
    // clock
    const h = G.state.world.time;
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 10) * 10;
    e.time.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    e.day.textContent = t('ui.day', { n: G.state.world.day });
    e.wx.textContent = G.sky.underground ? '⛰' : (G.sky.isNight() && G.weather.state === 'clear' ? '☾' : WEATHER_ICON[G.weather.state]);
    // minimap
    this.miniT = (this.miniT || 0) - dt;
    if (this.miniT <= 0) { this.miniT = G.mobile ? 0.1 : 0.05; G.mapSys.drawMini(e.mini); }
    // tracker + waypoint
    this.updateTracker();
    // hotbar
    e.powers.forEach((sl, i) => {
      const id = G.state.inv.powerSlots[i];
      const cd = sl.querySelector('.cd');
      if (!id) { cd.style.height = '0%'; sl.classList.add('empty'); return; }
      sl.classList.remove('empty');
      cd.style.height = (G.powers.cooldownFrac(id) * 100).toFixed(1) + '%';
      sl.classList.toggle('noenergy', s.energy < G.powers.costFor(id));
    });
    const pc = ['potion_small', 'potion_large', 'bread', 'apple', 'stew', 'elixir'].reduce((a, id) => a + G.inv.count(id), 0);
    e.potion.querySelector('.cnt').textContent = pc;
    e.potion.classList.toggle('empty', pc === 0);
    // boss
    if (this.bossTarget) {
      const b = this.bossTarget;
      setBar(e.bossBar, b.hp, b.maxHp, false);
      e.bossName.innerHTML = `${img(icon('skull'))}<b>${t('enemy.' + b.type)}</b><span>${t('ui.lv')} ${b.level}</span>`;
    }
    // vignette when hurt / low hp
    const low = clamp(1 - s.hp / st.maxHp / 0.35, 0, 1);
    this.vignette.style.opacity = Math.max(this.hurtV || 0, low * (0.5 + Math.sin(G.time * 5) * 0.15));
    this.hurtV = Math.max(0, (this.hurtV || 0) - dt * 2);
    // lock-on hint
    e.lockHint.classList.toggle('hidden', !G.player.lockTarget);
    this.updateWorldUI(dt);
    // fps
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    e.fps.classList.toggle('hidden', !G.settings.showFps);
    e.fps.textContent = `${this.fps} FPS · ${G.renderer.info.render.calls} dc`;
  }

  refreshHotbar() {
    if (!this.el) return;
    this.el.powers.forEach((sl, i) => {
      const id = G.state.inv.powerSlots[i];
      const im = sl.querySelector('img');
      if (id) { im.src = powerIcon(id); im.style.visibility = 'visible'; sl.querySelector('.cost').textContent = G.powers.costFor(id); sl.title = t('power.' + id + '.name'); }
      else { im.style.visibility = 'hidden'; sl.querySelector('.cost').textContent = ''; sl.title = ''; }
    });
  }

  updateTracker() {
    const id = G.state.quests.tracked;
    const e = this.el;
    if (!id || !G.quests.isActive(id)) { e.tracker.classList.add('hidden'); this.waypoint.classList.add('hidden'); return; }
    e.tracker.classList.remove('hidden');
    e.tracker.classList.toggle('main', G.quests.def(id).type === 'main');
    e.trTitle.textContent = t(`q.${id}.title`);
    e.trObj.textContent = G.quests.objectiveText(id);
    const tg = G.quests.target(id);
    if (!tg) { e.trDist.textContent = ''; this.waypoint.classList.add('hidden'); return; }
    const P = G.player.pos;
    const d = Math.hypot(tg.x - P.x, tg.z - P.z);
    e.trDist.textContent = `${Math.round(d)} m`;
    // 3D waypoint projected to screen (clamped to edges)
    const ty = tg.y !== undefined ? tg.y + 3 : G.physics.groundAt(tg.x, tg.z, 200) + 3;
    v3.set(tg.x, ty, tg.z).project(G.camera);
    const W = innerWidth, H = innerHeight;
    let x = (v3.x * 0.5 + 0.5) * W, y = (-v3.y * 0.5 + 0.5) * H;
    const behind = v3.z > 1;
    if (behind) { x = W - x; y = H - 40; }
    x = clamp(x, 30, W - 30); y = clamp(y, 60, H - 90);
    this.waypoint.classList.toggle('hidden', d < 4 || G.dialogue.active || this.menuOpen);
    this.waypoint.style.transform = `translate(${x}px, ${y}px)`;
    this.waypoint.querySelector('span').textContent = `${Math.round(d)}m`;
  }

  // ---------- world-space overlays ----------
  damageNumber(x, y, z, text, kind = 'hit') {
    let el = this.dmgPool.find((d) => !d.active);
    if (!el) {
      if (this.dmgPool.length > 40) el = this.dmgPool[0];
      else { const div = document.createElement('div'); div.className = 'dmg'; this.worldUi.appendChild(div); el = { div }; this.dmgPool.push(el); }
    }
    el.active = true; el.t = 0; el.pos = new THREE.Vector3(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6);
    el.div.className = 'dmg ' + kind;
    el.div.textContent = text;
    el.div.style.display = 'block';
    el.life = kind === 'xp' ? 1.3 : 0.9;
  }
  bubble(npc, text, dur = 3) {
    const div = document.createElement('div');
    div.className = 'bubble';
    div.textContent = text;
    this.worldUi.appendChild(div);
    this.bubbles.push({ npc, div, t: 0, dur });
  }
  updateWorldUI(dt) {
    const W = innerWidth, H = innerHeight;
    const proj = (p, yOff = 0) => { v3.set(p.x, p.y + yOff, p.z).project(G.camera); return v3.z < 1 ? [(v3.x * 0.5 + 0.5) * W, (-v3.y * 0.5 + 0.5) * H] : null; };
    for (const d of this.dmgPool) {
      if (!d.active) continue;
      d.t += dt;
      if (d.t > d.life) { d.active = false; d.div.style.display = 'none'; continue; }
      const s = proj(d.pos, d.t * 1.4);
      if (!s) { d.div.style.display = 'none'; continue; }
      d.div.style.display = 'block';
      const k = d.t / d.life;
      d.div.style.transform = `translate(${s[0]}px, ${s[1]}px) translate(-50%,-50%) scale(${k < 0.15 ? 0.6 + k * 4 : 1.2 - k * 0.3})`;
      d.div.style.opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.t += dt;
      const pos = b.npc.pos;
      const s = proj(pos, 2.6 * (b.npc.def?.scale || 1) + 0.9);
      if (b.t > b.dur || !s || G.dialogue.active) { b.div.remove(); this.bubbles.splice(i, 1); continue; }
      b.div.style.transform = `translate(${s[0]}px, ${s[1]}px) translate(-50%,-100%)`;
      b.div.style.opacity = b.t > b.dur - 0.4 ? (b.dur - b.t) / 0.4 : Math.min(1, b.t * 5);
    }
    // enemy health bars
    const seen = new Set();
    const P = G.player.pos;
    for (const e of G.entities.enemies.list) {
      if (e.dead || e.boss || (!e.aggro && e.hp >= e.maxHp)) continue;
      if (Math.hypot(e.pos.x - P.x, e.pos.z - P.z) > 30) continue;
      const s = proj(e.pos, (e.def.fly || 0) + 1.9 * (e.def.scale || 1) + 0.5);
      if (!s) continue;
      seen.add(e);
      let el = this.bars.get(e);
      if (!el) { el = document.createElement('div'); el.className = 'ebar'; el.innerHTML = `<span></span><div><i></i></div>`; this.worldUi.appendChild(el); this.bars.set(e, el); }
      el.style.transform = `translate(${s[0]}px, ${s[1]}px) translate(-50%,-100%)`;
      el.querySelector('i').style.width = (e.hp / e.maxHp * 100) + '%';
      el.querySelector('span').textContent = `${t('ui.lv')}${e.level} ${t('enemy.' + e.type)}`;
      el.classList.toggle('elite', e.level > G.state.player.level + 2);
    }
    for (const [e, el] of this.bars) if (!seen.has(e)) { el.remove(); this.bars.delete(e); }
  }

  // ---------- notifications ----------
  toast(text, kind = 'info') {
    const d = document.createElement('div');
    d.className = 'toast ' + kind;
    const ic = { gold: icon('coin'), unlock: icon('star'), power: icon('orb', '#6fd8ff'), title: icon('crown'), travel: icon('travel', '#4fd0ff'), warn: icon('heart'), boss: icon('skull'), event: icon('bolt'), ach: icon('trophy'), info: icon('scroll') }[kind] || icon('scroll');
    d.innerHTML = `${img(ic)}<span>${text}</span>`;
    this.toasts.appendChild(d);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    requestAnimationFrame(() => d.classList.add('show'));
    setTimeout(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 400); }, kind === 'info' || kind === 'warn' ? 2600 : 3800);
  }
  feed(text, kind, id) {
    const d = document.createElement('div');
    d.className = 'feed-item ' + (kind || '');
    const ic = kind === 'item' || kind === 'use' ? itemIcon(id, ITEMS[id]) : kind === 'rep' ? icon('flag', '#ffc83a') : icon('star');
    d.innerHTML = `${img(ic)}<span>${text}</span>`;
    this.el.feed.appendChild(d);
    while (this.el.feed.children.length > 6) this.el.feed.firstChild.remove();
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 500); }, 3200);
  }
  goldPulse(n) {
    if (!this.el) return;
    const d = this.el.goldDelta;
    d.textContent = (n > 0 ? '+' : '') + fmt(n);
    d.className = 'gold-delta show ' + (n > 0 ? 'up' : 'down');
    clearTimeout(this.gpT);
    this.gpT = setTimeout(() => { d.className = 'gold-delta'; }, 1200);
  }
  banner(html, cls = '', dur = 3.2) {
    const b = this.el.banner;
    b.className = 'banner ' + cls;
    b.innerHTML = html;
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(this.bT);
    this.bT = setTimeout(() => b.classList.remove('show'), dur * 1000);
  }
  questBanner(head, title, type, rewards) {
    let rw = '';
    if (rewards) {
      const parts = [];
      if (rewards.gold) parts.push(`${img(icon('coin'))} ${rewards.gold}`);
      if (rewards.xp) parts.push(`${img(icon('star'))} ${rewards.xp} XP`);
      rw = `<div class="bn-rewards">${parts.join('')}</div>`;
    }
    this.banner(`<small>${head}</small><h2>${title}</h2>${rw}`, 'quest ' + type, 3.6);
  }
  levelUpBanner(l, bonus) {
    this.banner(`<small>${t('ui.levelUp')}</small><h2>${t('ui.level')} ${l}</h2><div class="bn-rewards">+3 ${t('ui.attrPoints')}${bonus ? ` · ${img(icon('coin'))} ${bonus}` : ''}</div>`, 'level', 3.4);
  }
  discoverBanner(id) {
    this.banner(`<small>${t('ui.discovered')}</small><h2>${t('loc.' + id)}</h2>`, 'discover', 3);
  }
  objectiveUpdated(id) {
    if (G.state.quests.tracked !== id) return;
    const tr = this.el.tracker;
    tr.classList.remove('pulse'); void tr.offsetWidth; tr.classList.add('pulse');
  }
  setBoss(e) {
    this.bossTarget = e;
    this.el.boss.classList.toggle('hidden', !e);
    G.game.combatMusic(!!e);
  }
  showPrompt(text) {
    if (!text) { this.el.prompt.classList.add('hidden'); return; }
    this.el.prompt.classList.remove('hidden');
    this.el.prompt.querySelector('kbd').textContent = G.mobile ? '✋' : 'E';
    this.el.promptText.textContent = text;
  }
  screenFlash(a = 0.4, color = '#ffffff') {
    const f = this.flashEl;
    f.style.transition = 'none'; f.style.background = color; f.style.opacity = a;
    void f.offsetWidth;
    f.style.transition = 'opacity .5s ease-out'; f.style.opacity = 0;
  }
  hurtFlash() { this.hurtV = 0.7; }

  // ---------- full screen overlays ----------
  showDefeat(lost) {
    this.overlay = 'defeat';
    G.input.unlock();
    const d = document.createElement('div');
    d.className = 'overlay defeat';
    d.innerHTML = `<div class="ov-inner"><h1>${t('ui.defeated')}</h1><p>${t('ui.lostGold', { n: lost })}</p><button class="btn primary" disabled>${t('ui.respawn')}</button></div>`;
    document.getElementById('app').appendChild(d);
    requestAnimationFrame(() => d.classList.add('show'));
    const b = d.querySelector('button');
    setTimeout(() => { b.disabled = false; b.focus(); }, 1600);
    b.onclick = () => { d.remove(); this.overlay = null; G.player.revive(); G.audio.sfx('heal'); };
  }
  showEnding() {
    setTimeout(() => {
      this.overlay = 'ending';
      G.input.unlock();
      const d = document.createElement('div');
      d.className = 'overlay ending';
      d.innerHTML = `<div class="ov-inner"><small>${t('ui.theEnd')}</small><h1>${t('ui.endingTitle')}</h1><p>${t('ui.endingText')}</p><p class="muted">${t('ui.endingHint')}</p><button class="btn primary">${t('ui.continue')}</button></div>`;
      document.getElementById('app').appendChild(d);
      requestAnimationFrame(() => d.classList.add('show'));
      d.querySelector('button').onclick = () => { d.remove(); this.overlay = null; };
    }, 3500);
  }
  fade(fn) {
    const f = this.flashEl;
    f.style.transition = 'opacity .35s'; f.style.background = '#000'; f.style.opacity = 1;
    setTimeout(() => { fn(); setTimeout(() => { f.style.opacity = 0; }, 120); }, 380);
  }
  discover(p) { this.discoverBanner(p.id); }
}
export { POIS };
