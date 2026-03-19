const STORAGE_KEY = "obsidian_watch_progress";

export interface WatchProgress {
  /** e.g. "s123" for series or "s123-S01E03" for episode */
  itemId: string;
  /** seconds watched */
  currentTime: number;
  /** total duration in seconds */
  duration: number;
  /** ISO timestamp */
  updatedAt: string;
  /** Optional episode label for display */
  label?: string;
}

function getAll(): Record<string, WatchProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, WatchProgress>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getProgress(itemId: string): WatchProgress | null {
  return getAll()[itemId] ?? null;
}

export function setProgress(itemId: string, currentTime: number, duration: number, label?: string) {
  const all = getAll();
  all[itemId] = {
    itemId,
    currentTime,
    duration,
    updatedAt: new Date().toISOString(),
    label,
  };
  saveAll(all);
}

export function getSeriesProgress(seriesId: string): WatchProgress | null {
  const all = getAll();
  // Find the latest episode progress for a given series
  const entries = Object.values(all).filter((p) => p.itemId.startsWith(`${seriesId}-`));
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export function getProgressPercent(itemId: string): number {
  const p = getProgress(itemId);
  if (!p || !p.duration) return 0;
  return Math.min(100, (p.currentTime / p.duration) * 100);
}
