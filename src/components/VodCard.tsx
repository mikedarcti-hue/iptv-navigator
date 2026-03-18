import { Star, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import type { VodItem } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface VodCardProps {
  item: VodItem;
  index: number;
  onClick?: (item: VodItem) => void;
}

const VodCard = ({ item, index, onClick }: VodCardProps) => {
  const [isFav, setIsFav] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      className="group relative cursor-pointer"
      onClick={() => onClick?.(item)}
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden card-shadow bg-surface">
        {!imgLoaded && (
          <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface-hover to-surface animate-shimmer bg-[length:200%_100%]" />
        )}
        <img
          src={item.poster}
          alt={item.name}
          onLoad={() => setImgLoaded(true)}
          className={cn(
            "w-full h-full object-cover transition-all duration-500",
            "group-hover:scale-105 group-hover:brightness-75",
            imgLoaded ? "opacity-100" : "opacity-0"
          )}
        />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
          <div className="flex items-center gap-1 text-xs font-medium text-primary">
            <Star className="w-3.5 h-3.5 fill-primary" />
            {item.rating}
          </div>
        </div>
        {/* Favorite button */}
        <button
          onClick={(e) => { e.stopPropagation(); setIsFav(!isFav); }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full glass-surface flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110"
        >
          <Heart className={cn("w-4 h-4", isFav ? "fill-primary text-primary" : "text-foreground")} />
        </button>
        {/* Genre badge */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-semibold glass-surface text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          {item.genre}
        </div>
      </div>
      <div className="mt-2.5 px-0.5">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {item.name}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{item.year}</p>
      </div>
    </motion.div>
  );
};

export default VodCard;
