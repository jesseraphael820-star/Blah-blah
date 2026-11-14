// Menus: lobby, jogar, inventário, loja, mercado, perfil, configurações e resultados.
import { GAME_NAME, WEAPONS, WEAPON_ORDER, KNIVES, SKINS, GLOVES, NADE_SKINS, ITEMS, CASES, RARITY, RARITY_ORDER, rollCase, rankOf, xpFor, AVATARS, DIFFICULTY, MODES } from './data.js';
import { MAPS, MAP_ORDER, QUALITY } from './maps.js';
import { save, persist, resetSave, owns, addItem, removeItem, isEquipped, toggleEquip, spend, addXp } from './save.js';
import { buildWeapon, buildKnife, itemModel, itemIcon, weaponIcon, knifeIcon } from './models.js';
import { LAYOUTS } from './controls.js';
import { sfx, setVolume, initAudio } from './audio.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rcol = r => RARITY[r].color;
const sellValue = it => Math.round(it.price * 0.55);
const byRarity = (a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || a.name.localeCompare(b.name);
function seeded(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export class UI {
  constructor(engine) {
    this.e = engine; this.root = document.getElementById('ui'); this.toastEl = document.getElementById('toast');
    this.play = { mode: 'competitivo', map: 'fundicao', difficulty: 'normal', team: 'auto', ...(save.settings.lastPlay || {}) };
    this.tab = { inv: 'arsenal', shop: 'caixas', market: 'ofertas' }; this.sel = null;
    this.root.addEventListener('click', e => this.click(e));
    this.root.addEventListener('input', e => this.input(e));
    addEventListener('online', () => this.cur === 'lobby' && this.show('lobby')); addEventListener('offline', () => this.cur === 'lobby' && this.show('lobby'));
  }
  boot() { this.show(save.nick ? 'lobby' : 'nick'); }
  toast(msg) { const t = this.toastEl; t.textContent = msg; t.classList.add('show'); clearTimeout(this.tt); this.tt = setTimeout(() => t.classList.remove('show'), 2200); }
  hide() { this.cur = null; this.root.style.display = 'none'; this.root.innerHTML = ''; if (!this.e.game) this.e.inspect(null); }
  show(name, keepSel) {
    this.cur = name; this.root.style.display = 'block'; if (!keepSel) this.sel = null;
    this.root.className = 'scr-' + name + (this.e.game ? ' ingame' : '');
    this.root.innerHTML = this[name]();
    if (!this.e.game) { if (['inv', 'shop', 'market'].includes(name)) this.preview(); else this.e.inspect(null); }
  }
  head(title) { return `<div class="topbar sub"><button class="btn sm" data-act="back">‹ VOLTAR</button><h2>${title}</h2><span class="coins">🪙 ${save.coins}</span></div>`; }

  // ---------- telas ----------
  nick() {
    return `<div class="modal"><div class="card center"><div class="logo big">STRIKE OPS <em>MOBILE X</em></div><p>Escolha seu nickname para começar</p>
      <input id="nick-in" maxlength="16" placeholder="Seu nickname" value="${esc(save.nick)}" autocomplete="off"><button class="btn primary" data-act="setnick">CONFIRMAR</button></div></div>`;
  }
  lobby() {
    const r = rankOf(save.rankPts), on = navigator.onLine, p = this.play;
    const mb = (to, ic, label) => `<button class="menu-btn" data-act="nav" data-to="${to}"><span>${ic}</span>${label}</button>`;
    return `<div class="topbar">
        <button class="profile-chip" data-act="nav" data-to="profile"><span class="av">${AVATARS[save.avatar]}</span><div><b>${esc(save.nick)}</b><small>Nível ${save.level} · ${r.name}</small><i class="xp"><u style="width:${save.xp / xpFor(save.level) * 100}%"></u></i></div></button>
        <div class="logo">STRIKE OPS <em>MOBILE X</em></div>
        <div class="right"><span class="conn ${on ? 'on' : ''}" title="Partidas rodam localmente contra bots">● ${on ? 'ONLINE' : 'OFFLINE'}<small>servidor local</small></span><span class="coins">🪙 ${save.coins}</span></div>
      </div>
      <div class="menu">${mb('inv', '🎒', 'INVENTÁRIO')}${mb('shop', '🛍️', 'LOJA')}${mb('market', '📈', 'MERCADO')}${mb('profile', '👤', 'PERFIL')}${mb('settings', '⚙️', 'CONFIGURAÇÕES')}</div>
      <div class="playbox"><small>${MODES[p.mode].name} · ${p.map === 'random' ? 'Mapa aleatório' : MAPS[p.map].name} · ${DIFFICULTY[p.difficulty].name}</small><button class="btn play" data-act="nav" data-to="playscr">JOGAR</button><button class="btn quick" data-act="start">▶ PARTIDA RÁPIDA</button></div>`;
  }
  playscr() {
    const p = this.play, opt = (k, v, inner, cls = '') => `<button class="opt ${cls} ${p[k] === v ? 'on' : ''}" data-act="opt" data-k="${k}" data-v="${v}">${inner}</button>`;
    return `${this.head('JOGAR')}<div class="play-grid">
      <section><h4>MODO</h4><div class="col">${Object.entries(MODES).map(([k, m]) => opt('mode', k, `<b>${m.name}</b><small>${m.desc}</small>`)).join('')}</div></section>
      <section class="grow"><h4>MAPA</h4><div class="maps">${MAP_ORDER.map(k => { const m = MAPS[k]; return opt('map', k, `<i style="background:linear-gradient(${m.sky[0]},${m.sky[1]} 55%,${m.sky[2]})"></i><b>${m.name}</b><small>${m.tag}</small>`, 'map'); }).join('')}${opt('map', 'random', '<i style="background:linear-gradient(135deg,#333,#666)">?</i><b>Aleatório</b><small>Surpresa</small>', 'map')}</div>
        <h4>DIFICULDADE DOS BOTS</h4><div class="row">${Object.entries(DIFFICULTY).map(([k, d]) => opt('difficulty', k, d.name, 'chip')).join('')}</div>
        <h4>EQUIPE</h4><div class="row">${opt('team', 'T', 'Terroristas', 'chip t')}${opt('team', 'CT', 'Contra-Terroristas', 'chip ct')}${opt('team', 'auto', 'Automático', 'chip')}</div></section>
      </div><div class="play-go"><button class="btn play" data-act="start">INICIAR PARTIDA</button></div>`;
  }
  tabs(group, list) { return `<div class="tabs">${list.map(([k, n]) => `<button class="${this.tab[group] === k ? 'on' : ''}" data-act="tab" data-g="${group}" data-v="${k}">${n}</button>`).join('')}</div>`; }
  itemCard(it, extra = '', tag = '') {
    return `<button class="item ${this.sel === it.id ? 'sel' : ''}" style="--rc:${rcol(it.rarity)}" data-act="sel" data-id="${it.id}"><img src="${itemIcon(it)}" alt="">${tag ? `<em>${tag}</em>` : ''}<b>${esc(it.name)}</b><small>${RARITY[it.rarity].name}${extra}</small></button>`;
  }
  detail(html) { return `<div class="detail">${html}</div>`; }
  itemsOf(tab) {
    const f = { skins: it => it.kind === 'w', facas: it => it.kind === 'k', equip: it => it.kind === 'g' || it.kind === 'n' }[tab];
    return Object.values(ITEMS).filter(f).sort(byRarity);
  }
  inv() {
    const t = this.tab.inv; let grid = '', det = '';
    if (t === 'arsenal') {
      if (!this.sel || !WEAPONS[this.sel]) this.sel = 'ak47';
      grid = WEAPON_ORDER.map(id => { const sk = save.equipped.skins[id] || 'padrao'; return `<button class="item ${this.sel === id ? 'sel' : ''}" style="--rc:${rcol(SKINS[sk].rarity)}" data-act="sel" data-id="${id}"><img src="${weaponIcon(id, sk)}" alt=""><b>${WEAPONS[id].name}</b><small>${SKINS[sk].name}</small></button>`; }).join('');
      const w = WEAPONS[this.sel], cur = save.equipped.skins[this.sel] || 'padrao', bar = (n, v, max) => `<div class="stat"><span>${n}</span><i><u style="width:${Math.min(100, v / max * 100)}%"></u></i><b>${v}</b></div>`;
      const skins = ['padrao', ...Object.keys(SKINS).filter(s => owns(`w:${this.sel}:${s}`))];
      det = `<h3>${w.name}</h3><small class="rar">${{ pistol: 'Pistola', rifle: 'Rifle', sniper: 'Sniper', smg: 'Submetralhadora', shotgun: 'Escopeta' }[w.type]} · $${w.price}${w.team ? ' · exclusiva ' + w.team : ''}</small>
        ${bar('Dano', w.dmg, 115)}${bar('Cadência', w.rpm, 850)}${bar('Pente', w.mag, 50)}${bar('Mobilidade', Math.round(w.speed * 100), 100)}
        <div class="chips">${skins.map(s => `<button class="chipbtn ${cur === s ? 'on' : ''}" style="--rc:${rcol(SKINS[s].rarity)}" data-act="wskin" data-s="${s}">${SKINS[s].name}</button>`).join('')}</div>`;
    } else {
      const list = this.itemsOf(t).filter(it => owns(it.id));
      if (this.sel && !list.some(i => i.id === this.sel)) this.sel = null; if (!this.sel && list[0]) this.sel = list[0].id;
      grid = list.length ? list.map(it => this.itemCard(it, '', isEquipped(it.id) ? 'EQUIPADO' : '')).join('') : `<div class="empty">Nenhum item aqui ainda.<br>Visite a <b>Loja</b> ou o <b>Mercado</b>.</div>`;
      const it = ITEMS[this.sel];
      if (it) det = `<h3 style="color:${rcol(it.rarity)}">${esc(it.name)}</h3><small class="rar">${RARITY[it.rarity].name} · valor 🪙 ${sellValue(it)}</small><button class="btn primary" data-act="equip">${isEquipped(it.id) ? 'DESEQUIPAR' : 'EQUIPAR'}</button><small class="hint">Arraste para girar · inspeção 3D</small>`;
    }
    return `${this.head('INVENTÁRIO')}<div class="split"><div class="pane">${this.tabs('inv', [['arsenal', 'Arsenal'], ['skins', 'Skins'], ['facas', 'Facas'], ['equip', 'Luvas e Granadas']])}<div class="grid">${grid}</div></div>${this.detail(det)}</div>`;
  }
  shop() {
    const t = this.tab.shop; let grid = '', det = '';
    if (t === 'caixas') {
      if (!CASES[this.sel]) this.sel = 'operacao';
      grid = Object.entries(CASES).map(([k, c]) => `<button class="item case ${this.sel === k ? 'sel' : ''}" style="--rc:#ffb02e" data-act="sel" data-id="${k}"><div class="crate">${k === 'laminas' ? '🗡️' : '📦'}</div><b>${c.name}</b><small>🪙 ${c.price}</small></button>`).join('');
      const c = CASES[this.sel];
      det = `<h3>${c.name}</h3><small class="rar">${c.desc}</small><div class="odds">${RARITY_ORDER.map(r => `<span style="color:${rcol(r)}">${RARITY[r].name} ${RARITY[r].w}%</span>`).join('')}</div><button class="btn primary" data-act="opencase">ABRIR · 🪙 ${c.price}</button>`;
    } else {
      const list = this.itemsOf(t);
      if (!ITEMS[this.sel] || !list.some(i => i.id === this.sel)) this.sel = list[0].id;
      grid = list.map(it => this.itemCard(it, ` · 🪙 ${it.price}`, owns(it.id) ? 'ADQUIRIDO' : '')).join('');
      const it = ITEMS[this.sel];
      det = `<h3 style="color:${rcol(it.rarity)}">${esc(it.name)}</h3><small class="rar">${RARITY[it.rarity].name}</small>${owns(it.id) ? '<button class="btn" disabled>ADQUIRIDO</button>' : `<button class="btn primary" data-act="buy">COMPRAR · 🪙 ${it.price}</button>`}<small class="hint">Arraste para girar · inspeção 3D</small>`;
    }
    return `${this.head('LOJA')}<div class="split"><div class="pane">${this.tabs('shop', [['caixas', 'Caixas'], ['facas', 'Facas'], ['skins', 'Skins'], ['equip', 'Luvas e Granadas']])}<div class="grid">${grid}</div></div>${this.detail(det)}</div>`;
  }
  offers() {
    const seed = Math.floor(Date.now() / (6 * 3600e3)); if (save.market.seed !== seed) { save.market.seed = seed; save.market.sold = []; persist(); }
    const r = seeded(seed * 9973), pool = Object.values(ITEMS), out = [];
    while (out.length < 10) { const it = pool[Math.floor(r() * pool.length)]; if (out.some(o => o.it === it)) continue; out.push({ it, price: Math.round(it.price * (0.55 + r() * 0.3)), seller: ['Falcão', 'Víbora', 'Lince', 'Corvo', 'Titã', 'Jaguar'][Math.floor(r() * 6)] + Math.floor(r() * 90 + 10) }); }
    return out;
  }
  market() {
    const t = this.tab.market; let grid = '', det = '';
    if (t === 'ofertas') {
      const offs = this.offers(); if (!offs.some(o => o.it.id === this.sel)) this.sel = offs[0].it.id;
      grid = offs.map(o => this.itemCard(o.it, ` · 🪙 ${o.price}`, save.market.sold.includes(o.it.id) ? 'VENDIDO' : owns(o.it.id) ? 'ADQUIRIDO' : `-${Math.round((1 - o.price / o.it.price) * 100)}%`)).join('');
      const o = offs.find(x => x.it.id === this.sel), gone = save.market.sold.includes(o.it.id) || owns(o.it.id);
      det = `<h3 style="color:${rcol(o.it.rarity)}">${esc(o.it.name)}</h3><small class="rar">${RARITY[o.it.rarity].name} · vendedor ${o.seller}</small><small>Preço de loja: <s>🪙 ${o.it.price}</s></small>${gone ? '<button class="btn" disabled>INDISPONÍVEL</button>' : `<button class="btn primary" data-act="mbuy" data-p="${o.price}">COMPRAR · 🪙 ${o.price}</button>`}<small class="hint">Ofertas renovam a cada 6 horas</small>`;
    } else {
      const list = save.inventory.map(id => ITEMS[id]).sort(byRarity);
      if (this.sel && !owns(this.sel)) this.sel = null; if (!this.sel && list[0]) this.sel = list[0].id;
      grid = list.length ? list.map(it => this.itemCard(it, ` · 🪙 ${sellValue(it)}`)).join('') : `<div class="empty">Você não tem itens para vender.</div>`;
      const it = ITEMS[this.sel];
      if (it) det = `<h3 style="color:${rcol(it.rarity)}">${esc(it.name)}</h3><small class="rar">${RARITY[it.rarity].name}</small><button class="btn danger" data-act="sell">${this.confirmSell === it.id ? 'CONFIRMAR VENDA?' : `VENDER · 🪙 ${sellValue(it)}`}</button>`;
    }
    return `${this.head('MERCADO')}<div class="split"><div class="pane">${this.tabs('market', [['ofertas', 'Ofertas'], ['vender', 'Vender']])}<div class="grid">${grid}</div></div>${this.detail(det)}</div>`;
  }
  profile() {
    const s = save.stats, r = rankOf(save.rankPts), st = (n, v) => `<div><b>${v}</b><small>${n}</small></div>`;
    const hist = save.history.length ? save.history.map(h => `<tr class="${h.won}"><td>${{ win: 'Vitória', loss: 'Derrota', draw: 'Empate', treino: 'Treino' }[h.won]}</td><td>${h.us}:${h.them}</td><td>${esc(h.map)}</td><td>${MODES[h.mode].name}</td><td>${h.kills}/${h.deaths}</td><td>${new Date(h.date).toLocaleDateString('pt-BR')}</td></tr>`).join('') : '<tr><td colspan="6">Nenhuma partida ainda</td></tr>';
    return `${this.head('PERFIL')}<div class="profile">
      <div class="card"><div class="avatars">${AVATARS.map((a, i) => `<button class="${i === save.avatar ? 'on' : ''}" data-act="avatar" data-i="${i}">${a}</button>`).join('')}</div>
        <label>Nickname<div class="row"><input id="nick-in" maxlength="16" value="${esc(save.nick)}" autocomplete="off"><button class="btn sm primary" data-act="setnick">SALVAR</button></div></label>
        <div class="lvl"><b>Nível ${save.level}</b><i class="xp"><u style="width:${save.xp / xpFor(save.level) * 100}%"></u></i><small>${save.xp} / ${xpFor(save.level)} XP</small></div>
        <div class="lvl rank"><b>🎖️ ${r.name}</b><i class="xp"><u style="width:${r.prog * 100}%"></u></i><small>Patente competitiva · ${save.rankPts} pts</small></div></div>
      <div class="card grow"><h4>ESTATÍSTICAS</h4><div class="stats">${st('Partidas', s.matches)}${st('Vitórias', s.wins)}${st('Derrotas', s.losses)}${st('Empates', s.draws)}${st('Eliminações', s.kills)}${st('Mortes', s.deaths)}${st('K/D', (s.kills / Math.max(1, s.deaths)).toFixed(2))}${st('Headshots', s.headshots)}${st('MVPs', s.mvps)}${st('Bombas plantadas', s.plants)}${st('Desarmes', s.defuses)}${st('Vitórias %', s.matches ? Math.round(s.wins / s.matches * 100) + '%' : '—')}</div>
        <h4>HISTÓRICO DE PARTIDAS</h4><div class="hist"><table>${hist}</table></div></div></div>`;
  }
  settings() {
    const s = save.settings, sl = (k, label, min, max, step) => `<label class="set"><span>${label}</span><input type="range" data-set="${k}" min="${min}" max="${max}" step="${step}" value="${s[k]}"><b>${(+s[k]).toFixed(2)}</b></label>`;
    const tg = (k, label) => `<label class="set"><span>${label}</span><button class="toggle ${s[k] ? 'on' : ''}" data-act="toggle" data-k="${k}"><i></i></button></label>`;
    const ch = (k, label, opts) => `<label class="set"><span>${label}</span><div class="seg">${opts.map(([v, n]) => `<button class="${s[k] === v ? 'on' : ''}" data-act="choose" data-k="${k}" data-v="${v}">${n}</button>`).join('')}</div></label>`;
    return `${this.head('CONFIGURAÇÕES')}<div class="settings">
      <div class="card"><h4>CONTROLES</h4>${sl('sens', 'Sensibilidade', 0.2, 3, 0.05)}${sl('adsSens', 'Sensibilidade da mira', 0.2, 2, 0.05)}${tg('gyro', 'Giroscópio')}${sl('gyroSens', 'Sensib. do giroscópio', 0.2, 3, 0.05)}${tg('invertY', 'Inverter eixo Y')}${tg('autoFire', 'Disparo automático')}
        ${ch('layout', 'Layout de HUD', Object.entries(LAYOUTS))}${sl('hudOpacity', 'Opacidade do HUD', 0.3, 1, 0.05)}<button class="btn" data-act="edithud">✎ PERSONALIZAR BOTÕES (posição e tamanho)</button></div>
      <div class="card"><h4>GRÁFICOS E ÁUDIO</h4>${ch('graphics', 'Qualidade', Object.entries(QUALITY).map(([k, q]) => [k, q.name]))}${tg('showFps', 'Mostrar FPS')}${sl('volume', 'Volume', 0, 1, 0.05)}
        ${ch('crossColor', 'Cor do retículo', [['#39ff88', 'Verde'], ['#ffffff', 'Branco'], ['#ffe23d', 'Amarelo'], ['#3de8ff', 'Ciano'], ['#ff4fd0', 'Rosa']])}
        <button class="btn" data-act="fullscreen">⛶ TELA CHEIA</button>${this.e.game ? '' : `<button class="btn danger" data-act="reset">${this.confirmReset ? 'CONFIRMAR: APAGAR TUDO?' : 'APAGAR PROGRESSO'}</button>`}
        <small class="hint">${GAME_NAME} · v1.0 · progresso salvo neste aparelho</small></div></div>`;
  }
  results() {
    const r = this.result, t = { win: 'VITÓRIA', loss: 'DERROTA', draw: 'EMPATE', treino: 'TREINO ENCERRADO' }[r.won];
    const tbl = us => `<table class="${us ? 'us' : 'them'}"><tr><th>${us ? 'SUA EQUIPE' : 'ADVERSÁRIOS'}</th><th>K</th><th>D</th><th>Pts</th></tr>${r.board.filter(c => c.us === us).sort((a, b) => b.score - a.score).map(c => `<tr class="${c.me ? 'me' : ''}"><td>${esc(c.name)}</td><td>${c.k}</td><td>${c.d}</td><td>${c.score}</td></tr>`).join('')}</table>`;
    const rk = rankOf(save.rankPts);
    return `<div class="results ${r.won}"><h1>${t}</h1><h2>${r.won === 'treino' ? `${r.kills} eliminações` : `${r.us} : ${r.them}`}</h2><small>${esc(r.map)} · ${MODES[r.mode].name} · ${r.difficulty}${r.quit ? ' · partida abandonada' : ''}</small>
      <div class="res-body"><div class="boards">${tbl(true)}${tbl(false)}</div>
      <div class="card rewards"><h4>RECOMPENSAS</h4><div class="rw"><span>Eliminações</span><b>${r.kills} (${r.hs} ☠)</b></div><div class="rw"><span>K/D</span><b>${r.kills}/${r.deaths}</b></div>${r.mvp ? '<div class="rw mvp"><span>★ MVP da partida</span><b>+60 XP</b></div>' : ''}
        <div class="rw"><span>XP</span><b>+${r.xp}</b></div><div class="rw"><span>Moedas</span><b>+🪙 ${r.coins}</b></div>${r.rank ? `<div class="rw"><span>Patente (${rk.name})</span><b class="${r.rank > 0 ? 'up' : 'down'}">${r.rank > 0 ? '+' : ''}${r.rank} pts</b></div>` : ''}
        ${r.levelUp ? `<div class="rw mvp"><span>SUBIU DE NÍVEL!</span><b>Nível ${save.level} · +🪙 ${250 * r.levelUp}</b></div>` : ''}
        <div class="lvl"><b>Nível ${save.level}</b><i class="xp"><u style="width:${save.xp / xpFor(save.level) * 100}%"></u></i></div>
        <div class="row"><button class="btn primary" data-act="start">JOGAR NOVAMENTE</button><button class="btn" data-act="nav" data-to="lobby">LOBBY</button></div></div></div></div>`;
  }

  // ---------- lógica ----------
  preview() {
    const s = this.sel, scr = this.cur; let obj = null, rar = 'comum';
    if (scr === 'inv' && this.tab.inv === 'arsenal') { const sk = save.equipped.skins[s] || 'padrao'; obj = buildWeapon(s, sk); rar = SKINS[sk].rarity; }
    else if (scr === 'shop' && this.tab.shop === 'caixas') { const [k, sk] = s === 'laminas' ? ['karambit', 'magma'] : [null, null]; obj = k ? buildKnife(k, sk) : buildWeapon('awp', 'drakon'); rar = 'lendario'; }
    else if (ITEMS[s]) { obj = itemModel(ITEMS[s]); rar = ITEMS[s].rarity; }
    this.e.inspect(obj, rar);
  }
  finishMatch(r) {
    const s = save.stats;
    if (r.won !== 'treino') { s.matches++; s[{ win: 'wins', loss: 'losses', draw: 'draws' }[r.won]]++; }
    s.kills += r.kills; s.deaths += r.deaths; s.headshots += r.hs; s.plants += r.plants; s.defuses += r.defuses; if (r.mvp) s.mvps++;
    save.coins += r.coins; save.rankPts = Math.max(0, save.rankPts + r.rank);
    save.history.unshift({ won: r.won, us: r.us, them: r.them, map: r.map, mode: r.mode, kills: r.kills, deaths: r.deaths, date: Date.now() }); save.history.length = Math.min(20, save.history.length);
    r.levelUp = addXp(r.xp); persist();
    this.result = r; this.show('results');
  }
  start() {
    const p = this.play; save.settings.lastPlay = { ...p }; persist();
    const map = p.map === 'random' ? MAP_ORDER[(Math.random() * MAP_ORDER.length) | 0] : p.map;
    this.e.startGame({ mode: p.mode, map, difficulty: p.difficulty, team: p.team });
  }
  click(e) {
    const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
    const a = el.dataset.act, d = el.dataset; initAudio(); sfx.click();
    const again = () => this.show(this.cur, true);
    switch (a) {
      case 'nav': this.show(d.to); break;
      case 'back': if (this.e.game) this.hide(); else this.show(this.cur === 'playscr' || this.cur !== 'lobby' ? 'lobby' : 'lobby'); break;
      case 'setnick': { const v = document.getElementById('nick-in').value.trim().slice(0, 16); if (v.length < 2) return this.toast('Use pelo menos 2 caracteres'); const first = !save.nick; save.nick = v; persist(); this.toast('Nickname salvo'); this.show(first ? 'lobby' : 'profile'); break; }
      case 'avatar': save.avatar = +d.i; persist(); again(); break;
      case 'opt': this.play[d.k] = d.v; again(); break;
      case 'start': this.start(); break;
      case 'tab': this.tab[d.g] = d.v; this.confirmSell = null; this.show(this.cur); break;
      case 'sel': this.sel = d.id; this.confirmSell = null; again(); break;
      case 'wskin': if (d.s === 'padrao') delete save.equipped.skins[this.sel]; else save.equipped.skins[this.sel] = d.s; persist(); this.e.lobbyRefresh(); again(); break;
      case 'equip': this.toast(toggleEquip(this.sel) ? 'Item equipado' : 'Item desequipado'); this.e.lobbyRefresh(); again(); break;
      case 'buy': { const it = ITEMS[this.sel]; if (!spend(it.price)) { sfx.deny(); return this.toast('Moedas insuficientes'); } addItem(it.id); sfx.buy(); this.toast('Compra realizada — item no inventário'); again(); break; }
      case 'mbuy': { const it = ITEMS[this.sel]; if (!spend(+d.p)) { sfx.deny(); return this.toast('Moedas insuficientes'); } addItem(it.id); save.market.sold.push(it.id); persist(); sfx.buy(); this.toast('Oferta comprada'); again(); break; }
      case 'sell': { const it = ITEMS[this.sel]; if (this.confirmSell !== it.id) { this.confirmSell = it.id; return again(); } this.confirmSell = null; removeItem(it.id); save.coins += sellValue(it); persist(); sfx.buy(); this.toast(`Vendido por 🪙 ${sellValue(it)}`); this.e.lobbyRefresh(); this.show(this.cur); break; }
      case 'opencase': this.openCase(this.sel); break;
      case 'caseok': again(); break;
      case 'toggle': { const k = d.k; save.settings[k] = !save.settings[k]; persist(); if (k === 'gyro' && save.settings.gyro) this.e.controls.requestGyro().then(ok => { if (!ok) { save.settings.gyro = false; persist(); this.toast('Giroscópio indisponível neste aparelho'); this.cur === 'settings' && again(); } }); again(); break; }
      case 'choose': save.settings[d.k] = d.v; persist(); if (d.k === 'graphics') { this.e.applyGraphics(); if (this.e.game) this.toast('Sombras mudam na próxima partida'); } if (d.k === 'layout') { save.hud = {}; persist(); this.e.controls.applyLayout(); } again(); break;
      case 'edithud': { const was = this.cur; this.root.style.display = 'none'; this.e.controls.startEdit(() => { this.root.style.display = 'block'; this.show(was); }); break; }
      case 'fullscreen': if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => this.toast('Tela cheia indisponível')); break;
      case 'reset': if (!this.confirmReset) { this.confirmReset = true; return again(); } this.confirmReset = false; resetSave(); this.e.lobbyRefresh(); this.toast('Progresso apagado'); this.show('nick'); break;
    }
  }
  input(e) {
    const k = e.target.dataset.set; if (!k) return;
    save.settings[k] = +e.target.value; e.target.nextElementSibling.textContent = (+e.target.value).toFixed(2); persist();
    if (k === 'volume') setVolume(save.settings.volume); if (k === 'hudOpacity') this.e.controls.applyLayout();
  }
  openCase(id) {
    const c = CASES[id]; if (!spend(c.price)) { sfx.deny(); return this.toast('Moedas insuficientes'); }
    const win = rollCase(id), pool = Object.values(ITEMS).filter(c.filter), strip = Array.from({ length: 34 }, (_, i) => i === 28 ? win : rollCase(id));
    const dup = owns(win.id), ov = document.createElement('div'); ov.className = 'case-ov';
    ov.innerHTML = `<div class="case-box"><h3>${c.name}</h3><div class="reel"><div class="strip">${strip.map(it => `<div class="ri" style="--rc:${rcol(it.rarity)}"><img src="${itemIcon(it)}"><small>${esc(it.name)}</small></div>`).join('')}</div><i class="mark"></i></div><div class="case-res"></div></div>`;
    this.root.appendChild(ov);
    const st = ov.querySelector('.strip'), cell = st.firstChild.getBoundingClientRect().width, reel = ov.querySelector('.reel').getBoundingClientRect().width;
    const target = 28 * cell + cell * (0.2 + Math.random() * 0.6) - reel / 2;
    let ticks = 0; const tk = setInterval(() => { sfx.tick(); if (++ticks > 34) clearInterval(tk); }, 130);
    requestAnimationFrame(() => { st.style.transition = 'transform 4.6s cubic-bezier(.08,.82,.17,1)'; st.style.transform = `translateX(${-target}px)`; });
    setTimeout(() => {
      clearInterval(tk); sfx.drop();
      if (dup) { save.coins += sellValue(win); persist(); } else addItem(win.id);
      this.sel2 = win.id; this.e.inspect(itemModel(win), win.rarity);
      ov.querySelector('.case-res').innerHTML = `<b style="color:${rcol(win.rarity)}">${esc(win.name)}</b><small>${RARITY[win.rarity].name}${dup ? ` · repetido — convertido em 🪙 ${sellValue(win)}` : ' · adicionado ao inventário'}</small><button class="btn primary" data-act="caseok">CONTINUAR</button>`;
      ov.classList.add('done');
    }, 4900);
    void pool;
  }
}
