import { useEffect, useMemo, useState } from "react";
import VodCard from "./VodCard";
import VodDetailView from "./VodDetailView";
import SeriesDetailView from "./SeriesDetailView";
import type { VodItem, Episode } from "@/lib/mock-data";
import { Search, X } from "lucide-react";

interface VodGridViewProps {
  title: string;
  items: VodItem[];
  onPlayVod?: (item: VodItem) => void;
  onPlayEpisode?: (item: VodItem, episode: Episode, seasonNumber: number) => void;
}

const INITIAL = 60;
const STEP = 60;

const VodGridView = ({ title, items, onPlayVod, onPlayEpisode }: VodGridViewProps) => {
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
