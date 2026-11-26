// Ícones de itens (16x16) e balões de emoção.
import { PixelPainter, makeCanvas, darken, lighten } from './canvas.js';
import { cached, propSprite } from './objects.js';
import { weaponSprite } from './chars.js';
import { ITEMS } from '../data/items.js';

export function itemIcon(id) {
  return cached('icon:' + id, () => {
    const it = ITEMS[id] || {};
    if (it.type === 'weapon') {
      const s = weaponSprite(it.wtype, it.tint || null);
      const c = makeCanvas(16, 16); c.ctx.imageSmoothingEnabled = false;
      c.ctx.translate(8, 8); c.ctx.rotate(-Math.PI / 4); const sc = Math.min(1, 20 / s.width); c.ctx.scale(sc, sc); c.ctx.drawImage(s, -s.width / 2, -s.height / 2);
      return c;
    }
    if (it.type === 'bow') { const s = weaponSprite('bow', it.tint || null); const c = makeCanvas(16, 16); c.ctx.translate(8, 8); c.ctx.rotate(Math.PI / 4); c.ctx.scale(0.7, 0.7); c.ctx.drawImage(s, -s.width / 2, -s.height / 2); return c; }
    if (it.type === 'shield') { const p = new PixelPainter(16, 16); const col = it.tint || '#7a4e2a'; p.ellipse(8, 8, 6, 7, col); p.ellipse(8, 8, 4, 5, darken(col, 0.2)); p.circle(8, 8, 1, '#d8b04a'); p.hline(4, 3, 8, lighten(col, 0.3)); p.outline('#1c1520'); return p.done(); }
    const p = new PixelPainter(16, 16);
    const T = (k) => id === k || id.startsWith(k);
    if (it.type === 'armor') { const col = id === 'a_plate' ? '#9a9aa6' : id === 'a_chain' ? '#7a7a86' : id === 'a_fur' ? '#8a6a4a' : id === 'a_padded' ? '#8a7a5a' : '#6a5a8a'; p.rect(4, 3, 8, 10, col); p.rect(2, 3, 3, 5, col); p.rect(11, 3, 3, 5, col); p.rect(6, 3, 4, 2, darken(col, 0.4)); if (id === 'a_chain') for (let y = 5; y < 13; y += 2) for (let x = 5; x < 12; x += 2) p.set(x, y, lighten(col, 0.3)); p.hline(4, 9, 8, '#4a3020'); }
    else if (it.type === 'cloak') { const col = it.color || '#7b3fa0'; for (let y = 2; y < 14; y++) p.hline(8 - Math.min(6, 2 + y / 2), y, Math.min(12, 4 + y), y % 4 === 0 ? darken(col, 0.2) : col); p.hline(5, 2, 6, '#d8b04a'); }
    else if (T('potion') || T('elixir')) { const col = id === 'elixir' ? '#40c0e0' : id === 'potion_big' ? '#e02860' : '#e04040'; p.rect(6, 1, 4, 3, '#8a6a4a'); p.rect(7, 4, 2, 2, '#c8d8e0'); p.circle(8, 10, 5, '#c8d8e0'); p.circle(8, 10, 4, col); p.set(6, 8, '#ffffff'); p.set(6, 9, lighten(col, 0.5)); }
    else if (id === 'bread') { p.ellipse(8, 9, 6, 4, '#c88a3a'); p.ellipse(8, 8, 5, 3, '#e0a850'); for (let i = 0; i < 3; i++) p.line(5 + i * 3, 6, 6 + i * 3, 9, '#a06a2a'); }
    else if (id === 'apple') { p.circle(8, 9, 5, '#d02a2a'); p.set(6, 7, '#ff8080'); p.vline(8, 2, 3, '#5a3a1a'); p.ellipse(10, 3, 2, 1, '#4a9a3a'); }
    else if (id === 'fish_cooked' || id === 'fish') { const col = id === 'fish' ? '#8aa0b0' : '#c07a3a'; p.ellipse(7, 8, 5, 3, col); p.line(12, 8, 15, 5, col); p.line(12, 8, 15, 11, col); p.set(4, 7, '#101010'); }
    else if (id === 'stew') { p.ellipse(8, 10, 6, 4, '#6a4a2a'); p.ellipse(8, 8, 5, 2, '#c07a3a'); p.set(6, 8, '#60a040'); p.set(9, 7, '#e0c040'); }
    else if (id === 'arrows') { for (let i = 0; i < 3; i++) { p.line(3 + i * 2, 13, 11 + i * 2, 3, '#8a6a3a'); p.set(11 + i * 2, 3, '#c8ccd8'); p.set(3 + i * 2, 13, '#e8e8f0'); } }
    else if (id === 'ore') { p.ellipse(8, 9, 6, 5, '#6a625c'); p.set(6, 8, '#e8a050'); p.set(9, 10, '#c0c8d0'); p.set(10, 7, '#e8a050'); }
    else if (id === 'coal' || id === 'q_coal_crate') { p.ellipse(8, 9, 6, 5, '#2a2626'); p.set(6, 7, '#5a5656'); p.set(10, 9, '#4a4646'); }
    else if (id === 'wood') { p.rect(2, 6, 12, 5, '#7a5a34'); p.ellipse(13, 8, 2, 2, '#c8a070'); p.hline(2, 6, 11, '#9a7a44'); }
    else if (id === 'herb') { for (let i = 0; i < 4; i++) p.line(8, 14, 3 + i * 3, 3, '#3a8a3a'); p.set(4, 3, '#e8f0f8'); p.set(10, 3, '#c0a0f0'); }
    else if (id === 'mushroom') { p.vline(8, 8, 6, '#e8dcc0'); p.ellipse(8, 7, 6, 3, '#a03a8a'); p.set(6, 6, '#e8a0e0'); p.set(10, 6, '#e8a0e0'); }
    else if (id === 'pelt' || id === 'leather') { const col = id === 'pelt' ? '#8a8480' : '#9a6a3a'; p.ellipse(8, 8, 6, 5, col); p.set(2, 4, col); p.set(14, 4, col); p.set(2, 12, col); p.set(14, 12, col); }
    else if (id === 'gem') { p.line(8, 2, 13, 7, '#3aa0c0'); p.line(13, 7, 8, 14, '#3aa0c0'); p.line(8, 14, 3, 7, '#3aa0c0'); p.line(3, 7, 8, 2, '#3aa0c0'); p.rect(6, 5, 5, 6, '#7ae0f0'); p.set(6, 5, '#ffffff'); }
    else if (id === 'fishing_rod') { p.line(2, 14, 13, 2, '#8a6a3a'); p.line(13, 2, 14, 10, '#d8d8d8'); p.set(14, 11, '#d02a2a'); }
    else if (id === 'q_heart') { const s = propSprite('heart', '#b050ff'); const c = makeCanvas(16, 16); c.ctx.drawImage(s.c, 2, 2); return c; }
    else if (id === 'q_feather' || id === 'q_raven_sigil') { p.line(3, 13, 12, 3, '#1a1a22'); p.line(4, 13, 13, 4, '#3a3a4a'); p.line(3, 12, 11, 3, '#4a4a5a'); if (id === 'q_raven_sigil') { p.circle(8, 8, 6, '#c8a040'); p.circle(8, 8, 5, '#2a2430'); p.line(5, 9, 11, 6, '#8a7a9a'); } }
    else if (T('q_relic') || id === 'q_bell_piece' || id === 'q_offering') { const col = id === 'q_bell_piece' ? '#c8a040' : id === 'q_offering' ? '#60c080' : '#a09080'; p.ellipse(8, 8, 5, 6, col); p.set(7, 6, lighten(col, 0.5)); p.hline(5, 10, 6, darken(col, 0.3)); }
    else if (id === 'q_miner_pick') { p.line(3, 14, 11, 4, '#6a4a2a'); for (let i = 0; i < 9; i++) p.set(7 + i * 0.8, 2 + Math.sin(i / 8 * Math.PI) * 3, '#a0a0a8'); }
    else if (id === 'q_cargo' || id === 'q_supplies') { p.rect(2, 4, 12, 10, '#9a6e3a'); p.line(2, 4, 13, 13, '#6a4a24'); p.line(13, 4, 2, 13, '#6a4a24'); p.hline(2, 4, 12, '#b88a4a'); }
    else if (id === 'q_red_cloth') { for (let y = 3; y < 13; y++) p.hline(3 + (y % 2), y, 10, y % 3 ? '#b8302a' : '#8a1e18'); }
    else if (id === 'q_ledger' || id === 'q_old_tome' || id === 'q_lost_tome') { const col = id === 'q_ledger' ? '#c8a040' : id === 'q_old_tome' ? '#5a3a7a' : '#3a5a7a'; p.rect(3, 2, 10, 12, col); p.rect(4, 3, 8, 10, darken(col, 0.2)); p.vline(3, 2, 12, '#e8dcb8'); p.hline(6, 6, 5, '#e8dcb8'); }
    else { // pergaminhos/cartas/selos/mapas
      p.rect(3, 3, 10, 10, '#e8dcb8'); p.vline(2, 2, 12, '#a08a5a'); p.vline(13, 2, 12, '#a08a5a'); for (let y = 5; y < 12; y += 2) p.hline(4, y, 7, '#8a7a5a');
      if (id === 'q_king_letter' || id === 'q_seal_order') p.circle(10, 11, 2, '#b8302a');
      if (id === 'q_kael_letters') p.circle(10, 11, 2, '#2a2430');
      if (id === 'q_map_frag' || id === 'q_treasure_map') { p.line(4, 10, 11, 5, '#a03030'); p.set(11, 5, '#d02020'); p.set(10, 4, '#d02020'); }
      if (id === 'q_cipher') for (let i = 0; i < 6; i++) p.set(4 + i, 5 + (i % 2) * 2, '#2a2a6a');
      if (id === 'q_love_letter') { p.set(7, 8, '#e04060'); p.set(9, 8, '#e04060'); p.set(8, 9, '#e04060'); }
    }
    p.outline('#1c1520');
    return p.done();
  });
}

export function emoteSprite(kind) {
  return cached('emote:' + kind, () => {
    const p = new PixelPainter(11, 11);
    p.ellipse(5, 4, 5, 4, '#ffffff'); p.set(3, 8, '#ffffff'); p.set(2, 9, '#ffffff');
    const ink = { '!': '#e03030', '?': '#3070e0', heart: '#e04070', anger: '#e03030', dots: '#5a5a6a', zzz: '#5a5a9a', note: '#40a040', sweat: '#40a0e0', tear: '#4080e0' }[kind] || '#000';
    if (kind === '!') { p.vline(5, 1, 4, ink); p.set(5, 6, ink); }
    else if (kind === '?') { p.hline(4, 1, 3, ink); p.set(7, 2, ink); p.set(6, 3, ink); p.set(5, 4, ink); p.set(5, 6, ink); }
    else if (kind === 'heart') { p.set(3, 2, ink); p.set(4, 2, ink); p.set(6, 2, ink); p.set(7, 2, ink); p.hline(3, 3, 5, ink); p.hline(4, 4, 3, ink); p.set(5, 5, ink); }
    else if (kind === 'anger') { p.set(3, 2, ink); p.set(7, 2, ink); p.set(4, 3, ink); p.set(6, 3, ink); p.set(4, 5, ink); p.set(6, 5, ink); p.set(3, 6, ink); p.set(7, 6, ink); }
    else if (kind === 'dots') { p.set(2, 4, ink); p.set(5, 4, ink); p.set(8, 4, ink); }
    else if (kind === 'zzz') { p.hline(3, 2, 3, ink); p.set(4, 3, ink); p.hline(3, 4, 3, ink); p.set(7, 5, ink); p.set(8, 5, ink); p.set(8, 6, ink); p.set(7, 7, ink); p.set(8, 7, ink); }
    else if (kind === 'note') { p.vline(6, 1, 5, ink); p.set(7, 1, ink); p.set(8, 2, ink); p.circle(5, 6, 1, ink); }
    else if (kind === 'sweat' || kind === 'tear') { p.set(5, 2, ink); p.vline(4, 3, 2, ink); p.vline(6, 3, 2, ink); p.hline(4, 5, 3, ink); p.set(5, 4, lighten(ink, 0.5)); }
    p.outline('#2a2030');
    return p.done();
  });
}
