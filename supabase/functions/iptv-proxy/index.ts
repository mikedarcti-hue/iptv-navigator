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
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, url, type, server, username, password } = await req.json();

    if (action === "test") {
      if (type === "m3u") {
        const response = await fetchWithTimeout(url, {
          headers: {
            "User-Agent": "IPTVClient/1.0",
            Range: "bytes=0-4096",
          },
        }, 10000);

        if (!response.ok && response.status !== 206) {
          return json({ success: false, error: `HTTP ${response.status}` }, 400);
        }

        await response.text();
        return json({ success: true });
      }

      const authUrl = buildXtreamUrl(server, username, password);
      const response = await fetchWithTimeout(authUrl, {
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
      const response = await fetchWithTimeout(url, {
        headers: { "User-Agent": "IPTVClient/1.0" },
      }, 25000);

      if (!response.ok || !response.body) {
        return json({ success: false, error: `HTTP ${response.status}` }, 400);
      }

      const catalog = await streamParseM3UCatalog(response.body, 1800);
      return json({ success: true, ...catalog });
    }

    if (action === "fetch_xtream_live") {
      const categoryResponse = await fetchWithTimeout(
        `${buildXtreamUrl(server, username, password)}&action=get_live_categories`,
        { headers: { "User-Agent": "IPTVClient/1.0" } },
        15000,
      );
      const streamResponse = await fetchWithTimeout(
        `${buildXtreamUrl(server, username, password)}&action=get_live_streams`,
        { headers: { "User-Agent": "IPTVClient/1.0" } },
        20000,
      );

      const categories = categoryResponse.ok ? await categoryResponse.json() : [];
      const streams = streamResponse.ok ? await streamResponse.json() : [];
      const categoryMap = buildCategoryMap(categories);
      const baseUrl = sanitizeBaseUrl(server);

      const live = Array.isArray(streams)
        ? streams.slice(0, 1800).map((stream: any, index: number) => buildXtreamLiveChannel(stream, index, categoryMap, baseUrl, username, password))
        : [];

      return json({ success: true, live: sortByName(live) });
    }

    if (action === "fetch_xtream_movies") {
      const categoryResponse = await fetchWithTimeout(
        `${buildXtreamUrl(server, username, password)}&action=get_vod_categories`,
        { headers: { "User-Agent": "IPTVClient/1.0" } },
        15000,
      );
      const streamResponse = await fetchWithTimeout(
        `${buildXtreamUrl(server, username, password)}&action=get_vod_streams`,
        { headers: { "User-Agent": "IPTVClient/1.0" } },
        20000,
      );

      const categories = categoryResponse.ok ? await categoryResponse.json() : [];
      const streams = streamResponse.ok ? await streamResponse.json() : [];
      const categoryMap = buildCategoryMap(categories);
      const baseUrl = sanitizeBaseUrl(server);

      const movies = Array.isArray(streams)
        ? streams.slice(0, 1800).map((stream: any, index: number) => buildVodItem(stream, index, categoryMap, "movie", baseUrl, username, password))
        : [];

      return json({ success: true, movies: sortByName(movies) });
    }

    if (action === "fetch_xtream_series") {
      const categoryResponse = await fetchWithTimeout(
        `${buildXtreamUrl(server, username, password)}&action=get_series_categories`,
        { headers: { "User-Agent": "IPTVClient/1.0" } },
        15000,
      );
      const seriesResponse = await fetchWithTimeout(
        `${buildXtreamUrl(server, username, password)}&action=get_series`,
        { headers: { "User-Agent": "IPTVClient/1.0" } },
        20000,
      );

      const categories = categoryResponse.ok ? await categoryResponse.json() : [];
      const series = seriesResponse.ok ? await seriesResponse.json() : [];
      const categoryMap = buildCategoryMap(categories);
      const baseUrl = sanitizeBaseUrl(server);

      const mappedSeries = Array.isArray(series)
        ? series.slice(0, 1800).map((item: any, index: number) => buildVodItem(item, index, categoryMap, "series", baseUrl, username, password))
        : [];

      return json({ success: true, series: sortByName(mappedSeries) });
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

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
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
  const fallbackUrl = `${baseUrl}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${streamId}.ts`;

  return {
    id: streamId,
    name: stream?.name || `Canal ${index + 1}`,
    logo: sanitizeImage(stream?.stream_icon),
    group: categoryMap[String(stream?.category_id)] || "Sem categoria",
    url: primaryUrl,
    streamCandidates: [primaryUrl, fallbackUrl],
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
  const haystack = `${name} ${group} ${url}`.toLowerCase();

  const isSeries = haystack.includes("series") || haystack.includes("série") || haystack.includes("epis") || haystack.includes("temporada") || haystack.includes("season") || haystack.includes("/series/");
  if (isSeries) return "series" as const;

  const isMovie = haystack.includes("movie") || haystack.includes("filme") || haystack.includes("cinema") || haystack.includes("vod") || haystack.includes("/movie/") || /\.(mp4|mkv|avi|mov)(\?|$)/.test(haystack);
  if (isMovie) return "movie" as const;

  return "live" as const;
}

async function streamParseM3UCatalog(body: ReadableStream<Uint8Array>, limitPerSection: number) {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  const live: LiveChannel[] = [];
  const movies: VodItem[] = [];
  const series: VodItem[] = [];
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
        const type = classifyM3UEntry(pendingEntry.name, pendingEntry.group, line);

        if (type === "live" && live.length < limitPerSection) {
          live.push({
            id: `${pendingEntry.group}-${live.length}`,
            name: pendingEntry.name,
            logo: pendingEntry.logo,
            group: pendingEntry.group,
            url: line,
            streamCandidates: [line],
            epgNow: "",
          });
        }

        if (type === "movie" && movies.length < limitPerSection) {
          movies.push({
            id: `${pendingEntry.group}-${movies.length}`,
            name: pendingEntry.name,
            poster: pendingEntry.logo,
            rating: 0,
            year: extractYear(pendingEntry.name),
            genre: pendingEntry.group,
            type: "movie",
            streamUrl: line,
          });
        }

        if (type === "series" && series.length < limitPerSection) {
          series.push({
            id: `${pendingEntry.group}-${series.length}`,
            name: pendingEntry.name,
            poster: pendingEntry.logo,
            rating: 0,
            year: extractYear(pendingEntry.name),
            genre: pendingEntry.group,
            type: "series",
          });
        }

        pendingEntry = null;
      }
    }

    if (live.length >= limitPerSection && movies.length >= limitPerSection && series.length >= limitPerSection) {
      break;
    }
  }

  try {
    await reader.cancel();
  } catch {
    // ignore
  }

  return {
    live: sortByName(live),
    movies: sortByName(movies),
    series: sortByName(series),
  };
}

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
