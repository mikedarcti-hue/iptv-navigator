import { Tv, Film, Clapperboard } from "lucide-react";
import { motion } from "framer-motion";

interface CategoryCardProps {
  id: string;
  label: string;
  count: number;
  index: number;
  onClick: () => void;
}

const iconMap: Record<string, typeof Tv> = {
  live: Tv,
  movies: Film,
  series: Clapperboard,
};

const CategoryCard = ({ id, label, count, index, onClick }: CategoryCardProps) => {
  const Icon = iconMap[id] || Tv;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
      onClick={onClick}
      className="glass-surface inner-glow card-shadow rounded-2xl p-6 flex flex-col items-center gap-4 hover:bg-surface-hover transition-all duration-300 group cursor-pointer"
    >
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:glow-accent transition-all duration-300">
        <Icon className="w-8 h-8 text-primary" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-1">{count} itens</p>
      </div>
    </motion.button>
  );
};

export default CategoryCard;
