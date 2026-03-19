import { ArrowLeft, Play, Star, Calendar, Clock, User, Clapperboard, CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import type { VodItem, Season, Episode } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { getProgress, getSeriesProgress } from "@/lib/watch-progress";
import { supabase } from "@/integrations/supabase/client";

interface SeriesDetailViewProps {
  item: VodItem;
  onBack: () => void;
  onPlayEpisode: (item: VodItem, episode: Episode, seasonNumber: number) => void;
}

const SeriesDetailView = ({ item, onBack, onPlayEpisode }: SeriesDetailViewProps) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [seasons, setSeasons] = useState<Season[]>(item.seasons || []);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchSeriesInfo = useCallback(async () => {
    if (seasons.length > 0 || !item.seriesId) return;

    // Try to load from stored server config
    const storedConfig = localStorage.getItem("obsidian_server_config");
    if (!storedConfig) return;

    try {
      setLoading(true);
      const config = JSON.parse(storedConfig);
      if (config.type !== "xtream") return;

      const { data, error } = await supabase.functions.invoke("iptv-proxy", {
        body: {
          action: "fetch_xtream_series_info",
          server: config.xtreamUrl,
          username: config.xtreamUser,
          password: config.xtreamPass,
          seriesId: item.seriesId,
        },
      });

      if (!error && data?.success && data.seasons) {
        setSeasons(data.seasons);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [item.seriesId, seasons.length]);

  useEffect(() => {
    fetchSeriesInfo();
  }, [fetchSeriesInfo]);

  const currentSeasonData = seasons.find((s) => s.seasonNumber === selectedSeason);
  const episodes = currentSeasonData?.episodes || [];

  // Find where the user left off
  const lastProgress = getSeriesProgress(item.id);

  const synopsis = item.synopsis || "Sinopse não disponível para este título.";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden card-shadow">
        <div className="absolute inset-0">
          <img src={item.poster} alt="" className="w-full h-full object-cover blur-2xl scale-110 opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/60" />
        </div>

        <div className="relative flex flex-col md:flex-row gap-8 p-6 md:p-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="shrink-0 w-48 md:w-56 mx-auto md:mx-0"
          >
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden card-shadow">
              {!imgLoaded && (
                <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface-hover to-surface animate-pulse" />
              )}
              <img
                src={item.poster}
                alt={item.name}
                onLoad={() => setImgLoaded(true)}
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-500",
                  imgLoaded ? "opacity-100" : "opacity-0"
                )}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex-1 flex flex-col justify-center min-w-0"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-primary/20 text-primary">SÉRIE</span>
              <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-surface text-muted-foreground">{item.genre}</span>
              {seasons.length > 0 && (
                <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-surface text-muted-foreground">
                  {seasons.length} Temporada{seasons.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight mb-3">{item.name}</h1>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-5 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-primary fill-primary" />
                <span className="font-semibold text-foreground">{item.rating}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {item.year}
              </span>
            </div>

            {item.director && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clapperboard className="w-4 h-4 shrink-0" />
                <span>Diretor: <span className="text-foreground">{item.director}</span></span>
              </p>
            )}
            {item.cast && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <User className="w-4 h-4 shrink-0" />
                <span>Elenco: <span className="text-foreground">{item.cast}</span></span>
              </p>
            )}

            <p className="text-sm text-muted-foreground leading-relaxed mb-6 line-clamp-4 md:line-clamp-none">{synopsis}</p>

            {lastProgress && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border mb-4">
                <Play className="w-5 h-5 text-primary fill-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">Continuar: {lastProgress.label}</p>
                  <Progress value={(lastProgress.currentTime / lastProgress.duration) * 100} className="h-1.5 mt-1.5" />
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Season selector + Episode list */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Carregando temporadas...</span>
        </div>
      ) : seasons.length > 0 ? (
        <div className="space-y-4">
          {/* Season tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {seasons.map((season) => (
              <button
                key={season.seasonNumber}
                onClick={() => setSelectedSeason(season.seasonNumber)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  selectedSeason === season.seasonNumber
                    ? "bg-primary/20 text-primary"
                    : "bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                )}
              >
                Temporada {season.seasonNumber}
              </button>
            ))}
          </div>

          {/* Episodes */}
          <div className="space-y-2">
            {episodes.map((ep) => {
              const epKey = `${item.id}-S${String(selectedSeason).padStart(2, "0")}E${String(ep.episodeNum).padStart(2, "0")}`;
              const progress = getProgress(epKey);
              const progressPercent = progress ? Math.min(100, (progress.currentTime / progress.duration) * 100) : 0;
              const isWatched = progressPercent > 90;

              return (
                <motion.button
                  key={ep.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => onPlayEpisode(item, ep, selectedSeason)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-surface hover:bg-surface-hover border border-border transition-all text-left group"
                >
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    {isWatched ? (
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    ) : (
                      <Play className="w-4 h-4 text-primary fill-primary group-hover:scale-110 transition-transform" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-primary">E{String(ep.episodeNum).padStart(2, "0")}</span>
                      <span className="text-sm font-medium text-foreground truncate">{ep.title || `Episódio ${ep.episodeNum}`}</span>
                    </div>
                    {ep.plot && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ep.plot}</p>
                    )}
                    {progress && progressPercent < 90 && (
                      <Progress value={progressPercent} className="h-1 mt-2" />
                    )}
                  </div>

                  {ep.duration && (
                    <div className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {ep.duration}
                    </div>
                  )}
                </motion.button>
              );
            })}

            {episodes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum episódio encontrado para esta temporada.
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          Informações de temporadas e episódios não disponíveis para esta série.
        </p>
      )}
    </motion.div>
  );
};

export default SeriesDetailView;
