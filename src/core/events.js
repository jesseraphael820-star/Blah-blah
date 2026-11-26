// Barramento de eventos simples para desacoplar sistemas.
const handlers = new Map();
export function on(ev, fn) { if (!handlers.has(ev)) handlers.set(ev, new Set()); handlers.get(ev).add(fn); return () => handlers.get(ev).delete(fn); }
export function emit(ev, ...args) { const h = handlers.get(ev); if (h) for (const fn of [...h]) fn(...args); }
