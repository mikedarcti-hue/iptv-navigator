import { useEffect, type RefObject } from "react";

/**
 * Detecta disponibilidade de transmissão (Cast / AirPlay / RemotePlayback)
 * e carrega o Google Cast SDK no modo mobile. No modo TV não faz nada
 * (TVs já são o receptor).
 */
export function useCastSdk(
  videoRef: RefObject<HTMLVideoElement>,
  isTvMode: boolean,
  onAvailable: (available: boolean) => void,
) {
  useEffect(() => {
    const video = videoRef.current as any;
    if (video && ("remote" in video || typeof video.webkitShowPlaybackTargetPicker === "function")) {
      onAvailable(true);
    }
    if (isTvMode) return;
    if ((window as any).__castSdkLoading) return;
    if (document.getElementById("google-cast-sdk")) return;
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
        onAvailable(true);
      } catch (e) {
        console.warn("[CAST] init falhou", e);
      }
    };
    const s = document.createElement("script");
    s.id = "google-cast-sdk";
    s.src = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
    s.async = true;
    document.head.appendChild(s);
  }, [isTvMode, videoRef, onAvailable]);
}
