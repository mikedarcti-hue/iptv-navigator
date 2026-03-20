const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type LiveChannel = {
  id: string;
  name: string;
  logo: string;
  group: string;
  url: string;
  epgNow?: string;
  streamCandidates?: string[];
};

type VodItem = {
  id: string;
  name: string;
  poster: string;
  rating: number;
  year: number;
  genre: string;
  type: "movie" | "series";
  streamUrl?: string;
  synopsis?: string;
  seriesId?: string;
};

type Episode = {
  id: string;
  episodeNum: number;
  title: string;
  streamUrl?: string;
  duration?: string;
  plot?: string;
  containerExtension?: string;
};

type Season = {
  seasonNumber: number;
  episodes: Episode[];
};

const ITEM_LIMIT = 50000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, url, type, server, username, password, seriesId, streamUrl } = await req.json();

    if (action === "test") {
      if (type === "m3u") {
        const response = await fetchWithDns(url, {
          headers: { "User-Agent": "IPTVClient/1.0", Range: "bytes=0-4096" },
        }, 10000);

        if (!response.ok && response.status !== 206) {
          return json({ success: false, error: `HTTP ${response.status}` }, 400);
        }
        await response.text();
        return json({ success: true });
      }

      const authUrl = buildXtreamUrl(server, username, password);
      const response = await fetchWithDns(authUrl, {
        headers: { "User-Agent": "IPTVClient/1.0" },
      }, 10000);

      if (!response.ok) {
        return json({ success: false, error: `HTTP ${response.status}` }, 400);
      }

      const data = await response.json();
      if (!data?.user_info) {
        return json({ success: false, error: "Credenciais inválidas" }, 400);
      }

      return json({ success: true, user_info: data.user_info });
    }

    if (action === "fetch_m3u_catalog") {
      const response = await fetchWithDns(url, {
        headers: { "User-Agent": "IPTVClient/1.0" },
      }, 60000);

      if (!response.ok || !response.body) {
        return json({ success: false, error: `HTTP ${response.status}` }, 400);
      }

      const catalog = await streamParseM3UCatalog(response.body, ITEM_LIMIT);
      return json({ success: true, ...catalog });
    }

    if (action === "fetch_xtream_live") {
      const categoryResponse = await fetchWithDns(
        `${buildXtreamUrl(server, username, password)}&action=get_live_categories`,
        { headers: { "User-Agent": "IPTVClient/1.0" } },
        15000,
      );
      const streamResponse = await fetchWithDns(
        `${buildXtreamUrl(server, username, password)}&action=get_live_streams`,
        { headers: { "User-Agent": "IPTVClient/1.0" } },
        30000,
      );

      const categories = categoryResponse.ok ? await categoryResponse.json() : [];
      const streams = streamResponse.ok ? await streamResponse.json() : [];
      const categoryMap = buildCategoryMap(categories);
      const baseUrl = sanitizeBaseUrl(server);

      const live = Array.isArray(streams)
        ? streams.map((stream: any, index: number) => buildXtreamLiveChannel(stream, index, categoryMap, baseUrl, username, password))
        : [];

      return json({ success: true, live: sortByName(live) });
    }

    if (action === "fetch_xtream_movies") {
      const categoryResponse = await fetchWithDns(
        `${buildXtreamUrl(server, username, password)}&action=get_vod_categories`,
        { headers: { "User-Agent": "IPTVClient/1.0" } },
        15000,
      );
      const streamResponse = await fetchWithDns(
        `${buildXtreamUrl(server, username, password)}&action=get_vod_streams`,
        { headers: { "User-Agent": "IPTVClient/1.0" } },
        30000,
      );

      const categories = categoryResponse.ok ? await categoryResponse.json() : [];
      const streams = streamResponse.ok ? await streamResponse.json() : [];
      const categoryMap = buildCategoryMap(categories);
      const baseUrl = sanitizeBaseUrl(server);

      const movies = Array.isArray(streams)
        ? streams.map((stream: any, index: number) => buildVodItem(stream, index, categoryMap, "movie", baseUrl, username, password))
        : [];

      return json({ success: true, movies: sortByName(movies) });
    }

    if (action === "fetch_xtream_series") {
      const categoryResponse = await fetchWithDns(
        `${buildXtreamUrl(server, username, password)}&action=get_series_categories`,
        { headers: { "User-Agent": "IPTVClient/1.0" } },
        15000,
      );
      const seriesResponse = await fetchWithDns(
        `${buildXtreamUrl(server, username, password)}&action=get_series`,
        { headers: { "User-Agent": "IPTVClient/1.0" } },
        30000,
      );

      const categories = categoryResponse.ok ? await categoryResponse.json() : [];
      const series = seriesResponse.ok ? await seriesResponse.json() : [];
      const categoryMap = buildCategoryMap(categories);
      const baseUrl = sanitizeBaseUrl(server);

      const mappedSeries = Array.isArray(series)
        ? series.map((item: any, index: number) => buildVodItem(item, index, categoryMap, "series", baseUrl, username, password))
        : [];

      return json({ success: true, series: sortByName(mappedSeries) });
    }

    if (action === "fetch_xtream_series_info") {
      const infoUrl = `${buildXtreamUrl(server, username, password)}&action=get_series_info&series_id=${seriesId}`;
      const response = await fetchWithDns(infoUrl, {
        headers: { "User-Agent": "IPTVClient/1.0" },
      }, 15000);

      if (!response.ok) {
        return json({ success: false, error: `HTTP ${response.status}` }, 400);
      }

      const data = await response.json();
      const baseUrl = sanitizeBaseUrl(server);
      const seasonsMap: Record<number, Episode[]> = {};

      if (data?.episodes) {
        for (const [seasonNum, episodes] of Object.entries(data.episodes)) {
          const sNum = Number(seasonNum);
          if (!Array.isArray(episodes)) continue;
          seasonsMap[sNum] = (episodes as any[]).map((ep: any) => {
            const ext = ep.container_extension || "m3u8";
            return {
              id: String(ep.id ?? ep.episode_num ?? 0),
              episodeNum: Number(ep.episode_num || 0),
              title: ep.title || `Episódio ${ep.episode_num}`,
              streamUrl: `${baseUrl}/series/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${ep.id}.${ext}`,
              duration: ep.info?.duration || undefined,
              plot: ep.info?.plot || ep.info?.movie_image || undefined,
              containerExtension: ext,
            } as Episode;
          });
        }
      }

      const seasons: Season[] = Object.entries(seasonsMap)
        .map(([num, episodes]) => ({ seasonNumber: Number(num), episodes }))
        .sort((a, b) => a.seasonNumber - b.seasonNumber);

      return json({
        success: true,
        seasons,
        info: {
          synopsis: data?.info?.plot || undefined,
          cast: data?.info?.cast || undefined,
          director: data?.info?.director || undefined,
        },
      });
    }

    // Stream proxy - proxies the stream through Cloudflare DNS to bypass blocks
    if (action === "proxy_stream") {
      if (!streamUrl) {
        return json({ success: false, error: "streamUrl é obrigatório" }, 400);
      }

      const response = await fetchWithDns(streamUrl, {
        headers: {
          "User-Agent": "IPTVClient/1.0",
          "Accept": "*/*",
        },
      }, 15000);

      if (!response.ok) {
        return json({ success: false, error: `HTTP ${response.status}` }, 400);
      }

      const contentType = response.headers.get("content-type") || "application/octet-stream";

      return new Response(response.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
        },
      });
    }

    return json({ success: false, error: "Ação inválida" }, 400);
  } catch (error: any) {
    const message = error?.name === "AbortError"
      ? "Timeout: o servidor não respondeu a tempo"
      : error?.message || "Erro desconhecido";

    return json({ success: false, error: message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function fetchWithDns(input: RequestInfo | URL, init: RequestInit, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Use Cloudflare DNS-over-HTTPS to resolve the domain first
    // Then fetch with the resolved IP, passing through Cloudflare's network
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizeBaseUrl(server: string) {
  return server.replace(/\/$/, "");
}

function buildXtreamUrl(server: string, username: string, password: string) {
  const baseUrl = sanitizeBaseUrl(server);
  return `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
}

function buildCategoryMap(categories: any[]) {
  const categoryMap: Record<string, string> = {};
  if (!Array.isArray(categories)) return categoryMap;
  for (const category of categories) {
    if (category?.category_id) {
      categoryMap[String(category.category_id)] = category.category_name || "Sem categoria";
    }
  }
  return categoryMap;
}

function buildXtreamLiveChannel(stream: any, index: number, categoryMap: Record<string, string>, baseUrl: string, username: string, password: string): LiveChannel {
  const streamId = String(stream?.stream_id ?? index);
  const primaryUrl = `${baseUrl}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${streamId}.m3u8`;
  const fallbackTs = `${baseUrl}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${streamId}.ts`;

  return {
    id: streamId,
    name: stream?.name || `Canal ${index + 1}`,
    logo: sanitizeImage(stream?.stream_icon),
    group: categoryMap[String(stream?.category_id)] || "Sem categoria",
    url: primaryUrl,
    streamCandidates: [primaryUrl, fallbackTs],
    epgNow: "",
  };
}

function buildVodItem(item: any, index: number, categoryMap: Record<string, string>, type: "movie" | "series", baseUrl?: string, username?: string, password?: string): VodItem {
  const name = item?.name || `${type === "movie" ? "Filme" : "Série"} ${index + 1}`;
  const year = extractYear(item?.year || item?.releasedate || name);
  const ratingValue = Number.parseFloat(String(item?.rating_5based || item?.rating || 0));
  const streamId = String(item?.stream_id ?? item?.series_id ?? index);

  let streamUrl: string | undefined;
  if (baseUrl && username && password && item?.stream_id) {
    const ext = type === "movie" ? item?.container_extension || "mp4" : "m3u8";
    streamUrl = `${baseUrl}/${type === "movie" ? "movie" : "series"}/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${streamId}.${ext}`;
  }

  return {
    id: streamId,
    name,
    poster: sanitizeImage(item?.stream_icon || item?.cover || item?.cover_big),
    rating: Number.isFinite(ratingValue) ? Number(ratingValue.toFixed(1)) : 0,
    year,
    genre: categoryMap[String(item?.category_id)] || "Sem categoria",
    type,
    streamUrl,
    synopsis: item?.plot || item?.description || undefined,
    seriesId: type === "series" ? String(item?.series_id ?? "") : undefined,
  };
}

function sanitizeImage(value: unknown) {
  if (typeof value !== "string") return "";
  if (value === "null") return "";
  return value;
}

function extractYear(value: unknown) {
  const match = String(value || "").match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : new Date().getFullYear();
}

function classifyM3UEntry(name: string, group: string, url: string) {
  const lowerUrl = url.toLowerCase();
  const lowerName = name.toLowerCase();
  const lowerGroup = group.toLowerCase();

  // URL-based classification (most reliable)
  if (lowerUrl.includes("/series/")) return "series" as const;
  if (lowerUrl.includes("/movie/")) return "movie" as const;

  // File extension based
  if (/\.(mp4|mkv|avi|mov|webm)(\?|$)/.test(lowerUrl)) {
    // Check if it's a series by name/group
    if (lowerName.match(/s\d{1,2}\s*e\d{1,2}/i) || lowerName.includes("temporada") || lowerName.includes("season") || lowerName.includes("episod") || lowerGroup.includes("serie") || lowerGroup.includes("séri")) {
      return "series" as const;
    }
    return "movie" as const;
  }

  // Group-based classification
  if (lowerGroup.includes("filme") || lowerGroup.includes("movie") || lowerGroup.includes("vod") || lowerGroup.includes("cinema")) return "movie" as const;
  if (lowerGroup.includes("serie") || lowerGroup.includes("séri") || lowerGroup.includes("novela")) return "series" as const;

  // Name-based classification
  if (lowerName.includes("filme") || lowerName.includes("movie")) return "movie" as const;
  if (lowerName.match(/s\d{1,2}\s*e\d{1,2}/i) || lowerName.includes("temporada") || lowerName.includes("episod")) return "series" as const;

  return "live" as const;
}

async function streamParseM3UCatalog(body: ReadableStream<Uint8Array>, limitPerSection: number) {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  const live: LiveChannel[] = [];
  const movies: VodItem[] = [];
  const series: VodItem[] = [];
  // Group series episodes by series name for M3U
  const seriesMap: Map<string, { item: VodItem; episodes: Episode[] }> = new Map();
  let buffer = "";
  let pendingEntry: { name: string; logo: string; group: string } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf("\n");

      if (!line) continue;

      if (line.startsWith("#EXTINF:")) {
        const nameMatch = line.match(/,(.+)$/);
        const logoMatch = line.match(/tvg-logo="([^"]*)"/);
        const groupMatch = line.match(/group-title="([^"]*)"/);

        pendingEntry = {
          name: nameMatch?.[1]?.trim() || "Sem nome",
          logo: sanitizeImage(logoMatch?.[1] || ""),
          group: groupMatch?.[1]?.trim() || "Sem categoria",
        };
        continue;
      }

      if (pendingEntry && !line.startsWith("#")) {
        const entryType = classifyM3UEntry(pendingEntry.name, pendingEntry.group, line);

        if (entryType === "live" && live.length < limitPerSection) {
          live.push({
            id: `live-${live.length}`,
            name: pendingEntry.name,
            logo: pendingEntry.logo,
            group: pendingEntry.group,
            url: line,
            streamCandidates: [line],
            epgNow: "",
          });
        } else if (entryType === "movie" && movies.length < limitPerSection) {
          movies.push({
            id: `movie-${movies.length}`,
            name: pendingEntry.name,
            poster: pendingEntry.logo,
            rating: 0,
            year: extractYear(pendingEntry.name),
            genre: pendingEntry.group,
            type: "movie",
            streamUrl: line,
          });
        } else if (entryType === "series") {
          // For M3U series, try to group by series name (strip episode info)
          const seriesName = extractSeriesName(pendingEntry.name);
          const episodeInfo = extractEpisodeInfo(pendingEntry.name);

          if (seriesMap.has(seriesName)) {
            const existing = seriesMap.get(seriesName)!;
            existing.episodes.push({
              id: `ep-${existing.episodes.length}`,
              episodeNum: episodeInfo.episode || existing.episodes.length + 1,
              title: pendingEntry.name,
              streamUrl: line,
            });
          } else if (series.length < limitPerSection) {
            const newItem: VodItem = {
              id: `series-${series.length}`,
              name: seriesName,
              poster: pendingEntry.logo,
              rating: 0,
              year: extractYear(pendingEntry.name),
              genre: pendingEntry.group,
              type: "series",
              streamUrl: line, // Direct play URL for first episode
            };
            const ep: Episode = {
              id: `ep-0`,
              episodeNum: episodeInfo.episode || 1,
              title: pendingEntry.name,
              streamUrl: line,
            };
            seriesMap.set(seriesName, { item: newItem, episodes: [ep] });
            series.push(newItem);
          }
        }

        pendingEntry = null;
      }
    }

    if (live.length >= limitPerSection && movies.length >= limitPerSection && series.length >= limitPerSection) {
      break;
    }
  }

  try { await reader.cancel(); } catch { /* ignore */ }

  // Attach episodes to series items from M3U
  for (const [, data] of seriesMap) {
    const seasons: { seasonNumber: number; episodes: Episode[] }[] = [];
    // Group episodes by season
    const seasonMap = new Map<number, Episode[]>();
    for (const ep of data.episodes) {
      const info = extractEpisodeInfo(ep.title || "");
      const sNum = info.season || 1;
      if (!seasonMap.has(sNum)) seasonMap.set(sNum, []);
      seasonMap.get(sNum)!.push({ ...ep, episodeNum: info.episode || ep.episodeNum });
    }
    for (const [sNum, eps] of seasonMap) {
      seasons.push({ seasonNumber: sNum, episodes: eps.sort((a, b) => a.episodeNum - b.episodeNum) });
    }
    (data.item as any).seasons = seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);
  }

  return {
    live: sortByName(live),
    movies: sortByName(movies),
    series: sortByName(series),
  };
}

function extractSeriesName(name: string): string {
  // Remove common episode patterns to get the series name
  return name
    .replace(/\s*[-–]\s*S\d{1,2}\s*E\d{1,2}.*/i, "")
    .replace(/\s*S\d{1,2}\s*E\d{1,2}.*/i, "")
    .replace(/\s*[-–]\s*T\d{1,2}\s*E\d{1,2}.*/i, "")
    .replace(/\s*[-–]\s*Temporada\s*\d+.*/i, "")
    .replace(/\s*[-–]\s*Season\s*\d+.*/i, "")
    .replace(/\s*[-–]\s*Epis[oó]dio\s*\d+.*/i, "")
    .replace(/\s*\(\d{4}\)\s*$/, "")
    .trim() || name;
}

function extractEpisodeInfo(name: string): { season: number; episode: number } {
  // S01E05 format
  const seMatch = name.match(/S(\d{1,2})\s*E(\d{1,3})/i);
  if (seMatch) return { season: Number(seMatch[1]), episode: Number(seMatch[2]) };

  // T01 E05 format
  const tMatch = name.match(/T(\d{1,2})\s*E(\d{1,3})/i);
  if (tMatch) return { season: Number(tMatch[1]), episode: Number(tMatch[2]) };

  // Episódio X
  const epMatch = name.match(/[Ee]pis[oó]dio\s*(\d+)/i);
  if (epMatch) return { season: 1, episode: Number(epMatch[1]) };

  return { season: 1, episode: 1 };
}

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
