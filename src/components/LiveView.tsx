import { useEffect, useMemo, useRef, useState } from "react";
import PlayerView from "./PlayerView";
import type { Channel } from "@/lib/mock-data";
import { Search, X, Play, ArrowLeft, Heart, Tv, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDeviceMode } from "@/pages/Index";

interface LiveViewProps {
  channels: Channel[];
}

const INITIAL = 60;
const STEP = 60;

const CATEGORY_GRADIENTS = [
  "from-rose-600 to-rose-800",
  "from-indigo-600 to-violet-800",
  "from-orange-500 to-amber-700",
  "from-sky-600 to-blue-800",
  "from-emerald-600 to-teal-800",
  "from-fuchsia-600 to-purple-800",
  "from-yellow-500 to-orange-700",
  "from-cyan-600 to-sky-800",
  "from-lime-600 to-green-800",
  "from-pink-600 to-rose-800",
];

const hashIndex = (s: string, mod: number) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
};

// ============== Channel Card ==============
const ChannelCard = ({ channel, onClick, index }: { channel: Channel; onClick: (c: Channel) => void; index: number }) => {
  const grad = CATEGORY_GRADIENTS[hashIndex(channel.group || channel.name, CATEGORY_GRADIENTS.length)];
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.015, 0.25), duration: 0.25 }}
      whileHover={{ scale: 1.06 }}
      whileFocus={{ scale: 1.06 }}
      onClick={() => onClick(channel)}
      className="group relative shrink-0 snap-start rounded-xl overflow-hidden tv-focus card-shadow text-left"
    >
      <div className={cn(
        "relative w-32 sm:w-40 tv:w-52 aspect-[3/4] bg-gradient-to-br",
        grad
      )}>
        {/* radial highlight */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.25),transparent_60%)]" />

        {/* Logo centered */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          {channel.logo ? (
            <img
              src={channel.logo}
              alt={channel.name}
              loading="lazy"
              className="max-w-full max-h-[55%] object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
            />
          ) : (
            <span className="text-3xl tv:text-4xl font-black text-white/90 drop-shadow">
              {channel.name.substring(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        {/* Bottom info gradient */}
        <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
          <p className="text-xs sm:text-sm font-bold text-white truncate">{channel.name}</p>
          {channel.epgNow && (
            <p className="text-[10px] sm:text-xs text-white/70 truncate mt-0.5">{channel.epgNow}</p>
          )}
        </div>

        {/* Hover play */}
        <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
          <Play className="w-4 h-4 text-primary-foreground fill-primary-foreground" />
        </div>

        {/* Live badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-600/90 backdrop-blur">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-[9px] font-bold text-white tracking-wide">AO VIVO</span>
        </div>
      </div>
    </motion.button>
  );
};

const LiveView = ({ channels }: LiveViewProps) => {
  const [search, setSearch] = useState("");
  const [playing, setPlaying] = useState<Channel | null>(null);
  const [previewing, setPreviewing] = useState<Channel | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const deviceMode = useDeviceMode();
  const isMobile = useIsMobile();
  const isTvMode = deviceMode === "tv";
  const gridRef = useRef<HTMLDivElement>(null);

  // Categories
  const channelsByCategory = useMemo(() => {
    const map = new Map<string, Channel[]>();
    for (const c of channels) {
      const list = map.get(c.group) || [];
      list.push(c);
      map.set(c.group, list);
    }
    return map;
  }, [channels]);

  const categories = useMemo(() => {
    return [...channelsByCategory.entries()]
      .map(([name, list]) => ({ name, count: list.length }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [channelsByCategory]);

  // Featured channels — pick those with logos from largest categories
  const featuredChannels = useMemo(() => {
    const sortedCats = [...categories].sort((a, b) => b.count - a.count).slice(0, 12);
    const picks: Channel[] = [];
    for (const cat of sortedCats) {
      const list = channelsByCategory.get(cat.name) || [];
      const withLogo = list.find((c) => c.logo);
      if (withLogo) picks.push(withLogo);
      if (picks.length >= 8) break;
    }
    return picks.length ? picks : channels.slice(0, 6);
  }, [categories, channelsByCategory, channels]);

  // Top rows: top 4 categories, 12 channels each
  const topRows = useMemo(() => {
    return [...categories]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((cat) => ({
        ...cat,
        channels: (channelsByCategory.get(cat.name) || []).slice(0, 18),
      }));
  }, [categories, channelsByCategory]);

  // Recently / popular flat list across categories for "Recém adicionados"
  const recentChannels = useMemo(() => channels.slice(0, 24), [channels]);

  // Hero rotation
  const [heroIndex, setHeroIndex] = useState(0);
  useEffect(() => {
    if (featuredChannels.length < 2) return;
    const id = setInterval(() => setHeroIndex((i) => (i + 1) % featuredChannels.length), 7000);
    return () => clearInterval(id);
  }, [featuredChannels.length]);
  const hero = featuredChannels[heroIndex];

  // Search-filtered (flat) channels — used when searching
  const searchResults = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return [] as Channel[];
    return channels
      .filter((c) => c.name.toLowerCase().includes(t) || c.group.toLowerCase().includes(t))
      .slice(0, 200);
  }, [channels, search]);

  // Channels of selected category
  const categoryChannels = useMemo(() => {
    if (!selectedCategory) return [];
    return (channelsByCategory.get(selectedCategory) || [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [selectedCategory, channelsByCategory]);

  const visibleChannels = useMemo(() => categoryChannels.slice(0, visibleCount), [categoryChannels, visibleCount]);
  useEffect(() => setVisibleCount(INITIAL), [selectedCategory]);

  const handleToggleFav = (id: string) => {
    const added = toggleFavorite(id, "channel");
    setTick((t) => t + 1);
    toast.success(added ? "Adicionado aos favoritos" : "Removido dos favoritos");
  };

  const scrollToGrid = () => {
    setTimeout(() => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const handleChannelClick = (c: Channel) => {
    if (isMobile) setPlaying(c);
    else setPreviewing(c);
  };

  if (playing) return <PlayerView channel={playing} onBack={() => setPlaying(null)} />;

  const isFiltering = !!selectedCategory || !!search.trim();

  // ============== Header ==============
  const Header = (
    <div className="flex items-center gap-3 sm:gap-4">
      {selectedCategory && (
        <button
          onClick={() => { setSelectedCategory(null); setPreviewing(null); }}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-card/70 backdrop-blur flex items-center justify-center hover:bg-surface-hover transition-colors tv-focus shrink-0"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
        </button>
      )}
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl tv:text-2xl font-bold text-foreground tracking-tight truncate">
          {selectedCategory || "Canais ao Vivo"}
        </h1>
        <p className="text-[11px] sm:text-xs text-muted-foreground">
          {selectedCategory
            ? `${categoryChannels.length} canais`
            : `${channels.length} canais • ${categories.length} categorias`}
        </p>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-card/70 backdrop-blur border border-border/50 w-44 sm:w-64 tv:w-80">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar canais..."
          className="flex-1 bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none tv-focus min-w-0"
        />
        {search && (
          <button onClick={() => setSearch("")} className="tv-focus shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 sm:space-y-8 tv:space-y-10 pb-8">
      {Header}

      {/* HERO (only when not filtering) */}
      {!isFiltering && hero && (
        <AnimatePresence mode="wait">
          <motion.section
            key={hero.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="relative rounded-2xl overflow-hidden -mx-1 sm:mx-0"
          >
            <div className={cn(
              "relative aspect-[16/9] sm:aspect-[21/9] tv:aspect-[24/9] w-full bg-gradient-to-br",
              CATEGORY_GRADIENTS[hashIndex(hero.group || hero.name, CATEGORY_GRADIENTS.length)]
            )}>
              {/* Background blurred logo */}
              {hero.logo && (
                <div className="absolute inset-0 overflow-hidden">
                  <img
                    src={hero.logo}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 w-full h-full object-cover scale-150 blur-2xl opacity-30"
                  />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

              {/* Foreground logo */}
              {hero.logo && (
                <div className="absolute right-6 sm:right-12 tv:right-20 top-1/2 -translate-y-1/2 hidden sm:block">
                  <motion.img
                    key={hero.id + "-logo"}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    src={hero.logo}
                    alt={hero.name}
                    className="max-h-32 sm:max-h-44 tv:max-h-64 max-w-[40vw] object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
                  />
                </div>
              )}

              {/* Content */}
              <div className="relative z-10 h-full flex flex-col justify-end p-4 sm:p-8 tv:p-12 max-w-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-600 text-[10px] sm:text-xs font-bold text-white tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    AO VIVO
                  </span>
                  <span className="text-xs sm:text-sm uppercase tracking-widest text-primary/90 font-semibold">
                    {hero.group}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-4xl tv:text-6xl font-bold text-foreground leading-tight tracking-tight line-clamp-2">
                  {hero.name}
                </h2>
                {hero.epgNow && (
                  <p className="text-xs sm:text-sm tv:text-base text-muted-foreground mt-2 sm:mt-3 line-clamp-2">
                    Agora: {hero.epgNow}
                  </p>
                )}
                <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
                  <button
                    onClick={() => setPlaying(hero)}
                    className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-foreground text-background text-xs sm:text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity tv-focus"
                  >
                    <Play className="w-4 h-4 fill-background" />
                    Assistir
                  </button>
                  <button
                    onClick={() => handleToggleFav(hero.id)}
                    className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-card/80 backdrop-blur text-foreground text-xs sm:text-sm font-medium hover:bg-surface-hover transition-colors tv-focus border border-border/50 flex items-center gap-2"
                  >
                    <Heart className={cn("w-4 h-4", isFavorite(hero.id) ? "fill-primary text-primary" : "")} />
                    {isFavorite(hero.id) ? "Favorito" : "Favoritar"}
                  </button>
                </div>
              </div>

              {/* Hero indicators */}
              {featuredChannels.length > 1 && (
                <div className="absolute bottom-3 right-4 sm:bottom-4 sm:right-8 flex gap-1.5 z-10">
                  {featuredChannels.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setHeroIndex(i)}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        i === heroIndex ? "w-6 bg-primary" : "w-1.5 bg-foreground/30 hover:bg-foreground/50"
                      )}
                      aria-label={`Slide ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.section>
        </AnimatePresence>
      )}

      {/* CATEGORIAS — colored tiles */}
      {!isFiltering && categories.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg tv:text-2xl font-semibold text-foreground tracking-tight flex items-center gap-2">
              <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Categorias
            </h3>
            <span className="text-xs text-muted-foreground">{categories.length} no total</span>
          </div>
          <div className="flex gap-3 sm:gap-4 overflow-x-auto carousel-scroll -mx-1 px-1 pb-2 snap-x">
            {categories.map((cat) => {
              const grad = CATEGORY_GRADIENTS[hashIndex(cat.name, CATEGORY_GRADIENTS.length)];
              return (
                <button
                  key={cat.name}
                  onClick={() => { setSelectedCategory(cat.name); scrollToGrid(); }}
                  className={cn(
                    "shrink-0 snap-start text-left tv-focus rounded-xl overflow-hidden",
                    "w-40 sm:w-52 tv:w-64 h-24 sm:h-28 tv:h-36",
                    "bg-gradient-to-br shadow-lg",
                    "hover:scale-[1.04] focus-visible:scale-[1.04] transition-transform duration-300",
                    grad
                  )}
                >
                  <div className="relative w-full h-full p-3 sm:p-4 flex flex-col justify-between">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.2),transparent_60%)]" />
                    <Tv className="relative w-5 h-5 sm:w-6 sm:h-6 text-white/80" />
                    <div className="relative">
                      <p className="text-sm sm:text-base font-bold text-white tracking-tight line-clamp-2 drop-shadow">
                        {cat.name}
                      </p>
                      <p className="text-[10px] sm:text-xs text-white/80 font-medium">
                        {cat.count} canais
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* TOP CATEGORY ROWS */}
      {!isFiltering && topRows.map((row) => (
        <section key={row.name}>
          <div className="flex items-end justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg tv:text-2xl font-semibold text-foreground tracking-tight">
              {row.name}
            </h3>
            <button
              onClick={() => { setSelectedCategory(row.name); scrollToGrid(); }}
              className="text-xs text-primary hover:text-primary/80 tv-focus"
            >
              Ver todos ({row.count})
            </button>
          </div>
          <div className="flex gap-2.5 sm:gap-3 tv:gap-4 overflow-x-auto carousel-scroll -mx-1 px-1 pb-2 snap-x">
            {row.channels.map((c, i) => (
              <ChannelCard key={c.id} channel={c} index={i} onClick={handleChannelClick} />
            ))}
          </div>
        </section>
      ))}

      {/* RECENTLY ADDED */}
      {!isFiltering && recentChannels.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg tv:text-2xl font-semibold text-foreground tracking-tight">
              Recém adicionados
            </h3>
          </div>
          <div className="flex gap-2.5 sm:gap-3 tv:gap-4 overflow-x-auto carousel-scroll -mx-1 px-1 pb-2 snap-x">
            {recentChannels.map((c, i) => (
              <ChannelCard key={c.id} channel={c} index={i} onClick={handleChannelClick} />
            ))}
          </div>
        </section>
      )}

      {/* SEARCH RESULTS */}
      {!selectedCategory && search.trim() && (
        <section ref={gridRef}>
          <div className="flex items-end justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg tv:text-2xl font-semibold text-foreground tracking-tight">
              Resultados
            </h3>
            <span className="text-xs text-muted-foreground">{searchResults.length} canais</span>
          </div>
          {searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">Nenhum canal encontrado.</p>
          ) : (
            <div className="grid gap-2.5 sm:gap-3 tv:gap-4 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 tv:grid-cols-6 2xl:grid-cols-8">
              {searchResults.map((c, i) => (
                <ChannelCard key={c.id} channel={c} index={i} onClick={handleChannelClick} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* CATEGORY GRID + PREVIEW */}
      {selectedCategory && (
        <AnimatePresence mode="wait">
          <motion.section
            key={selectedCategory}
            ref={gridRef}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
            className={cn(
              "gap-4",
              !isMobile && previewing ? "flex" : "block"
            )}
          >
            <div className={cn(
              !isMobile && previewing ? "flex-1 min-w-0" : "w-full"
            )}>
              <div className={cn(
                "grid gap-2.5 sm:gap-3 tv:gap-4",
                !isMobile && previewing
                  ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 tv:grid-cols-4"
                  : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 tv:grid-cols-6 2xl:grid-cols-8"
              )}>
                {visibleChannels.map((c, i) => (
                  <ChannelCard key={c.id} channel={c} index={i} onClick={handleChannelClick} />
                ))}
              </div>

              {categoryChannels.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount((c) => c + STEP)}
                  className="w-full py-3 mt-4 rounded-lg bg-card text-sm font-medium text-foreground hover:bg-surface-hover transition-colors border border-border/30 tv-focus"
                >
                  Carregar mais canais
                </button>
              )}

              {visibleChannels.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-12">Nenhum canal encontrado.</p>
              )}
            </div>

            {/* Player preview on right (desktop/TV only) */}
            {!isMobile && previewing && (
              <div className="w-[380px] lg:w-[440px] tv:w-[520px] shrink-0 sticky top-20 self-start">
                <div className="rounded-xl overflow-hidden bg-card border border-border/50 card-shadow">
                  <div className="aspect-video bg-black relative">
                    <PlayerView
                      channel={previewing}
                      onBack={() => setPreviewing(null)}
                      isVod={false}
                    />
                  </div>
                  <div className="p-3 sm:p-4">
                    <div className="flex items-center gap-3">
                      {previewing.logo && (
                        <img src={previewing.logo} alt="" className="w-10 h-10 rounded-md object-cover bg-card shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{previewing.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{previewing.epgNow || previewing.group}</p>
                      </div>
                      <button
                        onClick={() => handleToggleFav(previewing.id)}
                        className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-hover transition-colors tv-focus"
                      >
                        <Heart className={cn("w-4 h-4", isFavorite(previewing.id) ? "fill-primary text-primary" : "text-muted-foreground")} />
                      </button>
                      <button
                        onClick={() => setPlaying(previewing)}
                        className="px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity tv-focus"
                      >
                        <Play className="w-3.5 h-3.5 fill-primary-foreground" />
                        Tela cheia
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      )}

      {!isFiltering && channels.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-16">Configure sua lista para carregar canais ao vivo.</p>
      )}
    </div>
  );
};

export default LiveView;
