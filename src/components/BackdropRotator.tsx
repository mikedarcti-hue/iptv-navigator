import { useEffect, useMemo, useState } from "react";
import type { VodItem } from "@/lib/mock-data";

interface BackdropRotatorProps {
  items: VodItem[];
  intervalMs?: number;
}

/**
 * Fixed, blurred, rotating backdrop using latest movie posters.
 * Sits behind all app content; very low opacity so it doesn't
 * interfere with cards/text readability.
 */
const BackdropRotator = ({ items, intervalMs = 30000 }: BackdropRotatorProps) => {
  const posters = useMemo(() => {
    const list = items.filter((i) => !!i.poster).map((i) => i.poster as string);
    // Deterministic shuffle so movies & series intermix
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(((i * 9301 + 49297) % 233280) / 233280 * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list.slice(0, 60);
  }, [items]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (posters.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % posters.length), intervalMs);
    return () => clearInterval(id);
  }, [posters.length, intervalMs]);

  if (posters.length === 0) return null;

  const current = posters[index % posters.length];
  const next = posters[(index + 1) % posters.length];

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-background"
    >
      {/* Preload next, render current+next stacked for crossfade */}
      {[current, next].map((src, i) => (
        <div
          key={src + i}
          className="absolute inset-0 transition-opacity duration-[2000ms] ease-in-out"
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(40px) saturate(1.1)",
            transform: "scale(1.15)",
            opacity: i === 0 ? 0.18 : 0,
          }}
        />
      ))}
      {/* Dark overlays for legibility */}
      <div className="absolute inset-0 bg-background/70" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background/90" />
    </div>
  );
};

export default BackdropRotator;
