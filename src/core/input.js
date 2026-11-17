// Entrada unificada: teclado + controles touch. O jogo lê apenas `input.state`.

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.touch = null;
    this.enabled = true;
    this.state = this.blank();
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (PREVENT.has(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  blank() {
    return { moveX: 0, moveY: 0, steer: 0, throttle: 0, brake: 0, run: false, handbrake: false, horn: false,
      punch: false, interact: false, enterExit: false, pause: false, map: false, action: false };
  }

  k(...codes) { return codes.some((c) => this.keys.has(c)); }
  p(...codes) { return codes.some((c) => this.pressed.has(c)); }

  poll() {
    const s = this.blank();
    if (!this.enabled) { this.state = s; return s; }
    const left = this.k('KeyA', 'ArrowLeft'), right = this.k('KeyD', 'ArrowRight');
    const up = this.k('KeyW', 'ArrowUp'), down = this.k('KeyS', 'ArrowDown');
    s.moveX = (right ? 1 : 0) - (left ? 1 : 0);
    s.moveY = (down ? 1 : 0) - (up ? 1 : 0);
    s.steer = s.moveX;
    s.throttle = up ? 1 : 0;
    s.brake = down ? 1 : 0;
    s.run = this.k('ShiftLeft', 'ShiftRight');
    s.handbrake = this.k('Space');
    s.horn = this.k('KeyH');
    s.punch = this.p('Space');
    s.interact = this.p('KeyE');
    s.enterExit = this.p('KeyF', 'Enter', 'NumpadEnter');
    s.pause = this.p('Escape', 'KeyP');
    s.map = this.p('KeyM');

    const t = this.touch;
    if (t && t.active) {
      const ts = t.read();
      if (Math.abs(ts.joyX) > 0.01 || Math.abs(ts.joyY) > 0.01) {
        s.moveX = ts.joyX; s.moveY = ts.joyY;
        s.steer = Math.abs(ts.joyX) > 0.12 ? ts.joyX : 0;
      }
      if (ts.accel) s.throttle = 1;
      if (ts.brake) s.brake = 1;
      if (ts.run) s.run = true;
      if (ts.horn) s.horn = true;
      if (ts.actionHeld) s.handbrake = true;
      if (ts.actionPressed) s.action = true;
      if (ts.enterPressed) s.enterExit = true;
      if (ts.pausePressed) s.pause = true;
      if (ts.mapPressed) s.map = true;
    }
    this.state = s;
    return s;
  }

  endFrame() {
    this.pressed.clear();
    if (this.touch) this.touch.endFrame();
  }
}
