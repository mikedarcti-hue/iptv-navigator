import { useState, useMemo } from "react";
import ChannelRow from "./ChannelRow";
import { liveChannels } from "@/lib/mock-data";
import SearchBar from "./SearchBar";

const LiveView = () => {
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const filtered = liveChannels.filter(
      (ch) =>
        ch.name.toLowerCase().includes(search.toLowerCase()) ||
        ch.group.toLowerCase().includes(search.toLowerCase())
    );
    return filtered.reduce<Record<string, typeof liveChannels>>((acc, ch) => {
      (acc[ch.group] ??= []).push(ch);
      return acc;
    }, {});
  }, [search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Canais ao Vivo</h1>
        <p className="text-sm text-muted-foreground mt-1">{liveChannels.length} canais disponíveis</p>
      </div>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar canais..." />
      <div className="space-y-6">
        {Object.entries(groups).map(([group, channels]) => (
          <section key={group}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              {group}
            </h3>
            <div className="space-y-1">
              {channels.map((ch, i) => (
                <ChannelRow key={ch.id} channel={ch} index={i} />
              ))}
            </div>
          </section>
        ))}
        {Object.keys(groups).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">Nenhum canal encontrado.</p>
        )}
      </div>
    </div>
  );
};

export default LiveView;
