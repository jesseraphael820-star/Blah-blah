// Animais procedurais (vista lateral com espelhamento) e cavalos com 4 direções.
import { PixelPainter, darken, lighten } from './canvas.js';
import { cached } from './objects.js';

export const ANIMAL_DEFS = {
  deer: { w: 26, h: 24, body: [12, 6], leg: 7, head: 4, neck: 5, col: '#a8743e', belly: '#e0c8a0', tail: 'short', ears: 2, antlers: true, spots: false },
  rabbit: { w: 12, h: 10, body: [5, 3], leg: 1, head: 3, neck: 0, col: '#9a8270', belly: '#e8dccc', tail: 'puff', ears: 4 },
  snowrabbit: { w: 12, h: 10, body: [5, 3], leg: 1, head: 3, neck: 0, col: '#e8eef2', belly: '#ffffff', tail: 'puff', ears: 4 },
  fox: { w: 20, h: 14, body: [8, 3], leg: 3, head: 3, neck: 1, col: '#d06a2a', belly: '#f4e8d8', tail: 'bushy', ears: 2, snout: 2 },
  wolf: { w: 24, h: 18, body: [10, 4], leg: 5, head: 4, neck: 2, col: '#6e6a66', belly: '#b8b0a8', tail: 'bushy', ears: 2, snout: 3 },
  frostwolf: { w: 24, h: 18, body: [10, 4], leg: 5, head: 4, neck: 2, col: '#c8d4dc', belly: '#f0f4f8', tail: 'bushy', ears: 2, snout: 3 },
  bear: { w: 30, h: 22, body: [13, 7], leg: 5, head: 5, neck: 1, col: '#5a3e26', belly: '#7a5a3a', tail: 'none', ears: 1, snout: 2, bulky: true },
  whitebear: { w: 34, h: 26, body: [15, 8], leg: 6, head: 6, neck: 1, col: '#e8e4dc', belly: '#ffffff', tail: 'none', ears: 1, snout: 2, bulky: true },
  boar: { w: 22, h: 16, body: [10, 5], leg: 3, head: 4, neck: 0, col: '#4a3a30', belly: '#6a5444', tail: 'thin', ears: 1, snout: 2, tusks: true, bulky: true },
  cow: { w: 28, h: 22, body: [13, 7], leg: 6, head: 5, neck: 1, col: '#f0ece4', belly: '#f8f4ec', tail: 'thin', ears: 1, spots: '#3a2a22', horns: true, bulky: true },
  sheep: { w: 20, h: 16, body: [9, 5], leg: 4, head: 3, neck: 1, col: '#f0ece0', belly: '#e8e0d0', tail: 'puff', ears: 1, wool: true, headCol: '#3a302a' },
  chicken: { w: 10, h: 11, body: [4, 3], leg: 2, head: 2, neck: 2, col: '#f4f0e8', belly: '#ffffff', tail: 'feather', ears: 0, beak: true, comb: true },
  dog: { w: 18, h: 14, body: [7, 3], leg: 4, head: 3, neck: 1, col: '#b07a44', belly: '#e8d0a8', tail: 'up', ears: 2, snout: 2 },
  cat: { w: 14, h: 11, body: [6, 2], leg: 3, head: 3, neck: 0, col: '#4a4048', belly: '#8a8088', tail: 'up', ears: 2 },
  goat: { w: 20, h: 18, body: [8, 4], leg: 5, head: 3, neck: 2, col: '#c8bca8', belly: '#e8e0d0', tail: 'short', ears: 1, horns: true },
  crocodile: { w: 34, h: 10, body: [15, 2], leg: 2, head: 6, neck: 0, col: '#4a5a2a', belly: '#8a9a5a', tail: 'long', ears: 0, snout: 6 },
};

function drawQuad(D, frame, kind) {
  const p = new PixelPainter(D.w, D.h);
  const col = D.col, colD = darken(col, 0.28), colL = lighten(col, 0.15), belly = D.belly;
  const ground = D.h - 1;
  const bw = D.body[0], bh = D.body[1];
  const bx = Math.floor(D.w / 2 - bw / 2) - 1, by = ground - D.leg - bh;
  let phase = 0, headDown = 0, lunge = 0, dead = false;
  if (frame.startsWith('walk')) phase = Number(frame.slice(4));
  if (frame === 'eat') headDown = 3;
  if (frame === 'attack') lunge = 2;
  if (frame === 'dead') dead = true;
  const bob = frame === 'idle1' ? 1 : phase % 2 ? -1 : 0;
  if (dead) {
    p.ellipse(D.w / 2, ground - bh / 2 - 1, bw / 2 + 1, bh / 2 + 1, col);
    p.ellipse(D.w / 2, ground - 1, bw / 2, 1, colD);
    for (let i = 0; i < 4; i++) p.hline(D.w / 2 - bw / 2 + i * 3, ground - bh - 1, 2, colD);
    p.outline('#1c1520');
    return p.done();
  }
  // pernas (4, alternando)
  const legsX = [bx + 1, bx + 3, bx + bw - 4, bx + bw - 2];
  const offs = [[0, 0, 0, 0], [1, -1, -1, 1], [0, 0, 0, 0], [-1, 1, 1, -1]][phase] || [0, 0, 0, 0];
  legsX.forEach((lx, i) => {
    const far = i % 2 === 1;
    const lc = far ? colD : col;
    const lw = D.bulky ? 2 : 1;
    for (let y = 0; y < D.leg; y++) p.rect(lx + Math.round((offs[i] * y) / D.leg) + lunge, by + bh + y + bob * 0, lw, 1, lc);
    p.rect(lx + offs[i] + lunge, ground, lw, 1, D.hoof || darken(col, 0.5));
  });
  // corpo
  const bodyY = by + bob;
  p.ellipse(bx + bw / 2 + lunge, bodyY + bh / 2, bw / 2, bh / 2 + (D.bulky ? 1 : 0), col);
  p.ellipse(bx + bw / 2 + lunge, bodyY + bh / 2 + 1, bw / 2 - 2, Math.max(1, bh / 2 - 1), belly);
  p.ellipse(bx + bw / 2 + lunge, bodyY + bh / 2 - 1, bw / 2 - 1, Math.max(1, bh / 2 - 1), col);
  p.hline(bx + 2 + lunge, bodyY, bw - 4, colL);
  if (D.spots) for (let i = 0; i < 5; i++) p.ellipse(bx + 2 + i * 3 + lunge, bodyY + 1 + (i % 2) * 2, 1, 1, D.spots);
  if (D.wool) for (let i = 0; i < 10; i++) p.circle(bx + 1 + (i * 3) % bw + lunge, bodyY + (i % 3), 1, lighten(col, 0.1));
  // cauda
  const tx = bx + lunge, ty = bodyY + 1;
  if (D.tail === 'bushy') { for (let i = 0; i < 5; i++) p.rect(tx - 1 - i, ty + i * 0.5, 2, 2, i > 3 ? '#f4f0ec' : col); }
  else if (D.tail === 'puff') p.circle(tx, ty, 1, '#ffffff');
  else if (D.tail === 'thin') p.line(tx, ty, tx - 2, ty + 4, colD);
  else if (D.tail === 'up') p.line(tx, ty, tx - 2, ty - 3 + (phase % 2), col);
  else if (D.tail === 'short') p.rect(tx - 1, ty, 2, 2, lighten(col, 0.4));
  else if (D.tail === 'feather') { p.line(tx, ty, tx - 2, ty - 3, col); p.line(tx + 1, ty, tx - 1, ty - 3, colD); }
  else if (D.tail === 'long') p.line(tx, ty + 1, tx - 7, ty + 2, col);
  // pescoço e cabeça
  const nx = bx + bw - 1 + lunge, ny = bodyY + 1;
  const hx = nx + Math.max(1, D.neck - 1), hy = ny - D.neck + headDown + (D.neck === 0 ? 1 : 0);
  if (D.neck) p.line(nx, ny + 1, hx, hy + 1, col), p.line(nx - 1, ny + 1, hx - 1, hy + 2, col);
  const hc = D.headCol || col;
  p.rect(hx - 1, hy - 1, D.head, D.head - 1, hc);
  if (D.snout) p.rect(hx + D.head - 1, hy + Math.floor(D.head / 2) - 1, D.snout, Math.max(1, Math.floor(D.head / 2)), darken(hc, 0.05));
  if (D.snout) p.set(hx + D.head - 2 + D.snout, hy + Math.floor(D.head / 2) - 1, '#1a1418');
  p.set(hx + D.head - 2, hy, '#100c10');
  if (D.ears === 4) { p.vline(hx, hy - 4, 3, hc); p.vline(hx + 1, hy - 4, 3, lighten(hc, 0.2)); }
  else if (D.ears === 2) { p.set(hx, hy - 2, hc); p.set(hx + 1, hy - 2, colD); }
  else if (D.ears === 1) p.set(hx - 1, hy - 1, colD);
  if (D.antlers && kind === 'deer') { p.line(hx, hy - 1, hx - 2, hy - 6, '#c8b890'); p.line(hx - 1, hy - 4, hx + 1, hy - 7, '#c8b890'); p.line(hx + 1, hy - 1, hx + 3, hy - 5, '#b8a880'); }
  if (D.horns) { p.set(hx, hy - 2, '#e8e0c8'); p.set(hx - 1, hy - 3, '#e8e0c8'); }
  if (D.tusks) p.set(hx + D.head + D.snout - 2, hy + D.head - 2, '#f0f0e0');
  if (D.beak) { p.set(hx + D.head - 1, hy, '#e0a030'); p.set(hx + D.head, hy, '#e0a030'); }
  if (D.comb) { p.set(hx, hy - 2, '#d03030'); p.set(hx + 1, hy - 2, '#d03030'); p.set(hx + 1, hy + 1, '#d03030'); }
  if (kind === 'fox' || kind === 'wolf' || kind === 'frostwolf') p.set(hx + D.head + (D.snout || 0) - 3, hy + D.head - 2, belly);
  p.outline('#1c1520');
  return p.done();
}

export function animalFrames(kind) {
  return cached('animal:' + kind, () => {
    const D = ANIMAL_DEFS[kind];
    const f = {};
    for (const n of ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'eat', 'attack', 'dead']) f[n] = drawQuad(D, n, kind);
    f.w = D.w; f.h = D.h;
    return f;
  });
}

// pássaros: voo (2 quadros) e pousado
export function birdFrames(col = '#4a3a30') {
  return cached('bird:' + col, () => {
    const mk = (wing) => {
      const p = new PixelPainter(10, 8);
      p.ellipse(5, 4, 2, 1, col); p.set(8, 3, col); p.set(9, 3, '#e0a030');
      if (wing === 0) { p.line(3, 3, 1, 0, col); p.line(6, 3, 7, 0, col); }
      else if (wing === 1) { p.line(3, 4, 0, 6, col); p.line(6, 4, 8, 7, col); }
      else { p.set(4, 6, '#5a4a30'); p.set(6, 6, '#5a4a30'); p.set(3, 4, darken(col, 0.3)); }
      p.outline('#1c1520');
      return p.done();
    };
    return { fly0: mk(0), fly1: mk(1), sit: mk(2) };
  });
}
export function fishFrame(col = '#8aa0b0') {
  return cached('fish:' + col, () => {
    const p = new PixelPainter(12, 7);
    p.ellipse(5, 3, 4, 2, col); p.set(9, 2, col); p.set(10, 1, col); p.set(10, 5, col); p.set(9, 4, col); p.set(3, 2, '#101010'); p.hline(2, 4, 6, lighten(col, 0.4));
    p.outline('#1c1520');
    return p.done();
  });
}
export function batFrames() {
  return cached('bat', () => {
    const mk = (w) => { const p = new PixelPainter(14, 8); p.ellipse(7, 4, 2, 2, '#3a2a3a'); if (w) { p.line(5, 4, 0, 1, '#3a2a3a'); p.line(9, 4, 13, 1, '#3a2a3a'); } else { p.line(5, 4, 1, 7, '#3a2a3a'); p.line(9, 4, 12, 7, '#3a2a3a'); } p.set(6, 3, '#ff4040'); p.set(8, 3, '#ff4040'); p.outline('#120a12'); return p.done(); };
    return { fly0: mk(1), fly1: mk(0) };
  });
}
export function spiderFrames() {
  return cached('spider', () => {
    const mk = (ph) => { const p = new PixelPainter(16, 12); p.ellipse(8, 6, 4, 3, '#2a2228'); p.circle(8, 3, 2, '#3a3038'); for (let i = 0; i < 4; i++) { const o = (i + ph) % 2; p.line(5, 5 + i, 1, 3 + i * 2 + o, '#2a2228'); p.line(11, 5 + i, 15, 3 + i * 2 - o, '#2a2228'); } p.set(7, 2, '#ff3030'); p.set(9, 2, '#ff3030'); p.outline('#0a060a'); return p.done(); };
    return { walk0: mk(0), walk1: mk(1) };
  });
}

// ---------- Cavalos ----------
export const HORSE_COATS = {
  brown: { body: '#7a4a2a', mane: '#2a1a12', sock: false }, black: { body: '#2a2428', mane: '#121014', sock: true },
  white: { body: '#e8e4dc', mane: '#c8c0b8', sock: false }, chestnut: { body: '#a0522a', mane: '#6a2a14', sock: true },
  grey: { body: '#8a8a8e', mane: '#3a3a3e', dapple: true }, palomino: { body: '#d8b060', mane: '#f4ecd8', sock: false },
  nevoa: { body: '#f4f6fa', mane: '#b8d4f0', sock: false, glow: true }, bay: { body: '#6a3a22', mane: '#141010', sock: true },
};
// dir: 0 baixo, 1 esquerda (espelho), 2 direita, 3 cima; frames: idle0, walk0-3, gallop0-3, eat
export function horseFrames(coat, saddle = null) {
  return cached(`horse:${coat}:${saddle}`, () => {
    const C = HORSE_COATS[coat] || HORSE_COATS.brown;
    const res = { side: {}, front: {}, back: {} };
    for (const n of ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'gallop0', 'gallop1', 'gallop2', 'gallop3', 'eat']) res.side[n] = horseSide(C, n, saddle);
    for (let i = 0; i < 4; i++) { res.front['walk' + i] = horseFront(C, i, saddle, false); res.back['walk' + i] = horseFront(C, i, saddle, true); }
    res.front.idle0 = res.front.walk0; res.back.idle0 = res.back.walk0;
    return res;
  });
}
function horseSide(C, n, saddle) {
  const p = new PixelPainter(36, 30);
  const body = C.body, bodyD = darken(body, 0.25), bodyL = lighten(body, 0.15), mane = C.mane;
  const gallop = n.startsWith('gallop'), walk = n.startsWith('walk');
  const ph = gallop || walk ? Number(n.slice(-1)) : 0;
  const bob = gallop ? [0, -2, -1, 0][ph] : walk ? (ph % 2 ? -1 : 0) : n === 'idle1' ? 1 : 0;
  const ground = 29, by = 12 + bob;
  // pernas
  const legPos = [9, 12, 23, 26];
  const swing = gallop ? [[3, 2, -3, -2], [4, 3, -1, 0], [-2, -3, 3, 4], [-3, -2, 2, 3]][ph] : walk ? [[1, -1, -1, 1], [2, 0, 0, -2], [-1, 1, 1, -1], [0, -2, 2, 0]][ph] : [0, 0, 0, 0];
  legPos.forEach((lx, i) => {
    const lc = i % 2 ? bodyD : body;
    for (let y = 0; y < 11 - bob; y++) { const x = lx + Math.round((swing[i] * y) / 11); p.rect(x, by + 7 + y, 2, 1, y > 7 && C.sock && i % 2 === 0 ? '#e8e4dc' : lc); }
    p.rect(lx + swing[i], ground - 1, 2, 1, '#2a2020');
  });
  // corpo
  p.ellipse(17, by + 4, 11, 5, body);
  p.ellipse(17, by + 6, 9, 3, bodyD);
  p.ellipse(17, by + 3, 10, 3, body);
  p.hline(9, by, 16, bodyL);
  if (C.dapple) for (let i = 0; i < 8; i++) p.circle(9 + i * 2.4, by + 3 + (i % 2) * 2, 1, lighten(body, 0.25));
  if (C.glow) for (let i = 0; i < 4; i++) p.set(10 + i * 4, by + 1, '#ffffff');
  // pescoço e cabeça
  const head = n === 'eat' ? 8 : 0;
  p.line(26, by + 2, 30, by - 5 + head, body); p.line(27, by + 3, 31, by - 4 + head, body); p.line(25, by + 3, 29, by - 4 + head, body);
  p.rect(28, by - 7 + head, 4, 4, body); p.rect(31, by - 6 + head, 3, 3, body); p.set(33, by - 5 + head, '#2a1e1a'); p.set(30, by - 6 + head, '#120c0c'); p.set(29, by - 8 + head, bodyD);
  // crina
  for (let i = 0; i < 7; i++) p.set(26 + i * 0.6 - (gallop ? 1 : 0), by - 4 + head - i * 0.5 + 3, mane), p.set(25 + i * 0.6, by - 3 + head - i * 0.5 + 3, mane);
  p.rect(28, by - 8 + head, 2, 1, mane);
  // cauda
  const tl = gallop ? -2 : 0;
  for (let i = 0; i < 8; i++) p.set(6 - Math.floor(i / 3) + (gallop ? -i / 2 : 0), by + 1 + i + tl, mane), p.set(5 - Math.floor(i / 3), by + 2 + i + tl, darken(mane, 0.2));
  // sela
  if (saddle) { p.rect(13, by - 1, 8, 3, '#5a3a22'); p.rect(12, by + 1, 10, 4, saddle); p.hline(12, by + 5, 10, darken(saddle, 0.3)); p.set(15, by - 2, '#5a3a22'); p.vline(17, by + 5, 4, '#3a2a1a'); }
  p.outline('#1c1520');
  return p.done();
}
function horseFront(C, ph, saddle, back) {
  const p = new PixelPainter(20, 32);
  const body = C.body, bodyD = darken(body, 0.25), mane = C.mane;
  const bob = ph % 2 ? -1 : 0;
  const legs = [[6, ph === 1 ? -1 : 0], [8, ph === 3 ? -1 : 0], [11, ph === 3 ? -1 : 0], [13, ph === 1 ? -1 : 0]];
  for (const [lx, o] of legs) { p.rect(lx, 20 + bob + o, 2, 10 - o, lx < 10 ? body : bodyD); p.rect(lx, 30, 2, 1, '#2a2020'); }
  p.ellipse(10, 17 + bob, 6, 6, body);
  p.ellipse(10, 18 + bob, 4, 4, back ? bodyD : body);
  if (!back) {
    p.rect(8, 3 + bob, 5, 10, body); p.rect(8, 11 + bob, 5, 3, darken(body, 0.1)); p.set(8, 5 + bob, '#120c0c'); p.set(12, 5 + bob, '#120c0c'); p.set(9, 13 + bob, '#2a1e1a'); p.set(11, 13 + bob, '#2a1e1a');
    p.set(8, 2 + bob, body); p.set(12, 2 + bob, body); p.rect(9, 2 + bob, 3, 2, mane);
  } else {
    p.rect(8, 6 + bob, 5, 8, body); p.rect(9, 4 + bob, 3, 9, mane); p.set(8, 4 + bob, body); p.set(12, 4 + bob, body);
    for (let i = 0; i < 6; i++) p.set(10, 22 + bob + i, mane);
  }
  if (saddle) { p.rect(5, 13 + bob, 10, 6, saddle); p.hline(5, 19 + bob, 10, darken(saddle, 0.3)); }
  p.outline('#1c1520');
  return p.done();
}
