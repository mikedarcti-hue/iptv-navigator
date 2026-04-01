import { Tv, Film, Clapperboard, Heart, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const items = [
  { id: "dashboard", label: "Início", icon: Home },
  { id: "live", label: "Ao Vivo", icon: Tv },
  { id: "movies", label: "Filmes", icon: Film },
  { id: "series", label: "Séries", icon: Clapperboard },
  { id: "favorites", label: "Favoritos", icon: Heart },
];

const BottomNav = ({ activeSection, onSectionChange }: BottomNavProps) => {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-background/95 backdrop-blur-xl border-t border-border/30 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-all min-w-0",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary))]")} />
              <span className="text-[10px] font-medium truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
