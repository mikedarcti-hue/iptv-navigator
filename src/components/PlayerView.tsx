import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Maximize, Minimize, Volume2, VolumeX } from "lucide-react";
import Hls from "hls.js";
import mpegts from "mpegts.js";
import type { Channel } from "@/lib/mock-data";

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
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("Verifique a URL do stream ou tente outro canal");

  const streamCandidates = useMemo(() => {
    const candidates = [channel.url, ...(channel.streamCandidates ?? [])]
      .filter(Boolean)
      .map((url) => url.trim());

    return Array.from(new Set(candidates));
  }, [channel.url, channel.streamCandidates]);

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
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (mpegtsRef.current) {
        mpegtsRef.current.destroy();
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
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            maxBufferLength: 20,
            maxMaxBufferLength: 40,
          });

          hlsRef.current = hls;
          hls.attachMedia(video);

          hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            hls.loadSource(url);
          });

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {
              failWithFallback("O navegador bloqueou a reprodução automática do stream");
            });
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;

            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
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

        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          video.play().catch(() => failWithFallback("Este navegador não conseguiu reproduzir o stream HLS"));
          return;
        }
      }

      if (isMpegTsUrl && mpegts.getFeatureList().mseLivePlayback) {
        const player = mpegts.createPlayer({
          type: "mpegts",
          isLive: true,
          url,
        });

        mpegtsRef.current = player;
        player.attachMediaElement(video);
        player.load();
        Promise.resolve(player.play()).catch(() => {
          failWithFallback("Não foi possível iniciar o stream MPEG-TS");
        });
        player.on(mpegts.Events.ERROR, () => {
          failWithFallback("O stream MPEG-TS falhou durante a reprodução");
        });
        return;
      }

      video.src = url;
      video.play().catch(() => failWithFallback("O formato do stream não é suportado pelo navegador"));
    };

    const handlePlaying = () => {
      if (!active) return;
      setLoading(false);
      setError(false);
    };

    const handleWaiting = () => {
      if (!active || error) return;
      setLoading(true);
    };

    const handleVideoError = () => {
      failWithFallback("O servidor bloqueou ou interrompeu o stream deste canal");
    };

    video.addEventListener("playing", handlePlaying);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("error", handleVideoError);

    loadCandidate(streamCandidates[0]);

    return () => {
      active = false;
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("error", handleVideoError);
      cleanupPlayers();
    };
  }, [error, streamCandidates]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
      return;
    }

    await document.exitFullscreen();
    setIsFullscreen(false);
  };

  return (
    <div ref={ref} className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      <div ref={containerRef} className="relative w-full aspect-video bg-black rounded-xl overflow-hidden card-shadow">
        <video ref={videoRef} className="w-full h-full object-contain" autoPlay playsInline controls={false} />

        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-2 px-6 text-center">
            <p className="text-sm text-destructive font-medium">Não foi possível reproduzir o canal</p>
            <p className="text-xs text-muted-foreground">{errorMessage}</p>
          </div>
        )}

        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {channel.logo && (
                <img src={channel.logo} alt="" className="w-8 h-8 rounded-md object-cover shrink-0" loading="lazy" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{channel.name}</p>
                <p className="text-xs text-white/70 truncate">{channel.group}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setMuted((current) => !current)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
              </button>
              <button onClick={toggleFullscreen} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                {isFullscreen ? <Minimize className="w-4 h-4 text-white" /> : <Maximize className="w-4 h-4 text-white" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-bold text-foreground">{channel.name}</h1>
        <p className="text-sm text-muted-foreground">{channel.group}{channel.epgNow ? ` • ${channel.epgNow}` : ""}</p>
      </div>
    </div>
  );
});

PlayerView.displayName = "PlayerView";

export default PlayerView;
