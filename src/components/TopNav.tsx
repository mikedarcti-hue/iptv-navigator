import { Tv, Film, Clapperboard, Heart, Settings, Search, X, Info, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import AccountInfoDialog from "@/components/AccountInfoDialog";

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
  const [accountOpen, setAccountOpen] = useState(false);
  const isMobile = useIsMobile();
  const [clock, setClock] = useState("");
  const [expiry, setExpiry] = useState<string | null>(null);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    };
    updateClock();
    const interval = setInterval(updateClock, 30000);

    // Load expiry from cached account info
    try {
      const cached = localStorage.getItem("dark_iptv_account_info");
      if (cached) {
        const info = JSON.parse(cached);
        if (info.expDate && info.expDate !== "N/A") setExpiry(info.expDate);
      }
    } catch {}

    return () => clearInterval(interval);
  }, []);

  return (
    <>
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
              {/* Clock & Expiry info */}
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground mr-2">
                <Clock className="w-3.5 h-3.5" />
                <span>{clock}</span>
                {expiry && (
                  <>
                    <span className="text-border">•</span>
                    <span className="text-primary/80 text-[11px]">Exp: {expiry}</span>
                  </>
                )}
              </div>

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

              {/* Account info button */}
              <button
                onClick={() => setAccountOpen(true)}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-card/50 transition-colors tv-focus"
                title="Informações da conta"
              >
                <Info className="w-5 h-5 text-foreground" />
              </button>

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
      <AccountInfoDialog open={accountOpen} onOpenChange={setAccountOpen} />
    </>
  );
};

export default TopNav;
