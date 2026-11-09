// Persistence: save data lives in localStorage. The whole game state is one
// plain JSON object so every system reads/writes the same source of truth.
const SAVE_KEY = 'wildlands_save_v1';
const SETTINGS_KEY = 'wildlands_settings_v1';

export const SPAWN = { x: 30, z: 52 };

export function defaultAppearance() {
  return {
    name: 'Hero', hairStyle: 'short', hairColor: 0x5a3a22, skinTone: 0xf1c27d,
    eyeColor: 0x2b4a7a, shirt: 0x3f7fbf, pants: 0x4a3b2a, shoes: 0x2a1f16,
  };
}

export function newState(appearance) {
  return {
    version: 1,
    created: Date.now(),
    playTime: 0,
    player: {
      x: SPAWN.x, y: 6, z: SPAWN.z, yaw: Math.PI,
      hp: 100, energy: 60, stamina: 100,
      level: 1, xp: 0, gold: 25, attrPoints: 0,
      attrs: { str: 0, vit: 0, spi: 0, agi: 0 },
      title: 'novice', respawn: { x: SPAWN.x, z: SPAWN.z },
    },
    appearance: { ...defaultAppearance(), ...(appearance || {}) },
    inv: {
      items: { potion_small: 2, bread: 2 },
      owned: {
        swords: ['wood_sword'], armors: ['cloth'], hats: ['none'], accessories: ['none'], skins: ['custom'], powers: [], pets: [],
      },
      equipped: { sword: 'wood_sword', armor: 'cloth', hat: 'none', accessory: 'none', skin: 'custom', pet: null },
      powerSlots: [null, null, null, null],
      powerLevels: {},
    },
    quests: { active: {}, done: [], tracked: null, seen: [] },
    world: {
      time: 8.5, day: 1, chests: [], waystones: ['plaza'], discovered: [], flags: {},
      harvested: {}, explored: '', weather: 'clear',
    },
    rep: { aurora: 0, camp: 0 },
    ach: { unlocked: [], titles: ['novice'], stats: { kills: 0, slimes: 0, wolves: 0, bosses: [], chests: 0, goldEarned: 0, powersUsed: 0, distance: 0, deaths: 0, events: 0 } },
    daily: { lastClaim: null, streak: 0, challengesDay: null, challenges: [] },
  };
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}
export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    // merge with defaults so new fields added in updates exist in old saves
    return deepMerge(newState(s.appearance), s);
  } catch (e) {
    console.warn('save load failed', e);
    return null;
  }
}
export function writeState(state) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; } catch (e) { console.warn('save failed', e); return false; }
}
export function deleteSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }

export function defaultSettings() {
  return {
    lang: null, master: 0.8, music: 0.5, sfx: 0.8,
    quality: null, pixel: null, shadows: true, sensitivity: 1, invertY: false,
    showFps: false, shake: true, viewDist: null,
  };
}
export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return { ...defaultSettings(), ...(raw ? JSON.parse(raw) : {}) };
  } catch { return defaultSettings(); }
}
export function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ } }

function deepMerge(base, over) {
  if (Array.isArray(over)) return over;
  if (over && typeof over === 'object') {
    const out = { ...base };
    for (const k of Object.keys(over)) {
      out[k] = base && typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k]) ? deepMerge(base[k], over[k]) : over[k];
    }
    return out;
  }
  return over;
}
