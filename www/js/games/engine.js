// Tiny game runtime shared by the bundled games: canvas sizing, fixed loop,
// input state (keyboard from physical or virtual keys), sound with master
// volume, quality level derived from the PC's virtual GPU, high scores.

import { h } from "../core/util.js";
import { gpuOf } from "../core/pcs.js";
import { bus } from "../core/bus.js";

export function createGame({ win, shell, app, pid }, { width = 960, height = 600, bg = "#05060d" } = {}) {
  const canvas = h("canvas", { class: "game-canvas", tabindex: 0 });
  const hud = h("div", { class: "game-hud" });
  const box = h("div", { class: "game", style: { background: bg } }, canvas, hud);
  win.body.append(box);
  const ctx = canvas.getContext("2d");
  const keys = new Set();
  const pressed = new Set();
  const quality = gpuOf(shell.pc).tier; // 1..3
  const active = () => shell.wm.active === win && win.state !== "min";
  let W = width, H = height, scale = 1;

  function resize() {
    const r = box.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const s = shell.scale || 1;
    const bw = r.width / s, bh = r.height / s;
    scale = Math.min(bw / width, bh / height);
    W = width; H = height;
    const dpr = Math.min(2, devicePixelRatio * s);
    canvas.width = Math.round(width * scale * dpr);
    canvas.height = Math.round(height * scale * dpr);
    canvas.style.width = width * scale + "px";
    canvas.style.height = height * scale + "px";
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(box);
  win.on("resize", resize);

  const kd = (e) => { if (!active()) return; if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault(); if (!keys.has(e.code)) pressed.add(e.code); keys.add(e.code); };
  const ku = (e) => keys.delete(e.code);
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);

  // audio with the PC master volume
  let actx = null, master = null;
  const audio = () => {
    if (!actx) { actx = new AudioContext(); master = actx.createGain(); master.connect(actx.destination); master.gain.value = shell.volume() * 0.5; }
    return actx;
  };
  const offVol = bus.on("volume", (v) => master && (master.gain.value = v * 0.5));
  function beep(freq = 440, dur = 0.1, type = "square", vol = 0.3, slide = 0) {
    try {
      const a = audio();
      if (a.state === "suspended") a.resume();
      const o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.value = freq;
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), a.currentTime + dur);
      g.gain.setValueAtTime(vol, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
      o.connect(g).connect(master);
      o.start(); o.stop(a.currentTime + dur);
    } catch {}
  }

  const hsKey = `vpc:${shell.pc.id}:${app.icon}`;
  const best = () => +(localStorage.getItem(hsKey) || 0);
  const saveBest = (v) => { if (v > best()) { try { localStorage.setItem(hsKey, String(v)); } catch {} return true; } return false; };

  let raf, last = performance.now(), running = true, frames = 0, fps = 0, fpsT = last;
  function start(update, render) {
    resize();
    const loop = (t) => {
      if (!running) return;
      let dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      frames++;
      if (t - fpsT > 1000) { fps = frames; frames = 0; fpsT = t; }
      if (active()) update(dt);
      pressed.clear();
      render(ctx, W, H);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }
  canvas.addEventListener("pointerdown", () => { canvas.focus(); audio(); });

  return {
    canvas, ctx, hud, keys, pressed, quality, beep, best, saveBest, start, active,
    get fps() { return fps; },
    toLocal(e) { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * width, ((e.clientY - r.top) / r.height) * height]; },
    destroy() { running = false; cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); offVol(); actx?.close(); },
  };
}
