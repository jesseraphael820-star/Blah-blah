// Personagens humanoides procedurais: folha de sprites com 4 direções e várias animações,
// armas desenhadas separadamente (rotacionadas no golpe) e cavaleiros.
import { PixelPainter, makeCanvas, darken, lighten } from './canvas.js';
import { cached } from './objects.js';

export const FW = 20, FH = 28; // tamanho do quadro
// linhas da folha: anim × direção
export const ANIMS = { idle: 0, walk: 1, attack: 2, block: 3, roll: 4, hurt: 5, sit: 6, dead: 7, bowdraw: 8 };
const ANIM_FRAMES = { idle: 2, walk: 4, attack: 3, block: 1, roll: 4, hurt: 1, sit: 1, dead: 1, bowdraw: 2 };
export const animFrames = (a) => ANIM_FRAMES[a] || 1;

export const SKINS = ['#f1c9a5', '#e0ac85', '#c68a5e', '#9a6440', '#6e4428', '#f5d7c0'];
export const HAIRS = ['#2a1c14', '#4a2e1a', '#7a4a22', '#b07a3a', '#d8b860', '#c8c0b8', '#8a2a1a', '#1a1a22', '#e8e4dc'];

// aparência: { skin, hair, hairStyle, eye, top, top2, pants, boots, cape, hood, helm, beard, armor, faction }
export function charSheet(look) {
  const key = 'ch:' + JSON.stringify(look);
  return cached(key, () => buildSheet(look));
}

function buildSheet(L) {
  const rows = Object.keys(ANIMS).length;
  const sheet = makeCanvas(FW * 4 * 4, FH * rows);
  for (const [anim, row] of Object.entries(ANIMS)) {
    for (let dir = 0; dir < 4; dir++) for (let f = 0; f < ANIM_FRAMES[anim]; f++) {
      const fr = drawFrame(L, anim, dir, f);
      sheet.ctx.drawImage(fr, (dir * 4 + f) * FW, row * FH);
    }
  }
  return sheet;
}

function drawFrame(L, anim, dir, f) {
  const p = new PixelPainter(FW, FH);
  const skin = L.skin || SKINS[0], skinD = darken(skin, 0.18);
  const hair = L.hair || HAIRS[1], hairD = darken(hair, 0.25), hairL = lighten(hair, 0.18);
  const top = L.top || '#6a5a8a', topD = darken(top, 0.25), topL = lighten(top, 0.15);
  const top2 = L.top2 || top;
  const pants = L.pants || '#4a3a2e', pantsD = darken(pants, 0.25);
  const boots = L.boots || '#3a2a1e';
  const cx = 10;
  let bob = 0, legA = 0, legB = 0, armA = 0, armB = 0, lean = 0, squash = 0;
  if (anim === 'idle') bob = f === 1 ? 1 : 0;
  if (anim === 'walk') { const ph = [0, 1, 0, -1][f]; legA = ph * 2; legB = -ph * 2; armA = -ph; armB = ph; bob = f % 2 ? -1 : 0; }
  if (anim === 'attack') { lean = [0, 2, 1][f]; armA = [-2, 3, 2][f]; }
  if (anim === 'hurt') { lean = -2; }
  if (anim === 'roll') squash = 1;
  if (anim === 'bowdraw') armA = f ? 2 : 1;
  const side = dir === 1 || dir === 2, back = dir === 3, flip = dir === 1;
  const X = (x) => (flip ? FW - 1 - x : x);
  const set = (x, y, c) => p.set(X(x), y, c);
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };

  if (anim === 'dead') {
    // deitado
    rect(3, 20, 14, 4, top); rect(3, 23, 14, 1, topD); rect(15, 19, 4, 4, skin); rect(15, 18, 4, 2, hair); rect(0, 21, 4, 3, pants); rect(0, 24, 3, 1, boots);
    p.outline('#1c1520'); return p.done();
  }
  if (anim === 'roll') {
    const ph = f;
    const by = 14;
    p.ellipse(cx, by + 4, 6, 5 - (ph % 2), top);
    p.ellipse(cx, by + 4, 4, 3, topD);
    const hx = [cx, cx + 4, cx, cx - 4][ph], hy = [by, by + 4, by + 8, by + 4][ph];
    p.circle(hx, hy, 2, hair);
    const lx = [cx, cx - 4, cx, cx + 4][ph], ly = [by + 8, by + 4, by, by + 4][ph];
    p.rect(lx - 1, ly - 1, 3, 3, boots);
    p.outline('#1c1520'); return p.done();
  }
  const sitting = anim === 'sit';
  const baseY = 27 + bob;
  // pernas
  const legTop = 19 + bob;
  if (sitting) { rect(6, 21, 8, 3, pants); rect(5, 24, 3, 2, boots); rect(12, 24, 3, 2, boots); }
  else if (side) {
    rect(cx - 2 + legA, legTop, 3, 6, pants); rect(cx - 2 + legA, legTop + 6, 3, 2, boots);
    rect(cx - 1 + legB, legTop, 3, 6, pantsD); rect(cx - 1 + legB, legTop + 6, 3, 2, darken(boots, 0.2));
  } else {
    const la = legA ? Math.sign(legA) : 0;
    rect(cx - 3, legTop - (la > 0 ? 1 : 0), 3, 6 + (la > 0 ? 0 : 0), pants); rect(cx - 3, legTop + 5 - (la > 0 ? 1 : 0), 3, 2 + (la > 0 ? 1 : 0), boots);
    rect(cx, legTop - (la < 0 ? 1 : 0), 3, 6, pantsD); rect(cx, legTop + 5 - (la < 0 ? 1 : 0), 3, 2 + (la < 0 ? 1 : 0), boots);
  }
  // capa atrás (frente/lados)
  if (L.cape && !back) { const cc = L.cape; rect(side ? cx - 4 : cx - 5, 10 + bob, side ? 3 : 10, 11, darken(cc, 0.15)); }
  // torso
  const ty = 10 + bob + (sitting ? 2 : 0);
  const tx = cx - 4 + (side ? lean : 0);
  rect(tx, ty, 8, 10, top);
  rect(tx, ty + 9, 8, 1, topD);
  if (!back) { rect(tx + 3, ty + 1, 2, 8, top2 !== top ? top2 : topL); }
  if (L.armor) { rect(tx, ty, 8, 4, L.armor); rect(tx + 1, ty + 4, 6, 1, darken(L.armor, 0.3)); set(tx + 1, ty + 1, lighten(L.armor, 0.4)); }
  rect(tx, ty + 7, 8, 1, L.belt || '#3a2414'); if (!back) set(tx + 4, ty + 7, '#d8b04a');
  if (L.tabard && !back) { rect(tx + 2, ty + 1, 4, 9, L.tabard); rect(tx + 2, ty + 10, 4, 2, L.tabard); set(tx + 3, ty + 3, lighten(L.tabard, 0.5)); set(tx + 4, ty + 3, lighten(L.tabard, 0.5)); }
  if (L.robe) { rect(tx - 1, ty + 8, 10, 8, top); rect(tx - 1, ty + 15, 10, 1, topD); }
  if (L.cape && back) { rect(cx - 5, 10 + bob, 10, 13, L.cape); rect(cx - 5, 22 + bob, 10, 1, darken(L.cape, 0.3)); if (L.capeEmblem) { set(cx - 1, 14 + bob, lighten(L.cape, 0.5)); set(cx, 14 + bob, lighten(L.cape, 0.5)); set(cx, 15 + bob, lighten(L.cape, 0.5)); set(cx - 1, 15 + bob, lighten(L.cape, 0.5)); } }
  // braços
  if (side) {
    const ax = cx - 1 + lean + armA;
    rect(ax, ty + 1, 3, 7, topD); rect(ax, ty + 8, 3, 2, skin);
  } else {
    rect(tx - 2, ty + 1 + Math.max(0, armA), 2, 7, topD); rect(tx - 2, ty + 8 + Math.max(0, armA), 2, 2, skin);
    rect(tx + 8, ty + 1 + Math.max(0, armB), 2, 7, topD); rect(tx + 8, ty + 8 + Math.max(0, armB), 2, 2, skin);
    if (anim === 'block' && !back) { rect(tx + 1, ty + 3, 6, 2, topD); }
  }
  // cabeça
  const hy = ty - 8, hx = cx - 4 + (side ? lean : 0);
  rect(hx, hy, 8, 8, skin);
  rect(hx, hy + 7, 8, 1, skinD);
  // rosto
  const eye = L.eye || '#2a2a3a';
  if (dir === 0) {
    set(hx + 2, hy + 4, eye); set(hx + 5, hy + 4, eye);
    set(hx + 2, hy + 3, hairD); set(hx + 5, hy + 3, hairD);
    if (L.beard) { rect(hx + 1, hy + 5, 6, 3, L.beard); set(hx + 3, hy + 6, darken(L.beard, 0.4)); set(hx + 4, hy + 6, darken(L.beard, 0.4)); }
    else set(hx + 3, hy + 6, darken(skin, 0.3)), set(hx + 4, hy + 6, darken(skin, 0.3));
    set(hx + 1, hy + 5, lighten('#e08080', 0.3));
  } else if (side) {
    set(hx + 6, hy + 4, eye); set(hx + 6, hy + 3, hairD); set(hx + 7, hy + 5, skinD);
    if (L.beard) rect(hx + 4, hy + 5, 4, 3, L.beard);
  }
  // cabelo
  const hs = L.hairStyle ?? 0;
  if (!L.hood && !L.helm) {
    rect(hx, hy - 1, 8, 2, hair); set(hx + 2, hy - 1, hairL); set(hx + 3, hy - 1, hairL);
    if (back) rect(hx, hy, 8, 7 + (hs === 2 ? 4 : 0), hair);
    else if (side) { rect(hx, hy, 4, hs === 2 ? 10 : 6, hair); rect(hx + 4, hy, 3, 2, hair); }
    else { rect(hx, hy, 1, hs === 2 ? 9 : 5, hair); rect(hx + 7, hy, 1, hs === 2 ? 9 : 5, hair); rect(hx + 1, hy, 6, hs === 1 ? 1 : 2, hair); if (hs === 3) { rect(hx + 1, hy, 3, 3, hair); } }
    if (hs === 4 && !back) { rect(hx + 2, hy - 3, 4, 2, hair); } // coque
    if (hs === 5) { rect(hx, hy - 1, 8, 1, hairL); } // careca brilhante coberta? (raspado)
    if (hs === 6 && (back || side)) { rect(side ? hx - 1 : hx + 3, hy + 2, 2, 7, hair); } // rabo de cavalo
  }
  if (L.bald) { rect(hx, hy - 1, 8, 2, skin); set(hx + 2, hy - 1, lighten(skin, 0.3)); if (!back) { rect(hx, hy + 1, 1, 4, hair); rect(hx + 7, hy + 1, 1, 4, hair); } else rect(hx, hy + 2, 8, 3, hair); }
  if (L.hood) { const hc = L.hood; rect(hx - 1, hy - 2, 10, 4, hc); rect(hx - 1, hy, 2, 8, hc); rect(hx + 7, hy, 2, 8, hc); if (back) rect(hx - 1, hy, 10, 9, hc); set(hx + 3, hy - 2, lighten(hc, 0.15)); }
  if (L.helm) { const hc = L.helm; rect(hx - 1, hy - 2, 10, 4, hc); rect(hx - 1, hy + 2, 2, 4, hc); rect(hx + 7, hy + 2, 2, 4, hc); set(hx + 2, hy - 2, lighten(hc, 0.4)); if (L.plume) rect(hx + 3, hy - 4, 2, 3, L.plume); if (!back && !side) rect(hx + 3, hy + 2, 2, 3, darken(hc, 0.2)); }
  if (L.hat) { const hc = L.hat; rect(hx - 2, hy - 1, 12, 2, hc); rect(hx, hy - 4, 8, 3, hc); set(hx + 1, hy - 3, lighten(hc, 0.2)); }
  if (L.crown) { rect(hx, hy - 3, 8, 2, '#e0b030'); set(hx, hy - 4, '#e0b030'); set(hx + 4, hy - 4, '#e0b030'); set(hx + 7, hy - 4, '#e0b030'); set(hx + 3, hy - 2, '#d03040'); }
  if (L.mask && !back) { rect(hx + 1, hy + 2, 6, 3, L.mask); set(hx + 2, hy + 3, '#d0d0ff'); set(hx + 5, hy + 3, '#d0d0ff'); }
  if (L.antlers) { set(hx, hy - 3, '#c8b890'); set(hx - 1, hy - 4, '#c8b890'); set(hx + 7, hy - 3, '#c8b890'); set(hx + 8, hy - 4, '#c8b890'); set(hx, hy - 2, '#c8b890'); set(hx + 7, hy - 2, '#c8b890'); }
  p.outline('#1c1520');
  return p.done();
}

// ---------- Armas (sprite apontando para a direita, empunhadura em (2, meio)) ----------
export const WEAPON_SPRITES = {};
export function weaponSprite(kind, tint = null) {
  return cached(`wpn:${kind}:${tint}`, () => {
    let p;
    const metal = tint || '#c8ccd8', metalD = darken(metal, 0.35), grip = '#5a3a22', guard = '#c8a040';
    switch (kind) {
      case 'sword': p = new PixelPainter(18, 7); p.rect(0, 3, 4, 1, grip); p.rect(4, 1, 1, 5, guard); p.rect(5, 2, 11, 3, metal); p.hline(5, 4, 11, metalD); p.set(16, 3, metal); p.hline(6, 3, 9, lighten(metal, 0.4)); break;
      case 'longsword': p = new PixelPainter(24, 7); p.rect(0, 3, 6, 1, grip); p.rect(6, 0, 1, 7, guard); p.rect(7, 2, 15, 3, metal); p.hline(7, 4, 15, metalD); p.set(22, 3, metal); p.hline(8, 3, 13, lighten(metal, 0.45)); break;
      case 'dagger': p = new PixelPainter(11, 5); p.rect(0, 2, 3, 1, grip); p.rect(3, 1, 1, 3, guard); p.rect(4, 1, 5, 3, metal); p.set(9, 2, metal); p.hline(4, 3, 5, metalD); break;
      case 'axe': p = new PixelPainter(18, 12); p.rect(0, 6, 15, 2, grip); p.rect(11, 1, 5, 10, metal); p.rect(15, 2, 2, 8, metal); p.vline(16, 2, 8, lighten(metal, 0.4)); p.vline(11, 1, 10, metalD); break;
      case 'spear': p = new PixelPainter(30, 7); p.rect(0, 3, 24, 1, grip); p.hline(0, 2, 24, darken(grip, 0.2)); for (let i = 0; i < 6; i++) p.vline(24 + i, 3 - Math.floor((6 - i) / 2.5), 1 + Math.floor((6 - i) / 1.3), metal); p.set(23, 2, '#a02a2a'); p.set(23, 4, '#a02a2a'); break;
      case 'bow': p = new PixelPainter(8, 22); for (let y = 0; y < 22; y++) { const x = Math.round(Math.sin((y / 21) * Math.PI) * 5); p.set(x + 1, y, tint || '#7a4e2a'); p.set(x + 2, y, darken(tint || '#7a4e2a', 0.3)); } p.vline(1, 0, 22, '#e8e0d0'); break;
      case 'shield': p = new PixelPainter(10, 12); p.ellipse(5, 6, 4, 5, tint || '#7a4e2a'); p.ellipse(5, 6, 2, 3, darken(tint || '#7a4e2a', 0.2)); p.set(5, 6, '#c8a040'); break;
      case 'arrow': p = new PixelPainter(12, 3); p.hline(0, 1, 9, '#8a6a3a'); p.set(9, 1, '#c8ccd8'); p.set(10, 1, '#c8ccd8'); p.set(9, 0, '#c8ccd8'); p.set(9, 2, '#c8ccd8'); p.set(0, 0, '#e8e8f0'); p.set(0, 2, '#e8e8f0'); p.set(1, 0, '#e8e8f0'); p.set(1, 2, '#e8e8f0'); break;
      case 'pick': p = new PixelPainter(16, 14); p.rect(0, 7, 13, 2, grip); for (let y = 0; y < 14; y++) p.set(12 + Math.round(Math.sin((y / 13) * Math.PI) * 2), y, metal); break;
      case 'staff': p = new PixelPainter(26, 6); p.rect(0, 2, 22, 2, '#6a4a2a'); p.circle(23, 3, 2, '#5ac080'); break;
      default: p = new PixelPainter(8, 8); p.rect(0, 0, 8, 8, '#f0f');
    }
    p.outline('#1c1520');
    return p.done();
  });
}

// prévia de personagem (para menus): quadro parado de frente ampliado
export function charPreview(look, scale = 4, dir = 0) {
  const sheet = charSheet(look);
  const c = makeCanvas(FW * scale, FH * scale);
  c.ctx.imageSmoothingEnabled = false;
  c.ctx.drawImage(sheet, dir * 4 * FW, 0, FW, FH, 0, 0, FW * scale, FH * scale);
  return c;
}
