import { Play, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import type { VodItem, Channel } from "@/lib/mock-data";

interface WatchedEntry {
  itemId: string;
  currentTime: number;
  duration: number;
  updatedAt: string;
  label?: string;
  item?: VodItem | null;
  channel?: Channel | null;
}

interface ContinueWatchingRowProps {
  entries: WatchedEntry[];
  onResume: (entry: WatchedEntry) => void;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h${String(m % 60).padStart(2, "0")}m`;
  return `${m}min`;
}

const ContinueWatchingRow = ({ entries, onResume }: ContinueWatchingRowProps) => {
  if (entries.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-4 md:px-0">
        <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
          Continuar Assistindo
        </h2>
      </div>
      <div className="flex gap-3 overflow-x-auto carousel-scroll pl-4 md:pl-0 pr-4 md:pr-0 pb-2">
        {entries.map((entry, index) => {
          const percent = entry.duration > 0 ? Math.min(100, (entry.currentTime / entry.duration) * 100) : 0;
          const remaining = entry.duration - entry.currentTime;
          const poster = entry.item?.poster || entry.channel?.logo;
          const name = entry.item?.name || entry.channel?.name || entry.label || entry.itemId;

          return (
            <motion.div
              key={entry.itemId}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(index * 0.05, 0.3), duration: 0.3 }}
              className="shrink-0 w-[200px] sm:w-[240px] md:w-[260px] cursor-pointer group"
              onClick={() => onResume(entry)}
            >
              <div className="relative aspect-video rounded-lg overflow-hidden bg-card">
                {poster ? (
                  <img
                    src={poster}
                    alt={name}
                    className="w-full h-full object-cover group-hover:scale-105 group-hover:brightness-50 transition-all duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-card to-surface flex items-center justify-center">
                    <Play className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}

                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-lg glow-accent">
                    <Play className="w-5 h-5 text-primary-foreground fill-primary-foreground ml-0.5" />
                  </div>
                </div>

                {/* Bottom gradient + progress */}
                <div className="absolute bottom-0 inset-x-0">
                  <div className="h-12 bg-gradient-to-t from-black/80 to-transparent" />
                  <Progress value={percent} className="h-1 rounded-none" />
                </div>

                {/* Time remaining */}
                <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] text-white/80 font-medium">
                  <Clock className="w-3 h-3" />
                  {formatTime(remaining)} restantes
                </div>
              </div>

              <div className="mt-1.5 px-0.5">
                <p className="text-xs sm:text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {name}
                </p>
                {entry.label && entry.label !== name && (
                  <p className="text-[10px] text-muted-foreground truncate">{entry.label}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export type { WatchedEntry };
export default ContinueWatchingRow;
