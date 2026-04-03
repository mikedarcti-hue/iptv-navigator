import { Heart, Play, Trash2, Tv, Film, Clapperboard } from "lucide-react";
import { useState, useMemo } from "react";
import { getFavorites, toggleFavorite, type FavoriteItem } from "@/lib/favorites";
import type { Channel, VodItem } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import VodCard from "./VodCard";
import { toast } from "sonner";

interface FavoritesViewProps {
  liveChannels: Channel[];
  movieItems: VodItem[];
  seriesItems: VodItem[];
  onPlayChannel?: (channel: Channel) => void;
  onSelectItem?: (item: VodItem) => void;
}

const FavoritesView = ({ liveChannels, movieItems, seriesItems, onPlayChannel, onSelectItem }: FavoritesViewProps) => {
  const [, setTick] = useState(0);
  const forceUpdate = () => setTick((t) => t + 1);
  const [filter, setFilter] = useState<"all" | "channel" | "movie" | "series">("all");

  const favorites = useMemo(() => getFavorites(), [/* eslint-disable-line */]);

  const resolvedChannels = useMemo(() => {
    return favorites
      .filter((f) => f.type === "channel")
      .map((f) => liveChannels.find((c) => c.id === f.id))
      .filter(Boolean) as Channel[];
  }, [favorites, liveChannels]);

  const resolvedMovies = useMemo(() => {
    return favorites
      .filter((f) => f.type === "movie")
      .map((f) => movieItems.find((m) => m.id === f.id))
      .filter(Boolean) as VodItem[];
  }, [favorites, movieItems]);

  const resolvedSeries = useMemo(() => {
    return favorites
      .filter((f) => f.type === "series")
      .map((f) => seriesItems.find((s) => s.id === f.id))
      .filter(Boolean) as VodItem[];
  }, [favorites, seriesItems]);

  const handleRemove = (id: string, type: "channel" | "movie" | "series") => {
    toggleFavorite(id, type);
    forceUpdate();
    toast.success("Removido dos favoritos");
  };

  const hasItems = resolvedChannels.length > 0 || resolvedMovies.length > 0 || resolvedSeries.length > 0;

  const filters = [
    { id: "all" as const, label: "Todos", count: resolvedChannels.length + resolvedMovies.length + resolvedSeries.length },
    { id: "channel" as const, label: "Canais", icon: Tv, count: resolvedChannels.length },
    { id: "movie" as const, label: "Filmes", icon: Film, count: resolvedMovies.length },
    { id: "series" as const, label: "Séries", icon: Clapperboard, count: resolvedSeries.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Favoritos</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Seus canais e títulos favoritos</p>
      </div>

      {hasItems && (
        <div className="flex gap-2 overflow-x-auto carousel-scroll pb-1">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                filter === f.id ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      )}

      {!hasItems && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-2xl bg-card flex items-center justify-center mb-6 card-shadow">
            <Heart className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum favorito ainda</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Toque no ícone de coração em qualquer filme, série ou canal para adicioná-lo aqui.
          </p>
        </div>
      )}

      {/* Channels */}
      {(filter === "all" || filter === "channel") && resolvedChannels.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">Canais</h2>
          <div className="space-y-1">
            {resolvedChannels.map((c) => (
              <div
                key={c.id}
                className="group flex items-center gap-3 p-3 rounded-lg bg-card/50 hover:bg-card transition-all"
              >
                <div className="w-10 h-10 rounded-md bg-card overflow-hidden shrink-0">
                  {c.logo ? (
                    <img src={c.logo} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-muted-foreground bg-secondary">
                      {c.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPlayChannel?.(c)}>
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.group}</p>
                </div>
                <button
                  onClick={() => onPlayChannel?.(c)}
                  className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors"
                >
                  <Play className="w-3.5 h-3.5 text-primary fill-primary" />
                </button>
                <button
                  onClick={() => handleRemove(c.id, "channel")}
                  className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 hover:bg-destructive/20 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Movies */}
      {(filter === "all" || filter === "movie") && resolvedMovies.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">Filmes</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {resolvedMovies.map((item, i) => (
              <VodCard key={item.id} item={item} index={i} onClick={onSelectItem} />
            ))}
          </div>
        </section>
      )}

      {/* Series */}
      {(filter === "all" || filter === "series") && resolvedSeries.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">Séries</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {resolvedSeries.map((item, i) => (
              <VodCard key={item.id} item={item} index={i} onClick={onSelectItem} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default FavoritesView;
