// HUD: money, health, wanted stars, clock, minimap, objectives, subtitles, big messages.
import { N, CELL, ORIGIN, HALF, SAND_Z, SHORE_Z } from './world.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(game) {
    this.g = game;
    this.el = {
      hud: $('hud'), money: $('money'), clock: $('clock'), hp: $('hpbar'), ar: $('arbar'), stars: $('stars'),
      weapon: $('weapon'), obj: $('objective'), sub: $('subtitle'), big: $('big'), bigT: $('bigTitle'), bigS: $('bigSub'),
      help: $('help'), car: $('carname'), timer: $('timer'), cross: $('crosshair'), dmg: $('damage'), lb: $('letterbox'),
      fade: $('fade'), speed: $('speed'),
    };
    this.map = $('minimap'); this.mctx = this.map.getContext('2d');
    this.shownMoney = 0;
    this.bigTimer = 0; this.helpTimer = 0; this.carTimer = 0;
    this.buildMapImage();
    for (let i = 0; i < 5; i++) { const s = document.createElement('span'); s.textContent = '★'; this.el.stars.appendChild(s); }
  }
  buildMapImage() {
    const S = 1000, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'); const m = (v) => v + S / 2;
    g.fillStyle = '#5f7448'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#c9b88a'; g.fillRect(0, m(SAND_Z), S, S);
    g.fillStyle = '#2b6f8f'; g.fillRect(0, m(SHORE_Z + 6), S, S);
    const w = this.g.world;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const b = w.blocks[i][j];
      g.fillStyle = b.type === 'park' ? '#6f9a4e' : b.type === 'gang' ? '#5a3a6e' : b.type === 'residential' || b.type === 'bento' || b.type === 'hospital' ? '#8c9468' : '#8b8b86';
      g.fillRect(m(b.x0), m(b.z0), 64, 64);
      g.fillStyle = 'rgba(40,40,45,0.55)';
      for (const c2 of b.colliders) if (c2.x1 - c2.x0 > 2) g.fillRect(m(c2.x0), m(c2.z0), c2.x1 - c2.x0, c2.z1 - c2.z0);
    }
    g.fillStyle = '#2d2d30';
    for (let k = 0; k <= N; k++) {
      const v = ORIGIN + k * CELL;
      g.fillRect(m(ORIGIN - HALF), m(v - HALF), N * CELL + 16, 16);
      g.fillRect(m(v - HALF), m(ORIGIN - HALF), 16, N * CELL + 16);
    }
    this.mapImg = c;
  }
  setObjective(html) { this.el.obj.innerHTML = html; this.el.obj.style.opacity = html ? 1 : 0; }
  subtitle(name, text) {
    if (!text) { this.el.sub.style.opacity = 0; return; }
    this.el.sub.innerHTML = `<span class="who">${name}:</span> ${text}`; this.el.sub.style.opacity = 1;
  }
  big(title, sub = '', color = '#ffd23a', dur = 3) {
    this.el.bigT.textContent = title; this.el.bigT.style.color = color; this.el.bigS.textContent = sub;
    this.el.big.classList.add('show'); this.bigTimer = dur;
  }
  help(html, dur = 3) { this.el.help.innerHTML = html; this.el.help.classList.add('show'); this.helpTimer = dur; }
  carName(n) { this.el.car.textContent = n; this.el.car.classList.add('show'); this.carTimer = 2.5; }
  setTimer(t) {
    if (t === null) { this.el.timer.style.display = 'none'; return; }
    this.el.timer.style.display = 'block';
    const s = Math.max(0, Math.ceil(t)); this.el.timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.el.timer.style.color = t < 15 ? '#ff4a4a' : '#fff';
  }
  flashDamage() { this.el.dmg.style.opacity = 0.6; clearTimeout(this.dmgT); this.dmgT = setTimeout(() => (this.el.dmg.style.opacity = 0), 120); }
  letterbox(on) { this.el.lb.classList.toggle('on', on); this.el.hud.classList.toggle('cine', on); }
  fade(on) { this.el.fade.style.opacity = on ? 1 : 0; }

  update(dt) {
    const g = this.g, P = g.player;
    this.shownMoney += (P.money - this.shownMoney) * Math.min(1, dt * 6);
    if (Math.abs(P.money - this.shownMoney) < 1) this.shownMoney = P.money;
    this.el.money.textContent = '$' + String(Math.round(this.shownMoney)).padStart(8, '0');
    const h = g.world.hour; this.el.clock.textContent = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
    this.el.hp.style.width = `${P.health}%`;
    this.el.hp.parentElement.classList.toggle('low', P.health < 25);
    this.el.ar.parentElement.style.display = P.armor > 0 ? 'block' : 'none';
    this.el.ar.style.width = `${P.armor}%`;
    const stars = this.el.stars.children;
    const blink = g.wantedUnseen > 2 && Math.floor(performance.now() / 300) % 2;
    for (let i = 0; i < 5; i++) { stars[i].className = i < g.wanted ? (blink ? 'on dim' : 'on') : ''; }
    this.el.weapon.innerHTML = P.weapon === 'pistol' ? `<span class="wico">🔫</span> ${P.ammo}` : '<span class="wico">✊</span>';
    this.el.cross.style.display = P.weapon === 'pistol' && !P.vehicle && !g.cutsceneActive ? 'block' : 'none';
    this.el.cross.classList.toggle('aim', !!P.aiming);
    if (P.vehicle) { this.el.speed.style.display = 'block'; this.el.speed.innerHTML = `${Math.round(Math.abs(P.vehicle.speed) * 3.6)}<small> km/h</small>`; }
    else this.el.speed.style.display = 'none';
    if (this.bigTimer > 0) { this.bigTimer -= dt; if (this.bigTimer <= 0) this.el.big.classList.remove('show'); }
    if (this.helpTimer > 0) { this.helpTimer -= dt; if (this.helpTimer <= 0) this.el.help.classList.remove('show'); }
    if (this.carTimer > 0) { this.carTimer -= dt; if (this.carTimer <= 0) this.el.car.classList.remove('show'); }
    this.drawMap();
  }

  drawMap() {
    const g = this.g, c = this.mctx, S = this.map.width, P = g.player;
    const p = P.vehicle ? P.vehicle.pos : P.pos;
    const zoom = P.vehicle ? 0.75 + Math.min(0.6, Math.abs(P.vehicle.speed) / 60) * -0.6 : 1.1;
    const scale = (S / 260) * zoom;
    const rot = g.cam.yaw;
    c.save();
    c.clearRect(0, 0, S, S);
    c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 3, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#2b6f8f'; c.fillRect(0, 0, S, S);
    c.translate(S / 2, S / 2);
    c.rotate(Math.PI + rot);
    c.scale(scale, scale);
    c.drawImage(this.mapImg, -p.x - 500, -p.z - 500);
    c.restore();
    // blips
    const toMap = (x, z) => {
      const dx = (x - p.x) * scale, dz = (z - p.z) * scale;
      const a = Math.PI + rot, ca = Math.cos(a), sa = Math.sin(a);
      let mx = dx * ca - dz * sa, my = dx * sa + dz * ca;
      const r = Math.hypot(mx, my), R = S / 2 - 12;
      let edge = false;
      if (r > R) { mx *= R / r; my *= R / r; edge = true; }
      return [S / 2 + mx, S / 2 + my, edge];
    };
    const blip = (x, z, color, size = 6, label = null) => {
      const [bx, by, edge] = toMap(x, z);
      c.fillStyle = color; c.strokeStyle = '#000'; c.lineWidth = 2;
      c.beginPath();
      if (edge) { c.arc(bx, by, size * 0.8, 0, 7); } else c.rect(bx - size / 2, by - size / 2, size, size);
      c.fill(); c.stroke();
      if (label && !edge) { c.fillStyle = '#000'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, bx, by + 0.5); }
    };
    const t = performance.now() / 1000;
    for (const car of g.cars) if (car.typeKey === 'police' && car.driverKind === 'police') blip(car.pos.x, car.pos.z, Math.floor(t * 4) % 2 ? '#ff3030' : '#3060ff', 6);
    for (const n of g.npcs) if (n.kind === 'cop' && n.alive && g.wanted > 0) blip(n.pos.x, n.pos.z, '#5a7aff', 4);
    for (const b of g.missions.blips) blip(b.pos.x, b.pos.z, b.color, b.small ? 5 : 11, b.icon || null);
    if (g.world.loc.hospital) blip(g.world.loc.hospital.x, g.world.loc.hospital.z, '#ffffff', 8, '+');
    // player arrow
    c.save(); c.translate(S / 2, S / 2);
    const h = P.vehicle ? P.vehicle.heading : P.heading;
    c.rotate(-(h - rot));
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -9); c.lineTo(6, 7); c.lineTo(0, 3); c.lineTo(-6, 7); c.closePath(); c.fill(); c.stroke();
    c.restore();
    // north marker
    const [nx, ny] = toMap(p.x, p.z - 9999);
    c.fillStyle = '#fff'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('N', nx, ny);
    c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 3, 0, 7); c.stroke();
  }
}
