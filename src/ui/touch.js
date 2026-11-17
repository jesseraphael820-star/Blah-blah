// Controles touchscreen: joystick virtual dinâmico (esquerda) e botões
// contextuais (direita) que aparecem conforme a situação do personagem.

export class TouchControls {
  constructor() {
    this.root = document.getElementById('touch');
    this.zone = document.getElementById('joy-zone');
    this.base = document.getElementById('joy-base');
    this.knob = document.getElementById('joy-knob');
    this.active = false;
    this.joy = { id: null, x: 0, y: 0, cx: 0, cy: 0 };
    this.held = { accel: false, brake: false, run: false, action: false, enter: false, horn: false };
    this.pressedSet = new Set();
    this.vibrate = true;
    this.ctx = '';

    const z = this.zone;
    z.addEventListener('pointerdown', (e) => this.joyStart(e));
    z.addEventListener('pointermove', (e) => this.joyMove(e));
    z.addEventListener('pointerup', (e) => this.joyEnd(e));
    z.addEventListener('pointercancel', (e) => this.joyEnd(e));
    z.addEventListener('lostpointercapture', (e) => this.joyEnd(e));

    for (const b of this.root.querySelectorAll('.tb')) {
      const name = b.dataset.b;
      const down = (e) => {
        e.preventDefault();
        try { b.setPointerCapture(e.pointerId); } catch { /* ignora */ }
        this.held[name] = true;
        this.pressedSet.add(name);
        b.classList.add('on');
        if (this.vibrate && navigator.vibrate) navigator.vibrate(12);
      };
      const up = (e) => {
        e.preventDefault();
        this.held[name] = false;
        b.classList.remove('on');
      };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  show(on) {
    this.active = on;
    this.root.classList.toggle('hidden', !on);
    if (!on) this.reset();
  }

  reset() {
    for (const k in this.held) this.held[k] = false;
    this.joy.id = null; this.joy.x = 0; this.joy.y = 0;
    this.knob.style.transform = '';
    for (const b of this.root.querySelectorAll('.tb')) b.classList.remove('on');
  }

  setStyle(size, opacity) {
    document.documentElement.style.setProperty('--tsize', size);
    document.documentElement.style.setProperty('--topa', opacity);
  }

  // Contexto: 'foot' | 'car'; nearVehicle mostra ENTRAR; canInteract destaca AÇÃO.
  setContext(mode, nearVehicle, canInteract) {
    const key = mode + nearVehicle + canInteract;
    if (key === this.ctx) return;
    this.ctx = key;
    this.root.classList.toggle('foot', mode === 'foot');
    this.root.classList.toggle('car', mode === 'car');
    this.root.classList.toggle('no-enter', mode === 'foot' && !nearVehicle);
    const enter = this.root.querySelector('.tb-enter');
    enter.textContent = mode === 'car' ? 'SAIR' : 'ENTRAR';
    const act = this.root.querySelector('.tb-action');
    act.textContent = canInteract ? 'USAR' : mode === 'car' ? 'FREIO DE MÃO' : 'SOCO';
    act.classList.toggle('ready', !!canInteract);
  }

  joyStart(e) {
    if (this.joy.id !== null) return;
    e.preventDefault();
    this.joy.id = e.pointerId;
    try { this.zone.setPointerCapture(e.pointerId); } catch { /* ignora */ }
    const r = this.base.getBoundingClientRect();
    const zr = this.zone.getBoundingClientRect();
    // joystick dinâmico: centraliza onde o dedo tocou
    const w = r.width;
    let left = e.clientX - zr.left - w / 2, top = e.clientY - zr.top - w / 2;
    left = Math.max(4, Math.min(zr.width - w - 4, left));
    top = Math.max(4, Math.min(zr.height - w - 4, top));
    this.base.style.left = left + 'px';
    this.base.style.top = top + 'px';
    this.base.style.bottom = 'auto';
    this.joy.cx = zr.left + left + w / 2;
    this.joy.cy = zr.top + top + w / 2;
    this.joyMove(e);
  }

  joyMove(e) {
    if (e.pointerId !== this.joy.id) return;
    e.preventDefault();
    const r = this.base.getBoundingClientRect().width / 2;
    let dx = e.clientX - this.joy.cx, dy = e.clientY - this.joy.cy;
    const l = Math.hypot(dx, dy);
    if (l > r) { dx = (dx / l) * r; dy = (dy / l) * r; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    let nx = dx / r, ny = dy / r;
    const m = Math.hypot(nx, ny);
    if (m < 0.15) { nx = 0; ny = 0; }
    this.joy.x = nx; this.joy.y = ny;
  }

  joyEnd(e) {
    if (e.pointerId !== this.joy.id) return;
    this.joy.id = null;
    this.joy.x = 0; this.joy.y = 0;
    this.knob.style.transform = '';
    this.base.style.left = '';
    this.base.style.top = '';
    this.base.style.bottom = '';
  }

  read() {
    const p = this.pressedSet;
    return {
      joyX: this.joy.x, joyY: this.joy.y,
      accel: this.held.accel, brake: this.held.brake, run: this.held.run, horn: this.held.horn,
      actionHeld: this.held.action, actionPressed: p.has('action'), enterPressed: p.has('enter'),
      pausePressed: p.has('pause'), mapPressed: p.has('map'),
    };
  }

  endFrame() {
    this.pressedSet.clear();
  }
}
