// Dialogue: builds conversations from quest state + NPC personality, then
// presents them in the bottom dialogue box with typewriter subtitles,
// speaker name highlight, animated pixel portrait, mouth sync and choices.
import { G } from '../core/context.js';
import { t, tr } from '../core/i18n.js';
import { QUESTS } from '../data/quests.js';
import { NPCS } from '../data/npcs.js';

function parseLine(raw, npc) {
  let s = String(raw), speaker = 'npc', expr = null;
  if (s.startsWith('P:')) { speaker = 'player'; s = s.slice(2).trim(); }
  const m = s.match(/^\{(\w+)\}\s*/);
  if (m) { expr = m[1]; s = s.slice(m[0].length); }
  s = s.replace(/\{player\}/g, G.state.appearance.name || 'Hero');
  return { speaker, text: s, expr, npc };
}

export class Dialogue {
  constructor() {
    this.el = document.getElementById('dialogue');
    this.active = false;
    this.queue = [];
    this.cur = null;
    this.typed = 0;
    this.choices = null;
    this.blipT = 0;
    this.el.addEventListener('click', (e) => {
      if (e.target.closest('.dlg-choice')) return;
      this.advance();
    });
    this.el.innerHTML = `
      <div class="dlg-box">
        <div class="dlg-portrait"><canvas width="64" height="64"></canvas></div>
        <div class="dlg-main">
          <div class="dlg-name"></div>
          <div class="dlg-text"></div>
          <div class="dlg-choices"></div>
          <div class="dlg-next">▼</div>
        </div>
      </div>`;
    this.portrait = this.el.querySelector('canvas');
    this.pctx = this.portrait.getContext('2d');
    this.pctx.imageSmoothingEnabled = false;
    this.nameEl = this.el.querySelector('.dlg-name');
    this.textEl = this.el.querySelector('.dlg-text');
    this.choicesEl = this.el.querySelector('.dlg-choices');
    this.nextEl = this.el.querySelector('.dlg-next');
  }
  get speaker() { return this.cur ? this.cur.speaker : null; }

  // ---------- conversation builder ----------
  talkTo(npc) {
    const id = npc.id;
    const L = (k) => tr(k) || [];
    // 1) quest talk/deliver steps at this NPC
    const ts = G.quests.talkSteps(id);
    if (ts.length) {
      const { id: qid, st, idx } = ts[0];
      if (st.type === 'deliver' && G.inv.count(st.item) < st.n) {
        const need = L(`q.${qid}.need`);
        this.open(npc, need.length ? need : [t('dlg.needItems', { n: st.n, item: t('item.' + st.item + '.name') })], null);
        return;
      }
      this.open(npc, L(`q.${qid}.s${idx}t`).length ? L(`q.${qid}.s${idx}t`) : L(`q.${qid}.done`), null, () => G.quests.completeTalk(qid));
      return;
    }
    // 2) offer quests
    const av = G.quests.availableFrom(id);
    if (av.length) {
      const qid = av[0];
      this.open(npc, L(`q.${qid}.offer`), [
        { label: t('dlg.accept'), act: () => this.open(npc, L(`q.${qid}.accept`), null, () => G.quests.start(qid)) },
        { label: t('dlg.decline'), act: () => this.open(npc, [L('dlg.declineLine')[0] || t('dlg.ok')], null) },
      ]);
      return;
    }
    // 3) reminder for active quest given by this npc
    const given = Object.keys(G.state.quests.active).find((q) => QUESTS[q].giver === id);
    const def = npc.def;
    const menu = [];
    if (def.shop) menu.push({ label: t('dlg.shop'), act: () => { this.close(); G.shop.open(def.shop, npc); } });
    menu.push({ label: t('dlg.chat'), act: () => this.open(npc, this.smallTalk(npc.lk), menu) });
    if (given) menu.push({ label: t('dlg.aboutQuest'), act: () => this.open(npc, L(`q.${given}.progress`).length ? L(`q.${given}.progress`) : [G.quests.objectiveText(given)], menu) });
    menu.push({ label: t('dlg.bye'), act: () => this.open(npc, [this.pick(L(`npc.${npc.lk}.bye`)) || t('dlg.byeLine')], null) });
    const greet = L(`npc.${npc.lk}.greet`);
    this.open(npc, [this.pick(greet) || '...'], menu);
  }
  smallTalk(id) {
    const night = G.sky.isNight();
    const sets = tr(`npc.${id}.${night ? 'night' : 'talk'}`) || tr(`npc.${id}.talk`) || [['...']];
    const s = this.pick(sets);
    return Array.isArray(s) ? s : [s];
  }
  pick(arr) { return Array.isArray(arr) && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; }

  // ---------- presentation ----------
  open(npc, lines, choices, onEnd) {
    if (!this.active) {
      this.active = true;
      this.npc = npc;
      npc.talking = true;
      G.audio.sfx('talk');
      G.ui.setDialogueMode(true);
      G.cam.mode = 'dialogue';
      G.cam.focus = npc;
      const P = G.player;
      P.yaw = Math.atan2(npc.pos.x - P.pos.x, npc.pos.z - P.pos.z);
      this.el.classList.remove('hidden');
      requestAnimationFrame(() => this.el.classList.add('show'));
    }
    this.seq = (this.seq || 0) + 1;
    this.queue = (lines && lines.length ? lines : ['...']).map((l) => parseLine(l, npc));
    this.choices = choices || null;
    this.onEnd = onEnd || null;
    this.nextLine();
  }
  nextLine() {
    this.choicesEl.innerHTML = '';
    this.cur = this.queue.shift();
    if (!this.cur) return;
    this.typed = 0;
    const isP = this.cur.speaker === 'player';
    const sp = isP ? G.player.model : this.npc.model;
    if (this.cur.expr) sp.setExpression(this.cur.expr);
    else sp.setExpression(isP ? 'neutral' : 'smile');
    this.nameEl.textContent = isP ? (G.state.appearance.name || 'Hero') : this.npc.name;
    this.nameEl.className = 'dlg-name ' + (isP ? 'player' : 'npc');
    const role = isP ? t('title.' + G.state.player.title) : this.npc.role;
    this.nameEl.innerHTML = `<span>${this.nameEl.textContent}</span><em>${role}</em>`;
    this.textEl.textContent = '';
    this.nextEl.style.visibility = 'hidden';
    (isP ? this.npc.model : G.player.model).setTalking(false);
    sp.setTalking(true);
  }
  advance() {
    if (!this.active || !this.cur) return;
    if (this.typed < this.cur.text.length) { this.typed = this.cur.text.length; this.textEl.textContent = this.cur.text; this.finishLine(); return; }
    if (this.choicesEl.children.length) return;
    if (this.queue.length) { this.nextLine(); G.audio.sfx('click', { vol: 0.5 }); return; }
    const end = this.onEnd;
    this.onEnd = null;
    const seq = this.seq;
    if (end) end();
    if (this.seq !== seq || !this.active) return; // a new conversation was opened by the callback
    this.close();
  }
  finishLine() {
    const sp = this.cur.speaker === 'player' ? G.player.model : this.npc.model;
    sp.setTalking(false);
    if (!this.queue.length && this.choices) this.showChoices();
    else this.nextEl.style.visibility = 'visible';
  }
  showChoices() {
    this.choicesEl.innerHTML = '';
    this.choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'dlg-choice';
      b.innerHTML = `<kbd>${i + 1}</kbd>${c.label}`;
      b.onclick = (e) => { e.stopPropagation(); this.choose(i); };
      this.choicesEl.appendChild(b);
    });
    this.nextEl.style.visibility = 'hidden';
  }
  choose(i) {
    const c = this.choices && this.choices[i];
    if (!c) return;
    G.audio.sfx('click');
    const end = this.onEnd; this.onEnd = null;
    if (end) end();
    this.choices = null;
    this.choicesEl.innerHTML = '';
    c.act();
  }
  close() {
    if (!this.active) return;
    this.active = false;
    this.npc.talking = false;
    this.npc.model.setTalking(false);
    this.npc.model.setExpression('neutral');
    G.player.model.setTalking(false);
    G.player.model.setExpression('neutral');
    this.el.classList.remove('show');
    setTimeout(() => { if (!this.active) this.el.classList.add('hidden'); }, 200);
    G.ui.setDialogueMode(false);
    G.cam.mode = 'follow';
    this.cur = null;
  }

  update(dt) {
    if (!this.active || !this.cur) return;
    const I = G.input;
    if (I.consume('interact') || I.consume('confirm') || I.consume('jump') || I.consume('attack')) this.advance();
    for (let i = 0; i < 4; i++) if (I.consume('power' + (i + 1))) this.choose(i);
    if (I.consume('pause')) { if (this.choices) this.choose(this.choices.length - 1); else this.close(); }
    if (!this.active || !this.cur) return;
    const txt = this.cur.text;
    if (this.typed < txt.length) {
      const before = Math.floor(this.typed);
      this.typed = Math.min(txt.length, this.typed + dt * 48);
      const now = Math.floor(this.typed);
      if (now !== before) {
        this.textEl.textContent = txt.slice(0, now);
        this.blipT -= now - before;
        if (this.blipT <= 0) {
          this.blipT = 3;
          const pitch = this.cur.speaker === 'player' ? 1.15 : (this.npc.def.pitch || 1);
          G.audio.sfx('blip', { pitch });
        }
      }
      if (this.typed >= txt.length) this.finishLine();
    }
    // live portrait from the speaker's face texture
    const m = this.cur.speaker === 'player' ? G.player.model : this.npc.model;
    const c = this.pctx;
    c.fillStyle = '#1d2433'; c.fillRect(0, 0, 64, 64);
    c.drawImage(m.canvas, 0, 0, 16, 16, 4, 4, 56, 56);
  }
}
