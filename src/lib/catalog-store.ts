import type { Channel, VodItem } from "./mock-data";

// ---------- IndexedDB helpers ----------
const DB_NAME = "obsidian_db";
const DB_VERSION = 1;
const STORE_NAME = "catalog";
const CATALOG_KEY = "main";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export interface CatalogData {
  live: Channel[];
  movies: VodItem[];
  series: VodItem[];
}

const CATALOG_STORAGE_KEY = "obsidian_catalog";
const LEGACY_CHANNELS_KEY = "obsidian_channels";

const emptyCatalog: CatalogData = {
  live: [],
  movies: [],
  series: [],
};

// In-memory cache so synchronous reads still work after first async load
let memoryCache: CatalogData | null = null;

/** Synchronous read – returns cached data (empty until loadCatalogFromIDB resolves) */
export function getStoredCatalog(): CatalogData {
  if (memoryCache) return memoryCache;

  // Legacy fallback: try localStorage (old small catalogs)
  try {
    const rawCatalog = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (rawCatalog) {
      const parsed = JSON.parse(rawCatalog) as Partial<CatalogData>;
      memoryCache = {
        live: Array.isArray(parsed.live) ? parsed.live : [],
        movies: Array.isArray(parsed.movies) ? parsed.movies : [],
        series: Array.isArray(parsed.series) ? parsed.series : [],
      };
      return memoryCache;
    }
  } catch {
    // ignore
  }

  return emptyCatalog;
}

/** Async load from IndexedDB – call once on app boot */
export async function loadCatalogFromIDB(): Promise<CatalogData> {
  try {
    const stored = await idbGet<CatalogData>(CATALOG_KEY);
    if (stored) {
      memoryCache = {
        live: Array.isArray(stored.live) ? stored.live : [],
        movies: Array.isArray(stored.movies) ? stored.movies : [],
        series: Array.isArray(stored.series) ? stored.series : [],
      };
      // Clean up old localStorage data
      try {
        localStorage.removeItem(CATALOG_STORAGE_KEY);
        localStorage.removeItem(LEGACY_CHANNELS_KEY);
      } catch { /* ignore */ }
      return memoryCache;
    }
  } catch {
    // IndexedDB unavailable, fall back to sync
  }
  return getStoredCatalog();
}

/** Persist catalog to IndexedDB (no localStorage quota issues) */
export async function setStoredCatalog(catalog: CatalogData) {
  memoryCache = catalog;
  try {
    await idbSet(CATALOG_KEY, catalog);
    // Remove legacy localStorage to free space
    try {
      localStorage.removeItem(CATALOG_STORAGE_KEY);
      localStorage.removeItem(LEGACY_CHANNELS_KEY);
    } catch { /* ignore */ }
  } catch (err) {
    console.error("Failed to persist catalog to IndexedDB", err);
  }
}

export async function clearStoredCatalog() {
  memoryCache = null;
  try {
    await idbDelete(CATALOG_KEY);
  } catch { /* ignore */ }
  try {
    localStorage.removeItem(CATALOG_STORAGE_KEY);
    localStorage.removeItem(LEGACY_CHANNELS_KEY);
  } catch { /* ignore */ }
}

export function getStoredCatalogCounts() {
  const catalog = getStoredCatalog();
  return {
    live: catalog.live.length,
    movies: catalog.movies.length,
    series: catalog.series.length,
  };
}
