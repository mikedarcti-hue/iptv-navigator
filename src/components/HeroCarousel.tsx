import { Play, Star, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
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
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const next = useCallback(() => {
    setActive((prev) => (prev + 1) % featured.length);
  }, [featured.length]);

  const prev = useCallback(() => {
    setActive((prev) => (prev - 1 + featured.length) % featured.length);
  }, [featured.length]);

  useEffect(() => {
    if (featured.length <= 1) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next, featured.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) next();
      else prev();
    }
  };

  if (featured.length === 0) return null;

  const current = featured[active];

  return (
    <div
      className="relative w-full aspect-[16/7] sm:aspect-[16/6] lg:aspect-[16/5] 2xl:aspect-[16/4] overflow-hidden rounded-none sm:rounded-2xl"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
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

      {/* Arrow buttons (desktop/TV) */}
      {featured.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/40 backdrop-blur flex items-center justify-center hover:bg-black/60 transition-colors tv-focus hidden sm:flex"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/40 backdrop-blur flex items-center justify-center hover:bg-black/60 transition-colors tv-focus hidden sm:flex"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>
        </>
      )}

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-8 lg:p-12 pb-8 sm:pb-12 max-w-2xl">
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

        <h1 className="text-lg sm:text-3xl lg:text-4xl tv:text-5xl font-bold text-foreground tracking-tight mb-2 line-clamp-2">
          {current.name}
        </h1>

        {current.synopsis && (
          <p className="text-xs sm:text-sm text-foreground/60 line-clamp-2 mb-4 max-w-lg hidden sm:block">
            {current.synopsis}
          </p>
        )}

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => onPlay(current)}
            className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-md bg-foreground text-background font-semibold text-xs sm:text-sm hover:bg-foreground/90 transition-all tv-focus"
          >
            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-background" />
            Assistir
          </button>
          <button
            onClick={() => onInfo(current)}
            className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-md bg-card/60 backdrop-blur text-foreground font-medium text-xs sm:text-sm border border-border/30 hover:bg-card/80 transition-all tv-focus"
          >
            <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Detalhes
          </button>
        </div>
      </div>

      {/* Dots */}
      {featured.length > 1 && (
        <div className="absolute bottom-3 sm:bottom-4 right-4 sm:right-8 lg:right-12 flex items-center gap-1.5">
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
