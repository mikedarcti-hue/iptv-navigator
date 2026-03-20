import { useCallback, useEffect, useMemo, useState } from "react";
import { getStoredCatalog, setStoredCatalog, loadCatalogFromIDB, type CatalogData } from "@/lib/catalog-store";

export function useCatalog() {
  const [catalog, setCatalog] = useState<CatalogData>(() => getStoredCatalog());

  useEffect(() => {
    // Load full catalog from IndexedDB on mount
    loadCatalogFromIDB().then((loaded) => {
      setCatalog(loaded);
    });

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
    setCatalog(nextCatalog); // update UI immediately
    setStoredCatalog(nextCatalog).then(() => {
      window.dispatchEvent(new Event("catalog-updated"));
      window.dispatchEvent(new Event("channels-updated"));
    });
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
