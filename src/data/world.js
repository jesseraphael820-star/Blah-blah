// Dados do mundo: facções (vilas), regiões, territórios e layout das vilas.
export const MAP_W = 300, MAP_H = 220;

export const FACTIONS = {
  varden: {
    color: '#7b3fa0', light: '#b88ad8', dark: '#4a2266', capital: 'varden', leader: 'oswin', troops: 140,
    name: 'Várden', resources: ['res_grain', 'res_horses', 'res_trade'],
    motto: { pt: '"A estrada é de todos; a guarda é nossa."', en: '"The road belongs to all; the watch belongs to us."' },
    economy: { pt: 'Guarda das rotas comerciais, pedágios, cereais e criação de cavalos.', en: 'Guarding trade routes, tolls, grain and horse breeding.' },
    culture: { pt: 'Honrados, burocráticos e orgulhosos da tradição. Valorizam juramentos acima de ouro.', en: 'Honorable, bureaucratic and proud of tradition. They value oaths above gold.' },
    army: { pt: 'Os Guardiões da Estrada: cavaleiros leves e lanceiros disciplinados.', en: 'The Road Wardens: light cavalry and disciplined spearmen.' },
    history: { pt: 'Fundada há três séculos por Aldric Várden após a Guerra dos Sete. A Irmandade nasceu para proteger as estradas entre as vilas.', en: 'Founded three centuries ago by Aldric Várden after the War of the Seven. The Brotherhood was born to protect the roads between villages.' },
  },
  eldoria: {
    color: '#3f9a3a', light: '#86d07a', dark: '#22561e', capital: 'eldoria', leader: 'sylvara', troops: 80,
    name: 'Eldoria', resources: ['res_wood', 'res_herbs', 'res_game'],
    motto: { pt: '"Raízes fundas não temem o vento."', en: '"Deep roots do not fear the wind."' },
    economy: { pt: 'Madeira nobre, ervas medicinais e caça regulada.', en: 'Fine timber, medicinal herbs and regulated hunting.' },
    culture: { pt: 'Espirituais e reservados. Honram o Carvalho Ancestral e desconfiam de quem corta sem pedir.', en: 'Spiritual and reserved. They honor the Ancestral Oak and distrust those who cut without asking.' },
    army: { pt: 'Patrulheiros com arcos longos que lutam entre as árvores.', en: 'Longbow rangers who fight among the trees.' },
    history: { pt: 'A mais antiga das vilas. Seus druidas guardam canções sobre o tempo em que as sete vilas eram uma só.', en: 'The oldest of the villages. Its druids keep songs about the time when the seven villages were one.' },
  },
  drakmor: {
    color: '#b8302a', light: '#e8706a', dark: '#6a1612', capital: 'drakmor', leader: 'torvald', troops: 260,
    name: 'Drakmor', resources: ['res_iron', 'res_weapons', 'res_stone'],
    motto: { pt: '"O ferro não se curva."', en: '"Iron does not bend."' },
    economy: { pt: 'Mineração de ferro, forjas e venda de armas.', en: 'Iron mining, forges and arms trade.' },
    culture: { pt: 'Orgulhosos, militaristas e leais à coroa — mas o rei envelhece e o marechal ganha força.', en: 'Proud, militaristic and loyal to the crown — but the king grows old and the marshal grows strong.' },
    army: { pt: 'A Legião Rubra: infantaria pesada e machadeiros veteranos.', en: 'The Crimson Legion: heavy infantry and veteran axemen.' },
    history: { pt: 'Perdeu a Guerra dos Sete e foi obrigada a pagar tributo em ferro por gerações. Nunca esqueceu.', en: 'Lost the War of the Seven and was forced to pay tribute in iron for generations. It never forgot.' },
  },
  solaria: {
    color: '#e0b52a', light: '#f4dc7a', dark: '#8a6a10', capital: 'solaria', leader: 'lucan', troops: 110,
    name: 'Solária', resources: ['res_gold', 'res_wine', 'res_salt'],
    motto: { pt: '"Tudo tem um preço. Até a paz."', en: '"Everything has a price. Even peace."' },
    economy: { pt: 'Comércio marítimo, bancos, vinho e sal.', en: 'Maritime trade, banking, wine and salt.' },
    culture: { pt: 'Pragmáticos e festivos. Contratos são sagrados, desde que lucrativos.', en: 'Pragmatic and festive. Contracts are sacred, as long as they are profitable.' },
    army: { pt: 'Mercenários bem pagos e uma frota de galés.', en: 'Well-paid mercenaries and a fleet of galleys.' },
    history: { pt: 'Cresceu como porto livre. Seus selos de comércio dependem do reconhecimento da Irmandade.', en: 'Grew as a free port. Its trade seals depend on recognition by the Brotherhood.' },
  },
  frostheim: {
    color: '#3a6fc4', light: '#86b0ea', dark: '#1e3e78', capital: 'frostheim', leader: 'brenna', troops: 100,
    name: 'Frostheim', resources: ['res_furs', 'res_fish', 'res_timber'],
    motto: { pt: '"Palavra dada é gelo eterno."', en: '"A word given is eternal ice."' },
    economy: { pt: 'Peles, pesca no fiorde e madeira de pinho.', en: 'Furs, fjord fishing and pine timber.' },
    culture: { pt: 'Honra acima de tudo. Cantam sagas e resolvem disputas em duelos.', en: 'Honor above all. They sing sagas and settle disputes in duels.' },
    army: { pt: 'Escudeiros do Gelo com machados e escudos redondos.', en: 'Ice Shieldbearers with axes and round shields.' },
    history: { pt: 'Aliada antiga de Várden. A Jarl Brenna jurou lealdade sobre o Coração — e espera o mesmo em troca.', en: 'An old ally of Várden. Jarl Brenna swore loyalty upon the Heart — and expects the same in return.' },
  },
  cinzamar: {
    color: '#8a8a8a', light: '#c4c4c4', dark: '#4a4a4a', capital: 'cinzamar', leader: 'halvar', troops: 60,
    name: 'Cinzamar', resources: ['res_coal', 'res_obsidian', 'res_ashcrops'],
    motto: { pt: '"Das cinzas, sempre."', en: '"From the ashes, always."' },
    economy: { pt: 'Carvão, obsidiana e lavouras resistentes em solo de cinzas.', en: 'Coal, obsidian and hardy crops grown in ash soil.' },
    culture: { pt: 'Resilientes e amargos. Lembram da Grande Fome, quando as rotas se fecharam para eles.', en: 'Resilient and bitter. They remember the Great Famine, when the routes closed to them.' },
    army: { pt: 'Milícias de mineiros com picaretas e bestas.', en: 'Miner militias with picks and crossbows.' },
    history: { pt: 'Há vinte anos, Várden revogou o selo de Cinzamar. Sem comércio, a fome levou um terço da vila.', en: 'Twenty years ago, Várden revoked Cinzamar\'s seal. Without trade, famine took a third of the village.' },
  },
  ravencross: {
    color: '#2a2430', light: '#8a7a9a', dark: '#100c14', capital: 'ravencross', leader: 'morwen', troops: 50,
    name: 'Ravencross', resources: ['res_info', 'res_alchemy', 'res_smuggling'],
    motto: { pt: '"Quem vê no escuro governa o dia."', en: '"Who sees in the dark rules the day."' },
    economy: { pt: 'Informação, alquimia e contrabando.', en: 'Information, alchemy and smuggling.' },
    culture: { pt: 'Secretos e pacientes. Ninguém sabe quem realmente governa a vila sobre palafitas.', en: 'Secretive and patient. No one knows who truly rules the village on stilts.' },
    army: { pt: 'Os Corvos: espiões e assassinos com adagas.', en: 'The Ravens: spies and assassins with daggers.' },
    history: { pt: 'Surgiu de exilados da Guerra dos Sete. Oficialmente neutra.', en: 'Rose from exiles of the War of the Seven. Officially neutral.' },
  },
};
export const FACTION_IDS = Object.keys(FACTIONS);
export const NEUTRAL_COLOR = '#c8bca0';

// relações iniciais (-100 guerra .. 100 aliança)
export const RELATIONS = {
  'varden-eldoria': 60, 'varden-drakmor': -20, 'varden-solaria': 55, 'varden-frostheim': 70, 'varden-cinzamar': -30, 'varden-ravencross': 0,
  'eldoria-drakmor': -40, 'eldoria-solaria': 10, 'eldoria-frostheim': 20, 'eldoria-cinzamar': 0, 'eldoria-ravencross': -10,
  'drakmor-solaria': 0, 'drakmor-frostheim': -10, 'drakmor-cinzamar': 20, 'drakmor-ravencross': 10,
  'solaria-frostheim': 20, 'solaria-cinzamar': -10, 'solaria-ravencross': 10, 'frostheim-cinzamar': 0, 'frostheim-ravencross': -20, 'cinzamar-ravencross': 15,
};

// regiões: 0 Eldoria, 1 Várden, 2 Ferro, 3 Pântano, 4 Cinzas, 5 Costa, 6 Norte, 7 Ruínas
export const REGIONS = [
  { id: 0, key: 'reg_forest', cx: 50, cy: 110, danger: 2, music: 'forest', trees: ['oak', 'oak', 'birch', 'pine', 'autumn'], treeDensity: 0.32, animals: ['deer', 'rabbit', 'fox', 'wolf', 'boar', 'bear'], weather: { rain: 0.35, fog: 0.35, leaves: 1 }, enemies: ['bandit', 'wolf'] },
  { id: 1, key: 'reg_plains', cx: 150, cy: 118, danger: 1, music: 'plains', trees: ['oak', 'birch', 'gold'], treeDensity: 0.035, animals: ['rabbit', 'deer', 'fox', 'horse'], weather: { rain: 0.3, fog: 0.12 }, enemies: ['bandit'] },
  { id: 2, key: 'reg_mountains', cx: 240, cy: 45, danger: 3, music: 'mountains', trees: ['pine', 'pine', 'snowpine'], treeDensity: 0.07, animals: ['goat', 'wolf', 'bear'], weather: { rain: 0.25, fog: 0.2, wind: 0.6 }, enemies: ['bandit', 'wolf', 'bear'] },
  { id: 3, key: 'reg_swamp', cx: 50, cy: 192, danger: 3, music: 'swamp', trees: ['willow', 'swamp', 'swamp'], treeDensity: 0.14, animals: ['crocodile', 'boar', 'rabbit'], weather: { rain: 0.45, fog: 0.65 }, enemies: ['cultist', 'crocodile', 'spider'] },
  { id: 4, key: 'reg_ash', cx: 160, cy: 195, danger: 3, music: 'ash', trees: ['ash', 'ash'], treeDensity: 0.04, animals: ['boar', 'rabbit'], weather: { ash: 0.8, fog: 0.25 }, enemies: ['bandit', 'boar'] },
  { id: 5, key: 'reg_coast', cx: 262, cy: 160, danger: 1, music: 'coast', trees: ['palm', 'oak', 'palm'], treeDensity: 0.05, animals: ['rabbit', 'dog'], weather: { rain: 0.25, wind: 0.5 }, enemies: ['smuggler'] },
  { id: 6, key: 'reg_north', cx: 65, cy: 25, danger: 3, music: 'north', trees: ['snowpine', 'snowpine', 'pine'], treeDensity: 0.14, animals: ['frostwolf', 'snowrabbit', 'deer', 'whitebear'], weather: { snow: 0.8, wind: 0.7, fog: 0.2 }, enemies: ['frostwolf', 'bandit'] },
  { id: 7, key: 'reg_ruins', cx: 150, cy: 45, danger: 2, music: 'ruins', trees: ['oak', 'birch', 'pine'], treeDensity: 0.08, animals: ['deer', 'rabbit', 'fox'], weather: { fog: 0.45, rain: 0.25 }, enemies: ['grave_robber', 'wolf'] },
];

// territórios (posição em tiles) — distribuição desigual de propósito
export const TERRITORIES = [
  // Frostheim (5)
  ['fr_capital', 'Frostheim', 70, 25, 'frostheim', 3, 'res_furs'], ['fr_glacier', 'Geleira Branca', 28, 14, 'frostheim', 1, 'res_ice'],
  ['fr_fjord', 'Fiorde de Brenna', 108, 14, 'frostheim', 2, 'res_fish'], ['fr_pinhal', 'Pinhal Gélido', 38, 46, 'frostheim', 1, 'res_timber'], ['fr_vigia', 'Vigia do Norte', 98, 44, 'frostheim', 1, 'res_stone'],
  // Ruínas (neutras)
  ['ru_ruinas', 'Ruínas Antigas', 150, 42, null, 2, 'res_relics'], ['ru_colinas', 'Colinas do Eco', 126, 62, null, 1, 'res_stone'], ['ru_portal', 'Portão dos Sete', 176, 22, null, 1, 'res_relics'],
  // Drakmor (9)
  ['dk_capital', 'Drakmor', 240, 40, 'drakmor', 3, 'res_iron'], ['dk_forja', 'Forja Rubra', 276, 20, 'drakmor', 2, 'res_weapons'], ['dk_passo', 'Passo de Ferro', 208, 22, 'drakmor', 1, 'res_stone'],
  ['dk_minas', 'Minas Profundas', 266, 66, 'drakmor', 2, 'res_iron'], ['dk_cume', 'Cume do Dragão', 286, 44, 'drakmor', 1, 'res_stone'], ['dk_trilha', 'Trilha Escarpada', 214, 62, 'drakmor', 1, 'res_iron'],
  ['dk_garganta', 'Garganta Negra', 194, 44, 'drakmor', 1, 'res_stone'], ['dk_pico', 'Pico Sangrento', 252, 10, 'drakmor', 1, 'res_iron'], ['dk_bastiao', 'Bastião Rubro', 286, 78, 'drakmor', 2, 'res_weapons'],
  // Várden (8)
  ['va_capital', 'Várden', 150, 115, 'varden', 3, 'res_grain'], ['va_vau', 'Vau de Ferro', 204, 92, 'varden', 2, 'res_trade'], ['va_ponte', 'Ponte de Várden', 178, 132, 'varden', 2, 'res_trade'],
  ['va_campos', 'Campos Dourados', 124, 96, 'varden', 1, 'res_grain'], ['va_moinho', 'Moinho Velho', 128, 138, 'varden', 1, 'res_grain'], ['va_colina', 'Colina dos Guardiões', 170, 90, 'varden', 1, 'res_horses'],
  ['va_estrada', 'Estrada do Sol', 206, 122, 'varden', 2, 'res_trade'], ['va_bosque', 'Bosque da Fronteira', 106, 118, 'varden', 1, 'res_wood'],
  // Eldoria (6)
  ['el_capital', 'Eldoria', 55, 115, 'eldoria', 3, 'res_herbs'], ['el_lago', 'Lago Esmeralda', 82, 90, 'eldoria', 1, 'res_fish'], ['el_carvalho', 'Carvalho Ancestral', 28, 88, 'eldoria', 2, 'res_herbs'],
  ['el_trilha', 'Trilha dos Caçadores', 82, 142, 'eldoria', 1, 'res_game'], ['el_clareira', 'Clareira da Lua', 24, 140, 'eldoria', 1, 'res_herbs'], ['el_vale', 'Vale Musgoso', 60, 72, 'eldoria', 1, 'res_wood'],
  // Solária (7)
  ['so_capital', 'Solária', 262, 150, 'solaria', 3, 'res_gold'], ['so_porto', 'Porto Dourado', 272, 122, 'solaria', 2, 'res_trade'], ['so_farol', 'Farol do Cabo', 262, 100, 'solaria', 1, 'res_fish'],
  ['so_praias', 'Praias de Âmbar', 268, 186, 'solaria', 1, 'res_salt'], ['so_salinas', 'Salinas', 238, 202, 'solaria', 1, 'res_salt'], ['so_vinhedos', 'Vinhedos do Sol', 234, 164, 'solaria', 2, 'res_wine'],
  ['so_enseada', 'Enseada dos Contrabandistas', 278, 208, 'solaria', 1, 'res_smuggling'],
  // Cinzamar (3)
  ['ci_capital', 'Cinzamar', 160, 195, 'cinzamar', 3, 'res_coal'], ['ci_pocos', 'Poços de Carvão', 192, 204, 'cinzamar', 2, 'res_coal'], ['ci_campos', 'Campos de Cinza', 134, 180, 'cinzamar', 1, 'res_ashcrops'],
  // Ravencross (2)
  ['rv_capital', 'Ravencross', 50, 195, 'ravencross', 3, 'res_info'], ['rv_brejo', 'Brejo Sombrio', 86, 206, 'ravencross', 1, 'res_alchemy'],
  // neutros
  ['ne_pantano', 'Pântano Esquecido', 18, 176, null, 1, 'res_herbs'], ['ne_cinzas', 'Vale das Cinzas Sul', 118, 210, null, 1, 'res_obsidian'], ['ne_encruz', 'Encruzilhada', 104, 164, null, 1, 'res_trade'],
].map(([id, name, x, y, owner, imp, res]) => ({ id, name, x, y, owner, orig: owner, imp, res }));

// Vilas: posição, estilo, região, construções (tipo, dx, dy em tiles relativos ao centro)
export const VILLAGES = {
  varden: { x: 150, y: 115, style: 'varden', faction: 'varden', r: 17, wall: 'palisade', music: 'varden', buildings: [
    ['hall', 'hall', 0, -9], ['tavern', 'tavern', -9, 1], ['smithy', 'smithy', 9, 1], ['archive', 'archive', -11, -8], ['stable', 'stable', 12, -7],
    ['house1', 'house', -10, 8], ['house2', 'house', -3, 9], ['house3', 'house', 4, 9], ['shop', 'shop', 11, 9], ['kael_house', 'house', -14, -2], ['bakery', 'house', 6, -3]] },
  eldoria: { x: 55, y: 115, style: 'eldoria', faction: 'eldoria', r: 14, wall: null, music: 'eldoria', buildings: [
    ['hall', 'temple', 0, -8], ['tavern', 'tavern', -8, 2], ['shop', 'shop', 8, 2], ['house1', 'house', -7, 8], ['house2', 'house', 6, 8], ['house3', 'house', 9, -6]] },
  drakmor: { x: 240, y: 40, style: 'drakmor', faction: 'drakmor', r: 16, wall: 'stonewall', music: 'drakmor', buildings: [
    ['hall', 'hall', 0, -9], ['smithy', 'smithy', 9, 1], ['tavern', 'tavern', -9, 1], ['barracks', 'fort', -10, -8], ['vault', 'tower', 11, -8], ['house1', 'house', -6, 8], ['house2', 'house', 6, 8]] },
  solaria: { x: 262, y: 150, style: 'solaria', faction: 'solaria', r: 16, wall: null, music: 'solaria', buildings: [
    ['hall', 'hall', 0, -9], ['tavern', 'tavern', -9, 1], ['shop', 'shop', 9, 1], ['house1', 'house', -8, 8], ['house2', 'house', 1, 9], ['bank', 'archive', 10, -7]] },
  frostheim: { x: 70, y: 25, style: 'frostheim', faction: 'frostheim', r: 14, wall: 'palisade', music: 'frostheim', buildings: [
    ['hall', 'hall', 0, -8], ['tavern', 'tavern', -8, 2], ['temple', 'temple', 8, 2], ['house1', 'house', -6, 8], ['house2', 'house', 6, 8]] },
  cinzamar: { x: 160, y: 195, style: 'cinzamar', faction: 'cinzamar', r: 13, wall: 'stonewall', music: 'cinzamar', buildings: [
    ['hall', 'hall', 0, -8], ['smithy', 'smithy', 8, 1], ['tavern', 'tavern', -8, 1], ['maren_house', 'house', -6, 7], ['house2', 'house', 6, 7]] },
  ravencross: { x: 50, y: 195, style: 'ravencross', faction: 'ravencross', r: 13, wall: null, music: 'ravencross', buildings: [
    ['hall', 'hall', 0, -8], ['tavern', 'tavern', -8, 1], ['shop', 'shop', 8, 1], ['house1', 'house', -6, 7], ['house2', 'house', 6, 7]] },
};

// rios (polilinhas em tiles)
export const RIVERS = [
  { pts: [[228, 62], [214, 80], [196, 96], [184, 112], [178, 132], [160, 150], [132, 158], [110, 168], [84, 182], [60, 190], [30, 196]], w: 2 },
  { pts: [[112, 2], [118, 22], [112, 44], [100, 62], [86, 80], [82, 90]], w: 1.6 },
];
export const LAKES = [[82, 92, 7, 5], [190, 150, 4, 3], [30, 176, 6, 4], [150, 12, 5, 3]];

// lugares especiais (masmorras e locais de missão)
export const SITES = {
  ruins_main: { x: 150, y: 44, kind: 'ruins' },
  cave_whisper: { x: 196, y: 70, kind: 'cave' },
  cave_smugglers: { x: 280, y: 200, kind: 'cave' },
  mine_old: { x: 226, y: 78, kind: 'mine' },
  cave_bear: { x: 46, y: 8, kind: 'cave' },
  cave_ash: { x: 132, y: 206, kind: 'cave' },
  cave_eldoria: { x: 16, y: 120, kind: 'cave' },
  cave_swamp: { x: 14, y: 206, kind: 'cave' },
};
