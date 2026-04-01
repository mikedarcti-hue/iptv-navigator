import { useEffect, useMemo, useState } from "react";
import ChannelRow from "./ChannelRow";
import PlayerView from "./PlayerView";
import type { Channel } from "@/lib/mock-data";
import { Search, X } from "lucide-react";

interface LiveViewProps {
  channels: Channel[];
}

const INITIAL = 200;
const STEP = 200;

const LiveView = ({ channels }: LiveViewProps) => {
  const [search, setSearch] = useState("");
  const [playing, setPlaying] = useState<Channel | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return channels
      .filter((c) => !t || c.name.toLowerCase().includes(t) || c.group.toLowerCase().includes(t))
      .sort((a, b) => a.group.localeCompare(b.group, "pt-BR") || a.name.localeCompare(b.name, "pt-BR"));
  }, [channels, search]);

  const grouped = useMemo(() =>
    filtered.slice(0, visibleCount).reduce<Record<string, Channel[]>>((g, c) => {
      (g[c.group] ??= []).push(c);
      return g;
    }, {}), [filtered, visibleCount]);

  useEffect(() => setVisibleCount(INITIAL), [channels, search]);

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
