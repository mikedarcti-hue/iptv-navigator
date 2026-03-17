import { useEffect, useMemo, useState } from "react";
import ChannelRow from "./ChannelRow";
import SearchBar from "./SearchBar";
import PlayerView from "./PlayerView";
import type { Channel } from "@/lib/mock-data";

interface LiveViewProps {
  channels: Channel[];
}

const INITIAL_VISIBLE_CHANNELS = 200;
const LOAD_MORE_STEP = 200;

const LiveView = ({ channels }: LiveViewProps) => {
  const [search, setSearch] = useState("");
  const [playing, setPlaying] = useState<Channel | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_CHANNELS);

  const filteredChannels = useMemo(() => {
    const term = search.trim().toLowerCase();

    return channels
      .filter((channel) => {
        if (!term) return true;
        return channel.name.toLowerCase().includes(term) || channel.group.toLowerCase().includes(term);
      })
      .sort((a, b) => a.group.localeCompare(b.group, "pt-BR") || a.name.localeCompare(b.name, "pt-BR"));
  }, [channels, search]);

  const groupedChannels = useMemo(() => {
    return filteredChannels
      .slice(0, visibleCount)
      .reduce<Record<string, Channel[]>>((groups, channel) => {
        (groups[channel.group] ??= []).push(channel);
        return groups;
      }, {});
  }, [filteredChannels, visibleCount]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_CHANNELS);
  }, [channels, search]);

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

      {channels.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Configure e sincronize sua lista para carregar os canais ao vivo.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedChannels).map(([group, groupItems]) => (
            <section key={group}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">{group}</h3>
              <div className="space-y-1">
                {groupItems.map((channel, index) => (
                  <ChannelRow key={channel.id} channel={channel} index={index} onPlay={() => setPlaying(channel)} />
                ))}
              </div>
            </section>
          ))}

          {filteredChannels.length > visibleCount && (
            <button
              onClick={() => setVisibleCount((current) => current + LOAD_MORE_STEP)}
              className="w-full rounded-xl border border-border bg-surface py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
            >
              Carregar mais canais
            </button>
          )}

          {filteredChannels.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhum canal encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default LiveView;
