import { useMemo } from "react";
import HeroCarousel from "./HeroCarousel";
import ContentRow from "./ContentRow";
import ChannelRow from "./ChannelRow";
import ContinueWatchingRow from "./ContinueWatchingRow";
import type { WatchedEntry } from "./ContinueWatchingRow";
import type { Channel, VodItem } from "@/lib/mock-data";

const STORAGE_KEY = "obsidian_watch_progress";

interface DashboardViewProps {
  onNavigate: (section: string) => void;
  onPlayChannel?: (channel: Channel) => void;
  onPlayVod?: (item: VodItem) => void;
  onSelectItem?: (item: VodItem) => void;
  liveChannels: Channel[];
  movieItems: VodItem[];
  seriesItems: VodItem[];
}

const DashboardView = ({ onNavigate, onPlayChannel, onPlayVod, onSelectItem, liveChannels, movieItems, seriesItems }: DashboardViewProps) => {
  const heroItems = [...movieItems, ...seriesItems]
    .filter((i) => i.poster && i.rating)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 8);

  const handlePlay = (item: VodItem) => {
    if (item.streamUrl) onPlayVod?.(item);
    else onSelectItem?.(item);
  };

  // Build "Continue Watching" entries from localStorage progress
  const continueWatching = useMemo(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const all: Record<string, { itemId: string; currentTime: number; duration: number; updatedAt: string; label?: string }> = JSON.parse(raw);
      const allItems = [...movieItems, ...seriesItems];

      return Object.values(all)
        .filter((p) => p.duration > 0 && (p.currentTime / p.duration) < 0.95 && p.currentTime > 30)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 20)
        .map((p): WatchedEntry => {
          // Try to find matching VOD item
          const baseId = p.itemId.includes("-S") ? p.itemId.split("-S")[0] : p.itemId;
          const item = allItems.find((i) => i.id === baseId || i.id === p.itemId) || null;
          return { ...p, item };
        });
    } catch {
      return [];
    }
  }, [movieItems, seriesItems]);

  const handleResume = (entry: WatchedEntry) => {
    if (entry.item) {
      if (entry.item.type === "series") {
        onSelectItem?.(entry.item);
      } else if (entry.item.streamUrl) {
        onPlayVod?.(entry.item);
      } else {
        onSelectItem?.(entry.item);
      }
    }
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      {heroItems.length > 0 && (
        <div className="-mx-4 md:mx-0 -mt-4 md:mt-0">
          <HeroCarousel
            items={heroItems}
            onPlay={handlePlay}
            onInfo={(item) => onSelectItem?.(item)}
          />
        </div>
      )}

      <ContinueWatchingRow entries={continueWatching} onResume={handleResume} />

      <ContentRow
        title="Filmes"
        items={movieItems.slice(0, 20)}
        onItemClick={onSelectItem}
        onSeeAll={() => onNavigate("movies")}
      />

      <ContentRow
        title="Séries"
        items={seriesItems.slice(0, 20)}
        onItemClick={onSelectItem}
        onSeeAll={() => onNavigate("series")}
      />

      {liveChannels.length > 0 && (
        <section className="space-y-3 px-4 md:px-0">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">Ao Vivo</h2>
            <button
              onClick={() => onNavigate("live")}
              className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Ver todos
            </button>
          </div>
          <div className="space-y-1">
            {liveChannels.slice(0, 5).map((channel, index) => (
              <ChannelRow key={channel.id} channel={channel} index={index} onPlay={() => onPlayChannel?.(channel)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default DashboardView;
