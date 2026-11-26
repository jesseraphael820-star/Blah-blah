// Renderização da cena: chão, objetos e entidades ordenados por profundidade, efeitos, clima e luz.
import { G } from './state.js';
import { TILE, clamp, dist } from './core/util.js';
import { propSprite, emblemCanvas } from './gfx/objects.js';
import { FACTIONS, TERRITORIES, VILLAGES } from './data/world.js';
import { ambientLight, colorGrade, isNight } from './systems/time.js';
import { owner } from './systems/world.js';
import { objectiveTargets } from './systems/quests.js';
import { rgba } from './gfx/canvas.js';
import { input } from './core/input.js';

const drawList = [];
export function renderScene(ctx) {
  const { w: vw, h: vh } = G.view;
  const m = G.map;
  if (!m) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, vw, vh); return; }
  const cam = G.cam;
  const sx = G.settings.screenShake && cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 2 : 0, sy = G.settings.screenShake && cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 2 : 0;
  const C = { x: Math.round(cam.x + sx), y: Math.round(cam.y + sy) };
  m.drawGround(ctx, C.x, C.y, vw, vh, G.t);
  // objetos e entidades
  drawList.length = 0;
  const objs = m.objectsIn(C.x - 80, C.y - 40, C.x + vw + 80, C.y + vh + 120);
  for (const o of objs) if (!o.hidden && !o.removed && (o.spr || o.isFlag || o.banner)) drawList.push(o);
  for (const e of G.entities) if (e.mapId === m.id && !e.removed && e.draw) drawList.push(e);
  drawList.sort((a, b) => (a.y + (a.zSort || 0)) - (b.y + (b.zSort || 0)));
  const p = G.player;
  for (const d of drawList) {
    if (d.draw) { d.draw(ctx, C); continue; }
    drawObject(ctx, d, C, p);
  }
  G.particles.draw(ctx, C.x, C.y);
  // seta para objetivo fora da tela
  if (G.mode === 'play' && G.tracked && p) drawObjectiveArrow(ctx, C, vw, vh, p);
  if (G.fishing && p) { const bx = p.x + [0, -22, 22, 0][p.dir] - C.x, by = p.y + [20, 0, 0, -20][p.dir] - C.y + Math.sin(G.t * 6) * 1 + (G.fishing.hooked ? 2 : 0); ctx.strokeStyle = '#e8e8e8'; ctx.beginPath(); ctx.moveTo(p.x - C.x, p.y - 14 - C.y); ctx.lineTo(bx, by); ctx.stroke(); ctx.fillStyle = '#d02a2a'; ctx.fillRect(bx - 1, by - 1, 3, 3); }
  if (G.flags.postcredits) drawShips(ctx, C);
  // clima (apenas exterior)
  const fx = G.settings.fxIntensity;
  if (!m.interior) {
    const dx = G.cam.dx || 0, dy = G.cam.dy || 0;
    G.weather.draw(ctx, vw, vh, G.weatherState, G.dt, dx, dy, fx * (G.settings.quality === 0 ? 0.5 : 1), G.particles, C);
  }
  // iluminação
  const amb = ambientLight();
  const lights = [];
  if (amb.dark > 0.05) {
    for (const o of m.lights) { if (o.removed || o.hidden) continue; if (o.nightOnly && amb.dark < 0.25 && !m.interior) continue; if (o.light) lights.push({ x: o.x, y: o.y - 8, r: o.light.r, color: o.light.color, flick: o.light.flick }); }
    if (p && (m.interior ? m.dark > 0.5 : amb.dark > 0.3)) lights.push({ x: p.x, y: p.y - 10, r: m.interior ? 72 : 58, color: '#ffd8a0', flick: true });
    for (const e of G.entities) if (e.mapId === m.id && e.isProjectile && !e.stuck) lights.push({ x: e.x, y: e.y - 8, r: 10 });
  }
  G.lighting.draw(ctx, vw, vh, amb.dark * (0.6 + 0.4 * Math.min(1, fx + 0.4)), amb.tint, lights, C, G.settings.quality, G.t);
  const cg = colorGrade();
  if (cg && fx > 0) { ctx.fillStyle = rgba(cg.color, cg.a * fx); ctx.fillRect(0, 0, vw, vh); }
  // vinheta de dano
  if (p && p.hp < p.maxHp * 0.3 && !p.dead) { const a = (0.3 - p.hp / p.maxHp) * 1.2 * (0.7 + Math.sin(G.t * 5) * 0.3); const g = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.3, vw / 2, vh / 2, vw * 0.7); g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, `rgba(140,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh); }
}

function drawObject(ctx, o, C, p) {
  let x = Math.round(o.x - C.x), y = Math.round(o.y - C.y);
  if (o.isFlag) {
    const own = owner(o.territory);
    const col = own ? (own === 'ravencross' ? '#2a2430' : FACTIONS[own].color) : '#d8d0c0';
    const spr = propSprite('flagpole', col, Math.floor(G.t * 4 + o.x) % 3);
    ctx.drawImage(spr.c, x - spr.ox, y - spr.oy);
    if (G.capture && G.capture.o === o) { ctx.fillStyle = '#b88ad8'; ctx.fillRect(x - 10, y - 50, Math.round(20 * G.capture.t / 2.5), 2); }
    return;
  }
  if (o.banner) {
    const v = VILLAGES[o.village];
    const capT = TERRITORIES.find((t) => t.id.endsWith('_capital') && t.x === v.x && t.y === v.y);
    const own = capT ? owner(capT.id) : v.faction;
    const col = own === 'ravencross' ? '#2a2430' : FACTIONS[own || v.faction].color;
    const spr = propSprite('banner', col, Math.floor(G.t * 4 + o.x) % 3);
    ctx.drawImage(spr.c, x - spr.ox, y - spr.oy);
    return;
  }
  let spr = o.spr;
  if (o.anim === 'campfire' || o.anim === 'fireplace') {
    const f = Math.floor(G.t * 8 + o.x) % 3;
    spr = propSprite(o.anim, '', f);
    if (Math.random() < 0.12) G.particles.add({ x: o.x + (Math.random() - 0.5) * 6, y: o.y - (o.anim === 'fireplace' ? 12 : 8), vy: -24, vx: (Math.random() - 0.5) * 6, life: 0.8, color: Math.random() < 0.5 ? '#ffb040' : '#ff6020', size: 1 });
    if (o.anim === 'campfire' && Math.random() < 0.06) G.particles.add({ x: o.x, y: o.y - 14, vy: -14, vx: 3, life: 2, color: '#8a8a8a', type: 'smoke', size: 3 });
  }
  if (o.smoke && Math.random() < 0.05) G.particles.add({ x: o.x, y: o.y - 4, vy: -12, vx: 2, life: 2.5, color: '#6a6460', type: 'smoke', size: 4 });
  if (o.kind === 'building' && (o.style === 'cinzamar' || o.btype === 'smithy' || o.btype === 'tavern') && Math.random() < 0.05) G.particles.add({ x: o.x + (o.spr.w || 60) / 2 - 15, y: o.y - (o.spr.h || 50) + 4, vy: -12, vx: 4, life: 3, color: '#8a8a8a', type: 'smoke', size: 3 });
  if (o.kind === 'building' && G.flags.fallen && !G.flags.rebuilt && o.style === 'varden' && Math.random() < 0.04) G.particles.add({ x: o.x + (Math.random() - 0.5) * 40, y: o.y - 30, vy: -14, life: 3, color: '#3a3430', type: 'smoke', size: 4 });
  if (o.shake > 0) { x += Math.round(Math.sin(G.t * 60) * 2); o.shake -= G.dt; }
  if (!spr || !spr.c) return;
  // copa transparente quando o jogador está atrás
  let alpha = 1;
  if ((o.canopy || o.kind === 'building') && p && p.mapId === o.map.id && p.y < o.y - 2 && p.y > o.y - spr.oy + 4 && Math.abs(p.x - o.x) < spr.ox) alpha = 0.55;
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.drawImage(spr.c, x - spr.ox, y - spr.oy);
  if (alpha < 1) ctx.globalAlpha = 1;
  // brilho em objetos de missão
  if (o.glint || (o.kind === 'chest' && !G.opened[o.cid])) {
    const k = (G.t * 1.5 + o.x * 0.01) % 2;
    if (k < 0.3) { ctx.fillStyle = '#fff8c0'; const gx = x - 2 + Math.round(k * 10), gy = y - spr.oy + 2; ctx.fillRect(gx, gy, 1, 3); ctx.fillRect(gx - 1, gy + 1, 3, 1); }
  }
  if (o.kind === 'qprop' && o.glint) { ctx.globalAlpha = 0.5 + Math.sin(G.t * 4) * 0.3; ctx.fillStyle = '#ffe080'; ctx.fillRect(x - 1, y - spr.oy - 6 + Math.round(Math.sin(G.t * 3) * 2), 2, 2); ctx.globalAlpha = 1; }
}

function drawObjectiveArrow(ctx, C, vw, vh, p) {
  const tgs = objectiveTargets(G.tracked);
  let best = null, bd = 1e9;
  for (const tg of tgs) {
    let tx = tg.x, ty = tg.y;
    if (tg.map !== p.mapId) {
      if (p.mapId === 'world') { const d = G.world.doors.find((dd) => dd.target === tg.map); if (!d) continue; tx = d.x; ty = d.y; }
      else { const m = G.map; if (m.exitDoor) { tx = m.exitDoor.x; ty = m.exitDoor.y; } else continue; }
    }
    const d = dist(p.x, p.y, tx, ty); if (d < bd) { bd = d; best = [tx, ty]; }
  }
  if (!best) return;
  const sx = best[0] - C.x, sy = best[1] - C.y;
  if (sx > 8 && sy > 8 && sx < vw - 8 && sy < vh - 8) {
    // marcador sobre o alvo visível
    const by = sy - 30 + Math.sin(G.t * 4) * 2;
    ctx.fillStyle = '#1c1520'; ctx.fillRect(sx - 3, by - 1, 7, 7); ctx.fillStyle = '#ffd84a'; ctx.fillRect(sx - 2, by, 5, 5); ctx.fillStyle = '#fff4c0'; ctx.fillRect(sx - 1, by + 1, 2, 2);
    return;
  }
  const a = Math.atan2(sy - vh / 2, sx - vw / 2);
  const ex = clamp(vw / 2 + Math.cos(a) * (vw / 2 - 14), 10, vw - 10), ey = clamp(vh / 2 + Math.sin(a) * (vh / 2 - 14), 10, vh - 10);
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
  ctx.fillStyle = '#1c1520'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -6); ctx.lineTo(-2, 0); ctx.lineTo(-5, 6); ctx.fill();
  ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-1, 0); ctx.lineTo(-4, 4); ctx.fill();
  ctx.restore();
}
function drawShips(ctx, C) {
  const mk = G.world.markers.postcredit_sea; if (!mk) return;
  for (let i = 0; i < 3; i++) {
    const spr = propSprite('ship', '#1a1418');
    const x = Math.round(mk[0] - 60 + i * 110 - G.t * 3 - C.x), y = Math.round(mk[1] - 80 + i * 70 + Math.sin(G.t + i) * 2 - C.y);
    ctx.drawImage(spr.c, x - spr.ox, y - spr.oy);
  }
}
