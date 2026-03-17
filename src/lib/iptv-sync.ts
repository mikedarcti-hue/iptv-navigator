import { supabase } from "@/integrations/supabase/client";
import type { CatalogData } from "@/lib/catalog-store";

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
    const { data, error } = await supabase.functions.invoke("iptv-proxy", {
      body: { action: "fetch_m3u_catalog", url: config.m3uUrl.trim() },
    });

    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || "Falha ao carregar catálogo");

    return {
      live: Array.isArray(data.live) ? data.live : [],
      movies: Array.isArray(data.movies) ? data.movies : [],
      series: Array.isArray(data.series) ? data.series : [],
    };
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
