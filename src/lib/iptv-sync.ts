import { supabase } from "@/integrations/supabase/client";
import type { CatalogData } from "@/lib/catalog-store";
import { parseM3UCatalogStream } from "@/lib/m3u-parser";

export type ConnectionType = "m3u" | "xtream";

export interface ServerConfig {
  type: ConnectionType;
  m3uUrl: string;
  xtreamUrl: string;
  xtreamUser: string;
  xtreamPass: string;
}

export const defaultServerConfig: ServerConfig = {
  type: "xtream",
  m3uUrl: "",
  xtreamUrl: "",
  xtreamUser: "",
  xtreamPass: "",
};

export async function testIptvConnection(config: ServerConfig) {
  const body = config.type === "m3u"
    ? { action: "test", type: "m3u", url: config.m3uUrl.trim() }
    : {
        action: "test",
        type: "xtream",
        server: config.xtreamUrl.trim(),
        username: config.xtreamUser.trim(),
        password: config.xtreamPass.trim(),
      };

  const { data, error } = await supabase.functions.invoke("iptv-proxy", { body });

  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || "Falha na conexão");

  return data;
}

export async function syncCatalogFromConfig(config: ServerConfig): Promise<CatalogData> {
  if (config.type === "m3u") {
    return fetchM3UCatalogFromProxy(config.m3uUrl.trim());
  }

  const baseBody = {
    server: config.xtreamUrl.trim(),
    username: config.xtreamUser.trim(),
    password: config.xtreamPass.trim(),
  };

  const [liveResponse, moviesResponse, seriesResponse] = await Promise.all([
    supabase.functions.invoke("iptv-proxy", {
      body: { action: "fetch_xtream_live", ...baseBody },
    }),
    supabase.functions.invoke("iptv-proxy", {
      body: { action: "fetch_xtream_movies", ...baseBody },
    }),
    supabase.functions.invoke("iptv-proxy", {
      body: { action: "fetch_xtream_series", ...baseBody },
    }),
  ]);

  const responses = [liveResponse, moviesResponse, seriesResponse];
  const firstError = responses.find((response) => response.error || !response.data?.success);

  if (firstError?.error) throw new Error(firstError.error.message);
  if (firstError && !firstError.data?.success) throw new Error(firstError.data?.error || "Falha ao carregar catálogo");

  return {
    live: Array.isArray(liveResponse.data?.live) ? liveResponse.data.live : [],
    movies: Array.isArray(moviesResponse.data?.movies) ? moviesResponse.data.movies : [],
    series: Array.isArray(seriesResponse.data?.series) ? seriesResponse.data.series : [],
  };
}

async function fetchM3UCatalogFromProxy(url: string): Promise<CatalogData> {
  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/iptv-proxy`;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ action: "fetch_m3u_source", url }),
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;

    try {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const errorData = await response.json();
        message = errorData?.error || message;
      } else {
        const errorText = await response.text();
        if (errorText) message = errorText;
      }
    } catch {
      // ignore parsing fallback
    }

    throw new Error(message || "Falha ao carregar playlist M3U");
  }

  if (!response.body) {
    throw new Error("A playlist retornou vazia");
  }

  return parseM3UCatalogStream(response.body);
}
