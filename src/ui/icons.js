// Pixel-art icon set (12x12) rendered to data URLs. Shapes use palette letters;
// some shapes accept color overrides (A = primary, D = primary dark, L = light).
import { SWORDS, RARITY } from '../data/items.js';

const PAL = {
  k: '#1a1424', w: '#ffffff', y: '#ffc83a', Y: '#b07a10', r: '#e03a3a', R: '#8a1a1a', g: '#4fb84a', G: '#2a6a2a',
  b: '#4aa8ff', B: '#1a4a8a', c: '#7ae8ff', p: '#b66cff', P: '#5a2a8a', o: '#ff8a2a', n: '#a06a3a', N: '#5a3218',
  s: '#c8d0d8', S: '#6a7078', e: '#f1c27d', m: '#ff7ab0', l: '#fff0a0', t: '#e8d8b0', T: '#a08860',
};

const SHAPES = {
  coin: ['....kkkk....', '..kkyyyykk..', '.kyyllyyyYk.', '.kylyyyyyYk.', 'kyylyyyyyyYk', 'kyyyyYYyyyYk', 'kyyyyYYyyyYk', 'kyyyyyyyyyYk', '.kyyyyyyyYk.', '.kYyyyyyYYk.', '..kkYYYYkk..', '....kkkk....'],
  heart: ['............', '.kkk...kkk..', 'krrrk.krrrk.', 'krwrrkrrrrk.', 'krrrrrrrrrk.', 'krrrrrrrrRk.', '.krrrrrrRk..', '..krrrrRk...', '...krrRk....', '....kRk.....', '.....k......', '............'],
  bolt: ['......kkk...', '.....kcck...', '....kcck....', '...kcck.....', '..kcccckkk..', '.kkkkcccck..', '....kcck....', '...kcck.....', '..kcck......', '..kck.......', '..kk........', '............'],
  star: ['.....kk.....', '.....kyk....', '....kyyk....', 'kkkkkyyykkkk', 'kyyyylyyyyyk', '.kyyyllyyyk.', '..kyyyyyyk..', '..kyyyyyyk..', '.kyyykkyyyk.', '.kyyk..kyyk.', 'kkkk....kkkk', '............'],
  potion: ['....kkkk....', '....kttk....', '....kNNk....', '...kkSSkk...', '..kSAAAASk..', '.kSAALAAASk.', '.kSALAAAASk.', '.kSAAAAAASk.', '.kSDAAAADSk.', '..kSDDDDSk..', '...kkkkkk...', '............'],
  bread: ['............', '............', '...kkkkkk...', '..knnttnnk..', '.kntnnnntnk.', '.knnnnnnnnk.', 'kntnnntnnnnk', 'knnnnnnnnnNk', 'kNnnnnnnnNNk', '.kNNNNNNNNk.', '..kkkkkkkk..', '............'],
  apple: ['.....kk.....', '......kGk...', '...kkk.kGk..', '..krrrkkrrk.', '.krwrrrrrrRk', '.krwrrrrrrRk', '.krrrrrrrrRk', '.krrrrrrrrRk', '..krrrrrrRk.', '..kRrrrrRRk.', '...kkkkkkk..', '............'],
  stew: ['....k..k....', '.....k..k...', '....k..k....', '.kkkkkkkkkk.', 'kNoogooogoNk', 'kNooooooooNk', '.kNNNNNNNNk.', '.knnnnnnnnk.', '..knnnnnnk..', '...kkkkkk...', '............', '............'],
  gel: ['............', '.....kk.....', '....kggk....', '...kgwggk...', '..kgwgggGk..', '..kggggggk..', '.kgggggggGk.', '.kggggggGGk.', '.kGgggggGGk.', '..kkGGGGkk..', '....kkkk....', '............'],
  pelt: ['............', '.kk......kk.', '.kSkkkkkkSk.', '..kSsssssk..', '..ksSssSsk..', '.kssssssssk.', '.ksSsssSssk.', '.kssssssssk.', '..ksssSssk..', '..kSk..kSk..', '..kk....kk..', '............'],
  ore: ['............', '....kkkk....', '..kkSSSSkk..', '.kSSoSSSSSk.', '.kSSSSSoSSk.', 'kSoSSSSSSSSk', 'kSSSSoSSSoSk', 'kSSSSSSSSSSk', '.kSoSSSSSSk.', '..kkSSSSkk..', '....kkkk....', '............'],
  crystal: ['.....kk.....', '....kcck....', '...kcwcck...', '...kcwcck...', '..kccwcccbk.', '..kcccccbbk.', '..kcccccbbk.', '..kcccccbbk.', '...kcccbbk..', '....kcbbk...', '.....kkk....', '............'],
  mushroom: ['............', '...kkkkkk...', '..kcccwccck.', '.kccwccccwck', '.kcccccccccck'.slice(0, 12), '.kkkkkkkkkkk', '....kwwk....', '....kwwk....', '....kwwk....', '...kwwwwk...', '...kkkkkk...', '............'],
  wheat: ['......k.....', '.....kyk....', '....kyyk.k..', '.k..kyk.kyk.', 'kyk.kykkyyk.', 'kyykkyykyk..', '.kyykyyyk...', '..kkyyykk...', '....kyk.....', '....kYk.....', '....kYk.....', '....kkk.....'],
  herb: ['............', '...kk..kk...', '..kgGk.kgk..', '..kggkkggk..', '...kgGgGk...', '.kk.kgGk.kk.', 'kggkkgGkkggk', '.kgggGGgggk.', '..kkkgGkkk..', '.....kGk....', '.....kGk....', '.....kkk....'],
  essence: ['.....kk.....', '....kmmk....', '...kmwmmk...', '..kmwmmmpk..', '.kmmmmmmppk.', '.kmmmmmpppk.', '..kmmmpppk..', '...kmpppk...', '....kppk....', '.....kk.....', '............', '............'],
  core: ['............', '...kkkkkk...', '..kSSSSSSk..', '.kSScccSSSk.', '.kScwcccSSk.', '.kSccccbSSk.', '.kSSccbbSSk.', '.kSSSbbSSSk.', '..kSSSSSSk..', '...kkkkkk...', '............', '............'],
  rune: ['...kkkkkk...', '..kPPPPPPk..', '.kPPpPPpPPk.', '.kPPpPpPPPk.', '.kPPPppPPPk.', '.kPPPpPPPPk.', '.kPPppppPPk.', '.kPPPPPPPPk.', '.kPPpPPpPPk.', '..kPPPPPPk..', '...kkkkkk...', '............'],
  basket: ['............', '....kkkk....', '...kN..Nk...', '..kN....Nk..', '.kkkkkkkkkk.', 'kttnttnttntk', 'knttnttnttnk', '.kntnntnntk.', '.knttnttntk.', '..knnnnnnk..', '...kkkkkk...', '............'],
  map: ['............', 'kkkkkkkkkkk.', 'kttTttttTtk.', 'ktTttrtttTk.', 'kttttrrtttk.', 'kTtttttrTtk.', 'ktttTttrttk.', 'kttttttrrtk.', 'ktTtttttrtk.', 'kttttTttttk.', 'kkkkkkkkkkk.', '............'],
  key: ['............', '...kkk......', '..kyyyk.....', '.kykkyk.....', '.kyk.kyk....', '.kykkyykkkkk', '..kyyykyyyyk', '...kkk.kykyk', '.......kkkkk', '............', '............', '............'],
  chest: ['............', '..kkkkkkkk..', '.knnnnnnnnk.', 'kNnnnnnnnnNk', 'kkkkkyykkkkk', 'knnnkyykknnk', 'knnnnkknnnnk', 'kNnnnnnnnnNk', 'kNNNNNNNNNNk', 'kkkkkkkkkkkk', '............', '............'],
  bag: ['............', '....kkkk....', '...kN..Nk...', '..kkkkkkkk..', '.knnnnnnnnk.', 'knnnnyynnnnk', 'knnnkyyknnnk', 'knnnnnnnnnnk', 'kNnnnnnnnnNk', '.kNNNNNNNNk.', '..kkkkkkkk..', '............'],
  scroll: ['............', '.kkkkkkkkk..', 'ktttttttttk.', '.kTttttttTk.', '.ktTTTTTTtk.', '.kttttttttk.', '.ktTTTTTttk.', '.kttttttttk.', '.ktTTTTttTk.', 'ktttttttttk.', '.kkkkkkkkk..', '............'],
  gear: ['....kkkk....', '..k.kSSk.k..', '.kSkkSSkkSk.', '..kSSSSSSk..', 'kkSSkkkkSSkk', 'kSSSk..kSSSk', 'kSSSk..kSSSk', 'kkSSkkkkSSkk', '..kSSSSSSk..', '.kSkkSSkkSk.', '..k.kSSk.k..', '....kkkk....'],
  trophy: ['............', '.kkkkkkkkkk.', 'kykyyyyyykyk', 'kyklyyyyykyk', '.kkyyyyyykk.', '..kyyyyyyk..', '...kyyyyk...', '....kyyk....', '....kYYk....', '..kkyyyykk..', '..kYYYYYYk..', '..kkkkkkkk..'],
  crown: ['............', '............', 'k...kk...k..', 'yk.kyyk.kyk.', 'kykkyyykkyyk', 'kyyyyyyyyyyk', 'kyrryyybbyyk', 'kyyyyyyyyyyk', 'kYYYYYYYYYYk', 'kkkkkkkkkkkk', '............', '............'],
  skull: ['............', '...kkkkkk...', '..kwwwwwwk..', '.kwwwwwwwwk.', '.kwkkwwkkwk.', '.kwkkwwkkwk.', '.kwwwkkwwwk.', '..kwwwwwwk..', '..kwkwkwkk..', '...kkkkkk...', '............', '............'],
  paw: ['............', '..kk....kk..', '.knnk..knnk.', '.knnk..knnk.', 'kk.kk..kk.kk', 'knnk.kk.knnk', 'kkk.knnk.kkk', '...knnnnk...', '..knnnnnnk..', '..knnnnnnk..', '...kkkkkk...', '............'],
  shirt: ['............', '..kkk..kkk..', '.kAAAkkAAAk.', 'kAAAAAAAAAAk', 'kAAkAAAAkAAk', '.kkkAAAAkkk.', '...kAAAAk...', '...kAAAAk...', '...kAAAAk...', '...kDDDDk...', '...kkkkkk...', '............'],
  hat: ['............', '............', '....kkkk....', '...kAAAAk...', '...kALAAk...', '...kAAAAk...', '..kDDDDDDk..', 'kkAAAAAAAAkk', 'kAAAAAAAAAAk', '.kkkkkkkkkk.', '............', '............'],
  armor: ['............', '.kkk....kkk.', 'kSSSkkkkSSSk', 'kSsSSSSSSsSk', '.kSSsSSsSSk.', '.kSSSyySSSk.', '.kSSSyySSSk.', '.kSSSSSSSSk.', '.kSsSSSSsSk.', '..kSSSSSSk..', '...kkkkkk...', '............'],
  orb: ['....kkkk....', '..kkAAAAkk..', '.kAAwwAAAAk.', '.kAwwAAAAAk.', 'kAAwAAAAAADk', 'kAAAAAAAAADk', 'kAAAAAAAAADk', 'kAAAAAAAADDk', '.kAAAAAADDk.', '.kDAAAADDDk.', '..kkDDDDkk..', '....kkkk....'],
  ray: ['k..........k', '.kA......Ak.', '..kAA..AAk..', '...kAwwAk...', '....kwwk....', 'kAAAwwwwAAAk', 'kAAAwwwwAAAk', '....kwwk....', '...kAwwAk...', '..kAA..AAk..', '.kA......Ak.', 'k..........k'],
  burst: ['.....kk.....', '..k..kAk.k..', '..kAkkAkkAk.', '...kAAAAAk..', '.kkkAwwwAkkk', 'kAAAwwwwwAAk', '.kkAAwwwAkk.', '...kAAAAAk..', '..kAkkAkkAk.', '..k..kAk.k..', '.....kk.....', '............'],
  shield: ['.kkkkkkkkkk.', 'kAAAAAAAAAAk', 'kAwwAAAAAADk', 'kAwAAAAAAADk', 'kAAAAAAAAADk', 'kAAAAAAAAADk', '.kAAAAAAAADk', '.kAAAAAAADk.', '..kAAAAADk..', '...kAAADk...', '....kADk....', '.....kk.....'],
  fire: ['.....k......', '....kAk.....', '....kAAk....', '...kAAAk.k..', '..kAALAAkAk.', '..kALLLAAAk.', '.kAALwwLAAk.', '.kALwwwwLAk.', '.kALwwwwLAk.', '..kALLLLAk..', '...kkkkkk...', '............'],
  frost: ['.....kk.....', '..k..kAk.k..', '.kAk.kAk.kAk', '..kAkkAkkAk.', '...kAAwAAk..', 'kkkkAwwwAkkk', 'kAAAwwwwwAAk', 'kkkkAwwwAkkk', '...kAAwAAk..', '..kAkkAkkAk.', '.kAk.kAk.kAk', '..k..kk..k..'],
  blink: ['............', '...kkkkkk...', '..kAAAAAAk..', '.kAAkkkkAAk.', '.kAk.kk.kAk.', '.kAk.kwk.kAk', '.kAk.kAk.kAk', '.kAAk.kAAAk.', '..kAAkkAAk..', '...kAAAAk...', '....kkkk....', '............'],
  moon: ['............', '....kkkk....', '...kllllk...', '..kllkkkk...', '.kllk.......', '.kllk.......', '.kllk.......', '.kllk.......', '..kllkkkk...', '...kllllk...', '....kkkk....', '............'],
  calendar: ['..k.....k...', '.kkkkkkkkkk.', 'krrrrrrrrrrk', 'kkkkkkkkkkkk', 'kwwwwwwwwwwk', 'kwkwkwkwkwwk', 'kwwwwwwwwwwk', 'kwkwkwkrkwwk', 'kwwwwwwwwwwk', 'kwkwkwwwwwwk', 'kkkkkkkkkkkk', '............'],
  flag: ['.k..........', '.kkkkkkkk...', '.kAAAAAAAk..', '.kAwAAAAAAk.', '.kAAAAAAAk..', '.kAAAAAAAAk.', '.kkkkkkkkk..', '.k..........', '.k..........', '.k..........', 'kkk.........', '............'],
  user: ['....kkkk....', '...keeeek...', '..keekkeek..', '..keeeeeek..', '...keeeek...', '....kkkk....', '..kkAAAAkk..', '.kAAAAAAAAk.', 'kAAAAAAAAAAk', 'kAAAAAAAAAAk', 'kkkkkkkkkkkk', '............'],
  travel: ['....kkkk....', '...kccccDk..', '..kcwccccDk.', '..kcwcccDDk.', '...kcccDDk..', '....kcDDk...', '.....kDk....', '..kkkkkkkk..', '.kSSSSSSSSk.', 'kSSSSSSSSSSk', 'kkkkkkkkkkkk', '............'],
  quest: ['....kkkk....', '...kyyyyk...', '...kyyyyk...', '...kyyyyk...', '...kyyyyk...', '....kyyk....', '....kyyk....', '....kkkk....', '............', '....kkkk....', '....kyyk....', '....kkkk....'],
  fish: ['............', '............', '.......kk...', '..kkkkkAAk..', '.kAAAAAAAAkk', 'kAwkAAAAAAkA', 'kAAAAALAAkAk', '.kAAAADDDAkk', '..kkkkkDDk..', '.......kk...', '............', '............'],
  boot: ['............', '...kkkk.....', '...knnk.....', '...knnk.....', '...knnk.....', '...knnk.....', '...knnkkkk..', '..knnnnnnnk.', '..knnnnnnnnk', '..kNNNNNNNNk', '..kkkkkkkkkk', '............'],
  lock: ['....kkkk....', '...kSkkSk...', '...kSk.kSk..', '..kkkkkkkk..', '..kyyyyyyk..', '..kyyYYyyk..', '..kyyYYyyk..', '..kyyyyyyk..', '..kYYYYYYk..', '..kkkkkkkk..', '............', '............'],
};

const cache = new Map();
function hexDark(h, f) {
  const n = parseInt(h.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * f) | 0, g = Math.min(255, ((n >> 8) & 255) * f) | 0, b = Math.min(255, (n & 255) * f) | 0;
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
export function icon(name, color) {
  const key = name + (color || '');
  if (cache.has(key)) return cache.get(key);
  const shape = SHAPES[name] || SHAPES.quest;
  const cv = document.createElement('canvas'); cv.width = 12; cv.height = 12;
  const c = cv.getContext('2d');
  const A = color || '#4aa8ff';
  const pal = { ...PAL, A, D: hexDark(A, 0.6), L: hexDark(A, 1.5) };
  shape.forEach((row, y) => { for (let x = 0; x < 12; x++) { const ch = row[x]; if (ch && ch !== '.' && pal[ch]) { c.fillStyle = pal[ch]; c.fillRect(x, y, 1, 1); } } });
  const url = cv.toDataURL();
  cache.set(key, url);
  return url;
}
const hx = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');
// Procedural sword icon using each sword's own colors
export function swordIcon(id) {
  const key = 'sword:' + id;
  if (cache.has(key)) return cache.get(key);
  const s = SWORDS[id] || SWORDS.wood_sword;
  const cv = document.createElement('canvas'); cv.width = 12; cv.height = 12;
  const c = cv.getContext('2d');
  const px = (x, y, col) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
  const L = Math.round(4 + s.len * 4);
  // outline pass then fill along the diagonal
  for (let i = 0; i < L; i++) { const x = 3 + i, y = 8 - i; for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, -1]]) px(x + ox, y + oy, '#1a1424'); }
  for (let i = 0; i < L; i++) { const x = 3 + i, y = 8 - i; px(x, y, hx(s.blade)); if (i > 0) px(x, y - 1 < 0 ? 0 : y - 1, hx(s.edge)); }
  if (s.shape === 'shovel') { c.fillStyle = hx(s.blade); c.fillRect(8, 0, 4, 4); }
  // guard + grip
  px(1, 8, hx(s.guard)); px(2, 9, hx(s.guard)); px(3, 10, hx(s.guard)); px(4, 11, '#1a1424');
  px(1, 10, hx(s.grip)); px(0, 11, hx(s.grip));
  if (s.glow) { px(5, 6, hx(s.glow)); px(7, 4, hx(s.glow)); }
  const url = cv.toDataURL();
  cache.set(key, url);
  return url;
}
export const ITEM_ICON_COLORS = { potion_red: '#e03a3a', potion_big: '#ff3a6a', potion_blue: '#3a8aff', elixir: '#ffd36a', drink_coffee: '#6a3a1a', drink_mead: '#e0a02a', drink_tea: '#6ab04a', drink_juice: '#ff9a2a' };
export function itemIcon(id, def) {
  const ic = def?.icon || id;
  if (ITEM_ICON_COLORS[ic]) return icon('potion', ITEM_ICON_COLORS[ic]);
  if (ic === 'fish') return icon('fish', def?.color);
  const map = { core_gold: ['core'], basket: ['basket'], mushroom: ['mushroom'], star: ['star'] };
  if (map[ic]) return icon(map[ic][0]);
  return icon(ic);
}
export const POWER_ICON = {
  energy_ball: ['orb', '#6fd8ff'], magic_ray: ['ray', '#ff7af0'], energy_burst: ['burst', '#ffe26a'], shield: ['shield', '#7affc8'],
  fire_wave: ['fire', '#ff6a1a'], frost_nova: ['frost', '#9fe8ff'], blink: ['blink', '#c89aff'],
};
export function powerIcon(id) { const [s, c] = POWER_ICON[id] || ['orb', '#fff']; return icon(s, c); }
export function rarityColor(r) { return RARITY[r]?.color || '#fff'; }
export function img(src, cls = 'px') { return `<img class="${cls}" src="${src}" alt="">`; }
