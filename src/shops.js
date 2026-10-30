import * as THREE from 'three';
import { ui } from './i18n.js';
import { groundAt } from './world.js';
import { clamp } from './util.js';

const KEY = 'fta1_player';
// tempo de jogo (s) até cada lugar abrir
export const PLACES = [
  { id: 'clothes', name: 'Moda Sereno', x: 568.5, z: 545, unlockAt: 150, color: '#e05ab8', icon: 'R', face: Math.PI / 2 },
  { id: 'gym', name: 'Academia Força Bruta', x: 731.5, z: 455, unlockAt: 330, color: '#f08a24', icon: 'A', face: -Math.PI / 2 },
  { id: 'food', name: 'Lanchonete do Zé', x: 478.5, z: 455, unlockAt: 0, color: '#ffcc33', icon: 'L', face: Math.PI / 2 },
  { id: 'food2', kind: 'food', name: 'Pastelaria Serrana', x: -649.5, z: 650, unlockAt: 0, color: '#ffcc33', icon: 'L', face: Math.PI / 2 },
  { id: 'dealer', name: 'Auto Sereno Veículos', x: 821.5, z: 635, unlockAt: 60, color: '#4cc3ff', icon: 'V', face: -Math.PI / 2 },
  { id: 'guns', name: 'Armas do Tonhão', x: 658.5, z: 365, unlockAt: 240, color: '#ff4a4a', icon: 'T', face: Math.PI / 2 },
  { id: 'house', name: 'Casa à venda', x: 388.5, z: 725, unlockAt: 0, color: '#7cff7c', icon: 'H', face: Math.PI / 2 },
];
// comida: fome que mata (0–1) e quanto engorda
const FOOD = [
  { pt: 'Pastel de carne', en: 'Meat pastry', price: 5, fill: 0.25, fat: 0.025 },
  { pt: 'X-tudo + refri', en: 'Loaded burger + soda', price: 12, fill: 0.55, fat: 0.07 },
  { pt: 'Prato feito', en: 'Rice & beans plate', price: 10, fill: 0.6, fat: 0.03 },
  { pt: 'Salada de frutas', en: 'Fruit salad', price: 8, fill: 0.3, fat: -0.03 },
];
export const DEALER = [
  { type: 'moto', color: 0x111111, price: 600 }, { type: 'sedan', color: 0x7a1f4d, price: 900 },
  { type: 'pickup', color: 0x2f6b3a, price: 1600 }, { type: 'sport', color: 0xf0b429, price: 5000 },
  { type: 'jetski', color: 0xff5a1f, price: 1200 }, { type: 'boat', color: 0x1d3f8a, price: 2500 },
];
export const GUNS = {
  bat: { pt: 'Taco de beisebol', en: 'Baseball bat', price: 40 },
  knife: { pt: 'Faca', en: 'Knife', price: 60 },
  pistol: { pt: 'Pistola (+34 balas)', en: 'Pistol (+34 rounds)', price: 350, ammo: 34, ammoPrice: 40 },
  shotgun: { pt: 'Escopeta (+16 cartuchos)', en: 'Shotgun (+16 shells)', price: 900, ammo: 16, ammoPrice: 60 },
};
export const HOUSE_PRICE = 1500;

const CATALOG = {
  shirt: { pt: 'Camisa', en: 'Shirt', items: [[0xf4f4f4, 0], [0x1f4e8c, 40], [0xb3261e, 40], [0x2f6b3a, 40], [0xf0b429, 60], [0x6a2c70, 60], [0x111111, 80], [0xd9661f, 50], [0x7fb3d5, 50]] },
  pants: { pt: 'Calça', en: 'Pants', items: [[0x1f3a6b, 0], [0x1b1b1b, 50], [0x5a4632, 50], [0x7a7a7a, 45], [0x3d5a40, 60], [0xc8b88a, 70]] },
  cap: { pt: 'Boné', en: 'Cap', items: [[null, 0], [0x111111, 30], [0xb3261e, 30], [0x2f6b3a, 30], [0x1f4e8c, 30], [0xf0b429, 45]] },
  chain: { pt: 'Corrente de ouro', en: 'Gold chain', items: [[false, 0], [true, 150]] },
};

export class Shops {
  constructor(game) {
    this.g = game;
    this.data = { look: { skin: 0x6b4226, shirt: 0xf4f4f4, pants: 0x1f3a6b, hair: 0x111111, chain: true, cap: null }, muscle: 0, stamina: 0, owned: { chain_1: true }, unlocked: {}, played: 0, hunger: 1, fat: 0, house: false, cars: [], weapons: {}, ammo: {} };
    try { Object.assign(this.data, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* sem armazenamento */ }
    this.el = document.getElementById('shop');
    this.open = null;
    this.markers = {};
    this.saveT = 0;
    if (this.data.house) PLACES.find((p) => p.id === 'house').name = 'Sua Casa';
    for (const p of PLACES) this.buildFront(p);
    for (const p of PLACES) if (this.data.unlocked[p.id]) this.reveal(p, false);
  }

  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignora */ } }
  lang() { return this.g.settings.get('lang'); }

  buildFront(p) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = '#111'; c.fillRect(0, 0, 512, 128);
    c.strokeStyle = p.color; c.lineWidth = 8; c.strokeRect(6, 6, 500, 116);
    c.fillStyle = p.color; c.font = 'bold 54px Oswald, Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(p.name.toUpperCase(), 256, 68);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const y = groundAt(p.x, p.z);
    const grp = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(6, 1.5, 0.15), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.6 }));
    board.position.y = 4;
    const legM = new THREE.MeshStandardMaterial({ color: 0x333333 });
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.3, 0.15), legM); l.position.set(s * 2.6, 1.65, 0); grp.add(l); }
    grp.add(board);
    grp.position.set(p.x + Math.sin(p.face) * 1.6, y, p.z + Math.cos(p.face) * 1.6);
    grp.rotation.y = p.face;
    this.g.scene.add(grp);
    p.signMat = board.material;
  }

  reveal(p, announce) {
    this.data.unlocked[p.id] = true;
    this.g.addBlip({ id: 'shop_' + p.id, x: p.x, z: p.z, color: p.color, shape: 'sq', label: p.icon, keep: true });
    if (!this.markers[p.id]) this.markers[p.id] = this.g.addMarker(p.x, p.z, new THREE.Color(p.color).getHex(), 1.1);
    this.g.markers = this.g.markers.filter((m) => m !== this.markers[p.id]);
    this.permanent = this.permanent || [];
    this.permanent.push(this.markers[p.id]);
    if (announce) {
      this.g.hud.hint(ui('unlocked', this.lang(), { n: p.name }), 7000);
      this.g.hud.big(p.name, this.lang() === 'pt' ? 'agora está aberta!' : 'is now open!', 4000);
      this.g.audio.jingle();
      this.g.input.rumble(0.3, 0.3, 200);
    }
    this.save();
  }

  // stats para o resto do jogo
  get sprintMax() { return (5 + this.data.stamina * 15) * (1 - this.data.fat * 0.5); }
  get breathMax() { return 15 + this.data.stamina * 25; }

  update(dt, inp) {
    const g = this.g;
    if (!g.locked) this.data.played += dt;
    // fome: esvazia em ~15 min de jogo; com fome demais a vida cai
    const d = this.data;
    if (!g.locked && !this.open) {
      const before = d.hunger;
      d.hunger = Math.max(0, d.hunger - dt / 900);
      if (before > 0.2 && d.hunger <= 0.2) g.hud.hint(ui('hungry', this.lang()), 5000);
      if (before > 0 && d.hunger <= 0) g.hud.hint(ui('starving', this.lang()), 5000);
      if (d.hunger <= 0) g.player.health -= dt * 0.6;
      // correr queima gordura
      if (g.player.sprinting && d.fat > 0) { d.fat = Math.max(0, d.fat - dt * 0.0015); this.fatDirty = (this.fatDirty || 0) + dt; }
      if (this.fatDirty > 20) { this.fatDirty = 0; g.setPlayerLook(d.look, d.muscle); }
    }
    this.saveT -= dt;
    if (this.saveT <= 0) { this.saveT = 10; this.save(); }
    for (const p of PLACES) {
      if (!this.data.unlocked[p.id] && this.data.played >= p.unlockAt) this.reveal(p, p.unlockAt > 0);
    }
    for (const m of this.permanent || []) m.children[1].position.y = 0.2 + Math.sin(g.simTime * 3) * 0.15;
    if (this.open) { this.menuInput(dt, inp); return true; }
    this.nearShop = false;
    if (g.player.vehicle || g.locked) return false;
    for (const p of PLACES) {
      const d = Math.hypot(g.player.pos.x - p.x, g.player.pos.z - p.z);
      if (d > 1.6) continue;
      if (!this.data.unlocked[p.id]) { if (!this._closedHint) { g.hud.hint(ui('closed', this.lang(), { n: p.name }), 3000); this._closedHint = true; } continue; }
      this.nearShop = true;
      if (!this._hint) { g.hud.hint(ui('enterShop', this.lang(), { n: p.name, k: g.input.scheme === 'gamepad' ? 'Y' : g.input.scheme === 'touch' ? '🚗' : 'F' }), 2500); this._hint = true; }
      if (inp.enter) { inp.enter = false; this.show(p); return true; }
      return false;
    }
    this._hint = false; this._closedHint = false;
    return false;
  }

  // ------------------------------------------------ menus
  show(p) {
    this.open = p;
    this.sel = 0;
    this.g.player.vel.set(0, 0, 0);
    document.exitPointerLock?.();
    this.el.classList.remove('hidden');
    if (p.id === 'clothes') this.renderClothes();
    else if (p.id === 'gym') { this.gym = { t: 0, reps: 0, power: 0, active: false }; this.renderGym(); }
    else if (p.id === 'food' || p.kind === 'food') this.renderFood();
    else if (p.id === 'dealer') this.renderDealer();
    else if (p.id === 'guns') this.renderGuns();
    else if (p.id === 'house') this.renderHouse();
  }
  close() {
    this.open = null;
    this.el.classList.add('hidden');
    this.save();
    this.g.input.wantLock = true;
  }

  renderClothes() {
    const L = this.lang(), d = this.data;
    const rows = Object.entries(CATALOG).map(([k, cat]) => {
      const items = cat.items.map(([val, price], i) => {
        const id = `${k}_${i}`;
        const owned = price === 0 || d.owned[id];
        const sw = val === null || val === false ? '∅' : val === true ? '⛓' : '';
        const bg = typeof val === 'number' ? `#${val.toString(16).padStart(6, '0')}` : '#333';
        const on = d.look[k] === val || (k === 'cap' && val === null && !d.look.cap);
        return `<button class="sw ${on ? 'on' : ''}" data-k="${k}" data-i="${i}" style="background:${bg}">${sw}<em>${owned ? '' : '$' + price}</em></button>`;
      }).join('');
      return `<div class="cat"><b>${cat[L]}</b><div class="items">${items}</div></div>`;
    }).join('');
    this.el.innerHTML = `<div class="shopbox"><div class="stitle">${this.open.name}</div><div class="money">$${Math.round(this.g.money)}</div>${rows}<button class="close">${L === 'pt' ? 'Sair da loja' : 'Leave shop'}</button></div>`;
    this.el.querySelectorAll('.sw').forEach((b) => (b.onclick = () => this.buy(b.dataset.k, +b.dataset.i)));
    this.el.querySelector('.close').onclick = () => this.close();
  }
  buy(k, i) {
    const [val, price] = CATALOG[k].items[i];
    const id = `${k}_${i}`, d = this.data;
    if (price > 0 && !d.owned[id]) {
      if (this.g.money < price) { this.g.hud.hint(this.lang() === 'pt' ? 'Dinheiro insuficiente.' : 'Not enough money.', 2000); return; }
      this.g.money -= price;
      d.owned[id] = true;
      this.g.audio.jingle();
    }
    d.look[k] = val;
    this.g.setPlayerLook(d.look, d.muscle);
    this.renderClothes();
  }

  // ------------------------------------------------ lista genérica (nome, preço, ação)
  renderList(rows, note = '') {
    const L = this.lang();
    this.el.innerHTML = `<div class="shopbox"><div class="stitle">${this.open.name}</div><div class="money">$${Math.round(this.g.money)}</div>${note}
      <div class="list">${rows.map((r, i) => `<button class="row" data-i="${i}" ${r.off ? 'disabled' : ''}><span>${r.label}</span><em>${r.right}</em></button>`).join('')}</div>
      <button class="close">${L === 'pt' ? 'Sair' : 'Leave'}</button></div>`;
    this.el.querySelectorAll('.row').forEach((b) => (b.onclick = () => rows[+b.dataset.i].act()));
    this.el.querySelector('.close').onclick = () => this.close();
  }
  pay(price) {
    if (this.g.money < price) { this.g.hud.hint(ui('noMoney', this.lang()), 2000); return false; }
    this.g.money -= price;
    this.g.audio.cash();
    return true;
  }

  renderFood() {
    const L = this.lang(), d = this.data;
    const bar = `<div class="stat">${L === 'pt' ? 'Fome' : 'Hunger'} <div class="sbar"><i style="width:${d.hunger * 100}%;background:#ffb020"></i></div></div>
      <div class="stat">${L === 'pt' ? 'Gordura' : 'Body fat'} <div class="sbar"><i style="width:${d.fat * 100}%;background:#d9661f"></i></div></div>
      <p>${L === 'pt' ? 'Comer de barriga cheia engorda. Correr e treinar emagrece.' : 'Eating when full makes you fat. Running and training burn it off.'}</p>`;
    this.renderList(FOOD.map((f) => ({
      label: f[L], right: '$' + f.price,
      act: () => {
        if (!this.pay(f.price)) return;
        const over = Math.max(0, d.hunger + f.fill - 1);
        d.hunger = Math.min(1, d.hunger + f.fill);
        d.fat = clamp(d.fat + f.fat * (0.3 + over * 1.2), 0, 1);
        this.g.player.health = Math.min(100, this.g.player.health + f.fill * 30);
        this.g.audio.eat();
        this.g.setPlayerLook(d.look, d.muscle);
        this.renderFood();
      },
    })), bar);
  }

  renderDealer() {
    const L = this.lang(), d = this.data, VT = this.g.vtypes;
    this.renderList(DEALER.map((c) => ({
      label: `${VT[c.type].name}${VT[c.type].boat ? (L === 'pt' ? ' (entregue na marina)' : ' (delivered to marina)') : ''}`, right: '$' + c.price,
      act: () => {
        if (!this.pay(c.price)) return;
        d.cars.push({ type: c.type, color: c.color });
        this.save();
        const v = this.g.deliverVehicle(c.type, c.color);
        this.close();
        this.g.hud.big(VT[c.type].name, L === 'pt' ? 'é seu!' : 'is yours!', 3500);
        if (v) this.g.addBlip({ id: 'bought', color: '#4cc3ff', follow: v });
        setTimeout(() => this.g.removeBlip('bought'), 60000);
      },
    })), `<p>${L === 'pt' ? 'Os veículos comprados voltam pra você toda vez que você carrega o jogo.' : 'Bought vehicles come back every time you load the game.'}</p>`);
  }

  renderGuns() {
    const L = this.lang(), d = this.data;
    const rows = [];
    for (const [k, G] of Object.entries(GUNS)) {
      if (!d.weapons[k]) rows.push({ label: G[L], right: '$' + G.price, act: () => { if (!this.pay(G.price)) return; d.weapons[k] = true; if (G.ammo) d.ammo[k] = (d.ammo[k] || 0) + G.ammo; this.g.combat.equip(k); this.save(); this.renderGuns(); } });
      else if (G.ammo) rows.push({ label: `${L === 'pt' ? 'Munição' : 'Ammo'}: ${G[L].split(' (')[0]} (+${G.ammo}) · ${d.ammo[k] || 0}`, right: '$' + G.ammoPrice, act: () => { if (!this.pay(G.ammoPrice)) return; d.ammo[k] = (d.ammo[k] || 0) + G.ammo; this.save(); this.renderGuns(); } });
      else rows.push({ label: G[L], right: '✔', off: true, act: () => {} });
    }
    this.renderList(rows, `<p>${L === 'pt' ? 'Troque de arma com <b>Q/E</b> ou <b>1–5</b>, D-pad → ou 🔫. Mire com o <b>botão direito</b> / LT.' : 'Switch weapons with <b>Q/E</b> or <b>1–5</b>, D-pad → or 🔫. Aim with <b>right mouse</b> / LT.'}</p>`);
  }

  renderHouse() {
    const L = this.lang(), d = this.data, g = this.g;
    if (!d.house) {
      this.renderList([{ label: L === 'pt' ? 'Comprar a casa' : 'Buy the house', right: '$' + HOUSE_PRICE, act: () => {
        if (!this.pay(HOUSE_PRICE)) return;
        d.house = true; this.open.name = L === 'pt' ? 'Sua casa' : 'Your house'; this.save();
        g.hud.big(L === 'pt' ? 'Casa comprada!' : 'House bought!', L === 'pt' ? 'agora você salva e dorme aqui' : 'save and sleep here now', 4000);
        this.renderHouse();
      } }], `<p>${L === 'pt' ? 'Com casa própria você salva o jogo, dorme pra passar o tempo e começa aqui quando volta.' : 'Own a house to save, sleep to pass time, and start here when you come back.'}</p>`);
      return;
    }
    this.renderList([{ label: L === 'pt' ? 'Dormir e salvar (6 horas)' : 'Sleep and save (6 hours)', right: '💤', act: () => {
      g.env.time = (g.env.time + 6) % 24;
      g.player.health = 100;
      d.hunger = Math.max(0, d.hunger - 0.15);
      g.saveGame && g.saveGame();
      this.save();
      this.close();
      g.hud.big(L === 'pt' ? 'Jogo salvo' : 'Game saved', '', 2500);
      g.hud.hint(ui('saved', L, { h: g.env.clock() }), 4000);
    } }]);
  }

  renderGym() {
    const L = this.lang(), d = this.data, G = this.gym;
    const inst = L === 'pt' ? 'Aperte <b>Espaço</b> / <b>A</b> / toque rápido para levantar o peso! (custa $10)' : 'Mash <b>Space</b> / <b>A</b> / tap to lift! (costs $10)';
    this.el.innerHTML = `<div class="shopbox gym"><div class="stitle">${this.open.name}</div>
      <div class="stat">${L === 'pt' ? 'Músculo' : 'Muscle'} <div class="sbar"><i style="width:${d.muscle * 100}%"></i></div></div>
      <div class="stat">${L === 'pt' ? 'Fôlego' : 'Stamina'} <div class="sbar"><i style="width:${d.stamina * 100}%"></i></div></div>
      <p>${inst}</p>
      <div class="lift"><i id="liftbar" style="width:${G.power * 100}%"></i></div>
      <div id="gymreps">${G.active ? `${L === 'pt' ? 'Repetições' : 'Reps'}: ${G.reps} · ${Math.max(0, 15 - G.t).toFixed(0)}s` : ''}</div>
      <button class="go">${G.active ? '💪' : L === 'pt' ? 'Treinar' : 'Train'}</button>
      <button class="close">${L === 'pt' ? 'Sair' : 'Leave'}</button></div>`;
    const go = this.el.querySelector('.go');
    go.onpointerdown = (e) => { e.preventDefault(); this.pump(); };
    this.el.querySelector('.close').onclick = () => this.close();
  }
  pump() {
    const G = this.gym;
    if (!G.active) {
      if (this.g.money < 10) { this.g.hud.hint(this.lang() === 'pt' ? 'Dinheiro insuficiente.' : 'Not enough money.', 2000); return; }
      this.g.money -= 10;
      G.active = true; G.t = 0; G.reps = 0; G.power = 0;
      this.renderGym();
      return;
    }
    G.power = Math.min(1, G.power + 0.13);
  }
  menuInput(dt, inp) {
    const g = this.g;
    if (inp.pause) { inp.pause = false; this.close(); return; }
    if (this.open.id !== 'gym') return;
    const G = this.gym;
    if (inp.jump || inp.skip) this.pump();
    g.player.char.animate(dt, G.active ? 2 + G.power * 6 : 0.5, 'lift');
    if (!G.active) return;
    G.t += dt;
    G.power = Math.max(0, G.power - dt * 0.35);
    if (G.power > 0.85) { G.reps++; G.power = 0.3; g.audio.punch(); }
    const bar = document.getElementById('liftbar');
    if (bar) bar.style.width = `${G.power * 100}%`;
    const r = document.getElementById('gymreps');
    if (r) r.textContent = `${this.lang() === 'pt' ? 'Repetições' : 'Reps'}: ${G.reps} · ${Math.max(0, 15 - G.t).toFixed(0)}s`;
    if (G.t >= 15) {
      G.active = false;
      const d = this.data;
      const gm = clamp(G.reps * 0.008, 0, 1 - d.muscle), gs = clamp(G.reps * 0.006, 0, 1 - d.stamina);
      d.muscle += gm; d.stamina += gs;
      d.fat = Math.max(0, d.fat - G.reps * 0.004);
      g.setPlayerLook(d.look, d.muscle);
      g.hud.big(this.lang() === 'pt' ? 'Treino concluído!' : 'Workout done!', `${this.lang() === 'pt' ? 'Músculo' : 'Muscle'} +${Math.round(gm * 100)}% · ${this.lang() === 'pt' ? 'Fôlego' : 'Stamina'} +${Math.round(gs * 100)}%`, 3500);
      this.save();
      this.renderGym();
    }
  }
}
