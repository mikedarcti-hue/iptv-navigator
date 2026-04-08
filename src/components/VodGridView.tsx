import { useEffect, useMemo, useState } from "react";
import VodCard from "./VodCard";
import VodDetailView from "./VodDetailView";
import SeriesDetailView from "./SeriesDetailView";
import type { VodItem, Episode } from "@/lib/mock-data";
import { Search, X, ArrowLeft } from "lucide-react";
import { useDeviceMode } from "@/pages/Index";

interface VodGridViewProps {
  title: string;
  items: VodItem[];
  onPlayVod?: (item: VodItem) => void;
  onPlayEpisode?: (item: VodItem, episode: Episode, seasonNumber: number) => void;
  onBack?: () => void;
}

const INITIAL = 60;
const STEP = 60;

const VodGridView = ({ title, items, onPlayVod, onPlayEpisode, onBack }: VodGridViewProps) => {
  const deviceMode = useDeviceMode();
  const isTvMode = deviceMode === "tv";
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL);
  const [selectedItem, setSelectedItem] = useState<VodItem | null>(null);

  const genres = useMemo(() => [...new Set(items.map((i) => i.genre))].sort(), [items]);
  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return items
      .filter((i) => (!t || i.name.toLowerCase().includes(t)) && (!selectedGenre || i.genre === selectedGenre))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [items, search, selectedGenre]);

  useEffect(() => setVisibleCount(INITIAL), [items, search, selectedGenre]);

  if (selectedItem) {
    if (selectedItem.type === "series") {
      return <SeriesDetailView item={selectedItem} onBack={() => setSelectedItem(null)} onPlayEpisode={(item, ep, s) => onPlayEpisode?.(item, ep, s)} />;
    }
    return <VodDetailView item={selectedItem} onBack={() => setSelectedItem(null)} onPlay={(item) => onPlayVod?.(item)} />;
  }

  // TV mode: fullscreen-like layout without footer
  if (isTvMode) {
    return (
      <div className="fixed inset-0 z-40 bg-background flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 shrink-0">
          <button
            onClick={() => onBack?.()}
            className="w-10 h-10 rounded-full bg-card flex items-center justify-center hover:bg-surface-hover transition-colors tv-focus"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
          <span className="text-sm text-muted-foreground">{filtered.length} títulos</span>
          <div className="flex-1" />
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border/50 w-72">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Buscar ${title.toLowerCase()}...`}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none tv-focus"
            />
            {search && (
              <button onClick={() => setSearch("")} className="tv-focus"><X className="w-4 h-4 text-muted-foreground" /></button>
            )}
          </div>
        </div>

        {/* Genre filters */}
        <div className="flex gap-2 overflow-x-auto carousel-scroll px-6 pb-3 shrink-0">
          <button
            onClick={() => setSelectedGenre(null)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all tv-focus ${!selectedGenre ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
          >
            Todos
          </button>
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(g === selectedGenre ? null : g)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all tv-focus ${selectedGenre === g ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="grid grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
            {filtered.slice(0, visibleCount).map((item, index) => (
              <VodCard key={item.id} item={item} index={index} onClick={setSelectedItem} />
            ))}
          </div>

          {filtered.length > visibleCount && (
            <button
              onClick={() => setVisibleCount((c) => c + STEP)}
              className="w-full py-3 mt-4 rounded-lg bg-card text-sm font-medium text-foreground hover:bg-surface-hover transition-colors border border-border/30 tv-focus"
            >
              Carregar mais
            </button>
          )}

          {filtered.length === 0 && items.length > 0 && (
            <p className="text-sm text-muted-foreground text-center py-16">Nenhum título encontrado.</p>
          )}
        </div>
      </div>
    );
  }

  // Mobile/tablet mode (original)
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{title}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{items.length} títulos</p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-card border border-border/50">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Buscar ${title.toLowerCase()}...`}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        {search && (
          <button onClick={() => setSearch("")}><X className="w-4 h-4 text-muted-foreground" /></button>
        )}
      </div>

      {/* Genre filters */}
      <div className="flex gap-2 overflow-x-auto carousel-scroll pb-1">
        <button
          onClick={() => setSelectedGenre(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${!selectedGenre ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"}`}
        >
          Todos
        </button>
        {genres.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGenre(g === selectedGenre ? null : g)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selectedGenre === g ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"}`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3">
        {filtered.slice(0, visibleCount).map((item, index) => (
          <VodCard key={item.id} item={item} index={index} onClick={setSelectedItem} />
        ))}
      </div>

      {filtered.length > visibleCount && (
        <button
          onClick={() => setVisibleCount((c) => c + STEP)}
          className="w-full py-3 rounded-lg bg-card text-sm font-medium text-foreground hover:bg-surface-hover transition-colors border border-border/30"
        >
          Carregar mais
        </button>
      )}

      {filtered.length === 0 && items.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-16">Nenhum título encontrado.</p>
      )}
    </div>
  );
};

export default VodGridView;
