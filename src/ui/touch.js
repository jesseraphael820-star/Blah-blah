// Detecção de dispositivo (PC × celular/tablet) e controles de toque: joystick virtual e botões de ação.
import { G } from '../state.js';
import { input } from '../core/input.js';
import { h } from './dom.js';
import { t } from '../core/i18n.js';
import { audio } from '../core/audio.js';
import { emit } from '../core/events.js';

export function detectDevice() {
  const mm = (q) => typeof matchMedia === 'function' && matchMedia(q).matches;
  const coarse = mm('(pointer: coarse)'), fine = mm('(any-pointer: fine)');
  const touchPts = navigator.maxTouchPoints || 0;
  const ua = navigator.userAgent || '';
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini|IEMobile/i.test(ua) || (/Macintosh/.test(ua) && touchPts > 1);
  const touch = (coarse && touchPts > 0) || mobileUA;
  return { type: touch ? (Math.min(screen.width, screen.height) >= 700 ? 'tablet' : 'mobile') : 'pc', touch, hybrid: touch && fine };
}

let root, stick, knob, buttons = {}, rotate;
const stickState = { id: null, cx: 0, cy: 0, x: 0, y: 0 };
const R = 54;

export function touchEnabled() {
  const s = G.settings.touch || 'auto';
  return s === 'on' || (s === 'auto' && G.device && G.device.touch);
}

function press(code) { if (!input.down.has(code)) input.pressedSet.add(code); input.down.add(code); input.lastDevice = 'touch'; }
function release(code) { input.down.delete(code); input.releasedSet.add(code); }

function makeButton(action, label, cls = '') {
  const code = 'Touch_' + action;
  const b = h('div', { class: 'tbtn ' + cls, 'data-a': action }, h('span', {}, label));
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch (_) {} b.classList.add('on'); audio.init(); press(code); if (navigator.vibrate) try { navigator.vibrate(8); } catch (_) {} });
  const up = (e) => { e.preventDefault(); b.classList.remove('on'); release(code); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', () => { b.classList.remove('on'); input.down.delete(code); });
  buttons[action] = b;
  return b;
}

export function initTouch(ui) {
  G.device = detectDevice();
  document.body.classList.toggle('is-touch', !!G.device.touch);
  document.body.dataset.device = G.device.type;
  // ações de toque reconhecidas pelo sistema de entrada
  const basePad = input.padCodes.bind(input);
  input.padCodes = (a) => basePad(a).concat(['Touch_' + a]);
  const baseAxis = input.axis.bind(input);
  input.axis = () => { const [x, y] = baseAxis(); if (x || y) return [x, y]; return [stickState.x, stickState.y]; };

  knob = h('div', { class: 'tknob' });
  stick = h('div', { class: 'tstick' }, knob);
  const zone = h('div', { class: 'tzone' }, stick);
  zone.addEventListener('pointerdown', (e) => {
    if (stickState.id !== null) return;
    e.preventDefault(); audio.init();
    try { zone.setPointerCapture(e.pointerId); } catch (_) {}
    const r = zone.getBoundingClientRect();
    stickState.id = e.pointerId; stickState.cx = e.clientX; stickState.cy = e.clientY;
    stick.style.left = (e.clientX - r.left) + 'px'; stick.style.top = (e.clientY - r.top) + 'px';
    stick.classList.add('active'); input.lastDevice = 'touch';
    move(e);
  });
  const move = (e) => {
    if (e.pointerId !== stickState.id) return;
    let dx = e.clientX - stickState.cx, dy = e.clientY - stickState.cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.min(1, d / R);
    if (m < 0.18) { stickState.x = 0; stickState.y = 0; } else { stickState.x = (dx / R); stickState.y = (dy / R); }
    // empurrar até a borda = correr
    if (m > 0.92) input.down.add('Touch_run'); else input.down.delete('Touch_run');
  };
  const end = (e) => {
    if (e.pointerId !== stickState.id) return;
    stickState.id = null; stickState.x = 0; stickState.y = 0; input.down.delete('Touch_run');
    knob.style.transform = ''; stick.classList.remove('active');
    stick.style.left = ''; stick.style.top = '';
  };
  zone.addEventListener('pointermove', move); zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);

  const cluster = h('div', { class: 'tcluster' },
    makeButton('attack', '⚔', 'big'), makeButton('dodge', '⤳'), makeButton('block', '🛡'), makeButton('interact', '✋'));
  const extras = h('div', { class: 'textras' }, makeButton('bow', '🏹', 'small'), makeButton('potion', '🧪', 'small'), makeButton('mount', '🐎', 'small'), makeButton('whistle', '♪', 'small'));
  const menuBtn = makeButton('menu', '☰', 'small corner');
  rotate = h('div', { class: 'trotate passive' }, h('div', {}, '⟳'), h('p', {}, t('rotate_hint')));
  root = h('div', { id: 'touch', class: 'hidden' }, zone, cluster, extras, menuBtn);
  ui.append(root, rotate);
  // não deixar o navegador rolar/dar zoom durante o jogo
  document.getElementById('stage').addEventListener('touchmove', (e) => { if (e.target.closest && e.target.closest('.tabbody, .shop .list, #ending')) return; e.preventDefault(); }, { passive: false });
}

export function updateTouch() {
  if (!root) return;
  const on = touchEnabled();
  document.body.classList.toggle('touch-ui', on);
  const show = on && G.mode === 'play' && G.player && !G.player.dead;
  root.classList.toggle('hidden', !show);
  rotate.classList.toggle('hidden', !(on && innerHeight > innerWidth * 1.1));
  if (!show) {
    if (stickState.id !== null) { stickState.id = null; stickState.x = stickState.y = 0; knob.style.transform = ''; stick.classList.remove('active'); }
    return;
  }
  // rótulos contextuais
  const p = G.player;
  if (buttons.mount) buttons.mount.classList.toggle('hidden', !G.activeHorse);
  if (buttons.whistle) buttons.whistle.classList.toggle('hidden', !G.activeHorse || !!p.mount);
  if (buttons.bow) { buttons.bow.classList.toggle('hidden', !p.bow); buttons.bow.classList.toggle('lit', !!p.bowMode); }
  if (buttons.interact) buttons.interact.classList.toggle('lit', !!G.interactTarget);
  if (buttons.block) buttons.block.classList.toggle('hidden', !p.shield || !!p.mount);
}
export function tapToInteract() { emit('touchInteract'); }
