const STORAGE_KEY = "dark_iptv_device_mode";

export type DeviceMode = "mobile" | "tv";

export function getDeviceMode(): DeviceMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "mobile" || v === "tv") return v;
    return null;
  } catch {
    return null;
  }
}

export function setDeviceMode(mode: DeviceMode) {
  localStorage.setItem(STORAGE_KEY, mode);
}
