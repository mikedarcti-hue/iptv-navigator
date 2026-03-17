import { useState, useMemo } from "react";
import VodCard from "./VodCard";
import SearchBar from "./SearchBar";
import type { VodItem } from "@/lib/mock-data";

interface VodGridViewProps {
  title: string;
  items: VodItem[];
}

const VodGridView = ({ title, items }: VodGridViewProps) => {
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  const genres = useMemo(() => [...new Set(items.map((i) => i.genre))], [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchGenre = !selectedGenre || item.genre === selectedGenre;
      return matchSearch && matchGenre;
    });
  }, [items, search, selectedGenre]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{items.length} títulos disponíveis</p>
      </div>
      <SearchBar value={search} onChange={setSearch} placeholder={`Buscar ${title.toLowerCase()}...`} />
      
      {/* Genre filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedGenre(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            !selectedGenre ? "bg-primary/20 text-primary" : "bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-hover"
          }`}
        >
          Todos
        </button>
        {genres.map((genre) => (
          <button
            key={genre}
            onClick={() => setSelectedGenre(genre === selectedGenre ? null : genre)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedGenre === genre ? "bg-primary/20 text-primary" : "bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            {genre}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filtered.map((item, i) => (
          <VodCard key={item.id} item={item} index={i} />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">Nenhum título encontrado.</p>
      )}
    </div>
  );
};

export default VodGridView;
