// Unified input: keyboard + mouse (pointer lock) + virtual touch controls.
import { G } from './context.js';

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'jump',
  ControlLeft: 'dodge', KeyC: 'dodge', AltLeft: 'dodge',
  KeyE: 'interact', KeyF: 'interact',
  Digit1: 'power1', Digit2: 'power2', Digit3: 'power3', Digit4: 'power4',
  KeyQ: 'potion',
  KeyI: 'inventory', Tab: 'inventory',
  KeyJ: 'journal', KeyM: 'map', KeyP: 'powers', KeyK: 'character', KeyO: 'swords',
  Escape: 'pause', Enter: 'confirm',
  KeyR: 'lockon', KeyT: 'whistle',
};

export class Input {
  constructor(dom) {
    this.dom = dom;
    this.held = new Set();
    this.pressed = new Set();
    this.look = { dx: 0, dy: 0 };
    this.wheel = 0;
    this.touchMove = { x: 0, y: 0, active: false };
    this.mouse = { x: 0, y: 0 };
    this.locked = false;
    this.enabled = true;
    this.lastDevice = 'kb';

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const a = KEYMAP[e.code];
      if (a) {
        if (!this.held.has(a)) this.pressed.add(a);
        this.held.add(a);
        if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      }
      this.lastDevice = 'kb';
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.held.delete(a);
    });
    window.addEventListener('blur', () => this.held.clear());

    dom.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (!this.locked && !G.mobile && G.ui && G.ui.canLockPointer()) {
        dom.requestPointerLock?.();
      }
      if (e.button === 0) { this.pressed.add('attack'); this.held.add('attack'); }
      if (e.button === 2) { this.pressed.add('block'); this.held.add('block'); }
      if (e.button === 1) { this.pressed.add('lockon'); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.held.delete('attack');
      if (e.button === 2) this.held.delete('block');
    });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === dom;
    });
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (this.locked) {
        this.look.dx += e.movementX;
        this.look.dy += e.movementY;
      }
    });
    dom.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
  }

  // Called by touch UI
  virtualPress(a) { if (!this.held.has(a)) this.pressed.add(a); this.held.add(a); this.lastDevice = 'touch'; }
  virtualRelease(a) { this.held.delete(a); }

  moveVector() {
    if (this.touchMove.active) return { x: this.touchMove.x, y: this.touchMove.y };
    let x = 0, y = 0;
    if (this.held.has('left')) x -= 1;
    if (this.held.has('right')) x += 1;
    if (this.held.has('up')) y += 1;
    if (this.held.has('down')) y -= 1;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  isDown(a) { return this.enabled && this.held.has(a); }
  wasPressed(a) { return this.enabled && this.pressed.has(a); }
  consume(a) { const r = this.wasPressed(a); this.pressed.delete(a); return r; }

  endFrame() {
    this.pressed.clear();
    this.look.dx = 0; this.look.dy = 0;
    this.wheel = 0;
  }
  releaseAll() { this.held.clear(); this.pressed.clear(); this.touchMove.active = false; this.touchMove.x = this.touchMove.y = 0; }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
}
