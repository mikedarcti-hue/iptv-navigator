import { useState, useMemo } from "react";
import ChannelRow from "./ChannelRow";
import { useChannels } from "@/hooks/use-channels";
import { liveChannels as mockChannels } from "@/lib/mock-data";
import SearchBar from "./SearchBar";
import PlayerView from "./PlayerView";
import type { Channel } from "@/lib/mock-data";

const LiveView = () => {
  const [search, setSearch] = useState("");
  const [playing, setPlaying] = useState<Channel | null>(null);
  const { channels: storedChannels } = useChannels();

  const channels = storedChannels.length > 0 ? storedChannels : mockChannels;

  const groups = useMemo(() => {
    const filtered = channels.filter(
      (ch) =>
        ch.name.toLowerCase().includes(search.toLowerCase()) ||
        ch.group.toLowerCase().includes(search.toLowerCase())
    );
    return filtered.reduce<Record<string, Channel[]>>((acc, ch) => {
      (acc[ch.group] ??= []).push(ch);
      return acc;
    }, {});
  }, [search, channels]);

  if (playing) {
    return <PlayerView channel={playing} onBack={() => setPlaying(null)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Canais ao Vivo</h1>
        <p className="text-sm text-muted-foreground mt-1">{channels.length} canais disponíveis</p>
      </div>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar canais..." />
      <div className="space-y-6">
        {Object.entries(groups).map(([group, groupChannels]) => (
          <section key={group}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              {group}
            </h3>
            <div className="space-y-1">
              {groupChannels.map((ch, i) => (
                <ChannelRow key={ch.id} channel={ch} index={i} onPlay={() => setPlaying(ch)} />
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
