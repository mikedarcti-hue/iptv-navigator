// Constantes e utilitários compartilhados do player.
// Extraídos do PlayerView.tsx para reduzir tamanho do componente e permitir
// reuso (ex.: edge function, testes). Mantém comportamento idêntico.

export const TV_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Mobile Safari/537.36";

export const ASPECT_MODES = ["contain", "cover", "fill"] as const;
export type AspectMode = (typeof ASPECT_MODES)[number];
export const ASPECT_LABELS: Record<AspectMode, string> = {
  contain: "Ajustar",
  cover: "Preencher",
  fill: "Esticar",
};

/** Heurística para detectar se uma URL é stream ao vivo (não VOD). */
export function isLiveStreamUrl(url: string | undefined | null, isVod = false): boolean {
  if (isVod) return false;
  const u = (url ?? "").toLowerCase();
  if (!u) return false;
  if (u.includes("/movie/") || u.includes("/series/")) return false;
  if (/\.(mp4|mkv|avi|mov|webm)(\?|$)/.test(u)) return false;
  return true;
}
