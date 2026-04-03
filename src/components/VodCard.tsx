import { Star, Play, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import type { VodItem } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { getProgressPercent } from "@/lib/watch-progress";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface VodCardProps {
  item: VodItem;
  index: number;
  onClick?: (item: VodItem) => void;
}

const VodCard = ({ item, index, onClick }: VodCardProps) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [, setTick] = useState(0);
  const progressPercent = getProgressPercent(item.id);
  const fav = isFavorite(item.id);

  const handleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    const added = toggleFavorite(item.id, item.type);
    setTick((t) => t + 1);
    toast.success(added ? "Adicionado aos favoritos" : "Removido dos favoritos");
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.3 }}
      className="group relative cursor-pointer tv-focus rounded-lg"
      tabIndex={0}
      onClick={() => onClick?.(item)}
    >
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-card">
        {!imgLoaded && (
          <div className="absolute inset-0 bg-gradient-to-r from-card via-surface-hover to-card animate-shimmer bg-[length:200%_100%]" />
        )}
        <img
          src={item.poster}
          alt={item.name}
          onLoad={() => setImgLoaded(true)}
          loading="lazy"
          className={cn(
            "w-full h-full object-cover transition-all duration-500",
            "group-hover:scale-110 group-hover:brightness-50",
            imgLoaded ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Favorite button */}
        <button
          onClick={handleFav}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 hover:bg-black/70"
        >
          <Heart className={cn("w-3.5 h-3.5", fav ? "fill-primary text-primary" : "text-white")} />
        </button>

        {/* Hover overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center mb-2 shadow-lg glow-accent">
            <Play className="w-5 h-5 text-primary-foreground fill-primary-foreground ml-0.5" />
          </div>
        </div>

        {/* Bottom gradient */}
        <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />

        {/* Progress bar */}
        {progressPercent > 0 && progressPercent < 95 && (
          <div className="absolute bottom-0 inset-x-0">
            <Progress value={progressPercent} className="h-1 rounded-none" />
          </div>
        )}

        {/* Rating */}
        {item.rating && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] font-semibold text-foreground/90">
            <Star className="w-3 h-3 fill-primary text-primary" />
            {item.rating}
          </div>
        )}
      </div>

      <div className="mt-1.5 px-0.5">
        <p className="text-xs sm:text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {item.name}
        </p>
        <p className="text-[10px] sm:text-xs text-muted-foreground">{item.year}</p>
      </div>
    </motion.div>
  );
};

export default VodCard;
