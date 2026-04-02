import { useEffect, useMemo, useState } from "react";
import ChannelRow from "./ChannelRow";
import PlayerView from "./PlayerView";
import type { Channel } from "@/lib/mock-data";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveViewProps {
  channels: Channel[];
}

const INITIAL = 200;
const STEP = 200;

const LiveView = ({ channels }: LiveViewProps) => {
  const [search, setSearch] = useState("");
  const [playing, setPlaying] = useState<Channel | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return channels
      .filter((c) => !t || c.name.toLowerCase().includes(t) || c.group.toLowerCase().includes(t))
      .filter((c) => !selectedCategory || c.group === selectedCategory)
      .sort((a, b) => a.group.localeCompare(b.group, "pt-BR") || a.name.localeCompare(b.name, "pt-BR"));
  }, [channels, search, selectedCategory]);

  const categories = useMemo(() => {
    const groups = [...new Set(channels.map((c) => c.group))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return groups;
  }, [channels]);

  const grouped = useMemo(() =>
    filtered.slice(0, visibleCount).reduce<Record<string, Channel[]>>((g, c) => {
      (g[c.group] ??= []).push(c);
      return g;
    }, {}), [filtered, visibleCount]);

  useEffect(() => setVisibleCount(INITIAL), [channels, search, selectedCategory]);

  if (playing) return <PlayerView channel={playing} onBack={() => setPlaying(null)} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Canais ao Vivo</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{channels.length} canais</p>
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-card border border-border/50">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar canais..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        {search && <button onClick={() => setSearch("")}><X className="w-4 h-4 text-muted-foreground" /></button>}
      </div>

      {/* Category filters */}
      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto carousel-scroll pb-1">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              !selectedCategory ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            Todos ({channels.length})
          </button>
          {categories.map((cat) => {
            const count = channels.filter((c) => c.group === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  selectedCategory === cat ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {channels.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-16">Configure sua lista para carregar canais ao vivo.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([group, items]) => (
            <section key={group}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{group}</h3>
              <div className="space-y-0.5">
                {items.map((c, i) => <ChannelRow key={c.id} channel={c} index={i} onPlay={() => setPlaying(c)} />)}
              </div>
            </section>
          ))}
          {filtered.length > visibleCount && (
            <button
              onClick={() => setVisibleCount((c) => c + STEP)}
              className="w-full py-3 rounded-lg bg-card text-sm font-medium text-foreground hover:bg-surface-hover transition-colors border border-border/30"
            >
              Carregar mais canais
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default LiveView;
