// Reversi (public-domain board game) against a minimax AI with 3 levels.
// Mouse/touch to place; arrows + Enter/Space also work.

import { createGame } from "./engine.js";

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const WEIGHTS = [
  [120, -20, 20, 5, 5, 20, -20, 120], [-20, -40, -5, -5, -5, -5, -40, -20], [20, -5, 15, 3, 3, 15, -5, 20], [5, -5, 3, 3, 3, 3, -5, 5],
  [5, -5, 3, 3, 3, 3, -5, 5], [20, -5, 15, 3, 3, 15, -5, 20], [-20, -40, -5, -5, -5, -5, -40, -20], [120, -20, 20, 5, 5, 20, -20, 120],
];

export default async function reversi(ctx) {
  const g = createGame(ctx, { width: 600, height: 680, bg: "#0b1a12" });
  const W = 600, B = 520, OX = 40, OY = 110, C = B / 8;
  let board, turn, level = 2, cursor = [3, 3], msg = "", thinking = false, last = null, flips = [];
  const init = () => { board = Array.from({ length: 8 }, () => Array(8).fill(0)); board[3][3] = board[4][4] = -1; board[3][4] = board[4][3] = 1; turn = 1; msg = "Sua vez (pretas)"; last = null; };
  init();

  const inside = (x, y) => x >= 0 && y >= 0 && x < 8 && y < 8;
  function flipsFor(b, x, y, p) {
    if (b[y][x]) return [];
    const out = [];
    for (const [dx, dy] of DIRS) {
      const line = [];
      let cx = x + dx, cy = y + dy;
      while (inside(cx, cy) && b[cy][cx] === -p) { line.push([cx, cy]); cx += dx; cy += dy; }
      if (line.length && inside(cx, cy) && b[cy][cx] === p) out.push(...line);
    }
    return out;
  }
  const moves = (b, p) => { const m = []; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const f = flipsFor(b, x, y, p); if (f.length) m.push([x, y, f]); } return m; };
  const apply = (b, [x, y, f], p) => { const n = b.map((r) => r.slice()); n[y][x] = p; for (const [fx, fy] of f) n[fy][fx] = p; return n; };
  const score = (b, p) => { let s = 0; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) s += b[y][x] * WEIGHTS[y][x]; return s * p + (moves(b, p).length - moves(b, -p).length) * 6; };
  function minimax(b, p, depth, a, bt, me) {
    const ms = moves(b, p);
    if (!depth || (!ms.length && !moves(b, -p).length)) return score(b, me);
    if (!ms.length) return minimax(b, -p, depth - 1, a, bt, me);
    if (p === me) { let v = -Infinity; for (const m of ms) { v = Math.max(v, minimax(apply(b, m, p), -p, depth - 1, a, bt, me)); a = Math.max(a, v); if (a >= bt) break; } return v; }
    let v = Infinity; for (const m of ms) { v = Math.min(v, minimax(apply(b, m, p), -p, depth - 1, a, bt, me)); bt = Math.min(bt, v); if (a >= bt) break; } return v;
  }
  const count = (p) => board.flat().filter((v) => v === p).length;

  function play(x, y) {
    if (thinking || turn !== 1) return;
    const f = flipsFor(board, x, y, 1);
    if (!f.length) { g.beep(160, 0.08, "square", 0.1); return; }
    board = apply(board, [x, y, f], 1); last = [x, y]; flips = f.map((q) => [...q, performance.now()]);
    g.beep(520, 0.07, "triangle", 0.25);
    next(-1);
  }
  function next(p) {
    turn = p;
    if (!moves(board, p).length) {
      if (!moves(board, -p).length) { const a = count(1), b = count(-1); msg = a > b ? `Você venceu! ${a} × ${b}` : a < b ? `A IA venceu. ${a} × ${b}` : `Empate ${a} × ${b}`; turn = 0; if (a > b) g.saveBest(a); return; }
      msg = p === 1 ? "Você não tem jogadas — passa a vez" : "A IA passou a vez"; turn = -p;
      if (turn === -1) return setTimeout(ai, 600);
      return;
    }
    if (p === -1) { msg = "IA pensando…"; thinking = true; setTimeout(ai, 350); }
    else msg = "Sua vez (pretas)";
  }
  function ai() {
    const ms = moves(board, -1);
    if (!ms.length) { thinking = false; return next(1); }
    const depth = [1, 3, 5][level - 1];
    let best = ms[0], bv = -Infinity;
    for (const m of ms) { const v = level === 1 ? Math.random() * 10 + m[2].length : minimax(apply(board, m, -1), 1, depth - 1, -Infinity, Infinity, -1); if (v > bv) { bv = v; best = m; } }
    board = apply(board, best, -1); last = [best[0], best[1]]; flips = best[2].map((q) => [...q, performance.now()]);
    g.beep(330, 0.07, "triangle", 0.25);
    thinking = false;
    next(1);
  }

  g.canvas.addEventListener("pointerdown", (e) => {
    const [px, py] = g.toLocal(e);
    if (py > 40 && py < 84) { // level buttons / restart
      if (px > 290 && px < 560) { const i = Math.floor((px - 290) / 90); if (i < 3) { level = i + 1; init(); } }
      else if (px < 200) init();
      return;
    }
    const x = Math.floor((px - OX) / C), y = Math.floor((py - OY) / C);
    if (inside(x, y)) { cursor = [x, y]; play(x, y); }
  });

  function update() {
    const p = g.pressed;
    if (p.has("ArrowLeft")) cursor[0] = Math.max(0, cursor[0] - 1);
    if (p.has("ArrowRight")) cursor[0] = Math.min(7, cursor[0] + 1);
    if (p.has("ArrowUp")) cursor[1] = Math.max(0, cursor[1] - 1);
    if (p.has("ArrowDown")) cursor[1] = Math.min(7, cursor[1] + 1);
    if (p.has("Enter") || p.has("Space")) play(...cursor);
  }
  function render(c) {
    c.fillStyle = "#0b1a12"; c.fillRect(0, 0, W, 680);
    c.fillStyle = "#fff"; c.font = "800 26px system-ui"; c.textAlign = "left"; c.fillText("REVERSI", OX, 34);
    c.font = "14px system-ui"; c.fillStyle = "#a7f3d0"; c.textAlign = "right"; c.fillText(msg, W - OX, 32);
    c.fillStyle = "rgba(255,255,255,.1)"; rr(c, OX, 48, 140, 32, 8); c.fill(); c.fillStyle = "#fff"; c.textAlign = "center"; c.fillText("Novo jogo", OX + 70, 69);
    ["Fácil", "Médio", "Difícil"].forEach((n, i) => { c.fillStyle = level === i + 1 ? "#22c55e" : "rgba(255,255,255,.1)"; rr(c, 290 + i * 90, 48, 84, 32, 8); c.fill(); c.fillStyle = "#fff"; c.fillText(n, 332 + i * 90, 69); });
    c.fillStyle = "#14532d"; rr(c, OX - 8, OY - 8, B + 16, B + 16, 14); c.fill();
    c.fillStyle = "#15803d"; c.fillRect(OX, OY, B, B);
    c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = 1.5;
    for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(OX + i * C, OY); c.lineTo(OX + i * C, OY + B); c.stroke(); c.beginPath(); c.moveTo(OX, OY + i * C); c.lineTo(OX + B, OY + i * C); c.stroke(); }
    const now = performance.now();
    if (turn === 1 && !thinking) for (const [x, y] of moves(board, 1)) { c.fillStyle = "rgba(0,0,0,.22)"; c.beginPath(); c.arc(OX + x * C + C / 2, OY + y * C + C / 2, 7, 0, 6.283); c.fill(); }
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const v = board[y][x];
      if (!v) continue;
      const fl = flips.find((f) => f[0] === x && f[1] === y);
      const t = fl ? Math.min(1, (now - fl[2]) / 260) : 1;
      const sx = Math.abs(Math.cos(t * Math.PI)) * (t < 0.5 ? 1 : 1);
      const color = t < 0.5 ? -v : v;
      const cx = OX + x * C + C / 2, cy = OY + y * C + C / 2;
      c.fillStyle = "rgba(0,0,0,.35)"; c.beginPath(); c.ellipse(cx + 2, cy + 3, (C / 2 - 6) * Math.max(0.08, sx), C / 2 - 6, 0, 0, 6.283); c.fill();
      const gr = c.createRadialGradient(cx - 8, cy - 10, 2, cx, cy, C / 2);
      if (color === 1) { gr.addColorStop(0, "#555"); gr.addColorStop(1, "#0a0a0a"); } else { gr.addColorStop(0, "#fff"); gr.addColorStop(1, "#cfd6e0"); }
      c.fillStyle = gr; c.beginPath(); c.ellipse(cx, cy, (C / 2 - 6) * Math.max(0.08, sx), C / 2 - 6, 0, 0, 6.283); c.fill();
    }
    if (last) { c.strokeStyle = "#facc15"; c.lineWidth = 2; c.strokeRect(OX + last[0] * C + 3, OY + last[1] * C + 3, C - 6, C - 6); }
    c.strokeStyle = "rgba(255,255,255,.7)"; c.setLineDash([5, 4]); c.strokeRect(OX + cursor[0] * C + 1, OY + cursor[1] * C + 1, C - 2, C - 2); c.setLineDash([]);
    c.font = "600 16px system-ui"; c.textAlign = "left"; c.fillStyle = "#fff";
    c.fillText(`● Você: ${count(1)}`, OX, OY + B + 40); c.textAlign = "right"; c.fillText(`○ IA: ${count(-1)}   ·   Recorde: ${g.best()}`, OX + B, OY + B + 40);
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
  g.start(update, render);
  return { preferredInput: "mouse", destroy: g.destroy };
}
