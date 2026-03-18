import { useEffect, useMemo, useState } from "react";
import VodCard from "./VodCard";
import VodDetailView from "./VodDetailView";
import SearchBar from "./SearchBar";
import type { VodItem } from "@/lib/mock-data";

interface VodGridViewProps {
  title: string;
  items: VodItem[];
  onPlayVod?: (item: VodItem) => void;
}

const INITIAL_VISIBLE_ITEMS = 60;
const LOAD_MORE_STEP = 60;

const VodGridView = ({ title, items, onPlayVod }: VodGridViewProps) => {
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ITEMS);
  const [selectedItem, setSelectedItem] = useState<VodItem | null>(null);

  const genres = useMemo(() => [...new Set(items.map((item) => item.genre))].sort(), [items]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items
      .filter((item) => {
        const matchesSearch = !term || item.name.toLowerCase().includes(term);
        const matchesGenre = !selectedGenre || item.genre === selectedGenre;
        return matchesSearch && matchesGenre;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [items, search, selectedGenre]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_ITEMS);
  }, [items, search, selectedGenre]);

  const visibleItems = filteredItems.slice(0, visibleCount);

  if (selectedItem) {
    return (
      <VodDetailView
        item={selectedItem}
        onBack={() => setSelectedItem(null)}
        onPlay={(item) => onPlayVod?.(item)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{items.length} títulos disponíveis</p>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder={`Buscar ${title.toLowerCase()}...`} />

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

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Nenhum título encontrado nessa categoria.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {visibleItems.map((item, index) => (
              <VodCard key={item.id} item={item} index={index} onClick={setSelectedItem} />
            ))}
          </div>

          {filteredItems.length > visibleCount && (
            <button
              onClick={() => setVisibleCount((current) => current + LOAD_MORE_STEP)}
              className="w-full rounded-xl border border-border bg-surface py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
            >
              Carregar mais títulos
            </button>
          )}

          {filteredItems.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhum título encontrado.</p>
          )}
        </>
      )}
    </div>
  );
};

export default VodGridView;
