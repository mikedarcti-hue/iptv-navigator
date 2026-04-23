import { supabase } from "@/integrations/supabase/client";
import type { ServerConfig } from "@/lib/iptv-sync";

export interface AccountInfo {
  username: string;
  status: string;
  expDate: string;
  maxConnections: string;
  createdAt: string;
  isTrial: boolean;
}

const CACHE_KEY = "dark_iptv_account_info";

export function getCachedAccountInfo(): AccountInfo | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  return null;
}

export function getServerConfig(): ServerConfig | null {
  try {
    const saved = localStorage.getItem("obsidian_server_config");
    if (!saved) return null;
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

function buildFromUserInfo(u: any, fallbackUser: string): AccountInfo {
  return {
    username: u?.username || fallbackUser,
    status: u?.status || "Ativo",
    expDate: u?.exp_date
      ? new Date(parseInt(u.exp_date) * 1000).toLocaleDateString("pt-BR")
      : "Ilimitado",
    maxConnections: u?.max_connections || "N/A",
    createdAt: u?.created_at
      ? new Date(parseInt(u.created_at) * 1000).toLocaleDateString("pt-BR")
      : "N/A",
    isTrial: u?.is_trial === "1",
  };
}

export async function fetchAccountInfo(force = false): Promise<AccountInfo | null> {
  const config = getServerConfig();
  if (!config) return null;

  if (!force) {
    const cached = getCachedAccountInfo();
    if (cached) return cached;
  }

  if (config.type === "xtream" && config.xtreamUser) {
    try {
      const { data } = await supabase.functions.invoke("iptv-proxy", {
        body: {
          action: "test",
          type: "xtream",
          server: config.xtreamUrl.trim(),
          username: config.xtreamUser.trim(),
          password: config.xtreamPass.trim(),
        },
      });
      if (data?.success && data?.user_info) {
        const info = buildFromUserInfo(data.user_info, config.xtreamUser);
        localStorage.setItem(CACHE_KEY, JSON.stringify(info));
        return info;
      }
    } catch {}
    const fallback: AccountInfo = {
      username: config.xtreamUser,
      status: "Ativo",
      expDate: "N/A",
      maxConnections: "N/A",
      createdAt: "N/A",
      isTrial: false,
    };
    return fallback;
  }

  if (config.type === "m3u") {
    const info: AccountInfo = {
      username: "Lista M3U",
      status: "Ativo",
      expDate: "N/A",
      maxConnections: "N/A",
      createdAt: "N/A",
      isTrial: false,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(info));
    return info;
  }

  return null;
}
