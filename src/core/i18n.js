// Internacionalização: 14 idiomas, troca em tempo real, fallback en → pt.
export const LANGS = [
  { code: 'pt', name: 'Português (Brasil)' }, { code: 'en', name: 'English' }, { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' }, { code: 'de', name: 'Deutsch' }, { code: 'it', name: 'Italiano' },
  { code: 'ja', name: '日本語' }, { code: 'ko', name: '한국어' }, { code: 'zh', name: '简体中文' },
  { code: 'ru', name: 'Русский' }, { code: 'pl', name: 'Polski' }, { code: 'tr', name: 'Türkçe' },
  { code: 'ar', name: 'العربية', rtl: true }, { code: 'hi', name: 'हिन्दी' },
];
const tables = {};       // ui/itens/nomes: tables[lang][key]
const dialogues = {};    // dialogues[lang][dlgId] = array de linhas (texto)
let current = 'pt';
const listeners = new Set();

export function registerStrings(lang, obj) { tables[lang] = Object.assign(tables[lang] || {}, obj); }
export function registerDialogue(lang, obj) { dialogues[lang] = Object.assign(dialogues[lang] || {}, obj); }
export function getLang() { return current; }
export function isRTL() { return !!LANGS.find((l) => l.code === current && l.rtl); }
export function setLang(code) {
  if (!LANGS.find((l) => l.code === code)) return;
  current = code;
  if (typeof document !== 'undefined') { document.documentElement.lang = code; document.documentElement.dir = isRTL() ? 'rtl' : 'ltr'; }
  listeners.forEach((f) => f(code));
}
export function onLangChange(f) { listeners.add(f); }

export function has(key) { return !!((tables[current] && tables[current][key]) || (tables.en && tables.en[key]) || (tables.pt && tables.pt[key])); }
export function t(key, params) {
  let s = (tables[current] && tables[current][key]) ?? (tables.en && tables.en[key]) ?? (tables.pt && tables.pt[key]);
  if (s == null) return key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? (has(String(params[k])) ? t(String(params[k])) : params[k]) : m));
  return s;
}
// Texto de diálogo: idioma atual → inglês → português
export function dlgText(id, idx) {
  for (const l of [current, 'en', 'pt']) { const d = dialogues[l] && dialogues[l][id]; if (d && d[idx] != null) return d[idx]; }
  return null;
}
export function dlgAvailable(lang) { return !!dialogues[lang] && Object.keys(dialogues[lang]).length > 0; }
// Texto localizado em objeto {pt, en, ...}
export function loc(o) { if (!o) return ''; if (typeof o === 'string') return t(o); return o[current] ?? o.en ?? o.pt ?? ''; }
