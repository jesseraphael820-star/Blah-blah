// Constantes do mundo: tamanho dos tiles, tipos de terreno, direções e distritos.

export const T = 32; // tamanho de um tile em pixels do mundo
export const MAP = 168; // largura/altura do mapa em tiles
export const WORLD = T * MAP;

export const TT = {
  GRASS: 0,
  ROAD: 1,
  SIDEWALK: 2,
  BUILDING: 3,
  WATER: 4,
  PARKING: 5,
  PLAZA: 6,
  TREE: 7,
  LOT: 8,
  DOCK: 9,
  POOL: 10,
};

export const SOLID = new Uint8Array(16);
SOLID[TT.BUILDING] = 1;
SOLID[TT.WATER] = 1;
SOLID[TT.TREE] = 1;
SOLID[TT.POOL] = 1;

// Tiles onde pedestres caminham normalmente.
export const PED_WALK = new Uint8Array(16);
PED_WALK[TT.SIDEWALK] = 1;
PED_WALK[TT.PLAZA] = 1;
PED_WALK[TT.DOCK] = 1;

export const DIR = { N: 1, E: 2, S: 4, W: 8 };
export const DIRS = [
  { b: 1, dx: 0, dy: -1, a: -Math.PI / 2, opp: 4, axis: 'v' },
  { b: 2, dx: 1, dy: 0, a: 0, opp: 8, axis: 'h' },
  { b: 4, dx: 0, dy: 1, a: Math.PI / 2, opp: 1, axis: 'v' },
  { b: 8, dx: -1, dy: 0, a: Math.PI, opp: 2, axis: 'h' },
];
export const DIR_BY_BIT = { 1: DIRS[0], 2: DIRS[1], 4: DIRS[2], 8: DIRS[3] };

export const DISTRICT = {
  DOWNTOWN: 0,
  RESIDENTIAL: 1,
  INDUSTRIAL: 2,
  PORT: 3,
  WORKSHOP: 4,
  MIXED: 5,
  EDGE: 6,
};

export const DISTRICT_NAMES = [
  'Centro Comercial',
  'Jardim Aurora',
  'Distrito Fabril',
  'Porto Velho',
  'Vila das Oficinas',
  'Mercado Novo',
  'Orla',
];

export function districtAt(tx, ty) {
  if (tx < 3 || ty < 3 || tx > 150 || ty > 150) return DISTRICT.EDGE;
  if (tx >= 116 && ty < 100) return DISTRICT.INDUSTRIAL;
  if (tx >= 116) return DISTRICT.PORT;
  if (tx < 52 && ty >= 100) return DISTRICT.WORKSHOP;
  if (tx < 52) return DISTRICT.RESIDENTIAL;
  if (ty < 36) return DISTRICT.RESIDENTIAL;
  if (ty < 100) return DISTRICT.DOWNTOWN;
  return DISTRICT.MIXED;
}
