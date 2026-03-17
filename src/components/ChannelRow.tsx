import { forwardRef } from "react";
import { Play } from "lucide-react";
import { motion } from "framer-motion";
import type { Channel } from "@/lib/mock-data";

interface ChannelRowProps {
  channel: Channel;
  index: number;
  onPlay?: () => void;
}

const ChannelRow = forwardRef<HTMLDivElement, ChannelRowProps>(({ channel, index, onPlay }, ref) => {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      onClick={onPlay}
      className="group flex items-center gap-4 p-3 rounded-xl hover:bg-surface-hover transition-all duration-200 cursor-pointer inner-glow"
    >
      <div className="w-12 h-12 rounded-lg bg-surface overflow-hidden shrink-0 card-shadow">
        {channel.logo ? (
          <img src={channel.logo} alt={channel.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
            {channel.name.substring(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{channel.name}</p>
        <p className="text-xs text-muted-foreground truncate">{channel.epgNow || channel.group}</p>
      </div>
      <span className="text-[10px] font-medium text-muted-foreground bg-surface px-2 py-1 rounded-md">
        {channel.group}
      </span>
      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Play className="w-3.5 h-3.5 text-primary fill-primary" />
      </div>
    </motion.div>
  );
});

ChannelRow.displayName = "ChannelRow";

export default ChannelRow;
