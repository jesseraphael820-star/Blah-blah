// Minimal event emitter used for app-wide signals (fs changes, settings, power...).
export class Emitter {
  constructor() { this.map = new Map(); }
  on(ev, fn) {
    if (!this.map.has(ev)) this.map.set(ev, new Set());
    this.map.get(ev).add(fn);
    return () => this.off(ev, fn);
  }
  off(ev, fn) { this.map.get(ev)?.delete(fn); }
  emit(ev, ...args) {
    for (const fn of [...(this.map.get(ev) || [])]) {
      try { fn(...args); } catch (e) { console.error(`[bus] ${ev}`, e); }
    }
  }
}
export const bus = new Emitter();
