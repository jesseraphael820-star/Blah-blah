// Mobile touch controls: virtual joystick, camera drag area and action buttons.
import { G } from '../core/context.js';
import { icon, img, powerIcon } from './icons.js';

export class Touch {
  constructor() {
    this.el = document.getElementById('touch');
    this.el.innerHTML = `
      <div class="t-look"></div>
      <div class="t-stick"><div class="t-knob"></div></div>
      <div class="t-btns">
        <button class="tb attack" data-a="attack">⚔</button>
        <button class="tb jump" data-a="jump">⤒</button>
        <button class="tb dodge" data-a="dodge">↻</button>
        <button class="tb block" data-a="block">🛡</button>
        <button class="tb interact" data-a="interact">✋</button>
        <button class="tb run" data-a="run" data-toggle="1">»</button>
        <button class="tb p1" data-a="power1">1</button><button class="tb p2" data-a="power2">2</button>
        <button class="tb p3" data-a="power3">3</button><button class="tb p4" data-a="power4">4</button>
        <button class="tb horse" data-a="whistle">🐴</button>
        <button class="tb sneak" data-a="sneak">🥷</button>
        <button class="tb potion" data-a="potion">${img(icon('potion', '#e03a3a'))}</button>
      </div>`;
    const I = G.input;
    const stick = this.el.querySelector('.t-stick'), knob = this.el.querySelector('.t-knob');
    let sid = null, sx = 0, sy = 0;
    stick.addEventListener('touchstart', (e) => {
      const tc = e.changedTouches[0]; sid = tc.identifier;
      const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2;
      this.moveStick(tc, sx, sy, knob); e.preventDefault();
    }, { passive: false });
    stick.addEventListener('touchmove', (e) => { for (const tc of e.changedTouches) if (tc.identifier === sid) this.moveStick(tc, sx, sy, knob); e.preventDefault(); }, { passive: false });
    const endStick = (e) => { for (const tc of e.changedTouches) if (tc.identifier === sid) { sid = null; I.touchMove.active = false; I.touchMove.x = I.touchMove.y = 0; knob.style.transform = ''; } };
    stick.addEventListener('touchend', endStick); stick.addEventListener('touchcancel', endStick);
    // camera look area
    const look = this.el.querySelector('.t-look');
    let lid = null, lx = 0, ly = 0;
    // pinch with two fingers on the right side to zoom the camera
    let pinch = null;
    const pinchDist = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
    look.addEventListener('touchstart', (e) => {
      if (e.targetTouches.length >= 2) { pinch = pinchDist(e.targetTouches); lid = null; e.preventDefault(); return; }
      const tc = e.changedTouches[0]; lid = tc.identifier; lx = tc.clientX; ly = tc.clientY; e.preventDefault();
    }, { passive: false });
    look.addEventListener('touchmove', (e) => {
      if (pinch && e.targetTouches.length >= 2) {
        const d = pinchDist(e.targetTouches);
        I.wheel += Math.log(pinch / d) / Math.log(1.12);
        pinch = d; e.preventDefault(); return;
      }
      for (const tc of e.changedTouches) if (tc.identifier === lid) {
        const ts = 1.6 * (G.settings.touchSens || 1); I.look.dx += (tc.clientX - lx) * ts; I.look.dy += (tc.clientY - ly) * ts; lx = tc.clientX; ly = tc.clientY;
      }
      e.preventDefault();
    }, { passive: false });
    look.addEventListener('touchend', (e) => { if (e.targetTouches.length < 2) pinch = null; for (const tc of e.changedTouches) if (tc.identifier === lid) lid = null; });

    // buttons
    this.el.querySelectorAll('.tb').forEach((b) => {
      const a = b.dataset.a;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        G.audio.init();
        if (b.dataset.toggle) { if (I.held.has(a)) { I.virtualRelease(a); b.classList.remove('on'); } else { I.virtualPress(a); b.classList.add('on'); } return; }
        I.virtualPress(a); b.classList.add('on');
        if (G.dialogue.active && (a === 'interact' || a === 'attack' || a === 'jump')) G.dialogue.advance();
      }, { passive: false });
      const up = (e) => { e.preventDefault(); if (b.dataset.toggle) return; I.virtualRelease(a); b.classList.remove('on'); };
      b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
    });
  }
  moveStick(tc, sx, sy, knob) {
    const I = G.input;
    let dx = tc.clientX - sx, dy = tc.clientY - sy;
    const max = 50, l = Math.hypot(dx, dy);
    if (l > max) { dx *= max / l; dy *= max / l; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    I.touchMove.active = true;
    I.touchMove.x = dx / max; I.touchMove.y = -dy / max;
    I.lastDevice = 'touch';
  }
  show() { this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); }
  update() {
    const hide = G.ui.blocksGameplay() && !G.dialogue.active;
    this.el.classList.toggle('dim', hide);
    this.el.classList.toggle('dialogue', G.dialogue.active);
    this.el.querySelectorAll('.tb.p1,.tb.p2,.tb.p3,.tb.p4').forEach((b, i) => {
      const id = G.state.inv.powerSlots[i];
      b.style.display = id ? '' : 'none';
      if (id && b.dataset.ic !== id) { b.dataset.ic = id; b.innerHTML = img(powerIcon(id)); }
    });
  }
}
