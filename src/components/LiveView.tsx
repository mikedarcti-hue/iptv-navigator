import { useEffect, useMemo, useState, useRef } from "react";
import PlayerView from "./PlayerView";
import type { Channel } from "@/lib/mock-data";
import { Search, X, Play, ChevronRight, Tv, ArrowLeft, Maximize } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface LiveViewProps {
  channels: Channel[];
}

const INITIAL = 200;
const STEP = 200;

const LiveView = ({ channels }: LiveViewProps) => {
  const [search, setSearch] = useState("");
  const [playing, setPlaying] = useState<Channel | null>(null);
  const [previewing, setPreviewing] = useState<Channel | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => {
    const groups = [...new Set(channels.map((c) => c.group))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return groups.map((g) => ({
      name: g,
      count: channels.filter((c) => c.group === g).length,
    }));
  }, [channels]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const t = search.trim().toLowerCase();
    return categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(t) ||
        channels.some((c) => c.group === cat.name && c.name.toLowerCase().includes(t))
    );
  }, [categories, channels, search]);

  const categoryChannels = useMemo(() => {
    if (!selectedCategory) return [];
    const t = search.trim().toLowerCase();
    return channels
      .filter((c) => c.group === selectedCategory)
      .filter((c) => !t || c.name.toLowerCase().includes(t))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [channels, selectedCategory, search]);

  const visibleChannels = useMemo(() => categoryChannels.slice(0, visibleCount), [categoryChannels, visibleCount]);

  useEffect(() => setVisibleCount(INITIAL), [selectedCategory, search]);

  // Close preview when clicking outside
  useEffect(() => {
    if (!previewing) return;
    const handler = (e: MouseEvent) => {
      if (previewRef.current && !previewRef.current.contains(e.target as Node)) {
        setPreviewing(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [previewing]);

  if (playing) return <PlayerView channel={playing} onBack={() => setPlaying(null)} />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        {selectedCategory && (
          <button
            onClick={() => { setSelectedCategory(null); setPreviewing(null); }}
            className="w-9 h-9 rounded-full bg-card flex items-center justify-center hover:bg-surface-hover transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
        )}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            {selectedCategory || "Canais ao Vivo"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {selectedCategory
              ? `${categoryChannels.length} canais`
              : `${channels.length} canais • ${categories.length} categorias`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-card border border-border/50">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={selectedCategory ? "Buscar nesta categoria..." : "Buscar categorias..."}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        {search && (
          <button onClick={() => setSearch("")}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Category Grid (when no category selected) */}
      {!selectedCategory && (
        <AnimatePresence mode="wait">
          <motion.div
            key="categories"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
          >
            {filteredCategories.map((cat, i) => (
              <motion.button
                key={cat.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.25 }}
                onClick={() => setSelectedCategory(cat.name)}
                className="group relative flex flex-col items-center justify-center gap-2 p-5 rounded-xl bg-card border border-border/30 hover:border-primary/50 hover:bg-surface-hover transition-all cursor-pointer tv-focus"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Tv className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground text-center truncate w-full">
                  {cat.name}
                </span>
                <span className="text-xs text-muted-foreground">{cat.count} canais</span>
                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.button>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Channel List (when category selected) */}
      {selectedCategory && (
        <AnimatePresence mode="wait">
          <motion.div
            key="channels"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-1"
          >
            {/* Mini Preview */}
            <AnimatePresence>
              {previewing && (
                <motion.div
                  ref={previewRef}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="mb-4 rounded-xl overflow-hidden bg-card border border-border/50 card-shadow"
                >
                  <div className="aspect-video max-h-[280px] sm:max-h-[320px] bg-black relative">
                    <PlayerView
                      ref={previewRef}
                      channel={previewing}
                      onBack={() => setPreviewing(null)}
                      isVod={false}
                    />
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{previewing.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{previewing.group}</p>
                    </div>
                    <button
                      onClick={() => setPlaying(previewing)}
                      className="shrink-0 ml-3 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      <Maximize className="w-4 h-4" />
                      Tela cheia
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {visibleChannels.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.015, 0.2), duration: 0.2 }}
                onClick={() => setPreviewing(c)}
                className={cn(
                  "group flex items-center gap-3 p-3 rounded-lg hover:bg-card/80 transition-all cursor-pointer tv-focus",
                  previewing?.id === c.id && "bg-card border border-primary/30"
                )}
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md bg-card overflow-hidden shrink-0">
                  {c.logo ? (
                    <img src={c.logo} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-muted-foreground bg-secondary">
                      {c.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.epgNow || c.group}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Play className="w-3.5 h-3.5 text-primary fill-primary" />
                </div>
              </motion.div>
            ))}

            {categoryChannels.length > visibleCount && (
              <button
                onClick={() => setVisibleCount((c) => c + STEP)}
                className="w-full py-3 rounded-lg bg-card text-sm font-medium text-foreground hover:bg-surface-hover transition-colors border border-border/30"
              >
                Carregar mais canais
              </button>
            )}

            {visibleChannels.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">Nenhum canal encontrado.</p>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {!selectedCategory && channels.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-16">Configure sua lista para carregar canais ao vivo.</p>
      )}

      {!selectedCategory && filteredCategories.length === 0 && channels.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">Nenhuma categoria encontrada.</p>
      )}
    </div>
  );
};

export default LiveView;
