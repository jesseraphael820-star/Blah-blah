// NPC definitions. Display role/lines live in lang files (npc.<id>.*).
// Navigation nodes: NPCs walk along this graph between their schedule points.
export const NODES = {
  // village
  plaza: [34, 45], pN: [32, 27], pS: [30, 56], pE: [46, 44], pW: [17, 40], market: [23, 36],
  elderDoor: [6, 29.5], forge: [55.2, 33.2], tailorDoor: [12, 42], innDoor: [34, 63], inn2: [28, 61],
  libDoor: [60, 60], pedDoor: [62, 77], guard: [38, 13], gate: [33, 4], well: [26, 44],
  // farm
  farmC: [-76, 92], farmDoor: [-58, 94.5], fieldA: [-82, 94], barnDoor: [-96, 79], coop: [-50, 89], corral: [-106, 90],
  // camp
  campC: [258, 102], campTent: [270, 112], campLook: [248, 94],
  // lake
  barDoor: [2, 0.5], barYard: [2, 4],
  pier: [80, -12], lakeW: [72, 0], hermitHut: [163, -58], hermitShore: [156, -48],
};
export const EDGES = [
  ['plaza', 'pN'], ['plaza', 'pS'], ['plaza', 'pE'], ['plaza', 'pW'], ['plaza', 'market'], ['plaza', 'well'],
  ['pW', 'elderDoor'], ['pW', 'tailorDoor'], ['pN', 'guard'], ['guard', 'gate'], ['pN', 'market'],
  ['pE', 'forge'], ['pE', 'libDoor'], ['pS', 'innDoor'], ['pS', 'inn2'], ['inn2', 'innDoor'], ['pS', 'pedDoor'],
  ['farmC', 'farmDoor'], ['farmC', 'fieldA'], ['farmC', 'barnDoor'], ['farmC', 'coop'], ['farmC', 'corral'],
  ['campC', 'campTent'], ['campC', 'campLook'],
  ['barDoor', 'barYard'],
  ['pier', 'lakeW'], ['hermitHut', 'hermitShore'],
];

// pal: skin, hair, shirt, pants, shoes, trim, eye ; hairStyle; hat; acc; beard
// schedule: [hourFrom, node, activity]; 'home' = hidden indoors (sleeping)
export const NPCS = {
  tomas: {
    pal: { skin: 0xe0b088, hair: 0xe8e8e8, shirt: 0x6a4a8a, pants: 0x4a3a5a, shoes: 0x2a1f16, trim: 0xd4a83a, eye: 0x3a2a1a },
    hairStyle: 'bald', beard: true, hat: 'none', pitch: 0.72, staff: true,
    schedule: [[0, 'elderDoor', 'home'], [7, 'plaza', 'idle'], [12, 'well', 'idle'], [15, 'plaza', 'idle'], [20, 'elderDoor', 'idle'], [22, 'elderDoor', 'home']],
  },
  bento: {
    pal: { skin: 0xb07a50, hair: 0x2a1a10, shirt: 0x8a3a2a, pants: 0x3a2a1a, shoes: 0x1a120a, trim: 0x5a4030, eye: 0x2a1a10 },
    hairStyle: 'short', beard: true, apron: 0x5a4030, pitch: 0.85, shop: 'smith', scale: 1.1,
    schedule: [[0, 'forge', 'home'], [6, 'forge', 'hammer'], [12, 'innDoor', 'idle'], [13, 'forge', 'hammer'], [19, 'inn2', 'idle'], [22, 'forge', 'home']],
  },
  lia: {
    pal: { skin: 0xf3d0b0, hair: 0xb83a5a, shirt: 0xe07ab0, pants: 0x5a3a7a, shoes: 0x3a2a4a, trim: 0xffe08a, eye: 0x3a7a5a },
    hairStyle: 'long', hat: 'none', pitch: 1.35, shop: 'tailor',
    schedule: [[0, 'tailorDoor', 'home'], [8, 'tailorDoor', 'idle'], [12, 'market', 'idle'], [14, 'tailorDoor', 'idle'], [20, 'plaza', 'idle'], [22, 'tailorDoor', 'home']],
  },
  rosa: {
    pal: { skin: 0xd8a070, hair: 0x6a2a1a, shirt: 0x3a8a6a, pants: 0x6a4a2a, shoes: 0x2a1a10, trim: 0xf0e0c0, eye: 0x2a1a10 },
    hairStyle: 'bun', apron: 0xf0e0c0, pitch: 1.15, shop: 'inn',
    schedule: [[0, 'innDoor', 'home'], [6, 'innDoor', 'idle'], [10, 'market', 'idle'], [12, 'innDoor', 'idle'], [23, 'innDoor', 'home']],
  },
  pedrinho: {
    pal: { skin: 0xf0c090, hair: 0xd08a3a, shirt: 0xe0c03a, pants: 0x3a5a8a, shoes: 0x8a2a2a, trim: 0xffffff, eye: 0x2a4a7a },
    hairStyle: 'spiky', hat: 'cap', pitch: 1.65, scale: 0.72,
    schedule: [[0, 'pedDoor', 'home'], [8, 'plaza', 'play'], [11, 'well', 'play'], [13, 'pedDoor', 'idle'], [15, 'pS', 'play'], [19, 'pedDoor', 'idle'], [21, 'pedDoor', 'home']],
  },
  rafael: {
    pal: { skin: 0xc89060, hair: 0x1a1a1a, shirt: 0x9aa3ab, pants: 0x3a4a6a, shoes: 0x2a2a2a, trim: 0x2a5aa8, eye: 0x1a1a1a },
    hairStyle: 'short', hat: 'helmet', pitch: 0.95, spear: true,
    schedule: [[0, 'guard', 'guard'], [6, 'gate', 'guard'], [10, 'guard', 'guard'], [14, 'plaza', 'idle'], [16, 'gate', 'guard'], [20, 'guard', 'guard']],
  },
  isis: {
    pal: { skin: 0x8a5a3a, hair: 0x1a1020, shirt: 0x2a4a8a, pants: 0x2a2a4a, shoes: 0x1a1a2a, trim: 0xd4a83a, eye: 0x6a3a1a },
    hairStyle: 'ponytail', acc: 'glasses', pitch: 1.25, shop: 'magic', book: true,
    schedule: [[0, 'libDoor', 'home'], [8, 'libDoor', 'read'], [13, 'pE', 'idle'], [15, 'libDoor', 'read'], [23, 'libDoor', 'home']],
  },
  marta: {
    pal: { skin: 0xe8b890, hair: 0xc8a04a, shirt: 0xc84a3a, pants: 0x3a6aa8, shoes: 0x5a3a1e, trim: 0xffffff, eye: 0x3a6a2a },
    hairStyle: 'braid', hat: 'straw', pitch: 1.1, hoe: true,
    schedule: [[0, 'farmDoor', 'home'], [5, 'fieldA', 'farm'], [9, 'coop', 'idle'], [11, 'fieldA', 'farm'], [13, 'farmDoor', 'idle'], [15, 'corral', 'idle'], [18, 'farmC', 'idle'], [21, 'farmDoor', 'home']],
  },
  caio: {
    pal: { skin: 0xc8905a, hair: 0x5a3a1a, shirt: 0x4a6a3a, pants: 0x5a4a2a, shoes: 0x3a2a1a, trim: 0x8a5a2a, eye: 0x3a2a1a },
    hairStyle: 'messy', hat: 'hood', beard: true, pitch: 0.9, shop: 'hunter', bow: true,
    schedule: [[0, 'campC', 'sit'], [6, 'campLook', 'guard'], [11, 'campC', 'sit'], [14, 'campTent', 'idle'], [17, 'campLook', 'guard'], [20, 'campC', 'sit']],
  },
  ze: {
    pal: { skin: 0xd0a070, hair: 0x9a9a9a, shirt: 0x5a7a9a, pants: 0x4a4a3a, shoes: 0x2a2a1a, trim: 0xffffff, eye: 0x2a2a2a },
    hairStyle: 'short', hat: 'straw', beard: true, pitch: 0.8, rod: true,
    schedule: [[0, 'lakeW', 'home'], [6, 'pier', 'fish'], [18, 'lakeW', 'idle'], [20, 'lakeW', 'home']],
  },
  joana: {
    pal: { skin: 0xf0c8a0, hair: 0x3a2010, shirt: 0xf0a03a, pants: 0x7a3a5a, shoes: 0x3a1a1a, trim: 0xffffff, eye: 0x3a2a1a },
    hairStyle: 'long', hat: 'flower', pitch: 1.3,
    schedule: [[0, 'inn2', 'home'], [7, 'market', 'idle'], [12, 'well', 'idle'], [14, 'market', 'idle'], [19, 'inn2', 'idle'], [22, 'inn2', 'home']],
  },
  lirio: {
    pal: { skin: 0xc0b8d0, hair: 0xd8d8f0, shirt: 0x2a2a5a, pants: 0x1a1a3a, shoes: 0x101020, trim: 0xbfd0ff, eye: 0x9ab0ff },
    hairStyle: 'long', beard: true, hat: 'hood', pitch: 0.65, shop: 'hermit', secret: true, glow: 0xbfd0ff,
    schedule: [[0, 'hermitShore', 'idle'], [5, 'hermitHut', 'gone'], [20, 'hermitShore', 'idle']],
  },
  zeca: {
    pal: { skin: 0xd8a878, hair: 0x2a2a2a, shirt: 0x8a2a8a, pants: 0x2a2a4a, shoes: 0x1a1a1a, trim: 0xffc83a, eye: 0x2a2a2a },
    hairStyle: 'short', hat: 'wizard', acc: 'backpack', pitch: 1.0, shop: 'traveler', event: 'merchant',
    schedule: [[0, 'market', 'idle']],
  },
  gael: {
    pal: { skin: 0xc8905a, hair: 0x1a1a1a, shirt: 0xf0ece0, pants: 0x2a2a3a, shoes: 0x1a1a1a, trim: 0x8a2a2a, eye: 0x3a2a1a },
    hairStyle: 'short', beard: true, apron: 0x3a2a5a, pitch: 0.95, shop: 'bar', scale: 1.05,
    schedule: [[0, 'barDoor', 'idle'], [3, 'barDoor', 'home'], [9, 'barDoor', 'idle'], [13, 'barYard', 'idle'], [16, 'barDoor', 'idle']],
  },
  spirit: {
    pal: { skin: 0xfff0c0, hair: 0xffd36a, shirt: 0xfff8e0, pants: 0xffe8a8, shoes: 0xffd36a, trim: 0xffb22e, eye: 0xff9a2a },
    hairStyle: 'long', pitch: 1.4, glow: 0xffd36a, float: true, quest: true,
    schedule: [[0, null, 'idle']],
  },
};

// shop inventories
export const SHOPS = {
  smith: { swords: ['bronze_sword', 'iron_sword', 'frost_edge', 'ember_saber', 'storm_cleaver', 'void_reaver'], armors: ['leather', 'chain', 'knight', 'shadow'], items: [], rep: 'aurora' },
  tailor: { skins: ['farmer', 'knight', 'ninja', 'skeleton', 'mage', 'spirit', 'golden'], hats: ['straw', 'cap', 'flower', 'hood', 'helmet', 'wizard', 'crown'], accessories: ['scarf', 'glasses', 'backpack', 'cape', 'wings'], pets: ['cat'], rep: 'aurora' },
  inn: { items: ['bread', 'apple', 'stew', 'potion_small', 'potion_large', 'energy_potion'], rep: 'aurora' },
  magic: { powers: ['shield', 'magic_ray', 'blink', 'energy_burst', 'frost_nova'], items: ['essence', 'energy_potion'], rep: 'aurora' },
  hunter: { swords: ['hunter_blade'], armors: ['leather', 'chain'], items: ['potion_small', 'stew', 'bread'], rep: 'camp' },
  hermit: { swords: ['moon_blade'], powers: ['fire_wave'], items: ['essence', 'elixir'], rep: null },
  bar: { accessories: ['scarf', 'glasses', 'necklace', 'bandana', 'earrings', 'flowerpin', 'backpack', 'cape', 'wings'], items: ['coffee', 'mead', 'herbal_tea', 'apple_juice', 'stew'], horses: ['common', 'rare', 'epic', 'legendary', 'mythic'], rep: 'aurora' },
  traveler: { swords: ['frost_edge', 'ember_saber'], items: ['elixir', 'essence', 'potion_large', 'stardust'], skins: ['ninja'], markup: 1.15, rep: null },
};

export const REP_TIERS = [
  { min: 0, id: 'neutral', discount: 0 },
  { min: 25, id: 'friendly', discount: 0.05 },
  { min: 60, id: 'honored', discount: 0.1 },
  { min: 100, id: 'revered', discount: 0.15 },
  { min: 150, id: 'exalted', discount: 0.2 },
];
export function repTier(v) {
  let tier = REP_TIERS[0];
  for (const t of REP_TIERS) if (v >= t.min) tier = t;
  return tier;
}
