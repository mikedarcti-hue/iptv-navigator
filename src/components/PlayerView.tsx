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

const TV_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Mobile Safari/537.36";

interface PlayerViewProps {
  channel: Channel;
  onBack: () => void;
  episodeKey?: string | null;
  /** Force VOD mode (movies/series) — disables live stream detection */
  isVod?: boolean;
}

const PlayerView = forwardRef<HTMLDivElement, PlayerViewProps>(({ channel, onBack, episodeKey, isVod = false }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<any>(null);
  const attemptRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const fragRetryCount = useRef(0);
  const maxFragRetries = 3;

  const [muted, setMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("Verifique a URL do stream ou tente outro canal");
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [castAvailable, setCastAvailable] = useState(false);
  const [bufferLow, setBufferLow] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const proxyEndpoint = supabaseUrl ? `${supabaseUrl}/functions/v1/iptv-proxy` : null;

  const isLiveStream = useMemo(() => {
    // If explicitly marked as VOD, never treat as live
    if (isVod) return false;
    const url = channel.url?.toLowerCase() ?? "";
    // Xtream Codes VOD paths
    if (url.includes("/movie/") || url.includes("/series/")) return false;
    // Direct video files
    if (/\.(mp4|mkv|avi|mov|webm)(\?|$)/.test(url)) return false;
    // Everything else (m3u8 live, /live/ paths, etc.) is live
    return true;
  }, [channel.url, isVod]);

  const streamCandidates = useMemo(() => {
    const candidates = [channel.url, ...(channel.streamCandidates ?? [])]
      .filter(Boolean)
      .map((url) => url.trim());
    return Array.from(new Set(candidates));
  }, [channel.url, channel.streamCandidates]);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3500);
  }, []);

  useEffect(() => {
    if (videoRef.current && 'remote' in videoRef.current) {
      setCastAvailable(true);
    }
  }, []);

  // Monitor buffer health for live streams
  useEffect(() => {
    if (!isLiveStream) return;
    const video = videoRef.current;
    if (!video) return;
    const checkBuffer = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const remaining = bufferedEnd - video.currentTime;
        setBufferLow(remaining < 1 && !video.paused);
      }
    };
    const interval = setInterval(checkBuffer, 500);
    return () => clearInterval(interval);
  }, [isLiveStream]);

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
    fragRetryCount.current = 0;

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
        retryTimerRef.current = setTimeout(() => {
          if (active) loadCandidate(streamCandidates[nextAttempt]);
        }, 500);
        return;
      }
      // After exhausting direct candidates, try proxy only for LIVE streams
      if (isLiveStream && proxyEndpoint && !attemptRef.current.toString().includes("proxy")) {
        tryViaProxy(streamCandidates[0]);
        return;
      }
      setLoading(false);
      setError(true);
      setErrorMessage(message);
    };

    const tryAutoplay = (v: HTMLVideoElement) => {
      v.muted = true;
      const playPromise = v.play();
      if (playPromise) {
        playPromise.catch(() => {
          failWithFallback("O navegador bloqueou a reprodução automática");
        });
      }
    };

    // Try streaming via proxy (for live channels blocked by CORS)
    const tryViaProxy = async (originalUrl: string) => {
      if (!active || !proxyEndpoint || !supabaseKey) {
        failWithFallback("Canal indisponível");
        return;
      }

      cleanupPlayers();
      setLoading(true);
      setError(false);

      const isM3U8 = originalUrl.toLowerCase().includes(".m3u8");

      if (isM3U8 && Hls.isSupported()) {
        // Use HLS.js with custom loader that routes through our proxy
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 0,
          maxBufferLength: 12,
          maxMaxBufferLength: 15,
          maxBufferSize: 4 * 1024 * 1024,
          maxBufferHole: 0.5,
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 4,
          liveDurationInfinity: true,
          startLevel: 0,
          startPosition: -1,
          fragLoadingTimeOut: 15000,
          fragLoadingMaxRetry: 5,
          fragLoadingRetryDelay: 2000,
          manifestLoadingTimeOut: 15000,
          manifestLoadingMaxRetry: 3,
          levelLoadingTimeOut: 15000,
          preferManagedMediaSource: true,
          pLoader: class ProxyLoader {
            private loader: any;
            constructor(config: any) {
              // @ts-ignore
              this.loader = new Hls.DefaultConfig.loader(config);
            }
            load(context: any, config: any, callbacks: any) {
              // Route all requests through our proxy
              const originalUrl = context.url;
              const proxiedUrl = `${proxyEndpoint}`;
              
              // Override with fetch-based loading through proxy
              const action = originalUrl.includes(".m3u8") || originalUrl.includes("m3u") ? "proxy_stream" : "proxy_segment";
              
              fetch(proxiedUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": supabaseKey,
                  "Authorization": `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({ action, streamUrl: originalUrl }),
              }).then(async (res) => {
                if (!res.ok) {
                  callbacks.onError({ code: res.status, text: `Proxy error ${res.status}` }, context, null, null);
                  return;
                }
                const data = action === "proxy_stream" ? await res.text() : await res.arrayBuffer();
                const response = {
                  url: originalUrl,
                  data,
                };
                const stats = {
                  loading: { start: 0, first: 0, end: performance.now() },
                  total: typeof data === "string" ? data.length : (data as ArrayBuffer).byteLength,
                  loaded: typeof data === "string" ? data.length : (data as ArrayBuffer).byteLength,
                  bwEstimate: 0,
                  retry: 0,
                  aborted: false,
                };
                callbacks.onSuccess(response, stats, context, null);
              }).catch((err) => {
                callbacks.onError({ code: 0, text: err.message }, context, null, null);
              });
            }
            abort() { try { this.loader.abort(); } catch {} }
            destroy() { try { this.loader.destroy(); } catch {} }
          },
        } as any);

        hlsRef.current = hls;
        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(originalUrl));
        hls.on(Hls.Events.MANIFEST_PARSED, () => tryAutoplay(video));
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }
          hls.destroy();
          hlsRef.current = null;
          // Try .ts via proxy as last resort
          const tsUrl = originalUrl.replace(/\.m3u8(\?.*)?$/, ".ts");
          if (tsUrl !== originalUrl) {
            tryTsViaProxy(tsUrl);
          } else {
            setLoading(false);
            setError(true);
            setErrorMessage("Não foi possível reproduzir este canal");
          }
        });
        return;
      }

      // For .ts streams, fetch via proxy as blob
      tryTsViaProxy(originalUrl);
    };

    const tryTsViaProxy = async (tsUrl: string) => {
      if (!active || !proxyEndpoint || !supabaseKey) return;
      
      try {
        const res = await fetch(proxyEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ action: "proxy_stream", streamUrl: tsUrl }),
        });

        if (!active || !res.ok) {
          setLoading(false);
          setError(true);
          setErrorMessage("Canal indisponível no momento");
          return;
        }

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        video.src = blobUrl;
        tryAutoplay(video);
      } catch {
        if (!active) return;
        setLoading(false);
        setError(true);
        setErrorMessage("Falha ao conectar com o canal");
      }
    };

    // Build HLS config for direct access
    const buildHlsConfig = (isLive: boolean): any => {
      const base: any = {
        enableWorker: true,
        preferManagedMediaSource: true,
        xhrSetup: (xhr: XMLHttpRequest) => {
          try { xhr.setRequestHeader("User-Agent", TV_USER_AGENT); } catch {}
        },
      };

      if (isLive) {
        return {
          ...base,
          lowLatencyMode: true,
          backBufferLength: 0,
          maxBufferLength: 6,
          maxMaxBufferLength: 10,
          maxBufferSize: 2 * 1024 * 1024,
          maxBufferHole: 0.5,
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 3,
          liveDurationInfinity: true,
          startLevel: 0,
          startPosition: -1,
          fragLoadingTimeOut: 10000,
          fragLoadingMaxRetry: 3,
          fragLoadingRetryDelay: 2000,
          manifestLoadingTimeOut: 10000,
          manifestLoadingMaxRetry: 3,
          levelLoadingTimeOut: 10000,
        };
      }

      return {
        ...base,
        lowLatencyMode: false,
        maxBufferLength: 15,
        maxMaxBufferLength: 30,
        maxBufferSize: 15 * 1024 * 1024,
        startLevel: -1,
      };
    };

    const loadCandidate = (candidateUrl: string) => {
      cleanupPlayers();
      setLoading(true);
      setError(false);
      fragRetryCount.current = 0;

      const url = candidateUrl;
      const normalizedUrl = url.toLowerCase();
      const isHlsUrl = normalizedUrl.includes(".m3u8") || normalizedUrl.includes("output=m3u8");
      const isMpegTsUrl = normalizedUrl.endsWith(".ts") || (normalizedUrl.includes("/live/") && normalizedUrl.includes(".ts"));
      const isDirectVideo = /\.(mp4|mkv|avi|mov|webm)(\?|$)/.test(normalizedUrl);
      const urlIsLive = isHlsUrl || isMpegTsUrl || (!isDirectVideo && isLiveStream);

      // Direct video files (VOD)
      if (isDirectVideo) {
        video.src = url;
        tryAutoplay(video);
        return;
      }

      // HLS streams - try direct first
      if (isHlsUrl) {
        if (Hls.isSupported()) {
          const hls = new Hls(buildHlsConfig(urlIsLive));
          hlsRef.current = hls;
          hls.attachMedia(video);
          hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(url));
          hls.on(Hls.Events.MANIFEST_PARSED, () => tryAutoplay(video));

          // Set a timeout - if no manifest parsed in 8s, try next candidate
          const manifestTimeout = setTimeout(() => {
            if (active && loading) {
              hls.destroy();
              hlsRef.current = null;
              failWithFallback("Timeout ao carregar o manifesto HLS");
            }
          }, 8000);

          hls.on(Hls.Events.MANIFEST_PARSED, () => clearTimeout(manifestTimeout));

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.details === "fragLoadError" && urlIsLive) {
              fragRetryCount.current++;
              if (fragRetryCount.current <= maxFragRetries) {
                retryTimerRef.current = setTimeout(() => {
                  if (active && hlsRef.current) hlsRef.current.startLoad();
                }, 2000);
                return;
              }
            }

            if (!data.fatal) return;
            clearTimeout(manifestTimeout);

            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
              return;
            }

            hls.destroy();
            hlsRef.current = null;
            failWithFallback("Não foi possível abrir o stream HLS");
          });
          return;
        }

        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          tryAutoplay(video);
          return;
        }
      }

      // MPEG-TS streams
      if (isMpegTsUrl && mpegts.getFeatureList().mseLivePlayback) {
        const player = mpegts.createPlayer(
          { type: "mpegts", isLive: true, url, hasAudio: true, hasVideo: true },
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
            headers: { "User-Agent": TV_USER_AGENT },
          },
        );
        mpegtsRef.current = player;
        player.attachMediaElement(video);
        player.load();

        video.addEventListener("loadeddata", () => tryAutoplay(video), { once: true });
        retryTimerRef.current = setTimeout(() => tryAutoplay(video), 2000);

        player.on(mpegts.Events.ERROR, () => {
          failWithFallback("O stream MPEG-TS falhou");
        });
        return;
      }

      // Unknown format: try HLS.js first
      if (Hls.isSupported()) {
        const hls = new Hls(buildHlsConfig(urlIsLive));
        hlsRef.current = hls;
        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(url));
        hls.on(Hls.Events.MANIFEST_PARSED, () => tryAutoplay(video));

        const unknownTimeout = setTimeout(() => {
          if (active && loading) {
            hls.destroy();
            hlsRef.current = null;
            failWithFallback("Formato não reconhecido");
          }
        }, 6000);

        hls.on(Hls.Events.MANIFEST_PARSED, () => clearTimeout(unknownTimeout));
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          clearTimeout(unknownTimeout);
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
                autoCleanupSourceBuffer: true,
                headers: { "User-Agent": TV_USER_AGENT },
              },
            );
            mpegtsRef.current = tsPlayer;
            tsPlayer.attachMediaElement(video);
            tsPlayer.load();
            video.addEventListener("loadeddata", () => tryAutoplay(video), { once: true });
            retryTimerRef.current = setTimeout(() => tryAutoplay(video), 2000);
            tsPlayer.on(mpegts.Events.ERROR, () => failWithFallback("Formato não suportado"));
          } else {
            video.src = url;
            tryAutoplay(video);
          }
        });
        return;
      }

      video.src = url;
      tryAutoplay(video);
    };

    const handlePlaying = () => { if (!active) return; setLoading(false); setError(false); setPaused(false); setBufferLow(false); };
    const handleWaiting = () => { if (!active || error) return; setLoading(true); };
    const handleVideoError = () => failWithFallback("O servidor bloqueou ou interrompeu o stream");
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
  }, [streamCandidates, episodeKey, channel.name, isLiveStream, proxyEndpoint, supabaseKey]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    return () => {
      clearTimeout(hideTimerRef.current);
      clearTimeout(retryTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
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
    const target = containerRef.current;
    if (!target) return;
    try {
      if (!document.fullscreenElement) {
        if (target.requestFullscreen) await target.requestFullscreen();
        else if ((target as any).webkitRequestFullscreen) (target as any).webkitRequestFullscreen();
        else if ((target as any).msRequestFullscreen) (target as any).msRequestFullscreen();
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
      }
    } catch (e) {
      console.warn("[DARK IPTV] Fullscreen error:", e);
    }
  };

  const handleCast = async () => {
    const video = videoRef.current;
    if (!video || !('remote' in video)) return;
    try { // @ts-ignore
      await video.remote.prompt();
    } catch (e) { console.log("Cast não disponível:", e); }
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
        className={cn(
          "relative w-full bg-black rounded-xl overflow-hidden card-shadow group",
          isFullscreen ? "fixed inset-0 z-[9999] rounded-none" : "aspect-video"
        )}
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

        {(loading || bufferLow) && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 pointer-events-none gap-2">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            {bufferLow && !loading && (
              <p className="text-xs text-white/70">Buffering...</p>
            )}
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-2 px-6 text-center">
            <p className="text-sm text-destructive font-medium">Não foi possível reproduzir o canal</p>
            <p className="text-xs text-muted-foreground">{errorMessage}</p>
          </div>
        )}

        {/* Top bar */}
        <div className={cn(
          "absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 z-10",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          <div className="flex items-center gap-3">
            <button onClick={(e) => { e.stopPropagation(); onBack(); }}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
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
        <div className={cn(
          "absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 z-10",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          {!isLive && (
            <div className="px-4 pt-2">
              <div className="relative w-full h-1.5 bg-white/20 rounded-full cursor-pointer group/bar" onClick={handleSeek}>
                <div className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
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
                <button onClick={(e) => { e.stopPropagation(); seekBy(-10); }}
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors" title="Voltar 10s">
                  <SkipBack className="w-4 h-4 text-white" />
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                {paused ? <Play className="w-5 h-5 text-white fill-white" /> : <Pause className="w-5 h-5 text-white" />}
              </button>
              {!isLive && (
                <button onClick={(e) => { e.stopPropagation(); seekBy(10); }}
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors" title="Avançar 10s">
                  <SkipForward className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); setMuted((c) => !c); }}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
              </button>
              {castAvailable && (
                <button onClick={(e) => { e.stopPropagation(); handleCast(); }}
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors" title="Transmitir">
                  <Cast className="w-4 h-4 text-white" />
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
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
