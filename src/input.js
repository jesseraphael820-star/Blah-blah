import { clamp } from './util.js';

// unifica teclado+mouse, controle (Gamepad API, analógico) e toque (analógico virtual)
export class Input {
  constructor(settings, canvas) {
    this.s = settings;
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mdx = 0; this.mdy = 0;
    this.mouseDown = false;
    this.locked = false;
    this.padPrev = [];
    this.padConnected = false;
    this.touch = { jx: 0, jy: 0, jid: null, lid: null, ldx: 0, ldy: 0, btn: new Set(), tap: new Set() };
    this.lastLook = 0;
    this.scheme = 'keyboard';

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('mousemove', (e) => {
      if (this.locked) { this.mdx += e.movementX; this.mdy += e.movementY; }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (this.wantLock && !this.locked && !this.touchActive()) canvas.requestPointerLock?.();
      if (e.button === 0) { this.mouseDown = true; this.pressed.add('Mouse0'); }
      if (e.button === 2) this.rightDown = true;
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; if (e.button === 2) this.rightDown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => this.pressed.add(e.deltaY > 0 ? 'WheelDown' : 'WheelUp'), { passive: true });
    document.addEventListener('pointerlockchange', () => (this.locked = document.pointerLockElement === canvas));
    addEventListener('gamepadconnected', () => (this.padConnected = true));
    addEventListener('gamepaddisconnected', () => (this.padConnected = [...(navigator.getGamepads?.() || [])].some(Boolean)));
    this.setupTouch();
  }

  touchActive() { return this.scheme === 'touch'; }

  setupTouch() {
    const T = this.touch;
    const zone = document.getElementById('touch');
    if (!zone) return;
    const base = document.getElementById('stick'), knob = document.getElementById('knob');
    const R = 60;
    zone.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        const b = t.target.closest?.('[data-k]');
        if (b) { T.btn.add(b.dataset.k); T.tap.add(b.dataset.k); b.classList.add('down'); b._tid = t.identifier; continue; }
        if (t.clientX < innerWidth * 0.45 && T.jid === null) {
          T.jid = t.identifier; T.ox = t.clientX; T.oy = t.clientY;
          base.style.left = `${t.clientX - R}px`; base.style.top = `${t.clientY - R}px`; base.classList.add('on');
          knob.style.transform = 'translate(0px,0px)';
        } else if (T.lid === null) { T.lid = t.identifier; T.lx = t.clientX; T.ly = t.clientY; }
      }
      e.preventDefault();
    }, { passive: false });
    zone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === T.jid) {
          let dx = t.clientX - T.ox, dy = t.clientY - T.oy;
          const d = Math.hypot(dx, dy);
          if (d > R) { dx *= R / d; dy *= R / d; }
          T.jx = dx / R; T.jy = dy / R;
          knob.style.transform = `translate(${dx}px,${dy}px)`;
        } else if (t.identifier === T.lid) {
          T.ldx += t.clientX - T.lx; T.ldy += t.clientY - T.ly; T.lx = t.clientX; T.ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === T.jid) { T.jid = null; T.jx = T.jy = 0; base.classList.remove('on'); }
        if (t.identifier === T.lid) T.lid = null;
        for (const b of zone.querySelectorAll('[data-k]')) if (b._tid === t.identifier) { T.btn.delete(b.dataset.k); b.classList.remove('down'); b._tid = null; }
      }
    };
    zone.addEventListener('touchend', end);
    zone.addEventListener('touchcancel', end);
  }

  readPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) { this.padConnected = true; return p; }
    return null;
  }

  rumble(strong, weak, ms = 180) {
    if (!this.s.get('vibration')) return;
    const p = this.readPad();
    p?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: clamp(strong, 0, 1), weakMagnitude: clamp(weak, 0, 1) }).catch?.(() => {});
    if (this.scheme === 'touch' && navigator.vibrate && strong > 0.3) navigator.vibrate(Math.min(ms, 120));
  }

  poll(dt) {
    const k = (c) => this.keys.has(c);
    const p = (c) => this.pressed.has(c);
    const pad = this.readPad();
    this.scheme = this.s.scheme(!!pad);
    const dz = this.s.get('deadzone');
    const sens = this.s.get('sens');
    const inv = this.s.get('invertY') ? -1 : 1;
    const st = {
      moveX: (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0),
      moveY: (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0),
      lookX: this.mdx * 0.0022 * sens, lookY: this.mdy * 0.0022 * sens * inv,
      throttle: k('KeyW') || k('ArrowUp') ? 1 : 0,
      brake: k('KeyS') || k('ArrowDown') ? 1 : 0,
      steer: (k('KeyA') || k('ArrowLeft') ? 1 : 0) - (k('KeyD') || k('ArrowRight') ? 1 : 0),
      handbrake: k('Space'), sprint: k('ShiftLeft') || k('ShiftRight'), walk: k('AltLeft'),
      jump: p('Space'), enter: p('KeyF'), punch: p('Mouse0') || p('KeyX'),
      map: p('KeyM'), pause: p('Escape') || p('KeyP'), radio: p('KeyR'), lights: p('KeyL'), horn: k('KeyH'),
      dive: k('ControlLeft') || k('KeyZ'), up: k('Space'),
      shiftUp: p('KeyE'), shiftDown: p('KeyQ'),
      // armas: Q/E ou roda do mouse troca, 1–5 escolhe, botão direito mira, clique segurado atira automático
      aim: !!this.rightDown, fire: !!this.mouseDown, weaponNext: p('KeyE') || p('WheelDown'), weaponPrev: p('KeyQ') || p('WheelUp'),
      weaponSlot: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].findIndex((c) => p(c)), cam: p('KeyC'), skip: p('Enter') || p('NumpadEnter'), retry: p('KeyF') || p('Enter'),
      analog: false, mag: 0,
    };
    st.mag = Math.min(1, Math.hypot(st.moveX, st.moveY));
    if (st.walk) st.mag *= 0.35;
    this.mdx = this.mdy = 0;

    if (pad) {
      const ax = (i) => { const v = pad.axes[i] || 0; return Math.abs(v) < dz ? 0 : (v - Math.sign(v) * dz) / (1 - dz); };
      const bt = (i) => pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5);
      const bv = (i) => (pad.buttons[i] ? pad.buttons[i].value : 0);
      const bp = (i) => bt(i) && !this.padPrev[i];
      const lx = ax(0), ly = ax(1), rx = ax(2), ry = ax(3);
      if (Math.abs(lx) + Math.abs(ly) > 0) {
        st.moveX = lx; st.moveY = -ly; st.mag = Math.min(1, Math.hypot(lx, ly)); st.steer = -lx; st.analog = true;
      }
      st.lookX += rx * 2.6 * sens * dt; st.lookY += ry * 2.0 * sens * dt * inv;
      if (rx || ry) this.lastLook = performance.now();
      const rt = bv(7), lt = bv(6);
      st.throttle = Math.max(st.throttle, rt); st.brake = Math.max(st.brake, lt);
      if (this.s.get('stickDrive') && rt < 0.05 && lt < 0.05) { st.throttle = Math.max(st.throttle, clamp(-ly, 0, 1)); st.brake = Math.max(st.brake, clamp(ly, 0, 1)); }
      st.sprint = st.sprint || bt(0); st.handbrake = st.handbrake || bt(0);
      st.jump = st.jump || bp(2); st.punch = st.punch || bp(1); st.enter = st.enter || bp(3);
      st.pause = st.pause || bp(9); st.map = st.map || bp(8); st.radio = st.radio || bp(14);
      st.horn = st.horn || bt(10); st.cam = st.cam || bp(11);
      st.shiftUp = st.shiftUp || bp(5); st.shiftDown = st.shiftDown || bp(4);
      st.dive = st.dive || bt(4); st.up = st.up || bt(2); st.lights = st.lights || bp(12);
      st.aim = st.aim || lt > 0.4; st.fire = st.fire || bt(1); st.weaponNext = st.weaponNext || bp(15);
      st.skip = st.skip || bp(0); st.retry = st.retry || bp(3);
      this.padPrev = pad.buttons.map((b) => b.pressed || b.value > 0.5);
    }

    const T = this.touch;
    if (this.scheme === 'touch') {
      if (T.jid !== null) {
        const mag = Math.min(1, Math.hypot(T.jx, T.jy));
        st.moveX = T.jx; st.moveY = -T.jy; st.mag = mag; st.steer = -T.jx; st.analog = true;
        if (this.s.get('stickDrive')) { st.throttle = Math.max(st.throttle, clamp(-T.jy * 1.4, 0, 1)); st.brake = Math.max(st.brake, clamp(T.jy * 1.4, 0, 1)); }
      }
      st.lookX += T.ldx * 0.006 * sens; st.lookY += T.ldy * 0.006 * sens * inv;
      if (T.ldx || T.ldy) this.lastLook = performance.now();
      T.ldx = T.ldy = 0;
      const b = (n) => T.btn.has(n), tp = (n) => T.tap.has(n);
      if (b('gas')) st.throttle = 1;
      if (b('brake')) st.brake = 1;
      st.handbrake = st.handbrake || b('hand');
      st.sprint = st.sprint || b('sprint');
      st.dive = st.dive || b('dive'); st.up = st.up || b('jump');
      st.jump = st.jump || tp('jump') || tp('hand');
      st.punch = st.punch || tp('punch');
      st.enter = st.enter || tp('enter'); st.retry = st.retry || tp('enter');
      st.lights = st.lights || tp('lights');
      st.map = st.map || tp('map'); st.pause = st.pause || tp('pause'); st.radio = st.radio || tp('radio');
      st.skip = st.skip || tp('skip'); st.cam = st.cam || tp('cam');
      st.weaponNext = st.weaponNext || tp('weapon'); st.aim = st.aim || b('aim'); st.fire = st.fire || b('punch');
      st.horn = st.horn || b('horn');
      T.tap.clear();
    }
    if (st.lookX || st.lookY) this.lastLook = performance.now();
    this.pressed.clear();
    return st;
  }
}
