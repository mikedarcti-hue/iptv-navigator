import CategoryCard from "./CategoryCard";
import VodCard from "./VodCard";
import ChannelRow from "./ChannelRow";
import type { Channel, VodItem } from "@/lib/mock-data";

interface DashboardViewProps {
  onNavigate: (section: string) => void;
  onPlayChannel?: (channel: Channel) => void;
  liveChannels: Channel[];
  movieItems: VodItem[];
  seriesItems: VodItem[];
}

const DashboardView = ({ onNavigate, onPlayChannel, liveChannels, movieItems, seriesItems }: DashboardViewProps) => {
  const dynamicCategories = [
    { id: "live", label: "Canais ao Vivo", count: liveChannels.length },
    { id: "movies", label: "Filmes", count: movieItems.length },
    { id: "series", label: "Séries", count: seriesItems.length },
  ];

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-bold text-foreground mb-4 tracking-tight">Categorias</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {dynamicCategories.map((category, index) => (
            <CategoryCard key={category.id} {...category} index={index} onClick={() => onNavigate(category.id)} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Filmes</h2>
          <button onClick={() => onNavigate("movies")} className="text-xs font-medium text-primary hover:underline">Ver todos</button>
        </div>
        {movieItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {movieItems.slice(0, 6).map((movie, index) => (
              <VodCard key={movie.id} item={movie} index={index} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum filme encontrado na lista carregada.</p>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Séries</h2>
          <button onClick={() => onNavigate("series")} className="text-xs font-medium text-primary hover:underline">Ver todos</button>
        </div>
        {seriesItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {seriesItems.slice(0, 6).map((seriesItem, index) => (
              <VodCard key={seriesItem.id} item={seriesItem} index={index} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma série encontrada na lista carregada.</p>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Ao Vivo</h2>
          <button onClick={() => onNavigate("live")} className="text-xs font-medium text-primary hover:underline">Ver todos</button>
        </div>
        {liveChannels.length > 0 ? (
          <div className="space-y-1">
            {liveChannels.slice(0, 5).map((channel, index) => (
              <ChannelRow key={channel.id} channel={channel} index={index} onPlay={() => onPlayChannel?.(channel)} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum canal ao vivo encontrado na lista carregada.</p>
        )}
      </section>
    </div>
  );
};

export default DashboardView;
