import { useEffect, useMemo, useRef, useState } from "react";
import VodCard from "./VodCard";
import VodDetailView from "./VodDetailView";
import SeriesDetailView from "./SeriesDetailView";
import ContinueWatchingRow, { type WatchedEntry } from "./ContinueWatchingRow";
import type { VodItem, Episode } from "@/lib/mock-data";
import { Search, X, ArrowLeft, Play, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useDeviceMode } from "@/pages/Index";
import { cn } from "@/lib/utils";
import { getAllProgress } from "@/lib/watch-progress";

interface VodGridViewProps {
  title: string;
  items: VodItem[];
  onPlayVod?: (item: VodItem) => void;
  onPlayEpisode?: (item: VodItem, episode: Episode, seasonNumber: number) => void;
  onBack?: () => void;
}

const INITIAL = 60;
const STEP = 60;

// Stable color palette for category tiles (HSL using design tokens where possible)
const CATEGORY_GRADIENTS = [
  "from-rose-600 to-rose-800",
  "from-indigo-600 to-violet-800",
  "from-orange-500 to-amber-700",
  "from-sky-600 to-blue-800",
  "from-emerald-600 to-teal-800",
  "from-fuchsia-600 to-purple-800",
  "from-yellow-500 to-orange-700",
  "from-cyan-600 to-sky-800",
  "from-lime-600 to-green-800",
  "from-pink-600 to-rose-800",
];

const hashIndex = (s: string, mod: number) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
};

const VodGridView = ({ title, items, onPlayVod, onPlayEpisode, onBack }: VodGridViewProps) => {
  const deviceMode = useDeviceMode();
  const isTvMode = deviceMode === "tv";
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL);
  const [selectedItem, setSelectedItem] = useState<VodItem | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const genres = useMemo(() => [...new Set(items.map((i) => i.genre))].sort(), [items]);

  // Group items by genre to compute counts
  const itemsByGenre = useMemo(() => {
    const map = new Map<string, VodItem[]>();
    for (const it of items) {
      const list = map.get(it.genre) || [];
      list.push(it);
      map.set(it.genre, list);
    }
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return items
      .filter((i) => (!t || i.name.toLowerCase().includes(t)) && (!selectedGenre || i.genre === selectedGenre))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [items, search, selectedGenre]);

  // Featured / hero items: highest rated, with poster
  const featuredItems = useMemo(() => {
    return [...items]
      .filter((i) => i.poster)
      .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0))
      .slice(0, 8);
  }, [items]);

  const [heroIndex, setHeroIndex] = useState(0);
  useEffect(() => {
    if (featuredItems.length < 2) return;
    const id = setInterval(() => setHeroIndex((i) => (i + 1) % featuredItems.length), 7000);
    return () => clearInterval(id);
  }, [featuredItems.length]);

  // Latest added (assume order in items reflects newest first)
  const latestItems = useMemo(() => items.slice(0, 24), [items]);

  // Recently watched series episodes (mobile/tablet only)
  const isSeriesView = title.toLowerCase().includes("séri") || title.toLowerCase().includes("seri");
  const recentSeriesEntries = useMemo<WatchedEntry[]>(() => {
    if (!isSeriesView || isTvMode) return [];
    const all = getAllProgress();
    const byItem = new Map<string, WatchedEntry>();
    Object.values(all).forEach((p) => {
      const m = p.itemId.match(/^(.+)-S\d+E\d+$/);
      if (!m) return;
      const seriesId = m[1];
      const item = items.find((i) => i.id === seriesId);
      if (!item) return;
      const existing = byItem.get(seriesId);
      if (!existing || existing.updatedAt < p.updatedAt) {
        byItem.set(seriesId, {
          itemId: p.itemId,
          currentTime: p.currentTime,
          duration: p.duration,
          updatedAt: p.updatedAt,
          label: p.label,
          item,
        });
      }
    });
    return Array.from(byItem.values())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 12);
  }, [items, isSeriesView, isTvMode]);

  useEffect(() => setVisibleCount(INITIAL), [items, search, selectedGenre]);

  const isFiltering = !!search.trim() || !!selectedGenre;

  const scrollToGrid = () => {
    setTimeout(() => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  if (selectedItem) {
    if (selectedItem.type === "series") {
      return <SeriesDetailView item={selectedItem} onBack={() => setSelectedItem(null)} onPlayEpisode={(item, ep, s) => onPlayEpisode?.(item, ep, s)} />;
    }
    return <VodDetailView item={selectedItem} onBack={() => setSelectedItem(null)} onPlay={(item) => onPlayVod?.(item)} />;
  }

  const hero = featuredItems[heroIndex];

  // ============== Header (back + title + search) ==============
  const Header = (
    <div className="flex items-center gap-3 sm:gap-4">
      <button
        onClick={() => onBack?.()}
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-card/70 backdrop-blur flex items-center justify-center hover:bg-surface-hover transition-colors tv-focus shrink-0"
      >
        <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
      </button>
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl tv:text-2xl font-bold text-foreground tracking-tight truncate">{title}</h1>
        <p className="text-[11px] sm:text-xs text-muted-foreground">{items.length} títulos</p>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-card/70 backdrop-blur border border-border/50 w-44 sm:w-64 tv:w-80">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="flex-1 bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none tv-focus min-w-0"
        />
        {search && (
          <button onClick={() => setSearch("")} className="tv-focus shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );

  // ============== Sections ==============
  return (
    <div className="space-y-6 sm:space-y-8 tv:space-y-10 pb-8">
      {Header}

      {/* HERO */}
      {!isFiltering && hero && (
        <motion.section
          key={hero.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="relative rounded-2xl overflow-hidden -mx-1 sm:mx-0"
        >
          <div className="relative aspect-[16/9] sm:aspect-[21/9] tv:aspect-[24/9] w-full">
            {hero.poster && (
              <img
                src={hero.poster}
                alt={hero.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            {/* Gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,hsl(var(--primary)/0.15),transparent_60%)]" />

            {/* Content */}
            <div className="relative z-10 h-full flex flex-col justify-end p-4 sm:p-8 tv:p-12 max-w-2xl">
              <span className="text-xs sm:text-sm uppercase tracking-widest text-primary/90 font-semibold mb-2">
                Em destaque
              </span>
              <h2 className="text-2xl sm:text-4xl tv:text-6xl font-bold text-foreground leading-tight tracking-tight line-clamp-2">
                {hero.name}
              </h2>
              <p className="text-xs sm:text-sm tv:text-base text-muted-foreground mt-2 sm:mt-3">
                {hero.year ? `${hero.year} • ` : ""}{hero.genre}
              </p>
              <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
                <button
                  onClick={() => setSelectedItem(hero)}
                  className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-foreground text-background text-xs sm:text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity tv-focus"
                >
                  <Play className="w-4 h-4 fill-background" />
                  Assistir
                </button>
                <button
                  onClick={() => setSelectedItem(hero)}
                  className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-card/80 backdrop-blur text-foreground text-xs sm:text-sm font-medium hover:bg-surface-hover transition-colors tv-focus border border-border/50"
                >
                  Mais info
                </button>
              </div>
            </div>

            {/* Hero indicators */}
            {featuredItems.length > 1 && (
              <div className="absolute bottom-3 right-4 sm:bottom-4 sm:right-8 flex gap-1.5 z-10">
                {featuredItems.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setHeroIndex(i)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === heroIndex ? "w-6 bg-primary" : "w-1.5 bg-foreground/30 hover:bg-foreground/50"
                    )}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.section>
      )}

      {/* CATEGORIAS — colored tiles */}
      {!isFiltering && genres.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg tv:text-2xl font-semibold text-foreground tracking-tight">
              Categorias
            </h3>
            <span className="text-xs text-muted-foreground">{genres.length} no total</span>
          </div>
          <div className="flex gap-3 sm:gap-4 overflow-x-auto carousel-scroll -mx-1 px-1 pb-2 snap-x">
            {genres.map((g) => {
              const count = itemsByGenre.get(g)?.length || 0;
              const grad = CATEGORY_GRADIENTS[hashIndex(g, CATEGORY_GRADIENTS.length)];
              return (
                <button
                  key={g}
                  onClick={() => { setSelectedGenre(g); scrollToGrid(); }}
                  className={cn(
                    "shrink-0 snap-start text-left tv-focus rounded-xl overflow-hidden",
                    "w-40 sm:w-52 tv:w-64 h-24 sm:h-28 tv:h-36",
                    "bg-gradient-to-br shadow-lg",
                    "hover:scale-[1.04] focus-visible:scale-[1.04] transition-transform duration-300",
                    grad
                  )}
                >
                  <div className="relative w-full h-full p-3 sm:p-4 flex flex-col justify-between">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.2),transparent_60%)]" />
                    <p className="relative text-sm sm:text-base font-bold text-white tracking-tight line-clamp-2 drop-shadow">
                      {g}
                    </p>
                    <p className="relative text-[10px] sm:text-xs text-white/80 font-medium">
                      {count} {title.toLowerCase()}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* RECENTES */}
      {!isFiltering && latestItems.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg tv:text-2xl font-semibold text-foreground tracking-tight">
              Recém adicionados
            </h3>
          </div>
          <div className="flex gap-2.5 sm:gap-3 tv:gap-4 overflow-x-auto carousel-scroll -mx-1 px-1 pb-2 snap-x">
            {latestItems.map((item, index) => (
              <div key={item.id} className="shrink-0 snap-start w-28 sm:w-36 tv:w-44">
                <VodCard item={item} index={index} onClick={setSelectedItem} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* GRID — quando filtrando ou todos os títulos */}
      <section ref={gridRef}>
        <div className="flex items-end justify-between mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg tv:text-2xl font-semibold text-foreground tracking-tight">
            {selectedGenre ? selectedGenre : search.trim() ? "Resultados" : `Todos os ${title.toLowerCase()}`}
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{filtered.length} títulos</span>
            {(selectedGenre || search) && (
              <button
                onClick={() => { setSelectedGenre(null); setSearch(""); }}
                className="text-xs text-primary hover:text-primary/80 tv-focus flex items-center gap-1"
              >
                Limpar <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className={cn(
          "grid gap-2.5 sm:gap-3 tv:gap-4",
          "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8",
          isTvMode && "tv:grid-cols-6 2xl:grid-cols-8"
        )}>
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
      </section>
    </div>
  );
};

export default VodGridView;
