// Real runtime metrics measured on the device: frame rate, main-thread load
// (event-loop busy time), JS heap, storage and battery. Values that the web
// platform cannot provide are reported as null (never invented).

import { Emitter } from "./bus.js";

class Metrics extends Emitter {
  constructor() {
    super();
    this.fps = 0;
    this.cpu = 0; // % of main-thread time spent busy (long frames / lag)
    this.history = { fps: [], cpu: [], heap: [], vram: [] };
    this.battery = null;
    this.running = false;
  }
  start() {
    if (this.running) return;
    this.running = true;
    let frames = 0, last = performance.now(), busy = 0, lastFrame = last;
    const loop = (t) => {
      if (!this.running) return;
      frames++;
      const dt = t - lastFrame;
      busy += Math.max(0, dt - 16.7);
      lastFrame = t;
      if (t - last >= 1000) {
        const span = t - last;
        this.fps = Math.round((frames * 1000) / span);
        // fraction of the second lost to frames longer than one vsync, plus a floor for work done in-frame
        this.cpu = Math.min(100, Math.round((busy / span) * 100 + (this.fps > 0 ? (60 - Math.min(60, this.fps)) * 0.4 : 0)));
        frames = 0; busy = 0; last = t;
        this.sample();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    // event-loop lag probe catches work that happens while rAF is throttled
    let expected = performance.now() + 250;
    this.lagTimer = setInterval(() => {
      const now = performance.now();
      const lag = Math.max(0, now - expected);
      expected = now + 250;
      if (lag > 50) this.cpu = Math.min(100, Math.max(this.cpu, Math.round((lag / 250) * 100)));
    }, 250);
    navigator.getBattery?.().then((b) => {
      const upd = () => { this.battery = { level: b.level, charging: b.charging }; this.emit("battery", this.battery); };
      b.addEventListener("levelchange", upd);
      b.addEventListener("chargingchange", upd);
      upd();
    }).catch(() => {});
    // Android APK: real temperature / RAM from the native plugin
    const nat = window.Capacitor?.Plugins?.DeviceSensors;
    if (nat) {
      const poll = () => nat.getStatus().then((st) => { this.native = st; if (st.batteryLevel != null && !this.battery) this.battery = { level: st.batteryLevel, charging: false }; this.emit("native", st); }).catch(() => {});
      poll();
      this.nativeTimer = setInterval(poll, 5000);
    }
  }
  stop() { this.running = false; clearInterval(this.lagTimer); clearInterval(this.nativeTimer); }
  heap() {
    const m = performance.memory;
    return m ? { used: m.usedJSHeapSize, total: m.totalJSHeapSize, limit: m.jsHeapSizeLimit } : null;
  }
  sample() {
    const push = (k, v) => { const a = this.history[k]; a.push(v); if (a.length > 60) a.shift(); };
    push("fps", this.fps);
    push("cpu", this.cpu);
    push("heap", this.heap()?.used || 0);
    this.emit("tick", this);
  }
  // not exposed to web pages; the Android APK reads the battery temperature natively
  temperature() { return this.native?.batteryTempC ?? null; }
  realMemory() { return this.native?.totalMem ? { total: this.native.totalMem, avail: this.native.availMem } : null; }
}

export const metrics = new Metrics();
