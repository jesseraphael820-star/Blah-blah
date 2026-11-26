// Sprites procedurais de cenário: árvores, rochas, plantas, construções regionais e adereços.
import { PixelPainter, makeCanvas, darken, lighten, mix } from './canvas.js';
import { mulberry32, hashStr } from '../core/util.js';

const cache = new Map();
export function cached(key, fn) { let v = cache.get(key); if (!v) { v = fn(); cache.set(key, v); } return v; }
const OUT = '#1c1520';

// ---------- Emblemas das facções (7x7) ----------
export const EMBLEMS = {
  varden: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..#.#..', '.#...#.'],
  eldoria: ['...#...', '..###..', '.##.##.', '###.###', '.##.##.', '...#...', '...#...'],
  drakmor: ['#..#..#', '#..#..#', '##.#.##', '.#####.', '..###..', '...#...', '...#...'],
  solaria: ['#..#..#', '.#.#.#.', '..###..', '###.###', '..###..', '.#.#.#.', '#..#..#'],
  frostheim: ['...#...', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '...#...'],
  cinzamar: ['...#...', '..##...', '..###..', '.####..', '.#####.', '#######', '.#####.'],
  ravencross: ['.......', '.##....', '####...', '.######', '..#####', '...##..', '..#..#.'],
};
export function drawEmblem(p, faction, x, y, color) {
  const e = EMBLEMS[faction]; if (!e) return;
  for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (e[j][i] === '#') p.set(x + i, y + j, color);
}
export function emblemCanvas(faction, color, bg, scale = 4) {
  return cached(`emb:${faction}:${color}:${bg}:${scale}`, () => {
    const c = makeCanvas(9 * scale, 9 * scale);
    if (bg) { c.ctx.fillStyle = bg; c.ctx.fillRect(0, 0, c.width, c.height); }
    c.ctx.fillStyle = color; const e = EMBLEMS[faction];
    if (e) for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (e[j][i] === '#') c.ctx.fillRect((i + 1) * scale, (j + 1) * scale, scale, scale);
    return c;
  });
}

// ---------- Árvores ----------
function canopyBlob(p, r, cx, cy, rad, cols, lumps = 7) {
  const [dark, mid, light, hi] = cols;
  const blobs = [];
  for (let i = 0; i < lumps; i++) { const a = (i / lumps) * Math.PI * 2 + r() * 0.5; const d = rad * (0.45 + r() * 0.3); blobs.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, rad * (0.45 + r() * 0.25)]); }
  blobs.push([cx, cy, rad * 0.75]);
  for (const [bx, by, br] of blobs) p.circle(Math.round(bx), Math.round(by), Math.round(br), dark);
  for (const [bx, by, br] of blobs) p.circle(Math.round(bx - 1), Math.round(by - 1.5), Math.round(br - 1.5), mid);
  for (const [bx, by, br] of blobs) if (by < cy + 2) p.circle(Math.round(bx - 2), Math.round(by - 3), Math.max(1, Math.round(br - 4)), light);
  for (let i = 0; i < rad * 4; i++) { const x = Math.round(cx + (r() - 0.5) * rad * 1.8), y = Math.round(cy + (r() - 0.6) * rad * 1.5); if (p.alpha(x, y)) p.set(x, y, r() < 0.5 ? hi : dark); }
}
const TREE_COLS = {
  oak: ['#2c4a22', '#3f6a2e', '#5a8f3c', '#7fb04e'], autumn: ['#6a2e14', '#a04a1c', '#d07a2a', '#f0b04a'], gold: ['#6a5014', '#a08020', '#d0b03a', '#f0de7a'],
  birch: ['#3a5a2a', '#5a8a3a', '#8ab85a', '#b8dc7a'], willow: ['#22341e', '#33492a', '#4a6236', '#647a44'], swamp: ['#2a3420', '#3a4628', '#4e5a32', '#6a7440'],
  ash: ['#3a3634', '#4e4844', '#625a54', '#7a726a'], palm: ['#2a5a2a', '#3a7a34', '#5aa044', '#8ac860'], pine: ['#1a3a2a', '#24503a', '#356a48', '#4a8a5a'],
  snowpine: ['#1e3a34', '#2a5048', '#3a6a5a', '#ffffff'], ancient: ['#1e3a1a', '#2e5a26', '#467e34', '#6aa848'],
};
export function treeSprite(kind, variant = 0) {
  return cached(`tree:${kind}:${variant}`, () => {
    const r = mulberry32(hashStr(kind) + variant * 97);
    const big = kind === 'ancient';
    const W = big ? 72 : 40, H = big ? 88 : 52;
    const p = new PixelPainter(W, H);
    const bark = kind === 'birch' ? '#e8e4dc' : kind === 'ash' ? '#3a302a' : kind === 'palm' ? '#9a7a4a' : '#5a3e26';
    const barkD = kind === 'birch' ? '#4a4440' : darken(bark, 0.35);
    const cx = W >> 1;
    if (kind === 'pine' || kind === 'snowpine') {
      p.rect(cx - 2, H - 12, 4, 11, bark); p.vline(cx + 1, H - 12, 11, barkD);
      const cols = TREE_COLS[kind];
      for (let layer = 0; layer < 4; layer++) {
        const y0 = 6 + layer * 9, hw = 6 + layer * 3.4;
        for (let y = 0; y < 13; y++) { const w = Math.round((y / 13) * hw); for (let x = -w; x <= w; x++) p.set(cx + x, y0 + y, x < -w / 3 ? cols[2] : x > w / 2 ? cols[0] : cols[1]); }
        for (let x = -hw; x <= hw; x += 2) p.set(cx + x, y0 + 12, cols[0]);
        if (kind === 'snowpine') for (let x = -Math.round(hw * 0.7); x <= hw * 0.3; x++) { p.set(cx + x, y0 + 9 + (x & 1), '#f4f8fc'); p.set(cx + x, y0 + 10, '#dce8f0'); }
      }
      if (kind === 'snowpine') { p.set(cx, 5, '#fff'); p.set(cx - 1, 6, '#fff'); }
      p.outline(OUT);
      return { c: p.done(), ox: cx, oy: H - 2, box: { x: -3, y: -5, w: 6, h: 5 }, h: H };
    }
    if (kind === 'palm') {
      for (let y = 0; y < 30; y++) { const x = Math.round(cx + Math.sin(y / 12) * 4); p.rect(x - 2, H - 3 - y, 4, 1, y % 3 === 0 ? barkD : bark); }
      const top = [cx + Math.round(Math.sin(30 / 12) * 4), H - 33];
      const cols = TREE_COLS.palm;
      for (let f = 0; f < 6; f++) {
        const a = -Math.PI / 2 + (f - 2.5) * 0.65;
        for (let i = 0; i < 15; i++) { const x = top[0] + Math.cos(a) * i, y = top[1] + Math.sin(a) * i * 0.6 + (i * i) / 18; p.set(x, y, cols[1]); p.set(x, y + 1, cols[0]); if (i % 2) p.set(x, y - 1, cols[2]); }
      }
      p.circle(top[0], top[1] + 2, 2, '#6a4a20');
      p.outline(OUT);
      return { c: p.done(), ox: cx, oy: H - 2, box: { x: -3, y: -4, w: 6, h: 4 }, h: H };
    }
    // tronco com raízes
    const tw = big ? 10 : 5, th = big ? 26 : 16;
    p.rect(cx - (tw >> 1), H - th - 2, tw, th, bark);
    p.rect(cx - (tw >> 1) - 1, H - 4, tw + 2, 2, bark);
    for (let y = H - th - 2; y < H - 2; y++) { p.set(cx + (tw >> 1) - 1, y, barkD); if (kind === 'birch' && r() < 0.25) p.hline(cx - (tw >> 1), y, 2, barkD); else if (r() < 0.15) p.set(cx - (tw >> 1) + 1, y, darken(bark, 0.2)); }
    if (kind === 'ash') {
      // árvore morta: galhos secos
      const br = (x, y, a, len, w) => { for (let i = 0; i < len; i++) { x += Math.cos(a); y += Math.sin(a); p.set(x, y, bark); if (w > 1) p.set(x + 1, y, barkD); if (r() < 0.12 && len > 4) br(x, y, a + (r() - 0.5) * 1.6, len >> 1, 1); } };
      br(cx, H - th, -Math.PI / 2 - 0.5, 16, 2); br(cx, H - th, -Math.PI / 2 + 0.6, 15, 2); br(cx, H - th - 4, -Math.PI / 2, 14, 2);
      p.outline(OUT);
      return { c: p.done(), ox: cx, oy: H - 2, box: { x: -3, y: -5, w: 6, h: 5 }, h: H };
    }
    const cols = TREE_COLS[kind] || TREE_COLS.oak;
    const rad = big ? 30 : 15;
    canopyBlob(p, r, cx, big ? 34 : 18, rad, cols, big ? 11 : 7);
    if (kind === 'willow' || kind === 'swamp') for (let i = 0; i < 14; i++) { const x = cx - rad + Math.floor(r() * rad * 2); const y0 = 20 + Math.floor(r() * 8); for (let y = 0; y < 10 + r() * 8; y++) p.set(x, y0 + y, y % 3 ? cols[1] : cols[0]); }
    if (kind === 'oak' && variant % 3 === 2) for (let i = 0; i < 5; i++) { const x = cx - 8 + Math.floor(r() * 16), y = 10 + Math.floor(r() * 14); if (p.alpha(x, y)) { p.set(x, y, '#d8302a'); } }
    p.outline(OUT);
    return { c: p.done(), ox: cx, oy: H - 2, box: { x: -(tw >> 1) - 1, y: -5, w: tw + 2, h: 5 }, h: H, canopy: true };
  });
}

// ---------- Rochas, arbustos, plantas ----------
export function rockSprite(kind = 'rock', variant = 0) {
  return cached(`rock:${kind}:${variant}`, () => {
    const r = mulberry32(variant * 13 + hashStr(kind));
    const big = kind === 'boulder';
    const W = big ? 28 : 16, H = big ? 22 : 12;
    const p = new PixelPainter(W, H);
    const base = kind === 'snow' ? '#8a929a' : kind === 'ash' ? '#4a4644' : kind === 'ore' ? '#6a625c' : kind === 'mossy' ? '#6e7466' : '#7e766e';
    const cx = W / 2, cy = H / 2 + 1;
    p.ellipse(Math.round(cx), Math.round(cy), Math.round(W / 2 - 1), Math.round(H / 2 - 1), darken(base, 0.2));
    p.ellipse(Math.round(cx - 1), Math.round(cy - 1), Math.round(W / 2 - 2), Math.round(H / 2 - 2), base);
    p.ellipse(Math.round(cx - 2), Math.round(cy - 2), Math.round(W / 4), Math.round(H / 4), lighten(base, 0.15));
    for (let i = 0; i < W; i++) { const x = Math.floor(r() * W), y = Math.floor(r() * H); if (p.alpha(x, y)) p.set(x, y, r() < 0.5 ? darken(base, 0.3) : lighten(base, 0.25)); }
    if (kind === 'ore') for (let i = 0; i < 6; i++) { const x = 3 + Math.floor(r() * (W - 6)), y = 3 + Math.floor(r() * (H - 5)); p.set(x, y, '#e8a050'); p.set(x + 1, y, '#c0c8d0'); }
    if (kind === 'gem') for (let i = 0; i < 4; i++) { const x = 3 + Math.floor(r() * (W - 6)), y = 3 + Math.floor(r() * (H - 5)); p.set(x, y, '#7ae0f0'); p.set(x, y + 1, '#3aa0c0'); }
    if (kind === 'snow') { for (let x = 2; x < W - 2; x++) { p.set(x, 2 + ((x * 7) % 3 === 0 ? 1 : 0), '#f4f8fc'); p.set(x, 3, '#e0ecf4'); } }
    if (kind === 'mossy') for (let i = 0; i < 8; i++) { const x = Math.floor(r() * W), y = Math.floor(r() * H / 2); if (p.alpha(x, y)) p.set(x, y, '#4a7a34'); }
    p.outline(OUT);
    return { c: p.done(), ox: W >> 1, oy: H - 2, box: { x: -(W >> 1) + 2, y: -H + 5, w: W - 4, h: H - 5 } };
  });
}

export function plantSprite(kind, variant = 0) {
  return cached(`plant:${kind}:${variant}`, () => {
    const r = mulberry32(variant * 31 + hashStr(kind));
    let p, W = 16, H = 16;
    const mk = (w, h) => { W = w; H = h; p = new PixelPainter(w, h); };
    switch (kind) {
      case 'bush': case 'berry': case 'snowbush': case 'ashbush': {
        mk(20, 16);
        const cols = kind === 'ashbush' ? ['#3a3a32', '#4e4c40', '#626050', '#76745e'] : kind === 'snowbush' ? ['#2a4a40', '#3a6050', '#ffffff', '#e0ecf4'] : ['#2a4a1e', '#3e6a2a', '#5a8f3a', '#7ab04a'];
        canopyBlob(p, r, 10, 9, 7, cols, 5);
        if (kind === 'berry') for (let i = 0; i < 6; i++) { const x = 4 + Math.floor(r() * 12), y = 4 + Math.floor(r() * 9); if (p.alpha(x, y)) p.set(x, y, '#c02848'); }
        break;
      }
      case 'herb': {
        mk(12, 12);
        for (let i = 0; i < 5; i++) { const x = 2 + i * 2; p.vline(x, 5 + (i % 2), 6, '#3a7a2a'); p.set(x - 1, 6 + (i % 2), '#5aa03a'); }
        p.set(4, 3, '#e8f0f8'); p.set(6, 2, '#e8f0f8'); p.set(8, 3, '#e8f0f8'); p.set(5, 3, '#f0d040'); p.set(7, 2, '#c0a0f0');
        break;
      }
      case 'mushroom': {
        mk(12, 10);
        for (const [x, y, s] of [[3, 5, 2], [7, 4, 3], [9, 7, 1.5]]) { p.vline(x, y, 4, '#e8dcc0'); p.ellipse(x, y, Math.ceil(s), Math.ceil(s * 0.6), '#a03a8a'); p.set(x - 1, y - 1, '#e8a0e0'); }
        break;
      }
      case 'reeds': {
        mk(12, 18);
        for (let i = 0; i < 6; i++) { const x = 1 + i * 2; const h = 9 + Math.floor(r() * 6); p.vline(x, 17 - h, h, i % 2 ? '#6a7a3a' : '#8a9a4a'); if (i % 2 === 0) { p.rect(x, 17 - h - 1, 1, 3, '#5a3a20'); } }
        break;
      }
      case 'fern': {
        mk(16, 12);
        for (let f = 0; f < 5; f++) { const a = -Math.PI + (f / 4) * Math.PI; for (let i = 0; i < 7; i++) { p.set(8 + Math.cos(a) * i, 10 + Math.sin(a) * i * 0.8, f % 2 ? '#3e7a30' : '#5a9a3c'); } }
        break;
      }
      case 'flowers': {
        mk(14, 10);
        const fc = ['#f4e04d', '#e8607c', '#a77de8', '#ffffff', '#ff9b4a'];
        for (let i = 0; i < 6; i++) { const x = 1 + Math.floor(r() * 12), y = 3 + Math.floor(r() * 6); p.vline(x, y, 3, '#3a7a2a'); p.set(x, y - 1, fc[Math.floor(r() * fc.length)]); }
        break;
      }
      case 'tallgrass': {
        mk(14, 12);
        for (let i = 0; i < 7; i++) { const x = 1 + i * 2; const h = 5 + Math.floor(r() * 6); for (let y = 0; y < h; y++) p.set(x + (y > h - 3 ? 1 : 0), 11 - y, y > h - 2 ? '#a0c060' : '#5a8a3a'); }
        break;
      }
      case 'stump': {
        mk(16, 12);
        p.ellipse(8, 8, 6, 3, '#5a3e26'); p.rect(2, 4, 12, 5, '#5a3e26'); p.ellipse(8, 4, 6, 2, '#a07a4a'); p.ellipse(8, 4, 3, 1, '#7a5a34'); p.set(8, 4, '#5a3e26');
        break;
      }
      case 'log': {
        mk(28, 12);
        p.rect(2, 3, 22, 7, '#6a4a2a'); p.hline(2, 3, 22, '#8a6a3a'); p.hline(2, 9, 22, '#4a321e');
        p.ellipse(24, 6, 3, 3, '#a07a4a'); p.circle(24, 6, 1, '#6a4a2a');
        for (let i = 0; i < 5; i++) p.set(4 + i * 4, 5 + (i % 2) * 2, '#4a321e');
        break;
      }
      case 'cactus': case 'deadbush': {
        mk(14, 14);
        for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.4; for (let k = 0; k < 8; k++) p.set(7 + Math.cos(a) * k, 13 + Math.sin(a) * k, '#6a5a44'); }
        break;
      }
      case 'crystal': {
        mk(14, 16);
        for (const [x, h] of [[4, 8], [7, 12], [10, 7]]) for (let y = 0; y < h; y++) { const w = y < 2 ? 0 : 1; p.hline(x - w, 15 - y, 1 + w * 2, y > h - 3 ? '#c0f0ff' : '#5ab0d0'); }
        break;
      }
      default: mk(8, 8); p.rect(2, 2, 4, 4, '#ff00ff');
    }
    p.outline(OUT);
    return { c: p.done(), ox: W >> 1, oy: H - 2 };
  });
}

// ---------- Construções regionais ----------
export const STYLES = {
  varden: { wall: '#e4d6b8', beam: '#5a3a24', roof: '#5a4a7a', roofD: '#3e3258', trim: '#7b3fa0', stone: '#8a8278', door: '#6a3e22', win: '#f0c060' },
  eldoria: { wall: '#8a6a44', beam: '#5a4024', roof: '#4a6a2a', roofD: '#33501c', trim: '#3f9a3a', stone: '#6e7a5a', door: '#5a3a20', win: '#d0f080', moss: true },
  drakmor: { wall: '#5a5050', beam: '#3a3030', roof: '#7a2a22', roofD: '#561a16', trim: '#b8302a', stone: '#4a4242', door: '#3a2418', win: '#ff9040' },
  solaria: { wall: '#f0e6d2', beam: '#b08a5a', roof: '#d0802a', roofD: '#a85e1c', trim: '#e0b52a', stone: '#d8c8a8', door: '#7a4a24', win: '#80d0f0' },
  frostheim: { wall: '#7a5a3e', beam: '#4a3424', roof: '#4a5a7a', roofD: '#33405a', trim: '#3a6fc4', stone: '#8a929a', door: '#4a3020', win: '#ffd080', snow: true },
  cinzamar: { wall: '#7a7672', beam: '#4a4644', roof: '#3a3a42', roofD: '#26262c', trim: '#9a9a9a', stone: '#5a5654', door: '#3a3230', win: '#ff8030', chimney: true },
  ravencross: { wall: '#3a3238', beam: '#1e1a1e', roof: '#26202a', roofD: '#16121a', trim: '#5a4a6a', stone: '#3a3638', door: '#2a1e22', win: '#b080ff' },
  neutral: { wall: '#a08a6a', beam: '#5a4030', roof: '#6a5a4a', roofD: '#4a3e32', trim: '#8a7a5a', stone: '#7a746c', door: '#5a3a24', win: '#f0c060' },
};

// type: house | tavern | smithy | hall | stable | shop | temple | tower | tent | archive | fort
export function buildingSprite(style, type, variant = 0, burned = false) {
  return cached(`bld:${style}:${type}:${variant}:${burned ? 1 : 0}`, () => {
    const S = STYLES[style] || STYLES.neutral;
    const r = mulberry32(hashStr(style + type) + variant * 7);
    const dims = { house: [64, 48, 22], shop: [64, 50, 22], tavern: [88, 60, 26], smithy: [72, 50, 22], hall: [128, 84, 36], archive: [80, 62, 26], temple: [80, 70, 28],
      stable: [80, 46, 20], tower: [32, 72, 52], tent: [40, 32, 14], fort: [64, 56, 24] }[type] || [64, 48, 22];
    const [W, H, wallH] = dims;
    const p = new PixelPainter(W, H);
    const wallTop = H - wallH;
    if (type === 'tent') {
      const col = S.trim;
      for (let y = 0; y < 24; y++) { const w = Math.round(4 + y * 0.75); p.hline(20 - w, 6 + y, w * 2, y % 4 === 0 ? darken(col, 0.3) : x0(col, y)); }
      for (let y = 18; y < 30; y++) { const w = Math.round((y - 18) * 0.45); p.hline(20 - w, y, w * 2 + 1, '#2a1e18'); }
      p.vline(20, 2, 6, '#5a3e26'); p.set(21, 2, col); p.set(22, 3, col);
      p.outline(OUT);
      return { c: p.done(), ox: W >> 1, oy: H - 2, box: { x: -16, y: -10, w: 32, h: 9 }, door: { x: 0, y: 0 }, w: W, h: H };
    }
    function x0(c, y) { return y % 2 ? c : lighten(c, 0.08); }
    if (type === 'tower') {
      p.rect(4, 20, 24, H - 20, S.stone);
      for (let y = 20; y < H; y += 4) for (let x = 4; x < 28; x += 6) p.hline(x + ((y / 4) % 2 ? 3 : 0), y, 5, darken(S.stone, 0.25));
      p.rect(2, 14, 28, 7, darken(S.stone, 0.1)); for (let x = 2; x < 30; x += 4) p.rect(x, 10, 2, 4, S.stone);
      p.rect(13, 30, 6, 8, '#1a1418'); p.rect(14, 31, 4, 6, S.win);
      p.rect(12, H - 12, 8, 11, S.door);
      p.vline(16, 0, 10, '#4a3a2a'); p.rect(17, 1, 7, 5, S.trim);
      p.outline(OUT);
      return { c: p.done(), ox: W >> 1, oy: H - 2, box: { x: -13, y: -18, w: 26, h: 17 }, door: { x: 0, y: -1 }, w: W, h: H };
    }
    // paredes
    const wl = type === 'stable' ? 0 : 0;
    const stoneBase = style === 'drakmor' || style === 'cinzamar' || type === 'hall' || type === 'temple' || type === 'fort';
    for (let y = wallTop; y < H - 1; y++) for (let x = wl + 2; x < W - 2; x++) {
      let c = S.wall;
      if (stoneBase) { const row = Math.floor((y - wallTop) / 4), off = row % 2 ? 4 : 0; c = (y - wallTop) % 4 === 0 || (x + off) % 8 === 0 ? darken(S.wall, 0.22) : hashN(x >> 3, row) < 0.2 ? darken(S.wall, 0.08) : S.wall; }
      else if (style === 'eldoria' || style === 'frostheim') c = (y - wallTop) % 4 === 0 ? darken(S.wall, 0.3) : (y - wallTop) % 4 === 1 ? lighten(S.wall, 0.1) : S.wall;
      p.set(x, y, c);
    }
    if (!stoneBase && style !== 'eldoria' && style !== 'frostheim') {
      // enxaimel
      for (let x = 2; x < W - 2; x += 12) p.vline(x, wallTop, wallH - 1, S.beam);
      p.vline(W - 3, wallTop, wallH - 1, S.beam);
      p.hline(2, wallTop + 1, W - 4, S.beam); p.hline(2, H - 4, W - 4, S.beam);
      for (let x = 2; x < W - 14; x += 12) for (let k = 0; k < 10 && wallTop + 2 + k < H - 4; k++) { p.set(x + 1 + k, wallTop + 2 + k, S.beam); }
    }
    p.hline(2, H - 2, W - 4, darken(S.stone, 0.3)); p.hline(2, H - 3, W - 4, S.stone);
    // janelas
    const doorX = W >> 1;
    const winY = wallTop + 6;
    const wins = type === 'stable' ? [] : type === 'hall' ? [16, 34, 88, 106] : W > 70 ? [12, W - 22] : [10, W - 18];
    for (const wx of wins) { p.rect(wx, winY, 8, 8, '#2a1e18'); p.rect(wx + 1, winY + 1, 6, 6, S.win); p.vline(wx + 4, winY + 1, 6, '#2a1e18'); p.hline(wx + 1, winY + 4, 6, '#2a1e18'); p.hline(wx - 1, winY + 8, 10, darken(S.beam, 0.1)); if (r() < 0.6 && style !== 'drakmor') { p.hline(wx, winY + 9, 8, '#3a6a2a'); p.set(wx + 2, winY + 9, '#e8607c'); p.set(wx + 5, winY + 9, '#f4e04d'); } }
    // porta
    const dw = type === 'hall' ? 16 : type === 'stable' ? 20 : 10, dh = type === 'hall' ? 20 : 14;
    p.rect(doorX - (dw >> 1) - 1, H - 3 - dh - 1, dw + 2, dh + 1, darken(S.beam, 0.2));
    p.rect(doorX - (dw >> 1), H - 3 - dh, dw, dh, type === 'stable' ? '#2a1e18' : S.door);
    if (type !== 'stable') { for (let y = H - 3 - dh; y < H - 3; y += 3) p.hline(doorX - (dw >> 1), y, dw, darken(S.door, 0.25)); p.set(doorX + (dw >> 1) - 3, H - 3 - (dh >> 1), '#d8b04a'); }
    // telhado
    const roofH = H - wallH + 4;
    for (let y = 0; y < roofH; y++) {
      const inset = Math.max(0, Math.round((roofH - y) * 0.15));
      for (let x = inset; x < W - inset; x++) {
        let c = (y % 4 === 0) ? S.roofD : ((x + (Math.floor(y / 4) % 2) * 3) % 6 === 0 ? darken(S.roof, 0.12) : S.roof);
        if (y > roofH - 3) c = darken(S.roofD, 0.2);
        if (x < inset + 2) c = lighten(S.roof, 0.12);
        if (S.snow && y < roofH * 0.55 && hashN(x, y) > 0.15) c = y % 4 === 0 ? '#d0dce6' : '#f2f6fa';
        if (S.moss && hashN(x * 3, y * 5) < 0.18) c = '#6a8a34';
        if (burned && hashN(x * 7, y * 3) < 0.45) c = hashN(x, y * 9) < 0.5 ? '#1a1614' : '#3a2a22';
        p.set(x, y, c);
      }
    }
    // cumeeira e detalhes
    p.hline(Math.round(roofH * 0.15), 0, W - Math.round(roofH * 0.3), darken(S.roofD, 0.3));
    if (S.chimney || type === 'smithy' || type === 'tavern') { const cx = W - 18; p.rect(cx, -2 + 2, 6, 10, S.stone); p.rect(cx - 1, 1, 8, 2, darken(S.stone, 0.3)); }
    if (type === 'hall' || type === 'temple' || type === 'fort') {
      // faixas com a cor da facção
      for (const bx of [8, W - 16]) { p.rect(bx, wallTop + 2, 8, 16, S.trim); p.rect(bx, wallTop + 18, 8, 2, darken(S.trim, 0.3)); drawEmblem(p, style, bx + 1, wallTop + 5, lighten(S.trim, 0.6)); p.set(bx, wallTop + 20, S.trim); p.set(bx + 7, wallTop + 20, S.trim); }
    }
    if (type === 'tavern' || type === 'shop' || type === 'smithy') {
      const sx = doorX + 10; p.hline(sx, wallTop + 3, 10, '#4a3020'); p.rect(sx + 2, wallTop + 4, 10, 7, '#8a6a3a'); p.rect(sx + 3, wallTop + 5, 8, 5, type === 'tavern' ? '#c08a2a' : type === 'smithy' ? '#6a6a7a' : '#4a8a3a');
    }
    if (type === 'smithy') { p.rect(4, H - 14, 12, 10, '#3a2a22'); p.rect(6, H - 12, 8, 6, '#ff7a20'); p.rect(7, H - 11, 6, 3, '#ffd040'); }
    if (type === 'stable') { for (let x = 4; x < W - 4; x += 8) p.vline(x, wallTop, wallH - 2, S.beam); p.rect(6, H - 10, 10, 6, '#d8b850'); p.rect(W - 18, H - 9, 10, 5, '#d8b850'); }
    if (burned) for (let i = 0; i < 40; i++) { const x = Math.floor(r() * W), y = wallTop + Math.floor(r() * wallH); if (p.alpha(x, y)) p.set(x, y, r() < 0.5 ? '#1a1614' : '#2e2420'); }
    p.outline(OUT);
    const box = { x: -(W >> 1) + 2, y: -wallH + 4, w: W - 4, h: wallH - 4 };
    return { c: p.done(), ox: W >> 1, oy: H - 2, box, door: { x: 0, y: -1 }, w: W, h: H };
  });
}
function hashN(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

// ---------- Adereços ----------
export function propSprite(kind, a = '', b = 0) {
  return cached(`prop:${kind}:${a}:${b}`, () => {
    let p, W, H, box = null, oy;
    const mk = (w, h) => { W = w; H = h; p = new PixelPainter(w, h); };
    switch (kind) {
      case 'fenceH': mk(16, 14); for (const x of [1, 14]) p.rect(x, 2, 2, 11, '#6a4a2a'); p.hline(0, 5, 16, '#8a6a3a'); p.hline(0, 9, 16, '#8a6a3a'); p.hline(0, 6, 16, '#5a3e24'); box = { x: -8, y: -4, w: 16, h: 4 }; break;
      case 'fenceV': mk(6, 20); p.rect(2, 0, 2, 19, '#6a4a2a'); p.vline(3, 0, 19, '#8a6a3a'); box = { x: -2, y: -16, w: 4, h: 16 }; break;
      case 'palisade': mk(16, 28); for (let x = 0; x < 16; x += 4) { p.rect(x, 3, 4, 24, x % 8 ? '#6a4a2a' : '#7a5632'); p.set(x + 1, 2, '#7a5632'); p.set(x + 1, 1, '#8a6a3a'); } p.hline(0, 10, 16, '#4a321e'); p.hline(0, 20, 16, '#4a321e'); box = { x: -8, y: -6, w: 16, h: 6 }; break;
      case 'stonewall': mk(16, 28); for (let y = 4; y < 28; y++) for (let x = 0; x < 16; x++) p.set(x, y, (y % 5 === 0 || (x + (Math.floor(y / 5) % 2) * 4) % 8 === 0) ? darken(a || '#6a625a', 0.3) : (a || '#6a625a')); p.rect(0, 0, 4, 4, a || '#6a625a'); p.rect(8, 0, 4, 4, a || '#6a625a'); box = { x: -8, y: -8, w: 16, h: 8 }; break;
      case 'torch': mk(8, 22); p.rect(3, 6, 2, 15, '#5a3e26'); p.rect(2, 5, 4, 2, '#3a3a3a'); break;
      case 'lamppost': mk(10, 30); p.rect(4, 8, 2, 21, '#2a2a2e'); p.rect(2, 2, 6, 7, '#2a2a2e'); p.rect(3, 3, 4, 5, '#ffd070'); p.hline(1, 1, 8, '#2a2a2e'); box = { x: -2, y: -3, w: 4, h: 3 }; break;
      case 'banner': { mk(14, 40); p.rect(1, 2, 2, 37, '#5a3e26'); p.set(1, 1, '#d8b04a'); p.set(2, 1, '#d8b04a'); const col = a || '#888';
        for (let y = 0; y < 16; y++) for (let x = 0; x < 10; x++) { const wave = Math.round(Math.sin((x + b * 2) * 0.7) * 1); p.set(3 + x, 4 + y + wave, y === 0 ? lighten(col, 0.2) : x === 9 ? darken(col, 0.2) : col); }
        for (let x = 0; x < 10; x += 2) p.set(3 + x, 20 + Math.round(Math.sin((x + b * 2) * 0.7)), darken(col, 0.3));
        box = { x: -1, y: -3, w: 3, h: 3 }; break; }
      case 'chest': { mk(16, 14); const open = b === 1; const wood = a === 'gold' ? '#8a5a2a' : '#7a4e2a';
        p.rect(1, 5, 14, 8, wood); p.hline(1, 8, 14, '#3a2414'); p.rect(1, 12, 14, 1, '#3a2414');
        if (!open) { p.rect(1, 2, 14, 4, lighten(wood, 0.1)); p.hline(2, 1, 12, lighten(wood, 0.15)); } else { p.rect(1, 0, 14, 3, darken(wood, 0.2)); p.rect(2, 5, 12, 2, '#1a1010'); p.set(5, 5, '#f0d040'); p.set(9, 5, '#f0d040'); }
        const band = a === 'gold' ? '#f0c040' : '#a0a0a8'; p.vline(3, 2, 11, band); p.vline(12, 2, 11, band); p.rect(7, 6, 2, 3, band); box = { x: -7, y: -6, w: 14, h: 6 }; break; }
      case 'barrel': mk(12, 16); p.ellipse(6, 8, 5, 7, '#7a4e2a'); p.hline(1, 4, 10, '#5a5a62'); p.hline(1, 11, 10, '#5a5a62'); p.ellipse(6, 2, 4, 1, '#9a6a3a'); for (let y = 2; y < 15; y++) p.set(4, y, '#5a361c'); box = { x: -5, y: -6, w: 10, h: 6 }; break;
      case 'crate': mk(14, 14); p.rect(1, 1, 12, 12, '#9a6e3a'); p.rect(1, 1, 12, 2, '#b88a4a'); p.line(2, 3, 11, 12, '#6a4a24'); p.line(11, 3, 2, 12, '#6a4a24'); p.hline(1, 12, 12, '#5a3a1e'); box = { x: -6, y: -7, w: 12, h: 7 }; break;
      case 'well': mk(26, 30); p.ellipse(13, 22, 11, 6, '#7a746c'); p.ellipse(13, 21, 8, 4, '#1a2a3a'); p.rect(3, 4, 2, 18, '#5a3e26'); p.rect(21, 4, 2, 18, '#5a3e26'); for (let y = 0; y < 6; y++) p.hline(1 + y, y, 24 - y * 2, y % 2 ? '#7a3a2a' : '#8a4a32'); p.vline(13, 6, 10, '#a08a6a'); p.rect(11, 15, 4, 3, '#6a4a2a'); box = { x: -11, y: -9, w: 22, h: 9 }; break;
      case 'sign': mk(16, 20); p.rect(7, 8, 2, 11, '#5a3e26'); p.rect(1, 2, 14, 8, '#9a7a4a'); p.hline(1, 2, 14, '#b89a5a'); p.hline(3, 5, 10, '#4a3020'); p.hline(3, 7, 7, '#4a3020'); box = { x: -2, y: -3, w: 4, h: 3 }; break;
      case 'campfire': { mk(18, 18); p.ellipse(9, 14, 7, 3, '#4a4440'); for (let i = 0; i < 6; i++) p.set(3 + i * 2.4, 14 + (i % 2), '#7a746c');
        p.line(4, 15, 13, 11, '#5a3a20'); p.line(5, 11, 14, 15, '#6a4426');
        if (b !== 9) { const f = b % 3; const fl = [[9, 4 + f], [7, 7], [11, 6 - f], [8, 9], [10, 9]]; for (const [x, y] of fl) { p.vline(x, y, 13 - y, '#ff7a20'); } p.vline(9, 7 + f, 5, '#ffd040'); p.set(8, 10, '#fff0a0'); }
        box = { x: -6, y: -5, w: 12, h: 5 }; break; }
      case 'dummy': mk(16, 28); p.rect(7, 12, 2, 15, '#6a4a2a'); p.rect(3, 12, 10, 2, '#6a4a2a'); p.ellipse(8, 16, 4, 6, '#c8a860'); p.circle(8, 7, 4, '#d8b870'); p.hline(5, 16, 7, '#8a6a3a'); p.set(7, 6, '#4a3020'); p.set(9, 6, '#4a3020'); box = { x: -4, y: -4, w: 8, h: 4 }; break;
      case 'hay': mk(20, 14); p.ellipse(10, 8, 9, 5, '#c8a840'); for (let i = 0; i < 12; i++) p.set(2 + (i * 7) % 16, 4 + (i * 3) % 7, '#e8d070'); p.hline(2, 8, 16, '#a08830'); box = { x: -9, y: -6, w: 18, h: 6 }; break;
      case 'cart': { mk(32, 22); const broken = b === 1; p.rect(2, 6, 26, 8, '#8a6034'); p.hline(2, 6, 26, '#a87a44'); p.rect(28, 10, 6, 2, '#6a4a2a');
        if (!broken) { p.rect(4, 2, 22, 5, '#c8b890'); p.hline(4, 2, 22, '#e0d4b0'); }
        for (const wx of [8, 22]) { p.circle(wx, 16, 4, '#4a321e'); p.circle(wx, 16, 2, '#7a5634'); p.set(wx, 16, '#3a2414'); }
        if (broken) { for (let i = 0; i < 8; i++) p.set(3 + i * 3, 4 + (i % 2), '#a08a6a'); }
        box = { x: -14, y: -8, w: 28, h: 7 }; break; }
      case 'anvil': mk(16, 12); p.rect(3, 2, 10, 3, '#5a5a66'); p.rect(1, 2, 3, 2, '#5a5a66'); p.rect(6, 5, 4, 4, '#4a4a54'); p.rect(4, 9, 8, 2, '#3a3a44'); p.hline(3, 2, 10, '#8a8a96'); box = { x: -6, y: -4, w: 12, h: 4 }; break;
      case 'grave': mk(12, 16); p.rect(2, 4, 8, 11, '#8a8a8a'); p.ellipse(6, 4, 4, 3, '#8a8a8a'); p.vline(6, 5, 6, '#5a5a5a'); p.hline(4, 7, 5, '#5a5a5a'); p.hline(1, 14, 10, '#5a7a3a'); box = { x: -4, y: -4, w: 8, h: 4 }; break;
      case 'pillar': { mk(16, 40); const brk = b === 1; const top = brk ? 14 : 4; const col = a || '#a8a090';
        for (let y = top; y < 37; y++) for (let x = 3; x < 13; x++) p.set(x, y, x === 3 || x === 12 ? darken(col, 0.3) : x % 3 === 0 ? darken(col, 0.12) : col);
        p.rect(1, 36, 14, 3, darken(col, 0.15)); if (!brk) p.rect(1, 2, 14, 3, darken(col, 0.1)); else for (let x = 3; x < 13; x++) p.set(x, top - (x * 7 % 4), col);
        for (let i = 0; i < 6; i++) p.set(4 + (i * 5) % 8, top + 4 + i * 5, '#5a7a3a');
        box = { x: -6, y: -5, w: 12, h: 5 }; break; }
      case 'statue': mk(20, 40); p.rect(3, 30, 14, 8, '#8a8478'); p.rect(7, 12, 6, 18, '#a8a294'); p.circle(10, 9, 4, '#a8a294'); p.rect(4, 14, 3, 10, '#9a9486'); p.rect(13, 14, 3, 10, '#9a9486'); p.vline(16, 2, 22, '#b8b2a4'); p.hline(14, 8, 5, '#b8b2a4'); box = { x: -7, y: -8, w: 14, h: 8 }; break;
      case 'arch': mk(48, 44); for (const x of [2, 38]) p.rect(x, 8, 8, 34, '#8a847a'); for (let x = 2; x < 46; x++) { const y = 4 + Math.round(Math.pow((x - 24) / 22, 2) * 6); p.rect(x, y, 1, 6, '#9a948a'); } for (let i = 0; i < 10; i++) p.set(4 + i * 4, 10 + (i * 7) % 20, '#4f7a3a'); box = null; break;
      case 'cave': mk(40, 32); p.ellipse(20, 20, 19, 14, '#4a4440'); p.ellipse(20, 22, 13, 10, '#0c0808'); for (let i = 0; i < 12; i++) p.set(4 + i * 3, 8 + (i * 5) % 6, '#6a625c'); p.rect(7, 28, 26, 3, '#0c0808'); break;
      case 'stairs': mk(32, 24); p.rect(2, 2, 28, 20, '#4a4640'); for (let i = 0; i < 5; i++) p.rect(4 + i, 4 + i * 4, 24 - i * 2, 3, i % 2 ? '#2a2622' : '#3a3632'); p.rect(8, 20, 16, 2, '#0c0a08'); break;
      case 'lever': { mk(12, 14); p.rect(2, 9, 8, 4, '#5a5450'); const on = b === 1; p.line(6, 10, on ? 10 : 2, 2, '#8a6a3a'); p.circle(on ? 10 : 2, 2, 1, on ? '#40d040' : '#d04040'); box = { x: -4, y: -3, w: 8, h: 3 }; break; }
      case 'boat': mk(36, 16); p.ellipse(18, 9, 16, 5, '#6a4426'); p.ellipse(18, 7, 14, 3, '#8a5a32'); p.hline(4, 6, 28, '#a87a44'); break;
      case 'dock': mk(16, 16); p.rect(0, 0, 16, 16, '#8a5a32'); for (let y = 3; y < 16; y += 4) p.hline(0, y, 16, '#5a3a1e'); p.rect(0, 0, 2, 2, '#4a2e18'); break;
      case 'ship': { mk(120, 90); const sail = a || '#2a2a2e';
        p.ellipse(60, 76, 56, 12, '#3a2618'); p.rect(8, 62, 104, 14, '#4a3020'); p.hline(8, 62, 104, '#6a4830'); for (let x = 14; x < 108; x += 10) p.rect(x, 66, 4, 3, '#1a1010');
        for (const mx of [40, 78]) { p.rect(mx, 6, 3, 58, '#5a3e26'); for (let y = 0; y < 34; y++) { const w = 18 + Math.round(Math.sin(y / 10) * 4); p.hline(mx - w + 1, 10 + y, w * 2, y % 6 === 0 ? darken(sail, 0.3) : sail); } }
        p.rect(80, 2, 12, 6, '#c8a030'); p.circle(60, 30, 5, '#c8a030'); break; }
      case 'stall': { mk(40, 34); const col = a || '#c84a3a'; p.rect(4, 14, 2, 18, '#5a3e26'); p.rect(34, 14, 2, 18, '#5a3e26'); for (let x = 0; x < 40; x++) for (let y = 4; y < 14; y++) p.set(x, y, Math.floor(x / 5) % 2 ? col : '#f0e8d8');
        for (let x = 0; x < 40; x += 5) p.ellipse(x + 2, 14, 2, 1, Math.floor(x / 5) % 2 ? col : '#f0e8d8');
        p.rect(3, 24, 34, 8, '#8a6034'); p.hline(3, 24, 34, '#a87a44'); for (let i = 0; i < 7; i++) p.circle(7 + i * 4.5, 22, 1.5, ['#d04030', '#f0c040', '#60a040', '#e08040'][i % 4]); box = { x: -18, y: -6, w: 36, h: 6 }; break; }
      case 'ram': mk(40, 26); p.rect(4, 6, 32, 8, '#5a3e26'); p.rect(32, 5, 8, 10, '#6a6a72'); for (const wx of [10, 28]) { p.circle(wx, 19, 5, '#4a321e'); p.circle(wx, 19, 2, '#6a4a2a'); } p.line(4, 4, 20, -2 + 4, '#6a4a2a'); p.rect(6, 0, 28, 3, '#7a2a22'); box = { x: -18, y: -8, w: 36, h: 8 }; break;
      case 'catapult': mk(36, 32); p.rect(2, 20, 32, 5, '#5a3e26'); for (const wx of [7, 29]) p.circle(wx, 27, 4, '#4a321e'); p.line(18, 22, 30, 2, '#6a4a2a'); p.line(19, 22, 31, 3, '#6a4a2a'); p.ellipse(31, 3, 3, 2, '#4a321e'); p.rect(14, 12, 8, 9, '#5a3e26'); box = { x: -16, y: -8, w: 32, h: 8 }; break;
      case 'pedestal': mk(20, 26); p.rect(4, 10, 12, 14, '#8a8494'); p.rect(2, 8, 16, 3, '#a8a2b4'); p.rect(2, 23, 16, 2, '#6a6474'); p.hline(4, 14, 12, '#6a6474'); box = { x: -8, y: -6, w: 16, h: 6 }; break;
      case 'heart': { mk(12, 12); const col = a || '#b050ff'; p.circle(4, 4, 3, col); p.circle(8, 4, 3, col); for (let y = 5; y < 11; y++) p.hline(1 + (y - 5), y, 10 - (y - 5) * 2, col); p.set(3, 3, '#ffffff'); p.set(4, 2, lighten(col, 0.6)); break; }
      case 'tracks': mk(16, 16); for (let i = 0; i < 4; i++) { p.ellipse(4 + i * 3, 3 + i * 3, 1, 2, '#3a2a1a', 160); } break;
      case 'pawprints': mk(16, 16); for (let i = 0; i < 3; i++) { const x = 3 + i * 4, y = 12 - i * 4; p.circle(x, y, 1, '#3a2a1a', 170); p.set(x - 1, y - 2, '#3a2a1a'); p.set(x + 1, y - 2, '#3a2a1a'); } break;
      case 'feather': mk(10, 10); p.line(1, 8, 8, 1, '#1a1a22'); p.line(2, 8, 8, 2, '#2a2a36'); p.line(1, 7, 7, 1, '#3a3a4a'); p.set(1, 9, '#5a5a6a'); break;
      case 'debris': mk(24, 14); for (let i = 0; i < 10; i++) p.rect(2 + (i * 7) % 20, 4 + (i * 3) % 8, 3, 2, i % 2 ? '#2a2420' : '#4a3a2e'); p.line(3, 10, 18, 5, '#3a2a22'); break;
      case 'scroll': mk(12, 10); p.rect(2, 2, 8, 6, '#e8dcb8'); p.vline(1, 1, 8, '#a08a5a'); p.vline(10, 1, 8, '#a08a5a'); p.hline(3, 4, 5, '#8a7a5a'); p.hline(3, 6, 4, '#8a7a5a'); break;
      case 'bed': mk(20, 30); p.rect(2, 2, 16, 26, '#6a4426'); p.rect(3, 3, 14, 6, '#f0ece0'); p.rect(3, 9, 14, 18, a || '#7b3fa0'); p.hline(3, 9, 14, lighten(a || '#7b3fa0', 0.2)); box = { x: -9, y: -27, w: 18, h: 27 }; oy = 28; break;
      case 'table': mk(28, 18); p.rect(1, 2, 26, 10, '#8a5a32'); p.hline(1, 2, 26, '#a87a44'); p.rect(2, 12, 2, 5, '#5a3a1e'); p.rect(24, 12, 2, 5, '#5a3a1e'); if (b) { p.rect(6, 4, 4, 3, '#e8e0d0'); p.rect(16, 3, 3, 4, '#c0a050'); p.circle(21, 6, 1, '#d04030'); } box = { x: -13, y: -10, w: 26, h: 10 }; break;
      case 'chair': mk(10, 14); p.rect(1, 1, 8, 2, '#6a4426'); p.rect(1, 6, 8, 3, '#8a5a32'); p.vline(1, 1, 12, '#5a3a1e'); p.vline(8, 1, 12, '#5a3a1e'); break;
      case 'shelf': mk(28, 30); p.rect(1, 1, 26, 28, '#5a3a20'); for (let s = 0; s < 3; s++) { p.hline(2, 8 + s * 8, 24, '#3a2414'); for (let i = 0; i < 8; i++) p.rect(3 + i * 3, 2 + s * 8, 2, 6, ['#8a2a2a', '#2a5a8a', '#3a7a3a', '#8a7a2a', '#5a2a6a'][(i + s * 3) % 5]); } box = { x: -13, y: -8, w: 26, h: 8 }; break;
      case 'fireplace': mk(32, 32); p.rect(1, 2, 30, 28, '#6a625a'); for (let y = 2; y < 30; y += 4) p.hline(1, y, 30, '#4a443e'); p.rect(7, 14, 18, 15, '#1a1210'); p.rect(4, 11, 24, 3, '#8a827a'); const f = b % 3; p.rect(10, 22 - f, 12, 7 + f, '#ff7a20'); p.rect(13, 24 - f, 6, 5, '#ffd040'); box = { x: -15, y: -10, w: 30, h: 10 }; break;
      case 'counter': mk(48, 18); p.rect(0, 2, 48, 14, '#7a4e2a'); p.hline(0, 2, 48, '#a87a44'); for (let x = 4; x < 48; x += 8) p.vline(x, 5, 10, '#5a361c'); p.rect(6, 0, 4, 3, '#c0a050'); p.rect(30, -1 + 1, 3, 3, '#5a8ac0'); box = { x: -24, y: -12, w: 48, h: 12 }; break;
      case 'throne': mk(24, 34); const tc = a || '#7b3fa0'; p.rect(2, 2, 20, 30, '#c8a040'); p.rect(4, 4, 16, 20, tc); p.rect(4, 22, 16, 8, darken(tc, 0.2)); p.rect(0, 20, 4, 10, '#a88030'); p.rect(20, 20, 4, 10, '#a88030'); p.set(12, 1, '#f0d060'); box = { x: -11, y: -10, w: 22, h: 10 }; break;
      case 'weaponrack': mk(28, 26); p.rect(1, 20, 26, 4, '#5a3a1e'); p.hline(1, 6, 26, '#5a3a1e'); for (let i = 0; i < 4; i++) { p.vline(5 + i * 6, 2, 20, '#b0b4c0'); p.hline(3 + i * 6, 16, 5, '#6a4426'); } box = { x: -13, y: -6, w: 26, h: 6 }; break;
      case 'cauldron': mk(18, 16); p.ellipse(9, 9, 7, 6, '#2a2a30'); p.ellipse(9, 5, 6, 2, '#5ac040'); p.set(7, 4, '#a0f080'); p.rect(3, 13, 2, 3, '#2a2a30'); p.rect(13, 13, 2, 3, '#2a2a30'); box = { x: -7, y: -6, w: 14, h: 6 }; break;
      case 'rug': mk(32, 20); p.rect(0, 0, 32, 20, '#d8b04a'); p.rect(2, 2, 28, 16, a || '#7b3fa0'); for (let i = 0; i < 4; i++) p.rect(6 + i * 6, 8, 3, 4, '#d8b04a'); oy = 10; break;
      case 'pot': mk(10, 12); p.ellipse(5, 7, 4, 4, '#a0603a'); p.rect(3, 1, 4, 3, '#a0603a'); p.hline(3, 1, 4, '#c08050'); box = { x: -3, y: -3, w: 6, h: 3 }; break;
      case 'flagpole': { mk(20, 44); p.rect(2, 4, 2, 39, '#5a5a62'); p.set(2, 3, '#d8b04a'); p.set(3, 3, '#d8b04a'); const col = a || '#d8d0c0';
        for (let y = 0; y < 12; y++) for (let x = 0; x < 14; x++) { const wv = Math.round(Math.sin((x + b * 2) * 0.6)); p.set(4 + x, 6 + y + wv, x === 13 ? darken(col, 0.2) : col); }
        p.ellipse(3, 42, 6, 2, '#5a524a'); box = { x: -2, y: -3, w: 6, h: 3 }; break; }
      case 'bones': mk(16, 10); p.line(2, 6, 12, 3, '#e8e0d0'); p.circle(2, 6, 1, '#e8e0d0'); p.circle(12, 3, 1, '#e8e0d0'); p.circle(10, 7, 2, '#d8d0c0'); p.set(9, 7, '#2a2420'); break;
      case 'vent': mk(16, 10); p.ellipse(8, 6, 6, 3, '#2a2422'); p.ellipse(8, 6, 3, 1, '#c0542a'); p.set(8, 5, '#ffa040'); break;
      case 'wisp': mk(8, 8); p.circle(4, 4, 3, '#a0ffd0', 120); p.circle(4, 4, 1, '#ffffff'); break;
      case 'shrine': mk(28, 34); p.rect(4, 20, 20, 12, '#7a746c'); p.rect(2, 18, 24, 3, '#9a948a'); p.rect(10, 6, 8, 14, '#8a847a'); p.circle(14, 6, 4, '#5ac080'); p.set(13, 5, '#d0fff0'); box = { x: -12, y: -8, w: 24, h: 8 }; break;
      case 'bell': mk(16, 16); p.ellipse(8, 9, 6, 6, '#c8a040'); p.rect(2, 9, 12, 5, '#c8a040'); p.hline(1, 14, 14, '#a88030'); p.set(8, 15, '#6a5020'); p.set(5, 6, '#f0e080'); break;
      case 'tablet': mk(20, 26); p.rect(2, 2, 16, 22, '#8a8478'); p.ellipse(10, 3, 8, 3, '#8a8478'); for (let y = 6; y < 22; y += 3) p.hline(5, y, 10, '#5a564e'); box = { x: -8, y: -4, w: 16, h: 4 }; break;
      case 'mural': mk(64, 40); p.rect(0, 0, 64, 40, '#6a645a'); p.rect(2, 2, 60, 36, '#8a8478'); for (let i = 0; i < 7; i++) { const cx = 8 + i * 8; p.circle(cx, 12, 3, ['#7b3fa0', '#3f9a3a', '#b8302a', '#e0b52a', '#3a6fc4', '#8a8a8a', '#2a2430'][i]); p.vline(cx, 15, 8, '#5a564e'); p.line(cx, 23, 32, 30, '#c8a040'); } p.circle(32, 30, 4, '#b050ff'); p.set(32, 29, '#ffffff'); box = null; break;
      default: mk(8, 8); p.rect(0, 0, 8, 8, '#ff00ff');
    }
    p.outline(OUT);
    return { c: p.done(), ox: W >> 1, oy: oy ?? H - 2, box };
  });
}
