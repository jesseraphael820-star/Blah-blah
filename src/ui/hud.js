// HUD em DOM (dinheiro, vida, estrelas, missão, velocímetro, avisos) + minimapa.

import { T, MAP, districtAt, DISTRICT_NAMES } from '../world/constants.js';
import { CATEGORIES } from '../systems/mission-data.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: $('hud'), money: $('money'), hp: $('hp-fill'), stars: $('stars'), clock: $('clock'), district: $('district'),
      mp: $('mission-panel'), mpCat: $('mp-cat'), mpName: $('mp-name'), mpObj: $('mp-obj'), mpTimer: $('mp-timer'),
      speedo: $('speedo'), spName: $('sp-name'), spVal: $('sp-val'), spDmg: $('sp-dmg'),
      prompt: $('prompt'), hint: $('hint'), toasts: $('toasts'), banner: $('banner'), fps: $('fps'),
    };
    this.cache = {};
    this.mm = $('minimap');
    this.mmg = this.mm.getContext('2d');
    this.mapImg = null;
    this.hintT = 0;
    this.starsHtml = '';
    this.el.prompt.addEventListener('pointerdown', (e) => { e.preventDefault(); game.triggerPrompt(); });
    $('btn-pause').addEventListener('click', () => game.togglePause());
    $('btn-map').addEventListener('click', () => game.ui.showPause('map'));
  }

  show(on) {
    this.el.hud.classList.toggle('hidden', !on);
  }

  set(key, el, prop, val) {
    if (this.cache[key] === val) return;
    this.cache[key] = val;
    el[prop] = val;
  }

  update(dt) {
    const g = this.game, E = this.el;
    this.set('money', E.money, 'textContent', '$' + g.money.toLocaleString('pt-BR'));
    const hpw = Math.max(0, (g.player.health / g.player.maxHealth) * 100).toFixed(0) + '%';
    if (this.cache.hp !== hpw) { this.cache.hp = hpw; E.hp.style.width = hpw; }
    // estrelas
    const lvl = g.police.level;
    const blink = lvl > 0 && !g.police.seen;
    const sk = lvl + (blink ? 'b' : '');
    if (this.cache.stars !== sk) {
      this.cache.stars = sk;
      let h = '';
      for (let i = 1; i <= 5; i++) h += `<span class="${i <= lvl ? 'on' : ''}">★</span>`;
      E.stars.innerHTML = h;
      E.stars.classList.toggle('blink', blink);
    }
    this.set('clock', E.clock, 'textContent', g.time.label());
    const p = g.playerPos();
    this.set('dist', E.district, 'textContent', DISTRICT_NAMES[districtAt(Math.floor(p.x / T), Math.floor(p.y / T))]);

    // painel de missão
    const M = g.missions.active;
    if (M) {
      if (this.cache.mpOn !== true) { this.cache.mpOn = true; E.mp.classList.remove('hidden'); }
      const cat = CATEGORIES[M.def.cat];
      this.set('mpCat', E.mpCat, 'textContent', `${cat.icon} ${cat.name}`);
      if (this.cache.mpCol !== cat.color) { this.cache.mpCol = cat.color; E.mp.style.borderLeftColor = cat.color; }
      this.set('mpName', E.mpName, 'textContent', M.def.name);
      this.set('mpObj', E.mpObj, 'textContent', g.missions.objective());
      if (M.timed) {
        const t = Math.max(0, Math.ceil(M.t));
        this.set('mpT', E.mpTimer, 'textContent', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
        const low = t <= 15;
        if (this.cache.low !== low) { this.cache.low = low; E.mpTimer.classList.toggle('low', low); }
      } else this.set('mpT', E.mpTimer, 'textContent', '');
    } else if (this.cache.mpOn !== false) { this.cache.mpOn = false; E.mp.classList.add('hidden'); }

    // velocímetro
    const v = g.player.vehicle;
    if (v) {
      if (this.cache.spOn !== true) { this.cache.spOn = true; E.speedo.classList.remove('hidden'); }
      this.set('spName', E.spName, 'textContent', v.m.name);
      this.set('spVal', E.spVal, 'textContent', String(v.kmh));
      const dw = Math.max(0, (v.hp / v.maxHp) * 100).toFixed(0) + '%';
      if (this.cache.dmg !== dw) { this.cache.dmg = dw; E.spDmg.style.width = dw; }
    } else if (this.cache.spOn !== false) { this.cache.spOn = false; E.speedo.classList.add('hidden'); }

    // prompt
    const pr = g.prompt;
    const ptxt = pr ? (g.touchOn ? `${pr.text} — toque em <b>USAR</b>` : `<b>[E]</b> ${pr.text}`) : '';
    if (this.cache.prompt !== ptxt) {
      this.cache.prompt = ptxt;
      E.prompt.innerHTML = ptxt;
      E.prompt.classList.toggle('hidden', !pr);
    }
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) E.hint.classList.add('hidden'); }
    if (g.settings.showFps) { E.fps.classList.remove('hidden'); this.set('fps', E.fps, 'textContent', `${g.fps} FPS`); }
    else E.fps.classList.add('hidden');
    this.drawMinimap();
  }

  hint(text) {
    this.el.hint.textContent = text;
    this.el.hint.classList.remove('hidden');
    this.hintT = 1.2;
  }

  toast(text, cls = '') {
    const d = document.createElement('div');
    d.className = 'toast ' + cls;
    d.textContent = text;
    this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => d.remove(), 2600);
  }

  moneyBump() {
    const m = this.el.money;
    m.classList.remove('bump');
    void m.offsetWidth;
    m.classList.add('bump');
  }

  flashStars() {
    const s = this.el.stars;
    s.classList.remove('flash');
    void s.offsetWidth;
    s.classList.add('flash');
  }

  missionBanner(name, cat) {
    const b = this.el.banner;
    b.innerHTML = `<div class="b1">${cat}</div><div class="b2">${name}</div>`;
    b.classList.remove('hidden', 'anim');
    void b.offsetWidth;
    b.classList.add('anim');
  }

  // ---------- minimapa ----------
  drawMinimap() {
    const g = this.game, ctx = this.mmg, cv = this.mm;
    if (!this.mapImg) this.mapImg = g.worldRenderer.buildMapImage(2);
    const W = cv.width, H = cv.height;
    const p = g.playerPos();
    const span = g.player.vehicle ? 70 : 52; // tiles visíveis
    const scale = W / span; // px por tile
    const cx = p.x / T, cy = p.y / T;
    ctx.fillStyle = '#0d1218';
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mapImg, (cx - span / 2) * 2, (cy - span / 2) * 2, span * 2, span * 2, 0, 0, W, H);
    const toMM = (wx, wy) => ({ x: (wx / T - cx) * scale + W / 2, y: (wy / T - cy) * scale + H / 2 });
    const clampEdge = (q) => {
      const m = 8;
      const inside = q.x >= m && q.y >= m && q.x <= W - m && q.y <= H - m;
      if (inside) return { ...q, edge: false };
      const dx = q.x - W / 2, dy = q.y - H / 2;
      const k = Math.min((W / 2 - m) / Math.abs(dx || 1e-6), (H / 2 - m) / Math.abs(dy || 1e-6));
      return { x: W / 2 + dx * k, y: H / 2 + dy * k, edge: true };
    };
    // locais fixos
    const L = g.city.locations;
    const icons = [[L.garage, 'G', '#4fa3ff'], [L.respray, 'P', '#c77dff'], [L.hospital, 'H', '#ff6b6b'], [L.police, '★', '#7aa2ff']];
    for (const [loc, ch, col] of icons) {
      const q = toMM(loc.x, loc.y);
      if (q.x < -6 || q.y < -6 || q.x > W + 6 || q.y > H + 6) continue;
      this.badge(ctx, q.x, q.y, ch, col, 6.5);
    }
    // polícia
    const t = g.time.total;
    for (const v of g.vehicles) {
      if (!v.isPolice || v.wrecked) continue;
      const q = toMM(v.x, v.y);
      if (q.x < 0 || q.y < 0 || q.x > W || q.y > H) continue;
      ctx.fillStyle = Math.floor(t * 4) % 2 ? '#ff3b3b' : '#3b7bff';
      ctx.beginPath(); ctx.arc(q.x, q.y, 3.4, 0, 7); ctx.fill();
    }
    // missões
    for (const mk of g.missions.markers()) {
      const q = clampEdge(toMM(mk.x, mk.y));
      if (mk.kind === 'giver') {
        if (q.edge) continue;
        this.badge(ctx, q.x, q.y, mk.def ? CATEGORIES[mk.def.cat].icon : '!', mk.dim ? '#777' : mk.color, 6.5);
      } else {
        ctx.fillStyle = mk.color;
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(q.x, q.y, mk.kind === 'next' ? 3.5 : 5.5, 0, 7); ctx.fill(); ctx.stroke();
      }
    }
    // jogador
    const a = g.player.vehicle ? g.player.vehicle.a : g.player.a;
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.rotate(a);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-2, 0); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // norte
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(W / 2 - 7, 2, 14, 13);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', W / 2, 9);
  }

  badge(ctx, x, y, ch, col, r) {
    ctx.fillStyle = col;
    ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#0b0d12'; ctx.font = `bold ${r * 1.4}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch, x, y + 0.5);
  }

  // Mapa completo (aba Mapa da pausa)
  drawFullMap(cv) {
    const g = this.game, ctx = cv.getContext('2d');
    if (!this.mapImg) this.mapImg = g.worldRenderer.buildMapImage(2);
    const W = cv.width, s = W / MAP;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mapImg, 0, 0, W, W);
    const L = g.city.locations;
    for (const [loc, ch, col] of [[L.garage, 'G', '#4fa3ff'], [L.respray, 'P', '#c77dff'], [L.hospital, 'H', '#ff6b6b'], [L.police, '★', '#7aa2ff']]) {
      this.badge(ctx, (loc.x / T) * s, (loc.y / T) * s, ch, col, 9);
    }
    for (const mk of g.missions.markers()) {
      const x = (mk.x / T) * s, y = (mk.y / T) * s;
      if (mk.kind === 'giver') this.badge(ctx, x, y, CATEGORIES[mk.def.cat].icon, mk.dim ? '#777' : mk.color, 9);
      else { ctx.fillStyle = mk.color; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); ctx.stroke(); }
    }
    const p = g.playerPos();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc((p.x / T) * s, (p.y / T) * s, 7, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc((p.x / T) * s, (p.y / T) * s, 2.5, 0, 7); ctx.fill();
    // nomes dos distritos
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    const labels = [['CENTRO COMERCIAL', 84, 68], ['JARDIM AURORA', 26, 60], ['DISTRITO FABRIL', 134, 40], ['PORTO VELHO', 134, 126], ['VILA DAS OFICINAS', 26, 140], ['MERCADO NOVO', 84, 134], ['ORLA', 70, 156]];
    for (const [n, x, y] of labels) {
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      const w = ctx.measureText(n).width + 8;
      ctx.fillRect(x * s - w / 2, y * s - 9, w, 17);
      ctx.fillStyle = '#e8e2d0'; ctx.fillText(n, x * s, y * s + 1);
    }
  }
}
