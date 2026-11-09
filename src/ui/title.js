// Title screen and character creator for new games.
import { G } from '../core/context.js';
import { t, setLang, LANG_LIST, getLang } from '../core/i18n.js';
import { hasSave } from '../core/save.js';
import { HAIR_COLORS, SKIN_TONES, CLOTH_COLORS, EYE_COLORS } from './menu.js';
import { saveSettings } from '../core/save.js';

const HAIR_STYLES = ['short', 'long', 'spiky', 'ponytail', 'bun', 'braid', 'messy', 'bald'];
const hx = (n) => '#' + n.toString(16).padStart(6, '0');

export class Title {
  constructor(onStart) {
    this.el = document.getElementById('title');
    this.onStart = onStart;
    this.app = { name: '', hairStyle: 'short', hairColor: 0x5a3a22, skinTone: 0xf1c27d, eyeColor: 0x2b4a7a, shirt: 0x3f7fbf, pants: 0x4a3b2a, shoes: 0x2a1f16 };
  }
  show() {
    G.ui.overlay = 'title';
    this.el.classList.remove('hidden');
    this.renderMain();
  }
  hide() { this.el.classList.add('hidden'); G.ui.overlay = null; }

  renderMain() {
    const can = hasSave();
    this.el.innerHTML = `
      <div class="title-inner">
        <div class="logo big"><span>WILD</span><span>LANDS</span></div>
        <p class="tagline">${t('title.tagline')}</p>
        <div class="title-buttons">
          ${can ? `<button class="btn primary big" data-a="continue">${t('title.continue')}</button>` : ''}
          <button class="btn ${can ? '' : 'primary'} big" data-a="new">${t('title.newGame')}</button>
          <div class="lang-row">${LANG_LIST.map((l) => `<button class="chip ${getLang() === l.id ? 'on' : ''}" data-lang="${l.id}">${l.name}</button>`).join('')}</div>
        </div>
        <p class="title-hint">${G.mobile ? t('title.hintTouch') : t('title.hintKeys')}</p>
      </div>`;
    this.el.querySelectorAll('[data-lang]').forEach((b) => b.onclick = () => { setLang(b.dataset.lang); G.settings.lang = b.dataset.lang; saveSettings(G.settings); G.audio.init(); this.renderMain(); });
    this.el.querySelector('[data-a="new"]').onclick = () => { G.audio.init(); G.audio.sfx('click'); this.hide(); this.onStart({}); };
    const c = this.el.querySelector('[data-a="continue"]');
    if (c) c.onclick = () => { G.audio.init(); G.audio.sfx('quest'); this.hide(); this.onStart(null); };
  }

  renderCreate() {
    const A = this.app;
    const sw = (k, list) => list.map((c) => `<button class="sw ${A[k] === c ? 'on' : ''}" data-k="${k}" data-v="${c}" style="background:${hx(c)}"></button>`).join('');
    this.el.innerHTML = `
      <div class="create">
        <div class="create-panel panel-glass">
          <h2>${t('title.createHero')}</h2>
          <label>${t('char.name')}<input class="name-in" maxlength="16" placeholder="${t('title.namePh')}" value="${A.name}"></label>
          <h4>${t('char.hair')}</h4><div class="chips">${HAIR_STYLES.map((h) => `<button class="chip ${A.hairStyle === h ? 'on' : ''}" data-hair="${h}">${t('hair.' + h)}</button>`).join('')}</div>
          <div class="swatches">${sw('hairColor', HAIR_COLORS)}</div>
          <h4>${t('char.skin')}</h4><div class="swatches">${sw('skinTone', SKIN_TONES)}</div>
          <h4>${t('char.eyes')}</h4><div class="swatches">${sw('eyeColor', EYE_COLORS)}</div>
          <h4>${t('char.shirt')}</h4><div class="swatches">${sw('shirt', CLOTH_COLORS)}</div>
          <h4>${t('char.pants')}</h4><div class="swatches">${sw('pants', CLOTH_COLORS)}</div>
          <div class="create-actions"><button class="btn" data-a="back">${t('ui.back')}</button><button class="btn primary big" data-a="start">${t('title.begin')}</button></div>
        </div>
      </div>`;
    const e = this.el;
    e.querySelector('.name-in').oninput = (ev) => { A.name = ev.target.value; };
    e.querySelectorAll('[data-hair]').forEach((b) => b.onclick = () => { A.hairStyle = b.dataset.hair; this.preview(); this.renderCreate(); });
    e.querySelectorAll('.sw').forEach((b) => b.onclick = () => { A[b.dataset.k] = +b.dataset.v; this.preview(); this.renderCreate(); });
    e.querySelector('[data-a="back"]').onclick = () => { if (G.player) { G.game.noSave = true; location.reload(); } else this.renderMain(); };
    e.querySelector('[data-a="start"]').onclick = () => {
      A.name = (A.name || '').trim() || t('title.defaultName');
      G.audio.sfx('quest');
      this.hide();
      this.onStart({ ...A });
    };
    this.preview();
  }
  preview() {
    if (!G.state || !G.player) return;
    Object.assign(G.state.appearance, this.app);
    G.player.refreshLook();
  }
}
