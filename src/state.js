// Estado global do jogo (único ponto de verdade compartilhado entre os sistemas).
import { Particles, Weather, Lighting } from './gfx/fx.js';

export const DEFAULT_SETTINGS = {
  lang: 'pt', master: 0.8, music: 0.6, sfx: 0.8, resolution: 1, quality: 2, fullscreen: false,
  textSpeed: 1, fxIntensity: 1, showDamage: true, screenShake: true, autosave: true, binds: null, touch: 'auto',
};

export const G = {
  mode: 'title', // title | play | dialogue | menu | shop | cutscene | credits | dead
  settings: { ...DEFAULT_SETTINGS },
  view: { w: 400, h: 225 },
  t: 0, dt: 0,
  maps: {}, map: null, world: null,
  player: null, entities: [],
  cam: { x: 0, y: 0, shake: 0, target: null, lock: null },
  particles: new Particles(), weather: new Weather(), lighting: new Lighting(),
  // progresso
  name: 'Aren', flags: {}, phase: 'peace', chapter: 1,
  quests: {}, // id -> { state: 'active'|'done', stage, counters, startedAt }
  tracked: null,
  territory: {}, relations: {}, rep: {}, treasury: {},
  day: 1, hour: 7.5, weatherState: { rain: 0, snow: 0, ash: 0, fog: 0, storm: 0, wind: 0 }, weatherTarget: {}, weatherTimer: 0,
  discovered: {}, opened: {}, gathered: {}, npcOverride: {}, metNpcs: {},
  horses: [], activeHorse: null,
  achievements: {}, stats: { kills: 0, chests: 0, captures: 0, parries: 0, fish: 0, animals: 0, gathered: 0, steps: 0, deaths: 0 },
  notifications: [], ending: null, playTime: 0, slot: null,
  debug: false,
};

export function hostile(a, b) {
  if (!a || !b || a === b) return false;
  const ta = a.team, tb = b.team;
  if (ta === tb) return false;
  if (a.provokedBy === b || b.provokedBy === a) return true;
  const P = (t) => t === 'P', E = (t) => t === 'E' || t === 'W';
  if (P(ta) && E(tb)) return true;
  if (E(ta) && P(tb)) return true;
  return false;
}
