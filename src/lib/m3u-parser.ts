import type { CatalogData } from "@/lib/catalog-store";
import type { Channel, Episode, Season, VodItem } from "@/lib/mock-data";

const ITEM_LIMIT = 50000;
const YIELD_EVERY = 2500;

export async function parseM3UCatalogStream(
  body: ReadableStream<Uint8Array>,
  limitPerSection = ITEM_LIMIT,
): Promise<CatalogData> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  const live: Channel[] = [];
  const movies: VodItem[] = [];
  const series: VodItem[] = [];
  const seriesMap = new Map<string, { item: VodItem; episodes: Episode[] }>();
  let buffer = "";
  let pendingEntry: { name: string; logo: string; group: string } | null = null;
  let processedEntries = 0;

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
              streamUrl: line,
            };

            const firstEpisode: Episode = {
              id: "ep-0",
              episodeNum: episodeInfo.episode || 1,
              title: pendingEntry.name,
              streamUrl: line,
            };

            seriesMap.set(seriesName, { item: newItem, episodes: [firstEpisode] });
            series.push(newItem);
          }
        }

        pendingEntry = null;
        processedEntries += 1;

        if (processedEntries % YIELD_EVERY === 0) {
          await yieldToBrowser();
        }
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

  for (const [, data] of seriesMap) {
    const seasonMap = new Map<number, Episode[]>();
    for (const episode of data.episodes) {
      const info = extractEpisodeInfo(episode.title || "");
      const seasonNumber = info.season || 1;
      if (!seasonMap.has(seasonNumber)) seasonMap.set(seasonNumber, []);
      seasonMap.get(seasonNumber)!.push({
        ...episode,
        episodeNum: info.episode || episode.episodeNum,
      });
    }

    const seasons: Season[] = [...seasonMap.entries()]
      .map(([seasonNumber, episodes]) => ({
        seasonNumber,
        episodes: episodes.sort((a, b) => a.episodeNum - b.episodeNum),
      }))
      .sort((a, b) => a.seasonNumber - b.seasonNumber);

    data.item.seasons = seasons;
  }

  return {
    live: sortByName(live),
    movies: sortByName(movies),
    series: sortByName(series),
  };
}

function classifyM3UEntry(name: string, group: string, url: string) {
  const lowerUrl = url.toLowerCase();
  const lowerName = name.toLowerCase();
  const lowerGroup = group.toLowerCase();

  if (lowerUrl.includes("/series/")) return "series" as const;
  if (lowerUrl.includes("/movie/")) return "movie" as const;

  if (/\.(mp4|mkv|avi|mov|webm)(\?|$)/.test(lowerUrl)) {
    if (
      lowerName.match(/s\d{1,2}\s*e\d{1,2}/i) ||
      lowerName.includes("temporada") ||
      lowerName.includes("season") ||
      lowerName.includes("episod") ||
      lowerGroup.includes("serie") ||
      lowerGroup.includes("séri")
    ) {
      return "series" as const;
    }
    return "movie" as const;
  }

  if (
    lowerGroup.includes("filme") ||
    lowerGroup.includes("movie") ||
    lowerGroup.includes("vod") ||
    lowerGroup.includes("cinema")
  ) {
    return "movie" as const;
  }

  if (lowerGroup.includes("serie") || lowerGroup.includes("séri") || lowerGroup.includes("novela")) {
    return "series" as const;
  }

  if (lowerName.includes("filme") || lowerName.includes("movie")) return "movie" as const;
  if (lowerName.match(/s\d{1,2}\s*e\d{1,2}/i) || lowerName.includes("temporada") || lowerName.includes("episod")) {
    return "series" as const;
  }

  return "live" as const;
}

function extractSeriesName(name: string): string {
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
  const seMatch = name.match(/S(\d{1,2})\s*E(\d{1,3})/i);
  if (seMatch) return { season: Number(seMatch[1]), episode: Number(seMatch[2]) };

  const tMatch = name.match(/T(\d{1,2})\s*E(\d{1,3})/i);
  if (tMatch) return { season: Number(tMatch[1]), episode: Number(tMatch[2]) };

  const epMatch = name.match(/[Ee]pis[oó]dio\s*(\d+)/i);
  if (epMatch) return { season: 1, episode: Number(epMatch[1]) };

  return { season: 1, episode: 1 };
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

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function yieldToBrowser() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}