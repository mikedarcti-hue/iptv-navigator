import React, { useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import SearchBar from "@/components/SearchBar";
import DashboardView from "@/components/DashboardView";
import LiveView from "@/components/LiveView";
import VodGridView from "@/components/VodGridView";
import FavoritesView from "@/components/FavoritesView";
import SettingsView from "@/components/SettingsView";
import PlayerView from "@/components/PlayerView";
import { liveChannels as mockLiveChannels, movies as mockMovies, series as mockSeries } from "@/lib/mock-data";
import type { Channel, VodItem, Episode } from "@/lib/mock-data";
import { useCatalog } from "@/hooks/use-catalog";

const Index = () => {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [globalSearch, setGlobalSearch] = useState("");
  const [playingChannel, setPlayingChannel] = useState<Channel | null>(null);
  const [playingEpisodeKey, setPlayingEpisodeKey] = useState<string | null>(null);
  const [playingIsVod, setPlayingIsVod] = useState(false);
  const { catalog, hasCustomCatalog } = useCatalog();

  const liveItems = useMemo(() => (hasCustomCatalog ? catalog.live : mockLiveChannels), [catalog.live, hasCustomCatalog]);
  const movieItems = useMemo(() => (hasCustomCatalog ? catalog.movies : mockMovies), [catalog.movies, hasCustomCatalog]);
  const seriesItems = useMemo(() => (hasCustomCatalog ? catalog.series : mockSeries), [catalog.series, hasCustomCatalog]);

  const handlePlayVod = (item: VodItem) => {
    if (!item.streamUrl) return;
    const asChannel: Channel = {
      id: item.id,
      name: item.name,
      logo: item.poster,
      group: item.genre,
      url: item.streamUrl,
    };
    setPlayingEpisodeKey(null);
    setPlayingIsVod(true);
    setPlayingChannel(asChannel);
  };

  const handlePlayEpisode = (item: VodItem, episode: Episode, seasonNumber: number) => {
    if (!episode.streamUrl) return;
    const epKey = `${item.id}-S${String(seasonNumber).padStart(2, "0")}E${String(episode.episodeNum).padStart(2, "0")}`;
    const asChannel: Channel = {
      id: episode.id,
      name: `${item.name} - T${seasonNumber} E${episode.episodeNum}`,
      logo: item.poster,
      group: item.genre,
      url: episode.streamUrl,
    };
    setPlayingEpisodeKey(epKey);
    setPlayingIsVod(true);
    setPlayingChannel(asChannel);
  };

  const renderContent = () => {
    if (playingChannel) {
      return <PlayerView channel={playingChannel} onBack={() => { setPlayingChannel(null); setPlayingEpisodeKey(null); setPlayingIsVod(false); }} episodeKey={playingEpisodeKey} isVod={playingIsVod} />;
    }

    switch (activeSection) {
      case "dashboard":
        return (
          <DashboardView
            onNavigate={setActiveSection}
            onPlayChannel={setPlayingChannel}
            liveChannels={liveItems}
            movieItems={movieItems}
            seriesItems={seriesItems}
          />
        );
      case "live":
        return <LiveView channels={liveItems} />;
      case "movies":
        return <VodGridView title="Filmes" items={movieItems} onPlayVod={handlePlayVod} />;
      case "series":
        return <VodGridView title="Séries" items={seriesItems} onPlayVod={handlePlayVod} onPlayEpisode={handlePlayEpisode} />;
      case "favorites":
        return <FavoritesView />;
      case "settings":
        return <SettingsView />;
      default:
        return (
          <DashboardView
            onNavigate={setActiveSection}
            onPlayChannel={setPlayingChannel}
            liveChannels={liveItems}
            movieItems={movieItems}
            seriesItems={seriesItems}
          />
        );
    }
  };

  const handleSectionChange = (section: string) => {
    setPlayingChannel(null);
    setActiveSection(section);
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeSection={activeSection} onSectionChange={handleSectionChange} />

      <main className="ml-20 lg:ml-64 min-h-screen">
        <header className="sticky top-0 z-40 h-20 flex items-center px-6 lg:px-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="w-full max-w-xl">
            <SearchBar value={globalSearch} onChange={setGlobalSearch} />
          </div>
        </header>

        <div className="p-6 lg:p-10">{renderContent()}</div>
      </main>
    </div>
  );
};

export default Index;
