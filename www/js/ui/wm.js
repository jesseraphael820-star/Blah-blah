// Window manager: movable, resizable, minimisable, maximisable windows with
// z-ordering and snapping. Works with real touch/mouse and with the synthetic
// pointer events produced by the on-screen virtual mouse.

import { h, clamp } from "../core/util.js";
import { ui, appIcon } from "./icons.js";
import { Emitter } from "../core/bus.js";

let zTop = 10;
let nextId = 1;

export class WindowManager extends Emitter {
  constructor(shell, layer) {
    super();
    this.shell = shell;
    this.layer = layer;
    this.windows = [];
    this.active = null;
  }
  get bounds() {
    const r = this.shell.screenSize();
    return { w: r.w, h: r.h - this.shell.taskbarHeight };
  }
  create(opts) {
    const w = new Win(this, opts);
    this.windows.push(w);
    this.layer.append(w.el);
    w.focus();
    this.emit("change");
    return w;
  }
  remove(w) {
    this.windows = this.windows.filter((x) => x !== w);
    if (this.active === w) {
      this.active = null;
      const next = [...this.windows].filter((x) => x.state !== "min").sort((a, b) => b.z - a.z)[0];
      next?.focus();
    }
    this.emit("change");
  }
  focusNext() {
    const list = [...this.windows].sort((a, b) => a.z - b.z);
    if (!list.length) return;
    const w = list[0];
    if (w.state === "min") w.restore(); else w.focus();
  }
  minimizeAll() { this.windows.forEach((w) => w.minimize()); }
  fitAll() { this.windows.forEach((w) => w.fit()); }
}

class Win extends Emitter {
  constructor(wm, o) {
    super();
    this.wm = wm;
    this.id = nextId++;
    this.appId = o.appId;
    this.pid = o.pid;
    this.title = o.title || "Janela";
    this.iconId = o.icon || o.appId;
    this.resizable = o.resizable !== false;
    this.minW = o.minW || 280;
    this.minH = o.minH || 180;
    this.state = "normal";
    this.closeHandlers = [];
    const b = wm.bounds;
    const w = Math.min(o.width || 760, b.w - 16), hh = Math.min(o.height || 500, b.h - 16);
    const cascade = (wm.windows.length % 6) * 28;
    this.rect = { x: o.x ?? Math.max(8, (b.w - w) / 2 - 60 + cascade), y: o.y ?? Math.max(8, (b.h - hh) / 2 - 40 + cascade), w, h: hh };
    this.build();
    this.apply();
    if (o.maximized || b.w < 720) this.maximize(true, false);
  }

  build() {
    this.titleEl = h("span", { class: "win-title" }, this.title);
    const btn = (cls, icon, fn, title) => h("button", { class: "win-btn " + cls, title, html: ui(icon, 14, 1.6), onpointerdown: (e) => e.stopPropagation(), onclick: (e) => { e.stopPropagation(); fn(); } });
    this.maxBtn = btn("max", "max", () => this.maximize(), "Maximizar");
    this.bar = h("div", { class: "win-bar" },
      h("span", { class: "win-icon", html: appIcon(this.iconId, 18) }),
      this.titleEl,
      h("div", { class: "win-actions" },
        btn("min", "min", () => this.minimize(), "Minimizar"),
        this.resizable ? this.maxBtn : null,
        btn("close", "x", () => this.close(), "Fechar")));
    this.body = h("div", { class: "win-body" });
    this.el = h("div", { class: "win opening", dataset: { app: this.appId || "" } }, this.bar, this.body);
    setTimeout(() => this.el.classList.remove("opening"), 260);
    if (this.resizable) for (const d of ["n", "s", "e", "w", "ne", "nw", "se", "sw"]) this.el.append(h("div", { class: "rz rz-" + d, dataset: { dir: d } }));

    this.el.addEventListener("pointerdown", () => this.focus(), true);
    this.bar.addEventListener("pointerdown", (e) => this.startDrag(e));
    this.bar.addEventListener("dblclick", () => this.resizable && this.maximize());
    this.el.querySelectorAll(".rz").forEach((r) => r.addEventListener("pointerdown", (e) => this.startResize(e, r.dataset.dir)));
  }

  apply() {
    const { x, y, w, h: hh } = this.rect;
    Object.assign(this.el.style, { left: x + "px", top: y + "px", width: w + "px", height: hh + "px" });
  }

  fit() {
    const b = this.wm.bounds;
    if (this.state === "max") return this.applyMax();
    if (b.w < 720 && this.resizable && this.state === "normal") return this.maximize(true, false);
    this.rect.w = Math.min(this.rect.w, b.w);
    this.rect.h = Math.min(this.rect.h, b.h);
    this.rect.x = clamp(this.rect.x, -this.rect.w + 80, b.w - 80);
    this.rect.y = clamp(this.rect.y, 0, b.h - 36);
    this.apply();
    this.emit("resize");
  }

  drag(e, onMove, onEnd) {
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    const s = this.wm.shell.scale;
    const sx = e.clientX, sy = e.clientY;
    const move = (ev) => onMove((ev.clientX - sx) / s, (ev.clientY - sy) / s, ev);
    const up = (ev) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      this.el.classList.remove("dragging");
      onEnd?.(ev);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    this.el.classList.add("dragging");
  }

  startDrag(e) {
    if (e.target.closest(".win-actions")) return;
    let r0 = { ...this.rect };
    let wasMax = this.state === "max";
    const snapHint = this.wm.shell.snapHint;
    this.drag(e, (dx, dy, ev) => {
      if (wasMax && Math.hypot(dx, dy) > 6) {
        // un-maximise under the finger, keeping the grab point proportional
        const b = this.wm.bounds;
        this.state = "normal";
        this.el.classList.remove("max");
        this.maxBtn.innerHTML = ui("max", 14, 1.6);
        const px = ((e.clientX - this.wm.shell.screenRect().left) / this.wm.shell.scale) / b.w;
        r0 = { ...this.normalRect, x: (e.clientX - this.wm.shell.screenRect().left) / this.wm.shell.scale - px * this.normalRect.w, y: 0 };
        wasMax = false;
        this.emit("resize");
      }
      if (wasMax) return;
      this.rect.x = r0.x + dx;
      this.rect.y = Math.max(0, r0.y + dy);
      this.apply();
      const top = (ev.clientY - this.wm.shell.screenRect().top) / this.wm.shell.scale;
      snapHint.classList.toggle("on", top < 6 && this.resizable);
    }, (ev) => {
      snapHint.classList.remove("on");
      const top = (ev.clientY - this.wm.shell.screenRect().top) / this.wm.shell.scale;
      if (top < 6 && this.resizable && this.state !== "max") { this.rect = r0.w ? { ...this.rect, ...{ x: this.rect.x, y: 0 } } : this.rect; this.maximize(true); }
      else this.fit();
    });
  }

  startResize(e, dir) {
    e.stopPropagation();
    if (this.state === "max") return;
    const r0 = { ...this.rect };
    this.drag(e, (dx, dy) => {
      const r = { ...r0 };
      if (dir.includes("e")) r.w = Math.max(this.minW, r0.w + dx);
      if (dir.includes("s")) r.h = Math.max(this.minH, r0.h + dy);
      if (dir.includes("w")) { r.w = Math.max(this.minW, r0.w - dx); r.x = r0.x + r0.w - r.w; }
      if (dir.includes("n")) { r.h = Math.max(this.minH, r0.h - dy); r.y = Math.max(0, r0.y + r0.h - r.h); }
      this.rect = r;
      this.apply();
      this.emit("resize");
    });
  }

  setTitle(t) { this.title = t; this.titleEl.textContent = t; this.wm.emit("change"); }

  focus() {
    if (this.wm.active === this && this.z === zTop) return;
    this.z = ++zTop;
    this.el.style.zIndex = this.z;
    this.wm.windows.forEach((w) => w.el.classList.toggle("active", w === this));
    this.wm.active = this;
    this.wm.emit("change");
    this.emit("focus");
  }

  minimize() {
    if (this.state === "min") return;
    this.prevState = this.state;
    this.state = "min";
    this.el.classList.add("minimized");
    if (this.wm.active === this) {
      this.wm.active = null;
      this.el.classList.remove("active");
      const next = this.wm.windows.filter((x) => x.state !== "min").sort((a, b) => b.z - a.z)[0];
      next?.focus();
    }
    this.wm.emit("change");
  }
  restore() {
    if (this.state === "min") { this.state = this.prevState || "normal"; this.el.classList.remove("minimized"); }
    this.focus();
    this.wm.emit("change");
  }
  toggleFromTaskbar() {
    if (this.state === "min") this.restore();
    else if (this.wm.active === this) this.minimize();
    else this.focus();
  }
  applyMax() {
    const b = this.wm.bounds;
    Object.assign(this.el.style, { left: "0px", top: "0px", width: b.w + "px", height: b.h + "px" });
  }
  maximize(force, animate = true) {
    const toMax = force ?? this.state !== "max";
    if (toMax) {
      if (this.state !== "max") this.normalRect = { ...this.rect };
      this.state = "max";
      this.el.classList.add("max");
      this.applyMax();
      this.maxBtn.innerHTML = ui("restoreWin", 14, 1.6);
    } else {
      this.state = "normal";
      this.el.classList.remove("max");
      this.rect = this.normalRect || this.rect;
      this.apply();
      this.maxBtn.innerHTML = ui("max", 14, 1.6);
    }
    if (!animate) this.el.classList.add("no-anim"), setTimeout(() => this.el.classList.remove("no-anim"), 50);
    setTimeout(() => this.emit("resize"), 200);
    this.wm.emit("change");
  }

  onClose(fn) { this.closeHandlers.push(fn); }
  async close(force = false) {
    if (!force) for (const fn of this.closeHandlers) if ((await fn()) === false) return false;
    this.emit("close");
    this.el.classList.add("closing");
    setTimeout(() => this.el.remove(), 180);
    this.wm.remove(this);
    return true;
  }
}
