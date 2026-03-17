import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Volume2, VolumeX, Maximize, Minimize, Loader2 } from "lucide-react";
import type { Channel } from "@/lib/mock-data";

interface PlayerViewProps {
  channel: Channel;
  onBack: () => void;
}

const PlayerView = ({ channel, onBack }: PlayerViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !channel.url) return;

    setLoading(true);
    setError(false);
    video.src = channel.url;
    video.play().catch(() => setError(true));

    const onPlaying = () => setLoading(false);
    const onError = () => { setLoading(false); setError(true); };
    const onWaiting = () => setLoading(true);

    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onError);
    video.addEventListener("waiting", onWaiting);

    return () => {
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onError);
      video.removeEventListener("waiting", onWaiting);
      video.pause();
      video.src = "";
    };
  }, [channel.url]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      <div ref={containerRef} className="relative w-full aspect-video bg-black rounded-xl overflow-hidden card-shadow">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          autoPlay
          muted={muted}
          playsInline
        />

        {/* Loading overlay */}
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-2">
            <p className="text-sm text-destructive font-medium">Não foi possível reproduzir o canal</p>
            <p className="text-xs text-muted-foreground">Verifique a URL do stream ou tente outro canal</p>
          </div>
        )}

        {/* Controls */}
        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {channel.logo && (
                <img src={channel.logo} alt="" className="w-8 h-8 rounded-md object-cover" />
              )}
              <div>
                <p className="text-sm font-semibold text-white">{channel.name}</p>
                <p className="text-xs text-white/60">{channel.group}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setMuted(!muted)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
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
        <p className="text-sm text-muted-foreground">{channel.group} {channel.epgNow ? `• ${channel.epgNow}` : ""}</p>
      </div>
    </div>
  );
};

export default PlayerView;
