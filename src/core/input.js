// Entrada: teclado (remapeável), mouse e gamepad.
export const DEFAULT_BINDS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  attack: ['KeyJ', 'Mouse0'], block: ['KeyK', 'Mouse2'], dodge: ['Space'], run: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE', 'Enter'], mount: ['KeyF'], whistle: ['KeyH'], bow: ['KeyR'], potion: ['KeyQ'],
  inventory: ['KeyI'], map: ['KeyM'], quests: ['KeyL'], menu: ['Escape', 'Tab'], political: ['KeyP'],
};

class Input {
  constructor() {
    this.binds = JSON.parse(JSON.stringify(DEFAULT_BINDS));
    this.down = new Set(); this.pressedSet = new Set(); this.releasedSet = new Set();
    this.mouse = { x: 0, y: 0, sx: 0, sy: 0, moved: false, usedRecently: 0 };
    this.listening = null; // callback de remapeamento
    this.pad = { axes: [0, 0], prev: {} };
    this.lastDevice = 'kb';
  }
  attach(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (this.listening) { e.preventDefault(); const cb = this.listening; this.listening = null; cb(e.code); return; }
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressedSet.add(e.code);
      this.down.add(e.code); this.lastDevice = 'kb';
    });
    window.addEventListener('keyup', (e) => { this.down.delete(e.code); this.releasedSet.add(e.code); });
    window.addEventListener('blur', () => this.down.clear());
    const mb = (e) => 'Mouse' + e.button;
    canvas.addEventListener('mousedown', (e) => {
      if (this.listening) { const cb = this.listening; this.listening = null; cb(mb(e)); return; }
      this.pressedSet.add(mb(e)); this.down.add(mb(e)); this.mouse.usedRecently = 3;
    });
    window.addEventListener('mouseup', (e) => { this.down.delete(mb(e)); this.releasedSet.add(mb(e)); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.sx = ((e.clientX - r.left) / r.width) * canvas.width;
      this.mouse.sy = ((e.clientY - r.top) / r.height) * canvas.height;
      this.mouse.moved = true; this.mouse.usedRecently = 3;
    });
  }
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && pads[0];
    if (!p) return;
    const map = { 0: 'Pad_A', 1: 'Pad_B', 2: 'Pad_X', 3: 'Pad_Y', 4: 'Pad_LB', 5: 'Pad_RB', 6: 'Pad_LT', 7: 'Pad_RT', 8: 'Pad_Back', 9: 'Pad_Start', 12: 'Pad_Up', 13: 'Pad_Down', 14: 'Pad_Left', 15: 'Pad_Right' };
    for (const [i, code] of Object.entries(map)) {
      const b = p.buttons[i] && p.buttons[i].pressed;
      if (b && !this.pad.prev[code]) { this.pressedSet.add(code); this.lastDevice = 'pad'; }
      if (!b && this.pad.prev[code]) this.releasedSet.add(code);
      if (b) this.down.add(code); else this.down.delete(code);
      this.pad.prev[code] = b;
    }
    const ax = Math.abs(p.axes[0]) > 0.25 ? p.axes[0] : 0, ay = Math.abs(p.axes[1]) > 0.25 ? p.axes[1] : 0;
    this.pad.axes = [ax, ay];
    if (ax || ay) this.lastDevice = 'pad';
  }
  padCodes(action) {
    return { attack: ['Pad_X'], block: ['Pad_LB', 'Pad_LT'], dodge: ['Pad_B'], run: ['Pad_RT'], interact: ['Pad_A'], mount: ['Pad_Y'], menu: ['Pad_Start'], map: ['Pad_Back'], potion: ['Pad_RB'], up: ['Pad_Up'], down: ['Pad_Down'], left: ['Pad_Left'], right: ['Pad_Right'] }[action] || [];
  }
  codes(action) { return (this.binds[action] || []).concat(this.padCodes(action)); }
  held(action) { return this.codes(action).some((c) => this.down.has(c)); }
  pressed(action) { return this.codes(action).some((c) => this.pressedSet.has(c)); }
  released(action) { return this.codes(action).some((c) => this.releasedSet.has(c)); }
  consume(action) { for (const c of this.codes(action)) this.pressedSet.delete(c); }
  axis() {
    let x = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    let y = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    if (!x && !y) { x = this.pad.axes[0]; y = this.pad.axes[1]; }
    const l = Math.hypot(x, y);
    return l > 1 ? [x / l, y / l] : [x, y];
  }
  endFrame() { this.pressedSet.clear(); this.releasedSet.clear(); this.mouse.moved = false; if (this.mouse.usedRecently > 0) this.mouse.usedRecently -= 1 / 60; }
  resetBinds() { this.binds = JSON.parse(JSON.stringify(DEFAULT_BINDS)); }
  keyName(code) {
    if (!code) return '—';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    const n = { Space: 'Espaço/Space', ShiftLeft: 'Shift', ShiftRight: 'Shift R', Mouse0: 'Mouse L', Mouse2: 'Mouse R', Mouse1: 'Mouse M', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Tab: 'Tab' };
    return n[code] || code;
  }
}
export const input = new Input();
