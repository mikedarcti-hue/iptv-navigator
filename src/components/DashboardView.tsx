import { motion } from "framer-motion";
import CategoryCard from "./CategoryCard";
import VodCard from "./VodCard";
import ChannelRow from "./ChannelRow";
import { categories, movies, series, liveChannels } from "@/lib/mock-data";

interface DashboardViewProps {
  onNavigate: (section: string) => void;
}

const DashboardView = ({ onNavigate }: DashboardViewProps) => {
  return (
    <div className="space-y-10">
      {/* Category Cards */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-4 tracking-tight">Categorias</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {categories.map((cat, i) => (
            <CategoryCard
              key={cat.id}
              {...cat}
              index={i}
              onClick={() => onNavigate(cat.id)}
            />
          ))}
        </div>
      </section>

      {/* Continue Watching / Recent Movies */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Filmes em Destaque</h2>
          <button onClick={() => onNavigate("movies")} className="text-xs font-medium text-primary hover:underline">
            Ver todos
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {movies.slice(0, 6).map((movie, i) => (
            <VodCard key={movie.id} item={movie} index={i} />
          ))}
        </div>
      </section>

      {/* Series */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Séries Populares</h2>
          <button onClick={() => onNavigate("series")} className="text-xs font-medium text-primary hover:underline">
            Ver todos
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {series.slice(0, 6).map((s, i) => (
            <VodCard key={s.id} item={s} index={i} />
          ))}
        </div>
      </section>

      {/* Live Channels Preview */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Ao Vivo Agora</h2>
          <button onClick={() => onNavigate("live")} className="text-xs font-medium text-primary hover:underline">
            Ver todos
          </button>
        </div>
        <div className="space-y-1">
          {liveChannels.slice(0, 5).map((ch, i) => (
            <ChannelRow key={ch.id} channel={ch} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default DashboardView;
