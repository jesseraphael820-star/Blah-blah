// Item database. Display names/descriptions come from lang files: item.<id>.name / .desc
export const RARITY = {
  common: { color: '#b8c0c8', hex: 0xb8c0c8, order: 0 },
  rare: { color: '#4aa8ff', hex: 0x4aa8ff, order: 1 },
  epic: { color: '#b66cff', hex: 0xb66cff, order: 2 },
  legendary: { color: '#ffb22e', hex: 0xffb22e, order: 3 },
  magic: { color: '#ff5fd2', hex: 0xff5fd2, order: 4 },
  special: { color: '#5fe0a0', hex: 0x5fe0a0, order: 2 },
};

// shape: blade length/width, guard width, colors, glow (emissive), effect
export const SWORDS = {
  wood_sword:    { rarity: 'common', dmg: 8, speed: 1.1, price: 0, blade: 0xa47448, edge: 0xc79560, guard: 0x6b4423, grip: 0x4a2f18, len: 0.85, w: 0.13, gw: 0.36 },
  bronze_sword:  { rarity: 'common', dmg: 12, speed: 1.0, price: 120, blade: 0xc98a4b, edge: 0xe8b07a, guard: 0x7a5530, grip: 0x3b2a1a, len: 0.95, w: 0.13, gw: 0.4 },
  iron_sword:    { rarity: 'common', dmg: 17, speed: 1.0, price: 340, blade: 0xb9c3cc, edge: 0xe9eef2, guard: 0x5a5f66, grip: 0x3a2a20, len: 1.0, w: 0.14, gw: 0.44 },
  farmer_shovel: { rarity: 'special', dmg: 15, speed: 1.3, price: 0, blade: 0x8a949c, edge: 0xb0bac2, guard: 0x8a949c, grip: 0x8a5a30, len: 0.7, w: 0.3, gw: 0.1, shape: 'shovel' },
  hunter_blade:  { rarity: 'rare', dmg: 22, speed: 1.15, price: 780, blade: 0x9fb4a8, edge: 0xe6f2ea, guard: 0x5c3d24, grip: 0x2c2014, len: 1.0, w: 0.12, gw: 0.38, req: { flag: 'hunterBlade' } },
  frost_edge:    { rarity: 'rare', dmg: 24, speed: 0.95, price: 1250, blade: 0x8fd8ff, edge: 0xe8fbff, guard: 0x3c6e9c, grip: 0x22344a, len: 1.05, w: 0.15, gw: 0.5, glow: 0x5fc8ff, effect: 'chill', req: { rep: ['aurora', 25] } },
  ember_saber:   { rarity: 'epic', dmg: 30, speed: 1.05, price: 2300, blade: 0xff7a2e, edge: 0xffd15c, guard: 0x5a1e10, grip: 0x2a120a, len: 1.1, w: 0.14, gw: 0.48, glow: 0xff6a1a, effect: 'burn', req: { level: 8 } },
  verdant_fang:  { rarity: 'epic', dmg: 28, speed: 1.25, price: 0, blade: 0x4fd36a, edge: 0xbaffc8, guard: 0x2d5a2a, grip: 0x3a2a14, len: 0.95, w: 0.12, gw: 0.3, glow: 0x3fe070, effect: 'leech' },
  storm_cleaver: { rarity: 'epic', dmg: 37, speed: 0.85, price: 3200, blade: 0x7f8cff, edge: 0xe0e4ff, guard: 0x2b2f6a, grip: 0x1a1c30, len: 1.25, w: 0.22, gw: 0.6, glow: 0x9aa8ff, effect: 'shock', req: { level: 11, rep: ['aurora', 60] } },
  moon_blade:    { rarity: 'legendary', dmg: 41, speed: 1.1, price: 5800, blade: 0xd8e0ff, edge: 0xffffff, guard: 0x6d78b8, grip: 0x2a2c48, len: 1.15, w: 0.14, gw: 0.5, glow: 0xbfd0ff, effect: 'leech', req: { flag: 'moonBlade' } },
  guardian_sword:{ rarity: 'legendary', dmg: 44, speed: 0.92, price: 0, blade: 0xc9b98a, edge: 0xfff2c0, guard: 0x8a6a2a, grip: 0x3a2a14, len: 1.2, w: 0.2, gw: 0.62, glow: 0xffd36a, effect: 'quake' },
  aurora_blade:  { rarity: 'legendary', dmg: 50, speed: 1.1, price: 0, blade: 0xffe9a8, edge: 0xffffff, guard: 0xffb22e, grip: 0x6a3a1a, len: 1.25, w: 0.16, gw: 0.66, glow: 0xffc85a, effect: 'dawn', special: 'spin' },
  void_reaver:   { rarity: 'magic', dmg: 62, speed: 1.0, price: 9500, blade: 0x5a1a8a, edge: 0xff5fd2, guard: 0x1a0a2a, grip: 0x0a0510, len: 1.35, w: 0.18, gw: 0.6, glow: 0xd04cff, effect: 'void', special: 'spin', req: { flag: 'storyDone' } },
};

export const ARMORS = {
  cloth:    { def: 0, price: 0, color: null, trim: null },
  leather:  { def: 4, price: 220, color: 0x8a5a32, trim: 0x5a3a1e, pads: false },
  chain:    { def: 8, price: 650, color: 0x9aa3ab, trim: 0x6a737a, pads: true },
  knight:   { def: 14, price: 1900, color: 0xc8ced6, trim: 0xd4a83a, pads: true, req: { level: 7 } },
  guardian: { def: 18, price: 0, color: 0xc9b98a, trim: 0x4fd0ff, pads: true, glow: 0x4fd0ff },
  shadow:   { def: 23, price: 4200, color: 0x2a2338, trim: 0xb66cff, pads: true, glow: 0xb66cff, req: { level: 12 } },
  // ---- rare armors: never sold, only found (chests, enemies, bosses). The rarer, the lower the chance ----
  bronze:    { def: 10, price: 0, rar: 'rare', find: 1 / 10, color: 0xb0783a, trim: 0xe0a85a, pads: true, fx: 'shine' },
  verdant:   { def: 15, price: 0, rar: 'rare', find: 1 / 14, color: 0x3a7a3a, trim: 0x9ae86a, pads: true, glow: 0x7aff6a, fx: 'leaves' },
  frost:     { def: 20, price: 0, rar: 'epic', find: 1 / 30, color: 0xbfe6ff, trim: 0x6ad8ff, pads: true, glow: 0x9ae8ff, fx: 'frost', crest: true },
  ember:     { def: 21, price: 0, rar: 'epic', find: 1 / 34, color: 0x4a1a12, trim: 0xff6a1a, pads: true, glow: 0xff7a2a, fx: 'ember', crest: true },
  storm:     { def: 27, price: 0, rar: 'legendary', find: 1 / 90, color: 0x2a3550, trim: 0x8ad8ff, pads: true, glow: 0xb0e8ff, fx: 'storm', crest: true, wings: false },
  celestial: { def: 30, price: 0, rar: 'legendary', find: 1 / 120, color: 0xf4f0e0, trim: 0xffc83a, pads: true, glow: 0xfff0a0, fx: 'holy', crest: true, halo: true },
  void:      { def: 36, price: 0, rar: 'magic', find: 1 / 320, color: 0x120c1e, trim: 0xb66cff, pads: true, glow: 0xd08aff, fx: 'void', crest: true },
  aurora:    { def: 40, price: 0, rar: 'magic', find: 1 / 450, color: 0x1e2a4a, trim: 0x7affc8, pads: true, glow: 0x7affc8, fx: 'aurora', crest: true, halo: true },
};
export const RARE_ARMORS = Object.keys(ARMORS).filter((k) => ARMORS[k].find);

export const HATS = {
  none: { price: 0 },
  straw: { price: 90 },
  cap: { price: 70 },
  flower: { price: 260 },
  hood: { price: 380 },
  helmet: { price: 720, req: { level: 4 } },
  wizard: { price: 950, req: { level: 6 } },
  crown: { price: 6000, req: { level: 12 } },
};
export const ACCESSORIES = {
  none: { price: 0 },
  scarf: { price: 140 },
  glasses: { price: 110 },
  backpack: { price: 240 },
  cape: { price: 520 },
  necklace: { price: 450 },
  bandana: { price: 160 },
  earrings: { price: 300 },
  flowerpin: { price: 120 },
  wings: { price: 6500, req: { level: 14 } },
};

// Skins override the whole body palette. 'custom' uses the character creator colors.
export const SKINS = {
  custom: { price: 0 },
  farmer: { price: 300, pal: { shirt: 0xd9c27a, pants: 0x3d6aa8, shoes: 0x5a3a1e, hat: 'straw' } },
  knight: { price: 1200, pal: { shirt: 0xa8b2bc, pants: 0x5a6068, shoes: 0x3a3e44, trim: 0xd4a83a } },
  ninja: { price: 1500, pal: { shirt: 0x1e1e2a, pants: 0x1e1e2a, shoes: 0x121218, trim: 0xd43a3a, mask: 0x1e1e2a } },
  mage: { price: 2000, pal: { shirt: 0xb23a2a, pants: 0x5a1a14, shoes: 0x2a120a, trim: 0xffb22e, hat: 'wizard' } },
  spirit: { price: 2600, pal: { shirt: 0x3fa864, pants: 0x2a6a3e, shoes: 0x1e3a22, trim: 0xbaffc8, skin: 0xb8f0c8, hair: 0x2fd070, glow: 0x6fffa0 } },
  skeleton: { price: 1800, pal: { shirt: 0xe8e4d8, pants: 0xd8d4c8, shoes: 0xc8c4b8, skin: 0xf0ece0, hair: 0xf0ece0, trim: 0x2a2a2a, eye: 0xff4a2a } },
  golden: { price: 8000, req: { level: 10 }, pal: { shirt: 0xffc83a, pants: 0xd49a20, shoes: 0x8a5a10, trim: 0xffffff, hair: 0xffe08a, glow: 0xffd36a } },
};

export const PETS = {
  dog: { price: 0, color: 0xc8955a, ability: 'fetch' },
  cat: { price: 900, color: 0x8a8a90, ability: 'heal' },
  fox: { price: 0, color: 0xe0762a, ability: 'gold' },
};

// Powers: cost (energy), cd (sec), base values scale per level (1..5)
export const POWERS = {
  energy_ball: { cost: 14, cd: 1.1, dmg: 24, color: 0x6fd8ff, price: 0, anim: 'cast_ball' },
  magic_ray:   { cost: 24, cd: 4, dmg: 36, color: 0xff7af0, price: 900, anim: 'cast_ray', req: { level: 5 } },
  energy_burst:{ cost: 34, cd: 8, dmg: 44, color: 0xffe26a, price: 1400, anim: 'cast_burst', req: { level: 7 } },
  shield:      { cost: 28, cd: 15, dmg: 0, color: 0x7affc8, price: 700, anim: 'cast_shield', req: { level: 4 } },
  fire_wave:   { cost: 24, cd: 5, dmg: 20, color: 0xff6a1a, price: 1600, anim: 'cast_fire', req: { level: 8 } },
  frost_nova:  { cost: 30, cd: 10, dmg: 16, color: 0x9fe8ff, price: 1800, anim: 'cast_frost', req: { level: 9 } },
  blink:       { cost: 14, cd: 3, dmg: 0, color: 0xc89aff, price: 1000, anim: 'cast_blink', req: { level: 6 } },
};
export const POWER_MAX = 5;
export function powerUpgradeCost(lvl) { return { gold: 250 * lvl * lvl, essence: lvl * 2, level: lvl * 3 }; }

// Consumables / materials / quest items
export const ITEMS = {
  potion_small: { cat: 'consumable', price: 30, sell: 8, heal: 40, icon: 'potion_red' },
  potion_large: { cat: 'consumable', price: 95, sell: 25, heal: 110, icon: 'potion_big' },
  energy_potion:{ cat: 'consumable', price: 45, sell: 12, energy: 50, icon: 'potion_blue' },
  elixir:       { cat: 'consumable', price: 320, sell: 80, heal: 9999, energy: 9999, icon: 'elixir' },
  bread:        { cat: 'consumable', price: 12, sell: 3, heal: 20, icon: 'bread' },
  apple:        { cat: 'consumable', price: 6, sell: 2, heal: 12, icon: 'apple' },
  stew:         { cat: 'consumable', price: 40, sell: 10, heal: 60, energy: 20, icon: 'stew' },
  coffee:       { cat: 'consumable', price: 25, sell: 6, energy: 15, buff: 'coffee', hours: 3, icon: 'drink_coffee' },
  mead:         { cat: 'consumable', price: 45, sell: 10, heal: 10, buff: 'mead', hours: 2, icon: 'drink_mead' },
  herbal_tea:   { cat: 'consumable', price: 30, sell: 8, heal: 20, buff: 'tea', hours: 3, icon: 'drink_tea' },
  apple_juice:  { cat: 'consumable', price: 15, sell: 4, energy: 25, icon: 'drink_juice' },
  slime_gel:    { cat: 'material', sell: 4, icon: 'gel' },
  wolf_pelt:    { cat: 'material', sell: 12, icon: 'pelt' },
  iron_ore:     { cat: 'material', sell: 10, icon: 'ore' },
  crystal:      { cat: 'material', sell: 30, icon: 'crystal' },
  glowshroom:   { cat: 'material', sell: 9, icon: 'mushroom' },
  wheat:        { cat: 'material', sell: 2, icon: 'wheat' },
  herb:         { cat: 'material', sell: 5, icon: 'herb' },
  essence:      { cat: 'material', price: 160, sell: 40, icon: 'essence' },
  stardust:     { cat: 'material', sell: 60, icon: 'star' },
  stone_core:   { cat: 'material', sell: 45, icon: 'core' },
  // fish (fishing system)
  minnow:     { cat: 'consumable', sell: 4,   heal: 8,  icon: 'fish', color: '#9fb4c0' },
  perch:      { cat: 'consumable', sell: 7,   heal: 14, icon: 'fish', color: '#8ab04a' },
  carp:       { cat: 'consumable', sell: 10,  heal: 18, icon: 'fish', color: '#c08a3a' },
  trout:      { cat: 'consumable', sell: 22,  heal: 26, icon: 'fish', color: '#4aa8ff' },
  catfish:    { cat: 'consumable', sell: 28,  heal: 30, icon: 'fish', color: '#5a6a7a' },
  salmon:     { cat: 'consumable', sell: 34,  heal: 34, icon: 'fish', color: '#ff7a5a' },
  goldfish:   { cat: 'consumable', sell: 90,  heal: 20, icon: 'fish', color: '#ffc83a' },
  glowfish:   { cat: 'consumable', sell: 110, heal: 30, energy: 30, icon: 'fish', color: '#7ae8ff' },
  pike_king:  { cat: 'consumable', sell: 320, heal: 80, icon: 'fish', color: '#2a8a5a' },
  aurora_koi: { cat: 'consumable', sell: 900, heal: 200, energy: 100, icon: 'fish', color: '#ff5fd2' },
  old_boot:   { cat: 'material', sell: 1, icon: 'boot' },
  seaweed:    { cat: 'material', sell: 2, icon: 'herb' },
  rune_fragment:{ cat: 'quest', icon: 'rune' },
  guardian_core:{ cat: 'quest', icon: 'core_gold' },
  bread_basket: { cat: 'quest', icon: 'basket' },
  old_map:      { cat: 'quest', icon: 'map' },
  tower_key:    { cat: 'quest', icon: 'key' },
};

// Chest loot tables
export const CHEST_LOOT = {
  common:    { gold: [15, 40], rolls: 2, pool: [['potion_small', 1], ['bread', 2], ['apple', 3], ['herb', 2], ['slime_gel', 2]] },
  rare:      { gold: [60, 130], rolls: 3, pool: [['potion_small', 2], ['energy_potion', 1], ['iron_ore', 2], ['crystal', 1], ['essence', 1]] },
  epic:      { gold: [160, 300], rolls: 3, pool: [['potion_large', 1], ['energy_potion', 2], ['crystal', 2], ['essence', 2], ['stardust', 1]] },
  legendary: { gold: [350, 600], rolls: 4, pool: [['elixir', 1], ['potion_large', 2], ['essence', 3], ['stardust', 1], ['crystal', 3]] },
};

export function itemCategory(id) {
  if (SWORDS[id]) return 'weapons';
  if (ARMORS[id]) return 'armor';
  if (ITEMS[id]) {
    const c = ITEMS[id].cat;
    return c === 'consumable' ? 'consumables' : c === 'material' ? 'materials' : 'quest';
  }
  return 'materials';
}

// horse prices at the Golden Crow (rarer = pricier)
export const HORSE_PRICES = { common: 450, rare: 1400, epic: 3200, legendary: 7500, mythic: 16000 };
