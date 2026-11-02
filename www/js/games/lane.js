// Turbo Lane — original neon highway racer.
// Steer: ←/→ (or analog) · Accelerate: ↑ · Brake: ↓ · Turbo: Space/A · touch left/right half to steer.

import { createGame } from "./engine.js";

export default async function lane(ctx) {
  const g = createGame(ctx, { width: 640, height: 720, bg: "#07040d" });
  const W = 640, H = 720, LANES = 4, ROAD_L = 120, ROAD_W = 400, LW = ROAD_W / LANES;
  const laneX = (i) => ROAD_L + LW * i + LW / 2;
  const COLORS = ["#ff3d6e", "#ffb547", "#2fd08a", "#00b8d9", "#b48cff", "#f5f5f5"];
  let S;
  const reset = () => (S = { state: "title", x: laneX(1.5), speed: 0, dist: 0, boost: 100, cars: [], coins: [], parts: [], score: 0, spawn: 0, touch: 0, best: g.best(), crash: 0 });
  reset();
  const rand = (a, b) => a + Math.random() * (b - a);

  g.canvas.addEventListener("pointerdown", (e) => {
    if (S.state !== "play") return start();
    const [x] = g.toLocal(e);
    S.touch = x < W / 2 ? -1 : 1;
  });
  const release = () => { S.touch = 0; };
  window.addEventListener("pointerup", release);
  function start() { reset(); S.state = "play"; S.speed = 200; g.beep(330, 0.25, "sawtooth", 0.2, 400); }

  function update(dt) {
    if (S.state !== "play") { if (g.pressed.has("Space") || g.pressed.has("Enter")) start(); S.dist += 60 * dt; return; }
    const k = g.keys;
    const steer = (k.has("ArrowRight") || k.has("KeyD") ? 1 : 0) - (k.has("ArrowLeft") || k.has("KeyA") ? 1 : 0) + S.touch;
    const turbo = (k.has("Space") || k.has("KeyX")) && S.boost > 0;
    const target = k.has("ArrowDown") || k.has("KeyS") ? 160 : k.has("ArrowUp") || k.has("KeyW") || S.touch ? 560 : 420;
    S.speed += ((turbo ? 820 : target) - S.speed) * Math.min(1, dt * 1.6);
    S.boost = turbo ? Math.max(0, S.boost - 35 * dt) : Math.min(100, S.boost + 6 * dt);
    S.x = Math.max(ROAD_L + 24, Math.min(ROAD_L + ROAD_W - 24, S.x + steer * 330 * dt));
    S.dist += S.speed * dt;
    S.score += Math.round(S.speed * dt * 0.1) * (turbo ? 2 : 1);
    S.spawn -= dt;
    if (S.spawn <= 0) {
      S.spawn = rand(0.45, 1.1) * (420 / Math.max(300, S.speed)) * 1.4;
      const ln = Math.floor(Math.random() * LANES);
      if (!S.cars.some((c) => c.ln === ln && c.y < 120)) S.cars.push({ ln, x: laneX(ln), y: -90, v: rand(120, 260), color: COLORS[Math.floor(Math.random() * COLORS.length)], truck: Math.random() < 0.2 });
      if (Math.random() < 0.35) S.coins.push({ x: laneX(Math.floor(Math.random() * LANES)), y: -40 });
    }
    for (const c of S.cars) {
      c.y += (S.speed - c.v) * dt;
      const len = c.truck ? 110 : 70;
      if (Math.abs(c.x - S.x) < 40 && Math.abs(c.y - (H - 130)) < len / 2 + 34) crash();
    }
    S.cars = S.cars.filter((c) => c.y < H + 140 && c.y > -300);
    S.coins = S.coins.filter((c) => { c.y += S.speed * dt; if (Math.hypot(c.x - S.x, c.y - (H - 130)) < 36) { S.score += 100; S.boost = Math.min(100, S.boost + 15); g.beep(1200, 0.08, "sine", 0.2, 600); return false; } return c.y < H + 40; });
    if (g.quality >= 2 && turbo) for (let i = 0; i < g.quality; i++) S.parts.push({ x: S.x + rand(-10, 10), y: H - 90, vy: rand(150, 300), life: 0.4, color: Math.random() < 0.5 ? "#ffb547" : "#ff3d6e" });
    S.parts = S.parts.filter((p) => ((p.y += p.vy * dt), (p.life -= dt) > 0));
  }
  function crash() {
    S.state = "over";
    g.beep(80, 0.6, "sawtooth", 0.4, -50);
    S.newBest = g.saveBest(S.score);
    S.best = g.best();
  }

  function car(c, x, y, color, truck, player) {
    const w = 46, len = truck ? 110 : 72;
    c.save(); c.translate(x, y);
    if (g.quality >= 3) { c.shadowColor = color; c.shadowBlur = player ? 26 : 14; }
    c.fillStyle = color;
    roundRect(c, -w / 2, -len / 2, w, len, 10); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = "rgba(10,14,28,.85)";
    roundRect(c, -w / 2 + 6, -len / 2 + (player ? 14 : len - 30), w - 12, 16, 4); c.fill();
    roundRect(c, -w / 2 + 6, -len / 2 + (player ? len - 26 : 12), w - 12, 12, 4); c.fill();
    c.fillStyle = player ? "#fff6c2" : "#ff5a6a";
    c.fillRect(-w / 2 + 4, player ? -len / 2 + 2 : len / 2 - 6, 9, 4); c.fillRect(w / 2 - 13, player ? -len / 2 + 2 : len / 2 - 6, 9, 4);
    c.restore();
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  function render(c) {
    c.fillStyle = "#07040d"; c.fillRect(0, 0, W, H);
    // city glow on the sides
    for (let i = 0; i < 14; i++) {
      const y = ((i * 120 + S.dist * 0.5) % (H + 120)) - 120;
      c.fillStyle = i % 2 ? "rgba(123,92,255,.25)" : "rgba(255,61,110,.2)";
      c.fillRect(10, y, 80, 90); c.fillRect(W - 90, y + 40, 80, 70);
    }
    c.fillStyle = "#120d1c"; c.fillRect(ROAD_L, 0, ROAD_W, H);
    c.fillStyle = "#ff3d6e"; c.fillRect(ROAD_L - 6, 0, 6, H); c.fillRect(ROAD_L + ROAD_W, 0, 6, H);
    c.fillStyle = "rgba(255,255,255,.55)";
    for (let l = 1; l < LANES; l++) for (let y = (S.dist % 80) - 80; y < H; y += 80) c.fillRect(ROAD_L + LW * l - 2, y, 4, 40);
    for (const p of S.parts) { c.globalAlpha = p.life * 2; c.fillStyle = p.color; c.fillRect(p.x - 3, p.y, 6, 10); }
    c.globalAlpha = 1;
    for (const co of S.coins) { c.fillStyle = "#ffe14d"; c.beginPath(); c.arc(co.x, co.y, 11, 0, 6.283); c.fill(); c.fillStyle = "#c98a12"; c.fillRect(co.x - 2, co.y - 6, 4, 12); }
    for (const k of S.cars) car(c, k.x, k.y, k.color, k.truck, false);
    car(c, S.x, H - 130, "#4c8dff", false, true);
    c.font = "700 20px system-ui, sans-serif"; c.fillStyle = "#fff"; c.textAlign = "left";
    c.fillText(`${Math.round(S.speed * 0.36)} km/h`, 16, 32);
    c.fillText(`${S.score}`, 16, 60);
    c.textAlign = "right"; c.fillStyle = "#a9b1c6"; c.font = "600 14px system-ui"; c.fillText(`RECORDE ${Math.max(S.best, S.score)}`, W - 16, 30);
    c.fillStyle = "rgba(255,255,255,.15)"; c.fillRect(W - 116, 42, 100, 10); c.fillStyle = "#ffb547"; c.fillRect(W - 116, 42, S.boost, 10);
    c.fillStyle = "#a9b1c6"; c.fillText("TURBO", W - 16, 70);
    if (S.state !== "play") {
      c.fillStyle = "rgba(7,4,13,.65)"; c.fillRect(0, 0, W, H);
      c.textAlign = "center"; c.fillStyle = "#fff"; c.font = "900 54px system-ui";
      c.fillText(S.state === "title" ? "TURBO LANE" : "BATIDA!", W / 2, H / 2 - 40);
      c.font = "16px system-ui"; c.fillStyle = "#a9b1c6";
      c.fillText(S.state === "title" ? "←/→ ou analógico para desviar · ↑ acelera · Espaço/A turbo" : `Pontuação ${S.score}${S.newBest ? " — NOVO RECORDE!" : ""}`, W / 2, H / 2);
      c.fillStyle = "#ffb547"; c.fillText("Toque ou Espaço para correr", W / 2, H / 2 + 40);
      c.fillStyle = "#6f7891"; c.font = "13px system-ui"; c.fillText(`Efeitos: ${["", "básicos", "médios", "máximos"][g.quality]} · ${g.fps} FPS`, W / 2, H - 20);
    }
  }
  g.start(update, render);
  return { preferredInput: "keys", destroy() { window.removeEventListener("pointerup", release); g.destroy(); } };
}
