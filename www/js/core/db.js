// Thin promise wrapper around IndexedDB. Everything the virtual PCs own
// (profiles, files, VM snapshots, settings) is persisted here on the device.

const DB_NAME = "virtual-pc";
const DB_VERSION = 1;
let dbp;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("pcs")) db.createObjectStore("pcs", { keyPath: "id" });
      if (!db.objectStoreNames.contains("files")) {
        const s = db.createObjectStore("files", { keyPath: "id" });
        s.createIndex("pc", "pc");
        s.createIndex("parent", ["pc", "parent"]);
      }
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("snapshots")) db.createObjectStore("snapshots");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then((v) => { out = v; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error("Transação abortada (armazenamento cheio?)"));
  });
}

export const db = {
  get: (store, key) => tx(store, "readonly", (s) => wrap(s.get(key))),
  put: (store, value, key) => tx(store, "readwrite", (s) => wrap(key === undefined ? s.put(value) : s.put(value, key))),
  del: (store, key) => tx(store, "readwrite", (s) => wrap(s.delete(key))),
  all: (store) => tx(store, "readonly", (s) => wrap(s.getAll())),
  byIndex: (store, index, value) => tx(store, "readonly", (s) => wrap(s.index(index).getAll(value))),
  keysByIndex: (store, index, value) => tx(store, "readonly", (s) => wrap(s.index(index).getAllKeys(value))),
  async delMany(store, keys) {
    if (!keys.length) return;
    return tx(store, "readwrite", (s) => Promise.all(keys.map((k) => wrap(s.delete(k)))));
  },
};

export const kv = {
  get: (k, d = null) => db.get("kv", k).then((v) => (v === undefined ? d : v)),
  set: (k, v) => db.put("kv", v, k),
};
