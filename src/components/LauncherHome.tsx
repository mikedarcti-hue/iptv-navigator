import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Tv, Film, Clapperboard, Heart, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Channel, VodItem } from "@/lib/mock-data";

interface LauncherHomeProps {
  liveChannels: Channel[];
  movieItems: VodItem[];
  seriesItems: VodItem[];
  onNavigate: (section: string) => void;
}

const tileBase =
  "group relative shrink-0 w-[200px] h-[280px] sm:w-[230px] sm:h-[320px] tv:w-[280px] tv:h-[380px] " +
  "rounded-2xl overflow-hidden text-left tv-focus " +
  "bg-gradient-to-br from-card via-card to-surface border border-border/60 " +
  "transition-all duration-300 hover:scale-[1.04] hover:border-primary/60 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:scale-[1.04] " +
  "shadow-lg hover:shadow-[0_20px_60px_-15px_hsl(var(--primary)/0.5)]";

const LauncherHome = ({ liveChannels, movieItems, seriesItems, onNavigate }: LauncherHomeProps) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" });

  const tiles = [
    {
      id: "live",
      label: "Ao Vivo",
      sub: `+${liveChannels.length} Canais`,
      icon: Tv,
      gradient: "from-primary/30 via-primary/10 to-transparent",
    },
    {
      id: "movies",
      label: "Filmes",
      sub: `+${movieItems.length} Títulos`,
      icon: Film,
      gradient: "from-accent/30 via-accent/10 to-transparent",
      badge: movieItems.length > 0 ? "Novo" : undefined,
    },
    {
      id: "series",
      label: "Séries",
      sub: `+${seriesItems.length} Séries`,
      icon: Clapperboard,
      gradient: "from-fuchsia-500/30 via-fuchsia-500/10 to-transparent",
    },
    {
      id: "favorites",
      label: "Favoritos",
      sub: "Sua coleção",
      icon: Heart,
      gradient: "from-rose-500/30 via-rose-500/10 to-transparent",
    },
  ] as const;

  return (
    <div className="relative min-h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex-1 flex flex-col lg:flex-row items-stretch gap-8 lg:gap-12 pt-4">
        {/* Tiles */}
        <div className="flex-1 flex items-center">
          <div className="flex gap-4 sm:gap-6 tv:gap-8 overflow-x-auto pb-4 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide">
            {tiles.map((t, i) => (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.4, ease: "easeOut" }}
                onClick={() => onNavigate(t.id)}
                tabIndex={0}
                className={cn(tileBase, "snap-start")}
              >
                {/* Gradient overlay */}
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-80", t.gradient)} />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.15),transparent_60%)]" />

                {/* Badge */}
                {t.badge && (
                  <span className="absolute top-3 right-3 z-10 text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded bg-primary text-primary-foreground">
                    {t.badge}
                  </span>
                )}

                {/* Content */}
                <div className="relative z-10 h-full flex flex-col justify-end p-5 sm:p-6">
                  <div className="mb-auto pt-2">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-foreground/5 backdrop-blur-sm border border-foreground/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:border-primary/40 transition-colors">
                      <t.icon className="w-7 h-7 sm:w-8 sm:h-8 text-foreground" strokeWidth={1.5} />
                    </div>
                  </div>
                  <h3 className="text-2xl sm:text-3xl tv:text-4xl font-bold text-foreground tracking-tight">
                    {t.label}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t.sub}</p>

                  {/* Active indicator */}
                  <div className="mt-4 h-1 w-10 rounded-full bg-foreground/20 group-hover:bg-primary group-focus-visible:bg-primary transition-colors" />
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Clock / weather panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="hidden lg:flex flex-col justify-end items-end pr-2 pb-6 min-w-[220px]"
        >
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Cloud className="w-5 h-5" />
            <span className="text-sm">24°</span>
          </div>
          <div className="text-6xl tv:text-7xl font-light text-foreground tracking-tighter tabular-nums">
            {time}
          </div>
          <div className="text-sm text-muted-foreground mt-1 capitalize">{date}</div>
        </motion.div>
      </div>
    </div>
  );
};

export default LauncherHome;
