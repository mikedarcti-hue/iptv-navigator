import type { Channel, VodItem } from "./mock-data";

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

export function getStoredCatalog(): CatalogData {
  try {
    const rawCatalog = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (rawCatalog) {
      const parsed = JSON.parse(rawCatalog) as Partial<CatalogData>;
      return {
        live: Array.isArray(parsed.live) ? parsed.live : [],
        movies: Array.isArray(parsed.movies) ? parsed.movies : [],
        series: Array.isArray(parsed.series) ? parsed.series : [],
      };
    }

    const legacyChannels = localStorage.getItem(LEGACY_CHANNELS_KEY);
    if (!legacyChannels) return emptyCatalog;

    return {
      ...emptyCatalog,
      live: JSON.parse(legacyChannels),
    };
  } catch {
    return emptyCatalog;
  }
}

export function setStoredCatalog(catalog: CatalogData) {
  localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
  localStorage.setItem(LEGACY_CHANNELS_KEY, JSON.stringify(catalog.live));
}

export function clearStoredCatalog() {
  localStorage.removeItem(CATALOG_STORAGE_KEY);
  localStorage.removeItem(LEGACY_CHANNELS_KEY);
}

export function getStoredCatalogCounts() {
  const catalog = getStoredCatalog();
  return {
    live: catalog.live.length,
    movies: catalog.movies.length,
    series: catalog.series.length,
  };
}
