// Astro Blaster — original arena space shooter.
// Move: arrows/WASD (or analog in game mode) · Shoot: Space/A or click/tap to aim.

import { createGame } from "./engine.js";

export default async function astro(ctx) {
  const g = createGame(ctx, { width: 960, height: 600, bg: "#03040a" });
  const W = 960, H = 600;
  const stars = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: Math.random() * 0.8 + 0.2 }));
  let S;
  const reset = () => (S = { state: "title", ship: { x: W / 2, y: H / 2, vx: 0, vy: 0, dir: -Math.PI / 2, cd: 0, inv: 2, shield: 100 }, bullets: [], rocks: [], drones: [], parts: [], pickups: [], score: 0, lives: 3, wave: 0, waveT: 0, aim: null, best: g.best() });
  reset();

  const rand = (a, b) => a + Math.random() * (b - a);
  const burst = (x, y, color, n = 14, sp = 160) => { const q = g.quality; for (let i = 0; i < n * q; i++) { const a = Math.random() * 6.283, v = rand(20, sp); S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.3, 0.8), color }); } };
  const rock = (x, y, r) => ({ x, y, r, vx: rand(-60, 60) * (40 / r), vy: rand(-60, 60) * (40 / r), rot: 0, vr: rand(-1, 1), pts: Array.from({ length: 11 }, () => rand(0.75, 1.15)) });
  function nextWave() {
    S.wave++;
    for (let i = 0; i < 2 + S.wave; i++) {
      const edge = Math.random() < 0.5;
      S.rocks.push(rock(edge ? (Math.random() < 0.5 ? -40 : W + 40) : rand(0, W), edge ? rand(0, H) : Math.random() < 0.5 ? -40 : H + 40, rand(34, 52)));
    }
    for (let i = 0; i < Math.floor(S.wave / 2); i++) S.drones.push({ x: rand(0, W), y: -30, hp: 2 + Math.floor(S.wave / 3), cd: rand(1, 3) });
    S.waveT = 2;
  }

  g.canvas.addEventListener("pointerdown", (e) => {
    const [x, y] = g.toLocal(e);
    if (S.state !== "play") { start(); return; }
    S.aim = { x, y, t: 0.35 };
    fire(Math.atan2(y - S.ship.y, x - S.ship.x));
  });
  function start() { reset(); S.state = "play"; nextWave(); g.beep(520, 0.2, "triangle", 0.3, 300); }
  function fire(a) {
    const s = S.ship;
    if (s.cd > 0) return;
    s.cd = 0.16;
    S.bullets.push({ x: s.x + Math.cos(a) * 16, y: s.y + Math.sin(a) * 16, vx: Math.cos(a) * 620 + s.vx * 0.3, vy: Math.sin(a) * 620 + s.vy * 0.3, life: 1, enemy: false });
    g.beep(880, 0.06, "square", 0.12, -500);
  }

  const wrap = (o, m = 40) => { if (o.x < -m) o.x = W + m; if (o.x > W + m) o.x = -m; if (o.y < -m) o.y = H + m; if (o.y > H + m) o.y = -m; };
  const hit = (a, b, r) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < r * r;

  function update(dt) {
    for (const st of stars) { st.y += st.z * 30 * dt; if (st.y > H) { st.y = 0; st.x = Math.random() * W; } }
    S.parts = S.parts.filter((p) => ((p.x += p.vx * dt), (p.y += p.vy * dt), (p.vx *= 0.96), (p.vy *= 0.96), (p.life -= dt) > 0));
    if (S.state !== "play") { if (g.pressed.has("Space") || g.pressed.has("Enter")) start(); return; }
    const k = g.keys, s = S.ship;
    const ax = (k.has("ArrowRight") || k.has("KeyD") ? 1 : 0) - (k.has("ArrowLeft") || k.has("KeyA") ? 1 : 0);
    const ay = (k.has("ArrowDown") || k.has("KeyS") ? 1 : 0) - (k.has("ArrowUp") || k.has("KeyW") ? 1 : 0);
    if (ax || ay) { s.dir = Math.atan2(ay, ax); s.vx += Math.cos(s.dir) * 900 * dt; s.vy += Math.sin(s.dir) * 900 * dt; if (Math.random() < g.quality * 0.3) S.parts.push({ x: s.x - Math.cos(s.dir) * 12, y: s.y - Math.sin(s.dir) * 12, vx: -Math.cos(s.dir) * 120 + rand(-30, 30), vy: -Math.sin(s.dir) * 120 + rand(-30, 30), life: 0.3, color: "#7cc4ff" }); }
    s.vx *= Math.pow(0.12, dt); s.vy *= Math.pow(0.12, dt);
    s.x = Math.max(14, Math.min(W - 14, s.x + s.vx * dt)); s.y = Math.max(14, Math.min(H - 14, s.y + s.vy * dt));
    s.cd -= dt; s.inv -= dt;
    if (k.has("Space") || k.has("KeyX") || k.has("KeyJ")) fire(S.aim && S.aim.t > 0 ? Math.atan2(S.aim.y - s.y, S.aim.x - s.x) : s.dir);
    if (S.aim) S.aim.t -= dt;

    S.bullets = S.bullets.filter((b) => ((b.x += b.vx * dt), (b.y += b.vy * dt), (b.life -= dt) > 0 && b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20));
    for (const r of S.rocks) { r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.vr * dt; wrap(r); }
    for (const d of S.drones) {
      const a = Math.atan2(s.y - d.y, s.x - d.x);
      d.x += Math.cos(a) * (70 + S.wave * 6) * dt; d.y += Math.sin(a) * (70 + S.wave * 6) * dt;
      d.cd -= dt;
      if (d.cd <= 0) { d.cd = rand(1.6, 3); S.bullets.push({ x: d.x, y: d.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 3, enemy: true }); g.beep(300, 0.08, "sawtooth", 0.08); }
    }
    // collisions
    for (const b of S.bullets) {
      if (b.enemy) { if (s.inv <= 0 && hit(b, s, 14)) { b.life = 0; damage(34); } continue; }
      for (const r of S.rocks) if (!r.dead && hit(b, r, r.r)) {
        r.dead = true; b.life = 0; S.score += Math.round(100 / r.r * 20);
        burst(r.x, r.y, "#c9b79c", 10);
        g.beep(140 + r.r, 0.15, "triangle", 0.25, -100);
        if (r.r > 20) for (let i = 0; i < 2; i++) S.rocks.push(rock(r.x, r.y, r.r * 0.58));
        if (Math.random() < 0.08) S.pickups.push({ x: r.x, y: r.y, t: 8 });
        break;
      }
      for (const d of S.drones) if (!d.dead && hit(b, d, 18)) { b.life = 0; if (--d.hp <= 0) { d.dead = true; S.score += 250; burst(d.x, d.y, "#ff4d8d", 18, 220); g.beep(200, 0.3, "sawtooth", 0.25, -150); } }
    }
    S.rocks = S.rocks.filter((r) => !r.dead);
    S.drones = S.drones.filter((d) => !d.dead);
    S.bullets = S.bullets.filter((b) => b.life > 0);
    if (s.inv <= 0) { for (const r of S.rocks) if (hit(r, s, r.r + 10)) { damage(50); r.vx *= -1; r.vy *= -1; } for (const d of S.drones) if (hit(d, s, 26)) { damage(40); d.dead = true; burst(d.x, d.y, "#ff4d8d"); } }
    S.pickups = S.pickups.filter((p) => { p.t -= dt; if (hit(p, s, 22)) { s.shield = Math.min(100, s.shield + 40); g.beep(990, 0.2, "sine", 0.3, 400); S.score += 50; return false; } return p.t > 0; });
    if (!S.rocks.length && !S.drones.length) { S.waveT -= dt; if (S.waveT <= 0) nextWave(); }
  }
  function damage(n) {
    const s = S.ship;
    s.shield -= n; s.inv = 0.8;
    g.beep(90, 0.3, "sawtooth", 0.35, -40);
    burst(s.x, s.y, "#7cc4ff", 8);
    if (s.shield <= 0) {
      S.lives--; burst(s.x, s.y, "#ffffff", 30, 280);
      if (S.lives <= 0) { S.state = "over"; S.newBest = g.saveBest(S.score); S.best = g.best(); return; }
      Object.assign(s, { x: W / 2, y: H / 2, vx: 0, vy: 0, shield: 100, inv: 2.5 });
    }
  }

  function render(c) {
    c.fillStyle = "#03040a"; c.fillRect(0, 0, W, H);
    const grd = c.createRadialGradient(W * 0.7, H * 0.3, 10, W * 0.7, H * 0.3, 500);
    grd.addColorStop(0, "rgba(123,92,255,.18)"); grd.addColorStop(1, "transparent");
    c.fillStyle = grd; c.fillRect(0, 0, W, H);
    for (const st of stars) { c.fillStyle = `rgba(255,255,255,${st.z})`; c.fillRect(st.x, st.y, st.z * 2, st.z * 2); }
    const glow = g.quality >= 3;
    for (const p of S.parts) { c.globalAlpha = Math.max(0, p.life * 1.5); c.fillStyle = p.color; c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
    c.globalAlpha = 1;
    c.lineWidth = 2;
    for (const r of S.rocks) {
      c.save(); c.translate(r.x, r.y); c.rotate(r.rot);
      c.beginPath(); r.pts.forEach((m, i) => { const a = (i / r.pts.length) * 6.283; c[i ? "lineTo" : "moveTo"](Math.cos(a) * r.r * m, Math.sin(a) * r.r * m); }); c.closePath();
      c.fillStyle = "#1d1a24"; c.fill(); c.strokeStyle = "#b8a68a"; c.stroke(); c.restore();
    }
    for (const d of S.drones) { c.save(); c.translate(d.x, d.y); c.rotate(performance.now() / 300); if (glow) { c.shadowColor = "#ff4d8d"; c.shadowBlur = 16; } c.strokeStyle = "#ff4d8d"; c.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; c[i ? "lineTo" : "moveTo"](Math.cos(a) * 16, Math.sin(a) * 16); } c.closePath(); c.stroke(); c.fillStyle = "#ff4d8d"; c.fillRect(-3, -3, 6, 6); c.restore(); }
    for (const p of S.pickups) { c.save(); c.translate(p.x, p.y); c.rotate(performance.now() / 500); c.strokeStyle = "#2fd08a"; c.strokeRect(-9, -9, 18, 18); c.fillStyle = "#2fd08a"; c.fillRect(-2, -6, 4, 12); c.fillRect(-6, -2, 12, 4); c.restore(); }
    for (const b of S.bullets) { if (glow) { c.shadowColor = b.enemy ? "#ff4d8d" : "#7cc4ff"; c.shadowBlur = 10; } c.fillStyle = b.enemy ? "#ff7aa8" : "#bfe4ff"; c.beginPath(); c.arc(b.x, b.y, b.enemy ? 4 : 3, 0, 6.283); c.fill(); }
    c.shadowBlur = 0;
    const s = S.ship;
    if (S.state === "play" && !(s.inv > 0 && Math.floor(performance.now() / 90) % 2)) {
      c.save(); c.translate(s.x, s.y); c.rotate(s.dir);
      if (glow) { c.shadowColor = "#4c8dff"; c.shadowBlur = 18; }
      c.fillStyle = "#e8f1ff"; c.beginPath(); c.moveTo(18, 0); c.lineTo(-12, -11); c.lineTo(-6, 0); c.lineTo(-12, 11); c.closePath(); c.fill();
      c.fillStyle = "#4c8dff"; c.fillRect(-4, -3, 8, 6);
      c.restore();
    }
    if (S.aim?.t > 0) { c.strokeStyle = "rgba(124,196,255,.6)"; c.beginPath(); c.arc(S.aim.x, S.aim.y, 10, 0, 6.283); c.stroke(); }
    // HUD
    c.font = "600 18px system-ui, sans-serif"; c.fillStyle = "#fff"; c.textAlign = "left";
    c.fillText(`PONTOS ${S.score}`, 18, 30); c.fillText(`ONDA ${S.wave}`, 18, 54);
    c.textAlign = "right"; c.fillText(`RECORDE ${Math.max(S.best, S.score)}`, W - 18, 30);
    for (let i = 0; i < S.lives; i++) { c.fillStyle = "#e8f1ff"; c.beginPath(); c.moveTo(W - 24 - i * 22, 46); c.lineTo(W - 34 - i * 22, 62); c.lineTo(W - 14 - i * 22, 62); c.fill(); }
    c.fillStyle = "rgba(255,255,255,.15)"; c.fillRect(18, 64, 160, 8); c.fillStyle = s.shield > 30 ? "#2fd08a" : "#ff5a6a"; c.fillRect(18, 64, Math.max(0, s.shield) * 1.6, 8);
    if (S.state !== "play") {
      c.fillStyle = "rgba(3,4,10,.6)"; c.fillRect(0, 0, W, H);
      c.textAlign = "center"; c.fillStyle = "#fff"; c.font = "800 56px system-ui, sans-serif";
      c.fillText(S.state === "title" ? "ASTRO BLASTER" : "FIM DE JOGO", W / 2, H / 2 - 30);
      c.font = "400 18px system-ui, sans-serif"; c.fillStyle = "#a9b1c6";
      c.fillText(S.state === "title" ? "Setas/WASD ou analógico para mover · Espaço/A ou toque para atirar" : `Pontuação: ${S.score}${S.newBest ? " — NOVO RECORDE!" : ""}`, W / 2, H / 2 + 10);
      c.fillStyle = "#7cc4ff"; c.fillText("Toque ou pressione Espaço para começar", W / 2, H / 2 + 48);
      c.fillStyle = "#6f7891"; c.font = "13px system-ui"; c.fillText(`Qualidade gráfica: ${["", "básica", "média", "máxima"][g.quality]} (placa de vídeo virtual) · ${g.fps} FPS`, W / 2, H - 24);
    }
  }
  g.start(update, render);
  return { preferredInput: "keys", destroy: g.destroy };
}
