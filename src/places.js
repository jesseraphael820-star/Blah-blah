// Enterable businesses: clothes shop, diner, gym, apartment (property/save point) and paint & repair.
import * as THREE from 'three';
import { Marker } from './fx.js';

const OUTFITS = [
  { id: 'shirt:0xf4f4f2', label: 'Camiseta branca', price: 0, patch: { shirt: 0xf4f4f2, longSleeve: false } },
  { id: 'shirt:0x2f8f4f', label: 'Camisa verde Porto Sol', price: 80, patch: { shirt: 0x2f8f4f, longSleeve: false } },
  { id: 'shirt:0xd23c3c', label: 'Regata vermelha', price: 60, patch: { shirt: 0xd23c3c, longSleeve: false } },
  { id: 'shirt:0x1c1c1e', label: 'Jaqueta preta', price: 250, patch: { shirt: 0x1c1c1e, longSleeve: true } },
  { id: 'pants:0x6a86b8', label: 'Calça jeans clara', price: 90, patch: { pants: 0x6a86b8 } },
  { id: 'hat:cap', label: 'Boné laranja (tira e põe)', price: 40, patch: null, toggleHat: true },
];
const PROPERTY_PRICE = 6000;

export class Places {
  constructor(game) {
    this.g = game;
    const L = game.world.loc;
    this.spots = [
      { key: 'clothes', pos: L.clothes, color: 0xff8fd0, name: 'Moda Sol', prompt: 'ver roupas', icon: 'R' },
      { key: 'food', pos: L.food, color: 0xffb000, name: 'Lanchonete Maré', prompt: 'comer', icon: 'L' },
      { key: 'gym', pos: L.gym, color: 0x7ad0ff, name: 'Academia Ferro', prompt: 'treinar', icon: 'A' },
      { key: 'property', pos: L.property, color: 0x34c759, name: 'Edifício Maré', prompt: 'ver o apartamento', icon: '$' },
      { key: 'paint', pos: L.paint, color: 0x3a8dff, name: 'Pintura & Reparo', prompt: 'pintar e consertar o carro ($100)', icon: 'P', inCar: true },
    ];
    for (const s of this.spots) s.marker = new Marker(game.scene, s.pos, s.color, s.inCar ? 2.6 : 0.7, s.inCar ? 1.2 : 1.6);
    this.el = document.getElementById('shop');
    this.open = null;
    this.el.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) this.choose(+b.dataset.i); if (e.target.closest('#shopClose')) this.close(); });
  }
  get blips() { return this.spots.map((s) => ({ pos: s.pos, color: '#' + s.color.toString(16).padStart(6, '0'), icon: s.icon, small: false, place: true })); }

  near() {
    const P = this.g.player;
    for (const s of this.spots) {
      const p = P.vehicle ? P.vehicle.pos : P.pos;
      if (Math.hypot(p.x - s.pos.x, p.z - s.pos.z) < (s.inCar ? 3 : 1.4) && !!P.vehicle === !!s.inCar) return s;
    }
    return null;
  }

  update(dt, input) {
    for (const s of this.spots) s.marker.update(dt);
    const g = this.g;
    if (this.open) {
      for (let i = 1; i <= 9; i++) if (input.pressed('Digit' + i) || input.pressed('Numpad' + i)) this.choose(i - 1);
      if (input.pressed('KeyE') || input.pressed('Escape') || input.pressed('Backspace')) this.close();
      return;
    }
    if (g.cutsceneActive || g.state !== 'play') return;
    const s = this.near();
    if (!s) return;
    if (!g.hud.helpTimer || g.hud.helpTimer < 0.3) g.hud.help(`<b>${s.name}</b> — aperte <b>E</b> para ${s.prompt}`, 0.3);
    if (input.pressed('KeyE')) {
      if (g.wanted > 0) { g.hud.help('Ninguém atende quem está sendo procurado pela polícia!', 2.5); return; }
      if (s.key === 'paint') this.paint(); else this.show(s);
    }
  }

  options(s) {
    const g = this.g, P = g.player;
    switch (s.key) {
      case 'clothes': return OUTFITS.map((o) => {
        const owned = P.wardrobe.includes(o.id);
        return { label: o.label, price: owned ? 0 : o.price, tag: owned ? 'comprado' : '', run: () => {
          if (!owned) { if (!g.spend(o.price)) return; P.wardrobe.push(o.id); }
          if (o.toggleHat) P.setLook(P.look.hat ? { hat: null } : { hat: 'cap', hatColor: 0xff7a2a });
          else P.setLook(o.patch);
          g.hud.help(`Você está usando: <b>${o.label}</b>`, 2);
        } };
      });
      case 'food': return [
        { label: 'Pastel de queijo (+25 vida)', price: 6, run: () => this.eat(25, 6) },
        { label: 'Açaí na tigela (+40 vida)', price: 10, run: () => this.eat(40, 10) },
        { label: 'Prato feito (vida cheia)', price: 18, run: () => this.eat(100, 18) },
      ];
      case 'gym': return [
        { label: `Musculação — força ${P.stats.strength}/100`, price: 40, run: () => this.train('strength') },
        { label: `Esteira — fôlego ${P.stats.stamina}/100`, price: 40, run: () => this.train('stamina') },
      ];
      case 'property':
        if (!g.flags.property) return [{ label: 'Comprar apartamento (vira esconderijo e ponto de salvamento)', price: PROPERTY_PRICE, run: () => {
          if (!g.spend(PROPERTY_PRICE)) return;
          g.flags.property = true; g.save(); g.audio.mission();
          g.hud.big('PROPRIEDADE COMPRADA', 'Edifício Maré agora é seu', '#34c759', 3); this.refresh();
        } }];
        return [
          { label: 'Salvar o jogo', price: 0, run: () => { g.save(true); g.hud.help('Jogo salvo.', 2); } },
          { label: 'Dormir 8 horas (recupera a vida e salva)', price: 0, run: () => { this.close(); g.sleep(8); } },
        ];
    }
    return [];
  }

  show(s) {
    this.open = s; this.g.menuOpen = true;
    if (document.pointerLockElement) document.exitPointerLock();
    this.refresh();
    this.el.hidden = false;
  }
  refresh() {
    const s = this.open; if (!s) return;
    const P = this.g.player;
    this.items = this.options(s);
    this.el.innerHTML = `<div class="shopBox"><h3>${s.name}</h3><div class="shopMoney">Seu dinheiro: $${P.money}</div><ol>` +
      this.items.map((o, i) => `<li><button data-i="${i}" ${o.price > P.money ? 'class="poor"' : ''}><kbd>${i + 1}</kbd><span>${o.label}</span><em>${o.tag || (o.price ? '$' + o.price : 'grátis')}</em></button></li>`).join('') +
      `</ol><button id="shopClose" class="small">Sair (E)</button></div>`;
  }
  choose(i) {
    const o = this.items && this.items[i]; if (!o) return;
    o.run(); this.refresh();
  }
  close() {
    this.open = null; this.g.menuOpen = false; this.el.hidden = true;
    this.g.relock();
  }
  eat(hp, price) {
    const P = this.g.player;
    if (P.health >= 100) { this.g.hud.help('Você está satisfeito.', 1.5); return; }
    if (!this.g.spend(price)) return;
    P.health = Math.min(100, P.health + hp); this.g.audio.pickup();
  }
  train(stat) {
    const g = this.g, P = g.player;
    if (P.stats[stat] >= 100) { g.hud.help('Você já está no máximo!', 1.5); return; }
    if (!g.spend(40)) return;
    P.stats[stat] = Math.min(100, P.stats[stat] + 10);
    g.world.hour = (g.world.hour + 1) % 24;
    g.hud.help(stat === 'strength' ? `Força: <b>${P.stats.strength}</b>. Seus socos ficaram mais fortes.` : `Fôlego: <b>${P.stats.stamina}</b>. Você corre e nada mais rápido.`, 3);
  }
  paint() {
    const g = this.g, car = g.player.vehicle;
    if (!g.spend(100)) return;
    const colors = car.type.colors.length > 1 ? car.type.colors : [0x8c1d1d, 0x1d3f8c, 0x222222, 0xd8d8d8];
    car.paint.color.set(colors[Math.floor(Math.random() * colors.length)]);
    car.health = 100;
    g.hud.fade(true);
    setTimeout(() => { g.hud.fade(false); g.hud.help('Carro pintado e consertado!', 2.5); }, 900);
    g.audio.pickup();
  }
}
