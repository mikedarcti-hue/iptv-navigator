import { ArrowLeft, Play, Film, Star, Calendar, Clock, User, Clapperboard } from "lucide-react";
import { motion } from "framer-motion";
import type { VodItem } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface VodDetailViewProps {
  item: VodItem;
  onBack: () => void;
  onPlay: (item: VodItem) => void;
}

const VodDetailView = ({ item, onBack, onPlay }: VodDetailViewProps) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);

  const synopsis = item.synopsis || "Sinopse não disponível para este título. Adicione uma lista com metadados completos para visualizar a sinopse.";
  const duration = item.duration || (item.type === "movie" ? "~2h" : "~45min/ep");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      {/* Hero section */}
      <div className="relative rounded-2xl overflow-hidden card-shadow">
        {/* Background blur poster */}
        <div className="absolute inset-0">
          <img
            src={item.poster}
            alt=""
            className="w-full h-full object-cover blur-2xl scale-110 opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/60" />
        </div>

        <div className="relative flex flex-col md:flex-row gap-8 p-6 md:p-10">
          {/* Poster */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="shrink-0 w-48 md:w-56 mx-auto md:mx-0"
          >
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden card-shadow">
              {!imgLoaded && (
                <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface-hover to-surface animate-pulse" />
              )}
              <img
                src={item.poster}
                alt={item.name}
                onLoad={() => setImgLoaded(true)}
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-500",
                  imgLoaded ? "opacity-100" : "opacity-0"
                )}
              />
            </div>
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex-1 flex flex-col justify-center min-w-0"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-primary/20 text-primary">
                {item.type === "movie" ? "FILME" : "SÉRIE"}
              </span>
              <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-surface text-muted-foreground">
                {item.genre}
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight mb-3">
              {item.name}
            </h1>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-5 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-primary fill-primary" />
                <span className="font-semibold text-foreground">{item.rating}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {item.year}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {duration}
              </span>
            </div>

            {item.director && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clapperboard className="w-4 h-4 shrink-0" />
                <span>Diretor: <span className="text-foreground">{item.director}</span></span>
              </p>
            )}
            {item.cast && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <User className="w-4 h-4 shrink-0" />
                <span>Elenco: <span className="text-foreground">{item.cast}</span></span>
              </p>
            )}

            <p className="text-sm text-muted-foreground leading-relaxed mb-6 line-clamp-4 md:line-clamp-none">
              {synopsis}
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              <Button
                onClick={() => onPlay(item)}
                className="gap-2 glow-accent"
                size="lg"
                disabled={!item.streamUrl}
              >
                <Play className="w-5 h-5 fill-primary-foreground" />
                {item.streamUrl ? "Assistir Agora" : "Stream Indisponível"}
              </Button>

              {item.trailerUrl && (
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2"
                  onClick={() => setShowTrailer(!showTrailer)}
                >
                  <Film className="w-5 h-5" />
                  {showTrailer ? "Fechar Trailer" : "Ver Trailer"}
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Trailer embed */}
      {showTrailer && item.trailerUrl && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-xl overflow-hidden card-shadow"
        >
          <div className="relative w-full aspect-video bg-black">
            <iframe
              src={item.trailerUrl}
              className="w-full h-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
              title={`Trailer - ${item.name}`}
            />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default VodDetailView;
