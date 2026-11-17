// Salvamento automático em localStorage (progresso + configurações).

const SAVE_KEY = 'portobrasa_save_v1';
const SET_KEY = 'portobrasa_settings_v1';

export const DEFAULT_SETTINGS = {
  volume: 0.7,
  quality: 'auto', // auto | low | high
  touch: 'auto', // auto | on | off
  controlsSize: 1,
  controlsOpacity: 0.75,
  zoom: 1,
  vibration: true,
  showFps: false,
  traffic: 1,
};

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key, val) {
  try {
    localStorage.setItem(key, val);
    return true;
  } catch {
    return false;
  }
}

export function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(safeGet(SET_KEY)) || {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
export function saveSettings(s) {
  safeSet(SET_KEY, JSON.stringify(s));
}

export function loadGame() {
  try {
    const d = JSON.parse(safeGet(SAVE_KEY));
    return d && d.version === 1 ? d : null;
  } catch {
    return null;
  }
}
export function saveGame(data) {
  return safeSet(SAVE_KEY, JSON.stringify({ ...data, version: 1, savedAt: Date.now() }));
}
export function deleteSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignora */
  }
}
