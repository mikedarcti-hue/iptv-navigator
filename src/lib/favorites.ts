const STORAGE_KEY = "dark_iptv_favorites";

export interface FavoriteItem {
  id: string;
  type: "channel" | "movie" | "series";
  addedAt: string;
}

function getAll(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(items: FavoriteItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function isFavorite(id: string): boolean {
  return getAll().some((f) => f.id === id);
}

export function toggleFavorite(id: string, type: "channel" | "movie" | "series"): boolean {
  const all = getAll();
  const idx = all.findIndex((f) => f.id === id);
  if (idx >= 0) {
    all.splice(idx, 1);
    saveAll(all);
    return false; // removed
  }
  all.unshift({ id, type, addedAt: new Date().toISOString() });
  saveAll(all);
  return true; // added
}

export function getFavorites(): FavoriteItem[] {
  return getAll();
}

export function getFavoriteIds(): Set<string> {
  return new Set(getAll().map((f) => f.id));
}
