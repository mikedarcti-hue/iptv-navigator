import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setProgress } from "@/lib/watch-progress";
import {
  ArrowLeft,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Cast,
} from "lucide-react";
import Hls from "hls.js";
import mpegts from "mpegts.js";
import type { Channel } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface PlayerViewProps {
  channel: Channel;
  onBack: () => void;
  episodeKey?: string | null;
}

const PlayerView = forwardRef<HTMLDivElement, PlayerViewProps>(({ channel, onBack, episodeKey }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<any>(null);
  const attemptRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const [muted, setMuted] = useState(true); // Start muted to guarantee autoplay
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("Verifique a URL do stream ou tente outro canal");
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [castAvailable, setCastAvailable] = useState(false);

  const streamCandidates = useMemo(() => {
    const candidates = [channel.url, ...(channel.streamCandidates ?? [])]
      .filter(Boolean)
      .map((url) => url.trim());
    const unique = Array.from(new Set(candidates));

    // For each URL, also add HLS attempt variant if not already HLS
    const expanded: string[] = [];
    for (const u of unique) {
      expanded.push(u);
      // Add .m3u8 variant for live streams that might support HLS
      const lower = u.toLowerCase();
      if (!lower.includes(".m3u8") && !lower.includes("output=m3u8")) {
        // Try same URL with output=m3u8 or .m3u8 extension
        if (lower.includes("/live/")) {
          const m3u8Variant = u.replace(/\.\w+$/, ".m3u8");
          if (m3u8Variant !== u) expanded.push(m3u8Variant);
        }
      }
    }

    // Add proxy URLs as last resort
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (supabaseUrl && supabaseKey) {
      const proxyUrls = unique.map((u) => {
        const proxyUrl = `${supabaseUrl}/functions/v1/iptv-proxy`;
        return `__proxy__${proxyUrl}__${u}`;
      });
      return [...Array.from(new Set(expanded)), ...proxyUrls];
    }
    return Array.from(new Set(expanded));
  }, [channel.url, channel.streamCandidates]);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3500);
  }, []);

  // Check for DLNA/Cast availability
  useEffect(() => {
    // Check if Remote Playback API is available (for Chromecast/DLNA)
    if (videoRef.current && 'remote' in videoRef.current) {
      setCastAvailable(true);
    }
  }, []);

  // Stream loading effect
  useEffect(() => {
    const video = videoRef.current;
    if (!video || streamCandidates.length === 0) {
      setError(true);
      setLoading(false);
      setErrorMessage("Nenhuma URL de stream foi encontrada para esse canal");
      return;
    }

    let active = true;
    attemptRef.current = 0;

    const cleanupPlayers = () => {
      clearTimeout(retryTimerRef.current);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (mpegtsRef.current) {
        try { mpegtsRef.current.pause(); } catch {}
        try { mpegtsRef.current.unload(); } catch {}
        try { mpegtsRef.current.detachMediaElement(); } catch {}
        try { mpegtsRef.current.destroy(); } catch {}
        mpegtsRef.current = null;
      }
      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    const failWithFallback = (message: string) => {
      if (!active) return;
      const nextAttempt = attemptRef.current + 1;
      if (nextAttempt < streamCandidates.length) {
        attemptRef.current = nextAttempt;
        // Small delay between attempts to avoid rapid-fire
        retryTimerRef.current = setTimeout(() => {
          if (active) loadCandidate(streamCandidates[nextAttempt]);
        }, 300);
        return;
      }
      setLoading(false);
      setError(true);
      setErrorMessage(message);
    };

    const tryAutoplay = (v: HTMLVideoElement) => {
      v.muted = true; // Ensure muted for autoplay policy
      const playPromise = v.play();
      if (playPromise) {
        playPromise.catch(() => {
          // If muted autoplay fails, it's a real error
          failWithFallback("O navegador bloqueou a reprodução automática");
        });
      }
    };

    const loadCandidate = (candidateUrl: string) => {
      cleanupPlayers();
      setLoading(true);
      setError(false);

      // Handle proxy URLs - streaming proxy for live
      if (candidateUrl.startsWith("__proxy__")) {
        const parts = candidateUrl.replace("__proxy__", "").split("__");
        const proxyEndpoint = parts[0];
        const originalUrl = parts.slice(1).join("__");
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        // For proxy, try to stream through HLS.js with custom loader
        const proxyStreamUrl = `${proxyEndpoint}?action=proxy_stream&streamUrl=${encodeURIComponent(originalUrl)}`;

        // Try HLS through proxy first
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            maxBufferLength: 5,
            maxMaxBufferLength: 10,
            maxBufferSize: 2 * 1024 * 1024,
            maxBufferHole: 0.5,
            liveSyncDurationCount: 2,
            liveMaxLatencyDurationCount: 5,
            liveDurationInfinity: true,
            xhrSetup: (xhr) => {
              xhr.setRequestHeader("apikey", supabaseKey);
              xhr.setRequestHeader("Authorization", `Bearer ${supabaseKey}`);
            },
          });
          hlsRef.current = hls;
          hls.attachMedia(video);
          hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(originalUrl));
          hls.on(Hls.Events.MANIFEST_PARSED, () => tryAutoplay(video));
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            hls.destroy();
            hlsRef.current = null;
            // Fall back to direct proxy fetch as blob
            fetch(proxyEndpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({ action: "proxy_stream", streamUrl: originalUrl }),
            }).then(async (res) => {
              if (!active || !res.ok || !res.body) {
                failWithFallback("Proxy não conseguiu carregar o stream");
                return;
              }
              const blob = await res.blob();
              const blobUrl = URL.createObjectURL(blob);
              video.src = blobUrl;
              tryAutoplay(video);
            }).catch(() => failWithFallback("Falha na conexão com o proxy"));
          });
          return;
        }

        // Fallback: fetch blob
        fetch(proxyEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ action: "proxy_stream", streamUrl: originalUrl }),
        }).then(async (res) => {
          if (!active || !res.ok || !res.body) {
            failWithFallback("Proxy não conseguiu carregar o stream");
            return;
          }
          const blob = await res.blob();
          video.src = URL.createObjectURL(blob);
          tryAutoplay(video);
        }).catch(() => failWithFallback("Falha na conexão com o proxy"));
        return;
      }

      const url = candidateUrl;
      const normalizedUrl = url.toLowerCase();
      const isHlsUrl = normalizedUrl.includes(".m3u8") || normalizedUrl.includes("output=m3u8");
      const isMpegTsUrl = normalizedUrl.includes(".ts") || normalizedUrl.includes("/live/");
      const isDirectVideo = /\.(mp4|mkv|avi|mov|webm)(\?|$)/.test(normalizedUrl);

      // Direct video files (VOD)
      if (isDirectVideo) {
        video.src = url;
        tryAutoplay(video);
        return;
      }

      // HLS streams
      if (isHlsUrl) {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 0,
            maxBufferLength: 5,
            maxMaxBufferLength: 10,
            maxBufferSize: 2 * 1024 * 1024,
            maxBufferHole: 0.5,
            liveSyncDurationCount: 2,
            liveMaxLatencyDurationCount: 5,
            liveDurationInfinity: true,
            startPosition: -1,
            // HEVC/H.265 support - prefer hardware decoding
            preferManagedMediaSource: true,
          });
          hlsRef.current = hls;
          hls.attachMedia(video);
          hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(url));
          hls.on(Hls.Events.MANIFEST_PARSED, () => tryAutoplay(video));
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              // Retry network errors up to 3 times
              hls.startLoad();
              return;
            }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
              return;
            }
            failWithFallback("Não foi possível abrir o stream HLS deste canal");
          });
          return;
        }
        // Safari native HLS
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          tryAutoplay(video);
          return;
        }
      }

      // MPEG-TS streams
      if (isMpegTsUrl && mpegts.getFeatureList().mseLivePlayback) {
        const player = mpegts.createPlayer(
          {
            type: "mpegts",
            isLive: true,
            url,
            hasAudio: true,
            hasVideo: true,
          },
          {
            enableWorker: true,
            enableStashBuffer: false,
            stashInitialSize: 128,
            liveBufferLatencyChasing: true,
            liveBufferLatencyMaxLatency: 3.0,
            liveBufferLatencyMinRemain: 0.5,
            lazyLoad: false,
            lazyLoadMaxDuration: 0,
            autoCleanupSourceBuffer: true,
            autoCleanupMaxBackwardDuration: 3,
            autoCleanupMinBackwardDuration: 1,
          },
        );
        mpegtsRef.current = player;
        player.attachMediaElement(video);
        player.load();

        // Wait for data before playing
        video.addEventListener("loadeddata", function onLoaded() {
          video.removeEventListener("loadeddata", onLoaded);
          tryAutoplay(video);
        }, { once: true });

        // Fallback: try play after 2s even without loadeddata
        retryTimerRef.current = setTimeout(() => tryAutoplay(video), 2000);

        player.on(mpegts.Events.ERROR, () => {
          failWithFallback("O stream MPEG-TS falhou durante a reprodução");
        });
        return;
      }

      // Unknown format: try HLS.js first (many IPTV URLs don't have extensions)
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          maxBufferLength: 5,
          maxMaxBufferLength: 10,
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 5,
          liveDurationInfinity: true,
          preferManagedMediaSource: true,
        });
        hlsRef.current = hls;
        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(url));
        hls.on(Hls.Events.MANIFEST_PARSED, () => tryAutoplay(video));
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          // HLS failed, try MPEG-TS
          hls.destroy();
          hlsRef.current = null;

          if (mpegts.getFeatureList().mseLivePlayback) {
            const tsPlayer = mpegts.createPlayer(
              { type: "mpegts", isLive: true, url, hasAudio: true, hasVideo: true },
              {
                enableWorker: true,
                enableStashBuffer: false,
                stashInitialSize: 128,
                liveBufferLatencyChasing: true,
                liveBufferLatencyMaxLatency: 3.0,
                liveBufferLatencyMinRemain: 0.5,
                autoCleanupSourceBuffer: true,
              },
            );
            mpegtsRef.current = tsPlayer;
            tsPlayer.attachMediaElement(video);
            tsPlayer.load();
            video.addEventListener("loadeddata", () => tryAutoplay(video), { once: true });
            retryTimerRef.current = setTimeout(() => tryAutoplay(video), 2000);
            tsPlayer.on(mpegts.Events.ERROR, () => {
              failWithFallback("Formato do stream não suportado");
            });
          } else {
            // Last resort: direct src
            video.src = url;
            tryAutoplay(video);
          }
        });
        return;
      }

      // Final fallback
      video.src = url;
      tryAutoplay(video);
    };

    const handlePlaying = () => { if (!active) return; setLoading(false); setError(false); setPaused(false); };
    const handleWaiting = () => { if (!active || error) return; setLoading(true); };
    const handleVideoError = () => failWithFallback("O servidor bloqueou ou interrompeu o stream deste canal");
    const handlePause = () => setPaused(true);
    const handleTimeUpdate = () => {
      if (video) {
        setCurrentTime(video.currentTime);
        setDuration(video.duration || 0);
        if (episodeKey && video.duration && video.currentTime > 0 && Math.floor(video.currentTime) % 5 === 0) {
          setProgress(episodeKey, video.currentTime, video.duration, channel.name);
        }
      }
    };

    video.addEventListener("playing", handlePlaying);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("error", handleVideoError);
    video.addEventListener("pause", handlePause);
    video.addEventListener("timeupdate", handleTimeUpdate);

    loadCandidate(streamCandidates[0]);

    return () => {
      active = false;
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("error", handleVideoError);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      cleanupPlayers();
    };
  }, [streamCandidates, episodeKey, channel.name]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    return () => {
      clearTimeout(hideTimerRef.current);
      clearTimeout(retryTimerRef.current);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play(); } else { video.pause(); }
  };

  const seekBy = (seconds: number) => {
    const video = videoRef.current;
    if (!video || !isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleCast = async () => {
    const video = videoRef.current;
    if (!video || !('remote' in video)) return;
    try {
      // @ts-ignore - Remote Playback API
      await video.remote.prompt();
    } catch (e) {
      console.log("Cast não disponível:", e);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !isFinite(video.duration) || video.duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = pct * video.duration;
  };

  const formatTime = (t: number) => {
    if (!isFinite(t) || t === 0) return "--:--";
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isLive = !isFinite(duration) || duration === 0;

  return (
    <div ref={ref} className="space-y-4">
      <div
        ref={containerRef}
        className="relative w-full aspect-video bg-black rounded-xl overflow-hidden card-shadow group"
        onMouseMove={resetHideTimer}
        onMouseLeave={() => setShowControls(false)}
        onClick={resetHideTimer}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          autoPlay
          playsInline
          muted
          controls={false}
        />

        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-2 px-6 text-center">
            <p className="text-sm text-destructive font-medium">Não foi possível reproduzir o canal</p>
            <p className="text-xs text-muted-foreground">{errorMessage}</p>
          </div>
        )}

        {/* Top bar */}
        <div
          className={cn(
            "absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 z-10",
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); onBack(); }}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            {channel.logo && (
              <img src={channel.logo} alt="" className="w-8 h-8 rounded-md object-cover shrink-0" loading="lazy" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{channel.name}</p>
              <p className="text-xs text-white/60 truncate">
                {channel.group}
                {channel.epgNow ? ` • ${channel.epgNow}` : ""}
                {isLive && <span className="ml-2 px-1.5 py-0.5 rounded bg-red-600 text-[10px] font-bold uppercase">ao vivo</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className={cn(
            "absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 z-10",
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          {!isLive && (
            <div className="px-4 pt-2">
              <div
                className="relative w-full h-1.5 bg-white/20 rounded-full cursor-pointer group/bar"
                onClick={handleSeek}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-white/50">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 px-4 pb-4 pt-1">
            <div className="flex items-center gap-2">
              {!isLive && (
                <button
                  onClick={(e) => { e.stopPropagation(); seekBy(-10); }}
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                  title="Voltar 10s"
                >
                  <SkipBack className="w-4 h-4 text-white" />
                </button>
              )}

              <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                {paused ? <Play className="w-5 h-5 text-white fill-white" /> : <Pause className="w-5 h-5 text-white" />}
              </button>

              {!isLive && (
                <button
                  onClick={(e) => { e.stopPropagation(); seekBy(10); }}
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                  title="Avançar 10s"
                >
                  <SkipForward className="w-4 h-4 text-white" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setMuted((c) => !c); }}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
              </button>
              {castAvailable && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleCast(); }}
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                  title="Transmitir (DLNA/Cast)"
                >
                  <Cast className="w-4 h-4 text-white" />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                {isFullscreen ? <Minimize className="w-4 h-4 text-white" /> : <Maximize className="w-4 h-4 text-white" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-bold text-foreground">{channel.name}</h1>
        <p className="text-sm text-muted-foreground">
          {channel.group}
          {channel.epgNow ? ` • ${channel.epgNow}` : ""}
        </p>
      </div>
    </div>
  );
});

PlayerView.displayName = "PlayerView";

export default PlayerView;
