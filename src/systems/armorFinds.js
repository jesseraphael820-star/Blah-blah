// Rare armors: never sold. They can drop from chests (better chests = better odds),
// defeated enemies (tiny chance) and bosses (good chance). The rarer the armor,
// the lower the chance. Finding one plays a reveal; wearing one emits its own
// animated particles.
import { G } from '../core/context.js';
import { t } from '../core/i18n.js';
import { ARMORS, RARE_ARMORS, RARITY } from '../data/items.js';
import { icon, img } from '../ui/icons.js';

const CHEST_MULT = { common: 0.35, rare: 1, epic: 2.2, legendary: 4 };

export class ArmorFinds {
  constructor() {
    G.bus.on('chestOpened', (e) => this.roll(CHEST_MULT[e.rarity] ?? 0.5));
    G.bus.on('enemyKilled', (e) => this.roll(e.boss ? 6 : 0.05));
    this.fxT = 0;
    this.hue = 0;
  }

  owned(id) { return G.state.inv.owned.armors.includes(id); }

  // rarest first, so a lucky roll gives the best one
  roll(mult) {
    const order = [...RARE_ARMORS].sort((a, b) => ARMORS[a].find - ARMORS[b].find);
    for (const id of order) {
      if (this.owned(id)) continue;
      if (Math.random() < Math.min(0.9, ARMORS[id].find * mult)) { setTimeout(() => this.give(id), 700); return id; }
    }
    return null;
  }

  give(id) {
    if (this.owned(id)) return;
    G.state.inv.owned.armors.push(id);
    G.state.ach.stats.rareArmors = (G.state.ach.stats.rareArmors || 0) + 1;
    this.reveal(id);
  }

  reveal(id) {
    const A = ARMORS[id], rar = A.rar, col = RARITY[rar]?.color || '#fff';
    const hex = '#' + (A.trim >>> 0).toString(16).padStart(6, '0');
    const d = document.createElement('div');
    d.className = 'overlay armor-reveal';
    d.style.setProperty('--rc', col);
    d.innerHTML = `<div class="ar-rays"></div><div class="ar-card">
      <small>${t('armorFind.found')}</small>
      <div class="ar-icon">${img(icon('armorA', hex), 'px')}</div>
      <em class="ar-rar">${t('rarity.' + rar)}</em>
      <h1>${t('armor.' + id + '.name')}</h1>
      <p>${t('armor.' + id + '.desc')}</p>
      <div class="ar-stat">🛡️ ${t('ui.defense')} ${A.def} · ${t('armorFind.chance')} ${(A.find * 100).toFixed(A.find < 0.01 ? 2 : 1)}%</div>
      <div class="ar-btns"><button class="btn primary ar-eq">${t('ui.equip')}</button><button class="btn ar-close">${t('lin.close')}</button></div></div>`;
    document.body.appendChild(d);
    G.ui.overlay = 'armor';
    G.input.unlock?.();
    G.audio.sfx('chest'); setTimeout(() => G.audio.sfx('achievement'), 350);
    if (rar === 'legendary' || rar === 'magic') setTimeout(() => G.audio.sfx('legend'), 200);
    const P = G.player, c = parseInt(hex.slice(1), 16);
    G.particles.ring(P.pos.x, P.pos.y + 0.3, P.pos.z, c, 4, 40);
    G.particles.burst(P.pos.x, P.pos.y + 1.4, P.pos.z, c, 40, 6, { life: 1.2 });
    G.cam.shake(0.2);
    const close = () => { d.classList.add('out'); setTimeout(() => d.remove(), 400); if (G.ui.overlay === 'armor') G.ui.overlay = null; };
    d.querySelector('.ar-close').onclick = () => { G.audio.sfx('close'); close(); };
    d.querySelector('.ar-eq').onclick = () => {
      G.state.inv.equipped.armor = id;
      P.refreshLook();
      G.lineage?.applyAura();
      G.audio.sfx('equip');
      close();
    };
  }

  // animated particles of the equipped rare armor
  update(dt) {
    const id = G.state.inv.equipped.armor, A = ARMORS[id];
    if (!A || !A.fx) return;
    const P = G.player;
    if (P.dead || G.sky.indoor && Math.random() < 0.5) return;
    const p = P.pos, y = P.visualY + (P.mounted ? 1.9 : 1.0);
    const moving = P.speedNow > 1;
    const rate = (moving ? 16 : 9) * (G.mobile ? 0.6 : 1);
    const rnd = (s) => (Math.random() - 0.5) * s;
    const pg = G.particles.glow, ps = G.particles.solid;
    this.hue = (this.hue + dt * 0.25) % 1;
    for (let i = 0; i < 2; i++) {
      if (Math.random() > dt * rate) continue;
      const x = p.x + rnd(0.8), z = p.z + rnd(0.8), yy = y + rnd(1.2);
      switch (A.fx) {
        case 'shine': if (Math.random() < 0.3) pg.spawn(x, yy, z, 0, 0, 0, 0xfff6d0, 0.22, 0.25); break;
        case 'leaves': ps.spawn(x, yy + 0.4, z, rnd(1), 0.2, rnd(1), Math.random() < 0.5 ? 0x5ab84a : 0x9ae86a, 0.12, 1.6, { gravity: 1.2, drag: 1.2 }); break;
        case 'frost': pg.spawn(x, yy, z, rnd(0.4), -0.3, rnd(0.4), Math.random() < 0.5 ? 0xbfefff : 0xffffff, 0.12, 1.2); if (Math.random() < 0.3) ps.spawn(p.x + rnd(1.2), P.visualY + 0.1, p.z + rnd(1.2), 0, 0.15, 0, 0xdff6ff, 0.35, 1.2, { alpha: 0.3, grow: 0.6 }); break;
        case 'ember': pg.spawn(x, yy - 0.4, z, rnd(0.6), 1.4 + Math.random() * 1.4, rnd(0.6), Math.random() < 0.5 ? 0xff6a1a : 0xffc83a, 0.13, 1.0); break;
        case 'storm': pg.spawn(x, yy, z, rnd(6), rnd(6), rnd(6), Math.random() < 0.7 ? 0xb0e8ff : 0xffffff, 0.1, 0.12, { drag: 6 }); if (Math.random() < 0.02) G.audio.sfxAt?.('blip', p.x, p.z, { vol: 0.15 }); break;
        case 'holy': pg.spawn(x, yy - 0.6, z, 0, 0.8 + Math.random(), 0, Math.random() < 0.5 ? 0xffe08a : 0xffffff, 0.15, 1.6); break;
        case 'void': { const a = Math.random() * 6.28, r = 1.4; pg.spawn(p.x + Math.sin(a) * r, yy, p.z + Math.cos(a) * r, -Math.sin(a) * 2.2, 0, -Math.cos(a) * 2.2, Math.random() < 0.6 ? 0xb66cff : 0xffffff, 0.12, 0.6); if (Math.random() < 0.4) ps.spawn(x, yy, z, 0, 0.3, 0, 0x140a20, 0.25, 0.8, { alpha: 0.6 }); break; }
        case 'aurora': { const h = (this.hue + Math.random() * 0.2) % 1; const c = hsl(h, 0.85, 0.65); pg.spawn(x, yy, z, rnd(0.3), 0.7, rnd(0.3), c, 0.15, 1.4); break; }
      }
    }
  }
}

function hsl(h, s, l) {
  const k = (n) => (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return ((Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255)) >>> 0;
}
