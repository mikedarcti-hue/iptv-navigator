import { forwardRef } from "react";
import { Play } from "lucide-react";
import { motion } from "framer-motion";
import type { Channel } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface ChannelRowProps {
  channel: Channel;
  index: number;
  onPlay?: () => void;
}

const ChannelRow = forwardRef<HTMLDivElement, ChannelRowProps>(({ channel, index, onPlay }, ref) => {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.2), duration: 0.25 }}
      onClick={onPlay}
      className="group flex items-center gap-3 p-3 rounded-lg hover:bg-card/80 transition-all cursor-pointer tv-focus"
    >
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md bg-card overflow-hidden shrink-0">
        {channel.logo ? (
          <img src={channel.logo} alt={channel.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-muted-foreground bg-secondary">
            {channel.name.substring(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{channel.name}</p>
        <p className="text-xs text-muted-foreground truncate">{channel.epgNow || channel.group}</p>
      </div>
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Play className="w-3.5 h-3.5 text-primary fill-primary" />
      </div>
    </motion.div>
  );
});

ChannelRow.displayName = "ChannelRow";

export default ChannelRow;
