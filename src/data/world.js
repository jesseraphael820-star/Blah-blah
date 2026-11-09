// Hand-designed world layout. All coordinates are world units (1 voxel step = 1 unit).
export const WORLD = { size: 640, half: 320, cell: 2, n: 320, water: 0 };

export const LOC = {
  village: { x: 30, z: 40, r: 46, h: 4 },
  plaza: { x: 30, z: 40 },
  farm: { x: -78, z: 88, r: 44, h: 4 },
  farmPond: { x: -30, z: 128, r: 9 },
  lake: { x: 110, z: -40, r: 44 },
  forest: { x: -170, z: -40, r: 125 },
  forestHeart: { x: -205, z: -80, r: 16 },
  mushroomRing: { x: -252, z: 18, r: 6 },
  ruins: { x: -185, z: -212, r: 26, h: 14 },
  caveEntrance: { x: 40, z: -186 },
  wolfDen: { x: -40, z: -150, r: 14 },
  waterfall: { x: 112, z: -93 },
  plateau: { x0: 92, x1: 132, z0: -138, z1: -93, h: 16 },
  hermit: { x: 160, z: -58 },
  camp: { x: 262, z: 105, r: 20, h: 5 },
  tower: { x: -225, z: 190, r: 14, h: 10 },
  watchtower: { x: 170, z: 240, r: 8, h: 9 },
  peakShrine: { x: -60, z: -262, r: 6, h: 36 },
  dogSpot: { x: -128, z: 30 },
  treasure: { x: 104, z: -102 },
  bar: { x: 2, z: -6, r: 13, h: 5 },
};

export const RIVER = [[150, -24], [198, 18], [214, 88], [200, 160], [228, 238], [300, 322]];
export const RIVER_W = 5;

export const ROADS = [
  { id: 'farm', w: 2.6, pts: [[30, 40], [-10, 62], [-50, 82], [-78, 88]] },
  { id: 'cave', w: 2.4, pts: [[30, 40], [34, 0], [38, -60], [40, -120], [40, -176]] },
  { id: 'forest', w: 2.4, pts: [[30, 40], [-20, 22], [-80, -10], [-140, -40], [-200, -76]] },
  { id: 'camp', w: 2.6, pts: [[30, 40], [90, 62], [160, 86], [214, 96], [262, 105]] },
  { id: 'tower', w: 2.2, pts: [[30, 40], [-30, 110], [-120, 150], [-215, 186]] },
  { id: 'ruins', w: 1.8, pts: [[-200, -76], [-196, -140], [-187, -192]] },
  { id: 'lake', w: 2.0, pts: [[34, 10], [70, 2], [82, -18]] },
  { id: 'watch', w: 1.8, pts: [[262, 105], [232, 170], [172, 236]] },
  { id: 'peak', w: 1.6, pts: [[-40, -150], [-68, -200], [-62, -256]] },
  { id: 'den', w: 1.8, pts: [[38, -100], [0, -125], [-40, -150]] },
];

// Fast travel points
export const WAYSTONES = [
  { id: 'plaza', x: 42, z: 50 },
  { id: 'farm', x: -58, z: 74 },
  { id: 'forest', x: -150, z: -36 },
  { id: 'lake', x: 74, z: -6 },
  { id: 'camp', x: 252, z: 96 },
  { id: 'ruins', x: -176, z: -192 },
  { id: 'cave', x: 46, z: -168 },
  { id: 'tower', x: -205, z: 180 },
];

// Points of interest: discovering them rewards XP + gold
export const POIS = [
  { id: 'village', x: 30, z: 40, r: 40, xp: 10, gold: 0 },
  { id: 'farm', x: -78, z: 88, r: 35, xp: 15, gold: 5 },
  { id: 'forest', x: -150, z: -40, r: 40, xp: 20, gold: 10 },
  { id: 'forestHeart', x: -205, z: -80, r: 18, xp: 40, gold: 20 },
  { id: 'lake', x: 100, z: -20, r: 40, xp: 15, gold: 5 },
  { id: 'waterfall', x: 112, z: -90, r: 16, xp: 30, gold: 15 },
  { id: 'ruins', x: -185, z: -212, r: 26, xp: 50, gold: 25 },
  { id: 'cave', x: 40, z: -184, r: 14, xp: 35, gold: 15 },
  { id: 'camp', x: 262, z: 105, r: 22, xp: 25, gold: 10 },
  { id: 'tower', x: -225, z: 190, r: 20, xp: 40, gold: 20 },
  { id: 'wolfDen', x: -40, z: -150, r: 16, xp: 30, gold: 10 },
  { id: 'watchtower', x: 170, z: 240, r: 14, xp: 30, gold: 20 },
  { id: 'peakShrine', x: -60, z: -262, r: 10, xp: 80, gold: 60 },
  { id: 'mushroomRing', x: -252, z: 18, r: 8, xp: 40, gold: 30 },
  { id: 'hermitHut', x: 164, z: -60, r: 10, xp: 25, gold: 10 },
  { id: 'bar', x: 2, z: -6, r: 16, xp: 15, gold: 10 },
];

// Chests: id, position, rarity. Some contain fixed loot.
export const CHESTS = [
  { id: 'c_village', x: 4, z: 70, r: 'common' },
  { id: 'c_farm', x: -100, z: 112, r: 'common' },
  { id: 'c_barn', x: -96, z: 64, r: 'common' },
  { id: 'c_lake', x: 150, z: -10, r: 'rare' },
  { id: 'c_forest1', x: -120, z: -80, r: 'common' },
  { id: 'c_forest2', x: -230, z: -20, r: 'rare' },
  { id: 'c_heart', x: -214, z: -86, r: 'rare' },
  { id: 'c_mushroom', x: -252, z: 18, r: 'epic', loot: { swords: ['verdant_fang'] } },
  { id: 'c_den', x: -46, z: -158, r: 'rare' },
  { id: 'c_ruins1', x: -170, z: -226, r: 'epic' },
  { id: 'c_ruins2', x: -200, z: -200, r: 'rare' },
  { id: 'c_peak', x: -60, z: -262, r: 'legendary', loot: { swords: ['guardian_sword'] } },
  { id: 'c_waterfall', x: 104, z: -102, r: 'legendary', loot: { items: { stardust: 2 }, gold: 400 } },
  { id: 'c_camp', x: 276, z: 120, r: 'common' },
  { id: 'c_watch', x: 170, z: 240, r: 'epic', yOff: 13, loot: { items: { old_map: 1 } } },
  { id: 'c_tower', x: -225, z: 190, r: 'epic', yOff: 0, onTop: true },
  { id: 'c_hills1', x: 120, z: 160, r: 'common' },
  { id: 'c_hills2', x: -150, z: 230, r: 'rare' },
  { id: 'c_river', x: 240, z: 30, r: 'common' },
  { id: 'c_south', x: 40, z: 230, r: 'rare' },
  { id: 'c_west', x: -280, z: 120, r: 'rare' },
  { id: 'c_east', x: 290, z: -100, r: 'epic' },
  { id: 'c_north', x: 150, z: -160, r: 'rare' },
  // cave chests are placed by the cave generator (ids c_cave*)
];

// Interactive resource nodes
export const ORES = [
  [30, -178], [52, -176], [60, -160], [20, -165], [-20, -170], [80, -170], [100, -150], [-90, -185],
];
export const GLOWSHROOMS = [
  [-180, -30], [-210, -50], [-160, -90], [-240, -70], [-190, 10], [-140, -10], [-225, -110], [-170, -120],
];
export const HERBS = [
  [-20, 100], [60, 120], [-120, 60], [100, 40], [-60, 20], [140, 120], [-180, 120], [20, -40],
];

// Farm crop fields (axis aligned rects) — crop: wheat | pumpkin | corn | carrot
export const FIELDS = [
  { x0: -96, x1: -70, z0: 98, z1: 118, crop: 'wheat' },
  { x0: -66, x1: -46, z0: 112, z1: 128, crop: 'pumpkin' },
  { x0: -122, x1: -102, z0: 104, z1: 124, crop: 'corn' },
  { x0: -44, x1: -30, z0: 100, z1: 112, crop: 'carrot' },
];

// Stream on the waterfall plateau (second water level)
export const STREAM = { x0: 109, x1: 115, z0: -134, z1: -93, level: 15.4 };
export const SECRET_CHAMBER = { cx0: 105, cx1: 109, cz0: -100, cz1: -93, rx0: 99, rx1: 109, rz0: -105, rz1: -100 };
