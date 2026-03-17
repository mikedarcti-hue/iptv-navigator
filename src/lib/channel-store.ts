import type { Channel } from "./mock-data";

const STORAGE_KEY = "obsidian_channels";

export function getStoredChannels(): Channel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setStoredChannels(channels: Channel[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
}

export function clearStoredChannels() {
  localStorage.removeItem(STORAGE_KEY);
}
