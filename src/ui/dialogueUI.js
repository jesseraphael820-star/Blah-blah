// Caixa de diálogo: retrato animado (boca durante a fala, piscadas, expressões), texto digitado e escolhas.
import { G } from '../state.js';
import { h, clear } from './dom.js';
import { portrait } from '../gfx/portraits.js';
import { mouthFrame, chooseOption, advance } from '../systems/dialogue.js';
import { audio } from '../core/audio.js';

let box, pc, px, who, text, choices, next, lastKey = '', blinkT = 2, blinking = 0, selIdx = 0;
export function initDialogueUI(ui) {
  pc = h('canvas', { class: 'portrait', width: 48, height: 48 });
  px = pc.getContext('2d'); px.imageSmoothingEnabled = false;
  who = h('div', { class: 'who' }); text = h('div', { class: 'text' }); choices = h('div', { class: 'choices' }); next = h('div', { class: 'next' }, '▼');
  box = h('div', { id: 'dialogue', class: 'panel hidden', onclick: (e) => { if (e.target.closest('.btn')) return; advance(); } }, pc, h('div', { class: 'body' }, who, text, choices, next));
  ui.append(box);
}
export function updateDialogueUI(dt) {
  const D = G.dialogue;
  if (!D || (!D.text && !D.choices)) { box.classList.add('hidden'); lastKey = ''; return; }
  box.classList.remove('hidden');
  if (D.choices) {
    const key = D.id + ':' + D.idx + ':c';
    if (key !== lastKey) {
      lastKey = key; selIdx = 0;
      clear(choices).append(...D.choices.map((c, i) => h('button', { class: 'btn' + (i === 0 ? ' sel' : ''), onclick: () => chooseOption(i), onmouseenter: () => audio.sfx('hover') }, `${i + 1}. ${c.text}`)));
      next.classList.add('hidden');
    }
    return;
  }
  const info = D.info || {};
  const key = D.id + ':' + D.idx;
  if (key !== lastKey) { lastKey = key; clear(choices); box.classList.toggle('narr', !!info.narrator); who.textContent = info.name || ''; }
  text.textContent = D.text.slice(0, Math.floor(D.shown));
  next.classList.toggle('hidden', D.typing);
  // retrato com boca e piscada
  if (info.look && !info.narrator) {
    blinkT -= dt; if (blinkT <= 0) { blinking = 0.12; blinkT = 2 + Math.random() * 3; }
    if (blinking > 0) blinking -= dt;
    const img = portrait(info.look, D.expr, mouthFrame(), blinking > 0);
    px.clearRect(0, 0, 48, 48); px.drawImage(img, 0, 0);
  }
}
export function dialogueKey(dir) {
  const D = G.dialogue; if (!D || !D.choices) return false;
  const btns = choices.querySelectorAll('.btn');
  if (dir === 'enter') { chooseOption(selIdx); return true; }
  selIdx = (selIdx + (dir === 'down' ? 1 : -1) + btns.length) % btns.length;
  btns.forEach((b, i) => b.classList.toggle('sel', i === selIdx));
  audio.sfx('hover');
  return true;
}
export function chooseByNumber(n) { const D = G.dialogue; if (D && D.choices && D.choices[n]) chooseOption(n); }
