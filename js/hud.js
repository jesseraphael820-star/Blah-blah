// HUD da partida: placar, radar, vida, munição, kill feed, menu de compra, placar completo e pausa.
import { WEAPONS, WEAPON_ORDER, GRENADES, GRENADE_ORDER, EQUIPMENT, BUY_CATS, KNIVES } from './data.js';
import { weaponIcon, knifeIcon } from './models.js';
import { save } from './save.js';
import { sfx } from './audio.js';
import { WORLD_HALF } from './maps.js';

const $ = (el, q) => el.querySelector(q);
const fmt = t => { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const TEAM = { T: 'Terroristas', CT: 'Contra-Terroristas' };

export class Hud {
  constructor(game, root) {
    this.g = game; this.root = root; root.style.display = 'block';
    root.innerHTML = `
      <div class="h-top"><div class="h-team ct"><span class="h-alive"></span><b></b></div><div class="h-timer"><b>0:00</b><small></small></div><div class="h-team t"><b></b><span class="h-alive"></span></div></div>
      <canvas class="h-radar" width="160" height="160"></canvas><div class="h-money"></div><div class="h-bomb"></div>
      <div class="h-feed"></div><button class="h-pause pe">❚❚</button>
      <div class="h-vitals"><span class="hp"></span><span class="ar"></span></div>
      <div class="h-weap"><div class="h-slots pe"></div><div class="h-ammo"><b></b><span></span></div><div class="h-wname"></div></div>
      <div class="h-cross"><i></i><i></i><i></i><i></i><u></u></div><div class="h-hit"></div><div class="h-scope"></div>
      <div class="h-dmg"></div><div class="h-dir"><i></i></div><div class="h-flash"></div>
      <div class="h-msg"><b></b><span></span></div><div class="h-hint"></div><div class="h-prog"><i></i></div><div class="h-spec"></div><div class="h-fps"></div>
      <div class="h-buy overlay pe"></div><div class="h-score overlay pe"></div><div class="h-pm overlay pe"></div>`;
    const q = s => $(root, s);
    this.el = { ct: q('.h-team.ct'), t: q('.h-team.t'), timer: q('.h-timer b'), round: q('.h-timer small'), radar: q('.h-radar'), money: q('.h-money'), bomb: q('.h-bomb'), feed: q('.h-feed'),
      hp: q('.hp'), ar: q('.ar'), slots: q('.h-slots'), ammo: q('.h-ammo b'), res: q('.h-ammo span'), wname: q('.h-wname'), cross: q('.h-cross'), hit: q('.h-hit'), scope: q('.h-scope'), dmg: q('.h-dmg'), dir: q('.h-dir'),
      flash: q('.h-flash'), msg: q('.h-msg'), hint: q('.h-hint'), prog: q('.h-prog'), spec: q('.h-spec'), fps: q('.h-fps'), buy: q('.h-buy'), score: q('.h-score'), pm: q('.h-pm') };
    this.rctx = this.el.radar.getContext('2d'); this.rimg = game.world.radarImage(160);
    this.el.cross.style.setProperty('--c', save.settings.crossColor);
    q('.h-pause').onclick = () => this.togglePause();
    this.el.slots.addEventListener('pointerdown', e => { const s = e.target.closest('[data-slot]'); if (s) { e.stopPropagation(); game.selectSlot(s.dataset.slot); } });
    this.msgT = 0; this.dmgA = 0; this.flashA = 0; this.flashHold = 0; this.hitT = 0; this.sig = ''; this.buyCat = 'pistol'; this.fpsT = 0; this.frames = 0; this.cache = {};
  }
  set(k, v) { if (this.cache[k] !== v) { this.cache[k] = v; return true; } return false; }
  destroy() { this.root.innerHTML = ''; this.root.style.display = 'none'; }
  get open() { return this.buyOpen || this.pauseOpen; }

  roundStart() { this.el.feed.innerHTML = ''; this.closeBuy(); this.toggleScore(false); this.flash(0); }
  msg(title, sub, dur = 3, cls = '') { const m = this.el.msg; m.className = 'h-msg show ' + cls; m.children[0].textContent = title; m.children[1].textContent = sub; this.msgT = dur; }
  hit(head) { this.el.hit.className = 'h-hit show' + (head ? ' head' : ''); this.hitT = 0.18; }
  hurt(ang) {
    this.dmgA = Math.min(1, this.dmgA + 0.5);
    if (ang !== null) { const y = this.g.player.yaw, dx = Math.sin(ang), dz = Math.cos(ang), rel = Math.atan2(dx * Math.cos(y) - dz * Math.sin(y), -dx * Math.sin(y) - dz * Math.cos(y)); this.el.dir.style.transform = `rotate(${rel}rad)`; this.dirT = 1; }
  }
  flash(dur) { this.flashHold = dur * 0.55; this.flashA = dur > 0 ? 1 : 0; this.flashFade = Math.max(0.3, dur * 0.45); }
  kill(k, v, wid, head) {
    const me = this.g.player, name = c => `<span class="${c.team === me.team ? 'us' : 'them'}${c.isPlayer ? ' me' : ''}">${c.name}</span>`;
    const w = WEAPONS[wid]?.name ?? ({ knife: 'Faca', he: 'Explosiva', fire: 'Fogo', bomb: 'Bomba' }[wid] || '');
    const d = document.createElement('div'); d.innerHTML = `${k ? name(k) : ''} <em>${w}${head ? ' ☠' : ''}</em> ${name(v)}`; if (k?.isPlayer || v.isPlayer) d.className = 'mine';
    this.el.feed.appendChild(d); while (this.el.feed.children.length > 5) this.el.feed.firstChild.remove();
    setTimeout(() => d.remove(), 6000);
  }

  // ---------- menu de compra ----------
  toggleBuy() { this.buyOpen ? this.closeBuy() : this.openBuy(); }
  openBuy() {
    const g = this.g; if (!g.canBuy()) { this.msg('', 'A loja só abre no início do round', 1.5); sfx.deny(); return; }
    this.buyOpen = true; this.el.buy.classList.add('show'); document.exitPointerLock?.(); g.engine.controls.reset(); this.renderBuy();
  }
  closeBuy() { if (!this.buyOpen) return; this.buyOpen = false; this.el.buy.classList.remove('show'); this.g.engine.controls.lock(); }
  renderBuy() {
    const g = this.g, p = g.player, cat = this.buyCat; let items = '';
    const card = (kind, id, icon, name, price, desc, off, own) => `<button class="b-item${off ? ' off' : ''}${own ? ' own' : ''}" data-kind="${kind}" data-id="${id}">${icon}<b>${name}</b><small>${desc || ''}</small><span>${own ? 'EQUIPADO' : '$' + price}</span></button>`;
    if (cat === 'grenade') for (const id of GRENADE_ORDER) { const n = GRENADES[id]; items += card('nade', id, `<div class="emo">${n.icon}</div>`, n.name, n.price, n.desc, p.money < n.price, p.weapons.nades[id] > 0); }
    else if (cat === 'equip') for (const id in EQUIPMENT) { const e = EQUIPMENT[id], own = id === 'kit' ? p.kit : id === 'vest' ? p.armor >= 100 : p.armor >= 100 && p.helmet; items += card('equip', id, `<div class="emo">${e.icon}</div>`, e.name, e.price, e.desc, p.money < e.price || (e.team && e.team !== p.team), own); }
    else for (const id of WEAPON_ORDER) { const w = WEAPONS[id]; if (w.type !== cat) continue; const own = p.weapons.primary?.id === id || p.weapons.secondary?.id === id; items += card('weapon', id, `<img src="${weaponIcon(id, save.equipped.skins[id] || 'padrao')}">`, w.name, w.price, w.team && w.team !== p.team ? `Exclusiva ${w.team}` : `Dano ${w.dmg} · ${w.rpm} tpm`, p.money < w.price || (w.team && w.team !== p.team), own); }
    this.el.buy.innerHTML = `<div class="b-box"><div class="b-head"><b>LOJA DE EQUIPAMENTOS</b><span class="b-money">$${p.money}</span><button class="btn sm b-close">FECHAR ✕</button></div>
      <div class="b-body"><div class="b-cats">${BUY_CATS.map(c => `<button class="${c.id === cat ? 'on' : ''}" data-cat="${c.id}">${c.name}</button>`).join('')}</div><div class="b-items">${items}</div></div></div>`;
    this.el.buy.onclick = e => {
      const c = e.target.closest('[data-cat]'), it = e.target.closest('.b-item');
      if (e.target.closest('.b-close') || e.target === this.el.buy) return this.closeBuy();
      if (c) { this.buyCat = c.dataset.cat; sfx.click(); this.renderBuy(); }
      else if (it) { g.buy(it.dataset.kind, it.dataset.id); this.renderBuy(); }
    };
  }

  // ---------- placar ----------
  toggleScore(on = !this.scoreOpen) {
    this.scoreOpen = on; this.el.score.classList.toggle('show', on); if (!on) return;
    const g = this.g, p = g.player, tbl = team => {
      const rows = g.all.filter(c => c.team === team).sort((a, b) => b.kills - a.kills).map(c => `<tr class="${c.isPlayer ? 'me' : ''}${c.alive ? '' : ' dead'}"><td>${c.alive ? '' : '☠ '}${c.name}${c.hasBomb && team === p.team ? ' 💣' : ''}</td><td>${c.kills}</td><td>${c.deaths}</td><td>${team === p.team ? '$' + c.money : ''}</td></tr>`).join('');
      return `<table class="${team.toLowerCase()}"><tr><th>${TEAM[team]} — ${team === p.team ? g.score.us : g.score.them}</th><th>K</th><th>D</th><th>$</th></tr>${rows}</table>`;
    };
    this.el.score.innerHTML = `<div class="s-box"><h3>${g.world.def.name} · ${g.mode.name} · ${g.diff.name}</h3>${tbl('CT')}${tbl('T')}<button class="btn sm s-close">FECHAR</button></div>`;
    this.el.score.onclick = e => { if (e.target.closest('.s-close') || e.target === this.el.score) this.toggleScore(false); };
  }
  // ---------- pausa ----------
  togglePause(on = !this.pauseOpen) {
    const g = this.g; if (g.phase === 'over') return;
    if (this.buyOpen && on) return this.closeBuy();
    this.pauseOpen = on; g.paused = on; this.el.pm.classList.toggle('show', on);
    if (!on) { g.engine.controls.lock(); return; }
    document.exitPointerLock?.(); g.engine.controls.reset();
    this.el.pm.innerHTML = `<div class="p-box"><h2>PAUSADO</h2><button class="btn primary" data-a="resume">CONTINUAR</button><button class="btn" data-a="settings">CONFIGURAÇÕES</button><button class="btn" data-a="hud">EDITAR HUD</button><button class="btn danger" data-a="quit">SAIR DA PARTIDA</button>${g.engine.controls.isTouch ? '' : '<small class="hint">Teclado: WASD mover · Mouse mirar/atirar · R recarregar · Q trocar · G granada · E interagir · B loja · Tab placar · Espaço pular · Ctrl agachar · Shift andar</small>'}</div>`;
    this.el.pm.onclick = e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; sfx.click();
      if (a === 'resume') this.togglePause(false);
      else if (a === 'settings') g.engine.openSettings();
      else if (a === 'hud') { this.el.pm.classList.remove('show'); g.engine.controls.startEdit(() => this.el.pm.classList.add('show')); }
      else if (a === 'quit') { this.pauseOpen = false; g.paused = false; this.el.pm.classList.remove('show'); g.finish(true); }
    };
  }

  update(dt) {
    const g = this.g, p = g.player, e = this.el, me = p.team;
    if (this.set('sc', g.score.us + ':' + g.score.them + me)) { e.ct.querySelector('b').textContent = me === 'CT' ? g.score.us : g.score.them; e.t.querySelector('b').textContent = me === 'T' ? g.score.us : g.score.them; e.ct.classList.toggle('mine', me === 'CT'); e.t.classList.toggle('mine', me === 'T'); }
    const aT = g.alive('T'), aC = g.alive('CT');
    if (this.set('al', aT + ':' + aC)) { e.ct.querySelector('span').textContent = '●'.repeat(aC); e.t.querySelector('span').textContent = '●'.repeat(aT); }
    const planted = g.bomb.state === 'planted';
    const tt = g.training ? '∞' : planted && g.phase === 'live' ? '💣' : fmt(g.timer);
    if (this.set('tm', tt + planted)) { e.timer.textContent = tt; e.timer.classList.toggle('bomb', planted); }
    if (this.set('rd', g.round + g.phase)) e.round.textContent = g.training ? 'TREINO' : g.phase === 'freeze' ? 'COMPRA' : `ROUND ${g.round}`;
    if (this.set('mo', p.money)) e.money.textContent = '$' + p.money;
    const bs = p.hasBomb ? '💣 Você tem a bomba' : planted ? `💣 Plantada no ${g.bomb.site}` : g.bomb.state === 'dropped' && me === 'T' ? '💣 Bomba no chão' : '';
    if (this.set('bs', bs)) { e.bomb.textContent = bs; e.bomb.style.display = bs ? '' : 'none'; }
    if (this.set('hp', p.hp)) { e.hp.textContent = '✚ ' + Math.max(0, p.hp); e.hp.classList.toggle('low', p.hp <= 30); }
    const ar = Math.round(p.armor) + (p.helmet ? 'h' : '') + (p.kit ? 'k' : '');
    if (this.set('ar', ar)) e.ar.textContent = `${p.helmet ? '⛑' : '⛨'} ${Math.round(p.armor)}${p.kit ? ' 🧰' : ''}`;
    // armas
    const gun = g.gun, W = g.W, nades = GRENADE_ORDER.filter(k => p.weapons.nades[k] > 0);
    const sig = [p.weapons.primary?.id, p.weapons.secondary?.id, nades.join(), p.hasBomb, p.cur, p.curNade].join('|');
    if (this.set('sig', sig)) {
      const [kn, ks] = save.equipped.knife.split(':'); let h = '';
      const slot = (s, inner, on) => `<div class="slot${on ? ' on' : ''}" data-slot="${s}">${inner}</div>`;
      if (p.weapons.primary) h += slot('primary', `<img src="${weaponIcon(p.weapons.primary.id, save.equipped.skins[p.weapons.primary.id] || 'padrao')}">`, p.cur === 'primary');
      h += slot('secondary', `<img src="${weaponIcon(p.weapons.secondary.id, save.equipped.skins[p.weapons.secondary.id] || 'padrao')}">`, p.cur === 'secondary');
      h += slot('knife', `<img src="${knifeIcon(kn, ks)}">`, p.cur === 'knife');
      if (nades.length) h += slot('nade', nades.map(n => `<span class="${p.cur === 'nade' && p.curNade === n ? 'cur' : ''}">${GRENADES[n].icon}</span>`).join(''), p.cur === 'nade');
      if (p.hasBomb) h += slot('bomb', '💣', p.cur === 'bomb');
      e.slots.innerHTML = h;
      e.wname.textContent = W ? (p.cur === 'knife' ? KNIVES[kn].name : W.name) : p.cur === 'nade' ? 'Granada ' + GRENADES[p.curNade].name : 'C4';
    }
    const am = gun ? gun.ammo + '/' + (g.training ? '∞' : gun.reserve) + (g.reloadT > 0) : '';
    if (this.set('am', am)) { e.ammo.textContent = gun ? (g.reloadT > 0 ? '…' : gun.ammo) : ''; e.res.textContent = gun ? '/ ' + (g.training ? '∞' : gun.reserve) : ''; e.ammo.classList.toggle('low', !!gun && gun.ammo <= W.mag * 0.25); }
    // retículo
    const sp = Math.hypot(p.vel.x, p.vel.z), gap = 4 + Math.min(1, sp / 4.5) * 9 + Math.min(g.shots, 10) * 1.6 + (p.onGround ? 0 : 8);
    e.cross.style.setProperty('--g', gap.toFixed(1) + 'px');
    const showCross = p.alive && !g.scoped && !this.open;
    if (this.set('cr', showCross + ':' + g.aimOn)) { e.cross.style.display = showCross ? '' : 'none'; e.cross.classList.toggle('enemy', g.aimOn); }
    if (this.set('scp', g.scoped)) e.scope.classList.toggle('show', g.scoped);
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) e.hit.className = 'h-hit'; }
    // dano / flash
    this.dmgA = Math.max(0, this.dmgA - dt * 1.4); e.dmg.style.opacity = this.dmgA;
    if (this.dirT > 0) { this.dirT -= dt; e.dir.style.opacity = Math.max(0, this.dirT); }
    if (this.flashA > 0) { if (this.flashHold > 0) this.flashHold -= dt; else this.flashA = Math.max(0, this.flashA - dt / this.flashFade); }
    if (this.set('fl', this.flashA.toFixed(2))) e.flash.style.opacity = this.flashA;
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) e.msg.classList.remove('show'); }
    if (this.set('hint', g.hint || '')) { e.hint.textContent = g.hint || ''; e.hint.style.display = g.hint ? '' : 'none'; }
    // barra de progresso (plantar/desarmar)
    const b = g.bomb; let pr = 0;
    if (g.useT > 0) pr = g.useT / g.useNeed; else if (b.defuser && b.state === 'planted') pr = b.defuseT / b.defuseNeed;
    if (this.set('pr', pr > 0)) e.prog.style.display = pr > 0 ? '' : 'none';
    if (pr > 0) e.prog.firstChild.style.width = Math.min(100, pr * 100) + '%';
    const spec = !p.alive ? (g.spec ? `Assistindo: ${g.spec.name}` : g.training ? 'Renascendo…' : 'Você foi eliminado') : '';
    if (this.set('spec', spec)) { e.spec.textContent = spec; e.spec.style.display = spec ? '' : 'none'; }
    this.radar();
    if (save.settings.showFps) { this.frames++; this.fpsT += dt; if (this.fpsT >= 0.5) { e.fps.textContent = Math.round(this.frames / this.fpsT) + ' FPS'; this.frames = 0; this.fpsT = 0; } } else if (e.fps.textContent) e.fps.textContent = '';
    if (this.buyOpen && !g.canBuy()) this.closeBuy();
  }
  radar() {
    this.rT = (this.rT || 0) + 1; if (this.rT % 3) return;
    const c = this.rctx, g = this.g, p = g.player, s = 160 / (2 * WORLD_HALF), X = v => (v + WORLD_HALF) * s;
    c.clearRect(0, 0, 160, 160); c.drawImage(this.rimg, 0, 0);
    for (const b of g.bots) {
      if (!b.alive) continue; const mate = b.team === p.team; if (!mate && !b.spotted) continue;
      c.fillStyle = mate ? '#4cc3ff' : '#ff4040'; c.beginPath(); c.arc(X(b.pos.x), X(b.pos.z), 3.4, 0, 7); c.fill();
      if (b.hasBomb && mate) { c.strokeStyle = '#ffd23d'; c.lineWidth = 1.5; c.stroke(); }
    }
    const bm = g.bomb; if (bm.state === 'planted' || (bm.state === 'dropped' && p.team === 'T')) { c.fillStyle = '#ffd23d'; c.fillRect(X(bm.pos.x) - 3, X(bm.pos.z) - 3, 6, 6); }
    const src = p.alive ? p : g.spec; if (!src) return;
    c.save(); c.translate(X(src.pos.x), X(src.pos.z)); c.rotate(-src.yaw); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -6); c.lineTo(4, 4); c.lineTo(-4, 4); c.fill(); c.restore();
  }
}
