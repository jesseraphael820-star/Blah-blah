// Retratos 48x48 para diálogos: expressões (feliz, triste, raiva, medo, surpresa...),
// quadros de boca para a fala e piscadas.
import { PixelPainter, darken, lighten, mix } from './canvas.js';
import { cached } from './objects.js';

export const EXPRESSIONS = ['neutral', 'happy', 'sad', 'angry', 'fear', 'surprise', 'smirk', 'tired'];

export function portrait(look, expr = 'neutral', mouth = 0, blink = false) {
  const key = `pt:${JSON.stringify(look)}:${expr}:${mouth}:${blink ? 1 : 0}`;
  return cached(key, () => draw(look, expr, mouth, blink));
}

function draw(L, expr, mouth, blink) {
  const S = 48, p = new PixelPainter(S, S);
  const skin = L.skin || '#f1c9a5', skinD = darken(skin, 0.15), skinDD = darken(skin, 0.3), skinL = lighten(skin, 0.12);
  const hair = L.hair || '#4a2e1a', hairD = darken(hair, 0.3), hairL = lighten(hair, 0.22);
  const top = L.top || '#6a5a8a';
  const eye = L.eye || '#3a5a7a';
  // fundo transparente; ombros
  for (let y = 38; y < 48; y++) { const w = 14 + (y - 38) * 1.3; p.hline(Math.round(24 - w), y, Math.round(w * 2), top); }
  p.hline(10, 38, 28, lighten(top, 0.15));
  if (L.tabard) for (let y = 39; y < 48; y++) p.hline(20, y, 8, L.tabard);
  if (L.armor) { for (let y = 39; y < 44; y++) { p.hline(8, y, 9, L.armor); p.hline(31, y, 9, L.armor); } p.hline(8, 39, 9, lighten(L.armor, 0.4)); p.hline(31, 39, 9, lighten(L.armor, 0.4)); }
  if (L.cape) { for (let y = 36; y < 48; y++) { p.hline(4, y, 5, L.cape); p.hline(39, y, 5, L.cape); } }
  // pescoço
  p.rect(19, 32, 10, 7, skinD);
  // cabelo atrás (longo)
  const hs = L.hairStyle ?? 0;
  if (!L.hood && !L.helm && (hs === 2)) { p.rect(9, 12, 30, 28, hairD); }
  if (L.hood) { p.ellipse(24, 22, 17, 19, L.hood); p.rect(7, 22, 34, 18, L.hood); }
  // rosto
  p.ellipse(24, 21, 11, 13, skin);
  p.rect(14, 22, 20, 8, skin);
  for (let y = 28; y < 34; y++) { const w = 10 - (y - 28) * 1.4; p.hline(Math.round(24 - w), y, Math.round(w * 2), skin); }
  // sombreamento lateral
  for (let y = 12; y < 32; y++) { p.set(13 + (y > 26 ? y - 26 : 0), y, skinD); p.set(34 - (y > 26 ? y - 26 : 0), y, skinD); }
  p.hline(17, 34, 14, skinDD);
  // orelhas
  p.rect(11, 19, 3, 6, skin); p.set(11, 20, skinD); p.rect(34, 19, 3, 6, skin); p.set(36, 20, skinD);
  if (L.earring) p.set(12, 25, '#e0c040');
  // olhos
  const ey = 20;
  const eyeL = 18, eyeR = 28;
  const browY = ey - 3;
  const browShape = { neutral: [0, 0], happy: [-1, -1], sad: [1, -1], angry: [-1, 1], fear: [1, -1], surprise: [-2, -2], smirk: [0, -1], tired: [1, 1] }[expr] || [0, 0];
  const browC = L.brow || hairD;
  for (const [ex, side] of [[eyeL, -1], [eyeR, 1]]) {
    // sobrancelha: inclinação depende da expressão
    for (let i = 0; i < 5; i++) {
      const inner = side === -1 ? i / 4 : 1 - i / 4;
      const dy = Math.round(browShape[0] + (inner * (expr === 'angry' ? 2 : expr === 'sad' || expr === 'fear' ? -2 : 0)) + (expr === 'surprise' ? -1 : 0));
      p.set(ex - 1 + i, browY + dy + (expr === 'smirk' && side === 1 ? -1 : 0), browC);
    }
    if (blink || expr === 'tired' && false) { p.hline(ex, ey + 1, 4, skinDD); }
    else {
      const open = expr === 'surprise' || expr === 'fear' ? 4 : expr === 'happy' ? 2 : expr === 'tired' ? 2 : 3;
      p.rect(ex, ey, 4, open, '#f8f4f0');
      p.rect(ex + 1, ey + (open > 2 ? 0 : 0), 2, open, eye);
      p.set(ex + 1, ey, darken(eye, 0.4));
      p.set(ex + 2, ey + 1, '#ffffff');
      p.hline(ex, ey - 1, 4, skinDD);
      if (expr === 'happy') p.hline(ex, ey + 2, 4, skinD);
      if (expr === 'tired') p.hline(ex, ey, 4, skinD);
      if (expr === 'sad') { p.set(ex + (side === -1 ? 0 : 3), ey + 4, '#8ac8f0'); }
    }
  }
  // nariz
  p.vline(24, 22, 5, skinD); p.set(23, 27, skinDD); p.set(25, 27, skinD); p.set(22, 26, skinD);
  // bochechas
  if (expr === 'happy' || L.blush) { p.hline(15, 27, 3, mix(skin, '#e06070', 0.35)); p.hline(30, 27, 3, mix(skin, '#e06070', 0.35)); }
  // boca
  const my = 30, mx = 24;
  const lip = darken(mix(skin, '#c04050', 0.4), 0.1), mouthIn = '#4a1a1e', teeth = '#f4f0ea';
  const smile = { happy: 1, smirk: 0.5, sad: -1, angry: -0.6, fear: -0.4, tired: -0.3 }[expr] || 0;
  if (mouth === 0) {
    for (let i = -3; i <= 3; i++) { const curve = Math.round((Math.abs(i) / 3) * -smile * 1.2); p.set(mx + i + (expr === 'smirk' && i > 0 ? 0 : 0), my + curve + (expr === 'smirk' && i > 1 ? -1 : 0), lip); }
  } else {
    const h = mouth === 1 ? 2 : mouth === 2 ? 3 : 4, w = mouth === 3 ? 2 : 3 + (expr === 'happy' ? 1 : 0);
    p.ellipse(mx, my + 1, w, Math.ceil(h / 2), mouthIn);
    if (mouth >= 2) p.hline(mx - w + 1, my, w * 2 - 1, teeth);
    p.hline(mx - w, my - 1 + (smile < 0 ? 1 : 0), w * 2 + 1, lip);
    if (smile > 0) { p.set(mx - w - 1, my - 1, lip); p.set(mx + w + 1, my - 1, lip); }
  }
  // barba
  if (L.beard) {
    const bc = L.beard;
    for (let y = 26; y < 37; y++) { const w = y < 30 ? 11 : 11 - (y - 30) * 1.2; for (let x = Math.round(24 - w); x < Math.round(24 + w); x++) { if (y >= my - 1 && y <= my + 3 && Math.abs(x - mx) < 5) continue; if ((x + y) % 5 !== 0 || y > 32) p.set(x, y, (x + y) % 3 ? bc : darken(bc, 0.2)); } }
    p.hline(19, my - 2, 10, bc);
  }
  if (L.mustache && !L.beard) { p.hline(19, my - 2, 10, L.mustache); p.set(18, my - 1, L.mustache); p.set(29, my - 1, L.mustache); }
  if (L.scar) { for (let i = 0; i < 6; i++) p.set(29 + (i >> 1), 15 + i, mix(skin, '#a04040', 0.5)); }
  if (L.chinScar) { p.set(26, 33, mix(skin, '#a04040', 0.5)); p.set(27, 32, mix(skin, '#a04040', 0.5)); }
  if (L.wrinkles) { p.hline(17, 16, 4, skinD); p.hline(27, 16, 4, skinD); p.set(16, 24, skinD); p.set(32, 24, skinD); p.hline(19, 13, 10, skinD); }
  if (L.glasses) { for (const ex of [eyeL, eyeR]) { p.hline(ex - 1, ey - 1, 6, '#3a3030'); p.hline(ex - 1, ey + 4, 6, '#3a3030'); p.vline(ex - 1, ey - 1, 6, '#3a3030'); p.vline(ex + 4, ey - 1, 6, '#3a3030'); } p.hline(22, ey, 5, '#3a3030'); }
  if (L.mask) { p.rect(14, 16, 21, 8, L.mask); p.rect(eyeL, ey, 4, 2, '#d8d0ff'); p.rect(eyeR, ey, 4, 2, '#d8d0ff'); p.set(eyeL + 1, ey, '#5a2a8a'); p.set(eyeR + 1, ey, '#5a2a8a'); for (let i = 0; i < 4; i++) p.set(24, 24 + i, L.mask), p.set(23, 26 + i, L.mask); }
  if (L.paint) { p.vline(eyeL + 1, ey + 4, 4, L.paint); p.vline(eyeR + 2, ey + 4, 4, L.paint); }
  // cabelo frente
  if (!L.hood && !L.helm && !L.bald) {
    for (let y = 6; y < 17; y++) { const w = y < 9 ? 7 + (y - 6) * 2 : 13; p.hline(24 - w, y, w * 2, hair); }
    p.rect(11, 12, 4, hs === 2 ? 26 : hs === 1 ? 6 : 12, hair); p.rect(33, 12, 4, hs === 2 ? 26 : hs === 1 ? 6 : 12, hair);
    // franja característica por estilo
    if (hs === 0) for (let x = 14; x < 34; x += 3) p.vline(x, 15, 2 + ((x * 7) % 3), hair);
    if (hs === 3) { p.rect(14, 13, 10, 5, hair); p.set(23, 18, hair); }
    if (hs === 4) { p.ellipse(24, 5, 6, 4, hair); p.ellipse(24, 4, 4, 2, hairL); }
    if (hs === 6) { p.rect(34, 18, 4, 14, hair); }
    for (let x = 15; x < 33; x += 2) p.set(x, 8 + ((x * 3) % 3), hairL);
    p.hline(17, 7, 12, hairL);
  }
  if (L.bald) { p.ellipse(24, 12, 11, 6, skin); p.set(20, 9, skinL); p.set(21, 9, skinL); p.rect(11, 14, 3, 10, hair); p.rect(34, 14, 3, 10, hair); }
  if (L.hood) { for (let y = 5; y < 15; y++) { const w = y < 9 ? 8 + (y - 5) * 2 : 15; p.hline(24 - w, y, w * 2, L.hood); } p.rect(9, 14, 5, 22, L.hood); p.rect(34, 14, 5, 22, L.hood); p.hline(14, 14, 20, darken(L.hood, 0.3)); }
  if (L.helm) { for (let y = 4; y < 16; y++) { const w = y < 8 ? 8 + (y - 4) * 2 : 14; p.hline(24 - w, y, w * 2, L.helm); } p.hline(10, 15, 28, darken(L.helm, 0.35)); p.rect(10, 15, 4, 12, L.helm); p.rect(34, 15, 4, 12, L.helm); p.hline(14, 6, 10, lighten(L.helm, 0.4)); if (L.plume) p.rect(22, 0, 4, 5, L.plume); }
  if (L.hat) { p.rect(6, 9, 36, 3, L.hat); p.rect(13, 1, 22, 9, L.hat); p.hline(13, 7, 22, darken(L.hat, 0.3)); }
  if (L.crown) { p.rect(14, 5, 20, 4, '#e0b030'); for (const x of [14, 19, 24, 29, 33]) p.rect(x, 2, 2, 3, '#e0b030'); p.set(24, 6, '#d03040'); p.set(18, 6, '#40a0d0'); p.set(30, 6, '#40a0d0'); }
  if (L.circlet) { p.hline(13, 11, 22, '#c8a040'); p.set(24, 11, '#60d0a0'); }
  if (L.antlers) { p.line(14, 8, 8, 0, '#c8b890'); p.line(11, 4, 7, 4, '#c8b890'); p.line(34, 8, 40, 0, '#c8b890'); p.line(37, 4, 41, 4, '#c8b890'); }
  if (L.headband) p.hline(13, 12, 22, L.headband);
  // gotas de suor no medo
  if (expr === 'fear') { p.set(35, 14, '#a0d8ff'); p.set(35, 15, '#a0d8ff'); p.set(36, 16, '#a0d8ff'); }
  if (expr === 'angry') { p.set(36, 9, '#e03030'); p.set(38, 9, '#e03030'); p.set(37, 8, '#e03030'); p.set(37, 10, '#e03030'); }
  p.outline('#1c1520');
  return p.done();
}
