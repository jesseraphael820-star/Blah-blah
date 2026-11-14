// Dados do jogo: armas, facas, skins, granadas, economia, patentes.
export const GAME_NAME = 'STRIKE OPS MOBILE X';

// spread: [parado, em movimento] em graus. recoil: [vertical, horizontal] em graus por tiro.
// rf: fator de perda de dano a cada 15 m. pen: penetração de colete (0..1).
export const WEAPONS = {
  glock:  { name: 'Glock-18',     type: 'pistol',  team: 'T',  price: 200,  dmg: 28,  rpm: 400, mag: 20, reserve: 120, reload: 2.2, pen: 0.47, recoil: [1.0, 0.5], spread: [0.7, 2.2], rf: 0.86, speed: 1.0,  kill: 300, snd: [2600, 0.10, 190] },
  usp:    { name: 'USP-S',        type: 'pistol',  team: 'CT', price: 200,  dmg: 34,  rpm: 350, mag: 12, reserve: 24,  reload: 2.2, pen: 0.50, recoil: [1.2, 0.4], spread: [0.5, 2.0], rf: 0.90, speed: 1.0,  kill: 300, snd: [1100, 0.07, 140], sup: true },
  p250:   { name: 'P250',         type: 'pistol',  team: '',   price: 300,  dmg: 37,  rpm: 400, mag: 13, reserve: 26,  reload: 2.2, pen: 0.64, recoil: [1.5, 0.6], spread: [0.7, 2.4], rf: 0.88, speed: 1.0,  kill: 300, snd: [2900, 0.11, 200] },
  deagle: { name: 'Desert Eagle', type: 'pistol',  team: '',   price: 700,  dmg: 58,  rpm: 230, mag: 7,  reserve: 35,  reload: 2.3, pen: 0.93, recoil: [4.2, 1.2], spread: [0.6, 3.5], rf: 0.93, speed: 0.96, kill: 300, snd: [1900, 0.20, 110] },
  mp5:    { name: 'MP5',          type: 'smg',     team: '',   price: 1500, dmg: 27,  rpm: 750, mag: 30, reserve: 120, reload: 2.6, pen: 0.60, recoil: [0.8, 0.5], spread: [0.9, 1.6], rf: 0.85, speed: 0.97, kill: 600, auto: true, snd: [2400, 0.09, 170] },
  ump45:  { name: 'UMP-45',       type: 'smg',     team: '',   price: 1200, dmg: 33,  rpm: 660, mag: 25, reserve: 100, reload: 3.0, pen: 0.65, recoil: [1.0, 0.6], spread: [1.0, 1.7], rf: 0.83, speed: 0.96, kill: 600, auto: true, snd: [1800, 0.11, 140] },
  p90:    { name: 'P90',          type: 'smg',     team: '',   price: 2350, dmg: 26,  rpm: 850, mag: 50, reserve: 100, reload: 3.2, pen: 0.69, recoil: [0.7, 0.6], spread: [1.0, 1.5], rf: 0.86, speed: 0.95, kill: 300, auto: true, snd: [3000, 0.08, 200] },
  nova:   { name: 'Nova',         type: 'shotgun', team: '',   price: 1050, dmg: 24,  rpm: 68,  mag: 8,  reserve: 32,  reload: 3.4, pen: 0.50, recoil: [5.5, 1.5], spread: [3.2, 3.8], rf: 0.60, speed: 0.92, kill: 900, pellets: 9, snd: [1400, 0.26, 90] },
  galil:  { name: 'Galil AR',     type: 'rifle',   team: 'T',  price: 1800, dmg: 30,  rpm: 660, mag: 35, reserve: 90,  reload: 3.0, pen: 0.77, recoil: [1.1, 0.7], spread: [0.5, 3.4], rf: 0.98, speed: 0.90, kill: 300, auto: true, snd: [2100, 0.14, 130] },
  famas:  { name: 'FAMAS',        type: 'rifle',   team: 'CT', price: 2050, dmg: 30,  rpm: 660, mag: 25, reserve: 90,  reload: 3.2, pen: 0.70, recoil: [1.1, 0.6], spread: [0.5, 3.2], rf: 0.96, speed: 0.90, kill: 300, auto: true, snd: [2300, 0.13, 140] },
  ak47:   { name: 'AK-47',        type: 'rifle',   team: 'T',  price: 2700, dmg: 36,  rpm: 600, mag: 30, reserve: 90,  reload: 2.5, pen: 0.78, recoil: [1.6, 0.8], spread: [0.4, 3.8], rf: 0.98, speed: 0.88, kill: 300, auto: true, snd: [1700, 0.18, 100] },
  m4a4:   { name: 'M4A4',         type: 'rifle',   team: 'CT', price: 3100, dmg: 33,  rpm: 666, mag: 30, reserve: 90,  reload: 3.1, pen: 0.70, recoil: [1.3, 0.6], spread: [0.4, 3.4], rf: 0.97, speed: 0.90, kill: 300, auto: true, snd: [2200, 0.15, 120] },
  m4a1s:  { name: 'M4A1-S',       type: 'rifle',   team: 'CT', price: 2900, dmg: 38,  rpm: 600, mag: 20, reserve: 80,  reload: 3.1, pen: 0.70, recoil: [1.0, 0.4], spread: [0.3, 3.2], rf: 0.99, speed: 0.90, kill: 300, auto: true, snd: [1000, 0.08, 150], sup: true },
  awp:    { name: 'AWP',          type: 'sniper',  team: '',   price: 4750, dmg: 115, rpm: 41,  mag: 5,  reserve: 30,  reload: 3.7, pen: 0.97, recoil: [6.0, 1.0], spread: [5.0, 9.0], rf: 0.99, speed: 0.80, kill: 100, zoom: 0.18, scopedSpread: 0.03, snd: [1300, 0.42, 70] },
};
export const WEAPON_ORDER = ['glock', 'usp', 'p250', 'deagle', 'mp5', 'ump45', 'p90', 'nova', 'galil', 'famas', 'ak47', 'm4a4', 'm4a1s', 'awp'];

export const KNIFE = { name: 'Faca', type: 'knife', dmg: 40, rpm: 110, speed: 1.08, kill: 1500, range: 2.2, snd: [0, 0, 0] };
export const KNIVES = {
  padrao:    { name: 'Faca Tática' },
  karambit:  { name: 'Karambit' },
  butterfly: { name: 'Butterfly Knife' },
  m9:        { name: 'M9 Bayonet' },
  bayonet:   { name: 'Bayonet' },
  flip:      { name: 'Flip Knife' },
  gut:       { name: 'Gut Knife' },
};

export const GRENADES = {
  he:     { name: 'Explosiva',   price: 300, icon: '💥', color: 0x3d5c2e, desc: 'Dano em área' },
  flash:  { name: 'Flash',       price: 200, icon: '✨', color: 0xcfd6dc, desc: 'Cega quem olhar' },
  smoke:  { name: 'Fumaça',      price: 300, icon: '☁️', color: 0x58636b, desc: 'Bloqueia a visão' },
  fire:   { name: 'Incendiária', price: 500, icon: '🔥', color: 0xa33a1c, desc: 'Área em chamas' },
  decoy:  { name: 'Distração',   price: 50,  icon: '📢', color: 0x8a7a3a, desc: 'Simula disparos' },
};
export const GRENADE_ORDER = ['he', 'flash', 'smoke', 'fire', 'decoy'];

export const EQUIPMENT = {
  vest:   { name: 'Colete',            price: 650,  icon: '🦺', desc: '100 de colete' },
  helmet: { name: 'Colete + Capacete', price: 1000, icon: '⛑️', desc: 'Protege a cabeça' },
  kit:    { name: 'Kit de Desarme',    price: 400,  icon: '🧰', desc: 'Desarma em 5s', team: 'CT' },
};

export const BUY_CATS = [
  { id: 'pistol', name: 'Pistolas' }, { id: 'rifle', name: 'Rifles' }, { id: 'sniper', name: 'Snipers' },
  { id: 'smg', name: 'Submetralhadoras' }, { id: 'shotgun', name: 'Escopetas' },
  { id: 'grenade', name: 'Granadas' }, { id: 'equip', name: 'Equipamentos' },
];

export const RARITY = {
  comum:    { name: 'Comum',    color: '#9aa7b4', price: 150,  w: 55 },
  raro:     { name: 'Raro',     color: '#4b8dff', price: 500,  w: 28 },
  epico:    { name: 'Épico',    color: '#b266ff', price: 1500, w: 12 },
  lendario: { name: 'Lendário', color: '#ff9d2e', price: 4000, w: 4 },
  especial: { name: 'Especial', color: '#ff3d6e', price: 9000, w: 1 },
};
export const RARITY_ORDER = ['comum', 'raro', 'epico', 'lendario', 'especial'];

// Acabamentos originais (texturas procedurais próprias, sem assets de terceiros).
export const SKINS = {
  padrao:   { name: 'Padrão',            rarity: 'comum' },
  areia:    { name: 'Camuflagem Areia',  rarity: 'comum',    on: ['ak47', 'm4a4', 'glock', 'mp5', 'nova', 'galil'] },
  urbano:   { name: 'Malha Urbana',      rarity: 'comum',    on: ['m4a1s', 'usp', 'p250', 'ump45', 'famas', 'p90'] },
  teia:     { name: 'Teia Escarlate',    rarity: 'raro',     on: ['deagle', 'glock', 'mp5', 'nova'], knife: true },
  rubra:    { name: 'Linha Rubra',       rarity: 'raro',     on: ['ak47', 'awp', 'p250', 'galil'] },
  vetor:    { name: 'Vetor Órbita',      rarity: 'epico',    on: ['m4a4', 'awp', 'p90', 'usp'] },
  fera:     { name: 'Fera Neon',         rarity: 'epico',    on: ['m4a1s', 'ak47', 'famas', 'ump45'] },
  aurora:   { name: 'Aurora',            rarity: 'epico',    on: ['glock', 'deagle', 'mp5'], knife: true },
  magma:    { name: 'Magma Marmorizado', rarity: 'lendario', on: ['deagle'], knife: true },
  nebulosa: { name: 'Nebulosa',          rarity: 'lendario', on: ['p90'], knife: true },
  lenda:    { name: 'Lenda Dourada',     rarity: 'lendario', on: ['m4a4', 'awp'], knife: true },
  drakon:   { name: 'Drakon Ancestral',  rarity: 'especial', on: ['awp', 'ak47'] },
};

export const GLOVES = {
  padrao:   { name: 'Luvas Táticas',  rarity: 'comum',    color: 0x1c1f24 },
  carmesim: { name: 'Luvas Carmesim', rarity: 'raro',     color: 0x9a1b2b },
  safira:   { name: 'Luvas Safira',   rarity: 'epico',    color: 0x1f5fd0 },
  ouro:     { name: 'Luvas Áureas',   rarity: 'lendario', color: 0xd4a52a },
};
export const NADE_SKINS = {
  padrao: { name: 'Granadas Padrão', rarity: 'comum' },
  neon:   { name: 'Granadas Neon',   rarity: 'raro',  color: 0x27e0c0 },
  ouro:   { name: 'Granadas Áureas', rarity: 'epico', color: 0xe0b030 },
};

// Catálogo de itens: id "tipo:base:skin".
export const ITEMS = {};
function addItem(kind, base, skin, name, rarity, mult = 1) {
  const id = `${kind}:${base}:${skin}`;
  ITEMS[id] = { id, kind, base, skin, name, rarity, price: Math.round(RARITY[rarity].price * mult) };
}
for (const [sid, s] of Object.entries(SKINS)) {
  if (sid === 'padrao') continue;
  for (const w of s.on || []) addItem('w', w, sid, `${WEAPONS[w].name} | ${s.name}`, s.rarity);
}
for (const [kid, k] of Object.entries(KNIVES)) {
  if (kid === 'padrao') continue;
  addItem('k', kid, 'padrao', `★ ${k.name}`, 'epico', 2);
  for (const [sid, s] of Object.entries(SKINS)) {
    if (!s.knife) continue;
    const r = s.rarity === 'lendario' ? 'especial' : 'lendario';
    addItem('k', kid, sid, `★ ${k.name} | ${s.name}`, r, r === 'especial' ? 1.3 : 1.5);
  }
}
for (const [gid, g] of Object.entries(GLOVES)) if (gid !== 'padrao') addItem('g', 'luvas', gid, g.name, g.rarity, 1.2);
for (const [nid, n] of Object.entries(NADE_SKINS)) if (nid !== 'padrao') addItem('n', 'granadas', nid, n.name, n.rarity, 1);

export const CASES = {
  operacao: { name: 'Caixa Operação', price: 400, desc: 'Skins de armas, luvas e granadas', filter: it => it.kind !== 'k' },
  laminas:  { name: 'Caixa de Lâminas', price: 2200, desc: 'Somente facas raras', filter: it => it.kind === 'k' },
};
export function rollCase(caseId, rnd = Math.random) {
  const pool = Object.values(ITEMS).filter(CASES[caseId].filter);
  const byR = {};
  for (const it of pool) (byR[it.rarity] ||= []).push(it);
  const rar = RARITY_ORDER.filter(r => byR[r]);
  let total = rar.reduce((a, r) => a + RARITY[r].w, 0), x = rnd() * total;
  for (const r of rar) { x -= RARITY[r].w; if (x <= 0) return byR[r][Math.floor(rnd() * byR[r].length)]; }
  return pool[0];
}

export const RANKS = ['Recruta', 'Soldado', 'Cabo', 'Sargento', 'Tenente', 'Capitão', 'Major', 'Coronel', 'General', 'Marechal', 'Elite Suprema', 'Lenda Global'];
export const rankOf = pts => { const i = Math.min(RANKS.length - 1, Math.floor(pts / 100)); return { i, name: RANKS[i], prog: i === RANKS.length - 1 ? 1 : (pts % 100) / 100 }; };
export const xpFor = lvl => 500 + 150 * (lvl - 1);
export const AVATARS = ['🪖', '🎯', '🦅', '🐺', '💀', '🔥', '⚡', '🛡️', '🐍', '👑', '🦂', '🎖️'];

export const DIFFICULTY = {
  facil:        { name: 'Fácil',        react: 0.85, err: 6.5, turn: 3.0, hear: 0.6, burst: [2, 4], pause: [0.6, 1.1], strafe: 0.15, nade: 0 },
  normal:       { name: 'Normal',       react: 0.55, err: 4.0, turn: 4.5, hear: 0.85, burst: [3, 5], pause: [0.4, 0.8], strafe: 0.4, nade: 0.15 },
  dificil:      { name: 'Difícil',      react: 0.33, err: 2.4, turn: 6.5, hear: 1.0, burst: [3, 6], pause: [0.25, 0.55], strafe: 0.65, nade: 0.3 },
  profissional: { name: 'Profissional', react: 0.2,  err: 1.3, turn: 9.0, hear: 1.25, burst: [4, 7], pause: [0.15, 0.4], strafe: 0.85, nade: 0.45 },
};
export const MODES = {
  competitivo: { name: 'Competitivo', desc: 'Bomba · 5v5 · primeiro a 7 · troca de lado', winAt: 7, half: 6, startMoney: 800, ranked: true },
  casual:      { name: 'Casual',      desc: 'Bomba · 5v5 · primeiro a 5 · colete grátis', winAt: 5, half: 0, startMoney: 1500, freeArmor: true },
  treino:      { name: 'Treinamento', desc: 'Sem tempo · dinheiro infinito · bots renascem', winAt: 0, half: 0, startMoney: 16000, training: true },
};
export const BOT_NAMES = ['Falcão', 'Víbora', 'Rocha', 'Trovão', 'Sombra', 'Lince', 'Brasa', 'Corvo', 'Titã', 'Navalha', 'Fantasma', 'Jaguar', 'Aço', 'Raio', 'Lobo', 'Cobra', 'Tanque', 'Zagaia'];
