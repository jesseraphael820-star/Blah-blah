// Localization. Languages: pt (Brazilian Portuguese), en, es.
import pt from '../lang/pt.js';
import en from '../lang/en.js';
import es from '../lang/es.js';

const LANGS = { pt, en, es };
export const LANG_LIST = [
  { id: 'pt', name: 'Português (BR)' },
  { id: 'en', name: 'English' },
  { id: 'es', name: 'Español' },
];
let current = 'en';
const listeners = new Set();

export function detectLang() {
  const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
  for (const l of list) {
    const c = (l || '').toLowerCase().slice(0, 2);
    if (LANGS[c]) return c;
  }
  return 'en';
}
export function setLang(id) {
  if (!LANGS[id]) id = 'en';
  current = id;
  document.documentElement.lang = id === 'pt' ? 'pt-BR' : id;
  listeners.forEach((f) => f(id));
}
export const getLang = () => current;
export const onLangChange = (f) => listeners.add(f);

function lookup(dict, key) {
  const parts = key.split('.');
  let o = dict;
  for (const p of parts) {
    if (o == null) return undefined;
    o = o[p];
  }
  return o;
}

// t('ui.gold') / t('q.main1.title') / t('ui.levelUp', {n: 3})
export function t(key, params) {
  let v = lookup(LANGS[current], key);
  if (v === undefined) v = lookup(LANGS.en, key);
  if (v === undefined) return key;
  if (typeof v === 'string' && params) {
    v = v.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? params[k] : `{${k}}`));
  }
  return v;
}
// raw lookup returning arrays/objects (dialogue lines etc.)
export function tr(key) {
  let v = lookup(LANGS[current], key);
  if (v === undefined) v = lookup(LANGS.en, key);
  return v;
}
export const hasKey = (key) => lookup(LANGS[current], key) !== undefined || lookup(LANGS.en, key) !== undefined;
