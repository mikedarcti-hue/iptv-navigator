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
} from "lucide-react";
import Hls from "hls.js";
import mpegts from "mpegts.js";
import type { Channel } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface PlayerViewProps {
  channel: Channel;
  onBack: () => void;
}

const PlayerView = forwardRef<HTMLDivElement, PlayerViewProps>(({ channel, onBack }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<any>(null);
  const attemptRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("Verifique a URL do stream ou tente outro canal");
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);

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
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (mpegtsRef.current) { mpegtsRef.current.destroy(); mpegtsRef.current = null; }
      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    const failWithFallback = (message: string) => {
      if (!active) return;
      const nextAttempt = attemptRef.current + 1;
      if (nextAttempt < streamCandidates.length) {
        attemptRef.current = nextAttempt;
        loadCandidate(streamCandidates[nextAttempt]);
        return;
      }
      setLoading(false);
      setError(true);
      setErrorMessage(message);
    };

    const loadCandidate = (url: string) => {
      cleanupPlayers();
      setLoading(true);
      setError(false);

      const normalizedUrl = url.toLowerCase();
      const isHlsUrl = normalizedUrl.includes(".m3u8") || normalizedUrl.includes("output=m3u8");
      const isMpegTsUrl = normalizedUrl.includes(".ts") || normalizedUrl.includes("/live/");

      if (isHlsUrl) {
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true, maxBufferLength: 20, maxMaxBufferLength: 40 });
          hlsRef.current = hls;
          hls.attachMedia(video);
          hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(url));
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => failWithFallback("O navegador bloqueou a reprodução automática do stream"));
          });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) { hls.startLoad(); return; }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { hls.recoverMediaError(); return; }
            failWithFallback("Não foi possível abrir o stream HLS deste canal");
          });
          return;
        }
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          video.play().catch(() => failWithFallback("Este navegador não conseguiu reproduzir o stream HLS"));
          return;
        }
      }

      if (isMpegTsUrl && mpegts.getFeatureList().mseLivePlayback) {
        const player = mpegts.createPlayer({ type: "mpegts", isLive: true, url });
        mpegtsRef.current = player;
        player.attachMediaElement(video);
        player.load();
        Promise.resolve(player.play()).catch(() => failWithFallback("Não foi possível iniciar o stream MPEG-TS"));
        player.on(mpegts.Events.ERROR, () => failWithFallback("O stream MPEG-TS falhou durante a reprodução"));
        return;
      }

      video.src = url;
      video.play().catch(() => failWithFallback("O formato do stream não é suportado pelo navegador"));
    };

    const handlePlaying = () => { if (!active) return; setLoading(false); setError(false); setPaused(false); };
    const handleWaiting = () => { if (!active || error) return; setLoading(true); };
    const handleVideoError = () => failWithFallback("O servidor bloqueou ou interrompeu o stream deste canal");
    const handlePause = () => setPaused(true);
    const handleTimeUpdate = () => { if (video) { setCurrentTime(video.currentTime); setDuration(video.duration || 0); } };

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
  }, [error, streamCandidates]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    return () => clearTimeout(hideTimerRef.current);
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
      {/* Player container */}
      <div
        ref={containerRef}
        className="relative w-full aspect-video bg-black rounded-xl overflow-hidden card-shadow group"
        onMouseMove={resetHideTimer}
        onMouseLeave={() => setShowControls(false)}
        onClick={resetHideTimer}
      >
        <video ref={videoRef} className="w-full h-full object-contain" autoPlay playsInline controls={false} />

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

        {/* Top bar — back button + channel info */}
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

        {/* Bottom bar — controls */}
        <div
          className={cn(
            "absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 z-10",
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          {/* Progress bar (only for VOD) */}
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
            {/* Left: play controls */}
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

            {/* Right: volume + fullscreen */}
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setMuted((c) => !c); }}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
              </button>
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

      {/* Channel info below player */}
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
