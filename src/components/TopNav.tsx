import { Tv, Film, Clapperboard, Heart, Settings, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface TopNavProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  globalSearch: string;
  onSearchChange: (value: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Início" },
  { id: "live", label: "Ao Vivo", icon: Tv },
  { id: "movies", label: "Filmes", icon: Film },
  { id: "series", label: "Séries", icon: Clapperboard },
  { id: "favorites", label: "Favoritos", icon: Heart },
];

const TopNav = ({ activeSection, onSectionChange, globalSearch, onSearchChange }: TopNavProps) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <header className="fixed top-0 inset-x-0 z-50 transition-all duration-300">
      <div className="bg-gradient-to-b from-background via-background/95 to-transparent">
        <div className="flex items-center justify-between h-14 md:h-16 px-4 md:px-8 lg:px-12">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <img src="/favicon.png" alt="DARK IPTV" className="w-8 h-8 md:w-9 md:h-9 rounded-lg object-cover" />
            <span className="text-base md:text-lg font-bold tracking-tight text-foreground hidden sm:block">
              DARK IPTV
            </span>
          </div>

          {/* Desktop Nav */}
          {!isMobile && (
            <nav className="hidden md:flex items-center gap-1 ml-8">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-all tv-focus",
                    activeSection === item.id
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground/80"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2">
            {searchOpen ? (
              <div className="flex items-center gap-2 bg-card/90 backdrop-blur-xl rounded-full px-3 py-1.5 border border-border/50 animate-scale-in">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={globalSearch}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Buscar..."
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-32 sm:w-48"
                />
                <button onClick={() => { setSearchOpen(false); onSearchChange(""); }}>
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-card/50 transition-colors tv-focus"
              >
                <Search className="w-5 h-5 text-foreground" />
              </button>
            )}
            <button
              onClick={() => onSectionChange("settings")}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center hover:bg-card/50 transition-colors tv-focus",
                activeSection === "settings" && "bg-card/50"
              )}
            >
              <Settings className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopNav;
