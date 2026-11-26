// Itens: armas, escudos, armaduras, consumíveis, materiais e itens de missão. Lojas por vila.
const W = (wtype, dmg, speed, reach, arc, stam, price, extra = {}) => Object.assign({ type: 'weapon', wtype, dmg, speed, reach, arc, stam, price, knock: wtype === 'axe' ? 70 : wtype === 'longsword' ? 60 : 40 }, extra);
const B = (dmg, draw, arrowSpeed, price, extra = {}) => Object.assign({ type: 'bow', wtype: 'bow', dmg, draw, arrowSpeed, price }, extra);
export const ITEMS = {
  // espadas
  w_training: W('sword', 6, 0.38, 18, 100, 8, 5, { tint: '#a8a8a8' }),
  w_iron_sword: W('sword', 10, 0.36, 19, 100, 9, 60),
  w_steel_sword: W('sword', 15, 0.34, 20, 105, 10, 170, { tint: '#e0e8f4' }),
  w_guardian_sword: W('sword', 19, 0.33, 21, 110, 10, 320, { tint: '#d8c8f0', rarity: 2 }),
  // espadas longas
  w_dawnblade: W('longsword', 27, 0.44, 27, 135, 14, 999, { tint: '#ffe8a0', rarity: 3, legendary: true }),
  w_frost_long: W('longsword', 20, 0.48, 25, 125, 15, 240, { tint: '#c8e8ff', rarity: 2 }),
  w_drak_great: W('longsword', 23, 0.55, 26, 135, 18, 280, { tint: '#e0a0a0', rarity: 2 }),
  w_militia_long: W('longsword', 14, 0.5, 24, 120, 15, 110),
  // adagas
  w_dagger: W('dagger', 6, 0.2, 14, 80, 5, 30),
  w_elf_fang: W('dagger', 10, 0.19, 15, 80, 5, 140, { tint: '#a0f0c0', rarity: 1 }),
  w_raven_dagger: W('dagger', 14, 0.17, 15, 85, 5, 400, { tint: '#b080ff', rarity: 3 }),
  // machados
  w_hatchet: W('axe', 9, 0.42, 18, 110, 11, 40),
  w_drak_axe: W('axe', 16, 0.46, 19, 115, 13, 190, { tint: '#d0a0a0', rarity: 1 }),
  w_rune_axe: W('axe', 22, 0.5, 20, 120, 14, 330, { tint: '#a0c8ff', rarity: 2 }),
  // lanças
  w_hunt_spear: W('spear', 9, 0.4, 28, 45, 9, 50),
  w_guard_spear: W('spear', 14, 0.4, 30, 45, 10, 160, { tint: '#d8d0f0' }),
  w_trident: W('spear', 19, 0.4, 31, 55, 10, 260, { tint: '#80e0e0', rarity: 2 }),
  // arcos
  b_short: B(7, 0.5, 230, 60), b_hunter: B(11, 0.55, 260, 150, { tint: '#8a5a2a' }), b_elven: B(16, 0.5, 300, 300, { tint: '#5a8a3a', rarity: 2 }), b_royal: B(22, 0.6, 330, 999, { tint: '#c8a040', rarity: 3 }),
  // escudos
  s_wood: { type: 'shield', block: 0.5, parry: 0.14, price: 20, tint: '#7a4e2a' },
  s_iron: { type: 'shield', block: 0.65, parry: 0.15, price: 95, tint: '#7a7a86' },
  s_brother: { type: 'shield', block: 0.75, parry: 0.18, price: 250, tint: '#7b3fa0', rarity: 2 },
  s_frost: { type: 'shield', block: 0.82, parry: 0.2, price: 300, tint: '#3a6fc4', rarity: 2 },
  // armaduras e mantos
  a_tunic: { type: 'armor', def: 0, price: 5 }, a_padded: { type: 'armor', def: 2, price: 45 }, a_chain: { type: 'armor', def: 5, price: 160 }, a_plate: { type: 'armor', def: 8, price: 420, slow: 0.06 },
  a_fur: { type: 'armor', def: 3, price: 90, cold: true },
  c_varden: { type: 'cloak', def: 1, stam: 20, price: 0, color: '#7b3fa0', rarity: 2 }, c_ranger: { type: 'cloak', def: 1, stam: 10, price: 80, color: '#3f6a2e' }, c_traveler: { type: 'cloak', def: 0, stam: 5, price: 25, color: '#6a5a4a' },
  // consumíveis
  potion: { type: 'consumable', heal: 40, price: 25 }, potion_big: { type: 'consumable', heal: 100, price: 70 }, bread: { type: 'consumable', heal: 15, price: 4 },
  apple: { type: 'consumable', heal: 8, price: 2 }, fish_cooked: { type: 'consumable', heal: 28, price: 10 }, elixir: { type: 'consumable', stamBuff: 60, price: 45 }, stew: { type: 'consumable', heal: 35, price: 14 },
  arrows: { type: 'ammo', price: 1 },
  // materiais
  ore: { type: 'material', price: 8 }, wood: { type: 'material', price: 3 }, herb: { type: 'material', price: 4 }, mushroom: { type: 'material', price: 5 },
  pelt: { type: 'material', price: 12 }, leather: { type: 'material', price: 7 }, gem: { type: 'material', price: 40 }, fish: { type: 'material', price: 6 }, coal: { type: 'material', price: 5 },
  // ferramentas
  fishing_rod: { type: 'tool', price: 30 },
  // missão
  q_feather: { type: 'quest' }, q_cipher: { type: 'quest' }, q_red_cloth: { type: 'quest' }, q_map_frag: { type: 'quest' }, q_king_letter: { type: 'quest' },
  q_raven_sigil: { type: 'quest' }, q_kael_letters: { type: 'quest' }, q_ledger: { type: 'quest' }, q_old_tome: { type: 'quest' }, q_relic: { type: 'quest' },
  q_bell_piece: { type: 'quest' }, q_heart: { type: 'quest' }, q_offering: { type: 'quest' }, q_lost_tome: { type: 'quest' }, q_love_letter: { type: 'quest' },
  q_cargo: { type: 'quest' }, q_coal_crate: { type: 'quest' }, q_evidence: { type: 'quest' }, q_supplies: { type: 'quest' }, q_seal_order: { type: 'quest' },
  q_miner_pick: { type: 'quest' }, q_treasure_map: { type: 'quest' },
};
for (const [id, it] of Object.entries(ITEMS)) it.id = id;

export const SHOPS = {
  osric: ['potion', 'bread', 'apple', 'arrows', 'w_dagger', 'w_hatchet', 'b_short', 's_wood', 'a_padded', 'c_traveler', 'fishing_rod'],
  tessa: ['w_iron_sword', 'w_steel_sword', 'w_hunt_spear', 'w_guard_spear', 'w_militia_long', 's_iron', 'a_chain', 'arrows'],
  marta: ['bread', 'stew', 'apple', 'fish_cooked'],
  eld_shop: ['potion', 'herb', 'b_hunter', 'w_elf_fang', 'c_ranger', 'arrows', 'elixir'],
  drak_smith: ['w_drak_axe', 'w_drak_great', 'w_steel_sword', 'a_chain', 'a_plate', 's_iron'],
  sol_shop: ['potion', 'potion_big', 'elixir', 'w_trident', 'b_hunter', 'arrows', 'fishing_rod', 'a_padded'],
  frost_shop: ['a_fur', 'w_rune_axe', 'w_frost_long', 's_frost', 'stew', 'potion'],
  cinza_smith: ['w_hatchet', 'w_militia_long', 'a_chain', 'coal', 'potion'],
  raven_shop: ['potion', 'potion_big', 'elixir', 'w_dagger', 'mushroom'],
  zeca: ['potion', 'apple', 'arrows', 'elixir', 'bread', 'gem'],
  refuge: ['potion', 'bread', 'arrows'],
};

// custo de melhoria (+1 a +5)
export const UPGRADE = { max: 5, gold: [40, 90, 160, 260, 400], ore: [2, 3, 5, 7, 10], dmgPer: 0.12 };
