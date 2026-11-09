// Territories of the Wild Lands. Each region is the area closest to its center
// (Voronoi). Raider-held regions have an outpost guarded by a Golem.
export const FACTIONS = {
  aurora: { color: '#ffc83a', hex: 0xffc83a, banner: 0x2a5aa8, trim: 0xffc83a },
  hunters: { color: '#5fd08a', hex: 0x5fd08a, banner: 0x3a6a3a, trim: 0xe0d0a0 },
  raiders: { color: '#e8414e', hex: 0xe8414e, banner: 0x6a1a1a, trim: 0x1a1a1a },
};

// tier sets difficulty (medium overall): 1 near the village, 3 far away
export const REGIONS = [
  { id: 'aurora', c: [30, 45], owner: 'aurora', village: 'aurora' },
  { id: 'farm', c: [-80, 95], owner: 'aurora' },
  { id: 'east', c: [235, 70], owner: 'hunters', village: 'camp' },
  { id: 'forest', c: [-170, -40], owner: 'raiders', outpost: [-148, 2], tier: 1 },
  { id: 'northhills', c: [-20, -125], owner: 'raiders', outpost: [2, -112], tier: 1 },
  { id: 'lakeland', c: [125, -15], owner: 'raiders', outpost: [160, 30], tier: 1 },
  { id: 'south', c: [60, 205], owner: 'raiders', outpost: [40, 185], tier: 2 },
  { id: 'southwest', c: [-180, 185], owner: 'raiders', outpost: [-150, 150], tier: 2 },
  { id: 'northwest', c: [-190, -195], owner: 'raiders', outpost: [-140, -150], tier: 3 },
  { id: 'fareast', c: [255, -130], owner: 'raiders', outpost: [250, -110], tier: 3 },
];

// Building plots around Aurora used when the village grows (x, z, rotation: door faces the plaza)
export const PLOTS = [[-8, 8, 0], [22, -6, 0], [70, 30, 1], [-12, 74, 3], [80, 78, 2], [0, 100, 2]];

export const VILLAGER_NAMES = ['Ana', 'Beto', 'Clara', 'Davi', 'Elisa', 'Fábio', 'Gabi', 'Hugo', 'Iara', 'Júlio', 'Luna', 'Mário', 'Nara', 'Otávio', 'Paula', 'Rui'];

export function regionAt(x, z) {
  let best = REGIONS[0], bd = Infinity;
  for (const r of REGIONS) {
    const d = (r.c[0] - x) ** 2 + (r.c[1] - z) ** 2;
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}
