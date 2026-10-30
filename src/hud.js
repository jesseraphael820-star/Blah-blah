import { HALF, ROAD_W, CITIES, HIGHWAYS, ZONES, TSEG, desertMask, GANGS } from './world.js';
import { clamp } from './util.js';
import { WEATHERS } from './sky.js';

const S = 0.5; // px por metro no mapa base
const MAPPX = HALF * 2 * S;

function colorize(text) {
  const map = { y: '#f0c419', b: '#5fa8ff', r: '#ff5050', g: '#5fd35f', w: '#ffffff', p: '#c77dff' };
  return text.replace(/~([ybrgwp])~/g, (_, c) => `</span><span style="color:${map[c]}">`).replace(/^/, '<span>') + '</span>';
}

export class HUD {
  constructor(world, settings) {
    this.w = world; this.s = settings;
    const $ = (id) => document.getElementById(id);
    this.el = {
      hud: $('hud'), mini: $('minimap'), clock: $('clock'), weather: $('weather'), money: $('money'), hp: $('hp'), period: $('period'), air: $('air'), airwrap: $('airwrap'), stars: $('stars'),
      obj: $('objective'), timer: $('timer'), zone: $('zone'), veh: $('vehname'), speedo: $('speedo'), kmh: $('kmh'), unit: $('unit'), gear: $('gear'), rpm: $('rpm'),
      food: $('food'), radio: $('radio'), sub: $('subtitle'), big: $('bigmsg'), hint: $('hint'), full: $('fullmap'), lb: $('letterbox'), touch: $('touch'), title: $('cinetitle'),
    };
    this.ctx = this.el.mini.getContext('2d');
    this.zoom = 1;
    this.money = 0;
    this.shownMoney = 0;
    this.blips = [];
    this.buildMap();
  }

  buildMap() {
    const W = TSEG + 1, h = this.w.heights;
    const base = document.createElement('canvas');
    base.width = base.height = W;
    const bg = base.getContext('2d');
    const img = bg.createImageData(W, W);
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, v = h[k];
      const x = -HALF + i * 10, z = -HALF + j * 10;
      let r, g, b;
      if (v < -0.6) { const d = clamp(-v / 18, 0, 1); r = 70 - d * 30; g = 120 - d * 40; b = 165 - d * 30; }
      else {
        const dm = desertMask(x, z);
        r = 104 + dm * 90; g = 132 + dm * 40; b = 78 + dm * 10;
        if (v < 3 && x > 900) { r = 214; g = 200; b = 150; }
        if (v > 80) { const t = clamp((v - 80) / 80, 0, 1); r += (150 - r) * t; g += (145 - g) * t; b += (135 - b) * t; }
        const sh = clamp(1 + ((h[k] - (h[k - 1] ?? v)) + (h[k] - (h[k - W] ?? v))) * 0.04, 0.75, 1.2);
        r *= sh; g *= sh; b *= sh;
      }
      img.data.set([r, g, b, 255], k * 4);
    }
    bg.putImageData(img, 0, 0);
    const m = document.createElement('canvas');
    m.width = m.height = MAPPX;
    const c = m.getContext('2d');
    c.imageSmoothingEnabled = true;
    c.drawImage(base, 0, 0, MAPPX, MAPPX);
    const P = (x) => (x + HALF) * S;
    for (const ci of CITIES) {
      c.fillStyle = '#b9b6ad';
      c.fillRect(P(ci.x0), P(ci.z0), ci.size * S, ci.size * S);
    }
    for (const r of this.w.buildRects) {
      c.fillStyle = r.park ? '#6f9a52' : '#8d8a83';
      c.fillRect(P(r.x0), P(r.z0), (r.x1 - r.x0) * S, (r.z1 - r.z0) * S);
    }
    // territórios das gangues pintados na cor de cada uma
    for (const G of GANGS) {
      c.globalAlpha = 0.5; c.fillStyle = G.color;
      c.fillRect(P(G.x0), P(G.z0), (G.x1 - G.x0) * S, (G.z1 - G.z0) * S);
      c.globalAlpha = 1;
    }
    c.strokeStyle = '#0d0d0d'; c.lineCap = 'round'; c.lineJoin = 'round';
    c.lineWidth = ROAD_W * S * 1.15;
    for (const ci of CITIES) for (let i = 0; i <= ci.n; i++) {
      c.beginPath(); c.moveTo(P(ci.xs[i]), P(ci.z0)); c.lineTo(P(ci.xs[i]), P(ci.z1)); c.stroke();
      c.beginPath(); c.moveTo(P(ci.x0), P(ci.zs[i])); c.lineTo(P(ci.x1), P(ci.zs[i])); c.stroke();
    }
    c.lineWidth = ROAD_W * S * 1.5;
    for (const H of HIGHWAYS) {
      c.beginPath();
      for (let k = 0; k <= H.N; k++) (k ? c.lineTo : c.moveTo).call(c, P(H.px[k]), P(H.pz[k]));
      c.stroke();
    }
    c.strokeStyle = '#3a3a3a'; c.lineWidth = 1;
    for (const H of HIGHWAYS) {
      c.setLineDash([3, 4]);
      c.beginPath();
      for (let k = 0; k <= H.N; k++) (k ? c.lineTo : c.moveTo).call(c, P(H.px[k]), P(H.pz[k]));
      c.stroke();
    }
    c.setLineDash([]);
    this.map = m;
  }

  setVisible(v) { this.el.hud.classList.toggle('hidden', !v); }

  objective(text) {
    this.el.obj.innerHTML = text ? colorize(text) : '';
    this.el.obj.classList.toggle('show', !!text);
    clearTimeout(this._objT);
    if (text) this._objT = setTimeout(() => this.el.obj.classList.remove('show'), 9000);
  }
  hint(text, ms = 2500) {
    this.el.hint.innerHTML = text ? colorize(text) : '';
    this.el.hint.classList.toggle('show', !!text);
    clearTimeout(this._hT);
    if (text && ms) this._hT = setTimeout(() => this.el.hint.classList.remove('show'), ms);
  }
  subtitle(name, text, dur) {
    clearTimeout(this._sT);
    this.el.sub.innerHTML = text ? `<b>${name}:</b> ${text}` : '';
    this.el.sub.classList.toggle('show', !!text);
    if (text) this._sT = setTimeout(() => this.el.sub.classList.remove('show'), dur * 1000);
  }
  big(text, sub = '', ms = 3500, cls = '') {
    const b = this.el.big;
    b.className = cls;
    b.innerHTML = `<div class="t">${text}</div>${sub ? `<div class="s">${sub}</div>` : ''}`;
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(this._bT);
    this._bT = setTimeout(() => b.classList.remove('show'), ms);
  }
  zone(name) {
    const z = this.el.zone;
    z.textContent = name;
    z.classList.remove('show'); void z.offsetWidth; z.classList.add('show');
  }
  vehicle(name) {
    const v = this.el.veh;
    v.textContent = name;
    v.classList.remove('show'); void v.offsetWidth; v.classList.add('show');
  }
  radio(text) {
    const r = this.el.radio;
    r.textContent = text;
    r.classList.remove('show'); void r.offsetWidth; r.classList.add('show');
  }
  cineTitle(a, b) {
    const t = this.el.title;
    t.innerHTML = a ? `<div class="a">${a}</div><div class="b">${b}</div>` : '';
    t.classList.toggle('show', !!a);
  }
  letterbox(on) { this.el.lb.classList.toggle('on', on); }
  timer(sec) {
    const t = this.el.timer;
    if (sec == null) { t.classList.add('hidden'); return; }
    t.classList.remove('hidden');
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    t.textContent = `${m}:${String(s).padStart(2, '0')}`;
    t.classList.toggle('low', sec < 15);
  }

  update(dt, g) {
    const p = g.player, env = g.env;
    this.el.clock.textContent = env.clock();
    const W = WEATHERS[env.weather];
    this.el.weather.textContent = W ? `${W.icon} ${W[this.s.get('lang')]}` : '';
    this.shownMoney += (g.money - this.shownMoney) * Math.min(1, dt * 4);
    if (Math.abs(g.money - this.shownMoney) < 1) this.shownMoney = g.money;
    this.el.money.textContent = '$' + String(Math.round(this.shownMoney)).padStart(8, '0');
    this.el.hp.style.width = `${clamp(p.health, 0, 100)}%`;
    if (g.shops) { this.el.food.style.width = `${g.shops.data.hunger * 100}%`; this.el.food.classList.toggle('low', g.shops.data.hunger < 0.2); }
    const per = g.period;
    this.el.period.textContent = per ? per[this.s.get('lang')] : '';
    if (g.shops) {
      const under = p.swim && p.under;
      const frac = under ? p.breath / g.shops.breathMax : p.stamina / g.shops.sprintMax;
      this.el.airwrap.classList.toggle('hidden', frac > 0.99 || !!p.vehicle);
      this.el.air.style.width = `${clamp(frac, 0, 1) * 100}%`;
      this.el.air.classList.toggle('breath', under);
    }
    const st = Math.ceil(g.wanted - 0.05);
    this.el.stars.innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < st ? 'on' : ''}">★</span>`).join('');
    this.el.stars.classList.toggle('flash', g.wantedFlash > 0);
    const v = p.vehicle;
    this.el.speedo.classList.toggle('hidden', !v);
    if (v) {
      const mph = this.s.get('units') === 'mph';
      this.el.kmh.textContent = Math.round(v.speed * (mph ? 2.237 : 3.6));
      this.el.unit.textContent = mph ? 'mph' : 'km/h';
      this.el.gear.textContent = v.t.pedal ? '' : v.gear < 0 ? 'R' : v.speed < 0.3 && v.thr < 0.05 ? 'N' : v.gear;
      this.el.rpm.style.width = v.t.pedal ? `${clamp(v.speed / 13, 0, 1) * 100}%` : `${clamp(v.rpm / v.t.redline, 0, 1) * 100}%`;
      this.el.rpm.classList.toggle('red', !v.t.pedal && v.rpm > v.t.redline * 0.9);
    }
    this.el.touch.classList.toggle('hidden', g.input.scheme !== 'touch' || !g.playing);
    this.el.touch.classList.toggle('driving', !!v);
    if (g.input.scheme === 'touch') this.touchButtons(g);
    this.drawMini(g, dt);
  }

  // tela de toque organizada: cada botão só aparece quando tem uso agora
  touchButtons(g) {
    const p = g.player, v = p.vehicle, shop = g.shops && g.shops.open;
    const talking = !!g.cine || !!(g.voice && g.voice.cur);
    const show = {
      enter: v ? true : g.ui.nearCar || (g.shops && g.shops.nearShop) || shop,
      jump: !(p.swim && p.under) || shop,
      punch: !p.swim && !shop,
      sprint: !shop,
      dive: p.swim,
      weapon: !v && !p.swim && !shop && !!g.combat && g.combat.owned().length > 1,
      aim: !v && !p.swim && !shop && !!g.combat && !['fist', 'bat', 'knife'].includes(g.combat.current),
      radio: v && !v.t.pedal, lights: v && !v.t.pedal, horn: v && !v.t.pedal,
      skip: talking || shop,
    };
    if (!this.tbtn) this.tbtn = [...this.el.touch.querySelectorAll('[data-k]')];
    for (const b of this.tbtn) {
      const k = b.dataset.k;
      if (k in show) b.classList.toggle('off', !show[k]);
    }
  }

  worldToMini(x, z, px, pz, ang, zoom, R) {
    const dx = (x - px) * zoom, dz = (z - pz) * zoom;
    const c = Math.cos(-ang), s = Math.sin(-ang);
    return [R + dx * c - dz * s, R + dx * s + dz * c];
  }

  drawMini(g, dt) {
    const ctx = this.ctx, Wd = this.el.mini.width, R = Wd / 2;
    const f = g.focus;
    const camF = g.camForward;
    const ang = Math.atan2(camF.x, -camF.z);
    const spd = g.player.vehicle ? g.player.vehicle.speed : 0;
    const targetZoom = (g.player.vehicle ? 1.15 - clamp(spd / 45, 0, 1) * 0.55 : 1.35) * (Wd / 440);
    this.zoom += (targetZoom - this.zoom) * Math.min(1, dt * 2);
    const zoom = this.zoom;
    ctx.clearRect(0, 0, Wd, Wd);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R - 6, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#3d6a8c'; ctx.fillRect(0, 0, Wd, Wd);
    ctx.translate(R, R); ctx.rotate(-ang); ctx.scale(zoom / S, zoom / S);
    ctx.drawImage(this.map, -(f.x + HALF) * S, -(f.z + HALF) * S);
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R - 6, 0, Math.PI * 2); ctx.clip();
    // nomes grandes das cidades
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const c of CITIES) {
      const [sx, sy] = this.worldToMini(c.cx, c.cz, f.x, f.z, ang, zoom, R);
      if (sx < -200 || sx > Wd + 200 || sy < -60 || sy > Wd + 60) continue;
      ctx.font = `${Math.round(Wd * 0.085)}px 'Pirata One', serif`;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.strokeText(c.name, sx, sy); ctx.fillText(c.name, sx, sy);
    }
    ctx.restore();
    // blips
    for (const b of g.blips) {
      let [sx, sy] = this.worldToMini(b.x, b.z, f.x, f.z, ang, zoom, R);
      const dx = sx - R, dy = sy - R, d = Math.hypot(dx, dy), max = R - 16;
      if (d > max) { sx = R + (dx / d) * max; sy = R + (dy / d) * max; }
      ctx.fillStyle = b.color; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.beginPath();
      if (b.shape === 'sq') ctx.rect(sx - 9, sy - 9, 18, 18); else ctx.arc(sx, sy, b.r || 10, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      if (b.label) { ctx.fillStyle = '#000'; ctx.font = 'bold 14px Oswald, sans-serif'; ctx.fillText(b.label, sx, sy + 1); }
    }
    // borda + norte
    ctx.lineWidth = 10; ctx.strokeStyle = '#111';
    ctx.beginPath(); ctx.arc(R, R, R - 6, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = '#d9b54a';
    ctx.beginPath(); ctx.arc(R, R, R - 12, 0, Math.PI * 2); ctx.stroke();
    const na = -ang - Math.PI / 2;
    const nx = R + Math.cos(na) * (R - 12), ny = R + Math.sin(na) * (R - 12);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(nx, ny, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('N', nx, ny + 1);
    // jogador
    const h = g.player.vehicle ? g.player.vehicle.heading : g.player.heading;
    const pa = Math.atan2(Math.sin(h), -Math.cos(h)) - ang;
    ctx.save(); ctx.translate(R, R); ctx.rotate(pa);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(11, 12); ctx.lineTo(0, 6); ctx.lineTo(-11, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  showFullMap(g, on) {
    const cv = this.el.full;
    cv.classList.toggle('hidden', !on);
    if (!on) return;
    const sz = Math.floor(Math.min(innerWidth, innerHeight) * 0.94 * devicePixelRatio);
    cv.width = cv.height = sz;
    cv.style.width = cv.style.height = `${sz / devicePixelRatio}px`;
    const c = cv.getContext('2d');
    const k = sz / MAPPX;
    c.drawImage(this.map, 0, 0, sz, sz);
    const P = (x) => (x + HALF) * S * k;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const z of ZONES) {
      c.font = `italic ${Math.round(sz * 0.022)}px Oswald, sans-serif`;
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.fillStyle = '#e8e2c8';
      c.strokeText(z.name, P(z.x), P(z.z)); c.fillText(z.name, P(z.x), P(z.z));
    }
    for (const ci of CITIES) {
      c.font = `${Math.round(sz * (ci.kind === 'metro' ? 0.065 : 0.045))}px 'Pirata One', serif`;
      c.lineWidth = 8; c.strokeStyle = '#000'; c.fillStyle = '#fff';
      c.strokeText(ci.name, P(ci.cx), P(ci.cz)); c.fillText(ci.name, P(ci.cx), P(ci.cz));
    }
    c.font = `italic ${Math.round(sz * 0.03)}px Oswald, sans-serif`; c.fillStyle = '#cfe3f5';
    c.fillText('Oceano Sereno', P(1420), P(-200));
    for (const b of g.blips) {
      c.fillStyle = b.color; c.strokeStyle = '#000'; c.lineWidth = 3;
      c.beginPath(); c.arc(P(b.x), P(b.z), sz * 0.012, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    const f = g.focus, h = g.player.vehicle ? g.player.vehicle.heading : g.player.heading;
    c.save(); c.translate(P(f.x), P(f.z)); c.rotate(Math.atan2(Math.sin(h), -Math.cos(h)));
    const a = sz * 0.018;
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, -a); c.lineTo(a * 0.7, a * 0.8); c.lineTo(0, a * 0.4); c.lineTo(-a * 0.7, a * 0.8); c.closePath(); c.fill(); c.stroke();
    c.restore();
    c.font = `${Math.round(sz * 0.022)}px Oswald, sans-serif`; c.fillStyle = '#fff'; c.textAlign = 'right';
    c.fillText(this.s.get('lang') === 'pt' ? 'M / Esc para fechar' : 'M / Esc to close', sz - 20, sz - 24);
    c.textAlign = 'left'; c.font = `${Math.round(sz * 0.05)}px 'Pirata One', serif`;
    c.lineWidth = 6; c.strokeStyle = '#000'; c.strokeText('FTA 1', 20, 40); c.fillText('FTA 1', 20, 40);
  }
}
