// Centralized app preferences with reactive listeners
// Stored in localStorage. Components subscribe via usePreferences()

export type StreamFormat = "default" | "ts" | "m3u8";

export interface EpgSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

export interface AppPreferences {
  // EPG
  epgEnabled: boolean;
  epgAutoUpdate: boolean;
  epgSources: EpgSource[];
  epgLastUpdate: number | null;
  showEpgInChannelList: boolean;

  // Streaming
  streamFormat: StreamFormat;

  // Parental
  parentalEnabled: boolean;
  parentalPin: string; // 4-digit pin (stored locally)
  parentalUnlocked: boolean; // session flag (not persisted intent)

  // General
  autoStartOnBoot: boolean;
  showFullGuide: boolean;
  subtitlesEnabled: boolean;
  autoPlayNextEnabled: boolean;
  autoPlayNextDelay: 10 | 20 | 30 | 40;
  pictureInPictureEnabled: boolean;
  autoClearCache: boolean;
}

const PREFS_KEY = "dark_iptv_preferences_v1";

export const defaultPreferences: AppPreferences = {
  epgEnabled: true,
  epgAutoUpdate: true,
  epgSources: [],
  epgLastUpdate: null,
  showEpgInChannelList: true,

  streamFormat: "default",

  parentalEnabled: false,
  parentalPin: "",
  parentalUnlocked: false,

  autoStartOnBoot: false,
  showFullGuide: true,
  subtitlesEnabled: false,
  autoPlayNextEnabled: true,
  autoPlayNextDelay: 10,
  pictureInPictureEnabled: true,
  autoClearCache: false,
};

let cache: AppPreferences | null = null;
const listeners = new Set<(p: AppPreferences) => void>();

export function getPreferences(): AppPreferences {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cache = { ...defaultPreferences, ...parsed, parentalUnlocked: false };
      return cache;
    }
  } catch {}
  cache = { ...defaultPreferences };
  return cache;
}

export function updatePreferences(patch: Partial<AppPreferences>) {
  const next = { ...getPreferences(), ...patch };
  cache = next;
  try {
    const { parentalUnlocked, ...persist } = next;
    localStorage.setItem(PREFS_KEY, JSON.stringify(persist));
  } catch {}
  listeners.forEach((cb) => cb(next));
}

export function subscribePreferences(cb: (p: AppPreferences) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// EPG sources
export function addEpgSource(name: string, url: string) {
  const sources = [...getPreferences().epgSources, { id: crypto.randomUUID(), name, url, enabled: true }];
  updatePreferences({ epgSources: sources });
}

export function removeEpgSource(id: string) {
  updatePreferences({ epgSources: getPreferences().epgSources.filter((s) => s.id !== id) });
}

export function toggleEpgSource(id: string) {
  updatePreferences({
    epgSources: getPreferences().epgSources.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
  });
}

// Adult content detection
const ADULT_KEYWORDS = [
  "xxx", "adult", "adulto", "porn", "porno", "sexy", "sex ", "+18", "18+",
  "erotic", "erotico", "hentai", "playboy", "brazzers",
];

export function isAdultContent(title?: string, group?: string): boolean {
  const text = `${title || ""} ${group || ""}`.toLowerCase();
  return ADULT_KEYWORDS.some((k) => text.includes(k));
}

export function isContentLocked(title?: string, group?: string): boolean {
  const prefs = getPreferences();
  if (!prefs.parentalEnabled) return false;
  if (prefs.parentalUnlocked) return false;
  return isAdultContent(title, group);
}

// Cache clearing
export async function clearAppCache(): Promise<void> {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {}
  // Clear catalog & temp keys but preserve config & prefs
  const preserve = new Set([
    "obsidian_server_config",
    PREFS_KEY,
    "dark_iptv_account_info",
    "obsidian_buffer",
    "obsidian_decoder",
    "obsidian_device_mode",
    "obsidian_favorites",
  ]);
  Object.keys(localStorage).forEach((key) => {
    if (!preserve.has(key) && (key.startsWith("obsidian_catalog") || key.startsWith("obsidian_watch_") || key.includes("cache"))) {
      localStorage.removeItem(key);
    }
  });
}

// Stream URL transformation based on format preference
export function applyStreamFormat(url: string, format?: StreamFormat): string {
  const fmt = format ?? getPreferences().streamFormat;
  if (fmt === "default" || !url) return url;

  // Xtream-style URLs: /live/USER/PASS/ID.ext
  const xtreamMatch = url.match(/^(.*\/(?:live|movie|series)\/[^/]+\/[^/]+\/\d+)(\.\w+)?(\?.*)?$/i);
  if (xtreamMatch) {
    const [, base, , query] = xtreamMatch;
    const ext = fmt === "ts" ? ".ts" : ".m3u8";
    return `${base}${ext}${query || ""}`;
  }

  // Generic: replace trailing extension if it's ts/m3u8/mpegts
  if (/\.(ts|m3u8|mpegts)(\?|$)/i.test(url)) {
    return url.replace(/\.(ts|m3u8|mpegts)(\?|$)/i, `.${fmt === "ts" ? "ts" : "m3u8"}$2`);
  }

  return url;
}
