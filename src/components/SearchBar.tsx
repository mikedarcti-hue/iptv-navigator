import { Search, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchBar = ({ value, onChange, placeholder = "Buscar canais, filmes, séries..." }: SearchBarProps) => {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
        "glass-surface inner-glow",
        focused && "ring-1 ring-primary/40 glow-accent"
      )}
    >
      <Search className="w-5 h-5 text-muted-foreground shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
      />
      {value && (
        <button onClick={() => onChange("")} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default SearchBar;
