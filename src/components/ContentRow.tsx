import { ChevronRight } from "lucide-react";
import { useRef } from "react";
import VodCard from "./VodCard";
import type { VodItem } from "@/lib/mock-data";

interface ContentRowProps {
  title: string;
  items: VodItem[];
  onItemClick?: (item: VodItem) => void;
  onSeeAll?: () => void;
}

const ContentRow = ({ title, items, onItemClick, onSeeAll }: ContentRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-4 md:px-0">
        <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">{title}</h2>
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors tv-focus"
          >
            Ver tudo
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto carousel-scroll pl-4 md:pl-0 pr-4 md:pr-0 pb-2"
      >
        {items.map((item, index) => (
          <div key={item.id} className="shrink-0 w-[130px] sm:w-[150px] md:w-[160px] lg:w-[170px] xl:w-[180px]">
            <VodCard item={item} index={index} onClick={onItemClick} />
          </div>
        ))}
      </div>
    </section>
  );
};

export default ContentRow;
