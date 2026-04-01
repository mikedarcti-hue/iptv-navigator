import { Play, Star, Info } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { VodItem } from "@/lib/mock-data";

interface HeroCarouselProps {
  items: VodItem[];
  onPlay: (item: VodItem) => void;
  onInfo: (item: VodItem) => void;
}

const HeroCarousel = ({ items, onPlay, onInfo }: HeroCarouselProps) => {
  const [active, setActive] = useState(0);
  const featured = items.slice(0, 5);

  const next = useCallback(() => {
    setActive((prev) => (prev + 1) % featured.length);
  }, [featured.length]);

  useEffect(() => {
    if (featured.length <= 1) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next, featured.length]);

  if (featured.length === 0) return null;

  const current = featured[active];

  return (
    <div className="relative w-full aspect-[16/7] sm:aspect-[16/6] lg:aspect-[16/5] 2xl:aspect-[16/4] overflow-hidden rounded-none sm:rounded-2xl">
      {/* Background image */}
      {featured.map((item, i) => (
        <div
          key={item.id}
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            i === active ? "opacity-100" : "opacity-0"
          )}
        >
          <img
            src={item.poster}
            alt=""
            className="w-full h-full object-cover"
            loading={i === 0 ? "eager" : "lazy"}
          />
        </div>
      ))}

      {/* Gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 lg:p-12 pb-10 sm:pb-12 max-w-2xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/80 text-primary-foreground uppercase tracking-wider">
            {current.type === "movie" ? "Filme" : "Série"}
          </span>
          {current.rating && (
            <span className="flex items-center gap-1 text-xs text-foreground/80">
              <Star className="w-3 h-3 fill-primary text-primary" />
              {current.rating}
            </span>
          )}
          {current.year && (
            <span className="text-xs text-foreground/60">{current.year}</span>
          )}
        </div>

        <h1 className="text-xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight mb-2 line-clamp-2">
          {current.name}
        </h1>

        {current.synopsis && (
          <p className="text-xs sm:text-sm text-foreground/60 line-clamp-2 mb-4 max-w-lg">
            {current.synopsis}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => onPlay(current)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-foreground text-background font-semibold text-sm hover:bg-foreground/90 transition-all tv-focus"
          >
            <Play className="w-4 h-4 fill-background" />
            Assistir
          </button>
          <button
            onClick={() => onInfo(current)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-card/60 backdrop-blur text-foreground font-medium text-sm border border-border/30 hover:bg-card/80 transition-all tv-focus"
          >
            <Info className="w-4 h-4" />
            Detalhes
          </button>
        </div>
      </div>

      {/* Dots */}
      {featured.length > 1 && (
        <div className="absolute bottom-4 right-6 sm:right-8 lg:right-12 flex items-center gap-1.5">
          {featured.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cn(
                "h-1 rounded-full transition-all",
                i === active ? "w-6 bg-primary" : "w-2 bg-foreground/30 hover:bg-foreground/50"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default HeroCarousel;
