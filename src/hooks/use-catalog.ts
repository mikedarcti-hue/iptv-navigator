import { useCallback, useEffect, useMemo, useState } from "react";
import { getStoredCatalog, setStoredCatalog, type CatalogData } from "@/lib/catalog-store";

export function useCatalog() {
  const [catalog, setCatalog] = useState<CatalogData>(() => getStoredCatalog());

  useEffect(() => {
    const handler = () => setCatalog(getStoredCatalog());
    window.addEventListener("storage", handler);
    window.addEventListener("catalog-updated", handler);

    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("catalog-updated", handler);
    };
  }, []);

  const refreshCatalog = useCallback(() => {
    setCatalog(getStoredCatalog());
  }, []);

  const updateCatalog = useCallback((nextCatalog: CatalogData) => {
    setStoredCatalog(nextCatalog);
    setCatalog(nextCatalog);
    window.dispatchEvent(new Event("catalog-updated"));
    window.dispatchEvent(new Event("channels-updated"));
  }, []);

  const hasCustomCatalog = useMemo(
    () => catalog.live.length + catalog.movies.length + catalog.series.length > 0,
    [catalog],
  );

  return {
    catalog,
    hasCustomCatalog,
    refreshCatalog,
    updateCatalog,
  };
}
