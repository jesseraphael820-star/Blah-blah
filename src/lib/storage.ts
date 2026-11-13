"use client";

import type { HistoryItem, PhotoRecord, Settings } from "./types";

/**
 * Armazenamento 100% local (IndexedDB do navegador). Nenhuma foto é enviada
 * para um servidor nosso; o usuário pode apagar tudo a qualquer momento.
 */
const DB_NAME = "looksmaxxing-ai";
const DB_VERSION = 1;

type StoreName = "photo" | "history" | "meta";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB indisponível"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("photo")) db.createObjectStore("photo", { keyPath: "id" });
        if (!db.objectStoreNames.contains("history")) {
          const s = db.createObjectStore("history", { keyPath: "id" });
          s.createIndex("createdAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

async function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? (req.result as T) : (undefined as T));
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const storage = {
  async getPhoto(): Promise<PhotoRecord | null> {
    const all = await tx<PhotoRecord[]>("photo", "readonly", (s) => s.getAll());
    return all.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  },
  async savePhoto(photo: PhotoRecord) {
    await tx("photo", "readwrite", (s) => {
      s.clear();
      s.put(photo);
    });
  },
  async deletePhoto() {
    await tx("photo", "readwrite", (s) => s.clear());
  },
  async getHistory(): Promise<HistoryItem[]> {
    const all = await tx<HistoryItem[]>("history", "readonly", (s) => s.getAll());
    return all.sort((a, b) => b.createdAt - a.createdAt);
  },
  async putHistory(item: HistoryItem) {
    await tx("history", "readwrite", (s) => s.put(item));
  },
  async deleteHistory(id: string) {
    await tx("history", "readwrite", (s) => s.delete(id));
  },
  async clearHistory() {
    await tx("history", "readwrite", (s) => s.clear());
  },
  async getMeta<T>(key: string): Promise<T | undefined> {
    return tx<T>("meta", "readonly", (s) => s.get(key));
  },
  async setMeta(key: string, value: unknown) {
    await tx("meta", "readwrite", (s) => s.put(value, key));
  },
  async wipeAll() {
    await Promise.all([
      tx("photo", "readwrite", (s) => s.clear()),
      tx("history", "readwrite", (s) => s.clear()),
      tx("meta", "readwrite", (s) => s.clear()),
    ]);
    try {
      localStorage.removeItem(SETTINGS_KEY);
    } catch {}
  },
};

const SETTINGS_KEY = "lmx-settings";

export const DEFAULT_SETTINGS: Settings = {
  applyOn: "current",
  saveHistory: true,
  aiConsent: false,
  defaultIntensity: "moderado",
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
}

export function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}
