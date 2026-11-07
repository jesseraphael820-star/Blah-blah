// Histórico local (localStorage). Nada é enviado a servidores.
import { storageGet, storageSet } from './utils.js';

const KEY = 'phonecheck.history';
const MAX = 25;

export const history = {
  all() { return storageGet(KEY, []); },
  get(id) { return this.all().find((r) => r.id === id); },
  add(report) {
    const list = this.all().filter((r) => r.id !== report.id);
    list.unshift(report);
    return storageSet(KEY, list.slice(0, MAX));
  },
  remove(id) { storageSet(KEY, this.all().filter((r) => r.id !== id)); },
  clear() { storageSet(KEY, []); },
};
