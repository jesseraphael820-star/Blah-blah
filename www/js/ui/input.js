// On-screen input devices: analog-stick mouse (with left/right/double click,
// drag, scroll), full PC keyboard with modifiers and shortcuts, and gamepad
// support. Synthetic events are dispatched to whatever is under the virtual
// cursor, so every app (and games) receive them like real mouse/keyboard
// input. Apps that need raw input (the x86 VM) register a "grab" handler.
// Physical Bluetooth/USB keyboards and mice work natively in parallel.

import { h, clamp } from "../core/util.js";
import { ui } from "./icons.js";
import { toggleFullscreen } from "./launcher.js";

const CURSOR_SVG = `<svg viewBox="0 0 24 24" width="24" height="24"><path d="M4 2.5v17.2l4.6-4.3 3 6.6 3-1.4-3-6.4h6.2Z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg>`;

// [label, code, key, shiftKey, width]
const ROWS = [
  [["Esc", "Escape", "Escape"], ["F1", "F1", "F1"], ["F2", "F2", "F2"], ["F3", "F3", "F3"], ["F4", "F4", "F4"], ["F5", "F5", "F5"], ["F6", "F6", "F6"], ["F7", "F7", "F7"], ["F8", "F8", "F8"], ["F9", "F9", "F9"], ["F10", "F10", "F10"], ["F11", "F11", "F11"], ["F12", "F12", "F12"], ["Del", "Delete", "Delete"]],
  [["`", "Backquote", "`", "~"], ["1", "Digit1", "1", "!"], ["2", "Digit2", "2", "@"], ["3", "Digit3", "3", "#"], ["4", "Digit4", "4", "$"], ["5", "Digit5", "5", "%"], ["6", "Digit6", "6", "^"], ["7", "Digit7", "7", "&"], ["8", "Digit8", "8", "*"], ["9", "Digit9", "9", "("], ["0", "Digit0", "0", ")"], ["-", "Minus", "-", "_"], ["=", "Equal", "=", "+"], ["⌫", "Backspace", "Backspace", null, 1.8]],
  [["Tab", "Tab", "Tab", null, 1.4], ..."qwertyuiop".split("").map((c) => [c, "Key" + c.toUpperCase(), c, c.toUpperCase()]), ["[", "BracketLeft", "[", "{"], ["]", "BracketRight", "]", "}"], ["\\", "Backslash", "\\", "|", 1.2]],
  [["Caps", "CapsLock", "CapsLock", null, 1.6], ..."asdfghjkl".split("").map((c) => [c, "Key" + c.toUpperCase(), c, c.toUpperCase()]), [";", "Semicolon", ";", ":"], ["'", "Quote", "'", '"'], ["ç", "Semicolon", "ç", "Ç"], ["Enter", "Enter", "Enter", null, 1.8]],
  [["Shift", "ShiftLeft", "Shift", null, 2], ..."zxcvbnm".split("").map((c) => [c, "Key" + c.toUpperCase(), c, c.toUpperCase()]), [",", "Comma", ",", "<"], [".", "Period", ".", ">"], ["/", "Slash", "/", "?"], ["↑", "ArrowUp", "ArrowUp"], ["Shift", "ShiftRight", "Shift", null, 1.4]],
  [["Ctrl", "ControlLeft", "Control", null, 1.4], ["Win", "MetaLeft", "Meta", null, 1.2], ["Alt", "AltLeft", "Alt", null, 1.2], ["", "Space", " ", " ", 6], ["Alt", "AltRight", "Alt", null, 1.2], ["←", "ArrowLeft", "ArrowLeft"], ["↓", "ArrowDown", "ArrowDown"], ["→", "ArrowRight", "ArrowRight"], ["Ctrl", "ControlRight", "Control", null, 1.4]],
];
const SHORTCUTS = [
  ["Ctrl+C", ["Control", "c"]], ["Ctrl+V", ["Control", "v"]], ["Ctrl+X", ["Control", "x"]], ["Ctrl+Z", ["Control", "z"]], ["Ctrl+A", ["Control", "a"]], ["Ctrl+S", ["Control", "s"]],
  ["Alt+Tab", ["Alt", "Tab"]], ["Alt+F4", ["Alt", "F4"]], ["Win+D", ["Meta", "d"]], ["Win+E", ["Meta", "e"]], ["Ctrl+Shift+Esc", ["Control", "Shift", "Escape"]], ["Ctrl+Alt+Del", ["Control", "Alt", "Delete"]],
];
const MOD = { Control: "ctrlKey", Shift: "shiftKey", Alt: "altKey", Meta: "metaKey" };
const CODE_OF = { Control: "ControlLeft", Shift: "ShiftLeft", Alt: "AltLeft", Meta: "MetaLeft", Tab: "Tab", Escape: "Escape", Delete: "Delete", F4: "F4", Enter: "Enter", Backspace: "Backspace" };

export class InputLayer {
  constructor(shell) {
    this.shell = shell;
    this.x = window.innerWidth / 2;
    this.y = window.innerHeight / 3;
    this.vec = { x: 0, y: 0 };
    this.buttons = 0;
    this.mods = new Set();
    this.caps = false;
    this.mode = "mouse"; // mouse | keys
    this.grab = null; // {move(dx,dy), button(i,down), wheel(dy), key(code,down), release()}
    this.held = new Set();
    this.build();
    this.applySettings();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    this.lastT = performance.now();
    this.onWinFocus = () => this.autoMode();
    shell.wm.on("change", this.onWinFocus);
  }

  get cfg() { return this.shell.settings.controls || {}; }

  build() {
    const s = this.shell;
    this.cursor = h("div", { class: "vcursor", html: CURSOR_SVG });
    this.knob = h("div", { class: "joy-knob" });
    this.joy = h("div", { class: "joy" }, h("div", { class: "joy-ring" }), this.knob);
    const btn = (cls, label, title) => h("button", { class: "vbtn " + cls, title }, label);
    this.bL = btn("vb-l", "L", "Clique esquerdo (segure para arrastar)");
    this.bR = btn("vb-r", "R", "Clique direito");
    this.bDbl = btn("vb-dbl", "2×", "Clique duplo");
    this.bLock = btn("vb-lock", h("span", { html: ui("hand", 16) }), "Travar botão (arrastar e soltar)");
    this.bA = btn("vb-a", "A", "Espaço / ação");
    this.bB = btn("vb-b", "B", "Tecla X / ação 2");
    this.wheel = h("div", { class: "vwheel", title: "Arraste para rolar" }, h("span", { html: ui("scroll", 16) }));
    this.pad = h("div", { class: "vpad" }, this.bL, this.bR, this.bDbl, this.bLock, this.wheel, this.bA, this.bB);
    this.release = h("button", { class: "vrelease hidden", onclick: () => this.releaseGrab() }, h("span", { html: ui("mouse", 14) }), "Liberar mouse da VM");
    this.toolbar = h("div", { class: "vtoolbar" },
      h("button", { class: "vt-btn vt-handle", title: "Controles", html: ui("sliders", 16), onclick: () => this.expandToolbar() }),
      this.tbMode = h("button", { class: "vt-btn", title: "Analógico: mouse ou setas (jogos)", onclick: () => this.setMode(this.mode === "mouse" ? "keys" : "mouse", true) }),
      h("button", { class: "vt-btn", title: "Teclado virtual", html: ui("keyboard", 18), onclick: () => this.toggleKeyboard() }),
      this.tbHide = h("button", { class: "vt-btn", title: "Mostrar/ocultar controles", onclick: () => s.setSetting("controls.visible", this.cfg.visible === false) }),
      this.tbFull = h("button", { class: "vt-btn", title: "Tela cheia", onclick: async () => { await toggleFullscreen(); this.updateToolbar(); } }));
    this.controls = h("div", { class: "vcontrols" }, this.joy, this.pad);
    this.kbd = this.buildKeyboard();
    s.el.append(this.controls, this.cursor, this.release, this.toolbar, this.kbd);
    document.addEventListener("fullscreenchange", (this.onFs = () => this.updateToolbar()));

    // analog stick
    let joyId = null, cx = 0, cy = 0, radius = 50;
    const setVec = (e) => {
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const m = Math.hypot(dx, dy);
      if (m > radius) { dx = (dx / m) * radius; dy = (dy / m) * radius; }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.vec = { x: dx / radius, y: dy / radius };
    };
    this.joy.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && !e.isTrusted) return;
      e.preventDefault();
      joyId = e.pointerId;
      this.joy.setPointerCapture(e.pointerId);
      const r = this.joy.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2; radius = r.width * 0.36;
      this.joy.classList.add("on");
      setVec(e);
    });
    this.joy.addEventListener("pointermove", (e) => { if (e.pointerId === joyId) setVec(e); });
    const endJoy = (e) => { if (e.pointerId !== joyId) return; joyId = null; this.vec = { x: 0, y: 0 }; this.knob.style.transform = ""; this.joy.classList.remove("on"); };
    this.joy.addEventListener("pointerup", endJoy);
    this.joy.addEventListener("pointercancel", endJoy);

    const hold = (el, down, up) => {
      el.addEventListener("pointerdown", (e) => { if (!e.isTrusted) return; e.preventDefault(); e.stopPropagation(); el.setPointerCapture?.(e.pointerId); el.classList.add("on"); this.haptic(); down(); });
      const end = (e) => { if (!e.isTrusted || !el.classList.contains("on")) return; el.classList.remove("on"); up?.(); };
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
      el.addEventListener("contextmenu", (e) => e.preventDefault());
    };
    hold(this.bL, () => this.press(0), () => { if (!this.locked) this.releaseBtn(0); });
    hold(this.bR, () => this.press(2), () => this.releaseBtn(2));
    hold(this.bDbl, () => this.doubleClick());
    hold(this.bLock, () => {
      this.locked = !this.locked;
      this.bLock.classList.toggle("locked", this.locked);
      if (this.locked) this.press(0); else this.releaseBtn(0);
    });
    hold(this.bA, () => this.key("Space", " ", true), () => this.key("Space", " ", false));
    hold(this.bB, () => this.key("KeyX", "x", true), () => this.key("KeyX", "x", false));

    let wy = null;
    this.wheel.addEventListener("pointerdown", (e) => { if (!e.isTrusted) return; e.preventDefault(); this.wheel.setPointerCapture(e.pointerId); wy = e.clientY; this.wheel.classList.add("on"); });
    this.wheel.addEventListener("pointermove", (e) => { if (wy == null) return; const d = e.clientY - wy; if (Math.abs(d) > 4) { this.scroll(d * 3); wy = e.clientY; } });
    const wend = () => { wy = null; this.wheel.classList.remove("on"); };
    this.wheel.addEventListener("pointerup", wend);
    this.wheel.addEventListener("pointercancel", wend);

    // A real mouse moving over the PC screen moves our cursor too (keeps them in sync)
    this.onRealMove = (e) => { if (e.isTrusted && e.pointerType === "mouse" && !e.target.closest?.(".vcontrols, .vtoolbar, .vkbd, .vrelease")) { this.x = e.clientX; this.y = e.clientY; this.cursor.classList.add("real"); this.placeCursor(); } };
    window.addEventListener("pointermove", this.onRealMove, true);
  }

  buildKeyboard() {
    const kb = h("div", { class: "vkbd hidden" });
    const strip = h("div", { class: "vk-strip" },
      SHORTCUTS.map(([label, combo]) => h("button", { class: "vk-sc", onpointerdown: (e) => { e.preventDefault(); this.haptic(); this.combo(combo); } }, label)),
      h("button", { class: "vk-sc vk-close", onpointerdown: (e) => { e.preventDefault(); this.toggleKeyboard(false); }, html: ui("chevDown", 16) }));
    kb.append(strip);
    this.keyEls = [];
    for (const row of ROWS) {
      const r = h("div", { class: "vk-row" });
      for (const [label, code, key, shiftKey, w = 1] of row) {
        const isMod = ["Control", "Shift", "Alt", "Meta"].includes(key);
        const b = h("button", { class: "vk" + (isMod ? " mod" : "") + (key === "CapsLock" ? " mod" : ""), style: { flex: w }, dataset: { code } }, label);
        b._k = { label, code, key, shiftKey, isMod };
        this.keyEls.push(b);
        let repeat;
        b.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          this.haptic();
          b.classList.add("down");
          if (isMod) {
            if (this.mods.has(key)) { this.mods.delete(key); this.key(code, key, false); } else { this.mods.add(key); this.key(code, key, true); }
            this.refreshKeys();
            return;
          }
          if (key === "CapsLock") { this.caps = !this.caps; this.refreshKeys(); this.key(code, key, true); this.key(code, key, false); return; }
          const k = this.effectiveKey(b._k);
          this.key(code, k, true);
          this.held.add(b);
          repeat = setTimeout(function rep(self) { self.key(code, k, true, true); repeat = setTimeout(rep, 45, self); }, 450, this);
        });
        const up = () => {
          b.classList.remove("down");
          clearTimeout(repeat);
          if (isMod || key === "CapsLock" || !this.held.has(b)) return;
          this.held.delete(b);
          this.key(code, this.effectiveKey(b._k), false);
          // one-shot modifiers release after a normal key
          if (this.mods.size) { for (const m of this.mods) this.key(CODE_OF[m], m, false); this.mods.clear(); this.refreshKeys(); }
        };
        b.addEventListener("pointerup", up);
        b.addEventListener("pointercancel", up);
        b.addEventListener("pointerleave", up);
        r.append(b);
      }
      kb.append(r);
    }
    return kb;
  }

  effectiveKey({ key, shiftKey }) {
    const shift = this.mods.has("Shift");
    if (shiftKey == null) return key;
    if (/^[a-zç]$/.test(key)) return shift !== this.caps ? shiftKey : key;
    return shift ? shiftKey : key;
  }
  refreshKeys() {
    for (const b of this.keyEls) {
      const { key, label, shiftKey } = b._k;
      if (["Control", "Shift", "Alt", "Meta"].includes(key)) b.classList.toggle("on", this.mods.has(key));
      else if (key === "CapsLock") b.classList.toggle("on", this.caps);
      else if (shiftKey && label.length === 1) b.textContent = this.effectiveKey(b._k);
    }
  }

  toggleKeyboard(force) {
    const show = force ?? this.kbd.classList.contains("hidden");
    this.kbd.classList.toggle("hidden", !show);
    this.shell.el.classList.toggle("kbd-open", show);
    this.layout();
  }

  applySettings() {
    const c = this.cfg;
    const visible = c.visible !== false;
    this.controls.classList.toggle("hidden", !visible);
    this.cursor.classList.toggle("hidden", !visible && !this.cursor.classList.contains("real"));
    this.controls.classList.toggle("left-handed", !!c.leftHanded);
    this.controls.style.setProperty("--joy", (c.size || 120) + "px");
    this.controls.style.opacity = c.opacity ?? 0.9;
    this.updateToolbar();
    this.shell.el.classList.toggle("ctl-on", visible);
  }

  expandToolbar(force) {
    const open = force ?? !this.toolbar.classList.contains("open");
    this.toolbar.classList.toggle("open", open);
    clearTimeout(this.tbTimer);
    if (open) this.tbTimer = setTimeout(() => this.toolbar.classList.remove("open"), 5000);
  }

  updateToolbar() {
    this.tbMode.innerHTML = ui(this.mode === "mouse" ? "mouse" : "gamepad", 18);
    this.tbMode.classList.toggle("on", this.mode === "keys");
    this.tbHide.innerHTML = ui(this.cfg.visible === false ? "eye" : "x", 18);
    this.tbFull.innerHTML = ui(document.fullscreenElement ? "exitFull" : "fullscreen", 18);
    const hidden = this.cfg.visible === false;
    this.tbHide.title = hidden ? "Mostrar controles na tela" : "Ocultar controles";
    this.pad.classList.toggle("keys-mode", this.mode === "keys");
  }

  setMode(m, manual) {
    if (manual) this.manualMode = m;
    if (this.mode === m) return;
    // release any arrow keys still held
    if (this.mode === "keys") this.setArrows({ x: 0, y: 0 });
    this.mode = m;
    this.updateToolbar();
  }
  autoMode() {
    const p = this.shell.procs.get(this.shell.wm.active?.pid);
    const want = p?.inst?.preferredInput === "keys" ? "keys" : "mouse";
    if (this.manualMode && this._lastActive === p) return;
    this._lastActive = p;
    this.manualMode = null;
    this.setMode(want);
  }

  dockHeight() {
    const portrait = window.innerHeight > window.innerWidth * 1.05 && window.innerWidth < 900;
    if (!portrait) return 0;
    const kbOpen = !this.kbd.classList.contains("hidden");
    if (this.cfg.visible === false && !kbOpen) return 0;
    return Math.round(Math.min(window.innerHeight * 0.42, kbOpen ? 330 : 230));
  }

  layout() {
    const dock = this.dockHeight();
    this.shell.el.classList.toggle("docked", dock > 0);
    this.shell.el.classList.toggle("ctl-on", this.cfg.visible !== false);
    this.shell.el.style.setProperty("--dock", dock + "px");
    // keep the floating controls above the PC's taskbar
    const r = this.shell.screen.getBoundingClientRect();
    this.controls.style.setProperty("--tb", Math.max(0, window.innerHeight - r.bottom) + this.shell.taskbarHeight * this.shell.scale + "px");
    if (this.shell.stage) this.shell.stage.style.bottom = dock + "px";
    this.clampCursor();
    this.placeCursor();
  }

  haptic() { if (this.cfg.haptics !== false) navigator.vibrate?.(8); }

  // ---------------- cursor ----------------
  loop(t) {
    const dt = Math.min(50, t - this.lastT) / 1000;
    this.lastT = t;
    this.pollGamepad();
    const v = this.vec;
    const m = Math.hypot(v.x, v.y);
    if (this.mode === "keys" && !this.grab?.wantsMouse) this.setArrows(v);
    else if (m > 0.08) {
      const speed = 700 * (this.cfg.sensitivity || 1) * Math.pow(m, 1.7);
      const dx = (v.x / m) * speed * dt, dy = (v.y / m) * speed * dt;
      if (this.grab) this.grab.move?.(dx, dy);
      else this.moveBy(dx, dy);
    }
    this.raf = requestAnimationFrame(this.loop);
  }

  setArrows(v) {
    const want = { ArrowUp: v.y < -0.4, ArrowDown: v.y > 0.4, ArrowLeft: v.x < -0.4, ArrowRight: v.x > 0.4 };
    this.arrows ??= {};
    for (const [code, on] of Object.entries(want)) {
      if (!!this.arrows[code] !== on) { this.arrows[code] = on; this.key(code, code, on); }
    }
  }

  pollGamepad() {
    const gp = navigator.getGamepads?.()?.find((g) => g && g.connected);
    if (!gp) return;
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    if (Math.hypot(ax, ay) > 0.15) this.vec = { x: ax, y: ay };
    else if (this._gpStick) this.vec = { x: 0, y: 0 };
    this._gpStick = Math.hypot(ax, ay) > 0.15;
    const b0 = gp.buttons[0]?.pressed, b1 = gp.buttons[1]?.pressed;
    if (b0 !== this._gp0) { this._gp0 = b0; this.mode === "keys" ? this.key("Space", " ", b0) : b0 ? this.press(0) : this.releaseBtn(0); }
    if (b1 !== this._gp1) { this._gp1 = b1; this.mode === "keys" ? this.key("KeyX", "x", b1) : b1 ? this.press(2) : this.releaseBtn(2); }
  }

  screenRect() { return this.shell.screen.getBoundingClientRect(); }
  clampCursor() {
    const r = this.screenRect();
    this.x = clamp(this.x, r.left, r.right - 2);
    this.y = clamp(this.y, r.top, r.bottom - 2);
  }
  placeCursor() { this.cursor.style.transform = `translate(${this.x}px, ${this.y}px)`; }

  moveBy(dx, dy) {
    this.cursor.classList.remove("real");
    this.x += dx; this.y += dy;
    this.clampCursor();
    this.placeCursor();
    this.dispatchPointer("pointermove", "mousemove", this.buttons ? 0 : -1);
    this.hover();
  }

  target() {
    // skip our own overlay controls that may float above the PC screen
    const els = document.elementsFromPoint(this.x, this.y);
    return els.find((e) => !e.closest(".vcontrols, .vtoolbar, .vkbd, .vcursor, .vrelease")) || document.body;
  }

  hover() {
    const t = this.target();
    const c = t.closest?.("button, .dicon, .ctx-item, .fx-item, a, .tb-btn, .sm-app, .sm-file");
    if (c !== this.hoverEl) { this.hoverEl?.classList.remove("vhover"); c?.classList.add("vhover"); this.hoverEl = c; }
  }

  evInit(button = 0) {
    return { bubbles: true, cancelable: true, composed: true, view: window, clientX: this.x, clientY: this.y, screenX: this.x, screenY: this.y, button: Math.max(0, button), buttons: this.buttons, ctrlKey: this.mods.has("Control"), shiftKey: this.mods.has("Shift"), altKey: this.mods.has("Alt"), metaKey: this.mods.has("Meta") };
  }

  dispatchPointer(ptype, mtype, button = 0, target = this.target()) {
    if (this.forwardToFrame(target, mtype, button)) return target;
    const init = this.evInit(button);
    target.dispatchEvent(new PointerEvent(ptype, { ...init, pointerId: 77, pointerType: "mouse", isPrimary: true, width: 1, height: 1, pressure: this.buttons ? 0.5 : 0 }));
    if (mtype) target.dispatchEvent(new MouseEvent(mtype, init));
    return target;
  }

  // Events for iframes: same-origin frames (installed web apps / games) get
  // real events dispatched inside their document; others get a postMessage.
  forwardToFrame(t, type, button) {
    if (t?.tagName !== "IFRAME") return false;
    const r = t.getBoundingClientRect();
    const s = r.width / (t.offsetWidth || r.width) || 1;
    const x = (this.x - r.left) / s, y = (this.y - r.top) / s;
    let doc = null;
    try { doc = t.contentDocument; } catch {}
    if (!doc) {
      if (!t.dataset.vinput) return false;
      t.contentWindow?.postMessage({ vpcInput: "mouse", type, x, y, button, buttons: this.buttons }, "*");
      return true;
    }
    const W = t.contentWindow;
    const el = doc.elementFromPoint(x, y) || doc.body || doc.documentElement;
    const init = { ...this.evInit(button), clientX: x, clientY: y, screenX: x, screenY: y, view: W };
    const P = { mousemove: "pointermove", mousedown: "pointerdown", mouseup: "pointerup" }[type];
    if (type === "mousedown") { t.focus(); const f = el.closest?.("input, textarea, select, [contenteditable='true'], [tabindex]"); f?.focus(); }
    if (P) el.dispatchEvent(new W.PointerEvent(P, { ...init, pointerId: 77, pointerType: "mouse", isPrimary: true }));
    if (type === "wheel") el.dispatchEvent(new W.WheelEvent("wheel", { ...init, deltaY: button }));
    else el.dispatchEvent(new W.MouseEvent(type, { ...init, detail: type === "dblclick" ? 2 : 1 }));
    return true;
  }

  press(button) {
    if (this.grab) return this.grab.button?.(button, true);
    const bit = button === 2 ? 2 : 1;
    this.buttons |= bit;
    const t = this.dispatchPointer("pointerdown", "mousedown", button);
    this.downTarget = t;
    if (button === 0 && t.tagName !== "IFRAME") {
      const f = t.closest?.("input, textarea, select, [contenteditable='true'], [tabindex]");
      if (f && f !== document.activeElement) f.focus({ preventScroll: true });
      else if (!f && document.activeElement && document.activeElement !== document.body && !t.closest?.("button")) document.activeElement.blur?.();
      if (t.tagName === "SELECT") t.showPicker?.();
    }
  }

  releaseBtn(button) {
    if (this.grab) return this.grab.button?.(button, false);
    const bit = button === 2 ? 2 : 1;
    if (!(this.buttons & bit)) return;
    this.buttons &= ~bit;
    const t = this.dispatchPointer("pointerup", "mouseup", button);
    const same = this.downTarget && (t === this.downTarget || this.downTarget.contains?.(t) || t.contains?.(this.downTarget));
    if (button === 0 && same && !this.forwardToFrame(t, "click", 0)) {
      if (t.tagName === "INPUT" && ["checkbox", "radio"].includes(t.type)) t.click();
      else t.dispatchEvent(new MouseEvent("click", { ...this.evInit(0), detail: 1 }));
    }
    if (button === 2 && !this.forwardToFrame(t, "contextmenu", 2)) t.dispatchEvent(new MouseEvent("contextmenu", this.evInit(2)));
    this.downTarget = null;
  }

  doubleClick() {
    if (this.grab) { this.grab.button?.(0, true); this.grab.button?.(0, false); this.grab.button?.(0, true); this.grab.button?.(0, false); return; }
    this.press(0); this.releaseBtn(0);
    this.press(0); this.releaseBtn(0);
    const t = this.target();
    if (!this.forwardToFrame(t, "dblclick", 0)) t.dispatchEvent(new MouseEvent("dblclick", { ...this.evInit(0), detail: 2 }));
  }

  scroll(dy) {
    if (this.grab) return this.grab.wheel?.(dy);
    const t = this.target();
    if (this.forwardToFrame(t, "wheel", dy)) return;
    const ev = new WheelEvent("wheel", { ...this.evInit(0), deltaY: dy, deltaMode: 0 });
    if (!t.dispatchEvent(ev)) return;
    let el = t;
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight) { el.scrollBy({ top: dy }); return; }
      el = el.parentElement;
    }
  }

  // ---------------- keyboard ----------------
  activeInst() { return this.shell.procs.get(this.shell.wm.active?.pid)?.inst; }

  key(code, key, down, repeat = false) {
    if (this.grab?.key) return this.grab.key(code, down, key);
    if (this.activeInst()?.virtualKey?.(code, down, key)) return;
    let t = document.activeElement && document.activeElement !== document.body ? document.activeElement : this.shell.wm.active?.body || document.body;
    let KE = KeyboardEvent;
    if (t.tagName === "IFRAME") {
      let doc = null;
      try { doc = t.contentDocument; } catch {}
      if (doc) { KE = t.contentWindow.KeyboardEvent; t = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : doc.body || doc.documentElement; }
      else if (t.dataset.vinput) { t.contentWindow?.postMessage({ vpcInput: "key", type: down ? "keydown" : "keyup", key, code, mods: [...this.mods] }, "*"); return; }
    }
    const init = { key, code, bubbles: true, cancelable: true, composed: true, repeat, ctrlKey: this.mods.has("Control") || key === "Control" && down, shiftKey: this.mods.has("Shift"), altKey: this.mods.has("Alt"), metaKey: this.mods.has("Meta"), keyCode: keyCodeOf(key), which: keyCodeOf(key) };
    const ev = new KE(down ? "keydown" : "keyup", init);
    const ok = t.dispatchEvent(ev);
    if (!down || !ok) return;
    this.editText(t, key);
  }

  // Synthetic key events do not edit text fields, so apply the edit ourselves.
  editText(t, key) {
    const ctrl = this.mods.has("Control"), alt = this.mods.has("Alt"), meta = this.mods.has("Meta");
    const isField = t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && /^(text|search|url|email|password|number|tel|)$/.test(t.type));
    const editable = t.isContentEditable;
    if (!isField && !editable) return;
    if (ctrl) {
      const k = key.toLowerCase();
      if (k === "a") { if (isField) t.select(); else document.execCommand("selectAll"); }
      if (k === "c" || k === "x") {
        const text = isField ? t.value.slice(t.selectionStart, t.selectionEnd) : String(getSelection());
        this.clip = text; navigator.clipboard?.writeText(text).catch(() => {});
        if (k === "x" && isField) this.insert(t, "");
        if (k === "x" && editable) document.execCommand("delete");
      }
      if (k === "v") {
        const paste = (text) => (isField ? this.insert(t, text) : document.execCommand("insertText", false, text));
        (navigator.clipboard?.readText?.() || Promise.reject()).then(paste, () => paste(this.clip || ""));
      }
      if (k === "z") document.execCommand("undo");
      return;
    }
    if (alt || meta) return;
    if (editable) {
      if (key.length === 1) document.execCommand("insertText", false, key);
      else if (key === "Enter") document.execCommand("insertParagraph");
      else if (key === "Backspace") document.execCommand("delete");
      else if (key === "Delete") document.execCommand("forwardDelete");
      return;
    }
    const s = t.selectionStart ?? t.value.length, e = t.selectionEnd ?? s;
    const shift = this.mods.has("Shift");
    if (key.length === 1) this.insert(t, key);
    else if (key === "Backspace") { if (s !== e) this.insert(t, ""); else if (s > 0) { t.setSelectionRange(s - 1, s); this.insert(t, ""); } }
    else if (key === "Delete") { if (s !== e) this.insert(t, ""); else { t.setSelectionRange(s, s + 1); this.insert(t, ""); } }
    else if (key === "Enter") { if (t.tagName === "TEXTAREA") this.insert(t, "\n"); else t.form?.requestSubmit?.(); }
    else if (key === "Tab" && t.tagName === "TEXTAREA") this.insert(t, "  ");
    else if (key === "ArrowLeft") { const p = Math.max(0, (s === e || shift ? s : s + 1) - 1); t.setSelectionRange(shift ? p : p, shift ? e : p); }
    else if (key === "ArrowRight") { const p = Math.min(t.value.length, (s === e || shift ? e : e - 1) + 1); t.setSelectionRange(shift ? s : p, p); }
    else if (key === "ArrowUp" || key === "ArrowDown") {
      if (t.tagName !== "TEXTAREA") return;
      const v = t.value, lineStart = v.lastIndexOf("\n", s - 1) + 1, col = s - lineStart;
      let p;
      if (key === "ArrowUp") { const prevEnd = lineStart - 1; if (prevEnd < 0) p = 0; else { const prevStart = v.lastIndexOf("\n", prevEnd - 1) + 1; p = Math.min(prevStart + col, prevEnd); } }
      else { const next = v.indexOf("\n", s); if (next < 0) p = v.length; else { const nextEnd = v.indexOf("\n", next + 1); p = Math.min(next + 1 + col, nextEnd < 0 ? v.length : nextEnd); } }
      t.setSelectionRange(p, p);
    } else if (key === "Home") t.setSelectionRange(0, 0);
    else if (key === "End") t.setSelectionRange(t.value.length, t.value.length);
  }

  insert(t, text) {
    t.setRangeText(text, t.selectionStart, t.selectionEnd, "end");
    t.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: text ? "insertText" : "deleteContentBackward", data: text }));
  }

  combo(keys) {
    const mods = keys.filter((k) => MOD[k]);
    const main = keys.find((k) => !MOD[k]);
    if (this.grab?.combo) return this.grab.combo(keys);
    if (this.activeInst()?.virtualCombo?.(keys)) return;
    for (const m of mods) { this.mods.add(m); this.key(CODE_OF[m], m, true); }
    const code = CODE_OF[main] || (main.length === 1 ? "Key" + main.toUpperCase() : main);
    this.key(code, main, true);
    this.key(code, main, false);
    for (const m of mods.reverse()) { this.mods.delete(m); this.key(CODE_OF[m], m, false); }
    this.refreshKeys();
  }

  // ---------------- raw grab (VM) ----------------
  setGrab(handler) {
    this.grab = handler;
    this.release.classList.toggle("hidden", !handler);
    this.cursor.classList.toggle("grabbed", !!handler);
  }
  releaseGrab() {
    const g = this.grab;
    this.setGrab(null);
    g?.release?.();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("pointermove", this.onRealMove, true);
    document.removeEventListener("fullscreenchange", this.onFs);
    this.shell.wm.off("change", this.onWinFocus);
    [this.controls, this.cursor, this.release, this.toolbar, this.kbd].forEach((e) => e.remove());
  }
}

function keyCodeOf(key) {
  if (key.length === 1) return key.toUpperCase().charCodeAt(0);
  return { Enter: 13, Backspace: 8, Tab: 9, Escape: 27, " ": 32, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Delete: 46, Shift: 16, Control: 17, Alt: 18, Meta: 91 }[key] || 0;
}
