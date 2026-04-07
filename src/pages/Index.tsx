import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import DashboardView from "@/components/DashboardView";
import LiveView from "@/components/LiveView";
import VodGridView from "@/components/VodGridView";
import FavoritesView from "@/components/FavoritesView";
import SettingsView from "@/components/SettingsView";
import PlayerView from "@/components/PlayerView";
import VodDetailView from "@/components/VodDetailView";
import SeriesDetailView from "@/components/SeriesDetailView";
import DeviceModeSelector from "@/components/DeviceModeSelector";
import ExitDialog from "@/components/ExitDialog";
import { liveChannels as mockLiveChannels, movies as mockMovies, series as mockSeries } from "@/lib/mock-data";
import type { Channel, VodItem, Episode } from "@/lib/mock-data";
import { useCatalog } from "@/hooks/use-catalog";
import { getDeviceMode, setDeviceMode, type DeviceMode } from "@/lib/device-mode";

export const DeviceModeContext = createContext<DeviceMode>("mobile");
export const useDeviceMode = () => useContext(DeviceModeContext);

const Index = () => {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [globalSearch, setGlobalSearch] = useState("");
  const [playingChannel, setPlayingChannel] = useState<Channel | null>(null);
  const [playingEpisodeKey, setPlayingEpisodeKey] = useState<string | null>(null);
  const [playingIsVod, setPlayingIsVod] = useState(false);
  const [selectedItem, setSelectedItem] = useState<VodItem | null>(null);
  const [returnToItem, setReturnToItem] = useState<VodItem | null>(null);
  const [deviceMode, setDeviceModeState] = useState<DeviceMode | null>(getDeviceMode());
  const [showExitDialog, setShowExitDialog] = useState(false);
  const { catalog, hasCustomCatalog } = useCatalog();

  const liveItems = useMemo(() => (hasCustomCatalog ? catalog.live : mockLiveChannels), [catalog.live, hasCustomCatalog]);
  const movieItems = useMemo(() => (hasCustomCatalog ? catalog.movies : mockMovies), [catalog.movies, hasCustomCatalog]);
  const seriesItems = useMemo(() => (hasCustomCatalog ? catalog.series : mockSeries), [catalog.series, hasCustomCatalog]);

  const handleSelectMode = (mode: DeviceMode) => {
    setDeviceMode(mode);
    setDeviceModeState(mode);
  };

  // Back button / popstate handling
  const handleBack = useCallback(() => {
    if (playingChannel) {
      setPlayingChannel(null);
      setPlayingEpisodeKey(null);
      setPlayingIsVod(false);
      return;
    }
    if (selectedItem) {
      setSelectedItem(null);
      return;
    }
    if (activeSection !== "dashboard") {
      setActiveSection("dashboard");
      return;
    }
    // On dashboard — show exit dialog
    setShowExitDialog(true);
  }, [playingChannel, selectedItem, activeSection]);

  useEffect(() => {
    // Push a dummy history state so back button doesn't close the tab
    const pushState = () => {
      window.history.pushState({ darkIptv: true }, "");
    };
    pushState();

    const onPopState = (e: PopStateEvent) => {
      // Re-push to keep history alive
      pushState();
      handleBack();
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [handleBack]);

  // Handle hardware back button via keydown (Android TV, Fire TV)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Backspace" || e.key === "GoBack" || e.key === "XF86Back") {
        e.preventDefault();
        handleBack();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleBack]);

  if (!deviceMode) {
    return <DeviceModeSelector onSelect={handleSelectMode} />;
  }

  const handlePlayVod = (item: VodItem) => {
    if (!item.streamUrl) return;
    const asChannel: Channel = { id: item.id, name: item.name, logo: item.poster, group: item.genre, url: item.streamUrl };
    setSelectedItem(null);
    setPlayingEpisodeKey(null);
    setPlayingIsVod(true);
    setPlayingChannel(asChannel);
  };

  const handlePlayEpisode = (item: VodItem, episode: Episode, seasonNumber: number) => {
    if (!episode.streamUrl) return;
    const epKey = `${item.id}-S${String(seasonNumber).padStart(2, "0")}E${String(episode.episodeNum).padStart(2, "0")}`;
    const asChannel: Channel = { id: episode.id, name: `${item.name} - T${seasonNumber} E${episode.episodeNum}`, logo: item.poster, group: item.genre, url: episode.streamUrl };
    setSelectedItem(null);
    setPlayingEpisodeKey(epKey);
    setPlayingIsVod(true);
    setPlayingChannel(asChannel);
  };

  const handleSelectItem = (item: VodItem) => {
    setSelectedItem(item);
  };

  const handleSectionChange = (section: string) => {
    setPlayingChannel(null);
    setSelectedItem(null);
    setActiveSection(section);
  };

  const handlePlayChannel = (channel: Channel) => {
    setSelectedItem(null);
    setPlayingEpisodeKey(null);
    setPlayingIsVod(false);
    setPlayingChannel(channel);
  };

  const renderContent = () => {
    if (playingChannel) {
      return (
        <PlayerView
          channel={playingChannel}
          onBack={() => { setPlayingChannel(null); setPlayingEpisodeKey(null); setPlayingIsVod(false); }}
          episodeKey={playingEpisodeKey}
          isVod={playingIsVod}
        />
      );
    }

    if (selectedItem) {
      if (selectedItem.type === "series") {
        return <SeriesDetailView item={selectedItem} onBack={() => setSelectedItem(null)} onPlayEpisode={handlePlayEpisode} />;
      }
      return <VodDetailView item={selectedItem} onBack={() => setSelectedItem(null)} onPlay={handlePlayVod} />;
    }

    switch (activeSection) {
      case "dashboard":
        return (
          <DashboardView
            onNavigate={handleSectionChange}
            onPlayChannel={handlePlayChannel}
            onPlayVod={handlePlayVod}
            onSelectItem={handleSelectItem}
            liveChannels={liveItems}
            movieItems={movieItems}
            seriesItems={seriesItems}
          />
        );
      case "live":
        return <LiveView channels={liveItems} />;
      case "movies":
        return <VodGridView title="Filmes" items={movieItems} onPlayVod={handlePlayVod} onPlayEpisode={handlePlayEpisode} />;
      case "series":
        return <VodGridView title="Séries" items={seriesItems} onPlayVod={handlePlayVod} onPlayEpisode={handlePlayEpisode} />;
      case "favorites":
        return (
          <FavoritesView
            liveChannels={liveItems}
            movieItems={movieItems}
            seriesItems={seriesItems}
            onPlayChannel={handlePlayChannel}
            onSelectItem={handleSelectItem}
          />
        );
      case "settings":
        return <SettingsView />;
      default:
        return (
          <DashboardView
            onNavigate={handleSectionChange}
            onPlayChannel={handlePlayChannel}
            onPlayVod={handlePlayVod}
            onSelectItem={handleSelectItem}
            liveChannels={liveItems}
            movieItems={movieItems}
            seriesItems={seriesItems}
          />
        );
    }
  };

  return (
    <DeviceModeContext.Provider value={deviceMode}>
      <div className="min-h-screen bg-background" data-device={deviceMode}>
        <TopNav
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          globalSearch={globalSearch}
          onSearchChange={setGlobalSearch}
        />

        <main className="pt-14 md:pt-16 pb-20 md:pb-6">
          <div className="px-3 sm:px-4 md:px-8 lg:px-12 tv:px-16">
            {renderContent()}
          </div>
        </main>

        {deviceMode === "mobile" && (
          <BottomNav activeSection={activeSection} onSectionChange={handleSectionChange} />
        )}

        {showExitDialog && (
          <ExitDialog
            onConfirm={() => window.close()}
            onCancel={() => setShowExitDialog(false)}
          />
        )}
      </div>
    </DeviceModeContext.Provider>
  );
};

export default Index;
