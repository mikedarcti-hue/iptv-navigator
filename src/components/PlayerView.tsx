import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setProgress, getProgress } from "@/lib/watch-progress";
import { classifyPlayerError } from "@/lib/player-errors";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { useBufferHealth } from "@/hooks/use-buffer-health";
import { useCastSdk } from "@/hooks/use-cast-sdk";


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
  Lock,
  Unlock,
  RectangleHorizontal,
  FastForward,
  X,
} from "lucide-react";
import Hls from "hls.js";
import mpegts from "mpegts.js";
import type { Channel } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useDeviceMode } from "@/pages/Index";
import { getPreferences, applyStreamFormat } from "@/lib/app-preferences";
import { toast } from "@/hooks/use-toast";
import { TV_USER_AGENT, ASPECT_MODES, ASPECT_LABELS, isLiveStreamUrl, type AspectMode } from "@/lib/player-constants";


interface PlayerViewProps {
  channel: Channel;
  onBack: () => void;
  episodeKey?: string | null;
  isVod?: boolean;
  isSeries?: boolean;
  onEnded?: () => void;
  isMini?: boolean;
  onExpand?: () => void;
  onCloseMini?: () => void;
}

const PlayerView = forwardRef<HTMLDivElement, PlayerViewProps>(({ channel, onBack, episodeKey, isVod = false, isSeries = false, onEnded, isMini = false, onExpand, onCloseMini }, ref) => {
  const deviceMode = useDeviceMode();
  const isTvMode = deviceMode === "tv";
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<any>(null);
  const attemptRef = useRef(0);
  const proxyAttemptedRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const fragRetryCount = useRef(0);
  const maxFragRetries = 3;
  const lastProgressSaveRef = useRef(0);


  const [muted, setMuted] = useState(false);
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
  const [screenLocked, setScreenLocked] = useState(false);
  const [aspectMode, setAspectMode] = useState<AspectMode>("contain");
  const [skipIntroDismissed, setSkipIntroDismissed] = useState(false);

  // Netflix-style double tap seek
  const [seekIndicator, setSeekIndicator] = useState<"left" | "right" | null>(null);
  const seekIndicatorTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastTapRef = useRef<{ time: number; side: "left" | "right" } | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const proxyEndpoint = supabaseUrl ? `${supabaseUrl}/functions/v1/iptv-proxy` : null;
  const buildProxyUrl = useCallback((streamUrl: string) => {
    if (!proxyEndpoint || !streamUrl) return streamUrl;
    if (streamUrl.startsWith(proxyEndpoint)) return streamUrl;
    const params = new URLSearchParams({ action: "proxy_media", streamUrl });
    return `${proxyEndpoint}?${params.toString()}`;
  }, [proxyEndpoint]);

  const isLiveStream = useMemo(() => isLiveStreamUrl(channel.url, isVod), [channel.url, isVod]);


  const streamCandidates = useMemo(() => {
    const fmt = getPreferences().streamFormat;
    const raw = [channel.url, ...(channel.streamCandidates ?? [])]
      .filter(Boolean)
      .map((url) => url.trim());
    // Prepend formatted variant when user forced a specific format
    const transformed = fmt === "default"
      ? raw
      : Array.from(new Set([...raw.map((u) => applyStreamFormat(u, fmt)), ...raw]));
    return Array.from(new Set(transformed));
  }, [channel.url, channel.streamCandidates]);

  const resetHideTimer = useCallback(() => {
    if (screenLocked) return;
    setShowControls(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), isTvMode ? 8000 : 3500);
  }, [isTvMode, screenLocked]);

  // Handle tap-to-seek on mobile (Netflix style)
  const handleVideoAreaTap = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (isTvMode || screenLocked) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    let clientX: number;
    if ("touches" in e) {
      if (e.touches.length > 0) clientX = e.touches[0].clientX;
      else return;
    } else {
      clientX = e.clientX;
    }
    const relX = (clientX - rect.left) / rect.width;
    const side: "left" | "right" = relX < 0.35 ? "left" : relX > 0.65 ? "right" : "left";

    // Middle area = toggle controls
    if (relX >= 0.35 && relX <= 0.65) {
      resetHideTimer();
      return;
    }

    const now = Date.now();
    const last = lastTapRef.current;

    if (last && now - last.time < 350 && last.side === side) {
      // Double tap detected
      const video = videoRef.current;
      if (video && !isLiveStream) {
        const seekAmt = side === "left" ? -10 : 10;
        video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seekAmt));
        setSeekIndicator(side);
        clearTimeout(seekIndicatorTimer.current);
        seekIndicatorTimer.current = setTimeout(() => setSeekIndicator(null), 600);
      }
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { time: now, side };
      // Single tap = show controls after small delay
      setTimeout(() => {
        if (lastTapRef.current && Date.now() - lastTapRef.current.time >= 340) {
          resetHideTimer();
          lastTapRef.current = null;
        }
      }, 360);
    }
  }, [isTvMode, screenLocked, isLiveStream, resetHideTimer]);

  useEffect(() => {
    const video = videoRef.current as any;
    // RemotePlayback (Chrome Android nativo) ou AirPlay (Safari iOS)
    if (video && ('remote' in video || typeof video.webkitShowPlaybackTargetPicker === 'function')) {
      setCastAvailable(true);
    }
    // Em modo mobile, carrega o Google Cast SDK uma vez para Chromecast
    if (isTvMode) return;
    if ((window as any).__castSdkLoading) return;
    if (document.getElementById('google-cast-sdk')) return;
    (window as any).__castSdkLoading = true;
    (window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
      if (!isAvailable) return;
      try {
        const cast = (window as any).cast;
        const chrome = (window as any).chrome;
        cast.framework.CastContext.getInstance().setOptions({
          receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
        });
        setCastAvailable(true);
      } catch (e) { console.warn('[CAST] init falhou', e); }
    };
    const s = document.createElement('script');
    s.id = 'google-cast-sdk';
    s.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
    s.async = true;
    document.head.appendChild(s);
  }, [isTvMode]);


  // Monitor buffer health
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

  // Keep screen awake during playback (Wake Lock API for web/mobile + Capacitor KeepAwake for native)
  useEffect(() => {
    let wakeLock: any = null;
    let cancelled = false;
    let keepAwakePlugin: any = null;

    const acquire = async () => {
      // Web Wake Lock API (Android Chrome, modern browsers)
      try {
        if ("wakeLock" in navigator && (navigator as any).wakeLock?.request) {
          wakeLock = await (navigator as any).wakeLock.request("screen");
          wakeLock?.addEventListener?.("release", () => { wakeLock = null; });
        }
      } catch {}
      // Capacitor KeepAwake (native Android/iOS apps)
      try {
        const mod: any = await import("@capacitor-community/keep-awake").catch(() => null);
        if (mod?.KeepAwake && !cancelled) {
          keepAwakePlugin = mod.KeepAwake;
          await keepAwakePlugin.keepAwake();
        }
      } catch {}
    };

    const release = async () => {
      try { if (wakeLock) { await wakeLock.release(); wakeLock = null; } } catch {}
      try { if (keepAwakePlugin) { await keepAwakePlugin.allowSleep(); keepAwakePlugin = null; } } catch {}
    };

    acquire();

    // Re-acquire on visibility change (browser releases wake lock when tab is hidden)
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !cancelled) acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    };
  }, []);
  // ===== STREAM LOADING (unchanged logic) =====
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
    proxyAttemptedRef.current = false;
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
      // Fallback automático via proxy edge function quando a origem falha.
      // Aplica-se a LIVE e VOD — em TV Boxes/WebView a origem direta pode ser
      // bloqueada por CORS / HTTP misto, e o proxy resolve com spoof de UA.
      if (proxyEndpoint && !proxyAttemptedRef.current) {
        proxyAttemptedRef.current = true;
        tryViaProxy(streamCandidates[0]);
        return;
      }

      setLoading(false);
      setError(true);
      setErrorMessage(message);
    };

    const tryAutoplay = (v: HTMLVideoElement) => {
      // Start muted (browsers always allow muted autoplay), then attempt to unmute.
      v.muted = true;
      const playPromise = v.play();
      const tryUnmute = () => {
        // Try unmuting after playback starts; if blocked, stay muted silently.
        try {
          v.muted = false;
          setMuted(false);
        } catch {
          v.muted = true;
          setMuted(true);
        }
      };
      if (playPromise && typeof playPromise.then === "function") {
        playPromise
          .then(() => {
            // Slight delay so the play state is committed before unmuting.
            setTimeout(tryUnmute, 80);
          })
          .catch(() => {
            // Even muted autoplay failed — likely the source is not ready or the
            // tab lost focus. Don't show a "browser blocked" error: just keep
            // the player ready and let the user tap to start.
            v.muted = true;
            setMuted(true);
            setLoading(false);
          });
      } else {
        setTimeout(tryUnmute, 80);
      }
    };

    const tryViaProxy = async (originalUrl: string) => {
      if (!active || !proxyEndpoint || !supabaseKey) { failWithFallback("Canal indisponível"); return; }
      proxyAttemptedRef.current = true;
      cleanupPlayers();
      setLoading(true);
      setError(false);
      // VOD (mp4/mkv/etc.): usa o proxy GET (com suporte a Range) para não
      // baixar o arquivo inteiro como blob. Essencial para Smart TV/TV Box.
      const isDirectVideoUrl = /\.(mp4|mkv|avi|mov|webm)(\?|$)/i.test(originalUrl);
      if (isDirectVideoUrl) {
        video.src = buildProxyUrl(originalUrl);
        tryAutoplay(video);
        return;
      }

      const isM3U8 = originalUrl.toLowerCase().includes(".m3u8");
      if (isM3U8 && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true, lowLatencyMode: true, backBufferLength: 0,
          maxBufferLength: 10, maxMaxBufferLength: 20, maxBufferSize: 4 * 1024 * 1024,
          maxBufferHole: 1.0, liveSyncDurationCount: 3, liveMaxLatencyDurationCount: 5,
          liveDurationInfinity: true, startLevel: -1, startPosition: -1,
          fragLoadingTimeOut: 20000, fragLoadingMaxRetry: 5, fragLoadingRetryDelay: 1000,
          manifestLoadingTimeOut: 20000, manifestLoadingMaxRetry: 5, levelLoadingTimeOut: 20000,
          preferManagedMediaSource: true,
          pLoader: class ProxyLoader {
            private loader: any;
            constructor(config: any) { // @ts-ignore
              this.loader = new Hls.DefaultConfig.loader(config); }
            load(context: any, _config: any, callbacks: any) {
              const originalUrl2 = context.url;
              const action = originalUrl2.includes(".m3u8") || originalUrl2.includes("m3u") ? "proxy_stream" : "proxy_segment";
              fetch(proxyEndpoint!, { method: "POST", headers: { "Content-Type": "application/json", apikey: supabaseKey!, Authorization: `Bearer ${supabaseKey}` },
                body: JSON.stringify({ action, streamUrl: originalUrl2 }),
              }).then(async (res) => {
                if (!res.ok) { callbacks.onError({ code: res.status, text: `Proxy error ${res.status}` }, context, null, null); return; }
                const data = action === "proxy_stream" ? await res.text() : await res.arrayBuffer();
                callbacks.onSuccess({ url: originalUrl2, data }, { loading: { start: 0, first: 0, end: performance.now() }, total: typeof data === "string" ? data.length : (data as ArrayBuffer).byteLength, loaded: typeof data === "string" ? data.length : (data as ArrayBuffer).byteLength, bwEstimate: 0, retry: 0, aborted: false }, context, null);
              }).catch((err) => { callbacks.onError({ code: 0, text: err.message }, context, null, null); });
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
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { hls.recoverMediaError(); return; }
          hls.destroy(); hlsRef.current = null;
          const tsUrl = originalUrl.replace(/\.m3u8(\?.*)?$/, ".ts");
          if (tsUrl !== originalUrl) tryTsViaProxy(tsUrl);
          else { setLoading(false); setError(true); setErrorMessage("Não foi possível reproduzir este canal"); }
        });
        return;
      }
      tryTsViaProxy(originalUrl);
    };

    const tryTsViaProxy = async (tsUrl: string) => {
      if (!active || !proxyEndpoint || !supabaseKey) return;
      try {
        const res = await fetch(proxyEndpoint, { method: "POST", headers: { "Content-Type": "application/json", apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
          body: JSON.stringify({ action: "proxy_stream", streamUrl: tsUrl }) });
        if (!active || !res.ok) { setLoading(false); setError(true); setErrorMessage("Canal indisponível no momento"); return; }
        const blob = await res.blob();
        video.src = URL.createObjectURL(blob);
        tryAutoplay(video);
      } catch { if (!active) return; setLoading(false); setError(true); setErrorMessage("Falha ao conectar com o canal"); }
    };

    const buildHlsConfig = (isLive: boolean): any => {
      const base: any = { enableWorker: true, preferManagedMediaSource: true, xhrSetup: (xhr: XMLHttpRequest) => { try { xhr.setRequestHeader("User-Agent", TV_USER_AGENT); } catch {} } };
      if (isLive) return { ...base, lowLatencyMode: true, backBufferLength: 0, maxBufferLength: 10, maxMaxBufferLength: 20, maxBufferSize: 4 * 1024 * 1024, maxBufferHole: 1.0, liveSyncDurationCount: 3, liveMaxLatencyDurationCount: 5, liveDurationInfinity: true, startLevel: -1, startPosition: -1, fragLoadingTimeOut: 20000, fragLoadingMaxRetry: 5, fragLoadingRetryDelay: 1000, manifestLoadingTimeOut: 20000, manifestLoadingMaxRetry: 5, levelLoadingTimeOut: 20000 };
      return { ...base, lowLatencyMode: false, maxBufferLength: 15, maxMaxBufferLength: 30, maxBufferSize: 15 * 1024 * 1024, startLevel: -1 };
    };

    const loadCandidate = (candidateUrl: string) => {
      cleanupPlayers(); setLoading(true); setError(false); fragRetryCount.current = 0;
      const url = candidateUrl;
      const proxiedUrl = buildProxyUrl(url);
      const normalizedUrl = url.toLowerCase();
      const isHlsUrl = normalizedUrl.includes(".m3u8") || normalizedUrl.includes("output=m3u8");
      const isMpegTsUrl = normalizedUrl.endsWith(".ts") || (normalizedUrl.includes("/live/") && normalizedUrl.includes(".ts"));
      const isDirectVideo = /\.(mp4|mkv|avi|mov|webm)(\?|$)/.test(normalizedUrl);
      const urlIsLive = isHlsUrl || isMpegTsUrl || (!isDirectVideo && isLiveStream);

      // Use the SAME playback path on TV and mobile: always hit the origin
      // directly first. The edge proxy is only used as a fallback (see
      // failWithFallback → tryViaProxy) when the direct attempt fails for
      // live streams. Forcing TV through the proxy was causing the
      // "servidor bloqueou" message on TV Boxes for both live and VOD.
      const shouldPreferProxy = false;


      if (isDirectVideo) { video.src = shouldPreferProxy ? proxiedUrl : url; tryAutoplay(video); return; }


      if (isHlsUrl) {
        if (Hls.isSupported()) {
          const hls = new Hls(buildHlsConfig(urlIsLive));
          hlsRef.current = hls;
          hls.attachMedia(video);
          hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(shouldPreferProxy ? proxiedUrl : url));
          hls.on(Hls.Events.MANIFEST_PARSED, () => tryAutoplay(video));
          const manifestTimeout = setTimeout(() => { if (active && loading) { hls.destroy(); hlsRef.current = null; failWithFallback("Timeout ao carregar o manifesto HLS"); } }, 8000);
          hls.on(Hls.Events.MANIFEST_PARSED, () => clearTimeout(manifestTimeout));
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.details === "fragLoadError" && urlIsLive) { fragRetryCount.current++; if (fragRetryCount.current <= maxFragRetries) { retryTimerRef.current = setTimeout(() => { if (active && hlsRef.current) hlsRef.current.startLoad(); }, 2000); return; } }
            if (!data.fatal) return;
            clearTimeout(manifestTimeout);
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { hls.recoverMediaError(); return; }
            hls.destroy(); hlsRef.current = null; failWithFallback("Não foi possível abrir o stream HLS");
          });
          return;
        }
        if (video.canPlayType("application/vnd.apple.mpegurl")) { video.src = shouldPreferProxy ? proxiedUrl : url; tryAutoplay(video); return; }
      }

      if (isMpegTsUrl && mpegts.getFeatureList().mseLivePlayback) {
        const player = mpegts.createPlayer({ type: "mpegts", isLive: true, url: shouldPreferProxy ? proxiedUrl : url, hasAudio: true, hasVideo: true },
          { enableWorker: true, enableStashBuffer: false, stashInitialSize: 128, liveBufferLatencyChasing: true, liveBufferLatencyMaxLatency: 3.0, liveBufferLatencyMinRemain: 0.5, lazyLoad: false, lazyLoadMaxDuration: 0, autoCleanupSourceBuffer: true, autoCleanupMaxBackwardDuration: 3, autoCleanupMinBackwardDuration: 1, headers: { "User-Agent": TV_USER_AGENT } });
        mpegtsRef.current = player;
        player.attachMediaElement(video);
        player.load();
        video.addEventListener("loadeddata", () => tryAutoplay(video), { once: true });
        retryTimerRef.current = setTimeout(() => tryAutoplay(video), 2000);
        player.on(mpegts.Events.ERROR, () => { failWithFallback("O stream MPEG-TS falhou"); });
        return;
      }

      if (Hls.isSupported()) {
        const hls = new Hls(buildHlsConfig(urlIsLive));
        hlsRef.current = hls;
        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(shouldPreferProxy ? proxiedUrl : url));
        hls.on(Hls.Events.MANIFEST_PARSED, () => tryAutoplay(video));
        const unknownTimeout = setTimeout(() => { if (active && loading) { hls.destroy(); hlsRef.current = null; failWithFallback("Formato não reconhecido"); } }, 6000);
        hls.on(Hls.Events.MANIFEST_PARSED, () => clearTimeout(unknownTimeout));
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          clearTimeout(unknownTimeout);
          hls.destroy(); hlsRef.current = null;
          if (mpegts.getFeatureList().mseLivePlayback) {
            const tsPlayer = mpegts.createPlayer({ type: "mpegts", isLive: true, url: shouldPreferProxy ? proxiedUrl : url, hasAudio: true, hasVideo: true },
              { enableWorker: true, enableStashBuffer: false, stashInitialSize: 128, liveBufferLatencyChasing: true, autoCleanupSourceBuffer: true, headers: { "User-Agent": TV_USER_AGENT } });
            mpegtsRef.current = tsPlayer;
            tsPlayer.attachMediaElement(video);
            tsPlayer.load();
            video.addEventListener("loadeddata", () => tryAutoplay(video), { once: true });
            retryTimerRef.current = setTimeout(() => tryAutoplay(video), 2000);
            tsPlayer.on(mpegts.Events.ERROR, () => failWithFallback("Formato não suportado"));
          } else { video.src = url; tryAutoplay(video); }
        });
        return;
      }
      video.src = shouldPreferProxy ? proxiedUrl : url; tryAutoplay(video);
    };

    const handlePlaying = () => { if (!active) return; setLoading(false); setError(false); setPaused(false); setBufferLow(false); };
    const handleWaiting = () => { if (!active || error) return; setLoading(true); };
    const handleVideoError = () => {
      const classified = classifyPlayerError(video.error, {
        isLive: isLiveStream,
        isVod,
        proxyAttempted: proxyAttemptedRef.current,
        url: video.currentSrc || streamCandidates[attemptRef.current],
      });
      failWithFallback(classified.message);
    };
    const handlePause = () => setPaused(true);
    const handleTimeUpdate = () => {
      if (!video) return;
      setCurrentTime(video.currentTime);
      setDuration(video.duration || 0);
      const progressKey = episodeKey || (isVod ? channel.id : null);
      if (!progressKey || !video.duration || video.currentTime <= 0) return;
      // Throttle: salva no máximo 1×/5s para evitar bater no localStorage 4×/s
      const now = performance.now();
      if (now - lastProgressSaveRef.current < 5000) return;
      lastProgressSaveRef.current = now;
      setProgress(progressKey, video.currentTime, video.duration, channel.name);
    };

    const handleCanPlay = () => {
      if (!isVod) return;
      const progressKey = episodeKey || channel.id;
      const saved = getProgress(progressKey);
      if (saved && saved.currentTime > 5 && saved.duration > 0 && (saved.currentTime / saved.duration) < 0.95) {
        video.currentTime = saved.currentTime;
      }
      video.removeEventListener("canplay", handleCanPlay);
    };
    const handleEnded = () => {
      const prefs = getPreferences();
      if (isSeries && prefs.autoPlayNextEnabled) {
        setTimeout(() => onEnded?.(), prefs.autoPlayNextDelay * 1000);
      } else {
        onEnded?.();
      }
    };
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("error", handleVideoError);
    video.addEventListener("pause", handlePause);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    loadCandidate(streamCandidates[0]);

    return () => {
      active = false;
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("error", handleVideoError);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
      cleanupPlayers();
    };
  }, [streamCandidates, episodeKey, channel.name, isLiveStream, proxyEndpoint, supabaseKey, isTvMode, buildProxyUrl]);

  useEffect(() => { if (videoRef.current) videoRef.current.muted = muted; }, [muted]);
  useEffect(() => { setSkipIntroDismissed(false); }, [episodeKey, channel.id]);
  useEffect(() => { return () => { clearTimeout(hideTimerRef.current); clearTimeout(retryTimerRef.current); }; }, []);
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => { document.removeEventListener("fullscreenchange", onFsChange); document.removeEventListener("webkitfullscreenchange", onFsChange); };
  }, []);

  const togglePlay = () => { const video = videoRef.current; if (!video) return; if (video.paused) video.play(); else video.pause(); };
  const seekBy = (seconds: number) => { const video = videoRef.current; if (!video || !isFinite(video.duration)) return; video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds)); };

  const toggleFullscreen = async () => {
    const target = containerRef.current;
    if (!target) return;
    try {
      if (!document.fullscreenElement) {
        if (target.requestFullscreen) await target.requestFullscreen();
        else if ((target as any).webkitRequestFullscreen) (target as any).webkitRequestFullscreen();
        else if ((target as any).msRequestFullscreen) (target as any).msRequestFullscreen();
        // Lock orientation to landscape on mobile
        try {
          const orientation: any = (screen as any).orientation;
          if (orientation && typeof orientation.lock === "function") {
            await orientation.lock("landscape").catch(() => {});
          }
        } catch {}
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
        try {
          const orientation: any = (screen as any).orientation;
          if (orientation && typeof orientation.unlock === "function") orientation.unlock();
        } catch {}
      }
    } catch (e) { console.warn("[DARK IPTV] Fullscreen error:", e); }
  };

  const handleCast = async () => {
    const video = videoRef.current as any;
    if (!video) return;

    // Detecta iframe (preview Lovable bloqueia Cast SDK por permissions policy)
    const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();

    // 1) AirPlay (Safari iOS / macOS) — funciona mesmo em iframe
    try {
      if (typeof video.webkitShowPlaybackTargetPicker === 'function') {
        video.webkitShowPlaybackTargetPicker();
        return;
      }
    } catch {}

    // 2) Google Cast (Chromecast)
    const cast = (window as any).cast;
    const chrome = (window as any).chrome;
    if (cast?.framework && chrome?.cast) {
      try {
        const ctx = cast.framework.CastContext.getInstance();
        const state = ctx.getCastState?.();
        // NO_DEVICES_AVAILABLE = nenhum Chromecast/Google TV na rede
        if (state === 'NO_DEVICES_AVAILABLE') {
          toast({
            title: 'Nenhum dispositivo encontrado',
            description: 'Verifique se a TV/Chromecast está ligada e conectada na mesma rede WiFi.',
          });
          return;
        }
        await ctx.requestSession();
        const session = ctx.getCurrentSession();
        if (session) {
          const src = video.currentSrc || video.src || channel.url;
          const isHls = /\.m3u8(\?|$)/i.test(src);
          const contentType = isHls ? 'application/x-mpegURL' : 'video/mp4';
          const mediaInfo = new chrome.cast.media.MediaInfo(src, contentType);
          mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
          mediaInfo.metadata.title = channel.name;
          if (channel.logo) mediaInfo.metadata.images = [new chrome.cast.Image(channel.logo)];
          const request = new chrome.cast.media.LoadRequest(mediaInfo);
          if (!isLiveStream && video.currentTime) request.currentTime = video.currentTime;
          await session.loadMedia(request);
          try { video.pause(); } catch {}
          toast({ title: 'Transmitindo para a TV', description: 'Reprodução enviada ao dispositivo.' });
          return;
        }
      } catch (e: any) {
        // "cancel" = usuário fechou o diálogo
        if (e?.code !== 'cancel' && e !== 'cancel') {
          console.log('[CAST] erro:', e);
        }
        return;
      }
    }

    // 3) RemotePlayback API (fallback)
    try {
      if ('remote' in video) {
        await video.remote.prompt();
        return;
      }
    } catch (e) { console.log('Cast indisponível:', e); }

    // 4) Sem nenhum método disponível
    if (inIframe) {
      toast({
        title: 'Transmissão indisponível no preview',
        description: 'O Chromecast funciona apenas no app publicado/instalado. Abra a URL publicada no Chrome ou no app Android.',
      });
    } else {
      toast({
        title: 'Transmissão não suportada',
        description: 'Use o Chrome no Android ou Safari no iOS com um dispositivo compatível (Chromecast, AirPlay) na mesma rede.',
      });
    }
  };



  const cycleAspect = () => {
    setAspectMode((prev) => {
      const idx = ASPECT_MODES.indexOf(prev);
      return ASPECT_MODES[(idx + 1) % ASPECT_MODES.length];
    });
  };

  // Back action — Index decides whether to minimize (mini-player) or close completely
  const handleBackWithPip = useCallback(() => {
    onBack();
  }, [onBack]);

  // Request native Picture-in-Picture (used when app goes to background on mobile)
  const requestNativePip = useCallback(async () => {
    const video = videoRef.current as any;
    if (!video) return false;
    try {
      if (document.pictureInPictureElement === video) return true;
      if (document.pictureInPictureEnabled && !video.disablePictureInPicture) {
        await video.requestPictureInPicture();
        return true;
      }
      if (typeof video.webkitSetPresentationMode === "function") {
        video.webkitSetPresentationMode("picture-in-picture");
        return true;
      }
    } catch (e) {
      console.warn("[DARK IPTV] PiP error:", e);
    }
    return false;
  }, []);

  // Mark video as PiP-eligible and enable Chrome/Edge "Auto Picture-in-Picture"
  // so it persists when user switches apps or tabs (Netflix-style).
  useEffect(() => {
    const video = videoRef.current as any;
    if (!video) return;
    const pipEnabled = getPreferences().pictureInPictureEnabled;
    try {
      if (pipEnabled) {
        video.setAttribute("autoPictureInPicture", "");
        video.autoPictureInPicture = true;
        video.disablePictureInPicture = false;
      } else {
        video.removeAttribute("autoPictureInPicture");
        video.autoPictureInPicture = false;
        video.disablePictureInPicture = true;
      }
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      // Apply subtitle preference when tracks exist
      const subsOn = getPreferences().subtitlesEnabled;
      if (video.textTracks) {
        for (let i = 0; i < video.textTracks.length; i++) {
          video.textTracks[i].mode = subsOn ? "showing" : "disabled";
        }
      }
    } catch {}
  }, [channel.url]);

  // When app goes to background while playing, try to enter native PiP so audio/video continues.
  // We hook into multiple events to maximize the chance the browser still treats it as a gesture-led transition.
  useEffect(() => {
    if (isTvMode) return;

    const tryPip = () => {
      if (!getPreferences().pictureInPictureEnabled) return;
      const video = videoRef.current;
      if (!video || video.paused || video.ended) return;
      // Don't pop PiP while user is in fullscreen — let fullscreen handle it
      if (document.fullscreenElement) return;
      requestNativePip();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") tryPip();
    };
    const onBlur = () => tryPip();
    const onPageHide = () => tryPip();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onPageHide);

    // Media Session keeps audio playing in background on Android/iOS
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: channel.name || "DARK IPTV",
          artwork: channel.logo ? [{ src: channel.logo, sizes: "512x512" }] : [],
        });
        navigator.mediaSession.setActionHandler("play", () => videoRef.current?.play());
        navigator.mediaSession.setActionHandler("pause", () => videoRef.current?.pause());
      } catch {}
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [isTvMode, requestNativePip, channel.name, channel.logo]);

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
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isLive = !isFinite(duration) || duration === 0;

  // TV button navigation refs
  const controlButtonsRef = useRef<HTMLButtonElement[]>([]);
  const [focusedBtnIdx, setFocusedBtnIdx] = useState(0);
  const registerBtn = useCallback((el: HTMLButtonElement | null, idx: number) => { if (el) controlButtonsRef.current[idx] = el; }, []);

  // D-pad / remote keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;
      resetHideTimer();
      if (isTvMode) {
        const buttons = controlButtonsRef.current.filter(Boolean);
        switch (e.key) {
          case "ArrowLeft": e.preventDefault(); setFocusedBtnIdx((prev) => { const next = Math.max(0, prev - 1); buttons[next]?.focus(); return next; }); break;
          case "ArrowRight": e.preventDefault(); setFocusedBtnIdx((prev) => { const next = Math.min(buttons.length - 1, prev + 1); buttons[next]?.focus(); return next; }); break;
          case "ArrowUp": e.preventDefault(); video.volume = Math.min(1, video.volume + 0.1); break;
          case "ArrowDown": e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); break;
          case "Enter": case " ": e.preventDefault();
            if (document.activeElement && document.activeElement !== containerRef.current && document.activeElement.tagName === "BUTTON") (document.activeElement as HTMLButtonElement).click();
            else togglePlay(); break;
          case "Escape": case "GoBack": case "XF86Back": e.preventDefault();
            if (document.fullscreenElement) document.exitFullscreen(); else handleBackWithPip(); break;
        }
        return;
      }
      switch (e.key) {
        case "ArrowLeft": e.preventDefault(); if (!isLive) seekBy(-10); break;
        case "ArrowRight": e.preventDefault(); if (!isLive) seekBy(10); break;
        case "ArrowUp": e.preventDefault(); video.volume = Math.min(1, video.volume + 0.1); break;
        case "ArrowDown": e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); break;
        case "Enter": case " ": e.preventDefault(); togglePlay(); break;
        case "Escape": case "GoBack": case "XF86Back": e.preventDefault();
          if (document.fullscreenElement) document.exitFullscreen(); else handleBackWithPip(); break;
        case "f": e.preventDefault(); toggleFullscreen(); break;
        case "m": e.preventDefault(); setMuted((c) => !c); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isLive, onBack, handleBackWithPip, resetHideTimer, isTvMode]);

  useEffect(() => {
    if (isTvMode) {
      setShowControls(true);
      setTimeout(() => { const buttons = controlButtonsRef.current.filter(Boolean); if (buttons.length > 0) { buttons[0]?.focus(); setFocusedBtnIdx(0); } }, 500);
    }
  }, [isTvMode]);

  const videoObjectFit = aspectMode === "contain" ? "object-contain" : aspectMode === "cover" ? "object-cover" : "object-fill";

  return (
    <div
      ref={ref}
      className={cn(
        "space-y-4",
        isMini && "fixed bottom-20 right-3 md:bottom-6 md:right-6 z-[9998] w-64 sm:w-80 space-y-0 shadow-2xl"
      )}
    >
      <div
        ref={containerRef}
        tabIndex={0}
        className={cn(
          "relative w-full bg-black overflow-hidden card-shadow group focus:outline-none",
          isMini ? "rounded-lg aspect-video cursor-pointer ring-2 ring-primary/60" : "rounded-xl",
          isFullscreen ? "fixed inset-0 z-[9999] rounded-none" : !isMini && "aspect-video"
        )}
        onMouseMove={!screenLocked && !isMini ? resetHideTimer : undefined}
        onMouseLeave={() => !screenLocked && !isMini && setShowControls(false)}
        onClick={isMini ? (e) => { e.stopPropagation(); onExpand?.(); } : handleVideoAreaTap}
      >
        <video
          ref={videoRef}
          className={cn("w-full h-full transition-all", videoObjectFit)}
          autoPlay
          playsInline
          controls={false}
          {...({ "x-webkit-airplay": "allow" } as any)}
        />


        {/* Mini player controls */}
        {isMini && (
          <>
            <div
              className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white"
                title={paused ? "Reproduzir" : "Pausar"}
              >
                {paused ? <Play className="w-4 h-4 fill-white" /> : <Pause className="w-4 h-4" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onExpand?.(); }}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white"
                title="Maximizar"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onCloseMini?.(); }}
              className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/70 hover:bg-destructive flex items-center justify-center text-white z-30"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
        {/* Netflix-style seek indicators */}
        {seekIndicator === "left" && (
          <div className="absolute left-0 top-0 bottom-0 w-1/3 flex items-center justify-center pointer-events-none animate-pulse">
            <div className="flex flex-col items-center gap-1 text-white">
              <SkipBack className="w-8 h-8" />
              <span className="text-xs font-bold">10s</span>
            </div>
          </div>
        )}
        {seekIndicator === "right" && (
          <div className="absolute right-0 top-0 bottom-0 w-1/3 flex items-center justify-center pointer-events-none animate-pulse">
            <div className="flex flex-col items-center gap-1 text-white">
              <SkipForward className="w-8 h-8" />
              <span className="text-xs font-bold">10s</span>
            </div>
          </div>
        )}

        {/* Next episode overlay (series only) — appears in last 30s, autoplay handled in handleEnded */}
        {isSeries && !isMini && onEnded && duration > 0 && (duration - currentTime) <= 30 && (duration - currentTime) > 0.5 && (
          <div className="absolute bottom-20 right-4 z-30 animate-in fade-in slide-in-from-bottom-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); onEnded?.(); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm shadow-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary tv-focus"
              title="Próximo episódio"
            >
              <SkipForward className="w-4 h-4" />
              Próximo episódio
              <span className="ml-1 text-xs opacity-80">({Math.max(1, Math.ceil(duration - currentTime))}s)</span>
            </button>
          </div>
        )}

        {/* Screen lock overlay */}
        {screenLocked && (
          <div className="absolute inset-0 z-30" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); setScreenLocked(false); resetHideTimer(); }}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
            >
              <Lock className="w-5 h-5 text-white" />
            </button>
          </div>
        )}

        {(loading || bufferLow) && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 pointer-events-none gap-2">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            {bufferLow && !loading && <p className="text-xs text-white/70">Buffering...</p>}
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-2 px-6 text-center">
            <p className="text-sm text-destructive font-medium">Não foi possível reproduzir o canal</p>
            <p className="text-xs text-muted-foreground">{errorMessage}</p>
          </div>
        )}

        {/* Top bar */}
        {!screenLocked && !isMini && (
          <div className={cn(
            "absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 z-10",
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          )}>
            <div className="flex items-center gap-3">
              <button onClick={(e) => { e.stopPropagation(); handleBackWithPip(); }}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              {channel.logo && <img src={channel.logo} alt="" className="w-8 h-8 rounded-md object-cover shrink-0" loading="lazy" />}
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
        )}

        {/* Bottom bar */}
        {!screenLocked && !isMini && (
          <div className={cn(
            "absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 z-10",
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          )}>
            {!isLive && (
              <div className="px-4 pt-2">
                <div className="relative w-full h-1.5 bg-white/20 rounded-full cursor-pointer group/bar" onClick={(e) => { e.stopPropagation(); handleSeek(e); }}>
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
                  <button ref={(el) => registerBtn(el, 0)} onClick={(e) => { e.stopPropagation(); seekBy(-10); }}
                    className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 focus:bg-primary/40 focus:outline-none focus:ring-2 focus:ring-primary transition-colors tv-focus" title="Voltar 10s">
                    <SkipBack className="w-4 h-4 text-white" />
                  </button>
                )}
                <button ref={(el) => registerBtn(el, isLive ? 0 : 1)} onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                  className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 focus:bg-primary/40 focus:outline-none focus:ring-2 focus:ring-primary transition-colors tv-focus">
                  {paused ? <Play className="w-5 h-5 text-white fill-white" /> : <Pause className="w-5 h-5 text-white" />}
                </button>
                {!isLive && (
                  <button ref={(el) => registerBtn(el, 2)} onClick={(e) => { e.stopPropagation(); seekBy(10); }}
                    className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 focus:bg-primary/40 focus:outline-none focus:ring-2 focus:ring-primary transition-colors tv-focus" title="Avançar 10s">
                    <SkipForward className="w-4 h-4 text-white" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button ref={(el) => registerBtn(el, isLive ? 1 : 3)} onClick={(e) => { e.stopPropagation(); setMuted((c) => !c); }}
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 focus:bg-primary/40 focus:outline-none focus:ring-2 focus:ring-primary transition-colors tv-focus">
                  {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                </button>
                {(castAvailable || !isTvMode) && (

                  <button ref={(el) => registerBtn(el, isLive ? 2 : 4)} onClick={(e) => { e.stopPropagation(); handleCast(); }}
                    className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 focus:bg-primary/40 focus:outline-none focus:ring-2 focus:ring-primary transition-colors tv-focus" title="Transmitir">
                    <Cast className="w-4 h-4 text-white" />
                  </button>
                )}
                {/* Aspect ratio button */}
                <button onClick={(e) => { e.stopPropagation(); cycleAspect(); }}
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 focus:bg-primary/40 focus:outline-none focus:ring-2 focus:ring-primary transition-colors tv-focus relative group/aspect"
                  title={ASPECT_LABELS[aspectMode]}>
                  <RectangleHorizontal className="w-4 h-4 text-white" />
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] bg-black/80 px-2 py-0.5 rounded opacity-0 group-hover/aspect:opacity-100 transition-opacity whitespace-nowrap text-white">{ASPECT_LABELS[aspectMode]}</span>
                </button>
                {/* Screen lock (mobile only) */}
                {!isTvMode && (
                  <button onClick={(e) => { e.stopPropagation(); setScreenLocked(true); setShowControls(false); }}
                    className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 focus:bg-primary/40 focus:outline-none focus:ring-2 focus:ring-primary transition-colors tv-focus" title="Bloquear tela">
                    <Unlock className="w-4 h-4 text-white" />
                  </button>
                )}
                <button ref={(el) => registerBtn(el, isLive ? (castAvailable ? 3 : 2) : (castAvailable ? 5 : 4))} onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 focus:bg-primary/40 focus:outline-none focus:ring-2 focus:ring-primary transition-colors tv-focus">
                  {isFullscreen ? <Minimize className="w-4 h-4 text-white" /> : <Maximize className="w-4 h-4 text-white" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!isMini && (
      <div>
        <h1 className="text-xl font-bold text-foreground">{channel.name}</h1>
        <p className="text-sm text-muted-foreground">
          {channel.group}
          {channel.epgNow ? ` • ${channel.epgNow}` : ""}
        </p>
      </div>
      )}
    </div>
  );
});

PlayerView.displayName = "PlayerView";

export default PlayerView;
