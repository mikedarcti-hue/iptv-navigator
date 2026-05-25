import { useEffect } from "react";

/**
 * Mantém a tela ligada durante a reprodução.
 * Combina Wake Lock API (web/mobile Chrome) com o plugin Capacitor KeepAwake
 * (apps Android/iOS nativos). Re-adquire o lock ao voltar de background.
 */
export function useWakeLock(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    let wakeLock: any = null;
    let cancelled = false;
    let keepAwakePlugin: any = null;

    const acquire = async () => {
      try {
        if ("wakeLock" in navigator && (navigator as any).wakeLock?.request) {
          wakeLock = await (navigator as any).wakeLock.request("screen");
          wakeLock?.addEventListener?.("release", () => {
            wakeLock = null;
          });
        }
      } catch {}
      try {
        const mod: any = await import("@capacitor-community/keep-awake").catch(() => null);
        if (mod?.KeepAwake && !cancelled) {
          keepAwakePlugin = mod.KeepAwake;
          await keepAwakePlugin.keepAwake();
        }
      } catch {}
    };

    const release = async () => {
      try {
        if (wakeLock) {
          await wakeLock.release();
          wakeLock = null;
        }
      } catch {}
      try {
        if (keepAwakePlugin) {
          await keepAwakePlugin.allowSleep();
          keepAwakePlugin = null;
        }
      } catch {}
    };

    acquire();

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !cancelled) acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    };
  }, [enabled]);
}
