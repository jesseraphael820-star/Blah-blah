// Controles: touchscreen (joystick + câmera + botões personalizáveis), teclado/mouse e giroscópio.
import { save, persist } from './save.js';

export const input = { mx: 0, my: 0, lookX: 0, lookY: 0, fire: false, ads: false, crouch: false, walk: false, jump: false, interact: false };

// x,y em % da tela (centro do botão); s = tamanho base em px (para tela de 400px de altura)
const BTN = {
  fire:   { label: '⦿', x: 87, y: 60, s: 86, cls: 'fire', name: 'Atirar' },
  fire2:  { label: '⦿', x: 7, y: 34, s: 58, cls: 'fire', name: 'Atirar (esq.)' },
  ads:    { label: '⌖', x: 95, y: 36, s: 54, name: 'Mirar' },
  reload: { label: '⟳', x: 75, y: 84, s: 52, name: 'Recarregar' },
  jump:   { label: '⤒', x: 94, y: 86, s: 58, name: 'Pular' },
  crouch: { label: '⤓', x: 84, y: 90, s: 50, name: 'Agachar' },
  walk:   { label: '🚶', x: 27, y: 90, s: 46, name: 'Andar' },
  swap:   { label: '⇄', x: 78, y: 40, s: 52, name: 'Trocar arma' },
  nade:   { label: '💣', x: 70, y: 60, s: 50, name: 'Granada' },
  use:    { label: '✋', x: 62, y: 80, s: 52, name: 'Interagir' },
  buy:    { label: '🛒', x: 31, y: 9, s: 44, name: 'Comprar' },
  score:  { label: '☰', x: 69, y: 9, s: 44, name: 'Placar' },
  stick:  { label: '', x: 15, y: 68, s: 120, cls: 'stickbase', name: 'Joystick' },
};
const PRESETS = {
  padrao: {},
  canhoto: Object.fromEntries(Object.entries(BTN).map(([k, b]) => [k, { x: 100 - b.x }])),
  garra: { fire2: { x: 9, y: 22, s: 70 }, jump: { x: 94, y: 22, s: 56 }, crouch: { x: 94, y: 84, s: 54 }, ads: { x: 84, y: 30 }, swap: { x: 74, y: 28 }, reload: { x: 76, y: 86 } },
};
export const LAYOUTS = { padrao: 'Padrão', canhoto: 'Canhoto', garra: 'Garra (4 dedos)' };

export class Controls {
  constructor(root, onAction) {
    this.root = root; this.onAction = onAction; this.enabled = false; this.edit = false; this.ptr = new Map(); this.el = {}; this.keys = {};
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    for (const id in BTN) {
      const b = document.createElement('div'); b.className = 'tbtn ' + (BTN[id].cls || ''); b.dataset.id = id; b.textContent = BTN[id].label; root.appendChild(b); this.el[id] = b;
    }
    this.knob = document.createElement('div'); this.knob.className = 'knob'; this.el.stick.appendChild(this.knob);
    root.addEventListener('pointerdown', e => this.down(e)); root.addEventListener('pointermove', e => this.moveP(e));
    for (const ev of ['pointerup', 'pointercancel']) root.addEventListener(ev, e => this.up(e));
    root.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('keydown', e => this.key(e, true)); addEventListener('keyup', e => this.key(e, false));
    addEventListener('mousemove', e => { if (this.enabled && document.pointerLockElement) { input.lookX += e.movementX; input.lookY += e.movementY; } });
    addEventListener('resize', () => this.applyLayout());
    addEventListener('devicemotion', e => this.gyro(e));
    this.applyLayout();
  }
  cfg(id) {
    const base = BTN[id], pre = PRESETS[save.settings.layout]?.[id] || {}, cus = save.hud[id] || {};
    return { x: cus.x ?? pre.x ?? base.x, y: cus.y ?? pre.y ?? base.y, s: (cus.s ?? 1) * (pre.s ?? base.s) };
  }
  applyLayout() {
    const u = Math.min(innerHeight, innerWidth * 0.6) / 400;
    for (const id in BTN) {
      const c = this.cfg(id), e = this.el[id], px = c.s * u;
      e.style.width = e.style.height = px + 'px'; e.style.left = `calc(${c.x}% - ${px / 2}px)`; e.style.top = `calc(${c.y}% - ${px / 2}px)`; e.style.fontSize = px * 0.5 + 'px';
    }
    this.root.style.setProperty('--hud-op', save.settings.hudOpacity);
    this.root.classList.toggle('desktop', !this.isTouch && !this.edit);
  }
  setEnabled(on) {
    this.enabled = on; this.root.style.display = on || this.edit ? 'block' : 'none';
    if (!on) { this.reset(); if (document.pointerLockElement) document.exitPointerLock(); }
  }
  reset() { Object.assign(input, { mx: 0, my: 0, lookX: 0, lookY: 0, fire: false, jump: false, interact: false }); this.ptr.clear(); this.knob.style.transform = ''; for (const id in this.el) this.el[id].classList.remove('on'); this.syncToggles(); }
  syncToggles() { for (const k of ['ads', 'crouch', 'walk']) this.el[k].classList.toggle('on', input[k]); }
  lock() { if (!this.isTouch && this.enabled && !document.pointerLockElement) this.root.requestPointerLock?.(); }

  down(e) {
    const id = e.target.closest?.('.tbtn')?.dataset.id;
    if (this.edit) { if (id) { this.sel = id; this.ptr.set(e.pointerId, { type: 'edit', id }); this.editUI(); } return; }
    if (!this.enabled) return;
    e.preventDefault();
    if (e.pointerType === 'mouse' && !this.isTouch) { this.lock(); if (e.button === 0) input.fire = true; if (e.button === 2) input.ads = true; return; }
    try { this.root.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    if (id && id !== 'stick') {
      this.ptr.set(e.pointerId, { type: 'btn', id, x: e.clientX, y: e.clientY }); this.el[id].classList.add('on');
      if (id === 'fire' || id === 'fire2') input.fire = true;
      else if (id === 'jump') input.jump = true;
      else if (id === 'use') input.interact = true;
      else if (id === 'ads' || id === 'crouch' || id === 'walk') { input[id] = !input[id]; this.syncToggles(); }
      else this.onAction(id);
      return;
    }
    const left = e.clientX < innerWidth * 0.42;
    if ((id === 'stick' || left) && ![...this.ptr.values()].some(p => p.type === 'stick')) {
      const r = this.el.stick.getBoundingClientRect();
      this.ptr.set(e.pointerId, { type: 'stick', ox: id === 'stick' ? r.left + r.width / 2 : e.clientX, oy: id === 'stick' ? r.top + r.height / 2 : e.clientY, rad: r.width * 0.42 });
      if (id !== 'stick') { this.el.stick.style.left = e.clientX - r.width / 2 + 'px'; this.el.stick.style.top = e.clientY - r.height / 2 + 'px'; }
      this.el.stick.classList.add('on'); this.moveP(e);
    } else this.ptr.set(e.pointerId, { type: 'look', x: e.clientX, y: e.clientY });
  }
  moveP(e) {
    const p = this.ptr.get(e.pointerId); if (!p) return;
    if (p.type === 'edit') {
      const x = Math.max(3, Math.min(97, e.clientX / innerWidth * 100)), y = Math.max(5, Math.min(95, e.clientY / innerHeight * 100));
      save.hud[p.id] = { ...(save.hud[p.id] || {}), x: +x.toFixed(1), y: +y.toFixed(1) }; this.applyLayout(); return;
    }
    if (p.type === 'stick') {
      let dx = e.clientX - p.ox, dy = e.clientY - p.oy; const d = Math.hypot(dx, dy); if (d > p.rad) { dx *= p.rad / d; dy *= p.rad / d; }
      input.mx = dx / p.rad; input.my = -dy / p.rad; this.knob.style.transform = `translate(${dx}px,${dy}px)`;
    } else if (p.type === 'look' || (p.type === 'btn' && (p.id === 'fire' || p.id === 'fire2'))) {
      input.lookX += (e.clientX - p.x) * 1.6; input.lookY += (e.clientY - p.y) * 1.6; p.x = e.clientX; p.y = e.clientY;
    }
  }
  up(e) {
    if (e.pointerType === 'mouse' && !this.isTouch && !this.edit) { if (e.button === 0) input.fire = false; if (e.button === 2) input.ads = false; return; }
    const p = this.ptr.get(e.pointerId); if (!p) return; this.ptr.delete(e.pointerId);
    if (p.type === 'edit') { persist(); return; }
    if (p.type === 'stick') { input.mx = input.my = 0; this.knob.style.transform = ''; this.el.stick.classList.remove('on'); this.applyLayout(); }
    else if (p.type === 'btn') {
      if (!['ads', 'crouch', 'walk'].includes(p.id)) this.el[p.id].classList.remove('on');
      if (p.id === 'fire' || p.id === 'fire2') input.fire = [...this.ptr.values()].some(q => q.id === 'fire' || q.id === 'fire2');
      else if (p.id === 'jump') input.jump = false; else if (p.id === 'use') input.interact = false;
    }
  }
  key(e, d) {
    if (!this.enabled || e.repeat) { if (this.enabled && e.code === 'Tab') e.preventDefault(); return; }
    const k = this.keys; k[e.code] = d;
    const map = { KeyR: 'reload', KeyQ: 'swap', KeyG: 'nade', KeyB: 'buy', Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'nade', Digit5: 'slot5', Escape: 'pause', KeyP: 'pause' };
    if (e.code === 'Tab') { e.preventDefault(); this.onAction(d ? 'scoreOn' : 'scoreOff'); }
    else if (d && map[e.code]) this.onAction(map[e.code]);
    input.mx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0); input.my = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
    input.jump = !!k.Space; input.crouch = !!(k.ControlLeft || k.KeyC); input.walk = !!k.ShiftLeft; input.interact = !!k.KeyE;
    if (e.code === 'Space') e.preventDefault();
  }
  gyro(e) {
    if (!this.enabled || !save.settings.gyro || !e.rotationRate) return;
    const r = e.rotationRate, ang = (screen.orientation?.angle ?? 0), sg = ang === 270 || ang === -90 ? -1 : 1, k = 0.35 * save.settings.gyroSens * (e.interval > 1 ? e.interval / 16 : 1);
    if (ang === 0 || ang === 180) { input.lookX -= (r.gamma || 0) * k; input.lookY -= (r.alpha || 0) * k * (ang ? -1 : 1); }
    else { input.lookX -= (r.beta || 0) * k * sg; input.lookY += (r.gamma || 0) * k * sg; }
  }
  async requestGyro() {
    try { if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) return (await DeviceMotionEvent.requestPermission()) === 'granted'; } catch (_) { return false; }
    return typeof DeviceMotionEvent !== 'undefined';
  }

  // ---------- Editor de HUD ----------
  startEdit(onDone) {
    this.edit = true; this.sel = 'fire'; this.root.style.display = 'block'; this.root.classList.add('editing'); this.applyLayout();
    const p = this.panel = document.createElement('div'); p.className = 'hud-editor';
    p.innerHTML = `<b>EDITAR HUD</b><span class="he-name"></span>
      <label>Tamanho <input type="range" min="0.6" max="1.8" step="0.05" class="he-size"></label>
      <label>Opacidade <input type="range" min="0.3" max="1" step="0.05" class="he-op"></label>
      <div class="row"><button class="btn sm he-reset">Restaurar</button><button class="btn sm primary he-done">Salvar</button></div>
      <small>Arraste os botões para reposicionar.</small>`;
    this.root.appendChild(p);
    p.addEventListener('pointerdown', e => e.stopPropagation());
    p.querySelector('.he-size').oninput = e => { save.hud[this.sel] = { ...(save.hud[this.sel] || {}), s: +e.target.value }; this.applyLayout(); };
    p.querySelector('.he-op').value = save.settings.hudOpacity;
    p.querySelector('.he-op').oninput = e => { save.settings.hudOpacity = +e.target.value; this.applyLayout(); };
    p.querySelector('.he-reset').onclick = () => { save.hud = {}; this.applyLayout(); this.editUI(); };
    p.querySelector('.he-done').onclick = () => { persist(); this.edit = false; this.root.classList.remove('editing'); p.remove(); this.ptr.clear(); for (const id in this.el) this.el[id].classList.remove('sel'); this.setEnabled(this.enabled); this.applyLayout(); onDone?.(); };
    this.editUI();
  }
  editUI() {
    for (const id in this.el) this.el[id].classList.toggle('sel', id === this.sel);
    this.panel.querySelector('.he-name').textContent = BTN[this.sel].name;
    this.panel.querySelector('.he-size').value = save.hud[this.sel]?.s ?? 1;
  }
}
