import React, { createContext, lazy, Suspense, useContext, useEffect, useMemo, useState, useCallback } from "react";
import TopNav from "@/components/TopNav";
import LauncherHome from "@/components/LauncherHome";
import DeviceModeSelector from "@/components/DeviceModeSelector";
import ExitDialog from "@/components/ExitDialog";

// Lazy-loaded heavy views (split bundles for faster startup on TV/mobile)
const DashboardView = lazy(() => import("@/components/DashboardView"));
const LiveView = lazy(() => import("@/components/LiveView"));
const VodGridView = lazy(() => import("@/components/VodGridView"));
const FavoritesView = lazy(() => import("@/components/FavoritesView"));
const SettingsView = lazy(() => import("@/components/SettingsView"));
const PlayerView = lazy(() => import("@/components/PlayerView"));
const VodDetailView = lazy(() => import("@/components/VodDetailView"));
const SeriesDetailView = lazy(() => import("@/components/SeriesDetailView"));

const ViewFallback = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
);
import { liveChannels as mockLiveChannels, movies as mockMovies, series as mockSeries } from "@/lib/mock-data";
import type { Channel, VodItem, Episode } from "@/lib/mock-data";
import { useCatalog } from "@/hooks/use-catalog";
import { getDeviceMode, setDeviceMode, type DeviceMode } from "@/lib/device-mode";
import { useSpatialNavigation } from "@/hooks/use-spatial-navigation";
import { getPreferences, clearAppCache } from "@/lib/app-preferences";

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
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
  // Track current series episode info for auto-next
  const [playingSeriesInfo, setPlayingSeriesInfo] = useState<{ item: VodItem; seasonNumber: number; episodeNum: number } | null>(null);
  const { catalog, hasCustomCatalog } = useCatalog();

  // Enable D-pad spatial navigation in TV mode
  useSpatialNavigation(deviceMode === "tv");

  // Apply boot-time preferences (auto-clear cache)
  useEffect(() => {
    if (getPreferences().autoClearCache) {
      clearAppCache();
    }
  }, []);

  const liveItems = useMemo(() => (hasCustomCatalog ? catalog.live : mockLiveChannels), [catalog.live, hasCustomCatalog]);
  const movieItems = useMemo(() => (hasCustomCatalog ? catalog.movies : mockMovies), [catalog.movies, hasCustomCatalog]);
  const seriesItems = useMemo(() => (hasCustomCatalog ? catalog.series : mockSeries), [catalog.series, hasCustomCatalog]);

  const handleSelectMode = (mode: DeviceMode) => {
    setDeviceMode(mode);
    setDeviceModeState(mode);
  };

  // Back button / popstate handling
  const handleBack = useCallback(() => {
    if (playingChannel && !isMiniPlayer) {
      // TV mode: close player completely (no PiP). Mobile: minimize to mini-player.
      if (deviceMode === "tv") {
        setPlayingChannel(null);
        setPlayingEpisodeKey(null);
        setPlayingIsVod(false);
        setPlayingSeriesInfo(null);
        setIsMiniPlayer(false);
        if (returnToItem) {
          setSelectedItem(returnToItem);
          setReturnToItem(null);
        } else if (!playingIsVod) {
          setActiveSection("live");
        }
        return;
      }
      setIsMiniPlayer(true);
      if (returnToItem) {
        setSelectedItem(returnToItem);
      } else if (!playingIsVod) {
        setActiveSection("live");
      }
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
  }, [playingChannel, isMiniPlayer, selectedItem, activeSection, returnToItem, playingIsVod]);

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
      const target = e.target as HTMLElement | null;
      const active = document.activeElement as HTMLElement | null;
      const isEditable = (el: HTMLElement | null) => !!el && (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        el.isContentEditable ||
        el.getAttribute("role") === "textbox"
      );

      if (isEditable(target) || isEditable(active)) return;

      // TV remote back keys (Android TV, Fire TV, Tizen, WebOS, etc.)
      const isTvBackKey =
        e.key === "GoBack" ||
        e.key === "XF86Back" ||
        e.key === "BrowserBack" ||
        e.keyCode === 10009 || // Tizen (Samsung)
        e.keyCode === 461 ||   // WebOS (LG)
        e.keyCode === 166 ||   // Some Android TV
        e.keyCode === 4;       // Android KEYCODE_BACK

      // Only treat Escape/Backspace as "back" when in TV mode (so mobile typing stays intact)
      const isTvModeBack = deviceMode === "tv" && (e.key === "Escape" || e.key === "Backspace");

      if (isTvBackKey || isTvModeBack) {
        e.preventDefault();
        e.stopPropagation();
        handleBack();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deviceMode, handleBack]);

  // Auto-next episode handler (must be before early return)
  const handlePlayerEnded = useCallback(() => {
    if (playingSeriesInfo) {
      const { item, seasonNumber, episodeNum } = playingSeriesInfo;
      const seasons = item.seasons || [];
      const currentSeason = seasons.find((s) => s.seasonNumber === seasonNumber);
      if (currentSeason) {
        const nextEp = currentSeason.episodes.find((e) => e.episodeNum === episodeNum + 1);
        if (nextEp && nextEp.streamUrl) {
          const epKey = `${item.id}-S${String(seasonNumber).padStart(2, "0")}E${String(nextEp.episodeNum).padStart(2, "0")}`;
          const asChannel: Channel = { id: nextEp.id, name: `${item.name} - T${seasonNumber} E${nextEp.episodeNum}`, logo: item.poster, group: item.genre, url: nextEp.streamUrl };
          setReturnToItem(item);
          setPlayingEpisodeKey(epKey);
          setPlayingIsVod(true);
          setPlayingChannel(asChannel);
          setPlayingSeriesInfo({ item, seasonNumber, episodeNum: nextEp.episodeNum });
          return;
        }
        const nextSeason = seasons.find((s) => s.seasonNumber === seasonNumber + 1);
        if (nextSeason && nextSeason.episodes.length > 0 && nextSeason.episodes[0].streamUrl) {
          const ep = nextSeason.episodes[0];
          const epKey = `${item.id}-S${String(nextSeason.seasonNumber).padStart(2, "0")}E${String(ep.episodeNum).padStart(2, "0")}`;
          const asChannel: Channel = { id: ep.id, name: `${item.name} - T${nextSeason.seasonNumber} E${ep.episodeNum}`, logo: item.poster, group: item.genre, url: ep.streamUrl };
          setReturnToItem(item);
          setPlayingEpisodeKey(epKey);
          setPlayingIsVod(true);
          setPlayingChannel(asChannel);
          setPlayingSeriesInfo({ item, seasonNumber: nextSeason.seasonNumber, episodeNum: ep.episodeNum });
          return;
        }
      }
      setPlayingChannel(null);
      setPlayingSeriesInfo(null);
      if (returnToItem) { setSelectedItem(returnToItem); setReturnToItem(null); }
    } else if (returnToItem && returnToItem.type === "movie") {
      setPlayingChannel(null);
      setPlayingIsVod(false);
      setPlayingEpisodeKey(null);
      const sameGenre = movieItems.filter((m) => m.genre === returnToItem.genre && m.id !== returnToItem.id);
      const suggestion = sameGenre.length > 0 ? sameGenre[Math.floor(Math.random() * sameGenre.length)] : null;
      setSelectedItem(suggestion || returnToItem);
      setReturnToItem(null);
    }
  }, [playingSeriesInfo, returnToItem, movieItems]);

  if (!deviceMode) {
    return <DeviceModeSelector onSelect={handleSelectMode} />;
  }

  const handlePlayVod = (item: VodItem) => {
    if (!item.streamUrl) return;
    const asChannel: Channel = { id: item.id, name: item.name, logo: item.poster, group: item.genre, url: item.streamUrl };
    setReturnToItem(item);
    setSelectedItem(null);
    setPlayingEpisodeKey(null);
    setPlayingIsVod(true);
    setPlayingChannel(asChannel);
    setPlayingSeriesInfo(null);
    setIsMiniPlayer(false);
  };

  const handlePlayEpisode = (item: VodItem, episode: Episode, seasonNumber: number) => {
    if (!episode.streamUrl) return;
    const epKey = `${item.id}-S${String(seasonNumber).padStart(2, "0")}E${String(episode.episodeNum).padStart(2, "0")}`;
    const asChannel: Channel = { id: episode.id, name: `${item.name} - T${seasonNumber} E${episode.episodeNum}`, logo: item.poster, group: item.genre, url: episode.streamUrl };
    setReturnToItem(item);
    setSelectedItem(null);
    setPlayingEpisodeKey(epKey);
    setPlayingIsVod(true);
    setPlayingChannel(asChannel);
    setPlayingSeriesInfo({ item, seasonNumber, episodeNum: episode.episodeNum });
    setIsMiniPlayer(false);
  };

  const handleSelectItem = (item: VodItem) => {
    setSelectedItem(item);
  };

  const handleSectionChange = (section: string) => {
    // TV mode: no mini-player. Close playback when navigating away.
    if (playingChannel && !isMiniPlayer) {
      if (deviceMode === "tv") {
        setPlayingChannel(null);
        setPlayingEpisodeKey(null);
        setPlayingIsVod(false);
        setPlayingSeriesInfo(null);
        setIsMiniPlayer(false);
        setReturnToItem(null);
      } else {
        setIsMiniPlayer(true);
      }
    }
    setSelectedItem(null);
    setActiveSection(section);
  };

  const handlePlayChannel = (channel: Channel) => {
    setSelectedItem(null);
    setPlayingEpisodeKey(null);
    setPlayingIsVod(false);
    setIsMiniPlayer(false);
    setPlayingChannel(channel);
  };

  const closePlayerCompletely = () => {
    setPlayingChannel(null);
    setPlayingEpisodeKey(null);
    setPlayingIsVod(false);
    setPlayingSeriesInfo(null);
    setIsMiniPlayer(false);
    setReturnToItem(null);
  };

  const minimizePlayer = () => {
    // TV mode: no PiP — fully close the player on back.
    if (deviceMode === "tv") {
      closePlayerCompletely();
      if (returnToItem) {
        setSelectedItem(returnToItem);
        setReturnToItem(null);
      } else if (!playingIsVod) {
        setActiveSection("live");
      }
      return;
    }
    setIsMiniPlayer(true);
    if (returnToItem) {
      setSelectedItem(returnToItem);
    } else {
      if (!playingIsVod) setActiveSection("live");
    }
  };

  const expandPlayer = () => {
    setIsMiniPlayer(false);
  };

  const renderContent = () => {
    if (playingChannel && !isMiniPlayer) {
      return (
        <PlayerView
          channel={playingChannel}
          onBack={minimizePlayer}
          episodeKey={playingEpisodeKey}
          isVod={playingIsVod}
          isSeries={!!playingSeriesInfo}
          onEnded={handlePlayerEnded}
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
          <LauncherHome
            onNavigate={handleSectionChange}
            liveChannels={liveItems}
            movieItems={movieItems}
            seriesItems={seriesItems}
          />
        );
      case "live":
        return <LiveView channels={liveItems} />;
      case "movies":
        return <VodGridView title="Filmes" items={movieItems} onPlayVod={handlePlayVod} onPlayEpisode={handlePlayEpisode} onBack={() => setActiveSection("dashboard")} />;
      case "series":
        return <VodGridView title="Séries" items={seriesItems} onPlayVod={handlePlayVod} onPlayEpisode={handlePlayEpisode} onBack={() => setActiveSection("dashboard")} />;
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

        <main className="pt-14 md:pt-16 pb-6">
          <div className="px-3 sm:px-4 md:px-8 lg:px-12 tv:px-16">
            <Suspense fallback={<ViewFallback />}>{renderContent()}</Suspense>
          </div>
        </main>

        {/* Floating back button for sections without their own header */}
        {!playingChannel && !selectedItem && (activeSection === "live" || activeSection === "favorites" || activeSection === "settings") && (
          <button
            onClick={() => setActiveSection("dashboard")}
            className="fixed top-3 md:top-4 left-3 md:left-6 z-40 w-10 h-10 md:w-11 md:h-11 rounded-full bg-card/80 backdrop-blur-xl border border-border/50 flex items-center justify-center hover:bg-surface-hover transition-colors tv-focus shadow-lg"
            aria-label="Voltar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          </button>
        )}

        {/* Floating mini-player — keeps content playing while user navigates */}
        {playingChannel && isMiniPlayer && deviceMode !== "tv" && (
          <PlayerView
            channel={playingChannel}
            onBack={closePlayerCompletely}
            episodeKey={playingEpisodeKey}
            isVod={playingIsVod}
            isSeries={!!playingSeriesInfo}
            onEnded={handlePlayerEnded}
            isMini
            onExpand={expandPlayer}
            onCloseMini={closePlayerCompletely}
          />
        )}

        {showExitDialog && (
          <ExitDialog
            onConfirm={async () => {
              try {
                const { App } = await import("@capacitor/app");
                await App.exitApp();
              } catch {
                // Web fallback
                try { window.close(); } catch {}
                // Some browsers block window.close() — go back in history as fallback
                setTimeout(() => window.history.back(), 100);
              }
            }}
            onCancel={() => setShowExitDialog(false)}
          />
        )}
      </div>
    </DeviceModeContext.Provider>
  );
};

export default Index;
