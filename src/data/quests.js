// Quest definitions. Texts in lang: q.<id>.title/.desc/.s<i> (step text) and dialogue keys.
// Step types: talk, kill, collect, deliver, reach, interact, boss, chest
export const QUESTS = {
  main1: {
    type: 'main', giver: 'tomas', chapter: 1,
    steps: [
      { type: 'kill', enemy: ['slime'], n: 3, at: [-105, 40] },
      { type: 'talk', npc: 'tomas' },
    ],
    rewards: { gold: 60, xp: 90, items: { potion_small: 2 }, swords: ['bronze_sword'] },
  },
  main2: {
    type: 'main', giver: 'tomas', chapter: 2, req: { quests: ['main1'] },
    steps: [
      { type: 'reach', at: [-205, -80], r: 14 },
      { type: 'kill', enemy: ['sprite'], n: 3, at: [-200, -60] },
      { type: 'interact', target: 'altar', n: 1, at: [-205, -84], grant: { powers: ['energy_ball'], items: { rune_fragment: 1 } } },
      { type: 'talk', npc: 'tomas' },
    ],
    rewards: { gold: 150, xp: 240, items: { energy_potion: 2 } },
  },
  main3: {
    type: 'main', giver: 'rafael', chapter: 3, req: { quests: ['main2'] },
    steps: [
      { type: 'kill', enemy: ['wolf', 'shadow_wolf'], n: 5, at: [-20, -120] },
      { type: 'talk', npc: 'caio' },
      { type: 'reach', at: [-40, -150], r: 12 },
      { type: 'boss', enemy: 'alpha_wolf', n: 1, at: [-40, -150] },
      { type: 'talk', npc: 'rafael' },
    ],
    rewards: { gold: 320, xp: 520, powers: ['shield'], rep: { aurora: 25 }, items: { potion_large: 1 } },
  },
  main4: {
    type: 'main', giver: 'isis', chapter: 4, req: { quests: ['main3'] },
    steps: [
      { type: 'reach', at: [-185, -205], r: 16 },
      { type: 'interact', target: 'pillar', n: 3, at: [-185, -212] },
      { type: 'boss', enemy: 'stone_guardian', n: 1, at: [-185, -218], grant: { items: { guardian_core: 1 } } },
      { type: 'talk', npc: 'isis' },
    ],
    rewards: { gold: 520, xp: 900, powers: ['magic_ray', 'energy_burst'], armors: ['guardian'], rep: { aurora: 20 } },
  },
  main5: {
    type: 'main', giver: 'bento', chapter: 5, req: { quests: ['main4'] },
    steps: [
      { type: 'reach', at: [40, -186], r: 8 },
      { type: 'boss', enemy: 'golem_king', n: 1, at: 'caveBoss' },
      { type: 'interact', target: 'pedestal', n: 1, at: 'cavePedestal', grant: { swords: ['aurora_blade'] } },
      { type: 'talk', npc: 'bento' },
    ],
    rewards: { gold: 800, xp: 1300, powers: ['frost_nova'], rep: { aurora: 20 } },
  },
  main6: {
    type: 'main', giver: 'tomas', chapter: 6, req: { quests: ['main5'] },
    steps: [
      { type: 'reach', at: [-225, 182], r: 14, night: true },
      { type: 'reach', at: [-225, 190], r: 7, minY: 40 },
      { type: 'boss', enemy: 'primordial_shadow', n: 1, at: [-225, 190] },
      { type: 'talk', npc: 'spirit' },
      { type: 'talk', npc: 'tomas' },
    ],
    rewards: { gold: 2000, xp: 2500, powers: ['blink'], titles: ['hero'], flags: ['storyDone'], rep: { aurora: 50, camp: 30 } },
  },
  // ---------------- side quests ----------------
  side_harvest: {
    type: 'side', giver: 'marta',
    steps: [
      { type: 'collect', item: 'wheat', n: 6, at: [-82, 106] },
      { type: 'deliver', item: 'wheat', n: 6, npc: 'marta' },
    ],
    rewards: { gold: 70, xp: 70, items: { bread: 3 }, rep: { aurora: 8 } },
  },
  side_chickens: {
    type: 'side', giver: 'marta', req: { quests: ['side_harvest'] },
    steps: [
      { type: 'interact', target: 'chicken', n: 4, at: [-78, 88] },
      { type: 'talk', npc: 'marta' },
    ],
    rewards: { gold: 60, xp: 90, swords: ['farmer_shovel'], rep: { aurora: 8 } },
  },
  side_dog: {
    type: 'side', giver: 'pedrinho',
    steps: [
      { type: 'reach', at: [-128, 30], r: 10 },
      { type: 'interact', target: 'lostdog', n: 1, at: [-128, 30] },
      { type: 'talk', npc: 'pedrinho' },
    ],
    rewards: { gold: 80, xp: 110, pets: ['dog'], rep: { aurora: 10 } },
  },
  side_bread: {
    type: 'side', giver: 'rosa', onAccept: { items: { bread_basket: 1 } },
    steps: [
      { type: 'deliver', item: 'bread_basket', n: 1, npc: 'caio' },
    ],
    rewards: { gold: 75, xp: 90, rep: { camp: 10, aurora: 5 } },
  },
  side_hunt: {
    type: 'side', giver: 'caio', req: { quests: ['main1'] },
    steps: [
      { type: 'kill', enemy: ['wolf', 'shadow_wolf'], n: 6, at: [170, 150] },
      { type: 'talk', npc: 'caio' },
    ],
    rewards: { gold: 160, xp: 200, flags: ['hunterBlade'], rep: { camp: 15 } },
  },
  side_ore: {
    type: 'side', giver: 'bento',
    steps: [
      { type: 'collect', item: 'iron_ore', n: 5, at: [40, -172] },
      { type: 'deliver', item: 'iron_ore', n: 5, npc: 'bento' },
    ],
    rewards: { gold: 100, xp: 150, swords: ['iron_sword'], rep: { aurora: 10 } },
  },
  side_shrooms: {
    type: 'side', giver: 'isis',
    steps: [
      { type: 'collect', item: 'glowshroom', n: 4, at: [-190, -50] },
      { type: 'deliver', item: 'glowshroom', n: 4, npc: 'isis' },
    ],
    rewards: { gold: 120, xp: 160, items: { energy_potion: 3, essence: 3 }, rep: { aurora: 6 } },
  },
  side_bats: {
    type: 'side', giver: 'rafael', req: { quests: ['main3'] },
    steps: [
      { type: 'kill', enemy: ['bat'], n: 6, at: [40, -186] },
      { type: 'talk', npc: 'rafael' },
    ],
    rewards: { gold: 220, xp: 260, items: { potion_large: 2 }, rep: { aurora: 12 } },
  },
  side_treasure: {
    type: 'side', giver: 'ze',
    steps: [
      { type: 'collect', item: 'old_map', n: 1, at: [170, 240] },
      { type: 'chest', chest: 'c_waterfall', n: 1, at: [104, -102] },
    ],
    rewards: { gold: 100, xp: 300, rep: { aurora: 5 } },
  },
  side_moon: {
    type: 'side', giver: 'lirio',
    steps: [
      { type: 'collect', item: 'stardust', n: 3 },
      { type: 'deliver', item: 'stardust', n: 3, npc: 'lirio' },
    ],
    rewards: { gold: 0, xp: 320, flags: ['moonBlade'], items: { essence: 2 }, pets: ['fox'] },
  },
};

export const QUEST_ORDER = ['main1', 'main2', 'main3', 'main4', 'main5', 'main6', 'side_harvest', 'side_chickens', 'side_dog', 'side_bread', 'side_hunt', 'side_ore', 'side_shrooms', 'side_bats', 'side_treasure', 'side_moon'];

// Daily challenge templates: stat key tracked during the day
export const CHALLENGES = [
  { id: 'kill10', stat: 'kills', n: 10, gold: 80, xp: 80 },
  { id: 'kill20', stat: 'kills', n: 20, gold: 150, xp: 140 },
  { id: 'gold200', stat: 'gold', n: 200, gold: 60, xp: 60 },
  { id: 'chest2', stat: 'chests', n: 2, gold: 90, xp: 70 },
  { id: 'power15', stat: 'powers', n: 15, gold: 70, xp: 90 },
  { id: 'walk1500', stat: 'distance', n: 1500, gold: 70, xp: 60 },
  { id: 'harvest5', stat: 'harvest', n: 5, gold: 50, xp: 40 },
  { id: 'wolves5', stat: 'wolves', n: 5, gold: 100, xp: 90 },
];

export const DAILY_REWARDS = [
  { gold: 50 }, { gold: 80, items: { potion_small: 2 } }, { gold: 120 }, { gold: 150, items: { energy_potion: 2 } },
  { gold: 200 }, { gold: 250, items: { essence: 2 } }, { gold: 400, items: { elixir: 1 } },
];

export const ACHIEVEMENTS = [
  { id: 'fish1', stat: 'fish', n: 1, gold: 15, icon: 'fish' },
  { id: 'fish50', stat: 'fish', n: 50, gold: 300, icon: 'fish', title: 'angler' },
  { id: 'fishRare', stat: 'fishRare', n: 1, gold: 400, icon: 'fish' },
  { id: 'firstBlood', stat: 'kills', n: 1, gold: 10, icon: 'sword' },
  { id: 'slimes20', stat: 'slimes', n: 20, gold: 60, icon: 'gel', title: 'slimeBane' },
  { id: 'wolves25', stat: 'wolves', n: 25, gold: 120, icon: 'pelt', title: 'wolfslayer' },
  { id: 'kills100', stat: 'kills', n: 100, gold: 250, icon: 'skull', title: 'warrior' },
  { id: 'boss1', stat: 'bossCount', n: 1, gold: 100, icon: 'crown' },
  { id: 'bossAll', stat: 'bossCount', n: 4, gold: 800, icon: 'crown', title: 'legend' },
  { id: 'rich', stat: 'goldEarned', n: 1000, gold: 50, icon: 'coin' },
  { id: 'tycoon', stat: 'goldEarned', n: 10000, gold: 500, icon: 'coin', title: 'tycoon' },
  { id: 'explorer', stat: 'discovered', n: 15, gold: 300, icon: 'map', title: 'explorer' },
  { id: 'chests10', stat: 'chests', n: 10, gold: 150, icon: 'chest', title: 'treasureHunter' },
  { id: 'swords5', stat: 'swordsOwned', n: 5, gold: 150, icon: 'sword' },
  { id: 'skins3', stat: 'skinsOwned', n: 4, gold: 150, icon: 'shirt', title: 'fashion' },
  { id: 'mage', stat: 'powersOwned', n: 7, gold: 400, icon: 'orb', title: 'archmage' },
  { id: 'lvl5', stat: 'level', n: 5, gold: 50, icon: 'star' },
  { id: 'lvl10', stat: 'level', n: 10, gold: 200, icon: 'star' },
  { id: 'lvl15', stat: 'level', n: 15, gold: 500, icon: 'star', title: 'veteran' },
  { id: 'nightOwl', stat: 'midnight', n: 1, gold: 30, icon: 'moon' },
  { id: 'storm', stat: 'storm', n: 1, gold: 40, icon: 'bolt' },
  { id: 'pet', stat: 'petsOwned', n: 1, gold: 50, icon: 'paw' },
  { id: 'hero', stat: 'storyDone', n: 1, gold: 1000, icon: 'trophy' },
  { id: 'sideAll', stat: 'sideDone', n: 10, gold: 400, icon: 'scroll', title: 'goodSamaritan' },
  { id: 'events3', stat: 'events', n: 3, gold: 120, icon: 'bolt' },
];

export const TITLES = ['novice', 'adventurer', 'slimeBane', 'wolfslayer', 'warrior', 'legend', 'tycoon', 'explorer', 'treasureHunter', 'fashion', 'archmage', 'veteran', 'goodSamaritan', 'hero', 'friendOfAurora'];

// fictional rival adventurers for the local leaderboard
export const RIVALS = [
  { name: 'Kaelen', level: 14, title: 'wolfslayer' },
  { name: 'Mirela', level: 11, title: 'archmage' },
  { name: 'Duarte', level: 9, title: 'warrior' },
  { name: 'Yara', level: 7, title: 'explorer' },
  { name: 'Tobias', level: 5, title: 'adventurer' },
  { name: 'Nina', level: 3, title: 'novice' },
];
