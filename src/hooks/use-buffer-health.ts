import { useEffect, type RefObject } from "react";

/**
 * Monitora o buffer de um elemento <video> para sinalizar buffer baixo
 * em streams ao vivo (útil para mostrar indicador de "rebuffering").
 */
export function useBufferHealth(
  videoRef: RefObject<HTMLVideoElement>,
  enabled: boolean,
  onLowBuffer: (low: boolean) => void,
) {
  useEffect(() => {
    if (!enabled) return;
    const video = videoRef.current;
    if (!video) return;
    const check = () => {
      if (video.buffered.length === 0) return;
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      const remaining = bufferedEnd - video.currentTime;
      onLowBuffer(remaining < 1 && !video.paused);
    };
    const interval = setInterval(check, 500);
    return () => clearInterval(interval);
  }, [enabled, videoRef, onLowBuffer]);
}
